#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
확장 가능한 카테고리 스키마로 한자 분류 매핑을 생성하는 스크립트

새로운 스키마:
{
  "漢": {
    "major": "NATURE",
    "minor": "WATER",
    "tags": ["river", "flow"],
    "evidence": ["훈:물", "부수:水"],
    "confidence": 0.8
  }
}

사용 방법:
1. hanja_meanings.json 파일이 있어야 함
2. hanja_unihan.json 파일이 있으면 부수 정보 활용
3. 기존 hanja_category_mapping.json이 있으면 마이그레이션
4. 이 스크립트를 실행하여 hanja_category_mapping_extended.json 생성
"""

import json
import sys
import os
import re

# 카테고리 키워드 설정 파일 로드
def load_category_keywords():
    """category_keywords.json 파일에서 카테고리 트리와 부수 힌트 로드"""
    keywords_path = os.path.join(os.path.dirname(__file__), "category_keywords.json")
    if not os.path.exists(keywords_path):
        # 상위 디렉토리에서 찾기
        keywords_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "category_keywords.json")
        if not os.path.exists(keywords_path):
            print(f"경고: category_keywords.json 파일을 찾을 수 없습니다. 기본값을 사용합니다.")
            return {}, {}
    
    try:
        with open(keywords_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            category_tree = data.get("category_tree", {})
            radical_hints = data.get("radical_hints", {})
            return category_tree, radical_hints
    except Exception as e:
        print(f"경고: category_keywords.json 로드 실패: {e}. 기본값을 사용합니다.")
        return {}, {}

# 전역 변수로 로드
CATEGORY_TREE, RADICAL_HINTS = load_category_keywords()

def classify_by_meaning(meaning):
    """의미 기반으로 major.minor 분류"""
    if not meaning:
        return None, None, [], [], 0.0
    
    meaning_lower = meaning.lower()
    matches = []
    evidence = []
    
    # 각 카테고리 트리를 순회하며 키워드 매칭
    for major, minors in CATEGORY_TREE.items():
        for minor, keywords in minors.items():
            matched_keywords = [kw for kw in keywords if kw in meaning_lower]
            if matched_keywords:
                matches.append((major, minor, matched_keywords))
                evidence.extend([f"훈:{kw}" for kw in matched_keywords])
    
    if not matches:
        return None, None, [], [], 0.0
    
    # 가장 많이 매칭된 카테고리 선택
    best_match = max(matches, key=lambda x: len(x[2]))
    major, minor, keywords = best_match
    
    # confidence 계산: 매칭된 키워드 수와 전체 키워드 수의 비율
    confidence = min(0.9, 0.5 + len(keywords) * 0.1)
    
    # tags 생성 (영어 키워드로 변환)
    tags = []
    for kw in keywords[:5]:  # 최대 5개만
        # 간단한 한글->영어 매핑 (실제로는 더 정교한 번역 필요)
        tag_map = {
            "물": "water", "강": "river", "바다": "sea", "호수": "lake",
            "산": "mountain", "하늘": "sky", "별": "star", "달": "moon", "해": "sun",
            "꽃": "flower", "나무": "tree", "풀": "grass",
            "덕": "virtue", "선": "goodness", "인": "benevolence", "의": "righteousness",
            "빛": "light", "지혜": "wisdom", "용기": "courage"
        }
        if kw in tag_map:
            tags.append(tag_map[kw])
        else:
            tags.append(kw)
    
    return major, minor, tags, evidence, confidence

def classify_by_radical(radical):
    """부수 기반으로 힌트 제공"""
    if not radical or not RADICAL_HINTS:
        return None, None
    
    # 부수에서 주요 부수 추출
    for rad, category in RADICAL_HINTS.items():
        if rad in radical:
            parts = category.split(".")
            return parts[0], parts[1]
    
    return None, None

def load_meanings():
    """hanja_meanings.json 파일 로드"""
    meanings_path = "hanja_meanings.json"
    if not os.path.exists(meanings_path):
        meanings_path = os.path.join("..", "hanja_meanings.json")
        if not os.path.exists(meanings_path):
            print(f"경고: hanja_meanings.json 파일을 찾을 수 없습니다.")
            return None
    
    try:
        with open(meanings_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"오류: JSON 파일 로드 실패: {e}")
        return None

def load_unihan():
    """hanja_unihan.json 파일 로드 (부수 정보 포함)"""
    unihan_path = "hanja_unihan.json"
    if not os.path.exists(unihan_path):
        unihan_path = os.path.join("..", "hanja_unihan.json")
        if not os.path.exists(unihan_path):
            return {}
    
    try:
        with open(unihan_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"경고: Unihan JSON 파일 로드 실패: {e}")
        return {}

def load_old_mapping():
    """기존 hanja_category_mapping.json 로드 (마이그레이션용)"""
    old_path = "hanja_category_mapping.json"
    if not os.path.exists(old_path):
        old_path = os.path.join("..", "hanja_category_mapping.json")
        if not os.path.exists(old_path):
            return {}
    
    try:
        with open(old_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if "category_mapping" in data:
                return data["category_mapping"]
            return {}
    except Exception as e:
        print(f"경고: 기존 매핑 파일 로드 실패: {e}")
        return {}

def migrate_old_category(old_category):
    """기존 카테고리(자연/덕목/개념)를 새 스키마로 변환"""
    mapping = {
        "자연": ("NATURE", None),
        "덕목": ("VIRTUE", None),
        "개념": ("CONCEPT", None)
    }
    return mapping.get(old_category, (None, None))

def generate_extended_mapping():
    """확장 가능한 카테고리 매핑 생성"""
    meanings = load_meanings()
    if not meanings:
        print("오류: 의미 데이터를 로드할 수 없습니다.")
        return
    
    unihan_data = load_unihan()
    old_mapping = load_old_mapping()
    
    extended_mapping = {}
    statistics = {
        "total_hanja": len(meanings),
        "classified_count": 0,
        "by_major": {},
        "by_minor": {},
        "confidence_distribution": {"high": 0, "medium": 0, "low": 0, "none": 0}
    }
    
    print(f"총 {len(meanings)}개의 한자 처리 중...")
    
    for i, (hanja, meaning) in enumerate(meanings.items(), 1):
        if i % 1000 == 0:
            print(f"진행 중... {i}/{len(meanings)}")
        
        # 1. 기존 매핑 확인 (수동 지정 우선)
        old_category = old_mapping.get(hanja)
        if old_category:
            major, minor = migrate_old_category(old_category)
            if major:
                extended_mapping[hanja] = {
                    "major": major,
                    "minor": minor or "OTHER",
                    "tags": [],
                    "evidence": [f"기존매핑:{old_category}"],
                    "confidence": 1.0  # 수동 지정은 높은 신뢰도
                }
                statistics["classified_count"] += 1
                statistics["by_major"][major] = statistics["by_major"].get(major, 0) + 1
                if minor:
                    key = f"{major}.{minor}"
                    statistics["by_minor"][key] = statistics["by_minor"].get(key, 0) + 1
                statistics["confidence_distribution"]["high"] += 1
                continue
        
        # 2. 의미 기반 자동 분류
        major, minor, tags, evidence, confidence = classify_by_meaning(meaning)
        
        # 3. 부수 기반 보정 (Unihan 데이터에서)
        radical = None
        if hanja in unihan_data:
            radical = unihan_data[hanja].get("radical")
            if radical:
                rad_major, rad_minor = classify_by_radical(radical)
                if rad_major:
                    # 부수 힌트가 의미 분류와 일치하면 confidence 증가
                    if major == rad_major:
                        if minor == rad_minor:
                            confidence = min(1.0, confidence + 0.2)
                        else:
                            confidence = min(1.0, confidence + 0.1)
                        evidence.append(f"부수:{radical}")
                    # 의미 분류가 없으면 부수 힌트 사용
                    elif not major:
                        major = rad_major
                        minor = rad_minor
                        evidence.append(f"부수:{radical}")
                        confidence = 0.6
        
        # 4. 결과 저장
        if major:
            extended_mapping[hanja] = {
                "major": major,
                "minor": minor or "OTHER",
                "tags": tags[:5],  # 최대 5개
                "evidence": evidence[:10],  # 최대 10개
                "confidence": round(confidence, 2)
            }
            statistics["classified_count"] += 1
            statistics["by_major"][major] = statistics["by_major"].get(major, 0) + 1
            if minor:
                key = f"{major}.{minor}"
                statistics["by_minor"][key] = statistics["by_minor"].get(key, 0) + 1
            
            # confidence 분포
            if confidence >= 0.8:
                statistics["confidence_distribution"]["high"] += 1
            elif confidence >= 0.5:
                statistics["confidence_distribution"]["medium"] += 1
            elif confidence > 0:
                statistics["confidence_distribution"]["low"] += 1
        else:
            statistics["confidence_distribution"]["none"] += 1
    
    # 결과 저장
    output_path = "hanja_category_mapping_extended.json"
    if os.path.dirname(output_path):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    output_data = {
        "schema_version": "2.0",
        "description": "확장 가능한 계층형 카테고리 매핑입니다. major/minor 구조로 세분화된 분류를 제공합니다.",
        "usage": "이 파일은 자동 분류와 수동 보정을 결합하여 생성되었습니다. confidence가 낮은 항목은 수동 검토가 필요할 수 있습니다.",
        "category_mapping": extended_mapping,
        "statistics": statistics
    }
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n확장 카테고리 매핑 파일 생성 완료: {output_path}")
        print(f"\n통계:")
        print(f"  총 한자 수: {statistics['total_hanja']}")
        print(f"  분류된 한자 수: {statistics['classified_count']} ({statistics['classified_count']/statistics['total_hanja']*100:.1f}%)")
        print(f"\n  Major별 분포:")
        for major, count in sorted(statistics['by_major'].items(), key=lambda x: -x[1]):
            print(f"    {major}: {count}")
        print(f"\n  Confidence 분포:")
        print(f"    High (≥0.8): {statistics['confidence_distribution']['high']}")
        print(f"    Medium (0.5-0.8): {statistics['confidence_distribution']['medium']}")
        print(f"    Low (<0.5): {statistics['confidence_distribution']['low']}")
        print(f"    None: {statistics['confidence_distribution']['none']}")
        
        # 상위 10개 minor 분포
        print(f"\n  상위 10개 Minor 분포:")
        for key, count in sorted(statistics['by_minor'].items(), key=lambda x: -x[1])[:10]:
            print(f"    {key}: {count}")
            
    except Exception as e:
        print(f"오류: 파일 저장 실패: {e}")

if __name__ == "__main__":
    generate_extended_mapping()
