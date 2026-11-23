// 한자 입력(/evaluate 음절별 한자 칸)의 순수 로직 테스트 — `npm test`
//
// 2026-11 설계 docs/plan-hanja-input-2026-11.md §13-3. lib/hanja-pick.ts 는 서버 규칙(정리·한자 범위·두음)의 미리보기라
// 같은 규칙을 두 번 적은 자리를 **백엔드 원문**(HanjaData.cs · HanjaInput.cs · RequiredCharEngine.cs)과
// **정적 후보 파일**(public/data/hanja-pick/v1 — 서버 술어의 덤프 489 음절·10,027쌍)에 대조한다.
// 그 밖의 기대값은 손으로 적은 표다(검사 대상 함수로 기대값을 만들지 않는다).
//
// 한자는 코드포인트로 적는다(U(0x745E)) — 호환 한자·BMP 밖 글자·보이지 않는 글자를 소스에 글자로 두지 않는다.
// 맨 끝 테스트가 이 파일과 새 소스 파일을 훑어 그런 글자가 없는지 본다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const {
  AUTO,
  DUEUM_INITIALS,
  DUEUM_IOTIZED_VOWELS,
  HANJA_PICK_BASE,
  HANJA_PICK_INDEX,
  HAN_RANGES,
  INVISIBLE_RANGES,
  NONE,
  NORMALIZE_RANGES,
  UNIFIED_IN_COMPATIBILITY_BLOCK,
  acceptedSyllablesOf,
  apiHanjaFields,
  applyInitialDueum,
  asSurnameFact,
  blockView,
  canonicalHanja,
  checkSeed,
  choiceKey,
  cleanHanjaText,
  comboFacts,
  confirmedPickReadings,
  decodeHanjaParam,
  deriveSlots,
  encodeHanjaParam,
  evaluateComboHref,
  evaluatePickHref,
  filterCandidates,
  firstHanCodePoint,
  groupCandidates,
  hanCharsOf,
  hanjaFromSummary,
  isHanAfterClean,
  isHanCodePoint,
  isHangulSyllables,
  marksOf,
  parsePickFile,
  parsePickHash,
  parsePickIndex,
  pickSyllablesIn,
  rolesOf,
  seedChoices,
  sortForSurname,
  spreadPaste,
  surnameDefaultAt,
  syllableFile,
  toApiHanja,
  toHanjaFact,
} = await import("../src/lib/hanja-pick.ts");

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel) => readFileSync(here(rel), "utf8");
const backend = (rel) => read(`../../${rel}`);

/** 코드포인트 → 글자 */
const U = (...codes) => String.fromCodePoint(...codes);
const hex = (text) => [...text].map((ch) => ch.codePointAt(0).toString(16).toUpperCase()).join(" ");

// 자주 쓰는 글자(통합 한자) — 괄호 안은 훈·음
const SEO = U(0x745e); // 상서 서
const YUN = U(0x6f64); // 윤택할 윤
const LI = U(0x674e); // 오얏 리
const GEUM = U(0x91d1); // 쇠 금
const RYU = U(0x67f3); // 버들 류 — 성씨 '유'의 대표 한자
const LIU = U(0x5289); // 성씨 '유'의 다른 한자(15획) — 이름용으로는 '이름에 피하는 글자' 표시가 붙어 있다
const NAM = U(0x5357);
const GUNG = U(0x5bae);
const NOK = U(0x742d); // 옥 록(녹)
const RIM = U(0x6797); // 수풀 림
const GYUN = U(0x5747); // 고를 균 · 따를 연
const NA = U(0x5a1c); // 아름다울 나
const EXT_B = U(0x25874); // 사전에 실린 BMP 밖 글자(UTF-16 길이 2)
// 호환 코드(입력기·PDF 가 내는 꼴)
const LI_COMPAT = U(0xf9e1);
const GEUM_COMPAT = U(0xf90a);
const GEUM_KANGXI = U(0x2fa6); // 강희 부수 金

// ── 정적 후보 파일 ─────────────────────────────────────────────────────────────
const PICK_DIR = "../public/data/hanja-pick/v1";
const rawIndex = JSON.parse(read(`${PICK_DIR}/index.json`));
const index = parsePickIndex(rawIndex);
const rawFile = (syllable) => JSON.parse(read(`../public${syllableFile(syllable)}`));
const fileOf = (syllable) => parsePickFile(rawFile(syllable));
/** 음절들 → 받아 둔 음절 파일(화면의 Map 과 같은 꼴) */
const filesFor = (...syllables) => new Map(syllables.map((s) => [s, fileOf(s)]));
const factOf = (syllable, character) => {
  const fact = fileOf(syllable).find((f) => f.character === character);
  assert.ok(fact, `${syllable} 파일에 U+${hex(character)} 가 있어야 한다`);
  return fact;
};
const NO_FILES = new Map();
const NO_CHOICES = new Map();

// ============================================================
// 한자 범위 — 서버 HanjaData.IsHanCodePoint 와 같은 여섯 범위
// ============================================================

test("isHanCodePoint: HanjaData.cs 의 여섯 범위와 같다", () => {
  const src = backend("Application/Engines/Data/HanjaData.cs");
  const body = /public static bool IsHanCodePoint\(string character\)\s*\{([\s\S]*?)\n {4}\}/.exec(src);
  assert.ok(body, "IsHanCodePoint 본문을 찾지 못했다");
  const ranges = [...body[1].matchAll(/codePoint >= 0x([0-9A-Fa-f]+) && codePoint <= 0x([0-9A-Fa-f]+)/g)].map(
    ([, lo, hi]) => [parseInt(lo, 16), parseInt(hi, 16)]
  );
  assert.equal(ranges.length, 6);
  assert.deepEqual(HAN_RANGES, ranges);
});

test("isHanCodePoint: 경계값 손 표", () => {
  const cases = [
    [0x33ff, false], [0x3400, true], [0x4dbf, true], [0x4dc0, false], // 확장 A
    [0x4dff, false], [0x4e00, true], [0x9fff, true], [0xa000, false], // 기본
    [0xf8ff, false], [0xf900, true], [0xfaff, true], [0xfb00, false], // 호환
    [0x1ffff, false], [0x20000, true], [0x2ebef, true], [0x2ebf0, false], // 확장 B~F
    [0x2f7ff, false], [0x2f800, true], [0x2fa1f, true], [0x2fa20, false], // 호환 보충
    [0x2ffff, false], [0x30000, true], [0x323af, true], [0x323b0, false], // 확장 G~H
    [0xa01b1, false], [0xf0000, false], // 대법원 목록의 자체 코드 영역
    [0xac00, false], [0x2fa6, false], [0x41, false], [-1, false], [1.5, false], [NaN, false],
  ];
  for (const [cp, expected] of cases) {
    assert.equal(isHanCodePoint(cp), expected, `U+${Number(cp).toString(16)}`);
  }
});

// ============================================================
// 정리 — 서버 HanjaInput.Strip · NormalizeRune · Lookup 과 같은 규칙
// ============================================================

test("cleanHanjaText: 지우는 범위·정규화 범위·호환 블록 안의 통합 한자 12자가 HanjaInput.cs 와 같다", () => {
  const src = backend("Application/Engines/Utils/HanjaInput.cs");

  const ignorable = /private static bool IsIgnorable\(Rune rune\)\s*\{([\s\S]*?)\n {4}\}/.exec(src);
  assert.ok(ignorable, "IsIgnorable 본문을 찾지 못했다");
  // 공백류는 서버가 Rune.IsWhiteSpace 로 본다 — 그 목록은 아래 손 표(실측)로 따로 지킨다
  assert.match(ignorable[1], /Rune\.IsWhiteSpace\(rune\)/);
  const pairs = [...ignorable[1].matchAll(/v >= 0x([0-9A-Fa-f]+) && v <= 0x([0-9A-Fa-f]+)/g)].map(
    ([, lo, hi]) => [parseInt(lo, 16), parseInt(hi, 16)]
  );
  const singles = [...ignorable[1].matchAll(/v == 0x([0-9A-Fa-f]+)/g)].map(([, v]) => [parseInt(v, 16), parseInt(v, 16)]);
  const byStart = (a, b) => a[0] - b[0];
  assert.deepEqual([...INVISIBLE_RANGES].sort(byStart), [...pairs, ...singles].sort(byStart));
  assert.equal(pairs.length + singles.length, 4);

  const normalize = /bool inRange = ([^;]+);/.exec(src);
  assert.ok(normalize, "NormalizeRune 의 범위 줄을 찾지 못했다");
  const normalizeRanges = [...normalize[1].matchAll(/v >= 0x([0-9A-Fa-f]+) && v <= 0x([0-9A-Fa-f]+)/g)].map(
    ([, lo, hi]) => [parseInt(lo, 16), parseInt(hi, 16)]
  );
  assert.equal(normalizeRanges.length, 4);
  assert.deepEqual([...NORMALIZE_RANGES].sort(byStart), normalizeRanges.sort(byStart));

  const unified = /UnifiedInCompatibilityBlock = new\(\)\s*\{([^}]+)\}/.exec(src);
  assert.ok(unified, "UnifiedInCompatibilityBlock 을 찾지 못했다");
  const codes = [...unified[1].matchAll(/0x([0-9A-Fa-f]+)/g)].map(([, v]) => parseInt(v, 16));
  assert.equal(codes.length, 12);
  assert.deepEqual([...UNIFIED_IN_COMPATIBILITY_BLOCK], codes);
});

test("cleanHanjaText: 공백류 25개와 폭 없는 문자·이체 선택자를 지우고, 그 이웃 글자는 지우지 않는다 (2026-11-19 서버 실측 표)", () => {
  // 서버 Rune.IsWhiteSpace 가 참인 코드포인트(유니코드 White_Space) — 로컬 서버 /hanja/resolve 에 '그 글자 + 한자'를 보내 ok 가 오는지로 잰 표
  const stripped = [
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
    0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
    0x200b, 0x200c, 0x200d, 0xfeff, 0xfe00, 0xfe0f, 0xe0100, 0xe01ef,
  ];
  assert.equal(stripped.length, 33);
  for (const cp of stripped) {
    assert.equal(cleanHanjaText(U(cp) + SEO + U(cp)), SEO, `U+${cp.toString(16)} 는 지운다`);
  }
  // 같은 실측에서 서버가 지우지 않은 글자(not_hanja 가 왔다)
  const kept = [0x1c, 0x1f, 0x180e, 0x200e, 0x2060, 0xad, 0xfe10, 0xe01f0, 0x3164, 0x115f];
  for (const cp of kept) {
    assert.equal(cleanHanjaText(U(cp) + SEO), U(cp) + SEO, `U+${cp.toString(16)} 는 지우지 않는다`);
  }
});

test("cleanHanjaText: 호환 한자·강희 부수 → 통합 한자, 이체 선택자·공백 제거, 그 밖의 글자는 그대로", () => {
  const cases = [
    [LI_COMPAT, LI], // 한글 입력기가 '이' 에서 내는 호환 코드
    [GEUM_COMPAT, GEUM],
    [GEUM_KANGXI, GEUM], // PDF 복사에서 오는 강희 부수
    [U(0x2f800), U(0x4e3d)], // 호환 보충
    [U(0x2e9f), U(0x6bcd)], // 부수 보충 가운데 한자로 풀리는 글자
    [U(0x674e, 0xfe00), LI], // 이체 선택자
    [U(0x745e, 0xe0100), SEO],
    [` ${SEO}${U(0x3000)}${YUN}\t`, SEO + YUN], // 가운데 전각 공백
    [SEO + U(0x200b) + YUN, SEO + YUN],
    [EXT_B, EXT_B], // 서로게이트 쌍은 한 글자로 남는다
    [U(0x328a), U(0x328a)], // 동그라미 月 — 범위 밖이라 NFKC 를 걸지 않는다(걸면 月 이 된다)
    [U(0x2e80), U(0x2e80)], // 부수 보충 가운데 풀리지 않는 글자
    ["*-", "*-"],
    [`${SEO}*`, `${SEO}*`],
    ["서ㅇ", "서ㅇ"], // 한글은 건드리지 않는다(걸러 내는 일은 부르는 쪽)
    ["", ""],
  ];
  for (const [input, expected] of cases) {
    assert.equal(hex(cleanHanjaText(input)), hex(expected), `입력 ${hex(input)}`);
  }
  assert.equal(cleanHanjaText(null), "");
  assert.equal(cleanHanjaText(undefined), "");
  assert.equal([...cleanHanjaText(EXT_B)].length, 1);
  assert.equal(cleanHanjaText(EXT_B).length, 2);
});

test("cleanHanjaText: 홀로 남은 서로게이트를 지운다 — 남으면 서버가 본문을 읽지 못해 영문 400 이 온다", () => {
  const HIGH = String.fromCharCode(0xd800);
  const LOW = String.fromCharCode(0xdc00);
  const cases = [
    [HIGH + SEO, SEO],
    [SEO + HIGH, SEO],
    [LOW + SEO, SEO],
    [SEO + LOW + YUN, SEO + YUN],
    [HIGH + "*", "*"],
    [LOW + HIGH, ""], // 순서가 뒤집힌 쌍은 둘 다 홀로 남은 것이다
    [HIGH + HIGH + LOW, HIGH + LOW], // 뒤의 둘은 짝이 맞는 한 글자(U+10000)
  ];
  for (const [input, expected] of cases) {
    const cleaned = cleanHanjaText(input);
    assert.equal(cleaned, expected);
    assert.equal(cleaned.isWellFormed(), true);
    assert.doesNotMatch(JSON.stringify({ nameHanja: cleaned }), /\\ud[89a-f]/i);
  }
  // 안 지우면 이렇게 나간다 — 서버가 400(ProblemDetails)으로 돌려준 본문 꼴
  assert.match(JSON.stringify({ nameHanja: HIGH + "*" }), /\\ud800\*/);
});

test("호환 블록 전수: 정리 뒤 통합 한자로 바뀌거나(1,002개) 12자로 남고, 배정되지 않은 42개는 한자가 아니다", () => {
  let moved = 0;
  let kept = 0;
  const rejected = [];
  const inBlock = (cp) => (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x2f800 && cp <= 0x2fa1f);
  for (const [lo, hi] of [[0xf900, 0xfaff], [0x2f800, 0x2fa1f]]) {
    for (let cp = lo; cp <= hi; cp++) {
      const cleaned = [...cleanHanjaText(U(cp))];
      assert.equal(cleaned.length, 1);
      const out = cleaned[0].codePointAt(0);
      if (out !== cp) {
        assert.ok(!inBlock(out) && isHanAfterClean(out), `U+${cp.toString(16)} → U+${out.toString(16)}`);
        moved++;
      } else if (UNIFIED_IN_COMPATIBILITY_BLOCK.includes(cp)) {
        assert.equal(isHanAfterClean(cp), true);
        kept++;
      } else {
        assert.equal(isHanAfterClean(cp), false, `U+${cp.toString(16)}`);
        assert.equal(firstHanCodePoint(U(cp)), null);
        rejected.push(cp);
      }
    }
  }
  // 설계 §21: 정규화로 안 바뀌는 코드 54개 = 배정되지 않은 42 + 통합 한자 12
  assert.equal(kept, 12);
  assert.equal(rejected.length, 42);
  assert.equal(moved, 0x200 + 0x220 - 54);
  assert.deepEqual(
    rejected,
    [0xfa6e, 0xfa6f, ...Array.from({ length: 0xfaff - 0xfada + 1 }, (_, i) => 0xfada + i), 0x2fa1e, 0x2fa1f]
  );
  // 강희 부수 214자는 모두 한자로 풀린다
  for (let cp = 0x2f00; cp <= 0x2fd5; cp++) {
    assert.ok(firstHanCodePoint(U(cp)), `강희 부수 U+${cp.toString(16)}`);
  }
});

test("firstHanCodePoint·hanCharsOf: 긴 원문에서도 한자 한 코드포인트만 — 붙여 넣은 다른 글이 서버로 가지 않는다", () => {
  const pasted = `가나다 010-0000-0000\n${LI_COMPAT}${SEO} ${YUN} abc`;
  const first = firstHanCodePoint(pasted);
  assert.equal(first, LI); // 호환 코드로 와도 통합 한자
  assert.equal([...first].length, 1);
  assert.deepEqual(hanCharsOf(pasted), [LI, SEO, YUN]);

  assert.equal(firstHanCodePoint(`x${EXT_B}y`), EXT_B);
  assert.equal([...firstHanCodePoint(`x${EXT_B}y`)].length, 1);
  assert.equal(firstHanCodePoint("서윤 abc *-"), null);
  assert.equal(firstHanCodePoint(""), null);
  assert.equal(firstHanCodePoint(null), null);
  assert.equal(firstHanCodePoint(U(0xfa6e)), null); // 호환 블록의 배정되지 않은 코드
  assert.equal(firstHanCodePoint(U(0xfa0e)), U(0xfa0e)); // 호환 블록 안의 통합 한자
  assert.equal(firstHanCodePoint(U(0x328a)), null); // 동그라미 月 은 한자가 아니다
  assert.deepEqual(hanCharsOf(`${SEO}*-${YUN}`), [SEO, YUN]);
});

test("isHangulSyllables: 가~힣 만 — 서버와 같은 경계", () => {
  const src = backend("Application/Engines/Utils/HanjaInput.cs");
  assert.match(
    src,
    /public static bool IsHangulSyllables\(string\? text\)[\s\S]*?if \(c < 0xAC00 \|\| c > 0xD7A3\) return false;/
  );
  for (const ok of ["서윤", "가", "힣", "남궁"]) assert.equal(isHangulSyllables(ok), true, ok);
  for (const bad of ["", "ㅅ", "서ㅇ", "서 윤", " 서윤", SEO, "seo", `서${SEO}`, U(0xabff), U(0xd7a4), U(0x1100)]) {
    assert.equal(isHangulSyllables(bad), false, hex(bad));
  }
  assert.equal(isHangulSyllables(null), false);
  assert.equal(isHangulSyllables(undefined), false);
});

// ============================================================
// 두음 — 서버 RequiredCharEngine.ApplyInitialDueum 과 같은 자모 규칙
// ============================================================

test("applyInitialDueum: 손 표", () => {
  const cases = [
    ["림", "임"], ["류", "유"], ["록", "녹"], ["리", "이"], ["라", "나"], ["녀", "여"], ["니", "이"],
    ["룡", "용"], ["뢰", "뇌"], ["량", "양"], ["렬", "열"], ["률", "율"], ["례", "예"], ["로", "노"], ["루", "누"],
    ["념", "염"], ["뇨", "요"], ["뉴", "유"], ["녜", "예"], ["냥", "양"],
    // 걸리지 않는 음절은 그대로 — ㄴ 은 ㅣ계 모음 앞에서만
    ["서", "서"], ["나", "나"], ["노", "노"], ["누", "누"], ["네", "네"], ["이", "이"], ["임", "임"], ["윤", "윤"],
    // 한글 음절 한 글자가 아니면 그대로
    ["ㄹ", "ㄹ"], ["림림", "림림"], ["", ""], [SEO, SEO],
  ];
  for (const [input, expected] of cases) assert.equal(applyInitialDueum(input), expected, input);
});

test("applyInitialDueum: 한글 음절 11,172자 전수가 RequiredCharEngine.cs 의 상수로 다시 셈한 값과 같다", () => {
  const src = backend("Application/Engines/RequiredCharEngine.cs");
  const consts = /private const int InitialNieun = (\d+), InitialRieul = (\d+), InitialIeung = (\d+);/.exec(src);
  assert.ok(consts, "초성 상수를 찾지 못했다");
  const [nieun, rieul, ieung] = consts.slice(1).map(Number);
  const vowelsLine = /IotizedVowels = \{([^}]+)\}/.exec(src);
  assert.ok(vowelsLine, "IotizedVowels 를 찾지 못했다");
  const vowels = vowelsLine[1].replace(/\/\*[^*]*\*\//g, "").split(",").map((v) => Number(v.trim()));

  assert.deepEqual({ ...DUEUM_INITIALS }, { nieun, rieul, ieung });
  assert.deepEqual([...DUEUM_IOTIZED_VOWELS], vowels);

  // 원문의 식을 그대로 옮긴 독립 계산: 음절 = 0xAC00 + (초성×21 + 중성)×28 + 종성
  let changed = 0;
  for (let code = 0xac00; code <= 0xd7a3; code++) {
    const offset = code - 0xac00;
    const initial = Math.floor(offset / 588);
    const rest = offset % 588;
    const iotized = vowels.includes(Math.floor(rest / 28));
    const violates = initial === rieul || (initial === nieun && iotized);
    const expected = violates ? 0xac00 + (iotized ? ieung : nieun) * 588 + rest : code;
    if (expected !== code) changed++;
    assert.equal(applyInitialDueum(String.fromCharCode(code)), String.fromCharCode(expected));
  }
  // ㄹ 초성 588자 + ㄴ 초성 × ㅣ계 모음 6 × 종성 28
  assert.equal(changed, 588 + 6 * 28);
});

test("acceptedSyllablesOf: 독음 → 넣을 수 있는 음절(독음 먼저, 그다음 두음 꼴) — 한쪽 방향", () => {
  const cases = [
    [["서"], ["서"]],
    [["리"], ["리", "이"]],
    [["리", "이"], ["리", "이"]],
    [["림"], ["림", "임"]],
    [["림", "임"], ["림", "임"]],
    [["록"], ["록", "녹"]],
    [["나", "라"], ["나", "라"]], // 라 → 나 는 이미 있다
    [["나"], ["나"]], // 두음 독음뿐인 글자를 본음 칸(라)에 받지 않는다
    [["균", "연"], ["균", "연"]],
    [["녕", "영"], ["녕", "영"]],
    [["룡", "용"], ["룡", "용"]],
    [["니"], ["니", "이"]],
    [["녀"], ["녀", "여"]],
    [["금", "김"], ["금", "김"]],
    [["류", "", "류"], ["류", "유"]], // 빈 값·중복은 뺀다
    [[], []],
  ];
  for (const [readings, expected] of cases) assert.deepEqual(acceptedSyllablesOf(readings), expected, readings.join(","));
});

// ============================================================
// 정적 후보 파일 ↔ 프런트 규칙
// ============================================================

test("syllableFile: 색인의 489 음절마다 그 주소에 파일이 있다 (코드포인트 16진 소문자)", () => {
  assert.equal(HANJA_PICK_BASE, "/data/hanja-pick/v1");
  assert.equal(HANJA_PICK_INDEX, "/data/hanja-pick/v1/index.json");
  assert.equal(syllableFile("서"), "/data/hanja-pick/v1/c11c.json");
  assert.equal(syllableFile("유"), "/data/hanja-pick/v1/c720.json");
  for (const bad of ["", "ㅅ", "서윤", SEO, "a"]) assert.equal(syllableFile(bad), null, bad);

  assert.ok(index, "index.json 을 읽지 못했다");
  const syllables = Object.keys(index.syllables);
  assert.equal(syllables.length, 489);
  assert.equal(index.counts.syllables, 489);
  for (const s of syllables) {
    const path = syllableFile(s);
    assert.match(path, /^\/data\/hanja-pick\/v1\/[0-9a-f]{4}\.json$/);
    assert.ok(existsSync(here(`../public${path}`)), `${s} → ${path}`);
  }
  const onDisk = readdirSync(here(PICK_DIR)).filter((f) => f !== "index.json");
  assert.equal(onDisk.length, 489);
  // 독음이 아닌 음절은 색인에 없다 — 잠긴 칸
  for (const s of ["봄", "빛", "쁨", "궉"]) assert.equal(s in index.syllables, false, s);
});

test("parsePickFile·parsePickIndex: 꼴이 다르면 null, 한자가 아닌 줄은 버린다", () => {
  assert.equal(parsePickFile(null), null);
  assert.equal(parsePickFile("x"), null);
  assert.equal(parsePickFile({}), null);
  assert.equal(parsePickFile({ hanja: "x" }), null);
  assert.deepEqual(parsePickFile({ hanja: [] }), []);
  const parsed = parsePickFile({
    syllable: "서",
    hanja: [
      { character: SEO, gloss: "상서 서", fiveElement: "金", resourceGrade: "R", strokeCount: 13, yinYang: "陽", common: true, hasMeaning: true, basic: true },
      { character: "서", gloss: "x" },
      { character: SEO + YUN, gloss: "x" },
      { gloss: "x" },
      null,
      { character: EXT_B, gloss: "", fiveElement: "木", resourceGrade: "V", vReasons: ["radical_single"], strokeCount: 15, yinYang: "陽" },
    ],
  });
  assert.deepEqual(parsed, [
    { character: SEO, gloss: "상서 서", fiveElement: "金", resourceGrade: "R", vReasons: [], strokeCount: 13, yinYang: "陽", common: true, forbidden: false, hasMeaning: true, basic: true },
    // 없는 필드는 false·[] — hasMeaning 이 없는 글자 = 뜻 풀이 없는 글자, basic 이 없는 글자 = 확장 한자
    { character: EXT_B, gloss: "", fiveElement: "木", resourceGrade: "V", vReasons: ["radical_single"], strokeCount: 15, yinYang: "陽", common: false, forbidden: false, hasMeaning: false, basic: false },
  ]);
  assert.equal(parsePickIndex(null), null);
  assert.equal(parsePickIndex({ syllables: {} }), null);
  assert.equal(parsePickIndex({ syllables: {}, surnames: {} }), null);
  assert.equal(parsePickIndex(rawIndex), rawIndex);
});

test("정적 파일 전수: 파일의 (글자, 음절) 10,027쌍 = 프런트 사전 독음에 두음 규칙을 건 쌍 — 양쪽으로 같다", () => {
  const dict = JSON.parse(read("../src/data/hanja-seo.json"));

  const fromFiles = new Set();
  const characters = new Set();
  const common = new Set();
  const forbidden = new Set();
  for (const [syllable, info] of Object.entries(index.syllables)) {
    const raw = rawFile(syllable);
    assert.equal(raw.syllable, syllable);
    const facts = parsePickFile(raw);
    assert.equal(facts.length, raw.hanja.length, `${syllable}: 버린 줄이 없어야 한다`);
    assert.equal(facts.length, info.all, `${syllable}: all`);
    // 화면에 쓰는 숫자의 기준은 index.json — 파일의 표시로 다시 세어 같다(없는 필드를 false 로 읽는 약속이 맞다는 뜻)
    assert.equal(facts.filter((f) => !f.forbidden && f.hasMeaning).length, info.usable, `${syllable}: usable`);
    const groups = groupCandidates(facts);
    assert.equal(groups.common.length + groups.others.length, info.usable, `${syllable}: 묶음 ①+②`);
    assert.equal(groups.avoided.length, info.all - info.usable, `${syllable}: 묶음 ③`);
    // 묶음은 파일 순서 그대로 ①② → ③ 이다(서버가 그 순서로 싣는다)
    assert.deepEqual([...groups.common, ...groups.others, ...groups.avoided].map((f) => f.character), facts.map((f) => f.character));

    for (const fact of facts) {
      const record = dict[fact.character];
      assert.ok(record, `${syllable}: 사전에 없는 글자 U+${hex(fact.character)}`);
      // 사전(/hanja)의 뜻 유무·불용 표시·획수·오행과 같은 값
      assert.equal(fact.hasMeaning, !!record.m, `U+${hex(fact.character)} hasMeaning`);
      assert.equal(fact.forbidden, record.nf === 1, `U+${hex(fact.character)} forbidden`);
      assert.equal(fact.strokeCount, record.s, `U+${hex(fact.character)} strokeCount`);
      assert.equal(fact.fiveElement, record.e ?? "", `U+${hex(fact.character)} fiveElement`);
      const cp = fact.character.codePointAt(0);
      assert.equal(fact.basic, cp >= 0x4e00 && cp <= 0x9fff, `U+${hex(fact.character)} basic`);
      assert.equal(isHanAfterClean(cp), true);
      assert.equal(cleanHanjaText(fact.character), fact.character, "파일의 글자는 이미 통합 한자다");

      fromFiles.add(`${fact.character}|${syllable}`);
      characters.add(fact.character);
      if (fact.common) common.add(fact.character);
      if (fact.forbidden) forbidden.add(fact.character);
    }
  }

  const fromRule = new Set();
  let dictPairs = 0;
  for (const [character, record] of Object.entries(dict)) {
    dictPairs += record.r.length;
    for (const syllable of acceptedSyllablesOf(record.r)) fromRule.add(`${character}|${syllable}`);
  }

  const onlyFiles = [...fromFiles].filter((p) => !fromRule.has(p));
  const onlyRule = [...fromRule].filter((p) => !fromFiles.has(p));
  assert.deepEqual(onlyFiles.slice(0, 5), [], `파일에만 있는 쌍 ${onlyFiles.length}개`);
  assert.deepEqual(onlyRule.slice(0, 5), [], `프런트 규칙에만 있는 쌍 ${onlyRule.length}개`);

  assert.equal(fromFiles.size, 10027);
  assert.equal(index.counts.pairs, 10027);
  assert.equal(dictPairs, 9977); // 사전의 (글자, 독음) 쌍 — 나머지 50쌍은 두음 꼴로만 받는 쌍이다
  assert.equal(characters.size, index.counts.characters);
  assert.equal(characters.size, Object.keys(dict).length);
  assert.equal(common.size, index.counts.common);
  assert.equal(forbidden.size, index.counts.forbidden);
});

test("정적 파일: 설계의 경계 사례 — 두음 꼴·보충 독음은 들어 있고 뒤집힌 방향은 없다", () => {
  const has = (syllable, character) => fileOf(syllable).some((f) => f.character === character);
  assert.equal(has("이", LI), true);
  assert.equal(has("리", LI), true);
  assert.equal(has("임", RIM), true); // 림 → 임
  assert.equal(has("녹", NOK), true); // 록 → 녹
  assert.equal(has("연", GYUN), true); // 대법원 목록의 지정 발음 '균,연'
  assert.equal(has("김", GEUM), true);
  assert.equal(has("금", GEUM), true);
  assert.equal(has("나", NA), true);
  assert.equal(has("라", NA), false); // 지정 독음 '나' 뿐인 글자를 '라' 칸에 받지 않는다
  assert.equal(has("서", YUN), false);
  assert.equal(has("유", LIU), true);
});

// ============================================================
// 주소 꼴 · API 꼴
// ============================================================

test("encodeHanjaParam: 끝의 * 를 빼고, 전부 자동이면 빈 문자열", () => {
  assert.equal(AUTO, "*");
  assert.equal(NONE, "-");
  const cases = [
    [[SEO, AUTO], SEO],
    [[AUTO, YUN], `*${YUN}`],
    [[SEO, NONE], `${SEO}-`],
    [[AUTO, NONE], "*-"],
    [[AUTO, AUTO], ""],
    [[SEO, AUTO, AUTO], SEO],
    [[SEO, AUTO, YUN], `${SEO}*${YUN}`],
    [[EXT_B, AUTO], EXT_B],
    [["", SEO], `*${SEO}`], // 빈 칸은 자동
    [[], ""],
  ];
  for (const [marks, expected] of cases) assert.equal(encodeHanjaParam(marks), expected);
});

test("decodeHanjaParam: 짧으면 * 로 채우고, 길거나 한자·표시 글자 밖이 섞이면 버린다", () => {
  const cases = [
    [SEO, 2, [SEO, AUTO]],
    [`*${YUN}`, 2, [AUTO, YUN]],
    [`${SEO}-`, 2, [SEO, NONE]],
    [SEO + YUN, 2, [SEO, YUN]],
    [SEO + YUN + YUN, 2, [AUTO, AUTO]], // 이름보다 길다 → 버림
    [`${SEO}a`, 2, [AUTO, AUTO]], // 한자·표시 글자 밖
    [`${SEO}서`, 2, [AUTO, AUTO]],
    [`${SEO}${U(0xfa6e)}`, 2, [AUTO, AUTO]], // 호환 블록의 배정되지 않은 코드
    [LI_COMPAT, 1, [LI]], // 호환 코드로 적힌 주소도 통합 한자로
    [` ${SEO} ${YUN} `, 2, [SEO, YUN]], // 공백은 정리에서 지운다
    [EXT_B, 2, [EXT_B, AUTO]], // BMP 밖 글자는 한 칸
    [EXT_B + SEO + YUN, 2, [AUTO, AUTO]],
    ["", 2, [AUTO, AUTO]],
    [null, 2, [AUTO, AUTO]],
    [undefined, 3, [AUTO, AUTO, AUTO]],
    [SEO, 0, []],
    ["**", 2, [AUTO, AUTO]],
  ];
  for (const [value, n, expected] of cases) {
    assert.deepEqual(decodeHanjaParam(value, n), expected, `${hex(value ?? "")} / ${n}`);
  }
  // 성씨에는 '한자 없이'가 없다
  assert.deepEqual(decodeHanjaParam("-", 1, { allowNone: false }), [AUTO]);
  assert.deepEqual(decodeHanjaParam(`${NAM}-`, 2, { allowNone: false }), [AUTO, AUTO]);
  assert.deepEqual(decodeHanjaParam(NAM, 2, { allowNone: false }), [NAM, AUTO]);
});

test("canonicalHanja·toApiHanja: 주소 꼴 왕복과 전체 길이 꼴", () => {
  for (const [value, n] of [[SEO, 2], [`*${YUN}`, 2], [`${SEO}-`, 2], [SEO + YUN, 2], [`${SEO}*${YUN}`, 3], ["", 2], [EXT_B, 2], ["*-", 2]]) {
    const canonical = canonicalHanja(value, n);
    assert.equal(canonical, value, hex(value));
    // 한 번에 수렴한다 — 다시 넣어도 같다
    assert.equal(canonicalHanja(canonical, n), canonical);
    assert.equal(encodeHanjaParam(decodeHanjaParam(canonical, n)), canonical);
  }
  assert.equal(canonicalHanja(`${SEO}*`, 2), SEO); // 끝의 * 생략
  assert.equal(canonicalHanja("**", 2), "");
  assert.equal(canonicalHanja(SEO + YUN + YUN, 2), ""); // 긴 값 버림
  assert.equal(canonicalHanja(LI_COMPAT, 1), LI);
  assert.equal(canonicalHanja("-", 1, { allowNone: false }), "");

  assert.equal(toApiHanja([SEO, AUTO]), `${SEO}*`); // 서버는 글자 수가 정확히 맞아야 받는다
  assert.equal(toApiHanja([AUTO, YUN]), `*${YUN}`);
  assert.equal(toApiHanja([SEO, NONE]), `${SEO}-`);
  assert.equal(toApiHanja([AUTO, AUTO]), "");
  assert.equal(toApiHanja([]), "");
});

test("apiHanjaFields: 지정이 없거나 이름·성씨가 한글 음절만이 아니면 필드를 싣지 않는다", () => {
  assert.deepEqual(apiHanjaFields({ name: "서윤", lastName: "이", hanja: SEO, lastHanja: "" }), { nameHanja: `${SEO}*` });
  assert.deepEqual(apiHanjaFields({ name: "서윤", lastName: "유", hanja: `${SEO}-`, lastHanja: LIU }), {
    nameHanja: `${SEO}-`,
    lastNameHanja: LIU,
  });
  assert.deepEqual(apiHanjaFields({ name: "민", lastName: "남궁", hanja: "", lastHanja: NAM }), { lastNameHanja: `${NAM}*` });
  assert.deepEqual(apiHanjaFields({ name: "서윤", lastName: "이", hanja: "", lastHanja: "" }), {});
  assert.deepEqual(apiHanjaFields({ name: "서윤", lastName: "이" }), {});
  // 한글 음절만이 아닌 이름·성씨 — 서버가 name_not_hangul 로 막는 입력이라 아예 보내지 않는다
  assert.deepEqual(apiHanjaFields({ name: "서ㅇ", lastName: "이", hanja: SEO, lastHanja: LI }), {});
  assert.deepEqual(apiHanjaFields({ name: "서윤", lastName: "", hanja: SEO, lastHanja: "" }), {});
  assert.deepEqual(apiHanjaFields({ name: "서윤", lastName: "Lee", hanja: SEO, lastHanja: "" }), {});
  // 길이가 안 맞는 값은 버린다
  assert.deepEqual(apiHanjaFields({ name: "서윤", lastName: "이", hanja: SEO + YUN + YUN, lastHanja: LI + LI }), {});
});

test("hanjaFromSummary: 응답의 정규 꼴(전체 길이) → 주소 꼴", () => {
  assert.deepEqual(hanjaFromSummary({ nameHanja: `${SEO}*`, lastNameHanja: "" }), { hanja: SEO, lastHanja: "" });
  assert.deepEqual(hanjaFromSummary({ nameHanja: `${SEO}-`, lastNameHanja: LIU }), { hanja: `${SEO}-`, lastHanja: LIU });
  assert.deepEqual(hanjaFromSummary({ nameHanja: "", lastNameHanja: "" }), { hanja: "", lastHanja: "" });
  assert.equal(hanjaFromSummary(null), null); // 옛 백엔드·한글 음절이 아닌 이름
  assert.equal(hanjaFromSummary(undefined), null);
});

// ============================================================
// 칸 상태 파생
// ============================================================

const view = (slots) => slots && slots.map((s) => [s.syllable, s.state, s.character, s.mark]);

test("deriveSlots: 조합 중간 값을 지나도 마지막 값만으로 정해진다 — ㅅ → 서 → 성 → 서유 → 서윤 + 들고 온 글자", () => {
  // /hanja 글자 상세가 만드는 링크의 해시를 그대로 읽은 값
  const pick = parsePickHash(new URL(evaluatePickHref(SEO, ["서"]), "https://example.invalid").hash);
  assert.deepEqual(pick, { character: SEO, readings: ["서"] });
  const files = filesFor("서");
  const steps = ["ㅅ", "서", "성", "서유", "서윤"].map((firstName) =>
    deriveSlots({ lastName: "이", firstName }, NO_CHOICES, pick, index, files)
  );
  assert.equal(steps[0].name, null); // 낱자모가 남은 값은 칸을 만들지 않는다(직전 칸 줄을 그대로 둔다)
  assert.deepEqual(view(steps[1].name), [["서", "carried", SEO, SEO]]);
  assert.deepEqual(view(steps[2].name), [["성", "auto", null, AUTO]]);
  assert.deepEqual(view(steps[3].name), [["서", "carried", SEO, SEO], ["유", "auto", null, AUTO]]);
  assert.deepEqual(view(steps[4].name), [["서", "carried", SEO, SEO], ["윤", "auto", null, AUTO]]);
  assert.equal(steps[4].name[0].fact.gloss, "상서 서");
  assert.equal(encodeHanjaParam(marksOf(steps[4].name)), SEO);
  // 중간 값을 거치지 않고 바로 계산한 것과 같다
  assert.deepEqual(steps[4], deriveSlots({ lastName: "이", firstName: "서윤" }, NO_CHOICES, pick, index, files));
  // 성씨 줄은 이름과 따로 선다
  assert.deepEqual(view(steps[0].surname), [["이", "default", LI, AUTO]]);
});

test("deriveSlots: 직접 고른 선택은 같은 자리·같은 음절이 돌아오면 되살아난다 — 서윤 → 서연 → 서윤", () => {
  const choices = new Map([[choiceKey("name", 1, "윤"), { kind: "hanja", fact: factOf("윤", YUN) }]]);
  const at = (firstName) => view(deriveSlots({ lastName: "", firstName }, choices, null, index, NO_FILES).name);
  assert.deepEqual(at("서윤"), [["서", "auto", null, AUTO], ["윤", "picked", YUN, YUN]]);
  assert.deepEqual(at("서연"), [["서", "auto", null, AUTO], ["연", "auto", null, AUTO]]);
  assert.deepEqual(at("서윤"), [["서", "auto", null, AUTO], ["윤", "picked", YUN, YUN]]);
  // 자리가 다르면 다른 칸이다
  assert.deepEqual(at("윤서"), [["윤", "auto", null, AUTO], ["서", "auto", null, AUTO]]);
  assert.equal(choiceKey("name", 1, "윤"), "name:1:윤");
  assert.notEqual(choiceKey("name", 1, "윤"), choiceKey("surname", 1, "윤"));
});

test("deriveSlots: 성·이름이 비면 빈 줄, 한글 음절만이 아니면 null", () => {
  const d = (lastName, firstName) => deriveSlots({ lastName, firstName }, NO_CHOICES, null, index, NO_FILES);
  assert.deepEqual(d("", ""), { surname: [], name: [] });
  assert.equal(d("이", "서ㅇ").name, null);
  assert.equal(d("이", "seo").name, null);
  assert.equal(d("ㅇ", "서윤").surname, null);
  assert.equal(d("ㅇ", "서윤").name.length, 2); // 이름 줄은 성씨와 무관하게 선다(/name 조합 링크는 성 없이 온다)
  assert.equal(d(" 이 ", " 서윤 ").name.length, 2); // 앞뒤 공백은 뗀다
});

test("deriveSlots: 잠긴 칸·쓸 글자 0자 칸은 * 로 보낸다 — '한빛'에서 아무것도 안 고르면 주소에 한자가 없다", () => {
  const hanbit = deriveSlots({ lastName: "김", firstName: "한빛" }, NO_CHOICES, null, index, NO_FILES);
  assert.deepEqual(view(hanbit.name), [["한", "auto", null, AUTO], ["빛", "locked", null, AUTO]]);
  assert.deepEqual(hanbit.name.map((s) => s.openable), [true, false]);
  assert.equal(encodeHanjaParam(marksOf(hanbit.name)), "");
  assert.equal(toApiHanja(marksOf(hanbit.name)), "");

  // 잠긴 칸에 '한자 없이'가 남아 있어도 * 다 — '-' 로 보내면 한자를 하나도 고르지 않은 이름이 지정 경로를 탄다
  const withNone = new Map([[choiceKey("name", 1, "빛"), { kind: "none" }]]);
  const still = deriveSlots({ lastName: "김", firstName: "한빛" }, withNone, null, index, NO_FILES);
  assert.deepEqual(view(still.name), [["한", "auto", null, AUTO], ["빛", "locked", null, AUTO]]);

  // 쓸 글자 0자 음절(자동 배정이 비는 음절 — index.json 의 autoEmpty): 화면은 '한글', 열 수는 있다
  assert.equal(index.syllables["몰"].autoEmpty, true);
  const mol = deriveSlots({ lastName: "김", firstName: "몰" }, new Map([[choiceKey("name", 0, "몰"), { kind: "none" }]]), null, index, NO_FILES);
  assert.deepEqual(view(mol.name), [["몰", "hangul", null, AUTO]]);
  assert.equal(mol.name[0].openable, true);
});

test("deriveSlots: 사용자가 고른 '한자 없이'만 - 로 보낸다", () => {
  const choices = new Map([[choiceKey("name", 1, "윤"), { kind: "none" }]]);
  const slots = deriveSlots({ lastName: "이", firstName: "서윤" }, choices, null, index, NO_FILES);
  assert.deepEqual(view(slots.name), [["서", "auto", null, AUTO], ["윤", "none", null, NONE]]);
  assert.equal(encodeHanjaParam(marksOf(slots.name)), "*-");
  assert.equal(toApiHanja(marksOf(slots.name)), "*-");

  const both = new Map([
    [choiceKey("name", 0, "서"), { kind: "hanja", fact: factOf("서", SEO) }],
    [choiceKey("name", 1, "윤"), { kind: "none" }],
  ]);
  const picked = deriveSlots({ lastName: "이", firstName: "서윤" }, both, null, index, NO_FILES);
  assert.equal(encodeHanjaParam(marksOf(picked.name)), `${SEO}-`);
});

test("deriveSlots: 성씨 줄 — 대표 한자·표에 없는 성씨·복성·고른 글자", () => {
  const d = (lastName, choices = NO_CHOICES) =>
    deriveSlots({ lastName, firstName: "" }, choices, null, index, NO_FILES).surname;
  assert.deepEqual(view(d("김")), [["김", "default", GEUM, AUTO]]);
  assert.deepEqual(view(d("유")), [["유", "default", RYU, AUTO]]);
  assert.deepEqual(view(d("남궁")), [["남", "default", NAM, AUTO], ["궁", "default", GUNG, AUTO]]);
  // 기본 상태의 성씨는 아무것도 보내지 않는다
  assert.equal(encodeHanjaParam(marksOf(d("남궁"))), "");
  // 대표 한자 표에 없는 성씨는 '자동'
  assert.equal("곤" in index.surnames, false);
  assert.deepEqual(view(d("곤")), [["곤", "auto", null, AUTO]]);
  // 그 음절로 읽는 한자가 사전에 없는 성씨 음절은 잠긴다
  assert.deepEqual(view(d("궉")), [["궉", "locked", null, AUTO]]);

  // 고른 글자 — 이름용 표시(이름에 피하는 글자)는 떼어 싣는다
  const liu = factOf("유", LIU);
  assert.equal(liu.forbidden, true);
  const picked = d("유", new Map([[choiceKey("surname", 0, "유"), { kind: "hanja", fact: liu }]]));
  assert.deepEqual(view(picked), [["유", "picked", LIU, LIU]]);
  assert.equal(picked[0].fact.forbidden, false);
  assert.equal(picked[0].fact.common, false);
  assert.equal(picked[0].fact.strokeCount, 15);
  assert.equal(liu.forbidden, true); // 넘겨받은 값은 바꾸지 않는다

  // 복성에서 한 글자만 고르면 나머지 자리는 * 로 간다(서버가 기본 한자로 채운다)
  const one = d("남궁", new Map([[choiceKey("surname", 0, "남"), { kind: "hanja", fact: factOf("남", NAM) }]]));
  assert.equal(toApiHanja(marksOf(one)), `${NAM}*`);
  // 성씨에는 '한자 없이'가 없다 — 남아 있어도 무시한다
  assert.deepEqual(view(d("김", new Map([[choiceKey("surname", 0, "김"), { kind: "none" }]]))), [["김", "default", GEUM, AUTO]]);
});

test("deriveSlots: 들고 온 글자 — 파일을 못 받았으면 '확인 중', 파일에 없으면 넣지 않는다, 한 칸에만 들어간다", () => {
  const pick = { character: SEO, readings: ["서"] };
  // 파일을 아직 못 받음
  const waiting = deriveSlots({ lastName: "", firstName: "서서" }, NO_CHOICES, pick, index, NO_FILES);
  assert.deepEqual(view(waiting.name), [["서", "checking", null, AUTO], ["서", "auto", null, AUTO]]);
  // 받은 뒤 — 앞 자리 한 칸에만
  const placed = deriveSlots({ lastName: "", firstName: "서서" }, NO_CHOICES, pick, index, filesFor("서"));
  assert.deepEqual(view(placed.name), [["서", "carried", SEO, SEO], ["서", "auto", null, AUTO]]);
  // 앞 자리를 직접 골랐으면 그 선택이 먼저다 — 들고 온 글자는 다음 맞는 칸으로
  const seoFile = fileOf("서");
  const other = seoFile.find((f) => f.character !== SEO);
  const chosen = deriveSlots(
    { lastName: "", firstName: "서서" },
    new Map([[choiceKey("name", 0, "서"), { kind: "hanja", fact: other }]]),
    pick,
    index,
    filesFor("서")
  );
  assert.deepEqual(view(chosen.name), [["서", "picked", other.character, other.character], ["서", "carried", SEO, SEO]]);
  // [자동으로 고르기]를 고른 칸에는 들고 온 글자가 다시 들어오지 않는다
  const backToAuto = deriveSlots(
    { lastName: "", firstName: "서윤" },
    new Map([[choiceKey("name", 0, "서"), { kind: "auto" }]]),
    pick,
    index,
    filesFor("서")
  );
  assert.deepEqual(view(backToAuto.name), [["서", "auto", null, AUTO], ["윤", "auto", null, AUTO]]);

  // 손으로 고친 주소 — 그 음절 파일에 없는 글자는 넣지 않는다(판정은 독음 낱말이 아니라 파일이 한다)
  const forged = deriveSlots({ lastName: "", firstName: "서윤" }, NO_CHOICES, { character: YUN, readings: ["서"] }, index, filesFor("서"));
  assert.deepEqual(view(forged.name), [["서", "auto", null, AUTO], ["윤", "auto", null, AUTO]]);

  // 본음 독음의 글자는 두음 꼴 칸에도 들어간다(록 → 녹)
  const dueum = deriveSlots({ lastName: "", firstName: "녹현" }, NO_CHOICES, { character: NOK, readings: ["록"] }, index, filesFor("녹"));
  assert.deepEqual(view(dueum.name)[0], ["녹", "carried", NOK, NOK]);
  // 들어갈 음절이 이름에 없으면 그대로
  const none = deriveSlots({ lastName: "", firstName: "지우" }, NO_CHOICES, pick, index, filesFor("서"));
  assert.deepEqual(view(none.name), [["지", "auto", null, AUTO], ["우", "auto", null, AUTO]]);
  // 성씨 칸에는 들어가지 않는다
  const surname = deriveSlots({ lastName: "서", firstName: "" }, NO_CHOICES, pick, index, filesFor("서"));
  assert.equal(surname.surname[0].state, "default");
});

test("deriveSlots: 색인을 아직 못 받았으면 기본 상태를 모두 '자동'으로 둔다", () => {
  const slots = deriveSlots({ lastName: "김", firstName: "한빛" }, NO_CHOICES, null, null, NO_FILES);
  assert.deepEqual(view(slots.surname), [["김", "auto", null, AUTO]]);
  assert.deepEqual(view(slots.name), [["한", "auto", null, AUTO], ["빛", "auto", null, AUTO]]);
  assert.deepEqual(slots.name.map((s) => s.openable), [true, true]);
});

test("pickSyllablesIn·confirmedPickReadings: 받을 파일과 띠에 적을 독음", () => {
  const li = { character: LI, readings: ["리", "이"] };
  assert.deepEqual(pickSyllablesIn(li, "이리"), ["이", "리"]);
  assert.deepEqual(pickSyllablesIn(li, "서이"), ["이"]);
  assert.deepEqual(pickSyllablesIn(li, "서윤"), []);
  assert.deepEqual(pickSyllablesIn({ character: NOK, readings: ["록"] }, "녹녹"), ["녹"]);

  // 파일로 확인된 독음만 — 주소에 적힌 낱말을 그대로 옮기지 않는다
  assert.deepEqual(confirmedPickReadings(li, filesFor("리", "이")), { ready: true, readings: ["리", "이"] });
  assert.deepEqual(confirmedPickReadings(li, filesFor("리")), { ready: false, readings: ["리"] });
  assert.deepEqual(confirmedPickReadings({ character: LI, readings: ["리", "서"] }, filesFor("리", "서")), { ready: true, readings: ["리"] });
  // 손으로 고친 주소 — 다 받았는데 하나도 없으면 버린다
  assert.deepEqual(confirmedPickReadings({ character: YUN, readings: ["서"] }, filesFor("서")), { ready: true, readings: [] });
});

// ============================================================
// 주소로 온 한자의 검사 · 붙여넣기
// ============================================================

test("checkSeed: 주소로 온 한자를 칸마다 그 음절 파일로 검사한다", () => {
  const files = filesFor("서", "윤", "유");
  const statuses = (checks) => checks.map((c) => c.status);
  assert.deepEqual(statuses(checkSeed("name", "서윤", SEO, files)), ["ok", "auto"]);
  assert.equal(checkSeed("name", "서윤", SEO, files)[0].fact.gloss, "상서 서");
  assert.deepEqual(statuses(checkSeed("name", "서윤", SEO + YUN, files)), ["ok", "ok"]);
  assert.deepEqual(statuses(checkSeed("name", "서윤", `${SEO}-`, files)), ["ok", "none"]);
  // 그 음절 후보에 없는 글자 — 화면이 칸을 비우고 알린다
  assert.deepEqual(checkSeed("name", "서윤", YUN, files), [{ status: "rejected", character: YUN }, { status: "auto" }]);
  // 파일을 아직 못 받음
  assert.deepEqual(checkSeed("name", "서윤", SEO + YUN, filesFor("서"))[1], { status: "pending", character: YUN });
  // 버릴 값(길다)은 전부 자동
  assert.deepEqual(statuses(checkSeed("name", "서윤", SEO + YUN + YUN, files)), ["auto", "auto"]);
  // 성씨 — 이름용 표시를 떼고, '-' 는 받지 않는다
  const surname = checkSeed("surname", "유", LIU, files);
  assert.equal(surname[0].status, "ok");
  assert.equal(surname[0].fact.forbidden, false);
  assert.deepEqual(statuses(checkSeed("surname", "유", "-", files)), ["auto"]);
  // 한글 음절만이 아니면 칸이 없다
  assert.equal(checkSeed("name", "서ㅇ", SEO, files), null);
  assert.equal(checkSeed("name", "", SEO, files), null);
});

test("seedChoices: 주소로 온 한자 → 칸 선택 — 맞는 글자만 선택이 되고, 맞지 않는 글자·기다리는 칸은 따로 돌려준다", () => {
  const files = filesFor("서", "윤", "유");
  // /name 조합 링크 꼴 — 성 없이 이름과 한자만
  const combo = seedChoices({ lastName: "", firstName: "서윤", hanja: SEO + YUN }, files);
  assert.deepEqual([...combo.choices.keys()], [choiceKey("name", 0, "서"), choiceKey("name", 1, "윤")]);
  assert.equal(combo.choices.get(choiceKey("name", 0, "서")).fact.gloss, "상서 서");
  assert.deepEqual(combo.pending, []);
  assert.deepEqual(combo.rejected, []);
  // 그 선택으로 칸을 파생하면 고른 한자로 선다(직접 고른 것과 같은 꼴)
  const derived = deriveSlots({ lastName: "", firstName: "서윤" }, combo.choices, null, index, files);
  assert.deepEqual(marksOf(derived.name), [SEO, YUN]);
  assert.deepEqual(derived.name.map((s) => s.state), ["picked", "picked"]);

  // 자동(*)은 선택이 아니고, '-' 는 '한자 없이', 맞지 않는 글자는 rejected(칸은 비어 자동이 된다)
  const mixed = seedChoices({ lastName: "유", firstName: "서윤", hanja: `${YUN}-`, lastHanja: LIU }, files);
  assert.deepEqual(mixed.choices.get(choiceKey("name", 1, "윤")), { kind: "none" });
  assert.equal(mixed.choices.has(choiceKey("name", 0, "서")), false);
  assert.deepEqual(mixed.rejected, [{ key: choiceKey("name", 0, "서"), target: "name", index: 0, syllable: "서", character: YUN }]);
  // 성씨 한자 — 이름용 표시를 뗀 글자 사실
  const liu = mixed.choices.get(choiceKey("surname", 0, "유"));
  assert.equal(liu.kind, "hanja");
  assert.equal(liu.fact.character, LIU);
  assert.equal(liu.fact.forbidden, false);
  assert.equal(seedChoices({ lastName: "", firstName: "서윤", hanja: "*" + YUN }, files).choices.size, 1);

  // 음절 파일을 아직 못 받은 칸은 pending — 선택도 거절도 아니다
  const waiting = seedChoices({ lastName: "", firstName: "서윤", hanja: SEO + YUN }, filesFor("서"));
  assert.deepEqual([...waiting.choices.keys()], [choiceKey("name", 0, "서")]);
  assert.deepEqual(waiting.pending, [{ key: choiceKey("name", 1, "윤"), target: "name", index: 1, syllable: "윤", character: YUN }]);
  assert.deepEqual(waiting.rejected, []);

  // 한자가 없거나, 한글 음절만이 아닌 쪽은 건너뛴다(다른 쪽은 그대로 읽는다)
  assert.equal(seedChoices({ lastName: "이", firstName: "서윤" }, files).choices.size, 0);
  assert.equal(seedChoices({ lastName: "이", firstName: "서ㅇ", hanja: SEO }, files).choices.size, 0);
  const half = seedChoices({ lastName: "유", firstName: "서ㅇ", hanja: SEO, lastHanja: LIU }, files);
  assert.deepEqual([...half.choices.keys()], [choiceKey("surname", 0, "유")]);
  // 길이가 안 맞는 값은 통째로 버린다
  const long = seedChoices({ lastName: "", firstName: "서윤", hanja: SEO + YUN + YUN }, files);
  assert.equal(long.choices.size + long.pending.length + long.rejected.length, 0);
});

test("surnameDefaultAt: 성씨의 그 자리에 기본으로 두는 한자 — 색인의 대표 한자 표, 없으면 null", () => {
  assert.equal(surnameDefaultAt(index, "이", 0), LI);
  assert.equal(surnameDefaultAt(index, "유", 0), RYU);
  assert.equal(surnameDefaultAt(index, " 유 ", 0), RYU, "앞뒤 공백은 뗀다");
  // 복성은 자리마다
  assert.equal(surnameDefaultAt(index, "남궁", 0), NAM);
  assert.equal(surnameDefaultAt(index, "남궁", 1), GUNG);
  assert.equal(surnameDefaultAt(index, "남궁", 2), null);
  // 표에 없는 성씨·빈 값·색인을 못 받았을 때
  assert.equal(surnameDefaultAt(index, "궉", 0), null);
  assert.equal(surnameDefaultAt(index, "", 0), null);
  assert.equal(surnameDefaultAt(null, "이", 0), null);
  assert.equal(surnameDefaultAt(undefined, "이", 0), null);
  // 표의 글자 수가 성씨 글자 수와 다르면 자리로 읽지 않는다(두 음절 성씨에 한 글자만 적힌 표 — 첫 자리에 그 글자를 넣지 않는다)
  const lopsided = { ...index, surnames: { ...index.surnames, 가나: NAM, 다: NAM + GUNG } };
  assert.equal(surnameDefaultAt(lopsided, "가나", 0), null);
  assert.equal(surnameDefaultAt(lopsided, "가나", 1), null);
  assert.equal(surnameDefaultAt(lopsided, "다", 0), null);
  // 객체의 기본 속성 이름을 성씨 표의 항목으로 읽지 않는다
  assert.equal(surnameDefaultAt(index, "constructor", 0), null);
  assert.equal(surnameDefaultAt(index, "toString", 0), null);
  // deriveSlots 의 성씨 기본 한자와 같은 값이다(표의 161 성씨 전수)
  for (const name of Object.keys(index.surnames)) {
    const derived = deriveSlots({ lastName: name, firstName: "" }, NO_CHOICES, null, index, NO_FILES);
    assert.deepEqual(derived.surname.map((s) => s.character), [...name].map((_, i) => surnameDefaultAt(index, name, i)), name);
  }
});

test("spreadPaste: 그 칸부터 차례로 — 성씨에서 시작하면 이름으로 넘어가고, 후보에 없는 자리는 건너뛴다", () => {
  const derived = deriveSlots({ lastName: "유", firstName: "서윤" }, NO_CHOICES, null, index, NO_FILES);
  const slots = [...derived.surname, ...derived.name];
  const files = filesFor("유", "서", "윤");
  const brief = (r) => r.steps.map((s) => [s.position, s.slot.syllable, s.status, s.fact?.character ?? null]);

  const all = spreadPaste(slots, 0, [LIU, SEO, YUN], files);
  assert.deepEqual(brief(all), [[0, "유", "placed", LIU], [1, "서", "placed", SEO], [2, "윤", "placed", YUN]]);
  assert.deepEqual(all.dropped, []);
  assert.equal(all.steps[0].fact.forbidden, false); // 성씨 칸에 넣는 글자는 이름용 표시를 뗀다
  assert.equal(all.steps[0].slot.target, "surname");

  // 이름 첫 칸부터 — 남는 글자는 dropped
  const overflow = spreadPaste(slots, 1, [SEO, YUN, LI], files);
  assert.deepEqual(brief(overflow), [[1, "서", "placed", SEO], [2, "윤", "placed", YUN]]);
  assert.deepEqual(overflow.dropped, [LI]);

  // 자리가 뒤바뀐 붙여넣기 — 두 칸 다 건너뛴다(자리를 옮겨 맞추지 않는다)
  const swapped = spreadPaste(slots, 1, [YUN, SEO], files);
  assert.deepEqual(brief(swapped), [[1, "서", "rejected", null], [2, "윤", "rejected", null]]);

  // 파일을 아직 못 받은 자리
  const pending = spreadPaste(slots, 1, [SEO, YUN], filesFor("서"));
  assert.deepEqual(brief(pending), [[1, "서", "placed", SEO], [2, "윤", "pending", null]]);

  // 잠긴 칸
  const hanbit = deriveSlots({ lastName: "", firstName: "한빛" }, NO_CHOICES, null, index, NO_FILES).name;
  const han = fileOf("한")[0].character;
  const locked = spreadPaste(hanbit, 0, [han, SEO], filesFor("한"));
  assert.deepEqual(brief(locked), [[0, "한", "placed", han], [1, "빛", "locked", null]]);

  assert.deepEqual(spreadPaste(slots, 0, [], files), { steps: [], dropped: [] });
  assert.deepEqual(spreadPaste(slots, 9, [SEO], files), { steps: [], dropped: [SEO] });
});

// ============================================================
// 들어오는 길 — 링크·해시
// ============================================================

test("evaluatePickHref: 쿼리(?) 없이 해시로만, 독음을 함께 싣는다", () => {
  assert.equal(evaluatePickHref(SEO, ["서"]), `/evaluate#pick=${encodeURIComponent(SEO)}&as=${encodeURIComponent("서")}`);
  assert.equal(evaluatePickHref(LI, ["리", "이"]), `/evaluate#pick=${encodeURIComponent(LI)}&as=${encodeURIComponent("리")},${encodeURIComponent("이")}`);
  for (const href of [evaluatePickHref(SEO, ["서"]), evaluatePickHref(GYUN, ["균", "연"]), evaluatePickHref(EXT_B, ["계"]), evaluatePickHref(SEO, [])]) {
    assert.ok(!href.includes("?"), href);
    assert.ok(href.startsWith("/evaluate#pick="), href);
    assert.match(href, /^[\x21-\x7e]+$/); // 퍼센트 인코딩된 ASCII 만
  }
  // 한글 음절 한 글자가 아닌 독음은 싣지 않는다
  assert.equal(evaluatePickHref(SEO, ["서울", "", "서"]), evaluatePickHref(SEO, ["서"]));
});

test("parsePickHash: pick= 으로 시작하는 해시만 읽고, as 의 한글 음절 한 글자만 독음으로 받는다", () => {
  const cases = [
    [`#pick=${SEO}&as=서`, { character: SEO, readings: ["서"] }],
    [`pick=${SEO}&as=서`, { character: SEO, readings: ["서"] }], // # 없이 와도
    [`#pick=${LI}&as=리,이`, { character: LI, readings: ["리", "이"] }],
    [evaluatePickHref(GYUN, ["균", "연"]).slice("/evaluate".length), { character: GYUN, readings: ["균", "연"] }], // 퍼센트 인코딩 왕복
    [evaluatePickHref(EXT_B, ["계"]).slice("/evaluate".length), { character: EXT_B, readings: ["계"] }],
    [`#pick=${LI_COMPAT}&as=이`, { character: LI, readings: ["이"] }], // 호환 코드 → 통합 한자
    [`#pick=${SEO}&as=서울,서`, { character: SEO, readings: ["서"] }], // 두 글자 낱말은 무시
    [`#pick=${SEO}&as=서,서, 서 ,윤`, { character: SEO, readings: ["서", "윤"] }], // 중복·공백
    [`#pick=${SEO}&as=가,나,다,라,마,바`, { character: SEO, readings: ["가", "나", "다", "라"] }], // 최대 4개
    [`#pick=${SEO}`, null], // as 없음
    [`#pick=${SEO}&as=`, null],
    [`#pick=${SEO}&as=seo,ㅅ,서울`, null], // 읽을 독음이 하나도 없음
    [`#pick=${SEO}${YUN}&as=서`, null], // 두 글자
    ["#pick=a&as=서", null],
    ["#pick=서&as=서", null],
    [`#pick=${U(0xfa6e)}&as=서`, null],
    ["#pick=&as=서", null],
    ["#hanja-guide", null], // 다른 해시는 건드리지 않는다
    [`#x=1&pick=${SEO}&as=서`, null],
    ["#", null],
    ["", null],
    [null, null],
    [undefined, null],
  ];
  for (const [hash, expected] of cases) assert.deepEqual(parsePickHash(hash), expected, String(hash));
});

test("evaluateComboHref: 이름과 한자 조합 — 성·성별은 싣지 않는다", () => {
  assert.equal(evaluateComboHref("서윤", SEO + YUN), `/evaluate?${new URLSearchParams({ name: "서윤", hanja: SEO + YUN })}`);
  assert.equal(evaluateComboHref("서윤", SEO), `/evaluate?${new URLSearchParams({ name: "서윤", hanja: SEO })}`);
  // 길이가 안 맞거나 한자가 아닌 값은 이름만
  assert.equal(evaluateComboHref("서윤", SEO + YUN + YUN), `/evaluate?${new URLSearchParams({ name: "서윤" })}`);
  assert.equal(evaluateComboHref("서윤", "ab"), `/evaluate?${new URLSearchParams({ name: "서윤" })}`);
  assert.equal(evaluateComboHref("서윤", ""), `/evaluate?${new URLSearchParams({ name: "서윤" })}`);
  const params = new URLSearchParams(evaluateComboHref("서윤", SEO + YUN).split("?")[1]);
  assert.deepEqual([...params.keys()], ["name", "hanja"]);
});

// C7 진입 링크 — 정적 쪽(/hanja 글자 상세 · /name 조합 카드)이 만드는 링크 전부가 이름 평가에서 그대로 읽히는지, 데이터 전체로 본다.
// 쪽 파일이 이 함수를 그 인자로 부르는지는 evaluate-hanja-pages.test.mjs 가 원문으로 본다.
const hanjaSeo = () => JSON.parse(read("../src/data/hanja-seo.json"));

test("/hanja 글자 상세의 '맞춰 보기' — 피하는 글자가 아닌 상세 글자 전부: 해시가 글자와 독음 전부로 되읽히고, 그 독음의 음절 파일마다 글자가 있다", () => {
  const seo = hanjaSeo();
  const inFile = new Map();
  const has = (syllable, character) => {
    if (!inFile.has(syllable)) {
      const path = here(`../public${syllableFile(syllable)}`);
      inFile.set(syllable, existsSync(path) ? new Set(parsePickFile(JSON.parse(readFileSync(path, "utf8"))).map((f) => f.character)) : new Set());
    }
    return inFile.get(syllable).has(character);
  };
  let linked = 0;
  let outsideBmp = 0;
  const wrong = [];
  for (const [character, record] of Object.entries(seo)) {
    if (!(record.m && record.s) || record.nf === 1) continue; // 상세 쪽이 없거나(hasDetailPage) 배너가 없는(피하는 글자) 글자
    linked++;
    if ((character.codePointAt(0) ?? 0) > 0xffff) outsideBmp++;
    const href = evaluatePickHref(character, record.r);
    const pick = parsePickHash(new URL(href, "https://example.invalid").hash);
    if (!pick || pick.character !== character || pick.readings.join() !== record.r.join()) wrong.push(`${hex(character)} ${href}`);
    else if (!pick.readings.every((r) => has(r, character))) wrong.push(`${hex(character)} 음절 파일에 없음 ${pick.readings}`);
  }
  assert.deepEqual(wrong.slice(0, 10), []);
  // 지금 데이터의 규모 — 상세 9,016자 중 피하는 글자 991자를 뺀 수, 그중 BMP 밖(추천 버튼 없이 이 버튼만)
  assert.ok(linked > 8000, `링크 ${linked}자`);
  assert.ok(outsideBmp > 0, "BMP 밖 글자가 한 자도 없다 — 새 버튼만 남는 경로를 보지 못한다");
  // 독음 둘(均 균·연)은 둘 다, 가장 많은 독음 수도 넉 줄을 넘지 않는다(링크가 버리는 독음이 없다)
  assert.deepEqual(seo[GYUN].r, ["균", "연"]);
  assert.ok(Math.max(...Object.values(seo).map((r) => r.r.length)) <= 4);
});

test("/name 조합 카드의 '이 한자로 평가' — 수록 이름의 조합 전부가 이름만으로 떨어지지 않고 그 조합 그대로 실린다", () => {
  const { names } = JSON.parse(read("../src/data/name-seo.json"));
  let combos = 0;
  const wrong = [];
  for (const [name, record] of Object.entries(names)) {
    if (record.pk) continue; // 순우리말 사전 이름의 참고 조합에는 링크가 없다
    for (const combo of record.combos ?? []) {
      combos++;
      const params = new URLSearchParams(evaluateComboHref(name, combo.join("")).split("?")[1]);
      if (params.get("name") !== name || params.get("hanja") !== combo.join("") || [...params.keys()].join() !== "name,hanja") {
        wrong.push(`${name} ${hex(combo.join(""))}`);
      }
    }
  }
  assert.deepEqual(wrong.slice(0, 10), []);
  assert.ok(combos > 10000, `조합 ${combos}개`);
});

// ============================================================
// 고르기 패널의 목록
// ============================================================

test("sortForSurname: 대표 한자 맨 앞, 기본 영역·획수·코드포인트 순 — 이름용 표시로 뒤로 밀지 않는다", () => {
  const file = fileOf("유");
  const before = file.map((f) => f.character);
  const sorted = sortForSurname(file, index.surnames["유"]);
  assert.deepEqual(file.map((f) => f.character), before); // 받은 목록은 건드리지 않는다
  assert.equal(sorted.length, file.length);
  assert.equal(sorted[0].character, RYU);

  // 대표 한자 뒤는 (기본 영역 먼저, 획수, 코드포인트) 오름차순 — 독립 비교
  const rank = (f) => [f.basic ? 0 : 1, f.strokeCount, f.character.codePointAt(0)];
  for (let i = 2; i < sorted.length; i++) {
    const [a, b] = [rank(sorted[i - 1]), rank(sorted[i])];
    const ordered = a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];
    assert.ok(ordered, `${i}번째 순서`);
  }

  // 성씨 '유'의 다른 한자(이름용으로는 '이름에 피하는 글자' — 이름 패널이면 접힌 묶음, 파일에서는 뒤쪽)가 획수 자리에 있다
  const liu = sorted.find((f) => f.character === LIU);
  assert.equal(liu.forbidden, true);
  assert.equal(liu.strokeCount, 15);
  const at = sorted.indexOf(liu);
  const expectedAt = 1 + file.filter((f) => f.character !== RYU && f.basic && (f.strokeCount < 15 || (f.strokeCount === 15 && f.character.codePointAt(0) < 0x5289))).length;
  assert.equal(at, expectedAt);
  assert.ok(at < before.indexOf(LIU), "파일 순서(이름 칸용)보다 앞으로 온다");
  // 기본 영역 밖 글자는 맨 뒤
  const firstExt = sorted.findIndex((f) => !f.basic);
  assert.ok(firstExt > at);
  assert.ok(sorted.slice(firstExt).every((f) => !f.basic));

  // 대표 한자가 없으면(표에 없는 성씨) 같은 순서에 맨 앞 고정만 없다
  const noRep = sortForSurname(file, null);
  assert.deepEqual(noRep.map((f) => f.character).filter((c) => c !== RYU), sorted.slice(1).map((f) => f.character));
});

test("filterCandidates: 훈 부분 일치·글자 일치·오행 — 받아 둔 목록 안에서만", () => {
  const file = fileOf("서");
  const chars = (list) => list.map((f) => f.character);

  assert.deepEqual(chars(filterCandidates(file, {})), chars(file));
  assert.deepEqual(chars(filterCandidates(file, { query: "   " })), chars(file));

  const byGloss = filterCandidates(file, { query: "상서" });
  assert.ok(chars(byGloss).includes(SEO));
  assert.ok(byGloss.length < file.length);
  assert.ok(byGloss.every((f) => f.gloss.includes("상서")));
  // 순서는 그대로
  assert.deepEqual(chars(byGloss), chars(file).filter((c) => chars(byGloss).includes(c)));

  assert.deepEqual(chars(filterCandidates(file, { query: SEO })), [SEO]); // 글자로 찾기
  assert.deepEqual(chars(filterCandidates(file, { query: ` ${SEO} ` })), [SEO]);
  assert.deepEqual(filterCandidates(file, { query: YUN }), []); // 이 음절 목록에 없는 글자
  assert.deepEqual(filterCandidates(file, { query: "없는말없는말" }), []);

  const metal = filterCandidates(file, { element: "金" });
  assert.ok(metal.length > 0 && metal.length < file.length);
  assert.ok(metal.every((f) => f.fiveElement === "金"));
  assert.equal(metal.length, file.filter((f) => f.fiveElement === "金").length);

  // 두 조건을 함께
  assert.deepEqual(chars(filterCandidates(file, { query: "상서", element: "金" })), chars(byGloss.filter((f) => f.fiveElement === "金")));
  assert.deepEqual(filterCandidates(file, { query: SEO, element: "木" }), []);

  // 호환 코드로 넣어도 통합 한자로 맞춘다
  assert.deepEqual(chars(filterCandidates(fileOf("이"), { query: LI_COMPAT })), [LI]);

  // 찾기는 접힌 묶음(이름에 피하는 글자)까지 본다 — 표시는 그대로 달고 나온다
  const found = filterCandidates(fileOf("유"), { query: LIU });
  assert.equal(found.length, 1);
  assert.equal(found[0].forbidden, true);
});

test("groupCandidates: 먼저 보여 드리는 글자 · 그 밖의 글자 · 이름에 피하는 글자와 뜻 풀이 없는 글자", () => {
  const fact = (character, flags) => ({ ...toHanjaFact({ character, gloss: "훈", fiveElement: "木", resourceGrade: "R", strokeCount: 8, yinYang: "陰" }), ...flags });
  const a = fact(SEO, { common: true, hasMeaning: true });
  const b = fact(YUN, { hasMeaning: true });
  const c = fact(LIU, { forbidden: true, hasMeaning: true, common: true }); // 피하는 글자는 '먼저 보여 드리는' 표시가 있어도 ③
  const d = fact(NOK, {}); // 뜻 풀이 없음
  const e = fact(RIM, { hasMeaning: true });
  assert.deepEqual(groupCandidates([a, b, c, d, e]), { common: [a], others: [b, e], avoided: [c, d] });
  assert.deepEqual(groupCandidates([]), { common: [], others: [], avoided: [] });

  const yu = groupCandidates(fileOf("유"));
  assert.ok(yu.avoided.some((f) => f.character === LIU));
  assert.equal(yu.common.length + yu.others.length, index.syllables["유"].usable);
});

test("asSurnameFact: 이름용 표시만 뗀다", () => {
  const liu = factOf("유", LIU);
  const stripped = asSurnameFact(liu);
  assert.deepEqual(stripped, { ...liu, forbidden: false, common: false });
  const ryu = factOf("유", RYU);
  assert.equal(asSurnameFact(ryu), ryu); // 뗄 것이 없으면 그대로
});

// ============================================================
// 결과 화면 — 비교 줄의 사실 · 블록에 그릴 글자
// ============================================================

test("comboFacts: 자원오행·음양·앞 두 글자 획수 합 — 사실만(어림값을 지어내지 않는다)", () => {
  const seo = factOf("서", SEO); // 金 13획 陽
  const yun = factOf("윤", YUN); // 水 15획 陽
  assert.deepEqual(comboFacts([seo, yun]), { elements: ["金", "水"], yinYang: ["陽", "陽"], strokeSum: 28 });
  assert.deepEqual(comboFacts([seo, null]), { elements: ["金", ""], yinYang: ["陽", ""], strokeSum: null });
  assert.deepEqual(comboFacts([seo]), { elements: ["金"], yinYang: ["陽"], strokeSum: null });
  // 셋째 글자는 획수 합에 들지 않는다(획수 조화는 앞 두 글자만 본다)
  assert.equal(comboFacts([seo, yun, seo]).strokeSum, 28);
  assert.deepEqual(comboFacts([]), { elements: [], yinYang: [], strokeSum: null });
});

/** 응답의 hanjaSummary 꼴 — 2026-11-19 로컬 서버 응답에서 옮긴 값(이서윤, 2025-03-02, 여) */
function summaryFixture() {
  const fit = { yongshin: "土", heeshin: "火", gishin: "木", lacking: ["土", "金", "水"], excessive: ["木", "火"], counts: { 木: 2, 火: 2, 土: 1, 金: 1, 水: 0 } };
  const li = asSurnameFact(factOf("이", LI));
  const seoAuto = fileOf("서")[0]; // 자동으로 고른 글자(火)
  const yunAuto = fileOf("윤").find((f) => f.fiveElement === "土");
  return {
    userHanja: false,
    nameHanja: "",
    lastNameHanja: "",
    surname: { hangul: "이", source: "default", strokes: 7, chars: [li] },
    syllables: [
      { syllable: "서", source: "auto", fills: rolesOf(seoAuto.fiveElement, fit), hanja: seoAuto },
      { syllable: "윤", source: "auto", fills: rolesOf(yunAuto.fiveElement, fit), hanja: yunAuto },
    ],
    elementFit: fit,
  };
}

test("blockView: 대기 중이 아니면 마지막으로 계산된 응답의 글자 그대로 — 재계산이 실패하면 여기로 되돌아간다", () => {
  const shown = summaryFixture();
  const snapshot = JSON.stringify(shown);
  for (const pending of [null, undefined]) {
    const v = blockView(shown, pending);
    assert.equal(v.waiting, false);
    assert.deepEqual(v.syllables.map((s) => [s.syllable, s.source, s.hanja?.character ?? null, s.fills, s.waiting]),
      shown.syllables.map((s) => [s.syllable, s.source, s.hanja.character, s.fills, false]));
    assert.deepEqual(v.surname, { hangul: "이", source: "default", chars: shown.surname.chars, waiting: false });
    assert.equal(v.elementFit, shown.elementFit);
  }
  assert.equal(JSON.stringify(shown), snapshot); // 응답을 고치지 않는다
});

test("blockView: 대기 중 — 고른 칸은 바로 바뀌고(역할은 elementFit 으로), 자동 칸은 직전 글자에 '다시 고르는 중'", () => {
  const shown = summaryFixture();
  const seo = factOf("서", SEO); // 金 — 이 사주에서는 부족한 오행
  const v = blockView(shown, { name: { 0: { kind: "hanja", fact: seo } }, surname: {} });
  assert.equal(v.waiting, true);
  assert.deepEqual(v.syllables[0], { syllable: "서", source: "user", hanja: seo, fills: ["lacking"], waiting: false });
  // 자동 칸은 직전 응답의 글자를 둔 채 대기 표시
  assert.equal(v.syllables[1].hanja, shown.syllables[1].hanja);
  assert.equal(v.syllables[1].source, "auto");
  assert.equal(v.syllables[1].waiting, true);
  assert.deepEqual(v.surname, { hangul: "이", source: "default", chars: shown.surname.chars, waiting: false });

  // 한자 없이
  const none = blockView(shown, { name: { 1: { kind: "none" } }, surname: {} });
  assert.deepEqual(none.syllables[1], { syllable: "윤", source: "none", hanja: null, fills: [], waiting: false });
  assert.equal(none.syllables[0].waiting, true);

  // 성씨를 고름 — 이름용 표시를 떼고, 출처는 '고른 한자'
  const liu = factOf("유", LIU);
  const surname = blockView({ ...shown, surname: { hangul: "유", source: "default", strokes: 9, chars: [asSurnameFact(factOf("유", RYU))] } }, { name: {}, surname: { 0: { kind: "hanja", fact: liu } } });
  assert.equal(surname.surname.source, "user");
  assert.equal(surname.surname.chars[0].character, LIU);
  assert.equal(surname.surname.chars[0].forbidden, false);

  // 고른 글자를 자동으로 되돌림 — 서버가 무엇을 고를지 모르므로 글자를 비우고 대기
  const picked = { ...shown, userHanja: true, syllables: [{ syllable: "서", source: "user", fills: ["lacking"], hanja: seo }, shown.syllables[1]] };
  const back = blockView(picked, { name: { 0: { kind: "auto" } }, surname: {} });
  assert.deepEqual(back.syllables[0], { syllable: "서", source: "auto", hanja: null, fills: [], waiting: true });

  // 쓸 한자가 없는 음절은 대기 중에도 그대로다
  const unavailable = { ...shown, syllables: [shown.syllables[0], { syllable: "빛", source: "unavailable", fills: [], hanja: null }] };
  const u = blockView(unavailable, { name: { 0: { kind: "hanja", fact: seo } }, surname: {} });
  assert.deepEqual(u.syllables[1], { syllable: "빛", source: "unavailable", fills: [], hanja: null, waiting: false });

  // 출생일이 없으면 역할이 없다
  const noBirth = blockView({ ...shown, elementFit: null }, { name: { 0: { kind: "hanja", fact: seo } }, surname: {} });
  assert.deepEqual(noBirth.syllables[0].fills, []);
  assert.equal(noBirth.elementFit, null);

  // 성씨 글자를 정하지 못한 응답(chars 빈 목록)도 자리 수만큼 그린다
  const unknown = blockView({ ...shown, surname: { hangul: "남궁", source: "estimated", strokes: 0, chars: [] } }, null);
  assert.deepEqual(unknown.surname.chars, [null, null]);
});

// ============================================================
// 소스 규칙
// ============================================================

test("lib/hanja-pick.ts·lib/ohaeng-relation.ts 는 순수 모듈 — 지시어·큰 JSON import·콘솔 출력이 없다", () => {
  for (const rel of ["../src/lib/hanja-pick.ts", "../src/lib/ohaeng-relation.ts"]) {
    const src = read(rel);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(src, /^\s*["']use client["']/m, rel);
    for (const re of [/lib\/hanja-seo/, /lib\/name-seo/, /@\/data\//, /from "\.\/hanja-seo"/, /from "\.\/name-seo"/, /\.json"/]) {
      assert.doesNotMatch(code, re, `${rel}: ${re}`);
    }
    // 이름·한자·생년월일은 개인정보 — 이 모듈은 콘솔·저장소·네트워크에 아무것도 남기지 않는다
    for (const re of [/console\./, /localStorage/, /sessionStorage/, /\bfetch\(/, /sendBeacon/]) {
      assert.doesNotMatch(code, re, `${rel}: ${re}`);
    }
  }
});

test("새 소스·테스트에 호환 한자·BMP 밖 글자·보이지 않는 글자를 글자로 적지 않았다", () => {
  const bad = [
    [0xf900, 0xfaff], [0x2f800, 0x2fa1f], // 호환 한자
    [0x2f00, 0x2fd5], [0x2e80, 0x2ef3], // 강희 부수 · 부수 보충
    [0x200b, 0x200f], [0x2028, 0x202f], [0x2060, 0x206f], [0xfeff, 0xfeff], // 폭 없는 문자·구분자
    [0xfe00, 0xfe0f], [0xe0100, 0xe01ef], // 이체 선택자
    [0xa0, 0xa0], [0x3000, 0x3000], [0xfffd, 0xfffd],
    [0xd800, 0xdfff], [0xe000, 0xf8ff], [0x10000, 0x10ffff],
  ];
  const files = [
    "../src/lib/hanja-pick.ts",
    "../src/lib/ohaeng-relation.ts",
    "../src/app/evaluate/evaluate-params.ts",
    "./hanja-pick.test.mjs",
    "./ohaeng-relation.test.mjs",
    "./favorites-key.test.mjs",
    "./evaluate-params.test.mjs",
    "./hanja-api.test.mjs",
    "./resolve-ts.mjs",
    // 입력 화면(C5)
    "../src/lib/hanja-pick-store.ts",
    "../src/lib/hanja-pick-text.ts",
    "../src/components/design/HanjaSlots.tsx",
    "../src/components/design/HanjaPickerPanel.tsx",
    "../src/components/design/EvaluateInput.tsx",
    "../src/app/evaluate/EvaluateClient.tsx",
    "./hanja-pick-text.test.mjs",
    "./hanja-pick-store.test.mjs",
    "./evaluate-hanja-pages.test.mjs",
    // 결과 화면(C6)
    "../src/lib/hanja-recalc.ts",
    "../src/lib/hanja-summary-text.ts",
    "../src/components/design/HanjaSummaryBlock.tsx",
    "../src/components/design/OhaengRelationChip.tsx",
    "../src/components/design/EvalBody.tsx",
    "../src/app/evaluate/EvaluateResult.tsx",
    "../src/app/favorites/page.tsx",
    "./hanja-recalc.test.mjs",
    "./hanja-summary-text.test.mjs",
    // 착지·문구·방침(C7 앞 절반) — 설명 글은 한자 세 글자를 본문에 적는다(통합 한자여야 한다)
    "../src/app/evaluate/EvaluateHanjaGuide.tsx",
    "../src/app/evaluate/page.tsx",
    "../src/app/evaluate/layout.tsx",
    "../src/components/design/OhaengResult.tsx",
    "../src/app/privacy/page.tsx",
    "../src/app/sitemap.ts",
    "./note-polarity.test.mjs",
    // 진입 링크(C7 뒤 절반). app/hanja/[slug]/page.tsx 는 예전 주석의 경고 이모지(U+26A0 + 이체 선택자 U+FE0F)가 있어 목록에 넣지 않았다 —
    // 이번에 더한 줄(배너 주석의 한자 예 瑞 — 통합 한자)은 커밋 때 따로 훑었다
    "../src/app/name/[slug]/page.tsx",
    "../src/app/hanja/page.tsx",
    "../src/components/hanja/HanjaEvaluateLine.tsx",
    "./palette-contrast.test.mjs",
  ];
  for (const rel of files) {
    const hits = [];
    const lines = read(rel).split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const ch of line) {
        const cp = ch.codePointAt(0);
        if (bad.some(([lo, hi]) => cp >= lo && cp <= hi)) hits.push(`${i + 1}행 U+${cp.toString(16).toUpperCase()}`);
      }
    });
    assert.deepEqual(hits, [], rel);
  }
});
