// 오류 화면(app/error.tsx → ServerErrorScreen)·404(app/not-found.tsx → NotFoundScreen) 고정 — `npm test`
//
// 2026-11-27 버그 목록 error-screen-fake-info · notfound-page-issues:
// - 오류 화면의 문의 메일 hello@naming.kyeol 은 없는 주소였다(.kyeol 최상위 도메인 없음) → 실제 메일 주소가 있는 /contact 링크
// - 본문에 error.message(영문 예외 원문)를 그대로 보였고, REF·'요청 ID req_…'는 그 문구 앞 8글자·기본값 '8a3f2c'였다
//   → 고정 한국어 문장, digest 가 있을 때만 작게
// - '기술 정보 복사하기'는 '✓ 복사됨'만 띄우고 아무것도 복사하지 않았다 → navigator.clipboard 로 실제 복사, 실패를 알린다
// - '발생 시각'은 그릴 때마다 찍는 UTC 문자열 → 마운트 때 한 번, 한국 시간
// - 404: 휴대폰 폭에서 마스코트가 '404' 글자를 덮었다, 제목·canonical·og 가 홈 값이었다
//
// .tsx 는 node 타입 지우기로 읽을 수 없어(JSX) 소스 문자열로 본다. 순수 함수 둘(formatKst·readablePath)은 소스에서 꺼내 실제로 돌린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf-8");
// 주석은 빼고 본다(고친 이유를 적은 주석에 옛 값이 남아 있다)
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const SYSTEM = read("components/design/SystemStates.tsx");
const SYSTEM_CODE = stripComments(SYSTEM);
const ERROR_PAGE = stripComments(read("app/error.tsx"));
const NOT_FOUND = read("app/not-found.tsx");
const NOT_FOUND_CODE = stripComments(NOT_FOUND);

/** export function NAME 부터 다음 최상위 export function(또는 파일 끝)까지 */
function exportedFunction(src, name) {
  const start = src.indexOf(`export function ${name}(`);
  assert.ok(start >= 0, `${name} 를 찾지 못했다`);
  const next = src.indexOf("\nexport function ", start + 1);
  return src.slice(start, next < 0 ? src.length : next);
}

/** 타입 표기가 매개변수 하나뿐인 작은 함수를 소스에서 꺼내 JS 로 만든다 — `function f(x: T): R { … }` */
function extractPureFunction(src, name) {
  const m = new RegExp(`function ${name}\\((\\w+): \\w+\\): string \\{([\\s\\S]*?)\\r?\\n\\}`).exec(src);
  assert.ok(m, `${name} 를 꺼내지 못했다`);
  const consts = [...src.matchAll(/^const (KST_OFFSET_MS) = ([^;]+);/gm)].map((c) => `const ${c[1]} = ${c[2]};`).join("\n");
  return new Function(`${consts}\nreturn function ${name}(${m[1]}) {${m[2]}\n};`)();
}

const SERVER_ERROR = exportedFunction(SYSTEM_CODE, "ServerErrorScreen");
const NOT_FOUND_SCREEN = exportedFunction(SYSTEM_CODE, "NotFoundScreen");

// ─── 오류 화면: 연락처 ───────────────────────────────────────

test("오류 화면은 없는 메일 주소 대신 /contact 로 보낸다 — 그 화면에 실제 메일 주소가 있다", () => {
  assert.doesNotMatch(SYSTEM_CODE, /hello@naming\.kyeol/);
  assert.doesNotMatch(SERVER_ERROR, /mailto:/, "주소를 여기 따로 적으면 또 어긋난다 — /contact 하나로");
  assert.match(SERVER_ERROR, /<Link href="\/contact"[^>]*>\s*문의 페이지\s*<\/Link>/);
  // 링크가 가리키는 화면이 실제 연락 방법을 갖고 있는지(개인정보처리방침·CLAUDE.md 의 문의 주소와 같은 값)
  assert.match(read("app/contact/page.tsx"), /href="mailto:contact@namingkyeol\.com"/);
});

// ─── 오류 화면: 영문 예외 문구·지어낸 값 ────────────────────

test("error.tsx 는 error.message 를 화면에 넘기지 않고 digest 만 넘긴다", () => {
  assert.doesNotMatch(ERROR_PAGE, /error\.message/, "영문 예외 원문(Cannot read properties of …)이 본문·REF 로 나간다");
  assert.match(ERROR_PAGE, /<ServerErrorScreen digest=\{error\.digest\} onRetry=\{reset\} \/>/);
  assert.match(ERROR_PAGE, /console\.error\(error\)/, "원문은 콘솔에만 남긴다");
});

test("ServerErrorScreen 본문은 고정 한국어 문장 — 예외 문구를 받는 props 가 없다", () => {
  assert.doesNotMatch(SERVER_ERROR, /errorMessage/);
  assert.match(SERVER_ERROR, />\s*일시적인 오류가 발생했어요\. 다시 시도하거나, 잠시 후 다시 방문해주세요\.\s*</);
});

test("지어낸 REF·요청 ID·'마지막 액션'·'Error · 500' 이 없다 — digest 는 있을 때만 그린다", () => {
  assert.doesNotMatch(SERVER_ERROR, /8a3f2c/, "기본 REF 값");
  assert.doesNotMatch(SERVER_ERROR, /req_/, "지어낸 요청 ID");
  assert.doesNotMatch(SERVER_ERROR, /마지막 액션/);
  assert.doesNotMatch(SERVER_ERROR, /Error · 500/, "클라이언트 오류에도 붙던 500");
  assert.doesNotMatch(SERVER_ERROR, /digest\s*=\s*"/, "digest 에 기본값을 두지 않는다");
  assert.match(SERVER_ERROR, /\{refCode && \(/, "REF 는 digest 가 있을 때만");
  assert.match(SERVER_ERROR, /\.\.\.\(refCode \? \[\{ k: "오류 번호", v: refCode \}\] : \[\]\)/, "'오류 번호' 줄도 digest 가 있을 때만");
});

// ─── 오류 화면: 복사 ─────────────────────────────────────────

test("'기술 정보 복사하기'는 클립보드에 실제로 쓰고, 성공했을 때만 '✓ 복사됨'", () => {
  assert.match(SERVER_ERROR, /clipboard\.writeText\(text\)\.then\(\s*\(\) => setCopyState\("copied"\),\s*\(\) => \{\s*setCopyState\("failed"\);/);
  assert.match(SERVER_ERROR, /if \(!clipboard\?\.writeText\) \{\s*[\s\S]*?setCopyState\("failed"\);/, "클립보드 API 가 없으면(http·오래된 브라우저) 실패로");
  // '복사됨'으로 바꾸는 곳은 writeText 성공 콜백 하나뿐
  assert.equal([...SERVER_ERROR.matchAll(/setCopyState\("copied"\)/g)].length, 1);
  assert.match(SERVER_ERROR, /copyState === "copied" \? "✓ 복사됨" : "기술 정보 복사하기"/);
  assert.doesNotMatch(SERVER_ERROR, /setCopied\(true\)/, "옛 흉내 동작");
});

test("복사에 실패하면 화면에 알리고(role=status) 기술 정보 글을 선택해 둔다", () => {
  assert.match(SERVER_ERROR, /role="status"/);
  assert.match(SERVER_ERROR, /"복사하지 못했어요\. 위 내용을 직접 선택해 복사해 주세요\."/);
  assert.match(SERVER_ERROR, /sel\.selectAllChildren\(infoRef\.current\)/);
  assert.match(SERVER_ERROR, /<div ref=\{infoRef\}>/);
  // 경고 문장은 작은 글씨 전용 짙은 토큰(amber-warm-700 — gold-50 위 5.48:1)
  assert.match(SERVER_ERROR, /color: "var\(--color-amber-warm-700\)"/);
});

test("복사하는 글 = 화면에 보이는 줄(오류 번호·발생 시각·주소) — 주소는 경로만(쿼리의 이름·생년월일을 싣지 않는다)", () => {
  assert.match(SERVER_ERROR, /const text = \["이름의 결 오류 기술 정보", \.\.\.rows\.map\(\(r\) => `\$\{r\.k\}: \$\{r\.v\}`\)\]\.join\("\\n"\);/);
  assert.match(SERVER_ERROR, /\{rows\.map\(\(r\) => \(\s*<Row key=\{r\.k\} k=\{r\.k\} v=\{r\.v\} \/>/);
  assert.match(SERVER_ERROR, /const pathname = usePathname\(\);/);
  assert.doesNotMatch(SERVER_ERROR, /location\.(search|href)|useSearchParams/);
});

// ─── 오류 화면: 발생 시각 ────────────────────────────────────

test("발생 시각은 마운트 때 한 번 잡고, 기술 정보를 펼친 뒤에만 그린다(하이드레이션 불일치 없음)", () => {
  assert.match(SERVER_ERROR, /const \[occurredAt\] = useState\(\(\) => Date\.now\(\)\);/);
  assert.doesNotMatch(SERVER_ERROR, /toISOString\(\)/, "그릴 때마다 새로 찍는 UTC 문자열");
  assert.match(SERVER_ERROR, /\{ k: "발생 시각", v: formatKst\(occurredAt\) \}/);
  // 줄은 open(사용자가 누른 뒤 — 클라이언트 상태)일 때만 그린다 — 서버 HTML·첫 렌더에는 시각 글자가 없다
  assert.match(SERVER_ERROR, /const \[open, setOpen\] = useState\(false\);/);
  const openBlock = SERVER_ERROR.indexOf("{open && (");
  assert.ok(openBlock > 0 && SERVER_ERROR.indexOf("rows.map((r) => (") > openBlock, "기술 정보 줄이 펼침 블록 밖에 있다");
});

test("formatKst — 기기 시간대와 무관하게 한국 시간 'YYYY-MM-DD HH:mm:ss (한국 시간)'", () => {
  const formatKst = extractPureFunction(SYSTEM, "formatKst");
  assert.equal(formatKst(Date.UTC(2025, 2, 2, 5, 6, 7)), "2025-03-02 14:06:07 (한국 시간)");
  // UTC 로는 전날 — 한국 시간으로 날짜가 넘어간다
  assert.equal(formatKst(Date.UTC(2025, 2, 1, 15, 30, 0)), "2025-03-02 00:30:00 (한국 시간)");
});

test("readablePath — 퍼센트 인코딩 경로를 한글로, 풀 수 없는 꼴은 그대로", () => {
  const readablePath = extractPureFunction(SYSTEM, "readablePath");
  assert.equal(readablePath("/name/%EC%84%9C%EC%9C%A4"), "/name/서윤");
  assert.equal(readablePath("/name/서윤"), "/name/서윤");
  assert.equal(readablePath("/zz-%E0%A4%A"), "/zz-%E0%A4%A");
});

// ─── 404 ─────────────────────────────────────────────────────

test("404 마스코트는 768px 미만에서 그리지 않는다 — 화면 기준 absolute 라 휴대폰 폭에서 '404' 글자를 덮었다", () => {
  assert.match(
    NOT_FOUND_SCREEN,
    /<div\s+className="hidden md:block"\s+style=\{\{ position: "absolute", top: "12%", left: "8%" \}\}\s*>\s*<Mascot/,
  );
  assert.match(NOT_FOUND_SCREEN, /<Eyebrow>404 · Not Found<\/Eyebrow>/);
});

test("404 쪽은 자기 제목을 갖고, 홈의 canonical·og:url·og:title 을 물려받지 않는다", () => {
  assert.match(NOT_FOUND, /const TITLE = "페이지를 찾을 수 없어요";/);
  assert.match(NOT_FOUND_CODE, /export const metadata: Metadata = \{\s*title: TITLE,/);
  assert.match(NOT_FOUND_CODE, /alternates: \{ canonical: null \}/, "루트의 canonical '/'(홈)을 지운다");
  const og = /openGraph: \{([\s\S]*?)\n  \},/.exec(NOT_FOUND_CODE);
  assert.ok(og, "openGraph 를 찾지 못했다");
  assert.match(og[1], /\.\.\.BASE_OPEN_GRAPH,/, "얕은 병합 — 이미지·siteName·locale 을 남긴다");
  assert.match(og[1], /title: `\$\{TITLE\} — \$\{OG_SITE_NAME\}`/);
  assert.doesNotMatch(og[1], /\burl:/, "og:url 을 두지 않는다(홈 주소를 가리키지 않게)");
  assert.match(NOT_FOUND_CODE, /twitter: \{[\s\S]*?title: `\$\{TITLE\} — \$\{OG_SITE_NAME\}`/);
  // robots 는 건드리지 않는다 — 404 응답에는 Next 가 noindex 를 넣는다(사이트 robots 정책은 따로)
  assert.doesNotMatch(NOT_FOUND_CODE, /robots/);
  assert.match(NOT_FOUND_CODE, /return <NotFoundScreen \/>;/);
});
