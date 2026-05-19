# 데이터 재구성 및 수집 가이드

## 완료된 작업

### 1. 데이터 폴더 일원화 ✅
- `data/` 폴더 생성
- 다음 파일들을 `data/` 폴더로 이동:
  - `hanja_dictionary_final.json` → `data/hanja_dictionary_final.json`
  - `hanja_meanings.json` → `data/hanja_meanings.json`
  - `hanja_unihan.json` → `data/hanja_unihan.json`
  - `hanja_category_mapping.json` → `data/hanja_category_mapping.json`

### 2. 로딩 로직 개선 ✅
- `HanjaData.cs`의 `LoadFromFinalJson()`에서 `data/` 폴더 우선 검색
- `LoadExternalData()`에서 `data/` 폴더 우선 검색
- `total_strokes` 필드 읽기 및 오행/음양 자동 계산 보장
- Unihan 데이터에서 획수를 가져와 자동 계산하도록 개선

### 3. 데이터 수집 스크립트 생성 ✅
- `scripts/enhance_unihan_data.py`: Unihan 데이터 강화 (획수 추출 및 오행/음양 계산)
- `scripts/collect_korean_names.py`: 현대 한국어 이름 데이터 수집 (구조만 제공)
- `scripts/collect_hanja_meanings_extended.py`: 한자 의미 확장 수집 (구조만 제공)

## 주요 개선 사항

### total_strokes 필드 처리
- **문제**: 로더에서 총획수와 부수 정보를 무시하고 빈 값을 넣고 있었음
- **해결**: 
  - `LoadFromFinalJson()`에서 `total_strokes` 필드를 우선적으로 읽음
  - `LoadUnihanFromJson()`에서 획수를 업데이트한 후 항상 `AutoCalculateFiveElementAndYinYang()` 호출
  - 획수가 있으면 자동으로 오행과 음양 계산

### 데이터 경로 우선순위
1. `data/` 폴더 (우선)
2. 프로젝트 루트
3. 실행 디렉토리

## 사용 방법

### 1. Unihan 데이터 강화
```bash
cd scripts
python enhance_unihan_data.py
```
- `Unihan_RadicalStrokeCounts.txt` 파일에서 획수 추출
- `data/hanja_unihan.json` 생성/업데이트
- 오행/음양 자동 계산

### 2. 한자 의미 확장 (수동 구현 필요)
```bash
cd scripts
python collect_hanja_meanings_extended.py
```
- 네이버/다음/KHAIii 사전에서 의미 수집
- 부정적 연상 탐지
- **참고**: 실제 크롤링 로직은 웹사이트 이용약관 확인 후 구현 필요

### 3. 한국어 이름 데이터 수집 (수동 구현 필요)
```bash
cd scripts
python collect_korean_names.py
```
- 통계청, 공개 소스에서 이름 데이터 수집
- 발음 패턴 분석
- **참고**: 실제 API 호출 또는 크롤링 로직 구현 필요

## 향후 작업

### 1. 불필요한 파일 정리
다음 파일들은 `data/` 폴더로 이동했으므로 루트의 파일은 삭제 가능:
- `hanja_dictionary_final.json` (이미 이동됨)
- `hanja_meanings.json` (이미 이동됨)
- `hanja_unihan.json` (이미 이동됨)
- `hanja_category_mapping.json` (이미 이동됨)

### 2. CSV 파일 처리
- `data-gov.csv`, `data-naver.csv`: Unihan 데이터 수집에 사용되므로 유지 또는 `data/` 폴더로 이동

### 3. 데이터 수집 자동화
- `scripts/run_data_collection.bat` 또는 `run_data_collection.sh` 업데이트
- 모든 데이터 수집 스크립트를 순차적으로 실행

## 파일 구조

```
NameForm/
├── data/                          # 데이터 파일 일원화
│   ├── hanja_dictionary_final.json
│   ├── hanja_meanings.json
│   ├── hanja_unihan.json
│   └── hanja_category_mapping.json
├── scripts/
│   ├── enhance_unihan_data.py    # Unihan 데이터 강화
│   ├── collect_korean_names.py   # 이름 데이터 수집
│   ├── collect_hanja_meanings_extended.py  # 의미 확장
│   └── ...
└── Application/Engines/Data/
    └── HanjaData.cs              # 로딩 로직 (data 폴더 우선)
```

## 주의사항

1. **웹 크롤링**: 실제 크롤링 시 웹사이트 이용약관을 확인하고 적절한 딜레이를 두어야 합니다.
2. **데이터 라이선스**: 수집한 데이터의 라이선스를 확인하고 준수해야 합니다.
3. **API 인증**: 통계청 등 공식 API를 사용할 경우 인증이 필요할 수 있습니다.
