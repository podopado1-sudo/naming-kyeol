#!/usr/bin/env python3
"""
한자 성별(GenderPref) / 톤(TonePref) 자동 분류 스크립트
hanja_dictionary_final.json의 meaning_ko + hanja_unihan.json의 definition을 기반으로
의미 키워드 매칭으로 자동 분류하여 hanja_unihan.json에 추가

성별(genderPref)은 이 스크립트가 유일한 판정 규칙이다(2026-10-27 성별 규칙 감사 결정 — D2).
  - 실행할 때마다 뜻이 있는 글자 전부의 genderPref 를 다시 계산해 덮어쓴다(옛 판은 값이 없을 때만 채워 규칙을 고쳐도 반영되지 않았다).
  - 백엔드 GenderToneClassifier(C#)는 hanja_unihan.json 에 genderPref 기록이 없는 글자에만 쓰는 대체 분류기다 —
    그 키워드 배열은 아래 한글 '유지' 목록(MALE_KEYWORDS_KO·FEMALE_KEYWORDS_KO)과 같게 둔다(영문 뜻·부수가 없어 영문·女부 한정 규칙은 없다).
  - 값이 정해지는 순서(백엔드): 하드코딩 9자 → 이 파일 값 → C# 분류기(기록 없는 글자만) → 호환 한자 병합 → data/hanja-gender-overrides.json.
톤(tonePref)은 이번 규칙 정리 범위 밖이라 기존 값을 그대로 둔다(값이 없는 글자를 채우려면 --fill-tone).

사용법:  python -I -X utf8 scripts/classify_gender_tone.py [--fill-tone]
"""

import json
import os
import re
import sys

# --- 성별 분류 규칙 (2026-10-27 감사 결정 — 근거·영향은 CLAUDE.md '알려진 이슈'의 성별 규칙 감사 기록) ---
# 판정은 옛 판과 같다: 걸린 키워드 수(키워드마다 1회, 한글 훈·영문 뜻 합산)로 다수결(classify_gender).
# 고친 것은 '무엇을 걸린 것으로 보느냐'다.
#   (b) 독음 충돌 — 훈 조각의 마지막 낱말(독음)은 보지 않고, 주 독음(사전 readings_hangul 첫 값)의 훈 조각만 본다
#       ('저울대 형'의 형·'얼굴 용'의 용, 緣 '부인 옷 이름 단'처럼 다른 독음의 훈). 주 독음 조각이 없으면 전 조각.
#   한글 부분 일치 — 훈 낱말이 키워드 그 자체이거나 키워드 + 용언 어미·조사 '의'(씩씩 → 씩씩할, 여자 → 여자의)일 때만 센다.
#       겹낱말은 COMPOUND_TAIL·COMPOUND_HEAD 키워드에만 허용(X꽃·X임금·X아버지 … — 한국어 겹낱말은 뒤가 머리).
#   동음 가드 — 한글 훈이 같은 다른 낱말은 영문 뜻으로 거른다(옥 = 獄 prison, 창 = 窓 window, 제비뽑기 lot, 장군 = 缶 jar).
#   (d) 영문 부분 일치 — 낱말 경계(복수 s/es 허용)로만 세고, 다른 말을 꾸미는 언급은 뺀다(en_keyword_hit).
#   (c) 성별 없는 형용사 — 키워드마다 /name 쓰임(성별 무관 조합 이름의 출생 남녀 비)으로 판정했다: 같은 성별 0.80 이상·이름 20명 이상·
#       지지 음절 2개 이상(음절마다 3명 이상·0.60 이상)인 굳셀·strong·robust(남)·beautiful(여)만 유지. 나머지 남자 쪽은 삭제,
#       여자 쪽은 女부(강희 부수 38) 글자에서만 센다(*_FEMALE_RADICAL_ONLY — 女부 관례(a)를 지키려고).
#   삭제(목록에서 뺌): 장부(동음만 걸림)·왕·웅·학(독음만 걸림), emperor(정의 속 언급)·jade(홀·고리 같은 옥 기물까지 잡음 — 옥 관례는 한글 훈 '옥·구슬'로만),
#       큰·크게·이길·날랠·강할·사나울·용맹·용감·튼튼할·씩씩·씩씩할·웅장·힘쓸·brave·fierce·mighty·vigor·gallant((c) 미달 — 중립).
#   C# 에만 있던 키워드(아들·사내·장정·기병·방패·갑옷·준걸 / 계집·처녀·아내·왕비·비빈·할머니·옥돌·비취·진주·산호·봉선화·아름다운·빼어날 …)는 여기로 합쳤다.
MALE_KEYWORDS_KO = [
    # 성별 명사·친족 (겹낱말: X아버지·X아비 — 허수아비 제외)
    "사나이", "사내", "남자", "남편", "장정", "아들", "아비", "지아비", "아버지", "할아버지", "시아버지", "홀아버지",
    "형", "아우", "수컷",
    # 임금 (겹낱말: X임금 — 순임금·요임금)
    "임금",
    # 무기·장수 (장군은 동음 가드 jar/crock)
    "장수", "장군", "무사", "군사", "기병", "전쟁", "싸울", "칼", "활", "창", "무기", "방패", "갑옷",
    "호걸", "준걸", "영웅", "호랑이", "용",
    # (c) 형용사 중 쓰임 기준을 통과한 것 (남 0.96·190명·4음절)
    "굳셀",
]
FEMALE_KEYWORDS_KO = [
    # 꽃 (겹낱말: X꽃 — 불꽃 제외)
    "꽃", "난초", "연꽃", "매화", "모란", "국화", "장미", "봉선화",
    # 비단·향기
    "비단", "향기", "향기로울",
    # 여성 지칭 (겹낱말: X어머니·X누이)
    "아가씨", "여자", "여인", "계집", "처녀", "공주", "부인", "아내", "며느리", "왕비", "비빈",
    "할머니", "어머니", "시어머니", "홀어머니", "누이", "자매", "암컷",
    # 새 (제비는 동음 가드 lot — 제비뽑기)
    "봉황", "나비", "제비",
    # 옥·구슬·보석 (겹낱말: 옥X·X옥 — 감옥 제외, 獄 가드 prison/jail · 구슬X·X구슬)
    "옥", "옥돌", "구슬", "보석", "비취", "진주", "산호",
]
FEMALE_KEYWORDS_KO_FEMALE_RADICAL_ONLY = [
    # (c) 성별 없는 형용사 — 女부 글자(嫣·婍·姼 …)에서만 센다
    "아름다울", "아름다운", "고울", "곱다", "곱을", "예쁠", "아리따울", "어여쁠",
    "빛날", "맑을", "밝을", "깨끗할", "단아할", "정숙할", "어질", "착할", "슬기로울",
    "빼어날", "자태", "요염", "얌전", "단정할", "그리울", "사모할",
]
MALE_KEYWORDS_EN = [
    "hero", "warrior", "military", "sword", "weapon", "king", "male", "husband",
    "father", "brother", "tiger", "dragon", "knight",
    # (c) 쓰임 기준 통과 (strong 남 0.97·192명, robust 0.99·105명)
    "strong", "robust",
]
FEMALE_KEYWORDS_EN = [
    "flower", "orchid", "lotus", "rose", "silk", "lady", "woman", "princess", "girl",
    "jewel", "pearl", "mother", "sister", "phoenix", "butterfly", "fragrant",
    # (c) 쓰임 기준 통과 (여 0.87·75명)
    "beautiful",
]
FEMALE_KEYWORDS_EN_FEMALE_RADICAL_ONLY = [
    "pretty", "elegant", "graceful", "gentle", "tender", "delicate", "fair", "charm",
]

FEMALE_RADICAL = 38  # 강희 부수 女

# 훈 조각의 독음 낱말 — 한글 한 음절, 두음 독음 괄호 허용("련(연)")
READING_TOKEN = re.compile(r'^[가-힣](\([가-힣]\))?$')
# 키워드 뒤에 붙어도 같은 낱말로 보는 용언 어미·조사
KO_SUFFIXES = ('할', '한', '하다', '하게', '히', '스러울', '스러운', '스런', '스럽다', '의')
# 겹낱말을 허용하는 명사 키워드: 그 키워드로 끝나는 낱말(TAIL)·시작하는 낱말(HEAD). 값 = 뜻이 굳어 그 키워드가 아닌 낱말
COMPOUND_TAIL = {'임금': set(), '꽃': {'불꽃'}, '아버지': set(), '어머니': set(), '누이': set(), '아비': {'허수아비'},
                 '옥': {'감옥'}, '구슬': set()}
COMPOUND_HEAD = {'옥': set(), '구슬': set()}
# 동음 가드 — 영문 뜻에 이 낱말이 있으면 한글 키워드를 세지 않는다
HOMONYM_EN = {'옥': ('prison', 'jail'), '창': ('window',), '제비': ('lot', 'lots', 'lottery', 'ballot'), '장군': ('jar', 'crock')}
# 'X of …' 언급 가드의 예외 — 분류 명사 of(name of a sword)는 그 글자의 뜻
EN_OF_CLASSIFIERS = ('name', 'species', 'kind', 'type', 'variety', 'sort')


def _ko_token_is(kw, tok):
    if tok == kw or any(tok == kw + s for s in KO_SUFFIXES):
        return True
    if kw in COMPOUND_TAIL and tok.endswith(kw) and len(tok) > len(kw) and tok not in COMPOUND_TAIL[kw]:
        return True
    if kw in COMPOUND_HEAD and tok.startswith(kw) and len(tok) > len(kw) and tok not in COMPOUND_HEAD[kw]:
        return True
    return False


def hun_words(meaning_ko, main_reading):
    """주 독음의 훈 낱말 목록(조각마다 한 목록, 독음 낱말은 뺀다). 주 독음 조각이 하나도 없으면 전 조각.
    '하늘 건/마를 건, 마를 간'(주 독음 건) → [['하늘'], ['마를']]"""
    main_parts, all_parts = [], []
    for part in re.split(r'[,/，]', meaning_ko or ''):
        toks = part.split()
        if not toks:
            continue
        if len(toks) >= 2 and READING_TOKEN.match(toks[-1]):
            readings = {toks[-1].split('(')[0]} | set(re.findall(r'\(([가-힣])\)', toks[-1]))
            hun = toks[:-1]
            is_main = main_reading in readings
        else:
            hun = [] if READING_TOKEN.match(toks[-1]) else toks
            is_main = True  # 독음 없는 조각은 어느 독음의 훈인지 모른다 — 센다
        all_parts.append(hun)
        if is_main:
            main_parts.append(hun)
    return main_parts if main_parts else all_parts


def ko_keyword_hit(kw, meaning_ko, main_reading, meaning_en):
    for hun in hun_words(meaning_ko, main_reading):
        if any(_ko_token_is(kw, w) for w in hun):
            guard = HOMONYM_EN.get(kw)
            if guard and re.search(r'\b(' + '|'.join(guard) + r')\b', (meaning_en or '').lower()):
                return False
            return True
    return False


def en_keyword_hit(kw, meaning_en):
    """영문 낱말 경계 일치(복수 s/es 허용). 다른 말을 꾸미는 언급은 그 글자의 뜻이 아니라 뺀다:
    소유격(brother's wife)·하이픈/빗금 겹낱말(mother-of-pearl·king-post), of 구(wife of elder brother — 분류 명사 of 는 셈),
    비유·관련(like/resembling/similar to/related to a dragon)."""
    t = (meaning_en or '').lower()
    for m in re.finditer(r'\b' + re.escape(kw) + r'(s|es)?\b', t):
        after = t[m.end():m.end() + 1]
        before = t[max(0, m.start() - 1):m.start()]
        if after in ("'", '’', '-', '/') or before in ('-', '/'):
            continue
        mo = re.search(r"\b([a-z]+) of (the |a |an )?([a-z]+'s )?((elder|younger|old|older) )?$", t[:m.start()])
        if mo and mo.group(1) not in EN_OF_CLASSIFIERS:
            continue
        if re.search(r'\b(like|resembling|similar to|related to)( an?| the)? $', t[:m.start()]):
            continue
        return True
    return False


def gender_hits(meaning_ko, meaning_en, main_reading='', female_radical=False):
    """걸린 키워드 [(성별, 키워드)] — 女부 한정 키워드는 female_radical 일 때만"""
    hits = []
    f_ko = FEMALE_KEYWORDS_KO + (FEMALE_KEYWORDS_KO_FEMALE_RADICAL_ONLY if female_radical else [])
    f_en = FEMALE_KEYWORDS_EN + (FEMALE_KEYWORDS_EN_FEMALE_RADICAL_ONLY if female_radical else [])
    hits += [("Male", kw) for kw in MALE_KEYWORDS_KO if ko_keyword_hit(kw, meaning_ko, main_reading, meaning_en)]
    hits += [("Male", kw) for kw in MALE_KEYWORDS_EN if en_keyword_hit(kw, meaning_en)]
    hits += [("Female", kw) for kw in f_ko if ko_keyword_hit(kw, meaning_ko, main_reading, meaning_en)]
    hits += [("Female", kw) for kw in f_en if en_keyword_hit(kw, meaning_en)]
    return hits


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


def classify_gender(meaning_ko, meaning_en, main_reading='', female_radical=False):
    """의미 기반 성별 선호 분류 — main_reading: 주 독음(훈 조각 고르기), female_radical: 女부 글자 여부((c) 여자 쪽 형용사)"""
    hits = gender_hits(meaning_ko, meaning_en, main_reading, female_radical)
    male_score = sum(1 for g, _ in hits if g == "Male")
    female_score = sum(1 for g, _ in hits if g == "Female")

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
    fill_tone = '--fill-tone' in sys.argv[1:]
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    data_dir = os.path.join(project_root, 'data')

    # 1. hanja_dictionary_final.json 로드 (meaning_ko, 주 독음)
    dict_path = os.path.join(data_dir, 'hanja_dictionary_final.json')
    meanings_ko = {}
    main_readings = {}
    if os.path.exists(dict_path):
        with open(dict_path, 'r', encoding='utf-8') as f:
            dict_data = json.load(f)
        # dict 형식: { "한자": { "hanja": ..., "meaning_ko": ..., "readings_hangul": [...] }, ... }
        for key, entry in dict_data.items():
            if isinstance(entry, dict):
                hanja = entry.get('hanja', key)
                meaning = entry.get('meaning_ko', '')
                if hanja and meaning:
                    meanings_ko[hanja] = meaning
                readings = entry.get('readings_hangul') or []
                if hanja and readings:
                    main_readings[hanja] = readings[0].split(',')[0].strip()
        print(f"hanja_dictionary_final.json: {len(meanings_ko)}개 의미 로드")

    # 2. 부수 (data/hanja_radicals.json — kangxi 판정 부수가 있으면 그 값, 자원오행 결과 파일과 같은 판정)
    radicals = {}
    radical_path = os.path.join(data_dir, 'hanja_radicals.json')
    if os.path.exists(radical_path):
        with open(radical_path, 'r', encoding='utf-8') as f:
            for hanja, rec in json.load(f).items():
                kangxi = rec.get('kangxi') or {}
                radicals[hanja] = kangxi.get('radical', rec.get('radical'))
    else:
        print("경고: hanja_radicals.json 이 없어 女부 한정 키워드를 세지 않습니다.")

    # 3. hanja_unihan.json 로드 (definition + strokeCount)
    unihan_path = os.path.join(data_dir, 'hanja_unihan.json')
    if not os.path.exists(unihan_path):
        print("오류: hanja_unihan.json이 없습니다. enhance_unihan_data.py를 먼저 실행하세요.")
        return

    with open(unihan_path, 'r', encoding='utf-8') as f:
        unihan_data = json.load(f)
    print(f"hanja_unihan.json: {len(unihan_data)}개 한자 로드")

    # 4. 분류 실행
    gender_counts = {"Male": 0, "Female": 0, "Neutral": 0}
    tone_counts = {"Strong": 0, "Soft": 0, "Neutral": 0}
    classified = 0
    gender_changed = 0

    for hanja, info in unihan_data.items():
        meaning_ko = meanings_ko.get(hanja, '')
        meaning_en = info.get('definition', '')

        # 의미가 하나도 없으면 건너뛰기
        if not meaning_ko and not meaning_en:
            continue

        # 성별: 이 규칙이 유일한 출처라 늘 다시 계산해 덮는다
        gender = classify_gender(meaning_ko, meaning_en, main_readings.get(hanja, ''),
                                 radicals.get(hanja) == FEMALE_RADICAL)
        if info.get('genderPref') != gender:
            gender_changed += 1
        info['genderPref'] = gender

        # 톤: 기존 값 유지(이번 규칙 정리 범위 밖) — --fill-tone 이면 값이 없는 글자만 채운다
        if fill_tone and ('tonePref' not in info or not info['tonePref']):
            info['tonePref'] = classify_tone(meaning_ko, meaning_en)

        gender_counts[info['genderPref']] = gender_counts.get(info['genderPref'], 0) + 1
        if info.get('tonePref'):
            tone_counts[info['tonePref']] = tone_counts.get(info['tonePref'], 0) + 1
        classified += 1

    # 5. 저장
    with open(unihan_path, 'w', encoding='utf-8') as f:
        json.dump(unihan_data, f, ensure_ascii=False, indent=2)

    print(f"\n분류 완료!")
    print(f"  - 분류된 한자: {classified}개 (성별 값이 바뀐 한자 {gender_changed}개)")
    print(f"  - 성별: Male={gender_counts['Male']}, Female={gender_counts['Female']}, Neutral={gender_counts['Neutral']}")
    print(f"  - 톤: Strong={tone_counts['Strong']}, Soft={tone_counts['Soft']}, Neutral={tone_counts['Neutral']}")


if __name__ == '__main__':
    main()
