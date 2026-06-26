/**
 * DualResult — Dual Result main page (sub-header + mapping banner + cards + explainer + table)
 * Source: NameForm_design/src/DualResult.jsx (Claude Design 산출물)
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Mark } from "./Mark";
import { Button } from "./Primitives";
import { DualCard, type DualCandidate, type DualMode } from "./DualCard";

export interface DualContext {
  lastName: string;
  preferredEnglishName: string;
  mode: DualMode;
  gender: "male" | "female" | "any";
  tone: "neutral" | "soft" | "strong";
}

const MODE_LABEL: Record<DualMode, string> = {
  phonetic: "음역 유사형",
  semantic: "의미 유사형",
  free: "자유형",
};

// ============================================================
// DualSubHeader
// ============================================================
function DualSubHeader({
  ctx,
  onRegenerate,
  onSave,
}: {
  ctx: DualContext;
  onRegenerate?: () => void;
  onSave?: () => void;
}) {
  const chips = [
    `성 ${ctx.lastName}`,
    `선호 ${ctx.preferredEnglishName}`,
    MODE_LABEL[ctx.mode],
    ctx.gender === "male"
      ? "남"
      : ctx.gender === "female"
        ? "여"
        : "미지정",
    ctx.tone === "neutral"
      ? "중립 톤"
      : ctx.tone === "soft"
        ? "소프트 톤"
        : "강한 톤",
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
          flexWrap: "wrap",
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
// MappingBanner
// ============================================================
function MappingBanner({
  english,
  koreanLabel,
  mode,
}: {
  english: string;
  koreanLabel: string;
  mode: DualMode;
}) {
  return (
    <div
      style={{
        background: "#F4EFE7",
        borderRadius: "var(--radius-lg)",
        padding: "22px 28px",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: 28,
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-3)",
            letterSpacing: "0.04em",
            marginBottom: 4,
          }}
        >
          ENGLISH
        </div>
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 28,
            fontWeight: 500,
            color: "var(--color-text)",
            letterSpacing: "-0.01em",
          }}
        >
          {english}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <svg
          width="38"
          height="18"
          viewBox="0 0 38 18"
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M2 9 H34 M30 4 L35 9 L30 14" />
        </svg>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-teal)",
            background: "var(--color-surface)",
            padding: "4px 12px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            border: "1px solid var(--color-teal-100)",
          }}
        >
          {MODE_LABEL[mode]}
        </span>
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-3)",
            letterSpacing: "0.04em",
            marginBottom: 4,
          }}
        >
          KOREAN
        </div>
        <div
          style={{
            fontFamily: "Pretendard Variable, Pretendard, sans-serif",
            fontSize: 28,
            fontWeight: 500,
            color: "var(--color-text)",
            letterSpacing: "-0.01em",
          }}
        >
          {koreanLabel}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ModeExplainer
// ============================================================
function ModeExplainer({ mode }: { mode: DualMode }) {
  const [open, setOpen] = useState(false);
  const title =
    mode === "phonetic"
      ? "음역 유사형이란?"
      : mode === "semantic"
        ? "의미 유사형이란?"
        : "자유형이란?";
  const body =
    mode === "phonetic"
      ? "Philip의 발음을 한국어 음절(필+립)로 옮긴 뒤, 각 음절에 어울리는 한자를 붙이는 방식이에요. 두 언어에서 같은 소리로 불려요."
      : mode === "semantic"
        ? "영어 이름의 어원·의미를 한국어에 담은 한자 이름으로 옮기는 방식이에요. 발음은 달라도 뜻의 결이 이어져요."
        : "영어 이름과 한국 이름을 독립적으로 골라 결을 맞추는 방식이에요. 발음·의미의 직접 연결은 약하지만 선택 폭이 넓어요.";

  const others = [
    { key: "phonetic", label: "음역 유사형", copy: "같은 소리로 이어요" },
    { key: "semantic", label: "의미 유사형", copy: "같은 뜻으로 이어요" },
    { key: "free", label: "자유형", copy: "독립적으로 골라요" },
  ].filter((x) => x.key !== mode);

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "18px 22px",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              display: "inline-flex",
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--color-teal-50)",
              color: "var(--color-teal)",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ?
          </span>
          {title}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-2)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 200ms",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 14 }}>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: 0,
              marginBottom: 16,
            }}
          >
            {body}
          </p>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-3)",
              letterSpacing: "0.04em",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            다른 연결 방식
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {others.map((o) => (
              <Link
                key={o.key}
                href={`/dual-name?connect=${o.key}`}
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: "12px 14px",
                  background: "var(--color-surface-2)",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text)",
                  }}
                >
                  {o.label}
                </span>
                <span
                  style={{ fontSize: 12, color: "var(--color-text-2)" }}
                >
                  {o.copy}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CompareTable
// ============================================================
function CompareTable({ candidates }: { candidates: DualCandidate[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          width: "100%",
          padding: "16px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="3" width="12" height="10" rx="1" />
            <path d="M2 7h12M6 3v10" />
          </svg>
          {candidates.length}개 후보 한눈에 비교하기
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-2)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 200ms",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 22px 18px", overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              minWidth: 560,
            }}
          >
            <thead>
              <tr
                style={{
                  borderTop: "1px solid var(--color-divider)",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                {["#", "한국어", "한자", "의미", "최종"].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: i === 4 ? "right" : "left",
                      padding: "10px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-text-3)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr
                  key={c.rank}
                  style={{
                    borderBottom: "1px solid var(--color-divider)",
                  }}
                >
                  <td
                    style={{
                      padding: "12px",
                      color: "var(--color-text-3)",
                      fontFamily: "Inter",
                    }}
                  >
                    {c.rank}
                  </td>
                  <td style={{ padding: "12px", fontWeight: 500 }}>
                    {c.koreanFull}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontFamily: "var(--font-serif)",
                      fontSize: 16,
                    }}
                  >
                    {c.hanja.map((h) => h.char).join("")}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      color: "var(--color-text-2)",
                    }}
                  >
                    {c.hanja.map((h) => h.meaning).join(" · ")}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      fontFamily: "Inter",
                      fontWeight: 700,
                      color: "var(--color-navy)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {c.scores.final}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DualResultPage — 메인 페이지
// ============================================================
export function DualResultPage({
  context,
  candidates,
  onRegenerate,
  onSave,
  editHref = "/dual-name",
}: {
  context: DualContext;
  candidates: DualCandidate[];
  onRegenerate?: () => void;
  onSave?: () => void;
  editHref?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedCand = candidates.find((c) => c.rank === selected);
  const koreanLabel = candidates[0]?.koreanFull
    ? `${candidates[0].koreanFull.slice(1)} 계열`
    : "";

  return (
    <div
      data-screen-label="Dual Result"
      style={{ minHeight: "100vh", background: "var(--color-background)" }}
    >
      {/* Mini header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(250, 247, 242, 0.88)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "14px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <Mark size={28} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.1,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                이름의 결
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-2)",
                  fontFamily: "Inter",
                  whiteSpace: "nowrap",
                }}
              >
                Naming.kyeol
              </span>
            </div>
          </Link>
          <Link
            href={editHref}
            style={{
              fontSize: 13,
              color: "var(--color-text-2)",
              fontWeight: 500,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            ← 조건 수정
          </Link>
        </div>
      </header>

      <DualSubHeader
        ctx={context}
        onRegenerate={onRegenerate}
        onSave={onSave}
      />

      <main
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "48px 32px 64px",
        }}
      >
        {/* Hero */}
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-teal)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Dual Naming · Result
          </div>
          <h1
            style={{
              fontSize: 36,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: 0,
              marginBottom: 12,
            }}
          >
            {context.preferredEnglishName}과 어울리는 한국 이름
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: 0,
            }}
          >
            음운과 의미를 잇는 {candidates.length}가지 제안
          </p>
        </section>

        {/* Mapping banner */}
        <div style={{ marginBottom: 32 }}>
          <MappingBanner
            english={context.preferredEnglishName}
            koreanLabel={koreanLabel}
            mode={context.mode}
          />
        </div>

        {/* Candidate cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {candidates.map((c) => (
            <DualCard
              key={c.rank}
              cand={c}
              selected={selected === c.rank}
              onSelect={setSelected}
              mode={context.mode}
              lastName={context.lastName}
            />
          ))}
        </div>

        {/* Explainer */}
        <div style={{ marginBottom: 20 }}>
          <ModeExplainer mode={context.mode} />
        </div>

        {/* Compare table */}
        <div style={{ marginBottom: 40 }}>
          <CompareTable candidates={candidates} />
        </div>

        {/* CTAs */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Button
            variant="primary"
            disabled={!selected}
            style={{
              padding: "14px 32px",
              fontSize: 15,
              opacity: selected ? 1 : 0.4,
              cursor: selected ? "pointer" : "not-allowed",
            }}
          >
            {selected && selectedCand
              ? `${selectedCand.koreanFull}으로 결정하기 ✓`
              : "카드를 선택해주세요"}
          </Button>
          <Link
            href={editHref}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-2)",
              textDecoration: "none",
            }}
          >
            ↻ 연결 방식 바꾸기
          </Link>
          <Link
            href="/"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-3)",
              textDecoration: "underline",
              textUnderlineOffset: 4,
              textDecorationThickness: 1,
            }}
          >
            다른 경로로 작명하기 ↓
          </Link>
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--color-border)",
          padding: "32px",
          marginTop: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--color-text-3)",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span>© Naming.kyeol</span>
          <div style={{ display: "flex", gap: 16 }}>
            <a
              href="#"
              style={{
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
            >
              이름의 결에 대하여
            </a>
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
        </div>
      </footer>
    </div>
  );
}

export default DualResultPage;
