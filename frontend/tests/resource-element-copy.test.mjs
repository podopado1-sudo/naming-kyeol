// 자원오행 안내 문구·링크 테스트 — `npm test`
//
// 2026-10-23 운영 검증
// - CONTENT-1: 데이터 리포트 description(→ meta·OG·/guide 목록·홈 카드)과 /method 등급 설명이 '예외 적용 78자는 부수와 다른 값'이라고
//   썼다. 간지 22자는 값이 부수값과 같아도(乙·子·辛 등 8자) 예외 적용이라, 부수값과 다른 글자는 70자다
//   (scripts/build_insight_resource_element.py facts exceptions.differs_from_radical). 리포트 안의 수치끼리 맞는지 본다.
// - CONTENT-4: 한자 상세의 자원오행 근거 문단 뒤 '작명 원리 보기'가 /method 맨 위로 갔다 → /method#resource-element.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");

const REPORT = read("content", "insights", "resource-element-radicals.md");
const METHOD = read("src", "app", "method", "page.tsx");
const HANJA_DETAIL = read("src", "app", "hanja", "[slug]", "page.tsx");

function description(md) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  assert.ok(fm, "front-matter 없음");
  const line = /^description:\s*"(.*)"\s*$/m.exec(fm[1]);
  assert.ok(line, "description 없음");
  return line[1];
}

function num(re, text, what) {
  const m = re.exec(text);
  assert.ok(m, `${what} 를 찾지 못함: ${re}`);
  return Number(m[1].replace(/,/g, ""));
}

test("리포트 description 은 예외 적용 전체를 '부수와 다른 값'으로 쓰지 않는다", () => {
  const desc = description(REPORT);
  assert.doesNotMatch(desc, /78자는[^.]*부수와 다른 값/);
  assert.doesNotMatch(REPORT, /부수값 대신 다른 값/);
});

test("description 의 예외 수·'부수값과 다른' 수가 본문 표·문장과 맞는다", () => {
  const desc = description(REPORT);
  const total = num(/([\d,]+)자는 부수보다 간지/, desc, "description 예외 수");
  const differs = num(/그중 ([\d,]+)자는 부수값과 다른 값/, desc, "description 다른 값 수");

  const ganji = num(/^\| 간지 \| ([\d,]+)자 \|/m, REPORT, "간지 행");
  const literature = num(/^\| 문헌 예시 \| ([\d,]+)자 \|/m, REPORT, "문헌 예시 행");
  const practice = num(/^\| 작명 실무 자료 다수 \| ([\d,]+)자 \|/m, REPORT, "실무 다수 행");
  const ganjiDiffers = num(/간지 [\d,]+자 가운데 ([\d,]+)자는 부수값과 다른 값/, REPORT, "간지 중 다른 값");

  assert.equal(num(/^## .*예외 ([\d,]+)자\r?$/m, REPORT, "예외 절 제목"), total);
  assert.equal(ganji + literature + practice, total);
  // 문헌 예시·실무 다수 예외는 정의상 부수값과 다른 값이고, 간지는 일부만 다르다
  assert.equal(ganjiDiffers + literature + practice, differs);
  assert.ok(differs < total);
});

test("/method 예외 적용 설명은 간지를 '부수와 다른 값'으로 뭉뚱그리지 않는다", () => {
  const x = /code: "X",\s*label: "예외 적용",[\s\S]*?body: "([^"]*)"/.exec(METHOD);
  assert.ok(x, "GRADE_ROWS X 행 없음");
  assert.doesNotMatch(x[1], /부수값 대신 다른 값|부수와 다른 값/);
  assert.match(x[1], /먼저/);
});

test("한자 상세 '작명 원리 보기'는 /method#resource-element 로 간다", () => {
  const link = /href="([^"]+)"[^>]*>\s*작명 원리 보기/.exec(HANJA_DETAIL);
  assert.ok(link, "'작명 원리 보기' 링크 없음");
  assert.equal(link[1], "/method#resource-element");
  assert.match(METHOD, /<section id="resource-element"/);
});
