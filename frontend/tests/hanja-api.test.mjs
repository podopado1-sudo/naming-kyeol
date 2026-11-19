// 한자 입력의 API 층 테스트 — `npm test`
//
// 2026-11 한자 입력(docs/plan-hanja-input-2026-11.md §4-4·§4-5·§8-1):
// - /evaluate 의 400 본문 { error, code, target, slot } 에서 세 값을 ApiError 에 싣는다 — 화면이 틀린 칸을 열 수 있게.
//   slot 이 -1 이면 칸 하나의 문제가 아니다(그 값도 그대로 싣는다). 프레임워크의 ProblemDetails(영문)에는 세 값이 없다.
// - hanjaResolve 는 POST 본문으로 보낸다(주소에 글자·음절을 싣지 않는다).
// 본문은 2026-11-19 로컬 서버가 실제로 돌려준 응답을 옮긴 것이다. fetch 만 가짜로 바꿔 lib/api.ts 의 실제 경로를 탄다.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const { ApiError, evaluate, hanjaResolve } = await import("../src/lib/api.ts");

const U = (...codes) => String.fromCodePoint(...codes);
const SEO = U(0x745e);
const YUN = U(0x6f64);
const RIM = U(0x6797);

const realFetch = globalThis.fetch;
const calls = [];

/** 다음 요청에 이 응답을 돌려준다 */
function respondWith(status, body) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
  calls.length = 0;
});

async function failure(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  assert.fail("오류가 나야 한다");
}

test("400 본문의 code·target·slot 을 ApiError 에 싣는다 — 문장은 error 그대로", async () => {
  const message = `‘${YUN}’ 글자의 인명용 독음(윤)이 ‘서’ 칸과 맞지 않아요. ‘서’ 음절로 읽는 한자를 넣어 주세요.`;
  respondWith(400, { error: message, code: "reading_mismatch", target: "name", slot: 0 });
  const err = await failure(evaluate({ name: "서윤", lastName: "이", nameHanja: `${YUN}*` }));
  assert.ok(err instanceof ApiError);
  assert.ok(err instanceof Error);
  assert.equal(err.message, message);
  assert.equal(err.status, 400);
  assert.equal(err.code, "reading_mismatch");
  assert.equal(err.target, "name");
  assert.equal(err.slot, 0);
});

test("칸 하나의 문제가 아닌 오류는 slot -1 그대로 — 화면은 칸을 열지 않고 문장만 띄운다", async () => {
  respondWith(400, { error: "이름 한자는 이름 글자 수만큼 넣어 주세요.", code: "name_hanja_count", target: "name", slot: -1 });
  const count = await failure(evaluate({ name: "서윤", lastName: "이", nameHanja: SEO + YUN + YUN }));
  assert.equal(count.message, "이름 한자는 이름 글자 수만큼 넣어 주세요.");
  assert.deepEqual([count.code, count.target, count.slot], ["name_hanja_count", "name", -1]);

  respondWith(400, { error: "성씨에는 ‘한자 없음’을 고를 수 없어요. 비워 두면 기본으로 두는 성씨 한자로 계산해요.", code: "surname_none", target: "surname", slot: 0 });
  const surname = await failure(evaluate({ name: "서윤", lastName: "이", lastNameHanja: "-" }));
  assert.deepEqual([surname.code, surname.target, surname.slot], ["surname_none", "surname", 0]);
});

test("세 값이 없는 400(프레임워크의 ProblemDetails·다른 엔드포인트)에서는 싣지 않는다 — 문장은 예전 규칙 그대로", async () => {
  // 홀로 남은 서로게이트가 든 본문에 서버가 돌려준 꼴(영문) — 화면에는 일반 문구
  respondWith(400, {
    type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
    title: "One or more validation errors occurred.",
    status: 400,
    errors: { request: ["The request field is required."], "$.nameHanja": ["The JSON value could not be converted to System.String."] },
  });
  const framework = await failure(evaluate({ name: "서윤", lastName: "이" }));
  assert.equal(framework.message, "요청을 처리하지 못했어요. 입력한 내용을 확인하고 다시 시도해 주세요.");
  assert.deepEqual([framework.code, framework.target, framework.slot], [undefined, undefined, undefined]);

  // 모델 검증의 한국어 문구는 그대로 띄운다
  respondWith(400, { errors: { Text: ["한자 한 글자를 넣어 주세요."] }, status: 400 });
  const model = await failure(hanjaResolve({ text: "", syllable: "서" }));
  assert.equal(model.message, "한자 한 글자를 넣어 주세요.");
  assert.equal(model.code, undefined);

  // 컨트롤러 검증 { error } 뿐인 본문
  respondWith(400, { error: "음절은 한글 한 글자로 넣어 주세요." });
  const plain = await failure(hanjaResolve({ text: SEO, syllable: "ㅅ" }));
  assert.equal(plain.message, "음절은 한글 한 글자로 넣어 주세요.");
  assert.deepEqual([plain.code, plain.target, plain.slot], [undefined, undefined, undefined]);

  // 값의 꼴이 다르면 싣지 않는다
  respondWith(400, { error: "한글 문장", code: 7, target: "middle", slot: "0" });
  const odd = await failure(evaluate({ name: "서윤", lastName: "이" }));
  assert.deepEqual([odd.code, odd.target, odd.slot], [undefined, undefined, undefined]);
  respondWith(400, { error: "한글 문장", code: "x", target: "surname", slot: 1.5 });
  const fraction = await failure(evaluate({ name: "서윤", lastName: "이" }));
  assert.deepEqual([fraction.code, fraction.target, fraction.slot], ["x", "surname", undefined]);

  // JSON 이 아닌 본문
  respondWith(400, "<html>Bad Request</html>");
  const html = await failure(evaluate({ name: "서윤", lastName: "이" }));
  assert.equal(html.status, 400);
  assert.equal(html.code, undefined);
});

test("400 이 아닌 오류에는 본문에 값이 있어도 싣지 않는다 — 429·500 은 전용 문구", async () => {
  respondWith(429, { error: "x", code: "reading_mismatch", target: "name", slot: 0 });
  const limited = await failure(evaluate({ name: "서윤", lastName: "이", nameHanja: `${SEO}*` }));
  assert.equal(limited.status, 429);
  assert.equal(limited.message, "요청이 잠시 몰렸어요. 1분쯤 뒤에 다시 시도해 주세요.");
  assert.deepEqual([limited.code, limited.target, limited.slot], [undefined, undefined, undefined]);

  respondWith(500, { error: "한자 확인 중 오류가 발생했습니다.", code: "x", slot: 0 });
  const server = await failure(hanjaResolve({ text: SEO, syllable: "서" }));
  assert.equal(server.status, 500);
  assert.equal(server.message, "서버에서 잠시 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
  assert.equal(server.slot, undefined);
});

test("ApiError: 세 값 없이 만들던 자리는 그대로 돈다", () => {
  const err = new ApiError("문장", 0);
  assert.equal(err.name, "ApiError");
  assert.equal(err.message, "문장");
  assert.equal(err.status, 0);
  assert.deepEqual([err.code, err.target, err.slot], [undefined, undefined, undefined]);
});

test("hanjaResolve: POST 본문으로 보내고 응답을 그대로 돌려준다", async () => {
  const body = {
    status: "ok",
    character: RIM,
    hanja: { character: RIM, gloss: "수풀 림(임)", fiveElement: "木", resourceGrade: "R", vReasons: [], strokeCount: 8, yinYang: "陰", common: true, forbidden: false, hasMeaning: true, basic: true },
    acceptedSyllables: ["림", "임"],
    message: null,
    suggestion: null,
  };
  respondWith(200, body);
  const result = await hanjaResolve({ text: RIM, syllable: "임", target: "surname" });
  assert.deepEqual(result, body);

  assert.equal(calls.length, 1);
  const [{ url, init }] = calls;
  assert.ok(url.endsWith("/hanja/resolve"), url);
  assert.ok(!url.includes("?"), "글자·음절을 주소에 싣지 않는다");
  assert.equal(init.method, "POST");
  assert.equal(init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(init.body), { text: RIM, syllable: "임", target: "surname" });
});

test("evaluate: 한자 필드는 요청 본문에 그대로 실린다", async () => {
  respondWith(200, { fullName: "이서윤" });
  await evaluate({ name: "서윤", lastName: "이", nameHanja: `${SEO}*`, lastNameHanja: "" });
  const [{ url, init }] = calls;
  assert.ok(url.endsWith("/recommendations/evaluate"), url);
  assert.deepEqual(JSON.parse(init.body), { name: "서윤", lastName: "이", nameHanja: `${SEO}*`, lastNameHanja: "" });
});

test("lib/api.ts: request() 의 꼴은 그대로, 한자 필드의 한글 이름이 표에 있다", () => {
  const src = readFileSync(fileURLToPath(new URL("../src/lib/api.ts", import.meta.url)), "utf8");
  assert.match(src, /function request<T>\(endpoint: string, body: unknown\)[\s\S]*?method: "POST"[\s\S]*?body: JSON\.stringify\(body\)/);
  assert.match(src, /export function hanjaResolve\([\s\S]*?\{\s*return request\("\/hanja\/resolve", req\);\s*\}/);
  assert.match(src, /namehanja: "이름 한자",/);
  assert.match(src, /lastnamehanja: "성씨 한자",/);
});
