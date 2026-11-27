// 홈 Hero 묶음 수정(2026-11-27 버그 목록 G-home) — `npm test`
//
// Hero.tsx 는 JSX 라 node 가 바로 읽지 못한다 — 화면 동작은 소스 문자열로, 부모 이름 읽기는 lib/name-split 순수 함수로 고정한다.
// 기대값은 손으로 정한 사례표다(테스트 표본은 지어낸 이름).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const { readParentPair, splitParentPair } = await import("../src/lib/name-split.ts");

const heroPath = fileURLToPath(new URL("../src/components/design/Hero.tsx", import.meta.url));
const heroSource = readFileSync(heroPath, "utf8").replace(/\r\n/g, "\n");
// 주석을 걷어 낸 코드 — 옛 코드를 설명하는 주석이 검사에 걸리지 않게
const hero = heroSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

// ── hero-parent-name-split ──────────────────────────────────────────────

/** [입력, 아버지, 어머니, unclear] — unclear = Hero 가 '두 분이면 가운뎃점(·)으로 나눠 주세요'를 띄우는 입력 */
const PARENT_READING_CASES = [
  ["김민호 · 이수정", "김민호", "이수정", false],
  ["지호 서윤", "지호", "서윤", false],
  ["김지호 서윤", "김지호", "서윤", false],
  ["김 철 이서윤", "김 철", "이서윤", false],
  ["김민호", "김민호", "", false],
  ["김 민호", "김 민호", "", false],
  ["철", "철", "", false],
  // 한 분으로 읽지만 두 분으로도 읽힌다 — 선우는 흔한 이름이기도 하다
  ["선우 서윤", "선우 서윤", "", true],
  // 끝에 1자 낱말이 남는 오타 띄어쓰기 — 예전처럼 통째로 한 분
  ["김민 호", "김민 호", "", true],
  // 세 분 이상·붙여 쓴 두 분
  ["지호 서윤 하린", "지호 서윤 하린", "", true],
  ["김민호이수정", "김민호이수정", "", true],
  ["", "", "", false],
];

for (const [input, father, mother, unclear] of PARENT_READING_CASES) {
  test(`readParentPair(${JSON.stringify(input)}) → ${father} / ${mother}${unclear ? " (안내)" : ""}`, () => {
    assert.deepEqual(readParentPair(input), { father, mother, unclear });
    assert.deepEqual(splitParentPair(input), [father, mother], "/search 가 쓰는 splitParentPair 와 같은 결과");
  });
}

test("Hero 의 부모 이름 안내는 /search 와 같은 함수(readParentPair)로 읽는다", () => {
  assert.match(hero, /readParentPair\(parentName\)/);
  assert.match(hero, /가운뎃점\(·\)으로 나눠 주세요/);
  assert.match(hero, /withJosa\(parentReading\.mother, "으로\/로"\)/, "어머니 이름 뒤 조사는 lib/josa 로");
});

// ── hero-guide-text-focus ───────────────────────────────────────────────

test("빈 칸 알림이 칸을 다시 마운트하지 않는다(key 로 흔들면 focus 가 사라졌다)", () => {
  assert.doesNotMatch(hero, /shakeKey/);
  assert.doesNotMatch(hero, /key=\{`(lastName|birth|evalQuery)-/);
  // focus 한 뒤 같은 요소를 Web Animations 로 흔든다
  assert.match(hero, /function notifyField\(el: HTMLElement \| null\) \{[\s\S]*?el\.focus\(\);[\s\S]*?el\.animate\(SHAKE_KEYFRAMES/);
  assert.match(hero, /prefers-reduced-motion: reduce/);
});

test("흔들기 움직임이 globals.css nk-shake 와 같다", () => {
  const css = readFileSync(fileURLToPath(new URL("../src/app/globals.css", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
  const block = /@keyframes nk-shake \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(block, "globals.css 에서 nk-shake 를 찾지 못했다");
  const cssFrames = new Map();
  for (const m of block[1].matchAll(/([\d%,\s]+)\{\s*transform:\s*translateX\(([-\d.]+)(?:px)?\);\s*\}/g)) {
    for (const pct of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
      cssFrames.set(Number(pct.replace("%", "")) / 100, Number(m[2]));
    }
  }
  const heroFrames = new Map(
    [...hero.matchAll(/\{ transform: "translateX\(([-\d.]+)(?:px)?\)", offset: ([\d.]+) \}/g)].map((m) => [Number(m[2]), Number(m[1])])
  );
  assert.ok(cssFrames.size >= 6 && heroFrames.size >= 6, `프레임 수 css ${cssFrames.size} · Hero ${heroFrames.size}`);
  assert.deepEqual([...heroFrames.entries()].sort(), [...cssFrames.entries()].sort());
});

test("추천 안내 문구가 필수 조건(성씨·생년월일)을 말하고 생년월일 라벨에 '필수'가 있다", () => {
  assert.match(hero, /"성씨와 생년월일을 넣으면 결과를 바로 보여드려요\."/);
  assert.match(hero, /"생년월일을 넣으면 결과를 바로 보여드려요\."/);
  assert.doesNotMatch(hero, /성씨를 입력하면 결과를 바로 보여드려요/);
  // 추천 탭의 옛 '선택처럼 읽히는' 안내('생년월일을 입력하면 사주 조화도 함께 살펴봐요')는 평가 탭(생년월일 선택)에만 남는다
  assert.equal([...hero.matchAll(/생년월일을 입력하면 사주 조화도 함께 살펴봐요/g)].length, 1);
  assert.match(hero, /\(필수 · 사주 반영\)/);
  assert.match(hero, /\(필수 · 2자 이내\)/);
  // 평가 탭의 생년월일은 여전히 선택이다
  assert.match(hero, /\(선택 · 사주 반영\)/);
});

// ── hero-eval-links-drop-birth ──────────────────────────────────────────

test("평가 탭 '자주 찾는' 이름 링크가 넣어 둔 생년월일·시각을 싣는다", () => {
  assert.match(hero, /start\(\{ mode: "evaluate", name: n, gender, tone, birth, birthTime \}\)/);
  assert.doesNotMatch(hero, /start\(\{ mode: "evaluate", name: n, gender, tone \}\)/);
});

// ── hero-surname-unvalidated ────────────────────────────────────────────

test("성씨 칸은 lib/name-input 으로 한글·길이를 검사하고 다듬은 값을 보낸다", () => {
  assert.match(hero, /nameInputProblem\(surname, SURNAME_MAX_LENGTH\)/);
  assert.match(hero, /nameInputMessage\(surnameProblem, "성씨", SURNAME_MAX_LENGTH\)/);
  assert.match(hero, /lastName: surname,/);
  // 2자로 자르지 않는다 — '김서윤'이 '김서'로 넘어갔다
  assert.doesNotMatch(hero, /\.slice\(0, 2\)/);
  assert.match(hero, /role="alert"[\s\S]{0,200}?\{surnameError\}/);
});

test("lib/name-input 판정 — Hero 가 막는 값과 보내는 값", async () => {
  const { nameInputProblem, SURNAME_MAX_LENGTH } = await import("../src/lib/name-input.ts");
  for (const bad of ["金", "ㅅ", "Ki", "12", "김서윤", "남 궁"]) {
    assert.notEqual(nameInputProblem(bad, SURNAME_MAX_LENGTH), null, `${bad} 는 막는다`);
  }
  for (const ok of ["김", " 이 ", "남궁"]) {
    assert.equal(nameInputProblem(ok, SURNAME_MAX_LENGTH), null, `${ok} 는 보낸다`);
  }
});

// ── labels-hero ─────────────────────────────────────────────────────────

test("Hero 의 모든 라벨이 칸과 이어져 있다(htmlFor ↔ id)", () => {
  const labels = [...hero.matchAll(/<label\b([^>]*)>/g)].map((m) => m[1]);
  assert.ok(labels.length >= 13, `라벨 ${labels.length}개`);
  for (const attrs of labels) assert.match(attrs, /htmlFor=/, `htmlFor 없는 라벨: ${attrs}`);
  const forNames = [...hero.matchAll(/htmlFor=\{fieldId\("([\w-]+)"\)\}/g)].map((m) => m[1]);
  const idNames = new Set([...hero.matchAll(/\bid=\{fieldId\("([\w-]+)"\)\}/g)].map((m) => m[1]));
  for (const name of forNames) assert.ok(idNames.has(name), `id 없는 htmlFor: ${name}`);
  assert.equal(new Set(forNames).size, forNames.length, "라벨이 같은 칸을 두 번 가리키지 않는다");
});

// ── hero-mobile-text ────────────────────────────────────────────────────

test("머리말은 낱말 단위로만 줄이 바뀐다(글자마다 inline-block 이던 InkChars)", () => {
  const inkChars = /function InkChars\([\s\S]*?\n\}\n/.exec(hero)?.[0] ?? "";
  assert.ok(inkChars, "InkChars 를 찾지 못했다");
  assert.match(inkChars, /whiteSpace: "nowrap"/);
  assert.doesNotMatch(inkChars, /&nbsp;|ink-char--space/);
  // 잉크 애니메이션 지연은 원문 위치(공백 포함) 그대로
  assert.match(inkChars, /animationDelay: `\$\{baseDelay \+ \(word\.start \+ ci\) \* step\}ms`/);
});

test("h1 aria-label 이 보이는 글과 같다", () => {
  assert.match(hero, /aria-label=\{`\$\{HERO_LINE_1\} \$\{HERO_LINE_2\}`\}/);
  assert.doesNotMatch(hero, /그 가치를 증명합니다/);
});

test("머리말 둘째 줄이 360px(글 자리 296px)에서 한 줄에 든다 — 명조 한글 1em·자간 -0.02em 기준", () => {
  const line2 = /const HERO_LINE_2 = "([^"]+)";/.exec(hero)?.[1];
  const minPx = Number(/fontSize: "clamp\((\d+)px, 6vw, 52px\)"/.exec(hero)?.[1]);
  assert.ok(line2 && minPx, "HERO_LINE_2 또는 clamp 최소값을 찾지 못했다");
  const hangul = [...line2].filter((ch) => /[가-힣]/.test(ch)).length;
  const others = [...line2].length - hangul; // 공백·마침표 — 넉넉히 0.35em 씩
  const widthAt360 = Math.max(minPx, 360 * 0.06) * (hangul * 0.98 + others * 0.35);
  assert.ok(widthAt360 <= 360 - 64, `둘째 줄 ≈ ${widthAt360.toFixed(0)}px`);
});

test("성씨·성별·톤 줄은 640px 미만에서 성씨 한 줄 + 두 칸(인라인 3칸 격자가 아니다)", () => {
  assert.doesNotMatch(hero, /gridTemplateColumns: "1fr 1\.1fr 1\.1fr"/);
  const rows = [...hero.matchAll(/className="grid grid-cols-2 gap-2\.5 sm:grid-cols-\[1fr_1\.1fr_1\.1fr\]"/g)];
  assert.equal(rows.length, 2, "추천·평가 두 탭");
  assert.equal([...hero.matchAll(/className="col-span-2 sm:col-span-1"/g)].length, 2);
});

// ── hero-image-unoptimized ──────────────────────────────────────────────

/** WebP 캔버스 크기 — RIFF 머리(VP8X·VP8L·VP8) */
function webpSize(buf) {
  assert.equal(buf.toString("ascii", 0, 4), "RIFF");
  assert.equal(buf.toString("ascii", 8, 12), "WEBP");
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  throw new Error(`모르는 WebP 조각 ${chunk}`);
}

test("Hero 그림은 미리 줄인 WebP 를 srcset 으로 싣는다(next/image 없음 — 이미지 최적화 과금 회피)", () => {
  assert.doesNotMatch(heroSource, /from "next\/image"/);
  assert.doesNotMatch(heroSource, /no-img-element/, "<picture> 안의 <img> 라 예외 주석이 필요 없다");
  assert.match(hero, /<picture[\s\S]*?<source type="image\/webp" srcSet=\{HERO_IMAGE_SRCSET\} sizes=\{HERO_IMAGE_SIZES\} \/>[\s\S]*?<img[\s\S]*?<\/picture>/);
  assert.match(hero, /fetchPriority="high"/);

  const srcset = /const HERO_IMAGE_SRCSET =\s*"([^"]+)"/.exec(hero)?.[1];
  assert.ok(srcset, "HERO_IMAGE_SRCSET 을 찾지 못했다");
  const entries = srcset.split(",").map((s) => s.trim().split(/\s+/));
  assert.ok(entries.length >= 2);
  for (const [url, descriptor] of entries) {
    const file = `${publicDir}${url.replace(/^\//, "")}`;
    assert.ok(existsSync(file), `${url} 가 public 에 없다`);
    const buf = readFileSync(file);
    const { width, height } = webpSize(buf);
    assert.equal(`${width}w`, descriptor, `${url} 폭`);
    // 원본 1672×941 비율 그대로(반올림 1px 안)
    assert.ok(Math.abs(height - (width * 941) / 1672) <= 1, `${url} 비율 ${width}×${height}`);
    assert.ok(buf.length < 400_000, `${url} ${buf.length} 바이트`);
  }
  // WebP 를 못 읽는 브라우저용 원본 PNG 는 남긴다
  assert.match(hero, /src="\/hero-illustration\.png"/);
  assert.ok(existsSync(`${publicDir}hero-illustration.png`));
});

// ── 광고 경계(묶음 주의) ────────────────────────────────────────────────

test("/search 로 가는 needsFreshDocument 줄은 그대로다(tests/adsense-placement 정규식)", () => {
  assert.match(hero, /if \(needsFreshDocument\("\/search"\)\) window\.location\.assign\(href\);\s*else router\.push\(href\);/);
});
