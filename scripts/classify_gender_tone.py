#!/usr/bin/env python3
"""
한자 성별(GenderPref) / 톤(TonePref) 자동 분류 스크립트
hanja_dictionary_final.json의 meaning_ko + hanja_unihan.json의 definition을 기반으로
의미 키워드 매칭으로 자동 분류하여 hanja_unihan.json에 추가
"""

import json
import os

# --- 성별 분류 키워드 ---
MALE_KEYWORDS_KO = [
    "사나이", "장부", "남자", "씩씩", "용맹", "호걸", "장수", "무사", "영웅",
    "웅장", "큰", "크게", "씩씩할", "날랠", "굳셀", "튼튼할", "강할",
    "싸울", "칼", "활", "창", "무기", "군사", "전쟁", "이길",
    "용감", "사나울", "남편", "아비", "아버지", "형", "아우",
    "임금", "왕", "수컷", "웅", "장군", "호랑이", "용"
]
MALE_KEYWORDS_EN = [
    "brave", "strong", "hero", "warrior", "military", "sword", "weapon",
    "king", "emperor", "male", "husband", "father", "brother", "tiger",
    "dragon", "fierce", "mighty", "robust", "vigor", "gallant", "knight"
]

FEMALE_KEYWORDS_KO = [
    "아름다울", "고울", "곱다", "예쁠", "아리따울", "어여쁠",
    "꽃", "난초", "연꽃", "매화", "모란", "국화", "장미",
    "비단", "아가씨", "여자", "여인", "공주", "부인", "며느리",
    "곱을", "빛날", "맑을", "밝을", "깨끗할", "향기",
    "봉황", "학", "나비", "제비", "옥", "구슬", "보석",
    "단아할", "정숙할", "어질", "착할", "슬기로울",
    "어머니", "누이", "자매", "암컷"
]
FEMALE_KEYWORDS_EN = [
    "beautiful", "pretty", "elegant", "flower", "orchid", "lotus", "rose",
    "silk", "lady", "woman", "princess", "girl", "jade", "jewel", "pearl",
    "graceful", "gentle", "tender", "mother", "sister", "delicate",
    "fragrant", "phoenix", "butterfly", "fair", "charm"
]

# --- 톤 분류 키워드 ---
STRONG_KEYWORDS_KO = [
    "강할", "굳셀", "날랠", "씩씩", "용맹", "사나울",
    "세찰", "맹렬할", "위엄", "웅장", "높을", "넓을", "클",
    "굳건할", "끊을", "이길", "다스릴", "밝힐",
    "칼", "싸울", "무기", "불", "번개", "우레", "천둥",
    "바위", "쇠", "철", "강", "호랑이", "용", "독수리",
    "정의", "의로울", "충성", "절개", "지조"
]
STRONG_KEYWORDS_EN = [
    "strong", "fierce", "brave", "mighty", "powerful", "great",
    "iron", "steel", "fire", "thunder", "lightning", "rock",
    "tiger", "dragon", "eagle", "sword", "war", "battle",
    "justice", "righteous", "loyal", "stern", "bold", "grand",
    "resolute", "determined"
]

SOFT_KEYWORDS_KO = [
    "부드러울", "온화할", "따뜻할", "고요할", "잔잔할", "조용할",
    "맑을", "깨끗할", "순할", "착할", "어질",
    "슬기", "지혜", "사랑", "자비", "은혜", "평화",
    "물", "이슬", "비", "바람", "달", "별",
    "봄", "새벽", "아침", "안개", "구름",
    "향기", "향기로울", "꽃", "풀", "나무", "숲", "정원",
    "비단", "옥", "구슬", "노래", "음악", "거문고"
]
SOFT_KEYWORDS_EN = [
    "soft", "gentle", "warm", "calm", "quiet", "peaceful",
    "pure", "clean", "clear", "kind", "wise", "love", "mercy",
    "water", "dew", "rain", "wind", "moon", "star",
    "spring", "dawn", "morning", "mist", "cloud",
    "fragrant", "flower", "garden", "silk", "jade", "music",
    "tender", "graceful", "serene", "mild", "harmony"
]


def classify_gender(meaning_ko, meaning_en):
    """의미 기반 성별 선호 분류"""
    text_ko = (meaning_ko or "").lower()
    text_en = (meaning_en or "").lower()

    male_score = sum(1 for kw in MALE_KEYWORDS_KO if kw in text_ko)
    male_score += sum(1 for kw in MALE_KEYWORDS_EN if kw in text_en)

    female_score = sum(1 for kw in FEMALE_KEYWORDS_KO if kw in text_ko)
    female_score += sum(1 for kw in FEMALE_KEYWORDS_EN if kw in text_en)

    if male_score >= 2 and male_score > female_score:
        return "Male"
    elif female_score >= 2 and female_score > male_score:
        return "Female"
    elif male_score == 1 and female_score == 0:
        return "Male"
    elif female_score == 1 and male_score == 0:
        return "Female"
    return "Neutral"


def classify_tone(meaning_ko, meaning_en):
    """의미 기반 톤 분류"""
    text_ko = (meaning_ko or "").lower()
    text_en = (meaning_en or "").lower()

    strong_score = sum(1 for kw in STRONG_KEYWORDS_KO if kw in text_ko)
    strong_score += sum(1 for kw in STRONG_KEYWORDS_EN if kw in text_en)

    soft_score = sum(1 for kw in SOFT_KEYWORDS_KO if kw in text_ko)
    soft_score += sum(1 for kw in SOFT_KEYWORDS_EN if kw in text_en)

    if strong_score >= 2 and strong_score > soft_score:
        return "Strong"
    elif soft_score >= 2 and soft_score > strong_score:
        return "Soft"
    elif strong_score == 1 and soft_score == 0:
        return "Strong"
    elif soft_score == 1 and strong_score == 0:
        return "Soft"
    return "Neutral"


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    data_dir = os.path.join(project_root, 'data')

    # 1. hanja_dictionary_final.json 로드 (meaning_ko)
    dict_path = os.path.join(data_dir, 'hanja_dictionary_final.json')
    meanings_ko = {}
    if os.path.exists(dict_path):
        with open(dict_path, 'r', encoding='utf-8') as f:
            dict_data = json.load(f)
        # dict 형식: { "한자": { "hanja": ..., "meaning_ko": ... }, ... }
        for key, entry in dict_data.items():
            if isinstance(entry, dict):
                hanja = entry.get('hanja', key)
                meaning = entry.get('meaning_ko', '')
                if hanja and meaning:
                    meanings_ko[hanja] = meaning
        print(f"hanja_dictionary_final.json: {len(meanings_ko)}개 의미 로드")

    # 2. hanja_unihan.json 로드 (definition + strokeCount)
    unihan_path = os.path.join(data_dir, 'hanja_unihan.json')
    if not os.path.exists(unihan_path):
        print("오류: hanja_unihan.json이 없습니다. enhance_unihan_data.py를 먼저 실행하세요.")
        return

    with open(unihan_path, 'r', encoding='utf-8') as f:
        unihan_data = json.load(f)
    print(f"hanja_unihan.json: {len(unihan_data)}개 한자 로드")

    # 3. 분류 실행
    gender_counts = {"Male": 0, "Female": 0, "Neutral": 0}
    tone_counts = {"Strong": 0, "Soft": 0, "Neutral": 0}
    classified = 0

    for hanja, info in unihan_data.items():
        meaning_ko = meanings_ko.get(hanja, '')
        meaning_en = info.get('definition', '')

        # 의미가 하나도 없으면 건너뛰기
        if not meaning_ko and not meaning_en:
            continue

        gender = classify_gender(meaning_ko, meaning_en)
        tone = classify_tone(meaning_ko, meaning_en)

        # 기존 값이 없을 때만 설정
        if 'genderPref' not in info or not info['genderPref']:
            info['genderPref'] = gender
        if 'tonePref' not in info or not info['tonePref']:
            info['tonePref'] = tone

        gender_counts[info['genderPref']] = gender_counts.get(info['genderPref'], 0) + 1
        tone_counts[info['tonePref']] = tone_counts.get(info['tonePref'], 0) + 1
        classified += 1

    # 4. 저장
    with open(unihan_path, 'w', encoding='utf-8') as f:
        json.dump(unihan_data, f, ensure_ascii=False, indent=2)

    print(f"\n분류 완료!")
    print(f"  - 분류된 한자: {classified}개")
    print(f"  - 성별: Male={gender_counts['Male']}, Female={gender_counts['Female']}, Neutral={gender_counts['Neutral']}")
    print(f"  - 톤: Strong={tone_counts['Strong']}, Soft={tone_counts['Soft']}, Neutral={tone_counts['Neutral']}")


if __name__ == '__main__':
    main()
