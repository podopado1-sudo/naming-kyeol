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
import { josa } from "@/lib/josa";
import type { RareSurnameResponse } from "@/lib/types";
import {
  evaluateHref,
  normalizeGender,
  normalizeTone,
} from "@/app/evaluate/evaluate-params";
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

/** 백엔드 /recommendations/rare-surname 은 생년월일이 없으면 400 — 제출 전에 막고 이 문장을 오류 상자에 보인다 */
const BIRTH_DATE_MISSING = "생년월일을 입력해 주세요.";

// ============================================================
// 어댑터: RareSurnameResponse → RareResultData
// ============================================================

/**
 * hanjaOptions 한 칸 → 글자·뜻. 백엔드 형식은 `${글자}(${사전 뜻})` — RareSurnameEngine.FindHanjaOptions 가 이름 음절마다
 * HanjaSelector.TopForDisplay 상위 3자를 음절 순서대로 이어 붙인 평평한 목록이다(첫 칸 = 첫 음절의 대표 한자).
 * 뜻 안에도 괄호가 올 수 있어("연꽃 련(연)") 첫 '(' 앞을 글자, 첫 '(' 와 마지막 ')' 사이를 뜻으로 본다.
 * 형식이 다르면 통째로 글자 칸에 두고 뜻은 비운다(뜻 자리를 그리지 않는다).
 * 옛 어댑터는 문자열 하나를 글자·뜻 양쪽에 넣어 카드에 '美(아름다울 미) · 美(아름다울 미)'가 찍혔다(2026-10-28)
 */
function parseHanjaOption(opt: string): { char?: string; meaning: string } {
  const raw = opt.trim();
  const m = /^([^(]+)\((.*)\)$/.exec(raw);
  if (!m) return { char: raw || undefined, meaning: "" };
  return { char: m[1].trim(), meaning: m[2].trim() };
}

/** harmonyReason 은 ScoreCandidateCore 의 근거 문장들을 '; '로 이은 한 줄 — 나눠 목록 한 벌로 보인다 */
function splitHarmonyReason(reason: string | undefined): string[] {
  return (reason ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildRareResultData(
  response: RareSurnameResponse,
  inputs: { birthDate: string; birthTime: string; gender: string; tone: string }
): RareResultData {
  const isCompound = response.lastName.length >= 2;

  // 후보 변환 — backend의 RareSurnameCandidate에서 RareUICandidate로.
  // 이 엔진이 주는 점수는 성씨 발음 조화(harmonyScore) 하나뿐이다. 미학·종합·희귀도 매칭 점수는 응답에 없어
  // 화면에 그리지 않는다(2026-10-28 — 옛 어댑터가 순위로 미학 70~92·희귀도 90/75를 지어내 별 75~90개가 찍혔다).
  // 그 자리는 같은 조건의 /evaluate 링크(실제 미학·조화 평가)로 바꿨다.
  const uiCandidates: RareUICandidate[] = response.candidates.map((c) => {
    const name = c.name || c.fullName.slice(response.lastName.length);
    return {
      fullName: c.fullName,
      harmonyScore: c.harmonyScore,
      // 옛 reasons = [harmonyReason] 은 펼침에서 같은 한 줄을 금색 상자와 목록에 두 번 그렸다 — 항목별로 나눠 한 번만
      reasons: splitHarmonyReason(c.harmonyReason),
      // 옛 고정 ["희귀 성씨"]는 김·이 같은 흔한 성씨 카드에도 붙었다 — 응답 isRareSurname(희귀 단계 3 이상)일 때만
      tags: response.isRareSurname ? ["희귀 성씨"] : [],
      hanjaOptions: (c.hanjaOptions || []).map((opt, idx) => ({
        ...parseHanjaOption(opt),
        isDefault: idx === 0,
      })),
      phonologyNotes: [],
      // 성별 'none'·톤 'neutral'은 기본값이라 링크에서 뺀다. 시각은 날짜가 있을 때만(evaluateHref 규칙)
      evaluateHref: evaluateHref(
        {
          lastName: response.lastName,
          name,
          birthDate: inputs.birthDate,
          birthTime: inputs.birthTime,
          gender: normalizeGender(inputs.gender),
          tone: normalizeTone(inputs.tone),
        },
        { withBirth: true }
      ),
    };
  });

  // 배너의 '평균 발음 조화' — 응답 harmonyScore 의 평균(결과 화면은 후보가 1개 이상일 때만 그린다)
  const avgHarmony =
    uiCandidates.length > 0
      ? Math.round(
          uiCandidates.reduce((s, c) => s + c.harmonyScore, 0) /
            uiCandidates.length
        )
      : 0;

  // 성씨 분석 — 발음 분석 문장은 backend phoneticAnalysis 그대로. 고려사항·발음 패턴은 엔진이 실제로 하는 일만 적는다
  // (RareSurnameEngine: GenerateNameCandidates 는 두 글자 이름만 만든다 — 외자 없음. ScoreCandidateCore 는 성씨 끝 글자와
  //  이름 첫소리 연결·성+이름 초성 다양성·전체 리듬·음절 길이로 발음 조화를 매긴다). 옛 문구는 외자 이름 배치·종성 조절·
  //  '이름이 튀지 않게 균형'·의미 선별처럼 엔진에 없는 일을 말했고, 흔한 성씨(김)에도 '단음 희귀형'이라 했다(2026-10-28)
  const lastChar = response.lastName.slice(-1);
  const totalSyllables = isCompound ? "네" : "세";
  const surnameAnalysis: RareSurnameAnalysis = {
    hanja: undefined,
    phoneticAnalysis:
      response.phoneticAnalysis || "성씨 발음 분석 정보를 불러올 수 없었어요.",
    considerations: [
      `성씨 끝 글자 '${lastChar}'${josa(lastChar, "과/와")} 이름 첫 글자가 이어지는 소리를 점수에 넣었어요.`,
      `성과 이름 ${totalSyllables} 글자의 첫소리(초성)가 서로 겹치지 않는지, 이어 읽을 때 리듬이 고른지도 함께 봤어요.`,
    ],
    pattern: isCompound ? "복성 · 두 글자 이름" : "단성 · 두 글자 이름",
    patternDetail: isCompound
      ? "두 글자 성 뒤에 두 글자 이름을 붙여 네 글자로 읽혀요(외자 이름은 만들지 않아요)."
      : "한 글자 성 뒤에 두 글자 이름을 붙여 세 글자로 읽혀요.",
    strategies: [
      {
        key: "phonetic",
        label: "발음 균형",
        detail: "성씨 끝소리와 이름 첫소리가 부드럽게 이어지고, 같은 자음이 잇달아 나오지 않는 이름을 우선했어요.",
      },
      {
        // 옛 '희귀도 매칭'(성씨에 맞춰 흔하지 않은 이름 선별)은 엔진에 없는 단계였다 — 엔진이 실제로 거르는 것만 적는다
        // (RareSurnameEngine.GenerateNameCandidates: 유행 이름·금칙어·일반 낱말 충돌·부정 동음 제외)
        key: "filter",
        label: "유행 이름 제외",
        detail:
          "유행하는 이름, 금칙어나 일반 낱말과 겹치는 이름, 좋지 않은 말과 소리가 같은 이름은 후보에서 뺐어요.",
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
    // 탭·배너 제목 — 김·이처럼 흔한 성씨(isRareSurname 거짓)에 '희귀 성씨'라고 붙이지 않는다(옆 칩이 '희귀도 (흔함)')
    label: response.isRareSurname ? "희귀 성씨" : "성씨 맞춤",
    description: "성씨와의 발음 조화를 우선해 골랐어요.",
    engineUsed: "RareSurnameEngine",
    totalInCategory: uiCandidates.length,
    names: uiCandidates,
  };

  return {
    requestSummary,
    isRareSurname: response.isRareSurname,
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
  const birthDateMissing = error === BIRTH_DATE_MISSING;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lastName.trim()) {
      setError("성씨를 입력해주세요.");
      return;
    }
    // 생년월일 — 백엔드 필수(없으면 400 '생년월일은 필수이며 YYYY-MM-DD 형식이어야 합니다'). 날짜를 덜 채운 칸도 value 가 "" 다
    if (!birthDate) {
      setError(BIRTH_DATE_MISSING);
      document.getElementById("birthDate")?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await rareSurname({
        lastName: lastName.trim(),
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
    const data = buildRareResultData(result, {
      birthDate,
      birthTime,
      gender,
      tone,
    });
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
          성씨와 이어지는 소리를 기준으로 두 글자 이름을 골라드릴게요
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

              {/* 출생일 — 백엔드 필수(없으면 400). 표시는 옆 '(선택)'과 같은 꼴의 '(필수)'(/search·/required-char 와 같은 말).
                  네이티브 required 를 걸면 브라우저 말풍선이 먼저 떠 아래 오류 상자의 안내가 나오지 않아 aria-required 로 알린다 */}
              <div className="space-y-2">
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
                    if (e.target.value && birthDateMissing) setError(null);
                  }}
                  aria-required="true"
                  aria-invalid={birthDateMissing || undefined}
                  aria-describedby={
                    birthDateMissing ? "rare-surname-error" : undefined
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
        <div
          id="rare-surname-error"
          role="alert"
          className="mb-6 rounded-lg border border-amber-warm/50 bg-amber-50 p-4 text-sm text-amber-warm-700"
        >
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
