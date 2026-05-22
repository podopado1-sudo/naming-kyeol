/**
 * WhyKyeol — "왜 이름의 결인가" 섹션 (분석의 세 축)
 * Source: NameForm_design/src/WhyKyeol.jsx (Claude Design 산출물)
 */
import type { ReactNode } from "react";
import { BarChart3, Compass, ShieldCheck } from "lucide-react";

interface WhyItem {
  key: string;
  title: string;
  copy: string;
  icon: ReactNode;
}

const ICON_PROPS = { size: 28, strokeWidth: 1.4 } as const;

const ITEMS: WhyItem[] = [
  {
    key: "data",
    title: "데이터 기반",
    copy: "9,595자 한자 사전과 세대별 빈도 데이터로\n이름의 쓰임을 수치화해 살펴봅니다.",
    icon: <BarChart3 {...ICON_PROPS} />,
  },
  {
    key: "principle-based",
    title: "원칙 기반",
    copy: "사주명리·음운론·자원오행 등\n전통 작명 원칙을 알고리즘에 녹였습니다.",
    icon: <Compass {...ICON_PROPS} />,
  },
  {
    key: "principle",
    title: "보수적 기준",
    copy: "유행과 소망형 표현을 배제하고\n세대 중립성을 우선해 추천합니다.",
    icon: <ShieldCheck {...ICON_PROPS} />,
  },
];

export function WhyKyeol() {
  return (
    <section
      style={{
        background: "var(--color-surface-2)",
        marginTop: 72,
        padding: "80px 32px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 32,
            marginBottom: 48,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 28,
                lineHeight: 1.3,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              왜 이름의 결인가
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--color-text-2)",
                margin: "10px 0 0",
                maxWidth: 460,
              }}
            >
              감(感)이 아니라 결(結)을 읽습니다. 시간이 지나도 변하지 않는
              기준으로 이름을 분석해요.
            </p>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-gold-600)",
              letterSpacing: "0.08em",
              paddingBottom: 6,
            }}
          >
            OUR METHOD · 분석의 세 축
          </div>
        </div>

        <div
          className="sumi-why-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 0,
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}
        >
          {ITEMS.map((it, idx) => (
            <div
              key={it.key}
              style={{
                padding: "36px 32px 40px",
                borderRight:
                  idx < ITEMS.length - 1
                    ? "1px solid var(--color-divider)"
                    : "none",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "var(--color-navy-50)",
                  color: "var(--color-navy)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                {it.icon}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-text-3)",
                  letterSpacing: "0.12em",
                  marginBottom: 8,
                }}
              >
                0{idx + 1}
              </div>
              <h3
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: 12,
                  letterSpacing: "-0.01em",
                }}
              >
                {it.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: "var(--color-text-2)",
                  margin: 0,
                  whiteSpace: "pre-line",
                }}
              >
                {it.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default WhyKyeol;
