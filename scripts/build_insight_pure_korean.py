# -*- coding: utf-8 -*-
"""데이터 리포트 '순우리말 아기 이름' 수치 산출 (2026-11-19, 설계서 docs/plan-ohaeng-2026-11.md §9).

frontend/content/insights/pure-korean-names.md 본문의 숫자·표는 전부 이 스크립트 결과(facts.json·표준출력)에서 옮긴다.
손 계산 금지 — /name 데이터(name-seo.json)를 다시 만들거나 기준일(SCOPE_CUTOFF)을 바꾸면 이 스크립트를 다시 돌려 표·본문을 맞출 것.

입력 (저장소 루트 기준 상대 경로, 모두 커밋된 파일):
  frontend/src/data/name-seo.json           이름별 남아(m)·여아(f)·합계(t)·전체 순위(rank)·주간 공개일(pa)·순우리말 플래그(pk)·
                                            참고 조합(combos)·대표 뜻(mean)
  data/pure-korean-name-overrides.json      pk 판정의 가감 목록(exclude·include) — 정의 설명용
  frontend/src/data/hanja-seo.json          글자별 독음(r)·훈(m) — '인명용 한자 독음이 없는 음절' 판정(/hanja 독음 489개와 같은 집합)
  Application/Engines/PureKoreanNameEngine.cs  순우리말 추천 내장 사전(new("이름", …)) — pk = 사전 − exclude + include 가 맞는지 대조만
  scripts/build_insight_three_syllable.py   세 글자 리포트의 분류 표(REVIEW) — 그 리포트의 '순우리말 8개'와 이 목록의 관계(cross)

순우리말 판정(이 리포트의 '순우리말 이름'):
  name-seo.json 의 pk = PureKoreanNameEngine 내장 사전 이름 − exclude(한자어 낱말·한자 이름으로 흔한 이름) + include('별' 이름).
  이 사이트의 분류일 뿐, 출생신고한 부모가 한글 이름으로 지었는지는 알 수 없다(아래 한계).

자료의 한계 (리포트에 반드시 밝힐 것):
  - name-seo.json 은 '두·세 글자 한글 이름 중 2008~2019 합산 출생신고 30건 이상'만 있다. 한 글자·네 글자 이상, 30건 미만 이름은 없다.
  - 2008~2019 합산 한 덩어리라 연도별 변화는 알 수 없다(유행 변화 주장 금지).
  - 출생신고 통계에는 한글 이름만 있다. 같은 한글 이름을 한자로 신고했는지(가온 → 嘉溫 등), 어떤 한자인지는 모른다.
    그래서 '순우리말 이름 N건'은 '이 사이트가 순우리말로 보는 한글 이름으로 신고된 건수'이지 '한글로만 신고한 건수'가 아니다.
  - 범위는 기준일(SCOPE_CUTOFF)까지 이름 페이지가 열린 pk 이름만(지시 — 설계서 D5). 전체 pk 수·미공개 수는 facts 에 남긴다.

성별 구분 (unisex-names·three-syllable 리포트와 같은 기준 — /name 페이지 배지(60/40, genderSplit)와 다르다):
  남아 비율 < 35% 여자 쪽 · 35~65%(양끝 포함) 중성 · > 65% 남자 쪽.

사용법 (저장소 루트에서, 인자 없음):
  python -I -X utf8 scripts/build_insight_pure_korean.py
출력: 표준출력(요약·표) + OUT_PATH(facts.json, 커밋 안 함 — tmp/ 는 .gitignore). OUT_PATH 는 환경 변수 INSIGHT_FACTS_OUT 으로 바꿀 수 있다.
"""
import importlib.util
import json
import os
import re
import sys
from collections import Counter, defaultdict
from decimal import ROUND_HALF_UP, Decimal
from urllib.parse import quote

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME_SEO = os.path.join(ROOT, "frontend", "src", "data", "name-seo.json")
HANJA_SEO = os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json")
OVERRIDES = os.path.join(ROOT, "data", "pure-korean-name-overrides.json")
ENGINE_CS = os.path.join(ROOT, "Application", "Engines", "PureKoreanNameEngine.cs")
THREE_SYLLABLE_SCRIPT = os.path.join(ROOT, "scripts", "build_insight_three_syllable.py")

DEFAULT_OUT = os.path.join(ROOT, "tmp", "insight-facts", "pure-korean.json")
OUT_PATH = os.environ.get("INSIGHT_FACTS_OUT") or DEFAULT_OUT

# 리포트 범위·/name 링크 기준일: pa 가 없거나 pa <= 이 날짜인 pk 이름만 센다(주간 드립 게이트, name-seo.ts isPublished).
# ⚠️ 배포일 자리표시(설계서 §10) — 배포일로 바꾸고 다시 돌려 표·수치를 대조할 것.
SCOPE_CUTOFF = "2026-11-25"
LINK_CUTOFF = SCOPE_CUTOFF  # 범위 = 링크 가능(범위 밖 이름을 표에 싣지 않는다)

SKEW = 0.95                 # 한쪽 성별 95% 이상 = 쏠림 (unisex-names 리포트의 2,252·808 과 같은 기준)
UNISEX = (0.35, 0.65)       # 남아 비율 35~65%(양끝 포함) = 중성 (unisex-names 리포트의 494 와 같은 기준)
TOP_N = 20                  # 전체 상위 표
SUB_N = 10                  # 여자 쪽·남자 쪽·중성 상위 표
SYL_TOP = 10                # 끝 음절·첫 음절 표
SIDES = ("여자 쪽", "중성", "남자 쪽")


def pct(num, den, nd=1):
    """반올림(half-up) 백분율 문자열."""
    if not den:
        return None
    q = Decimal(1).scaleb(-nd) if nd else Decimal(1)
    return f"{(Decimal(num) * 100 / Decimal(den)).quantize(q, rounding=ROUND_HALF_UP)}%"


def share_cell(num, den):
    """표 칸용 정수 백분율. 0건·전부가 아닌데 반올림이 0%·100%가 되면 <1%·>99% 로 적는다."""
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


def has_batchim(syl):
    """한글 음절 받침 유무(batchim-pattern 리포트·lib/josa.ts hasBatchim 과 같은 판정)."""
    code = ord(syl) - 0xAC00
    assert 0 <= code < 11172, f"한글 음절 아님: {syl}"
    return code % 28 != 0


def side_of(r):
    mr = r["m"] / r["t"]
    if mr < UNISEX[0]:
        return "여자 쪽"
    if mr > UNISEX[1]:
        return "남자 쪽"
    return "중성"


def page_gender(r):
    """/name 페이지 성별 배지 — frontend/src/lib/name-seo.ts genderSplit 과 같은 계산(JS Math.round = floor(x + 0.5))."""
    male_pct = int(Decimal(r["m"] * 100) / Decimal(max(r["t"], 1)) + Decimal("0.5"))
    if male_pct >= 60:
        return "남자 이름"
    if 100 - male_pct >= 60:
        return "여자 이름"
    return "중성"


def sex_profile(recs):
    m = sum(r["m"] for r in recs)
    f = sum(r["f"] for r in recs)
    t = sum(r["t"] for r in recs)
    male95 = [r for r in recs if r["m"] / r["t"] >= SKEW]
    female95 = [r for r in recs if r["f"] / r["t"] >= SKEW]
    sides = {}
    for s in SIDES:
        sel = [r for r in recs if side_of(r) == s]
        b = sum(r["t"] for r in sel)
        sides[s] = {
            "names": len(sel), "names_share_pct": pct(len(sel), len(recs)),
            "births": b, "births_share_pct": pct(b, t),
        }
    return {
        "names": len(recs),
        "births": t,
        "male_births": m,
        "female_births": f,
        "female_share_pct": pct(f, t),
        "female_share_ratio": ratio(f, t),
        "sides": sides,
        "male95_count": len(male95),
        "female95_count": len(female95),
        "skew95_count": len(male95) + len(female95),
        "skew95_share_pct": pct(len(male95) + len(female95), len(recs)),
        "male_only_count": sum(1 for r in recs if r["f"] == 0),
        "female_only_count": sum(1 for r in recs if r["m"] == 0),
        "male_only_names": [r["name"] for r in recs if r["f"] == 0] if len(recs) < 200 else None,
        "female_only_names": [r["name"] for r in recs if r["m"] == 0] if len(recs) < 200 else None,
        "male95_names": [r["name"] for r in male95] if len(recs) < 200 else None,
    }


def md_name(r):
    return f"[{r['name']}](/name/{quote(r['name'])})" if r["public"] else r["name"]


def table(rows, columns, cell):
    return "\n".join(["| " + " | ".join(columns) + " |", "|" + "---|" * len(columns)] + [cell(r) for r in rows])


def joint_rank(items, key):
    """공동 순위(1,2,2,4…) — 1 + key 가 더 큰 항목 수."""
    return {id(x): 1 + sum(1 for y in items if key(y) > key(x)) for x in items}


def load_dictionary_names():
    """PureKoreanNameEngine.BuildDictionary 의 new("이름", …) 첫 인자 — pk 판정 대조용(런타임과 같은 사전)."""
    src = open(ENGINE_CS, encoding="utf-8").read()
    start = src.index("private static List<PureKoreanEntry> BuildDictionary()")
    end = src.index("private class PureKoreanEntry", start)
    names = re.findall(r'^\s*new\("([가-힣]+)",', src[start:end], flags=re.M)
    assert names, "사전 항목을 하나도 못 읽음 — PureKoreanNameEngine.cs 형식이 바뀌었는지 볼 것"
    return set(names)


def load_three_syllable_review():
    spec = importlib.util.spec_from_file_location("build_insight_three_syllable", THREE_SYLLABLE_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # __main__ 가드가 있어 main() 은 돌지 않는다
    return mod.REVIEW


def hun_fragments(meaning):
    """'다를 별, 나눌 별' → ['다를 별', '나눌 별']"""
    return [p.strip() for p in re.split(r"[,，;/]", meaning or "") if p.strip()]


def syllable_stats(recs, pos):
    """pos 0 = 첫 음절, -1 = 끝 음절. 이름 수 공동 순위(동률은 출생신고 많은 순으로 나열)."""
    groups = defaultdict(list)
    for r in recs:
        groups[r["name"][pos]].append(r)
    items = [{"syllable": s, "names": len(v), "births": sum(x["t"] for x in v),
              "list": [x["name"] for x in sorted(v, key=lambda x: (-x["t"], x["name"]))]}
             for s, v in groups.items()]
    items.sort(key=lambda x: (-x["names"], -x["births"], x["syllable"]))
    ranks = joint_rank(items, lambda x: x["names"])
    for x in items:
        x["rank_by_names"] = ranks[id(x)]
    return items


def first_by_births(recs, pos):
    c = Counter()
    for r in recs:
        c[r["name"][pos]] += r["t"]
    (s, b), = c.most_common(1)
    return {"syllable": s, "births": b, "share_pct": pct(b, sum(c.values()))}


def first_by_names(recs, pos):
    c = Counter(r["name"][pos] for r in recs)
    top = max(c.values())
    tied = sorted(s for s, n in c.items() if n == top)
    return {"syllables": tied, "names": top, "share_pct": pct(top, len(recs))}


def main():
    data = json.load(open(NAME_SEO, encoding="utf-8"))
    meta, names = data["meta"], data["names"]
    overrides = json.load(open(OVERRIDES, encoding="utf-8"))
    include, exclude = set(overrides["include"]), set(overrides["exclude"])
    hanja = json.load(open(HANJA_SEO, encoding="utf-8"))
    readings = {r for v in hanja.values() for r in v["r"]}
    dict_names = load_dictionary_names()

    all_recs = []
    for name, v in names.items():
        pa = v.get("pa")
        all_recs.append({
            "name": name, "syll": len(name), "t": v["t"], "m": v["m"], "f": v["f"],
            "rank": v["rank"], "rm": v.get("rm"), "rf": v.get("rf"), "pa": pa,
            "public": (pa is None) or (pa <= LINK_CUTOFF),
            "pk": bool(v.get("pk")), "fx": bool(v.get("fx")),
            "combos": v.get("combos") or [], "mean": v.get("mean") or "",
            "non_reading_syllables": [s for s in name if s not in readings],
        })
    assert all(r["m"] + r["f"] == r["t"] for r in all_recs), "m+f != t"
    total_names = len(all_recs)
    total_births = sum(r["t"] for r in all_recs)
    assert total_names == meta["count"], "meta.count 불일치"

    # ---- pk 정의 대조: name-seo 의 pk = (사전 − exclude) + include, 이름은 출생신고 자료에 있는 것만 ----
    in_data = set(names)
    expected_pk = {n for n in in_data if (n in include) or (n in dict_names and n not in exclude)}
    pk_names = {r["name"] for r in all_recs if r["pk"]}
    assert pk_names == expected_pk, (
        f"pk 가 사전 − exclude + include 와 다름: 더 있음 {sorted(pk_names - expected_pk)} · 빠짐 {sorted(expected_pk - pk_names)}")
    assert include <= pk_names, f"include 인데 pk 아님: {sorted(include - pk_names)}"
    assert not (exclude & pk_names), f"exclude 인데 pk: {sorted(exclude & pk_names)}"
    assert not any(r["pk"] and r["fx"] for r in all_recs), "pk 와 fx 가 겹침"

    pk_all = sorted([r for r in all_recs if r["pk"]], key=lambda r: (-r["t"], r["rank"], r["name"]))
    scope = [r for r in pk_all if r["public"]]
    unpublished = [r for r in pk_all if not r["public"]]
    assert scope, "범위 안 pk 이름 0개"
    assert all(r["public"] for r in scope)
    for r in scope:
        assert r["mean"], f"대표 뜻 없음: {r['name']}"
        assert "|" not in r["mean"], f"대표 뜻에 '|': {r['name']}"
    scope_births = sum(r["t"] for r in scope)

    # ---- 순위 ----
    ranks = joint_rank(scope, lambda r: r["t"])
    t_count_all = Counter(r["t"] for r in all_recs)
    for r in scope:
        r["rank_pk"] = ranks[id(r)]
        r["side"] = side_of(r)
        r["male_pct"] = share_cell(r["m"], r["t"])
        r["female_pct"] = share_cell(r["f"], r["t"])
        r["md"] = md_name(r)
        r["overall_same_t_names"] = sorted(x["name"] for x in all_recs if x["t"] == r["t"])
        r["overall_competition_rank"] = 1 + sum(1 for x in all_recs if x["t"] > r["t"])
        r["overall_same_t_others"] = t_count_all[r["t"]] - 1
    for s in SIDES:
        sel = [r for r in scope if r["side"] == s]
        sr = joint_rank(sel, lambda r: r["t"])
        for r in sel:
            r["rank_side"] = sr[id(r)]

    cols = ["순위", "이름", "출생신고", "남아", "여아", "대표 뜻", "전체 순위"]

    def row_cell(rank_key):
        return lambda r: (f"| {r[rank_key]} | {r['md']} | {fmt(r['t'])} | {r['male_pct']} | {r['female_pct']} | "
                          f"{r['mean']} | {fmt(r['rank'])} |")

    def tie_groups(rows):
        groups = [[r["name"] for r in rows if r["t"] == t] for t in sorted({r["t"] for r in rows}, reverse=True)]
        return [g for g in groups if len(g) > 1]

    top_rows = [r for r in scope if r["rank_pk"] <= TOP_N]  # 공동 순위가 경계에 걸리면 모두 싣는다
    top_md = table(top_rows, cols, row_cell("rank_pk"))
    top_set = {r["name"] for r in top_rows}
    by_side = {}
    for s in SIDES:
        sel = [r for r in scope if r["side"] == s]
        rows = [r for r in sel if r["rank_side"] <= SUB_N]
        # 본문 표: TOP 20 에 이미 나온 이름은 빼고 그 쪽의 다음 SUB_N 개(쪽 안 공동 순위 — 경계 동률은 모두 싣는다).
        # 여자 쪽 상위 10 은 모두 TOP 20 에 있어(2026-11-19 실측) 쪽별 상위 10 표를 그대로 실으면 같은 행이 되풀이된다.
        rest = [r for r in sel if r["name"] not in top_set]
        if len(rest) > SUB_N:
            cut_t = rest[SUB_N - 1]["t"]
            rest_rows = [r for r in rest if r["t"] >= cut_t]
        else:
            rest_rows = rest
        by_side[s] = {
            "names_in_side": len(sel),
            "births_in_side": sum(r["t"] for r in sel),
            "in_top_table_all": [{"name": r["name"], "rank_side": r["rank_side"], "rank_pk": r["rank_pk"]}
                                 for r in sel if r["name"] in top_set],
            # 설계서 그대로의 쪽별 상위 SUB_N 표(참고 — 본문에는 아래 after_top 표를 쓴다)
            "top_rows": len(rows),
            "top_table_md": table(rows, cols, row_cell("rank_side")),
            # 본문 표
            "after_top_rows": len(rest_rows),
            "after_top_rank_range": [rest_rows[0]["rank_side"], rest_rows[-1]["rank_side"]] if rest_rows else None,
            "after_top_table_md": table(rest_rows, cols, row_cell("rank_side")),
            "after_top_tie_groups": tie_groups(rest_rows),
            "after_top_overall_tie_groups": [r["overall_same_t_names"] for r in rest_rows if r["overall_same_t_others"]],
            "after_top_rank_vs_competition": [{"name": r["name"], "rank": r["rank"],
                                               "competition": r["overall_competition_rank"]}
                                              for r in rest_rows if r["rank"] != r["overall_competition_rank"]],
            "not_shown": len(sel) - len([r for r in sel if r["name"] in top_set]) - len(rest_rows),
        }
    top_dominant = sorted(
        ({"name": r["name"], "side_label": r["side"], "male_pct1": pct(r["m"], r["t"]), "female_pct1": pct(r["f"], r["t"])}
         for r in top_rows), key=lambda d: d["name"])

    # 전체 순위 구간(5,340개 중 rank) — 순위는 동률을 가나다순으로 갈라 매긴 값(이름 페이지와 같음)
    rank_buckets = {f"le_{k}": sum(1 for r in scope if r["rank"] <= k) for k in (100, 500, 1000)}
    rank_buckets_competition = {f"le_{k}": sum(1 for r in scope if r["overall_competition_rank"] <= k)
                                for k in (100, 500, 1000)}

    # ---- 음절 ----
    pk_two = [r for r in scope if r["syll"] == 2]
    end = syllable_stats(scope, -1)
    first = syllable_stats(scope, 0)
    scope_wo_inc = [r for r in scope if r["name"] not in include]
    end_wo = syllable_stats(scope_wo_inc, -1)
    first_wo = syllable_stats(scope_wo_inc, 0)
    # 마지막 칸 머리를 '이름'으로 두지 않는다 — audit_insights_tables.py 는 머리가 정확히 '이름'인 칸의 첫 링크만 대조하므로,
    # 나중에 이 칸에 링크를 걸면 '해당 이름' 머리라야 모든 링크를 대조한다(받침 패턴 리포트와 같은 경로).
    syl_cols = ["순위", "음절", "이름 수", "출생신고", "해당 이름"]

    def syl_table(items):
        rows = [x for x in items if x["rank_by_names"] <= SYL_TOP]
        return table(rows, syl_cols, lambda x: (
            f"| {x['rank_by_names']} | {x['syllable']} | {x['names']}개 | {fmt(x['births'])} | "
            f"{'·'.join(x['list'])} |")), len(rows)

    end_md, end_rows = syl_table(end)
    first_md, first_rows = syl_table(first)
    byeol_end = [r["name"] for r in scope if r["name"][-1] == "별"]
    byeol_first = [r["name"] for r in scope if r["name"][0] == "별"]
    include_scope = [r["name"] for r in scope if r["name"] in include]
    include_unpublished = sorted(include - {r["name"] for r in scope})

    # '별'로 읽는 인명용 한자와 훈 — include 근거(別·莂 등에 하늘의 별 뜻이 있는지)
    byeol_hanja = []
    for ch, v in sorted(hanja.items(), key=lambda kv: kv[0]):
        if "별" in v["r"]:
            frags = hun_fragments(v.get("m", ""))
            star = [fr for fr in frags if "별" in re.sub(r"\s*별$", "", fr)]
            byeol_hanja.append({"char": ch, "m": v.get("m", ""), "nf": v.get("nf", 0), "hun_mentions_byeol": star})

    two_all = [r for r in all_recs if r["syll"] == 2]
    syllables = {
        "end_top_md": end_md, "end_top_rows": end_rows,
        "first_top_md": first_md, "first_top_rows": first_rows,
        "end": end[:30], "first": first[:30],
        "end_distinct": len(end), "first_distinct": len(first),
        "end_without_include": end_wo[:15], "first_without_include": first_wo[:15],
        "without_include_names": len(scope_wo_inc),
        "end_byeol_names": byeol_end, "end_byeol_count": len(byeol_end),
        "end_byeol_from_include": [n for n in byeol_end if n in include],
        "end_byeol_from_dictionary": [n for n in byeol_end if n not in include],
        "first_byeol_names": byeol_first,
        "include_total": len(include), "include_in_scope": include_scope, "include_in_scope_count": len(include_scope),
        "include_unpublished": include_unpublished,
        "include_end_byeol": sorted(n for n in include if n.endswith("별")),
        "include_first_byeol": sorted(n for n in include if n.startswith("별")),
        "byeol_hanja": byeol_hanja,
        "byeol_hanja_count": len(byeol_hanja),
        "byeol_hanja_with_byeol_in_hun": [x["char"] for x in byeol_hanja if x["hun_mentions_byeol"]],
        "pk_end_first_by_births": first_by_births(scope, -1),
        "pk_first_first_by_births": first_by_births(scope, 0),
        "all_end_first_by_births": first_by_births(all_recs, -1),
        "all_first_first_by_births": first_by_births(all_recs, 0),
        "all_end_first_by_names": first_by_names(all_recs, -1),
        "all_first_first_by_names": first_by_names(all_recs, 0),
        "two_all_end_first_by_names": first_by_names(two_all, -1),
    }

    # ---- 받침 (끝 음절 — 두 글자 이름만, batchim-pattern 리포트와 같은 판정) ----
    def batchim_profile(recs):
        b_names = [r for r in recs if has_batchim(r["name"][-1])]
        b_first = [r for r in recs if has_batchim(r["name"][0])]
        births = sum(r["t"] for r in recs)
        both = [r for r in recs if has_batchim(r["name"][0]) and has_batchim(r["name"][-1])]
        none_ = [r for r in recs if not has_batchim(r["name"][0]) and not has_batchim(r["name"][-1])]
        return {
            "names": len(recs),
            "end_batchim_names": len(b_names), "end_batchim_names_pct": pct(len(b_names), len(recs)),
            "end_batchim_births": sum(r["t"] for r in b_names),
            "end_batchim_births_pct": pct(sum(r["t"] for r in b_names), births),
            "first_batchim_names": len(b_first), "first_batchim_names_pct": pct(len(b_first), len(recs)),
            "both_batchim_names": len(both), "both_batchim_names_pct": pct(len(both), len(recs)),
            "no_batchim_names": len(none_), "no_batchim_names_pct": pct(len(none_), len(recs)),
        }

    batchim = {
        "basis": "두 글자 이름만(batchim-pattern 리포트와 같은 범위). 범위 안 pk 는 모두 두 글자인지 scope.syllable_distribution 확인",
        "pk": batchim_profile(pk_two),
        "all_two_syllable": batchim_profile(two_all),
    }

    # ---- 참고 조합(한자로 쓴다면) ----
    with_combo = [r for r in scope if r["combos"]]
    without_combo = [r for r in scope if not r["combos"]]
    nr_syl = Counter(s for r in without_combo for s in r["non_reading_syllables"])
    hanja_ref = {
        "with_combo": len(with_combo), "with_combo_pct": pct(len(with_combo), len(scope)),
        "with_combo_births": sum(r["t"] for r in with_combo),
        "without_combo": len(without_combo), "without_combo_pct": pct(len(without_combo), len(scope)),
        "without_combo_births": sum(r["t"] for r in without_combo),
        "without_combo_births_pct": pct(sum(r["t"] for r in without_combo), scope_births),
        "without_combo_names": [r["name"] for r in without_combo],
        "without_combo_with_non_reading_syllable": sum(1 for r in without_combo if r["non_reading_syllables"]),
        "without_combo_all_syllables_readable": [r["name"] for r in without_combo if not r["non_reading_syllables"]],
        "non_reading_syllables": dict(nr_syl.most_common()),
        "non_reading_syllables_distinct": len(nr_syl),
        "with_combo_but_non_reading_syllable": [r["name"] for r in with_combo if r["non_reading_syllables"]],
        "readings_distinct": len(readings),
        "top_without_combo": [{"name": r["name"], "t": r["t"], "rank_pk": r["rank_pk"],
                               "non_reading": r["non_reading_syllables"]} for r in without_combo[:10]],
    }

    # ---- 세 글자 리포트의 순우리말 8개와의 관계 ----
    review = load_three_syllable_review()
    ts_pure = sorted(n for n, (cls, _why) in review.items() if cls == "순우리말")
    cross = {
        "three_syllable_pure": ts_pure,
        "rows": [{"name": n, "in_name_seo": n in names, "pk": bool(names.get(n, {}).get("pk")),
                  "in_scope": n in {r["name"] for r in scope}, "pa": names.get(n, {}).get("pa")} for n in ts_pure],
        "pk_three_syllable_all": [r["name"] for r in pk_all if r["syll"] == 3],
    }

    # ---- 성별 ----
    inc_rows = [r for r in scope if r["name"] in include]
    sex = {
        "pk_scope": sex_profile(scope),
        # 사이트가 따로 더한 '별' 이름(include)을 뺀 값 — 여아 쪽 결과가 그 목록 때문인지 보려는 대조
        "pk_scope_without_include": sex_profile(scope_wo_inc),
        "include_in_scope": {
            "names": len(inc_rows), "births": sum(r["t"] for r in inc_rows),
            "births_share_of_scope_pct": pct(sum(r["t"] for r in inc_rows), scope_births),
            "sides": dict(Counter(r["side"] for r in inc_rows)),
        },
        "all": sex_profile(all_recs),
        "all_two_syllable": sex_profile(two_all),
        "note": "남아 비율 < 35% 여자 쪽 · 35~65%(양끝 포함) 중성 · > 65% 남자 쪽. /name 페이지 배지는 60/40(genderSplit)",
        # 이 리포트의 쪽(35/65)과 이름 페이지 배지(60/40)가 다른 이름 — 본문에 기준 차이를 밝힐 때 예로 든다
        "page_badge_by_side": {s: dict(Counter(page_gender(r) for r in scope if r["side"] == s)) for s in SIDES},
        "page_badge_differs": [{"name": r["name"], "side": r["side"], "badge": page_gender(r),
                                "male_pct1": pct(r["m"], r["t"]), "t": r["t"]}
                               for r in scope if not (
                                   (r["side"] == "중성" and page_gender(r) == "중성")
                                   or (r["side"] == "여자 쪽" and page_gender(r) == "여자 이름")
                                   or (r["side"] == "남자 쪽" and page_gender(r) == "남자 이름"))],
    }

    facts = {
        "generated_by": "scripts/build_insight_pure_korean.py",
        "scope_cutoff": SCOPE_CUTOFF,
        "link_cutoff": LINK_CUTOFF,
        "source": {
            "dataset": "frontend/src/data/name-seo.json",
            "meta": meta,
            "total_names": total_names,
            "total_births": total_births,
            "scope": "두·세 글자 한글 이름 중 2008~2019 합산 출생신고 30건 이상. 연도별 값 없음. 한자 신고 여부 없음",
            "pk_definition": {
                "rule": "PureKoreanNameEngine 내장 사전 − exclude + include (data/pure-korean-name-overrides.json)",
                "dictionary_distinct_names": len(dict_names),
                "dictionary_names_in_dataset": len(dict_names & in_data),
                "exclude_count": len(exclude),
                "exclude_in_dataset": sorted(exclude & in_data),
                "include_count": len(include),
                "include_names": sorted(include),
                "pk_total": len(pk_all),
                "verified_equal_to_rule": True,
            },
            "hanja_readings": {"file": "frontend/src/data/hanja-seo.json", "distinct_readings": len(readings)},
        },
        "thresholds": {"skew": SKEW, "unisex_band_male_share": list(UNISEX), "top_n": TOP_N, "sub_n": SUB_N,
                       "syl_top": SYL_TOP},
        "scope": {
            "public_pk": len(scope),
            "pk_total": len(pk_all),
            "unpublished": len(unpublished),
            "unpublished_names": [r["name"] for r in unpublished],
            "unpublished_pa": sorted({r["pa"] for r in unpublished}),
            "syllable_distribution": dict(Counter(r["syll"] for r in scope)),
            "births": scope_births,
            "births_share_of_all_pct": pct(scope_births, total_births, 2),
            "names_share_of_all_pct": pct(len(scope), total_names, 2),
            "births_unpublished": sum(r["t"] for r in unpublished),
            "overall_rank_buckets": rank_buckets,
            "overall_rank_buckets_competition": rank_buckets_competition,
            "top3": [{"name": r["name"], "t": r["t"], "rank": r["rank"]} for r in scope[:3]],
            "top3_births_share_of_scope_pct": pct(sum(r["t"] for r in scope[:3]), scope_births),
            "top10_births_share_of_scope_pct": pct(sum(r["t"] for r in scope[:10]), scope_births),
            "min_t": min(r["t"] for r in scope),
            "max_t": max(r["t"] for r in scope),
        },
        "sex": sex,
        "top": {
            "table_md": top_md,
            "rows": len(top_rows),
            "tie_groups": tie_groups(top_rows),
            "overall_tie_groups": [r["overall_same_t_names"] for r in top_rows if r["overall_same_t_others"]],
            "rank_vs_competition": [{"name": r["name"], "rank": r["rank"], "competition": r["overall_competition_rank"]}
                                    for r in top_rows if r["rank"] != r["overall_competition_rank"]],
            "sides": dict(Counter(r["side"] for r in top_rows)),
            "side_names": {s: [r["name"] for r in top_rows if r["side"] == s] for s in SIDES},
            "shares": top_dominant,
        },
        "by_side": by_side,
        "syllables": syllables,
        "batchim": batchim,
        "hanja_ref": hanja_ref,
        "cross": cross,
        "list": [
            {k: r[k] for k in ("rank_pk", "name", "t", "m", "f", "male_pct", "female_pct", "side", "rank_side", "rank",
                               "overall_competition_rank", "rm", "rf", "pa", "mean", "combos", "non_reading_syllables")}
            | {"include": r["name"] in include}
            for r in scope
        ],
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(facts, fh, ensure_ascii=False, indent=1)

    # ---- 표준출력 요약 ----
    sc = facts["scope"]
    pd = facts["source"]["pk_definition"]
    print(f"자료: {meta['source']} · 이름 {fmt(total_names)}개 · 출생신고 {fmt(total_births)}건 · 기준일 {SCOPE_CUTOFF}")
    print(f"pk 정의: 사전 {pd['dictionary_distinct_names']}개(자료에 있는 것 {pd['dictionary_names_in_dataset']}) − exclude {pd['exclude_count']} "
          f"+ include {pd['include_count']} = pk {pd['pk_total']} (규칙과 일치)")
    print(f"범위: 공개 pk {sc['public_pk']}개 / 전체 pk {sc['pk_total']} (미공개 {sc['unpublished']}: {' '.join(sc['unpublished_names'])}) · "
          f"음절 {sc['syllable_distribution']} · 출생신고 {fmt(sc['births'])}건(전체의 {sc['births_share_of_all_pct']}) · "
          f"이름 수 전체의 {sc['names_share_of_all_pct']}")
    print(f"  상위3 {sc['top3']} · 상위3 몫 {sc['top3_births_share_of_scope_pct']} · 상위10 몫 {sc['top10_births_share_of_scope_pct']} · "
          f"건수 범위 {sc['min_t']}~{fmt(sc['max_t'])} · 전체 순위 구간 {sc['overall_rank_buckets']} (경쟁 순위 {sc['overall_rank_buckets_competition']})")
    for label, p in (("pk", sex["pk_scope"]), ("pk − include", sex["pk_scope_without_include"]),
                     ("전체 5,340", sex["all"]), ("두 글자 전체", sex["all_two_syllable"])):
        sides = " · ".join(f"{s} {v['names']}개({v['names_share_pct']}) {fmt(v['births'])}건({v['births_share_pct']})"
                           for s, v in p["sides"].items())
        print(f"성별[{label}]: 남아 {fmt(p['male_births'])} · 여아 {fmt(p['female_births'])} (여아 {p['female_share_pct']}) · {sides} · "
              f"남95%+ {p['male95_count']} · 여95%+ {p['female95_count']} (쏠림 {p['skew95_share_pct']}) · 한쪽 0건 남{p['male_only_count']}/여{p['female_only_count']}")
    print(f"쪽별 이름 페이지 배지: {sex['page_badge_by_side']}")
    print(f"  배지가 쪽과 다른 이름 {len(sex['page_badge_differs'])}개: " +
          " ".join(f"{d['name']}({d['side']}→{d['badge']}, 남아 {d['male_pct1']})" for d in sex["page_badge_differs"]))
    inc = sex["include_in_scope"]
    print(f"include(범위 안) {inc['names']}개 · {fmt(inc['births'])}건({inc['births_share_of_scope_pct']}) · 쪽 {inc['sides']}")
    print(f"\n상위 {TOP_N} 표({len(top_rows)}행 · 쪽 {facts['top']['sides']} · 동률 {facts['top']['tie_groups']} · "
          f"전체 순위 동률 {facts['top']['overall_tie_groups']}):\n{top_md}")
    for s, b in by_side.items():
        intop = " ".join(f"{x['name']}({x['rank_side']})" for x in b["in_top_table_all"])
        print(f"\n{s} {b['names_in_side']}개 {fmt(b['births_in_side'])}건 · TOP {TOP_N} 에 든 것 {len(b['in_top_table_all'])}개: {intop}")
        print(f"  TOP {TOP_N} 밖 다음 표({b['after_top_rows']}행, 쪽 안 순위 {b['after_top_rank_range']} · 동률 {b['after_top_tie_groups']} · "
              f"전체 순위 동률 {b['after_top_overall_tie_groups']} · 순위≠경쟁 순위 {b['after_top_rank_vs_competition']} · 표에 안 나오는 이름 {b['not_shown']}개):\n"
              f"{b['after_top_table_md']}")
    sy = syllables
    print(f"\n끝 음절 표({end_rows}행, 서로 다른 끝 음절 {sy['end_distinct']}개):\n{end_md}")
    print(f"\n첫 음절 표({first_rows}행, 서로 다른 첫 음절 {sy['first_distinct']}개):\n{first_md}")
    print(f"\n끝 '별' {sy['end_byeol_count']}개 {sy['end_byeol_names']} · include 에서 {len(sy['end_byeol_from_include'])}개 · 사전에서 {sy['end_byeol_from_dictionary']} · "
          f"첫 '별' {sy['first_byeol_names']}")
    print(f"include {sy['include_total']}개 중 범위 안 {sy['include_in_scope_count']} · 미공개 {sy['include_unpublished']} · "
          f"끝 '별' {len(sy['include_end_byeol'])} · 첫 '별' {sy['include_first_byeol']}")
    print(f"include 뺀 {sy['without_include_names']}개 끝 음절: " +
          " ".join(f"{x['rank_by_names']}.{x['syllable']}({x['names']}·{fmt(x['births'])})" for x in sy["end_without_include"][:10]))
    print(f"include 뺀 첫 음절: " +
          " ".join(f"{x['rank_by_names']}.{x['syllable']}({x['names']}·{fmt(x['births'])})" for x in sy["first_without_include"][:10]))
    print(f"출생신고 기준 1위 — pk 끝 {sy['pk_end_first_by_births']} · pk 첫 {sy['pk_first_first_by_births']} · "
          f"전체 끝 {sy['all_end_first_by_births']} · 전체 첫 {sy['all_first_first_by_births']}")
    print(f"이름 수 기준 1위 — 전체 끝 {sy['all_end_first_by_names']} · 전체 첫 {sy['all_first_first_by_names']} · 두 글자 끝 {sy['two_all_end_first_by_names']}")
    print(f"'별' 독음 한자 {sy['byeol_hanja_count']}자: " + " ".join(f"{x['char']}({x['m']}{' ·불용' if x['nf'] else ''})" for x in byeol_hanja))
    print(f"  훈에 '별'이 든 글자: {sy['byeol_hanja_with_byeol_in_hun']}")
    bp, ba = batchim["pk"], batchim["all_two_syllable"]
    print(f"\n받침(두 글자): 끝 음절 받침 pk {bp['end_batchim_names']}/{bp['names']}({bp['end_batchim_names_pct']}, 건수 {bp['end_batchim_births_pct']}) · "
          f"전체 {fmt(ba['end_batchim_names'])}/{fmt(ba['names'])}({ba['end_batchim_names_pct']}, 건수 {ba['end_batchim_births_pct']}) · "
          f"첫 음절 받침 pk {bp['first_batchim_names_pct']} · 전체 {ba['first_batchim_names_pct']} · "
          f"둘 다 pk {bp['both_batchim_names_pct']} · 전체 {ba['both_batchim_names_pct']} · 둘 다 없음 pk {bp['no_batchim_names_pct']} · 전체 {ba['no_batchim_names_pct']}")
    h = hanja_ref
    print(f"\n참고 조합 있음 {h['with_combo']}개({h['with_combo_pct']}) · 없음 {h['without_combo']}개({h['without_combo_pct']}, 건수 {fmt(h['without_combo_births'])} = {h['without_combo_births_pct']}) · "
          f"없는 이름 중 독음 없는 음절 든 이름 {h['without_combo_with_non_reading_syllable']} · 모두 읽히는데 조합 없음 {h['without_combo_all_syllables_readable']} · "
          f"조합 있는데 독음 없는 음절 {h['with_combo_but_non_reading_syllable']}")
    print(f"  독음 없는 음절({h['non_reading_syllables_distinct']}개): {h['non_reading_syllables']}")
    print(f"  조합 없는 이름: {' '.join(h['without_combo_names'])}")
    print(f"\n세 글자 리포트 순우리말 8개: " + " · ".join(
        f"{x['name']}(pk {int(x['pk'])}, 범위 {int(x['in_scope'])}, pa {x['pa']})" for x in cross["rows"]) +
        f" · pk 세 글자 전체 {cross['pk_three_syllable_all']}")
    print(f"\nfacts → {OUT_PATH}")


if __name__ == "__main__":
    main()
