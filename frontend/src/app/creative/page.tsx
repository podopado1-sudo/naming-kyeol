"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { creative } from "@/lib/api";
import type {
  NameRecommendationResponse,
  SmartRecommendationResponse,
} from "@/lib/types";
import {
  SmartResultPage,
  type RequestSummary,
} from "@/components/design/SmartResult";
import { useCandidateDetail } from "@/lib/useCandidateDetail";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

// ============================================================
// 어댑터
// ============================================================
function wrapAsSmartResponse(
  res: NameRecommendationResponse,
  lastName: string
): SmartRecommendationResponse {
  const names = res.names ?? [];
  return {
    lastName,
    isRareSurname: false,
    categories: [
      {
        type: "creative",
        label: "창의적 작명",
        engineUsed: "CreativeNamingEngine",
        names,
      },
    ],
    totalCount: res.totalCount ?? names.length,
    topPick: names.length
      ? {
          categoryType: "creative",
          categoryLabel: "창의적 작명",
          candidate: names[0],
        }
      : null,
  };
}

export default function CreativePage() {
  const [lastName, setLastName] = useState("");
  const navDetail = useCandidateDetail();
  const [gender, setGender] = useState("none");
  const [tone, setTone] = useState("neutral");
  const [count, setCount] = useState("10");

  const [result, setResult] = useState<SmartRecommendationResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lastName.trim()) {
      setError("성씨를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await creative({
        lastName: lastName.trim(),
        gender:
          gender === "none"
            ? undefined
            : gender === "male"
              ? "Male"
              : "Female",
        tone:
          tone === "neutral"
            ? "Neutral"
            : tone === "soft"
              ? "Soft"
              : "Strong",
        count: parseInt(count, 10),
      });
      setResult(wrapAsSmartResponse(data, lastName.trim()));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "요청 중 오류가 발생했어요."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result && result.totalCount > 0) {
    const requestSummary: RequestSummary = {
      lastName,
      gender:
        gender === "none"
          ? undefined
          : gender === "male"
            ? "남"
            : "여",
      tone:
        tone === "neutral"
          ? "중립"
          : tone === "soft"
            ? "부드러움"
            : "강함",
      creative: true,
    };
    return (
      <SmartResultPage
        data={result}
        requestSummary={requestSummary}
        editHref="/creative"
        onRegenerate={handleReset}
        onCandidateDetail={(fn) => navDetail(lastName, fn, { gender, tone })}
      />
    );
  }

  return (
    <>
      <Header current="search" />
      <div className="container mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 space-y-3 text-center">
        <p className="eyebrow">CREATIVE NAMING · 창의적 작명</p>
        <h1 className="text-3xl md:text-4xl font-medium leading-snug tracking-tight text-navy">
          성씨와 이어지는 이야기
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          성씨의 의미·어원을 활용해 성과 이름이 한 결로 흐르는 이름을 만들어드릴게요
        </p>
      </header>

      <Card className="mb-8 border-paper-line bg-paper-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-navy">기본 정보</CardTitle>
          <CardDescription>
            성씨의 결을 반영한 창의적 이름을 만들어 드립니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lastName">성씨</Label>
              <Input
                id="lastName"
                placeholder="예: 김"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>성별</Label>
              <Select
                value={gender}
                onValueChange={(v) => setGender(v ?? "none")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">무관</SelectItem>
                  <SelectItem value="male">남</SelectItem>
                  <SelectItem value="female">여</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>톤</Label>
              <Select
                value={tone}
                onValueChange={(v) => setTone(v ?? "neutral")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neutral">중립</SelectItem>
                  <SelectItem value="soft">부드러움</SelectItem>
                  <SelectItem value="strong">강함</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>추천 개수</Label>
              <Select
                value={count}
                onValueChange={(v) => setCount(v ?? "10")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10개</SelectItem>
                  <SelectItem value="20">20개</SelectItem>
                  <SelectItem value="30">30개</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "추천 생성 중..." : "창의적 이름 추천받기"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-6 rounded-lg border border-amber-warm/50 bg-amber-50 p-4 text-sm text-amber-warm">
          {error}
        </div>
      )}

      {result && result.totalCount === 0 && (
        <div className="rounded-2xl border border-paper-line bg-paper-card p-10 text-center shadow-sm">
          <p className="eyebrow mb-3">RESULT · EMPTY</p>
          <h2 className="mb-3 text-2xl font-medium text-navy">
            추천 결과를 찾지 못했어요
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            조건을 바꿔서 다시 시도해주세요
          </p>
          <Button variant="outline" onClick={handleReset}>
            조건 바꿔서 다시 추천받기
          </Button>
        </div>
      )}
      </div>
      <Footer />
    </>
  );
}
