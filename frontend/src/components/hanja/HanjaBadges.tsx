import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { gradeBadgeKey } from "./hanja-element-text";

/**
 * /hanja 사전·/name 조합 카드에서 쓰는 뱃지 모음.
 *
 * 자원오행 등급(2026-10-22 자원오행 전환 S7 — 계획 §2-4·D5): 기존 4축(Fill / Border / Color / Icon)을 그대로 다시 쓴다.
 * - R 확정 — solid teal + ✓ (옛 S 자리)
 * - X 예외 적용 — outline teal (옛 A 자리)
 * - V 이견 있음 — outline gold (옛 B 자리). 자료 적음·추정만 있는 V 는 대체값이 없어 '이견'이라 쓰지 않는다
 * - U 미상 — dashed neutral (옛 D 자리)
 * 옛 S 등급 문구(전문가가 확인을 마친 한자라는 뜻)는 사실과 달라 폐지했다(옛 값은 뜻 기반 자동 판정이었다).
 */

const TEAL_SOLID = "bg-teal text-white border-teal hover:bg-teal";
const TEAL_OUTLINE =
  "bg-transparent text-teal-700 border-[1.5px] border-teal hover:bg-teal-50";
// '이견 있음'·'자료 적음'·'추정' 12px 글자 — 옛 text-amber-warm(#b5874c)은 종이 바탕 3.08:1 로 WCAG AA(4.5:1) 미달이었다
// (2026-10-23 검증 BR-3 → 10-26 F3). 짙은 amber-warm-700(#7A5B22 — /evaluate·/analysis 배지 DetailHanja 와 같은 글자색)은
// 종이 6.00 · 흰 6.27 · hover gold-50 5.48:1. 테두리(gold-700)·바탕(투명)은 그대로라 4축 구분은 같다
const GOLD_OUTLINE =
  "bg-transparent text-amber-warm-700 border-[1.5px] border-gold-700 hover:bg-gold-50";
const NEUTRAL_DASHED =
  "bg-paper-card/60 text-muted-foreground border-[1.5px] border-dashed border-paper-line hover:bg-paper-tint";

const GRADE_CONFIG: Record<
  string,
  { label: string; title: string; className: string; showCheck: boolean }
> = {
  R: {
    label: "확정",
    title: "부수 기준 자원오행에 자료 사이 이견이 없는 글자입니다.",
    className: TEAL_SOLID,
    showCheck: true,
  },
  X: {
    label: "예외 적용",
    title: "간지·문헌·작명 실무 자료의 예외표로 자원오행을 정한 글자입니다.",
    className: TEAL_OUTLINE,
    showCheck: false,
  },
  V: {
    label: "이견 있음",
    title: "부수나 글자에 따라 다른 자원오행으로 보는 자료가 있는 글자입니다.",
    className: GOLD_OUTLINE,
    showCheck: false,
  },
  V_FEW: {
    label: "자료 적음",
    title: "이 부수의 자원오행 자료가 적어 확정하지 않은 글자입니다.",
    className: GOLD_OUTLINE,
    showCheck: false,
  },
  V_GUESS: {
    label: "추정",
    title: "어느 자료에도 이 부수의 값이 없어 부수의 뜻으로 추정한 글자입니다.",
    className: GOLD_OUTLINE,
    showCheck: false,
  },
  U: {
    label: "미상",
    title: "부수 자료가 없어 자원오행을 정하지 못한 글자입니다.",
    className: NEUTRAL_DASHED,
    showCheck: false,
  },
};

/**
 * 자원오행 등급 뱃지. vReasons 를 넘기면 V 를 이견 있음·자료 적음·추정으로 나눈다
 * (안 넘기면 V 는 모두 '이견 있음' — /hanja 는 늘 넘긴다).
 */
export function HanjaGradeBadge({
  grade,
  vReasons,
}: {
  grade?: string;
  vReasons?: string[];
}) {
  const key = gradeBadgeKey(grade, vReasons);
  const config = key ? GRADE_CONFIG[key] : undefined;
  if (!config) return null;
  return (
    <Badge
      variant="outline"
      title={config.title}
      className={cn("gap-0.5 text-xs", config.className)}
    >
      {config.showCheck && <Check className="size-3" />}
      {config.label}
    </Badge>
  );
}

// 오행 색상 — HanjaCandidateCard와 동일 톤
const ELEMENT_COLOR: Record<string, string> = {
  木: "bg-teal-50 text-teal-700 border-teal-50",
  火: "bg-amber-50 text-amber-warm border-amber-50",
  土: "bg-gold-50 text-gold-700 border-gold-50",
  金: "bg-navy-50 text-navy-700 border-navy-50",
  水: "bg-paper-tint text-score-mid border-paper-line",
};

/** 자원오행 뱃지 — rationale 은 자원오행 근거 한 줄(note) */
export function HanjaElementBadge({
  element,
  rationale,
}: {
  element?: string;
  rationale?: string;
}) {
  if (!element) return null;
  return (
    <Badge
      variant="secondary"
      title={rationale}
      className={cn("border text-xs", ELEMENT_COLOR[element] ?? "")}
    >
      {element}
    </Badge>
  );
}

/**
 * 이체자 뱃지 — '眞의 이체자'. 정자 상세 페이지가 있으면 링크.
 * variant_tie(정자 판정이 약함) 글자에는 달지 않는다 — 호출하는 쪽이 standardCharOf 로 거른다.
 */
export function HanjaVariantBadge({
  standard,
  linked,
}: {
  standard: string;
  linked: boolean;
}) {
  const badge = (
    <Badge
      variant="outline"
      title={`${standard}의 다른 꼴(이체자)입니다.`}
      className="border-paper-line text-xs text-text-2"
    >
      <span className="font-hanja">{standard}</span>의 이체자
    </Badge>
  );
  if (!linked) return badge;
  return (
    <Link
      href={`/hanja/${encodeURIComponent(standard)}`}
      className="no-underline hover:opacity-80"
    >
      {badge}
    </Link>
  );
}

/** 이름에 피하는 글자(불용 nf) 뱃지 — 이 사이트의 이름 추천·평가 배정에서 쓰지 않는 글자 */
export function HanjaAvoidBadge() {
  return (
    <Badge
      variant="outline"
      title="뜻 가운데 부정적인 풀이가 있어 이름의 결 이름 추천에서 쓰지 않는 글자입니다."
      className={cn("text-xs", NEUTRAL_DASHED)}
    >
      이름에 피함
    </Badge>
  );
}
