// 감점·경고·'이견 있음' 작은 글씨 대비 테스트 — `npm test`
//
// 2026-10-26 F3(배포 검증 BR-3·signed-points 이월): 감점 숫자(/name 미학 점수 카드 '성별 보너스 -2')·'이견 있음' 배지·
// 경고 상자 글자가 amber-warm(#b5874c)이라 흰 카드 3.21:1 · 종이 3.08:1 로 WCAG AA(작은 글자 4.5:1)에 못 미쳤다.
// 작은 글씨에 쓰는 곳만 짙은 amber-warm-700(#7A5B22 — DetailHanja V 배지가 이미 쓰던 값)으로 바꾸고, 테두리·바탕·아이콘은 amber-warm 그대로다.
// 대비는 globals.css(와 Tailwind amber-50)의 실제 색 값으로 계산한다 — 토큰 값을 바꾸면 여기서 다시 잰다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const CSS = read("src", "app", "globals.css");

/** globals.css :root 의 `--name: #rrggbb;` 값 */
function token(name) {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(CSS);
  assert.ok(m, `globals.css 에 --${name} 가 없다`);
  return m[1];
}

function hexRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Tailwind 기본 팔레트(oklch) → sRGB 0~255 */
function oklchRgb(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((x) => {
    const c = Math.min(1, Math.max(0, x));
    return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
  });
}

function tailwindColor(name) {
  const theme = readFileSync(join(ROOT, "node_modules", "tailwindcss", "theme.css"), "utf8");
  const m = new RegExp(`--color-${name}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(theme);
  assert.ok(m, `tailwindcss theme.css 에 --color-${name} 가 없다`);
  return oklchRgb(Number(m[1]) / 100, Number(m[2]), Number(m[3]));
}

function luminance([r, g, b]) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG 2.x 대비 */
function contrast(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** rgba(fg, alpha) 를 bg 위에 합성 — color-mix(… N%, transparent)·rgba 틴트 바탕 */
const tint = (rgb, alpha, under) => rgb.map((c, i) => Math.round(alpha * c + (1 - alpha) * under[i]));

const AA_SMALL = 4.5;
const AMBER = hexRgb(token("color-amber-warm-token"));
const AMBER_700 = hexRgb(token("color-amber-warm-700-token"));
const WHITE = hexRgb(token("color-surface-token")); // 카드(bg-card·--color-surface)
const PAPER = hexRgb(token("color-background-token")); // 페이지 바탕 — 투명 배지가 놓이는 곳
const GOLD_50 = hexRgb(token("color-gold-50-token")); // '이견 있음' 배지 hover 바탕
const AMBER_50 = tailwindColor("amber-50"); // 경고 상자 bg-amber-50

/** 짙은 amber-warm 글자가 놓이는 바탕 — 화면에서 실제로 쓰는 조합 */
const BACKGROUNDS = [
  ["흰 카드(/method '이견 있음' 칩·SmartResult 카드)", WHITE],
  // /name 미학 카드는 bg-paper-card 가 정의돼 있지 않아(cn 이 bg-card 를 지운다) 바탕이 투명 — 감점 숫자는 종이 위에 놓인다(브라우저 실측)
  ["종이 바탕(/name 감점 숫자·/hanja·/name '이견 있음' 배지·/company 오류 상자)", PAPER],
  ["gold-50('이견 있음' hover·NameCard 55+)", GOLD_50],
  ["amber-50(입력 화면 오류 상자)", AMBER_50],
  ["amber 8% 틴트(/company 키워드 안내·주의사항)", tint(AMBER, 0.08, WHITE)],
  ["amber 10% 틴트(SmartResult 성별 주의 칩)", tint(AMBER, 0.1, WHITE)],
  ["amber 14% 틴트(가장 짙은 amber 틴트)", tint(AMBER, 0.14, WHITE)],
];

test("짙은 amber-warm-700 글자는 모든 바탕에서 WCAG AA 작은 글자(4.5:1)를 넘는다", (t) => {
  for (const [label, bg] of BACKGROUNDS) {
    const r = contrast(AMBER_700, bg);
    t.diagnostic(`amber-warm-700 / ${label}: ${r.toFixed(2)}:1 (옛 amber-warm ${contrast(AMBER, bg).toFixed(2)}:1)`);
    assert.ok(r >= AA_SMALL, `${label} ${r.toFixed(2)}:1 < ${AA_SMALL}`);
  }
});

test("감점 숫자·'이견 있음' 배지가 짙은 토큰을 쓴다", () => {
  // /name 미학 점수 카드 감점·음수 성별 보너스 (signedPointsClass minus)
  assert.match(read("src", "lib", "signed-points.ts"), /polarity === "minus"\) return "text-amber-warm-700"/);
  // /hanja·/name V 배지(이견 있음·자료 적음·추정)
  assert.match(read("src", "components", "hanja", "HanjaBadges.tsx"), /GOLD_OUTLINE =\s*"[^"]*\btext-amber-warm-700\b/);
  // /method 등급 칩 V
  assert.match(
    read("src", "app", "method", "page.tsx"),
    /V: \{\s*background: "transparent",[^}]*color: "var\(--color-amber-warm-700\)"/
  );
  // /evaluate·/analysis V 배지는 원래 #7A5B22 / #F7EFDD — 같은 글자색인지
  const detail = read("src", "components", "design", "DetailHanja.tsx");
  const v = /V: \{\s*background: "(#[0-9A-Fa-f]{6})",\s*color: "(#[0-9A-Fa-f]{6})"/.exec(detail);
  assert.ok(v, "DetailHanja V 배지 색을 찾지 못했다");
  assert.equal(v[2].toLowerCase(), token("color-amber-warm-700-token").toLowerCase());
  assert.ok(contrast(hexRgb(v[2]), hexRgb(v[1])) >= AA_SMALL);
});

test("입력 화면 오류·경고 문장도 짙은 토큰을 쓴다 — text-destructive(=amber-warm)·gold-600 는 작은 글씨에서 AA 미달", () => {
  // 2026-10-26 보완: role=alert 오류 문장(text-xs)이 text-destructive(#b5874c — 흰 3.21·종이 3.08:1),
  // /evaluate 입력 FieldHint warn('한글로 입력해주세요'·'출생 시각은 생년월일과 함께…', 12.5px)이 gold-600(#b49258 — 흰 2.92:1)이었다.
  assert.equal(token("destructive").toLowerCase(), token("color-amber-warm-token").toLowerCase(), "--destructive 가 amber-warm 과 같은 값인지(바뀌면 이 테스트를 다시 볼 것)");
  assert.ok(contrast(hexRgb(token("color-gold-600-token")), WHITE) < AA_SMALL, "gold-600 이 AA 를 넘게 바뀌었다면 FieldHint 규칙을 다시 볼 것");
  assert.match(
    read("src", "components", "design", "EvaluateInput.tsx"),
    /kind === "warn" \? "var\(--color-amber-warm-700\)"/
  );
  for (const p of [["app", "search", "page.tsx"], ["app", "required-char", "page.tsx"]]) {
    const src = read("src", ...p);
    const alerts = src.match(/<p\b[^>]*role="alert"[^>]*>/g) ?? []; // 여러 줄 속성도([^>] 는 줄바꿈을 넘는다)
    assert.ok(alerts.length > 0, `${p.join("/")} 오류 문장을 찾지 못했다`);
    for (const a of alerts) assert.match(a, /\btext-amber-warm-700\b/, `${p.join("/")}: ${a}`);
  }
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
 * 옛 amber-warm 을 글자색으로 남겨 둔 곳 — 오행 火 배지(색이 오행 표지라 土·水 와 함께 팔레트로 정할 일 — 따로 남김)와
 * 글자가 아닌 아이콘만. 여기 없는 곳에 amber-warm 글자색이 새로 생기면 실패한다.
 */
const ALLOWED_AMBER_TEXT = [
  ["components/hanja/HanjaBadges.tsx", /火: "bg-amber-50 text-amber-warm /],
  ["components/results/HanjaCandidateCard.tsx", /"火": "bg-amber-50 text-amber-warm /],
  ["components/design/DetailPrimitives.tsx", /^\s*color: "#B5874C",$/], // FIVE_EL 火
  ["app/method/page.tsx", /style=\{\{ flexShrink: 0, color: "#B5874C", marginTop: 1 \}\}/], // DontRow XCircle 아이콘
];

test("작은 글씨에 옛 amber-warm(#b5874c) 글자색이 남지 않는다 — 오행 火 배지·아이콘만 예외", () => {
  const offenders = [];
  for (const file of sourceFiles()) {
    const rel = relative(join(ROOT, "src"), file).split(sep).join("/");
    read("src", ...rel.split("/"))
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (/^\s*(\/\/|\/?\*|\{\/\*)/.test(line)) return; // 주석 줄(옛 색을 설명하는 말)
        // text-destructive 도 같은 색이다(globals.css --destructive: #b5874c — red 회피). 입력 화면 오류 문장 3곳이 12px 로 쓰고 있었다(2026-10-26 보완)
        const amberText =
          /\btext-amber-warm(?![-\w/])/.test(line) ||
          /\btext-destructive(?![-\w/])/.test(line) ||
          /color:\s*"(var\(--color-amber-warm\)|var\(--color-destructive\)|#b5874c)"/i.test(line);
        if (!amberText) return;
        if (ALLOWED_AMBER_TEXT.some(([f, re]) => f === rel && re.test(line))) return;
        offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(offenders, [], "amber-warm 글자색은 text-amber-warm-700 / var(--color-amber-warm-700) 로");
});
