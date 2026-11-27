/**
 * TwinResultTop — Twin Result primitives
 * Source: NameForm_design/src/TwinResultTop.jsx (Claude Design 산출물)
 *
 * Exports: TwinSubHeader, ThemeTabs, ThemeBanner, CoherenceHero
 */
"use client";

import { Button } from "./Primitives";
import { twinConditionChips } from "@/lib/twin-sets";

// ============================================================
// 공유 타입 (Twin 페이지 전체에서 사용)
// ============================================================
export type TwinThemeKey = "shared_char" | "shared_meaning" | "shared_tone";
export type TwinSharedType = "char" | "meaning" | "tone";

/**
 * 결과 화면의 조건 — /twin 이 **제출 때** 잡은 값(요청에 실은 값 그대로)이다. 응답을 기다리는 동안 폼을 고쳐도 바뀌지 않는다.
 * 예전 꼴(relation 'same'|'mixed'|'any')은 폼에 없는 값이라 늘 'any' → 칩 '미지정'이었다(2026-11-27 — 성별로 바꿈).
 */
export interface TwinContext {
  /** 다듬은 성(요청에 보낸 값) */
  lastName: string;
  /** 자녀 수(2·3) */
  count: number;
  gender: "none" | "male" | "female";
  tone: "soft" | "neutral" | "strong";
  /** YYYY-MM-DD — /twin 은 서버 필수라 비어 있지 않다 */
  birthDate: string;
  /** HH:mm, "" = 미입력 */
  birthTime: string;
}

export interface TwinThemeBlock {
  /** 세트마다 다른 값 — 같은 테마의 세트가 여럿이라 key(테마)로는 세트를 가릴 수 없다 */
  id: string;
  key: TwinThemeKey;
  label: string;
  description: string;
  coherence: number;
  coherenceNote: string;
  shared: { type: TwinSharedType; value: string };
  pair: TwinPairEntry[];
}

export interface TwinPairEntry {
  position: string;
  first: string;
  sharedIndex?: number[];
  sharedMeaning?: string;
  scores: { aesthetic: number; harmony: number; final: number };
  reasons: string[];
}

// ============================================================
// TwinSubHeader — 입력 요약 chip (+ 저장 단추를 넘기면 그 단추)
// '↻ 새로 생성'은 지웠다(2026-11-27) — 쌍둥이 엔진은 같은 입력에 같은 세트를 돌려줘 다시 만들지 않고 입력 폼으로 돌아가기만 했다.
// 폼으로 돌아가는 길은 위 머리의 '← 조건 수정' 하나다.
// ============================================================
export function TwinSubHeader({
  ctx,
  onSave,
}: {
  ctx: TwinContext;
  onSave?: () => void;
}) {
  const chips = twinConditionChips(ctx);

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        padding: "12px 0",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          {chips.map((c, i) => (
            <span
              key={i}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text-2)",
                background: "var(--color-surface-2)",
                padding: "5px 12px",
                borderRadius: 999,
                whiteSpace: "nowrap",
              }}
            >
              {c}
            </span>
          ))}
        </div>
        {/* 조작 단추는 인쇄하지 않는다(globals.css [data-hide-print]) — 조건 칩은 남긴다 */}
        {onSave && (
          <div data-hide-print style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Button variant="secondary" size="sm" onClick={onSave}>
              ♡ 이 결과 저장
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ThemeTabs — 공유글자/공유의미/공유톤 segmented control (테마당 탭 하나)
// ============================================================
export function ThemeTabs({
  themes,
  current,
  onChange,
}: {
  /** 테마별 한 줄 — key 가 겹치면 안 된다(lib/twin-sets.ts groupTwinSets 의 묶음). count 는 그 테마의 세트 수 */
  themes: { key: string; label: string; count?: number }[];
  current: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="테마"
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        justifyContent: "center",
        padding: 4,
        background: "var(--color-surface-2)",
        borderRadius: 999,
      }}
    >
      {themes.map((t) => {
        const active = t.key === current;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t.key)}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              padding: "9px 20px",
              borderRadius: 999,
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: active
                ? "var(--color-surface)"
                : "transparent",
              color: active
                ? "var(--color-navy)"
                : "var(--color-text-2)",
              boxShadow: active ? "var(--shadow-sm)" : "none",
              transition: "all 200ms cubic-bezier(.2,.6,.2,1)",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
            {t.count != null && t.count > 1 && (
              <span
                style={{
                  marginLeft: 6,
                  fontFamily: "Inter",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text-2)",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// SetChips — 한 테마 안의 세트 고르기(세트가 둘 이상일 때). 이름표는 그 세트의 이름들
// ============================================================
export function SetChips({
  sets,
  current,
  onChange,
}: {
  sets: { id: string; label: string }[];
  current: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="이 테마의 이름 세트"
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {sets.map((s) => {
        const active = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(s.id)}
            style={{
              appearance: "none",
              cursor: "pointer",
              padding: "7px 14px",
              borderRadius: 999,
              fontFamily: "var(--font-sans)",
              fontSize: 13.5,
              fontWeight: active ? 600 : 500,
              border: active
                ? "1px solid var(--color-navy)"
                : "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              color: active ? "var(--color-navy)" : "var(--color-text-2)",
              transition: "all 200ms cubic-bezier(.2,.6,.2,1)",
              whiteSpace: "nowrap",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// ThemeBanner — 테마별 설명 + 아이콘
// ============================================================
export function ThemeBanner({ theme }: { theme: TwinThemeBlock }) {
  const icons: Record<TwinThemeKey, React.ReactNode> = {
    shared_char: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="7" cy="10" r="4" />
        <circle cx="13" cy="10" r="4" />
      </svg>
    ),
    shared_meaning: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4 10h12" />
        <path d="M10 4v12" />
        <circle cx="10" cy="10" r="7" />
      </svg>
    ),
    shared_tone: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 10c2-4 4-4 6 0s4 4 6 0 2-4 2-4" />
      </svg>
    ),
  };

  return (
    <div
      style={{
        background: "#F4EFE7",
        borderRadius: "var(--radius-lg)",
        padding: "16px 22px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "var(--color-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-navy)",
          flexShrink: 0,
        }}
      >
        {icons[theme.key]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text)",
            marginBottom: 3,
            letterSpacing: "-0.005em",
          }}
        >
          {theme.label}
          {theme.shared.value && ` · ${theme.shared.value}`}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--color-text-2)",
          }}
        >
          {theme.description}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CoherenceHero — 세트 조화도 progress ring
// ============================================================
export function CoherenceHero({
  score,
  note,
}: {
  score: number;
  note: string;
}) {
  const color =
    score >= 85
      ? "var(--color-teal)"
      : score >= 70
        ? "var(--color-navy)"
        : score >= 55
          ? "var(--color-gold-700)"
          : "var(--color-text-2)";
  const tint =
    score >= 85
      ? "var(--color-teal-50)"
      : score >= 70
        ? "var(--color-navy-50)"
        : score >= 55
          ? "var(--color-gold-50)"
          : "var(--color-surface-2)";
  // 'SET COHERENCE' 칩(11px) 글자 — color 는 30px 점수·원 그래프(큰 글씨·비텍스트 3:1)용이라 틴트 위 작은 글씨에는 짙은 글자 토큰
  // (teal/teal-50 4.15 → teal-800 4.93, gold-700/gold-50 3.40 → gold-800 7.06:1 — 2026-10-26 팔레트 #2 보완)
  const chipText =
    score >= 85
      ? "var(--color-teal-800)"
      : score >= 70
        ? "var(--color-navy)"
        : score >= 55
          ? "var(--color-gold-800)"
          : "var(--color-text-2)";
  const pct = Math.max(0, Math.min(100, score));
  const r = 44;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        padding: "26px 28px",
        display: "flex",
        alignItems: "center",
        gap: 28,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 104,
          height: 104,
          flexShrink: 0,
        }}
      >
        <svg width="104" height="104" viewBox="0 0 104 104">
          <circle
            cx="52"
            cy="52"
            r={r}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="6"
          />
          <circle
            cx="52"
            cy="52"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            transform="rotate(-90 52 52)"
            style={{
              transition: "stroke-dasharray 420ms cubic-bezier(.2,.6,.2,1)",
            }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 30,
              fontWeight: 700,
              color,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {score}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--color-text-3)",
              marginTop: 2,
              fontFamily: "Inter",
              letterSpacing: "0.08em",
            }}
          >
            /100
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 500,
            color: chipText,
            background: tint,
            padding: "3px 10px",
            borderRadius: 999,
            marginBottom: 8,
            letterSpacing: "0.02em",
          }}
        >
          SET COHERENCE
        </div>
        <h3
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: 0,
            marginBottom: 6,
            letterSpacing: "-0.01em",
          }}
        >
          세트 조화도
        </h3>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--color-text-2)",
            margin: 0,
          }}
        >
          {note}
        </p>
      </div>
    </div>
  );
}
