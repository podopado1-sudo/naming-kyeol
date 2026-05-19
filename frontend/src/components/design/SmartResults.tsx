/**
 * SmartResults — Smart Result wrapper (context bar + top pick + tabs + grid)
 * Source: NameForm_design/src/SmartResults.jsx (Claude Design 산출물)
 */
"use client";

import { useMemo, useState } from "react";
import {
  CategoryTabs,
  EmptyState,
  LoadingState,
  SmartNameCard,
} from "./SmartCards";
import { SearchContextBar, TopPickHero } from "./SmartTop";
import type { SmartRecommendationResponse } from "@/lib/types";

const TAB_ORDER = [
  "standard",
  "pure-korean",
  "three-syllable",
  "creative",
  "parent-based",
  "required-char",
  "dual-name",
  "twin",
  "rare-surname",
];

export function SmartResults({
  data,
  onBack,
  loading = false,
  summary,
  onCandidateClick,
}: {
  data: SmartRecommendationResponse;
  onBack?: () => void;
  loading?: boolean;
  summary?: string;
  onCandidateClick?: (fullName: string) => void;
}) {
  const visibleCategories = useMemo(
    () =>
      TAB_ORDER.map((t) => data.categories.find((c) => c.type === t)).filter(
        (x): x is NonNullable<typeof x> => Boolean(x)
      ),
    [data]
  );

  const [activeTab, setActiveTab] = useState(
    visibleCategories[0]?.type ?? "standard"
  );
  const active =
    visibleCategories.find((c) => c.type === activeTab) ??
    visibleCategories[0];

  const summaryText =
    summary ?? `${data.lastName}씨 · ${data.totalCount}개 후보`;

  if (loading) {
    return (
      <>
        <SearchContextBar
          summary={summaryText}
          count={data.totalCount}
          onEdit={onBack}
        />
        <LoadingState />
      </>
    );
  }

  return (
    <>
      <SearchContextBar
        summary={summaryText}
        count={data.totalCount}
        onEdit={onBack}
      />

      <section
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "24px 32px 96px",
        }}
      >
        {/* Top pick */}
        <TopPickHero topPick={data.topPick} />

        {/* Category tabs */}
        {visibleCategories.length > 0 && (
          <div style={{ marginTop: 56 }}>
            <div
              style={{
                marginBottom: 8,
                display: "flex",
                alignItems: "end",
                justifyContent: "space-between",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  카테고리별로 살펴보기
                </h2>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "var(--color-text-2)",
                    margin: "6px 0 0",
                  }}
                >
                  같은 기준이라도 이름의 결은 카테고리마다 다르게 드러나요.
                </p>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-3)",
                  letterSpacing: "0.08em",
                }}
              >
                정렬:{" "}
                <span
                  style={{
                    color: "var(--color-navy)",
                    fontWeight: 600,
                  }}
                >
                  균형점수 높은 순 ↓
                </span>
              </div>
            </div>
            <div style={{ marginTop: 16, overflowX: "auto" }}>
              <CategoryTabs
                categories={visibleCategories}
                active={activeTab}
                onChange={setActiveTab}
              />
            </div>

            <div style={{ marginTop: 28 }}>
              {active && active.names.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 18,
                  }}
                >
                  {active.names.map((c, i) => (
                    <SmartNameCard
                      key={c.fullName + i}
                      candidate={c}
                      onClick={() => onCandidateClick?.(c.fullName)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  categoryLabel={active?.label}
                  onEdit={onBack}
                />
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export default SmartResults;
