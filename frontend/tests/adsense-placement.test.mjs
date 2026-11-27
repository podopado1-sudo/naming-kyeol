// 애드센스 로더를 싣는 곳 — `npm test`
//
// 2026-11-27: 로더가 루트 레이아웃 <head> 에 있어 도구 화면을 새로 열면 광고 요청에 화면 주소가 통째로 실려 Google 로 갔다
// (운영 확인 2026-11-26 — /evaluate?lastName=…&name=…&birthDate=… 의 성·이름·생년월일이 googleads.g.doubleclick.net 요청의 url 값에).
// 고친 것(lib/ad-scope.ts 머리말):
//   ① 로더·사이트 확인 메타는 편집·허브 화면에만(11/23 애드센스 진단 권고 1 — 사용자 결정) — 홈·/guide·/method·/about·/name·/hanja 인덱스.
//   ② 로더가 돈 문서에서 다른 화면으로 클라이언트 이동하면 새 문서로(AdsenseNavigationGuard·Hero) — 스크립트가 도구 화면에 따라가지 않게.
//   ③ Referrer-Policy strict-origin — 도구 화면 주소가 다음 화면의 document.referrer(광고 요청의 ref)로 넘어가지 않게.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const { isAdPage, needsFreshDocument, AD_EXACT_PATHS, AD_PREFIX_PATHS } = await import("../src/lib/ad-scope.ts");

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const ROOT = fileURLToPath(new URL("../", import.meta.url));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).map((p) => ({ rel: relative(SRC, p).split(sep).join("/"), src: readFileSync(p, "utf8") }));
const fileOf = (rel) => files.find((f) => f.rel === rel)?.src ?? assert.fail(`${rel} 없음`);

// 주석을 지운 코드만 본다(머리말 주석에 로더 주소·컴포넌트 이름이 나온다)
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// 로더를 그리는 파일 → 그 파일이 맡는 경로(layout 은 그 아래 전부)
const PLACEMENT = {
  "app/page.tsx": ["/"],
  "app/about/page.tsx": ["/about"],
  "app/method/layout.tsx": ["/method"],
  "app/guide/layout.tsx": ["/guide", "/guide/naming-trends"],
  "app/name/page.tsx": ["/name"],
  "app/hanja/page.tsx": ["/hanja"],
};

test("광고 로더 주소·사이트 확인 메타는 AdsenseLoader 컴포넌트 하나에만 있다 — 루트 레이아웃에는 없다", () => {
  // 로더 태그(주소 + ?client=)는 한 곳. lib/ad-scope.ts 의 ADSENSE_SCRIPT_MARK 는 이미 돈 로더를 찾는 문자열이라 셈에서 뺀다
  const loaderHits = files.filter((f) => /adsbygoogle\.js\?client=/.test(code(f.src))).map((f) => f.rel);
  assert.deepEqual(loaderHits, ["components/AdsenseLoader.tsx"]);
  const metaHits = files.filter((f) => /google-adsense-account/.test(code(f.src))).map((f) => f.rel);
  assert.deepEqual(metaHits, ["components/AdsenseLoader.tsx"]);
  const root = code(fileOf("app/layout.tsx"));
  assert.ok(!/<AdsenseLoader\b|<script[^>]*\bsrc=/.test(root), "루트 레이아웃에 외부 스크립트를 싣지 않는다");
});

test("AdsenseLoader 를 그리는 곳 = 편집·허브 화면(11/23 결정) — 이름·글자 상세, 도구 화면에는 없다", () => {
  const users = files.filter((f) => /<AdsenseLoader\b/.test(code(f.src))).map((f) => f.rel).sort();
  assert.deepEqual(users, Object.keys(PLACEMENT).sort());
  // 그리는 파일이 맡는 경로는 모두 lib/ad-scope.ts 가 광고 화면이라고 보는 경로다(가드가 그 화면에서 새로 읽지 않게)
  for (const [rel, paths] of Object.entries(PLACEMENT)) for (const p of paths) assert.ok(isAdPage(p), `${rel} → ${p}`);
  // 같은 틀 자동 쪽의 레이아웃은 없다(있으면 상세까지 싣게 된다)
  for (const rel of ["app/name/layout.tsx", "app/hanja/layout.tsx", "app/name/[slug]/layout.tsx", "app/hanja/[slug]/layout.tsx"]) {
    assert.ok(!files.some((f) => f.rel === rel), `${rel} 가 생기면 상세 쪽까지 로더가 실릴 수 있다`);
  }
  for (const rel of ["app/name/[slug]/page.tsx", "app/hanja/[slug]/page.tsx"]) assert.ok(!/AdsenseLoader/.test(fileOf(rel)), rel);
});

test("광고 화면 판정 — 정확한 경로와 /guide 아래만", () => {
  assert.deepEqual([...AD_EXACT_PATHS].sort(), ["/", "/about", "/guide", "/hanja", "/method", "/name"]);
  assert.deepEqual([...AD_PREFIX_PATHS], ["/guide/"]);
  for (const p of ["/", "/guide", "/guide/", "/guide/pure-korean-names", "/method", "/about", "/name", "/name/", "/hanja"]) {
    assert.equal(isAdPage(p), true, p);
  }
  for (const p of ["/name/서윤", "/name/%EC%84%9C%EC%9C%A4", "/hanja/가", "/hanja/瑞", "/evaluate", "/search", "/analysis", "/twin",
    "/three-syllable", "/pure-korean", "/ohaeng", "/company", "/favorites", "/privacy", "/contact", "/guidebook", "/abc", "", null, undefined]) {
    assert.equal(isAdPage(p), false, String(p));
  }
});

test("새 문서가 필요한가 — 광고 화면 ↔ 광고 밖 화면 경계를 넘을 때(양쪽 모두)", () => {
  const saved = { window: globalThis.window, document: globalThis.document, id: process.env.NEXT_PUBLIC_ADSENSE_CLIENT };
  try {
    // 광고를 켠 빌드에서, 광고 밖 화면이 처음 연 문서(로더 없음) → 광고 화면으로: 새 문서(그 문서에 로더를 들이지 않게 — 뒤로 가기로
    // 도구 주소가 로더가 돈 문서에 돌아오면 Next 가 도구 화면을 다시 그려 평가 요청이 두 번 나갔다)
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "ca-pub-0000000000000000";
    globalThis.document = { querySelector: () => null };
    globalThis.window = {};
    assert.equal(needsFreshDocument("/guide", "/evaluate"), true);
    assert.equal(needsFreshDocument("/", "/search"), true);
    assert.equal(needsFreshDocument("/name/서윤", "/evaluate"), false, "광고 밖끼리는 클라이언트 이동 그대로");
    assert.equal(needsFreshDocument("/guide/pure-korean-names", "/guide"), false, "광고 화면끼리도 그대로");
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    assert.equal(needsFreshDocument("/guide", "/evaluate"), false, "광고를 켜지 않은 빌드(로컬)에서는 아무 일도 없다");
    globalThis.document = { querySelector: () => null };
    globalThis.window = {}; // 로더 없음(로컬·미설정·처음부터 도구 화면으로 연 문서)
    assert.equal(needsFreshDocument("/evaluate"), false);
    // 광고 차단 확장이 window.adsbygoogle 을 만들어 둔 문서 — 태그가 없으면 돈 문서로 보지 않는다(끝없는 새로 읽기 방지)
    globalThis.window = { adsbygoogle: { loaded: true, push() {} } };
    assert.equal(needsFreshDocument("/evaluate"), false);
    // 우리 로더 태그가 들어온 문서
    globalThis.window = {};
    globalThis.document = { querySelector: (sel) => (sel.includes("adsbygoogle.js") ? {} : null) };
    assert.equal(needsFreshDocument("/evaluate"), true);
    assert.equal(needsFreshDocument("/search"), true);
    assert.equal(needsFreshDocument("/name/서윤"), true);
    assert.equal(needsFreshDocument("/guide/pure-korean-names", "/guide"), false);
    assert.equal(needsFreshDocument("/", "/guide"), false);
  } finally {
    globalThis.window = saved.window;
    globalThis.document = saved.document;
    if (saved.id === undefined) delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    else process.env.NEXT_PUBLIC_ADSENSE_CLIENT = saved.id;
  }
});

test("가드가 루트 레이아웃에 있고, 홈 Hero 의 router.push 도 로더가 돈 문서면 새 문서로 연다", () => {
  const root = code(fileOf("app/layout.tsx"));
  assert.ok(/<AdsenseNavigationGuard\s*\/>/.test(root));
  const guard = code(fileOf("components/AdsenseNavigationGuard.tsx"));
  assert.ok(/addEventListener\("click", onClick, true\)/.test(guard), "캡처 단계 — next/link 보다 먼저");
  assert.ok(/needsFreshDocument\(url\.pathname\)/.test(guard));
  assert.ok(/if \(!pathname \|\| isAdPage\(pathname\) \|\| !adScriptLoaded\(\)\) return;[\s\S]*?window\.location\.reload\(\);/.test(guard), "클릭이 아닌 이동의 받침");
  // 뒤로·앞으로: Next 보다 먼저 받아 막고 새로 읽는다
  assert.ok(/function onPopState\(e: PopStateEvent\) \{\s*if \(!adScriptLoaded\(\) \|\| isAdPage\(window\.location\.pathname\)\) return;\s*e\.stopImmediatePropagation\(\);\s*window\.location\.reload\(\);/.test(guard));
  assert.ok(/window\.addEventListener\("popstate", onPopState\)/.test(guard));
  assert.ok(/sessionStorage\.getItem\(RELOAD_MARK\) === href\) return;/.test(guard), "같은 주소를 연달아 새로 읽지 않는다");
  assert.doesNotMatch(code(fileOf("lib/ad-scope.ts")), /window[^\n]*\.adsbygoogle/, "window.adsbygoogle 로 판정하지 않는다");
  const hero = code(fileOf("components/design/Hero.tsx"));
  assert.ok(/if \(needsFreshDocument\("\/search"\)\) window\.location\.assign\(href\);\s*else router\.push\(href\);/.test(hero));
});

test("Referrer-Policy 는 strict-origin — 같은 사이트 이동에도 주소 쿼리를 넘기지 않는다", () => {
  const cfg = readFileSync(join(ROOT, "next.config.ts"), "utf8");
  assert.match(cfg, /\{ key: "Referrer-Policy", value: "strict-origin" \}/);
  assert.doesNotMatch(cfg, /strict-origin-when-cross-origin" \}/);
});
