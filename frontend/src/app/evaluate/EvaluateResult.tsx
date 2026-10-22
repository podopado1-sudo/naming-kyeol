"use client";

/**
 * /evaluate 결과 화면 — 점수 타일 + 미학·조화 Breakdown + 한자 후보 + 강점/참고 + 다음 단계.
 * 사이트 Header/Footer는 page.tsx가 감싼다.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Download, Heart, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/design/Primitives";
import { ScoreTile, SectionHead } from "@/components/design/DetailPrimitives";
import { BreakdownPanel } from "@/components/design/EvalPrimitives";
import {
  HanjaCandidatesTable,
  NoteBlocks,
  StrengthsCautions,
  type HanjaGroup,
} from "@/components/design/EvalBody";
import { toResourceGrade } from "@/components/design/resource-grade";
import { toggleFavorite, useIsFavorite } from "@/lib/favorites";
import type { GenerationFit, NameEvaluationResponse } from "@/lib/types";

import { evaluateHref, similarSearchHref, type EvalInput } from "./evaluate-params";

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
      // 자원오행 판정 등급(R·V·X·U) — 옛 confidenceGrade(S/C/D, 뜻 기반)는 자원오행과 무관해 읽지 않는다
      resourceGrade: toResourceGrade(c.resourceGrade),
      // V 를 '이견 있음'·'자료 적음'·'추정'으로 나누는 이유 목록(백엔드 S7 — 옛 백엔드면 없어 V 는 '이견 있음')
      vReasons: c.vReasons ?? undefined,
    })),
  }));
}

// 360px 기기에서 4열 타일 그리드가 뷰포트를 넘어 문서 폭이 373px까지 늘었다(감사 UX-2).
// 480px 이하: main 좌우 16px, 점수 타일 2열(홀수 개면 마지막 '종합'이 한 줄 전체), 본문 2열 그리드 1열.
const RESULT_CSS = `
  @media (max-width: 480px) {
    .eval-result-main { padding-left: 16px !important; padding-right: 16px !important; }
    .eval-result-title { font-size: 32px !important; }
    .eval-score-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .eval-score-grid > :last-child:nth-child(odd) { grid-column: 1 / -1; }
    .eval-2col { grid-template-columns: 1fr !important; }
  }
`;

// ============================================================
// 결과 페이지
// ============================================================
export function EvaluateResultView({
  data,
  input,
  onReset,
}: {
  data: NameEvaluationResponse;
  /** 이 결과를 낸 입력 — 저장·공유·다음 단계 링크가 쓴다 (fullName을 잘라 쓰면 복성이 깨진다) */
  input: EvalInput;
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

  // HarmonyEngine 산식 그대로 — 자원오행 보완 30 + 획수 조화 20 + 음양 10 + 발음오행 25 + 수리 15 (+성별 보정).
  // 축 이름은 2026-10-22 S4 백엔드와 같다: fiveElement = 자원오행 보완(배정 한자의 부수 기준 자원오행 ↔ 사주),
  // resourceElement = 획수 조화(두 글자 획수 합 — 오행 무관, 옛 화면 이름 '자원오행'). 필드명은 호환으로 유지.
  // 예전 막대는 옛 만점 40/30/20/10에 폐기 필드 '성 조화'(항상 0)를 그려 합계(41)가 총점(75)과 안 맞았다(감사 EV-2).
  // 수리 표기는 백엔드 노트와 같은 '전통 81수리(참고)' (감사 EV-4).
  const harmonyRows = [
    { label: "자원오행 보완", value: data.harmony.fiveElement, max: 30 },
    { label: "획수 조화", value: data.harmony.resourceElement, max: 20 },
    { label: "음양", value: data.harmony.yinYang, max: 10 },
    { label: "발음오행", value: data.harmony.pronunciationElement, max: 25 },
    { label: "전통 81수리(참고)", value: data.harmony.suriSagyeok, max: 15 },
    { label: "성별 보너스", value: data.harmony.genderBonus, max: 0, bonus: true },
  ].filter((r) => r.max > 0 || r.value !== 0);

  const hanjaGroups = mapHanjaGroups(data);

  return (
    <main
      className="eval-result-main"
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "32px 32px 64px",
      }}
    >
      <style>{RESULT_CSS}</style>

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
            className="eval-result-title"
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
          <ResultActions data={data} input={input} />
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

        {data.generationFit && data.generationFit.fitLevel !== "perfect" && (
          <div style={{ marginTop: 12 }}>
            <GenerationChip fit={data.generationFit} />
          </div>
        )}

        <div
          className="eval-score-grid"
          style={{
            marginTop: 32,
            display: "grid",
            gridTemplateColumns: `repeat(${
              data.birthDateProvided === false ? 3 : 4
            }, 1fr)`,
            gap: 12,
          }}
        >
          <ScoreTile value={data.aestheticScore} label="미학" variant="high" />
          {/* 조화는 출생일(사주)이 있어야 산정 — 없으면 타일 자체를 숨긴다 */}
          {data.birthDateProvided !== false && (
            <ScoreTile value={data.harmonyScore} label="조화" variant="mid" />
          )}
          <ScoreTile value={data.rarityScore} label="유니크" variant="mid" />
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

      {/* 조화 Breakdown — 출생일이 있을 때만. 없으면 안내 카드로 대체 */}
      {data.birthDateProvided === false ? (
        <section style={{ marginTop: 48 }}>
          <div
            style={{
              padding: "18px 20px",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-divider)",
              borderRadius: "var(--radius-md)",
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
            }}
          >
            출생일을 입력하지 않아 <strong>사주 기반 조화 점수</strong>는
            산정하지 않았어요. 종합 점수는 미학 점수만으로 계산됩니다.
            출생일을 넣으면 자원오행 보완·획수 조화·음양·발음오행·전통 81수리까지
            함께 평가해 드려요.
          </div>
        </section>
      ) : (
        <section style={{ marginTop: 48 }}>
          <BreakdownPanel
            title="조화 점수"
            total={data.harmonyScore}
            rows={harmonyRows}
            notes={data.harmony.notes}
            footer={
              <>
                <p
                  style={{
                    margin: "14px 0 0",
                    fontSize: 12.5,
                    lineHeight: 1.65,
                    color: "var(--color-text-3)",
                  }}
                >
                  전통 81수리는 한자 획수로 길흉을 나누는 옛 작명 기준이에요.
                  조화 점수에 15점 만점으로 들어가지만, 길흉 표기는 참고로만 봐
                  주세요.
                </p>
                {data.harmony.usedFallback ? (
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
                ) : null}
              </>
            }
          />
        </section>
      )}

      {/* 한자 후보 */}
      {hanjaGroups.length > 0 && (
        <section style={{ marginTop: 48 }}>
          {/* 후보 표는 음절별 목록이라 점수에 쓴 한자와 다를 수 있다 — 어느 쪽인지 밝혀 둔다 (감사 EV-3) */}
          <SectionHead
            title="한자 후보"
            subtitle="음절마다 쓸 수 있는 한자와 부수로 정한 자원오행, 그 판정 등급(확정·이견 있음·예외 적용)이에요. 점수 계산에 쓴 한자는 아래 '의미 메모'에 적어 두었어요."
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

      <NextSteps input={input} />

      {/* 다시 평가 */}
      <div className="hide-on-print" style={{ marginTop: 32, textAlign: "center" }}>
        <Button variant="ghost" onClick={onReset}>
          ↻ 다른 이름 평가하기
        </Button>
      </div>
    </main>
  );
}

// ============================================================
// 다음 단계 — 이름 뜻 사전(수록된 이름만) · 같은 조건 추천 (감사 EV-7)
// ============================================================

/**
 * /name/[이름] 수록 여부 — 수록 판정(name-seo.ts getName: 데이터 존재 + 드립 개방일 도래)은
 * 빌드 타임 서버 전용이고 데이터가 3MB라 클라이언트로 못 가져온다. /name/[slug]는
 * generateStaticParams(=getAllNames) + dynamicParams=false라 수록 이름만 정적 페이지가 있고
 * 나머지는 404다 — 그 정적 라우트에 HEAD로 물어 같은 게이트를 그대로 쓴다. 실패하면 링크 생략.
 */
function useNamePageExists(name: string): boolean {
  const [checked, setChecked] = useState<{ name: string; ok: boolean } | null>(
    null
  );
  useEffect(() => {
    let cancelled = false;
    fetch(`/name/${encodeURIComponent(name)}`, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setChecked({ name, ok: res.ok });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [name]);
  return checked?.name === name && checked.ok;
}

function NextSteps({ input }: { input: EvalInput }) {
  const hasNamePage = useNamePageExists(input.name);

  const linkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 18px",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-divider)",
    textDecoration: "none",
    color: "var(--color-text)",
  };
  const subStyle: React.CSSProperties = {
    display: "block",
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 1.55,
    color: "var(--color-text-2)",
  };

  return (
    <nav
      aria-label="다음 단계"
      className="hide-on-print"
      style={{ marginTop: 32, display: "grid", gap: 10 }}
    >
      {hasNamePage && (
        <Link href={`/name/${encodeURIComponent(input.name)}`} style={linkStyle}>
          <span>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>
              ‘{input.name}’ 이름 뜻·인기 순위 보기
            </span>
            <span style={subStyle}>
              출생신고 통계로 본 인기 순위와 남녀 비율, 이름에 어울리는 한자 조합
            </span>
          </span>
          <span aria-hidden style={{ color: "var(--color-teal)" }}>
            →
          </span>
        </Link>
      )}
      <Link href={similarSearchHref(input)} style={linkStyle}>
        <span>
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>
            이 조건으로 비슷한 이름 추천받기
          </span>
          <span style={subStyle}>
            {input.birthDate
              ? "같은 성씨·출생일·성별·톤으로 후보를 새로 찾아 드려요"
              : "같은 성씨로 후보를 찾아요 — 추천에는 생년월일이 필요해요"}
          </span>
        </span>
        <span aria-hidden style={{ color: "var(--color-teal)" }}>
          →
        </span>
      </Link>
    </nav>
  );
}

// 세대 감각 칩 — fitLevel별 색/아이콘. perfect는 호출부에서 제외(잡음 방지).
function GenerationChip({ fit }: { fit: GenerationFit }) {
  const palette = {
    timeless: {
      bg: "rgba(46,125,122,0.10)",
      border: "rgba(46,125,122,0.32)",
      color: "var(--color-teal)",
    },
    mild_mismatch: {
      bg: "rgba(201,169,110,0.14)",
      border: "rgba(201,169,110,0.42)",
      color: "#8A6A2E",
    },
    strong_mismatch: {
      bg: "rgba(181,135,76,0.14)",
      border: "rgba(181,135,76,0.46)",
      color: "#7A5B22",
    },
    perfect: {
      bg: "rgba(46,125,122,0.10)",
      border: "rgba(46,125,122,0.32)",
      color: "var(--color-teal)",
    },
  }[fit.fitLevel];

  const isTimeless = fit.fitLevel === "timeless";
  const Icon = isTimeless ? Sparkles : Clock;
  const prefix = isTimeless ? "세대 중립" : "세대 감각";

  return (
    <span
      title={fit.description}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 13px",
        borderRadius: 999,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      <Icon size={13} strokeWidth={2} />
      <span>
        {prefix}
        <span style={{ opacity: 0.55, fontWeight: 500 }}> · </span>
        <span style={{ fontWeight: 500 }}>{fit.headline}</span>
      </span>
    </span>
  );
}

function ResultActions({
  data,
  input,
}: {
  data: NameEvaluationResponse;
  input: EvalInput;
}) {
  // 찜 키는 이름+생년월일 — 같은 이름도 아이(생년월일)가 다르면 따로 저장된다
  const birthDate = input.birthDate || undefined;
  const fav = useIsFavorite(data.fullName, birthDate);

  // 생년월일·성별·톤까지 저장해야 찜 '다시 보기'가 같은 평가를 자동으로 다시 연다 (감사 EV-7).
  // 성·이름은 입력값 그대로 — fullName[0]으로 자르면 '남궁민'이 '남'+'궁민'이 된다(EV-6).
  function onSave() {
    toggleFavorite({
      fullName: data.fullName,
      lastName: input.lastName,
      name: input.name,
      birthDate,
      birthTime: input.birthTime || undefined,
      gender: input.gender,
      tone: input.tone,
      finalScore: data.finalScore,
      aestheticScore: data.aestheticScore,
      // 출생일 없이 낸 결과의 조화 점수는 미산정(0)이라 '조화 0'으로 보이지 않게 뺀다
      harmonyScore:
        data.birthDateProvided === false ? undefined : data.harmonyScore,
    });
    toast.success(fav ? "저장 해제" : "저장됨");
  }

  // 공유 링크는 생년월일을 뺀다(아이 생년월일 노출 방지). 받는 쪽은 출생일 없이 평가되므로
  // 조화가 들어간 종합 점수는 문구에 쓰지 않는다 — 받은 화면과 숫자가 달라지기 때문.
  async function onShare() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${evaluateHref(input, { withBirth: false })}`;
    const text =
      data.birthDateProvided === false
        ? `${data.fullName} 종합 ${data.finalScore}점`
        : `${data.fullName} 이름 평가 리포트`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${data.fullName} - 이름 리포트`,
          text,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(
          input.birthDate ? "링크 복사됨 (생년월일은 빠진 링크예요)" : "링크 복사됨"
        );
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
      {/* 라벨은 고정 — 저장 여부는 aria-pressed와 하트 채움으로만 알린다('저장됨'·'눌림'이 두 번
          읽히지 않게, SmartResult SubHeader와 같은 패턴). lucide 아이콘은 aria-hidden이 자동이다 */}
      <button type="button" onClick={onSave} style={btnStyle} aria-pressed={fav}>
        <Heart
          size={14}
          strokeWidth={1.8}
          fill={fav ? "var(--color-teal)" : "none"}
          color={fav ? "var(--color-teal)" : "currentColor"}
        />
        저장
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
