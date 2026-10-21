/**
 * 성+이름 한 덩어리("김서준", "남궁민")를 성과 이름으로 나눈다 — 홈 평가 입력·찜 목록이 함께 쓴다.
 *
 * 왜 있나(2026-10-21): 홈은 charAt(0)으로 성을 잘라 "남궁민"이 성 '남' + 이름 '궁민'으로
 * 평가됐다. 한자 후보(弓·窮)·수리·유니크 지수가 통째로 달라진다(감사 EV-6).
 *
 * 규칙 (위에서부터 먼저 맞는 것)
 * 1. 띄어 쓰면 그대로 따른다 — "황보 람" → 황보 + 람. 사용자가 직접 정한 경계가 가장 정확하다
 *    (앞 단어가 1자이거나 복성일 때만 — "김서 준" 같은 오타 띄어쓰기는 무시하고 붙여 읽는다)
 * 2. 붙여 쓴 4자 이상이 복성으로 시작하면 복성 — "남궁서연" → 남궁 + 서연
 * 3. 붙여 쓴 3자는 복성이 대개 맞지만(남궁민·제갈량), 1자 성 + 2자 이름이 더 흔한 앞머리는
 *    1자 성으로 읽는다 — "황보라"는 황 + 보라, "서문희"는 서 + 문희, "선우진"은 선 + 우진.
 *    예외 앞머리: 황보·서문·강전·선우 (SINGLE_SURNAME_FIRST_IN_THREE). 이 복성의 1자 이름은
 *    띄어 쓰면 된다("선우 진" → 선우 + 진) — 홈 평가 입력 아래에 나뉜 결과와 함께 이 안내를 띄운다
 * 4. 나머지는 첫 글자가 성
 */

/** 복성 — 백엔드 SurnameData.TwoCharSurnames와 같은 목록 (추가 시 양쪽을 함께 고칠 것) */
export const COMPOUND_SURNAMES: readonly string[] = [
  "남궁",
  "독고",
  "동방",
  "사공",
  "서문",
  "선우",
  "제갈",
  "황보",
  "강전",
  "망절",
];

/**
 * 붙여 쓴 3자에서 복성으로 읽지 않는 앞머리 — 앞 글자(황·서·강·선)가 흔한 1자 성이고
 * 둘째 글자로 시작하는 2자 이름(보람·보라·문희·전우·우진·우현·우빈)이 드물지 않다.
 * 선우는 2026-10-21 검토로 추가: 선(宣)씨가 선우(鮮于)씨보다 인구가 많고(검토 추정 약 10배)
 * 우진·우현·우빈은 흔한 이름이라, 붙여 쓴 "선우진"은 선 + 우진일 가능성이 크다
 * (예전 홈의 charAt(0)도 그렇게 나눴다).
 */
const SINGLE_SURNAME_FIRST_IN_THREE: ReadonlySet<string> = new Set([
  "황보",
  "서문",
  "강전",
  "선우",
]);

export interface NameParts {
  lastName: string;
  /** 성을 뺀 이름 (공백 제거) */
  name: string;
}

export function splitFullName(input: string): NameParts {
  const trimmed = input.trim();
  if (!trimmed) return { lastName: "", name: "" };

  const words = trimmed.split(/\s+/);
  const spacedSurname =
    words.length > 1 &&
    (words[0].length === 1 || COMPOUND_SURNAMES.includes(words[0]));
  if (spacedSurname) {
    return { lastName: words[0], name: words.slice(1).join("") };
  }

  const full = words.join("");
  const head = full.slice(0, 2);
  if (COMPOUND_SURNAMES.includes(head)) {
    const longEnough =
      full.length >= 4 ||
      (full.length === 3 && !SINGLE_SURNAME_FIRST_IN_THREE.has(head));
    if (longEnough) return { lastName: head, name: full.slice(2) };
  }
  return { lastName: full.charAt(0), name: full.slice(1) };
}

/**
 * 붙여 쓴 3자를 1자 성으로 읽었는데 앞 두 글자가 복성이기도 한 경우 그 복성 — "선우진" → "선우".
 * 홈 평가 입력이 나뉜 결과 옆에 "선우 씨라면 '선우 진'처럼 띄어 써 주세요"를 이때만 붙인다
 * (2026-10-21 검토 FTE-4: 성이 1자로 읽힌 모든 입력 — 김서준·이하윤 — 에 '복성이면 띄어 써 주세요'가
 * 붙었는데, 김·이로 시작하는 복성은 없다). 규칙 3의 예외 앞머리만 해당하고, 사용자가 이미 띄어 쓴
 * 입력("선 우진"·"선우 진")은 경계를 직접 정한 것이라 null.
 */
export function ambiguousCompoundSurname(input: string): string | null {
  const trimmed = input.trim();
  if (/\s/.test(trimmed) || trimmed.length !== 3) return null;
  const head = trimmed.slice(0, 2);
  if (!SINGLE_SURNAME_FIRST_IN_THREE.has(head)) return null;
  return splitFullName(trimmed).lastName.length === 1 ? head : null;
}
