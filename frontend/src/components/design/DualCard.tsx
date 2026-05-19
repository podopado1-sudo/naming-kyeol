/**
 * DualCard — Dual Result candidate card (한국어 + 한자 + 영어 3분할)
 * Source: NameForm_design/src/DualCard.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState → 명시적 import
 *   - "김" 하드코딩 → lastName props
 *   - window 글로벌 → ES Module export
 */
"use client";

import Link from "next/link";
import { useState } from "react";

export type DualMode = "phonetic" | "semantic" | "free";

export interface DualCandidate {
  rank: number;
  englishName: string;
  koreanFull: string;
  koreanSyllables: string[];
  englishSyllables: string[];
  hanja: { char: string; meaning: string }[];
  scores: { aesthetic: number; harmony: number; final: number; rarity: number };
  mappingNote: string;
  reasons: string[];
  note?: string;
}

function SyllableRow({
  syllables,
  highlight,
  fontFamily,
  fontSize,
  fontWeight,
}: {
  syllables: string[];
  highlight: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 4,
        fontFamily,
        fontSize,
        fontWeight,
        letterSpacing: "-0.005em",
      }}
    >
      {syllables.map((s, i) => (
        <span
          key={i}
          style={{
            background: highlight ? "var(--color-teal-50)" : "transparent",
            color: highlight ? "var(--color-teal)" : "var(--color-text-2)",
            padding: highlight ? "2px 7px" : "2px 2px",
            borderRadius: highlight ? "var(--radius-sm)" : 0,
            whiteSpace: "nowrap",
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

export function DualCard({
  cand,
  selected,
  onSelect,
  mode,
  lastName,
  detailHref = "/analysis",
}: {
  cand: DualCandidate;
  selected: boolean;
  onSelect: (rank: number) => void;
  mode: DualMode;
  lastName: string;
  detailHref?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const scoreColor = (s: number) =>
    s >= 85
      ? "var(--color-teal)"
      : s >= 70
        ? "var(--color-navy)"
        : s >= 55
          ? "var(--color-gold-600)"
          : "var(--color-text-2)";

  const highlightSyllables = mode === "phonetic";

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-xl)",
        border: selected
          ? "2px solid var(--color-teal)"
          : "1px solid var(--color-border)",
        boxShadow: selected ? "var(--shadow-md)" : "var(--shadow-sm)",
        padding: "22px 24px",
        position: "relative",
        transition: "all 200ms cubic-bezier(.2,.6,.2,1)",
        cursor: "pointer",
      }}
      onClick={() => onSelect(cand.rank)}
    >
      {selected && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--color-teal)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 40fr) 48px minmax(0, 32fr) minmax(0, 24fr)",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        {/* Left: Korean */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-2)",
              background: "var(--color-surface-2)",
              padding: "3px 10px",
              borderRadius: 999,
              fontFamily: "Inter",
              letterSpacing: "0.04em",
              marginBottom: 12,
            }}
          >
            #{cand.rank}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 4,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "var(--color-text-2)",
                fontFamily: "Pretendard Variable, Pretendard, sans-serif",
              }}
            >
              {lastName}
            </span>
            <SyllableRow
              syllables={cand.koreanSyllables}
              highlight={highlightSyllables}
              fontFamily="Pretendard Variable, Pretendard, sans-serif"
              fontSize={32}
              fontWeight={500}
            />
          </div>

          <div
            style={{
              background: "var(--color-surface-2)",
              borderRadius: "var(--radius-md)",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {cand.hanja.map((h, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 22,
                    fontWeight: 500,
                    color: "var(--color-text)",
                    width: 26,
                    flexShrink: 0,
                  }}
                >
                  {h.char}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-2)",
                    lineHeight: 1.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.meaning}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: connector */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "stretch",
            minHeight: 120,
          }}
        >
          <div
            style={{
              width: 1,
              flex: 1,
              backgroundImage:
                "linear-gradient(to bottom, var(--color-teal-100) 50%, transparent 50%)",
              backgroundSize: "1px 6px",
              backgroundRepeat: "repeat-y",
            }}
          />
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--color-teal-50)",
              color: "var(--color-teal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "4px 0",
              flexShrink: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M2 5h10M9 2L12 5L9 8M12 9H2M5 6L2 9L5 12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              width: 1,
              flex: 1,
              backgroundImage:
                "linear-gradient(to bottom, var(--color-teal-100) 50%, transparent 50%)",
              backgroundSize: "1px 6px",
              backgroundRepeat: "repeat-y",
            }}
          />
        </div>

        {/* Right: English */}
        <div style={{ minWidth: 0, paddingTop: 24 }}>
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 28,
              fontWeight: 500,
              color: "var(--color-text)",
              letterSpacing: "-0.01em",
              marginBottom: 8,
            }}
          >
            {cand.englishName}
          </div>
          <div style={{ marginBottom: 10 }}>
            <SyllableRow
              syllables={cand.englishSyllables}
              highlight={highlightSyllables}
              fontFamily="Inter"
              fontSize={14}
              fontWeight={500}
            />
          </div>
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.55,
              color: "var(--color-text-2)",
              fontFamily: "Inter, Pretendard Variable",
            }}
          >
            {cand.mappingNote}
          </div>
        </div>

        {/* Rightmost: score/action */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            paddingTop: 24,
          }}
        >
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 28,
              fontWeight: 700,
              color: scoreColor(cand.scores.final),
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
              marginBottom: 6,
            }}
          >
            {cand.scores.final}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-3)",
              fontVariantNumeric: "tabular-nums",
              fontFamily: "Inter",
              marginBottom: 10,
              whiteSpace: "nowrap",
            }}
          >
            미학 {cand.scores.aesthetic} · 조화 {cand.scores.harmony}
          </div>

          <div style={{ width: 80, marginBottom: 14 }}>
            <div
              style={{
                fontSize: 10,
                color: "var(--color-text-3)",
                marginBottom: 4,
                letterSpacing: "0.04em",
                textAlign: "right",
              }}
            >
              RARITY
            </div>
            <div
              style={{
                height: 3,
                background: "var(--color-surface-2)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${cand.scores.rarity}%`,
                  height: "100%",
                  background: "var(--color-gold-600)",
                  borderRadius: 999,
                }}
              />
            </div>
          </div>

          <Link
            href={detailHref}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-teal)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            상세 →
          </Link>
        </div>
      </div>

      {cand.note && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "var(--color-gold-50)",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            color: "var(--color-text-2)",
            lineHeight: 1.55,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <span style={{ color: "var(--color-gold-600)" }}>⚠</span>
          <span>{cand.note}</span>
        </div>
      )}

      {cand.reasons.length > 0 && (
        <div
          style={{
            marginTop: 14,
            borderTop: "1px solid var(--color-divider)",
            paddingTop: 12,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-text-2)",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 180ms",
                display: "inline-block",
                fontSize: 10,
              }}
            >
              ▸
            </span>
            이 이름을 고른 이유
          </button>
          {expanded && (
            <ul
              style={{
                margin: "10px 0 0 16px",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {cand.reasons.map((r, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--color-text-2)",
                  }}
                >
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default DualCard;
