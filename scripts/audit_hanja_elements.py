# -*- coding: utf-8 -*-
"""
자원오행 대조 감사 — 백엔드가 쓰는 글자별 자원오행 ↔ 결과 파일 ↔ /hanja 데이터 (부수 기준 자원오행 전환 S4, 2026-10-22).

    dotnet run -- dump-hanja-elements OUT.json
    python -I scripts/audit_hanja_elements.py --dump OUT.json [--hanja-seo PATH] [--max-list 20]

대조 (계획 docs/plan-radical-ohaeng-2026-10.md §2-6 보증 장치 — 전환 전에는 백엔드 ↔ hanja-seo 1,718자가 어긋났다)
  A  dump ↔ data/hanja_resource_element.json 통합 한자 키(compat_of 없는 키): 글자 집합 · e · g · radical
  B  dump ↔ hanja-seo.json(기본 frontend/src/data/hanja-seo.json): 글자 집합 · e · g · c(Core 데이터)
     hanja-seo.json 이 S4 전 형식(g 가 S·C·D)이면 B 는 '옛 형식'으로 보고하고 실패로 치지 않는다 — S6 재생성 뒤에 0 이어야 한다
불일치가 있으면 exit 1. 읽기만 한다.
"""

import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULT = os.path.join(ROOT, "data", "hanja_resource_element.json")
HANJA_SEO = os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json")
NEW_GRADES = {"R", "V", "X", "U"}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def cp(ch):
    return "U+%04X" % ord(ch)


def compare(label, dump, other, fields, max_list):
    """dump·other: 글자 → {필드: 값}. 반환: 불일치 수."""
    only_dump = sorted(set(dump) - set(other), key=ord)
    only_other = sorted(set(other) - set(dump), key=ord)
    diffs = {f: [] for f in fields}
    for ch in sorted(set(dump) & set(other), key=ord):
        for f in fields:
            if dump[ch].get(f) != other[ch].get(f):
                diffs[f].append(ch)
    n = len(only_dump) + len(only_other) + len({c for v in diffs.values() for c in v})
    print("[%s] 글자 %d ↔ %d · 백엔드에만 %d · 상대에만 %d · %s → 불일치 %d자" % (
        label, len(dump), len(other), len(only_dump), len(only_other),
        " · ".join("%s %d" % (f, len(v)) for f, v in diffs.items()), n))
    for name, xs in (("백엔드에만", only_dump), ("상대에만", only_other)):
        if xs:
            print("  %s: %s" % (name, " ".join("%s(%s)" % (c, cp(c)) for c in xs[:max_list])))
    for f, xs in diffs.items():
        for c in xs[:max_list]:
            print("  %s %s(%s): 백엔드 %r · 상대 %r" % (f, c, cp(c), dump[c].get(f), other[c].get(f)))
    return n


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="자원오행 대조 감사 (백엔드 dump ↔ 결과 파일 ↔ hanja-seo.json)")
    ap.add_argument("--dump", required=True, help="dotnet run -- dump-hanja-elements 출력")
    ap.add_argument("--result", default=RESULT)
    ap.add_argument("--hanja-seo", default=HANJA_SEO)
    ap.add_argument("--max-list", type=int, default=20)
    args = ap.parse_args()

    dump = load(args.dump)["chars"]
    # 백엔드는 미상(U)을 빈 문자열로 싣는다 — 결과 파일·hanja-seo 의 null/생략과 같게 None 으로 맞춘다
    norm = {c: {"e": v.get("e") or None, "g": v.get("g"), "radical": v.get("radical") or None, "c": v.get("c") or None}
            for c, v in dump.items()}

    result = load(args.result)["chars"]
    unified = {c: {"e": v.get("e"), "g": v.get("g"), "radical": v.get("radical")}
               for c, v in result.items() if not v.get("compat_of")}
    bad = compare("A 결과 파일", norm, unified, ("e", "g", "radical"), args.max_list)

    if os.path.exists(args.hanja_seo):
        seo = load(args.hanja_seo)
        if not any(v.get("g") in NEW_GRADES for v in seo.values()):
            old = {c: v.get("e") for c, v in seo.items()}
            mism = sum(1 for c in norm if c not in old or old[c] != norm[c]["e"]) + sum(1 for c in old if c not in norm)
            print("[B hanja-seo] S4 전 형식(g = S·C·D) — 오행 기준이 달라 대조하지 않는다(참고: e 다른 글자 %d). "
                  "S6 에서 build_hanja_seo_data.py 로 다시 만든 뒤 0 이어야 한다" % mism)
        else:
            s = {c: {"e": v.get("e"), "g": v.get("g"), "c": v.get("c")} for c, v in seo.items()}
            bad += compare("B hanja-seo", norm, s, ("e", "g", "c"), args.max_list)
    else:
        print("[B hanja-seo] 파일 없음 — 생략: %s" % args.hanja_seo)

    print("결과: %s" % ("불일치 0" if bad == 0 else "불일치 %d" % bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
