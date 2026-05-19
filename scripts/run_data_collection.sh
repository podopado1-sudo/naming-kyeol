#!/bin/bash
# 한자 데이터 수집 스크립트 실행 스크립트 (Linux/Mac)

echo "========================================"
echo "한자 데이터 수집 스크립트"
echo "========================================"
echo ""

# Python 설치 확인
if ! command -v python3 &> /dev/null; then
    echo "오류: Python3가 설치되어 있지 않습니다."
    exit 1
fi

# hanjadict 설치 확인 및 설치
echo "hanjadict 라이브러리 확인 중..."
if ! python3 -c "import hanjadict" 2>/dev/null; then
    echo "hanjadict 라이브러리를 설치합니다..."
    pip3 install hanjadict
    if [ $? -ne 0 ]; then
        echo "오류: hanjadict 설치에 실패했습니다."
        exit 1
    fi
fi

echo ""
echo "========================================"
echo "1. hanjadict 데이터 수집 시작"
echo "========================================"
python3 collect_hanjadict_data.py
if [ $? -ne 0 ]; then
    echo "경고: hanjadict 데이터 수집 중 오류가 발생했습니다."
fi

echo ""
echo "========================================"
echo "2. Unihan 데이터 수집 시작"
echo "========================================"
echo "참고: Unihan 데이터는 수동 다운로드가 필요할 수 있습니다."
python3 collect_unihan_data.py
if [ $? -ne 0 ]; then
    echo "경고: Unihan 데이터 수집 중 오류가 발생했습니다."
fi

echo ""
echo "========================================"
echo "완료!"
echo "========================================"
echo "생성된 파일:"
if [ -f "../hanja_meanings.json" ]; then
    echo "  - hanja_meanings.json"
fi
if [ -f "../hanja_unihan.json" ]; then
    echo "  - hanja_unihan.json"
fi
echo ""
echo "다음 단계:"
echo "  1. 생성된 JSON 파일을 확인하세요"
echo "  2. C# 프로젝트를 다시 빌드하고 실행하세요"
echo "  3. /api/v1/recommendations/hanja-stats로 데이터 상태를 확인하세요"
