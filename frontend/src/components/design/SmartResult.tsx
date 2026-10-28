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
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { trackTabView } from "@/lib/api";
import { toggleFavorite, useIsFavorite } from "@/lib/favorites";
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
  if (syllables.length !== 2 || hanjaOptions.length < 2) return fallback;
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
        : cat.names
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
            : res.topPick.candidate
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

function TagRow({
  tags,
  scrollable = true,
}: {
  tags: string[];
  scrollable?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: scrollable ? "nowrap" : "wrap",
        overflowX: scrollable ? "auto" : "visible",
        paddingBottom: 2,
        scrollbarWidth: "thin",
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

// ============================================================
// 1. Mini header
// ============================================================
function MiniHeader({ editHref = "/search" }: { editHref?: string }) {
  return (
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
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        ← 조건 수정
      </Link>
    </header>
  );
}

// ============================================================
// 2. Sub-header chip bar
// ============================================================
function SubHeader({
  summary,
  onRegenerate,
  onSave,
  saveLabel = "이 결과 저장",
  saved,
}: {
  summary: RequestSummary;
  onRegenerate?: () => void;
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
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onRegenerate} style={btnGhost}>
          ↻ 새로 생성
        </button>
        {onSave && (
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
        )}
      </div>
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
        gap: 16,
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
          <b style={{ fontWeight: 600 }}>{name}</b>는 희귀 성씨에요
        </span>
      </div>
      <div
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
        margin: "24px auto 0",
        position: "relative",
        overflow: "hidden",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1.5px solid var(--color-gold)",
        boxShadow: "0 12px 36px rgba(201, 169, 110, 0.18)",
      }}
    >
      <PaperGrain opacity={0.05} seed={3} />
      <div style={{ position: "relative", padding: "32px 36px 36px" }}>
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
              SCORE OUT OF 100
            </span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 24,
            alignItems: "end",
            marginTop: 18,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 48,
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
                FINAL
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

        <div
          style={{
            marginTop: 22,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onDetail}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              color: "var(--color-teal)",
              fontWeight: 600,
              padding: 0,
            }}
          >
            상세 보기 →
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 5–6. Tabs + category banner
// ============================================================
function CategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: UICategory[];
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
function CandidateCard({
  candidate,
  index,
}: {
  candidate: UICandidate;
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
        {c.hasRarity && <RarityBar value={c.rarity} />}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
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
              FINAL
            </div>
          </div>
        )}
      </div>

      {c.tags.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <TagRow tags={c.tags} />
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
        </div>
      )}
    </article>
  );
}

function CandidateList({ category }: { category: UICategory }) {
  if (!category.names || category.names.length === 0) {
    return (
      <div
        style={{
          maxWidth: 880,
          margin: "20px auto 0",
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
    );
  }
  return (
    <div
      style={{
        maxWidth: 880,
        margin: "20px auto 0",
        padding: "0 24px",
        display: "grid",
        gap: 14,
      }}
    >
      {category.names.map((n, i) => (
        <CandidateCard key={i} candidate={n} index={i} />
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
  return (
    <div
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
    <div
      style={{
        marginTop: 48,
        marginInline: "auto",
        maxWidth: 920,
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
  );
}

function ResultFooter() {
  return (
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
          style={{ color: "var(--color-text-3)", textDecoration: "none" }}
        >
          이름의 결에 대하여
        </a>
        <span style={{ color: "var(--color-divider)" }}>·</span>
        <a
          href="#"
          style={{ color: "var(--color-text-3)", textDecoration: "none" }}
        >
          문의
        </a>
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
  editHref = "/search",
  onRegenerate,
  onSave,
  onCandidateDetail,
  favoriteContext,
}: {
  data: SmartRecommendationResponse;
  requestSummary: RequestSummary;
  initialTab?: string;
  editHref?: string;
  onRegenerate?: () => void;
  /** 없으면 저장 버튼이 TopPick 이름을 즐겨찾기(/favorites)에 넣고 뺀다 */
  onSave?: () => void;
  onCandidateDetail?: (fullName: string) => void;
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
  const topSaved = useIsFavorite(rawTop?.fullName ?? "", favBirthDate);
  function saveTopPick() {
    if (!rawTop) return;
    const ln = requestSummary.lastName;
    // 점수는 미학·조화가 모두 있는 한자 이름일 때만 남긴다 — 다른 카테고리의 score는
    // 창의성·발음 점수라 /favorites의 '종합' 표기와 뜻이 다르다
    const scored = rawTop.aestheticScore != null && rawTop.harmonyScore != null;
    toggleFavorite({
      fullName: rawTop.fullName,
      lastName: ln,
      name: rawTop.fullName.startsWith(ln)
        ? rawTop.fullName.slice(ln.length)
        : rawTop.name,
      birthDate: favBirthDate,
      birthTime: favoriteContext?.birthTime,
      gender: favoriteContext?.gender,
      tone: favoriteContext?.tone,
      finalScore:
        scored && rawTop.score != null ? Math.round(rawTop.score) : undefined,
      aestheticScore: scored ? rawTop.aestheticScore : undefined,
      harmonyScore: scored ? rawTop.harmonyScore : undefined,
    });
    if (topSaved) toast.success(`${rawTop.fullName} 저장 해제`);
    else
      toast.success(`${rawTop.fullName} 저장됨`, {
        description: "'저장한 이름'에서 다시 볼 수 있어요",
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
  const bannerRef = useRef<HTMLDivElement>(null);
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
        <MiniHeader editHref={editHref} />
        <SubHeader
          summary={requestSummary}
          onRegenerate={onRegenerate}
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
      <MiniHeader editHref={editHref} />
      <SubHeader
        summary={requestSummary}
        onRegenerate={onRegenerate}
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
          <TopPickCard
            pick={topPick}
            onDetail={() => onCandidateDetail?.(topPick.candidate.fullName)}
          />
        )}

        <CategoryTabs
          categories={categories}
          active={tab}
          onChange={onTabChange}
        />
        <div ref={bannerRef} data-banner-anchor>
          <CategoryBanner cat={activeCat} />
        </div>
        <CandidateList category={activeCat} />

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
