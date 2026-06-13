# 한자 사전 SEO 페이지 설계 (`/hanja`)

> 2026-06-13 작성. jsflower 투사이트 분석에서 도출한 "롱테일 키워드 흡수" 전략의 1순위 구현안.
> 목표: 보유 중인 한자 데이터 9,595자를 검색 유입용 정적 페이지로 전환하고, 방문자를 추천 도구(/search, /required-char)로 퍼널링.

---

## 1. 검색어 전략 — 무엇을 잡을 것인가

| 검색어 패턴 | 예시 | 담당 페이지 | 예상 페이지 수 |
|---|---|---|---|
| "{음} 한자", "이름에 쓰는 {음} 한자" | "윤 한자 이름", "서 이름 한자" | 독음 페이지 | **490** |
| "{한자} 뜻", "{뜻} {음} 한자" | "潤 뜻", "불을 윤 한자" | 글자 상세 페이지 | **~9,100** |
| "인명용 한자", "인명용 한자 검색" | 한자 사전 진입 | 인덱스 페이지 | 1 |

- **머니 페이지는 독음 페이지** (490개): 부모가 실제로 검색하는 건 "윤으로 시작하는 한자"류. 글자당 최다 133자(유), 평균 ~12자가 한 독음에 묶임.
- 글자 상세 페이지는 롱테일 + 독음 페이지의 콘텐츠 깊이를 받쳐주는 역할.
- jsflower의 퍼널 구조 적용: **정보 페이지(한자 사전) → 거래 페이지(이름 추천 도구)**.

## 2. URL 구조 — 단일 동적 세그먼트 `/hanja/[slug]`

```
/hanja                  인덱스 (자음 ㄱ~ㅎ 브라우즈 + 검색 안내)
/hanja/윤               독음 페이지 (한글 1음절 → 해당 독음의 한자 목록)
/hanja/潤               글자 상세 페이지 (CJK 문자 → 단일 한자 상세)
```

- `[slug]` 하나로 받고 **유니코드 스크립트로 분기**: 한글 음절(U+AC00–D7A3) → 독음 페이지, CJK(U+4E00–9FFF + 확장) → 글자 페이지. 그 외 → 404.
- URL에 한글/한자를 그대로 사용 (percent-encoding은 구글/네이버 모두 정상 처리). `/hanja/eum/윤` 같은 중간 세그먼트보다 URL이 짧고 키워드 밀도가 높음.
- 다음 독음/이체자 처리: `readings_hangul`이 복수인 글자(예: 㒚 → 은/온)는 **모든 독음 페이지에 등장**하되, 글자 상세는 canonical 1개.

## 3. 페이지 구성

### 3-1. 글자 상세 페이지 `/hanja/潤`

| 섹션 | 내용 | 데이터 소스 |
|---|---|---|
| H1 + 대형 한자 | `潤` (Noto Serif KR) + "불을 윤 · 윤택할 윤" | meaning_ko |
| 기본 정보 표 | 독음, 뜻, 획수, 오행, 음양(획수 홀짝), 인명용 여부(대법원) | strokes, element, sources |
| 오행 판정 근거 | rationale 텍스트 + **신뢰등급 뱃지 S/A/B/D** (기존 ConfidenceGrade 디자인 시스템 그대로 재사용) | core_v1 / radical_map / 획수 fallback |
| 같은 음 다른 한자 | "윤"으로 읽는 다른 글자 그리드 (내부링크) | readings 인덱스 |
| 어울리는 오행 | 상생 관계(水生木 등) 기반 "함께 쓰기 좋은 오행" + 해당 오행 대표 글자 4~6개 | element + 상생 규칙 |
| **CTA** | "潤 글자를 넣어 이름 추천받기" → `/required-char?char=潤` | — |
| 하단 내비 | ← 독음 '윤' 전체 보기 / 한자 사전 홈 | — |

### 3-2. 독음 페이지 `/hanja/윤`

| 섹션 | 내용 |
|---|---|
| H1 | "이름에 쓰는 '윤' 한자 27자 — 뜻·획수·오행 한눈에" |
| 인트로 문단 | 독음 특성 1~2문장 (초성/발음 부드러움 등 KoreanUtils 로직 기반 정적 생성 — 템플릿 문장 + 데이터 치환) |
| 한자 카드 목록 | 글자·뜻·획수·오행·신뢰뱃지. **정렬: 신뢰등급(S→D) → 획수.** D급은 하단 배치 (기존 frontend hanja badge 가이드와 동일 원칙) |
| **CTA** | "'윤'이 들어가는 이름 추천받기" → `/required-char?char=윤` |
| 인접 독음 링크 | 같은 초성의 다른 독음들 (ㅇ: 연·영·예·우…) |

### 3-3. 인덱스 `/hanja`

- 초성 ㄱ~ㅎ 탭 → 독음 칩 그리드 (490개를 14개 초성 그룹으로).
- 인기 독음(글자 수 상위: 유·기·정·구·이·경·수·영…) 상단 노출.
- 푸터/홈에 "인명용 한자 사전" 링크 추가 (사이트 전역에서 크롤 경로 확보).

## 4. 데이터 파이프라인

**원칙: 빌드 타임에 모두 해결. 런타임 백엔드 호출 없음** (Render free cold start 회피 + 완전 정적 = SEO 최적).

```
scripts/build_hanja_seo_data.py   (신규)
  입력: data/hanja_dictionary_final.json  (9,595자: 독음·뜻)
        data/hanja_strokes.json           (9,190자: 획수)
        data/hanja_core_v1.json           (2,060자: 검수 오행, S급)
        data/hanja_radical_element_map.json (1,847자: 자동 오행, C→B/D 매핑)
  병합 우선순위 (백엔드 HanjaData.cs와 동일):
        오행: core_v1(S) > radical_map(자동) > 획수 기반 fallback(D, FortuneUtils 규칙 포팅)
  출력: frontend/src/data/hanja-seo.json  (~2MB, 커밋)
        형태: { "潤": { r:["윤"], m:"불을 윤/윤택할 윤", s:15, e:"水", g:"S", why:"..." }, ... }
```

- 출력 JSON은 **서버 컴포넌트에서만 import** → 클라이언트 번들에 포함되지 않음.
- 데이터 갱신 시 스크립트 재실행 + 커밋 (한자 데이터는 사실상 불변이라 빈도 낮음).

## 5. 메타데이터 / 구조화 데이터 / 사이트맵

### generateMetadata
- 글자: `潤(불을 윤) — 뜻·획수·오행 | 이름의 결` / description에 뜻·획수·오행·인명용 여부 1문장.
- 독음: `이름에 쓰는 '윤' 한자 27자 — 뜻·획수·오행 비교 | 이름의 결`
- canonical 명시 (인코딩된 URL 기준), OG는 기존 기본 og-image 사용 (동적 OG는 후순위).

### JSON-LD
- 글자 페이지: `DefinedTerm` (+ `inDefinedTermSet`: 한자 사전) + `BreadcrumbList`.
- 독음 페이지: `ItemList` + `BreadcrumbList`.

### sitemap
- `frontend/src/app/sitemap.ts`의 ROUTES에 더해 hanja-seo.json에서 동적 생성.
- 독음 490개: priority 0.6 / 글자: priority 0.5.
- 1만 URL은 단일 사이트맵 한도(5만) 이내 — 분할 불필요. 단, 파일 크기 고려해 Next의 `generateSitemaps()`로 `sitemap/hanja.xml` 분리 권장.

## 6. 인덱싱 정책 — thin content 방지 (중요)

9,595페이지를 한 번에 색인 요청하면 구글이 '얇은 자동생성 페이지'로 판정할 위험이 있다.

- **페이지 생성 기준**: `meaning_ko` + 획수 보유 글자만 상세 페이지 생성 (≈9,100자). 둘 중 하나라도 없는 ~500자는 페이지 미생성, 독음 페이지 목록에서 글자+뜻만 표기.
- **빌드 전략 (2026-06-13 최종)**: **전량 빌드 타임 prerender** (독음 489 + 글자 9,096, `dynamicParams = false`).
  - 1차 시도였던 하이브리드(S급만 prerender + 나머지 온디맨드 ISR)는 **Vercel에서 온디맨드 생성 페이지만 500**을 반환해 폐기. 로컬 `next start`에서는 재현 안 되는 프레임워크/플랫폼 레벨 문제 (유사 보고: vercel/next.js#81155, #71757 — Next 15+ 온디맨드 생성이 Vercel에서만 깨지는 계열).
  - 산출물 ~2GB/9.6만 파일이지만 Vercel은 산출물 파일 수 하드 캡 없음 (https://vercel.com/docs/limits) — 업로드 시간만 증가.
- **단계적 공개**:
  - **1차 배포**: sitemap에 인덱스 + 독음 490 + S급 2,054만 등재. 나머지 글자 페이지는 내부링크로 자연 발견.
  - **2~4주 후** Search Console/서치어드바이저에서 색인율 확인 후 나머지를 sitemap에 추가 (sitemap.ts의 `getCuratedChars()` → `getAllDetailChars()` 교체).
- 배포 직후 **네이버 서치어드바이저 + 구글 서치콘솔에 사이트맵 재제출** (이번 기회에 서치어드바이저 미등록이면 등록).

## 7. 구현 단계

| 단계 | 작업 | 산출물 |
|---|---|---|
| 1 | 데이터 병합 스크립트 + 검증 (글자 수, 오행 커버리지 리포트) | `scripts/build_hanja_seo_data.py`, `frontend/src/data/hanja-seo.json` |
| 2 | `/hanja/[slug]` 라우트 (스크립트 분기, generateStaticParams, generateMetadata) | `frontend/src/app/hanja/[slug]/page.tsx` |
| 3 | `/hanja` 인덱스 + 카드/뱃지 컴포넌트 (기존 ConfidenceGrade 뱃지 재사용) | `frontend/src/app/hanja/page.tsx`, `components/hanja/*` |
| 4 | `/required-char`에 `?char=` 쿼리 프리필 지원 (CTA 연결) | 해당 페이지 소폭 수정 |
| 5 | sitemap 확장 + JSON-LD + robots 확인 | `sitemap.ts` 수정 |
| 6 | 빌드 검증 (페이지 수·빌드 시간·배포 크기), Vercel 배포, 서치콘솔/어드바이저 제출 | — |

### 구현 시 주의
- **frontend/AGENTS.md 준수**: Next.js 16은 학습 데이터와 다름 — 코드 작성 전 `node_modules/next/dist/docs/`에서 generateStaticParams/generateSitemaps/metadata 문서 확인 필수.
- 빌드 시간: 1만 페이지 SSG로 Vercel 빌드 수 분 증가 예상. 데이터 로드는 모듈 스코프 1회 import로 (페이지당 재파싱 금지).
- 한글/한자 URL은 percent-encoding 왕복 (`decodeURIComponent`) 누락 주의 — slug 비교 전 반드시 디코딩.

## 8. 이후 확장 (이번 범위 아님)

- `/name/[이름]` 이름 뜻 페이지 (독음 조합 × 인기 이름 — 2단계 프로그래매틱 SEO)
- `/surname/[성]` 성씨별 랜딩
- 동적 OG 이미지 (글자별 카드)
- 네이버 블로그 콘텐츠 연계 (투사이트 전략의 한국형 구현)
