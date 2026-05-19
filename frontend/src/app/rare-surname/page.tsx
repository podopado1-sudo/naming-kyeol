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
import { rareSurname } from "@/lib/api";
import type { RareSurnameResponse } from "@/lib/types";
import {
  SmartResultRarePage,
  type RareResultData,
  type RareSummary,
  type RareSurnameAnalysis,
  type RareUICandidate,
} from "@/components/design/SmartResultRare";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

// ============================================================
// 자주 찾는 복성 (사용자 친화 진입로)
// ============================================================
const COMMON_COMPOUND_SURNAMES = [
  "선우",
  "남궁",
  "황보",
  "사공",
  "제갈",
  "독고",
];

// ============================================================
// 어댑터: RareSurnameResponse → RareResultData
// ============================================================
function buildRareResultData(
  response: RareSurnameResponse,
  inputs: { birthDate: string; gender: string; tone: string }
): RareResultData {
  const isCompound = response.lastName.length >= 2;

  // 후보 변환 — backend의 RareSurnameCandidate에서 RareUICandidate로
  const total = response.candidates.length;
  const uiCandidates: RareUICandidate[] = response.candidates.map((c, i) => {
    const seed = total > 0 ? 1 - i / Math.max(total, 1) : 1;
    const aesthetics = Math.round(70 + seed * 22); // 70~92 mock
    return {
      fullName: c.fullName,
      meaning: c.harmonyReason || "",
      rarityMatch: response.rarityLevel >= 3 ? 90 : 75,
      aesthetics,
      harmony: c.harmonyScore,
      harmonyScore: c.harmonyScore,
      harmonyReason: c.harmonyReason || "",
      reasons: c.harmonyReason ? [c.harmonyReason] : [],
      tags: ["희귀 성씨"],
      hanjaOptions: (c.hanjaOptions || []).map((opt, idx) => ({
        char: opt,
        meaning: opt,
        isDefault: idx === 0,
      })),
      phonologyNotes: [],
    };
  });

  const avgHarmony =
    uiCandidates.length > 0
      ? Math.round(
          uiCandidates.reduce((s, c) => s + c.harmony, 0) / uiCandidates.length
        )
      : 0;

  // 성씨 분석 — backend phoneticAnalysis만 제공, 나머지는 디자인 기본값
  const surnameAnalysis: RareSurnameAnalysis = {
    hanja: undefined,
    phoneticAnalysis:
      response.phoneticAnalysis || "성씨 발음 분석 정보를 불러올 수 없었어요.",
    considerations: isCompound
      ? [
          "복성(複姓)은 두 음절이라 외자·두 음절 이름과 어울리는 결을 함께 살폈어요.",
          "성씨 자체의 리듬이 강하면 이름의 종성을 가볍게 가져가는 게 좋아요.",
        ]
      : [
          "단음 희귀 성씨는 흔하지 않은 만큼, 이름이 너무 튀지 않도록 균형을 맞췄어요.",
        ],
    pattern: isCompound ? "복성형 패턴" : "단음 희귀형 패턴",
    patternDetail: isCompound
      ? "두 글자 성씨에 어울리도록 외자/두 음절 이름을 균형 있게 배치했어요."
      : "단음 성씨와 결이 맞는 발음·의미를 우선 골랐어요.",
    strategies: [
      {
        key: "phonetic",
        label: "발음 균형",
        detail: "성씨 발음과 충돌하지 않는 자음·모음 조합을 우선시했어요.",
      },
      {
        key: "rarity",
        label: "희귀도 매칭",
        detail: "성씨의 결에 맞춰 너무 흔하지 않은 이름을 선별했어요.",
      },
    ],
    averageHarmony: avgHarmony,
  };

  const requestSummary: RareSummary = {
    lastName: response.lastName,
    isCompound,
    date: inputs.birthDate || undefined,
    gender:
      inputs.gender === "none"
        ? undefined
        : inputs.gender === "male"
          ? "남"
          : "여",
    tone:
      inputs.tone === "neutral"
        ? "중립"
        : inputs.tone === "soft"
          ? "부드러움"
          : "강함",
  };

  const rareCategory = {
    type: "rare-surname",
    label: "희귀 성씨",
    description: "성씨와의 발음 조화를 우선해 골랐어요.",
    engineUsed: "RareSurnameEngine",
    totalInCategory: uiCandidates.length,
    names: uiCandidates,
  };

  return {
    requestSummary,
    rarityLevel: response.rarityLevel,
    surnameAnalysis,
    topPick: uiCandidates[0] ?? null,
    categories: [rareCategory],
    totalCount: response.totalCount ?? uiCandidates.length,
  };
}

// ============================================================
// 메인 페이지
// ============================================================
export default function RareSurnamePage() {
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("none");
  const [tone, setTone] = useState("neutral");
  const [count, setCount] = useState("10");

  const [result, setResult] = useState<RareSurnameResponse | null>(null);
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
      const data = await rareSurname({
        lastName: lastName.trim(),
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
        count: parseInt(count, 10),
      });
      setResult(data);
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
  // 결과 화면
  // ============================================================
  if (result && result.candidates.length > 0) {
    const data = buildRareResultData(result, { birthDate, gender, tone });
    void birthTime; // future: surface birthTime in result summary
    return (
      <SmartResultRarePage
        data={data}
        editHref="/rare-surname"
        onRegenerate={handleReset}
      />
    );
  }

  // ============================================================
  // 입력 폼
  // ============================================================
  return (
    <>
      <Header current="search" />
      <div className="container mx-auto max-w-5xl px-4 py-12">
      {/* Hero */}
      <header className="mb-10 space-y-3 text-center">
        <p className="eyebrow">RARE SURNAME · 희귀 성씨</p>
        <h1 className="text-3xl md:text-4xl font-medium leading-snug tracking-tight text-navy">
          복성과 희귀 성씨를 위한 작명
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          성씨의 결에 맞춰 발음과 의미를 정성껏 골라드릴게요
        </p>
      </header>

      {/* Input Form */}
      <Card className="mb-8 border-paper-line bg-paper-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-navy">기본 정보</CardTitle>
          <CardDescription>
            희귀 성씨 또는 복성(複姓)을 입력해주세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="lastName">성씨</Label>
              <Input
                id="lastName"
                placeholder="예: 선우, 남궁, 봉, 빈, 탁"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground">
                  자주 찾는 복성:
                </span>
                {COMMON_COMPOUND_SURNAMES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLastName(s)}
                    className="rounded-full border border-paper-line bg-paper-tint px-2 py-0.5 text-[10px] text-navy/70 transition hover:border-teal hover:text-teal"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <Label>추천 개수</Label>
                <Select
                  value={count}
                  onValueChange={(v) => setCount(v ?? "10")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5개</SelectItem>
                    <SelectItem value="10">10개</SelectItem>
                    <SelectItem value="20">20개</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "추천 생성 중..." : "희귀 성씨 이름 추천받기"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-amber-warm/50 bg-amber-50 p-4 text-sm text-amber-warm">
          {error}
        </div>
      )}

      {/* Empty result */}
      {result && result.candidates.length === 0 && (
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
