"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { requiredChar } from "@/lib/api";
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
        type: "required-char",
        label: "필수 글자 포함",
        engineUsed: "RequiredCharEngine",
        names,
      },
    ],
    totalCount: res.totalCount ?? names.length,
    topPick: names.length
      ? {
          categoryType: "required-char",
          categoryLabel: "필수 글자 포함",
          candidate: names[0],
        }
      : null,
  };
}

const POSITION_LABEL: Record<string, string> = {
  first: "첫글자",
  last: "끝글자",
  any: "어디든",
};

/** CJK 한자 여부 (기본 + 확장A + 호환 영역) */
function isHanjaChar(ch: string): boolean {
  return /^[㐀-䶿一-鿿豈-﫿]$/.test(ch);
}

function RequiredCharForm() {
  const [lastName, setLastName] = useState("");
  const navDetail = useCandidateDetail();
  const [reqChar, setReqChar] = useState("");

  // /hanja 사전 페이지 CTA에서 ?char=潤 / ?char=윤 형태로 진입 시 프리필
  const searchParams = useSearchParams();
  useEffect(() => {
    const prefill = searchParams.get("char");
    if (prefill && [...prefill].length === 1) setReqChar(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [position, setPosition] = useState("any");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("none");
  const [tone, setTone] = useState("neutral");

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
    if (!reqChar.trim()) {
      setError("필수 글자를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const trimmedChar = reqChar.trim();
      const isHanja = isHanjaChar(trimmedChar);
      const data = await requiredChar({
        lastName: lastName.trim(),
        // 한자 입력이면 항렬자 모드 — 발음은 백엔드가 한자의 음으로 자동 도출
        requiredChar: isHanja ? "" : trimmedChar,
        requiredHanja: isHanja ? trimmedChar : undefined,
        position,
        birthDate: birthDate || undefined,
        birthTime: birthTime || undefined,
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
      date: birthDate || undefined,
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
    };
    return (
      <SmartResultPage
        data={result}
        requestSummary={requestSummary}
        editHref="/required-char"
        onRegenerate={handleReset}
        onCandidateDetail={(fn) => navDetail(lastName, fn, { birthDate, birthTime, gender, tone })}
      />
    );
  }

  return (
    <>
      <Header current="search" />
      <div className="container mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 space-y-3 text-center">
        <p className="eyebrow">REQUIRED CHARACTER · 필수 글자</p>
        <h1 className="text-3xl md:text-4xl font-medium leading-snug tracking-tight text-navy">
          꼭 넣고 싶은 한 글자에서 시작하는 이름
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          돌림자나 특별히 담고 싶은 글자가 있으면, 그 글자가 자연스럽게 어울리는 이름만 골라드릴게요
        </p>
      </header>

      <Card className="mb-8 border-paper-line bg-paper-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-navy">기본 정보</CardTitle>
          <CardDescription>
            필수 글자와 위치를 지정해주세요
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
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reqChar">필수 글자</Label>
              <Input
                id="reqChar"
                placeholder="한 글자 (한글·한자)"
                maxLength={1}
                value={reqChar}
                onChange={(e) => setReqChar(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>위치</Label>
              <Select
                value={position}
                onValueChange={(v) => setPosition(v ?? "any")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">{POSITION_LABEL.first}</SelectItem>
                  <SelectItem value="last">{POSITION_LABEL.last}</SelectItem>
                  <SelectItem value="any">{POSITION_LABEL.any}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">출생일</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthTime">
                출생 시각{" "}
                <span className="text-[10px] text-muted-foreground">(선택)</span>
              </Label>
              <Input
                id="birthTime"
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
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

            <div className="sm:col-span-2 lg:col-span-3">
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "추천 생성 중..." : "필수 글자 포함 이름 추천받기"}
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

// useSearchParams는 정적 렌더링 시 Suspense 경계가 필요
export default function RequiredCharPage() {
  return (
    <Suspense>
      <RequiredCharForm />
    </Suspense>
  );
}
