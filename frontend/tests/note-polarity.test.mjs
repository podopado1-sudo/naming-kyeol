// 평가 노트 극성 표 테스트 — `npm test` (= node --test "tests/*.test.mjs", Node 22.18+)
//
// 사례는 백엔드 노트 문구(AestheticEngine·HarmonyEngine Notes.Add)를 옮겨 적고,
// 감점·주의·참고(true)인지 좋은 점(false)인지는 문장 뜻을 보고 손으로 정했다(2026-10-21 검토 FE-EVAL-4·FTE-8).
// 2026-10-22 S7: HarmonyEngine.cs 의 지금 문구로 다시 맞췄다(S4 획수 조화 감산 노트·S5a 수리 획수 안내).
// 2026-10-26: B3 로 없어진 '획수 자료 미검수 글자 포함 — 획수 조화 점수 보수적 산출'과 S4·S5b 전 옛 문구(LEGACY_CASES)를 뺐다.
// 키워드가 백엔드 문자열에 아직 있는지·사례 낱말이 백엔드 문구에 있는지를 아래 대조 테스트가 본다 — 노트를 더하거나
// 바꾸면 여기 사례와 lib/note-polarity.ts 키워드를 같이 고칠 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  CAUTION_NOTE_PATTERNS,
  GENERIC_CAUTION_PATTERNS,
  isCautionNote,
} from "../src/lib/note-polarity.ts";

/** [노트, 감점·주의·참고면 true] — 지금 백엔드 문구 */
const CASES = [
  // ── AestheticEngine ──
  ["어느 세대에나 어울리는 이름", false],
  ["부드러운 톤에 잘 어울리는 발음 구성", false],
  ["강한 톤에 잘 어울리는 발음 구성", false],
  ["한자 성별 선호도가 여자 이름과 잘 맞음", false],
  ["세대 감각 — 1990년대 인기 이름", true],
  ["생활어와 충돌", true],
  ["부정 연상 단어와 동음", true],
  ["유행 이름 감점", true],
  ["남성형 어미 (여자 기준 참고)", true],
  ["여성형 어미 (남자 기준 참고)", true],
  ["된소리가 포함되어 부드러운 톤과 맞지 않음", true],
  ["일부 한자의 성별 선호도가 남자 이름과 맞지 않음", true],

  // ── HarmonyEngine — 자원오행 보완 30 (배정 한자의 부수 기준 자원오행 ↔ 사주) ──
  ["용신 '木' 보완", false],
  ["희신 '火' 포함", false],
  ["부족한 오행 '水' 보완", false],
  ["기신 '金' — 사주에 부족한 오행이라 감점 일부 상쇄", false],
  ["기신 '金' 충돌 (감점)", true],
  ["과다한 오행 '火' 증가 (감점)", true],

  // ── 획수 조화 20 (옛 화면 이름 '자원오행' — 오행 무관) — 획수 미상(5로 채운 음절)일 때만 ──
  ["일부 한자 획수 정보 부족 — 획수 조화 신뢰도 감산", true],

  // ── 음양 10 ──
  ["음양 균형: 陰 1 / 陽 1", false],
  ["음양: 陰 편중 (2)", true],
  ["음양: 陽 편중 (2)", true],

  // ── 발음오행 25 — 전체 상생이 아닌 흐름은 상극이 섞일 수 있다(김서준 木→金→金, 金克木) ──
  ["발음오행 전체 상생: 木→火", false],
  ["발음오행 전체 상생: 水→木→火", false],
  ["발음오행: 木→金→金", true],
  ["발음오행: 木→土→水", true],

  // ── 전통 81수리 15 ──
  ["수리사격(전통 81수리, 참고): 원격 15(길한 수) · 형격 18(길한 수) · 이격 13(길한 수) · 정격 25(길한 수)", true],
  ["수리사격(전통 81수리, 참고): 원격 20(피하는 수) · 형격 12(다소 꺼리는 수) · 이격 9(보통) · 정격 22(비교적 길한 수)", true],
  ["수리사격: 획수 정보 부족으로 계산 생략", true],
  [
    "획수는 성씨의 가장 흔한 한자(李)와 이름 음절에 자동으로 고른 한자로 추정했어요. 실제 한자가 다르면 수리가 달라질 수 있어요.",
    true,
  ],
  [
    "획수는 성씨와 이름 음절에 자동으로 고른 한자 기준이에요(성씨 한자도 추정이에요). 실제 한자가 다르면 수리가 달라질 수 있어요.",
    true,
  ],

  // ── 성별 보정·대체값 ──
  ["성별 선호도 일치 (+3)", false],
  ["성별 선호도 불일치 (-2)", true],
  ["배정할 한자가 없어 기본값을 사용했습니다", true],
  ["일부 음절에 배정할 한자가 없어 획수 기반 추정을 사용했습니다", true],
];

for (const [note, caution] of CASES) {
  test(`isCautionNote(${JSON.stringify(note)}) → ${caution}`, () => {
    assert.equal(isCautionNote(note), caution);
  });
}

// ── 백엔드 문구 대조 ──────────────────────────────────────────────
// 노트를 만드는 두 엔진의 코드에서 주석을 지운 본문을 읽는다. 주석을 지우면 남는 한글은 모두 문자열 리터럴 안의 말이다
// (보간 안 삼항 "부드러운" : "강한" 처럼 따옴표가 겹친 곳도 본문 그대로 대조된다). '^' 로 시작하는 키워드는 리터럴 첫머리와 맞춘다.
function backendSource() {
  const files = ["AestheticEngine.cs", "HarmonyEngine.cs"].map((f) =>
    readFileSync(fileURLToPath(new URL(`../../Application/Engines/${f}`, import.meta.url)), "utf8")
  );
  const code = files
    .map((src) =>
      src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split(/\r?\n/) // CRLF 파일 — '\r' 이 남으면 '.*$' 가 줄 끝에 닿지 못해 // 주석이 안 지워진다
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n")
    )
    .join("\n");
  const literals = [...code.matchAll(/\$?@?"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]);
  assert.ok(literals.length > 50, `백엔드 리터럴을 거의 못 읽었다 (${literals.length})`);
  return { code, literals };
}

function liveIn({ code, literals }, pattern) {
  const re = new RegExp(pattern);
  if (pattern.startsWith("^")) return literals.find((l) => re.test(l));
  return re.exec(code)?.[0];
}

test("감점·주의 키워드가 모두 지금 백엔드 노트 문자열에 있다 — 없어진 문구의 키워드는 빼야 한다", () => {
  const src = backendSource();
  for (const p of CAUTION_NOTE_PATTERNS) {
    assert.ok(
      liveIn(src, p) !== undefined,
      `'${p}' 가 AestheticEngine·HarmonyEngine 문자열 어디에도 없다 — 옛 문구라면 lib/note-polarity.ts 에서 빼고 사례도 지울 것`
    );
  }
});

test("일반 주의어(새 노트 대비)는 지금 백엔드 문구에 없다 — 쓰이기 시작하면 CAUTION_NOTE_PATTERNS 로 옮긴다", () => {
  const src = backendSource();
  for (const p of GENERIC_CAUTION_PATTERNS) {
    assert.equal(liveIn(src, p), undefined, `'${p}' 가 백엔드 문구에 쓰인다`);
  }
});

test("없어진 옛 노트 키워드(미검수·보수적·신뢰도 낮)는 다시 들어오지 않는다", () => {
  const all = [...CAUTION_NOTE_PATTERNS, ...GENERIC_CAUTION_PATTERNS].join("|");
  assert.doesNotMatch(all, /미검수|보수적|신뢰도/);
});

/**
 * 사례가 지금 백엔드 문구인지 — 사례의 한글 낱말(2자 이상)이 백엔드 리터럴에 있어야 한다.
 * 보간 값(성별 라벨 '여자 이름'·'1990년대')에 조사가 붙은 낱말은 끝 조사 한 글자를 떼고 본다, 숫자 바로 뒤 낱말('년대')은 데이터 값이라 뺀다.
 */
test("사례 표의 노트가 지금 백엔드 문구에서 왔다 — 없어진 노트 사례가 남지 않는다", () => {
  const pool = backendSource().code;
  for (const [note] of CASES) {
    for (const m of note.matchAll(/(?<![0-9가-힣])[가-힣]{2,}/g)) {
      const word = m[0];
      const stem = word.replace(/[과와이가은는을를의에로도]$/, "");
      assert.ok(
        pool.includes(word) || (stem.length >= 2 && pool.includes(stem)),
        `사례 "${note}" 의 '${word}' 가 백엔드 노트 문자열에 없다 — 없어진 노트라면 사례를 지울 것`
      );
    }
  }
});
