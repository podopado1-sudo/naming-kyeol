// 추천 결과 화면(SmartResult — /search·/creative·/required-char·/pure-korean·/three-syllable) 11/27 버그 묶음 G-smart 고정 — `npm test`
//
// - smart-result-dead-links: '← 조건 수정'(자기 경로 Link — 결과가 페이지 useState 라 눌러도 그대로)과 '↻ 새로 생성'(폼으로만 돌아감)을
//   '← 조건 바꾸기' 단추 하나(onRegenerate = 페이지의 handleReset)로 합쳤다. 꼬리의 href="#" 두 링크는 /about·/contact.
// - smart-card-no-action: 후보 카드마다 '상세 보기'(onCandidateDetail(이름, 평가 링크 한자)), 동작 없는 카드의 손가락 커서·떠오름 제거,
//   key 는 카테고리 + 이름(순번 key 라 펼친 '이름의 결'이 다른 탭의 같은 순번 카드로 옮았다).
// - creative-tab-card-overflow: 목록 격자 열 minmax(0, 1fr) · 칩 줄바꿈(창의 탭의 긴 문장 칩이 카드를 457px 로 넓혔다).
// - smart-result-mobile-chrome: 탭을 바꾸면 창을 탭 줄 위(고정 머리 + 8px)로, 고른 탭을 탭 줄 가운데로, 가려진 쪽에 흐림 마스크,
//   Top Pick·카테고리 띠·'이 추천은 시작점이에요' 상자에 좌우 24px.
// - rare-banner-josa: '남궁는 희귀 성씨에요' → josa 로 '남궁은 희귀 성씨예요'.
// - print-search-result: 결과 화면 안 단추·탭·토글·링크 줄은 data-hide-print, 카드·Top Pick 은 break-inside: avoid.
// - required-char-meaning-nonhanja: 한자 없는 필수 글자(봄)의 뜻 줄 '봄(한글) + 짝 글자 훈 하나'.
//
// SmartResult.tsx 는 JSX 라 node 가 바로 읽지 못한다 — 순수 함수는 소스에서 잘라 임시 .ts 로 써서 import 하고(타입 지우기),
// 나머지는 소스 문자열로 본다(다른 테스트와 같은 방식).
import "./resolve-ts.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (rel) => readFileSync(path.join(SRC, rel), "utf8");
const SR = read("components/design/SmartResult.tsx").replace(/\r\n/g, "\n");
// 주석을 뺀 코드 — 고친 이유를 적은 주석에 옛 문구('남궁는 희귀 성씨에요'·href="#")가 남아 있다
const CODE = SR.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/**
 * `function NAME(` 부터 본문 끝 `}` 까지 — 매개변수 괄호를 짝 맞춰 넘기고, 본문은 줄 끝의 `{`부터
 * (반환 타입의 `{ ch: string; … }` 를 본문으로 잡지 않게) 중괄호를 짝 맞춘다(템플릿 `${}` 도 짝이 맞다)
 */
function extractFunction(src, name) {
  const start = src.search(new RegExp(`(?:export )?function ${name}\\(`));
  assert.ok(start >= 0, `SmartResult.tsx 에서 function ${name} 을 찾지 못했다`);
  let i = src.indexOf("(", start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) break;
  }
  i = src.indexOf("{\n", i);
  depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(start, j + 1);
  }
  throw new Error(`function ${name} 의 끝을 찾지 못했다`);
}

const exported = (fn) => (fn.startsWith("export ") ? fn : `export ${fn}`);
const constLine = (name) => {
  const m = new RegExp(`^const ${name} = [^\\n]+;$`, "m").exec(SR);
  assert.ok(m, `const ${name} 을 찾지 못했다`);
  return m[0];
};

// 순수 함수만 모은 임시 모듈
const dir = mkdtempSync(path.join(tmpdir(), "fix1127-smart-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const modulePath = path.join(dir, "smart-result-pure.ts");
writeFileSync(
  modulePath,
  [
    constLine("TAB_SCROLL_GAP"),
    extractFunction(SR, "parseHanjaOption"),
    extractFunction(SR, "glossForSyllable"),
    exported(extractFunction(SR, "requiredCharMeaning")),
    exported(extractFunction(SR, "candidateKeys")),
    exported(extractFunction(SR, "tabEdgeMask")),
    exported(extractFunction(SR, "centerScrollDelta")),
    exported(extractFunction(SR, "tabScrollTop")),
  ].join("\n\n")
);
const { requiredCharMeaning, candidateKeys, tabEdgeMask, centerScrollDelta, tabScrollTop } = await import(
  pathToFileURL(modulePath).href
);

const body = (name) => extractFunction(SR, name);

// ---------------------------------------------------------------- required-char-meaning-nonhanja
test("한자 없는 필수 글자(봄) — 그 자리는 한글 그대로, 짝 글자는 그 소리의 훈 하나", () => {
  // 첫글자 자리 — 엔진은 짝 글자 옵션 하나만 준다(필수 글자 한자 없음)
  assert.equal(
    requiredCharMeaning("봄학", "first", ["學(배울 학, 가르칠 교, 고지새 할)"], "배울 학, 가르칠 교, 고지새 할"),
    "봄(한글) + 배울 학"
  );
  // 끝글자 자리
  assert.equal(requiredCharMeaning("수봄", "last", ["壽(목숨 수)"], "목숨 수"), "목숨 수 + 봄(한글)");
  // 짝 글자의 여러 독음 중 이름 음절로 읽히는 훈
  assert.equal(
    requiredCharMeaning("봄락", "first", ["樂(노래 악, 즐길 락, 좋아할 요)"], "노래 악, 즐길 락, 좋아할 요"),
    "봄(한글) + 즐길 락"
  );
  // 모양을 모르면 엔진 뜻 그대로
  assert.equal(requiredCharMeaning("봄학", "first", ["學"], "엔진 뜻"), "엔진 뜻");
  assert.equal(requiredCharMeaning("봄학", "any", ["學(배울 학)"], "엔진 뜻"), "엔진 뜻");
  assert.equal(requiredCharMeaning("봄", "first", ["學(배울 학)"], "엔진 뜻"), "엔진 뜻");
  assert.equal(requiredCharMeaning("봄학", "first", [], "엔진 뜻"), "엔진 뜻");
});

test("필수 글자에 한자가 있으면 예전처럼 이름 순서로 두 훈(아준 → 맑을 아 + 준걸 준)", () => {
  assert.equal(
    requiredCharMeaning("아준", "last", ["雅(맑을 아/바를 아)", "俊(준걸 준, 순임금 순)"], "준걸 준, 맑을 아"),
    "맑을 아 + 준걸 준"
  );
  assert.equal(
    requiredCharMeaning("서윤", "first", ["瑞(상서 서)", "書(글 서)", "允(맏 윤)"], "상서 서, 맏 윤"),
    "상서 서 + 맏 윤"
  );
});

// ---------------------------------------------------------------- smart-card-no-action
test("카드 key = 카테고리 + 이름 — 같은 순번이라도 탭이 다르면 다른 카드, 겹친 이름은 #2", () => {
  const names = [{ fullName: "김서윤" }, { fullName: "김하준" }, { fullName: "김서윤" }];
  assert.deepEqual(candidateKeys("standard", names), ["standard-김서윤", "standard-김하준", "standard-김서윤#2"]);
  const other = candidateKeys("creative", [{ fullName: "김하람" }, { fullName: "김하준" }]);
  assert.notEqual(other[0], candidateKeys("standard", names)[0], "다른 탭의 1번 카드는 다른 key");
  assert.notEqual(other[1], "standard-김하준", "같은 이름이라도 탭이 다르면 다른 key");
  assert.equal(new Set(candidateKeys("standard", names)).size, 3);
});

test("후보 카드마다 '상세 보기' — onCandidateDetail(이름, 평가 링크 한자) 그대로, 카드에 손가락 커서·떠오름 없음", () => {
  const card = body("CandidateCard");
  assert.match(card, /onClick=\{\(\) => onDetail\(c\.fullName, c\.evaluateHanja\)\}/);
  assert.match(card, /상세 보기 →/);
  assert.match(card, /aria-label=\{`상세 보기: \$\{c\.fullName\}`\}/, "접근 이름은 보이는 글자로 시작");
  const article = /<article[\s\S]*?\}\}\n\s*>/.exec(card)?.[0] ?? "";
  assert.match(article, /border: "1px solid var\(--color-border\)"/, "article 스타일 블록");
  assert.doesNotMatch(article, /cursor/, "article 에 손가락 커서가 없다");
  assert.doesNotMatch(card, /onMouseEnter|translateY|setHover/, "떠오름 효과 없음");
  assert.match(card, /aria-expanded=\{open\}/);
  const list = body("CandidateList");
  assert.match(list, /const keys = candidateKeys\(category\.type, category\.names\);/);
  assert.match(list, /<CandidateCard key=\{keys\[i\]\} candidate=\{n\} index=\{i\} onDetail=\{onDetail\} \/>/);
  assert.doesNotMatch(list, /key=\{i\}/);
  assert.match(SR, /<CandidateList category=\{activeCat\} onDetail=\{onCandidateDetail\} \/>/);
  // Top Pick 도 단추가 있을 때만(넘기지 않은 페이지에 눌러도 아무 일 없는 단추를 두지 않는다)
  assert.match(body("TopPickCard"), /\{onDetail && \(/);
});

// ---------------------------------------------------------------- smart-result-dead-links
test("'← 조건 바꾸기' 하나 — onRegenerate(handleReset) 단추, 자기 경로 Link·'↻ 새로 생성' 없음", () => {
  const header = body("MiniHeader");
  assert.match(header, /onClick=\{onEdit\}/);
  assert.match(header, /조건 바꾸기/);
  assert.doesNotMatch(header, /href=\{editHref\}/);
  assert.equal(SR.match(/<MiniHeader onEdit=\{onRegenerate\} headerRef=\{headerRef\} \/>/g)?.length, 2, "두 렌더 경로(빈 결과·결과)");
  assert.doesNotMatch(CODE, /새로 생성/);
  assert.doesNotMatch(CODE, /조건 수정/);
  assert.doesNotMatch(body("SubHeader"), /onRegenerate/);
});

test("결과 화면 꼬리의 소개·문의는 next/link 로 /about·/contact (href=\"#\" 없음)", () => {
  const footer = body("ResultFooter");
  assert.match(footer, /<Link\s+href="\/about"[\s\S]*?이름의 결에 대하여\s*<\/Link>/);
  assert.match(footer, /<Link\s+href="\/contact"[\s\S]*?문의\s*<\/Link>/);
  assert.doesNotMatch(CODE, /href="#"/);
});

// ---------------------------------------------------------------- creative-tab-card-overflow
test("휴대폰 폭에서 카드가 넘치지 않는다 — 격자 열 minmax(0, 1fr), 칩은 줄을 바꾼다", () => {
  assert.match(body("CandidateList"), /gridTemplateColumns: "minmax\(0, 1fr\)"/);
  assert.match(body("CandidateCard"), /minWidth: 0,/);
  const chip = body("TagChip");
  assert.doesNotMatch(chip, /whiteSpace: "nowrap"/, "긴 문장 칩(창의 탭)이 카드 하한을 넓혔다");
  assert.match(chip, /overflowWrap: "anywhere"/);
  assert.match(chip, /maxWidth: "100%"/);
  const row = body("TagRow");
  assert.match(row, /flexWrap: "wrap"/);
  assert.doesNotMatch(row, /overflowX/);
});

// ---------------------------------------------------------------- smart-result-mobile-chrome
test("탭을 바꾸면 창을 탭 줄 위(고정 머리 + 8px)로 — 예전 '띠 - 80'은 탭 줄이 머리 밑에 숨었다", () => {
  assert.equal(tabScrollTop(500, 1000, 57), 1435);
  assert.equal(tabScrollTop(-200, 100, 57), 0, "맨 위보다 위로는 가지 않는다");
  assert.equal(tabScrollTop(300.4, 0, 57.2), 235);
  assert.match(SR, /tabScrollTop\(tabs\.getBoundingClientRect\(\)\.top, window\.scrollY, headerHeight\)/);
  assert.match(SR, /anchorRef=\{tabsRef\}/);
  assert.doesNotMatch(CODE, /bannerRef/);
});

test("고른 탭을 탭 줄 가운데로 — 가로 거리만(창은 세로로 움직이지 않는다)", () => {
  assert.equal(centerScrollDelta(0, 300, 400, 100), 300);
  assert.equal(centerScrollDelta(10, 300, 110, 100), 0);
  assert.equal(centerScrollDelta(0, 300, 0, 80), -110);
  const tabs = body("CategoryTabs");
  assert.match(tabs, /aria-pressed=\{isActive\}/);
  assert.match(tabs, /querySelector<HTMLElement>\('\[aria-pressed="true"\]'\)/);
  assert.match(tabs, /el\.scrollBy\(\{ left: delta, behavior: "smooth" \}\)/);
  assert.doesNotMatch(tabs, /scrollIntoView/);
});

test("가려진 탭이 있는 쪽에만 흐림 마스크", () => {
  assert.equal(tabEdgeMask(false, false), undefined);
  assert.equal(tabEdgeMask(false, true), "linear-gradient(to right, #000, #000 calc(100% - 28px), transparent)");
  assert.equal(tabEdgeMask(true, false), "linear-gradient(to right, transparent, #000 28px, #000)");
  assert.equal(
    tabEdgeMask(true, true),
    "linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)"
  );
  const tabs = body("CategoryTabs");
  assert.match(tabs, /maskImage: mask,\n\s*WebkitMaskImage: mask,/);
});

test("Top Pick·카테고리 띠·'이 추천은 시작점이에요' 상자에 좌우 24px", () => {
  assert.match(SR, /const SIDE_GUTTER: CSSProperties = \{ padding: "0 24px" \};/);
  assert.match(SR, /<div style=\{\{ \.\.\.SIDE_GUTTER, maxWidth: 720 \+ 48, margin: "24px auto 0" \}\}>\n\s*<TopPickCard/);
  assert.match(SR, /<div style=\{\{ \.\.\.SIDE_GUTTER, maxWidth: 920 \+ 48, margin: "0 auto" \}\}>\n\s*<CategoryBanner/);
  assert.match(body("ReferenceNotice"), /\.\.\.SIDE_GUTTER, maxWidth: 920 \+ 48/);
});

// ---------------------------------------------------------------- rare-banner-josa
test("희귀 성씨 배너 — 받침으로 조사를 고르고 '성씨예요'", async () => {
  const banner = body("RareSurnameBanner");
  assert.match(SR, /import \{ josa \} from "@\/lib\/josa";/);
  assert.match(banner, /\{josa\(name, "은\/는"\)\} 희귀 성씨예요/);
  assert.doesNotMatch(CODE, /<\/b>는 희귀|성씨에요/);
  // 화면에 나올 말(josa 자체는 lib 테스트가 본다 — 여기서는 받침 있는/없는 성씨 둘 다)
  const { josa } = await import("../src/lib/josa.ts");
  assert.equal(`남궁${josa("남궁", "은/는")} 희귀 성씨예요`, "남궁은 희귀 성씨예요");
  assert.equal(`황보${josa("황보", "은/는")} 희귀 성씨예요`, "황보는 희귀 성씨예요");
});

// ---------------------------------------------------------------- print-search-result
test("인쇄 — 결과 화면 안 단추·탭·토글·링크 줄은 data-hide-print, 조건 칩은 남긴다", () => {
  for (const name of [
    "MiniHeader", // '← 조건 바꾸기'
    "SubHeader", // 저장 단추 줄
    "RareSurnameBanner", // '희귀 성씨 모드로 전환 →'·닫기
    "TopPickCard", // '상세 보기 →'
    "CategoryTabs", // 탭 줄
    "CandidateCard", // '이름의 결' 펼침·'상세 보기'
    "OtherCategoriesPreview", // '다른 카테고리도 살펴보세요' 가로 줄
    "ResultFooter", // 링크만 있는 꼬리
  ]) {
    assert.match(body(name), /data-hide-print/, `${name}`);
  }
  // 조건 칩(성·생년월일·성별·톤)은 단추 줄 밖이라 인쇄에 남는다
  const sub = body("SubHeader");
  assert.ok(sub.indexOf("chips.map") < sub.indexOf("data-hide-print"), "칩은 숨김 줄 앞");
  // 펼친 '이름의 결' 내용은 조작 줄 밖이라 인쇄에 남는다
  const card = body("CandidateCard");
  assert.ok(card.indexOf("{hasNotes && open && (") > card.lastIndexOf("data-hide-print"));
});

test("인쇄 — 카드·Top Pick 은 쪽 경계에서 갈리지 않는다(break-inside: avoid)", () => {
  assert.match(body("CandidateCard"), /breakInside: "avoid",/);
  assert.match(body("TopPickCard"), /breakInside: "avoid",/);
});
