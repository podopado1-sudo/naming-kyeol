import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSignedPoints, signedPointsClass } from "@/lib/signed-points";
import { cn } from "@/lib/utils";
import type { HarmonyBreakdown } from "@/lib/types";

interface HarmonyBreakdownCardProps {
  harmony: HarmonyBreakdown;
  totalScore: number;
}

interface BarItem {
  label: string;
  value: number;
  max: number;
}

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

export function HarmonyBreakdownCard({
  harmony,
  totalScore,
}: HarmonyBreakdownCardProps) {
  const bars: BarItem[] = [
    // 축 이름은 HarmonyEngine(2026-10-22 S4)과 같다 — fiveElement = 자원오행 보완, resourceElement = 획수 조화
    { label: "자원오행 보완", value: harmony.fiveElement, max: 30 },
    { label: "발음오행", value: harmony.pronunciationElement, max: 25 },
    { label: "획수 조화", value: harmony.resourceElement, max: 20 },
    { label: "수리사격", value: harmony.suriSagyeok, max: 15 },
    { label: "음양", value: harmony.yinYang, max: 10 },
  ];

  return (
    <Card className="border-paper-line bg-paper-card shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-navy">조화 점수</CardTitle>
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

        {/* 부호·색은 값으로(lib/signed-points.ts) — 옛 '+{값}'·청록 고정은 음수에서 '+-2'가 됐다(2026-10-23 NAME-2와 같은 꼴) */}
        {harmony.genderBonus !== 0 && (
          <div className="border-t border-paper-line pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">성별 보너스</span>
              <span
                className={cn(
                  "font-tabular font-medium",
                  signedPointsClass(harmony.genderBonus)
                )}
              >
                {formatSignedPoints(harmony.genderBonus)}
              </span>
            </div>
          </div>
        )}

        {harmony.usedFallback && (
          <div className="rounded-lg border border-amber-warm/30 bg-amber-50 p-3 text-sm text-amber-warm-700">
            배정할 한자가 없는 음절이 있어 기본값으로 계산했어요
          </div>
        )}

        {harmony.notes.length > 0 && (
          <div className="border-t border-paper-line pt-3">
            {harmony.notes.map((note, i) => (
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
