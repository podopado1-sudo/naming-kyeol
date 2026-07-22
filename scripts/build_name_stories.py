#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
이름의 사람 서사형 코이닝 문장을 Claude로 생성하는 1회성 배치 스크립트 (의미 코이닝 #3).

입력: story-inputs.json — `dotnet run -- dump-story-inputs` 산출물
      { "라영": {"gloss": "그물 라(나) + 영화 영", "mean": "빛나고 영명한"}, ... }
출력: data/name-stories.json
      { "라영": "어디에 있어도 은은하게 제 빛을 내는 사람", ... }

소비처 2곳:
  - 창의 엔진(NameStoryData → CreativeNameCandidate.Story → 카드 서사 한 줄)
  - /name SEO 페이지(build_name_seo_data.py가 rec["story"]로 병합 → Hero 인용 블록)
파일에 없는 이름은 서사가 그냥 숨겨진다(기계적 폴백 없음 — 뜻(mean)과 다른 점).

왜 배치인가: build_creative_meanings.py와 동일 — 이름 단위·유한(~3,300개)이라 1회 생성
→ 정적 파일 → 런타임 LLM 비용 0. Batch API 50% 할인.

대략 비용(3,300개, sonnet 배치 기준): $4-5. (--model claude-haiku-4-5 로 ~$1.5 가능하나
기존 mean 코퍼스가 sonnet 산출물이라 톤 일관성상 sonnet 권장)

사용법:
  pip install anthropic
  export ANTHROPIC_API_KEY=sk-ant-...   (Windows: setx 사용자 환경변수 — 채팅에 키 금지)
  # 1) C# 덤프
  dotnet run -- dump-story-inputs story-inputs.json
  # 2) 소규모 품질 시험 → 검수 후 전량 배치 (--resume이 시험분 스킵)
  python scripts/build_name_stories.py --input story-inputs.json --sync --limit 30
  python scripts/build_name_stories.py --input story-inputs.json --resume
"""
import argparse
import hashlib
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
    "당신은 한국 작명 브랜드의 수석 카피라이터입니다. 두 글자 이름과 그 한자 뜻(훈음), "
    "이미 다듬어진 수식어구 뜻이 주어집니다. 이 재료로, 이 이름이 그리는 '사람상'을 "
    "담담하게 묘사하는 한국어 문장 하나를 지으세요.\n\n"
    "예시:\n"
    "- 라영 (그물 라(나) + 영화 영 / 빛나고 영명한) → 어디에 있어도 은은하게 제 빛을 내는 사람\n"
    "- 윤슬 (맑을 윤 + 슬기 슬 / 맑고 슬기로운) → 잔잔한 물결처럼 맑게 빛나는 사람\n"
    "- 도현 (길 도 + 어질 현 / 어질고 곧은) → 제 길을 알고 어질게 걸어가는 사람\n\n"
    "규칙:\n"
    "- 출력은 문장 하나만. 설명·따옴표·이름 반복·접두사 없이 문장만 출력하세요.\n"
    "- 15~30자 내외. 마지막 '종결' 지시에 따라 명사형으로 끝맺으세요.\n"
    "- 담담하고 절제된 묘사만 하세요. 과장('세상을 빛낼', '모두가 사랑하는'), "
    "소망·기원형('~하길 바라는', '~되기를'), 유행어·신조어는 금지합니다.\n"
    "- 은유는 한 문장에 하나까지만 쓰세요.\n"
    "- 특정 세대나 성별에 치우친 표현을 피하세요. 아이에게도 어른에게도 어울려야 합니다.\n"
    "- 한자 뜻과 수식어구의 의미를 살리되, 훈을 나열하지 말고 사람의 태도·기질·분위기로 옮기세요.\n"
    "- '분위기' 힌트가 주어지면 그 결의 어휘를 적극 반영하세요('고요', '은은', '조용' 같은 "
    "표현이 여러 이름에 반복되는 것을 막기 위한 장치입니다). 단, 한자 뜻과 어긋나면 한자 뜻을 "
    "따르세요.\n"
    "- 부정적이거나 어색한 한자 뜻(그물, 비, 변방 등)은 무시해도 됩니다."
)

# 종결/분위기 로테이션 — 배치 요청 간 기억이 없어 "가끔 다르게" 지시는 무력하다.
# 이름 해시(md5, 솔트로 축 분리) 기반 결정적 선택이라 --resume 재실행에도 같은 힌트가 재현된다.
# ⚠ h*31+ord 류 곱셈 해시는 한글 코드포인트 구조(가≡0 mod 8 등)와 맞물려 동음 계열이
# 같은 버킷에 뭉치는 사고가 있었음(가나=가빈 → 동일 문장) — md5로 교체.
ENDING_PERSON = "'~ 사람'으로 끝맺으세요."
ENDING_VARIED = ("'사람' 대신 이름과 어울리는 다른 명사(마음, 눈빛, 걸음, 기운, 목소리, "
                 "숨결 등)로 끝맺으세요.")

# 분위기 팔레트 — 시험 30개에서 '고요/은은' 계열 편중 + 동일 문장 중복(가나=가빈)이
# 관찰되어 추가. 이름마다 다른 결을 결정적으로 제시해 어휘를 흩뜨린다.
# 라벨만으론 모델이 상투어로 회귀해 어휘 앵커를 함께 제시한다.
MOODS = [
    ("차분하고 고요한", "잔잔한·단정한·평온한"),
    ("밝고 생기 있는", "환한·경쾌한·싱그러운"),
    ("단단하고 굳건한", "묵직한·꿋꿋한·의연한"),
    ("따뜻하고 다정한", "포근한·너그러운·살가운"),
    ("맑고 산뜻한", "청량한·시원한·개운한"),
    ("깊고 진중한", "그윽한·차분한·헤아리는"),
    ("유연하고 자유로운", "부드러운·거침없는·트인"),
    ("총명하고 슬기로운", "명민한·지혜로운·영리한"),
]


def _hash(name, salt):
    """결정적 해시 (플랫폼/실행 무관). salt로 종결/분위기 축의 상관을 끊는다."""
    return int.from_bytes(hashlib.md5((salt + name).encode("utf-8")).digest()[:4], "big")


def ending_hint(name):
    return ENDING_PERSON if _hash(name, "end:") % 10 < 7 else ENDING_VARIED


def mood_hint(name):
    label, words = MOODS[_hash(name, "mood:") % len(MOODS)]
    return f"{label} 결 (어휘 예: {words})"


def user_message(name, item):
    gloss = item.get("gloss", "")
    mean = item.get("mean", "")
    lines = [f"이름: {name}", f"한자 뜻: {gloss}"]
    if mean:
        lines.append(f"수식어구: {mean}")
    lines.append(f"분위기: {mood_hint(name)}")
    lines.append(f"종결: {ending_hint(name)}")
    return "\n".join(lines)


def build_requests(items, model, max_tokens):
    """items: list[(name, item)] → (requests, idx→name 매핑)."""
    requests, id_to_name = [], {}
    for i, (name, item) in enumerate(items):
        cid = f"n{i}"  # custom_id는 영숫자/하이픈/언더스코어만 → 한글 불가, 인덱스로 매핑
        id_to_name[cid] = name
        requests.append(
            Request(
                custom_id=cid,
                params=MessageCreateParamsNonStreaming(
                    model=model,
                    max_tokens=max_tokens,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_message(name, item)}],
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
    ap = argparse.ArgumentParser(description="이름 서사(사람상 한 문장) 배치 생성 (Claude)")
    ap.add_argument("--input", default="story-inputs.json", help="덤프 입력 JSON (gloss+mean)")
    ap.add_argument("--output", default="data/name-stories.json", help="출력 JSON")
    ap.add_argument("--model", default="claude-sonnet-4-6", help="모델 (haiku로 비용 절감 가능)")
    ap.add_argument("--max-tokens", type=int, default=150)
    ap.add_argument("--limit", type=int, default=0, help="앞에서 N개만 (0=전체, 시험용)")
    ap.add_argument("--poll-interval", type=int, default=30, help="배치 폴링 간격(초)")
    ap.add_argument("--resume", action="store_true", help="출력에 이미 있는 이름은 건너뜀")
    ap.add_argument("--sync", action="store_true",
                    help="배치 대신 동기 직접 호출 (즉시 결과, 소량 품질 시험용). 배치 50%% 할인은 없음.")
    args = ap.parse_args()

    with open(args.input, encoding="utf-8") as f:
        inputs = json.load(f)

    existing = {}
    if os.path.exists(args.output):
        with open(args.output, encoding="utf-8") as f:
            existing = json.load(f)

    items = [(n, item) for n, item in inputs.items() if item.get("gloss")]
    if args.resume:
        items = [(n, item) for n, item in items if n not in existing]
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
        for i, (name, item) in enumerate(items):
            try:
                msg = client.messages.create(
                    model=args.model,
                    max_tokens=args.max_tokens,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_message(name, item)}],
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
