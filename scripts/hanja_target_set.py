# -*- coding: utf-8 -*-
"""
부수 기준 자원오행 S1 스크립트의 대상 글자 집합 — 사전 파일 하나에서 정한다 (자원오행 전환 S4, 2026-10-22).

쓰는 곳: scripts/extract_hanja_radicals.py · build_radical_resource_table.py · build_resource_element.py

대상 = data/hanja_dictionary_final.json 의 키 가운데 유니코드에 등재된 한자 한 글자(HanjaData.IsHanCodePoint 와 같은 영역 규칙)
  - 9,190 키 = 통합 한자 9,105 + 호환 한자 85 (2026-10-22). 법원 자체 코드 405자(U+A0xxx·U+F0xxx)는 빠진다.
  - 값은 통합 한자(NFKC) 9,105자에서 정한다 — 백엔드 사전(MergeCompatibilityIdeographs 뒤)과 /hanja(build_hanja_seo_data.py)가
    같은 9,105자다. 호환 한자 85 키는 결과 파일에 통합 한자 값 + compat_of 로만 싣는다(소비처는 통합 키만 쓴다).

S1(10/22 b90ad99)은 frontend/src/data/hanja-seo.json 의 키(그때 9,190 — 호환 한자 포함)를 대상으로 읽었다. hanja-seo.json 은
build_hanja_seo_data.py 가 이 결과 파일을 복사해 만드는 산출물이라(S4~), 거꾸로 입력으로 읽으면 순환이 되고 S6 재생성으로
키가 9,105(호환 병합)가 되면 키 대조에서 멈췄다. 그래서 대상을 사전 파일로 옮기고, hanja-seo.json 은 있으면 대조만 한다
(키가 옛 9,190 = 이 대상 키 전부이거나 새 9,105 = 통합 집합이면 통과, 다르면 경고만 — 중단하지 않는다).

소스에 호환 한자를 글자로 쓰지 않는다(코드포인트 숫자만).
"""

import json
import os
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICTIONARY = os.path.join(ROOT, "data", "hanja_dictionary_final.json")
HANJA_SEO = os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json")

COMPAT_RANGES = ((0xF900, 0xFAFF), (0x2F800, 0x2FA1F))


def is_han_code_point(cp):
    """백엔드 HanjaData.IsHanCodePoint · build_hanja_seo_data.py is_han_codepoint 와 같은 영역 규칙."""
    return (0x3400 <= cp <= 0x4DBF or 0x4E00 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF
            or 0x20000 <= cp <= 0x2EBEF or 0x2F800 <= cp <= 0x2FA1F or 0x30000 <= cp <= 0x323AF)


def to_unified(ch):
    """호환 한자이면 NFKC 통합 한자, 아니면 그대로 (HanjaData.ToUnifiedHanja 와 같은 규칙)."""
    u = unicodedata.normalize("NFKC", ch)
    return u if u != ch and len(ch) == 1 and is_han_code_point(ord(ch)) and len(u) == 1 and is_han_code_point(ord(u)) else ch


def load_dictionary(path=DICTIONARY):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def target_keys(dictionary=None):
    """대상 키(코드포인트 순) — 사전 파일의 등재 한자 한 글자 전부(호환 한자 포함)."""
    d = load_dictionary() if dictionary is None else dictionary
    return sorted((k for k in d if len(k) == 1 and is_han_code_point(ord(k))), key=ord)


def unified_keys(keys):
    """통합 한자 집합(코드포인트 순) — 백엔드 사전·/hanja 와 같은 9,105자."""
    return sorted({to_unified(k) for k in keys}, key=ord)


def check_hanja_seo(keys, path=HANJA_SEO):
    """hanja-seo.json 이 있으면 키를 대조한다 — 옛 형식(대상 키 전부)·새 형식(통합 집합) 둘 다 통과. 문자열 한 줄을 돌려준다."""
    if not os.path.exists(path):
        return "hanja-seo.json 없음 — 대조 생략"
    with open(path, encoding="utf-8") as f:
        seo = set(json.load(f))
    if seo == set(keys):
        return "hanja-seo.json 키 %d = 대상 키(호환 한자 포함, S6 재생성 전 형식)" % len(seo)
    uni = set(unified_keys(keys))
    if seo == uni:
        return "hanja-seo.json 키 %d = 통합 집합(호환 한자 병합, S6 재생성 뒤 형식)" % len(seo)
    return "[경고] hanja-seo.json 키 %d 가 대상(%d)·통합 집합(%d) 어느 쪽과도 다르다 — 사전 %s · seo %s (중단하지 않음)" % (
        len(seo), len(keys), len(uni),
        " ".join("U+%04X" % ord(c) for c in sorted(uni - seo, key=ord)[:10]) or "-",
        " ".join("U+%04X" % ord(c) for c in sorted(seo - uni - set(keys), key=ord)[:10]) or "-")
