# 한자 데이터 현황 분석

## 📊 현재 상황

**전체 한자 수**: 약 9,000개 이상  
**상세 정보 포함**: **30개만** (의미, 오행, 음양, 획수 모두 포함)  
**기본 정보만**: 나머지 9,000개 이상 (발음, 유니코드만, 또는 의미만)

---

## 🔍 왜 30개만 상세 정보를 가지고 있는가?

### 1. 데이터 소스 구조

#### ✅ 하드코딩된 30개 (상세 정보 완비)
- **위치**: `Application/Engines/Data/HanjaData.cs` 라인 49-107
- **포함 정보**:
  - ✅ 한자 문자 (Character)
  - ✅ 한글 발음 (Reading)
  - ✅ 의미 (Meaning)
  - ✅ 오행 (FiveElement: 木, 火, 土, 金, 水)
  - ✅ 음양 (YinYang: 陰, 陽)
  - ✅ 획수 (StrokeCount)
  - ✅ 카테고리 (Category: 자연, 덕목, 개념)
  - ✅ 성별 선호도 (GenderPref)
  - ✅ 톤 선호도 (TonePref)

**예시**:
```csharp
{ "春", new HanjaInfo { 
    Character = "春", 
    Reading = "춘", 
    Meaning = "봄", 
    FiveElement = "木", 
    YinYang = "陽", 
    StrokeCount = 9, 
    Category = "자연", 
    TonePref = TonePreference.Soft 
} }
```

#### ⚠️ JSON 파일에서 로드된 9,000개 (기본 정보만)
- **위치**: `hanja_dictionary_final.json`
- **포함 정보**:
  - ✅ 한자 문자 (hanja)
  - ✅ 한글 발음 (readings_hangul)
  - ✅ 유니코드 (unicode_hex)
  - ✅ 첫 자음 (initial_consonants)
  - ⚠️ 의미 (meaning_ko) - **일부만 있음**
  - ❌ 오행 (FiveElement) - **없음**
  - ❌ 음양 (YinYang) - **없음**
  - ❌ 획수 (StrokeCount) - **없음**

**코드 확인** (`HanjaData.cs` 라인 246-261) - **✅ 수정 완료**:
```csharp
_loadedDictionary[hanja] = new HanjaInfo
{
    Character = hanja,
    Reading = firstReading,
    Unicode = entry.unicode_hex ?? string.Empty,
    Consonant = firstConsonant,
    Meaning = entry.meaning_ko ?? string.Empty,
    FiveElement = entry.five_element ?? string.Empty, // ✅ JSON에 있으면 사용
    YinYang = entry.yin_yang ?? string.Empty,         // ✅ JSON에 있으면 사용
    StrokeCount = entry.total_strokes ?? 0,           // ✅ JSON에 있으면 사용
    Category = category, // ✅ JSON의 category > 의미 기반 분류 > "기타"
    GenderPref = GenderPreference.Neutral,
    TonePref = TonePreference.Neutral
};
```

**✅ 개선 사항**:
- JSON에 `total_strokes` 필드가 있으면 `StrokeCount`에 반영
- JSON에 `category` 필드가 있으면 우선 사용
- JSON에 `five_element`, `yin_yang` 필드가 있으면 반영

---

## 📈 데이터 로딩 순서

1. **1단계**: 하드코딩된 30개 상세 데이터 로드 (우선순위 높음)
   ```csharp
   // 라인 195-199
   foreach (var kvp in _detailedHanjaDictionary)
   {
       _loadedDictionary[kvp.Key] = kvp.Value;
   }
   ```

2. **2단계**: JSON 파일에서 추가 데이터 로드
   - 기존 상세 데이터가 있으면 유지 (덮어쓰지 않음)
   - 기존 상세 데이터가 없으면 JSON 데이터로 기본 정보 생성
   - **오행/음양/획수는 빈 값으로 설정됨**

---

## 🎯 문제점

### 1. 오행/음양/획수 정보 부족
- **30개**: 완전한 오행/음양/획수 정보
- **9,000개**: 오행/음양/획수 정보 없음
- **영향**: `HarmonyEngine`의 조화 점수 계산이 제한적

### 2. 의미 정보 부족
- JSON 파일에 `meaning_ko` 필드가 있지만, **모든 한자에 의미가 있는 것은 아님**
- 의미가 있으면 자동 카테고리 분류가 수행되지만, 의미 자체가 없으면 "기타"로 분류됨

### 3. 데이터 완성도 낮음
- 전체 9,000개 중 30개만 완전한 정보 (약 0.33%)
- 나머지 99.67%는 기본 정보만 있음

---

## 💡 해결 방안

### 1. hanjadict 데이터 수집 (의미 데이터)
- **목적**: 한자의 의미 정보 확보
- **방법**: `scripts/collect_hanjadict_data.py` 실행
- **결과**: `hanja_meanings.json` 생성
- **효과**: 의미 데이터 추가 → 자동 카테고리 분류 가능

### 2. Unihan 데이터 수집 (구조적 정보)
- **목적**: 획수, 오행, 음양 정보 확보
- **방법**: `scripts/collect_unihan_data.py` 실행
- **결과**: `hanja_unihan.json` 생성
- **효과**: 오행/음양/획수 정보 추가 → 조화 점수 계산 정확도 향상

### 3. 수동 카테고리 매핑
- **목적**: 빈도 높은 한자의 카테고리 지정
- **방법**: `hanja_category_mapping.json` 파일 편집
- **효과**: 자동 분류보다 정확한 카테고리 지정

---

## 📝 데이터 통계 확인 방법

서버 실행 후 다음 API로 확인:
```
GET http://localhost:5000/api/v1/recommendations/hanja-stats
```

**응답 예시** (✅ 개선됨):
```json
{
  "summary": {
    "totalCount": 9000,
    "categorizedCount": 3000,
    "uncategorizedCount": 6000,
    "categorizedPercentage": 33.33
  },
  "dataQuality": {
    "withCategory": 3000,
    "withMeaning": 3000,
    "withFiveElement": 30,
    "withUnicode": 9000,
    "withStrokeCount": 2000,
    "withYinYang": 30,
    "completenessScore": 25.5
  },
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

**✅ 개선 사항**: 데이터 레벨별 통계 추가 (L0~L4)

---

## 🔄 다음 단계

1. **hanjadict 데이터 수집 실행**
   ```bash
   cd scripts
   python collect_hanjadict_data.py
   ```
   - 예상: 5,000~8,000개 한자의 의미 데이터 수집

2. **Unihan 데이터 수집 실행**
   ```bash
   cd scripts
   python collect_unihan_data.py
   ```
   - 예상: 3,000~5,000개 한자의 구조적 정보 수집

3. **데이터 통합 확인**
   - 서버 재시작
   - `/api/v1/recommendations/hanja-stats` API로 완성도 확인
   - 목표: 완성도 50% 이상

---

## 📌 요약

**왜 30개만 상세 정보를 가지고 있는가?**

1. ✅ **30개**: 하드코딩된 상세 데이터 (오행, 음양, 획수, 의미 모두 포함)
2. ⚠️ **9,000개**: JSON 파일에서 로드되지만, JSON에는 오행/음양/획수 정보가 없음
3. 🔄 **해결책**: hanjadict와 Unihan 데이터 수집 및 통합 필요

**현재 상태**: 기본 구조는 완성되었으나, 실제 데이터 수집 및 통합이 필요한 단계
