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
- **한자 사전:** JSON/CSV 9,595자
- **로깅:** Serilog (Console + 파일 `logs/nameform-{date}.log`, 30일 보존)
- **인증:** API Key 미들웨어 (`UseApiKeyAuthentication`)
- **CORS:** `localhost:3000` 허용 (appsettings에서 환경별 오리진 관리)
- **테스트:** xUnit (988 테스트 — 엔진별 단위 테스트 + 품질 회귀 테스트 포함)

### 프론트엔드
- **프레임워크:** Next.js 16.2 (App Router) + React 19.2 + TypeScript 5
- **스타일:** Tailwind CSS 4 + shadcn 4 + Base UI (Headless)
- **상태/UX:** sonner (토스트) / next-themes / lucide-react (아이콘)
- **위치:** `frontend/` 디렉토리

## 빌드 명령어

### 백엔드 (루트 디렉토리)

```bash
# 프로젝트 복원
dotnet restore

# 프로젝트 실행 (포트 5000/5001)
dotnet run

# 테스트 실행 (NameForm.slnx 경유 — 988개)
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
│   └── Engines/                        ← 추천 엔진 16+개 (인터페이스+구현)
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

### 추천 엔진 파이프라인 (16+ 엔진)

```
요청 → SmartRecommendationService (메인 오케스트레이터)
          │
          ├── 핵심 엔진
          │     NamePoolEngine          → 한자 기반 이름 후보 100개 생성
          │     AestheticEngine         → 미학 점수 0~100 (발음 30 + 리듬 25 + 음절 15 + 세대중립 15 + 의미 10 - 감점)
          │     HarmonyEngine           → 조화 점수 0~100 (오행 40 + 자원오행 30 + 음양 20 + 성조화 10)
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
          └── 분석/평가 서비스
                NameAnalysisService     → 이름 평가 (한자/사주/음령오행)
                NameEvaluationService   → 상세 평가 (Aesthetic·Harmony Breakdown)
                SajuCalculationService  → 사주 4기둥 계산
                YongshinCalculationService → 용신 분석 (억부법 + 조후법)
```

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

### 피드백
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/recommendations/feedback` | 사용자 피드백 제출 |
| GET | `/api/v1/recommendations/{id}/feedback` | 피드백 목록 조회 |
| GET | `/api/v1/recommendations/{id}/feedback/summary` | 피드백 집계/요약 조회 |

## 한자 데이터 구조

### HanjaInfo 필드
- 기본: Character, Reading, Meaning, Unicode, Consonant
- 오행: FiveElement (木/火/土/金/水), YinYang (陽/陰), StrokeCount
- 카테고리: Category (자연/덕목/개념), CategoryMajor/Minor, Tags, Evidence, Confidence
- 선호: GenderPref (Neutral/Male/Female), TonePref (Neutral/Soft/Strong)

### 데이터 소스
- **하드코딩 상세 데이터**: 45자 (오행/음양/획수 완비)
- **hanja_dictionary_final.json**: 9,595자 (마스터 통합 사전)
- **data-gov.csv / data-naver.csv**: 대법원/네이버 인명용 한자
- **Unihan_*.txt**: Unicode 표준 발음/획수/부수 데이터
- **data/hanja-gloss-overrides.json**: 대표 훈 오버라이드 95자 (然 불탈→그럴 연 등,
  로드 시 Meaning 재배열 — 원 훈 보존·멱등, 소비처는 첫 훈만 취하므로 무수정 전파)
- **data/combo-meanings.json**: 한자쌍 자연어 뜻 16,203쌍 (LLM 배치 윤문, 런타임 비용 0)

### 글자 품질 세트 (HanjaData.cs 인라인, 2026-07-02 기준)
- **ForbiddenNameHanjaSet 850자** — 명백 부정 훈 하드 배제 (생성 경로만, 평가/분석은 통과).
  호환 코드포인트는 NFKC 정규형 조회로 자동 차단 (리터럴 등재 금지 — NFC 정규화 회귀 전력)
- **WeakGivenNameHanjaSet 621자** — 부정은 아니지만 이름 뜻으로 약한 글자(사물·허사·신체·친족 훈)
  감점. 배제가 아니라 동음 대안 있을 때만 양보 → combos 소실 없음
- **CommonNameHanja 320자** — 인명 빈출 가점(+300)
- ⚠️ **감점 강도 계약**: 조합/글로스/풀 경로의 weak 감점은 **-3000** — Core_v1 검수 가점(+2000)을
  지배해야 함 (코어셋은 오행 검수 커버리지라 약자도 포함, 신뢰도 점수가 품질 경쟁을 이기면 안 됨)

### 데이터 로딩
- `HanjaData.cs`: static Dictionary + lock 기반 스레드 안전 싱글톤
- `Program.cs`에서 `LoadExternalData()` 호출로 시작 시 로드
- 대표 훈 오버라이드는 모든 Meaning 기록자 이후(`LoadStrokeData()` 직후) 적용 —
  `hanja_meanings.json`이 Meaning을 무조건 덮어쓰기 때문

## 주요 유틸리티

- **KoreanUtils**: 한글 자모 분해, 발음 분석, 리듬 평가, 음절 길이 판정
- **FortuneUtils**: 사주 오행 계산, 획수 기반 자원오행, 음양 판정
- **MorphemeAnalyzer**: 형태소 분석
- **NegativePatternLoader**: 부정적 발음 패턴 로딩 (JSON)
- **HanjaSelector**: 이름 음절별 한자 배정의 단일 진실의 원천 (불용 배제·빈출 우선·용신 가산·weak 감점)

### 품질 감사 스크립트 (scripts/)
- `scan_weak_name_candidates.py` — 사전 훈 전수 스캔 (다중 훈 검수 + 약한 훈 후보)
- `audit_syllable_occupancy.py` — combos 음절 점유 감사 (어색 훈 글자가 음절 상위 점유 탐지)
- `audit_combo_regressions.py` — **재생성 후 원커맨드 회귀 감사** (`--base REF`, 기본 HEAD):
  A combos 소실 / B 불용 잔존 / C comboMeans 커버리지(코드포인트 단위) /
  D 빈출셋 유일-약자 붕괴(HanjaSelector 풀 게이팅 재현) → FAIL 시 exit 1,
  E 신규 승격 글자 목록(두더지 검수 대상, 훈·weak 표시·샘플 포함)
- weak 추가 시 절차: 재생성 → `audit_combo_regressions.py`로 A~D 통과 확인 →
  E 목록 두더지 검수(2~4라운드 수렴, 필요시 점유 감사 TSV 병행) →
  신규 쌍 윤문(소량 인라인 / 대량 `build_combo_meanings.py` Batch) → 재실행으로 C 100% 확인

### /name 데이터 재생성 순서
`dotnet run -- dump-name-combos` → `dotnet run -- dump-name-scores` →
`python scripts/build_name_seo_data.py`(combos·scores·stories 병합) → `dotnet run -- dump-combo-glosses`
(글로스가 name-seo.json을 읽음 — 중간 누락 시 stale). 수록 이름 목록 자체가 변하면 build 2회.
이름/뜻/OG 카피 변경 시 `python scripts/build_og_font.py`로 OG 폰트 서브셋 재생성
(satori는 woff2 불가 → base64 TS 모듈, OG_LABELS 동기화 주의).

### 서사(story) 파이프라인 — 의미 코이닝 (2026-07-22 Phase A)
사람 서사형 한 문장("어디에 있어도 은은하게 제 빛을 내는 사람")을 mean과 별개 레이어로 제공.
`dotnet run -- dump-story-inputs` → `python scripts/build_name_stories.py`(Batch, 사람 서사형
프롬프트+종결 힌트 로테이션) → `data/name-stories.json` → 창의 엔진(NameStoryData→Story)과
`build_name_seo_data.py`(rec.story) 양쪽이 소비. 파일 부재 시 서사 전면 숨김(순수 additive).

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

### Confidence Grade 4축 뱃지
한자 오행 판정 신뢰도(S/A/B/D)를 Fill / Border / Color / Icon 4축으로 차별화:
- **S** (검수완료) — solid teal + ✓ icon
- **A** (규칙기반) — outline teal 1.5px solid border
- **B** (수동입력) — outline gold 1.5px solid border
- **D** (획수자동) — outline neutral 1.5px dashed border (반투명 fill)

### 디자인 캔버스 산출물
14개 화면 디자인 완료 (Detail / Evaluate / Smart Result + 일반/Parent variant/Rare variant /
Twin Result / Dual Result / Specialty Input 4종 / Evaluate Input / Coming Soon / 시스템 상태 4종 /
Home v2 / Badges / Spacing & Typography). `docs/claude-design-brief.md` 참조.

## 라우트 (정적 19,524유닛, 2026-07-22 기준)

```
/                  홈 (Hero + Categories + ProPaths + WhyKyeol)
/hanja/[독음|글자]  인명용 한자 사전 SEO (9,595자, sitemap 전체 공개)
/name/[이름]       이름 뜻 SEO (3,305개 — 통계·미학 점수·한자 조합
                   + 이름별 OG/트위터 공유 카드 각 3,305장 정적 생성)
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
/three-syllable    3글자
/guide             작명 가이드 (7 챕터, 사용자 교육)
/method            작명 원리 (알고리즘 설명, "리포트 방식" 포함)
/favorites         저장한 이름 (localStorage 즐겨찾기)
/about             소개
/contact           문의 (contact@namingkyeol.com)
/robots.txt        robots.ts 자동 생성 (AI 봇 18종 차단)
/sitemap.xml       sitemap.ts 자동 생성
/_not-found        404
```

## 현재 한계 / 알려진 이슈

### 백엔드
- **API Key 인증**: 현재 단순 키 검증 — 본격 인증/인가 시스템 필요 (OAuth, JWT 등). 운영은 `Authentication__Enabled=false` 상태
- **EF Core warning**: `Candidate.Reasons` 컬렉션에 ValueComparer 미설정 (동작엔 문제 없지만 경고 발생)
- ~~xUnit1026 경고~~ (2026-06-13 수정 완료)

### 프론트엔드
- **/guide의 회사명/반려동물은 "준비 중" 안내**: 해당 라우트 미구현
- **Home Categories의 `company`/`pet` 카드**: 클릭 시 ComingSoonModal만 표시

### 인프라/운영
- **Render Free cold start**: 15분 idle 후 첫 요청 30초+ — `.github/workflows/keepalive.yml`이 10분 간격 ping으로 회피 (실측: GitHub cron 스로틀링으로 약 1시간 간격까지 밀림 — cold start 완전 회피는 못 함). 같은 워크플로가 프론트(namingkyeol.com)도 확인해 3회 연속 비200이면 run 실패 → GitHub 실패 알림 메일이 다운 감지 채널 (2026-07-30 Vercel 정지 402 사후 대책). 저장소 60일 무커밋 시 GitHub이 스케줄 자동 비활성화하므로 알림 메일 주의
- **api.namingkyeol.com 커스텀 도메인**: Render 검증 미완 — 완료 시 Vercel `NEXT_PUBLIC_API_URL` 교체 필요
- **dev 환경 확인**: `Properties/launchSettings.json`으로 `dotnet run`만 쳐도 Development 모드 자동 적용됨
