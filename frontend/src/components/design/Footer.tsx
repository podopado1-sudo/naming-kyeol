/**
 * Footer — 사이트 푸터 (브랜드 + 3개 컬럼 + 저작권)
 * 헤더 nav와 용어를 통일하고, 실제 라우트가 있는 곳만 연결.
 * 미준비 항목은 "준비 중" 표시.
 */
import Link from "next/link";
import { Mark } from "./Mark";

interface FooterLink {
  label: string;
  href?: string; // undefined = 준비 중 (비활성)
  badge?: "soon";
}

const SERVICE_LINKS: FooterLink[] = [
  { label: "이름 추천", href: "/search" },
  { label: "이름 평가", href: "/evaluate" },
  { label: "이름 분석", href: "/analysis" },
  { label: "쌍둥이 작명", href: "/twin" },
  { label: "한·영 이중 이름", href: "/dual-name" },
  { label: "희귀 성씨", href: "/rare-surname" },
];

const GUIDE_LINKS: FooterLink[] = [
  // 헤더 nav와 동일 라벨 — 일관성 유지
  { label: "작명 가이드", href: "/guide" },
  { label: "작명 원리", href: "/method" },
];

const COMPANY_LINKS: FooterLink[] = [
  { label: "소개", href: "/about" },
  { label: "문의", href: "/contact" },
];

function FootLink({ link }: { link: FooterLink }) {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: link.href ? "var(--color-text-2)" : "var(--color-text-3)",
    textDecoration: "none",
    padding: "4px 0",
    cursor: link.href ? "pointer" : "default",
  };
  const inner = (
    <>
      {link.label}
      {link.badge === "soon" && (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 500,
            color: "var(--color-text-3)",
            background: "var(--color-divider)",
            padding: "1px 6px",
            borderRadius: 999,
            letterSpacing: "0.06em",
          }}
        >
          준비 중
        </span>
      )}
    </>
  );
  if (link.href) {
    return (
      <Link href={link.href} style={baseStyle}>
        {inner}
      </Link>
    );
  }
  return <span style={baseStyle}>{inner}</span>;
}

function Column({
  title,
  links,
}: {
  title: string;
  links: FooterLink[];
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text)",
          marginBottom: 14,
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </div>
      <div style={{ display: "grid", gap: 2 }}>
        {links.map((l) => (
          <FootLink key={l.label} link={l} />
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-divider)",
        background: "var(--color-surface-2)",
        padding: "48px 32px 40px",
        marginTop: 64,
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr",
          gap: 40,
        }}
      >
        {/* 브랜드 */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Mark size={28} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>이름의 결</div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text-3)",
                  letterSpacing: "0.04em",
                  marginTop: -2,
                }}
              >
                Naming.kyeol
              </div>
            </div>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-2)",
              lineHeight: 1.7,
              margin: 0,
              maxWidth: 320,
            }}
          >
            발음·의미·세대 중립을 기준으로 이름을 살펴봅니다.
            <br />
            결이 고운 이름은 시간이 흐를수록 그 가치를 증명합니다.
          </p>
        </div>

        <Column title="서비스" links={SERVICE_LINKS} />
        <Column title="둘러보기" links={GUIDE_LINKS} />
        <Column title="회사" links={COMPANY_LINKS} />
      </div>

      <div
        style={{
          maxWidth: 1120,
          margin: "40px auto 0",
          paddingTop: 20,
          borderTop: "1px solid var(--color-divider)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--color-text-3)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>© 2026 이름의 결 · Naming.kyeol</div>
        <div>개인정보처리방침 · 이용약관</div>
      </div>
    </footer>
  );
}

export default Footer;
