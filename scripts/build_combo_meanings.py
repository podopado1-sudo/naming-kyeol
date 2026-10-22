#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
이름 한자 조합(智宇 등)의 뜻을 Claude로 자연어 윤문하는 1회성 배치 스크립트.

입력: combo-glosses.json  — `dotnet run -- dump-combo-glosses` 산출물
      { "智宇": "智(슬기 지) + 宇(집 우)", ... }  (글자별 기계 글로스)
출력: data/combo-meanings.json
      { "智宇": "슬기롭고 큰", ... }              (조합 단위 자연어 윤문)

build_name_seo_data.py 가 이 파일을 읽어 name-seo.json 의 top-level `comboMeans`로
병합하고, /name 페이지 ComboCard 가 조합별 뜻을 표시한다. 파일에 없는 조합은
글자별 훈음만 노출(무회귀 폴백).

왜 배치인가 (creative-name-meanings 와 동일 철학):
  - 윤문 단위가 '한자쌍'이라 이름 무관·거의 유일(12,506개) → 1회 생성하면 영구 재사용,
    런타임 LLM 비용 0. 이름 단위 윤문보다 입력(확정된 두 한자 뜻)이 정확해 품질도 더 좋다.
  - Message Batches API 50% 할인 + 레이트리밋 부담 없음.
  - 풀이 거의 안 바뀌므로 단발성(대법원 데이터·조합 선택 로직 변경 시에만 재실행).

대략 비용(12,506개, 배치 50% 할인 후 추정):
  - claude-sonnet-4-6: ~$3   (기본 — 한국어 윤문 품질 우선)
  - claude-haiku-4-5 : ~$1   (--model 로 전환 가능)

사용법:
  pip install anthropic
  export ANTHROPIC_API_KEY=sk-ant-...        # 키는 환경변수/파일 경유 — 채팅·커밋 금지
  # 1) C# 덤프
  dotnet run -- dump-combo-glosses
  # 2) 배치 윤문 (소규모 품질 시험: --sync --limit 30 먼저 권장)
  python scripts/build_combo_meanings.py --sync --limit 30
  python scripts/build_combo_meanings.py

⚠️ claude-sonnet-5-5 (2026-10-22 S6): thinking 을 생략하면 adaptive 로 돌아 max_tokens 120 을 생각에 다 써
빈 결과가 난다(시험 30쌍 중 3쌍 — 燦宛·祐度 처럼 훈이 낯선 쌍). 이 모델은 --thinking between_tools 로 끈다
(Sonnet 5.5 는 disabled 가 400). 그 밖의 모델은 기본값(생략)으로 둔다. 끝에 입력·출력 토큰 합계를 찍는다(비용 보고용).
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
    "당신은 한국 작명 전문가입니다. 두 글자로 된 이름의 한자 조합과 각 한자의 뜻(훈음)이 "
    "주어집니다. 이 두 한자의 뜻을 자연스럽게 엮어, 그 이름이 담는 의미로 어울리는 한국어 "
    "구절 하나로 다듬으세요.\n\n"
    "규칙:\n"
    "- 출력은 뜻 구절 하나만. 설명·따옴표·한자·접두사 없이 구절만 출력하세요.\n"
    "- 8~16자 내외의 짧은 구절로, 그 자체로 읽히는 캡션 형태 (예: '슬기롭고 큰 그릇의', "
    "'진실한 사랑을 품은', '강인한 생명력'). 종결어미(-다/-요)로 끝내지 마세요.\n"
    "- 한자 훈(슬기, 집 등)을 그대로 나열하지 말고 자연스러운 형용사구로 의역하세요.\n"
    "- 두 한자의 뜻을 모두 반영하되, 어색하면 더 자연스러운 쪽으로 의역해도 됩니다.\n"
    # 독음 맞춤 훈(dump-combo-glosses GlossFor) 을 줘도 모델이 그 글자의 대표 뜻을 끌어온다 —
    # 讀(구절 두) 쌍이 '독서로 빛나는'(2026-10-22 S6 시험). ND-6 '카드 훈과 다른 소리의 뜻' 재발 방지
    "- 각 한자의 뜻은 주어진 훈만 근거로 삼으세요. 같은 한자가 다른 소리로 읽힐 때의 뜻(예: 讀은 '두'로 "
    "읽으면 '구절', '독'으로 읽어야 '읽다')이나 주어지지 않은 다른 훈을 끌어오지 마세요. 이 이름에서는 "
    "주어진 소리와 훈으로만 읽힙니다.\n"
    "- 부정적이거나 이름에 어색한 뜻(비, 그물, 진압 등)은 긍정적 함의로 순화하세요."
)


def to_user(pair, gloss):
    return f"한자 조합: {pair}\n각 한자 뜻: {gloss}"


def create_kwargs(model, max_tokens, pair, gloss, thinking):
    """요청 파라미터 — thinking 이 'default' 면 생략(모델 기본값), 아니면 {"type": thinking}."""
    kw = dict(
        model=model,
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": to_user(pair, gloss)}],
    )
    if thinking != "default":
        kw["thinking"] = {"type": thinking}
    return kw


def build_requests(items, model, max_tokens, thinking="default"):
    """items: list[(pair, gloss)] → (requests, idx→pair 매핑)."""
    requests, id_to_pair = [], {}
    for i, (pair, gloss) in enumerate(items):
        cid = f"c{i}"  # custom_id는 영숫자/하이픈/언더스코어만 → 한자 불가, 인덱스로 매핑
        id_to_pair[cid] = pair
        requests.append(
            Request(
                custom_id=cid,
                params=MessageCreateParamsNonStreaming(**create_kwargs(model, max_tokens, pair, gloss, thinking)),
            )
        )
    return requests, id_to_pair


def extract_text(message):
    """Message.content에서 첫 text 블록을 추출해 한 줄로 정리."""
    for block in message.content:
        if getattr(block, "type", None) == "text":
            line = block.text.strip().splitlines()[0].strip() if block.text.strip() else ""
            return line.strip().strip('"“”\'')  # 따옴표 제거
    return ""


def main():
    ap = argparse.ArgumentParser(description="이름 한자 조합 뜻 배치 윤문 (Claude)")
    ap.add_argument("--input", default="combo-glosses.json", help="덤프 글로스 JSON")
    ap.add_argument("--output", default="data/combo-meanings.json", help="출력 JSON")
    ap.add_argument("--model", default="claude-sonnet-4-6", help="모델 (haiku로 비용 절감 가능)")
    ap.add_argument("--max-tokens", type=int, default=120)
    ap.add_argument("--limit", type=int, default=0, help="앞에서 N개만 (0=전체, 시험용)")
    ap.add_argument("--poll-interval", type=int, default=30, help="배치 폴링 간격(초)")
    ap.add_argument("--resume", action="store_true", help="출력에 이미 있는 조합은 건너뜀")
    ap.add_argument("--sync", action="store_true",
                    help="배치 대신 동기 직접 호출 (즉시 결과, 소량 품질 시험용). 배치 50%% 할인은 없음.")
    ap.add_argument("--thinking", default="default", choices=["default", "between_tools", "disabled"],
                    help="thinking 설정 (default=생략). claude-sonnet-5-5 는 between_tools 로 꺼야 max_tokens 안에 답한다")
    args = ap.parse_args()

    with open(args.input, encoding="utf-8") as f:
        glosses = json.load(f)

    existing = {}
    if os.path.exists(args.output):
        with open(args.output, encoding="utf-8") as f:
            existing = json.load(f)

    items = [(p, g) for p, g in glosses.items() if g]
    if args.resume:
        items = [(p, g) for p, g in items if p not in existing]
    if args.limit:
        items = items[: args.limit]

    if not items:
        print("처리할 조합이 없습니다.")
        return

    # 키의 앞뒤 공백·개행 제거 — 파일/환경변수 경유 시 끝에 '\n'이 붙어 HTTP 헤더가
    # 거부되는 경우 방지 (Illegal header value ...\n).
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        sys.exit("ANTHROPIC_API_KEY가 설정되지 않았습니다.")
    client = anthropic.Anthropic(api_key=api_key)
    result = dict(existing)
    ok = err = expired = 0
    tok_in = tok_out = 0

    if args.sync:
        # 동기 직접 호출 — 즉시 결과(소량 품질 시험용). 배치 50% 할인은 없지만 큐 대기가 없다.
        print(f"[sync] {len(items)}개 직접 호출 ({args.model}, thinking={args.thinking})")
        for i, (pair, gloss) in enumerate(items):
            try:
                msg = client.messages.create(
                    **create_kwargs(args.model, args.max_tokens, pair, gloss, args.thinking)
                )
                tok_in += msg.usage.input_tokens
                tok_out += msg.usage.output_tokens
                text = extract_text(msg)
                if text:
                    result[pair] = text
                    ok += 1
                else:
                    err += 1
            except Exception as e:  # noqa: BLE001 — 개별 실패는 건너뛰고 계속
                err += 1
                print(f"  오류 {pair}: {e}")
            if (i + 1) % 20 == 0:
                print(f"      {i + 1}/{len(items)} (성공 {ok} / 오류 {err})")
    else:
        # 비동기 배치 — 대량(50% 할인). 큐 대기가 있을 수 있음(최대 24h).
        requests, id_to_pair = build_requests(items, args.model, args.max_tokens, args.thinking)
        print(f"[1/3] 배치 생성: {len(requests)}개 ({args.model}, thinking={args.thinking})")
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
            pair = id_to_pair.get(r.custom_id)
            if pair is None:
                continue
            if r.result.type == "succeeded":
                tok_in += r.result.message.usage.input_tokens
                tok_out += r.result.message.usage.output_tokens
                text = extract_text(r.result.message)
                if text:
                    result[pair] = text
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
    print(f"토큰: 입력 {tok_in:,} / 출력 {tok_out:,} ({'동기 정가' if args.sync else '배치 50% 할인 대상'})")
    print(f"출력: {args.output}  (총 {len(result)}개 누적)")
    # 샘플
    for p, _ in items[:8]:
        if p in result:
            print(f"  {p}: {result[p]}")


if __name__ == "__main__":
    main()
