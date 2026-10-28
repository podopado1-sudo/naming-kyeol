/**
 * DualCard — Dual Result candidate card (한국어 + 한자 + 영어 3분할)
 * Source: NameForm_design/src/DualCard.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState → 명시적 import
 *   - "김" 하드코딩 → lastName props
 *   - window 글로벌 → ES Module export
 *   - 오른쪽 점수 칸(최종 점수·미학/조화·RARITY 막대) 제거 → '이 이름 평가하기' 링크 (2026-10-28).
 *     백엔드 이중 이름 응답에는 점수가 없어 페이지가 순번으로 숫자를 지어내고 있었다.
 *     링크는 넷째 열이 아니라 격자 아래 줄에 둔다 — 넷째 열(minmax(0, 24fr))은 휴대폰 폭에서 약 38px 라
 *     줄바꿈 없는 링크(약 92px)가 영어 이름 위로 넘쳐 덮었다(375·500px 실측)
 *   - 왼쪽 위 '#N' 알약 제거 — 응답 배열 순서(백엔드 영한 이름 지도 파일 순)일 뿐 품질 순위가 아닌데, 추천 카드 구석의
 *     '#1'은 '1위'로 읽힌다(예전엔 지어낸 점수가 순번 따라 줄어 더 그렇게 보였다)
 *   - 행동 줄의 '상세 →'(next/link → /analysis, detailHref) 제거 (2026-10-28) — 파라미터 없이 빈 분석 폼에 닿았다.
 *     /analysis 는 ?lastName=&name= 을 받지만 폼 칸을 채울 뿐 바로 분석하지 않고(출생일·성별·톤은 받지 않는다),
 *     후보 하나를 점수로 보는 일은 '이 이름 평가하기'(/evaluate)가 이미 맡아 뜻이 겹친다
 *   - '이 이름 평가하기'는 새 탭 — 이중 이름 결과는 페이지 React 상태에만 있어 같은 탭으로 갔다 돌아오면 후보를 잃는다
 *   - 휴대폰 폭(640px 미만)은 한국어·영어 블록을 세로로 쌓고 연결선을 숨긴다 (2026-10-28) — 3열 격자의 한국어 열이 375px 에서
 *     약 72px 라 음절 칩이 영어 이름·연결선을 덮었다(HEAD 부터, 넷째 열을 걷어낸 뒤에도 남음)
 */
"use client";

import { useState } from "react";

export type DualMode = "phonetic" | "semantic" | "free";

export interface DualCandidate {
  /** 응답 배열 순서(1부터) — 카드 선택·key 용 식별자. 품질 순위가 아니니 카드에 순위처럼 그리지 않는다 */
  rank: number;
  englishName: string;
  koreanFull: string;
  koreanSyllables: string[];
  englishSyllables: string[];
  hanja: { char: string; meaning: string }[];
  mappingNote: string;
  reasons: string[];
  note?: string;
}

function SyllableRow({
  syllables,
  highlight,
  fontFamily,
  fontSize,
  fontWeight,
}: {
  syllables: string[];
  highlight: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        // 아주 좁은 폭(320px 휴대폰의 김+4음절 약 222px > 칸 206px)에서는 칩이 다음 줄로 — 넘쳐 카드 밖·선택 표시를 덮지 않게.
        // 3열 격자는 한국어 열을 max-content 이상으로 잡아 여기서 줄이 바뀌지 않는다
        flexWrap: "wrap",
        gap: 4,
        fontFamily,
        fontSize,
        fontWeight,
        letterSpacing: "-0.005em",
      }}
    >
      {syllables.map((s, i) => (
        <span
          key={i}
          style={{
            background: highlight ? "var(--color-teal-50)" : "transparent",
            color: highlight ? "var(--color-teal)" : "var(--color-text-2)",
            padding: highlight ? "2px 7px" : "2px 2px",
            borderRadius: highlight ? "var(--radius-sm)" : 0,
            whiteSpace: "nowrap",
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

export function DualCard({
  cand,
  selected,
  onSelect,
  mode,
  lastName,
  evaluateHref,
}: {
  cand: DualCandidate;
  selected: boolean;
  onSelect: (rank: number) => void;
  mode: DualMode;
  lastName: string;
  /** 이 후보를 /evaluate 로 — 성씨·이름·출생일·성별·톤을 담은 URL (DualResult 가 만든다) */
  evaluateHref: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const highlightSyllables = mode === "phonetic";

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-xl)",
        border: selected
          ? "2px solid var(--color-teal)"
          : "1px solid var(--color-border)",
        boxShadow: selected ? "var(--shadow-md)" : "var(--shadow-sm)",
        padding: "22px 24px",
        position: "relative",
        transition: "all 200ms cubic-bezier(.2,.6,.2,1)",
        cursor: "pointer",
      }}
      onClick={() => onSelect(cand.rank)}
    >
      {selected && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--color-teal)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* 휴대폰 폭(640px 미만)은 한국어 → 영어 세로 쌓기, 연결선 숨김. 3열 격자는 sm 부터 — 한 줄 375px 에서 한국어 열이
          약 72px 라 32px 음절 칩 줄(김+2음절 129px·3음절 약 172px·4음절 약 206px, 남궁+3음절 약 194px)이 연결선·영어 이름을
          덮고 한자 뜻('아리따울 나')이 베이지 상자를 넘쳤다(김올리비아·김다이아나·김조나단·남궁소피아 실측, 2026-10-28).
          한국어 열은 minmax(max-content, 40fr) — 640~800px 처럼 40fr 몫이 이름보다 좁으면 이름 폭만큼 넓히고 영어 열이 줄어든다
          (넓은 화면은 40fr 그대로라 카드끼리 연결선 자리가 같다). 인라인 style 은 미디어 쿼리를 못 받아 격자는 className 으로 */}
      <div
        className="grid grid-cols-1 sm:grid-cols-[minmax(max-content,40fr)_48px_minmax(0,56fr)]"
        style={{
          gap: 20,
          // 한국 이름 줄과 영어 이름의 글자 바닥선을 맞춘다(3열일 때) — 예전엔 '#N' 알약이 한국어 열을 내려 줘서
          // 영어 열 paddingTop 으로 대충 맞췄다(가운데 연결선은 alignSelf: stretch 라 영향 없음). 1열이면 줄마다 한 칸이라 위 맞춤과 같다
          alignItems: "baseline",
        }}
      >
        {/* Left: Korean */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 4,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "var(--color-text-2)",
                fontFamily: "Pretendard Variable, Pretendard, sans-serif",
              }}
            >
              {lastName}
            </span>
            <SyllableRow
              syllables={cand.koreanSyllables}
              highlight={highlightSyllables}
              fontFamily="Pretendard Variable, Pretendard, sans-serif"
              fontSize={32}
              fontWeight={500}
            />
          </div>

          <div
            style={{
              background: "var(--color-surface-2)",
              borderRadius: "var(--radius-md)",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {cand.hanja.map((h, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 22,
                    fontWeight: 500,
                    color: "var(--color-text)",
                    width: 26,
                    flexShrink: 0,
                  }}
                >
                  {h.char}
                </span>
                {/* 줄바꿈은 띄어쓰기에서만(keep-all) — 예전 nowrap 은 좁은 한국어 열에서 '아리따울 나'가 베이지 상자 밖으로 넘쳤다 */}
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-2)",
                    lineHeight: 1.5,
                    wordBreak: "keep-all",
                    minWidth: 0,
                  }}
                >
                  {h.meaning}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: connector — 세로로 쌓는 휴대폰 폭에서는 숨긴다(장식 — 두 이름이 위아래로 이어져 보인다).
            display 는 className(hidden sm:flex) — 인라인 display 는 클래스를 이겨 숨김이 안 먹는다 */}
        <div
          aria-hidden="true"
          className="hidden sm:flex"
          style={{
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "stretch",
            minHeight: 120,
          }}
        >
          <div
            style={{
              width: 1,
              flex: 1,
              backgroundImage:
                "linear-gradient(to bottom, var(--color-teal-100) 50%, transparent 50%)",
              backgroundSize: "1px 6px",
              backgroundRepeat: "repeat-y",
            }}
          />
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--color-teal-50)",
              color: "var(--color-teal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "4px 0",
              flexShrink: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M2 5h10M9 2L12 5L9 8M12 9H2M5 6L2 9L5 12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              width: 1,
              flex: 1,
              backgroundImage:
                "linear-gradient(to bottom, var(--color-teal-100) 50%, transparent 50%)",
              backgroundSize: "1px 6px",
              backgroundRepeat: "repeat-y",
            }}
          />
        </div>

        {/* Right: English */}
        {/* 3열일 때 위 14px(sm:pt-3.5) — 선택 표시(오른쪽 위 22px 원, 카드 위에서 14px)의 아래에서 글자가 시작하게. 긴 이름(Catherine)이
            좁은 폭에서 열을 넘쳐도 원과 겹치지 않는다. 세로로 쌓으면 한국어 블록 아래라 원과 만나지 않아 뺀다(격자 gap 20 만) */}
        <div className="sm:pt-3.5" style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 28,
              fontWeight: 500,
              color: "var(--color-text)",
              letterSpacing: "-0.01em",
              marginBottom: 8,
            }}
          >
            {cand.englishName}
          </div>
          <div style={{ marginBottom: 10 }}>
            <SyllableRow
              syllables={cand.englishSyllables}
              highlight={highlightSyllables}
              fontFamily="Inter"
              fontSize={14}
              fontWeight={500}
            />
          </div>
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.55,
              color: "var(--color-text-2)",
              fontFamily: "Inter, Pretendard Variable",
            }}
          >
            {cand.mappingNote}
          </div>
        </div>
      </div>

      {/* 행동 줄 — 옛 넷째 열(점수 칸)이던 자리. 이중 이름 응답에는 점수가 없어 평가 화면으로 잇는다.
          격자 밖 한 줄이라 좁은 폭에서도 영어 이름을 덮지 않는다 */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "baseline",
          gap: 16,
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        {/* 일반 <a> — /evaluate 정적 라우트의 클라이언트 라우터 캐시가 이전 ?name=... 을 재사용하는 잔상 버그 우회
            (favorites·search 와 같은 이유). 새 탭으로 연다 — 결과가 이 페이지 React 상태에만 있어 같은 탭으로 갔다 돌아오면
            후보를 잃는다. ↗ 는 새 탭 표시(장식 — aria-hidden, 새 탭은 aria-label 끝 '(새 탭)'이 알린다).
            aria-label 은 보이는 글자로 시작해(WCAG 2.5.3) 후보 N개의 링크를 스크린리더 목록에서 가른다 */}
        <a
          href={evaluateHref}
          target="_blank"
          rel="noopener"
          aria-label={`이 이름 평가하기: ${lastName}${cand.koreanFull} (새 탭)`}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-teal)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            textDecorationThickness: 1,
            whiteSpace: "nowrap",
          }}
        >
          이 이름 평가하기
          {/* inline-block — 링크 밑줄이 화살표 아래까지 이어지지 않게 */}
          <span
            aria-hidden="true"
            style={{ display: "inline-block", marginLeft: 3, fontSize: 11 }}
          >
            ↗
          </span>
        </a>
      </div>

      {cand.note && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "var(--color-gold-50)",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            color: "var(--color-text-2)",
            lineHeight: 1.55,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <span style={{ color: "var(--color-gold-700)" }}>⚠</span>
          <span>{cand.note}</span>
        </div>
      )}

      {cand.reasons.length > 0 && (
        <div
          style={{
            marginTop: 14,
            borderTop: "1px solid var(--color-divider)",
            paddingTop: 12,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-text-2)",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 180ms",
                display: "inline-block",
                fontSize: 10,
              }}
            >
              ▸
            </span>
            이 이름을 고른 이유
          </button>
          {expanded && (
            <ul
              style={{
                margin: "10px 0 0 16px",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {cand.reasons.map((r, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--color-text-2)",
                  }}
                >
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default DualCard;
