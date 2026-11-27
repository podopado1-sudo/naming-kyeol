// /evaluate 입력 폼(EvaluateInput) 2026-11-27 버그 묶음 G-evaluate-input — `npm test`
//
// - evaluate-input-validation: 낱자모('ㅋㅋ')가 제출되고, 끝 공백('김 ')·영문 성('Kim')은 까닭 없이 '이름을 입력해주세요'로 잠겼다.
//   → 검사는 lib/name-input(다듬기·판정·문구) 하나로, 단추 글은 까닭마다, 성 칸에도 경고·aria-invalid.
// - evaluate-date-style-leak: <head> 에 넣고 지우지 않은 범위 없는 날짜 칸 규칙이 다른 화면의 생년월일을 빈칸처럼 보이게 했고,
//   /evaluate 안에서는 포커스 때 덮개와 기본 날짜 글자가 겹쳤다. → 폼 안의 <style>, 규칙은 .eval-date 아래로만.
// - labels-evaluate: 출생일 칸이 라벨과 이어져 있지 않았다. → <label htmlFor> ↔ 칸 id, 칸이 여럿인 절은 묶음 aria-labelledby.
// - evaluate-tone-help-text: 톤 도움말이 결과에 없는 줄('실제 톤')을 약속했다. → 실제 점수 규칙과 결과의 줄만 말한다
//   (톤이 닿는 두 길 — '톤 보너스' 줄(EvaluateToneBonus)과 '의미' 줄 +1(EvaluateMeaning 의 톤 가점, 검토 반영)).
// - evaluate-time-field-overflow: 375 폭에서 시각 칸이 카드 밖으로 밀리고 날짜 덮개가 달력 아이콘에 붙었다.
//
// 화면 컴포넌트(.tsx)는 node 로 읽을 수 없으므로 두 갈래로 본다:
// ① 폼 파일의 '성·이름 칸 검사(순수 함수)' 구역을 떼어 임시 .mts 로 써서 값으로 돌린다(그 구역은 lib/name-input·firstHanCodePoint 만 쓴다).
// ② 그 함수들을 폼이 어떻게 잇는지·스타일·라벨·문구는 원문으로 고정한다(tests/evaluate-hanja-pages.test.mjs 와 같은 방식).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import "./resolve-ts.mjs";

const FRONT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(FRONT, "src");
/** 원문 — 줄바꿈을 LF 로(저장소가 core.autocrlf 라 작업 트리는 CRLF 일 수 있다) */
const readAt = (...p) => readFileSync(join(...p), "utf8").replace(/\r\n/g, "\n");
const INPUT_FILE = join(SRC, "components", "design", "EvaluateInput.tsx");
const input = readAt(INPUT_FILE);
/** 주석을 뺀 코드 — 옛 동작을 설명하는 주석의 낱말에 걸리지 않게 */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const inputCode = code(input);

/** `function 이름(` 줄부터 같은 들여쓰기의 닫는 `}` 줄까지 */
function functionBody(src, fn) {
  const head = new RegExp(`^([ \\t]*)(?:export )?(?:async )?function ${fn}\\(`, "m").exec(src);
  assert.ok(head, `${fn} 함수를 찾지 못했다`);
  const close = `\n${head[1]}}\n`;
  const end = src.indexOf(close, head.index);
  assert.ok(end > head.index, `${fn} 함수의 끝을 찾지 못했다`);
  return src.slice(head.index, end + close.length);
}

// ─── ① 성·이름 칸 검사 — 값 ───────────────────────────────────

const START = "// ── 성·이름 칸 검사(순수 함수) — 시작";
const END = "// ── 성·이름 칸 검사 — 끝";

async function loadCheckBlock() {
  const a = input.indexOf(START);
  const b = input.indexOf(END);
  assert.ok(a >= 0 && b > a, "EvaluateInput.tsx 의 '성·이름 칸 검사' 구역 표시 줄을 찾지 못했다");
  const block = input.slice(a, b);
  // 구역은 아래 다섯 이름 말고 파일의 다른 값을 쓰지 않는다(쓰면 여기서 떼어 돌릴 수 없다)
  assert.doesNotMatch(code(block), /\b(useState|useMemo|store|settled|committed|seed|React)\b/);
  const nameInputUrl = new URL("../src/lib/name-input.ts", import.meta.url).href;
  const hanjaPickUrl = new URL("../src/lib/hanja-pick.ts", import.meta.url).href;
  const head =
    `import { SURNAME_MAX_LENGTH, cleanNameInput, nameInputMessage, nameInputProblem, type NameInputProblem } from ${JSON.stringify(nameInputUrl)};\n` +
    `import { firstHanCodePoint } from ${JSON.stringify(hanjaPickUrl)};\n`;
  const tail = "\nexport { NAME_MAX_LENGTH, NAME_FIELDS, SUBMIT_READY, checkNameField, shownProblem, nameFieldWarning, submitLabel };\n";
  const dir = mkdtempSync(join(tmpdir(), "fix1127-evaluate-input-"));
  try {
    const file = join(dir, "name-field-check.mts");
    writeFileSync(file, head + block + tail, "utf8");
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const check = await loadCheckBlock();
const { SURNAME_MAX_LENGTH } = await import("../src/lib/name-input.ts");

/** 폼과 같은 조립 — canSubmit 식은 아래 ② 가 원문으로 고정한다. settledJamo = 칸 줄을 맞춘 뒤에도 그 값 그대로인가 */
function form(last, first, { settledJamo = true } = {}) {
  const lastCheck = check.checkNameField("lastName", last);
  const firstCheck = check.checkNameField("firstName", first);
  const lastSettled = lastCheck.problem === "jamo" && settledJamo;
  const firstSettled = firstCheck.problem === "jamo" && settledJamo;
  return {
    last: lastCheck.value,
    first: firstCheck.value,
    canSubmit: lastCheck.problem === null && firstCheck.problem === null,
    label: check.submitLabel(check.shownProblem(lastCheck, lastSettled), check.shownProblem(firstCheck, firstSettled)),
    lastWarning: check.nameFieldWarning("lastName", lastCheck, lastSettled),
    firstWarning: check.nameFieldWarning("firstName", firstCheck, firstSettled),
  };
}

const READY = "이 이름 살펴보기";
const JAMO_LAST = "성씨는 ㄱ·ㅏ 같은 낱자 없이 완성된 한글로 입력해주세요.";
const JAMO_FIRST = "이름은 ㄱ·ㅏ 같은 낱자 없이 완성된 한글로 입력해주세요.";
const HANJA_NOTE = "한자는 한글로 넣은 뒤 아래 한자 칸에서 고를 수 있어요.";

test("앞뒤 공백은 다듬어 받는다 — '김 '·' 김'·' 서윤 ' 은 제출되고, 다듬은 값이 나간다(EA-03 · CF-09)", () => {
  for (const [last, first] of [["김 ", "서윤"], [" 김", "서윤"], ["김", " 서윤 "], ["\t김\n", "서윤 "]]) {
    const f = form(last, first);
    assert.equal(f.canSubmit, true, JSON.stringify([last, first]));
    assert.equal(f.label, READY);
    assert.equal(f.lastWarning, null);
    assert.equal(f.firstWarning, null);
    assert.equal(f.last, "김");
    assert.equal(f.first, "서윤");
  }
  // 풀어 쓴 한글(NFD)은 모아서 보낸다
  const nfd = form("김".normalize("NFD"), "서윤".normalize("NFD"));
  assert.equal(nfd.canSubmit, true);
  assert.equal(nfd.first, "서윤");
});

test("낱자모만 든 이름은 제출되지 않는다 — 'ㅋㅋ'·'ㅅ'·성 'ㅅ'(EA-04 · CF-11)", () => {
  for (const [last, first, lastWarning, firstWarning] of [
    ["김", "ㅋㅋ", null, JAMO_FIRST],
    ["김", "ㅅ", null, JAMO_FIRST],
    ["김", "서ㅇ", null, JAMO_FIRST],
    ["ㅅ", "ㅅ", JAMO_LAST, JAMO_FIRST],
    ["ㄱ", "서윤", JAMO_LAST, null],
  ]) {
    const f = form(last, first);
    assert.equal(f.canSubmit, false, `${last}${first}`);
    assert.equal(f.label, "글자를 끝까지 입력해주세요", `${last}${first}`);
    assert.equal(f.lastWarning, lastWarning, `${last}${first}`);
    assert.equal(f.firstWarning, firstWarning, `${last}${first}`);
  }
});

test("한글을 치는 동안(칸 줄을 맞추기 전)의 첫 자음은 알리지 않는다 — 경고·단추 모양은 그대로, 제출은 막는다", () => {
  const typing = form("김", "서ㅇ", { settledJamo: false });
  assert.equal(typing.canSubmit, false, "낱자모가 남은 값은 보내지 않는다");
  assert.equal(typing.firstWarning, null);
  assert.equal(typing.label, READY, "음절마다 단추가 깜빡이지 않게");
  // 낱자모가 아닌 문제는 바로 알린다
  assert.equal(form("Kim", "서ㅇ", { settledJamo: false }).label, "성씨를 한글로 입력해주세요");
  assert.equal(form("", "ㅅ", { settledJamo: false }).label, "성씨를 입력해주세요");
});

test("성 칸의 문제도 까닭과 함께 막는다 — 'Kim'·한자·띄어쓰기·세 글자(성 칸 경고가 없던 것)", () => {
  const kim = form("Kim", "서윤");
  assert.equal(kim.canSubmit, false);
  assert.equal(kim.label, "성씨를 한글로 입력해주세요", "옛 단추는 이름이 있어도 '이름을 입력해주세요'였다");
  assert.equal(kim.lastWarning, "성씨는 한글로만 입력해주세요.");
  assert.equal(kim.firstWarning, null);

  const han = form("金", "서윤");
  assert.equal(han.label, "성씨를 한글로 입력해주세요");
  assert.equal(han.lastWarning, `성씨는 한글로만 입력해주세요. ${HANJA_NOTE}`);

  const spaced = form("남 궁", "민");
  assert.equal(spaced.label, "띄어쓰기 없이 입력해주세요");
  assert.equal(spaced.lastWarning, "성씨는 띄어 쓰지 말고 붙여서 입력해주세요.");

  const long = form("남궁민", "서");
  assert.equal(long.label, "성씨가 너무 길어요");
  assert.equal(long.lastWarning, `성씨는 ${SURNAME_MAX_LENGTH}글자까지 입력할 수 있어요.`);
  assert.equal(form("남궁", "민").canSubmit, true, "복성 두 글자");
});

test("이름 칸 — 한자·영문은 lib/name-input 문구로 막고(K1 설계 전), 한자를 넣었으면 고르는 곳을 알린다. 옛 '한글로 입력해주세요'는 하나로 정리", () => {
  const han = form("김", "瑞潤");
  assert.equal(han.canSubmit, false);
  assert.equal(han.label, "이름을 한글로 입력해주세요");
  assert.equal(han.firstWarning, `이름은 한글로만 입력해주세요. ${HANJA_NOTE}`);
  for (const first of ["Seoyun", "서윤2", "서윤!"]) {
    const f = form("김", first);
    assert.equal(f.canSubmit, false, first);
    assert.equal(f.label, "이름을 한글로 입력해주세요", first);
    assert.equal(f.firstWarning, "이름은 한글로만 입력해주세요.", first);
  }
  // 섞인 한자도 같은 안내
  assert.equal(form("김", "서潤").firstWarning, `이름은 한글로만 입력해주세요. ${HANJA_NOTE}`);
  const spaced = form("김", "서 윤");
  assert.equal(spaced.label, "띄어쓰기 없이 입력해주세요");
  assert.equal(spaced.firstWarning, "이름은 띄어 쓰지 말고 붙여서 입력해주세요.");
});

test("이름 길이 — 서버(NameEvaluateRequestDto)와 같이 10글자까지", () => {
  assert.equal(check.NAME_MAX_LENGTH, 10);
  assert.equal(form("김", "가나다라마바사아자차").canSubmit, true);
  const over = form("김", "가나다라마바사아자차카");
  assert.equal(over.canSubmit, false);
  assert.equal(over.label, "이름이 너무 길어요");
  assert.equal(over.firstWarning, "이름은 10글자까지 입력할 수 있어요.");
  // 서버 DTO 의 글자 수 — 바뀌면 폼의 한계도 함께
  const dto = readAt(FRONT, "..", "Application", "DTOs", "NameEvaluationResultDto.cs");
  assert.match(dto, /StringLength\(10, MinimumLength = 1, ErrorMessage = "이름은 1~10자여야 합니다\."\)\]\s*public string Name \{/);
  assert.match(dto, new RegExp(`StringLength\\(${SURNAME_MAX_LENGTH}, MinimumLength = 1, ErrorMessage = "성씨는 1~${SURNAME_MAX_LENGTH}자여야 합니다\\."\\)\\]\\s*public string LastName \\{`));
});

test("빈 칸 — 단추가 알리고(옛 문구 그대로) 칸 아래 경고는 띄우지 않는다", () => {
  for (const [last, first, label] of [
    ["", "", "이름을 입력해주세요"],
    ["", "서윤", "성씨를 입력해주세요"],
    ["  ", "서윤", "성씨를 입력해주세요"],
    ["김", "", "이름을 입력해주세요"],
    ["김", "   ", "이름을 입력해주세요"],
  ]) {
    const f = form(last, first);
    assert.equal(f.canSubmit, false);
    assert.equal(f.label, label, JSON.stringify([last, first]));
    assert.equal(f.lastWarning, null);
    assert.equal(f.firstWarning, null);
  }
  // 성 칸이 먼저 — 둘 다 문제면 성씨 까닭
  assert.equal(form("Kim", "ㅋㅋ").label, "성씨를 한글로 입력해주세요");
  assert.equal(form("", "Seoyun").label, "성씨를 입력해주세요");
  assert.equal(form("", "Seoyun").firstWarning, "이름은 한글로만 입력해주세요.");
});

// ─── ② 폼이 검사를 잇는 방식 — 원문 ─────────────────────────────

test("폼은 다듬은 값으로 판정하고 그 값을 보낸다 — canSubmit 은 두 칸의 문제가 없을 때(K1 이 나중에 이 줄을 바꾼다)", () => {
  assert.match(input, /import \{\s*SURNAME_MAX_LENGTH,\s*cleanNameInput,\s*nameInputMessage,\s*nameInputProblem,\s*type NameInputProblem,\s*\} from "@\/lib\/name-input";/);
  assert.match(inputCode, /const lastCheck = checkNameField\("lastName", lastName\);\s*const firstCheck = checkNameField\("firstName", firstName\);/);
  assert.match(inputCode, /const canSubmit = lastCheck\.problem === null && firstCheck\.problem === null;/);
  assert.doesNotMatch(inputCode, /KOREAN_RE|lastValid|firstValid/, "옛 정규식 검사(다듬지 않은 값·낱자모 허용)가 남았다");
  assert.doesNotMatch(inputCode, />\s*한글로 입력해주세요\s*</, "옛 이름 칸 힌트는 lib/name-input 문구로 정리했다");
  // 제출 — 다듬은 값으로 칸을 다시 계산하고 보낸다
  const submit = functionBody(input, "handleSubmit");
  assert.match(submit, /if \(!canSubmit \|\| loading\) return;/);
  assert.match(submit, /const lastName = lastCheck\.value;\s*const firstName = firstCheck\.value;[\s\S]*const now = deriveSlots\(\{ lastName, firstName \}/);
  assert.match(submit, /onSubmit\?\.\(\{\s*lastName,\s*firstName,/);
  // 칸 줄을 맞추는 값도 같은 다듬기
  assert.match(functionBody(input, "settleable"), /const text = cleanNameInput\(value\);/);
  // 미리보기·글자 수도 다듬은 값
  assert.match(inputCode, /<NamePreview lastName=\{lastCheck\.value\} firstName=\{firstCheck\.value\} \/>/);
  assert.match(inputCode, /const total = \(lastCheck\.value \+ firstCheck\.value\)\.replace\(\/\\s\/g, ""\)\.length;/);
});

test("낱자모 안내는 칸 줄을 맞춘 그 값 그대로일 때만 — 맞춘 값(committed)과 지금 값을 견준다", () => {
  assert.match(inputCode, /const lastJamoSettled = lastCheck\.problem === "jamo" && committed\.lastName === lastName;/);
  assert.match(inputCode, /const firstJamoSettled = firstCheck\.problem === "jamo" && committed\.firstName === firstName;/);
  assert.match(inputCode, /const jamoPending = firstJamoSettled \|\| lastJamoSettled;/);
  assert.match(functionBody(input, "commitSettle"), /setCommitted\(\(prev\) =>\s*prev\.lastName === next\.lastName && prev\.firstName === next\.firstName\s*\? prev\s*: \{ lastName: next\.lastName, firstName: next\.firstName \}\s*\);/);
  assert.doesNotMatch(inputCode, /\bunsettled\b/);
});

test("성·이름 칸 모두 경고 문장·aria-invalid·aria-describedby 를 단다(성 칸에 없던 것)", () => {
  assert.match(inputCode, /const lastWarning = nameFieldWarning\("lastName", lastCheck, lastJamoSettled\);/);
  assert.match(inputCode, /const firstWarning = nameFieldWarning\("firstName", firstCheck, firstJamoSettled\);/);
  for (const [w, id] of [["lastWarning", "lastHintId"], ["firstWarning", "firstHintId"]]) {
    assert.match(inputCode, new RegExp(`invalid=\\{${w} !== null\\}\\s*describedBy=\\{${w} !== null \\? ${id} : undefined\\}`), w);
    assert.match(inputCode, new RegExp(`\\{${w} !== null && \\(\\s*<FieldHint kind="warn" id=\\{${id}\\}>\\s*\\{${w}\\}\\s*</FieldHint>`), w);
  }
  const atom = functionBody(input, "Input");
  assert.match(atom, /aria-invalid=\{invalid \|\| undefined\}\s*aria-describedby=\{describedBy\}/);
  assert.match(functionBody(input, "FieldHint"), /<div\s+id=\{id\}/);
  // 단추 — 누를 수 있는지는 canSubmit, 글·모양은 화면에 알린 문제로
  assert.match(inputCode, /const buttonReady = canSubmit && !loading;/);
  assert.match(inputCode, /disabled=\{!buttonReady\}/);
  assert.match(inputCode, /\{loading \? "살펴보는 중이에요…" : submitLabel\(shownLast, shownFirst\)\}/);
  assert.match(inputCode, /const buttonLooksReady = shownLast === null && shownFirst === null && !loading;/);
});

// ─── 날짜 칸 스타일 ──────────────────────────────────────────

function cssOf(src) {
  const m = /const EVAL_INPUT_CSS = `([\s\S]*?)`;/.exec(src);
  assert.ok(m, "EVAL_INPUT_CSS 를 찾지 못했다");
  return m[1];
}

/** 규칙의 선택자 목록들(@keyframes 안의 from·to, @media 머리는 뺀다) */
function selectorLists(css) {
  const lists = [];
  const flat = css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ""); // 키프레임 덩이
  for (const m of flat.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const sel = m[1].replace(/^[\s\S]*@media[^{]*\{/, "").trim();
    if (!sel || sel.startsWith("@")) continue;
    lists.push(sel);
  }
  return lists;
}

test("날짜 칸 규칙은 폼 안의 <style> 하나 — <head> 에 넣지 않고, 규칙은 모두 .eval-date·.eval-birth-row 아래(EA-12 · 다른 화면 누수)", () => {
  assert.doesNotMatch(inputCode, /document\.head|createElement\("style"\)|eval-input-style/);
  assert.equal([...inputCode.matchAll(/<style>\{EVAL_INPUT_CSS\}<\/style>/g)].length, 1);
  assert.equal([...inputCode.matchAll(/<style\b/g)].length, 1);
  const css = cssOf(input);
  const lists = selectorLists(css);
  assert.ok(lists.length >= 6, lists.join(" | "));
  for (const list of lists) {
    for (const sel of list.split(",").map((s) => s.trim())) {
      assert.match(sel, /^\.eval-(date|birth-row)\b/, `범위 없는 선택자: ${sel}`);
    }
    // Firefox 가 모르는 선택자는 다른 선택자와 한 규칙에 묶지 않는다(묶으면 규칙째 버려진다)
    if (list.includes("-webkit-")) assert.ok(!list.includes(","), list);
  }
  // 값이 있으면 기본 글자를 숨기고, 포커스 때 되살리며 덮개를 숨긴다(겹치지 않게)
  assert.match(css, /\.eval-date\[data-filled\] input\[type="date"\] \{ color: transparent; \}/);
  assert.match(css, /\.eval-date input\[type="date"\]:focus \{ color: var\(--color-text\); \}/);
  assert.match(css, /\.eval-date input\[type="date"\]::-webkit-datetime-edit \{ color: transparent; \}/);
  assert.match(css, /\.eval-date input\[type="date"\]:focus::-webkit-datetime-edit \{ color: var\(--color-text\); \}/);
  assert.match(css, /\.eval-date:focus-within \.eval-date-overlay \{ visibility: hidden; \}/);
  // 포커스 규칙이 '값 있음' 규칙보다 뒤(같은 우선순위 — 뒤가 이긴다)
  assert.ok(css.indexOf('.eval-date input[type="date"]:focus {') > css.indexOf('.eval-date[data-filled] input[type="date"]'));
  // 미리보기 등장 움직임은 그대로
  assert.match(css, /@keyframes evalFadeIn/);
  assert.match(inputCode, /animation: "evalFadeIn 220ms/);
});

test("날짜 칸 — 색은 인라인이 아니라 .eval-date 규칙이 정하고(포커스 규칙이 이기게), 덮개는 이름표·글 끊기", () => {
  const date = functionBody(input, "DateInput");
  assert.match(date, /<div className="eval-date" data-filled=\{value \? "" : undefined\} style=\{\{ position: "relative", minWidth: 0 \}\}>/);
  assert.match(date, /<input\s+id=\{id\}\s+type="date"/);
  assert.doesNotMatch(code(date), /color: value \?/, "인라인 색은 :focus 규칙을 이긴다");
  assert.match(date, /className="eval-date-overlay"\s+aria-hidden/);
  for (const re of [/left: 14,\s*right: 40,/, /overflow: "hidden",\s*textOverflow: "ellipsis",\s*whiteSpace: "nowrap",/]) assert.match(date, re);
});

test("화면 코드 어디에도 범위 없는 날짜 칸 글자 규칙이 없다 — /search·/twin 등 다른 화면의 생년월일은 기본 표시", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== "data") walk(p);
      } else if (/\.(ts|tsx|css)$/.test(name)) {
        readAt(p)
          .split("\n")
          .forEach((line, i) => {
            if (/^\s*(\/\/|\/?\*)/.test(line)) return;
            if (/datetime-edit/.test(line) && !/^\s*\.eval-date\b/.test(line)) offenders.push(`${relative(SRC, p)}:${i + 1}`);
          });
      }
    }
  };
  walk(SRC);
  assert.deepEqual(offenders, []);
});

// ─── 라벨 ─────────────────────────────────────────────────────

test("출생일 칸은 라벨과 이어진다 — <label htmlFor> ↔ 날짜 칸 id(useId), 짝 없는 <label> 이 없다(PS-03)", () => {
  assert.match(inputCode, /const birthDateId = `\$\{uid\}-birth-date`;/);
  assert.match(inputCode, /<Section title="출생일" htmlFor=\{birthDateId\}>/);
  assert.match(inputCode, /<DateInput id=\{birthDateId\} value=\{birth\} onChange=\{setBirth\} \/>/);
  const section = functionBody(input, "Section");
  assert.match(section, /<label htmlFor=\{htmlFor\} style=\{sectionTitleStyle\}>/);
  assert.match(section, /<span id=\{titleId\} style=\{sectionTitleStyle\}>/);
  // 이 파일의 모든 <label> 에 htmlFor 가 있다(DevTools FormLabelHasNeitherForNorNestedInput 0건)
  const labels = [...inputCode.matchAll(/<label\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(labels.length > 0);
  for (const l of labels) assert.match(l, /htmlFor=/, l);
  // 칸이 여럿인 절 — 묶음이 제목을 이름으로 쓴다(성·이름 두 칸, 성별·톤 단추)
  assert.match(inputCode, /<Section title="이름" subtitle=\{`총 \$\{total\}자`\} titleId=\{nameTitleId\}>\s*<div\s+role="group"\s+aria-labelledby=\{nameTitleId\}/);
  assert.match(inputCode, /<Section title="성별" titleId=\{genderTitleId\}>[\s\S]*?labelledBy=\{genderTitleId\}/);
  assert.match(inputCode, /<Section title="톤" titleId=\{toneTitleId\}>[\s\S]*?labelledBy=\{toneTitleId\}/);
  const seg = functionBody(input, "Segmented");
  assert.match(seg, /role="group"\s+aria-labelledby=\{labelledBy\}/);
  assert.match(seg, /aria-pressed=\{active\}/);
  // 시각 칸은 제 이름표가 있다
  assert.match(inputCode, /aria-label="출생 시각 \(선택, 시주 반영\)"/);
});

// ─── 출생일·시각 줄 폭 ─────────────────────────────────────────

test("출생일·시각 줄 — 칸 나눔은 클래스 규칙(480px 이하 한 줄에 하나), 칸은 줄어들 수 있다(MP-10)", () => {
  const css = cssOf(input);
  assert.match(css, /\.eval-birth-row \{ grid-template-columns: minmax\(0, 1\.4fr\) minmax\(0, 1fr\); \}/);
  assert.match(css, /@media \(max-width: 480px\) \{ \.eval-birth-row \{ grid-template-columns: minmax\(0, 1fr\); \} \}/);
  const row = /<div\s+className="eval-birth-row"\s+style=\{\{([^}]*)\}\}/.exec(inputCode);
  assert.ok(row, "출생일 줄을 찾지 못했다");
  assert.doesNotMatch(row[1], /gridTemplateColumns/, "인라인 칸 나눔은 좁은 폭 규칙을 이긴다");
  assert.match(inputCode, /type="time"[\s\S]{0,400}?width: "100%",\s*minWidth: 0,/);
});

// ─── 톤 도움말 ────────────────────────────────────────────────

test("톤 도움말은 결과에 실제로 보이는 것만 말한다 — 엔진 규칙(±8·부드러운 톤의 된소리 감점·중립 0)과 결과의 '톤 보너스' 줄", () => {
  assert.doesNotMatch(inputCode, /실제 톤/);
  const flat = inputCode.replace(/\s+/g, " ");
  assert.ok(flat.includes("고른 톤에 이름의 자음·모음이 잘 맞으면 미학 점수에 톤 보너스가 붙고, 부드러운 톤인데 된소리(ㄲ·ㄸ·ㅃ·ㅆ·ㅉ)로 시작하는 음절이 있으면 줄어요."));
  assert.ok(flat.includes("붙거나 줄어든 톤 보너스는 결과의 미학 점수에 ‘톤 보너스’ 줄로 보여요."));
  assert.ok(flat.includes("중립을 고르면 톤은 점수에 들어가지 않아요."));
  // 옛 문장('붙거나 줄어든 점수는 … 톤 보너스 줄로')은 톤의 효과가 모두 그 줄에 있다고 읽혀 의미 +1 을 찾지 못하게 했다
  assert.ok(!flat.includes("붙거나 줄어든 점수는 결과의 미학 점수에"));
  // 그 줄이 결과 화면에 있다(이름을 바꾸면 이 도움말도 함께)
  assert.match(readAt(SRC, "app", "evaluate", "EvaluateResult.tsx"), /\{ label: "톤 보너스", value: data\.aesthetic\.toneBonus, max: 0, bonus: true \}/);
  // 엔진 규칙 — 부드러운 톤만 된소리 첫소리로 깎고, 중립은 보너스 0
  const engine = readAt(FRONT, "..", "Application", "Engines", "AestheticEngine.cs");
  assert.match(engine, /\["soft"\] = new ToneProfile\s*\{[\s\S]*?PenaltyConsonants = new\[\] \{ 'ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ' \},\s*BonusPoints = 8/);
  assert.match(engine, /\["strong"\] = new ToneProfile\s*\{[\s\S]*?PenaltyConsonants = Array\.Empty<char>\(\),\s*BonusPoints = 8/);
  assert.match(engine, /\["neutral"\] = new ToneProfile \{ BonusPoints = 0 \}/);
  assert.match(engine, /if \(profile\.PenaltyConsonants\.Length > 0 && profile\.PenaltyConsonants\.Contains\(initChar\)\)/);
});

/** C# 메서드 — 시그니처 줄부터 같은 들여쓰기의 닫는 `}` 줄까지(readAt 이 줄바꿈을 LF 로 맞춘 원문) */
function csMethodBody(src, signature) {
  const at = src.indexOf(signature);
  assert.ok(at >= 0, `${signature} 를 찾지 못했다`);
  const lineStart = src.lastIndexOf("\n", at) + 1;
  const indent = /^[ \t]*/.exec(src.slice(lineStart))[0];
  const close = `\n${indent}}\n`;
  const end = src.indexOf(close, at);
  assert.ok(end > at, `${signature} 의 끝을 찾지 못했다`);
  return src.slice(at, end + close.length);
}

test("톤 도움말은 '의미' 줄의 톤 가점(+1)도 말한다 — AestheticEngine.EvaluateMeaning 의 톤 경로", () => {
  const flat = inputCode.replace(/\s+/g, " ");
  assert.ok(
    flat.includes(
      "또 이름 음절로 읽는 한자 가운데 고른 톤으로 분류된 글자가 하나라도 있으면(화면에 보이는 한자가 아니어도) 의미 점수가 1점 올라요. 이 1점은 따로 줄 없이 ‘의미’ 줄에 들어가요.",
    ),
  );
  // 결과 화면의 '의미' 줄(만점 10 — 늘 그린다)
  assert.match(readAt(SRC, "app", "evaluate", "EvaluateResult.tsx"), /\{ label: "의미", value: data\.aesthetic\.meaning, max: 10 \}/);

  const engine = readAt(FRONT, "..", "Application", "Engines", "AestheticEngine.cs");
  // 고른 톤이 의미 평가로 들어가고, 원점수 ×0.10 이 '의미' 줄이다
  assert.match(engine, /int meaningRaw = EvaluateMeaning\(name, tone\);\s*breakdown\.MeaningScore = \(int\)\(meaningRaw \* 0\.10\);/);
  const meaning = csMethodBody(engine, "private int EvaluateMeaning(string name, string tone)");
  // '1점' 이 참인 조건: 원점수가 10 단위(기본 70·카테고리 +20·톤 +10 — 합 100 이라 위 상한에 잘리지 않는다)
  assert.match(meaning, /int score = 70;/);
  assert.match(meaning, /if \(hanjaInfo\.Any\(h => h\.Category == "자연" \|\| h\.Category == "덕목" \|\| h\.Category == "개념"\)\)\s*\{\s*score \+= 20;/);
  assert.match(meaning, /if \(tone == "soft"\)\s*\{\s*if \(hanjaInfo\.Any\(h => h\.TonePref == HanjaData\.TonePreference\.Soft\)\)\s*\{\s*score \+= 10;/);
  assert.match(meaning, /else if \(tone == "strong"\)\s*\{\s*if \(hanjaInfo\.Any\(h => h\.TonePref == HanjaData\.TonePreference\.Strong\)\)\s*\{\s*score \+= 10;/);
  assert.match(meaning, /return Math\.Max\(0, Math\.Min\(100, score\)\);/);
  assert.doesNotMatch(meaning, /neutral/, "중립 톤은 의미 가점이 없다('중립을 고르면 톤은 점수에 들어가지 않아요')");
  // '화면에 보이는 한자가 아니어도' — 톤 가점은 음절마다 쓸 수 있는 글자 전부를 본다(보이는·고른 한자 인자 없음)
  assert.match(meaning, /var hanjaInfo = GetHanjaInfo\(name\);/);
  const info = csMethodBody(engine, "private List<HanjaData.HanjaInfo>? GetHanjaInfo(string name)");
  assert.match(info, /result\.AddRange\(HanjaSelector\.UsableByReading\(c\.ToString\(\)\)\);/);
});
