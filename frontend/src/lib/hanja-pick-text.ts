/**
 * 한자 칸·고르기 패널의 화면 문장 — 2026-11 설계 docs/plan-hanja-input-2026-11.md §8-6·§8-8·§9-2, 법규 사실은 §20.
 *
 * "use client" 가 없는 순수 모듈이다(node --test 가 바로 읽는다 — tests/hanja-pick-text.test.mjs). 화면(칸 줄·패널·입력 폼)은
 * 여기서 문장을 받아 그리기만 한다.
 *
 * 문장 규칙
 * - 변수(음절·글자) 바로 뒤에 조사를 붙이지 않는다 — 조사는 '음절'·'글자'·'칸' 같은 고정 낱말 뒤에 온다(‘윤’를 같은 꼴이 나오지 않게).
 * - 잠긴 칸·쓸 글자가 없는 칸의 안내는 lib/no-hanja.ts 의 문장 하나를 쓴다(결과 화면과 같은 문장 — 새 문장을 만들지 않는다).
 * - 성씨 칸은 훈을 읽지 않고, 이름용 판정(인명용 한자·출생신고)을 말하지 않는다 — 성씨는 인명용 한자 제한을 받지 않는다(설계 §20-4).
 * - 사전에 없는 글자를 두고 출생신고 가부를 단정하지 않는다(설계 §20-3).
 */
import { acceptedSyllablesOf, isHangulSyllables, type HanjaSlot, type PasteStep } from "./hanja-pick";
import { noHanjaSyllableNote } from "./no-hanja";

// ============================================================
// 칸 줄
// ============================================================

/** 이름을 넣기 전의 안내 — 첫 HTML 에 실린다 */
export const SLOTS_EMPTY_GUIDE = "이름을 넣으면 음절마다 한자 칸이 생겨요. 한자는 고르지 않아도 됩니다.";
/** 칸 줄 머리 */
export const SLOTS_TITLE = "한자 (선택)";
export const SLOTS_HINT = "칸을 눌러 고르세요. 고르지 않은 음절은 자동으로 골라요.";
/** 낱자모가 남아 칸을 만들 수 없을 때 */
export const SLOTS_JAMO_NOTE = "이름을 한글 음절로 마저 넣으면 한자 칸이 생겨요.";
/** 색인(index.json)을 기다리는 동안 */
export const SLOTS_PREPARING = "한자 칸을 준비하는 중이에요…";

/** 칸에 그리는 것 — 한자 한 글자(glyph) 또는 짧은 말(word), 그리고 칸 아래 꼬리 */
export interface SlotFace {
  glyph: string | null;
  word: string | null;
  tail: string | null;
}

/** 칸의 모양 — 한자가 정해진 칸은 그 글자, 아니면 '자동'·'한글'·'확인 중' */
export function slotFace(slot: HanjaSlot): SlotFace {
  if (slot.character) {
    return { glyph: slot.character, word: null, tail: slot.state === "default" ? "기본 한자" : null };
  }
  if (slot.state === "checking") return { glyph: null, word: "확인 중", tail: null };
  // 사용자가 고른 '한자 없이'·쓸 글자가 없는 음절·후보 파일이 없는 이름 음절은 화면에 '한글'이다
  if (slot.state === "none" || slot.state === "hangul") return { glyph: null, word: "한글", tail: null };
  if (slot.state === "locked" && slot.target === "name") return { glyph: null, word: "한글", tail: null };
  return { glyph: null, word: "자동", tail: null };
}

/**
 * 한자가 든 칸의 출처 말. 'auto' 인데 글자가 있는 칸은 결과 화면('이 이름의 한자' 블록)에만 있다 —
 * 서버가 자동으로 고른 이름 글자, 대표 한자 표에 없는 성씨의 추정 글자(입력 폼의 자동 칸에는 글자가 없다).
 */
function slotSourceWord(slot: HanjaSlot): string {
  if (slot.state === "default") return "기본 한자";
  if (slot.state === "carried") return "들고 온 글자";
  if (slot.state === "auto") return slot.target === "surname" ? "추정한 한자" : "자동으로 고른 한자";
  return "고른 한자";
}

/**
 * 칸 버튼의 이름(aria-label) — 화면 글자가 한자 한 자나 '자동'뿐이라 이름을 따로 준다(설계 §8-8).
 * 이름 칸: `‘서’ 음절 한자 — 瑞(상서 서), 고른 한자. 바꾸기` · 성씨 칸: `‘유’ 성씨 한자 — 柳, 기본 한자. 바꾸기`(훈 없음).
 */
export function slotAriaLabel(slot: HanjaSlot): string {
  const head = slot.target === "surname" ? `‘${slot.syllable}’ 성씨 한자` : `‘${slot.syllable}’ 음절 한자`;
  if (slot.state === "checking") return `${head} — 확인 중`;
  if (!slot.character) {
    if (slot.state === "none") return `${head} — 한자 없이 한글로. 바꾸기`;
    if (slot.state === "locked") return `${head} — ${slot.target === "name" ? "한글" : "자동"}`;
    if (slot.state === "hangul") return `${head} — 한글. 고르기`;
    return `${head} — 자동. 고르기`;
  }
  const gloss = slot.target === "name" ? (slot.fact?.gloss ?? "") : "";
  const glyph = gloss ? `${slot.character}(${gloss})` : slot.character;
  return `${head} — ${glyph}, ${slotSourceWord(slot)}. 바꾸기`;
}

/** 후보 파일이 없는 성씨 음절(사전에 그 음절로 읽는 한자가 없다) — 서버가 성씨 칸에 쓰는 말과 같다 */
export function lockedSurnameNote(syllable: string): string {
  return `이 사이트 사전에는 ‘${syllable}’ 음절로 읽는 한자가 없어 이 칸의 성씨 한자는 정할 수 없어요.`;
}

/** 열 수 없는 칸·쓸 글자가 없는 칸의 안내. 그런 칸이 아니면 null */
export function slotNote(slot: HanjaSlot): string | null {
  if (slot.target === "surname") return slot.state === "locked" ? lockedSurnameNote(slot.syllable) : null;
  return slot.state === "locked" || slot.state === "hangul" ? noHanjaSyllableNote(slot.syllable) : null;
}

/** 주소로 온 한자가 그 음절 후보에 없어 칸을 비웠다 */
export function seedRejectedNote(character: string, syllable: string): string {
  return `‘${character}’ 글자는 ‘${syllable}’ 음절 후보에 없어 비웠어요.`;
}

/**
 * 한글과 한자를 섞은 조합의 고지 — 현행 예규 그대로(설계 §20-1, 2026년 11월 확인).
 * '받아 주지 않을 수 있다'·'반드시 받아 준다'고 쓰지 않는다.
 */
export const MIXED_SCRIPT_NOTICE =
  "한글과 한자를 섞은 이름이에요. 현행 가족관계등록예규(제638호)는 이렇게 섞어 적은 출생신고도 수리할 수 있다고 정하고 있어요. 한자로 적는 글자는 인명용 한자여야 합니다.";

/**
 * 이름 칸에 한자가 든 칸과 한글로 두는 칸이 함께 있는가 — 고른 한자(들고 온 글자 포함)와
 * '한자 없이 한글로'·쓸 글자가 없는 칸·잠긴 칸이 같이 있을 때. 자동 칸은 서버가 한자를 고르므로 세지 않는다.
 */
export function isMixedScript(nameSlots: readonly HanjaSlot[] | null | undefined): boolean {
  const slots = nameSlots ?? [];
  const hasHanja = slots.some((s) => s.state === "picked" || s.state === "carried");
  const hasHangul = slots.some((s) => s.state === "none" || s.state === "hangul" || s.state === "locked");
  return hasHanja && hasHangul;
}

// ============================================================
// 들고 온 글자(#pick)의 띠 — 설계 §8-6
// ============================================================

/**
 * 띠의 문장. `readings` 는 음절 파일로 확인된 독음만 넘긴다(주소에 적힌 낱말을 그대로 옮기지 않는다).
 * 조합이 끝난 이름이 2음절 이상인데 그 글자가 들어갈 음절(독음과 그 두음 꼴)이 없으면 '읽는 음절이 없어요'로 바뀐다.
 */
export function pickBannerText(character: string, readings: readonly string[], firstName: string): string {
  const shown = readings.join("·");
  const name = firstName.trim();
  if (isHangulSyllables(name) && name.length >= 2) {
    const accepted = acceptedSyllablesOf(readings);
    if (![...name].some((syllable) => accepted.includes(syllable))) {
      return `입력한 이름에는 ‘${character}’(${shown}) 글자로 읽는 음절이 없어요.`;
    }
  }
  const quoted = readings.map((r) => `‘${r}’`).join(" 또는 ");
  return `${character}(${shown}) 글자를 넣어 볼게요. 이름에 ${quoted} 음절이 있으면 그 칸에 넣어 드려요.`;
}

// ============================================================
// 고르기 패널
// ============================================================

export function namePanelTitle(syllable: string): string {
  return `‘${syllable}’ 음절 한자 고르기`;
}

export function surnamePanelTitle(syllable: string): string {
  return `‘${syllable}’ 성씨 한자 고르기`;
}

/**
 * 성씨 패널의 설명. 기본 한자가 있는 성씨만 첫 문장('맨 위에 두었어요')을 쓴다.
 * 목록은 '인명용 한자 전체'가 아니라 이 사이트 사전의 글자다(사전은 인명용 한자 전부를 싣지 못한다 — 설계 §20-4).
 */
export function surnamePanelIntro(hasDefault: boolean): string {
  const list =
    "아래는 이 사이트 사전에서 이 음절로 읽는 한자 전체이고, 성씨에 쓰는 글자만 추린 목록은 아니에요. 본관에 따라 한자가 다를 수 있어요.";
  return hasDefault ? `기본으로 두는 한자 하나를 맨 위에 두었어요. ${list}` : list;
}

/** 묶음 ③ 의 설명 — `forbidden` 은 index.json 의 숫자(못 받았으면 숫자 없이) */
export function avoidedGroupIntro(forbidden: number | null | undefined): string {
  const count = typeof forbidden === "number" && forbidden > 0 ? `${forbidden.toLocaleString("ko-KR")}자` : "글자";
  return `‘이름에 피하는 글자’는 이 사이트가 이름 추천과 자동 배정에서 빼기로 정한 ${count}예요. 인명용 한자 목록에 있는 글자이고, 고르면 그대로 계산합니다. 이 묶음 밖 글자의 뜻이 모두 이름에 어울린다는 말은 아니니 훈을 함께 보세요.`;
}

/** 찾기 0건 — 직접 입력 칸이 놓인 자리(PC 는 위, 그 밖은 아래의 접힌 버튼)를 가리킨다 */
export function searchEmptyNote(directAbove: boolean): string {
  return directAbove
    ? "찾는 글자가 없어요. 위 ‘직접 입력’에 붙여 넣어 확인해 보세요."
    : "찾는 글자가 없어요. 아래 ‘복사한 한자 붙여 넣기’에 붙여 넣어 확인해 보세요.";
}

export const PANEL_LOADING = "한자 목록을 불러오는 중이에요…";
export const PANEL_LOAD_FAILED = "한자 목록을 불러오지 못했어요. 한자를 직접 붙여 넣거나 잠시 뒤 다시 열어 주세요.";
export const STROKE_NOTICE = "획수는 유니코드 총획 기준이에요. 부수를 본래 꼴로 세는 작명소의 원획과 다를 수 있어요.";
export const EXTENSION_NOTICE = "‘확장 한자’는 기기에 따라 글자가 안 보일 수 있어요.";

// ============================================================
// 직접 입력 — 설계 §8-5
// ============================================================

/** PC 의 도움말 */
export const DIRECT_HELP = "한글로 치고 한자 키로 바꾸거나, 한자를 붙여 넣으세요.";
/** 한자도 한글도 아닌 것을 넣었다 — 서버 판정 API 의 문장과 같다 */
export const DIRECT_NOT_HANJA = "한자 한 글자를 넣어 주세요.";
export const DIRECT_CHECKING = "확인하는 중…";

/** 한글만 친 상태 — 조사가 '음절' 뒤에 온다 */
export function hangulOnlyHelp(syllable: string): string {
  return `‘${syllable}’ 음절을 한글로 친 뒤 한자 키(또는 오른쪽 Ctrl, 맥은 Option+Return)로 바꿔 주세요.`;
}

/** 그 음절 목록에 없는 글자 — 서버 응답을 기다리지 않고 바로 알린다 */
export function notInListNote(syllable: string): string {
  return `‘${syllable}’ 음절 후보에 없는 글자예요.`;
}

/**
 * 5초 안에 이유를 받지 못했다. 이름 칸은 대법원 조회를 안내하고(링크 없이 이름만 — 설계 §20-3),
 * 성씨 칸은 인명용 한자 제한을 받지 않으므로 그 안내를 하지 않는다.
 */
export function judgeTimeoutNote(target: HanjaSlot["target"]): string {
  return target === "surname"
    ? "이유를 확인하지 못했어요. 비워 두면 기본으로 두는 성씨 한자로 계산해요."
    : "이유를 확인하지 못했어요. 출생신고에 쓸 수 있는 글자인지는 대법원 인명용 한자 조회에서 확인할 수 있어요.";
}

export interface PasteReport {
  /** 칸에 넣은 글자 수 */
  placed: number;
  /** 넣은 것이 있을 때의 한 줄(role="status") */
  status: string | null;
  /** 넣지 못한 글자의 안내(role="alert") */
  alerts: string[];
}

/** 여러 글자를 나눠 넣은 결과의 문장 — 넣은 수와, 건너뛴 글자마다 한 줄 */
export function pasteReport(steps: readonly PasteStep[], dropped: readonly string[]): PasteReport {
  const alerts: string[] = [];
  let placed = 0;
  for (const step of steps) {
    if (step.status === "placed") placed++;
    else if (step.status === "rejected") {
      alerts.push(`‘${step.character}’ 글자는 ‘${step.slot.syllable}’ 음절 후보에 없어 넣지 않았어요.`);
    } else if (step.status === "locked") {
      alerts.push(`‘${step.character}’ 글자는 ‘${step.slot.syllable}’ 칸에 넣지 않았어요.`);
    } else {
      alerts.push(`‘${step.character}’ 글자는 확인하지 못해 넣지 않았어요.`);
    }
  }
  if (dropped.length > 0) alerts.push(`칸보다 글자가 많아 뒤의 ${dropped.length}자는 넣지 않았어요.`);
  return { placed, status: placed > 0 ? `한자 ${placed}자를 칸에 나눠 넣었어요.` : null, alerts };
}
