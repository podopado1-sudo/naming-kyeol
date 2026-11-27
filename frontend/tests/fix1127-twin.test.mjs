// /twin 쌍둥이 화면 11/27 버그 묶음(G-twin) 테스트 — `npm test`
//
// 고친 것(버그 key — tmp/handoff-2026-11-26/research/bughunt-1127.json):
// - twin-detail-link-empty: 카드 '상세 보기 →'가 값 없는 /analysis 로 같은 탭에서 갔다 → 같은 조건의 /evaluate 를 새 탭으로
// - twin-edit-link-noop: '← 조건 수정'이 같은 경로 Link 라 눌러도 결과가 그대로였다 → onRegenerate 단추
// - twin-mobile-overflow: 결과 격자 repeat(2|3, 1fr)·폼 격자 '1.4fr 1fr' 이 375 폭에서 옆으로 넘쳤다 → minmax(0, …) + 좁은 폭 한 줄
// - labels-twin: 입력 라벨 6칸이 칸과 이어져 있지 않았다 → htmlFor ↔ id
// - twin-birthdate-required-unmarked: 출생일이 서버 필수인데 표시·사전 검사가 없었다 → '(필수)' + 제출 전 검사
// - twin-result-wording: 성별 칩 늘 '미지정', 칩이 지금 폼 값, 3명에게도 '쌍둥이'·'한 쌍'·'두 이름' → 제출 스냅샷·자녀 수 문구
// - twin-tabs-scroll-margin: 탭 줄로 스크롤하면 고정 머리 밑에 숨었다 → scrollMarginTop
// - print-twin-result: 인쇄에 조작 단추·탭이 찍히고 카드가 쪽 경계에서 갈렸다 → data-hide-print · print:break-inside-avoid
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const {
  coherenceNote,
  mapTwinResponse,
  twinConditionChips,
  twinEvaluateHref,
  twinGroupWord,
  twinResultTitle,
} = await import("../src/lib/twin-sets.ts");
const { inputFromParams } = await import("../src/app/evaluate/evaluate-params.ts");

// core.autocrlf 저장소라 작업 트리 파일은 CRLF 일 수 있다 — 줄 끝을 LF 로 맞춰 읽는다
const read = (rel) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const PAGE = read("app/twin/page.tsx");
const RESULT = read("components/design/TwinResult.tsx");
const TOP = read("components/design/TwinResultTop.tsx");
const CARDS = read("components/design/TwinResultCards.tsx");

/** 주석을 지운 소스 — 옛 코드를 설명하는 주석의 글자('/analysis' 등)에 걸리지 않게 */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// 지어낸 표본 — 김 · 서윤 · 2025-03-02
const CTX = {
  lastName: "김",
  count: 2,
  gender: "male",
  tone: "soft",
  birthDate: "2025-03-02",
  birthTime: "",
};

// ─── twin-detail-link-empty ─────────────────────────────────────────────

test("상세 보기 주소 = 같은 조건의 /evaluate(출생일·시각·성별·톤) — /evaluate 가 읽으면 같은 입력이 된다", () => {
  const href = twinEvaluateHref(CTX, "서윤");
  assert.ok(href.startsWith("/evaluate?"), href);
  assert.deepEqual(inputFromParams(new URLSearchParams(href.slice("/evaluate?".length))), {
    lastName: "김",
    name: "서윤",
    birthDate: "2025-03-02",
    birthTime: "",
    gender: "male",
    tone: "soft",
    hanja: "",
    lastHanja: "",
  });
  // 시각은 날짜와 함께 싣고, 기본값(성별 무관·중립 톤)은 주소에서 뺀다(evaluateHref 규칙)
  const withTime = new URLSearchParams(
    twinEvaluateHref({ ...CTX, gender: "none", tone: "neutral", birthTime: "09:30" }, "우선").split("?")[1]
  );
  assert.deepEqual([...withTime.keys()], ["lastName", "name", "birthDate", "birthTime"]);
  assert.equal(withTime.get("birthTime"), "09:30");
  assert.equal(withTime.get("name"), "우선");
  // 복성도 성 칸 그대로
  assert.equal(new URLSearchParams(twinEvaluateHref({ ...CTX, lastName: "남궁" }, "서윤").split("?")[1]).get("lastName"), "남궁");
});

test("원본 — 카드 링크는 값 없는 /analysis 기본값 없이 새 탭 <a> 로 /evaluate 를 연다", () => {
  const cards = code(CARDS);
  assert.doesNotMatch(cards, /\/analysis/);
  assert.doesNotMatch(cards, /from "next\/link"/); // /evaluate 정적 라우트의 라우터 캐시 잔상 — 일반 <a>
  assert.match(cards, /detailHref: string;/); // 기본값 없음 — 넘기지 않으면 타입 오류
  assert.doesNotMatch(cards, /detailHref\s*=/);
  assert.match(
    cards,
    /<a\s+href=\{detailHref\}\s+target="_blank"\s+rel="noopener"\s+aria-label=\{`상세 보기: \$\{lastName\}\$\{entry\.first\} \(새 탭\)`\}/
  );
  assert.match(cards, /<span aria-hidden="true"[^>]*>\s*↗\s*<\/span>/);
  // 결과 화면이 카드마다 제출 조건으로 주소를 만들어 넘긴다
  assert.match(code(RESULT), /detailHref=\{twinEvaluateHref\(context, entry\.first\)\}/);
});

// ─── twin-edit-link-noop ────────────────────────────────────────────────

test("원본 — '← 조건 수정'은 같은 경로 Link 가 아니라 onRegenerate 단추(입력값이 남은 폼으로)", () => {
  const result = code(RESULT);
  assert.doesNotMatch(result, /editHref/);
  assert.match(result, /<button\s+type="button"\s+onClick=\{onRegenerate\}\s+data-hide-print[^>]*>\s*← 조건 수정\s*<\/button>/);
  assert.match(result, /onRegenerate: \(\) => void;/); // 필수 — 없으면 동작 없는 단추가 된다
  assert.match(code(PAGE), /onRegenerate=\{handleReset\}/);
  // handleReset 은 결과만 지운다(입력 칸 상태는 그대로)
  const reset = /function handleReset\(\) \{([\s\S]*?)\n  \}/.exec(PAGE);
  assert.ok(reset, "handleReset 을 찾지 못했다");
  assert.match(reset[1], /setResult\(null\)/);
  assert.doesNotMatch(reset[1], /set(LastName|BirthDate|BirthTime|ChildCount|Gender|Tone)\(/);
  // 다시 만들지 않고 폼으로만 돌아가던 '↻ 새로 생성'은 지웠다(엔진이 같은 입력에 같은 세트를 준다)
  assert.doesNotMatch(code(TOP) + code(RESULT), /새로 생성/);
});

// ─── twin-mobile-overflow ───────────────────────────────────────────────

test("원본 — 결과 격자는 minmax(0, 1fr) 열 + 좁은 폭에서 한 줄, 연결 표시는 한 줄일 때 숨긴다", () => {
  const result = code(RESULT);
  assert.doesNotMatch(result, /repeat\((2|3), 1fr\)/);
  assert.doesNotMatch(result, /gridTemplateColumns:/);
  assert.match(result, /\.twin-pair-grid \{\s*display: grid;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(result, /\.twin-pair-grid--3 \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  const narrow = /@media \(max-width: 640px\) \{([\s\S]*?)\n        \}/.exec(result);
  assert.ok(narrow, "640px 규칙을 찾지 못했다");
  assert.match(narrow[1], /\.twin-pair-grid \{\s*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(narrow[1], /\.twin-connector \{\s*display: none;/);
  assert.match(result, /@media \(max-width: 860px\) \{\s*\.twin-pair-grid--3 \{\s*grid-template-columns: minmax\(0, 1fr\);/);
  // 열 수·연결 표시는 세트의 실제 이름 수(응답을 기다리는 동안 자녀 수를 고쳐도 격자가 어긋나지 않게)
  assert.match(result, /const pairCount = theme\.pair\.length;/);
  assert.match(result, /\{pairCount === 2 && \(\s*<div\s+className="twin-connector"/);
  assert.doesNotMatch(result, /context\.count === 2/);
  assert.match(code(CARDS), /minWidth: 0,/);
});

test("원본 — 입력 폼 격자도 minmax(0, …) 이고 640 이하 날짜·시각, 480 이하 선택 칸을 한 줄씩", () => {
  const page = code(PAGE);
  assert.doesNotMatch(page, /"1\.4fr 1fr"|"1fr 1fr 1fr"/);
  assert.match(page, /\.twin-form-row3 \{\s*display: grid;\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(page, /\.twin-form-row2 \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1\.4fr\) minmax\(0, 1fr\);/);
  assert.match(page, /@media \(max-width: 640px\) \{[\s\S]*?\.twin-form-row2 \{\s*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(page, /@media \(max-width: 480px\) \{\s*\.twin-form-row3 \{\s*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(page, /<div className="twin-form-row3">/);
  assert.match(page, /<div className="twin-form-row2">/);
  // 칸과 칸을 싼 상자 모두 최소 폭 0 — 날짜·시각 칸이 제 폭으로 열을 밀지 않게
  assert.match(page, /<div style=\{\{ minWidth: 0 \}\}>/);
  assert.equal([...page.matchAll(/width: "100%",\s*minWidth: 0,/g)].length, 2); // FormInput·FormSelect
});

// ─── labels-twin ────────────────────────────────────────────────────────

test("원본 — 라벨 6칸이 모두 htmlFor 로 칸 id 와 이어진다", () => {
  const page = code(PAGE);
  const pairs = [...page.matchAll(/<FormField id=\{FIELD_ID\.(\w+)\}[^>]*>\s*<Form(?:Input|Select)\s+id=\{FIELD_ID\.(\w+)\}/g)];
  assert.deepEqual(
    pairs.map((m) => m[1]),
    ["lastName", "childCount", "gender", "tone", "birthDate", "birthTime"]
  );
  for (const m of pairs) assert.equal(m[1], m[2], `라벨 ${m[1]} ↔ 칸 ${m[2]}`);
  assert.equal([...page.matchAll(/<FormField\b/g)].length, 6);
  assert.match(page, /<label\s+htmlFor=\{id\}/);
  assert.equal([...page.matchAll(/^\s*id=\{id\}$/gm)].length, 2); // <input>·<select>
  // id 는 화면 안에서 겹치지 않는다
  const ids = [...page.matchAll(/^\s+\w+: "(twin-[\w-]+)",$/gm)].map((m) => m[1]);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, 6);
});

// ─── twin-birthdate-required-unmarked ───────────────────────────────────

test("원본 — 출생일은 '(필수)' 표시 + 제출 전 검사(요청 전에 막고 그 칸으로 포커스)", () => {
  const page = code(PAGE);
  assert.match(page, /label="출생일 \(필수\)"/);
  assert.match(PAGE, /const BIRTH_DATE_MISSING = "생년월일을 입력해 주세요\.";/); // /rare-surname 과 같은 문장
  const submit = /async function handleSubmit\(e: FormEvent\) \{([\s\S]*?)\n  \}\n/.exec(page);
  assert.ok(submit, "handleSubmit 을 찾지 못했다");
  const body = submit[1];
  const surnameAt = body.indexOf("nameInputProblem(surname, SURNAME_MAX_LENGTH)");
  const birthAt = body.indexOf("if (!birthDate) {");
  const requestAt = body.indexOf("await twinNames(");
  assert.ok(surnameAt >= 0 && birthAt > surnameAt && requestAt > birthAt, "검사 순서: 성씨 → 출생일 → 요청");
  assert.match(body.slice(birthAt, requestAt), /fail\("birthDate", BIRTH_DATE_MISSING\);\s*return;/);
  assert.match(page, /document\.getElementById\(FIELD_ID\[field\]\)\?\.focus\(\)/);
  // 날짜 칸은 aria-required(네이티브 required 의 브라우저 말풍선이 오류 상자 안내를 가리지 않게 — 폼은 noValidate)
  assert.match(page, /<FormInput\s+id=\{FIELD_ID\.birthDate\}\s+type="date"[\s\S]*?ariaRequired\s+invalid=\{birthDateInvalid\}\s+describedBy=\{birthDateInvalid \? ERROR_ID : undefined\}/);
  assert.match(page, /<form\s+onSubmit=\{handleSubmit\}\s+noValidate/);
  assert.match(page, /<div\s+id=\{ERROR_ID\}\s+role="alert"/);
  assert.match(page, /aria-required=\{ariaRequired \|\| undefined\}/);
  assert.match(page, /aria-invalid=\{invalid \|\| undefined\}/);
});

test("원본 — 성씨는 공용 검사(lib/name-input)로 다듬어 그대로 보낸다(앞 두 글자로 자르지 않는다)", () => {
  const page = code(PAGE);
  assert.match(page, /const surname = cleanNameInput\(lastName\);/);
  assert.match(page, /problem === "empty"\s*\? SURNAME_MISSING\s*: nameInputMessage\(problem, "성씨", SURNAME_MAX_LENGTH\)/);
  assert.match(PAGE, /const SURNAME_MISSING = "성씨를 입력해주세요\.";/); // 이 화면의 기존 빈 칸 문구
  assert.doesNotMatch(page, /\.slice\(0, 2\)/);
  assert.match(page, /lastName: ctx\.lastName,\s*birthDate: ctx\.birthDate,/);
});

// ─── twin-result-wording ────────────────────────────────────────────────

test("조건 칩은 제출값 — 성별(남아·여아·성별 무관)·자녀 수·폼과 같은 톤 이름·출생일", () => {
  assert.deepEqual(twinConditionChips(CTX), ["성 김", "자녀 2명", "남아", "부드러운 톤", "출생일 2025-03-02"]);
  assert.deepEqual(
    twinConditionChips({ ...CTX, count: 3, gender: "female", tone: "strong", birthTime: "09:30" }),
    ["성 김", "자녀 3명", "여아", "강한 톤", "출생일 2025-03-02 09:30"]
  );
  assert.deepEqual(twinConditionChips({ ...CTX, gender: "none", tone: "neutral" }).slice(2, 4), ["성별 무관", "중립 톤"]);
  for (const g of ["none", "male", "female"]) assert.ok(!twinConditionChips({ ...CTX, gender: g }).includes("미지정"));
});

test("자녀 3명에게 '쌍둥이'·'한 쌍'·'두 이름'을 쓰지 않는다 — 두 명 문장은 예전 그대로", () => {
  assert.equal(twinGroupWord(2), "쌍둥이");
  assert.equal(twinGroupWord(3), "세쌍둥이");
  assert.equal(twinResultTitle("김", 2), "김 씨 쌍둥이를 위한 이름 세트");
  assert.equal(twinResultTitle("남궁", 3), "남궁 씨 세쌍둥이를 위한 이름 세트");
  assert.equal(coherenceNote(90), "두 이름의 음운·의미·톤이 잘 맞물려요");
  assert.equal(coherenceNote(80), "한 쌍으로서 안정적인 결을 가져요");
  assert.equal(coherenceNote(90, 3), "세 이름의 음운·의미·톤이 잘 맞물려요");
  assert.equal(coherenceNote(80, 3), "한 세트로서 안정적인 결을 가져요");
  for (const s of [90, 80, 60, 40]) assert.doesNotMatch(coherenceNote(s, 3), /두 이름|한 쌍|쌍둥이/);
  // 응답 세트의 이름 수로 고른다
  const cand = (name) => ({ name, aestheticScore: 60, harmonyScore: 70, finalScore: 65, reasons: [] });
  const sets = mapTwinResponse({
    id: "x",
    nameSets: [
      { theme: "공유글자", themeDescription: "'우' 첫글자를 공유하는 이름 세트", names: ["우선", "우철", "우준"].map(cand), coherenceScore: 80 },
      { theme: "공유글자", themeDescription: "'우' 첫글자를 공유하는 이름 세트", names: ["우선", "우철"].map(cand), coherenceScore: 80 },
    ],
  });
  assert.equal(sets[0].coherenceNote, "한 세트로서 안정적인 결을 가져요");
  assert.equal(sets[1].coherenceNote, "한 쌍으로서 안정적인 결을 가져요");
  assert.deepEqual(sets[0].pair.map((p) => p.position), ["첫째", "둘째", "셋째"]);
});

test("원본 — 결과 화면은 제출 스냅샷으로 그린다(지금 폼 값·relation 'any' 고정 없음)", () => {
  const page = code(PAGE);
  assert.doesNotMatch(page, /relation/);
  assert.match(page, /const ctx: TwinContext = \{\s*lastName: surname,\s*count: childCount === "3" \? 3 : 2,\s*gender,\s*tone,\s*birthDate,\s*birthTime,\s*\};/);
  // 스냅샷은 요청을 보내기 전에 만들고, 응답이 오면 결과와 함께 넣는다
  assert.ok(page.indexOf("const ctx: TwinContext") < page.indexOf("await twinNames("));
  assert.match(page, /setResult\(data\);\s*setSubmitted\(ctx\);/);
  assert.match(page, /if \(result && submitted && result\.nameSets\.length > 0\)/);
  assert.match(page, /context=\{submitted\}/);
  // 칩·제목은 twin-sets 헬퍼(자녀 수·성별)로
  assert.doesNotMatch(code(TOP), /relation|미지정|소프트 톤/);
  assert.match(code(TOP), /const chips = twinConditionChips\(ctx\);/);
  assert.match(code(RESULT), /\{twinResultTitle\(context\.lastName, context\.count\)\}/);
  assert.doesNotMatch(code(RESULT), /씨 쌍둥이를 위한/);
  // 입력 화면 머리도 3명이면 '둘이'·'한 쌍'이 아니다
  assert.match(page, /three \? "셋이 함께, 각자 빛나는 이름" : "둘이 함께, 각자 빛나는 이름"/);
  assert.match(page, /세 가지 테마로 세 이름을 한 세트로 골라드릴게요/);
});

// ─── twin-tabs-scroll-margin ────────────────────────────────────────────

test("원본 — 탭 줄로 스크롤할 때 고정 머리(약 57px) 아래에 멈춘다", () => {
  const result = code(RESULT);
  const margin = /const TABS_SCROLL_MARGIN = (\d+);/.exec(result);
  assert.ok(margin && Number(margin[1]) >= 64, "scrollMarginTop 이 머리 높이보다 커야 한다");
  assert.match(result, /<div\s+ref=\{tabsRef\}\s+data-hide-print\s+style=\{\{[^}]*scrollMarginTop: TABS_SCROLL_MARGIN,/);
  // 탭 줄로 가는 두 길(다른 세트 보기 ↑ · 다른 테마 카드)이 모두 그 div 로 스크롤한다
  assert.equal([...result.matchAll(/tabsRef\.current\?\.scrollIntoView\(/g)].length, 2);
});

// ─── print-twin-result ──────────────────────────────────────────────────

test("원본 — 인쇄에서 조작 요소를 빼고(data-hide-print) 카드는 쪽 경계에서 갈리지 않는다", () => {
  const result = code(RESULT);
  // 탭(위 테스트)·세트 고르기·'다른 세트 보기 ↑'·다른 테마 줄·결과 화면 꼬리말·'← 조건 수정'
  assert.match(result, /\{group\.sets\.length > 1 && \(\s*<div data-hide-print style=\{\{ marginBottom: 20 \}\}>\s*<SetChips/);
  assert.match(result, /\{themes\.length > 1 && \(\s*<div\s+data-hide-print\s+style=\{\{[\s\S]*?다른 세트 보기 ↑/);
  assert.match(result, /\{otherGroups\.length > 0 && \(\s*<div data-hide-print style=\{\{ marginTop: 72 \}\}>/);
  assert.match(result, /<footer\s+data-hide-print/);
  assert.match(result, /<div className="print:break-inside-avoid" style=\{\{ marginBottom: 28 \}\}>\s*<CoherenceHero/);
  const cards = code(CARDS);
  assert.match(cards, /export function PairCard\([\s\S]*?<div\s+className="print:break-inside-avoid"/);
  assert.match(cards, /<div data-hide-print>\s*<div\s+style=\{\{\s*height: 1,[\s\S]*?\}\}\s*\/>\s*<a\s+href=\{detailHref\}/);
  // 결과 머리의 저장 단추(넘길 때만)도 감싼 상자에 data-hide-print — Button 은 속성을 넘기지 않는다
  assert.match(code(TOP), /\{onSave && \(\s*<div data-hide-print/);
});
