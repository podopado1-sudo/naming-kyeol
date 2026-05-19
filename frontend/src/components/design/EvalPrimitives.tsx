/**
 * EvalPrimitives — Evaluate 공유 atoms (4축 뱃지, 5요소 chip, ScoreBar, BreakdownPanel, NotesList)
 * Source: NameForm_design/src/EvalPrimitives.jsx (Claude Design 산출물)
 */
"use client";

import { useState, type ReactNode } from "react";
import { FIVE_EL } from "./DetailPrimitives";
import { SectionHead } from "./DetailPrimitives";

// ============================================================
// ConfBadgeE — 4축 뱃지 (DetailHanja의 ConfidenceBadge와 동일 스펙, sm 사이즈)
// ============================================================
export type ConfidenceGrade = "S" | "A" | "B" | "D";

export function ConfBadgeE({ grade }: { grade?: ConfidenceGrade }) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: 22,
    padding: "0 9px",
    borderRadius: 6,
    fontFamily: 'Inter, "Pretendard Variable", sans-serif',
    fontSize: 11.5,
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.005em",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
    lineHeight: 1,
  };
  const map: Record<ConfidenceGrade, React.CSSProperties> = {
    S: { background: "#1F5A58", color: "#FFF", border: "1.5px solid #1F5A58" },
    A: {
      background: "var(--color-teal-50)",
      color: "#1F5A58",
      border: "1.5px solid var(--color-teal-500)",
    },
    B: {
      background: "#F7EFDD",
      color: "#7A5B22",
      border: "1.5px solid var(--color-gold-600)",
    },
    D: {
      background: "transparent",
      color: "#6B6B6B",
      border: "1.5px dashed #B7B1A7",
    },
  };
  const names: Record<ConfidenceGrade, string> = {
    S: "S 고신뢰",
    A: "A 규칙기반",
    B: "B 수동입력",
    D: "D 획수자동",
  };
  const g = grade ?? "D";
  const st = map[g];
  const [hover, setHover] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ ...base, ...st, cursor: g === "D" ? "help" : "default" }}>
        {g === "S" && (
          <svg
            viewBox="0 0 10 10"
            width="10"
            height="10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1.5 5.2 L4 7.5 L8.5 2.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {names[g]}
      </span>
      {g === "D" && hover && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 5,
            background: "var(--color-text)",
            color: "var(--color-background)",
            fontSize: 11,
            padding: "5px 9px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-md)",
          }}
        >
          획수 기반 자동 추정 — 참고용
        </span>
      )}
    </span>
  );
}

// ============================================================
// ElementChip — 5요소 chip (FIVE_EL 토큰)
// ============================================================
export function ElementChip({ el }: { el?: string }) {
  if (!el) return null;
  const def = FIVE_EL[el];
  if (!def) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 6,
        background: def.tintBg,
        color: def.color,
        whiteSpace: "nowrap",
        lineHeight: 1.5,
        fontFamily: "var(--font-sans)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 12,
          marginRight: 1,
        }}
      >
        {def.label}
      </span>
      <span style={{ margin: "0 2px" }}>·</span>
      <span>{def.name}</span>
    </span>
  );
}

// ============================================================
// ScoreBar — 분기 색상 (80%+ high / 60%+ mid / else low)
// ============================================================
export function ScoreBar({
  label,
  value,
  max,
  bonus,
}: {
  label: string;
  value: number;
  max: number;
  bonus?: boolean;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  const ratio = max > 0 ? value / max : 1;
  let color: string, tint: string;
  if (ratio >= 0.8) {
    color = "var(--color-score-high)";
    tint = "rgba(74,124,89,0.14)";
  } else if (ratio >= 0.6) {
    color = "var(--color-score-mid)";
    tint = "rgba(91,127,170,0.14)";
  } else {
    color = "var(--color-score-low)";
    tint = "rgba(181,135,76,0.16)";
  }
  void tint;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "130px 1fr 64px",
        alignItems: "center",
        columnGap: 14,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "var(--color-text)",
          fontWeight: 500,
        }}
      >
        {label}
        {max > 0 && (
          <span
            style={{
              color: "var(--color-text-3)",
              fontWeight: 400,
              marginLeft: 4,
              fontFamily: "Inter",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            /{max}
          </span>
        )}
      </div>
      <div
        style={{
          height: 12,
          background: "rgba(43,43,43,0.06)",
          borderRadius: 6,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {max > 0 && (
          <div
            style={{
              width: pct + "%",
              height: "100%",
              background: color,
              opacity: 0.75,
              borderRadius: 6,
              transition: "width 480ms cubic-bezier(.2,.6,.2,1)",
            }}
          />
        )}
      </div>
      <div
        style={{
          fontFamily: "Inter",
          fontVariantNumeric: "tabular-nums",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-text)",
          textAlign: "right",
          letterSpacing: "-0.01em",
        }}
      >
        {bonus
          ? value >= 0
            ? `+${value}`
            : `${value}`
          : max > 0
            ? `${value}/${max}`
            : `${value}`}
      </div>
    </div>
  );
}

// ============================================================
// NotesList — checkmark bullet list
// ============================================================
export function NotesList({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul
      style={{
        margin: "16px 0 0",
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {items.map((it, i) => (
        <li
          key={i}
          style={{
            position: "relative",
            paddingLeft: 22,
            fontSize: 13.5,
            lineHeight: 1.65,
            color: "var(--color-text-2)",
          }}
        >
          <svg
            viewBox="0 0 14 14"
            width="12"
            height="12"
            style={{
              position: "absolute",
              left: 0,
              top: 6,
              color: "var(--color-teal)",
            }}
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 7.5 L5.5 10.5 L11.5 3.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {it}
        </li>
      ))}
    </ul>
  );
}

// ============================================================
// BreakdownPanel — Section + ScoreBar 묶음
// ============================================================
export function BreakdownPanel({
  title,
  total,
  rows,
  notes,
  footer,
}: {
  title: string;
  total: number;
  rows: { label: string; value: number; max: number; bonus?: boolean }[];
  notes?: string[];
  footer?: ReactNode;
}) {
  return (
    <div>
      <SectionHead title={`${title} — ${total}점 / 100점`} />
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          padding: "24px 26px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r, i) => (
            <ScoreBar key={i} {...r} />
          ))}
        </div>
        <NotesList items={notes} />
        {footer}
      </div>
    </div>
  );
}
