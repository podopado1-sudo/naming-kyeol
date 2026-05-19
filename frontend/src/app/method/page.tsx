/**
 * /method — 작명 원리
 * "전문가 감수" 대신 시스템이 실제 사용하는 원칙을 솔직하게 설명하는 페이지.
 */
import Link from "next/link";
import {
  BarChart3,
  Bot,
  Compass,
  Database,
  FileText,
  Leaf,
  Music,
  ShieldCheck,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

// ============================================================
// 데이터 구조
// ============================================================
interface PillarRow {
  label: string;
  weight: number; // 만점 (예: 30)
  detail: string;
}

interface PrincipleCard {
  icon: LucideIcon;
  title: string;
  body: string;
}

const AESTHETIC_ROWS: PillarRow[] = [
  { label: "발음", weight: 30, detail: "자음·모음 흐름, 동음 반복 회피, 입에 붙는지" },
  { label: "리듬", weight: 25, detail: "음절 강약, 받침 분포, 단조로움 방지" },
  { label: "음절", weight: 15, detail: "성씨와의 결합 길이, 4·5음절 무리한 조합 감점" },
  { label: "세대 중립", weight: 15, detail: "특정 연대 유행 이름 회피" },
  { label: "의미", weight: 10, detail: "한자 사전적 뜻의 긍정·중립 여부" },
];

const HARMONY_ROWS: PillarRow[] = [
  { label: "오행", weight: 40, detail: "사주 오행과 이름 오행의 보완 관계" },
  { label: "자원오행", weight: 30, detail: "한자 획수 기반 오행 분포" },
  { label: "음양", weight: 20, detail: "陽·陰 균형" },
  { label: "성조화", weight: 10, detail: "성씨와 이름 글자의 결합 조화" },
];

const TRADITION_CARDS: PrincipleCard[] = [
  {
    icon: Compass,
    title: "사주명리 4기둥",
    body: "연주·월주·일주·시주(時柱)를 만세력 기준으로 계산합니다. 출생 시각을 입력하면 4기둥 모두, 미입력 시 3기둥으로 분석합니다.",
  },
  {
    icon: Sparkles,
    title: "용신 분석",
    body: "억부법(강약 균형)과 조후법(한난조습)을 결합해 일간(日干)의 용신을 추정합니다. 이름이 용신 오행을 보완하는지 살핍니다.",
  },
  {
    icon: Leaf,
    title: "오행 · 자원오행",
    body: "木·火·土·金·水 5요소가 사주에서 부족하거나 과한지를 보고, 한자 획수에서 도출된 자원오행이 이를 보완하는 방향으로 추천합니다.",
  },
  {
    icon: Music,
    title: "음운 분석",
    body: "한국어 음운론 규칙으로 자음 동음 반복, 모음 단조로움, 받침 흐름을 평가합니다. 입에 잘 붙는 발음을 우선합니다.",
  },
];

// ============================================================
// 페이지
// ============================================================
export default function MethodPage() {
  return (
    <>
      <Header current="method" />

      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "64px 32px 96px",
        }}
      >
        {/* ── Hero ──────────────────────────────────────────── */}
        <section style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.18em",
              color: "var(--color-teal)",
              background: "var(--color-teal-50)",
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 24,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--color-teal)",
              }}
            />
            Our Method
          </div>
          <h1
            style={{
              fontSize: 44,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
              margin: 0,
              marginBottom: 18,
            }}
          >
            이름의 결은 이렇게 분석합니다
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              maxWidth: 620,
              margin: "0 auto",
            }}
          >
            감(感)이 아니라 결(結)을 읽습니다.
            <br />
            전통 작명 이론과 데이터 분석을 알고리즘에 녹여
            <br />
            누가 봐도 설명할 수 있는 기준으로 이름을 살펴봅니다.
          </p>
        </section>

        {/* ── 추천 3 축 (요약) ─────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <SectionEyebrow>01 · 분석의 세 축</SectionEyebrow>
          <SectionTitle>데이터 · 원칙 · 보수적 기준</SectionTitle>
          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 18,
            }}
          >
            <AxisCard
              icon={BarChart3}
              title="데이터 기반"
              body="검수 완료 2,060자 Core Dataset과 대법원·네이버 인명용 한자, Unihan 표준까지 총 9,595자 사전 위에서 모든 후보가 만들어집니다."
            />
            <AxisCard
              icon={Compass}
              title="원칙 기반"
              body="사주명리·음운론·자원오행 등 전통 작명 원칙을 알고리즘에 녹였습니다. 무엇이 좋은 이름인지를 사람마다 다르게 답하지 않습니다."
            />
            <AxisCard
              icon={ShieldCheck}
              title="보수적 기준"
              body="유행어·소망형 표현·세대 편향이 강한 이름은 감점합니다. 시간이 지나도 어색하지 않은 이름을 우선 추천합니다."
            />
          </div>
        </section>

        {/* ── 점수 체계 ─────────────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <SectionEyebrow>02 · 점수 체계</SectionEyebrow>
          <SectionTitle>최종 점수 = 미학 × 70% + 조화 × 30%</SectionTitle>
          <p
            style={{
              marginTop: 12,
              fontSize: 14.5,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
            }}
          >
            미학이 7할, 사주 조화가 3할입니다.
            “먼저 좋은 이름이고, 그 다음에 사주에 어울리는 이름”이라는 우선순위를
            점수에 그대로 반영했습니다.
          </p>

          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 18,
            }}
          >
            <ScoreBlock
              title="미학 점수"
              subtitle="100점 만점 · 가중치 70%"
              rows={AESTHETIC_ROWS}
              tail="톤·성별 보너스 가산, 부적절 패턴 감점"
              accent="var(--color-teal)"
            />
            <ScoreBlock
              title="조화 점수"
              subtitle="100점 만점 · 가중치 30%"
              rows={HARMONY_ROWS}
              tail="출생일 미입력 시 조화 점수 생략"
              accent="var(--color-gold)"
            />
          </div>
        </section>

        {/* ── 전통 작명 원리 ────────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <SectionEyebrow>03 · 전통 작명 원리</SectionEyebrow>
          <SectionTitle>알고리즘에 녹인 네 가지 원리</SectionTitle>
          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 18,
            }}
          >
            {TRADITION_CARDS.map((c) => (
              <PrincipleBox key={c.title} card={c} />
            ))}
          </div>
        </section>

        {/* ── 리포트 방식 ───────────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <SectionEyebrow>04 · 리포트 방식</SectionEyebrow>
          <SectionTitle>AI는 이야기, 우리는 리포트</SectionTitle>
          <p
            style={{
              marginTop: 12,
              fontSize: 14.5,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
            }}
          >
            많은 서비스가 AI로 감성적인 설명을 생성합니다. 이름의 결은 다른 방향을
            선택했습니다. 점수와 근거를 명시하는 리포트 형식으로, 왜 좋은 이름인지를
            숫자로 설명합니다.
          </p>
          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 18,
            }}
          >
            {/* AI 방식 */}
            <div
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-divider)",
                borderRadius: "var(--radius-lg)",
                padding: "22px 22px 24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <Bot size={18} strokeWidth={1.5} color="var(--color-text-3)" />
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: "var(--color-text-3)",
                    textTransform: "uppercase",
                  }}
                >
                  AI 서술형
                </div>
              </div>
              <p
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.8,
                  color: "var(--color-text-2)",
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                "이 이름은 부드럽고 따뜻한 느낌을 주며, 자연의 생동감을 담고 있어
                아이의 밝은 미래를 상징합니다."
              </p>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: "var(--color-text-3)",
                  lineHeight: 1.6,
                }}
              >
                → 수치 없음 · 근거 없음 · 검증 불가
              </div>
            </div>

            {/* 리포트 방식 */}
            <div
              style={{
                background: "var(--color-teal-50)",
                border: "1.5px solid var(--color-teal)",
                borderRadius: "var(--radius-lg)",
                padding: "22px 22px 24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <FileText
                  size={18}
                  strokeWidth={1.5}
                  color="var(--color-teal)"
                />
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: "var(--color-teal)",
                    textTransform: "uppercase",
                  }}
                >
                  이름의 결 리포트
                </div>
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: 8,
                }}
              >
                {[
                  "발음 87점 — 받침 0개 / 부드러운 자음 비율 100%",
                  "리듬 22점 — 2음절 약강 패턴 / 단조로움 없음",
                  "오행 보완 — 사주 水 부족 → 이름 水·金 보강",
                  "세대 중립 — 연대 편향 이름 리스트 미포함",
                ].map((line) => {
                  const [metric, detail] = line.split(" — ");
                  return (
                    <li
                      key={line}
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "var(--color-text)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{metric}</span>
                      {detail ? ` — ${detail}` : ""}
                    </li>
                  );
                })}
              </ul>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: "var(--color-teal)",
                  lineHeight: 1.6,
                }}
              >
                → 모든 항목에 수치와 근거 병기
              </div>
            </div>
          </div>
        </section>

        {/* ── 우리가 안 하는 것 (철학) ──────────────────────── */}
        <section style={{ marginBottom: 56 }}>
          <SectionEyebrow>05 · 우리가 안 하는 것</SectionEyebrow>
          <SectionTitle>좋은 이름을 만들기 위해 거르는 것</SectionTitle>
          <ul
            style={{
              marginTop: 28,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 14,
            }}
          >
            <DontRow text="사주만으로 이름을 짓는 일 — 사주는 보조이고, 미학이 먼저입니다." />
            <DontRow text="유행어·아이돌 이름·드라마 인물명에서 따온 이름 — 5~10년 뒤 어색해지는 이름을 거릅니다." />
            <DontRow text="‘성공·부자·천재’ 등 소망형 한자 — 부담을 주는 이름은 추천하지 않습니다." />
            <DontRow text="특정 세대에 몰린 이름 — 어떤 시대에도 자연스러운 결을 우선합니다." />
          </ul>
        </section>

        {/* ── 자료 출처 ─────────────────────────────────────── */}
        <section
          style={{
            marginTop: 80,
            padding: "28px 32px",
            background: "var(--color-surface-2)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Database size={18} strokeWidth={1.5} color="var(--color-text-2)" />
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "var(--color-text-2)",
                textTransform: "uppercase",
              }}
            >
              자료 출처
            </div>
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              fontSize: 13.5,
              lineHeight: 1.9,
              color: "var(--color-text-2)",
            }}
          >
            <li>· Core Dataset v1 — 검수 완료 한자 2,060자 (NameForm 내부 큐레이션)</li>
            <li>· 대법원·네이버 인명용 한자 사전</li>
            <li>· Unicode Unihan 표준 (발음·획수·부수)</li>
            <li>· 만세력 기반 사주 4기둥 계산 (출생지 보정 포함)</li>
            <li>· 한국어 음운론 / 자원오행(획수) 이론</li>
          </ul>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section
          style={{
            marginTop: 64,
            textAlign: "center",
            paddingTop: 48,
            borderTop: "1px solid var(--color-divider)",
          }}
        >
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: "0 0 20px",
            }}
          >
            원리는 충분히 보셨다면, 이름을 살펴볼 차례입니다.
          </p>
          <div
            style={{
              display: "inline-flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Link
              href="/search"
              style={{
                padding: "12px 22px",
                background: "var(--color-navy)",
                color: "var(--color-background)",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              이름 추천받기 →
            </Link>
            <Link
              href="/evaluate"
              style={{
                padding: "12px 22px",
                border: "1.5px solid var(--color-teal)",
                color: "var(--color-teal)",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              이름 평가하기
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

// ============================================================
// 보조 컴포넌트
// ============================================================
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.18em",
        color: "var(--color-text-3)",
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 26,
        lineHeight: 1.3,
        fontWeight: 700,
        letterSpacing: "-0.015em",
        color: "var(--color-text)",
        margin: 0,
      }}
    >
      {children}
    </h2>
  );
}

function AxisCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-lg)",
        padding: "22px 22px 24px",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "var(--radius-md)",
          background: "var(--color-surface-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-2)",
          marginBottom: 14,
        }}
      >
        <Icon size={20} strokeWidth={1.5} />
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: 8,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </div>
      <p
        style={{
          fontSize: 13.5,
          lineHeight: 1.7,
          color: "var(--color-text-2)",
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function ScoreBlock({
  title,
  subtitle,
  rows,
  tail,
  accent,
}: {
  title: string;
  subtitle: string;
  rows: PillarRow[];
  tail: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-lg)",
        padding: "24px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: "var(--color-text-3)",
          }}
        >
          {subtitle}
        </div>
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: 12,
        }}
      >
        {rows.map((r) => (
          <li key={r.label}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-text)",
                }}
              >
                {r.label}
              </div>
              <div
                style={{
                  fontFamily: "Inter, var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: accent,
                  letterSpacing: "0.04em",
                }}
              >
                {r.weight}점
              </div>
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "var(--color-text-2)",
              }}
            >
              {r.detail}
            </div>
            {/* bar */}
            <div
              style={{
                marginTop: 8,
                height: 4,
                borderRadius: 999,
                background: "var(--color-surface-2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${r.weight}%`,
                  height: "100%",
                  background: accent,
                  opacity: 0.55,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px dashed var(--color-divider)",
          fontSize: 12,
          color: "var(--color-text-3)",
          lineHeight: 1.6,
        }}
      >
        {tail}
      </div>
    </div>
  );
}

function PrincipleBox({ card }: { card: PrincipleCard }) {
  const Icon = card.icon;
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 22px 22px",
        display: "flex",
        gap: 14,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: "var(--radius-md)",
          background: "var(--color-teal-50)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-teal)",
        }}
      >
        <Icon size={20} strokeWidth={1.5} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: 6,
            letterSpacing: "-0.005em",
          }}
        >
          {card.title}
        </div>
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.7,
            color: "var(--color-text-2)",
            margin: 0,
          }}
        >
          {card.body}
        </p>
      </div>
    </div>
  );
}

function DontRow({ text }: { text: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        background: "var(--color-surface-2)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <XCircle
        size={18}
        strokeWidth={1.5}
        style={{ flexShrink: 0, color: "#B5874C", marginTop: 1 }}
      />
      <span
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: "var(--color-text)",
        }}
      >
        {text}
      </span>
    </li>
  );
}

