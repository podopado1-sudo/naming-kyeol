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
  /** 오행 표지색 — 막대·왼쪽 테두리 같은 비텍스트에 쓴다 */
  color: string;
  /**
   * 글자색 — 칩(10.5~12px)·오행 분포 글자·용신 글자. 옛 color 를 글자에 그대로 쓰면 틴트 칩 위에서 木 4.17 · 火 2.79 ·
   * 土 3.35 · 金 4.05:1 로 WCAG AA(4.5:1) 미달이라 짙은 글자 전용 토큰으로 갈랐다(2026-10-26 팔레트 #2 — tests/palette-contrast.test.mjs).
   * 火·土 는 /hanja 오행 배지와 같은 토큰(amber-warm-600·gold-800). 水 는 원래 짙어(9.64:1) 그대로
   */
  text: string;
  tintBg: string;
  solidBorder: string;
}

export const FIVE_EL: Record<string, FiveElement> = {
  "木": {
    label: "木",
    name: "목",
    color: "#4A7C59",
    text: "var(--color-score-high-700)",
    tintBg: "rgba(74,124,89,0.12)",
    solidBorder: "rgba(74,124,89,0.35)",
  },
  "火": {
    label: "火",
    name: "화",
    color: "#B5874C",
    text: "var(--color-amber-warm-600)",
    tintBg: "rgba(181,135,76,0.14)",
    solidBorder: "rgba(181,135,76,0.35)",
  },
  "土": {
    label: "土",
    name: "토",
    color: "#9A7E3A",
    text: "var(--color-gold-800)",
    tintBg: "rgba(201,169,110,0.20)",
    solidBorder: "rgba(201,169,110,0.40)",
  },
  "金": {
    label: "金",
    name: "금",
    color: "#2E7D7A",
    text: "var(--color-teal-800)",
    tintBg: "rgba(46,125,122,0.14)",
    solidBorder: "rgba(46,125,122,0.35)",
  },
  "水": {
    label: "水",
    name: "수",
    color: "#1E3A5F",
    text: "#1E3A5F",
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
  // color = 32~44px 점수 숫자(큰 글씨 3:1), label = 11px 라벨 글자(4.5:1) — 옛 라벨은 숫자 색 그대로라 틴트(종이 위) 위
  // 미학 score-high 4.10 · 조화·유니크 score-mid 3.56:1 이었다(2026-10-26 팔레트 #2 보완 — 같은 색상의 짙은 글자 토큰).
  // mid 라벨 score-mid-700 은 흰 위 틴트 4.65 · 종이 위 틴트 4.47:1 로 종이 쪽이 아직 조금 모자란다(CLAUDE.md '대비 미달로 남은 색').
  // low 는 쓰는 곳이 없지만 amber-warm 글자 규칙(tests/amber-contrast.test.mjs)에 맞춰 둔다
  const tints: Record<ScoreVariant, { bg: string; color: string; label: string }> = {
    high: { bg: "rgba(74,124,89,0.10)", color: "var(--color-score-high)", label: "var(--color-score-high-700)" },
    mid: { bg: "rgba(91,127,170,0.10)", color: "var(--color-score-mid)", label: "var(--color-score-mid-700)" },
    low: { bg: "rgba(181,135,76,0.10)", color: "var(--color-amber-warm-700)", label: "var(--color-amber-warm-700)" },
    primary: { bg: "var(--color-navy)", color: "var(--color-background)", label: "rgba(250,247,242,0.85)" },
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
    color: t.label,
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
