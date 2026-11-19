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
 *
 * 한자 입력(2026-11 — docs/plan-hanja-input-2026-11.md §8-2·§8-5·§8-6)
 * - 폼에서 고른 한자(input.hanja·lastHanja — 주소 꼴)를 요청의 nameHanja·lastNameHanja 로 싣는다(lib/hanja-pick.ts apiHanjaFields).
 * - 해시 `#pick=글자&as=독음`(/hanja 글자 상세·/ohaeng 한자 예에서 온다)은 PickHashWatcher 가 읽고 주소에서 지운다.
 *   들고 온 글자는 입력 폼에만 쓴다 — 서명에 넣지 않고, 결과 화면이거나 주소가 자동 평가를 뜻하면 버린다.
 *   링크에 적힌 독음의 음절 파일에 그 글자가 실제로 있을 때만 폼에 넘긴다(주소에 적힌 낱말을 그대로 화면에 옮기지 않는다).
 * - 서버가 한자 칸을 틀렸다고 알려 주면(400 의 target·slot) 하단 띠가 아니라 폼의 그 칸 아래에 문장을 적는다(fieldError).
 *
 * 결과 화면에서 한자 바꿔 다시 계산하기(설계 §8-2·§8-3 — 제자리 재계산)
 * - 상태 셋: `shown` = **마지막으로 계산이 끝난** 응답과 그 입력 · `pending` = 지금 서버에 묻고 있는 조합(바뀐 칸 묶음) ·
 *   `recalcError` = 다시 계산하지 못한 칸과 까닭.
 * - 칸을 바꾸면(changeHanja) pending 을 걸어 블록이 고른 글자로 바로 바뀌고, 0.4초 뒤 한 번만 서버에 묻는다(그 사이 또 바꾸면 다시 잰다).
 *   결과 화면은 지우지 않는다 — 응답이 오면 제자리에서 갈아 끼우고, 하단 띠(aria-live)로 한 줄 알린다.
 * - 실패하면(요청이 몰림·응답 없음·연결 실패·400) pending 을 지운다 → 블록이 shown 의 조합으로 **되돌아간다**. 까닭은 하단 띠가 아니라
 *   그 칸 아래에 적는다(그 띠는 닫기가 없다). 주소·서명·캐시·본 조합 목록은 건드리지 않는다. 새 한자 옆에 옛 점수가 남지 않는다.
 * - 평가 뒤 주소·저장·서명에 쓰는 한자는 응답의 정규 꼴(hanjaSummary.nameHanja·lastNameHanja)로 다시 쓴다 — 같은 조합이 한 가지 꼴로만
 *   남는다. hanjaSummary 가 없는 응답(옛 백엔드·한글 음절이 아닌 이름)이면 보낸 입력 그대로 쓰고 블록을 그리지 않는다.
 * - 응답 캐시(조합 서명 → 응답, 최대 8)와 '지금까지 본 조합'(같은 바탕에서 계산이 끝난 조합 — 지금 조합 + 최근 3개).
 *   본 조합으로 돌아갈 때는 서버를 부르지 않는다. 점수는 늘 응답의 값이다 — 화면에서 만들지 않는다.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  EvaluateAbout,
  EvaluateInputPage,
  EvaluateIntro,
  type EvalFieldError,
  type EvalPick,
  type EvalSubmitPayload,
  type InitialSeed,
} from "@/components/design/EvaluateInput";
import type { RecalcErrorView, SeenCombo } from "@/components/design/HanjaSummaryBlock";
import { ApiError, evaluate } from "@/lib/api";
import {
  apiHanjaFields,
  confirmedPickReadings,
  hanjaFromSummary,
  parsePickHash,
  type HanjaChoice,
  type PendingHanja,
  type PendingPick,
  type SlotTarget,
} from "@/lib/hanja-pick";
import { requestPickFile, usePickStore } from "@/lib/hanja-pick-store";
import {
  baseSignature,
  cachePut,
  mergePending,
  nextHanjaInput,
  pushSeen,
  type SeenEntry,
} from "@/lib/hanja-recalc";
import { RECALC_PROGRESS, recalcDoneNotice, seenShownNotice } from "@/lib/hanja-summary-text";
import type { HanjaFact, NameEvaluationResponse } from "@/lib/types";

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
/** 한자를 바꾼 뒤 서버에 묻기까지의 틈 — 그 사이 또 바꾸면 다시 잰다(빠른 연속 변경을 요청 한 번으로 묶는다) */
const RECALC_DEBOUNCE_MS = 400;
/** 다시 계산이 끝났다는 한 줄을 띄워 두는 시간 */
const DONE_NOTICE_MS = 4_000;
/** 보낸 꼴 → 정규 꼴 서명 표에 두는 수(보낸 꼴이 정규 꼴과 다를 때만 쓴다) */
const ALIAS_LIMIT = 16;

interface Shown {
  data: NameEvaluationResponse;
  /** 이 결과의 입력 — 한자는 서버가 받아들인 정규 꼴 */
  input: EvalInput;
}

/** 서버에 묻고 있는(또는 곧 물을) 조합 */
interface PendingRecalc {
  input: EvalInput;
  /** shown 에서 바뀐 칸들 — 블록이 응답을 기다리지 않고 그린다 */
  changes: PendingHanja;
  /** 마지막으로 바꾼 칸 — 실패하면 그 칸 아래에 안내를 적는다 */
  last: { target: SlotTarget; index: number; choice: HanjaChoice };
}

type RecalcError = RecalcErrorView & {
  /** [다시 시도]가 다시 보낼 조합 */
  retry: PendingRecalc;
};

function choiceWord(choice: HanjaChoice): Pick<RecalcErrorView, "kind" | "character"> {
  return { kind: choice.kind, character: choice.kind === "hanja" ? choice.fact.character : null };
}

export function EvaluateClient() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState<InitialSeed | undefined>(undefined);
  // 폼은 seed를 초기값으로만 읽으므로, seed를 바꿀 때 key를 올려 새로 마운트한다
  const [formKey, setFormKey] = useState(0);
  // 서버가 틀렸다고 알려 준 한자 칸 — 폼이 그 칸을 열고 문장을 적는다
  const [fieldError, setFieldError] = useState<EvalFieldError | null>(null);
  // 해시로 들고 온 글자(주소에 적힌 그대로 — 음절 파일로 확인하기 전)
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null);
  const pickStore = usePickStore();

  // 결과 화면에서 한자를 바꿔 다시 계산하는 중인 조합 — 없으면 null
  const [pending, setPending] = useState<PendingRecalc | null>(null);
  // 다시 계산하지 못한 칸 — 블록은 shown 의 조합으로 돌아가 있다
  const [recalcError, setRecalcError] = useState<RecalcError | null>(null);
  // 같은 바탕(성·이름·생년월일·시각·성별·톤)에서 계산이 끝난 조합 — 지금 조합 + 최근 3개
  const [seen, setSeen] = useState<SeenEntry<Shown>[]>([]);
  // 하단 띠의 한 줄 알림('다시 계산했어요 — …')
  const [notice, setNotice] = useState<string | null>(null);

  // 마지막 요청 번호 — 늦게 도착한 이전 응답이 새 결과를 덮지 않게 한다
  const reqIdRef = useRef(0);
  // 지금 URL이 뜻하는(=이미 처리한) 입력의 서명. 초기값은 파라미터 없는 /evaluate
  const urlSigRef = useRef(EMPTY_SIG);
  // 결과 화면인가 — 들고 온 글자(#pick)는 입력 폼에만 쓴다
  const resultShownRef = useRef(false);
  useEffect(() => {
    resultShownRef.current = shown !== null;
  }, [shown]);

  // 응답 캐시 — 정규 꼴 서명 → 응답. 본 조합으로 돌아갈 때 서버를 부르지 않는다(메모리에만 둔다 — 브라우저 저장소에 쓰지 않는다)
  const cacheRef = useRef(new Map<string, Shown>());
  // 보낸 꼴의 서명 → 정규 꼴의 서명(둘이 다를 때만 — 복성에서 한 글자만 고른 경우 등)
  const aliasRef = useRef(new Map<string, string>());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current);
      debounceRef.current = null;
      noticeTimerRef.current = null;
    },
    []
  );

  // 들고 온 글자는 링크에 적힌 독음의 음절 파일에 실제로 있을 때만 폼에 넘긴다 — 띠에는 확인된 독음만 적는다.
  // 파일을 받지 못한 독음은 확인할 수 없으므로 없는 것으로 본다(손으로 고친 주소·사전에 없는 글자와 같이 버린다)
  const confirmedPick = useMemo<EvalPick | null>(() => {
    if (!pendingPick) return null;
    const files = new Map<string, readonly HanjaFact[]>(pickStore.files);
    for (const reading of pendingPick.readings) {
      if (!files.has(reading) && pickStore.failed.has(reading)) files.set(reading, []);
    }
    const { ready, readings } = confirmedPickReadings(pendingPick, files);
    return ready && readings.length > 0 ? { character: pendingPick.character, readings } : null;
  }, [pendingPick, pickStore.files, pickStore.failed]);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current === null) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }, []);

  /** 하단 띠의 한 줄 알림 — 4초 뒤 지운다. null 이면 바로 지운다 */
  const announce = useCallback((text: string | null) => {
    if (noticeTimerRef.current !== null) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setNotice(text);
    if (text === null) return;
    noticeTimerRef.current = setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice(null);
    }, DONE_NOTICE_MS);
  }, []);

  /**
   * 계산이 끝난 조합을 화면에 확정한다 — 주소·서명·본 조합 목록을 그 조합으로 맞춘다.
   * first = 첫 평가(맨 위로 올린다) · recalc = 제자리 재계산(화면을 그대로 두고 한 줄로 알린다) · seen = 본 조합으로 돌아감.
   */
  const show = useCallback(
    (entry: Shown, mode: "first" | "recalc" | "seen") => {
      const sig = inputSignature(entry.input);
      setShown(entry);
      setPending(null);
      setRecalcError(null);
      setSeen((prev) => pushSeen(prev, { sig, base: baseSignature(entry.input), value: entry }));
      // 주소창에는 생년월일까지 남긴다(새로고침해도 같은 결과). 공유 버튼은 생년월일을 뺀 링크를 쓴다.
      urlSigRef.current = sig;
      replaceUrl(evaluateHref(entry.input, { withBirth: true }));
      if (mode === "first") {
        announce(null);
        window.scrollTo({ top: 0 });
      } else {
        // 후보 표에서 고르면 점수 타일이 화면 밖이다 — 바뀐 것을 한 줄로 알린다(숫자는 응답 값)
        announce(mode === "recalc" ? recalcDoneNotice(entry.data) : seenShownNotice(entry.data));
      }
    },
    [announce]
  );

  /**
   * 평가를 요청한다. `attempt` 가 있으면 결과 화면의 제자리 재계산이다 — 결과를 지우지 않고(맨 위로 올리지도 않는다),
   * 실패하면 그 칸 아래에 안내를 적는다. 없으면 첫 평가(폼 제출·주소 진입)다.
   */
  const run = useCallback(
    async (input: EvalInput, attempt?: PendingRecalc) => {
      const id = ++reqIdRef.current;
      clearDebounce();
      if (!attempt) {
        setShown(null);
        setPending(null);
        setRecalcError(null);
        announce(null);
      }
      setError(null);
      setFieldError(null);
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
          // 고른 한자 — 주소 꼴을 이름·성씨 길이로 풀어 전체 길이로(瑞 → 瑞*). 지정이 없거나 한글 음절만이 아니면 싣지 않는다
          ...apiHanjaFields(input),
        });
        if (id !== reqIdRef.current) return;
        // 주소·저장·서명에 쓰는 한자는 서버가 받아들인 정규 꼴로 다시 쓴다(호환 한자·기본 한자와 같은 성씨 지정이 한 가지 꼴로 정리된다).
        // hanjaSummary 가 없는 응답(옛 백엔드·한글 음절이 아닌 이름)이면 보낸 입력 그대로다
        const canonical = hanjaFromSummary(data.hanjaSummary);
        const entry: Shown = { data, input: canonical ? { ...input, ...canonical } : input };
        const sig = inputSignature(entry.input);
        const asked = inputSignature(input);
        cachePut(cacheRef.current, sig, entry);
        if (asked !== sig) cachePut(aliasRef.current, asked, sig, ALIAS_LIMIT);
        show(entry, attempt ? "recalc" : "first");
      } catch (err) {
        if (id !== reqIdRef.current) return;
        const message = err instanceof Error ? err.message : "평가 중 오류가 발생했어요.";
        if (attempt) {
          // 재계산의 오류는 하단 띠에 올리지 않는다(그 띠는 닫기가 없다). pending 을 지워 블록을 마지막으로 계산이 끝난 조합으로
          // 되돌리고, 그 칸 아래에 까닭을 적는다. 서버가 칸을 짚었으면(400 의 target·slot) 그 칸을 연다
          const slotCount = (target: SlotTarget) => (target === "name" ? input.name : input.lastName).length;
          const pointed =
            err instanceof ApiError &&
            err.status === 400 &&
            err.target &&
            err.slot !== undefined &&
            err.slot >= 0 &&
            err.slot < slotCount(err.target)
              ? { target: err.target, index: err.slot }
              : null;
          const at = pointed ?? attempt.last;
          // 그 칸에 무엇을 넣으려 했나 — 서버가 짚은 칸이 이번에 바꾼 칸이 아니면 글자를 대지 않는다
          const choice = (at.target === "name" ? attempt.changes.name : attempt.changes.surname)[at.index];
          setPending(null);
          setRecalcError({
            id,
            target: at.target,
            index: at.index,
            ...(choice ? choiceWord(choice) : { kind: "slot" as const, character: null }),
            message,
            open: pointed !== null,
            retry: attempt,
          });
          return;
        }
        if (err instanceof ApiError && err.status === 400 && err.target) {
          // 한자 칸의 오류 — 폼의 그 칸 아래에 적는다(하단 띠에만 뜨면 어느 칸이 틀렸는지 알 수 없다)
          setFieldError({ id, target: err.target, slot: err.slot ?? -1, message: err.message });
          return;
        }
        setError(message);
      } finally {
        if (id === reqIdRef.current) {
          setLoading(false);
          setSlow(false);
        }
      }
    },
    [announce, clearDebounce, show]
  );

  /** 결과 화면에 걸린 재계산 상태를 모두 걷는다 — 다른 이름·빈 폼으로 넘어갈 때 */
  const dropRecalc = useCallback(() => {
    clearDebounce();
    setPending(null);
    setRecalcError(null);
    announce(null);
  }, [announce, clearDebounce]);

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
      dropRecalc();
      setSeen([]);
      setShown(null);
      setLoading(false);
      setSlow(false);
      setError(null);
      setFieldError(null);
    },
    [dropRecalc, run]
  );

  function handleSubmit(payload: EvalSubmitPayload) {
    // 들고 온 글자는 제출할 때까지만 — 칸에 들어갔다면 payload 의 hanja 에 이미 실려 있다
    setPendingPick(null);
    void run(inputFromPayload(payload));
  }

  // 해시로 글자를 들고 왔다(PickHashWatcher) — 입력 폼에만 쓴다
  const handlePick = useCallback((pick: PendingPick) => {
    if (resultShownRef.current) return;
    // 주소가 자동 평가를 뜻하면(성·이름이 다 있다) 버린다 — 곧 결과 화면으로 넘어간다
    if (canAutoEvaluate(inputFromParams(new URLSearchParams(window.location.search)))) return;
    setPendingPick(pick);
    // 링크에 적힌 독음의 음절 파일(입력값이 아니라 링크에서 온 값이다) — 그 글자가 들어 있는지 확인한다
    for (const reading of pick.readings) void requestPickFile(reading);
  }, []);

  // '다른 이름 평가하기' — 성·출생일·성별·톤은 이어 쓰고 이름만 비운다 (같은 아이의 후보 비교가 흔한 흐름)
  // 성씨 한자는 이어 쓰고 이름 한자는 이름과 함께 비운다
  function handleReset() {
    const last = shown?.input;
    reqIdRef.current++;
    dropRecalc();
    setSeen([]);
    setShown(null);
    setLoading(false);
    setSlow(false);
    setError(null);
    setFieldError(null);
    setSeed(last ? { ...seedFromInput(last), firstName: "", hanja: "" } : undefined);
    setFormKey((k) => k + 1);
    urlSigRef.current = EMPTY_SIG;
    replaceUrl("/evaluate");
    window.scrollTo({ top: 0 });
  }

  /**
   * 그 조합으로 다시 계산한다(결과 화면은 그대로 둔다).
   * - 진행 중인 재계산의 응답은 버린다 — 늦게 와도 지금 고른 조합을 덮지 않는다.
   * - 마지막으로 계산이 끝난 조합으로 돌아온 것이면 기다릴 것이 없다. 받아 둔 응답이 있으면 바로 확정한다(서버를 부르지 않는다).
   * - 아니면 `delay` 뒤 한 번 묻는다. 그 사이 또 바뀌면 이 함수가 다시 불려 타이머를 새로 건다.
   */
  function startRecalc(next: PendingRecalc, delay: number) {
    if (!shown) return;
    clearDebounce();
    reqIdRef.current++;
    setRecalcError(null);
    setError(null);
    setLoading(false);
    setSlow(false);
    announce(null);
    const sig = inputSignature(next.input);
    if (sig === inputSignature(shown.input)) {
      setPending(null);
      return;
    }
    const cached = cacheRef.current.get(aliasRef.current.get(sig) ?? sig);
    if (cached) {
      show(cached, "recalc");
      return;
    }
    setPending(next);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void run(next.input, next);
    }, delay);
  }

  /** 결과 화면에서 칸 하나를 바꿨다('이 이름의 한자' 블록의 칸 · '한자 후보' 표의 '이 글자로') */
  function changeHanja(target: SlotTarget, index: number, choice: HanjaChoice) {
    if (!shown?.data.hanjaSummary) return;
    // 기다리는 조합이 있으면 그 위에 얹는다 — 두 칸을 잇달아 바꾸면 두 칸이 함께 간다
    const base = pending ?? { input: shown.input, changes: null };
    startRecalc(
      {
        input: nextHanjaInput(base.input, target, index, choice),
        changes: mergePending(base.changes, target, index, choice),
        last: { target, index, choice },
      },
      RECALC_DEBOUNCE_MS
    );
  }

  /** '지금까지 본 조합'의 줄을 눌렀다 — 받아 둔 응답을 다시 보여 준다(서버를 부르지 않는다) */
  function selectSeen(sig: string) {
    if (!shown) return;
    const entry = seen.find((e) => e.sig === sig);
    if (!entry) return;
    clearDebounce();
    reqIdRef.current++;
    setError(null);
    setLoading(false);
    setSlow(false);
    if (sig === inputSignature(shown.input)) {
      // 지금 조합의 줄 — 기다리던 변경만 거둔다
      setPending(null);
      setRecalcError(null);
      announce(null);
      return;
    }
    show(entry.value, "seen");
  }

  const seenCombos = useMemo<SeenCombo[]>(() => seen.map((e) => ({ sig: e.sig, data: e.value.data })), [seen]);

  // 응답이 5초 넘게 없으면 콜드스타트 안내 (60초에서 api.ts가 끊는다)
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  // 하단 띠의 글 — 오류(첫 평가) > 콜드스타트 안내 > 다시 계산하는 중 > 평가 중 > 한 줄 알림
  const stripText = error
    ? error
    : slow
      ? "서버를 깨우는 중이에요. 길게는 1분 가까이 걸릴 수 있어요."
      : pending
        ? RECALC_PROGRESS
        : loading
          ? "평가 중..."
          : notice;

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsWatcher onChange={handleUrl} />
      </Suspense>
      <PickHashWatcher onPick={handlePick} />

      {shown ? (
        <EvaluateResultView
          data={shown.data}
          input={shown.input}
          onReset={handleReset}
          recalc={{
            pending: pending?.changes ?? null,
            error: recalcError,
            seen: seenCombos,
            currentSig: inputSignature(shown.input),
            onChange: changeHanja,
            onRetry: () => {
              if (recalcError) startRecalc(recalcError.retry, 0);
            },
            onDismissError: () => setRecalcError(null),
            onSelectSeen: selectSeen,
          }}
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
            pick={confirmedPick}
            onPickDismiss={() => setPendingPick(null)}
            fieldError={fieldError}
          />
          <EvaluateAbout />
        </main>
      )}

      {/* 하단 띠 — 진행·완료를 글로 알린다. 알림 영역(role="status")은 늘 문서에 두고 안의 글만 바꾼다
          (글이 생길 때 영역째 새로 끼우면 화면 읽기 프로그램이 놓칠 수 있다). 누를 것이 없어 클릭을 가로채지 않는다.
          좌우 16px 를 뺀 폭 안에서 가운데에 둔다(왼쪽 50% + 옮기기로 두면 쓸 수 있는 폭이 화면의 절반이라 좁은 화면에서 일찍 줄이 바뀐다) */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 24,
          left: 16,
          right: 16,
          zIndex: 100,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {stripText && (
          <div
            style={{
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
            {stripText}
          </div>
        )}
      </div>
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
 * 해시로 들고 온 글자(`#pick=글자&as=독음`)를 읽어 부모에 알리는 빈 컴포넌트 — 마운트 때와 hashchange 때.
 * 읽은 해시는 주소에서 지운다(새로고침·주소 복사에 남지 않게). `pick=` 으로 시작하지 않는 해시(#hanja-guide)와
 * 읽을 수 없는 값은 건드리지 않는다(lib/hanja-pick.ts parsePickHash). 해시는 서버로 가지 않는다.
 */
function PickHashWatcher({ onPick }: { onPick: (pick: PendingPick) => void }) {
  useEffect(() => {
    const read = () => {
      const pick = parsePickHash(window.location.hash);
      if (!pick) return;
      replaceUrl(window.location.pathname + window.location.search);
      onPick(pick);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [onPick]);
  return null;
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
