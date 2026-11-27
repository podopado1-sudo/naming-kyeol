"use client";

import { useId, useState, Suspense, type FormEvent } from "react";
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
import { hasVisibleContent, kyeolSubtitle } from "@/components/design/eval-layout";

import { nameAnalysis } from "@/lib/api";
import {
  cleanNameInput,
  nameInputMessage,
  nameInputProblem,
  SURNAME_MAX_LENGTH,
} from "@/lib/name-input";
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
    correctionApplied: api.correctionApplied,
    termOnBirthDay: api.termOnBirthDay,
    yongshin: api.yongshin
      ? {
          strength:
            api.yongshin.strength === "Strong"
              ? "신강"
              : api.yongshin.strength === "Weak"
                ? "신약"
                : "중화",
          primaryYongshin: api.yongshin.primaryYongshin,
          // 카드 제목의 방식 이름('억부 용신'·'조후 용신')을 서버가 실제로 고른 쪽으로 정하는 데 쓴다(DetailSaju yongshinMethodLabel)
          eokbuYongshin: api.yongshin.eokbuYongshin,
          johuYongshin: api.yongshin.johuYongshin,
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
// - 한자 줄('한자 뜻 —', 2026-10-21 백엔드 폴백 라벨 '한자 예 —')은 출생일이 없으면 음절별
//   1순위 후보라 이 이름의 한자처럼 읽히고, 폴백 훈이 독음과 어긋나기도 한다(하늘=乻 '땅 이름 얼').
//   히어로에서 한자를 비운 것과 같은 이유로 두 라벨 모두 숨기고(배포 순서와 무관하게),
//   후보는 '한자 분석'에서 음절별로 보여 준다. 출생일이 있으면 백엔드가 점수에 쓴 배정 한자를 큰 카드(첫 후보)로
//   앞세우고 '한자 뜻' 줄도 그 글자다(2026-10-26 결정 ③) — 같은 글자가 카드에 있으니 줄은 그대로 숨긴다
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
// 성·이름 칸 검사 (2026-11-27 analysis-input-unvalidated)
// ⚠️ 전에는 다듬지도 검사하지도 않고 보내, 휴대폰 자동완성이 붙인 끝 공백('서윤 ')을 서버가 3글자로 보고
// 같은 제목 '김서윤' 아래 유니크 10 → 90·종합 64 → 68 로 채점했고, 한자·영문·낱자모(瑞潤·Daniel·ㅋㅋ)에도 점수를 냈다.
// 보낼 때는 cleanNameInput 으로 다듬은 값을 쓰고, 문제가 있으면 보내지 않는다. 주소(?lastName=&name=)로 채운 값도 같은 검사.
// ============================================================

/** 이 화면이 받는 이름 글자 수 — 서버 NameAnalysisRequestDto.FirstName 의 StringLength(10) */
const GIVEN_NAME_MAX_LENGTH = 10;

type NameField = "lastName" | "firstName";

interface NameFieldProblem {
  field: NameField;
  message: string;
}

/**
 * 성·이름 칸의 첫 문제(성씨 먼저) — 없으면 null. 값은 cleanNameInput 으로 다듬어 본다.
 * skipEmpty: 주소로 채운 값을 볼 때 — 비어 온 칸은 아직 문제가 아니다(이름만 실어 온 주소에 '성씨를 입력해주세요'를 띄우지 않는다)
 */
function analysisNameProblem(
  rawLast: string | null | undefined,
  rawFirst: string | null | undefined,
  skipEmpty = false
): NameFieldProblem | null {
  const fields = [
    { field: "lastName", value: cleanNameInput(rawLast), label: "성씨", max: SURNAME_MAX_LENGTH, empty: "성씨를 입력해주세요." },
    { field: "firstName", value: cleanNameInput(rawFirst), label: "이름", max: GIVEN_NAME_MAX_LENGTH, empty: "이름을 입력해주세요." },
  ] as const;
  for (const f of fields) {
    const problem = nameInputProblem(f.value, f.max);
    if (!problem) continue;
    if (problem === "empty") {
      if (skipEmpty) continue;
      return { field: f.field, message: f.empty };
    }
    return { field: f.field, message: nameInputMessage(problem, f.label, f.max) };
  }
  return null;
}

// 480px 이하: 결과 화면 좌우 여백 16px(점수 타일 2×2 는 DetailHero) — /evaluate eval-result-main 과 같은 규칙.
// 360px 기기에서 4열 점수 타일이 화면을 12px 넘겨 페이지 전체가 옆으로 밀렸다(2026-11-27 analysis-score-grid-overflow)
const ANALYSIS_RESULT_CSS = `
  @media (max-width: 480px) {
    .analysis-result { padding-left: 16px !important; padding-right: 16px !important; }
  }
`;

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
  // 칸 id — 라벨 htmlFor 와 짝짓는다(/ohaeng 과 같은 방식). 전에는 라벨이 칸과 이어지지 않아 화면 읽기 프로그램이
  // 성·이름 칸을 placeholder 로만, 성별·톤·생년월일·시각 칸은 이름 없이 읽었다(2026-11-27 labels-analysis)
  const uid = useId();
  const ids = {
    lastName: `${uid}-last`,
    firstName: `${uid}-first`,
    gender: `${uid}-gender`,
    tone: `${uid}-tone`,
    birthDate: `${uid}-date`,
    birthTime: `${uid}-time`,
    error: `${uid}-error`,
  };
  // 주소(?lastName=&name=)로 채우는 값도 다듬고(끝 공백·풀어 쓴 한글), 한글이 아니면 칸을 채운 채 이유를 먼저 보여 준다
  const [lastName, setLastName] = useState(() =>
    cleanNameInput(searchParams.get("lastName") ?? searchParams.get("surname"))
  );
  const [firstName, setFirstName] = useState(() => cleanNameInput(searchParams.get("name")));
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("none");
  const [tone, setTone] = useState("neutral");

  const [result, setResult] = useState<NameAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [prefillProblem] = useState(() => analysisNameProblem(lastName, firstName, true));
  const [error, setError] = useState<string | null>(prefillProblem?.message ?? null);
  /** 오류 문장이 가리키는 칸 — 그 칸에 aria-invalid·aria-describedby 를 켠다(서버 오류는 null) */
  const [errorField, setErrorField] = useState<NameField | null>(prefillProblem?.field ?? null);

  /** 오류가 가리키던 칸을 고치기 시작하면 그 문장을 거둔다 */
  function editName(field: NameField, value: string) {
    if (field === "lastName") setLastName(value);
    else setFirstName(value);
    if (errorField === field) {
      setError(null);
      setErrorField(null);
    }
  }

  function nameFieldA11y(field: NameField) {
    const flagged = errorField === field && error != null;
    return {
      ariaInvalid: flagged || undefined,
      ariaDescribedBy: flagged ? ids.error : undefined,
    };
  }

  // 결과 상태와 바깥 화면 전환을 한 번에 바꾼다 (같은 렌더에 묶여 깜빡임 없음)
  function showResult(next: NameAnalysisResponse | null) {
    setResult(next);
    onResultChange(next !== null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // 다듬은 값으로 검사하고 그 값을 보낸다 — 칸에도 다듬은 값을 다시 넣는다('서윤 ' → '서윤')
    const last = cleanNameInput(lastName);
    const first = cleanNameInput(firstName);
    setLastName(last);
    setFirstName(first);
    const problem = analysisNameProblem(last, first);
    if (problem) {
      setError(problem.message);
      setErrorField(problem.field);
      document.getElementById(ids[problem.field])?.focus();
      return;
    }

    setLoading(true);
    setError(null);
    setErrorField(null);
    showResult(null);

    try {
      const data = await nameAnalysis({
        lastName: last,
        firstName: first,
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
        className="analysis-result"
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "32px 32px 64px",
        }}
      >
        <style>{ANALYSIS_RESULT_CSS}</style>
        {/* Hero */}
        <DetailHero data={heroData} />

        {/* 강점/약점/추천이유 — 빈 쪽 상자는 KyeolBlocks 가 그리지 않고, 셋 다 보이는 줄이 없을 때만 절을 숨긴다
            (eval-layout.ts — /evaluate BR-1 과 같은 '보이는 줄' 기준, 2026-10-27) */}
        {(hasVisibleContent(strengths) || hasVisibleContent(weaknesses) || hasVisibleContent(reasons)) && (
          <section style={{ marginTop: 48 }}>
            <SectionHead
              title="이름의 결"
              subtitle={kyeolSubtitle(strengths, weaknesses)}
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

        {/* 다시 분석 — 인쇄에는 조작 단추를 싣지 않는다(globals.css [data-hide-print]) */}
        <div data-hide-print style={{ marginTop: 64, textAlign: "center" }}>
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
          <Field label="성씨" htmlFor={ids.lastName}>
            <Input
              id={ids.lastName}
              placeholder="예: 김"
              value={lastName}
              onChange={(v) => editName("lastName", v)}
              required
              {...nameFieldA11y("lastName")}
            />
          </Field>
          <Field label="이름" htmlFor={ids.firstName}>
            <Input
              id={ids.firstName}
              placeholder="예: 서윤"
              value={firstName}
              onChange={(v) => editName("firstName", v)}
              required
              {...nameFieldA11y("firstName")}
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
          <Field label="성별" htmlFor={ids.gender}>
            <Select
              id={ids.gender}
              value={gender}
              onChange={setGender}
              options={[
                { v: "none", l: "무관" },
                { v: "male", l: "남" },
                { v: "female", l: "여" },
              ]}
            />
          </Field>
          <Field label="톤" htmlFor={ids.tone}>
            <Select
              id={ids.tone}
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
          <Field label="생년월일 (사주 계산)" htmlFor={ids.birthDate}>
            <Input id={ids.birthDate} type="date" value={birthDate} onChange={setBirthDate} />
          </Field>
          <Field label="태어난 시간 (시주, 선택)" htmlFor={ids.birthTime}>
            <Input id={ids.birthTime} type="time" value={birthTime} onChange={setBirthTime} />
          </Field>
        </div>

        {error && (
          <div
            id={ids.error}
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
  htmlFor,
  children,
}: {
  label: string;
  /** 칸 id — 라벨을 칸과 잇는다 */
  htmlFor: string;
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
  ariaInvalid,
  ariaDescribedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
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
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
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
