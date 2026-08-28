#!/usr/bin/env python3
"""
상호 작명 — 조건이 결과를 실제로 바꾸는지 감사.

입력 폼(업종·톤)을 바꿔도 결과가 그대로면 폼이 장식이 된다.
2026-08-28 실측에서 카페·음식점의 modern과 playful이 12개 결과 100% 동일했다.
원인은 톤이 '업종이 고른 4개 축 안에서만' 가점해, 두 톤의 교집합이 같으면
점수 함수가 완전히 같아지는 구조였다.

이 스크립트는 그 회귀를 한 커맨드로 잡는다.

사용:
    dotnet run                       # 백엔드 먼저 (https://localhost:5001)
    python scripts/audit_company_variation.py
    python scripts/audit_company_variation.py --max-tone-overlap 0.6

FAIL 시 exit 1.
"""
import argparse
import itertools
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from collections import Counter

BASE = "https://localhost:5001/api/v1/company-names"

# 백엔드 글로벌 리미터가 IP당 분당 60회(고정 창)라 그 아래로 페이스를 맞춘다.
# 넘기면 429가 뜨고 창이 풀릴 때까지 60초를 통째로 기다려야 해서 오히려 느리다.
REQUEST_INTERVAL = 1.1

# 개발 서버는 자체 서명 인증서를 쓴다 — 로컬 감사용이라 검증을 끈다
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def post(payload, retries=6):
    """백엔드에 글로벌 레이트 리미터가 걸려 있어 429는 물러섰다 재시도한다."""
    req = urllib.request.Request(
        BASE,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == retries - 1:
                raise
            # 고정 창(분당 60회)이라 짧은 백오프로는 안 풀린다 — Retry-After를 따른다
            wait = int(e.headers.get("Retry-After", "60"))
            print(f"    (429 — {wait}초 대기 후 재시도)")
            time.sleep(wait)


def get_options(retries=6):
    req = urllib.request.Request(BASE + "/options")
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == retries - 1:
                raise
            time.sleep(int(e.headers.get("Retry-After", "60")))


def jaccard(a, b):
    union = a | b
    return len(a & b) / len(union) if union else 1.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=12)
    ap.add_argument(
        "--max-tone-overlap",
        type=float,
        default=0.70,
        help="같은 업종에서 두 톤의 결과 겹침 상한 (기본 0.70)",
    )
    ap.add_argument(
        "--max-industry-overlap",
        type=float,
        default=0.72,
        help="업종 쌍의 결과 겹침 상한 (기본 0.72) — 톤 축 주입이 업종을 뭉개는지 감시",
    )
    ap.add_argument(
        "--max-repeat-ratio",
        type=float,
        default=0.45,
        help="한 이름이 전체 조합 중 등장해도 되는 최대 비율 (기본 0.45)",
    )
    args = ap.parse_args()

    try:
        opts = get_options()
    except urllib.error.URLError as e:
        print(f"[FAIL] 백엔드에 붙지 못했습니다 ({BASE}): {e}")
        print("       dotnet run 으로 먼저 서버를 띄우세요.")
        return 1

    industries = [i["key"] for i in opts["industries"]]
    tones = [t["key"] for t in opts["tones"]]
    print(f"업종 {len(industries)} × 톤 {len(tones)} = {len(industries) * len(tones)}조합, "
          f"각 {args.count}개\n")

    results = {}
    for ind in industries:
        for tone in tones:
            r = post({"industry": ind, "tone": tone, "style": "all", "count": args.count})
            results[(ind, tone)] = [c["name"] for c in r["candidates"]]
            time.sleep(REQUEST_INTERVAL)

    failures = []

    # ── 1. 같은 업종에서 톤만 바꿨을 때 ─────────────────────────
    print("■ 톤 차별화 (같은 업종, 톤 쌍별 겹침)")
    worst = []
    for ind in industries:
        pairs = []
        for a, b in itertools.combinations(tones, 2):
            j = jaccard(set(results[(ind, a)]), set(results[(ind, b)]))
            pairs.append((j, a, b))
            if j > args.max_tone_overlap:
                failures.append(f"{ind}: {a} vs {tone_pad(b)} 겹침 {j:.0%}")
        pairs.sort(reverse=True)
        avg = sum(p[0] for p in pairs) / len(pairs)
        worst.append((pairs[0][0], ind, pairs[0][1], pairs[0][2], avg))
    worst.sort(reverse=True)
    for j, ind, a, b, avg in worst:
        flag = "  ← 상한 초과" if j > args.max_tone_overlap else ""
        print(f"  {ind:<12} 평균 {avg:>4.0%}  최악 {a}/{b} {j:>4.0%}{flag}")

    # ── 2. 특정 이름의 편중 ────────────────────────────────────
    print("\n■ 이름 편중 (전체 조합 중 등장 비율)")
    total = len(results)
    counter = Counter()
    for names in results.values():
        counter.update(set(names))
    for name, n in counter.most_common(10):
        ratio = n / total
        flag = "  ← 상한 초과" if ratio > args.max_repeat_ratio else ""
        print(f"  {name:<10} {n:>3}/{total} ({ratio:>4.0%}){flag}")
        if ratio > args.max_repeat_ratio:
            failures.append(f"'{name}'이 전체 조합의 {ratio:.0%}에 등장")

    # ── 3. 업종 차별화 ────────
    # 톤 서명 축을 주입하면 여러 업종에 같은 축이 얹혀 업종끼리 가까워질 수 있다.
    # 출력만 하고 판정에서 빼면 이 회귀를 놓친다 — 반드시 게이트를 건다.
    #
    # 상한 0.72는 "12개 중 10개까지 겹쳐도 통과"라는 뜻이다. 관대해 보이지만 현재
    # 구조의 실제 한계값이다 — 의미 축 12개로 업종 18개를 표현하면 한 축을 평균 6개
    # 업종이 공유하고, food/agri(둘 다 결실 1순위)나 fashion/culture(둘 다 손길)처럼
    # 실제로 인접한 업종은 축 재배치만으로 더 갈라지지 않는다.
    # 근본 해결은 축을 늘리거나 업종별 고유 어휘를 두는 것이며 지금 범위 밖이다.
    # 이 게이트의 목적은 "오늘보다 나빠지는 것"을 잡는 회귀 방지이지, 이상적 목표치가 아니다.
    print()
    print("■ 업종 차별화 (업종 쌍별 겹침 최댓값, 톤 전체에서)")
    ipairs = []
    for a, b in itertools.combinations(industries, 2):
        j = max(jaccard(set(results[(a, t)]), set(results[(b, t)])) for t in tones)
        ipairs.append((j, a, b))
    ipairs.sort(reverse=True)
    for j, a, b in ipairs[:8]:
        flag = "  ← 상한 초과" if j > args.max_industry_overlap else ""
        print(f"  {a}/{b:<14} {j:>4.0%}{flag}")
    for j, a, b in ipairs:
        if j > args.max_industry_overlap:
            failures.append(f"업종 {a} vs {b} 겹침 {j:.0%}")

    # ── 4. 기본 건전성 ────────────────────────────────────────
    for (ind, tone), names in results.items():
        if len(names) != args.count:
            failures.append(f"{ind}/{tone}: {len(names)}개만 생성 (기대 {args.count})")
        if len(set(names)) != len(names):
            failures.append(f"{ind}/{tone}: 중복 이름 존재")

    print()
    if failures:
        print(f"[FAIL] {len(failures)}건")
        for f in failures[:20]:
            print(f"  - {f}")
        if len(failures) > 20:
            print(f"  ... 외 {len(failures) - 20}건")
        return 1

    print("[PASS] 조건이 결과를 충분히 바꿉니다")
    return 0


def tone_pad(s):
    return s


if __name__ == "__main__":
    sys.exit(main())
