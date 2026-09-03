# -*- coding: utf-8 -*-
"""조합 회귀 통합 감사 — weak/불용 추가 후 재생성 결과를 원커맨드로 검증한다.

2026-07-02 대수술 세션에서 수작업으로 하던 검증을 루틴화한 것.
weak/불용 추가 → dump-name-combos → build_name_seo_data.py 직후 실행:

  A combos 소실   — base 시점에 combos 있던 이름이 현재 잃음        → FAIL
  B 불용 잔존     — 현재 combos에 ForbiddenNameHanjaSet 글자 등장    → FAIL
  C 뜻 커버리지   — 모든 combos 쌍이 comboMeans에 존재 (코드포인트   → FAIL
                    단위 — dump-combo-glosses의 아스트랄 누락 함정 회피)
  D 유일-약자 붕괴 — HanjaSelector 풀 게이팅(common 있으면 common만)  → FAIL
                    재현: 독음별 common 후보가 비어있지 않은데 전원 weak
  E 두더지 diff   — base 대비 새로 승격된 글자 목록(검수 대상, 정보)

사용: python scripts/audit_combo_regressions.py [--base HEAD] [--max-list 30]
종료 코드: A~D 중 FAIL 있으면 1 (E는 정보 — weak 승격은 ⚠ 표시만).
점유 상세가 필요하면 audit_syllable_occupancy.py 로 TSV를 뽑아 검수한다.
"""
import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPLIT_RE = re.compile(r"[,/;·]")
NAME_SEO_REL = "frontend/src/data/name-seo.json"

sys.path.insert(0, str(ROOT / "scripts"))
from scan_weak_name_candidates import extract_charset_from_cs  # noqa: E402


def load_base_name_seo(ref: str):
    """git show <ref>:name-seo.json — 실패 시 None (A/E 스킵)."""
    try:
        r = subprocess.run(
            ["git", "show", f"{ref}:{NAME_SEO_REL}"],
            cwd=ROOT, capture_output=True, check=True,
        )
        return json.loads(r.stdout.decode("utf-8"))
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def combo_chars(ns) -> dict:
    """combos에 등장하는 글자 → 점유 쌍 수/샘플."""
    count = defaultdict(int)
    samples = defaultdict(list)
    for name, info in ns.get("names", {}).items():
        for pair in info.get("combos") or []:
            for ch in pair:
                count[ch] += 1
                if len(samples[ch]) < 3:
                    samples[ch].append(name + "=" + "".join(pair))
    return {"count": count, "samples": samples}


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="HEAD", help="비교 기준 git 리비전 (기본 HEAD)")
    ap.add_argument("--max-list", type=int, default=30, help="상세 나열 상한")
    args = ap.parse_args()

    ns = json.loads((ROOT / NAME_SEO_REL).read_text(encoding="utf-8"))
    hs = json.loads((ROOT / "frontend" / "src" / "data" / "hanja-seo.json").read_text(encoding="utf-8"))
    dic = json.loads((ROOT / "data" / "hanja_dictionary_final.json").read_text(encoding="utf-8"))
    meanings = json.loads((ROOT / "data" / "hanja_meanings.json").read_text(encoding="utf-8"))
    try:
        overrides = json.loads((ROOT / "data" / "hanja-gloss-overrides.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        overrides = {}

    cs = ROOT / "Application" / "Engines" / "Data" / "HanjaData.cs"
    weak = extract_charset_from_cs(cs, "WeakGivenNameHanjaSet = new")
    forbidden = extract_charset_from_cs(cs, "ForbiddenNameHanjaSet = new")
    common_set = extract_charset_from_cs(cs, "CommonNameHanja = new")

    def first_gloss(ch):
        if ch in overrides:
            return overrides[ch]
        m = meanings.get(ch) or (dic.get(ch) or {}).get("meaning_ko") or ""
        toks = [t.strip() for t in SPLIT_RE.split(m) if t.strip()]
        return toks[0] if toks else "(뜻 없음)"

    base = load_base_name_seo(args.base)
    cur = combo_chars(ns)
    fails = []
    print(f"=== 조합 회귀 감사 (base: {args.base}{'' if base else ' — 로드 실패, A/E 스킵'}) ===")

    # A. combos 소실
    if base is not None:
        lost = [
            n for n, info in base.get("names", {}).items()
            if (info.get("combos") or []) and n in ns["names"] and not (ns["names"][n].get("combos") or [])
        ]
        ok = not lost
        print(f"[{'✅' if ok else '❌'}] A combos 소실: {len(lost)}건" + (f" — {' '.join(lost[:args.max_list])}" if lost else ""))
        if not ok:
            fails.append("A")
        removed = [n for n in base.get("names", {}) if n not in ns["names"]]
        if removed:
            print(f"    ℹ 수록 자체가 빠진 이름 {len(removed)}건 (빈도 하한 변경 등): {' '.join(removed[:10])}")

    # F. 드립 pa 보존 — 재생성 실수(--baseline 누락 등)로 pa가 전멸/수록이 축소되면
    #    라이브 코호트 일괄 공개 또는 색인 페이지 404 사고가 된다 (2026-09-03 리뷰).
    if base is not None:
        base_pa = {n for n, r in base.get("names", {}).items() if r.get("pa")}
        cur_pa = {n for n, r in ns["names"].items() if r.get("pa")}
        f_fails = []
        if base_pa and not cur_pa:
            f_fails.append(f"pa 전멸 (base {len(base_pa)}개 → 0개)")
        removed_names = [n for n in base.get("names", {}) if n not in ns["names"]]
        if removed_names:
            f_fails.append(f"수록 소실 {len(removed_names)}건 — 색인 페이지 404 위험: {' '.join(removed_names[:8])}")
        ok = not f_fails
        print(f"[{'✅' if ok else '❌'}] F 드립 pa 보존: base {len(base_pa)} → 현재 {len(cur_pa)}"
              + (f" — {' / '.join(f_fails)}" if f_fails else ""))
        if not ok:
            fails.append("F")

    # B. 불용 글자 잔존
    bad = sorted(ch for ch in cur["count"] if ch in forbidden)
    ok = not bad
    print(f"[{'✅' if ok else '❌'}] B 불용 잔존: {len(bad)}자"
          + (f" — {' '.join(f'{c}({first_gloss(c)})' for c in bad[:args.max_list])}" if bad else ""))
    if not ok:
        fails.append("B")

    # C. comboMeans 커버리지 (코드포인트 단위)
    combo_means = ns.get("comboMeans", {})
    missing = set()
    total_pairs = set()
    for info in ns["names"].values():
        for pair in info.get("combos") or []:
            key = "".join(pair)
            total_pairs.add(key)
            if key not in combo_means:
                missing.add(key)
    ok = not missing
    print(f"[{'✅' if ok else '❌'}] C comboMeans 커버리지: {len(total_pairs) - len(missing)}/{len(total_pairs)}쌍"
          + (f" — 누락 {' '.join(sorted(missing)[:args.max_list])}" if missing else " (100%)"))
    if not ok:
        fails.append("C")

    # D. 빈출셋 유일-약자 붕괴 — HanjaSelector.TopComboCandidates 필터 재현:
    #    FindByReading − 불용 − 뜻없음 − 획수0 → common 게이트(common 있으면 common만 풀).
    by_reading = defaultdict(list)
    for ch, rec in hs.items():
        if ch in forbidden or not rec.get("m") or not rec.get("s"):
            continue
        for r in rec.get("r") or []:
            by_reading[r].append(ch)
    collapsed = []
    for r, chars in sorted(by_reading.items()):
        common = [c for c in chars if c in common_set]
        if common and all(c in weak for c in common):
            alt = sum(1 for c in chars if c not in weak and c not in common_set)
            collapsed.append((r, common, alt))
    ok = not collapsed
    print(f"[{'✅' if ok else '❌'}] D 빈출셋 유일-약자 붕괴: {len(collapsed)}건")
    for r, common, alt in collapsed[:args.max_list]:
        print(f"    ❌ '{r}': common 전원 weak {' '.join(f'{c}({first_gloss(c)})' for c in common)} — 게이트 밖 비약 대안 {alt}자")
    if not ok:
        fails.append("D")

    # E. 두더지 diff — 새로 승격된 글자 (검수 대상)
    if base is not None:
        prev_chars = set(combo_chars(base)["count"])
        promoted = sorted(set(cur["count"]) - prev_chars, key=lambda c: -cur["count"][c])
        n_weak = sum(1 for c in promoted if c in weak)
        print(f"[ℹ] E 신규 승격 글자: {len(promoted)}자 (weak {n_weak}자) — 아래 목록 두더지 검수 필요")
        for c in promoted[:args.max_list]:
            mark = " ⚠weak" if c in weak else ""
            print(f"    {c}({first_gloss(c)}) {cur['count'][c]}쌍{mark} — {' '.join(cur['samples'][c])}")
        if len(promoted) > args.max_list:
            print(f"    … 외 {len(promoted) - args.max_list}자 (--max-list로 확장)")

    print("---")
    if fails:
        print(f"결과: FAIL ({', '.join(fails)}) — 원인 해소 후 재실행")
        return 1
    print("결과: PASS — 점유 상세는 python scripts/audit_syllable_occupancy.py 로 TSV 확인")
    return 0


if __name__ == "__main__":
    sys.exit(main())
