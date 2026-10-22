import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HanjaSyllable } from "@/lib/types";
import {
  RESOURCE_GRADE_INFO,
  toResourceGrade,
  type ResourceGrade,
} from "@/components/design/resource-grade";

interface HanjaCandidateCardProps {
  hanjaCandidates: HanjaSyllable[];
}

// 5요소 색상 — 이름의 결 톤
const elementColorMap: Record<string, string> = {
  "木": "bg-teal-50 text-teal-700 border-teal-50", // 木 — 자연
  "火": "bg-amber-50 text-amber-warm border-amber-50", // 火 — 따뜻함
  "土": "bg-gold-50 text-gold-700 border-gold-50", // 土 — 황토
  "金": "bg-navy-50 text-navy-700 border-navy-50", // 金 — 강·금속
  "水": "bg-paper-tint text-score-mid border-paper-line", // 水 — 물
};

// ============================================================
// 자원오행 판정 등급 뱃지 — 4축 차별화 (Fill / Border / Color / Icon), 라벨·설명은 resource-grade.ts
// R 확정 — solid teal + ✓ icon
// X 예외 적용 — outline teal 1.5px solid border
// V 이견 있음 — outline gold 1.5px solid border
// U 미상 — outline neutral 1.5px dashed border (반투명 fill)
// 옛 S/A/B/D(뜻 기반 판정 신뢰도) 정렬은 뺐다 — 등급은 판정 근거의 종류라 순서가 아니다(백엔드 순서 그대로).
// ============================================================
const GRADE_CLASS: Record<ResourceGrade, { className: string; showCheck: boolean }> = {
  R: { className: "bg-teal text-white border-teal hover:bg-teal", showCheck: true },
  X: {
    className: "bg-transparent text-teal-700 border-[1.5px] border-teal hover:bg-teal-50",
    showCheck: false,
  },
  V: {
    className: "bg-transparent text-amber-warm border-[1.5px] border-gold-700 hover:bg-gold-50",
    showCheck: false,
  },
  U: {
    className:
      "bg-paper-card/60 text-muted-foreground border-[1.5px] border-dashed border-paper-line hover:bg-paper-tint",
    showCheck: false,
  },
};

function ResourceGradeBadge({ grade }: { grade?: ResourceGrade }) {
  if (!grade) return null;
  const { className, showCheck } = GRADE_CLASS[grade];
  const { label, tip } = RESOURCE_GRADE_INFO[grade];
  return (
    <Badge variant="outline" title={tip} className={cn("gap-0.5 text-xs", className)}>
      {showCheck && <Check className="size-3" />}
      {label}
    </Badge>
  );
}

export function HanjaCandidateCard({
  hanjaCandidates,
}: HanjaCandidateCardProps) {
  if (!hanjaCandidates || hanjaCandidates.length === 0) return null;

  return (
    <Card className="border-paper-line bg-paper-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-navy">한자 후보</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {hanjaCandidates.map((syllable) => (
          <div key={syllable.syllable}>
            <p className="mb-2 text-sm font-medium text-navy">
              &ldquo;{syllable.syllable}&rdquo;
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {syllable.candidates.map((c) => {
                const grade = toResourceGrade(c.resourceGrade);
                return (
                  <div
                    key={`${c.character}-${c.reading}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-paper-line bg-paper-card p-3 transition",
                      grade === "U" && "opacity-75"
                    )}
                  >
                    <span className="font-hanja text-2xl font-medium text-navy">
                      {c.character}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy">
                        {c.reading} &mdash; {c.meaning}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <ResourceGradeBadge grade={grade} />
                        {c.fiveElement && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "border text-xs",
                              elementColorMap[c.fiveElement] ?? ""
                            )}
                            title={c.rationale}
                          >
                            {c.fiveElement}
                          </Badge>
                        )}
                        {c.yinYang && (
                          <Badge
                            variant="outline"
                            className="border-paper-line text-xs"
                          >
                            {c.yinYang}
                          </Badge>
                        )}
                        {c.strokeCount != null && (
                          <Badge
                            variant="outline"
                            className="border-paper-line font-tabular text-xs"
                            title={
                              c.kangxiStrokes != null &&
                              c.kangxiStrokes !== c.strokeCount
                                ? `강희획수 ${c.kangxiStrokes}획 (원획법)`
                                : undefined
                            }
                          >
                            {c.strokeCount}획
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
