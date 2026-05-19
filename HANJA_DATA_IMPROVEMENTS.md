# 한자 데이터 개선 사항

## ✅ 완료된 수정 (우선순위 1단계)

### 1. JSON 필드 매핑 개선

**문제점**: JSON에 `total_strokes`, `category` 같은 필드가 있어도 C# 코드에서 무시하고 있었음

**수정 내용**:
- `FinalJsonEntry` 클래스에 다음 필드 추가:
  - `total_strokes` (int?) - 획수 정보
  - `category` (string?) - 카테고리 정보
  - `five_element` (string?) - 오행 정보 (향후 확장)
  - `yin_yang` (string?) - 음양 정보 (향후 확장)

**코드 위치**: `Application/Engines/Data/HanjaData.cs` 라인 303-313

```csharp
private class FinalJsonEntry
{
    public string? hanja { get; set; }
    public List<string>? readings_hangul { get; set; }
    public List<string>? initial_consonants { get; set; }
    public string? unicode_hex { get; set; }
    public List<string>? sources { get; set; }
    public string? meaning_ko { get; set; }
    public int? total_strokes { get; set; } // ✅ 추가
    public string? category { get; set; } // ✅ 추가
    public string? five_element { get; set; } // ✅ 추가
    public string? yin_yang { get; set; } // ✅ 추가
}
```

### 2. JSON 데이터 로딩 로직 개선

**수정 내용**:
- JSON에 `total_strokes`가 있으면 `StrokeCount`에 반영
- JSON에 `category`가 있으면 우선 사용, 없으면 의미 기반 자동 분류
- JSON에 `five_element`, `yin_yang`이 있으면 반영

**코드 위치**: `Application/Engines/Data/HanjaData.cs` 라인 239-261

```csharp
// 카테고리 결정: JSON의 category > 의미 기반 자동 분류 > "기타"
string category;
if (!string.IsNullOrEmpty(entry.category))
{
    category = entry.category;
}
else if (!string.IsNullOrEmpty(entry.meaning_ko))
{
    category = ClassifyCategoryByMeaning(entry.meaning_ko);
}
else
{
    category = "기타";
}

_loadedDictionary[hanja] = new HanjaInfo
{
    // ...
    FiveElement = entry.five_element ?? string.Empty, // ✅ JSON에 있으면 사용
    YinYang = entry.yin_yang ?? string.Empty, // ✅ JSON에 있으면 사용
    StrokeCount = entry.total_strokes ?? 0, // ✅ JSON에 있으면 사용
    Category = category, // ✅ 개선된 카테고리 로직
    // ...
};
```

### 3. 기존 상세 데이터 보완 로직 개선

**수정 내용**:
- 기존 상세 데이터(30개)는 우선순위 유지 (덮어쓰지 않음)
- JSON 데이터로 부족한 정보만 보완:
  - 획수: 상세 데이터에 없고 JSON에 있으면 추가
  - 카테고리: 없거나 "기타"인 경우만 JSON 또는 의미 기반 분류
  - 오행/음양: 없으면 JSON에서 가져오기

**코드 위치**: `Application/Engines/Data/HanjaData.cs` 라인 263-310

---

## ✅ 완료된 수정 (우선순위 3단계)

### 데이터 레벨별 통계 추가

**문제점**: 기존 통계는 "상세 데이터"를 하나로 묶어서 30개만 표시되어 너무 가혹함

**수정 내용**: 데이터 완성도를 5단계 레벨로 분류

**코드 위치**: `Api/Controllers/RecommendationsController.cs` 라인 104-134

#### 데이터 레벨 정의

- **L0 (Basic)**: 한자/음/유니코드만 있음
- **L1 (WithMeaning)**: 뜻(meaning_ko) 있음
- **L2 (WithStrokeCount)**: 획수 있음
- **L3 (WithFiveElement)**: 오행/음양 있음
- **L4 (FullSet)**: 톤/성별선호/설명 템플릿까지 있음 (작명용 풀셋)

**API 응답 예시**:
```json
{
  "dataLevels": {
    "L0_Basic": {
      "count": 5000,
      "percentage": 55.56,
      "description": "한자/음/유니코드만 있음"
    },
    "L1_WithMeaning": {
      "count": 3000,
      "percentage": 33.33,
      "description": "뜻(meaning_ko) 있음"
    },
    "L2_WithStrokeCount": {
      "count": 2000,
      "percentage": 22.22,
      "description": "획수 있음"
    },
    "L3_WithFiveElement": {
      "count": 100,
      "percentage": 1.11,
      "description": "오행/음양 있음"
    },
    "L4_FullSet": {
      "count": 30,
      "percentage": 0.33,
      "description": "톤/성별선호/설명 템플릿까지 있음 (작명용 풀셋)"
    }
  }
}
```

---

## 🔄 다음 단계 (우선순위 2단계)

### Unihan / meanings / category_mapping 통합

#### 1. 획수 정보 통합
- **Unihan 데이터**: `total_strokes` 필드를 JSON에 추가
- **방법**: `scripts/collect_unihan_data.py` 실행 후 `hanja_dictionary_final.json`에 반영
- **효과**: L2 레벨 데이터 증가 예상

#### 2. 의미 데이터 통합
- **hanjadict 데이터**: `meaning_ko` 필드를 JSON에 추가
- **방법**: `scripts/collect_hanjadict_data.py` 실행 후 `hanja_dictionary_final.json`에 반영
- **효과**: L1 레벨 데이터 증가 예상

#### 3. 카테고리 매핑 통합
- **수동 매핑**: `hanja_category_mapping.json`의 데이터를 `hanja_dictionary_final.json`에 반영
- **효과**: 카테고리 분류 정확도 향상

#### 4. 오행/음양 정보 추가
- **방법 1**: 획수 기반 규칙 적용 (성명학 규칙)
- **방법 2**: 부수 기반 매핑 테이블 적용
- **방법 3**: 별도 설정 파일로 분리하여 관리

**권장 사항**:
- 획수는 Unihan에서 직접 가져오기 (가장 신뢰도 높음)
- 오행/음양은 별도 규칙/매핑 파일로 관리 (모델 오염 방지)

---

## 📊 예상 효과

### 수정 전
- 획수 있음: 30개 (0.33%)
- 카테고리 있음: 30개 (0.33%)

### 수정 후 (JSON에 total_strokes 추가 시)
- 획수 있음: 수천 개 증가 예상
- 카테고리 있음: 의미 기반 자동 분류로 증가 예상

### API 확인 방법
```
GET http://localhost:5000/api/v1/recommendations/hanja-stats
```

`dataLevels` 섹션에서 각 레벨별 통계를 확인할 수 있습니다.

---

## 📝 JSON 파일 형식 예시

향후 `hanja_dictionary_final.json`에 추가할 수 있는 필드:

```json
{
  "春": {
    "hanja": "春",
    "readings_hangul": ["춘"],
    "initial_consonants": ["ㅊ"],
    "unicode_hex": "6625",
    "sources": ["gov", "naver"],
    "meaning_ko": "봄",
    "total_strokes": 9,        // ✅ Unihan에서 추가
    "category": "자연",         // ✅ 수동 매핑 또는 자동 분류
    "five_element": "木",      // ✅ 향후 규칙/매핑에서 추가
    "yin_yang": "陽"           // ✅ 향후 규칙/매핑에서 추가
  }
}
```

---

## ✅ 검증 방법

1. 서버 재시작
2. `/api/v1/recommendations/hanja-stats` API 호출
3. `dataLevels` 섹션 확인:
   - L2 레벨이 증가했는지 확인 (획수 정보)
   - L1 레벨이 증가했는지 확인 (의미 정보)
   - 카테고리 분류가 개선되었는지 확인

---

**마지막 업데이트**: 오늘  
**상태**: 우선순위 1, 3단계 완료 ✅
