// 부족한 오행 찾기(/ohaeng) 문장·표·입력 검사 테스트 — `npm test`
//
// 2026-11 설계 docs/plan-ohaeng-2026-11.md §6-1·§6-2: 화면 문장은 lib/ohaeng.ts 가 응답 값으로 만든다(계산은 백엔드).
// - 천간·지지 오행 표가 백엔드 SajuData.cs 와 같은지(설명 글 표와 원국 칸 색이 이 표를 쓴다)
// - countSummary 조사 사례(설계 §6-2 표) · gishinNote · 보정 줄 · 절기 줄 — 조사는 lib/josa.ts('화(火)'는 괄호 앞 '화'로 판정)
// - 입력 검사 문구가 백엔드 SajuController 와 같은 문장인지(서버도 같은 문구로 막는다)
// 기대값은 손으로 적은 표다(검사 대상 함수로 기대값을 만들지 않는다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

// lib/ohaeng.ts 는 앱 코드라 확장자 없이 `import { josa } from "./josa"` 로 읽는다(Next·tsc 규칙 — tsconfig 에 allowImportingTsExtensions 없음).
// node 의 타입 지우기는 확장자 없는 상대 경로를 풀지 못하므로, 이 테스트 프로세스에서만 .ts 파일이 부른 확장자 없는 상대 경로에 '.ts' 를 붙여 다시 찾는다
// (node --test 는 테스트 파일마다 따로 돈다 — 다른 테스트에 번지지 않는다).
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      const relativeNoExt = /^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier);
      if (err?.code === "ERR_MODULE_NOT_FOUND" && relativeNoExt && context.parentURL?.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});

const {
  BRANCH_ELEMENT,
  ELEMENTS,
  MIN_BIRTH_DATE,
  ROLE_LABEL,
  STEM_ELEMENT,
  STRENGTH_LABEL,
  birthDateProblem,
  birthLabel,
  birthTimeProblem,
  buildElementsRequest,
  correctionNote,
  countSummary,
  elementLabel,
  elementTableRows,
  formatMinutes,
  gishinNote,
  groupHeading,
  hanjaHref,
  needsSeoulOnlyNotice,
  problemField,
  roleLabels,
  sajuCardCorrectionLine,
  termNote,
  todayKst,
  yongshinHeadline,
} = await import("../src/lib/ohaeng.ts");

const backend = (rel) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

// ─── 천간·지지 표 ─────────────────────────────────────────────

test("천간·지지 오행 표가 백엔드 SajuData.cs 와 같다", () => {
  const src = backend("Application/Engines/Data/SajuData.cs");
  const stems = /StemInfo\[\] Stems\s*=\s*\[([\s\S]*?)\];/.exec(src);
  const branches = /BranchInfo\[\] Branches\s*=\s*\[([\s\S]*?)\];/.exec(src);
  assert.ok(stems && branches, "SajuData Stems·Branches 를 찾지 못했다");
  const be = (block) =>
    Object.fromEntries([...block.matchAll(/new\("(.)",\s*"[^"]+",\s*"([木火土金水])"/g)].map(([, ch, el]) => [ch, el]));
  const beStems = be(stems[1]);
  const beBranches = be(branches[1]);
  assert.equal(Object.keys(beStems).length, 10);
  assert.equal(Object.keys(beBranches).length, 12);
  // 순서까지 같게(甲…癸, 子…亥)
  assert.deepEqual(Object.entries(STEM_ELEMENT), Object.entries(beStems));
  assert.deepEqual(Object.entries(BRANCH_ELEMENT), Object.entries(beBranches));
});

test("설명 글 오행 표 — 오행마다 천간·지지, 22글자가 한 번씩", () => {
  const rows = elementTableRows();
  assert.deepEqual(
    rows.map((r) => [r.element, r.stems.join(""), r.branches.join("")]),
    [
      ["木", "甲乙", "寅卯"],
      ["火", "丙丁", "巳午"],
      ["土", "戊己", "辰未戌丑"],
      ["金", "庚辛", "申酉"],
      ["水", "壬癸", "亥子"],
    ],
  );
  assert.equal(rows.flatMap((r) => [...r.stems, ...r.branches]).length, 22);
});

test("오행 라벨 — '화(火)' 꼴, 순서 木火土金水", () => {
  assert.deepEqual([...ELEMENTS], ["木", "火", "土", "金", "水"]);
  assert.deepEqual(ELEMENTS.map(elementLabel), ["목(木)", "화(火)", "토(土)", "금(金)", "수(水)"]);
  assert.equal(elementLabel("?"), "?");
});

// ─── 요약 문장(설계 §6-2 표) ─────────────────────────────────

test("countSummary — 설계 §6-2 사례 표", () => {
  const cases = [
    [{ 木: 2, 火: 1, 土: 3, 金: 2, 水: 0 }, 8, ["土"], "여덟 글자 가운데 가장 많은 오행은 토(土)로 3개이고, 수(水)가 없습니다."],
    [{ 木: 2, 火: 2, 土: 1, 金: 1, 水: 0 }, 6, ["木", "火"], "여섯 글자 가운데 가장 많은 오행은 목(木)·화(火)로 2개씩이고, 수(水)가 없습니다."],
    [{ 木: 3, 火: 3, 土: 2, 金: 0, 水: 0 }, 8, ["木", "火"], "여덟 글자 가운데 가장 많은 오행은 목(木)·화(火)로 3개씩이고, 금(金)·수(水)가 없습니다."],
    [{ 木: 1, 火: 3, 土: 2, 金: 1, 水: 1 }, 8, ["火"], "여덟 글자 가운데 가장 많은 오행은 화(火)로 3개이고, 다섯 오행이 모두 한 번 이상 나옵니다."],
    // 받침 — 목(木)이 · 목(木)으로 · 금(金)으로
    [{ 木: 0, 火: 2, 土: 2, 金: 3, 水: 1 }, 8, ["金"], "여덟 글자 가운데 가장 많은 오행은 금(金)으로 3개이고, 목(木)이 없습니다."],
    [{ 木: 3, 火: 2, 土: 1, 金: 0, 水: 0 }, 6, ["木"], "여섯 글자 가운데 가장 많은 오행은 목(木)으로 3개이고, 금(金)·수(水)가 없습니다."],
  ];
  for (const [count, n, strongest, expected] of cases) assert.equal(countSummary(count, n, strongest), expected);
});

test("countSummary — strongestElements 가 비면 개수에서 다시 고르고, 순서는 木火土金水", () => {
  assert.equal(
    countSummary({ 水: 2, 木: 2, 火: 1, 土: 1, 金: 2 }, 8, []),
    "여덟 글자 가운데 가장 많은 오행은 목(木)·금(金)·수(水)로 2개씩이고, 다섯 오행이 모두 한 번 이상 나옵니다.",
  );
  // 응답 목록 순서가 달라도 화면은 木火土金水 순
  assert.match(countSummary({ 木: 2, 火: 2, 土: 1, 金: 1, 水: 0 }, 6, ["火", "木"]), /목\(木\)·화\(火\)로 2개씩/);
});

// ─── 역할 · 기신 · 용신 ───────────────────────────────────────

test("역할 라벨 — 백엔드 SajuElementsService 역할 코드와 같고, 모르는 코드는 뺀다", () => {
  const src = backend("Application/Services/SajuElementsService.cs");
  for (const [name, code] of [["RoleYongshin", "yongshin"], ["RoleHeeshin", "heeshin"], ["RoleMissing", "missing"]]) {
    assert.match(src, new RegExp(`${name} = "${code}"`));
    assert.ok(ROLE_LABEL[code], code);
  }
  assert.deepEqual(roleLabels(["yongshin", "heeshin", "missing", "gishin"]), ["용신", "희신", "없는 오행"]);
  assert.equal(groupHeading({ element: "木", roles: ["heeshin", "missing"] }), "목(木) · 희신 · 없는 오행");
  assert.equal(groupHeading({ element: "火", roles: ["yongshin"] }), "화(火) · 용신");
});

test("강약 라벨 키 = 백엔드 DayMasterStrength 이름(응답 strength 는 enum ToString)", () => {
  const src = backend("Domain/Models/Saju/YongshinResult.cs");
  const block = /enum DayMasterStrength\s*\{([\s\S]*?)\}/.exec(src);
  assert.ok(block);
  const names = [...block[1].matchAll(/^\s*(\w+)\s*,?/gm)].map((m) => m[1]);
  assert.deepEqual(Object.keys(STRENGTH_LABEL).sort(), names.sort());
});

test("gishinNote — 조사(는/은 · 를/을)를 괄호 앞 한글로 고른다", () => {
  assert.equal(
    gishinNote("水", "火"),
    "수(水)는 원국에 없는 오행이지만, 이 사이트 계산에서는 용신 화(火)를 극하는 기신이라 이름 평가의 조화 점수에서 감점합니다. 그래서 한자 예를 싣지 않았어요.",
  );
  assert.match(gishinNote("木", "土"), /^목\(木\)은 원국에 없는 오행이지만, 이 사이트 계산에서는 용신 토\(土\)를 극하는/);
  assert.match(gishinNote("火", "金"), /^화\(火\)는 .*용신 금\(金\)을 극하는/);
  assert.equal(yongshinHeadline("火", "木"), "이 사이트 계산으로 본 용신 화(火) · 희신 목(木)");
});

// ─── 보정 줄 · 절기 줄 ────────────────────────────────────────

test("보정 줄 — 시각 있음(출생지 고름·비움) · 시각 없음(correctionApplied false 일 때만 '보정 안 함')", () => {
  const withTime = (birthplaceDefaulted, birthplaceName, correctionMinutes) => ({
    hasBirthTime: true,
    birthplaceDefaulted,
    characterCount: 8,
    saju: { birthplaceName, correctionMinutes },
  });
  // '약' — 응답 분은 반올림 정수, 계산은 소수 분(서울 −32.08분 — 설계 §16, 백엔드 SajuCalculationServiceTests 시 경계 사례)
  assert.equal(correctionNote(withTime(false, "부산", -24)), "출생지 부산 기준으로 진태양시를 보정했어요(약 −24분).");
  assert.equal(correctionNote(withTime(true, "서울", -32)), "출생지를 고르지 않아 서울 기준으로 보정했어요(약 −32분).");

  const noTime = (correctionApplied) => ({
    hasBirthTime: false,
    birthplaceDefaulted: true,
    characterCount: 6,
    saju: { birthplaceName: "서울", correctionMinutes: correctionApplied === false ? 0 : -32, correctionApplied },
  });
  assert.equal(
    correctionNote(noTime(false)),
    "시각을 몰라 시주를 빼고 여섯 글자로 셌어요. 날짜를 그대로 썼고 출생지 보정은 하지 않았어요.",
  );
  // 필드가 없는 응답(P0 전 백엔드 — 시각이 없어도 보정이 들어간다)에는 '보정 안 함'을 말하지 않는다
  assert.equal(correctionNote(noTime(undefined)), "시각을 몰라 시주를 빼고 여섯 글자로 셌어요.");
});

test("보정 분 표기 — 수학 빼기표(U+2212)", () => {
  assert.equal(formatMinutes(-24), "−24분");
  assert.equal(formatMinutes(3), "+3분");
  assert.equal(formatMinutes(0), "0분");
});

test("절기 줄 — 입춘은 월주와 연주, 그 밖은 월주 · 조사 이/가 · 지금 결과가 낮 12시 기준임을 밝힌다", () => {
  assert.equal(
    termNote("입춘"),
    "이날은 입춘이 드는 날이라 태어난 시각에 따라 월주와 연주가 달라질 수 있어요. 지금 결과는 낮 12시 기준이에요. 시각을 넣어 다시 확인해 보세요.",
  );
  assert.equal(
    termNote("입하"),
    "이날은 입하가 드는 날이라 태어난 시각에 따라 월주가 달라질 수 있어요. 지금 결과는 낮 12시 기준이에요. 시각을 넣어 다시 확인해 보세요.",
  );
  assert.match(termNote("경칩"), /^이날은 경칩이 드는 날이라/);
  // 12절 모두 — 조사(받침: 입춘·경칩·청명·망종·입동·대설 '이', 그 밖 '가')와 '낮 12시' 문장
  for (const [term, particle] of [
    ["소한", "이"], ["입춘", "이"], ["경칩", "이"], ["청명", "이"], ["입하", "가"], ["망종", "이"],
    ["소서", "가"], ["입추", "가"], ["백로", "가"], ["한로", "가"], ["입동", "이"], ["대설", "이"],
  ]) {
    const note = termNote(term);
    assert.ok(note.startsWith(`이날은 ${term}${particle} 드는 날이라`), note);
    assert.ok(note.includes("지금 결과는 낮 12시 기준이에요."), note);
  }
  assert.equal(termNote(null), null);
  assert.equal(termNote(undefined), null);
  assert.equal(termNote(""), null);
});

test("부제 날짜 — 양력 날짜(+시각)", () => {
  assert.equal(birthLabel("1990-03-15", "14:30"), "양력 1990년 3월 15일 14시 30분");
  assert.equal(birthLabel("1990-03-15", "09:00"), "양력 1990년 3월 15일 9시");
  assert.equal(birthLabel("1990-03-15", "00:05"), "양력 1990년 3월 15일 0시 5분");
  assert.equal(birthLabel("2000-01-01", ""), "양력 2000년 1월 1일");
});

test("서울 기준 고지 — 시각을 넣었고 출생지가 서울이 아닐 때만", () => {
  assert.equal(needsSeoulOnlyNotice({ hasBirthTime: true, saju: { birthplaceName: "부산" } }), true);
  assert.equal(needsSeoulOnlyNotice({ hasBirthTime: true, saju: { birthplaceName: "서울" } }), false);
  assert.equal(needsSeoulOnlyNotice({ hasBirthTime: false, saju: { birthplaceName: "부산" } }), false);
});

test("한자 독음 링크는 쿼리 없는 맨 경로", () => {
  assert.equal(hanjaHref("명"), "/hanja/%EB%AA%85");
  assert.ok(!hanjaHref("리").includes("?"));
});

// ─── 입력 검사 · 요청 ────────────────────────────────────────

test("입력 검사 문구 = 백엔드 SajuController 문구", () => {
  const ctrl = backend("Api/Controllers/SajuController.cs");
  const today = "2026-11-19";
  const msgs = [
    birthDateProblem("2021-13-45", today),
    birthDateProblem("1899-12-31", today),
    birthDateProblem("2026-11-20", today),
    birthTimeProblem("25:00"),
  ];
  for (const m of msgs) {
    assert.ok(m, "문구가 비었다");
    assert.ok(ctrl.includes(`"${m}"`), `컨트롤러에 없는 문구: ${m}`);
  }
});

test("오류 문장 → 가리키는 칸(aria-invalid) — 화면 검사 문구와 백엔드 SajuController 400 문구 전부", () => {
  const ctrl = backend("Api/Controllers/SajuController.cs");
  const serverMessages = [...ctrl.matchAll(/error = "([^"]+)"/g)].map((m) => m[1]);
  // 400 문구 6개 + 500 고정 문구 1개
  assert.equal(serverMessages.length, 7, serverMessages.join(" / "));
  const expected = {
    "생년월일은 필수입니다.": "date",
    "생년월일은 YYYY-MM-DD 형식이어야 합니다. (예: 2024-01-15)": "date",
    "생년월일은 1900년 1월 1일 이후로 넣어 주세요.": "date",
    "생년월일은 오늘까지의 날짜로 넣어 주세요.": "date",
    "출생 시각은 HH:mm 형식이어야 합니다. (예: 14:30)": "time",
    "출생지는 목록에 있는 시·도 가운데 하나여야 합니다.": "place",
    "오행 계산 중 오류가 발생했습니다.": null,
  };
  assert.deepEqual(Object.keys(expected).sort(), [...serverMessages].sort());
  for (const m of serverMessages) assert.equal(problemField(m), expected[m], m);

  assert.equal(problemField(birthDateProblem("", "2026-11-19")), "date");
  assert.equal(problemField(birthTimeProblem("25:00")), "time");
  for (const other of [null, undefined, "", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", "오행을 세지 못했어요. 잠시 후 다시 시도해 주세요."])
    assert.equal(problemField(other), null, String(other));
});

test("생년월일 검사 — 형식·없는 날짜·1900년 전·오늘(KST) 뒤", () => {
  const today = "2026-11-19";
  assert.equal(birthDateProblem("", today), "생년월일을 넣어 주세요.");
  for (const bad of ["1990-3-15", "19900315", "2021-02-30", "2021-13-01", "abc"])
    assert.equal(birthDateProblem(bad, today), "생년월일은 YYYY-MM-DD 형식이어야 합니다. (예: 2024-01-15)", bad);
  assert.equal(birthDateProblem("1899-12-31", today), "생년월일은 1900년 1월 1일 이후로 넣어 주세요.");
  assert.equal(birthDateProblem(MIN_BIRTH_DATE, today), null);
  assert.equal(birthDateProblem("2026-11-19", today), null);
  assert.equal(birthDateProblem("2026-11-20", today), "생년월일은 오늘까지의 날짜로 넣어 주세요.");
  assert.equal(birthDateProblem("2024-02-29", today), null); // 윤일
  assert.equal(birthDateProblem("2999-01-01"), null); // today 없음 — 서버가 다시 막는다
});

test("출생 시각 검사 — HH:mm(:ss), 00:00~23:59", () => {
  for (const ok of ["", "00:00", "14:30", "23:59", "14:30:15"]) assert.equal(birthTimeProblem(ok), null, ok);
  for (const bad of ["25:00", "24:00", "1.02:00", "abc", "9:30", "14:60"])
    assert.equal(birthTimeProblem(bad), "출생 시각은 HH:mm 형식이어야 합니다. (예: 14:30)", bad);
});

test("오늘(KST) — 기기 시간대와 무관하게 UTC + 9시간", () => {
  assert.equal(todayKst(Date.UTC(2026, 10, 18, 15, 30)), "2026-11-19"); // KST 11-19 00:30
  assert.equal(todayKst(Date.UTC(2026, 10, 18, 14, 59)), "2026-11-18"); // KST 11-18 23:59
});

test("요청 본문 — 시각이 없으면 출생지를 싣지 않는다, 빈 값은 빼고", () => {
  assert.deepEqual(buildElementsRequest({ birthDate: "1990-03-15", birthTime: "", birthplaceCode: "busan" }), {
    birthDate: "1990-03-15",
  });
  assert.deepEqual(buildElementsRequest({ birthDate: "1990-03-15", birthTime: "14:30", birthplaceCode: "busan" }), {
    birthDate: "1990-03-15",
    birthTime: "14:30",
    birthplaceCode: "busan",
  });
  assert.deepEqual(buildElementsRequest({ birthDate: " 1990-03-15 ", birthTime: "14:30", birthplaceCode: "" }), {
    birthDate: "1990-03-15",
    birthTime: "14:30",
  });
});

// ─── 설명 글의 사실 문장 · 사주 계산 수정(P0) ─────────────────────
// 설명 글(OhaengGuide)은 백엔드 계산 사실을 글로 적는다(설계 §6-4 사실 대조표). 2026-11-19 반박 검토(설계 §16)에서 고친 문장이 되돌아가지 않게 본다.

const guide = readFileSync(fileURLToPath(new URL("../src/app/ohaeng/OhaengGuide.tsx", import.meta.url)), "utf8");

test("설명 글 — 균시차 미산입·반올림 표시·옛 표준시·서머타임·'부족' 두 정의·용신의 한자 배정·자시 시주를 밝힌다", () => {
  for (const re of [
    /균시차는 넣지 않고 경도 차이만 보정합니다/,
    /분은 반올림한 값이고, 계산은\s+경도 그대로 초 단위까지/,
    /서울에서 오후 1시 32분에 태어났다면 보정한 시각이 12시 59분 55초라\s+오시이고, 1시 33분부터 미시/,
    /1948~1951년과 1987·1988년 여름/,
    /1954년 3월 21일부터 1961년 8월 9일까지\(그리고 1908년\s+4월부터 1911년 말까지\)/,
    /동경 127\.5도/,
    /1955~1960년 여름/,
    /평균보다 적은 오행\(여덟 글자든 여섯 글자든 1개 이하\)/,
    /용신은 이름 한자를 고르는 데도 쓰입니다/,
    /시주는 다음\s+날의 자시\(子時\)로 셉니다/,
  ]) assert.match(guide, re);
  // FAQ 가 '모두 적었다'고 단정하지 않는다(적지 않은 차이가 남을 수 있다)
  assert.doesNotMatch(guide, /모두 적었습니다/);
  assert.match(guide, /이 사이트의 방식은 위에 적었습니다\./);
});

// 설명 글의 문장 넷(B1·B2/B3·B4·B5)은 2026-11 사주 계산 수정 P0(설계 §1·§17) 뒤에야 참이다.
// P0 전에는 'P0 경고' 테스트가 설명 글 머리 주석의 경고를 지켰고 'P0 뒤' 테스트가 skip 이었다 — P0 구현에서 아래 둘로 바꿨다:
// 문장이 본문에 그대로 있는 동안 백엔드가 그 계산(P0 필드·P0 골든 테스트)을 갖고 있어야 한다. 계산을 되돌리면 여기서 걸린다.

test("P0 뒤 — 백엔드 SajuChart·SajuChartDto·매퍼에 CorrectionApplied·TermOnBirthDay, 설명 글 머리 주석의 P0 경고는 지웠다", () => {
  for (const file of [
    "Domain/Models/Saju/SajuChart.cs",
    "Application/DTOs/NameAnalysisResponseDto.cs",
    "Application/Services/SajuDtoMapper.cs",
  ]) {
    assert.match(backend(file), /\bCorrectionApplied\b/, `${file} 에 CorrectionApplied 가 없다`);
    assert.match(backend(file), /\bTermOnBirthDay\b/, `${file} 에 TermOnBirthDay 가 없다`);
  }
  assert.doesNotMatch(guide, /들어간 뒤에야 참이다/);
});

test("P0 뒤 — 설명 글의 계산 문장 넷이 본문에 있고, 그 계산을 지키는 백엔드 P0 테스트가 건너뜀 없이 살아 있다", () => {
  for (const re of [
    /시각을 모를 때는 날짜를 그대로 쓰고 출생지 보정은 하지\s+않습니다/, // B1
    /연주와 월주는 그날 낮 12시를 기준으로 정합니다/, // 시각 없음의 연·월주 기준 — 백엔드 NoTimeReference(아래에서 값도 대조)
    /이 기준이 결과를 가르는 것은 월주가 넘어가는 절기가 드는 날뿐이고,\s+그런 날에는 결과 화면이 따로 알려 드립니다/, // P0-c
    /이 보정은 태어난 시각을 넣었을 때만 합니다/, // B1
    /태어난 달의 지지는 3배,\s+태어난 날의 지지는 2배/, // B4
    /절기가 바뀌는 날에 태어났다면 태어난\s+시각까지 넣어야 월주\(입춘이면 연주도\)가 정확합니다/, // B2·B3
    /보정한 시각이 밤 11시~자정이면 일주는 그날 것으로 두고, 시주는 다음\s+날의 자시\(子時\)로 셉니다/, // B5
  ]) assert.match(guide, re);

  // '낮 12시' — 설명 글·절기 줄(termNote)이 말하는 기준 시각이 백엔드 값과 같다(기준을 바꾸면 여기서 걸린다)
  assert.match(
    backend("Application/Services/SajuCalculationService.cs"),
    /NoTimeReference = TimeSpan\.FromHours\(12\)/,
    "SajuCalculationService 의 시각 없음 기준(NoTimeReference)이 12시가 아니다 — 설명 글·termNote 의 '낮 12시'를 함께 고칠 것",
  );

  // 골든·성질 테스트가 다시 Skip 으로 돌아가면 위 문장을 지키는 것이 없다
  const p0Tests = backend("Tests/SajuCalculationP0Tests.cs");
  for (const name of [
    "P0_B1_NoTime_DayPillarIsTheDateItself",
    "P0_B2_NoTime_MonthPillar",
    "P0_B2_MonthAndYear_StepOncePerTerm_1901To2099",
    "P0_B3_LichunDay2024_ComparesInstants",
    "P0_B4_SameGanJiPillars_WeightByPosition",
    "P0_B5_LateZiHour_StemFromNextDay",
    "P0_B5_HourPillar_IsContinuousSexagenary_AcrossMidnight",
    "P0c_NoTime_TermOnBirthDay_AndNoonReference",
  ]) assert.ok(p0Tests.includes(`public void ${name}(`), `Tests/SajuCalculationP0Tests.cs 에 ${name} 이 없다`);
  for (const file of ["Tests/SajuCalculationP0Tests.cs", "Tests/SolarTermCalculatorTests.cs", "Tests/SajuElementsServiceTests.cs"]) {
    assert.doesNotMatch(backend(file), /\(\s*Skip\s*=/, `${file} 에 Skip 이 남아 있다`);
  }
});

test("/analysis 사주 카드 보정 줄 — 시각 없이 계산했으면 '보정하지 않았어요', 그 밖에는 '약 −32분'", () => {
  // 백엔드는 시각이 없으면 보정하지 않고 correctionApplied false · correctionMinutes 0 을 싣는다(P0 — B1)
  assert.equal(
    sajuCardCorrectionLine({ birthplaceName: "서울", correctionMinutes: 0, correctionApplied: false }),
    "출생 시각이 없어 진태양시 보정은 하지 않았어요",
  );
  assert.equal(
    sajuCardCorrectionLine({ birthplaceName: "서울", correctionMinutes: -32, correctionApplied: true }),
    "출생지 서울 · 진태양시 보정 약 −32분",
  );
  // 필드가 없는 응답(P0 전 백엔드 — 시각이 없어도 보정했다)은 옛 줄 그대로(+ '약')
  assert.equal(
    sajuCardCorrectionLine({ birthplaceName: "부산", correctionMinutes: -24 }),
    "출생지 부산 · 진태양시 보정 약 −24분",
  );
  // 화면(DetailSaju)이 이 함수를 쓰고, 옛 줄(부호 없는 '보정 -32분')을 직접 그리지 않는다
  const detail = readFileSync(fileURLToPath(new URL("../src/components/design/DetailSaju.tsx", import.meta.url)), "utf8");
  assert.match(detail, /\{sajuCardCorrectionLine\(saju\)\}/);
  assert.doesNotMatch(detail, /진태양시 보정\{/);
  const analysis = readFileSync(fileURLToPath(new URL("../src/app/analysis/page.tsx", import.meta.url)), "utf8");
  assert.match(analysis, /correctionApplied: api\.correctionApplied/);
});

test("/analysis 사주 카드 절기 줄 — 응답 termOnBirthDay 를 넘겨 /ohaeng 과 같은 문장(termNote)을 그린다", () => {
  // 시각 없이 절기가 드는 날을 넣으면 /name-analysis 응답에도 termOnBirthDay 가 실린다(백엔드 SajuDtoMapper — P0-c).
  // /analysis 가 그 값을 버리면 낮 12시 기준 연·월주가 아무 안내 없이 나온다(2026-11-19 검토 — 설계 §17-8)
  const analysis = readFileSync(fileURLToPath(new URL("../src/app/analysis/page.tsx", import.meta.url)), "utf8");
  assert.match(analysis, /termOnBirthDay: api\.termOnBirthDay/);
  const detail = readFileSync(fileURLToPath(new URL("../src/components/design/DetailSaju.tsx", import.meta.url)), "utf8");
  assert.match(detail, /const term = termNote\(saju\.termOnBirthDay\);/);
  assert.match(detail, /\{term && \(/);
  assert.match(detail, /\{term\}/);
  // /ohaeng 결과도 같은 함수
  const result = readFileSync(fileURLToPath(new URL("../src/components/design/OhaengResult.tsx", import.meta.url)), "utf8");
  assert.match(result, /termNote\(saju\.termOnBirthDay\)/);
});
