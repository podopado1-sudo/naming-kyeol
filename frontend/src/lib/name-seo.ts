import rawData from "@/data/name-seo.json";
import { ELEMENT_GENERATES } from "@/lib/hanja-seo";

/**
 * 이름 뜻 SEO 페이지 (/name) 전용 데이터 모듈.
 *
 * frontend/src/data/name-seo.json 은 scripts/build_name_seo_data.py 가
 * 대법원 출생신고 빈도(m.csv/f.csv) + 자연어 뜻을 병합해 생성한다
 * (수정 시 스크립트 재실행). 서버 컴포넌트에서만 import.
 */

export interface NameSeoRecord {
  /** 남아 출생신고 빈도 */
  m: number;
  /** 여아 출생신고 빈도 */
  f: number;
  /** 합산 빈도 */
  t: number;
  /** 전체 인기 순위 (합산 기준) */
  rank: number;
  /** 남아 내 순위 */
  rm?: number;
  /** 여아 내 순위 */
  rf?: number;
  /** 자연어 뜻 풀이 (대표 한자 기준의 일반적 느낌) */
  mean?: string;
  /** 흔히 쓰는 한자 조합 상위 K개 [["智","宇"], ...] */
  combos?: string[][];
}

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

/** 한자 뜻의 다중 훈음("슬기로울 지/지혜 지") 중 첫 훈음만. */
export function firstGloss(meaning?: string): string {
  if (!meaning) return "";
  return meaning.split(/[,/;·]/)[0].trim();
}

const RAW = rawData as unknown as {
  meta: { source: string; minTotal: number; count: number };
  names: Record<string, NameSeoRecord>;
};

const DATA = RAW.names;

export type NameGender = "male" | "female" | "neutral";

/** 남/녀 빈도 비율 (성별 기운 판정용) */
export function genderSplit(rec: NameSeoRecord): {
  malePct: number;
  femalePct: number;
  gender: NameGender;
} {
  const malePct = Math.round((rec.m * 100) / Math.max(rec.t, 1));
  const femalePct = 100 - malePct;
  let gender: NameGender = "neutral";
  if (malePct >= 60) gender = "male";
  else if (femalePct >= 60) gender = "female";
  return { malePct, femalePct, gender };
}

// ---------------------------------------------------------------
// 인덱스 (모듈 로드 시 1회 — 빌드 타임)
// ---------------------------------------------------------------

/** 인기 순위 오름차순 정렬된 전체 이름 */
const RANKED: string[] = Object.keys(DATA).sort(
  (a, b) => DATA[a].rank - DATA[b].rank,
);

/** 첫 음절 → 이름 목록 (인기순) */
const FIRST_SYLLABLE_INDEX: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const name of RANKED) {
    const syl = name[0];
    if (!map.has(syl)) map.set(syl, []);
    map.get(syl)!.push(name);
  }
  return map;
})();

// ---------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------

export function getName(name: string): NameSeoRecord | undefined {
  return DATA[name];
}

export function getAllNames(): string[] {
  return RANKED;
}

/** 인기 상위 N개 — 1차 sitemap 등재 대상 (thin-content 회피) */
export function getCuratedNames(limit: number): string[] {
  return RANKED.slice(0, limit);
}

/** 같은 첫 음절의 다른 이름 (인기순, 자신 제외) */
export function getSiblingNames(name: string, count: number): string[] {
  const syl = name[0];
  return (FIRST_SYLLABLE_INDEX.get(syl) ?? [])
    .filter((n) => n !== name)
    .slice(0, count);
}

/** 음절 배열 (각 글자) */
export function syllablesOf(name: string): string[] {
  return [...name];
}
