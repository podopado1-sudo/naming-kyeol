// 오행 관계·역할 테스트 — `npm test`
//
// 2026-11 한자 입력(docs/plan-hanja-input-2026-11.md §8-1·§8-4·§13-3): 오행 상생 표와 `ohaengRelation` 을
// 서버 전용 모듈(lib/hanja-seo.ts·lib/name-seo.ts — 큰 정적 JSON 을 import 한다)에서 순수 모듈 lib/ohaeng-relation.ts 로 옮겼다.
// - 옮긴 뒤에도 25쌍의 출력이 그대로인지(/name 조합 카드 3,865쪽의 칩 문구가 여기서 나온다) — 기대값은 옮기기 전 코드를 읽고 손으로 적은 표다.
// - 두 파일이 같은 것을 다시 내보내는지(기존 import 가 그대로 산다).
// - `ohaengRelationName`(이름 꼴)의 판정이 `ohaengRelation` 과 같고 상극은 누르는 쪽을 앞에 두는지.
// - `rolesOf` 가 백엔드 ElementFit.RolesOf 와 같은 조건·같은 순서인지.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const { ELEMENT_CONTROLS, ELEMENT_GENERATES, ohaengRelation, ohaengRelationName, rolesOf } = await import(
  "../src/lib/ohaeng-relation.ts"
);

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** 옮기기 전 출력 — [앞 오행, 뒤 오행, kind, label]. 상생은 방향을 가리지 않고 '낳는 쪽 生 받는 쪽'으로 적는다 */
const RELATION_TABLE = [
  ["木", "木", "비화", "木木 · 비화(같은 기운)"],
  ["木", "火", "생", "木生火 · 상생"],
  ["木", "土", "극", "상극(기운이 부딪침)"],
  ["木", "金", "극", "상극(기운이 부딪침)"],
  ["木", "水", "생", "水生木 · 상생"],
  ["火", "木", "생", "木生火 · 상생"],
  ["火", "火", "비화", "火火 · 비화(같은 기운)"],
  ["火", "土", "생", "火生土 · 상생"],
  ["火", "金", "극", "상극(기운이 부딪침)"],
  ["火", "水", "극", "상극(기운이 부딪침)"],
  ["土", "木", "극", "상극(기운이 부딪침)"],
  ["土", "火", "생", "火生土 · 상생"],
  ["土", "土", "비화", "土土 · 비화(같은 기운)"],
  ["土", "金", "생", "土生金 · 상생"],
  ["土", "水", "극", "상극(기운이 부딪침)"],
  ["金", "木", "극", "상극(기운이 부딪침)"],
  ["金", "火", "극", "상극(기운이 부딪침)"],
  ["金", "土", "생", "土生金 · 상생"],
  ["金", "金", "비화", "金金 · 비화(같은 기운)"],
  ["金", "水", "생", "金生水 · 상생"],
  ["水", "木", "생", "水生木 · 상생"],
  ["水", "火", "극", "상극(기운이 부딪침)"],
  ["水", "土", "극", "상극(기운이 부딪침)"],
  ["水", "金", "생", "金生水 · 상생"],
  ["水", "水", "비화", "水水 · 비화(같은 기운)"],
];

/** 이름 꼴의 상극 — 누르는 쪽이 앞(木剋土·土剋水·水剋火·火剋金·金剋木), 방향을 가리지 않는다 */
const CONTROL_NAME = {
  "木土": "木剋土 · 상극",
  "土木": "木剋土 · 상극",
  "土水": "土剋水 · 상극",
  "水土": "土剋水 · 상극",
  "水火": "水剋火 · 상극",
  "火水": "水剋火 · 상극",
  "火金": "火剋金 · 상극",
  "金火": "火剋金 · 상극",
  "金木": "金剋木 · 상극",
  "木金": "金剋木 · 상극",
};

test("ELEMENT_GENERATES·ELEMENT_CONTROLS: 상생 木→火→土→金→水→木, 상극 木→土→水→火→金→木", () => {
  assert.deepEqual(ELEMENT_GENERATES, { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" });
  assert.deepEqual(ELEMENT_CONTROLS, { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" });
});

test("ohaengRelation: 25쌍이 옮기기 전 출력과 같다", () => {
  assert.equal(RELATION_TABLE.length, 25);
  const seen = new Set();
  for (const [e1, e2, kind, label] of RELATION_TABLE) {
    assert.deepEqual(ohaengRelation(e1, e2), { kind, label }, `${e1}${e2}`);
    seen.add(e1 + e2);
  }
  assert.equal(seen.size, 25);
  // 한쪽이 없으면 관계를 말하지 않는다
  for (const [e1, e2] of [[undefined, "木"], ["木", undefined], ["", "火"], ["水", ""], [undefined, undefined]]) {
    assert.deepEqual(ohaengRelation(e1, e2), { kind: "unknown", label: "" });
  }
});

test("lib/hanja-seo.ts·lib/name-seo.ts 는 ./ohaeng-relation 에서 다시 내보낸다 — 정의를 두 번 두지 않는다", () => {
  const hanjaSeo = read("../src/lib/hanja-seo.ts");
  const nameSeo = read("../src/lib/name-seo.ts");
  assert.match(hanjaSeo, /^export \{ ELEMENT_GENERATES \} from "\.\/ohaeng-relation";$/m);
  assert.match(nameSeo, /^export \{ ohaengRelation, type OhaengKind \} from "\.\/ohaeng-relation";$/m);
  assert.doesNotMatch(hanjaSeo, /export const ELEMENT_GENERATES\b/);
  assert.doesNotMatch(nameSeo, /export function ohaengRelation\b/);
  assert.doesNotMatch(nameSeo, /export type OhaengKind\b/);
  // 정의는 한 곳
  const moved = read("../src/lib/ohaeng-relation.ts");
  assert.equal(moved.match(/export const ELEMENT_GENERATES\b/g)?.length, 1);
  assert.equal(moved.match(/export function ohaengRelation\(/g)?.length, 1);
  assert.match(moved, /export type OhaengKind = "생" \| "비화" \| "극" \| "unknown";/);
  // 쓰는 쪽(/hanja 글자 상세 · /name 조합 카드)은 예전 경로 그대로 import 한다
  assert.match(read("../src/app/hanja/[slug]/page.tsx"), /\bELEMENT_GENERATES,/);
  assert.match(read("../src/app/name/[slug]/page.tsx"), /\bohaengRelation,/);
});

test("ohaengRelationName: 판정은 ohaengRelation 과 같고, 상극은 누르는 쪽을 앞에 둔 이름으로 적는다", () => {
  let controls = 0;
  for (const [e1, e2, kind, label] of RELATION_TABLE) {
    const named = ohaengRelationName(e1, e2);
    assert.equal(named.kind, kind, `${e1}${e2}`);
    assert.equal(named.kind, ohaengRelation(e1, e2).kind);
    if (kind === "극") {
      assert.equal(named.label, CONTROL_NAME[e1 + e2], `${e1}${e2}`);
      controls++;
    } else {
      assert.equal(named.label, label, `${e1}${e2}`); // 상생·비화의 말은 /name 과 같다
    }
    // 해석 말('기운이 부딪침')은 쓰지 않는다
    assert.doesNotMatch(named.label, /부딪/);
  }
  assert.equal(controls, 10);
  assert.equal(Object.keys(CONTROL_NAME).length, 10);
  // 다섯 방향 모두 '누르는 쪽 앞'
  assert.deepEqual(
    ["木土", "土水", "水火", "火金", "金木"].map((pair) => ohaengRelationName(pair[0], pair[1]).label),
    ["木剋土 · 상극", "土剋水 · 상극", "水剋火 · 상극", "火剋金 · 상극", "金剋木 · 상극"]
  );
});

test("ohaengRelationName: 한쪽이 없거나 오행이 아니면 관계를 말하지 않는다", () => {
  for (const [e1, e2] of [
    [undefined, "木"],
    ["木", undefined],
    ["", "火"],
    ["金", ""],
    ["木", "x"],
    ["목", "화"],
    ["constructor", "木"],
    ["toString", "toString"],
  ]) {
    assert.deepEqual(ohaengRelationName(e1, e2), { kind: "unknown", label: "" }, `${e1}/${e2}`);
  }
});

// ── rolesOf ────────────────────────────────────────────────────────────────────

test("rolesOf: 백엔드 ElementFit.RolesOf 와 같은 조건·같은 순서", () => {
  const src = read("../../Application/Engines/Utils/ElementFit.cs");
  const body = /public IReadOnlyList<string> RolesOf\(string\? element\)\s*\{([\s\S]*?)\n {4}\}/.exec(src);
  assert.ok(body, "RolesOf 본문을 찾지 못했다");
  const lines = body[1].split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("if ("));
  assert.deepEqual(lines, [
    "if (string.IsNullOrEmpty(element)) return Array.Empty<string>();",
    "if (element == Yongshin) roles.Add(RoleYongshin);",
    "if (element == Heeshin) roles.Add(RoleHeeshin);",
    "if (element == Gishin) roles.Add(RoleGishin);",
    "if (Lacking.Contains(element)) roles.Add(RoleLacking);",
    "if (Excessive.Contains(element) && element != Yongshin && element != Heeshin) roles.Add(RoleExcessive);",
  ]);
  for (const [name, value] of [["RoleYongshin", "yongshin"], ["RoleHeeshin", "heeshin"], ["RoleGishin", "gishin"], ["RoleLacking", "lacking"], ["RoleExcessive", "excessive"]]) {
    assert.match(src, new RegExp(`public const string ${name} = "${value}";`));
  }
});

test("rolesOf: 손 표 — 용신·희신이면 excessive 를 붙이지 않고, lacking 은 기신에도 붙는다", () => {
  // 2026-11-19 로컬 서버 응답(2025-03-02 출생)의 elementFit — 응답의 fills 와 같은 값이 나와야 한다
  const fit = { yongshin: "土", heeshin: "火", gishin: "木", lacking: ["土", "金", "水"], excessive: ["木", "火"], counts: { 木: 2, 火: 2, 土: 1, 金: 1, 水: 0 } };
  assert.deepEqual(rolesOf("土", fit), ["yongshin", "lacking"]); // 응답: 윤 允(土) → ["yongshin","lacking"]
  assert.deepEqual(rolesOf("火", fit), ["heeshin"]); // 응답: 서 書(火) → ["heeshin"] — 많은 오행이지만 희신이라 excessive 없음
  assert.deepEqual(rolesOf("金", fit), ["lacking"]); // 응답: 서 瑞(金) → ["lacking"]
  assert.deepEqual(rolesOf("木", fit), ["gishin", "excessive"]);
  assert.deepEqual(rolesOf("水", fit), ["lacking"]);

  // 기신이면서 부족한 오행 — 둘 다 붙는다(조화 노트 '기신 … — 사주에 부족한 오행이라 감점 일부 상쇄')
  const gishinLacking = { yongshin: "水", heeshin: "金", gishin: "土", lacking: ["土"], excessive: ["水", "火"], counts: {} };
  assert.deepEqual(rolesOf("土", gishinLacking), ["gishin", "lacking"]);
  assert.deepEqual(rolesOf("水", gishinLacking), ["yongshin"]); // 용신은 많아도 excessive 없음
  assert.deepEqual(rolesOf("火", gishinLacking), ["excessive"]);
  assert.deepEqual(rolesOf("金", gishinLacking), ["heeshin"]);
  assert.deepEqual(rolesOf("木", gishinLacking), []);

  // 용신을 구하지 못한 응답 — 세 값이 null, 부족·많음만
  const noYongshin = { yongshin: null, heeshin: null, gishin: null, lacking: ["水"], excessive: ["火"], counts: {} };
  assert.deepEqual(rolesOf("水", noYongshin), ["lacking"]);
  assert.deepEqual(rolesOf("火", noYongshin), ["excessive"]);
  assert.deepEqual(rolesOf("木", noYongshin), []);

  // 자원오행 미상·출생일 없음
  assert.deepEqual(rolesOf("", fit), []);
  assert.deepEqual(rolesOf(null, fit), []);
  assert.deepEqual(rolesOf(undefined, fit), []);
  assert.deepEqual(rolesOf("木", null), []);
  assert.deepEqual(rolesOf("木", undefined), []);
});

test("lib/hanja-pick.ts 도 같은 rolesOf 를 내보낸다(설계 §8-1 의 자리)", async () => {
  const pick = await import("../src/lib/hanja-pick.ts");
  assert.equal(pick.rolesOf, rolesOf);
});
