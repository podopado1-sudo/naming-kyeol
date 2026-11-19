// ============================================================
// Smart Router (통합 추천)
// ============================================================
/**
 * 백엔드 SmartRecommendationRequestDto와 필드명이 1:1이어야 한다 — 없는 필드는
 * 오류 없이 조용히 무시된다 (includeTwin·englishName으로 보내 쌍둥이·영어 겸용이
 * 출시 이후 한 번도 켜지지 않았던 전력, 2026-10-21).
 * 부모 이름·영어 이름·필수 글자 카테고리는 켜기 플래그가 따로 없고, 해당 값이
 * 들어오면 백엔드가 카테고리를 붙인다.
 */
export interface SmartRecommendationRequest {
  lastName: string;
  birthDate?: string;
  /** 출생 시각 (HH:mm, 선택) — 사주 시주(時柱) 계산에 사용 */
  birthTime?: string;
  gender?: string;
  tone?: string;
  /** 부모 성 — /search 는 성 포함 전체 이름 칸을 lib/name-split.ts splitParentName 으로 나눠 보낸다 */
  fatherSurname?: string;
  motherSurname?: string;
  /** 부모 이름(성 제외) — 하나라도 있으면 parent-based 카테고리 추가 */
  fatherName?: string;
  motherName?: string;
  storyKeyword?: string;
  /** 선호 영어 이름 — 있으면 dual-name 카테고리 추가 */
  preferredEnglishName?: string;
  /** 필수 글자 — requiredChar 또는 requiredHanja가 있으면 required-char 카테고리 추가 */
  requiredChar?: string;
  /** "first" | "last" | "any" */
  requiredCharPosition?: string;
  /** 항렬자(한자 1글자, 선택) — 형제자매 공유 한자 */
  requiredHanja?: string;
  /** 쌍둥이 — true면 twin 카테고리 추가 */
  isTwin?: boolean;
  includeThreeSyllable?: boolean;
  includePureKorean?: boolean;
  includeCreative?: boolean;
  preferredFiveElement?: string;
  /** 의미 선호 키워드 (예: ["지혜", "용기", "맑음"]) */
  preferredMeanings?: string[];
}

export interface SmartRecommendationResponse {
  lastName: string;
  isRareSurname: boolean;
  rarityLevel?: string;
  categories: NameCategory[];
  totalCount: number;
  /**
   * 추천 1위 — 전 카테고리 통합 중 최고점.
   * 탭 UX에서 사용자가 전체 탭을 돌지 않아도 핵심 추천을 즉시 파악할 수 있도록 노출.
   * 후보가 하나도 없으면 null. (백엔드 2026-04-21 후속 2 탭 UX)
   */
  topPick: TopPick | null;
}

/**
 * 추천 1위 후보 — 속한 카테고리 정보 + 후보.
 */
export interface TopPick {
  /** 속한 카테고리 타입 (예: "standard", "pure-korean") */
  categoryType: string;
  /** 속한 카테고리 라벨 (예: "한자 이름") */
  categoryLabel: string;
  /** 추천 1위 후보 */
  candidate: SmartNameCandidate;
}

export interface NameCategory {
  /** "standard" | "pure-korean" | "three-syllable" | "creative"
   *  | "parent-based" | "required-char" | "dual-name" | "twin" | "rare-surname" */
  type: string;
  /** "한자 이름" | "순우리말 이름" | ... 한국어 표시명 */
  label: string;
  engineUsed: string;
  names: SmartNameCandidate[];
}

export interface SmartNameCandidate {
  name: string;
  fullName: string;
  meaning: string;
  /** 사람 서사형 코이닝 한 문장 (창의 카테고리 한정). 없으면 숨김. */
  story?: string;
  /** 배정된 음절별 한자 글자(예: "友晶"). 한자 카테고리 한정, 없으면 undefined. */
  hanja?: string;
  score?: number;
  /** 미학 점수 (한자 카테고리 한정, 0~100). 없으면 undefined. */
  aestheticScore?: number;
  /** 조화 점수 (한자 카테고리 한정, 0~100). 없으면 undefined. */
  harmonyScore?: number;
  tags: string[];
  /**
   * 추천 이유 (수치+근거 형식). standard·twin 등에서 채워지며,
   * 비어 있으면 meaning 한 줄만 표시.
   */
  reasons?: string[];
  /** 성별 안내 라벨 — 요청 성별과 반대로 기우는 이름일 때만 (예: "주로 여자 이름"). */
  genderNote?: string;
  /**
   * 음운 특성 노트 (감점 없음, 정보 노출 용도).
   * 이름의 발음/모음 리듬 특성을 사용자에게 정보로 노출.
   * (백엔드 2026-04-21 옵션 C Phase 2)
   */
  phonologyNotes: PhonologyNote[];
}

/**
 * 음운 특성 노트.
 * 하드필터를 통과한 이름에 붙는 정보 노출용 노트 (점수 영향 없음).
 */
export interface PhonologyNote {
  /** 특성 ID (예: "r_initial_after_final", "same_vowel_three_streak") */
  id: string;
  /** 특성 이름 (한국어 표시명) */
  name: string;
  /** 사용자 노출 메시지 (플레이스홀더 치환된 결과) */
  message: string;
  /** 특성이 탐지된 시작 음절 위치 (0-based) */
  position: number;
}

// ============================================================
// Pure Korean
// ============================================================
export interface PureKoreanRequest {
  lastName: string;
  gender?: string;
  tone?: string;
  count?: number;
}

// ============================================================
// Creative Naming
// ============================================================
export interface CreativeNamingRequest {
  lastName: string;
  gender?: string;
  tone?: string;
  count?: number;
}

/**
 * /recommendations/creative 원본 응답 후보 — 백엔드 CreativeNameCandidate를
 * DTO 변환 없이 배열로 그대로 반환한다 (parent-based·dual-name과 동일 계약).
 */
export interface CreativeCandidate {
  name: string;
  fullName: string;
  /** 창작 컨셉 설명 */
  concept: string;
  /** 성씨와의 연결 고리 */
  surnameConnection: string;
  meaning: string;
  /** 사람 서사형 코이닝 한 문장. 없으면 빈 문자열. */
  story: string;
  /** 창의성 점수 (0~100) */
  creativityScore: number;
  genderTag: string;
  toneTag: string;
  surnameTailored: boolean;
}

// ============================================================
// Three Syllable
// ============================================================
export interface ThreeSyllableRequest {
  lastName: string;
  gender?: string;
  tone?: string;
  /** "pure-korean" | "hanja" | "mixed" */
  nameType?: string;
  count?: number;
}

// ============================================================
// Required Char
// ============================================================
export interface RequiredCharRequest {
  lastName: string;
  requiredChar: string;
  /** 항렬자 (한자 1글자, 선택) — 지정 시 발음은 한자의 음으로 자동 도출 */
  requiredHanja?: string;
  position?: string;
  /** 출생일 (YYYY-MM-DD) — 백엔드 필수, 없으면 400 */
  birthDate?: string;
  /** 출생 시각 (HH:mm, 선택) */
  birthTime?: string;
  /** "male" | "female" | "none" — 엔진이 소문자로 비교한다 */
  gender?: string;
  /** "neutral" | "soft" | "strong" — 엔진이 소문자로 비교한다 */
  tone?: string;
}

/**
 * /recommendations/required-char 원본 응답 후보 — 백엔드 RequiredCharCandidate를
 * DTO 변환 없이 배열로 그대로 반환한다 ({names,totalCount} 객체가 아님).
 * 점수 필드가 없어서 화면에서는 점수를 표시하지 않는다.
 */
export interface RequiredCharCandidate {
  /** 이름 (성 제외, 예: "준서") */
  name: string;
  /** 필수로 들어간 글자 (한글) */
  requiredChar: string;
  /** 필수 글자가 놓인 자리 — "first" | "last" */
  position: string;
  /**
   * 한자 옵션 "글자(훈음)" — 필수 글자 쪽 후보 최대 2개와 짝 글자 1개를 이름 순서대로
   * (예: 용준 → ["勇(날랠 용)", "俊(준걸 준, 순임금 순)", "峻(높을 준/준엄할 준)"])
   */
  hanjaOptions: string[];
  /** 고정된 항렬자 한자 — 항렬자 모드가 아니면 null */
  fixedHanja: string | null;
  /** 이름 의미 설명 */
  meaning: string;
}

// ============================================================
// Parent Based — 별도 응답 타입 (ParentBasedCandidate[])
// ============================================================
export interface ParentBasedRequest {
  lastName: string;
  fatherSurname?: string;
  fatherName?: string;
  motherSurname?: string;
  motherName?: string;
  /** 스토리 키워드 (선택, 예: "사랑", "희망") */
  storyKeyword?: string;
  birthDate?: string;
  /** 출생 시각 (HH:mm, 선택) */
  birthTime?: string;
  gender?: string;
  tone?: string;
}

export interface ParentBasedCandidate {
  /** 이름 부분 (성씨 제외, 2음절) */
  name: string;
  /**
   * 작명 방식 중립 코드 (예: "mother-surname", "parent-syllables" — 백엔드 ParentNamingModels).
   * 화면에 그대로 내지 않는다 — 칩 분류(lib/parent-naming.ts)에만 쓰고 문구는 namingLabel
   */
  namingModel: string;
  /** 사용자용 방식 이름 (예: "어머니 성씨 잇기", "부모 이름 글자 잇기") — 태그 문구 */
  namingLabel?: string;
  /** 계승 꼴 — "음운중심" · "의미중심" · "서사중심" (방식에서 정한다) */
  nameType: string;
  /** 생성 방식 설명 */
  description: string;
  /**
   * 설명이 풀이한 한자(음절마다 한 자) — 뜻을 잇는 방식(부모 이름 뜻·키워드 뜻·성씨 뜻)만, 나머지는 null.
   * 출생일을 넣은 /evaluate 의 용신 배정 한자와 다를 수 있다
   */
  hanja?: string | null;
}

// ============================================================
// Twin Names — 별도 응답 타입 (NameSet 단위 구조)
// ============================================================
export interface TwinNamesRequest {
  lastName: string;
  birthDate?: string;
  /** 출생 시각 (HH:mm, 선택) */
  birthTime?: string;
  gender?: string;
  tone?: string;
  /** 자녀 수 (2 또는 3) */
  childCount?: number;
  /** 기존 형제/자매 이름 (선택) */
  existingSiblingNames?: string[];
}

export interface TwinNameResponse {
  id: string;
  nameSets: TwinNameSet[];
}

export interface TwinNameSet {
  /** 세트 유형: "공유글자", "공유의미", "공유톤" */
  theme: string;
  /** 세트 설명 */
  themeDescription: string;
  /** 이름 목록 (채점 포함) */
  names: TwinCandidate[];
  /** 세트 조화도 (0-100) */
  coherenceScore: number;
}

export interface TwinCandidate {
  name: string;
  aestheticScore: number;
  harmonyScore: number;
  finalScore: number;
  reasons: string[];
}

// ============================================================
// Dual Name (Korean + English) — 별도 응답 타입 (DualNameCandidate[])
// ============================================================
export interface DualNameRequest {
  lastName: string;
  /** 선호 영어 이름 (선택, 예: "Philip") — 미입력 시 엔진이 자동 추천 */
  preferredEnglishName?: string;
  birthDate?: string;
  /** 출생 시각 (HH:mm, 선택) */
  birthTime?: string;
  gender?: string;
  tone?: string;
}

export interface DualNameCandidate {
  /** 한국어 이름 (성씨 제외, 예: "필립") */
  koreanName: string;
  /** 영어 대응 이름 (예: "Philip") */
  englishEquivalent: string;
  /**
   * 한자 문자 목록 — 음절마다 하나. 요청의 생년월일·출생 시각·성별로 /evaluate 와 같은 용신 배정을 한 글자라 같은 영어 이름도
   * 조건마다 달라진다 (예: 필립 남자·2021-07-08·시각 없음 → ["弼", "粒"], 2026-10-28)
   */
  hanjaCharacters: string[];
  /** 한자 의미 조합 — 음절마다 그 독음의 훈 하나를 " + " 로 잇는다 (예: "도울 필 + 낟알 립(입)") */
  hanjaMeaning: string;
}

// ============================================================
// Name Analysis
// ============================================================
export interface NameAnalysisRequest {
  lastName: string;
  firstName: string;
  birthDate?: string;
  birthTime?: string;
  gender?: string;
  tone?: string;
}

export interface SajuPillarData {
  stemChar: string;
  stemName: string;
  branchChar: string;
  branchName: string;
  /** 천간 오행 */
  fiveElement: string;
  yinYang: string;
  /** 지지 오행 (2026-11 /saju/elements 와 함께 추가 — /name-analysis 응답에도 실린다, 옛 응답에는 없음) */
  branchFiveElement?: string;
}

export interface YongshinData {
  strength: "Strong" | "Weak" | "Balanced";
  strengthScore: number;
  eokbuYongshin: string;
  johuYongshin?: string;
  primaryYongshin: string;
  heeshin: string;
  gishin: string;
  strengthDescription: string;
  yongshinReason: string;
  nameFitsYongshin?: boolean;
}

export interface SajuChartData {
  yearPillar: SajuPillarData;
  monthPillar: SajuPillarData;
  dayPillar: SajuPillarData;
  hourPillar?: SajuPillarData;
  fiveElementCount: Record<string, number>;
  missingElements: string[];
  strongestElement: string;
  dayMaster: string;
  birthplaceName: string;
  correctionMinutes: number;
  /**
   * 진태양시 보정을 했는지 — 사주 계산 수정(설계 docs/plan-ohaeng-2026-11.md §1 P0)에서 더한 필드. 출생 시각이 없으면 false
   * (날짜 그대로 — 보정 없음, correctionMinutes 0). P0 전 백엔드 응답에는 없다(undefined) — 화면은 undefined 를 '모름'으로 읽는다
   */
  correctionApplied?: boolean;
  /**
   * 시각 없이 넣은 날 안에 12절 절입 순간이 있으면 그 절기 이름(예: "입춘"), 아니면 null — P0-c 에서 더한 필드.
   * 그날은 태어난 시각에 따라 월주(입춘이면 연주도)가 갈린다(시각이 없으면 낮 12시 기준). P0 전 백엔드 응답에는 없다
   */
  termOnBirthDay?: string | null;
  yongshin?: YongshinData;
}

// ============================================================
// Saju Elements — 부족한 오행 찾기(/ohaeng), POST /api/v1/saju/elements
// 백엔드 SajuElementsRequestDto·SajuElementsResponseDto 와 1:1 (설계 docs/plan-ohaeng-2026-11.md §2)
// ============================================================
export interface SajuElementsRequest {
  /** 양력 생년월일 YYYY-MM-DD (1900-01-01 ~ 오늘 KST) */
  birthDate: string;
  /** 출생 시각 HH:mm (선택 — 없으면 시주를 빼고 여섯 글자) */
  birthTime?: string;
  /** 출생지 시·도 코드 (선택 — lib/birthplaces.ts 17개, 비우면 서울) */
  birthplaceCode?: string;
}

/** 한자 묶음 역할 — 용신 · 희신 · 원국에 없는 오행 */
export type ElementRole = "yongshin" | "heeshin" | "missing";

export interface ElementHanjaItem {
  character: string;
  /** 대표 독음 — gloss 를 고른 독음 */
  reading: string;
  /** 대표 독음 + 대체 독음 중 한글 한 음절(李 리·이) — 독음마다 /hanja/{독음} 링크 */
  readings: string[];
  /** 그 독음의 훈 한 조각 (예: "밝을 명", "오얏 리(이)") */
  gloss: string;
  /** 자원오행 등급 — "R"(확정) 또는 "X"(예외 적용) */
  resourceGrade: string;
}

export interface ElementHanjaGroup {
  /** 木/火/土/金/水 */
  element: string;
  roles: ElementRole[];
  /** 없는 오행이 기신일 때 true — 이때 hanja 는 빈 배열 */
  isGishin: boolean;
  hanja: ElementHanjaItem[];
}

export interface SajuElementsResponse {
  /** /name-analysis 의 saju 와 같은 모양(이름이 없어 yongshin.nameFitsYongshin 은 늘 null) */
  saju: SajuChartData;
  /** 센 글자 수 — 시주가 있으면 8, 없으면 6 */
  characterCount: number;
  hasBirthTime: boolean;
  /** 출생지를 비워 서울 기준으로 둔 경우 true */
  birthplaceDefaulted: boolean;
  /** 개수가 가장 많은 오행 전부(동률 포함, 木火土金水 순) — saju.strongestElement 는 동률이면 하나뿐이라 화면은 이것을 쓴다 */
  strongestElements: string[];
  /** 용신 → 희신 → 없는 오행 순의 오행별 한자 예 묶음(최대 5, 같은 오행 두 번 없음) */
  elementHanja: ElementHanjaGroup[];
}

// ============================================================
// Rare Surname — 별도 응답 타입 (PhoneticAnalysis + HanjaOptions)
// ============================================================
export interface RareSurnameRequest {
  lastName: string;
  birthDate?: string;
  /** 출생 시각 (HH:mm, 선택) */
  birthTime?: string;
  gender?: string;
  tone?: string;
  /** 추천 개수 (1~50, 기본 10) */
  count?: number;
}

export interface RareSurnameResponse {
  lastName: string;
  isRareSurname: boolean;
  /** 희귀도 레벨 (1~4) */
  rarityLevel: number;
  /** 성씨 발음 분석 — banner 표시용 */
  phoneticAnalysis: string;
  totalCount: number;
  candidates: RareSurnameCandidate[];
}

export interface RareSurnameCandidate {
  /** 전체 이름 (성+이름) */
  fullName: string;
  /** 이름 부분 */
  name: string;
  /** 성씨와의 발음 조화 점수 (0~100) */
  harmonyScore: number;
  /** 발음 조화 이유 — Reasons 첫 라인 강조용 */
  harmonyReason: string;
  /** 한자 옵션 목록 — 가로 스크롤 chip */
  hanjaOptions: string[];
}

// ============================================================
// Common Response (individual engines may return this)
// ============================================================
export interface NameRecommendationResponse {
  names: SmartNameCandidate[];
  totalCount: number;
}

export interface EumryeongSyllable {
  syllable: string;
  initial: string;
  fiveElement?: string;
}

export interface EumryeongAnalysis {
  syllables: EumryeongSyllable[];
  elementCount: Record<string, number>;
  dominantElement?: string;
}

/** 이름 분석 — 음절 하나에 쓸 수 있는 한자 후보 (백엔드 HanjaOptionDto) */
export interface AnalysisHanjaOption {
  character: string;
  /** 대표 훈음 (예: "민첩할 민") */
  meaning: string;
  fiveElement?: string | null;
  /** 자연/덕목/개념 */
  category?: string | null;
  strokeCount?: number | null;
  /** 강희자전 원획수 */
  kangxiStrokes?: number | null;
  /** 자원오행 판정 등급 R=확정·V=이견 있음·X=예외 적용·U=미상 (2026-10-22 S4 백엔드 추가 — 화면은 toResourceGrade 로 거른다) */
  resourceGrade?: string | null;
  /** V 등급의 이유(data/hanja_resource_element.json v_reasons — 2026-10-22 S7 백엔드 추가). radical_single 하나뿐이면 '자료 적음',
   *  radical_unknown 하나뿐이면 '추정'(gradeBadgeKey — /hanja 와 같은 기준). 옛 백엔드면 없다 */
  vReasons?: string[] | null;
  /**
   * @deprecated 옛 뜻 기반 판정 등급(S/C/D) — S4 부터 fiveElement(부수 기준)와 무관하다. 화면은 읽지 않는다(백엔드가 S7 뒤 뺀다).
   */
  confidenceGrade?: string;
  /** 자원오행 판정 근거 한 줄(부수 근거 — 예: "手·扌(손 수) 부수 → 木") */
  rationale?: string | null;
}

/** 이름 분석 — 음절별 한자 후보 (성씨 제외, 이름 음절만) */
export interface AnalysisHanjaBreakdown {
  syllable: string;
  /** 관련도순 상위 10개 — 사용자가 고른 한자가 아니라 후보 목록 */
  possibleHanja: AnalysisHanjaOption[];
}

/** 이름 분석 — 뒤집기·변형 이름 (백엔드 NameVariantDto) */
export interface AnalysisNameVariant {
  name: string;
  /** "반전" | "재조합" | "음절교환" */
  variationType: string;
  description: string;
}

/** 백엔드 NameAnalysisResponseDto와 1:1 */
export interface NameAnalysisResponse {
  /** 성+이름 */
  fullName: string;
  aestheticScore: number;
  /** 생년월일 미제공 시 null */
  harmonyScore: number | null;
  /** 유니크 지수 (0~100) */
  rarityScore: number;
  /** 미학*0.7 + 조화*0.3 — 조화가 없으면 미학 점수 */
  finalScore: number;
  hanjaBreakdown: AnalysisHanjaBreakdown[];
  strengths: string[];
  weaknesses: string[];
  /** 추천 이유 (ExplanationEngine) */
  reasons: string[];
  reversalVariants: AnalysisNameVariant[];
  /** 생년월일 제공 시에만 */
  saju?: SajuChartData | null;
  eumryeongAnalysis?: EumryeongAnalysis | null;
}

// ============================================================
// Name Evaluation (상세 평가)
// ============================================================
export interface NameEvaluationRequest {
  name: string;
  lastName: string;
  birthDate?: string;
  /** 출생 시각 (HH:mm, 선택) — 사주 시주(時柱) 계산에 사용 */
  birthTime?: string;
  gender?: string;
  tone?: string;
  /**
   * 이름 한자(선택, 2026-11 한자 입력) — 글자 수 = 이름 글자 수. 자리마다 한자 한 글자 / `*` 자동 / `-` 한자 없이 한글로.
   * 지정이 없으면 필드를 보내지 않는다. 이름·성씨가 한글 음절(가~힣)만일 때만 보낸다(아니면 400 name_not_hangul).
   * 주소·저장에 쓰는 꼴(끝의 `*` 생략)과 다르다 — lib/hanja-pick.ts apiHanjaFields 가 전체 길이로 푼다
   */
  nameHanja?: string;
  /** 성씨 한자(선택) — 글자 수 = 성씨 글자 수. 자리마다 한자 / `*`(기본으로 두는 한자). `-` 는 받지 않는다 */
  lastNameHanja?: string;
}

// ------------------------------------------------------------
// 한자 입력(/evaluate 음절별 한자 고르기, 2026-11) — 백엔드 Application/DTOs/HanjaFactDto.cs 와 1:1
// (설계 docs/plan-hanja-input-2026-11.md §4). API 응답은 모든 필드를 싣는다. 음절별 정적 후보 파일
// (public/data/hanja-pick/v1)은 기본값(false·빈 목록)인 필드를 빼고 싣는다 — lib/hanja-pick.ts toHanjaFact 가 채운다.
// ------------------------------------------------------------

/** 한자 한 글자의 사실 — 화면이 그대로 그리는 값만(점수·길흉 판정 없음) */
export interface HanjaFact {
  /** 글자 — 늘 통합 한자 */
  character: string;
  /** 그 음절로 읽는 훈 한 조각('상서 서', '오얏 리(이)'). 한글 훈이 없으면 "" */
  gloss: string;
  /** 부수 기준 자원오행 木·火·土·金·水 — 미상이면 "" */
  fiveElement: string;
  /** 자원오행 등급 R 확정 · V 이견 있음 · X 예외 적용 · U 미상 */
  resourceGrade: string;
  /** V 등급의 이유(V 가 아니면 빈 목록) */
  vReasons: string[];
  /** 총획수(유니코드 kTotalStrokes — 작명소의 원획과 다를 수 있다) */
  strokeCount: number;
  /** 음양 陽·陰 — 획수 홀짝(홀수 陽) */
  yinYang: string;
  /** 먼저 보여 드리는 글자 — 사이트가 이름 글자로 꼽아 둔 목록(사용 통계가 아니다). 성씨 글자에는 늘 false */
  common: boolean;
  /** 이름에 피하는 글자(불용) — 계산은 하되 화면이 표시한다. 성씨 글자에는 늘 false */
  forbidden: boolean;
  /** 사전에 뜻 풀이(한글 훈)가 있는가 */
  hasMeaning: boolean;
  /** CJK 기본 영역(U+4E00~9FFF)인가 — 거짓이면 '확장 한자'(기기에 따라 안 보일 수 있다) */
  basic: boolean;
}

/** 이름 글자의 자원오행이 맡는 역할 — 조화 점수의 자원오행 보완이 쓴 조건 그대로(백엔드 ElementFit.RolesOf) */
export type HanjaFill = "yongshin" | "heeshin" | "gishin" | "lacking" | "excessive";

/** default = 기본으로 두는 성씨 한자(대표 한자 표) · user = 고른 한자(한 글자라도) · estimated = 표에 없는 성씨라 독음으로 추정 */
export type SurnameHanjaSource = "default" | "user" | "estimated";

/** user = 고른 한자 · auto = 자동으로 고른 한자 · none = 사용자가 한자 없이 둠 · unavailable = 자동인데 쓸 수 있는 인명용 한자가 없는 음절 */
export type SyllableHanjaSource = "user" | "auto" | "none" | "unavailable";

/** 출생일로만 정해지는 오행 쪽 사정(한자와 무관) — 조화 점수가 쓴 값 그대로 */
export interface ElementFit {
  /** 용신·희신·기신 오행 — 용신을 구하지 못했으면 세 값이 null */
  yongshin: string | null;
  heeshin: string | null;
  gishin: string | null;
  /** 사주에 부족한 오행(개수가 평균 미만 — /ohaeng 의 '없는 오행'(0개)보다 넓다) */
  lacking: string[];
  /** 사주에 많은 오행(개수가 평균의 1.5배 초과) */
  excessive: string[];
  /** 사주 글자의 오행 개수(출생 시각이 없으면 여섯 글자) */
  counts: Record<string, number>;
}

/** 성씨 한자 — 수리(81수리)의 성씨 획수에만 쓰인다 */
export interface SurnameHanja {
  /** 성씨 한글(앞뒤 공백을 뗀 값) */
  hangul: string;
  source: SurnameHanjaSource;
  /** 수리에 쓴 성씨 획수(복성은 합). 정하지 못하면 0 */
  strokes: number;
  /** 성씨 글자마다 한 항목. 한 글자라도 정하지 못하면 빈 목록. forbidden·common 은 늘 false — 화면은 훈도 그리지 않는다 */
  chars: HanjaFact[];
}

/** 이름 음절 하나의 한자 */
export interface SyllableHanja {
  syllable: string;
  source: SyllableHanjaSource;
  /** 출생일이 없거나 한자가 없으면 빈 목록 */
  fills: HanjaFill[];
  /** 계산에 쓴 한자 — none·unavailable 이면 null */
  hanja: HanjaFact | null;
}

/**
 * /evaluate 응답의 '이 이름의 한자' — 성씨·음절마다 계산에 쓴 한자와 출처, 용신·부족 오행 역할.
 * 한자를 지정하지 않은 요청에도 실린다(userHanja false). 이름이나 성씨가 한글 음절만이 아니면 응답에서 null 이다.
 */
export interface HanjaSummary {
  /** 사용자가 한자를 정한 요청인가(이름 칸을 고르거나 비웠거나, 성씨 한자를 골랐다) */
  userHanja: boolean;
  /** 서버가 받아들인 이름 한자의 정규 꼴(전체 길이 — 칸마다 통합 한자 / `*` / `-`). 지정이 없으면 "" */
  nameHanja: string;
  /** 서버가 받아들인 성씨 한자의 정규 꼴 — 지정이 없으면(대표 한자와 같은 글자 포함) "" */
  lastNameHanja: string;
  surname: SurnameHanja;
  syllables: SyllableHanja[];
  /** 출생일이 없으면 null */
  elementFit: ElementFit | null;
}

/** POST /api/v1/hanja/resolve 요청 — 글자 한 자의 판정. text 에는 뽑은 한자 한 코드포인트만 싣는다(붙여 넣은 원문을 보내지 않는다) */
export interface HanjaResolveRequest {
  text: string;
  /** 넣으려는 칸의 음절(한글 음절 한 글자). 비우면 독음 판정 없이 글자만 찾는다 */
  syllable?: string;
  /** "surname" 이면 성씨 칸의 판정 — 안내 문장이 성씨용이고 forbidden·common 이 늘 false 다. 그 밖·생략은 이름 칸 */
  target?: "name" | "surname";
}

export type HanjaResolveStatus = "ok" | "reading_mismatch" | "not_in_dictionary" | "not_hanja";

/** POST /api/v1/hanja/resolve 응답 — 조회라서 판정 결과는 모두 200 이다 */
export interface HanjaResolveResponse {
  status: HanjaResolveStatus;
  /** 정리·정규화한 글자(통합 한자). 한자가 아니면 null */
  character: string | null;
  /** 사전 항목 — 사전에 없으면 null */
  hanja: HanjaFact | null;
  /** 이 글자를 넣을 수 있는 음절(지정 독음과 그 두음 꼴) */
  acceptedSyllables: string[];
  /** ok 가 아닐 때의 안내 문장(화면이 그대로 띄운다) */
  message: string | null;
  /** 사전에 없는 글자에 권하는, 꼴만 다른 등재 글자(없으면 null) */
  suggestion: HanjaFact | null;
}

export interface AestheticBreakdown {
  pronunciation: number;
  rhythm: number;
  syllable: number;
  neutrality: number;
  meaning: number;
  genderBonus: number;
  toneBonus: number;
  penalty: number;
  total: number;
  notes: string[];
}

export interface HarmonyBreakdown {
  /** 자원오행 보완 30 — 배정 한자의 부수 기준 자원오행 ↔ 사주 용신·부족/과다 오행 (필드명은 호환으로 유지) */
  fiveElement: number;
  /** 획수 조화 20 — 이름 두 글자 획수 합의 구간, 오행 무관 (옛 화면 이름 '자원오행', 필드명은 호환으로 유지) */
  resourceElement: number;
  yinYang: number;
  pronunciationElement: number;
  suriSagyeok: number;
  surnameHarmony: number; // deprecated, always 0
  genderBonus: number;
  total: number;
  usedFallback: boolean;
  notes: string[];
}

export interface HanjaCandidate {
  character: string;
  reading: string;
  meaning: string;
  fiveElement?: string;
  yinYang?: string;
  strokeCount?: number;
  /** 강희획수 (원획법, 사주/작명학 기준) */
  kangxiStrokes?: number;
  /**
   * 자원오행 판정 등급 (2026-10-22 S4 백엔드 추가 — data/hanja_resource_element.json g):
   * - R = 확정 · V = 이견 있음 · X = 예외 적용 · U = 미상
   * 화면은 components/design/resource-grade.ts toResourceGrade 로 거른다(옛 백엔드면 필드가 없다).
   */
  resourceGrade?: string;
  /** V 등급의 이유(v_reasons — 2026-10-22 S7 백엔드 추가). '자료 적음'·'추정' 배지 판정용(gradeBadgeKey). 옛 백엔드면 없다 */
  vReasons?: string[];
  /**
   * @deprecated 옛 뜻 기반 판정 등급(S/C/D) — S4 부터 fiveElement(부수 기준)와 무관하다. 화면은 읽지 않는다(백엔드가 S7 뒤 뺀다).
   */
  confidenceGrade?: string;
  /** 자원오행 판정 근거 한 줄(부수 근거 — 예: "手·扌(손 수) 부수 → 木") */
  rationale?: string;
  /**
   * 이 글자를 그 음절 칸의 한자로 골랐을 때의 글자 사실(2026-11 한자 입력) — hanjaSummary·음절 후보 파일과 같은 꼴·같은 값.
   * 후보 표의 '이 글자로'가 고른 글자를 응답을 기다리는 동안 그대로 그리는 데 쓴다. 옛 백엔드면 없다
   */
  fact?: HanjaFact | null;
}

export interface HanjaSyllable {
  syllable: string;
  candidates: HanjaCandidate[];
}

export type GenerationFitLevel =
  | "timeless"
  | "perfect"
  | "mild_mismatch"
  | "strong_mismatch";

export interface GenerationFit {
  fitLevel: GenerationFitLevel;
  /** "younger"(또래보다 젊은) | "older"(예스러운) | ""(방향 없음) */
  direction: "younger" | "older" | "";
  /** 칩용 짧은 라벨 (예: "또래보다 젊은 느낌") */
  headline: string;
  /** 전체 설명 문장 */
  description: string;
  /** 유행 연대 (예: "2010년대") */
  peakDecade: string | null;
}

export interface NameEvaluationResponse {
  fullName: string;
  aestheticScore: number;
  harmonyScore: number;
  rarityScore: number;
  finalScore: number;
  /** 출생일 입력 여부. false면 사주 조화 미산정 — 종합=미학, 조화 섹션은 안내로 대체. */
  birthDateProvided?: boolean;
  aesthetic: AestheticBreakdown;
  harmony: HarmonyBreakdown;
  hanjaCandidates: HanjaSyllable[];
  /**
   * 이 이름의 한자(2026-11 한자 입력) — 한자를 지정하지 않은 요청에도 실린다. 이름·성씨가 한글 음절만이 아니면 null,
   * 옛 백엔드(배포 순서가 어긋난 동안)면 필드가 없다 — 어느 쪽이든 화면은 블록을 그리지 않는다
   */
  hanjaSummary?: HanjaSummary | null;
  summary: string;
  strengths: string[];
  cautions: string[];
  pronunciationNote: string;
  meaningNote: string;
  toneReason: string;
  /** 세대 감각 — unknown/미제공 시 null */
  generationFit?: GenerationFit | null;
  usedFallbackHanja: boolean;
}

// ============================================================
// Company Naming (상호 — 회사명 · 가게명 · 브랜드명)
//
// 인명 추천과 계약이 다르다: 성씨·생년월일이 없고, 점수도
// 미학/조화가 아니라 기억성·발음·식별력·업종적합 4축이다.
// ============================================================
export interface CompanyNamingRequest {
  /** 업종 코드 (예: "cafe", "it") — 필수 */
  industry: string;
  /** 담고 싶은 키워드 0~3개 */
  keywords?: string[];
  /** "modern" | "classic" | "warm" | "premium" | "playful" */
  tone?: string;
  /** "all" | "hanja" | "pure-korean" | "english" */
  style?: string;
  /** 선호 음절 수 (0 = 무관, 2~4) */
  syllables?: number;
  /** 추천 개수 (1~50) */
  count?: number;
}

/** 상호 구성 요소 (한자 1자 / 순우리말 어근 / 라틴 어근) */
export interface CompanyNamePart {
  symbol: string;
  reading: string;
  meaning: string;
}

export interface CompanyNameCandidate {
  /** 상호 (한글 표기) */
  name: string;
  /** "hanja" | "pure-korean" | "english" */
  style: string;
  /** 생성 축 한글 라벨 */
  styleLabel: string;
  /** 한자 표기 — 한자형만, 그 외 null */
  hanja: string | null;
  parts: CompanyNamePart[];
  /** 뜻 한 줄 */
  meaning: string;
  /** 로마자/영문 표기 */
  romanization: string;
  /** 상호 사용 예시 (예: "온담 카페") */
  usageExamples: string[];
  /** 총점 0~100 */
  totalScore: number;
  /** 기억성 0~30 */
  memorability: number;
  /** 발음 0~25 */
  pronunciation: number;
  /** 식별력 0~25 — 상표 등록 가능성·검색 노출의 기반 */
  distinctiveness: number;
  /** 업종 적합 0~20 */
  industryFit: number;
  reasons: string[];
  /** 주의사항 — 없으면 빈 배열 */
  cautions: string[];
}

export interface CompanyNamingResponse {
  industry: string;
  industryLabel: string;
  /** 상호 뒤에 붙는 말 (사용 예시에 쓰인 것) */
  industrySuffixes: string[];
  /** 입력한 키워드에 대한 안내 — 업종 일반어·클리셰를 넣었을 때 이유를 알려준다 */
  keywordNotices: string[];
  candidates: CompanyNameCandidate[];
  totalCount: number;
}

/** 코드 + 라벨 쌍 */
export interface CompanyOption {
  key: string;
  label: string;
}

export interface CompanyNamingOptions {
  industries: CompanyOption[];
  tones: CompanyOption[];
  styles: CompanyOption[];
}
