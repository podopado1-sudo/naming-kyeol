/**
 * 한자 입력(/evaluate 음절별 한자 칸)의 순수 로직 — 2026-11 설계 docs/plan-hanja-input-2026-11.md §5-5·§8-1·§8-6·§10-1.
 *
 * "use client" 가 없는 순수 모듈이다 — 클라이언트 화면(칸 줄·고르기 패널·결과 블록), 서버 컴포넌트(/name·/hanja 의 링크),
 * URL 모듈(app/evaluate/evaluate-params.ts), node --test(tests/hanja-pick.test.mjs)가 함께 읽는다.
 * 큰 정적 JSON 을 import 하는 lib/hanja-seo·lib/name-seo 를 여기서 import 하지 않는다(클라이언트 번들에 실린다).
 *
 * 서버가 기준이다. 여기 있는 정리·범위·두음 규칙은 서버(Application/Engines/Utils/HanjaInput.cs · HanjaData.IsHanCodePoint ·
 * RequiredCharEngine.ApplyInitialDueum)와 같은 규칙의 미리보기이고, 서버는 화면을 믿지 않고 다시 검사한다.
 * 같은 규칙을 두 번 적은 자리는 tests/hanja-pick.test.mjs 가 백엔드 원문·정적 후보 파일(public/data/hanja-pick/v1)과 대조한다.
 *
 * 주의: 호환 한자(U+F900~FAFF·U+2F800~2FA1F)·BMP 밖 글자·보이지 않는 글자(폭 없는 문자·이체 선택자)는 이 파일에 글자로 적지 않는다 —
 *   코드포인트 숫자로만(편집 도구의 정규화로 통합 한자로 바뀐 회귀 전력 — 백엔드 HanjaData.ToUnifiedHanja 경고와 같다).
 * 주의: 이름·한자·생년월일은 개인정보다 — 이 모듈은 콘솔·분석 이벤트에 아무것도 남기지 않는다.
 */
import { rolesOf } from "./ohaeng-relation";
import type {
  ElementFit,
  HanjaFact,
  HanjaFill,
  HanjaSummary,
  SurnameHanjaSource,
  SyllableHanjaSource,
} from "./types";

// 설계 §8-1 은 rolesOf 를 이 모듈의 함수로 적었다 — 정의는 오행 쪽 모듈(lib/ohaeng-relation.ts)에 두고 여기서도 내보낸다.
export { rolesOf };

// ============================================================
// 칸 표시 글자 · 정적 후보 파일 주소
// ============================================================

/** 칸 표시 글자 — 자동(서버가 고른다). 서버 HanjaInput.AutoMark */
export const AUTO = "*";
/** 칸 표시 글자 — 한자 없이 한글로(이름 칸에만). 서버 HanjaInput.NoneMark */
export const NONE = "-";

/** 음절별 후보 파일이 놓인 자리(public/ 아래 — 백엔드 `dotnet run -- dump-hanja-pick` 산출물) */
export const HANJA_PICK_BASE = "/data/hanja-pick/v1";
/** 음절 목록·성씨 기본 한자·숫자가 든 색인 — 화면에 쓰는 숫자의 기준은 늘 이 파일이다 */
export const HANJA_PICK_INDEX = `${HANJA_PICK_BASE}/index.json`;

// ============================================================
// 코드포인트 판정 (서버와 같은 범위 — 테스트가 C# 원문과 대조)
// ============================================================

type Range = readonly [number, number];

function inRanges(cp: number, ranges: readonly Range[]): boolean {
  for (const [lo, hi] of ranges) if (cp >= lo && cp <= hi) return true;
  return false;
}

/** 서버 HanjaData.IsHanCodePoint 의 여섯 범위 — 확장 A · 기본 · 호환 · 확장 B~F · 호환 보충 · 확장 G~H */
export const HAN_RANGES: readonly Range[] = [
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xf900, 0xfaff],
  [0x20000, 0x2ebef],
  [0x2f800, 0x2fa1f],
  [0x30000, 0x323af],
];

/**
 * 유니코드 한자 영역의 코드포인트인가 — 서버 HanjaData.IsHanCodePoint 와 같은 여섯 범위.
 * (기존 required-char 화면의 isHanjaChar 는 u 플래그 없는 BMP 정규식이라 확장 B 글자를 놓친다 — 쓰지 않는다.)
 */
export function isHanCodePoint(cp: number): boolean {
  return Number.isInteger(cp) && inRanges(cp, HAN_RANGES);
}

/** 호환 한자 블록 둘 — 정리(NFKC) 뒤에도 여기 남은 코드는 아래 12자가 아니면 글자가 아니다 */
const COMPATIBILITY_BLOCKS: readonly Range[] = [
  [0xf900, 0xfaff],
  [0x2f800, 0x2fa1f],
];

/** 서버 HanjaInput.NormalizeRune 이 NFKC 를 거는 네 범위 — 호환 한자 둘 · 강희 부수 · 부수 보충 */
export const NORMALIZE_RANGES: readonly Range[] = [
  ...COMPATIBILITY_BLOCKS,
  [0x2f00, 0x2fd5],
  [0x2e80, 0x2ef3],
];

/** 호환 한자 블록(U+F900~FAFF) 안의 통합 한자 12자 — 정규형이 자기 자신인 '진짜 글자'(서버 UnifiedInCompatibilityBlock) */
export const UNIFIED_IN_COMPATIBILITY_BLOCK: readonly number[] = [
  0xfa0e, 0xfa0f, 0xfa11, 0xfa13, 0xfa14, 0xfa1f, 0xfa21, 0xfa23, 0xfa24, 0xfa27, 0xfa28, 0xfa29,
];

/**
 * 서버 Rune.IsWhiteSpace 가 참인 코드포인트 — 유니코드 White_Space 25개(전각 공백 U+3000 포함).
 * 자바스크립트의 \s 는 U+0085 를 빼고 U+FEFF 를 넣어 서버와 다르므로 범위를 직접 적는다(2026-11-19 로컬 서버 /hanja/resolve 로 실측).
 */
const WHITE_SPACE_RANGES: readonly Range[] = [
  [0x09, 0x0d],
  [0x20, 0x20],
  [0x85, 0x85],
  [0xa0, 0xa0],
  [0x1680, 0x1680],
  [0x2000, 0x200a],
  [0x2028, 0x2029],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
];

/** 서버 HanjaInput.IsIgnorable 이 공백 말고 더 지우는 범위 — 폭 없는 문자(U+200B~200D·U+FEFF) · 이체 선택자(U+FE00~FE0F·U+E0100~E01EF) */
export const INVISIBLE_RANGES: readonly Range[] = [
  [0x200b, 0x200d],
  [0xfeff, 0xfeff],
  [0xfe00, 0xfe0f],
  [0xe0100, 0xe01ef],
];

function isIgnorable(cp: number): boolean {
  return inRanges(cp, WHITE_SPACE_RANGES) || inRanges(cp, INVISIBLE_RANGES);
}

/**
 * 호환 한자·강희 부수·부수 보충이면 그 한 글자에 NFKC 를 걸고, 결과가 한자 한 글자일 때만 그것으로 바꾼다(서버 NormalizeRune).
 * 범위를 정해 두는 까닭: 범위 없이 NFKC 를 걸면 동그라미 문자 같은 기호까지 한자가 된다.
 */
function normalizeHanCodePoint(cp: number): number {
  if (!inRanges(cp, NORMALIZE_RANGES)) return cp;
  const normalized = String.fromCodePoint(cp).normalize("NFKC");
  const first = normalized.codePointAt(0);
  if (first === undefined) return cp;
  const single = String.fromCodePoint(first).length === normalized.length;
  return single && isHanCodePoint(first) ? first : cp;
}

/**
 * 정리(cleanHanjaText)를 지난 코드포인트가 한자인가 — 서버 HanjaInput.Lookup 의 IsHan.
 * 여섯 범위에 들되, 호환 블록에 남은 코드는 통합 한자 12자가 아니면 배정되지 않은 코드라 한자가 아니다
 * (그런 코드에 '사전에 없는 글자' 안내가 붙지 않게 — 설계 §5-1 7번).
 */
export function isHanAfterClean(cp: number): boolean {
  if (!isHanCodePoint(cp)) return false;
  return !inRanges(cp, COMPATIBILITY_BLOCKS) || UNIFIED_IN_COMPATIBILITY_BLOCK.includes(cp);
}

// ============================================================
// 입력 문자열 → 글자 (설계 §5-1 의 2·6번, §5-5)
// ============================================================

/**
 * 입력 정리 — 코드포인트 단위로 ① 홀로 남은 서로게이트 ② 공백류 ③ 폭 없는 문자·이체 선택자를 지우고
 * ④ 호환 한자·강희 부수·부수 보충을 통합 한자로 바꾼다. 그 밖의 글자(한글·`*`·`-`·기호)는 그대로 둔다 — 걸러 내는 일은 부르는 쪽이 한다.
 *
 * ①은 서버에 없는 단계다: 홀로 남은 서로게이트는 JSON.stringify 가 \udXXX 로 내보내고, 서버는 그 본문을 역직렬화하지 못해
 * 프레임워크의 영문 400 을 돌려준다(code·target·slot 없음 — 설계 §4-4). 그래서 보내기 전에 여기서 지운다.
 */
export function cleanHanjaText(text: string | null | undefined): string {
  if (!text) return "";
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp >= 0xd800 && cp <= 0xdfff) continue; // 짝 없는 서로게이트(짝이 맞으면 한 코드포인트로 묶여 온다)
    if (isIgnorable(cp)) continue;
    out += String.fromCodePoint(normalizeHanCodePoint(cp));
  }
  return out;
}

/** 정리한 뒤의 한자만 차례로(글자마다 한 코드포인트) — 붙여 넣은 글에서 한자를 뽑는다. 한글·기호·표시 글자는 버린다 */
export function hanCharsOf(text: string | null | undefined): string[] {
  const chars: string[] = [];
  for (const ch of cleanHanjaText(text)) {
    if (isHanAfterClean(ch.codePointAt(0) ?? -1)) chars.push(ch);
  }
  return chars;
}

/**
 * 판정 API(/hanja/resolve)에 보낼 한 글자 — 정리한 뒤의 첫 한자 **한 코드포인트**. 한자가 없으면 null.
 * 붙여 넣은 원문을 서버로 보내지 않기 위한 함수다(클립보드에 함께 있던 이름·전화번호가 가지 않게 — 설계 §4-5).
 */
export function firstHanCodePoint(text: string | null | undefined): string | null {
  for (const ch of cleanHanjaText(text)) {
    if (isHanAfterClean(ch.codePointAt(0) ?? -1)) return ch;
  }
  return null;
}

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;

/**
 * 비지 않았고 모든 글자가 한글 음절(가 U+AC00 ~ 힣 U+D7A3)인가 — 서버 HanjaInput.IsHangulSyllables.
 * 참이면 UTF-16 길이 = 글자 수 = 칸 수다. 낱자모(ㅅ)·공백·한자가 섞이면 거짓 — 칸을 만들지 않고 한자 필드도 보내지 않는다.
 */
export function isHangulSyllables(text: string | null | undefined): boolean {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < HANGUL_FIRST || code > HANGUL_LAST) return false;
  }
  return true;
}

function isOneHangulSyllable(text: string): boolean {
  return text.length === 1 && isHangulSyllables(text);
}

// ============================================================
// 두음 (서버 RequiredCharEngine.ApplyInitialDueum 과 같은 자모 규칙)
// ============================================================

/** 초성 번호 — ㄴ·ㄹ·ㅇ (음절 = 0xAC00 + (초성×21 + 중성)×28 + 종성) */
export const DUEUM_INITIALS = { nieun: 2, rieul: 5, ieung: 11 } as const;
/** ㅣ계 모음의 중성 번호 — ㅑ·ㅕ·ㅖ·ㅛ·ㅠ·ㅣ */
export const DUEUM_IOTIZED_VOWELS: readonly number[] = [2, 6, 7, 12, 17, 20];

/**
 * 두음 꼴 — ㄹ/ㄴ + ㅣ계 모음 → ㅇ(룡→용·녀→여), 그 밖의 ㄹ → ㄴ(라→나·뢰→뇌). 걸리지 않으면 그대로.
 * 한글 음절 한 글자가 아니면 그대로 돌려준다.
 */
export function applyInitialDueum(syllable: string): string {
  if (!isOneHangulSyllable(syllable)) return syllable;
  const code = syllable.charCodeAt(0) - HANGUL_FIRST;
  const initial = Math.floor(code / 588);
  const rest = code % 588; // 중성·종성은 그대로
  const iotized = DUEUM_IOTIZED_VOWELS.includes(Math.floor(rest / 28));
  const violates = initial === DUEUM_INITIALS.rieul || (initial === DUEUM_INITIALS.nieun && iotized);
  if (!violates) return syllable;
  const next = iotized ? DUEUM_INITIALS.ieung : DUEUM_INITIALS.nieun;
  return String.fromCharCode(HANGUL_FIRST + next * 588 + rest);
}

/**
 * 이 독음들의 글자를 넣을 수 있는 음절 — 독음 전부와 그 두음 꼴, 중복 없이(순서: 독음 → 두음 꼴). 서버 HanjaInput.AcceptedSyllables 와 같다.
 * 한쪽 방향이다: 본음 독음(림)을 두음 꼴 칸(임)에 받지만, 두음 독음뿐인 글자(나)를 본음 칸(라)에 받지는 않는다.
 * `#pick` 으로 들고 온 글자가 들어갈 음절을 서버 없이 정하는 데만 쓴다 — 넣어도 되는지는 음절 파일과 서버가 판정한다.
 */
export function acceptedSyllablesOf(readings: readonly string[]): string[] {
  const list: string[] = [];
  const valid = readings.filter((r) => !!r);
  for (const r of valid) if (!list.includes(r)) list.push(r);
  for (const r of valid) {
    if (r.length !== 1) continue;
    const dueum = applyInitialDueum(r);
    if (!list.includes(dueum)) list.push(dueum);
  }
  return list;
}

// ============================================================
// 주소 꼴 ↔ 칸 ↔ API 꼴 (설계 §10-1)
//
// 칸마다 한 글자: 통합 한자 / AUTO / NONE.
// - 주소·저장 꼴: 끝의 `*` 를 뺀다. 전부 자동이면 "" (`hanja=瑞` = 둘째 칸 자동, `hanja=*潤`, `hanja=瑞-`).
// - API 꼴: 전체 길이(`瑞*`) — 서버는 글자 수가 이름 글자 수와 정확히 같아야 받는다.
// ============================================================

/** 칸 → 주소 꼴. 전부 자동이면 "", 끝의 `*` 는 생략한다 */
export function encodeHanjaParam(marks: readonly string[]): string {
  let end = marks.length;
  while (end > 0 && (marks[end - 1] || AUTO) === AUTO) end--;
  return marks
    .slice(0, end)
    .map((m) => m || AUTO)
    .join("");
}

export interface HanjaParamOptions {
  /** `-`(한자 없이)를 받는가 — 성씨는 false(서버가 surname_none 으로 막는다). 기본 true */
  allowNone?: boolean;
}

/**
 * 주소 꼴 → 칸 `length` 개. 짧으면 `*` 로 채우고, 버릴 값이면 전부 `*` 다.
 * 버리는 값: 칸 수보다 길다 · 한자·표시 글자 밖의 글자가 섞였다 · (성씨) `-` 가 있다.
 * 읽기 전에 정리(cleanHanjaText)를 걸어 호환 한자로 적힌 주소도 통합 한자로 읽는다.
 */
export function decodeHanjaParam(
  value: string | null | undefined,
  length: number,
  options: HanjaParamOptions = {}
): string[] {
  const size = Math.max(0, Math.floor(length) || 0);
  const auto = Array.from({ length: size }, () => AUTO);
  const chars = [...cleanHanjaText(value)];
  if (chars.length === 0 || chars.length > size) return auto;
  for (const ch of chars) {
    if (ch === AUTO) continue;
    if (ch === NONE) {
      if (options.allowNone === false) return auto;
      continue;
    }
    if (!isHanAfterClean(ch.codePointAt(0) ?? -1)) return auto;
  }
  return [...chars, ...auto.slice(chars.length)];
}

/** 주소 꼴의 정규화 — 통합 한자, 끝의 `*` 생략, 버릴 값은 "" */
export function canonicalHanja(
  value: string | null | undefined,
  length: number,
  options: HanjaParamOptions = {}
): string {
  return encodeHanjaParam(decodeHanjaParam(value, length, options));
}

/** 칸 → API 꼴(전체 길이). 전부 자동이면 "" — 그때는 필드를 보내지 않는다 */
export function toApiHanja(marks: readonly string[]): string {
  const filled = marks.map((m) => m || AUTO);
  return filled.every((m) => m === AUTO) ? "" : filled.join("");
}

/**
 * /evaluate 요청에 실을 한자 필드 둘 — 주소 꼴을 이름·성씨 길이로 풀어 전체 길이로 만든다.
 * 지정이 없는 필드는 싣지 않고, **이름이나 성씨가 한글 음절만이 아니면 둘 다 싣지 않는다**(서버가 name_not_hangul 로 막는 입력이다 — 설계 §8-2).
 */
export function apiHanjaFields(input: {
  name: string;
  lastName: string;
  hanja?: string | null;
  lastHanja?: string | null;
}): { nameHanja?: string; lastNameHanja?: string } {
  const name = input.name.trim();
  const lastName = input.lastName.trim();
  if (!isHangulSyllables(name) || !isHangulSyllables(lastName)) return {};
  const nameHanja = toApiHanja(decodeHanjaParam(input.hanja, name.length));
  const lastNameHanja = toApiHanja(decodeHanjaParam(input.lastHanja, lastName.length, { allowNone: false }));
  const fields: { nameHanja?: string; lastNameHanja?: string } = {};
  if (nameHanja) fields.nameHanja = nameHanja;
  if (lastNameHanja) fields.lastNameHanja = lastNameHanja;
  return fields;
}

/**
 * 응답이 돌려준 정규 꼴(전체 길이) → 주소 꼴. 평가 뒤 주소·저장·서명을 이 값으로 다시 쓴다(설계 §8-2).
 * hanjaSummary 가 없는 응답(옛 백엔드·한글 음절이 아닌 이름)이면 null — 그때는 보낸 입력을 그대로 쓴다.
 */
export function hanjaFromSummary(
  summary: HanjaSummary | null | undefined
): { hanja: string; lastHanja: string } | null {
  if (!summary) return null;
  return {
    hanja: encodeHanjaParam([...cleanHanjaText(summary.nameHanja)]),
    lastHanja: encodeHanjaParam([...cleanHanjaText(summary.lastNameHanja)]),
  };
}

// ============================================================
// 정적 후보 파일 (설계 §4-6)
// ============================================================

/** 음절의 후보 파일 주소 — `/data/hanja-pick/v1/c11c.json`(코드포인트 16진 소문자). 한글 음절 한 글자가 아니면 null */
export function syllableFile(syllable: string): string | null {
  if (!isOneHangulSyllable(syllable)) return null;
  return `${HANJA_PICK_BASE}/${syllable.charCodeAt(0).toString(16)}.json`;
}

/** index.json 의 음절 항목 */
export interface HanjaPickSyllableInfo {
  /** 그 음절로 읽는 사전 글자 수 */
  all: number;
  /** 그중 쓸 수 있는 글자(이름에 피하는 글자가 아니고 한글 훈이 있다) 수 */
  usable: number;
  /** 자동 배정이 비는 음절일 때만 true 로 실린다(서버가 그 자리의 `-` 를 자동으로 접는 기준과 같은 값) */
  autoEmpty?: boolean;
}

/** index.json */
export interface HanjaPickIndex {
  version: number;
  counts: { characters: number; syllables: number; pairs: number; forbidden: number; common: number };
  /** 후보 파일이 있는 음절 — 여기에 없는 음절(봄·빛)은 잠긴 칸이다 */
  syllables: Record<string, HanjaPickSyllableInfo>;
  /** 성씨 → 기본으로 두는 한자(대표 한자 표 — 김 金·남궁 南宮) */
  surnames: Record<string, string>;
}

/** 음절 파일의 글자 한 줄 — 기본값(false·빈 목록)인 필드는 빠져 있다 */
export type HanjaPickEntry = Pick<
  HanjaFact,
  "character" | "gloss" | "fiveElement" | "resourceGrade" | "strokeCount" | "yinYang"
> &
  Partial<Pick<HanjaFact, "vReasons" | "common" | "forbidden" | "hasMeaning" | "basic">>;

/** 음절 파일의 한 줄 → HanjaFact. 없는 필드는 false·[] 로 읽는다(hasMeaning 이 없는 글자 = 뜻 풀이 없는 글자) */
export function toHanjaFact(entry: HanjaPickEntry): HanjaFact {
  return {
    character: entry.character,
    gloss: entry.gloss ?? "",
    fiveElement: entry.fiveElement ?? "",
    resourceGrade: entry.resourceGrade ?? "U",
    vReasons: Array.isArray(entry.vReasons) ? entry.vReasons : [],
    strokeCount: typeof entry.strokeCount === "number" ? entry.strokeCount : 0,
    yinYang: entry.yinYang ?? "",
    common: entry.common === true,
    forbidden: entry.forbidden === true,
    hasMeaning: entry.hasMeaning === true,
    basic: entry.basic === true,
  };
}

/** 받은 음절 파일(JSON)을 읽는다 — 꼴이 다르면 null. 글자가 한자 한 글자가 아닌 줄은 버린다 */
export function parsePickFile(raw: unknown): HanjaFact[] | null {
  if (!raw || typeof raw !== "object") return null;
  const list = (raw as { hanja?: unknown }).hanja;
  if (!Array.isArray(list)) return null;
  const facts: HanjaFact[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const character = (item as { character?: unknown }).character;
    if (typeof character !== "string") continue;
    const chars = [...character];
    if (chars.length !== 1 || !isHanAfterClean(chars[0].codePointAt(0) ?? -1)) continue;
    facts.push(toHanjaFact(item as HanjaPickEntry));
  }
  return facts;
}

/** 받은 index.json 을 읽는다 — 꼴이 다르면 null */
export function parsePickIndex(raw: unknown): HanjaPickIndex | null {
  if (!raw || typeof raw !== "object") return null;
  const index = raw as Partial<HanjaPickIndex>;
  if (!index.syllables || typeof index.syllables !== "object") return null;
  if (!index.surnames || typeof index.surnames !== "object") return null;
  if (!index.counts || typeof index.counts !== "object") return null;
  return index as HanjaPickIndex;
}

/**
 * 성씨 칸에 넣는 글자 사실 — 이름용 표시(이름에 피하는 글자·먼저 보여 드리는 글자)를 뗀다. 서버가 성씨 글자에 싣는 꼴과 같다
 * (hanjaSummary.surname.chars · /hanja/resolve target "surname"). 음절 파일은 이름·성씨 패널이 함께 써서 표시가 그대로 들어 있다.
 */
export function asSurnameFact(fact: HanjaFact): HanjaFact {
  return fact.forbidden || fact.common ? { ...fact, forbidden: false, common: false } : fact;
}

// ============================================================
// 칸 상태 — 저장하지 않고 매번 계산한다 (설계 §8-6)
// ============================================================

export type SlotTarget = "surname" | "name";

/**
 * 사용자가 **직접 고른 것** — 고른 글자 / '한자 없이 한글로' / '자동으로 고르기'.
 * 'auto' 는 고르기를 되돌린 표시다. 들고 온 글자(#pick)가 든 칸에서도 [자동으로 고르기]가 먹히도록 키를 지우는 대신 이 값을 둘 수 있다
 * (키를 지우면 들고 온 글자가 다시 들어온다).
 */
export type HanjaChoice = { kind: "hanja"; fact: HanjaFact } | { kind: "none" } | { kind: "auto" };

/** 선택 저장 키 — 같은 자리·같은 음절이 돌아오면 선택이 되살아난다(서윤 → 서연 → 서윤) */
export function choiceKey(target: SlotTarget, index: number, syllable: string): string {
  return `${target}:${index}:${syllable}`;
}

/** 해시(#pick)로 들고 온 글자 */
export interface PendingPick {
  character: string;
  /** 주소에 적혀 온 독음(한글 음절 한 글자씩, 최대 4개) — 표시와 파일 고르기에만 쓴다 */
  readings: string[];
}

export type HanjaSlotState =
  /** 직접 고른 한자 */
  | "picked"
  /** 들고 온 글자(#pick)가 들어간 칸 */
  | "carried"
  /** 들고 온 글자가 들어갈 음절인데 그 음절 파일을 아직 받지 못했다('확인 중') */
  | "checking"
  /** 사용자가 고른 '한자 없이 한글로' — 이것만 `-` 로 보낸다 */
  | "none"
  /** 성씨 — 기본으로 두는 한자(대표 한자 표) */
  | "default"
  /** 자동 */
  | "auto"
  /** 이름 — 자동 배정이 없는 음절(쓸 글자 0자). 화면은 '한글', 열 수는 있다. `*` 로 보낸다 */
  | "hangul"
  /** 후보 파일이 없는 음절(인명용 한자 독음이 아님 — 봄·빛). 화면은 '한글', 잠김. `*` 로 보낸다 */
  | "locked";

export interface HanjaSlot {
  target: SlotTarget;
  /** 그 줄(성씨 줄 · 이름 줄) 안의 자리 — 0부터 */
  index: number;
  syllable: string;
  state: HanjaSlotState;
  /** 칸에 그릴 한자 — 없으면 null('자동'·'한글') */
  character: string | null;
  /** 글자 사실 — 고른 글자·들고 온 글자에만 있다(성씨 기본 한자는 index.json 이 글자만 알려 준다) */
  fact: HanjaFact | null;
  /** 주소·서버로 보내는 값 — 통합 한자 / AUTO / NONE */
  mark: string;
  /** 고르기 패널을 열 수 있는가 — 후보 파일이 있는 음절(색인을 아직 못 받았으면 true 로 둔다) */
  openable: boolean;
}

export interface DerivedSlots {
  /** 성씨 줄 — 성씨가 비었으면 [], 한글 음절만이 아니면 null(직전 칸 줄을 그대로 둔다) */
  surname: HanjaSlot[] | null;
  /** 이름 줄 — 같은 규칙 */
  name: HanjaSlot[] | null;
}

type PickFiles = ReadonlyMap<string, readonly HanjaFact[]>;

function slotsFor(
  text: string,
  build: (syllable: string, index: number) => HanjaSlot
): HanjaSlot[] | null {
  if (text === "") return [];
  if (!isHangulSyllables(text)) return null;
  return [...text].map(build);
}

/**
 * 성씨의 `position` 번째 글자에 기본으로 두는 한자(대표 한자 표 — index.json `surnames`). 표에 없는 성씨면 null.
 * 표의 글자 수가 성씨 글자 수와 같을 때만 자리로 읽는다(복성 '남궁' → 南·宮).
 */
export function surnameDefaultAt(
  index: HanjaPickIndex | null | undefined,
  lastName: string,
  position: number
): string | null {
  const name = lastName.trim();
  if (!index || !Object.prototype.hasOwnProperty.call(index.surnames, name)) return null;
  const chars = [...index.surnames[name]];
  return chars.length === name.length ? (chars[position] ?? null) : null;
}

/**
 * 칸 상태를 파생한다 — 조합이 끝난 성·이름(`settled`), 직접 고른 것(`choices`), 들고 온 글자(`pendingPick`),
 * 색인(`index`), 받아 둔 음절 파일(`files`)에서 매번 계산한다. 지나온 중간 값(ㅅ → 서 → 성 → 서유 → 서윤)과 무관하다.
 *
 * 자리마다:
 * 1. `choices` 에 그 자리·그 음절의 키가 있으면 그 값(고른 글자 / 한자 없이 / 자동).
 * 2. 없고, 이름 칸이고, 들고 온 글자가 앞 자리에 아직 안 들어갔고, 그 음절이 들고 온 글자를 받는 음절이면:
 *    그 음절 파일에 그 글자가 있으면 그 글자('carried'), 파일을 아직 못 받았으면 'checking'.
 * 3. 없으면 기본 상태 — 성씨는 대표 한자('default') 또는 '자동', 이름은 '자동' / 쓸 글자 0자('hangul') / 후보 파일 없음('locked').
 *
 * 잠긴 칸·쓸 글자 0자 칸은 화면에는 '한글'이지만 `*` 로 보낸다 — `-` 로 보내면 한자를 하나도 고르지 않은 '한빛'이 지정 경로를 탄다.
 * 그런 칸의 '한자 없이' 선택도 `*` 다(서버가 접는 것과 같다). 성씨 칸은 '한자 없이'를 받지 않는다.
 * 색인을 아직 못 받았으면(`index` null) 기본 상태를 모두 '자동'으로 둔다.
 */
export function deriveSlots(
  settled: { lastName: string; firstName: string },
  choices: ReadonlyMap<string, HanjaChoice>,
  pendingPick: PendingPick | null | undefined,
  index: HanjaPickIndex | null | undefined,
  files: PickFiles
): DerivedSlots {
  const lastName = settled.lastName.trim();
  const firstName = settled.firstName.trim();
  const hasFile = (syllable: string) => !index || syllable in index.syllables;

  const surnameDefault = (i: number) => surnameDefaultAt(index, lastName, i);

  const surname = slotsFor(lastName, (syllable, i) => {
    const openable = hasFile(syllable);
    const choice = choices.get(choiceKey("surname", i, syllable));
    if (choice?.kind === "hanja") {
      const fact = asSurnameFact(choice.fact);
      return { target: "surname", index: i, syllable, state: "picked", character: fact.character, fact, mark: fact.character, openable };
    }
    const character = surnameDefault(i);
    const state: HanjaSlotState = character ? "default" : openable ? "auto" : "locked";
    return { target: "surname", index: i, syllable, state, character, fact: null, mark: AUTO, openable };
  });

  const accepted = pendingPick ? acceptedSyllablesOf(pendingPick.readings) : [];
  let pickPlaced = false;

  const name = slotsFor(firstName, (syllable, i) => {
    const openable = hasFile(syllable);
    const autoEmpty = !!index && index.syllables[syllable]?.autoEmpty === true;
    const base = { target: "name" as const, index: i, syllable, openable };
    const plain = (): HanjaSlot => ({
      ...base,
      state: !openable ? "locked" : autoEmpty ? "hangul" : "auto",
      character: null,
      fact: null,
      mark: AUTO,
    });

    const choice = choices.get(choiceKey("name", i, syllable));
    if (choice?.kind === "hanja") {
      return { ...base, state: "picked", character: choice.fact.character, fact: choice.fact, mark: choice.fact.character };
    }
    if (choice?.kind === "none") {
      return openable && !autoEmpty ? { ...base, state: "none", character: null, fact: null, mark: NONE } : plain();
    }
    if (choice?.kind === "auto") return plain();

    if (pendingPick && !pickPlaced && accepted.includes(syllable)) {
      const file = files.get(syllable);
      if (!file) {
        pickPlaced = true; // 파일이 오면 다시 계산한다 — 그때까지 뒤 칸을 '확인 중'으로 늘리지 않는다
        return { ...base, state: "checking", character: null, fact: null, mark: AUTO };
      }
      const fact = file.find((f) => f.character === pendingPick.character);
      if (fact) {
        pickPlaced = true;
        return { ...base, state: "carried", character: fact.character, fact, mark: fact.character };
      }
    }
    return plain();
  });

  return { surname, name };
}

/** 칸 줄 → 표시 글자들(주소 꼴은 `encodeHanjaParam(marksOf(…))`, API 꼴은 `toApiHanja(marksOf(…))`) */
export function marksOf(slots: readonly HanjaSlot[] | null | undefined): string[] {
  return (slots ?? []).map((s) => s.mark);
}

/** 들고 온 글자가 들어갈 수 있는 음절 가운데 이 이름에 있는 것(중복 없이, 이름 순서) — 그 음절 파일만 받는다 */
export function pickSyllablesIn(pick: PendingPick, firstName: string): string[] {
  const accepted = acceptedSyllablesOf(pick.readings);
  const found: string[] = [];
  for (const syllable of firstName.trim()) {
    if (accepted.includes(syllable) && !found.includes(syllable)) found.push(syllable);
  }
  return found;
}

/**
 * 들고 온 글자의 독음 가운데 **음절 파일로 확인된 것** — 띠에는 이 독음만 적는다(주소에 적힌 낱말을 그대로 화면에 옮기지 않는다).
 * `ready` 는 그 독음들의 파일을 모두 받았는가. 다 받았는데 `readings` 가 비면 들고 온 글자를 버린다(손으로 고친 주소·사전에 없는 글자).
 */
export function confirmedPickReadings(pick: PendingPick, files: PickFiles): { ready: boolean; readings: string[] } {
  let ready = true;
  const readings: string[] = [];
  for (const reading of pick.readings) {
    const file = files.get(reading);
    if (!file) {
      ready = false;
      continue;
    }
    if (file.some((f) => f.character === pick.character)) readings.push(reading);
  }
  return { ready, readings };
}

// ============================================================
// 주소로 온 한자(시드)의 검사 · 붙여넣기 나눠 넣기 (설계 §8-5)
// ============================================================

export type SeedCheck =
  /** 자동(`*`) */
  | { status: "auto" }
  /** 한자 없이(`-`) */
  | { status: "none" }
  /** 그 음절 후보에 있는 글자 */
  | { status: "ok"; fact: HanjaFact }
  /** 그 음절 파일을 아직 못 받았다 */
  | { status: "pending"; character: string }
  /** 그 음절 후보에 없는 글자 — 칸을 비우고(자동) 알린다 */
  | { status: "rejected"; character: string };

/**
 * 주소로 들어온 한자(주소 꼴)를 칸마다 그 음절 파일로 검사한다. `text` 는 한글 성씨 또는 이름.
 * 한글 음절만이 아니면 null. 성씨 칸의 글자 사실에는 이름용 표시를 떼어 준다.
 */
export function checkSeed(
  target: SlotTarget,
  text: string,
  hanja: string | null | undefined,
  files: PickFiles
): SeedCheck[] | null {
  const value = text.trim();
  if (!isHangulSyllables(value)) return null;
  const marks = decodeHanjaParam(hanja, value.length, { allowNone: target === "name" });
  return marks.map((mark, i): SeedCheck => {
    if (mark === AUTO) return { status: "auto" };
    if (mark === NONE) return { status: "none" };
    const file = files.get(value[i]);
    if (!file) return { status: "pending", character: mark };
    const fact = file.find((f) => f.character === mark);
    if (!fact) return { status: "rejected", character: mark };
    return { status: "ok", fact: target === "surname" ? asSurnameFact(fact) : fact };
  });
}

export interface SeedSlotRef {
  /** 선택 저장 키(choiceKey) */
  key: string;
  target: SlotTarget;
  index: number;
  syllable: string;
  character: string;
}

export interface SeedChoices {
  /** 그 음절 후보로 확인된 칸 — 직접 고른 것과 같은 꼴(같은 자리·같은 음절이 돌아오면 되살아난다) */
  choices: Map<string, HanjaChoice>;
  /** 그 음절 파일을 아직 받지 못한 칸 */
  pending: SeedSlotRef[];
  /** 그 음절 후보에 없어 비운 칸 — 화면이 알린다 */
  rejected: SeedSlotRef[];
}

/**
 * 주소로 들어온 한자(시드)를 칸 선택으로 바꾼다 — 칸마다 그 음절 파일로 검사해(checkSeed) 맞는 글자만 선택이 된다.
 * 맞지 않는 글자는 선택이 되지 않아 칸이 비고(자동), `rejected` 로 돌려준다. 파일을 아직 못 받은 칸은 `pending`.
 * 성씨·이름 가운데 한글 음절만이 아닌 쪽은 건너뛴다.
 */
export function seedChoices(
  seed: { lastName: string; firstName: string; hanja?: string | null; lastHanja?: string | null },
  files: PickFiles
): SeedChoices {
  const result: SeedChoices = { choices: new Map(), pending: [], rejected: [] };
  const rows: [SlotTarget, string, string | null | undefined][] = [
    ["surname", seed.lastName.trim(), seed.lastHanja],
    ["name", seed.firstName.trim(), seed.hanja],
  ];
  for (const [target, text, hanja] of rows) {
    const checks = checkSeed(target, text, hanja, files);
    if (!checks) continue;
    checks.forEach((check, index) => {
      const syllable = text[index];
      const key = choiceKey(target, index, syllable);
      if (check.status === "ok") result.choices.set(key, { kind: "hanja", fact: check.fact });
      else if (check.status === "none") result.choices.set(key, { kind: "none" });
      else if (check.status === "pending") {
        result.pending.push({ key, target, index, syllable, character: check.character });
      } else if (check.status === "rejected") {
        result.rejected.push({ key, target, index, syllable, character: check.character });
      }
    });
  }
  return result;
}

/**
 * 제출할 칸의 표시 글자 — 칸의 `mark` 그대로이되, **확인을 기다리는 칸은 기다리던 글자를 싣는다**:
 * ① 주소로 온 한자(`waiting` — 칸 키 → 글자, 그 음절 파일을 아직 받는 중인 칸 — 화면은 '확인 중')
 * ② 들고 온 글자(#pick)가 들어갈 '확인 중' 칸(`pick`).
 * 기다리는 동안 제출하면 그 칸이 말없이 자동으로 계산되던 것(사용자가 맞춰 보려던 조합이 아닌 조합)을 막는다.
 * 넣어도 되는 글자인지는 서버가 다시 검사한다 — 맞지 않으면 400 의 target·slot 으로 폼이 그 칸을 연다.
 * 파일을 받지 못한(실패) 칸은 `waiting` 에 넣지 않는다 — 화면이 '자동으로 두었다'고 알리고 자동으로 보낸다(seedUncheckedNote).
 */
export function submitMarks(
  slots: readonly HanjaSlot[] | null | undefined,
  waiting: ReadonlyMap<string, string>,
  pick: PendingPick | null | undefined
): string[] {
  return (slots ?? []).map((slot) => {
    const seeded = waiting.get(choiceKey(slot.target, slot.index, slot.syllable));
    if (seeded) return seeded;
    if (slot.state === "checking" && pick) return pick.character;
    return slot.mark;
  });
}

export interface PasteStep {
  /** 넘겨받은 칸 목록 안의 자리 */
  position: number;
  slot: HanjaSlot;
  character: string;
  /** placed = 넣는다 · rejected = 그 음절 후보에 없어 건너뛴다 · pending = 그 음절 파일을 아직 못 받았다 · locked = 후보 파일이 없는 음절 */
  status: "placed" | "rejected" | "pending" | "locked";
  fact: HanjaFact | null;
}

/**
 * 여러 글자를 `start` 칸부터 차례로 나눠 넣는다(글자 하나에 칸 하나 — 자리를 건너뛰어 맞추지 않는다).
 * `slots` 는 화면 순서의 칸 목록이다 — 성씨 칸에서 시작해 이름으로 넘어가게 하려면 `[...성씨 칸, ...이름 칸]` 을 준다.
 * 자리마다 그 음절 파일에 있는 글자만 넣고, 없는 자리는 건너뛴다(화면이 알린다). 칸이 모자라 남은 글자는 `dropped`.
 * 'pending' 이 있으면 그 음절 파일을 받은 뒤 다시 부른다.
 */
export function spreadPaste(
  slots: readonly HanjaSlot[],
  start: number,
  characters: readonly string[],
  files: PickFiles
): { steps: PasteStep[]; dropped: string[] } {
  const steps: PasteStep[] = [];
  const dropped: string[] = [];
  const from = Math.max(0, Math.floor(start) || 0);
  characters.forEach((character, offset) => {
    const position = from + offset;
    const slot = slots[position];
    if (!slot) {
      dropped.push(character);
      return;
    }
    if (!slot.openable) {
      steps.push({ position, slot, character, status: "locked", fact: null });
      return;
    }
    const file = files.get(slot.syllable);
    if (!file) {
      steps.push({ position, slot, character, status: "pending", fact: null });
      return;
    }
    const found = file.find((f) => f.character === character);
    if (!found) {
      steps.push({ position, slot, character, status: "rejected", fact: null });
      return;
    }
    const fact = slot.target === "surname" ? asSurnameFact(found) : found;
    steps.push({ position, slot, character, status: "placed", fact });
  });
  return { steps, dropped };
}

// ============================================================
// 들어오는 길 — 링크 만들기 · 해시 읽기 (설계 §8-6·§11)
// ============================================================

const PICK_READINGS_MAX = 4;

/**
 * 글자 하나를 들고 /evaluate 로 가는 링크 — `/evaluate#pick=…&as=…`(as 는 독음, 여럿이면 쉼표). 쿼리(`?`)를 쓰지 않는다 —
 * 해시는 서버로 가지 않고, 크롤러에게는 `/evaluate` 한 주소다. 값은 퍼센트 인코딩한다(메신저가 한자·한글에서 링크를 끊지 않게).
 */
export function evaluatePickHref(character: string, readings: readonly string[]): string {
  const syllables = readings.filter(isOneHangulSyllable).slice(0, PICK_READINGS_MAX);
  const pick = `pick=${encodeURIComponent(character)}`;
  if (syllables.length === 0) return `/evaluate#${pick}`;
  return `/evaluate#${pick}&as=${syllables.map(encodeURIComponent).join(",")}`;
}

/**
 * 해시에서 들고 온 글자를 읽는다. `pick=` 으로 시작하는 해시만 읽는다(`#hanja-guide` 같은 다른 해시는 건드리지 않는다).
 * - `pick` 은 정리한 뒤 한자 한 글자여야 한다.
 * - `as` 의 낱말 가운데 한글 음절 한 글자인 것만(최대 4개, 중복 없이) 읽는다. 하나도 없으면 null — 독음 없이는 파일로 확인할 수 없다.
 * 읽은 값은 표시와 파일 고르기에만 쓴다. 넣어도 되는지는 음절 파일로 판정하고, 제출하면 서버가 다시 검사한다.
 */
export function parsePickHash(hash: string | null | undefined): PendingPick | null {
  if (!hash) return null;
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!body.startsWith("pick=")) return null;
  const params = new URLSearchParams(body);
  const chars = [...cleanHanjaText(params.get("pick"))];
  if (chars.length !== 1 || !isHanAfterClean(chars[0].codePointAt(0) ?? -1)) return null;
  const readings: string[] = [];
  for (const word of (params.get("as") ?? "").split(",")) {
    const reading = word.trim();
    if (!isOneHangulSyllable(reading) || readings.includes(reading)) continue;
    readings.push(reading);
    if (readings.length === PICK_READINGS_MAX) break;
  }
  if (readings.length === 0) return null;
  return { character: chars[0], readings };
}

/**
 * 이름과 한자 조합을 들고 /evaluate 로 가는 링크 — `/evaluate?name=…&hanja=…`(/name 조합 카드). 성·성별은 싣지 않는다.
 * 한자가 이름 길이와 맞지 않거나 한자·표시 글자 밖이 섞였으면 이름만 싣는다.
 */
export function evaluateComboHref(name: string, hanja: string): string {
  const params = new URLSearchParams();
  params.set("name", name);
  const canonical = isHangulSyllables(name) ? canonicalHanja(hanja, name.length) : "";
  if (canonical) params.set("hanja", canonical);
  return `/evaluate?${params.toString()}`;
}

// ============================================================
// 고르기 패널의 목록 (설계 §8-7)
// ============================================================

function codePointOf(fact: HanjaFact): number {
  return fact.character.codePointAt(0) ?? 0;
}

/**
 * 성씨 패널의 순서 — 대표 한자 맨 앞, 나머지는 기본 영역 먼저 · 획수 오름차순 · 코드포인트 순.
 * 이름용 표시(이름에 피하는 글자·먼저 보여 드리는 글자·뜻 풀이 유무)는 보지 않는다 — 성씨에 쓰는 글자가 접힌 묶음이나 맨 뒤로 밀리지 않게.
 */
export function sortForSurname(list: readonly HanjaFact[], representative?: string | null): HanjaFact[] {
  return [...list].sort((a, b) => {
    const ra = a.character === representative ? 0 : 1;
    const rb = b.character === representative ? 0 : 1;
    if (ra !== rb) return ra - rb;
    if (a.basic !== b.basic) return a.basic ? -1 : 1;
    if (a.strokeCount !== b.strokeCount) return a.strokeCount - b.strokeCount;
    return codePointOf(a) - codePointOf(b);
  });
}

export interface CandidateFilter {
  /** 찾는 말 — 훈에 그 말이 들거나 글자가 같은 줄만 남긴다. 비면 거르지 않는다 */
  query?: string | null;
  /** 자원오행(木·火·土·金·水) — 비면 전체 */
  element?: string | null;
}

/**
 * 이름 패널의 찾기·오행 거르기 — 받아 둔 목록 안에서만 찾는다(서버 호출 없음). 순서는 그대로 둔다.
 * 찾는 말은 훈의 부분 일치 또는 글자 일치(호환 한자로 넣어도 통합 한자로 맞춘다). 두 조건은 함께 건다.
 */
export function filterCandidates(list: readonly HanjaFact[], filter: CandidateFilter): HanjaFact[] {
  const query = (filter.query ?? "").trim();
  const asCharacter = cleanHanjaText(query);
  const element = filter.element ?? "";
  return list.filter((fact) => {
    if (element && fact.fiveElement !== element) return false;
    if (!query) return true;
    return fact.gloss.includes(query) || (asCharacter !== "" && fact.character === asCharacter);
  });
}

export interface CandidateGroups {
  /** ① 먼저 보여 드리는 글자 */
  common: HanjaFact[];
  /** ② 그 밖의 글자 */
  others: HanjaFact[];
  /** ③ 이름에 피하는 글자 · 뜻 풀이가 없는 글자(접힌 묶음) */
  avoided: HanjaFact[];
}

/**
 * 이름 패널의 세 묶음 — 파일 순서를 지킨 채 가른다. ③ = 이름에 피하는 글자이거나 뜻 풀이가 없는 글자,
 * ①·② = 나머지(쓸 수 있는 글자 — index.json 의 `usable` 과 같은 수)를 '먼저 보여 드리는 글자' 여부로.
 */
export function groupCandidates(list: readonly HanjaFact[]): CandidateGroups {
  const groups: CandidateGroups = { common: [], others: [], avoided: [] };
  for (const fact of list) {
    if (fact.forbidden || !fact.hasMeaning) groups.avoided.push(fact);
    else if (fact.common) groups.common.push(fact);
    else groups.others.push(fact);
  }
  return groups;
}

// ============================================================
// 결과 화면 — 비교 줄의 사실 · 블록에 그릴 글자 (설계 §3-4·§8-3)
// ============================================================

export interface ComboFacts {
  /** 이름 글자마다 자원오행 — 한자가 없거나 미상이면 "" */
  elements: string[];
  /** 이름 글자마다 음양 — 한자가 없으면 "" */
  yinYang: string[];
  /** 앞 두 글자의 획수 합(획수 조화가 보는 값). 한 글자 이름이거나 둘 중 하나라도 한자·획수가 없으면 null — 어림값을 지어내지 않는다 */
  strokeSum: number | null;
}

/** 조합 한 줄의 사실 — 생년월일이 없어 점수로 비교할 수 없을 때 '달라지는 사실'로 적는다. 사실만, 점수가 아니다 */
export function comboFacts(facts: readonly (HanjaFact | null | undefined)[]): ComboFacts {
  const first = facts[0];
  const second = facts[1];
  const both = facts.length >= 2 && !!first && !!second && first.strokeCount > 0 && second.strokeCount > 0;
  return {
    elements: facts.map((f) => f?.fiveElement ?? ""),
    yinYang: facts.map((f) => f?.yinYang ?? ""),
    strokeSum: both ? first.strokeCount + second.strokeCount : null,
  };
}

/** 응답을 기다리는 동안의 바뀐 칸 — 칸 번호 → 바뀐 값 */
export interface PendingHanja {
  name: Readonly<Record<number, HanjaChoice>>;
  /** 성씨 칸에는 '한자 없이'가 오지 않는다 */
  surname: Readonly<Record<number, HanjaChoice>>;
}

export interface BlockSyllable {
  syllable: string;
  source: SyllableHanjaSource;
  hanja: HanjaFact | null;
  fills: HanjaFill[];
  /** 대기 중의 자동 칸 — 직전 응답의 글자를 그대로 두되 꼬리를 '다시 고르는 중'으로 */
  waiting: boolean;
}

export interface BlockView {
  /** 다시 계산하는 중인가 — 참이면 화면이 대기 글 배지를 단다(점수는 이전 한자 기준이다) */
  waiting: boolean;
  surname: {
    hangul: string;
    source: SurnameHanjaSource;
    /** 성씨 글자마다 — 정하지 못했거나 대기 중에 알 수 없는 자리는 null */
    chars: (HanjaFact | null)[];
    waiting: boolean;
  };
  syllables: BlockSyllable[];
  elementFit: ElementFit | null;
}

/**
 * '이 이름의 한자' 블록에 그릴 글자를 고른다.
 * - `pending` 이 없으면 **마지막으로 계산이 끝난 응답(`shown`)의 글자 그대로**다. 재계산이 실패하면 pending 을 지우므로
 *   블록이 확정된 조합으로 되돌아간다 — 새 한자 옆에 옛 점수가 남지 않는다.
 * - `pending` 이 있으면 바뀐 칸은 고른 글자로 바로 바꾸고(역할 꼬리표는 응답의 elementFit 과 rolesOf 로 — 생년월일로만 정해져 한자와 무관하다),
 *   자동 칸은 직전 응답의 글자를 둔 채 `waiting` 으로 표시한다(자동 칸은 대부분 그대로지만 화면이 단정하지 않는다).
 */
export function blockView(shown: HanjaSummary, pending: PendingHanja | null | undefined): BlockView {
  const fit = shown.elementFit ?? null;
  const hangul = shown.surname.hangul;
  const shownChars: (HanjaFact | null)[] = [...hangul].map((_, i) => shown.surname.chars[i] ?? null);

  if (!pending) {
    return {
      waiting: false,
      surname: { hangul, source: shown.surname.source, chars: shownChars, waiting: false },
      syllables: shown.syllables.map((s) => ({ ...s, fills: [...s.fills], waiting: false })),
      elementFit: fit,
    };
  }

  const syllables = shown.syllables.map((s, i): BlockSyllable => {
    const change = pending.name[i];
    if (change?.kind === "hanja") {
      const fact = change.fact;
      return { syllable: s.syllable, source: "user", hanja: fact, fills: rolesOf(fact.fiveElement, fit), waiting: false };
    }
    if (change?.kind === "none") {
      return { syllable: s.syllable, source: "none", hanja: null, fills: [], waiting: false };
    }
    if (s.source === "unavailable") return { ...s, fills: [...s.fills], waiting: false };
    if (change?.kind === "auto" && s.source !== "auto") {
      // 고른 글자를 자동으로 되돌렸다 — 서버가 무엇을 고를지 아직 모른다
      return { syllable: s.syllable, source: "auto", hanja: null, fills: [], waiting: true };
    }
    return { ...s, fills: [...s.fills], waiting: s.source === "auto" };
  });

  let surnameWaiting = false;
  let surnamePicked = false;
  const chars = shownChars.map((fact, i) => {
    const change = pending.surname[i];
    if (change?.kind === "hanja") {
      surnamePicked = true;
      return asSurnameFact(change.fact);
    }
    if (change?.kind === "auto" && shown.surname.source === "user") {
      surnameWaiting = true; // 기본 한자로 되돌렸다 — 글자 사실은 응답이 와야 안다
      return null;
    }
    return fact;
  });

  return {
    waiting: true,
    surname: {
      hangul,
      source: surnamePicked ? "user" : shown.surname.source,
      chars,
      waiting: surnameWaiting,
    },
    syllables,
    elementFit: fit,
  };
}
