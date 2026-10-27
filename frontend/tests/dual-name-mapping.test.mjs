// /dual-name 영어 음절 칩·매핑 줄 분할 테스트 — `npm test` (= node --test "tests/*.test.mjs", Node 22.18+)
//
// 2026-10-27: ceil(글자 수/음절 수)씩 자르던 분할이 음절보다 적은 조각을 내서(Ryan→라이언 [Ry, an]) 매핑 줄 끝에
// 화살표 왼쪽이 빈 '·  ↔ 언(…)'이 찍히고 영어 칩이 한국어 칩보다 하나 적었다. 지키는 계약:
//   ① 글자 수 ≥ 음절 수면 정확히 음절 수만큼, 빈 조각 없이, 이어 붙이면 원래 이름
//   ② 예전 분할이 이미 음절 수만큼 내던 이름은 한 글자도 바뀌지 않는다(Michael [Mic, hae, l])
//   ③ 글자 수 < 음절 수면 매핑 줄을 숨긴다(빈 문자열)
// 기대값 표는 손으로 정했다. 매핑 표 전수 검사는 백엔드가 이중 이름에 싣는 data/english_korean_names.json 을 읽는다
// (DualNameEngine 은 영어 이름을 이 표의 English 그대로 돌려준다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildMappingNote,
  splitEnglishToSyllables,
} from "../src/lib/dual-name-mapping.ts";

/** [영어, 한글, 기대 조각] — 예전 분할이 음절보다 적게 내던 이름 */
const FIXED = [
  ["Ryan", "라이언", ["Ry", "a", "n"]],
  ["Aria", "아리아", ["Ar", "i", "a"]],
  ["Alex", "알렉스", ["Al", "e", "x"]],
  ["Olivia", "올리비아", ["Ol", "iv", "i", "a"]],
  ["Diana", "다이아나", ["Di", "a", "n", "a"]],
  ["Brian", "브라이언", ["Br", "i", "a", "n"]],
  ["Grace", "그레이스", ["Gr", "a", "c", "e"]],
  ["Edward", "에드워드", ["Ed", "wa", "r", "d"]],
  ["Christine", "크리스틴", ["Chr", "is", "ti", "ne"]],
  ["Adrian", "에이드리안", ["Ad", "r", "i", "a", "n"]],
  ["Christopher", "크리스토퍼", ["Chr", "is", "to", "ph", "er"]],
];

/** [영어, 한글, 기대 조각] — 예전 분할 그대로 남는 이름 */
const UNCHANGED = [
  ["Ryan", "리안", ["Ry", "an"]],
  ["Philip", "필립", ["Phi", "lip"]],
  ["Daniel", "다니엘", ["Da", "ni", "el"]],
  ["Michael", "마이클", ["Mic", "hae", "l"]],
  ["Jessica", "제시카", ["Jes", "sic", "a"]],
  ["William", "윌리엄", ["Wil", "lia", "m"]],
];

for (const [eng, ko, parts] of [...FIXED, ...UNCHANGED]) {
  test(`splitEnglishToSyllables(${eng}, ${ko}) → [${parts.join(", ")}]`, () => {
    assert.deepEqual(splitEnglishToSyllables(eng, [...ko].length), parts);
  });
}

test("빈 영어 이름은 조각 없음, 1음절은 통째로", () => {
  assert.deepEqual(splitEnglishToSyllables("", 3), []);
  assert.deepEqual(splitEnglishToSyllables("Jin", 1), ["Jin"]);
});

test("글자 수 < 음절 수면 나누지 않고 한 칩, 매핑 줄은 숨긴다", () => {
  assert.deepEqual(splitEnglishToSyllables("Al", 3), ["Al"]);
  assert.equal(
    buildMappingNote({
      englishEquivalent: "Al",
      koreanName: "알렉스",
      hanjaCharacters: ["甲", "乙", "丙"],
    }),
    ""
  );
});

test("매핑 줄 — 음절마다 영어 조각이 있고 빈 화살표가 없다 (Olivia → 올리비아)", () => {
  assert.equal(
    buildMappingNote({
      englishEquivalent: "Olivia",
      koreanName: "올리비아",
      hanjaCharacters: ["甲", "乙", "丙", "丁"],
    }),
    "Ol ↔ 올(甲) · iv ↔ 리(乙) · i ↔ 비(丙) · a ↔ 아(丁)"
  );
});

test("매핑 줄 — 한자가 없는 음절은 괄호 없이, 한자가 하나도 없으면 줄 없음", () => {
  assert.equal(
    buildMappingNote({
      englishEquivalent: "Ryan",
      koreanName: "라이언",
      hanjaCharacters: ["甲", "乙"],
    }),
    "Ry ↔ 라(甲) · a ↔ 이(乙) · n ↔ 언"
  );
  assert.equal(
    buildMappingNote({
      englishEquivalent: "Ryan",
      koreanName: "라이언",
      hanjaCharacters: [],
    }),
    ""
  );
});

/** 예전 규칙 — 바뀌지 않아야 할 이름을 고르는 기준 */
function oldSplit(eng, k) {
  if (!eng) return [];
  if (k <= 1) return [eng];
  const size = Math.ceil(eng.length / k);
  const out = [];
  for (let i = 0; i < eng.length; i += size) out.push(eng.slice(i, i + size));
  return out;
}

test("매핑 표 전수 — 음절 수만큼 빈 조각 없이, 예전 분할이 맞던 이름은 그대로", () => {
  const path = fileURLToPath(
    new URL("../../data/english_korean_names.json", import.meta.url)
  );
  const entries = JSON.parse(readFileSync(path, "utf8"));
  let pairs = 0;
  let kept = 0;
  for (const { english, korean } of entries) {
    for (const ko of korean) {
      pairs++;
      const k = [...ko].length;
      const label = `${english} → ${ko}`;
      const hanjaCharacters = [...ko].map(() => "甲");
      if (english.length < k) {
        // 지금 표에는 없다(2026-10-27) — 생기면 한 칩 + 매핑 줄 없음
        assert.deepEqual(splitEnglishToSyllables(english, k), [english], label);
        assert.equal(
          buildMappingNote({ englishEquivalent: english, koreanName: ko, hanjaCharacters }),
          "",
          label
        );
        continue;
      }
      const parts = splitEnglishToSyllables(english, k);
      assert.equal(parts.length, k, label);
      assert.ok(parts.every((p) => p.length > 0), label);
      assert.equal(parts.join(""), english, label);
      const old = oldSplit(english, k);
      if (old.length === k) {
        assert.deepEqual(parts, old, `${label}: 예전 분할과 달라짐`);
        kept++;
      }
      const note = buildMappingNote({
        englishEquivalent: english,
        koreanName: ko,
        hanjaCharacters,
      });
      const segs = note.split(" · ");
      assert.equal(segs.length, k, label);
      assert.ok(segs.every((s) => /^\S+ ↔ /.test(s)), `${label}: ${note}`);
    }
  }
  assert.ok(pairs > 100, `매핑 표가 비었거나 잘못 읽힘 (${pairs}쌍)`);
  assert.ok(kept > 0 && kept < pairs, `예전 분할 유지 ${kept}/${pairs}`);
});
