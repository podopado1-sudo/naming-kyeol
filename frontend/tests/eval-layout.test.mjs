// /evaluate 결과 '이 이름의 강점'·'참고할 점' 2열 상자, /analysis '이름의 결' 3열 상자 배치 테스트 — `npm test`
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
  kyeolSubtitle,
  threeColTemplate,
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

// ------------------------------------------------------------
// /analysis '이름의 결' 3열 상자(DetailMid KyeolBlocks — 강점·약점·추천 이유)
//
// 2026-10-27: 생년월일 없는 기본 분석은 약점이 대부분 빈 배열(김 성씨 /name 5,340명 중 4,834명 — 실제
// NameAnalysisService 오프라인 실행)이라 빈 '⚠ 약점' 상자가 제목만 단 채 가운데 칸에 그려졌다.
// ------------------------------------------------------------

// 김소윤(성별 없음·생년월일 없음) 응답 — 약점 [], 추천 이유는 filterAnalysisReasons 를 거친 뒤('한자 예 —' 줄 숨김)
const SOYUN = {
  strengths: [
    "발음과 리듬이 양호합니다 (미학 78점)",
    "적당한 독창성을 가진 이름입니다 (유니크 65점)",
    "2음절 이름으로 부르기 편합니다",
    "전체 3음절로 이상적인 길이입니다",
    "한자 의미를 부여할 수 있는 이름입니다",
  ],
  weaknesses: [],
  reasons: [
    "종합 78점 — 미학 78 (조화 미산정)",
    "발음 78점 — 받침 1개 / 부드러운 자음 100%",
    "음령오행 상생 — 土(ㅇ) → 金(ㅅ) 역방향",
  ],
};

/** KyeolBlocks 가 그리는 상자(같은 순서) — 목록마다 visibleItems 로 거르고 빈 목록 상자는 뺀다 */
function kyeolBlocks({ strengths, weaknesses, reasons }) {
  return [
    ["강점", strengths],
    ["약점", weaknesses],
    ["추천 이유", reasons],
  ]
    .map(([title, items]) => ({ title, items: visibleItems(items) }))
    .filter((b) => b.items.length > 0);
}

/** /analysis 의 '이름의 결' 절 조건과 같은 식 */
const analysisSectionShown = ({ strengths, weaknesses, reasons }) =>
  hasVisibleContent(strengths) || hasVisibleContent(weaknesses) || hasVisibleContent(reasons);

test("/analysis 약점이 비면 강점·추천 이유 두 상자, 2열(빈 가운데 칸 없음)", () => {
  const blocks = kyeolBlocks(SOYUN);
  assert.deepEqual(blocks.map((b) => b.title), ["강점", "추천 이유"]);
  assert.equal(blocks[0].items.length, 5);
  assert.equal(blocks[1].items.length, 3);
  assert.equal(threeColTemplate(blocks.length), "repeat(2, 1fr)");
  assert.equal(analysisSectionShown(SOYUN), true);
});

test("/analysis 셋 다 있으면 3열, 순서는 강점 → 약점 → 추천 이유", () => {
  // 김가윤 — '흔한 이름' 약점이 붙는 인기 이름
  const blocks = kyeolBlocks({ ...SOYUN, weaknesses: ["흔한 이름에 속합니다 (유니크 30점)"] });
  assert.deepEqual(blocks.map((b) => b.title), ["강점", "약점", "추천 이유"]);
  assert.equal(threeColTemplate(blocks.length), "repeat(3, 1fr)");
});

test("/analysis 한 상자만 남으면 1열", () => {
  const blocks = kyeolBlocks({ strengths: [], weaknesses: ["한자 매핑이 어려운 이름입니다"], reasons: [" "] });
  assert.deepEqual(blocks.map((b) => b.title), ["약점"]);
  assert.equal(threeColTemplate(blocks.length), "1fr");
});

test("/analysis 셋 다 보이는 줄이 없으면 상자도, '이름의 결' 절도 그리지 않는다", () => {
  const empty = { strengths: [""], weaknesses: [], reasons: ["  "] };
  assert.deepEqual(kyeolBlocks(empty), []);
  // 옛 조건(length > 0)은 공백뿐인 줄에도 절을 그렸다
  assert.equal(analysisSectionShown(empty), false);
  assert.equal(analysisSectionShown({ strengths: [], weaknesses: [], reasons: [] }), false);
});

test("threeColTemplate 는 최대 3열, twoColTemplate(/evaluate)은 그대로 최대 2열", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(threeColTemplate), ["1fr", "1fr", "repeat(2, 1fr)", "repeat(3, 1fr)", "repeat(3, 1fr)"]);
  assert.deepEqual([0, 1, 2, 3].map(twoColTemplate), ["1fr", "1fr", "repeat(2, 1fr)", "repeat(2, 1fr)"]);
});

// 위 규칙을 /analysis 화면이 실제로 쓰는지 — 컴포넌트를 되돌리면 여기서 걸린다
test("KyeolBlocks·/analysis 가 eval-layout 규칙을 쓴다", () => {
  const mid = read("src", "components", "design", "DetailMid.tsx");
  const kb = /export function KyeolBlocks\([\s\S]*?\r?\n}\r?\n/.exec(mid);
  assert.ok(kb, "KyeolBlocks 없음");
  // 상자 속성은 JSX 그대로(palette-contrast.test.mjs 가 tintBg="…"·accent="…" 를 읽는다) — 목록을 보이는 줄로 거른 뒤 조건부로 그린다
  for (const [list, raw] of [["strong", "strengths"], ["weak", "weaknesses"], ["why", "reasons"]]) {
    assert.match(kb[0], new RegExp(`const ${list} = visibleItems\\(${raw}\\);`));
    assert.match(kb[0], new RegExp(`\\{${list}\\.length > 0 && \\(\\s*<Block[^>]*?items=\\{${list}\\}`));
    assert.doesNotMatch(kb[0], new RegExp(`items=\\{${raw}\\}`));
  }
  assert.match(kb[0], /const count = \[strong, weak, why\]\.filter\(\(items\) => items\.length > 0\)\.length;/);
  assert.match(kb[0], /if \(count === 0\) return null;/);
  assert.match(kb[0], /gridTemplateColumns: threeColTemplate\(count\)/);
  assert.doesNotMatch(kb[0], /gridTemplateColumns: "repeat\(3, 1fr\)"/);

  const page = read("src", "app", "analysis", "page.tsx");
  assert.match(
    page,
    /hasVisibleContent\(strengths\) \|\| hasVisibleContent\(weaknesses\) \|\| hasVisibleContent\(reasons\)/,
  );
  assert.doesNotMatch(page, /strengths\.length > 0 \|\| weaknesses\.length > 0/);
});

// 2026-10-27: 소제목이 늘 '강점·약점을…'이라 약점 상자가 빠진 결과에서 없는 상자를 가리켰다
test("/analysis 소제목은 보이는 상자만 부른다", () => {
  assert.equal(kyeolSubtitle(["2음절"], ["흔한 이름"]), "강점·약점을 항목별로 살펴봐요");
  assert.equal(kyeolSubtitle(["2음절"], []), "강점을 항목별로 살펴봐요");
  assert.equal(kyeolSubtitle(["2음절"], ["  "]), "강점을 항목별로 살펴봐요");
  assert.equal(kyeolSubtitle([], ["흔한 이름"]), "약점을 항목별로 살펴봐요");
  assert.equal(kyeolSubtitle(null, undefined), "추천 이유를 살펴봐요");

  const page = read("src", "app", "analysis", "page.tsx");
  assert.match(page, /subtitle=\{kyeolSubtitle\(strengths, weaknesses\)\}/);
  assert.doesNotMatch(page, /subtitle="강점·약점을 항목별로 살펴봐요"/);
});

// 폰에서 3열 그대로면 칸이 100px 안팎이라 문장이 글자 단위로 꺾였다 — 640px 이하 1열·최소 높이 해제
test("KyeolBlocks 는 640px 이하에서 1열로 쌓는다", () => {
  const mid = read("src", "components", "design", "DetailMid.tsx");
  assert.match(mid, /@media \(max-width: 640px\)[\s\S]*?\.kyeol-blocks \{ grid-template-columns: 1fr !important; \}/);
  assert.match(mid, /\.kyeol-blocks > div \{ min-height: 0 !important; \}/);
  assert.match(mid, /<style>\{KYEOL_CSS\}<\/style>\s*<div\s+className="kyeol-blocks"/);
});
