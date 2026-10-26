"use client";

import { useState, Suspense, type FormEvent } from "react";
import Link from "next/link";
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
} from "@/components/design/DetailHanja";
import { toResourceGrade } from "@/components/design/resource-grade";

import { nameAnalysis } from "@/lib/api";
import type { NameAnalysisResponse, SajuChartData as ApiSajuChart } from "@/lib/types";

// ============================================================
// 백엔드 → 디자인 어댑터 (NameAnalysisResponseDto 필드 그대로)
// ⚠️ 2026-10-21 전에는 없는 res.hanja를 읽고 rarityScore를 0으로 고정해, '한자 분석'이
// 제목만 남고 유니크 타일 0과 강점 문구 '유니크 90점'이 한 화면에 함께 나왔다.
// ============================================================
function mapHeroData(res: NameAnalysisResponse): DetailHeroData {
  return {
    fullName: res.fullName,
    aestheticScore: res.aestheticScore ?? 0,
    harmonyScore: res.harmonyScore ?? null,
    rarityScore: res.rarityScore ?? 0,
    finalScore: res.finalScore ?? 0,
    // 분석은 한자를 고르지 않은 한글 이름을 본다 — 음절별 1순위 후보를 이 이름의
    // 한자처럼 히어로에 박지 않는다 (후보는 아래 '한자 분석'에서 음절별로 보여준다)
    hanjaCharacters: "",
    hanjaMeanings: "",
  };
}

// 음절별 한자 후보 (관련도순 상위 10개, 성씨 제외)
// 등급은 자원오행 판정 등급(R·V·X·U) — 2026-10-22 S7 전에는 옛 confidenceGrade 를 S·A·B·D 밖이면
// 모두 D 로 바꿔 그려, 뜻 키워드 판정(C)까지 획수로 자동 추정한 글자처럼 보였다
function mapHanjaBreakdown(res: NameAnalysisResponse): HanjaSyllableEntry[] {
  return (res.hanjaBreakdown ?? []).map((b) => ({
    syllable: b.syllable,
    possibleHanja: b.possibleHanja.map((h) => ({
      character: h.character,
      meaning: h.meaning,
      fiveElement: h.fiveElement ?? undefined,
      strokeCount: h.strokeCount ?? undefined,
      kangxiStrokes: h.kangxiStrokes ?? undefined,
      resourceGrade: toResourceGrade(h.resourceGrade),
      vReasons: h.vReasons ?? undefined,
      rationale: h.rationale ?? undefined,
    })),
  }));
}

// SajuChartData (camelCase 그대로 전달)
function mapSaju(api?: ApiSajuChart | null): SajuChartData | null {
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

// 추천 이유 방어 필터 (백엔드가 고치기 전 응답에도 안전하게)
// ⚠️ 2026-10-21: 출생일이 없으면 백엔드가 조화를 50으로 메워 '종합 68점 — 미학 75 · 조화 50'을
// 만들었고, 히어로는 종합 75·조화 타일 없음이라 한 화면에서 숫자가 어긋났다.
// - 조화 미산정(harmonyScore null)인데 조화 수치를 담은 줄은 숨긴다 ('조화 미산정' 문구는 통과)
// - 한자 줄('한자 뜻 —', 2026-10-21 백엔드 폴백 라벨 '한자 예 —')은 분석 경로에서 늘 음절별
//   1순위 후보라 이 이름의 한자처럼 읽히고, 폴백 훈이 독음과 어긋나기도 한다(하늘=乻 '땅 이름 얼').
//   히어로에서 한자를 비운 것과 같은 이유로 두 라벨 모두 숨기고(배포 순서와 무관하게),
//   후보는 '한자 분석'에서 음절별로 보여 준다
function filterAnalysisReasons(res: NameAnalysisResponse): string[] {
  const harmonyMissing = res.harmonyScore == null;
  return (res.reasons ?? []).filter((r) => {
    if (/^한자 (뜻|예) —/.test(r)) return false;
    if (harmonyMissing && /조화\s*\d/.test(r)) return false;
    return true;
  });
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
function AnalysisInner({
  onResultChange,
}: {
  /** 결과 화면으로 바뀌는지 — 바깥의 제목·소개를 숨기는 데 쓴다 */
  onResultChange: (showingResult: boolean) => void;
}) {
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

  // 결과 상태와 바깥 화면 전환을 한 번에 바꾼다 (같은 렌더에 묶여 깜빡임 없음)
  function showResult(next: NameAnalysisResponse | null) {
    setResult(next);
    onResultChange(next !== null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    showResult(null);

    try {
      const data = await nameAnalysis({
        lastName,
        firstName,
        gender,
        tone,
        birthDate: birthDate || undefined,
        birthTime: birthTime || undefined,
      });
      showResult(data);
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
    const heroData = mapHeroData(result);
    const sajuData = mapSaju(result.saju);
    const eumryeongData = mapEumryeong(result);
    const hanjaBreakdown = mapHanjaBreakdown(result);
    // 후보가 없는 음절(순한글 음절·후보가 모두 불용인 음절)도 '한글로 두기를 권해요' 한 줄을 그리므로(DetailHanja NoHanjaCard —
    // 2026-10-26 L4) 음절이 하나라도 있으면 섹션을 둔다. 옛 화면은 그런 음절 카드를 걸러, 후보 없는 음절만 있으면 섹션을 숨겼다
    const hasHanjaSection = hanjaBreakdown.length > 0;

    const strengths = result.strengths ?? [];
    const weaknesses = result.weaknesses ?? [];
    const reasons = filterAnalysisReasons(result);
    const variants: NameVariant[] = (result.reversalVariants ?? []).map((v) => ({
      name: v.name,
      variationType: v.variationType,
      description: v.description,
    }));

    return (
      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "32px 32px 64px",
        }}
      >
        {/* Hero */}
        <DetailHero data={heroData} />

        {/* 강점/약점/추천이유 */}
        {(strengths.length > 0 || weaknesses.length > 0 || reasons.length > 0) && (
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
        {hasHanjaSection && (
          <section style={{ marginTop: 48 }}>
            <SectionHead
              title="한자 분석"
              subtitle="음절별로 쓸 수 있는 한자 후보와 의미, 부수로 정한 자원오행을 살펴봐요"
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
            onOpenBirthInput={() => showResult(null)}
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
          <Button variant="ghost" onClick={() => showResult(null)}>
            ↻ 다른 이름 분석하기
          </Button>
        </div>
      </div>
    );
  }

  // 입력 폼
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "0 32px",
      }}
    >
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
    </div>
  );
}

/** 폼이 클라이언트에서 그려지기 전 자리 — 아래 소개·푸터가 밀려 내려오지 않게 높이만 잡는다 */
function FormFallback() {
  return (
    <div
      aria-hidden
      style={{ maxWidth: 720, margin: "0 auto", padding: "0 32px", minHeight: 340 }}
    />
  );
}

const introLink = {
  color: "var(--color-text)",
  textDecoration: "underline",
  textUnderlineOffset: 4,
} as const;

/** 정적 HTML에 그대로 나가는 도구 소개 — 무엇을 어떻게 보는지 (과장·단정 금지) */
function AnalysisIntro() {
  return (
    <section
      aria-labelledby="analysis-intro"
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 32px 64px",
      }}
    >
      <div
        style={{
          borderTop: "1px solid var(--color-divider)",
          paddingTop: 32,
          fontSize: 14,
          lineHeight: 1.75,
          color: "var(--color-text-2)",
        }}
      >
        <h2
          id="analysis-intro"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--color-text)",
            margin: "0 0 12px",
          }}
        >
          이름 분석은 이런 것을 봐요
        </h2>
        <p style={{ margin: "0 0 12px" }}>
          이미 정해 둔 이름이나 후보 이름을 넣으면, 성씨와 이어 부를 때의
          발음·리듬을 보는 미학 점수, 얼마나 흔한 이름인지 보여주는 유니크 지수,
          음절마다 쓸 수 있는 한자 후보의 뜻·자원오행·획수, 초성으로 보는
          음령오행 흐름을 한 화면에 정리해 드려요. 자원오행은 한자의 부수로
          정하고, 자료마다 다르게 보는 글자는 &lsquo;이견 있음&rsquo;, 부수
          자료가 적은 글자는 &lsquo;자료 적음&rsquo;으로 표시해요.
        </p>
        <p style={{ margin: "0 0 12px" }}>
          생년월일을 넣으면 사주 원국과 용신(억부·조후)을 계산해 조화 점수를
          더하고, 종합 점수는 미학 70%와 조화 30%로 매겨요. 생년월일이 없으면 종합
          점수는 미학 점수와 같아요. 사주 원국은 참고로 보여 드리고, 사주·오행으로
          본 조화는 종합 점수의 30%로만 반영해요.
        </p>
        <p style={{ margin: 0 }}>
          한자를 아직 정하지 않았다면{" "}
          <Link href="/hanja" style={introLink}>
            인명용 한자 사전
          </Link>
          에서 글자의 뜻을 살펴보고, 점수 계산 방식은{" "}
          <Link href="/method" style={introLink}>
            작명 원리
          </Link>
          에서 확인할 수 있어요.
        </p>
      </div>
    </section>
  );
}

export default function AnalysisPage() {
  const [showingResult, setShowingResult] = useState(false);
  return (
    <>
      <Header />
      <main>
        {!showingResult && (
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              padding: "48px 32px 0",
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
          </div>
        )}
        {/* useSearchParams(?lastName=&name=)는 정적 렌더링 시 Suspense 경계가 필요 —
            폼만 감싸서 헤더·제목·소개·푸터는 정적 HTML에 그대로 나가게 한다 */}
        <Suspense fallback={<FormFallback />}>
          <AnalysisInner onResultChange={setShowingResult} />
        </Suspense>
        {!showingResult && <AnalysisIntro />}
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
