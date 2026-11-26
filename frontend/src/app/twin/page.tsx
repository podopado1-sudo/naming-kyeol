"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Button } from "@/components/design/Primitives";
import { TwinResultPage } from "@/components/design/TwinResult";
import type { TwinContext } from "@/components/design/TwinResultTop";

import { twinNames } from "@/lib/api";
import { mapTwinResponse, twinGenderTone } from "@/lib/twin-sets";
import type { TwinNameResponse } from "@/lib/types";

// ============================================================
// 메인 페이지
// ============================================================
type Tone = "neutral" | "soft" | "strong";
type Gender = "none" | "male" | "female";

export default function TwinPage() {
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [childCount, setChildCount] = useState("2");
  const [gender, setGender] = useState<Gender>("none");
  const [tone, setTone] = useState<Tone>("neutral");

  const [result, setResult] = useState<TwinNameResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!lastName.trim()) {
      setError("성씨를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await twinNames({
        lastName: lastName.trim().slice(0, 2),
        birthDate: birthDate || undefined,
        birthTime: birthTime || undefined,
        // 서버 엔진은 소문자 값만 알아본다 — 대문자로 시작하는 값(Male·Soft)을 보내면 검사는 지나가지만 세트를 고를 때 성별·톤이 빠진다(lib/twin-sets.ts)
        ...twinGenderTone(gender, tone),
        childCount: parseInt(childCount, 10),
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "요청 중 오류가 발생했어요."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 결과 있을 때 — 디자인 컴포넌트 렌더
  if (result && result.nameSets.length > 0) {
    const themes = mapTwinResponse(result);
    const ctx: TwinContext = {
      lastName,
      count: parseInt(childCount, 10),
      relation: "any",
      tone,
    };
    return (
      <TwinResultPage
        context={ctx}
        themes={themes}
        onRegenerate={handleReset}
      />
    );
  }

  // 입력 폼
  return (
    <>
      <Header current="search" />
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 32px 64px",
        }}
      >
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
            둘이 함께, 각자 빛나는 이름
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: 0,
            }}
          >
            공유글자 · 공유의미 · 공유톤 — 세 가지 테마로 한 쌍을 골라드릴게요
          </p>
        </header>

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
          <FormField label="성씨">
            <FormInput
              placeholder="예: 김"
              value={lastName}
              // IME 조합 중 slice로 자르면 한글 입력이 끊기므로 제출 시에만 2자 제한
              onChange={setLastName}
              required
            />
          </FormField>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
            }}
          >
            <FormField label="자녀 수">
              <FormSelect
                value={childCount}
                onChange={setChildCount}
                options={[
                  { v: "2", l: "2명" },
                  { v: "3", l: "3명" },
                ]}
              />
            </FormField>
            <FormField label="성별">
              <FormSelect
                value={gender}
                onChange={(v) => setGender(v as Gender)}
                options={[
                  { v: "none", l: "무관" },
                  { v: "male", l: "남" },
                  { v: "female", l: "여" },
                ]}
              />
            </FormField>
            <FormField label="톤">
              <FormSelect
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 12,
            }}
          >
            <FormField label="출생일">
              <FormInput
                type="date"
                value={birthDate}
                onChange={setBirthDate}
              />
            </FormField>
            <FormField label="출생 시각 (선택 · 시주 반영)">
              <FormInput
                type="time"
                value={birthTime}
                onChange={setBirthTime}
              />
            </FormField>
          </div>

          {error && (
            <div
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
              {loading ? "추천 생성 중..." : "쌍둥이 이름 추천받기"}
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
      </main>
      <Footer />
    </>
  );
}

// ============================================================
// 폼 헬퍼 (간단)
// ============================================================
function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
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
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      style={{
        width: "100%",
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
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
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
