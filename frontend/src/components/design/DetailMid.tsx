/**
 * DetailMid — KyeolBlocks (강점/약점/추천이유) + EumryeongTimeline (음령오행)
 * Source: NameForm_design/src/DetailMid.jsx (Claude Design 산출물)
 */
"use client";

import { Fragment, type ReactNode } from "react";
import { FIVE_EL } from "./DetailPrimitives";
import { threeColTemplate, visibleItems } from "./eval-layout";

// ============================================================
// KyeolBlocks — 강점 / 약점 / 추천 이유 (내용 있는 상자만, 최대 3-column)
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

// 빈 목록 상자는 그리지 않고, 남은 상자 수만큼 열(eval-layout.ts — /evaluate StrengthsCautions BR-1 과 같은 '보이는 줄' 기준).
// 2026-10-27: 생년월일 없는 분석은 약점이 대부분 빈 배열이라 '⚠ 약점' 상자가 제목만 단 채 가운데 칸에 그려졌다.
// '약점이 없다'는 빈 상태 문구는 두지 않는다(정해진 검사에 걸리지 않았을 뿐이다). 셋 다 비면 아무것도 그리지 않는다.
// 상자 속성은 JSX 그대로 둔다 — tests/palette-contrast.test.mjs 가 tintBg="…"·accent="…" 로 제목 색 대비를 읽는다
export function KyeolBlocks({
  strengths,
  weaknesses,
  reasons,
}: {
  strengths: string[];
  weaknesses: string[];
  reasons: string[];
}) {
  const strong = visibleItems(strengths);
  const weak = visibleItems(weaknesses);
  const why = visibleItems(reasons);
  const count = [strong, weak, why].filter((items) => items.length > 0).length;
  if (count === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: threeColTemplate(count),
        gap: 14,
      }}
    >
      {strong.length > 0 && (
        <Block
          emoji="💎"
          title="강점"
          items={strong}
          tintBg="rgba(74,124,89,0.08)"
          // 13px 제목·점 — 옛 score-high 4.42 · 약점 #9A7E3A 3.57:1(틴트 위) → 짙은 글자 토큰(2026-10-26 팔레트 #2 보완,
          // 약점은 /evaluate EvalBody '참고할 점'과 같은 amber-warm-700)
          accent="var(--color-score-high-700)"
        />
      )}
      {weak.length > 0 && (
        <Block
          emoji="⚠"
          title="약점"
          items={weak}
          tintBg="rgba(201,169,110,0.12)"
          accent="var(--color-amber-warm-700)"
        />
      )}
      {why.length > 0 && (
        <Block
          emoji="📝"
          title="추천 이유"
          items={why}
          tintBg="var(--color-navy-50)"
          accent="var(--color-navy)"
        />
      )}
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
                        color: el.text,
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
              color: FIVE_EL[dominantElement].text,
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
