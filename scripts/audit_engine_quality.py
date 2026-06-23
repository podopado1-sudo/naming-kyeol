#!/usr/bin/env python3
"""
엔진 품질 점검 — 흔한 성씨 x 성별로 smart 추천을 모아 4축 진단.

  [1] 비이름 조합   : standard/creative 추천 중 대법원 실명에 없는 2음절 이름
  [2] 성별 라벨     : GenderNote가 붙은 후보 + 컨텍스트별 1위(라벨 없어야 정상)
  [3] 점수 분포     : standard 상위 점수 min/avg/max + 저점 컨텍스트 플래그
  [4] 유행 이름     : creative 추천 중 2010~2020s 최상위 유행 이름

원천: data/name-gender-stats.json(실명), 아래 TRENDY(유행 수동 목록).
출력: 콘솔 + scripts/_audit_quality_report.txt
"""
import json, os, ssl, sys, time, urllib.error, urllib.request
from collections import Counter, defaultdict

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

API = "https://localhost:5001/api/v1/recommendations/smart"
_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode = ssl.CERT_NONE
_REPORT = []

SURNAMES = ["김","이","박","최","정","강","조","윤","장","임","한","오","서","신",
            "권","황","안","송","전","홍"]
GENDERS = ["male", "female"]

# 2010~2020s 최상위 유행 이름(감점 대상이어야 함) — 플래그용 수동 목록
TRENDY = set("""
서준 도윤 시우 하준 주원 지호 지후 준우 예준 유준 민준 선우 서진 연우 정우 우진
준서 도현 건우 현우 민재 현준 지훈 은우 윤우 이준 시윤 지환 지안 도현 准영
서연 서윤 지우 서현 하윤 민서 지유 윤서 채원 지민 수아 지아 하은 지윤 은서 다은
예은 수빈 지원 소율 예린 시은 유나 채은 하린 아린 서아 유주 윤아 다인 가은 나윤
""".split())

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
            if e.code == 429:
                time.sleep(3 * (attempt + 1)); continue
            raise
    raise RuntimeError("429 재시도 초과")

def out(line=""):
    print(line); _REPORT.append(line)

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    real = set(json.load(open(os.path.join(root, "data", "name-gender-stats.json"),
                              encoding="utf-8"))["names"].keys())

    not_real = Counter(); not_real_ctx = defaultdict(set)
    gender_notes = []                       # (ctx, name, note)
    top1_bad = []                           # 1위에 genderNote 붙은 케이스
    std_scores = []                         # 전체 standard 점수
    low_ctx = []                            # (ctx, avg, top3)
    trendy_hits = Counter(); trendy_ctx = defaultdict(set)
    samples = []                            # 일부 컨텍스트 원본 덤프
    calls = 0

    for ln in SURNAMES:
        for g in GENDERS:
            ctx = f"{ln}{g[0]}"
            try:
                res = call(ln, g)
            except Exception as e:
                out(f"  ! {ctx} 실패: {e}"); continue
            calls += 1; time.sleep(0.5)
            cats = {c["type"]: c for c in res.get("categories", [])}

            std = cats.get("standard", {}).get("names", [])
            scores = [n.get("score") or n.get("aestheticScore") or 0 for n in std[:10]]
            std_scores += scores
            if scores:
                avg = sum(scores) / len(scores)
                top3 = scores[:3]
                if avg < 70 or (top3 and min(top3) < 65):
                    low_ctx.append((ctx, round(avg, 1), top3))
            for n in std:
                nm = n.get("name", "")
                gn = n.get("genderNote")
                if gn: gender_notes.append((ctx, nm, gn))
                if len(nm) == 2 and nm not in real:
                    not_real[nm] += 1; not_real_ctx[nm].add(ctx)
            if std and std[0].get("genderNote"):
                top1_bad.append((ctx, std[0]["name"], std[0]["genderNote"]))

            crv = cats.get("creative", {}).get("names", [])
            for n in crv:
                nm = n.get("name", "")
                if nm in TRENDY:
                    trendy_hits[nm] += 1; trendy_ctx[nm].add(ctx)
                if len(nm) == 2 and nm not in real:
                    not_real[nm] += 1; not_real_ctx[nm].add(ctx + "*")

            # 톱픽 + 샘플(앞 6개 컨텍스트만 원본 덤프)
            if len(samples) < 6:
                tp = res.get("topPick") or {}
                samples.append((ctx,
                    [(n.get("name"), n.get("score") or n.get("aestheticScore"))
                     for n in std[:5]],
                    [(n.get("name"), n.get("score")) for n in crv[:5]],
                    (tp.get("categoryType"), (tp.get("candidate") or {}).get("name"))))

    out(f"\n=== 엔진 품질 점검: {calls}개 컨텍스트 ===")

    out(f"\n[1] 비이름 의심 (실명에 없는 2음절, *=creative) — {len(not_real)}종")
    for nm, c in not_real.most_common(40):
        out(f"   {nm}  x{c}  ({', '.join(sorted(not_real_ctx[nm])[:8])})")

    out(f"\n[2] 성별 라벨(GenderNote) 붙은 후보 — {len(gender_notes)}건")
    for ctx, nm, gn in gender_notes[:40]:
        out(f"   {ctx}: {nm} — {gn}")
    out(f"  · 1위에 성별라벨(비정상) — {len(top1_bad)}건")
    for ctx, nm, gn in top1_bad:
        out(f"     {ctx}: {nm} — {gn}")

    if std_scores:
        s = sorted(std_scores)
        out(f"\n[3] standard 점수 분포 (상위10×컨텍스트, n={len(s)})")
        out(f"   min {s[0]:.1f} / p25 {s[len(s)//4]:.1f} / med {s[len(s)//2]:.1f} "
            f"/ p75 {s[len(s)*3//4]:.1f} / max {s[-1]:.1f} / avg {sum(s)/len(s):.1f}")
        out(f"  · 저점 컨텍스트(avg<70 또는 top3<65) — {len(low_ctx)}건")
        for ctx, avg, top3 in low_ctx:
            out(f"     {ctx}: avg {avg}, top3 {top3}")

    out(f"\n[4] creative 유행 이름 적중 — {len(trendy_hits)}종")
    for nm, c in trendy_hits.most_common(30):
        out(f"   {nm}  x{c}  ({', '.join(sorted(trendy_ctx[nm])[:8])})")

    out(f"\n[5] 샘플 원본 덤프 (앞 6개 컨텍스트)")
    for ctx, std5, crv5, tp in samples:
        out(f"   {ctx}  topPick={tp}")
        out(f"      standard: {std5}")
        out(f"      creative: {crv5}")

    with open(os.path.join(here, "_audit_quality_report.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(_REPORT))

if __name__ == "__main__":
    main()
