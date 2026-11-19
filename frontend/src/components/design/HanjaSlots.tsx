/**
 * HanjaSlots — 성씨·이름 음절마다 한자 칸 한 줄(2026-11 설계 docs/plan-hanja-input-2026-11.md §3-1·§8-1·§8-8·§8-9).
 *
 * 칸 = 버튼 하나(56px 정사각 + 아래 음절). 화면 글자는 한자 한 자나 '자동'·'한글'뿐이라 이름(aria-label)을 따로 준다.
 * 누르면 칸 줄 바로 아래의 고르기 패널(HanjaPickerPanel)이 열린다 — 한 번에 한 칸만(`openKey`).
 * 칸 상태는 여기서 정하지 않는다. lib/hanja-pick.ts deriveSlots 가 계산한 칸을 받아 그리기만 한다.
 *
 * 규칙
 * - `.sumi-form` 전역 규칙(app/globals.css)에 걸리지 않게 콤보·탭 역할을 쓰지 않는다 — 버튼 + aria-expanded.
 * - 상태를 흐림으로 알리지 않는다(글자 대비가 떨어진다). 잠긴 칸은 바탕색과 글로 알린다.
 * - 잠긴 칸은 disabled 가 아니라 aria-disabled 다 — 포커스가 닿아야 안내 문장(aria-describedby)을 읽을 수 있다.
 * - 한자 글자는 사이트 한자 서체(font-hanja). 성씨 칸은 훈을 그리지도 읽지도 않는다(lib/hanja-pick-text.ts slotAriaLabel).
 */
"use client";

import type { CSSProperties } from "react";

import { choiceKey, type HanjaSlot } from "@/lib/hanja-pick";
import { slotAriaLabel, slotFace } from "@/lib/hanja-pick-text";

/** 칸의 열쇠 — 같은 자리·같은 음절이면 같은 값(선택 저장 키와 같다) */
export function slotKey(slot: HanjaSlot): string {
  return choiceKey(slot.target, slot.index, slot.syllable);
}

/** 칸 버튼의 id — 패널을 닫은 뒤 이 버튼으로 포커스를 돌려놓는다 */
export function slotButtonId(idBase: string, slot: Pick<HanjaSlot, "target" | "index">): string {
  return `${idBase}-${slot.target}-${slot.index}`;
}

export interface HanjaSlotsProps {
  /** 성씨 칸(없으면 빈 목록) */
  surname: readonly HanjaSlot[];
  /** 이름 칸 */
  name: readonly HanjaSlot[];
  /** 칸 버튼 id 의 머리 */
  idBase: string;
  /** 열려 있는 칸의 열쇠 — 없으면 null */
  openKey: string | null;
  /** 고르기 패널의 id(aria-controls) */
  panelId: string;
  /** 칸 줄의 이름(머리글 요소의 id) */
  labelledBy?: string;
  /**
   * 서버가 틀렸다고 알려 준 칸의 열쇠 — 테두리로 표시한다. 버튼 역할은 aria-invalid 를 받지 않으므로(ARIA),
   * 화면 읽기 프로그램에는 오류 문장을 describedBy 로 잇는다
   */
  invalidKey?: string | null;
  /** 칸에 딸린 안내 문장의 id(잠긴 칸의 까닭·오류 문장) */
  describedBy?: (slot: HanjaSlot) => string | undefined;
  onToggle: (slot: HanjaSlot) => void;
}

/** 칸 버튼을 화면에 다시 들일 때 위쪽에 남길 틈(px) — 사이트 머리(sticky, 약 70px)보다 넉넉하게 */
const SLOT_SCROLL_MARGIN = 88;

const row: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: 6,
};

const boxBase: CSSProperties = {
  width: 56,
  height: 56,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
};

function boxStyle(slot: HanjaSlot, open: boolean, invalid: boolean): CSSProperties {
  const style: CSSProperties = { ...boxBase };
  if (slot.state === "locked") {
    style.background = "var(--color-surface-2)";
    style.border = "1px solid var(--color-border)";
  } else if (slot.state === "picked" || slot.state === "carried" || slot.state === "none") {
    style.border = "1.5px solid var(--color-teal)";
  } else if (slot.character) {
    style.border = "1px solid var(--color-border)";
  } else {
    // '자동'·'한글'·'확인 중' — 아직 정해지지 않은 칸은 점선(선 색은 흰 바탕 3:1 이상)
    style.border = "1px dashed var(--color-ink-dan)";
  }
  if (invalid) style.border = "2px solid var(--color-amber-warm-700)";
  if (open) style.boxShadow = "0 0 0 2px var(--color-navy)";
  return style;
}

export function HanjaSlots({
  surname,
  name,
  idBase,
  openKey,
  panelId,
  labelledBy,
  invalidKey,
  describedBy,
  onToggle,
}: HanjaSlotsProps) {
  const renderSlot = (slot: HanjaSlot) => {
    const key = slotKey(slot);
    const open = key === openKey;
    const invalid = key === invalidKey;
    const locked = !slot.openable;
    const face = slotFace(slot);
    return (
      <button
        key={key}
        type="button"
        id={slotButtonId(idBase, slot)}
        aria-label={slotAriaLabel(slot)}
        aria-expanded={locked ? undefined : open}
        aria-controls={open ? panelId : undefined}
        aria-disabled={locked || undefined}
        aria-describedby={describedBy?.(slot)}
        onClick={() => {
          if (!locked) onToggle(slot);
        }}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          padding: 0,
          margin: 0,
          width: 56,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          cursor: locked ? "default" : "pointer",
          fontFamily: "var(--font-sans)",
          // 패널을 닫고 이 버튼으로 돌아올 때(scrollIntoView) 화면 위에 붙어 있는 사이트 머리(약 70px) 밑에 가리지 않게
          scrollMarginTop: SLOT_SCROLL_MARGIN,
        }}
      >
        <span style={boxStyle(slot, open, invalid)}>
          {face.glyph ? (
            <span className="font-hanja" style={{ fontSize: 28, lineHeight: 1 }}>
              {face.glyph}
            </span>
          ) : (
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: locked ? "var(--color-text-3)" : "var(--color-text-2)",
                whiteSpace: "nowrap",
              }}
            >
              {face.word}
            </span>
          )}
        </span>
        <span style={{ fontSize: 12.5, lineHeight: 1.3, color: "var(--color-text-2)" }}>{slot.syllable}</span>
        {face.tail && (
          <span style={{ fontSize: 10.5, lineHeight: 1.2, color: "var(--color-text-3)", whiteSpace: "nowrap" }}>
            {face.tail}
          </span>
        )}
      </button>
    );
  };

  return (
    <div role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : "한자 칸"} style={row}>
      {surname.map(renderSlot)}
      {surname.length > 0 && name.length > 0 && (
        <span aria-hidden style={{ width: 1, height: 56, background: "var(--color-border)" }} />
      )}
      {name.map(renderSlot)}
    </div>
  );
}
