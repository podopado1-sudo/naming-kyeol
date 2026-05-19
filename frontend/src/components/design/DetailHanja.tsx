/**
 * DetailHanja — HanjaBreakdown (음절별 한자 카드) + ConfidenceBadge (4축)
 * Source: NameForm_design/src/DetailHanja.jsx (Claude Design 산출물)
 *
 * Props는 PascalCase 그대로 (디자인 의도 보존).
 * 페이지에서 매핑 어댑터로 변환.
 */
"use client";

import { useState } from "react";
import { FIVE_EL } from "./DetailPrimitives";

// ============================================================
// ConfidenceBadge — 4축 디자인 (S/A/B/D)
// ============================================================
export type ConfidenceGrade = "S" | "A" | "B" | "D";

export function ConfidenceBadge({ grade }: { grade?: ConfidenceGrade }) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: 24,
    padding: "0 10px",
    borderRadius: 6,
    fontFamily: 'Inter, "Pretendard Variable", sans-serif',
    fontSize: 12,
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.005em",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
    lineHeight: 1,
  };

  const map: Record<
    ConfidenceGrade,
    {
      label: string;
      style: React.CSSProperties;
      icon: boolean;
      tip?: string;
    }
  > = {
    S: {
      label: "S 고신뢰",
      style: {
        background: "#1F5A58",
        color: "#FFFFFF",
        border: "1.5px solid #1F5A58",
      },
      icon: true,
    },
    A: {
      label: "A 규칙기반",
      style: {
        background: "var(--color-teal-50)",
        color: "#1F5A58",
        border: "1.5px solid var(--color-teal-500)",
      },
      icon: false,
    },
    B: {
      label: "B 수동입력",
      style: {
        background: "#F7EFDD",
        color: "#7A5B22",
        border: "1.5px solid var(--color-gold-600)",
      },
      icon: false,
    },
    D: {
      label: "D 획수자동",
      style: {
        background: "transparent",
        color: "#6B6B6B",
        border: "1.5px dashed #B7B1A7",
      },
      icon: false,
      tip: "획수 기반 자동 추정 — 참고용",
    },
  };

  const m = map[grade ?? "D"];
  const [hover, setHover] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        style={{ ...base, ...m.style, cursor: m.tip ? "help" : "default" }}
      >
        {m.icon && (
          <svg
            viewBox="0 0 10 10"
            width="10"
            height="10"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
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
        {m.label}
      </span>
      {m.tip && hover && (
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
            pointerEvents: "none",
          }}
        >
          {m.tip}
        </span>
      )}
    </span>
  );
}

// ============================================================
// HanjaBreakdown 타입 + 카드
// ============================================================
export interface HanjaOption {
  character: string;
  meaning: string;
  fiveElement?: string;
  strokeCount?: number;
  kangxiStrokes?: number;
  confidenceGrade?: ConfidenceGrade;
  rationale?: string;
}

export interface HanjaSyllableEntry {
  syllable: string;
  possibleHanja: HanjaOption[];
}

function HanjaCard({ entry }: { entry: HanjaSyllableEntry }) {
  const [expanded, setExpanded] = useState(false);
  const primary = entry.possibleHanja[0];
  const others = entry.possibleHanja.slice(1);
  if (!primary) return null;
  const el = primary.fiveElement ? FIVE_EL[primary.fiveElement] : undefined;

  return (
    <article
      style={{
        position: "relative",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: "22px 24px",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        className="paper-grain"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          columnGap: 22,
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center", minWidth: 88 }}>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 56,
              fontWeight: 700,
              color: "var(--color-text)",
              lineHeight: 1,
              letterSpacing: 0,
            }}
          >
            {primary.character}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "var(--color-text-2)",
              marginTop: 10,
              letterSpacing: "-0.01em",
            }}
          >
            {entry.syllable}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-text)",
              letterSpacing: "-0.005em",
            }}
          >
            {primary.meaning}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 12,
              alignItems: "center",
            }}
          >
            {el && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-sm)",
                  background: el.tintBg,
                  color: el.color,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 13,
                    marginRight: 1,
                  }}
                >
                  {el.label}
                </span>
                <span style={{ margin: "0 2px" }}>·</span>
                <span style={{ letterSpacing: "-0.01em" }}>{el.name}</span>
              </span>
            )}
            {primary.strokeCount != null && (
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--color-text-2)",
                  padding: "3px 9px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  whiteSpace: "nowrap",
                  fontFamily: "Inter",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {primary.strokeCount}획
                {primary.kangxiStrokes &&
                primary.kangxiStrokes !== primary.strokeCount
                  ? ` · 강희 ${primary.kangxiStrokes}`
                  : ""}
              </span>
            )}
            <ConfidenceBadge grade={primary.confidenceGrade} />
          </div>
          {primary.rationale && (
            <div
              style={{
                fontSize: 12.5,
                color: "var(--color-text-3)",
                marginTop: 10,
                lineHeight: 1.5,
              }}
            >
              {primary.rationale}
            </div>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <div
          style={{
            position: "relative",
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--color-divider)",
          }}
        >
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontSize: 13,
              color: "var(--color-teal)",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            다른 한자 후보 {others.length}개 {expanded ? "접기 ↑" : "보기 →"}
          </button>
          {expanded && (
            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {others.map((o) => {
                const oel = o.fiveElement ? FIVE_EL[o.fiveElement] : undefined;
                return (
                  <div
                    key={o.character}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      alignItems: "center",
                      columnGap: 14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: 28,
                        color: "var(--color-navy)",
                        fontWeight: 500,
                        letterSpacing: 0,
                      }}
                    >
                      {o.character}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13.5,
                          color: "var(--color-text)",
                        }}
                      >
                        {o.meaning}
                      </div>
                      {o.strokeCount != null && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--color-text-3)",
                            marginTop: 2,
                            fontVariantNumeric: "tabular-nums",
                            fontFamily: "Inter",
                          }}
                        >
                          {o.strokeCount}획
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      {oel && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: 6,
                            background: oel.tintBg,
                            color: oel.color,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-serif)",
                              fontSize: 12,
                            }}
                          >
                            {oel.label}
                          </span>
                          ·{oel.name}
                        </span>
                      )}
                      <ConfidenceBadge grade={o.confidenceGrade} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function HanjaBreakdown({
  breakdown,
}: {
  breakdown: HanjaSyllableEntry[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {breakdown
        .filter((b) => b.possibleHanja.length > 0)
        .map((b) => (
          <HanjaCard key={b.syllable} entry={b} />
        ))}
    </div>
  );
}
