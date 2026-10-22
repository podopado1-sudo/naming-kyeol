# -*- coding: utf-8 -*-
"""
한자 SEO 페이지용 정적 데이터 빌드 스크립트.

data/ 의 한자 JSON 을 병합해 frontend/src/data/hanja-seo.json 을 생성한다.

자원오행 (2026-10-22 S4 — 계획 docs/plan-radical-ohaeng-2026-10.md §2-6): 이 스크립트는 오행을 계산하지 않는다.
data/hanja_resource_element.json(scripts/build_resource_element.py — 부수 기준, 백엔드 HanjaData.ApplyResourceElements 와
같은 파일)의 통합 한자 키 값을 그대로 복사한다. 호환 한자 키(compat_of)는 쓰지 않는다(값이 통합 한자와 같다).
  e  자원오행 木火土金水            g  등급 R 확정 · V 이견 있음 · X 예외 적용 · U 미상 (S4 전: 뜻 기반 S·C, 획수 D)
  radical · radical_char · alt_radical(비면 생략) · alt_char · v_reasons · number · variant_of · variant_tie · note
     — 결과 파일과 같은 이름·값 (뜻은 그 파일 meta.fields)
  c  Core 데이터(hanja_core_v1.json) 글자면 1 — 옛 등급 S 에 기대던 정렬·판정(/hanja 정렬, mean_combo_check)이 쓴다
  mw 옛 뜻 기반 판정 문장(core_v1 → radical_map rationale — 옛 w). 오행 값(옛 e)은 싣지 않는다(D4 — 화면에 오행 둘 금지).
     옛 획수 대체 문장('획수 N획 기반 자동 판정')은 뜻 기반이 아니라 싣지 않는다
  (옛 w '오행 판정 근거'는 note 로 대체 — 화면 전환은 S7)
대조: dotnet run -- dump-hanja-elements OUT → python -I scripts/audit_hanja_elements.py --dump OUT (불일치 0 이어야 한다)

음양: 획수 끝자리 홀수→陽, 짝수→陰 (CalculateYinYangFromStrokes 동일)

호환 한자(U+F900~FAFF·U+2F800~ 중 NFKC 로 통합 한자에 대응하는 85자)는 통합 한자 항목에 병합하고
출력에서 뺀다 — HanjaData.MergeCompatibilityIdeographs(C#)와 같은 규칙(통합 쪽 값 우선, 빈 칸만 호환 쪽으로).
같은 글자가 두 코드로 실려 독음 페이지에 같은 모양 카드가 2장 뜨던 것(79쪽)과, 뜻이 호환 쪽에만 있던
金·蘭·朗·廊 의 통합 글자 상세 페이지가 없던 것(404)을 함께 없앤다.

사용법:  python scripts/build_hanja_seo_data.py [--out PATH]
출력:    frontend/src/data/hanja-seo.json(기본) + 검증 리포트(stdout)
"""

import argparse
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

HANGUL_SYLLABLE = re.compile(r"^[가-힣]$")

# 유니코드에 실제 등재된 한자 영역 (기본·확장A~H·호환). HanjaData.IsHanCodePoint(C#)와 동일.
# 대법원 인명용 한자표의 유니코드 미등재 글자 405자는 법원 자체 코드(a01b1 등)가 그대로
# 코드포인트로 변환돼 미할당 평면(U+A0xxx)·사용자 영역(U+F0xxx)에 실려 있다 — 폰트가
# 그리지 못하고 뜻·획수도 없어 카드가 빈 네모로 뜨므로 수록하지 않는다.
HAN_RANGES = (
    (0x3400, 0x4DBF),    # 확장 A
    (0x4E00, 0x9FFF),    # 기본
    (0xF900, 0xFAFF),    # 호환
    (0x20000, 0x2EBEF),  # 확장 B~F
    (0x2F800, 0x2FA1F),  # 호환 보충
    (0x30000, 0x323AF),  # 확장 G~H
)


def is_han_codepoint(char):
    if len(char) != 1:
        return False
    cp = ord(char)
    return any(lo <= cp <= hi for lo, hi in HAN_RANGES)


def to_unified(char):
    """호환 한자이면 NFKC 통합 한자, 아니면 그대로 (HanjaData.ToUnifiedHanja 와 같은 규칙)."""
    unified = unicodedata.normalize("NFKC", char)
    return unified if unified != char and is_han_codepoint(char) and is_han_codepoint(unified) else char


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT_PATH = os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json")



def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


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


def split_readings(entry):
    # 원본에 "온,은"처럼 쉼표로 묶인 항목과 "nan" 오염값이 있었다(2026-10-22 repair_hanja_dictionary.py 로 수리).
    # 다시 들어와도 안전하게 분리 후 한글 1음절만 독음으로 인정
    readings = []
    for raw in entry.get("readings_hangul") or []:
        for part in raw.split(","):
            part = part.strip()
            if HANGUL_SYLLABLE.match(part) and part not in readings:
                readings.append(part)
    return readings


# 결과 파일에서 그대로 복사하는 글자별 필드 (순서 = 출력 순서). alt_radical 은 빈 목록이면 생략한다.
RESOURCE_FIELDS = ("radical", "radical_char", "alt_radical", "alt_char", "v_reasons", "number", "variant_of", "variant_tie",
                   "note")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Windows cp949 콘솔 대응
    parser = argparse.ArgumentParser(description="hanja-seo.json 빌드")
    parser.add_argument("--out", default=OUT_PATH, help=f"출력 경로 (기본 {OUT_PATH})")
    out_path = parser.parse_args().out
    dictionary = load("hanja_dictionary_final.json")
    strokes_map = load("hanja_strokes.json")
    radical_map = load("hanja_radical_element_map.json")  # 옛 뜻 기반 판정 문장(mw)만 — 오행 값은 쓰지 않는다
    core_list = load("hanja_core_v1.json")
    core_map = {e["hanja"]: e for e in core_list}
    resource = load("hanja_resource_element.json")["chars"]  # 부수 기준 자원오행 (백엔드와 같은 파일)
    try:
        gloss_overrides = load("hanja-gloss-overrides.json")  # 대표 훈 오버라이드 (백엔드와 공유)
    except FileNotFoundError:
        gloss_overrides = {}
    gloss_overrides = {to_unified(k): v for k, v in gloss_overrides.items()}  # 출력 키는 통합 한자

    out = {}
    grade_counter = Counter()
    readings_index = defaultdict(list)
    skipped_thin = []
    skipped_no_reading = []
    skipped_non_han = []

    # 호환 한자 → 통합 한자 묶음 (통합 글자 키로 출력하고 호환 글자는 출력하지 않는다)
    compat_of = defaultdict(list)
    for char in dictionary:
        if is_han_codepoint(char) and to_unified(char) != char:
            compat_of[to_unified(char)].append(char)
    merged_compat = []
    missing_resource = []

    for char, entry in dictionary.items():
        if not is_han_codepoint(char):
            skipped_non_han.append(char)
            continue
        if to_unified(char) != char:
            if to_unified(char) in dictionary:
                continue  # 통합 한자 항목에서 병합
            # 통합 글자 항목이 없는 호환 글자 — 통합 글자 키로 옮겨 싣는다(현재 데이터엔 없음)
            char = to_unified(char)
        compats = [c for c in compat_of.get(char, []) if c != char]
        sources = [entry] + [dictionary[c] for c in compats]

        readings = []
        for e in sources:
            for r in split_readings(e):
                if r not in readings:
                    readings.append(r)
        if not readings:
            skipped_no_reading.append(char)
            continue
        meaning = next((e.get("meaning_ko") for e in sources if e.get("meaning_ko")), None)
        if char in gloss_overrides:
            # C# ReorderGloss 와 같이 뜻이 비어 있으면 대표 훈 자체를 뜻으로 쓴다
            meaning = reorder_gloss(meaning or "", gloss_overrides[char]) or None
        strokes = strokes_map.get(char) or next((strokes_map[c] for c in compats if strokes_map.get(c)), None)
        is_gov = any("gov" in (e.get("sources") or []) for e in sources)
        if compats:
            merged_compat.extend(compats)

        # 자원오행: 결과 파일의 통합 한자 키 값을 복사 (계산하지 않는다 — 백엔드 ApplyResourceElements 와 같은 원천)
        res = resource.get(char)
        if res is None or res.get("compat_of"):
            missing_resource.append(char)
            res = {"e": None, "g": "U"}
        # 옛 뜻 기반 판정 문장(mw): 통합 글자의 core → radical_map → 호환 글자의 radical_map (백엔드 MeaningRationale 과 같은 순서)
        radical_key = next((k for k in [char] + compats
                            if k in radical_map and radical_map[k].get("five_element")), None)
        meaning_rationale = None
        if char in core_map:
            meaning_rationale = core_map[char].get("rationale")
        elif radical_key:
            meaning_rationale = radical_map[radical_key].get("rationale")

        yinyang = stroke_yinyang(strokes) if strokes else None

        record = {"r": readings}
        if meaning:
            record["m"] = meaning
        if strokes:
            record["s"] = strokes
        if res.get("e"):
            record["e"] = res["e"]
        record["g"] = res["g"]
        if char in core_map:
            record["c"] = 1
        for k in RESOURCE_FIELDS:
            v = res.get(k)
            if v is None or (k == "alt_radical" and not v):
                continue
            record[k] = v
        if meaning_rationale:
            record["mw"] = meaning_rationale
        if yinyang:
            record["y"] = yinyang
        if is_gov:
            record["gov"] = 1
        out[char] = record

        grade_counter[res["g"]] += 1
        for r in readings:
            readings_index[r].append(char)
        if not (meaning and strokes):
            skipped_thin.append(char)

    if missing_resource:
        print(f"[오류] 자원오행 결과 파일에 없는 글자 {len(missing_resource)}자: {' '.join(missing_resource[:10])} "
              f"— scripts/build_resource_element.py 를 먼저 돌릴 것")
        return 1

    # 독음 페이지 중복 카드 검사 — 같은 독음 아래 NFKC 로 같은 글자가 둘이면 실패
    dup_readings = sorted(r for r, chars in readings_index.items()
                          if len({unicodedata.normalize("NFKC", c) for c in chars}) != len(chars))
    if dup_readings:
        print(f"[오류] 독음 페이지 중복 카드 {len(dup_readings)}쪽: {' '.join(dup_readings[:10])}")
        return 1

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(out_path) / 1024 / 1024
    detail_pages = len(out) - len(skipped_thin)

    print("=== hanja-seo.json 빌드 리포트 ===")
    print(f"총 글자: {len(out)}")
    print(f"출력 크기: {size_mb:.2f} MB → {out_path}")
    print(f"호환 한자 병합: {len(merged_compat)}자 → 통합 한자 항목으로 (출력에서 제외, 독음 페이지 중복 카드 0)")
    print(f"자원오행 등급 분포: {dict(sorted(grade_counter.items()))} · Core(c) {sum(1 for v in out.values() if v.get('c'))}"
          f" · 뜻 기반 문장(mw) {sum(1 for v in out.values() if v.get('mw'))}")
    print(f"고유 독음 수: {len(readings_index)}")
    print(f"상세 페이지 대상 (뜻+획수 보유): {detail_pages}")
    print(f"목록 전용 (뜻/획수 미비 → 페이지 미생성): {len(skipped_thin)}")
    if skipped_no_reading:
        print(f"제외 (유효 독음 없음): {len(skipped_no_reading)}자 — {''.join(skipped_no_reading[:10])}")
    if skipped_non_han:
        codes = " ".join(f"U+{ord(c):05X}" for c in skipped_non_han[:5])
        print(f"제외 (유니코드 미등재 코드포인트): {len(skipped_non_han)}자 — {codes} ...")
    print(f"인명용(gov): {sum(1 for v in out.values() if v.get('gov'))}")

    core_missing = [c for c in core_map if c not in dictionary]
    if core_missing:
        # 백엔드 HanjaData 도 이 글자들을 싣지 않는다(수록 범위 = 이 사전). 2026-10-22 기준 6자(晩·查·随·皂·颻·慥) —
        # 대법원 인명용 한자표(data-gov.csv)에 없다. 앞 넷은 표준형 晚·査·隨·皁 이 수록돼 있고 颻·慥 은 대응 글자가 없다.
        print(f"[참고] core_v1에만 있고 사전에 없는 글자 {len(core_missing)}자(수록 안 함): {''.join(core_missing[:20])}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
