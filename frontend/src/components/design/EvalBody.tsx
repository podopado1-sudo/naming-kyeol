/**
 * EvalBody — Evaluate 결과 본문 (HanjaCandidatesTable + RecommendedCombo + StrengthsCautions + NoteBlocks)
 * Source: NameForm_design/src/EvalBody.jsx (Claude Design 산출물)
 *
 * 2열 그리드는 className "eval-2col" — 480px 이하 1열 전환 규칙은 평가 결과 화면
 * (app/evaluate/EvaluateResult.tsx의 RESULT_CSS)이 갖고 있다.
 */
"use client";

import { Sparkles, Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ComponentType, SVGProps } from "react";

import { ElementChip } from "./EvalPrimitives";
import { ResourceGradeBadge } from "./DetailHanja";
import type { ResourceGrade } from "./resource-grade";
import { keepFilledBlocks, twoColTemplate } from "./eval-layout";
import { hasNoHanja, noHanjaSyllableNote } from "@/lib/no-hanja";
import type { HanjaFact } from "@/lib/types";

// ============================================================
// HanjaCandidatesTable — 음절별 한자 후보 (2-col 카드)
// ============================================================
export interface HanjaGroup {
  syllable: string;
  candidates: {
    character: string;
    meaning: string;
    fiveElement?: string;
    strokeCount?: number;
    /** 자원오행 판정 등급 — 없으면 배지 없음 */
    resourceGrade?: ResourceGrade;
    /** V 등급의 이유 — '자료 적음'·'추정' 배지 판정용 */
    vReasons?: string[];
    /**
     * 이 글자를 그 음절 칸에 넣었을 때의 글자 사실(응답 hanjaCandidates[].candidates[].fact — 2026-11 한자 입력).
     * '이 글자로' 버튼이 고른 글자를 응답을 기다리는 동안 그리는 데 쓴다. 옛 백엔드면 없다 — 그 줄에는 버튼을 두지 않는다
     */
    fact?: HanjaFact | null;
  }[];
}

/** 줄 끝 '이 글자로' 버튼 — 누름 영역 44px. 줄 전체를 버튼으로 만들지 않는다(줄 안의 등급 배지가 포커스를 받는 툴팁이다) */
const pickButtonStyle: CSSProperties = {
  appearance: "none",
  minHeight: 44,
  padding: "0 12px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-text)",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

/** 이 표의 '이 글자로'로 시작한 재계산이 실패했을 때 그 음절 상자에 남기는 한 줄 — 작은 글씨는 amber-warm-700(흰 카드 위) */
const failureLineStyle: CSSProperties = {
  margin: 0,
  padding: "10px 20px 0",
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "var(--color-amber-warm-700)",
  wordBreak: "keep-all",
};

/** 지금 계산에 쓴 글자 줄의 표시 — 버튼 대신 글. 방금 고른 글자는 응답이 올 때까지 '다시 계산 중' */
const currentMarkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--color-teal-800)",
  whiteSpace: "nowrap",
  outline: "none",
};

export function HanjaCandidatesTable({
  groups,
  onPick,
  currentChars,
  confirmedChars,
  failure,
}: {
  groups: HanjaGroup[];
  /**
   * 주면 줄 끝에 '이 글자로' 버튼이 생긴다 — (음절 번호, 그 글자의 사실). 한자를 바꿔 다시 계산할 수 있는 결과에서만 준다
   * (2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §8-1)
   */
  onPick?: (syllableIndex: number, fact: HanjaFact) => void;
  /** 음절마다 지금 화면에 둔 글자('이 이름의 한자' 블록과 같은 값 — 다시 계산하는 중이면 방금 고른 글자). 한자가 없으면 null */
  currentChars?: readonly (string | null)[];
  /** 음절마다 마지막으로 계산이 끝난 글자 — currentChars 와 다르면 그 음절은 다시 계산하는 중이다 */
  confirmedChars?: readonly (string | null)[];
  /**
   * 다시 계산하지 못한 이름 칸(부모의 재계산 실패 — 실패마다 다른 id, 음절 번호, 블록과 같은 문장). 이 표의 '이 글자로'로 시작한
   * 재계산이 실패하면 그 음절 상자에 이 문장을 남기고 누른 줄의 버튼으로 포커스를 돌려놓는다
   */
  failure?: { id: number; index: number; text: string } | null;
}) {
  const markBase = useId();
  // '이 글자로'를 누르면 그 버튼이 글('다시 계산 중')로 바뀐다 — 포커스가 문서 맨 위로 떨어지지 않게 그 글로 옮긴다
  const [focusMark, setFocusMark] = useState<{ id: string; n: number } | null>(null);
  useEffect(() => {
    if (!focusMark) return;
    document.getElementById(focusMark.id)?.focus({ preventScroll: true });
  }, [focusMark]);

  // 마지막으로 '이 글자로'를 누른 줄. 재계산이 실패하면 그 줄의 글('다시 계산 중')이 다시 버튼이 되며 포커스가 사라진다 —
  // 그 버튼으로 돌려놓는다. 실패 안내(role="alert")는 위쪽 블록의 그 칸 아래에 있어 화면 밖일 수 있으므로 이 표에도 한 줄 남긴다
  const [origin, setOrigin] = useState<{ gi: number; i: number } | null>(null);
  const handledFailureRef = useRef<number | null>(null);
  const failureId = failure?.id;
  useEffect(() => {
    if (failureId === undefined || !origin || handledFailureRef.current === failureId) return;
    handledFailureRef.current = failureId;
    // 포커스가 다른 곳에 있으면(서버가 짚은 칸의 패널이 열렸거나 사용자가 옮겼다) 그대로 둔다
    const active = document.activeElement;
    if (active && active !== document.body) return;
    document.getElementById(`${markBase}-pick-${origin.gi}-${origin.i}`)?.focus({ preventScroll: true });
  }, [failureId, origin, markBase]);
  const failureLineId = (gi: number) => `${markBase}-failure-${gi}`;
  const showsFailure = (gi: number) => !!failure && !!origin && origin.gi === gi && failure.index === gi;

  return (
    <div
      className="eval-2col"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 16,
      }}
    >
      {groups.map((g, gi) => (
        <div
          // 같은 음절이 반복되는 이름(하하·똘똘)도 있어 음절만으로는 키가 겹친다 — DetailHanja HanjaBreakdown 과 같게
          key={`${gi}-${g.syllable}`}
          style={{
            // 안내 한 줄뿐인 상자는 옆 칸 높이로 늘이지 않는다(빈 흰 상자가 길게 남지 않게)
            alignSelf: hasNoHanja(g.candidates) ? "start" : undefined,
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 20px",
              background: "var(--color-surface-2)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text-2)",
              letterSpacing: "0.08em",
            }}
          >
            {hasNoHanja(g.candidates) ? `${g.syllable} 음절` : `${g.syllable} 음절 · ${g.candidates.length}개`}
          </div>
          {/* 이 표에서 시작한 재계산의 실패 — 같은 문장의 alert 는 블록에 있다(두 번 읽히지 않게 여기는 글만, 누른 버튼이 이 줄을 설명으로 잇는다) */}
          {showsFailure(gi) && failure && (
            <p id={failureLineId(gi)} style={failureLineStyle}>
              {failure.text}
            </p>
          )}
          {/* 후보 0 음절(순한글 음절·후보가 모두 불용인 음절) — 빈 상자 대신 한 줄 안내(2026-10-26 L4, lib/no-hanja.ts) */}
          {hasNoHanja(g.candidates) && (
            <p
              style={{
                margin: 0,
                padding: "14px 20px",
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "var(--color-text-2)",
              }}
            >
              {noHanjaSyllableNote(g.syllable)}
            </p>
          )}
          <div>
            {g.candidates.map((c, i) => (
              <div
                key={c.character}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  columnGap: 14,
                  padding: "14px 20px",
                  borderTop:
                    i === 0 ? "none" : "1px solid var(--color-divider)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 28,
                    fontWeight: 500,
                    color: "var(--color-text)",
                    lineHeight: 1,
                    minWidth: 32,
                  }}
                >
                  {c.character}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13.5,
                      color: "var(--color-text)",
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {c.meaning}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <ElementChip el={c.fiveElement} />
                    {c.strokeCount != null && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--color-text-3)",
                          fontFamily: "Inter",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.strokeCount}획
                      </span>
                    )}
                  </div>
                </div>
                {onPick ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                    }}
                  >
                    <ResourceGradeBadge grade={c.resourceGrade} vReasons={c.vReasons} size="sm" tipAlign="right" />
                    {currentChars?.[gi] === c.character ? (
                      <span id={`${markBase}-${gi}-${i}`} tabIndex={-1} style={currentMarkStyle}>
                        {confirmedChars?.[gi] === c.character ? "지금 한자" : "다시 계산 중"}
                      </span>
                    ) : c.fact ? (
                      <button
                        type="button"
                        id={`${markBase}-pick-${gi}-${i}`}
                        // 보이는 글('이 글자로')로 시작하는 이름 — 음성 입력으로 보이는 글을 말해도 맞는다(WCAG 2.5.3)
                        aria-label={`이 글자로 — ‘${g.syllable}’ 음절을 ${c.character} 글자로 바꾸기`}
                        aria-describedby={
                          showsFailure(gi) && origin?.i === i ? failureLineId(gi) : undefined
                        }
                        onClick={() => {
                          const fact = c.fact;
                          if (!fact) return;
                          onPick(gi, fact);
                          setOrigin({ gi, i });
                          setFocusMark((prev) => ({ id: `${markBase}-${gi}-${i}`, n: (prev?.n ?? 0) + 1 }));
                        }}
                        style={pickButtonStyle}
                      >
                        이 글자로
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <ResourceGradeBadge grade={c.resourceGrade} vReasons={c.vReasons} size="sm" tipAlign="right" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// RecommendedCombo — 추천 조합 강조 카드
// ============================================================
export function RecommendedCombo({
  combo,
  elementLabel,
  desc,
}: {
  combo: string;
  elementLabel: string;
  desc: string;
}) {
  return (
    <div
      style={{
        background: "#F7EFDD",
        border: "1px solid rgba(181,135,76,0.35)",
        borderRadius: "var(--radius-md)",
        padding: "18px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#7A5B22",
            letterSpacing: "0.08em",
          }}
        >
          추천 조합
        </span>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            fontWeight: 500,
            color: "var(--color-text)",
            letterSpacing: 0,
            lineHeight: 1,
          }}
        >
          {combo}
        </span>
        <span
          style={{ fontSize: 12, color: "#7A5B22", whiteSpace: "nowrap" }}
        >
          {elementLabel}
        </span>
      </div>
      <span
        style={{
          fontSize: 12.5,
          color: "var(--color-text-2)",
          lineHeight: 1.5,
        }}
      >
        {desc}
      </span>
    </div>
  );
}

// ============================================================
// StrengthsCautions — 2-col 강점/참고
// ============================================================
function Block({
  Icon,
  title,
  items,
  tintBg,
  accent,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  items: string[];
  tintBg: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: tintBg,
        borderRadius: "var(--radius-lg)",
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Icon width={14} height={14} strokeWidth={2} color={accent} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: accent,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {items.map((it, i) => (
          <li
            key={i}
            style={{
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "var(--color-text)",
              position: "relative",
              paddingLeft: 14,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 9,
                width: 4,
                height: 4,
                borderRadius: 999,
                background: accent,
              }}
            />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

// 빈 목록 상자는 그리지 않고, 한쪽만 남으면 1열(eval-layout.ts — 2026-10-23 운영 검증 BR-1: 빈 '참고할 점' 상자).
// 둘 다 비면 아무것도 그리지 않는다
export function StrengthsCautions({
  strengths,
  cautions,
}: {
  strengths: string[];
  cautions: string[];
}) {
  const blocks = keepFilledBlocks([
    {
      key: "strengths",
      Icon: Sparkles,
      title: "이 이름의 강점",
      items: strengths,
      tintBg: "rgba(74,124,89,0.08)",
      // 13px 제목·아이콘·점 — score-high 는 초록 8% 틴트(종이 위) 4.22:1 이라 짙은 글자 토큰(5.0:1 안팎, 2026-10-26 팔레트 #2 보완)
      accent: "var(--color-score-high-700)",
    },
    {
      key: "cautions",
      Icon: Info,
      title: "참고할 점",
      items: cautions,
      tintBg: "rgba(201,169,110,0.12)",
      accent: "#7A5B22",
    },
  ]);
  if (blocks.length === 0) return null;

  return (
    <div
      className="eval-2col"
      style={{
        display: "grid",
        gridTemplateColumns: twoColTemplate(blocks.length),
        gap: 16,
      }}
    >
      {blocks.map(({ key, ...block }) => (
        <Block key={key} {...block} />
      ))}
    </div>
  );
}

// ============================================================
// NoteBlocks — 발음/의미 메모 2-col
// ============================================================
export function NoteBlocks({
  pronunciation,
  meaning,
}: {
  pronunciation: string;
  meaning: string;
}) {
  return (
    <div
      className="eval-2col"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 16,
        marginTop: 16,
      }}
    >
      {(
        [
          ["발음 메모", pronunciation],
          ["의미 메모", meaning],
        ] as const
      ).map(([title, body]) => (
        <div
          key={title}
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "22px 24px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text-2)",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            {title}
          </div>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.7,
              color: "var(--color-text)",
              margin: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {body}
          </p>
        </div>
      ))}
    </div>
  );
}

