// /dual-name·/parent-based·/rare-surname 결과 화면에 지어낸 점수가 다시 들어오지 않게 막는다 — `npm test`
//
// 2026-10-28: 세 엔드포인트는 점수를 주지 않는데(이중 이름·부모 기반은 점수 필드 없음, 희귀 성씨는 성씨 발음 조화 harmonyScore 만),
// 프런트가 후보 순위로 미학·조화·최종·희귀도 숫자를 지어내 점수처럼 보였다(dual: max(60, 92 - 2i) 등, parent: 72 + seed * 20,
// rare: 미학 70~92·'희귀도 매칭' 90/75 → 별 75~90개). 지금은 실제 응답 값만 그리고, 점수 자리는 /evaluate 링크('이 이름 평가하기')다.
// 실제 점수를 보이려면 백엔드가 ScoringService 값을 응답에 실어야 한다 — 프런트에서 숫자를 만들지 말 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf-8");

const FILES = [
  "app/dual-name/page.tsx",
  "app/parent-based/page.tsx",
  "app/rare-surname/page.tsx",
  "components/design/DualCard.tsx",
  "components/design/DualResult.tsx",
  "components/design/SmartResultParent.tsx",
  "components/design/SmartResultRare.tsx",
];

// 순위·인덱스·seed 로 점수를 만드는 꼴 — 주석은 빼고 본다(삭제 이유를 적은 주석에 옛 식이 남아 있다)
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const MOCK_PATTERNS = [
  [/Math\.max\(\s*\d+\s*,\s*\d+\s*-\s*i\b/, "인덱스로 깎는 점수(max(60, 92 - i * 2) 꼴)"],
  [/\d+\s*\+\s*seed\s*\*/, "seed 로 만드는 점수(72 + seed * 20 꼴)"],
  [/\brarityMatch\b/, "'희귀도 매칭' 지어낸 값"],
  [/\baverageScores\b/, "지어낸 점수의 평균"],
  [/\brarity:\s*50\b/, "고정 희귀도 50"],
];

for (const rel of FILES) {
  test(`${rel} — 순위·seed·고정값으로 만든 점수가 없다`, () => {
    const code = stripComments(read(rel));
    for (const [re, what] of MOCK_PATTERNS) {
      assert.doesNotMatch(code, re, `${what}이(가) 다시 들어왔다`);
    }
  });
}

test("세 화면 후보 타입에 점수 필드가 없다(미학·조화·최종·희귀도) — 희귀 성씨의 harmonyScore(엔진 값)만 예외", () => {
  const dual = stripComments(read("components/design/DualCard.tsx"));
  assert.doesNotMatch(dual, /\bscores\s*[?]?:/, "DualCandidate.scores");
  const parent = stripComments(read("components/design/SmartResultParent.tsx"));
  assert.doesNotMatch(parent, /\b(aesthetics|finalScore)\s*[?]?:\s*number/, "ParentUICandidate 점수 필드");
  const rare = stripComments(read("components/design/SmartResultRare.tsx"));
  assert.doesNotMatch(rare, /\baesthetics\s*[?]?:\s*number/, "RareUICandidate.aesthetics");
  assert.match(rare, /\bharmonyScore\b/, "희귀 성씨의 실제 harmonyScore 는 남아 있어야 한다");
});

test("'이 이름 평가하기' 링크는 새 탭 + 보이는 글자로 시작하는 접근 이름", () => {
  for (const rel of ["components/design/DualCard.tsx", "components/design/SmartResultParent.tsx", "components/design/SmartResultRare.tsx"]) {
    const code = read(rel);
    assert.match(code, /target="_blank"/, `${rel}: target=_blank`);
    assert.match(code, /rel="noopener"/, `${rel}: rel=noopener`);
    assert.match(code, /aria-label=\{`이 이름 평가하기: /, `${rel}: aria-label 이 '이 이름 평가하기: '로 시작`);
  }
});
