import rawData from "@/data/hanja-seo.json";

/**
 * 한자 사전 SEO 페이지 (/hanja) 전용 데이터 모듈.
 *
 * frontend/src/data/hanja-seo.json 은 scripts/build_hanja_seo_data.py 가
 * data/ 의 한자 JSON 을 병합해 생성한다 (수정 시 스크립트 재실행).
 * 서버 컴포넌트에서만 import — 클라이언트 번들에 포함되지 않는다.
 *
 * 자원오행(e·g 와 부수 필드)은 data/hanja_resource_element.json(부수 기준 — 백엔드 HanjaData.ApplyResourceElements 와
 * 같은 파일)을 빌드 스크립트가 복사한 값이다. 필드 뜻·화면 문구 규칙은 그 파일 meta.fields 가 계약이다(2026-10-22 자원오행 전환 S4·S7).
 */

/** 자원오행 등급 — R 확정 · V 이견 있음 · X 예외 적용 · U 미상 (옛 S/A/B/C/D 는 2026-10-22 폐지) */
export type HanjaGrade = "R" | "V" | "X" | "U";

/** V 인 이유 — data/hanja_resource_element.json meta.v_reasons_legend */
export type HanjaVReason =
  | "radical_alt"
  | "radical_split"
  | "radical_disputed"
  | "radical_single"
  | "radical_unknown"
  | "number"
  | "char_literature"
  | "char_practice";

/** 글자 단위 다른 값 — basis 로 출처 갈래를 나눈다(PRACTICE = 작명 실무 자료 n곳, 그 밖은 문헌·작명소·작명 서비스) */
export interface HanjaAltChar {
  e: string;
  basis: string[];
  /** PRACTICE: 같은 값을 준 곳 수 */
  n?: number;
  /** PRACTICE: 값이 있는 곳 수 */
  of?: number;
  /** PRACTICE: 그중 독립 근거 수(그 자료 자신의 부수 규칙값 반복을 뺀 수) */
  n_indep?: number;
}

export interface HanjaSeoRecord {
  /** 독음 (한글, 복수 가능) */
  r: string[];
  /** 뜻 ("불을 윤/윤택할 윤") */
  m?: string;
  /** 획수 (Unicode 18.0 kTotalStrokes — data/hanja_strokes.json) */
  s?: number;
  /** 부수 기준 자원오행 (木火土金水). 등급 U 면 데이터는 null — 로드할 때 키를 지워 undefined 로 둔다 */
  e?: string;
  /** 자원오행 등급 */
  g?: HanjaGrade;
  /** 강희 부수 번호 1~214 */
  radical?: number;
  /** 부수의 통합 한자 꼴(원형 — 扌 가 아니라 手) */
  radical_char?: string;
  /** **부수 단위** 다른 값 — 화면은 '이 부수(X)를 Y로 보는 자료도 있습니다'(글자 견해로 쓰지 말 것) */
  alt_radical?: string[];
  /** **글자 단위** 다른 값 — 출처별 문구는 components/hanja/hanja-element-text.ts */
  alt_char?: HanjaAltChar[];
  /** V 인 이유 */
  v_reasons?: HanjaVReason[];
  /** 숫자 한자(一~十·百·千·萬) — '숫자 한자의 자원오행은 작명가마다 기준이 다릅니다' */
  number?: boolean;
  /** 이체자면 정자(확실 묶음만). 값은 쓴 꼴의 부수를 따른다(D6) */
  variant_of?: string;
  /** 정자 판정이 약하다 — 이체자 배지·정자 링크를 달지 않는다 */
  variant_tie?: boolean;
  /** 자원오행 근거 한 줄(사람이 읽는 문장 — '手·扌(손 수) 부수 → 木') */
  note?: string;
  /** Core 데이터(hanja_core_v1.json, 강희 획수·뜻을 정리한 2,060자) 글자면 1 — 옛 등급 S 에 기대던 정렬이 쓴다 */
  c?: 1;
  /** 옛 뜻 기반 판정 문장(D4 보존). 오행 낱말이 섞여 있어 그대로 내지 말 것 — cleanMeaningNote 를 거친다 */
  mw?: string;
  /** 음양 (陰/陽 — 획수 홀짝, 홀수 陽) */
  y?: string;
  /** 대법원 인명용 한자 여부 */
  gov?: number;
  /** 불용(ForbiddenNameHanjaSet) — 이름 생성·추천·/evaluate 배정에서 빠지는 글자. 화면의 '이름에 피하는 글자'는 이것만 */
  nf?: 1;
  /** weak(WeakGivenNameHanjaSet) — 뜻이 약해 동음 대안이 있으면 양보(배제 아님). '피하는 글자'로 쓰지 말 것 */
  wk?: 1;
}

const DATA = (() => {
  const data = rawData as unknown as Record<string, HanjaSeoRecord & { e?: string | null }>;
  // 등급 U(부수 자료 없음)는 e 가 null 로 실린다(2026-10-22 기준 0자). 소비처는 e 를 '있으면 오행'으로만 보므로
  // null 을 undefined 로 바꿔 타입(e?: string)과 맞춘다.
  for (const record of Object.values(data)) {
    if (record.e === null) delete record.e;
  }
  return data as Record<string, HanjaSeoRecord>;
})();

/**
 * 등급 정렬 순위 — 확정 → 예외 적용(간지·문헌·실무 예외표로 정한 값) → 이견 있음 → 미상.
 * 정렬은 코어 글자(c) 먼저, 그다음 이 순위, 그다음 획수(compareByCoreGradeStrokes).
 */
const GRADE_RANK: Record<string, number> = { R: 0, X: 1, V: 2, U: 3 };

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

/** 코어(c) 먼저 → 등급(확정·예외·이견·미상) → 획수 → 코드 순. 옛 '검수 등급 S 먼저'를 코어 여부로 옮겼다(옛 S ⊂ 코어) */
function compareByCoreGradeStrokes(a: string, b: string): number {
  const ca = DATA[a].c ? 0 : 1;
  const cb = DATA[b].c ? 0 : 1;
  if (ca !== cb) return ca - cb;
  const ra = GRADE_RANK[DATA[a].g ?? "U"] ?? 4;
  const rb = GRADE_RANK[DATA[b].g ?? "U"] ?? 4;
  if (ra !== rb) return ra - rb;
  const sa = DATA[a].s ?? 99;
  const sb = DATA[b].s ?? 99;
  if (sa !== sb) return sa - sb;
  return a.localeCompare(b);
}

// ---------------------------------------------------------------
// 인덱스 (모듈 로드 시 1회 계산 — 빌드 타임)
// ---------------------------------------------------------------

/** 독음 → 글자 목록 (코어 → 등급 → 획수 순 정렬) */
const READING_INDEX: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const [char, record] of Object.entries(DATA)) {
    for (const reading of record.r) {
      if (!map.has(reading)) map.set(reading, []);
      map.get(reading)!.push(char);
    }
  }
  for (const chars of map.values()) chars.sort(compareByCoreGradeStrokes);
  return map;
})();

/** 정자 → 이체자 목록(variant_tie 제외 — 정자 판정이 약한 묶음은 화면에서 이체자로 잇지 않는다) */
const VARIANTS_OF: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const [char, record] of Object.entries(DATA)) {
    if (!record.variant_of || record.variant_tie) continue;
    if (!map.has(record.variant_of)) map.set(record.variant_of, []);
    map.get(record.variant_of)!.push(char);
  }
  for (const chars of map.values()) chars.sort(compareByCoreGradeStrokes);
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

/**
 * 코어 글자(c — 강희 획수·뜻을 정리한 2,060자 중 상세 페이지가 있는 글자). 옛 'S급(검수 완료)' 목록의 후속 —
 * 옛 S 2,054자는 모두 코어 안에 있다. 애드센스 승인 뒤 글자 상세 색인을 되살릴 때의 후보(계획 §7-2, 지금은 소비처 없음).
 */
export function getCuratedChars(): string[] {
  return Object.keys(DATA).filter(
    (c) => DATA[c].c === 1 && hasDetailPage(DATA[c]),
  );
}

/** 이 사이트 이름 추천에서 쓰지 않는 글자(불용 nf) — 독음 페이지 '이름에 피하는 글자' 소구획(ND-5). weak(wk)는 넣지 않는다 */
export function isAvoidedForNames(record: HanjaSeoRecord): boolean {
  return record.nf === 1;
}

/** 독음 글자 목록을 이름에 쓰는 글자 / 이름에 피하는 글자(nf)로 나눈다 — 각 묶음 안의 순서는 그대로 */
export function splitAvoidedChars(chars: string[]): { usable: string[]; avoided: string[] } {
  const usable: string[] = [];
  const avoided: string[] = [];
  for (const c of chars) (isAvoidedForNames(DATA[c]) ? avoided : usable).push(c);
  return { usable, avoided };
}

/**
 * thin 독음 기준 — 글자가 이 수 이하인 독음 페이지는 구글에만 색인 제외(googleBot noindex, 감사 AS-7).
 * 2026-10-22 데이터 기준 58쪽(1자 43 · 2자 15). 네이버(robots index)와 사이트맵은 그대로 둔다.
 */
export const THIN_READING_MAX_CHARS = 2;

export function isThinReading(reading: string): boolean {
  const chars = READING_INDEX.get(reading);
  return chars !== undefined && chars.length <= THIN_READING_MAX_CHARS;
}

/** 이 글자를 정자로 둔 이체자(확실 묶음만, variant_tie 제외) */
export function getVariantChars(char: string): string[] {
  return VARIANTS_OF.get(char) ?? [];
}

/** 이체자 배지를 달 정자 — variant_tie(정자 판정이 약함)면 달지 않는다 */
export function standardCharOf(record: HanjaSeoRecord): string | undefined {
  return record.variant_of && !record.variant_tie ? record.variant_of : undefined;
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

/**
 * 특정 자원오행의 대표 글자 — '함께 쓰기 좋은 오행' 카드. 불용(nf) 글자는 빼고, weak(wk)는 뒤로 양보,
 * 그다음 코어 → 등급 → 획수 순.
 */
export function getRepresentativeChars(element: string, count: number): string[] {
  return Object.keys(DATA)
    .filter(
      (c) =>
        DATA[c].e === element &&
        hasDetailPage(DATA[c]) &&
        !isAvoidedForNames(DATA[c]),
    )
    .sort(
      (a, b) =>
        (DATA[a].wk ? 1 : 0) - (DATA[b].wk ? 1 : 0) ||
        compareByCoreGradeStrokes(a, b),
    )
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
