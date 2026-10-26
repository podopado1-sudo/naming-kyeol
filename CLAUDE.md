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
- **테스트:** xUnit (2,200 테스트, 2026-10-26 — 엔진별 단위 테스트 + 품질 회귀 테스트 포함)

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

# 테스트 실행 (NameForm.slnx 경유 — 2,200개)
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

npm test   # 테스트 — node --test "tests/*.test.mjs" (Node 22.18+, lib/*.ts 를 타입 지우기로 바로 읽는다 — 2026-10-26 기준 166개)
           # 대비 테스트: tests/amber-contrast.test.mjs(amber-warm-700)·tests/palette-contrast.test.mjs(text-3·오행·골드·결과 화면 글자 토큰),
           # 공용 헬퍼 tests/color-utils.mjs(globals.css·Tailwind theme.css 실제 값, WCAG 대비, CIEDE2000 — *.test.mjs 가 아니라 따로 돌지 않는다)
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
          │                               ⚠️ 2026-10-26 '남긴 칸' 처리: 배정 한자가 없는 음절(순우리말 음절·글자가 모두 불용인 괵·몰 등) 노트는
          │                               '일부 음절에 배정할 한자가 없어 획수 기반 추정을 사용했습니다'·전 음절 '배정할 한자가 없어 기본값을 사용했습니다'
          │                               (옛 '한자 정보를 찾지 못해'·'한자 정보가 부족하여' — 불용으로 뺀 음절은 사전에 있다). 프론트
          │                               tests/note-polarity.test.mjs 사례 표가 이 리터럴을 대조하니 문구를 바꾸면 같이 고칠 것. /evaluate 조화 카드의
          │                               usedFallback 경고도 같은 말('배정할 한자가 없는 음절이 있어 기본값으로 계산했어요' — 옛 '한자 정보 부족으로')
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
- **data/hanja-gender-overrides.json**: 성별 선호 오버라이드 14자, 값은 모두 Neutral — 赫·焃·焱·秀(2026-10-22) + 2026-10-26 오분류 정리 10자
  (燦·輝·彬·斌·耀 '빛날'·'밝을', 均 'fair', 學·鶴 '학', 乼 '칼', 茁 'vigor' — 근거·영향은 '알려진 이슈'의 오분류 해소 기록). 키는 코드포인트 순·CRLF·통합 한자. GenderPref 기록자
  (하드코딩 → unihan → 의미 분류기 → 호환 병합)는 모두 Neutral 칸만 채워 잘못 찍힌 값을 뒤에서 못 고치므로 맨 마지막(`ApplyGenderOverrides`)에 덮는다.
  키워드 전면 재분류 대신 영향이 큰 글자만 여기서 고친다(赫 Female 때문에 남자 혁 이름 1순위를 侐 '고요할'이 차지했다).
  恩·秀는 하드코딩 Female 도 뺐다(恩은 다른 출처가 Neutral 이라 그것으로 충분). 惠는 둔다 — 혜 줄 빈출 惠·慧·蕙가 모두 Female 이라
  상쇄되는데 惠만 바꾸면 여자 혜 이름 1순위가 慧로 넘어간다(`HanjaGenderOverrideTests`). 같은 줄 빈출 글자는 묶음으로 바꾼다(學·鶴 / 彬·斌 / 乼·茁 —
  `SameLineCommonPair_ShareOneGender`, 亨·衡 은 둘 다 Male 로 둔다 — `HyeongCommonHanja_StayMale_NotOverridden`)
  ⚠️ 의미 분류기(`GenderToneClassifier`) 보석 키워드에 '산호'를 더했다(2026-10-26 보완 — 珊·瑚 두 글자만 걸림). 옥·구슬 훈 글자(珠·玉·琳·瑛·璐 …)는 모두
  Female 인데 산호만 Neutral 이라, B1 로 珊이 山과 관련도가 같아지자 남자 산 이름 조합이 오행 상생 가점만으로 珊 으로 넘어갔다. 오버라이드 파일이 아니라
  분류기를 고친 것은 원인이 키워드 누락이어서다(오버라이드 파일은 그대로 — 그때 4자). dump-name-scores 는 바이트 그대로
- **data/combo-meanings.json**: 한자쌍 자연어 뜻 28,739쌍 (LLM 배치 윤문 + 소량 인라인, 런타임 비용 0. 2026-10-22 자원오행 전환 재생성 때 Sonnet 5.5 배치로 5,009쌍,
  두더지 검수 뒤 211쌍은 손으로 씀 — API 크레딧 소진. 2026-10-26 B1 재생성 새 쌍 42개(努 19·珊 23)는 `build_combo_meanings.py --resume --model claude-sonnet-5-5
  --thinking between_tools` 배치 — 입력 26,571·출력 774 토큰, 약 $0.03. 같은 날 보완 단계 두더지 재생성의 새 쌍 17개(沕結·紏燦·瀣朗·裕土 등)도
  같은 설정 배치 — 입력 10,785·출력 291 토큰, 약 $0.01. 같은 날 부정 훈 정리 재생성의 새 쌍 4개(文岒·柱驛·羅黚·馭玲)도 같은 설정 배치 —
  입력 2,545·출력 72 토큰, 약 $0.003. 이어진 보완(검증 지적) 재생성의 새 쌍 4개(㦐羅·羅㦐·多濔·待濔)는 손으로 썼고, 공개 휘겸 4순위 輝嗛 문장이
  1순위 輝謙·대표 뜻과 같은 문장이라 손으로 바꿨다(嗛 '겸손할' 유지 — 같은 페이지 조합 뜻 중복 쪽수 52→51). 같은 날 '남긴 칸' 처리 재생성의 새 쌍 12개
  (敔玲·殷璽·璽馧·璽昷·璽殷·娜璱·娜瑟·率斌·乺斌·璱斌·璱賓·馜娜 — 확장 영역 쌍이 빠진 칸)도 손으로 썼고(배치 비용 0 — 재생성에서 새로 보인 13쌍 중 璽蘗(새벽 4순위)은 옛 배치 뜻이 이미 있었다), 羅黚(라겸 3순위)·文黚(문겸 3순위) 배치 뜻이 黚 '검누를' 훈을
  반영하지 않아 '그윽한 검누른 빛을 널리 펼친'·'검누른 빛처럼 그윽한 글의 품격을 지닌'으로 고쳤다. 같은 날 성별 오분류 정리 재생성의 새 쌍 26개(남자 빈 이름 3~4순위의
  彬·斌 쌍 — 佑斌·宇斌·規斌·亨斌·岔彬·槎彬 등, 瑤恩 은 옛 뜻이 있었다)도 손으로 썼다(배치 비용 0 — 斌 쌍은 '안팎·겉과 속·고루' 결로 같은 쪽 彬 문장과 겹치지 않게,
  炯彬 은 亨·衡 를 되돌린 뒤 화면에 안 나오지만 남겨 둠). 찬빈 1·2순위 燦彬·燦斌 이 같은 문장('눈부시게 빛나는 찬란한 존재')이라 燦斌 을 '겉과 속이 함께 찬란히
  빛나는'으로 바꿨다(같은 페이지 조합 뜻 중복 쪽수 51→50 — 남은 예 태빈 太彬=泰彬 '크고 찬란하게 빛나는'). ⚠️ `python -I` 는 PYTHONIOENCODING 을 무시해 Windows 콘솔(cp949)에서 끝 샘플 출력이
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
  - hanja-seo.json `nf` = ForbiddenNameHanjaSet(불용 — 이름 생성·추천·/evaluate 배정에서 빠지는 글자, 990자 — 2026-10-26 '남긴 칸' 처리 재생성), `wk` = WeakGivenNameHanjaSet(뜻이 약해
    동음 대안이 있으면 양보 — 배제 아님, 840자, nf 글자에는 안 붙음). `dotnet run -- dump-hanja-quality`(루트 hanja-quality.json) → `build_hanja_seo_data.py`
    (덤프 없으면 실패). 화면에서 '이름에 피하는 글자'는 nf 만 — wk 를 피하는 글자로 쓰지 말 것. 글자 단위 판정이라 독음마다 다른 훈(烋 휴·효)은 구분하지 않는다
  - name-seo.json `pk` = 한글 이름으로 쓰는 순우리말 이름(120명, 조합 유무 무관 — ND-3 '한자로 쓴다면(참고)', '추천 1순위' 없음) =
    PureKoreanNameEngine 내장 사전 − exclude + include(`data/pure-korean-name-overrides.json`, `PureKoreanNameEngine.IsPureKoreanSeoName`).
    `fx` = 한자 조합이 없고 외래 목록에 있는 이름(125명 — 뜻 있는 71명은 어원 문장, 54명은 뜻 없음 — 화면은 '어원이 분명하지 않아 뜻풀이는 적지 않았습니다',
    fx 서사(story)는 한자 훈으로 지은 문장이라 /name 이 내지 않는다). pk 와 fx 는 겹치지 않는다. `dotnet run -- dump-name-flags`(루트 name-flags.json — 갈래·영한 이름 지도 교차 확인 en 포함) →
    `build_name_seo_data.py`(덤프 없는데 기존 출력에 플래그가 있으면 실패, fx 인데 조합이 있으면 실패)

### 글자 품질 세트 (HanjaData.cs 인라인, 2026-07-02 기준)
- **ForbiddenNameHanjaSet 992자**(적재 9,105자 중 990자) — 명백 부정 훈 하드 배제. 생성·추천 경로, /evaluate 배정(HanjaSelector)·후보 표, /name-analysis 후보 카드
  (`HanjaSelector.OrderForDisplay` 상위 10 — 2026-10-26 B8, 옛 '평가/분석은 통과'는 S4-2 전 문구)에서 모두 빠진다. /hanja 사전에는 남아 '이름에 피하는 글자'로 표시 —
  雌(암컷 자)는 2026-10-22 S3 weak 로는 박영자(여)=映雌 배정이 남아(weak 는 양보) S4 에 여기로 옮겼다(대체 배정 慈 — 姿→紫 는 S4 자원오행 전환 효과).
  호환 코드포인트는 NFKC 정규형 조회로 자동 차단 (리터럴 등재 금지 — NFC 정규화 회귀 전력). `IsWeakGivenNameHanja`도 같은 폴백.
  2026-10-26 부정 훈 정리부터 두 세트의 새 글자는 `"\u6841"` 같은 C# 유니코드 이스케이프로 적는다(주석에 글자·훈·선례) — 감사 스크립트가 세트를 읽는
  `scan_weak_name_candidates.extract_charset_from_cs` 는 이스케이프를 글자로 푼다(전에는 리터럴만 읽어 이스케이프 글자를 감사 B·D·E 가 못 봤다)
- **WeakGivenNameHanjaSet 840자** — 부정은 아니지만 이름 뜻으로 약한 글자(사물·허사·신체·친족 훈)
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
  (이 단계가 '남긴 칸'으로 적었던 눌·핍·괵·뉵·녈·몰·닉·녁·훙·퍅·혹, '부정 훈이 아니어서 둔 칸'의 飫·顳·闥·嗛, 잠재 肛 은 같은 날 아래 '남긴 칸 처리'에서 정리)
  2026-10-26 **'남긴 칸' 처리**(사용자 '남겨 둔 것 다 처리' — 위 정리·보완이 대안 없음·부정 훈 아님·잠재로 둔 글자): 원칙 = 명백 부정(형벌·죽음·병·악덕과 그 선례
  부류)은 그 음절 후보가 0이 돼도 불용, 약한 훈은 weak(대안 없는 음절에서는 남음). 불용 10차 18자 — 吶·訥·吃(말 더듬을 — 啞·聾 선례, 訥言敏行 은 용례일 뿐)·
  偪·逼(핍박할 — 迫)·馘(귀 벨)·衄(코피)·涅(개흙 — 泥·淖, 涅槃 은 입적도 이름)·沒(歿 '죽을 몰' 통용)·薨(훙서할)·殤·殀·夭(일찍 죽을 — 잠재)·匿(慝 과 같은 두 훈
  '숨길·사악할')·惄(허출할 — 飢)·愎(강퍅할 — 很·戾)·肛(항문 — 잠재, 명백 부정 잠재 글자는 넣는다)·笘(회초리 — 鞭·箠, 2라운드), weak 10자 — 飫(물릴 — 惓 선례, 어령 2순위
  飫玲 → 4순위 敔玲)·或(혹 — 허사)·痕(흔적 — 瘢 '흉터'는 불용)·顳(관자놀이 — 額·頰)·肭(살찔 — 肥 선례, 膃 '살질'은 2차 불용 — 눌 줄 유일 글자라 눌=肭 배정은 남음)·
  墊(빠질 — 淪)·諱(숨길 — 秘)·杙(말뚝 — 臬)·弋(주살 — 矰, 2라운드)·肉(고기 — 膚·肥·乳 선례, 재생성 두더지 — 衄 불용으로 다시 본 육 줄 1위·배정 9칸,
  育 '기를'과 관련도 동점이라 코드포인트 순서로 앞섰다 — HEAD 부터). 약자급 같은 훈 잠재 글자(猒 물릴·湎 빠질·肪·腴·駜 살찔)는 넣지 않았다.
  판단만 기록하고 둔 글자: 嗛(겸손할 겸 — 첫 훈 기준①, 부훈 '흉년 들'·'원한 품을 함'은 歉·銜 통가. 嫖 weak 와 달리 첫 훈이 이름 뜻으로 강하고 통용이 부정 쪽이 아니며,
  빼면 겸 줄 대체가 岒·嵰(산 모양)·黚(색)라 더 약해진다 — 라겸·문겸 2순위 등 12명 그대로)·闥(문 — 門 '문 문' 비약자 선례, 달(木) 1순위)·
  黚(검누를 — 색 이름 단독은 약자 선례 없음(黔·黝·緇·玄 비약자) — 라겸 3순위 羅黚·문겸 3순위 文黚 조합 뜻 문장만 '검누른 빛'으로 고침)·겁=迲(자래).
  후보 0 이 된 음절은 괵·녈·몰·닉·녁·훙·퍅·핍(뜻 없는 畐 만)·뉵(뜻 없는 沑 만) — 옛 에·죄·틈·픽·혐·히 와 같은 경로: `HanjaSelector.Select` null(뜻 있는 글자가 모두
  불용이면 뜻 없는 글자로 메우지 않는다 — 사전에 뜻 있는 글자가 처음부터 없는 음절만 옛 폴백), 조화는 'anyFallback' 획수 추정, /evaluate 후보 표·/name-analysis
  후보 카드 0개 + 응답 `noHanjaNote`(`HanjaSelector.NoHanjaNoteFor` — 글자가 모두 불용 '이 음절은 이름에 쓸 만한 인명용 한자가 없어 한글로 두기를 권해요',
  사전 독음 없음(봄·빛) '이 음절은 인명용 한자 독음이 아니어서 한글로만 써요'), 이름 전체가 그렇다면 의미 메모 `ExplanationEngine.NoUsableHanjaMeaningNote`
  ('이름에 쓸 만한 인명용 한자 없음 — 한글로 두기를 권해요' — 순우리말만이면 옛 '한자 매칭 없음 — 순우리말 또는 미등록 발음'), /name-analysis 의 '한자 의미를 부여할
  수 있는 이름' 판정도 후보 카드 기준(몰닉 → 약점 '한자 매핑이 어려운 이름입니다'). 프론트는 `noHanjaNote` 를 그리지 않고 빈 묶음(빈 배열)으로 알아
  "‘몰’ 음절은 이름에 쓸 만한 인명용 한자가 없어 한글로 두기를 권해요." 한 줄을 그린다(`frontend/src/lib/no-hanja.ts` — 두 경우 모두 참인 문장, 같은 안내가 두 번 나오지
  않게). 그래서 백엔드는 후보 0 음절의 묶음을 빼지 말고 빈 배열로 계속 보낸다(필드는 API 소비자용). 같은 날 보완: 후보 0 음절의 불용 글자가
  미학 성별 보너스·의미 카테고리에 들어가 한 응답 안에서 어긋났다(김퍅쁨 남 +3 '한자 성별 선호도가 남자 이름과 잘 맞음' — 愎 Male, 김몰쁨 의미 9 — 沒 카테고리 +20,
  김쁨쁨 7) → `AestheticEngine` 의 두 곳(EvaluateGenderBonus·GetHanjaInfo)이 `HanjaSelector.HasUsableHanja`(= NoHanjaNoteFor null) 가 거짓인 음절을 건너뛴다
  (같은 날 점수 정책으로 후보가 있는 음절의 불용 글자도 제외 — 아래 '주요 유틸리티' HanjaSelector). /name 은 '에'(恚·曀 — 둘 다 불용) + 한자 없는 음절인 외래 이름 5명의 의미 9→7·총점 −2
  (에덴·에릭·에셀·에스더 공개, 에바 2027-03-21 개방) — 에녹·에단·에린·히나 등은 다른 음절 카테고리로 그대로. 회귀 `Aesthetic_NoUsableHanjaSyllable_*`.
  /hanja 독음 페이지도 같은 판정(`frontend/src/lib/no-hanja.ts` isNameUsableRecord — 불용 아님 + 뜻 있음)으로 추천 버튼을 단다: 뜻 없는 글자만 남은
  핍(畐)·뉵(沑)은 버튼 없이 "남은 1자는 사전에 뜻 풀이가 없는 글자라…" + 한글로 두기 안내(옛 조건 '불용 아닌 글자 1개 이상'이라 버튼이 나왔다). 바뀐 배정: 어(水) 飫→唹, 혹 或→熇, 흔(水) 痕→昕, 점(여·土/金) 墊→岾, 익(木) 杙→益,
  익(金) 弋→謚, 육 肉→育(9칸) — 격자(독음 × 성별 3 × 생년월일 없음·용신 5) 214칸, 표시 상위 10 새 글자는 簟 대자리·釴 솥귀·鷁 익조(사물·새 이름 비약자 — 둠)와
  weak 涉·挒·煇·焮·榏 뿐(재생성 두더지 1라운드 뒤 새 글자 0으로 수렴). 재생성(/hanja → /name, 결정성 2회 바이트 동일): /hanja nf +18·wk +10(nf 990·wk 840),
  /name 은 1순위 0, 32명 2~4순위(HEAD name-seo 대비 — 31명은 아래 확장 영역 규칙(새벽은 4순위에 璽蘗), 어령은 飫 weak 로 飫玲 → 敔玲), 대표 뜻·서사·플래그 0명 변경(점수는 위 보완의 '에' 외래 이름 5명만),
  comboMeans 19,575 → 19,541쌍(확장 영역 쌍 등 47쌍 빠짐·13쌍 추가·黚 2쌍 문장 교체), 감사 A~F PASS(E 蘗·敔 — 부정 훈 아님), mean 모순 새로 0.
  공개 이름 중 조합이 바뀐 곳: 나슬·라울·새나·새라·새론·새린·새미·새벽·새별·새빈·새아·새온·새은·솔빈·솔찬·슬빈·슬찬·은새·찬별·찬솔·찬슬·찬울(+ 라겸 3순위 문장).
  회귀는 `WeakGivenNameHanjaTests.LeftCells20261026_*`·`ExtensionArea20261026_*`·`OpsVerificationRegressionTests.Evaluate_NoUsableHanjaSyllable` 등
  `HanjaSelector.Select`(/evaluate·추천·조화 배정)는 감점이 아니라 **비약자 대안이 하나라도 있으면 후보에서 뺀다** — 성별 +40·용신 +100 과 무관
  — 그다음 **CJK 기본 영역(U+4E00~9FFF) 글자가 남아 있으면 확장 영역 글자도 뺀다**(2026-10-26 보완, OrderForDisplay 2순위와 같은 규칙 — 용신 +100 이
  관련도 차이를 이겨 별(여·金)=䭱·새(남)=㘔·니(土)=㦐·슬(火·木)=𩇣·솔(土·金)=䢦 이 의미 메모 맨 앞에 나왔다. 기본 영역이 모두 약자인 글 줄만 확장 㔕).
  (2026-10-26 B6: 옛 −30 감점이 져서 생년월일 없는 남자 지훈·성훈=葷(훈채)·채민=寨·한솔=帥). 대안 없는 음절(녀·댁·몌·북, 보완 두더지 뒤 늑·즉·토 — 늑·즉은 /name 이름 0개, 토는 2개)만 약자 배정.
  /name-analysis·/evaluate 후보 표·'한자 예' 폴백은 `OrderForDisplay`(약자 뒤로)
  `SelectCombos`(/name 조합)는 약자 없는 조합이 하나라도 있으면 약자 쌍을 **빈칸 채우기로도 쓰지 않는다**
  — 4칸을 채우려 李眼·胎輝·鰓羅가 97명에 노출되던 것(2026-10-07). 전원 약자일 때만 약자 쌍 유지.
  그다음 **두 글자 모두 CJK 기본 영역인 쌍이 하나라도 있으면 확장 영역 글자가 든 쌍도 빈칸 채우기로 쓰지 않는다**(조합 4개 미만 허용 — 새라 → 璽羅 하나,
  2026-10-26 '남긴 칸' 처리). 근거: 사이트 한자 폰트(layout.tsx next/font Noto Serif KR — Google 조각 373개, 2026-10-26 빌드 CSS 실측)의 unicode-range 에
  확장 A 0/6,592·확장 B 0 코드포인트라 㦐·㘔·䭱·𩇣 는 기기 폰트로만 그려진다(OG 카드는 한자를 그리지 않는다). 옛 결과 50쌍(새=㘔 23 등)이 빠지고
  기본 영역 비약자가 약자뿐인 한글(翰㔕 — 글 줄 契 weak·㔕 확장)만 3쌍 남는다(약자 양보가 먼저 — Select 와 같은 순서). ⚠️ 같은 폰트는 기본 영역도
  4,620/20,992자만 담는다 — 조합 글자 798자 중 112자(璱·嗛·黚·馜·唹 등, 897쌍)는 기본 영역이라도 기기 폰트로 그려진다(프론트 몫 — 폰트 교체 검토)
- ⚠️ **weak·불용은 글자 단위인데 훈은 독음마다 다르다** — 烋는 휴 자리 '아름다울'이지만 효 자리
  '거들먹거릴', 乻는 얼 자리 '땅 이름'이지만 늘 자리 '음차'. 다중 독음 글자를 검수할 땐 그 글자가
  실제로 쓰이는 독음의 훈으로 판단할 것. /name 조합 카드(`glossForReading`)와 `dump-combo-glosses`는
  이름 음절의 독음에 맞는 훈을 고른다(첫 훈 고정 시 하늘=乻 "땅 이름 얼" 노출). /evaluate 의미 메모·강점 줄(ExplanationEngine)도
  같은 공용 헬퍼 `HanjaData.GlossForReading`(정규식 = 프론트 glossForReading 글자 그대로 — 테스트가 대조)을 쓰고 괄호 독음도 그 음절이다
  (2026-10-26 B7 — 옛 첫 훈·대표 독음이라 지훈(여)=煇 '煇(훈, 빛날 휘)'). RecommendationService 의 옛 추천 카드 뜻 줄(`BuildCardMeaning`)도 같은 날
  '남긴 칸' 처리에서 같은 헬퍼로 바꿨다(옛 첫 훈: 하늘=乻 '땅 이름 얼'). 창의 실명 기계 뜻(`CreativeNamingEngine.BuildMechanicalMeaning` 의 BestGloss —
  dump-creative-glosses·dump-name-glosses 입력이자 다듬은 뜻이 없는 창의 후보의 런타임 폴백)도 같은 날 같은 헬퍼로 바꿨다(옛 첫 훈: 조=昭 '밝을 소'·탁=度 '법도 도'·
  락=樂 '노래 악'·늘=乻 '땅 이름 얼' — 덤프 기준 창의 글로스 13·이름 글로스 51개가 바뀜. 이미 만든 creative-name-meanings.json·name-stories.json 은 그대로).
  이제 첫 훈을 그대로 쓰는 이름 뜻 소비처는 없다
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
- **HanjaSelector**: 이름 음절별 한자 배정의 단일 진실의 원천 (불용 배제·weak 양보(대안 있으면 제외)·확장 영역 회피(기본 영역 대안 있으면 제외)·빈출 우선·용신 가산).
  쓸 글자가 없는 음절은 `Select` null + `NoHanjaNoteFor` 안내(응답 `noHanjaNote`, 판정 `HasUsableHanja`),
  `SelectCombos` 는 약자 쌍·확장 영역 쌍을 빈칸 채우기로 쓰지 않는다(2026-10-26).
  `IsUsableNameHanja`(불용 아님 + 뜻 있음 — 약자·확장 영역 포함) = '이름에 쓸 수 있는 글자' 단일 정의 — `OrderForDisplay`·`HasUsableHanja`·`TopComboCandidates`·
  `UsableByReading`(FindByReading 을 이 술어로 거른 관련도 순 목록 — 프론트 `no-hanja.ts` isNameUsableRecord 와 같은 술어)이 함께 쓴다
  - ⚠️ **2026-10-26 점수 정책(사용자 승인)**: 사전 글자 전부(FindByReading)를 보던 점수·표시 경로가 `UsableByReading` 만 본다 — **불용 글자는 어디서도 세지 않고,
    약자(weak)는 그대로 센다**(양보는 배정 단계의 일). AestheticEngine 성별 보너스·의미 카테고리·톤 가점(후보 0 음절은 목록이 비어 건너뜀), RankerEngine 자원오행 +8
    (옛 슬=膝·虱·蝨 水 — 성별 보너스·+8 은 같은 날 결정 ③으로 '보이는 한자 한 글자' 판정으로 다시 바뀌었다, '알려진 이슈'), DualNameEngine 대표 한자·뜻, FamilyNarrativeExtractor 부모 이름 뜻, RecommendationService·ParentBasedNamingEngine `DetermineNameType`
    (이름 전체를 독음 하나로 찾는 옛 버릇 그대로 — 실제 영향은 1음절 이름뿐). 옛 규칙에서 성별 일치를 만든 불용 글자(/name 이름 수): 지=躓 '넘어질'(여 73)·
    겸=歉·鉗(43)·권=勌(40)·라=瘰 '연주창'(16)·나=瘰(11)·회=獪(8)·검=劍·劒(4)·복=蝮 '살무사'(3)·옹=翁·癕·癰(1)·역=癧 '연주창'(1) — 懦 '나약할'은 톤 Strong 쪽.
    ① 단계 /name 재생성(체인 3회 바이트 동일 — 지금 데이터는 ③ 기준): sc 200명(공개 136·개방 대기 64 — 11/01부터 20개 코호트) 변경, 총점 −4 156·−5 35·−2 8·−3 1, 성별 보너스
    +5→+1 155·+1→−4 29·+5→+3 8·+3→−2 6·+3→−1 1·+1→−2 1, 노트 문구 192명(공개 133). 의미 점수(m)·p·r·s·n·pn·조합·대표 뜻·서사·pk/fx·pa·comboMeans·hanja-seo 무변.
    /name 에는 총점 등급·점수 순위가 없어(막대 색은 p·r·s·n·m 기준) 표시 등급이 바뀐 이름은 0 — 메타 설명 '발음·미학 점수 N점'만 200쪽(공개 136) 바뀐다.
    '잘 맞음'·'맞지 않음' 노트가 함께 붙는 이름 1,035→1,161명(공개 735→823), g 음수 136→173명(공개 89→114). 이중 이름은 Emily·Amy(에 = 曀·恚 모두 불용)가
    후보 0이 되고(/dual-name 은 0건 안내 문구를 그린다 — 옛 화면은 말없이 폼만 다시 보였다), 9개 매핑의 대표 한자가 바뀐다(婢 '계집종'→備 Vivian·Olivia·Ivy·Ruby,
    疲 '피곤할'→彼 Peter·Sophia, 媚 '아첨할'→薇 Naomi·Mia, 吐 '토할'→土 Anthony). 회귀 `OpsVerificationRegressionTests.Aesthetic_ForbiddenHanja*`·
    `Ranker_HanjaElementBonus_IgnoresForbiddenHanja`·`UsableByReading_*`·`DualName_*`·`FamilyNarrative_MeaningFusion_IgnoresForbiddenHanja`(기대값은 테스트 안에서
    FindByReading + 불용·뜻 필터로 따로 셈 — 검사 대상 술어를 쓰지 않는다). 남은 결정('하나라도 있으면' 규칙·지(여) 노트)은 같은 날 결정 ③으로 정했다
    ('알려진 이슈'의 결정 ③ 기록)
- **NameSeoHanja** (2026-10-26 결정 ③): /name 정적 데이터 한 이름의 성별(`Gender` 60/40 — 프론트 genderSplit 과 경계 10명이 다르다, '알려진 이슈')·조합
  (`Combos` = SelectCombos 상위 4, 2음절·비반복만)·보이는 한자(`DisplayedHanja` = 1순위 조합, 조합 없으면 전부 null)를 정하는 단일 경로 —
  dump-name-combos·dump-name-flags·dump-name-scores 와 `NameSeo_AestheticScores_MatchEngine` 이 함께 부른다

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
`dotnet test` 의 `OpsVerificationRegressionTests.NameSeo_AestheticScores_MatchEngine` 이 name-seo.json `sc`(5,340명)를 지금 미학 엔진 출력과 전수 대조한다
(성별 60/40 분기·노트 치환·성별 판정 한자 = `NameSeoHanja.DisplayedHanja` 1순위 조합은 dump-name-scores 와 같고, 판정 한자가 json combos[0] 과 같은지도 대조한다)
— 미학 엔진을 고치고 이 체인을 빠뜨리면 테스트가 실패한다(2026-10-26 — 점수 정책 직후 HEAD 데이터 200명, 결정 ③ 구현 직후 4,371명 불일치를 잡았다).
dump-name-combos·dump-name-flags·dump-name-scores 는 공용 함수 `Application/Engines/Utils/NameSeoHanja.cs` 를 쓴다 — dump-name-scores 는 name-combos.json 을
읽지 않고 같은 함수로 1순위 조합을 다시 구하므로 체인 순서와 무관하게 갈라지지 않는다(위 순서는 그대로 유효 — 2026-10-26 ③ 재생성도 이 순서).
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
- **amber-warm**: 경고/에러 (red 회피) — 테두리·바탕·아이콘. `#b5874c` 는 흰 카드 위 3.2:1 이라 작은 글씨 색으로 쓰지 않는다
  - **amber-warm-700**: `#7A5B22` (`--color-amber-warm-700(-token)`, 2026-10-26 F3) — 작은 글씨 전용(감점 숫자·경고 문장·'이견 있음'·'자료 적음'·'추정' 배지·
    /method V 칩·입력 화면 오류 상자·role=alert 오류 문장·/evaluate FieldHint warn). 종이 6.00·흰 6.27·gold-50 5.48:1 — `frontend/tests/amber-contrast.test.mjs` 가 실제 색 값으로 4.5:1 이상을 확인
  - `text-destructive` 는 `--destructive: #b5874c`(amber-warm 과 같은 값)라 작은 글씨에 쓰지 않는다 — 오류 문장은 `text-amber-warm-700`(2026-10-26 보완: /search·/required-char
    오류 3곳, shadcn badge·button destructive 변형 글자), 테두리·링(`border-destructive`·`ring-destructive`)은 그대로. 같은 테스트가 text-destructive 글자색 재유입을 막는다
    (같은 값인 `var(--color-score-low)` 글자색도 — 삼항식으로 고르는 24px 이상 점수 숫자는 큰 글씨 3:1 이라 둔다)
- **글자 전용 짙은 토큰(2026-10-26 팔레트 #2 — 사용자 승인: 색상은 지키고 글자·아이콘만 짙게)**: 바탕·테두리·막대·선은 원래 색, 작은 글씨(18px 미만)만 짙은 토큰.
  amber-warm-600 `#975918`(오행 火 글자 — amber-50 5.39·火 14% 틴트 4.67:1), gold-800 `#5f4e22`(土 글자·골드 강조 작은 글씨·희귀도 별·쌍둥이 55~69 칩·/method 조화
  배점 — 흰 8.08·gold-50 7.06·surface-2 7.21:1), score-high-700 `#417250`(FIVE_EL 木·ScoreTile high 라벨·강점 제목), score-mid-700 `#4a6f99`(/hanja 水 배지·
  ScoreTile mid 라벨), teal-800 `#1f716e`(FIVE_EL 金·쌍둥이 85+ 칩 — Tailwind 기본 teal-800 을 덮어씀, 쓰던 곳 없음). gold-700 `#9a7d44` 는 비텍스트 3:1 자리
  (♥ ⚠ ★ 장식·인용 부호·18px 이상 굵은 점수·V 배지 외곽선)에만, gold-600 `#b49258` 은 테두리·바탕·막대·선에만 — `tests/palette-contrast.test.mjs` 허용 목록
  (줄 + 위 6줄 문맥 정규식)이 새 글자색을 막는다
- **text-3(淡)**: `#6e6961`(2026-10-26 — 옛 `#8a857c` 는 흰 3.67·종이 3.51:1). 흰 5.45·종이 5.21·surface-2 4.86·navy-50 4.65·teal-50 4.66·gold-50 4.76:1,
  위계 text-1 18.70 > text-2 9.37 > text-3 5.45. 옛 값은 `--color-ink-dan` 에 남아 비텍스트 선(/method '미상' 점선·SmartResultRare 1px 선)에만 쓴다
- **글자색과 표지색을 나누는 자리**: FIVE_EL `color`(막대·왼쪽 테두리, 옛 값) / `text`(글자 — 글자 자리에 `.color` 를 쓰면 테스트 실패), ScoreTile `color`(32~44px 숫자) /
  `label`(11px), 쌍둥이 CoherenceHero `color`(30px 점수·원 그래프) / `chipText`, /method ScoreBlock `accent`(막대) / `textAccent`(배점 숫자), SmartResultParent
  bridge `color`(강조 글자) / `lineColor`(연결선·주석 알약 테두리 — gold-600 그대로). 카드 전체 `opacity` 로 상태를 알리지 않는다(/hanja 흐린 카드는 큰 글리프만,
  홈 준비 중 카드는 큰 한자·제목만 text-2 — 반투명이 작은 글씨를 AA 아래로 끌어내린다). 오행 火·土 글자는 /hanja 배지와 FIVE_EL 칩이 같은 토큰, CIEDE2000 ΔE 15.9(옛 7.2·8.1)

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
- ~~미학 성별 보너스가 불용 글자의 GenderPref 도 센다~~ (2026-10-26 점수 정책으로 해결 — 불용 글자는 성별·의미·톤·자원오행 가점 어디서도 세지 않고 약자는 그대로 센다.
  기록·수치는 '주요 유틸리티' HanjaSelector)
- ~~**성별 판정 '하나라도 있으면' 규칙**~~ (2026-10-26 결정 ③ — 사용자 승인으로 해결): 옛 미학 성별 보너스는 음절의 쓸 수 있는 글자 중 그 성별 글자가
  **하나라도** 있으면 일치로 셌다 — 불용을 빼자 지(여)는 화면의 智·志·至(Neutral)와 무관한 馶 '굳셀'·吱 '가는 소리'(Male) 때문에 /name 지 여자 이름 73명
  (공개 58 — 지우·지민·지원 …)에 '일부 한자의 성별 선호도가 여자 이름과 맞지 않음'이 붙었고(옛 '잘 맞음'은 불용 躓 '넘어질' 덕), 같은 규칙의 RankerEngine
  자원오행 +8 도 (음절, 용신) 308쌍에서 배정 한자가 아닌 글자 때문에 붙었다(음절 단위 재집계 313쌍). **지금 규칙: 미학 성별 보너스·노트와 RankerEngine 자원오행 +8 은
  음절마다 화면에 보이는 한자 한 글자로만 판정**한다(`AestheticEngine.EvaluateGenderBonus`·`RankerEngine.AssignedHanjaHasElement`). 보이는 한자가 없는 음절과 쓸 수 없는
  글자(`HanjaSelector.IsUsableNameHanja` 거짓 — 불용·뜻 없음)는 0, 배정 한자가 없으면 +8 도 없다. 점수 척도(+3/−2·±5, +8)·노트 문구는 그대로. 의미 카테고리·톤 가점은
  아직 음절의 쓸 수 있는 글자 전부(`UsableByReading` — 아래 후속 선택지).
  '보이는 한자'는 표면마다 — /evaluate·추천 카드(standard 탭, 부모·이중 이름 후보 포함)·쌍둥이 카드: `ScoringService` 가 한 번 정하는 `CanonicalNameScore.AssignedHanja`
  (출생일이 있으면 조화의 용신 배정 `SelectedHanja`, 없으면 `HanjaSelector.Select` 용신 없음 — 조화를 미학보다 먼저 계산한다). /evaluate 의미 메모·후보 표 첫 칸, 카드 `Hanja`·
  `MeaningText`·`Candidate.SyllableHanja`([NotMapped] — 랭커 판정용), 쌍둥이 이유의 '한자 뜻' 줄(옛 '한자 예' 음절별 1순위)이 이 목록을 그대로 쓴다.
  /name-analysis: 출생일이 있으면 음절별 큰 카드(첫 후보)를 그 배정 한자로 앞세우고(`NameAnalysisService.AnalyzeHanja` — /evaluate 후보 표와 같은 방식, 화면은 '한자 뜻' 줄을
  여전히 숨긴다) '이 이름은 용신에 부합합니다' 배지도 큰 카드로 판정한다(+8 과 같은 정의 — 옛 배지는 후보 10개 중 하나라도라 인기 100명 × 3성별 × 생일 3개 900행이 모두 참).
  출생일이 없으면 미학을 성별 없이 채점해 해당 없음. /name: `NameSeoHanja.DisplayedHanja`(1순위 조합 combos[0]) — 조합 없는 이름(3음절·첩음·외래 fx)은 보이는 한자가
  없어 0, 순우리말(pk)은 '한자로 쓴다면(참고)' 조합의 1순위로 판정(아래 결정 대기). `IAestheticEngine` 6인자 오버로드(displayedHanja)에 null 을 주면 Select(용신 없음).
  영향 — **배포될 상태(① 점수 정책 + ③ + 같은 날 성별 오분류 정리 10자, 아래 해소 기록) vs 운영 HEAD**(/name 재생성 체인 2회 바이트 동일·감사 5종 통과):
  sc 4,417명(공개 3,203·개방 대기 1,214) 변경, 바뀐 sc 필드는 g·t·no 뿐(Δt = Δg). 그 밖에는 오분류 정리로 23쪽의 2~4순위 조합만 바뀐다(1순위·대표 뜻·서사·플래그·
  hanja-seo 무변, comboMeans 는 19,541쌍 그대로 27쌍 교체 + 燦斌 문장 1건). 총점 −7 3·−5 1,356·−4 5·−3 294·−2 1,624·−1 662·+1 1·+2 384·+4 88(공개 −7 2·−5 974·−4 3·
  −3 182·−2 1,238·−1 474·+2 276·+4 54), 5점 이상 하락 1,359명(공개 976) — 전부 하락, 인기 100위 안 37·500위 안 148(지우 77→72·지민 80→75·서윤 71→66·지원 79→74),
  −7 은 나형 羅衡(84→77 — 衡 Male 유지)·아섬·유섬(纖)뿐(③ 만이면 −9·−7 110명). 평균은 바뀐 이름만 남 −2.23·여 −2.69(전체 이름 평균 남 −2.05·여 −2.17), 성별 none 325명
  무변. g 분포 {+5 3,492·+3 339·+1 1,031·0 342·−1 1·−2 42·−4 93} → {+5 504·+3 2,029·+1 14·0 2,762·−2 31} — 옛 규칙은 거의 모든 음절에 그 성별 글자가 '하나는' 있어
  +5 가 사실상 기본값이었고 보이는 한자는 대부분 Neutral 이다. '잘 맞음'+'맞지 않음' 동시 1,035→14명(공개 735→6 — 가형 佳亨·소형 昭亨·승언 勝嫣·준언 俊嫣·혜준 蕙俊·
  호령 豪玲, 성별 글자가 실제로 섞인 조합), '맞지 않음' 1,170→45명(공개 824→27, 새로 붙은 이름 8·공개 5 — 원인 글자는 아래 해소 기록), g 음수 136→31명(공개 89→21),
  노트 문구 2,788명(공개 1,962), 메타 설명 '발음·미학 점수 N점' 4,417쪽(OG·트위터 이미지는 sc 를 안 씀). 지(여) 73명은 '맞지 않음' 0(g 0 40명 — 智宇·至敏·智元,
  +3 33명 — 智柔·智娥·至炫)이지만 HEAD 가 +5(67명)라 운영 대비로는 대부분 −5. (③ 만의 수치였던 sc 4,374명·'맞지 않음' 342명은 오분류 정리 전 — 정리분은 해소 기록)
  /evaluate(① → ③, 인기 100명 × 남녀 × 출생일 유무 400행): 종합 색 구간(85+/70+/55+)이 바뀐 행 77(70+→55+ 71)·미학 타일 71행, /name-analysis 강점 문구(미학 80·60 경계)도
  함께 움직인다. 미학이 출생일(용신 배정 한자)에 따라 갈리는 경우가 늘었다 — 200쌍(이름, 성별) 중 성별 보너스가 갈리는 쌍 0→57, 미학 총점이 갈리는 쌍 104(세대 적합)→134
  (지우(여) 출생일 없음 智瑀 +3 · 2024-03-15 智佑 0). 7:3 가중은 그대로다. 추천(김·이·박 × 3성별 × 생일 4 × 선호 오행 없음/5개 = 216요청): 선호 오행 없음 36요청에서
  top10 순서 24·top3 20·1위 5(미학 성별만의 효과), 있음 180요청에서 순서 157·구성 153·top3 141·1위 66(랭커 규칙만 분리하면 118·116·93·46 — (후보, 오행) 7,620쌍 중
  옛 규칙만 +8 인 쌍 5,276). 같은 이름의 카드 한자 변경 0. 웹 /smart 는 `PreferredFiveElement` 를 standard 요청에 넘기지 않아(아래) +8 의 웹 영향은 0.
  /name-analysis(인기 100명 × 3성별 × 생일 3개 900행): 큰 카드 708행이 배정 한자로 바뀜(성별 값까지 386), 옛 큰 카드로 센 성별이 점수와 다르던 600행 중 295행 → 0,
  배지 참 900→848행(火 34·木 18 — 은찬 恩燦 火火·용신 木, 주원 柱元 木木·용신 火), 점수는 900행 모두 ScoringService 와 같다(동등성 유지).
  위 /evaluate·추천·/name-analysis 수치는 ① → ③ 이다. 오분류 정리분(③ → 배포 상태, 스크래치 하네스 — 저장소 빌드 복사본 + 오버라이드 파일): /evaluate(인기 300명 × 남녀 ×
  출생일 없음·2024-03-15·2021-07-08·2023-11-20 = 2,400행, 성씨 김) 이름 성별과 같은 1,124행의 '맞지 않음' 16→0(유찬·은찬·민찬·예찬), 교차 1,124행 36→36(惠 15·建 8·健 8·
  蕙 5 — 동시 13 그대로), 성별 none 152행 0. 배정이 바뀐 행 36(모두 빈 이름 — 賓→彬 27·賓→斌 9), 성별 보너스 변경 68행(여 +3→0 31·+5→+3 21, 남 −2→0 16), 종합 점수 변경
  92행(−8~+7 — 출생일 있는 빈 이름은 배정 글자가 바뀌어 조화도 움직인다, 규빈(남) 2024-03-15 77→69·유빈(남) 2024-03-15 67→73), 종합 색 구간 변경 28행(55+↔70+, 위 400행
  틀로는 3행). 추천 216요청: 빈 결과 0·2회 결정적, top10 순서 43(남 16·여 27)·구성 43·top3 34·1위 6(선호 오행 없음 36요청은 순서 8·1위 0), 같은 이름의 카드 한자 변경 0
  (빠진 이름 휘인 17·소빈 15, 든 이름 소아 12·하인 10 — 생성 풀이 Female 글자를 남자 풀에서 빼던 동작이 10자는 풀림). /name-analysis 큰 카드는 /evaluate 배정과 같은 값이라
  같은 빈 이름 행만 바뀐다(따로 재지 않음). 쌍둥이·3음절·희귀 성씨·필수 글자 생성 풀은 재지 않았다.
  회귀: `OpsVerificationRegressionTests` 의 `Gender_*`·`Aesthetic_ExplicitShownHanja_*`·`Scoring_GenderBonus_UsesAssignedHanja_*`·`NameSeoHanja_DisplayedHanja_IsFirstCombo`·
  `Ranker_HanjaElementBonus_FollowsAssignedHanja`·`Recommendation_ElementBonus_FollowsCardHanja`·`Twin_Reasons_HanjaLine_IsAssignedHanja`·
  `Analysis_WithBirthDate_BigCardIsScoredHanja`·`Analysis_NameFitsYongshin_FollowsBigCard`·`NameSeo_AestheticScores_MatchEngine`(판정 한자 = json combos[0] 도 대조),
  `ToolAccuracyRegressionTests.Analysis_WithBirthDate_OverallReasonMatchesFinalScore`(출생일 있는 분석은 '한자 뜻' = 큰 카드). 기대값은 응답에 보이는 한자로 테스트 안에서
  따로 센다(`ShownHanja`·`ExpectedGenderBonus`). 판정 로직만 옛 규칙으로 되돌리면 결정 ③ 테스트가 실패하는 것을 확인했다.
  오분류 정리 회귀: `Gender_OverriddenHanja_PopularNames_NoMismatch`(유찬·우빈·예찬·규빈·요한·휘찬·동균·학준 남 + 줄리 여 — /name 1순위 조합·발행 sc.no·/evaluate 출생일 없음
  세 곳에 '맞지 않음' 없음), `HanjaGenderOverrideTests.KeywordMisclassified_IsNeutral_ViaOverrideFile`(10자, 정수 코드포인트)·`SameLineCommonPair_ShareOneGender`·
  `HyeongCommonHanja_StayMale_NotOverridden`·키 코드포인트 순 단언. `Gender_ShownOppositeHanja_IsMismatch` 의 /evaluate 사례는 유찬 燦(이제 裕燦 0)에서 혜성(남) 惠星(惠 하드코딩 Female)으로 바꿨다.
  배포 주의(오분류 정리 뒤 최종 수치 — 정리 전과 같다): 블로그 하엘 편 교체 캡처 `docs/naver-blog/images/mean03-hael-page-2026-10.png`(81점·+3·'잘 맞음')는 배포 뒤 78점·노트 없음으로
  낡는다(수정 메모의 '(81점)'도). 발행 이름 편에 /name 캡처를 실었다면 점수 카드가 달라진다(희재 81→85·노트 사라짐, 한결 72→71·노트 둘 사라짐 — 본문은 점수를 인용하지 않음).
  재원(미발행 — 73→72·노트 둘 사라짐) 캡처는 배포 뒤에 뜰 것. 하온 83·로아 86(+5 '잘 맞음') 캡처는 그대로다. 블로그 밖에서 점수를 인용했다면 운영 대비 요한 84→79·우빈 80→75·
  수빈 80→75·서빈 84→79·찬빈 80→75·유찬 75→70(형준·준형 80 그대로)
- ~~**한자 성별 분류 오분류가 화면에 드러남(결정 ③ 뒤)**~~ (2026-10-26 해소 — 사용자 결정: 오분류를 고친 뒤 배포, ③ 의 전반적 점수 하락은 받아들인다):
  문제: 보이는 한자로 판정하자 키워드 분류로 성별이 붙은 글자가 인기 이름 1순위 조합에 올라 '맞지 않음'(−2)을 냈다 — ③ /name '맞지 않음' 342명(남 335) 중 1순위 조합 글자
  燦 135(공개 105)·輝 67(40)·彬 43(37)·均 27(17)·嫣 26·學 16·鶴 9·耀 6, 여자 亨 3·衡 2·乼 1(유찬 裕燦 75→68·우빈 宇彬 80→73·요한 耀翰 84→77·찬빈 燦彬 80→71). 찬 줄의
  쓸 수 있는 글자는 燦·璨·澯·瓚 Female 과 爨 '부뚜막' Male 뿐이라 HEAD 의 +5 '잘 맞음'도 爨 덕이었다.
  원인: 값은 오프라인 분류기 `scripts/classify_gender_tone.py`(→ data/hanja_unihan.json genderPref)의 부분 일치다(C# `GenderToneClassifier` 는 乼 만 같은 값) — 성별 없는
  형용사 키워드(빛날·밝을·맑을·어질·착할 → F, 큰·이길 → M), 독음이 섞인 한글 키워드(학·형·용·창·왕·옥), 영문 부분 일치('male'⊂'female'·'hero'⊂'heron'·'gentle'⊂'gentleman'·
  'fair'). 분류기는 고치지 않았다(전면 재분류는 별도 과제 — 키워드 적중 F 옥 167·M 창 91·F 밝을 79·M 용 70·M 큰 52·F 빛날 46·M 형 35·F 학 30).
  **고친 것 — `data/hanja-gender-overrides.json` +10자 → Neutral**: 燦 U+71E6 '빛날 찬'·輝 U+8F1D '빛날 휘'·彬 U+5F6C '빛날 빈, 밝을 반'·斌 U+658C '빛날 빈'·耀 U+8000 '빛날 요'(F '빛날'·
  '밝을'), 均 U+5747 '고를 균'(F 영문 'fair' = 공정), 學 U+5B78 '배울 학'(F '학' 독음 일치), 鶴 U+9DB4 '학 학'(키워드 '학'이 봉황·나비·제비와 함께 노린 글자지만 두루미는
  장수·선비 상징이라 판단으로 Neutral), 乼 U+4E7C '줄칼 줄'(M '칼' — 줄 음절 이름은 출생 통계상 모두 여자)·茁 U+8301 '싹 줄'(M 'vigor'). 기준 = 뜻에 성별이 없고 값이 그 음절의
  쓰임과 반대인 글자만 고치고 반대 성별로 뒤집지 않는다(찬 음절의 남자 쏠림 98% 는 인구 분포다). 같은 줄 빈출 글자는 묶음(彬 만이면 /evaluate 여자 빈 21행이 彬→斌,
  學·鶴 하나만이면 1순위 9~16명 이동, 乼 만이면 새 쌍 乼利 — 惠 효과).
  **두거나 유지한 글자**: 亨·衡 Male 유지 — '형' 독음 일치(兄 을 노린 키워드)로 붙은 값이지만 형 음절의 쓰임(출생 남자 93%)과 같은 쪽이고(建 Male·惠 Female 관례와 같은 판단),
  이 항목이 '분류가 맞다'고 적어 결정 범위 밖이다. Neutral 로 시험하면 여자 형 5명(가형 佳亨·나형 羅衡·다형·소형·아형)이 풀리는 대신 남자 형 이름 73명(공개 48)이 −2·−3
  (형준·준형 80→78·규형 82→79)이라 순손실 — 여자 형 5명의 '맞지 않음'은 선택기 몫(아래). 惠·慧·蕙 Female 유지 — 셋 모두 Neutral 이면 '맞지 않음' 6명(공개 혜성 蕙星·혜준·혜찬)이
  풀리고 여자 혜 이름 75명(공개 64)이 −2·−3(지혜 81→78·혜원 77→74), 惠 만이면 여자 혜 1순위가 慧 로 넘어가고, 慧 만이면 1순위 이동은 없지만 2~4순위 77쪽(공개 64)이 바뀌고
  여자 50쪽에서 慧 가 빠진다(새 쌍 68 중 뜻 없는 48, `Hye_CommonHanja_ShareOneGender` 실패). 嫣 '아리따울'(女부 — 진짜 여성 글자, 남자 언 이름 26명(공개 18 — 규언 規嫣·도언·
  동언)은 선택기 몫, 彦 을 Neutral 로 해도 Core +2000 으로 嫣 이 이긴다). 玲 '옥 소리'(옥 부류 — 호령 豪玲 공개·건령 대기, 2~4순위에도 대안 없음). 璽 '옥새'(경계 판단 — 값은 '옥새'의
  '옥' 부분 일치에서 왔지만 C# 분류기도 Female 이고 '옥·구슬 = Female' 관례에 든다. 珩 '노리개'는 '형' 독음 일치로 Male 이라 옥 기물 선례로 들지 않는다. Neutral 이면 대기
  남자 3명(새찬·새한·한새)이 풀리고 여자 새 이름 17명(공개 14)이 −2·−3). 纖 '가늘 섬'(纖纖 — 여성 묘사 관용, Neutral 이면 /evaluate 여자 섬이 贍→摻 으로 줄줄이 넘어간다 —
  아섬 亞纖(공개)·유섬(대기)은 선택기 몫). 健·建·乾 Male(힘 부류·하드코딩 관례·陽 — /evaluate 교차 행(여자로 본 건우·건희·민건) 16행, /name 미건 美健(대기) 1명).
  '빛날' 계열 나머지(曜·璨·澯·瓚·熙 등 — 빈출 게이트 때문에 지금 화면·점수 영향 0, 43자 전부 Neutral 시험은 1순위 101명(공개 79 — 여자 희 이름 熙→喜·希·曦)·새 쌍 376개).
  **남은 같은 종류 오분류(별도 재분류 과제)** — 가짜 '잘 맞음'만 만들고 '맞지 않음'은 없어 이번 범위 밖(바꾸면 1순위 대량 이동): 弦 '활시위'(키워드 '활' — 남자 현 1순위 109명)·
  熙 '빛날'·榮·炫·善·柔·圭·明·晶·澐·麟('male'⊂'female')·勢('형')·尙·賢·鴻·昭·靜·仁·郁·創·昌·蒼·鷺('hero'⊂'heron')·仲·容·大·旼(/evaluate 여자 민 144행)·璋(Female 이지만 弄璋 = 아들),
  彥·彦('elegant' Female — 지금 표시 0). /evaluate 기본 배정 쪽 잔여(覠·斅·燏·倂·雚·簅·莞)는 아래 선택기 항목.
  증거 방법: 스크래치 하네스(저장소 빌드 NameForm.dll 복사본 + 데이터 복사본 — 저장소 무변)가 ③ name-seo 의 combos·sc 를 5,340명 차이 0으로 재현한 뒤 글자별·묶음별로 값을
  바꿔 /name 전수(1순위·4칸·g·노트)·/evaluate 2,400행·Select 전 독음(478 × 성별 3 × 용신 6)·추천 216요청을 대조(후보 162자 = 파이썬 분류기 키워드 적중 목록). 데이터·일관성
  두 검토가 별도 프로브(실행 폴더 오버라이드 파일)와 실제 HTTP /evaluate 84행으로 다시 셌고, 재생성은 실제 체인(/hanja → /name, 2회 바이트 동일)·감사 5종 통과.
  **영향(③ → 배포 상태)**: /name sc 346명(공개 245·대기 101) — Δt −3 27·−2 20·+2 294·+4 5(공개 −3 22·−2 16·+2 204·+4 3), 남 298명 평균 +2.03·여 48명 −2.48, 5점 이상 하락 0,
  인기 100·300·500위 안 3·13·28명, 노트 문구 324명(공개 228). '맞지 않음' 342→45명(공개 233→27 — 남은 원인 嫣 26(공개 18)·亨 3·衡 2·璽 3·惠 3·蕙 3(공개 3)·玲 2·纖 2·健 1,
  인기 300위 안 0 — ③ 은 유찬·은찬·민찬·우빈·예찬·성빈·규빈·승빈 8명), 동시 96→14, g 음수 246→31. 사례(HEAD → ③ → 배포): 유찬 75→68→70·우빈·규빈·예찬 80→73→75·
  요한 84→77→79·찬빈 80→71→75·휘찬 82→77→81·동균 80→73→75·학준 76→76→78·줄리(대기) 79→76→78, 대가로 '잘 맞음'을 잃은 여자 빈 이름 수빈 80→78→75·서빈 84→82→79·
  예빈 80→78→75. 1순위 조합·대표 뜻·서사 0명, 2~4순위 23쪽(공개 17 — 남자 빈 22쪽은 3~4순위 賓 쌍 27개가 빠지고 彬·斌 쌍(웅빈·찬빈·혁빈은 순서만), 요은 4순위 瑤恩),
  새 쌍 27(瑤恩 외 26개 손으로 — 위 combo-meanings), mean 모순 새로 0, hanja-seo·hanja-quality·name-flags 바이트 그대로. 운영 HEAD 대비 전체 수치는 위 ③ 기록의 '영향'.
  두더지 검수: audit E 새 글자 岔 '갈림길'·槎 '나무 벨'(공개 차빈 3,388위 3·4순위 岔彬·槎彬 — 옛 嵯賓·茶賓). weak 로 막아도 且彬·奲彬 → 奲彬·挓彬 으로 차 줄 희귀 글자가 이어
  올라와 수렴하지 않아 weak 는 더하지 않았다(彬 관련도 4015 > 賓 1880 — 선택기 몫). E2 0. 배포 전 우빈·규빈·차빈 페이지를 눈으로 볼 것(남자 빈 페이지 다양성 — 아래).
  '惠식 부작용'(오버라이드가 1순위를 다른 성별 글자로 넘김): /name 1순위 이동 0. /evaluate 출생일 없음 배정 이동은 賓→彬 43명(남자 빈 — /name 과 같아짐)·耀→瑤 4명(여자 요 —
  소요·요원·요은·지요, 瑤 '아름다운 옥' Female 이라 +3 유지, /name 耀 와 새로 갈림)뿐
- **[결정 대기] 조합·배정 선택기의 성별 처리가 서로 다르고 판정과 어긋남**: /name `SelectCombos`(`ComboBaseScore`)는 반대 성별 글자에 −400(같은 성별 +40)만 줘 Core_v1 가점
  (+2000)을 이기지 못하고, /evaluate·추천의 `Select` 는 같은 성별 +40·반대 −200 이 관련도보다 앞선다(가중치는 그대로 — 수치는 2026-10-26 오분류 정리 뒤, 괄호는 정리 전 ③).
  그래서 (1) /name 1순위 조합이 대안이 있는데도 반대 성별 글자를 골라 같은 페이지의 성별 판정이 깎는다 — '맞지 않음' 45명 중 14명(공개 10)은 2~4순위에 두 글자 모두 반대 성별이
  아닌 조합이 있다(③ 같은 세는 법 45명·공개 31 — 옛 기록 53명은 세는 법이 다름): 규언 規嫣→奎鶠·동언 東嫣→東漹·대언 大嫣→大漹·나형 羅衡→羅炯·아섬 亞纖 등.
  (2) 같은 이름·성별에서 /name 과 /evaluate(출생일 없음)의 보이는 한자가 다르다 — 성별이 있고 조합이 있는 4,806명 중 2,758명(공개 1,980 — ③ 2,789), 성별 보너스가 다른 이름
  1,326명(공개 905 — ③ 1,362·939), 성별 노트가 다른 이름 827명(공개 545 — ③ 857·572), '맞지 않음'이 /name 에만 33명(공개 23, ③ 101·76 — 지금 원인 嫣 26·亨/衡 5·纖 2: 규언 規嫣 −2 ↔
  奎漹 0, 나형 羅衡 −2 ↔ 娜炯 +3, 아섬 亞纖 −2 ↔ 亞孅 +3)·/evaluate 에만 0명·둘 다 12명(공개 4, ③ 241·157 — 지금 원인 璽·惠·蕙 각 3·玲 2·健 1, 대안 없음). (g /name, g /evaluate)
  분포 (0,3) 709·(3,5) 499·(0,5) 85·(−2,0) 21·(1,3) 9·(−2,3) 3. 예: 동균 東均 0 ↔ 東覠 +3, 지우(여) 智宇 0 ↔ 智瑀 +3(瑀 '패옥' Female 이 Select 의 성별 우선으로 宇 를 이긴다),
  우빈은 宇彬 0 ↔ 佑彬 0(보너스는 같고 한자만 다름 — ③ 은 宇彬 −2 ↔ 佑賓 0). 오분류 정리로 새로 갈린 곳: 여자 요 4명(소요·요원·요은·지요 — /name 耀 ↔ /evaluate 瑤).
  /name CTA 가 /evaluate 로 이어져 사용자는 같은 이름에서 다른 노트를 본다(옛 규칙은 한자와 무관해 두 화면 노트가 같았다). (3) /evaluate 는 `Select` 가 성별로 고른 글자를
  미학이 다시 +3 하는 순환이다. 각 화면은 자기 화면의 한자와는 맞는다(결정 ③ 충족).
  (4) **/evaluate 기본 배정의 잔여 오분류**: Select 의 같은 성별 +40 이 관련도보다 앞서, 출생일 없는 배정이 /name 과 다른 '같은 성별' 성별 글자를 보이는 칸이 1,740칸(98자 —
  ③ 1,736·97자, 늘어난 건 瑤 4칸). 오버라이드 글자와 같은 키워드 계열: 覠 '크게 볼'(M '크게' — 남자 균 27명·공개 17, 동균·민균·성균 — 均 의 짝)·斅 '가르칠 학'(F '학' 독음 —
  여자 효 39)·燏 '빛날'(F — 여자 율 23)·倂 '아우를'(M '아우'⊂'아우를' — 남자 병 34)·雚 '황새'(M 'hero'⊂'heron' — 남자 관 28)·簅 '큰 피리'(M '큰' — 남자 산 23, 강산·대산)·
  莞 '왕골'(M '왕'⊂'왕골' — 남자 완 37). 7자를 모두 Neutral 로 시험하면(검토 프로브) 斅→熇·倂→并·燏→瑮 처럼 다음 오분류 글자가 +40 을 가져가 수렴하지 않는다(/evaluate 212칸 이동·
  /name 17명 변경). 覠 하나만이면 /evaluate 27명이 均 으로 /name 과 같아지지만 /name 4순위 10쪽에서 覠 쌍이 빠지고 새 쌍(南筠·大筠·敏勻 등)이 생긴다 — 선택기를 정할 때
  함께 정할 것. `Gender_OverriddenHanja_PopularNames_NoMismatch` 는 /evaluate 의 '맞지 않음'만 보므로 동균 東覠 +3 은 통과한다.
  (5) **남자 빈 페이지 다양성**: 오분류 정리 뒤 斌 1915 가 賓 1880 을 35점 차로 이겨 2~4순위 賓 쌍이 斌 쌍으로 바뀌었다 — 남자 빈 43쪽 중 賓 이 보이는 쪽 22→4, 4칸 모두 彬·斌 인
  쪽 21→39(공개 34 — 우빈 宇彬·佑彬·佑斌·宇斌, 규빈·율빈·광빈·빈우 같은 모양, 斌 문장은 '안팎·겉과 속'으로 갈라 씀). 차빈 3·4순위 岔彬·槎彬(岔 1615 + 彬 4015 > 嵯 3715 +
  賓 1880)도 같은 관련도 구조다.
  선택지: SelectCombos 를 Select 처럼 '대안이 있으면 반대 성별 제외'로(조합·감사·두더지 검수) / 2음절 /evaluate 의 출생일 없는 기본 배정을 1순위 조합으로 / 화면별 차이를
  받아들이기. 성별 분류 오분류는 2026-10-26 에 정리됐으니(위 해소 기록) 이 항목은 지금 수치로 판단한다 — 정할 때 (4) 覠 와 (5) 빈·차빈 칸을 함께 볼 것
- **[결정 대기] 순우리말(pk) 이름의 성별 판정 한자**: /name pk 는 '한자로 쓴다면(참고)' 조합의 1순위로 성별 보너스·'한자 성별 선호도' 노트를 받는다 — pk 120명 중 31명
  (공개 29 — 하늘 荷乻 +3·윤슬 潤璱 +3·아라 雅羅 +3·소담 素湛 +5·세찬 勢燦 +3), '맞지 않음' 0명(2026-10-26 오분류 정리 전 ③ 은 36명·공개 33, '맞지 않음' 6명 — 늘찬·다찬·세찬·
  솔찬·찬별·해찬 燦). 페이지(ND-3)는 그 조합을 추천이 아닌 참고로 보이고 featured 를 끈다(HEAD 는 옛 규칙으로 94명 — 회귀는 아님). fx 처럼 '보이는 한자 없음'으로 볼지
  (NameSeoHanja.DisplayedHanja 가 pk 에 null — dump-name-scores 에 pk 플래그 입력이 필요, 31명 재생성) 정할 것
- **[후속 선택지] 의미 카테고리·톤 가점도 보이는 한자로**: 지금은 음절의 쓸 수 있는 글자 전부(`UsableByReading`)를 본다. 바꾸면 /name 224명(공개 128) m 9→7(총점 −2) —
  218명이 조합 없는 이름(fx·3음절 등)이고 6명은 1순위 조합 글자에 카테고리(자연·덕목·개념)가 없다. ⚠️ 비대칭: 보이는 한자가 없으면 성별은 0(중립)인데 의미는 카테고리
  +20 을 잃어 감점이 되므로 조합 없는 이름만 깎인다(/name 톤은 neutral 이라 톤 경로 영향 없음). /evaluate(인기 100명 × 남녀 × 톤 3 = 600행)에서 의미 −1 인 행: 출생일 없음
  174(strong 10→9 100·soft 10→9 69·8→7 5)·2024-03-15 228·2021-07-08 251 — 모두 soft·strong 톤 가점 경로(neutral 톤 0). 재계산식은 덤프 m 5,340명·/evaluate 1,800행과 일치
- **/name 성별 반올림이 프론트와 다르다**: `NameSeoHanja.Gender`(조합·점수)는 남녀 비율을 각각 버림하고, 프론트 `genderSplit`(배지·남녀 막대·메타 설명)은 남자 % 를 반올림해
  여자 = 100 − 남자로 정한다 — 경계 10명(서우 54위 남 40.29% → 페이지 '여자 60%'·여자 이름, 지빈·희율·명빈·기은·민효·가엘·정유 공개, 영연·로다 개방 대기)은 페이지가
  남/여 이름인데 조합·점수는 none 이다(옛 Program.cs 부터). 2026-10-26 에 백엔드를 반올림으로 맞춰 시험하니 1순위 조합이 명빈 明彬→銘彬·정유 晶柔→情裕(조합 4개 모두 교체 —
  creative 뜻 '맑고 부드러운 결을 지닌'이 晶·柔를 잃는다)·영연 榮然→榮蓮·로다 露茶→璐多로 바뀌고, 새 조합쌍 10개(情裕·敏曉·榮緣·榮蓮·精有·精裕·英緣·英蓮·貞有·銘賓)에
  조합 뜻이 없어 audit C 가 실패했다(점수: 지빈 75→78·명빈 75→73(彬 −2)·영연 80→85·로다 82→85, 나머지 6명 무변). 조합 뜻 윤문·뜻 점검이 필요해 되돌리고 미뤘다
- **/name-analysis 출생일 없는 경로는 성별을 보지 않는다**: 미학을 성별 없는 3인자 호출로 채점해, 출생일 없이 성별을 골라도 성별 보너스 0(출생일이 있으면 ScoringService
  경로라 성별 반영 — 기존 동작)
- **/smart 가 선호 오행을 넘기지 않는다**: `SmartRecommendationService` 가 `PreferredFiveElement` 를 standard 요청에 넘기지 않아 /search 의 선호 오행이 버려진다 —
  랭커 자원오행 +8·음령 +5 는 POST /api/v1/recommendations 를 직접 부를 때만 작동한다(넘길지 별도 결정)
- **쌍둥이 '공유의미' 세트 설명**: 테마 설명에 영문 카테고리 코드가 그대로 나온다("'NATURE' 의미를 공유하는 이름 세트" — TwinNameEngine 177 이 CategoryMajor 를 그대로
  넣음, 결정 ③ 전부터). 테마는 쌍둥이 엔진 내부 글자의 카테고리 기준이라 카드에 보이는 배정 한자(이유의 '한자 뜻')의 카테고리와 다를 수 있다
- **생성 풀이 불용 글자를 거르지 않는 곳**: 사전 전체(`HanjaDictionary.Values`)를 쓰는 ThreeSyllableEngine(454·592 — `{Character}({Meaning})` 로 한자·뜻을
  그대로 보인다)·TwinNameEngine(39)·ParentBasedNamingEngine.GetFilteredHanja(928)·FamilyNarrativeExtractor(360). 생성 결과가 바뀌는 일이라 점수 정책과 따로 둠.
  ParentBasedNamingEngine(520·547)은 성씨 독음의 사전 글자 Take(2) 뜻을 Description `성씨 '…'(뜻)` 에 넣는다(성씨 표 `SurnameData` 기준으로 바꿀지 판단 필요)

### 프론트엔드
- **한자 서체 범위**: 사이트 한자 폰트(layout.tsx next/font Noto Serif KR — Google 조각 373개)는 기본 영역 4,620/20,992자·확장 A/B 0자만 담는다
  (2026-10-26 빌드 CSS 실측). /name 조합 글자 798자 중 112자(璱·嗛·黚·馜·唹 등, 897쌍)와 /hanja 확장 영역 글자는 기기 폰트로 그려진다 —
  한 서체로 맞추려면 폰트 교체나 서브셋 자체 호스팅이 필요(폰트 파일 반입·디자인 결정). /name 조합은 확장 영역 쌍을 빈칸 채우기로 쓰지 않는다(HanjaSelector)
- **정의되지 않은 paper 클래스**: `bg-paper-card`·`border-paper-line`·`bg-paper-tint`·`text-paper-line` 은 globals.css 에 토큰이 없다(초기 커밋부터 —
  /hanja·/guide·/name·/creative). 그래서 카드 바탕이 투명(종이 위)이고, /name 점수 카드는 cn(tailwind-merge)이 Card 의 bg-card 를 지워 투명이다.
  토큰을 정의하면 이 화면들 모양이 바뀌니 디자인 결정으로 함께 정할 것(감점 숫자 대비는 종이 기준 6.00:1)
- **대비 미달로 남은 색(팔레트·디자인 결정 필요)**: 2026-10-26 팔레트 #2(위 '컬러 토큰')로 오행 배지·FIVE_EL 칩·부족 오행 칩·/name 상극 칩·gold-600 강조 글자·
  /method '미상' 칩·XCircle·배점 숫자·text-3, 같은 날 보완으로 쌍둥이 'SET COHERENCE' 칩·/hanja 흐린 카드(전체 opacity → 글리프만)·ScoreTile 라벨(high)·
  강점/약점 제목·희귀 성씨 카드 희귀도 별·홈 준비 중 카드·푸터 '준비 중' 배지를 고쳤다. 남은 것:
  ScoreTile mid 라벨(조화·유니크 11px) score-mid-700 종이 위 10% 틴트 4.47:1(흰 위 4.65 — 더 짙은 score-mid 글자 토큰이 필요), teal #2e7d7a/teal-50 4.15:1
  (SmartResultParent 팔레트 칩 등), CompanyResult 스타일 라벨 `${tint}1a` 위 tint 글자(안 잼), 입력 화면 오류 상자 #C45A4C/8% 틴트 3.87:1(/analysis·/dual-name·/twin·
  ComingSoonModal — red 색이라 amber-warm-700 규칙 밖), text-3 은 navy-100 4.24·gold-100 4.28:1(지금 그 바탕에 올린 곳 없음 — 쓰게 되면 surface-2 등으로).
  디자인 결정: 오행 글자색이 화면마다 다르다 — /hanja 배지 木 Tailwind teal-700 과 /evaluate 칩 金 teal-800 이 ΔE00 3.9 로 같은 청록(팔레트 #2 전에도 4.4),
  배지 金 은 정의되지 않은 `text-navy-700`(부모 글자색 상속 #14120f)·칩 金 teal-800, 水 배지 #4a6f99·칩 #1E3A5F — 다섯 원소를 한 글자 토큰으로 맞추면 /hanja 배지
  색상이 바뀐다(火·土 만 같은 토큰). FIVE_EL 칩 木·金 ΔE 13.0(원래 13.1 — 벌리려면 金 색상 이동). 갈색 의미 채널이 가깝다 — 土 글자 gold-800 ↔ 경고·'이견 있음'
  amber-warm-700 ΔE 7.6(옛 13.1)·火 amber-warm-600 ↔ 경고 9.4, 디자이너 리터럴 #6F5421(RarityChip 등 13곳) ↔ gold-800 4.7(한 토큰으로 합칠지). Top Pick 머리말의
  gold-800(짙은 올리브 — 옛 밝은 골드 인상과 다름)은 디자인 확인 대상. 수치는 `tests/palette-contrast.test.mjs` 진단 줄
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
