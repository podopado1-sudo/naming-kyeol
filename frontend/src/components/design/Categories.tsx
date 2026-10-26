/**
 * Categories — 라이프 컨텍스트 4개 카드 (아기/개명/회사명/반려동물)
 * Source: NameForm_design/src/Categories.jsx (Claude Design 산출물)
 *
 * 2026-10-21: 카드가 <a href="#"> + onClick→router.push라 크롤러가 /company 등을 따라가지
 * 못했다(감사 DD-1). 경로가 있는 카드는 실제 href의 next/link로, 경로가 없는 반려동물만
 * href="#" + 준비 중 모달을 유지한다. 모달은 홈이 서버 컴포넌트가 되며 여기로 옮겼다.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { ComingSoonModal } from "./ComingSoonModal";

export type CategoryKey = "baby" | "rename" | "company" | "pet";

export interface CategoryItem {
  key: CategoryKey;
  title: string;
  copy: string;
  status: "live" | "coming";
  /** 이동할 경로 — coming 카드는 없음 */
  href?: string;
  /** 하단 행동 문구 (기본: 자세히 보기) */
  cta?: string;
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
    href: "/search",
    hanja: "兒",
    reading: "아이",
  },
  {
    // 개명 전용 화면은 없다 — 예전 /search?mode=rename은 /search가 mode를 읽지 않아 그냥 추천 폼이었다.
    // 지금 이름과 새 후보를 같은 기준으로 견줄 수 있는 평가로 보낸다 (감사 DD-4)
    key: "rename",
    title: "개명",
    copy: "지금 이름과 새 후보를 같은 기준으로",
    status: "live",
    href: "/evaluate",
    cta: "이름 평가하기",
    hanja: "改",
    reading: "개명",
  },
  {
    key: "company",
    title: "회사·가게 이름",
    copy: "오래 불릴 이름의 결",
    status: "live",
    href: "/company",
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

export function Categories() {
  const [hover, setHover] = useState<CategoryKey | null>(null);
  const [petOpen, setPetOpen] = useState(false);

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
      <div className="sumi-grid-4">
        {ITEMS.map((it) => {
          const isHover = hover === it.key;
          const isComing = it.status === "coming";
          const cardStyle: React.CSSProperties = {
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
            // 준비 중 카드는 카드 전체 opacity(옛 0.78) 대신 큰 한자·제목 색만 옅게 — 'Coming'·읽기 음 11px text-3 글자가
            // 반투명 탓에 3.33:1 로 AA 아래였다(2026-10-26 팔레트 #2 보완). 상태는 'Coming' 라벨이 글로 알린다
          };
          const hoverProps = {
            onMouseEnter: () => setHover(it.key),
            onMouseLeave: () => setHover(null),
          };
          const body = (
            <CardBody item={it} isHover={isHover} isComing={isComing} />
          );
          return it.href ? (
            <Link key={it.key} href={it.href} {...hoverProps} style={cardStyle}>
              {body}
            </Link>
          ) : (
            <a
              key={it.key}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setPetOpen(true);
              }}
              {...hoverProps}
              style={cardStyle}
            >
              {body}
            </a>
          );
        })}
      </div>

      {petOpen && (
        <ComingSoonModal
          mode="pet"
          open={true}
          onClose={() => setPetOpen(false)}
        />
      )}
    </section>
  );
}

function CardBody({
  item: it,
  isHover,
  isComing,
}: {
  item: CategoryItem;
  isHover: boolean;
  isComing: boolean;
}) {
  return (
    <>
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
          color: isComing ? "var(--color-text-2)" : "var(--color-text)",
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
          color: isComing ? "var(--color-text-2)" : "var(--color-text)",
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
        {isComing ? "알림 받기" : (it.cta ?? "자세히 보기")}
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
    </>
  );
}

export default Categories;
