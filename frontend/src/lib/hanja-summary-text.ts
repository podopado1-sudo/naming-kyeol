/**
 * /evaluate 결과 화면 '이 이름의 한자' 블록의 화면 모델과 문장 — 2026-11 설계 docs/plan-hanja-input-2026-11.md §3-4·§8-3·§8-4·§9-3,
 * 법규 사실은 §20.
 *
 * "use client" 가 없는 순수 모듈이다(node --test 가 바로 읽는다 — tests/hanja-summary-text.test.mjs). 화면(HanjaSummaryBlock·
 * EvaluateResult·EvaluateClient·/favorites)은 여기서 문장과 칸을 받아 그리기만 한다. 결과 머리 단추(공유·PDF)의 문장과
 * 공유 순서(shareOrCopy)도 여기 둔다(2026-11-27 — tests/fix1127-evaluate-result.test.mjs).
 *
 * 규칙
 * - **점수를 만들지 않는다.** 숫자는 /evaluate 응답의 값을 그대로 옮긴다(획수 합은 응답에 실린 두 획수를 더한 사실이다).
 * - 변수(음절·글자) 바로 뒤에 조사를 붙이지 않는다 — 조사는 '음절'·'글자'·'칸' 같은 고정 낱말 뒤에 온다.
 * - 꼬리표의 말은 조화 노트와 같은 낱말이다(용신 보완·희신 포함·기신 … (감점)·부족한 오행 보완·많은 오행 … (감점)).
 * - 자원오행 관계는 이름만 적는다(상극도 '金剋木 · 상극' 꼴 — lib/ohaeng-relation.ts ohaengRelationName). 관계로 점수를 매기지 않는다.
 * - 성씨 글자는 훈을 적지 않고 이름용 표시(이름에 피하는 글자)를 달지 않는다.
 */
import {
  AUTO,
  NONE,
  comboFacts,
  decodeHanjaParam,
  isHangulSyllables,
  surnameDefaultAt,
  type BlockSyllable,
  type BlockView,
  type HanjaPickIndex,
  type HanjaSlot,
} from "./hanja-pick";
import { elementLabel } from "./ohaeng";
import { ohaengRelationName, type OhaengKind } from "./ohaeng-relation";
import type { ElementFit, HanjaFact, HanjaFill, HanjaSummary } from "./types";

// ============================================================
// 블록 머리
// ============================================================

export const BLOCK_TITLE = "이 이름의 한자";

/** 블록 부제의 앞 문장 — 이 한자가 어디서 왔나(인쇄에도 남는다). 한자를 하나라도 고른 결과인가(응답 hanjaSummary.userHanja) */
export function blockSource(userHanja: boolean): string {
  return userHanja ? "고른 한자로 계산했어요." : "한자를 고르지 않아 자동으로 골랐어요.";
}

/** 블록 부제의 뒤 문장 — 화면에서 누르는 법이라 인쇄에서는 숨긴다(data-hide-print — 칸 단추는 종이에서 누를 수 없다) */
export const BLOCK_CHANGE_HINT = "칸을 눌러 바꿔 볼 수 있어요.";

/** 블록 부제 전체(화면에 보이는 두 문장) */
export function blockSubtitle(userHanja: boolean): string {
  return `${blockSource(userHanja)} ${BLOCK_CHANGE_HINT}`;
}

/** 다시 계산하는 동안 점수 타일 묶음 위에 다는 글 배지 — 화면을 흐리게 하지 않고 글로 알린다 */
export const WAITING_BADGE = "이전 한자 기준 · 다시 계산 중";
/** 하단 띠(role="status") — 다시 계산하는 동안 */
export const RECALC_PROGRESS = "고른 한자로 다시 계산하는 중이에요…";

/** 하단 띠 — 다시 계산이 끝났다. 숫자는 응답 값 그대로다(생년월일이 없으면 조화를 계산하지 않으므로 미학·종합) */
export function recalcDoneNotice(data: {
  birthDateProvided?: boolean;
  aestheticScore: number;
  harmonyScore: number;
  finalScore: number;
}): string {
  return data.birthDateProvided === false
    ? `다시 계산했어요 — 미학 ${data.aestheticScore} · 종합 ${data.finalScore}`
    : `다시 계산했어요 — 조화 ${data.harmonyScore} · 종합 ${data.finalScore}`;
}

/** 하단 띠 — '지금까지 본 조합'의 줄을 눌러 그 조합으로 돌아왔다(받아 둔 응답을 다시 보여 줄 뿐 — 다시 계산하지 않는다) */
export function seenShownNotice(data: {
  birthDateProvided?: boolean;
  aestheticScore: number;
  harmonyScore: number;
  finalScore: number;
}): string {
  return data.birthDateProvided === false
    ? `본 조합으로 돌아왔어요 — 미학 ${data.aestheticScore} · 종합 ${data.finalScore}`
    : `본 조합으로 돌아왔어요 — 조화 ${data.harmonyScore} · 종합 ${data.finalScore}`;
}

/**
 * 다시 계산하지 못했다 — 그 칸 아래에 적는다. 뒤에 까닭(api 문장)이 이어진다.
 * '…두고/되돌려 다시 계산하지 못했어요'는 '되돌렸기 때문에 못 했다'로도 읽혀 '…조합으로'로 쓴다.
 */
export function recalcFailedNote(change: {
  syllable: string;
  /** hanja = 글자를 골랐다 · none = 한자 없이 · auto = 자동(성씨는 기본 한자)으로 되돌렸다 · slot = 서버가 짚은 칸(이번에 바꾼 칸이 아니다) */
  kind: "hanja" | "none" | "auto" | "slot";
  character: string | null;
}): string {
  if (change.kind === "hanja" && change.character) return `‘${change.character}’ 글자로 다시 계산하지 못했어요.`;
  if (change.kind === "none") return `‘${change.syllable}’ 칸을 한글로 둔 조합으로 다시 계산하지 못했어요.`;
  if (change.kind === "auto") return `‘${change.syllable}’ 칸을 자동으로 되돌린 조합으로 다시 계산하지 못했어요.`;
  return `‘${change.syllable}’ 칸의 한자 때문에 다시 계산하지 못했어요.`;
}

// ============================================================
// 칸 줄 — 블록에 그릴 글자(lib/hanja-pick.ts blockView)를 칸 버튼(HanjaSlots)의 꼴로
// ============================================================

/**
 * 블록의 칸들. 입력 폼의 칸과 같은 꼴(HanjaSlot)이라 같은 칸 버튼·같은 고르기 패널을 쓴다.
 * - 이름: 고른 한자 = picked · 자동으로 고른 한자 = auto(글자 있음) · 한자 없이 = none ·
 *   쓸 수 있는 한자가 없는 음절 = 후보 파일이 있으면 hangul(열 수 있다), 없으면 locked.
 * - 성씨: 기본으로 두는 한자 = default · 추정한 한자 = auto(글자 있음) · 고른 한자 = picked. 복성에서 한 글자만 골랐으면
 *   나머지 자리는 기본 한자다(색인으로 가린다). 글자를 정하지 못한 자리는 글자 없는 auto(후보 파일이 없으면 locked).
 * 색인(index.json)을 아직 못 받았으면 모든 칸을 열 수 있는 것으로 둔다.
 */
export function blockSlots(
  view: BlockView,
  index: HanjaPickIndex | null | undefined
): { surname: HanjaSlot[]; name: HanjaSlot[] } {
  const hasFile = (syllable: string) => !index || Object.prototype.hasOwnProperty.call(index.syllables, syllable);

  const surname = [...view.surname.hangul].map((syllable, i): HanjaSlot => {
    const openable = hasFile(syllable);
    const base = { target: "surname" as const, index: i, syllable, openable };
    const fact = view.surname.chars[i] ?? null;
    if (!fact) return { ...base, state: openable ? "auto" : "locked", character: null, fact: null, mark: AUTO };
    const isDefault = surnameDefaultAt(index, view.surname.hangul, i) === fact.character;
    if (view.surname.source === "user" && !isDefault) {
      return { ...base, state: "picked", character: fact.character, fact, mark: fact.character };
    }
    const state = view.surname.source === "estimated" ? "auto" : "default";
    return { ...base, state, character: fact.character, fact, mark: AUTO };
  });

  const name = view.syllables.map((s, i): HanjaSlot => {
    const openable = hasFile(s.syllable);
    const base = { target: "name" as const, index: i, syllable: s.syllable, openable };
    if (s.source === "user" && s.hanja) {
      return { ...base, state: "picked", character: s.hanja.character, fact: s.hanja, mark: s.hanja.character };
    }
    if (s.source === "none") return { ...base, state: "none", character: null, fact: null, mark: NONE };
    if (s.source === "unavailable") {
      return { ...base, state: openable ? "hangul" : "locked", character: null, fact: null, mark: AUTO };
    }
    return { ...base, state: "auto", character: s.hanja?.character ?? null, fact: s.hanja ?? null, mark: AUTO };
  });

  return { surname, name };
}

// ============================================================
// 칸 꼬리 — 그 글자가 어디서 왔나
// ============================================================

/**
 * 이름 칸의 꼬리. 자동 칸은 생년월일이 있어 용신을 구했을 때만 '용신을 반영해'라고 적는다.
 * 쓸 수 있는 한자가 없는 음절은 꼬리 대신 안내 문장(lib/no-hanja.ts)을 쓴다 — null.
 */
export function syllableTail(
  syllable: Pick<BlockSyllable, "source" | "hanja" | "waiting">,
  fit: ElementFit | null | undefined
): string | null {
  if (syllable.waiting) return "다시 고르는 중";
  if (syllable.source === "user") return "고른 한자";
  if (syllable.source === "none") return "한자 없이 한글로";
  if (syllable.source === "auto" && syllable.hanja) {
    return fit?.yongshin ? "용신을 반영해 자동으로 고른 한자" : "자동으로 고른 한자";
  }
  return null;
}

/** 성씨 칸의 꼬리 — 칸 상태(blockSlots)에서 고른다. 글자를 아직 모르는 대기 칸은 '다시 고르는 중' */
export function surnameTail(slot: Pick<HanjaSlot, "state" | "character">, waiting: boolean): string | null {
  if (!slot.character) return waiting ? "다시 고르는 중" : null;
  if (slot.state === "picked") return "고른 한자";
  if (slot.state === "default") return "기본으로 두는 성씨 한자";
  return "추정한 성씨 한자";
}

// ============================================================
// 역할 꼬리표 — 조화 점수의 '자원오행 보완'이 그 글자를 어떻게 셌나(응답 fills)
// ============================================================

/**
 * 꼬리표의 말 — 조화 노트와 같은 낱말. 부족·많은 오행에는 사주 글자의 개수(elementFit.counts)를 붙인다.
 * 개수를 모르면(옛 응답) 개수 없이 적는다.
 */
export function fillLabel(fill: HanjaFill, element: string, fit: ElementFit | null | undefined): string {
  const n = fit?.counts ? fit.counts[element] : undefined;
  const count = typeof n === "number" ? ` · 사주에 ${n}개` : "";
  switch (fill) {
    case "yongshin":
      return "용신 보완";
    case "heeshin":
      return "희신 포함";
    case "gishin":
      return "기신(감점)";
    case "lacking":
      return `부족한 오행 보완${count}`;
    case "excessive":
      return `많은 오행(감점)${count}`;
  }
}

/** 감점이 걸린 꼬리표인가 — 화면이 주의 글자색(amber-warm-700)으로 그린다 */
export function isPenaltyFill(fill: HanjaFill): boolean {
  return fill === "gishin" || fill === "excessive";
}

// ============================================================
// 안내 줄
// ============================================================

/** 글자 사이 칩의 안내 — 같은 화면 조화 패널의 발음오행(한글 소리, 25점)과 헷갈리지 않게 늘 '자원오행'이라고 쓴다 */
export const RELATION_NOTICE =
  "글자 사이 칩은 두 글자의 자원오행(부수 기준)이 전통 오행 이론에서 어떤 관계인지 그 이름만 적은 것이에요. 자원오행끼리의 관계는 이 사이트 점수에 넣지 않습니다. 조화 점수의 발음오행(25점)은 한글 소리로 매기는 다른 항목이에요.";

/** 용신 한 줄 — '이 사이트 계산으로 본 용신 수(水) · 희신 금(金).' 용신을 구하지 못했으면 null */
export function yongshinLine(fit: ElementFit | null | undefined): string | null {
  if (!fit?.yongshin) return null;
  const heeshin = fit.heeshin ? ` · 희신 ${elementLabel(fit.heeshin)}` : "";
  return `이 사이트 계산으로 본 용신 ${elementLabel(fit.yongshin)}${heeshin}.`;
}

/** 꼬리표가 무엇인지 — 생년월일이 있을 때 */
export const FILL_NOTICE =
  "꼬리표는 그 글자의 자원오행이 조화 점수의 ‘자원오행 보완’에서 어떻게 계산됐는지 적은 것이에요. ‘부족한 오행’은 사주 글자에서 평균보다 적은 오행(1개 이하)이고, 오행 찾기의 ‘없는 오행’(0개)보다 넓어요.";

/** /ohaeng 결과 화면의 고지 두 줄과 같은 문장(components/design/OhaengResult.tsx) */
export const YONGSHIN_METHOD_NOTICE =
  "용신은 억부·조후 가운데 무엇을 앞세우느냐에 따라 달라져, 다른 곳에서 본 용신과 다를 수 있어요.";
export const FRAME_NOTICE =
  "오행과 용신은 전통 작명에서 쓰는 해석 틀입니다. 이 결과는 성격이나 앞날을 알려 주지 않습니다.";

/** '기신(감점)' 꼬리표가 있을 때만 */
export const GISHIN_NOTICE =
  "‘기신(감점)’은 이 계산에서 용신을 누르는 오행이라 ‘자원오행 보완’ 점수가 깎였다는 뜻이에요. 이름이 나쁘다는 판정이 아니라 이 점수 항목의 계산 규칙입니다.";

/**
 * 태어난 시각 — 시각이 있으면 서울 기준으로 진태양시를 보정하고(/evaluate 는 출생지를 받지 않는다),
 * 없으면 보정 없이 시주를 빼고 계산한다(백엔드 SajuCalculationService.CalculateChart — 2026-11 사주 계산 수정 뒤의 동작).
 */
export function birthTimeNotice(hasBirthTime: boolean): string {
  return hasBirthTime
    ? "태어난 시각은 서울 기준으로 보정해 계산했어요(출생지는 받지 않습니다)."
    : "태어난 시각을 넣지 않아 시주 없이 계산했어요.";
}

export const SURNAME_NOTICE = "성씨 글자는 자원오행 보완 점수에 들어가지 않아요.";
export const MEANING_SCORE_NOTICE = "미학의 ‘의미’ 점수는 음절 기준이라 고른 한자의 뜻은 반영하지 않아요.";

/**
 * 출생일 없이 낸 결과 — 한자를 바꾸면 무엇이 달라지는지. '조화 점수를 계산하지 않았다'는 같은 화면의 조화 자리 상자가 이미 말하므로
 * 되풀이하지 않는다. 낱말은 입력 폼('출생일' 칸)·조화 자리 상자·설명 글과 같은 '출생일'이다.
 */
export const NO_BIRTH_NOTICE =
  "한자를 바꾸면 글자의 뜻·자원오행·획수와 자원오행 관계가 바뀌고, 점수는 성별 보너스만 달라질 수 있어요. 출생일을 넣으면 이 한자들로 자원오행 보완·획수 조화·음양·전통 81수리를 계산해요.";

/** 안내를 접어 둔 줄의 이름 */
export const GUIDE_SUMMARY = "칩과 꼬리표 읽는 법";

// ============================================================
// 칸마다의 안내
// ============================================================

/**
 * 이름에 피하는 글자(불용)를 골랐다 — 막지 않고 계산하되 사실을 적는다. 출생신고 가부를 말하지 않는다.
 * '자동 배정' 대신 같은 화면의 말('자동으로 고르기'·'자동으로 고른 한자')을 쓴다.
 */
export function forbiddenNote(gloss: string): string {
  return gloss
    ? `이 사이트가 이름 추천과 자동으로 고르는 한자에서 빼는 글자예요(훈: ${gloss}).`
    : "이 사이트가 이름 추천과 자동으로 고르는 한자에서 빼는 글자예요.";
}

export const NO_MEANING_NOTE = "사전에 뜻 풀이가 없는 글자예요. 획수와 자원오행으로만 계산해요.";

/**
 * 사용자가 한자 없이 둔 칸 — 생년월일이 있으면 그 칸을 어떻게 어림했는지도 적는다.
 * 이름 칸 모두에 한자가 없으면(allUserBlank) 칸마다 어림하지 않고 기본값으로 계산하므로 어림 문장을 빼고(allBlank),
 * 블록 아래 한 줄(ALL_BLANK_NOTICE)이 그 사실을 적는다
 */
export function noneNote(syllable: string, birthDateProvided: boolean, allBlank = false): string {
  const base = `‘${syllable}’ 음절은 한자 없이 한글로 두었어요.`;
  return birthDateProvided && !allBlank
    ? `${base} 이 칸은 획수 조화에서 5획, 81수리에서 0획으로 어림해 계산했어요(추정값).`
    : base;
}

/**
 * 이름 칸 모두에 한자가 없고 그중 사용자가 한자 없이 둔 칸이 있는가(쓸 수 있는 한자가 없는 음절이 섞여도 참).
 * 백엔드 HarmonyEngine 은 이름 글자의 한자가 모두 비면 칸마다 어림하지 않고 일찍 돌아간다 — 자원오행 보완·획수 조화·음양·81수리는
 * 정해진 기본값(14·10·5·7점), 발음오행만 한글 소리로 계산하고 노트는 '한자를 두지 않아 기본값을 사용했습니다' 하나다.
 */
export function allUserBlank(summary: Pick<HanjaSummary, "syllables"> | null | undefined): boolean {
  return (
    !!summary &&
    summary.syllables.length > 0 &&
    summary.syllables.every((s) => s.hanja === null) &&
    hasUserBlank(summary)
  );
}

/** allUserBlank 일 때 블록 아래 한 줄 — 생년월일이 있을 때만(없으면 조화 점수를 계산하지 않는다) */
export const ALL_BLANK_NOTICE =
  "이름 칸에 둔 한자가 없어 조화 점수의 자원오행 보완·획수 조화·음양·전통 81수리는 정해진 기본값으로 계산했어요(발음오행만 한글 소리로 계산해요).";

/**
 * 한글과 한자가 섞인 조합인가 — **한자를 지정한 결과**에서 한자가 든 칸과 한글로 둔 칸(한자 없이·쓸 수 있는 한자가 없는 음절)이
 * 함께 있을 때. 고지 문장은 lib/hanja-pick-text.ts MIXED_SCRIPT_NOTICE(입력 화면과 같은 문장).
 */
export function isMixedResult(summary: Pick<HanjaSummary, "userHanja" | "syllables">): boolean {
  if (!summary.userHanja) return false;
  const hasHanja = summary.syllables.some((s) => s.hanja !== null);
  const hasHangul = summary.syllables.some((s) => s.hanja === null);
  return hasHanja && hasHangul;
}

/** 사용자가 한자 없이 둔 칸이 있는가 — 조화 패널의 대체값 경고 문구를 가른다 */
export function hasUserBlank(summary: Pick<HanjaSummary, "syllables"> | null | undefined): boolean {
  return !!summary && summary.syllables.some((s) => s.source === "none");
}

/**
 * 조화 패널의 대체값 경고(usedFallback) — 사용자가 비운 칸이 있을 때만 새 문구, 그 밖은 예전 문구.
 * 이름 칸 모두에 한자가 없으면(allUserBlank) 획수 어림이 아니라 기본값이다 — 백엔드 노트 '한자를 두지 않아 기본값을 사용했습니다'와 같은 말
 */
export function fallbackWarning(summary: Pick<HanjaSummary, "syllables"> | null | undefined): string {
  if (allUserBlank(summary)) return "⚠ 한자를 두지 않아 기본값으로 계산했어요";
  return hasUserBlank(summary)
    ? "⚠ 한자를 두지 않은 음절은 획수를 추정값으로 계산했어요"
    : "⚠ 배정할 한자가 없는 음절이 있어 기본값으로 계산했어요";
}

/** 조화 패널 아래 획수 고지 — 뒤에 '작명 원리' 링크가 온다 */
export const HARMONY_STROKE_NOTICE =
  "획수는 유니코드 총획 기준이에요. 부수를 본래 꼴로 세는 작명소의 원획과 다를 수 있어 획수 조화·음양·81수리 값도 달라질 수 있어요.";

/** '한자 후보' 표 부제의 앞 문장 — 표가 무엇인지(인쇄에도 남는다) */
export const CANDIDATES_SUBTITLE_FACT =
  "음절마다 쓸 수 있는 한자와 부수로 정한 자원오행, 그 판정 등급(확정·이견 있음·예외 적용)이에요.";
/** '한자 후보' 표 부제의 뒤 문장 — '이 글자로' 단추 안내라 인쇄에서는 단추와 함께 숨긴다 */
export const CANDIDATES_PICK_HINT = "줄 끝의 ‘이 글자로’를 누르면 그 글자로 바꿔 다시 계산해요.";
/** '한자 후보' 표의 부제 — 한자를 바꿔 다시 계산할 수 있을 때(hanjaSummary 가 있는 응답) */
export const CANDIDATES_SUBTITLE = `${CANDIDATES_SUBTITLE_FACT} ${CANDIDATES_PICK_HINT}`;

// ============================================================
// 자원오행 관계 — 이웃한 두 글자
// ============================================================

export interface RelationChip {
  kind: OhaengKind;
  label: string;
}

/** 두 글자의 자원오행 관계(이름 꼴). 한쪽이 한자 없음이거나 자원오행을 모르면 null — 그 사이에는 칩을 그리지 않는다 */
export function relationBetween(
  a: Pick<HanjaFact, "fiveElement"> | null | undefined,
  b: Pick<HanjaFact, "fiveElement"> | null | undefined
): RelationChip | null {
  if (!a || !b) return null;
  const relation = ohaengRelationName(a.fiveElement, b.fiveElement);
  return relation.kind === "unknown" || !relation.label ? null : relation;
}

/**
 * 이름 한 줄의 관계 칩들 — 성씨 끝 글자 → 이름 1, 이름 1 → 이름 2, …(복성의 두 글자 사이는 보지 않는다).
 * 결과의 자리 i 는 '이름 i 번째 글자 앞'의 칩이다.
 */
export function relationsOf(
  surnameChars: readonly (HanjaFact | null)[],
  nameChars: readonly (HanjaFact | null)[]
): (RelationChip | null)[] {
  const lastSurname = surnameChars.length > 0 ? surnameChars[surnameChars.length - 1] : null;
  return nameChars.map((fact, i) => relationBetween(i === 0 ? lastSurname : nameChars[i - 1], fact));
}

// ============================================================
// '지금까지 본 조합' — 같은 조건에서 한자만 바꿔 본 결과
// ============================================================

export const SEEN_TITLE = "지금까지 본 조합";
export const SEEN_GUIDE = "같은 조건에서 한자만 바꿔 본 결과예요. 어느 쪽이 낫다는 판정은 하지 않습니다.";
/** 생년월일이 있고(용신을 구했고) 자동 칸이 든 줄이 있을 때 */
export const SEEN_AUTO_NOTE =
  "자동으로 고른 한자는 용신을 반영해 고른 글자라 ‘자원오행 보완’이 높게 나오는 편이에요.";
/** 출생일이 없을 때 — 미학·종합이 조합마다 사실상 같아 숫자 줄이 비교가 되지 않는다 */
export const SEEN_NO_BIRTH_NOTE =
  "출생일을 넣지 않아 점수 대신 달라지는 사실을 적었어요. 출생일을 넣으면 조화 점수로 비교할 수 있어요.";

export interface ComboLine {
  /** 성씨 글자 — 한자를 정하지 못한 자리는 한글 음절 */
  surname: string;
  /** 이름 글자 — 한자가 없는 자리는 한글 음절 */
  name: string;
  /** 자동으로 고른 이름 글자가 있는가 */
  hasAuto: boolean;
  /** 이름 글자마다 자원오행 — '金·水'(한자 없는 칸은 '한글', 자원오행을 모르면 '미상') */
  elements: string;
  /** 이름 글자마다 음양 — '陽·陰'(한자 없는 칸은 '한글') */
  yinYang: string;
  /** 앞 두 이름 글자의 획수 합(획수 조화가 보는 값). 둘 중 하나라도 한자가 없으면 null — 어림값을 사실처럼 적지 않는다 */
  strokeSum: number | null;
  /** 이웃한 글자의 자원오행 관계 이름들(칩을 그리지 않는 사이는 빠진다) */
  relations: string[];
}

/** 조합 한 줄의 사실 — 응답 hanjaSummary 에서. 점수는 여기 없다(화면이 응답의 점수를 따로 적는다) */
export function comboLine(summary: HanjaSummary): ComboLine {
  const hangul = [...summary.surname.hangul];
  const surnameChars = hangul.map((_, i) => summary.surname.chars[i] ?? null);
  const nameChars = summary.syllables.map((s) => s.hanja);
  const facts = comboFacts(nameChars);
  return {
    surname: hangul.map((syllable, i) => surnameChars[i]?.character ?? syllable).join(""),
    name: summary.syllables.map((s) => s.hanja?.character ?? s.syllable).join(""),
    hasAuto: summary.syllables.some((s) => s.source === "auto" && s.hanja !== null),
    elements: nameChars.map((fact, i) => (fact ? facts.elements[i] || "미상" : "한글")).join("·"),
    yinYang: nameChars.map((fact, i) => (fact ? facts.yinYang[i] || "미상" : "한글")).join("·"),
    strokeSum: facts.strokeSum,
    relations: relationsOf(surnameChars, nameChars)
      .filter((r): r is RelationChip => r !== null)
      .map((r) => r.label),
  };
}

// ============================================================
// 결과 머리 단추 — 공유 · PDF(인쇄)
// ============================================================

/**
 * 'PDF' 단추로 인쇄하는 동안의 문서 제목 — 브라우저가 'PDF로 저장'의 기본 파일 이름과 쪽 머리말로 쓴다.
 * 결과 화면의 제목은 메타 제목(이름과 무관)으로 고정이라 후보 셋을 저장하면 같은 이름 파일 셋이 됐다(2026-11-27).
 * 결과 화면(EvaluateResult)이 인쇄 동안만 바꾸고 인쇄가 끝나면(afterprint) 되돌린다
 */
export function pdfTitle(fullName: string): string {
  return `${fullName} 이름 평가`;
}

/** 공유 단추의 결과 — shared = 공유 시트로 보냄 · copied = 링크를 복사함 · cancelled = 공유 시트를 닫음 · failed = 둘 다 안 됨 */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

/** 사용자가 공유 시트를 닫았다(취소) — 그때만 조용히 넘어간다. 그 밖의 실패(권한·상태)는 복사로 넘어간다 */
export function isShareAbort(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
}

/**
 * 공유 시트가 있으면 먼저 열고, 없거나 취소가 아닌 까닭으로 실패하면 링크를 복사한다. 둘 다 안 되면 failed —
 * 화면이 '링크를 복사하지 못했어요'와 주소를 띄운다(옛 화면은 모든 오류를 삼켜 눌러도 아무 일이 없었다).
 * 브라우저 기능(공유·클립보드)은 화면이 넘긴다 — 없으면 undefined(이 모듈은 브라우저 객체를 만지지 않는다)
 */
export async function shareOrCopy(
  data: ShareData,
  share: ((data: ShareData) => Promise<void>) | undefined,
  copy: ((text: string) => Promise<void>) | undefined
): Promise<ShareOutcome> {
  if (share) {
    try {
      await share(data);
      return "shared";
    } catch (err) {
      if (isShareAbort(err)) return "cancelled";
    }
  }
  if (copy) {
    try {
      await copy(data.url);
      return "copied";
    } catch {
      // 복사도 거부됨(권한·포커스·비보안 맥락) — 아래에서 failed
    }
  }
  return "failed";
}

/**
 * 공유가 끝났을 때의 한 줄 — 생년월일을 넣은 결과의 링크는 생년월일을 뺀다(받는 쪽은 조화 점수 없이 본다)는 것을 두 길 모두에서 알린다.
 * 공유 시트로 보냈고 생년월일이 없던 결과는 알릴 것이 없다(null). 취소·실패도 null(실패는 SHARE_FAILED)
 */
export function shareNotice(outcome: ShareOutcome, hadBirthDate: boolean): string | null {
  const birth = hadBirthDate ? " (생년월일은 빠진 링크예요)" : "";
  if (outcome === "copied") return `링크 복사됨${birth}`;
  if (outcome === "shared" && hadBirthDate) return `공유했어요${birth}`;
  return null;
}

/** 공유도 복사도 되지 않았다 — 토스트 제목. 설명 줄(shareFailedDetail)에 주소를 적어 손으로 복사할 수 있게 한다 */
export const SHARE_FAILED = "링크를 복사하지 못했어요";
export function shareFailedDetail(url: string): string {
  return `주소를 직접 복사해 주세요: ${url}`;
}

// ============================================================
// 저장한 이름(/favorites) — 한자 조합 표시
// ============================================================

/**
 * 저장한 조합의 한자 한 줄 — '성씨 劉 · 이름 瑞 윤(자동)'. 저장분에는 주소 꼴(고른 칸의 글자, `*` 자동, `-` 한자 없이)만 있으므로
 * 자동 칸은 글자 대신 '음절(자동)', 한자 없이 둔 칸은 '음절(한글)'로 적는다. 한자를 고르지 않은 저장분·옛 저장분은 null.
 */
export function favoriteHanjaLabel(f: {
  lastName: string;
  name: string;
  hanja?: string | null;
  lastHanja?: string | null;
}): string | null {
  const parts: string[] = [];
  if (f.lastHanja && isHangulSyllables(f.lastName)) {
    const marks = decodeHanjaParam(f.lastHanja, f.lastName.length, { allowNone: false });
    if (marks.some((m) => m !== AUTO)) {
      parts.push(`성씨 ${marks.map((m, i) => (m === AUTO ? f.lastName[i] : m)).join("")}`);
    }
  }
  if (f.hanja && isHangulSyllables(f.name)) {
    const marks = decodeHanjaParam(f.hanja, f.name.length);
    if (marks.some((m) => m !== AUTO)) {
      // 모두 한자면 붙여 쓰고(瑞潤), 괄호 표시가 섞이면 칸마다 띄운다(瑞 윤(자동))
      const allHanja = marks.every((m) => m !== AUTO && m !== NONE);
      const text = marks
        .map((m, i) => (m === AUTO ? `${f.name[i]}(자동)` : m === NONE ? `${f.name[i]}(한글)` : m))
        .join(allHanja ? "" : " ");
      parts.push(`이름 ${text}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
