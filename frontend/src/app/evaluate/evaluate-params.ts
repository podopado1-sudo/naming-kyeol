/**
 * /evaluate 입력의 단일 꼴 — URL 쿼리·입력 폼·저장·공유 링크가 모두 EvalInput으로 맞춘다.
 *
 * gender·tone은 API 값(male/female/none, soft/strong/neutral)으로 정규화한다. 없으면 none·neutral —
 * 홈 Hero는 성별 '상관없음'(기본값)일 때 gender를 아예 붙이지 않는데, 예전 자동 평가는 다섯 값이
 * 모두 있어야 돌아서 홈에서 넘어온 사용자 상당수가 같은 입력을 폼에 다시 내야 했다(감사 EV-6).
 *
 * 한자(2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §10-1): 고른 이름 한자·성씨 한자를 **주소 꼴**로 싣는다
 * (통합 한자, 칸마다 한 글자 / `*` 자동 / `-` 한자 없이, 끝의 `*` 생략 — `hanja=瑞` 는 둘째 칸 자동, `hanja=*潤`, `hanja=瑞-`).
 * 지정이 없으면 "" 이고 주소에 쓰지 않는다 — 한자 없는 링크는 예전과 글자 그대로 같다. 정리 규칙은 lib/hanja-pick.ts canonicalHanja.
 */
import type {
  EvalSubmitPayload,
  InitialSeed,
} from "@/components/design/EvaluateInput";
// node --test 가 이 파일을 바로 읽는다 — 값 import 는 별칭(@/) 대신 상대 경로로 쓴다(tests/resolve-ts.mjs 가 확장자를 붙여 찾는다)
import { canonicalHanja, isHangulSyllables } from "../../lib/hanja-pick";
import { nameInputProblem, SURNAME_MAX_LENGTH } from "../../lib/name-input";

/** 이름 칸 글자 수 — 서버 NameEvaluateRequestDto.Name 1~10자(입력 폼 EvaluateInput 의 NAME_MAX_LENGTH 와 같다) */
export const EVAL_NAME_MAX_LENGTH = 10;

export interface EvalInput {
  lastName: string;
  name: string;
  /** YYYY-MM-DD, "" = 미입력 (조화 점수 미산정) */
  birthDate: string;
  /** HH:mm, "" = 미입력 */
  birthTime: string;
  gender: "male" | "female" | "none";
  tone: "soft" | "strong" | "neutral";
  /** 고른 이름 한자 — 주소 꼴. "" = 지정 없음(전부 자동) */
  hanja: string;
  /** 고른 성씨 한자 — 주소 꼴(`-` 없음). "" = 지정 없음(기본으로 두는 한자) */
  lastHanja: string;
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

/**
 * 한자 둘(이름·성씨)의 정리 — 주소 꼴로 맞추고, 쓸 수 없는 값은 버린다("").
 * - 칸 수(이름·성씨 글자 수)보다 길거나 한자·표시 글자 밖이 섞이면 버린다. 성씨 한자에 `-`(한자 없이)가 있어도 버린다.
 * - 그 값의 주인(이름 / 성씨)이 한글 음절(가~힣)만이 아니면 칸을 셀 수 없으므로 버린다.
 * - **상대 쪽에 한글 음절 밖의 글자(낱자모 등)가 있으면 둘 다 버린다** — 서버가 한자를 받지 않는 입력이라(name_not_hangul)
 *   화면이 한자 필드를 보내지 않는다(lib/hanja-pick.ts apiHanjaFields). 주소·서명에만 남으면 쓰이지 않은 한자가 쓰인 것처럼 보인다.
 *   상대 쪽이 **비어 있는** 것은 괜찮다 — /name 조합 링크는 성 없이 이름과 한자만 싣고, 폼에서 성씨를 넣는다.
 * URL(inputFromParams)·폼 제출(inputFromPayload)·폼 시드(seedFromParams)가 모두 이 규칙을 거쳐야 왕복 서명이 같다.
 */
function hanjaPair(
  lastName: string,
  name: string,
  rawHanja: string | null | undefined,
  rawLastHanja: string | null | undefined
): { hanja: string; lastHanja: string } {
  const nameOk = isHangulSyllables(name);
  const lastOk = isHangulSyllables(lastName);
  return {
    hanja: nameOk && (lastOk || lastName === "") ? canonicalHanja(rawHanja, name.length) : "",
    lastHanja:
      lastOk && (nameOk || name === "") ? canonicalHanja(rawLastHanja, lastName.length, { allowNone: false }) : "",
  };
}

export function inputFromParams(p: URLSearchParams): EvalInput {
  const birthDate = (p.get("birthDate") ?? "").trim();
  const lastName = (p.get("lastName") ?? "").trim();
  const name = (p.get("name") ?? "").trim();
  return {
    lastName,
    name,
    birthDate,
    birthTime: timeWithDate(birthDate, (p.get("birthTime") ?? "").trim()),
    gender: normalizeGender(p.get("gender")),
    tone: normalizeTone(p.get("tone")),
    ...hanjaPair(lastName, name, p.get("hanja"), p.get("lastHanja")),
  };
}

export function inputFromPayload(p: EvalSubmitPayload): EvalInput {
  const birthDate = p.birth.trim();
  const lastName = p.lastName.trim();
  const name = p.firstName.trim();
  return {
    lastName,
    name,
    birthDate,
    birthTime: timeWithDate(birthDate, (p.birthTime ?? "").trim()),
    gender: p.gender === "남" ? "male" : p.gender === "여" ? "female" : "none",
    tone: p.tone === "부드러운" ? "soft" : p.tone === "강한" ? "strong" : "neutral",
    ...hanjaPair(lastName, name, p.hanja, p.lastHanja),
  };
}

/**
 * 같은 평가인지 가르는 키 — 링크 표기(파라미터 순서·기본값 생략)와 무관하다.
 * 한자만 달라도 다른 평가다(끝에 두 값을 더했다 — 한자가 없으면 빈 칸 둘이 붙는다).
 */
export function inputSignature(i: EvalInput): string {
  return [i.lastName, i.name, i.birthDate, i.birthTime, i.gender, i.tone, i.hanja, i.lastHanja].join("|");
}

/** 자동 평가 조건 — 성과 이름만 있으면 된다(출생일·성별·톤은 선택, API가 허용) */
export function canAutoEvaluate(i: EvalInput): boolean {
  // 주소로 온 값도 입력 폼과 같은 검사(lib/name-input) — 옛 판정은 빈 값만 봐서 /evaluate?lastName=김&name=ㅋㅋ 가 그대로 채점됐다
  // (11/27 런타임 검증 — 폼은 막는데 주소·Hero 길은 열려 있었다). 못 지나가면 값을 채운 입력 폼을 보여 주고 폼이 이유를 알린다
  return nameInputProblem(i.lastName, SURNAME_MAX_LENGTH) === null && nameInputProblem(i.name, EVAL_NAME_MAX_LENGTH) === null;
}

/** 링크를 만들 때의 입력 — 한자는 없어도 된다(추천 결과에서 평가로 넘어가는 링크처럼 한자를 고른 적 없는 자리) */
export type EvalLinkInput = Omit<EvalInput, "hanja" | "lastHanja"> &
  Partial<Pick<EvalInput, "hanja" | "lastHanja">>;

/**
 * /evaluate 링크. withBirth=false면 생년월일·출생 시각을 뺀다 — 공유 링크 기본값
 * (아이 생년월일이 메신저로 퍼지지 않게, 감사 EV-7). 기본값(none·neutral)은 생략해 짧게 둔다.
 * 고른 한자는 withBirth 와 무관하게 싣는다(name 바로 뒤). 빈 값은 쓰지 않으므로 한자 없는 링크는 예전과 글자 그대로 같다.
 */
export function evaluateHref(i: EvalLinkInput, { withBirth }: { withBirth: boolean }): string {
  const params = new URLSearchParams();
  params.set("lastName", i.lastName);
  params.set("name", i.name);
  if (i.hanja) params.set("hanja", i.hanja);
  if (i.lastHanja) params.set("lastHanja", i.lastHanja);
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
  const lastName = (p.get("lastName") ?? "").trim();
  const firstName = (p.get("name") ?? "").trim();
  return {
    lastName,
    firstName,
    birth,
    birthTime: timeWithDate(birth, (p.get("birthTime") ?? "").trim()),
    gender: g === "male" ? "남" : g === "female" ? "여" : g === "none" ? "중립" : "",
    tone: t === "soft" ? "부드러운" : t === "strong" ? "강한" : t === "neutral" ? "중립" : "",
    ...hanjaPair(lastName, firstName, p.get("hanja"), p.get("lastHanja")),
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
    hanja: i.hanja,
    lastHanja: i.lastHanja,
  };
}
