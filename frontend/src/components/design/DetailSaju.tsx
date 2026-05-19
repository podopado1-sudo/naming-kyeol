/**
 * DetailSaju — SajuSection (사주 4기둥 + 오행 분포 + 용신) + VariantStrip
 * Source: NameForm_design/src/DetailSaju.jsx (Claude Design 산출물)
 *
 * Props는 camelCase로 정의 (백엔드 SajuChartData / YongshinData / NameVariantDto와 일치)
 */
"use client";

import { Button } from "./Primitives";
import { FIVE_EL } from "./DetailPrimitives";

// ============================================================
// SajuSection — 사주 원국 + 오행 분포 + 용신 카드
// ============================================================
export interface SajuPillarData {
  stemChar: string;
  stemName: string;
  branchChar: string;
  branchName: string;
  fiveElement: string;
  yinYang: string;
}

export interface YongshinData {
  strength: string;
  primaryYongshin: string;
  strengthDescription: string;
  yongshinReason: string;
  nameFitsYongshin?: boolean;
}

export interface SajuChartData {
  yearPillar: SajuPillarData;
  monthPillar: SajuPillarData;
  dayPillar: SajuPillarData;
  hourPillar?: SajuPillarData;
  fiveElementCount: Record<string, number>;
  missingElements: string[];
  dayMaster: string;
  birthplaceName?: string;
  correctionMinutes?: number;
  yongshin?: YongshinData;
}

export function SajuSection({
  saju,
  onOpenBirthInput,
}: {
  saju: SajuChartData | null;
  onOpenBirthInput?: () => void;
}) {
  if (!saju) {
    return (
      <div
        style={{
          background: "var(--color-surface-2)",
          borderRadius: "var(--radius-lg)",
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: "var(--color-text-2)",
            lineHeight: 1.6,
          }}
        >
          생년월일 입력 시 사주 원국 분석이 추가됩니다.
        </div>
        <Button variant="secondary" size="sm" onClick={onOpenBirthInput}>
          생년월일 입력하기
        </Button>
      </div>
    );
  }

  const pillars: [string, SajuPillarData | undefined][] = [
    ["년주", saju.yearPillar],
    ["월주", saju.monthPillar],
    ["일주", saju.dayPillar],
    ["시주", saju.hourPillar],
  ];

  const elementsOrder = ["木", "火", "土", "金", "水"];
  const maxCount = Math.max(
    1,
    ...elementsOrder.map((k) => saju.fiveElementCount[k] || 0)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Pillars */}
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
          }}
        >
          {pillars.map(([label, p], i) => {
            if (!p) {
              return (
                <div
                  key={i}
                  style={{
                    padding: "20px 16px",
                    textAlign: "center",
                    borderRight:
                      i < 3 ? "1px solid var(--color-divider)" : "none",
                    opacity: 0.4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-3)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      color: "var(--color-text-3)",
                      marginTop: 10,
                    }}
                  >
                    —
                  </div>
                </div>
              );
            }
            const stemEl = FIVE_EL[p.fiveElement];
            return (
              <div
                key={i}
                style={{
                  padding: "20px 12px",
                  textAlign: "center",
                  borderRight:
                    i < 3 ? "1px solid var(--color-divider)" : "none",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-2)",
                    letterSpacing: "0.08em",
                    fontWeight: 500,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 32,
                    fontWeight: 600,
                    color: "var(--color-text)",
                    marginTop: 12,
                    lineHeight: 1,
                  }}
                >
                  {p.stemChar}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 28,
                    fontWeight: 500,
                    color: "var(--color-navy)",
                    marginTop: 4,
                    lineHeight: 1,
                  }}
                >
                  {p.branchChar}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-3)",
                    marginTop: 10,
                  }}
                >
                  {p.stemName}·{p.branchName}
                </div>
                {stemEl && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 10.5,
                      fontWeight: 600,
                      display: "inline-block",
                      padding: "2px 7px",
                      borderRadius: 999,
                      background: stemEl.tintBg,
                      color: stemEl.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-serif)" }}>
                      {p.fiveElement}
                    </span>{" "}
                    · {p.yinYang}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {(saju.birthplaceName || saju.correctionMinutes != null) && (
          <div
            style={{
              padding: "10px 16px",
              fontSize: 11,
              color: "var(--color-text-3)",
              background: "var(--color-surface-2)",
              textAlign: "right",
            }}
          >
            출생지 {saju.birthplaceName} · 진태양시 보정{" "}
            {(saju.correctionMinutes ?? 0) > 0 ? "+" : ""}
            {saju.correctionMinutes ?? 0}분
          </div>
        )}
      </div>

      {/* Element distribution */}
      <div
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
            marginBottom: 16,
          }}
        >
          오행 분포
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {elementsOrder.map((k) => {
            const count = saju.fiveElementCount[k] || 0;
            const el = FIVE_EL[k];
            const pct = (count / maxCount) * 100;
            return (
              <div
                key={k}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr 24px",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 14,
                      fontWeight: 600,
                      color: el.color,
                    }}
                  >
                    {k}
                  </span>
                  <span style={{ color: "var(--color-text-3)" }}>
                    {el.name}
                  </span>
                </div>
                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    background: "rgba(43,43,43,0.05)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(pct, count ? 4 : 0)}%`,
                      height: "100%",
                      background: el.color,
                      opacity: 0.7,
                      borderRadius: 999,
                      transition: "width 420ms cubic-bezier(.2,.6,.2,1)",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-2)",
                    fontFamily: "Inter",
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                  }}
                >
                  {count}
                </div>
              </div>
            );
          })}
        </div>
        {saju.missingElements.length > 0 && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: "1px solid var(--color-divider)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--color-text-2)" }}>
              부족 오행
            </span>
            {saju.missingElements.map((m) => {
              const el = FIVE_EL[m];
              return (
                <span
                  key={m}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(181,135,76,0.14)",
                    color: "#9A7E3A",
                    border: "1px solid rgba(181,135,76,0.3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-serif)" }}>
                    {m}
                  </span>{" "}
                  {el?.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Yongshin card */}
      {saju.yongshin && (
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "24px 26px",
            borderLeft: `3px solid ${
              FIVE_EL[saju.yongshin.primaryYongshin]?.color ||
              "var(--color-teal)"
            }`,
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
            용신 분석
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-text)",
              lineHeight: 1.5,
              letterSpacing: "-0.005em",
            }}
          >
            일간{" "}
            <span style={{ fontFamily: "var(--font-serif)" }}>
              {saju.dayMaster}
            </span>{" "}
            {saju.yongshin.strength} →{" "}
            {saju.yongshin.strength === "신강" ? "억부" : "조후"} 용신{" "}
            <span
              style={{
                fontFamily: "var(--font-serif)",
                color: FIVE_EL[saju.yongshin.primaryYongshin]?.color,
              }}
            >
              {saju.yongshin.primaryYongshin}
            </span>
          </div>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: "10px 0 0",
            }}
          >
            {saju.yongshin.strengthDescription} {saju.yongshin.yongshinReason}
          </p>
          {saju.yongshin.nameFitsYongshin && (
            <div
              style={{
                marginTop: 14,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-score-high)",
                padding: "6px 12px",
                background: "rgba(74,124,89,0.1)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <span>✓</span> 이 이름은 용신에 부합합니다
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// VariantStrip — 뒤집기/변형 이름 가로 스크롤
// ============================================================
export interface NameVariant {
  name: string;
  variationType: string;
  description: string;
}

export function VariantStrip({ variants }: { variants: NameVariant[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        paddingBottom: 6,
        marginLeft: -4,
        marginRight: -4,
        paddingLeft: 4,
        paddingRight: 4,
      }}
    >
      {variants.map((v, i) => (
        <div
          key={i}
          style={{
            minWidth: 240,
            flexShrink: 0,
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--color-text)",
                letterSpacing: "-0.01em",
              }}
            >
              {v.name}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-teal-50)",
                color: "var(--color-teal)",
                whiteSpace: "nowrap",
              }}
            >
              {v.variationType}
            </span>
          </div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--color-text-2)",
              margin: "10px 0 0",
            }}
          >
            {v.description}
          </p>
        </div>
      ))}
    </div>
  );
}
