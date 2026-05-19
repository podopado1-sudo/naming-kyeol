import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ExplanationCardProps {
  summary: string;
  strengths: string[];
  cautions: string[];
  pronunciationNote: string;
  meaningNote: string;
  toneReason: string;
}

export function ExplanationCard({
  summary,
  strengths,
  cautions,
  pronunciationNote,
  meaningNote,
  toneReason,
}: ExplanationCardProps) {
  return (
    <Card className="border-paper-line bg-paper-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-navy">종합 평가</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary — report header strip */}
        {summary && (
          <div
            className="inline-block rounded-full bg-foreground/5 px-3.5 py-1.5 text-xs font-medium tabular-nums tracking-tight text-foreground/80"
          >
            {summary}
          </div>
        )}

        {/* Strengths — teal tone */}
        {strengths.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-teal-700">강점</h4>
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm tabular-nums">
                  <span className="mt-0.5 shrink-0 text-teal">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cautions — amber-warm tone (red 회피) */}
        {cautions.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-amber-warm">참고</h4>
            <ul className="space-y-1.5">
              {cautions.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm tabular-nums">
                  <span className="mt-0.5 shrink-0 text-amber-warm">-</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes section */}
        {(pronunciationNote || meaningNote || toneReason) && (
          <>
            <Separator />
            <div className="space-y-2 tabular-nums">
              {pronunciationNote && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 font-medium text-navy/70">
                    발음
                  </span>
                  <span className="text-muted-foreground">
                    {pronunciationNote}
                  </span>
                </div>
              )}
              {meaningNote && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 font-medium text-navy/70">
                    의미
                  </span>
                  <span className="text-muted-foreground">{meaningNote}</span>
                </div>
              )}
              {toneReason && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 font-medium text-navy/70">
                    톤
                  </span>
                  <span className="text-muted-foreground">{toneReason}</span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
