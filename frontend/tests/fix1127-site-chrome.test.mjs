// 사이트 공통 틀(머리말·루트 메타·공유 그림·응답 헤더·robots) 2026-11-27 수정 — `npm test`
//
// 버그 목록(tmp/handoff-2026-11-26/research/bughunt-1127.json) G-site-chrome 묶음:
//   twitter-meta-generic     루트 twitter 에 title·description 을 고정해 /name/[이름] 밖 모든 쪽의 X 카드 제목이 사이트 이름이었다
//   og-image-size-mismatch   og-image.png 는 1672×941 인데 메타는 옛 크기를 적었다
//   mobile-menu-stays-open   모바일 메뉴가 버튼·메뉴 링크로만 닫혀, 연 채 스크롤하면 길어진 머리말이 본문을 가리고 따라왔다
//   security-headers-cleanup Permissions-Policy 의 폐지된 interest-cohort 가 모든 쪽 콘솔에 경고를 남겼다(CSP 는 그대로 — 재검토 전)
//   favorites-robots-only    /favorites 를 robots.txt 로만 막아 봇이 noindex 를 읽지 못했다
// (font-preload-2mb 는 사용자 결정 대기라 손대지 않았다)
//
// 메타 병합은 Next 의 실제 함수(accumulateMetadata)로 돌려 본다 — 루트에서 twitter.title 을 뺀 효과가 Next 의 자동 채움에 기대므로,
// Next 판이 바뀌어 그 동작이 달라지면 여기서 먼저 깨진다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import "./resolve-ts.mjs";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
// 주석을 지운 코드만 본다(머리말 주석이 고친 이유를 옛 값과 함께 적는다)
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const { OG_DEFAULT_IMAGES, BASE_OPEN_GRAPH, OG_SITE } = await import("../src/lib/og.ts");

// Next 의 메타 병합 함수 — 모듈 머리의 require("server-only") 만 빈 모듈로 받는다(서버 컴포넌트 표시용 패키지, 이 파일 밖에는 영향 없음)
const accumulateMetadata = (() => {
  const require = createRequire(import.meta.url);
  const Module = require("node:module");
  const load = Module._load;
  Module._load = function (request, ...rest) {
    if (request === "server-only") return {};
    return load.call(this, request, ...rest);
  };
  try {
    return require("next/dist/lib/metadata/resolve-metadata.js").accumulateMetadata;
  } finally {
    Module._load = load;
  }
})();

/** 세그먼트별 metadata 객체(루트 → 쪽)를 Next 처럼 합친 결과 */
async function resolveMeta(...segments) {
  return accumulateMetadata("/x", segments.map((m) => [m, null]), "/x", { trailingSlash: false, isStaticMetadataRouteFile: false });
}

/** src/app/layout.tsx 의 metadata 에서 `key: { … }` 객체 글자를 꺼내 값으로 만든다(안에 쓰일 수 있는 상수만 넣어 준다) */
function rootLiteral(key) {
  const src = code(read("src/app/layout.tsx"));
  const start = src.indexOf(`\n  ${key}: {`);
  assert.ok(start >= 0, `layout.tsx metadata 에 ${key} 가 없다`);
  const open = src.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (; end < src.length; end++) {
    if (src[end] === "{") depth++;
    else if (src[end] === "}" && --depth === 0) break;
  }
  return new Function("SITE_NAME", "SITE_DESCRIPTION", "SITE_URL", `return (${src.slice(open, end + 1)});`)(
    "이름의 결",
    "사이트 소개 문장",
    "https://namingkyeol.com",
  );
}

/** 루트 layout 과 같은 꼴의 루트 메타(twitter·robots 는 실제 소스에서) */
function rootMetadata() {
  return {
    metadataBase: new URL("https://namingkyeol.com"),
    title: { default: "이름의 결 — Naming.kyeol", template: "%s | 이름의 결" },
    description: "사이트 소개 문장",
    robots: rootLiteral("robots"),
    openGraph: { ...BASE_OPEN_GRAPH, url: "https://namingkyeol.com", title: "이름의 결 — 한국어 이름 추천 서비스", description: "사이트 소개 문장" },
    twitter: rootLiteral("twitter"),
  };
}

// ─────────────────────────────────────────────────────────────
// twitter-meta-generic
// ─────────────────────────────────────────────────────────────

test("루트 twitter 는 card·images 만 — title·description 을 고정하지 않는다", () => {
  const tw = rootLiteral("twitter");
  assert.deepEqual(Object.keys(tw).sort(), ["card", "images"]);
  assert.equal(tw.card, "summary_large_image");
  assert.deepEqual(tw.images, ["/og-image.png"]);
});

test("twitter:title·description 은 그 쪽의 openGraph 제목·설명을 따른다(Next 병합 실측)", async () => {
  // og.ts 도우미를 펼친 보통 쪽(/guide/[slug]·/hanja·/about 꼴)
  const page = {
    title: "남자 아기 이름 순위",
    description: "글 설명",
    openGraph: { ...BASE_OPEN_GRAPH, title: "남자 아기 이름 순위 TOP 50", description: "글의 공유 설명", url: "/guide/x" },
  };
  const m = await resolveMeta(rootMetadata(), page);
  assert.equal(m.twitter.title.absolute, "남자 아기 이름 순위 TOP 50");
  assert.equal(m.twitter.description, "글의 공유 설명");
  assert.equal(m.twitter.card, "summary_large_image");
  assert.deepEqual(m.twitter.images.map((im) => String(im.url)), ["https://namingkyeol.com/og-image.png"]);

  // 메타를 따로 두지 않은 쪽(홈)은 루트 openGraph 값 — og 와 같은 글
  const home = await resolveMeta(rootMetadata(), null);
  assert.equal(home.twitter.title.absolute, home.openGraph.title.absolute);
  assert.equal(home.twitter.description, home.openGraph.description);

  // 자기 twitter 를 정하는 /name/[이름] 꼴은 그 값 그대로(이미지는 세그먼트 twitter-image 가 넣는다)
  const name = await resolveMeta(rootMetadata(), {
    title: "서윤",
    description: "서윤 설명",
    openGraph: { ...OG_SITE, title: "서윤 이름 뜻", description: "서윤 설명", url: "/name/x" },
    twitter: { card: "summary_large_image", title: "서윤 이름 뜻", description: "서윤 설명" },
  });
  assert.equal(name.twitter.title.absolute, "서윤 이름 뜻");
  assert.equal(name.twitter.description, "서윤 설명");
});

test("옛 꼴(루트 twitter 에 title)이면 쪽 제목을 잃는다 — 위 테스트가 무엇을 막는지", async () => {
  const old = {
    ...rootMetadata(),
    twitter: { card: "summary_large_image", title: "이름의 결 — 한국어 이름 추천", description: "사이트 소개 문장", images: ["/og-image.png"] },
  };
  const m = await resolveMeta(old, { title: "가", openGraph: { ...BASE_OPEN_GRAPH, title: "글 제목", description: "글 설명" } });
  assert.equal(m.twitter.title.absolute, "이름의 결 — 한국어 이름 추천");
});

// ─────────────────────────────────────────────────────────────
// og-image-size-mismatch
// ─────────────────────────────────────────────────────────────

test("기본 공유 그림의 크기 선언 = public/og-image.png 의 실제 크기(PNG 머리)", () => {
  const png = readFileSync(new URL("../public/og-image.png", import.meta.url));
  assert.equal(png.toString("latin1", 12, 16), "IHDR");
  const size = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  assert.deepEqual(size, { width: 1672, height: 941 }, "그림을 바꿨다면 lib/og.ts 의 크기도 같이 고칠 것");
  assert.equal(OG_DEFAULT_IMAGES.length, 1);
  assert.equal(OG_DEFAULT_IMAGES[0].url, "/og-image.png");
  assert.equal(OG_DEFAULT_IMAGES[0].width, size.width);
  assert.equal(OG_DEFAULT_IMAGES[0].height, size.height);
  assert.equal(BASE_OPEN_GRAPH.images, OG_DEFAULT_IMAGES);
  // 옛 크기가 코드에 남지 않고, 루트 layout 의 공유 그림 주석도 실제 크기를 적는다(옛 주석 'og-image.png 1200×630')
  assert.doesNotMatch(code(read("src/lib/og.ts")), /\b1200\b|\b630\b/);
  assert.match(read("src/app/layout.tsx"), /public\/og-image\.png 1672×941/);
  assert.doesNotMatch(read("src/app/layout.tsx"), /og-image\.png 1200/);
});

// ─────────────────────────────────────────────────────────────
// favorites-robots-only
// ─────────────────────────────────────────────────────────────

test("/favorites 는 robots.txt 로 막지 않는다 — 다른 막는 길은 그대로", async () => {
  const { default: robots } = await import("../src/app/robots.ts");
  const { rules } = robots();
  const disallows = rules.flatMap((r) => [].concat(r.disallow ?? []));
  assert.ok(!disallows.some((d) => d.startsWith("/favorites")), `disallow 에 /favorites 가 남았다: ${disallows}`);
  const search = rules.find((r) => [].concat(r.userAgent).includes("Googlebot"));
  const other = rules.find((r) => r.userAgent === "*");
  for (const rule of [search, other]) {
    assert.deepEqual(rule.disallow, ["/api/", "/data/", "/required-char?", "/evaluate?", "/analysis?"]);
    assert.equal(rule.allow, "/");
  }
  const ai = rules.find((r) => [].concat(r.userAgent).includes("GPTBot"));
  assert.equal(ai.disallow, "/");
});

test("/favorites 쪽 메타는 noindex, follow — 일반 robots 로(구글 전용 아님), 루트의 index 를 물려받지 않는다", async () => {
  const src = code(read("src/app/favorites/layout.tsx"));
  const m = /\n  robots: (\{[^}]*\}),/.exec(src);
  assert.ok(m, "favorites/layout.tsx 에 robots 가 없다");
  const robots = new Function(`return (${m[1]});`)();
  assert.deepEqual(robots, { index: false, follow: true });
  assert.match(src, /alternates: \{ canonical: "\/favorites" \}/);

  const resolved = await resolveMeta(rootMetadata(), {
    title: "저장한 이름",
    robots,
    openGraph: { ...BASE_OPEN_GRAPH, title: "저장한 이름 — 이름의 결", url: "/favorites" },
  });
  assert.equal(resolved.robots.basic, "noindex, follow");
  assert.equal(resolved.robots.googleBot ?? null, null, "googleBot 의 index 가 남으면 구글이 색인할 수 있다");
  // 다른 쪽은 루트 그대로(index, follow + googleBot)
  const other = await resolveMeta(rootMetadata(), { title: "가" });
  assert.equal(other.robots.basic, "index, follow");
  assert.match(other.robots.googleBot, /^index, follow/);
});

// ─────────────────────────────────────────────────────────────
// security-headers-cleanup
// ─────────────────────────────────────────────────────────────

test("Permissions-Policy 에 폐지된 interest-cohort 가 없다 — Topics API 를 막는 browsing-topics 도 넣지 않는다", async () => {
  const { default: config } = await import("../next.config.ts");
  const [{ source, headers }] = await config.headers();
  assert.equal(source, "/(.*)");
  const value = (key) => headers.find((h) => h.key === key)?.value;
  assert.equal(value("Permissions-Policy"), "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  assert.doesNotMatch(read("next.config.ts").replace(/\/\/.*$/gm, ""), /interest-cohort|browsing-topics/);
  // CSP 는 이번에 바꾸지 않았다(애드센스 재검토 전 — 광고 스크립트·iframe 호스트가 그대로인지)
  const csp = value("Content-Security-Policy");
  assert.match(csp, /script-src 'self' 'unsafe-inline' https:\/\/pagead2\.googlesyndication\.com /);
  assert.match(
    csp,
    /frame-src https:\/\/googleads\.g\.doubleclick\.net https:\/\/tpc\.googlesyndication\.com https:\/\/www\.google\.com https:\/\/fundingchoicesmessages\.google\.com https:\/\/\*\.adtrafficquality\.google;/,
  );
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(value("Referrer-Policy"), "strict-origin");
});

// ─────────────────────────────────────────────────────────────
// mobile-menu-stays-open
// ─────────────────────────────────────────────────────────────

const HEADER = code(read("src/components/design/Header.tsx"));

test("모바일 메뉴 — 경로가 바뀌면 렌더 중에 닫는다(머리말이 이동 뒤에도 남는 경우 포함)", () => {
  assert.match(HEADER, /import \{ usePathname \} from "next\/navigation";/);
  assert.match(
    HEADER,
    /const pathname = usePathname\(\);\s*const \[menuPath, setMenuPath\] = useState\(pathname\);\s*if \(menuPath !== pathname\) \{\s*setMenuPath\(pathname\);\s*setMenuOpen\(false\);\s*\}/,
  );
});

test("모바일 메뉴 — 열려 있을 때만 Esc·바깥 누름·스크롤 감시를 걸고, 닫히면 모두 뗀다", () => {
  const effect = /useEffect\(\(\) => \{\s*if \(!menuOpen\) return;([\s\S]*?)\n  \}, \[menuOpen\]\);/.exec(HEADER);
  assert.ok(effect, "menuOpen 에 걸린 효과가 없다");
  const body = effect[1];
  for (const [target, type, fn] of [
    ["document", "keydown", "onKeyDown"],
    ["document", "pointerdown", "onPointerDown"],
    ["window", "scroll", "onScroll"],
  ]) {
    assert.match(body, new RegExp(`${target}\\.addEventListener\\("${type}", ${fn}[,)]`), `${type} 를 걸지 않는다`);
    assert.match(body, new RegExp(`${target}\\.removeEventListener\\("${type}", ${fn}\\)`), `${type} 를 떼지 않는다`);
  }
  assert.match(body, /const closeMenu = \(\) => setMenuOpen\(false\);/);
  // ① Esc — 메뉴 안에 있던 초점은 여닫기 버튼으로
  assert.match(body, /if \(e\.key !== "Escape"\) return;/);
  assert.match(body, /if \(focusInMenu\) burgerRef\.current\?\.focus\(\);/);
  // ② 머리말 바깥 누름만 — 머리말 안(버튼·메뉴 링크)은 제 동작에 맡긴다
  assert.match(body, /if \(e\.target instanceof Node && headerRef\.current\?\.contains\(e\.target\)\) return;\s*closeMenu\(\);/);
  // ③ 연 자리에서 일정 거리 넘게 스크롤 — 메뉴가 겹쳐 열려 배치가 바뀌지 않으니 연 순간의 위치가 기준(옛 300ms 기다림 없음)
  assert.match(body, /const baseY = window\.scrollY;/);
  assert.match(body, /function onScroll\(\) \{\s*if \(Math\.abs\(window\.scrollY - baseY\) > MENU_CLOSE_SCROLL_PX\) closeMenu\(\);\s*\}/);
  assert.doesNotMatch(HEADER, /MENU_SCROLL_SETTLE_MS|openedAt/);
  const px = Number(/const MENU_CLOSE_SCROLL_PX = (\d+);/.exec(HEADER)?.[1]);
  assert.ok(px >= 16 && px <= 120, `스크롤 거리 ${px}px`);
});

// 검토 반영(2026-11-27): 메뉴가 머리말 안 블록(display: block)이던 때는 바깥 누름(pointerdown)으로 닫는 순간 머리말이 메뉴 높이만큼 줄어
// 본문이 올라갔고, 휴대폰은 손을 뗀 뒤 그 자리를 다시 찾아 click 을 보내 그만큼 아래의 다른 카드·입력 칸이 눌렸다.
// 메뉴를 sticky 머리말 기준의 겹친 상자로 그리면 여닫아도 본문 배치가 그대로다.
test("모바일 메뉴 — 본문 위에 겹쳐 그려, 닫아도 본문이 움직이지 않는다(누른 자리가 다른 요소로 넘어가지 않게)", () => {
  // 기준 상자 = sticky 머리말(위치 지정 요소)
  assert.match(HEADER, /<header\s+ref=\{headerRef\}[\s\S]*?style=\{\{\s*position: "sticky",\s*top: 0,/);
  const menu = /<div\s+ref=\{menuRef\}([\s\S]*?)>\s*\{NAV_ITEMS\.map\(/.exec(HEADER)?.[1] ?? "";
  assert.ok(menu, "모바일 메뉴 div 를 찾지 못했다");
  const style = /style=\{\{([\s\S]*?)\}\}/.exec(menu)?.[1] ?? "";
  assert.match(style, /position: "absolute"/);
  assert.match(style, /top: "100%"/);
  assert.match(style, /left: 0/);
  assert.match(style, /right: 0/);
  assert.match(style, /zIndex: \d+/);
  // 열린 메뉴의 display 는 globals.css 가 정한다 — 인라인에서 display 를 덮지 않는다(640px 넘으면 숨김 유지)
  assert.doesNotMatch(style, /display:/);
  const css = read("src/app/globals.css");
  assert.match(css, /\.site-header-mobile \{\s*display: none;\s*\}/);
  assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*?\.site-header-mobile\.open \{\s*display: block;/);
  // 머리말 안에서 메뉴 높이를 다시 차지하는 쪽으로 되돌리지 않는다(인라인 position 이 absolute 가 아니면 위에서 실패)
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /\.site-header-mobile[^{]*\{[^}]*position:\s*(?:static|relative)/);
});

test("모바일 메뉴 — 여닫기 버튼이 aria-expanded·aria-controls 로 메뉴를 가리키고, 참조가 제자리에 걸린다", () => {
  assert.match(HEADER, /const menuId = useId\(\);/);
  assert.match(HEADER, /<header\s+ref=\{headerRef\}/);
  const button = /<button\b([\s\S]*?)\n\s*style=\{\{/.exec(HEADER)?.[1] ?? "";
  assert.match(button, /ref=\{burgerRef\}/);
  assert.match(button, /aria-expanded=\{menuOpen\}/);
  assert.match(button, /aria-controls=\{menuId\}/);
  assert.match(button, /onClick=\{\(\) => setMenuOpen\(\(v\) => !v\)\}/);
  assert.match(HEADER, /<div\s+ref=\{menuRef\}\s+id=\{menuId\}\s+className=\{`site-header-mobile\$\{menuOpen \? " open" : ""\}`\}/);
  // 같은 경로로 가는 머리말 링크(홈에서 로고·'홈', /favorites 에서 '저장한 이름')는 경로가 그대로라 누를 때 닫는다
  assert.match(HEADER, /href="\/"\s+onClick=\{\(\) => \{\s*onNav\?\.\("home"\);\s*setMenuOpen\(false\);\s*\}\}/);
  assert.match(HEADER, /href="\/favorites"\s+aria-label="저장한 이름"\s+onClick=\{\(\) => setMenuOpen\(false\)\}/);
  assert.match(HEADER, /onNav\?\.\(item\.key\);\s*setMenuOpen\(false\);/);
});

test("사이트 머리말은 인쇄에서 숨긴다(data-hide-print — 전역 header 규칙이 좁혀져도)", () => {
  assert.match(HEADER, /<header\s+ref=\{headerRef\}\s+data-hide-print\s/);
  assert.match(read("src/app/globals.css"), /\[data-hide-print\]/);
});
