// /company(상호 작명) 화면 고침 고정 — `npm test`
//
// 2026-11-27 버그 목록 G-company:
// - labels-company: 입력 라벨이 칸과 이어져 있지 않았다(Base UI 선택 상자는 화면 읽기 프로그램이 지금 값만 읽음).
//   라벨 htmlFor ↔ 칸 id(useId)를 짝짓는다 — SelectTrigger 는 받은 id 를 <button role="combobox"> 에 단다.
// - company-result-heading-and-notices: 결과 제목의 업종이 지금 폼 선택을 따랐다(결과를 받은 뒤 업종만 바꿔도 제목이 바뀜) →
//   응답의 industryLabel. 0개 결과에서 서버가 준 키워드 안내(keywordNotices)를 버렸다 → 빈 결과 상자 안에도 그린다.
// - company-chip-invalid-css: 결 라벨 칩 배경 `${tint}1a` 가 'var(--color-gold)1a'(무효)라 배경이 없었다 →
//   color-mix(… 10%, transparent). 바탕이 생기면 대비가 바뀌어 tests/palette-contrast 와 같은 도구(color-utils)로 잰다.
// 컴포넌트는 .tsx(JSX)라 소스 문자열을 읽고, 순수 함수는 타입을 지워 따로 돌린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { read, token, hexRgb, contrast, tint, cssValueColor } from "./color-utils.mjs";

// 저장소가 core.autocrlf 라 작업 트리 파일이 CRLF 일 수 있다 — 줄 끝을 LF 로 맞춰 읽는다
const lf = (s) => s.replace(/\r\n/g, "\n");
const FORM = lf(read("src", "app", "company", "CompanyForm.tsx"));
const RESULT = lf(read("src", "components", "design", "CompanyResult.tsx"));
/** 주석 줄을 뺀 코드 — 옛 꼴을 설명하는 주석이 검사에 걸리지 않게 */
const code = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\/?\*|\{\/\*)/.test(l)).join("\n");

const AA = 4.5;
const WHITE = hexRgb(token("color-surface-token"));
const PAPER = hexRgb(token("color-background-token"));
const r2 = (x) => x.toFixed(2);

// ─── labels-company ────────────────────────────────────────────

test("/company 라벨마다 htmlFor 가 있고 같은 id 를 가진 칸(SelectTrigger·Input)이 하나씩 있다", () => {
  const labels = [...FORM.matchAll(/<Label\b([^>]*)>/g)].map((m) => m[1]);
  assert.equal(labels.length, 6, "업종·톤·이름의 결·글자 수·추천 개수·넣고 싶은 글자 — 라벨 6개");
  const labelIds = labels.map((attrs) => {
    const m = /htmlFor=\{ids\.(\w+)\}/.exec(attrs);
    assert.ok(m, `htmlFor 없는 라벨: <Label${attrs}>`);
    return m[1];
  });
  assert.equal(new Set(labelIds).size, labelIds.length, "같은 칸을 가리키는 라벨이 둘이다");

  const triggers = [...FORM.matchAll(/<SelectTrigger\b([^>]*)>/g)].map((m) => m[1]);
  assert.equal(triggers.length, 5);
  const fieldIds = [
    ...triggers.map((attrs) => {
      const m = /\bid=\{ids\.(\w+)\}/.exec(attrs);
      assert.ok(m, `id 없는 SelectTrigger: <SelectTrigger${attrs}>`);
      return m[1];
    }),
    ...[...FORM.matchAll(/<Input\b[\s\S]*?\bid=\{ids\.(\w+)\}/g)].map((m) => m[1]),
  ];
  assert.deepEqual([...fieldIds].sort(), [...labelIds].sort(), "라벨이 가리키는 id 와 칸의 id 가 짝이 맞지 않는다");

  // id 는 useId 로 만든다 — 손으로 쓴 'keyword' 같은 고정 id 는 같은 쪽의 다른 칸과 부딪칠 수 있다
  assert.match(FORM, /const uid = useId\(\);/);
  for (const key of labelIds) assert.match(FORM, new RegExp(`\\b${key}: \`\\$\\{uid\\}-${key}\``), key);
  assert.doesNotMatch(FORM, /htmlFor="|\bid="/, "고정 문자열 id·htmlFor 가 남았다");
});

// ─── company-result-heading-and-notices ────────────────────────

/** CompanyForm.tsx 의 resultIndustryLabel 을 꺼내 타입을 지우고 돌린다 */
function loadResultIndustryLabel() {
  const m = /function resultIndustryLabel\([\s\S]*?\n\}\n/.exec(FORM);
  assert.ok(m, "resultIndustryLabel 을 찾지 못했다");
  const js = stripTypeScriptTypes(m[0]);
  return new Function(`${js}\nreturn resultIndustryLabel;`)();
}

const INDUSTRIES = [
  { key: "cafe", label: "카페 · 디저트" },
  { key: "it", label: "IT · 소프트웨어" },
];

test("결과 제목의 업종은 응답 라벨 — 비었을 때만 응답 키·요청할 때 고른 키로 목록을 찾는다", () => {
  const label = loadResultIndustryLabel();
  // 카페로 받은 뒤 폼에서 IT 를 골라도 제목은 응답(요청 때) 값 — 함수는 지금 폼 선택을 받지 않는다
  assert.equal(label({ industry: "cafe", industryLabel: "카페 · 디저트" }, "cafe", INDUSTRIES), "카페 · 디저트");
  assert.equal(label({ industry: "cafe", industryLabel: "  " }, "it", INDUSTRIES), "카페 · 디저트", "응답 키가 요청 키보다 먼저");
  assert.equal(label({ industry: "", industryLabel: "" }, "it", INDUSTRIES), "IT · 소프트웨어");
  assert.equal(label({ industry: "pet", industryLabel: "" }, "cafe", INDUSTRIES), "pet", "목록에 없는 키는 키 그대로");
});

test("결과 제목은 resultIndustryLabel(응답) — 지금 폼의 industry 상태로 라벨을 찾지 않는다", () => {
  const h2 = /<h2 className="text-lg font-medium text-navy">([\s\S]*?)<\/h2>/.exec(FORM);
  assert.ok(h2, "결과 제목을 찾지 못했다");
  assert.match(h2[1], /resultIndustryLabel\(result, resultIndustry, options\.industries\)/);
  // 옛 꼴: options.industries.find((i) => i.key === industry) — 렌더 때마다 지금 선택값으로 라벨을 찾았다
  assert.doesNotMatch(FORM, /i\.key === industry\b/);
  // 요청할 때 고른 키는 응답을 받은 뒤에만 기록한다(실패한 요청이 제목을 바꾸지 않게)
  assert.match(FORM, /const requestedIndustry = industry;[\s\S]*?industry: requestedIndustry,[\s\S]*?setResultIndustry\(requestedIndustry\);\s*setResult\(data\);/);
});

test("키워드 안내는 결과가 있을 때(목록 위)와 0개일 때(빈 결과 상자 안) 모두 그린다", () => {
  const found = /\{result && result\.totalCount > 0 && \(([\s\S]*?)\n {6}\)\}/.exec(FORM);
  const empty = /\{result && result\.totalCount === 0 && \(([\s\S]*?)\n {6}\)\}/.exec(FORM);
  assert.ok(found && empty, "결과 분기 두 개를 찾지 못했다");
  assert.match(found[1], /<KeywordNoticeList notices=\{keywordNotices\}/);
  assert.match(empty[1], /<KeywordNoticeList\s+notices=\{keywordNotices\}/);
  // 안내 상자는 한 곳에서만 그린다(두 분기가 따로 그리면 문구·색이 갈라진다)
  assert.equal((FORM.match(/keywordNotices\.map|notices\.map/g) ?? []).length, 1);
  assert.match(FORM, /const keywordNotices = result\?\.keywordNotices \?\? \[\];/);
  // 경고 문장 글자색은 amber-warm-700(작은 글씨 — tests/amber-contrast)
  assert.match(FORM, /function KeywordNoticeList[\s\S]*?color: "var\(--color-amber-warm-700\)"/);
});

// ─── company-chip-invalid-css ──────────────────────────────────

/** CompanyResult STYLE_CHIP — 결마다 { tint(바탕 틴트 색), text(글자색) } */
function styleChips() {
  const block = /const STYLE_CHIP[^{]*\{([\s\S]*?)\n\};/.exec(RESULT);
  assert.ok(block, "CompanyResult STYLE_CHIP 을 찾지 못했다");
  const out = {};
  for (const [, key, t, x] of block[1].matchAll(/"?([\w-]+)"?: \{ tint: "([^"]+)", text: "([^"]+)" \}/g)) out[key] = { tint: t, text: x };
  assert.deepEqual(Object.keys(out).sort(), ["english", "hanja", "pure-korean"]);
  return out;
}

test("결 라벨 칩 배경은 color-mix 10% 틴트 — var() 뒤에 16진 알파를 붙인 무효 값이 없다", () => {
  for (const [name, src] of [["CompanyResult.tsx", RESULT], ["CompanyForm.tsx", FORM]])
    assert.doesNotMatch(code(src), /\$\{[^}]*\}[0-9a-fA-F]{2}`/, `${name}: \`\${var(...)}1a\` 꼴은 계산 시점에 무효(배경 없음)`);
  assert.match(
    RESULT,
    /background: `color-mix\(in srgb, \$\{chip\.tint\} 10%, transparent\)`,\s*color: chip\.text,/,
    "칩 바탕은 결 색 10% 틴트, 글자는 chip.text"
  );
  assert.match(RESULT, /const chip = STYLE_CHIP\[c\.style\] \?\? DEFAULT_STYLE_CHIP;/);
});

test("결 라벨 칩 글자(10px)는 제 틴트 바탕(흰 카드·종이 위)에서 4.5:1 을 넘는다", (t) => {
  for (const [style, { tint: mark, text }] of Object.entries(styleChips())) {
    const markRgb = cssValueColor(mark), textRgb = cssValueColor(text);
    for (const [label, under] of [["흰 카드 위 10% 틴트", tint(markRgb, 0.1, WHITE)], ["종이 위 10% 틴트", tint(markRgb, 0.1, PAPER)]]) {
      const r = contrast(textRgb, under);
      // 옛 화면(배경 없음 — 결 색 글자가 흰 카드에 바로)과 결 색 그대로 틴트에 올렸을 때를 함께 적어 둔다
      t.diagnostic(
        `${style} ${text} / ${label}: ${r2(r)}:1 (결 색 ${mark} 글자 — 틴트 위 ${r2(contrast(markRgb, under))} · 옛 배경 없음 ${r2(contrast(markRgb, WHITE))}:1)`
      );
      assert.ok(r >= AA, `${style} ${text} / ${label} ${r2(r)}:1 < ${AA}`);
    }
  }
});
