/**
 * DetailPrimitives — Five-element tokens + SectionHead + ScoreTile
 * Source: NameForm_design/src/DetailPrimitives.jsx (Claude Design 산출물)
 */
import type { CSSProperties } from "react";

// ============================================================
// Five-element color tokens — every element uses tint background, never solid bold
// ============================================================
export interface FiveElement {
  label: string;
  name: string;
  color: string;
  tintBg: string;
  solidBorder: string;
}

export const FIVE_EL: Record<string, FiveElement> = {
  "木": {
    label: "木",
    name: "목",
    color: "#4A7C59",
    tintBg: "rgba(74,124,89,0.12)",
    solidBorder: "rgba(74,124,89,0.35)",
  },
  "火": {
    label: "火",
    name: "화",
    color: "#B5874C",
    tintBg: "rgba(181,135,76,0.14)",
    solidBorder: "rgba(181,135,76,0.35)",
  },
  "土": {
    label: "土",
    name: "토",
    color: "#9A7E3A",
    tintBg: "rgba(201,169,110,0.20)",
    solidBorder: "rgba(201,169,110,0.40)",
  },
  "金": {
    label: "金",
    name: "금",
    color: "#2E7D7A",
    tintBg: "rgba(46,125,122,0.14)",
    solidBorder: "rgba(46,125,122,0.35)",
  },
  "水": {
    label: "水",
    name: "수",
    color: "#1E3A5F",
    tintBg: "rgba(30,58,95,0.10)",
    solidBorder: "rgba(30,58,95,0.30)",
  },
};

// ============================================================
// SectionHead — short 2px teal hairline + h2 + subtitle
// ============================================================
export function SectionHead({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          width: 28,
          height: 2,
          background: "var(--color-teal)",
          marginBottom: 14,
        }}
      />
      <h2
        style={{
          fontSize: 24,
          lineHeight: 1.3,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontSize: 13.5,
            color: "var(--color-text-2)",
            margin: "8px 0 0",
            lineHeight: 1.6,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ============================================================
// ScoreTile — 4-tier (high/mid/low/primary) + placeholder
// ============================================================
export type ScoreVariant = "high" | "mid" | "low" | "primary";

interface ScoreTileProps {
  value?: number | string;
  label: string;
  variant?: ScoreVariant;
  big?: boolean;
  placeholder?: boolean;
}

export function ScoreTile({
  value,
  label,
  variant = "mid",
  big = false,
  placeholder = false,
}: ScoreTileProps) {
  const tints: Record<ScoreVariant, { bg: string; color: string }> = {
    high: { bg: "rgba(74,124,89,0.10)", color: "var(--color-score-high)" },
    mid: { bg: "rgba(91,127,170,0.10)", color: "var(--color-score-mid)" },
    low: { bg: "rgba(181,135,76,0.10)", color: "var(--color-score-low)" },
    primary: { bg: "var(--color-navy)", color: "var(--color-background)" },
  };
  const t = tints[variant];

  if (placeholder) {
    return (
      <div
        style={{
          background: "rgba(43,43,43,0.04)",
          borderRadius: "var(--radius-md)",
          padding: "18px 16px",
          display: "flex",
          flexDirection: "column",
          minHeight: 104,
          border: "1px dashed var(--color-border)",
        }}
      >
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--color-text-3)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          —
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-3)",
            letterSpacing: "0.06em",
            marginTop: 8,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: "var(--color-text-3)",
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          생년월일 입력 시 계산
        </div>
      </div>
    );
  }

  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: variant === "primary" ? "rgba(250,247,242,0.85)" : t.color,
    letterSpacing: "0.1em",
    marginTop: 10,
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        background: t.bg,
        borderRadius: "var(--radius-md)",
        padding: big ? "20px 18px" : "18px 16px",
        display: "flex",
        flexDirection: "column",
        minHeight: big ? 120 : 104,
      }}
    >
      <div
        style={{
          fontFamily: "Inter",
          fontSize: big ? 44 : 32,
          fontWeight: 700,
          color: t.color,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ flex: 1 }} />
      <div style={labelStyle}>{label}</div>
    </div>
  );
}
