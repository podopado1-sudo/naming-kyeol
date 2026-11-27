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
  twinEvaluateHref,
  twinResultTitle,
  twinSetLabel,
  twinSummaryLine,
} from "@/lib/twin-sets";

/** 고정 머리(약 57px) 아래로 — 탭 줄로 스크롤할 때 머리에 가려지지 않게(다른 결과 화면은 80~88) */
const TABS_SCROLL_MARGIN = 72;

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
}: {
  /** 제출 때 잡은 조건(/twin page.tsx) — 칩·제목·'상세 보기' 링크가 모두 이 값을 쓴다 */
  context: TwinContext;
  themes: TwinThemeBlock[];
  /** '← 조건 수정' — 결과를 지우고 입력값이 남은 폼으로 돌아간다(예전 같은 경로 Link 는 눌러도 결과가 그대로였다) */
  onRegenerate: () => void;
  onSave?: () => void;
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

  // 열 수·연결 표시는 이 세트의 실제 이름 수로 정한다(자녀 수 칩은 제출값 — 둘은 같아야 하지만, 격자가 응답과 어긋나지 않게).
  // 열 정의는 아래 <style> 의 .twin-pair-grid — 좁은 폭에서 한 줄로 쌓는다(예전 repeat(2|3, 1fr) 인라인은 375 폭에서 옆으로 넘쳤다)
  const pairCount = theme.pair.length;
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
          {/* 예전에는 같은 경로(/twin)로 가는 Link 라 눌러도 결과 화면이 그대로였다(같은 경로 이동은 컴포넌트 상태를 지우지 않는다) */}
          <button
            type="button"
            onClick={onRegenerate}
            data-hide-print
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "6px 0",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--color-text-2)",
              fontWeight: 500,
            }}
          >
            ← 조건 수정
          </button>
        </div>
      </header>

      <TwinSubHeader ctx={context} onSave={onSave} />

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
            {twinResultTitle(context.lastName, context.count)}
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

        {/* Tabs — 조작 요소라 인쇄하지 않는다. scrollMarginTop: '다른 세트 보기 ↑'·'다른 테마' 카드로 이 줄까지 올릴 때 고정 머리 밑에 숨지 않게 */}
        <div
          ref={tabsRef}
          data-hide-print
          style={{
            marginBottom: 20,
            display: "flex",
            justifyContent: "center",
            scrollMarginTop: TABS_SCROLL_MARGIN,
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
          <div data-hide-print style={{ marginBottom: 20 }}>
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
          <div className="print:break-inside-avoid" style={{ marginBottom: 28 }}>
            <CoherenceHero score={theme.coherence} note={theme.coherenceNote} />
          </div>

          {/* Pair grid with connector */}
          <div style={{ position: "relative" }}>
            <div
              className={
                pairCount >= 3
                  ? "twin-pair-grid twin-pair-grid--3"
                  : "twin-pair-grid"
              }
            >
              {theme.pair.map((entry, i) => (
                <PairCard
                  key={i}
                  entry={entry}
                  theme={theme}
                  lastName={context.lastName}
                  detailHref={twinEvaluateHref(context, entry.first)}
                />
              ))}
            </div>
            {/* Connector — 2-person only. 한 줄로 쌓는 좁은 폭에서는 카드 내용 위에 얹히므로 숨긴다(.twin-connector) */}
            {pairCount === 2 && (
              <div
                className="twin-connector"
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

          {/* 다른 세트로 — 세트가 하나뿐이면 갈 곳이 없으니 그리지 않는다. 조작 단추라 인쇄하지 않는다.
              (2026-11-26: 여기 있던 '이 세트로 결정하기 ✓' 단추는 동작이 없어 없앴다. 이름별 자세히 보기는 카드 안에 있다 — 같은 조건의 /evaluate) */}
          {themes.length > 1 && (
          <div
            data-hide-print
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

        {/* Other themes horizontal scroll — 다른 테마로 가는 단추 줄이라 인쇄하지 않는다(가로 스크롤 줄은 종이에서 잘린다) */}
        {otherGroups.length > 0 && (
          <div data-hide-print style={{ marginTop: 72 }}>
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

      {/* Footer — 링크만 있어 인쇄하지 않는다(globals.css 의 'footer 전부 숨김'이 사이트 꼬리말로 좁혀져도 빠지게) */}
      <footer
        data-hide-print
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

      {/* 이름 카드 격자 — minmax(0, 1fr) 라 카드 내용 폭이 열을 밀어 넓히지 않는다. 640 이하(세 이름은 860 이하 —
          세 칸이면 카드 안쪽이 150px 아래로 좁아진다)에서는 한 줄로 쌓고 가운데 연결 표시를 숨긴다 */}
      <style>{`
        @keyframes twinFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .twin-pair-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
        }
        .twin-pair-grid--3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        @media (max-width: 860px) {
          .twin-pair-grid--3 {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
          }
        }
        @media (max-width: 640px) {
          .twin-pair-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
          }
          .twin-connector {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default TwinResultPage;
