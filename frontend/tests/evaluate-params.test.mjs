// /evaluate 입력 정규화·링크 왕복 테스트 — `npm test` (= node --test "tests/*.test.mjs", Node 22.18+)
//
// 지키는 계약(2026-10-21 검토 FE-EVAL-1·8): URL·폼 어느 입구로 들어온 입력이든
// evaluateHref 로 쓴 URL 을 다시 읽으면 같은 서명이 나와야 한다. 어긋나면 EvaluateClient 의
// watcher 가 '다른 입력'으로 보고 같은 평가를 한 번 더 돌린다(결과 깜빡임·사용량 2회).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateHref,
  inputFromParams,
  inputFromPayload,
  inputSignature,
  seedFromParams,
} from "../src/app/evaluate/evaluate-params.ts";

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
