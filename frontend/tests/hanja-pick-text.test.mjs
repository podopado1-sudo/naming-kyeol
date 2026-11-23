// 한자 칸·고르기 패널의 화면 문장 테스트 — `npm test`
//
// 2026-11 설계 docs/plan-hanja-input-2026-11.md §8-6·§8-8·§9-2, 법규 사실 §20. lib/hanja-pick-text.ts 는 순수 모듈이라
// 값으로 본다. 기대 문장은 설계서의 문구를 손으로 옮긴 것이다(검사 대상 함수로 기대값을 만들지 않는다).
// 한자는 코드포인트로 적는다(U(0x745E)) — 소스에 호환 한자·보이지 않는 글자를 글자로 두지 않는다(hanja-pick.test.mjs 가 이 파일도 훑는다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const {
  MIXED_SCRIPT_NOTICE,
  SLOTS_EMPTY_GUIDE,
  avoidedGroupIntro,
  guideFacts,
  hangulOnlyHelp,
  isMixedScript,
  judgeTimeoutNote,
  lockedSurnameNote,
  namePanelTitle,
  notInListNote,
  pasteReport,
  pickBannerText,
  searchEmptyNote,
  seedRejectedNote,
  seedUncheckedNote,
  slotAriaLabel,
  slotFace,
  slotNote,
  surnamePanelIntro,
  surnamePanelTitle,
} = await import("../src/lib/hanja-pick-text.ts");
const { noHanjaSyllableNote } = await import("../src/lib/no-hanja.ts");

const U = (cp) => String.fromCodePoint(cp);
const SEO = U(0x745e); // 상서 서
const YUN = U(0x6f64); // 윤택할 윤
const RYU = U(0x67f3); // 버들 류(유)
const LIU = U(0x5289); // 성씨 유
const LI = U(0x674e); // 오얏 리(이)

const fact = (character, gloss, extra = {}) => ({
  character,
  gloss,
  fiveElement: "金",
  resourceGrade: "R",
  vReasons: [],
  strokeCount: 13,
  yinYang: "陽",
  common: false,
  forbidden: false,
  hasMeaning: gloss !== "",
  basic: true,
  ...extra,
});

/** 칸 하나 — deriveSlots 가 내는 꼴 */
const slot = (target, syllable, state, f = null, extra = {}) => ({
  target,
  index: 0,
  syllable,
  state,
  character: f ? f.character : null,
  fact: state === "default" ? null : f,
  mark: f && state !== "default" ? f.character : state === "none" ? "-" : "*",
  openable: state !== "locked",
  ...extra,
});

// ============================================================
// 칸 줄
// ============================================================

test("칸의 모양 — 한자가 정해진 칸은 그 글자, 아니면 '자동'·'한글'·'확인 중'. 성씨 기본 한자에만 꼬리 '기본 한자'", () => {
  assert.deepEqual(slotFace(slot("name", "서", "picked", fact(SEO, "상서 서"))), { glyph: SEO, word: null, tail: null });
  assert.deepEqual(slotFace(slot("name", "서", "carried", fact(SEO, "상서 서"))), { glyph: SEO, word: null, tail: null });
  assert.deepEqual(slotFace(slot("surname", "유", "default", fact(RYU, ""))), { glyph: RYU, word: null, tail: "기본 한자" });
  assert.deepEqual(slotFace(slot("surname", "유", "picked", fact(LIU, ""))), { glyph: LIU, word: null, tail: null });
  assert.deepEqual(slotFace(slot("name", "서", "auto")), { glyph: null, word: "자동", tail: null });
  assert.deepEqual(slotFace(slot("surname", "궉", "auto")), { glyph: null, word: "자동", tail: null });
  // 사용자가 고른 '한자 없이'·쓸 글자가 없는 음절·후보 파일이 없는 이름 음절은 모두 '한글'
  for (const state of ["none", "hangul", "locked"]) {
    assert.deepEqual(slotFace(slot("name", "빛", state)), { glyph: null, word: "한글", tail: null }, state);
  }
  // 후보 파일이 없는 성씨 음절은 '한글'이 아니고 '자동'도 아니다 — 칸 아래 안내가 '성씨 한자는 정할 수 없어요'라고 한다(검증 지적 — 2026-11-23)
  assert.equal(slotFace(slot("surname", "궉", "locked")).word, "없음");
  assert.notEqual(slotFace(slot("surname", "궉", "locked")).word, "자동");
  assert.equal(slotFace(slot("name", "서", "checking")).word, "확인 중");
});

test("칸 버튼의 이름 — 설계 §8-8 의 꼴. 성씨 칸은 훈을 읽지 않는다", () => {
  assert.equal(slotAriaLabel(slot("name", "서", "picked", fact(SEO, "상서 서"))), `‘서’ 음절 한자 — ${SEO}(상서 서), 고른 한자. 바꾸기`);
  // 링크(#pick)로 넣은 글자 — 설계 낱말('들고 온 글자')을 화면 읽기 사용자에게 읽히지 않는다
  assert.equal(slotAriaLabel(slot("name", "서", "carried", fact(SEO, "상서 서"))), `‘서’ 음절 한자 — ${SEO}(상서 서), 링크로 넣은 한자. 바꾸기`);
  assert.doesNotMatch(slotAriaLabel(slot("name", "서", "carried", fact(SEO, "상서 서"))), /들고 온/);
  assert.equal(slotAriaLabel(slot("surname", "유", "default", fact(RYU, "버들 류(유)"))), `‘유’ 성씨 한자 — ${RYU}, 기본 한자. 바꾸기`);
  // 성씨 칸에 훈이 실린 글자 사실이 와도 읽지 않는다(음절 파일은 이름·성씨 패널이 함께 쓴다)
  const surnamePicked = slotAriaLabel(slot("surname", "유", "picked", fact(LIU, "죽일 류(유)")));
  assert.equal(surnamePicked, `‘유’ 성씨 한자 — ${LIU}, 고른 한자. 바꾸기`);
  assert.doesNotMatch(surnamePicked, /죽일/);
  // 뜻 풀이가 없는 글자는 괄호 없이
  assert.equal(slotAriaLabel(slot("name", "서", "picked", fact(SEO, ""))), `‘서’ 음절 한자 — ${SEO}, 고른 한자. 바꾸기`);
  assert.equal(slotAriaLabel(slot("name", "서", "auto")), "‘서’ 음절 한자 — 자동. 고르기");
  assert.equal(slotAriaLabel(slot("name", "윤", "none")), "‘윤’ 음절 한자 — 한자 없이 한글로. 바꾸기");
  assert.equal(slotAriaLabel(slot("name", "몰", "hangul")), "‘몰’ 음절 한자 — 한글. 고르기");
  // 잠긴 칸은 '바꾸기'·'고르기'를 말하지 않는다(누를 수 없다)
  assert.equal(slotAriaLabel(slot("name", "빛", "locked")), "‘빛’ 음절 한자 — 한글");
  assert.equal(slotAriaLabel(slot("surname", "궉", "locked")), "‘궉’ 성씨 한자 — 정할 수 없음");
  assert.equal(slotAriaLabel(slot("name", "서", "checking")), "‘서’ 음절 한자 — 확인 중");
  // 결과 화면의 칸 — 글자가 든 자동 칸: 서버가 자동으로 고른 이름 글자, 대표 한자 표에 없는 성씨의 추정 글자(입력 폼의 자동 칸에는 글자가 없다)
  assert.equal(slotAriaLabel(slot("name", "윤", "auto", fact(YUN, "윤택할 윤"))), `‘윤’ 음절 한자 — ${YUN}(윤택할 윤), 자동으로 고른 한자. 바꾸기`);
  assert.equal(slotAriaLabel(slot("surname", "유", "auto", fact(LIU, "죽일 류(유)"))), `‘유’ 성씨 한자 — ${LIU}, 추정한 한자. 바꾸기`);
});

test("잠긴 칸·쓸 글자가 없는 칸의 안내 — 이름 칸은 lib/no-hanja 의 문장 그대로, 성씨 칸은 서버의 성씨용 말", () => {
  assert.equal(slotNote(slot("name", "빛", "locked")), noHanjaSyllableNote("빛"));
  assert.equal(slotNote(slot("name", "몰", "hangul")), noHanjaSyllableNote("몰"));
  assert.equal(slotNote(slot("name", "빛", "locked")), "‘빛’ 음절은 이름에 쓸 만한 인명용 한자가 없어 한글로 두기를 권해요.");
  assert.equal(slotNote(slot("surname", "궉", "locked")), "이 사이트 사전에는 ‘궉’ 음절로 읽는 한자가 없어 이 칸의 성씨 한자는 정할 수 없어요.");
  assert.equal(lockedSurnameNote("궉"), slotNote(slot("surname", "궉", "locked")));
  // 그 밖의 칸에는 안내가 없다 — 사용자가 고른 '한자 없이'에도 붙지 않는다
  for (const s of [slot("name", "서", "auto"), slot("name", "서", "none"), slot("name", "서", "picked", fact(SEO, "상서 서")), slot("surname", "유", "default", fact(RYU, "")), slot("surname", "유", "auto")]) {
    assert.equal(slotNote(s), null, s.state);
  }
  // 성씨 칸의 안내는 이름용 판정을 말하지 않는다
  assert.doesNotMatch(lockedSurnameNote("궉"), /인명용|출생신고/);
});

test("주소로 온 한자를 비운 안내 · 이름을 넣기 전의 안내", () => {
  assert.equal(seedRejectedNote(YUN, "서"), `‘${YUN}’ 글자는 ‘서’ 음절 후보에 없어 비웠어요.`);
  assert.equal(SLOTS_EMPTY_GUIDE, "이름을 넣으면 음절마다 한자 칸이 생겨요. 한자는 고르지 않아도 됩니다.");
});

test("주소로 온 한자를 확인할 목록을 받지 못한 안내 — 그 칸을 자동으로 두었다는 것과 어느 칸인지를 말한다(검증 지적 — 2026-11-23)", () => {
  assert.equal(
    seedUncheckedNote(["윤"]),
    "주소로 넘어온 한자를 확인할 목록을 불러오지 못해 ‘윤’ 칸은 자동으로 두었어요. 칸을 눌러 목록을 다시 열거나 한자를 직접 붙여 넣어 주세요."
  );
  // 칸이 여럿이면 가운뎃점으로, 같은 음절(하하)은 한 번
  assert.match(seedUncheckedNote(["서", "윤"]), /목록을 불러오지 못해 ‘서’·‘윤’ 칸은 자동으로 두었어요\./);
  assert.match(seedUncheckedNote(["하", "하"]), /못해 ‘하’ 칸은/);
  // 옛 문장(무엇을 다시 열라는지·한자를 비웠다는 말이 없던 패널 문장)을 쓰지 않는다
  assert.doesNotMatch(seedUncheckedNote(["윤"]), /잠시 뒤 다시 열어/);
});

test("한글·한자 혼용 — 한자가 든 칸과 한글로 두는 칸이 함께일 때만. 자동 칸은 세지 않는다", () => {
  const picked = slot("name", "서", "picked", fact(SEO, "상서 서"));
  const carried = slot("name", "서", "carried", fact(SEO, "상서 서"));
  const auto = slot("name", "윤", "auto");
  assert.equal(isMixedScript([picked, slot("name", "윤", "none")]), true);
  assert.equal(isMixedScript([carried, slot("name", "빛", "locked")]), true);
  assert.equal(isMixedScript([picked, slot("name", "몰", "hangul")]), true);
  assert.equal(isMixedScript([picked, auto]), false, "자동 칸은 서버가 한자를 고른다");
  assert.equal(isMixedScript([slot("name", "한", "auto"), slot("name", "빛", "locked")]), false, "한자를 고르지 않은 '한빛'");
  assert.equal(isMixedScript([slot("name", "서", "none"), slot("name", "윤", "none")]), false, "전부 한글");
  assert.equal(isMixedScript([picked, slot("name", "윤", "picked", fact(YUN, "윤택할 윤"))]), false);
  assert.equal(isMixedScript(null), false);
  assert.equal(isMixedScript([]), false);
  // 고지 문장은 현행 예규대로(설계 §20-1) — 옛 초안의 반대 문구가 아니다
  assert.equal(
    MIXED_SCRIPT_NOTICE,
    "한글과 한자를 섞은 이름이에요. 현행 가족관계등록예규(제638호)는 이렇게 섞어 적은 출생신고도 수리할 수 있다고 정하고 있어요. 한자로 적는 글자는 인명용 한자여야 합니다."
  );
});

// ============================================================
// 들고 온 글자의 띠
// ============================================================

test("띠 — 독음 하나·둘, 이름이 2음절 이상인데 들어갈 음절이 없으면 문장이 바뀐다", () => {
  const one = `${SEO}(서) 글자를 넣어 볼게요. 이름에 ‘서’ 음절이 있으면 그 칸에 넣어 드려요.`;
  assert.equal(pickBannerText(SEO, ["서"], ""), one);
  assert.equal(pickBannerText(SEO, ["서"], "서윤"), one);
  assert.equal(pickBannerText(SEO, ["서"], "윤서"), one);
  // 한 음절뿐이면 아직 치는 중일 수 있다 — 바꾸지 않는다
  assert.equal(pickBannerText(SEO, ["서"], "민"), one);
  assert.equal(pickBannerText(SEO, ["서"], "민준"), `입력한 이름에는 ‘${SEO}’(서) 글자로 읽는 음절이 없어요.`);
  // 독음 둘 — 변수 뒤에 조사를 쓰지 않는다(‘리’나 가 아니라 ‘리’ 또는 ‘이’ 음절이)
  assert.equal(
    pickBannerText(LI, ["리", "이"], ""),
    `${LI}(리·이) 글자를 넣어 볼게요. 이름에 ‘리’ 또는 ‘이’ 음절이 있으면 그 칸에 넣어 드려요.`
  );
  assert.equal(pickBannerText(LI, ["리", "이"], "민준"), `입력한 이름에는 ‘${LI}’(리·이) 글자로 읽는 음절이 없어요.`);
  // 들어갈 음절은 독음과 그 두음 꼴이다 — '록' 글자는 '녹' 칸에도 들어간다(한쪽 방향)
  const ROK = U(0x742d);
  assert.match(pickBannerText(ROK, ["록"], "녹원"), /넣어 볼게요/);
  assert.match(pickBannerText(ROK, ["록"], "민준"), /읽는 음절이 없어요/);
  // 띠가 말하는 음절도 칸에 들어가는 음절과 같다 — 독음 목록에 두음 꼴이 없는 글자(娌 리)는 ‘리’ 또는 ‘이’(검증 지적 — 2026-11-23,
  // 옛 띠는 ‘리’ 만 말하고 '서이'의 '이' 칸에 넣었다). 괄호 안은 확인된 독음 그대로
  const LI2 = U(0x5a0c); // 娌 동서 리
  assert.equal(
    pickBannerText(LI2, ["리"], "서이"),
    `${LI2}(리) 글자를 넣어 볼게요. 이름에 ‘리’ 또는 ‘이’ 음절이 있으면 그 칸에 넣어 드려요.`
  );
  assert.equal(
    pickBannerText(ROK, ["록"], ""),
    `${ROK}(록) 글자를 넣어 볼게요. 이름에 ‘록’ 또는 ‘녹’ 음절이 있으면 그 칸에 넣어 드려요.`
  );
  const NA = U(0x5a1c); // 지정 독음 '나' — '라' 칸에는 들어가지 않는다(두음 꼴은 한쪽 방향이라 띠도 ‘나’ 만)
  assert.match(pickBannerText(NA, ["나"], "라희"), /읽는 음절이 없어요/);
  assert.match(pickBannerText(NA, ["나"], ""), /이름에 ‘나’ 음절이 있으면/);
  // 낱자모가 남은 이름은 판정하지 않는다
  assert.equal(pickBannerText(SEO, ["서"], "민ㅈ"), one);
});

// ============================================================
// 고르기 패널
// ============================================================

test("패널 제목·설명", () => {
  assert.equal(namePanelTitle("서"), "‘서’ 음절 한자 고르기");
  assert.equal(surnamePanelTitle("유"), "‘유’ 성씨 한자 고르기");
  // 기본 한자가 있는 성씨만 '맨 위에 두었어요'를 말한다
  assert.match(surnamePanelIntro(true), /^기본으로 두는 한자 하나를 맨 위에 두었어요\. /);
  assert.doesNotMatch(surnamePanelIntro(false), /맨 위에/);
  for (const intro of [surnamePanelIntro(true), surnamePanelIntro(false)]) {
    assert.match(intro, /성씨에 쓰는 글자만 추린 목록은 아니에요\. 본관에 따라 한자가 다를 수 있어요\.$/);
    // 사전은 인명용 한자 전부를 싣지 못한다(설계 §20-4) — '인명용 한자 전체'라고 쓰지 않는다
    assert.match(intro, /이 사이트 사전에서 이 음절로 읽는 한자 전체/);
    assert.doesNotMatch(intro, /인명용 한자 전(체|부)/);
    assert.doesNotMatch(intro, /가장 흔한|많이 쓰는/);
  }
});

test("묶음 설명의 숫자는 색인(index.json)에서 — 못 받았으면 숫자 없이", () => {
  assert.match(avoidedGroupIntro(991), /빼기로 정한 991자예요\. 인명용 한자 목록에 있는 글자이고, 고르면 그대로 계산합니다\./);
  assert.match(avoidedGroupIntro(1234), /1,234자예요/);
  for (const missing of [null, undefined, 0]) assert.match(avoidedGroupIntro(missing), /빼기로 정한 글자예요\./);
  assert.match(avoidedGroupIntro(991), /이 묶음 밖 글자의 뜻이 모두 이름에 어울린다는 말은 아니니 훈을 함께 보세요\.$/);
});

test("찾기 0건 — 직접 입력 칸이 놓인 자리를 가리킨다(PC 는 위, 그 밖은 아래의 접힌 버튼)", () => {
  assert.equal(searchEmptyNote(true), "찾는 글자가 없어요. 위 ‘직접 입력’에 붙여 넣어 확인해 보세요.");
  assert.equal(searchEmptyNote(false), "찾는 글자가 없어요. 아래 ‘복사한 한자 붙여 넣기’에 붙여 넣어 확인해 보세요.");
});

test("직접 입력의 문장 — 한글만 친 상태·목록에 없는 글자·5초를 넘겼을 때", () => {
  assert.equal(hangulOnlyHelp("서"), "‘서’ 음절을 한글로 친 뒤 한자 키(또는 오른쪽 Ctrl, 맥은 Option+Return)로 바꿔 주세요.");
  assert.equal(notInListNote("서"), "‘서’ 음절 후보에 없는 글자예요.");
  assert.equal(
    judgeTimeoutNote("name"),
    "이유를 확인하지 못했어요. 출생신고에 쓸 수 있는 글자인지는 대법원 인명용 한자 조회에서 확인할 수 있어요."
  );
  // 성씨는 인명용 한자 제한을 받지 않는다 — 그 안내를 하지 않는다
  assert.equal(judgeTimeoutNote("surname"), "이유를 확인하지 못했어요. 비워 두면 기본으로 두는 성씨 한자로 계산해요.");
  assert.doesNotMatch(judgeTimeoutNote("surname"), /인명용|출생신고/);
});

test("직접 입력의 문장 — PC 가 아니면 한자 키 안내 대신 붙여넣기, 목록을 받기 전의 시간 초과, 기본 한자가 없는 성씨(검증 지적 — 2026-11-23)", () => {
  // PC 가 아닐 때(아이폰 기본 자판에는 한자 변환이 없다 — 설계 §3-3) 이 칸은 패널 아래쪽의 '한자 붙여 넣기'다
  assert.equal(hangulOnlyHelp("서", { pc: true }), hangulOnlyHelp("서"));
  assert.equal(hangulOnlyHelp("서", { pc: false }), "‘서’ 음절의 한자를 복사해 여기에 붙여 넣거나, 위 목록에서 골라 주세요.");
  assert.equal(hangulOnlyHelp("서", { pc: false, listAbove: false }), "‘서’ 음절의 한자를 복사해 여기에 붙여 넣어 주세요.");
  for (const text of [hangulOnlyHelp("서", { pc: false }), hangulOnlyHelp("서", { pc: false, listAbove: false })]) {
    assert.doesNotMatch(text, /Ctrl|Option|한자 키/);
  }
  // 음절 목록을 받기 전(known=false)에는 앞에 '후보에 없는 글자예요'가 없다 — '이유를'로 시작하지 않는다
  assert.equal(
    judgeTimeoutNote("name", { known: false }),
    "이 글자를 확인하지 못했어요. 출생신고에 쓸 수 있는 글자인지는 대법원 인명용 한자 조회에서 확인할 수 있어요."
  );
  assert.equal(judgeTimeoutNote("surname", { known: false }), "이 글자를 확인하지 못했어요. 비워 두면 기본으로 두는 성씨 한자로 계산해요.");
  // 대표 한자 표에 없는 성씨(찬) — 비워 두면 이 사이트가 추정한다(패널 버튼 '자동으로 고르기'·결과 꼬리 '추정한 성씨 한자'와 같은 말)
  assert.equal(
    judgeTimeoutNote("surname", { hasDefault: false }),
    "이유를 확인하지 못했어요. 비워 두면 이 사이트가 추정한 성씨 한자로 계산해요."
  );
  assert.equal(
    judgeTimeoutNote("surname", { known: false, hasDefault: false }),
    "이 글자를 확인하지 못했어요. 비워 두면 이 사이트가 추정한 성씨 한자로 계산해요."
  );
  // 이름 칸은 기본 한자와 무관하다
  assert.equal(judgeTimeoutNote("name", { hasDefault: false }), judgeTimeoutNote("name"));
  for (const known of [true, false]) {
    for (const hasDefault of [true, false]) assert.doesNotMatch(judgeTimeoutNote("surname", { known, hasDefault }), /인명용|출생신고/);
  }
});

test("나눠 넣은 결과 — 넣은 수 한 줄, 건너뛴 글자마다 한 줄", () => {
  const nameSlot = (syllable, extra) => slot("name", syllable, "auto", null, extra);
  const step = (status, character, s) => ({ position: 0, slot: s, character, status, fact: status === "placed" ? fact(character, "뜻") : null });

  const all = pasteReport([step("placed", SEO, nameSlot("서")), step("placed", YUN, nameSlot("윤"))], []);
  assert.deepEqual(all, { placed: 2, status: "한자 2자를 칸에 나눠 넣었어요.", alerts: [] });

  const mixed = pasteReport(
    [
      step("placed", SEO, nameSlot("서")),
      step("rejected", YUN, nameSlot("아")),
      step("locked", YUN, nameSlot("빛", { openable: false, state: "locked" })),
      step("pending", YUN, nameSlot("윤")),
    ],
    [SEO, YUN]
  );
  assert.equal(mixed.placed, 1);
  assert.equal(mixed.status, "한자 1자를 칸에 나눠 넣었어요.");
  assert.deepEqual(mixed.alerts, [
    `‘${YUN}’ 글자는 ‘아’ 음절 후보에 없어 넣지 않았어요.`,
    // 잠긴 칸에도 까닭을 적는다(다른 갈래 문장처럼 — 검증 지적 2026-11-23)
    `‘${YUN}’ 글자는 넣지 않았어요 — ‘빛’ 칸은 한자를 고를 수 없는 칸이에요.`,
    `‘${YUN}’ 글자는 확인하지 못해 넣지 않았어요.`,
    "칸보다 글자가 많아 뒤의 2자는 넣지 않았어요.",
  ]);

  // 하나도 못 넣었으면 '넣었어요'를 말하지 않는다
  const none = pasteReport([step("rejected", YUN, nameSlot("서"))], []);
  assert.equal(none.placed, 0);
  assert.equal(none.status, null);
  assert.equal(none.alerts.length, 1);
  assert.deepEqual(pasteReport([], []), { placed: 0, status: null, alerts: [] });
});

// ============================================================
// 설명 글의 숫자(app/evaluate/EvaluateHanjaGuide.tsx) — 설계 §9-6
// ============================================================

test("설명 글의 숫자 — index.json 의 값을 그대로, 가장 많은 음절은 글자 수가 가장 큰 음절(같으면 가나다 순으로 앞)", () => {
  const index = {
    version: 1,
    counts: { characters: 30, syllables: 4, pairs: 33, forbidden: 5, common: 2 },
    syllables: { 하: { all: 7, usable: 6 }, 나: { all: 12, usable: 9 }, 다: { all: 12, usable: 12 }, 몰: { all: 2, usable: 0, autoEmpty: true } },
    surnames: {},
  };
  assert.deepEqual(guideFacts(index), {
    characters: 30,
    syllables: 4,
    forbidden: 5,
    common: 2,
    // '쓸 수 있는 글자' 수(usable)가 아니라 패널 머리와 같은 그 음절의 글자 전체(all) — 나(12·9)가 다(12·12)보다 앞선다
    widest: { syllable: "나", count: 12 },
  });
  // 음절이 하나도 없으면 그 문장을 쓰지 않는다
  assert.equal(guideFacts({ ...index, syllables: {} }).widest, null);
});

test("설명 글의 숫자가 뜻하는 것 — 커밋된 음절 파일을 직접 세어 견준다(글의 문장이 참인지)", () => {
  // 기대값은 guideFacts·index.json 을 거치지 않고 음절 파일 489개에서 따로 센다
  const dir = fileURLToPath(new URL("../public/data/hanja-pick/v1/", import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json");
  const characters = new Set();
  const forbidden = new Set();
  const common = new Set();
  let widest = { syllable: "", count: 0 };
  const sizes = [];
  for (const f of files) {
    const file = JSON.parse(readFileSync(dir + f, "utf8"));
    sizes.push(file.hanja.length);
    if (file.hanja.length > widest.count) widest = { syllable: file.syllable, count: file.hanja.length };
    for (const h of file.hanja) {
      characters.add(h.character);
      if (h.forbidden) forbidden.add(h.character);
      if (h.common) common.add(h.character);
    }
  }
  const facts = guideFacts(JSON.parse(readFileSync(dir + "index.json", "utf8")));
  // '인명용 한자 N자가 M개 음절에 실려 있어요'
  assert.equal(facts.characters, characters.size);
  assert.equal(facts.syllables, files.length);
  // '한 음절에 고를 수 있는 글자는 많게는 K자(‘유’)예요' — 가장 많은 음절은 하나뿐이다(둘이면 글의 문장을 고쳐야 한다)
  assert.deepEqual(facts.widest, widest);
  assert.equal(sizes.filter((n) => n === widest.count).length, 1, "글자가 가장 많은 음절이 둘 이상이다");
  // '이름에 피하는 글자 … N자' · '먼저 보여 드리는 글자(N자)'
  assert.equal(facts.forbidden, forbidden.size);
  assert.equal(facts.common, common.size);
});
