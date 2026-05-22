/**
 * ProPaths — 특수 작명 경로 5개 카드 (평가/쌍둥이/부모/희귀성씨/이중이름)
 * Source: NameForm_design/src/ProPaths.jsx (Claude Design 산출물)
 */
"use client";

import { useState } from "react";

export type ProPathKey =
  | "evaluate"
  | "twin"
  | "parent"
  | "rare"
  | "dual"
  | "required";

interface ProPathCard {
  key: ProPathKey;
  eyebrow: string;
  title: string;
  copy: string;
  cta: string;
}

const CARDS: ProPathCard[] = [
  {
    key: "evaluate",
    eyebrow: "정해둔 이름이 있다면",
    title: "이름 평가 리포트",
    copy: "점수와 상세 리포트를 받아보세요 — 미학·조화·유니크 지수.",
    cta: "평가하기",
  },
  {
    key: "twin",
    eyebrow: "둘 이상을 함께 부를 때",
    title: "쌍둥이 작명",
    copy: "조화로우면서 각자 독립된 정체성을 갖는 이름 세트.",
    cta: "쌍둥이 작명",
  },
  {
    key: "parent",
    eyebrow: "가족의 이야기를 잇는",
    title: "부모 이름 기반",
    copy: "부모님의 이름에서 영감을 받아 서사를 이어갑니다.",
    cta: "부모 이름으로",
  },
  {
    key: "rare",
    eyebrow: "선우·남궁·황보를 위한",
    title: "희귀 성씨 특화",
    copy: "2음절 복성(複姓)과 희귀 성씨에 맞춘 전문 작명.",
    cta: "희귀 성씨",
  },
  {
    key: "dual",
    eyebrow: "국제적 소통까지",
    title: "한영 이중 이름",
    copy: "한국 이름과 영어 이름이 자연스럽게 연결되는 세트.",
    cta: "이중 이름",
  },
  {
    key: "required",
    eyebrow: "꼭 넣고 싶은 글자가 있다면",
    title: "필수 글자 포함",
    copy: "돌림자(항렬자)나 특정 글자를 포함한 이름만 골라드립니다.",
    cta: "필수 글자",
  },
];

export function ProPaths({
  onSelect,
}: {
  onSelect?: (key: ProPathKey) => void;
}) {
  const [hover, setHover] = useState<ProPathKey | null>(null);

  return (
    <section
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "40px 32px 24px",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <h2
          style={{
            fontSize: 22,
            lineHeight: 1.3,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          특정한 상황에 맞는 전문 경로
        </h2>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--color-text-2)",
            margin: "8px 0 0",
          }}
        >
          성씨, 관계, 목적에 따라 전용 작명 경로를 제공합니다.
        </p>
      </div>

      <div className="sumi-grid-3">
        {CARDS.map((c) => {
          const isHover = hover === c.key;
          return (
            <a
              key={c.key}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onSelect?.(c.key);
              }}
              onMouseEnter={() => setHover(c.key)}
              onMouseLeave={() => setHover(null)}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)",
                boxShadow: isHover ? "var(--shadow-sm)" : "none",
                padding: "20px 22px",
                textDecoration: "none",
                color: "var(--color-text)",
                transition: "all 220ms cubic-bezier(.2,.6,.2,1)",
                transform: isHover ? "translateY(-1px)" : "none",
                minHeight: 148,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  color: "var(--color-text-3)",
                  textTransform: "none",
                  marginBottom: 6,
                }}
              >
                {c.eyebrow}
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                  margin: 0,
                  marginBottom: 8,
                  color: "var(--color-text)",
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--color-text-2)",
                  margin: 0,
                  flex: 1,
                }}
              >
                {c.copy}
              </p>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-teal)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {c.cta}
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

export default ProPaths;
