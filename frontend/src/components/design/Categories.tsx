/**
 * Categories — 라이프 컨텍스트 4개 카드 (아기/개명/회사명/반려동물)
 * Source: NameForm_design/src/Categories.jsx (Claude Design 산출물)
 */
"use client";

import { useState } from "react";

export type CategoryKey = "baby" | "rename" | "company" | "pet";

export interface CategoryItem {
  key: CategoryKey;
  title: string;
  copy: string;
  status: "live" | "coming";
  /** 수묵화 톤 — 카드 좌상단에 큰 한자 한 글자 (lucide 아이콘 대체) */
  hanja: string;
  /** 한자 옆 작은 음 (한글) */
  reading: string;
}

const ITEMS: CategoryItem[] = [
  {
    key: "baby",
    title: "아기 이름",
    copy: "첫 선물이 되는 이름",
    status: "live",
    hanja: "兒",
    reading: "아이",
  },
  {
    key: "rename",
    title: "개명",
    copy: "지금 나에게 맞는 이름으로",
    status: "live",
    hanja: "改",
    reading: "개명",
  },
  {
    key: "company",
    title: "회사명",
    copy: "오래 불릴 이름의 결",
    status: "coming",
    hanja: "商",
    reading: "상호",
  },
  {
    key: "pet",
    title: "반려동물 이름",
    copy: "함께하는 이름",
    status: "coming",
    hanja: "寵",
    reading: "반려",
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
                background: "var(--color-background)",
                border: `1px solid ${isHover ? "var(--color-ink-jiao)" : "var(--color-ink-qing)"}`,
                padding: "28px 22px",
                textDecoration: "none",
                color: "var(--color-text)",
                transition: "all 280ms cubic-bezier(.2,.6,.2,1)",
                transform: isHover ? "translateY(-2px)" : "none",
                minHeight: 196,
                opacity: isComing ? 0.78 : 1,
              }}
            >
              {/* hover 시 우상단 朱印 — 작품 인증 도장 메타포 */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  width: 18,
                  height: 18,
                  background: "var(--color-vermilion)",
                  color: "var(--color-background)",
                  borderRadius: 2,
                  fontFamily: "var(--font-serif)",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: "rotate(-3deg)",
                  opacity: isHover && !isComing ? 1 : 0,
                  transition: "opacity 200ms",
                }}
              >
                名
              </span>

              {isComing && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--color-text-3)",
                    border: "1px solid var(--color-ink-qing)",
                    padding: "2px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  Coming
                </div>
              )}

              {/* 한자 아이콘 — 수묵화: 큰 명조 한 글자 + 작은 한글 음 */}
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 44,
                  fontWeight: 700,
                  color: "var(--color-text)",
                  lineHeight: 1,
                  marginBottom: 18,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                {it.hanja}
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 11,
                    fontWeight: 400,
                    color: "var(--color-text-3)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {it.reading}
                </span>
              </div>
              <h3
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 17,
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: 8,
                  letterSpacing: "-0.01em",
                  color: "var(--color-text)",
                }}
              >
                {it.title}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.7,
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
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text-2)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  letterSpacing: "0.02em",
                }}
              >
                {isComing ? "알림 받기" : "자세히 보기"}
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
