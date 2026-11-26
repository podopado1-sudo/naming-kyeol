/**
 * TwinResult — Twin Result main page
 * Source: NameForm_design/src/TwinResult.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState/useRef → 명시적 import
 *   - TWIN_SAMPLE 글로벌 → context/themes props
 *   - Mark → ./Mark import
 *   - TwinSubHeader/ThemeTabs/ThemeBanner/CoherenceHero → ./TwinResultTop
 *   - PairCard/ConnectorVisual → ./TwinResultCards
 */
"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Mark } from "./Mark";
import {
  CoherenceHero,
  SetChips,
  ThemeBanner,
  ThemeTabs,
  TwinSubHeader,
  type TwinContext,
  type TwinThemeBlock,
} from "./TwinResultTop";
import { ConnectorVisual, PairCard } from "./TwinResultCards";
import {
  groupTwinSets,
  pickTwinSet,
  twinSetLabel,
  twinSummaryLine,
} from "@/lib/twin-sets";

// ============================================================
// OtherThemePreview — 비활성 테마 미리보기 카드
// ============================================================
function OtherThemePreview({
  theme,
  setCount,
  lastName,
  onJump,
}: {
  /** 그 테마의 첫 세트(조화도가 가장 높은 세트) */
  theme: TwinThemeBlock;
  /** 그 테마의 세트 수 */
  setCount: number;
  lastName: string;
  onJump: () => void;
}) {
  const p1 = theme.pair[0];
  if (!p1) return null;

  return (
    <div
      onClick={onJump}
      style={{
        flex: "0 0 280px",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "16px 18px",
        cursor: "pointer",
        transition: "all 200ms cubic-bezier(.2,.6,.2,1)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = "var(--shadow-sm)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--color-text-2)",
          letterSpacing: "0.04em",
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {theme.label}
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "var(--color-text-2)",
          }}
        >
          {lastName}
        </span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 500,
            fontFamily: "Pretendard Variable",
            color: "var(--color-text)",
          }}
        >
          {p1.first}
        </span>
        {theme.pair.length > 1 && (
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-3)",
              marginLeft: 4,
            }}
          >
            외 {theme.pair.length - 1}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--color-text-3)",
          marginBottom: 12,
        }}
      >
        조화도{" "}
        <span
          style={{
            color: "var(--color-navy)",
            fontFamily: "Inter",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {theme.coherence}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--color-teal)",
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        {theme.label} 세트{setCount > 1 ? ` ${setCount}개` : ""} 보기 →
      </div>
    </div>
  );
}

// ============================================================
// TwinResultPage — 메인 페이지
// ============================================================
export function TwinResultPage({
  context,
  themes,
  onRegenerate,
  onSave,
  editHref = "/twin",
}: {
  context: TwinContext;
  themes: TwinThemeBlock[];
  onRegenerate?: () => void;
  onSave?: () => void;
  editHref?: string;
}) {
  // themes 는 세트 목록이다(같은 테마의 세트가 여럿) — 고른 것은 세트 id 로 기억하고, 탭은 테마별 묶음으로 그린다(lib/twin-sets.ts)
  const [currentId, setCurrentId] = useState<string>(themes[0]?.id ?? "");
  const [fadeKey, setFadeKey] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  const theme = pickTwinSet(themes, currentId);
  if (!theme) return null;

  const groups = groupTwinSets(themes);
  const group = groups.find((g) => g.key === theme.key) ?? groups[0];

  const selectSet = (id: string) => {
    if (id === theme.id) return;
    setCurrentId(id);
    setFadeKey((x) => x + 1);
  };

  // 테마 탭 — 그 테마의 첫 세트(조화도가 가장 높은 세트)로 간다
  const onTabChange = (k: string) => {
    if (k === theme.key) return;
    const next = groups.find((g) => g.key === k);
    if (next) selectSet(next.sets[0].id);
  };

  const gridCols = context.count >= 3 ? "repeat(3, 1fr)" : "repeat(2, 1fr)";
  const otherGroups = groups.filter((g) => g.key !== theme.key);

  const jumpToTabs = (k: string) => {
    onTabChange(k);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      data-screen-label="Twin Result"
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
              <span style={{ fontSize: 14, fontWeight: 700 }}>이름의 결</span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-2)",
                  fontFamily: "Inter",
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
            }}
          >
            ← 조건 수정
          </Link>
        </div>
      </header>

      <TwinSubHeader
        ctx={context}
        onRegenerate={onRegenerate}
        onSave={onSave}
      />

      <main
        style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 32px 64px" }}
      >
        {/* Hero */}
        <section style={{ marginBottom: 40 }}>
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
            Twin Naming · Result
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
            {context.lastName} 씨 쌍둥이를 위한 이름 세트
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: 0,
            }}
          >
            {twinSummaryLine(groups)}
          </p>
        </section>

        {/* Tabs */}
        <div
          ref={tabsRef}
          style={{
            marginBottom: 20,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <ThemeTabs
            themes={groups.map((g) => ({
              key: g.key,
              label: g.label,
              count: g.sets.length,
            }))}
            current={theme.key}
            onChange={onTabChange}
          />
        </div>

        {/* 이 테마의 세트 고르기 — 세트가 하나뿐이면 그리지 않는다 */}
        {group.sets.length > 1 && (
          <div style={{ marginBottom: 20 }}>
            <SetChips
              sets={group.sets.map((s) => ({
                id: s.id,
                label: twinSetLabel(s),
              }))}
              current={theme.id}
              onChange={selectSet}
            />
          </div>
        )}

        {/* Banner */}
        <div style={{ marginBottom: 24 }}>
          <ThemeBanner theme={theme} />
        </div>

        {/* Fade wrapper */}
        <div
          key={fadeKey}
          style={{
            animation: "twinFadeIn 280ms cubic-bezier(.2,.6,.2,1) both",
          }}
        >
          {/* Coherence hero */}
          <div style={{ marginBottom: 28 }}>
            <CoherenceHero score={theme.coherence} note={theme.coherenceNote} />
          </div>

          {/* Pair grid with connector */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                gap: 24,
              }}
            >
              {theme.pair.map((entry, i) => (
                <PairCard
                  key={i}
                  entry={entry}
                  theme={theme}
                  lastName={context.lastName}
                />
              ))}
            </div>
            {/* Connector — 2-person only */}
            {context.count === 2 && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "calc(50% - 60px)",
                  right: "calc(50% - 60px)",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <ConnectorVisual theme={theme} />
              </div>
            )}
          </div>

          {/* 다른 세트로 — 세트가 하나뿐이면 갈 곳이 없으니 그리지 않는다.
              (2026-11-26: 여기 있던 '이 세트로 결정하기 ✓' 단추는 동작이 없어 없앴다. 이름별 자세히 보기는 카드 안에 있다) */}
          {themes.length > 1 && (
          <div
            style={{
              marginTop: 40,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={() =>
                tabsRef.current?.scrollIntoView({ behavior: "smooth" })
              }
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-2)",
                padding: "6px 0",
                textDecoration: "underline",
                textUnderlineOffset: 4,
                textDecorationThickness: 1,
              }}
            >
              다른 세트 보기 ↑
            </button>
          </div>
          )}
        </div>

        {/* Other themes horizontal scroll */}
        {otherGroups.length > 0 && (
          <div style={{ marginTop: 72 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: 12,
                letterSpacing: "-0.005em",
              }}
            >
              다른 테마도 확인해보세요
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                overflowX: "auto",
                paddingBottom: 8,
              }}
            >
              {otherGroups.map((g) => (
                <OtherThemePreview
                  key={g.key}
                  theme={g.sets[0]}
                  setCount={g.sets.length}
                  lastName={context.lastName}
                  onJump={() => jumpToTabs(g.key)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--color-border)",
          padding: "32px 32px",
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
          <Link
            href="/"
            style={{
              fontSize: 13,
              color: "var(--color-text-2)",
              fontWeight: 500,
              textDecoration: "underline",
              textUnderlineOffset: 4,
              textDecorationThickness: 1,
            }}
          >
            다른 경로로 작명하기 ↓
          </Link>
          <div style={{ display: "flex", gap: 16 }}>
            <Link
              href="/about"
              style={{
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
            >
              이름의 결에 대하여
            </Link>
            <Link
              href="/contact"
              style={{
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
            >
              문의
            </Link>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes twinFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default TwinResultPage;
