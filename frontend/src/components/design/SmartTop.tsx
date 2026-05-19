/**
 * SmartTop — Smart Result 상단 (SearchContextBar + PhonologyPill + TopPickHero)
 * Source: NameForm_design/src/SmartTop.jsx (Claude Design 산출물)
 */
"use client";

import { useState } from "react";
import { Button } from "./Primitives";
import type {
  PhonologyNote,
  TopPick,
} from "@/lib/types";

// ============================================================
// SearchContextBar
// ============================================================
export function SearchContextBar({
  summary,
  count,
  onEdit,
}: {
  summary: string;
  count: number;
  onEdit?: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13.5,
            color: "var(--color-text)",
            flexWrap: "wrap",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-navy)",
              background: "var(--color-navy-50)",
              padding: "3px 9px",
              borderRadius: "var(--radius-sm)",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            SMART
          </span>
          <span
            style={{
              color: "var(--color-text-2)",
              whiteSpace: "nowrap",
            }}
          >
            {summary}
          </span>
          <span style={{ color: "var(--color-text-3)" }}>—</span>
          <span
            style={{
              color: "var(--color-text)",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {count}개 추천
          </span>
        </div>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onEdit?.();
          }}
          style={{
            fontSize: 13,
            color: "var(--color-text-2)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>✎</span>
          조건 수정
        </a>
      </div>
    </div>
  );
}

// ============================================================
// PhonologyPill — hover/focus tooltip
// ============================================================
export function PhonologyPill({
  notes,
  compact = false,
}: {
  notes?: PhonologyNote[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!notes || notes.length === 0) return null;

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11.5,
          color: "var(--color-text-2)",
          background: compact ? "transparent" : "rgba(43,43,43,0.05)",
          border: compact ? "1px solid var(--color-border)" : "none",
          padding: compact ? "2px 7px" : "3px 8px",
          borderRadius: 999,
          cursor: "help",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            border: "1px solid var(--color-text-3)",
            color: "var(--color-text-3)",
            fontSize: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            fontStyle: "italic",
            fontFamily: "serif",
          }}
        >
          i
        </span>
        음운 특성 {notes.length}건
      </span>
      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 10,
            minWidth: 240,
            maxWidth: 320,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            padding: 14,
            textAlign: "left",
          }}
        >
          {notes.map((n, i) => (
            <div
              key={n.id || i}
              style={{
                marginBottom: i < notes.length - 1 ? 10 : 0,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-navy)",
                  marginBottom: 3,
                }}
              >
                {n.name}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--color-text-2)",
                  lineHeight: 1.55,
                }}
              >
                {n.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

// ============================================================
// TopPickHero — 추천 1위 영웅 카드
// ============================================================
export function TopPickHero({
  topPick,
  onDetail,
}: {
  topPick: TopPick | null;
  onDetail?: () => void;
}) {
  if (!topPick) return null;
  const c = topPick.candidate;
  const score = c.score ?? 0;
  const scoreColor =
    score >= 90
      ? "var(--color-score-high)"
      : score >= 80
        ? "var(--color-score-mid)"
        : "var(--color-score-low)";

  return (
    <div
      style={{
        position: "relative",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-lg)",
        padding: "40px 44px 36px",
        overflow: "hidden",
      }}
    >
      <svg
        aria-hidden
        viewBox="0 0 800 400"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          right: -80,
          top: -60,
          width: 760,
          height: 420,
          opacity: 0.05,
          pointerEvents: "none",
        }}
      >
        <g fill="none" stroke="#1E3A5F" strokeWidth="1">
          <path d="M-50 80 C 180 30, 360 160, 560 80 S 860 160, 1060 100" />
          <path d="M-50 160 C 180 120, 360 240, 560 160 S 860 240, 1060 180" />
          <path d="M-50 240 C 180 200, 360 320, 560 240 S 860 320, 1060 260" />
          <path d="M-50 320 C 180 280, 360 400, 560 320 S 860 400, 1060 340" />
        </g>
      </svg>

      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 40,
          alignItems: "start",
        }}
      >
        <div>
          {/* Badges row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 24,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                background: "var(--color-gold-100)",
                color: "#6F5421",
                border: "1px solid rgba(201,169,110,.5)",
                padding: "5px 11px",
                borderRadius: "var(--radius-sm)",
                letterSpacing: "-0.005em",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              🏅 추천 1위
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text-2)",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {topPick.categoryLabel}
            </span>
          </div>

          <h1
            style={{
              fontSize: 56,
              lineHeight: 1.1,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "var(--color-text)",
              margin: 0,
              marginBottom: 14,
            }}
          >
            {c.fullName}
          </h1>

          {c.name && c.name !== "—" && (
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 32,
                fontWeight: 500,
                color: "var(--color-navy)",
                letterSpacing: "0.08em",
                marginBottom: 14,
              }}
            >
              {c.name}
            </div>
          )}

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: "var(--color-text-2)",
              margin: 0,
              marginBottom: 22,
              maxWidth: 520,
            }}
          >
            {c.meaning}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 22,
            }}
          >
            {(c.tags ?? []).map((t) => (
              <span
                key={t}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "5px 11px",
                  background: "var(--color-teal-50)",
                  color: "var(--color-teal)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  borderRadius: "var(--radius-sm)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {t}
              </span>
            ))}
            <PhonologyPill notes={c.phonologyNotes} />
          </div>

          <Button variant="primary" onClick={onDetail}>
            이 이름 상세 분석 →
          </Button>
        </div>

        <div
          style={{
            textAlign: "right",
            paddingLeft: 32,
            borderLeft: "1px solid var(--color-divider)",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minWidth: 160,
          }}
        >
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1,
              color: scoreColor,
              letterSpacing: "-0.03em",
            }}
          >
            {score}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-2)",
              marginTop: 10,
              letterSpacing: "0.12em",
              fontWeight: 500,
            }}
          >
            BALANCE
          </div>
          <div
            style={{
              marginTop: 18,
              paddingTop: 18,
              borderTop: "1px dashed var(--color-divider)",
              fontSize: 12,
              color: "var(--color-text-3)",
              lineHeight: 1.6,
            }}
          >
            발음 · 의미
            <br />
            세대 중립도
            <br />
            종합 점수
          </div>
        </div>
      </div>
    </div>
  );
}
