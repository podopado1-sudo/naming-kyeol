// 평가 노트 극성 표 테스트 — `npm test` (= node --test "tests/*.test.mjs", Node 22.18+)
//
// 사례는 백엔드 노트 문구(AestheticEngine·HarmonyEngine·ScoringService Notes.Add)를 옮겨 적고,
// 감점·주의·참고(true)인지 좋은 점(false)인지는 문장 뜻을 보고 손으로 정했다(2026-10-21 검토 FE-EVAL-4·FTE-8).
import { test } from "node:test";
import assert from "node:assert/strict";

import { isCautionNote } from "../src/lib/note-polarity.ts";

/** [노트, 감점·주의·참고면 true] */
const CASES = [
  // 좋은 점 — 청록 ✓
  ["어느 세대에나 어울리는 이름", false],
  ["부드러운 톤에 잘 어울리는 발음 구성", false],
  ["한자 성별 선호도가 여자 이름과 잘 맞음", false],
  ["성별 선호도 일치 (+3)", false],
  ["용신 '木' 보완", false],
  ["희신 '火' 포함", false],
  ["부족한 오행 '水' 보완", false],
  ["기신 '金' — 사주에 부족한 오행이라 감점 일부 상쇄", false],
  ["음양 균형: 陰 1 / 陽 1", false],
  ["발음오행 전체 상생: 木→火", false],
  ["발음오행 전체 상생: 水→木→火", false],
  // 감점·주의·참고 — 중립 막대
  ["세대 감각 — 1990년대 인기 이름", true],
  ["생활어와 충돌", true],
  ["부정 연상 단어와 동음", true],
  ["유행 이름 감점", true],
  ["된소리가 포함되어 부드러운 톤과 맞지 않음", true],
  ["성별 선호도 불일치 (-2)", true],
  ["한자 정보가 부족하여 기본값을 사용했습니다", true],
  ["기신 '金' 충돌 (감점)", true],
  ["용신 '木' — 사주에 이미 많은 오행이라 가점 일부 상쇄 (감점)", true],
  ["과다한 오행 '火' 증가 (감점)", true],
  ["일부 한자의 오행 판정 신뢰도가 낮음 — 자원오행 점수 보수적 산출", true],
  ["음양: 陰 편중 (2)", true],
  ["수리사격: 획수 정보 부족으로 계산 생략", true],
  // 전체 상생이 아닌 발음오행 흐름 — 상극이 섞일 수 있다(김서준 木→金→金, 金克木)
  ["발음오행: 木→金→金", true],
  ["발음오행: 木→土→水", true],
];

for (const [note, caution] of CASES) {
  test(`isCautionNote(${JSON.stringify(note)}) → ${caution}`, () => {
    assert.equal(isCautionNote(note), caution);
  });
}
