#!/usr/bin/env python3
"""
한자 의미 및 유의어 확장 수집 스크립트
네이버/다음 한자사전, KHAIii 사전 등을 크롤링하여 한글 뜻과 부정적 연상을 포함한 사전을 확장

참고: 실제 크롤링은 웹사이트의 이용약관을 확인하고 적절한 방법으로 수행해야 합니다.
이 스크립트는 기본 구조만 제공합니다.
"""

import json
import os
import time
from collections import defaultdict

def collect_from_naver(hanja_list):
    """네이버 한자사전에서 의미 수집 (예시)"""
    meanings = {}
    
    print("네이버 한자사전에서 의미 수집 (예시)")
    print("참고: 실제 구현 시 requests + BeautifulSoup 또는 Selenium 사용")
    print("      웹사이트 이용약관을 확인하고 적절한 딜레이를 두어야 합니다.")
    
    # 예시 구조
    for hanja in hanja_list[:10]:  # 예시로 10개만
        # 실제로는:
        # url = f"https://hanja.dict.naver.com/search?query={hanja}"
        # response = requests.get(url, headers={...})
        # soup = BeautifulSoup(response.text, 'html.parser')
        # meaning = extract_meaning(soup)
        meanings[hanja] = {
            'meaning_ko': '예시 의미',
            'source': 'naver'
        }
        time.sleep(0.5)  # 적절한 딜레이
    
    return meanings

def collect_from_daum(hanja_list):
    """다음 한자사전에서 의미 수집 (예시)"""
    meanings = {}
    
    print("다음 한자사전에서 의미 수집 (예시)")
    # 실제 구현은 네이버와 유사
    
    return meanings

def collect_from_khaiii(hanja_list):
    """KHAIii 사전에서 의미 수집 (예시)"""
    meanings = {}
    
    print("KHAIii 사전에서 의미 수집 (예시)")
    # 실제 구현 필요
    
    return meanings

def detect_negative_associations(meaning):
    """의미에서 부정적 연상 탐지"""
    negative_keywords = [
        '죽음', '병', '고생', '불행', '나쁜', '악', '흉', '추', '허'
    ]
    
    associations = []
    for keyword in negative_keywords:
        if keyword in meaning:
            associations.append(keyword)
    
    return associations

def merge_meanings(existing_meanings, new_meanings):
    """의미 데이터 병합"""
    merged = existing_meanings.copy()
    
    for hanja, data in new_meanings.items():
        if hanja not in merged:
            merged[hanja] = {}
        
        # 의미 업데이트 (더 상세한 의미 우선)
        if 'meaning_ko' in data:
            existing = merged[hanja].get('meaning_ko', '')
            if len(data['meaning_ko']) > len(existing):
                merged[hanja]['meaning_ko'] = data['meaning_ko']
        
        # 소스 추가
        if 'sources' not in merged[hanja]:
            merged[hanja]['sources'] = []
        if data.get('source') and data['source'] not in merged[hanja]['sources']:
            merged[hanja]['sources'].append(data['source'])
        
        # 부정적 연상 탐지
        if 'meaning_ko' in merged[hanja]:
            associations = detect_negative_associations(merged[hanja]['meaning_ko'])
            if associations:
                merged[hanja]['negative_associations'] = associations
    
    return merged

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # 기존 한자 목록 로드
    final_json_path = os.path.join(project_root, 'data', 'hanja_dictionary_final.json')
    if not os.path.exists(final_json_path):
        print(f"경고: {final_json_path} 파일을 찾을 수 없습니다.")
        return
    
    with open(final_json_path, 'r', encoding='utf-8') as f:
        hanja_dict = json.load(f)
    
    hanja_list = list(hanja_dict.keys())
    print(f"총 {len(hanja_list)}개의 한자를 처리합니다.")
    
    # 기존 의미 데이터 로드
    meanings_path = os.path.join(project_root, 'data', 'hanja_meanings.json')
    existing_meanings = {}
    if os.path.exists(meanings_path):
        with open(meanings_path, 'r', encoding='utf-8') as f:
            existing_meanings = json.load(f)
    
    # 각 소스에서 의미 수집
    all_new_meanings = {}
    
    # 네이버 (예시)
    naver_meanings = collect_from_naver(hanja_list)
    all_new_meanings.update(naver_meanings)
    
    # 다음 (예시)
    # daum_meanings = collect_from_daum(hanja_list)
    # all_new_meanings.update(daum_meanings)
    
    # KHAIii (예시)
    # khaiii_meanings = collect_from_khaiii(hanja_list)
    # all_new_meanings.update(khaiii_meanings)
    
    # 의미 병합
    merged_meanings = merge_meanings(existing_meanings, all_new_meanings)
    
    # 저장
    output_path = os.path.join(project_root, 'data', 'hanja_meanings.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(merged_meanings, f, ensure_ascii=False, indent=2)
    
    print(f"완료! {len(merged_meanings)}개의 한자 의미를 저장했습니다.")
    print(f"  - 새로 추가된 의미: {len(all_new_meanings)}개")

if __name__ == '__main__':
    main()
