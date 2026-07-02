# -*- coding: utf-8 -*-
"""
한자 SEO 페이지용 정적 데이터 빌드 스크립트.

data/ 의 한자 JSON 4종을 병합해 frontend/src/data/hanja-seo.json 을 생성한다.
오행 병합 우선순위는 백엔드 HanjaData.cs 와 동일:
  Tier 1: hanja_core_v1.json          (검수 오행, confidence 필드 → 보통 S)
  Tier 3: hanja_radical_element_map.json (의미 기반 자동, C)
  Tier 4: 획수 기반 fallback           (D) — 끝자리 1·2→木 3·4→火 5·6→土 7·8→金 9·0→水
음양: 획수 끝자리 홀수→陽, 짝수→陰 (CalculateYinYangFromStrokes 동일)

사용법:  python scripts/build_hanja_seo_data.py
출력:    frontend/src/data/hanja-seo.json + 검증 리포트(stdout)
"""

import json
import os
import re
import sys
from collections import Counter, defaultdict

HANGUL_SYLLABLE = re.compile(r"^[가-힣]$")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT_PATH = os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json")

STROKE_ELEMENT = {1: "木", 2: "木", 3: "火", 4: "火", 5: "土", 6: "土", 7: "金", 8: "金", 9: "水", 0: "水"}


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


def stroke_element(strokes):
    last = strokes % 10 if strokes >= 10 else strokes
    return STROKE_ELEMENT.get(last, "")


def stroke_yinyang(strokes):
    last = strokes % 10 if strokes >= 10 else strokes
    return "陰" if last % 2 == 0 else "陽"


def reorder_gloss(meaning, preferred):
    """대표 훈이 맨 앞에 오도록 재배열 — HanjaData.ReorderGloss(C#)와 동일 로직/구분자."""
    preferred = (preferred or "").strip()
    if not preferred:
        return meaning
    if not meaning or not meaning.strip():
        return preferred
    tokens = [t.strip() for t in re.split(r"[,/;·]", meaning) if t.strip()]
    if tokens and tokens[0] == preferred:
        return meaning
    if preferred in tokens:
        tokens.remove(preferred)
    tokens.insert(0, preferred)
    return ", ".join(tokens)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Windows cp949 콘솔 대응
    dictionary = load("hanja_dictionary_final.json")
    strokes_map = load("hanja_strokes.json")
    radical_map = load("hanja_radical_element_map.json")
    core_list = load("hanja_core_v1.json")
    core_map = {e["hanja"]: e for e in core_list}
    try:
        gloss_overrides = load("hanja-gloss-overrides.json")  # 대표 훈 오버라이드 (백엔드와 공유)
    except FileNotFoundError:
        gloss_overrides = {}

    out = {}
    grade_counter = Counter()
    readings_index = defaultdict(list)
    skipped_thin = []
    skipped_no_reading = []

    for char, entry in dictionary.items():
        # 원본에 "온,은"처럼 쉼표로 묶인 항목(863자)과 "nan" 오염값(𥡴)이 있어
        # 분리 후 한글 1음절만 독음으로 인정
        readings = []
        for raw in entry.get("readings_hangul") or []:
            for part in raw.split(","):
                part = part.strip()
                if HANGUL_SYLLABLE.match(part) and part not in readings:
                    readings.append(part)
        if not readings:
            skipped_no_reading.append(char)
            continue
        meaning = entry.get("meaning_ko") or None
        if meaning and char in gloss_overrides:
            meaning = reorder_gloss(meaning, gloss_overrides[char])
        strokes = strokes_map.get(char)
        is_gov = "gov" in (entry.get("sources") or [])

        element = grade = rationale = None
        if char in core_map:
            core = core_map[char]
            element = core.get("five_element")
            grade = core.get("confidence") or "S"
            rationale = core.get("rationale")
        elif char in radical_map and radical_map[char].get("five_element"):
            rad = radical_map[char]
            element = rad["five_element"]
            grade = "C"
            rationale = rad.get("rationale")
        elif strokes:
            element = stroke_element(strokes)
            grade = "D"
            rationale = f"획수 {strokes}획 기반 자동 판정"

        yinyang = stroke_yinyang(strokes) if strokes else None

        record = {"r": readings}
        if meaning:
            record["m"] = meaning
        if strokes:
            record["s"] = strokes
        if element:
            record["e"] = element
            record["g"] = grade
        if rationale:
            record["w"] = rationale
        if yinyang:
            record["y"] = yinyang
        if is_gov:
            record["gov"] = 1
        out[char] = record

        grade_counter[grade or "-"] += 1
        for r in readings:
            readings_index[r].append(char)
        if not (meaning and strokes):
            skipped_thin.append(char)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(OUT_PATH) / 1024 / 1024
    detail_pages = len(out) - len(skipped_thin)

    print("=== hanja-seo.json 빌드 리포트 ===")
    print(f"총 글자: {len(out)}")
    print(f"출력 크기: {size_mb:.2f} MB → {OUT_PATH}")
    print(f"오행 등급 분포: {dict(sorted(grade_counter.items()))}")
    print(f"고유 독음 수: {len(readings_index)}")
    print(f"상세 페이지 대상 (뜻+획수 보유): {detail_pages}")
    print(f"목록 전용 (뜻/획수 미비 → 페이지 미생성): {len(skipped_thin)}")
    if skipped_no_reading:
        print(f"제외 (유효 독음 없음): {len(skipped_no_reading)}자 — {''.join(skipped_no_reading[:10])}")
    print(f"인명용(gov): {sum(1 for v in out.values() if v.get('gov'))}")

    core_missing = [c for c in core_map if c not in dictionary]
    if core_missing:
        print(f"[경고] core_v1에만 있고 사전에 없는 글자 {len(core_missing)}자: {''.join(core_missing[:20])}...")

    return 0


if __name__ == "__main__":
    sys.exit(main())
