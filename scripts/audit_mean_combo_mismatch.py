#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/name 대표 뜻(mean)·서사(story) ↔ 표시 한자 조합(combos) 불일치 전수 감사.

판정 규칙은 scripts/mean_combo_check.py(빌드와 공용) 참고. 요약:
  noun strict — 문장에 나온 구체 명사 훈(비·연꽃·별·으뜸)이 페이지 어느 조합에도 없는 한자의 것 → 모순
  noun top1   — 그 한자가 2~4순위 조합에만 있음 → 1순위와 어긋남(모순은 아님)
  adj         — 맑·밝·빛나 같은 흔한 수식어 어간 일치 → 참고(동음 한자 여럿이 공유)

build_name_seo_data.py는 mean이 noun strict이면 1순위 조합 뜻으로 폴백하므로, 재생성 직후
mean noun strict는 0이어야 한다(조합 폴백 뜻은 정의상 1순위와 일치해 판정에서 뺀다).
story는 사람 서사형 비유 문장이라 '옥처럼·별처럼' 같은 일반 비유가 걸린다 — 참고 수치로만 본다.

사용:
  python scripts/audit_mean_combo_mismatch.py            # 요약 + noun strict 목록
  python scripts/audit_mean_combo_mismatch.py --top1     # noun top1 목록까지
  python scripts/audit_mean_combo_mismatch.py --tsv out.tsv
  python scripts/audit_mean_combo_mismatch.py --fail     # mean noun strict 1건 이상이면 exit 1
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mean_combo_check import HanjaIndex, find_mismatches  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
NAME_SEO = os.path.join(ROOT, "frontend", "src", "data", "name-seo.json")
HANJA_SEO = os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--top1", action="store_true", help="noun top1(2~4순위에만 있는 한자) 목록도 출력")
    ap.add_argument("--tsv", help="전체 판정 TSV 출력 경로")
    ap.add_argument("--fail", action="store_true", help="mean noun strict가 있으면 exit 1")
    ap.add_argument("--published-only", action="store_true", help="드립 미공개(pa) 이름 제외")
    args = ap.parse_args()

    seo = json.load(open(NAME_SEO, encoding="utf-8"))
    names, combo_means = seo["names"], seo.get("comboMeans", {})
    idx = HanjaIndex(json.load(open(HANJA_SEO, encoding="utf-8")))

    rows = []
    for name, rec in names.items():
        combos = rec.get("combos") or []
        if len(name) != 2 or not combos:
            continue
        if args.published_only and rec.get("pa"):
            continue
        mean = rec.get("mean") or ""
        mean_from_combo = bool(mean) and mean == combo_means.get("".join(combos[0]))
        for field, text in (("mean", mean), ("story", rec.get("story") or "")):
            if not text or (field == "mean" and mean_from_combo):
                continue
            for m in find_mismatches(name, text, combos, idx):
                rows.append({
                    "name": name, "field": field, "kind": m["kind"], "pos": m["pos"], "syl": m["syl"],
                    "strict": m["strict"], "top1": m["top1"], "text": text,
                    "hits": ";".join(f"{c}({'/'.join(k)})" for c, k in sorted(m["hits"].items())),
                    "shown": "".join(dict.fromkeys(m["shown"])),
                    "top": "".join(combos[0]),
                    "t": rec.get("t", 0), "pa": rec.get("pa", ""),
                })

    def uniq(field, kind, flag="strict"):
        return sorted({r["name"] for r in rows if r["field"] == field and r["kind"] == kind and r[flag]},
                      key=lambda n: -names[n].get("t", 0))

    print("판정 단위: 이름. noun = 구체 명사 훈(모순 확정), adj = 흔한 수식어 어간(참고)")
    for field in ("mean", "story"):
        for kind in ("noun", "adj"):
            s, t = uniq(field, kind), uniq(field, kind, "top1")
            print(f"[{field}/{kind}] strict {len(s)}명 / top1 {len(t)}명 (strict 포함)")

    def dump(field, flag, exclude_strict=False):
        seen = set()
        for r in sorted(rows, key=lambda r: (-r["t"], r["name"], r["pos"])):
            if r["field"] != field or r["kind"] != "noun" or not r[flag] or (r["name"], r["pos"]) in seen:
                continue
            if exclude_strict and r["strict"]:
                continue
            seen.add((r["name"], r["pos"]))
            pa = f" pa={r['pa']}" if r["pa"] else ""
            print(f"  {r['name']}({r['t']}{pa}) [{r['syl']}] 문장한자={r['hits']} 표시={r['shown']}"
                  f" 1순위={r['top']} | {r['text']}")

    for field in ("mean", "story"):
        print(f"\n== {field} noun strict (표시 조합 어디에도 없는 한자의 구체 뜻) ==")
        dump(field, "strict")
        if args.top1:
            print(f"\n== {field} noun top1 (strict 제외 — 2~4순위 조합에만 있는 한자의 뜻) ==")
            dump(field, "top1", exclude_strict=True)

    if args.tsv:
        with open(args.tsv, "w", encoding="utf-8") as f:
            cols = ["name", "field", "kind", "pos", "syl", "strict", "top1", "hits", "shown", "top", "t", "pa", "text"]
            f.write("\t".join(cols) + "\n")
            for r in rows:
                f.write("\t".join(str(r[c]) for c in cols) + "\n")
        print(f"\nTSV → {args.tsv}")

    if args.fail and uniq("mean", "noun"):
        sys.exit(1)


if __name__ == "__main__":
    main()
