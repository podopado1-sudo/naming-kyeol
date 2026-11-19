import type {
  SmartRecommendationRequest,
  SmartRecommendationResponse,
  PureKoreanRequest,
  CreativeNamingRequest,
  CreativeCandidate,
  ThreeSyllableRequest,
  RequiredCharRequest,
  ParentBasedRequest,
  ParentBasedCandidate,
  TwinNamesRequest,
  TwinNameResponse,
  DualNameRequest,
  DualNameCandidate,
  NameAnalysisRequest,
  NameAnalysisResponse,
  RareSurnameRequest,
  RareSurnameResponse,
  NameRecommendationResponse,
  NameEvaluationRequest,
  NameEvaluationResponse,
  CompanyNamingRequest,
  CompanyNamingResponse,
  CompanyNamingOptions,
  RequiredCharCandidate,
  SajuElementsRequest,
  SajuElementsResponse,
  HanjaResolveRequest,
  HanjaResolveResponse,
} from "./types";
import { josa, type JosaPair } from "./josa";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

/**
 * 요청 한도 — Render Free 콜드스타트(15분 idle 뒤 첫 요청 30초 안팎)는 덮고, 무한 대기는 끊는다.
 * 이전에는 타임아웃이 없어 서버가 응답하지 않으면 '평가 중...'이 끝없이 떠 있었다(감사 UX-1).
 */
const REQUEST_TIMEOUT_MS = 60_000;

const TIMEOUT_MESSAGE =
  "1분 넘게 응답이 없어요. 서버가 쉬고 있다가 깨어나는 중일 수 있으니 잠시 후 다시 시도해 주세요.";
const NETWORK_MESSAGE =
  "서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
const BAD_RESPONSE_MESSAGE =
  "응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.";
const RATE_LIMIT_MESSAGE =
  "요청이 잠시 몰렸어요. 1분쯤 뒤에 다시 시도해 주세요.";
const SERVER_ERROR_MESSAGE =
  "서버에서 잠시 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
const BAD_REQUEST_MESSAGE =
  "요청을 처리하지 못했어요. 입력한 내용을 확인하고 다시 시도해 주세요.";

/**
 * 400 본문이 가리키는 자리 — 한자 입력 검증(POST /recommendations/evaluate 의 nameHanja·lastNameHanja)이
 * { error, code, target, slot } 으로 싣는다(2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §4-4).
 */
export interface ApiErrorDetail {
  /** name_not_hangul · name_hanja_count · surname_hanja_count · surname_none · not_hanja · not_in_dictionary · reading_mismatch */
  code?: string;
  /** 이름 칸 쪽인가 성씨 칸 쪽인가 */
  target?: "name" | "surname";
  /** 문제가 난 칸(0부터). -1 이면 칸 하나의 문제가 아니다(한글 검사·글자 수) — 화면은 칸을 열지 않고 문장만 띄운다 */
  slot?: number;
}

/**
 * 화면에 그대로 띄울 수 있는 문장을 담은 API 오류. status 0 = 응답 없음(연결 실패·시간 초과).
 * code·target·slot 은 400 본문에 그 값이 있을 때만 실린다 — 화면이 틀린 칸을 열고 aria-invalid 를 거는 데 쓴다.
 * 없는 응답(다른 엔드포인트·프레임워크의 ProblemDetails)에서는 셋 다 undefined 이고, 기존 `catch (err) { err.message }` 는 그대로 돈다.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly target?: "name" | "surname";
  readonly slot?: number;

  constructor(message: string, status: number, detail: ApiErrorDetail = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = detail.code;
    this.target = detail.target;
    this.slot = detail.slot;
  }
}

/** 400 본문에서 code·target·slot 을 읽는다. 다른 상태·JSON 이 아닌 본문·값의 꼴이 다르면 싣지 않는다 */
function detailFor(status: number, body: string): ApiErrorDetail {
  if (status !== 400) return {};
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object") return {};
    const { code, target, slot } = parsed as { code?: unknown; target?: unknown; slot?: unknown };
    const detail: ApiErrorDetail = {};
    if (typeof code === "string" && code) detail.code = code;
    if (target === "name" || target === "surname") detail.target = target;
    if (typeof slot === "number" && Number.isInteger(slot)) detail.slot = slot;
    return detail;
  } catch {
    return {};
  }
}

/**
 * 오류 응답에서 사람에게 보여 줄 한 문장만 고른다 — 원문 JSON을 토스트에 그대로 띄우던 것 대체(감사 UX-1).
 * - 429(레이트 리미터): 본문과 무관하게 전용 문구
 * - 5xx: 예외 메시지가 섞여 있을 수 있어 본문을 쓰지 않는다
 * - 컨트롤러 검증 { error: "..." } → 그 문장
 * - 모델 검증 ProblemDetails { errors: { LastName: ["성씨는 1~2자여야 합니다."] } } → 첫 메시지
 * 한글이 없는 메시지(프레임워크 기본 영문)는 일반 문구로 바꾼다.
 * 영문 필드명으로 시작하는 문장("BirthDate는 …")은 필드명을 한글로 바꾸고, 표에 없는 필드면 일반 문구로.
 */
function messageFor(status: number, body: string): string {
  if (status === 429) return RATE_LIMIT_MESSAGE;
  if (status >= 500) return SERVER_ERROR_MESSAGE;

  const readable = (v: unknown): string | null =>
    typeof v === "string" && /[가-힣]/.test(v)
      ? localizeLeadingField(v.trim())
      : null;

  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      const { error, errors } = parsed as { error?: unknown; errors?: unknown };
      const direct = readable(error);
      if (direct) return direct;
      if (errors && typeof errors === "object") {
        for (const v of Object.values(errors as Record<string, unknown>)) {
          const first = readable(Array.isArray(v) ? v[0] : v);
          if (first) return first;
        }
      }
    }
  } catch {
    // JSON이 아닌 본문 — 일반 문구로
  }
  return BAD_REQUEST_MESSAGE;
}

/**
 * 컨트롤러 검증 문구 앞의 영문 필드명 → 화면에 보일 한글 이름. 키는 소문자.
 * 예전에는 'BirthDate는 YYYY-MM-DD 형식이어야 합니다.'가 토스트에 그대로 떴다(2026-10-21 검토 FE-EVAL-7).
 * 근본 수정은 백엔드 문구를 한글 필드명으로 바꾸는 것 — 그때까지의 표다.
 */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  birthdate: "생년월일",
  birthtime: "출생 시각",
  lastname: "성",
  name: "이름",
  firstname: "이름",
  gender: "성별",
  tone: "톤",
  preferredenglishname: "영어 이름",
  keywords: "키워드",
  industry: "업종",
  count: "개수",
  // /saju/elements(부족한 오행 찾기) — 백엔드 문구는 한국어로 시작하지만 프레임워크 기본 문구가 필드명으로 시작할 때를 대비
  birthplacecode: "출생지",
  // /recommendations/evaluate 의 한자 필드(2026-11) — 같은 대비
  namehanja: "이름 한자",
  lastnamehanja: "성씨 한자",
};

/** 영문 필드명 뒤 조사 → 한글 이름 받침에 맞춰 다시 고를 짝 */
const JOSA_OF: Readonly<Record<string, JosaPair>> = {
  은: "은/는",
  는: "은/는",
  이: "이/가",
  가: "이/가",
  을: "을/를",
  를: "을/를",
  과: "과/와",
  와: "과/와",
  으로: "으로/로",
  로: "으로/로",
};

const LEADING_FIELD_RE = /^([A-Za-z]+)(으로|[은는이가을를과와로])?/;

/**
 * "BirthDate는 …" → "생년월일은 …". 영문으로 시작하지 않으면 그대로,
 * 표에 없는 영문 필드명(NameType·RecommendationId 등)으로 시작하면 null(→ 일반 문구).
 */
function localizeLeadingField(message: string): string | null {
  const m = LEADING_FIELD_RE.exec(message);
  if (!m) return message;
  const label = FIELD_LABELS[m[1].toLowerCase()];
  if (!label) return null;
  const particle = m[2] ? josa(label, JOSA_OF[m[2]]) : "";
  return label + particle + message.slice(m[0].length);
}

async function send<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(messageFor(res.status, text), res.status, detailFor(res.status, text));
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (controller.signal.aborted) throw new ApiError(TIMEOUT_MESSAGE, 0);
    if (err instanceof SyntaxError) throw new ApiError(BAD_RESPONSE_MESSAGE, 0);
    throw new ApiError(NETWORK_MESSAGE, 0);
  } finally {
    clearTimeout(timer);
  }
}

function request<T>(endpoint: string, body: unknown): Promise<T> {
  return send<T>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function get<T>(endpoint: string): Promise<T> {
  return send<T>(endpoint);
}

// Smart Router - 통합 추천
export function smart(
  req: SmartRecommendationRequest
): Promise<SmartRecommendationResponse> {
  return request("/recommendations/smart", req);
}

// 순우리말 이름
export function pureKorean(
  req: PureKoreanRequest
): Promise<NameRecommendationResponse> {
  return request("/recommendations/pure-korean", req);
}

// 창의적 작명 — CreativeCandidate[] 직접 반환 (parent-based와 동일 계약)
export function creative(
  req: CreativeNamingRequest
): Promise<CreativeCandidate[]> {
  return request("/recommendations/creative", req);
}

// 3글자 이름
export function threeSyllable(
  req: ThreeSyllableRequest
): Promise<NameRecommendationResponse> {
  return request("/recommendations/three-syllable", req);
}

// 필수 글자 포함
export function requiredChar(
  req: RequiredCharRequest
): Promise<RequiredCharCandidate[]> {
  return request("/recommendations/required-char", req);
}

// 부모 이름 기반 — ParentBasedCandidate[] 직접 반환
export function parentBased(
  req: ParentBasedRequest
): Promise<ParentBasedCandidate[]> {
  return request("/recommendations/parent-based", req);
}

// 쌍둥이 이름 — 세트 단위 응답 (공유글자/공유의미/공유톤)
export function twinNames(
  req: TwinNamesRequest
): Promise<TwinNameResponse> {
  return request("/twin-names", req);
}

// 영어+한자 듀얼 이름 — DualNameCandidate[] 직접 반환
export function dualName(
  req: DualNameRequest
): Promise<DualNameCandidate[]> {
  return request("/recommendations/dual-name", req);
}

// 이름 분석
export function nameAnalysis(
  req: NameAnalysisRequest
): Promise<NameAnalysisResponse> {
  return request("/name-analysis", req);
}

// 특이 성씨 — PhoneticAnalysis + HanjaOptions 포함 별도 응답
export function rareSurname(
  req: RareSurnameRequest
): Promise<RareSurnameResponse> {
  return request("/recommendations/rare-surname", req);
}

// 이름 상세 평가
export function evaluate(
  req: NameEvaluationRequest
): Promise<NameEvaluationResponse> {
  return request("/recommendations/evaluate", req);
}

/**
 * 부족한 오행 찾기(/ohaeng) — 생년월일(+시각·출생지)로 사주 원국 오행 개수·없는 오행·용신·희신·오행별 이름 한자 예.
 * 입력값은 요청 본문으로만 보낸다(URL·저장소에 두지 않는다 — tests/ohaeng-privacy.test.mjs). 백엔드도 DB·서버 로그에 남기지 않는다.
 * 'expensive' 리미터(IP당 분 20회)를 평가·추천과 함께 쓴다.
 */
export function sajuElements(
  req: SajuElementsRequest
): Promise<SajuElementsResponse> {
  return request("/saju/elements", req);
}

/**
 * 한자 한 글자의 판정(/evaluate 고르기 패널의 직접 입력) — 후보 목록에 없는 글자가 왜 안 되는지(독음 불일치 · 이 사이트 사전에 없음 · 한자가 아님).
 * 판정 결과는 모두 200 이고 화면은 `message` 를 칸 아래 안내로 쓴다(오류 띠가 아니다).
 * - `text` 에는 **뽑은 한자 한 코드포인트만** 싣는다(lib/hanja-pick.ts firstHanCodePoint) — 붙여 넣은 원문을 보내지 않는다.
 * - 성씨 패널은 `target: "surname"` 으로 부른다(문장이 성씨용이고 이름용 표시가 빠진다).
 * - 평가·추천의 'expensive' 리미터(분 20회)와 따로, 전역 리미터(분 60회)만 받는다. 5초에서 기다리기를 끝내는 것은 패널이 한다(이 모듈의 60초 한도는 그대로).
 */
export function hanjaResolve(
  req: HanjaResolveRequest
): Promise<HanjaResolveResponse> {
  return request("/hanja/resolve", req);
}

// 상호 작명 (회사명 · 가게명 · 브랜드명)
export function companyNames(
  req: CompanyNamingRequest
): Promise<CompanyNamingResponse> {
  return request("/company-names", req);
}

// 상호 작명 입력 옵션 — 업종·톤 목록을 백엔드 데이터와 한 곳에서 맞춘다
export function companyOptions(): Promise<CompanyNamingOptions> {
  return get("/company-names/options");
}

/**
 * 백엔드 미리 깨우기 (fire-and-forget, 실패 무시) — Render Free는 15분 쉬면 잠들어 첫 요청이
 * 30초 안팎 걸린다. 사용자가 폼을 채우는 동안 깨워 두면 콜드스타트가 거의 드러나지 않는다.
 * ⚠️ company-names/options를 쓴다: 전역 리미터(IP당 분당 60회)만 걸리고 사용량 집계도 하지 않는다.
 * /recommendations/* 는 컨트롤러 단위 "expensive" 리미터(분당 20회)라 hanja-stats로 깨우면
 * 평가·추천 한도를 함께 깎는다(감사 UX-1 정정).
 */
export function warmUpApi(): void {
  if (typeof window === "undefined") return;
  fetch(`${API_BASE}/company-names/options`, { cache: "no-store" }).catch(
    () => {}
  );
}

// 탭 클릭 이벤트 (fire-and-forget, 실패 무시)
// ⚠️ sendBeacon 금지: 크로스 오리진 + application/json Blob 조합은 Chrome이
// true를 반환하고도 전송을 조용히 버린다 (2026-09-14 실측: 365일 적재 0행,
// beacon은 preflight조차 안 나감 — fetch keepalive는 204 + DB 적재 확인)
export function trackTabView(key: string): void {
  if (typeof window === "undefined") return;
  fetch(`${API_BASE}/usage/event`, {
    method: "POST",
    body: JSON.stringify({ eventType: "tab_view", key }),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}
