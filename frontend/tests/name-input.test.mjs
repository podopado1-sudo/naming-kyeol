// 성씨·이름 입력 칸 공용 검사 — `npm test`
// lib/name-input.ts 머리말: 여러 도구 화면이 끝 공백·한자·영문·낱자모가 든 성·이름을 그대로 보내던 것(2026-11-27 버그 목록).
import { test } from "node:test";
import assert from "node:assert/strict";

import "./resolve-ts.mjs";

const { cleanNameInput, nameInputProblem, nameInputMessage, SURNAME_MAX_LENGTH } = await import("../src/lib/name-input.ts");

test("다듬기 — 앞뒤 공백을 걷고 풀어 쓴 한글(NFD)을 모은다", () => {
  assert.equal(cleanNameInput("  서윤 "), "서윤");
  assert.equal(cleanNameInput("서윤".normalize("NFD")), "서윤");
  assert.equal(cleanNameInput(null), "");
  assert.equal(cleanNameInput(undefined), "");
});

test("문제 판정 — 빈 칸·낱자모·가운데 공백·한글 아닌 글자·길이", () => {
  assert.equal(nameInputProblem("", 3), "empty");
  assert.equal(nameInputProblem("   ", 3), "empty");
  assert.equal(nameInputProblem("ㅋㅋ", 3), "jamo");
  assert.equal(nameInputProblem("서ㅇ", 3), "jamo");
  assert.equal(nameInputProblem("서 윤", 3), "space");
  assert.equal(nameInputProblem("瑞潤", 3), "not-hangul");
  assert.equal(nameInputProblem("Seo", 3), "not-hangul");
  assert.equal(nameInputProblem("서윤2", 3), "not-hangul");
  assert.equal(nameInputProblem("서윤하나", 3), "too-long");
  assert.equal(nameInputProblem(" 서윤 ", 3), null, "다듬은 뒤 문제가 없으면 null");
  assert.equal(nameInputProblem("서윤".normalize("NFD"), 3), null);
  assert.equal(nameInputProblem("남궁", SURNAME_MAX_LENGTH), null);
  assert.equal(nameInputProblem("남궁김", SURNAME_MAX_LENGTH), "too-long");
});

test("안내 문구 — 칸 이름에 맞는 조사", () => {
  assert.equal(nameInputMessage("not-hangul", "성씨", 2), "성씨는 한글로만 입력해주세요.");
  assert.equal(nameInputMessage("not-hangul", "이름", 3), "이름은 한글로만 입력해주세요.");
  assert.equal(nameInputMessage("jamo", "부모 이름", 10), "부모 이름은 ㄱ·ㅏ 같은 낱자 없이 완성된 한글로 입력해주세요.");
  assert.equal(nameInputMessage("space", "이름", 3), "이름은 띄어 쓰지 말고 붙여서 입력해주세요.");
  assert.equal(nameInputMessage("too-long", "성씨", 2), "성씨는 2글자까지 입력할 수 있어요.");
});
