// 영어 이름 입력 검증 표 테스트 — `npm test` (= node --test "tests/*.test.mjs", Node 22.18+)
//
// 지키는 계약(2026-10-21 검토 FTE-3): /search 폼과 홈 Hero가 같은 함수로 막는다. Hero가 검증 없이
// '다니엘'을 넘기면 /search의 autoStart 추천 전체가 폼에 멈췄다. 기대값은 백엔드
// SmartRecommendationRequestDto.PreferredEnglishName([StringLength(30)], 영문)을 보고 손으로 정했다.
import { test } from "node:test";
import assert from "node:assert/strict";

import { ENGLISH_NAME_MAX, englishNameProblem } from "../src/lib/english-name.ts";

test("최대 길이는 백엔드 StringLength(30)과 같다", () => {
  assert.equal(ENGLISH_NAME_MAX, 30);
});

/** [입력, 통과하면 true] */
const CASES = [
  ["", true],
  ["   ", true],
  ["Daniel", true],
  [" Ethan ", true],
  ["Mary Jane", true],
  ["O'Neil", true],
  ["Anne-Marie", true],
  ["J.R.", true],
  ["A".repeat(30), true],
  ["A".repeat(31), false],
  ["다니엘", false],
  ["Daniel김", false],
  ["1Daniel", false],
  ["-Emma", false],
  ["Ethan2", false],
];

for (const [input, ok] of CASES) {
  test(`englishNameProblem(${JSON.stringify(input)}) ${ok ? "통과" : "안내"}`, () => {
    const problem = englishNameProblem(input);
    if (ok) assert.equal(problem, null);
    else assert.equal(typeof problem, "string");
  });
}

test("한글 입력은 영문으로 쓰라는 안내를 준다", () => {
  assert.match(englishNameProblem("다니엘") ?? "", /영문으로 입력해 주세요/);
});

test("31자는 길이 안내를 준다", () => {
  assert.match(englishNameProblem("A".repeat(31)) ?? "", /30자 이내/);
});
