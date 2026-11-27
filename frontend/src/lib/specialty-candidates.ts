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
//
// 2026-11-27 같은 날 더한 것(버그 목록 score-label-final-creative-rare·form-snapshot-specialty·required-char-input-feedback):
//   - 창의·특이 성씨 점수 이름표: 서버(SmartRecommendationService)가 창의 탭 Score 에 창의 점수(CreativityScore — 이름다움·성씨 연음·희소성을
//     섞은 엔진 고유 점수), 특이 성씨 탭 Score 에 발음 조화(RareSurnameEngine HarmonyScore — 성씨 연음·초성 다양성·리듬·길이)를 싣는다.
//     결과 화면이 'FINAL'·'SCORE OUT OF 100'(종합)으로 적어 '상세 보기'의 종합 점수와 어긋났다 → '창의'·'발음 조화'.
//   - /creative 단독 화면의 응답 꼴 옮기기(wrapCreativeResponse)도 여기로 — 같은 이름표를 붙인다.
//   - 네 단독 화면(/creative·/pure-korean·/three-syllable·/required-char)이 같이 쓰는 성씨 칸 검사·조건 칩 이름표,
//     /required-char 필수 글자 칸 검사(쓸 수 없는 값은 이유를 알리고 막는다)·불용 한자 주의·한자 없는 음절 안내.
import type {
  CreativeCandidate,
  HanjaResolveResponse,
  PureKoreanCandidate,
  PureKoreanResponse,
  SmartNameCandidate,
  SmartRecommendationResponse,
  ThreeSyllableCandidate,
} from "./types";
import { canonicalHanja, cleanHanjaText, isHanAfterClean, isHangulSyllables } from "./hanja-pick";
import { josa } from "./josa";
import { cleanNameInput, nameInputMessage, nameInputProblem, SURNAME_MAX_LENGTH } from "./name-input";
import { noHanjaSyllableNote } from "./no-hanja";
// 음절별 후보 파일의 색인(dump-hanja-pick 산출, 16KB) — '-'(한자 없이)를 서버가 그대로 두는 음절을 가른다
import hanjaPickIndex from "../../public/data/hanja-pick/v1/index.json" with { type: "json" };

/** 색인의 음절 표 — 음절 → {all, usable, autoEmpty}. 여기 없는 음절(봄·빛)은 사전에 그 소리로 읽는 한자가 없다 */
const INDEX_SYLLABLES = (hanjaPickIndex as { syllables: Record<string, { usable?: number; autoEmpty?: boolean }> }).syllables;

/**
 * '-'(한자 없이 한글로)가 뜻이 있는 음절 = 사전에 독음이 있고 자동 배정이 비지 않는 음절(색인에 있고 autoEmpty 가 아님).
 * 그 밖의 음절(바·봄·빛처럼 사전에 독음이 없거나, 몰·괵처럼 쓸 글자가 모두 불용)은 서버가 '-'를 '지정 없음'(`*`)으로 접어
 * hanjaSummary.nameHanja 를 '*-' 꼴로 돌려준다. 같은 꼴로 만들어야 카드에서 저장한 것과 /evaluate 에서 저장한 것이
 * 즐겨찾기에서 한 항목이 된다(검증 지적 — 바람을 두 번 저장했다). 규칙의 원본은 HanjaInput.AutoIsEmpty·lib/hanja-pick.ts deriveSlots.
 */
const KEEPS_DASH: ReadonlySet<string> = new Set(
  Object.entries(INDEX_SYLLABLES)
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

/** 창의 엔진의 점수(creativityScore — CreativeNamingEngine.CalculateDisplayScore: 이름다움·성씨 연음·오행·리듬·희소성)의 이름표 */
export const CREATIVE_SCORE_LABEL = "창의";

/** 특이 성씨 엔진의 점수(harmonyScore — RareSurnameEngine 성씨 연음·초성 다양성·리듬·길이)의 이름표. 결과 화면 SmartResultRare 와 같은 말 */
export const SURNAME_HARMONY_SCORE_LABEL = "발음 조화";

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
function has<T>(table: Record<string, T>, key: string | undefined): key is string {
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

/** 창의 후보 하나 → 결과 화면 후보. /search 창의 탭(SmartRecommendationService — Score = Math.Round(CreativityScore, 1))과 같은 규칙 */
export function mapCreativeCandidate(c: CreativeCandidate): SmartNameCandidate {
  return {
    name: c.name,
    fullName: c.fullName,
    meaning: c.meaning ?? "",
    story: c.story || undefined,
    score: round1(c.creativityScore),
    scoreLabel: CREATIVE_SCORE_LABEL,
    tags: uniq([c.concept, c.surnameConnection].filter((t): t is string => typeof t === "string")),
    reasons: [],
    phonologyNotes: [],
  };
}

/** POST /recommendations/creative 응답(후보 배열) → 결과 화면 응답. 배열이 아니면 빈 결과 */
export function wrapCreativeResponse(res: unknown, lastName: string): SmartRecommendationResponse {
  const list = Array.isArray(res) ? (res as CreativeCandidate[]) : [];
  const names = list.filter((c) => c && c.name).map(mapCreativeCandidate);
  return singleCategory(lastName, "creative", "창의적 작명", "CreativeNamingEngine", names);
}

/** 점수 이름표만 붙인다 — 이미 이름표가 있으면(단독 화면이 만든 후보) 그대로 */
function withScoreLabel(c: SmartNameCandidate, scoreLabel: string): SmartNameCandidate {
  return c.scoreLabel ? c : { ...c, scoreLabel };
}

/**
 * /search 결과의 순우리말·3글자 탭 후보를 단독 화면과 같은 꼴로 — 칩 이름표·점수 이름표·평가 링크 한자.
 * 서버(SmartRecommendationService)는 순우리말 칩을 [genderFit, toneFit, '순우리말'], 3글자 칩을 [nameType, '3글자', ...조합 요소]로 보낸다.
 * 모양이 예상과 다르면(이미 한글 이름표 — 단독 화면이 만든 후보) 그대로 둔다.
 * 창의·특이 성씨 탭은 점수 이름표만 붙인다(칩은 서버 값 그대로) — 결과 화면(SmartResult)은 이름표가 없으면 'FINAL'(종합)로 적는다.
 */
export function normalizeSpecialtyTags(categoryType: string, c: SmartNameCandidate): SmartNameCandidate {
  if (categoryType === "creative") return withScoreLabel(c, CREATIVE_SCORE_LABEL);
  if (categoryType === "rare-surname") return withScoreLabel(c, SURNAME_HARMONY_SCORE_LABEL);
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

// ============================================================
// 네 단독 화면 공용 — 조건 칩 이름표 · 성씨 칸 검사
// ============================================================

const GENDER_CHIP: Record<string, string> = { male: "남", female: "여" };
const TONE_CHIP: Record<string, string> = { neutral: "중립", soft: "부드러움", strong: "강함" };

/**
 * 결과 화면 조건 칩(SubHeader)의 성별·톤 이름표 — 폼 값(none·male·female / neutral·soft·strong) → 한글.
 * 화면은 이 함수에 **제출 때 잡아 둔 값**을 넘긴다(응답을 기다리는 동안 폼을 고쳐도 칩이 결과와 어긋나지 않게).
 */
export function requestChipLabels(gender: string, tone: string): { gender?: string; tone: string } {
  return {
    gender: has(GENDER_CHIP, gender) ? GENDER_CHIP[gender] : undefined,
    tone: has(TONE_CHIP, tone) ? TONE_CHIP[tone] : TONE_CHIP.neutral,
  };
}

/** 성씨를 비우고 제출했을 때 — 네 화면이 원래 쓰던 문구 그대로 */
export const SURNAME_REQUIRED = "성씨를 입력해주세요.";

/**
 * 성씨 칸 검사(lib/name-input — 다른 도구 화면과 같은 규칙): 다듬은 값과, 막아야 하면 그 이유.
 * 끝 공백·풀어 쓴 한글(NFD)은 다듬어 보내고, 낱자모·가운데 공백·한글 아닌 글자·3글자 이상은 막는다.
 */
export function checkSpecialtySurname(raw: string | null | undefined): { value: string; error: string | null } {
  const value = cleanNameInput(raw);
  const problem = nameInputProblem(value, SURNAME_MAX_LENGTH);
  if (problem === null) return { value, error: null };
  return {
    value,
    error: problem === "empty" ? SURNAME_REQUIRED : nameInputMessage(problem, "성씨", SURNAME_MAX_LENGTH),
  };
}

// ============================================================
// /required-char 필수 글자 칸
// ============================================================
// 엔진(RequiredCharEngine)은 한글 음절이 아닌 이름 후보를 조용히 버리고(IsValidName), 사전에 없는 한자는 빈 목록으로 돌려준다 —
// 낱자모 'ㅈ'·영문 'a'·사전 밖 한자를 넣으면 이유 없이 '추천 결과를 찾지 못했어요'만 보였다. 고정 한자(항렬자)에는 불용 검사가 없어
// 死 를 넣으면 '윤사(죽을 사)' 50개가 주의 없이 나왔다. 서버도 나중에 같은 검사를 넣는다.

/** 필수 글자를 비우고 제출했을 때 — 화면이 원래 쓰던 문구 그대로 */
export const REQUIRED_CHAR_REQUIRED = "필수 글자를 입력해주세요.";
/** 한글 음절도 한자도 아닌 글자(영문·숫자·기호) */
export const REQUIRED_CHAR_NOT_USABLE = "필수 글자는 한글 한 음절이나 한자 한 글자로 넣어 주세요.";
/** 두 글자 이상 */
export const REQUIRED_CHAR_TOO_LONG = "필수 글자는 한 글자만 넣어 주세요.";
/** BMP 밖 한자(확장 B 이후) — 서버가 한 글자(UTF-16 한 칸)로 받지 못해 400 이 난다 */
export const REQUIRED_CHAR_OUTSIDE_BMP =
  "이 한자는 이 화면에서 받을 수 없는 글자예요. 같은 소리의 한글로 넣으면 그 소리의 한자 후보를 함께 보여 드려요.";

export type RequiredCharInput =
  | { ok: true; kind: "hangul" | "hanja"; char: string }
  | { ok: false; message: string };

/**
 * 필수 글자 칸 검사 — 한글 음절 한 글자(서)나 한자 한 글자(瑞)만 받는다.
 * 정리는 /evaluate 한자 칸과 같은 cleanHanjaText(공백·폭 없는 문자·홀로 남은 서로게이트를 지우고 호환 한자·강희 부수를 통합 한자로) 뒤 NFC
 * (풀어 쓴 한글을 모은다). 보낼 값은 정리한 그 한 글자다.
 */
export function checkRequiredCharInput(raw: string | null | undefined): RequiredCharInput {
  if (!raw || !raw.trim()) return { ok: false, message: REQUIRED_CHAR_REQUIRED };
  const chars = [...cleanHanjaText(raw).normalize("NFC")];
  if (chars.length === 0) return { ok: false, message: REQUIRED_CHAR_NOT_USABLE };
  if (chars.length > 1) return { ok: false, message: REQUIRED_CHAR_TOO_LONG };
  const ch = chars[0];
  if (isHangulSyllables(ch)) return { ok: true, kind: "hangul", char: ch };
  if (nameInputProblem(ch, 1) === "jamo") return { ok: false, message: nameInputMessage("jamo", "필수 글자", 1) };
  const cp = ch.codePointAt(0) ?? -1;
  if (isHanAfterClean(cp)) {
    return cp > 0xffff ? { ok: false, message: REQUIRED_CHAR_OUTSIDE_BMP } : { ok: true, kind: "hanja", char: ch };
  }
  return { ok: false, message: REQUIRED_CHAR_NOT_USABLE };
}

/** 훈 끝의 괄호 독음('오얏 리(이)')을 떼고 조사를 고른다 */
function topicAfterGloss(gloss: string): string {
  return josa(gloss.replace(/\s*\([^()]*\)\s*$/, ""), "은/는");
}

/**
 * 한자 필수 글자의 판정(/hanja/resolve 응답) → 막을지(이유 문장), 결과 위에 띄울 주의(없으면 null).
 * - 사전에 없는 글자: 막는다 — 엔진이 빈 목록을 돌려준다. '출생신고에 쓸 수 없는 글자'라고 쓰지 않는다(사전 9,105자가 대법원 목록을 다 싣지 못한다).
 * - 이름에 피하는 글자(불용 — 응답 hanja.forbidden, 정적 파일의 forbidden 과 같은 값): 넣은 글자라 그대로 추천하고 결과 위에 알린다.
 * - 한글 뜻 풀이가 없는 글자(hanja.hasMeaning 거짓): 결과 위에 알린다.
 */
export function requiredHanjaVerdict(
  res: HanjaResolveResponse | null | undefined,
  input: string
): { block: string } | { notice: string | null } {
  if (!res) return { notice: null };
  if (res.status === "not_hanja") return { block: REQUIRED_CHAR_NOT_USABLE };
  if (res.status === "not_in_dictionary") {
    const ch = res.character || input;
    const suggestion = res.suggestion?.character
      ? ` 모양만 조금 다른 ‘${res.suggestion.character}’ 글자는 사전에 있어요.`
      : "";
    return {
      block:
        `‘${ch}’ 글자는 이 사이트 한자 사전에 없어 이 글자로는 추천을 만들 수 없어요. 사전에 없다고 인명용 한자가 아니라는 뜻은 아니에요.` +
        `${suggestion} 같은 소리의 한글로 넣으면 그 소리의 한자 후보를 함께 보여 드려요.`,
    };
  }
  const fact = res.hanja;
  if (!fact) return { notice: null };
  const ch = fact.character || res.character || input;
  const head = fact.gloss ? `‘${ch}’(${fact.gloss})${topicAfterGloss(fact.gloss)}` : `‘${ch}’ 글자는`;
  if (fact.forbidden) {
    return {
      notice: `${head} 이 사이트가 이름에 피하는 글자로 두는 한자예요. 넣은 글자 그대로 추천했지만, 다른 추천에서는 이 글자를 고르지 않아요.`,
    };
  }
  if (!fact.hasMeaning) {
    return { notice: `‘${ch}’ 글자는 이 사이트 사전에 한글 뜻 풀이가 없어요. 카드의 뜻 줄에는 짝 글자의 뜻만 나올 수 있어요.` };
  }
  return { notice: null };
}

/**
 * 한글 필수 글자 중 쓸 한자가 없는 음절의 안내 — 색인(index.json, 서버 덤프)으로 판정한다. 그런 음절이 아니면 null.
 * - 색인에 없는 음절(봄·빛·바): 사전에 그 소리로 읽는 한자가 없다 — 엔진의 필수 글자 쪽 한자 목록이 비어 카드에는 짝 글자 한자만 붙는다.
 * - 쓸 글자가 0인 음절(몰·괵 — usable 0): 그 소리의 글자가 모두 이름에 피하는 글자·뜻 없는 글자라 엔진(OrderForDisplay)이 뺀다.
 * 입력 칸 아래(제출 전)와 결과 위에 같은 문장을 쓴다.
 */
export function requiredSyllableNote(syllable: string | null | undefined): string | null {
  const s = cleanNameInput(syllable);
  if (s.length !== 1 || !isHangulSyllables(s)) return null;
  const info = has(INDEX_SYLLABLES, s) ? INDEX_SYLLABLES[s] : undefined;
  const tail = " 한자 후보는 짝 글자에만 붙어요.";
  if (!info) return `‘${s}’ 음절은 이 사이트 사전에 그 소리로 읽는 한자가 없어 한글로 써요.${tail}`;
  if ((info.usable ?? 0) === 0 || info.autoEmpty === true) return `${noHanjaSyllableNote(s)}${tail}`;
  return null;
}
