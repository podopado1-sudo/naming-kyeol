"use client";

/**
 * /evaluate 화면 상태 — 입력 폼 ↔ 결과, URL 동기화, 요청 경합 처리.
 *
 * 구조(2026-10-21 개편)
 * - 이 컴포넌트는 useSearchParams를 쓰지 않는다 → 소개(h1)·폼·점수 설명이 정적 HTML에 실린다.
 *   URL은 Suspense 안의 SearchParamsWatcher만 읽는다. 예전에는 페이지 전체가 Suspense 안이라
 *   크롤러에게 '로딩 중...' 세 글자만 보였다(감사 AS-3·DD-3).
 * - 결과가 나오면 window.history.replaceState로 URL에 입력을 반영한다(새로고침·뒤로 가기·주소 복사 복원, EV-7).
 *   router.replace는 URL이 같아도 평가마다 RSC 요청(?_rsc=)을 프론트 서버로 한 번 더 보냈다(2026-10-21 검토
 *   실측) — 결과 화면은 클라이언트 상태라 받아 올 것이 없다. 네이티브 history 호출도 Next 라우터와 연동돼
 *   useSearchParams가 따라온다
 *   (node_modules/next/dist/docs 04-linking-and-navigating 'Native History API').
 *   우리가 쓴 URL이 watcher로 되돌아올 때 재평가하지 않도록 urlSigRef로 '지금 URL이 뜻하는 입력'을 기억한다.
 * - 예전의 key 리마운트(EvaluateInner key=searchParams)는 쓰지 않는다 — replace 때마다 결과가 날아간다.
 *   대신 서명 비교로 다른 이름이 오면 재평가, 파라미터 없는 /evaluate로 오면 빈 폼으로 돌린다.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  EvaluateAbout,
  EvaluateInputPage,
  EvaluateIntro,
  type EvalSubmitPayload,
  type InitialSeed,
} from "@/components/design/EvaluateInput";
import { evaluate } from "@/lib/api";
import type { NameEvaluationResponse } from "@/lib/types";

import {
  canAutoEvaluate,
  evaluateHref,
  inputFromParams,
  inputFromPayload,
  inputSignature,
  seedFromInput,
  seedFromParams,
  type EvalInput,
} from "./evaluate-params";
import { EvaluateResultView } from "./EvaluateResult";

const EMPTY_SIG = inputSignature(inputFromParams(new URLSearchParams()));

/** 이 시간이 지나도 응답이 없으면 콜드스타트 안내로 바꾼다 */
const SLOW_NOTICE_MS = 5_000;

interface Shown {
  data: NameEvaluationResponse;
  input: EvalInput;
}

export function EvaluateClient() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState<InitialSeed | undefined>(undefined);
  // 폼은 seed를 초기값으로만 읽으므로, seed를 바꿀 때 key를 올려 새로 마운트한다
  const [formKey, setFormKey] = useState(0);

  // 마지막 요청 번호 — 늦게 도착한 이전 응답이 새 결과를 덮지 않게 한다
  const reqIdRef = useRef(0);
  // 지금 URL이 뜻하는(=이미 처리한) 입력의 서명. 초기값은 파라미터 없는 /evaluate
  const urlSigRef = useRef(EMPTY_SIG);

  const run = useCallback(
    async (input: EvalInput) => {
      const id = ++reqIdRef.current;
      setShown(null);
      setError(null);
      setSlow(false);
      setLoading(true);
      try {
        const data = await evaluate({
          lastName: input.lastName,
          name: input.name,
          birthDate: input.birthDate || undefined,
          birthTime: input.birthTime || undefined,
          gender: input.gender,
          tone: input.tone,
        });
        if (id !== reqIdRef.current) return;
        setShown({ data, input });
        // 주소창에는 생년월일까지 남긴다(새로고침해도 같은 결과). 공유 버튼은 생년월일을 뺀 링크를 쓴다.
        urlSigRef.current = inputSignature(input);
        replaceUrl(evaluateHref(input, { withBirth: true }));
        window.scrollTo({ top: 0 });
      } catch (err) {
        if (id !== reqIdRef.current) return;
        setError(
          err instanceof Error ? err.message : "평가 중 오류가 발생했어요."
        );
      } finally {
        if (id === reqIdRef.current) {
          setLoading(false);
          setSlow(false);
        }
      }
    },
    []
  );

  // URL이 바뀌었을 때 (첫 진입·추천 '상세 보기'·찜 '다시 보기'·푸터 '이름 평가'·뒤로 가기)
  const handleUrl = useCallback(
    (params: URLSearchParams) => {
      const input = inputFromParams(params);
      const sig = inputSignature(input);
      if (sig === urlSigRef.current) return; // 우리가 replace로 쓴 URL이거나 이미 처리한 URL
      urlSigRef.current = sig;
      setSeed(seedFromParams(params));
      setFormKey((k) => k + 1);
      if (canAutoEvaluate(input)) {
        void run(input);
        return;
      }
      // 성·이름이 없는 URL — 진행 중 요청을 버리고 (시드만 채운) 입력 폼으로
      reqIdRef.current++;
      setShown(null);
      setLoading(false);
      setSlow(false);
      setError(null);
    },
    [run]
  );

  function handleSubmit(payload: EvalSubmitPayload) {
    void run(inputFromPayload(payload));
  }

  // '다른 이름 평가하기' — 성·출생일·성별·톤은 이어 쓰고 이름만 비운다 (같은 아이의 후보 비교가 흔한 흐름)
  function handleReset() {
    const last = shown?.input;
    reqIdRef.current++;
    setShown(null);
    setLoading(false);
    setSlow(false);
    setError(null);
    setSeed(last ? { ...seedFromInput(last), firstName: "" } : undefined);
    setFormKey((k) => k + 1);
    urlSigRef.current = EMPTY_SIG;
    replaceUrl("/evaluate");
    window.scrollTo({ top: 0 });
  }

  // 응답이 5초 넘게 없으면 콜드스타트 안내 (60초에서 api.ts가 끊는다)
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsWatcher onChange={handleUrl} />
      </Suspense>

      {shown ? (
        <EvaluateResultView
          data={shown.data}
          input={shown.input}
          onReset={handleReset}
        />
      ) : (
        <main
          style={{ padding: "48px 24px 32px", maxWidth: 720, margin: "0 auto" }}
        >
          <EvaluateIntro />
          <EvaluateInputPage
            key={formKey}
            seed={seed}
            onSubmit={handleSubmit}
            loading={loading}
          />
          <EvaluateAbout />
        </main>
      )}

      {(loading || error) && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            maxWidth: "calc(100vw - 32px)",
            boxSizing: "border-box",
            textAlign: "center",
            lineHeight: 1.5,
            background: error ? "rgba(196, 90, 76, 0.95)" : "var(--color-navy)",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: error || slow ? 16 : 999,
            fontSize: 13,
            boxShadow: "var(--shadow-md)",
          }}
        >
          {error
            ? error
            : slow
              ? "서버를 깨우는 중이에요. 길게는 1분 가까이 걸릴 수 있어요."
              : "평가 중..."}
        </div>
      )}
    </>
  );
}

/**
 * 주소창만 바꾼다(라우터 이동·RSC 요청 없음). state는 반드시 null — Next가 패치한 replaceState가
 * 자기 내부 상태(__NA·트리)를 복사해 넣고 useSearchParams를 갱신한다. window.history.state를 그대로
 * 넘기면 __NA가 들어 있어 '내부 호출'로 보고 라우터 갱신을 건너뛴다(next/dist/client/components/app-router.js).
 */
function replaceUrl(href: string) {
  window.history.replaceState(null, "", href);
}

/**
 * URL 쿼리를 읽어 부모에 알리는 빈 컴포넌트 — useSearchParams는 정적 프리렌더에서
 * 가장 가까운 Suspense까지를 클라이언트 렌더로 돌리므로, 이 컴포넌트만 Suspense로 감싼다.
 */
function SearchParamsWatcher({
  onChange,
}: {
  onChange: (params: URLSearchParams) => void;
}) {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  useEffect(() => {
    onChange(new URLSearchParams(qs));
  }, [qs, onChange]);
  return null;
}
