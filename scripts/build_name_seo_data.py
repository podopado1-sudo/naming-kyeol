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

사용법:  python scripts/build_name_seo_data.py [min_total] [--baseline 경로] [--drip-start YYYY-MM-DD] [--drip-per-week N]
         min_total: 출생신고 합산 빈도 하한 (기본: 기존 출력의 meta.minTotal, 최초엔 80)
         --baseline: 최초 드립 부트스트랩용 — 여기 없는 신규 이름에만 publishAt(pa) 부여 (평시 불필요)
         --drip-start/--drip-per-week: 주간 개방 시작일·주당 개수(기본 70)
         pa가 있는 이름은 프론트가 빌드 시각 기준으로 pa 도래 전이면 페이지를 만들지 않는다(주간 드립).

⚠️ 드립 안전 계약 (2026-09-03 리뷰 후속):
  - 기존 출력(frontend/src/data/name-seo.json)의 pa는 재실행 시 **자동 이월**된다 —
    평시 재생성(weak 검수 라운드 등)에 --baseline·--drip-start를 다시 줄 필요가 없고,
    실수로 빠뜨려도 pa가 소실되지 않는다.
  - 기존 출력에 없던 완전 신규 이름은 이월된 마지막 코호트 뒤에 이어붙는다.
  - 기존 출력에 pa가 있는데 새 출력에서 pa가 전멸하면 하드 에러로 중단한다.
  - min_total 기본값도 기존 출력의 meta.minTotal을 따른다(무인자 재실행 = 현상 유지).
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

    args = sys.argv[1:]
    pos = [a for a in args if not a.startswith("--")]
    def _opt(flag, default=None):
        return args[args.index(flag) + 1] if flag in args else default
    baseline_path = _opt("--baseline")
    drip_start = _opt("--drip-start")
    drip_per_week = int(_opt("--drip-per-week", "70"))

    # 기존 출력 로드 — pa 이월(carry-forward)과 min_total 기본값의 원천.
    prev_pa = {}
    prev_names = set()
    prev_min_total = None
    if os.path.exists(OUT_PATH):
        prev = json.load(open(OUT_PATH, encoding="utf-8"))
        prev_names = set(prev.get("names", {}).keys())
        prev_pa = {n: r["pa"] for n, r in prev.get("names", {}).items() if r.get("pa")}
        prev_min_total = prev.get("meta", {}).get("minTotal")
        if prev_pa:
            print(f"[drip] 기존 출력 pa {len(prev_pa)}개 이월 (수록 {len(prev_names)}개)")

    min_total = int(pos[0]) if pos else (prev_min_total or 80)

    baseline_names = set()
    if baseline_path:
        if not os.path.exists(baseline_path):
            print(f"[오류] --baseline 경로가 없습니다: {baseline_path}", file=sys.stderr)
            return 1
        baseline_names = set(json.load(open(baseline_path, encoding="utf-8"))["names"].keys())
        print(f"[drip] 기준선 {len(baseline_names)}개 — 신규 이름에만 publishAt 부여")

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

    # 사람 서사형 코이닝 문장 (data/name-stories.json, build_name_stories.py 산출물).
    # 없으면 건너뜀(페이지가 서사 블록 숨김 — 순수 additive 레이어).
    stories_path = os.path.join(DATA, "name-stories.json")
    stories = (
        json.load(open(stories_path, encoding="utf-8"))
        if os.path.exists(stories_path)
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
    ranked = sorted(records.items(), key=lambda kv: (-kv[1]["t"], kv[0]))  # 동률은 가나다 — 결정적 빌드
    for i, (name, rec) in enumerate(ranked, start=1):
        rec["rank"] = i

    # 주간 드립 pa 부여 — 3단계:
    #   1) 이월: 기존 출력에 pa가 있던 이름은 그 pa를 그대로 유지 (재생성 안전)
    #   2) 이월 뒤 신규: 기존 출력에도 없던 이름은 마지막 코호트 이어서 배정
    #   3) 부트스트랩: 이월할 pa가 없고 --baseline이 주어지면 기준선 밖 이름에 최초 배정
    from datetime import date, timedelta

    carried = 0
    for n in records:
        if n in prev_pa:
            records[n]["pa"] = prev_pa[n]
            carried += 1

    if carried:
        # 이월된 코호트의 꼬리를 찾아 신규 이름을 이어붙인다 (마지막 주가 덜 찼으면 채움)
        cohort_count = defaultdict(int)
        for n in records:
            if "pa" in records[n]:
                cohort_count[records[n]["pa"]] += 1
        tail = max(cohort_count)
        tail_date = date.fromisoformat(tail)
        new_names = [n for n, _ in ranked if n not in prev_names]
        for n in new_names:
            if cohort_count[tail_date.isoformat()] >= drip_per_week:
                tail_date += timedelta(weeks=1)
            records[n]["pa"] = tail_date.isoformat()
            cohort_count[tail_date.isoformat()] += 1
        print(f"[drip] pa 이월 {carried}개 + 신규 {len(new_names)}개 이어붙임 (마지막 코호트 {tail_date if new_names else tail})")
    elif baseline_names:
        if drip_start:
            start = date.fromisoformat(drip_start)
        else:
            today = date.today()
            start = today + timedelta(days=(6 - today.weekday()) % 7 or 7)  # 다음 일요일
        new_names = [n for n, _ in ranked if n not in baseline_names]
        for i, n in enumerate(new_names):
            records[n]["pa"] = (start + timedelta(weeks=i // drip_per_week)).isoformat()
        last = start + timedelta(weeks=(len(new_names) - 1) // drip_per_week) if new_names else start
        print(f"[drip] 신규 {len(new_names)}개 → {start}부터 주 {drip_per_week}개, 마지막 코호트 {last}")

    # 하드 가드: 이월할 pa가 있었는데 새 출력에서 전멸하면 드립 사고 — 중단
    out_pa_count = sum(1 for r in records.values() if "pa" in r)
    if prev_pa and out_pa_count == 0:
        print("[오류] 기존 출력에 publishAt이 있는데 새 출력에서 전부 사라졌습니다 — 드립 파괴 방지 중단", file=sys.stderr)
        return 1
    lost = prev_names - set(records)
    if prev_names and len(lost) > 0:
        print(f"[오류] 기존 수록 이름 {len(lost)}개가 새 출력에서 탈락했습니다 (min_total 상향?) — 색인된 페이지 404 방지 중단", file=sys.stderr)
        print(f"       예: {sorted(lost)[:8]} · 의도된 축소라면 기존 출력을 지우고 재실행", file=sys.stderr)
        return 1

    # 성별 분리 순위
    for gender_key, src in (("rm", male), ("rf", female)):
        granked = sorted(
            (n for n in records if records[n][gender_key[1]] > 0),
            key=lambda n: (-records[n][gender_key[1]], n),
        )
        for i, name in enumerate(granked, start=1):
            records[name][gender_key] = i

    # 자연어 뜻 + 서사 + 한자 조합 + 미학 점수
    with_meaning = 0
    with_story = 0
    with_combos = 0
    with_scores = 0
    used_combo_means = {}  # 수록 이름의 조합에 실제로 등장하는 한자쌍만 (top-level 맵, 중복 저장 회피)
    mean_from_combo = 0
    for name, rec in records.items():
        mean = meanings.get(name)
        if not mean:
            # 폴백: 1순위 한자 조합의 자연어 뜻을 이름 뜻으로 (NameSeoRecord.mean 정의
            # "대표 한자 기준의 일반적 느낌"과 일치 — 드립 신규 이름의 뜻 공백 방지)
            combo = combos.get(name)
            if combo:
                mean = combo_meanings.get("".join(combo[0]))
                if mean:
                    mean_from_combo += 1
        if mean:
            rec["mean"] = mean
            with_meaning += 1
        story = stories.get(name)
        if story:
            rec["story"] = story
            with_story += 1
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
    pa_dates = sorted(r["pa"] for r in records.values() if "pa" in r)
    if pa_dates:
        print(f"publishAt 보유: {len(pa_dates)} (코호트 {pa_dates[0]} ~ {pa_dates[-1]})")
    else:
        print("publishAt 보유: 0 (드립 비활성)")
    print(f"자연어 뜻 보유: {with_meaning} ({with_meaning*100//max(len(records),1)}%, 조합 폴백 {mean_from_combo})")
    print(f"서사(story) 보유: {with_story} ({with_story*100//max(len(records),1)}%)")
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
