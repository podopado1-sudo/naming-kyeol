// 11/27 프런트 묶음 16개를 합치면서 묶음 밖 파일에 더한 것 — `npm test`
// (각 묶음은 자기 파일만 고쳤고, 묶음 사이에 걸친 일은 합칠 때 했다. 묶음별 테스트는 tests/fix1127-<묶음>.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const AD = await import("../src/lib/ad-scope.ts");
const read = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("광고 경계 미리 받기 — 판정은 lib/ad-scope 하나, 머리말·꼬리말 링크도 쓴다", () => {
  const saved = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  try {
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "ca-pub-0000000000000000";
    assert.equal(AD.adBoundaryPrefetch("/", "/search"), false);
    assert.equal(AD.adBoundaryPrefetch("/evaluate", "/guide"), false);
    assert.equal(AD.adBoundaryPrefetch("/guide", "/method#resource-element"), undefined, "광고 화면끼리 — 해시는 떼고 본다");
    assert.equal(AD.adBoundaryPrefetch("/search", "/evaluate?lastName=김"), undefined, "광고 밖끼리");
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    assert.equal(AD.adBoundaryPrefetch("/", "/search"), undefined, "광고를 끈 빌드는 Next 기본");
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    else process.env.NEXT_PUBLIC_ADSENSE_CLIENT = saved;
  }
  const header = code(read("components/design/Header.tsx"));
  const headerLinks = [...header.matchAll(/<Link\b([\s\S]*?)>/g)].map((m) => m[1]);
  assert.ok(headerLinks.length >= 4);
  for (const attrs of headerLinks) assert.match(attrs, /prefetch=\{adBoundaryPrefetch\(pathname \?\? "", /, attrs.slice(0, 80));
  const footer = code(read("components/design/Footer.tsx"));
  assert.doesNotMatch(footer, /<Link\b/, "꼬리말은 AdBoundaryLink 만");
  assert.equal([...footer.matchAll(/<AdBoundaryLink\b/g)].length, 2);
  const link = code(read("components/AdBoundaryLink.tsx"));
  assert.match(link, /^"use client";/m);
  assert.match(link, /prefetch=\{adBoundaryPrefetch\(pathname, href\)\}/);
});

test("머리말 메뉴 — 키보드 초점이 머리말 밖으로 나가면 닫는다(겹친 메뉴 밑에 초점이 가리지 않게)", () => {
  const header = code(read("components/design/Header.tsx"));
  assert.match(header, /function onFocusIn\(e: FocusEvent\) \{\s*if \(e\.target instanceof Node && headerRef\.current\?\.contains\(e\.target\)\) return;\s*closeMenu\(\);\s*\}/);
  assert.match(header, /document\.addEventListener\("focusin", onFocusIn\);/);
  assert.match(header, /document\.removeEventListener\("focusin", onFocusIn\);/);
});

test("저장 실패를 알린다 — 결과 화면 TopPick 저장, /favorites 제거", () => {
  const smart = code(read("components/design/SmartResult.tsx"));
  assert.match(smart, /const ok = toggleFavorite\(\{[\s\S]*?\}\);\s*if \(!ok\) \{\s*toast\.error\(FAVORITE_SAVE_FAILED\);\s*return;\s*\}/);
  assert.match(smart, /const evicts = !topSaved && favoriteCount\(\) >= FAVORITES_LIMIT;/);
  const fav = code(read("app/favorites/page.tsx"));
  assert.match(fav, /if \(!removeFavorite\(f\.fullName, f\.birthDate, f\.hanja, f\.lastHanja\)\) toast\.error\(FAVORITE_SAVE_FAILED\);/);
});

test("인쇄 — 알림(sonner)도 숨긴다", () => {
  const css = read("app/globals.css");
  assert.match(css, /@media print \{[\s\S]*?\[data-sonner-toaster\],\s*\[data-hide-print\] \{\s*display: none !important;/);
});

test("SmartResultPage 에 같은 경로 editHref 를 넘기는 페이지가 없다(타입에서도 지웠다)", () => {
  for (const rel of ["app/search/page.tsx", "app/creative/page.tsx", "app/pure-korean/page.tsx", "app/three-syllable/page.tsx", "app/required-char/page.tsx"]) {
    assert.doesNotMatch(read(rel), /editHref/, rel);
  }
  assert.doesNotMatch(code(read("components/design/SmartResult.tsx")), /editHref/);
});
