#!/usr/bin/env python3
"""
현대 한국어 이름 데이터 수집 스크립트
통계청, 인구주택총조사 등에서 이름 목록을 수집하여 발음 패턴과 시대별 선호를 연구

참고: 실제 크롤링은 웹사이트의 이용약관을 확인하고 적절한 방법으로 수행해야 합니다.
이 스크립트는 기본 구조만 제공합니다.
"""

import json
import os
import csv
from collections import Counter
from datetime import datetime

def collect_from_statistics():
    """통계청 데이터 수집 (예시)"""
    # 실제로는 통계청 API 또는 공개 데이터를 사용
    # 여기서는 예시 데이터만 제공
    names = []
    
    # 예시: 2020년 인구주택총조사 데이터 (실제로는 API 호출)
    # 실제 구현 시 requests 라이브러리 사용
    print("통계청 데이터 수집 (예시)")
    print("참고: 실제 통계청 API를 사용하려면 인증이 필요할 수 있습니다.")
    
    return names

def collect_from_public_sources():
    """공개 소스에서 이름 데이터 수집"""
    names = []
    
    # 예시: 공개된 이름 통계 데이터
    # 실제로는 웹 크롤링 또는 공개 API 사용
    print("공개 소스에서 이름 데이터 수집 (예시)")
    
    return names

def analyze_name_patterns(names):
    """이름 패턴 분석"""
    patterns = {
        'common_endings': Counter(),
        'common_startings': Counter(),
        'syllable_lengths': Counter(),
        'consonant_patterns': Counter(),
        'vowel_patterns': Counter()
    }
    
    for name in names:
        if len(name) >= 2:
            # 끝 음절 패턴
            patterns['common_endings'][name[-1]] += 1
            # 시작 음절 패턴
            patterns['common_startings'][name[0]] += 1
            # 음절 길이
            patterns['syllable_lengths'][len(name)] += 1
    
    return patterns

def save_name_statistics(patterns, output_path):
    """이름 통계 저장"""
    data = {
        'collected_at': datetime.now().isoformat(),
        'total_names': sum(patterns['common_endings'].values()),
        'patterns': {
            'common_endings': dict(patterns['common_endings'].most_common(50)),
            'common_startings': dict(patterns['common_startings'].most_common(50)),
            'syllable_lengths': dict(patterns['syllable_lengths']),
        }
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"이름 통계 저장 완료: {output_path}")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    output_dir = os.path.join(project_root, 'data')
    os.makedirs(output_dir, exist_ok=True)
    
    # 이름 데이터 수집
    print("이름 데이터 수집 시작...")
    names = []
    
    # 통계청 데이터 수집
    names.extend(collect_from_statistics())
    
    # 공개 소스 수집
    names.extend(collect_from_public_sources())
    
    if not names:
        print("경고: 수집된 이름 데이터가 없습니다.")
        print("실제 구현 시 웹 크롤링 또는 API를 사용하여 데이터를 수집해야 합니다.")
        return
    
    # 패턴 분석
    print("이름 패턴 분석 중...")
    patterns = analyze_name_patterns(names)
    
    # 통계 저장
    output_path = os.path.join(output_dir, 'korean_name_statistics.json')
    save_name_statistics(patterns, output_path)
    
    print(f"완료! 총 {len(names)}개의 이름 데이터를 수집했습니다.")

if __name__ == '__main__':
    main()
