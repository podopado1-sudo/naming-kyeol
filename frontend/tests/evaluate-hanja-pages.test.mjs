// 한자 입력 화면(/evaluate 음절별 한자 칸)의 원문 검사 — `npm test`
//
// 2026-11 설계 docs/plan-hanja-input-2026-11.md §13-3. 화면 컴포넌트는 node 로 그려 볼 수 없으므로(React·경로 별칭),
// 지켜야 하는 계약을 소스 원문으로 고정한다. 순수 로직(칸 파생·문장)은 hanja-pick.test.mjs · hanja-pick-text.test.mjs 가 값으로 본다.
//
// 지금 보는 것
// - C5(입력 화면): 칸 줄 HanjaSlots · 고르기 패널 HanjaPickerPanel · 입력 폼 EvaluateInput · EvaluateClient 의 입력 쪽.
// - C6(결과 화면): '이 이름의 한자' 블록 HanjaSummaryBlock · 관계 칩 OhaengRelationChip · 결과 화면 EvaluateResult ·
//   후보 표 EvalBody · EvaluateClient 의 제자리 재계산 · /favorites 의 한자 줄.
// - C7 앞 절반(착지·문구·방침): 설명 글 EvaluateHanjaGuide(서버 컴포넌트) · 메타(layout.tsx) · /ohaeng 한자 예의 '맞춰 보기' ·
//   개인정보처리방침 · sitemap·robots.
// - C7 뒤 절반(진입 링크): /name 조합 카드의 공용 관계 칩·'이 한자로 평가'(rel="nofollow") · /hanja 글자 상세의 '맞춰 보기' 버튼 ·
//   독음 쪽·인덱스의 한 줄(HanjaEvaluateLine) · 그 쪽들의 제목·설명·h1 틀 고정(검색 유입 보호). 맨 아래 묶음.
//   링크가 데이터 전부에서 이름 평가로 그대로 읽히는지는 hanja-pick.test.mjs 가 값으로 본다.
// 새 화면 파일을 만들면 NEW_COMPONENTS·NEW_TEXT_FILES 에 더한다 — 같은 검사가 걸린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
// 착지·문구·방침(C7 앞 절반)
const GUIDE = ["src", "app", "evaluate", "EvaluateHanjaGuide.tsx"];
const PAGE = ["src", "app", "evaluate", "page.tsx"];
const LAYOUT = ["src", "app", "evaluate", "layout.tsx"];
const OHAENG_RESULT = [...DESIGN, "OhaengResult.tsx"];
const PRIVACY = ["src", "app", "privacy", "page.tsx"];
const SITEMAP = ["src", "app", "sitemap.ts"];
const ROBOTS = ["src", "app", "robots.ts"];
// 진입 링크(C7 뒤 절반)
const NAME_PAGE_SRC = ["src", "app", "name", "[slug]", "page.tsx"]; // ③ 묶음(검색 유입 보호)이 쓴다 — ②의 NAME_PAGE 와 따로 두어 ②만 되돌려도 이 파일이 깨지지 않게
const HANJA_SLUG = ["src", "app", "hanja", "[slug]", "page.tsx"];
const HANJA_INDEX = ["src", "app", "hanja", "page.tsx"];
const EVAL_LINE = ["src", "components", "hanja", "HanjaEvaluateLine.tsx"];

/** 이 기능이 새로 만든 화면 컴포넌트 — 흐림·역할·격자 규칙을 건다 */
const NEW_COMPONENTS = [SLOTS, PANEL, BLOCK, GUIDE, EVAL_LINE];
/** 이 기능이 새로 쓰는 문장이 든 파일 — 금지 문장·고정 조사 꼴을 건다(기존 문장은 범위 밖이다 — 설계 §9) */
const NEW_TEXT_FILES = [SLOTS, PANEL, TEXT, STORE, ["src", "lib", "hanja-pick.ts"], BLOCK, CHIP, SUMMARY_TEXT, RECALC, GUIDE, EVAL_LINE];

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
  for (const p of [SLOTS, PANEL, STORE, TEXT, BLOCK, CHIP, SUMMARY_TEXT, RECALC, GUIDE]) {
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
  for (const p of [SLOTS, PANEL, INPUT, TEXT, BLOCK, CHIP, BODY, SUMMARY_TEXT, RECALC, GUIDE]) assert.doesNotMatch(code(read(...p)), /\bfetch\(/, name(p));
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
  // 확인을 기다리는 칸('확인 중' — 주소로 온 한자·들고 온 글자)은 그 글자를 싣는다 — 서버가 다시 검사한다(값은 hanja-pick.test.mjs submitMarks, 검증 지적 2026-11-23)
  assert.match(input, /hanja: submitMarks\(now\.name, waitingSeeds, pick\)\.join\(""\),\s*lastHanja: submitMarks\(now\.surname, waitingSeeds, pick\)\.join\(""\),/);
  assert.match(
    input,
    /const waitingSeeds = new Map\(\s*seeded\.pending\s*\.filter\(\(item\) => !store\.failed\.has\(item\.syllable\) && !userChoices\.has\(item\.key\)\)\s*\.map\(\(item\) => \[item\.key, item\.character\] as const\)\s*\);\s*const waitingKeys = new Set\(waitingSeeds\.keys\(\)\);/
  );
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
  for (const p of [SLOTS, PANEL, INPUT, BLOCK, BODY, RESULT, GUIDE, OHAENG_RESULT]) assert.doesNotMatch(code(read(...p)), fixedJsx, name(p));
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
  // 포커스는 화면을 움직이지 않는다 — 열린 패널을 화면 안으로 끌어온다(검증 지적 2026-11-23). 패널은 음절 파일을 받으며 자라므로
  // 열린 순간의 높이가 아니라 다 자란 높이(CSS max-height)로 맞추고, 위로는 사이트 머리(88px) 밑까지만
  assert.match(panel, /target\?\.focus\(\{ preventScroll: true \}\);\s*if \(panelRef\.current\) bringIntoView\(panelRef\.current\);/);
  assert.match(panel, /<div\s+ref=\{panelRef\}\s+id=\{id\}\s+role="region"/);
  const bring = functionBody(panel, "bringIntoView");
  assert.match(bring, /const max = Number\.parseFloat\(getComputedStyle\(el\)\.maxHeight\);/);
  assert.match(bring, /if \(below > 0\) window\.scrollBy\(\{ top: Math\.min\(below, Math\.max\(above, 0\)\) \}\);\s*else if \(above < 0\) window\.scrollBy\(\{ top: above \}\);/);
  assert.match(panel, /const VIEW_MARGIN_TOP = 88;/);
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
  assert.match(direct, /<p role="status" style=\{hintText\}>\s*\{hangulOnlyHelp\(slot\.syllable, \{ pc, listAbove: !!list && list\.length > 0 \}\)\}/);
  // 판정이 늦을 때의 문장 — 목록을 받기 전인지(known)·성씨에 기본 한자가 있는지(hasDefault)로 갈린다(값은 hanja-pick-text.test.mjs)
  assert.match(direct, /judgeTimeoutNote\(slot\.target, \{ known: judge\.known, hasDefault \}\)/);
  assert.match(functionBody(panel, "SurnamePanel"), /hasDefault=\{!!representative\}/);
  assert.doesNotMatch(direct, /placeholder=/, "직접 입력의 이름을 placeholder 로 대신하지 않는다");
  // 조합 중에는 판정하지 않는다
  assert.match(direct, /if \(composing \|\| \(e\.nativeEvent as InputEvent\)\.isComposing\) \{\s*setValue\(next\);\s*return;/);
  const namePanel = functionBody(panel, "NamePanel");
  assert.match(namePanel, /<label htmlFor=\{searchId\} style=\{fieldLabel\}>\s*뜻·글자로 찾기/);
  // 찾은 글자 수 — 알림 영역은 늘 두고 안의 글만 바꾼다(검증 지적 2026-11-23)
  assert.match(
    namePanel,
    /<p role="status" style=\{loaded && filtering \? \{ \.\.\.hintText, marginTop: 10 \} : emptyStatus\}>\s*\{loaded && filtering \? \(matches\.length > 0 \? `\$\{matches\.length\}자 찾음` : searchEmptyNote\(pc\)\) : ""\}/
  );
  assert.doesNotMatch(namePanel, /\{loaded && filtering && \(\s*<>\s*<p role="status"/);
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
  // 띠의 알림 영역(span)은 글자가 오기 전부터 늘 둔다 — 띠가 없을 때는 스타일 없이 높이 0(검증 지적 2026-11-23)
  assert.match(
    input,
    /<span role="status" style=\{pick \? \{ flex: 1, minWidth: 0, wordBreak: "keep-all" \} : undefined\}>\s*\{pick \? pickBannerText\(pick\.character, pick\.readings, settled\.firstName\) : ""\}/
  );
  assert.doesNotMatch(code(input), /\{pick && \(\s*<div[\s\S]{0,600}?role="status"/);
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
  for (const p of [SLOTS, PANEL, STORE, TEXT, BLOCK, CHIP, SUMMARY_TEXT, RECALC, GUIDE]) assert.ok(existsSync(join(ROOT, ...p)), name(p));
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
  // C7: /name 조합 카드는 이 컴포넌트를 쓴다(칩만 바꾼 커밋에서 빌드한 /name 3,865쪽 HTML 이 바꾸기 전과 같음을 대조했다).
  // 제 색 표·칩 마크업을 다시 두지 않는다 — 두 벌이 되면 한쪽만 고쳐진다
  const nameSrc = read("src", "app", "name", "[slug]", "page.tsx");
  assert.equal(old, null, "/name 이 제 OHAENG_CHIP 을 다시 갖고 있다 — 공용 칩(OhaengRelationChip)을 쓸 것");
  assert.match(nameSrc, /^import \{ OhaengRelationChip \} from "@\/components\/design\/OhaengRelationChip";$/m);
  assert.equal([...nameSrc.matchAll(/<OhaengRelationChip kind=\{rel\.kind\} label=\{rel\.label\} \/>/g)].length, 1);
  assert.doesNotMatch(code(nameSrc), /자원오행 \{rel\.label\}/);
  // 칩의 말은 /name 그대로 — 상극은 '상극(기운이 부딪침)'(ohaengRelation). /evaluate 블록의 이름 꼴(ohaengRelationName)이 아니다
  assert.match(nameSrc, /const rel = ohaengRelation\(r1\.e, r2\.e\);/);
  assert.doesNotMatch(nameSrc, /ohaengRelationName/);
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
  // 한자를 바꿀 수 있으면 CANDIDATES_SUBTITLE 의 두 문장 — '이 글자로' 안내(뒤 문장)만 인쇄에서 숨긴다(2026-11-27 인쇄 조작 요소)
  assert.match(
    result,
    /\{change \? \(\s*<SectionHeadWithHint title="한자 후보" subtitle=\{CANDIDATES_SUBTITLE_FACT\} hint=\{CANDIDATES_PICK_HINT\} \/>\s*\) : \(\s*<SectionHead\s+title="한자 후보"\s+subtitle="음절마다 쓸 수 있는 한자와/
  );
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
  // 이름은 보이는 글('이 글자로')로 시작한다 — 음성 입력으로 보이는 글을 말해도 맞는다(WCAG 2.5.3, 검증 지적 2026-11-23)
  assert.match(table, /aria-label=\{`이 글자로 — ‘\$\{g\.syllable\}’ 음절을 \$\{c\.character\} 글자로 바꾸기`\}/);
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
  // 받아 둔 응답으로 돌아가면 서버를 부르지 않았다 — '다시 계산했어요'가 아니라 '본 조합으로 돌아왔어요'(검증 지적 2026-11-23)
  assert.match(start, /const cached = cacheRef\.current\.get\(aliasRef\.current\.get\(sig\) \?\? sig\);\s*if \(cached\) \{\s*show\(cached, "seen"\);\s*return;\s*\}/);
  // '다시 계산했어요'(recalc)는 서버 응답을 받은 자리 하나에서만
  assert.equal([...client.matchAll(/"recalc"/g)].length, 3, "show 의 모드 타입 · announce 의 갈래 · run 의 응답");
  assert.match(client, /show\(entry, attempt \? "recalc" : "first"\);/);
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

// ─── 검증 지적 반영(2026-11-23 — 설계 §27) ─────────────────────

test("포커스가 body 로 떨어지지 않게 — '더 보기' · #pick 띠의 [닫기] · 후보 표의 재계산 실패(설계 §8-8)", () => {
  const panel = read(...PANEL);
  const namePanel = functionBody(panel, "NamePanel");
  // '더 보기'는 누르면 사라진다 — 새로 보인 첫 글자(그 밖의 글자 13번째)로
  assert.match(namePanel, /onClick=\{\(\) => \{\s*focusMoreRef\.current = true;\s*setShowAll\(true\);\s*\}\}/);
  assert.match(
    namePanel,
    /const first = othersRef\.current\?\.querySelectorAll\("button"\)\[FIRST_OTHERS\];\s*first\?\.focus\(\{ preventScroll: true \}\);\s*first\?\.scrollIntoView\(\{ block: "nearest" \}\);/
  );
  assert.match(namePanel, /<ul\s+ref=\{othersRef\}/);
  // #pick 띠의 [닫기] — 띠째 사라진다. 이름 칸으로
  const input = read(...INPUT);
  assert.match(functionBody(input, "dismissPick"), /document\.getElementById\(firstNameId\)\?\.focus\(\{ preventScroll: true \}\);\s*onPickDismiss\?\.\(\);/);
  assert.match(input, /<Input\s+id=\{firstNameId\}\s+value=\{firstName\}/);
  // 후보 표 — 실패하면 누른 줄의 버튼으로(포커스가 다른 곳 — 서버가 짚은 칸의 패널 등 — 에 있으면 그대로), 표에도 실패 한 줄.
  // 같은 문장의 alert 는 블록에 하나 — 표의 줄은 글이고 누른 버튼이 aria-describedby 로 잇는다
  const table = functionBody(read(...BODY), "HanjaCandidatesTable");
  assert.match(
    table,
    /if \(active && active !== document\.body\) return;\s*document\.getElementById\(`\$\{markBase\}-pick-\$\{origin\.gi\}-\$\{origin\.i\}`\)\?\.focus\(\{ preventScroll: true \}\);/
  );
  assert.match(table, /if \(failureId === undefined \|\| !origin \|\| handledFailureRef\.current === failureId\) return;/);
  assert.match(table, /id=\{`\$\{markBase\}-pick-\$\{gi\}-\$\{i\}`\}/);
  assert.match(table, /<p id=\{failureLineId\(gi\)\} style=\{failureLineStyle\}>\s*\{failure\.text\}/);
  assert.match(table, /aria-describedby=\{\s*showsFailure\(gi\) && origin\?\.i === i \? failureLineId\(gi\) : undefined\s*\}/);
  assert.doesNotMatch(code(table), /role="alert"/);
  assert.match(read(...BODY), /const failureLineStyle: CSSProperties = \{[^}]*color: "var\(--color-amber-warm-700\)",/);
  const result = read(...RESULT);
  assert.match(result, /failure=\{tableFailure\}/);
  assert.match(code(result), /const failedName = change\?\.error && change\.error\.target === "name" \? change\.error : null;/);
  assert.match(code(result), /\} \$\{failedName\.message\}`,/);
});

test("알림 영역(role=status)은 늘 문서에 두고 글만 바꾼다 — 나눠 넣은 결과(#pick 띠·찾은 글자 수는 위 테스트)", () => {
  const input = code(read(...INPUT));
  assert.doesNotMatch(input, /\{paste\?\.status && \(/);
  assert.match(input, /<p role="status" style=\{paste\?\.status \? slotNoteStyle : emptyStatusStyle\}>\s*\{paste\?\.status \?\? ""\}/);
  assert.match(input, /const emptyStatusStyle: CSSProperties = \{ margin: 0 \};/);
  assert.match(code(read(...PANEL)), /const emptyStatus: CSSProperties = \{ margin: 0 \};/);
});

test("패널 — 목록을 받는 동안에도 찾기·거르기 자리를 둔다(Tab 이 바닥의 '작명 원리' 링크로 건너뛰지 않게), 칸에 든 글자는 '지금 한자'", () => {
  const panel = read(...PANEL);
  const namePanel = functionBody(panel, "NamePanel");
  assert.match(namePanel, /const hasList = loaded \? list\.length > 0 && !zeroUsable : !failed && !zeroUsable;/);
  assert.match(namePanel, /sub=\{loaded && hasList \? `고를 수 있는 글자 \$\{list\.length\}자` : undefined\}/);
  // 찾기 칸·거르기 칩은 hasList 하나로 그린다(받는 동안 참) — 받는 동안 건 조건은 목록이 오면 그대로 걸린다
  assert.equal([...namePanel.matchAll(/\{hasList && \(/g)].length, 2);
  // 칸에 지금 든 글자 — 결과 화면의 자동 칸·링크로 넣은 글자는 고른 글자가 아니다. 후보 표(EvalBody)와 같은 말
  assert.match(functionBody(panel, "CandidateRow"), /\{current && <span style=\{\{ color: "var\(--color-teal-800\)", fontWeight: 600 \}\}>지금 한자<\/span>\}/);
  assert.doesNotMatch(code(panel), /지금 고른 글자/);
});

test("결과 블록 — 태어난 시각의 계산 기준(서울 기준 보정·출생지 받지 않음)은 접힌 '칩과 꼬리표 읽는 법' 밖, 용신 한 줄 아래", () => {
  const block = functionBody(read(...BLOCK), "HanjaSummaryBlock");
  const details = block.indexOf("<details");
  const at = block.indexOf("birthTimeNotice(hasBirthTime)");
  assert.ok(details > 0 && at > 0 && at < details, "birthTimeNotice 가 <details> 앞에 있어야 한다");
  assert.equal([...block.matchAll(/birthTimeNotice\(/g)].length, 1);
  assert.ok(block.indexOf("{yongshin && <p") < at);
  assert.match(block, /\{birthDateProvided && \(\s*<p style=\{\{ \.\.\.guideText, marginTop: yongshin \? 8 : 0 \}\}>\{birthTimeNotice\(hasBirthTime\)\}<\/p>\s*\)\}/);
});

test("/ohaeng 한자 예 — '자주 쓰는 한자'라고 쓰지 않는다(그 집합은 이름 평가 패널이 '사용 통계는 아닙니다'라고 하는 빈출 목록)", () => {
  for (const p of [OHAENG_RESULT, ["src", "app", "ohaeng", "OhaengGuide.tsx"]]) {
    const src = flat(read(...p));
    assert.doesNotMatch(src, /자주 쓰는/, name(p));
    assert.ok(src.includes("이 사이트가 이름 글자로 꼽아 둔 한자(사용 통계는 아닙니다) 가운데"), name(p));
  }
  assert.match(
    readFileSync(join(ROOT, "..", "Application", "Engines", "Utils", "ElementHanjaPicker.cs"), "utf8"),
    /=> HanjaData\.IsCommonNameHanja\(h\.Character\)/
  );
  assert.match(read(...PANEL), /이 사이트가 이름 글자로 꼽아 둔 글자예요 — 사용 통계는 아닙니다\./);
});

test("문구 — '자동 배정' 대신 화면의 말('자동으로 고르는 한자'), 설명 글도 같은 말", () => {
  for (const p of [TEXT, SUMMARY_TEXT, GUIDE]) assert.doesNotMatch(code(read(...p)), /자동 배정/, name(p));
  assert.ok(flat(read(...GUIDE)).includes("이 사이트가 이름 추천과 자동으로 고르는 한자에서 빼기로 정한 {num(facts.forbidden)}자예요"));
});

// ═════════════════════════════════════════════════════════════
// 착지·문구·방침(C7 앞 절반) — 메타 · 설명 글 · /ohaeng 링크 · 개인정보처리방침 · sitemap·robots
// ═════════════════════════════════════════════════════════════

/** 줄바꿈·들여쓰기를 빈칸 하나로 — JSX 본문의 문장을 줄 나눔과 무관하게 견준다 */
const flat = (src) => src.replace(/\s+/g, " ");
const cp = (n) => String.fromCodePoint(n);
/** 음절 후보 파일(커밋된 정적 파일)에서 그 글자가 실린 음절들 */
function syllablesOf(character) {
  const dir = join(ROOT, "public", "data", "hanja-pick", "v1");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .filter((file) => file.hanja.some((h) => h.character === character))
    .map((file) => file.syllable)
    .sort();
}
const pickIndex = () => JSON.parse(readFileSync(join(ROOT, "public", "data", "hanja-pick", "v1", "index.json"), "utf8"));

test("메타 — 제목 앞머리 '이름 평가'는 그대로, 뒤에 '아기 이름 한자 정하기'(U9 (가)). 화면이 하지 않는 일(추천·짓는 법)을 약속하지 않는다", () => {
  const layout = read(...LAYOUT);
  const meta = /export const metadata: Metadata = \{([\s\S]*?)\n\};/.exec(layout);
  assert.ok(meta, "layout.tsx 의 metadata 를 찾지 못했다");
  assert.match(meta[1], /^\s*title: "이름 평가 · 아기 이름 한자 정하기",$/m);
  assert.match(meta[1], /description:\s*"아기 이름 한자 정하기 — 정한 한글 이름의 음절마다 인명용 한자를 선택해 뜻·자원오행·획수를 비교하고,/);
  assert.match(meta[1], /alternates: \{ canonical: "\/evaluate" \},/);
  // openGraph 는 얕은 병합 — 루트 값(이미지·siteName·locale)을 펼친 뒤 덮는다(CLAUDE.md)
  assert.match(meta[1], /openGraph: \{\s*\.\.\.BASE_OPEN_GRAPH,\s*title: "이름 평가 · 아기 이름 한자 정하기 — 이름의 결",/);
  assert.match(meta[1], /url: "\/evaluate",/);
  for (const re of [/추천/, /짓는/, /고르기/, /풀이/]) assert.doesNotMatch(meta[1], re, `메타에 ${re}`);
  // h1 은 그대로다(검색 유입 보호) — 소개 문장만 한 줄 더했다
  assert.match(read(...INPUT), /<h1\b[\s\S]*?마음에 둔 이름,\s*<br \/>\s*어떤 결인지 알려드릴게요\s*<\/h1>/);
  assert.equal([...read(...INPUT).matchAll(/<h1\b/g)].length, 1);
});

test("설명 글은 서버 컴포넌트 — page.tsx 가 그려 EvaluateClient 에 prop 으로 넘긴다(클라이언트가 import 하지 않는다)", () => {
  const guide = read(...GUIDE);
  assert.doesNotMatch(guide, /^\s*["']use client["']/m);
  assert.match(guide, /<section aria-labelledby="hanja-guide" style=\{section\}>\s*<h2 id="hanja-guide" style=\{title\}>\s*아기 이름 한자 정하기 — 음절마다 인명용 한자 선택·비교\s*<\/h2>/);
  assert.equal([...guide.matchAll(/<h2\b/g)].length, 1);
  assert.doesNotMatch(code(guide), /<h1\b/);
  // 서버 쪽: page.tsx 는 서버 컴포넌트이고 설명 글을 그려서 넘긴다
  const page = read(...PAGE);
  assert.doesNotMatch(page, /^\s*["']use client["']/m);
  assert.match(page, /import \{ EvaluateHanjaGuide \} from "\.\/EvaluateHanjaGuide";/);
  assert.match(page, /<EvaluateClient guide=\{<EvaluateHanjaGuide \/>\} \/>/);
  // 클라이언트 쪽: 받은 것을 입력 화면 맨 아래(점수 설명 뒤)에 둘 뿐이다 — 그 파일을 import 하지 않는다(서버에서 파일을 읽는 모듈이다)
  const client = code(read(...CLIENT));
  assert.match(client, /export function EvaluateClient\(\{ guide \}: \{ guide\?: ReactNode \}\) \{/);
  assert.match(client, /<EvaluateAbout \/>\s*\{guide\}\s*<\/main>/);
  assert.equal([...client.matchAll(/\{guide\}/g)].length, 1, "설명 글은 입력 화면에만 — 결과 화면에는 그리지 않는다");
  for (const p of [SLOTS, PANEL, INPUT, CLIENT, BLOCK, CHIP, BODY, RESULT, FAVORITES, OHAENG_RESULT]) {
    const src = code(read(...p));
    assert.doesNotMatch(src, /EvaluateHanjaGuide/, name(p));
    assert.doesNotMatch(src, /public\/data\//, name(p));
  }
  // 소개 문장의 안쪽 링크가 설명 글 제목으로 내려간다(id 는 한 곳)
  assert.match(read(...INPUT), /<a\s+href="#hanja-guide"[\s\S]*?>\s*한자 고르는 법\s*<\/a>/);
  assert.equal([...guide.matchAll(/id="hanja-guide"/g)].length, 1);
  assert.match(guide, /scrollMarginTop: 88,/);
  // #hanja-guide 는 들고 온 글자 해시가 아니다 — 화면 상태가 지우거나 읽지 않는다(값 검사는 hanja-pick.test.mjs parsePickHash)
  assert.match(read("src", "lib", "hanja-pick.ts"), /if \(!body\.startsWith\("pick="\)\) return null;/);
});

test("설명 글의 숫자는 index.json 에서 읽는다 — 글에 숫자를 손으로 적지 않는다", () => {
  const guide = code(read(...GUIDE));
  // 읽는 법은 데이터 리포트(lib/insights.ts)와 같다 — 빌드 때 process.cwd() 아래의 파일을 읽는다(화면이 fetch 로 받는 것과 같은 파일)
  assert.match(guide, /const PICK_INDEX_FILE = path\.join\(process\.cwd\(\), "public", "data", "hanja-pick", "v1", "index\.json"\);/);
  assert.ok(existsSync(join(ROOT, "public", "data", "hanja-pick", "v1", "index.json")));
  assert.match(read("src", "lib", "hanja-pick.ts"), /export const HANJA_PICK_INDEX = `\$\{HANJA_PICK_BASE\}\/index\.json`;/);
  assert.match(read("src", "lib", "insights.ts"), /const DIR = path\.join\(process\.cwd\(\), "content", "insights"\);/);
  // 꼴이 다르면 빌드를 멈춘다 — 빈 값으로 문장을 내보내지 않는다
  assert.match(
    guide,
    /const index = parsePickIndex\(JSON\.parse\(fs\.readFileSync\(PICK_INDEX_FILE, "utf8"\)\)\);\s*if \(!index\) throw new Error\([^)]*\);\s*return guideFacts\(index\);/
  );
  assert.match(guide, /const facts = readGuideFacts\(\);/);
  const body = flat(guide);
  assert.ok(body.includes('인명용 한자{" "} {num(facts.characters)}자가 {num(facts.syllables)}개 음절에 실려 있어요'));
  assert.ok(body.includes("많게는 {num(facts.widest.count)}자(‘{facts.widest.syllable}’)예요"));
  assert.ok(body.includes("빼기로 정한 {num(facts.forbidden)}자예요"));
  assert.ok(body.includes("‘먼저 보여 드리는 글자’({num(facts.common)}자)는"));
  // 지금 색인의 값이 글자로 박혀 있지 않다(쉼표 꼴 포함) — 한자 데이터를 바꿔 다시 덤프하면 글이 따라가야 한다
  const index = pickIndex();
  const widest = Math.max(...Object.values(index.syllables).map((s) => s.all));
  for (const n of [index.counts.characters, index.counts.syllables, index.counts.pairs, index.counts.forbidden, index.counts.common, widest]) {
    for (const text of new Set([String(n), n.toLocaleString("ko-KR")])) {
      assert.doesNotMatch(guide, new RegExp(`(?<![\\d.,])${text}(?![\\d,])`), `설명 글에 숫자 ${text} 가 적혀 있다`);
    }
  }
  // 덤프 값의 뜻(글자 수·음절 수·가장 많은 음절)은 hanja-pick-text.test.mjs 가 음절 파일을 직접 세어 견준다
});

test("설명 글의 사실 — 예로 든 글자의 독음은 음절 파일과 같고, 배점은 같은 화면의 점수 설명과 같다", () => {
  const guide = flat(read(...GUIDE));
  // 예로 든 세 글자(오얏 리 · 연꽃 련 · 아름다울 나) — 코드포인트로 적어 음절 파일과 대조한다. 셋째 글자는 '나'뿐이라 '라' 칸에 못 넣는다
  const [li, ryeon, na] = [cp(0x674e), cp(0x84ee), cp(0x5a1c)];
  assert.deepEqual(syllablesOf(li), ["리", "이"]);
  assert.deepEqual(syllablesOf(ryeon), ["련", "연"]);
  assert.deepEqual(syllablesOf(na), ["나"]);
  assert.ok(
    guide.includes(
      `<span style={hanja}>${li}</span>는 ‘리’와 ‘이’ 칸에, <span style={hanja}>${ryeon}</span>은 ‘련’과 ‘연’ 칸에 모두 넣을 수 있어요. 이름 글자에서는 첫 글자인지 뒤 글자인지를 가리지 않는다는 것이 법원행정처 선례(가족관계등록선례 제200909-2호)입니다. 지정된 발음이 ‘나’뿐인 <span style={hanja}>${na}</span>는 ‘라’ 칸에 넣을 수 없습니다.`
    ),
    "두음 문단의 예가 바뀌었다 — 음절 파일로 다시 확인할 것"
  );
  // 글의 한자는 이 셋뿐이다(다른 글자를 예로 더하면 위 대조에 넣을 것)
  const hanjaInText = [...code(read(...GUIDE)).matchAll(new RegExp(`[${cp(0x3400)}-${cp(0x9fff)}]`, "g"))].map((m) => m[0]).sort();
  assert.deepEqual(hanjaInText, [li, ryeon, na].sort());
  // ‘봄’·‘빛’ 은 후보 파일이 없는 음절(칸이 잠긴다)
  const index = pickIndex();
  for (const syllable of ["봄", "빛"]) assert.ok(!(syllable in index.syllables), `${syllable} 음절에 후보 파일이 있다`);
  assert.ok(guide.includes("‘봄’·‘빛’처럼 인명용 한자 독음이 아닌 음절은 칸이 잠겨 있어 한글로만 둡니다."));
  // 배점 — 같은 화면의 '점수는 이렇게 매겨요'(EvaluateAbout)와 같은 수
  const about = flat(read(...INPUT));
  assert.ok(about.includes("자원오행 보완 30·획수 조화 20·음양 10·발음오행 25·전통 81수리 15점이에요."));
  assert.ok(about.includes("종합 점수는 미학 70%와 조화 30%를 더한 값이고"));
  assert.ok(guide.includes("자원오행 보완(30)·획수 조화(20)·음양(10)·전통 81수리(15)를 그 한자로 다시 계산합니다."));
  assert.ok(guide.includes("발음오행(25)과 미학 점수의 발음·리듬·음절·세대 중립·의미 항목은 한글 이름으로 매기므로 한자를 바꿔도 같아요"));
  // 종합 점수·성씨 한자 문장은 출생일 조건을 단다 — 출생일이 없으면 조화를 계산하지 않아 종합 = 미학(ScoringService), 성씨 한자를 바꿔도 점수는 그대로
  // (성별 보너스는 이름 글자만 본다 — 검증 지적 2026-11-23. 바로 위 EvaluateAbout 의 문장과 같은 조건)
  assert.ok(guide.includes("종합 점수는 출생일을 넣으면 미학 70%와 조화 30%를 더한 값이고, 출생일이 없으면 미학 점수가 곧 종합 점수예요."));
  assert.ok(guide.includes("출생일을 넣었다면 성씨 한자를 바꿀 때 점수 가운데서는 전통 81수리만 달라집니다."));
  assert.doesNotMatch(guide, /종합 점수는 미학 70%와 조화 30%를 더한 값이에요/);
  assert.doesNotMatch(guide, /성씨 한자를 바꾸면 전통 81수리만/);
  const scoring = readFileSync(join(ROOT, "..", "Application", "Services", "ScoringService.cs"), "utf8");
  assert.match(scoring, /\? \(int\)Math\.Round\(aesthetic\.TotalScore \* 0\.7 \+ harmony\.TotalScore \* 0\.3\)/);
  assert.match(scoring, /출생일이 없으면 조화를 빼고 미학 점수만/);
  // 조화의 성별 보정은 글자마다 +5/−3 — 백엔드 산식의 두 줄
  assert.ok(guide.includes(`조화의 성별 보정(글자마다 +5/${cp(0x2212)}3)`));
  const harmony = readFileSync(join(ROOT, "..", "Application", "Engines", "HarmonyEngine.cs"), "utf8");
  const bonus = /int CalculateGenderBonus\([\s\S]*?\n {4}\}/.exec(harmony);
  assert.ok(bonus, "HarmonyEngine.CalculateGenderBonus 를 찾지 못했다");
  assert.deepEqual([...bonus[0].matchAll(/bonus ([+-])= (\d+);/g)].map((m) => `${m[1]}${m[2]}`).sort(), ["+5", "-3"]);
  // 관계 칩·꼬리표의 낱말은 화면이 쓰는 말 그대로
  assert.ok(guide.includes("글자 사이의 자원오행 관계(상생·비화·상극)는 점수인가요?"));
  const relation = read("src", "lib", "ohaeng-relation.ts");
  for (const word of ["· 상생", "· 비화(같은 기운)", "· 상극"]) assert.ok(relation.includes(word), word);
});

test("설명 글 — 법규 사실은 확인한 대로만(설계 §20): 혼용 이름은 현행 예규, 사전에 없는 글자는 단정하지 않고, 대법원 조회는 이름만", () => {
  const raw = read(...GUIDE);
  const guide = flat(code(raw));
  // 혼용 — 입력·결과 화면의 고지(MIXED_SCRIPT_NOTICE)와 같은 예규·같은 결론
  assert.ok(
    guide.includes(
      "현행 가족관계등록예규(제638호)는 한글과 한자를 섞어 적은 출생신고도 수리할 수 있다고 정하고 있어요(2026년 11월 확인). 한자로 적는 글자는 인명용 한자여야 합니다."
    )
  );
  const notice = read(...TEXT);
  assert.match(notice, /현행 가족관계등록예규\(제638호\)는 이렇게 섞어 적은 출생신고도 수리할 수 있다고 정하고 있어요\. 한자로 적는 글자는 인명용 한자여야 합니다\./);
  // 사전에 없는 글자 — 서버의 400 문장과 같은 뜻(사전에 없음 ≠ 인명용 아님, 후보 목록에서 먼저, 대법원 조회는 한글 음 한 글자로)
  assert.ok(guide.includes("사전에 없다고 인명용 한자가 아니라는 뜻은 아닙니다."));
  assert.ok(guide.includes("대법원 전자가족관계등록시스템의 ‘인명용 한자 조회’에서 한글 음 한 글자를 넣어 확인할 수 있습니다."));
  const backend = readFileSync(join(ROOT, "..", "Application", "Engines", "Utils", "HanjaInput.cs"), "utf8");
  assert.ok(backend.includes("사전에 없다고 인명용 한자가 아니라는 뜻은 아닙니다."));
  assert.ok(backend.includes("한글 음 한 글자를 넣어 확인할 수 있습니다."));
  // 두음 — 조회 화면 안내문의 요지
  assert.ok(guide.includes("한자는 지정된 발음으로만 쓸 수 있고, 첫소리가 ㄴ·ㄹ인 한자는 소리 나는 바에 따라 ㅇ·ㄴ으로 쓸 수 있습니다."));
  // 자리(첫 글자·뒤 글자)를 가리지 않는다는 근거는 조회 화면 안내가 아니라 법원행정처 선례 — 이름 글자에 한한 말로
  // (설계 §20-2, docs/plan-hanja-input-facts-2026-11.json 의 corrected 문장. 조회 안내의 주의사항에는 자리에 관한 말이 없다 — 검증 지적 2026-11-23)
  assert.ok(guide.includes("이름 글자에서는 첫 글자인지 뒤 글자인지를 가리지 않는다는 것이 법원행정처 선례(가족관계등록선례 제200909-2호)입니다."));
  assert.doesNotMatch(guide, /그래서 [^.]*가리지 않아요/, "'그래서'로 이어 조회 안내의 말처럼 읽히게 쓰지 않는다");
  // 대법원 조회는 이름만 적는다 — 바깥 링크가 없다(그 사이트의 링크 유의사항)
  const hrefs = [...raw.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ["/ohaeng", "/method", "/about#ai"]);
  assert.doesNotMatch(code(raw), /scourt|efamily|https?:\/\//);
  assert.match(read("src", "app", "about", "page.tsx"), /id="ai"/);
  // 쓰지 않는 말 — 글자를 넣어 조회(조회 화면에는 글자 칸이 없다) · 사전이 목록 전체인 듯한 말 · 자리 제한 · 길흉을 판정하지 않는다는 단정
  for (const re of [/글자를 넣어 조회/, /인명용 한자 전(체|부)/, /모든 인명용 한자/, /첫 글자에만/, /길흉은 판정하지/, /일 때가 많/]) {
    assert.doesNotMatch(guide, re, String(re));
  }
  // 맺음 — 81수리의 길흉 분류는 사실 서술로만, AI 사용 공개로 잇는다
  assert.ok(guide.includes("전통 81수리의 길흉 분류는 조화 점수 15점에만 들어가는 참고 지표이고, 이름으로 운세를 풀이하지는 않습니다."));
  assert.ok(guide.includes("화면의 문장은 AI 도구로 썼어요("));
});

test("설명 글·'맞춰 보기'의 작은 글씨 링크는 글자 전용 짙은 청록 — 종이·흰 카드에서 4.5:1 을 넘는다", (t) => {
  const teal800 = hexRgb(token("color-teal-800-token"));
  const guide = read(...GUIDE);
  assert.match(guide, /const link: CSSProperties = \{\s*color: "var\(--color-teal-800\)",/);
  assert.doesNotMatch(code(guide), /var\(--color-teal\)/, "13.5px 링크에 밝은 청록을 쓰지 않는다");
  assert.match(guide, /const paragraph: CSSProperties = \{[^}]*fontSize: 13\.5,[^}]*color: "var\(--color-text-2\)",/);
  assert.match(read(...INPUT), /href="#hanja-guide"\s*style=\{\{\s*color: "var\(--color-teal-800\)",/);
  assert.match(read(...OHAENG_RESULT), /const pickLink: CSSProperties = \{[^}]*minHeight: 44,[^}]*fontSize: 12\.5,[^}]*color: "var\(--color-teal-800\)",/);
  for (const [label, fg, bg] of [
    ["설명 글·소개 문장의 링크 teal-800 / 종이", teal800, PAPER],
    ["설명 글 본문 text-2 / 종이", hexRgb(token("color-text-2-token")), PAPER],
    ["/ohaeng '맞춰 보기' teal-800 / 흰 카드", teal800, WHITE],
  ]) {
    const ratio = contrast(fg, bg);
    t.diagnostic(`${label}: ${ratio.toFixed(2)}:1`);
    assert.ok(ratio >= AA, `${label} ${ratio.toFixed(2)}:1`);
  }
});

test("/ohaeng 한자 예의 '맞춰 보기' — 글자와 독음만 해시에 실어 새 창으로, 이름(aria-label)에 글자", () => {
  const raw = read(...OHAENG_RESULT);
  const result = code(raw);
  assert.match(result, /import \{ evaluatePickHref \} from "@\/lib\/hanja-pick";/);
  const item = functionBody(raw, "HanjaItem");
  assert.match(
    item,
    // data-hide-print — 인쇄에서는 뺀다(2026-11-27 tests/fix1127-print.test.mjs)
    /<a\s+href=\{evaluatePickHref\(item\.character, item\.readings\)\}\s+target="_blank"\s+rel="noopener"\s+aria-label=\{`\$\{item\.character\} 한자로 이름 맞춰 보기 \(새 창\)`\}\s+style=\{pickLink\}\s+data-hide-print\s*>\s*맞춰 보기\s*<\/a>/
  );
  assert.equal([...result.matchAll(/<a\b/g)].length, 1, "풀 페이지 이동(<a>)은 이 링크 하나");
  // 넘기는 것은 응답의 글자·독음뿐 — 생년월일·시각·출생지를 싣지 않는다(이 칸은 그 값을 받지도 않는다)
  assert.match(item, /^function HanjaItem\(\{ item \}: \{ item: ElementHanjaItem \}\) \{/);
  for (const re of [/birth/i, /\bdata\./, /saju/i]) assert.doesNotMatch(item, re, `HanjaItem 에 ${re}`);
  // 안내 한 줄 — 한자 예가 있을 때만, 새 창·생년월일을 넘기지 않음을 적는다
  assert.ok(
    flat(raw).includes(
      "{data.elementHanja.some((g) => !g.isGishin && g.hanja.length > 0) && ( <p style={{ ...smallNote, marginTop: 16 }} data-hide-print> ‘맞춰 보기’는 이름 평가를 새 창으로 열어요. 생년월일은 넘기지 않으니, 이름 평가에서 다시 넣으면 이 한자가 필요한 오행을 채우는지 점수와 함께 볼 수 있어요. </p> )}"
    )
  );
  // '다음 단계'의 이름 평가 줄
  assert.ok(raw.includes('body="이름 한자의 자원오행·발음오행·수리를 무료로 분석합니다. 한자를 직접 골라 맞춰 볼 수 있어요."'));
  // 링크가 닿는 곳: 해시로만 읽는다(위 '들고 온 글자' 테스트) — 주소 모양은 값으로
  assert.match(read("src", "lib", "hanja-pick.ts"), /return `\/evaluate#\$\{pick\}&as=\$\{syllables\.map\(encodeURIComponent\)\.join\(","\)\}`;/);
});

test("개인정보처리방침 — 고른 한자·판정 요청·음절 파일 요청·광고 요청의 화면 주소(설계 §10-4·§10-5, U15 (가))", () => {
  const policy = flat(read(...PRIVACY));
  // 1항 입력값 — 고른 한자, 목록에 없는 글자의 판정 요청
  assert.ok(policy.includes("<strong>추천·평가·분석·오행 찾기 입력값</strong>: 성씨, 이름, 이름·성씨에 고른 한자, 출생일(시), 출생지(시·도), 성별, 선호 톤,"));
  assert.ok(
    policy.includes(
      "&lsquo;이름 평가&rsquo;(/evaluate)의 한자 칸에 직접 넣은 한자를 그 음절 목록에서 바로 확인하지 못하면(목록에 없는 글자이거나 목록을 아직 받지 못한 경우) 그 한자 한 글자와 칸의 음절을 계산 서버로 보내 그 칸에 넣을 수 있는 글자인지 확인하며, 이 값도 데이터베이스와 서버 로그에 남기지 않습니다."
    )
  );
  // 1항 자동 수집 — 음절 파일 요청. '이름 전체가 아니다'라고 쓰지 않는다(칸을 여러 개 열면 그만큼 남는다)
  assert.ok(
    policy.includes(
      "이름 평가에서 한자 칸을 열거나 한자를 넣으면(다른 화면의 링크로 한자가 함께 넘어온 경우 포함), 그리고 이름 추천에서 필수 글자와 항렬자 한자를 함께 넣고 추천을 받으면 그 음절의 한자 후보 목록 파일을 받으며, 그 요청 주소에 음절이 문자 코드로 들어갑니다)"
    )
  );
  // 방침이 실제 처리보다 좁지 않다(검증 지적 2026-11-23) — 직접 넣은 글자는 목록을 아직 못 받았을 때도 서버로 가고(known=false),
  // 주소·해시로 넘어온 한자는 칸을 열지 않아도 그 음절 파일을 받는다(위 '이름을 칠 때는…' 테스트의 ⓑ·ⓒ)
  assert.match(code(read(...PANEL)), /askServer\(raw, list !== undefined\);/);
  assert.doesNotMatch(flat(code(read(...PRIVACY))), /이름 전체가 아니/);
  // 1항 브라우저 저장 — 즐겨찾기에 고른 한자
  assert.ok(policy.includes("출생일·출생 시각·성별·톤·고른 한자·점수는 이용자 브라우저(localStorage)에만 저장되며"));
  // 2026-11-27 /search 새로 고침·뒤로 가기 복원 — 입력값과 결과를 그 탭의 sessionStorage 에(app/search/page.tsx RESTORE_STORAGE_KEY)
  assert.ok(policy.includes("이름 추천 화면은 새로 고침·뒤로 가기에 결과를 다시 보여 주려고 최근 몇 번의 입력값(성씨·생년월일·출생 시각·성별·톤·부모 이름·키워드 등)과 결과를 그 탭의 브라우저 저장소(sessionStorage)에 두며, 이것도 서버로 보내지 않고 탭을 닫으면 브라우저가 지웁니다."));
  assert.match(read("src", "app", "search", "page.tsx"), /const RESTORE_STORAGE_KEY = "nameform:search-restore";/);
  assert.match(read("src", "app", "search", "page.tsx"), /window\.sessionStorage/);
  assert.match(read("src", "lib", "favorites.ts"), /hanja\?: string;[\s\S]*?lastHanja\?: string;/);
  // 5항 — 광고 요청에 화면 주소가 포함될 수 있다. 2026-11-27: 운영에서 실제로 쿼리째 가는 것을 확인해 광고 로더를 읽을거리 화면에만 싣고
  // 도구 화면에는 싣지 않는다(tests/adsense-placement.test.mjs 가 싣는 곳을 고정한다 — 방침과 코드가 같은 말을 한다)
  assert.ok(policy.includes("광고를 불러오는 요청에는 그 화면의 주소가 포함될 수 있습니다. 그래서 광고 스크립트는 홈·작명 가이드·데이터 리포트·작명 원리·소개와 이름 뜻 사전·한자 사전의 목록 화면처럼 주소에 입력값이 들어가지 않는 화면에만 싣고, 이름 추천·평가 같은 도구 화면에는 싣지 않습니다. 광고를 싣는 화면에서 다른 화면으로 옮기면 페이지를 새로 불러와 광고 스크립트가 따라가지 않게 하며, 사이트 안에서 화면을 옮길 때 이전 화면의 주소는 도메인까지만 넘깁니다."));
  assert.doesNotMatch(policy, /도구 화면의 주소에는 입력값이 들어갈 수 있습니다\)\./);

  // 방침이 말한 대로인가 — 판정 API 는 값을 로그·사용 통계에 남기지 않는다(실행 확인은 백엔드 테스트의 수집 로거)
  const ctrlDir = join(ROOT, "..", "Api", "Controllers");
  const hanjaCtrl = readFileSync(join(ctrlDir, "HanjaController.cs"), "utf8");
  const places = [...hanjaCtrl.matchAll(/_logger\.Log\w+\(\s*(?:ex\s*,\s*)?\$?"([^"]*)"/g)].flatMap((m) => [...m[1].matchAll(/\{(\w+)\}/g)].map((x) => x[1]));
  assert.deepEqual([...new Set(places)].sort(), ["ErrorType", "StackTrace"]);
  assert.doesNotMatch(hanjaCtrl.replace(/\/\/.*$/gm, ""), /_usageTracker|TrackAsync/);
  // '서버 로그' 항목은 한자를 들지 않는다 → 어느 컨트롤러 로그 템플릿에도 한자 자리가 없다
  const serverLogItem = /<strong>서버 로그<\/strong>:([\s\S]*?)<\/li>/.exec(read(...PRIVACY));
  assert.ok(serverLogItem);
  assert.doesNotMatch(serverLogItem[1], /한자/);
  let templates = 0;
  for (const f of readdirSync(ctrlDir).filter((x) => x.endsWith(".cs"))) {
    const src = readFileSync(join(ctrlDir, f), "utf8");
    for (const [, tpl] of src.matchAll(/_logger\.Log\w+\(\s*(?:ex\s*,\s*)?\$?"([^"]*)"/g)) {
      templates++;
      assert.doesNotMatch(tpl, /\{[^}]*(Hanja|hanja)[^}]*\}/, `${f}: ${tpl}`);
    }
  }
  assert.ok(templates >= 20, `로그 템플릿 ${templates}개만 찾음`);
  // 음절 파일 주소에는 음절이 코드로 들어간다
  assert.match(read("src", "lib", "hanja-pick.ts"), /export const HANJA_PICK_BASE = "\/data\/hanja-pick\/v1";/);
});

// ─── 진입 링크 ③(/hanja — 커밋 5c378b2) · 검색 유입 보호 ─────────────────
// 이 묶음은 ③이 파일 끝(② /name 링크 묶음 바로 뒤)에 붙였던 것을 여기로 옮겼다 — ② 묶음이 파일 끝에 홀로 있어야
// ②만 되돌릴 때(git revert 75ebc6f) 이 파일이 부딪치지 않는다. /name 쪽 원문은 ② 의 NAME_PAGE 가 아니라 NAME_PAGE_SRC 로 읽는다.

/** 주석을 빼고 줄바꿈을 접은 원문 — 지운 JSX 주석 자리에 남는 `{}` 도 뺀다 */
const flatCode = (src) => flat(code(src)).replace(/\{\} /g, "");

test("/hanja 글자 상세 — 첫째 버튼 '‘瑞’ 글자로 이름 맞춰 보기'(독음 전부를 해시에), 추천 버튼은 둘째. 피하는 글자는 배너 없음, BMP 밖은 새 버튼만", () => {
  const raw = read(...HANJA_SLUG);
  assert.match(code(raw), /^import \{ evaluatePickHref \} from "@\/lib\/hanja-pick";$/m);
  const banner = flatCode(functionBody(raw, "CtaBanner"));
  assert.ok(banner.startsWith("function CtaBanner({ char, label, pickHref }: { char: string; label: string; pickHref?: string }) {"));
  // BMP 밖 글자 — 추천 버튼은 계속 숨기고, 맞춰 보기가 있으면 그 버튼만
  assert.ok(banner.includes("const recommendable = (char.codePointAt(0) ?? 0) <= 0xffff; if (!recommendable && !pickHref) return null;"));
  // pickHref 가 없을 때(독음 쪽)는 지금 모양 그대로 — 채운 추천 버튼 하나
  const recommendLink = (cls) =>
    `<Link href={\`/required-char?char=\${encodeURIComponent(char)}\`} rel="nofollow" className="${cls}" > &lsquo;{char}&rsquo; 글자를 넣어 이름 추천받기 → </Link>`;
  const filled = "inline-block rounded-lg bg-navy px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-navy-600";
  const outlined = "inline-block rounded-lg border border-navy px-6 py-3 text-sm font-semibold text-navy no-underline transition hover:bg-navy-50";
  const box = '<div className="my-10 rounded-xl border border-paper-line bg-paper-tint p-6 text-center"> <p className="mb-4 text-sm text-text-2">{label}</p>';
  assert.ok(banner.includes(`if (!pickHref) { return ( ${box} ${recommendLink(filled)} </div> ); }`), "독음 쪽 배너가 바뀌었다");
  // pickHref 가 있을 때: 맞춰 보기(<a> — 해시 링크라 nofollow 없음, 채운 버튼) → 추천(테두리 버튼, BMP 밖이면 없음)
  assert.ok(
    banner.includes(
      `return ( ${box} <div className="flex flex-wrap justify-center gap-3"> <a href={pickHref} className="${filled}" > &lsquo;{char}&rsquo; 글자로 이름 맞춰 보기 → </a> {recommendable && ( ${recommendLink(outlined)} )} </div> </div> );`
    ),
    "글자 상세 배너의 두 버튼 꼴이 바뀌었다"
  );
  // 글자 상세: 피하는 글자(nf)가 아니면 배너 + 맞춰 보기(독음 전부 record.r). 라벨 문장은 그대로
  const charPage = flatCode(functionBody(raw, "CharPage"));
  assert.ok(
    charPage.includes(
      "{!avoided && ( <CtaBanner char={char} label={`${char}(${primaryReading}) 글자가 들어간 이름의 미학 점수와 오행 조화가 궁금하신가요?`} pickHref={evaluatePickHref(char, record.r)} /> )}"
    )
  );
  // 배너 호출은 둘 — 독음 쪽은 글자가 아니라 독음이라 pickHref 를 주지 않는다
  const calls = [...code(raw).matchAll(/<CtaBanner\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((c) => c.includes("pickHref=")), [false, true]);
  // 버튼 높이 44px(py-3 12 + text-sm 20 + 12) — 두 버튼 같은 꼴
  for (const cls of [filled, outlined]) assert.match(cls, /\bpy-3\b.*\btext-sm\b/);
});

test("/hanja 독음 쪽·인덱스의 한 줄 — 쿼리·해시 없는 /evaluate(nofollow 없음). 독음 쪽은 배너 바로 아래·배너와 같은 조건", () => {
  const line = read(...EVAL_LINE);
  assert.doesNotMatch(line, /^\s*["']use client["']/m);
  assert.ok(
    flatCode(line).includes(
      '<p className={`text-center text-sm leading-relaxed text-text-2 ${className}`}> 이름을 정하셨다면 음절마다 한자를 골라 맞춰 볼 수 있어요 →{" "} <a href="/evaluate" className="font-medium text-teal-800 no-underline hover:underline"> 이름 평가 </a> </p>'
    )
  );
  // 링크는 하나 — 목적지는 폼 맨 위(설명 글 앵커 아님), nofollow·새 창 없음
  assert.deepEqual([...code(line).matchAll(/<a\b[^>]*>/g)].map((m) => m[0]), ['<a href="/evaluate" className="font-medium text-teal-800 no-underline hover:underline">']);
  // 독음 쪽: 배너 바로 아래, 배너와 같은 조건(이름에 쓰는 글자가 없는 독음에는 둘 다 없다)
  const reading = flatCode(functionBody(read(...HANJA_SLUG), "ReadingPage"));
  assert.match(reading, /\{named\.length > 0 && \( <CtaBanner char=\{reading\} label=\{`[^`]*`\} \/> \)\} \{named\.length > 0 && <HanjaEvaluateLine className="-mt-6" \/>\}/);
  // 인덱스: '추천 도구 연결' 상자(그대로) 아래 — 쪽의 맨 끝
  assert.match(flatCode(read(...HANJA_INDEX)), /필수 글자로 이름 추천받기 → <\/Link> <\/div> <HanjaEvaluateLine className="mt-4" \/> <\/main>/);
  // 쓰는 곳은 이 둘뿐
  for (const p of [HANJA_SLUG, HANJA_INDEX]) {
    assert.match(read(...p), /^import \{ HanjaEvaluateLine \} from "@\/components\/hanja\/HanjaEvaluateLine";$/m, name(p));
    assert.equal([...code(read(...p)).matchAll(/<HanjaEvaluateLine\b/g)].length, 1, name(p));
  }
  // 글자색 — 종이 위 작은 글씨(teal-800)
  const ratio = contrast(hexRgb(token("color-teal-800-token")), PAPER);
  assert.ok(ratio >= AA, `teal-800 / 종이 ${ratio.toFixed(2)}:1`);
});

test("검색 유입 보호 — /hanja·/name 의 title·description·h1 틀과 기존 문단은 그대로(링크 줄만 더했다)", () => {
  const slug = read(...HANJA_SLUG);
  // 독음 쪽
  assert.ok(slug.includes("const title = `이름에 쓰는 '${reading}' 한자 ${chars.length}자 — 종류·뜻·획수·오행`;"));
  assert.ok(
    slug.includes(
      "const description = `'${reading}'${josa(reading, \"으로/로\")} 읽는 인명용 한자 ${chars.length}자의 뜻, 획수, 자원오행을 한눈에 비교하세요. 부수 기준 자원오행과 판정 근거를 함께 보여 드립니다.`;"
    )
  );
  assert.ok(flat(slug).includes("이름에 쓰는 &lsquo;{reading}&rsquo; 한자 {chars.length}자 </h1>"));
  // 글자 상세
  assert.ok(slug.includes('const title = `${char}(${record.r.join("·")}) — 뜻·획수·오행`;'));
  assert.ok(flat(slug).includes("}. 이름에 쓰일 때의 의미와 함께 쓰기 좋은 글자를 확인하세요.`;"));
  assert.ok(flat(slug).includes('{char}{" "} <span className="font-normal text-text-2"> ({meaningParts[0]}) </span> </h1>'));
  assert.equal([...code(slug).matchAll(/<h1\b/g)].length, 2);
  // 기존 문단 — 독음 쪽 배너 문장·글자 상세 배너 문장
  assert.ok(slug.includes("들어가는 이름이 궁금하신가요? 미학 점수와 오행 조화까지 분석해 드립니다.`}"));
  // 인덱스
  const index = read(...HANJA_INDEX);
  assert.equal([...index.matchAll(/title: "인명용 한자 사전 — 뜻·획수·오행 검색",/g)].length, 2);
  assert.ok(index.includes('"이름에 쓰는 인명용 한자 9,000여 자의 뜻, 획수, 오행을 독음별로 찾아보세요. 대법원 인명용 한자 기준, 부수 기준 자원오행과 판정 근거(확정·이견)를 함께 제공합니다.",'));
  assert.match(flat(index), /<h1 className="[^"]*"> 인명용 한자 사전 <\/h1>/);
  assert.ok(flat(index).includes("마음에 드는 글자를 찾으셨나요? 그 글자가 들어간 이름의 미학 점수와 오행 조화를 분석해 드립니다."));
  // /name
  const nameSrc = read(...NAME_PAGE_SRC);
  assert.ok(nameSrc.includes("const title = `${name} 이름 뜻 — 인기 순위·한자·의미`;"));
  assert.ok(nameSrc.includes("const description = `${name}: ${GENDER_LABEL[gender]}.${meanPart} 출생신고 통계 기준 인기 순위와 남녀 비율${"));
  assert.ok(flat(nameSrc).includes('{name} <span className="text-xl font-normal text-text-2 sm:text-2xl">이름 뜻</span> </h1>'));
  assert.equal([...code(nameSrc).matchAll(/<h1\b/g)].length, 1);
  assert.ok(flat(nameSrc).includes("{name}의 발음·미학 점수와 사주 오행 조화가 궁금하신가요?"));
});

test("sitemap·robots — /evaluate 는 바뀐 날을 자기 lastModified 로(방침·오행 찾기와 같은 배포일), 정적 후보 파일은 수집하지 않게", () => {
  const sitemap = read(...SITEMAP);
  const dateOf = (path) =>
    new RegExp(`\\{ path: "${path}", priority: [\\d.]+, changeFrequency: "\\w+", lastModified: "(\\d{4}-\\d{2}-\\d{2})" \\}`).exec(sitemap)?.[1];
  assert.ok(dateOf("evaluate"), "evaluate 줄에 lastModified 가 없다");
  // 3파(2026-11-26)는 평가·오행 찾기·방침이 한 배포였다. 2026-11-27 방침 5항(광고 스크립트를 싣는 화면)만 따로 고쳐 방침은 그 뒤 날짜다
  assert.equal(dateOf("evaluate"), dateOf("ohaeng"));
  assert.ok(dateOf("privacy") >= dateOf("evaluate"), "방침은 평가 화면 배포일 이후(한자 입력 항목을 실은 날 이후)");
  assert.match(sitemap, /\{ path: "evaluate", priority: 0\.8, changeFrequency: "monthly", lastModified: "/);
  const robots = read(...ROBOTS);
  assert.match(robots, /const STATIC_DATA = "\/data\/";/);
  // 2026-11-27 /favorites 는 disallow 에서 뺐다 — 그 쪽 robots 메타(noindex, follow)가 색인을 막는다(tests/fix1127-site-chrome.test.mjs)
  assert.equal([...robots.matchAll(/disallow: \["\/api\/", STATIC_DATA, \.\.\.TOOL_QUERY_VARIANTS\],/g)].length, 2);
  assert.match(robots, /const TOOL_QUERY_VARIANTS = \[[^\]]*"\/evaluate\?"[^\]]*\];/);
});

// ═════════════════════════════════════════════════════════════
// 진입 링크(C7 뒤 절반) — /name 조합 카드 · /hanja 인덱스·독음 쪽·글자 상세
// 검색 유입이 가장 많은 쪽들이다 — 링크 줄만 더하고 제목·설명·h1·기존 문단은 건드리지 않는다(사용자 결정).
// 빌드 HTML 대조(바꾸기 전 빌드와 title·description·h1 같음, 더해진 것이 링크 줄뿐)는 구현 기록 §26 에 적었다.
// ═════════════════════════════════════════════════════════════

const NAME_PAGE = ["src", "app", "name", "[slug]", "page.tsx"];

test("/name 조합 카드의 '이 한자로 평가' — 이름과 그 조합만 싣는 nofollow 링크(칩 아래), 순우리말 참고 조합에는 없다", () => {
  const raw = read(...NAME_PAGE);
  assert.match(code(raw), /^import \{ evaluateComboHref \} from "@\/lib\/hanja-pick";$/m);
  const card = functionBody(raw, "ComboCard");
  assert.match(
    card,
    /\{evaluateLink && \(\s*<a\s+href=\{evaluateComboHref\(name, c1 \+ c2\)\}\s+rel="nofollow"\s+aria-label=\{`이 한자로 평가 — \$\{c1\}\$\{c2\}`\}\s+className="[^"]*\bmin-h-11\b[^"]*\btext-teal-800\b[^"]*"\s*>\s*이 한자로 평가 →\s*<\/a>\s*\)\}/
  );
  assert.equal([...code(card).matchAll(/<a\b/g)].length, 1, "카드의 링크는 하나");
  assert.ok(card.indexOf("<OhaengRelationChip") < card.indexOf("evaluateComboHref("), "관계 칩 아래");
  assert.match(card, /^\s*evaluateLink: boolean;$/m);
  // 순우리말 사전 이름(pk)의 '한자로 쓴다면(참고)' 조합에는 달지 않는다 — '추천 1순위' 강조와 같은 조건
  assert.match(
    flat(code(raw)),
    /<ComboCard key=\{combo\.join\(""\)\} combo=\{combo\} name=\{name\} featured=\{kind !== "pure" && i === 0\} evaluateLink=\{kind !== "pure"\} \/>/
  );
  assert.equal([...raw.matchAll(/<ComboCard\b/g)].length, 1);
  // 성·성별은 싣지 않는다 — 링크 함수가 받는 것은 이름과 한자뿐(값은 hanja-pick.test.mjs evaluateComboHref)
  assert.match(read("src", "lib", "hanja-pick.ts"), /export function evaluateComboHref\(name: string, hanja: string\): string \{/);
  // 이 쪽에서 /evaluate 로 가는 링크는 셋 — 모두 풀 페이지 이동(<a>)이고 nofollow(목적지 /evaluate?… 는 robots 가 막는다)
  const evalAnchors = [...code(raw).matchAll(/<a\s+href=\{[^}]*(?:\/evaluate|evaluateComboHref)[^}]*\}[\s\S]*?>/g)].map((m) => m[0]);
  assert.equal(evalAnchors.length, 3);
  for (const a of evalAnchors) assert.match(a, /\brel="nofollow"/, a);
  assert.doesNotMatch(code(raw), /<Link\s+href=\{?["'`]\/evaluate/);
  // 서버 컴포넌트에서 쓰는 링크 함수는 큰 JSON 을 import 하지 않는 순수 모듈이다(이 쪽의 번들과 무관하지만 클라이언트도 같은 모듈을 쓴다)
  assert.doesNotMatch(code(read("src", "lib", "hanja-pick.ts")), /from "\.\/(hanja|name)-seo"|\.json"/);
});
