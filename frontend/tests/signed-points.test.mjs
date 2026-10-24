// 가점·감점 한 줄 부호·색 테스트 — `npm test`
//
// 2026-10-23 운영 검증 NAME-2: /name 미학 점수 카드(ScoreBreakdownCard)가 행 종류(type="bonus")로 '+'·청록을 붙여
// 음수 성별 보너스(name-seo sc.g -2·-4 — 재윤 -4·다솜 -2)가 '성별 보너스 +-2'(청록)로 나왔다.
// 부호·색은 값으로 정하고, /evaluate ScoreBar bonus 행(`value >= 0 ? +v : v`)과 같은 규칙을 쓴다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatSignedPoints, pointsPolarity, signedPointsClass } from "../src/lib/signed-points.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");

test("양수는 '+N', 음수는 '-N' — '+-N' 이 나오지 않는다", () => {
  assert.equal(formatSignedPoints(5), "+5");
  assert.equal(formatSignedPoints(1), "+1");
  assert.equal(formatSignedPoints(-2), "-2"); // 다솜
  assert.equal(formatSignedPoints(-4), "-4"); // 재윤
  assert.equal(formatSignedPoints(-1), "-1");
  for (const v of [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]) {
    assert.doesNotMatch(formatSignedPoints(v), /\+-|-\+|--|\+\+/, String(v));
  }
});

test("0 은 EvalPrimitives ScoreBar 와 같게 '+0'", () => {
  assert.equal(formatSignedPoints(0), "+0");
});

test("감점은 -penalty 로 넘겨 '-N' (EvaluateResult '감점' 행과 같다)", () => {
  for (const pn of [5, 10, 15, 27]) assert.equal(formatSignedPoints(-pn), `-${pn}`);
});

test("색은 값의 부호로 — 음수는 가점 색(teal)이 아니라 amber-warm", () => {
  assert.equal(pointsPolarity(5), "plus");
  assert.equal(pointsPolarity(-2), "minus");
  assert.equal(pointsPolarity(0), "zero");
  assert.equal(signedPointsClass(5), "text-teal");
  assert.equal(signedPointsClass(-2), "text-amber-warm");
  assert.equal(signedPointsClass(-4), "text-amber-warm");
  assert.notEqual(signedPointsClass(0), "text-teal");
});

// 위 규칙을 카드가 실제로 쓰는지 — 행 종류로 부호를 붙이던 옛 코드로 되돌리면 여기서 걸린다
test("/name 미학 점수 카드·조화 카드가 값으로 부호·색을 정한다", () => {
  const score = read("src", "components", "results", "ScoreBreakdownCard.tsx");
  assert.match(score, /formatSignedPoints\(value\)/);
  assert.match(score, /signedPointsClass\(value\)/);
  assert.doesNotMatch(score, /<BonusLine\b[^>]*\btype=|isPositive/); // 옛 코드: type="bonus" → 늘 '+'·청록
  assert.match(score, /label="성별 보너스" value=\{aesthetic\.genderBonus\}/);
  assert.match(score, /label="감점" value=\{-aesthetic\.penalty\}/);

  const harmony = read("src", "components", "results", "HarmonyBreakdownCard.tsx");
  assert.doesNotMatch(harmony, /\+\{harmony\.genderBonus\}/);
  assert.match(harmony, /formatSignedPoints\(harmony\.genderBonus\)/);

  const bar = read("src", "components", "design", "EvalPrimitives.tsx");
  assert.match(bar, /formatSignedPoints\(value\)/);
});
