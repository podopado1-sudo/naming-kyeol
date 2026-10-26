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
대표 뜻(mean) 계약 (2026-10-07):
  - creative-name-meanings의 뜻이 표시 combos와 모순이면(mean_combo_check: 페이지 어느 조합에도 없는
    한자의 구체 명사 훈 — 연꽃·비·별·으뜸) 1순위 조합 뜻(combo-meanings)으로 교체한다.
    weak 추가 등으로 combos가 바뀌어도 재생성만 하면 뜻이 따라온다. 감사: audit_mean_combo_mismatch.py
이름 갈래 플래그 (2026-10-22 S7 — ND-3): `dotnet run -- dump-name-flags`(루트 name-flags.json, .gitignore)의 pk·fx 만 복사한다.
  pk 1 = 한글 이름으로 쓰는 순우리말 이름(조합 유무 무관 — '한자로 쓴다면(참고)' 표시용) — PureKoreanNameEngine 내장 사전
         − data/pure-korean-name-overrides.json exclude(한자어 낱말·한자 이름으로 흔한 이름) + include(한별·은별).
         pk 의 대표 뜻은 creative-name-meanings 그대로(한글 이름의 뜻) — 조합 뜻으로 모순 교체·빈 뜻 폴백을 하지 않는다.
         대표 뜻이 자기 조합 뜻과 같으면 실패한다.
  fx 1 = 한자 조합이 없고 data/foreign-given-names.json(사람 검토 목록)에 실린 외래 이름(외국 인명 표기·'-엘' 같은 외래 요소로 지은 이름)
  덤프가 없는데 기존 출력에 플래그가 있으면 실패한다(조용히 빠지지 않게). fx 인데 조합이 있으면 덤프가 낡은 것이라 실패한다.
pk 서사 점검 (2026-10-26 B2 — 배포 검증 NAME-1): pk 이름 서사(story)에 1순위 조합 글자의 '그 독음의 훈' 어간이 나오면 실패한다
  (하별 '흘러나오는'(潎 빨리 흐를)·이랑 '밝은 이치를'(朗 밝을)·물결 '말 한마디도…깨끗하게'(勿 말·潔 깨끗할) — `pk_story_echoes`).
  서사는 음절별 한자 훈(dump-story-inputs 글로스)으로 지은 문장이라 pk 대표 뜻(한글 이름의 뜻)과 따로 논다 — data/name-stories.json 을
  손으로 고친다(한글 이름 뜻 기준 한 문장, 2026-10-26 59명). 훈 글자 그대로만 보므로 뜻말 되풀이(한솔 '넓은 강처럼'(漢 한수)·
  별이 '이치를'(理 다스릴))는 못 잡는다 — pk 서사를 새로 넣거나 조합이 바뀌면 한글 뜻과 눈으로도 대조할 것.
  발행 블로그가 인용한 다온·한결은 문장 고정이라 뺀다.
출력:    frontend/src/data/name-seo.json + 검증 리포트(stdout)
"""

import csv
import json
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mean_combo_check import (  # noqa: E402
    HanjaIndex, appears, is_hangul, jong, keywords_of, segments_for_reading, stale_keywords, with_jong,
)

HANGUL_NAME = re.compile(r"^[가-힣]{2,3}$")
# 외래 이름의 어원 뜻 문장('히브리어로 신이 더하신다는'·'히브리어 야곱에서 이어진') — fx 가 아닌 이름에 붙으면 경고(손질 실수 탐지)
ETYMOLOGY_MEAN = re.compile(r"^(?:고대 )?[가-힣]+어(?:로 | [가-힣]+에서 이어진$)")

# pk 서사 점검에서 빼는 이름 — 발행 블로그가 서사를 인용해 문장을 고정했다(S7 대표 뜻 손질 때도 그대로 둔 두 이름)
PK_STORY_FIXED = {"다온", "한결"}


def _stem_forms(kw, kind):
    """훈 키워드 → 서사에서 찾을 꼴. 명사는 그대로, 형용사·동사 어간은 흔한 활용형을 더한다.
    따뜻하 → 따뜻(따뜻한·따뜻이) — 어근이 1음절이면 줄이지 않는다(吉 '길하' → '길'은 한길 '큰 길'에 걸린다).
    흐르 → 흘러(르 불규칙 — 潎 '빨리 흐를'이 '흘러가며'로 나온다). 다스리 → 다스려."""
    forms = [kw]
    if kind != "adj":
        return forms
    if kw.endswith("하") and len(kw) >= 3:
        forms.append(kw[:-1])
    last = kw[-1]
    if len(kw) >= 2 and is_hangul(last) and jong(last) == 0:
        prev = kw[-2]
        vowel = (ord(last) - 0xAC00) // 28 % 21
        if last == "르" and jong(prev) == 0 and kw not in ("푸르", "누르"):  # 푸르러·누르러(러 불규칙)는 어간 그대로 잡힌다
            bright = (ord(prev) - 0xAC00) // 28 % 21 in (0, 8)  # ㅏ·ㅗ 뒤는 '라'(바르 → 발라), 그 밖은 '러'(흐르 → 흘러)
            forms.append(kw[:-2] + with_jong(prev, 8) + ("라" if bright else "러"))
        elif vowel == 20:  # ㅣ → ㅕ (다스리 → 다스려)
            forms.append(kw[:-1] + chr(ord(last) - 14 * 28))
    return forms


def pk_story_echoes(name, story, combo, mean, hanja_idx):
    """pk(순우리말) 이름 서사에 나오는 1순위 조합 글자의 훈 어간 [(한자, 어간 꼴)]. 비어 있으면 통과.
    훈은 이름 음절의 독음에 맞는 훈(괄호 두음 인정 — mean_combo_check.segments_for_reading), 없으면 첫 훈.
    키워드 규칙(1음절 명사 낱말 경계·STOP_KEYWORDS·받침 없는 1음절 어간 제외)은 mean_combo_check 그대로다.
    오탐 줄이기: 이름이나 한글 뜻(mean)에 이미 있는 낱말은 그 이름의 뜻이라 뺀다(아라 mean '맑고 투명하게'의 雅 '맑'·
    해찬 mean '빛나는'의 燦 '빛나'·다찬 mean '가득 차'의 茶 '차')."""
    if not story or not combo or name in PK_STORY_FIXED:
        return []
    keep = name + " " + (mean or "")
    hits = []
    for pos, ch in enumerate(combo[0][:len(name)]):
        m = (hanja_idx.hanja.get(ch) or {}).get("m", "")
        huns = segments_for_reading(m, name[pos])
        if not huns:
            first = re.match(r"^(.*\S)\s+\S+$", re.split(r"[,/;·]", m)[0].strip())
            huns = [first.group(1)] if first else []
        for hun in huns:
            for kw, kind in keywords_of(hun):
                forms = _stem_forms(kw, kind)
                if any(f in keep for f in forms):
                    continue
                hit = next((f for f in forms if appears(f, kind, story)), None)
                if hit:
                    hits.append((ch, hit))
    return hits

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
    prev_flagged = 0
    if os.path.exists(OUT_PATH):
        prev = json.load(open(OUT_PATH, encoding="utf-8"))
        prev_names = set(prev.get("names", {}).keys())
        prev_pa = {n: r["pa"] for n, r in prev.get("names", {}).items() if r.get("pa")}
        prev_min_total = prev.get("meta", {}).get("minTotal")
        prev_flagged = sum(1 for r in prev.get("names", {}).values() if r.get("pk") or r.get("fx"))
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

    # 이름 갈래 플래그 (dotnet run -- dump-name-flags 산출물, 루트) — pk 순우리말 사전·fx 조합 없는 외래 이름
    flags_path = os.path.join(ROOT, "name-flags.json")
    if os.path.exists(flags_path):
        name_flags = json.load(open(flags_path, encoding="utf-8"))["names"]
    elif prev_flagged:
        print(f"[오류] {flags_path} 가 없는데 기존 출력에 pk·fx 플래그 {prev_flagged}개가 있습니다 — "
              "dotnet run -- dump-name-flags 를 먼저 돌릴 것(플래그 소실 방지 중단)", file=sys.stderr)
        return 1
    else:
        print("[경고] name-flags.json 없음 — pk·fx 플래그 없이 진행")
        name_flags = {}

    # 이름 합치기
    all_names = set(male) | set(female)
    records = {}
    # 이름 키 순서 = 가나다(코드포인트) — set 순회는 실행마다 해시 시드로 순서가 바뀌어 같은 입력에 다른 바이트가 나왔다(2026-10-22 S4)
    for name in sorted(all_names):
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

    # 모순 판정용 한자 독음 색인 (build_hanja_seo_data.py 산출물)
    hanja_idx = HanjaIndex(json.load(open(
        os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json"), encoding="utf-8")))

    # 자연어 뜻 + 서사 + 한자 조합 + 미학 점수
    with_meaning = 0
    with_story = 0
    with_combos = 0
    with_scores = 0
    used_combo_means = {}  # 수록 이름의 조합에 실제로 등장하는 한자쌍만 (top-level 맵, 중복 저장 회피)
    mean_from_combo = 0
    mean_stale = []  # 창의 뜻이 표시 조합과 모순(mean_combo_check noun·strict)이라 조합 뜻으로 바꾼 이름
    with_pk = 0
    with_fx = 0
    flag_conflicts = []  # fx 인데 조합이 있음(덤프 불일치)
    fx_no_mean = []  # 외래 이름인데 뜻이 빈 이름(어원을 확정하지 않은 조어·갈래 여럿 등 — 보고용)
    etymology_not_fx = []  # 어원 문장 뜻인데 fx 가 아닌 이름(손질 실수 의심 — 보고용)
    pk_combo_mean = []  # pk 인데 대표 뜻이 자기 조합 뜻과 같다(한자 조합에서 온 뜻 — S7V-3) → 실패
    pk_no_mean = []  # pk 인데 creative-name-meanings 에 뜻이 없다(조합 뜻으로 채우지 않으므로 빈 뜻 — 보고용)
    pk_story_echo = []  # pk 서사가 1순위 조합 글자의 훈 어간을 되풀이한다(한글 뜻이 아니라 한자 훈으로 지은 문장 — NAME-1) → 실패
    for name, rec in records.items():
        mean = meanings.get(name)
        combo = combos.get(name)
        fl = name_flags.get(name) or {}
        is_pk = bool(fl.get("pk"))
        # pk(한글 이름으로 쓰는 순우리말 이름)의 대표 뜻은 한글 이름의 뜻이다 — 조합은 '한자로 쓴다면(참고)'라
        # 조합과 어긋난다고 조합 뜻으로 바꾸거나(모순 교체) 비었다고 조합 뜻으로 채우지 않는다(구름 '차갑게 빛나는 옥빛 기품' 玖凛 — S7V-3)
        if not is_pk and mean and combo and stale_keywords(name, mean, combo, hanja_idx):
            # 6월 윤문 당시 대표 한자(蓮 연꽃·雨 비 등)의 뜻이 지금 combos 어디에도 없다 →
            # 페이지가 스스로 모순되므로 1순위 조합 뜻으로 교체 (연우 "연꽃처럼…" 아래 然佑 등).
            fallback = combo_meanings.get("".join(combo[0]))
            if fallback:
                mean_stale.append(name)
                mean = None
        if not mean and not is_pk:
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
        if is_pk:
            rec["pk"] = 1
            with_pk += 1
            if mean and combo and any(combo_meanings.get("".join(c)) == mean for c in combo):
                pk_combo_mean.append(name)
            if not mean:
                pk_no_mean.append(name)
            echo = pk_story_echoes(name, rec.get("story"), combo, rec.get("mean"), hanja_idx)
            if echo:
                pk_story_echo.append((name, echo, rec["story"]))
        elif fl.get("fx"):
            if combo:
                flag_conflicts.append(name)
            else:
                rec["fx"] = 1
                with_fx += 1
                if not rec.get("mean"):
                    fx_no_mean.append(name)
        if rec.get("mean") and ETYMOLOGY_MEAN.match(rec["mean"]) and not rec.get("fx"):
            etymology_not_fx.append(name)

    if pk_combo_mean:
        print(f"[오류] pk(순우리말) 이름인데 대표 뜻이 한자 조합 뜻과 같은 이름 {len(pk_combo_mean)}개: {' '.join(pk_combo_mean[:10])} "
              "— data/creative-name-meanings.json 에 한글 이름의 뜻을 넣을 것(pk 는 조합 뜻으로 채우지 않는다)", file=sys.stderr)
        return 1
    if pk_story_echo:
        print(f"[오류] pk(순우리말) 이름 서사가 1순위 조합 글자의 훈을 되풀이하는 이름 {len(pk_story_echo)}개 "
              "— data/name-stories.json 에서 한글 이름 뜻에 맞게 고칠 것(조합이 바뀌었다면 새 1순위 글자의 훈인지 확인):", file=sys.stderr)
        for name, echo, story in pk_story_echo[:20]:
            print(f"  {name}: {' · '.join(f'{ch} {kw}' for ch, kw in echo)} ← \"{story}\"", file=sys.stderr)
        return 1
    if flag_conflicts:
        print(f"[오류] fx 플래그인데 한자 조합이 있는 이름 {len(flag_conflicts)}개: {' '.join(flag_conflicts[:10])} "
              "— name-combos.json·name-flags.json 중 하나가 낡았다(dump-name-combos·dump-name-flags 재실행)", file=sys.stderr)
        return 1

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
    print(f"  └ 그중 창의 뜻↔조합 모순으로 교체: {len(mean_stale)} (예: {' '.join(mean_stale[:8])})")
    print(f"서사(story) 보유: {with_story} ({with_story*100//max(len(records),1)}%)")
    print(f"한자 조합 보유: {with_combos} ({with_combos*100//max(len(records),1)}%)")
    print(f"미학 점수 보유: {with_scores} ({with_scores*100//max(len(records),1)}%)")
    print(f"이름 갈래: 순우리말(pk) {with_pk} · 조합 없는 외래(fx) {with_fx} (그중 뜻 없음 {len(fx_no_mean)}: "
          f"{' '.join(fx_no_mean[:12])}{' …' if len(fx_no_mean) > 12 else ''})")
    if pk_no_mean:
        print(f"  [경고] pk 인데 대표 뜻이 없는 이름 {len(pk_no_mean)}: {' '.join(pk_no_mean[:10])} — creative-name-meanings 에 한글 이름의 뜻을 넣을 것")
    if etymology_not_fx:
        print(f"  [경고] 어원 문장 뜻인데 fx 가 아닌 이름 {len(etymology_not_fx)}: {' '.join(etymology_not_fx[:10])}")
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
