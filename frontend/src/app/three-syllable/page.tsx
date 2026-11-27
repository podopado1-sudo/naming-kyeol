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
import { threeSyllable } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SmartRecommendationResponse } from "@/lib/types";
import {
  NAME_TYPE_LABEL as NAMETYPE_LABEL,
  checkSpecialtySurname,
  requestChipLabels,
  specialtyGenderTone,
  wrapThreeSyllableResponse,
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

export default function ThreeSyllablePage() {
  const [lastName, setLastName] = useState("");
  const navDetail = useCandidateDetail();
  const [gender, setGender] = useState("none");
  const [tone, setTone] = useState("neutral");
  const [nameType, setNameType] = useState("mixed");
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
      const data = await threeSyllable({
        lastName: query.lastName,
        ...specialtyGenderTone(query.gender, query.tone),
        nameType,
        count: parseInt(count, 10),
      });
      setResult({ data: wrapThreeSyllableResponse(data, query.lastName), query });
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

  if (result && result.data.totalCount > 0) {
    const q = result.query;
    const requestSummary: RequestSummary = {
      lastName: q.lastName,
      ...requestChipLabels(q.gender, q.tone),
    };
    return (
      <SmartResultPage
        data={result.data}
        requestSummary={requestSummary}
        editHref="/three-syllable"
        onRegenerate={handleReset}
        // 카드의 한자(순우리말 음절은 '-' — 한자 없이)를 평가 링크에 싣는다. 빼면 /evaluate 가 한자를 자동으로 골라 다른 이름을 채점한다
        onCandidateDetail={(fn, hanja) => navDetail(q.lastName, fn, { gender: q.gender, tone: q.tone, hanja })}
        // 저장(TopPick)에도 성별·톤을 남긴다 — 없으면 /favorites가 옛 저장분으로 보고
        // 선우리를 선우+리로 다시 나누고, 다시 보기가 성별·톤 없이 평가된다 (2026-10-21)
        favoriteContext={{ gender: q.gender, tone: q.tone }}
      />
    );
  }

  return (
    <>
      <Header current="search" />
      <div className="container mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 space-y-3 text-center">
        <p className="eyebrow">THREE SYLLABLE · 3글자 이름</p>
        <h1 className="text-3xl md:text-4xl font-medium leading-snug tracking-tight text-navy">
          성 뒤에 세 글자, 또렷한 결
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          성 뒤에 세 글자로 흐르는 이름(김누리서처럼)을 추천해드릴게요. 순우리말·한자·혼합 중 선택할 수 있어요.
        </p>
      </header>

      <Card className="mb-8 border-paper-line bg-paper-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-navy">기본 정보</CardTitle>
          <CardDescription>
            3글자 이름 추천에 필요한 정보를 입력해주세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
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
              <Label htmlFor="three-syllable-gender">성별</Label>
              <Select
                value={gender}
                onValueChange={(v) => setGender(v ?? "none")}
              >
                <SelectTrigger id="three-syllable-gender" className="w-full">
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
              <Label htmlFor="three-syllable-tone">톤</Label>
              <Select
                value={tone}
                onValueChange={(v) => setTone(v ?? "neutral")}
              >
                <SelectTrigger id="three-syllable-tone" className="w-full">
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
              <Label htmlFor="three-syllable-name-type">이름 유형</Label>
              <Select
                value={nameType}
                onValueChange={(v) => setNameType(v ?? "mixed")}
              >
                <SelectTrigger id="three-syllable-name-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pure-korean">
                    {NAMETYPE_LABEL["pure-korean"]}
                  </SelectItem>
                  <SelectItem value="hanja">{NAMETYPE_LABEL.hanja}</SelectItem>
                  <SelectItem value="mixed">{NAMETYPE_LABEL.mixed}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="three-syllable-count">추천 개수</Label>
              <Select
                value={count}
                onValueChange={(v) => setCount(v ?? "10")}
              >
                <SelectTrigger id="three-syllable-count" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10개</SelectItem>
                  <SelectItem value="20">20개</SelectItem>
                  <SelectItem value="30">30개</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "추천 생성 중..." : "3글자 이름 추천받기"}
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
