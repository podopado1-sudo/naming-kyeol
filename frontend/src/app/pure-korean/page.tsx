"use client";

import { useState } from "react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import type { SmartRecommendationResponse } from "@/lib/types";
import {
  checkSpecialtySurname,
  requestChipLabels,
  specialtyGenderTone,
  wrapPureKoreanResponse,
} from "@/lib/specialty-candidates";
import {
  SmartResultPage,
  type RequestSummary,
} from "@/components/design/SmartResult";
import { useCandidateDetail } from "@/lib/useCandidateDetail";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

/**
 * 결과를 받은 요청의 입력 — 결과 화면(조건 칩·'상세 보기'·저장)은 이 값만 쓴다.
 * 응답을 기다리는 동안(콜드 스타트 30초 안팎) 폼을 고쳐도 결과와 다른 조건이 링크·저장에 실리지 않게 제출 때 잡아 둔다(/dual-name 과 같은 꼴).
 */
interface SubmittedQuery {
  /** 요청에 보낸 성씨(다듬은 값) */
  lastName: string;
  gender: string;
  tone: string;
}

export default function PureKoreanPage() {
  const [lastName, setLastName] = useState("");
  const navDetail = useCandidateDetail();
  const [gender, setGender] = useState("none");
  const [tone, setTone] = useState("neutral");
  const [count, setCount] = useState("10");

  const [result, setResult] = useState<{
    data: SmartRecommendationResponse;
    query: SubmittedQuery;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 성씨 칸의 문제(칸 아래에 그린다 — 칸에 aria-invalid·aria-describedby). 칸을 고치면 지운다 */
  const [surnameError, setSurnameError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const surname = checkSpecialtySurname(lastName);
    if (surname.error) {
      setSurnameError(surname.error);
      setError(null);
      document.getElementById("lastName")?.focus();
      return;
    }
    setSurnameError(null);
    const query: SubmittedQuery = { lastName: surname.value, gender, tone };
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await pureKorean({
        lastName: query.lastName,
        ...specialtyGenderTone(query.gender, query.tone),
        count: parseInt(count, 10),
      });
      setResult({ data: wrapPureKoreanResponse(data, query.lastName), query });
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
  if (result && result.data.totalCount > 0) {
    const q = result.query;
    const requestSummary: RequestSummary = {
      lastName: q.lastName,
      ...requestChipLabels(q.gender, q.tone),
      pureKorean: true,
    };
    return (
      <SmartResultPage
        data={result.data}
        requestSummary={requestSummary}
        onRegenerate={handleReset}
        // 카드의 한자(순우리말 음절은 '-' — 한자 없이)를 평가 링크에 싣는다. 빼면 /evaluate 가 한자를 자동으로 골라 다른 이름을 채점한다
        onCandidateDetail={(fn, hanja) => navDetail(q.lastName, fn, { gender: q.gender, tone: q.tone, hanja })}
        // 저장(TopPick)에도 성별·톤을 남긴다 — 없으면 /favorites가 옛 저장분으로 보고
        // 선우리를 선우+리로 다시 나누고, 다시 보기가 성별·톤 없이 평가된다 (2026-10-21)
        favoriteContext={{ gender: q.gender, tone: q.tone }}
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
        {/* 2026-11-19 D7 권고안(설계 docs/plan-ohaeng-2026-11.md §9-2·§16) — 리포트 md 와 같은 커밋(C3)에 넣는다(먼저 내면 404) */}
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          실제로 많이 쓰인 순우리말 이름은{" "}
          <Link href="/guide/pure-korean-names" className="text-teal underline underline-offset-2">
            순우리말 아기 이름 리포트
          </Link>
          에서 볼 수 있어요
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
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (surnameError) setSurnameError(null);
                }}
                required
                aria-invalid={surnameError ? true : undefined}
                aria-describedby={surnameError ? "lastName-error" : undefined}
                className={cn(
                  surnameError &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {surnameError && (
                <p id="lastName-error" className="text-xs text-amber-warm-700" role="alert">
                  {surnameError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pure-korean-gender">성별</Label>
              <Select
                value={gender}
                onValueChange={(v) => setGender(v ?? "none")}
              >
                <SelectTrigger id="pure-korean-gender" className="w-full">
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
              <Label htmlFor="pure-korean-tone">톤</Label>
              <Select
                value={tone}
                onValueChange={(v) => setTone(v ?? "neutral")}
              >
                <SelectTrigger id="pure-korean-tone" className="w-full">
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
              <Label htmlFor="pure-korean-count">추천 개수</Label>
              <Select
                value={count}
                onValueChange={(v) => setCount(v ?? "10")}
              >
                <SelectTrigger id="pure-korean-count" className="w-full">
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
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-warm/50 bg-amber-50 p-4 text-sm text-amber-warm-700"
        >
          {error}
        </div>
      )}

      {result && result.data.totalCount === 0 && (
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
