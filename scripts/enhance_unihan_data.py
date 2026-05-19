#!/usr/bin/env python3
"""
Unihan 데이터 강화 스크립트
Unihan 파일에서 획수 정보를 추출하여 hanja_unihan.json을 생성/업데이트
"""

import json
import os
import sys

def parse_unihan_radical_strokes(file_path):
    """
    Unihan_RadicalStrokeCounts.txt 파일 파싱
    형식: U+XXXX	kRSAdobe_Japan1_6	C+CID+radical.radicalStrokes.remainingStrokes [...]
    총획 = radicalStrokes + remainingStrokes
    """
    stroke_data = {}

    if not os.path.exists(file_path):
        print(f"경고: {file_path} 파일을 찾을 수 없습니다.")
        return stroke_data

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue

                parts = line.split('\t')
                if len(parts) < 3:
                    continue

                unicode_hex = parts[0]  # "U+XXXX"
                # parts[1] = "kRSAdobe_Japan1_6"
                values = parts[2]       # "C+CID+radical.radStrokes.remStrokes ..."

                # 여러 값이 공백으로 구분될 수 있음 — 첫 번째 사용
                first_value = values.split()[0]

                # "C+13698+1.1.5" 형식에서 radical.radStrokes.remStrokes 추출
                plus_parts = first_value.split('+')
                if len(plus_parts) < 3:
                    continue

                radical_info = plus_parts[2]  # "1.1.5" (radical.radStrokes.remStrokes)
                dot_parts = radical_info.split('.')
                if len(dot_parts) < 3:
                    continue

                try:
                    radical_strokes = int(dot_parts[1])
                    remaining_strokes = int(dot_parts[2])
                    total_strokes = radical_strokes + remaining_strokes

                    if total_strokes <= 0:
                        continue

                    # 유니코드를 한자로 변환
                    char_code = int(unicode_hex.replace('U+', ''), 16)
                    hanja = chr(char_code)
                    stroke_data[hanja] = total_strokes
                except (ValueError, IndexError, OverflowError):
                    continue
    except Exception as e:
        print(f"Unihan 파일 파싱 오류: {e}")

    return stroke_data

def load_existing_unihan_json(json_path):
    """기존 hanja_unihan.json 파일 로드"""
    if not os.path.exists(json_path):
        return {}
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"기존 JSON 파일 로드 오류: {e}")
        return {}

def calculate_five_element(stroke_count):
    """획수 기반 오행 계산"""
    if stroke_count == 0:
        return ""
    
    # 획수의 마지막 자리수로 오행 결정
    last_digit = stroke_count % 10 if stroke_count >= 10 else stroke_count
    
    # 1,2: 목(木), 3,4: 화(火), 5,6: 토(土), 7,8: 금(金), 9,0: 수(水)
    if last_digit in [1, 2]:
        return "木"
    elif last_digit in [3, 4]:
        return "火"
    elif last_digit in [5, 6]:
        return "土"
    elif last_digit in [7, 8]:
        return "金"
    else:  # 9, 0
        return "水"

def calculate_yin_yang(stroke_count):
    """획수 기반 음양 계산"""
    if stroke_count == 0:
        return ""
    
    # 짝수는 양, 홀수는 음
    return "陽" if stroke_count % 2 == 0 else "陰"

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # Unihan 파일 경로
    unihan_file = os.path.join(project_root, 'Unihan_RadicalStrokeCounts.txt')
    
    # 출력 JSON 파일 경로 (data 폴더)
    output_dir = os.path.join(project_root, 'data')
    os.makedirs(output_dir, exist_ok=True)
    output_json = os.path.join(output_dir, 'hanja_unihan.json')
    
    # 기존 데이터 로드
    existing_data = load_existing_unihan_json(output_json)
    
    # Unihan 파일에서 획수 데이터 추출
    print("Unihan 파일에서 획수 데이터 추출 중...")
    stroke_data = parse_unihan_radical_strokes(unihan_file)
    print(f"추출된 획수 데이터: {len(stroke_data)}개")
    
    # 기존 데이터 업데이트 및 새 데이터 추가
    updated_count = 0
    new_count = 0
    
    for hanja, stroke_count in stroke_data.items():
        if hanja not in existing_data:
            existing_data[hanja] = {}
            new_count += 1
        
        # 획수 업데이트
        if existing_data[hanja].get('strokeCount') != stroke_count:
            existing_data[hanja]['strokeCount'] = stroke_count
            updated_count += 1
        
        # 오행/음양 자동 계산 (없는 경우만)
        if 'fiveElement' not in existing_data[hanja] or not existing_data[hanja]['fiveElement']:
            existing_data[hanja]['fiveElement'] = calculate_five_element(stroke_count)
        
        if 'yinYang' not in existing_data[hanja] or not existing_data[hanja]['yinYang']:
            existing_data[hanja]['yinYang'] = calculate_yin_yang(stroke_count)
    
    # JSON 파일 저장
    print(f"JSON 파일 저장 중: {output_json}")
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=2)
    
    print(f"완료!")
    print(f"  - 새로 추가된 한자: {new_count}개")
    print(f"  - 업데이트된 획수: {updated_count}개")
    print(f"  - 총 한자 수: {len(existing_data)}개")

if __name__ == '__main__':
    main()
