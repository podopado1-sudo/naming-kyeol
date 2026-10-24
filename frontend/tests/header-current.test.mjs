// 헤더 메뉴 활성 표시 테스트 — `npm test`
//
// 2026-10-23 운영 검증 BR-2: Header 의 current 기본값이 "home" 이라 current 를 넘기지 않은 화면
// (/analysis·/hanja·/hanja/*·/name·/name/*·/about·/contact·/privacy·/favorites·/twin·/dual-name)에서 '홈'이 켜져 있었다.
// 메뉴에 없는 화면은 "none"(기본값), 이름 찾기 형제 도구는 "search".
// src/app 의 <Header …/> 를 모두 읽어 화면마다 실제로 켜지는 메뉴를 표와 맞춘다 — 화면을 더하면 이 표도 같이 고칠 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { HEADER_DEFAULT_CURRENT, NAV_ITEMS } from "../src/components/design/header-nav.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = join(ROOT, "src", "app");
const HEADER_SRC = readFileSync(join(ROOT, "src", "components", "design", "Header.tsx"), "utf8");

/** 메뉴를 켜는 화면(라우트 = src/app 기준 폴더). 여기 없는 화면은 "none" */
const EXPECTED = {
  "": "home",
  search: "search",
  creative: "search",
  "parent-based": "search",
  "pure-korean": "search",
  "rare-surname": "search",
  "required-char": "search",
  "three-syllable": "search",
  twin: "search",
  "dual-name": "search",
  guide: "guide",
  "guide/[slug]": "guide",
  method: "method",
};

function walk(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** 파일 안 <Header …/> 마다 [라우트, 켜지는 메뉴] */
function headerUsages() {
  const rows = [];
  for (const file of walk(APP_DIR)) {
    const src = readFileSync(file, "utf8");
    const route = relative(APP_DIR, dirname(file)).split(sep).join("/");
    for (const m of src.matchAll(/<Header\b([^>]*)\/>/g)) {
      const cur = /current="([a-z]+)"/.exec(m[1]);
      rows.push({ file: relative(APP_DIR, file), route, current: cur ? cur[1] : HEADER_DEFAULT_CURRENT });
    }
  }
  return rows;
}

test("current 기본값은 'none' — 넘기지 않은 화면은 어떤 메뉴도 켜지 않는다", () => {
  assert.equal(HEADER_DEFAULT_CURRENT, "none");
  assert.ok(!NAV_ITEMS.some((item) => item.key === HEADER_DEFAULT_CURRENT));
});

// 위 기본값·메뉴를 Header 컴포넌트가 실제로 쓰는지 — header-nav.ts 만 보면 Header.tsx 를 옛 코드
// (자체 NAV_ITEMS, current = "home")로 되돌려도 통과하므로 소스를 직접 읽는다(signed-points·eval-layout 테스트와 같은 방식)
test("Header.tsx 가 header-nav.ts 의 기본값·메뉴를 쓴다 (current = \"home\" 로 되돌리면 실패)", () => {
  assert.match(HEADER_SRC, /\bcurrent\s*=\s*HEADER_DEFAULT_CURRENT\b/);
  assert.doesNotMatch(HEADER_SRC, /\bcurrent\s*=\s*["'`][a-z]*["'`]/); // 옛 코드: current = "home"
  assert.match(
    HEADER_SRC,
    /import\s*\{[^}]*\bHEADER_DEFAULT_CURRENT\b[^}]*\bNAV_ITEMS\b[^}]*\}\s*from\s*["']\.\/header-nav["']/,
  );
  // 메뉴·키 타입을 파일 안에서 다시 정의하지 않는다(정의는 header-nav.ts 하나)
  assert.doesNotMatch(HEADER_SRC, /\b(?:const|let|var)\s+NAV_ITEMS\b/);
  assert.doesNotMatch(HEADER_SRC, /\btype\s+(?:NavKey|CurrentKey)\s*=/);
  // 메뉴는 NAV_ITEMS 로만 그린다(데스크톱 nav + 모바일 드롭다운 = 2곳) — 메뉴 링크를 손으로 박지 않는다
  assert.equal([...HEADER_SRC.matchAll(/NAV_ITEMS\.map\(/g)].length, 2);
});

test("켜진 메뉴에는 aria-current=\"page\" — 데스크톱·모바일 둘 다, 'none' 이면 안 붙는다", () => {
  const ariaCurrent = [
    ...HEADER_SRC.matchAll(/aria-current=\{current === item\.key \? "page" : undefined\}/g),
  ];
  assert.equal(ariaCurrent.length, 2);
  assert.doesNotMatch(HEADER_SRC, /aria-current="page"/); // 고정값이면 모든 메뉴가 '현재 화면'으로 읽힌다
});

test("메뉴는 홈·이름 찾기·작명 가이드·작명 원리 4개", () => {
  assert.deepEqual(
    NAV_ITEMS.map((item) => [item.key, item.href]),
    [
      ["home", "/"],
      ["search", "/search"],
      ["guide", "/guide"],
      ["method", "/method"],
    ],
  );
});

test("화면마다 켜지는 메뉴가 표와 같다 (/hanja·/name·/analysis 는 'none', /twin·/dual-name 은 'search')", () => {
  const rows = headerUsages();
  assert.ok(rows.length >= 20, `Header 사용처가 너무 적다: ${rows.length}`);
  const wrong = rows.filter((r) => r.current !== (EXPECTED[r.route] ?? "none"));
  assert.deepEqual(
    wrong.map((r) => `${r.file}: ${r.current} (기대 ${EXPECTED[r.route] ?? "none"})`),
    [],
  );
  // 표의 화면은 실제로 있어야 한다(경로를 옮기면 표도 옮길 것)
  const routes = new Set(rows.map((r) => r.route));
  for (const route of Object.keys(EXPECTED)) assert.ok(routes.has(route), `Header 가 없는 화면: /${route}`);
  // 운영 검증에서 '홈'이 켜져 있던 화면
  for (const route of ["analysis", "hanja", "hanja/[slug]", "name", "name/[slug]", "about", "favorites"]) {
    assert.ok(routes.has(route), route);
  }
});

test("'홈'은 홈 화면에서만 켜진다", () => {
  const home = headerUsages().filter((r) => r.current === "home");
  assert.deepEqual(home.map((r) => r.route), [""]);
});
