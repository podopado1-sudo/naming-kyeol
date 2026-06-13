import rawData from "@/data/hanja-seo.json";

/**
 * 한자 사전 SEO 페이지 (/hanja) 전용 데이터 모듈.
 *
 * frontend/src/data/hanja-seo.json 은 scripts/build_hanja_seo_data.py 가
 * data/ 의 한자 JSON 4종을 병합해 생성한다 (수정 시 스크립트 재실행).
 * 서버 컴포넌트에서만 import — 클라이언트 번들에 포함되지 않는다.
 */

export interface HanjaSeoRecord {
  /** 독음 (한글, 복수 가능) */
  r: string[];
  /** 뜻 ("불을 윤/윤택할 윤") */
  m?: string;
  /** 획수 */
  s?: number;
  /** 오행 (木火土金水) */
  e?: string;
  /** 오행 신뢰등급 (S/A/B/C/D) */
  g?: string;
  /** 오행 판정 근거 */
  w?: string;
  /** 음양 (陰/陽) */
  y?: string;
  /** 대법원 인명용 한자 여부 */
  gov?: number;
}

const DATA = rawData as unknown as Record<string, HanjaSeoRecord>;

/** 등급 정렬 순위 (낮을수록 신뢰도 높음) */
const GRADE_RANK: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };

/** 오행 상생 관계: key가 생(生)하는 오행 */
export const ELEMENT_GENERATES: Record<string, string> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

/** 오행 한글 표기 */
export const ELEMENT_KO: Record<string, string> = {
  木: "목(나무)",
  火: "화(불)",
  土: "토(흙)",
  金: "금(쇠)",
  水: "수(물)",
};

/** 상세 페이지 생성 조건: 뜻 + 획수 보유 (thin content 방지) */
export function hasDetailPage(record: HanjaSeoRecord): boolean {
  return Boolean(record.m && record.s);
}

function compareByGradeThenStrokes(a: string, b: string): number {
  const ra = GRADE_RANK[DATA[a].g ?? "D"] ?? 5;
  const rb = GRADE_RANK[DATA[b].g ?? "D"] ?? 5;
  if (ra !== rb) return ra - rb;
  const sa = DATA[a].s ?? 99;
  const sb = DATA[b].s ?? 99;
  if (sa !== sb) return sa - sb;
  return a.localeCompare(b);
}

// ---------------------------------------------------------------
// 인덱스 (모듈 로드 시 1회 계산 — 빌드 타임)
// ---------------------------------------------------------------

/** 독음 → 글자 목록 (등급→획수 순 정렬) */
const READING_INDEX: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const [char, record] of Object.entries(DATA)) {
    for (const reading of record.r) {
      if (!map.has(reading)) map.set(reading, []);
      map.get(reading)!.push(char);
    }
  }
  for (const chars of map.values()) chars.sort(compareByGradeThenStrokes);
  return map;
})();

/** 초성(쌍자음은 기본 자음으로 병합) → 독음 목록 (가나다순) */
const CHOSEONG_LIST = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ",
  "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;
const TENSE_TO_BASE: Record<string, string> = {
  ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ",
};

export function initialConsonantOf(reading: string): string {
  const code = reading.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "";
  const cho = CHOSEONG_LIST[Math.floor((code - 0xac00) / 588)];
  return TENSE_TO_BASE[cho] ?? cho;
}

const CONSONANT_GROUPS: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  const readings = [...READING_INDEX.keys()].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
  for (const reading of readings) {
    const cho = initialConsonantOf(reading);
    if (!cho) continue;
    if (!map.has(cho)) map.set(cho, []);
    map.get(cho)!.push(reading);
  }
  return map;
})();

// ---------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------

export function getHanja(char: string): HanjaSeoRecord | undefined {
  return DATA[char];
}

export function getReadingChars(reading: string): string[] | undefined {
  return READING_INDEX.get(reading);
}

export function getAllReadings(): string[] {
  return [...READING_INDEX.keys()];
}

/** 상세 페이지를 생성하는 모든 글자 */
export function getAllDetailChars(): string[] {
  return Object.keys(DATA).filter((c) => hasDetailPage(DATA[c]));
}

/** S급(검수 완료) 글자 — 1차 sitemap 등재 대상 */
export function getCuratedChars(): string[] {
  return Object.keys(DATA).filter(
    (c) => DATA[c].g === "S" && hasDetailPage(DATA[c]),
  );
}

/** 초성 → 독음 목록 (ㄱ~ㅎ 14그룹) */
export function getConsonantGroups(): Map<string, string[]> {
  return CONSONANT_GROUPS;
}

/** 글자 수 기준 인기 독음 상위 N개 */
export function getPopularReadings(count: number): string[] {
  return [...READING_INDEX.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, count)
    .map(([reading]) => reading);
}

/** 같은 초성의 인접 독음 (자신 제외) */
export function getSiblingReadings(reading: string): string[] {
  const cho = initialConsonantOf(reading);
  return (CONSONANT_GROUPS.get(cho) ?? []).filter((r) => r !== reading);
}

/** 특정 오행의 대표 글자 (S급 우선, 획수 적은 순) */
export function getRepresentativeChars(element: string, count: number): string[] {
  return Object.keys(DATA)
    .filter((c) => DATA[c].e === element && hasDetailPage(DATA[c]))
    .sort(compareByGradeThenStrokes)
    .slice(0, count);
}

/** 독음 페이지용 오행 분포 */
export function getElementDistribution(chars: string[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const c of chars) {
    const e = DATA[c].e;
    if (e) dist[e] = (dist[e] ?? 0) + 1;
  }
  return dist;
}
