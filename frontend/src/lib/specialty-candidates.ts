// 3글자(/three-syllable)·순우리말(/pure-korean) 단독 화면의 응답 → 결과 화면(SmartResultPage) 후보 꼴.
//
// ⚠️ 2026-11-27: 두 단독 화면은 처음 만든 날부터 결과를 한 번도 그리지 못했다.
//   - 3글자: 서버(POST /recommendations/three-syllable)는 후보 배열을 그대로 주는데 화면은 {names,totalCount} 로 읽어
//     늘 '추천 결과를 찾지 못했어요'.
//   - 순우리말: 서버(POST /recommendations/pure-korean)는 {lastName, candidates, totalCount} 를 주는데 화면은 names 를 읽어
//     '총 10개 후보'라 해 놓고 카드 0장.
//   /creative(7월)·/required-char(2026-10-21)에서 고친 것과 같은 종류다. 여기 함수는 /search 의 같은 탭
//   (SmartRecommendationService 의 3글자·순우리말 매핑)과 같은 규칙으로 옮기고, 영문 코드값은 한글 이름표로 바꾼다.
//
// /search 탭 카드에도 서버가 영문 코드(male·soft·neutral·pure-korean·hanja·mixed)와 이름을 자른 조각('솔바'·'람')을 칩으로 실어
// 보낸다 — normalizeSpecialtyTags 가 결과 화면에서 같은 이름표로 바꾼다(서버 배포 없이).
//
// 같은 날 검증 뒤 더한 것:
//   - 평가 링크의 한자(evaluateHanja): '상세 보기'·저장이 이름만 들고 /evaluate 로 가면 /evaluate 가 한자를 자동으로 골라
//     순우리말 남궁이슬을 理璱(다스릴 리 + 옥 무늬 슬)로 채점하고, 3글자 요호주(耀·虎·主)를 耀豪周 로 채점했다 — 카드와 다른 이름이다.
//     순우리말 음절은 '-'(한자 없이 한글로), 엔진이 한자를 준 음절은 그 한자, 나머지는 '*'(자동)로 주소 꼴을 만든다.
//   - 점수 이름표(scoreLabel): 두 엔진의 점수는 발음 점수다. 결과 화면이 'FINAL' 로 적어 '상세 보기'의 종합 점수와 어긋났다.
//   - 순우리말 성별 칩은 뺐다: 엔진 사전의 genderFit 이 출생 통계와 어긋나는 이름이 있다(이삭 female — /name/이삭 은 남자 823·여자 27).
//     '여자 이름'이라는 단정 칩으로 내지 않는다(사전 값 정리는 이름 품질 작업에서).
import type {
  PureKoreanCandidate,
  PureKoreanResponse,
  SmartNameCandidate,
  SmartRecommendationResponse,
  ThreeSyllableCandidate,
} from "./types";
import { canonicalHanja, isHangulSyllables } from "./hanja-pick";
// 음절별 후보 파일의 색인(dump-hanja-pick 산출, 16KB) — '-'(한자 없이)를 서버가 그대로 두는 음절을 가른다
import hanjaPickIndex from "../../public/data/hanja-pick/v1/index.json" with { type: "json" };

/**
 * '-'(한자 없이 한글로)가 뜻이 있는 음절 = 사전에 독음이 있고 자동 배정이 비지 않는 음절(색인에 있고 autoEmpty 가 아님).
 * 그 밖의 음절(바·봄·빛처럼 사전에 독음이 없거나, 몰·괵처럼 쓸 글자가 모두 불용)은 서버가 '-'를 '지정 없음'(`*`)으로 접어
 * hanjaSummary.nameHanja 를 '*-' 꼴로 돌려준다. 같은 꼴로 만들어야 카드에서 저장한 것과 /evaluate 에서 저장한 것이
 * 즐겨찾기에서 한 항목이 된다(검증 지적 — 바람을 두 번 저장했다). 규칙의 원본은 HanjaInput.AutoIsEmpty·lib/hanja-pick.ts deriveSlots.
 */
const KEEPS_DASH: ReadonlySet<string> = new Set(
  Object.entries((hanjaPickIndex as { syllables: Record<string, { autoEmpty?: boolean }> }).syllables)
    .filter(([, v]) => v.autoEmpty !== true)
    .map(([syllable]) => syllable)
);

/** 한글 음절 하나를 '한자 없이'로 둘 때의 주소 꼴 표시 — 서버가 접는 음절은 '*' */
function hangulMark(syllable: string): string {
  return KEEPS_DASH.has(syllable) ? "-" : "*";
}

/** 순우리말 후보의 toneFit — 소리 결 */
export const TONE_FIT_LABEL: Record<string, string> = {
  soft: "부드러운 결",
  strong: "힘 있는 결",
  neutral: "중간 결",
};

/** 서버 순우리말 칩 [0] 의 genderFit 값 — 칩으로 내지 않고 모양 확인에만 쓴다 */
const GENDER_FIT_CODES: Record<string, string> = { male: "", female: "", neutral: "" };

/** 3글자 후보의 nameType */
export const NAME_TYPE_LABEL: Record<string, string> = {
  "pure-korean": "순우리말",
  hanja: "한자",
  mixed: "혼합",
};

/** 두 엔진의 점수(pronunciationScore)를 결과 카드에 적을 이름표 — 기본 'FINAL'(종합) 대신 */
export const PRONUNCIATION_SCORE_LABEL = "발음";

const PURE_KOREAN_TAG = "순우리말";
const THREE_SYLLABLE_TAG = "3글자";

/**
 * 점수의 부동소수 꼬리(61.849999999999994)를 소수 한 자리로 — 서버 /search 매핑의 Math.Round(…, 1) 과 같은 61.8.
 * Math.round(v * 10) / 10 은 곱셈에서 618.5 가 되어 61.9 로 갈린다. toFixed 는 저장된 이진 값 그대로 반올림한다
 * (정확한 중간값 x.x5 에서만 서버의 짝수 반올림과 다를 수 있다 — 카드는 정수로 반올림해 보여 준다).
 */
function round1(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(1)) : undefined;
}

function uniq(tags: string[]): string[] {
  return [...new Set(tags.filter((t) => t && t.trim()))];
}

/** 표에 있는 키인가 — 'constructor' 같은 Object 내장 이름이 이름표로 새지 않게(Object.hasOwn 은 사파리 15.4 이상이라 쓰지 않는다) */
function has(table: Record<string, string>, key: string | undefined): key is string {
  return key != null && Object.prototype.hasOwnProperty.call(table, key);
}

function label(table: Record<string, string>, key: string | undefined): string {
  return has(table, key) ? table[key] : "";
}

function pureKoreanTags(toneFit: string | undefined): string[] {
  return uniq([label(TONE_FIT_LABEL, toneFit), PURE_KOREAN_TAG]);
}

function threeSyllableTags(nameType: string | undefined): string[] {
  // 조합 요소(components — '솔바'·'람', '온누'·'主(주)')는 칩으로 싣지 않는다. 낱말 경계가 아니라 엔진이 붙인 조각이라
  // 이름을 잘라 놓은 것처럼 보인다. 한자가 든 조각은 카드의 한자 자리(hanja)와 평가 링크(evaluateHanja)로 옮긴다.
  return uniq([label(NAME_TYPE_LABEL, nameType), THREE_SYLLABLE_TAG]);
}

/** 엔진의 한자 조각 꼴 '主(주)' — 한자 한 글자와 그 독음 */
const HANJA_PIECE = /^(\p{Script=Han})\(([가-힣])\)$/u;

/**
 * 3글자 후보의 조합 요소 → 음절마다의 표시(서버 주소 꼴).
 *   - 순우리말 유형: 모든 음절이 '한자 없이'.
 *   - 엔진이 한자 조각('主(주)')을 하나라도 준 후보(생성 조합 — 요호주·이슬혜·온누주): 한자 조각은 그 한자, 한글 조각은 '한자 없이'.
 *   - 한자 조각이 없는 한자·혼합 후보(큐레이션 목록 — 누리서·예준서): null. 큐레이션 조각은 서버가 이름을 앞 두 음절 + 끝 음절로
 *     기계적으로 자른 것이라(솔이슬 → 솔이 + 슬) 어느 음절이 한글인지 알 수 없다(검증 지적). 예전처럼 한자 없이 넘겨 /evaluate 가 고른다.
 * 조각을 이어 이름과 같지 않으면 null.
 */
function threeSyllableMarks(name: string, nameType: string | undefined, components: readonly unknown[] | undefined): string[] | null {
  if (!Array.isArray(components) || components.length === 0 || !isHangulSyllables(name)) return null;
  const pieces = components.map((raw) => (typeof raw === "string" ? raw.trim() : ""));
  const hasEngineHanja = pieces.some((p) => HANJA_PIECE.test(p));
  if (nameType !== "pure-korean" && !hasEngineHanja) return null;
  const marks: string[] = [];
  let spelled = "";
  for (const piece of pieces) {
    const hanja = HANJA_PIECE.exec(piece);
    if (hanja) {
      marks.push(hanja[1]);
      spelled += hanja[2];
      continue;
    }
    if (!isHangulSyllables(piece)) return null;
    for (const syllable of piece) marks.push(hangulMark(syllable));
    spelled += piece;
  }
  return spelled === name ? marks : null;
}

function threeSyllableHanja(name: string, nameType: string | undefined, components: readonly unknown[] | undefined) {
  const marks = threeSyllableMarks(name, nameType, components);
  if (!marks) return { hanja: undefined, evaluateHanja: undefined };
  const evaluateHanja = canonicalHanja(marks.join(""), name.length) || undefined;
  // 카드의 한자 자리는 모든 음절에 엔진 한자가 있을 때만(요호주 → 耀虎主). 하나라도 비면 한글 이름을 그대로 둔다
  const allHanja = marks.every((m) => m !== "-" && m !== "*");
  // (모두 '*' 면 canonicalHanja 가 "" — 지정 없음, 예전 링크 그대로)
  return { hanja: allHanja ? marks.join("") : undefined, evaluateHanja };
}

/** 순우리말 이름의 평가 링크 한자 — 음절마다 '한자 없이'(서버가 접는 음절은 '*'). 한글 음절이 아니면 싣지 않는다 */
function pureKoreanEvaluateHanja(name: string): string | undefined {
  return isHangulSyllables(name) ? canonicalHanja([...name].map(hangulMark).join(""), name.length) || undefined : undefined;
}

/** 3글자 후보 하나 → 결과 화면 후보 */
export function mapThreeSyllableCandidate(c: ThreeSyllableCandidate): SmartNameCandidate {
  const { hanja, evaluateHanja } = threeSyllableHanja(c.name, c.nameType, c.components);
  return {
    name: c.name,
    fullName: c.fullName,
    meaning: c.meaning ?? "",
    hanja,
    evaluateHanja,
    score: round1(c.pronunciationScore),
    scoreLabel: PRONUNCIATION_SCORE_LABEL,
    tags: threeSyllableTags(c.nameType),
    reasons: [],
    phonologyNotes: Array.isArray(c.phonologyNotes) ? c.phonologyNotes : [],
  };
}

/** 순우리말 후보 하나 → 결과 화면 후보. fullName 은 서버 값(성 + 이름), 없으면 성 + 이름 */
export function mapPureKoreanCandidate(c: PureKoreanCandidate, lastName: string): SmartNameCandidate {
  return {
    name: c.name,
    fullName: c.fullName || `${lastName}${c.name}`,
    meaning: c.meaning ?? "",
    evaluateHanja: pureKoreanEvaluateHanja(c.name),
    score: round1(c.pronunciationScore),
    scoreLabel: PRONUNCIATION_SCORE_LABEL,
    tags: pureKoreanTags(c.toneFit),
    reasons: [],
    phonologyNotes: [],
  };
}

function singleCategory(
  lastName: string,
  type: string,
  label: string,
  engineUsed: string,
  names: SmartNameCandidate[]
): SmartRecommendationResponse {
  return {
    lastName,
    isRareSurname: false,
    categories: [{ type, label, engineUsed, names }],
    // 서버 totalCount 가 아니라 실제로 옮긴 카드 수 — 둘이 어긋나면 '총 N개 후보'인데 카드 0장이 된다
    totalCount: names.length,
    topPick: names.length ? { categoryType: type, categoryLabel: label, candidate: names[0] } : null,
  };
}

/** POST /recommendations/three-syllable 응답(후보 배열) → 결과 화면 응답. 배열이 아니면 빈 결과 */
export function wrapThreeSyllableResponse(res: unknown, lastName: string): SmartRecommendationResponse {
  const list = Array.isArray(res) ? (res as ThreeSyllableCandidate[]) : [];
  const names = list.filter((c) => c && c.name).map(mapThreeSyllableCandidate);
  return singleCategory(lastName, "three-syllable", "3글자 이름", "ThreeSyllableEngine", names);
}

/** POST /recommendations/pure-korean 응답({lastName, candidates, totalCount}) → 결과 화면 응답 */
export function wrapPureKoreanResponse(res: unknown, lastName: string): SmartRecommendationResponse {
  const body = (res ?? {}) as Partial<PureKoreanResponse>;
  const list = Array.isArray(body.candidates) ? body.candidates : [];
  const names = list.filter((c) => c && c.name).map((c) => mapPureKoreanCandidate(c, lastName));
  return singleCategory(lastName, "pure-korean", "순우리말 이름", "PureKoreanNameEngine", names);
}

/**
 * /search 결과의 순우리말·3글자 탭 후보를 단독 화면과 같은 꼴로 — 칩 이름표·점수 이름표·평가 링크 한자.
 * 서버(SmartRecommendationService)는 순우리말 칩을 [genderFit, toneFit, '순우리말'], 3글자 칩을 [nameType, '3글자', ...조합 요소]로 보낸다.
 * 모양이 예상과 다르면(이미 한글 이름표 — 단독 화면이 만든 후보) 그대로 둔다.
 */
export function normalizeSpecialtyTags(categoryType: string, c: SmartNameCandidate): SmartNameCandidate {
  const tags = c.tags ?? [];
  if (categoryType === "pure-korean") {
    // 'neutral' 은 성별·톤 양쪽 값이라 자리로 읽는다 — [0] 성별, [1] 톤
    const [g, t] = tags;
    if (!(has(GENDER_FIT_CODES, g) && has(TONE_FIT_LABEL, t))) return c;
    return {
      ...c,
      tags: pureKoreanTags(t),
      scoreLabel: PRONUNCIATION_SCORE_LABEL,
      evaluateHanja: c.evaluateHanja ?? pureKoreanEvaluateHanja(c.name),
    };
  }
  if (categoryType === "three-syllable") {
    const [type, , ...components] = tags;
    if (!has(NAME_TYPE_LABEL, type)) return c;
    const { hanja, evaluateHanja } = threeSyllableHanja(c.name, type, components);
    return {
      ...c,
      tags: threeSyllableTags(type),
      scoreLabel: PRONUNCIATION_SCORE_LABEL,
      hanja: c.hanja ?? hanja,
      evaluateHanja: c.evaluateHanja ?? evaluateHanja,
    };
  }
  return c;
}

/** 단독 화면 요청의 성별·톤 — 서버 엔진은 소문자 값과 비교한다(쌍둥이 화면 2026-11-26 과 같은 꼴, 'none' 은 보내지 않는다) */
export function specialtyGenderTone(
  gender: string,
  tone: string
): { gender?: "male" | "female"; tone: "neutral" | "soft" | "strong" } {
  return {
    gender: gender === "male" || gender === "female" ? gender : undefined,
    tone: tone === "soft" || tone === "strong" ? tone : "neutral",
  };
}
