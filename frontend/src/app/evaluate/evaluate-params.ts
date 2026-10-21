/**
 * /evaluate 입력의 단일 꼴 — URL 쿼리·입력 폼·저장·공유 링크가 모두 EvalInput으로 맞춘다.
 *
 * gender·tone은 API 값(male/female/none, soft/strong/neutral)으로 정규화한다. 없으면 none·neutral —
 * 홈 Hero는 성별 '상관없음'(기본값)일 때 gender를 아예 붙이지 않는데, 예전 자동 평가는 다섯 값이
 * 모두 있어야 돌아서 홈에서 넘어온 사용자 상당수가 같은 입력을 폼에 다시 내야 했다(감사 EV-6).
 */
import type {
  EvalSubmitPayload,
  InitialSeed,
} from "@/components/design/EvaluateInput";

export interface EvalInput {
  lastName: string;
  name: string;
  /** YYYY-MM-DD, "" = 미입력 (조화 점수 미산정) */
  birthDate: string;
  /** HH:mm, "" = 미입력 */
  birthTime: string;
  gender: "male" | "female" | "none";
  tone: "soft" | "strong" | "neutral";
}

export function normalizeGender(v: string | null | undefined): EvalInput["gender"] {
  return v === "male" || v === "female" ? v : "none";
}

export function normalizeTone(v: string | null | undefined): EvalInput["tone"] {
  return v === "soft" || v === "strong" ? v : "neutral";
}

/**
 * 출생 시각은 생년월일과 함께일 때만 뜻이 있다 — 날짜 없이 시각만 오면 비운다.
 * evaluateHref도 날짜가 있을 때만 시각을 쓰므로, 여기서 비우지 않으면 입력 서명(시각 포함)과
 * 우리가 쓴 URL(시각 없음)이 어긋나 같은 평가가 두 번 돌았다(결과 깜빡임·사용량 2회, 2026-10-21 검토).
 * URL(inputFromParams)·폼 제출(inputFromPayload)·폼 시드(seedFromParams)가 모두 이 규칙을 거친다
 * (frontend/tests/evaluate-params.test.mjs 가 왕복 서명을 지킨다).
 */
function timeWithDate(birthDate: string, birthTime: string): string {
  return birthDate ? birthTime : "";
}

export function inputFromParams(p: URLSearchParams): EvalInput {
  const birthDate = (p.get("birthDate") ?? "").trim();
  return {
    lastName: (p.get("lastName") ?? "").trim(),
    name: (p.get("name") ?? "").trim(),
    birthDate,
    birthTime: timeWithDate(birthDate, (p.get("birthTime") ?? "").trim()),
    gender: normalizeGender(p.get("gender")),
    tone: normalizeTone(p.get("tone")),
  };
}

export function inputFromPayload(p: EvalSubmitPayload): EvalInput {
  const birthDate = p.birth.trim();
  return {
    lastName: p.lastName.trim(),
    name: p.firstName.trim(),
    birthDate,
    birthTime: timeWithDate(birthDate, (p.birthTime ?? "").trim()),
    gender: p.gender === "남" ? "male" : p.gender === "여" ? "female" : "none",
    tone: p.tone === "부드러운" ? "soft" : p.tone === "강한" ? "strong" : "neutral",
  };
}

/** 같은 평가인지 가르는 키 — 링크 표기(파라미터 순서·기본값 생략)와 무관하다 */
export function inputSignature(i: EvalInput): string {
  return [i.lastName, i.name, i.birthDate, i.birthTime, i.gender, i.tone].join("|");
}

/** 자동 평가 조건 — 성과 이름만 있으면 된다(출생일·성별·톤은 선택, API가 허용) */
export function canAutoEvaluate(i: EvalInput): boolean {
  return i.lastName !== "" && i.name !== "";
}

/**
 * /evaluate 링크. withBirth=false면 생년월일·출생 시각을 뺀다 — 공유 링크 기본값
 * (아이 생년월일이 메신저로 퍼지지 않게, 감사 EV-7). 기본값(none·neutral)은 생략해 짧게 둔다.
 */
export function evaluateHref(i: EvalInput, { withBirth }: { withBirth: boolean }): string {
  const params = new URLSearchParams();
  params.set("lastName", i.lastName);
  params.set("name", i.name);
  if (withBirth && i.birthDate) params.set("birthDate", i.birthDate);
  if (withBirth && i.birthDate && i.birthTime) params.set("birthTime", i.birthTime);
  if (i.gender !== "none") params.set("gender", i.gender);
  if (i.tone !== "neutral") params.set("tone", i.tone);
  return `/evaluate?${params.toString()}`;
}

/**
 * 같은 조건으로 /search 추천 — /search는 생년월일이 필수라 있을 때만 autoStart로 바로 돌린다
 * (없으면 성씨만 채운 폼으로 연다).
 */
export function similarSearchHref(i: EvalInput): string {
  const params = new URLSearchParams();
  params.set("lastName", i.lastName);
  if (i.birthDate) params.set("birthDate", i.birthDate);
  if (i.birthDate && i.birthTime) params.set("birthTime", i.birthTime);
  if (i.gender !== "none") params.set("gender", i.gender);
  if (i.tone !== "neutral") params.set("tone", i.tone);
  if (i.birthDate) params.set("autoStart", "1");
  return `/search?${params.toString()}`;
}

/** URL 파라미터(영문) → 폼 초기값(한글). 없는 성별·톤은 ""(미선택)로 둔다. */
export function seedFromParams(p: URLSearchParams): InitialSeed {
  const g = p.get("gender");
  const t = p.get("tone");
  const birth = (p.get("birthDate") ?? "").trim();
  return {
    lastName: (p.get("lastName") ?? "").trim(),
    firstName: (p.get("name") ?? "").trim(),
    birth,
    birthTime: timeWithDate(birth, (p.get("birthTime") ?? "").trim()),
    gender: g === "male" ? "남" : g === "female" ? "여" : g === "none" ? "중립" : "",
    tone: t === "soft" ? "부드러운" : t === "strong" ? "강한" : t === "neutral" ? "중립" : "",
  };
}

/** 평가했던 입력 → 폼 초기값 ('다른 이름 평가하기'에서 성·출생일·성별·톤을 이어 쓴다) */
export function seedFromInput(i: EvalInput): InitialSeed {
  return {
    lastName: i.lastName,
    firstName: i.name,
    birth: i.birthDate,
    birthTime: i.birthTime,
    gender: i.gender === "male" ? "남" : i.gender === "female" ? "여" : "중립",
    tone: i.tone === "soft" ? "부드러운" : i.tone === "strong" ? "강한" : "중립",
  };
}
