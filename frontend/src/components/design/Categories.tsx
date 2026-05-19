/**
 * Categories — 라이프 컨텍스트 4개 카드 (아기/개명/회사명/반려동물)
 * Source: NameForm_design/src/Categories.jsx (Claude Design 산출물)
 */
"use client";

import { useState, type ReactNode } from "react";
import { Baby, Briefcase, PawPrint, Pencil } from "lucide-react";

export type CategoryKey = "baby" | "rename" | "company" | "pet";

export interface CategoryItem {
  key: CategoryKey;
  title: string;
  copy: string;
  status: "live" | "coming";
  icon: ReactNode;
}

const ICON_PROPS = { size: 28, strokeWidth: 1.4 } as const;

const ITEMS: CategoryItem[] = [
  {
    key: "baby",
    title: "아기 이름",
    copy: "첫 선물이 되는 이름",
    status: "live",
    icon: <Baby {...ICON_PROPS} />,
  },
  {
    key: "rename",
    title: "개명",
    copy: "지금 나에게 맞는 이름으로",
    status: "live",
    icon: <Pencil {...ICON_PROPS} />,
  },
  {
    key: "company",
    title: "회사명",
    copy: "오래 불릴 이름의 결",
    status: "coming",
    icon: <Briefcase {...ICON_PROPS} />,
  },
  {
    key: "pet",
    title: "반려동물 이름",
    copy: "함께하는 이름",
    status: "coming",
    icon: <PawPrint {...ICON_PROPS} />,
  },
];

export function Categories({
  onSelect,
  onNotify,
}: {
  onSelect?: (key: CategoryKey) => void;
  onNotify?: (item: CategoryItem) => void;
}) {
  const [hover, setHover] = useState<CategoryKey | null>(null);

  return (
    <section
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "64px 32px 24px",
      }}
    >
      <div style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 28,
            lineHeight: 1.3,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          어떤 이름을 찾고 계신가요?
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-2)",
            margin: "10px 0 0",
          }}
        >
          목적에 따라 분석 관점이 달라집니다. 쓰임새에 맞춰 살펴봐요.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
        }}
      >
        {ITEMS.map((it) => {
          const isHover = hover === it.key;
          const isComing = it.status === "coming";
          return (
            <a
              key={it.key}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (isComing) onNotify?.(it);
                else onSelect?.(it.key);
              }}
              onMouseEnter={() => setHover(it.key)}
              onMouseLeave={() => setHover(null)}
              style={{
                display: "flex",
                flexDirection: "column",
                position: "relative",
                background: isComing
                  ? "var(--color-surface-2)"
                  : "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
                boxShadow: isHover
                  ? "var(--shadow-md)"
                  : "var(--shadow-sm)",
                padding: "28px 24px",
                textDecoration: "none",
                color: "var(--color-text)",
                transition: "all 280ms cubic-bezier(.2,.6,.2,1)",
                transform: isHover ? "translateY(-2px)" : "none",
                minHeight: 196,
                opacity: isComing ? 0.92 : 1,
              }}
            >
              {isComing && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    color: "#8a6d3b",
                    background: "#f5eed8",
                    padding: "3px 9px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}
                >
                  🔜 준비 중
                </div>
              )}

              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: isComing
                    ? "var(--color-surface)"
                    : "var(--color-teal-50)",
                  color: isComing
                    ? "var(--color-text-2)"
                    : "var(--color-teal)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                {it.icon}
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: 6,
                  letterSpacing: "-0.01em",
                }}
              >
                {it.title}
              </h3>
              <p
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: "var(--color-text-2)",
                  margin: 0,
                  flex: 1,
                }}
              >
                {it.copy}
              </p>
              <div
                style={{
                  marginTop: 18,
                  fontSize: 13,
                  fontWeight: 500,
                  color: isComing
                    ? "var(--color-text-2)"
                    : "var(--color-teal)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {isComing ? "알림 받기" : "자세히"}
                <span
                  style={{
                    transition: "transform 180ms",
                    transform: isHover ? "translateX(3px)" : "none",
                    display: "inline-block",
                  }}
                >
                  →
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export default Categories;
