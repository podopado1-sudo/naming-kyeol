/**
 * /hanja 화면 문구 — 부수 기준 자원오행의 이견·예외·이체자·글자 풀이 (2026-10-22 자원오행 전환 S7).
 *
 * 문구 계약은 data/hanja_resource_element.json meta.fields·v_reasons_legend 에 있다. 여기서 지키는 것:
 * - alt_radical 은 **부수 단위** 견해다 — '이 부수(示)를 火·金으로 보는 자료도 있습니다'. 글자 견해('작명가에 따라
 *   이 글자를…')로 쓰지 않는다(그 글자에 그 값을 준 자료가 없을 수 있다).
 * - alt_char 는 **글자 단위** 견해다 — 출처(basis)로 나눈다. PRACTICE = 작명 실무 자료 n곳(어느 자료인지는 데이터에 없다)
 *   → '작명가에 따라…', 문헌 예시·본문(KIM-EX·KIM-TXT) → '문헌 가운데 김만태 예시는…', 작명소 예시(MISO)·작명 서비스(ERUMY)는
 *   문헌이 아니라서 그렇게 밝힌다.
 * - basis 의 HN·NC·IO 는 부수 수준 다수값이라 글자 판단처럼 보이게 쓰지 않는다 — 이 모듈은 basis 를 화면에 내지 않는다.
 * - 자료 적음(radical_single)·추정(radical_unknown)만 있는 V 는 대체값이 없으니 '이견'이라고 쓰지 않는다(배지도 따로).
 * - 숫자 한자(number)는 V·X 모두 '숫자 한자의 자원오행은 작명가마다 기준이 다릅니다'.
 * - mw(옛 뜻 기반 판정 문장)는 오행으로 보이면 안 된다(D4 — 한 글자에 오행 둘 금지). cleanMeaningNote 가 오행 낱말이 든 문장과,
 *   '기운·에너지·성질'을 말하면서 이 글자 자원오행(e)과 다른 오행의 심상(나무·불꽃·흙·쇠·물…)을 쓰는 문장을 뺀다.
 *
 * React·경로 별칭 없이 node --test 로 검사하려고 순수 함수만 둔다(tests/hanja-element-text.test.mjs).
 * 조사는 lib/josa.ts 의 josa 를 호출하는 쪽이 넘긴다(이 모듈이 조사 규칙을 따로 갖지 않게).
 */

export type JosaPair = "은/는" | "이/가" | "을/를" | "과/와" | "으로/로";
export type JosaFn = (word: string, pair: JosaPair) => string;

/** 오행 한자 → 한글 소리(조사 판정용 — '火로'·'金으로') */
export const ELEMENT_READING: Record<string, string> = {
  木: "목",
  火: "화",
  土: "토",
  金: "금",
  水: "수",
};

/** alt_char 한 항목 — data/hanja_resource_element.json meta.fields.alt_char */
export interface AltCharLike {
  e: string;
  basis: string[];
  n?: number;
  of?: number;
  n_indep?: number;
}

/** 이견 문구에 쓰는 필드만 — HanjaSeoRecord 의 부분집합 */
export interface ElementFactsLike {
  g?: string;
  radical_char?: string;
  alt_radical?: string[];
  alt_char?: AltCharLike[];
  v_reasons?: string[];
  number?: boolean;
}

/** 木火土金水 순으로 가운뎃점 연결 — "火·金" */
function joinElements(elements: string[]): string {
  const order = "木火土金水";
  return [...new Set(elements)]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .join("·");
}

/** 오행 목록 + '(으)로' — "火·金으로". 조사는 마지막 오행의 한글 소리로 고른다 */
function elementsWithRo(elements: string[], josa: JosaFn): string {
  const joined = joinElements(elements);
  const last = joined.slice(-1);
  return `${joined}${josa(ELEMENT_READING[last] ?? last, "으로/로")}`;
}

/** 오행 하나 + '(으)로' — "木으로" */
export function elementWithRo(element: string, josa: JosaFn): string {
  return elementsWithRo([element], josa);
}

/**
 * 글자 단위 다른 값(alt_char) — 출처마다 한 문장. 같은 출처 갈래의 여러 값은 한 문장으로 묶는다(娟 김만태 본문 火·水).
 * PRACTICE 의 n·of 는 '작명 실무 자료 of곳 중 n곳'으로만 쓴다(어느 자료인지는 싣지 않는 계약 — D1 개정·P7).
 */
function altCharLines(altChar: AltCharLike[], josa: JosaFn): string[] {
  const groups = new Map<string, { elements: string[]; n?: number; of?: number }>();
  for (const entry of altChar) {
    for (const basis of entry.basis.length ? entry.basis : ["OTHER"]) {
      const g = groups.get(basis) ?? { elements: [] };
      g.elements.push(entry.e);
      if (basis === "PRACTICE") {
        g.n = entry.n;
        g.of = entry.of;
      }
      groups.set(basis, g);
    }
  }
  const lines: string[] = [];
  for (const [basis, g] of groups) {
    const values = elementsWithRo(g.elements, josa);
    switch (basis) {
      case "PRACTICE": {
        const count =
          g.n && g.of ? `(작명 실무 자료 ${g.of}곳 중 ${g.n}곳)` : "(작명 실무 자료 여러 곳)";
        lines.push(`작명가에 따라 이 글자를 ${values} 보기도 합니다${count}.`);
        break;
      }
      case "KIM-EX":
        lines.push(`문헌 가운데 김만태 예시는 이 글자를 ${values} 봅니다.`);
        break;
      case "KIM-TXT":
        lines.push(`문헌 가운데 김만태 본문은 관점에 따라 이 글자를 ${values}도 봅니다.`);
        break;
      case "MISO":
        lines.push(`작명소 자료 가운데 미소 한국작명원 예시는 이 글자를 ${values} 봅니다.`);
        break;
      case "ERUMY":
        lines.push(`작명 서비스 이루미는 이 글자를 ${values} 봅니다.`);
        break;
      default:
        lines.push(`다른 자료는 이 글자를 ${values} 보기도 합니다.`);
    }
  }
  return lines;
}

/**
 * 자원오행 근거 아래에 붙이는 이견·주의 문장. 순서: 숫자 한자 → 글자 단위 견해 → 부수 단위 견해 → 자료 적음·추정.
 * R 이고 숫자 한자가 아니면 빈 목록.
 */
export function elementDisputeLines(rec: ElementFactsLike, josa: JosaFn): string[] {
  const reasons = new Set(rec.v_reasons ?? []);
  const lines: string[] = [];

  if (rec.number) {
    lines.push("숫자 한자의 자원오행은 작명가마다 기준이 다릅니다.");
  }
  if (rec.alt_char?.length) {
    lines.push(...altCharLines(rec.alt_char, josa));
  }
  const altRadical = rec.alt_radical ?? [];
  if (altRadical.length) {
    const radical = rec.radical_char ? `이 부수(${rec.radical_char})` : "이 부수";
    lines.push(`${radical}를 ${elementsWithRo(altRadical, josa)} 보는 자료도 있습니다.`);
  }
  if (reasons.has("radical_split")) {
    lines.push("이 부수 글자는 뜻에 따라 다르게 보기도 합니다.");
  }
  if (reasons.has("radical_disputed") && !altRadical.length && !reasons.has("radical_split")) {
    lines.push("이 부수는 자료마다 값이 갈립니다.");
  }
  if (reasons.has("radical_single")) {
    lines.push("이 부수는 자원오행 자료가 적어 찾은 자료의 값을 그대로 따랐습니다(자료 적음).");
  }
  if (reasons.has("radical_unknown")) {
    lines.push("이 부수는 어느 자료에도 값이 없어 부수의 뜻으로 추정했습니다(추정).");
  }
  return lines;
}

/**
 * 등급 배지 키 — R·X·U 는 그대로, V 는 이견이 실제로 있는지로 나눈다.
 * 자료 적음(radical_single)·추정(radical_unknown)만 있는 V 는 대체값이 없어 '이견 있음'이 사실과 다르다
 * (v_reasons_legend: '대체값이 없으면 이견이라고 쓰지 않는다') → V_FEW·V_GUESS.
 */
export function gradeBadgeKey(grade?: string, vReasons?: string[]): string | undefined {
  if (grade !== "V") return grade;
  const reasons = vReasons ?? [];
  if (reasons.length === 1 && reasons[0] === "radical_single") return "V_FEW";
  if (reasons.length === 1 && reasons[0] === "radical_unknown") return "V_GUESS";
  return "V";
}

/** 이체자 문구에 쓰는 양쪽 글자 정보 */
export interface VariantSide {
  char: string;
  /** 부수 글자(radical_char) */
  radical?: string;
  /** 자원오행 */
  element?: string;
  /** 대표 독음 — 조사 판정용(眞 → 진 → '眞과') */
  reading?: string;
}

/**
 * 이체자 한 줄(계획 §2-3·D6 — 값은 쓴 꼴의 부수를 따른다).
 * - 부수·값이 같으면: "정자 眞과 부수(目)가 같아 자원오행도 木으로 같습니다."
 * - 부수가 다르고 값이 같으면: "정자 德(彳)은 火, 이 꼴(悳, 心)도 火입니다."
 * - 값이 다르면: "정자 栽(木)는 木, 이 꼴(㘽, 土)은 土입니다. 이체자도 쓴 꼴의 부수로 자원오행을 정합니다."
 * 정자·이 꼴 어느 쪽이든 값이 없으면(U) null.
 */
export function variantElementLine(
  self: VariantSide,
  standard: VariantSide,
  josa: JosaFn,
): string | null {
  if (!self.element || !standard.element) return null;
  const stdWord = standard.reading ?? standard.char;
  const sameRadical = Boolean(self.radical) && self.radical === standard.radical;
  if (self.element === standard.element && sameRadical) {
    return `정자 ${standard.char}${josa(stdWord, "과/와")} 부수(${self.radical})가 같아 자원오행도 ${elementWithRo(self.element, josa)} 같습니다.`;
  }
  const stdPart = standard.radical ? `${standard.char}(${standard.radical})` : standard.char;
  const selfPart = self.radical ? `이 꼴(${self.char}, ${self.radical})` : `이 꼴(${self.char})`;
  const stdTopic = josa(stdWord, "은/는");
  if (self.element === standard.element) {
    return `정자 ${stdPart}${stdTopic} ${standard.element}, ${selfPart}도 ${self.element}입니다.`;
  }
  const why = sameRadical ? "" : " 이체자도 쓴 꼴의 부수로 자원오행을 정합니다.";
  return `정자 ${stdPart}${stdTopic} ${standard.element}, ${selfPart}은 ${self.element}입니다.${why}`;
}

// ---------------------------------------------------------------
// 글자 풀이(mw) — 오행으로 보이는 문장 빼기
// ---------------------------------------------------------------

/** 오행 한자 */
const ELEMENT_HANJA = /[木火土金水]/;
/** 한글 오행 이름이 오행 뜻으로 쓰인 꼴 — '금의 권위'·'목의 기운'·'수 기운'·'화(火)'·'토생금' */
const ELEMENT_WORD =
  /(?<![가-힣])(목|화|토|금|수)(?=의|\s*기운|\s*에너지|\s*\(|생|극|와|과|가|를|는|은|로|으로|[,.]|$)/;
/** 옛 판정 화살표('의미 '옥' → 金')·오행 용어 */
const ELEMENT_TERM = /→|오행|상생|상극/;
/** '부수 土.' 같은 부수 표기만 있는 문장 — 부수는 자원오행 근거에 따로 보인다 */
const RADICAL_ONLY = /^부수\s*\S+\.?$/;
/** 기운류 낱말 — 옛 뜻 기반 판정 문장은 'X처럼 …하는 기운'·'물의 에너지' 꼴로 오행을 말했다 */
const ENERGY_WORD = /기운|에너지|성질|기질|속성/;
/**
 * 오행 심상 — 고유어 오행 낱말(나무·불·흙·쇠·물)과 그 대표 사물. ENERGY_WORD 와 한 문장에 있을 때만 본다
 * ('물이 낮은 곳으로 흐르듯 내려감'(下)처럼 기운을 말하지 않는 비유는 뜻 풀이라 둔다).
 * '만물'·'쇠퇴'·'불가'·'땅거미' 같은 낱말 안의 글자는 앞뒤 글자로 거른다.
 */
const ELEMENT_IMAGERY: readonly (readonly [string, RegExp])[] = [
  ["木", /나무|(?<![가-힣])숲|초목|새싹|어린 싹|(?<![가-힣])싹(?:이|을|처럼|틔|트)|뿌리|(?<![가-힣])잎(?:이|을|처럼|사귀)/],
  ["火", /불꽃|불길|불씨|불빛|(?<![가-힣])불(?=의|처럼|이|을|로|에|과|와|\s|[,.])|태양|햇살|햇빛|타오르|뜨거|열기/],
  ["土", /대지|(?<![가-힣])흙|(?<![가-힣])땅(?=의|처럼|이|을|에|과|와|위|속|\s|[,.])/],
  ["金", /금속|강철|순금|칼날|보석|(?<![가-힣])쇠(?:의|처럼|붙이|가|를|로|와|같)/],
  ["水", /(?<![가-힣])물(?:이|처럼|의|결|줄기|가|을|은|에|로|과|와|길|방울|빛|살)|강물|바다|시냇물|냇물|샘물|샘솟|호수|파도|이슬|얼음/],
];
/** 남은 문장이 하나뿐일 때 이보다 짧으면(문장부호·공백 제외) 뜻(m)의 되풀이라 내지 않는다 — '버드나무.'·'젖.' */
const MIN_SINGLE_SENTENCE = 10;

/** 문장에 나온 오행 심상의 오행 목록 — '쇠처럼 단단한 의지' → ["金"] */
export function imageryElements(sentence: string): string[] {
  return ELEMENT_IMAGERY.filter(([, re]) => re.test(sentence)).map(([e]) => e);
}

/**
 * 기운·에너지·성질을 말하는 문장이 이 글자 자원오행(element)과 다른 오행의 심상을 쓰는가 — 玄(火) '심오한 물의 기운'·
 * 克(木) '쇠처럼 단단한 의지로 … 기운'·韓(金) '나무의 기운이 솟구치는'. 같은 오행 심상만 있으면(金 '금속처럼 … 기운') 둔다.
 * element 가 없으면(U) 심상이 있는 기운 문장은 모두 다른 오행으로 본다.
 */
function claimsOtherElement(sentence: string, element?: string): boolean {
  if (!ENERGY_WORD.test(sentence)) return false;
  return imageryElements(sentence).some((e) => e !== element);
}

/**
 * mw(옛 뜻 기반 판정 문장 — core_v1 뜻풀이 2,054개 + radical_map '의미 'X' → 오행' 1,469개)에서
 * 글자 풀이로 보일 문장만 남긴다. 오행 한자·오행 이름(금의·목의 기운)·판정 화살표가 든 문장, 부수 표기만 있는 문장,
 * 이 글자 자원오행(element)과 다른 오행 심상으로 기운을 말하는 문장(claimsOtherElement)을 뺀다.
 * radical_map 문장('의미 '옥' → 金')은 통째로 옛 오행 판정이라 전부 빠진다. 남은 게 없거나 뜻 되풀이 한 마디면 undefined.
 */
export function cleanMeaningNote(mw: string | undefined, element: string | undefined): string | undefined {
  if (!mw) return undefined;
  const sentences = mw
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = sentences.filter(
    (s) =>
      !ELEMENT_HANJA.test(s) &&
      !ELEMENT_WORD.test(s) &&
      !ELEMENT_TERM.test(s) &&
      !RADICAL_ONLY.test(s) &&
      !claimsOtherElement(s, element),
  );
  if (kept.length === 0) return undefined;
  if (kept.length === 1 && kept[0].replace(/[\s.,!?]/g, "").length < MIN_SINGLE_SENTENCE) {
    return undefined;
  }
  return kept.join(" ");
}
