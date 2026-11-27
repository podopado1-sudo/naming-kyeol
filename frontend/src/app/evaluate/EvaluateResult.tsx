"use client";

/**
 * /evaluate 결과 화면 — 점수 타일 + 이 이름의 한자 + 미학·조화 Breakdown + 한자 후보 + 강점/참고 + 다음 단계.
 * 사이트 Header/Footer는 page.tsx가 감싼다.
 *
 * 한자 바꿔 다시 계산하기(2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §3-4·§8-3·§9-3)
 * - 점수 타일 아래 '이 이름의 한자' 블록(HanjaSummaryBlock)의 칸, 또는 '한자 후보' 표의 '이 글자로'로 한자를 바꾼다.
 *   다시 계산은 부모(EvaluateClient)가 한다 — 이 화면은 지우지 않고 응답이 오면 제자리에서 갈아 끼운다.
 * - 기다리는 동안 화면을 흐리게 하지 않는다. 점수 타일 위에 글 배지('이전 한자 기준 · 다시 계산 중')를 달고
 *   타일·미학·조화 패널에 aria-busy 만 건다(카드 전체를 흐리게 하면 작은 글씨의 대비가 떨어진다).
 * - 응답에 hanjaSummary 가 없으면(옛 백엔드·한글 음절이 아닌 이름) 블록과 '이 글자로' 버튼 없이 예전 화면 그대로다.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Download, Heart, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/design/Primitives";
import { ScoreTile, SectionHead } from "@/components/design/DetailPrimitives";
import { BreakdownPanel } from "@/components/design/EvalPrimitives";
import {
  HanjaCandidatesTable,
  NoteBlocks,
  SectionHeadWithHint,
  StrengthsCautions,
  type HanjaGroup,
} from "@/components/design/EvalBody";
import { hasVisibleContent } from "@/components/design/eval-layout";
import {
  HanjaSummaryBlock,
  type RecalcErrorView,
  type SeenCombo,
} from "@/components/design/HanjaSummaryBlock";
import { toResourceGrade } from "@/components/design/resource-grade";
import {
  FAVORITES_LIMIT,
  FAVORITE_SAVE_FAILED,
  favoriteCount,
  favoriteSavedNotice,
  toggleFavorite,
  useIsFavorite,
} from "@/lib/favorites";
import { blockView, type HanjaChoice, type PendingHanja, type SlotTarget } from "@/lib/hanja-pick";
import { shareHanja } from "@/lib/hanja-recalc";
import {
  CANDIDATES_PICK_HINT,
  CANDIDATES_SUBTITLE_FACT,
  HARMONY_STROKE_NOTICE,
  SHARE_FAILED,
  WAITING_BADGE,
  allUserBlank,
  fallbackWarning,
  pdfTitle,
  recalcFailedNote,
  shareFailedDetail,
  shareNotice,
  shareOrCopy,
} from "@/lib/hanja-summary-text";
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
      // 그 음절 칸에 넣었을 때의 글자 사실 — '이 글자로'가 응답을 기다리는 동안 그릴 값(옛 백엔드면 없다)
      fact: c.fact ?? null,
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
    .eval-hanja-block { padding: 18px 16px !important; }
  }
`;

/** 한자를 바꿔 다시 계산하는 일 — 부모(EvaluateClient)가 상태를 갖고 이 화면은 그리기만 한다 */
export interface EvalRecalc {
  /** 응답을 기다리는 동안의 바뀐 칸 — 없으면 null */
  pending: PendingHanja | null;
  /** 다시 계산하지 못한 칸 */
  error: RecalcErrorView | null;
  /** 같은 조건에서 계산이 끝난 조합들(지금 조합 포함) */
  seen: readonly SeenCombo[];
  /** 지금 조합의 입력 서명 */
  currentSig: string;
  onChange: (target: SlotTarget, index: number, choice: HanjaChoice) => void;
  onRetry: () => void;
  onDismissError: () => void;
  onSelectSeen: (sig: string) => void;
}

// ============================================================
// 결과 페이지
// ============================================================
export function EvaluateResultView({
  data,
  input,
  onReset,
  recalc,
}: {
  data: NameEvaluationResponse;
  /** 이 결과를 낸 입력 — 저장·공유·다음 단계 링크가 쓴다 (fullName을 잘라 쓰면 복성이 깨진다) */
  input: EvalInput;
  onReset: () => void;
  /** 한자를 바꿔 다시 계산하는 길 — 응답에 hanjaSummary 가 있을 때만 쓴다 */
  recalc?: EvalRecalc;
}) {
  // 응답에 hanjaSummary 가 없으면(옛 백엔드·한글 음절이 아닌 이름) 블록도 '이 글자로' 버튼도 없다 — 예전 화면 그대로
  const summary = data.hanjaSummary ?? null;
  const change = summary && recalc ? recalc : null;
  // 블록과 같은 값 — 다시 계산하는 중이면 방금 고른 글자
  const view = summary && change ? blockView(summary, change.pending) : null;
  const waiting = view?.waiting ?? false;
  const confirmedChars = summary ? summary.syllables.map((s) => s.hanja?.character ?? null) : undefined;
  const currentChars = view ? view.syllables.map((s) => s.hanja?.character ?? null) : undefined;
  // 다시 계산하지 못한 이름 칸 — 후보 표의 '이 글자로'로 시작한 변경이면 표에도 블록과 같은 문장을 남긴다(블록은 화면 위쪽이다)
  const failedName = change?.error && change.error.target === "name" ? change.error : null;
  const tableFailure =
    failedName && summary
      ? {
          id: failedName.id,
          index: failedName.index,
          text: `${recalcFailedNote({
            syllable: summary.syllables[failedName.index]?.syllable ?? "",
            kind: failedName.kind,
            character: failedName.character,
          })} ${failedName.message}`,
        }
      : null;

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

        {/* 타일 위 32px 틈 — 다시 계산하는 동안 여기에 글 배지를 단다(틈 안에 두어 타일이 밀리지 않는다) */}
        <div style={{ position: "relative", height: 32 }}>
          {waiting && (
            <span
              style={{
                position: "absolute",
                left: 0,
                bottom: 6,
                padding: "1px 10px",
                borderRadius: 999,
                background: "var(--color-surface)",
                border: "1px solid var(--color-divider)",
                fontSize: 12,
                lineHeight: 1.6,
                fontWeight: 500,
                color: "var(--color-text-2)",
                whiteSpace: "nowrap",
              }}
            >
              {WAITING_BADGE}
            </span>
          )}
        </div>
        <div
          className="eval-score-grid"
          aria-busy={waiting || undefined}
          style={{
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

      {/* 이 이름의 한자 — 계산에 쓴 한자와 바꾸기(같은 화면에서 다시 계산) */}
      {summary && change && (
        <section style={{ marginTop: 40 }}>
          <HanjaSummaryBlock
            summary={summary}
            pending={change.pending}
            birthDateProvided={data.birthDateProvided !== false}
            hasBirthTime={input.birthTime !== ""}
            recalcError={change.error}
            seen={change.seen}
            currentSig={change.currentSig}
            onChange={change.onChange}
            onRetry={change.onRetry}
            onDismissError={change.onDismissError}
            onSelectSeen={change.onSelectSeen}
          />
        </section>
      )}

      {/* 미학 Breakdown */}
      <section aria-busy={waiting || undefined} style={{ marginTop: 48 }}>
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
        <section aria-busy={waiting || undefined} style={{ marginTop: 48 }}>
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
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 12.5,
                    lineHeight: 1.65,
                    color: "var(--color-text-3)",
                  }}
                >
                  {HARMONY_STROKE_NOTICE}{" "}
                  <Link href="/method" data-hide-print style={{ color: "var(--color-teal-800)", fontWeight: 500 }}>
                    작명 원리
                  </Link>
                </p>
                {/* 이름 칸에 한자를 하나도 두지 않았으면 같은 말이 이미 두 번 있다(블록 아래 ALL_BLANK_NOTICE·바로 위 백엔드 노트 '한자를 두지 않아
                    기본값을 사용했습니다') — 세 번째 경고 상자는 그리지 않는다(11/27 런타임 검증) */}
                {data.harmony.usedFallback && !allUserBlank(summary) ? (
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
                    {/* usedFallback = 한자가 없는 음절이 있다. 사용자가 한자 없이 둔 칸이 있으면 '한자를 두지 않은 음절은 획수를 추정값으로 계산했어요',
                        그 밖(순한글 음절·글자가 모두 불용인 음절)은 백엔드 HarmonyEngine 노트와 같은 말 '배정할 한자가 없는 음절이 있어
                        기본값으로 계산했어요'(2026-10-26) — lib/hanja-summary-text.ts fallbackWarning */}
                    {fallbackWarning(summary)}
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
          {/* 후보 표는 음절별 목록이라 점수에 쓴 한자와 다를 수 있다 — 어느 쪽인지 밝혀 둔다 (감사 EV-3).
              한자를 바꿀 수 있는 결과는 부제가 CANDIDATES_SUBTITLE 의 두 문장 — '이 글자로' 안내(뒤 문장)는 단추와 함께 인쇄에서 숨긴다 */}
          {change ? (
            <SectionHeadWithHint title="한자 후보" subtitle={CANDIDATES_SUBTITLE_FACT} hint={CANDIDATES_PICK_HINT} />
          ) : (
            <SectionHead
              title="한자 후보"
              subtitle="음절마다 쓸 수 있는 한자와 부수로 정한 자원오행, 그 판정 등급(확정·이견 있음·예외 적용)이에요. 점수 계산에 쓴 한자는 아래 '의미 메모'에 적어 두었어요."
            />
          )}
          <HanjaCandidatesTable
            groups={hanjaGroups}
            onPick={
              change ? (index, fact) => change.onChange("name", index, { kind: "hanja", fact }) : undefined
            }
            currentChars={currentChars}
            confirmedChars={confirmedChars}
            failure={tableFailure}
          />
        </section>
      )}

      {/* 강점/참고 — 빈 쪽 상자는 StrengthsCautions 가 그리지 않는다(eval-layout.ts, 2026-10-23 BR-1) */}
      {(hasVisibleContent(data.strengths) || hasVisibleContent(data.cautions)) && (
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
  // 찜 키는 이름+생년월일(+고른 한자) — 같은 이름도 아이(생년월일)가 다르거나 한자 조합이 다르면 따로 저장된다
  const birthDate = input.birthDate || undefined;
  const hanja = input.hanja || undefined;
  const lastHanja = input.lastHanja || undefined;
  const fav = useIsFavorite(data.fullName, birthDate, hanja, lastHanja);

  // 생년월일·성별·톤까지 저장해야 찜 '다시 보기'가 같은 평가를 자동으로 다시 연다 (감사 EV-7).
  // 성·이름은 입력값 그대로 — fullName[0]으로 자르면 '남궁민'이 '남'+'궁민'이 된다(EV-6).
  // 저장소에 쓰지 못하면(사이트 데이터 저장 차단·용량 초과) 그 사실을 알린다 — 옛 화면은 예외로 끝나 토스트도 하트 변화도 없었다.
  // 이미 FAVORITES_LIMIT 개면 새로 저장할 때 가장 오래된 1개가 빠진다 — 저장 알림에 함께 적는다
  function onSave() {
    const evicts = !fav && favoriteCount() >= FAVORITES_LIMIT;
    const ok = toggleFavorite({
      fullName: data.fullName,
      lastName: input.lastName,
      name: input.name,
      birthDate,
      birthTime: input.birthTime || undefined,
      gender: input.gender,
      tone: input.tone,
      // 고른 한자(주소 꼴) — '다시 보기'가 같은 조합을 다시 연다. 고르지 않았으면 싣지 않는다(예전 저장분과 같은 키)
      hanja,
      lastHanja,
      finalScore: data.finalScore,
      aestheticScore: data.aestheticScore,
      // 출생일 없이 낸 결과의 조화 점수는 미산정(0)이라 '조화 0'으로 보이지 않게 뺀다
      harmonyScore:
        data.birthDateProvided === false ? undefined : data.harmonyScore,
    });
    if (!ok) {
      toast.error(FAVORITE_SAVE_FAILED);
      return;
    }
    toast.success(fav ? "저장 해제" : favoriteSavedNotice(evicts));
  }

  // 공유 링크는 생년월일을 뺀다(아이 생년월일 노출 방지). 받는 쪽은 출생일 없이 평가되므로
  // 조화가 들어간 종합 점수는 문구에 쓰지 않는다 — 받은 화면과 숫자가 달라지기 때문.
  // 한자를 하나라도 고른 결과는 화면에 보인 이름 글자를 모두 싣는다(자동 칸도 그 글자로) — 고른 칸만 실으면 받는 쪽 자동 칸이
  // 생년월일 없는 기본 배정으로 채워져 다른 조합으로 열린다. 한자를 고르지 않은 결과의 링크는 예전과 같다(lib/hanja-recalc.ts shareHanja).
  // 공유 시트 → (없거나 취소가 아닌 까닭으로 실패하면) 링크 복사 → 둘 다 안 되면 '링크를 복사하지 못했어요'와 주소(lib/hanja-summary-text.ts shareOrCopy).
  // 공유 시트를 닫은 것(AbortError)만 조용히 넘긴다. 생년월일을 넣은 결과는 두 길 모두에서 '생년월일은 빠진 링크'라고 알린다
  async function onShare() {
    if (typeof window === "undefined") return;
    const shared = { ...input, ...shareHanja(data.hanjaSummary, input) };
    const url = `${window.location.origin}${evaluateHref(shared, { withBirth: false })}`;
    const text =
      data.birthDateProvided === false
        ? `${data.fullName} 종합 ${data.finalScore}점`
        : `${data.fullName} 이름 평가 리포트`;
    const outcome = await shareOrCopy(
      { title: `${data.fullName} - 이름 리포트`, text, url },
      typeof navigator.share === "function" ? (d) => navigator.share(d) : undefined,
      typeof navigator.clipboard?.writeText === "function" ? (t) => navigator.clipboard.writeText(t) : undefined
    );
    if (outcome === "failed") {
      // 주소를 함께 보여 손으로 복사할 수 있게 한다(토스트 글은 고를 수 있다) — 오래 띄운다
      toast.error(SHARE_FAILED, { description: shareFailedDetail(url), duration: 15_000 });
      return;
    }
    const notice = shareNotice(outcome, !!input.birthDate);
    if (notice) toast.success(notice);
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

  // 'PDF' = 인쇄 대화상자('PDF로 저장'). 인쇄 동안만 문서 제목을 '{성명} 이름 평가'로 바꿔 기본 파일 이름·쪽 머리말이 이름마다 다르게 하고,
  // 인쇄가 끝나면(afterprint) 되돌린다. afterprint 가 오지 않는 브라우저(인쇄를 열지 못하는 인앱 브라우저 등)에서도
  // 결과 화면을 떠날 때(다른 이름 평가·빈 폼) 되돌린다 — 바꾼 제목이 다른 이름의 화면에 남지 않게
  const restoreTitleRef = useRef<(() => void) | null>(null);
  useEffect(() => () => restoreTitleRef.current?.(), []);

  function onPdf() {
    if (typeof window === "undefined") return;
    const title = pdfTitle(data.fullName);
    if (!restoreTitleRef.current) {
      const previous = document.title;
      const restore = () => {
        window.removeEventListener("afterprint", restore);
        if (restoreTitleRef.current === restore) restoreTitleRef.current = null;
        // 그사이 다른 쪽으로 옮겨 제목이 바뀌었으면 건드리지 않는다(새 쪽의 제목을 옛 제목으로 덮지 않게)
        if (document.title === title) document.title = previous;
      };
      restoreTitleRef.current = restore;
      window.addEventListener("afterprint", restore);
    }
    document.title = title;
    window.print();
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
