// 쌍둥이 이름 세트 테스트 — `npm test`
//
// 2026-11-26 에 고친 두 가지를 지킨다(lib/twin-sets.ts 머리말).
// ① 탭 중복: 서버는 세트를 10개까지 주는데(테마가 섞여 있다) 화면이 세트마다 탭을 만들면서 key·이름표를 테마 이름으로만 줘서
//    '공유글자' 탭이 여러 개 나란히 섰고, 같은 테마의 탭은 모두 그 테마의 첫 세트만 보여 줬다(나머지 세트는 볼 길이 없었다).
// ② 톤·성별 무시: 화면이 "Soft"·"Male" 로 보냈는데 서버 엔진은 소문자와만 비교해 세트 고르기에서 톤·성별이 통째로 빠졌다
//    (운영에서 확인 — 대문자 Soft 와 Strong 은 세트가 거의 같고, 소문자 soft 와 strong 은 이름이 갈린다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const {
  mapTwinResponse,
  groupTwinSets,
  pickTwinSet,
  twinSetLabel,
  twinSummaryLine,
  twinGenderTone,
} = await import("../src/lib/twin-sets.ts");

const read = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

const cand = (name) => ({ name, aestheticScore: 60, harmonyScore: 70, finalScore: 65, reasons: [] });
const set = (theme, names, coherenceScore, themeDescription = `${theme} 세트`) => ({
  theme,
  themeDescription,
  names: names.map(cand),
  coherenceScore,
});

// 운영 응답과 같은 꼴 — 조화도 높은 순, 테마가 섞여 있다(공유글자 6 · 공유의미 2 · 공유톤 2)
const RESPONSE = {
  id: "sample",
  nameSets: [
    set("공유의미", ["우천", "우정"], 81, "'NATURE' 의미를 공유하는 이름 세트"),
    set("공유톤", ["우선", "우천"], 80, "부드러운 톤(Soft) 공유 — 같은 톤의 이름 세트"),
    set("공유의미", ["선포", "선아"], 79, "'VIRTUE' 의미를 공유하는 이름 세트"),
    set("공유글자", ["용주", "용소"], 78, "'용' 첫글자를 공유하는 이름 세트"),
    set("공유글자", ["윤호", "원호"], 77, "'호' 끝글자를 공유하는 이름 세트"),
    set("공유글자", ["윤하", "원하"], 76, "'하' 끝글자를 공유하는 이름 세트"),
    set("공유글자", ["윤희", "원희"], 75, "'희' 끝글자를 공유하는 이름 세트"),
    set("공유톤", ["윤지", "윤치"], 74, "강한 톤(Strong) 공유 — 같은 톤의 이름 세트"),
    set("공유글자", ["하선", "하철"], 73, "'하' 첫글자를 공유하는 이름 세트"),
    set("공유글자", ["호선", "호철"], 72, "'호' 첫글자를 공유하는 이름 세트"),
  ],
};

test("세트마다 id 가 다르고 순서는 응답 그대로다", () => {
  const sets = mapTwinResponse(RESPONSE);
  assert.equal(sets.length, 10);
  assert.equal(new Set(sets.map((s) => s.id)).size, 10);
  assert.deepEqual(
    sets.map((s) => s.pair.map((p) => p.first).join("")),
    RESPONSE.nameSets.map((s) => s.names.map((n) => n.name).join(""))
  );
  // 테마 key 는 겹친다 — 그래서 세트를 key 로 찾으면 안 된다
  assert.equal(new Set(sets.map((s) => s.key)).size, 3);
});

test("공유글자·자리 이름·영문 카테고리 설명 바꾸기는 예전 매핑과 같다", () => {
  const sets = mapTwinResponse(RESPONSE);
  const yong = sets[3];
  assert.equal(yong.key, "shared_char");
  assert.deepEqual(yong.shared, { type: "char", value: "용" });
  assert.deepEqual(yong.pair.map((p) => p.position), ["첫째", "둘째"]);
  assert.deepEqual(yong.pair.map((p) => p.sharedIndex), [[0], [0]]);
  assert.equal(sets[4].shared.value, "호");
  assert.deepEqual(sets[4].pair.map((p) => p.sharedIndex), [[1], [1]]);
  assert.equal(sets[0].description, "뜻 갈래(자연·덕목 등)가 같은 한자들의 소리로 지은 이름 세트");
  assert.equal(sets[1].description, "부드러운 톤(Soft) 공유 — 같은 톤의 이름 세트");
  assert.equal(sets[0].shared.value, "");
});

test("탭은 테마당 하나 — 묶음 순서는 그 테마의 첫 세트가 나온 순서, 묶음 안은 응답 순서", () => {
  const sets = mapTwinResponse(RESPONSE);
  const groups = groupTwinSets(sets);
  assert.deepEqual(groups.map((g) => g.label), ["공유의미", "공유톤", "공유글자"]);
  assert.equal(new Set(groups.map((g) => g.key)).size, groups.length);
  assert.deepEqual(groups.map((g) => g.sets.length), [2, 2, 6]);
  // 모든 세트가 어느 묶음엔가 한 번씩 들어 있다(예전에는 테마마다 첫 세트만 볼 수 있었다)
  assert.deepEqual(
    groups.flatMap((g) => g.sets.map((s) => s.id)).sort(),
    sets.map((s) => s.id).sort()
  );
  // 처음 보이는 세트(전체 1순위)는 첫 탭의 첫 세트다
  assert.equal(groups[0].sets[0].id, sets[0].id);
  assert.deepEqual(groups[2].sets.map(twinSetLabel), [
    "용주 · 용소",
    "윤호 · 원호",
    "윤하 · 원하",
    "윤희 · 원희",
    "하선 · 하철",
    "호선 · 호철",
  ]);
});

test("고른 세트는 id 로 찾는다 — 같은 테마의 다른 세트가 실제로 골라진다", () => {
  const sets = mapTwinResponse(RESPONSE);
  const groups = groupTwinSets(sets);
  const chars = groups[2].sets;
  const picked = chars.map((s) => pickTwinSet(sets, s.id));
  assert.deepEqual(picked.map(twinSetLabel), chars.map(twinSetLabel));
  assert.equal(new Set(picked.map(twinSetLabel)).size, 6);
  // 목록에 없는 id(결과가 바뀐 직후 등)면 첫 세트, 빈 목록이면 없음
  assert.equal(pickTwinSet(sets, "set-99").id, sets[0].id);
  assert.equal(pickTwinSet([], "set-0"), undefined);
});

test("머리말은 실제 테마와 세트 수를 적는다", () => {
  const groups = groupTwinSets(mapTwinResponse(RESPONSE));
  assert.equal(twinSummaryLine(groups), "공유의미 · 공유톤 · 공유글자 테마로 어울리는 이름 세트 10개를 골랐어요.");
  const one = groupTwinSets(mapTwinResponse({ id: "x", nameSets: [RESPONSE.nameSets[3]] }));
  assert.equal(twinSummaryLine(one), "공유글자 테마로 어울리는 이름 세트 1개를 골랐어요.");
});

test("요청의 성별·톤은 서버 엔진이 알아보는 소문자 값이다", () => {
  assert.deepEqual(twinGenderTone("male", "soft"), { gender: "male", tone: "soft" });
  assert.deepEqual(twinGenderTone("female", "strong"), { gender: "female", tone: "strong" });
  assert.deepEqual(twinGenderTone("none", "neutral"), { gender: undefined, tone: "neutral" });
});

test("원본 — /twin 이 대문자 값을 보내지 않고, 결과 화면이 세트를 테마 key 로 찾지 않는다", () => {
  const page = read("app/twin/page.tsx");
  assert.match(page, /\.\.\.twinGenderTone\(gender, tone\)/);
  assert.match(page, /mapTwinResponse\(result\)/);
  assert.doesNotMatch(page, /"(Male|Female|Soft|Strong|Neutral)"/);

  const result = read("components/design/TwinResult.tsx");
  assert.match(result, /pickTwinSet\(themes, currentId\)/);
  assert.match(result, /groupTwinSets\(themes\)/);
  assert.doesNotMatch(result, /themes\.find\(\(t\) => t\.key ===/);
  assert.doesNotMatch(result, /3가지 테마/);
  // 동작 없는 단추와 빈 링크가 다시 들어오지 않는다
  assert.doesNotMatch(result, /href="#"/);
  // ('이 세트로 결정하기 ✓' 는 onClick 없는 <Button> 이었다 — 이 파일에 <Button> 을 다시 쓰려면 동작을 달아야 한다)
  assert.doesNotMatch(result, /<Button\b/);
  for (const m of result.matchAll(/<button\b[^>]*>/g)) assert.match(m[0], /onClick=/, m[0]);

  const top = read("components/design/TwinResultTop.tsx");
  assert.match(top, /export function SetChips\(/);
  assert.match(top, /aria-pressed=\{active\}/);
});
