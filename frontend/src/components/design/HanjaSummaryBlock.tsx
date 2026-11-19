/**
 * HanjaSummaryBlock — /evaluate 결과의 '이 이름의 한자' 블록과 '지금까지 본 조합' 줄
 * (2026-11 설계 docs/plan-hanja-input-2026-11.md §3-4·§8-3·§8-4·§8-8·§9-3).
 *
 * 성씨·이름 글자마다 계산에 쓴 한자를 세로 줄로 쌓는다(줄 = 칸 버튼 + 훈·자원오행·획수·음양·꼬리표, 줄 사이에 자원오행 관계 칩).
 * 칸을 누르면 입력 화면과 같은 고르기 패널(HanjaPickerPanel)이 열리고, 고르면 부모(EvaluateClient)가 같은 화면에서 다시 계산한다.
 *
 * 무엇을 그리나 — 대기 층(설계 §8-3)
 * - 고른 글자·그 사실·관계 칩·꼬리표는 **바로** 바뀐다(lib/hanja-pick.ts blockView — 고른 글자의 사실 + 응답의 elementFit).
 *   점수는 이 블록에 없다. 점수 쪽에는 부모가 '이전 한자 기준 · 다시 계산 중' 글 배지를 단다.
 * - 다시 계산이 실패하면 부모가 pending 을 지운다 → 이 블록은 마지막으로 계산이 끝난 조합으로 되돌아가고,
 *   그 칸 아래에 까닭과 [다시 시도] [닫기]를 적는다. 새 한자 옆에 옛 점수가 남지 않는다.
 *
 * 규칙(tests/evaluate-hanja-pages.test.mjs 가 원문으로 본다)
 * - 기다리는 동안 화면을 흐리게 하지 않는다 — 글로 알린다(꼬리 '다시 고르는 중'·머리의 '다시 계산 중').
 * - 숫자를 만들지 않는다. 비교 줄의 점수는 받아 둔 응답의 값이고, 획수 합은 응답에 실린 두 획수의 합이다.
 * - 오행 글자색은 FIVE_EL 의 글자 전용 토큰(ElementChip), 감점 꼬리표·주의 문장은 amber-warm-700.
 * - 성씨 글자는 훈을 적지 않고 이름용 표시(이름에 피하는 글자)를 달지 않는다.
 * - 콤보·탭 역할과 인라인 2열 격자를 쓰지 않는다. 큰 정적 JSON 을 읽는 서버 전용 모듈을 import 하지 않는다.
 * - 이름·한자·생년월일을 콘솔·브라우저 저장소·분석 이벤트에 싣지 않는다.
 */
"use client";

import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { gradeBadgeKey } from "@/components/hanja/hanja-element-text";
import {
  blockView,
  surnameDefaultAt,
  type BlockSyllable,
  type HanjaChoice,
  type HanjaSlot,
  type PendingHanja,
  type SlotTarget,
} from "@/lib/hanja-pick";
import { requestPickIndex, usePickStore } from "@/lib/hanja-pick-store";
import { EXTENSION_NOTICE, MIXED_SCRIPT_NOTICE, lockedSurnameNote } from "@/lib/hanja-pick-text";
import {
  BLOCK_TITLE,
  FILL_NOTICE,
  FRAME_NOTICE,
  GISHIN_NOTICE,
  GUIDE_SUMMARY,
  MEANING_SCORE_NOTICE,
  NO_BIRTH_NOTICE,
  NO_MEANING_NOTE,
  RELATION_NOTICE,
  SEEN_AUTO_NOTE,
  SEEN_GUIDE,
  SEEN_NO_BIRTH_NOTE,
  SEEN_TITLE,
  SURNAME_NOTICE,
  YONGSHIN_METHOD_NOTICE,
  birthTimeNotice,
  blockSlots,
  blockSubtitle,
  comboLine,
  fillLabel,
  forbiddenNote,
  isMixedResult,
  isPenaltyFill,
  noneNote,
  recalcFailedNote,
  relationBetween,
  relationsOf,
  surnameTail,
  syllableTail,
  yongshinLine,
} from "@/lib/hanja-summary-text";
import { noHanjaSyllableNote } from "@/lib/no-hanja";
import type { ElementFit, HanjaFact, HanjaSummary, NameEvaluationResponse } from "@/lib/types";

import { SectionHead } from "./DetailPrimitives";
import { ElementChip } from "./EvalPrimitives";
import { HanjaPickerPanel } from "./HanjaPickerPanel";
import { HanjaSlots, slotButtonId, slotKey } from "./HanjaSlots";
import { OhaengRelationChip } from "./OhaengRelationChip";
import { RESOURCE_GRADE_INFO, type ResourceBadgeKey } from "./resource-grade";

/** 다시 계산하지 못한 칸 — 부모(EvaluateClient)가 세운다 */
export interface RecalcErrorView {
  /** 실패마다 다른 번호 */
  id: number;
  target: SlotTarget;
  index: number;
  /** 무엇으로 바꾸려 했나 — slot = 서버가 짚은 칸이 이번에 바꾼 칸이 아니다(글자를 대지 않는다) */
  kind: "hanja" | "none" | "auto" | "slot";
  character: string | null;
  /** 까닭 — lib/api.ts 의 문장(요청이 몰림·응답 없음·연결 실패·서버의 검증 문장) */
  message: string;
  /** 서버가 그 칸을 짚었다(400 의 target·slot) — 그 칸의 고르기 패널을 연다 */
  open: boolean;
}

/** 계산이 끝난 조합 하나 — '지금까지 본 조합' 줄 */
export interface SeenCombo {
  /** 그 조합의 입력 서명(한자 포함) */
  sig: string;
  data: NameEvaluationResponse;
}

export interface HanjaSummaryBlockProps {
  /** 마지막으로 계산이 끝난 응답의 hanjaSummary */
  summary: HanjaSummary;
  /** 응답을 기다리는 동안의 바뀐 칸 — 없으면 null */
  pending: PendingHanja | null;
  /** 생년월일을 넣은 결과인가(조화 점수를 계산했는가) */
  birthDateProvided: boolean;
  /** 태어난 시각을 넣었는가 */
  hasBirthTime: boolean;
  recalcError: RecalcErrorView | null;
  /** 같은 조건에서 계산이 끝난 조합들(지금 조합 포함) */
  seen: readonly SeenCombo[];
  /** 지금 조합의 서명 */
  currentSig: string;
  onChange: (target: SlotTarget, index: number, choice: HanjaChoice) => void;
  onRetry: () => void;
  onDismissError: () => void;
  /** 본 조합으로 돌아간다(받아 둔 응답을 다시 보여 줄 뿐 — 서버를 부르지 않는다) */
  onSelectSeen: (sig: string) => void;
}

// ------------------------------------------------------------
// 스타일
// ------------------------------------------------------------
const card: CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-sm)",
  padding: "22px 24px",
  fontFamily: "var(--font-sans)",
};

const glossText: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.45,
  fontWeight: 500,
  color: "var(--color-text)",
  wordBreak: "keep-all",
  overflowWrap: "anywhere",
};

/** 성씨 줄의 머리 글 — 훈 자리에 훈 대신 '성씨 유' */
const surnameLabelText: CSSProperties = { ...glossText, fontSize: 13.5, color: "var(--color-text-2)" };

const factLine: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "4px 8px",
  marginTop: 6,
  fontSize: 12.5,
  lineHeight: 1.5,
  color: "var(--color-text-2)",
};

const noteText: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "var(--color-text-2)",
  wordBreak: "keep-all",
};

const alertText: CSSProperties = { ...noteText, color: "var(--color-amber-warm-700)" };

const guideText: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 12.5,
  lineHeight: 1.65,
  color: "var(--color-text-2)",
  wordBreak: "keep-all",
};

const smallButton: CSSProperties = {
  appearance: "none",
  minHeight: 44,
  padding: "0 14px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-text)",
  cursor: "pointer",
};

/** 역할 꼬리표 — 감점이 걸린 것(기신·많은 오행)은 주의 글자색, 나머지는 청록 글자색 */
function fillTagStyle(penalty: boolean): CSSProperties {
  return {
    display: "inline-block",
    padding: "1px 8px",
    borderRadius: 6,
    fontSize: 11.5,
    lineHeight: 1.6,
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: penalty ? "rgba(181,135,76,0.10)" : "var(--color-teal-50)",
    color: penalty ? "var(--color-amber-warm-700)" : "var(--color-teal-800)",
  };
}

// ------------------------------------------------------------
// 줄 한 칸의 내용
// ------------------------------------------------------------

/** 자원오행 칩 · 획수 · 음양 · (확정이 아닐 때만) 등급 말 · 확장 한자 — 성씨 글자는 음양·등급을 적지 않는다 */
function FactChips({ fact, surname }: { fact: HanjaFact; surname?: boolean }) {
  const gradeKey = surname ? null : gradeBadgeKey(fact.resourceGrade, fact.vReasons);
  const grade = gradeKey && gradeKey !== "R" ? RESOURCE_GRADE_INFO[gradeKey as ResourceBadgeKey]?.label : undefined;
  return (
    <>
      <ElementChip el={fact.fiveElement} />
      {fact.strokeCount > 0 && <span>{fact.strokeCount}획</span>}
      {!surname && fact.yinYang && <span>{fact.yinYang}</span>}
      {grade && <span>{grade}</span>}
      {!fact.basic && <span>확장 한자</span>}
    </>
  );
}

function NameDetail({
  syllable,
  fit,
  birthDateProvided,
  noteId,
  children,
}: {
  syllable: BlockSyllable;
  fit: ElementFit | null;
  birthDateProvided: boolean;
  /** 열 수 없는 칸의 까닭 문장 id — 칸 버튼이 aria-describedby 로 잇는다 */
  noteId: string;
  children?: ReactNode;
}) {
  const fact = syllable.hanja;
  const tail = syllableTail(syllable, fit);
  return (
    <div>
      {fact && <p style={glossText}>{fact.gloss || "뜻 풀이 없음"}</p>}
      {fact && (
        <div style={factLine}>
          <FactChips fact={fact} />
        </div>
      )}
      {(tail || syllable.fills.length > 0) && (
        <div style={{ ...factLine, marginTop: fact ? 6 : 0 }}>
          {tail && <span>{tail}</span>}
          {fact &&
            syllable.fills.map((fill) => (
              <span key={fill} style={fillTagStyle(isPenaltyFill(fill))}>
                {fillLabel(fill, fact.fiveElement, fit)}
              </span>
            ))}
        </div>
      )}
      {fact?.forbidden && <p style={alertText}>{forbiddenNote(fact.gloss)}</p>}
      {fact && !fact.hasMeaning && <p style={noteText}>{NO_MEANING_NOTE}</p>}
      {syllable.source === "none" && <p style={noteText}>{noneNote(syllable.syllable, birthDateProvided)}</p>}
      {syllable.source === "unavailable" && (
        <p id={noteId} style={{ ...noteText, marginTop: 0 }}>
          {noHanjaSyllableNote(syllable.syllable)}
        </p>
      )}
      {children}
    </div>
  );
}

function SurnameDetail({
  slot,
  waiting,
  noteId,
  children,
}: {
  slot: HanjaSlot;
  waiting: boolean;
  noteId: string;
  children?: ReactNode;
}) {
  const tail = surnameTail(slot, waiting);
  return (
    <div>
      {/* 성씨 글자는 훈을 적지 않는다 — 글자·획수·자원오행 칩만 */}
      <p style={surnameLabelText}>성씨 {slot.syllable}</p>
      {slot.fact && (
        <div style={factLine}>
          <FactChips fact={slot.fact} surname />
        </div>
      )}
      {tail && (
        <div style={factLine}>
          <span>{tail}</span>
        </div>
      )}
      {slot.state === "locked" && (
        <p id={noteId} style={noteText}>
          {lockedSurnameNote(slot.syllable)}
        </p>
      )}
      {children}
    </div>
  );
}

// ------------------------------------------------------------
// 블록
// ------------------------------------------------------------
export function HanjaSummaryBlock({
  summary,
  pending,
  birthDateProvided,
  hasBirthTime,
  recalcError,
  seen,
  currentSig,
  onChange,
  onRetry,
  onDismissError,
  onSelectSeen,
}: HanjaSummaryBlockProps) {
  const uid = useId();
  const groupLabelId = `${uid}-slots`;
  const panelId = `${uid}-panel`;
  const slotBase = `${uid}-slot`;
  const errorId = `${uid}-error`;
  const noteBase = `${uid}-note`;

  const store = usePickStore();
  // 색인은 이름과 무관한 고정 주소다 — 잠긴 칸·성씨 기본 한자를 안다(입력 화면에서 이미 받았으면 그대로 쓴다)
  useEffect(() => {
    void requestPickIndex();
  }, []);

  const view = useMemo(() => blockView(summary, pending), [summary, pending]);
  const slots = useMemo(() => blockSlots(view, store.index), [view, store.index]);
  const all = [...slots.surname, ...slots.name];
  const fit = view.elementFit;

  // 열린 칸(한 번에 하나)
  const [openKey, setOpenKey] = useState<string | null>(null);
  // 서버가 짚은 칸을 여는 일이 끝났는가
  const [ackedError, setAckedError] = useState<number | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null);

  const errorSlot = recalcError
    ? ((recalcError.target === "name" ? slots.name : slots.surname)[recalcError.index] ?? null)
    : null;
  const errorKey = errorSlot ? slotKey(errorSlot) : null;
  const forcedKey = recalcError?.open && errorKey && recalcError.id !== ackedError ? errorKey : null;
  const effectiveOpenKey = forcedKey ?? openKey;
  const openSlot = all.find((slot) => slot.openable && slotKey(slot) === effectiveOpenKey) ?? null;

  // 패널을 닫으면(고르기·닫기·Esc) 그 칸 버튼으로 포커스를 돌려놓는다 — 포커스가 문서 맨 위로 떨어지지 않게
  useEffect(() => {
    if (!focusRequest) return;
    const button = document.getElementById(focusRequest.id);
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: "nearest" });
  }, [focusRequest]);

  function focusSlot(slot: Pick<HanjaSlot, "target" | "index">) {
    setFocusRequest((prev) => ({ id: slotButtonId(slotBase, slot), n: (prev?.n ?? 0) + 1 }));
  }

  function ackError() {
    if (recalcError) setAckedError(recalcError.id);
  }

  function toggleSlot(slot: HanjaSlot) {
    const key = slotKey(slot);
    ackError();
    setOpenKey(effectiveOpenKey === key ? null : key);
  }

  function closePanel() {
    if (!openSlot) return;
    ackError();
    setOpenKey(null);
    focusSlot(openSlot);
  }

  function applyChoice(slot: HanjaSlot, choice: HanjaChoice) {
    ackError();
    setOpenKey(null);
    focusSlot(slot);
    onChange(slot.target, slot.index, choice);
  }

  /** 성씨 칸에서 기본 한자를 고르면 '기본 한자로'와 같다(서버가 지정 없음으로 접는 값이다 — 주소·서명이 갈리지 않게) */
  function choiceFor(slot: HanjaSlot, fact: HanjaFact): HanjaChoice {
    if (slot.target === "surname" && surnameDefaultAt(store.index, summary.surname.hangul, slot.index) === fact.character) {
      return { kind: "auto" };
    }
    return { kind: "hanja", fact };
  }

  const noteIdOf = (slot: HanjaSlot) => `${noteBase}-${slot.target}-${slot.index}`;
  const describedBy = (slot: HanjaSlot) => {
    const ids = [
      slot.state === "locked" || slot.state === "hangul" ? noteIdOf(slot) : undefined,
      slotKey(slot) === errorKey ? errorId : undefined,
    ];
    return ids.filter(Boolean).join(" ") || undefined;
  };

  /** 다시 계산하지 못한 칸 아래의 안내 — 블록은 이미 마지막으로 계산이 끝난 조합으로 돌아와 있다 */
  const errorNote = (slot: HanjaSlot) => {
    if (!recalcError || slotKey(slot) !== errorKey) return null;
    return (
      <div id={errorId} style={{ marginTop: 8 }}>
        <p role="alert" style={{ ...alertText, margin: 0 }}>
          {recalcFailedNote({ syllable: slot.syllable, kind: recalcError.kind, character: recalcError.character })}{" "}
          {recalcError.message}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            style={smallButton}
            onClick={() => {
              focusSlot(slot);
              onRetry();
            }}
          >
            다시 시도
          </button>
          <button
            type="button"
            style={smallButton}
            onClick={() => {
              focusSlot(slot);
              onDismissError();
            }}
          >
            닫기
          </button>
        </div>
      </div>
    );
  };

  const detail = (slot: HanjaSlot) => {
    if (slot.target === "surname") {
      return (
        <SurnameDetail slot={slot} waiting={view.surname.waiting} noteId={noteIdOf(slot)}>
          {errorNote(slot)}
        </SurnameDetail>
      );
    }
    const syllable = view.syllables[slot.index];
    if (!syllable) return null;
    return (
      <NameDetail syllable={syllable} fit={fit} birthDateProvided={birthDateProvided} noteId={noteIdOf(slot)}>
        {errorNote(slot)}
      </NameDetail>
    );
  };

  /** 이웃한 두 글자의 자원오행 관계 — 성씨 끝 글자 → 이름 1, 이름 1 → 이름 2 …(복성의 두 글자 사이에는 두지 않는다) */
  const between = (previous: HanjaSlot, next: HanjaSlot) => {
    if (next.target !== "name") return null;
    const relation = relationBetween(previous.fact, next.fact);
    return relation ? <OhaengRelationChip kind={relation.kind} label={relation.label} /> : null;
  };

  const nameFacts = view.syllables.map((s) => s.hanja);
  const hasRelation = relationsOf(view.surname.chars, nameFacts).some((r) => r !== null);
  const hasGishin = view.syllables.some((s) => s.fills.includes("gishin"));
  const hasExtension = [...view.surname.chars, ...nameFacts].some((fact) => fact !== null && !fact.basic);
  const yongshin = birthDateProvided ? yongshinLine(fit) : null;

  return (
    <div
      onKeyDown={(e) => {
        // 칸에 포커스가 있을 때의 Esc — 패널 안의 Esc 는 패널이 받는다
        if (e.key === "Escape" && !e.nativeEvent.isComposing && openSlot) closePanel();
      }}
    >
      <SectionHead title={BLOCK_TITLE} subtitle={blockSubtitle(summary.userHanja)} />
      <div className="eval-hanja-block" style={card}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "2px 12px",
            marginBottom: 14,
          }}
        >
          <span id={groupLabelId} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
            성씨와 이름 글자
          </span>
          {view.waiting && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-2)" }}>다시 계산 중</span>
          )}
        </div>

        <HanjaSlots
          surname={slots.surname}
          name={slots.name}
          idBase={slotBase}
          openKey={openSlot ? slotKey(openSlot) : null}
          panelId={panelId}
          labelledBy={groupLabelId}
          invalidKey={errorKey}
          describedBy={describedBy}
          onToggle={toggleSlot}
          detail={detail}
          between={between}
        />

        {openSlot && (
          <HanjaPickerPanel
            key={slotKey(openSlot)}
            id={panelId}
            slot={openSlot}
            representative={
              openSlot.target === "surname"
                ? surnameDefaultAt(store.index, summary.surname.hangul, openSlot.index)
                : null
            }
            forbiddenCount={store.index?.counts.forbidden ?? null}
            elementFit={birthDateProvided ? fit : null}
            onPick={(fact) => applyChoice(openSlot, choiceFor(openSlot, fact))}
            onAuto={() => applyChoice(openSlot, { kind: "auto" })}
            onNone={openSlot.target === "name" ? () => applyChoice(openSlot, { kind: "none" }) : undefined}
            onClose={closePanel}
          />
        )}

        <div style={{ marginTop: 16 }}>
          {yongshin && <p style={{ ...guideText, marginTop: 0, color: "var(--color-text)" }}>{yongshin}</p>}
          {hasGishin && <p style={guideText}>{GISHIN_NOTICE}</p>}
          {!birthDateProvided && <p style={{ ...guideText, marginTop: 0 }}>{NO_BIRTH_NOTICE}</p>}
          {isMixedResult(summary) && <p style={guideText}>{MIXED_SCRIPT_NOTICE}</p>}
          {hasExtension && <p style={guideText}>{EXTENSION_NOTICE}</p>}

          <details style={{ marginTop: 12 }}>
            {/* 펼침 표시(▸)는 브라우저 기본 그대로 — 누름 영역은 위아래 여백으로 44px */}
            <summary
              style={{
                padding: "12px 0",
                fontSize: 13,
                lineHeight: "20px",
                fontWeight: 600,
                color: "var(--color-teal-800)",
                cursor: "pointer",
              }}
            >
              {GUIDE_SUMMARY}
            </summary>
            {hasRelation && <p style={{ ...guideText, marginTop: 0 }}>{RELATION_NOTICE}</p>}
            {birthDateProvided && (
              <>
                <p style={guideText}>{FILL_NOTICE}</p>
                {yongshin && <p style={guideText}>{YONGSHIN_METHOD_NOTICE}</p>}
                <p style={guideText}>{FRAME_NOTICE}</p>
                <p style={guideText}>{birthTimeNotice(hasBirthTime)}</p>
                <p style={guideText}>{SURNAME_NOTICE}</p>
              </>
            )}
            <p style={guideText}>{MEANING_SCORE_NOTICE}</p>
          </details>
        </div>

        {seen.length >= 2 && (
          <SeenCombos
            seen={seen}
            currentSig={currentSig}
            birthDateProvided={birthDateProvided}
            hasYongshin={!!fit?.yongshin}
            onSelect={onSelectSeen}
          />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// '지금까지 본 조합' — 같은 조건에서 한자만 바꿔 본 결과(계산이 끝난 조합만)
// ------------------------------------------------------------
const seenChunk: CSSProperties = { whiteSpace: "nowrap" };
const seenNumber: CSSProperties = {
  fontFamily: "Inter, var(--font-pretendard), sans-serif",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
  color: "var(--color-text)",
};

function SeenCombos({
  seen,
  currentSig,
  birthDateProvided,
  hasYongshin,
  onSelect,
}: {
  seen: readonly SeenCombo[];
  currentSig: string;
  birthDateProvided: boolean;
  hasYongshin: boolean;
  onSelect: (sig: string) => void;
}) {
  const titleId = useId();
  const rows = seen.flatMap((entry) => {
    const summary = entry.data.hanjaSummary;
    return summary ? [{ entry, line: comboLine(summary) }] : [];
  });
  if (rows.length < 2) return null;
  const anyAuto = rows.some((row) => row.line.hasAuto);

  return (
    <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--color-divider)" }}>
      <h3 id={titleId} style={{ margin: 0, fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: "var(--color-text)" }}>
        {SEEN_TITLE}
      </h3>
      <p style={{ ...guideText, marginTop: 4 }}>{SEEN_GUIDE}</p>
      <ul aria-labelledby={titleId} style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
        {rows.map(({ entry, line }) => {
          const current = entry.sig === currentSig;
          const data = entry.data;
          return (
            <li key={entry.sig}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => onSelect(entry.sig)}
                style={{
                  appearance: "none",
                  width: "100%",
                  minHeight: 56,
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  textAlign: "left",
                  background: "var(--color-surface)",
                  border: current ? "1.5px solid var(--color-teal)" : "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "var(--font-sans)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }}>
                  <span className="font-hanja" style={{ fontSize: 20, lineHeight: 1.3, fontWeight: 400 }}>
                    {line.surname} {line.name}
                  </span>
                  {current && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-teal-800)", whiteSpace: "nowrap" }}>
                      지금 조합
                    </span>
                  )}
                </span>
                <span
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "2px 12px",
                    marginTop: 4,
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    color: "var(--color-text-2)",
                  }}
                >
                  <span style={seenChunk}>자원오행 {line.elements}</span>
                  {birthDateProvided ? (
                    <>
                      <span style={seenChunk}>
                        미학 <span style={seenNumber}>{data.aestheticScore}</span>
                      </span>
                      <span style={seenChunk}>
                        조화 <span style={seenNumber}>{data.harmonyScore}</span>
                      </span>
                      <span style={seenChunk}>
                        종합 <span style={seenNumber}>{data.finalScore}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      {line.strokeSum !== null && <span style={seenChunk}>앞 두 글자 획수 합 {line.strokeSum}</span>}
                      <span style={seenChunk}>음양 {line.yinYang}</span>
                      {line.relations.map((label, i) => (
                        <span key={i} style={seenChunk}>
                          {i === 0 ? `자원오행 관계 ${label}` : label}
                        </span>
                      ))}
                    </>
                  )}
                  {line.hasAuto && <span style={seenChunk}>자동으로 고른 글자 포함</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {birthDateProvided && hasYongshin && anyAuto && <p style={guideText}>{SEEN_AUTO_NOTE}</p>}
      {!birthDateProvided && <p style={guideText}>{SEEN_NO_BIRTH_NOTE}</p>}
    </div>
  );
}
