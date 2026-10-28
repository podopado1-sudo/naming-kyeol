/**
 * SmartResultParent — Parent variant of the main result page
 * Source: NameForm_design/src/SmartResultParent.jsx (Claude Design 산출물, 1053줄)
 *
 * Hero: 가족 매핑 banner (NamingModel별 다른 시각)
 * SubHeader: 부모 chip + 키워드 chip
 * Tabs: parent-based 첫 번째 + 기본 활성
 * Card: NamingModel chip + parent-link reason 강조
 * Banner: 작명 모델 toggle filter
 */
"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { PhonologyNote } from "@/lib/types";
import { familyMeaningRoles } from "@/lib/parent-naming";

// ============================================================
// 데이터 타입 (Parent variant 전용)
// ============================================================
export type NamingModelKey = "phonetic" | "semantic" | "narrative";

export interface ParentPerson {
  fullName: string;
  /** 성을 뺀 이름 — 배너가 계승 글자를 이 안에서 찾는다(전체 이름에서 찾으면 성 글자가 칠해진다) */
  givenName?: string;
  hanjaName?: string;
}

export interface ParentSummary {
  lastName: string;
  date?: string;
  gender?: string;
  tone?: string;
  hanja?: boolean;
  pureKorean?: boolean;
  creative?: boolean;
  parents: {
    father?: ParentPerson;
    mother?: ParentPerson;
    keywords?: string[];
  };
}

// 점수 필드가 없다 — 부모 기반 응답(ParentBasedCandidate)은 이름·작명 모델·분류·설명만 준다. 옛 타입의 aesthetics·harmony·
// finalScore·rarity 와 배너 averageScores 는 어댑터가 후보 순서·고정값 50으로 지어낸 숫자라 지웠다(2026-10-28).
// 점수가 있던 자리(카드 오른쪽·첫 번째 후보)는 evaluateHref 로 실제 평가 화면에 보낸다
export interface ParentUICandidate {
  fullName: string;
  hanjaName?: string;
  meaning: string;
  tags: string[];
  reasons: string[];
  phonologyNotes: PhonologyNote[];
  namingModel?: NamingModelKey;
  /** '이 이름 평가하기' — /evaluate?lastName=…&name=…(+입력한 생년월일·시각·성별·톤) */
  evaluateHref: string;
}

export interface ParentBasedMeta {
  modelsAvailable: { key: NamingModelKey; label: string }[];
  analysisInputs: string[];
}

export interface ParentUICategory {
  type: string;
  label: string;
  description?: string;
  engineUsed?: string;
  totalInCategory: number;
  names: ParentUICandidate[];
  parentMeta?: ParentBasedMeta;
}

export interface ParentResultData {
  totalCount: number;
  categories: ParentUICategory[];
  topPick: ParentUICandidate | null;
  requestSummary: ParentSummary;
}

const NAMING_MODELS: Record<
  NamingModelKey,
  {
    label: string;
    icon: string;
    chipBg: string;
    chipFg: string;
    activeBorder: string;
  }
> = {
  phonetic: {
    label: "음운 계승형",
    icon: "✦",
    chipBg: "var(--color-teal-50)",
    chipFg: "var(--color-teal)",
    activeBorder: "var(--color-teal)",
  },
  semantic: {
    label: "의미 계승형",
    icon: "✧",
    chipBg: "var(--color-gold-50)",
    chipFg: "#6F5421",
    activeBorder: "var(--color-gold)",
  },
  narrative: {
    label: "가족 서사형",
    icon: "✿",
    chipBg: "var(--color-navy-50)",
    chipFg: "var(--color-navy)",
    activeBorder: "var(--color-navy)",
  },
};

// ============================================================
// 공통 atoms
// ============================================================
const baseChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 12px",
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: "nowrap",
};
const flagChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  color: "var(--color-teal)",
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: "nowrap",
};
const btnGhostP: CSSProperties = {
  appearance: "none",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 500,
  background: "transparent",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  padding: "7px 12px",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function Sep() {
  return (
    <span
      style={{
        width: 1,
        height: 14,
        background: "var(--color-divider)",
        margin: "0 4px",
      }}
    />
  );
}

function Check({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path
        d="M2 6.5l2.5 2.5L10 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TagChipP({ label }: { label: string }) {
  let palette = {
    bg: "rgba(43,43,43,0.06)",
    color: "var(--color-text-2)",
  };
  if (["음운중심", "의미중심"].includes(label))
    palette = { bg: "var(--color-teal-50)", color: "var(--color-teal)" };
  else if (["자연", "덕목", "개념"].includes(label))
    palette = { bg: "var(--color-gold-50)", color: "#6F5421" };
  else if (label === "세대중립")
    palette = {
      bg: "rgba(43,43,43,0.06)",
      color: "var(--color-text-2)",
    };
  else if (label === "창작")
    palette = { bg: "var(--color-navy-50)", color: "var(--color-navy)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
        fontFamily: "var(--font-sans)",
        background: palette.bg,
        color: palette.color,
      }}
    >
      {label}
    </span>
  );
}

/**
 * '이 이름 평가하기' — 점수가 있던 자리(후보 카드 오른쪽·첫 번째 후보 카드)에 둔다. 부모 기반 응답에는 점수가 없어
 * 옛 화면이 후보 순서로 지어낸 미학·조화·최종·희귀도 대신 실제 평가 화면으로 보낸다(2026-10-28).
 * 새 탭으로 연다 — 후보 목록은 /parent-based 의 React 상태에만 있어 같은 탭으로 갔다 돌아오면 입력 폼으로 돌아가 후보를 잃는다.
 * next/link 가 아니라 일반 <a> — /evaluate 는 정적 라우트라 클라이언트 라우터 캐시가 이전 ?name= 결과를 다시 내놓는다
 * (app/favorites '다시 보기'와 같은 우회). 글자·↗ 는 teal 13·11px — 흰 카드(surface) 위 4.85:1. ↗ 는 새 탭 표시(aria-hidden —
 * 접근 이름이 '(새 탭)'으로 말한다). 접근 이름은 보이는 글자로 시작하고(라벨-이름 일치) 후보 이름을 붙여 목록의 링크가 서로 구분된다
 */
function EvaluateLinkP({ href, fullName }: { href: string; fullName: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={`이 이름 평가하기: ${fullName} (새 탭)`}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 500,
        color: "var(--color-teal)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      이 이름 평가하기
      <span aria-hidden="true" style={{ fontSize: 11, marginLeft: 3 }}>
        ↗
      </span>
    </a>
  );
}

// ============================================================
// SubHeaderParent
// ============================================================
// 부모 동그라미 머리글자 — 성 다음 글자(이름 첫 글자). 성만 넣으면('김') 그 자리가 '' 라 빈 동그라미가 그려졌다 —
// 그때는 첫 글자로 (2026-10-27, ParentChip·ParentNode 공용)
function parentInitial(fullName: string): string {
  return fullName.slice(1, 2) || fullName.slice(0, 1);
}

function ParentChip({
  role,
  person,
}: {
  role: string;
  person: ParentPerson;
}) {
  const [open, setOpen] = useState(false);
  const initial = parentInitial(person.fullName || "");
  const isFather = role === "아빠";
  return (
    <span style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          appearance: "none",
          border: "1px solid var(--color-divider)",
          background: "var(--color-surface)",
          borderRadius: 999,
          padding: "3px 12px 3px 3px",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          color: "var(--color-text)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: isFather
              ? "var(--color-teal-50)"
              : "var(--color-gold-50)",
            color: isFather ? "var(--color-teal)" : "#6F5421",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "var(--font-serif)",
          }}
        >
          {initial}
        </span>
        <span style={{ fontWeight: 500 }}>{person.fullName}</span>
        <span style={{ color: "var(--color-text-3)" }}>· {role}</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "var(--color-surface)",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--color-divider)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            minWidth: 200,
            zIndex: 20,
            fontSize: 13,
            color: "var(--color-text)",
          }}
        >
          <div style={{ fontWeight: 600 }}>{person.fullName}</div>
          {person.hanjaName && (
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 14,
                color: "var(--color-navy)",
                marginTop: 4,
              }}
            >
              {person.hanjaName}
            </div>
          )}
          <div
            style={{
              marginTop: 6,
              color: "var(--color-text-2)",
              fontSize: 12,
            }}
          >
            {role}
          </div>
        </div>
      )}
    </span>
  );
}

function SubHeaderParent({
  summary,
  onRegenerate,
  onSave,
}: {
  summary: ParentSummary;
  onRegenerate?: () => void;
  onSave?: () => void;
}) {
  const baseChips = [
    `성 ${summary.lastName}`,
    summary.date,
    summary.gender,
    summary.tone,
  ].filter(Boolean) as string[];
  const flags = [
    summary.hanja && "한자",
    summary.pureKorean && "순우리말",
    summary.creative && "창작",
  ].filter(Boolean) as string[];
  const { father, mother, keywords } = summary.parents;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 24px",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          flex: "1 1 0",
          minWidth: 0,
        }}
      >
        {baseChips.map((c, i) => (
          <span key={i} style={baseChip}>
            {c}
          </span>
        ))}
        {flags.length > 0 && <Sep />}
        {flags.map((f, i) => (
          <span key={i} style={flagChip}>
            <Check size={11} /> {f}
          </span>
        ))}
        {(father || mother || (keywords && keywords.length > 0)) && <Sep />}
        {father && <ParentChip role="아빠" person={father} />}
        {mother && <ParentChip role="엄마" person={mother} />}
        {keywords && keywords.length > 0 && (
          <span
            style={{
              ...baseChip,
              background: "var(--color-navy-50)",
              color: "var(--color-navy)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontFamily: "var(--font-serif)" }}>✿</span>
            &ldquo;{keywords[0]}&rdquo; 키워드
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button type="button" onClick={onRegenerate} style={btnGhostP}>
          ↻ 새로 생성
        </button>
        {/* onSave가 없으면 숨김 — 눌러도 아무 일 없는 버튼을 두지 않는다 */}
        {onSave && (
          <button type="button" onClick={onSave} style={btnGhostP}>
            ♡ 이 결과 저장
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ParentHero + Family Mapping Banner
// ============================================================
interface Bridge {
  /** 부모·아이 이름 강조 글자·주석 알약 글자 */
  color: string;
  /** 점선 연결선·화살표·주석 알약 테두리(비텍스트) — 글자만 짙은 토큰으로 옮겨도 선은 옛 색 그대로 */
  lineColor: string;
  fatherChar: string | null;
  motherChar: string | null;
  childChar: string | null;
  fatherHanja: string | null;
  motherHanja: string | null;
  childHanja: string | null;
  annotation: string | null;
}

function computeBridge(
  top: ParentUICandidate,
  parents: ParentSummary["parents"],
  lastName: string
): Bridge {
  // 아이 이름(성 제외) — 옛 slice(1) 은 복성 아이의 둘째 성 글자를, 옛 3~4음절 이름('김김춘리')에서는 아버지 성을 계승 글자로 잡았다
  const given = lastName && top.fullName.startsWith(lastName)
    ? top.fullName.slice(lastName.length)
    : top.fullName.slice(1);
  const childChars = given.split("");
  const fGiven = parents.father?.givenName ?? "";
  const mGiven = parents.mother?.givenName ?? "";
  if (top.namingModel === "phonetic") {
    // 부모 이름(성 제외) 글자를 먼저 찾고, 없을 때만 전체 이름(어머니 성씨 잇기의 성 글자)
    const f = parents.father?.fullName ?? "";
    const m = parents.mother?.fullName ?? "";
    let fatherChar: string | null = null;
    let motherChar: string | null = null;
    let childChar: string | null = null;
    for (const [fs, ms] of [[fGiven, mGiven], [f, m]]) {
      for (const ch of childChars) {
        if (fs && fs.includes(ch)) {
          fatherChar = ch;
          childChar = ch;
          break;
        }
        if (ms && ms.includes(ch)) {
          motherChar = ch;
          childChar = ch;
          break;
        }
      }
      if (childChar) break;
    }
    return {
      color: "var(--color-teal)",
      lineColor: "var(--color-teal)",
      fatherChar,
      motherChar,
      childChar,
      fatherHanja: null,
      motherHanja: null,
      childHanja: null,
      annotation: null,
    };
  }
  if (top.namingModel === "semantic") {
    // 부모 이름 뜻 잇기 — 아이 이름 음절마다 그 음절을 준 부모와 백엔드가 풀이한 한자(hanjaName, 음절과 같은 길이).
    // 옛 코드는 방식 이름(anchor)에서 한자를 찾아 늘 null 이었다(2026-10-28)
    const hanja = top.hanjaName && top.hanjaName.length === childChars.length ? top.hanjaName.split("") : [];
    let fatherChar: string | null = null;
    let motherChar: string | null = null;
    let fatherHanja: string | null = null;
    let motherHanja: string | null = null;
    const parts: string[] = [];
    // 음절을 준 부모는 설명 문장에서 읽는다 — 이름 칸에서 아버지 먼저 찾으면 두 부모 이름에 다 있는 음절(민수 + 수진 → '수민'의 '수')을
    // 설명("어머니 이름의 '수'…")과 반대로 아버지 글자로 칠했다(2026-10-28 2차 검증)
    const roles = familyMeaningRoles(top.meaning, childChars, fGiven, mGiven);
    childChars.forEach((ch, i) => {
      if (!hanja[i]) return;
      if (!fatherChar && roles[i] === "father") {
        fatherChar = ch;
        fatherHanja = hanja[i];
        parts.push(`${ch}(${hanja[i]})`);
      } else if (!motherChar && roles[i] === "mother") {
        motherChar = ch;
        motherHanja = hanja[i];
        parts.push(`${ch}(${hanja[i]})`);
      }
    });
    return {
      // 부모 이름 강조 글자(13~32px, gold-50 바탕) — 옛 gold-600 은 gold-50 위 2.55:1 이라 골드 글자 토큰(2026-10-26 팔레트 #2).
      // 연결선·화살표·주석 알약 테두리는 옛 gold-600 그대로(비텍스트 — 짙은 갈색 선이 되지 않게, 같은 날 보완)
      color: "var(--color-gold-800)",
      lineColor: "var(--color-gold-600)",
      fatherChar,
      motherChar,
      childChar: null,
      fatherHanja,
      motherHanja,
      childHanja: null,
      // 예: "민(敏) + 서(書) · 의미축 잇기" — 부모 이름의 그 음절을 어떤 한자로 풀었는지
      annotation: parts.length > 0 ? `${parts.join(" + ")} · 의미축 잇기` : null,
    };
  }
  // 가족 서사형 — 두 부모 이름에 함께 있는 글자(부모 공통 글자 잇기)가 아이 이름에 있으면 셋 다 그 글자를 칠한다
  const shared = childChars.find((ch) => fGiven.includes(ch) && mGiven.includes(ch)) ?? null;
  return {
    color: "var(--color-navy)",
    lineColor: "var(--color-navy)",
    fatherChar: shared,
    motherChar: shared,
    childChar: shared,
    fatherHanja: null,
    motherHanja: null,
    childHanja: null,
    annotation: null,
  };
}

function ParentNode({
  person,
  role,
  highlightChar,
  highlightHanja,
  highlightColor,
}: {
  person?: ParentPerson;
  role: string;
  highlightChar: string | null;
  highlightHanja: string | null;
  highlightColor: string;
}) {
  if (!person) return null;
  const initial = parentInitial(person.fullName);
  const chars = person.fullName.split("");
  const hanjaChars = (person.hanjaName || "").split("");
  const hl = highlightColor || "var(--color-teal)";
  const hlBg =
    hl === "var(--color-gold-800)"
      ? "var(--color-gold-50)"
      : hl === "var(--color-navy)"
        ? "var(--color-navy-50)"
        : "var(--color-teal-50)";
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 999,
          margin: "0 auto",
          background: "var(--color-surface)",
          border: "1px solid var(--color-divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          color: "var(--color-navy)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {initial}
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 18,
          fontWeight: 500,
          color: "var(--color-text)",
        }}
      >
        {chars.map((ch, i) => (
          <span
            key={i}
            style={
              highlightChar && ch === highlightChar
                ? {
                    background: hlBg,
                    color: hl,
                    padding: "0 3px",
                    borderRadius: 4,
                    fontWeight: 600,
                  }
                : undefined
            }
          >
            {ch}
          </span>
        ))}
      </div>
      {hanjaChars.length > 0 && (
        <div
          style={{
            marginTop: 4,
            fontFamily: "var(--font-serif)",
            fontSize: 13,
            color: "var(--color-text-3)",
          }}
        >
          {hanjaChars.map((ch, i) => (
            <span
              key={i}
              style={
                highlightHanja && ch === highlightHanja
                  ? {
                      background: hlBg,
                      color: hl,
                      padding: "0 3px",
                      borderRadius: 4,
                      fontWeight: 600,
                    }
                  : undefined
              }
            >
              {ch}
            </span>
          ))}
        </div>
      )}
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-3)",
          marginTop: 4,
        }}
      >
        ({role})
      </div>
    </div>
  );
}

function ChildNode({
  top,
  model,
  keyword,
  highlightChar,
  highlightHanja,
  highlightColor,
}: {
  top: ParentUICandidate;
  model: NamingModelKey | undefined;
  keyword?: string;
  highlightChar: string | null;
  highlightHanja: string | null;
  highlightColor: string;
}) {
  const m = NAMING_MODELS[model ?? "narrative"];
  const hl = highlightColor || m.activeBorder;
  const hlBg =
    hl === "var(--color-gold-800)"
      ? "var(--color-gold-50)"
      : hl === "var(--color-navy)"
        ? "var(--color-navy-50)"
        : "var(--color-teal-50)";
  const childChars = top.fullName.split("");
  const childHanjaChars = (top.hanjaName || "").split("");
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-gold)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 28px",
        textAlign: "center",
        minWidth: 280,
        position: "relative",
        boxShadow: "0 12px 28px rgba(201,169,110,0.18)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -10,
          left: "50%",
          transform: "translateX(-50%)",
          background: m.chipBg,
          color: m.chipFg,
          padding: "3px 12px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
          border: "1px solid " + m.activeBorder,
        }}
      >
        {/* 옛 'TOP PICK' — 부모 기반 응답은 순위를 매기지 않는다(엔진이 작명 모델별로 번갈아 담은 순서). 맨 위 이름을
            최고점처럼 보이던 근거는 지어낸 점수뿐이라 '첫 번째 후보'로 (2026-10-28) */}
        <span style={{ fontFamily: "var(--font-serif)" }}>{m.icon}</span>{" "}
        첫 번째 후보 · {m.label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 32,
          fontWeight: 500,
          color: "var(--color-text)",
          letterSpacing: "-0.018em",
          marginTop: 6,
        }}
      >
        <span style={{ marginRight: 4 }}>👶</span>
        {childChars.map((ch, i) => (
          <span
            key={i}
            style={
              highlightChar && ch === highlightChar
                ? {
                    background: hlBg,
                    color: hl,
                    padding: "0 4px",
                    borderRadius: 4,
                  }
                : undefined
            }
          >
            {ch}
          </span>
        ))}
      </div>
      {top.hanjaName && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              color: "var(--color-navy)",
            }}
          >
            {childHanjaChars.map((ch, i) => (
              <span
                key={i}
                style={
                  highlightHanja && ch === highlightHanja
                    ? {
                        background: hlBg,
                        color: hl,
                        padding: "0 4px",
                        borderRadius: 4,
                      }
                    : undefined
                }
              >
                {ch}
              </span>
            ))}
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--color-text-2)",
            }}
          >
            · {top.meaning}
          </span>
        </div>
      )}
      {/* 옛 '92점' — 첫 번째 후보는 늘 92였다(지어낸 값). 그 자리에 실제 평가 링크 */}
      <div style={{ marginTop: 12 }}>
        <EvaluateLinkP href={top.evaluateHref} fullName={top.fullName} />
      </div>
      {model === "narrative" && keyword && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "var(--color-navy)",
            background: "var(--color-navy-50)",
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: 999,
            fontWeight: 500,
          }}
        >
          키워드 &ldquo;{keyword}&rdquo; 매핑
        </div>
      )}
    </div>
  );
}

function ConnectorSVG({
  color,
  single = false,
}: {
  color: string;
  /** 부모 한 명 — 가운데(x=200) 곧은 점선 하나. 기본은 두 열 가운데(x=50·350)에서 내려오는 곡선 두 줄 */
  single?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 400 80"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: "20%",
        right: "20%",
        width: "60%",
        top: "calc(50% - 30px)",
        height: 80,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {single ? (
        // preserveAspectRatio="none" 의 가로 늘임(폰 0.5배~데스크톱 1.3배)이 세로선 굵기를 그대로 바꾸므로 굵기만 화면 1.5px 로 고정
        <path
          d="M200 0 L200 70"
          stroke={color}
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <>
          <path
            d="M50 0 Q 200 50 200 70"
            stroke={color}
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="3 4"
          />
          <path
            d="M350 0 Q 200 50 200 70"
            stroke={color}
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="3 4"
          />
        </>
      )}
      <polygon points="200,76 195,68 205,68" fill={color} />
    </svg>
  );
}

function FamilyMappingBanner({
  data,
  top,
}: {
  data: ParentResultData;
  top: ParentUICandidate;
}) {
  const parents = data.requestSummary.parents;
  const bridge = computeBridge(top, parents, data.requestSummary.lastName);
  // 부모 이름은 선택 입력이다 — 폼은 아빠·엄마·키워드 중 하나만 있으면 받고 백엔드도 후보를 낸다(키워드만·한쪽 부모만).
  // 둘 다면 옛 2열 + 곡선 두 줄 그대로, 한 명이면 그 사람만 가운데 + 곧은 점선 하나, 없으면 부모 줄·연결선·70px 간격 없이 아이 카드만.
  // 옛 화면은 늘 2열·곡선 두 줄이라 키워드만이면 빈 띠와 허공에서 나오는 점선, 엄마만이면 아빠 자리(왼쪽 열)에 엄마가 섰다 (2026-10-27)
  const parentCount = (parents.father ? 1 : 0) + (parents.mother ? 1 : 0);
  return (
    <div
      style={{
        marginTop: 28,
        position: "relative",
        background: "#F4EFE7",
        borderRadius: "var(--radius-lg)",
        padding: "32px 28px",
        overflow: "hidden",
      }}
    >
      {parentCount > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: parentCount === 2 ? "1fr 1fr" : "1fr",
            gap: 24,
            position: "relative",
          }}
        >
          <ParentNode
            person={parents.father}
            role="아빠"
            highlightChar={bridge.fatherChar}
            highlightHanja={bridge.fatherHanja}
            highlightColor={bridge.color}
          />
          <ParentNode
            person={parents.mother}
            role="엄마"
            highlightChar={bridge.motherChar}
            highlightHanja={bridge.motherHanja}
            highlightColor={bridge.color}
          />
        </div>
      )}
      {parentCount === 2 && <ConnectorSVG color={bridge.lineColor} />}
      {parentCount === 1 && <ConnectorSVG color={bridge.lineColor} single />}
      {/* 주석 알약은 연결선 위 자리(배너 세로 가운데)라 부모가 없으면 아이 카드에 겹친다 — 연결선과 함께만 */}
      {parentCount > 0 && bridge.annotation && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "calc(50% - 6px)",
            transform: "translate(-50%, -50%)",
            background: "var(--color-surface)",
            border: "1px solid " + bridge.lineColor,
            padding: "4px 10px",
            borderRadius: 999,
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 500,
            color: bridge.color,
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {bridge.annotation}
        </div>
      )}
      <div
        style={{
          marginTop: parentCount > 0 ? 70 : 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <ChildNode
          top={top}
          model={top.namingModel}
          keyword={parents.keywords?.[0]}
          highlightChar={bridge.childChar}
          highlightHanja={bridge.childHanja}
          highlightColor={bridge.color}
        />
      </div>
    </div>
  );
}

function ParentHero({
  data,
  top,
}: {
  data: ParentResultData;
  /** 배너 아이 카드('첫 번째 후보')에 세울 후보 — 페이지가 아래 목록의 맨 앞(#1)을 넘긴다 */
  top: ParentUICandidate | null;
}) {
  if (!top) return null;
  const modelLabel = NAMING_MODELS[top.namingModel ?? "narrative"].label;
  return (
    <div
      style={{
        padding: "48px 24px 8px",
        maxWidth: 920,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--color-text-3)",
        }}
      >
        Parent Naming · Result
      </div>
      <h1
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 36,
          fontWeight: 500,
          margin: "10px 0 8px",
          letterSpacing: "-0.018em",
          lineHeight: 1.25,
        }}
      >
        가족의 결을 잇는 {data.requestSummary.lastName} 씨 아기 이름
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "var(--color-text-2)",
          margin: 0,
        }}
      >
        <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
          {modelLabel}
        </b>
        에 따라 부모님의 이름·서사를 분석했어요
      </p>
      <FamilyMappingBanner data={data} top={top} />
    </div>
  );
}

function GeneralHero({ data }: { data: ParentResultData }) {
  return (
    <div
      style={{
        padding: "48px 24px 8px",
        maxWidth: 920,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--color-text-3)",
        }}
      >
        Naming · Result
      </div>
      <h1
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 32,
          fontWeight: 500,
          margin: "10px 0 8px",
          letterSpacing: "-0.018em",
          lineHeight: 1.25,
        }}
      >
        {data.requestSummary.lastName} 씨를 위한 이름
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-2)",
          margin: 0,
        }}
      >
        총{" "}
        <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
          {data.totalCount}개
        </b>{" "}
        후보가 있어요. 부모 기반 결과는 첫 번째 탭에서 확인하세요
      </p>
    </div>
  );
}

// ============================================================
// CategoryTabsP / Banners
// ============================================================
function CategoryTabsP({
  categories,
  active,
  onChange,
}: {
  categories: ParentUICategory[];
  active: string;
  onChange: (type: string) => void;
}) {
  return (
    <div
      style={{
        maxWidth: 920,
        margin: "40px auto 0",
        padding: "0 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "var(--color-surface-2)",
          padding: 4,
          borderRadius: 999,
          overflowX: "auto",
        }}
      >
        {categories.map((cat) => {
          const isActive = cat.type === active;
          const isParent = cat.type === "parent-based";
          return (
            <button
              key={cat.type}
              type="button"
              onClick={() => onChange(cat.type)}
              style={{
                appearance: "none",
                border: "none",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                padding: "9px 16px",
                borderRadius: 999,
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: isActive ? "var(--color-surface)" : "transparent",
                color: isActive
                  ? "var(--color-text)"
                  : "var(--color-text-2)",
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
                fontWeight: isActive ? 600 : 500,
                transition: "all 160ms",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isParent && (
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 12,
                    color: isActive
                      ? "var(--color-teal)"
                      : "var(--color-text-3)",
                  }}
                >
                  ✿
                </span>
              )}
              {cat.label}{" "}
              <span
                style={{
                  color: "var(--color-text-3)",
                  fontFamily: "Inter, var(--font-sans)",
                  fontWeight: 400,
                  marginLeft: 2,
                }}
              >
                ({cat.totalInCategory})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BannerStat({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 10,
          color: "var(--color-text-3)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function FamilyJoinIcon() {
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: "var(--radius-sm)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle
          cx="7.5"
          cy="9"
          r="4.2"
          stroke="var(--color-teal)"
          strokeWidth="1.4"
        />
        <circle
          cx="12.5"
          cy="9"
          r="4.2"
          stroke="var(--color-gold)"
          strokeWidth="1.4"
        />
      </svg>
    </span>
  );
}

function ParentBasedBanner({
  cat,
  activeModels,
  onToggleModel,
}: {
  cat: ParentUICategory;
  activeModels: NamingModelKey[];
  onToggleModel: (key: NamingModelKey) => void;
}) {
  const meta = cat.parentMeta;
  if (!meta) return null;
  return (
    <div
      style={{
        maxWidth: 920,
        margin: "20px auto 0",
        padding: "20px 24px",
        background: "#F4EFE7",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <FamilyJoinIcon />
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--color-text)",
            }}
          >
            {cat.label}
          </div>
        </div>
        {/* 내부 엔진 클래스 이름(by {cat.engineUsed})은 그리지 않는다 — 사용자에게 뜻이 없고 구현 이름이 드러난다(2026-10-28) */}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
        }}
      >
        <BannerStat label="작명 모델">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {meta.modelsAvailable.map((m) => {
              const on = activeModels.includes(m.key);
              const visual = NAMING_MODELS[m.key];
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => onToggleModel(m.key)}
                  style={{
                    appearance: "none",
                    border: "1px solid",
                    borderColor: on
                      ? visual.activeBorder
                      : "var(--color-border)",
                    background: on ? visual.chipBg : "transparent",
                    color: on
                      ? visual.chipFg
                      : "var(--color-text-3)",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 11,
                    }}
                  >
                    {on ? "✓" : "×"}
                  </span>
                  {m.label}
                </button>
              );
            })}
          </div>
        </BannerStat>

        <BannerStat label="분석 데이터">
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text)",
              lineHeight: 1.7,
            }}
          >
            {meta.analysisInputs.map((s, i) => (
              <div key={i}>· {s}</div>
            ))}
          </div>
        </BannerStat>
        {/* 옛 '평균 점수'(미학·조화·최종) 칸은 지어낸 후보 점수의 평균이라 뺐다(2026-10-28) */}
      </div>
    </div>
  );
}

function GeneralCategoryBanner({ cat }: { cat: ParentUICategory }) {
  const iconOf: Record<string, string> = {
    standard: "漢",
    "pure-korean": "ㅎ",
    creative: "✦",
    "dual-name": "EN",
  };
  return (
    <div
      style={{
        maxWidth: 920,
        margin: "20px auto 0",
        padding: "16px 24px",
        background: "#F4EFE7",
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
            color: "var(--color-teal)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 15,
            border: "1px solid var(--color-divider)",
          }}
        >
          {iconOf[cat.type] || "·"}
        </span>
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--color-text)",
            }}
          >
            {cat.label}
          </div>
          {cat.description && (
            <div
              style={{
                fontSize: 13,
                color: "var(--color-text-2)",
                marginTop: 2,
              }}
            >
              {cat.description}
            </div>
          )}
        </div>
      </div>
      {/* 내부 엔진 클래스 이름(by {cat.engineUsed})은 그리지 않는다 — 사용자에게 뜻이 없고 구현 이름이 드러난다(2026-10-28) */}
    </div>
  );
}

// ============================================================
// Candidate cards
// ============================================================
function ParentCandidateCard({
  candidate,
  index,
  initialOpen,
}: {
  candidate: ParentUICandidate;
  index: number;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!initialOpen);
  const [hover, setHover] = useState(false);
  const c = candidate;
  const m = NAMING_MODELS[c.namingModel ?? "narrative"];
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: "var(--color-surface)",
        border:
          "1px solid " +
          (hover ? "var(--color-teal-100)" : "var(--color-border)"),
        borderRadius: "var(--radius-lg)",
        padding: "26px 26px 22px",
        boxShadow: hover
          ? "0 10px 24px rgba(46, 125, 122, 0.08)"
          : "var(--shadow-sm)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 200ms cubic-bezier(.2,.6,.2,1)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -10,
          left: 22,
          background: m.chipBg,
          color: m.chipFg,
          padding: "4px 12px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
          border: "1px solid " + m.activeBorder,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 11 }}>
          {m.icon}
        </span>
        {m.label}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "Inter, var(--font-sans)",
            fontSize: 11,
            color: "var(--color-text-3)",
            letterSpacing: "0.08em",
            fontWeight: 600,
          }}
        >
          #{index + 1}
        </span>
      </div>

      {/* 이름·뜻(왼쪽) + '이 이름 평가하기'(오른쪽, 옛 FINAL 점수 자리). 줄바꿈 flex — 폰 폭(카드 안 ~275px)에서는
          링크가 이름 아래 오른쪽 끝으로 내려가 뜻 칸을 좁히지 않는다 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: 24,
          rowGap: 10,
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 28,
              fontWeight: 500,
              color: "var(--color-text)",
              letterSpacing: "-0.015em",
            }}
          >
            {c.fullName}
          </div>
          {(c.hanjaName || c.meaning) && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginTop: 6,
                flexWrap: "wrap",
              }}
            >
              {c.hanjaName && (
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 18,
                    color: "var(--color-navy)",
                  }}
                >
                  {c.hanjaName}
                </span>
              )}
              <span
                style={{
                  fontSize: 13,
                  color: "var(--color-text-2)",
                }}
              >
                {c.hanjaName && "· "}
                {c.meaning}
              </span>
            </div>
          )}
        </div>
        <div style={{ marginLeft: "auto", flexShrink: 0 }}>
          <EvaluateLinkP href={c.evaluateHref} fullName={c.fullName} />
        </div>
      </div>

      {c.tags.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {c.tags.map((t, i) => (
            <TagChipP key={i} label={t} />
          ))}
        </div>
      )}

      {(c.reasons.length > 0 || c.phonologyNotes.length > 0) && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px dashed var(--color-divider)",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-2)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transition: "transform 180ms",
                transform: open ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▸
            </span>
            이름의 결
          </button>
          {open && (
            <div style={{ marginTop: 12, paddingLeft: 18 }}>
              {c.reasons.length > 0 && (
                <div style={{ display: "grid", gap: 6 }}>
                  {c.reasons.map((r, i) => {
                    const isParentLink = i === 0;
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 10,
                          fontSize: 13.5,
                          color: "var(--color-text)",
                          lineHeight: 1.6,
                        }}
                      >
                        <span
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 999,
                            background: isParentLink
                              ? m.activeBorder
                              : "var(--color-teal)",
                            flexShrink: 0,
                            marginTop: 8,
                          }}
                        />
                        <span
                          style={
                            isParentLink
                              ? {
                                  fontWeight: 500,
                                  background: m.chipBg,
                                  color: m.chipFg,
                                  padding: "2px 8px",
                                  borderRadius: "var(--radius-sm)",
                                }
                              : undefined
                          }
                        >
                          {r}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {c.phonologyNotes.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    background: "var(--color-surface-2)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    fontSize: 12.5,
                    color: "var(--color-text-2)",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: "var(--color-text-3)",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    i
                  </span>
                  <div>
                    {c.phonologyNotes.map((n, i) => (
                      <div key={i}>
                        <b
                          style={{
                            color: "var(--color-text)",
                            fontWeight: 600,
                          }}
                        >
                          {n.name}
                        </b>
                        {" — "}
                        {n.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function GeneralCandidateCard({
  candidate,
  index,
}: {
  candidate: ParentUICandidate;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const c = candidate;
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--color-surface)",
        border:
          "1px solid " +
          (hover ? "var(--color-teal-100)" : "var(--color-border)"),
        borderRadius: "var(--radius-lg)",
        padding: "22px 26px",
        boxShadow: hover
          ? "0 10px 24px rgba(46, 125, 122, 0.08)"
          : "var(--shadow-sm)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 200ms cubic-bezier(.2,.6,.2,1)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "Inter, var(--font-sans)",
            fontSize: 11,
            color: "var(--color-text-3)",
            letterSpacing: "0.08em",
            fontWeight: 600,
          }}
        >
          #{index + 1}
        </span>
      </div>
      {/* 이름·뜻(왼쪽) + '이 이름 평가하기'(오른쪽, 옛 FINAL 점수 자리). 줄바꿈 flex — 폰 폭(카드 안 ~275px)에서는
          링크가 이름 아래 오른쪽 끝으로 내려가 뜻 칸을 좁히지 않는다 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: 24,
          rowGap: 10,
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 28,
              fontWeight: 500,
              color: "var(--color-text)",
              letterSpacing: "-0.015em",
            }}
          >
            {c.fullName}
          </div>
          {(c.hanjaName || c.meaning) && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginTop: 6,
                flexWrap: "wrap",
              }}
            >
              {c.hanjaName && (
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 18,
                    color: "var(--color-navy)",
                  }}
                >
                  {c.hanjaName}
                </span>
              )}
              <span
                style={{
                  fontSize: 13,
                  color: "var(--color-text-2)",
                }}
              >
                {c.hanjaName && "· "}
                {c.meaning}
              </span>
            </div>
          )}
        </div>
        <div style={{ marginLeft: "auto", flexShrink: 0 }}>
          <EvaluateLinkP href={c.evaluateHref} fullName={c.fullName} />
        </div>
      </div>
      {c.tags.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {c.tags.map((t, i) => (
            <TagChipP key={i} label={t} />
          ))}
        </div>
      )}
      {c.reasons.length > 0 && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px dashed var(--color-divider)",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-2)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transition: "transform 180ms",
                transform: open ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▸
            </span>
            이름의 결
          </button>
          {open && (
            <div
              style={{
                marginTop: 12,
                paddingLeft: 18,
                display: "grid",
                gap: 6,
              }}
            >
              {c.reasons.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    fontSize: 13.5,
                    color: "var(--color-text)",
                    lineHeight: 1.6,
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 999,
                      background: "var(--color-teal)",
                      flexShrink: 0,
                      marginTop: 8,
                    }}
                  />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ============================================================
// SmartResultParentPage — 메인
// ============================================================
export function SmartResultParentPage({
  data,
  initialTab,
  initialActiveModels,
  expandFirstCard = false,
  editHref = "/parent-based",
  onRegenerate,
  onSave,
}: {
  data: ParentResultData;
  initialTab?: string;
  initialActiveModels?: NamingModelKey[];
  expandFirstCard?: boolean;
  editHref?: string;
  onRegenerate?: () => void;
  onSave?: () => void;
}) {
  const [tab, setTab] = useState(initialTab || "parent-based");
  const [activeModels, setActiveModels] = useState<NamingModelKey[]>(
    initialActiveModels || ["phonetic", "semantic", "narrative"]
  );
  const bannerRef = useRef<HTMLDivElement>(null);

  const onTabChange = (t: string) => {
    setTab(t);
    setTimeout(() => {
      if (bannerRef.current) {
        const y =
          bannerRef.current.getBoundingClientRect().top +
          window.scrollY -
          80;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 30);
  };

  const toggleModel = (key: NamingModelKey) => {
    setActiveModels((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    );
  };

  const activeCat =
    data.categories.find((c) => c.type === tab) ?? data.categories[0];
  if (!activeCat) return null;

  const isParent = activeCat.type === "parent-based";

  const visibleNames = isParent
    ? activeCat.names.filter(
        (n) => !n.namingModel || activeModels.includes(n.namingModel)
      )
    : activeCat.names;
  // 배너의 '첫 번째 후보'는 아래 목록 #1 과 같은 후보 — 작명 모델 토글로 걸러진 목록의 맨 앞. 옛 배너는 늘 응답 첫 후보
  // (data.topPick)라 그 모델을 끄면 목록에 없는 이름이 '첫 번째 후보 · {모델}'로 남았다(2026-10-28). 모델을 모두 꺼
  // 목록이 비면 응답 첫 후보
  const heroTop = visibleNames[0] ?? data.topPick;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-background)",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(250, 247, 242, 0.92)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--color-divider)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              fontWeight: 500,
              color: "var(--color-navy)",
              letterSpacing: "-0.01em",
            }}
          >
            이름의 결
          </span>
          <span
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 11,
              color: "var(--color-text-3)",
              letterSpacing: "0.06em",
            }}
          >
            Naming.kyeol
          </span>
        </Link>
        <Link
          href={editHref}
          style={{
            fontSize: 13,
            color: "var(--color-text-2)",
            textDecoration: "none",
          }}
        >
          ← 조건 수정
        </Link>
      </header>

      <SubHeaderParent
        summary={data.requestSummary}
        onRegenerate={onRegenerate}
        onSave={onSave}
      />

      <main>
        {isParent ? (
          <ParentHero data={data} top={heroTop} />
        ) : (
          <GeneralHero data={data} />
        )}

        <CategoryTabsP
          categories={data.categories}
          active={tab}
          onChange={onTabChange}
        />

        <div ref={bannerRef} data-banner-anchor>
          {isParent ? (
            <ParentBasedBanner
              cat={activeCat}
              activeModels={activeModels}
              onToggleModel={toggleModel}
            />
          ) : (
            <GeneralCategoryBanner cat={activeCat} />
          )}
        </div>

        <div
          style={{
            maxWidth: 880,
            margin: "20px auto 0",
            padding: "0 24px",
            display: "grid",
            gap: 22,
          }}
        >
          {visibleNames.length === 0 ? (
            <div
              style={{
                padding: "32px 24px",
                textAlign: "center",
                color: "var(--color-text-2)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
                border: "1px dashed var(--color-border)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-text)",
                }}
              >
                선택된 작명 모델로는 후보가 없어요
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                위에서 다른 모델을 켜주세요
              </div>
            </div>
          ) : isParent ? (
            visibleNames.map((n, i) => (
              <ParentCandidateCard
                key={i}
                candidate={n}
                index={i}
                initialOpen={expandFirstCard && i === 0}
              />
            ))
          ) : (
            visibleNames.map((n, i) => (
              <GeneralCandidateCard key={i} candidate={n} index={i} />
            ))
          )}
        </div>

        <footer
          style={{
            marginTop: 64,
            padding: "32px 24px 48px",
            borderTop: "1px solid var(--color-divider)",
            textAlign: "center",
            color: "var(--color-text-2)",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-block",
              fontSize: 14,
              color: "var(--color-text)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            다른 경로로 작명하기 ↓
          </Link>
          <div
            style={{
              marginTop: 16,
              fontSize: 12,
              display: "flex",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <a
              href="#"
              style={{
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
            >
              이름의 결에 대하여
            </a>
            <span style={{ color: "var(--color-divider)" }}>·</span>
            <a
              href="#"
              style={{
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
            >
              문의
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default SmartResultParentPage;
