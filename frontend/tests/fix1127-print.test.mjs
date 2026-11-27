// 인쇄(브라우저 인쇄·PDF 저장) 규칙 — `npm test`
//
// 2026-11-27 버그 목록(tmp/handoff-2026-11-26/research/버그목록-1127.md)의 G-print 묶음:
//   print-header-selector-too-broad — 인쇄 규칙이 요소 선택자 header, footer 를 통째로 숨겨 /company 카드 머리(상호·로마자·종합 점수)와
//     도구 화면의 제목 묶음(h1)까지 인쇄물에서 빠졌다 → 사이트 머리말(Header.tsx)·꼬리말(Footer.tsx)만 숨긴다.
//   print-color-adjust-missing — 막대·종합 타일이 배경색으로만 그려져 인쇄 기본값('배경 그래픽' 꺼짐)에서 사라졌다 → print-color-adjust: exact.
//   K5(11/26 EX-6) — section 마다 break-inside: avoid 라 큰 묶음이 통째로 다음 쪽으로 밀렸다(/evaluate 5쪽) → 짧은 블록만 묶는다.
//   ohaeng-print-layout — /ohaeng 결과 인쇄가 1쪽에 폼만, 설명 글·'맞춰 보기'까지 8쪽 → 결과가 있으면 폼·머리말·설명 글·링크를 뺀다.
// 원문을 읽어 확인한다(화면은 합친 뒤 Chrome 인쇄 미리보기로 본다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "src");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8").replace(/\r\n/g, "\n"); // Windows 체크아웃(autocrlf)도 같은 결과
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const stripJsComments = (s) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}
const SOURCES = walk(SRC).map((p) => ({ rel: relative(SRC, p).split(sep).join("/"), text: readFileSync(p, "utf8").replace(/\r\n/g, "\n") }));

/** open 위치의 여는 중괄호에 짝이 맞는 닫는 중괄호 위치 */
function matchBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  throw new Error("중괄호 짝이 맞지 않는다");
}

/** 괄호 밖의 쉼표로 선택자 목록을 나눈다(:has(...)·:not(...) 안의 쉼표는 그대로) */
function splitSelectors(list) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map((s) => s.replace(/\s+/g, " "));
}

/** 블록 안의 규칙(선택자 목록 + 본문). @page 같은 중첩 at 규칙은 건너뛴다 */
function parseRules(block) {
  const rules = [];
  let i = 0;
  while (i < block.length) {
    const open = block.indexOf("{", i);
    if (open < 0) break;
    const head = block.slice(i, open).trim();
    const close = matchBrace(block, open);
    if (!head.startsWith("@")) rules.push({ selectors: splitSelectors(head), body: block.slice(open + 1, close) });
    i = close + 1;
  }
  return rules;
}

const CSS = stripCssComments(read("src", "app", "globals.css"));
const printAt = [...CSS.matchAll(/@media print\s*\{/g)];
const PRINT = (() => {
  assert.equal(printAt.length, 1, "globals.css 의 @media print 는 한 곳");
  const open = printAt[0].index + printAt[0][0].length - 1;
  return CSS.slice(open + 1, matchBrace(CSS, open));
})();
const RULES = parseRules(PRINT);
const hides = (r) => /display:\s*none\s*!important/.test(r.body);

/** 선택자 s 의 at 위치가 열린 :is( 또는 :where( 괄호 안인가 */
function insideForgiving(s, at) {
  const stack = [];
  for (let i = 0; i < at; i++) {
    if (s[i] === "(") stack.push(/:(is|where)$/.test(s.slice(0, i)));
    else if (s[i] === ")") stack.pop();
  }
  return stack.includes(true);
}
const rulesWith = (sel) => RULES.filter((r) => r.selectors.includes(sel));
const declares = (sel, re) => rulesWith(sel).some((r) => re.test(r.body));

// ─── print-header-selector-too-broad ─────────────────────────────

test("인쇄 규칙은 요소 선택자 header·footer 를 숨기지 않는다 — 카드 머리·제목 묶음(<header>)이 인쇄된다", () => {
  assert.ok(RULES.length >= 10, `인쇄 규칙 ${RULES.length}개만 읽음 — 파서를 볼 것`);
  for (const r of RULES.filter(hides)) {
    for (const s of r.selectors) {
      assert.doesNotMatch(s, /^(header|footer)$/, `요소 선택자 '${s}' 를 통째로 숨긴다`);
      assert.doesNotMatch(s, /^(main|section|article) (header|footer)$/, s);
    }
  }
  // 그 <header> 들 — /company 카드 머리, 도구 화면 제목 묶음(h1)
  assert.match(read("src", "components", "design", "CompanyResult.tsx"), /<header\b/);
  assert.match(read("src", "app", "ohaeng", "page.tsx"), /<header className="mb-10 space-y-3 text-center"[^>]*>\s*<p className="eyebrow">/);
});

test("사이트 머리말은 Header.tsx 의 클래스로, 꼬리말은 Footer.tsx 의 data-hide-print 로 숨긴다", () => {
  for (const sel of [".site-header-inner", ".site-header-mobile", ".hide-on-print", "[data-hide-print]"]) {
    assert.ok(rulesWith(sel).some(hides), `${sel} 를 숨기는 규칙이 없다`);
  }
  // 빈 껍데기까지 숨기는 :has() 규칙
  const shell = rulesWith(":is(header:has(> .site-header-inner))");
  assert.equal(shell.length, 1);
  assert.ok(hides(shell[0]));
  // :has() 는 늘 :is()·:where() 안 — 빌드(lightningcss)가 선언이 같은 규칙을 한 목록으로 합쳐도, :has() 를 모르는 브라우저가
  // 목록 전체(.hide-on-print·[data-hide-print] 까지)를 버리지 않게(관대한 선택자 목록)
  let hasCount = 0;
  for (const r of RULES) {
    for (const s of r.selectors) {
      for (const m of s.matchAll(/:has\(/g)) {
        hasCount++;
        assert.ok(insideForgiving(s, m.index), `맨 :has() — ${s}`);
      }
    }
  }
  assert.equal(hasCount, 2, "머리말 껍데기·결과 화면 두 곳");

  // Header.tsx — 바깥 <header> 하나, 그 안에 두 클래스(이 순서). 두 클래스는 다른 곳에서 쓰지 않는다(인쇄에서 함께 사라진다)
  // 주석은 걷는다(G-site-chrome 이 바깥 <header> 에 data-hide-print 를 달며 주석에 '<header>'를 적었다)
  const header = stripJsComments(read("src", "components", "design", "Header.tsx"));
  assert.equal([...header.matchAll(/<header\b/g)].length, 1);
  const at = (needle) => {
    const i = header.indexOf(needle);
    assert.ok(i >= 0, `Header.tsx 에 ${needle} 가 없다`);
    return i;
  };
  const open = at("<header");
  const inner = at('className="site-header-inner"');
  const mobile = at("className={`site-header-mobile");
  const close = at("</header>");
  assert.ok(open < inner && inner < mobile && mobile < close);
  for (const f of SOURCES.filter((x) => x.rel !== "components/design/Header.tsx")) {
    assert.doesNotMatch(f.text, /site-header-(inner|mobile)/, f.rel);
  }

  // Footer.tsx — <footer data-hide-print
  const footer = stripJsComments(read("src", "components", "design", "Footer.tsx"));
  assert.match(footer, /<footer\s+data-hide-print\s/);
  assert.equal([...footer.matchAll(/<footer\b/g)].length, 1);
});

// ─── print-color-adjust-missing ──────────────────────────────────

test("배경색으로만 그린 막대·타일이 '배경 그래픽' 꺼짐에서도 찍힌다 — print-color-adjust: exact", () => {
  assert.ok(declares("*", /(^|[\s;])print-color-adjust:\s*exact/), "* 에 print-color-adjust: exact");
  assert.ok(declares("*", /-webkit-print-color-adjust:\s*exact/), "* 에 -webkit-print-color-adjust: exact(Safari·옛 Chrome)");
  assert.ok(declares("*::before", /print-color-adjust:\s*exact/));
  // 바탕이 찍히니 쪽 바탕은 흰색 — html 에도 종이색이 깔려 있다(@layer base html, body)
  assert.match(CSS, /html,\s*body \{\s*background: var\(--color-background\);/);
  for (const sel of ["html", "body"]) assert.ok(declares(sel, /background:\s*#fff !important/), `${sel} 바탕`);
  // 장식은 뺀다
  for (const sel of [".ink-wash", ".paper-grain::before"]) assert.ok(rulesWith(sel).some(hides), sel);
  // 카드 바탕 단순화 규칙이 /company 막대 트랙(bg-surface-2 · rounded-full)을 지우지 않는다
  assert.ok(rulesWith('[class*="surface"]').length === 0, "옛 [class*=surface] 그대로면 막대 트랙이 투명해진다");
  assert.ok(declares('[class*="surface"]:not(.rounded-full)', /background:\s*transparent !important/));
  assert.match(read("src", "components", "design", "CompanyResult.tsx"), /className="[^"]*\brounded-full\b[^"]*\bbg-surface-2\b[^"]*"/);
});

test("링크 — 글자를 둘레 색(inherit)으로 덮는 규칙은 링크 자신의 바탕도 지운다(짙은 단추형 링크가 검은 상자에 검은 글자로 찍히지 않게)", () => {
  // 검토 지적(11-27): * 의 exact 로 bg-navy·인라인 var(--color-navy)(#14120f) 링크 바탕이 찍히는데, a { color: inherit } 가 흰 글자를
  // 둘레 글자색(#000·#14120f)으로 덮어 '이름 추천받기 →' 같은 CTA 가 검은 상자만 남았다. 링크를 exact 에서 빼도 사용자가 '배경 그래픽'을
  // 켜면 같은 일이 나므로 바탕 지우기가 답이다 — 막대·타일·칩은 링크가 아니고, 링크 안 자식의 바탕은 그대로 찍힌다.
  const linkSel = /(^|[\s>+~(])a(?![\w-])/;
  const recolors = RULES.filter((r) => r.selectors.some((s) => linkSel.test(s)) && /(^|[\s;])color:\s*inherit/.test(r.body));
  assert.ok(rulesWith("a").some((r) => recolors.includes(r)), "a { color: inherit } 규칙을 읽지 못함 — 파서를 볼 것");
  for (const r of recolors) {
    assert.match(r.body, /(^|[\s;])background:\s*none\s*!important/, `${r.selectors.join(", ")} — 글자색만 덮고 바탕을 남긴다`);
  }
  // 링크 바탕을 다시 칠하는 인쇄 규칙이 없다
  for (const r of RULES) {
    if (recolors.includes(r) || !r.selectors.some((s) => linkSel.test(s))) continue;
    assert.doesNotMatch(r.body, /background(-color)?:\s*(?!none|transparent)/, r.selectors.join(", "));
  }
  // exact 는 * 전체에 그대로(막대·타일은 링크가 아니라 영향 없음)
  assert.ok(declares("*", /(^|[\s;])print-color-adjust:\s*exact/));
});

// ─── K5 — 쪽 나눔 ───────────────────────────────────────────────

test("쪽 나눔 — section 을 통째로 묶지 않고 점수 행·타일 줄·짧은 카드만 묶는다(K5)", () => {
  const avoids = (r) => /break-inside:\s*avoid/.test(r.body);
  for (const r of RULES.filter(avoids)) {
    for (const s of r.selectors) {
      assert.notEqual(s, "section", "큰 section 이 통째로 다음 쪽으로 밀린다");
      assert.notEqual(s, "main > *");
      assert.notEqual(s, ".eval-breakdown", "점수 패널은 수백 px — 묶지 않는다");
      assert.notEqual(s, ".breakdown-panel", "어디에도 없는 클래스");
    }
  }
  for (const sel of [".eval-score-grid", ".eval-score-bar", ".eval-2col > *", "tr"]) {
    assert.ok(rulesWith(sel).some(avoids), `${sel} 에 break-inside: avoid`);
  }
  for (const h of ["h1", "h2", "h3", "h4"]) assert.ok(declares(h, /break-after:\s*avoid/), `${h} 는 다음 내용과 같은 쪽에`);
  // 고르는 클래스가 실제로 있다
  assert.match(read("src", "components", "design", "EvalPrimitives.tsx"), /className="eval-score-bar"/);
  assert.match(read("src", "app", "evaluate", "EvaluateResult.tsx"), /className="eval-score-grid"/);
  assert.match(read("src", "components", "design", "EvalBody.tsx"), /className="eval-2col"/);
});

// ─── ohaeng-print-layout ─────────────────────────────────────────

test("/ohaeng 인쇄 — 결과가 있으면 폼·머리말·설명 글을 빼서 결과가 1쪽부터 온다", () => {
  // CSS: 결과 묶음이 있는 문서에서만 data-hide-print-with-result 를 숨긴다(:has() — 모르는 브라우저는 예전처럼 모두 찍는다)
  const rule = rulesWith(":where(body:has([data-print-result])) [data-hide-print-with-result]");
  assert.equal(rule.length, 1);
  assert.ok(hides(rule[0]));

  const page = stripJsComments(read("src", "app", "ohaeng", "page.tsx"));
  assert.match(page, /<main className="[^"]*\bprint:py-0\b[^"]*">/);
  assert.match(page, /<header className="mb-10 space-y-3 text-center" data-hide-print-with-result>[\s\S]*?<h1\b[\s\S]*?<\/header>/);
  assert.match(page, /<div data-hide-print-with-result>\s*<OhaengGuide \/>\s*<\/div>/);
  assert.match(page, /<OhaengClient \/>/);

  // 폼은 결과가 떠 있을 때만 인쇄에서 뺀다(결과 없이 찍으면 지금 화면 그대로)
  const client = stripJsComments(read("src", "app", "ohaeng", "OhaengClient.tsx"));
  assert.match(client, /<form\b[^>]*?\sdata-hide-print=\{shown \? true : undefined\}/);

  // 결과 묶음 — 표지(data-print-result), 위 여백은 화면에서만, 인쇄 전용 머리 한 줄(사이트·도구 이름)
  const result = stripJsComments(read("src", "components", "design", "OhaengResult.tsx"));
  assert.match(result, /<section aria-labelledby="ohaeng-result-title" data-print-result className="mt-10 print:mt-0">/);
  const printLine = /<p className="hidden print:block"[^>]*>\s*([^<]+?)\s*<\/p>\s*<h2\b/.exec(result);
  assert.ok(printLine, "결과 제목 앞에 인쇄 전용 한 줄");
  assert.match(printLine[1], /이름의 결/);
  assert.match(printLine[1], /부족한 오행 찾기/);
  // data-print-result 는 이 결과 화면 하나 — 다른 화면에서 머리말·설명 글이 빠지지 않게
  const marked = SOURCES.filter((f) => /\sdata-print-result\b/.test(stripJsComments(f.text))).map((f) => f.rel);
  assert.deepEqual(marked, ["components/design/OhaengResult.tsx"]);
});

test("/ohaeng 인쇄 — '맞춰 보기'·그 안내·다음 단계 링크 카드는 빼고, 짧은 카드는 쪽 경계에서 갈리지 않는다", () => {
  const result = stripJsComments(read("src", "components", "design", "OhaengResult.tsx"));
  assert.match(result, /style=\{pickLink\}\s+data-hide-print\s*>\s*맞춰 보기\s*<\/a>/);
  assert.match(result, /<p style=\{\{ \.\.\.smallNote, marginTop: 16 \}\} data-hide-print>\s*‘맞춰 보기’는/);
  assert.match(result, /<div style=\{\{ \.\.\.card, padding: "22px 22px" \}\} data-hide-print>\s*<h3 style=\{cardTitle\}>다음 단계<\/h3>/);
  // 짧은 카드 셋(원국 표·오행 개수·용신과 희신)과 한자 칸 하나하나만 묶는다 — 한자 예 카드(다섯 묶음 × 12자)는 길어 쪼개질 수 있게
  for (const title of ["오행 개수", "용신과 희신"]) {
    assert.match(result, new RegExp(`className="print:break-inside-avoid"[^<]*>\\s*<h3 style=\\{cardTitle\\}>${title}</h3>`), title);
  }
  assert.match(result, /<div className="print:break-inside-avoid" style=\{\{ \.\.\.card, overflow: "hidden" \}\}>\s*<div style=\{\{ display: "grid"/);
  assert.match(result, /<div style=\{\{ \.\.\.card, padding: "22px 22px" \}\}>\s*<h3 style=\{cardTitle\}>오행별 이름 한자 예<\/h3>/);
  assert.match(result, /function HanjaItem[\s\S]*?<li\s+className="print:break-inside-avoid"/);
  assert.equal([...result.matchAll(/print:break-inside-avoid/g)].length, 4);
});

test("/ohaeng 인쇄 — 종이에 없는 것을 가리키는 문장('아래 설명'·'독음을 누르면')은 빼고, 앞 문장은 남긴다", () => {
  const result = stripJsComments(read("src", "components", "design", "OhaengResult.tsx"));
  // '아래 설명'이 가리키는 설명 글(page.tsx 의 OhaengGuide)과 같은 표지 — 설명 글이 빠질 때만 함께 빠진다(:has() 를 모르면 둘 다 찍힌다)
  assert.match(
    result,
    /용신은 억부·조후 가운데 무엇을 앞세우느냐에 따라 달라져, 다른 곳에서 본 용신과 다를 수 있어요\.\{" "\}\s*<span data-hide-print-with-result>‘없는 오행’과 용신이 어떻게 다른지는 아래 설명에 적었어요\.<\/span>\s*<\/p>/,
  );
  assert.match(read("src", "app", "ohaeng", "page.tsx"), /<div data-hide-print-with-result>\s*<OhaengGuide \/>\s*<\/div>/);
  // 종이에서는 누를 수 없는 조작 안내
  assert.match(
    result,
    /이 글자를 써야 한다는 뜻은 아닙니다\.\{" "\}\s*<span data-hide-print>독음을 누르면 한자 사전에서 같은 독음의 글자를 볼 수 있어요\.<\/span>\s*<\/p>/,
  );
  // 감싸지 않은 채 남은 같은 문장이 없다
  assert.equal([...result.matchAll(/아래 설명에 적었어요/g)].length, 1);
  assert.equal([...result.matchAll(/독음을 누르면/g)].length, 1);
});
