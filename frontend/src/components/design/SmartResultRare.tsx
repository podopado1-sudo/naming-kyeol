/**
 * SmartResultRare — Rare Surname variant
 * Source: NameForm_design/src/SmartResultRare.jsx (Claude Design 산출물, 918줄)
 *
 * 복성·단음 모두 다루며, 성씨 분석 banner / HarmonyScore / HanjaOptions 가로 스크롤이 핵심.
 */
"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { PhonologyNote } from "@/lib/types";

// ============================================================
// 데이터 타입
// ============================================================
export interface RareSummary {
  lastName: string;
  isCompound: boolean;
  date?: string;
  gender?: string;
  tone?: string;
}

export interface RareHanjaOption {
  char?: string;
  meaning: string;
  isDefault?: boolean;
}

export interface RareStrategy {
  key: string;
  label: string;
  detail: string;
}

export interface RareSurnameAnalysis {
  hanja?: string[];
  phoneticAnalysis: string;
  considerations: string[];
  pattern: string;
  patternDetail: string;
  strategies: RareStrategy[];
  averageHarmony: number;
}

export interface RareUICandidate {
  fullName: string;
  meaning: string;
  rarityMatch: number;
  aesthetics: number;
  harmony: number;
  harmonyScore: number;
  harmonyReason: string;
  reasons: string[];
  tags: string[];
  hanjaOptions: RareHanjaOption[];
  phonologyNotes: PhonologyNote[];
}

export interface RareGeneralCandidate {
  fullName: string;
  hanjaName?: string;
  meaning: string;
  aesthetics: number;
  harmony: number;
  finalScore: number;
  tags: string[];
}

export interface RareUICategory {
  type: string;
  label: string;
  description?: string;
  engineUsed?: string;
  totalInCategory: number;
  names: (RareUICandidate | RareGeneralCandidate)[];
}

export interface RareResultData {
  requestSummary: RareSummary;
  rarityLevel: number;
  surnameAnalysis: RareSurnameAnalysis;
  topPick: RareUICandidate | null;
  categories: RareUICategory[];
  totalCount: number;
}

const RARITY_STARS = (level: number) => "★".repeat(level || 0);
const RARITY_LABELS = ["", "조금 희귀", "희귀", "매우 희귀", "극희귀"];

// ============================================================
// 공통 스타일
// ============================================================
const chipNeutral: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 12px",
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: "nowrap",
};
const btnGhostR: CSSProperties = {
  appearance: "none",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 500,
  background: "transparent",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  padding: "7px 12px",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const popoverStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  background: "var(--color-surface)",
  boxShadow: "var(--shadow-lg)",
  border: "1px solid var(--color-divider)",
  borderRadius: "var(--radius-md)",
  padding: "10px 14px",
  minWidth: 220,
  zIndex: 20,
  fontSize: 12.5,
  color: "var(--color-text-2)",
  lineHeight: 1.6,
};

function Sep2() {
  return (
    <span
      style={{
        width: 1,
        height: 14,
        background: "var(--color-divider)",
        margin: "0 4px",
      }}
    />
  );
}

function TagChipR({ label }: { label: string }) {
  let palette = {
    bg: "rgba(43,43,43,0.06)",
    color: "var(--color-text-2)",
  };
  if (["음운중심", "의미중심"].includes(label))
    palette = { bg: "var(--color-teal-50)", color: "var(--color-teal)" };
  else if (["자연", "덕목", "개념"].includes(label))
    palette = { bg: "var(--color-gold-50)", color: "#6F5421" };
  else if (label === "세대중립")
    palette = {
      bg: "rgba(43,43,43,0.06)",
      color: "var(--color-text-2)",
    };
  else if (label === "창작")
    palette = { bg: "var(--color-navy-50)", color: "var(--color-navy)" };
  else if (
    label === "단명" ||
    label === "2글자" ||
    label === "양성모음"
  )
    palette = { bg: "var(--color-gold-50)", color: "#6F5421" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
        fontFamily: "var(--font-sans)",
        background: palette.bg,
        color: palette.color,
      }}
    >
      {label}
    </span>
  );
}

// ============================================================
// SubHeader
// ============================================================
function CompoundChip({ surname }: { surname: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...chipNeutral,
          appearance: "none",
          border: "1px dashed var(--color-border)",
          background: "var(--color-surface)",
          cursor: "pointer",
          gap: 4,
        }}
      >
        복성
        <span
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--color-text-3)",
            marginLeft: 2,
          }}
        >
          (複姓)
        </span>
        <span
          style={{
            width: 13,
            height: 13,
            borderRadius: 999,
            background: "var(--color-text-3)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
            marginLeft: 2,
          }}
        >
          i
        </span>
      </button>
      {open && (
        <div style={popoverStyle}>
          <b style={{ fontWeight: 600 }}>{surname}</b>는 두 글자로 이루어진
          성씨입니다.
        </div>
      )}
    </span>
  );
}

function RarityChip({ level }: { level: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 999,
        background: "var(--color-gold-50)",
        color: "#6F5421",
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        border: "1px solid var(--color-gold-100)",
      }}
    >
      <span style={{ letterSpacing: "0.04em" }}>{RARITY_STARS(level)}</span>
      <span style={{ color: "var(--color-text-2)", fontWeight: 500 }}>
        희귀도
      </span>
      <span style={{ color: "var(--color-text-3)", fontWeight: 400 }}>
        ({RARITY_LABELS[level]})
      </span>
    </span>
  );
}

function SubHeaderRare({
  summary,
  rarityLevel,
  onRegenerate,
  onSave,
}: {
  summary: RareSummary;
  rarityLevel: number;
  onRegenerate?: () => void;
  onSave?: () => void;
}) {
  const isCompound = summary.isCompound;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 24px",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          flex: "1 1 0",
          minWidth: 0,
        }}
      >
        <span style={chipNeutral}>성 {summary.lastName}</span>
        {isCompound && <CompoundChip surname={summary.lastName} />}
        <RarityChip level={rarityLevel} />
        <Sep2 />
        {summary.date && <span style={chipNeutral}>{summary.date}</span>}
        {summary.gender && <span style={chipNeutral}>{summary.gender}</span>}
        {summary.tone && <span style={chipNeutral}>{summary.tone}</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button type="button" onClick={onRegenerate} style={btnGhostR}>
          ↻ 새로 생성
        </button>
        <button type="button" onClick={onSave} style={btnGhostR}>
          ♡ 이 결과 저장
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Hero — 성씨 분석 banner
// ============================================================
function SurnameCard({
  summary,
  sa,
  level,
}: {
  summary: RareSummary;
  sa: RareSurnameAnalysis;
  level: number;
}) {
  const chars = summary.lastName.split("");
  const hanja = sa.hanja || [];
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-md)",
        padding: 0,
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
        minWidth: chars.length === 2 ? 168 : 100,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${chars.length}, 1fr)`,
        }}
      >
        {chars.map((ch, i) => (
          <div
            key={i}
            style={{
              padding: "20px 18px",
              borderRight:
                i < chars.length - 1
                  ? "1px solid var(--color-divider)"
                  : "none",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 38,
                fontWeight: 500,
                color: "var(--color-text)",
                lineHeight: 1,
              }}
            >
              {ch}
            </div>
            {hanja[i] && (
              <div
                style={{
                  marginTop: 10,
                  fontFamily: "var(--font-serif)",
                  fontSize: 16,
                  color: "var(--color-navy)",
                }}
              >
                {hanja[i]}
              </div>
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--color-divider)",
          background: "var(--color-surface-2)",
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 11,
          color: "var(--color-text-3)",
          letterSpacing: "0.04em",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>
          {chars.length === 2 ? "복성" : "단성"}
        </span>
        <span
          style={{
            color: "var(--color-gold-600)",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {RARITY_STARS(level)}
        </span>
      </div>
    </div>
  );
}

function AnalysisSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 10,
          color: "var(--color-text-3)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        ── {title} ──
      </div>
      {children}
    </div>
  );
}

function DownArrow({ label }: { label: string }) {
  return (
    <div
      style={{
        margin: "20px auto 14px",
        textAlign: "center",
        fontFamily: "Inter, var(--font-sans)",
        fontSize: 11,
        color: "var(--color-text-3)",
        letterSpacing: "0.12em",
        fontWeight: 600,
        textTransform: "uppercase",
      }}
    >
      <div
        style={{
          width: 1,
          height: 18,
          background: "var(--color-text-3)",
          margin: "0 auto 6px",
        }}
      />
      ⏷ {label}
    </div>
  );
}

function RareTopPickCard({ top }: { top: RareUICandidate }) {
  const defaultHanja =
    top.hanjaOptions.find((h) => h.isDefault) || top.hanjaOptions[0];
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-gold)",
        borderRadius: "var(--radius-lg)",
        padding: "22px 26px",
        maxWidth: 480,
        margin: "0 auto",
        boxShadow: "0 12px 28px rgba(201,169,110,0.18)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -10,
          left: 22,
          background: "var(--color-gold-50)",
          color: "#6F5421",
          padding: "3px 12px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
          border: "1px solid var(--color-gold)",
        }}
      >
        TOP PICK · 특이 성씨
      </div>

      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 30,
          fontWeight: 500,
          color: "var(--color-text)",
          letterSpacing: "-0.018em",
          marginTop: 4,
        }}
      >
        {top.fullName}
      </div>
      {defaultHanja?.char && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              color: "var(--color-navy)",
            }}
          >
            {defaultHanja.char}
          </span>
          <span style={{ fontSize: 13, color: "var(--color-text-2)" }}>
            · {top.meaning}
          </span>
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px dashed var(--color-divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 10,
              color: "var(--color-text-3)",
              letterSpacing: "0.1em",
              marginBottom: 4,
            }}
          >
            HARMONY
          </div>
          <div>
            <b
              style={{
                fontWeight: 700,
                fontSize: 32,
                color: "var(--color-navy)",
                letterSpacing: "-0.02em",
              }}
            >
              {top.harmonyScore}
            </b>
            <span
              style={{
                fontSize: 12,
                color: "var(--color-text-3)",
                marginLeft: 4,
              }}
            >
              발음 조화
            </span>
          </div>
        </div>
        <a
          href="#"
          style={{
            fontSize: 13,
            color: "var(--color-teal)",
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          상세 보기 →
        </a>
      </div>
    </div>
  );
}

function SurnameAnalysisBanner({ data }: { data: RareResultData }) {
  const sa = data.surnameAnalysis;
  const top = data.topPick;
  return (
    <div
      style={{
        marginTop: 28,
        position: "relative",
        background: "#F4EFE7",
        borderRadius: "var(--radius-lg)",
        padding: "28px 28px 24px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 28,
          alignItems: "flex-start",
        }}
      >
        <SurnameCard
          summary={data.requestSummary}
          sa={sa}
          level={data.rarityLevel}
        />
        <div>
          <AnalysisSection title="발음 분석">
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--color-text)",
                lineHeight: 1.65,
              }}
            >
              {sa.phoneticAnalysis}
            </p>
          </AnalysisSection>
          <AnalysisSection title="작명 시 고려사항">
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 6,
              }}
            >
              {sa.considerations.map((c, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    fontSize: 13,
                    color: "var(--color-text-2)",
                    lineHeight: 1.55,
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 999,
                      background: "var(--color-gold-600)",
                      flexShrink: 0,
                      marginTop: 8,
                    }}
                  />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </AnalysisSection>
        </div>
      </div>

      {top && (
        <>
          <DownArrow label="TopPick 결론" />
          <RareTopPickCard top={top} />
        </>
      )}
    </div>
  );
}

function RareHero({ data }: { data: RareResultData }) {
  return (
    <div
      style={{
        padding: "48px 24px 8px",
        maxWidth: 920,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--color-text-3)",
        }}
      >
        Rare Surname · Result
      </div>
      <h1
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 36,
          fontWeight: 500,
          margin: "10px 0 8px",
          letterSpacing: "-0.018em",
          lineHeight: 1.25,
        }}
      >
        {data.requestSummary.lastName} 씨에게 어울리는 이름
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "var(--color-text-2)",
          margin: 0,
        }}
      >
        성씨의 결에 맞춰 발음과 의미를 정성껏 골랐어요
      </p>

      <SurnameAnalysisBanner data={data} />
    </div>
  );
}

function GeneralHeroR({ data }: { data: RareResultData }) {
  return (
    <div
      style={{
        padding: "48px 24px 8px",
        maxWidth: 920,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--color-text-3)",
        }}
      >
        Naming · Result
      </div>
      <h1
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 32,
          fontWeight: 500,
          margin: "10px 0 8px",
          letterSpacing: "-0.018em",
          lineHeight: 1.25,
        }}
      >
        {data.requestSummary.lastName} 씨를 위한 이름
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-2)",
          margin: 0,
        }}
      >
        총{" "}
        <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
          {data.totalCount}개
        </b>{" "}
        후보가 있어요. 특이 성씨 결과는 첫 번째 탭에서 확인하세요
      </p>
    </div>
  );
}

// ============================================================
// rare-surname banner (rich)
// ============================================================
function StrategyChip({ strategy }: { strategy: RareStrategy }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          appearance: "none",
          border: "1px solid var(--color-teal-100)",
          background: "var(--color-teal-50)",
          color: "var(--color-teal)",
          padding: "4px 10px",
          borderRadius: 999,
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 11 }}>
          ✓
        </span>
        {strategy.label}
      </button>
      {open && <div style={popoverStyle}>{strategy.detail}</div>}
    </span>
  );
}

function BannerStatR({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 10,
          color: "var(--color-text-3)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function SealIcon() {
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: 4,
        background: "#A33C2A",
        color: "#FFF6E8",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-serif)",
        fontWeight: 600,
        fontSize: 14,
        boxShadow: "inset 0 0 0 2px #FFF6E8, 0 0 0 1px #A33C2A",
      }}
    >
      姓
    </span>
  );
}

function RareSurnameBanner({
  cat,
  sa,
}: {
  cat: RareUICategory;
  sa: RareSurnameAnalysis;
}) {
  return (
    <div
      style={{
        maxWidth: 920,
        margin: "20px auto 0",
        padding: "20px 24px",
        background: "#F4EFE7",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <SealIcon />
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--color-text)",
            }}
          >
            {cat.label}
          </div>
        </div>
        {cat.engineUsed && (
          <div
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 11,
              color: "var(--color-text-3)",
              letterSpacing: "0.04em",
            }}
          >
            by {cat.engineUsed}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
        }}
      >
        <BannerStatR label="발음 패턴">
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text)",
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontWeight: 500 }}>{sa.pattern}</div>
            <div
              style={{ color: "var(--color-text-2)", marginTop: 2 }}
            >
              {sa.patternDetail}
            </div>
          </div>
        </BannerStatR>

        <BannerStatR label="추천 전략">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sa.strategies.map((s) => (
              <StrategyChip key={s.key} strategy={s} />
            ))}
          </div>
        </BannerStatR>

        <BannerStatR label="평균 조화점수">
          <div style={{ fontFamily: "Inter, var(--font-sans)" }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "var(--color-navy)",
                letterSpacing: "-0.02em",
              }}
            >
              {sa.averageHarmony}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-3)",
                marginLeft: 6,
                letterSpacing: "0.06em",
              }}
            >
              발음 조화
            </span>
          </div>
        </BannerStatR>
      </div>
    </div>
  );
}

function GeneralCategoryBannerR({ cat }: { cat: RareUICategory }) {
  const iconOf: Record<string, string> = {
    standard: "漢",
    "pure-korean": "ㅎ",
    creative: "✦",
  };
  return (
    <div
      style={{
        maxWidth: 920,
        margin: "20px auto 0",
        padding: "16px 24px",
        background: "#F4EFE7",
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-teal)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 15,
            border: "1px solid var(--color-divider)",
          }}
        >
          {iconOf[cat.type] || "·"}
        </span>
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--color-text)",
            }}
          >
            {cat.label}
          </div>
          {cat.description && (
            <div
              style={{
                fontSize: 13,
                color: "var(--color-text-2)",
                marginTop: 2,
              }}
            >
              {cat.description}
            </div>
          )}
        </div>
      </div>
      {cat.engineUsed && (
        <div
          style={{
            fontFamily: "Inter, var(--font-sans)",
            fontSize: 11,
            color: "var(--color-text-3)",
            letterSpacing: "0.04em",
          }}
        >
          by {cat.engineUsed}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Candidate cards
// ============================================================
function RareCandidateCard({
  candidate,
  index,
  initialOpen,
}: {
  candidate: RareUICandidate;
  index: number;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!initialOpen);
  const [hover, setHover] = useState(false);
  const [activeHanjaIdx, setActiveHanjaIdx] = useState(0);
  const c = candidate;
  const activeHanja = c.hanjaOptions[activeHanjaIdx];
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: "var(--color-surface)",
        border:
          "1px solid " +
          (hover ? "var(--color-teal-100)" : "var(--color-border)"),
        borderRadius: "var(--radius-lg)",
        padding: "26px 26px 22px",
        boxShadow: hover
          ? "0 10px 24px rgba(46, 125, 122, 0.08)"
          : "var(--shadow-sm)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 200ms cubic-bezier(.2,.6,.2,1)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -10,
          left: 22,
          background: "var(--color-gold-50)",
          color: "#6F5421",
          padding: "4px 12px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
          border: "1px solid var(--color-gold)",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <span style={{ letterSpacing: "0.04em" }}>
          {RARITY_STARS(c.rarityMatch)}
        </span>
        희귀도 매칭
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "Inter, var(--font-sans)",
            fontSize: 11,
            color: "var(--color-text-3)",
            letterSpacing: "0.08em",
            fontWeight: 600,
          }}
        >
          #{index + 1}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 28,
              fontWeight: 500,
              color: "var(--color-text)",
              letterSpacing: "-0.015em",
            }}
          >
            {c.fullName}
          </div>
          {activeHanja && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginTop: 6,
                flexWrap: "wrap",
              }}
            >
              {activeHanja.char ? (
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 18,
                    color: "var(--color-navy)",
                  }}
                >
                  {activeHanja.char}
                </span>
              ) : (
                <span
                  style={{
                    fontFamily: "Inter, var(--font-sans)",
                    fontSize: 11,
                    color: "var(--color-text-3)",
                    letterSpacing: "0.04em",
                    border: "1px dashed var(--color-divider)",
                    padding: "1px 8px",
                    borderRadius: 4,
                  }}
                >
                  한글 그대로
                </span>
              )}
              <span style={{ fontSize: 13, color: "var(--color-text-2)" }}>
                {activeHanja.char && "· "}
                {activeHanja.meaning}
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 12,
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 12,
              color: "var(--color-text-2)",
            }}
          >
            <span>
              미학{" "}
              <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
                {c.aesthetics}
              </b>
            </span>
            <span>
              조화{" "}
              <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
                {c.harmony}
              </b>
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 36,
              fontWeight: 700,
              color: "var(--color-navy)",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {c.harmonyScore}
          </div>
          <div
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 10,
              color: "var(--color-text-3)",
              marginTop: 4,
              letterSpacing: "0.08em",
            }}
          >
            발음 조화
          </div>
        </div>
      </div>

      {c.tags.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {c.tags.map((t, i) => (
            <TagChipR key={i} label={t} />
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px dashed var(--color-divider)",
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-2)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              transition: "transform 180ms",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ▸
          </span>
          이름의 결
        </button>

        {open && (
          <div style={{ marginTop: 12 }}>
            {c.harmonyReason && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--color-gold-50)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13.5,
                  color: "#6F5421",
                  lineHeight: 1.6,
                  fontWeight: 500,
                  border: "1px solid var(--color-gold-100)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    marginRight: 6,
                    color: "var(--color-gold-600)",
                  }}
                >
                  ★
                </span>
                {c.harmonyReason}
              </div>
            )}

            {c.reasons.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  paddingLeft: 4,
                  display: "grid",
                  gap: 6,
                }}
              >
                {c.reasons.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      fontSize: 13.5,
                      color: "var(--color-text)",
                      lineHeight: 1.6,
                    }}
                  >
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 999,
                        background: "var(--color-teal)",
                        flexShrink: 0,
                        marginTop: 8,
                      }}
                    />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}

            {c.hanjaOptions.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontFamily: "Inter, var(--font-sans)",
                    fontSize: 10,
                    color: "var(--color-text-3)",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  한자 옵션 {c.hanjaOptions.length}개
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    overflowX: "auto",
                    paddingBottom: 4,
                    scrollbarWidth: "thin",
                  }}
                >
                  {c.hanjaOptions.map((h, i) => {
                    const isActive = i === activeHanjaIdx;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveHanjaIdx(i);
                        }}
                        style={{
                          appearance: "none",
                          flexShrink: 0,
                          padding: "10px 14px",
                          background: isActive
                            ? "var(--color-navy-50)"
                            : "var(--color-surface)",
                          border:
                            "1px solid " +
                            (isActive
                              ? "var(--color-navy)"
                              : "var(--color-border)"),
                          borderRadius: "var(--radius-md)",
                          cursor: "pointer",
                          textAlign: "left",
                          minWidth: 120,
                          transition: "all 160ms",
                        }}
                      >
                        {h.char ? (
                          <div
                            style={{
                              fontFamily: "var(--font-serif)",
                              fontSize: 18,
                              color: "var(--color-navy)",
                              fontWeight: 500,
                            }}
                          >
                            {h.char}
                          </div>
                        ) : (
                          <div
                            style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: 13,
                              color: "var(--color-text-2)",
                              fontWeight: 500,
                              padding: "1px 0",
                            }}
                          >
                            한글 그대로
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: "var(--color-text-2)",
                          }}
                        >
                          {h.meaning}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {c.phonologyNotes.length > 0 && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  background: "var(--color-surface-2)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  fontSize: 12.5,
                  color: "var(--color-text-2)",
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: "var(--color-text-3)",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  i
                </span>
                <div>
                  {c.phonologyNotes.map((n, i) => (
                    <div key={i}>
                      <b
                        style={{
                          color: "var(--color-text)",
                          fontWeight: 600,
                        }}
                      >
                        {n.name}
                      </b>
                      {" — "}
                      {n.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function GeneralCandidateCardR({
  candidate,
  index,
}: {
  candidate: RareGeneralCandidate;
  index: number;
}) {
  const c = candidate;
  return (
    <article
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "22px 26px",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "Inter, var(--font-sans)",
            fontSize: 11,
            color: "var(--color-text-3)",
            letterSpacing: "0.08em",
            fontWeight: 600,
          }}
        >
          #{index + 1}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 28,
              fontWeight: 500,
              color: "var(--color-text)",
              letterSpacing: "-0.015em",
            }}
          >
            {c.fullName}
          </div>
          {(c.hanjaName || c.meaning) && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginTop: 6,
                flexWrap: "wrap",
              }}
            >
              {c.hanjaName && (
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 18,
                    color: "var(--color-navy)",
                  }}
                >
                  {c.hanjaName}
                </span>
              )}
              <span
                style={{
                  fontSize: 13,
                  color: "var(--color-text-2)",
                }}
              >
                {c.hanjaName && "· "}
                {c.meaning}
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 10,
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 12,
              color: "var(--color-text-2)",
            }}
          >
            <span>
              미학{" "}
              <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
                {c.aesthetics}
              </b>
            </span>
            <span>
              조화{" "}
              <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
                {c.harmony}
              </b>
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 36,
              fontWeight: 700,
              color: "var(--color-navy)",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {c.finalScore}
          </div>
          <div
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 10,
              color: "var(--color-text-3)",
              marginTop: 4,
              letterSpacing: "0.08em",
            }}
          >
            FINAL
          </div>
        </div>
      </div>
      {c.tags.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {c.tags.map((t, i) => (
            <TagChipR key={i} label={t} />
          ))}
        </div>
      )}
    </article>
  );
}

// ============================================================
// CategoryTabsR
// ============================================================
function CategoryTabsR({
  categories,
  active,
  onChange,
}: {
  categories: RareUICategory[];
  active: string;
  onChange: (type: string) => void;
}) {
  return (
    <div
      style={{
        maxWidth: 920,
        margin: "40px auto 0",
        padding: "0 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "var(--color-surface-2)",
          padding: 4,
          borderRadius: 999,
          overflowX: "auto",
        }}
      >
        {categories.map((cat) => {
          const isActive = cat.type === active;
          const isRare = cat.type === "rare-surname";
          return (
            <button
              key={cat.type}
              type="button"
              onClick={() => onChange(cat.type)}
              style={{
                appearance: "none",
                border: "none",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                padding: "9px 16px",
                borderRadius: 999,
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: isActive ? "var(--color-surface)" : "transparent",
                color: isActive
                  ? "var(--color-text)"
                  : "var(--color-text-2)",
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
                fontWeight: isActive ? 600 : 500,
                transition: "all 160ms",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isRare && (
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 11,
                    color: isActive
                      ? "var(--color-gold-600)"
                      : "var(--color-text-3)",
                  }}
                >
                  ★
                </span>
              )}
              {cat.label}{" "}
              <span
                style={{
                  color: "var(--color-text-3)",
                  fontFamily: "Inter, var(--font-sans)",
                  fontWeight: 400,
                  marginLeft: 2,
                }}
              >
                ({cat.totalInCategory})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// SmartResultRarePage — 메인
// ============================================================
export function SmartResultRarePage({
  data,
  initialTab,
  expandFirstCard = false,
  editHref = "/rare-surname",
  onRegenerate,
  onSave,
}: {
  data: RareResultData;
  initialTab?: string;
  expandFirstCard?: boolean;
  editHref?: string;
  onRegenerate?: () => void;
  onSave?: () => void;
}) {
  const [tab, setTab] = useState(initialTab || "rare-surname");
  const bannerRef = useRef<HTMLDivElement>(null);

  const onTabChange = (t: string) => {
    setTab(t);
    setTimeout(() => {
      if (bannerRef.current) {
        const y =
          bannerRef.current.getBoundingClientRect().top +
          window.scrollY -
          80;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 30);
  };

  const activeCat =
    data.categories.find((c) => c.type === tab) ?? data.categories[0];
  if (!activeCat) return null;

  const isRare = activeCat.type === "rare-surname";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-background)",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(250, 247, 242, 0.92)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--color-divider)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              fontWeight: 500,
              color: "var(--color-navy)",
              letterSpacing: "-0.01em",
            }}
          >
            이름의 결
          </span>
          <span
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 11,
              color: "var(--color-text-3)",
              letterSpacing: "0.06em",
            }}
          >
            Naming.kyeol
          </span>
        </Link>
        <Link
          href={editHref}
          style={{
            fontSize: 13,
            color: "var(--color-text-2)",
            textDecoration: "none",
          }}
        >
          ← 조건 수정
        </Link>
      </header>

      <SubHeaderRare
        summary={data.requestSummary}
        rarityLevel={data.rarityLevel}
        onRegenerate={onRegenerate}
        onSave={onSave}
      />

      <main>
        {isRare ? <RareHero data={data} /> : <GeneralHeroR data={data} />}

        <CategoryTabsR
          categories={data.categories}
          active={tab}
          onChange={onTabChange}
        />

        <div ref={bannerRef}>
          {isRare ? (
            <RareSurnameBanner cat={activeCat} sa={data.surnameAnalysis} />
          ) : (
            <GeneralCategoryBannerR cat={activeCat} />
          )}
        </div>

        <div
          style={{
            maxWidth: 880,
            margin: "20px auto 0",
            padding: "0 24px",
            display: "grid",
            gap: 22,
          }}
        >
          {isRare
            ? activeCat.names.map((n, i) => (
                <RareCandidateCard
                  key={i}
                  candidate={n as RareUICandidate}
                  index={i}
                  initialOpen={expandFirstCard && i === 0}
                />
              ))
            : activeCat.names.map((n, i) => (
                <GeneralCandidateCardR
                  key={i}
                  candidate={n as RareGeneralCandidate}
                  index={i}
                />
              ))}
        </div>

        <footer
          style={{
            marginTop: 64,
            padding: "32px 24px 48px",
            borderTop: "1px solid var(--color-divider)",
            textAlign: "center",
            color: "var(--color-text-2)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              display: "flex",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <a
              href="#"
              style={{
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
            >
              이름의 결에 대하여
            </a>
            <span style={{ color: "var(--color-divider)" }}>·</span>
            <a
              href="#"
              style={{
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
            >
              문의
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default SmartResultRarePage;
