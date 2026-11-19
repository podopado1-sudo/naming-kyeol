// /evaluate 결과 화면 '한자 바꿔 다시 계산하기'의 순수 로직 테스트 — `npm test`
//
// 2026-11 설계 docs/plan-hanja-input-2026-11.md §8-2(제자리 재계산)·§10-3(공유). lib/hanja-recalc.ts 는 순수 모듈이라 값으로 본다.
// 기대값은 손으로 적은 표다(검사 대상 함수로 기대값을 만들지 않는다). 한자는 코드포인트로 적는다 —
// 호환 한자·BMP 밖 글자·보이지 않는 글자를 소스에 글자로 두지 않는다(hanja-pick.test.mjs 가 이 파일도 훑는다).
import { test } from "node:test";
import assert from "node:assert/strict";

import "./resolve-ts.mjs";

const { CACHE_LIMIT, SEEN_LIMIT, baseSignature, cachePut, mergePending, nextHanjaInput, pushSeen, shareHanja } =
  await import("../src/lib/hanja-recalc.ts");
const { apiHanjaFields, blockView } = await import("../src/lib/hanja-pick.ts");
const { evaluateHref, inputFromParams, inputSignature } = await import("../src/app/evaluate/evaluate-params.ts");

const U = (cp) => String.fromCodePoint(cp);
const SEO = U(0x745e); // 상서 서
const SEO2 = U(0x66f8); // 글 서
const YUN = U(0x6f64); // 윤택할 윤
const YUN2 = U(0x5141); // 맏 윤
const LI = U(0x674e); // 오얏 리(이)
const LIU = U(0x5289); // 성씨 유
const NAM = U(0x7537); // 사내 남
const GUNG = U(0x5bae); // 집 궁

const fact = (character, fiveElement = "金", extra = {}) => ({
  character,
  gloss: "훈",
  fiveElement,
  resourceGrade: "R",
  vReasons: [],
  strokeCount: 13,
  yinYang: "陽",
  common: false,
  forbidden: false,
  hasMeaning: true,
  basic: true,
  ...extra,
});
const pick = (character) => ({ kind: "hanja", fact: fact(character) });
const NONE_CHOICE = { kind: "none" };
const AUTO_CHOICE = { kind: "auto" };

const input = (extra = {}) => ({
  lastName: "이",
  name: "서윤",
  birthDate: "2025-03-02",
  birthTime: "",
  gender: "none",
  tone: "neutral",
  hanja: "",
  lastHanja: "",
  ...extra,
});

// ============================================================
// 칸 하나를 바꾼 다음 입력
// ============================================================

test("nextHanjaInput: 이름 칸 — 고른 글자·한자 없이·자동, 끝의 자동은 주소 꼴에서 빠진다", () => {
  const base = input();
  assert.equal(nextHanjaInput(base, "name", 0, pick(SEO)).hanja, SEO); // 둘째 칸 자동 → 끝의 * 생략
  assert.equal(nextHanjaInput(base, "name", 1, pick(YUN)).hanja, `*${YUN}`);
  assert.equal(nextHanjaInput(base, "name", 1, NONE_CHOICE).hanja, "*-");
  // 고른 칸 옆 칸을 더 고른다 — 앞 칸은 그대로
  const one = nextHanjaInput(base, "name", 0, pick(SEO));
  assert.equal(nextHanjaInput(one, "name", 1, pick(YUN)).hanja, SEO + YUN);
  assert.equal(nextHanjaInput(one, "name", 1, NONE_CHOICE).hanja, `${SEO}-`);
  // 고른 칸을 자동으로 되돌리면 지정 없음("")으로 돌아온다
  assert.equal(nextHanjaInput(one, "name", 0, AUTO_CHOICE).hanja, "");
  assert.equal(nextHanjaInput(input({ hanja: SEO + YUN }), "name", 1, AUTO_CHOICE).hanja, SEO);
  assert.equal(nextHanjaInput(input({ hanja: SEO + YUN }), "name", 0, AUTO_CHOICE).hanja, `*${YUN}`);
});

test("nextHanjaInput: 성씨 칸 — 고른 글자·기본 한자로. 성씨에는 '한자 없이'가 없다", () => {
  const yu = input({ lastName: "유" });
  assert.equal(nextHanjaInput(yu, "surname", 0, pick(LIU)).lastHanja, LIU);
  assert.equal(nextHanjaInput(input({ lastName: "유", lastHanja: LIU }), "surname", 0, AUTO_CHOICE).lastHanja, "");
  // '한자 없이'가 잘못 와도 `-` 를 쓰지 않는다(서버가 surname_none 으로 막는 값이다)
  assert.equal(nextHanjaInput(yu, "surname", 0, NONE_CHOICE).lastHanja, "");
  // 복성 — 한 글자만 고르면 나머지 자리는 자동(주소 꼴에서 끝의 * 생략). 정규 꼴(전체 길이)에서 한 자리를 되돌리면 그 자리만 *
  const namgung = input({ lastName: "남궁", name: "민" });
  assert.equal(nextHanjaInput(namgung, "surname", 0, pick(NAM)).lastHanja, NAM);
  assert.equal(nextHanjaInput(namgung, "surname", 1, pick(GUNG)).lastHanja, `*${GUNG}`);
  assert.equal(nextHanjaInput(input({ lastName: "남궁", name: "민", lastHanja: NAM + GUNG }), "surname", 0, AUTO_CHOICE).lastHanja, `*${GUNG}`);
});

test("nextHanjaInput: 다른 값은 건드리지 않고, 칸 밖의 자리는 입력을 그대로 돌려준다", () => {
  const base = input({ lastHanja: LI, hanja: SEO, birthTime: "09:30", gender: "female", tone: "soft" });
  const next = nextHanjaInput(base, "name", 1, pick(YUN));
  assert.deepEqual({ ...next, hanja: "" }, { ...base, hanja: "" });
  assert.notEqual(next, base, "입력을 고쳐 쓰지 않고 새 객체를 돌려준다");
  assert.equal(base.hanja, SEO);
  // 이름은 두 칸(0·1), 성씨는 한 칸(0)
  for (const index of [-1, 2, 0.5, NaN]) assert.equal(nextHanjaInput(base, "name", index, pick(YUN)), base, `이름 ${index}`);
  for (const index of [-1, 1, 0.5, NaN]) assert.equal(nextHanjaInput(base, "surname", index, pick(LIU)), base, `성씨 ${index}`);
});

test("nextHanjaInput 의 결과는 요청 필드로 풀리고(전체 길이), 주소로 왕복해도 같은 서명이다", () => {
  const next = nextHanjaInput(nextHanjaInput(input(), "name", 0, pick(SEO)), "name", 1, NONE_CHOICE);
  assert.deepEqual(apiHanjaFields(next), { nameHanja: `${SEO}-` });
  assert.deepEqual(apiHanjaFields(nextHanjaInput(input(), "name", 0, pick(SEO))), { nameHanja: `${SEO}*` });
  for (const value of [next, nextHanjaInput(input({ lastName: "유" }), "surname", 0, pick(LIU)), nextHanjaInput(input(), "name", 1, pick(YUN))]) {
    const href = evaluateHref(value, { withBirth: true });
    const back = inputFromParams(new URLSearchParams(href.split("?")[1]));
    assert.equal(inputSignature(back), inputSignature(value), href);
  }
});

// ============================================================
// 응답을 기다리는 동안의 바뀐 칸 묶음
// ============================================================

test("mergePending: 칸을 더하고, 같은 칸을 다시 바꾸면 나중 것이 남는다 — 받은 묶음은 고쳐 쓰지 않는다", () => {
  const a = mergePending(null, "name", 0, pick(SEO));
  assert.deepEqual(Object.keys(a.name), ["0"]);
  assert.deepEqual(a.surname, {});
  const b = mergePending(a, "name", 1, NONE_CHOICE);
  assert.deepEqual(Object.keys(b.name), ["0", "1"]);
  assert.deepEqual(Object.keys(a.name), ["0"], "앞 묶음은 그대로");
  const c = mergePending(b, "name", 0, pick(SEO2));
  assert.equal(c.name[0].fact.character, SEO2);
  assert.equal(c.name[1].kind, "none");
  const d = mergePending(c, "surname", 0, pick(LIU));
  assert.equal(d.surname[0].fact.character, LIU);
  assert.equal(d.name[0].fact.character, SEO2);
  assert.deepEqual(mergePending(undefined, "surname", 1, AUTO_CHOICE), { name: {}, surname: { 1: AUTO_CHOICE } });
});

test("바뀐 칸 묶음은 블록에 바로 그려진다 — 두 칸을 잇달아 바꾸면 두 칸이 함께 바뀌고, 묶음을 걷으면 확정된 글자로 돌아간다", () => {
  const shown = {
    userHanja: false,
    nameHanja: "",
    lastNameHanja: "",
    surname: { hangul: "이", source: "default", strokes: 7, chars: [fact(LI, "木")] },
    syllables: [
      { syllable: "서", source: "auto", fills: [], hanja: fact(SEO2, "火") },
      { syllable: "윤", source: "auto", fills: [], hanja: fact(YUN2, "土") },
    ],
    elementFit: null,
  };
  const pending = mergePending(mergePending(null, "name", 0, pick(SEO)), "name", 1, pick(YUN));
  const view = blockView(shown, pending);
  assert.equal(view.waiting, true);
  assert.deepEqual(view.syllables.map((s) => [s.hanja.character, s.source]), [[SEO, "user"], [YUN, "user"]]);
  // 실패 복귀 = 묶음을 걷는다(null) → 마지막으로 계산이 끝난 응답의 글자
  const back = blockView(shown, null);
  assert.equal(back.waiting, false);
  assert.deepEqual(back.syllables.map((s) => [s.hanja.character, s.source]), [[SEO2, "auto"], [YUN2, "auto"]]);
});

// ============================================================
// 본 조합 목록 · 캐시
// ============================================================

test("baseSignature: 한자만 다르면 같은 바탕, 그 밖의 값이 다르면 다른 바탕", () => {
  const base = baseSignature(input());
  assert.equal(baseSignature(input({ hanja: SEO, lastHanja: LI })), base);
  for (const other of [{ name: "서연" }, { lastName: "김" }, { birthDate: "" }, { birthTime: "09:30" }, { gender: "female" }, { tone: "soft" }]) {
    assert.notEqual(baseSignature(input(other)), base, JSON.stringify(other));
  }
  // 서명은 한자까지 본다 — 같은 바탕의 두 조합은 서명이 다르다
  assert.notEqual(inputSignature(input({ hanja: SEO })), inputSignature(input()));
});

test("pushSeen: 지금 조합 + 최근 3개 — 넘치면 가장 오래전에 본 것부터 빠지고 방금 넣은 조합은 남는다", () => {
  assert.equal(SEEN_LIMIT, 4);
  let list = [];
  for (const sig of ["a", "b", "c", "d"]) list = pushSeen(list, { sig, base: "B", value: sig.toUpperCase() });
  assert.deepEqual(list.map((e) => e.sig), ["a", "b", "c", "d"]);
  // 본 조합을 다시 보면 자리는 그대로, 순번만 최근으로
  list = pushSeen(list, { sig: "a", base: "B", value: "A2" });
  assert.deepEqual(list.map((e) => [e.sig, e.value]), [["a", "A2"], ["b", "B"], ["c", "C"], ["d", "D"]]);
  // 다섯째가 오면 가장 오래전에 본 b 가 빠진다(a 는 방금 다시 봤다)
  list = pushSeen(list, { sig: "e", base: "B", value: "E" });
  assert.deepEqual(list.map((e) => e.sig), ["a", "c", "d", "e"]);
  list = pushSeen(list, { sig: "f", base: "B", value: "F" });
  assert.deepEqual(list.map((e) => e.sig), ["a", "d", "e", "f"]);
  // 방금 넣은 조합은 순번이 가장 크다
  assert.equal(list.reduce((max, e) => (e.at > max.at ? e : max)).sig, "f");
  // 받은 목록은 고쳐 쓰지 않는다
  const frozen = Object.freeze(list.map((e) => Object.freeze(e)));
  assert.doesNotThrow(() => pushSeen(frozen, { sig: "g", base: "B", value: "G" }));
});

test("pushSeen: 바탕이 바뀌면 목록이 새로 시작한다", () => {
  let list = [];
  for (const sig of ["a", "b"]) list = pushSeen(list, { sig, base: "B1", value: sig });
  list = pushSeen(list, { sig: "x", base: "B2", value: "x" });
  assert.deepEqual(list.map((e) => [e.sig, e.base]), [["x", "B2"]]);
  // 한 개뿐인 목록은 화면에 비교 줄을 그리지 않는다(2개 이상일 때만) — 여기서는 수만 본다
  assert.equal(list.length, 1);
});

test("cachePut: 최대 8개 — 넘치면 가장 오래된 키부터 빠지고, 다시 넣은 키는 최근으로 간다", () => {
  assert.equal(CACHE_LIMIT, 8);
  const cache = new Map();
  for (let i = 1; i <= 8; i++) cachePut(cache, `k${i}`, i);
  cachePut(cache, "k1", 100); // 다시 넣음 → 최근
  cachePut(cache, "k9", 9);
  assert.equal(cache.size, 8);
  assert.equal(cache.has("k2"), false, "가장 오래된 k2 가 빠진다");
  assert.equal(cache.get("k1"), 100);
  assert.deepEqual([...cache.keys()].slice(-2), ["k1", "k9"]);
  const small = new Map();
  for (const key of ["a", "b", "c"]) cachePut(small, key, key, 2);
  assert.deepEqual([...small.keys()], ["b", "c"]);
});

// ============================================================
// 공유 링크에 실을 한자 (설계 §10-3)
// ============================================================

const summary = (userHanja, syllables, extra = {}) => ({
  userHanja,
  nameHanja: "",
  lastNameHanja: "",
  surname: { hangul: "이", source: "default", strokes: 7, chars: [fact(LI, "木")] },
  syllables,
  elementFit: null,
  ...extra,
});

test("shareHanja: 한자를 고른 결과는 화면에 보인 이름 글자를 모두 싣는다 — 자동 칸도 그 글자로", () => {
  const mixed = summary(true, [
    { syllable: "서", source: "user", fills: [], hanja: fact(SEO) },
    { syllable: "윤", source: "auto", fills: [], hanja: fact(YUN2, "土") },
  ]);
  assert.deepEqual(shareHanja(mixed, { hanja: SEO, lastHanja: "" }), { hanja: SEO + YUN2, lastHanja: "" });
  // 한자 없이 둔 칸은 `-`, 쓸 수 있는 한자가 없는 음절은 `*`(끝이면 생략)
  const none = summary(true, [
    { syllable: "서", source: "user", fills: [], hanja: fact(SEO) },
    { syllable: "윤", source: "none", fills: [], hanja: null },
  ]);
  assert.deepEqual(shareHanja(none, { hanja: `${SEO}-`, lastHanja: "" }), { hanja: `${SEO}-`, lastHanja: "" });
  const locked = summary(true, [
    { syllable: "한", source: "user", fills: [], hanja: fact(U(0x6f22)) },
    { syllable: "빛", source: "unavailable", fills: [], hanja: null },
  ]);
  assert.deepEqual(shareHanja(locked, { hanja: U(0x6f22), lastHanja: "" }), { hanja: U(0x6f22), lastHanja: "" });
  // 성씨 한자는 고른 것(입력의 값)만 — 기본 한자·추정 한자는 받는 쪽에서도 같은 글자다
  const surnameOnly = summary(true, [
    { syllable: "서", source: "auto", fills: [], hanja: fact(SEO2, "火") },
    { syllable: "윤", source: "auto", fills: [], hanja: fact(YUN2, "土") },
  ]);
  assert.deepEqual(shareHanja(surnameOnly, { hanja: "", lastHanja: LIU }), { hanja: SEO2 + YUN2, lastHanja: LIU });
});

test("shareHanja: 한자를 고르지 않은 결과·hanjaSummary 가 없는 응답은 입력 그대로 — 링크가 예전과 글자 그대로 같다", () => {
  const auto = summary(false, [
    { syllable: "서", source: "auto", fills: [], hanja: fact(SEO2, "火") },
    { syllable: "윤", source: "auto", fills: [], hanja: fact(YUN2, "土") },
  ]);
  assert.deepEqual(shareHanja(auto, { hanja: "", lastHanja: "" }), { hanja: "", lastHanja: "" });
  for (const none of [null, undefined]) {
    assert.deepEqual(shareHanja(none, { hanja: SEO, lastHanja: LI }), { hanja: SEO, lastHanja: LI });
  }
  const i = input({ gender: "female" });
  const href = evaluateHref({ ...i, ...shareHanja(auto, i) }, { withBirth: false });
  assert.equal(href, `/evaluate?lastName=${encodeURIComponent("이")}&name=${encodeURIComponent("서윤")}&gender=female`);
});

test("공유 링크 — 생년월일은 없고 보인 글자는 모두 있다. 받는 쪽이 읽으면 그 글자들이 고른 한자다", () => {
  const i = input({ hanja: SEO, birthTime: "09:30" });
  const shown = summary(true, [
    { syllable: "서", source: "user", fills: [], hanja: fact(SEO) },
    { syllable: "윤", source: "auto", fills: [], hanja: fact(YUN2, "土") },
  ]);
  const href = evaluateHref({ ...i, ...shareHanja(shown, i) }, { withBirth: false });
  assert.doesNotMatch(href, /birthDate|birthTime|2025/);
  const received = inputFromParams(new URLSearchParams(href.split("?")[1]));
  assert.equal(received.hanja, SEO + YUN2);
  assert.equal(received.birthDate, "");
  assert.deepEqual(apiHanjaFields(received), { nameHanja: SEO + YUN2 });
});
