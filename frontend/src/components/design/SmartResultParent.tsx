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
import { useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { PhonologyNote } from "@/lib/types";
import { familyMeaningRoles } from "@/lib/parent-naming";

// ============================================================
// 데이터 타입 (Parent variant 전용)
// ============================================================
export type NamingModelKey = "phonetic" | "semantic" | "narrative";

export interface ParentPerson {
  fullName: string;
  /**
   * 성 — 배너가 fullName 의 성 자리와 이름 자리를 가른다(2026-11-27: 옛 머리글자는 fullName 둘째 글자라 남궁민수 → '궁',
   * 성 칸을 비운 지호 → '호'였고, 강조는 글자 값으로 비교해 정수정의 성 '정'까지 칠했다)
   */
  surname?: string;
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
  /**
   * 응답의 작명 방식 코드 원값(keyword-meaning·mother-surname 등 — 백엔드 ParentNamingModels). 화면에 그대로 내지 않는다 —
   * 배너의 '키워드 "…" 매핑' 칩을 키워드 방식(keyword-*) 후보에만 붙이는 데 쓴다(2026-11-27: 옛 칩은 계승 꼴이 '가족 서사형'이기만 하면
   * 붙어 키워드와 무관한 부모 공통 글자 잇기 후보에도 떴다)
   */
  namingCode?: string;
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

/** 머리의 '← 조건 수정' — 옛 Link 와 같은 모양의 글자 단추 */
const editButtonP: CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  color: "var(--color-text-2)",
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
 * 접근 이름이 '(새 탭)'으로 말한다). 접근 이름은 보이는 글자로 시작하고(라벨-이름 일치) 후보 이름을 붙여 목록의 링크가 서로 구분된다.
 * 인쇄에서는 숨긴다(data-hide-print — 종이에서 누를 수 없는 링크)
 */
function EvaluateLinkP({ href, fullName }: { href: string; fullName: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      data-hide-print
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
function ParentChip({
  role,
  person,
}: {
  role: string;
  person: ParentPerson;
}) {
  const [open, setOpen] = useState(false);
  const initial = parentInitial(person);
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
  onSave,
}: {
  summary: ParentSummary;
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
      {/* 옛 '↻ 새로 생성'은 지웠다(2026-11-27) — 부모 기반 엔진은 같은 입력에 같은 후보를 돌려줘 다시 만들지 않고
          폼으로 돌아가기만 했다. 폼으로 돌아가는 길은 머리의 '← 조건 수정'(onRegenerate) 하나다.
          저장 단추는 핸들러가 있을 때만 그리고 인쇄에서 숨긴다(data-hide-print) */}
      {onSave && (
        <div data-hide-print style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={onSave} style={btnGhostP}>
            ♡ 이 결과 저장
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ParentHero + Family Mapping Banner
// ============================================================
// #region parent-banner — 배너 계산(순수 함수). tests/fix1127-parent-rare.test.mjs 가 이 구간을 떼어 돌린다 —
// 구간 안에는 JSX·import 를 두지 않는다(familyMeaningRoles 는 테스트가 따로 import 해 넣는다)

/**
 * 부모 동그라미 머리글자 — 성을 뺀 이름의 첫 글자. 이름 없이 성만 넣었으면 그 첫 글자(빈 동그라미를 그리지 않는다 — 2026-10-27).
 * 옛 꼴(fullName 둘째 글자)은 성을 한 글자로 가정해 복성 남궁민수 → '궁', 성 칸을 비운 지호 → '호'였다(2026-11-27, ParentChip·ParentNode 공용)
 */
function parentInitial(person: ParentPerson): string {
  const given = (person.givenName ?? "").trim();
  return given.slice(0, 1) || person.fullName.slice(0, 1);
}

/** fullName 앞의 성 글자 수 — surname 이 있으면 그 길이, 없으면 fullName 이 givenName 으로 끝날 때 그 앞부분 */
function surnameLength(person: ParentPerson): number {
  if (person.surname && person.fullName.startsWith(person.surname)) return person.surname.length;
  const given = person.givenName ?? "";
  if (given && person.fullName.endsWith(given)) return person.fullName.length - given.length;
  return 0;
}

type ParentRoleKey = "father" | "mother";

/** 설명 문장이 말한 부모 글자 하나 — 어느 부모의 성·이름 가운데 어느 글자가 아이 이름의 어느 음절이 됐는지 */
interface DescribedParentChar {
  role: ParentRoleKey;
  /** 부모 쪽 글자(성 글자면 성 — 어머니 성씨 방식은 외자 성만 쓴다) */
  syllable: string;
  part: "given" | "surname";
  /** 아이 이름에 들어간 음절 — 어머니 성씨 소리 잇기는 두음 꼴로 바꿔 잇기도 한다(이 → 리) */
  childSyllable: string;
}

/**
 * 설명 문장(백엔드 ParentBasedNamingEngine 이 방식마다 만드는 꼴)에서 부모 글자를 읽는다 — 배너가 이름 글자를 짐작하지 않고
 * 설명이 말한 글자를 칠하게(2026-11-27: 옛 배너는 아이 이름 글자를 아버지 이름에서 먼저 찾아, 어머니 성씨 '이' + 짝 글자 '수'로 지은
 * '이수'에서 아버지 민수의 '수'를 계승 글자로 칠했다). 읽는 꼴:
 *  - "아버지와 어머니 이름에 함께 있는 'X'" (shared-syllable — 두 부모 모두)
 *  - "아버지 이름 'GIVEN'의 'X'와 'Y'" · "… 'GIVEN'의 두 글자 순서를 바꾼" (parent-syllables 한 부모 변형)
 *  - "아버지 이름 첫 글자 'X'" · "어머니 이름의 'X'" (parent-initials·parent-syllables·family-meaning·…-initial·…-syllable)
 *  - "어머니 성씨 'S'를 첫 글자로" · "… 'S'를 끝 글자 'T'로 바꿔" · "… 'S'를 그대로 끝 글자로" (mother-surname·mother-sound)
 * 키워드·성씨 뜻 방식은 부모 글자를 말하지 않아 빈 목록이다. 결과는 설명에 나온 순서
 */
function describedParentChars(description: string): DescribedParentChar[] {
  const found: { at: number; ref: DescribedParentChar }[] = [];
  const add = (at: number, role: ParentRoleKey, syllable: string, part: "given" | "surname", childSyllable = syllable) => {
    found.push({ at, ref: { role, syllable, part, childSyllable } });
  };
  const roleOf = (word: string): ParentRoleKey => (word === "아버지" ? "father" : "mother");
  for (const m of description.matchAll(/아버지와 어머니 이름에 함께 있는 '([가-힣])'/g)) {
    add(m.index ?? 0, "father", m[1], "given");
    add(m.index ?? 0, "mother", m[1], "given");
  }
  for (const m of description.matchAll(/(아버지|어머니) 이름 '([가-힣]+)'의 (?:'([가-힣])'[과와] '([가-힣])'|두 글자 순서를 바꾼)/g)) {
    const chars = m[3] && m[4] ? [m[3], m[4]] : m[2].split("").reverse();
    for (const ch of chars) add(m.index ?? 0, roleOf(m[1]), ch, "given");
  }
  for (const m of description.matchAll(/(아버지|어머니) 이름(?:의| 첫 글자) '([가-힣])'/g)) {
    add(m.index ?? 0, roleOf(m[1]), m[2], "given");
  }
  for (const m of description.matchAll(/어머니 성씨 '([가-힣]{1,2})'[을를] (?:끝 글자 '([가-힣])'(?:으로|로) 바꿔)?/g)) {
    add(m.index ?? 0, "mother", m[1], "surname", m[2] ?? m[1]);
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.ref);
}

/**
 * 부모 fullName 안에서 그 글자의 자리 — 이름 글자는 성 뒤에서만, 성 글자는 성 안에서만 찾고 첫 자리 하나만 돌려준다
 * (어머니 정수정의 이름 '정'을 칠할 때 성 '정'까지 칠하던 것 — 2026-11-27)
 */
function parentCharIndex(person: ParentPerson | undefined, syllable: string, part: "given" | "surname"): number | null {
  if (!person || !syllable) return null;
  const sLen = surnameLength(person);
  const i =
    part === "surname"
      ? person.fullName.slice(0, sLen || person.fullName.length).indexOf(syllable)
      : person.fullName.indexOf(syllable, sLen);
  return i >= 0 ? i : null;
}

interface Bridge {
  /** 부모·아이 이름 강조 글자·주석 알약 글자 */
  color: string;
  /** 점선 연결선·화살표·주석 알약 테두리(비텍스트) — 글자만 짙은 토큰으로 옮겨도 선은 옛 색 그대로 */
  lineColor: string;
  /** 칠할 글자 자리(부모 fullName 안) — 글자 값이 아니라 자리로 칠해 성·이름에 같은 글자가 있어도 한 번만 칠한다 */
  fatherIdx: number | null;
  motherIdx: number | null;
  /** 칠할 글자 자리(아이 fullName 안 — 성 뒤) */
  childIdx: number[];
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
  const offset = lastName && top.fullName.startsWith(lastName) ? lastName.length : 1;
  const given = top.fullName.slice(offset);
  const childChars = given.split("");
  const fGiven = parents.father?.givenName ?? "";
  const mGiven = parents.mother?.givenName ?? "";
  if (top.namingModel === "semantic") {
    // 부모 이름 뜻 잇기 — 아이 이름 음절마다 그 음절을 준 부모와 백엔드가 풀이한 한자(hanjaName, 음절과 같은 길이).
    // 옛 코드는 방식 이름(anchor)에서 한자를 찾아 늘 null 이었다(2026-10-28)
    const hanja = top.hanjaName && top.hanjaName.length === childChars.length ? top.hanjaName.split("") : [];
    let fatherIdx: number | null = null;
    let motherIdx: number | null = null;
    let fatherHanja: string | null = null;
    let motherHanja: string | null = null;
    const parts: string[] = [];
    // 음절을 준 부모는 설명 문장에서 읽는다 — 이름 칸에서 아버지 먼저 찾으면 두 부모 이름에 다 있는 음절(민수 + 수진 → '수민'의 '수')을
    // 설명("어머니 이름의 '수'…")과 반대로 아버지 글자로 칠했다(2026-10-28 2차 검증)
    const roles = familyMeaningRoles(top.meaning, childChars, fGiven, mGiven);
    for (let i = 0; i < childChars.length; i++) {
      const ch = childChars[i];
      if (!hanja[i]) continue;
      if (fatherHanja === null && roles[i] === "father") {
        fatherIdx = parentCharIndex(parents.father, ch, "given");
        fatherHanja = hanja[i];
        parts.push(`${ch}(${hanja[i]})`);
      } else if (motherHanja === null && roles[i] === "mother") {
        motherIdx = parentCharIndex(parents.mother, ch, "given");
        motherHanja = hanja[i];
        parts.push(`${ch}(${hanja[i]})`);
      }
    }
    return {
      // 부모 이름 강조 글자(13~32px, gold-50 바탕) — 옛 gold-600 은 gold-50 위 2.55:1 이라 골드 글자 토큰(2026-10-26 팔레트 #2).
      // 연결선·화살표·주석 알약 테두리는 옛 gold-600 그대로(비텍스트 — 짙은 갈색 선이 되지 않게, 같은 날 보완)
      color: "var(--color-gold-800)",
      lineColor: "var(--color-gold-600)",
      fatherIdx,
      motherIdx,
      childIdx: [],
      fatherHanja,
      motherHanja,
      childHanja: null,
      // 예: "민(敏) + 서(書) · 의미축 잇기" — 부모 이름의 그 음절을 어떤 한자로 풀었는지
      annotation: parts.length > 0 ? `${parts.join(" + ")} · 의미축 잇기` : null,
    };
  }
  // 음운 계승형·가족 서사형 — 설명 문장이 말한 부모 글자만 칠한다. 아빠·엄마는 글자 하나씩, 아이는 그 글자들이 들어간 자리.
  // 키워드·성씨 뜻 잇기는 부모 글자를 말하지 않아 칠하지 않는다(옛 서사형은 아이 이름 글자가 우연히 두 부모 이름에 다 있어도 칠했다)
  const refs = describedParentChars(top.meaning);
  let fatherIdx: number | null = null;
  let motherIdx: number | null = null;
  const childIdx: number[] = [];
  for (const r of refs) {
    const ci = given.indexOf(r.childSyllable);
    if (ci < 0) continue; // 설명의 글자가 이름에 없다 — 칠하지 않는다
    const pi = parentCharIndex(r.role === "father" ? parents.father : parents.mother, r.syllable, r.part);
    if (pi === null) continue;
    if (r.role === "father") {
      if (fatherIdx !== null) continue;
      fatherIdx = pi;
    } else {
      if (motherIdx !== null) continue;
      motherIdx = pi;
    }
    if (!childIdx.includes(offset + ci)) childIdx.push(offset + ci);
  }
  // 설명에서 아무 글자도 못 읽은 음운 계승형(옛 응답 꼴)만 옛 방식 — 아이 이름 첫 글자부터 부모 이름(성 제외)에서 찾는다
  if (refs.length === 0 && top.namingModel === "phonetic") {
    for (let i = 0; i < childChars.length && childIdx.length === 0; i++) {
      const ch = childChars[i];
      const fi = fGiven.includes(ch) ? parentCharIndex(parents.father, ch, "given") : null;
      const mi = fi === null && mGiven.includes(ch) ? parentCharIndex(parents.mother, ch, "given") : null;
      if (fi !== null) fatherIdx = fi;
      else if (mi !== null) motherIdx = mi;
      else continue;
      childIdx.push(offset + i);
    }
  }
  const phonetic = top.namingModel === "phonetic";
  return {
    color: phonetic ? "var(--color-teal)" : "var(--color-navy)",
    lineColor: phonetic ? "var(--color-teal)" : "var(--color-navy)",
    fatherIdx,
    motherIdx,
    childIdx: childIdx.sort((a, b) => a - b),
    fatherHanja: null,
    motherHanja: null,
    childHanja: null,
    annotation: null,
  };
}

/** 아이 카드의 '키워드 "…" 매핑' 칩 — 키워드 방식(keyword-meaning·keyword-sound) 후보에만. 키워드가 없으면 null */
function keywordChipFor(top: ParentUICandidate, keyword: string | undefined): string | null {
  return keyword && top.namingCode?.startsWith("keyword-") ? keyword : null;
}
// #endregion parent-banner

function ParentNode({
  person,
  role,
  highlightIdx,
  highlightHanja,
  highlightColor,
}: {
  person?: ParentPerson;
  role: string;
  /** 칠할 글자 자리(fullName 안) — computeBridge 가 성·이름 자리를 가려 정한다 */
  highlightIdx: number | null;
  highlightHanja: string | null;
  highlightColor: string;
}) {
  if (!person) return null;
  const initial = parentInitial(person);
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
              i === highlightIdx
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
  keywordChip,
  highlightIdx,
  highlightHanja,
  highlightColor,
}: {
  top: ParentUICandidate;
  model: NamingModelKey | undefined;
  /** '키워드 "…" 매핑' 칩 글자 — 키워드 방식 후보일 때만(keywordChipFor), 아니면 null */
  keywordChip: string | null;
  /** 칠할 글자 자리(fullName 안 — 성 뒤) */
  highlightIdx: number[];
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
        // 폰 폭(375)에서는 배너 안쪽이 271px 라 280 고정이면 카드 오른쪽이 배너 밖(overflow hidden)으로 잘린다 — 칸 폭까지만
        minWidth: "min(280px, 100%)",
        position: "relative",
        boxShadow: "0 12px 28px rgba(201,169,110,0.18)",
      }}
    >
      <div
        data-print-inline-tag
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
              highlightIdx.includes(i)
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
      {keywordChip && (
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
          키워드 &ldquo;{keywordChip}&rdquo; 매핑
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
            highlightIdx={bridge.fatherIdx}
            highlightHanja={bridge.fatherHanja}
            highlightColor={bridge.color}
          />
          <ParentNode
            person={parents.mother}
            role="엄마"
            highlightIdx={bridge.motherIdx}
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
          keywordChip={keywordChipFor(top, parents.keywords?.[0])}
          highlightIdx={bridge.childIdx}
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
  rowRef,
  scrollerRef,
}: {
  categories: ParentUICategory[];
  active: string;
  onChange: (type: string) => void;
  /** 탭 줄 — 탭을 바꾸면 이 줄을 고정 머리말 바로 아래로 올린다(scrollTabsIntoView) */
  rowRef?: RefObject<HTMLDivElement | null>;
  /** 가로로 넘치는 탭 칸 — 고른 탭을 가운데로 민다 */
  scrollerRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={rowRef}
      data-hide-print
      style={{
        maxWidth: 920,
        margin: "40px auto 0",
        padding: "0 24px",
      }}
    >
      <div
        ref={scrollerRef}
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
              aria-pressed={isActive}
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
  hidePrint,
}: {
  label: string;
  children: ReactNode;
  /** 인쇄에서 숨길 칸 — 조작 단추만 든 칸(작명 모델 켜고 끄기) */
  hidePrint?: boolean;
}) {
  return (
    <div data-hide-print={hidePrint || undefined}>
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
        <BannerStat label="작명 모델" hidePrint>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {meta.modelsAvailable.map((m) => {
              const on = activeModels.includes(m.key);
              const visual = NAMING_MODELS[m.key];
              return (
                <button
                  key={m.key}
                  type="button"
                  aria-pressed={on}
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
      className="print:break-inside-avoid"
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
        data-print-inline-tag
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
            data-hide-print
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
      className="print:break-inside-avoid"
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
            data-hide-print
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

/** 고정 머리말 높이를 못 잴 때의 값(패딩 12 × 2 + 글자 줄 + 아래 선 — 375·1280 폭 모두 57px) */
const STICKY_HEADER_FALLBACK = 57;

/**
 * 탭을 바꾼 뒤 탭 줄을 고정 머리말 바로 아래(8px 띄움)로 올리고, 고른 탭을 탭 칸 가로 가운데로 민다.
 * 옛 계산은 배너 위 80px 를 목표로 해 그 위의 탭 줄(배너 위 20px 띄움 + 줄 높이 44px)이 57px 머리말 밑으로 숨었다(2026-11-27).
 * 가로는 scrollIntoView 대신 탭 칸의 scrollLeft 를 직접 민다 — scrollIntoView 는 창 세로 스크롤까지 건드려 위의 부드러운 스크롤과 겹친다
 */
function scrollTabsIntoView(
  header: HTMLElement | null,
  row: HTMLElement | null,
  scroller: HTMLElement | null
) {
  if (row) {
    const headerH = header?.getBoundingClientRect().height || STICKY_HEADER_FALLBACK;
    const y = row.getBoundingClientRect().top + window.scrollY - headerH - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }
  const tab = scroller?.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (scroller && tab) {
    const s = scroller.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    const left = scroller.scrollLeft + (t.left - s.left) - (s.width - t.width) / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }
}

// ============================================================
// SmartResultParentPage — 메인
// ============================================================
export function SmartResultParentPage({
  data,
  initialTab,
  initialActiveModels,
  expandFirstCard = false,
  onRegenerate,
  onSave,
}: {
  data: ParentResultData;
  initialTab?: string;
  initialActiveModels?: NamingModelKey[];
  expandFirstCard?: boolean;
  /**
   * 머리의 '← 조건 수정' — 결과를 지우고 입력값이 남은 폼으로 돌아간다(페이지의 handleReset). 옛 '↻ 새로 생성'은
   * 같은 핸들러라 다시 만들지 않고 폼으로만 돌아가서 지웠다(엔진이 같은 입력에 같은 후보를 준다).
   * 옛 '← 조건 수정'은 같은 경로(editHref)로 가는 Link 라 눌러도 결과 화면이 그대로였다(2026-11-27)
   */
  onRegenerate?: () => void;
  onSave?: () => void;
}) {
  const [tab, setTab] = useState(initialTab || "parent-based");
  const [activeModels, setActiveModels] = useState<NamingModelKey[]>(
    initialActiveModels || ["phonetic", "semantic", "narrative"]
  );
  const headerRef = useRef<HTMLElement>(null);
  const tabsRowRef = useRef<HTMLDivElement>(null);
  const tabsScrollerRef = useRef<HTMLDivElement>(null);

  const onTabChange = (t: string) => {
    setTab(t);
    // 다시 그린 뒤(고른 탭의 aria-pressed 가 바뀐 뒤) 잰다
    setTimeout(() => scrollTabsIntoView(headerRef.current, tabsRowRef.current, tabsScrollerRef.current), 30);
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
        ref={headerRef}
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
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            data-hide-print
            style={editButtonP}
          >
            ← 조건 수정
          </button>
        )}
      </header>

      <SubHeaderParent summary={data.requestSummary} onSave={onSave} />

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
          rowRef={tabsRowRef}
          scrollerRef={tabsScrollerRef}
        />

        {/* 좌우 24px — 폰 폭에서 띠 바탕이 화면 끝에 붙지 않게(아래 카드 목록과 같은 여백). 데스크톱은 띠 최대 폭 920 그대로 */}
        <div data-banner-anchor style={{ padding: "0 24px" }}>
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

        {/* 결과 화면 꼬리 — 링크뿐이라 인쇄에서 통째로 숨긴다. 옛 '이름의 결에 대하여'·'문의'는 주소가 '#'인 빈 링크(맨 위로 튈 뿐)였다 —
            결과 화면은 사이트 Footer 를 그리지 않아 소개·문의로 가는 길이 이 둘뿐이다(2026-11-27) */}
        <footer
          data-hide-print
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
            <Link
              href="/about"
              style={{
                color: "var(--color-text-3)",
                textDecoration: "none",
              }}
            >
              이름의 결에 대하여
            </Link>
            <span aria-hidden="true" style={{ color: "var(--color-divider)" }}>·</span>
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
        </footer>
      </main>
    </div>
  );
}

export default SmartResultParentPage;
