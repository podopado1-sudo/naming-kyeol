# -*- coding: utf-8 -*-
"""음절 점유 아티팩트 감사 — combos에서 각 한자가 점유한 쌍 수와 첫 훈을 나열한다.

배경(2026-07-02): 貨(재물 화)가 화 음절 8쌍(평화=平貨!), 暈(무리 훈)이 훈/운 음절
55쌍을 점수 아티팩트로 점유하고 있었음. 어색한 훈의 글자가 특정 음절 상위를
점유하는 케이스를 정기적으로 찾기 위한 감사 도구.

출력: 점유 쌍 수 내림차순 TSV — char, first_gloss, pair_count, sample_names, is_weak
      (weak/불용 글자도 soft-yield로 남을 수 있어 함께 표시 — 대안 부족 음절 파악용)

사용: python scripts/audit_syllable_occupancy.py [--min-pairs 2] [--outfile PATH]
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPLIT_RE = re.compile(r"[,/;·]")

sys.path.insert(0, str(ROOT / "scripts"))
from scan_weak_name_candidates import extract_charset_from_cs  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-pairs", type=int, default=2, help="이 쌍 수 이상 점유한 글자만")
    ap.add_argument("--outfile", default="syllable_occupancy.tsv")
    args = ap.parse_args()

    ns = json.loads((ROOT / "frontend" / "src" / "data" / "name-seo.json").read_text(encoding="utf-8"))
    dic = json.loads((ROOT / "data" / "hanja_dictionary_final.json").read_text(encoding="utf-8"))
    meanings = json.loads((ROOT / "data" / "hanja_meanings.json").read_text(encoding="utf-8"))
    try:
        overrides = json.loads((ROOT / "data" / "hanja-gloss-overrides.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        overrides = {}

    hanja_data_cs = ROOT / "Application" / "Engines" / "Data" / "HanjaData.cs"
    weak = extract_charset_from_cs(hanja_data_cs, "WeakGivenNameHanjaSet = new")

    count = defaultdict(int)
    samples = defaultdict(list)
    for name, info in ns.get("names", {}).items():
        for pair in info.get("combos") or []:
            for ch in pair:
                count[ch] += 1
                if len(samples[ch]) < 4:
                    samples[ch].append(name + "=" + "".join(pair))

    def first_gloss(ch):
        if ch in overrides:
            return overrides[ch]
        m = meanings.get(ch) or (dic.get(ch) or {}).get("meaning_ko") or ""
        toks = [t.strip() for t in SPLIT_RE.split(m) if t.strip()]
        return toks[0] if toks else "(뜻 없음)"

    rows = [
        (ch, first_gloss(ch), n, " ".join(samples[ch]), ch in weak)
        for ch, n in count.items()
        if n >= args.min_pairs
    ]
    rows.sort(key=lambda r: -r[2])

    out = Path(args.outfile)
    with out.open("w", encoding="utf-8", newline="") as f:
        f.write("char\tfirst_gloss\tpairs\tsamples\tis_weak\n")
        for r in rows:
            f.write("\t".join(str(int(v)) if isinstance(v, bool) else str(v) for v in r) + "\n")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(f"{out}: {len(rows)}자 (전체 점유 글자 {len(count)}, min-pairs={args.min_pairs})")


if __name__ == "__main__":
    main()
