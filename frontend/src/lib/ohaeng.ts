/**
 * 부족한 오행 찾기(/ohaeng) — 화면 문장·표·입력 검사의 순수 로직(2026-11 설계 docs/plan-ohaeng-2026-11.md §6).
 *
 * "use client" 가 없는 순수 모듈 — 서버 컴포넌트(설명 글 OhaengGuide)·클라이언트(폼 OhaengClient·결과 OhaengResult)·
 * node --test(tests/ohaeng.test.mjs)가 함께 읽는다. 계산은 하지 않는다 — 원국·개수·용신·한자 예는 모두 백엔드
 * POST /api/v1/saju/elements 응답이고, 여기서는 그 값을 문장으로 옮길 뿐이다.
 *
 * - 조사는 lib/josa.ts 로 고른다(CLAUDE.md — '화(火)' 꼴은 괄호 앞 한글 '화'로 판정).
 * - 천간·지지 오행 표(STEM_ELEMENT·BRANCH_ELEMENT)는 백엔드 SajuData.cs 와 같다 — tests/ohaeng.test.mjs 가 C# 파일과 대조한다.
 * - 입력 검사 문구는 백엔드 SajuController 표 2-3 과 같은 문장이다(서버도 같은 문구로 막는다).
 */
import { josa } from "./josa";
import type { ElementHanjaGroup, SajuElementsRequest, SajuElementsResponse } from "./types";

// ============================================================
// 오행 · 천간 · 지지
// ============================================================

/** 오행 — 상생 순서(木→火→土→金→水). 화면의 모든 오행 목록이 이 순서다 */
export const ELEMENTS = ["木", "火", "土", "金", "水"] as const;
export type FiveElementChar = (typeof ELEMENTS)[number];

export const ELEMENT_KO: Readonly<Record<FiveElementChar, string>> = {
  木: "목",
  火: "화",
  土: "토",
  金: "금",
  水: "수",
};

/** 오행 → '화(火)'. 모르는 값은 그대로 */
export function elementLabel(el: string): string {
  const ko = ELEMENT_KO[el as FiveElementChar];
  return ko ? `${ko}(${el})` : el;
}

/** 천간 10자 → 오행 (SajuData.Stems — 甲부터 癸까지 순서) */
export const STEM_ELEMENT: Readonly<Record<string, FiveElementChar>> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

/** 지지 12자 → 오행 (SajuData.Branches — 子부터 亥까지 순서) */
export const BRANCH_ELEMENT: Readonly<Record<string, FiveElementChar>> = {
  子: "水",
  丑: "土",
  寅: "木",
  卯: "木",
  辰: "土",
  巳: "火",
  午: "火",
  未: "土",
  申: "金",
  酉: "金",
  戌: "土",
  亥: "水",
};

/** 지지를 달 순서(인월 寅 부터)로 — 설명 글 오행 표의 지지 칸 순서 */
const BRANCH_MONTH_ORDER = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];

/** 설명 글 '오행 | 천간 | 지지' 표 — 위 두 표에서 만든다(손으로 따로 적지 않는다) */
export function elementTableRows(): { element: FiveElementChar; stems: string[]; branches: string[] }[] {
  return ELEMENTS.map((element) => ({
    element,
    stems: Object.keys(STEM_ELEMENT).filter((s) => STEM_ELEMENT[s] === element),
    branches: BRANCH_MONTH_ORDER.filter((b) => BRANCH_ELEMENT[b] === element),
  }));
}

// ============================================================
// 역할 · 강약 라벨
// ============================================================

/** 응답 elementHanja[].roles 코드 → 화면 라벨 */
export const ROLE_LABEL: Readonly<Record<string, string>> = {
  yongshin: "용신",
  heeshin: "희신",
  missing: "없는 오행",
};

/** 역할 코드 목록 → 라벨 목록(모르는 코드는 뺀다) */
export function roleLabels(roles: readonly string[]): string[] {
  return roles.map((r) => ROLE_LABEL[r]).filter((l): l is string => Boolean(l));
}

/** 한자 묶음 머리 — '목(木) · 희신 · 없는 오행' */
export function groupHeading(group: Pick<ElementHanjaGroup, "element" | "roles">): string {
  return [elementLabel(group.element), ...roleLabels(group.roles)].join(" · ");
}

/** 응답 yongshin.strength(백엔드 DayMasterStrength) → 라벨 */
export const STRENGTH_LABEL: Readonly<Record<string, string>> = {
  Strong: "신강(身强)",
  Weak: "신약(身弱)",
  Balanced: "중화(中和)",
};

// ============================================================
// 결과 문장
// ============================================================

/** 센 글자 수 → '여덟'·'여섯'(그 밖은 숫자) */
export function countWord(n: number): string {
  if (n === 8) return "여덟";
  if (n === 6) return "여섯";
  return String(n);
}

/**
 * 오행 개수 요약 한 문장(설계 §6-2 표).
 * 예: '여덟 글자 가운데 가장 많은 오행은 토(土)로 3개이고, 수(水)가 없습니다.'
 * 동률이면 '목(木)·화(火)로 2개씩이고', 없는 오행이 없으면 '다섯 오행이 모두 한 번 이상 나옵니다.'
 * strongest 는 응답 strongestElements(동률 전부) — 비어 있으면 count 에서 다시 고른다. 없는 오행은 count 가 0 인 오행.
 */
export function countSummary(
  count: Readonly<Record<string, number>>,
  characterCount: number,
  strongest: readonly string[],
): string {
  const n = (el: string) => count[el] ?? 0;
  const max = Math.max(...ELEMENTS.map(n));
  const top = ELEMENTS.filter((el) => (strongest.length > 0 ? strongest.includes(el) : n(el) === max));
  const topLabel = top.map(elementLabel).join("·");
  const topCount = top.length > 0 ? n(top[0]) : max;
  const missing = ELEMENTS.filter((el) => n(el) === 0);

  const head =
    `${countWord(characterCount)} 글자 가운데 가장 많은 오행은 ` +
    `${topLabel}${josa(topLabel, "으로/로")} ${topCount}개${top.length > 1 ? "씩" : ""}이고, `;
  if (missing.length === 0) return `${head}다섯 오행이 모두 한 번 이상 나옵니다.`;
  const missingLabel = missing.map(elementLabel).join("·");
  return `${head}${missingLabel}${josa(missingLabel, "이/가")} 없습니다.`;
}

/**
 * 없는 오행이 기신일 때 한자 예 대신 쓰는 한 줄(설계 §6-3 · D2 — 백엔드가 isGishin true 로 빈 목록을 보낸다).
 * 예: '수(水)는 원국에 없는 오행이지만, 이 사이트 계산에서는 용신 화(火)를 극하는 기신이라 …'
 */
export function gishinNote(element: string, yongshin: string): string {
  const el = elementLabel(element);
  const y = elementLabel(yongshin);
  return (
    `${el}${josa(el, "은/는")} 원국에 없는 오행이지만, 이 사이트 계산에서는 용신 ${y}${josa(y, "을/를")} 극하는 기신이라 ` +
    "이름 평가의 조화 점수에서 감점합니다. 그래서 한자 예를 싣지 않았어요."
  );
}

/** 보정 분 → '−24분'(음수는 수학 빼기표), 양수 '+3분', 0 '0분' */
export function formatMinutes(n: number): string {
  if (n < 0) return `−${-n}분`;
  if (n > 0) return `+${n}분`;
  return "0분";
}

/**
 * 원국 아래 보정 줄(설계 §6-3).
 * - 시각 없음: '시각을 몰라 시주를 빼고 여섯 글자로 셌어요. 날짜를 그대로 썼고 출생지 보정은 하지 않았어요.' — 뒤 문장은 응답이
 *   correctionApplied false 를 실을 때만 붙인다(백엔드는 2026-11 사주 계산 수정 P0 부터 시각이 없으면 보정하지 않고 이 필드를 싣는다).
 *   그 필드가 없는 응답(P0 전 백엔드 — 시각이 없어도 보정이 들어갔다)에는 붙이지 않는다. 프런트가 백엔드보다 먼저 배포돼도 틀린 말을 하지 않게.
 * - 시각 있음 · 출생지 고름: '출생지 부산 기준으로 진태양시를 보정했어요(약 −24분).'
 * - 시각 있음 · 출생지 비움: '출생지를 고르지 않아 서울 기준으로 보정했어요(약 −32분).'
 * '약' — 응답 correctionMinutes 는 반올림 정수이고 백엔드는 소수 분 그대로 계산한다(서울 −32.08분 — 시 경계 1분에서 '−32분'으로
 * 손계산한 시와 실제 시주가 다를 수 있다. 2026-11-19 반박 검토: 계산은 바꾸지 않고 화면에 '약'을 붙인다 — 설계 §16).
 */
export function correctionNote(
  data: Pick<SajuElementsResponse, "hasBirthTime" | "birthplaceDefaulted" | "characterCount"> & {
    saju: Pick<SajuElementsResponse["saju"], "birthplaceName" | "correctionMinutes" | "correctionApplied">;
  },
): string {
  if (!data.hasBirthTime) {
    const base = `시각을 몰라 시주를 빼고 ${countWord(data.characterCount)} 글자로 셌어요.`;
    return data.saju.correctionApplied === false
      ? `${base} 날짜를 그대로 썼고 출생지 보정은 하지 않았어요.`
      : base;
  }
  const minutes = `약 ${formatMinutes(data.saju.correctionMinutes)}`;
  return data.birthplaceDefaulted
    ? `출생지를 고르지 않아 ${data.saju.birthplaceName} 기준으로 보정했어요(${minutes}).`
    : `출생지 ${data.saju.birthplaceName} 기준으로 진태양시를 보정했어요(${minutes}).`;
}

/**
 * /analysis 사주 카드(DetailSaju) 아래 보정 줄 — /name-analysis 응답의 출생지·보정 분·보정 여부를 한 줄로(설계 §1-2 1·9).
 * - correctionApplied false(출생 시각 없이 계산 — 백엔드가 보정하지 않는다): '출생 시각이 없어 진태양시 보정은 하지 않았어요'
 * - 그 밖: '출생지 서울 · 진태양시 보정 약 −32분' — '약'은 위 correctionNote 와 같은 이유(응답 분은 반올림 정수, 계산은 소수 분)
 */
export function sajuCardCorrectionLine(saju: {
  birthplaceName?: string;
  correctionMinutes?: number;
  correctionApplied?: boolean;
}): string {
  if (saju.correctionApplied === false) return "출생 시각이 없어 진태양시 보정은 하지 않았어요";
  return `출생지 ${saju.birthplaceName ?? ""} · 진태양시 보정 약 ${formatMinutes(saju.correctionMinutes ?? 0)}`;
}

/**
 * 시각 없이 넣은 날이 절기가 드는 날일 때 한 줄(설계 §6-3 · P0-c — 응답 termOnBirthDay). 값이 없으면 null.
 * 입춘은 해도 바뀌므로 '월주와 연주가'. 백엔드는 시각이 없으면 그날 낮 12시(한국 표준시)로 연주·월주를 정한다
 * (SajuCalculationService.NoTimeReference) — 가운데 문장 '지금 결과는 낮 12시 기준이에요'가 그 사실이다. 기준 시각을 바꾸면 이 문장과
 * 설명 글(OhaengGuide '태어난 시각을 모를 때')을 함께 고칠 것(2026-11-19 검토 반영 — 설계 §17-8, 사용자 확인 D8).
 * /ohaeng 결과(OhaengResult)와 /analysis 사주 카드(DetailSaju)가 함께 쓴다.
 */
export function termNote(term: string | null | undefined): string | null {
  const t = term?.trim();
  if (!t) return null;
  const pillars = t === "입춘" ? "월주와 연주가" : "월주가";
  return (
    `이날은 ${t}${josa(t, "이/가")} 드는 날이라 태어난 시각에 따라 ${pillars} 달라질 수 있어요. ` +
    "지금 결과는 낮 12시 기준이에요. 시각을 넣어 다시 확인해 보세요."
  );
}

/** 용신 카드 머리 — '이 사이트 계산으로 본 용신 화(火) · 희신 목(木)' */
export function yongshinHeadline(primaryYongshin: string, heeshin: string): string {
  return `이 사이트 계산으로 본 용신 ${elementLabel(primaryYongshin)} · 희신 ${elementLabel(heeshin)}`;
}

/** 입력한 날짜·시각 → '양력 1990년 3월 15일 14시 30분'(시각 없으면 날짜까지). 화면에만 쓴다(문서 제목·URL 에 넣지 않는다) */
export function birthLabel(date: string, time?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const day = m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : date;
  const t = time ? /^(\d{2}):(\d{2})/.exec(time) : null;
  if (!t) return `양력 ${day}`;
  const minute = Number(t[2]);
  return `양력 ${day} ${Number(t[1])}시${minute ? ` ${minute}분` : ""}`;
}

/** 한자 독음 페이지 주소 — 쿼리 없는 맨 경로 */
export function hanjaHref(reading: string): string {
  return `/hanja/${encodeURIComponent(reading)}`;
}

/**
 * '이름 추천·평가는 서울 기준' 고지를 붙일지 — 시각을 넣었고 출생지가 서울이 아닐 때만.
 * /evaluate·/search 는 출생지를 받지 않고 늘 서울로 보정한다(설계 §12 '출생지 불일치').
 */
export function needsSeoulOnlyNotice(data: Pick<SajuElementsResponse, "hasBirthTime"> & { saju: { birthplaceName: string } }): boolean {
  return data.hasBirthTime && data.saju.birthplaceName !== "서울";
}

// ============================================================
// 입력 검사 · 요청 만들기
// ============================================================

/** 받는 생년월일의 시작(백엔드 SajuElementsService.MinBirthDate — 절기 계산 정확도 범위 1900~2100) */
export const MIN_BIRTH_DATE = "1900-01-01";

/** 오늘(한국 시간) yyyy-MM-dd — 백엔드도 KST 오늘까지 받는다(D6). 기기 시간대와 무관하게 UTC + 9시간 */
export function todayKst(nowMs: number = Date.now()): string {
  return new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 생년월일 입력 문제 → 화면 문장(없으면 null). 문구는 백엔드 SajuController 와 같다.
 * today 를 주지 않으면 미래 날짜 검사는 건너뛴다(서버가 다시 막는다).
 */
export function birthDateProblem(value: string, today?: string): string | null {
  const v = value.trim();
  if (!v) return "생년월일을 넣어 주세요.";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const valid =
    m !== null &&
    (() => {
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      return d.toISOString().slice(0, 10) === v;
    })();
  if (!valid) return "생년월일은 YYYY-MM-DD 형식이어야 합니다. (예: 2024-01-15)";
  if (v < MIN_BIRTH_DATE) return "생년월일은 1900년 1월 1일 이후로 넣어 주세요.";
  if (today && v > today) return "생년월일은 오늘까지의 날짜로 넣어 주세요.";
  return null;
}

/** 출생 시각 입력 문제 → 화면 문장(비어 있거나 맞으면 null). HH:mm 또는 HH:mm:ss, 00:00~23:59 */
export function birthTimeProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v) ? null : "출생 시각은 HH:mm 형식이어야 합니다. (예: 14:30)";
}

/** 오류 문장이 가리키는 입력 칸 — 화면이 그 칸에 aria-invalid·aria-describedby(오류 상자)를 켠다 */
export type ProblemField = "date" | "time" | "place";

/**
 * 오류 문장 → 그 문장이 가리키는 칸(없으면 null — 네트워크·서버 오류 등).
 * 문장은 이 파일의 입력 검사(birthDateProblem·birthTimeProblem)와 백엔드 SajuController 400 문구다 — 모두 칸 이름으로 시작한다
 * (tests/ohaeng.test.mjs 가 컨트롤러 문구 전부를 이 함수에 넣어 본다).
 */
export function problemField(message: string | null | undefined): ProblemField | null {
  const m = message?.trim() ?? "";
  if (m.startsWith("생년월일")) return "date";
  if (m.startsWith("출생 시각")) return "time";
  if (m.startsWith("출생지")) return "place";
  return null;
}

/**
 * 폼 값 → 요청 본문. 빈 값은 싣지 않는다.
 * 출생지는 시각이 있을 때만 싣는다 — 출생지는 진태양시 보정에만 쓰이고 보정은 시각이 있을 때만 한다(폼도 시각이 비면 출생지 칸을 잠근다).
 */
export function buildElementsRequest(form: {
  birthDate: string;
  birthTime: string;
  birthplaceCode: string;
}): SajuElementsRequest {
  const req: SajuElementsRequest = { birthDate: form.birthDate.trim() };
  const time = form.birthTime.trim();
  if (time) {
    req.birthTime = time;
    const place = form.birthplaceCode.trim();
    if (place) req.birthplaceCode = place;
  }
  return req;
}
