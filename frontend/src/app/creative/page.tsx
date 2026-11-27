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
import type { SmartRecommendationResponse } from "@/lib/types";
import {
  checkSpecialtySurname,
  requestChipLabels,
  specialtyGenderTone,
  wrapCreativeResponse,
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

export default function CreativePage() {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const surname = checkSpecialtySurname(lastName);
    if (surname.error) {
      setError(surname.error);
      document.getElementById("lastName")?.focus();
      return;
    }
    const query: SubmittedQuery = { lastName: surname.value, gender, tone };
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // 서버(CreativeNamingEngine)는 소문자로 비교한다 — 다른 단독 화면과 같은 꼴('none' 은 보내지 않는다)
      const data = await creative({
        lastName: query.lastName,
        ...specialtyGenderTone(query.gender, query.tone),
        count: parseInt(count, 10),
      });
      // 점수는 창의 점수라 이름표 '창의'(lib/specialty-candidates — 'FINAL'(종합)로 적지 않는다)
      setResult({ data: wrapCreativeResponse(data, query.lastName), query });
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
      creative: true,
    };
    return (
      <SmartResultPage
        data={result.data}
        requestSummary={requestSummary}
        editHref="/creative"
        onRegenerate={handleReset}
        onCandidateDetail={(fn) => navDetail(q.lastName, fn, { gender: q.gender, tone: q.tone })}
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
              <Label htmlFor="creative-gender">성별</Label>
              <Select
                value={gender}
                onValueChange={(v) => setGender(v ?? "none")}
              >
                <SelectTrigger id="creative-gender" className="w-full">
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
              <Label htmlFor="creative-tone">톤</Label>
              <Select
                value={tone}
                onValueChange={(v) => setTone(v ?? "neutral")}
              >
                <SelectTrigger id="creative-tone" className="w-full">
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
              <Label htmlFor="creative-count">추천 개수</Label>
              <Select
                value={count}
                onValueChange={(v) => setCount(v ?? "10")}
              >
                <SelectTrigger id="creative-count" className="w-full">
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
