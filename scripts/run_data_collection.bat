@echo off
cd /d %~dp0
REM 한자 데이터 수집 스크립트 실행 배치 파일 (Windows)

echo ========================================
echo 한자 데이터 수집 스크립트
echo ========================================
echo.

REM Python 설치 확인
py --version >nul 2>&1
if errorlevel 1 (
    echo 오류: Python이 설치되어 있지 않습니다.
    echo Python 3.7 이상을 설치하세요.
    pause
    exit /b 1
)

REM hanjadict 설치 확인 및 설치
echo hanjadict 라이브러리 확인 중...
py -c "import hanjadict" >nul 2>&1
if errorlevel 1 (
    echo hanjadict 라이브러리를 설치합니다...
    py -m pip install hanjadict
    if errorlevel 1 (
        echo 오류: hanjadict 설치에 실패했습니다.
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo 1. hanjadict 데이터 수집 시작
echo ========================================
py collect_hanjadict_data.py
if errorlevel 1 (
    echo 경고: hanjadict 데이터 수집 중 오류가 발생했습니다.
)

echo.
echo ========================================
echo 2. Unihan 데이터 수집 시작
echo ========================================
echo 참고: Unihan 데이터는 수동 다운로드가 필요할 수 있습니다.
py collect_unihan_data.py
if errorlevel 1 (
    echo 경고: Unihan 데이터 수집 중 오류가 발생했습니다.
)

echo.
echo ========================================
echo 완료!
echo ========================================
echo 생성된 파일:
if exist ..\hanja_meanings.json (
    echo   - hanja_meanings.json
)
if exist ..\hanja_unihan.json (
    echo   - hanja_unihan.json
)
echo.
echo 다음 단계:
echo   1. 생성된 JSON 파일을 확인하세요
echo   2. C# 프로젝트를 다시 빌드하고 실행하세요
echo   3. /api/v1/recommendations/hanja-stats로 데이터 상태를 확인하세요
echo.
pause
