/**
 * SystemStates — 4 system status screens (NotFound 404 / Loading / Empty / ServerError 500)
 * Source: NameForm_design/src/SystemStates.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState → 명시적 import
 *   - window 글로벌 → ES Module export
 *   - 모든 화면이 PaperBg 안에 Card 패턴
 */
"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "./Primitives";

// ============================================================
// Helpers
// ============================================================
function PaperBg({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        background: "var(--color-background)",
        overflow: "hidden",
        ...style,
      }}
    >
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          opacity: 0.06,
        }}
      >
        <filter id="paperGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed="5"
          />
          <feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.13  0 0 0 0 0.10  0 0 0 1 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#paperGrain)" />
      </svg>
      <div style={{ position: "relative", width: "100%", minHeight: "100vh" }}>
        {children}
      </div>
    </div>
  );
}

function Eyebrow({
  children,
  color = "var(--color-text-3)",
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontFamily: "Inter, var(--font-sans)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  );
}

function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 480,
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
        padding: "40px 36px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Mascot({
  pose = "default",
  size = 84,
  style,
}: {
  pose?: "default" | "puzzled" | "reading";
  size?: number;
  style?: CSSProperties;
}) {
  const eyeOffset = pose === "puzzled" ? -1.2 : 0;
  return (
    <div
      style={{ width: size, height: size * 1.5, ...style }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 180" width="100%" height="100%">
        <g
          fill="none"
          stroke="var(--color-teal)"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M50 28 Q50 22 60 22 Q70 22 70 28 L70 96 Q70 100 60 100 Q50 100 50 96 Z"
            strokeWidth="2"
          />
          <path d="M54 34 L54 90" strokeWidth="0.7" opacity=".35" />
          <path d="M60 32 L60 92" strokeWidth="0.7" opacity=".25" />
          <path d="M66 34 L66 90" strokeWidth="0.7" opacity=".35" />
          <path d="M50 92 Q60 96 70 92" strokeWidth="1.2" />
          <path d="M50 96 Q60 100 70 96" strokeWidth="1.2" />
          <path d="M48 102 L72 102 L69 110 L51 110 Z" strokeWidth="1.8" />
          <path
            d="M51 110 Q50 126 54 140 Q57 150 60 160"
            strokeWidth="2.6"
          />
          <path d="M57 110 Q57 132 60 160" strokeWidth="2.6" opacity=".7" />
          <path
            d="M63 110 Q64 130 62 144 Q61 152 60 160"
            strokeWidth="2.6"
            opacity=".75"
          />
          <path
            d="M69 110 Q70 124 66 140 Q63 152 60 160"
            strokeWidth="2.6"
            opacity=".6"
          />
          <path
            d="M52 156 Q56 160 60 156 T68 156"
            strokeWidth="1.2"
            opacity=".55"
          />
          <circle
            cx="55"
            cy={48 + eyeOffset}
            r="1.9"
            fill="var(--color-teal)"
            stroke="none"
          />
          <circle
            cx="65"
            cy={48 + eyeOffset}
            r="1.9"
            fill="var(--color-teal)"
            stroke="none"
          />
          {pose === "puzzled" && (
            <g>
              <path d="M53 54 Q60 51 67 54" strokeWidth="1.1" />
              <text
                x="78"
                y="36"
                fontSize="10"
                fill="var(--color-text-3)"
                stroke="none"
                fontFamily="Inter"
              >
                ?
              </text>
            </g>
          )}
          {pose === "reading" && (
            <g>
              <rect
                x="18"
                y="58"
                width="22"
                height="28"
                rx="1.5"
                strokeWidth="1.2"
                fill="var(--color-surface)"
              />
              <path
                d="M22 64 H36 M22 68 H34 M22 72 H35 M22 76 H32"
                strokeWidth="0.6"
                opacity=".55"
              />
              <path d="M53 56 Q60 58 67 56" strokeWidth="1.1" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

function CommonCTAs({
  primary = "홈으로 돌아가기",
  secondary = "도움말 보기",
  primaryHref = "/",
  secondaryHref = "#",
}: {
  primary?: string;
  secondary?: string;
  primaryHref?: string;
  secondaryHref?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: 28,
      }}
    >
      <Link href={primaryHref} style={{ textDecoration: "none" }}>
        <Button
          variant="primary"
          style={{ width: "100%", padding: "14px 22px" }}
        >
          {primary}
        </Button>
      </Link>
      <Link href={secondaryHref} style={{ textDecoration: "none" }}>
        <Button
          variant="secondary"
          style={{ width: "100%", padding: "14px 22px" }}
        >
          {secondary}
        </Button>
      </Link>
    </div>
  );
}

// ============================================================
// Frame 1 — 404 Not Found
// ============================================================
export function NotFoundScreen() {
  const items = [
    { label: "이름 추천 받기", href: "/search" },
    { label: "이름 평가 받기", href: "/evaluate" },
    { label: "이름의 결에 대하여", href: "/" },
  ];

  return (
    <PaperBg>
      <div style={{ position: "absolute", top: "12%", left: "8%" }}>
        <Mascot
          pose="puzzled"
          size={84}
          style={{ opacity: 0.7, transform: "scale(0.95)" }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: "16vh",
          paddingBottom: 40,
          paddingInline: 24,
        }}
      >
        <Card>
          <Eyebrow>404 · Not Found</Eyebrow>
          <h1
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.3,
              marginTop: 12,
              marginBottom: 14,
              letterSpacing: "-0.015em",
            }}
          >
            그 이름은 아직
            <br />
            만나지 못했어요
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--color-text-2)",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            찾으시는 페이지가 사라졌거나, 주소가 잘못 입력된 것 같아요.
          </p>

          <div
            style={{
              marginTop: 24,
              background: "var(--color-background)",
              borderRadius: "var(--radius-md)",
              padding: "18px 20px",
              border: "1px solid var(--color-divider)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-3)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: "Inter, var(--font-sans)",
                marginBottom: 10,
              }}
            >
              자주 찾는 경로
            </div>
            {items.map((it, i) => (
              <Link
                key={i}
                href={it.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderTop:
                    i === 0 ? "none" : "1px dashed var(--color-divider)",
                  fontSize: 14,
                  color: "var(--color-text)",
                  textDecoration: "none",
                }}
              >
                <span
                  style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap" }}
                >
                  {it.label}
                </span>
                <span style={{ color: "var(--color-teal)" }}>→</span>
              </Link>
            ))}
          </div>

          <CommonCTAs />
        </Card>
      </div>
    </PaperBg>
  );
}

// ============================================================
// Frame 2 — Loading
// ============================================================
function ProgressRing({
  progress = 0.62,
  size = 140,
}: {
  progress?: number;
  size?: number;
}) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-teal-50)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 38,
            color: "var(--color-teal)",
            animation: "kSpin 4s linear infinite",
            transformOrigin: "50% 55%",
          }}
        >
          ✦
        </div>
      </div>
    </div>
  );
}

function StepBullet({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done") {
    return (
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "var(--color-teal)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 5l2 2 4-4"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "var(--color-teal-50)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--color-teal)",
            animation: "kPulse 1.4s ease-in-out infinite",
          }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        border: "1.5px solid var(--color-border)",
        flexShrink: 0,
      }}
    />
  );
}

export function LoadingScreen() {
  const steps = [
    { label: "한자 후보 분석", time: "1.2s", status: "done" as const },
    { label: "음운 리듬 평가", time: "2.4s", status: "active" as const },
    { label: "사주 조화 계산", time: "—", status: "pending" as const },
  ];
  return (
    <PaperBg>
      <style>{`
        @keyframes kSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes kPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.45; } }
      `}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: "16vh",
          paddingBottom: 40,
          paddingInline: 24,
        }}
      >
        <Card style={{ padding: "44px 36px 36px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <ProgressRing progress={0.62} />
            <h1
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 22,
                fontWeight: 500,
                marginTop: 24,
                marginBottom: 6,
                letterSpacing: "-0.01em",
              }}
            >
              이름을 분석하고 있어요
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "var(--color-text-2)",
                margin: 0,
              }}
            >
              보통 5초 안에 끝나요
            </p>
          </div>

          <div
            style={{
              marginTop: 28,
              background: "var(--color-background)",
              borderRadius: "var(--radius-md)",
              padding: "18px 20px",
              border: "1px solid var(--color-divider)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {steps.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <StepBullet status={s.status} />
                <div
                  style={{
                    fontSize: 14,
                    color:
                      s.status === "pending"
                        ? "var(--color-text-3)"
                        : "var(--color-text)",
                    fontWeight: s.status === "active" ? 600 : 400,
                    flex: 1,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: "Inter, var(--font-mono)",
                    fontSize: 12,
                    color:
                      s.status === "pending"
                        ? "var(--color-text-3)"
                        : "var(--color-text-2)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {s.time}
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              marginTop: 20,
              fontSize: 12,
              color: "var(--color-text-3)",
              textAlign: "center",
            }}
          >
            결과는 자동 저장되며, 새로고침해도 안전해요
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            <Link
              href="/"
              style={{
                fontSize: 13,
                color: "var(--color-text-2)",
                textDecoration: "none",
              }}
            >
              ← 다른 조건으로 돌아가기
            </Link>
          </div>
        </Card>
      </div>
    </PaperBg>
  );
}

// ============================================================
// Frame 3 — Empty Result
// ============================================================
export function EmptyResultScreen({
  chips = ["기피 한자 줄이기", "톤 범위 넓히기", "세대 중립 강도 낮추기"],
  onRevise,
}: {
  chips?: string[];
  onRevise?: () => void;
}) {
  return (
    <PaperBg>
      <div style={{ position: "absolute", top: "12%", right: "8%" }}>
        <Mascot
          pose="reading"
          size={84}
          style={{ opacity: 0.7, transform: "scale(0.95)" }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: "16vh",
          paddingBottom: 40,
          paddingInline: 24,
        }}
      >
        <Card>
          <Eyebrow>Result · Empty</Eyebrow>
          <h1
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 28,
              fontWeight: 500,
              lineHeight: 1.35,
              marginTop: 12,
              marginBottom: 14,
              letterSpacing: "-0.015em",
            }}
          >
            이번엔 어울리는 이름을
            <br />
            찾지 못했어요
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--color-text-2)",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            조건이 너무 까다로워서 후보가 모두 걸러졌어요.
            <br />한 가지만 살짝 풀어볼까요?
          </p>

          <div
            style={{
              marginTop: 24,
              background: "var(--color-background)",
              borderRadius: "var(--radius-md)",
              padding: "18px 20px",
              border: "1px solid var(--color-divider)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-3)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: "Inter, var(--font-sans)",
                marginBottom: 12,
              }}
            >
              이런 조건을 조정해보세요
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4,
                scrollbarWidth: "thin",
              }}
            >
              {chips.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={onRevise}
                  style={{
                    appearance: "none",
                    flexShrink: 0,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontFamily: "var(--font-sans)",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-teal-100)",
                    borderRadius: 999,
                    color: "var(--color-teal)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontWeight: 500,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <CommonCTAs
            primary="조건 수정하러 가기"
            secondary="다른 경로로 작명하기"
            primaryHref="/"
            secondaryHref="/"
          />
        </Card>
      </div>
    </PaperBg>
  );
}

// ============================================================
// Frame 4 — Server Error (500)
// ============================================================
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div
        style={{
          width: 84,
          color: "var(--color-text-3)",
          flexShrink: 0,
        }}
      >
        {k}
      </div>
      <div style={{ color: "var(--color-text)" }}>{v}</div>
    </div>
  );
}

export function ServerErrorScreen({
  refId = "8a3f2c",
  errorMessage,
  onRetry,
}: {
  refId?: string;
  errorMessage?: string;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <PaperBg>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: "16vh",
          paddingBottom: 40,
          paddingInline: 24,
        }}
      >
        <Card>
          <Eyebrow color="var(--color-gold-600)">Error · 500</Eyebrow>
          <h1
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 28,
              fontWeight: 500,
              lineHeight: 1.35,
              marginTop: 12,
              marginBottom: 14,
              letterSpacing: "-0.015em",
            }}
          >
            잠깐, 우리 쪽에서
            <br />
            문제가 생겼어요
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--color-text-2)",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            {errorMessage ??
              "일시적인 오류가 발생했어요. 다시 시도하거나, 잠시 후 다시 방문해주세요."}
          </p>

          <div
            style={{
              marginTop: 22,
              background: "var(--color-gold-50)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-gold-100)",
              padding: "14px 18px",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                color: "var(--color-text)",
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  transition: "transform 180ms",
                  transform: open ? "rotate(90deg)" : "rotate(0deg)",
                  color: "var(--color-text-2)",
                }}
              >
                ▸
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>
                기술 정보 보기
              </span>
              <span
                style={{
                  fontFamily: "Inter, var(--font-mono)",
                  fontSize: 12,
                  color: "var(--color-text-2)",
                  letterSpacing: "0.02em",
                }}
              >
                REF: {refId}
              </span>
            </button>
            {open && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px dashed var(--color-gold-100)",
                  fontFamily: "Inter, var(--font-mono)",
                  fontSize: 12,
                  color: "var(--color-text-2)",
                  lineHeight: 1.8,
                }}
              >
                <Row k="요청 ID" v={`req_${refId}`} />
                <Row k="발생 시각" v={new Date().toISOString()} />
                <Row k="마지막 액션" v="-" />
                <button
                  type="button"
                  onClick={() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  style={{
                    marginTop: 10,
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    appearance: "none",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: "var(--color-text)",
                  }}
                >
                  {copied ? "✓ 복사됨" : "기술 정보 복사하기"}
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 28,
            }}
          >
            {onRetry ? (
              <Button
                variant="primary"
                onClick={onRetry}
                style={{ width: "100%", padding: "14px 22px" }}
              >
                다시 시도하기
              </Button>
            ) : (
              <Link href="/" style={{ textDecoration: "none" }}>
                <Button
                  variant="primary"
                  style={{ width: "100%", padding: "14px 22px" }}
                >
                  다시 시도하기
                </Button>
              </Link>
            )}
            <Link href="/" style={{ textDecoration: "none" }}>
              <Button
                variant="secondary"
                style={{ width: "100%", padding: "14px 22px" }}
              >
                홈으로 돌아가기
              </Button>
            </Link>
          </div>

          <p
            style={{
              marginTop: 18,
              fontSize: 12,
              color: "var(--color-text-3)",
              textAlign: "center",
            }}
          >
            이 문제가 계속된다면{" "}
            <a
              href="mailto:hello@naming.kyeol"
              style={{ color: "var(--color-teal)" }}
            >
              hello@naming.kyeol
            </a>{" "}
            로 알려주세요
          </p>
        </Card>
      </div>
    </PaperBg>
  );
}
