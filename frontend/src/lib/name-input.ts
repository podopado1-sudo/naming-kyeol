// 성씨·이름 입력 칸 공용 검사 — 화면마다 따로(또는 아예 안) 하던 다듬기·한글 검사를 한곳에 둔다.
//
// 왜 있나(2026-11-27 버그 목록): /analysis·/evaluate·홈 Hero·/search·/parent-based·/rare-surname·/required-char 가
// 성·이름을 다듬지도 검사하지도 않아 끝 공백·한자·영문·숫자·낱자모(ㅋㅋ)가 든 값을 그대로 보내고,
// 서버는 그 값을 다른 이름·'희귀 성씨'로 채점했다(analysis-input-unvalidated·evaluate-input-validation·
// hero-surname-unvalidated·search-surname-unvalidated·parent-based-input-unvalidated·rare-surname-input-unvalidated).
//
// 쓰는 법: 제출할 때 cleanNameInput 으로 다듬은 값을 보내고, nameInputProblem 이 null 이 아니면 막은 뒤
// nameInputMessage 로 이유를 보여 준다. 빈 칸 문구('성씨를 입력해주세요.')는 화면마다 이미 있으니 그대로 쓴다.
// 실제 성씨인지(사전)는 여기서 보지 않는다 — 희귀 성씨 도구가 있어 목록 밖 성도 받는다.

import { isHangulSyllables } from "./hanja-pick";
import { withJosa } from "./josa";

/** 제출 전 다듬기 — 유니코드 NFC(맥·아이폰 입력기의 풀어 쓴 한글을 모은다) + 앞뒤 공백 제거 */
export function cleanNameInput(raw: string | null | undefined): string {
  return (raw ?? "").normalize("NFC").trim();
}

export type NameInputProblem =
  /** 다듬은 뒤 비었다 */
  | "empty"
  /** 낱자모(ㄱ·ㅏ)가 섞였다 — 한글 입력 중에 멈춘 값 */
  | "jamo"
  /** 가운데 공백이 있다('서 윤') */
  | "space"
  /** 한글 음절이 아닌 글자(한자·영문·숫자·기호)가 섞였다 */
  | "not-hangul"
  /** 허용 글자 수를 넘었다 */
  | "too-long";

const JAMO = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿]/;

/**
 * 다듬은 값의 문제 — 없으면 null. value 는 cleanNameInput 을 거친 값이어야 한다(거치지 않았으면 여기서도 다듬어 본다).
 * maxLength 는 글자 수(한글 음절 하나 = UTF-16 한 칸). 성씨는 2(복성), 이름은 화면이 받는 길이를 넘긴다.
 */
export function nameInputProblem(value: string | null | undefined, maxLength: number): NameInputProblem | null {
  const v = cleanNameInput(value);
  if (!v) return "empty";
  if (JAMO.test(v)) return "jamo";
  if (/\s/.test(v)) return "space";
  if (!isHangulSyllables(v)) return "not-hangul";
  if (v.length > maxLength) return "too-long";
  return null;
}

/** 빈 칸이 아닌 문제의 안내 문구. label 은 칸 이름('성씨'·'이름'·'부모 이름') */
export function nameInputMessage(problem: Exclude<NameInputProblem, "empty">, label: string, maxLength: number): string {
  const topic = withJosa(label, "은/는");
  switch (problem) {
    case "jamo":
      return `${topic} ㄱ·ㅏ 같은 낱자 없이 완성된 한글로 입력해주세요.`;
    case "space":
      return `${topic} 띄어 쓰지 말고 붙여서 입력해주세요.`;
    case "not-hangul":
      return `${topic} 한글로만 입력해주세요.`;
    case "too-long":
      return `${topic} ${maxLength}글자까지 입력할 수 있어요.`;
  }
}

/** 성씨 칸 글자 수 — 복성(남궁·제갈·황보 등)까지 */
export const SURNAME_MAX_LENGTH = 2;
