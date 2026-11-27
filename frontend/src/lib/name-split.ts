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

/**
 * /search 부모 이름 칸(성 포함 전체 이름 — placeholder '예: 김철수')을 성과 이름으로 — 백엔드 FatherSurname·FatherName 등으로 보낸다(2026-10-28).
 * 옛 화면은 칸 값을 이름(fatherName)으로만 보내 부모 엔진이 '김민수'를 이름으로 읽었다 — 글자 잇기가 성 글자를 섞어
 * '수민김'·'김수민'을 냈고, 성씨가 필요한 방식(어머니 성씨 잇기)은 돌지 않았다.
 *
 * 규칙 (위에서부터)
 * 1. 빈 입력 → 성·이름 모두 빈 문자열
 * 2. 띄어 쓰면 splitFullName 그대로("김 철" → 김 + 철 — 외자 이름은 이렇게 쓴다)
 * 3. 붙여 쓴 2자 이하는 이름만 — '민호'를 성 '민' + 이름 '호'로 자르지 않는다(외자 부모 '김철'은 2번처럼 띄어 써야 성이 나뉜다)
 * 4. 붙여 쓴 3자 이상은 splitFullName(복성 규칙 포함 — "남궁서연" → 남궁 + 서연)
 */
export function splitParentName(input: string): { surname: string; name: string } {
  const trimmed = input.trim();
  if (!trimmed) return { surname: "", name: "" };
  if (/\s/.test(trimmed)) {
    const parts = splitFullName(trimmed);
    return { surname: parts.lastName, name: parts.name };
  }
  if (trimmed.length <= 2) return { surname: "", name: trimmed };
  const parts = splitFullName(trimmed);
  return { surname: parts.lastName, name: parts.name };
}

/** 홈 Hero 한 칸 '부모 이름'을 읽은 결과 — 아버지·어머니 칸 값과, 다르게도 읽힐 수 있는 입력인지 */
export interface ParentPairReading {
  father: string;
  mother: string;
  /**
   * 한 분으로 읽었지만 두 분일 수도 있는 입력('선우 서윤'·'김민 호'·'지호 서윤 하린'·붙여 쓴 '김민호이수정'·한글이 아닌 낱말이 섞인 'a 김민호') —
   * 홈 Hero 가 "두 분이면 쉼표나 가운뎃점(·)으로 나눠 주세요"를 띄운다
   */
  unclear: boolean;
}

/**
 * 두 분을 가르는 표 — 가운뎃점은 자판마다 다른 글자가 들어온다(2026-11-27 검토: 휴대폰 천지인 자판의 'ㆍ' U+318D,
 * 일본어 자판의 '・' U+30FB·'･' U+FF65, 그 밖의 '‧' U+2027·'∙' U+2219·'⋅' U+22C5). 쉼표·빗금·&·+ 와 '-'·'|'·';'·'、'·'，'(전각 쉼표)도 가름표다.
 * 이 표에 없는 기호는 낱말에 붙은 채 남아 groupParentWords 가 한글 아닌 낱말로 보고 통째로 + unclear 로 보낸다(기호를 성씨로 만들지 않는다).
 */
const PARENT_SEPARATOR_CLASS = "[·•ㆍ・･‧∙⋅,，、/&+\\-|;]";
const PARENT_SEPARATOR_CHARS = new RegExp(PARENT_SEPARATOR_CLASS);
const PARENT_SEPARATOR = new RegExp(`\\s*${PARENT_SEPARATOR_CLASS}\\s*`);

/** 한글 음절만으로 된 낱말 — 부모 이름 칸의 낱말을 사람으로 묶을 수 있는지(기호·영문·숫자·자모가 든 낱말은 묶지 않는다) */
const HANGUL_WORD = /^[가-힣]+$/;

/** 성 없이 이름만 쓴 한 분('지호')이나 성까지 붙여 쓴 한 분('김민호'·'남궁서연')으로 볼 낱말 — 2~4자 */
function isWholeNameWord(word: string): boolean {
  return word.length >= 2 && word.length <= 4;
}

/**
 * 띄어 쓴 낱말을 사람 단위로 묶는다 — 한글 한 음절 낱말이나 복성 뒤에 1~3자 낱말이 오면 '성 이름' 한 분('김 철'·'남궁 민'),
 * 나머지 낱말은 2~4자일 때만 한 분. 한글 음절이 아닌 글자가 든 낱말이 있거나('ㆍ'·'-'·'a'·'1') 묶을 수 없거나 세 분 이상이면 null.
 * (2026-11-27 검토: 한 글자면 무엇이든 성으로 봐서 '김민호 ㆍ 이수정'이 어머니 'ㆍ 이수정' → /search 성씨 'ㆍ' 가 됐다)
 */
function groupParentWords(words: string[]): string[] | null {
  if (!words.every((w) => HANGUL_WORD.test(w))) return null;
  const people: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = words[i + 1];
    const surnameLike = /^[가-힣]$/.test(word) || COMPOUND_SURNAMES.includes(word);
    if (surnameLike && next !== undefined && next.length <= 3) {
      people.push(`${word} ${next}`);
      i++;
      continue;
    }
    if (!isWholeNameWord(word)) return null;
    people.push(word);
  }
  return people.length <= 2 ? people : null;
}

/**
 * 홈 Hero 의 한 칸 '부모 이름'(placeholder '예: 김민호 · 이수정')을 아버지·어머니 두 칸 값으로 읽는다.
 *
 * 규칙 (위에서부터)
 * 1. 가름표(가운뎃점 여러 꼴 ·ㆍ・･‧∙⋅•, 쉼표 ,，、, /, &, +, -, |, ;)가 있으면 그것으로 가른다 — 앞의 두 조각
 * 2. 띄어 쓴 낱말을 사람 단위로 묶는다(groupParentWords) — 두 분이면 두 칸
 *    "김민호 이수정"·"지호 서윤"(2자는 이름만 — splitParentName 이 성을 자르지 않는다)·"김지호 서윤"·
 *    "김 철 이서윤"·"남궁 민 이서윤"·"김민호 이 수정"·"김 민호 이 수정"
 * 3. 한 분으로 묶이면 아버지 칸 — "김 민호"·"남궁 민호". 다만 두 낱말이 모두 2~4자면 두 분으로도 읽혀 unclear('선우 서윤' — 선우는 흔한 이름)
 * 4. 묶을 수 없으면(1자 낱말이 끝에 남음 '김민 호'·세 분 이상·5자 이상 낱말·한글 음절이 아닌 낱말 'a 김민호') 예전처럼 통째로 아버지 칸 + unclear
 *
 * 왜(2026-11-27 hero-parent-name-split): 옛 규칙은 가름표가 없으면 두 낱말이 모두 3자 이상일 때만 두 분으로 봐
 * '지호 서윤'이 아버지 '지 + 호서윤'이 되고 어머니 이름이 사라졌다. 옛 /search 는 한 칸 값을 아버지 이름 칸에 그대로 넣어 '김' + '민호·이수정'이 됐다.
 */
export function readParentPair(input: string): ParentPairReading {
  const trimmed = input.trim();
  if (!trimmed) return { father: "", mother: "", unclear: false };
  if (PARENT_SEPARATOR_CHARS.test(trimmed)) {
    const parts = trimmed.split(PARENT_SEPARATOR).filter((s) => s.length > 0);
    return { father: parts[0] ?? "", mother: parts[1] ?? "", unclear: false };
  }
  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    // 붙여 쓴 한 낱말 — 5자 이상이면 두 분을 붙여 쓴 것일 수 있다('김민호이수정')
    return { father: trimmed, mother: "", unclear: trimmed.length > 4 };
  }
  const people = groupParentWords(words);
  if (people?.length === 2) return { father: people[0], mother: people[1], unclear: false };
  if (people?.length === 1) {
    return { father: people[0], mother: "", unclear: words.length === 2 && words.every(isWholeNameWord) };
  }
  return { father: trimmed, mother: "", unclear: true };
}

/** readParentPair 의 [아버지, 어머니] — /search 가 Hero 에서 받은 parentName 을 두 칸으로 나눌 때 쓴다 */
export function splitParentPair(input: string): [string, string] {
  const { father, mother } = readParentPair(input);
  return [father, mother];
}
