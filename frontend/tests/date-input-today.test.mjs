// 날짜 입력의 '오늘' 테스트 — `npm test`
//
// 2026-11-26: /evaluate 생년월일 칸(EvaluateInput DateInput)의 max 가 new Date().toISOString().slice(0, 10) — UTC 날짜 — 라
// 한국 시간 0~9시에는 max 가 어제가 되어 오늘 태어난 아기의 생년월일을 달력에서 고를 수 없었다.
// /ohaeng(OhaengClient)처럼 lib/ohaeng.ts 의 todayKst() 를 쓰게 고쳤다. 경계(KST 자정) 동작은 tests/ohaeng.test.mjs 가 본다 —
// 여기서는 화면 코드가 그 함수를 쓰는지, UTC 날짜로 '오늘'을 만드는 코드가 화면 쪽에 다시 들어오지 않는지를 본다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

import "./resolve-ts.mjs";

const { todayKst } = await import("../src/lib/ohaeng.ts");

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const read = (rel) => readFileSync(join(SRC, rel), "utf8");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test("EvaluateInput 생년월일 칸의 max 는 한국 시간 오늘(todayKst)이다", () => {
  const src = read("components/design/EvaluateInput.tsx");
  assert.match(src, /import \{ todayKst \} from "@\/lib\/ohaeng";/);
  assert.match(src, /useSyncExternalStore\(emptySubscribe, \(\) => todayKst\(\), \(\) => undefined\)/);
  assert.match(src, /max=\{today\}/);
  assert.doesNotMatch(src, /toISOString\(\)\.slice\(0, 10\)/);
});

test("화면 코드(app·components)에 UTC 날짜로 '오늘'을 만드는 코드가 없다", () => {
  const offenders = [];
  for (const file of [...walk(join(SRC, "app")), ...walk(join(SRC, "components"))]) {
    const text = readFileSync(file, "utf8");
    // new Date().toISOString().slice(0, 10) 꼴 — 시각을 더하지 않은 지금의 UTC 날짜
    if (/new Date\(\)\s*\.toISOString\(\)\s*\.(slice|substring)\(0,\s*10\)|new Date\(\)\s*\.toISOString\(\)\s*\.split\("T"\)/.test(text)) {
      offenders.push(relative(SRC, file));
    }
  }
  assert.deepEqual(offenders, []);
});

test("todayKst — 한국 시간 0~9시에는 UTC 날짜보다 하루 뒤다(고치기 전 max 가 어제였던 시간대)", () => {
  const at = Date.UTC(2026, 10, 25, 16, 0); // KST 2026-11-26 01:00
  assert.equal(new Date(at).toISOString().slice(0, 10), "2026-11-25"); // 옛 계산
  assert.equal(todayKst(at), "2026-11-26");
});
