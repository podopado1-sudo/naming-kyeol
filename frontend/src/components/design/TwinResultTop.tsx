/**
 * TwinResultTop — Twin Result primitives
 * Source: NameForm_design/src/TwinResultTop.jsx (Claude Design 산출물)
 *
 * Exports: TwinSubHeader, ThemeTabs, ThemeBanner, CoherenceHero
 */
"use client";

import { Button } from "./Primitives";

// ============================================================
// 공유 타입 (Twin 페이지 전체에서 사용)
// ============================================================
export type TwinThemeKey = "shared_char" | "shared_meaning" | "shared_tone";
export type TwinSharedType = "char" | "meaning" | "tone";

export interface TwinContext {
  lastName: string;
  count: number;
  relation: "same" | "mixed" | "any";
  tone: "soft" | "neutral" | "strong";
}

export interface TwinThemeBlock {
  key: TwinThemeKey;
  label: string;
  description: string;
  coherence: number;
  coherenceNote: string;
  shared: { type: TwinSharedType; value: string };
  pair: TwinPairEntry[];
}

export interface TwinPairEntry {
  position: string;
  first: string;
  sharedIndex?: number[];
  sharedMeaning?: string;
  scores: { aesthetic: number; harmony: number; final: number };
  reasons: string[];
}

// ============================================================
// TwinSubHeader — 입력 요약 chip + 액션
// ============================================================
export function TwinSubHeader({
  ctx,
  onRegenerate,
  onSave,
}: {
  ctx: TwinContext;
  onRegenerate?: () => void;
  onSave?: () => void;
}) {
  const chips = [
    `성 ${ctx.lastName}`,
    `자녀 ${ctx.count}명`,
    ctx.relation === "same"
      ? "같은 성별"
      : ctx.relation === "mixed"
        ? "남녀 혼성"
        : "미지정",
    ctx.tone === "soft"
      ? "소프트 톤"
      : ctx.tone === "strong"
        ? "강한 톤"
        : "중립 톤",
  ];

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        padding: "12px 0",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          {chips.map((c, i) => (
            <span
              key={i}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text-2)",
                background: "var(--color-surface-2)",
                padding: "5px 12px",
                borderRadius: 999,
                whiteSpace: "nowrap",
              }}
            >
              {c}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Button variant="ghost" size="sm" onClick={onRegenerate}>
            ↻ 새로 생성
          </Button>
          <Button variant="secondary" size="sm" onClick={onSave}>
            ♡ 이 결과 저장
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ThemeTabs — 공유글자/공유의미/공유톤 segmented control
// ============================================================
export function ThemeTabs({
  themes,
  current,
  onChange,
}: {
  themes: { key: string; label: string }[];
  current: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 4,
        background: "var(--color-surface-2)",
        borderRadius: 999,
      }}
    >
      {themes.map((t) => {
        const active = t.key === current;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              padding: "9px 20px",
              borderRadius: 999,
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: active
                ? "var(--color-surface)"
                : "transparent",
              color: active
                ? "var(--color-navy)"
                : "var(--color-text-2)",
              boxShadow: active ? "var(--shadow-sm)" : "none",
              transition: "all 200ms cubic-bezier(.2,.6,.2,1)",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// ThemeBanner — 테마별 설명 + 아이콘
// ============================================================
export function ThemeBanner({ theme }: { theme: TwinThemeBlock }) {
  const icons: Record<TwinThemeKey, React.ReactNode> = {
    shared_char: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="7" cy="10" r="4" />
        <circle cx="13" cy="10" r="4" />
      </svg>
    ),
    shared_meaning: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4 10h12" />
        <path d="M10 4v12" />
        <circle cx="10" cy="10" r="7" />
      </svg>
    ),
    shared_tone: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 10c2-4 4-4 6 0s4 4 6 0 2-4 2-4" />
      </svg>
    ),
  };

  return (
    <div
      style={{
        background: "#F4EFE7",
        borderRadius: "var(--radius-lg)",
        padding: "16px 22px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "var(--color-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-navy)",
          flexShrink: 0,
        }}
      >
        {icons[theme.key]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text)",
            marginBottom: 3,
            letterSpacing: "-0.005em",
          }}
        >
          {theme.label}
          {theme.shared.value && ` · ${theme.shared.value}`}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--color-text-2)",
          }}
        >
          {theme.description}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CoherenceHero — 세트 조화도 progress ring
// ============================================================
export function CoherenceHero({
  score,
  note,
}: {
  score: number;
  note: string;
}) {
  const color =
    score >= 85
      ? "var(--color-teal)"
      : score >= 70
        ? "var(--color-navy)"
        : score >= 55
          ? "var(--color-gold-600)"
          : "var(--color-text-2)";
  const tint =
    score >= 85
      ? "var(--color-teal-50)"
      : score >= 70
        ? "var(--color-navy-50)"
        : score >= 55
          ? "var(--color-gold-50)"
          : "var(--color-surface-2)";
  const pct = Math.max(0, Math.min(100, score));
  const r = 44;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        padding: "26px 28px",
        display: "flex",
        alignItems: "center",
        gap: 28,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 104,
          height: 104,
          flexShrink: 0,
        }}
      >
        <svg width="104" height="104" viewBox="0 0 104 104">
          <circle
            cx="52"
            cy="52"
            r={r}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="6"
          />
          <circle
            cx="52"
            cy="52"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            transform="rotate(-90 52 52)"
            style={{
              transition: "stroke-dasharray 420ms cubic-bezier(.2,.6,.2,1)",
            }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 30,
              fontWeight: 700,
              color,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {score}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--color-text-3)",
              marginTop: 2,
              fontFamily: "Inter",
              letterSpacing: "0.08em",
            }}
          >
            /100
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 500,
            color,
            background: tint,
            padding: "3px 10px",
            borderRadius: 999,
            marginBottom: 8,
            letterSpacing: "0.02em",
          }}
        >
          SET COHERENCE
        </div>
        <h3
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: 0,
            marginBottom: 6,
            letterSpacing: "-0.01em",
          }}
        >
          세트 조화도
        </h3>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--color-text-2)",
            margin: 0,
          }}
        >
          {note}
        </p>
      </div>
    </div>
  );
}
