"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Button } from "@/components/design/Primitives";
import { DualResultPage } from "@/components/design/DualResult";
import type { DualCandidate, DualMode } from "@/components/design/DualCard";
import type { DualContext } from "@/components/design/DualResult";

import { dualName } from "@/lib/api";
import {
  buildMappingNote,
  splitEnglishToSyllables,
} from "@/lib/dual-name-mapping";
import type { DualNameCandidate } from "@/lib/types";

// ============================================================
// 백엔드 → 디자인 매핑
// ============================================================
function parseHanjaMeaning(
  hanjaMeaning: string,
  hanjaCharacters: string[]
): { char: string; meaning: string }[] {
  // "붓 필 + 설 립" 형태 파싱
  const parts = hanjaMeaning
    .split(/\s*[+·]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return hanjaCharacters.map((char, i) => ({
    char,
    meaning: parts[i] ?? "",
  }));
}

function syllabify(name: string): string[] {
  return [...name];
}

// 영어 음절 칩·매핑 줄은 lib/dual-name-mapping.ts — 조각이 음절보다 적게 나와 빈 '·  ↔ 언(…)'이 찍히던 분할을
// 음절 수만큼 나누도록 고쳤다(2026-10-27 — Ryan·Olivia·Diana·Aria 등)

function mapResponse(candidates: DualNameCandidate[]): DualCandidate[] {
  return candidates.map((c, i) => {
    const koreanSyllables = syllabify(c.koreanName);
    const englishSyllables = splitEnglishToSyllables(
      c.englishEquivalent,
      koreanSyllables.length
    );
    const hanja = parseHanjaMeaning(c.hanjaMeaning, c.hanjaCharacters);
    const koreanFull = `${c.koreanName}`; // 성씨는 카드에서 별도로 받음
    return {
      rank: i + 1,
      englishName: c.englishEquivalent,
      koreanFull,
      koreanSyllables,
      englishSyllables,
      hanja,
      // 백엔드는 점수 안 줌 — 표시용 mock (rank 기반 감소)
      scores: {
        aesthetic: Math.max(60, 92 - i * 2),
        harmony: Math.max(60, 88 - i * 2),
        final: Math.max(60, 90 - i * 2),
        rarity: Math.max(40, 80 - i * 4),
      },
      mappingNote: buildMappingNote(c),
      reasons: [],
    };
  });
}

// ============================================================
// 메인 페이지
// ============================================================
export default function DualNamePage() {
  const [lastName, setLastName] = useState("");
  const [preferredEnglishName, setPreferredEnglishName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState<"none" | "male" | "female">("none");
  const [tone, setTone] = useState<"neutral" | "soft" | "strong">("neutral");
  const [mode] = useState<DualMode>("phonetic");

  const [candidates, setCandidates] = useState<DualNameCandidate[] | null>(
    null
  );
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
    setCandidates(null);

    try {
      const data = await dualName({
        lastName: lastName.trim().slice(0, 2),
        preferredEnglishName: preferredEnglishName.trim() || undefined,
        birthDate: birthDate || undefined,
        birthTime: birthTime || undefined,
        gender:
          gender === "none"
            ? undefined
            : gender === "male"
              ? "Male"
              : "Female",
        tone:
          tone === "neutral"
            ? "Neutral"
            : tone === "soft"
              ? "Soft"
              : "Strong",
      });
      setCandidates(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "요청 중 오류가 발생했어요."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setCandidates(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 결과 있을 때 — 디자인 페이지
  if (candidates && candidates.length > 0) {
    const englishLabel =
      preferredEnglishName.trim() || candidates[0]?.englishEquivalent || "";
    const ctx: DualContext = {
      lastName,
      preferredEnglishName: englishLabel,
      mode,
      gender: gender === "none" ? "any" : gender,
      tone,
    };
    return (
      <DualResultPage
        context={ctx}
        candidates={mapResponse(candidates)}
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
            Dual Naming · 이중 이름
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
            한국과 세계, 한 이름에
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: 0,
            }}
          >
            영어 이름과 한자 이름이 음운·의미로 연결되는 짝을 찾아드릴게요
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
          <Field label="성씨">
            <Input
              placeholder="예: 김"
              value={lastName}
              // IME 조합 중 slice로 자르면 한글 입력이 끊기므로 제출 시에만 2자 제한
              onChange={setLastName}
              required
            />
          </Field>

          <Field label="선호 영어 이름 (선택)">
            <Input
              placeholder="예: Philip, Grace, Noah"
              value={preferredEnglishName}
              onChange={setPreferredEnglishName}
            />
          </Field>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Field label="성별">
              <Select
                value={gender}
                onChange={(v) => setGender(v as typeof gender)}
                options={[
                  { v: "none", l: "무관" },
                  { v: "male", l: "남" },
                  { v: "female", l: "여" },
                ]}
              />
            </Field>
            <Field label="톤">
              <Select
                value={tone}
                onChange={(v) => setTone(v as typeof tone)}
                options={[
                  { v: "neutral", l: "중립" },
                  { v: "soft", l: "부드러움" },
                  { v: "strong", l: "강함" },
                ]}
              />
            </Field>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 12,
            }}
          >
            <Field label="출생일">
              <Input type="date" value={birthDate} onChange={setBirthDate} />
            </Field>
            <Field label="출생 시각 (선택 · 시주 반영)">
              <Input type="time" value={birthTime} onChange={setBirthTime} />
            </Field>
          </div>

          {/* 0건 — 예전에는 아무 말 없이 폼만 다시 보였다. 이중 이름은 모든 음절에 한자가 있어야 해서, 한글 소리에 이름에 쓸 만한
              인명용 한자가 없는 음절이 있으면(Emily·Amy 의 '에' — 2026-10-26 점수 정책 뒤 후보 0) 후보가 빠진다 */}
          {candidates && candidates.length === 0 && !error && (
            <div
              role="status"
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--color-text-2)",
                background: "var(--color-surface-2)",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              {preferredEnglishName.trim()
                ? `입력한 영어 이름(${preferredEnglishName.trim()})으로는 한자 이중 이름을 찾지 못했어요. 한글로 옮긴 소리 가운데 이름에 쓸 만한 인명용 한자가 없는 음절이 있거나, 아직 준비되지 않은 영어 이름이에요. 다른 영어 이름을 넣거나 칸을 비워 두면 성별에 맞는 이중 이름을 추천해 드려요.`
                : "조건에 맞는 이중 이름을 찾지 못했어요. 성별이나 톤을 바꿔 다시 시도해 보세요."}
            </div>
          )}

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

          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            style={{ width: "100%", padding: "14px 28px", fontSize: 15 }}
          >
            {loading && (
              <Loader2
                className="size-4 animate-spin"
                style={{ marginRight: 6 }}
              />
            )}
            {loading ? "추천 생성 중..." : "이중 이름 추천받기"}
          </Button>
        </form>
      </main>
      <Footer />
    </>
  );
}

// ============================================================
// 폼 헬퍼
// ============================================================
function Field({
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

function Input({
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

function Select({
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
