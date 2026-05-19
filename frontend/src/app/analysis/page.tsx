"use client";

import { useState, Suspense, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Button } from "@/components/design/Primitives";
import { SectionHead } from "@/components/design/DetailPrimitives";
import { DetailHero, type DetailHeroData } from "@/components/design/DetailHero";
import {
  KyeolBlocks,
  EumryeongTimeline,
  type EumryeongData,
} from "@/components/design/DetailMid";
import {
  SajuSection,
  VariantStrip,
  type SajuChartData,
  type NameVariant,
} from "@/components/design/DetailSaju";
import {
  HanjaBreakdown,
  type HanjaSyllableEntry,
  type ConfidenceGrade,
} from "@/components/design/DetailHanja";

import type { NameAnalysisResponse, SajuChartData as ApiSajuChart } from "@/lib/types";

// ============================================================
// 백엔드 → 디자인 어댑터
// ============================================================
function mapHeroData(
  res: NameAnalysisResponse,
  lastName: string
): DetailHeroData {
  const hanjaList = res.hanja ?? [];
  const lastNameLen = lastName.length;
  const givenHanja = hanjaList.slice(lastNameLen);
  return {
    fullName: res.fullName,
    aestheticScore: res.aestheticScore ?? 0,
    harmonyScore: res.harmonyScore ?? null,
    rarityScore: 0, // 백엔드 NameAnalysisResponse에 rarityScore 없음
    finalScore: res.finalScore ?? 0,
    hanjaCharacters: givenHanja.map((h) => h.character).join(""),
    hanjaMeanings: givenHanja.map((h) => h.meaning).join(" · "),
  };
}

// 평면 hanja[]를 음절별 그룹으로 매핑 (1음절당 1후보 — 백엔드 한계)
function mapHanjaBreakdown(
  res: NameAnalysisResponse,
  fullName: string
): HanjaSyllableEntry[] {
  const hanjaList = res.hanja ?? [];
  const syllables = [...fullName];
  return syllables.map((syl, i) => {
    const h = hanjaList[i];
    return {
      syllable: syl,
      possibleHanja: h
        ? [
            {
              character: h.character,
              meaning: h.meaning,
              fiveElement: h.fiveElement,
              strokeCount: h.strokeCount,
              // 백엔드 응답에 confidenceGrade 없음 — 기본 D
              confidenceGrade: "D" as ConfidenceGrade,
            },
          ]
        : [],
    };
  });
}

// SajuChartData (camelCase 그대로 전달)
function mapSaju(api?: ApiSajuChart): SajuChartData | null {
  if (!api) return null;
  return {
    yearPillar: api.yearPillar,
    monthPillar: api.monthPillar,
    dayPillar: api.dayPillar,
    hourPillar: api.hourPillar,
    fiveElementCount: api.fiveElementCount,
    missingElements: api.missingElements,
    dayMaster: api.dayMaster,
    birthplaceName: api.birthplaceName,
    correctionMinutes: api.correctionMinutes,
    yongshin: api.yongshin
      ? {
          strength:
            api.yongshin.strength === "Strong"
              ? "신강"
              : api.yongshin.strength === "Weak"
                ? "신약"
                : "중화",
          primaryYongshin: api.yongshin.primaryYongshin,
          strengthDescription: api.yongshin.strengthDescription,
          yongshinReason: api.yongshin.yongshinReason,
          nameFitsYongshin: api.yongshin.nameFitsYongshin,
        }
      : undefined,
  };
}

function mapEumryeong(res: NameAnalysisResponse): EumryeongData | null {
  if (!res.eumryeongAnalysis) return null;
  return {
    syllables: res.eumryeongAnalysis.syllables,
    dominantElement: res.eumryeongAnalysis.dominantElement,
    elementCount: res.eumryeongAnalysis.elementCount,
  };
}

// ============================================================
// 메인 페이지
// ============================================================
function AnalysisInner() {
  const searchParams = useSearchParams();
  const [lastName, setLastName] = useState(
    searchParams.get("lastName") ?? searchParams.get("surname") ?? ""
  );
  const [firstName, setFirstName] = useState(searchParams.get("name") ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("none");
  const [tone, setTone] = useState("neutral");

  const [result, setResult] = useState<NameAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1"}/name-analysis`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lastName,
            firstName,
            gender,
            tone,
            birthDate: birthDate || undefined,
            birthTime: birthTime || undefined,
          }),
        }
      );
      if (!res.ok) throw new Error("API 오류가 발생했어요.");
      const data = (await res.json()) as NameAnalysisResponse;
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요."
      );
    } finally {
      setLoading(false);
    }
  }

  // 결과 있을 때 — 디자인 페이지
  if (result) {
    const heroData = mapHeroData(result, lastName);
    const sajuData = mapSaju(result.saju);
    const eumryeongData = mapEumryeong(result);
    const hanjaBreakdown = mapHanjaBreakdown(result, result.fullName);

    // 강점/약점/추천이유: NameAnalysisResponse는 strengths/weaknesses만 제공
    const strengths = result.strengths ?? [];
    const weaknesses = result.weaknesses ?? [];
    const reasons: string[] = []; // 별도 필드 없음

    // 변형 이름은 NameAnalysisResponse에 없음 (Smart Result에 있음)
    const variants: NameVariant[] = [];

    return (
      <>
        <Header />
        <main
          style={{
            maxWidth: 880,
            margin: "0 auto",
            padding: "32px 32px 64px",
          }}
        >
          {/* Hero */}
          <DetailHero data={heroData} />

          {/* 강점/약점/추천이유 */}
          {(strengths.length > 0 || weaknesses.length > 0) && (
            <section style={{ marginTop: 48 }}>
              <SectionHead
                title="이름의 결"
                subtitle="강점·약점을 항목별로 살펴봐요"
              />
              <KyeolBlocks
                strengths={strengths}
                weaknesses={weaknesses}
                reasons={reasons}
              />
            </section>
          )}

          {/* 한자 분석 */}
          {hanjaBreakdown.length > 0 && (
            <section style={{ marginTop: 48 }}>
              <SectionHead
                title="한자 분석"
                subtitle="음절별 한자와 의미·오행을 살펴봐요"
              />
              <HanjaBreakdown breakdown={hanjaBreakdown} />
            </section>
          )}

          {/* 음령오행 */}
          {eumryeongData && (
            <section style={{ marginTop: 48 }}>
              <SectionHead
                title="음령오행"
                subtitle="초성에서 오는 기운의 흐름"
              />
              <EumryeongTimeline analysis={eumryeongData} />
            </section>
          )}

          {/* 사주 */}
          <section style={{ marginTop: 48 }}>
            <SectionHead
              title="사주 원국"
              subtitle="태어난 시점의 천간·지지와 오행 분포"
            />
            <SajuSection
              saju={sajuData}
              onOpenBirthInput={() => setResult(null)}
            />
          </section>

          {/* 변형 이름 */}
          {variants.length > 0 && (
            <section style={{ marginTop: 48 }}>
              <SectionHead
                title="다른 결의 이름"
                subtitle="살짝 변형해본 이름들"
              />
              <VariantStrip variants={variants} />
            </section>
          )}

          {/* 다시 분석 */}
          <div style={{ marginTop: 64, textAlign: "center" }}>
            <Button variant="ghost" onClick={() => setResult(null)}>
              ↻ 다른 이름 분석하기
            </Button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // 입력 폼
  return (
    <>
      <Header />
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
            Name Analysis · 이름 분석
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
            이름의 결, 한눈에 분석해드릴게요
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: 0,
            }}
          >
            미학·조화·사주 원국·용신·음령오행을 통합 분석해요
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Field label="성씨">
              <Input
                placeholder="예: 김"
                value={lastName}
                onChange={setLastName}
                required
              />
            </Field>
            <Field label="이름">
              <Input
                placeholder="예: 서윤"
                value={firstName}
                onChange={setFirstName}
                required
              />
            </Field>
          </div>

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
                onChange={setGender}
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
                onChange={setTone}
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
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Field label="생년월일 (사주 계산)">
              <Input type="date" value={birthDate} onChange={setBirthDate} />
            </Field>
            <Field label="태어난 시간 (시주, 선택)">
              <Input type="time" value={birthTime} onChange={setBirthTime} />
            </Field>
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
            {loading ? "분석 중..." : "이름 분석하기"}
          </Button>
        </form>
      </main>
      <Footer />
    </>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "48px 32px",
            color: "var(--color-text-2)",
          }}
        >
          로딩 중...
        </div>
      }
    >
      <AnalysisInner />
    </Suspense>
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
