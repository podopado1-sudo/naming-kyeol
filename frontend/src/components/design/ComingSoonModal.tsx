/**
 * ComingSoonModal — 회사명 & 반려동물 공용 모달 (mode prop 분기)
 * Source: NameForm_design/src/ComingSoonModal.jsx (Claude Design 산출물)
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   mode: "company" | "pet"
 *   initialState?: "idle" | "submitted"  (디자인 캡처용)
 *   embedded?: boolean                   (디자인 캔버스에서 absolute 위치 사용)
 *
 * 변환 사항:
 *   - React.useState/useRef/useEffect → 명시적 import
 *   - window.ComingSoonModal → ES Module export
 *   - inline style 그대로 (CSS 변수 의존)
 */
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

export type ComingSoonMode = "company" | "pet";

// ============================================================
// Icons
// ============================================================
function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  );
}

function CompanyIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--color-teal)"
      strokeWidth="1.5"
    >
      <rect x="8" y="12" width="32" height="30" rx="3" />
      <path d="M16 22h4M28 22h4M16 30h4M28 30h4M16 38h4M28 38h4" />
      <path d="M22 12V8a2 2 0 012-2h0a2 2 0 012 2v4" />
    </svg>
  );
}

function PetIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="var(--color-teal)"
      strokeWidth="1.5"
    >
      <circle cx="24" cy="30" r="8" />
      <circle cx="13" cy="20" r="3.5" />
      <circle cx="35" cy="20" r="3.5" />
      <circle cx="17" cy="12" r="3" />
      <circle cx="31" cy="12" r="3" />
    </svg>
  );
}

// ============================================================
// Content
// ============================================================
type FeatureKind =
  | "industry"
  | "domain"
  | "trademark"
  | "species"
  | "rhythm"
  | "call";

interface ContentDef {
  icon: typeof CompanyIcon;
  title: string;
  subtitle: string;
  features: { icon: FeatureKind; text: string }[];
  alternatives: { label: string; href: string }[];
}

const COMING_SOON_CONTENT: Record<ComingSoonMode, ContentDef> = {
  company: {
    icon: CompanyIcon,
    title: "회사 이름, 조금만 기다려주세요",
    subtitle:
      "상호명·브랜드명·스타트업 네이밍을 위한 별도 규칙을 준비 중이에요. 업종과 포지셔닝을 반영한 추천을 목표로 하고 있어요.",
    features: [
      { icon: "industry", text: "업종별 네이밍 규칙 (IT · F&B · 교육 등)" },
      { icon: "domain", text: "도메인 사용 가능성 체크" },
      { icon: "trademark", text: "상표 충돌 간이 확인" },
    ],
    alternatives: [
      { label: "이름 추천", href: "/search" },
      { label: "부모 이름 기반", href: "/parent-based" },
    ],
  },
  pet: {
    icon: PetIcon,
    title: "반려동물 이름, 곧 만나요",
    subtitle:
      "반려동물에 어울리는 호명 리듬과 2음절 중심의 별도 규칙을 준비 중이에요.",
    features: [
      { icon: "species", text: "종 · 품종별 음절 추천" },
      { icon: "rhythm", text: "2음절 중심 리듬 최적화" },
      { icon: "call", text: "부르기 쉬운 받침 구조" },
    ],
    alternatives: [
      { label: "이름 추천", href: "/search" },
      { label: "쌍둥이 이름", href: "/twin" },
    ],
  },
};

function FeatureIcon({ kind }: { kind: FeatureKind }) {
  const path: Record<FeatureKind, ReactNode> = {
    industry: (
      <>
        <rect x="3" y="8" width="10" height="8" rx="1" />
        <path d="M5 8V5h6v3" />
      </>
    ),
    domain: (
      <>
        <circle cx="8" cy="8" r="6" />
        <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" />
      </>
    ),
    trademark: (
      <>
        <circle cx="8" cy="8" r="6" />
        <path d="M5 6h6M8 6v5" />
      </>
    ),
    species: (
      <>
        <circle cx="8" cy="10" r="4" />
        <circle cx="4" cy="5" r="1.5" />
        <circle cx="12" cy="5" r="1.5" />
      </>
    ),
    rhythm: <path d="M2 8c2-3 3-3 5 0s3 3 5 0 2-3 2-3" />,
    call: (
      <path d="M4 3h3l2 3-2 1c1 2 3 4 5 5l1-2 3 2v3c0 1-1 2-2 2C7 17 1 11 1 5c0-1 1-2 3-2z" />
    ),
  };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path[kind]}
    </svg>
  );
}

// ============================================================
// Modal
// ============================================================
type ModalState = "idle" | "submitting" | "submitted" | "error";

interface Props {
  open: boolean;
  onClose: () => void;
  mode: ComingSoonMode;
  initialState?: ModalState;
  embedded?: boolean;
}

export function ComingSoonModal({
  open,
  onClose,
  mode,
  initialState = "idle",
  embedded = false,
}: Props) {
  const content = COMING_SOON_CONTENT[mode];
  const Icon = content.icon;

  const [email, setEmail] = useState(
    initialState === "submitted" ? "user@example.com" : ""
  );
  const [checked, setChecked] = useState(false);
  const [state, setState] = useState<ModalState>(initialState);
  const [focused, setFocused] = useState(false);

  const firstFocusRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // ESC + focus trap
  useEffect(() => {
    if (!open) return;
    firstFocusRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        const arr = Array.from(focusables);
        if (arr.length === 0) return;
        const first = arr[0];
        const last = arr[arr.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!emailValid || state === "submitting") return;
    setState("submitting");
    // TODO: 실제 백엔드 API 연결. 현재는 클라이언트 시뮬레이션
    setTimeout(() => setState("submitted"), 800);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cs-title"
      aria-describedby="cs-desc"
      onClick={embedded ? undefined : onClose}
      style={{
        position: embedded ? "absolute" : "fixed",
        inset: 0,
        zIndex: embedded ? 1 : 100,
        background: embedded ? "transparent" : "rgba(30, 58, 95, 0.45)",
        backdropFilter: embedded ? "none" : "blur(8px)",
        WebkitBackdropFilter: embedded ? "none" : "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "csOverlayIn 200ms ease-out both",
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 100%)",
          background: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(30,58,95,0.18)",
          position: "relative",
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          animation: "csSlideUp 240ms cubic-bezier(.2,.6,.2,1) both",
        }}
      >
        {/* Close */}
        <button
          ref={firstFocusRef}
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 40,
            height: 40,
            borderRadius: 999,
            appearance: "none",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-2)",
          }}
        >
          <CloseIcon />
        </button>

        {/* Hero */}
        <section style={{ padding: "36px 32px 0", textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-teal)",
              letterSpacing: "2px",
              marginBottom: 20,
              textTransform: "uppercase",
            }}
          >
            Coming Soon
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Icon size={48} />
          </div>
          <h2
            id="cs-title"
            style={{
              fontSize: 24,
              fontWeight: 500,
              margin: 0,
              marginBottom: 10,
              letterSpacing: "-0.015em",
              color: "var(--color-text)",
              fontFamily: "Pretendard Variable, Pretendard, sans-serif",
            }}
          >
            {content.title}
          </h2>
          <p
            id="cs-desc"
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--color-text-2)",
              margin: "0 auto",
              maxWidth: 380,
            }}
          >
            {content.subtitle}
          </p>
        </section>

        {/* Features preview */}
        <section style={{ padding: "24px 32px" }}>
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 12,
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-2)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              준비 중인 기능
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {content.features.map((f, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--color-text)",
                  }}
                >
                  <span
                    style={{
                      color: "var(--color-teal)",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <FeatureIcon kind={f.icon} />
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Email form */}
        <section style={{ padding: "0 32px 20px" }}>
          <form onSubmit={onSubmit}>
            <label
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--color-text)",
                display: "block",
                marginBottom: 10,
              }}
            >
              출시되면 알려드릴까요?
            </label>

            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text-3)",
                  marginBottom: 6,
                  letterSpacing: "0.02em",
                }}
              >
                이메일 주소
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state === "error") setState("idle");
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="example@mail.com"
                disabled={state === "submitting" || state === "submitted"}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "11px 14px",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  background: "var(--color-surface)",
                  border: `1px solid ${
                    state === "error"
                      ? "#C45A4C"
                      : focused || (email && emailValid)
                        ? "var(--color-teal)"
                        : "var(--color-border)"
                  }`,
                  borderRadius: 10,
                  color: "var(--color-text)",
                  outline: "none",
                  transition: "border-color 160ms",
                }}
              />
              {state === "error" && (
                <div
                  style={{ fontSize: 12, color: "#C45A4C", marginTop: 6 }}
                >
                  전송에 실패했어요. 잠시 후 다시 시도해주세요.
                </div>
              )}
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 12,
                color: "var(--color-text-2)",
                lineHeight: 1.5,
                cursor: "pointer",
                marginBottom: 16,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                disabled={state === "submitting" || state === "submitted"}
                style={{ marginTop: 2, accentColor: "var(--color-teal)" }}
              />
              <span>가끔 작명 관련 소식도 함께 받아볼게요</span>
            </label>

            <button
              type="submit"
              disabled={
                !emailValid || state === "submitting" || state === "submitted"
              }
              style={{
                width: "100%",
                padding: "13px 20px",
                borderRadius: 10,
                border: "none",
                cursor:
                  !emailValid || state !== "idle" ? "default" : "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 600,
                background:
                  state === "submitted"
                    ? "var(--color-teal)"
                    : !emailValid
                      ? "var(--color-surface-2)"
                      : "var(--color-navy)",
                color:
                  state === "submitted"
                    ? "#fff"
                    : !emailValid
                      ? "var(--color-text-3)"
                      : "#fff",
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                transition: "background 200ms",
              }}
            >
              {state === "idle" && "알림 신청하기"}
              {state === "submitting" && (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      animation: "csSpin 700ms linear infinite",
                    }}
                  />
                  신청 중…
                </>
              )}
              {state === "submitted" && "✓ 신청되었어요"}
            </button>

            {state === "submitted" && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-teal)",
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                출시 소식을 가장 먼저 보내드릴게요.
              </div>
            )}

            <div
              style={{
                fontSize: 10,
                color: "var(--color-text-3)",
                marginTop: 12,
                textAlign: "center",
              }}
            >
              언제든지 구독 해지할 수 있어요 ·{" "}
              <a href="#" style={{ color: "var(--color-text-3)" }}>
                개인정보 처리방침
              </a>
            </div>
          </form>
        </section>

        {/* Alternative CTAs */}
        <section
          style={{
            padding: "20px 32px 28px",
            borderTop: "1px solid #F0EAE0",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-2)",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            그 동안 다른 경로로 작명해보실래요?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {content.alternatives.map((a, i) => (
              <a
                key={i}
                href={a.href}
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 10,
                  background: "var(--color-surface-2)",
                  color: "var(--color-text)",
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {a.label} →
              </a>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes csOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes csSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes csSpin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          div[role="dialog"], div[role="dialog"] > div {
            animation: none !important;
          }
        }
        @media (max-width: 560px) {
          div[role="dialog"] {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          div[role="dialog"] > div {
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            max-height: 92vh !important;
            animation: csSlideUpMobile 260ms cubic-bezier(.2,.6,.2,1) both !important;
          }
          @keyframes csSlideUpMobile {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        }
      `}</style>
    </div>
  );
}

export default ComingSoonModal;
