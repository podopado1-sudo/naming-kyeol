/**
 * /evaluate 결과 화면의 '한자 바꿔 다시 계산하기' — 화면 상태를 다루는 순수 로직(2026-11 설계 docs/plan-hanja-input-2026-11.md §8-2·§10-3).
 *
 * "use client" 가 없는 순수 모듈이다(node --test 가 바로 읽는다 — tests/hanja-recalc.test.mjs). 서버를 부르지 않고, 점수를 만들지 않는다 —
 * 점수는 늘 /evaluate 응답의 값이다. 여기 있는 것은 ① 칸 하나를 바꾼 다음 입력(주소 꼴) ② 응답을 기다리는 동안의 바뀐 칸 묶음
 * ③ 본 조합 목록(지금 조합 + 최근 3개)과 응답 캐시 ④ 공유 링크에 실을 한자뿐이다.
 *
 * 주의: 이름·한자·생년월일은 개인정보다 — 이 모듈은 콘솔·브라우저 저장소·분석 이벤트에 아무것도 남기지 않는다.
 */
import {
  AUTO,
  NONE,
  decodeHanjaParam,
  encodeHanjaParam,
  type HanjaChoice,
  type PendingHanja,
  type SlotTarget,
} from "./hanja-pick";
import type { HanjaSummary } from "./types";

/** 한자 두 값(주소 꼴)을 가진 입력 — app/evaluate/evaluate-params.ts 의 EvalInput 이 이 꼴이다 */
export interface HanjaInputLike {
  lastName: string;
  name: string;
  /** 이름 한자 — 주소 꼴(끝의 `*` 생략) */
  hanja: string;
  /** 성씨 한자 — 주소 꼴 */
  lastHanja: string;
}

/**
 * 칸 하나를 바꾼 다음 입력. 이름 칸은 고른 글자 / `-`(한자 없이) / `*`(자동), 성씨 칸은 고른 글자 / `*`(기본으로 두는 한자).
 * 자리가 칸 밖이면 입력을 그대로 돌려준다. 다른 칸은 건드리지 않는다.
 */
export function nextHanjaInput<T extends HanjaInputLike>(
  input: T,
  target: SlotTarget,
  index: number,
  choice: HanjaChoice
): T {
  if (target === "name") {
    const marks = decodeHanjaParam(input.hanja, input.name.length);
    if (!Number.isInteger(index) || index < 0 || index >= marks.length) return input;
    marks[index] = choice.kind === "hanja" ? choice.fact.character : choice.kind === "none" ? NONE : AUTO;
    return { ...input, hanja: encodeHanjaParam(marks) };
  }
  const marks = decodeHanjaParam(input.lastHanja, input.lastName.length, { allowNone: false });
  if (!Number.isInteger(index) || index < 0 || index >= marks.length) return input;
  marks[index] = choice.kind === "hanja" ? choice.fact.character : AUTO;
  return { ...input, lastHanja: encodeHanjaParam(marks) };
}

/** 응답을 기다리는 동안의 바뀐 칸 묶음에 칸 하나를 더한다(같은 칸을 다시 바꾸면 나중 것이 남는다) */
export function mergePending(
  pending: PendingHanja | null | undefined,
  target: SlotTarget,
  index: number,
  choice: HanjaChoice
): PendingHanja {
  const base = pending ?? { name: {}, surname: {} };
  return target === "name"
    ? { name: { ...base.name, [index]: choice }, surname: base.surname }
    : { name: base.name, surname: { ...base.surname, [index]: choice } };
}

/**
 * 같은 바탕인가를 가르는 키 — 성·이름·생년월일·시각·성별·톤(한자 두 값은 뺀다).
 * '지금까지 본 조합'은 같은 바탕에서 한자만 바꿔 본 결과끼리만 나란히 둔다.
 */
export function baseSignature(input: {
  lastName: string;
  name: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  tone: string;
}): string {
  return [input.lastName, input.name, input.birthDate, input.birthTime, input.gender, input.tone].join("|");
}

export interface SeenEntry<T> {
  /** 그 조합의 서명(한자 포함) */
  sig: string;
  /** 바탕 서명(baseSignature) */
  base: string;
  /** 마지막으로 본 순번 — 클수록 최근 */
  at: number;
  value: T;
}

/** '지금까지 본 조합'에 두는 수 — 지금 조합 + 최근 3개 */
export const SEEN_LIMIT = 4;

/**
 * 본 조합 목록에 **계산이 끝난** 조합 하나를 넣는다(또는 다시 본 것으로 표시한다).
 * - 바탕이 다른 조합은 버린다(다른 이름·다른 생년월일을 평가하면 목록이 새로 시작한다).
 * - 이미 있는 조합은 자리를 지킨 채 값과 순번만 바꾼다(줄이 뛰어다니지 않게).
 * - 넘치면 가장 오래전에 본 것부터 뺀다 — 방금 넣은 조합(지금 조합)은 순번이 가장 커서 빠지지 않는다.
 */
export function pushSeen<T>(
  list: readonly SeenEntry<T>[],
  entry: { sig: string; base: string; value: T },
  limit: number = SEEN_LIMIT
): SeenEntry<T>[] {
  const same = list.filter((e) => e.base === entry.base);
  const at = same.reduce((max, e) => Math.max(max, e.at), 0) + 1;
  const found = same.findIndex((e) => e.sig === entry.sig);
  let next: SeenEntry<T>[] =
    found >= 0
      ? same.map((e, i) => (i === found ? { ...e, value: entry.value, at } : e))
      : [...same, { sig: entry.sig, base: entry.base, at, value: entry.value }];
  while (next.length > Math.max(1, limit)) {
    const oldest = next.reduce((min, e) => (e.at < min.at ? e : min));
    next = next.filter((e) => e !== oldest);
  }
  return next;
}

/** 응답 캐시에 두는 수 */
export const CACHE_LIMIT = 8;

/** 캐시에 넣는다 — 다시 넣은 키는 맨 뒤(가장 최근)로 가고, 넘치면 가장 오래된 키부터 뺀다 */
export function cachePut<K, V>(cache: Map<K, V>, key: K, value: V, limit: number = CACHE_LIMIT): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > Math.max(1, limit)) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/**
 * 공유 링크에 실을 한자(주소 꼴).
 * - 한자를 하나라도 고른 결과(`userHanja`)는 **화면에 보인 이름 글자를 모두** 싣는다 — 자동 칸도 그 글자로 고정한다.
 *   고른 칸만 실으면 받는 쪽의 자동 칸은 생년월일 없는 기본 배정으로 채워져, 조합을 보여 주려고 보낸 링크가 다른 조합으로 열린다(설계 §10-3).
 *   한자 없이 둔 칸은 `-`, 쓸 수 있는 한자가 없는 음절은 `*` 다. 받는 쪽에서는 그 글자들이 '고른 한자'로 보인다.
 * - 성씨 한자는 고른 것만 싣는다 — 기본으로 두는 한자·추정 한자는 생년월일과 무관해 받는 쪽에서도 같은 글자다.
 * - 한자를 고르지 않은 결과·hanjaSummary 가 없는 응답은 입력의 값 그대로다(한자 없는 링크는 예전과 글자 그대로 같다).
 */
export function shareHanja(
  summary: HanjaSummary | null | undefined,
  input: { hanja: string; lastHanja: string }
): { hanja: string; lastHanja: string } {
  if (!summary || !summary.userHanja) return { hanja: input.hanja, lastHanja: input.lastHanja };
  const marks = summary.syllables.map((s) => s.hanja?.character ?? (s.source === "none" ? NONE : AUTO));
  return { hanja: encodeHanjaParam(marks), lastHanja: input.lastHanja };
}
