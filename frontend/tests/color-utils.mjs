// 대비 테스트 공용 — globals.css·Tailwind 테마의 실제 색 값 읽기, WCAG 대비, CIEDE2000 색차.
// tests/amber-contrast.test.mjs · tests/palette-contrast.test.mjs 가 쓴다(`*.test.mjs` 가 아니라 node --test 가 따로 돌리지 않는다).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
export const CSS = read("src", "app", "globals.css");
const THEME = read("node_modules", "tailwindcss", "theme.css");

/** globals.css 의 `--name: #rrggbb;` 값 */
export function token(name) {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(CSS);
  assert.ok(m, `globals.css 에 --${name} 가 없다`);
  return m[1];
}

export function hexRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Tailwind 기본 팔레트(oklch) → sRGB 0~255 */
export function oklchRgb(L, C, H) {
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

/** Tailwind 기본 테마 색(theme.css 의 oklch) — 없으면 null */
export function tailwindDefault(name) {
  const m = new RegExp(`--color-${name}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(THEME);
  return m ? oklchRgb(Number(m[1]) / 100, Number(m[2]), Number(m[3])) : null;
}

export function tailwindColor(name) {
  const rgb = tailwindDefault(name);
  assert.ok(rgb, `tailwindcss theme.css 에 --color-${name} 가 없다`);
  return rgb;
}

/**
 * Tailwind 색 이름(`text-gold-800` 의 gold-800) → 화면에 칠해지는 sRGB. globals.css @theme 의
 * `--color-NAME: var(--color-NAME-token)` 이 먼저(브랜드 덮어쓰기 — teal-50 등), 없으면 Tailwind 기본 팔레트, 둘 다 없으면 null(정의 안 된 클래스)
 */
export function utilityColor(name) {
  const m = new RegExp(`--color-${name}:\\s*var\\(--(color-[\\w-]+-token)\\)\\s*;`).exec(CSS);
  if (m) return hexRgb(token(m[1]));
  return tailwindDefault(name);
}

/** 인라인 스타일 값(`var(--color-X)` 또는 `#rrggbb`) → sRGB */
export function cssValueColor(v) {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return hexRgb(v);
  const m = /^var\(--color-([\w-]+)\)$/.exec(v);
  assert.ok(m, `색 값을 읽지 못했다: ${v}`);
  const rgb = utilityColor(m[1]);
  assert.ok(rgb, `--color-${m[1]} 가 globals.css 에 없다`);
  return rgb;
}

const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export function luminance([r, g, b]) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x 대비 */
export function contrast(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** rgba(fg, alpha) 를 bg 위에 합성 — color-mix(… N%, transparent)·rgba 틴트 바탕 */
export const tint = (rgb, alpha, under) => rgb.map((c, i) => Math.round(alpha * c + (1 - alpha) * under[i]));

/** sRGB → CIE L*a*b* (D65) */
export function rgbLab([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 색차(Sharma·Wu·Dalal 2005 식) — Lab 두 개 */
export function deltaE00Lab([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b, a) => (b === 0 && a === 0 ? 0 : (Math.atan2(b, a) * deg + 360) % 360);
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hbp = (h1p + h2p) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

/** CIEDE2000 색차 — sRGB 두 개 */
export const deltaE00 = (rgb1, rgb2) => deltaE00Lab(rgbLab(rgb1), rgbLab(rgb2));
