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
    // 점수 없음 — 백엔드 응답(DualNameCandidate)은 한글·영어·한자·뜻뿐이다. 예전에는 순번으로 미학·조화·최종·희귀도를
    // 지어내(92−2i 등) 점수처럼 보였다(2026-10-28 제거). 점수 자리는 '이 이름 평가하기'(/evaluate) 링크
    return {
      rank: i + 1,
      englishName: c.englishEquivalent,
      koreanFull,
      koreanSyllables,
      englishSyllables,
      hanja,
      mappingNote: buildMappingNote(c),
      reasons: [],
    };
  });
}

/**
 * 결과를 받은 요청의 입력 — 결과 화면(조건 칩·'이 이름 평가하기' 링크)은 이 값을 쓴다.
 * 응답을 기다리는 동안(콜드 스타트 30초 안팎) 폼을 바꿔도 결과와 다른 조건이 링크에 실리지 않게 제출 때 잡아 둔다.
 */
interface SubmittedQuery {
  /** 요청에 보낸 성씨 그대로(앞뒤 공백 제거·2자) */
  lastName: string;
  preferredEnglishName: string;
  birthDate: string;
  birthTime: string;
  gender: "none" | "male" | "female";
  tone: "neutral" | "soft" | "strong";
}

/** 출생일을 비우고 제출했을 때의 오류 — 칸의 aria-invalid 도 이 문구가 떠 있는 동안만 켠다(/parent-based·/rare-surname 과 같은 말) */
const BIRTH_DATE_REQUIRED = "생년월일을 입력해 주세요.";
const ERROR_ID = "dual-name-error";
const BIRTH_DATE_ID = "dual-name-birthDate";

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
  const [submitted, setSubmitted] = useState<SubmittedQuery | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const birthDateMissing = error === BIRTH_DATE_REQUIRED && !birthDate;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!lastName.trim()) {
      setError("성씨를 입력해주세요.");
      return;
    }
    // 백엔드 dual-name 은 생년월일이 없으면 400('생년월일은 필수이며 YYYY-MM-DD 형식이어야 합니다') — 요청 전에 막는다.
    // 칸에 native required 를 달지 않아(브라우저 말풍선이 먼저 떠 이 안내가 안 나온다) 여기가 유일한 검사다.
    // 날짜를 덜 채운 칸도 value 가 "" 다
    if (!birthDate) {
      setError(BIRTH_DATE_REQUIRED);
      document.getElementById(BIRTH_DATE_ID)?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    setCandidates(null);

    const query: SubmittedQuery = {
      lastName: lastName.trim().slice(0, 2),
      preferredEnglishName: preferredEnglishName.trim(),
      birthDate,
      birthTime,
      gender,
      tone,
    };

    try {
      const data = await dualName({
        lastName: query.lastName,
        preferredEnglishName: query.preferredEnglishName || undefined,
        birthDate: query.birthDate,
        birthTime: query.birthTime || undefined,
        gender:
          query.gender === "none"
            ? undefined
            : query.gender === "male"
              ? "Male"
              : "Female",
        tone:
          query.tone === "neutral"
            ? "Neutral"
            : query.tone === "soft"
              ? "Soft"
              : "Strong",
      });
      setSubmitted(query);
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
  if (candidates && candidates.length > 0 && submitted) {
    const englishLabel =
      submitted.preferredEnglishName || candidates[0]?.englishEquivalent || "";
    const ctx: DualContext = {
      lastName: submitted.lastName,
      preferredEnglishName: englishLabel,
      mode,
      gender: submitted.gender === "none" ? "any" : submitted.gender,
      tone: submitted.tone,
      birthDate: submitted.birthDate,
      birthTime: submitted.birthTime,
    };
    return (
      <DualResultPage
        context={ctx}
        candidates={mapResponse(candidates)}
        onRegenerate={handleReset}
      />
    );
  }

  // 0건 안내의 영어 이름도 실제로 요청한 값(제출 스냅샷) — 응답을 기다리는 동안 칸을 고쳐도 고친 이름이 찍히지 않게
  const shownEnglish = submitted?.preferredEnglishName ?? "";

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
            {/* 출생일 — 백엔드 필수(없으면 400). 표시는 이 폼의 '(선택)'과 같은 꼴의 '(필수)'(/parent-based·/rare-surname 과 같은 말).
                native required 는 달지 않는다 — 브라우저 말풍선('이 입력란을 작성하세요.')이 먼저 떠 handleSubmit 이 돌지 않고
                아래 오류 상자의 '생년월일을 입력해 주세요.'가 나오지 않는다. 대신 aria-required, 빈 채로 제출해 그 오류가 떠 있는
                동안 aria-invalid·aria-describedby(오류 상자). 날짜를 넣으면 그 오류를 지운다(/rare-surname 과 같이) */}
            <Field label="출생일 (필수)" htmlFor={BIRTH_DATE_ID}>
              <Input
                id={BIRTH_DATE_ID}
                type="date"
                value={birthDate}
                onChange={(v) => {
                  setBirthDate(v);
                  if (v && error === BIRTH_DATE_REQUIRED) setError(null);
                }}
                ariaRequired
                ariaInvalid={birthDateMissing}
                ariaDescribedBy={birthDateMissing ? ERROR_ID : undefined}
              />
            </Field>
            <Field label="출생 시각 (선택 · 시주 반영)">
              <Input type="time" value={birthTime} onChange={setBirthTime} />
            </Field>
          </div>

          {/* 0건 — 예전에는 아무 말 없이 폼만 다시 보였다. 이중 이름은 모든 음절에 한자가 있어야 해서, 한글 소리에 이름에 쓸 만한
              인명용 한자가 없는 음절이 있으면(Emily·Amy 의 '에' — 2026-10-26 점수 정책 뒤 후보 0) 후보가 빠진다.
              영어 이름이 없을 때 결과를 가르는 것은 성별(EnglishKoreanNameMap.GetByGender)뿐이다 — 톤·출생일은
              DualNameEngine.GenerateDualNamesAsync 가 받기만 하고 쓰지 않아 '톤을 바꿔'라고 권하지 않는다 */}
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
              {shownEnglish
                ? `입력한 영어 이름(${shownEnglish})으로는 한자 이중 이름을 찾지 못했어요. 한글로 옮긴 소리 가운데 이름에 쓸 만한 인명용 한자가 없는 음절이 있거나, 아직 준비되지 않은 영어 이름이에요. 다른 영어 이름을 넣거나 칸을 비워 두면 성별에 맞는 이중 이름을 추천해 드려요.`
                : "조건에 맞는 이중 이름을 찾지 못했어요. 성별을 바꾸거나 영어 이름을 넣어 다시 시도해 보세요."}
            </div>
          )}

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
  htmlFor,
  children,
}: {
  label: string;
  /** 칸 id — 주면 라벨이 칸의 접근 이름이 된다(출생일: aria-required·aria-invalid 를 읽을 때 칸 이름이 함께 나오게) */
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
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
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  ariaRequired,
  ariaInvalid,
  ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  /** native required 없이 필수임을 알린다 — 브라우저 말풍선 대신 폼의 오류 상자로 안내하는 칸(출생일) */
  ariaRequired?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      aria-required={ariaRequired || undefined}
      aria-invalid={ariaInvalid || undefined}
      aria-describedby={ariaDescribedBy}
      style={{
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        color: "var(--color-text)",
        background: "var(--color-surface)",
        // 오류가 이 칸을 가리키는 동안 테두리를 아래 오류 상자 글자색으로(옆 화면 shadcn Input 의 aria-invalid 테두리와 같은 역할)
        border: ariaInvalid
          ? "1px solid #C45A4C"
          : "1px solid var(--color-border)",
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
