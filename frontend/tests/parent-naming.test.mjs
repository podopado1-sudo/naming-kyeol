// 부모 기반 결과 화면의 칩 분류·태그 — `npm test`
//
// 2026-10-28: 옛 분류는 nameType 의 '음운'·'의미' 부분 문자열만 봐서 '가족 서사형' 칩이 코드상 나올 수 없었고,
// 태그에는 방식 값(실존 인물로 보일 수 있는 '…모델' 이름)이 그대로 떴다. 지금은 백엔드 중립 코드 → 칩 표, 태그는 사용자 라벨 하나.
// 기대값은 손으로 정한 표다. 코드 목록은 백엔드 ParentNamingModels 상수와 같아야 한다(아래 대조).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PARENT_MODEL_LINEAGE, keywordHasHangul, parentLineage, parentTags } from "../src/lib/parent-naming.ts";

const CASES = [
  // [namingModel, nameType, 칩]
  ["family-meaning", "의미중심", "semantic"],
  ["parent-syllables", "음운중심", "phonetic"],
  ["mother-surname", "음운중심", "phonetic"],
  ["mother-sound", "음운중심", "phonetic"],
  ["shared-syllable", "서사중심", "narrative"],
  ["keyword-meaning", "서사중심", "narrative"],
  // 예비 경로 코드(2026-10-28 — 부모 이름의 첫 글자 밖 글자 + 실명 짝 글자)
  ["father-syllable", "음운중심", "phonetic"],
  ["mother-syllable", "음운중심", "phonetic"],
  // 모르는 코드(옛 응답)는 nameType 부분 문자열로 — '서사중심'은 가족 서사형
  ["unknown-code", "음운중심", "phonetic"],
  ["unknown-code", "의미중심", "semantic"],
  ["unknown-code", "서사중심", "narrative"],
  [undefined, undefined, "narrative"],
];

for (const [code, nameType, expected] of CASES) {
  test(`parentLineage(${code}, ${nameType}) → ${expected}`, () => {
    assert.equal(parentLineage(code, nameType), expected);
  });
}

test("태그는 사용자 라벨 하나 — 라벨이 없으면(옛 응답) 비운다", () => {
  assert.deepEqual(parentTags("어머니 성씨 잇기"), ["어머니 성씨 잇기"]);
  assert.deepEqual(parentTags(undefined), []);
  assert.deepEqual(parentTags(""), []);
});

test("코드 표가 백엔드 ParentNamingModels 의 코드·계승 꼴과 같다", () => {
  const path = fileURLToPath(new URL("../../Application/Engines/IParentBasedNamingEngine.cs", import.meta.url));
  const cs = readFileSync(path, "utf8");
  const consts = Object.fromEntries([...cs.matchAll(/public const string (\w+) = "([^"]+)";/g)].map((m) => [m[1], m[2]]));
  const lineageOf = { Phonetic: "phonetic", Semantic: "semantic", Narrative: "narrative" };
  const backend = {};
  for (const m of cs.matchAll(/\[(\w+)\] = \("[^"]+", (Phonetic|Semantic|Narrative)\)/g)) {
    backend[consts[m[1]]] = lineageOf[m[2]];
  }
  assert.ok(Object.keys(backend).length >= 10, "ParentNamingModels.Info 를 읽지 못했다");
  assert.deepEqual({ ...PARENT_MODEL_LINEAGE }, backend);
});

// 한글 없는 키워드는 백엔드가 아무 후보도 만들지 못한다(2026-10-28 검증 — 'tree'·'Love'·'123' 0개) — 폼이 제출 전에 막는다
const KEYWORD_CASES = [
  ["사랑", true],
  ["신의 손", true],
  ["바다처럼", true],
  ["love 사랑", true],
  ["tree", false],
  ["Love", false],
  ["123", false],
  ["ㅋㅋ", false], // 자모만 — 음절이 아니다
  ["", false],
];
for (const [kw, expected] of KEYWORD_CASES) {
  test(`keywordHasHangul(${JSON.stringify(kw)}) → ${expected}`, () => {
    assert.equal(keywordHasHangul(kw), expected);
  });
}

// 부모 이름 뜻 잇기 배너 — 음절마다 그 음절을 준 부모(2026-10-28 2차 검증: 두 부모 이름에 다 있는 음절을 아버지 글자로 칠했다).
// 기대값은 설명 문장(백엔드 FamilyMeaning 꼴)을 손으로 읽은 값이다
test("familyMeaningRoles — 두 부모 이름에 다 있는 음절은 설명이 말한 부모", async () => {
  const { familyMeaningRoles } = await import("../src/lib/parent-naming.ts");
  // 아버지 민수 + 어머니 수진 → '수민' — 설명은 어머니의 '수', 아버지의 '민'
  const desc = "어머니 이름의 '수'를 '빼어날 수', 아버지 이름의 '민'을 '민첩할 민'으로 풀어 두 뜻을 함께 담은 이름";
  assert.deepEqual(familyMeaningRoles(desc, ["수", "민"], "민수", "수진"), ["mother", "father"]);
  // 설명 순서가 이름 순서와 같다 — 아버지 민수 + 어머니 서연 → '민서'
  const desc2 = "아버지 이름의 '민'을 '민첩할 민', 어머니 이름의 '서'를 '글 서'로 풀어 두 뜻을 함께 담은 이름";
  assert.deepEqual(familyMeaningRoles(desc2, ["민", "서"], "민수", "서연"), ["father", "mother"]);
  // 설명이 없거나 다른 꼴이면 이름 칸에서(아버지 먼저 — 옛 동작), 어디에도 없으면 null
  assert.deepEqual(familyMeaningRoles("", ["수", "민", "하"], "민수", "수진"), ["father", "father", null]);
});
