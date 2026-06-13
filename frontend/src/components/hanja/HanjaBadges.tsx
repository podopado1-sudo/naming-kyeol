import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * /hanja 사전 페이지용 뱃지 모음.
 * ConfidenceGrade 4축 디자인 시스템(HanjaCandidateCard와 동일)을 따르되,
 * 사전 데이터에만 존재하는 C등급(의미기반 자동)을 추가로 지원한다.
 */

const GRADE_CONFIG: Record<
  string,
  { label: string; title: string; className: string; showCheck: boolean }
> = {
  S: {
    label: "검수완료",
    title: "작명가 검수가 완료된 한자입니다.",
    className: "bg-teal text-white border-teal hover:bg-teal",
    showCheck: true,
  },
  A: {
    label: "규칙기반",
    title: "오행 규칙이 명확히 적용된 한자입니다.",
    className:
      "bg-transparent text-teal-700 border-[1.5px] border-teal hover:bg-teal-50",
    showCheck: false,
  },
  B: {
    label: "수동입력",
    title: "수동으로 입력된 한자입니다.",
    className:
      "bg-transparent text-amber-warm border-[1.5px] border-gold-700 hover:bg-gold-50",
    showCheck: false,
  },
  C: {
    label: "의미기반",
    title: "한자의 의미를 기반으로 자동 판정된 오행입니다.",
    className:
      "bg-transparent text-muted-foreground border-[1.5px] border-paper-line hover:bg-paper-tint",
    showCheck: false,
  },
  D: {
    label: "획수자동",
    title: "획수 기반 자동 추정 — 전문가 확인을 권장합니다.",
    className:
      "bg-paper-card/60 text-muted-foreground border-[1.5px] border-dashed border-paper-line hover:bg-paper-tint",
    showCheck: false,
  },
};

export function HanjaGradeBadge({ grade }: { grade?: string }) {
  const config = grade ? GRADE_CONFIG[grade] : undefined;
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
