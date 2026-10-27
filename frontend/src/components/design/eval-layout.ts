/**
 * /evaluate 결과 '이 이름의 강점'·'참고할 점' 2열 상자(EvalBody StrengthsCautions) 배치 규칙.
 * React 없이 node --test 로 검사하려고 뺐다(tests/eval-layout.test.mjs).
 *
 * - 보이는 줄이 없는 상자(빈 목록·공백뿐인 줄)는 그리지 않는다.
 * - 상자가 하나만 남으면 1열 — 2열 격자의 빈 칸을 남기지 않는다.
 * 2026-10-23 운영 검증 BR-1: 백엔드 cautions 는 정해진 검사(부정 연상·세대·독창성·발음·음령 상극·된소리 등)에 걸릴 때만
 * 항목을 담아 자주 비는데(운영 표본 12건 중 3건 — 김서진 등), 빈 '참고할 점' 상자가 제목만 단 채 오른쪽 칸에 그려졌다.
 * '흠이 없다'고 단정하는 빈 상태 문구는 두지 않는다(검사 목록이 정해져 있을 뿐이다). CompanyResult 의
 * `cautions.length > 0 &&` 와 같은 방식.
 *
 * /analysis '이름의 결' 3열 상자(DetailMid KyeolBlocks — 강점·약점·추천 이유)도 같은 규칙을 쓴다(threeColTemplate).
 * 2026-10-27: NameAnalysisService 약점은 정해진 검사(미학 60 미만·흔한 이름·음절 길이·한자 매핑 등)에 걸릴 때만 담겨
 * 생년월일 없는 기본 분석에서 /name 이름 90% 안팎(김 성씨 5,340명 중 4,834명)이 빈 배열인데, 빈 '⚠ 약점' 상자가 제목만 단 채
 * 가운데 칸에 그려졌다. 여기서도 '약점이 없다'는 문구는 두지 않는다.
 */

/** 화면에 그릴 줄만 — 공백뿐인 줄은 뺀다 */
export function visibleItems(items: readonly string[] | null | undefined): string[] {
  return (items ?? []).filter((it) => typeof it === "string" && it.trim().length > 0);
}

/** 그릴 줄이 하나라도 있는지 — EvaluateResult·/analysis 가 '이름의 결' 절 자체를 그릴지 정할 때 쓴다 */
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

/** 남은 상자 수에 맞춘 grid-template-columns — 최대 3열(셋이면 3열, 둘이면 2열), 하나면 1열 */
export function threeColTemplate(count: number): string {
  return count >= 2 ? `repeat(${Math.min(count, 3)}, 1fr)` : "1fr";
}

/**
 * /analysis '이름의 결' 소제목 — 보이는 상자만 부른다. 옛 문구는 늘 '강점·약점을 항목별로 살펴봐요'라
 * 약점 상자가 빠진 대부분의 결과(생년월일 없는 분석)에서 없는 상자를 가리켰다(2026-10-27).
 * 추천 이유는 옛 문구처럼 이름을 부르지 않고, 그 상자만 남을 때만 쓴다.
 */
export function kyeolSubtitle(
  strengths: readonly string[] | null | undefined,
  weaknesses: readonly string[] | null | undefined
): string {
  const strong = hasVisibleContent(strengths);
  const weak = hasVisibleContent(weaknesses);
  if (strong && weak) return "강점·약점을 항목별로 살펴봐요";
  if (strong) return "강점을 항목별로 살펴봐요";
  if (weak) return "약점을 항목별로 살펴봐요";
  return "추천 이유를 살펴봐요";
}
