import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Mail, MessageSquare, Bug, Lightbulb } from "lucide-react";

const TOPICS = [
  {
    icon: Bug,
    title: "버그 / 오류 신고",
    body: "점수가 이상하거나, 한자 의미가 틀렸거나, 페이지가 깨지는 경우 알려주세요.",
  },
  {
    icon: Lightbulb,
    title: "기능 제안",
    body: "원하는 기능이나 개선 아이디어가 있으면 자유롭게 보내주세요.",
  },
  {
    icon: MessageSquare,
    title: "일반 문의",
    body: "서비스 이용 방법이나 알고리즘에 대해 궁금한 점을 남겨주세요.",
  },
];

export default function ContactPage() {
  return (
    <>
      <Header />
      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "64px 24px 80px",
        }}
      >
        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
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
            Contact
          </p>
          <h1
            style={{
              fontSize: "clamp(26px, 5vw, 36px)",
              fontWeight: 700,
              color: "var(--color-text)",
              lineHeight: 1.3,
              marginBottom: 16,
            }}
          >
            문의하기
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--color-text-2)",
              lineHeight: 1.8,
            }}
          >
            버그 신고, 기능 제안, 일반 문의는 이메일로 보내주세요.
            최대한 빠르게 확인하겠습니다.
          </p>
        </div>

        {/* 이메일 CTA */}
        <a
          href="mailto:podopado1@gmail.com"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "var(--color-navy)",
            color: "#fff",
            borderRadius: 12,
            padding: "20px 24px",
            textDecoration: "none",
            marginBottom: 40,
            transition: "opacity 0.15s",
          }}
        >
          <Mail size={20} strokeWidth={1.8} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              podopado1@gmail.com
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
              이메일로 문의하기
            </div>
          </div>
        </a>

        {/* 문의 유형 */}
        <div
          style={{
            display: "grid",
            gap: 16,
            marginBottom: 48,
          }}
        >
          {TOPICS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              style={{
                display: "flex",
                gap: 16,
                background: "var(--color-surface)",
                border: "1px solid var(--color-divider)",
                borderRadius: 10,
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--color-navy-50)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                }}
              >
                <Icon size={16} color="var(--color-navy)" strokeWidth={1.8} />
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "var(--color-text)",
                    marginBottom: 4,
                  }}
                >
                  {title}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-2)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 안내 */}
        <div
          style={{
            borderRadius: 10,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-divider)",
            padding: "16px 20px",
            fontSize: 13,
            color: "var(--color-text-2)",
            lineHeight: 1.7,
          }}
        >
          개인 프로젝트이므로 응답이 늦어질 수 있습니다.
          한자 오행 데이터 오류나 점수 이상은 최대한 반영하겠습니다.
        </div>
      </main>
      <Footer />
    </>
  );
}
