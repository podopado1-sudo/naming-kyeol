/**
 * 오행 두 글자의 관계(상생·비화·상극)와 이름 글자의 오행 역할 — 순수 모듈("use client" 없음).
 *
 * 왜 따로 있나(2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §8-1·§8-4): `ELEMENT_GENERATES` 는 lib/hanja-seo.ts 에,
 * `ohaengRelation`·`OhaengKind` 는 lib/name-seo.ts 에 있었는데 그 두 파일은 큰 정적 JSON(hanja-seo.json·name-seo.json)을
 * import 하는 서버 전용 모듈이다. 클라이언트 화면(/evaluate '이 이름의 한자' 블록)이 같은 판정을 쓰려면 JSON 없는 모듈이 필요해
 * 세 가지를 **글자 그대로** 여기로 옮겼다. 두 파일은 `export { … } from "./ohaeng-relation"` 로 다시 내보내 기존 import 가 그대로 산다
 * (tests/ohaeng-relation.test.mjs 가 원문과 25쌍 손 표로 확인한다).
 *
 * 여기에 더한 것:
 * - `ohaengRelationName` — 판정은 `ohaengRelation` 과 같고 말만 이름 꼴(상극을 '金剋木 · 상극'으로). /name 조합 카드의 말은 바꾸지 않는다.
 * - `rolesOf` — 한자의 자원오행이 맡는 역할(용신·희신·기신·부족·많음). 백엔드 ElementFit.RolesOf 와 같은 조건·같은 순서다.
 *   고른 글자를 응답이 오기 전에 그릴 때만 쓴다 — 확정 값은 응답의 `fills` 다.
 */
import type { ElementFit, HanjaFill } from "./types";

/** 오행 상생 관계: key가 생(生)하는 오행 */
export const ELEMENT_GENERATES: Record<string, string> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

export type OhaengKind = "생" | "비화" | "극" | "unknown";

/** 두 오행(木火土金水)의 관계 — 상생/비화/상극. 한자 조합의 오행 조화 표시용. */
export function ohaengRelation(e1?: string, e2?: string): {
  kind: OhaengKind;
  label: string;
} {
  if (!e1 || !e2) return { kind: "unknown", label: "" };
  if (ELEMENT_GENERATES[e1] === e2) return { kind: "생", label: `${e1}生${e2} · 상생` };
  if (ELEMENT_GENERATES[e2] === e1) return { kind: "생", label: `${e2}生${e1} · 상생` };
  if (e1 === e2) return { kind: "비화", label: `${e1}${e1} · 비화(같은 기운)` };
  return { kind: "극", label: "상극(기운이 부딪침)" };
}

/** 오행 상극 관계: key가 극(剋)하는 오행 — 木剋土·土剋水·水剋火·火剋金·金剋木 */
export const ELEMENT_CONTROLS: Record<string, string> = {
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
};

/** 木·火·土·金·水 가운데 하나인가(객체에 물려받은 키 'constructor' 따위는 오행이 아니다) */
function isElement(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(ELEMENT_GENERATES, value);
}

/**
 * 두 오행의 관계를 이름 꼴로 — /evaluate '이 이름의 한자' 블록의 글자 사이 칩.
 * 판정(kind)은 `ohaengRelation` 과 같고 상극의 말만 다르다: '상극(기운이 부딪침)' 대신 누르는 쪽을 앞에 둔 '金剋木 · 상극'.
 * '기운이 부딪침'은 해석 말인데 이 칩은 바꿀 수 없는 성씨와 이름 사이에도 붙는다 — 상생 줄과 같은 꼴의 이름만 남긴다(설계 §8-4).
 * 木火土金水 밖의 값이 오면(자원오행 미상 "" 포함) 관계를 말하지 않는다(unknown) — 모르는 값에 상극이라고 적지 않는다.
 */
export function ohaengRelationName(e1?: string, e2?: string): {
  kind: OhaengKind;
  label: string;
} {
  if (!e1 || !e2 || !isElement(e1) || !isElement(e2)) return { kind: "unknown", label: "" };
  const relation = ohaengRelation(e1, e2);
  if (relation.kind !== "극") return relation;
  const [strong, weak] = ELEMENT_CONTROLS[e1] === e2 ? [e1, e2] : [e2, e1];
  return { kind: "극", label: `${strong}剋${weak} · 상극` };
}

/**
 * 이 자원오행이 맡는 역할 — yongshin · heeshin · gishin · lacking · excessive (이 순서). 오행이 비었거나 출생일이 없으면(fit 없음) 빈 목록.
 * 백엔드 ElementFit.RolesOf 와 같은 조건이다: 용신·희신인 오행에는 excessive 를 붙이지 않고(조화 점수의 과다 감점 제외 규칙),
 * lacking 은 용신·기신 여부와 무관하게 붙는다. 그래서 gishin 이 붙은 글자는 곧 조화 노트의 '기신 … 충돌 (감점)'이 걸린 글자다.
 */
export function rolesOf(
  element: string | null | undefined,
  fit: ElementFit | null | undefined
): HanjaFill[] {
  if (!element || !fit) return [];
  const roles: HanjaFill[] = [];
  if (element === fit.yongshin) roles.push("yongshin");
  if (element === fit.heeshin) roles.push("heeshin");
  if (element === fit.gishin) roles.push("gishin");
  if (fit.lacking.includes(element)) roles.push("lacking");
  if (fit.excessive.includes(element) && element !== fit.yongshin && element !== fit.heeshin) {
    roles.push("excessive");
  }
  return roles;
}
