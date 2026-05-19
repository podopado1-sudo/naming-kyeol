import type {
  SmartRecommendationRequest,
  SmartRecommendationResponse,
  PureKoreanRequest,
  CreativeNamingRequest,
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
  NicknameRequest,
  NicknameResponse,
  NameRecommendationResponse,
  NameEvaluationRequest,
  NameEvaluationResponse,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

async function request<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API 오류 (${res.status}): ${text || res.statusText}`
    );
  }

  return res.json() as Promise<T>;
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

// 창의적 작명
export function creative(
  req: CreativeNamingRequest
): Promise<NameRecommendationResponse> {
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
): Promise<NameRecommendationResponse> {
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

// 별명 생성
export function nickname(req: NicknameRequest): Promise<NicknameResponse> {
  return request("/recommendations/nickname", req);
}

// 이름 상세 평가
export function evaluate(
  req: NameEvaluationRequest
): Promise<NameEvaluationResponse> {
  return request("/recommendations/evaluate", req);
}
