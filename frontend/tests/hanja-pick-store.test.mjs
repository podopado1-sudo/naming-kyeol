// 음절 후보 파일 저장소(lib/hanja-pick-store.ts) 테스트 — `npm test`
//
// 2026-11 설계 docs/plan-hanja-input-2026-11.md §4-6·§8-6·§10-4. 저장소는 모듈 안에 한 벌이라 이 파일의 테스트는
// **순서대로** 돌며 상태를 이어 쓴다(색인을 받기 전 → 받은 뒤). fetch 는 가짜로 바꿔 부른 주소를 적는다 —
// 음절 파일의 주소에는 음절이 들어가므로(개인정보) '무엇을 받는가'가 이 모듈의 계약이다.
import { test } from "node:test";
import assert from "node:assert/strict";

import "./resolve-ts.mjs";

const calls = [];
/** 주소 → 응답을 정하는 함수. 테스트마다 바꿔 끼운다 */
let respond = () => ({ status: 404 });
globalThis.fetch = (url) => {
  calls.push(String(url));
  const plan = respond(String(url));
  if (plan instanceof Promise) return plan;
  if (plan.reject) return Promise.reject(new Error("offline"));
  return Promise.resolve({
    ok: plan.status >= 200 && plan.status < 300,
    status: plan.status,
    json: async () => plan.body,
  });
};

const { getPickSnapshot, requestPickFile, requestPickIndex } = await import("../src/lib/hanja-pick-store.ts");
const { HANJA_PICK_INDEX, syllableFile } = await import("../src/lib/hanja-pick.ts");

const U = (cp) => String.fromCodePoint(cp);
const entry = (character, gloss) => ({ character, gloss, fiveElement: "金", resourceGrade: "R", strokeCount: 13, yinYang: "陽", hasMeaning: true, basic: true });
const file = (syllable, ...entries) => ({ status: 200, body: { syllable, hanja: entries } });

test("처음에는 비어 있고, 아무것도 받지 않았다", () => {
  const snap = getPickSnapshot();
  assert.equal(snap.index, null);
  assert.equal(snap.indexFailed, false);
  assert.equal(snap.files.size, 0);
  assert.equal(snap.failed.size, 0);
  assert.deepEqual(calls, []);
});

test("한글 음절 한 글자가 아니면 받지 않는다 — 낱자모·빈 값·두 글자·한자로 주소를 만들지 않는다", async () => {
  for (const bad of ["", "ㅅ", "서윤", "a", U(0x745e), " "]) assert.equal(await requestPickFile(bad), null, JSON.stringify(bad));
  assert.deepEqual(calls, []);
});

test("음절 파일을 받는다 — 같은 음절을 동시에 불러도 요청은 하나, 받은 뒤에는 다시 받지 않는다", async () => {
  respond = (url) => (url === syllableFile("서") ? file("서", entry(U(0x745e), "상서 서"), entry(U(0x66f8), "글 서")) : { status: 500 });
  const before = getPickSnapshot();
  const [a, b] = await Promise.all([requestPickFile("서"), requestPickFile("서")]);
  assert.equal(a, b);
  assert.deepEqual(a.map((f) => f.character), [U(0x745e), U(0x66f8)]);
  assert.deepEqual(calls, ["/data/hanja-pick/v1/c11c.json"]);
  // 받은 줄은 HanjaFact 꼴로 채워진다(파일이 뺀 기본값은 false·[])
  assert.equal(a[0].common, false);
  assert.deepEqual(a[0].vReasons, []);
  assert.equal(a[0].hasMeaning, true);
  // 화면이 바뀐 것을 알 수 있게 스냅샷이 새 값이 된다(예전 스냅샷은 그대로다)
  const after = getPickSnapshot();
  assert.notEqual(after, before);
  assert.equal(before.files.size, 0);
  assert.equal(after.files.get("서"), a);
  assert.equal(await requestPickFile("서"), a);
  assert.equal(calls.length, 1);
});

test("404 는 '후보 파일이 없는 음절'이다 — 빈 목록으로 두고 실패로 치지 않는다", async () => {
  respond = () => ({ status: 404 });
  const none = await requestPickFile("빛");
  assert.deepEqual(none, []);
  assert.equal(getPickSnapshot().failed.has("빛"), false);
  assert.deepEqual(getPickSnapshot().files.get("빛"), []);
  assert.equal(calls.at(-1), syllableFile("빛"));
  const count = calls.length;
  await requestPickFile("빛");
  assert.equal(calls.length, count, "없다는 것을 안 음절은 다시 묻지 않는다");
});

test("연결 실패·깨진 응답은 실패로 남고, 다시 부르면 새로 받는다", async () => {
  respond = () => ({ reject: true });
  assert.equal(await requestPickFile("윤"), null);
  assert.equal(getPickSnapshot().failed.has("윤"), true);
  assert.equal(getPickSnapshot().files.has("윤"), false);

  respond = () => ({ status: 200, body: { nope: true } }); // 꼴이 다른 응답
  assert.equal(await requestPickFile("윤"), null);
  assert.equal(getPickSnapshot().failed.has("윤"), true);

  respond = () => ({ status: 503 });
  assert.equal(await requestPickFile("윤"), null);

  respond = () => file("윤", entry(U(0x6f64), "윤택할 윤"));
  const got = await requestPickFile("윤");
  assert.deepEqual(got.map((f) => f.character), [U(0x6f64)]);
  assert.equal(getPickSnapshot().failed.has("윤"), false, "받으면 실패 표시가 지워진다");
  assert.equal(calls.filter((u) => u === syllableFile("윤")).length, 4);
});

test("색인 — 실패하면 indexFailed, 다시 부르면 받는다. 받은 뒤에는 한 번만", async () => {
  respond = () => ({ reject: true });
  assert.equal(await requestPickIndex(), null);
  assert.equal(getPickSnapshot().indexFailed, true);
  assert.equal(getPickSnapshot().index, null);

  const index = {
    version: 1,
    counts: { characters: 9105, syllables: 489, pairs: 10027, forbidden: 991, common: 271 },
    syllables: { 서: { all: 61, usable: 60 }, 윤: { all: 32, usable: 30 }, 몰: { all: 2, usable: 0, autoEmpty: true }, 아: { all: 5, usable: 5 } },
    surnames: { 이: U(0x674e) },
  };
  respond = (url) => (url === HANJA_PICK_INDEX ? { status: 200, body: index } : { status: 404 });
  const [a, b] = await Promise.all([requestPickIndex(), requestPickIndex()]);
  assert.equal(a, b);
  assert.equal(a.counts.forbidden, 991);
  assert.equal(getPickSnapshot().index, a);
  assert.equal(getPickSnapshot().indexFailed, false);
  const count = calls.filter((u) => u === HANJA_PICK_INDEX).length;
  assert.equal(count, 2, "실패한 한 번 + 받은 한 번(동시에 부른 둘은 요청 하나)");
  await requestPickIndex();
  assert.equal(calls.filter((u) => u === HANJA_PICK_INDEX).length, count);
});

test("색인을 받은 뒤에는, 색인에 없는 음절의 파일을 받지 않는다(요청 주소에 그 음절이 남지 않는다)", async () => {
  const count = calls.length;
  assert.deepEqual(await requestPickFile("봄"), []);
  assert.deepEqual(await requestPickFile("쀍"), []);
  assert.equal(calls.length, count, "색인이 '없다'고 알려 준 음절은 서버에 묻지 않는다");
  assert.deepEqual(getPickSnapshot().files.get("봄"), []);
  // 색인에 있는 음절은 받는다
  respond = (url) => (url === syllableFile("아") ? file("아", entry(U(0x96c5), "맑을 아")) : { status: 404 });
  const got = await requestPickFile("아");
  assert.equal(got.length, 1);
  assert.equal(calls.at(-1), "/data/hanja-pick/v1/c544.json");
});

test("받은 주소는 색인과 음절 파일뿐이다 — 쿼리·다른 호스트·이름 전체가 없다", () => {
  assert.ok(calls.length > 0);
  for (const url of calls) {
    assert.match(url, /^\/data\/hanja-pick\/v1\/(index|[0-9a-f]{4})\.json$/, url);
  }
});
