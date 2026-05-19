import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SmartNameCandidate } from "@/lib/types";

interface NameCardProps {
  candidate: SmartNameCandidate;
  lastName?: string;
}

// 이름의 결 점수 분기 (85+ teal / 70+ navy / 55+ gold / <55 muted)
function scoreColor(score: number) {
  if (score >= 85) return "bg-teal-50 text-teal-700 border-teal-50";
  if (score >= 70) return "bg-navy-50 text-navy-700 border-navy-50";
  if (score >= 55) return "bg-gold-50 text-amber-warm border-gold-50";
  return "bg-paper-tint text-muted-foreground border-paper-line";
}

export function NameCard({ candidate, lastName }: NameCardProps) {
  return (
    <Card
      size="sm"
      className="border-paper-line bg-paper-card transition hover:border-teal hover:shadow-sm"
    >
      <CardContent className="flex flex-col gap-2">
        {/* 이름 + 점수 */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium tracking-tight text-navy">
            {candidate.fullName}
          </span>
          {candidate.score != null && (
            <Badge
              variant="outline"
              className={cn(
                "px-2.5 py-0.5 font-tabular text-sm font-semibold",
                scoreColor(candidate.score)
              )}
            >
              {candidate.score}점
            </Badge>
          )}
        </div>

        {/* 상세 평가 링크 */}
        <Link
          href={`/evaluate?lastName=${encodeURIComponent(lastName ?? candidate.fullName.slice(0, 1))}&name=${encodeURIComponent(candidate.name || candidate.fullName.slice(1))}`}
          className="w-fit text-xs text-teal underline-offset-4 transition hover:text-teal-700 hover:underline"
        >
          상세 평가 →
        </Link>

        {/* 의미 */}
        {candidate.meaning && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            &ldquo;{candidate.meaning}&rdquo;
          </p>
        )}

        {/* 태그 */}
        {candidate.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {candidate.tags.map((tag, i) => (
              <Badge
                key={`${tag}-${i}`}
                variant="secondary"
                className="bg-paper-tint text-xs font-normal text-navy/70"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
