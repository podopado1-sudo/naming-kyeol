#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
대표 훈을 바꾼 글자의 '옛 훈으로 윤문된' 뜻·서사 목록 (2026-10-22 潤 불을→윤택할, 荷 멜→연꽃).

data/hanja-gloss-overrides.json 은 Meaning 을 재배열만 해서 옛 첫 훈도 뒤에 남는다. mean_combo_check 는 그 조각
(潤 '불을 윤'의 어간 '불')을 계속 그 글자의 키워드로 보므로, 옛 훈으로 윤문된 문장('불꽃처럼…')을 자기 일치로
통과시킨다. 그래서 대표 훈을 바꾼 글자는 이 목록으로 손 대조한다 — /name 재생성 직후 돌려 고칠 문장을 뽑는다.
고치는 곳은 행마다 적힌 file·key 다(data/creative-name-meanings.json·combo-meanings.json·name-stories.json).

섹션 (규칙 원문은 --json 출력의 meta.rules 에도 실린다):
  yun_fire        1순위 조합에 潤이 든 이름의 mean·story 중 불 계열(tier 불) 또는 타오르 계열(tier 타오르)
  yun_fire_ref    潤이 2~4순위 조합에만 있는 이름의 같은 문장(참고). other_fire_glyphs(潤 말고 표시 글자 중
                  불·빛·따뜻 훈이 있는 글자)가 비어 있으면 潤 옛 훈 탓일 공산이 크다
  ha_burden_combo combo-meanings 의 荷 쌍 중 짐·짊어짐·무게·나르기·사명·책임 계열(tier 짐)과,
                  2026-10-22 에 荷 쌍 190개를 사람이 다 읽고 고른 경계 사례(tier 참고, HA_COMBO_REVIEW)
  ha_burden_text  '하'가 든 이름의 mean·story 중 같은 계열. 1순위가 荷가 아니어도 6월 윤문 때 荷 첫 훈을 썼을 수
                  있다 — ha_in_combos·hits 를 보고 걸러 읽을 것(石 '돌'의 무게처럼 다른 글자 뜻일 수도 있다)

사용 (저장소 루트에서):
  python scripts/audit_gloss_override_text.py                  # 요약 수치
  python scripts/audit_gloss_override_text.py --json OUT.json  # 전체 목록(이름·순위·pa·파일·키·현재 문장·이유)
  python scripts/audit_gloss_override_text.py --name-seo MIRROR/frontend/src/data/name-seo.json --today 2026-10-22
읽기만 한다. --json 출력은 저장소 밖(스크래치)에 두는 것을 권장한다.
"""
import argparse
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YUN = "潤"  # 潤
HA = "荷"  # 荷

FIRE_STRONG = re.compile(r"불꽃|불씨|불빛|불처럼|불을|불길|횃불|촛불|등불")
FIRE_VERB = re.compile(r"타오르|타올라|활활|데우")
# 짐·짊어짐(원 규칙) + 무게·나르기·사명·책임(2026-10-22 검증 S3-V1: '세상의 무게를'·'품어 나르는'·'사명을 지고' 누락)
BURDEN = re.compile(r"짊어|(?<!트러)짐을|(?<!트러)짐이|(?<!트러)짐도|무거운 짐|등에 얹|무게|나르|사명|책임")
# 다른 표시 글자의 훈이 불·빛·따뜻 계열인지 — 훈 낱말의 앞머리로 본다('울쑥불쑥할' 같은 중간 일치 제외)
FIRE_HUN_STEMS = ("불", "빛", "밝", "볕", "햇", "환할", "따뜻", "따스", "더울", "뜨거", "데울", "태울", "사를", "횃")
# 荷 쌍 190개를 다 읽고 BURDEN 에는 안 걸리지만 '멜 하'(메다·들다)에서 왔을 수 있는 쌍 (2026-10-22)
HA_COMBO_REVIEW = {
    "多荷": "'두 팔 가득 안은' — 메다·들다 훈일 수 있음",  # 多荷
    "荷柅": "'결실을 안아 든' — 메다·들다 훈일 수 있음",  # 荷柅
    "茶荷": "'차를 품어 전하는' — 메어 나르다 훈일 수 있음",  # 茶荷
    "禮荷": "'세상을 떠받드는' — 메다 훈일 수 있음",  # 禮荷
}

YUN_REASON = ("潤의 첫 훈이 '불을 윤'(붇다=불어나다의 뜻)이던 때 윤문돼 불(火)로 읽혔다. 潤은 물(水)·윤택의 글자이고 "
              "2026-10-22 대표 훈을 '윤택할 윤'으로 바꿨다. mean_combo_check 는 '불을 윤' 조각이 남아 어간 '불'을 "
              "潤 자신의 키워드로 보므로 이 모순을 자동으로 잡지 못한다 — 손으로 고칠 것")
YUN_REF_REASON = ("潤이 2~4순위 조합에만 있지만 문장이 불 계열이다. other_fire_glyphs 가 비어 있으면 潤 옛 훈('불을 윤') "
                  "말고는 근거가 없다 — 참고 등급, 읽고 판단")
HA_REASON = ("荷의 첫 훈이 '멜 하'(짐을 메다)이던 때 윤문된 '짊어지다·짐·무게·나르다·사명' 계열 뜻. 2026-10-22 대표 훈을 "
             "'연꽃 하'로 바꿔 카드 훈(연꽃)과 조합 뜻이 어긋난다")
HA_TEXT_REASON = ("하 음절 이름의 뜻·서사에 '짊어지다·짐·무게·나르다·사명' 계열이 나온다 — 荷 '멜 하' 훈에서 온 표현일 수 "
                  "있다(1순위가 荷가 아니어도 6월 윤문 때 荷 첫 훈을 썼을 수 있다). 다른 글자 뜻일 수도 있으니 hits 를 보고 판단")


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def has_fire_hun(meaning):
    for seg in re.split(r"[,/;·]", meaning or ""):
        words = seg.strip().split()
        if any(w.startswith(FIRE_HUN_STEMS) for w in words[:-1]):  # 마지막 낱말은 독음
            return True
    return False


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--name-seo", default=os.path.join(ROOT, "frontend", "src", "data", "name-seo.json"))
    ap.add_argument("--hanja-seo", default=os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json"))
    ap.add_argument("--today", default=date.today().isoformat(), help="공개 판정 기준일(pa 없음 또는 pa <= today)")
    ap.add_argument("--json", help="전체 목록 출력 경로")
    args = ap.parse_args()

    names = load(args.name_seo)["names"]
    hanja = load(args.hanja_seo)
    creative = load(os.path.join(ROOT, "data", "creative-name-meanings.json"))
    stories = load(os.path.join(ROOT, "data", "name-stories.json"))
    combo = load(os.path.join(ROOT, "data", "combo-meanings.json"))

    def public(r):
        pa = r.get("pa")
        return pa is None or pa <= args.today

    def source(n, r, field, text):
        if field == "story":
            return ("data/name-stories.json", n) if stories.get(n) == text else ("?", None)
        if creative.get(n) == text:
            return "data/creative-name-meanings.json", n
        top = "".join(r["combos"][0]) if r.get("combos") else None
        if top and combo.get(top) == text:
            return "data/combo-meanings.json", top
        return "?", None

    def row(n, r, field, text, **extra):
        f, key = source(n, r, field, text)
        out = {"name": n, "rank": r.get("rank"), "pa": r.get("pa"), "public": public(r),
               "top1": "".join(r["combos"][0]) if r.get("combos") else None,
               "combos": ["".join(c) for c in r.get("combos") or []],
               "field": field, "file": f, "key": key, "current": text}
        out.update(extra)
        return out

    def rank_key(x):
        return x["rank"] or 10**9

    yun, yun_ref = [], []
    for n, r in names.items():
        cb = r.get("combos") or []
        if not cb or not any(YUN in c for c in cb):
            continue
        in_top1 = YUN in cb[0]
        others = sorted({g for c in cb for g in c if g != YUN and has_fire_hun((hanja.get(g) or {}).get("m"))})
        for field in ("mean", "story"):
            text = r.get(field) or ""
            tier = "불" if FIRE_STRONG.search(text) else "타오르" if FIRE_VERB.search(text) else None
            if not tier:
                continue
            if in_top1:
                yun.append(row(n, r, field, text, tier=tier, reason=YUN_REASON))
            else:
                yun_ref.append(row(n, r, field, text, tier=tier, other_fire_glyphs=others,
                                   reason=YUN_REF_REASON))
    yun.sort(key=lambda x: (x["tier"] != "불", rank_key(x), x["field"]))
    yun_ref.sort(key=lambda x: (bool(x["other_fire_glyphs"]), rank_key(x), x["field"]))

    used = {}
    for n, r in names.items():
        for i, c in enumerate(r.get("combos") or []):
            used.setdefault("".join(c), []).append({"name": n, "rank": r.get("rank"), "pa": r.get("pa"),
                                                     "public": public(r), "pos": i + 1})
    ha_combo = []
    for pair, text in combo.items():
        if HA not in pair:
            continue
        hits = BURDEN.findall(text)
        if not hits and pair not in HA_COMBO_REVIEW:
            continue
        users = sorted(used.get(pair, []), key=rank_key)
        ha_combo.append({"pair": pair, "file": "data/combo-meanings.json", "key": pair, "current": text,
                         "tier": "짐" if hits else "참고", "hits": hits or [HA_COMBO_REVIEW[pair]],
                         "shown_in": users, "shown_public": any(u["public"] for u in users),
                         "top1_of": [u["name"] for u in users if u["pos"] == 1], "reason": HA_REASON})
    ha_combo.sort(key=lambda x: (x["tier"] != "짐", not x["shown_in"],
                                 min((rank_key(u) for u in x["shown_in"]), default=0), x["pair"]))

    ha_text = []
    for n, r in names.items():
        if "하" not in n:
            continue
        for field in ("mean", "story"):
            text = r.get(field) or ""
            hits = BURDEN.findall(text)
            if hits:
                ha_text.append(row(n, r, field, text, hits=hits,
                                   ha_in_combos=any(HA in c for c in r.get("combos") or []), reason=HA_TEXT_REASON))
    ha_text.sort(key=lambda x: (rank_key(x), x["field"]))

    def nm(rows, pred=lambda x: True):
        return len({x["name"] for x in rows if pred(x)})

    counts = {
        "yun_fire_names": nm(yun), "yun_fire_names_public": nm(yun, lambda x: x["public"]),
        "yun_fire_names_tier_bul": nm(yun, lambda x: x["tier"] == "불"),
        "yun_fire_names_tier_bul_public": nm(yun, lambda x: x["tier"] == "불" and x["public"]),
        "yun_fire_rows": len(yun),
        "yun_fire_ref_names": nm(yun_ref), "yun_fire_ref_names_public": nm(yun_ref, lambda x: x["public"]),
        "yun_fire_ref_rows": len(yun_ref), "yun_fire_ref_rows_public": sum(1 for x in yun_ref if x["public"]),
        "yun_fire_ref_no_other_fire_names": nm(yun_ref, lambda x: not x["other_fire_glyphs"]),
        "yun_fire_ref_no_other_fire_names_public": nm(yun_ref, lambda x: not x["other_fire_glyphs"] and x["public"]),
        "yun_fire_ref_no_other_fire_rows_public": sum(1 for x in yun_ref if not x["other_fire_glyphs"] and x["public"]),
        "ha_pairs_total": sum(1 for p in combo if HA in p),
        "ha_burden_pairs": sum(1 for x in ha_combo if x["tier"] == "짐"),
        "ha_burden_pairs_shown": sum(1 for x in ha_combo if x["tier"] == "짐" and x["shown_in"]),
        "ha_burden_pairs_shown_public": sum(1 for x in ha_combo if x["tier"] == "짐" and x["shown_public"]),
        "ha_burden_pairs_top1": sum(1 for x in ha_combo if x["tier"] == "짐" and x["top1_of"]),
        "ha_review_pairs": sum(1 for x in ha_combo if x["tier"] == "참고"),
        "ha_burden_text_rows": len(ha_text), "ha_burden_text_names": nm(ha_text),
        "ha_burden_text_names_public": nm(ha_text, lambda x: x["public"]),
    }
    print(json.dumps(counts, ensure_ascii=False, indent=1))
    if args.json:
        out = {"meta": {"name_seo": os.path.abspath(args.name_seo), "today_for_public": args.today,
                        "rules": {"yun_fire": "1순위 조합에 潤이 든 이름의 mean·story 중 " + FIRE_STRONG.pattern
                                              + " (tier 불) 또는 " + FIRE_VERB.pattern + " (tier 타오르)",
                                  "yun_fire_ref": "潤이 2~4순위 조합에만 있는 이름의 같은 문장. other_fire_glyphs = 潤 말고 "
                                                  "표시 글자 중 훈 낱말이 " + "|".join(FIRE_HUN_STEMS) + " 로 시작하는 글자",
                                  "ha_burden_combo": "combo-meanings 의 荷 쌍 중 " + BURDEN.pattern
                                                     + " (tier 짐) + 사람이 고른 " + " ".join(HA_COMBO_REVIEW) + " (tier 참고)",
                                  "ha_burden_text": "이름에 '하'가 든 이름의 mean·story 중 " + BURDEN.pattern},
                        "counts": counts},
               "yun_fire": yun, "yun_fire_ref": yun_ref, "ha_burden_combo": ha_combo, "ha_burden_text": ha_text}
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
