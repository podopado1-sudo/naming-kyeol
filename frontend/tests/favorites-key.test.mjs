// 저장한 이름(즐겨찾기)의 키 테스트 — `npm test`
//
// 2026-11 한자 입력(docs/plan-hanja-input-2026-11.md §10-2·§13-3): 같은 이름·같은 생년월일이라도 고른 한자 조합이 다르면 따로 저장된다.
// - 한자를 고르지 않은 저장분의 키는 예전 그대로(`이름|생년월일`) — 옛 저장분을 옮길 것이 없다.
// - 추천 결과 화면(SmartResult)은 한자 없이 부른다 — 그 호출이 한자를 고른 저장분을 건드리지 않아야 한다.
// lib/favorites.ts 는 브라우저 저장소(localStorage)를 쓰므로 가짜 window 를 세워 실제 저장·읽기 경로로 확인한다.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import "./resolve-ts.mjs";

const STORAGE_KEY = "nameform:favorites:v1";

/** 가짜 브라우저 저장소 — 모듈을 읽기 전에 세운다 */
const store = new Map();
const events = [];
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
  },
  dispatchEvent: (event) => {
    events.push(event.type);
    return true;
  },
  addEventListener() {},
  removeEventListener() {},
};

const { addFavorite, favoriteKey, isFavorite, removeFavorite, toggleFavorite } = await import("../src/lib/favorites.ts");

const U = (...codes) => String.fromCodePoint(...codes);
const SEO = U(0x745e); // 상서 서
const YUN = U(0x6f64); // 윤택할 윤
const SEO_OTHER = U(0x66f8); // 글 서
const LIU = U(0x5289);

const saved = () => JSON.parse(store.get(STORAGE_KEY) ?? "[]");
const base = { fullName: "유서윤", lastName: "유", name: "서윤", birthDate: "2025-03-02", gender: "female", tone: "neutral" };

beforeEach(() => {
  store.clear();
  events.length = 0;
});

test("favoriteKey: 한자가 없으면 옛 키 그대로, 있으면 한자 조합이 붙는다", () => {
  // 옛 키 — 이름|생년월일
  assert.equal(favoriteKey({ fullName: "유서윤", birthDate: "2025-03-02" }), "유서윤|2025-03-02");
  assert.equal(favoriteKey({ fullName: "유서윤" }), "유서윤|");
  assert.equal(favoriteKey({ fullName: "유서윤", birthDate: "2025-03-02", hanja: "", lastHanja: "" }), "유서윤|2025-03-02");
  assert.equal(favoriteKey({ fullName: "유서윤", birthDate: "2025-03-02", hanja: undefined, lastHanja: undefined }), "유서윤|2025-03-02");
  // 한자 조합
  assert.equal(favoriteKey({ fullName: "유서윤", birthDate: "2025-03-02", hanja: SEO + YUN }), `유서윤|2025-03-02|${SEO}${YUN}|`);
  assert.equal(favoriteKey({ fullName: "유서윤", birthDate: "2025-03-02", lastHanja: LIU }), `유서윤|2025-03-02||${LIU}`);
  assert.equal(favoriteKey({ fullName: "유서윤", hanja: SEO, lastHanja: LIU }), `유서윤||${SEO}|${LIU}`);
  // 이름 한자와 성씨 한자는 자리가 다르다
  assert.notEqual(favoriteKey({ fullName: "유서윤", hanja: LIU }), favoriteKey({ fullName: "유서윤", lastHanja: LIU }));
});

test("같은 이름·같은 생년월일의 두 한자 조합이 함께 저장된다", () => {
  addFavorite({ ...base, hanja: SEO + YUN, finalScore: 80 });
  addFavorite({ ...base, hanja: SEO_OTHER + YUN, finalScore: 78 });
  addFavorite({ ...base, finalScore: 75 }); // 한자를 고르지 않은 평가도 따로
  assert.equal(saved().length, 3);
  assert.deepEqual(saved().map((f) => f.hanja ?? null), [null, SEO_OTHER + YUN, SEO + YUN]); // 새 것이 앞

  // 같은 조합을 다시 저장하면 늘지 않는다
  addFavorite({ ...base, hanja: SEO + YUN, finalScore: 81 });
  assert.equal(saved().length, 3);

  assert.equal(isFavorite("유서윤", "2025-03-02", SEO + YUN), true);
  assert.equal(isFavorite("유서윤", "2025-03-02", SEO_OTHER + YUN), true);
  assert.equal(isFavorite("유서윤", "2025-03-02"), true);
  assert.equal(isFavorite("유서윤", "2025-03-02", SEO), false); // 둘째 칸이 자동인 조합은 다른 조합
  assert.equal(isFavorite("유서윤", "2025-03-02", SEO + YUN, LIU), false); // 성씨 한자가 다르면 다른 조합
  assert.equal(isFavorite("유서윤", "2024-01-01", SEO + YUN), false);

  // 하나만 지운다
  removeFavorite("유서윤", "2025-03-02", SEO + YUN);
  assert.deepEqual(saved().map((f) => f.hanja ?? null), [null, SEO_OTHER + YUN]);
  // 한자 없이 지우면 한자 없는 저장분만 지운다(추천 결과 화면의 호출 꼴)
  removeFavorite("유서윤", "2025-03-02");
  assert.deepEqual(saved().map((f) => f.hanja ?? null), [SEO_OTHER + YUN]);
  assert.ok(events.every((type) => type === "nameform:favorites:changed"));
});

test("toggleFavorite: 그 조합만 켜고 끈다", () => {
  toggleFavorite({ ...base, hanja: SEO + YUN });
  toggleFavorite({ ...base, hanja: SEO_OTHER + YUN, lastHanja: LIU });
  assert.equal(saved().length, 2);
  toggleFavorite({ ...base, hanja: SEO + YUN }); // 끄기
  assert.deepEqual(saved().map((f) => [f.hanja, f.lastHanja ?? null]), [[SEO_OTHER + YUN, LIU]]);
  toggleFavorite({ ...base }); // 한자 없는 조합은 새로 켜진다
  assert.equal(saved().length, 2);
  toggleFavorite({ ...base, hanja: SEO_OTHER + YUN, lastHanja: LIU });
  assert.deepEqual(saved().map((f) => f.hanja ?? null), [null]);
});

test("옛 저장분(한자 필드 없음)이 그대로 읽히고 예전 호출 꼴로 지워진다", () => {
  // 한자 입력 전에 저장된 꼴 그대로
  const legacy = [
    { fullName: "김서준", lastName: "김", name: "서준", birthDate: "2022-03-03", gender: "male", tone: "neutral", finalScore: 82, aestheticScore: 84, harmonyScore: 77, savedAt: "2026-10-01T00:00:00.000Z" },
    { fullName: "남궁민", lastName: "남궁", name: "민", savedAt: "2026-09-01T00:00:00.000Z" },
  ];
  store.set(STORAGE_KEY, JSON.stringify(legacy));

  assert.equal(isFavorite("김서준", "2022-03-03"), true);
  assert.equal(isFavorite("남궁민"), true);
  assert.equal(isFavorite("남궁민", undefined), true);
  assert.equal(isFavorite("김서준"), false); // 생년월일이 다르면 다른 항목(예전과 같다)
  assert.equal(isFavorite("김서준", "2022-03-03", SEO), false); // 한자를 고른 조합은 옛 저장분과 다른 항목
  assert.equal(favoriteKey(legacy[0]), "김서준|2022-03-03");
  assert.equal(favoriteKey(legacy[1]), "남궁민|");

  // 옛 저장분 옆에 같은 이름의 한자 조합을 더해도 옛 것은 그대로다
  addFavorite({ fullName: "김서준", lastName: "김", name: "서준", birthDate: "2022-03-03", hanja: SEO });
  assert.equal(saved().length, 3);
  assert.deepEqual(saved().slice(1), legacy);

  removeFavorite("김서준", "2022-03-03");
  assert.deepEqual(saved().map((f) => [f.fullName, f.hanja ?? null]), [["김서준", SEO], ["남궁민", null]]);
});

test("최대 100개 — 한자 조합을 더해도 그대로", () => {
  for (let i = 0; i < 105; i++) addFavorite({ fullName: `이름${i}`, lastName: "이", name: `름${i}`, hanja: SEO });
  assert.equal(saved().length, 100);
  assert.equal(saved()[0].fullName, "이름104");
});
