"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import type {
  RequiredCharCandidate,
  SmartNameCandidate,
  SmartRecommendationResponse,
} from "@/lib/types";
import {
  SmartResultPage,
  requiredCharMeaning,
  type RequestSummary,
} from "@/components/design/SmartResult";
import { useCandidateDetail } from "@/lib/useCandidateDetail";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

const POSITION_LABEL: Record<string, string> = {
  first: "첫글자",
  last: "끝글자",
  any: "어디든",
};

// ============================================================
// 어댑터: RequiredCharCandidate[] → SmartRecommendationResponse
//
// ⚠️ 응답은 후보 배열이다 ({names,totalCount} 객체가 아님). 5/19 출시부터 res.names로
// 읽어 늘 0개 → "추천 결과를 찾지 못했어요"만 뜨던 것을 2026-10-21에 바로잡았다.
// 매핑은 /search의 required-char 카테고리(SmartRecommendationService)와 같다:
// FullName=성+이름, 점수 없음, Tags=[필수:X 또는 항렬:X, 자리, ...한자 옵션].
// ============================================================
function wrapAsSmartResponse(
  candidates: RequiredCharCandidate[],
  lastName: string,
  label: string
): SmartRecommendationResponse {
  const names: SmartNameCandidate[] = candidates.map((c) => ({
    name: c.name,
    fullName: lastName + c.name,
    // 뜻 줄은 이름 순서로, 음절마다 그 소리의 훈 하나만 (아준 → "맑을 아 + 준걸 준")
    meaning: requiredCharMeaning(c.name, c.position, c.hanjaOptions, c.meaning),
    tags: [
      c.fixedHanja ? `항렬:${c.fixedHanja}` : `필수:${c.requiredChar}`,
      POSITION_LABEL[c.position] ?? c.position,
      ...c.hanjaOptions,
    ],
    phonologyNotes: [],
  }));
  return {
    lastName,
    isRareSurname: false,
    categories: [
      {
        type: "required-char",
        label,
        engineUsed: "RequiredCharEngine",
        names,
      },
    ],
    totalCount: names.length,
    // 엔진이 점수순으로 정렬해 보낸다 — 첫 후보가 1위
    topPick: names.length
      ? {
          categoryType: "required-char",
          categoryLabel: label,
          candidate: names[0],
        }
      : null,
  };
}

/**
 * CJK 한자 여부 (기본 + 확장A + 호환 영역).
 * 범위는 반드시 \u 이스케이프로 쓴다 — 호환 한자 U+F900을 글자 그대로 적으면 편집 도구의 NFC 정규화가
 * 통합 한자 U+8C48로 바꿔 범위가 U+8C48~U+FAFF가 되고, 한글 음절(U+AC00~)까지 전부 한자로 판정된다
 * (2026-10-21 실사고 — '서'가 requiredHanja로 가서 결과 0개).
 */
function isHanjaChar(ch: string): boolean {
  return /^[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]$/.test(ch);
}

function RequiredCharForm({
  onResultChange,
}: {
  /** 결과 화면(SmartResultPage)으로 바뀌는지 — 바깥의 헤더·소개·푸터를 숨기는 데 쓴다 */
  onResultChange: (showingResult: boolean) => void;
}) {
  const [lastName, setLastName] = useState("");
  const navDetail = useCandidateDetail();
  const [reqChar, setReqChar] = useState("");

  // /hanja 사전 페이지 CTA에서 ?char=潤 / ?char=윤 형태로 진입 시 프리필
  const searchParams = useSearchParams();
  useEffect(() => {
    const prefill = searchParams.get("char");
    // BMP 밖(확장 B 이후, 코드포인트 > 0xFFFF) 글자는 백엔드가 한 글자로 받지 못해 400이 난다 —
    // 프리필하지 않는다 (한자 사전 상세도 이런 글자에는 추천 버튼을 숨긴다)
    if (
      prefill &&
      [...prefill].length === 1 &&
      (prefill.codePointAt(0) ?? 0) <= 0xffff
    )
      setReqChar(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [position, setPosition] = useState("any");
  const [birthDate, setBirthDate] = useState("");
  const [birthDateError, setBirthDateError] = useState(false);
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("none");
  const [tone, setTone] = useState("neutral");

  const [result, setResult] = useState<SmartRecommendationResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 결과 상태와 바깥 화면 전환을 한 번에 바꾼다 (같은 렌더에 묶여 깜빡임 없음)
  function showResult(next: SmartRecommendationResponse | null) {
    setResult(next);
    onResultChange(next !== null && next.totalCount > 0);
  }

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
    // 출생일 — 백엔드 필수(부족한 오행 계산), 누락 시 400이라 제출 전 검증
    if (!birthDate) {
      setBirthDateError(true);
      setError(null);
      document.getElementById("birthDate")?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    showResult(null);
    try {
      const trimmedChar = reqChar.trim();
      const isHanja = isHanjaChar(trimmedChar);
      const data = await requiredChar({
        lastName: lastName.trim(),
        // 한자 입력이면 항렬자 모드 — 발음은 백엔드가 한자의 음으로 자동 도출
        requiredChar: isHanja ? "" : trimmedChar,
        requiredHanja: isHanja ? trimmedChar : undefined,
        position,
        birthDate,
        birthTime: birthTime || undefined,
        // 엔진이 소문자로 비교하므로 그대로 전달 — "Male"·"Soft"로 보내면 컨트롤러
        // 검증은 통과하지만 성별·톤 필터와 가점이 통째로 빠진다 (2026-10-21 실측)
        gender: gender === "none" ? undefined : gender,
        tone,
      });
      showResult(
        wrapAsSmartResponse(
          Array.isArray(data) ? data : [],
          lastName.trim(),
          isHanja ? "항렬자 이름" : "필수 글자 이름"
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "요청 중 오류가 발생했어요."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    showResult(null);
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
    const ctx = { birthDate, birthTime, gender, tone };
    return (
      <SmartResultPage
        data={result}
        requestSummary={requestSummary}
        editHref="/required-char"
        onRegenerate={handleReset}
        onCandidateDetail={(fn) => navDetail(lastName, fn, ctx)}
        favoriteContext={ctx}
      />
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4">
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

            {/* 출생일 — 백엔드 필수(부족한 오행 계산), 누락 시 400이라 제출 전 검증 */}
            <div className="space-y-2">
              <Label htmlFor="birthDate">
                출생일{" "}
                <span className="text-[10px] text-muted-foreground">
                  (필수 · 오행 보완 반영)
                </span>
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => {
                  setBirthDate(e.target.value);
                  if (e.target.value) setBirthDateError(false);
                }}
                required
                aria-invalid={birthDateError || undefined}
                className={cn(
                  birthDateError &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {birthDateError && (
                <p className="text-xs text-destructive" role="alert">
                  출생일을 입력해주세요. 부족한 오행을 채우는 글자를 고르는 데
                  필요해요.
                </p>
              )}
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
        <div className="mb-8 rounded-2xl border border-paper-line bg-paper-card p-10 text-center shadow-sm">
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
  );
}

/** 폼이 클라이언트에서 그려지기 전 자리 — 아래 소개·푸터가 밀려 내려오지 않게 높이만 잡는다 */
function FormFallback() {
  return (
    <div className="container mx-auto max-w-4xl px-4">
      <div
        aria-hidden
        className="mb-8 min-h-[26rem] rounded-xl border border-paper-line bg-paper-card shadow-sm"
      />
    </div>
  );
}

/** 정적 HTML에 그대로 나가는 도구 소개 — 무엇을 어떻게 보는지 (과장·단정 금지) */
function RequiredCharIntro() {
  return (
    <section
      aria-labelledby="required-char-intro"
      className="container mx-auto max-w-4xl px-4 pb-12"
    >
      <div className="mx-auto max-w-2xl space-y-3 border-t border-paper-line pt-8 text-sm leading-relaxed text-muted-foreground">
        <h2
          id="required-char-intro"
          className="text-base font-medium text-navy"
        >
          필수 글자 추천은 이렇게 골라요
        </h2>
        <p>
          돌림자처럼 꼭 넣고 싶은 한 글자를 정하면, 그 글자를 첫 글자나 끝
          글자에 둔 두 글자 이름을 골라드려요. 한글로 넣으면 같은 소리의 한자
          후보를 함께 보여드리고, 한자로 넣으면 그 한자를 항렬자로 고정해요.
        </p>
        <p>
          짝이 되는 글자는 성씨와 이어 부를 때의 흐름, 두 글자의 리듬과 초성의
          다양성, 오행의 어울림을 함께 따져 고르고, 유행 이름이나 흔한 낱말과
          겹치는 이름은 처음부터 빼요. 출생일로 계산한 사주에서 부족한 오행의
          한자에는 가점을 주지만, 여러 기준 가운데 하나일 뿐이에요.
        </p>
        <p>
          결과에 보이는 한자는 고를 수 있는 후보예요. 글자의 뜻과 획수는{" "}
          <Link
            href="/hanja"
            className="text-navy underline underline-offset-4"
          >
            인명용 한자 사전
          </Link>
          에서, 이름 전체의 점수와 근거는{" "}
          <Link
            href="/evaluate"
            className="text-navy underline underline-offset-4"
          >
            이름 평가
          </Link>
          에서 확인할 수 있어요.
        </p>
      </div>
    </section>
  );
}

export default function RequiredCharPage() {
  const [showingResult, setShowingResult] = useState(false);
  return (
    <>
      {!showingResult && (
        <>
          <Header current="search" />
          <div className="container mx-auto max-w-4xl px-4 pt-12">
            <header className="mb-10 space-y-3 text-center">
              <p className="eyebrow">REQUIRED CHARACTER · 필수 글자</p>
              <h1 className="text-3xl md:text-4xl font-medium leading-snug tracking-tight text-navy">
                꼭 넣고 싶은 한 글자에서 시작하는 이름
              </h1>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                돌림자나 특별히 담고 싶은 글자가 있으면, 그 글자가 자연스럽게
                어울리는 이름만 골라드릴게요
              </p>
            </header>
          </div>
        </>
      )}
      {/* useSearchParams(?char=)는 정적 렌더링 시 Suspense 경계가 필요 — 폼만 감싸서
          헤더·제목·소개·푸터는 정적 HTML에 그대로 나가게 한다 */}
      <Suspense fallback={<FormFallback />}>
        <RequiredCharForm onResultChange={setShowingResult} />
      </Suspense>
      {!showingResult && (
        <>
          <RequiredCharIntro />
          <Footer />
        </>
      )}
    </>
  );
}
