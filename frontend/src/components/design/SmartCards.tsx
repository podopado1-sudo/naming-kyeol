/**
 * SmartCards — CategoryTabs + SmartNameCard + EmptyState + LoadingState
 * Source: NameForm_design/src/SmartCards.jsx (Claude Design 산출물)
 */
"use client";

import { useState } from "react";
import { BrushMascot } from "./BrushMascot";
import { Button } from "./Primitives";
import { PhonologyPill } from "./SmartTop";
import type { NameCategory, SmartNameCandidate } from "@/lib/types";

// ============================================================
// CategoryTabs
// ============================================================
export function CategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: NameCategory[];
  active: string;
  onChange: (type: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      {categories.map((cat) => {
        const isActive = cat.type === active;
        const count = cat.names?.length || 0;
        return (
          <div
            key={cat.type}
            onClick={() => onChange(cat.type)}
            role="tab"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onChange(cat.type);
            }}
            style={{
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive
                ? "var(--color-navy)"
                : "var(--color-text-2)",
              borderBottom: isActive
                ? "2px solid var(--color-navy)"
                : "2px solid transparent",
              marginBottom: -1,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              transition: "color 180ms",
              whiteSpace: "nowrap",
            }}
          >
            <span>{cat.label}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 7px",
                borderRadius: 999,
                background: isActive
                  ? "var(--color-navy-50)"
                  : "rgba(43,43,43,0.05)",
                color: isActive
                  ? "var(--color-navy)"
                  : "var(--color-text-3)",
                fontFamily: "Inter",
                letterSpacing: 0,
              }}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// SmartNameCard
// ============================================================
export function SmartNameCard({
  candidate,
  onClick,
}: {
  candidate: SmartNameCandidate;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const score = candidate.score ?? 0;
  const scoreColor =
    score >= 90
      ? "var(--color-score-high)"
      : score >= 80
        ? "var(--color-score-mid)"
        : "var(--color-score-low)";
  const tags = candidate.tags ?? [];
  const visibleTags = tags.slice(0, 3);
  const overflow = tags.length - visibleTags.length;

  return (
    <article
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-sm)",
        padding: "22px 24px 18px",
        transition: "box-shadow 180ms, transform 180ms",
        transform: hover ? "translateY(-2px)" : "none",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        minHeight: 210,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          columnGap: 16,
          rowGap: 6,
          alignItems: "start",
        }}
      >
        <h3
          style={{
            fontSize: 24,
            fontWeight: 700,
            margin: 0,
            letterSpacing: "-0.01em",
            color: "var(--color-text)",
          }}
        >
          {candidate.fullName}
        </h3>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1,
              color: scoreColor,
              letterSpacing: "-0.02em",
            }}
          >
            {score}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--color-text-2)",
              marginTop: 3,
              letterSpacing: "0.08em",
            }}
          >
            BALANCE
          </div>
        </div>
        {candidate.name && candidate.name !== "—" && (
          <div style={{ gridColumn: "1 / -1", marginTop: 2 }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 18,
                fontWeight: 500,
                color: "var(--color-navy)",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {candidate.name}
            </span>
          </div>
        )}
        <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
          <span
            style={{
              fontSize: 13,
              color: "var(--color-text-2)",
              lineHeight: 1.5,
              wordBreak: "keep-all",
            }}
          >
            {candidate.meaning}
          </span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid var(--color-divider)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {visibleTags.map((t) => (
            <span
              key={t}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 9px",
                background: "var(--color-teal-50)",
                color: "var(--color-teal)",
                fontSize: 11.5,
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {t}
            </span>
          ))}
          {overflow > 0 && (
            <span
              style={{ fontSize: 11.5, color: "var(--color-text-3)" }}
            >
              +{overflow}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <PhonologyPill notes={candidate.phonologyNotes} compact />
          <span
            style={{
              fontSize: 13,
              color: "var(--color-teal)",
              fontWeight: 500,
              whiteSpace: "nowrap",
              marginLeft: "auto",
            }}
          >
            상세 →
          </span>
        </div>
      </div>
    </article>
  );
}

// ============================================================
// EmptyState
// ============================================================
export function EmptyState({
  categoryLabel,
  onEdit,
}: {
  categoryLabel?: string;
  onEdit?: () => void;
}) {
  return (
    <div
      style={{
        padding: "72px 32px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <BrushMascot size={96} />
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--color-text)",
          marginTop: 20,
          letterSpacing: "-0.01em",
        }}
      >
        {categoryLabel
          ? `${categoryLabel} 카테고리에서는 추천할 이름이 없어요`
          : "이 카테고리에서는 추천할 이름이 없어요"}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "var(--color-text-2)",
          marginTop: 8,
          maxWidth: 380,
          lineHeight: 1.6,
        }}
      >
        다른 카테고리를 둘러보시거나 조건을 수정해보세요.
      </div>
      <div style={{ marginTop: 22 }}>
        <Button variant="secondary" onClick={onEdit}>
          조건 수정하기
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// LoadingState
// ============================================================
export function LoadingState() {
  return (
    <div
      style={{
        padding: "80px 32px 48px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          animation: "nk-float 2.8s cubic-bezier(.2,.6,.2,1) infinite",
        }}
      >
        <BrushMascot size={104} />
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--color-text)",
          marginTop: 20,
          letterSpacing: "-0.01em",
        }}
      >
        결을 읽어드리는 중입니다…
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: "var(--color-text-2)",
          marginTop: 6,
        }}
      >
        발음·의미·세대 중립도를 종합해 후보를 선별하고 있어요.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          maxWidth: 960,
          width: "100%",
          marginTop: 48,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
              padding: "22px 24px",
              minHeight: 200,
            }}
          >
            <div
              style={{
                height: 28,
                width: "55%",
                background: "rgba(43,43,43,0.06)",
                borderRadius: 6,
                animation: "nk-skel 1.6s ease-in-out infinite",
              }}
            />
            <div
              style={{
                height: 14,
                width: "80%",
                background: "rgba(43,43,43,0.05)",
                borderRadius: 6,
                marginTop: 14,
                animation: "nk-skel 1.6s ease-in-out infinite",
              }}
            />
            <div
              style={{
                height: 14,
                width: "60%",
                background: "rgba(43,43,43,0.05)",
                borderRadius: 6,
                marginTop: 8,
                animation: "nk-skel 1.6s ease-in-out infinite",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 24 }}>
              <div
                style={{
                  height: 22,
                  width: 66,
                  background: "rgba(46,125,122,0.1)",
                  borderRadius: 6,
                  animation: "nk-skel 1.6s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  height: 22,
                  width: 78,
                  background: "rgba(46,125,122,0.1)",
                  borderRadius: 6,
                  animation: "nk-skel 1.6s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes nk-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes nk-skel { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}
