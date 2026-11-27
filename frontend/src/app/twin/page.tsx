"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Button } from "@/components/design/Primitives";
import { TwinResultPage } from "@/components/design/TwinResult";
import type { TwinContext } from "@/components/design/TwinResultTop";

import { twinNames } from "@/lib/api";
import {
  cleanNameInput,
  nameInputMessage,
  nameInputProblem,
  SURNAME_MAX_LENGTH,
} from "@/lib/name-input";
import { mapTwinResponse, twinGenderTone } from "@/lib/twin-sets";
import type { TwinNameResponse } from "@/lib/types";

// ============================================================
// 메인 페이지
// ============================================================
type Tone = "neutral" | "soft" | "strong";
type Gender = "none" | "male" | "female";

/** 칸 id — 라벨(htmlFor)·제출 전 검사의 포커스·오류 상자 연결이 함께 쓴다 */
const FIELD_ID = {
  lastName: "twin-lastName",
  childCount: "twin-childCount",
  gender: "twin-gender",
  tone: "twin-tone",
  birthDate: "twin-birthDate",
  birthTime: "twin-birthTime",
} as const;
const ERROR_ID = "twin-error";

const SURNAME_MISSING = "성씨를 입력해주세요.";
/** 백엔드 /twin-names 는 생년월일이 없으면 400 — 제출 전에 막고 이 문장을 오류 상자에 보인다(/rare-surname 과 같은 문장) */
const BIRTH_DATE_MISSING = "생년월일을 입력해 주세요.";

export default function TwinPage() {
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [childCount, setChildCount] = useState("2");
  const [gender, setGender] = useState<Gender>("none");
  const [tone, setTone] = useState<Tone>("neutral");

  const [result, setResult] = useState<TwinNameResponse | null>(null);
  // 결과 화면의 조건 — 제출 때 잡은 값. 응답을 기다리는 동안(콜드 스타트 수십 초) 폼을 고쳐도 결과의 칩·제목·'상세 보기' 링크는 요청한 조건 그대로다
  const [submitted, setSubmitted] = useState<TwinContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 제출 전 검사에 걸린 칸 — aria-invalid·aria-describedby 를 그 칸에만 단다 */
  const [invalidField, setInvalidField] = useState<"lastName" | "birthDate" | null>(null);

  function fail(field: "lastName" | "birthDate", message: string) {
    setError(message);
    setInvalidField(field);
    document.getElementById(FIELD_ID[field])?.focus();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // 성씨 — 다듬은 값(NFC·앞뒤 공백)을 검사하고 그대로 보낸다. 예전에는 앞 두 글자로 잘라 보내서('남궁민' → '남궁')
    // 결과 제목·카드에는 넣은 글자 그대로('남궁민 씨…')가 찍혔다
    const surname = cleanNameInput(lastName);
    const problem = nameInputProblem(surname, SURNAME_MAX_LENGTH);
    if (problem) {
      fail(
        "lastName",
        problem === "empty"
          ? SURNAME_MISSING
          : nameInputMessage(problem, "성씨", SURNAME_MAX_LENGTH)
      );
      return;
    }
    // 생년월일 — 서버 필수(없으면 400 '생년월일은 필수이며 YYYY-MM-DD 형식이어야 합니다'). 여기 오는 빈 값은 비워 둔 칸뿐이다 —
    // 덜 채운 날짜·시각(value "" + validity.badInput)은 폼에 noValidate 가 없어 브라우저가 제출 전에 막는다(시각만 덜 채우고 시주 없이 보내지 않게)
    if (!birthDate) {
      fail("birthDate", BIRTH_DATE_MISSING);
      return;
    }

    const ctx: TwinContext = {
      lastName: surname,
      count: childCount === "3" ? 3 : 2,
      gender,
      tone,
      birthDate,
      birthTime,
    };

    setLoading(true);
    setError(null);
    setInvalidField(null);
    setResult(null);
    setSubmitted(null);

    try {
      const data = await twinNames({
        lastName: ctx.lastName,
        birthDate: ctx.birthDate,
        birthTime: ctx.birthTime || undefined,
        // 서버 엔진은 소문자 값만 알아본다 — 대문자로 시작하는 값(Male·Soft)을 보내면 검사는 지나가지만 세트를 고를 때 성별·톤이 빠진다(lib/twin-sets.ts)
        ...twinGenderTone(gender, tone),
        childCount: ctx.count,
      });
      setResult(data);
      setSubmitted(ctx);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "요청 중 오류가 발생했어요."
      );
    } finally {
      setLoading(false);
    }
  }

  // '← 조건 수정' — 결과만 지운다. 입력 칸 값은 남아 있어 고쳐서 다시 받을 수 있다
  function handleReset() {
    setResult(null);
    setSubmitted(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 결과 있을 때 — 디자인 컴포넌트 렌더
  if (result && submitted && result.nameSets.length > 0) {
    const themes = mapTwinResponse(result);
    return (
      <TwinResultPage
        context={submitted}
        themes={themes}
        onRegenerate={handleReset}
      />
    );
  }

  const three = childCount === "3";
  const surnameInvalid = invalidField === "lastName" && error !== null;
  const birthDateInvalid = invalidField === "birthDate" && error !== null;

  // 입력 폼
  return (
    <>
      <Header current="search" />
      <main className="twin-form-main">
        <header style={{ marginBottom: 40, textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-teal)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Twin Naming · 쌍둥이 이름
          </div>
          {/* 자녀 수에 맞춰 — 3명을 고르면 '둘이'·'한 쌍'이라 쓰지 않는다(첫 화면은 2명 기본값이라 예전 문장 그대로) */}
          <h1
            style={{
              fontSize: 36,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: 0,
              marginBottom: 12,
            }}
          >
            {three ? "셋이 함께, 각자 빛나는 이름" : "둘이 함께, 각자 빛나는 이름"}
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: 0,
            }}
          >
            {three
              ? "공유글자 · 공유의미 · 공유톤 — 세 가지 테마로 세 이름을 한 세트로 골라드릴게요"
              : "공유글자 · 공유의미 · 공유톤 — 세 가지 테마로 한 쌍을 골라드릴게요"}
          </p>
        </header>

        {/* noValidate 를 달지 않는다 — 칸에 네이티브 required·min·max 가 없어 빈 칸 검사는 handleSubmit 이 하고, 브라우저 검사는 덜 채운
            날짜·시각(badInput)만 막는다. noValidate 를 달면 '09:--'처럼 시만 넣은 시각이 "" 로 읽혀 안내 없이 시주 없이 채점된다 */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-md)",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <FormField id={FIELD_ID.lastName} label="성씨">
            <FormInput
              id={FIELD_ID.lastName}
              placeholder="예: 김"
              value={lastName}
              // IME 조합 중에 값을 고치면 한글 입력이 끊기므로 다듬기·검사는 제출 때만
              onChange={(v) => {
                setLastName(v);
                if (surnameInvalid) {
                  setError(null);
                  setInvalidField(null);
                }
              }}
              ariaRequired
              invalid={surnameInvalid}
              describedBy={surnameInvalid ? ERROR_ID : undefined}
              autoComplete="family-name"
            />
          </FormField>

          <div className="twin-form-row3">
            <FormField id={FIELD_ID.childCount} label="자녀 수">
              <FormSelect
                id={FIELD_ID.childCount}
                value={childCount}
                onChange={setChildCount}
                options={[
                  { v: "2", l: "2명" },
                  { v: "3", l: "3명" },
                ]}
              />
            </FormField>
            <FormField id={FIELD_ID.gender} label="성별">
              <FormSelect
                id={FIELD_ID.gender}
                value={gender}
                onChange={(v) => setGender(v as Gender)}
                options={[
                  { v: "none", l: "무관" },
                  { v: "male", l: "남" },
                  { v: "female", l: "여" },
                ]}
              />
            </FormField>
            <FormField id={FIELD_ID.tone} label="톤">
              <FormSelect
                id={FIELD_ID.tone}
                value={tone}
                onChange={(v) => setTone(v as Tone)}
                options={[
                  { v: "neutral", l: "중립" },
                  { v: "soft", l: "부드러움" },
                  { v: "strong", l: "강함" },
                ]}
              />
            </FormField>
          </div>

          <div className="twin-form-row2">
            {/* 출생일 — 서버 필수(없으면 400). 표시는 옆 '(선택 …)'과 같은 꼴의 '(필수)'. 네이티브 required 는 브라우저 말풍선이 먼저 떠
                아래 오류 상자의 안내가 나오지 않아 aria-required 로 알린다(/rare-surname·/dual-name 과 같은 방식 — 그 폼들처럼 noValidate 없이) */}
            <FormField id={FIELD_ID.birthDate} label="출생일 (필수)">
              <FormInput
                id={FIELD_ID.birthDate}
                type="date"
                value={birthDate}
                onChange={(v) => {
                  setBirthDate(v);
                  if (v && birthDateInvalid) {
                    setError(null);
                    setInvalidField(null);
                  }
                }}
                ariaRequired
                invalid={birthDateInvalid}
                describedBy={birthDateInvalid ? ERROR_ID : undefined}
              />
            </FormField>
            <FormField id={FIELD_ID.birthTime} label="출생 시각 (선택 · 시주 반영)">
              <FormInput
                id={FIELD_ID.birthTime}
                type="time"
                value={birthTime}
                onChange={setBirthTime}
              />
            </FormField>
          </div>

          {error && (
            <div
              id={ERROR_ID}
              role="alert"
              style={{
                fontSize: 13,
                color: "#C45A4C",
                background: "rgba(196, 90, 76, 0.08)",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginTop: 4 }}>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              style={{ width: "100%", padding: "14px 28px", fontSize: 15 }}
            >
              {loading && (
                <Loader2 className="size-4 animate-spin" style={{ marginRight: 6 }} />
              )}
              {loading
                ? "추천 생성 중..."
                : three
                  ? "세쌍둥이 이름 추천받기"
                  : "쌍둥이 이름 추천받기"}
            </Button>
          </div>
        </form>

        {result && result.nameSets.length === 0 && (
          <div
            style={{
              marginTop: 24,
              padding: 24,
              background: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              textAlign: "center",
              color: "var(--color-text-2)",
            }}
          >
            추천 결과가 없어요. 조건을 바꿔서 다시 시도해주세요.
          </div>
        )}

        {/* 좁은 폭 배치 — 예전 인라인 격자('1fr 1fr 1fr'·'1.4fr 1fr')는 날짜·시각 칸의 최소 폭 때문에 줄지 않아 375 폭에서 시각 칸이 카드 밖으로 나갔다.
            열은 minmax(0, …) 로 두고, 640 이하에서 날짜·시각을, 480 이하에서 세 선택 칸을 한 줄씩 쌓는다 */}
        <style>{`
          .twin-form-main {
            max-width: 720px;
            margin: 0 auto;
            padding: 48px 32px 64px;
          }
          .twin-form-row3 {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }
          .twin-form-row2 {
            display: grid;
            grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
            gap: 12px;
          }
          @media (max-width: 640px) {
            .twin-form-main {
              padding: 32px 16px 48px;
            }
            .twin-form-row2 {
              grid-template-columns: minmax(0, 1fr);
            }
          }
          @media (max-width: 480px) {
            .twin-form-row3 {
              grid-template-columns: minmax(0, 1fr);
            }
          }
        `}</style>
      </main>
      <Footer />
    </>
  );
}

// ============================================================
// 폼 헬퍼 (간단) — 라벨은 htmlFor 로 칸 id 와 잇는다(예전 <label> 에는 htmlFor 가 없어 화면 읽기 프로그램이 칸 이름을 읽지 못했다)
// ============================================================
function FormField({
  id,
  label,
  children,
}: {
  /** 안에 든 칸의 id — 칸에도 같은 값을 준다 */
  id: string;
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 12,
          color: "var(--color-text-2)",
          fontWeight: 500,
          marginBottom: 6,
          display: "block",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function FormInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  ariaRequired,
  invalid,
  describedBy,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  ariaRequired?: boolean;
  invalid?: boolean;
  describedBy?: string;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-required={ariaRequired || undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      autoComplete={autoComplete}
      style={{
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        color: "var(--color-text)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        outline: "none",
        minHeight: 40,
      }}
    />
  );
}

function FormSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        minWidth: 0,
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        color: "var(--color-text)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        outline: "none",
        minHeight: 40,
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' stroke='%235a6b7a' stroke-width='1.3' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: 32,
      }}
    >
      {options.map((opt) => (
        <option key={opt.v} value={opt.v}>
          {opt.l}
        </option>
      ))}
    </select>
  );
}
