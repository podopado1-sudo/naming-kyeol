// 한자 입력 화면(/evaluate 음절별 한자 칸)의 원문 검사 — `npm test`
//
// 2026-11 설계 docs/plan-hanja-input-2026-11.md §13-3. 화면 컴포넌트는 node 로 그려 볼 수 없으므로(React·경로 별칭),
// 지켜야 하는 계약을 소스 원문으로 고정한다. 순수 로직(칸 파생·문장)은 hanja-pick.test.mjs · hanja-pick-text.test.mjs 가 값으로 본다.
//
// 지금 보는 것
// - C5(입력 화면): 칸 줄 HanjaSlots · 고르기 패널 HanjaPickerPanel · 입력 폼 EvaluateInput · EvaluateClient 의 입력 쪽.
// - C6(결과 화면): '이 이름의 한자' 블록 HanjaSummaryBlock · 관계 칩 OhaengRelationChip · 결과 화면 EvaluateResult ·
//   후보 표 EvalBody · EvaluateClient 의 제자리 재계산 · /favorites 의 한자 줄.
// 뒤 단계가 이 파일에 더할 것: 설명 글 EvaluateHanjaGuide 와 robots·메타·/name·/ohaeng 링크(C7).
// 그때 NEW_COMPONENTS·NEW_TEXT_FILES 에 파일을 더하면 같은 검사가 걸린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { ROOT, contrast, hexRgb, read as readRaw, tint, token, utilityColor } from "./color-utils.mjs";

/** 소스 원문 — 줄바꿈을 LF 로 맞춘다(저장소가 core.autocrlf 라 기존 파일은 작업 트리에서 CRLF 다) */
const read = (...p) => readRaw(...p).replace(/\r\n/g, "\n");

const AA = 4.5; // 작은 글자(18px 미만)
const WHITE = hexRgb(token("color-surface-token"));
const PAPER = hexRgb(token("color-background-token"));
const SURFACE_2 = hexRgb(token("color-surface-2-token"));

const DESIGN = ["src", "components", "design"];
const SLOTS = [...DESIGN, "HanjaSlots.tsx"];
const PANEL = [...DESIGN, "HanjaPickerPanel.tsx"];
const INPUT = [...DESIGN, "EvaluateInput.tsx"];
const CLIENT = ["src", "app", "evaluate", "EvaluateClient.tsx"];
const STORE = ["src", "lib", "hanja-pick-store.ts"];
const TEXT = ["src", "lib", "hanja-pick-text.ts"];
// 결과 화면(C6)
const BLOCK = [...DESIGN, "HanjaSummaryBlock.tsx"];
const CHIP = [...DESIGN, "OhaengRelationChip.tsx"];
const BODY = [...DESIGN, "EvalBody.tsx"];
const RESULT = ["src", "app", "evaluate", "EvaluateResult.tsx"];
const FAVORITES = ["src", "app", "favorites", "page.tsx"];
const SUMMARY_TEXT = ["src", "lib", "hanja-summary-text.ts"];
const RECALC = ["src", "lib", "hanja-recalc.ts"];

/** 이 기능이 새로 만든 화면 컴포넌트 — 흐림·역할·격자 규칙을 건다 */
const NEW_COMPONENTS = [SLOTS, PANEL, BLOCK];
/** 이 기능이 새로 쓰는 문장이 든 파일 — 금지 문장·고정 조사 꼴을 건다(기존 문장은 범위 밖이다 — 설계 §9) */
const NEW_TEXT_FILES = [SLOTS, PANEL, TEXT, STORE, ["src", "lib", "hanja-pick.ts"], BLOCK, CHIP, SUMMARY_TEXT, RECALC];

const name = (p) => p.at(-1);
/** 주석을 뺀 코드(블록 주석·줄 주석·JSX 주석) — 규칙을 설명하는 주석의 낱말에 걸리지 않게 */
const code = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** `function 이름(` 줄부터 같은 들여쓰기의 닫는 `}` 줄까지(컴포넌트 안에 선언한 함수도 그 들여쓰기로 끝을 찾는다) */
function functionBody(src, fn) {
  const head = new RegExp(`^([ \\t]*)(?:export )?(?:async )?function ${fn}\\(`, "m").exec(src);
  assert.ok(head, `${fn} 함수를 찾지 못했다`);
  const close = `\n${head[1]}}\n`;
  const end = src.indexOf(close, head.index);
  assert.ok(end > head.index, `${fn} 함수의 끝을 찾지 못했다`);
  return src.slice(head.index, end + close.length);
}

// ─── 번들 · 개인정보 ─────────────────────────────────────────

test("클라이언트 화면이 큰 정적 JSON 을 읽는 서버 전용 모듈을 import 하지 않는다", () => {
  for (const p of [SLOTS, PANEL, INPUT, CLIENT, STORE, TEXT, BLOCK, CHIP, BODY, RESULT, FAVORITES, SUMMARY_TEXT, RECALC]) {
    const src = code(read(...p));
    for (const re of [/lib\/hanja-seo/, /lib\/name-seo/, /@\/data\//, /from "\.\/hanja-seo"/, /from "\.\/name-seo"/, /\.json"/]) {
      assert.doesNotMatch(src, re, `${name(p)}: ${re}`);
    }
  }
});

test("이름·한자·생년월일을 콘솔·브라우저 저장소·분석 이벤트에 싣지 않는다", () => {
  for (const p of [SLOTS, PANEL, STORE, TEXT, BLOCK, CHIP, SUMMARY_TEXT, RECALC]) {
    const src = code(read(...p));
    for (const re of [/console\./, /localStorage/, /sessionStorage/, /sendBeacon/, /gtag\(/, /document\.title/, /document\.cookie/]) {
      assert.doesNotMatch(src, re, `${name(p)}: ${re}`);
    }
  }
  // 폼·화면 상태·결과 화면 파일은 예전부터 있던 코드가 섞여 있다 — 콘솔만 본다
  for (const p of [INPUT, CLIENT, RESULT, BODY]) assert.doesNotMatch(code(read(...p)), /console\./, name(p));
  // 응답 캐시·본 조합 목록은 메모리에만 둔다(브라우저 저장소에 쓰지 않는다)
  assert.doesNotMatch(code(read(...CLIENT)), /localStorage|sessionStorage|indexedDB/);
});

test("음절 파일을 받는 곳은 저장소 모듈 하나 — 주소는 lib/hanja-pick 의 두 함수가 만든 것뿐이다", () => {
  const store = code(read(...STORE));
  const fetches = [...store.matchAll(/\bfetch\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.deepEqual(fetches, ["HANJA_PICK_INDEX", "url"]);
  assert.match(store, /const url = syllableFile\(syllable\);\s*if \(!url\) return Promise\.resolve\(null\);/);
  // 화면 컴포넌트는 직접 fetch 하지 않는다(판정 API 는 lib/api 의 hanjaResolve)
  for (const p of [SLOTS, PANEL, INPUT, TEXT, BLOCK, CHIP, BODY, SUMMARY_TEXT, RECALC]) assert.doesNotMatch(code(read(...p)), /\bfetch\(/, name(p));
});

test("이름을 칠 때는 음절 파일을 받지 않는다 — 받는 자리는 주소로 온 한자·들고 온 글자·붙여넣기 셋과 패널", () => {
  const input = code(read(...INPUT));
  // 이름 입력을 다루는 함수들에는 파일 요청이 없다
  for (const fn of ["commitSettle", "scheduleSettle", "changeName", "settleable"]) {
    assert.doesNotMatch(functionBody(input, fn), /requestPick(File|Index)/, fn);
  }
  const calls = [...input.matchAll(/requestPickFile\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.deepEqual(calls, ["item.syllable", "syllable", "slot.syllable"]);
  // ⓒ 주소로 온 한자: 확인을 기다리는 칸만 · ⓑ 들고 온 글자: 이름에 그 글자가 들어갈 음절만 · ⓔ 붙여넣기: 나눠 넣을 자리만
  assert.match(input, /for \(const item of seeded\.pending\) \{\s*if \(!store\.failed\.has\(item\.syllable\)\) void requestPickFile\(item\.syllable\);/);
  assert.match(input, /for \(const syllable of pickSyllablesIn\(carried, settled\.firstName\)\) void requestPickFile\(syllable\);/);
  assert.match(input, /const targets = allSlots\.slice\(start, start \+ characters\.length\)\.filter\(\(slot\) => slot\.openable\);\s*await Promise\.all\(targets\.map\(\(slot\) => requestPickFile\(slot\.syllable\)\)\);/);
  // ⓐ 칸을 열 때: 패널이 그 음절 하나를 받는다
  const panel = code(read(...PANEL));
  assert.deepEqual([...panel.matchAll(/requestPickFile\(([^)]*)\)/g)].map((m) => m[1]), ["syllable"]);
  // ⓓ #pick 도착: 링크에 적힌 독음(입력값이 아니다)
  const client = code(read(...CLIENT));
  assert.deepEqual([...client.matchAll(/requestPickFile\(([^)]*)\)/g)].map((m) => m[1]), ["reading"]);
});

test("판정 API 에는 뽑은 한자 한 글자만 보낸다 — 붙여 넣은 원문을 보내지 않는다", () => {
  const panel = code(read(...PANEL));
  assert.equal([...panel.matchAll(/hanjaResolve\(/g)].length, 1);
  assert.match(
    panel,
    /const text = firstHanCodePoint\(raw\);\s*if \(!text\) return;[\s\S]*?hanjaResolve\(\{ text, syllable: slot\.syllable, target: slot\.target \}\)/
  );
  // 여러 글자는 서버로 가지 않고 칸 줄 쪽(나눠 넣기)으로 넘긴다
  assert.match(panel, /if \(characters\.length > 1 && onSpread\) \{\s*dropJudge\(\);\s*onSpread\(characters\);\s*return;/);
  // 5초에서 기다리기를 끝내고, 늦게 온 응답은 번호로 버린다
  assert.match(panel, /const JUDGE_TIMEOUT_MS = 5_000;/);
  assert.match(panel, /if \(seqRef\.current !== seq\) return;/);
});

test("고른 한자가 평가 요청에 실린다 — 폼은 칸의 표시 글자를, 화면 상태는 apiHanjaFields 를 쓴다", () => {
  const input = code(read(...INPUT));
  assert.match(input, /const now = deriveSlots\(\{ lastName, firstName \}, choices, pick, store\.index, store\.files\);/);
  assert.match(input, /hanja: marksOf\(now\.name\)\.join\(""\),\s*lastHanja: marksOf\(now\.surname\)\.join\(""\),/);
  const client = code(read(...CLIENT));
  assert.match(client, /tone: input\.tone,\s*\.\.\.apiHanjaFields\(input\),/);
  // 한자 칸의 400(target·slot)은 하단 띠가 아니라 폼으로 넘긴다
  assert.match(client, /err instanceof ApiError && err\.status === 400 && err\.target/);
  assert.match(client, /setFieldError\(\{ id, target: err\.target, slot: err\.slot \?\? -1, message: err\.message \}\);/);
});

test("들고 온 글자(#pick)는 해시로만 읽고, 읽은 해시는 주소에서 지운다 — 서명·쿼리에 넣지 않는다", () => {
  const client = code(read(...CLIENT));
  assert.match(client, /const pick = parsePickHash\(window\.location\.hash\);\s*if \(!pick\) return;\s*replaceUrl\(window\.location\.pathname \+ window\.location\.search\);\s*onPick\(pick\);/);
  assert.match(client, /window\.addEventListener\("hashchange", read\);/);
  // 띠에는 음절 파일로 확인된 독음만
  assert.match(client, /const \{ ready, readings \} = confirmedPickReadings\(pendingPick, files\);\s*return ready && readings\.length > 0 \? \{ character: pendingPick\.character, readings \} : null;/);
  // 자동 평가를 뜻하는 주소·결과 화면에서는 버린다
  assert.match(client, /if \(resultShownRef\.current\) return;/);
  assert.match(client, /if \(canAutoEvaluate\(inputFromParams\(new URLSearchParams\(window\.location\.search\)\)\)\) return;/);
  // 들고 온 글자는 주소 모듈(서명·쿼리) 밖이다 — 그 모듈은 해시를 읽지도 쓰지도 않는다
  assert.doesNotMatch(code(read("src", "app", "evaluate", "evaluate-params.ts")), /pick=|\.hash\b|pendingPick|parsePickHash/);
});

// ─── 문장 ────────────────────────────────────────────────────

test("새 문장에 길흉 단정·검수 주장·빈도 근거 없는 말이 없다(설명의 '길흉 분류' 같은 사실 서술은 걸리지 않는다)", () => {
  const banned = /길하|흉하|대길|대흉|운이 (좋아|트)|기운을 받|전문가|작명가가 (검토|검수|감수)|감수|검수했|사주를 고친|운을 바꾼|많이 쓰는 순|자주 쓰는 글자|가장 흔한/;
  assert.doesNotMatch("전통 81수리의 길흉 분류", banned);
  assert.match("길하다고 봅니다", banned);
  for (const p of NEW_TEXT_FILES) assert.doesNotMatch(read(...p), banned, name(p));
  // 폼에 더한 문장(소개 한 줄)
  assert.match(read(...INPUT), /아기 이름 한자를 정하는 중이라면 음절마다 인명용 한자를 직접 골라 넣을 수 있어요\./);
});

test("사전에 없는 글자·혼용 이름을 두고 출생신고 가부를 단정하지 않는다(설계 §20)", () => {
  for (const p of [...NEW_TEXT_FILES, INPUT]) {
    const src = code(read(...p)); // 주석은 '이렇게 쓰지 않는다'를 설명하느라 그 말을 인용한다
    for (const re of [/출생신고에 쓸 수 없는/, /대법원 목록에 없는/, /받아 주지 않을 수/, /반드시 받아/, /한글로만 또는 한자로만/, /인명용 한자 전(체|부)/]) {
      assert.doesNotMatch(src, re, `${name(p)}: ${re}`);
    }
  }
  const text = read(...TEXT);
  assert.match(text, /현행 가족관계등록예규\(제638호\)는 이렇게 섞어 적은 출생신고도 수리할 수 있다고 정하고 있어요\./);
});

test("변수 뒤에 조사를 붙이지 않는다 — 끼워 넣은 값(따옴표로 감싼 것 포함) 바로 뒤의 조사·괄호형 조사가 없다", () => {
  // 설계 §13-3 은 '닫는 따옴표 바로 뒤의 조사'를 잡으라고 했지만, 그 꼴은 설계가 정한 고정 문장(‘이름에 피하는 글자’는 · ‘확장 한자’는)도 잡는다.
  // 막으려는 것은 받침을 모르는 **변수** 뒤의 조사(‘윤’를)이므로 끼워 넣은 값 ${…} 바로 뒤(닫는 따옴표를 사이에 둔 것 포함)만 본다.
  const fixed = /\$\{[^}]*\}[’」]?(을|를|은|는|이|가|와|과|로|으로|나|이나)[\s,.]/;
  const paren = /은\(는\)|이\(가\)|을\(를\)|\(으\)로|과\(와\)/;
  const dollar = "$";
  assert.match(`‘${dollar}{syllable}’를 넣어`, fixed);
  assert.match(`${dollar}{name}은 좋아요`, fixed);
  assert.doesNotMatch(`‘${dollar}{syllable}’ 음절을 넣어`, fixed);
  assert.doesNotMatch(`‘${dollar}{character}’(${dollar}{shown}) 글자로 읽는`, fixed);
  // JSX 에 끼운 값({slot.syllable}’를)도 같은 꼴이다
  const fixedJsx = /\}[’」](을|를|은|는|이|가|와|과|로|으로|나|이나)[\s,.<]/;
  assert.match("‘{slot.syllable}’를 넣어", fixedJsx);
  for (const p of [SLOTS, PANEL, INPUT, BLOCK, BODY, RESULT]) assert.doesNotMatch(code(read(...p)), fixedJsx, name(p));
  for (const p of NEW_TEXT_FILES) {
    const src = code(read(...p));
    assert.doesNotMatch(src, fixed, name(p));
    assert.doesNotMatch(src, paren, name(p));
  }
});

test("잠긴 칸·쓸 글자가 없는 칸의 안내는 lib/no-hanja 의 문장 하나를 쓴다(새 문장을 만들지 않는다)", () => {
  const text = code(read(...TEXT));
  assert.match(text, /import \{ noHanjaSyllableNote \} from "\.\/no-hanja";/);
  assert.match(text, /slot\.state === "locked" \|\| slot\.state === "hangul" \? noHanjaSyllableNote\(slot\.syllable\) : null/);
  assert.match(code(read(...PANEL)), /\{zeroUsable && <p [^>]*>\{noHanjaSyllableNote\(slot\.syllable\)\}<\/p>\}/);
  for (const p of [SLOTS, PANEL, INPUT, TEXT]) assert.doesNotMatch(read(...p), /한글로 두기를 권해요/, `${name(p)} 에 그 문장을 다시 적었다`);
});

// ─── 스타일 규칙(.sumi-form 전역 규칙·대비) ───────────────────

test("새 컴포넌트는 상태를 흐림(opacity)으로 알리지 않는다 — 주석에도 그 낱말이 없다(설계 §19 의 grep 과 같다)", () => {
  for (const p of NEW_COMPONENTS) assert.equal([...read(...p).matchAll(/opacity/gi)].length, 0, name(p));
});

test("새 컴포넌트는 콤보·탭 역할과 인라인 2열 격자를 쓰지 않는다 — 폼 전역 규칙(.sumi-form)에 걸린다", () => {
  for (const p of NEW_COMPONENTS) {
    const src = read(...p);
    for (const re of [/role="combobox"/, /role="tablist"/, /role="tab"/, /repeat\(2/]) assert.doesNotMatch(src, re, `${name(p)}: ${re}`);
  }
  // 그 전역 규칙이 아직 있는지(없어졌다면 이 테스트의 전제를 다시 볼 것)
  const css = read("src", "app", "globals.css");
  assert.match(css, /\.sumi-form button\[role="combobox"\]/);
  assert.match(css, /\.sumi-form \[style\*="grid-template-columns: repeat\(2"\]/);
  // 패널의 입력 칸은 type 을 주고 모양을 직접 정한다(전역의 밑줄 입력 규칙보다 인라인이 앞선다)
  const panel = read(...PANEL);
  const inputs = panel.match(/<input\b[\s\S]*?\/>/g) ?? [];
  assert.equal(inputs.length, 2, "패널의 입력 칸은 직접 입력·찾기 둘");
  for (const tag of inputs) {
    assert.match(tag, /type="text"/);
    assert.match(tag, /style=\{textInputStyle\(/);
    assert.doesNotMatch(tag, /maxLength/, "확장 한자는 UTF-16 길이 2, 조합 중에는 한글이 들어온다 — 길이를 막지 않는다");
  }
  assert.match(panel, /outline: focused \? "2px solid var\(--color-teal\)" : "none",/);
});

test("패널은 높이를 막고 목록 영역만 스크롤한다 — dvh 를 모르는 브라우저는 vh", () => {
  const css = read("src", "app", "globals.css");
  const panelRule = /\.hanja-picker-panel \{([^}]*)\}/.exec(css);
  assert.ok(panelRule, ".hanja-picker-panel 규칙이 없다");
  assert.match(panelRule[1], /max-height: min\(70vh, 560px\);\s*max-height: min\(70dvh, 560px\);/);
  assert.match(panelRule[1], /overflow: hidden;/);
  assert.match(css, /\.hanja-picker-body \{[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;[^}]*\}/);
  // 목록·성씨 격자의 글자는 기기 서체(사이트 한자 서체 조각을 내려받지 않는다 — 실측 기록은 그 규칙의 주석)
  const glyph = /\.hanja-picker-glyph \{([^}]*)\}/.exec(css);
  assert.ok(glyph);
  assert.doesNotMatch(glyph[1], /var\(--font-serif\)/);
  const panel = read(...PANEL);
  assert.match(panel, /className="hanja-picker-panel"/);
  assert.match(panel, /className="hanja-picker-head"/);
  assert.match(panel, /className="hanja-picker-body"/);
  // 목록 글자에 사이트 한자 서체 클래스를 쓰지 않는다(버튼 속 한 글자만)
  assert.equal([...panel.matchAll(/className="hanja-picker-glyph"/g)].length, 2, "이름 목록 줄·성씨 격자");
  assert.equal([...panel.matchAll(/className="font-hanja"/g)].length, 2, "기본 한자로 (柳)·권하는 글자 버튼");
});

test("누름 영역 — 칸 56px, 목록 줄 56px 이상, 버튼·오행 칩·성씨 격자 칸 44px 이상", () => {
  const slots = read(...SLOTS);
  assert.match(slots, /const boxBase: CSSProperties = \{\s*width: 56,\s*height: 56,/);
  const panel = read(...PANEL);
  assert.match(functionBody(panel, "CandidateRow"), /minHeight: 56,/);
  assert.match(functionBody(panel, "SurnamePanel"), /minHeight: 56,/);
  assert.match(functionBody(panel, "ElementButton"), /minHeight: 44,/);
  assert.match(panel, /const actionButton: CSSProperties = \{[^}]*minHeight: 44,/);
  assert.match(functionBody(panel, "textInputStyle"), /minHeight: 44,/);
});

test("새 컴포넌트의 작은 글씨는 글자 전용 토큰 — 바탕과 4.5:1 을 넘는다", (t) => {
  const pairs = [
    // 잠긴 칸의 '한글'(13px) — surface-2 바탕
    ["text-3 / surface-2", hexRgb(token("color-text-3-token")), SURFACE_2, SLOTS, /color: locked \? "var\(--color-text-3\)" : "var\(--color-text-2\)"/],
    // 칸 아래 '기본 한자'(10.5px) — 폼 카드(종이) 위
    ["text-3 / 종이", hexRgb(token("color-text-3-token")), PAPER, SLOTS, /fontSize: 10\.5, lineHeight: 1\.2, color: "var\(--color-text-3\)"/],
    // 패널의 주의 문장 — 흰 바탕 · 칸 줄 아래의 오류 문장 — 종이
    ["amber-warm-700 / 흰", hexRgb(token("color-amber-warm-700-token")), WHITE, PANEL, /const warnText: CSSProperties = \{ \.\.\.hintText, color: "var\(--color-amber-warm-700\)" \};/],
    ["amber-warm-700 / 종이", hexRgb(token("color-amber-warm-700-token")), PAPER, INPUT, /const slotAlertStyle: CSSProperties = \{ \.\.\.slotNoteStyle, color: "var\(--color-amber-warm-700\)" \};/],
    // 성씨 격자의 '기본'(10.5px) — 고른 칸은 teal-50 바탕
    ["teal-800 / teal-50", hexRgb(token("color-teal-800-token")), hexRgb(token("color-teal-50-token")), PANEL, /fontSize: 10\.5, lineHeight: 1\.2, fontWeight: 600, color: "var\(--color-teal-800\)"/],
    ["text-2 / teal-50", hexRgb(token("color-text-2-token")), hexRgb(token("color-teal-50-token")), PANEL, /fontSize: 11, lineHeight: 1\.2, color: "var\(--color-text-2\)"/],
  ];
  for (const [label, fg, bg, file, re] of pairs) {
    assert.match(read(...file), re, `${name(file)}: ${label} 자리를 찾지 못했다`);
    const ratio = contrast(fg, bg);
    t.diagnostic(`${label}: ${ratio.toFixed(2)}:1`);
    assert.ok(ratio >= AA, `${label} ${ratio.toFixed(2)}:1`);
  }
  // 목록 줄은 '지금 고른 글자'를 바탕색으로 알리지 않는다 — teal-50 위에서는 오행 칩 글자(木·火·金)가 4.2:1 로 떨어진다
  const row = functionBody(read(...PANEL), "CandidateRow");
  assert.doesNotMatch(row, /teal-50/);
  assert.match(row, /background: el\.tintBg,\s*color: el\.text,/);
  // 오행 글자색에 표지색(.color)을 쓰지 않는다(palette-contrast 의 검사 목록에도 두 파일이 들어 있다)
  for (const p of NEW_COMPONENTS) assert.doesNotMatch(read(...p), /(?<![\w-])color:\s*[\w[\]?.]*\.color\b/, name(p));
});

// ─── 접근성 계약(설계 §8-8) ───────────────────────────────────

test("칸 버튼 — 이름(aria-label)·aria-expanded·aria-controls, 잠긴 칸은 aria-disabled + 안내 문장", () => {
  const slots = read(...SLOTS);
  assert.match(slots, /<button\s+key=\{key\}\s+type="button"/);
  assert.match(slots, /aria-label=\{slotAriaLabel\(slot\)\}/);
  assert.match(slots, /aria-expanded=\{locked \? undefined : open\}/);
  assert.match(slots, /aria-controls=\{open \? panelId : undefined\}/);
  assert.match(slots, /aria-disabled=\{locked \|\| undefined\}/);
  assert.match(slots, /aria-describedby=\{describedBy\?\.\(slot\)\}/);
  // 잠긴 칸은 disabled 속성이 아니다(포커스가 닿아야 안내를 읽는다) — 누르면 아무 일도 없다
  assert.doesNotMatch(code(slots), /(?<![-\w])disabled=/);
  assert.match(slots, /if \(!locked\) onToggle\(slot\);/);
  // 폼: 잠긴 칸의 안내·오류 문장을 그 칸에 잇는다
  const input = read(...INPUT);
  assert.match(input, /return \[noteIdOf\.get\(key\), key === errorKey \? errorId : undefined\]\.filter\(Boolean\)\.join\(" "\) \|\| undefined;/);
  assert.match(input, /<p id=\{errorId\} role="alert" style=\{slotAlertStyle\}>/);
});

test("패널 — region + 제목, 열리면 PC 는 직접 입력 칸·그 밖은 제목으로 포커스, Esc·닫기로 닫힌다", () => {
  const panel = read(...PANEL);
  assert.match(panel, /role="region"\s+aria-labelledby=\{titleId\}/);
  assert.match(panel, /const PC_QUERY = "\(hover: hover\) and \(pointer: fine\)";/);
  assert.match(panel, /const target = \(pc \? inputRef\.current : null\) \?\? titleRef\.current;\s*target\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(panel, /tabIndex=\{-1\}/);
  assert.match(panel, /if \(e\.key !== "Escape" \|\| e\.nativeEvent\.isComposing\) return;\s*e\.stopPropagation\(\);\s*onClose\(\);/);
  // 폼: 닫으면(고르기·닫기·Esc·같은 칸 다시 누르기) 그 칸 버튼으로 포커스가 돌아간다
  const input = read(...INPUT);
  assert.match(input, /button\?\.focus\(\{ preventScroll: true \}\);\s*button\?\.scrollIntoView\(\{ block: "nearest" \}\);/);
  for (const fn of ["closePanel", "applyChoice"]) assert.match(functionBody(input, fn), /setOpenKey\(null\);\s*focusSlot\(/, fn);
  assert.match(functionBody(input, "toggleSlot"), /setOpenKey\(effectiveOpenKey === key \? null : key\);/);
  // 한 번에 한 칸 — 열린 칸은 값 하나, 패널도 하나
  assert.equal([...input.matchAll(/<HanjaPickerPanel\b/g)].length, 1);
});

test("직접 입력·찾기 — 보이는 label, 판정 문장은 aria-describedby·aria-invalid, 도움말은 status·판정은 alert", () => {
  const panel = read(...PANEL);
  const direct = functionBody(panel, "DirectInput");
  assert.match(direct, /<label htmlFor=\{inputId\} style=\{fieldLabel\}>/);
  assert.match(direct, /aria-describedby=\{describedBy\}/);
  assert.match(direct, /aria-invalid=\{invalid \|\| undefined\}/);
  assert.match(direct, /<p role="alert" style=\{warnText\}>\s*\{alertText\}/);
  assert.match(direct, /<p role="status" style=\{hintText\}>\s*\{DIRECT_CHECKING\}/);
  assert.match(direct, /<p role="status" style=\{hintText\}>\s*\{hangulOnlyHelp\(slot\.syllable\)\}/);
  assert.doesNotMatch(direct, /placeholder=/, "직접 입력의 이름을 placeholder 로 대신하지 않는다");
  // 조합 중에는 판정하지 않는다
  assert.match(direct, /if \(composing \|\| \(e\.nativeEvent as InputEvent\)\.isComposing\) \{\s*setValue\(next\);\s*return;/);
  const namePanel = functionBody(panel, "NamePanel");
  assert.match(namePanel, /<label htmlFor=\{searchId\} style=\{fieldLabel\}>\s*뜻·글자로 찾기/);
  assert.match(namePanel, /<p role="status"[^>]*>\s*\{matches\.length > 0 \? `\$\{matches\.length\}자 찾음` : searchEmptyNote\(pc\)\}/);
  // 오행 거르기는 누름 상태 버튼
  assert.match(functionBody(panel, "ElementButton"), /aria-pressed=\{on\}/);
});

test("목록 한 줄은 버튼 하나 — 안에 포커스 요소(툴팁 배지·링크)를 두지 않고 등급은 글로 적는다", () => {
  const panel = read(...PANEL);
  const row = functionBody(panel, "CandidateRow");
  assert.equal([...row.matchAll(/<button\b/g)].length, 1);
  for (const re of [/tabIndex/, /<a\b/, /<Link\b/, /ResourceGradeBadge/, /<input\b/]) assert.doesNotMatch(row, re, String(re));
  assert.match(row, /RESOURCE_GRADE_INFO\[gradeKey as ResourceBadgeKey\]\?\.label/);
  assert.doesNotMatch(panel, /ResourceGradeBadge/);
});

test("성씨 패널은 글자 격자뿐 — 훈·이름용 표시·묶음이 본문에 없다", () => {
  const body = functionBody(read(...PANEL), "SurnamePanel");
  for (const word of ["이름에 피하는 글자", "먼저 보여 드리는", "gloss", "forbidden", "hasMeaning", "common", "groupCandidates", "filterCandidates", "CandidateRow"]) {
    assert.ok(!body.includes(word), `성씨 패널 본문에 ${word} 가 있다`);
  }
  assert.match(body, /sortForSurname\(list \?\? \[\], representative\)/);
  assert.match(body, /const pick = \(fact: HanjaFact\) => onPick\(asSurnameFact\(fact\)\);/);
  // 버튼 이름은 글자와 획수(훈을 읽지 않는다), 직접 입력은 있다
  assert.match(body, /aria-label=\{\[fact\.character, strokes\]\.filter\(Boolean\)\.join\(" "\) \+ \(isDefault \? ", 기본 한자" : ""\)\}/);
  assert.match(body, /<DirectInput/);
  assert.doesNotMatch(body, /onNone/, "성씨 칸에는 '한자 없이'가 없다");
  // 칸 줄도 성씨 칸의 훈을 읽지 않는다
  assert.match(read(...TEXT), /const gloss = slot\.target === "name" \? \(slot\.fact\?\.gloss \?\? ""\) : "";/);
});

test("들고 온 글자의 띠·준비 중 안내는 status, 주소로 온 한자를 비운 안내는 alert", () => {
  const input = read(...INPUT);
  assert.match(input, /<span role="status"[^>]*>\s*\{pickBannerText\(pick\.character, pick\.readings, settled\.firstName\)\}/);
  assert.match(input, /<p role="status" style=\{slotGuideStyle\}>\s*\{SLOTS_PREPARING\}/);
  assert.match(input, /<p key=\{item\.key\} role="alert" style=\{slotAlertStyle\}>\s*\{seedRejectedNote\(item\.character, item\.syllable\)\}/);
  // 이름을 넣기 전의 안내 줄은 조건 없이 첫 HTML 에 실리는 문장이다(색인을 기다리지 않는다)
  assert.match(input, /\{nameSlots\.length === 0 && !jamoPending && <p style=\{slotGuideStyle\}>\{SLOTS_EMPTY_GUIDE\}<\/p>\}/);
});

test("칸 줄은 조합이 끝난 값으로 다시 그린다 — 조합 끝에 바로, 그 밖에는 틈을 두고", () => {
  const input = read(...INPUT);
  assert.match(input, /const SETTLE_MS = 300;/);
  const atom = functionBody(input, "Input");
  assert.match(atom, /onCompositionStart=\{onCompositionStart\}\s*onCompositionEnd=\{\(e\) => onCompositionEnd\?\.\(e\.currentTarget\.value\)\}\s*onBlur=\{onBlur\}/);
  assert.equal([...input.matchAll(/composingRef\.current = false;\s*commitSettle\(/g)].length, 2, "성·이름 칸의 compositionend");
  assert.match(functionBody(input, "scheduleSettle"), /composingRef\.current \? SETTLE_COMPOSING_MS : SETTLE_MS/);
  // 낱자모가 남은 값은 받지 않고 직전 칸 줄을 둔다
  assert.match(functionBody(input, "settleable"), /return text === "" \|\| isHangulSyllables\(text\) \? text : null;/);
});

test("새 파일들이 있다", () => {
  for (const p of [SLOTS, PANEL, STORE, TEXT, BLOCK, CHIP, SUMMARY_TEXT, RECALC]) assert.ok(existsSync(join(ROOT, ...p)), name(p));
});

// ═════════════════════════════════════════════════════════════
// 결과 화면(C6) — '이 이름의 한자' 블록 · 제자리 재계산 · 후보 표 · 저장·공유
// ═════════════════════════════════════════════════════════════

test("관계 칩 — 서버·클라이언트가 함께 쓰는 컴포넌트. 색 표와 마크업은 /name 조합 카드의 것 그대로", () => {
  const chip = read(...CHIP);
  assert.doesNotMatch(chip, /^\s*["']use client["']/m);
  const table = /const OHAENG_CHIP[^{]*\{([\s\S]*?)\n\};/.exec(chip);
  assert.ok(table, "OHAENG_CHIP 선언 꼴(const OHAENG_CHIP … = { … };)이 바뀌었다 — palette-contrast 가 이 꼴로 읽는다");
  const rows = [...table[1].matchAll(/(생|비화|극|unknown):\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(rows, [
    ["생", "bg-teal-50 text-teal-700"],
    ["비화", "bg-navy-50 text-navy"],
    ["극", "bg-gold-50 text-gold-800"],
    ["unknown", ""],
  ]);
  assert.match(
    chip,
    /className=\{`inline-block rounded-md px-2\.5 py-1 text-xs font-medium \$\{OHAENG_CHIP\[kind\]\}`\}\s*>\s*자원오행 \{label\}\s*<\/span>/
  );
  // /name 조합 카드가 아직 제 색 표를 갖고 있으면(그쪽을 이 컴포넌트로 바꾸기 전) 두 표가 글자 그대로 같다
  const old = /const OHAENG_CHIP[^{]*\{([\s\S]*?)\n\};/.exec(read("src", "app", "name", "[slug]", "page.tsx"));
  if (old) assert.equal(table[1], old[1]);
  // 글자색 대비 4.5:1 — palette-contrast 가 /name 의 표에 거는 것과 같은 검사
  for (const [kind, cls] of rows.filter(([, c]) => c)) {
    const ratio = contrast(utilityColor(/\btext-([\w-]+)/.exec(cls)[1]), utilityColor(/\bbg-([\w-]+)/.exec(cls)[1]));
    assert.ok(ratio >= AA, `${kind} ${ratio.toFixed(2)}:1`);
  }
  // 관계로 점수를 매기지 않는다 — 칩은 말만 그린다
  assert.doesNotMatch(code(chip), /score|점수/i);
});

test("결과 블록 — 그릴 글자는 blockView(확정 응답, 기다리는 변경) 하나로 정한다: 변경이 걷히면 확정된 조합으로 돌아간다", () => {
  const block = code(read(...BLOCK));
  assert.match(block, /const view = useMemo\(\(\) => blockView\(summary, pending\), \[summary, pending\]\);/);
  assert.match(block, /const slots = useMemo\(\(\) => blockSlots\(view, store\.index\), \[view, store\.index\]\);/);
  // 칸 줄·패널은 입력 화면과 같은 컴포넌트(세로 줄 배치)
  assert.equal([...block.matchAll(/<HanjaSlots\b/g)].length, 1);
  assert.equal([...block.matchAll(/<HanjaPickerPanel\b/g)].length, 1);
  assert.match(block, /detail=\{detail\}\s*between=\{between\}/);
  // 관계 칩은 이름 꼴(ohaengRelationName) + 공용 칩. 이름 글자 앞에만 둔다(복성의 두 글자 사이에는 없다)
  assert.match(
    block,
    /if \(next\.target !== "name"\) return null;\s*const relation = relationBetween\(previous\.fact, next\.fact\);\s*return relation \? <OhaengRelationChip kind=\{relation\.kind\} label=\{relation\.label\} \/> : null;/
  );
  assert.match(code(read(...SUMMARY_TEXT)), /const relation = ohaengRelationName\(a\.fiveElement, b\.fiveElement\);/);
  // 성씨 줄은 글자·획수·자원오행 칩뿐 — 훈·역할 꼬리표·이름용 표시가 본문에 없다
  const surname = functionBody(read(...BLOCK), "SurnameDetail");
  for (const word of ["gloss", "forbidden", "fills", "fillLabel", "hasMeaning", "이름에 피하는", "빼는 글자"]) {
    assert.ok(!surname.includes(word), `성씨 줄에 ${word} 가 있다`);
  }
  assert.match(surname, /<FactChips fact=\{slot\.fact\} surname \/>/);
  // 역할 꼬리표는 이름 글자에만 — 응답 fills(대기 중에는 rolesOf) 그대로
  assert.match(
    functionBody(read(...BLOCK), "NameDetail"),
    /syllable\.fills\.map\(\(fill\) => \(\s*<span key=\{fill\} style=\{fillTagStyle\(isPenaltyFill\(fill\)\)\}>\s*\{fillLabel\(fill, fact\.fiveElement, fit\)\}/
  );
});

test("결과 블록 — 다시 계산하지 못하면 그 칸 아래 alert + [다시 시도] [닫기], 비교 줄은 버튼 + aria-current", () => {
  const block = read(...BLOCK);
  assert.match(block, /<p role="alert" style=\{\{ \.\.\.alertText, margin: 0 \}\}>\s*\{recalcFailedNote\(/);
  assert.match(block, />\s*다시 시도\s*<\/button>/);
  assert.match(block, />\s*닫기\s*<\/button>/);
  // 안내가 사라지면 포커스가 그 칸 버튼으로(문서 맨 위로 떨어지지 않게)
  assert.equal([...block.matchAll(/focusSlot\(slot\);\s*on(Retry|DismissError)\(\);/g)].length, 2);
  // 칸 버튼에 오류 문장을 잇는다
  assert.match(block, /slotKey\(slot\) === errorKey \? errorId : undefined,/);
  // 서버가 짚은 칸(400 의 target·slot)은 그 칸의 패널을 연다 — 한 번만
  assert.match(block, /const forcedKey = recalcError\?\.open && errorKey && recalcError\.id !== ackedError \? errorKey : null;/);
  // 패널을 닫으면(고르기·닫기·Esc) 그 칸 버튼으로 포커스
  assert.match(block, /button\?\.focus\(\{ preventScroll: true \}\);\s*button\?\.scrollIntoView\(\{ block: "nearest" \}\);/);
  for (const fn of ["closePanel", "applyChoice"]) assert.match(functionBody(block, fn), /setOpenKey\(null\);\s*focusSlot\(/, fn);
  assert.match(functionBody(block, "toggleSlot"), /setOpenKey\(effectiveOpenKey === key \? null : key\);/);
  // 비교 줄 — 2개 이상일 때만, 줄 = 버튼, 지금 조합에 aria-current
  assert.match(block, /\{seen\.length >= 2 && \(/);
  assert.match(block, /if \(rows\.length < 2\) return null;/);
  assert.match(block, /aria-current=\{current \? "true" : undefined\}\s*onClick=\{\(\) => onSelect\(entry\.sig\)\}/);
});

test("결과 블록 — 숫자를 만들지 않는다: 비교 줄의 점수는 받아 둔 응답의 세 값뿐", () => {
  const block = code(read(...BLOCK));
  const scores = [...block.matchAll(/\bdata\.(\w*Score)\b/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(scores)].sort(), ["aestheticScore", "finalScore", "harmonyScore"]);
  assert.doesNotMatch(block, /Score\s*[-+*/]|[-+*/]\s*data\.\w*Score|Math\./);
  // 생년월일이 없으면 점수 대신 달라지는 사실(응답에 실린 값)
  assert.match(block, /\{line\.strokeSum !== null && <span style=\{seenChunk\}>앞 두 글자 획수 합 \{line\.strokeSum\}<\/span>\}/);
});

test("결과 블록의 작은 글씨는 글자 전용 토큰 — 바탕과 4.5:1 을 넘는다", (t) => {
  const block = read(...BLOCK);
  // 역할 꼬리표 — 감점은 주의 글자색(amber 10% 틴트 위), 그 밖은 청록 글자색(teal-50 위)
  assert.match(
    block,
    /background: penalty \? "rgba\(181,135,76,0\.10\)" : "var\(--color-teal-50\)",\s*color: penalty \? "var\(--color-amber-warm-700\)" : "var\(--color-teal-800\)",/
  );
  assert.match(block, /const alertText: CSSProperties = \{ \.\.\.noteText, color: "var\(--color-amber-warm-700\)" \};/);
  const amber700 = hexRgb(token("color-amber-warm-700-token"));
  const teal800 = hexRgb(token("color-teal-800-token"));
  const pairs = [
    ["감점 꼬리표 amber-warm-700 / amber 10% 틴트(흰 카드 위)", amber700, tint([181, 135, 76], 0.1, WHITE)],
    ["꼬리표 teal-800 / teal-50", teal800, hexRgb(token("color-teal-50-token"))],
    ["주의 문장 amber-warm-700 / 흰 카드", amber700, WHITE],
    ["'지금 조합'·'지금 한자'·읽는 법 teal-800 / 흰 카드", teal800, WHITE],
    ["안내 문장·대기 글 배지 text-2 / 흰 카드", hexRgb(token("color-text-2-token")), WHITE],
    ["획수 고지 text-3 / 흰 카드", hexRgb(token("color-text-3-token")), WHITE],
  ];
  for (const [label, fg, bg] of pairs) {
    const ratio = contrast(fg, bg);
    t.diagnostic(`${label}: ${ratio.toFixed(2)}:1`);
    assert.ok(ratio >= AA, `${label} ${ratio.toFixed(2)}:1`);
  }
  // 후보 표의 '지금 한자' 글
  assert.match(read(...BODY), /fontSize: 12\.5,\s*fontWeight: 600,\s*color: "var\(--color-teal-800\)",/);
});

test("결과 화면 — 기다리는 동안 흐리게 하지 않고 글 배지와 aria-busy 로 알린다", () => {
  const result = read(...RESULT);
  assert.equal([...result.matchAll(/opacity/gi)].length, 1, "EvaluateResult 의 흐림은 세대 칩의 구분점 하나뿐이어야 한다");
  assert.match(result, /<span style=\{\{ opacity: 0\.55, fontWeight: 500 \}\}> · <\/span>/);
  assert.equal([...result.matchAll(/aria-busy=\{waiting \|\| undefined\}/g)].length, 3, "타일 묶음·미학·조화 패널");
  assert.match(result, /\{waiting && \(\s*<span[\s\S]*?\{WAITING_BADGE\}\s*<\/span>\s*\)\}/);
  assert.match(
    result,
    /const view = summary && change \? blockView\(summary, change\.pending\) : null;\s*const waiting = view\?\.waiting \?\? false;/
  );
  // 화면 상태(EvaluateClient)·후보 표(EvalBody)도 흐림으로 상태를 알리지 않는다
  assert.equal([...read(...CLIENT).matchAll(/opacity/gi)].length, 0);
  assert.doesNotMatch(functionBody(read(...BODY), "HanjaCandidatesTable"), /opacity/i);
});

test("결과 화면 — hanjaSummary 가 없는 응답은 블록·'이 글자로' 없이 예전 화면 그대로", () => {
  const result = code(read(...RESULT));
  assert.match(result, /const summary = data\.hanjaSummary \?\? null;\s*const change = summary && recalc \? recalc : null;/);
  assert.match(result, /\{summary && change && \(\s*<section[^>]*>\s*<HanjaSummaryBlock/);
  assert.match(
    result,
    /onPick=\{\s*change \? \(index, fact\) => change\.onChange\("name", index, \{ kind: "hanja", fact \}\) : undefined\s*\}/
  );
  assert.match(result, /subtitle=\{\s*change\s*\? CANDIDATES_SUBTITLE\s*: "음절마다 쓸 수 있는 한자와/);
  // 조화 패널: 획수 고지 + 대체값 경고의 문구 가르기
  assert.match(result, /\{HARMONY_STROKE_NOTICE\}\{" "\}\s*<Link href="\/method"/);
  assert.match(result, /\{fallbackWarning\(summary\)\}/);
  // 화면 상태도 hanjaSummary 가 없으면 한자를 바꾸지 않는다
  assert.match(code(read(...CLIENT)), /if \(!shown\?\.data\.hanjaSummary\) return;/);
  // 입력 화면의 '평가 후 어떤 결과를 받나요?' 셋째 줄 — 다시 계산이 생긴 뒤에 적는 말(설계 §9-2)
  assert.match(read(...INPUT), /label="한자 후보 분석"\s*detail="뜻·자원오행·획수 — 직접 골라 다시 계산할 수 있어요"/);
});

test("저장·공유 — 저장 키와 저장분에 고른 한자, 공유 링크는 화면에 보인 글자를 모두(shareHanja)", () => {
  const result = code(read(...RESULT));
  assert.match(
    result,
    /const hanja = input\.hanja \|\| undefined;\s*const lastHanja = input\.lastHanja \|\| undefined;\s*const fav = useIsFavorite\(data\.fullName, birthDate, hanja, lastHanja\);/
  );
  assert.match(result, /tone: input\.tone,\s*hanja,\s*lastHanja,\s*finalScore: data\.finalScore,/);
  assert.match(
    result,
    /const shared = \{ \.\.\.input, \.\.\.shareHanja\(data\.hanjaSummary, input\) \};\s*const url = `\$\{window\.location\.origin\}\$\{evaluateHref\(shared, \{ withBirth: false \}\)\}`;/
  );
  // /favorites — 조합마다 한자 한 줄, '다시 보기'·'제거'는 그 조합의 것
  const favorites = code(read(...FAVORITES));
  assert.match(favorites, /favoriteHanjaLabel\(\{ lastName, name, hanja: f\.hanja, lastHanja: f\.lastHanja \}\)/);
  assert.match(favorites, /<SavedHanja f=\{f\} \/>/);
  assert.match(favorites, /removeFavorite\(f\.fullName, f\.birthDate, f\.hanja, f\.lastHanja\)/);
  assert.match(favorites, /if \(f\.hanja\) params\.set\("hanja", f\.hanja\);\s*if \(f\.lastHanja\) params\.set\("lastHanja", f\.lastHanja\);/);
});

test("후보 표 — 줄 끝의 버튼 하나('이 글자로'), 지금 계산에 쓴 글자 줄은 글. 줄 전체는 버튼이 아니다", () => {
  const body = read(...BODY);
  const table = functionBody(body, "HanjaCandidatesTable");
  assert.equal([...table.matchAll(/<button\b/g)].length, 1);
  assert.match(table, /aria-label=\{`‘\$\{g\.syllable\}’ 음절을 \$\{c\.character\} 글자로 바꾸기`\}/);
  assert.match(table, /\{confirmedChars\?\.\[gi\] === c\.character \? "지금 한자" : "다시 계산 중"\}/);
  assert.match(table, /\) : c\.fact \? \(/, "글자 사실(fact)이 없는 줄(옛 백엔드)에는 버튼을 두지 않는다");
  assert.match(table, /onPick\(gi, fact\);/);
  // 버튼이 글로 바뀌면 포커스를 그 글로 옮긴다(문서 맨 위로 떨어지지 않게)
  assert.match(table, /tabIndex=\{-1\}/);
  assert.match(table, /document\.getElementById\(focusMark\.id\)\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(body, /const pickButtonStyle: CSSProperties = \{[^}]*minHeight: 44,/);
  // onPick 을 주지 않으면 예전 줄 그대로(등급 배지만)
  assert.match(table, /\{onPick \? \(/);
  assert.equal([...table.matchAll(/<ResourceGradeBadge\b/g)].length, 2, "버튼이 있는 꼴·없는 꼴에 배지 하나씩");
});

test("화면 상태 — 제자리 재계산: 결과를 지우지 않고, 빠른 변경은 한 번으로 묶고, 본 조합은 서버를 부르지 않는다", () => {
  const raw = read(...CLIENT);
  const client = code(raw);
  assert.match(client, /const RECALC_DEBOUNCE_MS = 400;/);
  assert.match(client, /const DONE_NOTICE_MS = 4_000;/);
  // 평가 요청은 한 자리 — 첫 평가만 결과를 지우고 맨 위로 올린다
  assert.equal([...client.matchAll(/\bevaluate\(\{/g)].length, 1);
  assert.match(client, /if \(!attempt\) \{\s*setShown\(null\);\s*setPending\(null\);\s*setRecalcError\(null\);\s*announce\(null\);\s*\}/);
  assert.match(client, /if \(mode === "first"\) \{\s*announce\(null\);\s*window\.scrollTo\(\{ top: 0 \}\);\s*\} else \{/);
  assert.equal([...client.matchAll(/setShown\(null\)/g)].length, 3, "첫 평가·빈 폼으로 돌아감·다른 이름 평가하기 — 재계산은 결과를 지우지 않는다");
  // 칸을 바꾸면: 기다리는 조합 위에 얹고(두 칸이 함께 간다), 0.4초 뒤 한 번
  const change = functionBody(raw, "changeHanja");
  assert.match(change, /const base = pending \?\? \{ input: shown\.input, changes: null \};/);
  assert.match(change, /input: nextHanjaInput\(base\.input, target, index, choice\),\s*changes: mergePending\(base\.changes, target, index, choice\),/);
  assert.match(change, /RECALC_DEBOUNCE_MS/);
  const start = functionBody(raw, "startRecalc");
  assert.match(start, /clearDebounce\(\);\s*reqIdRef\.current\+\+;/, "타이머를 다시 걸고 진행 중인 응답은 버린다");
  assert.match(start, /if \(sig === inputSignature\(shown\.input\)\) \{\s*setPending\(null\);\s*return;\s*\}/);
  assert.match(start, /const cached = cacheRef\.current\.get\(aliasRef\.current\.get\(sig\) \?\? sig\);\s*if \(cached\) \{\s*show\(cached, "recalc"\);\s*return;\s*\}/);
  assert.match(start, /setPending\(next\);\s*debounceRef\.current = setTimeout\(\(\) => \{\s*debounceRef\.current = null;\s*void run\(next\.input, next\);\s*\}, delay\);/);
  // 본 조합으로 돌아가기 — 받아 둔 응답을 다시 보여 줄 뿐
  const select = functionBody(raw, "selectSeen");
  assert.doesNotMatch(select, /\brun\(|\bevaluate\(|setTimeout/);
  assert.match(select, /show\(entry\.value, "seen"\);/);
});

test("화면 상태 — 주소·서명·저장은 응답의 정규 꼴로, 재계산의 실패는 하단 띠가 아니라 그 칸 아래로", () => {
  const client = code(read(...CLIENT));
  assert.match(
    client,
    /const canonical = hanjaFromSummary\(data\.hanjaSummary\);\s*const entry: Shown = \{ data, input: canonical \? \{ \.\.\.input, \.\.\.canonical \} : input \};/
  );
  assert.match(client, /cachePut\(cacheRef\.current, sig, entry\);/);
  assert.match(client, /urlSigRef\.current = sig;\s*replaceUrl\(evaluateHref\(entry\.input, \{ withBirth: true \}\)\);/);
  assert.match(client, /setSeen\(\(prev\) => pushSeen\(prev, \{ sig, base: baseSignature\(entry\.input\), value: entry \}\)\);/);
  // 실패 가지: pending 을 지워 블록을 되돌리고 그 칸의 안내를 세운 뒤 끝낸다 — 하단 띠·폼 오류·주소·캐시·본 조합 목록을 건드리지 않는다
  const failure = /if \(attempt\) \{([\s\S]*?)\n {8}\}\n {8}if \(err instanceof ApiError && err\.status === 400 && err\.target\) \{/.exec(client);
  assert.ok(failure, "재계산 실패 가지를 찾지 못했다");
  assert.match(failure[1], /setPending\(null\);\s*setRecalcError\(\{[\s\S]*?retry: attempt,\s*\}\);\s*return;\s*$/);
  for (const re of [/setError\(/, /setFieldError\(/, /replaceUrl\(/, /cachePut\(/, /setSeen\(/, /setShown\(/, /urlSigRef/]) {
    assert.doesNotMatch(failure[1], re, `실패 가지에 ${re}`);
  }
  assert.match(failure[1], /open: pointed !== null,/);
  // 완료·진행 알림 — 알림 영역은 늘 문서에 있고(조건부로 끼우지 않는다) 안의 글만 바뀐다
  assert.equal([...client.matchAll(/role="status"/g)].length, 1);
  assert.match(client, /<div\s+role="status"\s+aria-live="polite"/);
  assert.doesNotMatch(client, /&& \(\s*<div\s+role="status"/);
  assert.match(client, /\{stripText && \(/);
  assert.match(
    client,
    /const stripText = error\s*\? error\s*: slow\s*\? "서버를 깨우는 중이에요\. 길게는 1분 가까이 걸릴 수 있어요\."\s*: pending\s*\? RECALC_PROGRESS\s*: loading\s*\? "평가 중\.\.\."\s*: notice;/
  );
  assert.match(client, /announce\(mode === "recalc" \? recalcDoneNotice\(entry\.data\) : seenShownNotice\(entry\.data\)\);/);
  // 다른 이름으로 넘어가면 재계산 상태와 본 조합 목록을 걷는다. 이름 한자는 이름과 함께 비운다
  assert.equal([...client.matchAll(/dropRecalc\(\);\s*setSeen\(\[\]\);/g)].length, 2);
  assert.match(client, /setSeed\(last \? \{ \.\.\.seedFromInput\(last\), firstName: "", hanja: "" \} : undefined\);/);
});

test("칸 줄의 세로 배치 — 내용(detail)을 주면 줄 = 칸 버튼 + 내용, 칸 아래의 짧은 꼬리는 그리지 않는다", () => {
  const slots = read(...SLOTS);
  assert.match(slots, /\{face\.tail && !detail && \(/);
  assert.match(slots, /\{renderSlot\(slot\)\}\s*<div style=\{stackDetail\}>\{detail\(slot\)\}<\/div>/);
  assert.match(slots, /const chip = i > 0 \? between\?\.\(all\[i - 1\], slot\) : null;/);
  // 입력 폼은 내용을 주지 않는다 — 가로 한 줄 그대로
  assert.doesNotMatch(read(...INPUT), /\bdetail=\{/);
});

test("패널의 오행 거르기 칩 — 생년월일 결과가 있으면 용신·희신·기신 글(이름 패널에만)", () => {
  const panel = read(...PANEL);
  assert.match(
    functionBody(panel, "fitRoleOf"),
    /if \(element === fit\.yongshin\) return "용신";\s*if \(element === fit\.heeshin\) return "희신";\s*if \(element === fit\.gishin\) return "기신";/
  );
  assert.match(functionBody(panel, "NamePanel"), /fitRole=\{fitRoleOf\(el, elementFit\)\}/);
  assert.ok(!functionBody(panel, "SurnamePanel").includes("elementFit"));
  assert.match(read(...BLOCK), /elementFit=\{birthDateProvided \? fit : null\}/);
  // 입력 폼(아직 평가 전)은 주지 않는다
  assert.doesNotMatch(read(...INPUT), /elementFit/);
});
