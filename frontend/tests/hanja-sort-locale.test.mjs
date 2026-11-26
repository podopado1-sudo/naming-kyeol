// 한자 목록 동점 정렬 로캘 테스트 — `npm test`
//
// 2026-11-26 3파 운영 검증에서 찾은 것: lib/hanja-seo.ts compareByCoreGradeStrokes 의 마지막 기준이 로캘 없는 localeCompare 라
// 이 PC 의 Node(기본 ko-KR — 한자를 독음 순)와 Vercel 빌드(en 순)가 같은 순위 글자를 다르게 놓았다
// (독음 쪽 카드 순서 261/489쪽 · ItemList 256쪽 · 글자 상세 '함께 쓰기 좋은 오행' 대표 글자와 같은 음 상위 12 8,404/9,016쪽).
// 'en'(지금 운영 순서)으로 고정한 뒤 운영 HTML 과 대조했다 — 독음 489쪽 전부(카드 순서·ItemList)·글자 상세 1,300쪽 표본이 같았다
// (고치기 전 이 PC 순서는 독음 233/489 · 상세 301/1,300 만 같았다).
// 여기서 보는 것:
// - 같은 순위(코어·등급·획수가 같은) 묶음 안의 순서가 모든 독음에서 Intl.Collator('en') 순인지,
// - 이 시험이 가르는 힘이 있는지(같은 묶음을 'ko' 로 정렬하면 순서가 달라지는 곳이 실제로 있는지 — 실행 환경 기본 로캘과 무관하게),
// - 운영에서 확인한 손 사례(가 8획 伽坷岢泇迦 · 9획 珂珈茄, 수 11획 售宿授),
// - '함께 쓰기 좋은 오행' 대표 글자(getRepresentativeChars)도 같은 기준인지,
// - 원본에 로캘 없는 localeCompare 가 다시 들어오지 않는지.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";

// lib/hanja-seo.ts 는 '@/data/hanja-seo.json'·'./ohaeng-relation'(확장자 없음)을 import 한다 —
// 이 파일 안에서만 '@/' 를 src/ 로 풀고, 확장자 없는 상대 경로에 '.ts' 를 붙이고, JSON 을 기본 내보내기 모듈로 읽는다.
// (node --test 는 테스트 파일마다 따로 돌아 다른 테스트에 번지지 않는다. 동적 import 는 훅을 건 뒤에 해야 한다.)
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

const L = await import("../src/lib/hanja-seo.ts");
const DATA = (await import("../src/data/hanja-seo.json")).default;

const EN = new Intl.Collator("en");
const KO = new Intl.Collator("ko");
const GRADE_RANK = { R: 0, X: 1, V: 2, U: 3 };
/** 마지막 기준 앞까지의 순위 — 이 값이 같은 이웃끼리만 로캘이 순서를 정한다 */
const rankKey = (c) => {
  const r = DATA[c];
  return `${r.c ? 0 : 1}|${GRADE_RANK[r.g ?? "U"] ?? 4}|${r.s ?? 99}`;
};

test("같은 순위 묶음 안의 순서는 모든 독음에서 'en' 정렬 순이다", () => {
  let tiedPairs = 0;
  let koWouldDiffer = 0;
  const wrong = [];
  for (const readings of L.getConsonantGroups().values()) {
    for (const reading of readings) {
      const chars = L.getReadingChars(reading) ?? [];
      for (let i = 1; i < chars.length; i++) {
        const [a, b] = [chars[i - 1], chars[i]];
        if (rankKey(a) !== rankKey(b)) continue;
        tiedPairs++;
        if (EN.compare(a, b) > 0) wrong.push(`${reading}: ${a} 가 ${b} 앞`);
        if (KO.compare(a, b) > 0) koWouldDiffer++;
      }
    }
  }
  assert.deepEqual(wrong, []);
  assert.ok(tiedPairs > 1000, `같은 순위 이웃 ${tiedPairs}쌍 — 너무 적다(데이터가 바뀌었는지 볼 것)`);
  // 가르는 힘: 'ko' 로 정렬했다면 뒤집혔을 이웃이 실제로 있다(고치기 전 이 PC 빌드가 운영과 달랐던 이유)
  assert.ok(koWouldDiffer > 100, `'ko' 와 순서가 갈리는 이웃 ${koWouldDiffer}쌍`);
});

test("운영에서 확인한 손 사례 — 가·수('ko' 와 갈림), 온·은·산·이(확장 A — ICU 데이터·코드포인트 비교와 갈림)", () => {
  const order = (reading, group) => {
    const chars = L.getReadingChars(reading);
    return [...group].sort((x, y) => chars.indexOf(x) - chars.indexOf(y)).join("");
  };
  // 운영(Vercel) /hanja/가 · /hanja/수 의 카드 순서. 고치기 전 이 PC 빌드는 伽迦坷岢泇 · 珂茄珈 · 授售宿 였다
  assert.equal(order("가", ["伽", "迦", "坷", "岢", "泇"]), "伽坷岢泇迦");
  assert.equal(order("가", ["珂", "珈", "茄"]), "珂珈茄");
  assert.equal(order("수", ["售", "宿", "授"]), "售宿授");
  // 확장 A 글자가 낀 동점 — 위 세 묶음은 기본 영역 안이라 ICU 데이터가 달라도(Chromium 계열의 implicithan — 기본 영역 먼저) 통과한다.
  // 이 넷은 운영 HTML 에서 확인한 순서로, implicithan 이면 㬈·㒚·㦃·㺿䏪 가 뒤로 가고, 이(珥㺿䏪)는 코드포인트 비교와도 갈린다
  assert.equal(order("온", ["昷", "㬈", "瑥"]), "昷㬈瑥");
  assert.equal(order("은", ["誾", "㒚", "憖"]), "誾㒚憖");
  assert.equal(order("산", ["剷", "㦃", "蒜", "酸"]), "剷㦃蒜酸");
  assert.equal(order("이", ["珥", "㺿", "䏪"]), "珥㺿䏪");
});

test("'함께 쓰기 좋은 오행' 대표 글자도 같은 기준(약자 뒤로 → 코어 → 등급 → 획수 → 'en')", () => {
  for (const element of ["木", "火", "土", "金", "水"]) {
    const expected = Object.keys(DATA)
      .filter((c) => DATA[c].e === element && L.hasDetailPage(DATA[c]) && !L.isAvoidedForNames(DATA[c]))
      .sort((a, b) => {
        const wk = (DATA[a].wk ? 1 : 0) - (DATA[b].wk ? 1 : 0);
        if (wk) return wk;
        const [ka, kb] = [rankKey(a).split("|").map(Number), rankKey(b).split("|").map(Number)];
        for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
        return EN.compare(a, b);
      })
      .slice(0, 6);
    assert.deepEqual(L.getRepresentativeChars(element, 6), expected, element);
  }
});

test("lib/hanja-seo.ts 에 로캘 없는 localeCompare 가 없다 — 한자 정렬은 'en' 고정 콜레이터로", () => {
  const src = readFileSync(fileURLToPath(new URL("../src/lib/hanja-seo.ts", import.meta.url)), "utf8");
  assert.doesNotMatch(src, /\.localeCompare\(\s*[\w.]+\s*\)/);
  assert.match(src, /new Intl\.Collator\("en"\)/);
});
