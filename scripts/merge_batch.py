#!/usr/bin/env python3
"""
hanja_core_v1.json 배치 병합 스크립트
새 배치를 기존 파일에 자동으로 검증·정제·병합합니다.

사용법:
  # 파일로 입력
  python scripts/merge_batch.py --new new_batch.json

  # 표준입력(붙여넣기) — 입력 후 Ctrl+Z (Windows) / Ctrl+D (Linux)
  python scripts/merge_batch.py
"""

import json
import re
import sys
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore

# ── 상수 ────────────────────────────────────────────────────────────────────

CORE_FILE = Path("data/hanja_core_v1.json")

ENGLISH_ELEMENTS = {
    "Wood": "木", "Fire": "火", "Earth": "土", "Metal": "金", "Gold": "金", "Water": "水"
}
VALID_ELEMENTS = {"木", "火", "土", "金", "水"}

# ── 정제 함수 ────────────────────────────────────────────────────────────────

def clean_rationale(text: str) -> str:
    """rationale 정제: markdown ** 제거, 부수 주석 정리"""
    # **강조** 마크다운 제거
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    # (이지만 의미상 X) 패턴 제거
    text = re.sub(r'\(이지만 의미상 [木火土金水]+\)', '', text)
    # 연속 공백 정리
    text = re.sub(r'  +', ' ', text).strip()
    return text


def fix_element(elem: str) -> str:
    """영문 오행 → 한자 변환"""
    return ENGLISH_ELEMENTS.get(elem, elem)


def normalize_entry(entry: dict) -> dict:
    """단일 항목 정제"""
    entry = dict(entry)
    entry["five_element"] = fix_element(entry.get("five_element", ""))
    if "rationale" in entry:
        entry["rationale"] = clean_rationale(entry["rationale"])
    if "confidence" not in entry:
        entry["confidence"] = "S"
    return entry


# ── 저장 함수 ────────────────────────────────────────────────────────────────

def save_oneline(data: list[dict], path: Path) -> None:
    """1행 1자 형식으로 저장"""
    lines = ["["]
    for i, e in enumerate(data):
        comma = "," if i < len(data) - 1 else ""
        line = json.dumps(e, ensure_ascii=False, separators=(", ", ": "))
        lines.append(f"  {line}{comma}")
    lines.append("]")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


# ── 메인 ────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="배치 병합 스크립트")
    parser.add_argument("--file", default=str(CORE_FILE), help="기존 Core Dataset 경로")
    parser.add_argument("--new", default=None, help="새 배치 JSON 파일 경로 (없으면 stdin)")
    parser.add_argument("--dry-run", action="store_true", help="실제 저장 없이 미리보기만")
    args = parser.parse_args()

    base_path = Path(args.file)
    if not base_path.exists():
        print(f"[ERR] 기존 파일 없음: {base_path}")
        sys.exit(1)

    # 기존 데이터 로드
    with open(base_path, encoding="utf-8") as f:
        existing: list[dict] = json.load(f)
    existing_set = {e["hanja"] for e in existing}

    # 새 배치 로드
    if args.new:
        src = Path(args.new).read_text(encoding="utf-8")
    else:
        print("새 배치 JSON을 붙여넣고 Ctrl+Z(Windows) / Ctrl+D(Linux) 로 종료:")
        src = sys.stdin.read()

    # JSON 추출 (앞뒤 텍스트 무시, [ ... ] 부분만)
    match = re.search(r'\[.*\]', src, re.DOTALL)
    if not match:
        print("[ERR] JSON 배열을 찾을 수 없습니다.")
        sys.exit(1)
    new_batch: list[dict] = json.loads(match.group())

    print(f"\n새 배치: {len(new_batch)}자")

    # ── 정제 ─────────────────────────────────────────────────────────────────
    cleaned: list[dict] = [normalize_entry(e) for e in new_batch]

    # 영문 오행 수정 보고
    for orig, fixed in zip(new_batch, cleaned):
        if orig.get("five_element") != fixed.get("five_element"):
            print(f"  [FIX] {fixed['hanja']}({fixed['hangul']}) "
                  f"five_element: '{orig['five_element']}' -> '{fixed['five_element']}'")

    # ── 중복 검사 ─────────────────────────────────────────────────────────────
    seen_in_batch: dict[str, int] = {}
    skip: set[str] = set()

    for i, e in enumerate(cleaned):
        h = e["hanja"]
        if h in seen_in_batch:
            print(f"  [SKIP] {h}({e['hangul']}) — 배치 내 중복 ({seen_in_batch[h]+1}번째)")
            skip.add(h + f"_{i}")  # 두 번째 이후만 스킵
        elif h in existing_set:
            print(f"  [SKIP] {h}({e['hangul']}) — 기존 파일에 이미 존재")
            skip.add(h + f"_{i}")
        else:
            seen_in_batch[h] = i

    # 실제 추가 목록 (배치 내 첫 등장 + 기존 미등록)
    to_add = [
        e for i, e in enumerate(cleaned)
        if e["hanja"] in seen_in_batch and seen_in_batch[e["hanja"]] == i
        and e["hanja"] not in existing_set
    ]

    print(f"\n제외: {len(new_batch) - len(to_add)}자 / 추가: {len(to_add)}자")
    print(f"병합 후 총: {len(existing) + len(to_add)}자")

    if args.dry_run:
        print("\n[dry-run] 저장하지 않음.")
        return

    # ── 병합 및 저장 ──────────────────────────────────────────────────────────
    merged = existing + to_add
    save_oneline(merged, base_path)
    print(f"\n[OK] {base_path} 저장 완료 ({len(merged)}자)")

    # ── 검증 실행 ─────────────────────────────────────────────────────────────
    print("\n검증 실행 중...")
    import subprocess
    result = subprocess.run(
        [sys.executable, "scripts/validate_core_dataset.py", "--file", str(base_path)],
        capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    print(result.stdout)
    if result.returncode != 0:
        print("[ERR] 검증 실패 — 수동 확인 필요")
        sys.exit(1)


if __name__ == "__main__":
    main()
