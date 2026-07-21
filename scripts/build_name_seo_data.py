# -*- coding: utf-8 -*-
"""
이름(given-name) SEO 페이지용 정적 데이터 빌드 스크립트.

대법원 출생신고 실명 빈도(scripts/_name_raw/m.csv·f.csv)를 핵심 자산으로,
이름별 인기 순위·성별 비율·자연어 뜻(data/creative-name-meanings.json)을
병합해 frontend/src/data/name-seo.json 을 생성한다.

/hanja SEO 와 동일한 플레이북:
  - 빌드 타임 정적 데이터(엔진 호출 없음)
  - 단계적 공개(상위 N개부터, thin-content·빌드용량 회피)
  - 음절 단위로 /hanja/[독음] 및 다른 /name/[이름]로 내부링크

사용법:  python scripts/build_name_seo_data.py [min_total]
         min_total: 출생신고 합산 빈도 하한 (기본 80)
출력:    frontend/src/data/name-seo.json + 검증 리포트(stdout)
"""

import csv
import json
import os
import re
import sys
from collections import defaultdict

HANGUL_NAME = re.compile(r"^[가-힣]{2,3}$")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
RAW = os.path.join(ROOT, "scripts", "_name_raw")
OUT_PATH = os.path.join(ROOT, "frontend", "src", "data", "name-seo.json")


def load_csv_weights(path):
    weights = {}
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("name") or "").strip()
            try:
                w = int(row.get("weight") or 0)
            except ValueError:
                continue
            if name:
                weights[name] = weights.get(name, 0) + w
    return weights


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    min_total = int(sys.argv[1]) if len(sys.argv) > 1 else 80

    male = load_csv_weights(os.path.join(RAW, "m.csv"))
    female = load_csv_weights(os.path.join(RAW, "f.csv"))
    meanings = json.load(
        open(os.path.join(DATA, "creative-name-meanings.json"), encoding="utf-8")
    )

    # 한자 조합 (dotnet run -- dump-name-combos 산출물, 루트). 없으면 건너뜀.
    combos_path = os.path.join(ROOT, "name-combos.json")
    combos = (
        json.load(open(combos_path, encoding="utf-8"))
        if os.path.exists(combos_path)
        else {}
    )

    # 조합별 자연어 뜻 (data/combo-meanings.json, build_combo_meanings.py 산출물).
    # 한자쌍("智宇") → 뜻("슬기롭고 큰"). 없으면 건너뜀(ComboCard가 훈음만 폴백 표시).
    combo_meanings_path = os.path.join(DATA, "combo-meanings.json")
    combo_meanings = (
        json.load(open(combo_meanings_path, encoding="utf-8"))
        if os.path.exists(combo_meanings_path)
        else {}
    )

    # 미학 점수 breakdown (dotnet run -- dump-name-scores 산출물, 루트). 없으면 건너뜀.
    scores_path = os.path.join(ROOT, "name-scores.json")
    scores = (
        json.load(open(scores_path, encoding="utf-8"))
        if os.path.exists(scores_path)
        else {}
    )

    # 이름 합치기
    all_names = set(male) | set(female)
    records = {}
    for name in all_names:
        if not HANGUL_NAME.match(name):
            continue
        m = male.get(name, 0)
        f = female.get(name, 0)
        total = m + f
        if total < min_total:
            continue
        records[name] = {"m": m, "f": f, "t": total}

    # 인기 순위(전체 합산 기준) 부여
    ranked = sorted(records.items(), key=lambda kv: -kv[1]["t"])
    for i, (name, rec) in enumerate(ranked, start=1):
        rec["rank"] = i

    # 성별 분리 순위
    for gender_key, src in (("rm", male), ("rf", female)):
        granked = sorted(
            (n for n in records if records[n][gender_key[1]] > 0),
            key=lambda n: -records[n][gender_key[1]],
        )
        for i, name in enumerate(granked, start=1):
            records[name][gender_key] = i

    # 자연어 뜻 + 한자 조합 + 미학 점수
    with_meaning = 0
    with_combos = 0
    with_scores = 0
    used_combo_means = {}  # 수록 이름의 조합에 실제로 등장하는 한자쌍만 (top-level 맵, 중복 저장 회피)
    for name, rec in records.items():
        mean = meanings.get(name)
        if mean:
            rec["mean"] = mean
            with_meaning += 1
        combo = combos.get(name)
        if combo:
            rec["combos"] = combo
            with_combos += 1
            for pair in combo:
                key = "".join(pair)
                cm = combo_meanings.get(key)
                if cm and key not in used_combo_means:
                    used_combo_means[key] = cm
        sc = scores.get(name)
        if sc:
            rec["sc"] = sc
            with_scores += 1

    # 음절 → 이름 인덱스 (비슷한 이름 내부링크용)
    first_syl = defaultdict(list)
    any_syl = defaultdict(list)
    for name, _ in ranked:
        first_syl[name[0]].append(name)
        for ch in set(name):
            any_syl[ch].append(name)

    out = {
        "meta": {
            "source": "대법원 출생신고 통계(m.csv/f.csv) + creative-name-meanings",
            "minTotal": min_total,
            "count": len(records),
        },
        "names": records,
        "comboMeans": dict(sorted(used_combo_means.items())),
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as fp:
        json.dump(out, fp, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(OUT_PATH) / 1024 / 1024

    print("=== name-seo.json 빌드 리포트 ===")
    print(f"min_total(빈도 하한): {min_total}")
    print(f"수록 이름: {len(records)}")
    print(f"자연어 뜻 보유: {with_meaning} ({with_meaning*100//max(len(records),1)}%)")
    print(f"한자 조합 보유: {with_combos} ({with_combos*100//max(len(records),1)}%)")
    print(f"미학 점수 보유: {with_scores} ({with_scores*100//max(len(records),1)}%)")
    print(f"조합 뜻(comboMeans) 등재: {len(used_combo_means)}쌍 (combo-meanings.json {len(combo_meanings)}쌍 중)")
    print(f"출력 크기: {size_mb:.2f} MB → {OUT_PATH}")
    print("--- 임계값별 이름 수(스코프 참고) ---")
    totals = sorted((male.get(n, 0) + female.get(n, 0)) for n in all_names if HANGUL_NAME.match(n))
    for th in (50, 80, 100, 200, 500, 1000, 2000):
        c = sum(1 for t in totals if t >= th)
        print(f"  total>={th:>5}: {c:>6} 이름")
    print("--- 상위 12개 미리보기 ---")
    for name, rec in ranked[:12]:
        g = "남" if rec["m"] >= rec["f"] else "여"
        pct = round(max(rec["m"], rec["f"]) * 100 / max(rec["t"], 1))
        mean = rec.get("mean", "—")
        print(f"  {rec['rank']:>3}. {name} ({g} {pct}%, {rec['t']}회) — {mean}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
