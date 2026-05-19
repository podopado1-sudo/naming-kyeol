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
import { pureKorean } from "@/lib/api";
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
// 어댑터: NameRecommendationResponse → SmartRecommendationResponse
// 단일 카테고리(pure-korean)로 래핑해 SmartResultPage에서 동일 UX
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
        type: "pure-korean",
        label: "순우리말 이름",
        engineUsed: "PureKoreanNameEngine",
        names,
      },
    ],
    totalCount: res.totalCount ?? names.length,
    topPick: names.length
      ? {
          categoryType: "pure-korean",
          categoryLabel: "순우리말 이름",
          candidate: names[0],
        }
      : null,
  };
}

export default function PureKoreanPage() {
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
      const data = await pureKorean({
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

  // ============================================================
  // 결과 화면 — SmartResultPage 재사용
  // ============================================================
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
      pureKorean: true,
    };
    return (
      <SmartResultPage
        data={result}
        requestSummary={requestSummary}
        editHref="/pure-korean"
        onRegenerate={handleReset}
        onCandidateDetail={(fn) => navDetail(lastName, fn, { gender, tone })}
      />
    );
  }

  // ============================================================
  // 입력 폼
  // ============================================================
  return (
    <>
      <Header current="search" />
      <div className="container mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 space-y-3 text-center">
        <p className="eyebrow">PURE KOREAN · 순우리말</p>
        <h1 className="text-3xl md:text-4xl font-medium leading-snug tracking-tight text-navy">
          우리말의 결로 짓는 이름
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          자연·감정·계절 등 한국어 고유의 결을 담은 이름을 추천해드릴게요
        </p>
      </header>

      <Card className="mb-8 border-paper-line bg-paper-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-navy">기본 정보</CardTitle>
          <CardDescription>성씨와 선호 톤을 입력해주세요</CardDescription>
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
                {loading ? "추천 생성 중..." : "순우리말 이름 추천받기"}
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
