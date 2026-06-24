#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
창의 작명 실명 풀의 뜻 풀이를 Claude로 자연어 윤문하는 1회성 배치 스크립트.

입력: creative-glosses.json  — `dotnet run -- dump-creative-glosses` 산출물
      { "라영": "그물 라(나) + 영화 영", ... }  (엔진의 기계적 글로스)
출력: data/creative-name-meanings.json
      { "라영": "빛나고 영명한", ... }          (자연어 윤문)

엔진(CreativeMeaningData)이 런타임에 이 파일을 읽어 뜻을 표시하고, 파일에 없는
이름은 기계적 글로스로 폴백한다.

왜 배치인가:
  - 뜻은 '이름 단위'(성씨 무관)라 한 번 만들면 영구 재사용 → 런타임 LLM 비용 0.
  - Message Batches API는 50% 저렴 + 레이트리밋 부담 없음. 2,480개는 단일 배치로 충분.
  - 풀이 거의 안 바뀌므로 사실상 단발성(대법원 데이터 갱신 시에만 재실행).

대략 비용(2,480개, 입력 ~65K·출력 ~75K 토큰, 배치 50% 할인 후):
  - claude-sonnet-4-6: ~$0.66   (기본 — 한국어 윤문 품질 우선)
  - claude-haiku-4-5 : ~$0.22   (--model 로 전환 가능)

사용법:
  pip install anthropic
  export ANTHROPIC_API_KEY=sk-ant-...
  # 1) C# 덤프
  dotnet run -- dump-creative-glosses creative-glosses.json
  # 2) 배치 윤문 (소규모 시험: --limit 30 먼저 권장)
  python scripts/build_creative_meanings.py --input creative-glosses.json --limit 30
  python scripts/build_creative_meanings.py --input creative-glosses.json
"""
import argparse
import json
import os
import sys
import time

try:
    import anthropic
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request
except ImportError:
    sys.exit("anthropic SDK가 필요합니다:  pip install anthropic")

SYSTEM_PROMPT = (
    "당신은 한국 작명 전문가입니다. 두 글자 이름과 각 음절의 한자 뜻(훈음)이 주어집니다. "
    "이 한자 뜻들을 자연스럽게 엮어, 아기 이름의 의미로 어울리는 한국어 구절 하나로 다듬으세요.\n\n"
    "규칙:\n"
    "- 출력은 뜻 구절 하나만. 설명·따옴표·이름 반복·접두사 없이 구절만 출력하세요.\n"
    "- 8~16자 내외의 수식어구 형태를 권장합니다 (예: '빛나고 슬기로운', '맑고 단아한', '깊고 그윽한').\n"
    "- 한자 훈(맑을, 빛날 등)을 그대로 나열하지 말고 자연스러운 형용사구로 바꾸세요.\n"
    "- 한자 뜻 중 이름에 어울리는 의미를 고르고, 어색하거나 부정적인 뜻(비, 그물, 변방 등)은 피하세요.\n"
    "- 억지로 두 뜻을 다 넣지 말고, 더 자연스러운 쪽으로 의역해도 됩니다."
)


def build_requests(items, model, max_tokens):
    """items: list[(name, gloss)] → (requests, idx→name 매핑)."""
    requests, id_to_name = [], {}
    for i, (name, gloss) in enumerate(items):
        cid = f"n{i}"  # custom_id는 영숫자/하이픈/언더스코어만 → 한글 불가, 인덱스로 매핑
        id_to_name[cid] = name
        requests.append(
            Request(
                custom_id=cid,
                params=MessageCreateParamsNonStreaming(
                    model=model,
                    max_tokens=max_tokens,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": f"이름: {name}\n한자 뜻: {gloss}"}],
                ),
            )
        )
    return requests, id_to_name


def extract_text(message):
    """Message.content에서 첫 text 블록을 추출해 한 줄로 정리."""
    for block in message.content:
        if getattr(block, "type", None) == "text":
            line = block.text.strip().splitlines()[0].strip() if block.text.strip() else ""
            return line.strip().strip('"“”\'')  # 따옴표 제거
    return ""


def main():
    ap = argparse.ArgumentParser(description="창의 이름 뜻 풀이 배치 윤문 (Claude)")
    ap.add_argument("--input", default="creative-glosses.json", help="덤프 글로스 JSON")
    ap.add_argument("--output", default="data/creative-name-meanings.json", help="출력 JSON")
    ap.add_argument("--model", default="claude-sonnet-4-6", help="모델 (haiku로 비용 절감 가능)")
    ap.add_argument("--max-tokens", type=int, default=120)
    ap.add_argument("--limit", type=int, default=0, help="앞에서 N개만 (0=전체, 시험용)")
    ap.add_argument("--poll-interval", type=int, default=30, help="배치 폴링 간격(초)")
    ap.add_argument("--resume", action="store_true", help="출력에 이미 있는 이름은 건너뜀")
    ap.add_argument("--sync", action="store_true",
                    help="배치 대신 동기 직접 호출 (즉시 결과, 소량 품질 시험용). 배치 50%% 할인은 없음.")
    args = ap.parse_args()

    with open(args.input, encoding="utf-8") as f:
        glosses = json.load(f)

    existing = {}
    if os.path.exists(args.output):
        with open(args.output, encoding="utf-8") as f:
            existing = json.load(f)

    items = [(n, g) for n, g in glosses.items() if g]
    if args.resume:
        items = [(n, g) for n, g in items if n not in existing]
    if args.limit:
        items = items[: args.limit]

    if not items:
        print("처리할 이름이 없습니다.")
        return

    # 키의 앞뒤 공백·개행 제거 — 파일/환경변수 경유 시 끝에 '\n'이 붙어 HTTP 헤더가
    # 거부되는 경우 방지 (Illegal header value ...\n).
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        sys.exit("ANTHROPIC_API_KEY가 설정되지 않았습니다.")
    client = anthropic.Anthropic(api_key=api_key)
    result = dict(existing)
    ok = err = expired = 0

    if args.sync:
        # 동기 직접 호출 — 즉시 결과(소량 품질 시험용). 배치 50% 할인은 없지만 큐 대기가 없다.
        print(f"[sync] {len(items)}개 직접 호출 ({args.model})")
        for i, (name, gloss) in enumerate(items):
            try:
                msg = client.messages.create(
                    model=args.model,
                    max_tokens=args.max_tokens,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": f"이름: {name}\n한자 뜻: {gloss}"}],
                )
                text = extract_text(msg)
                if text:
                    result[name] = text
                    ok += 1
                else:
                    err += 1
            except Exception as e:  # noqa: BLE001 — 개별 실패는 건너뛰고 계속
                err += 1
                print(f"  오류 {name}: {e}")
            if (i + 1) % 20 == 0:
                print(f"      {i + 1}/{len(items)} (성공 {ok} / 오류 {err})")
    else:
        # 비동기 배치 — 대량(50% 할인). 큐 대기가 있을 수 있음(최대 24h).
        requests, id_to_name = build_requests(items, args.model, args.max_tokens)
        print(f"[1/3] 배치 생성: {len(requests)}개 ({args.model})")
        batch = client.messages.batches.create(requests=requests)
        print(f"      batch id = {batch.id}")

        print("[2/3] 처리 대기 (대부분 1시간 내, 최대 24h)...")
        while True:
            batch = client.messages.batches.retrieve(batch.id)
            if batch.processing_status == "ended":
                break
            c = batch.request_counts
            print(f"      처리중… 성공 {c.succeeded} / 오류 {c.errored} / 대기 {c.processing}")
            time.sleep(args.poll_interval)

        print("[3/3] 결과 수집")
        for r in client.messages.batches.results(batch.id):
            name = id_to_name.get(r.custom_id)
            if name is None:
                continue
            if r.result.type == "succeeded":
                text = extract_text(r.result.message)
                if text:
                    result[name] = text
                    ok += 1
                else:
                    err += 1
            elif r.result.type == "expired":
                expired += 1
            else:  # errored
                err += 1

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(result.items())), f, ensure_ascii=False, indent=1)

    print(f"\n완료: 성공 {ok} / 오류 {err} / 만료 {expired}")
    print(f"출력: {args.output}  (총 {len(result)}개 누적)")
    # 샘플
    for n, _ in items[:8]:
        if n in result:
            print(f"  {n}: {result[n]}")


if __name__ == "__main__":
    main()
