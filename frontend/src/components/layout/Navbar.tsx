"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const individualMenus = [
  { label: "순우리말", href: "/pure-korean" },
  { label: "창의적 작명", href: "/creative" },
  { label: "3글자 이름", href: "/three-syllable" },
  { label: "필수 글자", href: "/required-char" },
  { label: "부모 기반", href: "/parent-based" },
  { label: "쌍둥이", href: "/twin" },
  { label: "영어+한자", href: "/dual-name" },
  { label: "특이 성씨", href: "/rare-surname" },
];

const individualHrefs = individualMenus.map((m) => m.href);

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pathname = usePathname();

  const isIndividualActive = individualHrefs.includes(pathname);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="text-lg font-bold tracking-tight">
          이름의 결
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/">
            <Button variant={pathname === "/" ? "default" : "ghost"} size="sm">
              스마트 추천
            </Button>
          </Link>

          {/* Dropdown: 개별 추천 */}
          <div
            className="relative"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <Button
              variant={isIndividualActive ? "default" : "ghost"}
              size="sm"
              className="gap-1"
              onClick={() => setDropdownOpen((v) => !v)}
            >
              개별 추천
              <ChevronDown className="size-3.5" />
            </Button>
            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border bg-popover p-1 shadow-md">
                {individualMenus.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-md px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setDropdownOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href="/analysis">
            <Button variant={pathname === "/analysis" ? "default" : "ghost"} size="sm">
              이름 분석
            </Button>
          </Link>

          <Link href="/evaluate">
            <Button variant={pathname === "/evaluate" ? "default" : "ghost"} size="sm">
              상세 평가
            </Button>
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="메뉴 열기"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t bg-background px-4 pb-4 pt-2 md:hidden">
          <Link
            href="/"
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
              pathname === "/" && "bg-accent text-accent-foreground"
            )}
            onClick={() => setMobileOpen(false)}
          >
            스마트 추천
          </Link>

          <div className="mt-1">
            <p
              className={cn(
                "px-3 py-1.5 text-xs font-medium text-muted-foreground",
                isIndividualActive && "text-foreground"
              )}
            >
              개별 추천
            </p>
            {individualMenus.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-md px-6 py-1.5 text-sm hover:bg-accent",
                  pathname === item.href && "bg-accent text-accent-foreground"
                )}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <Link
            href="/analysis"
            className={cn(
              "mt-1 block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
              pathname === "/analysis" && "bg-accent text-accent-foreground"
            )}
            onClick={() => setMobileOpen(false)}
          >
            이름 분석
          </Link>

          <Link
            href="/evaluate"
            className={cn(
              "mt-1 block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
              pathname === "/evaluate" && "bg-accent text-accent-foreground"
            )}
            onClick={() => setMobileOpen(false)}
          >
            상세 평가
          </Link>
        </nav>
      )}
    </header>
  );
}
