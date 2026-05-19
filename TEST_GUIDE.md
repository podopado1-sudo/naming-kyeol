# 이름 추천 시스템 테스트 가이드

## 1. 서버 실행

### 방법 1: 터미널에서 실행
```bash
dotnet run
```

서버가 시작되면 다음과 같은 메시지가 표시됩니다:
```
Now listening on: http://localhost:5000
Swagger UI available at: http://localhost:5000/swagger
```

### 방법 2: Visual Studio / Rider에서 실행
- F5 키를 누르거나 "실행" 버튼 클릭

## 2. API 테스트 방법

### 방법 1: Swagger UI 사용 (권장)
1. 브라우저에서 `http://localhost:5000/swagger` 접속
2. `POST /api/v1/Recommendations` 엔드포인트 클릭
3. "Try it out" 버튼 클릭
4. Request body에 다음 JSON 입력:

```json
{
  "lastName": "김",
  "birthDate": "2024-01-15",
  "gender": "male",
  "tone": "neutral"
}
```

5. "Execute" 버튼 클릭하여 결과 확인

### 방법 2: curl 사용
```bash
curl -X POST "http://localhost:5000/api/v1/Recommendations" \
  -H "Content-Type: application/json" \
  -d "{\"lastName\":\"김\",\"birthDate\":\"2024-01-15\",\"gender\":\"male\",\"tone\":\"neutral\"}"
```

### 방법 3: PowerShell에서 Invoke-RestMethod 사용
```powershell
$body = @{
    lastName = "김"
    birthDate = "2024-01-15"
    gender = "male"
    tone = "neutral"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/v1/Recommendations" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

## 3. 테스트 예시

### 남성 이름 추천
```json
{
  "lastName": "이",
  "birthDate": "2020-05-20",
  "gender": "male",
  "tone": "strong"
}
```

### 여성 이름 추천
```json
{
  "lastName": "박",
  "birthDate": "2021-03-10",
  "gender": "female",
  "tone": "soft"
}
```

### 중성 이름 추천
```json
{
  "lastName": "최",
  "birthDate": "2022-07-25",
  "gender": "none",
  "tone": "neutral"
}
```

## 4. 응답 예시

```json
{
  "id": "abc123def456",
  "topCandidates": [
    {
      "name": "민준",
      "aestheticScore": 85,
      "harmonyScore": 78,
      "finalScore": 83,
      "reasons": [
        "발음이 자연스럽습니다",
        "오행이 조화롭습니다"
      ]
    },
    ...
  ],
  "bonusNicknames": ["민이", "준이"]
}
```

## 5. 추천 결과 조회

생성된 추천의 ID를 사용하여 결과를 조회할 수 있습니다:

```
GET http://localhost:5000/api/v1/Recommendations/{id}
```

예시:
```
GET http://localhost:5000/api/v1/Recommendations/abc123def456
```
