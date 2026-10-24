/**
 * 가점·감점 한 줄(성별 보너스·톤 보너스·감점)의 부호와 색 — **값으로 정한다**(행의 종류로 정하지 않는다).
 *
 * /evaluate 막대(components/design/EvalPrimitives.tsx ScoreBar 의 bonus 행)와 /name 미학 점수 카드
 * (components/results/ScoreBreakdownCard.tsx)가 같은 규칙을 쓴다: 0 이상은 '+N', 음수는 '-N'.
 * 2026-10-23 운영 검증 NAME-2 — ScoreBreakdownCard 가 type="bonus" 행에 늘 '+'와 청록을 붙여, 성별 선호가 맞지 않는
 * 이름(name-seo sc.g -2·-4, 공개 87쪽 — 재윤·다솜 등)이 '성별 보너스 +-2'(청록)로 나왔다.
 *
 * 감점(penalty)은 엔진이 양수로 내는 값이라(AestheticEngine PenaltyTotal) 부르는 쪽이 `-penalty` 로 넘긴다
 * — EvaluateResult 의 '감점' 행과 같다.
 * React 없이 node --test 로 검사한다(tests/signed-points.test.mjs).
 */

/** '+5' · '-2' · '+0' — EvalPrimitives ScoreBar bonus 행과 같은 표기 */
export function formatSignedPoints(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export type PointsPolarity = "plus" | "minus" | "zero";

/** 값의 극성 — plus 는 가점, minus 는 감점, zero 는 0(대개 그리지 않는다) */
export function pointsPolarity(value: number): PointsPolarity {
  if (value > 0) return "plus";
  if (value < 0) return "minus";
  return "zero";
}

/**
 * 가점·감점 글자 색(Tailwind) — 가점 teal, 감점 amber-warm(디자인 시스템: teal = 높은 점수·가점, amber-warm = 경고).
 * 0 은 중립 색.
 */
export function signedPointsClass(value: number): string {
  const polarity = pointsPolarity(value);
  if (polarity === "plus") return "text-teal";
  if (polarity === "minus") return "text-amber-warm";
  return "text-muted-foreground";
}
