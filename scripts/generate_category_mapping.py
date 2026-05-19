#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hanja_meanings.json과 hanjadict를 사용하여 카테고리 매핑 파일을 생성하는 스크립트

사용 방법:
1. hanja_meanings.json 파일이 있어야 함
2. 이 스크립트를 실행하여 hanja_category_mapping.json 생성
3. 생성된 파일을 검토하고 수정
"""

import json
import sys
import os

def classify_category_by_meaning(meaning):
    """의미 기반으로 카테고리 분류 (C# 코드와 동일한 로직)"""
    if not meaning:
        return "기타"
    
    meaning_lower = meaning.lower()
    
    # 자연 관련 키워드
    nature_keywords = [
        "봄", "여름", "가을", "겨울", "하늘", "바다", "산", "강", "물", "불", "구름", "별", "달", "해", "꽃", "나무", "숲", "바람", "비", "눈", "새", "동물",
        "바위", "돌", "흙", "모래", "풀", "잎", "열매", "씨", "뿌리", "가지", "줄기", "잎사귀", "꽃잎", "향기", "향", "향내",
        "새벽", "아침", "낮", "저녁", "밤", "밝음", "어둠", "그늘", "햇살", "달빛", "별빛", "무지개", "번개", "천둥",
        "호수", "연못", "시냇물", "폭포", "얼음", "서리", "이슬", "안개", "안개비", "소나기", "장마", "태풍",
        "들판", "벌판", "초원", "들", "밭", "논", "과수원", "정원", "화원", "동산"
    ]
    if any(kw in meaning_lower for kw in nature_keywords):
        return "자연"
    
    # 덕목 관련 키워드
    virtue_keywords = [
        "덕", "선", "효", "충", "신", "의", "예", "지", "인", "정", "화", "화목", "바름", "고름", "은혜", "정성", "믿음",
        "사랑", "애정", "우정", "우애", "형제", "자매", "부모", "자식", "가족", "화합", "단결", "협력", "도움", "베풂", "나눔",
        "겸손", "겸양", "겸허", "공손", "공경", "존경", "경외", "경애", "애경", "사모", "그리움",
        "정직", "성실", "충실", "충심", "충의", "충성", "충절", "절개", "절조", "절의", "의리", "의", "도리", "도덕", "윤리",
        "인내", "참을", "견딤", "인내심", "끈기", "불굴", "의지", "의욕", "의기",
        "용서", "관용", "포용", "포용력", "너그러움", "관대", "관대함", "대인", "대인배", "도량",
        "감사", "고마움", "고마워", "감사함", "보답", "보은", "보은함", "은혜"
    ]
    if any(kw in meaning_lower for kw in virtue_keywords):
        return "덕목"
    
    # 개념 관련 키워드
    concept_keywords = [
        "빛", "지혜", "용기", "길이", "항상", "흐름", "현재", "미래", "과거", "영원", "강함", "부", "명예", "성공",
        "희망", "꿈", "소망", "바람", "기대", "기대감", "기대함", "기대되다", "기대하다",
        "행복", "기쁨", "즐거움", "환희", "환호", "환호성", "환호하다", "환호함",
        "평화", "안정", "안정감", "안정되다", "안정하다", "평온", "평온함", "평온하다", "고요", "고요함", "고요하다", "조용", "조용함", "조용하다",
        "힘", "강력", "강력함", "강력하다", "강대", "강대함", "강대하다", "강인", "강인함", "강인하다", "불굴", "불굴의", "불굴의 의지",
        "아름다움", "아름답", "아름답다", "예쁨", "예쁘", "예쁘다", "예쁨", "예쁘게", "예쁘게 하다", "예쁘게 만들다",
        "빛남", "빛나", "빛나다", "빛을 내다", "빛을 발하다", "빛을 발함",
        "지식", "학문", "학습", "배움", "배우", "배우다", "배움", "배움의", "배움의 즐거움", "배움의 기쁨",
        "창조", "창조력", "창조적", "창조하다", "창조함", "창조의", "창조의 힘", "창조의 능력", "창조의 재능",
        "자유", "자유로움", "자유롭", "자유롭다", "자유롭게", "자유롭게 하다", "자유롭게 만들다",
        "진리", "진실", "진실함", "진실하다", "진실되다", "진실로", "진실로 하다", "진실로 만들다",
        "정의", "정의로움", "정의롭", "정의롭다", "정의롭게", "정의롭게 하다", "정의롭게 만들다",
        "용기", "용감", "용감함", "용감하다", "용감하게", "용감하게 하다", "용감하게 만들다", "담력", "담력이 있음", "담력이 있다",
        "승리", "이김", "이기", "이기다", "이김", "승리함", "승리하다", "승리", "승리감", "승리의 기쁨", "승리의 환희"
    ]
    if any(kw in meaning_lower for kw in concept_keywords):
        return "개념"
    
    return "기타"

def load_meanings():
    """hanja_meanings.json 파일 로드"""
    meanings_path = "hanja_meanings.json"
    if not os.path.exists(meanings_path):
        # 상위 디렉토리에서 찾기
        meanings_path = os.path.join("..", "hanja_meanings.json")
        if not os.path.exists(meanings_path):
            print(f"오류: hanja_meanings.json 파일을 찾을 수 없습니다.")
            return None
    
    try:
        with open(meanings_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"오류: JSON 파일 로드 실패: {e}")
        return None

def generate_mapping():
    """카테고리 매핑 생성"""
    meanings = load_meanings()
    if not meanings:
        return
    
    # 의미 데이터가 있는 한자들을 카테고리별로 분류
    category_mapping = {}
    classified_count = {"자연": 0, "덕목": 0, "개념": 0, "기타": 0}
    
    for hanja, meaning in meanings.items():
        category = classify_category_by_meaning(meaning)
        if category != "기타":  # 기타는 제외하고 분류된 것만 추가
            category_mapping[hanja] = category
            classified_count[category] = classified_count.get(category, 0) + 1
    
    # 통계 출력
    print(f"총 한자 수: {len(meanings)}")
    print(f"분류된 한자 수: {sum(classified_count.values())}")
    print(f"  - 자연: {classified_count['자연']}")
    print(f"  - 덕목: {classified_count['덕목']}")
    print(f"  - 개념: {classified_count['개념']}")
    print(f"  - 기타: {classified_count['기타']}")
    
    # 매핑 파일 생성
    output_path = "hanja_category_mapping.json"
    if os.path.dirname(output_path):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    mapping_data = {
        "category_mapping": category_mapping,
        "description": "의미 데이터를 기반으로 자동 생성된 카테고리 매핑입니다. 필요에 따라 수정하세요.",
        "usage": "이 파일을 수정하여 한자별 카테고리를 직접 지정할 수 있습니다. 자동 분류보다 우선순위가 높습니다.",
        "statistics": {
            "total_hanja": len(meanings),
            "classified_count": sum(classified_count.values()),
            "by_category": classified_count
        }
    }
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(mapping_data, f, ensure_ascii=False, indent=2)
        print(f"\n카테고리 매핑 파일 생성 완료: {output_path}")
        print(f"총 {len(category_mapping)}개의 한자가 카테고리로 분류되었습니다.")
    except Exception as e:
        print(f"오류: 파일 저장 실패: {e}")

if __name__ == "__main__":
    generate_mapping()
