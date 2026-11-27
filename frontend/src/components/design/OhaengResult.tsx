/**
 * OhaengResult — 부족한 오행 찾기(/ohaeng) 결과 화면(2026-11 설계 docs/plan-ohaeng-2026-11.md §6-2·§6-3).
 *
 * 원국 표 → 보정 줄 → 오행 개수 막대 + 요약 문장 → 용신·희신 카드 → 오행별 이름 한자 예 → 다음 단계 링크 → 고지.
 * 값은 모두 POST /api/v1/saju/elements 응답이다 — 여기서 계산하지 않는다(문장은 lib/ohaeng.ts).
 *
 * 규칙
 * - 오행 글자색은 FIVE_EL[el].text, 표지색 FIVE_EL[el].color 는 막대 바탕·왼쪽 테두리에만(tests/palette-contrast.test.mjs 가 이 파일도 본다).
 * - 한자 정보는 응답만 쓴다 — lib/hanja-seo.ts·lib/name-seo.ts·HanjaCharCard 를 import 하지 않는다(큰 JSON 이 클라이언트 번들에 실린다).
 * - 링크는 쿼리 없는 맨 경로(/hanja/{독음}·/search·/evaluate·/hanja). 생년월일은 화면에만 — 문서 제목·URL·저장소에 두지 않는다
 *   (tests/ohaeng-privacy.test.mjs).
 * - 한자 예 칸의 '맞춰 보기'(2026-11 한자 입력 — 설계 docs/plan-hanja-input-2026-11.md §11-3)는 그 글자 하나를 해시에 실어
 *   이름 평가를 **새 창**으로 연다(lib/hanja-pick.ts evaluatePickHref — `/evaluate#pick=글자&as=독음`, 쿼리 없음). 이 결과는 주소·저장소에
 *   남지 않아 같은 창에서 떠나면 사라지기 때문이다. 생년월일·시각·출생지는 넘기지 않는다 — 글자와 독음은 응답 값이지 입력값이 아니다.
 * - 기신은 따로 내세우지 않는다 — 없는 오행이 기신일 때만 그 묶음 자리에 한 줄(gishinNote).
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { FIVE_EL, type FiveElement } from "./DetailPrimitives";
import { RESOURCE_GRADE_INFO } from "./resource-grade";
import { evaluatePickHref } from "@/lib/hanja-pick";
import {
  BRANCH_ELEMENT,
  ELEMENTS,
  ELEMENT_KO,
  STEM_ELEMENT,
  STRENGTH_LABEL,
  birthLabel,
  correctionNote,
  countSummary,
  countWord,
  gishinNote,
  groupHeading,
  hanjaHref,
  needsSeoulOnlyNotice,
  termNote,
  yongshinHeadline,
} from "@/lib/ohaeng";
import type { ElementHanjaGroup, ElementHanjaItem, SajuElementsResponse, SajuPillarData } from "@/lib/types";

/** 오행 표에 없는 값(빈 지지 오행 등)일 때의 무채색 */
const NEUTRAL_EL: FiveElement = {
  label: "",
  name: "",
  color: "var(--color-ink-dan)",
  text: "var(--color-text-2)",
  tintBg: "var(--color-surface-2)",
  solidBorder: "var(--color-border)",
};

const elOf = (el: string | undefined): FiveElement => (el && FIVE_EL[el]) || NEUTRAL_EL;

const card: CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-sm)",
  border: "1px solid var(--color-divider)",
};

const cardTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "var(--color-text)",
  margin: "0 0 12px",
  letterSpacing: "-0.005em",
};

const bodyText: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "var(--color-text-2)",
  margin: 0,
};

const smallNote: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.65,
  color: "var(--color-text-3)",
  margin: 0,
};

const link: CSSProperties = {
  color: "var(--color-teal)",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

/** 한자 예 칸 바닥의 '맞춰 보기' — 칸 폭 전체·높이 44px 누름 영역. 작은 글씨라 글자 전용 짙은 청록(흰 카드 위) */
const pickLink: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  borderTop: "1px solid var(--color-divider)",
  fontSize: 12.5,
  fontWeight: 500,
  color: "var(--color-teal-800)",
  textDecoration: "none",
};

export function OhaengResult({
  data,
  birthDate,
  birthTime,
}: {
  data: SajuElementsResponse;
  /** 입력한 생년월일(YYYY-MM-DD) — 부제에만 쓴다 */
  birthDate: string;
  /** 입력한 시각(HH:mm) — 시각 없음이면 빈 문자열 */
  birthTime: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // 결과가 뜨면 제목으로 포커스를 옮긴다(화면 읽기 프로그램·키보드 사용자 — 새 결과마다 부모가 key 로 다시 마운트한다)
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const { saju } = data;
  const term = termNote(saju.termOnBirthDay);

  // 인쇄(globals.css @media print): data-print-result 가 있으면 page.tsx 의 머리말·설명 글이 빠지고 폼도 빠진다(OhaengClient) —
  // 그래서 사이트·도구 이름을 인쇄 전용 한 줄로 단다. 조작 요소('맞춰 보기'와 그 안내·다음 단계 링크)는 data-hide-print,
  // 짧은 카드는 쪽 경계에서 갈리지 않게(print:break-inside-avoid), 한자 예 카드는 길어 쪼개질 수 있게 둔다(칸 하나하나만 묶는다)
  return (
    <section aria-labelledby="ohaeng-result-title" data-print-result className="mt-10 print:mt-0">
      <p className="hidden print:block" style={{ ...smallNote, marginBottom: 8 }}>
        이름의 결 · 부족한 오행 찾기 결과 (namingkyeol.com/ohaeng)
      </p>
      <h2
        id="ohaeng-result-title"
        ref={headingRef}
        tabIndex={-1}
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 26,
          fontWeight: 700,
          color: "var(--color-text)",
          margin: 0,
          letterSpacing: "-0.01em",
          outline: "none",
          scrollMarginTop: 80,
        }}
      >
        사주 원국
      </h2>
      <p style={{ ...smallNote, fontSize: 13.5, color: "var(--color-text-2)", marginTop: 6 }}>
        {countWord(data.characterCount)} 글자 · {birthLabel(birthDate, birthTime)}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
        {/* ── 원국 표 ── */}
        <div className="print:break-inside-avoid" style={{ ...card, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <PillarCell label="년주" pillar={saju.yearPillar} index={0} />
            <PillarCell label="월주" pillar={saju.monthPillar} index={1} />
            <PillarCell label="일주" pillar={saju.dayPillar} index={2} />
            <PillarCell label="시주" pillar={saju.hourPillar ?? undefined} index={3} />
          </div>
          <div
            style={{
              padding: "12px 16px",
              background: "var(--color-surface-2)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <p style={{ ...smallNote, color: "var(--color-text-2)" }}>{correctionNote(data)}</p>
            {term && <p style={{ ...smallNote, color: "var(--color-text-2)" }}>{term}</p>}
          </div>
        </div>

        {/* ── 오행 개수 ── */}
        <div className="print:break-inside-avoid" style={{ ...card, padding: "22px 22px" }}>
          <h3 style={cardTitle}>오행 개수</h3>
          <CountBars count={saju.fiveElementCount} />
          <p style={{ ...bodyText, marginTop: 16, color: "var(--color-text)" }}>
            {countSummary(saju.fiveElementCount, data.characterCount, data.strongestElements)}
          </p>
        </div>

        {/* ── 용신·희신 ── */}
        {saju.yongshin && (
          <div
            className="print:break-inside-avoid"
            style={{
              ...card,
              padding: "22px 22px",
              borderLeft: `3px solid ${elOf(saju.yongshin.primaryYongshin).color}`,
            }}
          >
            <h3 style={cardTitle}>용신과 희신</h3>
            <p style={{ ...bodyText, fontSize: 15.5, fontWeight: 600, color: "var(--color-text)" }}>
              {yongshinHeadline(saju.yongshin.primaryYongshin, saju.yongshin.heeshin)}
            </p>
            <p style={{ ...smallNote, color: "var(--color-text-2)", marginTop: 4 }}>
              일간 <span style={{ fontFamily: "var(--font-serif)" }}>{saju.dayMaster}</span>
              {STRENGTH_LABEL[saju.yongshin.strength] ? ` · ${STRENGTH_LABEL[saju.yongshin.strength]}` : ""}
            </p>
            <p style={{ ...bodyText, marginTop: 12 }}>
              {saju.yongshin.strengthDescription} {saju.yongshin.yongshinReason}
            </p>
            {/* 둘째 문장이 가리키는 설명 글(page.tsx 의 OhaengGuide)은 결과가 있는 인쇄에서 빠진다 — 같은 표지로 함께 뺀다
                (:has() 를 모르는 브라우저는 설명 글도 이 문장도 찍는다) */}
            <p style={{ ...smallNote, marginTop: 10 }}>
              용신은 억부·조후 가운데 무엇을 앞세우느냐에 따라 달라져, 다른 곳에서 본 용신과 다를 수 있어요.{" "}
              <span data-hide-print-with-result>‘없는 오행’과 용신이 어떻게 다른지는 아래 설명에 적었어요.</span>
            </p>
          </div>
        )}

        {/* ── 오행별 이름 한자 예 ── */}
        {data.elementHanja.length > 0 && (
          <div style={{ ...card, padding: "22px 22px" }}>
            <h3 style={cardTitle}>오행별 이름 한자 예</h3>
            <p style={smallNote}>
              이 사이트가 이름 글자로 꼽아 둔 한자(사용 통계는 아닙니다) 가운데 부수 기준 자원오행이 그 오행인 글자를 오행마다
              12자까지 골랐습니다. 성별은 보지 않았고,
              이 글자를 써야 한다는 뜻은 아닙니다.{" "}
              {/* 종이에서는 누를 수 없는 조작 안내 — 인쇄에서 뺀다 */}
              <span data-hide-print>독음을 누르면 한자 사전에서 같은 독음의 글자를 볼 수 있어요.</span>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 18 }}>
              {data.elementHanja.map((g) => (
                <HanjaGroup key={g.element} group={g} yongshin={saju.yongshin?.primaryYongshin ?? ""} />
              ))}
            </div>
            {/* 한자 예가 하나라도 있을 때만(없는 오행이 기신이면 한자 예를 비운다 — 그때는 링크도 없다) */}
            {data.elementHanja.some((g) => !g.isGishin && g.hanja.length > 0) && (
              <p style={{ ...smallNote, marginTop: 16 }} data-hide-print>
                ‘맞춰 보기’는 이름 평가를 새 창으로 열어요. 생년월일은 넘기지 않으니, 이름 평가에서 다시 넣으면 이 한자가 필요한
                오행을 채우는지 점수와 함께 볼 수 있어요.
              </p>
            )}
          </div>
        )}

        {/* ── 다음 단계 ── 링크 카드라 인쇄에서 뺀다 */}
        <div style={{ ...card, padding: "22px 22px" }} data-hide-print>
          <h3 style={cardTitle}>다음 단계</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* /search 는 오행을 골라 찾아 주지 않는다 — 생년월일로 계산한 용신·희신 글자에 가산점을 주어 음절마다 한자를 배정하고(HanjaSelector),
                자원오행 보완은 조화 점수(종합의 30%) 안의 한 축이다(종합 최대 9점). 그래서 '이 오행을 담은 이름'을 약속하지 않는다.
                /search?preferredElement= 로 걸지 않는다 — /smart 가 그 값을 넘기지 않아 그 배너('해당 오행 한자를 포함한 이름이 상위에')가 거짓이다
                (CLAUDE.md 알려진 이슈, tests/ohaeng-privacy.test.mjs '쿼리 없는 맨 경로'). 2026-11-19 반박 검토 — 설계 §16 */}
            <NextStep
              href="/search"
              lead="내 사주의 용신을 반영해 이름을 추천받으려면"
              title="이름 추천"
              body="생년월일을 넣으면 음절마다 용신·희신 오행의 한자에 가산점을 주어 배정하고, 그 자원오행이 사주와 맞는지를 조화 점수(종합의 30%) 가운데 ‘자원오행 보완’으로 반영합니다."
            />
            <NextStep
              href="/evaluate"
              lead="이미 정한 이름이 있다면"
              title="이름 평가"
              body="이름 한자의 자원오행·발음오행·수리를 무료로 분석합니다. 한자를 직접 골라 맞춰 볼 수 있어요."
            />
            <NextStep
              href="/hanja"
              lead="글자 뜻과 자원오행을 더 보려면"
              title="인명용 한자 사전"
              body="독음마다 인명용 한자의 뜻·자원오행·획수를 정리했습니다."
            />
          </ul>
          {needsSeoulOnlyNotice(data) && (
            <p style={{ ...smallNote, marginTop: 12 }}>
              이름 추천·평가는 아직 출생지를 받지 않고 서울 기준으로 계산해, 서울 밖에서 태어났다면 시각에 따라 용신이 여기와 다를 수
              있어요.
            </p>
          )}
        </div>

        <p style={{ ...smallNote, textAlign: "center", marginTop: 4 }}>
          오행과 용신은 전통 작명에서 쓰는 해석 틀입니다. 이 결과는 성격이나 앞날을 알려 주지 않습니다.
        </p>
      </div>
    </section>
  );
}

// ============================================================
// 원국 한 기둥
// ============================================================
function PillarCell({
  label,
  pillar,
  index,
}: {
  label: string;
  pillar: SajuPillarData | undefined;
  index: number;
}) {
  const cellStyle: CSSProperties = {
    padding: "18px 6px 16px",
    textAlign: "center",
    borderRight: index < 3 ? "1px solid var(--color-divider)" : "none",
    minWidth: 0,
  };
  const labelStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text-2)",
    letterSpacing: "0.04em",
  };

  if (!pillar) {
    return (
      <div style={cellStyle}>
        <div style={labelStyle}>{label}</div>
        <div aria-hidden style={{ fontSize: 24, color: "var(--color-text-3)", margin: "28px 0 24px" }}>
          —
        </div>
        <div style={{ fontSize: 11.5, color: "var(--color-text-3)" }}>시각 없음</div>
      </div>
    );
  }

  const stemEl = pillar.fiveElement || STEM_ELEMENT[pillar.stemChar];
  const branchEl = pillar.branchFiveElement || BRANCH_ELEMENT[pillar.branchChar];

  return (
    <div style={cellStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 10 }}>
        <Glyph char={pillar.stemChar} element={stemEl} />
        <Glyph char={pillar.branchChar} element={branchEl} />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--color-text-2)", marginTop: 8 }}>
        {pillar.stemName}·{pillar.branchName}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--color-text-3)", marginTop: 2 }}>
        {ELEMENT_KO[stemEl as keyof typeof ELEMENT_KO] ?? "?"}·{ELEMENT_KO[branchEl as keyof typeof ELEMENT_KO] ?? "?"}
      </div>
    </div>
  );
}

function Glyph({ char, element }: { char: string; element: string }) {
  const el = elOf(element);
  return (
    <span
      title={element ? `${char} — ${element}` : char}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: "var(--radius-md)",
        background: el.tintBg,
        color: el.text,
        fontFamily: "var(--font-serif)",
        fontSize: 26,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {char}
    </span>
  );
}

// ============================================================
// 오행 개수 막대
// ============================================================
function CountBars({ count }: { count: Record<string, number> }) {
  const max = Math.max(1, ...ELEMENTS.map((e) => count[e] ?? 0));
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {ELEMENTS.map((k) => {
        const n = count[k] ?? 0;
        const el = elOf(k);
        return (
          <li
            key={k}
            style={{ display: "grid", gridTemplateColumns: "52px minmax(0, 1fr) 36px", alignItems: "center", gap: 10 }}
          >
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 600, color: el.text }}>{k}</span>
              <span style={{ fontSize: 12.5, color: "var(--color-text-2)" }}>{ELEMENT_KO[k]}</span>
            </span>
            <span
              aria-hidden
              style={{ height: 10, borderRadius: 999, background: "var(--color-surface-2)", overflow: "hidden" }}
            >
              <span
                style={{
                  display: "block",
                  width: `${n ? Math.max((n / max) * 100, 6) : 0}%`,
                  height: "100%",
                  background: el.color,
                  opacity: 0.75,
                  borderRadius: 999,
                }}
              />
            </span>
            <span
              style={{
                fontSize: 13,
                color: n ? "var(--color-text)" : "var(--color-text-3)",
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
              }}
            >
              {n}개
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ============================================================
// 오행 한 묶음의 한자 예
// ============================================================
function HanjaGroup({ group, yongshin }: { group: ElementHanjaGroup; yongshin: string }) {
  const el = elOf(group.element);
  return (
    <div>
      <h4 style={{ margin: 0 }}>
        <span
          style={{
            display: "inline-block",
            fontSize: 13,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: "var(--radius-sm)",
            background: el.tintBg,
            color: el.text,
          }}
        >
          {groupHeading(group)}
        </span>
      </h4>
      {group.isGishin ? (
        <p style={{ ...bodyText, fontSize: 13.5, marginTop: 10 }}>{gishinNote(group.element, yongshin)}</p>
      ) : group.hanja.length === 0 ? (
        <p style={{ ...smallNote, marginTop: 10 }}>이 오행은 보여 드릴 한자 예가 없어요.</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: "12px 0 0",
            padding: 0,
            display: "grid",
            // 88px — 375px 폭(카드 안 약 297px)에서 세 칸이 들어간다(100px 이면 두 칸이라 12자가 여섯 줄)
            gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
            gap: 8,
          }}
        >
          {group.hanja.map((h) => (
            <HanjaItem key={h.character} item={h} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HanjaItem({ item }: { item: ElementHanjaItem }) {
  const exception = item.resourceGrade === "X";
  return (
    <li
      className="print:break-inside-avoid"
      style={{
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-md)",
        textAlign: "center",
        minWidth: 0,
        // 칸마다 훈 줄 수가 달라도 '맞춰 보기'가 칸 바닥에 나란히 놓이게 — 위 묶음이 남는 높이를 가져간다
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: "1 1 auto", padding: "10px 8px 8px" }}>
        <div
          style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 600, color: "var(--color-text)", lineHeight: 1.2 }}
        >
          {item.character}
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {joinNodes(
            item.readings.map((r) => (
              <Link key={r} href={hanjaHref(r)} style={link} aria-label={`${item.character} ‘${r}’ 독음 한자 보기`}>
                {r}
              </Link>
            )),
            " · ",
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-2)", marginTop: 3, wordBreak: "keep-all" }}>{item.gloss}</div>
        {exception && (
          <div style={{ fontSize: 11, color: "var(--color-text-3)", marginTop: 3 }} title={RESOURCE_GRADE_INFO.X.tip}>
            {RESOURCE_GRADE_INFO.X.label}
          </div>
        )}
      </div>
      {/* 이 글자를 들고 이름 평가로(새 창). 풀 페이지 이동(<a>) — 해시만 싣고 쿼리는 없다. 칸마다 글이 같아 이름(aria-label)에 글자를 넣는다.
          새 창으로 열린다는 것을 링크 이름에도 적는다(카드 아래 안내 줄에만 있으면 링크로 옮겨 다니는 사용자는 모른다) */}
      <a
        href={evaluatePickHref(item.character, item.readings)}
        target="_blank"
        rel="noopener"
        aria-label={`${item.character} 한자로 이름 맞춰 보기 (새 창)`}
        style={pickLink}
        data-hide-print
      >
        맞춰 보기
      </a>
    </li>
  );
}

function joinNodes(nodes: ReactNode[], sep: string): ReactNode[] {
  return nodes.flatMap((n, i) => (i === 0 ? [n] : [<span key={`s${i}`} aria-hidden>{sep}</span>, n]));
}

// ============================================================
// 다음 단계 링크
// ============================================================
function NextStep({ href, lead, title, body }: { href: string; lead: string; title: string; body: string }) {
  return (
    <li>
      <Link
        href={href}
        style={{
          display: "block",
          padding: "14px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <span style={{ display: "block", fontSize: 12.5, color: "var(--color-text-2)" }}>{lead} →</span>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--color-teal)", marginTop: 2 }}>{title}</span>
        <span style={{ display: "block", fontSize: 13, lineHeight: 1.6, color: "var(--color-text-2)", marginTop: 4 }}>{body}</span>
      </Link>
    </li>
  );
}
