/**
 * EvalPrimitives — Evaluate 공유 atoms (5요소 chip, ScoreBar, BreakdownPanel, NotesList)
 * Source: NameForm_design/src/EvalPrimitives.jsx (Claude Design 산출물)
 *
 * 등급 뱃지(옛 ConfBadgeE — S/A/B/D 만 있어 백엔드 C 등급이 오면 빈 뱃지였다)는 2026-10-22 S7 에
 * DetailHanja 의 ResourceGradeBadge(size="sm")로 합쳤다 — 자원오행 판정 등급 R·V·X·U.
 */
"use client";

import type { ReactNode } from "react";
import { FIVE_EL } from "./DetailPrimitives";
import { SectionHead } from "./DetailPrimitives";
import { isCautionNote } from "@/lib/note-polarity";
import { formatSignedPoints } from "@/lib/signed-points";

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
        color: def.text,
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
    // 모바일(≤480px)에서는 라벨·값 1줄 + 막대 1줄로 접힌다 — BreakdownPanel의 EVAL_BAR_CSS
    <div
      className="eval-score-bar"
      style={{
        display: "grid",
        // 150px — '전통 81수리(참고)/15'가 한 줄에 들어가는 폭
        gridTemplateColumns: "150px 1fr 64px",
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
        className="eval-score-bar__track"
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
        {/* 가점·감점 행 부호는 값으로 — /name 미학 점수 카드와 같은 규칙(lib/signed-points.ts) */}
        {bonus
          ? formatSignedPoints(value)
          : max > 0
            ? `${value}/${max}`
            : `${value}`}
      </div>
    </div>
  );
}

// ============================================================
// NotesList — 좋은 점은 청록 ✓, 감점·주의·참고는 중립 막대
// ============================================================

// 감점·주의·참고 노트 판정은 lib/note-polarity.ts — 키워드 목록과 근거는 그 파일 머리 주석,
// 사례표는 tests/note-polarity.test.mjs (React 없이 node --test로 검사하려고 뺐다)

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
      {items.map((it, i) => {
        const caution = isCautionNote(it);
        return (
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
                color: caution ? "var(--color-text-3)" : "var(--color-teal)",
              }}
              fill="none"
              aria-hidden="true"
            >
              {caution ? (
                <path
                  d="M3.5 7 L10.5 7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M2.5 7.5 L5.5 10.5 L11.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            {it}
          </li>
        );
      })}
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
        className="eval-breakdown"
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
      <style>{EVAL_BAR_CSS}</style>
    </div>
  );
}

// 360px 기기에서 라벨 150px + 값 64px를 빼면 막대가 25px로 짓눌렸다(감사 UX-2) —
// 480px 이하에서는 라벨·값을 위 줄, 막대를 아래 줄 전체 폭으로 둔다.
const EVAL_BAR_CSS = `
  @media (max-width: 480px) {
    .eval-breakdown { padding: 20px 16px !important; }
    .eval-score-bar {
      grid-template-columns: 1fr auto !important;
      row-gap: 6px;
    }
    .eval-score-bar__track { grid-column: 1 / -1; grid-row: 2; }
  }
`;
