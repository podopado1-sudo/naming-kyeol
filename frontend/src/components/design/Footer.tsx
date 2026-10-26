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
  // 상호 작명 — 헤더·푸터 어디에도 링크가 없어 /guide 한 곳에서만 닿던 것(2026-10-21)
  { label: "회사·가게 이름", href: "/company" },
];

const GUIDE_LINKS: FooterLink[] = [
  // 헤더 nav와 동일 라벨 — 일관성 유지
  { label: "작명 가이드", href: "/guide" },
  // 출생신고 통계 리포트 5편 — /guide 안의 목록으로 바로 (2026-10-21)
  { label: "데이터 리포트", href: "/guide#reports" },
  { label: "작명 원리", href: "/method" },
  { label: "인명용 한자 사전", href: "/hanja" },
  { label: "이름 뜻 사전", href: "/name" },
];

const COMPANY_LINKS: FooterLink[] = [
  { label: "소개", href: "/about" },
  { label: "문의", href: "/contact" },
  { label: "개인정보처리방침", href: "/privacy" },
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
            // 옛 divider(검정 8%) 바탕은 종이 위 text-3 4.41:1 — surface-2 4.86:1(2026-10-26 팔레트 #2 보완, 지금은 쓰는 링크 없음)
            background: "var(--color-surface-2)",
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
        borderTop: "1px solid var(--color-ink-qing)",
        background: "var(--color-background)",
        padding: "48px 32px 40px",
        marginTop: 64,
      }}
    >
      <div
        className="sumi-footer-grid"
        style={{
          maxWidth: 1120,
          margin: "0 auto",
        }}
      >
        {/* 브랜드 */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Mark size={32} />
            <div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "var(--color-text)",
                  letterSpacing: "-0.01em",
                }}
              >
                이름의 결
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--color-text-3)",
                  letterSpacing: "0.08em",
                  marginTop: -1,
                }}
              >
                NAMING.KYEOL
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
        {/* 이용약관 페이지는 없다 — 링크 없는 글자로 두지 않는다(2026-10-21) */}
        <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
          개인정보처리방침
        </Link>
      </div>
    </footer>
  );
}

export default Footer;
