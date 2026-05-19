/**
 * 디자인 시스템 공통 primitives
 * Source: NameForm_design/src/Primitives.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState/useRef/useEffect → 명시적 import
 *   - window.lucide CDN → lucide-react 모듈 동적 lookup
 *   - window.X 글로벌 등록 → ES Module export
 */
"use client";

import { CSSProperties, ReactNode, useState } from "react";
import * as LucideIcons from "lucide-react";

// ============================================================
// Button — primary / secondary / ghost
// ============================================================
type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  onClick,
  disabled,
  style,
  type = "button",
}: ButtonProps) {
  const [hover, setHover] = useState(false);

  const base: CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    borderRadius: "var(--radius-md)",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 180ms cubic-bezier(.2,.6,.2,1)",
    letterSpacing: "-0.01em",
    opacity: disabled ? 0.4 : 1,
    fontSize: size === "sm" ? 14 : 15,
    padding: size === "sm" ? "8px 16px" : "12px 22px",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };

  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: {
      background: "var(--color-navy)",
      color: "var(--color-background)",
    },
    secondary: {
      background: "transparent",
      color: "var(--color-teal)",
      border: "1.5px solid var(--color-teal)",
    },
    ghost: {
      background: "transparent",
      color: "var(--color-text)",
      padding: "12px 8px",
      borderRadius: 0,
      textDecoration: "underline",
      textUnderlineOffset: 4,
      textDecorationThickness: 1,
    },
  };

  const hoverStyles: Record<ButtonVariant, CSSProperties> = {
    primary: { background: "var(--color-navy-600)" },
    secondary: { background: "var(--color-teal-50)" },
    ghost: { color: "var(--color-teal)" },
  };

  const hoverStyle = hover && !disabled ? hoverStyles[variant] : {};

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...hoverStyle, ...style }}
    >
      {children}
    </button>
  );
}

// ============================================================
// Badge — teal / navy / gold / neutral
// ============================================================
type BadgeKind = "teal" | "navy" | "gold" | "neutral";

interface BadgeProps {
  kind?: BadgeKind;
  children: ReactNode;
}

export function Badge({ kind = "teal", children }: BadgeProps) {
  const styles: Record<BadgeKind, CSSProperties> = {
    teal: {
      background: "var(--color-teal-50)",
      color: "var(--color-teal)",
    },
    navy: {
      background: "var(--color-navy-50)",
      color: "var(--color-navy)",
    },
    gold: {
      background: "var(--color-gold-100)",
      color: "#6F5421",
      border: "1px solid rgba(201,169,110,.5)",
    },
    neutral: {
      background: "transparent",
      color: "var(--color-text-2)",
      border: "1px solid var(--color-border)",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: "var(--radius-sm)",
        fontSize: 12,
        fontWeight: 500,
        ...styles[kind],
      }}
    >
      {children}
    </span>
  );
}

// ============================================================
// Tag — Badge teal alias
// ============================================================
export function Tag({ children }: { children: ReactNode }) {
  return <Badge kind="teal">{children}</Badge>;
}

// ============================================================
// ScoreRing — 점수 표시 (90+/80+/그 외)
// ============================================================
export function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 90
      ? "var(--color-score-high)"
      : score >= 80
        ? "var(--color-score-mid)"
        : "var(--color-score-low)";

  return (
    <div style={{ textAlign: "right" }}>
      <div
        style={{
          fontFamily: "Inter",
          fontSize: 40,
          fontWeight: 700,
          lineHeight: 1,
          color,
          letterSpacing: "-0.02em",
        }}
      >
        {score}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--color-text-2)",
          marginTop: 4,
          letterSpacing: "0.08em",
        }}
      >
        BALANCE
      </div>
    </div>
  );
}

// ============================================================
// Icon — lucide-react 동적 lookup (kebab-case 또는 PascalCase 지원)
// ============================================================
interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export function Icon({
  name,
  size = 20,
  color = "currentColor",
  strokeWidth = 1.5,
  style,
}: IconProps) {
  const pascalName = toPascalCase(name);
  const IconComponent = (LucideIcons as Record<string, unknown>)[
    pascalName
  ] as React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
    style?: CSSProperties;
  }> | undefined;

  if (!IconComponent) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[design/Icon] lucide-react에 "${pascalName}" 아이콘이 없어요.`);
    }
    return (
      <span
        style={{
          width: size,
          height: size,
          display: "inline-block",
          ...style,
        }}
      />
    );
  }

  return (
    <IconComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={{ display: "inline-flex", ...style }}
    />
  );
}
