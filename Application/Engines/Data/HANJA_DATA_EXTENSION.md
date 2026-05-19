# 한자 데이터 확장 가이드

이 문서는 향후 hanjadict, Unihan 등 외부 데이터 소스를 통합하여 한자 데이터를 확장하는 방법을 설명합니다.

## 현재 상태

- **기본 데이터**: 하드코딩된 30개 한자 (상세 정보 포함)
- **CSV 데이터**: 대법원/네이버 인명용 한자 9,000개 이상 (기본 정보만)
- **카테고리**: 자연, 덕목, 개념, 기타

## 데이터 소스 통합 방법

### 1. hanjadict 라이브러리 활용

hanjadict는 53,458자의 한자에 대한 읽는 법과 의미를 제공합니다.

#### Python 스크립트 예시

```python
import hanjadict
import json

# hanjadict에서 모든 데이터 가져오기
all_data = hanjadict.table_data

# 인명용 한자 CSV와 매칭
meaning_map = {}
for hanja_char in name_hanja_list:  # CSV에서 로드한 한자 목록
    if hanja_char in all_data:
        # 첫 번째 의미를 사용 (또는 모든 의미를 조합)
        meaning = all_data[hanja_char].get('meaning', '')
        meaning_map[hanja_char] = meaning

# JSON으로 저장
with open('hanja_meanings.json', 'w', encoding='utf-8') as f:
    json.dump(meaning_map, f, ensure_ascii=False, indent=2)
```

#### C#에서 사용

```csharp
// JSON 파일을 로드하여 의미 데이터 업데이트
var meaningMap = JsonSerializer.Deserialize<Dictionary<string, string>>(
    File.ReadAllText("hanja_meanings.json")
);

HanjaData.BatchUpdateMeanings(meaningMap);
```

### 2. Unihan 데이터셋 활용

Unihan 데이터베이스는 한자에 대한 구조적 정보를 제공합니다.

#### 데이터 필드
- `kDefinition`: 영문 정의
- `kTotalStrokes`: 총 획수
- `kRadical`: 부수
- `kRSUnicode`: 부수 및 부획 정보

#### 통합 예시

```csharp
// Unihan 데이터 파싱 후 업데이트
foreach (var unihanEntry in unihanData)
{
    var character = unihanEntry.Character;
    var strokeCount = unihanEntry.TotalStrokes;
    var definition = unihanEntry.Definition; // 영문 -> 한글 번역 필요
    
    // 오행, 음양 계산 (획수 기반 또는 별도 데이터)
    var fiveElement = CalculateFiveElement(strokeCount, character);
    var yinYang = CalculateYinYang(strokeCount);
    
    HanjaData.UpdateFromUnihan(character, strokeCount, fiveElement, yinYang);
}
```

### 3. 카테고리 자동 분류

의미 데이터가 추가되면 `ClassifyCategoryByMeaning()` 메서드가 자동으로 카테고리를 분류합니다.

#### 키워드 규칙
- **자연**: 봄, 여름, 가을, 겨울, 하늘, 바다, 산, 강, 물, 불, 구름, 별, 달, 해, 꽃, 나무, 숲 등
- **덕목**: 덕, 선, 효, 충, 신, 의, 예, 지, 인, 정, 화, 화목, 바름, 고름, 은혜, 정성, 믿음 등
- **개념**: 빛, 지혜, 용기, 길이, 항상, 흐름, 현재, 미래, 과거, 영원, 강함, 부, 명예, 성공 등

#### 수동 매핑 파일

빈도 높은 한자부터 수동으로 카테고리를 지정할 수 있습니다.

```json
{
  "category_mapping": {
    "가": "개념",
    "나": "자연",
    "다": "덕목"
  }
}
```

## API 엔드포인트

### GET /api/v1/recommendations/hanja-stats

한자 데이터의 통계 및 완성도를 확인할 수 있습니다.

#### 응답 예시

```json
{
  "summary": {
    "totalCount": 9000,
    "categorizedCount": 30,
    "uncategorizedCount": 8970,
    "categorizedPercentage": 0.33
  },
  "dataQuality": {
    "withCategory": 30,
    "withMeaning": 30,
    "withFiveElement": 30,
    "withUnicode": 9000,
    "withStrokeCount": 30,
    "withYinYang": 30,
    "completenessScore": 15.5
  },
  "categories": {
    "자연": { "count": 10, "withMeaning": 10, "withFiveElement": 10 },
    "덕목": { "count": 8, "withMeaning": 8, "withFiveElement": 8 },
    "개념": { "count": 12, "withMeaning": 12, "withFiveElement": 12 },
    "기타": { "count": 8970, "withMeaning": 0, "withFiveElement": 0 }
  },
  "dataSources": {
    "fromCsv": 9000,
    "fromDetailed": 30,
    "fromHanjadict": 0,
    "fromUnihan": 0
  },
  "recommendations": {
    "needsMeaningData": 8970,
    "needsCategoryClassification": 8970,
    "needsFiveElementData": 8970,
    "needsStrokeCountData": 8970
  }
}
```

## 향후 개선 방향

1. **의미 데이터 수집**: hanjadict 또는 네이버/다음 사전 크롤링
2. **구조적 정보 확충**: Unihan 데이터로 획수, 부수, 오행 정보 추가
3. **카테고리 확장**: 수동 매핑 파일 구축 및 자동 분류 정확도 향상
4. **성명학 정보**: 명리/성명학 자료로 오행, 음양, 길흉 정보 추가
5. **사용자 피드백**: 추천된 이름에 대한 사용자 선택 데이터 수집

## 참고 자료

- [hanjadict GitHub](https://github.com/bluedisk/hanjadict)
- [Unicode Unihan Database](https://www.unicode.org/reports/tr38/)
- [대법원 인명용 한자 검색](https://efamily.scourt.go.kr/)
- [네이버 한자사전](https://hanja.dict.naver.com/)
