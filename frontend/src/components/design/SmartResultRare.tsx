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
import { josa } from "@/lib/josa";

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

/**
 * 한자 옵션 한 칸 — 글자와 사전 뜻을 나눠 담는다. 백엔드 hanjaOptions 는 `${글자}(${뜻})` 문자열을 이름 음절마다 최대 3개씩
 * 음절 순서대로 이어 붙인 목록이라(RareSurnameEngine.FindHanjaOptions) 어댑터(/rare-surname)가 갈라 넣는다
 */
export interface RareHanjaOption {
  /** 한자 한 글자 — 없으면 '한글 그대로' */
  char?: string;
  /** 사전 뜻(훈음, 예: '아름다울 미') — 비어 있으면 뜻 자리를 그리지 않는다 */
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

/**
 * 희귀 성씨 후보 한 명 — 숫자는 API 가 준 성씨 발음 조화(harmonyScore) 하나뿐이다.
 * 미학·종합·희귀도 매칭 점수는 엔진이 내지 않으므로 필드를 두지 않는다(2026-10-28 — 옛 어댑터가 순위로 지어냈다).
 * 그 자리는 evaluateHref(같은 조건의 /evaluate — 실제 미학·조화 평가)로 잇는다.
 */
export interface RareUICandidate {
  fullName: string;
  /** 성씨와의 발음 조화 0~100 (RareSurnameEngine) — 사주 조화 점수가 아니다 */
  harmonyScore: number;
  /**
   * 발음 조화 근거 — 응답 harmonyReason(ScoreCandidateCore 근거 문장을 '; '로 이은 한 줄)을 나눈 목록. 펼침에서 한 번만 그린다
   * (옛 화면은 같은 한 줄을 금색 상자와 목록에 두 번, Top Pick 한자 옆 '뜻' 자리에 한 번 더 그렸다 — 2026-10-28)
   */
  reasons: string[];
  /** '희귀 성씨'는 응답 isRareSurname 일 때만(어댑터) */
  tags: string[];
  hanjaOptions: RareHanjaOption[];
  phonologyNotes: PhonologyNote[];
  /** '/evaluate?lastName=…&name=…' — 값이 있는 조건만 담는다 */
  evaluateHref: string;
}

export interface RareUICategory {
  type: string;
  label: string;
  description?: string;
  engineUsed?: string;
  totalInCategory: number;
  names: RareUICandidate[];
}

export interface RareResultData {
  requestSummary: RareSummary;
  /** 응답 isRareSurname — 희귀 단계 3 이상(RareSurnameEngine). '희귀 성씨' 표지는 이 값이 참일 때만 */
  isRareSurname: boolean;
  /** 성씨 희귀 단계 1~4 */
  rarityLevel: number;
  surnameAnalysis: RareSurnameAnalysis;
  topPick: RareUICandidate | null;
  categories: RareUICategory[];
  totalCount: number;
}

/**
 * 성씨 희귀 단계 — 백엔드 RareSurnameEngine.DetermineRarityLevel 그대로(1 = 흔함·상위 30, 2 = 보통·31~50위, 3 = 희귀, 4 = 매우희귀).
 * 옛 라벨은 한 칸씩 부풀려(1 = '조금 희귀' … 4 = '극희귀') 김·이도 '조금 희귀'로 보였다(2026-10-28).
 * 별은 채운 별 + 빈 별로 4단계 눈금을 그린다 — 흔한 성씨의 별 하나가 '희귀도 1점'이 아니라 '네 단계 중 가장 낮음'으로 읽히게
 */
const RARITY_MAX = 4;
const RARITY_LABELS = ["", "흔함", "보통", "희귀", "매우 희귀"];
const rarityStars = (level: number) => {
  const n = Math.max(0, Math.min(RARITY_MAX, level || 0));
  return "★".repeat(n) + "☆".repeat(RARITY_MAX - n);
};
const rarityLabel = (level: number) => RARITY_LABELS[level] ?? "";

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
  // 폰 폭에서는 칩 줄이 접히며 이 세로선만 줄 끝에 홀로 남는다(375px 실측) — sm 이상에서만 그린다
  return (
    <span
      className="hidden sm:block"
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
          <b style={{ fontWeight: 600 }}>{surname}</b>
          {josa(surname, "은/는")} 두 글자로 이루어진 성씨입니다.
        </div>
      )}
    </span>
  );
}

function RarityChip({ level }: { level: number }) {
  const label = rarityLabel(level);
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
      {/* 별 눈금은 장식 — 단계는 옆 글자 '희귀도 (흔함)'이 말한다 */}
      <span aria-hidden="true" style={{ letterSpacing: "0.04em" }}>
        {rarityStars(level)}
      </span>
      <span style={{ color: "var(--color-text-2)", fontWeight: 500 }}>
        희귀도
      </span>
      {label && (
        <span style={{ color: "var(--color-text-3)", fontWeight: 400 }}>
          ({label})
        </span>
      )}
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
        {/* onSave가 없으면 숨김 — 눌러도 아무 일 없는 버튼을 두지 않는다 */}
        {onSave && (
          <button type="button" onClick={onSave} style={btnGhostR}>
            ♡ 이 결과 저장
          </button>
        )}
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
        {/* 희귀 단계를 알리는 것은 이 별 개수뿐이라 글자로 본다(11px — RarityChip 의 #6F5421 과 같은 기준) — gold-700 은
            surface-2 위 3.48:1 이라 골드 글자 토큰 gold-800(7.21:1, 2026-10-26 팔레트 #2 보완) */}
        <span
          style={{
            color: "var(--color-gold-800)",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden="true">{rarityStars(level)}</span>
          <span className="sr-only">희귀도 {rarityLabel(level)}</span>
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
          background: "var(--color-ink-dan)", // 1px 세로선(비텍스트) — text-3 를 짙게 한 뒤에도 옛 淡墨 그대로
          margin: "0 auto 6px",
        }}
      />
      ⏷ {label}
    </div>
  );
}

function RareTopPickCard({
  top,
  isRareSurname,
}: {
  top: RareUICandidate;
  isRareSurname: boolean;
}) {
  // 첫 음절의 대표 한자(hanjaOptions 첫 칸) — 옆 '뜻' 자리는 그 글자의 사전 뜻만(옛 화면은 발음 조화 근거 한 줄을 붙였다)
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
        {/* 옛 고정 '· 특이 성씨'는 흔한 성씨(김)에도 붙었다 — 응답 isRareSurname 일 때만 */}
        TOP PICK{isRareSurname ? " · 희귀 성씨" : ""}
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
          {defaultHanja.meaning && (
            <span style={{ fontSize: 13, color: "var(--color-text-2)" }}>
              · {defaultHanja.meaning}
            </span>
          )}
        </div>
      )}

      {/* 줄바꿈 flex — 폰 폭(375px, 카드 안 ~216px)에서 점수 100 이면 '조화'가 혼자 내려가던 것을, 링크를 다음 줄로 보내 막는다.
          gap 대신 columnGap·rowGap(React 의 shorthand·longhand 충돌 경고 회피) */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px dashed var(--color-divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          columnGap: 18,
          rowGap: 10,
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
                whiteSpace: "nowrap",
              }}
            >
              발음 조화
            </span>
          </div>
        </div>
        {/* 옛 '상세 보기'는 href="#" 빈 링크였다. 이 엔진은 발음 조화만 매기므로 미학·조화 평가는 /evaluate 로 잇는다.
            일반 <a> — /evaluate 정적 라우트의 클라이언트 라우터 캐시가 이전 ?name= 을 재사용하는 잔상 우회(next/link 금지).
            새 탭으로 연다 — 결과가 이 페이지 React 상태에만 있어 같은 탭으로 갔다 돌아오면 입력 폼으로 돌아가 후보를 잃는다.
            ↗ 는 새 탭 표시(장식 — aria-hidden, 접근 이름 끝 '(새 탭)'이 알린다). 접근 이름은 보이는 글자로 시작한다(라벨-이름 일치) */}
        <a
          href={top.evaluateHref}
          target="_blank"
          rel="noopener"
          aria-label={`이 이름 평가하기: ${top.fullName} (새 탭)`}
          style={{
            fontSize: 13,
            color: "var(--color-teal)",
            fontWeight: 500,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          이 이름 평가하기
          <span
            aria-hidden="true"
            style={{ display: "inline-block", marginLeft: 3, fontSize: 11 }}
          >
            ↗
          </span>
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
      {/* 줄바꿈 flex — 옛 'auto 1fr' 격자는 폰 폭(375px)에서 성씨 카드(복성 168px)가 자리를 차지해 분석 글 칸이 ~70px 로
          좁아져 한 줄에 한 낱말씩 내려갔다. 글 칸이 240px 보다 좁아지면 성씨 카드 아래로 내린다 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 28,
          alignItems: "flex-start",
        }}
      >
        <SurnameCard
          summary={data.requestSummary}
          sa={sa}
          level={data.rarityLevel}
        />
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
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
          <RareTopPickCard top={top} isRareSurname={data.isRareSurname} />
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
        {/* 엔진(RareSurnameEngine)은 성씨와 이어지는 소리로만 이름을 고른다 — 한자는 고른 이름에 붙이는 표시용 옵션이라 옛 '발음과 의미를' 은 뺐다 */}
        성씨와 이어지는 소리를 기준으로 두 글자 이름을 골랐어요
      </p>

      <SurnameAnalysisBanner data={data} />
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

        {/* 응답 harmonyScore(성씨 발음 조화)의 평균 — 사주 조화 점수와 헷갈리지 않게 '발음 조화'로 밝힌다 */}
        <BannerStatR label="평균 발음 조화">
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
              후보 {cat.names.length}개
            </span>
          </div>
        </BannerStatR>
      </div>
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
      {/* 옛 '희귀도 매칭' 칩은 후보마다 고정값(희귀 단계 3 이상 90 · 아니면 75)을 별 개수로 그려 별이 75~90개 찍혔다.
          후보별 희귀도는 응답에 없고, 성씨 희귀 단계(rarityLevel)는 위 RarityChip·성씨 카드가 이미 보인다 */}
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
              {activeHanja.meaning && (
                <span style={{ fontSize: 13, color: "var(--color-text-2)" }}>
                  {activeHanja.char && "· "}
                  {activeHanja.meaning}
                </span>
              )}
            </div>
          )}
          {/* 옛 '미학 · 조화' 줄 — 미학은 순위로 지어낸 70~92, 조화는 오른쪽 발음 조화의 복제였다.
              엔진이 미학을 매기지 않으니 같은 조건의 /evaluate(실제 미학·조화 평가)로 잇는다.
              일반 <a> — /evaluate 정적 라우트의 클라이언트 라우터 캐시 잔상 우회(next/link 금지). 새 탭 — 결과가 이 페이지
              React 상태에만 있다. ↗ 는 장식(aria-hidden), 접근 이름은 보이는 글자로 시작하고 후보 이름으로 링크끼리 갈린다 */}
          <a
            href={c.evaluateHref}
            target="_blank"
            rel="noopener"
            aria-label={`이 이름 평가하기: ${c.fullName} (새 탭)`}
            style={{
              display: "inline-block",
              marginTop: 12,
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-teal)",
              textDecoration: "none",
            }}
          >
            이 이름 평가하기
            <span
              aria-hidden="true"
              style={{ display: "inline-block", marginLeft: 3, fontSize: 11 }}
            >
              ↗
            </span>
          </a>
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
            {/* 발음 조화 근거 — 오른쪽 '발음 조화' 숫자를 매긴 항목들(ScoreCandidateCore). 옛 화면은 같은 한 줄을 금색 ★ 상자와
                이 목록에 두 번 그렸다(reasons = [harmonyReason]) — 어댑터가 '; '로 나눈 목록을 여기 한 번만 그린다 */}
            {c.reasons.length > 0 && (
              <div>
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
                  발음 조화 근거
                </div>
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    paddingLeft: 4,
                    listStyle: "none",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  {c.reasons.map((r, i) => (
                    <li
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
                        aria-hidden="true"
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
                    </li>
                  ))}
                </ul>
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
                        {h.meaning && (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 11,
                              color: "var(--color-text-2)",
                            }}
                          >
                            {h.meaning}
                          </div>
                        )}
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
                      ? "var(--color-gold-700)"
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

  // 이 화면의 탭은 희귀 성씨 하나뿐이다(/rare-surname 어댑터가 rare-surname 카테고리만 만든다). 옛 일반 카테고리 분기
  // (GeneralHeroR·GeneralCategoryBannerR·GeneralCandidateCardR)는 아무도 채우지 않는 미학·조화·FINAL 점수 필드를 그리던
  // 도달 불가 코드라 2026-10-28 에 뺐다.
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
        <RareHero data={data} />

        <CategoryTabsR
          categories={data.categories}
          active={tab}
          onChange={onTabChange}
        />

        <div ref={bannerRef}>
          <RareSurnameBanner cat={activeCat} sa={data.surnameAnalysis} />
        </div>

        {/* minmax(0, 1fr) — 암묵 열(auto)이면 카드의 최소 폭이 펼침 속 한자 옵션 가로 줄(120px × 6 + 간격 = 760px)을 따라가
            폰 폭(375px)에서 카드를 펼치면 페이지 전체가 838px 로 넓어졌다. 옵션 줄은 카드 안에서 가로 스크롤한다 */}
        <div
          style={{
            maxWidth: 880,
            margin: "20px auto 0",
            padding: "0 24px",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 22,
          }}
        >
          {activeCat.names.map((n, i) => (
            <RareCandidateCard
              key={i}
              candidate={n}
              index={i}
              initialOpen={expandFirstCard && i === 0}
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
