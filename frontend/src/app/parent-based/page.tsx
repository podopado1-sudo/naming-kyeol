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

/**
 * 생년월일 — 백엔드 필수(POST parent-based 가 비면 400 '생년월일은 필수이며 YYYY-MM-DD 형식이어야 합니다').
 * 옛 폼은 출생일 칸을 선택처럼 두고 그대로 보내 백엔드 문구가 오류 상자에 떴다 — 제출 전에 막고 이 문구를 같은 상자에 보인다(2026-10-28)
 */
const BIRTH_DATE_REQUIRED = "생년월일을 입력해 주세요.";

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
// /evaluate 링크 — 후보 카드·첫 번째 후보의 '이 이름 평가하기'
// ============================================================
/**
 * 부모 기반 응답(ParentBasedCandidate)에는 점수가 없다 — name·namingModel·nameType·description 뿐.
 * 옛 어댑터는 후보 순서(인덱스)로 미학·조화·최종을, 고정값 50으로 희귀도를 지어내 점수처럼 보였다(2026-10-28 제거).
 * 점수는 평가 화면이 실제로 계산하니 이 화면의 입력을 그대로 넘긴다. 값이 있는 것만 넣고 성별 'none' 은 넣지 않는다
 * (app/favorites buildEvaluateUrl·app/search handleCandidateDetail 과 같은 꼴). 출생 시각은 생년월일과 함께일 때만 —
 * /evaluate 가 날짜 없는 시각을 버린다(evaluate-params timeWithDate)
 */
function buildEvaluateUrl(
  lastName: string,
  name: string,
  ctx: { birthDate: string; birthTime: string; gender: string; tone: string }
): string {
  const params = new URLSearchParams();
  if (lastName) params.set("lastName", lastName);
  if (name) params.set("name", name);
  if (ctx.birthDate) params.set("birthDate", ctx.birthDate);
  if (ctx.birthDate && ctx.birthTime) params.set("birthTime", ctx.birthTime);
  if (ctx.gender && ctx.gender !== "none") params.set("gender", ctx.gender);
  if (ctx.tone) params.set("tone", ctx.tone);
  return `/evaluate?${params.toString()}`;
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
    birthTime: string;
    gender: string;
    tone: string;
  }
): ParentResultData {
  // 요청에 보낸 성(trim)과 같은 값 — 이름(fullName)·평가 링크의 lastName 이 같은 성을 쓴다
  const surname = inputs.babySurname.trim();
  const uiCandidates: ParentUICandidate[] = candidates.map((c) => ({
    fullName: `${surname}${c.name}`,
    meaning: c.description || "",
    tags: c.nameType ? [c.nameType, c.namingModel] : [c.namingModel],
    reasons: c.description ? [c.description] : [],
    phonologyNotes: [],
    namingModel: detectNamingModel(c),
    parentLink: { anchor: c.namingModel },
    evaluateHref: buildEvaluateUrl(surname, c.name, inputs),
  }));

  const fatherFull =
    `${inputs.fatherSurname || ""}${inputs.fatherName || ""}`.trim();
  const motherFull =
    `${inputs.motherSurname || ""}${inputs.motherName || ""}`.trim();

  const requestSummary: ParentSummary = {
    lastName: surname,
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
    // 폼 순서(자녀 정보 → 부모 정보)대로 — 성씨 다음이 출생일
    if (!birthDate) {
      setError(BIRTH_DATE_REQUIRED);
      document.getElementById("birthDate")?.focus();
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
        birthDate,
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
      birthTime,
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
            자녀 성씨·출생일과 부모 정보를 입력해주세요. 부모 이름 또는
            스토리 키워드 중 하나는 필수예요.
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
                {/* 출생일 — 백엔드 필수. 표시는 이 폼의 '(선택)'·/required-char·/search 의 '(필수 · …)'와 같은 작은 글씨.
                    native required 는 달지 않는다 — 브라우저 말풍선이 먼저 떠 오류 상자의 '생년월일을 입력해 주세요.'가
                    나오지 않는다. 대신 aria-required, 빈 채로 제출해 그 오류가 떠 있는 동안 aria-invalid(테두리) */}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="birthDate">
                    출생일{" "}
                    <span className="text-[10px] text-muted-foreground">(필수)</span>
                  </Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => {
                      setBirthDate(e.target.value);
                      if (e.target.value && error === BIRTH_DATE_REQUIRED) setError(null);
                    }}
                    aria-required="true"
                    aria-invalid={
                      (error === BIRTH_DATE_REQUIRED && !birthDate) || undefined
                    }
                    aria-describedby={
                      error === BIRTH_DATE_REQUIRED && !birthDate ? "parent-based-error" : undefined
                    }
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
        <div
          id="parent-based-error"
          role="alert"
          className="mb-6 rounded-lg border border-amber-warm/50 bg-amber-50 p-4 text-sm text-amber-warm-700"
        >
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
