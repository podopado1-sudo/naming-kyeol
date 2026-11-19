// 출생지 목록 대조 테스트 — `npm test`
//
// 2026-11 /ohaeng(부족한 오행 찾기, 설계 docs/plan-ohaeng-2026-11.md §6-1): 백엔드에 출생지 목록 API 가 없어 lib/birthplaces.ts 에 복사해 두었다.
// 백엔드 Application/Engines/Data/BirthplaceData.cs 를 읽어 코드·이름·순서와 진태양시 보정 분(Math.round((경도 − 135) × 4) — 응답 correctionMinutes 는
// C# (int)Math.Round)이 같은지 본다. 프런트 테스트가 백엔드 파일을 읽는 것은 note-polarity·parent-naming 테스트와 같은 관례다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { BIRTHPLACES, DEFAULT_BIRTHPLACE_CODE, birthplaceByCode, correctionRange } from "../src/lib/birthplaces.ts";

const CS = readFileSync(
  fileURLToPath(new URL("../../Application/Engines/Data/BirthplaceData.cs", import.meta.url)),
  "utf8",
);

/** BirthplaceData.Birthplaces 배열 — new("seoul", "서울", 126.98) 줄들 */
function backendBirthplaces() {
  const block = /BirthplaceInfo\[\] Birthplaces\s*=\s*\[([\s\S]*?)\];/.exec(CS);
  assert.ok(block, "BirthplaceData.Birthplaces 를 찾지 못했다");
  const rows = [...block[1].matchAll(/new\(\s*"([a-z]+)",\s*"([^"]+)",\s*([\d.]+)\s*\)/g)].map(([, code, name, lng]) => ({
    code,
    name,
    longitude: Number(lng),
  }));
  assert.ok(rows.length >= 17, `출생지가 너무 적다: ${rows.length}`);
  return rows;
}

test("코드·이름·순서가 백엔드 BirthplaceData 와 같다", () => {
  const be = backendBirthplaces();
  assert.deepEqual(
    BIRTHPLACES.map((b) => [b.code, b.name]),
    be.map((b) => [b.code, b.name]),
  );
});

test("보정 분 = round((경도 − 135) × 4) — 응답 correctionMinutes 와 같은 값", (t) => {
  for (const b of backendBirthplaces()) {
    const raw = (b.longitude - 135) * 4;
    // .5 에 걸리면 C# Math.Round(은행가 반올림)와 JS Math.round 가 갈린다 — 지금 17개는 하나도 걸리지 않는다
    assert.ok(Math.abs(Math.abs(raw % 1) - 0.5) > 1e-6, `${b.code} ${raw} 가 .5 — 반올림 규칙을 다시 볼 것`);
    const expected = Math.round(raw);
    t.diagnostic(`${b.code} ${b.longitude}° → ${raw.toFixed(2)} → ${expected}분`);
    assert.equal(birthplaceByCode(b.code)?.correctionMinutes, expected, b.code);
  }
});

test("기본 출생지는 서울(BirthplaceData.Default) · 설명 글의 보정 범위 23~34분", () => {
  assert.match(CS, /Default\s*=\s*Birthplaces\.First\(b => b\.Code == "seoul"\)/);
  assert.equal(DEFAULT_BIRTHPLACE_CODE, "seoul");
  assert.equal(birthplaceByCode("seoul")?.name, "서울");
  assert.equal(birthplaceByCode("mars"), undefined);
  // 설명 글(OhaengGuide)이 '서울 32·부산 24·제주 34, 17개 시·도 모두 23~34분'으로 쓴다 — 값은 이 목록에서 읽는다
  assert.deepEqual(correctionRange(), { min: 23, max: 34 });
  assert.deepEqual(
    ["seoul", "busan", "jeju"].map((c) => birthplaceByCode(c)?.correctionMinutes),
    [-32, -24, -34],
  );
  assert.equal(BIRTHPLACES.length, 17);
});
