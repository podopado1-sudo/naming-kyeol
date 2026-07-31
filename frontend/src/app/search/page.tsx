"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

import { EmptyState } from "@/components/results/EmptyState";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import {
  SmartResultPage,
  type RequestSummary,
} from "@/components/design/SmartResult";
import { cn } from "@/lib/utils";
import { smart } from "@/lib/api";
import type {
  SmartRecommendationRequest,
  SmartRecommendationResponse,
} from "@/lib/types";

const HERO_SUBLINES = [
  "좋은 소리는 결이 다릅니다. 부를수록 깊어지는 이름.",
  "유행을 타지 않는 클래식, 이름의 결에서 발견하세요.",
  "입술 끝에서 시작되어 마음속 깊이 남는 울림.",
  "결이 고운 이름은 시간이 흐를수록 그 가치를 증명합니다.",
];

function BabyNamingInner() {
  const searchParams = useSearchParams();

  function handleCandidateDetail(fullName: string) {
    // fullName = lastName + firstName (예: "허기태"). 분리해서 /evaluate로 이동.
    // 추천 요청의 컨텍스트(생일·시간·성별·톤)도 함께 전달 → 자동 평가
    const ln = lastName.trim();
    const first = ln && fullName.startsWith(ln) ? fullName.slice(ln.length) : fullName;
    const params = new URLSearchParams();
    if (ln) params.set("lastName", ln);
    if (first) params.set("name", first);
    if (birthDate) params.set("birthDate", birthDate);
    if (birthTime) params.set("birthTime", birthTime);
    if (gender) params.set("gender", gender);
    if (tone) params.set("tone", tone);
    // router.push 대신 풀 페이지 이동 — /evaluate는 정적(○) 라우트라 클라이언트
    // 라우터 캐시가 이전에 방문한 ?name=... 항목을 그대로 내놓아(다른 이름인데
    // 직전 평가 이름이 표시되던 버그) searchParams가 갱신되지 않는 문제를 우회.
    window.location.assign(`/evaluate?${params.toString()}`);
  }

  // ---- hero subline rotation ----
  const [subIndex, setSubIndex] = useState(0);
  const [subVisible, setSubVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setSubVisible(false);
      setTimeout(() => {
        setSubIndex((i) => (i + 1) % HERO_SUBLINES.length);
        setSubVisible(true);
      }, 500);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // ---- form state (Hero에서 query로 들어오면 초기값 사용) ----
  const initialGender = (() => {
    const g = searchParams.get("gender");
    if (g === "male" || g === "female") return g;
    return "none";
  })();
  const initialTone = (() => {
    const t = searchParams.get("tone");
    if (t === "soft" || t === "strong") return t;
    return "neutral";
  })();
  const queryParentName = searchParams.get("parentName") ?? "";
  const queryEnglishName = searchParams.get("englishName") ?? "";
  // story 키워드는 현재 이 폼에 없어 무시 (parent-based는 별도 페이지)

  const [lastName, setLastName] = useState(searchParams.get("lastName") ?? "");
  const [gender, setGender] = useState(initialGender);
  const [birthDate, setBirthDate] = useState(searchParams.get("birthDate") ?? "");
  const [birthDateError, setBirthDateError] = useState(false);
  const [birthTime, setBirthTime] = useState(searchParams.get("birthTime") ?? "");
  const [tone, setTone] = useState(initialTone);

  // 용신 기반 추천 파라미터
  const preferredElement = searchParams.get("preferredElement") ?? undefined;

  // toggles
  const [includePureKorean, setIncludePureKorean] = useState(true);
  const [includeThreeSyllable, setIncludeThreeSyllable] = useState(true);
  const [includeCreative, setIncludeCreative] = useState(true);
  const [includeTwin, setIncludeTwin] = useState(false);
  // 부모 이름이 들어오면 parent-based 토글 자동 켜기
  const [includeParentBased, setIncludeParentBased] = useState(
    Boolean(queryParentName)
  );
  // 영어 이름이 들어오면 dual-name 토글 자동 켜기
  const [includeDualName, setIncludeDualName] = useState(
    Boolean(queryEnglishName)
  );
  const [includeRequiredChar, setIncludeRequiredChar] = useState(false);

  // conditional fields
  const [fatherName, setFatherName] = useState(queryParentName);
  const [motherName, setMotherName] = useState("");
  const [englishName, setEnglishName] = useState(queryEnglishName);
  const [requiredChar, setRequiredChar] = useState("");
  const [requiredCharPosition, setRequiredCharPosition] = useState("any");
  // 항렬자 한자 (선택) — 형제자매 공유 한자
  const [requiredHanja, setRequiredHanja] = useState("");
  // 의미 선호 키워드 — 입력은 콤마/공백 구분 문자열, 요청 시 배열로 분해
  const [preferredMeaningsInput, setPreferredMeaningsInput] = useState("");

  // submission
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SmartRecommendationResponse | null>(null);

  function handleReset() {
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function runRecommend() {
    if (!lastName.trim()) {
      toast.error("성씨를 입력해주세요.");
      return;
    }

    if (!birthDate) {
      setBirthDateError(true);
      toast.error("생년월일을 입력해주세요.");
      document.getElementById("birthDate")?.focus();
      return;
    }

    const req: SmartRecommendationRequest = {
      lastName: lastName.trim(),
      // 백엔드가 소문자로 비교하므로 그대로 전달 (대문자로 변환 시 gender/tone 보너스 누락)
      gender: gender === "none" ? undefined : gender,
      birthDate: birthDate || undefined,
      birthTime: birthTime || undefined,
      preferredFiveElement: preferredElement,
      tone: tone,
      includePureKorean,
      includeThreeSyllable,
      includeCreative,
      includeTwin,
      includeParentBased,
      includeDualName,
      includeRequiredChar,
      fatherName: includeParentBased && fatherName ? fatherName : undefined,
      motherName: includeParentBased && motherName ? motherName : undefined,
      englishName: includeDualName && englishName ? englishName : undefined,
      requiredChar:
        includeRequiredChar && requiredChar ? requiredChar : undefined,
      requiredCharPosition:
        includeRequiredChar && requiredCharPosition !== "any"
          ? requiredCharPosition
          : undefined,
      requiredHanja:
        includeRequiredChar && requiredHanja.trim() ? requiredHanja.trim() : undefined,
      preferredMeanings: (() => {
        const parsed = preferredMeaningsInput
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        return parsed.length > 0 ? parsed : undefined;
      })(),
    };

    setLoading(true);
    setResult(null);

    try {
      const data = await smart(req);
      setResult(data);
      if (data.categories.length === 0) {
        toast.info("조건에 맞는 이름을 찾지 못했습니다.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "요청 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runRecommend();
  }

  // Hero에서 autoStart=1 + lastName 들어오면 자동 추천 (한 번만)
  const autoStart = searchParams.get("autoStart") === "1";
  useEffect(() => {
    if (autoStart && lastName.trim() && !result && !loading) {
      void runRecommend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // 결과 있으면 SmartResultPage 풀 페이지로 전환
  if (result) {
    if (result.categories.length === 0) {
      return (
        <div className="mx-auto w-full max-w-2xl px-4 py-8">
          <EmptyState />
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={handleReset}>
              조건 바꿔서 다시 추천받기
            </Button>
          </div>
        </div>
      );
    }
    const requestSummary: RequestSummary = {
      lastName: result.lastName || lastName,
      date: birthDate || undefined,
      gender:
        gender === "male" ? "남" : gender === "female" ? "여" : "성별 무관",
      tone:
        tone === "soft"
          ? "소프트 톤"
          : tone === "strong"
            ? "강한 톤"
            : "중립 톤",
      hanja: true,
      pureKorean: includePureKorean,
      creative: includeCreative,
    };
    return (
      <SmartResultPage
        data={result}
        requestSummary={requestSummary}
        editHref="/search"
        onRegenerate={handleReset}
        onCandidateDetail={handleCandidateDetail}
      />
    );
  }

  return (
    <>
      <Header current="search" />
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {/* Hero */}
      <header className="mb-12 space-y-4 text-center">
        <p className="eyebrow">NAMING · 이름 찾기</p>
        <h1
          className="text-3xl md:text-4xl font-bold leading-snug tracking-tight"
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--color-text)",
          }}
        >
          당신이라는 고유한 흐름이
          <br />
          아름다운 문장이 되도록.
        </h1>
        <p
          className={cn(
            "mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground transition-opacity duration-500",
            subVisible ? "opacity-100" : "opacity-0"
          )}
        >
          {HERO_SUBLINES[subIndex]}
        </p>
      </header>

      {/* 용신 적용 중 배너 */}
      {preferredElement && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-teal/30 bg-teal-50 px-4 py-3 text-sm text-teal-700">
          <span className="text-lg text-teal">✦</span>
          <div>
            <span className="font-semibold">
              용신 {preferredElement}(
              {["木", "火", "土", "金", "水"].includes(preferredElement)
                ? { 木: "목", 火: "화", 土: "토", 金: "금", 水: "수" }[preferredElement]
                : preferredElement}
              ) 적용 중
            </span>
            <span className="ml-2 text-teal">
              — 해당 오행 한자를 포함한 이름이 상위에 표시돼요.
            </span>
          </div>
        </div>
      )}

      {/* ===== Form ===== */}
      <form onSubmit={handleSubmit} className="sumi-form space-y-6">
        {/* 기본 정보 */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">기본 정보</legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 성씨 */}
            <div className="space-y-1.5">
              <Label htmlFor="lastName">성씨</Label>
              <Input
                id="lastName"
                placeholder="예: 김"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            {/* 성별 */}
            <div className="space-y-1.5">
              <Label>성별</Label>
              <Select value={gender} onValueChange={(v) => setGender(v ?? "none")}>
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

            {/* 생년월일 — 백엔드 필수(사주 조화 산정), 누락 시 400이라 제출 전 검증 */}
            <div className="space-y-1.5">
              <Label htmlFor="birthDate">
                생년월일 <span className="text-muted-foreground text-xs">(필수 · 조화 점수 반영)</span>
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
                className={cn(birthDateError && "border-destructive focus-visible:ring-destructive")}
              />
              {birthDateError && (
                <p className="text-xs text-destructive" role="alert">
                  생년월일을 입력해주세요. 조화 점수 계산에 필요해요.
                </p>
              )}
            </div>

            {/* 출생 시각 */}
            <div className="space-y-1.5">
              <Label htmlFor="birthTime">
                출생 시각 <span className="text-muted-foreground text-xs">(선택 · 시주 반영)</span>
              </Label>
              <Input
                id="birthTime"
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
            </div>

            {/* 톤 */}
            <div className="space-y-1.5">
              <Label>톤</Label>
              <Select value={tone} onValueChange={(v) => setTone(v ?? "neutral")}>
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
          </div>
        </fieldset>

        {/* 추가 옵션 — Accordion으로 접기 */}
        <Accordion>
          <AccordionItem value="options" className="border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold py-3">
              추가 옵션
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pb-2">
                <ToggleRow
                  label="순우리말 포함"
                  checked={includePureKorean}
                  onCheckedChange={setIncludePureKorean}
                />
                <ToggleRow
                  label="3글자 이름 포함"
                  checked={includeThreeSyllable}
                  onCheckedChange={setIncludeThreeSyllable}
                />
                <ToggleRow
                  label="창의적 작명 포함"
                  checked={includeCreative}
                  onCheckedChange={setIncludeCreative}
                />
                <ToggleRow
                  label="쌍둥이"
                  checked={includeTwin}
                  onCheckedChange={setIncludeTwin}
                />

                {/* 부모 이름 활용 */}
                <ToggleRow
                  label="부모 이름 활용"
                  checked={includeParentBased}
                  onCheckedChange={setIncludeParentBased}
                />
                {includeParentBased && (
                  <div className="grid grid-cols-1 gap-3 pl-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fatherName">아버지 이름</Label>
                      <Input
                        id="fatherName"
                        placeholder="예: 김철수"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="motherName">어머니 이름</Label>
                      <Input
                        id="motherName"
                        placeholder="예: 이영희"
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* 영어 이름 겸용 */}
                <ToggleRow
                  label="영어 이름 겸용"
                  checked={includeDualName}
                  onCheckedChange={setIncludeDualName}
                />
                {includeDualName && (
                  <div className="space-y-1.5 pl-4">
                    <Label htmlFor="englishName">영어 이름</Label>
                    <Input
                      id="englishName"
                      placeholder="예: Daniel"
                      value={englishName}
                      onChange={(e) => setEnglishName(e.target.value)}
                    />
                  </div>
                )}

                {/* 필수 글자 */}
                <ToggleRow
                  label="필수 글자"
                  checked={includeRequiredChar}
                  onCheckedChange={setIncludeRequiredChar}
                />
                {includeRequiredChar && (
                  <div className="space-y-3 pl-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="requiredChar">글자</Label>
                        <Input
                          id="requiredChar"
                          placeholder="예: 준"
                          value={requiredChar}
                          onChange={(e) => setRequiredChar(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>위치</Label>
                        <Select
                          value={requiredCharPosition}
                          onValueChange={(v) => setRequiredCharPosition(v ?? "any")}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">상관없음</SelectItem>
                            <SelectItem value="first">첫 번째</SelectItem>
                            <SelectItem value="last">마지막</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="requiredHanja">항렬자 (선택, 한자)</Label>
                      <Input
                        id="requiredHanja"
                        placeholder="예: 俊"
                        value={requiredHanja}
                        onChange={(e) => setRequiredHanja(e.target.value)}
                        maxLength={1}
                      />
                      <p className="text-xs text-muted-foreground">
                        형제자매가 공유하는 한자를 입력하면 해당 한자만 사용해 이름을
                        만들어요. 한글만 입력하면 일반 필수 글자로 동작합니다.
                      </p>
                    </div>
                  </div>
                )}

                {/* 의미 선호 키워드 — 한자 의미·카테고리와 매칭되면 가점 */}
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="preferredMeanings">담고 싶은 의미</Label>
                  <Input
                    id="preferredMeanings"
                    placeholder="예: 지혜, 용기, 맑음"
                    value={preferredMeaningsInput}
                    onChange={(e) => setPreferredMeaningsInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    콤마(,) 또는 공백으로 여러 개 입력. 한자의 뜻이나 카테고리와 매칭되면
                    가산점이 부여돼요.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />

        {/* 제출 — 수묵화 톤: 풀폭 + 명조 + 朱印 名 도장 */}
        <div style={{ position: "relative" }}>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
            style={{
              borderRadius: 0,
              padding: "18px",
              height: "auto",
              fontFamily: "var(--font-serif)",
              fontWeight: 700,
              letterSpacing: "0.1em",
              fontSize: 15,
            }}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "추천 생성 중..." : "이름 추천받기"}
          </Button>
          {/* 朱印 名 도장 — 로딩 중에는 숨김 (시각적 노이즈 방지) */}
          {!loading && (
            <span className="sumi-stamp-name" aria-hidden>名</span>
          )}
        </div>
      </form>

      </div>
      <Footer />
    </>
  );
}

export default function BabyNamingPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-2xl px-4 py-8 text-muted-foreground">로딩 중...</div>}>
      <BabyNamingInner />
    </Suspense>
  );
}

// ---- helper ----
function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="cursor-pointer">{label}</Label>
      <Switch
        checked={checked}
        onCheckedChange={(val) => onCheckedChange(val)}
      />
    </div>
  );
}
