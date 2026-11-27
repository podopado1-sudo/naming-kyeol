// 11/27 버그 목록 묶음 G-parent-rare — /parent-based·/rare-surname 폼과 결과 화면(SmartResultParent·SmartResultRare) — `npm test`
//
// 고정하는 것(버그 key):
//  - parent-rare-dead-links: '← 조건 수정'·'↻ 새로 생성'은 onRegenerate 단추(옛 조건 수정은 같은 경로 Link 라 무동작), 꼬리 링크는 /about·/contact(옛 '#')
//  - parent-based-input-unvalidated·rare-surname-input-unvalidated: 성씨·부모 이름 칸의 한글·길이·복성 검사(lib/name-input)와 maxLength
//  - labels-parent-rare: 라벨 htmlFor ↔ 칸 id(Base UI Select 는 트리거 id)
//  - parent-rare-tabs-under-header: 탭 줄을 고정 머리말 아래로(옛 계산은 배너 위 80px — 탭 줄이 머리말 밑으로 숨었다)
//  - parent-banner-mismatch: 부모 배너 머리글자 = 이름 첫 글자, 강조 = 설명이 말한 글자 자리 하나, 키워드 칩은 키워드 방식만
//  - form-snapshot-parent-rare: 결과는 제출 때 값으로 그리고 기다리는 동안 입력을 잠근다
//  - 인쇄: 단추·탭·링크는 data-hide-print
//
// .tsx 는 node 가 바로 읽지 못해, 순수 함수는 파일 안 `// #region 이름` ~ `// #endregion 이름` 구간(JSX·import 없음)을 떼어
// 임시 .ts 로 써서 읽는다(구간이 쓰는 lib 함수는 여기서 import 줄을 붙인다). 나머지는 소스 문자열 검사.
// 표본 이름은 지어낸 값이고, 기대값은 손으로 정했다(설명 문장은 백엔드 ParentBasedNamingEngine 의 꼴을 따라 손으로 썼다).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import "./resolve-ts.mjs";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");
const libUrl = (name) => pathToFileURL(path.join(SRC, "lib", `${name}.ts`)).href;
// 주석은 빼고 본다(옛 꼴을 적은 주석이 남아 있다)
const stripComments = (s) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const PARENT_PAGE = "app/parent-based/page.tsx";
const RARE_PAGE = "app/rare-surname/page.tsx";
const PARENT_RESULT = "components/design/SmartResultParent.tsx";
const RARE_RESULT = "components/design/SmartResultRare.tsx";

let tmp;
after(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** tsx 안 순수 함수 구간을 임시 .ts 모듈로 읽는다 — imports = { lib 파일 이름: [이름…] } */
async function loadRegion(rel, name, imports, names) {
  const src = read(rel);
  const start = src.indexOf(`// #region ${name}`);
  const end = src.indexOf(`// #endregion ${name}`);
  assert.ok(start >= 0 && end > start, `${rel}: '// #region ${name}' 구간을 찾지 못했다`);
  tmp ??= mkdtempSync(path.join(tmpdir(), "fix1127-parent-rare-"));
  const head = Object.entries(imports)
    .map(([lib, ids]) => `import { ${ids.join(", ")} } from ${JSON.stringify(libUrl(lib))};`)
    .join("\n");
  const file = path.join(tmp, `${name}.ts`);
  writeFileSync(file, `${head}\n${src.slice(start, end)}\nexport { ${names.join(", ")} };\n`);
  return import(pathToFileURL(file).href);
}

const NAME_INPUT = ["cleanNameInput", "nameInputMessage", "nameInputProblem", "SURNAME_MAX_LENGTH"];
const COMPOUND_LIST = "남궁·독고·동방·사공·서문·선우·제갈·황보·강전·망절";

// ─── 입력 검사: /parent-based ─────────────────────────────────────

const parentForm = await loadRegion(
  PARENT_PAGE,
  "parent-form",
  {
    "name-input": NAME_INPUT,
    "name-split": ["COMPOUND_SURNAMES"],
    josa: ["josa"],
    "parent-naming": ["KEYWORD_HANGUL_REQUIRED", "keywordHasHangul"],
  },
  ["cleanParentForm", "parentFormError", "PARENT_NAME_MAX_LENGTH", "BIRTH_DATE_REQUIRED"]
);

const BASE = {
  babySurname: "김",
  fatherSurname: "김",
  fatherName: "민수",
  motherSurname: "이",
  motherName: "서윤",
  storyKeyword: "",
  birthDate: "2025-03-02",
  birthTime: "",
  gender: "none",
  tone: "neutral",
};

test("/parent-based 검사 — 바른 값은 통과, 외자·복성·성 칸 빈 부모도 받는다", () => {
  const { parentFormError } = parentForm;
  assert.equal(parentFormError(BASE), null);
  assert.equal(parentFormError({ ...BASE, fatherName: "철" }), null, "외자 부모 이름");
  assert.equal(parentFormError({ ...BASE, babySurname: "남궁", fatherSurname: "남궁" }), null, "복성");
  assert.equal(parentFormError({ ...BASE, motherSurname: "", motherName: "서윤" }), null, "성 칸을 비운 부모");
  assert.equal(parentFormError({ ...BASE, fatherSurname: "", fatherName: "", motherSurname: "", motherName: "", storyKeyword: "사랑" }), null, "키워드만");
  assert.equal(parentFormError({ ...BASE, motherName: "가".repeat(parentForm.PARENT_NAME_MAX_LENGTH) }), null, "상한 글자 수까지");
});

const PARENT_CASES = [
  // [바꾼 칸, 기대 칸, 기대 문장]
  [{ babySurname: "" }, "babySurname", "자녀 성씨를 입력해주세요."],
  [{ babySurname: "Kim" }, "babySurname", "자녀 성씨는 한글로만 입력해주세요."],
  [{ babySurname: "金" }, "babySurname", "자녀 성씨는 한글로만 입력해주세요."],
  [{ babySurname: "ㄱ" }, "babySurname", "자녀 성씨는 ㄱ·ㅏ 같은 낱자 없이 완성된 한글로 입력해주세요."],
  [{ babySurname: "김민" }, "babySurname", `자녀 성씨 '김민'은 복성 목록(${COMPOUND_LIST})에 없어요. 성씨만 적어 주세요.`],
  [{ babySurname: "남궁민" }, "babySurname", "자녀 성씨는 2글자까지 입력할 수 있어요."],
  [{ birthDate: "" }, "birthDate", "생년월일을 입력해 주세요."],
  [{ fatherName: "Minsu" }, "fatherName", "아버지 이름은 한글로만 입력해주세요."],
  [{ fatherSurname: "金", fatherName: "民秀" }, "fatherSurname", "아버지 성씨는 한글로만 입력해주세요."],
  [{ fatherName: "민 수" }, "fatherName", "아버지 이름은 띄어 쓰지 말고 붙여서 입력해주세요."],
  [{ motherSurname: "이수" }, "motherSurname", `어머니 성씨 '이수'는 복성 목록(${COMPOUND_LIST})에 없어요. 성씨만 적어 주세요.`],
  [{ motherName: "ㅅㅇ" }, "motherName", "어머니 이름은 ㄱ·ㅏ 같은 낱자 없이 완성된 한글로 입력해주세요."],
  [{ motherName: "가".repeat(11) }, "motherName", "어머니 이름은 10글자까지 입력할 수 있어요."],
  [{ motherName: "서윤123" }, "motherName", "어머니 이름은 한글로만 입력해주세요."],
  [{ fatherName: "", motherName: "", storyKeyword: "" }, null, "부모 이름 또는 스토리 키워드 중 하나는 입력해주세요."],
  [{ fatherName: "", motherName: "", storyKeyword: "tree" }, "storyKeyword", "스토리 키워드는 한글로 적어 주세요(예: 사랑, 희망, 빛)."],
];
for (const [patch, field, message] of PARENT_CASES) {
  test(`/parent-based 검사 ${JSON.stringify(patch)} → ${field}`, () => {
    assert.deepEqual(parentForm.parentFormError({ ...BASE, ...patch }), { field, message });
  });
}

test("/parent-based 다듬기 — 성·이름은 NFC + 앞뒤 공백, 키워드는 앞뒤 공백만, 나머지는 그대로", () => {
  const v = parentForm.cleanParentForm({
    ...BASE,
    babySurname: " 김 ",
    fatherName: "민수".normalize("NFD"),
    motherName: " 서윤",
    storyKeyword: "  사랑 ",
    birthTime: "09:30",
  });
  assert.equal(v.babySurname, "김");
  assert.equal(v.fatherName, "민수");
  assert.equal(v.motherName, "서윤");
  assert.equal(v.storyKeyword, "사랑");
  assert.equal(v.birthDate, "2025-03-02");
  assert.equal(v.birthTime, "09:30");
  assert.equal(parentForm.parentFormError(v), null);
});

// ─── 입력 검사: /rare-surname ─────────────────────────────────────

const rareForm = await loadRegion(
  RARE_PAGE,
  "rare-surname-input",
  { "name-input": NAME_INPUT, "name-split": ["COMPOUND_SURNAMES"], josa: ["josa"] },
  ["rareSurnameError"]
);

const RARE_CASES = [
  ["", "성씨를 입력해주세요."],
  ["   ", "성씨를 입력해주세요."],
  ["金", "성씨는 한글로만 입력해주세요."],
  ["Kim", "성씨는 한글로만 입력해주세요."],
  ["ㄱ", "성씨는 ㄱ·ㅏ 같은 낱자 없이 완성된 한글로 입력해주세요."],
  ["김씨", `성씨 '김씨'는 복성 목록(${COMPOUND_LIST})에 없어요. 성씨만 적어 주세요.`],
  ["남궁민", "성씨는 2글자까지 입력할 수 있어요."],
  ["남 궁", "성씨는 띄어 쓰지 말고 붙여서 입력해주세요."],
  // 받는 값 — 한 글자는 목록을 보지 않는다(희귀 성씨 도구), 두 글자는 복성 목록
  ["남궁", null],
  ["선우", null],
  ["망절", null],
  ["봉", null],
  [" 탁 ", null],
  ["김", null],
];
for (const [input, expected] of RARE_CASES) {
  test(`/rare-surname 검사 ${JSON.stringify(input)} → ${expected ?? "통과"}`, () => {
    assert.equal(rareForm.rareSurnameError(input), expected);
  });
}

// ─── 부모 배너: 머리글자·강조·키워드 칩 ─────────────────────────────

const banner = await loadRegion(PARENT_RESULT, "parent-banner", { "parent-naming": ["familyMeaningRoles"] }, [
  "parentInitial",
  "computeBridge",
  "keywordChipFor",
]);

const person = (surname, given) => ({ fullName: `${surname}${given}`, surname: surname || undefined, givenName: given || undefined });
const cand = (fullName, namingModel, namingCode, meaning, hanjaName) => ({
  fullName,
  namingModel,
  namingCode,
  meaning,
  hanjaName,
  tags: [],
  reasons: [],
  phonologyNotes: [],
  evaluateHref: "/evaluate",
});

test("머리글자 — 성을 뺀 이름 첫 글자(복성 남궁민수 → '민', 성 칸 빈 지호 → '지'), 성만 넣으면 성", () => {
  const { parentInitial } = banner;
  assert.equal(parentInitial(person("남궁", "민수")), "민");
  assert.equal(parentInitial(person("김", "민수")), "민");
  assert.equal(parentInitial(person("", "지호")), "지");
  assert.equal(parentInitial(person("김", "")), "김");
});

test("강조 — 어머니 정수정의 이름 '정'만 칠한다(성 '정'은 칠하지 않는다)", () => {
  const b = banner.computeBridge(
    cand("김정민", "phonetic", "mother-syllable", "어머니 이름의 '정'에 '민'을 더한 이름"),
    { father: person("김", "민수"), mother: person("정", "수정") },
    "김"
  );
  assert.equal(b.motherIdx, 2);
  assert.equal(b.fatherIdx, null, "짝 글자 '민'은 아버지 글자가 아니다");
  assert.deepEqual(b.childIdx, [1]);
});

test("강조 — 어머니 성씨 '이' + 짝 글자 '수'(이수)는 아버지 민수의 '수'를 칠하지 않는다", () => {
  const b = banner.computeBridge(
    cand("김이수", "phonetic", "mother-surname", "어머니 성씨 '이'를 첫 글자로 잇고 '수'를 더한 이름"),
    { father: person("김", "민수"), mother: person("이", "수진") },
    "김"
  );
  assert.equal(b.fatherIdx, null);
  assert.equal(b.motherIdx, 0, "어머니 성 자리");
  assert.deepEqual(b.childIdx, [1]);
});

test("강조 — 어머니 성씨 소리 잇기(이 → 리)는 어머니 성과 아이 끝 글자", () => {
  const b = banner.computeBridge(
    cand("김혜리", "phonetic", "mother-sound", "어머니 성씨 '이'를 끝 글자 '리'로 바꿔 잇고 앞에 '혜'를 둔 이름"),
    { father: person("김", "민수"), mother: person("이", "수진") },
    "김"
  );
  assert.equal(b.motherIdx, 0);
  assert.deepEqual(b.childIdx, [2]);
});

test("강조 — 부모 첫 글자 잇기는 두 부모와 아이 두 자리, 부모 공통 글자는 셋 다 그 글자", () => {
  const initials = banner.computeBridge(
    cand("김민서", "phonetic", "parent-initials", "아버지 이름 첫 글자 '민'과 어머니 이름 첫 글자 '서'를 이은 이름"),
    { father: person("김", "민수"), mother: person("이", "서연") },
    "김"
  );
  assert.deepEqual([initials.fatherIdx, initials.motherIdx, initials.childIdx], [1, 1, [1, 2]]);
  const shared = banner.computeBridge(
    cand("김수안", "narrative", "shared-syllable", "아버지와 어머니 이름에 함께 있는 '수'에 '안'을 더한 이름"),
    { father: person("김", "민수"), mother: person("이", "수진") },
    "김"
  );
  assert.deepEqual([shared.fatherIdx, shared.motherIdx, shared.childIdx], [2, 1, [1]]);
  assert.equal(shared.color, "var(--color-navy)");
});

test("강조 — 키워드 방식은 아이 이름 글자가 우연히 부모 이름에 있어도 칠하지 않는다", () => {
  const b = banner.computeBridge(
    cand("김수안", "narrative", "keyword-meaning", "키워드 '사랑'의 뜻 '사랑'을 담은 '안'에 '수'를 더한 이름"),
    { father: person("김", "민수"), mother: person("이", "수진") },
    "김"
  );
  assert.deepEqual([b.fatherIdx, b.motherIdx, b.childIdx], [null, null, []]);
});

test("강조 — 복성 부모·복성 아이는 성 뒤 자리", () => {
  const b = banner.computeBridge(
    cand("남궁민호", "phonetic", "father-initial", "아버지 이름 첫 글자 '민'에 '호'를 더한 이름"),
    { father: person("남궁", "민수") },
    "남궁"
  );
  assert.equal(b.fatherIdx, 2);
  assert.deepEqual(b.childIdx, [2]);
});

test("의미 계승형 — 설명이 말한 부모의 이름 자리와 주석(옛 동작 유지)", () => {
  const b = banner.computeBridge(
    cand(
      "김수민",
      "semantic",
      "family-meaning",
      "어머니 이름의 '수'를 '빼어날 수', 아버지 이름의 '민'을 '민첩할 민'으로 풀어 두 뜻을 함께 담은 이름",
      "秀敏"
    ),
    { father: person("김", "민수"), mother: person("이", "수진") },
    "김"
  );
  assert.equal(b.fatherIdx, 1);
  assert.equal(b.motherIdx, 1);
  assert.deepEqual(b.childIdx, []);
  assert.equal(b.annotation, "수(秀) + 민(敏) · 의미축 잇기");
  assert.equal(b.color, "var(--color-gold-800)");
});

test("설명을 못 읽는 음운 계승형(옛 응답 꼴)은 부모 이름(성 제외)에서 찾는다", () => {
  const b = banner.computeBridge(cand("김민호", "phonetic", undefined, ""), { father: person("김", "민수") }, "김");
  assert.equal(b.fatherIdx, 1);
  assert.deepEqual(b.childIdx, [1]);
});

test("'키워드 \"…\" 매핑' 칩 — 키워드 방식 후보에만", () => {
  const { keywordChipFor } = banner;
  assert.equal(keywordChipFor(cand("김수안", "narrative", "shared-syllable", ""), "사랑"), null);
  assert.equal(keywordChipFor(cand("김수안", "narrative", "surname-meaning", ""), "사랑"), null);
  assert.equal(keywordChipFor(cand("김예음", "narrative", "keyword-sound", ""), "사랑"), "사랑");
  assert.equal(keywordChipFor(cand("김예음", "narrative", "keyword-meaning", ""), "사랑"), "사랑");
  assert.equal(keywordChipFor(cand("김예음", "narrative", "keyword-meaning", ""), undefined), null);
  assert.equal(keywordChipFor(cand("김예음", "narrative", undefined, ""), "사랑"), null, "방식 코드가 없으면 칩 없음");
});

test("어댑터 — 방식 코드 원값과 부모 성을 결과 화면에 넘긴다", () => {
  const src = read(PARENT_PAGE);
  assert.match(src, /namingCode: c\.namingModel \|\| undefined,/);
  assert.match(src, /surname: fatherSurname \|\| undefined, givenName: fatherGiven \|\| undefined/);
  assert.match(src, /surname: motherSurname \|\| undefined, givenName: motherGiven \|\| undefined/);
});

// ─── 죽은 링크·단추 ────────────────────────────────────────────────

for (const rel of [PARENT_RESULT, RARE_RESULT]) {
  test(`${rel} — '← 조건 수정'·'↻ 새로 생성'은 onRegenerate 단추, 꼬리 링크는 /about·/contact`, () => {
    const code = stripComments(read(rel));
    assert.doesNotMatch(code, /href="#"/, "빈 링크가 남았다");
    assert.doesNotMatch(code, /editHref/, "같은 경로로 가는 '조건 수정' Link 가 남았다");
    assert.match(code, /<button\s+type="button"\s+onClick=\{onRegenerate\}\s+data-hide-print\s+style=\{\w+\}\s*>\s*← 조건 수정/);
    assert.match(code, /<div data-hide-print[^>]*>\s*\{onRegenerate && \(\s*<button type="button" onClick=\{onRegenerate\}[^>]*>\s*↻ 새로 생성/);
    assert.match(code, /<footer\s+data-hide-print/);
    assert.match(code, /<Link\s+href="\/about"[\s\S]*?이름의 결에 대하여\s*<\/Link>/);
    assert.match(code, /<Link\s+href="\/contact"[\s\S]*?문의\s*<\/Link>/);
  });
}

test("두 폼 페이지 — 결과 화면에 같은 경로 editHref 를 넘기지 않고 onRegenerate 만", () => {
  for (const rel of [PARENT_PAGE, RARE_PAGE]) {
    const code = stripComments(read(rel));
    assert.doesNotMatch(code, /editHref/, rel);
    assert.match(code, /onRegenerate=\{handleReset\}/, rel);
  }
});

// ─── 탭 스크롤·인쇄 ────────────────────────────────────────────────

for (const rel of [PARENT_RESULT, RARE_RESULT]) {
  test(`${rel} — 탭을 바꾸면 탭 줄을 머리말 아래로, 고른 탭을 가운데로 / 조작 요소는 인쇄에서 숨김`, () => {
    const code = stripComments(read(rel));
    assert.doesNotMatch(code, /getBoundingClientRect\(\)\.top\s*\+\s*window\.scrollY\s*-\s*80/, "옛 배너 기준 계산(-80)");
    assert.match(code, /const headerH = header\?\.getBoundingClientRect\(\)\.height \|\| STICKY_HEADER_FALLBACK;/);
    assert.match(code, /row\.getBoundingClientRect\(\)\.top \+ window\.scrollY - headerH - 8/);
    assert.match(code, /scroller\.scrollTo\(\{ left:/);
    assert.match(code, /scrollTabsIntoView\(headerRef\.current, tabsRowRef\.current, tabsScrollerRef\.current\)/);
    assert.match(code, /<header\s+ref=\{headerRef\}/);
    assert.match(code, /ref=\{rowRef\}\s+data-hide-print/, "탭 줄 인쇄 숨김");
    assert.match(code, /aria-pressed=\{isActive\}/);
    // '이 이름 평가하기' 링크는 모두 data-hide-print
    const links = [...code.matchAll(/<a\b[^>]*>\s*이 이름 평가하기/g)];
    assert.ok(links.length >= 1);
    for (const [a] of links) assert.match(a, /data-hide-print/, a);
    // 펼침 '▸ 이름의 결' 단추·후보 카드 쪽 나눔
    assert.match(code, /data-hide-print\s+onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*setOpen/);
    assert.match(code, /<article\s+className="print:break-inside-avoid"/);
  });
}

test("부모 결과 — 작명 모델 켜고 끄기 칸은 인쇄에서 숨김, 아이 카드는 폰 폭에서 배너 안", () => {
  const code = stripComments(read(PARENT_RESULT));
  assert.match(code, /<BannerStat label="작명 모델" hidePrint>/);
  assert.match(code, /data-hide-print=\{hidePrint \|\| undefined\}/);
  assert.match(code, /minWidth: "min\(280px, 100%\)"/);
});

test("두 결과 화면 — 띠(배너)에 좌우 24px 바깥 여백", () => {
  assert.match(read(PARENT_RESULT), /<div data-banner-anchor style=\{\{ padding: "0 24px" \}\}>\s*\{isParent \?/);
  assert.match(read(RARE_RESULT), /<div style=\{\{ padding: "0 24px" \}\}>\s*<RareSurnameBanner/);
});

// ─── 제출 스냅샷·입력 잠금 ──────────────────────────────────────────

test("/parent-based — 결과는 제출 때 값(submitted)으로, 기다리는 동안 세 묶음 잠금", () => {
  const code = stripComments(read(PARENT_PAGE));
  assert.match(code, /setSubmitted\(values\);/);
  assert.match(code, /if \(hasResult && results\.length > 0 && submitted\) \{\s*const data = buildParentResultData\(results, submitted\);/);
  assert.equal((code.match(/<fieldset disabled=\{loading\}/g) ?? []).length, 3);
  // 요청도 다듬은 값으로
  assert.match(code, /lastName: values\.babySurname,/);
  assert.match(code, /fatherName: values\.fatherName \|\| undefined,/);
});

test("/rare-surname — 결과는 제출 때 값(submitted)으로, 기다리는 동안 입력 잠금, 다듬은 성씨를 보낸다", () => {
  const code = stripComments(read(RARE_PAGE));
  assert.match(code, /const snapshot: RareSubmitted = \{ birthDate, birthTime, gender, tone \};/);
  assert.match(code, /setSubmitted\(snapshot\);/);
  assert.match(code, /if \(result && result\.candidates\.length > 0 && submitted\) \{\s*const data = buildRareResultData\(result, submitted\);/);
  assert.match(code, /<fieldset disabled=\{loading\}/);
  assert.match(code, /lastName: surname,/);
});

test("/rare-surname — 출생일 '(필수)'·BIRTH_DATE_MISSING 가드는 그대로(사용자 결정 전 — rare-surname-birthdate-unused)", () => {
  const code = read(RARE_PAGE);
  assert.match(code, /<span className="text-\[10px\] text-muted-foreground">\(필수\)<\/span>/);
  assert.match(code, /if \(!birthDate\) \{\s*setError\(BIRTH_DATE_MISSING\);/);
});

// ─── 라벨·maxLength ────────────────────────────────────────────────

const LABELS = {
  [PARENT_PAGE]: {
    inputs: ["babySurname", "birthDate", "birthTime", "fatherSurname", "fatherName", "motherSurname", "motherName", "storyKeyword"],
    selects: ["gender", "tone"],
  },
  [RARE_PAGE]: { inputs: ["lastName", "birthDate", "birthTime"], selects: ["gender", "tone", "count"] },
};
for (const [rel, { inputs, selects }] of Object.entries(LABELS)) {
  test(`${rel} — 라벨마다 htmlFor, 그 id 의 칸(Select 는 트리거 id)`, () => {
    const code = stripComments(read(rel));
    const labels = [...code.matchAll(/<Label\b([^>]*)>/g)].map((m) => m[1]);
    for (const attrs of labels) assert.match(attrs, /htmlFor="/, `htmlFor 없는 라벨: <Label${attrs}>`);
    const fors = labels.map((a) => /htmlFor="([^"]+)"/.exec(a)[1]).sort();
    assert.deepEqual(fors, [...inputs, ...selects].sort());
    for (const id of inputs) assert.match(code, new RegExp(`<Input\\s+id="${id}"`), `${id} 칸`);
    for (const id of selects) assert.match(code, new RegExp(`<SelectTrigger id="${id}"`), `${id} 트리거`);
  });
}

test("칸 길이 — 성씨 칸은 SURNAME_MAX_LENGTH, 부모 이름 칸은 PARENT_NAME_MAX_LENGTH(10)", () => {
  const parent = read(PARENT_PAGE);
  for (const id of ["babySurname", "fatherSurname", "motherSurname"]) {
    assert.match(parent, new RegExp(`id="${id}"[^/]*?maxLength=\\{SURNAME_MAX_LENGTH\\}`), id);
  }
  for (const id of ["fatherName", "motherName"]) {
    assert.match(parent, new RegExp(`id="${id}"[^/]*?maxLength=\\{PARENT_NAME_MAX_LENGTH\\}`), id);
  }
  assert.equal(parentForm.PARENT_NAME_MAX_LENGTH, 10);
  assert.match(read(RARE_PAGE), /id="lastName"[^/]*?maxLength=\{SURNAME_MAX_LENGTH\}/);
});
