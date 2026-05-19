#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hanjadict 라이브러리를 사용하여 인명용 한자의 의미 데이터를 수집하는 스크립트

사용 방법:
1. pip install hanjadict
2. 이 스크립트를 실행하여 hanja_meanings.json 생성
3. 생성된 JSON 파일을 C# 프로젝트에 복사
"""

import json
import sys
import os

try:
    import hanjadict
except ImportError:
    print("hanjadict 라이브러리가 설치되지 않았습니다.")
    print("다음 명령어로 설치하세요: pip install hanjadict")
    sys.exit(1)

def load_name_hanja_from_csv(csv_path):
    """CSV 파일에서 인명용 한자 목록을 로드"""
    hanja_set = set()
    
    if not os.path.exists(csv_path):
        print(f"경고: {csv_path} 파일을 찾을 수 없습니다.")
        return hanja_set
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            # 헤더 스킵
            for line in lines[1:]:
                parts = line.strip().split(',')
                if len(parts) >= 4:
                    hanja = parts[3]  # hanja 컬럼
                    if hanja:
                        hanja_set.add(hanja)
    except Exception as e:
        print(f"CSV 파일 읽기 오류: {e}")
    
    return hanja_set

def collect_meanings(hanja_list):
    """hanjadict에서 한자 의미 데이터 수집"""
    meaning_map = {}
    not_found = []
    
    print(f"총 {len(hanja_list)}개의 한자에서 의미 데이터를 수집합니다...")
    
    # hanjadict의 table_data 접근
    try:
        all_data = hanjadict.table_data
        print(f"hanjadict에 {len(all_data)}개의 한자 데이터가 있습니다.")
    except AttributeError:
        print("hanjadict.table_data에 접근할 수 없습니다. 다른 방법을 시도합니다.")
        all_data = {}
    
    for i, hanja in enumerate(hanja_list, 1):
        if i % 100 == 0:
            print(f"진행 중... {i}/{len(hanja_list)}")
        
        try:
            # hanjadict에서 한자 정보 가져오기
            if hanja in all_data:
                hanja_info = all_data[hanja]
                # 의미 추출 (구조에 따라 다를 수 있음)
                meaning = ""
                if isinstance(hanja_info, dict):
                    meaning = hanja_info.get('meaning', '') or hanja_info.get('meanings', '')
                    if isinstance(meaning, list):
                        meaning = ', '.join(meaning)
                elif isinstance(hanja_info, str):
                    meaning = hanja_info
                
                if meaning:
                    meaning_map[hanja] = meaning
                else:
                    not_found.append(hanja)
            else:
                # 직접 조회 시도
                try:
                    result = hanjadict.search(hanja)
                    if result:
                        meaning = result.get('meaning', '') or result.get('meanings', '')
                        if meaning:
                            meaning_map[hanja] = meaning
                        else:
                            not_found.append(hanja)
                    else:
                        not_found.append(hanja)
                except:
                    not_found.append(hanja)
        except Exception as e:
            print(f"한자 '{hanja}' 처리 중 오류: {e}")
            not_found.append(hanja)
    
    return meaning_map, not_found

def main():
    # CSV 파일 경로 (프로젝트 루트 기준)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    csv_files = [
        os.path.join(project_root, 'data-gov.csv'),
        os.path.join(project_root, 'data-naver.csv')
    ]
    
    # 인명용 한자 목록 수집
    all_hanja = set()
    for csv_file in csv_files:
        hanja_set = load_name_hanja_from_csv(csv_file)
        all_hanja.update(hanja_set)
        print(f"{os.path.basename(csv_file)}: {len(hanja_set)}개 한자 로드")
    
    print(f"\n총 {len(all_hanja)}개의 고유 한자를 찾았습니다.")
    
    # 의미 데이터 수집
    meaning_map, not_found = collect_meanings(sorted(all_hanja))
    
    # 결과 저장
    output_file = os.path.join(project_root, 'hanja_meanings.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(meaning_map, f, ensure_ascii=False, indent=2)
    
    print(f"\n결과:")
    print(f"  - 의미 데이터 수집: {len(meaning_map)}개")
    print(f"  - 데이터 없음: {len(not_found)}개")
    print(f"  - 출력 파일: {output_file}")
    
    if not_found and len(not_found) <= 20:
        print(f"\n의미 데이터를 찾지 못한 한자 (샘플): {', '.join(not_found[:20])}")

if __name__ == '__main__':
    main()
