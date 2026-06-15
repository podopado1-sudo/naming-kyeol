"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  EvaluateInputPage,
  type EvalSubmitPayload,
} from "@/components/design/EvaluateInput";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Button } from "@/components/design/Primitives";
import { SectionHead } from "@/components/design/DetailPrimitives";
import { BreakdownPanel } from "@/components/design/EvalPrimitives";
import {
  HanjaCandidatesTable,
  StrengthsCautions,
  NoteBlocks,
  type HanjaGroup,
} from "@/components/design/EvalBody";
import { ScoreTile } from "@/components/design/DetailPrimitives";

import { evaluate } from "@/lib/api";
import type { NameEvaluationResponse } from "@/lib/types";
import { Download, Heart, Share2 } from "lucide-react";
import { toggleFavorite, useIsFavorite } from "@/lib/favorites";
import { toast } from "sonner";

// ============================================================
// 백엔드 → 디자인 매핑
// ============================================================
function mapHanjaGroups(res: NameEvaluationResponse): HanjaGroup[] {
  return res.hanjaCandidates.map((g) => ({
    syllable: g.syllable,
    candidates: g.candidates.map((c) => ({
      character: c.character,
      meaning: c.meaning,
      fiveElement: c.fiveElement,
      strokeCount: c.strokeCount,
      confidenceGrade: c.confidenceGrade,
    })),
  }));
}

function genderLabel(g: EvalSubmitPayload["gender"]): string {
  if (g === "남아") return "male";
  if (g === "여아") return "female";
  return "none";
}

function toneLabel(t: EvalSubmitPayload["tone"]): string {
  if (t === "부드러운") return "soft";
  if (t === "강한") return "strong";
  return "neutral";
}

// ============================================================
// 메인 페이지
// ============================================================
function EvaluateInner() {
  const searchParams = useSearchParams();

  const initialLast = searchParams.get("lastName") ?? "";
  const initialFirst = searchParams.get("name") ?? "";
  const initialBirthDate = searchParams.get("birthDate") ?? "";
  const initialBirthTime = searchParams.get("birthTime") ?? "";
  const initialGender = searchParams.get("gender") ?? "";
  const initialTone = searchParams.get("tone") ?? "";

  const [result, setResult] = useState<NameEvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 마지막으로 자동 평가한 파라미터 시그니처 — 같은 이름 재요청만 막고,
  // 다른 이름(파라미터 변경)이 오면 재평가하도록 함 (라우터 인스턴스 보존 시 잔상 방지)
  const lastAutoSigRef = useRef("");

  async function handleSubmit(payload: EvalSubmitPayload) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await evaluate({
        lastName: payload.lastName,
        name: payload.firstName,
        birthDate: payload.birth || undefined,
        birthTime: payload.birthTime || undefined,
        gender: genderLabel(payload.gender),
        tone: toneLabel(payload.tone),
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요."
      );
    } finally {
      setLoading(false);
    }
  }

  // 추천 페이지의 "상세 보기"에서 넘어온 경우 — URL 파라미터가 바뀌면 (다른 이름) 자동 재평가
  useEffect(() => {
    if (!initialLast || !initialFirst || !initialBirthDate || !initialGender || !initialTone) return;
    const sig = [
      initialLast,
      initialFirst,
      initialBirthDate,
      initialBirthTime,
      initialGender,
      initialTone,
    ].join("|");
    if (lastAutoSigRef.current === sig) return; // 같은 이름 재요청 방지
    lastAutoSigRef.current = sig;

    let cancelled = false;
    setResult(null); // 이전 이름 결과 잔상 제거
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await evaluate({
          lastName: initialLast,
          name: initialFirst,
          birthDate: initialBirthDate,
          birthTime: initialBirthTime || undefined,
          gender: initialGender,
          tone: initialTone,
        });
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "평가 중 오류가 발생했어요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialLast, initialFirst, initialBirthDate, initialBirthTime, initialGender, initialTone]);

  // 결과 있을 때 — 디자인 페이지
  if (result) {
    return (
      <EvaluateResultView
        data={result}
        onReset={() => setResult(null)}
      />
    );
  }

  return (
    <>
      <EvaluateInputPage
        seed={{
          lastName: initialLast,
          firstName: initialFirst,
        }}
        onSubmit={handleSubmit}
      />
      {(loading || error) && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            background: error ? "rgba(196, 90, 76, 0.95)" : "var(--color-navy)",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 999,
            fontSize: 13,
            boxShadow: "var(--shadow-md)",
          }}
        >
          {loading && "평가 중..."}
          {error && error}
        </div>
      )}
    </>
  );
}

// ============================================================
// 결과 페이지
// ============================================================
function EvaluateResultView({
  data,
  onReset,
}: {
  data: NameEvaluationResponse;
  onReset: () => void;
}) {
  const aestheticRows = [
    { label: "발음", value: data.aesthetic.pronunciation, max: 30 },
    { label: "리듬", value: data.aesthetic.rhythm, max: 25 },
    { label: "음절", value: data.aesthetic.syllable, max: 15 },
    { label: "세대 중립", value: data.aesthetic.neutrality, max: 15 },
    { label: "의미", value: data.aesthetic.meaning, max: 10 },
    { label: "톤 보너스", value: data.aesthetic.toneBonus, max: 0, bonus: true },
    { label: "성별 보너스", value: data.aesthetic.genderBonus, max: 0, bonus: true },
    { label: "감점", value: -data.aesthetic.penalty, max: 0, bonus: true },
  ].filter((r) => r.max > 0 || r.value !== 0);

  const harmonyRows = [
    { label: "오행", value: data.harmony.fiveElement, max: 40 },
    { label: "자원오행", value: data.harmony.resourceElement, max: 30 },
    { label: "음양", value: data.harmony.yinYang, max: 20 },
    { label: "성 조화", value: data.harmony.surnameHarmony, max: 10 },
    { label: "성별 보너스", value: data.harmony.genderBonus, max: 0, bonus: true },
  ].filter((r) => r.max > 0 || r.value !== 0);

  const hanjaGroups = mapHanjaGroups(data);

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
        {/* Hero — 점수 4 tile */}
        <div style={{ paddingTop: 32, paddingBottom: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                fontSize: 40,
                lineHeight: 1.15,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                margin: 0,
                color: "var(--color-text)",
              }}
            >
              {data.fullName}
            </h1>
            <ResultActions data={data} />
          </div>
          <div
            style={{
              display: "inline-block",
              marginTop: 14,
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(43,43,43,0.05)",
              fontSize: 13,
              color: "var(--color-text-2)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.01em",
              fontFamily: "Inter, var(--font-pretendard), sans-serif",
            }}
          >
            {data.summary}
          </div>

          <div
            style={{
              marginTop: 32,
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            <ScoreTile
              value={data.aestheticScore}
              label="미학"
              variant="high"
            />
            <ScoreTile
              value={data.harmonyScore}
              label="조화"
              variant="mid"
            />
            <ScoreTile
              value={data.rarityScore}
              label="유니크"
              variant="mid"
            />
            <ScoreTile
              value={data.finalScore}
              label="종합"
              variant="primary"
              big
            />
          </div>
        </div>

        {/* 미학 Breakdown */}
        <section style={{ marginTop: 48 }}>
          <BreakdownPanel
            title="미학 점수"
            total={data.aestheticScore}
            rows={aestheticRows}
            notes={data.aesthetic.notes}
          />
        </section>

        {/* 조화 Breakdown */}
        <section style={{ marginTop: 48 }}>
          <BreakdownPanel
            title="조화 점수"
            total={data.harmonyScore}
            rows={harmonyRows}
            notes={data.harmony.notes}
            footer={
              data.harmony.usedFallback ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 14px",
                    background: "rgba(181,135,76,0.10)",
                    border: "1px solid rgba(181,135,76,0.3)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 12.5,
                    color: "#7A5B22",
                  }}
                >
                  ⚠ 한자 정보 부족으로 기본값을 사용했어요
                </div>
              ) : null
            }
          />
        </section>

        {/* 한자 후보 */}
        {hanjaGroups.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <SectionHead
              title="한자 후보"
              subtitle="음절별 한자와 신뢰도(S·A·B·D)를 살펴봐요"
            />
            <HanjaCandidatesTable groups={hanjaGroups} />
          </section>
        )}

        {/* 강점/참고 */}
        {(data.strengths.length > 0 || data.cautions.length > 0) && (
          <section style={{ marginTop: 48 }}>
            <SectionHead title="이름의 결" />
            <StrengthsCautions
              strengths={data.strengths}
              cautions={data.cautions}
            />
          </section>
        )}

        {/* 발음/의미 메모 */}
        {(data.pronunciationNote || data.meaningNote) && (
          <section style={{ marginTop: 32 }}>
            <NoteBlocks
              pronunciation={data.pronunciationNote}
              meaning={data.meaningNote}
            />
          </section>
        )}

        {/* 안내 — 결과는 참고용 */}
        <div
          style={{
            marginTop: 48,
            padding: "20px 22px",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-divider)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: 8,
            }}
          >
            이 평가는 시작점이에요
          </div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.75,
              color: "var(--color-text-2)",
              margin: 0,
            }}
          >
            처음부터 이름을 짓는 건 어려운 일이에요. 이 도구로 후보를 찾고,
            마음에 드는 이름은 사용하시고, 아쉬운 건 참고만 하세요. 결국 이름을
            정하는 건 당신의 몫입니다.
          </p>
        </div>

        {/* 다시 평가 */}
        <div className="hide-on-print" style={{ marginTop: 32, textAlign: "center" }}>
          <Button variant="ghost" onClick={onReset}>
            ↻ 다른 이름 평가하기
          </Button>
        </div>
      </main>
      <Footer />
    </>
  );
}

function ResultActions({ data }: { data: NameEvaluationResponse }) {
  const fav = useIsFavorite(data.fullName);

  function onSave() {
    toggleFavorite({
      fullName: data.fullName,
      lastName: data.fullName[0] ?? "",
      name: data.fullName.slice(1),
      finalScore: data.finalScore,
      aestheticScore: data.aestheticScore,
      harmonyScore: data.harmonyScore,
    });
    toast.success(fav ? "저장 해제" : "저장됨");
  }

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${data.fullName} - 이름 리포트`,
          text: `${data.fullName} 종합 ${data.finalScore}점`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("링크 복사됨");
      }
    } catch {
      // 사용자가 공유 취소 시 무시
    }
  }

  const btnStyle: React.CSSProperties = {
    appearance: "none",
    background: "transparent",
    border: "1px solid var(--color-divider)",
    borderRadius: 999,
    padding: "8px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--color-text)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  function onPdf() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <div className="hide-on-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={onSave} style={btnStyle} aria-pressed={fav}>
        <Heart
          size={14}
          strokeWidth={1.8}
          fill={fav ? "var(--color-teal)" : "none"}
          color={fav ? "var(--color-teal)" : "currentColor"}
        />
        {fav ? "저장됨" : "저장"}
      </button>
      <button type="button" onClick={onShare} style={btnStyle}>
        <Share2 size={14} strokeWidth={1.8} />
        공유
      </button>
      <button type="button" onClick={onPdf} style={btnStyle}>
        <Download size={14} strokeWidth={1.8} />
        PDF
      </button>
    </div>
  );
}

// URL 쿼리(이름/생일/성별/톤)가 바뀌면 EvaluateInner를 강제 리마운트.
// 추천 '상세 보기'로 다른 이름이 올 때, 라우터 캐시/bfcache로 이전 평가 결과가
// 잔존하던 문제를 근본 차단 (key가 바뀌면 React가 상태를 완전히 새로 시작).
function EvaluateRoute() {
  const searchParams = useSearchParams();
  return <EvaluateInner key={searchParams.toString()} />;
}

export default function EvaluatePage() {
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
      <EvaluateRoute />
    </Suspense>
  );
}
