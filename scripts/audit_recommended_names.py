#!/usr/bin/env python3
"""
추천 이름 감사 — 흔한 성씨 x 성별 전수로 추천을 모아, '실제로 안 쓰이는 조합'을 추려낸다.

신호: 표준(한자) 추천 이름을 대법원 실명 데이터(data/name-gender-stats.json의 names,
2008~2019 등록 2음절 이름)와 대조. 실명 목록에 없는 이름 = 합성/단어형 의심
(예: 규정·주인·시정 — 아무도 아이 이름으로 안 지음). 외부 사전 불필요.

출력: ① 실명에 없는 표준 추천(빈도순) — 검수 1순위 ② 전체 표준 추천 빈도 상위
"""
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# Dev는 http(5000)에서 https(5001)로 307 리다이렉트 → https 직접 호출(자체서명 무시)
API = "https://localhost:5001/api/v1/recommendations/smart"
_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode = ssl.CERT_NONE
_REPORT = []  # 파일 출력용
SURNAMES = ["김","이","박","최","정","강","조","윤","장","임","한","오","서","신",
            "권","황","안","송","전","홍","고","문","양","손","배","백","허","남"]
GENDERS = ["male", "female"]

def call(ln, g):
    body = json.dumps({"lastName": ln, "gender": g, "tone": "neutral",
                       "birthDate": "2024-03-15"}).encode()
    for attempt in range(6):
        req = urllib.request.Request(API, data=body,
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60, context=_SSL) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:           # 레이트 리밋 → 백오프 후 재시도
                time.sleep(3 * (attempt + 1))
                continue
            raise
    raise RuntimeError("429 재시도 초과")

def out(line=""):
    print(line)
    _REPORT.append(line)

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    real = set(json.load(open(os.path.join(root, "data", "name-gender-stats.json"),
                              encoding="utf-8"))["names"].keys())

    std_freq = Counter()
    std_ctx = defaultdict(set)        # 이름 -> {성씨성별}
    not_real = Counter()
    not_real_ctx = defaultdict(set)
    calls = 0

    for ln in SURNAMES:
        for g in GENDERS:
            try:
                res = call(ln, g)
            except Exception as e:
                print(f"  ! {ln}/{g} 실패: {e}")
                continue
            calls += 1
            time.sleep(0.6)  # 레이트 리밋 회피
            cats = {c["type"]: c for c in res.get("categories", [])}
            std = cats.get("standard", {}).get("names", [])
            for n in std:
                nm = n.get("name", "")
                if len(nm) != 2:
                    continue
                std_freq[nm] += 1
                std_ctx[nm].add(f"{ln}{g[0]}")
                if nm not in real:
                    not_real[nm] += 1
                    not_real_ctx[nm].add(f"{ln}{g[0]}")

    pct = len(not_real) * 100 // max(1, len(std_freq))
    out(f"\n=== 감사 완료: {calls}개 요청, 표준 고유 이름 {len(std_freq)}개 ===\n")
    out(f"[1] 대법원 실명에 없는 표준 추천 = 합성/단어형 의심 (검수 1순위) "
        f"- {len(not_real)}종, 표준의 {pct}%")
    for nm, c in not_real.most_common(50):
        out(f"   {nm}  x{c}  ({', '.join(sorted(not_real_ctx[nm])[:6])})")

    out(f"\n[2] 과집중 — 많은 성씨/성별에 반복 추천된 이름 (총 {calls}컨텍스트 중)")
    for nm, ctxs in sorted(std_ctx.items(), key=lambda kv: -len(kv[1]))[:25]:
        flag = "" if nm in real else "  <- 실명없음"
        out(f"   {nm}  {len(ctxs)}/{calls}개 컨텍스트{flag}")

    out(f"\n[3] 전체 표준 추천 빈도 상위 25")
    for nm, c in std_freq.most_common(25):
        flag = "" if nm in real else "  <- 실명없음"
        out(f"   {nm}  x{c}{flag}")

    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "_audit_report.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(_REPORT))

if __name__ == "__main__":
    main()
