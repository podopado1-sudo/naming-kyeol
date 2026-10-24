# -*- coding: utf-8 -*-
"""데이터 리포트 '자원오행은 어떻게 정하나 — 부수표, 이견, 예외' 수치 산출 (2026-10-22, 자원오행 전환 S7).

frontend/content/insights/resource-element-radicals.md 본문의 숫자는 전부 이 스크립트 결과(facts.json)에서 옮긴다.
손 계산 금지 — 결과 파일(data/hanja_resource_element.json)을 다시 만들면 이 스크립트를 다시 돌려 표·본문을 맞출 것.

입력 (저장소 루트 기준 상대 경로, 모두 커밋된 파일):
  data/hanja_resource_element.json      글자별 자원오행 결과(e·g·radical·radical_char·alt_radical·alt_char·v_reasons·number·variant_of·note)
  data/radical_resource_element.json    214부수표(element·status·alt·alt_by·votes·chars) + meta.sources(출처 제목)
  data/resource_element_exceptions.json 글자 예외표(간지·문헌·실무)·이견 글자(disputed_chars)
  data/radical_resource_votes.json      실무 자료 부수별 집계 고정본(votes — [다수값, 다수값 글자 수, 그 부수 글자 수])
  frontend/src/data/name-seo.json       이름별 한자 조합(combos) — '이름에 실제로 쓰이는 글자' 집계용
  frontend/src/data/hanja-seo.json      /hanja/<글자> 상세 페이지 유무(m·s)만 — 본문 링크 확인용
선택 입력 (없으면 해당 블록은 null):
  git show OLD_REV:frontend/src/data/hanja-seo.json  전환 전 사이트 오행(뜻풀이·뜻 키워드·획수 끝자리) — '이 사이트가 바꾼 것' 블록

화면 문구 규칙 (data/hanja_resource_element.json meta.fields — 리포트에도 그대로 지킨다):
  - 작명 실무 자료(HN·NC·IO)는 이름을 들지 않는다 — '공개된 작명 실무 자료 3곳'. 이 스크립트도 출처별 수치를 이름 없이
    작은 값부터 정렬해 낸다(어느 자료의 값인지 facts 에 싣지 않는다).
  - 부수 basis 의 HN·NC·IO 는 '그 자료가 이 부수 글자들에 준 다수값'(부수 단위)이다. 글자 판단처럼 쓰지 말 것 —
    글자 단위 실무 근거는 PRACTICE(실무 예외 X·이견 alt_char)뿐이다.
  - alt_radical 은 '이 부수를 Y로 보는 자료도 있습니다'(부수 단위), alt_char 는 출처별(문헌·실무 자료 n곳).
  - 사주 판단(어떤 오행이 필요한가)은 하지 않는다.

자료의 한계 (리포트에 반드시 밝힐 것):
  - 실무 자료 3곳은 데이터 출처를 밝히지 않는다. 글자 값을 다 모은 것이 아니라 2026-10-21 공개 페이지에서 확인한 글자만이다.
    그중 한 곳은 부수 규칙표에 가깝다(그래서 그 자료가 자기 부수 다수값을 되풀이한 값은 독립 근거로 세지 않는다 — B-1).
  - 학술 논문 2편(이재승·김만태 2018, 이재승 2024)은 초록만 확인했다(본문 유료).
  - 김만태 부수표는 공개 해설 글의 표 한 장이다. 표에 없는 부수는 실무 자료 집계 → 자의 추정 순으로 정했다.

사용법 (저장소 루트에서, 인자 없음):
  python -I scripts/build_insight_resource_element.py
출력: 표준출력(요약 + 표 초안) + OUT_PATH(facts.json). OUT_PATH 는 환경 변수 INSIGHT_FACTS_OUT 으로 바꿀 수 있다.
"""
import json
import os
import subprocess
import sys
from collections import Counter, defaultdict
from decimal import ROUND_HALF_UP, Decimal

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RE_PATH = os.path.join(ROOT, "data", "hanja_resource_element.json")
RT_PATH = os.path.join(ROOT, "data", "radical_resource_element.json")
EX_PATH = os.path.join(ROOT, "data", "resource_element_exceptions.json")
VO_PATH = os.path.join(ROOT, "data", "radical_resource_votes.json")
NS_PATH = os.path.join(ROOT, "frontend", "src", "data", "name-seo.json")
HS_PATH = os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json")  # /hanja/<글자> 상세 페이지가 있는지(링크 확인)만

# 자원오행 전환 재생성(S6 70e5551) 직전 커밋 — 이 커밋의 hanja-seo.json e 가 전환 전 사이트 오행이다.
OLD_REV = "9a6423a"
OLD_SEO_PATH = "frontend/src/data/hanja-seo.json"

# 리포트 작성용 산출물(커밋 대상 아님 — tmp/ 는 .gitignore). INSIGHT_FACTS_OUT 으로 경로를 바꿀 수 있다.
DEFAULT_OUT = os.path.join(ROOT, "tmp", "insight-facts", "resource-element.json")
OUT_PATH = os.environ.get("INSIGHT_FACTS_OUT") or DEFAULT_OUT

ELEMENTS = ("木", "火", "土", "金", "水")
GRADES = ("R", "V", "X", "U")
PRACTICE_SOURCES = ("HN", "NC", "IO")  # 부수 집계 1표를 내는 실무 자료(HN-S 는 골라 뽑은 표본이라 제외)
LITERATURE_KEYS = {"KIM": "김만태 부수표", "KIM-EX": "김만태 예시", "KIM-TXT": "김만태 본문"}
READER_CHARS = ("振", "津", "眞", "真")  # 블로그 독자 질문 사례(개인정보 없음)
TOP_RADICALS = 12
TOP_NAME_CHARS = 12


def pct(num, den, nd=1):
    """반올림(half-up) 백분율 문자열."""
    if not den:
        return None
    q = Decimal(1).scaleb(-nd) if nd else Decimal(1)
    return f"{(Decimal(num) * 100 / Decimal(den)).quantize(q, rounding=ROUND_HALF_UP)}%"


def fmt(n):
    return f"{n:,}"


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def load_old_seo():
    """OLD_REV 의 hanja-seo.json — git 이 없거나 커밋이 없으면 None."""
    try:
        out = subprocess.run(
            ["git", "-C", ROOT, "show", f"{OLD_REV}:{OLD_SEO_PATH}"],
            capture_output=True, check=True, timeout=60,
        ).stdout
        return json.loads(out.decode("utf-8"))
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def alt_sources(alt_by):
    """부수 alt 값 → 출처 설명(문헌은 이름, 실무 자료는 곳 수만)."""
    res = {}
    for e, entries in (alt_by or {}).items():
        lit = sorted({LITERATURE_KEYS.get(x["src"], x["src"]) for x in entries if x["src"] in LITERATURE_KEYS})
        prac = sorted({x["src"] for x in entries if x["src"] in PRACTICE_SOURCES})
        levels = sorted({x.get("level") for x in entries if x["src"] in PRACTICE_SOURCES})
        res[e] = {"literature": lit, "practice_sources": len(prac), "practice_levels": levels}
    return res


def main():
    re_all = load(RE_PATH)
    rt = load(RT_PATH)
    ex = load(EX_PATH)
    vo = load(VO_PATH)
    ns = load(NS_PATH)
    hs = load(HS_PATH)

    chars = {c: v for c, v in re_all["chars"].items() if not v.get("compat_of")}
    compat_keys = sum(1 for v in re_all["chars"].values() if v.get("compat_of"))
    radicals = rt["radicals"]  # "번호" → 부수 항목
    sources = rt["meta"]["sources"]

    # ── 1. 글자 전체 ──────────────────────────────────────────
    total = len(chars)
    grade = Counter(v["g"] for v in chars.values())
    element = Counter(v["e"] for v in chars.values() if v.get("e"))
    v_reasons = Counter(r for v in chars.values() for r in v.get("v_reasons", []))
    alt_char_chars = sum(1 for v in chars.values() if v.get("alt_char"))
    v_without_alt = sum(1 for v in chars.values() if v["g"] == "V" and not v.get("alt_radical") and not v.get("alt_char"))
    # 이유가 '자료 적음'(radical_single)·'자의 추정'(radical_unknown)뿐인 V — /hanja 배지는 '이견'이 아니라 '자료 적음'·'추정'
    # (components/hanja/hanja-element-text.ts gradeBadgeKey 와 같은 규칙: 이유가 그 하나뿐일 때)
    v_few = sum(1 for v in chars.values() if v["g"] == "V" and v.get("v_reasons") == ["radical_single"])
    v_guess = sum(1 for v in chars.values() if v["g"] == "V" and v.get("v_reasons") == ["radical_unknown"])
    numbers = sorted(
        (c for c, v in chars.items() if v.get("number")),
        key=lambda c: "一二三四五六七八九十百千萬".index(c) if c in "一二三四五六七八九十百千萬" else 99,
    )
    number_rows = [
        {"char": c, "e": chars[c]["e"], "g": chars[c]["g"], "radical_char": chars[c]["radical_char"],
         "radical_element": radicals[str(chars[c]["radical"])]["element"]}
        for c in numbers
    ]

    # ── 2. 부수표 ──────────────────────────────────────────────
    status_radicals = Counter(r["status"] for r in radicals.values())
    radical_elements = Counter(r["element"] for r in radicals.values())
    chars_per_radical = Counter(v["radical"] for v in chars.values())
    used = {int(k): r for k, r in radicals.items() if chars_per_radical.get(int(k))}
    status_used = Counter(r["status"] for r in used.values())
    chars_by_status = Counter()
    for v in chars.values():
        chars_by_status[radicals[str(v["radical"])]["status"]] += 1
    # 부수 chars 필드(부수표가 센 글자 수)와 결과 파일 집계가 같은지 — 다르면 입력이 서로 다른 시점
    radical_count_mismatch = [
        k for k, r in radicals.items() if r.get("chars", 0) != chars_per_radical.get(int(k), 0)
    ]
    kim_radicals = sum(1 for r in radicals.values() if "KIM" in r.get("votes", {}))
    jaui = [r["radical"] for r in radicals.values() if r["status"] == "unknown"]
    overridden = [{"radical": r["radical"], "element": r["element"], "overridden": r["overridden"]}
                  for r in radicals.values() if r.get("overridden")]
    by_char = {r["radical"]: r for r in radicals.values()}
    radical_lookup = {
        k: {"element": by_char[k]["element"], "status": by_char[k]["status"], "alt": by_char[k].get("alt", []),
            "chars": chars_per_radical.get(int(n), 0)}
        for n, k in ((n, r["radical"]) for n, r in radicals.items())
        if k in ("口", "囗", "子", "人", "示", "石", "女", "广", "頁", "彡", "宀", "目", "手", "水")
    }

    top = sorted(used.items(), key=lambda kv: (-chars_per_radical[kv[0]], kv[0]))[:TOP_RADICALS]
    cum = 0
    top_rows = []
    for num, r in top:
        n = chars_per_radical[num]
        cum += n
        top_rows.append({
            "num": num, "radical": r["radical"], "element": r["element"], "status": r["status"],
            "alt": r.get("alt", []), "chars": n, "share": pct(n, total), "cum_share": pct(cum, total),
        })

    # 이견 부수의 두 갈래 — 다른 값(alt)이 있는 부수(자료끼리 값이 다름) / alt 없이 한 자료 안에서만 글자끼리 갈리는 부수
    # (門 — 모든 자료의 다수값은 같고, 한 자료 안에서 같은 부수 글자끼리 값이 갈림). 표(disputed_top)는 앞 갈래만 싣는다
    disputed_used = [(num, r) for num, r in used.items() if r["status"] == "disputed"]
    disputed_alt = [(num, r) for num, r in disputed_used if r.get("alt")]
    disputed_split_only = sorted(
        ((num, r) for num, r in disputed_used if not r.get("alt")),
        key=lambda kv: (-chars_per_radical[kv[0]], kv[0]),
    )
    disputed_split = {
        "with_alt": len(disputed_alt),
        "with_alt_chars": sum(chars_per_radical[n] for n, _ in disputed_alt),
        "split_only": len(disputed_split_only),
        "split_only_chars": sum(chars_per_radical[n] for n, _ in disputed_split_only),
        "split_only_list": [{"radical": r["radical"], "element": r["element"], "chars": chars_per_radical[n]}
                            for n, r in disputed_split_only],
    }
    disputed_top = sorted(
        ((num, r) for num, r in used.items() if r["status"] == "disputed" and r.get("alt")),
        key=lambda kv: (-chars_per_radical[kv[0]], kv[0]),
    )[:10]
    disputed_rows = [
        {"num": num, "radical": r["radical"], "element": r["element"], "alt": r["alt"],
         "alt_sources": alt_sources(r.get("alt_by")), "decided_by": r.get("decided_by"),
         "split": len(r.get("split", [])), "chars": chars_per_radical[num]}
        for num, r in disputed_top
    ]

    # ── 3. 실무 자료가 부수 하나로 설명되는 정도 (부수 단위 집계 — 출처 이름 없이) ──
    explain = []
    for src in PRACTICE_SOURCES:
        maj = tot = 0
        for r in vo["votes"].values():
            v = r.get(src)
            if v:
                maj += v[1]
                tot += v[2]
        explain.append({"majority_chars": maj, "chars": tot, "share": pct(maj, tot)})
    explain.sort(key=lambda x: Decimal(x["share"].rstrip("%")))

    # ── 4. 예외·이견 글자 ─────────────────────────────────────
    exc = ex["exceptions"]
    exc_kind = Counter(v["kind"] for v in exc.values())
    ganji_changing = sum(1 for v in exc.values() if v["kind"] == "ganji" and not v["same_as_radical"])
    # 예외 적용(X) 가운데 값이 부수값과 실제로 다른 글자. 간지 22자는 값이 부수값과 같아도 X 다(간지 오행이 부수보다 먼저 —
    # 乙·子·辛 등 8자). 그래서 X 전체를 '부수와 다른 값을 쓰는 글자'로 쓰면 틀린다 — 문구에 '다른 값' 글자 수가 필요하면
    # 이 값을 옮긴다(2026-10-23 운영 검증 CONTENT-1: 리포트 description·/method 등급 설명이 78자 전부를 '다른 값'으로 썼다).
    # 결과 파일(e 와 부수표 element)로도 따로 세어 두 값이 같은지 함께 싣는다.
    exc_differs = sum(1 for v in exc.values() if v["element"] != v["radical_element"])
    x_differs_result = sum(
        1 for v in chars.values() if v["g"] == "X" and v["e"] != radicals[str(v["radical"])]["element"]
    )
    practice_by_n = Counter(
        f"{v['practice']['n']}/{v['practice']['of']}" for v in exc.values() if v["kind"] == "practice" and v.get("practice")
    )
    exc_lists = {
        k: [{"char": c, "e": v["element"], "radical_element": v["radical_element"],
             "radical_char": radicals[str(v["radical"])]["radical"], "basis": v.get("basis", [])}
            for c, v in exc.items() if v["kind"] == k]
        for k in ("ganji", "literature", "practice")
    }
    dc = ex["disputed_chars"]
    dc_kind = Counter(v["kind"] for v in dc.values())
    dc_lists = defaultdict(list)
    for c, v in dc.items():
        dc_lists[v["kind"]].append({"char": c, "e": chars[c]["e"] if c in chars else None,
                                    "alt_char": v.get("alt_char", []), "radical_element": v["radical_element"]})

    # 결과 파일 X 가 예외표와 같은 집합인지
    x_chars = {c for c, v in chars.items() if v["g"] == "X"}
    x_mismatch = sorted(x_chars ^ set(exc))

    # ── 5. 이름에 실제로 쓰이는 글자 (수록 이름 전부의 1순위 조합) ──
    names = ns["names"]
    top_combo_chars = Counter()
    all_combo_chars = Counter()
    names_with_combos = 0
    names_with_v = names_with_v_or_x = 0  # 1순위 조합에 '이견 있음'(또는 예외) 글자가 하나라도 든 이름
    for rec in names.values():
        combos = rec.get("combos") or []
        if not combos:
            continue
        names_with_combos += 1
        top_grades = [chars[ch]["g"] for ch in combos[0] if ch in chars]
        names_with_v += any(g == "V" for g in top_grades)
        names_with_v_or_x += any(g in ("V", "X") for g in top_grades)
        for ch in combos[0]:
            top_combo_chars[ch] += 1
        for combo in combos:
            for ch in combo:
                all_combo_chars[ch] += 1
    in_data = {c: n for c, n in top_combo_chars.items() if c in chars}
    occ = sum(in_data.values())
    grade_distinct = Counter(chars[c]["g"] for c in in_data)
    grade_occ = Counter()
    for c, n in in_data.items():
        grade_occ[chars[c]["g"]] += n
    name_x = sorted((c for c in in_data if chars[c]["g"] == "X"), key=lambda c: (-in_data[c], c))[:TOP_NAME_CHARS]
    name_v = sorted((c for c in in_data if chars[c]["g"] == "V"), key=lambda c: (-in_data[c], c))[:TOP_NAME_CHARS]
    # V 이유별 예시 — 이름 1순위 조합에 많이 나오는 순(없으면 코드포인트 순)
    reason_examples = {}
    for reason in v_reasons:
        cs = [c for c, v in chars.items() if reason in v.get("v_reasons", [])]
        cs.sort(key=lambda c: (-in_data.get(c, 0), c))
        reason_examples[reason] = [{"char": c, "e": chars[c]["e"], "radical_char": chars[c]["radical_char"],
                                    "alt_radical": chars[c].get("alt_radical", []),
                                    "alt_char": chars[c].get("alt_char", []), "names_top": in_data.get(c, 0)}
                                   for c in cs[:5]]

    def char_row(c):
        v = chars[c]
        return {"char": c, "names_top": in_data.get(c, 0), "e": v["e"], "g": v["g"], "radical_char": v["radical_char"],
                "radical_element": radicals[str(v["radical"])]["element"], "alt_radical": v.get("alt_radical", []),
                "alt_char": v.get("alt_char", []), "v_reasons": v.get("v_reasons", []), "note": v.get("note")}

    # ── 6. 독자 질문 사례 ──────────────────────────────────────
    reader = []
    for c in READER_CHARS:
        v = chars.get(c)
        if not v:
            continue
        r = radicals[str(v["radical"])]
        reader.append({"char": c, "e": v["e"], "g": v["g"], "radical_char": v["radical_char"], "radical_status": r["status"],
                       "alt_radical": v.get("alt_radical", []), "alt_char": v.get("alt_char", []),
                       "variant_of": v.get("variant_of"), "note": v.get("note"),
                       "detail_page": bool(hs.get(c, {}).get("m") and hs.get(c, {}).get("s"))})

    # ── 7. 이체자: 쓴 꼴의 부수를 따른다(D6) — 정자와 값이 다른 쌍 ──
    var_pairs = [(c, v["variant_of"]) for c, v in chars.items() if v.get("variant_of") and v["variant_of"] in chars]
    var_diff = [(c, s) for c, s in var_pairs if chars[c]["e"] != chars[s]["e"]]
    var_diff_rows = sorted(
        ({"char": c, "e": chars[c]["e"], "radical_char": chars[c]["radical_char"], "standard": s,
          "standard_e": chars[s]["e"], "standard_radical_char": chars[s]["radical_char"],
          "names_all": all_combo_chars.get(c, 0) + all_combo_chars.get(s, 0)} for c, s in var_diff),
        key=lambda x: (-x["names_all"], x["char"]),
    )[:8]

    # ── 8. 이 사이트가 바꾼 것 (선택) ────────────────────────────
    old = load_old_seo()
    site_change = None
    if old is not None:
        both = [c for c in chars if c in old]
        changed = [c for c in both if old[c].get("e") != chars[c]["e"]]
        old_grade = Counter(old[c].get("g") for c in both)
        changed_by_old_grade = Counter(old[c].get("g") for c in changed)
        top_changed = sorted((c for c in changed if c in in_data), key=lambda c: (-in_data[c], c))[:TOP_NAME_CHARS]
        site_change = {
            "old_rev": OLD_REV,
            "compared": len(both),
            "changed": len(changed),
            "changed_share": pct(len(changed), len(both)),
            "old_grade": dict(old_grade),
            "changed_by_old_grade": {g: {"changed": changed_by_old_grade.get(g, 0), "of": n,
                                         "share": pct(changed_by_old_grade.get(g, 0), n)} for g, n in old_grade.items()},
            "name_top_chars_changed": sum(1 for c in in_data if c in old and old[c].get("e") != chars[c]["e"]),
            "name_top_chars": len([c for c in in_data if c in old]),
            "name_top_occ_changed": sum(n for c, n in in_data.items() if c in old and old[c].get("e") != chars[c]["e"]),
            "examples": [{"char": c, "old_e": old[c].get("e"), "new_e": chars[c]["e"], "names_top": in_data[c],
                          "radical_char": chars[c]["radical_char"]} for c in top_changed],
            "reader_old": {c: old[c].get("e") for c in READER_CHARS if c in old},
        }

    facts = {
        "generated_by": "scripts/build_insight_resource_element.py",
        "sources": {k: sources[k]["title"] for k in ("UNIHAN", "KIM", "AC1", "AC2", "CRIT") if k in sources},
        "kangxi_adjusted": len(rt["meta"].get("krs_kangxi_adjusted", {})),
        "chars": {
            "total": total,
            "compat_keys_merged": compat_keys,
            "grade": {g: grade.get(g, 0) for g in GRADES},
            "grade_share": {g: pct(grade.get(g, 0), total) for g in GRADES},
            "element": {e: element.get(e, 0) for e in ELEMENTS},
            "element_share": {e: pct(element.get(e, 0), total) for e in ELEMENTS},
            "v_reasons": dict(v_reasons),
            "alt_char_chars": alt_char_chars,
            "v_without_alt": v_without_alt,
            "v_badge_few_only": v_few,
            "v_badge_guess_only": v_guess,
            "v_badge_dispute": grade.get("V", 0) - v_few - v_guess,
            "numbers": number_rows,
        },
        "radicals": {
            "total": len(radicals),
            "status": dict(status_radicals),
            "used": len(used),
            "status_used": dict(status_used),
            "chars_by_status": {s: {"chars": n, "share": pct(n, total)} for s, n in chars_by_status.items()},
            "element": {e: radical_elements.get(e, 0) for e in ELEMENTS},
            "kim_table_radicals": kim_radicals,
            "jaui": jaui,
            "overridden": overridden,
            "lookup": radical_lookup,
            "count_mismatch": radical_count_mismatch,
            "top": top_rows,
            "disputed_top": disputed_rows,
            "disputed_split": disputed_split,
        },
        "practice_explain": explain,
        "exceptions": {
            "total": len(exc),
            "kind": dict(exc_kind),
            "ganji_changing_value": ganji_changing,
            "differs_from_radical": exc_differs,
            "same_as_radical": len(exc) - exc_differs,
            "differs_matches_result": exc_differs == x_differs_result,
            "practice_by_n": dict(practice_by_n),
            "lists": exc_lists,
            "x_matches_result": not x_mismatch,
            "x_mismatch": x_mismatch,
        },
        "disputed_chars": {"total": len(dc), "kind": dict(dc_kind), "lists": dict(dc_lists)},
        "names": {
            "names": len(names),
            "names_with_combos": names_with_combos,
            "names_with_v": names_with_v,
            "names_with_v_share": pct(names_with_v, names_with_combos),
            "names_with_v_or_x": names_with_v_or_x,
            "names_with_v_or_x_share": pct(names_with_v_or_x, names_with_combos),
            "top_combo_distinct_chars": len(in_data),
            "top_combo_occurrences": occ,
            "grade_distinct": {g: {"chars": grade_distinct.get(g, 0), "share": pct(grade_distinct.get(g, 0), len(in_data))}
                               for g in GRADES},
            "grade_occurrences": {g: {"occ": grade_occ.get(g, 0), "share": pct(grade_occ.get(g, 0), occ)} for g in GRADES},
            "top_x": [char_row(c) for c in name_x],
            "top_v": [char_row(c) for c in name_v],
            "v_reason_examples": reason_examples,
        },
        "reader": reader,
        "variants": {"pairs": len(var_pairs), "different_element": len(var_diff), "examples": var_diff_rows},
        "site_change": site_change,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(facts, fh, ensure_ascii=False, indent=1)

    # ── 요약 ────────────────────────────────────────────────
    c = facts["chars"]
    print(f"글자 {fmt(total)}자(호환 키 {compat_keys}개 병합) · 등급 " +
          " · ".join(f"{g} {fmt(c['grade'][g])}({c['grade_share'][g]})" for g in GRADES))
    print("오행 " + " · ".join(f"{e} {fmt(c['element'][e])}({c['element_share'][e]})" for e in ELEMENTS))
    print(f"V 이유 {dict(v_reasons)} · 글자 단위 대체값 {alt_char_chars}자 · 대체값 없는 V {v_without_alt}자 · "
          f"배지 '자료 적음'만 {v_few} · '추정'만 {v_guess} · '이견 있음' {c['v_badge_dispute']}")
    print("숫자 한자: " + " ".join(f"{r['char']}{r['e']}({r['g']}, 부수 {r['radical_char']} {r['radical_element']})" for r in number_rows))
    r = facts["radicals"]
    print(f"부수 {r['total']}개 · 상태 {r['status']} · 글자 있는 부수 {r['used']}개 {r['status_used']} · 김만태 표 부수 {kim_radicals}개 · 자의 추정 {jaui}")
    print(f"부수 상태별 글자 {r['chars_by_status']} · 부수 오행 {r['element']} · 부수표 chars 불일치 {radical_count_mismatch}")
    print("글자 많은 부수: " + " ".join(f"{x['radical']}{x['element']}({x['status']}) {x['chars']}자 누적 {x['cum_share']}" for x in top_rows))
    ds = r["disputed_split"]
    print(f"이견 부수 갈래: 다른 값 있음 {ds['with_alt']}개({fmt(ds['with_alt_chars'])}자) · 한 자료 안에서만 갈림 {ds['split_only']}개"
          f"({fmt(ds['split_only_chars'])}자): " + " ".join(f"{x['radical']} {x['chars']}" for x in ds["split_only_list"]))
    print("이견 부수(다른 값 있는 것, 글자 많은 순): ")
    for x in disputed_rows:
        print(f"  {x['radical']} {x['element']} alt {x['alt']} {x['alt_sources']} decided {x['decided_by']} split {x['split']} · {x['chars']}자")
    print("실무 자료 부수 다수값 설명률(이름 없이 작은 순): " + " · ".join(f"{x['share']}({fmt(x['majority_chars'])}/{fmt(x['chars'])})" for x in explain))
    e = facts["exceptions"]
    print(f"예외 {e['total']}자 {e['kind']} · 간지 중 값이 바뀌는 글자 {ganji_changing} · 실무 n/of {e['practice_by_n']} · X=예외표 {e['x_matches_result']} {x_mismatch}")
    print(f"  부수값과 다른 값 {e['differs_from_radical']}자 · 부수값과 같은 값 {e['same_as_radical']}자(간지) · "
          f"결과 파일 대조 {e['differs_matches_result']}({x_differs_result})")
    for k, lst in exc_lists.items():
        print(f"  {k}: " + " ".join(f"{x['char']}{x['e']}({x['radical_char']}{x['radical_element']}{'/' + '+'.join(x['basis']) if k == 'literature' else ''})" for x in lst))
    d = facts["disputed_chars"]
    print(f"이견 글자 {d['total']}자 {d['kind']}")
    for k, lst in dc_lists.items():
        print(f"  {k}: " + " ".join(f"{x['char']}{x['e']}" + ("[" + ",".join(f"{a['e']}:{'+'.join(a['basis'])}" + (f"({a.get('n')}/{a.get('of')}/{a.get('n_indep')})" if a.get('n') else "") for a in x['alt_char']) + "]" if x['alt_char'] else "") for x in lst))
    n = facts["names"]
    print(f"이름 {fmt(n['names'])}명(조합 있음 {fmt(n['names_with_combos'])}) · 1순위 조합 글자 {n['top_combo_distinct_chars']}자·{fmt(n['top_combo_occurrences'])}회")
    print(f"  1순위 조합에 이견 글자가 든 이름 {fmt(n['names_with_v'])}({n['names_with_v_share']}) · 이견·예외 {fmt(n['names_with_v_or_x'])}({n['names_with_v_or_x_share']})")
    print(f"  등급(글자 수) {n['grade_distinct']}")
    print(f"  등급(출현 수) {n['grade_occurrences']}")
    print("  이름에 많은 X: " + " ".join(f"{x['char']}{x['e']}({x['radical_char']}{x['radical_element']}) {x['names_top']}" for x in n["top_x"]))
    print("  이름에 많은 V: " + " ".join(f"{x['char']}{x['e']} alt{x['alt_radical']}{[a['e'] for a in x['alt_char']]} {x['v_reasons']} {x['names_top']}" for x in n["top_v"]))
    for reason, lst in reason_examples.items():
        print(f"  V 이유 {reason}: " + " ".join(f"{x['char']}{x['e']}({x['radical_char']}){x['alt_radical']}{[a['e'] for a in x['alt_char']]} {x['names_top']}" for x in lst))
    print(f"부수 참고 {radical_lookup} · 김만태 표 한 칸 반대를 이견으로 치지 않은 부수 {overridden}")
    print("독자 사례: " + " ".join(f"{x['char']}{x['e']}({x['g']}, {x['radical_char']} {x['radical_status']}, 상세 {x['detail_page']})" for x in reader))
    v = facts["variants"]
    print(f"이체자 쌍 {v['pairs']} · 정자와 값이 다른 쌍 {v['different_element']} · 예 " +
          " ".join(f"{x['char']}{x['e']}({x['radical_char']})↔{x['standard']}{x['standard_e']}({x['standard_radical_char']})" for x in v["examples"]))
    s = facts["site_change"]
    if s:
        print(f"사이트 변경(대비 {s['old_rev']}): {fmt(s['changed'])}/{fmt(s['compared'])}({s['changed_share']}) · 옛 등급별 {s['changed_by_old_grade']}")
        print(f"  1순위 조합 글자 중 바뀐 글자 {s['name_top_chars_changed']}/{s['name_top_chars']} · 출현 {fmt(s['name_top_occ_changed'])}회 · 독자 사례 옛 값 {s['reader_old']}")
        print("  예: " + " ".join(f"{x['char']} {x['old_e']}→{x['new_e']}({x['radical_char']}) {x['names_top']}" for x in s["examples"]))
    else:
        print(f"사이트 변경: git {OLD_REV} 없음 — 블록 생략")
    print("출처: " + " | ".join(f"{k}={t}" for k, t in facts["sources"].items()))
    print(f"\nfacts → {OUT_PATH}")


if __name__ == "__main__":
    main()
