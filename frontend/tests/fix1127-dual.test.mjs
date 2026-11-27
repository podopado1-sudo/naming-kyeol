// /dual-name 입력 폼·결과 화면 고침 고정 (2026-11-27 버그 목록 G-dual) — `npm test`
//
//   dual-tone-ignored            톤 칸 라벨 '톤 (이름 평가 점수에만 쓰여요)', 결과 칩 '평가 톤 …'(엔진이 톤을 읽지 않는다 — 평가 링크에만)
//   dual-english-label-fallback  영어 이름을 비운 결과에 첫 후보의 영어 이름(Philip)을 '선호 영어 이름'으로 쓰지 않는다
//   dual-dead-controls           '○○으로 결정하기 ✓'·카드 선택·'다른 연결 방식'·'↻ 연결 방식 바꾸기'·'↻ 새로 생성'을 지우고
//                                '← 조건 수정'은 onRegenerate 단추 하나, footer 는 /about·/contact
//   dual-placeholder-no-results  영어 이름 예시(placeholder)는 실제로 후보가 나오는 이름 — 서버 데이터로 확인
//   labels-dual                  라벨 htmlFor ↔ 칸 id (select 포함)
//   dual-mobile-overflow         폼 격자·매핑 배너가 휴대폰 폭에서 한 열
//
// 화면 파일(.tsx)은 node 가 읽지 못해 소스 문자열로 본다(주석은 빼고 — 지운 이유를 적은 주석에 옛 문구가 남아 있다).
// placeholder 검사는 백엔드 DualNameEngine 의 후보 조건을 데이터로 다시 센다(아래 hasDualCandidate — 그 근거는 함수 주석).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const readUrl = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const PAGE = readUrl("../src/app/dual-name/page.tsx");
const RESULT = readUrl("../src/components/design/DualResult.tsx");
const CARD = readUrl("../src/components/design/DualCard.tsx");

// no-mock-scores.test.mjs 와 같은 주석 걷기 — JSX 주석 {/* … */} 은 {} 로 남는다
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const PAGE_CODE = stripComments(PAGE);
const RESULT_CODE = stripComments(RESULT);
const CARD_CODE = stripComments(CARD);

// ------------------------------------------------------------
// dual-placeholder-no-results — 예시 이름마다 후보가 있다
// ------------------------------------------------------------

const MAP = JSON.parse(readUrl("../../data/english_korean_names.json"));
const PICK_INDEX = JSON.parse(readUrl("../public/data/hanja-pick/v1/index.json"));
const ENGINE = readUrl("../../Application/Engines/DualNameEngine.cs");

/** DualNameEngine.ForbiddenWords — 엔진 파일에서 그대로 읽는다(목록을 테스트에 베끼지 않게) */
const ENGINE_FORBIDDEN = (() => {
  const m = /ForbiddenWords\s*=\s*new\(\)\s*\{([\s\S]*?)\};/.exec(ENGINE);
  assert.ok(m, "DualNameEngine.ForbiddenWords 를 찾지 못했다 — 엔진 파일이 바뀌었으면 이 테스트를 다시 볼 것");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
})();

/**
 * 영어 이름을 넣었을 때 DualNameEngine 이 후보를 하나라도 내는가.
 * 엔진(영어 이름 지정 분기): EnglishKoreanNameMap.FindByEnglishName(대소문자 무시 같음) → 한글 표기마다 CreateCandidate —
 * 2음절 이상·금칙어 없음·한글 음절만, 그리고 음절마다 HanjaSelector.Select 가 쓸 수 있는 한자(IsUsableNameHanja)를 낸다.
 * Select 가 비는지는 성별·용신과 무관하다(HanjaInput.AutoIsEmpty 주석 — 불용·뜻 유무로만 갈린다) — 그 값이 hanja-pick index.json 의
 * autoEmpty(dump-hanja-pick 이 AutoIsEmpty 로 쓴다)이고, 목록에 없는 음절(레·스)은 사전 독음이 아니라 Select 가 늘 빈다.
 * 자동 배정이 쓸 수 없는 글자를 내지 않는 것은 백엔드 EvaluateUserHanjaTests.AutoPath_NeverAssignsAnUnusableHanja_DataPremises 가 지킨다
 */
function hasDualCandidate(english) {
  const lower = english.toLowerCase();
  const syllableOk = (s) => {
    const e = PICK_INDEX.syllables[s];
    return !!e && e.usable > 0 && !e.autoEmpty;
  };
  return MAP.filter((m) => m.english.toLowerCase() === lower).some((m) =>
    m.korean.some(
      (ko) =>
        ko.length >= 2 &&
        [...ko].every((c) => c >= "가" && c <= "힣") &&
        !ENGINE_FORBIDDEN.some((f) => ko.includes(f)) &&
        [...ko].every(syllableOk)
    )
  );
}

test("후보 판정이 운영에서 확인한 사례와 맞는다 — Grace·Emily 0건, Philip·Noah·Hannah 있음", () => {
  // Grace(그레이스): 레·스가 사전 독음이 아니다 — 운영 'grace'+여 → 빈 배열(버그 목록 rt-specialty/SP-13)
  assert.equal(hasDualCandidate("Grace"), false, "Grace");
  assert.equal(hasDualCandidate("grace"), false, "grace(소문자 — 엔진은 대소문자를 보지 않는다)");
  // Emily(에밀리): '에'는 글자가 모두 불용이라 자동 배정이 빈다(autoEmpty — 2026-10-26 점수 정책 뒤 후보 0)
  assert.equal(hasDualCandidate("Emily"), false, "Emily");
  // 영어 이름을 비운 운영 결과 첫 카드가 Philip 필립이었다
  assert.equal(hasDualCandidate("Philip"), true, "Philip");
  assert.equal(hasDualCandidate("Noah"), true, "Noah");
  assert.equal(hasDualCandidate("Hannah"), true, "Hannah");
  // 지도에 없는 이름은 엔진이 직접 음역하지 않는다(GenerateDirectPhonetics 가 빈 목록)
  assert.equal(hasDualCandidate("Zzyzx"), false, "지도 밖 이름");
});

test("영어 이름 칸의 예시는 모두 후보가 나오는 이름이다(예전 'Grace'는 0건)", () => {
  const m = /const ENGLISH_NAME_PLACEHOLDER = "예: ([^"]+)";/.exec(PAGE);
  assert.ok(m, "ENGLISH_NAME_PLACEHOLDER 상수를 찾지 못했다");
  assert.match(PAGE_CODE, /placeholder=\{ENGLISH_NAME_PLACEHOLDER\}/, "영어 이름 칸이 그 상수를 쓴다");
  const names = m[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  assert.ok(names.length >= 2, "예시가 두 개 이상");
  for (const name of names) {
    assert.ok(MAP.some((e) => e.english === name), `${name}: 지도(data/english_korean_names.json) 표기 그대로`);
    assert.ok(hasDualCandidate(name), `${name}: 후보가 없다`);
  }
  assert.doesNotMatch(PAGE_CODE, /Grace/, "Grace 를 예시로 권하지 않는다");
});

// ------------------------------------------------------------
// labels-dual — 라벨 ↔ 칸
// ------------------------------------------------------------

test("폼의 라벨마다 htmlFor 가 있고 그 칸이 같은 id 를 받는다(select 포함)", () => {
  const fields = [...PAGE_CODE.matchAll(/<Field label="([^"]+)" htmlFor=\{(\w+)\}>([\s\S]*?)<\/Field>/g)];
  const fieldCount = (PAGE_CODE.match(/<Field\b/g) ?? []).length;
  assert.equal(fields.length, fieldCount, "htmlFor 없는 <Field> 가 있다");
  assert.equal(fieldCount, 6, "성씨·영어 이름·성별·톤·출생일·출생 시각");
  const ids = new Set();
  for (const [, label, idVar, inner] of fields) {
    assert.match(inner, new RegExp(`\\bid=\\{${idVar}\\}`), `'${label}' 칸에 id={${idVar}}`);
    ids.add(idVar);
  }
  assert.equal(ids.size, fields.length, "칸 id 가 서로 다르다");
  // id 는 useId 로(같은 화면이 두 번 그려져도 겹치지 않게 — /ohaeng 과 같은 방식)
  assert.match(PAGE_CODE, /const uid = useId\(\);/);
  // 공용 Field 는 htmlFor 를 반드시 받고, Select 는 id 를 <select> 에 넘긴다
  assert.match(PAGE_CODE, /htmlFor: string;/, "Field.htmlFor 필수");
  assert.match(PAGE_CODE, /<select\s+id=\{id\}/, "<select id>");
});

// ------------------------------------------------------------
// dual-tone-ignored
// ------------------------------------------------------------

test("톤 칸 라벨은 쓰이는 곳(평가 점수)을 말하고, 결과 칩은 '평가 톤 …'", () => {
  assert.match(PAGE_CODE, /<Field label="톤 \(이름 평가 점수에만 쓰여요\)"/);
  assert.match(RESULT_CODE, /`평가 톤 \$\{TONE_LABEL\[ctx\.tone\]\}`/);
  for (const old of ["소프트 톤", "강한 톤", "중립 톤"]) {
    assert.ok(!RESULT_CODE.includes(old), `옛 칩 '${old}'`);
  }
  // 톤 칸을 남겼으니 평가 링크는 고른 톤을 그대로 싣는다(지울 때만 neutral 로 고정)
  assert.match(RESULT_CODE, /params\.set\("tone", ctx\.tone\)/);
  // 낡은 주석('톤·출생일은 … 쓰지 않아') — 출생일·시각은 2026-10-28 부터 용신 배정에 쓰인다
  assert.ok(!PAGE.includes("톤·출생일은"), "낡은 '톤·출생일은' 주석");
});

// ------------------------------------------------------------
// dual-english-label-fallback
// ------------------------------------------------------------

test("영어 이름을 비우면 첫 후보의 영어 이름으로 채우지 않는다 — 제목·칩·배너", () => {
  assert.doesNotMatch(PAGE_CODE, /preferredEnglishName\s*\|\|\s*candidates\[0\]/, "페이지의 첫 후보 폴백");
  assert.doesNotMatch(PAGE_CODE, /candidates\[0\]\??\.englishEquivalent/, "첫 후보 영어 이름");
  // 칩: 넣었을 때 '영어 이름 X', 비우면 '영어 이름 미지정'
  assert.match(RESULT_CODE, /"영어 이름 미지정"/);
  // 배너는 영어 이름을 넣었을 때만
  assert.match(RESULT_CODE, /\{english && \(\s*<div[^>]*>\s*<MappingBanner/);
  // 제목: 비우면 '한·영 이중 이름 N가지'
  assert.match(RESULT_CODE, /한·영 이중 이름 \$\{candidates\.length\}가지/);
  // 비교 표에 영어 이름 열
  assert.match(RESULT_CODE, /\["#", "영어", "한국어", "한자", "의미", "평가"\]/);
  assert.match(RESULT_CODE, /\{c\.englishName\}/);
});

// ------------------------------------------------------------
// dual-dead-controls
// ------------------------------------------------------------

test("없는 기능·동작 없는 단추가 없다 — 결정하기·카드 선택·다른 연결 방식·연결 방식 바꾸기·새로 생성·빈 링크", () => {
  for (const [code, rel] of [[RESULT_CODE, "DualResult"], [CARD_CODE, "DualCard"], [PAGE_CODE, "page"]]) {
    for (const re of [/결정하기/, /connect=/, /의미 유사형/, /자유형/, /연결 방식 바꾸기/, /새로 생성/, /href="#"/, /\bonSelect\b/, /\bselected\b/, /DualMode/]) {
      assert.doesNotMatch(code, re, `${rel}: ${re}`);
    }
  }
  // 설명 상자의 고정 예시 'Philip(필+립)' — 첫 카드로 든다
  assert.ok(!RESULT_CODE.includes("Philip"), "고정 예시 Philip");
  assert.ok(!RESULT_CODE.includes("필+립"), "고정 예시 필+립");
  assert.match(RESULT_CODE, /<MethodExplainer example=\{candidates\[0\]\} \/>/);
});

test("'← 조건 수정'은 onRegenerate 를 부르는 단추 하나(같은 경로 Link 아님)이고 인쇄에서 숨는다", () => {
  const at = RESULT_CODE.indexOf("← 조건 수정");
  assert.ok(at > 0, "'← 조건 수정'");
  assert.equal(RESULT_CODE.indexOf("← 조건 수정", at + 1), -1, "'← 조건 수정'은 하나");
  const open = RESULT_CODE.lastIndexOf("<button", at);
  const segment = RESULT_CODE.slice(open, at);
  assert.ok(open >= 0 && !segment.includes("</button>") && !segment.includes("<Link"), "<button> 안의 글자");
  assert.match(segment, /onClick=\{onRegenerate\}/);
  assert.match(segment, /data-hide-print/);
  assert.equal((RESULT_CODE.match(/onClick=\{onRegenerate\}/g) ?? []).length, 1, "폼으로 가는 단추는 하나");
  assert.doesNotMatch(RESULT_CODE, /editHref/, "자기 경로 Link(editHref)");
  // 단추가 있으니 콜백은 필수(넘기지 않으면 눌러도 아무 일 없는 단추가 된다)
  assert.match(RESULT_CODE, /onRegenerate: \(\) => void;/);
  assert.match(PAGE_CODE, /onRegenerate=\{handleReset\}/);
});

test("footer 의 소개·문의는 /about·/contact 이고 인쇄에서 숨는다", () => {
  assert.match(RESULT_CODE, /<div data-hide-print[^>]*>\s*<Link\s+href="\/about"[\s\S]*?이름의 결에 대하여[\s\S]*?<Link\s+href="\/contact"[\s\S]*?문의/);
});

test("카드에 선택 상태가 없고 평가 링크는 인쇄에서 숨는다, 카드는 쪽 경계에서 갈리지 않는다", () => {
  assert.doesNotMatch(CARD_CODE, /onClick=\{\(\) => onSelect/);
  assert.doesNotMatch(CARD_CODE, /stopPropagation/, "카드 클릭이 없으니 전파 막기도 필요 없다");
  assert.match(CARD_CODE, /className="print:break-inside-avoid"/);
  assert.match(CARD_CODE, /aria-label=\{`이 이름 평가하기: [^`]*`\}\s*data-hide-print/);
  // 결과 화면 아래 '다른 경로로 작명하기' 묶음도 인쇄에서 숨긴다
  assert.match(RESULT_CODE, /<div\s+data-hide-print[\s\S]{0,400}?<Link\s+href="\/"[\s\S]*?다른 경로로 작명하기/);
});

// ------------------------------------------------------------
// dual-mobile-overflow
// ------------------------------------------------------------

test("휴대폰 폭에서 폼 격자·매핑 배너는 한 열(640px 부터 여러 열), 칸은 줄어들 수 있다", () => {
  // 인라인 gridTemplateColumns 는 미디어 쿼리를 못 받는다 — 예전 '1.4fr 1fr'·'1fr 1fr'·'1fr auto 1fr'
  assert.doesNotMatch(PAGE_CODE, /gridTemplateColumns/);
  assert.doesNotMatch(RESULT_CODE, /gridTemplateColumns/);
  assert.match(PAGE_CODE, /className="grid grid-cols-1 gap-3 sm:grid-cols-\[1\.4fr_1fr\]"/, "출생일·시각");
  assert.match(PAGE_CODE, /className="grid grid-cols-1 gap-3 sm:grid-cols-2"/, "성별·톤");
  assert.match(RESULT_CODE, /className="grid grid-cols-1 gap-3 sm:grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\] sm:gap-7"/, "매핑 배너");
  // 격자 칸(Field)과 입력은 minWidth 0 — date·time 의 최소 폭에 칸이 밀려 카드 밖으로 나가지 않게
  assert.match(PAGE_CODE, /<div style=\{\{ minWidth: 0 \}\}>/, "Field 칸");
  assert.equal((PAGE_CODE.match(/minWidth: 0,/g) ?? []).length, 2, "<input>·<select>");
});
