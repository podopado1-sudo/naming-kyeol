// /analysis(이름 분석) 묶음 수정 고정 — `npm test`
// 2026-11-27 버그 목록(G-analysis): analysis-input-unvalidated · analysis-yongshin-method-label · labels-analysis · analysis-score-grid-overflow
//
// 화면 파일(.tsx)은 node 타입 지우기로 바로 읽지 못하므로, 검사할 순수 함수 하나를 소스에서 잘라 typescript 로 옮긴 뒤 돌린다
// (함수가 쓰는 import 는 진짜 lib 모듈을 넘긴다). 나머지는 소스 문자열 검사.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import "./resolve-ts.mjs";

const { cleanNameInput, nameInputProblem, nameInputMessage, SURNAME_MAX_LENGTH } = await import("../src/lib/name-input.ts");

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const PAGE = read("../src/app/analysis/page.tsx");
const SAJU = read("../src/components/design/DetailSaju.tsx");
const HERO = read("../src/components/design/DetailHero.tsx");

/** 소스에서 맨 왼쪽에서 시작하는 `function name(` 부터 맨 왼쪽 `}` 줄까지 잘라 JS 로 옮긴다 */
function extractFunction(source, name, deps = {}) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^(export )?function ${name}\\(`).test(l));
  assert.ok(start >= 0, `${name} 함수를 찾지 못했다`);
  const end = lines.findIndex((l, i) => i > start && l === "}");
  assert.ok(end > start, `${name} 함수의 끝을 찾지 못했다`);
  const tsSource = lines.slice(start, end + 1).join("\n").replace(/^export /, "");
  const js = ts.transpileModule(tsSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const names = Object.keys(deps);
  return new Function(...names, `${js}\nreturn ${name};`)(...names.map((k) => deps[k]));
}

// ============================================================
// analysis-input-unvalidated — 성·이름을 다듬고 lib/name-input 으로 검사한다
// ============================================================
const givenMax = Number(/const GIVEN_NAME_MAX_LENGTH = (\d+);/.exec(PAGE)?.[1]);
const analysisNameProblem = extractFunction(PAGE, "analysisNameProblem", {
  cleanNameInput,
  nameInputProblem,
  nameInputMessage,
  SURNAME_MAX_LENGTH,
  GIVEN_NAME_MAX_LENGTH: givenMax,
});

test("/analysis 이름 글자 수 = 서버 NameAnalysisRequestDto.FirstName 이 받는 길이", () => {
  assert.equal(givenMax, 10);
  const dto = read("../../Application/DTOs/NameAnalysisRequestDto.cs");
  const m = /StringLength\((\d+)[^\]]*\]\s*public string FirstName/.exec(dto);
  assert.ok(m, "서버 DTO 의 FirstName 검증을 찾지 못했다");
  assert.equal(Number(m[1]), givenMax);
});

test("/analysis 성·이름 검사 — 끝 공백은 다듬어 통과, 한자·영문·숫자·낱자모·가운데 공백·길이는 막는다", () => {
  // 다듬으면 문제 없는 값(휴대폰 자동완성 끝 공백 · 복성 끝 공백 · 풀어 쓴 한글)
  assert.equal(analysisNameProblem("김", "서윤 "), null);
  assert.equal(analysisNameProblem(" 남궁 ", "서윤"), null);
  assert.equal(analysisNameProblem("김", "서윤".normalize("NFD")), null);
  // 이름 칸
  assert.deepEqual(analysisNameProblem("김", "瑞潤"), { field: "firstName", message: "이름은 한글로만 입력해주세요." });
  assert.deepEqual(analysisNameProblem("김", "Seoyun"), { field: "firstName", message: "이름은 한글로만 입력해주세요." });
  assert.deepEqual(analysisNameProblem("김", "12"), { field: "firstName", message: "이름은 한글로만 입력해주세요." });
  assert.deepEqual(analysisNameProblem("김", "ㅋㅋ"), {
    field: "firstName",
    message: "이름은 ㄱ·ㅏ 같은 낱자 없이 완성된 한글로 입력해주세요.",
  });
  assert.deepEqual(analysisNameProblem("김", "서 윤"), { field: "firstName", message: "이름은 띄어 쓰지 말고 붙여서 입력해주세요." });
  assert.deepEqual(analysisNameProblem("김", "가".repeat(11)), { field: "firstName", message: "이름은 10글자까지 입력할 수 있어요." });
  assert.equal(analysisNameProblem("김", "가".repeat(10)), null);
  // 성씨 칸(먼저 본다)
  assert.deepEqual(analysisNameProblem("金", "瑞潤"), { field: "lastName", message: "성씨는 한글로만 입력해주세요." });
  assert.deepEqual(analysisNameProblem("남궁김", "서윤"), { field: "lastName", message: "성씨는 2글자까지 입력할 수 있어요." });
  // 빈 칸(공백만 포함) — 제출 때는 막는다
  assert.deepEqual(analysisNameProblem("  ", "서윤"), { field: "lastName", message: "성씨를 입력해주세요." });
  assert.deepEqual(analysisNameProblem("김", " "), { field: "firstName", message: "이름을 입력해주세요." });
});

test("/analysis 주소로 채운 값 — 비어 온 칸은 넘기고, 채워 온 값은 같은 규칙으로 본다", () => {
  assert.equal(analysisNameProblem("", "", true), null);
  assert.equal(analysisNameProblem("", "서윤", true), null);
  assert.deepEqual(analysisNameProblem("", "Daniel", true), { field: "firstName", message: "이름은 한글로만 입력해주세요." });
  assert.deepEqual(analysisNameProblem("Kim", "", true), { field: "lastName", message: "성씨는 한글로만 입력해주세요." });
  // 소스: 주소 값을 다듬어 칸을 채우고, 그 값으로 첫 오류 문장을 정한다
  assert.match(PAGE, /cleanNameInput\(searchParams\.get\("lastName"\) \?\? searchParams\.get\("surname"\)\)/);
  assert.match(PAGE, /cleanNameInput\(searchParams\.get\("name"\)\)/);
  assert.match(PAGE, /analysisNameProblem\(lastName, firstName, true\)/);
  assert.doesNotMatch(PAGE, /useState\(searchParams\.get\("name"\)/, "다듬지 않은 주소 값으로 칸을 채우지 않는다");
});

test("/analysis 제출 — 다듬은 값으로 검사한 뒤 그 값을 보낸다(문제가 있으면 보내지 않는다)", () => {
  const body = /async function handleSubmit\(e: FormEvent\) \{([\s\S]*?)\r?\n {2}\}\r?\n/.exec(PAGE)?.[1];
  assert.ok(body, "handleSubmit 을 찾지 못했다");
  const check = body.indexOf("analysisNameProblem(last, first)");
  const send = body.indexOf("nameAnalysis(");
  assert.ok(check >= 0 && send > check, "검사가 요청보다 먼저 와야 한다");
  assert.match(body, /const last = cleanNameInput\(lastName\);/);
  assert.match(body, /const first = cleanNameInput\(firstName\);/);
  assert.match(body.slice(check, send), /return;/, "문제가 있으면 요청 전에 멈춘다");
  assert.match(body.slice(send), /lastName: last,\s*firstName: first,/, "다듬은 값을 보낸다");
  // 오류 문장은 화면 읽기 프로그램이 읽고(role=alert), 가리키는 칸에 이어진다
  assert.match(PAGE, /id=\{ids\.error\}\s*role="alert"/);
  assert.match(PAGE, /ariaDescribedBy: flagged \? ids\.error : undefined/);
  assert.match(PAGE, /aria-invalid=\{ariaInvalid\}/);
  assert.match(PAGE, /aria-describedby=\{ariaDescribedBy\}/);
});

// ============================================================
// labels-analysis — 라벨 6개가 칸과 이어진다
// ============================================================
test("/analysis 입력 라벨 6개 — htmlFor 와 칸 id 가 짝을 이룬다", () => {
  const fields = [...PAGE.matchAll(/<Field label="([^"]+)"(?: htmlFor=\{ids\.(\w+)\})?>/g)];
  assert.equal(fields.length, 6, "입력 칸 라벨은 6개");
  for (const [, label, key] of fields) {
    assert.ok(key, `'${label}' 라벨에 htmlFor 가 없다`);
    const ids = [...PAGE.matchAll(new RegExp(`\\bid=\\{ids\\.${key}\\}`, "g"))];
    assert.equal(ids.length, 1, `'${label}' 라벨이 가리키는 칸(id=ids.${key})이 하나여야 한다`);
  }
  assert.equal(new Set(fields.map((f) => f[2])).size, 6, "라벨마다 다른 칸");
  // id 는 useId 로 만든다(같은 화면에 두 번 그려도 겹치지 않게) — 라벨·칸 부품이 실제로 속성을 단다
  assert.match(PAGE, /const uid = useId\(\);/);
  assert.match(PAGE, /<label\s+htmlFor=\{htmlFor\}/);
  assert.match(PAGE, /<input\s+id=\{id\}/);
  assert.match(PAGE, /<select\s+id=\{id\}/);
});

// ============================================================
// analysis-yongshin-method-label — 용신 카드 제목은 서버가 고른 방식을 적는다
// ============================================================
const yongshinMethodLabel = extractFunction(SAJU, "yongshinMethodLabel");

test("용신 카드 방식 이름 — 최종 용신이 억부·조후 어느 쪽과 같은지로 정한다", () => {
  // 신약 −6 (억부 우선): 억부 土 · 조후 火 · 최종 土 — 옛 제목은 '조후 용신 土', 본문은 '土를 억부 용신으로 취합니다'
  assert.equal(yongshinMethodLabel({ primaryYongshin: "土", eokbuYongshin: "土", johuYongshin: "火" }), "억부 용신");
  // 약한 신강 +4 (조후 채택): 억부 火 · 조후 水 · 최종 水 — 옛 제목은 '억부 용신'
  assert.equal(yongshinMethodLabel({ primaryYongshin: "水", eokbuYongshin: "火", johuYongshin: "水" }), "조후 용신");
  // 두 방식이 같은 오행이면 방식 이름 없이
  assert.equal(yongshinMethodLabel({ primaryYongshin: "木", eokbuYongshin: "木", johuYongshin: "木" }), "용신");
  // 조후 용신이 없으면 억부
  assert.equal(yongshinMethodLabel({ primaryYongshin: "金", eokbuYongshin: "金", johuYongshin: null }), "억부 용신");
  // 두 값이 없는 응답(옛 꼴)은 방식을 지어내지 않는다
  assert.equal(yongshinMethodLabel({ primaryYongshin: "火" }), "용신");
});

test("용신 카드 제목 — 강약으로 방식을 지어내지 않고, 응답의 억부·조후 용신을 넘긴다", () => {
  assert.doesNotMatch(SAJU, /strength === "신강" \? "억부" : "조후"/);
  assert.match(SAJU, /\{yongshinMethodLabel\(saju\.yongshin\)\}/);
  assert.match(PAGE, /eokbuYongshin: api\.yongshin\.eokbuYongshin,/);
  assert.match(PAGE, /johuYongshin: api\.yongshin\.johuYongshin,/);
});

// ============================================================
// analysis-score-grid-overflow — 360px 에서 점수 타일 2×2, 결과 좌우 여백 16px
// ============================================================
test("/analysis 결과 — 480px 이하에서 점수 타일 2열·결과 좌우 여백 16px", () => {
  assert.match(HERO, /className="detail-score-grid"/);
  assert.match(
    HERO,
    /@media \(max-width: 480px\) \{\s*\.detail-score-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important; \}/,
  );
  assert.match(HERO, /<style>\{HERO_CSS\}<\/style>/);
  assert.match(PAGE, /className="analysis-result"/);
  assert.match(
    PAGE,
    /@media \(max-width: 480px\) \{\s*\.analysis-result \{ padding-left: 16px !important; padding-right: 16px !important; \}/,
  );
  assert.match(PAGE, /<style>\{ANALYSIS_RESULT_CSS\}<\/style>/);
});

test("/analysis 결과 — 입력으로 돌아가는 단추는 인쇄에 싣지 않는다", () => {
  assert.match(PAGE, /<div data-hide-print[^>]*>\s*<Button variant="ghost" onClick=\{\(\) => showResult\(null\)\}>/);
  assert.match(SAJU, /<div data-hide-print>\s*<Button variant="secondary" size="sm" onClick=\{onOpenBirthInput\}>/);
});
