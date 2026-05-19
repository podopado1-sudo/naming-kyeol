# 한자 데이터 수집 가이드

## 🎯 목표

hanjadict와 Unihan 데이터를 수집하여 한자 데이터의 의미, 획수, 오행, 음양 정보를 확보합니다.

## 📋 사전 준비

### 1. Python 설치 확인

```bash
python --version
# 또는
python3 --version
```

Python 3.7 이상이 필요합니다. 없으면 [python.org](https://www.python.org/downloads/)에서 다운로드하세요.

### 2. hanjadict 라이브러리 설치

```bash
pip install hanjadict
# 또는
pip3 install hanjadict
```

## 🚀 실행 방법

### Windows

```bash
cd scripts
run_data_collection.bat
```

### Linux/Mac

```bash
cd scripts
chmod +x run_data_collection.sh
./run_data_collection.sh
```

### 수동 실행

```bash
cd scripts

# 1. hanjadict 데이터 수집
python collect_hanjadict_data.py

# 2. Unihan 데이터 수집 (선택사항)
python collect_unihan_data.py
```

## 📁 생성되는 파일

스크립트 실행 후 프로젝트 루트에 다음 파일이 생성됩니다:

- `hanja_meanings.json`: 한자별 의미 데이터
- `hanja_unihan.json`: 한자별 획수, 오행, 음양 정보

## ✅ 확인 방법

1. JSON 파일이 생성되었는지 확인
2. C# 프로젝트를 다시 빌드하고 실행
3. `/api/v1/recommendations/hanja-stats` 엔드포인트로 데이터 상태 확인

## ⚠️ 문제 해결

### hanjadict 설치 오류

```bash
# pip 업그레이드
python -m pip install --upgrade pip

# 다시 설치
pip install hanjadict
```

### Unihan 데이터 없음

Unihan 데이터는 수동 다운로드가 필요할 수 있습니다:
1. https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip 다운로드
2. 압축 해제
3. 필요한 파일을 프로젝트 루트에 복사

또는 `unihan-reader` 라이브러리 사용:
```bash
pip install unihan-reader
```

## 📊 예상 결과

- **hanja_meanings.json**: 약 5,000~8,000개 한자의 의미 데이터
- **hanja_unihan.json**: 약 3,000~5,000개 한자의 구조적 정보

의미 데이터가 추가되면 자동으로 카테고리 분류가 수행됩니다!
