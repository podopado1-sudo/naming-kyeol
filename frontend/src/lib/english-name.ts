/**
 * 영어 이름 입력 검증 — /search 폼과 홈 Hero가 함께 쓴다.
 *
 * 왜 있나(2026-10-21): 백엔드 SmartRecommendationRequestDto.PreferredEnglishName이
 * [StringLength(30)]라 31자부터 추천 전체가 400(한글 없는 오류라 일반 문구만 뜨고 다른 탭도
 * 사라진다). 한글로 넣으면 200이지만 영어 겸용 탭이 생기지 않는다(실측).
 * /search가 이 검증으로 제출을 막자, 검증 없던 Hero에서 '다니엘'을 넣고 넘어오면 autoStart
 * 추천 전체가 폼에 멈췄다(검토 FTE-3) — 그래서 Hero도 같은 함수로 넘기기 전에 안내한다.
 */

export const ENGLISH_NAME_MAX = 30;
export const ENGLISH_NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]*$/;

/** 문제가 없거나 비어 있으면 null, 아니면 인라인 안내 문구 */
export function englishNameProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length > ENGLISH_NAME_MAX)
    return `영어 이름은 ${ENGLISH_NAME_MAX}자 이내로 입력해 주세요.`;
  if (!ENGLISH_NAME_PATTERN.test(v))
    return /[ㄱ-ㆎ가-힣]/.test(v)
      ? "영문으로 입력해 주세요 (예: Daniel). 한글로 쓰면 영어 겸용 이름을 찾지 못해요."
      : "영문 알파벳으로 입력해 주세요 (예: Daniel).";
  return null;
}
