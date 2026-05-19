#!/usr/bin/env python3
"""
hanja_core_v1.json 유효성 검사 스크립트
새 배치를 병합하기 전, 또는 전체 파일 검증에 사용합니다.

사용법:
  # 전체 파일 검증
  python scripts/validate_core_dataset.py

  # 새 배치 JSON을 기존 파일과 교차 검증
  python scripts/validate_core_dataset.py --new new_batch.json

  # 기존 파일 위치를 명시
  python scripts/validate_core_dataset.py --file data/hanja_core_v1.json
"""

import json
import sys
import re
import unicodedata
from pathlib import Path

# Windows 터미널 UTF-8 출력 강제
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore

# ── 상수 ────────────────────────────────────────────────────────────────────

VALID_ELEMENTS = {"木", "火", "土", "金", "水"}

ENGLISH_ELEMENTS = {
    "Wood": "木", "Fire": "火", "Earth": "土", "Metal": "金", "Gold": "金", "Water": "水"
}

# 오행별 rationale 키워드 (최소 1개 이상 포함 권장)
ELEMENT_KEYWORDS: dict[str, list[str]] = {
    "木": ["나무", "목", "초목", "풀", "싹", "꽃", "숲", "대나무", "竹", "艸", "艹",
           "木", "수풀", "식물", "뿌리", "가지", "씨앗", "생명력", "생장", "새싹",
           "매화", "소나무", "박달", "오동", "계명",
           # 추가: rationale 표현 패턴
           "자라", "곧게", "새 생명", "생명의", "이삭", "우거", "성장", "생동", "생동감", "벼", "생기",
           "새순", "온화", "감싸", "가르침", "나뭇잎", "나부",
           # 세분화: 인자·창의·유연 계열
           "인자", "창의", "곡직"],
    "火": ["불", "빛", "밝", "태양", "화", "열", "光", "火", "日", "灬",
           "빛나", "광채", "등불", "촛불", "햇살", "노을", "새벽", "작열",
           "찬란", "빛살", "뜨겁", "솟구", "상승", "밝히", "빛의",
           # 추가: rationale 표현 패턴
           "양기", "陽", "타오", "뜨거", "폭발", "타버", "발휘",
           # 세분화: 열정·화려·통달·발산·통찰·확산·광대·완성·깨우 계열
           "열정", "화려", "통달", "발산", "통찰", "확산", "광대", "완성", "깨우",
           "헌신", "전진", "계승"],
    "土": ["땅", "토", "대지", "흙", "산", "山", "기틀", "터", "중앙",
           "포용", "土", "岱", "坤", "丘", "堯", "웅장", "든든", "안정",
           "중심", "경계", "성군", "바위", "묵직",
           # 세분화: 신용·수용·비옥·완충 계열
           "신용", "수용", "비옥", "완충", "인내"],
    "金": ["금", "쇠", "금속", "보석", "옥", "칼", "단단", "결단", "수렴",
           "金", "玉", "石", "貝", "은", "동", "철", "도끼", "칼날",
           "절제", "정밀", "결실", "가을", "서늘",
           # 추가: rationale 표현 패턴
           "정돈", "정갈", "정교", "자리", "깎아", "안착", "확립", "지조", "규율", "격식", "예리", "날카", "강제",
           "저울", "공정",
           # 세분화: 강건·규칙·숙살·변혁 계열
           "강건", "규칙", "숙살", "변혁", "한정", "확정"],
    "水": ["물", "수", "강", "호수", "바다", "흐", "氵", "물가", "비",
           "이슬", "샘", "연못", "시냇", "냇", "강물", "水", "雨",
           "맑", "깨끗", "유연", "지혜", "깊", "흘러",
           # 세분화: 침잠·응축·순응·친화 계열
           "침잠", "응축", "순응", "친화", "은밀"],
}

KANGXI_MIN = 1
KANGXI_MAX = 64  # 한자 최대 강희획수

# ── 헬퍼 ────────────────────────────────────────────────────────────────────

def is_hangul(ch: str) -> bool:
    return '\uAC00' <= ch <= '\uD7A3' or '\u3131' <= ch <= '\u318E'

def is_hanja(ch: str) -> bool:
    cp = ord(ch)
    return (0x4E00 <= cp <= 0x9FFF or  # CJK Unified Ideographs
            0x3400 <= cp <= 0x4DBF or  # CJK Extension A
            0xF900 <= cp <= 0xFAFF or  # CJK Compatibility Ideographs
            0x20000 <= cp <= 0x2A6DF)  # CJK Extension B

# ── 검증 함수 ────────────────────────────────────────────────────────────────

def validate_entries(entries: list[dict], label: str,
                     existing_hanja: set[str] | None = None) -> tuple[int, int]:
    """
    entries: 검증할 JSON 배열
    label: 출력에 표시할 파일/배치 이름
    existing_hanja: 교차 중복 검사용 기존 한자 집합 (None이면 건너뜀)
    Returns: (errors, warnings)
    """
    errors = 0
    warnings = 0
    seen_in_batch: dict[str, int] = {}  # hanja → 배치 내 첫 인덱스

    print(f"\n{'='*60}")
    print(f"  {label}  ({len(entries)}자)")
    print(f"{'='*60}")

    for i, entry in enumerate(entries):
        hanja   = entry.get("hanja", "")
        hangul  = entry.get("hangul", "")
        elem    = entry.get("five_element", "")
        strokes = entry.get("kangxi_strokes")
        rationale = entry.get("rationale", "")
        tag = f"[{i+1:3d}] {hanja}({hangul})"

        issues: list[tuple[str, str]] = []  # (level, message)

        # ── 1. 영문 오행 감지 ─────────────────────────────────────────────
        if elem in ENGLISH_ELEMENTS:
            correct = ENGLISH_ELEMENTS[elem]
            issues.append(("ERROR", f"five_element='{elem}' → 한자로 변환 필요: '{correct}'"))
            errors += 1
        elif elem not in VALID_ELEMENTS:
            issues.append(("ERROR", f"five_element='{elem}' → 유효하지 않은 값 (木/火/土/金/水 중 하나)"))
            errors += 1

        # ── 2. hanja/hangul 순서 뒤바뀜 감지 ────────────────────────────
        if hanja and all(is_hangul(c) for c in hanja if c.strip()):
            issues.append(("ERROR", "hanja 필드에 한글만 있음 → hanja/hangul 순서 뒤바뀜 의심"))
            errors += 1
        if hangul and all(is_hanja(c) for c in hangul if c.strip()):
            issues.append(("ERROR", "hangul 필드에 한자만 있음 → hanja/hangul 순서 뒤바뀜 의심"))
            errors += 1

        # ── 3. 배치 내 중복 한자 ─────────────────────────────────────────
        if hanja in seen_in_batch:
            issues.append(("WARN", f"배치 내 중복 → {seen_in_batch[hanja]+1}번째에 이미 등장"))
            warnings += 1
        else:
            seen_in_batch[hanja] = i

        # ── 4. 기존 파일과 교차 중복 ─────────────────────────────────────
        if existing_hanja is not None and hanja in existing_hanja:
            issues.append(("WARN", "기존 파일에 이미 존재하는 한자 (중복 추가 대상)"))
            warnings += 1

        # ── 5. 강희획수 유효성 ────────────────────────────────────────────
        if strokes is None:
            issues.append(("WARN", "kangxi_strokes 필드 누락"))
            warnings += 1
        elif not isinstance(strokes, int):
            issues.append(("ERROR", f"kangxi_strokes='{strokes}' → 정수가 아님"))
            errors += 1
        elif strokes < KANGXI_MIN or strokes > KANGXI_MAX:
            issues.append(("ERROR", f"kangxi_strokes={strokes} → 범위 초과 ({KANGXI_MIN}~{KANGXI_MAX})"))
            errors += 1

        # ── 6. 오행-Rationale 일치성 ─────────────────────────────────────
        if elem in ELEMENT_KEYWORDS and rationale:
            keywords = ELEMENT_KEYWORDS[elem]
            if not any(kw in rationale for kw in keywords):
                issues.append(("WARN",
                    f"five_element={elem} 인데 rationale에 관련 키워드 없음\n"
                    f"          rationale: {rationale[:60]}"))
                warnings += 1

        # ── 7. rationale 필드 누락 ────────────────────────────────────────
        if not rationale:
            issues.append(("WARN", "rationale 필드 누락"))
            warnings += 1

        # 출력
        if issues:
            print(f"  {tag}")
            for level, msg in issues:
                icon = "[ERR]" if level == "ERROR" else "[WRN]"
                print(f"    {icon} {msg}")

    ok_count = len(entries) - len(seen_in_batch) + len(seen_in_batch) - errors
    print(f"\n  결과: [ERR] 오류 {errors}건  [WRN] 경고 {warnings}건  [OK] 정상 {len(entries)-errors-warnings}건")
    return errors, warnings


def load_json(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── 메인 ────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="hanja_core_v1.json 유효성 검사")
    parser.add_argument("--file", default="data/hanja_core_v1.json",
                        help="기존 Core Dataset 파일 경로")
    parser.add_argument("--new", default=None,
                        help="새 배치 JSON 파일 (기존 파일과 교차 검증)")
    args = parser.parse_args()

    base_path = Path(args.file)
    if not base_path.exists():
        print(f"파일을 찾을 수 없습니다: {base_path}")
        sys.exit(1)

    total_errors = 0
    total_warnings = 0

    if args.new:
        # 교차 검증 모드: 기존 파일 로드 후 새 배치만 검증
        existing_data = load_json(base_path)
        existing_hanja = {e.get("hanja", "") for e in existing_data}
        new_data = load_json(Path(args.new))

        e, w = validate_entries(new_data, f"새 배치: {args.new}", existing_hanja)
        total_errors += e
        total_warnings += w
    else:
        # 전체 파일 검증 모드
        data = load_json(base_path)
        e, w = validate_entries(data, f"전체 파일: {base_path}")
        total_errors += e
        total_warnings += w

    print(f"\n{'='*60}")
    print(f"  최종: [ERR] 오류 {total_errors}건  [WRN] 경고 {total_warnings}건")
    print(f"{'='*60}\n")

    if total_errors > 0:
        sys.exit(1)  # CI에서 오류 시 빌드 실패 처리 가능


if __name__ == "__main__":
    main()
