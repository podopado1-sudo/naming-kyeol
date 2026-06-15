/**
 * Header — 사이트 헤더 (로고 + 네비게이션 + CTA)
 * Source: NameForm_design/src/Header.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState/useEffect → 명시적 import
 *   - Mark, Button → ./Mark, ./Primitives에서 import
 *   - onNav prop → Next.js Link 라우팅으로 변환 가능 (현재는 콜백 유지)
 */
"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { Mark } from "./Mark";
import { Heart, Menu, X } from "lucide-react";

type NavKey = "home" | "search" | "guide" | "method";

const NAV_ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: "home", label: "홈", href: "/" },
  { key: "search", label: "이름 찾기", href: "/search" },
  { key: "guide", label: "작명 가이드", href: "/guide" },
  { key: "method", label: "작명 원리", href: "/method" },
];

export function Header({
  current = "home",
  onNav,
}: {
  current?: NavKey;
  onNav?: (key: NavKey) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function linkStyle(active: boolean): CSSProperties {
    return {
      fontSize: 14,
      fontWeight: active ? 600 : 500,
      color: active ? "var(--color-navy)" : "var(--color-text-2)",
      textDecoration: "none",
      padding: "8px 4px",
      borderBottom: active
        ? "2px solid var(--color-navy)"
        : "2px solid transparent",
      transition: "color 180ms",
      whiteSpace: "nowrap",
      flexShrink: 0,
    };
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        // 항상 종이 배경을 깔아 Hero h1 등 본문이 비쳐서 겹쳐 보이는 문제 방지
        // (scrolled=true일 때만 살짝 더 진하게 + blur)
        background: scrolled
          ? "rgba(250,247,242,0.92)"
          : "var(--color-background)",
        backdropFilter: scrolled ? "blur(8px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(8px)" : "none",
        borderBottom: scrolled
          ? "1px solid var(--color-divider)"
          : "1px solid transparent",
        transition: "background 240ms, border-color 240ms",
      }}
    >
      <div
        className="site-header-inner"
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <Link
          href="/"
          onClick={() => onNav?.("home")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
          }}
        >
          <Mark size={36} />
          <div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 17,
                fontWeight: 700,
                color: "var(--color-text)",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
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
                whiteSpace: "nowrap",
              }}
            >
              NAMING.KYEOL
            </div>
          </div>
        </Link>

        <nav
          className="site-header-nav"
          style={{
            display: "flex",
            gap: 28,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => onNav?.(item.key)}
              style={linkStyle(current === item.key)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <Link
            href="/favorites"
            aria-label="저장한 이름"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-2)",
              textDecoration: "none",
            }}
          >
            <Heart size={14} strokeWidth={1.8} />
            <span className="site-header-fav-label">저장한 이름</span>
          </Link>
          <button
            type="button"
            className="site-header-burger"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              padding: 8,
              margin: 0,
              cursor: "pointer",
              color: "var(--color-text)",
              lineHeight: 0,
            }}
          >
            {menuOpen ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      {/* 모바일 전용 드롭다운 메뉴 (640px 이하에서만 노출) */}
      <div className={`site-header-mobile${menuOpen ? " open" : ""}`}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            onClick={() => {
              onNav?.(item.key);
              setMenuOpen(false);
            }}
            style={{
              color:
                current === item.key
                  ? "var(--color-navy)"
                  : "var(--color-text-2)",
              fontWeight: current === item.key ? 600 : 500,
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}

export default Header;
