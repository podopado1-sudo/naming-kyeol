/**
 * /ohaeng 폼·결과 상태(클라이언트) — 생년월일(양력)·태어난 시각(선택)·출생지(선택)를 받아 POST /api/v1/saju/elements 를 부르고
 * 결과(OhaengResult)를 폼 아래에 그린다(2026-11 설계 docs/plan-ohaeng-2026-11.md §6-1·§6-2).
 *
 * 입력값을 남기지 않는다(개인정보처리방침 — tests/ohaeng-privacy.test.mjs 가 이 파일 원문을 본다):
 * - 값은 이 컴포넌트 상태와 요청 본문에만 있다. 주소창·브라우저 저장소·문서 제목에 넣지 않는다(/evaluate 와 다름).
 * - input·select 에 name 속성을 두지 않는다 — 하이드레이션 전에 제출되면 기본 GET 제출이 값을 주소 쿼리로 싣는다(/analysis 와 같은 방식).
 * - next/form 을 쓰지 않는다(입력값을 URL 쿼리로 보내는 컴포넌트 — node_modules/next/dist/docs 03-api-reference/02-components/form.md).
 *
 * 늦게 도착한 이전 응답이 새 결과를 덮지 않게 요청 번호(reqIdRef)를 둔다(EvaluateClient 와 같은 방식).
 *
 * 접근성(2026-11-19 반박 검토 — 설계 §16):
 * - 오류가 한 칸을 가리키면(problemField — 문장 머리 '생년월일'·'출생 시각'·'출생지') 그 칸에 aria-invalid 와 aria-describedby(오류 상자 id)를
 *   켜고, 그 칸을 고치면 오류와 함께 끈다(/dual-name·/parent-based·/rare-surname 과 같은 관례).
 * - 결과 영역을 aria-live 로 감싸지 않는다 — 원국·막대·한자 최대 60자를 화면 읽기 프로그램이 한꺼번에 읽어 내리고 포커스 이동 안내와 겹친다.
 *   결과가 뜨면 OhaengResult 가 제목(h2)으로 포커스를 옮기고, 짧은 상태 문장만 아래 role="status" 줄이 알린다.
 */
"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/design/Primitives";
import { OhaengResult } from "@/components/design/OhaengResult";
import { spField, spHelper, spLabel } from "@/components/design/SpecialtyPrimitives";
import { sajuElements } from "@/lib/api";
import { BIRTHPLACES } from "@/lib/birthplaces";
import {
  MIN_BIRTH_DATE,
  birthDateProblem,
  birthTimeProblem,
  buildElementsRequest,
  problemField,
  todayKst,
  type ProblemField,
} from "@/lib/ohaeng";
import type { SajuElementsResponse } from "@/lib/types";

/** 이 시간이 지나도 응답이 없으면 콜드스타트 안내로 바꾼다(60초에서 api.ts 가 끊는다) */
const SLOW_NOTICE_MS = 5_000;

const emptySubscribe = () => () => {};

interface Shown {
  id: number;
  data: SajuElementsResponse;
  birthDate: string;
  birthTime: string;
}

const selectStyle: CSSProperties = {
  ...spField,
  appearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' stroke='%235a6b7a' stroke-width='1.3' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 32,
};

export function OhaengClient() {
  const uid = useId();
  const dateId = `${uid}-date`;
  const timeId = `${uid}-time`;
  const placeId = `${uid}-place`;
  const timeHelpId = `${uid}-time-help`;
  const placeHelpId = `${uid}-place-help`;
  const errorId = `${uid}-error`;

  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthplaceCode, setBirthplaceCode] = useState("");

  const [shown, setShown] = useState<Shown | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 오류 문장이 가리키는 칸 — 그 칸의 aria-invalid·aria-describedby 를 켠다(문장이 떠 있는 동안만)
  const errorField: ProblemField | null = problemField(error);

  // 마지막 요청 번호 — 늦게 도착한 이전 응답이 새 결과를 덮지 않게 한다
  const reqIdRef = useRef(0);

  // 날짜 입력의 max(오늘, 한국 시간) — 서버 스냅샷은 undefined, 브라우저에서만 계산(하이드레이션 안전 — EvaluateInput DateInput 과 같은 방식)
  const today = useSyncExternalStore(emptySubscribe, () => todayKst(), () => undefined);

  const hasTime = birthTime.trim() !== "";

  /** 오류가 가리키는 칸을 고치면 그 오류를 지운다(다른 칸의 오류·칸 없는 오류는 그대로) */
  function clearErrorFor(field: ProblemField) {
    if (errorField === field) setError(null);
  }

  /** 칸의 aria-describedby — 도움말 id 에 오류 상자 id 를 (그 칸을 가리킬 때만) 덧붙인다 */
  const describedBy = (field: ProblemField, helpId?: string) =>
    [helpId, errorField === field ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  /** 오류가 가리키는 칸의 테두리 — 오류 상자 글자색(amber-warm-700, 흰 바탕 6.27:1 — 비텍스트 3:1 이상) */
  const invalidBorder = (field: ProblemField) =>
    errorField === field ? { border: "1px solid var(--color-amber-warm-700)" } : null;

  async function run() {
    const req = buildElementsRequest({ birthDate, birthTime, birthplaceCode });
    const id = ++reqIdRef.current;
    setShown(null);
    setError(null);
    setSlow(false);
    setLoading(true);
    try {
      const data = await sajuElements(req);
      if (id !== reqIdRef.current) return;
      setShown({ id, data, birthDate: req.birthDate, birthTime: req.birthTime ?? "" });
    } catch (err) {
      if (id !== reqIdRef.current) return;
      setError(err instanceof Error ? err.message : "오행을 세지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (id === reqIdRef.current) {
        setLoading(false);
        setSlow(false);
      }
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const problem = birthDateProblem(birthDate, today ?? todayKst()) ?? birthTimeProblem(birthTime);
    if (problem) {
      setError(problem);
      return;
    }
    void run();
  }

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <>
      {/* 결과가 떠 있으면 인쇄에서 폼을 뺀다(data-hide-print) — 결과가 1쪽부터 오게(머리말·설명 글은 page.tsx 의 data-hide-print-with-result) */}
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="부족한 오행 찾기 입력"
        data-hide-print={shown ? true : undefined}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          border: "1px solid var(--color-border)",
          padding: "22px 22px 20px",
        }}
      >
        <div
          className="nk-stack-mobile"
          style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}
        >
          <div>
            <label htmlFor={dateId} style={spLabel}>
              생년월일 (양력)
            </label>
            <input
              id={dateId}
              type="date"
              required
              min={MIN_BIRTH_DATE}
              max={today}
              value={birthDate}
              onChange={(e) => {
                setBirthDate(e.target.value);
                clearErrorFor("date");
              }}
              aria-invalid={errorField === "date" || undefined}
              aria-describedby={describedBy("date")}
              style={{ ...spField, ...invalidBorder("date") }}
            />
          </div>
          <div>
            <label htmlFor={timeId} style={spLabel}>
              태어난 시각 <span style={{ color: "var(--color-text-3)", fontWeight: 400 }}>(선택)</span>
            </label>
            <input
              id={timeId}
              type="time"
              value={birthTime}
              onChange={(e) => {
                setBirthTime(e.target.value);
                clearErrorFor("time");
              }}
              aria-invalid={errorField === "time" || undefined}
              aria-describedby={describedBy("time", timeHelpId)}
              style={{ ...spField, ...invalidBorder("time") }}
            />
            <p id={timeHelpId} style={spHelper}>
              모르면 비워 두세요. 시주를 빼고 여섯 글자로 셉니다.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label htmlFor={placeId} style={spLabel}>
            출생지 <span style={{ color: "var(--color-text-3)", fontWeight: 400 }}>(선택)</span>
          </label>
          <select
            id={placeId}
            value={birthplaceCode}
            onChange={(e) => {
              setBirthplaceCode(e.target.value);
              clearErrorFor("place");
            }}
            disabled={!hasTime}
            aria-invalid={errorField === "place" || undefined}
            aria-describedby={describedBy("place", placeHelpId)}
            style={{
              ...selectStyle,
              ...invalidBorder("place"),
              opacity: hasTime ? 1 : 0.55,
              cursor: hasTime ? "pointer" : "not-allowed",
            }}
          >
            <option value="">고르지 않음 (서울 기준)</option>
            {BIRTHPLACES.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
          <p id={placeHelpId} style={spHelper}>
            {hasTime
              ? "태어난 시·도로 진태양시를 보정해요. 고르지 않으면 서울 기준으로 보정해요."
              : "출생지는 태어난 시각을 넣었을 때 진태양시 보정에만 써요."}
          </p>
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            style={{
              margin: "16px 0 0",
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "var(--color-amber-warm-700)",
              background: "rgba(181,135,76,0.08)",
              border: "1px solid rgba(181,135,76,0.3)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
            }}
          >
            {error}
          </p>
        )}

        <div style={{ marginTop: 18 }}>
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            style={{ width: "100%", padding: "14px 28px", fontSize: 15 }}
          >
            {loading && <Loader2 className="size-4 animate-spin" style={{ marginRight: 6, display: "inline" }} />}
            {loading ? "세는 중..." : "오행 세어 보기"}
          </Button>
          <p role="status" aria-live="polite" style={{ ...spHelper, textAlign: "center", minHeight: 18 }}>
            {loading ? (slow ? "서버를 깨우는 중이에요. 길게는 1분 가까이 걸릴 수 있어요." : "원국을 세우는 중이에요.") : ""}
          </p>
        </div>

        <p style={{ ...spHelper, marginTop: 4 }}>
          양력 생년월일 기준입니다. 음력 생일은 양력으로 바꿔 넣어 주세요. 입력한 값은 결과를 만드는 데만 쓰고 저장하지 않습니다.
        </p>
      </form>

      {shown && <OhaengResult key={shown.id} data={shown.data} birthDate={shown.birthDate} birthTime={shown.birthTime} />}
    </>
  );
}
