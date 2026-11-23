// /evaluate 결과 화면 '이 이름의 한자' 블록의 화면 모델·문장 테스트 — `npm test`
//
// 2026-11 설계 docs/plan-hanja-input-2026-11.md §3-4·§8-3·§8-4·§9-3, 법규 사실 §20. lib/hanja-summary-text.ts 는 순수 모듈이라
// 값으로 본다. 기대 문장은 설계서의 문구를 손으로 옮긴 것이다(검사 대상 함수로 기대값을 만들지 않는다).
// 한자는 코드포인트로 적는다 — 호환 한자·BMP 밖 글자·보이지 않는 글자를 소스에 글자로 두지 않는다(hanja-pick.test.mjs 가 이 파일도 훑는다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const T = await import("../src/lib/hanja-summary-text.ts");
const { blockView } = await import("../src/lib/hanja-pick.ts");
const { MIXED_SCRIPT_NOTICE, slotAriaLabel, slotFace } = await import("../src/lib/hanja-pick-text.ts");
const { ohaengRelation } = await import("../src/lib/ohaeng-relation.ts");

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const U = (cp) => String.fromCodePoint(cp);
const SEO = U(0x745e); // 상서 서 — 金 13획
const SEO2 = U(0x66f8); // 글 서 — 火 10획
const YUN = U(0x6f64); // 윤택할 윤 — 水 15획
const YUN2 = U(0x5141); // 맏 윤 — 土 4획
const LI = U(0x674e); // 오얏 리(이) — 木 7획
const LIU = U(0x5289); // 성씨 유 — 金 15획
const NAM = U(0x5357); // 남녘 남
const NAM2 = U(0x7537); // 사내 남
const GUNG = U(0x5bae); // 집 궁
const RAT = U(0x9f20); // 쥐 서(이름에 피하는 글자)

const fact = (character, gloss, fiveElement, strokeCount, extra = {}) => ({
  character,
  gloss,
  fiveElement,
  resourceGrade: "R",
  vReasons: [],
  strokeCount,
  yinYang: strokeCount % 2 === 1 ? "陽" : "陰",
  common: false,
  forbidden: false,
  hasMeaning: gloss !== "",
  basic: true,
  ...extra,
});

const F = {
  li: fact(LI, "오얏 리(이)", "木", 7),
  liu: fact(LIU, "죽일 류(유)", "金", 15),
  seo: fact(SEO, "상서 서", "金", 13),
  seo2: fact(SEO2, "글 서", "火", 10),
  yun: fact(YUN, "윤택할 윤", "水", 15),
  yun2: fact(YUN2, "맏 윤", "土", 4),
};

const FIT = {
  yongshin: "土",
  heeshin: "火",
  gishin: "木",
  lacking: ["金", "水"],
  excessive: ["木"],
  counts: { 木: 2, 火: 2, 土: 1, 金: 1, 水: 0 },
};

const summary = (extra = {}) => ({
  userHanja: false,
  nameHanja: "",
  lastNameHanja: "",
  surname: { hangul: "이", source: "default", strokes: 7, chars: [F.li] },
  syllables: [
    { syllable: "서", source: "auto", fills: ["heeshin"], hanja: F.seo2 },
    { syllable: "윤", source: "auto", fills: ["yongshin", "lacking"], hanja: F.yun2 },
  ],
  elementFit: FIT,
  ...extra,
});

/** 색인(index.json)의 꼴 — 서·윤·이·유·남·궁·몰은 후보 파일이 있고 빛·궉은 없다 */
const INDEX = {
  version: 1,
  counts: { characters: 0, syllables: 0, pairs: 0, forbidden: 0, common: 0 },
  syllables: {
    서: { all: 61, usable: 60 },
    윤: { all: 30, usable: 28 },
    이: { all: 117, usable: 100 },
    유: { all: 138, usable: 123 },
    남: { all: 10, usable: 9 },
    궁: { all: 10, usable: 9 },
    한: { all: 40, usable: 38 },
    찬: { all: 30, usable: 28 },
    몰: { all: 2, usable: 0, autoEmpty: true },
  },
  surnames: { 이: LI, 유: U(0x67f3), 남궁: NAM + GUNG },
};

// ============================================================
// 머리 · 하단 띠
// ============================================================

test("블록 부제·대기 글 배지·하단 띠 — 설계 §9-3 의 문구", () => {
  assert.equal(T.BLOCK_TITLE, "이 이름의 한자");
  assert.equal(T.blockSubtitle(true), "고른 한자로 계산했어요. 칸을 눌러 바꿔 볼 수 있어요.");
  assert.equal(T.blockSubtitle(false), "한자를 고르지 않아 자동으로 골랐어요. 칸을 눌러 바꿔 볼 수 있어요.");
  assert.equal(T.WAITING_BADGE, "이전 한자 기준 · 다시 계산 중");
  assert.equal(T.RECALC_PROGRESS, "고른 한자로 다시 계산하는 중이에요…");
});

test("다시 계산이 끝났다는 한 줄 — 숫자는 응답 값 그대로, 생년월일이 없으면 조화 대신 미학", () => {
  const data = { birthDateProvided: true, aestheticScore: 82, harmonyScore: 78, finalScore: 80 };
  assert.equal(T.recalcDoneNotice(data), "다시 계산했어요 — 조화 78 · 종합 80");
  assert.equal(T.recalcDoneNotice({ ...data, birthDateProvided: false, harmonyScore: 0, finalScore: 82 }), "다시 계산했어요 — 미학 82 · 종합 82");
  // birthDateProvided 가 없는 옛 응답은 조화를 계산한 것으로 본다(결과 화면의 타일 규칙과 같다)
  assert.equal(T.recalcDoneNotice({ aestheticScore: 82, harmonyScore: 78, finalScore: 80 }), "다시 계산했어요 — 조화 78 · 종합 80");
  assert.equal(T.seenShownNotice(data), "본 조합으로 돌아왔어요 — 조화 78 · 종합 80");
  assert.equal(T.seenShownNotice({ ...data, birthDateProvided: false, finalScore: 82 }), "본 조합으로 돌아왔어요 — 미학 82 · 종합 82");
});

test("다시 계산하지 못했다 — 무엇으로 바꾸려 했는지에 따라. 변수 뒤에 조사를 붙이지 않는다", () => {
  assert.equal(T.recalcFailedNote({ syllable: "서", kind: "hanja", character: SEO }), `‘${SEO}’ 글자로 다시 계산하지 못했어요.`);
  // '…두고/되돌려 다시 계산하지 못했어요'는 '되돌렸기 때문에 못 했다'로도 읽혀 '…조합으로'로(검증 지적 — 2026-11-23)
  assert.equal(T.recalcFailedNote({ syllable: "윤", kind: "none", character: null }), "‘윤’ 칸을 한글로 둔 조합으로 다시 계산하지 못했어요.");
  assert.equal(T.recalcFailedNote({ syllable: "윤", kind: "auto", character: null }), "‘윤’ 칸을 자동으로 되돌린 조합으로 다시 계산하지 못했어요.");
  // 서버가 짚은 칸이 이번에 바꾼 칸이 아니면 글자를 대지 않는다
  assert.equal(T.recalcFailedNote({ syllable: "윤", kind: "slot", character: null }), "‘윤’ 칸의 한자 때문에 다시 계산하지 못했어요.");
});

// ============================================================
// 칸 줄
// ============================================================

test("blockSlots: 이름 칸 — 자동으로 고른 한자는 글자가 든 자동 칸, 고른 한자는 picked, 한자 없이는 none", () => {
  const view = blockView(
    summary({
      userHanja: true,
      syllables: [
        { syllable: "서", source: "user", fills: ["lacking"], hanja: F.seo },
        { syllable: "윤", source: "auto", fills: ["yongshin"], hanja: F.yun2 },
      ],
    }),
    null
  );
  const { name } = T.blockSlots(view, INDEX);
  assert.deepEqual(name.map((s) => [s.target, s.index, s.syllable, s.state, s.character, s.mark, s.openable]), [
    ["name", 0, "서", "picked", SEO, SEO, true],
    ["name", 1, "윤", "auto", YUN2, "*", true],
  ]);
  assert.equal(name[1].fact, F.yun2);
  // 칸 버튼의 모양·이름 — 자동으로 고른 한자는 글자를 그리고 '자동으로 고른 한자'라고 읽는다
  assert.deepEqual(slotFace(name[1]), { glyph: YUN2, word: null, tail: null });
  assert.equal(slotAriaLabel(name[1]), `‘윤’ 음절 한자 — ${YUN2}(맏 윤), 자동으로 고른 한자. 바꾸기`);
  assert.equal(slotAriaLabel(name[0]), `‘서’ 음절 한자 — ${SEO}(상서 서), 고른 한자. 바꾸기`);

  const none = T.blockSlots(
    blockView(summary({ userHanja: true, syllables: [{ syllable: "서", source: "user", fills: [], hanja: F.seo }, { syllable: "윤", source: "none", fills: [], hanja: null }] }), null),
    INDEX
  ).name[1];
  assert.deepEqual([none.state, none.character, none.mark, none.openable], ["none", null, "-", true]);
  assert.equal(slotFace(none).word, "한글");
});

test("blockSlots: 쓸 수 있는 한자가 없는 음절 — 후보 파일이 있으면 열 수 있는 '한글'(hangul), 없으면 잠긴 칸(locked). 둘 다 `*` 로 보낸다", () => {
  const view = blockView(
    summary({
      surname: { hangul: "이", source: "default", strokes: 7, chars: [F.li] },
      syllables: [
        { syllable: "몰", source: "unavailable", fills: [], hanja: null },
        { syllable: "빛", source: "unavailable", fills: [], hanja: null },
      ],
    }),
    null
  );
  const { name } = T.blockSlots(view, INDEX);
  assert.deepEqual(name.map((s) => [s.syllable, s.state, s.openable, s.mark]), [
    ["몰", "hangul", true, "*"],
    ["빛", "locked", false, "*"],
  ]);
  // 색인을 아직 못 받았으면 모든 칸을 열 수 있는 것으로 둔다
  assert.deepEqual(T.blockSlots(view, null).name.map((s) => [s.state, s.openable]), [["hangul", true], ["hangul", true]]);
  // 물려받은 키('constructor')를 음절로 착각하지 않는다
  const odd = blockView(summary({ syllables: [{ syllable: "constructor", source: "unavailable", fills: [], hanja: null }] }), null);
  assert.equal(T.blockSlots(odd, INDEX).name[0].openable, false);
});

test("blockSlots: 성씨 칸 — 기본 한자·추정 한자·고른 한자. 복성에서 한 글자만 골랐으면 나머지는 기본 한자", () => {
  const def = T.blockSlots(blockView(summary(), null), INDEX).surname;
  assert.deepEqual(def.map((s) => [s.target, s.syllable, s.state, s.character, s.mark]), [["surname", "이", "default", LI, "*"]]);
  assert.equal(slotAriaLabel(def[0]), `‘이’ 성씨 한자 — ${LI}, 기본 한자. 바꾸기`);

  const picked = T.blockSlots(blockView(summary({ surname: { hangul: "유", source: "user", strokes: 15, chars: [F.liu] } }), null), INDEX).surname;
  assert.deepEqual(picked.map((s) => [s.state, s.character, s.mark]), [["picked", LIU, LIU]]);
  // 성씨 칸은 훈을 읽지 않는다
  assert.equal(slotAriaLabel(picked[0]), `‘유’ 성씨 한자 — ${LIU}, 고른 한자. 바꾸기`);

  const estimated = T.blockSlots(blockView(summary({ surname: { hangul: "찬", source: "estimated", strokes: 17, chars: [fact(U(0x71e6), "빛날 찬", "火", 17)] } }), null), INDEX).surname;
  assert.deepEqual(estimated.map((s) => [s.state, s.mark]), [["auto", "*"]]);
  assert.equal(slotAriaLabel(estimated[0]), `‘찬’ 성씨 한자 — ${U(0x71e6)}, 추정한 한자. 바꾸기`);

  const compound = T.blockSlots(
    blockView(summary({ surname: { hangul: "남궁", source: "user", strokes: 17, chars: [fact(NAM2, "사내 남", "土", 7), fact(GUNG, "집 궁", "木", 10)] } }), null),
    INDEX
  ).surname;
  assert.deepEqual(compound.map((s) => [s.syllable, s.state, s.mark]), [["남", "picked", NAM2], ["궁", "default", "*"]]);

  // 글자를 정하지 못한 성씨(사전에 그 음절의 한자가 없다) — 글자 없는 칸. 후보 파일이 없으면 잠긴 칸
  const unknown = T.blockSlots(blockView(summary({ surname: { hangul: "궉", source: "estimated", strokes: 0, chars: [] } }), null), INDEX).surname;
  assert.deepEqual(unknown.map((s) => [s.state, s.character, s.openable]), [["locked", null, false]]);
});

test("칸 꼬리 — 이름: 고른 한자 / (용신을 반영해) 자동으로 고른 한자 / 한자 없이 한글로 / 다시 고르는 중", () => {
  const s = (source, hanja, waiting = false) => ({ source, hanja, waiting });
  assert.equal(T.syllableTail(s("user", F.seo), FIT), "고른 한자");
  assert.equal(T.syllableTail(s("auto", F.yun2), FIT), "용신을 반영해 자동으로 고른 한자");
  // 생년월일이 없거나 용신을 구하지 못했으면 '용신을 반영해'라고 적지 않는다
  assert.equal(T.syllableTail(s("auto", F.yun2), null), "자동으로 고른 한자");
  assert.equal(T.syllableTail(s("auto", F.yun2), { ...FIT, yongshin: null, heeshin: null, gishin: null }), "자동으로 고른 한자");
  assert.equal(T.syllableTail(s("none", null), FIT), "한자 없이 한글로");
  assert.equal(T.syllableTail(s("unavailable", null), FIT), null);
  assert.equal(T.syllableTail(s("auto", F.yun2, true), FIT), "다시 고르는 중");
  assert.equal(T.syllableTail(s("auto", null, true), FIT), "다시 고르는 중");
});

test("칸 꼬리 — 성씨: 기본으로 두는 성씨 한자 / 추정한 성씨 한자 / 고른 한자", () => {
  assert.equal(T.surnameTail({ state: "default", character: LI }, false), "기본으로 두는 성씨 한자");
  assert.equal(T.surnameTail({ state: "auto", character: LI }, false), "추정한 성씨 한자");
  assert.equal(T.surnameTail({ state: "picked", character: LIU }, false), "고른 한자");
  assert.equal(T.surnameTail({ state: "auto", character: null }, true), "다시 고르는 중");
  assert.equal(T.surnameTail({ state: "locked", character: null }, false), null);
});

// ============================================================
// 역할 꼬리표
// ============================================================

test("역할 꼬리표 — 조화 노트와 같은 낱말, 부족·많은 오행에는 사주 글자의 개수", () => {
  assert.equal(T.fillLabel("yongshin", "土", FIT), "용신 보완");
  assert.equal(T.fillLabel("heeshin", "火", FIT), "희신 포함");
  assert.equal(T.fillLabel("gishin", "木", FIT), "기신(감점)");
  assert.equal(T.fillLabel("lacking", "金", FIT), "부족한 오행 보완 · 사주에 1개");
  assert.equal(T.fillLabel("lacking", "水", FIT), "부족한 오행 보완 · 사주에 0개");
  assert.equal(T.fillLabel("excessive", "木", FIT), "많은 오행(감점) · 사주에 2개");
  // 개수를 모르면 개수 없이
  assert.equal(T.fillLabel("lacking", "金", null), "부족한 오행 보완");
  assert.equal(T.fillLabel("excessive", "木", { ...FIT, counts: {} }), "많은 오행(감점)");
  assert.deepEqual(["yongshin", "heeshin", "gishin", "lacking", "excessive"].map(T.isPenaltyFill), [false, false, true, false, true]);
  // 조화 노트(백엔드 HarmonyEngine)의 낱말 — '용신 … 보완'·'희신 … 포함'·'기신 … (감점)'·'부족한 오행 … 보완'·'과다한 오행 … (감점)'
  const harmony = read("../../Application/Engines/HarmonyEngine.cs");
  for (const word of ["용신 '", "' 보완", "희신 '", "' 포함", "기신 '", "(감점)", "부족한 오행 '"]) {
    assert.ok(harmony.includes(word), `조화 노트에 ${word} 가 없다 — 꼬리표의 낱말을 다시 맞출 것`);
  }
});

// ============================================================
// 안내 줄
// ============================================================

test("안내 문장 — 설계 §9-3 의 문구 그대로", () => {
  assert.equal(
    T.RELATION_NOTICE,
    "글자 사이 칩은 두 글자의 자원오행(부수 기준)이 전통 오행 이론에서 어떤 관계인지 그 이름만 적은 것이에요. 자원오행끼리의 관계는 이 사이트 점수에 넣지 않습니다. 조화 점수의 발음오행(25점)은 한글 소리로 매기는 다른 항목이에요."
  );
  assert.equal(
    T.FILL_NOTICE,
    "꼬리표는 그 글자의 자원오행이 조화 점수의 ‘자원오행 보완’에서 어떻게 계산됐는지 적은 것이에요. ‘부족한 오행’은 사주 글자에서 평균보다 적은 오행(1개 이하)이고, 오행 찾기의 ‘없는 오행’(0개)보다 넓어요."
  );
  assert.equal(
    T.GISHIN_NOTICE,
    "‘기신(감점)’은 이 계산에서 용신을 누르는 오행이라 ‘자원오행 보완’ 점수가 깎였다는 뜻이에요. 이름이 나쁘다는 판정이 아니라 이 점수 항목의 계산 규칙입니다."
  );
  assert.equal(T.SURNAME_NOTICE, "성씨 글자는 자원오행 보완 점수에 들어가지 않아요.");
  assert.equal(T.MEANING_SCORE_NOTICE, "미학의 ‘의미’ 점수는 음절 기준이라 고른 한자의 뜻은 반영하지 않아요.");
  assert.equal(
    T.NO_BIRTH_NOTICE,
    "한자를 바꾸면 글자의 뜻·자원오행·획수와 자원오행 관계가 바뀌고, 점수는 성별 보너스만 달라질 수 있어요. 출생일을 넣으면 이 한자들로 자원오행 보완·획수 조화·음양·전통 81수리를 계산해요."
  );
  // '조화 점수를 계산하지 않았다'는 같은 화면 조화 자리의 상자가 말한다 — 되풀이하지 않고, 낱말은 입력 폼·그 상자와 같은 '출생일'(검증 지적 — 2026-11-23)
  for (const text of [T.NO_BIRTH_NOTICE, T.SEEN_NO_BIRTH_NOTE]) {
    assert.doesNotMatch(text, /생년월일/);
  }
  assert.doesNotMatch(T.NO_BIRTH_NOTICE, /계산하지 않았어요/);
  assert.equal(T.birthTimeNotice(true), "태어난 시각은 서울 기준으로 보정해 계산했어요(출생지는 받지 않습니다).");
  assert.equal(T.birthTimeNotice(false), "태어난 시각을 넣지 않아 시주 없이 계산했어요.");
  assert.equal(
    T.CANDIDATES_SUBTITLE,
    "음절마다 쓸 수 있는 한자와 부수로 정한 자원오행, 그 판정 등급(확정·이견 있음·예외 적용)이에요. 줄 끝의 ‘이 글자로’를 누르면 그 글자로 바꿔 다시 계산해요."
  );
  assert.equal(
    T.HARMONY_STROKE_NOTICE,
    "획수는 유니코드 총획 기준이에요. 부수를 본래 꼴로 세는 작명소의 원획과 다를 수 있어 획수 조화·음양·81수리 값도 달라질 수 있어요."
  );
});

test("용신 한 줄·/ohaeng 고지 두 줄 — 오행 찾기 결과 화면과 같은 말", () => {
  assert.equal(T.yongshinLine(FIT), "이 사이트 계산으로 본 용신 토(土) · 희신 화(火).");
  assert.equal(T.yongshinLine({ ...FIT, heeshin: null }), "이 사이트 계산으로 본 용신 토(土).");
  assert.equal(T.yongshinLine({ ...FIT, yongshin: null }), null);
  assert.equal(T.yongshinLine(null), null);
  // 두 고지는 /ohaeng 결과 화면의 문장을 그대로 옮긴 것이다 — 그 화면의 문장이 바뀌면 여기서 걸린다
  const ohaeng = read("../src/components/design/OhaengResult.tsx");
  assert.ok(ohaeng.includes(T.YONGSHIN_METHOD_NOTICE), "용신 고지");
  assert.ok(ohaeng.includes(T.FRAME_NOTICE), "해석 틀 고지");
  assert.equal(T.YONGSHIN_METHOD_NOTICE, "용신은 억부·조후 가운데 무엇을 앞세우느냐에 따라 달라져, 다른 곳에서 본 용신과 다를 수 있어요.");
  assert.equal(T.FRAME_NOTICE, "오행과 용신은 전통 작명에서 쓰는 해석 틀입니다. 이 결과는 성격이나 앞날을 알려 주지 않습니다.");
});

test("태어난 시각 안내는 백엔드의 동작과 같다 — 시각이 있으면 보정, 없으면 보정 없이 시주를 뺀다", () => {
  const saju = read("../../Application/Services/SajuCalculationService.cs");
  assert.match(saju, /var solar = hasTime\s*\? clock\.AddMinutes\(place\.CorrectionMinutes\)\s*: birthDate\.Date;/);
  assert.match(saju, /var hourPillar\s*= hasTime\s*\? CalculateHourPillar\(solar\.TimeOfDay, dayPillar\)\s*: null;/);
  // /evaluate 의 조화 계산은 출생지를 넘기지 않는다(기본 출생지 = 서울)
  assert.match(read("../../Application/Engines/HarmonyEngine.cs"), /_sajuCalculationService\.CalculateChart\(birthDate, birthTime\);/);
});

test("칸마다의 안내 — 이름에 피하는 글자·뜻 풀이 없는 글자·한자 없이 둔 칸", () => {
  // '자동 배정' 대신 같은 화면의 말('자동으로 고르기'·'자동으로 고른 한자')로(검증 지적 — 2026-11-23)
  assert.equal(T.forbiddenNote("쥐 서"), "이 사이트가 이름 추천과 자동으로 고르는 한자에서 빼는 글자예요(훈: 쥐 서).");
  assert.equal(T.forbiddenNote(""), "이 사이트가 이름 추천과 자동으로 고르는 한자에서 빼는 글자예요.");
  assert.doesNotMatch(T.forbiddenNote("쥐 서"), /자동 배정/);
  assert.equal(T.NO_MEANING_NOTE, "사전에 뜻 풀이가 없는 글자예요. 획수와 자원오행으로만 계산해요.");
  assert.equal(T.noneNote("윤", false), "‘윤’ 음절은 한자 없이 한글로 두었어요.");
  assert.equal(T.noneNote("윤", true), "‘윤’ 음절은 한자 없이 한글로 두었어요. 이 칸은 획수 조화에서 5획, 81수리에서 0획으로 어림해 계산했어요(추정값).");
  // 출생신고 가부를 말하지 않는다(설계 §20)
  for (const text of [T.forbiddenNote("쥐 서"), T.NO_MEANING_NOTE, T.noneNote("윤", true)]) {
    assert.doesNotMatch(text, /출생신고|인명용/);
  }
});

test("혼용 고지는 한자를 지정한 결과에서 한자 칸과 한글 칸이 함께 있을 때만 — 문장은 입력 화면과 같다(§20-1)", () => {
  const hanja = { syllable: "서", source: "user", fills: [], hanja: F.seo };
  const none = { syllable: "윤", source: "none", fills: [], hanja: null };
  const locked = { syllable: "빛", source: "unavailable", fills: [], hanja: null };
  const auto = { syllable: "윤", source: "auto", fills: [], hanja: F.yun2 };
  assert.equal(T.isMixedResult({ userHanja: true, syllables: [hanja, none] }), true);
  assert.equal(T.isMixedResult({ userHanja: true, syllables: [hanja, locked] }), true);
  assert.equal(T.isMixedResult({ userHanja: true, syllables: [hanja, auto] }), false);
  assert.equal(T.isMixedResult({ userHanja: true, syllables: [none, { ...none, syllable: "서" }] }), false);
  // 한자를 고르지 않은 결과(한빛 — 자동 + 잠긴 칸)에는 붙이지 않는다
  assert.equal(T.isMixedResult({ userHanja: false, syllables: [{ ...auto, syllable: "한" }, locked] }), false);
  assert.match(MIXED_SCRIPT_NOTICE, /현행 가족관계등록예규\(제638호\)는 이렇게 섞어 적은 출생신고도 수리할 수 있다고 정하고 있어요\./);
});

test("조화 패널의 대체값 경고 — 사용자가 비운 칸이 있을 때만 새 문구, 그 밖은 예전 문구(백엔드 노트와 같은 말)", () => {
  const blank = { syllables: [{ syllable: "서", source: "user", fills: [], hanja: F.seo }, { syllable: "윤", source: "none", fills: [], hanja: null }] };
  const locked = { syllables: [{ syllable: "한", source: "auto", fills: [], hanja: F.seo }, { syllable: "빛", source: "unavailable", fills: [], hanja: null }] };
  assert.equal(T.hasUserBlank(blank), true);
  assert.equal(T.hasUserBlank(locked), false);
  assert.equal(T.hasUserBlank(null), false);
  assert.equal(T.fallbackWarning(blank), "⚠ 한자를 두지 않은 음절은 획수를 추정값으로 계산했어요");
  assert.equal(T.fallbackWarning(locked), "⚠ 배정할 한자가 없는 음절이 있어 기본값으로 계산했어요");
  // hanjaSummary 가 없는 응답(옛 백엔드)은 예전 문구
  assert.equal(T.fallbackWarning(null), "⚠ 배정할 한자가 없는 음절이 있어 기본값으로 계산했어요");
  assert.equal(T.fallbackWarning(undefined), "⚠ 배정할 한자가 없는 음절이 있어 기본값으로 계산했어요");
});

// ============================================================
// 자원오행 관계
// ============================================================

test("관계 칩 — 판정은 /name 과 같고 상극도 이름 꼴(누르는 쪽 앞). 한자가 없거나 자원오행을 모르면 칩이 없다", () => {
  assert.deepEqual(T.relationBetween(F.li, F.seo2), { kind: "생", label: "木生火 · 상생" });
  assert.deepEqual(T.relationBetween(F.seo2, F.li), { kind: "생", label: "木生火 · 상생" });
  assert.deepEqual(T.relationBetween(F.seo, F.seo), { kind: "비화", label: "金金 · 비화(같은 기운)" });
  assert.deepEqual(T.relationBetween(F.li, F.seo), { kind: "극", label: "金剋木 · 상극" });
  assert.deepEqual(T.relationBetween(F.seo, F.li), { kind: "극", label: "金剋木 · 상극" });
  assert.equal(T.relationBetween(F.li, null), null);
  assert.equal(T.relationBetween(undefined, F.seo), null);
  assert.equal(T.relationBetween(F.li, { fiveElement: "" }), null);
  // 판정(kind)은 /name 조합 카드의 함수와 같다 — 말만 다르다
  for (const [a, b] of [[F.li, F.seo2], [F.seo, F.seo], [F.li, F.seo], [F.yun, F.seo2]]) {
    assert.equal(T.relationBetween(a, b).kind, ohaengRelation(a.fiveElement, b.fiveElement).kind);
  }
  assert.doesNotMatch(T.relationBetween(F.li, F.seo).label, /부딪/);
});

test("relationsOf: 성씨 끝 글자 → 이름 1, 이름 1 → 이름 2 … 복성의 두 글자 사이는 보지 않는다", () => {
  assert.deepEqual(T.relationsOf([F.li], [F.seo, F.yun2]).map((r) => r?.label ?? null), ["金剋木 · 상극", "土生金 · 상생"]);
  // 복성 — 끝 글자(宮 木)만 이름과 잇는다
  const nam = fact(NAM, "남녘 남", "火", 9);
  const gung = fact(GUNG, "집 궁", "木", 10);
  assert.deepEqual(T.relationsOf([nam, gung], [F.seo2]).map((r) => r?.label ?? null), ["木生火 · 상생"]);
  // 한자가 없는 칸의 앞뒤에는 칩이 없다
  assert.deepEqual(T.relationsOf([F.li], [F.seo, null, F.yun]).map((r) => r?.label ?? null), ["金剋木 · 상극", null, null]);
  // 성씨 글자를 정하지 못했으면 이름 첫 글자 앞에도 없다
  assert.deepEqual(T.relationsOf([], [F.seo, F.yun]).map((r) => r?.label ?? null), [null, "金生水 · 상생"]);
  assert.deepEqual(T.relationsOf([null], [F.seo]).map((r) => r?.label ?? null), [null]);
});

// ============================================================
// 지금까지 본 조합
// ============================================================

test("비교 줄의 문구 — 설계 §9-3", () => {
  assert.equal(T.SEEN_TITLE, "지금까지 본 조합");
  assert.equal(T.SEEN_GUIDE, "같은 조건에서 한자만 바꿔 본 결과예요. 어느 쪽이 낫다는 판정은 하지 않습니다.");
  assert.equal(T.SEEN_AUTO_NOTE, "자동으로 고른 한자는 용신을 반영해 고른 글자라 ‘자원오행 보완’이 높게 나오는 편이에요.");
  assert.equal(T.SEEN_NO_BIRTH_NOTE, "출생일을 넣지 않아 점수 대신 달라지는 사실을 적었어요. 출생일을 넣으면 조화 점수로 비교할 수 있어요.");
});

test("comboLine: 조합 한 줄의 사실 — 글자·자원오행·음양·앞 두 글자 획수 합·관계 이름. 점수는 없다", () => {
  const line = T.comboLine(
    summary({
      userHanja: true,
      syllables: [
        { syllable: "서", source: "user", fills: [], hanja: F.seo },
        { syllable: "윤", source: "auto", fills: [], hanja: F.yun2 },
      ],
    })
  );
  assert.deepEqual(line, {
    surname: LI,
    name: SEO + YUN2,
    hasAuto: true,
    elements: "金·土",
    yinYang: "陽·陰",
    strokeSum: 17, // 13 + 4 — 응답에 실린 두 획수의 합
    relations: ["金剋木 · 상극", "土生金 · 상생"],
  });
  for (const key of Object.keys(line)) assert.doesNotMatch(key, /score|점수/i);
});

test("comboLine: 한자가 없는 칸은 한글 음절로 적고, 획수 합을 지어내지 않는다", () => {
  const line = T.comboLine(
    summary({
      userHanja: true,
      surname: { hangul: "궉", source: "estimated", strokes: 0, chars: [] },
      syllables: [
        { syllable: "서", source: "user", fills: [], hanja: F.seo },
        { syllable: "윤", source: "none", fills: [], hanja: null },
      ],
    })
  );
  assert.equal(line.surname, "궉");
  assert.equal(line.name, `${SEO}윤`);
  assert.equal(line.hasAuto, false);
  assert.equal(line.elements, "金·한글");
  assert.equal(line.yinYang, "陽·한글");
  assert.equal(line.strokeSum, null, "한자 없는 칸의 어림값(5획)을 사실처럼 더하지 않는다");
  assert.deepEqual(line.relations, []);
  // 자원오행을 모르는 글자는 '미상'
  const unknown = T.comboLine(summary({ syllables: [{ syllable: "서", source: "auto", fills: [], hanja: { ...F.seo, fiveElement: "" } }] }));
  assert.equal(unknown.elements, "미상");
  // 쓸 수 있는 한자가 없는 음절뿐이면 자동으로 고른 글자가 없다
  assert.equal(T.comboLine(summary({ syllables: [{ syllable: "빛", source: "unavailable", fills: [], hanja: null }] })).hasAuto, false);
});

// ============================================================
// 저장한 이름(/favorites)
// ============================================================

test("favoriteHanjaLabel: 저장한 조합의 한자 한 줄 — 자동 칸은 '음절(자동)', 한자 없이 둔 칸은 '음절(한글)'", () => {
  const f = (extra) => ({ lastName: "이", name: "서윤", ...extra });
  assert.equal(T.favoriteHanjaLabel(f({ hanja: SEO + YUN })), `이름 ${SEO}${YUN}`);
  assert.equal(T.favoriteHanjaLabel(f({ hanja: SEO })), `이름 ${SEO} 윤(자동)`);
  assert.equal(T.favoriteHanjaLabel(f({ hanja: `*${YUN}` })), `이름 서(자동) ${YUN}`);
  assert.equal(T.favoriteHanjaLabel(f({ hanja: `${SEO}-` })), `이름 ${SEO} 윤(한글)`);
  assert.equal(T.favoriteHanjaLabel({ lastName: "유", name: "서윤", lastHanja: LIU }), `성씨 ${LIU}`);
  assert.equal(T.favoriteHanjaLabel({ lastName: "유", name: "서윤", lastHanja: LIU, hanja: SEO + YUN }), `성씨 ${LIU} · 이름 ${SEO}${YUN}`);
  // 복성에서 한 글자만 고른 저장분 — 고르지 않은 자리는 한글 음절
  assert.equal(T.favoriteHanjaLabel({ lastName: "남궁", name: "민", lastHanja: NAM2 }), `성씨 ${NAM2}궁`);
  // 한자를 고르지 않은 저장분·옛 저장분·읽을 수 없는 값에는 줄이 없다
  for (const none of [f({}), f({ hanja: "", lastHanja: "" }), f({ hanja: null }), f({ hanja: "abc" }), f({ hanja: SEO + YUN + YUN }), { lastName: "Lee", name: "서윤", lastHanja: LI }]) {
    assert.equal(T.favoriteHanjaLabel(none), null, JSON.stringify(none));
  }
  // 훈·점수·판정을 적지 않는다 — 글자와 표시뿐
  assert.doesNotMatch(T.favoriteHanjaLabel(f({ hanja: RAT })), /피하는|쥐/);
});

// ============================================================
// 소스 규칙
// ============================================================

test("순수 모듈 둘 — 지시어·큰 JSON import·콘솔·저장소·네트워크가 없다. 숫자를 만들어 내지 않는다", () => {
  for (const rel of ["../src/lib/hanja-summary-text.ts", "../src/lib/hanja-recalc.ts"]) {
    const src = read(rel);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(src, /^\s*["']use client["']/m, rel);
    for (const re of [/lib\/hanja-seo/, /lib\/name-seo/, /@\/data\//, /from "\.\/hanja-seo"/, /from "\.\/name-seo"/, /\.json"/]) {
      assert.doesNotMatch(code, re, `${rel}: ${re}`);
    }
    for (const re of [/console\./, /localStorage/, /sessionStorage/, /\bfetch\(/, /sendBeacon/, /Math\.random/, /Date\.now/]) {
      assert.doesNotMatch(code, re, `${rel}: ${re}`);
    }
    // 점수 필드로 셈하지 않는다(더하기·빼기·곱하기·반올림) — 점수는 응답 값을 문장에 끼울 뿐이다
    assert.doesNotMatch(code, /Score\s*[-+*/]|[-+*/]\s*\w+\.\w*Score\b|Math\.(round|floor|ceil)/, rel);
  }
});
