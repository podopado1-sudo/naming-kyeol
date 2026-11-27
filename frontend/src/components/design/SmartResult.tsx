/**
 * SmartResult — Main naming recommendation result page
 * Source: NameForm_design/src/SmartResult.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState/useRef → 명시적 import
 *   - PascalCase 데이터 → camelCase
 *   - 백엔드 SmartRecommendationResponse 직접 받음 + RequestSummary는 별도 prop
 *   - 미학·조화는 백엔드 실제 값만 표시(없으면 숨김). RARITY 막대는 표준 후보의 '희귀도:N' 태그 값만
 *     (없으면 숨김)
 */
"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { toast } from "sonner";
import { trackTabView } from "@/lib/api";
import {
  FAVORITE_SAVE_FAILED,
  FAVORITES_LIMIT,
  favoriteCount,
  toggleFavorite,
  useIsFavorite,
} from "@/lib/favorites";
import { josa } from "@/lib/josa";
import { normalizeSpecialtyTags } from "@/lib/specialty-candidates";
import type { CandidateDetailContext } from "@/lib/useCandidateDetail";
import type {
  PhonologyNote,
  SmartNameCandidate,
  SmartRecommendationResponse,
} from "@/lib/types";

// ============================================================
// Types — 디자인 컴포넌트 내부에서 사용
// ============================================================
export interface RequestSummary {
  lastName: string;
  date?: string;
  gender?: string;
  tone?: string;
  hanja?: boolean;
  pureKorean?: boolean;
  creative?: boolean;
}

interface UICandidate {
  fullName: string;
  name?: string;
  hanjaName?: string;
  meaning: string;
  /** 사람 서사형 코이닝 한 문장 (창의 한정). 없으면 숨김. */
  story?: string;
  /**
   * 백엔드가 종합 점수(score)를 준 후보인지 — FINAL 표시 여부. required-char·dual-name·
   * parent-based는 score가 null이라 false면 점수 UI를 모두 숨긴다.
   */
  hasScore: boolean;
  /**
   * 미학·조화를 백엔드가 실제로 준 후보인지 — 미학·조화 줄 표시 여부.
   * ⚠️ 2026-10-21 전에는 aestheticScore가 null이면 score에서 미학·조화를 지어내, 쌍둥이 탭
   * 이우선 카드가 '미학 86 · 조화 83'인데 펼친 이유는 '미학 94 · 조화 82'로 한 카드에서 갈렸다.
   * 창의·순우리말·3글자처럼 종합만 있는 탭은 FINAL만 보인다.
   */
  hasDetailScores: boolean;
  /** hasDetailScores가 true일 때만 의미 있음 */
  aesthetics: number;
  /** hasDetailScores가 true일 때만 의미 있음 */
  harmony: number;
  finalScore: number;
  /** finalScore 의 이름표 — 'FINAL'(종합) 또는 순우리말·3글자 '발음'·창의 '창의'·특이 성씨 '발음 조화' */
  scoreLabel: string;
  /** '상세 보기'가 /evaluate 에 실을 한자(주소 꼴) — SmartNameCandidate.evaluateHanja */
  evaluateHanja?: string;
  /**
   * 백엔드 희귀도를 받은 후보인지 — RARITY 막대 표시 여부. 값은 표준 탭의 '희귀도:N' 태그
   * (SmartRecommendationService.BuildStandardTags)에서만 온다.
   * ⚠️ 2026-10-21 전에는 score−10으로 지어내, 같은 카드에 태그 '희귀도:90'과 'RARITY (82)'가 함께
   * 보였고 희귀도 값이 없는 쌍둥이 탭에도 'RARITY (80)'이 붙었다(검토 FTE-7).
   */
  hasRarity: boolean;
  /** hasRarity가 true일 때만 의미 있음 */
  rarity: number;
  tags: string[];
  reasons: string[];
  genderNote?: string;
  phonologyNotes: PhonologyNote[];
}

interface UICategory {
  type: string;
  label: string;
  description: string;
  engineUsed: string;
  totalInCategory: number;
  names: UICandidate[];
}

// ============================================================
// 백엔드 → UI 매핑 어댑터
// ============================================================

/** 표준 후보 태그의 '희귀도:N' 값 — 없으면 null (SmartNameCandidateDto에 희귀도 필드가 아직 없다) */
function rarityFromTags(tags: string[] | undefined): number | null {
  for (const t of tags ?? []) {
    const m = /^희귀도:(\d{1,3})$/.exec(t.trim());
    if (m) return Math.min(100, Number(m[1]));
  }
  return null;
}

function mapCandidate(c: SmartNameCandidate): UICandidate {
  const score = c.score ?? 0;
  const rarity = rarityFromTags(c.tags);
  // 배정된 실제 한자(예: "友晶") 우선 — 한자 이름 탭이 진짜 한자를 serif로 표시.
  // 없으면(창의·순우리말 등) 기존 휴리스틱(한글 이름)으로 폴백.
  const hanjaName =
    c.hanja && c.hanja.length > 0
      ? c.hanja
      : c.name && c.name !== "—"
        ? c.name
        : undefined;
  return {
    fullName: c.fullName,
    name: c.name,
    hanjaName,
    meaning: c.meaning,
    story: c.story || undefined,
    hasScore: c.score != null,
    // 미학·조화는 백엔드 실제 값만 쓴다 — score에서 추정하지 않는다 (없으면 숨김)
    hasDetailScores: c.aestheticScore != null && c.harmonyScore != null,
    aesthetics: c.aestheticScore ?? 0,
    harmony: c.harmonyScore ?? 0,
    finalScore: Math.round(score),
    scoreLabel: c.scoreLabel ?? "FINAL",
    evaluateHanja: c.evaluateHanja,
    hasRarity: rarity != null,
    rarity: rarity ?? 0,
    tags: c.tags ?? [],
    reasons: c.reasons ?? [],
    genderNote: c.genderNote,
    phonologyNotes: c.phonologyNotes ?? [],
  };
}

// ------------------------------------------------------------
// 필수 글자 후보의 뜻 줄 — 이름 순서로 다시 짓는다
// ⚠️ 2026-10-21: RequiredCharEngine의 meaning은 자리와 상관없이 '필수 글자 뜻, 짝 글자 뜻'이라
// 끝글자 후보 아준이 '준걸 준, 순임금 순, 맑을 아/바를 아'로 거꾸로 나왔고, 다중 훈의 쉼표가
// 글자 경계 쉼표와 겹쳐 어디까지가 한 글자인지 보이지 않았다. 한자 옵션("字(훈음)")은 이름 순서로
// 오므로(첫글자: 필수…·짝 / 끝글자: 짝·필수…) 거기서 음절마다 그 소리의 훈 하나만 골라
// ' + '로 잇는다. 원래 meaning은 읽지 않으니 백엔드가 순서를 고쳐도 두 번 뒤집히지 않는다.
// ------------------------------------------------------------
function parseHanjaOption(opt: string): { ch: string; meaning: string } | null {
  const m = opt.match(/^(.)\((.+)\)$/u);
  return m ? { ch: m[1], meaning: m[2] } : null;
}

/** 다중 훈음 중 이 음절로 읽히는 것 — '그물 라(나)'처럼 괄호 속 두음 독음도 인정, 없으면 첫 훈음 */
function glossForSyllable(meaning: string, syllable: string): string {
  const parts = meaning
    .split(/[,/;·]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const hit = parts.find((s) => {
    const m = s.match(/\s([^\s(]+)(?:\(([^)]+)\))?$/);
    return !!m && (m[1] === syllable || m[2] === syllable);
  });
  return hit ?? parts[0] ?? "";
}

/**
 * 필수 글자 후보 뜻 줄 (예: 아준 → "맑을 아 + 준걸 준").
 * position은 "first"|"last", hanjaOptions는 엔진이 이름 순서로 준 "字(훈음)" 목록.
 * 모양이 예상과 다르면 fallback(엔진 meaning)을 그대로 쓴다.
 */
export function requiredCharMeaning(
  name: string,
  position: string,
  hanjaOptions: readonly string[],
  fallback: string
): string {
  const syllables = [...name];
  if (syllables.length !== 2) return fallback;
  // 필수 글자에 한자가 없으면(봄·빛처럼 사전에 독음이 없는 글자) 엔진은 짝 글자 옵션 하나만 준다 —
  // 엔진 meaning 은 짝 글자의 사전 뜻 전체라 '봄학 → 배울 학, 가르칠 교, 고지새 할'·'수봄 → 목숨 수'로 나왔다(2026-11-27).
  // 필수 글자 자리는 한글 그대로, 짝 글자 자리는 그 소리의 훈 하나만 적는다.
  if (hanjaOptions.length === 1) {
    const partner = parseHanjaOption(hanjaOptions[0]);
    if (!partner) return fallback;
    if (position === "first") {
      const gloss = glossForSyllable(partner.meaning, syllables[1]);
      return gloss ? `${syllables[0]}(한글) + ${gloss}` : fallback;
    }
    if (position === "last") {
      const gloss = glossForSyllable(partner.meaning, syllables[0]);
      return gloss ? `${gloss} + ${syllables[1]}(한글)` : fallback;
    }
    return fallback;
  }
  if (hanjaOptions.length < 2) return fallback;
  const pair =
    position === "first"
      ? [hanjaOptions[0], hanjaOptions[hanjaOptions.length - 1]]
      : position === "last"
        ? [hanjaOptions[0], hanjaOptions[1]]
        : null;
  if (!pair) return fallback;
  const glosses = pair.map((opt, i) => {
    const p = parseHanjaOption(opt);
    return p ? glossForSyllable(p.meaning, syllables[i]) : "";
  });
  return glosses.every(Boolean) ? glosses.join(" + ") : fallback;
}

const REQUIRED_CHAR_POSITION_TAG: Record<string, string> = {
  first: "첫글자",
  last: "끝글자",
};

/**
 * /search의 required-char 카테고리 — 태그가 [필수:X|항렬:X, "first"|"last", ...한자 옵션]
 * (SmartRecommendationService). 뜻 줄을 이름 순서로 다시 짓고 자리 태그를 한글로 바꾼다.
 * /required-char 페이지는 어댑터에서 이미 한글 자리 태그·뜻 줄을 만들어 오므로 건드리지 않는다.
 */
function normalizeRequiredCharCandidate(c: SmartNameCandidate): SmartNameCandidate {
  const tags = c.tags ?? [];
  const pos = tags[1];
  if (pos !== "first" && pos !== "last") return c;
  const options = tags.slice(2);
  return {
    ...c,
    meaning: requiredCharMeaning(c.name, pos, options, c.meaning),
    tags: [tags[0], REQUIRED_CHAR_POSITION_TAG[pos], ...options],
  };
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  standard: "한자 의미와 오행을 결합한 전통 방식 추천이에요",
  "pure-korean": "한자 없이 우리말 음운만으로 만든 이름이에요",
  "three-syllable": "3글자로 흐름을 더한 이름이에요",
  creative: "유행에 휩쓸리지 않는 새로운 조합이에요",
  "parent-based": "부모님의 이름·서사를 분석한 추천이에요",
  "required-char": "지정한 글자가 포함된 이름이에요",
  "dual-name": "영어 이름과 음운/의미가 연결되는 한국 이름이에요",
  twin: "쌍둥이 이름 세트예요",
  "rare-surname": "희귀 성씨에 어울리는 이름이에요",
};

function mapResponse(
  res: SmartRecommendationResponse
): { topPick: { categoryLabel: string; candidate: UICandidate } | null; categories: UICategory[] } {
  // 백엔드가 같은 type을 중복으로 보낼 수 있어 dedup
  // 같은 type이 여러 번 오면 names를 합치고 중복 fullName도 제거
  const seen = new Map<string, UICategory>();
  for (const cat of res.categories) {
    const mapped: UICategory = {
      type: cat.type,
      label: cat.label,
      description: CATEGORY_DESCRIPTIONS[cat.type] ?? "",
      engineUsed: cat.engineUsed,
      totalInCategory: cat.names.length,
      names: (cat.type === "required-char"
        ? cat.names.map(normalizeRequiredCharCandidate)
        : cat.names.map((n) => normalizeSpecialtyTags(cat.type, n))
      ).map(mapCandidate),
    };
    const prev = seen.get(cat.type);
    if (!prev) {
      seen.set(cat.type, mapped);
    } else {
      const existingFull = new Set(prev.names.map((n) => n.fullName));
      const merged = [
        ...prev.names,
        ...mapped.names.filter((n) => !existingFull.has(n.fullName)),
      ];
      seen.set(cat.type, {
        ...prev,
        totalInCategory: merged.length,
        names: merged,
      });
    }
  }
  const categories: UICategory[] = Array.from(seen.values());

  const topPick = res.topPick
    ? {
        categoryLabel: res.topPick.categoryLabel,
        candidate: mapCandidate(
          res.topPick.categoryType === "required-char"
            ? normalizeRequiredCharCandidate(res.topPick.candidate)
            : normalizeSpecialtyTags(res.topPick.categoryType, res.topPick.candidate)
        ),
      }
    : null;

  return { topPick, categories };
}

// ============================================================
// 공통 atoms
// ============================================================
function PaperGrain({
  opacity = 0.06,
  seed = 7,
}: {
  opacity?: number;
  seed?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity,
        borderRadius: "inherit",
      }}
    >
      <filter id={`pg-${seed}`}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves="2"
          seed={seed}
        />
        <feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.13  0 0 0 0 0.10  0 0 0 1 0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#pg-${seed})`} />
    </svg>
  );
}

function Eyebrow({
  children,
  color = "var(--color-text-3)",
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontFamily: "Inter, var(--font-sans)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  );
}

function TagChip({ label }: { label: string }) {
  let palette = {
    bg: "rgba(43,43,43,0.06)",
    color: "var(--color-text-2)",
  };
  if (["음운중심", "의미중심"].includes(label))
    palette = {
      bg: "var(--color-teal-50)",
      color: "var(--color-teal)",
    };
  else if (["자연", "덕목", "개념"].includes(label))
    palette = { bg: "var(--color-gold-50)", color: "#6F5421" };
  else if (label === "세대중립")
    palette = {
      bg: "rgba(43,43,43,0.06)",
      color: "var(--color-text-2)",
    };
  else if (label === "창작")
    palette = {
      bg: "var(--color-navy-50)",
      color: "var(--color-navy)",
    };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.4,
        // 창의 탭 칩은 문장이다('실제 쓰이는 흔치 않은 이름 (개성 있는 실명)') — 줄 폭보다 길면 칩 안에서 줄을 바꾼다.
        // 예전 nowrap 은 칩 두 개가 카드 하한을 403px 로 만들어 375 폭에서 페이지가 옆으로 넘쳤다(2026-11-27)
        maxWidth: "100%",
        wordBreak: "keep-all",
        overflowWrap: "anywhere",
        fontFamily: "var(--font-sans)",
        background: palette.bg,
        color: palette.color,
      }}
    >
      {label}
    </span>
  );
}

/** 칩 줄 — 넘치면 다음 줄로(가로 스크롤은 휴대폰에서 끝 칩이 숨고 인쇄에서 잘렸다) */
function TagRow({ tags }: { tags: string[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        minWidth: 0,
      }}
    >
      {tags.map((t, i) => (
        <TagChip key={i} label={t} />
      ))}
    </div>
  );
}

function RarityBar({ value }: { value: number }) {
  const filled = Math.round(value / 20);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "var(--color-text-3)",
          fontWeight: 500,
        }}
      >
        RARITY
      </span>
      <div style={{ display: "inline-flex", gap: 2 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background:
                i < filled ? "var(--color-gold)" : "var(--color-gold-50)",
              border:
                "1px solid " +
                (i < filled
                  ? "var(--color-gold-600)"
                  : "var(--color-gold-100)"),
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 11,
          color: "var(--color-text-2)",
          fontWeight: 500,
        }}
      >
        ({value})
      </span>
    </div>
  );
}

function CheckIcon({ size = 12 }: { size?: number }) {
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

const btnGhost: CSSProperties = {
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

/** '상세 보기 →' — Top Pick·후보 카드가 같은 모양(/evaluate 로 간다) */
const detailBtn: CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  color: "var(--color-teal)",
  fontWeight: 600,
  padding: 0,
  whiteSpace: "nowrap",
};

/**
 * 결과 화면 블록의 좌우 여백 — Top Pick·카테고리 띠·'이 추천은 시작점이에요' 상자는 이 래퍼 안에 둔다.
 * 예전에는 이 셋만 바깥 padding 이 없어 휴대폰 폭에서 테두리가 화면 끝에 붙었다(2026-11-27). 탭 줄·목록과 같은 24px
 */
const SIDE_GUTTER: CSSProperties = { padding: "0 24px" };

// ============================================================
// 1. Mini header
// ============================================================
/**
 * 결과 화면 머리 — '← 조건 바꾸기'는 페이지가 넘긴 onEdit(handleReset)로 입력값이 남은 폼에 돌아간다.
 * ⚠️ 2026-11-27 전에는 자기 경로로 가는 next/link 였다 — 결과는 페이지 useState 라 같은 경로 이동으로는 지워지지 않아
 * 눌러도 화면이 그대로였다. 옆의 '↻ 새로 생성'은 이름과 달리 폼으로 돌아가기만 했고(엔진이 결정적이라 같은 조건이면
 * 같은 결과) 이 단추 하나로 합쳤다. onEdit 이 없으면 단추를 그리지 않는다(눌러도 아무 일 없는 단추를 두지 않는다).
 */
function MiniHeader({
  onEdit,
  headerRef,
}: {
  onEdit?: () => void;
  headerRef?: RefObject<HTMLElement | null>;
}) {
  return (
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
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          data-hide-print
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "4px 0",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--color-text-2)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden="true">←</span> 조건 바꾸기
        </button>
      )}
    </header>
  );
}

// ============================================================
// 2. Sub-header chip bar
// ============================================================
function SubHeader({
  summary,
  onSave,
  saveLabel = "이 결과 저장",
  saved,
}: {
  summary: RequestSummary;
  /** 없으면 저장 버튼을 숨긴다 — 눌러도 아무 일 없는 버튼을 두지 않는다 */
  onSave?: () => void;
  /**
   * 버튼 이름 — 상태와 상관없이 고정한다(하트 글리프 제외). 저장 여부는 saved →
   * aria-pressed와 하트 모양으로만 알린다 ('저장됨'·'눌림'이 두 번 읽히지 않게).
   */
  saveLabel?: string;
  /** 토글 상태 — undefined면 토글 버튼이 아니다(aria-pressed 생략) */
  saved?: boolean;
}) {
  const chips = [
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
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 24px",
        borderBottom: "1px solid var(--color-divider)",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {chips.map((c, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "5px 12px",
              background: "var(--color-surface-2)",
              color: "var(--color-text)",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {c}
          </span>
        ))}
        {flags.length > 0 && (
          <span
            style={{
              width: 1,
              height: 14,
              background: "var(--color-divider)",
              margin: "0 4px",
            }}
          />
        )}
        {flags.map((f, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              color: "var(--color-teal)",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <CheckIcon size={11} /> {f}
          </span>
        ))}
      </div>
      {/* '↻ 새로 생성'은 머리의 '← 조건 바꾸기'로 합쳤다(MiniHeader 참고). 조건 칩은 인쇄에 남기고 단추만 숨긴다 */}
      {onSave && (
        <div data-hide-print style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onSave}
            style={btnGhost}
            aria-pressed={saved}
          >
            <span
              aria-hidden="true"
              style={saved ? { color: "var(--color-gold-700)" } : undefined}
            >
              {saved ? "♥" : "♡"}
            </span>{" "}
            {saveLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 3. Rare-surname banner
// ============================================================
function RareSurnameBanner({ name }: { name: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div
      style={{
        background: "var(--color-gold-50)",
        borderBottom: "1px solid var(--color-gold-100)",
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px 16px",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13,
          color: "var(--color-text)",
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            background: "var(--color-gold)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          i
        </span>
        <span>
          {/* 조사는 받침으로 — 예전 고정 '는'이라 '남궁는 희귀 성씨에요'로 나왔다(2026-11-27, 맞춤법도 '성씨예요') */}
          <b style={{ fontWeight: 600 }}>{name}</b>
          {josa(name, "은/는")} 희귀 성씨예요
        </span>
      </div>
      <div
        data-hide-print
        style={{
          display: "inline-flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <Link
          href="/rare-surname"
          style={{
            fontSize: 13,
            color: "var(--color-teal)",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          희귀 성씨 모드로 전환 →
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="닫기"
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--color-text-3)",
            fontSize: 16,
            padding: 4,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 4. Hero + TopPick
// ============================================================
function Hero({
  totalCount,
  lastName,
}: {
  totalCount: number;
  lastName: string;
}) {
  return (
    <div
      style={{
        padding: "48px 24px 8px",
        maxWidth: 920,
        margin: "0 auto",
      }}
    >
      <Eyebrow>Naming · Result</Eyebrow>
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
        {lastName} 씨를 위한 이름
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "var(--color-text-2)",
          margin: 0,
        }}
      >
        총{" "}
        <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
          {totalCount}개
        </b>{" "}
        후보 중 핵심 추천을 먼저 보여드릴게요
      </p>
    </div>
  );
}

function TopPickCard({
  pick,
  onDetail,
}: {
  pick: { categoryLabel: string; candidate: UICandidate };
  onDetail?: () => void;
}) {
  const c = pick.candidate;
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        position: "relative",
        overflow: "hidden",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1.5px solid var(--color-gold)",
        boxShadow: "0 12px 36px rgba(201, 169, 110, 0.18)",
        // 인쇄 때 쪽 경계에서 갈리지 않게(화면에서는 효과 없음)
        breakInside: "avoid",
      }}
    >
      <PaperGrain opacity={0.05} seed={3} />
      <div
        style={{
          position: "relative",
          padding: "32px clamp(20px, 6vw, 36px) 36px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Eyebrow color="var(--color-gold-800)">
            Top Pick · {pick.categoryLabel}
          </Eyebrow>
          {c.hasScore && (
            <span
              style={{
                fontFamily: "Inter, var(--font-sans)",
                fontSize: 11,
                color: "var(--color-text-3)",
                letterSpacing: "0.06em",
              }}
            >
              {c.scoreLabel === "FINAL" ? "SCORE OUT OF 100" : `${c.scoreLabel} 점수 · 100점 만점`}
            </span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 24,
            alignItems: "end",
            marginTop: 18,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(36px, 10vw, 48px)",
                fontWeight: 500,
                color: "var(--color-text)",
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
              }}
            >
              {c.fullName}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              {c.hanjaName && (
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 28,
                    color: "var(--color-navy)",
                    fontWeight: 400,
                    letterSpacing: "0.04em",
                  }}
                >
                  {c.hanjaName}
                </span>
              )}
              {c.meaning && (
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--color-text-2)",
                  }}
                >
                  {c.hanjaName && "· "}
                  {c.meaning}
                </span>
              )}
            </div>
            {c.story && (
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "var(--color-navy-500)",
                }}
              >
                {/* 장식 인용 부호 — 1.4.3 대비 예외(글자 아님)라 밝은 골드 인상을 남기는 gold-700(2026-10-26 팔레트 #2 보완) */}
                <span
                  style={{ color: "var(--color-gold-700)", marginRight: 4 }}
                >
                  “
                </span>
                {c.story}
                <span style={{ color: "var(--color-gold-700)", marginLeft: 2 }}>
                  ”
                </span>
              </p>
            )}
          </div>
          {c.hasScore && (
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: "Inter, var(--font-sans)",
                  fontSize: 32,
                  fontWeight: 700,
                  color: "var(--color-navy)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {c.finalScore}
              </div>
              <div
                style={{
                  fontFamily: "Inter, var(--font-sans)",
                  fontSize: 11,
                  color: "var(--color-text-3)",
                  marginTop: 4,
                  letterSpacing: "0.08em",
                }}
              >
                {c.scoreLabel}
              </div>
            </div>
          )}
        </div>

        {c.hasDetailScores && (
          <div
            style={{
              display: "flex",
              gap: 18,
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px dashed var(--color-divider)",
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 13,
              color: "var(--color-text-2)",
              flexWrap: "wrap",
            }}
          >
            <span>
              미학{" "}
              <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
                {c.aesthetics}
              </b>
            </span>
            <span>
              조화{" "}
              <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
                {c.harmony}
              </b>
            </span>
            {c.hasRarity && (
              <span style={{ marginLeft: "auto" }}>
                <RarityBar value={c.rarity} />
              </span>
            )}
          </div>
        )}

        {c.tags.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <TagRow tags={c.tags} />
          </div>
        )}

        {c.reasons.length > 0 && (
          <div style={{ marginTop: 18, display: "grid", gap: 6 }}>
            {c.reasons.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  fontSize: 14,
                  color: "var(--color-text)",
                  lineHeight: 1.55,
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

        {c.phonologyNotes.length > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "var(--color-surface-2)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: "var(--color-text-3)",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              i
            </span>
            <div
              style={{
                fontSize: 13,
                color: "var(--color-text-2)",
              }}
            >
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

        {onDetail && (
          <div
            data-hide-print
            style={{
              marginTop: 22,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={onDetail}
              style={{ ...detailBtn, fontSize: 14 }}
            >
              상세 보기 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 5–6. Tabs + category banner
// ============================================================
/**
 * 탭 줄 끝의 흐림 마스크 — 그쪽에 가려진 탭이 있을 때만. 없으면 undefined(마스크 없음).
 * 예전에는 375 폭에서 셋째 탭이 잘리고 넷째는 보이지 않는데 더 있다는 표시가 없었다(2026-11-27)
 */
export function tabEdgeMask(left: boolean, right: boolean): string | undefined {
  if (!left && !right) return undefined;
  const fade = 28;
  const start = left ? `transparent, #000 ${fade}px` : "#000";
  const end = right ? `#000 calc(100% - ${fade}px), transparent` : "#000";
  return `linear-gradient(to right, ${start}, ${end})`;
}

/**
 * 고른 탭을 탭 줄 가운데로 옮길 가로 거리(px, 양수 = 오른쪽으로).
 * scrollIntoView 는 탭 줄이 화면 밖일 때 창까지 세로로 움직여 아래의 창 스크롤과 겹치므로 탭 줄만 가로로 민다
 */
export function centerScrollDelta(
  containerLeft: number,
  containerWidth: number,
  itemLeft: number,
  itemWidth: number
): number {
  return itemLeft + itemWidth / 2 - (containerLeft + containerWidth / 2);
}

/** 고정 머리(MiniHeader)를 재지 못할 때의 높이 — 12px 위아래 여백 + 글자 + 테두리 실측 57px */
const MINI_HEADER_FALLBACK_HEIGHT = 57;
/** 탭 줄과 고정 머리 사이 틈 */
const TAB_SCROLL_GAP = 8;

/**
 * 탭을 바꿀 때 창을 옮길 위치 — 탭 줄 윗변이 고정 머리 바로 아래(+8px)에 오게.
 * tabsTop 은 탭 줄의 getBoundingClientRect().top(창 기준), scrollY 는 지금 창 스크롤
 */
export function tabScrollTop(tabsTop: number, scrollY: number, headerHeight: number): number {
  return Math.max(0, Math.round(tabsTop + scrollY - headerHeight - TAB_SCROLL_GAP));
}

function CategoryTabs({
  categories,
  active,
  onChange,
  anchorRef,
}: {
  categories: UICategory[];
  active: string;
  onChange: (type: string) => void;
  /** 탭을 바꿀 때 창을 이 줄 위(고정 머리 바로 아래)로 옮긴다 — SmartResultPage.onTabChange */
  anchorRef?: RefObject<HTMLDivElement | null>;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const tabKey = categories.map((c) => c.type).join("|");

  // 가려진 탭이 있는 쪽 — 스크롤·크기 바뀜(글꼴이 늦게 와 탭 폭이 바뀌는 것 포함)마다 다시 잰다
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) =>
        prev.left === left && prev.right === right ? prev : { left, right }
      );
    };
    const frame = requestAnimationFrame(measure);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (ro) {
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
    }
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [tabKey]);

  // 고른 탭이 보이게 — '모두 보기'로 바꾼 탭이 탭 줄 밖(오른쪽)에 있을 수 있다
  useEffect(() => {
    const el = scrollerRef.current;
    const btn = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !btn) return;
    const box = el.getBoundingClientRect();
    const item = btn.getBoundingClientRect();
    const delta = centerScrollDelta(box.left, box.width, item.left, item.width);
    if (Math.abs(delta) > 1) el.scrollBy({ left: delta, behavior: "smooth" });
  }, [active]);

  const mask = tabEdgeMask(edges.left, edges.right);
  return (
    <div
      ref={anchorRef}
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
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        {categories.map((cat) => {
          const isActive = cat.type === active;
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
              }}
            >
              {cat.label}{" "}
              <span
                style={{
                  color: "var(--color-text-3)",
                  fontFamily: "Inter, var(--font-sans)",
                  fontWeight: 400,
                  marginLeft: 4,
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

function CategoryBanner({ cat }: { cat: UICategory }) {
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
          <div
            style={{
              fontSize: 13,
              color: "var(--color-text-2)",
              marginTop: 2,
            }}
          >
            {cat.description}
          </div>
        </div>
      </div>
      {/* 내부 엔진 클래스 이름(by {cat.engineUsed})은 그리지 않는다 — 사용자에게 뜻이 없고 구현 이름이 드러난다(2026-10-28) */}
    </div>
  );
}

// ============================================================
// 7. Candidate list
// ============================================================
/** 후보 카드의 '상세 보기' — SmartResultPage 가 받은 onCandidateDetail(이름, 평가 링크 한자) 그대로 */
type CandidateDetailHandler = (fullName: string, evaluateHanja?: string) => void;

/**
 * 후보 카드. 카드 자체는 눌러도 동작이 없으므로 손가락 커서·떠오름 효과를 두지 않는다 — 평가로 가는 길은
 * 카드 아래 '상세 보기 →'(Top Pick 과 같은 단추)다.
 * ⚠️ 2026-11-27 전에는 카드가 눌리는 모양인데 동작이 없었고 '상세 보기'는 Top Pick 한 장에만 있어 2위 이하 후보는
 * /evaluate 로 갈 길이 없었다(이름을 손으로 다시 쳐야 했다).
 */
function CandidateCard({
  candidate,
  index,
  onDetail,
}: {
  candidate: UICandidate;
  index: number;
  onDetail?: CandidateDetailHandler;
}) {
  const [open, setOpen] = useState(false);
  const c = candidate;
  const hasNotes = c.reasons.length > 0 || c.phonologyNotes.length > 0;
  return (
    <article
      style={{
        minWidth: 0,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "22px clamp(18px, 5vw, 26px)",
        boxShadow: "var(--shadow-sm)",
        // 인쇄 때 카드 머리와 한자가 다른 쪽으로 나뉘지 않게(화면에서는 효과 없음)
        breakInside: "avoid",
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
        {c.hasRarity && <RarityBar value={c.rarity} />}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div>
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
                  fontWeight: 400,
                }}
              >
                {c.hanjaName}
              </span>
            )}
            {c.meaning && (
              <span
                style={{
                  fontSize: 13,
                  color: "var(--color-text-2)",
                }}
              >
                {c.hanjaName && "· "}
                {c.meaning}
              </span>
            )}
            {c.genderNote && (
              <div
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--color-amber-warm-700)",
                  background: "rgba(181,135,76,0.10)",
                  border: "1px solid rgba(181,135,76,0.3)",
                  borderRadius: 999,
                  padding: "2px 9px",
                }}
              >
                {c.genderNote}
              </div>
            )}
          </div>
          {c.story && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "var(--color-navy-500)",
              }}
            >
              {/* 장식 인용 부호 — gold-700(위 Top Pick 과 같다) */}
              <span style={{ color: "var(--color-gold-700)", marginRight: 4 }}>
                “
              </span>
              {c.story}
              <span style={{ color: "var(--color-gold-700)", marginLeft: 2 }}>
                ”
              </span>
            </p>
          )}
          {c.hasDetailScores && (
            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 10,
                fontFamily: "Inter, var(--font-sans)",
                fontSize: 12,
                color: "var(--color-text-2)",
              }}
            >
              <span>
                미학{" "}
                <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
                  {c.aesthetics}
                </b>
              </span>
              <span>
                조화{" "}
                <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
                  {c.harmony}
                </b>
              </span>
            </div>
          )}
        </div>
        {c.hasScore && (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "Inter, var(--font-sans)",
                fontSize: 36,
                fontWeight: 700,
                color: "var(--color-navy)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {c.finalScore}
            </div>
            <div
              style={{
                fontFamily: "Inter, var(--font-sans)",
                fontSize: 10,
                color: "var(--color-text-3)",
                marginTop: 4,
                letterSpacing: "0.08em",
              }}
            >
              {c.scoreLabel}
            </div>
          </div>
        )}
      </div>

      {c.tags.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <TagRow tags={c.tags} />
        </div>
      )}

      {/* 조작 줄('이름의 결' 펼침·'상세 보기')은 인쇄에서 숨긴다 — 펼친 내용은 아래에 따로 있어 인쇄에 남는다 */}
      {(hasNotes || onDetail) && (
        <div
          data-hide-print
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px dashed var(--color-divider)",
            display: "flex",
            alignItems: "center",
            justifyContent: hasNotes ? "space-between" : "flex-end",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {hasNotes && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
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
                aria-hidden="true"
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
          )}
          {onDetail && (
            <button
              type="button"
              onClick={() => onDetail(c.fullName, c.evaluateHanja)}
              // 카드마다 같은 글자라 접근 이름에 이름을 붙인다(보이는 글자로 시작 — 음성 조작 '상세 보기')
              aria-label={`상세 보기: ${c.fullName}`}
              style={detailBtn}
            >
              상세 보기 →
            </button>
          )}
        </div>
      )}
      {hasNotes && open && (
        <div style={{ marginTop: 12, paddingLeft: 18 }}>
          {c.reasons.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
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
    </article>
  );
}

/**
 * 카드 key — 카테고리 + 이름(같은 이름이 또 오면 '#2'·'#3'을 붙인다).
 * ⚠️ 2026-11-27 전에는 key 가 순번(i)이라 한 탭에서 펼친 '이름의 결'이 다른 탭의 같은 순번 카드(다른 이름)에서도 펼쳐져 있었다
 */
export function candidateKeys(
  type: string,
  names: readonly { fullName: string }[]
): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = (seen.get(n.fullName) ?? 0) + 1;
    seen.set(n.fullName, count);
    return count === 1 ? `${type}-${n.fullName}` : `${type}-${n.fullName}#${count}`;
  });
}

function CandidateList({
  category,
  onDetail,
}: {
  category: UICategory;
  onDetail?: CandidateDetailHandler;
}) {
  if (!category.names || category.names.length === 0) {
    return (
      <div style={{ ...SIDE_GUTTER, maxWidth: 880 + 48, margin: "20px auto 0" }}>
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
            이 카테고리는 추천 후보가 없어요
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            다른 탭을 살펴보세요
          </div>
        </div>
      </div>
    );
  }
  const keys = candidateKeys(category.type, category.names);
  return (
    <div
      style={{
        maxWidth: 880,
        margin: "20px auto 0",
        padding: "0 24px",
        display: "grid",
        // 열 하나를 0 까지 줄 수 있게 — 열 정의가 없으면 auto 열이 카드의 최소 폭(창의 탭의 긴 칩)까지 넓어져
        // 375 폭에서 카드가 457px 로 화면 밖으로 넘쳤다(2026-11-27)
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 14,
      }}
    >
      {category.names.map((n, i) => (
        <CandidateCard key={keys[i]} candidate={n} index={i} onDetail={onDetail} />
      ))}
    </div>
  );
}

// ============================================================
// 9. Other categories preview
// ============================================================
function OtherCategoriesPreview({
  categories,
  active,
  onJump,
}: {
  categories: UICategory[];
  active: string;
  onJump: (type: string) => void;
}) {
  const others = categories.filter(
    (c) => c.type !== active && c.names.length > 0
  );
  if (others.length === 0) return null;
  // 탭으로 옮기는 단추 줄이라 인쇄에서 숨긴다(가로 줄은 인쇄에서 셋째 카드가 잘렸다)
  return (
    <div
      data-hide-print
      style={{
        maxWidth: 920,
        margin: "48px auto 0",
        padding: "0 24px",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "var(--color-text-2)",
          marginBottom: 12,
          letterSpacing: "0.02em",
        }}
      >
        다른 카테고리도 살펴보세요
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 6,
        }}
      >
        {others.map((cat) => {
          const first = cat.names[0];
          return (
            <button
              key={cat.type}
              type="button"
              onClick={() => onJump(cat.type)}
              style={{
                appearance: "none",
                textAlign: "left",
                flexShrink: 0,
                width: 240,
                padding: "16px 18px",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontFamily: "var(--font-sans)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text)",
                }}
              >
                {cat.label}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: "var(--color-text)",
                  }}
                >
                  {first.fullName}
                </span>
                {first.hanjaName && (
                  <span
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 14,
                      color: "var(--color-navy)",
                    }}
                  >
                    {first.hanjaName}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-teal)",
                  fontWeight: 500,
                  marginTop: "auto",
                }}
              >
                {cat.label} 모두 보기 →
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 10. Footer
// ============================================================
function ReferenceNotice() {
  return (
    <div style={{ ...SIDE_GUTTER, maxWidth: 920 + 48, margin: "48px auto 0" }}>
      <div
        style={{
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
          이 추천은 시작점이에요
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
    </div>
  );
}

/**
 * 결과 화면 꼬리 — 사이트 Footer 를 숨긴 화면이라 소개·문의로 가는 길이 여기뿐이다.
 * ⚠️ 2026-11-27 전에는 두 링크가 디자인 원본의 href="#" 그대로라 맨 위로 튈 뿐이었다.
 * 링크만 있는 줄이라 인쇄에서는 통째로 숨긴다(사이트 머리·꼬리만 숨기게 좁힌 인쇄 규칙 뒤에도)
 */
function ResultFooter() {
  return (
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
          style={{ color: "var(--color-text-3)", textDecoration: "none" }}
        >
          이름의 결에 대하여
        </Link>
        <span aria-hidden="true" style={{ color: "var(--color-divider)" }}>
          ·
        </span>
        <Link
          href="/contact"
          style={{ color: "var(--color-text-3)", textDecoration: "none" }}
        >
          문의
        </Link>
      </div>
    </footer>
  );
}

// ============================================================
// SmartResultPage — 메인 페이지
// ============================================================
export function SmartResultPage({
  data,
  requestSummary,
  initialTab,
  onRegenerate,
  onSave,
  onCandidateDetail,
  favoriteContext,
}: {
  data: SmartRecommendationResponse;
  requestSummary: RequestSummary;
  initialTab?: string;
  /** '← 조건 바꾸기' — 각 페이지의 handleReset(결과를 지우고 입력값이 남은 폼으로). 없으면 단추를 그리지 않는다 */
  onRegenerate?: () => void;
  /** 없으면 저장 버튼이 TopPick 이름을 즐겨찾기(/favorites)에 넣고 뺀다 */
  onSave?: () => void;
  /** 두 번째 인자 = 카드의 평가 링크 한자(주소 꼴, 없으면 undefined) — /evaluate 가 카드와 같은 이름을 채점하게 */
  onCandidateDetail?: (fullName: string, evaluateHanja?: string) => void;
  /**
   * 즐겨찾기에 함께 남길 요청 맥락(API 값) — /favorites에서 /evaluate로 다시 열 때
   * 같은 조건으로 평가되도록. 없으면 requestSummary.date만 출생일로 쓴다.
   */
  favoriteContext?: CandidateDetailContext;
}) {
  const { topPick, categories } = mapResponse(data);

  // ---- TopPick 즐겨찾기 (onSave를 안 넘긴 페이지의 기본 저장 동작) ----
  const rawTop = data.topPick?.candidate ?? null;
  const favBirthDate = favoriteContext?.birthDate ?? requestSummary.date;
  // 저장도 카드의 한자(순우리말 '--' 등)를 남긴다 — '다시 보기'가 /evaluate 에서 같은 이름을 채점하게(즐겨찾기 키에 한자가 든다)
  // (다른 카테고리는 normalizeSpecialtyTags 가 그대로 돌려줘 evaluateHanja 가 없다 — 예전 저장 키 그대로)
  const topHanja = rawTop
    ? normalizeSpecialtyTags(data.topPick?.categoryType ?? "", rawTop).evaluateHanja
    : undefined;
  const topSaved = useIsFavorite(rawTop?.fullName ?? "", favBirthDate, topHanja);
  function saveTopPick() {
    if (!rawTop) return;
    const ln = requestSummary.lastName;
    // 점수는 미학·조화가 모두 있는 한자 이름일 때만 남긴다 — 다른 카테고리의 score는
    // 창의성·발음 점수라 /favorites의 '종합' 표기와 뜻이 다르다
    const scored = rawTop.aestheticScore != null && rawTop.harmonyScore != null;
    // 저장소에 쓰지 못하면 알린다(EvaluateResult onSave 와 같은 꼴). 상한이면 가장 오래된 1개가 빠진다는 것도 적는다
    const evicts = !topSaved && favoriteCount() >= FAVORITES_LIMIT;
    const ok = toggleFavorite({
      fullName: rawTop.fullName,
      lastName: ln,
      name: rawTop.fullName.startsWith(ln)
        ? rawTop.fullName.slice(ln.length)
        : rawTop.name,
      birthDate: favBirthDate,
      birthTime: favoriteContext?.birthTime,
      gender: favoriteContext?.gender,
      tone: favoriteContext?.tone,
      hanja: topHanja,
      finalScore:
        scored && rawTop.score != null ? Math.round(rawTop.score) : undefined,
      aestheticScore: scored ? rawTop.aestheticScore : undefined,
      harmonyScore: scored ? rawTop.harmonyScore : undefined,
    });
    if (!ok) {
      toast.error(FAVORITE_SAVE_FAILED);
      return;
    }
    if (topSaved) toast.success(`${rawTop.fullName} 저장 해제`);
    else
      toast.success(`${rawTop.fullName} 저장됨`, {
        description: evicts
          ? `${FAVORITES_LIMIT}개까지 보관해서 가장 오래된 1개를 지웠어요. '저장한 이름'에서 다시 볼 수 있어요`
          : "'저장한 이름'에서 다시 볼 수 있어요",
        action: {
          label: "보기",
          onClick: () => window.location.assign("/favorites"),
        },
      });
  }
  const saveHandler = onSave ?? (rawTop ? saveTopPick : undefined);
  // 라벨은 고정 — 상태는 aria-pressed와 하트(aria-hidden)로만 (SubHeader 참고)
  const saveLabel = onSave
    ? undefined
    : rawTop
      ? `${rawTop.fullName} 저장`
      : undefined;
  const saved = onSave ? undefined : topSaved;

  const initialTabType = initialTab ?? categories[0]?.type ?? "standard";
  const [tab, setTab] = useState(initialTabType);
  const headerRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  // 세션 내 탭별 1회만 전송
  const trackedTabs = useRef<Set<string>>(new Set());

  // 초기 탭(standard) 분모 확보
  useEffect(() => {
    if (!trackedTabs.current.has(initialTabType)) {
      trackedTabs.current.add(initialTabType);
      trackTabView(initialTabType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTabChange = (t: string) => {
    setTab(t);
    if (!trackedTabs.current.has(t)) {
      trackedTabs.current.add(t);
      trackTabView(t);
    }
    // 탭 줄이 고정 머리 바로 아래에 오게 — 예전에는 띠를 기준으로 80px 위로 옮겨 탭 줄이 57px 머리 밑에 숨었다
    // ('모두 보기'로 탭을 바꾸면 고른 탭이 보이지 않았다, 2026-11-27)
    setTimeout(() => {
      const tabs = tabsRef.current;
      if (!tabs) return;
      const headerHeight =
        headerRef.current?.getBoundingClientRect().height ?? MINI_HEADER_FALLBACK_HEIGHT;
      window.scrollTo({
        top: tabScrollTop(tabs.getBoundingClientRect().top, window.scrollY, headerHeight),
        behavior: "smooth",
      });
    }, 30);
  };

  const activeCat = categories.find((c) => c.type === tab) ?? categories[0];

  if (!activeCat) {
    // 카테고리 자체가 비어있는 케이스
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-background)",
        }}
      >
        <MiniHeader onEdit={onRegenerate} headerRef={headerRef} />
        <SubHeader
          summary={requestSummary}
          onSave={saveHandler}
          saveLabel={saveLabel}
          saved={saved}
        />
        <div
          style={{
            maxWidth: 720,
            margin: "80px auto",
            padding: "0 24px",
            textAlign: "center",
            color: "var(--color-text-2)",
          }}
        >
          <Eyebrow>RESULT · EMPTY</Eyebrow>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 500,
              color: "var(--color-text)",
              marginTop: 12,
            }}
          >
            추천 결과를 찾지 못했어요
          </h2>
        </div>
        <ResultFooter />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-background)",
      }}
    >
      <MiniHeader onEdit={onRegenerate} headerRef={headerRef} />
      <SubHeader
        summary={requestSummary}
        onSave={saveHandler}
        saveLabel={saveLabel}
        saved={saved}
      />
      {data.isRareSurname && (
        <RareSurnameBanner name={requestSummary.lastName} />
      )}

      <main>
        <Hero
          totalCount={data.totalCount}
          lastName={requestSummary.lastName}
        />
        {topPick && (
          <div style={{ ...SIDE_GUTTER, maxWidth: 720 + 48, margin: "24px auto 0" }}>
            <TopPickCard
              pick={topPick}
              onDetail={
                onCandidateDetail
                  ? () => onCandidateDetail?.(topPick.candidate.fullName, topPick.candidate.evaluateHanja)
                  : undefined
              }
            />
          </div>
        )}

        <CategoryTabs
          categories={categories}
          active={tab}
          onChange={onTabChange}
          anchorRef={tabsRef}
        />
        <div style={{ ...SIDE_GUTTER, maxWidth: 920 + 48, margin: "0 auto" }}>
          <CategoryBanner cat={activeCat} />
        </div>
        <CandidateList category={activeCat} onDetail={onCandidateDetail} />

        <OtherCategoriesPreview
          categories={categories}
          active={tab}
          onJump={onTabChange}
        />

        <ReferenceNotice />
      </main>

      <ResultFooter />
    </div>
  );
}

export default SmartResultPage;
