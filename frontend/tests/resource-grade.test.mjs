// 자원오행 판정 등급 정규화 테스트 — `npm test`
//
// /evaluate·/analysis 한자 후보 배지는 백엔드 resourceGrade(R·V·X·U)만 그린다. 모르는 값(옛 등급 S·C·D,
// 필드 없는 옛 백엔드)은 배지 없음 — '미상'으로 바꿔 그리거나(분석 화면의 옛 D 강제 변환) 빈 배지를
// 그리지(옛 C 키 누락) 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";

import { RESOURCE_GRADE_INFO, toResourceGrade } from "../src/components/design/resource-grade.ts";
import { gradeBadgeKey } from "../src/components/hanja/hanja-element-text.ts";

test("R·V·X·U 는 그대로", () => {
  for (const g of ["R", "V", "X", "U"]) assert.equal(toResourceGrade(g), g);
});

test("옛 등급·빈 값·소문자는 배지 없음", () => {
  for (const v of ["S", "A", "B", "C", "D", "", "r", null, undefined]) {
    assert.equal(toResourceGrade(v), undefined, String(v));
  }
});

test("네 등급 + V 를 나눈 두 키(자료 적음·추정) 모두 라벨·설명이 있다", () => {
  assert.deepEqual(Object.keys(RESOURCE_GRADE_INFO).sort(), ["R", "U", "V", "V_FEW", "V_GUESS", "X"]);
  for (const { label, tip } of Object.values(RESOURCE_GRADE_INFO)) {
    assert.ok(label.length > 0 && tip.length > 0);
    // 계획 §4-2: '검수'·'작명가 검수' 표기 폐지, 부수 단위 근거를 '작명소 기준과 같다'로 쓰지 않는다
    assert.doesNotMatch(label + tip, /검수|작명소/);
  }
});

test("/evaluate·/analysis 배지도 /hanja 와 같은 기준으로 V 를 나눈다 — 대체값 없는 V 를 '이견 있음'이라 하지 않는다(S7V-6)", () => {
  // 백엔드 vReasons → gradeBadgeKey → 배지 라벨
  const label = (grade, vReasons) => RESOURCE_GRADE_INFO[gradeBadgeKey(grade, vReasons) ?? grade].label;
  assert.equal(label("V", ["radical_single"]), "자료 적음"); // 民
  assert.equal(label("V", ["radical_unknown"]), "추정"); // 屯
  assert.equal(label("V", ["radical_alt"]), "이견 있음");
  assert.equal(label("V", ["radical_single", "char_practice"]), "이견 있음");
  // 옛 백엔드(vReasons 없음)는 V 그대로
  assert.equal(label("V", undefined), "이견 있음");
  for (const g of ["R", "X", "U"]) assert.equal(label(g, ["radical_single"]), RESOURCE_GRADE_INFO[g].label);
  // 대체값이 없는 키의 설명에 '이견'이 없다
  assert.doesNotMatch(RESOURCE_GRADE_INFO.V_FEW.tip + RESOURCE_GRADE_INFO.V_GUESS.tip, /이견/);
});
