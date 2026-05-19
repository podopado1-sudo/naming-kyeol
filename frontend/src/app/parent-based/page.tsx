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
import { parentBased } from "@/lib/api";
import type { ParentBasedCandidate } from "@/lib/types";
import {
  SmartResultParentPage,
  type NamingModelKey,
  type ParentResultData,
  type ParentSummary,
  type ParentUICandidate,
} from "@/components/design/SmartResultParent";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

// ============================================================
// 작명 모델 분류 — backend nameType 기반
// ============================================================
function detectNamingModel(c: ParentBasedCandidate): NamingModelKey {
  const nt = c.nameType || "";
  if (nt.includes("음운")) return "phonetic";
  if (nt.includes("의미")) return "semantic";
  return "narrative";
}

// ============================================================
// 어댑터: ParentBasedCandidate[] → ParentResultData
// ============================================================
function buildParentResultData(
  candidates: ParentBasedCandidate[],
  inputs: {
    babySurname: string;
    fatherSurname: string;
    fatherName: string;
    motherSurname: string;
    motherName: string;
    storyKeyword: string;
    birthDate: string;
    gender: string;
    tone: string;
  }
): ParentResultData {
  // backend 미반환 점수 → 등수 기반 mock 점수
  const total = candidates.length;
  const uiCandidates: ParentUICandidate[] = candidates.map((c, i) => {
    const seed = total > 0 ? 1 - i / Math.max(total, 1) : 1;
    const aesthetics = Math.round(72 + seed * 20); // 72~92
    const harmony = Math.round(70 + seed * 22); // 70~92
    const finalScore = Math.round(aesthetics * 0.7 + harmony * 0.3);
    return {
      fullName: `${inputs.babySurname}${c.name}`,
      meaning: c.description || "",
      aesthetics,
      harmony,
      finalScore,
      rarity: 50, // backend 미제공 → 중앙값
      tags: c.nameType ? [c.nameType, c.namingModel] : [c.namingModel],
      reasons: c.description ? [c.description] : [],
      phonologyNotes: [],
      namingModel: detectNamingModel(c),
      parentLink: { anchor: c.namingModel },
    };
  });

  const fatherFull =
    `${inputs.fatherSurname || ""}${inputs.fatherName || ""}`.trim();
  const motherFull =
    `${inputs.motherSurname || ""}${inputs.motherName || ""}`.trim();

  const requestSummary: ParentSummary = {
    lastName: inputs.babySurname,
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
    parents: {
      father: fatherFull ? { fullName: fatherFull } : undefined,
      mother: motherFull ? { fullName: motherFull } : undefined,
      keywords: inputs.storyKeyword ? [inputs.storyKeyword] : [],
    },
  };

  // 사용 가능한 모델 집계
  const modelSet = new Set<NamingModelKey>(
    uiCandidates
      .map((u) => u.namingModel)
      .filter((m): m is NamingModelKey => Boolean(m))
  );
  const modelLabels: Record<NamingModelKey, string> = {
    phonetic: "음운 계승형",
    semantic: "의미 계승형",
    narrative: "가족 서사형",
  };
  const modelsAvailable = Array.from(modelSet).map((key) => ({
    key,
    label: modelLabels[key],
  }));

  const avgAesthetics =
    uiCandidates.length > 0
      ? Math.round(
          uiCandidates.reduce((s, c) => s + c.aesthetics, 0) /
            uiCandidates.length
        )
      : 0;
  const avgHarmony =
    uiCandidates.length > 0
      ? Math.round(
          uiCandidates.reduce((s, c) => s + c.harmony, 0) / uiCandidates.length
        )
      : 0;
  const avgFinal =
    uiCandidates.length > 0
      ? Math.round(
          uiCandidates.reduce((s, c) => s + c.finalScore, 0) /
            uiCandidates.length
        )
      : 0;

  const analysisInputs: string[] = [];
  if (fatherFull) analysisInputs.push(`아버지 ${fatherFull}`);
  if (motherFull) analysisInputs.push(`어머니 ${motherFull}`);
  if (inputs.storyKeyword) analysisInputs.push(`키워드 "${inputs.storyKeyword}"`);

  const parentCategory = {
    type: "parent-based",
    label: "부모 기반",
    description:
      "부모님 이름·서사를 분석해 자녀에게 어울리는 결을 골라드렸어요.",
    engineUsed: "ParentBasedNamingEngine",
    totalInCategory: uiCandidates.length,
    names: uiCandidates,
    parentMeta: {
      modelsAvailable,
      analysisInputs,
      averageScores: {
        aesthetics: avgAesthetics,
        harmony: avgHarmony,
        final: avgFinal,
      },
    },
  };

  return {
    totalCount: uiCandidates.length,
    categories: [parentCategory],
    topPick: uiCandidates[0] ?? null,
    requestSummary,
  };
}

// ============================================================
// 메인 페이지
// ============================================================
export default function ParentBasedPage() {
  const [babySurname, setBabySurname] = useState("");
  const [fatherSurname, setFatherSurname] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherSurname, setMotherSurname] = useState("");
  const [motherName, setMotherName] = useState("");
  const [storyKeyword, setStoryKeyword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("none");
  const [tone, setTone] = useState("neutral");

  const [results, setResults] = useState<ParentBasedCandidate[]>([]);
  const [hasResult, setHasResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!babySurname.trim()) {
      setError("자녀 성씨를 입력해주세요.");
      return;
    }
    if (!fatherName.trim() && !motherName.trim() && !storyKeyword.trim()) {
      setError(
        "부모 이름 또는 스토리 키워드 중 하나는 입력해주세요."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setHasResult(false);

    try {
      const data = await parentBased({
        lastName: babySurname.trim(),
        fatherSurname: fatherSurname.trim() || undefined,
        fatherName: fatherName.trim() || undefined,
        motherSurname: motherSurname.trim() || undefined,
        motherName: motherName.trim() || undefined,
        storyKeyword: storyKeyword.trim() || undefined,
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
      setResults(data);
      setHasResult(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "요청 중 오류가 발생했어요."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResults([]);
    setHasResult(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ============================================================
  // 결과 화면 — 새 디자인 컴포넌트
  // ============================================================
  if (hasResult && results.length > 0) {
    const data = buildParentResultData(results, {
      babySurname,
      fatherSurname,
      fatherName,
      motherSurname,
      motherName,
      storyKeyword,
      birthDate,
      gender,
      tone,
    });
    return (
      <SmartResultParentPage
        data={data}
        editHref="/parent-based"
        onRegenerate={handleReset}
      />
    );
  }

  // ============================================================
  // 입력 폼 화면
  // ============================================================
  return (
    <>
      <Header current="search" />
      <div className="container mx-auto max-w-5xl px-4 py-12">
      {/* Hero */}
      <header className="mb-10 space-y-3 text-center">
        <p className="eyebrow">PARENT NAMING · 부모 기반</p>
        <h1 className="text-3xl md:text-4xl font-medium leading-snug tracking-tight text-navy">
          가족의 결을 잇는 이름
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          부모님의 이름·서사를 분석해 자녀에게 어울리는 이름을 골라드릴게요
        </p>
      </header>

      {/* Input Form */}
      <Card className="mb-8 border-paper-line bg-paper-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-navy">기본 정보</CardTitle>
          <CardDescription>
            자녀 성씨와 부모 정보를 입력해주세요. 부모 이름 또는 스토리
            키워드 중 하나는 필수예요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 자녀 정보 */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-medium text-navy/70">
                자녀 정보
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="babySurname">자녀 성씨</Label>
                  <Input
                    id="babySurname"
                    placeholder="예: 김"
                    value={babySurname}
                    onChange={(e) => setBabySurname(e.target.value)}
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
                <div className="space-y-2 sm:col-span-2">
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
              </div>
            </fieldset>

            {/* 부모 정보 */}
            <fieldset className="space-y-4 border-t border-paper-line pt-5">
              <legend className="text-sm font-medium text-navy/70">
                부모 정보
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-paper-line bg-paper-card/60 p-4">
                  <p className="text-xs font-medium text-navy/70">
                    👨 아버지
                  </p>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Input
                      placeholder="성"
                      className="w-16"
                      value={fatherSurname}
                      onChange={(e) => setFatherSurname(e.target.value)}
                    />
                    <Input
                      placeholder="이름"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-paper-line bg-paper-card/60 p-4">
                  <p className="text-xs font-medium text-navy/70">
                    👩 어머니
                  </p>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Input
                      placeholder="성"
                      className="w-16"
                      value={motherSurname}
                      onChange={(e) => setMotherSurname(e.target.value)}
                    />
                    <Input
                      placeholder="이름"
                      value={motherName}
                      onChange={(e) => setMotherName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* 스토리 키워드 */}
            <fieldset className="space-y-2 border-t border-paper-line pt-5">
              <Label htmlFor="storyKeyword">
                스토리 키워드 <span className="text-muted-foreground">(선택)</span>
              </Label>
              <Input
                id="storyKeyword"
                placeholder="예: 사랑, 희망, 빛"
                maxLength={50}
                value={storyKeyword}
                onChange={(e) => setStoryKeyword(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                자녀에게 담고 싶은 의미·결을 한두 단어로 표현해주세요
              </p>
            </fieldset>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "추천 생성 중..." : "부모 이름 기반 추천받기"}
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

      {/* Empty state — has result but 0 candidates */}
      {hasResult && results.length === 0 && (
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
