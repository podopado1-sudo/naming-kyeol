// /hanja 자원오행 화면 문구 테스트 — `npm test` (= node --test "tests/*.test.mjs", Node 22.18+ 타입 지우기)
//
// 기대 문장은 data/hanja_resource_element.json meta.fields·v_reasons_legend 의 문구 계약을 손으로 옮긴 사례표다
// (2026-10-22 자원오행 전환 S7). 아래 '전수' 테스트는 frontend/src/data/hanja-seo.json 9,105자 전부에 계약을 건다.
// ⚠️ 호환 한자를 글자로 쓰지 말 것(NFC 정규화 회귀) — 이 파일의 한자는 모두 통합 한자다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { josa } from "../src/lib/josa.ts";
import {
  cleanMeaningNote,
  elementDisputeLines,
  gradeBadgeKey,
  imageryElements,
  variantElementLine,
} from "../src/components/hanja/hanja-element-text.ts";

const DATA = JSON.parse(
  readFileSync(new URL("../src/data/hanja-seo.json", import.meta.url), "utf-8"),
);

test("부수 단위 이견(alt_radical)은 '이 부수(X)를 Y로 보는 자료도 있습니다' — 글자 견해로 쓰지 않는다", () => {
  const lines = elementDisputeLines(
    { g: "V", radical_char: "示", alt_radical: ["金", "火"], v_reasons: ["radical_alt"] },
    josa,
  );
  // 값은 木火土金水 순으로 정렬, 조사는 마지막 값(金 → 금)의 받침으로
  assert.deepEqual(lines, ["이 부수(示)를 火·金으로 보는 자료도 있습니다."]);
  assert.deepEqual(
    elementDisputeLines({ g: "V", radical_char: "力", alt_radical: ["火"], v_reasons: ["radical_alt"] }, josa),
    ["이 부수(力)를 火로 보는 자료도 있습니다."],
  );
});

test("글자 단위 이견(alt_char)은 출처 갈래별 문장", () => {
  const cases = [
    // PRACTICE = 작명 실무 자료 n곳 — '작명가에 따라…'
    [
      { g: "V", radical_char: "一", alt_char: [{ e: "土", basis: ["PRACTICE"], n: 2, of: 3, n_indep: 1 }], v_reasons: ["char_practice"] },
      ["작명가에 따라 이 글자를 土로 보기도 합니다(작명 실무 자료 3곳 중 2곳)."],
    ],
    // 문헌 예시(KIM-EX) — '문헌…', 출처를 밝힌다
    [
      { g: "V", radical_char: "宀", alt_char: [{ e: "水", basis: ["KIM-EX"] }], v_reasons: ["char_literature"] },
      ["문헌 가운데 김만태 예시는 이 글자를 水로 봅니다."],
    ],
    // 문헌 본문(KIM-TXT) 두 값은 한 문장
    [
      { g: "V", alt_char: [{ e: "火", basis: ["KIM-TXT"] }, { e: "水", basis: ["KIM-TXT"] }], v_reasons: ["char_literature"] },
      ["문헌 가운데 김만태 본문은 관점에 따라 이 글자를 火·水로도 봅니다."],
    ],
    // 작명소 예시(MISO)는 학술 문헌이 아니라 작명소 자료라고 밝힌다
    [
      { g: "V", alt_char: [{ e: "火", basis: ["MISO"] }], v_reasons: ["char_literature"] },
      ["작명소 자료 가운데 미소 한국작명원 예시는 이 글자를 火로 봅니다."],
    ],
    // 작명 서비스(ERUMY)는 '이루미는'
    [
      { g: "V", alt_char: [{ e: "土", basis: ["ERUMY"] }], v_reasons: ["char_literature"] },
      ["작명 서비스 이루미는 이 글자를 土로 봅니다."],
    ],
  ];
  for (const [rec, expected] of cases) {
    assert.deepEqual(elementDisputeLines(rec, josa), expected, JSON.stringify(rec));
  }
});

test("숫자 한자는 V·X 모두 '작명가마다 기준이 다릅니다'를 맨 앞에", () => {
  const v = elementDisputeLines(
    { g: "V", radical_char: "一", number: true, alt_radical: ["土"], v_reasons: ["radical_alt", "radical_split", "number"] },
    josa,
  );
  assert.deepEqual(v, [
    "숫자 한자의 자원오행은 작명가마다 기준이 다릅니다.",
    "이 부수(一)를 土로 보는 자료도 있습니다.",
    "이 부수 글자는 뜻에 따라 다르게 보기도 합니다.",
  ]);
  const x = elementDisputeLines({ g: "X", radical_char: "二", number: true }, josa);
  assert.deepEqual(x, ["숫자 한자의 자원오행은 작명가마다 기준이 다릅니다."]);
});

test("자료 적음·추정만 있는 V 는 '이견'이라고 쓰지 않는다 — 배지도 따로", () => {
  const few = elementDisputeLines({ g: "V", radical_char: "鹵", v_reasons: ["radical_single"] }, josa);
  assert.equal(few.length, 1);
  assert.ok(!few[0].includes("이견"), few[0]);
  assert.ok(few[0].includes("자료 적음"), few[0]);
  const guess = elementDisputeLines({ g: "V", radical_char: "色", v_reasons: ["radical_unknown"] }, josa);
  assert.ok(guess[0].includes("추정") && !guess[0].includes("이견"), guess[0]);

  assert.equal(gradeBadgeKey("V", ["radical_single"]), "V_FEW");
  assert.equal(gradeBadgeKey("V", ["radical_unknown"]), "V_GUESS");
  assert.equal(gradeBadgeKey("V", ["radical_alt"]), "V");
  assert.equal(gradeBadgeKey("V", ["radical_single", "number"]), "V");
  assert.equal(gradeBadgeKey("V"), "V");
  assert.equal(gradeBadgeKey("R", ["radical_single"]), "R");
  assert.equal(gradeBadgeKey("X"), "X");
  assert.equal(gradeBadgeKey(undefined), undefined);
});

test("확정(R)이고 숫자 한자가 아니면 이견 문장이 없다", () => {
  assert.deepEqual(elementDisputeLines({ g: "R", radical_char: "手" }, josa), []);
});

test("이체자 문장 — 쓴 꼴의 부수를 따른다(D6)", () => {
  // 부수·값이 같다 (真 → 眞)
  assert.equal(
    variantElementLine(
      { char: "真", radical: "目", element: "木", reading: "진" },
      { char: "眞", radical: "目", element: "木", reading: "진" },
      josa,
    ),
    "정자 眞과 부수(目)가 같아 자원오행도 木으로 같습니다.",
  );
  // 부수가 다르고 값이 같다 (悳 → 德) — 계획 §2-3 예시 문장
  assert.equal(
    variantElementLine(
      { char: "悳", radical: "心", element: "火", reading: "덕" },
      { char: "德", radical: "彳", element: "火", reading: "덕" },
      josa,
    ),
    "정자 德(彳)은 火, 이 꼴(悳, 心)도 火입니다.",
  );
  // 값이 다르다 (㘽 U+363D → 栽) — 조사는 정자의 소리(재 → 는)
  assert.equal(
    variantElementLine(
      { char: "\u{363D}", radical: "土", element: "土", reading: "재" },
      { char: "栽", radical: "木", element: "木", reading: "재" },
      josa,
    ),
    "정자 栽(木)는 木, 이 꼴(\u{363D}, 土)은 土입니다. 이체자도 쓴 꼴의 부수로 자원오행을 정합니다.",
  );
  // 어느 쪽이든 값이 없으면(U) 문장 없음
  assert.equal(
    variantElementLine({ char: "真", radical: "目", reading: "진" }, { char: "眞", radical: "目", element: "木", reading: "진" }, josa),
    null,
  );
});

test("글자 풀이(mw)는 오행 낱말이 든 문장을 뺀다 — 옛 판정 문장은 통째로", () => {
  // radical_map 판정 문장 — 전부 옛 오행 판정
  assert.equal(cleanMeaningNote("의미 '옥' → 金", "金"), undefined);
  assert.equal(cleanMeaningNote("의미 '고을'(고을) → 土", "土"), undefined);
  // 오행 이름('금의 권위')이 든 문장을 빼면 뜻 되풀이 한 마디만 남는다 → 내지 않는다
  assert.equal(cleanMeaningNote("베풀다, 펴다. 질서를 널리 알리고 다스리는 금의 권위.", "木"), undefined);
  // 부수 표기 문장('부수 土.')·오행 한자 문장을 빼고 남는 뜻 해설
  assert.equal(
    cleanMeaningNote("부수 土. 터, 기초. 땅의 견고함과 믿음.", "土"),
    "터, 기초. 땅의 견고함과 믿음.",
  );
  // '금속'의 금은 오행 이름이 아니다. 같은 오행(金) 심상의 기운 문장은 둔다
  assert.equal(
    cleanMeaningNote("쇠 금. 단단하고 빛나는 금속처럼 결단과 절제로 가치를 높이는 기운.", "金"),
    "단단하고 빛나는 금속처럼 결단과 절제로 가치를 높이는 기운.",
  );
  // 기운을 말하지 않는 비유는 뜻 풀이라 둔다(下 木 — '물이 … 흐르듯')
  assert.equal(
    cleanMeaningNote("아래. 물이 낮은 곳으로 흐르듯 순리에 따라 유연하게 내려감.", "木"),
    "아래. 물이 낮은 곳으로 흐르듯 순리에 따라 유연하게 내려감.",
  );
  assert.equal(cleanMeaningNote(undefined, "木"), undefined);
  assert.equal(cleanMeaningNote("", "木"), undefined);
});

test("글자 풀이(mw)는 자원오행과 다른 오행 심상으로 기운을 말하는 문장을 뺀다(D4 — 고유어 오행 낱말)", () => {
  // 玄 火(예외 적용) — '물의 기운'
  assert.equal(cleanMeaningNote("검다, 깊다. 지혜가 깊어 끝을 알 수 없는 심오한 물의 기운.", "火"), undefined);
  // 韓 金 — '나무의 기운'
  assert.equal(cleanMeaningNote("나라 이름 한. 해가 뜰 때 나무의 기운이 솟구치는 생동감 넘치는 터.", "金"), undefined);
  // 常 木 — '쇠의 성질'
  assert.equal(cleanMeaningNote("항상. 변치 않는 쇠의 성질처럼 일관된 질서.", "木"), undefined);
  // 來 火 — '나무에 이삭이 맺히듯 … 기운'
  assert.equal(cleanMeaningNote("오다. 나무에 이삭이 맺히듯 새로운 생명이 찾아오는 기운.", "火"), undefined);
  // 克 木 — '쇠처럼 단단한 의지로 … 기운'
  assert.equal(cleanMeaningNote("이길 극. 쇠처럼 단단한 의지로 어려움을 극복하고 결단을 세우는 기운.", "木"), undefined);
  // 같은 오행이면 둔다(玄 이 水 였다면)
  assert.equal(
    cleanMeaningNote("검다, 깊다. 지혜가 깊어 끝을 알 수 없는 심오한 물의 기운.", "水"),
    "검다, 깊다. 지혜가 깊어 끝을 알 수 없는 심오한 물의 기운.",
  );
  // 오행이 없으면(U) 심상 있는 기운 문장은 모두 뺀다
  assert.equal(cleanMeaningNote("쇠 금. 단단하고 빛나는 금속처럼 결단과 절제로 가치를 높이는 기운.", undefined), undefined);
  // 낱말 안의 글자는 심상이 아니다 — 만물·쇠퇴·불가
  assert.deepEqual(imageryElements("만물이 쇠퇴하고 불가피하게 기운이 흩어짐."), []);
  assert.deepEqual(imageryElements("쇠처럼 단단한 의지"), ["金"]);
  assert.deepEqual(imageryElements("싹이 땅 위로 솟아오르듯"), ["木", "土"]);
});

// ---------------------------------------------------------------
// 전수 — 실제 데이터 9,105자에 계약을 건다
// ---------------------------------------------------------------

test("전수: 글자 풀이에 오행 표기가 남지 않는다", () => {
  const ELEMENT_LIKE = /[木火土金水]|→|오행|상생|상극|(?<![가-힣])(목|화|토|금|수)(의|\s*기운|\s*에너지)/;
  // 고유어 오행 낱말이 오행 뜻으로 쓰인 꼴 — 이 글자 자원오행과 다르면 안 된다(玄 火 '물의 기운'·韓 金 '나무의 기운')
  const NATIVE = /(?<![가-힣])(나무|불꽃|불|흙|쇠|물|금속|대지|땅)의 (기운|에너지|성질|기질|속성)/g;
  const NATIVE_ELEMENT = { 나무: "木", 불꽃: "火", 불: "火", 흙: "土", 대지: "土", 땅: "土", 쇠: "金", 금속: "金", 물: "水" };
  const ENERGY = /기운|에너지|성질|기질|속성/;
  let shown = 0;
  for (const [char, rec] of Object.entries(DATA)) {
    const note = cleanMeaningNote(rec.mw, rec.e ?? undefined);
    if (!note) continue;
    shown += 1;
    assert.ok(!ELEMENT_LIKE.test(note), `${char}: ${note}`);
    for (const m of note.matchAll(NATIVE)) {
      assert.equal(NATIVE_ELEMENT[m[1]], rec.e, `${char}(${rec.e}): ${note}`);
    }
    for (const sentence of note.split(/(?<=[.!?])\s+/)) {
      if (!ENERGY.test(sentence)) continue;
      for (const e of imageryElements(sentence)) assert.equal(e, rec.e, `${char}(${rec.e}): ${sentence}`);
    }
  }
  // 코어 뜻풀이 2,054개 중 상당수가 남아야 한다(필터가 전부 지우는 회귀 방지)
  assert.ok(shown > 1000, `글자 풀이 ${shown}자`);
});

test("전수: 이견 문장은 계약 문구만 쓴다", () => {
  for (const [char, rec] of Object.entries(DATA)) {
    const lines = elementDisputeLines(rec, josa);
    const text = lines.join(" ");
    // basis 의 HN·NC·IO(부수 수준 다수값)를 글자 판단처럼 내지 않는다 — 출처 키 자체가 화면에 없어야 한다
    assert.ok(!/\b(HN|NC|IO|PRACTICE|KIM-EX|KIM-TXT|MISO|ERUMY)\b/.test(text), `${char}: ${text}`);
    // 부수 단위 견해만 있는 글자에 글자 견해 문장('이 글자를')이 붙지 않는다
    if (!rec.alt_char?.length) {
      assert.ok(!text.includes("이 글자를"), `${char}: ${text}`);
    }
    // 대체값이 없는 V(자료 적음·추정·갈림)는 '이견'이라고 쓰지 않는다
    if (rec.g === "V" && !rec.alt_radical?.length && !rec.alt_char?.length) {
      assert.ok(!text.includes("이견"), `${char}: ${text}`);
    }
    // 숫자 한자는 반드시 주의 문장
    if (rec.number) {
      assert.equal(lines[0], "숫자 한자의 자원오행은 작명가마다 기준이 다릅니다.", char);
    }
    // 조사 괄호형('(으)로')이 새지 않는다 — 오행 값 뒤 조사는 한글 소리로 고른다
    assert.ok(!text.includes("(으)로") && !text.includes("을(를)"), `${char}: ${text}`);
    // R 이고 숫자 한자가 아니면 문장이 없다
    if (rec.g === "R" && !rec.number) assert.equal(lines.length, 0, `${char}: ${text}`);
  }
});

test("전수: 이체자 문장은 variant_tie 가 아닌 확실 묶음에서 언제나 만들어진다", () => {
  let made = 0;
  for (const [char, rec] of Object.entries(DATA)) {
    if (!rec.variant_of || rec.variant_tie) continue;
    const std = DATA[rec.variant_of];
    assert.ok(std, `${char}: 정자 ${rec.variant_of} 없음`);
    const line = variantElementLine(
      { char, radical: rec.radical_char, element: rec.e ?? undefined, reading: rec.r[0] },
      { char: rec.variant_of, radical: std.radical_char, element: std.e ?? undefined, reading: std.r[0] },
      josa,
    );
    if (rec.e && std.e) {
      assert.ok(line && line.startsWith(`정자 ${rec.variant_of}`), `${char}: ${line}`);
      assert.ok(!line.includes("(는)") && !line.includes("(와)"), `${char}: ${line}`);
      made += 1;
    }
  }
  assert.ok(made > 300, `이체자 문장 ${made}자`);
});
