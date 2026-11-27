/**
 * DualResult — Dual Result main page (sub-header + mapping banner + cards + explainer + table)
 * Source: NameForm_design/src/DualResult.jsx (Claude Design 산출물)
 *
 * 2026-11-27 정리(버그 목록 dual-*):
 *   - 영어 이름을 비우고 받은 결과는 머리(제목·칩·매핑 배너)에 첫 후보의 영어 이름을 쓰지 않는다 — 예전에는 페이지가 첫 후보
 *     영어 이름(Philip)을 '선호 영어 이름'으로 넘겨 "‘Philip’에 어울리는 한국 이름 · 선호 Philip"이라고 했는데 카드는 영어 이름이
 *     제각각이었다. 비우면 제목은 '한·영 이중 이름 N가지', 칩은 '영어 이름 미지정', 배너는 그리지 않고, 비교 표에 영어 이름 열을 둔다
 *   - 톤은 이 화면의 후보를 바꾸지 않는다(DualNameEngine 이 톤을 받기만 하고 쓰지 않는다 — 톤이 쓰이는 곳은 '이 이름 평가하기'의
 *     /evaluate 점수뿐). 칩은 '평가 톤 …'으로 적는다(입력 폼 라벨 '톤 (이름 평가 점수에만 쓰여요)'과 같은 뜻)
 *   - 없는 기능을 지웠다: '○○으로 결정하기 ✓' 단추(동작 없음)와 카드 선택 상태, '다른 연결 방식(의미 유사형·자유형)' 링크
 *     (?connect= 를 읽는 코드도 백엔드 방식 구분도 없다), '↻ 연결 방식 바꾸기'·'↻ 새로 생성'(같은 경로 Link·폼 복귀뿐 — 엔진이 결정적이라
 *     다시 받아도 같은 목록). 폼으로 돌아가는 길은 머리의 '← 조건 수정' 단추 하나(onRegenerate — 입력값은 폼에 남아 있다).
 *     예전 '← 조건 수정'은 자기 경로로 가는 next/link 라 결과 상태가 그대로 남아 눌러도 화면이 바뀌지 않았다
 *   - 설명 상자의 예시는 고정 'Philip(필+립)' 대신 실제 첫 후보, footer 의 빈 링크(href="#") 둘은 /about·/contact
 *   - 휴대폰 폭(640px 미만)에서 매핑 배너를 세로로 쌓는다 — '1fr auto 1fr' 격자의 한글 쪽(올리비아 등 4음절)이 배너를 넘쳤다
 *   - 인쇄: 결과 안의 미니 머리·꼬리(<header>·<footer>)는 인쇄되므로 그 안의 단추·링크에 data-hide-print
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Mark } from "./Mark";
import { DualCard, type DualCandidate } from "./DualCard";

export interface DualContext {
  lastName: string;
  /** 사용자가 넣은 영어 이름(대소문자는 후보 표기에 맞춘 값). "" = 넣지 않음 — 첫 후보의 영어 이름으로 채우지 않는다 */
  preferredEnglishName: string;
  gender: "male" | "female" | "any";
  /** 이 화면의 후보에는 쓰이지 않는다(엔진이 읽지 않음) — '이 이름 평가하기' 링크의 /evaluate 점수에만 싣는다 */
  tone: "neutral" | "soft" | "strong";
  /** YYYY-MM-DD — '이 이름 평가하기' 링크에 싣는다. 입력 폼이 필수로 받는다(백엔드 dual-name 이 없으면 400) */
  birthDate: string;
  /** HH:mm, "" = 미입력 */
  birthTime: string;
}

/**
 * 후보 하나를 /evaluate 로 — 값이 있는 것만 넣는다(favorites buildEvaluateUrl·search handleCandidateDetail 과 같은 꼴).
 * 성별 '미지정'(any)은 넣지 않고, 출생 시각은 생년월일이 있을 때만(/evaluate 가 날짜 없는 시각을 버린다).
 * name 은 성씨를 뺀 이름(koreanFull = 백엔드 koreanName). 톤은 여기서만 쓰인다(입력 폼의 톤 칸이 이 링크의 평가 점수를 정한다)
 */
function evaluateUrl(ctx: DualContext, name: string): string {
  const params = new URLSearchParams();
  if (ctx.lastName) params.set("lastName", ctx.lastName);
  if (name) params.set("name", name);
  if (ctx.birthDate) {
    params.set("birthDate", ctx.birthDate);
    if (ctx.birthTime) params.set("birthTime", ctx.birthTime);
  }
  if (ctx.gender !== "any") params.set("gender", ctx.gender);
  if (ctx.tone) params.set("tone", ctx.tone);
  return `/evaluate?${params.toString()}`;
}

/** 이 화면의 유일한 연결 방식 — 영어 이름의 소리를 한글 음절로 옮긴다(백엔드 영한 음역 지도 data/english_korean_names.json) */
const METHOD_LABEL = "음역";

/** 입력 폼의 톤 선택지 글자와 같게 */
const TONE_LABEL: Record<DualContext["tone"], string> = {
  neutral: "중립",
  soft: "부드러움",
  strong: "강함",
};

// ============================================================
// DualSubHeader — 결과를 받은 조건 칩
// ============================================================
function DualSubHeader({ ctx }: { ctx: DualContext }) {
  const chips = [
    `성 ${ctx.lastName}`,
    ctx.preferredEnglishName
      ? `영어 이름 ${ctx.preferredEnglishName}`
      : "영어 이름 미지정",
    ctx.gender === "male"
      ? "남"
      : ctx.gender === "female"
        ? "여"
        : "성별 무관",
    // 톤은 후보를 바꾸지 않는다 — '이 이름 평가하기'의 점수에만 쓰인다
    `평가 톤 ${TONE_LABEL[ctx.tone]}`,
  ];

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        padding: "12px 0",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        {chips.map((c, i) => (
          <span
            key={i}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-text-2)",
              background: "var(--color-surface-2)",
              padding: "5px 12px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MappingBanner — 영어 이름을 넣었을 때만
// ============================================================
function MappingBanner({
  english,
  koreanLabel,
}: {
  english: string;
  koreanLabel: string;
}) {
  // 휴대폰 폭(640px 미만)은 ENGLISH → 방식 → KOREAN 을 세로로 쌓는다. 예전 '1fr auto 1fr' 인라인 격자는 좁은 폭 규칙이 없고
  // 줄바꿈 없는 글자의 최소 폭 때문에 fr 칸이 줄지 않아 'Olivia → 올리비아'의 한글 쪽이 375px 에서 배너를 18px 넘었다.
  // 칸은 minmax(0, 1fr) + overflowWrap 이라 긴 이름도 칸 안에서 줄을 바꾼다. 인라인 style 은 미디어 쿼리를 못 받아 격자·정렬은 className
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-7"
      style={{
        background: "#F4EFE7",
        borderRadius: "var(--radius-lg)",
        padding: "22px 28px",
        alignItems: "center",
      }}
    >
      <div
        className="text-center sm:text-right"
        style={{ minWidth: 0, overflowWrap: "anywhere" }}
      >
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-3)",
            letterSpacing: "0.04em",
            marginBottom: 4,
          }}
        >
          ENGLISH
        </div>
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 28,
            fontWeight: 500,
            color: "var(--color-text)",
            letterSpacing: "-0.01em",
          }}
        >
          {english}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        {/* 세로로 쌓을 때는 아래를 가리킨다 */}
        <svg
          aria-hidden="true"
          className="rotate-90 sm:rotate-0"
          width="38"
          height="18"
          viewBox="0 0 38 18"
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M2 9 H34 M30 4 L35 9 L30 14" />
        </svg>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-teal)",
            background: "var(--color-surface)",
            padding: "4px 12px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            border: "1px solid var(--color-teal-100)",
          }}
        >
          {METHOD_LABEL}
        </span>
      </div>
      <div
        className="text-center sm:text-left"
        style={{ minWidth: 0, overflowWrap: "anywhere" }}
      >
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-3)",
            letterSpacing: "0.04em",
            marginBottom: 4,
          }}
        >
          KOREAN
        </div>
        <div
          style={{
            fontFamily: "Pretendard Variable, Pretendard, sans-serif",
            fontSize: 28,
            fontWeight: 500,
            color: "var(--color-text)",
            letterSpacing: "-0.01em",
          }}
        >
          {koreanLabel}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MethodExplainer — 음역 방식 설명(예시는 실제 첫 후보)
// ============================================================
function MethodExplainer({ example }: { example?: DualCandidate }) {
  const [open, setOpen] = useState(false);
  // 예전 문장은 입력과 무관하게 늘 'Philip의 발음을 한국어 음절(필+립)로'였다 — 화면에 보이는 첫 카드로 든다
  const sample =
    example && example.englishName && example.koreanSyllables.length > 0
      ? `(예: ${example.englishName} → ${example.koreanSyllables.join("+")})`
      : "";
  const body = `영어 이름의 발음을 한국어 음절${sample}로 옮긴 뒤, 각 음절에 한자를 붙이는 방식이에요. 두 언어에서 같은 소리로 불려요.`;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "18px 22px",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--color-teal-50)",
              color: "var(--color-teal)",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ?
          </span>
          {METHOD_LABEL}(소리 옮기기)이란?
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 12,
            color: "var(--color-text-2)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 200ms",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--color-text-2)",
            margin: 0,
            marginTop: 14,
          }}
        >
          {body}
        </p>
      )}
    </div>
  );
}

// ============================================================
// CompareTable
// ============================================================
function CompareTable({
  candidates,
  context,
}: {
  candidates: DualCandidate[];
  context: DualContext;
}) {
  const [open, setOpen] = useState(false);
  // '#' = 행 번호(응답 순서 번호, 순위 아님 — 백엔드 영한 이름 지도 파일 순서다). '영어' 열 — 영어 이름을 비운 결과는 카드마다
  // 영어 이름이 달라(Philip·Daniel·John …) 표만 봐서는 어느 영어 이름의 후보인지 알 수 없었다.
  // 마지막 열은 옛 '최종'(순번으로 지어낸 점수) 자리 — 평가 화면 링크
  const headers = ["#", "영어", "한국어", "한자", "의미", "평가"];
  const lastCol = headers.length - 1;
  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          width: "100%",
          padding: "16px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="3" width="12" height="10" rx="1" />
            <path d="M2 7h12M6 3v10" />
          </svg>
          {candidates.length}개 후보 한눈에 비교하기
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 12,
            color: "var(--color-text-2)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 200ms",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 22px 18px", overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              minWidth: 640,
            }}
          >
            <thead>
              <tr
                style={{
                  borderTop: "1px solid var(--color-divider)",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                {headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: i === lastCol ? "right" : "left",
                      padding: "10px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-text-3)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr
                  key={c.rank}
                  style={{
                    borderBottom: "1px solid var(--color-divider)",
                  }}
                >
                  <td
                    style={{
                      padding: "12px",
                      color: "var(--color-text-3)",
                      fontFamily: "Inter",
                    }}
                  >
                    {c.rank}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontFamily: "Inter",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.englishName}
                  </td>
                  <td style={{ padding: "12px", fontWeight: 500 }}>
                    {c.koreanFull}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      fontFamily: "var(--font-serif)",
                      fontSize: 16,
                    }}
                  >
                    {c.hanja.map((h) => h.char).join("")}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      color: "var(--color-text-2)",
                    }}
                  >
                    {c.hanja.map((h) => h.meaning).join(" · ")}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    {/* 일반 <a> — /evaluate 정적 라우트의 클라이언트 라우터 캐시 잔상 우회. 카드 링크와 같이 새 탭
                        (결과가 이 페이지 React 상태에만 있다), ↗ 는 장식, aria-label 은 보이는 글자 '평가하기'로 시작 */}
                    <a
                      href={evaluateUrl(context, c.koreanFull)}
                      target="_blank"
                      rel="noopener"
                      aria-label={`평가하기: ${context.lastName}${c.koreanFull} (새 탭)`}
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
                      평가하기
                      <span
                        aria-hidden="true"
                        style={{ display: "inline-block", marginLeft: 3, fontSize: 11 }}
                      >
                        ↗
                      </span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DualResultPage — 메인 페이지
// ============================================================
export function DualResultPage({
  context,
  candidates,
  onRegenerate,
}: {
  context: DualContext;
  candidates: DualCandidate[];
  /** 입력 폼으로 돌아간다(페이지 handleReset — 결과만 지우고 입력값은 폼에 남긴다). '← 조건 수정' 단추 */
  onRegenerate: () => void;
}) {
  const english = context.preferredEnglishName;
  // 매핑 배너의 한국어 쪽 — 영어 이름을 넣었을 때만 그린다. 그 영어 이름의 한글 표기가 여럿이면(Jonathan → 조나단·요나단) 모두.
  // koreanFull 은 성씨를 뺀 이름(백엔드 koreanName)이다
  const koreanLabel = [...new Set(candidates.map((c) => c.koreanFull))].join(" · ");
  const genderWord =
    context.gender === "male" ? "남자" : context.gender === "female" ? "여자" : "";

  return (
    <div
      data-screen-label="Dual Result"
      style={{ minHeight: "100vh", background: "var(--color-background)" }}
    >
      {/* Mini header — 인쇄에서도 보인다(로고). 조작 단추는 data-hide-print */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(250, 247, 242, 0.88)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "14px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <Mark size={28} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.1,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                이름의 결
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-2)",
                  fontFamily: "Inter",
                  whiteSpace: "nowrap",
                }}
              >
                Naming.kyeol
              </span>
            </div>
          </Link>
          {/* 단추 — 예전 같은 경로 next/link 는 결과 상태가 남아 눌러도 그대로였다. 머리가 sticky 라 어디서든 보인다 */}
          <button
            type="button"
            onClick={onRegenerate}
            data-hide-print
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "6px 0",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--color-text-2)",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            ← 조건 수정
          </button>
        </div>
      </header>

      <DualSubHeader ctx={context} />

      <main
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "48px 32px 64px",
        }}
      >
        {/* Hero */}
        <section style={{ marginBottom: 32 }}>
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
            Dual Naming · Result
          </div>
          <h1
            style={{
              fontSize: 36,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: 0,
              marginBottom: 12,
              overflowWrap: "anywhere",
            }}
          >
            {/* 영문 이름 뒤라 받침을 판정할 수 없다 — 조사 갈림이 없는 '에'로 ('Emma과' 방지).
                영어 이름을 비운 결과는 첫 후보의 영어 이름을 쓰지 않는다(카드마다 영어 이름이 다르다) */}
            {english
              ? `‘${english}’에 어울리는 한국 이름`
              : `${genderWord ? "성별에 맞춘 " : ""}한·영 이중 이름 ${candidates.length}가지`}
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: 0,
            }}
          >
            {english
              ? `음운과 의미를 잇는 ${candidates.length}가지 제안`
              : `영어 이름 칸을 비워 두어 한자를 붙일 수 있는 ${genderWord ? `${genderWord} ` : ""}영어 이름을 모았어요. 카드마다 영어 이름이 달라요.`}
          </p>
        </section>

        {/* Mapping banner — 영어 이름을 넣었을 때만(비우면 영어 이름이 카드마다 달라 한 쌍으로 보일 수 없다) */}
        {english && (
          <div style={{ marginBottom: 32 }}>
            <MappingBanner english={english} koreanLabel={koreanLabel} />
          </div>
        )}

        {/* Candidate cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {candidates.map((c) => (
            <DualCard
              key={c.rank}
              cand={c}
              lastName={context.lastName}
              evaluateHref={evaluateUrl(context, c.koreanFull)}
            />
          ))}
          {/* 평가 링크는 한글 이름만 넘긴다(/evaluate 는 URL 로 한자를 받지 않는다). 2026-10-28 부터 카드 한자는 이중 이름 엔진이
              요청의 출생일·출생 시각·성별로 /evaluate 와 같은 용신 배정(HanjaSelector.Select)을 해 고른 글자라, 링크(같은 조건을 싣는다)의
              평가 화면도 같은 한자로 점수를 매긴다 — 옛 안내 '카드의 한자와 다를 수 있어요'는 지웠다(백엔드
              DualNameEngineTests.DualName_Hanja_SameAsEvaluateAssignedHanja_AllMappings 가 일치를 지킨다).
              같은 영어 이름도 생년월일에 따라 한자가 달라지는 이유를 한 줄로 남긴다 */}
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--color-text-2)",
              margin: 0,
            }}
          >
            카드의 한자는 입력한 생년월일·출생 시각·성별에 맞춰 고른 글자예요.
            ‘이 이름 평가하기’도 같은 조건으로 같은 한자를 골라 점수를 매겨요.
          </p>
        </div>

        {/* Explainer */}
        <div style={{ marginBottom: 20 }}>
          <MethodExplainer example={candidates[0]} />
        </div>

        {/* Compare table */}
        <div style={{ marginBottom: 40 }}>
          <CompareTable candidates={candidates} context={context} />
        </div>

        {/* 다른 도구로 — 예전 '○○으로 결정하기 ✓'(동작 없음)·'↻ 연결 방식 바꾸기'(없는 기능)는 지웠다 */}
        <div
          data-hide-print
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-3)",
              textDecoration: "underline",
              textUnderlineOffset: 4,
              textDecorationThickness: 1,
            }}
          >
            다른 경로로 작명하기 ↓
          </Link>
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--color-border)",
          padding: "32px",
          marginTop: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--color-text-3)",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span>© Naming.kyeol</span>
          {/* 예전 href="#"(쪽 맨 위로 튈 뿐) — 결과 화면은 사이트 Footer 가 없어 소개·문의로 가는 길이 여기뿐이다 */}
          <div data-hide-print style={{ display: "flex", gap: 16 }}>
            <Link
              href="/about"
              style={{
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
            >
              이름의 결에 대하여
            </Link>
            <Link
              href="/contact"
              style={{
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
            >
              문의
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DualResultPage;
