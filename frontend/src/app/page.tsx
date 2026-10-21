import Link from "next/link";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Hero } from "@/components/design/Hero";
import { Categories } from "@/components/design/Categories";
import { ProPaths } from "@/components/design/ProPaths";
import { WhyKyeol } from "@/components/design/WhyKyeol";
import { BrushDivider } from "@/components/design/BrushDivider";
import { ApiWarmup } from "@/components/design/ApiWarmup";
import { getAllInsights, type InsightMeta } from "@/lib/insights";

/**
 * 홈 — 서버 컴포넌트 (2026-10-21).
 *
 * 데이터 리포트 목록(content/insights/*.md)을 빌드 타임에 읽어 정적 HTML에 싣는다 —
 * 홈에서 /guide/[slug]로 가는 링크가 0개라 심사 근거가 될 편집 글이 2클릭 아래에 묻혀 있었다(감사 AS-8).
 * 인터랙션(Hero 이동·반려동물 준비 중 모달)은 각 클라이언트 컴포넌트가 스스로 처리한다.
 */
export default function HomePage() {
  const reports = getAllInsights();

  return (
    <>
      <Header current="home" />

      <main>
        <Hero />
        <BrushDivider />
        <Categories />
        <BrushDivider />
        <ProPaths />
        {reports.length > 0 && (
          <>
            <BrushDivider />
            <InsightReports reports={reports} />
          </>
        )}
        <WhyKyeol />
      </main>

      <Footer />
      <ApiWarmup />
    </>
  );
}

// ============================================================
// 데이터로 읽는 이름 — 리포트 카드 (서버 렌더)
// ============================================================
function InsightReports({ reports }: { reports: InsightMeta[] }) {
  return (
    <section
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "40px 32px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 22,
              lineHeight: 1.3,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            데이터로 읽는 이름
          </h2>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--color-text-2)",
              margin: "8px 0 0",
              lineHeight: 1.6,
            }}
          >
            대법원 출생신고 통계와 인명용 한자 사전을 직접 집계해 쓴
            리포트입니다.
          </p>
        </div>
        <Link
          href="/guide#reports"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-teal)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          리포트 전체 보기 →
        </Link>
      </div>

      <ul
        className="sumi-grid-3"
        style={{ listStyle: "none", margin: 0, padding: 0 }}
      >
        {reports.map((r) => (
          <li key={r.slug} style={{ display: "flex" }}>
            <Link
              href={`/guide/${r.slug}`}
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)",
                padding: "20px 22px",
                textDecoration: "none",
                color: "var(--color-text)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  color: "var(--color-text-3)",
                  marginBottom: 6,
                }}
              >
                {r.eyebrow}
              </span>
              <span
                style={{
                  fontSize: 15.5,
                  fontWeight: 600,
                  lineHeight: 1.45,
                  letterSpacing: "-0.005em",
                  marginBottom: 8,
                  wordBreak: "keep-all",
                }}
              >
                {r.title}
              </span>
              <span
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--color-text-2)",
                  flex: 1,
                }}
              >
                {r.description}
              </span>
              <span
                style={{
                  marginTop: 14,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-teal)",
                }}
              >
                리포트 읽기 →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
