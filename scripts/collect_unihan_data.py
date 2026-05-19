#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unihan 데이터베이스에서 한자 구조적 정보를 수집하는 스크립트

사용 방법:
1. Unihan 데이터 다운로드 (자동)
2. 이 스크립트를 실행하여 hanja_unihan.json 생성
3. 생성된 JSON 파일을 C# 프로젝트에 복사
"""

import json
import sys
import os
import urllib.request
import gzip

UNIHAN_URL = "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip"
UNIHAN_DIR = "unihan_data"

def download_unihan():
    """Unihan 데이터 다운로드"""
    print("Unihan 데이터를 다운로드합니다...")
    # 실제로는 zip 파일을 다운로드하고 압축 해제해야 하지만
    # 여기서는 간단한 예시만 제공
    print("참고: Unihan 데이터는 수동으로 다운로드하거나 unihan-reader 라이브러리를 사용하세요.")
    print("URL: https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip")

def load_name_hanja_from_csv(csv_path):
    """CSV 파일에서 인명용 한자 목록을 로드"""
    hanja_set = set()
    
    if not os.path.exists(csv_path):
        return hanja_set
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for line in lines[1:]:
                parts = line.strip().split(',')
                if len(parts) >= 4:
                    hanja = parts[3]
                    if hanja:
                        hanja_set.add(hanja)
    except Exception as e:
        print(f"CSV 파일 읽기 오류: {e}")
    
    return hanja_set

def parse_unihan_file(unihan_file_path, target_hanja):
    """Unihan 파일 파싱"""
    unihan_data = {}
    
    if not os.path.exists(unihan_file_path):
        print(f"경고: {unihan_file_path} 파일을 찾을 수 없습니다.")
        return unihan_data
    
    print(f"Unihan 파일 파싱 중: {unihan_file_path}")
    
    try:
        with open(unihan_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('#') or not line.strip():
                    continue
                
                parts = line.strip().split('\t')
                if len(parts) >= 3:
                    unicode_hex = parts[0]
                    field = parts[1]
                    value = parts[2]
                    
                    try:
                        # Unicode 코드포인트를 한자로 변환
                        code_point = int(unicode_hex.replace('U+', ''), 16)
                        hanja = chr(code_point)
                        
                        # target_hanja에 있거나, 모든 한자를 처리하도록 변경
                        # (향후 확장성을 위해)
                        if hanja in target_hanja or len(target_hanja) == 0:
                            if hanja not in unihan_data:
                                unihan_data[hanja] = {}
                            
                            # 필요한 필드만 저장
                            if field == 'kTotalStrokes':
                                # 여러 값이 있을 수 있으므로 첫 번째 값 사용
                                stroke_value = value.split()[0] if value else "0"
                                try:
                                    unihan_data[hanja]['strokeCount'] = int(stroke_value)
                                except ValueError:
                                    unihan_data[hanja]['strokeCount'] = 0
                            elif field == 'kDefinition':
                                # kDefinition은 영어 정의 (한글 의미로 활용 가능)
                                if 'definition' not in unihan_data[hanja]:
                                    unihan_data[hanja]['definition'] = value
                            elif field == 'kRSUnicode':
                                # 부수 정보 (예: "214.8" 형식)
                                unihan_data[hanja]['radical'] = value
                                # 부수 정보에서 오행 추출 가능
                                if value and '.' in value:
                                    try:
                                        radical_num = int(value.split('.')[0])
                                        # 부수 번호 기반 오행 계산 (간단한 규칙)
                                        five_element = get_five_element_from_radical(radical_num)
                                        if five_element:
                                            unihan_data[hanja]['fiveElement'] = five_element
                                    except (ValueError, IndexError):
                                        pass
                    except (ValueError, OverflowError) as e:
                        continue
    except Exception as e:
        print(f"Unihan 파일 파싱 오류: {e}")
    
    return unihan_data

def get_five_element_from_radical(radical_num):
    """부수 번호 기반 오행 계산 (부수별 오행 매핑)"""
    # 주요 부수의 오행 매핑 (간단한 규칙)
    # 실제로는 더 정확한 부수-오행 매핑표가 필요
    radical_to_element = {
        # 목(木) 계열 부수
        75: "木",  # 木
        90: "木",  # 未
        # 화(火) 계열 부수
        86: "火",  # 火
        # 토(土) 계열 부수
        32: "土",  # 土
        # 금(金) 계열 부수
        167: "金",  # 金
        # 수(水) 계열 부수
        85: "水",  # 水
    }
    
    return radical_to_element.get(radical_num, "")

def calculate_five_element(stroke_count):
    """획수 기반 오행 계산 (간단한 규칙)"""
    if stroke_count == 0:
        return ""
    
    # 획수를 5로 나눈 나머지로 오행 결정
    remainder = stroke_count % 5
    five_elements = ["木", "火", "土", "金", "水"]
    return five_elements[remainder]

def calculate_yin_yang(stroke_count):
    """획수 기반 음양 계산"""
    if stroke_count == 0:
        return ""
    
    # 짝수는 양, 홀수는 음
    return "陽" if stroke_count % 2 == 0 else "陰"

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # 인명용 한자 목록 로드
    csv_files = [
        os.path.join(project_root, 'data-gov.csv'),
        os.path.join(project_root, 'data-naver.csv')
    ]
    
    all_hanja = set()
    for csv_file in csv_files:
        hanja_set = load_name_hanja_from_csv(csv_file)
        all_hanja.update(hanja_set)
    
    print(f"총 {len(all_hanja)}개의 고유 한자를 찾았습니다.")
    
    # Unihan 파일 경로 (다운로드 필요)
    unihan_files = [
        os.path.join(project_root, 'Unihan_Readings.txt'),
        os.path.join(project_root, 'Unihan_RadicalStrokeCounts.txt'),
        os.path.join(project_root, 'Unihan_DictionaryLikeData.txt'),
    ]
    
    unihan_data = {}
    for unihan_file in unihan_files:
        if os.path.exists(unihan_file):
            data = parse_unihan_file(unihan_file, all_hanja)
            # 데이터 병합
            for hanja, info in data.items():
                if hanja not in unihan_data:
                    unihan_data[hanja] = {}
                unihan_data[hanja].update(info)
    
    # 오행, 음양 계산
    for hanja, info in unihan_data.items():
        stroke_count = info.get('strokeCount', 0)
        if stroke_count > 0:
            # 오행이 부수에서 계산되지 않았으면 획수 기반으로 계산
            if 'fiveElement' not in info or not info.get('fiveElement'):
                info['fiveElement'] = calculate_five_element(stroke_count)
            info['yinYang'] = calculate_yin_yang(stroke_count)
    
    # 결과 저장
    output_file = os.path.join(project_root, 'hanja_unihan.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(unihan_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n결과:")
    print(f"  - Unihan 데이터 수집: {len(unihan_data)}개")
    print(f"  - 출력 파일: {output_file}")
    print(f"\n참고: Unihan 데이터를 다운로드하려면:")
    print(f"  1. https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip 다운로드")
    print(f"  2. 압축 해제 후 Unihan_*.txt 파일을 프로젝트 루트에 복사")

if __name__ == '__main__':
    main()
