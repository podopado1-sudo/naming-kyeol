// /evaluate 결과 '이 이름의 강점'·'참고할 점' 2열 상자 배치 테스트 — `npm test`
//
// 2026-10-23 운영 검증 BR-1: cautions 가 빈 응답(운영 표본 12건 중 3건 — 김서진·박지우·조준혁)에서 '참고할 점' 상자가
// 제목만 단 채 오른쪽 칸에 그려졌다. 빈 상자는 그리지 않고, 한쪽만 남으면 1열.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hasVisibleContent,
  keepFilledBlocks,
  twoColTemplate,
  visibleItems,
} from "../src/components/design/eval-layout.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");

// 운영 김서진 응답(api-parity 캐시) — strengths 3줄, cautions []
const SEOJIN = {
  strengths: [
    "음령오행 동일 — 金(ㅅ/ㅈ) 안정",
    "書(서, 글 서) + 津(진, 나루 진) — 자연 + 덕목 카테고리 조합",
    "리듬 — 받침 패턴 무+유 (최적)",
  ],
  cautions: [],
};

/** EvalBody StrengthsCautions 가 keepFilledBlocks 에 넘기는 상자 묶음(같은 순서) */
function strengthsCautionsBlocks({ strengths, cautions }) {
  return keepFilledBlocks([
    { title: "이 이름의 강점", items: strengths },
    { title: "참고할 점", items: cautions },
  ]);
}

test("참고할 점이 비면 강점 상자 하나만, 1열", () => {
  const blocks = strengthsCautionsBlocks(SEOJIN);
  assert.deepEqual(blocks.map((b) => b.title), ["이 이름의 강점"]);
  assert.equal(blocks[0].items.length, 3);
  assert.equal(twoColTemplate(blocks.length), "1fr");
});

test("둘 다 있으면 2열, 순서는 강점 → 참고할 점", () => {
  const blocks = strengthsCautionsBlocks({ strengths: ["a"], cautions: ["b"] });
  assert.deepEqual(blocks.map((b) => b.title), ["이 이름의 강점", "참고할 점"]);
  assert.equal(twoColTemplate(blocks.length), "repeat(2, 1fr)");
});

test("강점만 비어도 참고할 점 하나만, 1열", () => {
  const blocks = strengthsCautionsBlocks({ strengths: [], cautions: ["세대 감각 — 1990년대 인기 이름"] });
  assert.deepEqual(blocks.map((b) => b.title), ["참고할 점"]);
  assert.equal(twoColTemplate(blocks.length), "1fr");
});

test("둘 다 비면 상자도, '이름의 결' 절도 그리지 않는다", () => {
  const empty = { strengths: [], cautions: [] };
  assert.deepEqual(strengthsCautionsBlocks(empty), []);
  // EvaluateResult 의 절 조건과 같은 식
  assert.equal(hasVisibleContent(empty.strengths) || hasVisibleContent(empty.cautions), false);
});

test("공백뿐인 줄은 내용으로 치지 않는다", () => {
  assert.deepEqual(visibleItems(["", "  ", "음령오행 동일"]), ["음령오행 동일"]);
  assert.deepEqual(strengthsCautionsBlocks({ strengths: [" "], cautions: [""] }), []);
  assert.equal(hasVisibleContent([" ", ""]), false);
  assert.equal(hasVisibleContent(["음령오행 동일"]), true);
  assert.equal(hasVisibleContent(null), false);
  assert.equal(hasVisibleContent(undefined), false);
});

// 위 규칙을 화면이 실제로 쓰는지 — 컴포넌트를 되돌리면 여기서 걸린다
test("StrengthsCautions·EvaluateResult 가 eval-layout 규칙을 쓴다", () => {
  const body = read("src", "components", "design", "EvalBody.tsx");
  const sc = /export function StrengthsCautions\([\s\S]*?\r?\n}\r?\n/.exec(body);
  assert.ok(sc, "StrengthsCautions 없음");
  assert.match(sc[0], /keepFilledBlocks\(\[/);
  assert.match(sc[0], /if \(blocks\.length === 0\) return null;/);
  assert.match(sc[0], /gridTemplateColumns: twoColTemplate\(blocks\.length\)/);
  assert.doesNotMatch(sc[0], /gridTemplateColumns: "repeat\(2, 1fr\)"/);

  const result = read("src", "app", "evaluate", "EvaluateResult.tsx");
  assert.match(result, /hasVisibleContent\(data\.strengths\) \|\| hasVisibleContent\(data\.cautions\)/);
});
