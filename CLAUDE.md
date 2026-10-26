# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소의 코드를 다룰 때 참고하는 안내서입니다.

> 🔄 **세션 인수인계**: 최근 세션의 변경 로그와 다음 작업 후보는 [`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md) 참조.
> 새 세션 시작 시 이 파일과 함께 읽어보세요.

## 프로젝트 개요

**NameForm** (이름의 결 / namingkyeol.com) — 미학 기반 + 출생 정보 조화로 한국어 이름을 추천하는 웹 서비스. "사주로 이름을 만들지 않는다"는 철학 아래, 먼저 미학적으로 좋은 이름을 고르고 조화 점수로 추천률을 조정한다.

> 🚀 **운영 중**: https://namingkyeol.com (2026-05-20 출범) — Vercel(프론트) + Render Free(백엔드 API) + Supabase PostgreSQL(서울). 상세 인프라는 `SESSION_HANDOFF.md` 참조.

### 백엔드
- **언어:** C# (.NET 10.0)
- **프레임워크:** ASP.NET Core Web API
- **아키텍처:** Clean Architecture (Api → Application → Domain ← Infrastructure)
- **데이터베이스:** EF Core 10.0
  - 개발: SQLite (`nameform.db`)
  - 프로덕션: PostgreSQL (Connection string에 따라 자동 분기)
- **한자 사전:** JSON/CSV 9,595자 수록, 이 중 9,105자를 로드 (유니코드 미등재 코드포인트 405자는 `HanjaData.IsHanCodePoint`가 제외,
  호환 한자 85자는 `MergeCompatibilityIdeographs`가 통합 한자에 병합 — 2026-10-22). 수록 범위는 이 사전 파일이 정한다:
  Unihan·core_v1 로더는 사전에 있는 글자만 보강하고 새 글자를 넣지 않는다(백엔드 집합 = /hanja 집합)
- **로깅:** Serilog (Console + 파일 `logs/nameform-{date}.log`, 최근 30개 파일 보존 — 일 롤링)
- **인증:** API Key 미들웨어 (`UseApiKeyAuthentication`)
- **CORS:** `localhost:3000` 허용 (appsettings에서 환경별 오리진 관리)
- **테스트:** xUnit (2,005 테스트, 2026-10-26 — 엔진별 단위 테스트 + 품질 회귀 테스트 포함)

### 프론트엔드
- **프레임워크:** Next.js 16.2 (App Router) + React 19.2 + TypeScript 5
- **스타일:** Tailwind CSS 4 + shadcn 4 + Base UI (Headless)
- **상태/UX:** sonner (토스트) / next-themes / lucide-react (아이콘)
- **위치:** `frontend/` 디렉토리
- ⚠️ **metadata.openGraph는 얕은 병합** — 하위 페이지·레이아웃이 `openGraph`를 쓰면 루트 값(이미지·siteName·locale)이 통째로 사라진다.
  `lib/og.ts`의 `...BASE_OPEN_GRAPH`를 펼친 뒤 title·description·url을 덮고, 세그먼트에 `opengraph-image.tsx`가 있는 곳(`/name/[이름]`)은
  이미지 키 없는 `...OG_SITE`만 펼친다. 아예 안 쓰면 og:url·og:title이 홈 값으로 상속된다(`"use client"` 페이지는 옆 `layout.tsx`에 metadata)
- **조사는 `lib/josa.ts`(`withJosa`·`josa`·`hasBatchim`)로 고른다** — 이름·독음 같은 변수 뒤 조사를 템플릿에 '은(는)'·'(으)로'·'이(가)'로
  박지 말 것(검색 설명문에 "지우은(는)"이 노출됐던 AS-5). 괄호형은 헬퍼가 비한글로 끝나는 말에만 폴백으로 쓴다

## 빌드 명령어

### 백엔드 (루트 디렉토리)

```bash
# 프로젝트 복원
dotnet restore

# 프로젝트 실행 (포트 5000/5001)
dotnet run

# 테스트 실행 (NameForm.slnx 경유 — 2,005개)
dotnet test

# Swagger UI: https://localhost:5001/swagger
# DB는 EF Core EnsureCreated()로 자동 생성됨
```

### 프론트엔드 (`frontend/` 디렉토리)

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 (포트 3000)
npm run dev

# 빌드
npm run build

# 린트
npm run lint

npm test   # 테스트 — node --test "tests/*.test.mjs" (Node 22.18+, lib/*.ts 를 타입 지우기로 바로 읽는다)
```

### 환경 변수
- 프론트: `NEXT_PUBLIC_API_URL` (기본값: `http://localhost:5000/api/v1`)
- 백엔드: `ConnectionStrings:DefaultConnection`, `Cors:AllowedOrigins`

## 폴더 구조

```
D:\MyDev\NameForm\
├── CLAUDE.md                           ← 이 파일
├── Program.cs                          ← 진입점 (DI 등록, 미들웨어, Serilog/CORS)
├── NameForm.slnx                       ← 솔루션 (메인 + Tests — 루트 dotnet test용)
├── NameForm.csproj                     ← 프로젝트 파일 (.NET 10.0)
├── nameform.db (+ .db-shm, .db-wal)    ← SQLite DB (개발)
├── appsettings.json / .Development.json ← 설정 (DB 연결, CORS, API Key 등)
├── Api/
│   ├── Controllers/                    ← REST API 엔드포인트
│   └── Middleware/                     ← ApiKeyAuthentication 등
├── Application/
│   ├── DTOs/                           ← 요청/응답 DTO (Smart, Twin, Dual, Eval, Saju 등)
│   ├── Services/                       ← 오케스트레이터 서비스 다수
│   └── Engines/                        ← 추천 엔진 16개 (인터페이스+구현)
│       ├── Data/                       ← HanjaData, HanjaCsvLoader, CategoryKeywordsLoader
│       └── Utils/                      ← KoreanUtils, FortuneUtils, MorphemeAnalyzer 등
├── Domain/
│   └── Models/                         ← Recommendation, UserFeedback
├── Infrastructure/
│   ├── Data/                           ← AppDbContext (EF Core)
│   └── Repositories/                   ← EfRecommendationRepository (운영)
│                                          + InMemoryRecommendationRepository (legacy)
├── Tests/                              ← xUnit 테스트
├── data/                               ← JSON/CSV 한자 데이터
├── scripts/                            ← Python 데이터 수집 스크립트
├── docs/                               ← 디자인 브리프, 시스템 프롬프트
├── logs/                               ← Serilog 일별 로그 파일
├── frontend/                           ← Next.js 16 프로젝트 (별도 워크스페이스)
│   ├── CLAUDE.md / AGENTS.md           ← 프론트 전용 안내서 (Next.js 16 주의사항)
│   ├── src/
│   │   ├── app/                        ← App Router 라우트 (12개 화면)
│   │   ├── components/                 ← layout / results / ui (shadcn)
│   │   └── lib/                        ← api.ts (API 클라이언트), types.ts, utils.ts
│   └── public/
└── Unihan_*.txt                        ← Unicode 한자 원본 데이터 (3파일, ~13MB)
```

## 아키텍처

### 추천 엔진 파이프라인 (16 엔진)

```
요청 → SmartRecommendationService (메인 오케스트레이터)
          │
          ├── 핵심 엔진
          │     NamePoolEngine          → 한자 기반 이름 후보 100개 생성
          │     AestheticEngine         → 미학 점수 0~100 (발음 30 + 리듬 25 + 음절 15 + 세대중립 15 + 의미 10 - 감점)
          │     HarmonyEngine           → 조화 점수 0~100 (자원오행 보완 30 + 획수 조화 20 + 음양 10 + 발음오행 25 + 전통 81수리 15 — 성조화 필드는 폐기, 항상 0)
          │                               ⚠️ 2026-10-22 S4 축 이름: '자원오행 보완' = 배정 한자의 부수 기준 자원오행 ↔ 사주(옛 '오행 30'),
          │                               '획수 조화' = 두 글자 획수 합 구간(옛 '자원오행 20' — 오행 무관). 산식·DTO 필드명(fiveElement·resourceElement) 유지
          │                               ⚠️ S5a 수리 15 의 성씨 획수 = 성씨 대표 한자 표(`SurnameData.RepresentativeHanja` — 이 李·박 朴·유 柳, 복성은
          │                               두 글자 합). 표 밖 성씨만 음절마다 독음 1순위 한자로 추정(옛 방식: 이 → 11획, 남궁 → '남'만)
          │                               ⚠️ S5b 자원오행 보완 30: 사주 과다 오행 감점(−10)에서 용신·희신은 뺀다(EV-5 — 옛 노트 '가점 일부 상쇄 (감점)' 없음)
          │                               ⚠️ S5c-1 음양 10 = 배정 한자 획수 홀짝(홀수 陽) 하나 — 옛 hanja_unihan.json 의 거꾸로 된 음양(짝수 陽)·Core 원획 홀짝 없음
          │                               ⚠️ S5c-2 획수 조화 20·음양 10·수리 15 의 한자 획수 = data/hanja_strokes.json(Unicode 18.0 kTotalStrokes, S5c-3) — /hanja 와 같은 파일·같은 값
          │                               ⚠️ 2026-10-26 B3 획수 조화의 'Core 아니면 ×0.85 · 획수 자료 미검수 글자 포함' 폐기(획수가 한 출처라 Core 여부와 무관 —
          │                               계획 §2-4). 획수 미상(음절에 한자 없음 → 5로 채움) ×0.75 와 '획수 정보 부족' 노트만 남는다
          │     RankerEngine            → 최종 점수 = aesthetic * 0.7 + harmony * 0.3
          │     ExplanationEngine       → 추천 이유 3줄 생성
          │     RarityScoringEngine     → 희귀도/독창성 점수
          │
          ├── 변형 엔진 (특수 작명)
          │     ParentBasedNamingEngine → 부모 이름 기반 (음운/의미 계승, 가족 서사)
          │     TwinNameEngine          → 쌍둥이 (공유글자/공유의미/공유톤 세트)
          │     DualNameEngine          → 영어+한자 이중 이름 (음역/의미 매핑)
          │     RareSurnameEngine       → 희귀 성씨/복성 최적화
          │     RequiredCharEngine      → 필수 글자 포함
          │     PureKoreanNameEngine    → 순우리말 이름
          │     ThreeSyllableEngine     → 3글자 이름
          │     CreativeNamingEngine    → 창작/창의 작명
          │     NameReversalEngine      → 뒤집기/변형 이름
          │
          │  ※ 상호 엔진은 이 파이프라인에 들어오지 않는다 (아래 별도 항목)
          │
          └── 분석/평가 서비스
                NameAnalysisService     → 이름 평가 (한자/사주/음령오행)
                NameEvaluationService   → 상세 평가 (Aesthetic·Harmony Breakdown)
                SajuCalculationService  → 사주 4기둥 계산
                YongshinCalculationService → 용신 분석 (억부법 + 조후법)
```

### 상호 작명 엔진 (2026-08-28 추가) — 인명과 분리된 벌티컬

```
요청 → CompanyNamingEngine (단독, SmartRecommendationService를 거치지 않음)
          ├── 한자 조합    검수된 한자쌍 120개에서 선택 (조합 생성 안 함)
          ├── 순우리말     축 어근(앞) + 검수 어미 15개(뒤) 합성
          └── 영문 조어    라틴 어근 + 접미 → RomanizationUtils로 한글 음차
```

**인명 엔진을 재사용하지 않는 이유** — 성씨가 없어 `AestheticEngine`의 성+이름 연음
평가(30점)가 성립하지 않고, 글자 풀에 인명용 한자 제약이 없으며, 평가축이 다르다.

- **점수 100 = 기억성 30 + 발음 25 + 식별력 25 + 업종적합 20**
  식별력이 상호만의 축이다 (상표법상 기술적 표장 회피 + 검색 매몰 회피)
- **의미 축 12개 × 업종 18개 × 톤 5개** — 업종은 축을 고르기만 하므로 업종 추가 시 새 어휘 불필요
- ⚠️ **한자 축은 큐레이션이 계약이다.** 자유 순열은 기존 한자어와 동음 충돌을 피할 수 없다
  (실측: 도달 가능 1,797개에 久續=구속·工匠=공장·安靜=안정 혼입). 쌍을 추가할 때는
  한글 표기가 기존 한국어 단어·유명 고유명사와 겹치지 않는지 반드시 확인할 것
- ⚠️ **받침 + ㄹ초성 금지** — 유음화·비음화로 표기와 발음이 갈라진다
  (溫林"온림"→[올림], 旭林"욱림"→[웅님]). 상호는 듣고 받아적는 이름이라 치명적이다.
  `CompanyNamingEngineTests.HanjaPairs_NoLiquidNasalShift`가 기계적으로 막는다
  **순우리말 결합도 같은 규칙(2026-10-21)** — 어근+어미 경계의 비음화(볕누리→[변누리])·유음화(결누리→[결루리])·
  겹받침(앎채→[암채])·대표음 연음(ㅅㅆㅈㅊㅋㅌㅍㅎㄲ+ㅇ, 볕우리→[벼두리])·ㄴ첨가(받침+이·야·여·요·유)를
  `ShiftsAtRootTailJoin`이 거른다(어근+어미 경계 전용 — 이름 전체를 훑는 `HasSoundShift`에 넣으면 맺음[매즘] 같은
  어근 안 연음까지 오탐). 기대값은 조항별 사례표 `SoundChangeCases`(독립 기준), `KoreanCompounds_NoNasalLiquidShift`가 전수 검사
- ⚠️ **한자쌍 제외 이력** — 2026-10-21 서림(책방)·서각(공예)·청실·승원(사찰)·서흥(상장사)·각원(各員)을 사전어·기존 상호
  동음으로 제외(126→120). 제외 쌍은 `HanjaPairs_RemovedPairsStayRemoved`에 등록해 되살아나지 않게 한다
- **완전일치 차단 목록 `CompanyNamingData.BlockedNames`** — 상장사·대형 브랜드(노타·프리마·서흥)와 업종에 정면으로
  어긋나는 연상(카론=저승 뱃사공·준타=군사정권·카렌·리비아·새우리), 한국어 활용형·사전어로 읽히는 영문 음차
  (온다·온도·마라·솔로·멘토·메시아·메세나·리본)와 테라. 하나를 막으면 같은 부류 다음 순번이 올라오니(두더지) 덤프로 부류째 본다.
  생성 가능한 후보 전체는
  `dotnet test --filter Dump_AllCoinagesForReview`로 뽑아 사람이 검수해 채운다(자동 판정 아님)
- ⚠️ **`WeakGivenNameHanjaSet`을 적용하지 않는다** (`ForbiddenNameHanjaSet`만 적용).
  그 세트는 인명 기준이라 味·香·器 같은 상호 적격 글자를 잘못 배제한다
- 후보별 `Cautions`는 실사용에서 뜨지 않는다(감점이 커서 상위 진입 불가). 대신
  응답의 `KeywordNotices`가 "넣은 업종어를 왜 안 썼는지"를 결과 위에서 알려준다
- 키워드가 공용 금칙어(한 음절 '화·피·개' 포함, 부분일치)에 걸리면 **생성 전에 거절하고 이유를 안내**한다
  (`ForbiddenPartOf` — 공용 `ForbiddenWordData`는 읽기만, 인명 엔진과 공유라 수정 금지). 한자 키워드(淸·林)는 **그 글자
  자체로만** 축과 검수쌍에 맞춘다 — 독음은 거절 판정과 조사에만 쓰고 순우리말 재료로 넣지 않는다(林→두음 '임'이 稔 동음으로
  HARVEST 축을 끌어오고 '임'이 순우리말로 표시되던 것). 라틴 뜻풀이는 **완전일치**만 본다(부분일치였을 때 mente '마음'이 WISDOM
  축을 뒤집었고, 통째로 끄면 꽃·바다가 축을 못 움직였다 — mente 뜻풀이는 '생각하는 힘').
  키워드는 cleanKeywords 단계에서 NFC 정규화 한 번(IME가 만든 호환 한자 林 U+F9F4 대응). 축 씨앗(HanjaIndex) 한자(和·開)는
  독음 금칙어(화·개) 판정을 건너뛴다. 한자·한글이 섞인 키워드('淸빛')는 조각으로 나눠 각각 처리한다. '푸는 법' 안내는
  실제로 막은 조건(결·글자 수)만 말한다
- `/company` 화면의 정적 안내(`frontend/src/app/company/CompanyGuide.tsx`)가 점수 만점·한자쌍 규칙·감점 예시를 글로 설명한다
  — 엔진 계약을 바꾸면 이 파일도 같이 고칠 것. 업종을 더하면 `company/options.ts`도

**톤이 결과를 바꾸는 방식 (2026-08-28 개편)** — 원래 톤은 업종이 고른 4개 축 안에서만
가점해서, 두 톤의 교집합이 같으면 점수 함수가 완전히 같아졌다
(실측: 6개 업종에서 modern과 playful이 12개 결과 100% 동일). 자유도 3개를 줬다:
1. **서명 축 주입** (`ToneProfile.SignatureAxes`) — 업종이 안 고른 축을 0.55 가중치로
   재료 풀에 들여온다. ⚠️ 18업종에서 5톤의 주입 축이 모두 달라야 하며
   `ToneSignatureAxes_DistinctPerIndustry` 테스트가 이를 지킨다
2. **결 쿼터** (`ToneProfile.StyleQuota`) — 12칸의 한자/우리말/영문 구성비를 톤이 정한다
   (클래식 7/4/1, 따뜻함 2/8/2 등)
3. **소리결** (`ToneProfile.Shape`) — 같은 재료에서 다른 표기를 고르게 한다.
   Memorability 30 중 6점. 연속 경음 감점(6)·식별력 감점(12)을 못 이기도록 일부러 작다
- ⚠️ `axisWeights` 정렬에 `ThenBy(Ordinal)` 필수 — 주입값(0.55)과 업종 4순위(0.6)가
  근접해 Dictionary 열거 순서에 노출된다. 빼면 같은 입력에 다른 결과가 나온다

**키워드 3갈래** — 1~2음절 한글만 재료가 되던 것을 넓혔다.
어미 절단(정성스러운→정성) / 한자 음절 매칭(지혜→智·惠 든 검수쌍 가점) /
반영 못 하면 안내. `SelectDiverse`가 키워드 적중 후보에 한 자리를 예약한다.
- ⚠️ 한자 음절 매칭은 **소리 매칭**이다 — `KeywordHanjaChars`는 키워드 음절과 독음이 같은 한자를 고를 뿐 뜻은 보지 않는다
  (惠는 '은혜 혜'라 '지혜'와 뜻이 다르고, 慧는 검수쌍 120개에 없어 나오지 않는다). 안내 문구·FAQ에 '같은 뜻의 한자'라고 쓰지 말 것
- ⚠️ **키워드 안내(`BuildKeywordNotices`)는 반드시 최종 목록을 보고 발화한다** —
  결=한자·글자 수=2에서는 어근이 들어갈 경로가 없어, 선택 결과를 안 보고 안내하면
  "'정성'만 따서 썼어요"라고 말하고 목록에 0개인 거짓 약속이 된다(2026-08-30 점검에서
  실재 재현→수정). 들어갔으면 절단 안내 / 한자로 담겼으면 그 사실 / 조건 탓이면 푸는 법 안내

### 최종 점수 공식
`FinalScore = AestheticScore * 0.7 + HarmonyScore * 0.3`

### DI 수명: 모든 서비스/엔진/저장소 = **Scoped**

### 카테고리 정렬 우선순위 (탭 UX)
`standard` → `pure-korean` → `three-syllable` → `creative` → `parent-based` → `required-char` → `dual-name` → `twin` → `rare-surname`

### TopPick (2026-04-21 추가)
모든 카테고리 후보 중 최고점을 `SmartRecommendationResponseDto.TopPick`에 노출.
사용자가 전체 탭을 돌지 않아도 핵심 추천을 즉시 파악 가능.

## API 엔드포인트

### 추천/생성 계열
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/recommendations` | 이름 추천 생성 (전통 RecommendationService) |
| POST | `/api/v1/recommendations/smart` | 스마트 통합 추천 (카테고리 탭 결과) |
| POST | `/api/v1/recommendations/pure-korean` | 순우리말 이름 |
| POST | `/api/v1/recommendations/creative` | 창의적 작명 |
| POST | `/api/v1/recommendations/three-syllable` | 3글자 이름 |
| POST | `/api/v1/recommendations/required-char` | 필수 글자 포함 |
| POST | `/api/v1/recommendations/parent-based` | 부모 이름 기반 |
| POST | `/api/v1/recommendations/dual-name` | 영어+한자 이중 이름 |
| POST | `/api/v1/recommendations/rare-surname` | 희귀 성씨 |
| POST | `/api/v1/twin-names` | 쌍둥이 이름 (공유글자/공유의미/공유톤 세트) |

### 분석/평가
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/name-analysis` | 이름 분석 (한자/사주/음령오행) |
| POST | `/api/v1/recommendations/evaluate` | 이름 상세 평가 (Aesthetic·Harmony Breakdown) |

### 조회/메타
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/v1/recommendations/{id}` | 추천 결과 조회 |
| GET | `/api/v1/recommendations/hanja-stats` | 한자 데이터 통계 |

### 상호 (회사명 · 가게명 · 브랜드명)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/company-names` | 상호 후보 생성 (업종·톤·생성축·음절·키워드) |
| GET | `/api/v1/company-names/options` | 입력 옵션 목록 (업종 18 · 톤 5 · 생성축 4) |

### 피드백
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/recommendations/feedback` | 사용자 피드백 제출 |
| GET | `/api/v1/recommendations/{id}/feedback` | 피드백 목록 조회 |
| GET | `/api/v1/recommendations/{id}/feedback/summary` | 피드백 집계/요약 조회 |

### 사용량
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/usage/event` | 프론트 탭 클릭 이벤트 수신 (`tab_view`만 허용, sendBeacon 대상) |
| GET | `/api/v1/usage/summary` | 기간별 사용량 집계 조회 (`days` 기본 30, 최대 365) |

## 한자 데이터 구조

### HanjaInfo 필드
- 기본: Character, Reading, Meaning, Unicode, Consonant
- 오행: FiveElement (木/火/土/金/水 — **부수 기준 자원오행**, `data/hanja_resource_element.json` 의 e 하나만 쓴다, 2026-10-22 S4),
  ResourceGrade (R 확정/V 이견 있음/X 예외 적용/U 미상), RadicalNumber·RadicalChar·AltRadicalElements·AltCharElements, Rationale(부수 근거 한 줄 = 결과 파일 note),
  YinYang (陽/陰 — StrokeCount 홀짝, 홀수 陽, 2026-10-22 S5c-1), StrokeCount (Unicode 18.0 kTotalStrokes — `data/hanja_strokes.json`, /hanja 와 같은 파일, S5c-2·3),
  KangxiStrokes(Core 강희 원획 — 보존·표시만, 원획법 수리·음양은 D10 별도 결정)
- 옛 뜻 기반 오행(D4 — 보존만, 화면·점수에 안 씀): MeaningElement·MeaningRationale(core_v1 → radical_map, 옛 획수 대체값 D 는 없음),
  ConfidenceGrade(옛 S/C/D — FiveElement 와 무관). 옛 S 에 기대던 가중치(관련도 +100)는 `IsCoreData`(Source == Core_v1, 옛 S 와 같은 집합)로 옮겼다.
  옛 '획수 조화 감산(Core 아니면 ×0.85)'은 2026-10-26 폐기(B3) — `IsCoreData` 를 획수 신뢰도 신호로 쓰지 말 것(Core 2,054자 중 404자는 점수 획수 ≠ Core 강희 획수)
- 카테고리: Category (자연/덕목/개념), CategoryMajor/Minor, Tags, Evidence, Confidence
- 선호: GenderPref (Neutral/Male/Female), TonePref (Neutral/Soft/Strong)

### 데이터 소스
- **하드코딩 상세 데이터**: 35자 (뜻 기반 오행·음양·획수 — 획수·음양은 S5c 부터 data/hanja_strokes.json 획수와 그 홀짝이 덮는다). ⚠️ 키는 한자만 — 초기 커밋의 한글 음절 키
  10건(우·진·서·하·윤·민·지·현·연·채, 뜻 "하=아래" 등 오류)은 2026-09-08 제거, 가드 테스트
  `GetAllHanja_ContainsNoNonHanCodePoints`가 비한자 키를 막는다
- **data/hanja_resource_element.json**: 부수 기준 자원오행 결과 파일(S1 `scripts/build_resource_element.py` — 대상 = 사전 파일 등재 한자 키,
  `scripts/hanja_target_set.py`). 백엔드 `HanjaData.ApplyResourceElements`(호환 한자 병합 뒤 통합 키에만 — 호환 키 compat_of 는 적용 안 함)와
  `build_hanja_seo_data.py`(복사만, 계산 안 함)가 같은 파일을 읽는다. 대조: `dotnet run -- dump-hanja-elements OUT` →
  `python -I scripts/audit_hanja_elements.py --dump OUT`(백엔드 ↔ 결과 파일 ↔ hanja-seo 불일치 0, 전환 전 1,151자)
- **data/hanja_strokes.json**: 9,190 키 총획수 = Unicode 18.0 kTotalStrokes(`scripts/build_hanja_strokes.py`, `--check` 로 대조 — 입력 tmp/unihan-18.0).
  백엔드 `HanjaData.ApplyStrokeCounts`(StrokeCount 의 유일한 기록자 — 호환 병합 뒤 통합 키, 없으면 호환 키 값)·`ApplyYinYangFromStrokes`(YinYang = 획수 홀짝)와
  `build_hanja_seo_data.py`(/hanja s·y)가 같은 파일·같은 규칙이다(2026-10-22 S5c — 계획 §5 '획수 출처 통일 · 음양 홀짝 통일', D9 '프론트 kTotalStrokes 로 통일').
  S5c 전 백엔드는 hanja_unihan.json(kRSAdobe_Japan1_6 자형 획수, 음양은 수집 스크립트가 짝수를 陽 으로 거꾸로)·Core 원획 홀짝·하드코딩 수동 값이 섞여
  /hanja 와 획수 832·음양 6,821자 달랐다.
  S5c-3 전 파일은 18.0 이전 kTotalStrokes 첫 값(중국 대륙 자형 — 修 9·成 6·道 12·福 13, 성씨 鄭 14)이라 296키를 18.0 값(修 10·成 7·道 13·福 14·鄭 15)으로
  바꿨다(/hanja 표시는 S6 재생성 때). ⚠️ 18.0 도 한국 자전과 다 같지는 않다 — 왼쪽 阝 2획(院 9·陳 10·陸 10), 艹 3획이 남은 글자(權 21·蘇 19),
  그 밖 延 8·甄 13·郝 9(한국 자전 10·11·11, 22·20, 7·14·10). 성씨 수리에도 그대로 들어간다(진·육·권·소·연·견·학). 성씨만 따로 보정하는 표는
  두지 않는다(획수 출처가 다시 둘이 된다) — 자형·원획법은 D10. 강희 원획 대조 근거는 스크립트 머리말
- **hanja_dictionary_final.json**: 9,595자 (마스터 통합 사전). ⚠️ 이 중 405자는 대법원 목록의
  유니코드 미등재 글자가 법원 자체 코드(a01b1 등)로 변환된 가짜 코드포인트(U+A0xxx·U+F0xxx) —
  백엔드 로더(`HanjaData.IsHanCodePoint`)와 `build_hanja_seo_data.py`가 같은 영역 규칙으로 걸러낸다.
  ⚠️ 원본은 gov CSV 의 쉼표 독음 칸(`"금,김"`)을 한 덩어리로, 빈 초성을 'nan' 으로 실은 864항목이 깨져 있었다 —
  2026-10-22 `scripts/repair_hanja_dictionary.py`(멱등, `--check`)로 수리. 호환 한자 85자(金 U+F90A 등)는 파일에 남아 있고
  로더·빌드가 NFKC 로 통합 한자에 병합한다(뜻이 호환 쪽에만 있던 金·蘭·朗·廊·剆 은 수리 때 통합 쪽에도 넣음)
- **data-gov.csv / data-naver.csv**: 대법원/네이버 인명용 한자. ⚠️ CSV 는 Web SDK 의 Content 가 아니라서
  `NameForm.csproj`의 `None Update="data\**\*.csv"`로 산출물에 넣는다(2026-10-22 전까지 publish 에 빠져 운영 `IsGovernmentListed` 전부 false)
  ⚠️ `IsGovernmentListed` = 두 CSV 어느 쪽에든 실린 글자(`HanjaData.GovernmentListCsvFiles`, 2026-10-26 B1). data-gov.csv 만 보면 50자가 빠진다 —
  ㄴ 구획이 '냉'(1636행) 뒤 바로 '다'라 ㄴ 으로만 읽는 努·能·農·腦·訥 등 32자가 0행, 姬(→ 姫 U+59EB)·港·珊·慜·冕 등 18자는 법원 자체 코드
  (U+A0xxx·U+F0xxx)로만 실림. 50자 모두 data-naver.csv 근거, 두 CSV 어디에도 없는 적재 글자 0(적재 9,105자 전부 등재 — `OpsVerificationRegressionTests`).
  CSV 에 행을 지어 넣지 않는다. 자체 코드 ↔ 실제 글자, 姬 ↔ 姫 는 Unihan 변형 근거가 없어 잇지 않는다.
  /hanja 의 `gov`(hanja-seo)도 같은 규칙 — `build_hanja_seo_data.py` 가 사전 sources 'gov' 또는 'naver' 면 gov 1(2026-10-26 B1 재생성, 9,105자 전부 —
  상세 50쪽의 '인명용 목록 외'·메타 설명이 바뀜). ⚠️ gov 가 전 글자 1이라 `build_hanja_variants.py` 의 정렬 기준 ③(gov_list)은 더 갈라 주지 않는다
  (그 스크립트를 다시 돌리면 이체자 대표가 바뀔 수 있으니 결과를 대조할 것). +500 으로 오른 글자의 두더지 검수 기록은 HanjaData.cs 불용 7차·weak 2026-10-26 블록
- **Unihan_*.txt**: Unicode 표준 발음/획수/부수 데이터
- **data/hanja-gloss-overrides.json**: 대표 훈 오버라이드 98자 (然 불탈→그럴 연, 潤 불을→윤택할 윤·荷 멜→연꽃 하(2026-10-22)·蘇 차조기→되살아날 소(2026-10-26, 신규 훈 앞에 삽입) 등,
  로드 시 Meaning 재배열 — 원 훈 보존·멱등, 소비처는 첫 훈만 취하므로 무수정 전파).
  ⚠️ 재배열이라 옛 첫 훈도 남는다 — `mean_combo_check`는 그 조각(潤 '불을 윤'의 어간 '불')을 계속 그 글자의 키워드로 봐서
  옛 훈으로 윤문된 문장(潤 1순위 이름의 '불꽃처럼…')을 모순으로 잡지 못한다. 대표 훈을 바꾼 글자는 뜻·서사를 손으로 대조할 것
  — 潤·荷는 `scripts/audit_gloss_override_text.py --json OUT`이 고칠 문장 목록(파일·키·현재 문장)을 뽑는다(/name 재생성 직후)
- **data/hanja-gender-overrides.json**: 성별 선호 오버라이드 4자 (赫·焃·焱·秀 → Neutral, 2026-10-22). GenderPref 기록자
  (하드코딩 → unihan → 의미 분류기 → 호환 병합)는 모두 Neutral 칸만 채워 잘못 찍힌 값을 뒤에서 못 고치므로 맨 마지막(`ApplyGenderOverrides`)에 덮는다.
  키워드 전면 재분류 대신 영향이 큰 글자만 여기서 고친다(赫 Female 때문에 남자 혁 이름 1순위를 侐 '고요할'이 차지했다).
  恩·秀는 하드코딩 Female 도 뺐다(恩은 다른 출처가 Neutral 이라 그것으로 충분). 惠는 둔다 — 혜 줄 빈출 惠·慧·蕙가 모두 Female 이라
  상쇄되는데 惠만 바꾸면 여자 혜 이름 1순위가 慧로 넘어간다(`HanjaGenderOverrideTests`)
  ⚠️ 의미 분류기(`GenderToneClassifier`) 보석 키워드에 '산호'를 더했다(2026-10-26 보완 — 珊·瑚 두 글자만 걸림). 옥·구슬 훈 글자(珠·玉·琳·瑛·璐 …)는 모두
  Female 인데 산호만 Neutral 이라, B1 로 珊이 山과 관련도가 같아지자 남자 산 이름 조합이 오행 상생 가점만으로 珊 으로 넘어갔다. 오버라이드 파일이 아니라
  분류기를 고친 것은 원인이 키워드 누락이어서다(오버라이드 4자는 그대로). dump-name-scores 는 바이트 그대로
- **data/combo-meanings.json**: 한자쌍 자연어 뜻 28,700쌍 (LLM 배치 윤문 + 소량 인라인, 런타임 비용 0. 2026-10-22 자원오행 전환 재생성 때 Sonnet 5.5 배치로 5,009쌍,
  두더지 검수 뒤 211쌍은 손으로 씀 — API 크레딧 소진. 2026-10-26 B1 재생성 새 쌍 42개(努 19·珊 23)는 `build_combo_meanings.py --resume --model claude-sonnet-5-5
  --thinking between_tools` 배치 — 입력 26,571·출력 774 토큰, 약 $0.03. 같은 날 보완 단계 두더지 재생성의 새 쌍 17개(沕結·紏燦·瀣朗·裕土 등)도
  같은 설정 배치 — 입력 10,785·출력 291 토큰, 약 $0.01. 같은 날 부정 훈 정리 재생성의 새 쌍 4개(文岒·柱驛·羅黚·馭玲)도 같은 설정 배치 —
  입력 2,545·출력 72 토큰, 약 $0.003. 이어진 보완(검증 지적) 재생성의 새 쌍 4개(㦐羅·羅㦐·多濔·待濔)는 손으로 썼고, 공개 휘겸 4순위 輝嗛 문장이
  1순위 輝謙·대표 뜻과 같은 문장이라 손으로 바꿨다(嗛 '겸손할' 유지 — 같은 페이지 조합 뜻 중복 쪽수 52→51). ⚠️ `python -I` 는 PYTHONIOENCODING 을 무시해 Windows 콘솔(cp949)에서 끝 샘플 출력이
  UnicodeEncodeError 로 죽는다 — 파일은 그 전에 저장되니 결과 수(완료/오류/만료)만 확인하고 다시 돌리지 말 것. `python -I -X utf8` 로 돌리면
  콘솔 출력도 UTF-8 이라 죽지 않는다. 키가 사용자 환경변수에만 있으면 PowerShell 에서 프로세스 환경으로 옮겨 돌린다 — 키 값을 출력하지 말 것).
  ⚠️ `data/creative-name-meanings.json`(대표 뜻 원천)에는 손질 항목이 많다(외래 이름 어원 71·순우리말 16+72·潤·朗·蘭·西 손질 82, 2026-10-22) —
  `build_creative_meanings.py`를 다시 돌리면 덮어써지므로 돌리기 전에 손질분을 따로 보존할 것.
  외래 이름 뜻은 **어원 문장**만 쓴다 — '{언어}로 {뜻}{이라는|라는|다는}'(히브리어로 신이 더하신다는·아일랜드어로 곱게 태어났다는). 이름 사전·성경 본문에
  실린 표준 풀이만, 갈리거나 불확실하면 비운다(S7 — 하엘 '하늘처럼 넓고 포근한'·다엘 '차처럼…'·요셉 '세상을 환히 밝히는' 같은 한자 풀이식 뜻 23명을 비우고
  14명을 어원으로 바꿈, 뜻이 없던 29명에 어원). 이름 사전이 '전해지는 풀이'로만 적는 어원은 '…라는 풀이가 전해지는/있는'(라이언·에스더).
  `NameSeoFlagTests`가 어원 문장이 외래 목록 밖 이름에 붙는 것을 막는다.
  순우리말(pk) 이름 뜻은 **한글 이름의 뜻**만 쓴다(S7 — 구름 '차갑게 빛나는 옥빛 기품'(玖凛)·노을 '옥빛처럼'(璐)·해솔 '바다처럼'(海)처럼 한자 조합 훈에서
  온 뜻 72명을 PureKoreanNameEngine 사전 풀이 기준으로 바꿈. 발행 블로그가 인용한 다온·한결은 그대로). build 는 pk 이름을 조합 뜻으로 모순 교체·빈 뜻
  폴백하지 않고, pk 뜻이 자기 조합 뜻과 같으면 실패한다
- **data/foreign-given-names.json**: 조합 없는 /name 이름 중 외래 이름 125명(이름 → 갈래 성경·서양·일본·조어·갈래 여럿, 사람 검토 목록).
  조어 = '-엘'처럼 외래 요소로 한국에서 지은 이름(하엘·라엘 — 원어 이름 없음, 블로그 12편 '한국 조어계'). 3음절은 `build_insight_three_syllable.py`의
  '외래' 58명과 같다. `dump-name-flags`만 읽는다(런타임 미사용). 이레·그린·드림·나나·이든(순우리말 사전) 같은 이름은 넣지 않는다(고유어·기원 갈림)
- **data/pure-korean-name-overrides.json**: /name `pk` 판정의 가감 목록(사람 검토, 2026-10-22 S7). exclude 14 = 순우리말 사전에 있지만 한자어 낱말
  (소망·미래·다정·미소·수련·진솔·강해)이거나 한자 이름으로 흔한 이름(예린·하린·예나·한나·보미·가야·마리), include 15 = 사전에 없지만 '별'이 고유어라
  한자 조합이 소리만 맞춘 이름(한별·은별·예별… — 別·莂·潎·炦에 별(星) 뜻이 없다). `dump-name-flags`만 읽는다(런타임 순우리말 추천 엔진은 사전 그대로)
- **/hanja·/name 정적 데이터의 플래그 필드 (2026-10-22 S7)** — 값은 모두 1, 아니면 키 생략:
  - hanja-seo.json `nf` = ForbiddenNameHanjaSet(불용 — 이름 생성·추천·/evaluate 배정에서 빠지는 글자, 972자 — 2026-10-26 부정 훈 정리·보완), `wk` = WeakGivenNameHanjaSet(뜻이 약해
    동음 대안이 있으면 양보 — 배제 아님, 830자, nf 글자에는 안 붙음). `dotnet run -- dump-hanja-quality`(루트 hanja-quality.json) → `build_hanja_seo_data.py`
    (덤프 없으면 실패). 화면에서 '이름에 피하는 글자'는 nf 만 — wk 를 피하는 글자로 쓰지 말 것. 글자 단위 판정이라 독음마다 다른 훈(烋 휴·효)은 구분하지 않는다
  - name-seo.json `pk` = 한글 이름으로 쓰는 순우리말 이름(120명, 조합 유무 무관 — ND-3 '한자로 쓴다면(참고)', '추천 1순위' 없음) =
    PureKoreanNameEngine 내장 사전 − exclude + include(`data/pure-korean-name-overrides.json`, `PureKoreanNameEngine.IsPureKoreanSeoName`).
    `fx` = 한자 조합이 없고 외래 목록에 있는 이름(125명 — 뜻 있는 71명은 어원 문장, 54명은 뜻 없음 — 화면은 '어원이 분명하지 않아 뜻풀이는 적지 않았습니다',
    fx 서사(story)는 한자 훈으로 지은 문장이라 /name 이 내지 않는다). pk 와 fx 는 겹치지 않는다. `dotnet run -- dump-name-flags`(루트 name-flags.json — 갈래·영한 이름 지도 교차 확인 en 포함) →
    `build_name_seo_data.py`(덤프 없는데 기존 출력에 플래그가 있으면 실패, fx 인데 조합이 있으면 실패)

### 글자 품질 세트 (HanjaData.cs 인라인, 2026-07-02 기준)
- **ForbiddenNameHanjaSet 974자** — 명백 부정 훈 하드 배제. 생성·추천 경로, /evaluate 배정(HanjaSelector)·후보 표, /name-analysis 후보 카드
  (`HanjaSelector.OrderForDisplay` 상위 10 — 2026-10-26 B8, 옛 '평가/분석은 통과'는 S4-2 전 문구)에서 모두 빠진다. /hanja 사전에는 남아 '이름에 피하는 글자'로 표시 —
  雌(암컷 자)는 2026-10-22 S3 weak 로는 박영자(여)=映雌 배정이 남아(weak 는 양보) S4 에 여기로 옮겼다(대체 배정 慈 — 姿→紫 는 S4 자원오행 전환 효과).
  호환 코드포인트는 NFKC 정규형 조회로 자동 차단 (리터럴 등재 금지 — NFC 정규화 회귀 전력). `IsWeakGivenNameHanja`도 같은 폴백.
  2026-10-26 부정 훈 정리부터 두 세트의 새 글자는 `"\u6841"` 같은 C# 유니코드 이스케이프로 적는다(주석에 글자·훈·선례) — 감사 스크립트가 세트를 읽는
  `scan_weak_name_candidates.extract_charset_from_cs` 는 이스케이프를 글자로 푼다(전에는 리터럴만 읽어 이스케이프 글자를 감사 B·D·E 가 못 봤다)
- **WeakGivenNameHanjaSet 830자** — 부정은 아니지만 이름 뜻으로 약한 글자(사물·허사·신체·친족 훈)
  감점. 배제가 아니라 동음 대안 있을 때만 양보 → combos 소실 없음.
  2026-10-26 B1 재생성 두더지 검수(인명용 목록에 data-naver.csv 를 더해 +500 을 받은 50자 중 조합·1순위에 오른 글자, 3라운드 수렴):
  불용 妮(계집종 — 婢 선례), weak 弩(쇠뇌)·穏(穩의 일본 신자체 — 稳 선례)·腦(골)·醲(진한 술)·矑(눈동자)·笯(새장) — 근거는 HanjaData.cs 주석,
  회귀는 `WeakGivenNameHanjaTests.MoleAudit20261026_*`. /name 조합에서 늘어난 글자는 努(힘쓸 — 0→19쌍) — 珊(산호 — 17→40쌍, 강산=江珊·태산=泰珊·
  산하=珊河로 江山·泰山·山河 탈락, 산호·호산·윤산 1순위 珊)은 같은 날 보완 단계에서 珊·瑚 를 Female 로 고쳐(아래 '산호' 키워드) HEAD 와 같은 17쌍으로 되돌림.
  2026-10-26 B6 보완 두더지 검수(배포 검증 vb — 惓·斯): 약자 양보(B6)·인명용 목록 보강(B1) 뒤 /evaluate 1순위가 바뀐 칸을 **희신·기신까지 넣은 격자**
  (독음 × 성별 3 × 생년월일 없음·용신 5 — /evaluate 와 같은 인자, 옛 regen 격자는 용신만 넣어 청(남·金)=婧 을 蜻 으로 적는 등 실제와 달랐다)로 HEAD 와
  대조해 4라운드 수렴 + /name 재생성 E 목록 2라운드: weak 33자(惓 삼갈/싫증날·斯 이 사/천할 사·呝·喞·諠·褪·枙·泐·挒·厓·崕·羔·鷿·兎·兔·兜·鑞·勿·肋·颲·僻·
  刪·萵·荄·剷·酸·廨·釵·姟·杜·枓·侅·孩), 불용 3자(戹 좁을/재앙 액·訛 그릇될·痘 역질). 근거는 HanjaData.cs 블록 주석, 회귀는 `MoleAudit20261026B6_*`·
  `OpsVerificationRegressionTests.Select_MoleRound_*`·`Evaluate_MoleRound_ReportedCases`(김권우 남·土=淃, 박사랑 여·金=砂). 멈춘 칸: 모(여·土)=旄(깃대 장식 —
  뒤 후보 姆 유모·嫫 추녀 — 嫫 는 아래 부정 훈 정리에서 불용), 액=扼(누를 — 후보가 겨드랑이·조를뿐인 이름 0개 음절), 두(木)=紏(고할/노랑실)
  2026-10-26 **운영 검증 부정 훈 정리**(최항준(남, 생년월일 없음)=桁 '차꼬'·/analysis 후보 犴 '들개/감옥'·蠢 '꿈틀거릴'·旱 '가물'·嗽 '기침할', 인명용 합집합으로
  새로 인명용이 된 睾 '불알'): 전 독음(483) 덤프 — /evaluate 배정 격자(독음 × 성별 3 × 생년월일 없음·용신 5, 희신·기신 포함)와 /name-analysis 표시 상위 10
  (`OrderForDisplay`, 독음 × 글자 3,851쌍)을 눈으로 전수 대조하고 부정 낱말로 한 번 더 훑었다. 불용 9차 113자·weak 54자(3라운드 수렴 + /name E 1라운드) —
  불용은 형구·감옥(桁·梏·桎·釱·轞·圉·懲)·병(疥·癨·疸·瘰·癧·痳·癕·癰·癈·癥·症·瘋·瘀·疙·癃)·죽음·장례·제사(殑·椁·槨·窀·邙·窆·翣·縗·髽·殉·殲·殍·祊·膰·餽)·
  더러움(溏·濘·霉·粕·衊·黷)·천함·나약·가난(儓·懦·孱·窄·貶·趜)·도둑·거짓·비방(虜·刦·刧·剽·拐·俘·賂·詑·詃·諜·謞·訐·捓·揶)·잘못·다툼(忒·逆·悖·很·迫·爭·戰·傝)·
  재앙·훼손·슬픔(旱·晘·鴆·蠱·毀·毁·弊·塌·跌·儜·憯·慟·恫·欸·咻·妒)·신체 부정(睾·脧·膣·矇·眇·瞎·瞽·禿·矮·咼·嫫·牸 — 牡 는 보완에서 weak)·해충·불쾌 짐승(犴·蠢·蛣·蠹·虻·蟊·蝥·鵂·豖)·
  어리석음(駑·儢)·문란·교만(嬲·媟), weak 는 嗽·欬(咳 선례)·呶(喧)·啂(乳)·尻(臀)·便(변 자리 '똥오줌' — 편 자리 '편할', 降 선례)·忓(간 자리 '방해할' — 한 자리
  '아름다울')·瀆·淪·捏·埋·堋·煤·焚·燔·爇·刮·獗·慊·趌·俖·弗·祓·訟·譫·翫·戎·柙·壅·邕·嘖·呫·喋·偢·勡·吠·黠·盻·迷·惑·釁·蝕·媪·惘·齪·齷·剃·髰·鰾·矰·轢·咢·酗·鼸.
  선례·노출 위치는 HanjaData.cs 불용 9차·weak 같은 날 블록, 회귀는 `WeakGivenNameHanjaTests.NegGloss20261026_*`·`OpsVerificationRegressionTests.*_NegGlossCleanup_*`.
  같은 날 **보완**(검증 지적 — 정리 뒤 격자·표시 상위 10 을 다시 보니 같은 훈 글자가 남음, 2라운드 수렴): 불용 +6 — '벗을' 부류가 두 세트에 한 글자도 없어
  김단우(남, 생년월일 없음)=胆 '옷 벗을 단'(Male +40 이 旦 을 이김 — 단우 남아 2,914명)·나/라 줄 臝·倮 가 보였다(胆·臝·倮·裸), 侵 '침노할'(침 1순위 6칸 — 迫·掠 선례),
  癩 '나병'(2라운드 잠재); −1 — 牡 '수컷' 은 雄 '수컷 웅'이 인명 빈출이라 weak 로 옮김. weak +23 — 이번에 넣은 글자와 훈이 같은데 빠진 偓(악착할)·燒·爚(불사를)·
  呢·聶·咠·噥(소곤거릴 — 呢 는 /name 니나·다니·대니·라니·루니)·洩·漏·橽(샐)·眄(곁눈질할)·焮·煇(태울 — 煇 는 훈 자리, 휘 자리 '빛날' 이라 불용 아님), 첫 훈은 괜찮고
  부훈이 '음탕할'인 嫖(瀆 선례 — 표 줄 9위는 殍·剽·勡 이 빠진 뒤 새로 듦, 표(土) 1순위는 HEAD 부터), 사물·시설 훈 貥(큰 자개 — 貝 선례)·珬(자개)·櫜(활집 — 弩 선례)·驛(역 — 校 선례), 牡,
  2라운드 鉥(돗바늘 — 針)·鶸(댓닭 — 鷄)·儺(푸닥거리 — 祓)·哪(역귀 쫓는 소리/어찌). 회귀는 `NegGloss20261026Fix_*`·`*_NegGlossCleanup_*` 추가 행.
  바뀐 배정 예: 항(남·생년월일 없음) 桁→貥→恒(貥 '큰 자개'는 항 줄 Male 글자라 +40 으로 恒 을 이겼다 — 보완 weak), 단(남) 胆→旦·湍, 침 侵→寢·駸, 훈(여) 煇→薰·勳, 고(여) 蠱→暠, 겁 刦→迲, 짐 鴆→斟, 특 忒→特, 할 瞎→轄, 폄 窆→砭, 풍(土) 瘋→風,
  망(土) 邙→惘→輞, 체(金) 釱→剃→諟, 독(水) 瀆→黷→讀, 옹(土) 壅→邕→雍. /name 은 HEAD 대비 10명 조합이 바뀜(1순위 0, 바뀐 칸 2~4순위 — 文慊·羅慊·勢慊·輝慊·圉玲(어령은 2순위가 빠져 飫玲·唹玲 이 올라옴) 칸 + 보완의 呢 칸 5명.
  10/26 기준 공개는 라겸·휘겸·다니·루니(pa 없음 또는 지남), 나머지는 개방 대기. 1차의 周亦→柱驛 은 보완에서 驛 weak 로 HEAD 와 같은 周亦 으로 돌아옴, 文鼸 은 1라운드 뒤 weak).
  남긴 칸(대안 없음 — 그 음절 글자가 모두 같은 부류): 눌=吶·訥(말 더듬을 — 나머지 肭 '살찔'은 膃 선례로 불용급, 訥 은 訥言敏行 용례), 핍=偪·逼(핍박할 — 迫 은 불용),
  괵=馘(귀 벨), 뉵=衄(코피 — 육 줄 후보 10위에도 남음), 녈=涅(개흙 — 涅槃), 몰=沒(빠질), 닉=匿(숨길), 녁=惄(허출할), 훙=薨(훙서할), 퍅=愎(강퍅할).
  부정 훈이 아니어서 둔 칸: 겁=迲(자래), 달(木)=闥(문 — 橽 뒤), 섭 후보 10위 顳(관자놀이), 어령 2순위 飫玲(물릴 어 — HEAD 부터 3순위, 惓 '싫증날' 선례로 weak 후보),
  嗛(겸손할 겸 — 부훈 '흉년 들'·'원한 품을 함', 라겸·문겸 2순위 등 12명). 櫜·驛 은 보완에서 사물·시설 훈 weak. 표시·배정에 안 나오는 잠재 글자(예: 肛 '항문 항' —
  항 줄 표시 17위)는 넣지 않았다(보완의 裸·癩 는 같은 줄 두더지가 빠지며 다가선 글자라 예외)
  `HanjaSelector.Select`(/evaluate·추천·조화 배정)는 감점이 아니라 **비약자 대안이 하나라도 있으면 후보에서 뺀다** — 성별 +40·용신 +100 과 무관
  — 그다음 **CJK 기본 영역(U+4E00~9FFF) 글자가 남아 있으면 확장 영역 글자도 뺀다**(2026-10-26 보완, OrderForDisplay 2순위와 같은 규칙 — 용신 +100 이
  관련도 차이를 이겨 별(여·金)=䭱·새(남)=㘔·니(土)=㦐·슬(火·木)=𩇣·솔(土·金)=䢦 이 의미 메모 맨 앞에 나왔다. 기본 영역이 모두 약자인 글 줄만 확장 㔕).
  (2026-10-26 B6: 옛 −30 감점이 져서 생년월일 없는 남자 지훈·성훈=葷(훈채)·채민=寨·한솔=帥). 대안 없는 음절(녀·댁·몌·북, 보완 두더지 뒤 늑·즉·토 — 늑·즉은 /name 이름 0개, 토는 2개)만 약자 배정.
  /name-analysis·/evaluate 후보 표·'한자 예' 폴백은 `OrderForDisplay`(약자 뒤로)
  `SelectCombos`(/name 조합)는 약자 없는 조합이 하나라도 있으면 약자 쌍을 **빈칸 채우기로도 쓰지 않는다**
  — 4칸을 채우려 李眼·胎輝·鰓羅가 97명에 노출되던 것(2026-10-07). 전원 약자일 때만 약자 쌍 유지
- ⚠️ **weak·불용은 글자 단위인데 훈은 독음마다 다르다** — 烋는 휴 자리 '아름다울'이지만 효 자리
  '거들먹거릴', 乻는 얼 자리 '땅 이름'이지만 늘 자리 '음차'. 다중 독음 글자를 검수할 땐 그 글자가
  실제로 쓰이는 독음의 훈으로 판단할 것. /name 조합 카드(`glossForReading`)와 `dump-combo-glosses`는
  이름 음절의 독음에 맞는 훈을 고른다(첫 훈 고정 시 하늘=乻 "땅 이름 얼" 노출). /evaluate 의미 메모·강점 줄(ExplanationEngine)도
  같은 공용 헬퍼 `HanjaData.GlossForReading`(정규식 = 프론트 glossForReading 글자 그대로 — 테스트가 대조)을 쓰고 괄호 독음도 그 음절이다
  (2026-10-26 B7 — 옛 첫 훈·대표 독음이라 지훈(여)=煇 '煇(훈, 빛날 휘)'). RecommendationService 의 옛 추천 이유 줄은 아직 첫 훈
- **CommonNameHanja 322자** — 인명 빈출 가점(+300). 한 독음에 빈출 글자가 하나라도 있으면 /name 조합·라이브 선택 풀이 그 글자들로
  게이트된다 — 혁 줄은 2026-10-22 赫 하나를 넣어 侐(고요할)·焱·焃 동점 경쟁을 끝냈다. 랑 줄은 S4 에 朗(밝을) 하나 — 廊(사랑채)·浪(물결)이
  1순위를 나눠 갖던 것. 浪을 같이 넣으면 Core 가점(+2100)으로 浪이 다시 1순위가 된다(朗은 Core 아님)
- ⚠️ **감점 강도 계약**: 조합/글로스/풀 경로의 weak 감점은 **-3000** — Core_v1 검수 가점(+2000)을
  지배해야 함 (코어셋은 옛 뜻풀이 데이터 커버리지라 약자도 포함, 코어 가점이 품질 경쟁을 이기면 안 됨)

### 데이터 로딩
- `HanjaData.cs`: static Dictionary + lock 기반 스레드 안전 싱글톤
- `Program.cs`에서 `LoadExternalData()` 호출로 시작 시 로드
- 대표 훈 오버라이드는 모든 Meaning 기록자 이후(호환 병합·획수(`ApplyStrokeCounts`)·음양·자원오행 적용 직후) 적용 —
  `hanja_meanings.json`이 Meaning을 무조건 덮어쓰기 때문

## 주요 유틸리티

- **KoreanUtils**: 한글 자모 분해, 발음 분석, 리듬 평가, 음절 길이 판정
- **FortuneUtils**: 사주 오행 계산, 획수 기반 자원오행, 음양 판정
- **MorphemeAnalyzer**: 형태소 분석
- **NegativePatternLoader**: 부정적 발음 패턴 로딩 (JSON)
- **HanjaSelector**: 이름 음절별 한자 배정의 단일 진실의 원천 (불용 배제·weak 양보(대안 있으면 제외)·확장 영역 회피(기본 영역 대안 있으면 제외)·빈출 우선·용신 가산)

### 품질 감사 스크립트 (scripts/)
- `scan_weak_name_candidates.py` — 사전 훈 전수 스캔 (다중 훈 검수 + 약한 훈 후보)
- `audit_syllable_occupancy.py` — combos 음절 점유 감사 (어색 훈 글자가 음절 상위 점유 탐지)
- `audit_company_variation.py` — **상호 조건 변별력 감사**: 90조합(업종 18 × 톤 5)을 돌려
  톤 쌍 겹침 / 이름 편중 / 업종 겹침 / 개수·중복을 재고 FAIL 시 exit 1.
  ⚠️ 백엔드 리미터가 IP당 분당 60회라 `REQUEST_INTERVAL=1.1`로 페이스를 맞춰 뒀다
- `audit_combo_regressions.py` — **재생성 후 원커맨드 회귀 감사** (`--base REF`, 기본 HEAD):
  A combos 소실 / B 불용 잔존 / C comboMeans 커버리지(코드포인트 단위) /
  D 빈출셋 유일-약자 붕괴(HanjaSelector 풀 게이팅 재현) → FAIL 시 exit 1,
  E 신규 승격 글자 목록(두더지 검수 대상, 훈·weak 표시·샘플 포함), E2 점유 급증 글자(base 에도 있던 글자가 쌍을 크게 늘림 — 늘어난 쌍 ≥ 10·2배,
  `--surge-min`·`--surge-ratio`. E 는 0쌍에서 오른 글자만 보여 珊 17→40쌍을 놓쳤다 — 2026-10-26 보완)
- `audit_mean_combo_mismatch.py` — **대표 뜻·서사 ↔ 조합 모순 감사** (판정은 `mean_combo_check.py`,
  빌드와 공용): 문장에 나온 구체 명사 훈(연꽃·비·별·으뜸·아이)이 페이지 어느 조합에도 없는 한자의 것이면
  모순. `--fail`은 mean 모순 1건 이상이면 exit 1. 형용사(맑·밝·빛나)는 동음 한자가 공유해 참고 수치만
- `audit_gloss_override_text.py` — **대표 훈을 바꾼 글자의 옛 훈 문장 목록** (2026-10-22 潤 '불을'·荷 '멜'):
  `mean_combo_check`가 옛 첫 훈 조각을 자기 키워드로 봐서 통과시키는 문장(潤 '불꽃·타오르', 荷 '짊어지·무게·나르·사명')을
  섹션별로 뽑는다. 읽기만 하고 exit 0 — `--json`으로 받은 목록을 손으로 고친다. 미러 검사는 `--name-seo`·`--hanja-seo`·`--today`
- weak 추가 시 절차: 재생성 → `audit_combo_regressions.py`로 A~D 통과 확인 →
  E 목록 두더지 검수(2~4라운드 수렴, 필요시 점유 감사 TSV 병행) →
  신규 쌍 윤문(소량 인라인 / 대량 `build_combo_meanings.py` Batch) → 재실행으로 C 100% 확인

### /name 데이터 재생성 순서
`dotnet run -- dump-name-combos` → `dotnet run -- dump-name-scores` → `dotnet run -- dump-name-flags`(pk·fx, S7) →
`python scripts/build_name_seo_data.py`(combos·scores·stories·flags 병합) → `dotnet run -- dump-combo-glosses`
(글로스가 name-seo.json을 읽음 — 중간 누락 시 stale). 수록 이름 목록 자체가 변하면 build 2회.
/hanja 는 `dotnet run -- dump-hanja-quality`(nf·wk, S7) → `python scripts/build_hanja_seo_data.py` (이 순서가 /name 체인보다 먼저 — name 빌드가 hanja-seo 를 읽는다).
감사: `audit_combo_regressions.py`(A~F) + `audit_mean_combo_mismatch.py --fail` +
`audit_insights_tables.py`(데이터 리포트 표의 대표 한자·뜻 칸 대조 — 뜻 칸은 json 을 자동으로 따라가지 않는다.
불일치면 `--fix`로 뜻 칸만 교체, 대표 한자가 바뀌면 본문 서술을 손으로 다시 읽을 것. `--fix`도 고치지 않은 불일치가 남으면 exit 1).
⚠️ **대표 뜻(mean) 계약 (2026-10-07~)**: creative-name-meanings는 6월 윤문 당시 첫 훈 기준이라
combos가 바뀌면 낡는다(연우 "연꽃처럼…" 아래 然佑, 우정 "비 온 뒤…" 아래 佑晶, 예서 "아이처럼"=兒의
'아' 소리 훈). build가 모순 뜻을 **1순위 조합 뜻으로 자동 교체**하므로 weak 추가 뒤 재생성만 하면
따라온다(2026-10-07 기준 187명). 교체된 이름의 서사가 같은 모순 키워드를 되풀이하면
`data/name-stories.json`을 직접 고칠 것(서사는 자동 교체 경로 없음).
⚠️ **모순 판정의 사각지대 — 합성어 '옥빛'**: `mean_combo_check`는 1음절 명사 훈을 낱말 경계(뒤 글자가 조사 첫 글자)로만 잡고 2음절 훈(옥돌·서옥)은
통째로만 본다. 그래서 '옥빛처럼'(璐 '아름다운 옥'·玖 '옥돌')은 표시 조합에 옥 훈 글자가 없어도 걸리지 않는다. 2026-10-26 보완에서 이 경우인 공개 노아(努亞 —
'맑고 아름다운 옥빛 같은')·로한(鷺翰)·진구(津謳)의 creative 뜻을 지워 1순위 조합 뜻으로 폴백하고, 로한 서사의 '옥처럼'을 뺐다(규담·규이의 '옥처럼'은 표시 조합의
圭 '홀'(서옥) 이라 둠). 판정 규칙은 넓히지 않았다('빛'을 조사 머리에 넣으면 별빛·눈빛도 걸려 교체 범위가 커진다) — 조합이 바뀌면 '옥'을 손으로도 찾을 것
⚠️ **pk 서사 점검 (2026-10-26 B2)**: build 는 pk(순우리말) 이름 서사에 1순위 조합 글자의 '그 독음의 훈' 어간이 나오면 실패한다
(stderr '[오류] pk(순우리말) 이름 서사가 1순위 조합 글자의 훈을 되풀이…' — `pk_story_echoes`). 조합이 바뀌어 걸리면 그 서사를 한글 이름 뜻 기준으로
고친다. 훈 글자 그대로만 보므로 뜻말 되풀이(한솔 '넓은 강처럼' — 漢 한수)는 못 잡는다
이름/뜻/OG 카피 변경 시 `python scripts/build_og_font.py`로 OG 폰트 서브셋 재생성
(satori는 woff2 불가 → base64 TS 모듈, OG_LABELS 동기화 주의).

⚠️ **주간 드립(pa) 안전 규칙 (2026-09-03~)**: name-seo.json의 publishAt(pa)은
build_name_seo_data.py가 **기존 출력에서 자동 이월**한다 — 무인자 재실행이 안전하고
(min_total도 기존 meta에서 승계), --baseline은 최초 부트스트랩에만 쓴 옵션이니 다시 주지
말 것. 스크립트가 pa 전멸·수록 소실 시 하드 에러로 중단하며, `audit_combo_regressions.py`의
F 검사도 같은 회귀를 잡는다. 코호트 개방은 `.github/workflows/weekly-drip.yml`(일 05:23 KST
스탬프 커밋 → Vercel 재빌드)이 담당 — 마지막 pa 경과 후엔 자동 스킵.

### 서사(story) 파이프라인 — 의미 코이닝 (2026-07-22 Phase A)
사람 서사형 한 문장("어디에 있어도 은은하게 제 빛을 내는 사람")을 mean과 별개 레이어로 제공.
`dotnet run -- dump-story-inputs` → `python scripts/build_name_stories.py`(Batch, 사람 서사형
프롬프트+종결 힌트 로테이션) → `data/name-stories.json` → 창의 엔진(NameStoryData→Story)과
`build_name_seo_data.py`(rec.story) 양쪽이 소비. 파일 부재 시 서사 전면 숨김(순수 additive).
pk(순우리말) 이름 서사는 음절별 한자 훈 글로스로 지어 한글 이름 뜻과 따로 놀았다 — 2026-10-26 B2 에 120명 전수 대조로 59명을 한글 뜻 기준 한 문장으로
고쳤다(발행 블로그 인용 다온·한결은 고정). build 의 pk 서사 점검이 같은 회귀를 막는다(위 '/name 데이터 재생성 순서')

## 코드 규칙

- Clean Architecture 의존성 방향 준수: Api → Application → Domain ← Infrastructure
- 모든 엔진/서비스/저장소는 인터페이스 기반 DI
- 비동기: 모든 서비스/엔진 메서드는 `async Task<T>`
- 입력 검증: 컨트롤러에서 화이트리스트 기반 검증
- 에러 처리: `ArgumentException` → 400, 기타 → 500
- 금칙어/유행어: HashSet으로 O(1) 조회

## 이름 추천 철학

- 유행 이름 ❌ (감점 처리)
- 소망형 이름 ❌
- 세대 중립 (어떤 시대에도 어색하지 않은 이름)
- 발음 리듬 중시 (성씨와의 발음 조합)
- 미학 우선, 사주 보조 (7:3 비율)

## 디자인 시스템 (이름의 결 / Naming.kyeol)

### 브랜드 톤
- **전문성 70% + 친절함 20% + 감성 10%**
- 유행 배제 / 세대 중립 / 사전 충실형 한자 의미

### 컬러 토큰 (3색 + 골드 강조)
- **bg paper**: `#FAF7F2`
- **차콜**: `#2B2B2B` (text-1, Primary CTA, 강조)
  - 토큰명은 `--color-navy*` 유지 (호환성), **값은 차콜 계열**
  - hover: `#111111` (navy-600), light tint: `#E5E3DF` (navy-100), lightest: `#F0EDE7` (navy-50)
  - 옛 네이비(`#1E3A5F`)는 제거 — 베이지+그린+검정 3색 미니멀 팔레트
- **teal**: `#2E7D7A` (Secondary, 브랜드 chip, score-high 85+)
- **gold-beige**: `#C9A96E` (TopPick border, RARITY — 결과 페이지 한정)
- **score 분기**: 85+ teal / 70+ navy(=차콜) / 55+ gold / <55 neutral
- **amber-warm**: 경고/에러 (red 회피)

### 타이포 (한국어 특화 3종)
- **Pretendard** — 한글 본문/제목
- **Noto Serif KR** — 한자 (의미 한 줄과 가운뎃점으로 분리)
- **Inter (tabular)** — 점수·라틴/숫자

### 자원오행 등급 4축 뱃지 (옛 Confidence Grade — 2026-10-22 S7 교체)
부수 기준 자원오행 판정의 확실성(R/V/X/U — `data/hanja_resource_element.json` g, hanja-seo `g`)을 Fill / Border / Color / Icon 4축으로 차별화
(계획 `docs/plan-radical-ohaeng-2026-10.md` §2-4 — 옛 4축 스타일 재사용):
- **R** (확정) — solid teal + ✓ icon — 합의 부수이고 글자 단위 이견(문헌·실무 자료 2곳 이상)이 없다
- **V** (이견 있음) — outline gold 1.5px solid border — 이견·단일 출처·자의 추정 부수, 숫자 한자, 글자 단위 이견. 다른 값(alt_radical·alt_char)을 함께 적는다.
  값은 늘 부수표 값. 이유가 단일 출처 하나뿐이면 '자료 적음', 자의 추정 하나뿐이면 '추정' 라벨(같은 gold 테두리 — `hanja-element-text.ts` gradeBadgeKey,
  대체값이 없는데 '이견'이라 쓰지 않는다)
- **X** (예외 적용) — outline teal 1.5px solid border — 간지 22·문헌 예시·작명 실무 자료 다수 예외(`data/resource_element_exceptions.json`)
- **U** (미상) — outline neutral 1.5px dashed border (반투명 fill) — 부수 자료 없음(2026-10-22 0자), 엔진은 오행 없음
- ⚠️ 옛 S(검수완료)·A(규칙기반)·B(수동입력)·C·D(획수자동) 라벨과 '작명가 검수 완료' 문구는 쓰지 않는다 — 옛 S 는 뜻풀이 기준이라 작명가 검수가
  아니었다. 화면 문구는 '작명소 기준과 같다'가 아니라 '작명 실무에서 가장 많이 쓰는 값'. `/method#resource-element`가 판정 순서·등급·학계 '불명'을 설명하고,
  수치는 데이터 리포트 `/guide/resource-element-radicals`(`scripts/build_insight_resource_element.py` 가 data/*.json 에서 산출 — 손 계산 금지)

### 디자인 캔버스 산출물
14개 화면 디자인 완료 (Detail / Evaluate / Smart Result + 일반/Parent variant/Rare variant /
Twin Result / Dual Result / Specialty Input 4종 / Evaluate Input / Coming Soon / 시스템 상태 4종 /
Home v2 / Badges / Spacing & Typography). `docs/claude-design-brief.md` 참조.

## 라우트 (정적 21,134쪽, 2026-10-26 next build 기준 — 10-22 대비 +210 은 드립 개방 70명 × 쪽·OG·트위터 카드)

```
/                  홈 (Hero + Categories + ProPaths + 데이터 리포트 카드 + WhyKyeol — 서버 컴포넌트)
/hanja             인명용 한자 사전 인덱스 (독음 489개, 초성 ㄱ~ㅎ 탐색)
/hanja/[독음|글자]  인명용 한자 사전 SEO (9,105자 수록 — 호환 한자 85자는 통합 한자에 병합·상세 9,016자, 2026-10-22 S6 데이터.
                   /sitemap.xml 에는 독음 489쪽만 — 글자 상세는 googleBot 전용 noindex(robots index 유지)라 네이버 전용 /sitemap-hanja.xml)
/name              이름 뜻 사전 인덱스 (인기 이름 상위 1,000개 노출 — sitemap 등재 범위와 일치)
/name/[이름]       이름 뜻 SEO (공개 3,865쪽 — 2026-10-26 빌드 기준, 주간 드립으로 증가. 전체 수록 5,340명 중
                   1,475명은 개방 대기 · 통계·미학 점수·한자 조합 + 이름별 OG/트위터 공유 카드도 공개 수만큼 정적 생성)
/search            이름 추천 (구 /baby — 301 리다이렉트 구성됨)
/evaluate          이름 평가
/analysis          이름 분석
/twin              쌍둥이
/dual-name         한·영 이중 이름
/parent-based      부모 이름 기반
/rare-surname      희귀 성씨
/required-char     필수 글자 포함
/pure-korean       순우리말
/creative          창의적 작명
/company           회사·가게 이름 (상호 작명)
/three-syllable    3글자
/guide             작명 가이드 (7 챕터, 사용자 교육 + 상단 '데이터로 읽는 이름' 리포트 목록)
/guide/[slug]      데이터 리포트 7편 (content/insights/*.md — 2026-10-22 '자원오행은 어떻게 정하나' 추가. 표 수치는 scripts/build_insight_*.py·
                   name-seo.json 에서 산출, 손 계산 금지)
/method            작명 원리 (알고리즘 설명, 자원오행 기준 #resource-element — 판정 순서·등급 4종·학계 '불명', "리포트 방식" 포함)
/favorites         저장한 이름 (localStorage 즐겨찾기)
/about             소개
/contact           문의 (contact@namingkyeol.com)
/robots.txt        robots.ts 자동 생성 (AI 봇 18종 차단)
/sitemap.xml       sitemap.ts 자동 생성
/sitemap-hanja.xml 한자 글자 상세 전용 사이트맵 (네이버 서치어드바이저에만 제출, robots.txt Sitemap 줄에는 넣지 않음)
/_not-found        404
```

## 현재 한계 / 알려진 이슈

### 백엔드
- **API Key 인증**: 현재 단순 키 검증 — 본격 인증/인가 시스템 필요 (OAuth, JWT 등). 운영은 `Authentication__Enabled=false` 상태
- **EF Core warning**: `Candidate.Reasons` 컬렉션에 ValueComparer 미설정 (동작엔 문제 없지만 경고 발생)
- ~~xUnit1026 경고~~ (2026-06-13 1건 + 잔여 1건 2026-07-30 수정 완료)

### 프론트엔드
- **반려동물 작명 미구현**: `/guide` 7장과 Home Categories의 `pet` 카드는 ComingSoonModal 안내.
  (회사명은 2026-08-28 `/company`로 출시 — `ComingSoonMode` 타입은 `"pet"`만 남음)
- **업종 쌍 결과 겹침 최대 71%**: 의미 축 12개로 업종 18개를 표현하면 한 축을 평균 6개
  업종이 공유한다. `food/agri`·`fashion/culture`처럼 인접 업종은 축 재배치만으로 더
  갈라지지 않는다. 근본 해결은 축을 늘리거나 업종별 고유 어휘를 두는 것
- **상호 v1은 외부 조회 없음**: 도메인 가용성·상표 간이 확인(KIPRIS)·상호 등기 중복은 미구현.
  대신 결과 전에도 보이는 정적 확인 안내 + 목록 위 한 줄 요약 + 카드별 키프리스·네이버 새 창 검색 링크(자동 조회 아님, 2026-10-21).
  기능 투자(도메인 RDAP·KIPRIS 조회)는 실사용 월 100회 이상이 확인될 때까지 보류(30일 15회 — 2026-10-21 감사)

### 인프라/운영
- **Render Free cold start**: 15분 idle 후 첫 요청 30초+ — `.github/workflows/keepalive.yml`이 10분 간격 ping으로 회피 (실측: GitHub cron 스로틀링으로 약 1시간 간격까지 밀림 — cold start 완전 회피는 못 함). 같은 워크플로가 프론트(namingkyeol.com)도 확인해 3회 연속 비200이면 run 실패 → GitHub 실패 알림 메일이 다운 감지 채널 (2026-07-30 Vercel 정지 402 사후 대책). 저장소 60일 무커밋 시 GitHub이 스케줄 자동 비활성화하므로 알림 메일 주의
- **api.namingkyeol.com 커스텀 도메인**: Render 검증 미완 — 완료 시 Vercel `NEXT_PUBLIC_API_URL` 교체 필요
- **dev 환경 확인**: `Properties/launchSettings.json`으로 `dotnet run`만 쳐도 Development 모드 자동 적용됨
