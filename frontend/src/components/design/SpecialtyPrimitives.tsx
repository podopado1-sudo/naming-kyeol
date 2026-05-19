/**
 * SpecialtyPrimitives — Specialty 입력 페이지 공유 폼 atoms
 * Source: NameForm_design/src/SpecialtyPrimitives.jsx (Claude Design 산출물)
 */
"use client";

import type {
  ChangeEvent,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
} from "react";

// ============================================================
// 스타일 상수
// ============================================================
export const spField: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  color: "var(--color-text)",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  padding: "10px 12px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  minHeight: 40,
};

export const spLabel: CSSProperties = {
  fontSize: 12,
  color: "var(--color-text-2)",
  fontWeight: 500,
  marginBottom: 6,
  display: "block",
};

export const spHelper: CSSProperties = {
  fontSize: 12,
  color: "var(--color-text-3)",
  marginTop: 6,
  lineHeight: 1.5,
};

// ============================================================
// SPSection — 섹션 wrapper (eyebrow 막대 + 카드)
// ============================================================
export function SPSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            width: 20,
            height: 2,
            background: "var(--color-teal)",
            borderRadius: 1,
          }}
        />
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            margin: 0,
            color: "var(--color-text)",
          }}
        >
          {title}
        </h2>
      </div>
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          border: "1px solid var(--color-border)",
          padding: "22px 22px",
        }}
      >
        {children}
      </div>
    </section>
  );
}

// ============================================================
// SPField — 라벨 + 힌트 + children
// ============================================================
export function SPField({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={spLabel}>
        {label}
        {hint && (
          <span
            style={{
              color: "var(--color-text-3)",
              fontWeight: 400,
              marginLeft: 6,
            }}
          >
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// ============================================================
// SPInput — text input (props 통과)
// ============================================================
export function SPInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  return <input {...rest} style={{ ...spField, ...(style ?? {}) }} />;
}

// ============================================================
// SPSelect
// ============================================================
export function SPSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        ...spField,
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' stroke='%235a6b7a' stroke-width='1.3' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: 32,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ============================================================
// SPRadio — 카드형 라디오
// ============================================================
export function SPRadio({
  name,
  value,
  current,
  onChange,
  label,
  description,
}: {
  name: string;
  value: string;
  current: string;
  onChange: (v: string) => void;
  label: string;
  description?: string;
}) {
  const active = value === current;
  return (
    <label
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "10px 12px",
        border: `1px solid ${active ? "var(--color-teal)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        background: active ? "var(--color-teal-50)" : "var(--color-surface)",
        transition: "all 180ms cubic-bezier(.2,.6,.2,1)",
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          flexShrink: 0,
          marginTop: 2,
          border: `1.5px solid ${active ? "var(--color-teal)" : "var(--color-border)"}`,
          background: active ? "var(--color-teal)" : "transparent",
          boxShadow: active
            ? "inset 0 0 0 3px var(--color-teal-50)"
            : "none",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--color-text)",
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-2)",
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        )}
      </div>
      <input
        type="radio"
        name={name}
        checked={active}
        onChange={() => onChange(value)}
        style={{ display: "none" }}
      />
    </label>
  );
}

// ============================================================
// SPCheckbox — chip 형 체크박스
// ============================================================
export function SPCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: "8px 10px",
        border: `1px solid ${checked ? "var(--color-teal)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        background: checked ? "var(--color-teal-50)" : "var(--color-surface)",
        transition: "all 180ms cubic-bezier(.2,.6,.2,1)",
        fontSize: 13,
        color: "var(--color-text)",
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          flexShrink: 0,
          border: `1.5px solid ${checked ? "var(--color-teal)" : "var(--color-border)"}`,
          background: checked ? "var(--color-teal)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-6"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ display: "none" }}
      />
    </label>
  );
}

// ============================================================
// SPSlider — 좌우 라벨 슬라이더
// ============================================================
export function SPSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  leftLabel,
  rightLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div
        style={{
          position: "relative",
          height: 28,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 4,
            background: "var(--color-border)",
            borderRadius: 999,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            width: `${pct}%`,
            height: 4,
            background: "var(--color-teal)",
            borderRadius: 999,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: 28,
            appearance: "none",
            background: "transparent",
            cursor: "pointer",
            outline: "none",
            margin: 0,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--color-text-3)",
          marginTop: 2,
        }}
      >
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none; width: 18px; height: 18px; border-radius: 999px;
          background: #1F6E6B; border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.2); cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 999px;
          background: #1F6E6B; border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.2); cursor: pointer;
        }
      `}</style>
    </div>
  );
}
