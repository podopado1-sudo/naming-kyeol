// /evaluate 입력 정규화·링크 왕복 테스트 — `npm test` (= node --test "tests/*.test.mjs", Node 22.18+)
//
// 지키는 계약(2026-10-21 검토 FE-EVAL-1·8): URL·폼 어느 입구로 들어온 입력이든
// evaluateHref 로 쓴 URL 을 다시 읽으면 같은 서명이 나와야 한다. 어긋나면 EvaluateClient 의
// watcher 가 '다른 입력'으로 보고 같은 평가를 한 번 더 돌린다(결과 깜빡임·사용량 2회).
//
// 2026-11 한자 입력(docs/plan-hanja-input-2026-11.md §10-1·§13-3): 같은 계약에 hanja·lastHanja 축을 더한다 —
// 한자만 달라도 다른 평가이고, 한자 없는 링크는 예전과 글자 그대로 같다(맨 아래 테스트들).
import { test } from "node:test";
import assert from "node:assert/strict";

// evaluate-params.ts 가 lib/hanja-pick 을 확장자 없는 상대 경로로 import 한다 — 훅을 건 뒤 동적 import 로 읽는다
import "./resolve-ts.mjs";

const {
  evaluateHref,
  inputFromParams,
  inputFromPayload,
  inputSignature,
  seedFromInput,
  seedFromParams,
} = await import("../src/app/evaluate/evaluate-params.ts");
const { apiHanjaFields, evaluateComboHref } = await import("../src/lib/hanja-pick.ts");

const readBack = (href) =>
  inputFromParams(new URLSearchParams(href.slice(href.indexOf("?") + 1)));

const BIRTH_DATES = ["", "2022-03-03"];
const BIRTH_TIMES = ["", "13:30"];
const GENDERS = [null, "male", "female", "none", "x"];
const TONES = [null, "soft", "strong", "neutral", "x"];

test("URL → 입력 → href → 입력 왕복에서 서명이 그대로다 (출생 시각만 있는 경우 포함)", () => {
  let n = 0;
  for (const birthDate of BIRTH_DATES)
    for (const birthTime of BIRTH_TIMES)
      for (const gender of GENDERS)
        for (const tone of TONES) {
          const p = new URLSearchParams({ lastName: "김", name: "서준" });
          if (birthDate) p.set("birthDate", birthDate);
          if (birthTime) p.set("birthTime", birthTime);
          if (gender) p.set("gender", gender);
          if (tone) p.set("tone", tone);
          const input = inputFromParams(p);
          const back = readBack(evaluateHref(input, { withBirth: true }));
          assert.equal(inputSignature(back), inputSignature(input), p.toString());
          n++;
        }
  assert.equal(n, 100);
});

test("폼 제출 → href → 입력 왕복에서 서명이 그대로다", () => {
  for (const birth of BIRTH_DATES)
    for (const birthTime of [...BIRTH_TIMES, undefined])
      for (const gender of ["남", "여", "중립", ""])
        for (const tone of ["부드러운", "중립", "강한", ""]) {
          const input = inputFromPayload({
            lastName: " 남궁 ",
            firstName: "민 ",
            birth,
            birthTime,
            gender,
            tone,
          });
          const back = readBack(evaluateHref(input, { withBirth: true }));
          assert.equal(inputSignature(back), inputSignature(input));
        }
});

test("생년월일 없는 출생 시각은 버린다 — URL·폼·시드 세 입구 모두", () => {
  const p = new URLSearchParams("lastName=김&name=서준&birthTime=13:30");
  assert.equal(inputFromParams(p).birthTime, "");
  assert.equal(seedFromParams(p).birthTime, "");
  const fromForm = inputFromPayload({
    lastName: "김",
    firstName: "서준",
    birth: "",
    birthTime: "13:30",
    gender: "",
    tone: "",
  });
  assert.equal(fromForm.birthTime, "");
  // 날짜가 있으면 시각을 살린다
  const withDate = new URLSearchParams(
    "lastName=김&name=서준&birthDate=2022-03-03&birthTime=13:30"
  );
  assert.equal(inputFromParams(withDate).birthTime, "13:30");
  assert.equal(seedFromParams(withDate).birthTime, "13:30");
});

test("공유 링크(withBirth=false)에는 생년월일·출생 시각이 없고, 기본값은 생략한다", () => {
  const input = inputFromParams(
    new URLSearchParams(
      "lastName=김&name=서준&birthDate=2022-03-03&birthTime=13:30&gender=female&tone=soft"
    )
  );
  const shared = new URLSearchParams(
    evaluateHref(input, { withBirth: false }).split("?")[1]
  );
  assert.equal(shared.get("birthDate"), null);
  assert.equal(shared.get("birthTime"), null);
  assert.equal(shared.get("gender"), "female");
  assert.equal(shared.get("tone"), "soft");

  const plain = evaluateHref(
    inputFromParams(new URLSearchParams("lastName=김&name=서준")),
    { withBirth: true }
  );
  assert.equal(plain, `/evaluate?${new URLSearchParams({ lastName: "김", name: "서준" })}`);
});

// ============================================================
// 한자(2026-11) — 한자는 코드포인트로 적는다(호환 한자를 소스에 글자로 두지 않는다)
// ============================================================

const U = (...codes) => String.fromCodePoint(...codes);
const SEO = U(0x745e); // 상서 서
const YUN = U(0x6f64); // 윤택할 윤
const LIU = U(0x5289); // 성씨 '유'의 한자
const LI = U(0x674e);
const LI_COMPAT = U(0xf9e1); // 한글 입력기가 '이' 에서 내는 호환 코드
const NAM = U(0x5357);

/** 주소 꼴의 이름 한자(이름 '서윤' — 두 칸) */
const HANJA = ["", SEO, `*${YUN}`, SEO + YUN, `${SEO}-`, "*-"];
/** 주소 꼴의 성씨 한자(성 '유' — 한 칸) */
const LAST_HANJA = ["", LIU];

test("한자 축: URL → 입력 → href → 입력 왕복에서 서명이 그대로다", () => {
  let n = 0;
  for (const hanja of HANJA)
    for (const lastHanja of LAST_HANJA)
      for (const birthDate of BIRTH_DATES)
        for (const birthTime of BIRTH_TIMES)
          for (const gender of [null, "female"])
            for (const withBirth of [true, false]) {
              const p = new URLSearchParams({ lastName: "유", name: "서윤" });
              if (hanja) p.set("hanja", hanja);
              if (lastHanja) p.set("lastHanja", lastHanja);
              if (birthDate) p.set("birthDate", birthDate);
              if (birthTime) p.set("birthTime", birthTime);
              if (gender) p.set("gender", gender);
              const input = inputFromParams(p);
              assert.equal(input.hanja, hanja, p.toString());
              assert.equal(input.lastHanja, lastHanja, p.toString());
              const back = readBack(evaluateHref(input, { withBirth }));
              // 한자는 생년월일을 뺀 링크에도 그대로 실린다
              assert.equal(back.hanja, hanja);
              assert.equal(back.lastHanja, lastHanja);
              if (withBirth) assert.equal(inputSignature(back), inputSignature(input), p.toString());
              n++;
            }
  assert.equal(n, 6 * 2 * 2 * 2 * 2 * 2);
});

test("한자 축: 폼 제출 → href → 입력 왕복에서 서명이 그대로다 (전체 길이로 넘겨도 주소 꼴로 정리)", () => {
  // [폼이 넘긴 값, 정리된 주소 꼴]
  const cases = [
    [undefined, ""],
    ["", ""],
    ["**", ""],
    [`${SEO}*`, SEO],
    [SEO, SEO],
    [`*${YUN}`, `*${YUN}`],
    [`${SEO}-`, `${SEO}-`],
    [` ${SEO} ${YUN} `, SEO + YUN],
  ];
  for (const [hanja, expected] of cases)
    for (const lastHanja of [undefined, "", "*", LIU]) {
      const input = inputFromPayload({
        lastName: " 유 ",
        firstName: "서윤 ",
        birth: "2022-03-03",
        birthTime: "13:30",
        gender: "여",
        tone: "",
        hanja,
        lastHanja,
      });
      assert.equal(input.hanja, expected);
      assert.equal(input.lastHanja, lastHanja === LIU ? LIU : "");
      const back = readBack(evaluateHref(input, { withBirth: true }));
      assert.equal(inputSignature(back), inputSignature(input));
      // 폼 시드로 되돌려도 같은 값
      const seed = seedFromInput(input);
      assert.equal(seed.hanja, input.hanja);
      assert.equal(seed.lastHanja, input.lastHanja);
    }
});

test("한자만 다르면 서명이 다르다 — 같은 평가로 묶이지 않는다", () => {
  const sig = (query) => inputSignature(inputFromParams(new URLSearchParams(query)));
  const base = "lastName=유&name=서윤&birthDate=2022-03-03";
  const signatures = [
    sig(base),
    sig(`${base}&hanja=${SEO}`),
    sig(`${base}&hanja=${SEO}${YUN}`),
    sig(`${base}&hanja=*${YUN}`),
    sig(`${base}&hanja=${SEO}-`),
    sig(`${base}&lastHanja=${LIU}`),
    sig(`${base}&hanja=${SEO}&lastHanja=${LIU}`),
  ];
  assert.equal(new Set(signatures).size, signatures.length);
  // 이름 한자와 성씨 한자는 자리가 다르다(같은 글자라도)
  assert.notEqual(sig(`lastName=유&name=유&hanja=${LIU}`), sig(`lastName=유&name=유&lastHanja=${LIU}`));
  // 같은 뜻의 다른 표기는 같은 서명 — 끝의 * · 호환 코드 · 공백
  assert.equal(sig(`${base}&hanja=${SEO}*`), sig(`${base}&hanja=${SEO}`));
  assert.equal(sig(`${base}&hanja=**`), sig(base));
  assert.equal(sig(`lastName=이&name=서윤&lastHanja=${LI_COMPAT}`), sig(`lastName=이&name=서윤&lastHanja=${LI}`));
  // 한자가 없는 입력의 서명 — 예전 여섯 값 뒤에 빈 칸 둘
  assert.equal(sig("lastName=김&name=서준&birthDate=2022-03-03&birthTime=13:30&gender=male&tone=soft"), "김|서준|2022-03-03|13:30|male|soft||");
});

test("한자 없는 링크는 예전과 글자 그대로 같고, 한자는 name 바로 뒤에 실린다", () => {
  const plain = inputFromParams(new URLSearchParams("lastName=김&name=서준&birthDate=2022-03-03&gender=male"));
  assert.equal(plain.hanja, "");
  assert.equal(plain.lastHanja, "");
  assert.equal(
    evaluateHref(plain, { withBirth: true }),
    `/evaluate?${new URLSearchParams({ lastName: "김", name: "서준", birthDate: "2022-03-03", gender: "male" })}`
  );
  // 한자를 모르는 호출부(추천 결과의 평가 링크)는 두 값 없이 부른다 — 결과는 같다
  assert.equal(
    evaluateHref({ lastName: "김", name: "서준", birthDate: "2022-03-03", birthTime: "", gender: "male", tone: "neutral" }, { withBirth: true }),
    evaluateHref(plain, { withBirth: true })
  );

  const picked = inputFromParams(new URLSearchParams(`lastName=유&name=서윤&birthDate=2022-03-03&gender=female&hanja=${SEO}&lastHanja=${LIU}`));
  const href = evaluateHref(picked, { withBirth: true });
  assert.deepEqual([...new URLSearchParams(href.split("?")[1]).keys()], ["lastName", "name", "hanja", "lastHanja", "birthDate", "gender"]);
});

test("공유 링크(withBirth=false)에 생년월일은 없고 한자는 있다", () => {
  const input = inputFromParams(
    new URLSearchParams(`lastName=유&name=서윤&birthDate=2022-03-03&birthTime=13:30&hanja=${SEO}-&lastHanja=${LIU}`)
  );
  const shared = new URLSearchParams(evaluateHref(input, { withBirth: false }).split("?")[1]);
  assert.equal(shared.get("birthDate"), null);
  assert.equal(shared.get("birthTime"), null);
  assert.equal(shared.get("hanja"), `${SEO}-`); // 끝이 '-' 인 값도 그대로
  assert.equal(shared.get("lastHanja"), LIU);
});

test("길이가 안 맞거나 한자·표시 글자 밖이 섞인 한자는 버린다 — URL·폼·시드 세 입구 모두", () => {
  // [이름, hanja, 성, lastHanja] → 둘 다 버려지는 값
  const dropped = [
    ["서윤", SEO + YUN + YUN, "유", LIU + LIU], // 칸 수보다 길다
    ["서윤", `${SEO}a`, "유", "x"], // 한자·표시 글자 밖
    ["서윤", "서윤", "유", "유"], // 한글
    ["서ㅇ", SEO, "ㅇ", LIU], // 이름·성씨가 한글 음절만이 아니면 칸을 셀 수 없다
    ["seo", SEO, "Yu", LIU],
    ["", SEO, "", LIU], // 이름·성씨가 없으면 칸이 없다
    ["서윤", "", "유", "-"], // 성씨에는 '한자 없이'가 없다
    ["서윤", `${SEO}${U(0xfa6e)}`, "남궁", `${NAM}-`],
    // 상대 쪽에 한글 음절 밖의 글자가 있으면 멀쩡한 쪽의 한자도 버린다 — 서버가 한자를 받지 않는 입력이라 화면이 보내지 않는다
    ["서윤", SEO, "ㅇ", ""],
    ["서윤", SEO + YUN, "Yu", ""],
    ["서ㅇ", "", "유", LIU],
  ];
  for (const [name, hanja, lastName, lastHanja] of dropped) {
    const p = new URLSearchParams({ lastName, name, hanja, lastHanja });
    const fromUrl = inputFromParams(p);
    assert.deepEqual([fromUrl.hanja, fromUrl.lastHanja], ["", ""], p.toString());
    const seed = seedFromParams(p);
    assert.deepEqual([seed.hanja, seed.lastHanja], ["", ""], p.toString());
    const fromForm = inputFromPayload({ lastName, firstName: name, birth: "", gender: "", tone: "", hanja, lastHanja });
    assert.deepEqual([fromForm.hanja, fromForm.lastHanja], ["", ""], p.toString());
    // 버린 값은 주소에도 서명에도 남지 않는다
    assert.ok(!evaluateHref(fromUrl, { withBirth: true }).includes("anja="));
  }
  // 이름 한자만 틀려도 성씨 한자는 살아 있다(따로 정리한다)
  const mixed = inputFromParams(new URLSearchParams({ lastName: "유", name: "서윤", hanja: SEO + YUN + YUN, lastHanja: LIU }));
  assert.deepEqual([mixed.hanja, mixed.lastHanja], ["", LIU]);
  // 상대 쪽이 '비어 있는' 것은 괜찮다 — 성 없이 온 이름 한자(/name 조합 링크), 이름을 비운 채 이어 쓰는 성씨 한자
  const noSurname = inputFromParams(new URLSearchParams({ name: "서윤", hanja: SEO + YUN }));
  assert.deepEqual([noSurname.hanja, noSurname.lastHanja], [SEO + YUN, ""]);
  const noName = inputFromParams(new URLSearchParams({ lastName: "유", lastHanja: LIU }));
  assert.deepEqual([noName.hanja, noName.lastHanja], ["", LIU]);
  // 주소에 남은 한자는 늘 서버로 보낼 수 있는 한자다 — 성·이름이 다 있으면 apiHanjaFields 가 같은 값을 싣는다
  for (const query of [`lastName=유&name=서윤&hanja=${SEO}&lastHanja=${LIU}`, `lastName=ㅇ&name=서윤&hanja=${SEO}`, `lastName=유&name=서ㅇ&lastHanja=${LIU}`]) {
    const i = inputFromParams(new URLSearchParams(query));
    const sent = apiHanjaFields(i);
    assert.equal(!!i.hanja, "nameHanja" in sent, query);
    assert.equal(!!i.lastHanja, "lastNameHanja" in sent, query);
  }
  // 복성의 한 글자만 고른 값
  const half = inputFromParams(new URLSearchParams({ lastName: "남궁", name: "민", lastHanja: NAM }));
  assert.equal(half.lastHanja, NAM);
  assert.deepEqual(apiHanjaFields(half), { lastNameHanja: `${NAM}*` });
});

test("시드: 주소의 한자가 폼 초기값으로 넘어간다 — /name 조합 링크는 성 없이 온다", () => {
  const combo = new URLSearchParams(evaluateComboHref("서윤", SEO + YUN).split("?")[1]);
  const seed = seedFromParams(combo);
  assert.equal(seed.lastName, "");
  assert.equal(seed.firstName, "서윤");
  assert.equal(seed.hanja, SEO + YUN);
  assert.equal(seed.lastHanja, "");
  // 성이 없어 자동 평가는 돌지 않지만 입력에는 한자가 실려 있다
  const input = inputFromParams(combo);
  assert.deepEqual([input.lastName, input.name, input.hanja], ["", "서윤", SEO + YUN]);

  const full = seedFromParams(new URLSearchParams({ lastName: "이", name: "서윤", hanja: `${SEO}*`, lastHanja: LI_COMPAT }));
  assert.equal(full.hanja, SEO); // 끝의 * 생략
  assert.equal(full.lastHanja, LI); // 호환 코드 → 통합 한자
});

test("주소 꼴 → 서버로 보내는 꼴: 전체 길이로 풀고, 지정이 없으면 필드를 보내지 않는다", () => {
  const input = (query) => inputFromParams(new URLSearchParams(query));
  assert.deepEqual(apiHanjaFields(input(`lastName=유&name=서윤&hanja=${SEO}`)), { nameHanja: `${SEO}*` });
  assert.deepEqual(apiHanjaFields(input(`lastName=유&name=서윤&hanja=*${YUN}&lastHanja=${LIU}`)), { nameHanja: `*${YUN}`, lastNameHanja: LIU });
  assert.deepEqual(apiHanjaFields(input("lastName=유&name=서윤")), {});
  assert.deepEqual(apiHanjaFields(input(`lastName=Yu&name=서윤&hanja=${SEO}`)), {}); // 성씨가 한글이 아니면 보내지 않는다
});
