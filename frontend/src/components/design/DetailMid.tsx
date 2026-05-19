/**
 * DetailMid — KyeolBlocks (강점/약점/추천이유) + EumryeongTimeline (음령오행)
 * Source: NameForm_design/src/DetailMid.jsx (Claude Design 산출물)
 */
"use client";

import { Fragment, type ReactNode } from "react";
import { FIVE_EL } from "./DetailPrimitives";

// ============================================================
// KyeolBlocks — 강점 / 약점 / 추천 이유 3-column
// ============================================================
function Block({
  emoji,
  title,
  items,
  tintBg,
  accent,
}: {
  emoji: string;
  title: string;
  items: string[];
  tintBg: string;
  accent: string;
}): ReactNode {
  return (
    <div
      style={{
        background: tintBg,
        borderRadius: "var(--radius-lg)",
        padding: "22px 22px 24px",
        display: "flex",
        flexDirection: "column",
        minHeight: 220,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: accent,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {items.map((it, i) => (
          <li
            key={i}
            style={{
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "var(--color-text)",
              position: "relative",
              paddingLeft: 14,
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 9,
                width: 4,
                height: 4,
                borderRadius: 999,
                background: accent,
              }}
            />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KyeolBlocks({
  strengths,
  weaknesses,
  reasons,
}: {
  strengths: string[];
  weaknesses: string[];
  reasons: string[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
      }}
    >
      <Block
        emoji="💎"
        title="강점"
        items={strengths}
        tintBg="rgba(74,124,89,0.08)"
        accent="var(--color-score-high)"
      />
      <Block
        emoji="⚠"
        title="약점"
        items={weaknesses}
        tintBg="rgba(201,169,110,0.12)"
        accent="#9A7E3A"
      />
      <Block
        emoji="📝"
        title="추천 이유"
        items={reasons}
        tintBg="var(--color-navy-50)"
        accent="var(--color-navy)"
      />
    </div>
  );
}

// ============================================================
// EumryeongTimeline — 음령오행 (음절별 초성 오행)
// ============================================================
export interface EumryeongData {
  syllables: { syllable: string; initial: string; fiveElement?: string }[];
  dominantElement?: string;
  elementCount: Record<string, number>;
}

export function EumryeongTimeline({ analysis }: { analysis: EumryeongData | null }) {
  if (!analysis) return null;
  const { syllables, dominantElement, elementCount } = analysis;

  return (
    <div>
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          padding: "28px 24px 22px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {syllables.map((s, i) => {
            const el = s.fiveElement ? FIVE_EL[s.fiveElement] : undefined;
            return (
              <Fragment key={i}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 96,
                  }}
                >
                  <div
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 999,
                      background: el?.tintBg || "rgba(43,43,43,0.05)",
                      border: `1px solid ${el?.solidBorder || "var(--color-border)"}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: "var(--color-text)",
                        lineHeight: 1,
                      }}
                    >
                      {s.syllable}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-2)",
                        marginTop: 4,
                        fontFamily: "Inter",
                      }}
                    >
                      {s.initial}
                    </div>
                  </div>
                  {el && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "3px 8px",
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
                        }}
                      >
                        {el.label}
                      </span>
                      <span>{el.name}</span>
                    </div>
                  )}
                </div>
                {i < syllables.length - 1 && (
                  <div
                    aria-hidden
                    style={{
                      color: "var(--color-text-3)",
                      fontSize: 18,
                      padding: "0 4px",
                    }}
                  >
                    →
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
      {dominantElement && FIVE_EL[dominantElement] && (
        <div
          style={{
            marginTop: 14,
            fontSize: 13.5,
            color: "var(--color-text-2)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span>대표 오행:</span>
          <span
            style={{
              fontWeight: 600,
              color: FIVE_EL[dominantElement].color,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontFamily: "var(--font-serif)" }}>
              {dominantElement}
            </span>{" "}
            ({elementCount[dominantElement]}/{syllables.length})
          </span>
        </div>
      )}
    </div>
  );
}
