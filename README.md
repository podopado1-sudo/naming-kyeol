# 이름의 결 — Naming.kyeol

> 미학 기반 + 출생 정보 조화로 한국어 이름을 추천하는 웹 서비스
> **"사주로 이름을 만들지 않는다"** — 먼저 미학적으로 좋은 이름을 고르고, 조화 점수로 추천률을 조정합니다.

[![.NET 10](https://img.shields.io/badge/.NET-10.0-blueviolet)](https://dotnet.microsoft.com/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![Tests](https://img.shields.io/badge/tests-877_passing-brightgreen)]()

---

## ✨ 핵심 가치

- **수치 기반 리포트** — AI는 이야기, 우리는 리포트. 모든 추천에 점수·근거를 명시
- **세대 중립** — 유행 이름·소망형 한자 회피, 시간이 흘러도 어색하지 않은 이름
- **알고리즘 투명성** — 8종 작명 원리(`NamingPrinciples`)를 공개

### 점수 체계

```
FinalScore = AestheticScore × 0.7 + HarmonyScore × 0.3
```

- **미학 점수**: 발음(30) + 리듬(25) + 음절(15) + 세대중립(15) + 의미(10)
- **조화 점수**: 오행(30) + 발음오행(25) + 자원오행(20) + 수리사격(15) + 음양(10)

---

## 🏗️ 기술 스택

| 영역 | 기술 |
|------|------|
| **백엔드** | ASP.NET Core Web API (.NET 10.0) |
| **프론트엔드** | Next.js 16.2 (App Router) + React 19 + TypeScript 5 |
| **스타일** | Tailwind CSS 4 + shadcn/ui + Base UI |
| **DB** | EF Core 10 (SQLite 개발 / PostgreSQL 운영) |
| **로깅** | Serilog (Console + 일별 파일, PII 자동 마스킹) |
| **인증** | API Key 미들웨어 + Rate Limiting |
| **테스트** | xUnit (877개) |

---

## 🚀 빠른 시작

### 백엔드

```bash
# 프로젝트 복원
dotnet restore

# 개발 서버 실행 (포트 5000/5001, Development 모드 자동)
dotnet run

# 테스트
dotnet test

# Swagger UI
# https://localhost:5001/swagger
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev      # 개발 (포트 3000)
npm run build    # 프로덕션 빌드
```

### 환경 변수

**백엔드** (`appsettings.json` 또는 환경변수):
```
ConnectionStrings__DefaultConnection=Data Source=nameform.db
Authentication__Enabled=false
Cors__AllowedOrigins__0=http://localhost:3000
```

**프론트엔드** (`frontend/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_SITE_URL=https://namingkyeol.com
```

---

## 📂 프로젝트 구조

```
NameForm/
├── Api/
│   ├── Controllers/        # REST API (3 controllers)
│   ├── Middleware/         # ApiKey, SecurityHeaders, RateLimiting
│   └── Logging/            # PII 마스킹 정책
├── Application/
│   ├── DTOs/               # 요청/응답 DTO
│   ├── Engines/            # 추천 엔진 16개 + NamingPrinciples
│   │   ├── Data/           # HanjaData, SurnameData 등 사전 데이터
│   │   └── Utils/          # KoreanUtils, FortuneUtils 등
│   └── Services/           # 오케스트레이터 + ScoringService (단일 진실의 원천)
├── Domain/
│   └── Models/             # Recommendation, Saju 등
├── Infrastructure/
│   ├── Data/               # AppDbContext
│   └── Repositories/       # EF Core 저장소
├── Tests/                  # xUnit 877개
├── data/                   # 한자 사전 9,595자 + 부정 발음 패턴 등
├── scripts/                # Python 데이터 수집 스크립트
├── frontend/               # Next.js 16 (별도 워크스페이스)
│   └── src/app/            # 22개 라우트 (App Router)
└── docs/                   # 디자인 브리프, 시스템 프롬프트
```

---

## 🧩 추천 엔진 16종

```
요청 → SmartRecommendationService (오케스트레이터)
        │
        ├── 핵심 (5)
        │   NamePoolEngine        → 한자 후보 100개 생성
        │   AestheticEngine       → 미학 점수 (0~100)
        │   HarmonyEngine         → 조화 점수 (0~100, 용신 통합)
        │   ScoringService        → 채점 단일 진입점
        │   ExplanationEngine     → 리포트 형식 추천 이유
        │
        ├── 변형 (9)
        │   ParentBasedNamingEngine   → 부모 이름 기반
        │   TwinNameEngine            → 쌍둥이
        │   DualNameEngine            → 영어+한자 이중 이름
        │   RareSurnameEngine         → 희귀 성씨 (봉/탁/제갈 등)
        │   RequiredCharEngine        → 필수 글자·항렬자(돌림자)
        │   PureKoreanNameEngine      → 순우리말 (326개 사전)
        │   ThreeSyllableEngine       → 3글자 (139개 큐레이션)
        │   CreativeNamingEngine      → 창의적 작명
        │   NameReversalEngine        → 뒤집기 변형
        │
        └── 분석 (3)
            NameAnalysisService       → 종합 분석
            SajuCalculationService    → 사주 4기둥 (Jean Meeus 절기 알고리즘)
            YongshinCalculationService → 용신 (억부법 + 조후법)
```

---

## 🛡️ 보안

| 계층 | 적용 |
|---|---|
| 봇 차단 | AI 학습 봇 18종 robots.txt 차단 |
| 트래픽 제한 | Rate Limiting (전역 60/분, 비싼 API 20/분) |
| 인증 | API Key 미들웨어 (환경변수) |
| 보안 헤더 | CSP / HSTS / X-Frame-Options / Permissions-Policy 등 7종 |
| 입력 검증 | DTO data annotation (StringLength/Range) |
| PII 보호 | Serilog destructuring policy (이름/출생일/이메일 마스킹) |
| HTTPS | UseHttpsRedirection + HSTS preload 가능 |

---

## 📊 한자 데이터

- **마스터 사전**: `hanja_dictionary_final.json` — 9,595자
- **검수 완료**: Core Dataset v1 2,060자 (오행/음양/획수 완비)
- **대법원/네이버 인명용 한자**: `data-gov.csv`, `data-naver.csv`
- **Unicode Unihan**: 표준 발음·획수·부수
- **한자 획수**: `hanja_strokes.json` 9,190자 (95.8% 커버리지)
- **데이터 소스**: [Korean-Name-Hanja-Charset](https://github.com/rutopio/Korean-Name-Hanja-Charset), Unicode Consortium

---

## 🎨 디자인 시스템

브랜드: "이름의 결 / Naming.kyeol"
- **컬러**: 베이지 paper + 차콜 + Teal + 골드 (RARITY 강조)
- **타이포**: Pretendard (한글) + Noto Serif KR (한자) + Inter (숫자)
- **톤**: 전문성 70% + 친절함 20% + 감성 10%

---

## 📜 라이선스

내부 프로젝트 (라이선스 미정)

---

## 🤝 기여 / 문의

- 이메일: `contact@namingkyeol.com` (예정)
- 임시: `podopado1@gmail.com`

---

## 작명 철학

- 유행 이름 ❌ (감점 처리)
- 소망형 이름 ❌ (`성공`, `천재` 등)
- 세대 중립 (어떤 시대에도 어색하지 않은 이름)
- 발음 리듬 중시 (성씨와의 발음 조합)
- **미학 우선, 사주 보조** (7:3 비율)
