// 한자 입력 화면(/evaluate 음절별 한자 칸)의 원문 검사 — `npm test`
//
// 2026-11 설계 docs/plan-hanja-input-2026-11.md §13-3. 화면 컴포넌트는 node 로 그려 볼 수 없으므로(React·경로 별칭),
// 지켜야 하는 계약을 소스 원문으로 고정한다. 순수 로직(칸 파생·문장)은 hanja-pick.test.mjs · hanja-pick-text.test.mjs 가 값으로 본다.
//
// 지금 보는 것(C5 — 입력 화면): 칸 줄 HanjaSlots · 고르기 패널 HanjaPickerPanel · 입력 폼 EvaluateInput · EvaluateClient 의 입력 쪽.
// 뒤 단계가 이 파일에 더할 것: 결과 블록 HanjaSummaryBlock(금지 문장·흐림·조사·aria-current — C6), 설명 글 EvaluateHanjaGuide 와
// robots·메타·/name·/ohaeng 링크(C7). 그때 NEW_COMPONENTS·NEW_TEXT_FILES 에 파일을 더하면 같은 검사가 걸린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { ROOT, contrast, hexRgb, read as readRaw, token } from "./color-utils.mjs";

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

/** 이 기능이 새로 만든 화면 컴포넌트 — 흐림·역할·격자 규칙을 건다 */
const NEW_COMPONENTS = [SLOTS, PANEL];
/** 이 기능이 새로 쓰는 문장이 든 파일 — 금지 문장·고정 조사 꼴을 건다(기존 문장은 범위 밖이다 — 설계 §9) */
const NEW_TEXT_FILES = [SLOTS, PANEL, TEXT, STORE, ["src", "lib", "hanja-pick.ts"]];

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
  for (const p of [SLOTS, PANEL, INPUT, CLIENT, STORE, TEXT]) {
    const src = code(read(...p));
    for (const re of [/lib\/hanja-seo/, /lib\/name-seo/, /@\/data\//, /from "\.\/hanja-seo"/, /from "\.\/name-seo"/, /\.json"/]) {
      assert.doesNotMatch(src, re, `${name(p)}: ${re}`);
    }
  }
});

test("이름·한자·생년월일을 콘솔·브라우저 저장소·분석 이벤트에 싣지 않는다", () => {
  for (const p of [SLOTS, PANEL, STORE, TEXT]) {
    const src = code(read(...p));
    for (const re of [/console\./, /localStorage/, /sessionStorage/, /sendBeacon/, /gtag\(/, /document\.title/, /document\.cookie/]) {
      assert.doesNotMatch(src, re, `${name(p)}: ${re}`);
    }
  }
  // 폼·화면 상태 파일은 예전부터 있던 코드가 섞여 있다 — 콘솔만 본다
  for (const p of [INPUT, CLIENT]) assert.doesNotMatch(code(read(...p)), /console\./, name(p));
});

test("음절 파일을 받는 곳은 저장소 모듈 하나 — 주소는 lib/hanja-pick 의 두 함수가 만든 것뿐이다", () => {
  const store = code(read(...STORE));
  const fetches = [...store.matchAll(/\bfetch\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.deepEqual(fetches, ["HANJA_PICK_INDEX", "url"]);
  assert.match(store, /const url = syllableFile\(syllable\);\s*if \(!url\) return Promise\.resolve\(null\);/);
  // 화면 컴포넌트는 직접 fetch 하지 않는다(판정 API 는 lib/api 의 hanjaResolve)
  for (const p of [SLOTS, PANEL, INPUT, TEXT]) assert.doesNotMatch(code(read(...p)), /\bfetch\(/, name(p));
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
  for (const p of [SLOTS, PANEL, INPUT]) assert.doesNotMatch(code(read(...p)), fixedJsx, name(p));
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
  for (const p of [SLOTS, PANEL, STORE, TEXT]) assert.ok(existsSync(join(ROOT, ...p)), name(p));
});
