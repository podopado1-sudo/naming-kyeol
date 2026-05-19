# 확장된 카테고리 매핑 가이드

## 개요

기존의 단순한 "자연/덕목/개념" 1단계 분류를 확장하여, 계층형 구조(major/minor)와 메타데이터(tags, evidence, confidence)를 포함한 확장 가능한 스키마로 개선했습니다.

## 새 스키마 구조

```json
{
  "schema_version": "2.0",
  "category_mapping": {
    "漢": {
      "major": "NATURE",
      "minor": "WATER",
      "tags": ["river", "flow"],
      "evidence": ["훈:물", "부수:水"],
      "confidence": 0.8
    }
  }
}
```

### 필드 설명

- **major**: 큰 축 (NATURE, VIRTUE, CONCEPT 등)
- **minor**: 세부 분류 (WATER, MORAL, MIND 등)
- **tags**: 검색/추천용 키워드 (영어)
- **evidence**: 분류 근거 (훈 의미, 부수 등)
- **confidence**: 자동 분류 신뢰도 (0.0 ~ 1.0)

## 카테고리 트리

### NATURE (자연)
- **CELESTIAL**: 해, 달, 별, 하늘, 시간의 흐름
- **WEATHER**: 바람, 비, 눈, 구름, 온도
- **SEASON**: 봄, 여름, 가을, 겨울, 절기
- **TERRAIN**: 산, 들, 평야, 길, 경계
- **WATER**: 강, 바다, 호수, 샘, 습지
- **PLANT**: 나무, 풀, 꽃, 열매, 농작물
- **ANIMAL**: 짐승, 새, 물고기, 곤충

### VIRTUE (덕목)
- **MORAL**: 인·의·예·지·신, 효·충, 도덕성
- **PERSONAL**: 성실, 절제, 용기 등 개인 덕목
- **SOCIAL**: 화합, 공경, 겸손, 배려 등 대인 관계

### CONCEPT (개념)
- **MIND**: 생각, 감정, 의지 등 심리·의식
- **TIME**: 시간, 순서, 변화
- **SPACE**: 공간, 방향, 형태
- **QUANTITY**: 수량, 크기, 정도
- **STATE**: 밝다, 무겁다, 차다 같은 추상 성질

## 사용 방법

### 1. 확장된 카테고리 매핑 생성

```bash
cd scripts
python generate_extended_category_mapping.py
```

이 스크립트는:
- `hanja_meanings.json`에서 의미 데이터를 읽습니다
- `hanja_unihan.json`에서 부수 정보를 읽습니다 (선택사항)
- 기존 `hanja_category_mapping.json`을 마이그레이션합니다 (선택사항)
- 자동 분류를 수행합니다:
  - **1차**: 훈(뜻) 키워드 매칭
  - **2차**: 부수 기반 보정
  - **3차**: 예외 수동 테이블 적용

### 2. 생성된 파일 확인

```bash
# 프로젝트 루트에서
cat hanja_category_mapping_extended.json | head -50
```

통계 정보도 포함되어 있습니다:
- 총 한자 수
- 분류된 한자 수 및 비율
- Major별 분포
- Minor별 분포 (상위 10개)
- Confidence 분포

### 3. C# 코드에서 자동 로드

`Program.cs`에서 `HanjaData.LoadExternalData()`가 호출되면:
1. `hanja_category_mapping_extended.json`을 우선적으로 로드
2. 없으면 기존 `hanja_category_mapping.json` 로드 (하위 호환)

### 4. API에서 통계 확인

```bash
curl http://localhost:5000/api/v1/recommendations/hanja-stats
```

응답에 `extendedCategories` 필드가 추가되어:
- Major별 분포
- Minor별 분포
- Confidence 분포
- 평균 Confidence

를 확인할 수 있습니다.

## 자동 분류 규칙

### 1차: 훈(뜻) 키워드 매칭

의미에 포함된 키워드를 기반으로 분류합니다.

예:
- "물", "강", "바다" → NATURE.WATER
- "인", "의", "예" → VIRTUE.MORAL
- "생각", "감정" → CONCEPT.MIND

### 2차: 부수 기반 보정

Unihan 데이터의 부수 정보를 활용합니다.

예:
- 水, 氵 → NATURE.WATER
- 木 → NATURE.PLANT
- 心, 忄 → CONCEPT.MIND

의미 분류와 부수 힌트가 일치하면 confidence가 증가합니다.

### 3차: 예외 수동 테이블

다의어나 추상도가 높은 한자는 수동으로 지정할 수 있습니다.

기존 `hanja_category_mapping.json`의 항목은 자동으로 마이그레이션되며, confidence는 1.0으로 설정됩니다.

## Confidence 해석

- **High (≥0.8)**: 키워드 매칭과 부수 힌트가 일치하거나 수동 지정
- **Medium (0.5-0.8)**: 키워드 매칭 또는 부수 힌트 중 하나만 일치
- **Low (<0.5)**: 약한 매칭, 수동 검토 권장
- **None (0)**: 분류 실패, 수동 지정 필요

## 확장 방법

### 새로운 Major 추가

`scripts/generate_extended_category_mapping.py`의 `CATEGORY_TREE`에 추가:

```python
CATEGORY_TREE = {
    "NATURE": {...},
    "VIRTUE": {...},
    "CONCEPT": {...},
    "SOCIETY": {  # 새 Major 추가
        "POLITICS": [...],
        "ECONOMY": [...]
    }
}
```

### 새로운 Minor 추가

기존 Major에 Minor 추가:

```python
"NATURE": {
    "CELESTIAL": [...],
    "WATER": [...],
    "MINERAL": ["돌", "금", "은", "철"]  # 새 Minor 추가
}
```

### 부수 힌트 추가

`RADICAL_HINTS`에 추가:

```python
RADICAL_HINTS = {
    "水": "NATURE.WATER",
    "石": "NATURE.MINERAL",  # 새 부수 힌트
    ...
}
```

## 마이그레이션 가이드

기존 `hanja_category_mapping.json`을 사용 중이라면:

1. 새 스크립트 실행: `python generate_extended_category_mapping.py`
2. 생성된 `hanja_category_mapping_extended.json` 확인
3. C# 코드는 자동으로 새 파일을 우선 로드
4. 기존 파일은 백업으로 유지 (하위 호환성)

## 문제 해결

### 분류가 부정확한 경우

1. `confidence`가 낮은 항목 확인:
   ```bash
   # JSON에서 confidence < 0.5인 항목 찾기
   jq '.category_mapping | to_entries | map(select(.value.confidence < 0.5))' hanja_category_mapping_extended.json
   ```

2. 수동 보정:
   - `hanja_category_mapping_extended.json` 직접 편집
   - 또는 예외 테이블에 추가 후 스크립트 재실행

### 부수 정보가 없는 경우

Unihan 데이터에 부수 정보가 없으면 부수 기반 보정이 작동하지 않습니다. 이 경우 훈 키워드 매칭만 사용됩니다.

## 참고

- 기존 코드와의 하위 호환성 유지
- `Category` 필드는 기존 형식(자연/덕목/개념)으로 자동 변환
- 새 스키마는 `CategoryMajor`, `CategoryMinor` 등으로 접근
