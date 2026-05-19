/**
 * EvalBody — Evaluate 결과 본문 (HanjaCandidatesTable + RecommendedCombo + StrengthsCautions + NoteBlocks)
 * Source: NameForm_design/src/EvalBody.jsx (Claude Design 산출물)
 */
"use client";

import { Sparkles, Info } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { ConfBadgeE, ElementChip } from "./EvalPrimitives";
import type { ConfidenceGrade } from "./EvalPrimitives";

// ============================================================
// HanjaCandidatesTable — 음절별 한자 후보 (2-col 카드)
// ============================================================
export interface HanjaGroup {
  syllable: string;
  candidates: {
    character: string;
    meaning: string;
    fiveElement?: string;
    strokeCount?: number;
    confidenceGrade?: ConfidenceGrade;
  }[];
}

export function HanjaCandidatesTable({ groups }: { groups: HanjaGroup[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 16,
      }}
    >
      {groups.map((g) => (
        <div
          key={g.syllable}
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 20px",
              background: "var(--color-surface-2)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text-2)",
              letterSpacing: "0.08em",
            }}
          >
            {g.syllable} 음절 · {g.candidates.length}개
          </div>
          <div>
            {g.candidates.map((c, i) => (
              <div
                key={c.character}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  columnGap: 14,
                  padding: "14px 20px",
                  borderTop:
                    i === 0 ? "none" : "1px solid var(--color-divider)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 28,
                    fontWeight: 500,
                    color: "var(--color-text)",
                    lineHeight: 1,
                    minWidth: 32,
                  }}
                >
                  {c.character}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13.5,
                      color: "var(--color-text)",
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {c.meaning}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <ElementChip el={c.fiveElement} />
                    {c.strokeCount != null && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--color-text-3)",
                          fontFamily: "Inter",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.strokeCount}획
                      </span>
                    )}
                  </div>
                </div>
                <ConfBadgeE grade={c.confidenceGrade} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// RecommendedCombo — 추천 조합 강조 카드
// ============================================================
export function RecommendedCombo({
  combo,
  elementLabel,
  desc,
}: {
  combo: string;
  elementLabel: string;
  desc: string;
}) {
  return (
    <div
      style={{
        background: "#F7EFDD",
        border: "1px solid rgba(181,135,76,0.35)",
        borderRadius: "var(--radius-md)",
        padding: "18px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#7A5B22",
            letterSpacing: "0.08em",
          }}
        >
          추천 조합
        </span>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            fontWeight: 500,
            color: "var(--color-text)",
            letterSpacing: 0,
            lineHeight: 1,
          }}
        >
          {combo}
        </span>
        <span
          style={{ fontSize: 12, color: "#7A5B22", whiteSpace: "nowrap" }}
        >
          {elementLabel}
        </span>
      </div>
      <span
        style={{
          fontSize: 12.5,
          color: "var(--color-text-2)",
          lineHeight: 1.5,
        }}
      >
        {desc}
      </span>
    </div>
  );
}

// ============================================================
// StrengthsCautions — 2-col 강점/참고
// ============================================================
function Block({
  Icon,
  title,
  items,
  tintBg,
  accent,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  items: string[];
  tintBg: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: tintBg,
        borderRadius: "var(--radius-lg)",
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
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
        <Icon width={14} height={14} strokeWidth={2} color={accent} />
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
              lineHeight: 1.65,
              color: "var(--color-text)",
              position: "relative",
              paddingLeft: 14,
              fontVariantNumeric: "tabular-nums",
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

export function StrengthsCautions({
  strengths,
  cautions,
}: {
  strengths: string[];
  cautions: string[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 16,
      }}
    >
      <Block
        Icon={Sparkles}
        title="이 이름의 강점"
        items={strengths}
        tintBg="rgba(74,124,89,0.08)"
        accent="var(--color-score-high)"
      />
      <Block
        Icon={Info}
        title="참고할 점"
        items={cautions}
        tintBg="rgba(201,169,110,0.12)"
        accent="#7A5B22"
      />
    </div>
  );
}

// ============================================================
// NoteBlocks — 발음/의미 메모 2-col
// ============================================================
export function NoteBlocks({
  pronunciation,
  meaning,
}: {
  pronunciation: string;
  meaning: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 16,
        marginTop: 16,
      }}
    >
      {(
        [
          ["발음 메모", pronunciation],
          ["의미 메모", meaning],
        ] as const
      ).map(([title, body]) => (
        <div
          key={title}
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "22px 24px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text-2)",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            {title}
          </div>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.7,
              color: "var(--color-text)",
              margin: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {body}
          </p>
        </div>
      ))}
    </div>
  );
}

