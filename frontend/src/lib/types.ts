// ============================================================
// Smart Router (통합 추천)
// ============================================================
export interface SmartRecommendationRequest {
  lastName: string;
  birthDate?: string;
  /** 출생 시각 (HH:mm, 선택) — 사주 시주(時柱) 계산에 사용 */
  birthTime?: string;
  gender?: string;
  tone?: string;
  fatherSurname?: string;
  motherSurname?: string;
  fatherName?: string;
  motherName?: string;
  includePureKorean?: boolean;
  includeThreeSyllable?: boolean;
  includeCreative?: boolean;
  includeTwin?: boolean;
  includeParentBased?: boolean;
  includeDualName?: boolean;
  includeRequiredChar?: boolean;
  requiredChar?: string;
  requiredCharPosition?: string;
  /** 항렬자(한자 1글자, 선택) — 형제자매 공유 한자 */
  requiredHanja?: string;
  englishName?: string;
  count?: number;
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
  /** 성별 안내 라벨 — 요청 성별과 반대로 기우는 이름일 때만 (예: "주로 여아 이름"). */
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
  birthDate?: string;
  /** 출생 시각 (HH:mm, 선택) */
  birthTime?: string;
  gender?: string;
  tone?: string;
  count?: number;
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
  /** 이름 부분 (성씨 제외) */
  name: string;
  /** 작명 모델 (예: "윤고은모델", "문소리모델", "신해솜모델", "이수지-박지수모델") */
  namingModel: string;
  /** 이름 분류 — "의미중심" 또는 "음운중심" */
  nameType: string;
  /** 생성 방식 설명 */
  description: string;
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
  /** 한자 문자 목록 (예: ["筆", "立"]) */
  hanjaCharacters: string[];
  /** 한자 의미 조합 — 사전 충실형 (예: "붓 필 + 설 립") */
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
  fiveElement: string;
  yinYang: string;
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
  yongshin?: YongshinData;
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
// Nickname
// ============================================================
export interface NicknameRequest {
  lastName: string;
  firstName: string;
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

export interface NameAnalysisResponse {
  fullName: string;
  aestheticScore?: number;
  harmonyScore?: number;
  finalScore?: number;
  strengths?: string[];
  weaknesses?: string[];
  hanja?: {
    character: string;
    meaning: string;
    reading: string;
    fiveElement?: string;
    strokeCount?: number;
  }[];
  saju?: SajuChartData;
  eumryeongAnalysis?: EumryeongAnalysis;
}

export interface NicknameResponse {
  nicknames: string[];
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
  fiveElement: number;
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
   * 오행 판정 신뢰도 (백엔드 정렬 — 4종):
   * - S = 검수완료
   * - A = 규칙기반
   * - B = 수동입력
   * - D = 획수자동
   */
  confidenceGrade?: "S" | "A" | "B" | "D";
  /** 오행 판정 근거 (S등급에 주로 존재) */
  rationale?: string;
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
  aesthetic: AestheticBreakdown;
  harmony: HarmonyBreakdown;
  hanjaCandidates: HanjaSyllable[];
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
