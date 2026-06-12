# NameForm 세션 인수인계

이 파일은 Claude 세션 간 연속성을 위한 작업 로그입니다.
**다음 세션 시작 시 `CLAUDE.md`와 함께 이 파일을 읽으면 현재 상태와 다음 작업 후보를 즉시 파악할 수 있습니다.**

---

## 마지막 세션 요약 (2026-06-13 — 운영 정비 3건)

전반 상태 점검(테스트 877/877 ✅, 프론트 22 라우트 빌드 ✅, namingkyeol.com 200 ✅) 후 발견 이슈 처리:

1. **Render cold start 회피** — 운영 API 첫 응답 34초 실측. `.github/workflows/keepalive.yml` 신규: 10분 간격 cron으로 `hanja-stats` 엔드포인트 ping (GitHub Actions 무료). ⚠️ 저장소 60일 무커밋 시 스케줄 자동 비활성화 — GitHub 알림 메일 오면 재활성화.
2. **루트 `dotnet test` 무동작 수정** — 솔루션 파일이 없어 루트에서 테스트 0개 실행+exit 0(성공처럼 보임)이던 문제. `NameForm.slnx` 신규 (메인+Tests 포함) → 루트 `dotnet test`로 877개 실행 확인.
3. **frontend/public의 무관 파일 정리** — "노출 정지 상품 리스트.csv"(꽃배달 사업 파일, 커밋 시 웹에 공개 서빙될 뻔) → `C:\Users\HappyFlower\Documents\`로 이동.
4. **CLAUDE.md 현행화** — 테스트 수(17→877), 운영 상태(배포 완료), 라우트(15→22, about/contact/favorites 반영), 알려진 이슈 갱신.

### 남은 작업 후보 (이전과 동일)
- api.namingkyeol.com Render 검증 → Vercel `NEXT_PUBLIC_API_URL` 교체
- Google Search Console 등록 + 사이트맵 제출 (Naver 인증 메타는 커밋됨 — 제출 여부 확인)
- 사용자 테스트 5~10명 + 피드백
- NicknameEngine 실구현 / Coming Soon 카테고리 (보류)

---

## 이전 세션 요약 (2026-05-20 — 🎊 정식 출범)

### 🚀 https://namingkyeol.com 공식 서비스 운영 시작

총 1시간 30분 작업으로 도메인 등록부터 SSL 자동 발급까지 풀스택 배포 완료.

### 운영 인프라 (전체 구성)

| 영역 | 서비스 | 상태 | 비용 |
|------|--------|------|------|
| **도메인** | Cloudflare Registrar | ✅ namingkyeol.com Active | $10.46/년 (auto-renew ON) |
| **이메일** | Cloudflare Email Routing | ✅ contact@namingkyeol.com → podopado1@gmail.com | 무료 |
| **DNS** | Cloudflare DNS | ✅ A/CNAME/MX 등 자동 + 수동 | 무료 |
| **프론트엔드** | Vercel Hobby | ✅ naming-kyeol.vercel.app + namingkyeol.com | 무료 |
| **백엔드** | Render Free | ✅ naming-kyeol-api.onrender.com | 무료 (15분 idle sleep) |
| **DB** | Supabase PostgreSQL | ✅ ap-northeast-2 (Seoul) | 무료 (500MB) |
| **SSL** | Let's Encrypt (Vercel 자동) | ✅ valid + trusted, TLS 1.3 | 무료 |
| **저장소** | GitHub | ✅ podopado1-sudo/naming-kyeol | 무료 |

**월 운영비**: 도메인만 **약 ₩1,200/월** (연 ₩14,000) — 호스팅·DB·이메일 모두 무료

### 도메인·계정 운영 정보

| 항목 | 값 |
|------|-----|
| 도메인 | namingkyeol.com |
| 등록일 | 2026-05-19 |
| **만료일** | **2027-05-19** (Auto-renew ON) |
| Renewal price | $10.46/년 |
| Registrar | Cloudflare |
| 이메일 라우팅 | contact@namingkyeol.com → podopado1@gmail.com |
| Vercel project | naming-kyeol (podopado's projects) |
| Render service | naming-kyeol-api (Singapore region) |
| Supabase project | svcsxemnivymmybyirkn (Seoul region) |
| GitHub repo | https://github.com/podopado1-sudo/naming-kyeol |

> ⚠️ DB 비밀번호, API Key 등은 **별도 메모장**(`Documents/namingkyeol-secrets.txt`)에 저장됨. 절대 git 커밋 금지.

### 트러블슈팅 5건 (Render 배포 과정)

1. **Render Python 자동 인식** → Dockerfile 추가 + Language Docker 변경
2. **useradd UID 1000 충돌** (.NET 10 기본 사용자와) → `USER $APP_UID` 패턴 (Microsoft 공식)
3. **Supabase Transaction Pooler IPv6 timeout** → Session Pooler (포트 5432) 변경
4. **EnsureCreated silent fail** → SELECT 1로 테이블 존재 검증 + GenerateCreateScript fallback
5. **Npgsql UTC strict (DateTime Kind=Unspecified)** → `Npgsql.EnableLegacyTimestampBehavior` 활성화

각 fix는 Program.cs / Dockerfile / csproj에 영구 반영.

### 배포 관련 신규 파일·변경

- **`Dockerfile`** (신규) — .NET 10 멀티 스테이지 빌드, $APP_UID 비루트 실행
- **`.dockerignore`** (신규) — Tests/, frontend/, bin/, logs/ 제외
- **`NameForm.csproj`** — data/**, scripts/*.json, Unihan_*.txt를 `CopyToPublishDirectory`로 명시
- **`Program.cs`**
  - `Npgsql.EnableLegacyTimestampBehavior=true` (최상단)
  - `DATABASE_URL` 환경변수 우선순위
  - `postgresql://` URI 자동 → Npgsql 형식 변환
  - EnsureCreated + 검증 + 강제 스키마 생성 fallback
- **`.gitignore`** — secrets/*.env 패턴 추가, frontend/.git 제거 (monorepo 통합)

### Vercel/Render 환경변수 (운영)

**Vercel** (`naming-kyeol` 프로젝트):
- `NEXT_PUBLIC_SITE_URL` = `https://namingkyeol.com`
- `NEXT_PUBLIC_API_URL` = `https://naming-kyeol-api.onrender.com/api/v1`
  - ⚠️ `api.namingkyeol.com` 검증 완료되면 `https://api.namingkyeol.com/api/v1`로 교체

**Render** (`naming-kyeol-api`):
- `DATABASE_URL` = Supabase Session Pooler URI (포트 5432)
- `ASPNETCORE_ENVIRONMENT` = `Production`
- `Authentication__Enabled` = `false` (현재 — 필요 시 true로 + ApiKeys 추가)
- `Cors__AllowedOrigins__0` = `https://namingkyeol.com`
- `Cors__AllowedOrigins__1` = `https://www.namingkyeol.com`
- (필요 시 `__3` = `https://naming-kyeol.vercel.app` Vercel 백업)

### Cloudflare DNS 레코드 (자동 + 수동)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A or CNAME | @ (apex) | Vercel auto-config | DNS only |
| CNAME | www | (Vercel auto-config hash).vercel-dns.com | DNS only |
| CNAME | api | naming-kyeol-api.onrender.com | DNS only |
| MX × 3 | @ | Cloudflare Email Routing | DNS only |
| TXT (SPF) | @ | v=spf1 include:_spf.mx.cloudflare.net ~all | DNS only |
| TXT (DMARC) | _dmarc | v=DMARC1; p=none; rua=mailto:... | DNS only |

### 보안 검증 결과 (배포 완료 후 — 2026-05-20 측정)

#### 기본 SSL/TLS
- ✅ HTTPS: TLS 1.3, AES_128_GCM
- ✅ Certificate: valid + trusted (Let's Encrypt R12)
- ✅ All resources served securely
- ✅ Cloudflare DDoS 자동 방어 (proxy off라 부분 적용)

#### 외부 평가 도구 점수

| 도구 | 등급 | 점수 | 비고 |
|------|------|------|------|
| **SecurityHeaders.com** | **A** | 6/6 헤더 모두 ✅ | "Grade capped at A" |
| **Mozilla Observatory** | **B+** | 80/100 (9/10 통과) | CSP `unsafe-inline` 1건 감점 |
| **SSL Labs** (예상) | A | TLS 1.3 + Let's Encrypt | Vercel 자동 |

**적용된 보안 헤더 (6/6)**:
- Content-Security-Policy
- Permissions-Policy
- Referrer-Policy
- Strict-Transport-Security (preload-ready)
- X-Content-Type-Options
- X-Frame-Options (DENY)

#### A+ 등급으로 가는 길 (선택, 트래픽 모인 후)
유일한 감점: **CSP의 `'unsafe-inline'`** — Next.js JSON-LD 인라인 스크립트 때문에 필수
- 해결책: nonce 도입 (middleware로 매 요청 랜덤 nonce 생성 + CSP에 주입)
- 작업 시간: 1~2시간
- 효과: SecurityHeaders.com A → A+, Mozilla Observatory B+ → A 또는 A+
- 우선순위: 낮음 (현재 B+/A 등급으로도 일반 운영 충분)

### 도메인 만료 관리

- **자동 갱신 ON** — 카드 결제 자동, 별도 메모 불필요
- Cloudflare 알림: 만료 30일/15일/7일 전 + 결제 실패 시 podopado1@gmail.com으로 이메일
- 권장 추가 안전장치: Google Calendar에 2027-04-19 (만료 1달 전) 알림 등록

### 남은 후속 작업 (선택, 우선순위 낮음)

1. **`api.namingkyeol.com` 검증 완료** — Render Custom Domain "Retry Verification" 클릭 후 검증 ✅되면 Vercel `NEXT_PUBLIC_API_URL`을 `https://api.namingkyeol.com/api/v1`로 교체 → Redeploy
2. ~~**보안 점수 측정**~~ ✅ 완료 (2026-05-20): SecurityHeaders A, Mozilla Observatory B+ (80/100). A+ 작업은 트래픽 모인 후
3. **SEO 등록** — Google Search Console / Naver Search Advisor / Daum 사이트 등록 + sitemap 제출
4. **og-image 추가** — 1200×630 PNG → `frontend/public/og-image.png` 배치
5. **`namingkyeol.kr` 등록 (선택)** — 가비아 ₩22,000/년 (브랜드 보호)
6. **Render Free spin-down 회피 (선택)** — Uptime Robot 무료 ping 5분마다 → cold start 없음
7. **사용자 테스트** — 친구·지인 5~10명에게 https://namingkyeol.com 공유 + 피드백
8. **#4 NicknameEngine 패턴 추가** (보류)
9. **Coming Soon** — 회사명·반려동물 카테고리 실현

---

## 이전 세션 요약 (2026-05-18 — 채점 일관성 + 작명 보강 4건)

### 1. 채점 단일 진입점 완성 — TwinNameService / NameAnalysisService 통합

이전 세션에 도입된 `ScoringService` 단일 진입점에 **누락된 2개 서비스**를 통합. smart 추천 점수와 evaluate/analysis/twin 점수가 구조적으로 일치하도록 보장.

- **TwinNameService**: `IAestheticEngine` + `IHarmonyEngine` 직접 호출 → `IScoringService.EvaluateAsync` 경유
- **NameAnalysisService**: 동일하게 정리. BirthDate 없을 땐 미학+희귀도만 별도, 어느 경로든 `ScoringService.NormalizeGender/Tone` 적용
- 회귀 테스트 추가: smart vs analysis 5케이스, twin 후보의 ScoringService 동등성

### 2. `/method` 페이지 — "리포트 방식" 섹션 신설
"AI는 이야기, 우리는 리포트" 포지셔닝을 사용자 교육 페이지에 명시.
- AI 서술형 vs 이름의 결 리포트 좌우 대비 카드
- 리포트 예시: `발음 87점 — 받침 0개 / 부드러운 자음 비율 100%` 형식
- 04로 삽입, 기존 "우리가 안 하는 것"은 05로 밀림

### 3. 작명 기능 보강 4건 (#1, #2, #3, #8)

#### #1 의미 선호 키워드 입력
사용자가 "지혜, 용기, 맑음" 같은 의미를 콤마/공백 구분으로 입력.
- DTO: `SmartRecommendationRequestDto.PreferredMeanings: List<string>?`
- 인터페이스: `INamePoolEngine.GenerateCandidatesAsync(..., IReadOnlyList<string>? preferredMeanings = null)`
- NamePoolEngine `CalcPersonalizedScore`에 가산 — 한자의 `Meaning` / `Category` / `CategoryTags`와 매칭 시 매칭당 +220, 최대 +500
- 프론트 search 페이지 추가 옵션 Accordion에 입력 필드 + 안내 문구

#### #2 항렬자(돌림자) 한자 직접 지정
형제자매 공유 한자(俊 등)를 정확히 지정해 작명.
- DTO: `RequiredCharRequest.RequiredHanja?` / `SmartRecommendationRequestDto.RequiredHanja?`
- 인터페이스: `IRequiredCharEngine.GenerateCandidatesAsync(..., string? requiredHanja = null)`
- RequiredCharEngine: 한자 지정 시 발음(`requiredChar`) 자동 도출, 그 한자만 후보로 고정
- `RequiredCharCandidate.FixedHanja` 필드 신설, 카테고리 라벨 "항렬자 이름" 분기
- 프론트: "항렬자 (선택, 한자)" 입력 + 설명 텍스트
- 컨트롤러: RequiredChar 또는 RequiredHanja 중 하나만 있어도 허용

#### #3 부정 발음 패턴 데이터 v2.0
`scripts/negative_phonetic_patterns.json` 전면 재작성.

| 카테고리 | 이전 | 신규 |
|---|---|---|
| high_penalty 음절 | 15(중복 7개) | 29 |
| medium_penalty | 9(중복 6개) | 19 |
| negative_combinations | 4 | 12 |
| verbs_and_adjectives | 18 | 45+ |
| negative_phrases | 10 | 30+ |
| homophone_negative | 2 | 15 |
| morpheme_patterns | 3 | 8 |

추가 음절: 흉/망/죽/악/병/곤/탐/도/살 등. 추가 동사: 망하다/죽다/흉하다/병들다 등.

**버그 수정**: `NegativePatternLoader`가 snake_case JSON ↔ PascalCase C# 클래스 매핑을 못 하던 문제 발견. `JsonNamingPolicy.SnakeCaseLower` 적용. (이전엔 일부 필드가 항상 빈 폴백을 쓰고 있었음)

**병렬 테스트 안정성**: search paths에서 `Directory.GetCurrentDirectory()` 후순위로 이동, `AppContext.BaseDirectory` 우선. 테스트용 `ResetCache()` 메서드 신설.

#### #8 NamingPrinciples 새 작명 스킬 4종
- `EvalAwkwardCombination` — 격음(ㅊㅋㅌㅍ)+된소리(ㄲㄸㅃㅆㅉ) 결합 회피 (0.1점)
- `EvalConsonantEcho` — 같은 받침 반복 감점 (민준=ㄴㄴ 0.3점)
- `EvalForeignPhonotactics` — 외래어 발음 회피 (조지/줄리/유키 등 20개+)
- `EvalSyllableLengthBalance` — 성씨+이름 음절 균형 (1+2=1.0, 2+3=0.25)

NamePoolEngine 조합 점수 공식에 4종 통합 (가중치 60~120). 단위 테스트 28개 추가 (`NamingPrinciplesTests.cs` 신규 파일).

### 4. 빌드/테스트 상태
- 백엔드: 0 errors, 0 warnings
- 테스트: **710 → 810개 (+100)**, 실패 0
- 프론트엔드: 19개 라우트 빌드 + `tsc --noEmit` 통과

### 5. 점수 정확도/데이터/테스트 보강 (#5~#13)

이번 세션 후반에 8건 추가 처리:

#### #5 용신 보완 가중치 강화
HarmonyEngine이 단순 lacking/excessive 판단만 하던 것을 **YongshinCalculationService 결합**으로 강화.
- `HarmonyEngine` 2번째 생성자에 `IYongshinCalculationService` 주입 (DI 자동 선택)
- PrimaryYongshin 보완 +30, Heeshin +12, Gishin 충돌 -25
- 기존 lacking/excessive 가산은 보조로 약화 (20→10)
- 용신 계산 실패 시 graceful degradation

#### #6 자원오행 ConfidenceGrade 반영
- C/D 등급 한자 포함 시 자원오행 점수 0.85배
- 획수 미상 음절 포함 시 0.75배
- notes에 신뢰도 감산 명시

#### #7 81수리 5단계 매핑
이전 길수/흉수 이분법(15/11/7/4/1) → **5단계 분류** (대길/중길/평/소흉/대흉).
- `SuriGrade` enum + `GreatFortuneNumbers`(38개) / `MediumFortuneNumbers` / `NeutralNumbers` / `GreatMisfortuneNumbers` 분류
- 원/형/이/정 각 격당 0~4점 → 16점 만점 → 15점 환산
- notes의 라벨도 "길/흉" → "대길/중길/평/소흉/대흉"

#### #9 NamingPrinciples 음운론 3종 추가
- `EvalConsonantAssimilation` — 종성-초성 동화 (박+강 경음화 0.4, ㄴ+ㄹ 유음화 0.85)
- `EvalVowelMonotony` — 동일 모음 반복 감점 (사사, 미지 등 0.45)
- `ApplyDueum` / `RequiresDueum` — 두음법칙 매핑 (리→이, 림→임, 류→유 등 21개)
- NamePoolEngine 조합 점수에 통합 (가중치 50~70)

#### #10 사전 확장
- 순우리말: **274 → 326** (Neutral 24 + Male 14 + Female 14 추가)
- 3음절 큐레이션: **91 → 139** (한자/순우리말/혼합 골고루)
- "솔바람" 중복 항목 정리, "달가람솔"로 교체

#### #11 CreativeNamingEngine 성씨 사전
검증 결과 **이미 323개 + 복성 6개**로 매우 풍부 → 작업 불필요 결정

#### #12 추천 품질 회귀 테스트
`RecommendationQualityTests.cs` 신규 13개 테스트:
- 골든 케이스 5건 — 김/이/박/최/정 입력에 TopPick 점수 75+ 보장
- 다양성 — 카테고리 내 동일 첫 글자 ≤ 3개 (NamePool 캡 검증)
- 유행 이름 0개, 외래어 발음 후보 5% 미만, 점수 내림차순, PreferredMeanings 효과 검증

#### #13 엔진별 단위 테스트
- `YongshinCalculationServiceTests` — 9개 (강약·조후·결정성)
- `SajuCalculationServiceTests` — 12개 (**골든 케이스 1985-06-05 13:01 서울 → 乙亥 일주·壬午 시주** 검증 포함)
- 모든 엔진 *Tests 파일 존재 확인 (16/16)

### 6. 빌드/테스트 누적
- 백엔드: 0 errors, 0 warnings
- 테스트: **710 → 869개 (+159)**, 실패 0
- 프론트엔드: 19개 라우트 빌드 + `tsc --noEmit` 통과

### 7. 잔여 이슈 정리 (#`/baby` 외 4건)

세션 끝나기 전 추가 정리:

#### `/baby` 리다이렉트 확인
- `next.config.ts`에 이미 `/baby` → `/search` permanent(301) 리다이렉트 구성됨 — **이미 완료**
- CLAUDE.md의 "미구성" 메모 정정

#### 추천 다양성 보강
`RecommendationQualityTests.cs`에 4개 테스트 추가:
- 둘째 글자 카테고리당 ≤ 3 (NamePool 캡 검증 강화)
- 표준 카테고리 첫 글자 ≥ 5종 (단조 회피)
- 카테고리 내 중복 이름 0개
- 표준 카테고리 상위 10개 평균 점수 ≥ 70

**버그 발견·수정**: PureKoreanNameEngine 사전에 19개 중복, three-syllable-curated.json에 2개 중복.
- 3음절 JSON 중복 직접 정리 (도윤서/윤도현/도현우 교체)
- PureKoreanNameEngine은 결과에 `GroupBy(Name).First()` 적용 — 사전 중복이 있어도 결과는 깨끗

#### CreativeNamingEngine 희귀 성씨 검증
- 봉/탁/제갈/선우/남궁/사공/황보/독고 등 모두 매핑 확인
- 복성 6개의 키워드를 4 → 6개로 증식 (남궁/사공/제갈/황보/선우/독고)

#### DualNameEngine 영한 매핑 확장
- `data/english_korean_names.json` 90 → **122개** (+32)
- 남성: 46 → 63 (Adam/Andrew/Anthony/Benjamin 등 17개 추가)
- 여성: 44 → 59 (Amy/Ashley/Catherine/Emma/Grace 등 15개 추가)

#### static 캐시 ResetCache 패턴 통일
3개 로더 모두 `public static void ResetCache()` 시그니처로 통일:
- `NegativePatternLoader.ResetCache` (기존)
- `PhonologyJointLoader.ResetCache` (신규 — 기존 internal Reload는 유지)
- `PhonologyVowelLoader.ResetCache` (신규 — 기존 internal Reload는 유지)

3개 로더 모두 search paths에서 `Directory.GetCurrentDirectory()`를 후순위로 이동 (병렬 테스트 안정성).

### 8. SEO 강화 (Next.js metadata API 풀 활용)

**잘못된 통념 정정**: 사용자가 "리액트가 SEO에 좋다"는 말을 듣고 변환을 검토했으나, 현재 Next.js 16 App Router가 **순수 React(CRA/Vite)보다 SEO에 훨씬 우수**함을 설명. 변환 불필요.

대신 다음 SEO 자산을 추가:

#### 신규 파일
- `frontend/src/app/robots.ts` — `/robots.txt` 자동 생성
  - 전체 크롤링 허용, `/favorites`·`/api/` 제외
  - sitemap.xml 위치 명시
- `frontend/src/app/sitemap.ts` — 16개 라우트 사이트맵
  - 우선순위: 홈/method/guide 0.9~1.0, 추천 도구 0.7~0.8, 보조 0.6, 운영 0.4
  - `changeFrequency` 라우트별 차등

#### 페이지별 layout.tsx 12개 (metadata 주입용)
client component(`"use client"`)는 metadata 직접 export 불가 → 각 라우트에 layout.tsx 신설:
- `/method`, `/guide`, `/search`, `/evaluate`, `/analysis`
- `/pure-korean`, `/twin`, `/three-syllable`, `/required-char`
- `/parent-based`, `/creative`, `/rare-surname`, `/dual-name`

각 layout은 title/description/canonical/Open Graph를 페이지 특성에 맞게 설정.

#### 루트 layout.tsx 메타데이터 풍부화
- `metadataBase` + title 템플릿 (`%s | 이름의 결`)
- 한국 시장 키워드 10개 (작명, 아기 이름, 한자 이름, 순우리말 이름, 사주 작명 등)
- `robots.googleBot` 명시적 허용 + `max-snippet: -1`, `max-image-preview: large`
- **Open Graph** (카카오톡/페이스북 공유 미리보기)
- **Twitter Card** (X 공유)
- `applicationName`, `creator`, `publisher`, `category` 등 풀 셋
- `formatDetection` — 전화번호/이메일 자동 링크 비활성화

#### JSON-LD 구조화 데이터
루트 layout `<head>`에 schema.org 스크립트 삽입:
- `Organization` — Google Knowledge Panel 후보
- `WebSite` + `SearchAction` — 검색 결과에 사이트 검색 박스 노출
  - `https://nameform.kyeol/search?lastName={search_term}` 직접 진입

#### `<h1>` 점검 — 모든 페이지 정확히 1개씩 확인
16개 라우트 + 홈(Hero.tsx) 모두 OK.

#### 환경 변수
배포 시 `NEXT_PUBLIC_SITE_URL` 설정 필요 (Vercel/.env). 미설정 시 `https://nameform.kyeol` 폴백.

#### 검증
- 타입: `tsc --noEmit` 통과
- 빌드: 22개 정적 페이지 생성 (`/robots.txt`, `/sitemap.xml` 자동 포함)

#### 배포 후 1회성 작업
1. Google Search Console 등록 → 사이트맵 제출
2. Naver Search Advisor 등록 → 사이트맵 제출
3. Daum 검색 등록
4. Open Graph 이미지(`og-image.png` 1200×630) 추가 — 공유 카드 강화

### 9. 배포/도메인 의사결정 가이드

사용자가 "도메인을 배포보다 먼저?"라고 질문 → **권장 순서 정리** (코드 변경 없음, 참고 메모):

**1순위 — 도메인 등록 먼저 (10분)**
- 원하는 도메인 선점 여부 확인 (whois)
- 가능하면 `.com` + `.kr` 둘 다
- Cloudflare 또는 Namecheap 추천 (Email Routing 지원)
- 비용: `.com` 15,000원/년, `.kr` 22,000원/년

**2순위 — 배포 플랫폼 결정**
- 프론트: **Vercel** (Next.js 16 네이티브, Hobby 무료)
- 백엔드: Azure App Service B1(~₩15,000/월) 또는 Render Free
- DB: Supabase 또는 Neon (PostgreSQL 무료 티어)

**가장 무난한 조합**: Vercel + Azure App Service B1 (월 ~15k)
**가성비 조합**: Vercel + Render Free + Supabase Free (~0원, 콜드 스타트 감수)

### 10. 누적 최종 (2026-05-18 세션 종료)
- 테스트: **710 → 877개 (+167)**, 실패 0
- 빌드: 백엔드 0 errors / 0 warnings, 프론트 22 라우트 정적 생성
- 라우트: 19 → **22** (robots.txt + sitemap.xml 자동 라우트 포함)

### 11. 봇 방어 + 도메인 결정 (2026-05-18 마지막 세그먼트)

#### 도메인: `namingkyeol.com` + `namingkyeol.kr`
- `.com` Cloudflare RDAP 404 확인 — **사용 가능 확정**
- `.kr` DNS 미등록 — 가능성 매우 높음 (가비아에서 최종 확인 필요)
- 등록 계획: Cloudflare(.com $9.77/년) + 가비아(.kr ₩22,000/년)
- 이메일 라우팅: `contact@namingkyeol.com` → **podopado1@gmail.com** (Cloudflare Email Routing 무료)
  - ⚠️ 메모리의 `cnamkil66@gmail.com`(개인용)와 분리 — 서비스용은 podopado1

#### robots.ts에 AI 학습 봇 차단 추가
콘텐츠 학습 데이터로 쓰이는 것 방지 + 트래픽 절감:
- **차단**: GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai, Claude-Web, Google-Extended, FacebookBot, Meta-ExternalAgent, CCBot, Bytespider, PerplexityBot, Amazonbot, Applebot-Extended, Diffbot, ImagesiftBot, Omgilibot, YouBot (총 18종)
- **명시 허용**: Googlebot, Bingbot, Naverbot, Yeti, Daumoa
- 기본 정책 유지 — 그 외 봇은 사이트 허용 + `/favorites`·`/api/` 차단

#### 백엔드 Rate Limiting 미들웨어
.NET 10 내장 `Microsoft.AspNetCore.RateLimiting` 도입.

**전역 정책** (모든 endpoint):
- IP당 분당 60회 (FixedWindow)

**`expensive` 정책** (CPU 큰 작업):
- IP당 분당 20회 (SlidingWindow, 6 segments)
- 적용 컨트롤러:
  - `RecommendationsController` — 추천/평가/피드백 모두
  - `NameAnalysisController` — 사주 4기둥 + 용신
  - `TwinNameController` — 쌍둥이 세트 (후보별 채점)

**초과 시 응답**:
- 429 Too Many Requests
- `Retry-After: 60` 헤더
- JSON: `{"error":"요청이 너무 많습니다. 잠시 후 다시 시도해주세요."}`

미들웨어 순서: `Cors` → `RateLimiter` → `ApiKeyAuth` → `Authorization`
(인증 시도 자체도 카운트해야 무차별 봇 막을 수 있음)

#### 폴백 도메인 변경
환경변수 `NEXT_PUBLIC_SITE_URL` 미설정 시 폴백 도메인을 `nameform.kyeol` → **`namingkyeol.com`**으로 통일:
- `frontend/src/app/layout.tsx`
- `frontend/src/app/robots.ts`
- `frontend/src/app/sitemap.ts`

### 12. 배포 전 필수 보안 4종 (2026-05-18 마지막)

봇 방어 외 일반 공격 표면 차단:

#### #1 HTTP 보안 헤더
**백엔드** `SecurityHeadersMiddleware` 신규:
- `X-Content-Type-Options: nosniff` (MIME sniffing 차단)
- `X-Frame-Options: DENY` (clickjacking 방어)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Content-Security-Policy: default-src 'none'` (API 응답 기본, Swagger는 별도)
- `Strict-Transport-Security` (운영 환경에서만, max-age=1년 + preload)
- `Server`/`X-Powered-By` 헤더 제거

**프론트엔드** `next.config.ts` `headers()`:
- 동일 6종 + CSP는 `script/style/img/font/connect-src` 세분화
- `connect-src`에 `NEXT_PUBLIC_API_URL` 자동 주입
- `poweredByHeader: false`

#### #2 로그 PII 마스킹
`Api/Logging/PiiMaskingPolicy.cs` 신규 — Serilog `IDestructuringPolicy` 구현:
- BirthDate: `1985-06-05` → `1985-**-**`
- BirthTime: `13:01` → `13:**`
- Name/FirstName/LastName: `김서윤` → `김*윤`, `남궁민준` → `남*준`
- Email: `podopado1@gmail.com` → `po******@gmail.com`
- 대상 필드명 한글/영문 모두 지원

부수 효과: 로그 파일 크기 제한 추가 (일별 50MB, 초과 시 자동 분할)

#### #3 입력 길이 제한
5개 DTO에 `[StringLength]`/`[MaxLength]`/`[Range]` 데이터 어노테이션:
- SmartRecommendationRequestDto / CreateRecommendationRequestDto
- NameEvaluateRequestDto / NameAnalysisRequestDto
- TwinNameRequestDto / RequiredCharRequest

제한:
- 성씨 2자, 이름 10자, 부모 이름 20자
- 스토리 키워드 50자, 영어 이름 30자, 의미 키워드 10개
- RequiredChar/RequiredHanja 각 1자
- 자녀 수 2~3 범위

ReDoS 공격·메모리 폭발·DB 폭주 방어

#### #4 API Key 환경변수 분리
- `appsettings.json`: ApiKeys = [] 빈 배열 확인 (하드코딩 노출 없음)
- `.gitignore`에 운영 secrets 패턴 추가:
  - `appsettings.Production.json`
  - `appsettings.*.local.json`
  - `secrets.json`, `*.env`, `.env*`
- `appsettings.json`에 보안 주석 — "환경변수로 주입" 안내

배포 시 환경변수 형식:
```
Authentication__Enabled=true
Authentication__ApiKeys__0=<생성한키>
```

### 13. 보안 상태 최종

| 계층 | 적용 | 도구 |
|---|---|---|
| 봇 차단 | ✅ | robots.txt (AI 봇 18종) |
| 트래픽 제한 | ✅ | Rate Limiting (전역 60/분, expensive 20/분) |
| 인증 | ✅ | API Key 미들웨어 (환경변수) |
| 보안 헤더 | ✅ | CSP/HSTS/X-Frame-Options 등 7종 |
| 입력 검증 | ✅ | DTO data annotation |
| PII 보호 | ✅ | Serilog destructuring policy |
| HTTPS | ✅ | UseHttpsRedirection + HSTS |
| CORS | ✅ | 명시 origin만 허용 |
| Secrets | ✅ | .gitignore + 환경변수 |
| DDoS | 🔵 (배포 후) | Cloudflare 프록시 자동 |
| CAPTCHA | 🔵 (선택) | Cloudflare Turnstile |
| 에러 추적 | 🔵 (선택) | Sentry |

### 14. 누적 최종 (2026-05-18 세션 종료)
- 테스트: 710 → **877개 (+167)**, 실패 0
- 빌드: 백엔드 0 errors / 0 warnings, 프론트 22 라우트
- 보안 등급: D → **B+ 예상** (배포 후 Mozilla Observatory로 실제 측정)

### 15. 배포 후 보안 점수 측정 절차 (TODO)

배포 완료 후 다음 도구로 보안 등급 객관 측정.

#### 측정 도구

**1. Mozilla Observatory** — 종합 보안 헤더 점수
- URL: https://observatory.mozilla.org/
- 입력: `namingkyeol.com`
- 평가 항목: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Subresource Integrity, Cookies, Cross-Origin Resource Sharing 등 10개
- 예상 점수: **B+ ~ A-** (CSP 'unsafe-inline' 때문에 A+는 어려움)

**2. SSL Labs** — HTTPS/TLS 강도
- URL: https://www.ssllabs.com/ssltest/
- 입력: `namingkyeol.com`
- 예상 등급: **A** (Cloudflare/Vercel 기본 TLS 1.3 + 강한 cipher)

**3. Security Headers** (별도 도구)
- URL: https://securityheaders.com/
- 입력: `namingkyeol.com`
- 빠른 헤더 점검 (Mozilla Observatory와 유사)

**4. PageSpeed Insights** — 성능 + 일부 보안
- URL: https://pagespeed.web.dev/
- 보안 항목: HTTPS, X-Frame-Options, no vulnerable libraries

#### 점수 향상 로드맵 (A → A+ 가는 길)

각 항목 적용 시 등급 ↑:

| 작업 | 효과 | 난이도 |
|------|------|--------|
| Cloudflare Orange Cloud 활성화 | DDoS 자동 + Bot Fight | 5분 (도메인 등록 후 자동) |
| HSTS preload 등록 | 첫 방문도 HTTPS 강제 | 5분 (hstspreload.org 제출) |
| CSP에서 `unsafe-inline` 제거 | XSS 완전 차단 (A+ 가능) | 1~2시간 (nonce 도입) |
| Subresource Integrity (SRI) | CDN 자산 변조 차단 | 30분 (외부 자산 hash 추가) |
| `Cross-Origin-Embedder-Policy` 등 COxP 헤더 | 격리 정책 | 15분 |
| Sentry 에러 추적 | OWASP A09 충족 | 30분 |
| Dependabot 활성화 | OWASP A06 충족 | 1분 (GitHub 설정) |

#### 측정 후 적용 우선순위

1. **즉시 (점수 안 나오면)**: CSP 조정 — `unsafe-inline` 대신 nonce 또는 hash
2. **A로 가기**: HSTS preload 등록 (한 번만)
3. **A+로 가기**: CSP nonce 도입 (코드 변경 필요)
4. **운영 안정성**: Sentry + Dependabot

#### 메모

- 측정 시점: 배포 완료 + DNS 전파 끝난 후 (보통 24시간 이내)
- Cloudflare 프록시 ON 상태에서 측정 — Cloudflare가 일부 헤더 자동 추가
- 등급보다 **실제 적용된 보호 항목 체크리스트가 더 중요** (OWASP Top 10 기준)
- 정기 측정: 분기 1회 권장 (라이브러리 업데이트 영향 추적)

### 다음 작업 후보

- **도메인 결제 진행** (Cloudflare 가입 → namingkyeol.com 구매 + 가비아 .kr)
- **Cloudflare Email Routing** 설정 (contact@namingkyeol.com → podopado1@gmail.com)
- **배포** (Vercel + Azure/Render)
- 배포 후 환경변수 `NEXT_PUBLIC_SITE_URL=https://namingkyeol.com` 설정
- Google/Naver Search Console 등록 + 사이트맵 제출
- og-image 1200×630 추가
- **#4** NicknameEngine 한자 의미·부모 호칭 패턴 (보류)
- Coming Soon 카테고리 실현 (회사명/반려동물)
- 실제 사용자 테스트 + 피드백 수집

---

## 이전 세션 요약 (2026-05-15 종료 — 채점 통합 + UX 정리)

### 핵심: 점수 일관성 구조적 해결

여러 페이지에서 같은 이름이 다른 점수로 나오던 문제 → **단일 진실의 원천 도입**.

#### 1. `IScoringService` / `ScoringService` 신규 (`Application/Services/`)
- 모든 점수 계산의 단일 진실의 원천
- 정규화: gender/tone을 `ToLowerInvariant()` (호출자가 "Female"/"female" 어느 쪽으로 보내도 동일 결과)
- `FinalScore = Math.Round(aesthetic*0.7 + harmony*0.3)` 일관 적용 (int cast 금지)
- `NameEvaluationService`, `RecommendationService` 모두 이 서비스만 호출 → smart TopPick과 evaluate 점수 **구조적 일치**

#### 2. 채점 미스매치 발견-수정 7건 (이전 패치 누적 후 정리)
- `RecommendationService`가 gender 미전달 → +5점 차이 (해결)
- `/search` 폼이 "Female" 대문자 전송 → 백엔드 소문자 비교 → +5점 차이 (해결)
- TopPick이 카테고리 간 단순 max → 의미 다른 점수끼리 비교 (해결: standard 카테고리 우선)
- 프론트 mapCandidate가 mock 값 사용 → 실제 aestheticScore/harmonyScore 받음
- ExplanationEngine `(int)` 버림 vs Math.Round 불일치 (해결: Math.Round 통일)
- `SmartNameCandidateDto`에 `AestheticScore`/`HarmonyScore` 필드 신규

#### 3. ExplanationEngine 리포트 형식 전환
- "AI는 이야기, 우리는 리포트" 포지셔닝
- 서사적 ("발음이 부드럽고 자연스러움") → 수치+근거 ("발음 87점 — 받침 0개 / 부드러운 자음 100%")
- 모든 출력이 `[수치/지표] — [근거]` 형식
- DTO 구조는 유지 (프론트 호환), 내용만 변경

#### 4. LLM 서비스 완전 제거
- `LlmExplanationService`/`ILlmExplanationService`/테스트/DTO 필드 삭제
- 프론트 `LlmCard` 컴포넌트, `LlmExplanation` 타입 제거
- 이유: 리포트 정체성과 충돌. 자연어 생성은 불필요
- `appsettings.json`의 Anthropic 설정도 정리

#### 5. NamingPrinciples — 보편 작명 원리 추출
- `Application/Engines/NamingPrinciples.cs` 신규
- 5종 함수: `EvalSurnameFlow`, `EvalRhythm`, `EvalInitialDiversity`, `EvalOhaengSynergy`(음령오행 기반), `TrendyNames`
- 5개 엔진에 적용: NamePool, PureKorean, ThreeSyllable, RareSurname, Creative
- 작명 스킬 추가 시 한 곳만 수정하면 전체 반영

#### 6. NamePoolEngine 전면 재설계
- 첫글자 도배 문제("강X" 10개) 해결
- 개인화 한자 점수: 기본 품질 + 사주 부족 오행 보완 + 성별/톤 적합도
- 발음별 대표 한자 추출 → 조합 페어 점수 → 첫·둘째 글자 다양성 캡(`GroupBy.Take(3)`)
- 작명 스킬 5종 적용 (성씨연음, 오행상생, 의미시너지, 리듬, 초성다양성)

#### 7. 다른 엔진 보강
- **TwinNameEngine** 전면 재작성: 사주 주입, 개인화 한자 점수, NamingPrinciples 적용, "공유톤" 진짜 TonePref 기반, CoherenceScore 실제 계산
- **RequiredCharEngine** 전면 재작성: 사주 주입, 개인화 점수 + 작명 스킬 적용 + 다양성 캡
- **PureKoreanNameEngine**: 사전 204개 → 274개 확장, 채점 변별력 강화 (76~79 분포)
- **NamingPrinciples.EvalSurnameFlow**: 받침-없는 성씨도 이름 초성에 따라 0.55~0.95 차등 (이전 일률 0.85)

#### 8. 점수 분포 개선
| 탭 | 이전 | 현재 |
|---|---|---|
| creative | 모두 100점 | 83-90 |
| three-syllable | 98-100 | 84-88 |
| pure-korean | 모두 96 | 76-79 |
| standard | 정상 | 81-86 |

#### 9. 프론트엔드 리포트 폴리시
- `tabular-nums` 전반 적용 (점수 정렬 깔끔)
- Summary 칩 스타일 (둥근 회색 배경, 진단 스트립 느낌)
- 이모지 → lucide 아이콘 (💎→Sparkles, ⚠️→Info)
- 새 `NoteBlocks`, `StrengthsCautions`도 tabular-nums

#### 10. UX 흐름 개선
- "BABY NAMING" → "Naming · Result"
- "X 씨 아기를 위한 이름" → "X 씨를 위한 이름" (사용자 폭 확대)
- TopPick의 "상세 보기" 클릭 → `/evaluate` 자동 평가 (URL 컨텍스트 전달 → 폼 다시 안 채워도 됨)
- Hero 이름 평가 탭에 생년월일/시각/성별/톤 추가 → 홈에서 한 번에 풀 평가
- ExplanationCard 텍스트 형식 리포트화 (Notes 영역 tabular-nums)

#### 11. 즐겨찾기 시스템 (회원가입 없이)
- `frontend/src/lib/favorites.ts` 신규: localStorage 기반 + `useFavorites`/`useIsFavorite` 훅
- `/favorites` 페이지 신규: 저장한 이름 목록 + 다시 평가 + 제거
- `/evaluate` 결과 페이지에 ♥ 저장 / 공유 / PDF 버튼
- Header "로그인"/"시작하기" 제거 → "♥ 저장한 이름" 링크로 교체

#### 12. PDF 다운로드 (인쇄 기반, 무료 마케팅 자산)
- `window.print()` + `@media print` CSS
- 의존성 0, 헤더/푸터/버튼 자동 숨김, A4 16mm 여백
- "PDF" 버튼 한 번 누르면 인쇄 대화상자 → "PDF로 저장"

#### 13. 한국어 조사 유틸리티 (KoreanUtils)
- 5종 추가: `EunNeun`(은/는), `IGa`(이/가), `EulReul`(을/를), `GwaWa`(과/와), `EuroRo`(으로/로)
- 받침 자동 감지 매핑 (ㄹ 받침 + "로" 처리)
- 5개 파일 9곳 일괄 적용 (CreativeNaming, Yongshin, FamilyNarrative, TwinName, ParentBased)

#### 14. 참고용 안내 추가
- `/evaluate`, `/search` 결과 페이지 하단에 안내 박스:
  > **이 추천은 시작점이에요** — 처음부터 이름을 짓는 건 어려운 일이에요. 이 도구로 후보를 찾고, 마음에 드는 이름은 사용하시고, 아쉬운 건 참고만 하세요. 결국 이름을 정하는 건 당신의 몫입니다.

#### 15. 수익화 보류 결정
- PDF는 무료 (마케팅 자산)
- 후원하기: toss.me 종료(2024-08) 발견 → 카카오페이 QR 등 검토했으나 트래픽 모인 후 재결정으로 보류
- Footer 후원 링크 제거 + `.env.local`에서 `NEXT_PUBLIC_DONATE_URL` 삭제

### 빌드/테스트 상태
- 백엔드: 빌드 0 errors, 710개 테스트 통과 ✓
- 프론트엔드: 19개 라우트 정적 빌드 통과 ✓

### 검증 (smart vs evaluate 점수 일치)
같은 입력(허/1985-06-05/female/neutral)으로 5개 후보 비교:
```
허태학: smart=89/91/90  eval=89/91/90  ✓
허기태: smart=92/82/89  eval=92/82/89  ✓
허우학: smart=89/88/89  eval=89/88/89  ✓
허주학: smart=89/85/88  eval=89/85/88  ✓
허우준: smart=84/96/88  eval=84/96/88  ✓
```
**5/5 완벽 일치** — 구조적 보장 확인

---

## 이전 세션 요약 (2026-05-15 — HarmonyEngine 마이그레이션)

이전 세션에서 처리한 주요 작업과 영구적으로 반영된 변경사항.
세부 내용은 `CLAUDE.md`의 해당 섹션에 통합되어 있음.

### 핵심 변경 (영구 반영)

#### 1. 라우트 마이그레이션 `/baby` → `/search`
- 폴더 이름 변경 + 11개 파일 16곳의 URL 참조 일괄 갱신
- 페이지 eyebrow "BABY NAMING · 아기 이름" → "NAMING · 이름 찾기"
- Footer "아기 이름" / ComingSoonModal 대안 / SystemStates NotFound 라벨도 "이름 추천"으로 포괄적 표현 사용
- `Categories.tsx`의 `key: "baby"`는 홈 4개 카드 분류용으로 유지 (URL 아님)
- `parent-based/page.tsx`의 `babySurname` 변수도 의미상 유지

#### 2. 컬러 팔레트 단순화 (네이비 제거)
- `globals.css` 토큰 값만 변경, 토큰명 `--color-navy*` 유지 (33개 파일 호환)
- `#1E3A5F` (navy) → `#2B2B2B` (charcoal)
- 베이지 + 그린 + 검정 3색 미니멀 팔레트 (+ 골드는 RARITY 한정)

#### 3. 새 페이지 2개
- **`/method`** — 작명 원리 (알고리즘 투명성)
  - 5 섹션: 분석의 세 축 / 점수 체계(미학 70%+조화 30%) / 전통 작명 원리 / 우리가 안 하는 것 / 자료 출처
- **`/guide`** — 작명 가이드 (사용자 교육)
  - 7 챕터: 네 축 / 시기 / 다섯 방법 / 사주 역할 / 돌림자 / 흔한 실수 / 회사·반려동물
  - 앵커 링크 목차 포함

#### 4. "전문가" 표현 정직하게 재포장
실제 전문가 네트워크 없음 → 시스템이 실제로 하는 일로 정확하게 표현
- 헤더 "전문가 상담" → "작명 원리"
- WhyKyeol "전문가 감수" + UserCheck → "원칙 기반" + Compass
- 푸터 "전문가 네트워크" → "추천 원리"
- SpecialtyPage "8종의 전문가 패턴" → "8종의 패턴"
- HanjaCandidateCard D-grade "전문가 확인 권장"은 외부 자문 안내라 정직 → 유지

#### 15. HarmonyEngine → SajuCalculationService 마이그레이션 + 발음오행/수리사격 추가

**백엔드 변경:**
- `HarmonyEngine.cs`: `ISajuCalculationService` 주입, `CalculateFiveElementScore` → 4기둥 오행 반영
- 새 점수 항목 추가:
  - **발음오행(음령오행)** `/25`: 초성 → 오행 매핑(ㄱ=木 등), 성씨+이름 오행 상생/상극 체인 평가
  - **수리사격(원형이정)** `/15`: 원격/형격/이격/정격 획수 길수(吉數) 판정
- 기존 배점 조정: 오행 40→30, 자원오행 30→20, 음양 20→10, 성조화 10→0(deprecated)
- `HanjaData.cs`: `data/hanja_strokes.json` (9,190자, Unicode kTotalStrokes, 95.8% 커버리지) 로드
- `hanja_strokes.json`: Unihan_IRGSources.txt에서 Python 스크립트로 생성
- DTO 갱신: `IHarmonyEngine`, `HarmonyBreakdown`, `HarmonyBreakdownDto`, `NameEvaluationResultDto`
- BirthTime 전달 체인: `RecommendationService`, `TwinNameService`, `NameAnalysisService`, `NameEvaluationService`, `RecommendationsController`

**프론트엔드 변경:**
- `frontend/src/lib/types.ts`: `HarmonyBreakdown`에 `pronunciationElement`, `suriSagyeok` 추가
- `frontend/src/components/results/HarmonyBreakdownCard.tsx`: bars 4개→5개 (오행30/발음오행25/자원오행20/수리사격15/음양10)

#### 5. BirthTime 풀체인 데이터 수집
**백엔드 8개 DTO에 `BirthTime?` 추가**:
- SmartRecommendationRequestDto, CreateRecommendationRequestDto
- DualNameRequestDto, ParentBasedRequestDto, RareSurnameRequestDto
- RequiredCharRequest, TwinNameRequestDto, NameEvaluateRequestDto

**프론트엔드 폼에 시간 input 추가** (모두 선택):
- Hero (홈), `/search`, `/parent-based`, `/rare-surname`, `/required-char`, `/twin`, `/dual-name`, EvaluateInput

`SmartRecommendationService`가 cascade 시 BirthTime 전달.

**⚠️ 데이터는 수집되지만 점수에 반영 안 됨**: `HarmonyEngine`이 여전히 `FortuneUtils.GetGanZhi`(연도만) 사용. **다음 작업 1순위 후보**.

#### 6. 백엔드 엔진 다양성 개선
"허강X" 같은 동일 첫 글자 도배 문제 해결.
- `NamePoolEngine.cs`: `GenerateTwoCharCombinations` / `GenerateThreeCharCombinations`에 `GroupBy(h => h.Reading).Select(g => g.First())` 적용
- `RareSurnameEngine.cs`: 동일 패턴 + 결과 단계 라운드-로빈 추출
- `SmartRecommendationService.AddCategory`: 같은 type 들어오면 dedup해서 머지 (three-syllable 키 중복 React 경고 원인 해결)

#### 7. Hero 리디자인
- 우측 wave SVG 7줄 제거 (사용자 요청)
- 종이 grain 텍스처도 제거 (가운데 정렬과 어울리지 않음)
- 콘텐츠 전체 가운데 정렬 (`margin: 0 auto` + `textAlign: center`)
- 폼 카드 가운데 두되 내부는 `textAlign: left` 유지 (입력 정렬)
- **타이핑 효과** 추가 — `useTypewriter` 훅, 2줄 분할:
  - "결이 고운 이름은 시간이 흐를수록"
  - "그 가치를 증명합니다."
- 65ms 간격, 250ms 시작 지연, 완료 후 커서 깜빡임

#### 8. 아이콘 lucide-react 통일
- Categories: `Baby` / `Pencil` / `Briefcase` / `PawPrint`
- WhyKyeol: `BarChart3` / `Compass` / `ShieldCheck`
- EvaluateInput InfoRow: `Music` / `Leaf` / `BookOpen` (icon prop을 `ReactNode`로 확장)

#### 9. Footer 정리
- 헤더 nav와 용어 통일: "작명 가이드" / "작명 원리"
- 죽은 링크 제거: "한자 사전", "발음 가이드", "추천 원리" 중복
- 모든 서비스 링크에 실제 라우트 연결 (`<Link>` 사용)
- "준비 중" 항목은 뱃지 표시 (소개·문의)
- 컬럼 4개 → 3개 (브랜드 + 서비스 + 둘러보기 + 회사)

#### 10. ProPaths 균형화
- 비대칭 `gridColumn` 강제 제거 (희귀성씨가 2칸 차지하던 문제)
- 6번째 카드 추가: **"필수 글자 포함"** (`/required-char`)
- 2×3 균등 그리드
- `ProPathKey` 타입에 `"required"` 추가, `PROPATH_ROUTES` 매핑

#### 11. Header/Footer 누락 6페이지 보강
`<Header current="search" /> + <Footer />` 추가:
`/search`, `/pure-korean`, `/creative`, `/three-syllable`, `/required-char`, `/parent-based`, `/rare-surname`

#### 12. 백엔드 실행 환경
- `Properties/launchSettings.json` 신설
- `dotnet run`만 쳐도 자동 `Development` 모드 + 포트 5000/5001 + Swagger 오픈

#### 13. 폐기 코드 청소
- `frontend/src/app/design-preview/` 디렉토리 (3개 라우트) 제거
- `DEVELOPMENT_STATUS.md` 제거 — outdated (.NET 8.0/2024년 기재)

#### 14. Hero 고급 옵션 안내
"고급 옵션" 펼침 시 teal 박스로 안내:
> ⓘ 값을 입력하면 해당 추천 카테고리가 자동으로 켜집니다. 더 세부 조정은 **이름 찾기** 페이지에서 가능해요.

---

## 빌드/검증 상태 (마지막 세션 종료 시점)

- 백엔드: 0 errors, 0 warnings (CS#### 코드 에러 없음)
- 프론트엔드: 15/15 라우트 정적 빌드 통과, `tsc --noEmit` 0 errors

---

## 다음 작업 후보 (우선순위 순)

### 🔥 1순위: 사용자 테스트 + 피드백 수집
- 핵심 기능(추천/평가/저장/PDF) 완성도 충분
- 실제 사용자가 어떤 흐름에서 막히는지, 어떤 결과가 만족스러운지 확인
- 친구·지인 5~10명에게 사용 요청 → 피드백 기반 다음 우선순위 결정

### 2순위: NicknameEngine 실제 구현
- 현재: 더미 (실제 로직 없음)
- 별명 패턴 아이디어는 MEMORY의 `project_nickname_ideas.md`에 있음
- 리포트 톤으로 (예: "지나 — 지+나, '지혜로운 나' 줄임")

### 3순위: `/method` 페이지에 "리포트 방식" 섹션 추가
- "AI는 이야기, 우리는 리포트" 포지셔닝을 사용자 교육 페이지에 명시
- 이미 정한 정체성을 사용자가 이해할 수 있도록

### 4순위: Coming Soon 카테고리 실현 (회사명/반려동물)
- Home Categories의 `company`/`pet` 카드 활성화
- 회사명: 상표 등록 가능성 체크 / 도메인 확보 / 한·영 동시 통용
- 반려동물: 2~3음절 / 받침 흐름 / 부르기 좋은 리듬

### 5순위: 엔진 단위 테스트 보강
- 현재: 710개 테스트 통과
- ScoringService 회귀 방지 테스트 추가 (smart vs evaluate 동등성)
- xUnit 패턴은 기존 `Tests/` 폴더 참고

### 기타
- EF Core ValueComparer 설정 (`Candidate.Reasons`, `Recommendation.BonusNicknames`)
- 배포 설정 결정 (Azure / Vercel / 온프레미스)
- 도메인 확보 + 이메일 (`podopado1@gmail.com` → `contact@도메인`, Cloudflare Email Routing)
- 트래픽 모이면 광고/후원 재검토

---

## 다음 세션 시작 가이드

세션 시작 시 다음을 확인하세요:
1. `D:\MyDev\NameForm\CLAUDE.md` — 프로젝트 전체 가이드 (영구 상태)
2. `D:\MyDev\NameForm\SESSION_HANDOFF.md` — 이 파일 (최근 세션 로그 + 다음 작업)
3. 사용자가 우선순위에 동의하면 1순위(HarmonyEngine 마이그레이션)부터 진행, 다른 요청 있으면 그것 우선

빌드 명령:
```bash
# 백엔드 (Dev 모드 자동)
dotnet run

# 프론트엔드
cd frontend
npm run dev    # 개발
npm run build  # 프로덕션 빌드
```

---

## 변경 이력

| 날짜 | 세션 요약 |
|---|---|
| 2026-05-14 | 라우트 `/baby→/search`, 컬러 navy→차콜, `/method`·`/guide` 신설, BirthTime 풀체인, "전문가" 표현 정직화, 엔진 다양성 개선, Hero 가운데 정렬+타이핑, 아이콘 lucide 통일, Footer 정리, ProPaths 균형화 |
| 2026-05-15 (오전) | HarmonyEngine→SajuCalculationService 마이그레이션, 발음오행(25점)/수리사격(15점) 추가, hanja_strokes.json 9,190자, 프론트 HarmonyBreakdownCard 5항목으로 갱신 |
| 2026-05-15 (오후) | ScoringService 단일 진실의 원천 도입, 채점 미스매치 7건 정리, ExplanationEngine 리포트 형식 전환, LLM 서비스 제거, NamingPrinciples 공통 추출, 5개 엔진 보강 (NamePool/Twin/Required/PureKorean/Creative), 채점 분포 정상화 (creative/three-syllable/pure-korean), 즐겨찾기(localStorage)+PDF(인쇄)+♥/공유 버튼, 한국어 조사 유틸 9곳 적용, 참고용 안내 박스, 로그인 제거 → 저장한 이름, 후원 보류 |
| 2026-05-18 | TwinNameService/NameAnalysisService도 ScoringService 경유로 통합, `/method`에 "리포트 방식" 섹션, 의미 선호 키워드 입력(#1), 항렬자 한자 직접 지정(#2), 부정 발음 패턴 데이터 v2.0(#3)+snake_case 파싱 버그 수정, NamingPrinciples 새 스킬 4종(#8: 어색결합/받침에코/외래어/음절균형), 용신 보완 가중치 강화(#5), 자원오행 ConfidenceGrade 반영(#6), 81수리 5단계 매핑(#7), 음운론 3종(#9: 동화/단조/두음), 사전 확장(#10: 순우리말 274→326/3음절 91→139), CreativeNamingEngine 성씨 검증(#11), 품질 회귀 테스트(#12), Saju/YongshinService 단위 테스트(#13), 다양성 회귀 +4, 사전 중복 정리, 영한 매핑 90→122, 복성 키워드 4→6, 3개 로더 ResetCache 통일, SEO 풀셋(robots.ts+sitemap.ts+페이지별 layout 12개+JSON-LD+OG/Twitter card). 테스트 +167개 (710→877), 정적 라우트 19→22 |
| 2026-06-13 | 운영 정비: keepalive 워크플로(Render cold start 회피), NameForm.slnx(루트 dotnet test 877개 정상화), public 무관 CSV 정리, CLAUDE.md 현행화 |
| 2026-05-20 | 🎊 **정식 출범** — namingkyeol.com 도메인 등록(Cloudflare $10.46/년, auto-renew ON, 만료 2027-05-19), Email Routing(contact@→podopado1@gmail.com), Supabase PostgreSQL(Seoul ap-northeast-2), Render 백엔드 배포(Dockerfile + $APP_UID), Vercel 프론트 배포(Hobby 무료), DNS 연결 + Let's Encrypt SSL 자동, TLS 1.3. 트러블슈팅 5건 해결(Python자동인식/UID충돌/IPv6timeout/EnsureCreated silent fail/UTC strict). 코드 변경: Dockerfile/.dockerignore 신규, csproj data publish 보장, Program.cs Npgsql legacy timestamp + DB 초기화 견고화, .gitignore secrets 패턴 강화, frontend/.git 제거(monorepo). contact 페이지 mailto를 도메인 이메일로 교체. 보안 점수 측정: **SecurityHeaders A**, **Mozilla Observatory B+ (80/100)**. 877개 테스트 유지. 월 운영비 ~₩1,200 (도메인만) |
