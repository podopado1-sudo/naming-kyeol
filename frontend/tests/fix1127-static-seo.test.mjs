// 2026-11-27 버그 목록 G-static-seo 묶음 — /hanja·/name 템플릿·인덱스와 /guide 본문 — `npm test`
//
// 버그 key 와 여기서 고정하는 것:
//   hanja-grid-mobile-overflow  — /hanja 독음·글자 상세의 카드 격자가 휴대폰 폭에서 열을 정한다(grid-cols-1), 카드·링크는 min-w-0
//   name-dup-syllable-chips      — /name '음절별 한자 전체 보기'는 같은 음절을 한 번만(나나·라라·아리아)
//   name-no-hanja-copy           — 한자가 한 글자도 없는 쪽(바른·으뜸·푸른)의 설명은 '한자를 확인하세요'를 빼고, 뜻·서사가 없는 쪽(나나·라라)에 한 줄
//   hanja-count-mismatch         — /hanja 머리말 글자 수 = 독음 쪽들이 싣는 글자 수(사전 수록), 상세 쪽 수는 따로 밝힌다
//   guide-saju-weight-claim      — /guide 04장 문장이 점수 계산(미학 70%·조화 30% 고정, 시각이 없으면 시주만 빠짐)과 같다
//   ad-boundary-prefetch-waste   — 광고 경계를 넘는 next/link 만 prefetch={false}(광고를 켠 빌드에서만), 넘지 않는 링크는 그대로
//
// 화면 파일(.tsx)은 node 로 그릴 수 없어 계약은 원문으로, 데이터 판정은 lib 모듈·JSON 을 직접 읽어 값으로 본다.
// 표본 이름은 데이터에 실린 공개 이름이다(바른·나나 — 버그 재현에 쓴 쪽).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";

// lib/hanja-seo.ts·lib/name-seo.ts 는 '@/…' 와 JSON 을 import 한다 — 이 파일 안에서만 '@/' 를 src/ 로 풀고, 확장자 없는 경로에 '.ts' 를 붙이고,
// JSON 을 기본 내보내기 모듈로 읽는다(tests/hanja-sort-locale.test.mjs 와 같은 훅 — node --test 는 파일마다 따로 돈다)
const SRC = new URL("../src/", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const spec = specifier.startsWith("@/") ? SRC + specifier.slice(2) : specifier;
    try {
      return nextResolve(spec, context);
    } catch (err) {
      if (err?.code === "ERR_MODULE_NOT_FOUND" && !/\.[cm]?[jt]sx?$|\.json$/.test(spec)) {
        return nextResolve(`${spec}.ts`, context);
      }
      throw err;
    }
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".json")) {
      return { format: "module", source: `export default ${readFileSync(fileURLToPath(url), "utf8")}`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const H = await import("../src/lib/hanja-seo.ts");
const AD = await import("../src/lib/ad-scope.ts");

/** 소스 원문 — 줄바꿈을 LF 로(저장소가 core.autocrlf 라 작업 트리에서 CRLF 다) */
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
/** 주석을 뺀 코드(블록·JSX·줄 주석) */
const code = (src) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
const flat = (s) => s.replace(/\s+/g, " ");

const HANJA_SLUG = "../src/app/hanja/[slug]/page.tsx";
const HANJA_INDEX = "../src/app/hanja/page.tsx";
const NAME_SLUG = "../src/app/name/[slug]/page.tsx";
const NAME_INDEX = "../src/app/name/page.tsx";
const CARD = "../src/components/hanja/HanjaCharCard.tsx";
const GUIDE = "../src/app/guide/page.tsx";

const HANJA_DATA = JSON.parse(read("../src/data/hanja-seo.json"));
const NAME_DATA = JSON.parse(read("../src/data/name-seo.json")).names;

// ─── hanja-grid-mobile-overflow ─────────────────────────────────

test("/hanja 카드 격자 네 곳 모두 휴대폰 폭에서 열을 정한다(grid-cols-1) — 열 정의 없는 auto 열이 긴 훈 카드 폭으로 늘어나지 않게", () => {
  const src = code(read(HANJA_SLUG));
  const grids = [...src.matchAll(/className="(grid\b[^"]*)"/g)].map((m) => m[1]);
  // 독음 쪽 2(쓰는 글자·피하는 글자) + 글자 상세 2(함께 쓰기 좋은 오행·같은 음)
  assert.equal(grids.length, 4, grids.join(" | "));
  for (const cls of grids) {
    assert.match(cls, /(^|\s)grid-cols-1(\s|$)/, cls);
    assert.match(cls, /\bsm:grid-cols-2\b/, cls);
    assert.match(cls, /\blg:grid-cols-3\b/, cls);
  }
  // 격자 안은 HanjaCharCard 뿐
  assert.equal([...src.matchAll(/<HanjaCharCard\b/g)].length, 4);
});

test("HanjaCharCard — 링크와 카드에 min-w-0, 훈 줄은 그대로 한 줄 말줄임(truncate)", () => {
  const src = read(CARD);
  const body = /const body = \(\s*<div\s+className=\{cn\(\s*"([^"]*)"/.exec(src);
  assert.ok(body, "카드 컨테이너를 찾지 못했다");
  assert.match(body[1], /\bmin-w-0\b/);
  assert.match(src, /href=\{`\/hanja\/\$\{encodeURIComponent\(char\)\}`\}\s*className="block min-w-0 no-underline"/);
  assert.match(src, /<div className="min-w-0 flex-1">\s*<p className="truncate text-sm font-medium text-navy">/);
});

// ─── name-dup-syllable-chips ────────────────────────────────────

test("/name '음절별 한자 전체 보기' — 음절 목록을 중복 없이 만든다(key = 음절)", () => {
  const src = code(read(NAME_SLUG));
  assert.match(src, /const syllableLinks = \[\.\.\.new Set\(syllables\)\]\.map\(\(syl\) => \(\{\s*syl,\s*chars: getReadingChars\(syl\),\s*\}\)\);/);
  // 칩 두 갈래(링크·순우리말/한자 없음) 모두 음절이 key
  const chips = /\{syllableLinks\.map\(\(\{ syl, chars \}\) =>([\s\S]*?)\)\}\s*<\/div>/.exec(src);
  assert.ok(chips, "칩 목록을 찾지 못했다");
  assert.equal([...chips[1].matchAll(/key=\{syl\}/g)].length, 2);
  // 같은 음절이 두 번 든 이름 — 공개 이름에 나나·라라·아리아가 있다(개방 대기 미미·비비안·클라라). 중복을 없애면 음절 하나씩
  const repeated = Object.keys(NAME_DATA).filter((n) => new Set([...n]).size !== [...n].length);
  for (const n of ["나나", "라라", "아리아"]) assert.ok(repeated.includes(n), n);
  for (const n of repeated) {
    const links = [...new Set([...n])];
    assert.equal(new Set(links).size, links.length, n);
  }
  assert.deepEqual([...new Set([..."아리아"])], ["아", "리"]);
});

// ─── name-no-hanja-copy ─────────────────────────────────────────

/** 페이지의 showsAnyHanja 와 같은 판정 — 조합이 있거나 그 음절로 읽는 한자가 사전에 있는 음절이 하나라도 있다 */
const showsAnyHanja = (name, rec) => !!rec.combos?.length || [...name].some((s) => H.getReadingChars(s) !== undefined);

test("/name 설명 — 한자가 한 글자도 없는 쪽만 '이름에 쓰는 한자를'을 뺀다(외래 이름은 전부터), 그 밖의 쪽 설명은 그대로", () => {
  const src = read(NAME_SLUG);
  const c = code(src);
  assert.match(c, /function hasSyllableHanja\(name: string\): boolean \{\s*return syllablesOf\(name\)\.some\(\(syl\) => getReadingChars\(syl\) !== undefined\);\s*\}/);
  assert.match(c, /function showsAnyHanja\(name: string, rec: NameSeoRecord\): boolean \{\s*return !!rec\.combos\?\.length \|\| hasSyllableHanja\(name\);\s*\}/);
  assert.match(c, /const noHanjaPart = foreign \|\| !showsAnyHanja\(name, rec\);/);
  // 설명 틀은 그대로 — 갈림 조건만 바뀌었다(검색 유입 보호: tests/evaluate-hanja-pages.test.mjs 가 앞부분을 원문으로 고정한다)
  assert.ok(
    flat(c).includes(
      "const description = `${name}: ${GENDER_LABEL[gender]}.${meanPart} 출생신고 통계 기준 인기 순위와 남녀 비율${ noHanjaPart ? \"을\" : \", 이름에 쓰는 한자를\" } 확인하세요.${scorePart}`;"
    )
  );
  assert.ok(src.includes("const title = `${name} 이름 뜻 — 인기 순위·한자·의미`;"), "제목 틀은 그대로");
  // 바뀌는 쪽 — 외래 이름이 아니면서 한자가 하나도 없는 이름(수록 전체, 공개 여부와 무관하게 센다)
  const changed = Object.entries(NAME_DATA)
    .filter(([n, rec]) => !rec.fx && !showsAnyHanja(n, rec))
    .map(([n]) => n)
    .sort();
  assert.deepEqual(changed, ["겨레", "바른", "으뜸", "푸른", "풀잎", "햇님"].sort());
  // 2026-11-27 공개 쪽은 바른·으뜸·푸른(겨레·풀잎·햇님은 개방 대기 — 열리면 같은 설명)
  const today = "2026-11-27";
  assert.deepEqual(
    changed.filter((n) => !NAME_DATA[n].pa || NAME_DATA[n].pa <= today),
    ["바른", "으뜸", "푸른"].sort()
  );
  // 겨울처럼 조합이 없어도 음절 한자 링크가 있는 쪽은 그대로 '한자를' — 실제로 한자를 볼 수 있다
  assert.ok(!NAME_DATA["겨울"].combos?.length && showsAnyHanja("겨울", NAME_DATA["겨울"]));
});

test("/name 뜻도 서사도 없는 쪽(나나·라라) — '이름 뜻' 아래 한 줄, 뒷문장은 이 쪽에 있는 것만 가리킨다", () => {
  const src = code(read(NAME_SLUG));
  assert.match(
    flat(src),
    /\{!rec\.mean && !rec\.story && kind !== "foreign" && \( <p className="mt-2 text-sm text-text-2"> \{noMeanNote\(kind, hasCombos, hasSyllableHanja\(name\)\)\} <\/p> \)\}/
  );
  // 외래 이름은 옛 문장(FOREIGN_NO_MEAN_NOTE) 그대로 — 두 줄이 함께 나오지 않는다
  assert.match(src, /\{!rec\.mean && kind === "foreign" && \(\s*<p className="mt-2 text-sm text-text-2">\{FOREIGN_NO_MEAN_NOTE\}<\/p>\s*\)\}/);
  const fn = /function noMeanNote\(kind: NameKind, hasCombos: boolean, syllableHanja: boolean\): string \{([\s\S]*?)\n\}/.exec(src);
  assert.ok(fn, "noMeanNote 를 찾지 못했다");
  assert.ok(fn[1].includes('const base = "이 이름은 뜻풀이를 따로 적지 않았습니다.";'));
  assert.ok(fn[1].includes('if (kind !== "hanja") return base;'));
  assert.ok(fn[1].includes("if (hasCombos) return `${base} 한자에 따라 뜻이 달라지니 아래 한자 조합을 함께 보세요.`;"));
  assert.ok(fn[1].includes("if (syllableHanja) return `${base} 음절마다 그 소리로 읽는 한자는 아래 ‘음절별 한자 전체 보기’에서 볼 수 있습니다.`;"));
  // 그 한 줄이 붙는 쪽 — 외래 이름이 아닌데 뜻·서사가 없다. 공개 쪽은 나나·라라, 둘 다 음절 한자 링크가 있고 조합은 없다
  const noMean = Object.entries(NAME_DATA).filter(([, r]) => !r.mean && !r.story && !r.fx);
  const today = "2026-11-27";
  const published = noMean.filter(([, r]) => !r.pa || r.pa <= today).map(([n]) => n).sort();
  assert.deepEqual(published, ["나나", "라라"]);
  for (const n of published) {
    const rec = NAME_DATA[n];
    assert.ok(!rec.pk && !rec.combos?.length && [...n].some((s) => H.getReadingChars(s)), n);
  }
  // 순우리말(pk)에는 뜻 없는 이름이 없다(있으면 첫 문장만 — 한자를 권하지 않는다)
  assert.equal(noMean.filter(([, r]) => r.pk).length, 0);
});

// ─── hanja-count-mismatch ───────────────────────────────────────

test("/hanja 머리말 글자 수 = 독음 쪽들이 싣는 글자(겹치지 않게) = 사전 수록 수, 상세 쪽 수는 따로 밝힌다", () => {
  const src = code(read(HANJA_INDEX));
  assert.match(src, /const totalChars = new Set\(allReadings\.flatMap\(\(reading\) => getReadingChars\(reading\) \?\? \[\]\)\)\.size;/);
  assert.match(src, /const detailChars = getAllDetailChars\(\)\.length;/);
  assert.ok(
    flat(src).includes(
      '이름에 쓰는 한자 {totalChars.toLocaleString()}자를 독음{" "} {totalReadings}개로 정리했습니다. 뜻·획수와 함께 부수 기준 자원오행과 그 판정 근거(확정·이견)를 표시하며, 뜻과 획수가 모두 있는{" "} {detailChars.toLocaleString()}자는 글자마다 상세 페이지를 두었습니다.'
    )
  );
  // 화면 문구는 웹 페이지를 '페이지'라 부른다(같은 화면의 V 등급 설명도 '상세 페이지') — '쪽'은 주석에만 쓴다
  assert.ok(!src.includes("쪽"));
  // 값 — 사전 레코드 전부가 어느 독음 쪽에든 실린다(9,105). 상세 쪽은 뜻·획수가 있는 글자(9,016)
  const readings = H.getAllReadings();
  const total = new Set(readings.flatMap((r) => H.getReadingChars(r) ?? [])).size;
  assert.equal(total, Object.keys(HANJA_DATA).length);
  assert.equal(H.getAllDetailChars().length, Object.values(HANJA_DATA).filter((r) => r.m && r.s).length);
  assert.ok(H.getAllDetailChars().length < total);
  // /evaluate 설명 글이 쓰는 커밋된 색인(index.json)의 글자·음절 수와도 같다 — 사이트 안에서 같은 사전을 같은 숫자로 말한다
  const pick = JSON.parse(read("../public/data/hanja-pick/v1/index.json"));
  assert.equal(total, pick.counts.characters);
  assert.equal(readings.length, pick.counts.syllables);
  // 메타 설명('9,000여 자')·제목·h1 은 그대로(검색 유입 보호 — tests/evaluate-hanja-pages.test.mjs)
  assert.ok(read(HANJA_INDEX).includes('"이름에 쓰는 인명용 한자 9,000여 자의 뜻, 획수, 오행을 독음별로 찾아보세요. 대법원 인명용 한자 기준, 부수 기준 자원오행과 판정 근거(확정·이견)를 함께 제공합니다.",'));
});

// ─── guide-saju-weight-claim ────────────────────────────────────

test("/guide 04장 — 시각이 없으면 시주만 빠지고 점수 비율은 그대로(계산 코드와 대조)", () => {
  const guide = flat(code(read(GUIDE)));
  assert.doesNotMatch(guide, /비중 있게/);
  assert.doesNotMatch(guide, /자정을 넘긴 출생 등 시주/);
  assert.ok(
    guide.includes(
      "출생 시각을 모르면 시주(時柱)를 빼고 연·월·일 세 기둥(여섯 글자)으로 사주를 계산합니다. 이때도 점수 비율은 미학 70% + 조화 30% 그대로이고, 생년월일 없이 평가하면 조화는 계산하지 않고 미학 점수만 봅니다."
    )
  );
  assert.ok(guide.includes("이름의 결은 미학 70% + 조화 30% 비율로 점수를 매깁니다."));
  // 근거 — 종합 점수는 출생일이 있으면 미학 0.7 + 조화 0.3(출생 시각은 가중에 쓰지 않는다), 없으면 미학 그대로
  const scoring = read("../../Application/Services/ScoringService.cs");
  assert.match(scoring, /int finalScore = birthDate\.HasValue\s*\?\s*\(int\)Math\.Round\(aesthetic\.TotalScore \* 0\.7 \+ harmony\.TotalScore \* 0\.3\)\s*:\s*aesthetic\.TotalScore;/);
  assert.doesNotMatch(/int finalScore =[\s\S]*?;/.exec(scoring)[0], /birthTime/);
  // 시각이 없으면 시주가 없다(세 기둥)
  const saju = read("../../Application/Services/SajuCalculationService.cs");
  assert.match(saju, /var hourPillar\s*=\s*hasTime\s*\?\s*CalculateHourPillar\(solar\.TimeOfDay, dayPillar\)\s*:\s*null;/);
});

// ─── ad-boundary-prefetch-waste ─────────────────────────────────

const HELPER =
  "function adBoundaryPrefetch(from: string, href: string): false | undefined {\n" +
  '  return adsEnabled() && isAdPage(from) !== isAdPage(href.split(/[?#]/)[0]) ? false : undefined;\n' +
  "}";
const PAGES = [HANJA_INDEX, NAME_INDEX, HANJA_SLUG, NAME_SLUG];

/** 원문의 함수를 타입을 지워 그대로 돌린다(ad-scope 의 판정 함수를 넣어) */
function helperFrom(src) {
  const js = HELPER.replace("(from: string, href: string): false | undefined", "(from, href)");
  assert.ok(src.includes(HELPER));
  return new Function("adsEnabled", "isAdPage", `${js}\nreturn adBoundaryPrefetch;`)(AD.adsEnabled, AD.isAdPage);
}

test("광고 경계 판정 함수 — 네 파일이 같은 글자, ad-scope 를 읽기만 한다", () => {
  for (const p of PAGES) {
    const src = read(p);
    assert.equal([...src.matchAll(/function adBoundaryPrefetch\(/g)].length, 1, p);
    assert.ok(src.includes(HELPER), `${p} 의 adBoundaryPrefetch 가 다르다`);
    assert.match(src, /^import \{ adsEnabled, isAdPage \} from "@\/lib\/ad-scope";$/m, p);
  }
});

test("광고 경계 판정 — 광고를 켠 빌드에서 경계를 넘을 때만 false, 그 밖(넘지 않음·광고 끈 빌드)은 기본 미리 받기(undefined)", () => {
  const fn = helperFrom(read(NAME_INDEX));
  const saved = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  try {
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = "ca-pub-0000000000000000";
    const crossing = [
      ["/name", `/name/${encodeURIComponent("서윤")}`],
      ["/name", "/search"],
      ["/hanja", `/hanja/${encodeURIComponent("가")}`],
      ["/hanja", "/required-char"],
      [`/hanja/${encodeURIComponent("가")}`, "/hanja"],
      [`/hanja/${encodeURIComponent("瑞")}`, "/method#resource-element"],
      [`/name/${encodeURIComponent("서윤")}`, "/"],
      [`/name/${encodeURIComponent("서윤")}`, "/name"],
      [`/name/${encodeURIComponent("서윤")}`, "/guide/syllable-map"],
    ];
    for (const [from, href] of crossing) assert.equal(fn(from, href), false, `${from} → ${href}`);
    const same = [
      [`/name/${encodeURIComponent("서윤")}`, `/name/${encodeURIComponent("지우")}`],
      [`/name/${encodeURIComponent("서윤")}`, "/search"],
      [`/hanja/${encodeURIComponent("가")}`, `/hanja/${encodeURIComponent("瑞")}`],
      [`/hanja/${encodeURIComponent("瑞")}`, `/required-char?char=${encodeURIComponent("瑞")}`],
      ["/guide", "/guide/syllable-map"],
    ];
    for (const [from, href] of same) assert.equal(fn(from, href), undefined, `${from} → ${href}`);
    // 쿼리·해시를 떼고 본다 — '/method#…' 를 광고 밖으로 잘못 보지 않는다
    assert.equal(AD.isAdPage("/method#resource-element"), false, "isAdPage 는 경로만 받는다 — 함수가 떼어 넘긴다");
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    for (const [from, href] of [...crossing, ...same]) assert.equal(fn(from, href), undefined, `광고 끈 빌드 ${from} → ${href}`);
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    else process.env.NEXT_PUBLIC_ADSENSE_CLIENT = saved;
  }
});

/** <Link …> 여는 태그들 — href 의 대표 경로(템플릿 자리는 'x')와 prefetch 식 */
function links(src) {
  return [...code(src).matchAll(/<Link\b([\s\S]*?)>/g)].map((m) => {
    const attrs = m[1];
    const lit = /\bhref="([^"]+)"/.exec(attrs)?.[1];
    const tpl = /\bhref=\{`([^`]+)`\}/.exec(attrs)?.[1];
    const expr = /\bhref=\{([^`}][^}]*)\}/.exec(attrs)?.[1];
    const path = lit ?? (tpl ? tpl.replace(/\$\{[^}]*\}/g, "x") : null);
    // 끝은 ')}' 다음이 빈칸·태그 끝인 곳 — 템플릿 속 '${encodeURIComponent(name)}' 의 ')}' 에서 끊지 않게
    const m2 = /\bprefetch=\{adBoundaryPrefetch\((\w+), ([\s\S]*?)\)\}(?=\s|$)/.exec(attrs);
    const prefetch = m2 ? { from: m2[1], href: m2[2] } : null;
    return { attrs: flat(attrs), path, expr, prefetch, hrefSrc: lit ? `"${lit}"` : tpl ? `\`${tpl}\`` : expr };
  });
}

test("광고 화면(/name·/hanja 인덱스)의 링크는 모두 경계를 넘는다 — 모두 prefetch={adBoundaryPrefetch(PAGE_PATH, href)}", () => {
  for (const [p, page, min] of [[NAME_INDEX, "/name", 4], [HANJA_INDEX, "/hanja", 3]]) {
    const src = read(p);
    assert.match(src, new RegExp(`^const PAGE_PATH = "${page}";$`, "m"));
    assert.equal(AD.isAdPage(page), true);
    const all = links(src);
    assert.ok(all.length >= min, `${p}: Link ${all.length}개`);
    for (const l of all) {
      assert.ok(l.path, `${p}: href 를 읽지 못했다 — ${l.attrs}`);
      assert.equal(AD.isAdPage(l.path), false, `${p}: ${l.path} 는 광고 밖이어야 한다`);
      assert.ok(l.prefetch, `${p}: prefetch 없음 — ${l.attrs}`);
      assert.equal(l.prefetch.from, "PAGE_PATH", l.attrs);
      assert.equal(l.prefetch.href, l.hrefSrc, `${p}: prefetch 의 href 가 링크 href 와 다르다 — ${l.attrs}`);
    }
  }
});

test("광고 밖 화면(이름 상세·독음·글자 상세)의 링크 — 광고 화면으로 가는 것만 prefetch 를 끄고, 광고 밖끼리는 그대로", () => {
  // 경계를 넘는 링크 수 — 이름 상세: 홈·사전 인덱스(빵부스러기)·리포트(/guide/…), 글자 상세: 작명 원리(/method) + 넘겨받는 빵부스러기 1
  const expected = new Map([[NAME_SLUG, { crossing: 3, passed: 0, other: 3 }], [HANJA_SLUG, { crossing: 1, passed: 1, other: 5 }]]);
  for (const p of [NAME_SLUG, HANJA_SLUG]) {
    const all = links(read(p));
    let crossing = 0;
    let passed = 0;
    let other = 0;
    for (const l of all) {
      if (l.path) {
        // 이 파일의 쪽은 모두 광고 밖 — 링크가 광고 화면으로 가면 경계를 넘는다
        if (AD.isAdPage(l.path.split(/[?#]/)[0])) {
          crossing++;
          assert.ok(l.prefetch, `${p}: ${l.path} 로 가는 링크에 prefetch 가 없다`);
          assert.equal(l.prefetch.href, l.hrefSrc, `${p}: ${l.attrs}`);
          assert.match(l.prefetch.from, /^(from|here)$/, l.attrs);
        } else {
          other++;
          assert.equal(l.prefetch, null, `${p}: 광고 밖끼리의 링크(${l.path})는 지금 동작 그대로 둔다`);
          assert.doesNotMatch(l.attrs, /\bprefetch=/, l.attrs);
        }
      } else {
        // 빵부스러기처럼 href 를 넘겨받는 링크는 그 href 로 판정한다
        passed++;
        assert.ok(l.prefetch, `${p}: ${l.attrs}`);
        assert.equal(l.prefetch.href, l.expr, l.attrs);
        assert.equal(l.prefetch.from, "from", l.attrs);
      }
    }
    assert.deepEqual({ crossing, passed, other }, expected.get(p), p);
  }
  // 빵부스러기의 from 은 그 쪽 경로 — 독음·글자 상세 모두 넘긴다
  const hanja = code(read(HANJA_SLUG));
  assert.equal([...hanja.matchAll(/<Breadcrumb\s+from=\{/g)].length, 2);
  assert.match(hanja, /const here = `\/hanja\/\$\{encodeURIComponent\(char\)\}`;/);
  const name = code(read(NAME_SLUG));
  assert.match(name, /const here = `\/name\/\$\{encodeURIComponent\(name\)\}`;/);
  assert.match(name, /<Breadcrumb name=\{name\} from=\{here\} \/>/);
});
