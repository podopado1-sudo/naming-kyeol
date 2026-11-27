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
import { adBoundaryPrefetch } from "@/lib/ad-scope";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Mark } from "./Mark";
import { Heart, Menu, X } from "lucide-react";
import {
  HEADER_DEFAULT_CURRENT,
  NAV_ITEMS,
  type CurrentKey,
  type NavKey,
} from "./header-nav";

/**
 * 모바일 메뉴(640px 이하)를 닫는 때 — 2026-11-27 mobile-menu-stays-open.
 * 예전에는 버튼·메뉴 링크를 누를 때만 닫혀, 연 채 스크롤하면 sticky 머리말이 메뉴만큼 길어진 채 본문 위쪽을 가리고 따라왔다.
 * 지금은 ① Esc ② 머리말 바깥 누름(pointerdown — 터치 스크롤의 시작도 여기 든다) ③ 연 자리에서 MENU_CLOSE_SCROLL_PX 넘게 스크롤
 * ④ 경로 변경 때 닫힌다. 여닫기 버튼에는 aria-expanded·aria-controls(메뉴 id)를 단다.
 * 메뉴는 머리말 아래에 겹쳐 그린다(position: absolute — sticky 머리말이 기준 상자). 머리말 안 블록이던 때는 메뉴를 닫으면
 * 머리말이 메뉴 높이(약 215px)만큼 줄어 본문이 올라갔는데, ② 는 누름(pointerdown) 때 닫고 휴대폰은 손을 뗀 뒤 그 자리를 다시 찾아
 * click 을 보내므로, 본문을 눌러 메뉴를 닫으면 그만큼 아래에 있던 다른 카드·입력 칸이 눌렸다. 겹쳐 그리면 닫아도 본문이 움직이지 않는다.
 */
const MENU_CLOSE_SCROLL_PX = 40;

// 메뉴에 없는 화면(/company·/hanja·/name·/analysis 등)은 "none" — 어떤 메뉴도 켜지 않는다(기본값, header-nav.ts)
export function Header({
  current = HEADER_DEFAULT_CURRENT,
  onNav,
}: {
  current?: CurrentKey;
  onNav?: (key: NavKey) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // ④ 경로가 바뀌면 닫는다 — 렌더 중에 앞 경로와 견주어 바로 맞춘다(React 'prop 이 바뀔 때 state 맞추기' 방식, 효과를 한 번 더 돌리지 않는다).
  // 머리말이 이동 뒤에도 그대로 남는 경우(같은 틀의 다른 쪽 — /guide/가 → /guide/나)에도 닫힌다
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 메뉴가 열려 있을 때만 거는 닫기 감시(위 머리말 ①~③)
  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = () => setMenuOpen(false);
    // 메뉴가 본문 위에 겹쳐 열려 화면 배치가 바뀌지 않으므로, 연 순간의 스크롤 위치가 그대로 기준이다
    const baseY = window.scrollY;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // 메뉴 안 링크에 초점이 있었다면 여는 버튼으로 돌려 둔다(닫힌 메뉴에 초점이 남지 않게)
      const focusInMenu = menuRef.current?.contains(document.activeElement) ?? false;
      closeMenu();
      if (focusInMenu) burgerRef.current?.focus();
    }
    function onPointerDown(e: PointerEvent) {
      // 머리말 안(메뉴·여닫기 버튼·로고·저장한 이름)은 제 동작에 맡긴다
      if (e.target instanceof Node && headerRef.current?.contains(e.target)) return;
      closeMenu();
    }
    function onScroll() {
      if (Math.abs(window.scrollY - baseY) > MENU_CLOSE_SCROLL_PX) closeMenu();
    }
    // 키보드 초점이 머리말 밖으로 나가면 닫는다 — 메뉴가 본문 위에 겹쳐 그려져, Tab 으로 마지막 메뉴 링크를 지나면
    // 초점이 메뉴 밑에 가려진 본문 요소로 가 보이지 않았다(검토 지적 — WCAG 2.4.11 초점 가림)
    function onFocusIn(e: FocusEvent) {
      if (e.target instanceof Node && headerRef.current?.contains(e.target)) return;
      closeMenu();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("scroll", onScroll);
    };
  }, [menuOpen]);

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
      ref={headerRef}
      // 인쇄에서 숨긴다 — 전역 인쇄 규칙이 모든 <header> 대신 사이트 머리말만 숨기게 좁혀져도 이 머리말은 빠진다(globals.css [data-hide-print])
      data-hide-print
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
          prefetch={adBoundaryPrefetch(pathname ?? "", "/")}
          href="/"
          onClick={() => {
            onNav?.("home");
            setMenuOpen(false);
          }}
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
              prefetch={adBoundaryPrefetch(pathname ?? "", item.href)}
              onClick={() => onNav?.(item.key)}
              aria-current={current === item.key ? "page" : undefined}
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
            prefetch={adBoundaryPrefetch(pathname ?? "", "/favorites")}
            href="/favorites"
            aria-label="저장한 이름"
            onClick={() => setMenuOpen(false)}
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
            ref={burgerRef}
            type="button"
            className="site-header-burger"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
            aria-controls={menuId}
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

      {/* 모바일 전용 드롭다운 메뉴 (640px 이하에서만 노출) — 본문 위에 겹쳐 그린다(여닫아도 본문이 움직이지 않게, 위 머리말 주석) */}
      <div
        ref={menuRef}
        id={menuId}
        className={`site-header-mobile${menuOpen ? " open" : ""}`}
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          zIndex: 1,
          // 겹친 메뉴의 아래 끝을 본문과 가른다(마지막 링크는 밑줄이 없다 — globals.css)
          borderBottom: "1px solid var(--color-divider)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            prefetch={adBoundaryPrefetch(pathname ?? "", item.href)}
            onClick={() => {
              onNav?.(item.key);
              // 지금 화면과 같은 주소(홈에서 '홈')는 경로가 그대로라 여기서 닫는다
              setMenuOpen(false);
            }}
            aria-current={current === item.key ? "page" : undefined}
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
