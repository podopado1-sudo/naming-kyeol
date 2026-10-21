// splitFullName 표 테스트 — `npm test` (= node --test "tests/*.test.mjs", Node 22.18+ 의 TypeScript 타입 지우기로 .ts 를 바로 읽는다)
//
// .mjs 인 이유: tsconfig include 가 **/*.ts·**/*.mts 를 잡아서, .ts 확장자 import 가 든 테스트를
// .ts/.mts 로 두면 next build 타입 검사가 allowImportingTsExtensions 오류를 낸다.
// 기대값은 엔진 코드를 옮긴 것이 아니라 손으로 정한 사례표다(2026-10-21 검토 FE-EVAL-2·8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  COMPOUND_SURNAMES,
  ambiguousCompoundSurname,
  splitFullName,
} from "../src/lib/name-split.ts";

/** [입력, 성, 이름] */
const CASES = [
  // 1자 성
  ["김서준", "김", "서준"],
  ["  이하윤 ", "이", "하윤"],
  ["박지", "박", "지"],
  // 붙여 쓴 3자 — 복성이 대개 맞는 앞머리
  ["남궁민", "남궁", "민"],
  ["제갈량", "제갈", "량"],
  ["독고영", "독고", "영"],
  // 붙여 쓴 3자 — 1자 성 + 2자 이름이 더 흔한 앞머리 (황보·서문·강전·선우)
  ["황보라", "황", "보라"],
  ["서문희", "서", "문희"],
  ["강전우", "강", "전우"],
  ["선우진", "선", "우진"],
  ["선우현", "선", "우현"],
  ["선우빈", "선", "우빈"],
  ["선우리", "선", "우리"],
  // 4자 이상은 복성
  ["남궁서연", "남궁", "서연"],
  ["선우하늘", "선우", "하늘"],
  ["황보민준", "황보", "민준"],
  // 띄어 쓰면 그대로 (앞 단어가 1자이거나 복성일 때)
  ["선우 진", "선우", "진"],
  ["황보 람", "황보", "람"],
  ["남 궁민", "남", "궁민"],
  ["김 서준", "김", "서준"],
  // 2자인데 복성이 아닌 앞 단어 띄어쓰기는 오타로 보고 붙여 읽는다
  ["김서 준", "김", "서준"],
  // 빈 입력
  ["", "", ""],
  ["   ", "", ""],
];

for (const [input, lastName, name] of CASES) {
  test(`splitFullName(${JSON.stringify(input)}) → ${lastName} + ${name}`, () => {
    assert.deepEqual(splitFullName(input), { lastName, name });
  });
}

test("복성 목록이 백엔드 SurnameData.TwoCharSurnames 와 같다", () => {
  const path = fileURLToPath(
    new URL("../../Application/Engines/Data/SurnameData.cs", import.meta.url)
  );
  const cs = readFileSync(path, "utf8");
  const block = /TwoCharSurnames\s*=\s*new\(\)\s*\{([^}]*)\}/.exec(cs);
  assert.ok(block, "SurnameData.cs 에서 TwoCharSurnames 블록을 찾지 못했다");
  const backend = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...COMPOUND_SURNAMES].sort(), backend.sort());
});

// 홈 평가 입력의 "○○ 씨라면 띄어 써 주세요" 안내 대상 (검토 FTE-4) — [입력, 기대 복성 또는 null]
// 붙여 쓴 3자를 1자 성으로 읽었는데 앞 두 글자가 복성이기도 한 경우만 안내한다.
const HINT_CASES = [
  ["선우진", "선우"],
  ["황보라", "황보"],
  ["서문희", "서문"],
  ["강전우", "강전"],
  [" 선우현 ", "선우"],
  // 복성일 리 없는 앞머리 — 예전에는 성이 1자면 모두 '복성이면 띄어 써 주세요'가 붙었다
  ["김서준", null],
  ["이하윤", null],
  // 복성으로 읽은 입력·4자 이상(복성으로 읽음)·2자
  ["남궁민", null],
  ["선우하늘", null],
  ["선우", null],
  // 사용자가 띄어 써 경계를 정했다
  ["선 우진", null],
  ["선우 진", null],
  ["", null],
];

for (const [input, expected] of HINT_CASES) {
  test(`ambiguousCompoundSurname(${JSON.stringify(input)}) → ${expected}`, () => {
    assert.equal(ambiguousCompoundSurname(input), expected);
  });
}
