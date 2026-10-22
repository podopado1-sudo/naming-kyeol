# -*- coding: utf-8 -*-
"""
data/hanja_dictionary_final.json 원본 깨짐(ND-4) 수리 — 멱등, 일회성.

원인
  이 사전을 만든 스크립트는 저장소에 없다(초기 커밋 d1e577d 부터 결과물만 있다). 원천인 data/data-gov.csv
  (대법원 인명용 한자표)는 독음이 둘 이상인 글자를 `"금,김",,091d1,金` 처럼 독음 칸 하나에 쉼표로 묶고
  초성 칸을 비워 둔다. 생성 스크립트가 이 칸을 나누지 않고 독음 하나로 받았고(readings_hangul ["금,김"]),
  빈 초성 칸은 pandas NaN 의 문자열 'nan' 으로 실었다(initial_consonants ["nan"]). 같은 꼴이 864항목이다
  (쉼표 독음 863 + 독음 자리에도 'nan' 이 든 𥡴 1).
  뜻(meaning_ko)은 네이버 자료(data-naver.csv, 글자 키 = hanja_meanings.json)에서 왔는데, 네이버는
  金·蘭·朗·廊·剆 을 KS X 1001 호환 한자 코드(U+F90A·U+F91F·U+F929·U+F928·U+2F821)로만 싣는다.
  그래서 통합 한자(U+91D1 등) 쪽은 gov 행만 남아 뜻이 비었다 → /hanja/金 404, 엔진 후보 탈락.

수리
  1. readings_hangul: 쉼표로 나눠 한글 1음절만 남기고('nan' 제거) 중복 제거·정렬 — 정상 항목과 같은 규칙
  2. initial_consonants: 독음 초성의 정렬 집합으로 다시 계산 — 된소리는 예사소리(정상 항목 규칙: 쌍→ㅅ, 끽→ㄱ)
  3. 뜻 없는 통합 한자에 NFKC 로 대응하는 호환 한자 항목이 뜻을 가졌으면 그 뜻·독음·출처(naver)를 합친다.
     호환 한자 항목 자체는 지우지 않는다 — 호환↔통합 병합은 로더(HanjaData)와 build_hanja_seo_data.py 가
     NFKC 정규화로 한다(다른 데이터 파일도 호환 코드를 키로 쓰기 때문).
  출력 형식은 원본과 같다(indent=2, ensure_ascii=False, 끝 줄바꿈 없음) — 바뀐 항목만 diff 에 나온다.
  수리 뒤 data-gov.csv 의 쉼표 독음 행마다 나눈 독음이 모두 그 글자의 독음에 들어 있는지 대조한다.

사용
  python -I scripts/repair_hanja_dictionary.py            # 수리·저장 + 리포트
  python -I scripts/repair_hanja_dictionary.py --check    # 고칠 항목이 남아 있으면 exit 1 (저장 안 함)
"""

import csv
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_PATH = os.path.join(ROOT, "data", "hanja_dictionary_final.json")
GOV_CSV = os.path.join(ROOT, "data", "data-gov.csv")

HANGUL_SYLLABLE = re.compile(r"^[가-힣]$")
CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
TENSE_TO_BASE = {"ㄲ": "ㄱ", "ㄸ": "ㄷ", "ㅃ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ"}


def choseong(syllable):
    cho = CHOSEONG[(ord(syllable) - 0xAC00) // 588]
    return TENSE_TO_BASE.get(cho, cho)


def split_readings(raw_list):
    out = set()
    for raw in raw_list or []:
        for part in raw.split(","):
            part = part.strip()
            if HANGUL_SYLLABLE.match(part):
                out.add(part)
    return sorted(out)


def compat_canonical(ch):
    """호환 한자이면 NFKC 통합 한자, 아니면 None (호환 블록의 통합 한자 12자는 정규형이 자기 자신)."""
    if len(ch) != 1:
        return None
    norm = unicodedata.normalize("NFKC", ch)
    return norm if norm != ch and len(norm) == 1 else None


def repair(dictionary):
    fixed_readings, fixed_consonants, merged = [], [], []
    for ch, entry in dictionary.items():
        readings = split_readings(entry.get("readings_hangul"))
        if readings != entry.get("readings_hangul"):
            entry["readings_hangul"] = readings
            fixed_readings.append(ch)
        consonants = sorted({choseong(r) for r in readings})
        if consonants != entry.get("initial_consonants"):
            entry["initial_consonants"] = consonants
            fixed_consonants.append(ch)

    compat_by_canonical = {}
    for ch in dictionary:
        canon = compat_canonical(ch)
        if canon:
            compat_by_canonical.setdefault(canon, []).append(ch)
    for canon, compats in compat_by_canonical.items():
        entry = dictionary.get(canon)
        if entry is None or entry.get("meaning_ko"):
            continue
        donors = [c for c in compats if dictionary[c].get("meaning_ko")]
        if not donors:
            continue
        donor = dictionary[donors[0]]
        entry["readings_hangul"] = sorted(set(entry["readings_hangul"]) | set(donor["readings_hangul"]))
        entry["initial_consonants"] = sorted({choseong(r) for r in entry["readings_hangul"]})
        sources = list(entry.get("sources") or [])
        for s in donor.get("sources") or []:
            if s not in sources:
                sources.append(s)
        entry["sources"] = sources
        entry["meaning_ko"] = donor["meaning_ko"]
        merged.append((canon, donors[0]))
    return fixed_readings, fixed_consonants, merged


def verify_against_gov(dictionary):
    """data-gov.csv 의 쉼표 독음 행이 모두 독음 목록으로 풀렸는지."""
    missing = []
    rows = 0
    with open(GOV_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if "," not in row["hangul"]:
                continue
            rows += 1
            entry = dictionary.get(row["hanja"])
            if entry is None:
                missing.append((row["hanja"], row["hangul"], "항목 없음"))
                continue
            for part in row["hangul"].split(","):
                if part.strip() not in entry["readings_hangul"]:
                    missing.append((row["hanja"], row["hangul"], part.strip()))
    return rows, missing


def broken_count(dictionary):
    return sum(
        1 for e in dictionary.values()
        if any("," in r or r == "nan" for r in e.get("readings_hangul") or [])
        or "nan" in (e.get("initial_consonants") or [])
    )


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    check_only = "--check" in sys.argv[1:]

    with open(DICT_PATH, encoding="utf-8") as f:
        dictionary = json.load(f)
    before = broken_count(dictionary)
    fixed_readings, fixed_consonants, merged = repair(dictionary)
    after = broken_count(dictionary)
    gov_rows, gov_missing = verify_against_gov(dictionary)

    print("=== hanja_dictionary_final.json 수리 리포트 ===")
    print(f"항목 {len(dictionary)} · 깨진 꼴(쉼표 독음/'nan') {before} → {after}")
    print(f"독음 정리 {len(fixed_readings)} · 초성 재계산 {len(fixed_consonants)}")
    for canon, donor in merged:
        print(f"뜻 병합: {canon}(U+{ord(canon):04X}) ← 호환 U+{ord(donor):04X} "
              f"'{dictionary[canon]['meaning_ko']}' 독음 {dictionary[canon]['readings_hangul']}")
    print(f"gov 쉼표 독음 행 {gov_rows} — 독음 누락 {len(gov_missing)}")
    for item in gov_missing[:10]:
        print("  누락:", item)

    changed = bool(fixed_readings or fixed_consonants or merged)
    if check_only:
        if changed:
            print("[check] 수리할 항목이 남아 있다 — 스크립트를 인자 없이 실행할 것")
            return 1
        print("[check] 수리 완료 상태")
        return 0 if not gov_missing else 1
    if changed:
        text = json.dumps(dictionary, ensure_ascii=False, indent=2)
        with open(DICT_PATH, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        print(f"저장: {DICT_PATH}")
    else:
        print("변경 없음 (이미 수리됨)")
    return 1 if gov_missing else 0


if __name__ == "__main__":
    sys.exit(main())
