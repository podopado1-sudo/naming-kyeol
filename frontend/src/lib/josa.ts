/**
 * 한국어 조사 고르기 — 앞말 마지막 음절의 받침으로 은/는·이/가·을/를·과/와·으로/로를 고른다.
 *
 * 왜 있나(2026-10-21): 이름·독음 페이지 템플릿이 '은(는)'·'(으)로'·'이(가)'를 고정으로 써서
 * 검색 결과 설명문에 "지우은(는) …", "'이'(으)로 읽는 …"이 그대로 노출됐다(애드센스 감사 AS-5).
 *
 * - 받침 판정: 한글 음절(가~힣)의 (code - 0xAC00) % 28 — 0이면 받침 없음, 8이면 ㄹ받침.
 * - 으로/로: 받침 없음·ㄹ받침은 '로'(서울로·길로), 나머지 받침은 '으로'.
 * - 괄호 앞 말에 맞춘다: "화(불)"은 '화'로 판정("화(불)와"). 끝의 따옴표도 건너뛴다.
 * - 마지막 글자가 한글 음절이 아니면(라틴·숫자·한자) 판정할 수 없으므로 기존 괄호형을 돌려준다.
 */

export type JosaPair = "은/는" | "이/가" | "을/를" | "과/와" | "으로/로";

/** 판정 불가(비한글)일 때 쓰는 기존 괄호형 */
const FALLBACK: Record<JosaPair, string> = {
  "은/는": "은(는)",
  "이/가": "이(가)",
  "을/를": "을(를)",
  "과/와": "과(와)",
  "으로/로": "(으)로",
};

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JONG_RIEUL = 8;

/** 괄호 묶음·닫는 따옴표·공백을 끝에서 걷어낸 앞말 */
function headWord(word: string): string {
  let w = word.trimEnd();
  for (;;) {
    const next = w
      .replace(/\s*\([^()]*\)$/, "")
      .replace(/['"’”」』]+$/, "")
      .trimEnd();
    if (next === w) return w;
    w = next;
  }
}

/** 마지막 음절의 종성 인덱스(0 = 받침 없음). 한글 음절이 아니면 null. */
function finalJong(word: string): number | null {
  const w = headWord(word);
  if (!w) return null;
  const code = w.charCodeAt(w.length - 1);
  if (code < HANGUL_FIRST || code > HANGUL_LAST) return null;
  return (code - HANGUL_FIRST) % 28;
}

/** 마지막 음절에 받침이 있나. 한글 음절이 아니면 null. hasBatchim("준") → true */
export function hasBatchim(word: string): boolean | null {
  const jong = finalJong(word);
  return jong === null ? null : jong !== 0;
}

/** 조사만 돌려준다. josa("지우", "은/는") → "는", josa("'이'", "으로/로") → "로" */
export function josa(word: string, pair: JosaPair): string {
  const jong = finalJong(word);
  if (jong === null) return FALLBACK[pair];
  const [withBatchim, withoutBatchim] = pair.split("/");
  if (pair === "으로/로") return jong === 0 || jong === JONG_RIEUL ? "로" : "으로";
  return jong === 0 ? withoutBatchim : withBatchim;
}

/** 앞말 + 조사. withJosa("서준", "은/는") → "서준은" */
export function withJosa(word: string, pair: JosaPair): string {
  return `${word}${josa(word, pair)}`;
}
