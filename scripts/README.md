# 한자 데이터 수집 스크립트

이 디렉토리에는 hanjadict, Unihan 등 외부 데이터 소스에서 한자 정보를 수집하는 Python 스크립트가 있습니다.

## 사전 요구사항

```bash
# Python 3.7 이상 필요
python --version

# hanjadict 설치
pip install hanjadict

# 선택사항: Unihan 데이터 처리를 위한 라이브러리
pip install unihan-reader  # 또는 수동 다운로드
```

## 사용 방법

### 1. hanjadict 데이터 수집

```bash
cd scripts
python collect_hanjadict_data.py
```

이 스크립트는:
- `data-gov.csv`, `data-naver.csv`에서 인명용 한자 목록을 읽습니다
- hanjadict에서 각 한자의 의미를 조회합니다
- `hanja_meanings.json` 파일을 생성합니다

**출력 파일**: `../hanja_meanings.json`

### 2. Unihan 데이터 수집

#### 방법 1: 자동 다운로드 (권장)

```bash
# unihan-reader 라이브러리 사용
pip install unihan-reader
python collect_unihan_data_auto.py  # (추후 작성 예정)
```

#### 방법 2: 수동 다운로드

1. https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip 다운로드
2. 압축 해제
3. 필요한 파일을 프로젝트 루트에 복사:
   - `Unihan_Readings.txt`
   - `Unihan_RadicalStrokeCounts.txt`
   - `Unihan_DictionaryLikeData.txt`

```bash
python collect_unihan_data.py
```

**출력 파일**: `../hanja_unihan.json`

### 3. 확장된 카테고리 매핑 생성 (새 기능)

```bash
cd scripts
python generate_extended_category_mapping.py
```

이 스크립트는:
- `hanja_meanings.json`에서 의미 데이터를 읽습니다
- `hanja_unihan.json`에서 부수 정보를 읽습니다 (선택사항)
- 기존 `hanja_category_mapping.json`을 마이그레이션합니다 (선택사항)
- 확장 가능한 계층형 카테고리 스키마로 자동 분류합니다
- `hanja_category_mapping_extended.json` 파일을 생성합니다

**새 스키마 형식**:
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

**카테고리 트리**:
- **NATURE**: CELESTIAL, WEATHER, SEASON, TERRAIN, WATER, PLANT, ANIMAL
- **VIRTUE**: MORAL, PERSONAL, SOCIAL
- **CONCEPT**: MIND, TIME, SPACE, QUANTITY, STATE

**출력 파일**: `../hanja_category_mapping_extended.json`

### 4. C# 프로젝트에 통합

생성된 JSON 파일을 프로젝트 루트에 복사한 후, C# 코드에서 로드:

```csharp
// Program.cs 또는 시작 시점에서
var meanings = JsonSerializer.Deserialize<Dictionary<string, string>>(
    File.ReadAllText("hanja_meanings.json")
);
HanjaData.BatchUpdateMeanings(meanings);

var unihanData = JsonSerializer.Deserialize<Dictionary<string, UnihanInfo>>(
    File.ReadAllText("hanja_unihan.json")
);
foreach (var kvp in unihanData)
{
    HanjaData.UpdateFromUnihan(
        kvp.Key,
        kvp.Value.strokeCount,
        kvp.Value.fiveElement,
        kvp.Value.yinYang
    );
}
```

## 출력 파일 형식

### hanja_category_mapping_extended.json

```json
{
  "schema_version": "2.0",
  "description": "확장 가능한 계층형 카테고리 매핑",
  "category_mapping": {
    "漢": {
      "major": "NATURE",
      "minor": "WATER",
      "tags": ["water", "river"],
      "evidence": ["훈:물", "부수:水"],
      "confidence": 0.8
    }
  },
  "statistics": {
    "total_hanja": 9096,
    "classified_count": 8500,
    "by_major": {
      "NATURE": 4500,
      "VIRTUE": 2000,
      "CONCEPT": 2000
    },
    "confidence_distribution": {
      "high": 6000,
      "medium": 2000,
      "low": 500,
      "none": 0
    }
  }
}
```

### hanja_meanings.json

```json
{
  "가": "가하다, 더하다",
  "나": "나다, 생기다",
  "다": "다하다, 충분하다"
}
```

### hanja_unihan.json

```json
{
  "가": {
    "strokeCount": 5,
    "definition": "add, increase",
    "radical": "30.2",
    "fiveElement": "土",
    "yinYang": "陽"
  }
}
```

## 문제 해결

### hanjadict 설치 오류

```bash
# pip 업그레이드
python -m pip install --upgrade pip

# 다시 설치
pip install hanjadict
```

### Unihan 데이터를 찾을 수 없음

- Unihan.zip 파일을 다운로드하고 압축 해제했는지 확인
- 파일 경로가 올바른지 확인
- 스크립트의 파일 경로를 프로젝트 구조에 맞게 수정
