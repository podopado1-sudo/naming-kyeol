/**
 * /evaluate 결과 '이 이름의 강점'·'참고할 점' 2열 상자(EvalBody StrengthsCautions) 배치 규칙.
 * React 없이 node --test 로 검사하려고 뺐다(tests/eval-layout.test.mjs).
 *
 * - 보이는 줄이 없는 상자(빈 목록·공백뿐인 줄)는 그리지 않는다.
 * - 상자가 하나만 남으면 1열 — 2열 격자의 빈 칸을 남기지 않는다.
 * 2026-10-23 운영 검증 BR-1: 백엔드 cautions 는 정해진 검사(부정 연상·세대·독창성·발음·음령 상극·된소리 등)에 걸릴 때만
 * 항목을 담아 자주 비는데(운영 표본 12건 중 3건 — 김서진 등), 빈 '참고할 점' 상자가 제목만 단 채 오른쪽 칸에 그려졌다.
 * '흠이 없다'고 단정하는 빈 상태 문구는 두지 않는다(검사 목록이 정해져 있을 뿐이다). CompanyResult·ExplanationCard 의
 * `cautions.length > 0 &&` 와 같은 방식.
 */

/** 화면에 그릴 줄만 — 공백뿐인 줄은 뺀다 */
export function visibleItems(items: readonly string[] | null | undefined): string[] {
  return (items ?? []).filter((it) => typeof it === "string" && it.trim().length > 0);
}

/** 그릴 줄이 하나라도 있는지 — EvaluateResult 가 '이름의 결' 절 자체를 그릴지 정할 때 쓴다 */
export function hasVisibleContent(items: readonly string[] | null | undefined): boolean {
  return visibleItems(items).length > 0;
}

/** 목록 상자 묶음에서 보이는 줄이 있는 상자만, 순서 그대로 — 각 상자의 items 는 보이는 줄로 바꿔 돌려준다 */
export function keepFilledBlocks<T extends { items: readonly string[] }>(
  blocks: readonly T[],
): (Omit<T, "items"> & { items: string[] })[] {
  return blocks
    .map((b) => ({ ...b, items: visibleItems(b.items) }))
    .filter((b) => b.items.length > 0);
}

/** 남은 상자 수에 맞춘 grid-template-columns — 둘 이상이면 2열, 하나면 1열 */
export function twoColTemplate(count: number): string {
  return count >= 2 ? "repeat(2, 1fr)" : "1fr";
}
