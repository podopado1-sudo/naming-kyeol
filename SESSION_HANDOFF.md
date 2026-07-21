# NameForm 세션 인수인계

이 파일은 Claude 세션 간 연속성을 위한 작업 로그입니다.
**다음 세션 시작 시 `CLAUDE.md`와 함께 이 파일을 읽으면 현재 상태와 다음 작업 후보를 즉시 파악할 수 있습니다.**

---

## 마지막 세션 요약 (2026-07-21 — 📊 /name 미학 점수 섹션 + OG 공유 카드 3,305장)

이월 과제 "(d) /name 미학/발음 점수 섹션, 공유 OG 카드" 완결. 커밋 4개 push·배포.

### 커밋
| 커밋 | 내용 |
|------|------|
| `9f3aa40` | **dump-name-scores CLI** — AestheticEngine breakdown 덤프(성씨 제외·tone=neutral·60/40 성별). 내부 노트 "male와"→"남자 이름과" 공개 치환 |
| `9f30ddc` | **name-seo에 sc 병합** — 3,305개 100%, 1.10→1.51MB. `NameScoreBreakdown`+`toAestheticBreakdown` (toneBonus 항상 0 복원) |
| `321d3cd` | **점수 섹션 UI** — 통계↔한자조합 사이, orphan이던 `ScoreBreakdownCard` 재활용. 감점·노트 전부 노출(사용자 확정) + 유행 배제 철학 문구 프레이밍 + /evaluate 퍼널 |
| `17f3e3e` | **OG 카드 3,305장 정적 생성** — `build_og_font.py`(woff2→wght700 인스턴스→서브셋→base64 TS 614KB, OFL RFN 준수 KyeolOG) + `opengraph-image.tsx`(satori). 프리렌더 12,914→16,219 유닛, 19.3s→27.2s로 빌드 부담 무시 가능 |

> 후속(같은 날, 별도 세션): `e5c231d` chore — .gitignore에 전역 `__pycache__/` 규칙 추가 (scripts/ 파이썬 감사 스크립트 실행 시 생기던 untracked 노이즈 제거)

### 핵심 교훈
- **Next 16.2: 세그먼트의 generateStaticParams가 메타데이터 라우트(opengraph-image)에 상속 안 됨** —
  없으면 ƒ(온디맨드)로 강등. 파일에 직접 export해야 ● 정적 생성 (이 프로젝트는 온디맨드 ISR 500 전력상 전량 프리렌더 원칙).
- satori 폰트는 TTF/OTF/WOFF만(woff2 불가) — 저장소의 PretendardVariable.woff2를 fonttools
  `instancer`(wght=700 고정)+`subset`으로 오프라인 변환 가능. node:fs 대신 base64 TS import(번들 자립).
- Python `euc_kr` 코덱은 UHC 확장까지 인코딩(11,172자 전부 통과) — KS X 1001 2,350자는
  2바이트 리드 0xB0~0xC8 필터 필요.
- Pretendard는 OFL **Reserved Font Name** — 서브셋(Modified Version)은 name 테이블 개명 필수(KyeolOG).
- **PowerShell에서 `[slug]` 경로는 와일드카드로 해석** — `Move-Item`/`Test-Path`는 `-LiteralPath`,
  git 스테이징은 `':(literal)...'` pathspec. 커밋 메시지에 큰따옴표 포함 시 `-m` 인자 깨짐 → `-F 파일`로.
- 로컬 prod 빌드는 Turbopack 28워커로 0.9분(16,219유닛) — 빌드 실측 실험 비용이 낮으니 추측 대신 실측.
- OG 라벨 문구 수정 시 `scripts/build_og_font.py`의 `OG_LABELS` 동기화(한글은 KS X 1001 마진으로 흡수).

### 다음 작업 후보
1. **배포 확인**: Vercel 배포 완료 후 카카오 공유 디버거(캐시 퍼지)·Facebook Sharing Debugger로
   `/name/서연` 카드 확인 (전량 프리렌더 배포 ~20-30분 소요 유의)
2. /hanja·/name 색인 추이 재확인 — sitemap 전체 공개(7/15) 2~3주 뒤 = **8월 초**.
   D급 '크롤링됨-미색인' 대량 누적 여부 + /name 색인 진입 여부
3. weak 추가 시 정기 절차화(이월) — 점유 감사 + 두더지 diff 검수 루틴

---

## 이전 세션 요약 (2026-07-02 — 🈶 표시·조합 품질 대수술: 대표 훈 95자 + Weak 621자 + 점수 아티팩트 3건 수정)

핸드오프 후보 2·3(대표 훈 / Weak 확장)을 결합 진행하다 연쇄 발견으로 확장된 긴 세션.
모두 push·배포·라이브 검증 완료. 총 **이름 1,500여 개의 한자 조합 개선**, combos 소실 0, comboMeans 100%(12,459쌍).

### 커밋 (시간순)
| 커밋 | 내용 |
|------|------|
| `d0f10bf` | **호환자 차단 회귀 수정** — 지난 세션 호환자 8종 리터럴이 편집 중 NFC 정규화로 일반자 중복이 되어 사전의 CJK 호환 엔트리(U+F918 落 등 8자)가 실제 미차단. `IsForbiddenNameHanja`를 NFKC 정규형 2차 조회로(향후 호환 변형 자동 차단). 회귀 테스트는 정수 코드포인트로 작성(리터럴은 같은 함정) |
| `d422481` | **대표 훈 오버라이드 95자** — `data/hanja-gloss-overrides.json` 신설, 로드 시 재배열(원 훈 보존·멱등). 然 불탈→그럴 연, 朴→성씨 박, 蔚→우거질 울 등(대부분 표기 독음≠첫 훈 음 오류). 소비처 5곳(`Split[0]`) 무수정 전파, build_hanja_seo_data.py 동일 적용. 모순 combo 뜻 42건만 윤문. 鰥(홀아비)은 불용으로 |
| `26a4047` | **Weak 15→366자** — 세트 HanjaData 이관+심, 전수 스캔(9,096자 훈×약한 훈 사전 9카테고리) 검수 345자 + 두더지 보충 7자 + 孼 불용. ExplanationEngine 폴백·NamePoolEngine 소비처 보강. 240쌍 인라인 윤문 |
| `cde9f71` | **商·貨·暈 추가** — 商 후속 검토 중 음절 점유 아티팩트 발견: 貨가 화 음절(라이브 평화=平貨!), 暈이 훈/운 55쌍(태훈=太暈). 108개 이름 개선(평화→平和, 축복 계열은 다음 커밋), 131쌍 윤문 |
| `dcf3d9d` | **음절 점유 전수 점검 + Core_v1 지배 버그** — `audit_syllable_occupancy.py` 신설, 노출 727자 triage → weak 252자(4라운드 수렴). 소망=素忘→素望, 축복=逐福→祝福, 혁 181쌍 革→爀 등 1,400+개 개선. **근본 원인: Core_v1 가점 +2000이 weak -1000을 압도**(코어셋은 오행 검수 커버리지라 약자 포함 — 신뢰도 점수가 품질 경쟁을 이기면 안 됨) → ComboBaseScore·BestGloss **-1000→-3000**. Batch API 2회(3,045쌍, ~$0.8) + 아스트랄 4쌍 인라인 |
| `12ef96d` | **NamePoolEngine -30→-3000** — 발음별 대표(채점 메타데이터 기준)가 실제 배정 한자와 정합하도록. 영향 발음 10개. HanjaSelector 쪽은 '빈출셋 유일-약자 붕괴' 0건이라 -30 유지로 충분 |

(+`7241c26`·`c6a36a4` docs/재트리거 — Weak 세트 최종 규모: 기존 14 + 이번 총 607 = **621자**)

### 핵심 교훈 (다음 세션 필독)
- **점수 아티팩트 3층 구조**를 이번에 전부 수정: ①호환 코드포인트 우회(NFKC로 종결)
  ②Core_v1 가점(+2000)이 감점을 압도(조합/글로스/풀 3경로 모두 -3000으로 통일)
  ③빈출셋 풀 게이팅(유일-약자 붕괴 — 현재 0건, weak 추가 시 재확인 필요).
- **weak 두더지 패턴은 반복 수렴이 정석**: 약자를 밀면 얇은 풀에서 더 나쁜 글자가 승격
  (糵→孼→臬 / 賽→鰓 / 未→微). 재생성 diff에서 '새로 승격된 글자'만 뽑아 검수 → 2~4라운드면 수렴.
  잔여 극박 음절의 어색자(啣·賦 등 4위 슬롯)는 soft-yield 설계 범위로 종결.
- **대표 훈 정정은 weak 후보를 드러낸다**: 商(헤아릴→장사)처럼 정정 후 훈이 사물/상업이 되면
  동음 대안(尙常相祥 등) 확인 후 감점 검토가 정석.
- **경계 보류(재스캔 시 재제안 금지)**: hold 24자(冶豆貝伊汝掖柄砥礎礪禾穀膽芯萊蓬藻袖襟軸錐頤駕鯉
  — 도야·낭중지추·등용문·흉금 등 긍정 연상) + 器(대기만성)·茶(차향)·軾(소식)·微·屢·云·化·火.
- **아스트랄 한자 함정 재현**: dump-combo-glosses의 `key.Length != 2`가 U+2xxxx 쌍(𠃗𩇣𧗿)을
  건너뛰어 배치 윤문에서 누락 — 커버리지 검사는 반드시 Python(코드포인트 단위)으로.
- 오버라이드는 재배열이지 삭제가 아님(원 훈 보존) / Batch API 키는 setx 사용자 환경변수 경유
  (셸 상속 안 되므로 레지스트리에서 읽어 주입) / Vercel 전량 프리렌더 배포 ~20-30분, GitHub
  deployment 기록은 완료 시점 생성(미트리거 오판 금지).
- 신설 도구: `scripts/scan_weak_name_candidates.py`(훈 스캔) · `scripts/audit_syllable_occupancy.py`(점유 감사) — 재실행 가능.

### 다음 작업 후보
1. (d) /name 미학/발음 점수 섹션, 공유 OG 카드 (후순위, 이월)
2. ~~/hanja 색인 추이 + 단계적 공개 2단계~~ ✅ 완료(2026-07-15) — 서치콘솔 색인 1,790/2,557(70%),
   발견됨-미색인 0, 크롤링됨-미색인 115(4.5%)로 기준 충족 → sitemap 전체 공개(`c598966`,
   10,603 URL 라이브 확인). **2~3주 뒤 색인 추이 재확인** — D급 페이지가 '크롤링됨-미색인'에
   대량 누적되면 대응. /name은 색인 0(등재 2주차) — 다음 확인 때 함께 볼 것
3. weak 추가 시 정기 절차화 — 점유 감사 스크립트 재실행 + 두더지 diff 검수를 루틴으로
   (신규 weak가 생기면 '빈출셋 유일-약자 붕괴' 0건 여부도 함께 확인)

---

## 이전 세션 요약 (2026-07-02 — 🈲 불용한자 전수 스캔 일괄 확정: 두더지잡기 종결)

`hanja_dictionary_final.json` 9,595자(뜻 보유 9,096자)의 훈을 부정어 사전으로 전수 스캔(후보 1,220자)
→ 전량 수동 검수 → **불용한자 118 → 856자**(신규 723 + 2차 7 + 호환자 변형 8). 조합 재생성 + 285쌍 인라인 윤문.

### 작업 내역
- **판정 기준 4개** (HanjaData.cs 주석에도 기록): ①다중 훈은 첫 훈 기준(부훈만 부정인 誕·創·郁·蔚·乾 등 배제)
  ②동음이의 훈 오탐 배제(옥=玉, 종=鐘, 때=時, 빌=祈禱, 마를=裁斷, 가릴=選擇, 갚을=報答, 죽=竹筍/粥, 창=窓, 이=齒/是, 미칠=及)
  ③통용 의미가 긍정인 글자 배제(竣=준공, 濬=깊을, 責←예외: 채 독음 오선택으로 결국 불용) ④불길한자 미신 무관 — 명백 부정만
- **2차 7종**: 재생성 조합 검수에서 발견된 責(꾸짖을 책)·魯(노둔할 로)·膃(살질 올)·膝(무릎 슬) +
  라이브 노출 보류분 隱(숨을 은)·逸(달아날 일)·畢(마칠 필) — 사용자 확정. 2회 반복으로 수렴.
- **호환자 변형 8종**: 기존/신규 불용자의 CJK 호환 코드포인트(落塚猪神禍剆苦菌, U+F900·U+2F800 영역)가
  사전에 별도 엔트리로 존재 — 우회 경로였음. NFKC 정규화로 검출해 일괄 차단.
- **CommonNameHanja 모순 정리**: 零·燐(도깨비불)·神(귀신)·隱(숨을) 4자를 빈출셋에서 제거(주석 대체).
- **재생성**: combos 소실 0, 변경 89+α개 이름(蝨→璱, 泥→馜, 債→彩, 擄→勞, 膃→兀, 逸→軼 등 전부 개선).
  신규 285쌍(283+아스트랄 2) 세션 내 인라인 윤문 → combo-meanings.json 12,783쌍, comboMeans 100%(12,499).
- 검증: dotnet test 946/946, prod 빌드 에러 0.

### 핵심 교훈 / 주의
- **의도적 보류 9종 (다시 스캔해도 추가하지 말 것)**: 猛(사나울 맹)·鳴(울 명)·空(빌 공)·渾(흐릴 혼)·
  蟬(매미 선)·鳶(솔개 연)·惜(아낄 석)·龐(어지러울 방)·唇(놀랄 진) — 통용 의미가 긍정·중립(용맹·봉명·창공·웅혼 등). 사용자 확정.
- **독음 全소실 4종**: 틈(闖)·픽(腷)·혐(嫌)·히(屎) — 실명에 없는 음절이라 무해 판정.
- **아스트랄 한자쌍 함정**: `dump-combo-glosses`의 `key.Length != 2`(UTF-16 단위)가 𩇣燦 같은
  U+2xxxx 쌍을 조용히 건너뜀 — 뜻 커버리지 검사는 Python(코드포인트 단위)으로 할 것.
- 코어셋(hanja_core_v1)에 불용자 90자 포함은 정상 — 코어셋은 '평가(분석)용 오행 검수' 커버리지,
  불용 필터는 생성 경로(NamePool/HanjaSelector/Creative/Explanation)에만 적용.
- 스캔 부정어 사전·검증 스크립트는 이 세션 대화(scratchpad `scan_forbidden_candidates.py`·`finalize_forbidden.py`) 참조.

### 후속: evaluate 경로 선택 한자 배선 완료 (같은 세션, 2026-06-25 잔여 해소)
- `GenerateDetailedReasonsAsync`에 `selectedHanja` 옵션 인자 추가 → `MeaningNote`가
  점수(Harmony)가 배정한 한자로 표시 (추천 카드=평가 페이지 일관).
- 출생일 미제공 시(조화 미산정, `SelectedHanja` 빈 리스트) `HanjaSelector.Select(name, gender, null,null,null)`로
  동일 선택기 경유 — /name 조합·추천 폴백과 표시 일관.
- 실측: 서연+생일 → 書然(용신 반영) / 서연 생일 없음 → 書蓮. 회귀 테스트 1건 추가(947/947).
- 관찰(미조치): 然이 "불탈 연"으로 표시됨 — 사전 첫 훈이 원뜻(燃)이라 카드 인상이 약함.
  다중 훈 대표 훈 선정(통용 훈 우선) 검토 여지.

### 다음 작업 후보
1. (d) /name 미학/발음 점수 섹션, 공유 OG 카드 (후순위, 이전 세션 이월)
2. WeakGivenNameHanja 확장 검토 — 부정은 아니지만 이름에 약한 글자(菜 나물, 枷 도리깨 등)는
   불용 대신 감점이 정합. 이번에 발견만 하고 손대지 않음.
3. 다중 훈 대표 훈 선정 검토 — 然(불탈→그럴), 書 vs 瑞 등 표시 훈 품질 (위 관찰 항목)

---

## 이전 세션 요약 (2026-06-30~07-01 — 🔍 /name SEO 완결: sitemap·인덱스·조합 뜻 100%)

`/name/[이름]` SEO 후속 (a)(b)(c)를 전부 완결. 커밋 8개 push·배포 완료.

### 커밋
| 커밋 | 내용 |
|------|------|
| `698b2d3` | **(a) sitemap 등록** — `getCuratedNames(1000)` 인기 상위 1,000개 등재(priority 0.6). 서치콘솔 재제출 불필요(URL 동일, 자동 재수집) |
| `13b01ba` | **(b) /name 인덱스** — 초성 ㄱ~ㅎ 탐색(인기 1,000개, /hanja 패턴 재사용) + Footer "이름 뜻 사전" 링크 + sitemap |
| `f5de018` | **(c) 조합 뜻 파이프라인** — `dump-combo-glosses` CLI + `build_combo_meanings.py`(Batch) + comboMeans 병합 + ComboCard 렌더. **윤문 단위=한자쌍**(이름 무관·유일 12.5k) |
| `ef83caf` | 카드 "…뜻" 접미어 제거(캡션형) + 프롬프트 완화 |
| `ce741d1` | 상위 300 이름 조합 1,219쌍 — **세션 내 인라인 윤문**(배치 대신, 무비용) |
| `bc3bc51` | **불용한자 1차 8종**(恚曀狡狹暗侮恥嗚) — 희귀 발음의 얇은 후보에서 나쁜 글자 섞임(사용자 발견 "曀麟?") |
| `28895d6` | 배치 결과 병합 12,138쌍(96%) — 비한국어 4·장황 4 수동 정리 |
| `8ca62f4` | 잔여 503쌍 인라인 윤문(배치 크레딧 소진) + **불용 2차 7종**(誤矛菌塞淚妄罔 — 妄·罔은 '희망'의 망에 望 대신 뽑히던 오선택) → **100%(12,498쌍)** |
| `a5f2da7` | **검수** — 불용 3차 5종(鬱老零祭害) + 대체 128쌍 윤문 + 어색 2건 개선. prod 빌드 12,914p 에러 0 |

### 핵심 교훈
- **윤문 단위=한자쌍이 정답**: 이름 단위 mean보다 입력(확정 두 한자 뜻)이 정확해 품질↑, 유일해서 1회 생성→영구 재사용(런타임 LLM 0).
- **배치 오류는 나쁜 한자의 신호**: LLM이 순화 못 하고 거절한 조합들 = 이름 부적합 글자. 불용한자 누적 20종 추가.
- **재생성 순서**: `dump-name-combos` → `build_name_seo_data.py` → `dump-combo-glosses` (글로스가 name-seo.json을 읽음 — 중간 누락 시 stale).
- 소량(수백 쌍)은 배치보다 **세션 내 인라인 윤문**이 빠르고 무비용. 대량(1만+)만 Batch API.
- 2음절인데 combos 없는 89개(여울·테오·노엘 등)는 순우리말/외래명 — 정상(섹션 자동 숨김).

### 다음 작업 (사용자 확정)
1. ⭐ **한자 사전 전체(9,595자) 훈 일괄 스캔 → 불용 후보 일괄 정리** — 지금까지 불용 3차(20종)가
   전부 "대체 조합에서 또 나쁜 글자 발견" 두더지잡기였음. `hanja_dictionary_final.json`(또는
   `frontend/src/data/hanja-seo.json`의 `m` 필드)의 훈을 부정어 사전으로 전수 스캔 → 후보 목록 뽑고
   사용자와 검토 → `ForbiddenNameHanjaSet` 일괄 확정. 주의: ①다중 훈("그물 망/없을 망")은 첫 훈 기준
   ②동음 대체 글자 존재 확인(희귀 독음은 배제 시 combos 소실 — 여울류처럼 소실이 정직한 경우도 있음)
   ③불길한자 미신(明仁德 등)과 혼동 금지 — 명백히 부정적 뜻만 ④변경 후 재생성 순서 준수 + 대체 조합
   윤문 필요(combo-meanings 커버리지 100% 유지). 검수 스캔 코드는 이 세션 대화에 있음(부정어 리스트 재사용).
2. (d) /name 미학/발음 점수 섹션, 공유 OG 카드 (후순위)
3. evaluate 경로(`GenerateDetailedReasonsAsync`) 선택 한자 배선 (2026-06-25 세션 잔여)

---

## 이전 세션 요약 (2026-06-25 — 🈶 한자 이름 엔진 재작명: 한자를 실제 선택·저장·표시)

사용자 지적 "기존 한자 이름 로직이 구리다"가 정확했음. 조사 결과 **표준 한자 이름은
발음 작명 + 한자는 장식**이었음 — NamePool/Harmony/Explanation이 각자 따로
`FindByReading`로 한자를 재조회 → 점수에 쓴 한자 ≠ 표시 한자, `雨(비 우)` 같은 비이름
글자 노출. 한자 배정을 **단일 진실의 원천**으로 정리 + 카드에 노출.

### 철학 결정 (중요)
- 랭킹은 **미학 우선 7:3 불변** (사주가 *이름*을 정하지 않음 — 브랜드 정체성).
- 단 **"정해진 발음 이름에 어떤 한자냐"(한자 배정 층)는 용신을 강하게** 반영 — "사주가
  이름은 안 정하지만, 정해진 이름의 한자는 사주에 맞춘다". 레드오션(사주 작명) 회피.

### 커밋
| 커밋 | 내용 |
|------|------|
| `f21f13b` | **Stage 1+2** — 신규 `HanjaSelector`(Utils): 음절별 한자 1회 선택(불용 배제·인명 빈출 우선·용신/희신 오행 강가산·기신 회피·성별 준-필터, 결정적). HarmonyEngine이 용신 계산→선택→그 한자로 자원오행 채점→`breakdown.SelectedHanja` 노출(SelectHanjaForName 제거). ExplanationEngine은 그 한자로 표시(BuildMeaningEvidence preselected). 2-a 정제(다중훈음·인명빈출)는 폴백에 적용. |
| `9fc7673` | **Stage 3+A2** — Candidate/CandidateDto/SmartNameCandidateDto에 `Hanja`("友晶")+`MeaningText`("벗 우 · 맑을 정"). 카드 빈 뜻 해소. 프론트 `mapCandidate`가 실제 한자를 `hanjaName`(serif)에 우선 → 창의 탭(한자 없음)과 시각 구별. |

### 핵심 교훈
- **`Candidate`는 관계형 테이블**(DbSet). 새 필드는 운영 PG INSERT를 깨뜨림(과거 `BonusNicknames`로 standard 탭 통째 증발). → 표시 파생 필드는 **`[NotMapped]`**로 컬럼 미생성, fresh 응답에서만 사용.
- **용신은 차트가 확정 용신을 낼 때 한자를 정함**(`우+水→雨`, `우+土→宇` 결정적 테스트로 증명). 같은 이름이 사주별로 다른 한자가 되는 걸 직접 보긴 어려움 — 랭킹이 통째로 바뀌어 같은 이름이 잘 안 겹침(사주 영향은 큼).
- `HanjaInfo`·`GenderPreference`는 `HanjaData`에 **중첩** → `using static …HanjaData;` 필요.

### 검증
- 백엔드 **944 통과**(+HanjaSelector 3 +성별 조향 갱신). 프론트 tsc·lint 클린.
- 실측: `雨(비 우)→友(벗 우)`, `環(고리)→煥(불꽃 환)`. 표시=점수 한자 일관. 카드 `友晶 · 벗 우 · 맑을 정`.

### 다음 작업 후보
1. **카드 뜻 스타일** — 현재 훈음형("벗 우 · 맑을 정"). 창의급 시적 윤문을 원하면 **한자쌍 단위 LLM 배치**(후속, 키 필요). 한자 이름=사실적 뜻 / 창의=감성 카피로 갈라도 자연스러움.
2. **evaluate 경로**(`GenerateDetailedReasonsAsync`)도 선택 한자로 표시하도록 배선(현재 GenerateReasonsAsync만 배선됨 — 추천 탭은 일관, 평가 페이지는 폴백).
3. 용신 활성도 모니터링 — 차트가 용신을 못 낼 때의 폴백 빈도 점검.

---

## 이전 세션 요약 (2026-06-24 — 🎨 창의 뜻 풀이: 2-a 정제 + 2-b LLM 윤문 파이프라인)

창의 후속 #2(뜻 폴리시)를 2단계로 완결. **2-a**(LLM 불필요 정제) → **2-b**(Claude Batch API 윤문 → 정적 JSON). 실제 API로 6성씨 전수 확인.

### 2-b LLM 윤문 (배치 → 정적 JSON, 런타임 비용 0)
2-a의 기계적 글로스("비 우 + 착할 선")를 Claude로 자연어화("맑고 선한 마음을 지닌"). **핵심 설계: 뜻은 이름 단위(성씨 무관)·유한(2,480개)이라 1회 배치로 만들어 파일로 박으면 런타임 LLM 호출 0.**

| 커밋 | 내용 |
|------|------|
| `a1967ae` | **2-b 파이프라인** — `CreativeMeaningData` 로더(파일 없으면 글로스 폴백, 무회귀) + `CreativeNamingEngine.BuildMechanicalMeaning` 공개 + `FillRealNameMeanings` 폴리시 우선 재배선 + `dotnet run -- dump-creative-glosses` CLI + `scripts/build_creative_meanings.py`(Batch API, `--sync`/`--limit`/`--resume`). 테스트 +3(941). |
| `69fbf98` | **윤문 데이터 2,480개** — `data/creative-name-meanings.json`. Sonnet 4.6 배치(성공 2,480/오류 0, ~$0.66). 비한국어 누출 3건 수동 정리. |

- **비용 결론**: 요청마다 LLM ❌. 1회 배치(Sonnet ~$0.66 / Haiku ~$0.22, 50% 할인) → 정적 파일 → 런타임 0원. 풀 거의 불변이라 사실상 단발성(대법원 데이터 갱신 시 재실행).
- **파이프라인 재실행**: ① `dotnet run -- dump-creative-glosses creative-glosses.json` ② `set ANTHROPIC_API_KEY` ③ `python scripts/build_creative_meanings.py --input creative-glosses.json` (소량 시험은 `--sync --limit 30`).
- **품질**: 김우선 "맑고 선한 마음을 지닌", 정유슬 "부드럽고 은은한 선율 같은", 강우담 "맑고 고요하게 깊어지는" — 빈출 셋 안 오선택(雨·羅)도 LLM이 흡수.
- ⚠️ **보안 사고**: 배치 중 사용자가 에러 로그를 붙이며 API 키가 채팅에 노출됨 → 즉시 revoke 안내. **키는 채팅에 붙이지 말 것**(transcript 영구 저장). 다음엔 파일/환경변수 경유 권장.

### 2-a 정제 (LLM 불필요)

직전에 남긴 #2의 **LLM 불필요 부분**을 먼저 처리.

### 현황 점검에서 확인된 문제 → 수정
실제 호출(김/이/박/정/강/윤)로 핸드오프가 지적한 문제 재현:
- **뜻이 기계적+지저분**: 음절→대표 한자의 `Meaning`을 그대로 이어붙여, 다중 훈음이 통째 덤프됨 (`강우담 → "비 우 + 괼 담, 잠길 침, 맑을 잠, 담글 점, 장마 음"`, `김원주 → "...임금 주/주인 주/심지 주"`). 이름 부적합 한자도 선택됨(`塞`=변방 새, `羅`=그물 라).
- **표시 점수 전부 100**: 정렬은 잘 되나(이름 다양성 양호) 표시 점수가 상위권 전부 100 → 변별 0 + 가짜처럼 보임.

### 커밋
| 커밋 | 내용 |
|------|------|
| `a841cbe` | **창의 2-a** — (1) `CleanGloss`로 다중 훈음 첫 글자만(`괼 담, 잠길 침...` → `괼 담`). (2) `Best()`가 `HanjaData.IsCommonNameHanja`(공개 접근자 신설) 우선 선택 → 塞·羅 등 비이름 글자 회피. (3) **표시 점수 디커플링** — jitter 정렬용 raw 점수와 분리한 `CalculateDisplayScore`(품질+희소성)로 84~91 정상 분포. 회귀 테스트 2종(+2, 938). |

### 핵심 교훈
- **창의 점수의 실제 변별폭은 약 3점**뿐 — 선별된 이름이 다 "좋고 희귀한 실명"이라 품질·희소성 어느 축으로도 거의 동일. 억지 spread는 가짜. 절대 대역을 다른 엔진(80대~低90대)에 맞춰 **천장 클램프에 무리가 눌리는 것만 풀어** 작지만 실제인 변동을 드러냄(min-max 정규화·랭크 spread 같은 인위 분산 회피).
- `Best()`의 한계: 雨·羅도 `CommonNameHanja`엔 들어 있어 빈출 셋 *안에서의* 미묘한 오선택(`우→雨 비`, `라→羅 그물`)은 못 거름 → 2-b/LLM 영역.

### 다음 작업 후보 (창의 후속)
1. ~~**#2-b LLM 뜻 윤문**~~ ✅ 완료(위). 정적 JSON 2,480개 운영 반영.
2. **#3 의미 코이닝** — 2-b 위에서. 단순 한자 뜻 조합을 넘어 이름에 서사/컨셉 부여.
3. 외자/시드/밴드 파라미터 미세조정(사용자 피드백 후).
4. **윤문 데이터 유지보수** — 대법원 데이터 갱신·풀 밴드 변경 시 파이프라인 재실행(위 절차). 신규 이름은 자동으로 기계적 글로스 폴백(무중단).

---

## 이전 세션 요약 (2026-06-24 — 🧹 닉네임 제거 + 🎨 창의 엔진 대수술(실명 기반) + 📜 작명규칙)

긴 세션. 커밋 8개 전부 push 완료(운영 자동 배포). 스모크 테스트 9/9 엔드포인트 200 확인.

### 커밋 (시간순)
| 커밋 | 내용 |
|------|------|
| `b430b93` | **음운 로더 3종 동시로딩 레이스 수정** — LoadData가 빈 데이터를 먼저 publish해 동시 리더가 빈 매핑 관측(NormalizeFinal 간헐 실패). volatile + 완전 빌드 후 1회 할당. 회귀 테스트 3종(+3) |
| `800cd46` | **NicknameEngine 전면 제거** — 규칙기반 별명은 품질 한계('준이'와 '수이' 동시 생성)+브랜드 부적합+dead code. 엔진/엔드포인트/DTO/`Recommendation.BonusNicknames`(도메인·EF·DTO) 전부 제거 |
| `8d01c64` | **standard 탭 누락 회귀 수정** — ↑ 닉네임 제거가 부른 부작용. 기존 DB에 `BonusNicknames NOT NULL` 컬럼이 남아 INSERT 실패→레거시 RecommendationService 예외→SmartService가 catch로 standard 통째 누락. (InMemory 테스트라 못 잡고 verify로 잡음). startup 멱등 DROP COLUMN shim 추가(운영 PG도 자동 정리) |
| `4561272` | 유행 필터에 나윤·하윤 추가 + `audit_engine_quality.py` |
| `808d469` | **창의 1차** — 이름다움 게이트(2음절 단어형 넓은·솟을 제거) + 외자 화이트리스트(별·솔·윤…) + 희소성 점수 + 성씨 고유 우선 |
| `cc5c767`·`fd79d26` | **작명규칙 조사·정리** → `docs/naming-rules.md`. 핵심 규칙은 이미 구현됨(검증). **불용한자(부정 의미 死病罪 등) 배제 추가**(`HanjaData.ForbiddenNameHanjaSet`). **불길한자(明·仁·德을 흉으로 보는 미신)는 거부** — 작명계도 '사이비'로 부름, 좋은 글자 제거하면 엔진 망침 |
| `6d94ffa` | **창의 2차 — 실명 희귀꼬리 생성(아이디어 1)**. 고정 범용 풀(반복 원인) 제거하고 대법원 실명 빈도 100~2500 구간(검증된 좋음+개성)을 소스로. 성씨 시드 분산 + 첫음절 캡. **핵심 버그: 점수 100 클램프를 정렬 *전*에 해서 동질화 유발 → 표시 직전으로 이동**. 고유 32→69/120, 최다반복 10→4. NameGenderData 레이스도 수정 |

### 창의 엔진 핵심 교훈 (다음 세션 필독)
- **순수 알고리즘 생성 < 큐레이션 < 실명 데이터.** 음절 조합 생성(B-2)은 나혁·우슬급 어색+반복으로 실패(폐기). **실명 희귀꼬리**가 답이었음(검증된 좋음+다양성).
- **EvalSurnameFlow는 받침 유무로만 갈려(2버킷) 성씨 차별화 불가** → 시드 기반 결정적 회전으로 해결.
- 상세: [[project_naming_engine_quality]] 메모리.

### 다음 작업 후보 (창의 후속 — 아이디어 2·3)
1. **#2 LLM 뜻 폴리시** — 실명 이름의 뜻이 지금 음절→한자 자동 매핑이라 밋밋. Claude로 "라영 → 빛나고 영민한" 식 다듬기. (새 세션 권장)
2. **#3 의미 코이닝** — #2 위에서.
3. 외자/시드/밴드 파라미터 미세조정(사용자 피드백 후).

---

## 이전 세션 요약 (2026-06-18 — ✅ 세대 적합 활성화 → 문구 순화 → 방향성 → 칩 UI)

직전 세션이 최우선 미완으로 남긴 **세대 적합(Generation Fit)**을 활성화하고, 사용자 피드백을 받아 4단계로 완결. 커밋 4개 모두 push 완료(자동 배포).

### 커밋 (시간순)
| 커밋 | 내용 |
|------|------|
| `4d95093` | **활성화** — 평가 경로 1줄 배선 |
| `08dc6bb` | **문구 순화** — "개명한 인상" 제거 → 또래 중심 톤, 라벨 "불일치(강/약)" → "세대 감각" |
| `44833f1` | **방향성** — "또래보다 젊은 느낌 / 예스러운 느낌" (출생연도 vs 이름 유행기 비교) |
| `ecf54d7` | **칩 UI** — GenerationFit 구조화 노출 + 평가 결과 상단 전용 칩 |

### ① 활성화 (`4d95093`)
- **평가 경로 배선**: `NameEvaluationService`가 `ExplanationEngine.GenerateDetailedReasonsAsync`에 `score.Aesthetic.GenerationFit` 전달 ([NameEvaluationService.cs:32](Application/Services/NameEvaluationService.cs:32)).
- **추천 경로**: 이미 직전 세션 `66f2b97`에서 `ScoringService`가 `birthDate.Year`를 넘기고 있었음 → 이번엔 **평가 경로만 미배선이었던 것**. (직전 핸드오프 "ScoringService가 birthYear 안 넘김" 기록은 그 커밋 이전 기준이라 stale)

### ② 문구 순화 (`08dc6bb`) — 사용자 "개명한 인상이 너무 직관적"
- `GenerationNameData`의 모든 Description을 또래 중심 정보형 + `~요` 종결로 교체.
- `ExplanationEngine` 라벨 "세대 불일치(강/약)" → **"세대 감각"**, `AestheticEngine` notes도 "세대 감각 — {연대} 인기 이름"으로 통일.

### ③ 방향성 (`44833f1`) — 사용자 "더 손볼 여지 보강"
- 출생연도 < 이름 유행기 시작 → `nameIsNewer`(또래보다 **젊은** 느낌) / 반대 → **예스러운** 느낌.
- `BuildMismatchDescription` 헬퍼로 수동 DB·현대 하이브리드 양쪽 통일. 정도는 "조금"(약)/"한층"(강).
- 회귀 테스트 2건(젊은/예스러운) 추가.

### ④ 칩 UI (`ecf54d7`) — 사용자 "같이 설계해서 진행"
- **이유**: 세대 안내가 `cautions[]`(`.Take(2)`)에만 텍스트로 실려 다른 경고에 밀릴 수 있었음.
- 백엔드: `GenerationFitResult`에 `Direction`·`Headline` 추가, `NameEvaluationResultDto.GenerationFit`(DTO) 구조화 노출(unknown→null).
- 프론트: [page.tsx](frontend/src/app/evaluate/page.tsx)에 `GenerationChip` — fitLevel별 색(timeless=teal ✨ / mild=gold 🕐 / strong=amber 🕐). **perfect는 칩 제외**(신생아 대부분 perfect라 잡음 방지).
- 프론트 타입: [types.ts](frontend/src/lib/types.ts) `GenerationFit`.

### 검증
- 백엔드 테스트 **946 → 948 (+2)**, 빌드 경고 0(기존 xUnit1026 제외). 프론트 `tsc --noEmit`·`npm run lint` 클린.
- 로컬 `dotnet run` + 프리뷰(`ff-verify`)로 3케이스 실렌더 확인: 김지민/1985 "젊은 느낌" 칩, 김영희/2024 "예스러운 느낌" 칩, 김지민/2024 칩 없음(perfect). 추천 랭킹도 박/1985 vs 2024 연도별 정상 분기(품질 안 깨짐).

### 검증 환경 메모 (다음 세션 참고)
- 프리뷰는 **repo root `.claude/launch.json`**을 읽음(`frontend/.claude`가 아님). "frontend-prod"는 `npm run start`(프로덕션 빌드) → 소스 수정이 반영 안 되니, 최신 소스 확인은 `npm run dev` 설정 필요.
- 로컬 풀스택 프리뷰 시 3대 함정: ① `UseHttpsRedirection`(Program.cs:296)이 http:5000→https:5001 리다이렉트(헤드리스 브라우저는 self-signed 거부) → 백엔드를 `--no-launch-profile ASPNETCORE_URLS=http://localhost:5000`로 http 단독 기동하면 회피. ② 프론트 CSP `connect-src`는 `NEXT_PUBLIC_API_URL`에서 파생(미설정 시 `'self'`만 → fetch 차단). ③ dev CORS는 `localhost:3000`만 허용 → 프리뷰도 3000 사용.

---

## 이전 세션 요약 (2026-06-17 — 🐛 상세보기 버그 + 🧬 성별/세대 실명 데이터화)

실사용 피드백 기반 버그 수정 + 성별/세대 적합을 수동 큐레이션에서 **대법원 실명 빈도 데이터**로 전환. 모두 커밋·push 완료 (Render/Vercel 자동 배포).

### ✅ 세대 적합 "활성화" — 2026-06-18 완료 (위 최신 세션 참조)
- 직전 세션이 남긴 이 최우선 미완 작업은 **다음 세션(2026-06-18)에서 완료됨**. 평가 경로 1줄 배선 + API 검증.
- (당시 기록) 사용자 결정: **"평가+추천 모두 활성"**. → 둘 다 활성 완료.

### 이번 세션 커밋 (시간순)
| 커밋 | 내용 |
|------|------|
| `b08225f` | 디자인: amber-warm/gold-700 토큰 누락 복구(6개 컴포넌트 경고색) + 모바일 헤더 햄버거 |
| `e78e202`→`331fd52`→`ba2f490` | **상세보기 잔상 버그** 3단 수정. 최종: `/evaluate` 정적 라우트 + 클라이언트 라우터 캐시가 이전 `?name=` 재사용 → **모든 /evaluate 네비를 풀 페이지 이동(window.location/`<a>`)**으로 우회. (시그니처·key-remount는 컴포넌트 레벨이라 실패) |
| `ce7d070` | 추천 이유 보강: 불릿 표시(프론트가 빈배열로 고정했던 것) + 한자 뜻 항상 노출, ExplanationEngine 3→5개 |
| `56506ad`→`ecbed3d`→`e3b885d` | **성별 적합 실명 데이터화**: 수동 큐레이션 → 대법원 2008~2019 빈도(`data/name-gender-stats.json`, `NameGenderData`). 유주=98%여 등 데이터가 직관 교정(현주=여, 규민=남, 영주=혼용). 최종: **배제 아닌 "강등+라벨"** — 반대 성별로 기울수록 점진 감점(바닥 0.55), 소수 사용량 많으면 완화, 1위/TopPick 제외, 카드에 "주로 ○아 이름" 앰버 라벨 |
| `3e2e81d` | 추천 이름 감사 스크립트(`audit_recommended_names.py`). 결론: **금칙 필터 보강 불필요**(누수 0, 추천 전부 실명). 단어형(주인/시정)도 실제 등록 이름 |
| `e9886e6` | 세대 하이브리드: 수동 DB(옛 세대) + 실명 데이터(현대 유행) — 단 **위 "활성화" 전엔 dormant** |

### 데이터/스크립트
- `scripts/build_name_gender_data.py` → `data/name-gender-stats.json`(끝음절·첫음절·이름 전체 남/여 빈도). 원천 CSV는 `scripts/_name_raw/`(gitignore, randkid/name 대법원 재가공).
- 성별 데이터 오류 발견 시 `NamingPrinciples.ManualGenderLean`에 한 줄 추가(하이브리드 오버라이드).

### 알려진 이슈 (이번 발견)
- **`PhonologyJointLoader` 병렬 로딩 레이스** — 전체 테스트 병렬 실행 시 `NormalizeFinal`(7종성)이 간헐 실패(단독은 통과). 데이터 lazy-load가 race-safe하지 않음 → **운영 cold-start 동시요청에서도 잠재 위험**. 별도 수정 후보.
- 2008년 이전 연대별 이름 데이터는 어디에도 기계가독 형태로 없음(대법원 2008+, 서술형 요약뿐) → 세대 옛 구간은 수동 DB 유지가 최선. [[reference_namechart_crawl]]

### 폐기/비채택
- 단어형 이름 필터 보강 → 감사 결과 불필요로 종결.
- 세대 데이터 크롤링 → 2008년 이전 부재 + 3자 ToS로 ROI 낮음, 하이브리드가 최적.

---

## 이전 세션 요약 (2026-06-13 — 🧹 프론트엔드 lint 완전 정리)

**배경**: `frontend`에서 `npm run lint`가 사전 존재하던 에러 8건으로 실패 (한자 SEO 작업과 무관). 직전 세션이 "별도 작업 칩으로 분리"해 둔 이슈를 해소.

### 수정 (에러 8건)
- **about/method**: 따옴표를 `&ldquo;`/`&rdquo;`로 이스케이프 (`react/no-unescaped-entities`)
- **EvaluateInput**: `today` 계산을 `useState`+`useEffect` → **`useSyncExternalStore`** 전환 (`set-state-in-effect`). 서버 스냅샷 `undefined`·클라이언트만 계산으로 SSR/하이드레이션 동작 동일
- **SpecialtyPage**: `twin.births` 길이 동기화를 effect → `setTwin` 업데이터로 이동 (불일치 프레임 제거, 미사용 `useEffect` import 제거)
- **favorites**: `useFavorites`/`useIsFavorite`를 `useSyncExternalStore` 기반 재작성. 모듈 레벨 스냅샷 캐시로 참조 안정성 확보, `writeAll`+이벤트 양쪽에서 무효화

### 정리 (경고 9건, 추가 요청)
- search(`useMemo`·`Tabs`·미사용 `ResultSection`) / dual-name(미사용 `mode` 파라미터) / evaluate(더미 함수+`FormEvent`) / layout(무효 `eslint-disable` 주석) 제거 — 모두 dead code

### 결과
- `npm run lint` **에러 0·경고 0** 완전 통과, `npm run build` 통과 (정적 2,563 페이지)
- 커밋 `18eee18` — 내 9개 파일만 명시 스테이징 (다른 세션 작업 파일 보존). **push 보류** (Vercel 배포 트리거 회피 + 워킹 트리에 병렬 세션 미커밋 변경 존재)
- AGENTS.md 지침대로 Next.js 16 번들 docs(`node_modules/next/dist/docs/`) 확인 후 작업

---

## 직전 세션 (2026-06-13 — 🔍 한자 사전 SEO 페이지 출시)

**배경**: 사용자가 jsflower.co.kr/jsflower.kr "투사이트 SEO 전략"(별도 광고 없이 검색 상위 노출) 분석 요청 → 이름결 적용.

**jsflower 분석 결론**: 같은 회사가 역할 다른 두 사이트 운영(.co.kr 그누보드 쇼핑몰=거래 / .kr 워드프레스=정보). 효과 핵심은 ① 검색결과 2칸 점유 ② 정보성 검색어를 정보 사이트가 흡수해 거래 사이트로 퍼널 ③ 비정상적으로 깊은 카테고리로 롱테일 대량 흡수. **단, 신생 도메인 2개로 나누면 권위 분산으로 역효과** — jsflower는 한쪽이 이미 랭크된 상태에서 추가한 케이스.

**적용 우선순위 결정**: (1순위) 같은 도메인 내 프로그래매틱 SEO → (2순위) 네이버 블로그 → (3순위) 제2도메인. 보유 자산 한자 9,595자가 jsflower엔 없는 무기.

### 구현: `/hanja` 인명용 한자 사전 (라이브 ✅)

- **데이터**: `scripts/build_hanja_seo_data.py` — 한자 JSON 4종(dictionary_final/strokes/core_v1/radical_map) 병합 → `frontend/src/data/hanja-seo.json`(1.2MB). 오행 등급 S(검수 2,054)/C(자동 1,484)/D(획수 5,652), 백엔드 `HanjaData.cs` 우선순위와 동일. 데이터 정제: 쉼표 묶음 독음 863자 분리 + nan 오염 제거.
- **라우트**: `/hanja`(초성 ㄱ~ㅎ 인덱스) + `/hanja/[slug]`(한글=독음 목록 / 한자=글자 상세). 독음 489개 + 글자 9,096개 = **9,585페이지**.
- **퍼널**: 전 페이지 CTA "이 글자로 이름 추천받기" → `/required-char?char=` 프리필. 한자 직접 입력 시 항렬자 모드(`requiredHanja`)로 동작.
- **SEO**: generateMetadata + canonical + JSON-LD(글자=DefinedTerm / 독음=ItemList / Breadcrumb). 디자인은 기존 ConfidenceGrade 4축 뱃지 재사용. Footer에 "인명용 한자 사전" 링크.
- **sitemap**: 2,557 URL(정적 17 + 독음 489 + S급 글자 2,052). **단계적 공개** — thin-content 판정 회피 위해 1차는 검수 글자만 등재, 나머지는 내부링크로 자연 발견.

### ⚠️ 빌드 전략 — 온디맨드(ISR) 폐기, 전량 prerender

1차로 하이브리드(S급만 prerender + 나머지 `dynamicParams=true` 온디맨드)로 배포했으나 **Vercel에서 온디맨드 생성 페이지만 500** 반환(로컬 `next start` 재현 불가, vercel/next.js#81155·#71757 계열 미해결 이슈). → **전량 빌드 타임 생성**(`dynamicParams=false`, 9,608페이지/15.9초)으로 전환. 산출물 ~2GB지만 Vercel 파일 수 하드캡 없음. 프로덕션 전 구간(S/D/확장A/SMP 글자, 404, CTA) 200 검증 완료.

> 설계 상세: `docs/hanja-seo-design.md`

### 다음 할 일 (한자 SEO 후속)

1. **색인 추이 확인 (2~4주 뒤)** — 구글/네이버 서치콘솔은 이미 등록·사이트맵 제출 완료(아래 운영 정비 세션 참조), 사이트맵 URL 동일하므로 **재제출 불필요·자동 재수집**. `/hanja/*` 색인 진행률만 모니터링.
2. **단계적 공개 2단계** — 색인 양호 시 `sitemap.ts`의 `getCuratedChars()` → `getAllDetailChars()` 한 줄 교체로 전체 9,585 URL 공개.
3. **제2도메인 선점(방어용)** — `namingkyeol.kr`/`namingkyeol.co.kr` 둘 다 미등록 확인됨(2026-06-13). 가비아 등에서 연 1~2만원 선점 후 Vercel 301 리다이렉트만. **콘텐츠 분산은 본체 랭크 후** 검토.
4. **2단계 프로그래매틱 SEO(후순위)** — `/name/[이름]` 이름 뜻 페이지, `/surname/[성]` 성씨 랜딩, 네이버 블로그 연계.

### 미커밋 참고
- 한자 사전 관련 파일만 선택 커밋(`aa6a183`, `dd2c06d`) + push 완료. 다른 병렬 세션의 작업 파일(엔진, about/method lint 등)은 워킹 트리에 남겨둠 — `git add -A` 금지, 내 파일만 명시 스테이징.
- ~~기존 프론트 lint 에러 8건(about/method 따옴표, EvaluateInput/SpecialtyPage/favorites의 effect 내 setState)은 별도 작업 칩으로 분리~~ ✅ **해소** (위 lint 정리 세션, 커밋 `18eee18`) — 에러 8건 + 경고 9건 모두 처리.

---

## 이전 세션 (2026-06-13 — 운영 정비 3건)

전반 상태 점검(테스트 877/877 ✅, 프론트 22 라우트 빌드 ✅, namingkyeol.com 200 ✅) 후 발견 이슈 처리:

1. **Render cold start 회피** — 운영 API 첫 응답 34초 실측. `.github/workflows/keepalive.yml` 신규: 10분 간격 cron으로 `hanja-stats` 엔드포인트 ping (GitHub Actions 무료). ⚠️ 저장소 60일 무커밋 시 스케줄 자동 비활성화 — GitHub 알림 메일 오면 재활성화.
2. **루트 `dotnet test` 무동작 수정** — 솔루션 파일이 없어 루트에서 테스트 0개 실행+exit 0(성공처럼 보임)이던 문제. `NameForm.slnx` 신규 (메인+Tests 포함) → 루트 `dotnet test`로 877개 실행 확인.
3. **frontend/public의 무관 파일 정리** — "노출 정지 상품 리스트.csv"(꽃배달 사업 파일, 커밋 시 웹에 공개 서빙될 뻔) → `C:\Users\HappyFlower\Documents\`로 이동.
4. **CLAUDE.md 현행화** — 테스트 수(17→877), 운영 상태(배포 완료), 라우트(15→22, about/contact/favorites 반영), 알려진 이슈 갱신.

## 같은 날 후속 세션 (2026-06-13 — 🎯 작명 엔진 품질 대수술)

사용자 요청 "좋은 이름이 나오도록 엔진을 신경써야겠다" → 실측 기반 진단 + 구조 수정.

### 실측 진단 (수정 전, 6성씨 × 남/녀 smart 호출)

- **standard 탭**: "광부(87)", "백기(86)", "우상", "유신", "비광"(화투), "빈기", "경타", "아상" 등 비(非)이름/부정 연상 조합이 상위 도배
- **creative 탭**: 허/윤 성씨에서 민준·도현·서윤·하윤·시우·지호 등 **최고 유행 이름**이 고점 (세대 중립 철학 정면 위반)
- **점수 소수점**: `89.39999999999999` 그대로 API 노출
- **3글자 큐레이션**: "수빈아" (호격) 포함

### 근본 원인 2개

1. **`AestheticEngine.EvaluateGenerationalNeutrality` 5단계**: "DB에도 없고 흔한 어미도 없는 이름 = 만점(100)" — 독특함과 이름다움을 혼동. 경타/빈기처럼 이름 같지도 않은 조합이 세대중립 만점을 받음
2. **`CreativeNamingEngine.GetGenericExpansions`** (미등록 성씨 폴백): 유행 이름이 사전에 직접 수록되어 있었음

### 수정 내역

#### ① NamingPrinciples — `EvalNameLikeness` 신설 (이름다움 평가)
- 실명에서 음절이 해당 위치(첫째/둘째)에 쓰이는 빈도를 3단계(흔함 1.0 / 가능 0.6 / 이례적 0.2·0.15)로 평가
- 첫째 45% + 둘째 55% 가중. 한쪽이 이례적이면 ×0.6 (예: "균비" — 균이 비이름 음절인데 비가 흔하다고 통과 방지)
- 음절 테이블: 첫음절 흔함 47 + 가능 31 / 끝음절 흔함 46 + 가능 20 (순우리말 어미 포함: 슬/을/늘/름/빛/별 등)
- 2음절만 평가, 그 외 중립값 0.7

#### ② NamePoolEngine (standard 풀 생성)
- 조합 점수에 `nameLikeness × 350` 가중 추가 (성씨연음 250보다 강함)
- 이름다움 < 0.5 조합은 풀에서 하드 제외
- **두음법칙**: 첫음절이 `RequiresDueum`(룡/림/량 등)이면 제외 — "룡규" 같은 위반 차단

#### ③ AestheticEngine
- 세대중립 5단계(독특)를 이름다움 3단 차등: ≥0.85 → 100 / ≥0.55 → 85 / 미만 → 70
- `_oldStyleEndings`에 "경" 추가 (미경/수경 류)
- 부정 연상 동음이의어 -10점 감점 신설

#### ④ ForbiddenWordData — `NegativeHomophoneNames` 신설 (이름 완전 일치 전용)
- 광부/백기/우상/유신/비광/구민/수용/조용/정유/아성/아재/아수 등 30개
- ⚠️ ForbiddenWords(부분 일치)에 넣으면 "백기"가 백씨 성 "백기훈"까지 차단 → **완전 일치 전용 목록으로 분리**한 것이 핵심
- NamePoolEngine 필터 + AestheticEngine 감점 + CreativeEngine 필터 3곳 적용

#### ⑤ CreativeNamingEngine
- 폴백 사전의 유행 이름 14개 교체 (서윤→윤슬, 유나→예솔, 채원→단아, 하윤→다온, 민준→재윤, 도현→진혁, 시우→수혁, 준서→범준, 건우→건휘, 도윤→주안, 지호→태온, 하린→누리, 아린→아람, 소율→소담)
- 출력 단계에 `IsTrendyName` + `IsNegativeHomophoneName` 필터 추가 (성씨별 패턴에 남은 유행 이름도 일괄 차단)

#### ⑥ 기타
- SmartRecommendationService: creative/3글자 Score `Math.Round(x, 1)` (소수점 쓰레기 제거)
- 3글자 큐레이션 "수빈아" → "수아린" (JSON + 엔진 폴백 2곳)
- xUnit1026 경고 수정 (ApplyDueum 테스트)

### 검증 결과 (수정 후 동일 입력)

- 남아: **유승·아승·우준·유재·건규·민규·규린** 등 정상 이름 (광부/백기/규룡 전멸)
- 여아: 우준·유승·수민·선유·은규 등 (빈기/경타/우상/유신 전멸)
- creative: 예솔·윤슬·다온·단아·수혁·주안·재윤·태온 (유행 이름 0)
- 테스트: **877 → 905개 (+28)**, 실패 0 — EvalNameLikeness 단위 테스트 + 비이름/유행/이름다움 회귀 테스트 추가

### 남은 품질 개선 방향 (다음 후보)

1. ~~**여아 1위 "미규" 문제**~~ ✅ 해소 (같은 날 3차 — 아래 참조)
2. **실명 통계 결합 (외부 크롤링)** — 네임차트/대법원 크롤링으로 음절 테이블을 더 큰 데이터 기반으로 교체 (현재는 GenerationNameData 내부 통계 + 수동 큐레이션)
3. ~~아승/승아 "아+한자" 패턴~~ ✅ 대부분 해소 (성별 어미 적합이 위치별로 처리)

### 3차 — 성별 어미 적합 (Gender Syllable Fit, 같은 날 후속)

사용자 피드백: "규민, 규희는 여아 이름으로 좋다" → **같은 음절도 위치에 따라 평가가 달라야 한다**.
"규"는 어미(민규·승규)로는 남성형이지만 첫음절(규민·규희)로는 여아에게 자연스러움.

- **`NamingPrinciples.EvalGenderSyllableFit(first, second, gender)`** 신설 (0~1)
  - 끝음절 성별 전형성: **GenerationNameData 실명 통계(~190개, 성별 라벨)에서 파생**
    (2음절·표본 3+·한쪽 80%+) + 수동 큐레이션 병합 + 중립 보정(수/민/윤/진/현/우 등 17개)
  - 어미가 반대 성별 전형이면 −0.65, 첫음절이면 −0.35 / gender 미지정은 항상 1.0
  - 남성형 어미: 철/호/석/규/욱/혁/환/훈/승/준/용 등 + 통계 파생
  - 여성형 어미: 희/숙/순/자/미/나/라/아/은/연/린/슬 등 + 통계 파생
- NamePoolEngine 조합 점수에 ×220 가중 / AestheticEngine에 불일치 −3 + 노트("남성형 어미 (여아 기준 참고)")
- **검증**: 여아 상위 10에서 미규/아수/규린(남성형) 소멸 → 수민·준아·선유·은수·은재·**규미** 등.
  남아에서 성아/승아(여성형 어미) 소멸 → 유승·우준·건규·민규·호승 등
- 테스트 **905 → 923 (+18)**: 위치별 적합 단위 테스트(규민/규희 여아 OK 케이스 포함) + 성별 어미 회귀 테스트(상위 10 불일치 0 보장)

### 남은 작업 후보 (이전과 동일)
- api.namingkyeol.com Render 검증 → Vercel `NEXT_PUBLIC_API_URL` 교체
- ~~Google Search Console 등록 + 사이트맵 제출~~ ✅ 확인 완료 (2026-06-13): 구글(도메인 속성, DNS TXT)·네이버 모두 2026-05-21에 이미 등록·사이트맵 제출되어 있었음. 사이트맵 URL 동일·내용만 2,557개로 확장이라 재등록 불필요 — 자동 재수집됨. 구글은 전체 URL로 재제출하여 재수집 트리거함 (도메인 속성은 상대경로 `sitemap.xml` 입력 시 거부 — 전체 URL 필요)
- 실명 통계 외부 크롤링 (네임차트/대법원) — EvalNameLikeness/GenderSyllableFit 음절 테이블 확장
- 사용자 테스트 5~10명 + 피드백
- usage/summary 데이터 누적 후 (한 달~) creative·nickname 등 약한 엔진 존폐 판단
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
| 2026-06-13 (후속) | 🎯 **작명 엔진 품질 대수술**: EvalNameLikeness 신설(실명 음절 위치별 3단계 평가), NamePool 이름다움 가중 350+하드 필터+두음법칙, 세대중립 "독특=만점" 구조 수정(이름다움 3단 차등), NegativeHomophoneNames 30개(완전 일치 전용 — 부분 일치의 백씨 오폭 방지), creative 폴백 유행 이름 14개 교체+출력 필터, 점수 반올림, 수빈아→수아린. 광부/백기/빈기/경타/우상/유신/비광/민준/서윤 등 전멸 확인. 테스트 877→905 (+28) |
| 2026-06-13 (3차) | 🚻 **성별 어미 적합**: EvalGenderSyllableFit 신설 — GenerationNameData 실명 통계 파생 + 수동 큐레이션. 같은 음절도 위치별 평가(규=어미는 남성형, 첫음절 규민/규희는 여아 OK — 사용자 피드백 반영). NamePool ×220 + Aesthetic −3. 여아 미규/아수 소멸, 남아 성아/승아 소멸. 테스트 905→923 (+18) |
| 2026-06-13 (4차) | 📊 **카테고리 사용량 집계**: UsageEvent 도메인 모델 + EfUsageTracker(실패 무시) + UsageController(POST /usage/event 화이트리스트 검증 + GET /usage/summary) + 12개 엔드포인트 TrackAsync 한 줄씩 + 프론트 trackTabView(sendBeacon, 탭별 1회) + 초기 탭 분모 확보. ⚠️ EnsureCreated 함정 → CREATE TABLE IF NOT EXISTS 멱등 생성(SQLite/PostgreSQL 양쪽). 테스트 923→930 (+7). 로컬 검증 완료(endpoint/smart:1, tab_view/creative:1 확인) |
| 2026-05-20 | 🎊 **정식 출범** — namingkyeol.com 도메인 등록(Cloudflare $10.46/년, auto-renew ON, 만료 2027-05-19), Email Routing(contact@→podopado1@gmail.com), Supabase PostgreSQL(Seoul ap-northeast-2), Render 백엔드 배포(Dockerfile + $APP_UID), Vercel 프론트 배포(Hobby 무료), DNS 연결 + Let's Encrypt SSL 자동, TLS 1.3. 트러블슈팅 5건 해결(Python자동인식/UID충돌/IPv6timeout/EnsureCreated silent fail/UTC strict). 코드 변경: Dockerfile/.dockerignore 신규, csproj data publish 보장, Program.cs Npgsql legacy timestamp + DB 초기화 견고화, .gitignore secrets 패턴 강화, frontend/.git 제거(monorepo). contact 페이지 mailto를 도메인 이메일로 교체. 보안 점수 측정: **SecurityHeaders A**, **Mozilla Observatory B+ (80/100)**. 877개 테스트 유지. 월 운영비 ~₩1,200 (도메인만) |
