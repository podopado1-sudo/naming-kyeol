import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HanjaCandidate, HanjaSyllable } from "@/lib/types";

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

// 등급 우선순위 — 정렬용 (낮을수록 상위, 백엔드 정렬 4종)
const gradeRank: Record<string, number> = {
  S: 0,
  A: 1,
  B: 2,
  D: 3,
};

function sortCandidates(list: HanjaCandidate[]): HanjaCandidate[] {
  return [...list].sort((a, b) => {
    const ra = gradeRank[a.confidenceGrade ?? "D"] ?? 3;
    const rb = gradeRank[b.confidenceGrade ?? "D"] ?? 3;
    return ra - rb;
  });
}

// ============================================================
// Confidence Badge — 4축 차별화 (Fill / Border / Color / Icon)
// S 검수완료 — solid teal + ✓ icon
// A 규칙기반 — outline teal 1.5px solid border
// B 수동입력 — outline gold 1.5px solid border
// D 획수자동 — outline neutral 1.5px dashed border (반투명 fill)
// ============================================================
function ConfidenceBadge({ grade }: { grade?: "S" | "A" | "B" | "D" }) {
  if (!grade) return null;

  const config = {
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
    D: {
      label: "자동추정",
      title: "획수 기반 자동 추정 — 전문가 확인을 권장합니다.",
      className:
        "bg-paper-card/60 text-muted-foreground border-[1.5px] border-dashed border-paper-line hover:bg-paper-tint",
      showCheck: false,
    },
  }[grade];

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
              {sortCandidates(syllable.candidates).map((c) => {
                const isD = c.confidenceGrade === "D";
                return (
                  <div
                    key={`${c.character}-${c.reading}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-paper-line bg-paper-card p-3 transition",
                      isD && "opacity-75"
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
                        <ConfidenceBadge grade={c.confidenceGrade} />
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
