# -*- coding: utf-8 -*-
"""
인명용 한자 9,190 키의 총획수(data/hanja_strokes.json)를 Unicode 18.0 Unihan kTotalStrokes 에서 만든다 (자원오행 전환 S5c-3, 2026-10-22).

    python -I scripts/build_hanja_strokes.py            # 다시 쓰고 바뀐 글자를 보고한다(다시 돌려도 같은 바이트)
    python -I scripts/build_hanja_strokes.py --check    # 쓰지 않고 비교만 — 다르면 exit 1

입력 (읽기만 한다)
  - tmp/unihan-18.0/Unihan_IRGSources.txt   kTotalStrokes (unicode.org 공식 18.0, 2026-07-31 — scripts/extract_hanja_radicals.py 와 같은 파일)
  - data/hanja_dictionary_final.json         대상 = 등재 한자 키 9,190(통합 9,105 + 호환 85 — scripts/hanja_target_set.py)

출력
  - data/hanja_strokes.json   {글자: 총획수} — 대상 키 코드포인트 순, json.dumps(ensure_ascii=False) 한 줄(옛 파일과 같은 형식)

이 파일은 획수의 단일 원천이다(계획 docs/plan-radical-ohaeng-2026-10.md §5 '획수 출처 통일', D9).
  - 백엔드 HanjaData.ApplyStrokeCounts 가 StrokeCount 를 이 값으로 정하고 ApplyYinYangFromStrokes 가 음양을 그 홀짝으로 정한다(홀수 陽·짝수 陰).
  - scripts/build_hanja_seo_data.py 가 /hanja 의 s·y 를 같은 값·같은 규칙으로 만든다.
  S5c 전 백엔드 StrokeCount 는 hanja_unihan.json(kRSAdobe_Japan1_6 의 부수 획수 + 나머지 획수, 일본 자형)이라 /hanja 와 832자가 달랐다.

옛 파일(2026-05)은 18.0 이전 Unihan 의 kTotalStrokes 첫 값이었다. 그때 kTotalStrokes 는 값이 둘일 수 있었고 첫 값이 중국 간체 자형
기준이라(修 9·成 6·道 12·福 13·英 8) 296 키가 18.0 값(修 10·成 7·道 13·福 14·英 9 — 한국 자전 획수와 같은 쪽)과 달랐다.
18.0 의 kTotalStrokes 는 글자마다 값이 하나다(값이 둘 이상이면 중단한다). 18.0 도 한국 자전과 모두 같지는 않다 — 왼쪽 阝 를 2획으로 세는
글자가 많다(院 9·陳 10·陸 10, 한국 자전 10·11·11). 근거 비교(2026-10-22): 강희 원획과 자형 차이가 없는 부수(氵艹阝辶王礻衤忄扌犭月 등 제외)의
Core 1,279자에서 강희 획수와 같은 비율 — 18.0 92.9% · Adobe(옛 백엔드) 90.9% · 옛 파일(옛 /hanja) 90.0%. 원획법은 D10 별도 결정.

호환 한자 키는 그 코드포인트 자신의 kTotalStrokes 를 싣는다. 소비처는 통합 키 값을 쓰고, 통합 키에 값이 없을 때만 호환 키 값을 쓴다.
소스에 호환 한자를 글자로 쓰지 않는다(코드포인트 숫자만).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hanja_target_set  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
UNIHAN = ROOT / "tmp" / "unihan-18.0" / "Unihan_IRGSources.txt"
OUT = ROOT / "data" / "hanja_strokes.json"
EXPECT_VERSION = "# Unicode Version 18.0.0"


def read_total_strokes(path: Path) -> dict[int, int]:
    """Unihan_IRGSources.txt → {코드포인트: kTotalStrokes}. 버전 줄이 18.0 이 아니거나 값이 둘 이상이면 중단."""
    if not path.exists():
        raise SystemExit(f"[중단] {path} 없음 — Unihan 18.0 공식본(tmp/unihan-18.0/, gitignore)이 필요하다")
    strokes: dict[int, int] = {}
    version_ok = False
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                version_ok |= line.strip() == EXPECT_VERSION
                continue
            if "\tkTotalStrokes\t" not in line:
                continue
            cp, _, value = line.rstrip("\n").split("\t")
            parts = value.split()
            if len(parts) != 1:
                raise SystemExit(f"[중단] {cp} kTotalStrokes 값이 {len(parts)}개: {value!r} — 18.0 은 하나여야 한다")
            strokes[int(cp[2:], 16)] = int(parts[0])
    if not version_ok:
        raise SystemExit(f"[중단] {path} 의 버전 줄이 '{EXPECT_VERSION}' 이 아니다")
    return strokes


def build() -> tuple[str, dict[str, int]]:
    keys = hanja_target_set.target_keys()
    total = read_total_strokes(UNIHAN)
    missing = [k for k in keys if ord(k) not in total]
    if missing:
        raise SystemExit("[중단] kTotalStrokes 없는 대상 %d자: %s" % (
            len(missing), " ".join("U+%04X" % ord(k) for k in missing[:10])))
    data = {k: total[ord(k)] for k in keys}
    return json.dumps(data, ensure_ascii=False), data


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="data/hanja_strokes.json 빌드 (Unihan 18.0 kTotalStrokes)")
    ap.add_argument("--check", action="store_true", help="쓰지 않고 현재 파일과 비교만 (다르면 exit 1)")
    args = ap.parse_args()

    text, data = build()
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    changed = [(k, old.get(k), v) for k, v in data.items() if old.get(k) != v]
    unified = set(hanja_target_set.unified_keys(list(data)))
    print(f"대상 {len(data)}키(통합 {len(unified)}) · 옛 파일과 다른 키 {len(changed)}"
          f"(통합 {sum(1 for k, _, _ in changed if k in unified)})")
    for k, a, b in changed[:12]:
        print(f"  U+{ord(k):04X} {a} → {b}")
    if args.check:
        same = OUT.exists() and OUT.read_text(encoding="utf-8") == text
        print("일치" if same else "[불일치] 파일이 Unihan 18.0 kTotalStrokes 와 다르다 — --check 없이 다시 만들 것")
        return 0 if same else 1
    OUT.write_text(text, encoding="utf-8", newline="")
    print(f"→ {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
