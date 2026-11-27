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
import { josa } from "@/lib/josa";
import {
  cleanNameInput,
  nameInputMessage,
  nameInputProblem,
  SURNAME_MAX_LENGTH,
} from "@/lib/name-input";
import { COMPOUND_SURNAMES } from "@/lib/name-split";
import type { ParentBasedCandidate } from "@/lib/types";
import {
  KEYWORD_HANGUL_REQUIRED,
  keywordHasHangul,
  parentLineage,
  parentTags,
} from "@/lib/parent-naming";
import {
  SmartResultParentPage,
  type NamingModelKey,
  type ParentResultData,
  type ParentSummary,
  type ParentUICandidate,
} from "@/components/design/SmartResultParent";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

// #region parent-form — 입력 다듬기·검사(순수 함수). tests/fix1127-parent-rare.test.mjs 가 이 구간을 떼어 돌린다 —
// 구간 안에는 JSX·import 를 두지 않는다(lib 함수는 테스트가 따로 import 해 넣는다)

/**
 * 생년월일 — 백엔드 필수(POST parent-based 가 비면 400 '생년월일은 필수이며 YYYY-MM-DD 형식이어야 합니다').
 * 옛 폼은 출생일 칸을 선택처럼 두고 그대로 보내 백엔드 문구가 오류 상자에 떴다 — 제출 전에 막고 이 문구를 같은 상자에 보인다(2026-10-28)
 */
const BIRTH_DATE_REQUIRED = "생년월일을 입력해 주세요.";

/**
 * 부모 이름 칸 글자 수 — 이름 칸은 성을 뺀 이름이 원칙이지만, 성 칸을 비우고 성까지 적은 이름(남궁민수)도 받는다
 * (엔진은 그 값을 그대로 이름으로 읽고 거르기 목록에만 나눠 더한다 — CLAUDE.md 부모 엔진 ⑨). 한 칸에 한 사람이라 띄어 쓴 두 이름은 없다.
 * 10 = 서버 계획(부모 이름 [StringLength] — '실제는 10이면 충분')·/evaluate 이름 칸과 같은 상한. 외자(철)도 받는다
 */
const PARENT_NAME_MAX_LENGTH = 10;

/** 폼 값 — 제출 때 다듬은 값(cleanParentForm)이 그대로 요청·결과 화면의 스냅샷이 된다 */
interface ParentFormValues {
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

type ParentFieldId =
  | "babySurname"
  | "birthDate"
  | "fatherSurname"
  | "fatherName"
  | "motherSurname"
  | "motherName"
  | "storyKeyword";

/** 성·이름은 NFC + 앞뒤 공백 제거(lib/name-input), 키워드는 앞뒤 공백만 — 나머지는 그대로 */
function cleanParentForm(raw: ParentFormValues): ParentFormValues {
  return {
    ...raw,
    babySurname: cleanNameInput(raw.babySurname),
    fatherSurname: cleanNameInput(raw.fatherSurname),
    fatherName: cleanNameInput(raw.fatherName),
    motherSurname: cleanNameInput(raw.motherSurname),
    motherName: cleanNameInput(raw.motherName),
    storyKeyword: raw.storyKeyword.trim(),
  };
}

/** 두 글자인데 복성 목록에 없는 성씨 — 성 + 이름 첫 글자('김민')나 '김씨'를 넣은 경우 */
function compoundSurnameMessage(label: string, value: string): string {
  return `${label} '${value}'${josa(value, "은/는")} 복성 목록(${COMPOUND_SURNAMES.join("·")})에 없어요. 성씨만 적어 주세요.`;
}

/** 성씨 칸(빈 칸이 아닐 때) — 한글 1~2자, 두 글자는 복성 목록(lib/name-split — 백엔드 SurnameData.TwoCharSurnames 와 같은 10개) */
function surnameFieldError(value: string, label: string): string | null {
  const problem = nameInputProblem(value, SURNAME_MAX_LENGTH);
  if (problem === "empty") return null;
  if (problem) return nameInputMessage(problem, label, SURNAME_MAX_LENGTH);
  if (value.length === 2 && !COMPOUND_SURNAMES.includes(value)) return compoundSurnameMessage(label, value);
  return null;
}

/** 부모 이름 칸(빈 칸이 아닐 때) — 한글 음절만, PARENT_NAME_MAX_LENGTH 자까지 */
function parentNameFieldError(value: string, label: string): string | null {
  const problem = nameInputProblem(value, PARENT_NAME_MAX_LENGTH);
  if (problem === "empty") return null;
  return problem ? nameInputMessage(problem, label, PARENT_NAME_MAX_LENGTH) : null;
}

/**
 * 제출 전 검사 — 첫 문제 하나(폼 순서: 자녀 성씨 → 출생일 → 아버지 → 어머니 → 부모 이름·키워드 중 하나 → 키워드 한글).
 * field 는 포커스·aria-invalid 를 둘 칸(부모 이름·키워드 중 하나가 없을 때는 어느 한 칸의 잘못이 아니라 null).
 * 옛 폼은 빈 값만 보아 부모 이름 'Minsu'·'金 民秀', 자녀 성씨 'Kim'·'김민'이 그대로 가서 부모 이름과 무관한 후보를
 * '부모님 이름을 분석했어요'로 보였고, 칸에 길이 제한이 없어 붙여 넣은 긴 글도 서버로 갔다(2026-11-27)
 */
function parentFormError(v: ParentFormValues): { field: ParentFieldId | null; message: string } | null {
  if (!v.babySurname) return { field: "babySurname", message: "자녀 성씨를 입력해주세요." };
  const baby = surnameFieldError(v.babySurname, "자녀 성씨");
  if (baby) return { field: "babySurname", message: baby };
  // 폼 순서(자녀 정보 → 부모 정보)대로 — 성씨 다음이 출생일
  if (!v.birthDate) return { field: "birthDate", message: BIRTH_DATE_REQUIRED };
  const checks: [ParentFieldId, string | null][] = [
    ["fatherSurname", surnameFieldError(v.fatherSurname, "아버지 성씨")],
    ["fatherName", parentNameFieldError(v.fatherName, "아버지 이름")],
    ["motherSurname", surnameFieldError(v.motherSurname, "어머니 성씨")],
    ["motherName", parentNameFieldError(v.motherName, "어머니 이름")],
  ];
  for (const [field, message] of checks) if (message) return { field, message };
  if (!v.fatherName && !v.motherName && !v.storyKeyword) {
    return { field: null, message: "부모 이름 또는 스토리 키워드 중 하나는 입력해주세요." };
  }
  if (v.storyKeyword && !keywordHasHangul(v.storyKeyword)) {
    return { field: "storyKeyword", message: KEYWORD_HANGUL_REQUIRED };
  }
  return null;
}
// #endregion parent-form

// ============================================================
// 작명 모델 분류 — 방식 코드 → 칩 표(lib/parent-naming.ts), 모르는 코드만 nameType 부분 문자열
// (옛 분류는 nameType 만 봐서 '가족 서사형'이 나올 수 없었다 — 2026-10-28)
// ============================================================
function detectNamingModel(c: ParentBasedCandidate): NamingModelKey {
  return parentLineage(c.namingModel, c.nameType);
}

// ============================================================
// /evaluate 링크 — 후보 카드·첫 번째 후보의 '이 이름 평가하기'
// ============================================================
/**
 * 부모 기반 응답(ParentBasedCandidate)에는 점수가 없다 — name·namingModel·namingLabel·nameType·description·hanja(뜻 잇기 방식만).
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
  /** 제출 때 다듬은 값(스냅샷) — 살아 있는 폼 값이 아니다 */
  inputs: ParentFormValues
): ParentResultData {
  // 요청에 보낸 성(trim)과 같은 값 — 이름(fullName)·평가 링크의 lastName 이 같은 성을 쓴다
  const surname = inputs.babySurname.trim();
  // 태그는 사용자 라벨 하나(옛 태그는 nameType + 방식 값 — 실존 인물로 보일 수 있는 '…모델' 이름이 칩으로 떴다).
  // hanjaName 은 설명이 풀이한 한자(뜻 잇기 방식만) — 첫 번째 후보가 의미 계승형이면 배너 주석(부모 글자 → 한자)이 이 글자로 그려진다.
  // 옛 parentLink.anchor 는 방식 값이라 한자가 없어 주석이 늘 null 이었다.
  // reasons 는 비운다 — 설명은 카드 뜻 줄(meaning)에 이미 나오고, 같은 문장이 '이름의 결' 펼침에 한 번 더 나왔다(2026-10-28)
  const uiCandidates: ParentUICandidate[] = candidates.map((c) => ({
    fullName: `${surname}${c.name}`,
    hanjaName: c.hanja || undefined,
    meaning: c.description || "",
    tags: parentTags(c.namingLabel),
    reasons: [],
    phonologyNotes: [],
    namingModel: detectNamingModel(c),
    // 방식 코드 원값 — 배너의 '키워드 매핑' 칩을 키워드 방식 후보에만 붙인다(화면에 그대로 내지 않는다)
    namingCode: c.namingModel || undefined,
    evaluateHref: buildEvaluateUrl(surname, c.name, inputs),
  }));

  const fatherFull =
    `${inputs.fatherSurname || ""}${inputs.fatherName || ""}`.trim();
  const motherFull =
    `${inputs.motherSurname || ""}${inputs.motherName || ""}`.trim();
  // 배너 강조 글자는 성을 뺀 이름에서 찾는다 — 전체 이름에서 찾으면 아버지 성 '김'이 계승 글자로 칠해졌다.
  // 성도 따로 넘긴다 — 배너가 fullName 의 성 자리와 이름 자리를 가른다(머리글자 = 이름 첫 글자 — 복성 남궁민수 → '민')
  const fatherGiven = (inputs.fatherName || "").replace(/\s+/g, "");
  const motherGiven = (inputs.motherName || "").replace(/\s+/g, "");
  const fatherSurname = (inputs.fatherSurname || "").trim();
  const motherSurname = (inputs.motherSurname || "").trim();

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
      father: fatherFull
        ? { fullName: fatherFull, surname: fatherSurname || undefined, givenName: fatherGiven || undefined }
        : undefined,
      mother: motherFull
        ? { fullName: motherFull, surname: motherSurname || undefined, givenName: motherGiven || undefined }
        : undefined,
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
    // engineUsed 를 넘기지 않는다 — 배너가 'by ParentBasedNamingEngine'(내부 클래스 이름)을 찍었다(2026-10-28)
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
  const [submitted, setSubmitted] = useState<ParentFormValues | null>(null);
  const [hasResult, setHasResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 오류 상자의 문장이 가리키는 칸 — 그 칸에 aria-invalid·aria-describedby, 제출 때 포커스 */
  const [errorField, setErrorField] = useState<ParentFieldId | null>(null);

  /** 그 칸을 고치기 시작하면 그 칸의 오류를 걷는다(다시 제출할 때 다시 본다) */
  function clearFieldError(field: ParentFieldId) {
    if (errorField === field) {
      setError(null);
      setErrorField(null);
    }
  }
  const invalidProps = (field: ParentFieldId) => ({
    "aria-invalid": errorField === field || undefined,
    "aria-describedby": errorField === field ? "parent-based-error" : undefined,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 다듬은 값(NFC·앞뒤 공백 제거)으로 검사하고 그 값을 보낸다 — 같은 값이 결과 화면의 스냅샷(submitted)이 된다
    const values = cleanParentForm({
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
    const problem = parentFormError(values);
    if (problem) {
      setError(problem.message);
      setErrorField(problem.field);
      if (problem.field) document.getElementById(problem.field)?.focus();
      return;
    }

    setLoading(true);
    setError(null);
    setErrorField(null);
    setResults([]);
    setHasResult(false);

    try {
      const data = await parentBased({
        lastName: values.babySurname,
        fatherSurname: values.fatherSurname || undefined,
        fatherName: values.fatherName || undefined,
        motherSurname: values.motherSurname || undefined,
        motherName: values.motherName || undefined,
        storyKeyword: values.storyKeyword || undefined,
        birthDate: values.birthDate,
        birthTime: values.birthTime || undefined,
        gender:
          values.gender === "none"
            ? undefined
            : values.gender === "male"
              ? "Male"
              : "Female",
        tone:
          values.tone === "neutral"
            ? "Neutral"
            : values.tone === "soft"
              ? "Soft"
              : "Strong",
      });
      // 제출 때 값 — 응답을 기다리는 동안(콜드 스타트면 30초 안팎) 폼을 고쳐도 결과의 평가 링크·배너는 이 값으로 그린다
      setSubmitted(values);
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
  if (hasResult && results.length > 0 && submitted) {
    // 살아 있는 폼 값이 아니라 제출 때 잡은 값으로 — 옛 화면은 기다리는 사이 고친 값으로 평가 링크·배너를 만들었다(2026-11-27)
    const data = buildParentResultData(results, submitted);
    return <SmartResultParentPage data={data} onRegenerate={handleReset} />;
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
            {/* 응답을 기다리는 동안 세 묶음(fieldset disabled)의 입력을 잠근다 — 결과는 제출 때 값(submitted)으로 그리지만,
                고친 값이 반영된 것처럼 보이지 않게 */}
            {/* 자녀 정보 */}
            <fieldset disabled={loading} className="space-y-4">
              <legend className="text-sm font-medium text-navy/70">
                자녀 정보
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="babySurname">자녀 성씨</Label>
                  {/* 한글 1~2자(복성까지) — 칸도 2자에서 멈춘다. 검사는 제출 때 parentFormError */}
                  <Input
                    id="babySurname"
                    placeholder="예: 김"
                    maxLength={SURNAME_MAX_LENGTH}
                    value={babySurname}
                    onChange={(e) => {
                      setBabySurname(e.target.value);
                      clearFieldError("babySurname");
                    }}
                    required
                    {...invalidProps("babySurname")}
                  />
                </div>
                {/* Base UI Select 는 트리거(button)에 id 를 넘겨 라벨과 잇는다(components/ui/select.tsx 는 그대로) */}
                <div className="space-y-2">
                  <Label htmlFor="gender">성별</Label>
                  <Select
                    value={gender}
                    onValueChange={(v) => setGender(v ?? "none")}
                  >
                    <SelectTrigger id="gender" className="w-full">
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
                  <Label htmlFor="tone">톤</Label>
                  <Select
                    value={tone}
                    onValueChange={(v) => setTone(v ?? "neutral")}
                  >
                    <SelectTrigger id="tone" className="w-full">
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
                      if (e.target.value) clearFieldError("birthDate");
                    }}
                    aria-required="true"
                    aria-invalid={
                      (errorField === "birthDate" && !birthDate) || undefined
                    }
                    aria-describedby={
                      errorField === "birthDate" && !birthDate ? "parent-based-error" : undefined
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
            <fieldset disabled={loading} className="space-y-4 border-t border-paper-line pt-5">
              <legend className="text-sm font-medium text-navy/70">
                부모 정보
              </legend>
              {/* 칸마다 라벨(화면에는 '👨 아버지' 제목과 placeholder 가 보이니 라벨은 sr-only) — 옛 칸은 라벨이 없어
                  화면 읽기 프로그램이 placeholder '성'·'이름'만 읽었다(아버지·어머니 구분 없음) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div
                  role="group"
                  aria-labelledby="father-group-label"
                  className="space-y-2 rounded-lg border border-paper-line bg-paper-card/60 p-4"
                >
                  <p id="father-group-label" className="text-xs font-medium text-navy/70">
                    <span aria-hidden="true">👨 </span>아버지
                  </p>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Label htmlFor="fatherSurname" className="sr-only">아버지 성</Label>
                    <Input
                      id="fatherSurname"
                      placeholder="성"
                      className="w-16"
                      maxLength={SURNAME_MAX_LENGTH}
                      value={fatherSurname}
                      onChange={(e) => {
                        setFatherSurname(e.target.value);
                        clearFieldError("fatherSurname");
                      }}
                      {...invalidProps("fatherSurname")}
                    />
                    <Label htmlFor="fatherName" className="sr-only">아버지 이름</Label>
                    <Input
                      id="fatherName"
                      placeholder="이름"
                      maxLength={PARENT_NAME_MAX_LENGTH}
                      value={fatherName}
                      onChange={(e) => {
                        setFatherName(e.target.value);
                        clearFieldError("fatherName");
                      }}
                      {...invalidProps("fatherName")}
                    />
                  </div>
                </div>
                <div
                  role="group"
                  aria-labelledby="mother-group-label"
                  className="space-y-2 rounded-lg border border-paper-line bg-paper-card/60 p-4"
                >
                  <p id="mother-group-label" className="text-xs font-medium text-navy/70">
                    <span aria-hidden="true">👩 </span>어머니
                  </p>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Label htmlFor="motherSurname" className="sr-only">어머니 성</Label>
                    <Input
                      id="motherSurname"
                      placeholder="성"
                      className="w-16"
                      maxLength={SURNAME_MAX_LENGTH}
                      value={motherSurname}
                      onChange={(e) => {
                        setMotherSurname(e.target.value);
                        clearFieldError("motherSurname");
                      }}
                      {...invalidProps("motherSurname")}
                    />
                    <Label htmlFor="motherName" className="sr-only">어머니 이름</Label>
                    <Input
                      id="motherName"
                      placeholder="이름"
                      maxLength={PARENT_NAME_MAX_LENGTH}
                      value={motherName}
                      onChange={(e) => {
                        setMotherName(e.target.value);
                        clearFieldError("motherName");
                      }}
                      {...invalidProps("motherName")}
                    />
                  </div>
                </div>
              </div>
              {/* 엔진은 이름 칸을 성을 뺀 이름으로 읽는다 — 성 칸 없이 '김민수'를 넣으면 '김민수'가 이름이 된다
                  (옛 엔진은 성 칸이 빈 3자 이름을 성으로 나눠 '한울림'을 '한' + '울림'으로 읽었다 — 2026-10-28 에 /search 옛 꼴에만 남김) */}
              <p className="text-[10px] text-muted-foreground">
                성은 왼쪽 칸에, 이름 칸에는 성을 뺀 이름만 적어 주세요.
              </p>
            </fieldset>

            {/* 스토리 키워드 */}
            <fieldset disabled={loading} className="space-y-2 border-t border-paper-line pt-5">
              <Label htmlFor="storyKeyword">
                스토리 키워드 <span className="text-muted-foreground">(선택)</span>
              </Label>
              <Input
                id="storyKeyword"
                placeholder="예: 사랑, 희망, 빛"
                maxLength={50}
                value={storyKeyword}
                onChange={(e) => {
                  setStoryKeyword(e.target.value);
                  if (keywordHasHangul(e.target.value)) clearFieldError("storyKeyword");
                }}
                {...invalidProps("storyKeyword")}
              />
              <p className="text-[10px] text-muted-foreground">
                자녀에게 담고 싶은 의미·결을 한글 한두 단어로 표현해주세요
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
            다른 키워드나 부모 이름으로 다시 시도해주세요
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
