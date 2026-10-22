/**
 * 자원오행 판정 등급(R·V·X·U) — 화면 라벨·설명과 응답 값 정규화. /evaluate·/analysis 한자 후보 배지가 쓴다.
 *
 * 등급 정의는 data/hanja_resource_element.json meta.grades(계획 docs/plan-radical-ohaeng-2026-10.md §2-4):
 * R 확정 · V 이견 있음 · X 예외 적용 · U 미상. 백엔드 HanjaCandidateDto·HanjaOptionDto 의 `resourceGrade`.
 * 옛 `confidenceGrade`(S/A/B/C/D — 뜻 기반 판정, 2026-10-22 S4 부터 자원오행과 무관)는 읽지 않는다.
 *
 * 문구 규칙(meta.fields): 부수 단위 근거를 글자 판단처럼 쓰지 않는다(R 은 '이 부수를 같은 오행으로 본다'),
 * V 의 값은 늘 부수표 값이다(이견 글자도 부수값 그대로 V) — '작명소 기준과 같다'고 쓰지 않는다.
 *
 * "use client" 가 없는 순수 모듈 — 서버 컴포넌트·node --test 에서도 그대로 읽힌다(tests/resource-grade.test.mjs).
 */

export type ResourceGrade = "R" | "V" | "X" | "U";

/**
 * 배지 키 — 등급 넷 + V 를 나눈 둘. 이유가 radical_single 하나뿐인 V 는 '자료 적음', radical_unknown 하나뿐인 V 는 '추정'
 * (대체값이 없는데 '이견 있음'이라 쓰지 않는다 — v_reasons_legend). 키는 components/hanja/hanja-element-text.ts gradeBadgeKey 가 고른다
 * (/hanja·/name 배지와 같은 함수).
 */
export type ResourceBadgeKey = ResourceGrade | "V_FEW" | "V_GUESS";

export const RESOURCE_GRADE_INFO: Record<ResourceBadgeKey, { label: string; tip: string }> = {
  R: {
    label: "확정",
    tip: "부수로 정한 자원오행이에요. 참고한 자료들이 이 부수를 같은 오행으로 봐요.",
  },
  V: {
    label: "이견 있음",
    tip: "이 부수나 글자를 다르게 보는 자료가 있거나, 같은 부수 글자끼리 값이 갈려요. 부수 기준 기본값을 보여 드려요.",
  },
  V_FEW: {
    label: "자료 적음",
    tip: "이 부수는 자원오행 자료가 적어 찾은 자료의 값을 그대로 따랐어요. 다른 값이 있는 것은 아니에요.",
  },
  V_GUESS: {
    label: "추정",
    tip: "이 부수는 어느 자료에도 값이 없어 부수의 뜻으로 추정했어요.",
  },
  X: {
    label: "예외 적용",
    tip: "부수 대신 예외로 정했어요(간지·문헌, 또는 같은 값을 준 작명 실무 자료 여러 곳).",
  },
  U: {
    label: "미상",
    tip: "부수 자료가 없어 자원오행을 정하지 않았어요.",
  },
};

/**
 * 응답 값 → 등급. 모르는 값·빈 값은 undefined(배지 없음) — 옛 백엔드(필드 없음)나 옛 등급 글자(S·C·D)를
 * '미상'으로 바꿔 보여 주지 않는다(예전 배지는 C 키가 없어 빈 배지가 그려졌다).
 */
export function toResourceGrade(value: string | null | undefined): ResourceGrade | undefined {
  return value === "R" || value === "V" || value === "X" || value === "U" ? value : undefined;
}
