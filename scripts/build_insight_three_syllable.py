# -*- coding: utf-8 -*-
"""데이터 리포트 '세 글자 이름' 수치 산출 (2026-10-21).

frontend/content/insights/three-syllable-names.md 본문의 숫자는 전부 이 스크립트 결과(facts.json)에서 옮긴다.
손 계산 금지 — 데이터를 다시 만들면 이 스크립트를 다시 돌려 표·본문을 맞출 것.

입력 (저장소 루트 기준 상대 경로, 모두 커밋된 파일):
  frontend/src/data/name-seo.json    이름별 남아(m)·여아(f)·합계(t)·전체 순위(rank)·주간 공개일(pa)
  data/data-gov.csv                  대법원 인명용 한자표(음·한자) — '한자음에 없는 음절' 규칙용
  data/three-syllable-curated.json   /three-syllable 도구의 큐레이션 사전 — 출생신고 통계와 겹치는지 확인용
선택 입력 (.gitignore 라 없을 수 있음 — 없으면 해당 블록은 null):
  scripts/_name_raw/m.csv·f.csv     출생신고 원자료 — 수록 범위 대조용. 본문 수치로 쓰지 않는다.

자료의 한계 (리포트에 반드시 밝힐 것):
  - name-seo.json 은 build_name_seo_data.py 의 HANGUL_NAME(^[가-힣]{2,3}$) + 합계 30건 이상 필터를 거친 자료다.
    즉 '두·세 글자 한글 이름 중 출생신고 30건 이상'만 있다. 한 글자·네 글자 이상 이름, 30건 미만 이름은 없다.
    → "전체 이름 중 세 글자 비중"이 아니라 "이 자료(두·세 글자, 30건 이상) 안에서의 비중"이다.
  - 2008~2019 합산 한 덩어리라 연도별 변화는 알 수 없다(유행 변화 주장 금지).
  - 출생신고 통계에는 한글 이름만 있다. 실제로 한자로 신고했는지, 어떤 한자인지는 모른다.

분류 (외래 / 순우리말 / 기타) — 규칙 + 사람 검토(REVIEW):
  1) REVIEW 에 있으면 그 분류와 근거를 쓴다.
  2) 없고, 음절 중 하나라도 인명용 한자표의 음에 없으면 → '외래' (규칙).
     근거: 외래어 표기에서 생기는 음절(엘·스·클·든·카·레 …)은 한자음에 없다.
     고유어에도 한자음에 없는 음절(빛·메)이 있어, 그런 이름은 REVIEW 에서 순우리말로 되돌린다.
  3) 둘 다 아니면(모든 음절이 한자음에 있음) → '기타' (기본값, 애매하면 기타).
  분류 기준(리포트에 그대로 밝힘):
    외래     — 외국 인명(영어권·성경·일본어 등)을 한글로 옮겨 적은 이름.
    순우리말 — 구성 요소가 모두 고유어 낱말(방언·옛말 포함)·접사·어미로 풀리는 이름.
    기타     — 위 둘 중 어느 쪽으로도 기원을 확정하기 어려운 이름(지어낸 조합, 한자어가 섞인 말, 기원이 여럿 가능).

사용법 (저장소 루트에서, 인자 없음):
  python -I scripts/build_insight_three_syllable.py
출력: 표준출력(요약) + OUT_PATH(facts.json). OUT_PATH 는 환경 변수 INSIGHT_FACTS_OUT 으로 바꿀 수 있다.
"""
import csv
import json
import os
import re
import statistics
import sys
from collections import Counter
from decimal import ROUND_HALF_UP, Decimal
from urllib.parse import quote

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME_SEO = os.path.join(ROOT, "frontend", "src", "data", "name-seo.json")
HANJA_GOV = os.path.join(ROOT, "data", "data-gov.csv")
CURATED = os.path.join(ROOT, "data", "three-syllable-curated.json")
RAW_DIR = os.path.join(ROOT, "scripts", "_name_raw")

# 리포트 작성용 산출물(커밋 대상 아님 — tmp/ 는 .gitignore). INSIGHT_FACTS_OUT 으로 경로를 바꿀 수 있다.
DEFAULT_OUT = os.path.join(ROOT, "tmp", "insight-facts", "three-syllable.json")
OUT_PATH = os.environ.get("INSIGHT_FACTS_OUT") or DEFAULT_OUT

# /name/<이름> 링크 기준일: pa 가 없거나 pa <= 이 날짜인 이름만 링크한다(주간 드립 게이트, name-seo.ts isPublished).
# 리포트 게시일 기준으로 고정 — 그 뒤 공개분은 다음 갱신 때 링크를 더한다.
LINK_CUTOFF = "2026-10-21"

SKEW = 0.95                 # 한쪽 성별 95% 이상 = 쏠림 (unisex-names 리포트의 2,252·808 과 같은 기준)
UNISEX = (0.35, 0.65)       # 남아 비율 35~65%(양끝 포함) = 중성 (unisex-names 리포트의 494 와 같은 기준)
TOP_N = 20

CLASSES = ("외래", "순우리말", "기타")

# ---------------------------------------------------------------------------
# 사람 검토 목록 — (분류, 근거). 규칙 결과를 확인·덮어쓴다.
# 순우리말 판정은 낱말 풀이가 사전(표준국어대사전)에 고유어로 실린 경우만. 조금이라도 애매하면 기타.
# ---------------------------------------------------------------------------
REVIEW = {
    # --- 규칙이 '외래'로 잡았지만(한자음에 없는 '빛'·'메' 때문) 고유어인 이름 → 순우리말 ---
    "빛나라": ("순우리말", "빛 + 나라, 또는 '빛나다'의 명령형 — 어느 풀이든 고유어만으로 이루어짐"),
    "빛가람": ("순우리말", "빛 + 가람('강'의 옛말) — 고유어"),
    "메아리": ("순우리말", "고유어 낱말 '메아리' 그대로"),
    # --- 모든 음절이 한자음에도 있지만(규칙 미해당) 고유어로 풀리는 이름 → 순우리말 ---
    "미리내": ("순우리말", "'은하수'의 방언(경남·제주) 미리내 — 고유어"),
    "한누리": ("순우리말", "한-('큰'의 뜻 접두사) + 누리('세상'의 예스러운 말 — 옛말 표지 아님, 가람과 구별) — 고유어"),
    "찬누리": ("순우리말", "찬('차다'의 관형사형) + 누리 — 고유어"),
    "온누리": ("순우리말", "낱말 '온누리'(온 세상) — 고유어"),
    "차오름": ("순우리말", "'차오르다'의 명사형 — 고유어"),
    # --- 모든 음절이 한자음에 있어 규칙이 못 잡는 외국 인명 → 외래 ---
    "아이린": ("외래", "영어권 인명 Irene"),
    "소피아": ("외래", "인명 Sophia"),
    "아리아": ("외래", "인명 Aria"),
    "라이언": ("외래", "영어권 인명 Ryan"),
    "마리아": ("외래", "인명 Maria(성경의 마리아)"),
    "제이미": ("외래", "영어권 인명 Jamie"),
    "에이미": ("외래", "영어권 인명 Amy"),
    "에밀리": ("외래", "영어권 인명 Emily"),
    "비비안": ("외래", "영어권 인명 Vivian"),
    "조나단": ("외래", "영어권 인명 Jonathan"),
    "줄리아": ("외래", "인명 Julia"),
    "나오미": ("외래", "성경 인명 Naomi(룻기)"),
    "율리아": ("외래", "인명 Julia의 성경식 표기(로마서 16장)"),
    "루시아": ("외래", "인명 Lucia"),
    "요안나": ("외래", "성경 인명 Joanna(누가복음)"),
    # --- 기원을 하나로 확정하기 어려운 이름 → 기타 ---
    "이로운": ("기타", "'이롭다'는 한자 利 + 접미사 -롭다 — 고유어만으로 이루어지지 않음"),
    "아리솔": ("기타", "솔은 고유어지만 '아리'를 고유어 낱말 하나로 확정할 수 없음(풀이가 여럿) — 지어낸 조합일 수 있음"),
    "하나린": ("기타", "하나(고유어) + 린(한자음) 조합으로 보임 — 혼합"),
    "하예라": ("기타", "뚜렷한 낱말·외국 인명으로 풀리지 않음 — 지어낸 이름으로 봄"),
    "유리나": ("기타", "외국 인명(Yurina 등)일 수도, 유리 + 나 같은 한국식 음절 조합일 수도 있음(유리는 琉璃 같은 한자어일 수도) — 기원 여럿"),
    "유리아": ("기타", "외국 인명일 수도, 유리 + 아 같은 한국식 음절 조합일 수도 있음 — 기원 여럿"),
    "아이리": ("기타", "일본 인명 Airi일 수도, 아이 + 리 조합일 수도 있음 — 기원 여럿"),
    "명미정": ("기타", "'이름이 정해지지 않음'을 뜻하는 한자어 名未定(명미정)과 소리가 같음 — 실제 이름인지 신고 표기인지 자료로 확인할 수 없어 판단 보류"),
}

# 규칙('외래')이 맞는 이름 가운데 덧붙일 설명. 분류는 바꾸지 않는다.
NOTES = {
    "유우키": "일본 인명 Yūki(장음 '우우' 표기) — 세 글자 외래 이름 중 유일한 일본식 이름",
    "명미정": "남아 23·여아 23으로 정확히 반반 — 이름으로 단정하지 말 것(본문에서 다룰 땐 '판단 보류'로)",
    "레이나": "Reina 등 여러 언어권 인명 — 외래로만 분류, 특정 언어로 단정하지 말 것",
}

# 한국어 성경(개역개정)의 인물 이름과 철자가 같은 이름 — 철자 일치만 본다(작명 의도는 알 수 없음).
# 제외: 엘리사(개역개정의 선지자 엘리사는 남자인데 여아 36·남아 7 — Elisa 쪽일 가능성), 아리엘(같은 이유로 Ariel),
#       미카엘(개역개정은 '미가엘', 미카엘은 가톨릭 성경 표기), 조나단·레베카·유니스(개역개정은 요나단·리브가·유니게).
BIBLE_SPELLING = {
    "다니엘", "에스더", "사무엘", "엘리야", "에스라", "드보라", "나오미", "루디아", "요안나", "마리아", "율리아",
}


def pct(num, den, nd=1):
    """반올림(half-up) 백분율 문자열."""
    if not den:
        return None
    q = Decimal(1).scaleb(-nd) if nd else Decimal(1)
    return f"{(Decimal(num) * 100 / Decimal(den)).quantize(q, rounding=ROUND_HALF_UP)}%"


def share_cell(num, den):
    """표 칸용 정수 백분율. 0건·전부가 아닌데 반올림이 0%·100%가 되면 <1%·>99% 로 적는다
    (아이린 남아 1건이 '0%'로 보이는 것 방지)."""
    if num == 0:
        return "0%"
    if num == den:
        return "100%"
    v = (Decimal(num) * 100 / Decimal(den)).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    if v == 0:
        return "<1%"
    if v == 100:
        return ">99%"
    return f"{v}%"


def ratio(num, den):
    return round(num / den, 6) if den else None


def fmt(n):
    return f"{n:,}"


def load_hanja_readings():
    readings = set()
    with open(HANJA_GOV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            for s in (row.get("hangul") or "").split(","):
                s = s.strip()
                if re.fullmatch(r"[가-힣]", s):
                    readings.add(s)
    return readings


def sex_profile(recs):
    m = sum(r["m"] for r in recs)
    f = sum(r["f"] for r in recs)
    t = sum(r["t"] for r in recs)
    male95 = [r["name"] for r in recs if r["m"] / r["t"] >= SKEW]
    female95 = [r["name"] for r in recs if r["f"] / r["t"] >= SKEW]
    male100 = [r["name"] for r in recs if r["f"] == 0]
    female100 = [r["name"] for r in recs if r["m"] == 0]
    unisex = [r["name"] for r in recs if UNISEX[0] <= r["m"] / r["t"] <= UNISEX[1]]
    return {
        "names": len(recs),
        "births": t,
        "male_births": m,
        "female_births": f,
        "female_share": ratio(f, t),
        "female_share_pct": pct(f, t),
        "male95_count": len(male95),
        "female95_count": len(female95),
        "skew95_count": len(male95) + len(female95),
        "skew95_share_pct": pct(len(male95) + len(female95), len(recs)),
        "male95_share_pct": pct(len(male95), len(recs)),
        "female95_share_pct": pct(len(female95), len(recs)),
        "male_only_count": len(male100),
        "female_only_count": len(female100),
        "unisex_35_65_count": len(unisex),
        "unisex_35_65_share_pct": pct(len(unisex), len(recs)),
        "unisex_35_65_names": unisex if len(recs) < 200 else None,
    }


def bucket_profile(recs):
    edges = [(30, 49), (50, 99), (100, 999), (1000, None)]
    out = []
    for lo, hi in edges:
        sel = [r for r in recs if r["t"] >= lo and (hi is None or r["t"] <= hi)]
        out.append({
            "range": f"{lo}~{hi}" if hi else f"{lo}+",
            "names": len(sel),
            "names_share_pct": pct(len(sel), len(recs)),
            "births": sum(r["t"] for r in sel),
        })
    return out


def md_name(r):
    return f"[{r['name']}](/name/{quote(r['name'])})" if r["public"] else r["name"]


def main():
    data = json.load(open(NAME_SEO, encoding="utf-8"))
    meta, names = data["meta"], data["names"]
    readings = load_hanja_readings()

    all_recs = []
    for name, v in names.items():
        pa = v.get("pa")
        all_recs.append({
            "name": name, "syll": len(name), "t": v["t"], "m": v["m"], "f": v["f"],
            "rank": v["rank"], "rm": v.get("rm"), "rf": v.get("rf"), "pa": pa,
            "public": (pa is None) or (pa <= LINK_CUTOFF),
            "non_hanja_syllables": [s for s in name if s not in readings],
        })
    assert all(r["m"] + r["f"] == r["t"] for r in all_recs), "m+f != t"
    total_names = len(all_recs)
    total_births = sum(r["t"] for r in all_recs)
    assert total_names == meta["count"], "meta.count 불일치"

    by_syll = Counter(r["syll"] for r in all_recs)
    syllable_table = []
    for L in sorted(by_syll):
        sel = [r for r in all_recs if r["syll"] == L]
        b = sum(r["t"] for r in sel)
        syllable_table.append({
            "syllables": L, "names": len(sel), "names_share_pct": pct(len(sel), total_names, 2),
            "births": b, "births_share_pct": pct(b, total_births, 2),
            "births_share_ratio": ratio(b, total_births),
            "births_per_1000": round(b * 1000 / total_births, 2),
        })

    two = sorted([r for r in all_recs if r["syll"] == 2], key=lambda r: (-r["t"], r["rank"], r["name"]))
    three = sorted([r for r in all_recs if r["syll"] == 3], key=lambda r: (-r["t"], r["rank"], r["name"]))

    # ---- 분류 ----
    three_names = {r["name"] for r in three}
    unknown_review = sorted(set(REVIEW) - three_names)
    assert not unknown_review, f"REVIEW 에 자료에 없는 이름: {unknown_review}"
    unknown_bible = sorted(BIBLE_SPELLING - three_names)
    assert not unknown_bible, f"BIBLE_SPELLING 에 자료에 없는 이름: {unknown_bible}"
    t_count_all = Counter(r["t"] for r in all_recs)
    for r in three:
        # 공동 순위(1,2,2,4…) — 같은 건수를 임의로 갈라 상위 N 경계에서 한쪽만 싣는 일을 막는다
        r["rank3"] = 1 + sum(1 for x in three if x["t"] > r["t"])
        # 전체 순위(rank)는 build_name_seo_data.py 가 (-t, 이름) 정렬로 동률을 가나다순으로 갈라 매긴 값(이름 페이지와 같음).
        # 동률 처리에 기대는 서술인지 보려고 동률 수와 경쟁 순위(1 + 더 많은 이름 수)를 함께 남긴다.
        r["overall_same_t_others"] = t_count_all[r["t"]] - 1
        r["overall_same_t_names"] = sorted(x["name"] for x in all_recs if x["t"] == r["t"])
        r["overall_competition_rank"] = 1 + sum(1 for x in all_recs if x["t"] > r["t"])
    for r in three:
        rule = "외래" if r["non_hanja_syllables"] else None
        if r["name"] in REVIEW:
            cls, why = REVIEW[r["name"]]
            source = "review_override" if (rule and cls != rule) else ("review_confirm" if rule else "review")
        elif rule:
            cls, why, source = rule, "한자음에 없는 음절: " + "·".join(r["non_hanja_syllables"]), "rule"
        else:
            cls, why, source = "기타", "규칙·검토 모두 해당 없음(기본값)", "default"
        assert cls in CLASSES
        r.update({
            "class": cls, "class_reason": why, "class_source": source, "rule_class": rule,
            "female_pct": share_cell(r["f"], r["t"]), "male_pct": share_cell(r["m"], r["t"]),
            "female_ratio": ratio(r["f"], r["t"]),
            "bible_spelling": r["name"] in BIBLE_SPELLING,
            "note": NOTES.get(r["name"]),
            "md": md_name(r),
        })

    three_births = sum(r["t"] for r in three)
    classes = {}
    for c in CLASSES:
        sel = [r for r in three if r["class"] == c]
        prof = sex_profile(sel)
        prof["names_share_pct"] = pct(len(sel), len(three))
        prof["births_share_of_three_pct"] = pct(prof["births"], three_births)
        prof["list"] = [r["name"] for r in sel]
        prof["max_t"] = max((r["t"] for r in sel), default=None)
        prof["min_t"] = min((r["t"] for r in sel), default=None)
        prof["public_names"] = [r["name"] for r in sel if r["public"]]
        classes[c] = prof

    class_source = Counter(r["class_source"] for r in three)
    rule_hit = [r for r in three if r["rule_class"]]

    # ---- 2음절 비교 ----
    def group_metrics(recs):
        ts = [r["t"] for r in recs]
        b = sum(ts)
        top1 = recs[0]
        top10 = sum(r["t"] for r in recs[:10])
        nh = [r for r in recs if r["non_hanja_syllables"]]
        out = {
            "names": len(recs), "births": b,
            "mean_births_per_name": round(b / len(recs), 1),
            "median_births_per_name": statistics.median(ts),
            "top1": {"name": top1["name"], "t": top1["t"], "rank": top1["rank"],
                     "share_of_group_pct": pct(top1["t"], b)},
            "top3_share_of_group_pct": pct(sum(r["t"] for r in recs[:3]), b),
            "top10_share_of_group_pct": pct(top10, b),
            "buckets": bucket_profile(recs),
            "non_hanja_names": len(nh),
            "non_hanja_names_share_pct": pct(len(nh), len(recs)),
            "non_hanja_births": sum(r["t"] for r in nh),
            "non_hanja_births_share_pct": pct(sum(r["t"] for r in nh), b),
        }
        out.update({f"sex_{k}": v for k, v in sex_profile(recs).items() if k != "unisex_35_65_names"})
        return out

    m2, m3 = group_metrics(two), group_metrics(three)
    top3_name = three[0]
    comparison = {
        "two": m2,
        "three": m3,
        "mean_ratio_two_over_three": round(m2["mean_births_per_name"] / m3["mean_births_per_name"], 1),
        "two_names_with_more_births_than_top_three": sum(1 for r in two if r["t"] > top3_name["t"]),
        "three_names_in_overall_top1000": sum(1 for r in three if r["rank"] <= 1000),
        "three_names_in_overall_top1000_list": [r["name"] for r in three if r["rank"] <= 1000],
        "three_names_competition_rank_le_1000": [r["name"] for r in three if r["overall_competition_rank"] <= 1000],
        "rank_tie_rule": "rank 는 (-t, 이름) 정렬 — 건수가 같으면 가나다순(유니코드 순)으로 갈라 매김. 경쟁 순위는 1 + 더 많이 신고된 이름 수",
        "rank_note": "rank 는 두·세 글자 5,340개 전체에서의 합계 순위(name-seo.json rank)",
        "top_rows_overall_tie_groups": None,  # 아래에서 채움
    }

    # 전체(두·세 글자 합) 쏠림 — 기존 unisex-names 리포트 수치와 일치하는지 대조용
    overall_sex = sex_profile(all_recs)

    # ---- 상위 표 ----
    cols = ["순위", "이름", "출생신고", "남아", "여아", "분류"]
    def table(rows, columns, cell):
        return "\n".join(["| " + " | ".join(columns) + " |", "|" + "---|" * len(columns)] + [cell(r) for r in rows])

    top_rows = [r for r in three if r["rank3"] <= TOP_N]  # 공동 순위가 N 경계에 걸리면 모두 싣는다
    # 상위 표 이름별 '더 많은 쪽 성별' 비율(소수 첫째 자리, half-up) — 표의 정수 반올림 값으로 '몇 % 이상'을 쓰지 않도록
    top_dominant = sorted(
        ({"name": r["name"], "side": "남아" if r["m"] >= r["f"] else "여아",
          "ratio": ratio(max(r["m"], r["f"]), r["t"]), "pct1": pct(max(r["m"], r["f"]), r["t"])} for r in top_rows),
        key=lambda d: (d["ratio"], d["name"]))
    # 상위 표 안에서 전체 순위 동률(같은 건수) 묶음 — 세 글자 안 순위는 공동, 전체 순위는 가나다순으로 갈림
    top_tie_groups = [[r["name"] for r in top_rows if r["t"] == t] for t in sorted({r["t"] for r in top_rows}, reverse=True)]
    top_tie_groups = [g for g in top_tie_groups if len(g) > 1]
    comparison["top_rows_overall_tie_groups"] = top_tie_groups
    top_table_md = table(
        top_rows, cols,
        lambda r: f"| {r['rank3']} | {r['md']} | {fmt(r['t'])} | {r['male_pct']} | {r['female_pct']} | {r['class']} |")
    # 순우리말·기타는 상위 표에 하나도 안 들어오므로 따로 전부 싣는다(순위 = 세 글자 74개 안의 공동 순위)
    class_cols = ["순위", "이름", "출생신고", "남아", "여아"]
    class_tables_md = {
        c: table([r for r in three if r["class"] == c], class_cols,
                 lambda r: f"| {r['rank3']} | {r['md']} | {fmt(r['t'])} | {r['male_pct']} | {r['female_pct']} |")
        for c in ("순우리말", "기타")
    }

    # ---- /three-syllable 도구 큐레이션 사전과의 겹침 ----
    cur = json.load(open(CURATED, encoding="utf-8"))
    entries = cur.get("entries", [])
    cur_names = [e["name"] for e in entries]
    curated = {
        "scope": "큐레이션 사전 data/three-syllable-curated.json 만 대조함. ThreeSyllableEngine 은 큐레이션 후보가 모자라면 "
                 "조합 생성기(GeneratePureKoreanCandidates·GenerateMixedCandidates·GenerateHanjaCandidates)로 후보를 보태는데, "
                 "그 생성 후보는 대조하지 않았다 — 본문에는 '도구가 쓰는 큐레이션 목록 가운데'로만 쓸 것(도구 출력 전체로 넓히지 말 것)",
        "entries": len(entries),
        "three_syllable_entries": sum(1 for n in cur_names if len(n) == 3),
        "name_types": dict(Counter(e.get("nameType") for e in entries)),
        "in_birth_stats": [n for n in cur_names if n in names],  # = 큐레이션 목록 기준(curated_only)
        "in_birth_stats_basis": "curated_only",
        "note": "도구 layout.tsx 메타 설명은 '139개'라 적었지만 파일은 이 entries 수 — 리포트에 사전 크기를 적지 말 것",
    }

    # ---- (선택) 원자료 대조: 수록 범위 확인용. 본문 수치로 쓰지 않는다 ----
    scope_check = None
    mp, fp = os.path.join(RAW_DIR, "m.csv"), os.path.join(RAW_DIR, "f.csv")
    if os.path.exists(mp) and os.path.exists(fp):
        raw = Counter()
        for p in (mp, fp):
            with open(p, encoding="utf-8") as fh:
                for row in csv.DictReader(fh):
                    n = (row.get("name") or "").strip()
                    try:
                        raw[n] += int(row.get("weight") or 0)
                    except ValueError:
                        pass
        hangul = {n: w for n, w in raw.items() if re.fullmatch(r"[가-힣]+", n)}
        raw3_30 = {n for n, w in hangul.items() if len(n) == 3 and w >= 30}
        scope_check = {
            "publish": False,
            "note": "scripts/_name_raw 는 .gitignore 로컬 파일 — 범위 서술의 근거로만 쓰고 숫자는 본문에 싣지 않는다",
            "raw_three_ge30_matches_dataset": raw3_30 == three_names,
            "raw_one_syllable_ge30_names": sum(1 for n, w in hangul.items() if len(n) == 1 and w >= 30),
            "raw_four_plus_syllable_ge30_names": sum(1 for n, w in hangul.items() if len(n) >= 4 and w >= 30),
            "raw_four_plus_examples": sorted(((w, n) for n, w in hangul.items() if len(n) >= 4 and w >= 30),
                                             reverse=True)[:5],
        }

    facts = {
        "generated_by": "scripts/build_insight_three_syllable.py",
        "link_cutoff": LINK_CUTOFF,
        "source": {
            "dataset": "frontend/src/data/name-seo.json",
            "meta": meta,
            "total_names": total_names,
            "total_births": total_births,
            "scope": "두·세 글자 한글 이름 중 2008~2019 합산 출생신고 30건 이상(build_name_seo_data.py HANGUL_NAME ^[가-힣]{2,3}$ + minTotal 30). "
                     "한 글자·네 글자 이상·30건 미만 이름은 자료에 없음. 연도별 값 없음.",
            "hanja_readings": {"file": "data/data-gov.csv", "distinct_syllables": len(readings)},
        },
        "thresholds": {"skew": SKEW, "unisex_band_male_share": list(UNISEX), "top_n": TOP_N},
        "classification_criteria": {
            "외래": "외국 인명(영어권·성경·일본어 등)을 한글로 옮겨 적은 이름",
            "순우리말": "구성 요소가 모두 고유어 낱말(방언·옛말 포함)·접사·어미로 풀리는 이름",
            "기타": "어느 쪽으로도 기원을 확정하기 어려운 이름(지어낸 조합, 한자어가 섞인 말, 기원이 여럿 가능)",
            "rule": "음절 하나라도 대법원 인명용 한자표의 음에 없으면 1차로 외래, 그 밖은 기본 기타 — 사람 검토로 확인·수정",
        },
        "syllable_table": syllable_table,
        "three_syllable": {
            "count": len(three),
            "births": three_births,
            "public_count": sum(1 for r in three if r["public"]),
            "public_names": [r["name"] for r in three if r["public"]],
            "sex": sex_profile(three),
            "classes": classes,
            "class_source_counts": dict(class_source),
            "rule_hit_count": len(rule_hit),
            "rule_overridden": [r["name"] for r in rule_hit if r["class"] != r["rule_class"]],
            "unreviewed_default": [r["name"] for r in three if r["class_source"] == "default"],
            "bible_spelling": {
                "criterion": "한국어 성경(개역개정) 인물 이름과 철자가 같음 — 철자 일치만, 작명 의도 아님",
                "names": [r["name"] for r in three if r["bible_spelling"]],
                "count": sum(1 for r in three if r["bible_spelling"]),
                "births": sum(r["t"] for r in three if r["bible_spelling"]),
                "births_share_of_three_pct": pct(sum(r["t"] for r in three if r["bible_spelling"]), three_births),
            },
            "top_table_md": top_table_md,
            "top_table_rows": len(top_rows),
            "top_table_dominant_share_ascending": top_dominant,
            "top_table_classes": dict(Counter(r["class"] for r in top_rows)),
            "class_tables_md": class_tables_md,
            "list": [
                {k: r[k] for k in ("rank3", "name", "t", "m", "f", "male_pct", "female_pct", "female_ratio", "rank",
                                   "rm", "rf", "pa", "public", "md", "class", "class_source", "class_reason",
                                   "non_hanja_syllables", "bible_spelling", "note",
                                   "overall_same_t_others", "overall_same_t_names", "overall_competition_rank")}
                for r in three
            ],
        },
        "comparison_two_vs_three": comparison,
        "overall_sex_crosscheck": {k: v for k, v in overall_sex.items() if k != "unisex_35_65_names"},
        "curated_tool": curated,
        "scope_check": scope_check,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(facts, fh, ensure_ascii=False, indent=1)

    # ---- 표준출력 요약 ----
    print(f"자료: {meta['source']} · 이름 {fmt(total_names)}개 · 출생신고 {fmt(total_births)}건 · 링크 기준일 {LINK_CUTOFF}")
    for row in syllable_table:
        print(f"  {row['syllables']}음절: 이름 {fmt(row['names'])}개({row['names_share_pct']}) · "
              f"출생신고 {fmt(row['births'])}건({row['births_share_pct']}, 1,000건당 {row['births_per_1000']})")
    s3 = facts["three_syllable"]["sex"]
    print(f"3음절 성비: 남아 {fmt(s3['male_births'])} · 여아 {fmt(s3['female_births'])} (여아 {s3['female_share_pct']}) · "
          f"남95%+ {s3['male95_count']} · 여95%+ {s3['female95_count']} · 한쪽 0건 남{s3['male_only_count']}/여{s3['female_only_count']} · "
          f"중성(35~65%) {s3['unisex_35_65_count']} {s3['unisex_35_65_names']}")
    print(f"분류 출처: {dict(class_source)} · 규칙 해당 {len(rule_hit)} · 규칙 뒤집음 {facts['three_syllable']['rule_overridden']}")
    for c in CLASSES:
        p = classes[c]
        print(f"  {c}: {p['names']}개({p['names_share_pct']}) · {fmt(p['births'])}건(3음절의 {p['births_share_of_three_pct']}) · "
              f"여아 {p['female_share_pct']} · 남95%+ {p['male95_count']} · 여95%+ {p['female95_count']} · "
              f"범위 {p['min_t']}~{p['max_t']} · {' '.join(p['list'])}")
    b = facts["three_syllable"]["bible_spelling"]
    print(f"성경 철자 일치: {b['count']}개 {fmt(b['births'])}건({b['births_share_of_three_pct']}) {' '.join(b['names'])}")
    print(f"공개(링크 가능) {facts['three_syllable']['public_count']}개: {' '.join(facts['three_syllable']['public_names'])}")
    print("2음절 vs 3음절:")
    for k in ("names", "births", "mean_births_per_name", "median_births_per_name", "top3_share_of_group_pct",
              "top10_share_of_group_pct", "non_hanja_names", "non_hanja_names_share_pct", "non_hanja_births_share_pct",
              "sex_female_share_pct", "sex_male95_share_pct", "sex_female95_share_pct", "sex_skew95_share_pct",
              "sex_unisex_35_65_count"):
        print(f"  {k}: {m2[k]} | {m3[k]}")
    print(f"  buckets 2: {[(x['range'], x['names'], x['names_share_pct']) for x in m2['buckets']]}")
    print(f"  buckets 3: {[(x['range'], x['names'], x['names_share_pct']) for x in m3['buckets']]}")
    print(f"  top1: {m2['top1']} | {m3['top1']}")
    print(f"  평균 배수 {comparison['mean_ratio_two_over_three']} · 3음절 1위보다 많은 2음절 {comparison['two_names_with_more_births_than_top_three']}개 · "
          f"전체 1,000위 안 3음절 {comparison['three_names_in_overall_top1000_list']}")
    o = facts["overall_sex_crosscheck"]
    print(f"대조(unisex-names 리포트 2,252·808·494): 남95%+ {o['male95_count']} · 여95%+ {o['female95_count']} · 중성 {o['unisex_35_65_count']}")
    print(f"도구 큐레이션 사전(생성 후보 제외): {curated['entries']}개(3음절 {curated['three_syllable_entries']}) · 출생통계에 있는 것 {curated['in_birth_stats']}")
    print(f"상위 표 성별 쏠림(낮은 순 5): {[(d['name'], d['side'], d['pct1']) for d in top_dominant[:5]]}")
    print(f"상위 표 전체 순위 동률 묶음: {top_tie_groups}")
    print(f"경쟁 순위 1,000 안 3음절: {comparison['three_names_competition_rank_le_1000']} · "
          f"에스더 동률 {[(r['name'], r['rank'], r['overall_competition_rank'], r['overall_same_t_names']) for r in three if r['rank'] <= 1000]}")
    print(f"중성 비율: 2음절 {m2['sex_unisex_35_65_share_pct']} | 3음절 {m3['sex_unisex_35_65_share_pct']}")
    if scope_check:
        print(f"원자료 대조: 3음절 30+ 일치 {scope_check['raw_three_ge30_matches_dataset']} · "
              f"자료 밖 1음절 30+ {scope_check['raw_one_syllable_ge30_names']}개 · 4음절+ 30+ {scope_check['raw_four_plus_syllable_ge30_names']}개")
    print(f"\n상위 {TOP_N} 표({len(top_rows)}행, 공동 순위 포함):\n{top_table_md}")
    for c, t in class_tables_md.items():
        print(f"\n{c} 표:\n{t}")
    print(f"\nfacts → {OUT_PATH}")


if __name__ == "__main__":
    main()
