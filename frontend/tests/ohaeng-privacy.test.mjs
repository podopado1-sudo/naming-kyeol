// 부족한 오행 찾기(/ohaeng) 입력값 보호·연결 테스트 — `npm test`
//
// 2026-11 설계 docs/plan-ohaeng-2026-11.md §6-1·§8·§12: 생년월일·출생 시각·출생지는 결과를 만드는 데만 쓰고 남기지 않는다.
// 프런트는 값을 컴포넌트 상태와 POST 본문에만 둔다 — 주소창(쿼리·history)·브라우저 저장소·문서 제목에 넣지 않고, 하이드레이션 전 제출이
// 기본 GET 으로 값을 쿼리에 싣지 않게 input·select 에 name 속성을 두지 않는다(/evaluate 는 결과 뒤 주소창에 생년월일을 남긴다 — 따라 하지 않는다).
// 원문을 읽어 확인한다(주석은 빼고 — 주석이 '왜 쓰지 않는지' 설명하며 그 낱말을 적을 수 있다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");
const stripComments = (s) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** /ohaeng 화면을 이루는 파일 — 클라이언트 번들에 드는 것은 client: true */
const FILES = [
  { path: ["src", "app", "ohaeng", "page.tsx"], client: false },
  { path: ["src", "app", "ohaeng", "OhaengGuide.tsx"], client: false },
  { path: ["src", "app", "ohaeng", "OhaengClient.tsx"], client: true },
  { path: ["src", "components", "design", "OhaengResult.tsx"], client: true },
  { path: ["src", "lib", "ohaeng.ts"], client: true },
  { path: ["src", "lib", "birthplaces.ts"], client: true },
];

const code = (f) => stripComments(read(...f.path));
const label = (f) => f.path.slice(1).join("/");

test("입력값을 주소창·브라우저 저장소·문서 제목에 두지 않는다", () => {
  const banned = [
    [/\blocalStorage\b/, "localStorage"],
    [/\bsessionStorage\b/, "sessionStorage"],
    [/\bindexedDB\b/, "indexedDB"],
    [/document\.cookie/, "document.cookie"],
    [/document\.title/, "document.title"],
    [/\buseSearchParams\b/, "useSearchParams"],
    [/\buseRouter\b/, "useRouter"],
    [/\breplaceState\b/, "history.replaceState"],
    [/\bpushState\b/, "history.pushState"],
    [/["']next\/form["']/, "next/form(입력값을 URL 쿼리로 보낸다)"],
  ];
  for (const f of FILES) {
    const src = code(f);
    for (const [re, what] of banned) assert.doesNotMatch(src, re, `${label(f)}: ${what}`);
  }
});

test("input·select 에 name 속성이 없다 — 하이드레이션 전 기본 제출이 값을 쿼리에 싣지 않게", () => {
  for (const f of FILES) assert.doesNotMatch(code(f), /(^|\s)name=/m, label(f));
  const client = code(FILES.find((f) => f.path.at(-1) === "OhaengClient.tsx"));
  // 폼 제출은 preventDefault 뒤 POST 본문으로만 — action·method 속성 없음
  assert.match(client, /<form\b/);
  assert.doesNotMatch(client, /<form\b[^]*?\b(action|method)=/);
  assert.match(client, /e\.preventDefault\(\)/);
  assert.match(client, /sajuElements\(req\)/);
});

test("결과·설명 글의 링크는 쿼리 없는 맨 경로", () => {
  for (const f of FILES) {
    const src = code(f);
    for (const [, href] of src.matchAll(/href="([^"]*)"/g)) assert.ok(!href.includes("?"), `${label(f)}: ${href}`);
    // 템플릿 문자열 href 는 쓰지 않는다(값을 붙이기 쉽다 — 한자 독음 링크는 lib/ohaeng.ts hanjaHref 하나)
    assert.doesNotMatch(src, /href=\{`/, label(f));
  }
  const lib = code(FILES.find((f) => f.path.at(-1) === "ohaeng.ts"));
  assert.match(lib, /return `\/hanja\/\$\{encodeURIComponent\(reading\)\}`;/);
});

test("API 는 POST 본문으로 보낸다 — /saju/elements", () => {
  const api = read("src", "lib", "api.ts");
  assert.match(api, /export function sajuElements\([\s\S]*?\{\s*return request\("\/saju\/elements", req\);\s*\}/);
  // request() 는 POST + JSON 본문
  assert.match(api, /function request<T>\(endpoint: string, body: unknown\)[\s\S]*?method: "POST"[\s\S]*?body: JSON\.stringify\(body\)/);
});

test("클라이언트 파일은 큰 정적 JSON(한자·이름 사전)을 import 하지 않는다 — 한자 정보는 API 응답만", () => {
  for (const f of FILES.filter((x) => x.client)) {
    const src = code(f);
    for (const re of [/lib\/hanja-seo/, /lib\/name-seo/, /HanjaCharCard/, /@\/data\//]) assert.doesNotMatch(src, re, `${label(f)}: ${re}`);
  }
});

test("서버/클라이언트 경계 — page·설명 글은 서버 컴포넌트(정적 HTML), 폼·결과만 클라이언트", () => {
  for (const f of FILES) {
    const raw = read(...f.path);
    const isClient = /^\s*(\/\*[\s\S]*?\*\/\s*)?["']use client["'];/.test(raw);
    if (f.path.at(-1).endsWith(".tsx")) assert.equal(isClient, f.client, label(f));
    else assert.equal(isClient, false, `${label(f)} — 순수 모듈은 지시어 없이(node --test·서버에서도 읽힌다)`);
  }
  const page = read("src", "app", "ohaeng", "page.tsx");
  assert.match(page, /export const metadata: Metadata = \{/);
  assert.match(page, /title: "부족한 오행 찾기 — 사주 원국 오행 세기"/);
  assert.match(page, /alternates: \{ canonical: "\/ohaeng" \}/);
  assert.match(page, /\.\.\.BASE_OPEN_GRAPH,/); // openGraph 얕은 병합(CLAUDE.md)
  assert.match(page, /<h1\b[\s\S]*?부족한 오행 찾기[\s\S]*?<\/h1>/);
  assert.match(page, /<OhaengGuide \/>/);
});

test("설명 글·결과에 쓰지 않는 문장 — 운세 단정·사람 검토", () => {
  const banned = [/운이 (좋아|트)/, /기운을 받/, /전문가/, /작명가가 (검토|검수|감수)/, /감수/, /검수했/, /사주를 고친/, /길(한|흉)/];
  for (const f of FILES) {
    const src = code(f);
    for (const re of banned) assert.doesNotMatch(src, re, `${label(f)}: ${re}`);
  }
});

// ─── 연결 · 방침 ──────────────────────────────────────────────

test("sitemap 에 /ohaeng(보조 도구 0.7) — 바뀐 화면만 자기 lastModified", () => {
  const src = read("src", "app", "sitemap.ts");
  assert.match(src, /\{ path: "ohaeng", priority: 0\.7, changeFrequency: "monthly", lastModified: "\d{4}-\d{2}-\d{2}" \}/);
  assert.match(src, /lastModified: r\.lastModified \? new Date\(r\.lastModified\) : lastModified,/);
});

test("/method '자원오행 보완' 카드에서 /ohaeng 으로", () => {
  const src = read("src", "app", "method", "page.tsx");
  assert.match(src, /title: "자원오행 보완",[\s\S]*?link: \{ href: "\/ohaeng", label: "[^"]+" \}/);
  assert.match(src, /\{card\.link && \([\s\S]*?<Link href=\{card\.link\.href\} style=\{inlineLink\}>/);
});

test("개인정보처리방침 — 출생지(시·도)와 오행 찾기 입력값을 남기지 않는다는 문장", () => {
  const src = read("src", "app", "privacy", "page.tsx");
  assert.match(src, /출생지\(시·도\)/);
  assert.match(src, /\/ohaeng\)에 넣은 출생일·출생 시각·출생지는 결과 계산에만 쓰고\s+데이터베이스와 서버 로그에 남기지 않습니다/);
  assert.match(src, /이름 추천·평가·분석과 오행 찾기 결과의 생성/);
  // 백엔드가 실제로 입력값을 로그에 넣지 않는다 — SajuController 로그 템플릿은 고정 문장뿐(SajuControllerLoggingTests 가 실행으로 확인)
  const ctrl = readFileSync(fileURLToPath(new URL("../../Api/Controllers/SajuController.cs", import.meta.url)), "utf8");
  for (const [, tpl] of ctrl.matchAll(/_logger\.Log\w+\((?:ex, )?"([^"]*)"/g)) assert.doesNotMatch(tpl, /\{/, `로그 템플릿에 값 자리: ${tpl}`);
});

test("개인정보처리방침 '서버 로그' 항목에 출생일이 없다 → 어느 컨트롤러 로그 템플릿에도 생년월일·출생 시각 자리가 없다", () => {
  // 방침 1항 '서버 로그'는 '성씨·이름·영어 이름·성별·톤 등과 추천 1위 이름'만 적는다. 옛 레거시 POST /api/v1/recommendations 는
  // '생년월일={BirthDate}'를 평문으로 남겨 방침과 어긋났다(2026-11-19 반박 검토 · D4 권고안 — 템플릿에서 뺌, 설계 §8·§16).
  // 방침에 출생일을 넣기로 바꾸면 이 테스트도 함께 고칠 것
  const policy = read("src", "app", "privacy", "page.tsx");
  const serverLogItem = /<strong>서버 로그<\/strong>:([\s\S]*?)<\/li>/.exec(policy);
  assert.ok(serverLogItem, "방침에 '서버 로그' 항목이 없다");
  assert.doesNotMatch(serverLogItem[1], /출생|생년월일/);

  const dir = fileURLToPath(new URL("../../Api/Controllers/", import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith(".cs"));
  assert.ok(files.length >= 5, `컨트롤러 파일 ${files.length}개만 찾음`);
  let templates = 0;
  for (const f of files) {
    const src = readFileSync(join(dir, f), "utf8");
    for (const [, tpl] of src.matchAll(/_logger\.Log\w+\(\s*(?:ex\s*,\s*)?\$?"([^"]*)"/g)) {
      templates++;
      assert.doesNotMatch(tpl, /\{[^}]*(Birth|birth)[^}]*\}|생년월일|출생/, `${f}: ${tpl}`);
    }
  }
  assert.ok(templates >= 20, `로그 템플릿 ${templates}개만 찾음 — 정규식이 비었는지 볼 것`);
});

// ─── 접근성 ──────────────────────────────────────────────────

test("결과는 aria-live 로 감싸지 않고(제목 포커스로 알림), 오류가 가리키는 칸에 aria-invalid·aria-describedby", () => {
  // 2026-11-19 반박 검토(설계 §16): 결과 전체를 aria-live 로 감싸면 원국·막대·한자 목록을 한꺼번에 읽어 내리고 포커스 이동 안내와 겹친다
  const client = code(FILES.find((f) => f.path.at(-1) === "OhaengClient.tsx"));
  const result = code(FILES.find((f) => f.path.at(-1) === "OhaengResult.tsx"));
  assert.doesNotMatch(client, /aria-live="polite">\s*\{shown/);
  assert.equal([...client.matchAll(/aria-live=/g)].length, 1, "aria-live 는 짧은 상태 줄(role=status) 하나만");
  assert.match(client, /role="status" aria-live="polite"/);
  assert.match(result, /headingRef\.current\?\.focus\(\)/);
  assert.match(result, /tabIndex=\{-1\}/);

  // 칸마다 aria-invalid·aria-describedby(오류 상자 id), 오류 상자에 그 id
  for (const field of ["date", "time", "place"]) {
    assert.match(client, new RegExp(`aria-invalid=\\{errorField === "${field}" \\|\\| undefined\\}`), field);
    assert.match(client, new RegExp(`aria-describedby=\\{describedBy\\("${field}"`), field);
  }
  assert.match(client, /id=\{errorId\}\s+role="alert"/);
});
