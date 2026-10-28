// 팔레트 대비·오행 색 구분 테스트 — `npm test`
//
// 2026-10-26 팔레트 #2(사용자 승인 — 색상 정체성은 지키고 글자·아이콘 색만 짙게, 바탕·테두리·막대는 그대로):
// - 캡션 토큰 text-3(#8a857c)이 흰 3.67 · 종이 3.51 · surface-2 3.27:1 로 WCAG AA(작은 글자 4.5:1) 미달 → 같은 색상에서 밝기만 내렸다
// - 오행 배지(/hanja HanjaBadges)·오행 칩(/evaluate·/analysis FIVE_EL)의 火·土·水(·木·金) 글자가 AA 미달 → 글자 전용 토큰.
//   火·土 를 둘 다 짙게 하면 같은 갈색이 돼서(옛 ΔE 7.2·8.1) 火 는 주황 쪽, 土 는 짙은 황토로 갈라 CIEDE2000 ΔE 15 이상을 지킨다
// - 골드 강조 작은 글씨 gold-600(#b49258 — 흰 2.92:1) → gold-800, 골드 아이콘·큰 점수 숫자 → gold-700(비텍스트·큰 글씨 3:1)
// - /method '미상' 칩 글자(text-3/surface-2 3.27:1)·DontRow XCircle 아이콘(#B5874C/surface-2 2.87:1)
// 색 값은 globals.css(와 Tailwind 기본 팔레트)에서 읽는다 — 토큰 값을 바꾸면 여기서 다시 잰다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  ROOT,
  read,
  token,
  hexRgb,
  tailwindColor,
  utilityColor,
  cssValueColor,
  contrast,
  tint,
  deltaE00,
  deltaE00Lab,
} from "./color-utils.mjs";

const AA = 4.5; // 작은 글자(18px 미만·굵은 14px 미만)
const NON_TEXT = 3; // 아이콘·큰 글자(WCAG 1.4.3 큰 글자·1.4.11 비텍스트)
const WHITE = hexRgb(token("color-surface-token"));
const PAPER = hexRgb(token("color-background-token"));
const SURFACE_2 = hexRgb(token("color-surface-2-token"));
const NAVY_50 = hexRgb(token("color-navy-50-token"));
const TEAL_50 = hexRgb(token("color-teal-50-token"));
const GOLD_50 = hexRgb(token("color-gold-50-token"));
const GOLD_100 = hexRgb(token("color-gold-100-token"));
const AMBER = hexRgb(token("color-amber-warm-token"));
const r2 = (x) => x.toFixed(2);
const ELEMENTS = ["木", "火", "土", "金", "水"];

test("CIEDE2000 구현이 Sharma·Wu·Dalal(2005) 시험 자료와 맞는다", () => {
  const cases = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  for (const [a, b, e] of cases) assert.ok(Math.abs(deltaE00Lab(a, b) - e) < 1e-4, `${a} ${b}: ${deltaE00Lab(a, b)} ≠ ${e}`);
});

// ─── 캡션 text-3 ───────────────────────────────────────────────

const TEXT_1 = hexRgb(token("color-text-token"));
const TEXT_2 = hexRgb(token("color-text-2-token"));
const TEXT_3 = hexRgb(token("color-text-3-token"));

test("캡션 text-3 는 자주 놓이는 바탕 모두에서 4.5:1 을 넘는다", (t) => {
  // dev 서버 실측(/·/method·/guide·/evaluate·/name/다솜): 종이·흰 카드·surface-2 가 대부분, 결과 화면 틴트 카드(navy·teal·gold-50)도 함께 본다
  for (const [label, bg] of [
    ["흰 카드", WHITE],
    ["종이", PAPER],
    ["surface-2(/method '미상' 칩·/guide 목차)", SURFACE_2],
    ["navy-50", NAVY_50],
    ["teal-50", TEAL_50],
    ["gold-50", GOLD_50],
  ]) {
    const r = contrast(TEXT_3, bg);
    t.diagnostic(`text-3 ${token("color-text-3-token")} / ${label}: ${r2(r)}:1`);
    assert.ok(r >= AA, `${label} ${r2(r)}:1 < ${AA}`);
  }
});

test("글자 위계 text-1 > text-2 > text-3 — text-3 는 짙어진 뒤에도 text-2 보다 눈에 띄게 옅다", (t) => {
  const [c1, c2, c3] = [TEXT_1, TEXT_2, TEXT_3].map((c) => contrast(c, WHITE));
  t.diagnostic(`흰 바탕 대비 text-1 ${r2(c1)} · text-2 ${r2(c2)} · text-3 ${r2(c3)}:1, text-2↔text-3 ${r2(contrast(TEXT_2, TEXT_3))}:1`);
  assert.ok(c1 > c2 && c2 > c3, "위계가 뒤집혔다");
  // text-2 와 text-3 사이 밝기 차(대비 1.5:1 이상 · ΔE 10 이상)가 없으면 캡션이 본문 강조와 구분되지 않는다
  assert.ok(contrast(TEXT_2, TEXT_3) >= 1.5, `text-2↔text-3 ${r2(contrast(TEXT_2, TEXT_3))}:1`);
  assert.ok(deltaE00(TEXT_2, TEXT_3) >= 10, `text-2↔text-3 ΔE ${deltaE00(TEXT_2, TEXT_3).toFixed(1)}`);
});

// ─── 오행 색 ───────────────────────────────────────────────────

/** /hanja·/name 오행 배지(HanjaBadges ELEMENT_COLOR) — 글자색·바탕색을 Tailwind 클래스에서 풀어낸다 */
function badgeElements() {
  const src = read("src", "components", "hanja", "HanjaBadges.tsx");
  const block = /const ELEMENT_COLOR[^{]*\{([\s\S]*?)\n\};/.exec(src);
  assert.ok(block, "HanjaBadges ELEMENT_COLOR 를 찾지 못했다");
  const out = {};
  for (const [, el, cls] of block[1].matchAll(/([木火土金水]):\s*"([^"]+)"/g)) {
    const text = /\btext-([\w-]+)/.exec(cls)[1];
    const bg = /\bbg-([\w-]+)/.exec(cls)[1];
    // 정의되지 않은 클래스: 金 text-navy-700 은 부모 글자색을 물려받고(/hanja 실측 #14120f = text-1),
    // 水 bg-paper-tint 는 투명이라 종이가 비친다(실측 #fbfaf5) — 디자인 결정 대기(CLAUDE.md '정의되지 않은 paper 클래스')
    out[el] = { text: utilityColor(text) ?? TEXT_1, bg: utilityColor(bg) ?? PAPER, textClass: text, bgClass: bg };
  }
  assert.deepEqual(Object.keys(out).sort(), [...ELEMENTS].sort());
  return out;
}

/** /evaluate·/analysis 오행 칩(DetailPrimitives FIVE_EL) — 글자색은 text, 바탕은 tintBg(rgba) */
function chipElements() {
  const src = read("src", "components", "design", "DetailPrimitives.tsx");
  const out = {};
  const re =
    /"([木火土金水])": \{\s*label: "\1",\s*name: "[^"]+",\s*color: "(#[0-9A-Fa-f]{6})",\s*text: "([^"]+)",\s*tintBg: "rgba\((\d+),(\d+),(\d+),([\d.]+)\)"/g;
  for (const [, el, marker, text, r, g, b, a] of src.matchAll(re)) {
    out[el] = { marker: hexRgb(marker), text: cssValueColor(text), tint: [[+r, +g, +b], +a], textValue: text };
  }
  assert.deepEqual(Object.keys(out).sort(), [...ELEMENTS].sort(), "FIVE_EL 다섯 항목에 글자색(text)이 있어야 한다 — 표지색(color)은 막대·테두리용");
  return out;
}

test("오행 배지(/hanja HanjaBadges) 글자는 배지 바탕·종이·흰 카드에서 4.5:1 을 넘는다", (t) => {
  for (const [el, { text, bg, textClass, bgClass }] of Object.entries(badgeElements())) {
    for (const [label, under] of [[`배지 바탕 bg-${bgClass}`, bg], ["종이", PAPER], ["흰 카드", WHITE]]) {
      const r = contrast(text, under);
      t.diagnostic(`${el} text-${textClass} / ${label}: ${r2(r)}:1`);
      assert.ok(r >= AA, `${el} text-${textClass} / ${label} ${r2(r)}:1 < ${AA}`);
    }
  }
});

test("오행 칩(FIVE_EL) 글자는 제 틴트 바탕(흰 카드·종이 위)에서 4.5:1 을 넘는다", (t) => {
  for (const [el, { text, tint: [rgb, a], textValue }] of Object.entries(chipElements())) {
    for (const [label, under] of [["흰 카드 위 틴트", tint(rgb, a, WHITE)], ["종이 위 틴트", tint(rgb, a, PAPER)], ["흰 카드", WHITE], ["종이", PAPER]]) {
      const r = contrast(text, under);
      t.diagnostic(`${el} ${textValue} / ${label}: ${r2(r)}:1`);
      assert.ok(r >= AA, `${el} ${textValue} / ${label} ${r2(r)}:1 < ${AA}`);
    }
  }
});

test("火·土 는 배지·칩이 같은 글자 토큰을 쓴다", (t) => {
  const badge = badgeElements(), chip = chipElements();
  for (const el of ["火", "土"]) assert.deepEqual(chip[el].text, badge[el].text, el);
  // (참고·디자인 결정 대기) 木·金·水 는 화면마다 글자색이 다르다 — /hanja 木(Tailwind teal-700)과 /evaluate 金(teal-800)이 거의 같은 청록.
  // 팔레트 #2 전부터(옛 金 칩 #2E7D7A 와 4.4) 있던 차이이고, 맞추려면 /hanja 배지의 색상 자체가 바뀐다(CLAUDE.md '대비 미달로 남은 색')
  t.diagnostic(`배지↔칩 같은 오행 ΔE00: ${["木", "金", "水"].map((e) => `${e} ${deltaE00(badge[e].text, chip[e].text).toFixed(1)}`).join(" · ")}`);
  t.diagnostic(`배지 木 ↔ 칩 金 ΔE00 ${deltaE00(badge["木"].text, chip["金"].text).toFixed(1)} (같은 청록 — 화면을 오가면 헷갈릴 수 있다)`);
  // (참고) 갈색 계열 의미 채널 — 土·火 글자 ↔ 경고·'이견 있음' 글자(amber-warm-700), 디자이너 리터럴 #6F5421 ↔ gold-800
  const a700 = hexRgb(token("color-amber-warm-700-token"));
  t.diagnostic(
    `ΔE00 土(gold-800)↔경고(amber-warm-700) ${deltaE00(badge["土"].text, a700).toFixed(1)} · 火(amber-warm-600)↔경고 ` +
      `${deltaE00(badge["火"].text, a700).toFixed(1)} · #6F5421↔gold-800 ${deltaE00(hexRgb("#6f5421"), badge["土"].text).toFixed(1)}`
  );
});

/** 다섯 오행 글자색 쌍별 CIEDE2000 */
function pairwise(colors) {
  const out = [];
  for (let i = 0; i < ELEMENTS.length; i++)
    for (let j = i + 1; j < ELEMENTS.length; j++)
      out.push([`${ELEMENTS[i]}${ELEMENTS[j]}`, deltaE00(colors[ELEMENTS[i]], colors[ELEMENTS[j]])]);
  return out;
}

test("오행 글자색 다섯 개가 서로 구분된다 — 火·土 ΔE ≥ 15, 나머지 쌍 ≥ 12 (CIEDE2000)", (t) => {
  const badge = badgeElements(), chip = chipElements();
  for (const [name, colors] of [
    ["배지(HanjaBadges)", Object.fromEntries(ELEMENTS.map((e) => [e, badge[e].text]))],
    ["칩(FIVE_EL)", Object.fromEntries(ELEMENTS.map((e) => [e, chip[e].text]))],
  ]) {
    const pairs = pairwise(colors);
    t.diagnostic(`${name} ΔE00: ${pairs.map(([k, d]) => `${k} ${d.toFixed(1)}`).join(" · ")}`);
    for (const [k, d] of pairs) {
      // 옛 값: 火土 7.2(배지)·8.1(칩) — 둘 다 짙게만 하면 같은 갈색으로 붙는다.
      // 칩의 木(초록)·金(청록)은 원래 13.1 이라(색상 그대로 밝기만 내림 — 13.0) 12 를 바닥으로 둔다
      const min = k === "火土" ? 15 : 12;
      assert.ok(d >= min, `${name} ${k} ΔE ${d.toFixed(1)} < ${min}`);
    }
  }
});

test("FIVE_EL 표지색(막대·왼쪽 테두리)은 옛 색 그대로 — 글자만 짙은 토큰", () => {
  const chip = chipElements();
  const old = { 木: "#4a7c59", 火: "#b5874c", 土: "#9a7e3a", 金: "#2e7d7a", 水: "#1e3a5f" };
  for (const el of ELEMENTS) assert.deepEqual(chip[el].marker, hexRgb(old[el]), el);
  // 글자 자리에 표지색(.color)을 다시 쓰면 걸린다 — 막대 background·borderLeft 는 괜찮다
  const offenders = [];
  for (const f of ["DetailSaju.tsx", "DetailMid.tsx", "DetailHanja.tsx", "EvalPrimitives.tsx"]) {
    read("src", "components", "design", f)
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (/(?<![\w-])color:\s*[\w[\]?.]*\.color\b/.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(offenders, []);
});

test("/evaluate 부족 오행 칩·/name 두 글자 오행 관계 칩 글자도 4.5:1 을 넘는다", (t) => {
  // DetailSaju 부족 오행 칩 — amber 14% 틴트 바탕(옛 글자 #9A7E3A 3.37:1)
  const saju = read("src", "components", "design", "DetailSaju.tsx");
  const m = /background: "rgba\(181,135,76,0\.14\)",\s*color: "([^"]+)"/.exec(saju);
  assert.ok(m, "부족 오행 칩을 찾지 못했다");
  for (const [label, under] of [["흰 카드", WHITE], ["종이", PAPER]]) {
    const r = contrast(cssValueColor(m[1]), tint(AMBER, 0.14, under));
    t.diagnostic(`부족 오행 ${m[1]} / ${label} 위 amber 14%: ${r2(r)}:1`);
    assert.ok(r >= AA);
  }
  // /name 한자 조합 카드 상생·비화·상극 칩(OHAENG_CHIP) — 옛 극 gold-700/gold-50 3.40:1
  const name = read("src", "app", "name", "[slug]", "page.tsx");
  const block = /const OHAENG_CHIP[^{]*\{([\s\S]*?)\n\};/.exec(name);
  assert.ok(block, "OHAENG_CHIP 을 찾지 못했다");
  for (const [, kind, cls] of block[1].matchAll(/(생|비화|극):\s*"([^"]+)"/g)) {
    const text = utilityColor(/\btext-([\w-]+)/.exec(cls)[1]);
    const bg = utilityColor(/\bbg-([\w-]+)/.exec(cls)[1]);
    const r = contrast(text, bg);
    t.diagnostic(`OHAENG_CHIP ${kind} ${cls}: ${r2(r)}:1`);
    assert.ok(r >= AA, `${kind} ${r2(r)}:1`);
  }
});

// ─── 골드 강조 ─────────────────────────────────────────────────

test("골드 강조 — 작은 글씨 gold-800 은 4.5:1, 아이콘·큰 숫자 gold-700 은 3:1 을 넘고 gold-600 은 어느 쪽도 못 넘는다", (t) => {
  const g800 = hexRgb(token("color-gold-800-token"));
  const g700 = hexRgb(token("color-gold-700-token"));
  const g600 = hexRgb(token("color-gold-600-token"));
  const textBgs = [
    ["흰 카드(Top Pick 머리말·인용 부호)", WHITE],
    ["종이(WhyKyeol 'OUR METHOD')", PAPER],
    ["gold-50(부모 이름 강조·土 배지·상호 TOP PICK)", GOLD_50],
    ["gold-100", GOLD_100],
    ["土 20% 틴트(흰 위)", tint([201, 169, 110], 0.2, WHITE)],
    ["土 20% 틴트(종이 위)", tint([201, 169, 110], 0.2, PAPER)],
    // 희귀 성씨 카드 아래 줄 희귀도 별 — 이 줄에서 단계를 알리는 것은 별 개수뿐이라 글자로 본다(옛 gold-700 3.48:1)
    ["surface-2(희귀 성씨 카드 희귀도 ★)", SURFACE_2],
  ];
  for (const [label, bg] of textBgs) {
    const r = contrast(g800, bg);
    t.diagnostic(`gold-800 / ${label}: ${r2(r)}:1 (옛 gold-600 ${r2(contrast(g600, bg))}:1)`);
    assert.ok(r >= AA, `gold-800 / ${label} ${r2(r)}:1`);
  }
  // gold-700 은 장식·아이콘(♥ ⚠ 인용 부호 ★)·18px 이상 굵은 점수에만 — 바탕은 흰·종이·gold-50
  for (const [label, bg] of [["흰 카드", WHITE], ["종이", PAPER], ["gold-50(희귀 성씨 조화 ★·DualCard ⚠)", GOLD_50]]) {
    const r = contrast(g700, bg);
    t.diagnostic(`gold-700 / ${label}: ${r2(r)}:1`);
    assert.ok(r >= NON_TEXT, `gold-700 / ${label} ${r2(r)}:1`);
  }
  assert.ok(contrast(g600, WHITE) < NON_TEXT, "gold-600 이 3:1 을 넘게 바뀌었다면 아래 허용 목록을 다시 볼 것");
});

/** src 아래 .ts·.tsx 전부 */
function sourceFiles(dir = join(ROOT, "src")) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "data" ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/**
 * 허용 목록 검사 — [파일, 그 줄 정규식, (선택) 바로 위 6줄 안에 있어야 하는 문맥 정규식]. 삼항식 한 줄(`? "var(--color-gold-600)"`)처럼
 * 줄만 봐서는 글자색인지 테두리인지 모르는 자리는 문맥(`border:`)까지 맞아야 통과한다 — 같은 파일의 새 글자색 삼항식은 걸린다
 */
function tokenOffenders(tokenRe, allowed) {
  const offenders = [];
  for (const file of sourceFiles()) {
    const rel = relative(join(ROOT, "src"), file).split(sep).join("/");
    const lines = read("src", ...rel.split("/")).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\/?\*|\{\/\*)/.test(line)) return; // 주석 줄
      if (!tokenRe.test(line.replace(/\s\/\/\s.*$/, ""))) return; // 줄 끝 주석(옛 색 설명)은 보지 않는다
      const above = lines.slice(Math.max(0, i - 6), i).join("\n");
      if (allowed.some(([f, re, ctx]) => f === rel && re.test(line) && (!ctx || ctx.test(above)))) return;
      offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }
  return offenders;
}

/** gold-600 이 남아도 되는 곳 — 테두리·바탕·막대·선(비텍스트, 정책상 그대로). 글자·아이콘 색으로 새로 쓰이면 실패한다 */
const ALLOWED_GOLD_600 = [
  ["components/design/DetailHanja.tsx", /border: "1\.5px solid var\(--color-gold-600\)"/], // V 배지 테두리
  ["components/design/EvaluateInput.tsx", /\(invalid \? "var\(--color-gold-600\)" : "var\(--color-border\)"\)/], // 입력칸 밑줄
  // 희귀도 칸 테두리 — border: "1px solid " + (i < filled ? … : …) 의 삼항식 한 줄
  ["components/design/SmartResult.tsx", /^\s*\? "var\(--color-gold-600\)"$/, /border:\s*$[\s\S]*"1px solid " \+/m],
  ["components/design/SmartResultParent.tsx", /^\s*lineColor: "var\(--color-gold-600\)",$/], // 부모 기반 의미축 연결선·화살표·주석 알약 테두리
  ["components/design/SmartResultRare.tsx", /background: "var\(--color-gold-600\)"/], // 4px 점
];

test("gold-600 은 테두리·바탕·막대에만 남는다 — 글자·아이콘은 gold-800 / gold-700", () => {
  assert.deepEqual(tokenOffenders(/gold-600/, ALLOWED_GOLD_600), []);
});

/**
 * gold-700(흰 3.90 · gold-50 3.40 · surface-2 3.48:1)이 남아도 되는 곳 — 장식·아이콘·18px 이상 굵은 점수·테두리(3:1 기준).
 * 작은 글씨(쌍둥이 'SET COHERENCE' 칩 11px 이 점수 색을 같이 쓰던 것·희귀도 별 11px)는 gold-800 이어야 한다(2026-10-26 팔레트 #2 보완)
 */
const ALLOWED_GOLD_700 = [
  ["components/design/SmartResult.tsx", /style=\{saved \? \{ color: "var\(--color-gold-700\)" \} : undefined\}/], // 저장 ♥
  ["components/design/SmartResult.tsx", /color: "var\(--color-gold-700\)", margin(Right: 4|Left: 2) \}/], // 장식 인용 부호 “ ”
  ["components/design/DualCard.tsx", /<span style=\{\{ color: "var\(--color-gold-700\)" \}\}>⚠<\/span>/], // 주의 아이콘
  ["components/design/SmartResultRare.tsx", /^\s*\? "var\(--color-gold-700\)"$/, /color: isActive\s*$/m], // 희귀 탭 장식 ★(라벨 글자가 따로 있다)
  ["components/design/TwinResultTop.tsx", /^\s*\? "var\(--color-gold-700\)"$/, /const color =\s*$/m], // 30px 점수·원 그래프(const color — 칩 글자는 chipText)
  ["components/hanja/HanjaBadges.tsx", /border-gold-700/], // V 배지 외곽선
];

test("gold-700 은 장식·아이콘·큰 점수·테두리에만 — 작은 글씨는 gold-800", () => {
  assert.deepEqual(tokenOffenders(/gold-700/, ALLOWED_GOLD_700), []);
});

test("쌍둥이 세트 조화도 'SET COHERENCE' 칩 글자는 점수 구간마다 칩 바탕에서 4.5:1 — 점수·원 그래프 색과 따로", (t) => {
  const src = read("src", "components", "design", "TwinResultTop.tsx");
  const ternary = (name) => {
    const m = new RegExp(`const ${name} =\\s*score >= 85\\s*\\? "([^"]+)"\\s*:\\s*score >= 70\\s*\\? "([^"]+)"\\s*:\\s*score >= 55\\s*\\? "([^"]+)"\\s*:\\s*"([^"]+)"`).exec(src);
    assert.ok(m, `TwinResultTop ${name} 삼항식을 찾지 못했다`);
    return m.slice(1);
  };
  const tints = ternary("tint"), chip = ternary("chipText");
  assert.match(src, /fontSize: 11,\s*fontWeight: 500,\s*color: chipText,\s*background: tint,/);
  ["85+", "70+", "55+", "<55"].forEach((band, i) => {
    const r = contrast(cssValueColor(chip[i]), cssValueColor(tints[i]));
    t.diagnostic(`${band} ${chip[i]} / ${tints[i]}: ${r2(r)}:1`);
    assert.ok(r >= AA, `${band} ${r2(r)}:1`);
  });
});

test("/hanja 흐린 글자 카드는 큰 글리프만 옅게 — 카드 전체 opacity 가 배지 12px 글자를 AA 아래로 끌어내리지 않는다", (t) => {
  const src = read("src", "components", "hanja", "HanjaCharCard.tsx");
  const card = /const body = \(\s*<div\s+className=\{cn\(([\s\S]*?)\)\}\s*>/.exec(src);
  assert.ok(card, "HanjaCharCard 카드 컨테이너를 찾지 못했다");
  assert.doesNotMatch(card[1], /opacity/, "카드 컨테이너에 opacity 를 걸면 오행·등급 배지 글자까지 반투명이 된다");
  assert.match(src, /"font-hanja text-3xl font-medium text-navy",\s*isDimmedCard\(record\) && "opacity-75",/);
  // 옛 카드 전체 0.75 를 가장 옅은 오행 배지 글자(水 — 종이 위)에 씌우면 얼마였는지 기록
  const water = utilityColor("score-mid-700");
  t.diagnostic(`옛 opacity-75 水 배지: ${r2(contrast(tint(water, 0.75, PAPER), PAPER))}:1 (불투명 ${r2(contrast(water, PAPER))}:1)`);
});

test("/method 점수 구성 배점 숫자(12px)는 흰 카드에서 4.5:1 — 막대 색(accent)과 글자색(textAccent)을 나눈다", (t) => {
  const src = read("src", "app", "method", "page.tsx");
  const blocks = [...src.matchAll(/<ScoreBlock\b([\s\S]*?)\/>/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 2, "ScoreBlock 을 찾지 못했다");
  for (const b of blocks) {
    const accent = /\saccent="([^"]+)"/.exec(b)[1];
    const text = /textAccent="([^"]+)"/.exec(b)?.[1] ?? accent;
    const r = contrast(cssValueColor(text), WHITE);
    t.diagnostic(`${/title="([^"]+)"/.exec(b)[1]} 배점 ${text} / 흰 카드: ${r2(r)}:1 (막대 ${accent})`);
    assert.ok(r >= AA, `${text} ${r2(r)}:1`);
  }
  assert.match(src, /color: textAccent \?\? accent,/);
});

test("결과 화면 점수 타일 라벨(11px)·강점/약점 제목(13px)은 짙은 글자 토큰 — 숫자는 점수 색 그대로", (t) => {
  // ScoreTile(/evaluate·/analysis 상단 — 종이 위 10% 틴트). mid 는 종이 위 4.47:1 로 아직 조금 모자라(CLAUDE.md '대비 미달로 남은 색') 흰 위만 4.5 를 본다
  const prim = read("src", "components", "design", "DetailPrimitives.tsx");
  for (const [variant, rgb, a, minPaper] of [["high", [74, 124, 89], 0.1, AA], ["mid", [91, 127, 170], 0.1, 4.4]]) {
    const m = new RegExp(`${variant}: \\{ bg: "rgba\\(${rgb.join(",")},${a.toFixed(2)}\\)", color: "[^"]+", label: "([^"]+)" \\}`).exec(prim);
    assert.ok(m, `ScoreTile ${variant} 라벨 색을 찾지 못했다`);
    const label = cssValueColor(m[1]);
    const [w, p] = [contrast(label, tint(rgb, a, WHITE)), contrast(label, tint(rgb, a, PAPER))];
    t.diagnostic(`ScoreTile ${variant} 라벨 ${m[1]}: 흰 위 틴트 ${r2(w)} · 종이 위 틴트 ${r2(p)}:1`);
    assert.ok(w >= AA && p >= minPaper, `${variant} ${r2(w)}/${r2(p)}`);
  }
  assert.match(prim, /color: t\.label,/);
  // '이 이름의 강점'(EvalBody)·'강점'·'약점'(DetailMid) 제목 — 초록 8%·골드 12% 틴트(종이 위)
  for (const [file, re, rgb, a] of [
    ["EvalBody.tsx", /tintBg: "rgba\(74,124,89,0\.08\)",[\s\S]*?accent: "([^"]+)"/, [74, 124, 89], 0.08],
    ["EvalBody.tsx", /tintBg: "rgba\(201,169,110,0\.12\)",[\s\S]*?accent: "([^"]+)"/, [201, 169, 110], 0.12],
    ["DetailMid.tsx", /tintBg="rgba\(74,124,89,0\.08\)"[\s\S]*?accent="([^"]+)"/, [74, 124, 89], 0.08],
    ["DetailMid.tsx", /tintBg="rgba\(201,169,110,0\.12\)"[\s\S]*?accent="([^"]+)"/, [201, 169, 110], 0.12],
  ]) {
    const m = re.exec(read("src", "components", "design", file));
    assert.ok(m, `${file} 제목 색을 찾지 못했다`);
    const r = contrast(cssValueColor(m[1]), tint(rgb, a, PAPER));
    t.diagnostic(`${file} ${m[1]} / 종이 위 ${Math.round(a * 100)}% 틴트: ${r2(r)}:1`);
    assert.ok(r >= AA, `${file} ${m[1]} ${r2(r)}:1`);
  }
});

test("홈 준비 중 카드·푸터 '준비 중' 배지 — 반투명·검정 8% 바탕 위 text-3 가 4.5:1 아래로 내려가지 않는다", (t) => {
  const cats = read("src", "components", "design", "Categories.tsx");
  assert.doesNotMatch(cats, /opacity: isComing \? 0\.78 : 1/, "카드 전체 opacity 0.78 은 'Coming' 10px text-3 를 3.33:1 로 만든다");
  t.diagnostic(`옛 Coming 카드: text-3 @0.78 / 종이 ${r2(contrast(tint(TEXT_3, 0.78, PAPER), PAPER))}:1`);
  const footer = read("src", "components", "design", "Footer.tsx");
  const soon = /color: "var\(--color-text-3\)",[\s\S]*?background: "([^"]+)",[\s\S]*?준비 중/.exec(footer);
  assert.ok(soon, "Footer '준비 중' 배지를 찾지 못했다");
  const r = contrast(TEXT_3, cssValueColor(soon[1]));
  t.diagnostic(`Footer '준비 중' text-3 / ${soon[1]}: ${r2(r)}:1 (옛 divider 8% 종이 위 ${r2(contrast(TEXT_3, tint(TEXT_1, 0.08, PAPER)))}:1)`);
  assert.ok(r >= AA);
  // text-3 를 아직 4.5:1 아래로 두는 바탕 — 지금 text-3 글자를 올린 곳은 없다(쓰게 되면 바탕을 surface-2 등으로)
  for (const [label, bg] of [["navy-100", hexRgb(token("color-navy-100-token"))], ["gold-100", GOLD_100]])
    t.diagnostic(`(참고·미달) text-3 / ${label}: ${r2(contrast(TEXT_3, bg))}:1`);
});

test("부모 기반 의미축 연결선·주석 알약 테두리는 글자 색(gold-800)과 따로 — 선은 옛 gold-600 그대로", () => {
  const src = read("src", "components", "design", "SmartResultParent.tsx");
  assert.match(src, /<ConnectorSVG color=\{bridge\.lineColor\} \/>/);
  assert.match(src, /border: "1px solid " \+ bridge\.lineColor,/);
  assert.match(src, /color: "var\(--color-gold-800\)",\s*lineColor: "var\(--color-gold-600\)",/);
});

// ─── /method ───────────────────────────────────────────────────

test("/method '미상' 칩 글자(4.5:1)·DontRow XCircle 아이콘(비텍스트 3:1)", (t) => {
  const src = read("src", "app", "method", "page.tsx");
  const u = /U: \{\s*background: "([^"]+)",\s*color: "([^"]+)",/.exec(src);
  assert.ok(u, "/method 등급 칩 U 를 찾지 못했다");
  const uRatio = contrast(cssValueColor(u[2]), cssValueColor(u[1]));
  t.diagnostic(`'미상' 칩 ${u[2]} / ${u[1]}: ${r2(uRatio)}:1`);
  assert.ok(uRatio >= AA);

  const dont = /function DontRow[\s\S]*?background: "([^"]+)"[\s\S]*?<XCircle[\s\S]*?color: "([^"]+)"/.exec(src);
  assert.ok(dont, "/method DontRow XCircle 을 찾지 못했다");
  const xRatio = contrast(cssValueColor(dont[2]), cssValueColor(dont[1]));
  t.diagnostic(`XCircle ${dont[2]} / ${dont[1]}: ${r2(xRatio)}:1`);
  assert.ok(xRatio >= NON_TEXT);
});

test("amber-warm-600(火 글자)도 작은 글씨 바탕에서 4.5:1 — amber-50·흰·종이·火 14% 틴트", (t) => {
  const a600 = hexRgb(token("color-amber-warm-600-token"));
  for (const [label, bg] of [
    ["amber-50", tailwindColor("amber-50")],
    ["흰 카드", WHITE],
    ["종이", PAPER],
    ["火 14% 틴트(흰 위)", tint(AMBER, 0.14, WHITE)],
    ["火 14% 틴트(종이 위)", tint(AMBER, 0.14, PAPER)],
  ]) {
    const r = contrast(a600, bg);
    t.diagnostic(`amber-warm-600 / ${label}: ${r2(r)}:1`);
    assert.ok(r >= AA, `${label} ${r2(r)}:1`);
  }
});
