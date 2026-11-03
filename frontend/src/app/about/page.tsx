import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/og";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Compass, BookOpen, Feather, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "서비스 소개 — 이름의 결을 만든 이유",
  description:
    "이름의 결은 미학 우선·사전 충실형 한자·유행 배제·투명한 알고리즘 네 가지 원칙으로 한국어 이름을 추천합니다. 9,105자 한자 사전과 미학 70% + 조화 30% 공식으로 만든 이유를 소개합니다.",
  alternates: { canonical: "/about" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "서비스 소개 — 이름의 결",
    description:
      "미학 우선·사전 충실형 한자·유행 배제·투명한 알고리즘 — 이름의 결을 만든 네 가지 원칙",
    url: "/about",
  },
};

const VALUES = [
  {
    icon: Compass,
    title: "미학 우선",
    body: "발음·리듬·세대 중립성을 핵심 기준으로 삼습니다. 입에 붙고 시대를 타지 않는 이름이 좋은 이름이라는 믿음에서 출발했습니다.",
  },
  {
    icon: BookOpen,
    title: "사전 충실형 한자",
    body: "9,105자의 인명용 한자 사전을 기반으로 합니다. 글자는 대법원·네이버 인명용 한자 목록에서, 뜻은 공개된 한자 사전 자료에서 가져왔고, 획수는 유니코드 표준으로, 자원오행은 부수 기준으로 정리했습니다. 자료마다 값이 갈리는 글자는 '이견 있음'으로 밝히고, 뜻이 부정적인 한자는 이름 후보에서 뺍니다.",
  },
  {
    icon: Feather,
    title: "유행 배제",
    body: "특정 연대에만 쏠린 이름은 자동 감점됩니다. 어떤 시대에 태어나도 어색하지 않을 이름을 목표로 합니다.",
  },
  {
    icon: ShieldCheck,
    title: "투명한 알고리즘",
    body: "점수 구성과 가중치를 숨기지 않습니다. 미학 70% + 조화 30% 공식을 비롯해 점수의 판단 근거를 작명 원리 페이지에서 확인할 수 있습니다.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Header />
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "64px 24px 80px",
        }}
      >
        {/* Hero */}
        <div style={{ marginBottom: 56 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "var(--color-teal)",
              marginBottom: 16,
              textTransform: "uppercase",
            }}
          >
            About
          </p>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 700,
              color: "var(--color-text)",
              lineHeight: 1.3,
              marginBottom: 20,
            }}
          >
            이름의 결을 만든 이유
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "var(--color-text-2)",
              lineHeight: 1.8,
              maxWidth: 600,
            }}
          >
            아이에게 이름을 지어줄 때 부모는 많은 것을 고민합니다.
            예쁜 발음, 좋은 한자 의미, 또래와 겹치지 않을 독창성 — 그리고
            수십 년이 지나도 어색하지 않은 이름.
            이름의 결은 그 고민을 수치로 풀어보려는 시도입니다.
          </p>
        </div>

        {/* 가치 그리드 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 24,
            marginBottom: 56,
          }}
        >
          {VALUES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-divider)",
                borderRadius: 12,
                padding: "24px 24px 28px",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--color-navy-50)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Icon size={18} color="var(--color-navy)" strokeWidth={1.8} />
              </div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 15,
                  marginBottom: 8,
                  color: "var(--color-text)",
                }}
              >
                {title}
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--color-text-2)",
                  lineHeight: 1.75,
                  margin: 0,
                }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>

        {/* 한 줄 철학 */}
        <div
          style={{
            borderLeft: "3px solid var(--color-teal)",
            paddingLeft: 20,
            marginBottom: 48,
          }}
        >
          <p
            style={{
              fontSize: 15,
              color: "var(--color-text-2)",
              lineHeight: 1.8,
              margin: 0,
              fontStyle: "italic",
            }}
          >
            &ldquo;사주로 이름을 만들지 않는다. 먼저 미학적으로 좋은 이름을 고르고,
            조화 점수로 추천률을 조정한다.&rdquo;
          </p>
        </div>

        {/* 만드는 방식 — AI 사용 공개(2026-11-03). id 는 /method §05·리포트 머리 줄이 거는 앵커(/about#ai) — 바꾸지 말 것.
            사람·전문가 검토 문장, '글마다 읽지 않는다' 같은 문장은 쓰지 않는다(실제로 하지 않는 일·같은 사용자의 다른 사이트 결정과 같음) */}
        <section
          id="ai"
          style={{
            marginBottom: 48,
            scrollMarginTop: 80,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: 12,
            }}
          >
            만드는 방식 (AI 사용)
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text-2)",
              lineHeight: 1.8,
              margin: "0 0 12px",
            }}
          >
            점수는 규칙으로 계산합니다. 미학·조화 점수와 그 근거 줄은{" "}
            <a
              href="/method"
              style={{ color: "var(--color-teal)", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              작명 원리
            </a>
            에 적은 공식대로 프로그램이 계산합니다. 사이트와 추천·평가 엔진, 한자·통계 자료를
            정리하는 프로그램은 운영자가 AI 코딩 도구를 활용해 만듭니다.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text-2)",
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            문장은 AI 도구로 씁니다. 이름 뜻 사전과 창의 작명 결과에 나오는 한 줄 뜻과 서사,
            한자 조합 뜻(한자 훈을 이어 풀어 쓴 문장), 한자 사전 글자 페이지의 글자 풀이,
            작명 가이드와 데이터 리포트의 본문은 AI 도구로 지은 문장입니다. 리포트 표의 수치는
            프로그램이 출생신고 통계와 한자 사전 자료에서 계산해 넣습니다. 이름 뜻 문장에 그
            페이지 한자 조합에 없는 한자의 훈(연꽃·별 같은 낱말)이 나오는지 찾아, 나오면 1순위
            조합 뜻으로 바꾸는 점검 프로그램을 데이터를 만들 때마다 돌립니다. 이 문장들은 점수
            계산에 쓰지 않습니다.
          </p>
        </section>

        {/* 개발자 노트 */}
        <div
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-divider)",
            borderRadius: 12,
            padding: "28px 28px 32px",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--color-text)",
              marginBottom: 12,
            }}
          >
            개발자 노트
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-2)",
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            이름의 결(이름의결 · namingkyeol)은 한 명의 개발자가 취미로 시작한 프로젝트입니다.
            학술적 작명론이나 특정 역술 유파를 대변하지 않으며,
            완성도 높은 제품을 목표로 지속적으로 개선 중입니다.
            이름이 비슷한 &lsquo;이름결&rsquo; 작명소·앱과는 관련이 없습니다.
            오류나 제안이 있으면{" "}
            <a
              href="/contact"
              style={{ color: "var(--color-teal)", textDecoration: "none" }}
            >
              문의 페이지
            </a>
            를 통해 알려주세요.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
