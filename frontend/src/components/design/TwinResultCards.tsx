/**
 * TwinResultCards — Twin Result name pair card + connector
 * Source: NameForm_design/src/TwinResultCards.jsx (Claude Design 산출물)
 *
 * Exports: SharedCharHighlight, PairCard, ConnectorVisual
 */
"use client";

import Link from "next/link";
import type { TwinPairEntry, TwinThemeBlock } from "./TwinResultTop";

// ============================================================
// SharedCharHighlight — 공유 글자 강조 (teal-50 tint)
// ============================================================
export function SharedCharHighlight({
  first,
  sharedIndexes,
}: {
  first: string;
  sharedIndexes?: number[];
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 0,
        fontFamily: "var(--font-serif)",
        fontSize: 32,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        color: "var(--color-text)",
      }}
    >
      {[...first].map((ch, i) => {
        const isShared = sharedIndexes?.includes(i);
        return (
          <span
            key={i}
            style={{
              background: isShared ? "var(--color-teal-50)" : "transparent",
              color: isShared ? "var(--color-teal)" : "inherit",
              padding: isShared ? "0 6px" : "0",
              borderRadius: isShared ? "var(--radius-sm)" : 0,
              fontFamily: "Pretendard Variable, Pretendard, sans-serif",
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}

// ============================================================
// PairCard — 자녀 한 명 카드 (이름 + 점수 + Reasons)
// ============================================================
export function PairCard({
  entry,
  theme,
  lastName,
  detailHref = "/analysis",
}: {
  entry: TwinPairEntry;
  theme: TwinThemeBlock;
  lastName: string;
  detailHref?: string;
}) {
  const sharedIdx =
    theme.shared.type === "char" ? entry.sharedIndex : undefined;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--color-border)",
        padding: "24px 24px 22px",
        display: "flex",
        flexDirection: "column",
        transition: "all 220ms cubic-bezier(.2,.6,.2,1)",
      }}
    >
      <div
        style={{
          display: "inline-block",
          alignSelf: "flex-start",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-text-2)",
          background: "var(--color-surface-2)",
          padding: "3px 10px",
          borderRadius: 999,
          letterSpacing: "0.04em",
          marginBottom: 16,
        }}
      >
        {entry.position}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 4,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 24,
            fontWeight: 500,
            color: "var(--color-text-2)",
            fontFamily: "Pretendard Variable, Pretendard, sans-serif",
            letterSpacing: "-0.01em",
          }}
        >
          {lastName}
        </span>
        <SharedCharHighlight first={entry.first} sharedIndexes={sharedIdx} />
      </div>

      {theme.shared.type === "meaning" && entry.sharedMeaning && (
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 5,
            background: "var(--color-teal-50)",
            color: "var(--color-teal)",
            padding: "4px 10px",
            borderRadius: "var(--radius-sm)",
            fontSize: 11,
            fontWeight: 500,
            marginTop: 6,
            marginBottom: 6,
          }}
        >
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 12 }}>
            智
          </span>
          공유의미 · {entry.sharedMeaning}
        </div>
      )}

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "18px 0 14px",
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "baseline",
          fontFamily: "Inter",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-3)",
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.04em",
              marginBottom: 2,
            }}
          >
            미학
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--color-text-2)",
            }}
          >
            {entry.scores.aesthetic}
          </div>
        </div>
        <div
          style={{
            width: 1,
            height: 28,
            background: "var(--color-divider)",
          }}
        />
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-3)",
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.04em",
              marginBottom: 2,
            }}
          >
            조화
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--color-text-2)",
            }}
          >
            {entry.scores.harmony}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-3)",
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.04em",
              marginBottom: 2,
            }}
          >
            최종
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--color-navy)",
              lineHeight: 1,
            }}
          >
            {entry.scores.final}
          </div>
        </div>
      </div>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "18px 0 14px",
        }}
      />

      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
        }}
      >
        {entry.reasons.map((r, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              gap: 8,
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--color-text-2)",
            }}
          >
            <span
              style={{
                color: "var(--color-teal)",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              •
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ul>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "18px 0 14px",
        }}
      />

      <Link
        href={detailHref}
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-teal)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        상세 보기 <span>→</span>
      </Link>
    </div>
  );
}

// ============================================================
// ConnectorVisual — 2명 사이 수평 연결선 + 라벨
// ============================================================
export function ConnectorVisual({ theme }: { theme: TwinThemeBlock }) {
  if (theme.shared.type === "char") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            height: 1,
            flex: 1,
            background: "var(--color-teal-100)",
          }}
        />
        <div
          style={{
            padding: "4px 10px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-teal-50)",
            color: "var(--color-teal)",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 14 }}>
            {theme.shared.value}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "var(--color-text-3)",
              fontWeight: 500,
            }}
          >
            공유
          </span>
        </div>
        <div
          style={{
            height: 1,
            flex: 1,
            background: "var(--color-teal-100)",
          }}
        />
      </div>
    );
  }
  if (theme.shared.type === "meaning") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            height: 1,
            flex: 1,
            background: "var(--color-teal-100)",
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-2)",
            whiteSpace: "nowrap",
          }}
        >
          동일 의미
        </span>
        <div
          style={{
            height: 1,
            flex: 1,
            background: "var(--color-teal-100)",
          }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          height: 1,
          flex: 1,
          background: "var(--color-teal-100)",
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: "var(--color-text-2)",
          whiteSpace: "nowrap",
        }}
      >
        같은 음운 톤
      </span>
      <div
        style={{
          height: 1,
          flex: 1,
          background: "var(--color-teal-100)",
        }}
      />
    </div>
  );
}
