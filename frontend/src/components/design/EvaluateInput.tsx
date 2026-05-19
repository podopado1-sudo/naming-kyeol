/**
 * EvaluateInput — 이름 평가 입력 페이지
 * Source: NameForm_design/src/EvaluateInput.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState → 명시적 import
 *   - injectStyles IIFE → useEffect (SSR 안전)
 *   - onSubmit prop 추가 (외부에서 평가 요청 트리거)
 */
"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { BookOpen, Leaf, Music } from "lucide-react";

export type EvalSubmitPayload = {
  lastName: string;
  firstName: string;
  birth: string;
  /** 출생 시각 (HH:mm, 선택) — 사주 시주(時柱) 계산에 사용 */
  birthTime?: string;
  gender: "남아" | "여아" | "중립" | "";
  tone: "부드러운" | "중립" | "강한" | "";
};

interface InitialSeed {
  lastName?: string;
  firstName?: string;
  birth?: string;
  birthTime?: string;
  gender?: EvalSubmitPayload["gender"];
  tone?: EvalSubmitPayload["tone"];
}

export function EvaluateInputPage({
  seed,
  onSubmit,
}: {
  seed?: InitialSeed;
  onSubmit?: (payload: EvalSubmitPayload) => void;
}) {
  const [lastName, setLastName] = useState(seed?.lastName ?? "");
  const [firstName, setFirstName] = useState(seed?.firstName ?? "");
  const [birth, setBirth] = useState(seed?.birth ?? "");
  const [birthTime, setBirthTime] = useState(seed?.birthTime ?? "");
  const [gender, setGender] = useState<EvalSubmitPayload["gender"]>(
    seed?.gender ?? ""
  );
  const [tone, setTone] = useState<EvalSubmitPayload["tone"]>(seed?.tone ?? "");

  const [openBirthHelp, setOpenBirthHelp] = useState(false);
  const [openToneHelp, setOpenToneHelp] = useState(false);

  // SSR 안전: useEffect로 style inject
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("eval-input-style")) return;
    const s = document.createElement("style");
    s.id = "eval-input-style";
    s.textContent = `
      @keyframes evalFadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
      @media (prefers-reduced-motion: reduce) { @keyframes evalFadeIn { from { opacity: 1; } to { opacity: 1; } } }
      input[type="date"]::-webkit-datetime-edit { color: transparent; }
      input[type="date"]:focus::-webkit-datetime-edit { color: var(--color-text); }
    `;
    document.head.appendChild(s);
  }, []);

  const KOREAN_RE = /^[가-힣ㄱ-ㅎㅏ-ㅣ]*$/;
  const lastValid = !lastName || KOREAN_RE.test(lastName);
  const firstValid = !firstName || KOREAN_RE.test(firstName);
  const total = (lastName + firstName).replace(/[^\S]/g, "").length;
  const tooLong = total > 5;
  const canSubmit =
    lastValid && firstValid && lastName.trim() !== "" && firstName.trim() !== "";

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit?.({ lastName, firstName, birth, birthTime, gender, tone });
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      {/* Mini header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(250, 247, 242, 0.92)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--color-divider)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              fontWeight: 500,
              color: "var(--color-navy)",
              letterSpacing: "-0.01em",
            }}
          >
            이름의 결
          </span>
          <span
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 11,
              color: "var(--color-text-3)",
              letterSpacing: "0.06em",
            }}
          >
            Naming.kyeol
          </span>
        </Link>
        <Link
          href="/"
          style={{
            fontSize: 13,
            color: "var(--color-text-2)",
            textDecoration: "none",
          }}
        >
          ← 홈으로
        </Link>
      </header>

      <main
        style={{ padding: "48px 24px 32px", maxWidth: 720, margin: "0 auto" }}
      >
        {/* Hero */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--color-text-3)",
            }}
          >
            Evaluate
          </div>
          <h1
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 34,
              fontWeight: 500,
              margin: "10px 0 12px",
              letterSpacing: "-0.018em",
              lineHeight: 1.25,
            }}
          >
            마음에 둔 이름,
            <br />
            어떤 결인지 알려드릴게요
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--color-text-2)",
              margin: 0,
              lineHeight: 1.65,
            }}
          >
            이름과 출생 정보를 입력하시면 미학·조화·희귀도를 분석합니다
          </p>

          <aside
            style={{
              marginTop: 24,
              background: "var(--color-background)",
              borderLeft: "3px solid var(--color-teal)",
              borderRadius: "0 var(--radius-md) var(--radius-md) 0",
              padding: "16px 20px",
              border: "1px solid var(--color-divider)",
              borderLeftWidth: 3,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: "var(--color-teal)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                i
              </span>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--color-text)",
                }}
              >
                평가는 추천과 다른 관점이에요
              </span>
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 4,
                fontSize: 13.5,
                color: "var(--color-text-2)",
                lineHeight: 1.6,
              }}
            >
              <li>
                <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
                  추천
                </b>{" "}
                · 후보를 새로 생성
              </li>
              <li>
                <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
                  평가
                </b>{" "}
                · 정해진 이름을 분석
              </li>
              <li>두 결과는 서로를 보완해요</li>
            </ul>
          </aside>
        </div>

        {/* Form card */}
        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-md)",
            padding: 0,
          }}
        >
          <Section title="이름" subtitle={`총 ${total}자`}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "30% 1fr",
                gap: 10,
              }}
            >
              <Input
                value={lastName}
                onChange={setLastName}
                placeholder="예: 김"
                invalid={!lastValid}
                ariaLabel="성"
              />
              <Input
                value={firstName}
                onChange={setFirstName}
                placeholder="예: 서윤"
                invalid={!firstValid}
                ariaLabel="이름"
              />
            </div>
            {!firstValid && (
              <FieldHint kind="warn">한글로 입력해주세요</FieldHint>
            )}
            {firstValid && tooLong && (
              <FieldHint kind="warn">
                긴 이름은 평가 정확도가 낮아질 수 있어요
              </FieldHint>
            )}
            <div style={{ marginTop: 14 }}>
              <NamePreview lastName={lastName} firstName={firstName} />
            </div>
          </Section>

          <Divider />

          <Section title="출생일">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr",
                gap: 10,
              }}
            >
              <DateInput value={birth} onChange={setBirth} />
              <input
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
                style={{
                  appearance: "none",
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  color: birthTime ? "var(--color-text)" : "var(--color-text-3)",
                  padding: "12px 14px",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  outline: "none",
                }}
                aria-label="출생 시각 (선택, 시주 반영)"
                placeholder="시:분"
              />
            </div>
            <button
              type="button"
              onClick={() => setOpenBirthHelp((o) => !o)}
              style={helpToggleStyle}
            >
              <span
                style={{
                  display: "inline-block",
                  transition: "transform 180ms",
                  transform: openBirthHelp ? "rotate(90deg)" : "rotate(0deg)",
                }}
              >
                ▸
              </span>
              출생 정보가 왜 필요한가요?
            </button>
            {openBirthHelp && (
              <div style={helpBodyStyle}>
                사주 오행을 분석해 이름과의 조화를 계산해요.
                <br />
                출생일을 입력하지 않으면 미학 점수만 평가됩니다.
                <br />
                출생 시각까지 알면 시주(時柱)도 반영해 4기둥 분석이 가능해요.
              </div>
            )}
          </Section>

          <Divider />

          <Section title="성별">
            <Segmented
              options={["남아", "여아", "중립"]}
              value={gender}
              onChange={(v) =>
                setGender(v as EvalSubmitPayload["gender"])
              }
            />
            <FieldHint>중립은 성별 무관 평가를 진행해요</FieldHint>
          </Section>

          <Divider />

          <Section title="톤">
            <Segmented
              options={["부드러운", "중립", "강한"]}
              value={tone}
              onChange={(v) => setTone(v as EvalSubmitPayload["tone"])}
            />
            <button
              type="button"
              onClick={() => setOpenToneHelp((o) => !o)}
              style={helpToggleStyle}
            >
              <span
                style={{
                  display: "inline-block",
                  transition: "transform 180ms",
                  transform: openToneHelp ? "rotate(90deg)" : "rotate(0deg)",
                }}
              >
                ▸
              </span>
              톤이 평가에 어떻게 반영되나요?
            </button>
            {openToneHelp && (
              <div style={helpBodyStyle}>
                톤은 발음·받침·자음 강도에 대한 선호를 의미해요.
                <br />
                평가 시 입력 톤과 이름의 실제 톤을 함께 보여드립니다.
              </div>
            )}
          </Section>

          <div
            style={{
              padding: "20px 24px 24px",
              borderTop: "1px solid #F0EAE0",
            }}
          >
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: "100%",
                padding: "14px 22px",
                background: canSubmit
                  ? "var(--color-navy)"
                  : "var(--color-surface-2)",
                color: canSubmit ? "#fff" : "var(--color-text-3)",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                fontWeight: 600,
                cursor: canSubmit ? "pointer" : "not-allowed",
                letterSpacing: "-0.01em",
                transition: "all 180ms",
              }}
            >
              {canSubmit ? "이 이름 평가받기 →" : "이름을 입력해주세요"}
            </button>
            {canSubmit && !birth && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12.5,
                  color: "var(--color-text-2)",
                  textAlign: "center",
                }}
              >
                출생일 없이 진행하면 미학 점수만 평가돼요
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            color: "var(--color-text-2)",
            flexWrap: "wrap",
            gap: 16,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <Link
            href="/"
            style={{ color: "var(--color-text-2)", textDecoration: "none" }}
          >
            ← 홈으로 돌아가기
          </Link>
          <span>
            추천을 받고 싶으시면?{" "}
            <Link
              href="/search"
              style={{
                color: "var(--color-teal)",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              작명하러 가기 →
            </Link>
          </span>
        </div>

        <section
          style={{
            marginTop: 40,
            padding: "28px 28px 24px",
            borderTop: "1px solid #F0EAE0",
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-text)",
              letterSpacing: "-0.01em",
            }}
          >
            평가 후 어떤 결과를 받나요?
          </h2>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 10,
            }}
          >
            <InfoRow
              icon={<Music size={20} strokeWidth={1.5} />}
              label="미학 점수"
              detail="발음·리듬·음절·세대중립"
            />
            <InfoRow
              icon={<Leaf size={20} strokeWidth={1.5} />}
              label="조화 점수"
              detail="오행·자원오행·음양·성조화 — 출생일 있을 때"
            />
            <InfoRow
              icon={<BookOpen size={20} strokeWidth={1.5} />}
              label="한자 후보 분석"
              detail="의미·신뢰도"
            />
          </ul>
        </section>
      </main>

      <footer
        style={{
          padding: "32px 24px 48px",
          borderTop: "1px solid var(--color-divider)",
          textAlign: "center",
          color: "var(--color-text-3)",
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
          <a
            href="#"
            style={{ color: "var(--color-text-3)", textDecoration: "none" }}
          >
            이름의 결에 대하여
          </a>
          <span style={{ color: "var(--color-divider)" }}>·</span>
          <a
            href="#"
            style={{ color: "var(--color-text-3)", textDecoration: "none" }}
          >
            문의
          </a>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Reusable atoms
// ============================================================
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "22px 24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text)",
          }}
        >
          {title}
        </label>
        {subtitle && (
          <span
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 12,
              color: "var(--color-text-3)",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#F0EAE0", margin: 0 }} />;
}

function Input({
  value,
  onChange,
  placeholder,
  invalid,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        appearance: "none",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        color: "var(--color-text)",
        padding: "12px 14px",
        background: "var(--color-surface)",
        border:
          "1px solid " +
          (invalid ? "var(--color-gold-600)" : "var(--color-border)"),
        borderRadius: "var(--radius-md)",
        outline: "none",
      }}
    />
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const formatted = value
    ? `${value.slice(0, 4)}년 ${parseInt(value.slice(5, 7), 10)}월 ${parseInt(value.slice(8, 10), 10)}일`
    : "";
  // SSR/hydration 안전: 클라이언트 마운트 후에만 today 설정
  const [today, setToday] = useState<string | undefined>(undefined);
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);
  return (
    <div style={{ position: "relative" }}>
      <input
        type="date"
        value={value}
        max={today}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "var(--font-sans)",
          fontSize: 15,
          color: value ? "transparent" : "var(--color-text-3)",
          padding: "12px 14px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          outline: "none",
        }}
      />
      {value && (
        <div
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            color: "var(--color-text)",
            pointerEvents: "none",
          }}
        >
          {formatted}
        </div>
      )}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: 6,
        background: "var(--color-surface-2)",
        padding: 4,
        borderRadius: "var(--radius-md)",
      }}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              appearance: "none",
              border: "none",
              padding: "9px 12px",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              background: active ? "var(--color-teal-50)" : "transparent",
              color: active ? "var(--color-teal)" : "var(--color-text-2)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 160ms",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function FieldHint({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: "info" | "warn";
}) {
  const color =
    kind === "warn" ? "var(--color-gold-600)" : "var(--color-text-3)";
  return (
    <div
      style={{ marginTop: 8, fontSize: 12.5, color, lineHeight: 1.5 }}
    >
      {children}
    </div>
  );
}

function NamePreview({
  lastName,
  firstName,
}: {
  lastName: string;
  firstName: string;
}) {
  const full = (lastName + firstName).trim();
  if (!full) {
    return (
      <div
        style={{
          padding: "16px 18px",
          background: "var(--color-background)",
          borderRadius: "var(--radius-md)",
          border: "1px dashed var(--color-divider)",
          color: "var(--color-text-3)",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        입력하시면 여기에 이름이 보여요
      </div>
    );
  }
  return (
    <div
      style={{
        padding: "18px 20px",
        background: "var(--color-background)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-divider)",
        display: "flex",
        alignItems: "baseline",
        gap: 10,
      }}
    >
      <span
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 10,
          color: "var(--color-text-3)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginRight: 4,
        }}
      >
        Preview
      </span>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 28,
          fontWeight: 500,
          color: "var(--color-text)",
          letterSpacing: "-0.015em",
          animation: "evalFadeIn 220ms cubic-bezier(.2,.6,.2,1)",
        }}
      >
        {full}
      </span>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  detail,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        fontSize: 13.5,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
        }}
      >
        {icon}
      </span>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <b style={{ fontWeight: 600, color: "var(--color-text)" }}>{label}</b>
        <span style={{ color: "var(--color-text-2)" }}>· {detail}</span>
      </div>
    </li>
  );
}

const helpToggleStyle: CSSProperties = {
  marginTop: 12,
  appearance: "none",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-text-2)",
};

const helpBodyStyle: CSSProperties = {
  marginTop: 10,
  padding: "12px 14px",
  background: "var(--color-background)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-divider)",
  fontSize: 13,
  color: "var(--color-text-2)",
  lineHeight: 1.65,
};
