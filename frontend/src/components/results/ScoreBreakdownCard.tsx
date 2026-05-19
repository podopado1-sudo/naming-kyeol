import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AestheticBreakdown } from "@/lib/types";

interface ScoreBreakdownCardProps {
  aesthetic: AestheticBreakdown;
  totalScore: number;
}

interface BarItem {
  label: string;
  value: number;
  max: number;
}

// 이름의 결 점수 분기 (퍼센트 기준): 85+ teal-green / 70+ navy-blue / 55+ amber / <55 muted
function getBarColor(value: number, max: number) {
  const pct = (value / max) * 100;
  if (pct >= 85) return "bg-score-high";
  if (pct >= 70) return "bg-score-mid";
  if (pct >= 55) return "bg-score-low";
  return "bg-muted-foreground/40";
}

function ScoreBar({ label, value, max }: BarItem) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-tabular font-medium">
          {value}/{max}
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-paper-tint">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            getBarColor(value, max)
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BonusLine({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type: "bonus" | "penalty";
}) {
  if (value === 0) return null;
  const isPositive = type === "bonus";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-tabular font-medium",
          isPositive ? "text-teal" : "text-amber-warm"
        )}
      >
        {isPositive ? `+${value}` : `${value}`}
      </span>
    </div>
  );
}

export function ScoreBreakdownCard({
  aesthetic,
  totalScore,
}: ScoreBreakdownCardProps) {
  const bars: BarItem[] = [
    { label: "발음", value: aesthetic.pronunciation, max: 30 },
    { label: "리듬", value: aesthetic.rhythm, max: 25 },
    { label: "음절", value: aesthetic.syllable, max: 15 },
    { label: "세대 중립", value: aesthetic.neutrality, max: 15 },
    { label: "의미", value: aesthetic.meaning, max: 10 },
  ];

  return (
    <Card className="border-paper-line bg-paper-card shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-navy">미학 점수</CardTitle>
          <span className="font-tabular text-2xl font-bold text-navy">
            {totalScore}
            <span className="ml-0.5 text-sm font-medium text-muted-foreground">
              점
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {bars.map((bar) => (
          <ScoreBar key={bar.label} {...bar} />
        ))}

        <div className="space-y-1.5 border-t border-paper-line pt-3">
          <BonusLine label="톤 보너스" value={aesthetic.toneBonus} type="bonus" />
          <BonusLine
            label="성별 보너스"
            value={aesthetic.genderBonus}
            type="bonus"
          />
          <BonusLine label="감점" value={aesthetic.penalty} type="penalty" />
        </div>

        {aesthetic.notes.length > 0 && (
          <div className="border-t border-paper-line pt-3">
            {aesthetic.notes.map((note, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {note}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
