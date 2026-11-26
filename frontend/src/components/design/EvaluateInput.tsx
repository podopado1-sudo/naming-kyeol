/**
 * EvaluateInput — 이름 평가 입력 페이지 조각 (소개 · 입력 폼 · 점수 설명)
 * Source: NameForm_design/src/EvaluateInput.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState → 명시적 import
 *   - injectStyles IIFE → useEffect (SSR 안전)
 *   - onSubmit prop 추가 (외부에서 평가 요청 트리거)
 *   - 2026-10-21: 자체 미니 헤더·푸터를 걷고 사이트 Header/Footer를 쓴다. 소개(h1)·점수 설명이
 *     정적 HTML에 실리도록 EvaluateIntro / EvaluateAbout으로 분리 — 예전에는 페이지 전체가
 *     useSearchParams Suspense 안이라 크롤러에게 '로딩 중...'만 보였다(감사 AS-3·DD-3).
 *     미니 푸터의 죽은 링크(href="#" 소개·문의)는 사이트 Footer의 /about·/contact로 대체(UX-3).
 *   - 2026-11: 이름 Section 에 음절별 한자 칸(HanjaSlots)과 고르기 패널(HanjaPickerPanel) — docs/plan-hanja-input-2026-11.md
 *     §3-1·§8-6, 구현 기록 §23. 칸 상태는 저장하지 않고 (조합이 끝난 성·이름, 고른 것, 들고 온 글자)에서 매번 계산한다.
 *     음절 후보 파일은 이름을 칠 때 받지 않는다(칸을 열 때·주소로 온 한자·들고 온 글자·붙여넣기 — tests/evaluate-hanja-pages.test.mjs).
 */
"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { BookOpen, Leaf, Music } from "lucide-react";

import {
  deriveSlots,
  isHangulSyllables,
  pickSyllablesIn,
  seedChoices,
  spreadPaste,
  submitMarks,
  surnameDefaultAt,
  type HanjaChoice,
  type HanjaSlot,
} from "@/lib/hanja-pick";
import { getPickSnapshot, requestPickFile, requestPickIndex, usePickStore } from "@/lib/hanja-pick-store";
import {
  MIXED_SCRIPT_NOTICE,
  SLOTS_EMPTY_GUIDE,
  SLOTS_HINT,
  SLOTS_JAMO_NOTE,
  SLOTS_PREPARING,
  SLOTS_TITLE,
  isMixedScript,
  pasteReport,
  pickBannerText,
  seedRejectedNote,
  seedUncheckedNote,
  slotNote,
  type PasteReport,
} from "@/lib/hanja-pick-text";
import { todayKst } from "@/lib/ohaeng";
import type { HanjaFact } from "@/lib/types";

import { HanjaPickerPanel } from "./HanjaPickerPanel";
import { HanjaSlots, slotButtonId, slotKey } from "./HanjaSlots";

export type EvalSubmitPayload = {
  lastName: string;
  firstName: string;
  birth: string;
  /** 출생 시각 (HH:mm, 선택) — 사주 시주(時柱) 계산에 사용 */
  birthTime?: string;
  gender: "남" | "여" | "중립" | "";
  tone: "부드러운" | "중립" | "강한" | "";
  /** 고른 이름 한자(선택, 2026-11 한자 입력) — 칸마다 한 글자 / `*` 자동 / `-` 한자 없이. evaluate-params 가 주소 꼴로 정리한다 */
  hanja?: string;
  /** 고른 성씨 한자(선택) — 칸마다 한 글자 / `*` */
  lastHanja?: string;
};

/** 폼 초기값 — 비어 있는 성별·톤("")은 미선택으로 시작한다 */
export interface InitialSeed {
  lastName?: string;
  firstName?: string;
  birth?: string;
  birthTime?: string;
  gender?: EvalSubmitPayload["gender"];
  tone?: EvalSubmitPayload["tone"];
  /** 주소·이전 평가에서 온 이름 한자(주소 꼴) — 폼이 칸마다 그 음절 후보로 검사한 뒤 쓴다 */
  hanja?: string;
  /** 주소·이전 평가에서 온 성씨 한자(주소 꼴) */
  lastHanja?: string;
}

/** 해시(`/evaluate#pick=…&as=…`)로 들고 온 글자 — 독음은 음절 파일로 확인된 것만 넘긴다 */
export interface EvalPick {
  character: string;
  readings: string[];
}

/**
 * 서버가 한자 칸을 틀렸다고 알려 준 오류(400 본문의 target·slot — lib/api.ts ApiError).
 * slot 이 -1 이면 칸 하나의 문제가 아니다(한글 검사·글자 수) — 칸을 열지 않고 문장만 띄운다.
 */
export interface EvalFieldError {
  /** 오류마다 다른 번호 — 같은 오류로 칸을 두 번 열지 않게 */
  id: number;
  target: "name" | "surname";
  slot: number;
  message: string;
}

/** 조합이 끝나지 않은 값으로 칸 줄을 맞추기까지의 틈(ms) — 조합 이벤트를 내지 않는 자판은 짧게, 조합 중에는 입력이 멈춘 뒤에 */
const SETTLE_MS = 300;
const SETTLE_COMPOSING_MS = 700;

/** 칸 줄을 만들 수 있는 값인가 — 비었거나 한글 음절(가~힣)만. 낱자모가 남았으면 null(직전 칸 줄을 그대로 둔다) */
function settleable(value: string): string | null {
  const text = value.trim();
  return text === "" || isHangulSyllables(text) ? text : null;
}

// ============================================================
// EvaluateIntro — eyebrow + h1 + 안내 (정적, 입력 화면 맨 위)
// ============================================================
export function EvaluateIntro() {
  return (
    <div style={{ marginBottom: 32, textAlign: "center" }}>
      <div className="eyebrow" style={{ marginBottom: 16 }}>
        Evaluate
      </div>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 34,
          fontWeight: 700,
          margin: "0 0 14px",
          letterSpacing: "-0.018em",
          lineHeight: 1.3,
          color: "var(--color-text)",
        }}
      >
        마음에 둔 이름,
        <br />
        어떤 결인지 알려드릴게요
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "var(--color-text-2)",
          margin: 0,
          lineHeight: 1.65,
        }}
      >
        이름과 출생 정보를 입력하시면 미학·조화·유니크 지수를 분석합니다
      </p>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-2)",
          margin: "8px 0 0",
          lineHeight: 1.65,
        }}
      >
        아기 이름 한자를 정하는 중이라면 음절마다 인명용 한자를 직접 골라 넣을 수 있어요.{" "}
        {/* 같은 화면 맨 아래의 설명 글(app/evaluate/EvaluateHanjaGuide.tsx 의 h2)로 내려간다 — 설계 §9-2·§12-2 */}
        <a
          href="#hanja-guide"
          style={{
            color: "var(--color-teal-800)",
            fontWeight: 500,
            textDecoration: "underline",
            textUnderlineOffset: 3,
            whiteSpace: "nowrap",
          }}
        >
          한자 고르는 법
        </a>
      </p>

      <aside
        style={{
          marginTop: 24,
          background: "var(--color-background)",
          borderLeft: "3px solid var(--color-teal)",
          borderRadius: "0 var(--radius-md) var(--radius-md) 0",
          padding: "16px 20px",
          border: "1px solid var(--color-divider)",
          borderLeftWidth: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "var(--color-teal)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            i
          </span>
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--color-text)",
            }}
          >
            평가는 추천과 다른 관점이에요
          </span>
        </div>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 4,
            fontSize: 13.5,
            color: "var(--color-text-2)",
            lineHeight: 1.6,
          }}
        >
          <li>
            <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
              추천
            </b>{" "}
            · 후보를 새로 생성
          </li>
          <li>
            <b style={{ fontWeight: 600, color: "var(--color-text)" }}>
              평가
            </b>{" "}
            · 정해진 이름을 분석
          </li>
          <li>두 결과는 서로를 보완해요</li>
        </ul>
      </aside>
    </div>
  );
}

// ============================================================
// EvaluateAbout — 점수 산식 설명 (정적, 입력 화면 맨 아래)
// 숫자는 AestheticEngine(30/25/15/15/10)·HarmonyEngine(30/20/10/25/15)·ScoringService(7:3)와 같아야 한다
// ============================================================
export function EvaluateAbout() {
  const linkStyle: CSSProperties = {
    color: "var(--color-teal)",
    fontWeight: 500,
    textDecoration: "none",
  };
  return (
    <section
      style={{
        marginTop: 8,
        padding: "28px 28px 8px",
        borderTop: "1px solid #F0EAE0",
        maxWidth: 560,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <h2
        style={{
          margin: "0 0 14px",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-text)",
          letterSpacing: "-0.01em",
        }}
      >
        점수는 이렇게 매겨요
      </h2>
      <p style={aboutParagraphStyle}>
        미학 점수(100점)는 발음 30·리듬 25·음절 15·세대 중립 15·의미 10점으로,
        소리 내어 부르기 좋은지와 특정 시대에 묶이지 않는지를 봅니다. 출생일을
        넣으면 조화 점수(100점)도 함께 계산해요. 자원오행 보완 30·획수 조화
        20·음양 10·발음오행 25·전통 81수리 15점이에요. 자원오행 보완은 이름
        음절마다 고른 한자의 자원오행(부수 기준)이 사주에 필요한 오행을
        채우는지, 획수 조화는 두 글자 획수의 합을 봐요. 81수리는 한자 획수로 보는 옛
        기준이라 길흉 표기는 참고로만 보여 드려요.
      </p>
      <p style={aboutParagraphStyle}>
        종합 점수는 미학 70%와 조화 30%를 더한 값이고, 출생일이 없으면 미학
        점수가 곧 종합 점수가 됩니다. 유니크 지수는 흔히 쓰는 이름인지를 따로
        보여 주는 지표라 종합 점수에 들어가지 않아요. 계산 방식은{" "}
        <Link href="/method" style={linkStyle}>
          작명 원리
        </Link>
        에서, 이름을 고르는 기준은{" "}
        <Link href="/guide" style={linkStyle}>
          작명 가이드
        </Link>
        에서 더 자세히 볼 수 있어요.
      </p>
    </section>
  );
}

const aboutParagraphStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 13.5,
  lineHeight: 1.75,
  color: "var(--color-text-2)",
  wordBreak: "keep-all",
};

// ============================================================
// EvaluateInputPage — 입력 폼 (성·이름·출생일·성별·톤)
// ============================================================
export function EvaluateInputPage({
  seed,
  onSubmit,
  loading = false,
  pick = null,
  onPickDismiss,
  fieldError = null,
}: {
  seed?: InitialSeed;
  onSubmit?: (payload: EvalSubmitPayload) => void;
  /** 평가 요청 중 — 버튼을 잠가 중복 요청(사용량·분당 20회 리미터 소모)을 막는다 (감사 UX-1) */
  loading?: boolean;
  /** 들고 온 글자(#pick) — 이름에 그 글자로 읽는 음절이 있으면 그 칸에 들어간다. 띠를 닫거나 제출할 때까지 유지된다 */
  pick?: EvalPick | null;
  onPickDismiss?: () => void;
  /** 서버가 틀렸다고 알려 준 한자 칸 — 그 칸을 열고 문장을 칸 줄 아래에 적는다 */
  fieldError?: EvalFieldError | null;
}) {
  const [lastName, setLastName] = useState(seed?.lastName ?? "");
  const [firstName, setFirstName] = useState(seed?.firstName ?? "");
  const [birth, setBirth] = useState(seed?.birth ?? "");
  const [birthTime, setBirthTime] = useState(seed?.birthTime ?? "");
  const [gender, setGender] = useState<EvalSubmitPayload["gender"]>(
    seed?.gender ?? ""
  );
  const [tone, setTone] = useState<EvalSubmitPayload["tone"]>(seed?.tone ?? "");

  const [openBirthHelp, setOpenBirthHelp] = useState(false);
  const [openToneHelp, setOpenToneHelp] = useState(false);

  // ──────────────────────────────────────────────────────────
  // 한자 칸 (2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §8-6)
  //
  // 칸 상태는 저장하지 않고 매번 계산한다: (조합이 끝난 성·이름, 고른 것, 들고 온 글자, 색인, 받아 둔 음절 파일) → deriveSlots.
  // 이름 칸은 한글 조합 중에도 값마다 onChange 가 온다(ㅅ → 서 → 성 → 서유 → 서윤). 칸을 '고쳐 쓰는 저장 값'으로 두면
  // '서'에 넣은 글자가 '성'에서 사라지고 돌아오지 않는다 — 파생이면 지나온 중간 값과 무관하다.
  // ──────────────────────────────────────────────────────────
  const uid = useId();
  const slotsTitleId = `${uid}-hanja-title`;
  const panelId = `${uid}-hanja-panel`;
  const slotBase = `${uid}-hanja-slot`;
  const errorId = `${uid}-hanja-error`;
  const noteBase = `${uid}-hanja-note`;
  // 이름 칸 — 들고 온 글자의 띠를 닫으면 포커스를 여기로 옮긴다(누른 [닫기]가 띠째 사라져 포커스가 body 로 떨어지지 않게)
  const firstNameId = `${uid}-first-name`;

  const store = usePickStore();
  // 색인은 이름과 무관한 고정 주소다 — 폼이 뜰 때 한 번 받는다(잠긴 칸·성씨 기본 한자를 안다)
  useEffect(() => {
    void requestPickIndex();
  }, []);

  // 사용자가 직접 고른 것만 — 키는 (성씨·이름, 자리, 음절). 같은 자리·같은 음절이 돌아오면 되살아난다
  const [userChoices, setUserChoices] = useState<ReadonlyMap<string, HanjaChoice>>(() => new Map());
  // 열린 칸(한 번에 하나)
  const [openKey, setOpenKey] = useState<string | null>(null);
  // 서버 오류 — 그 오류로 칸을 여는 일이 끝났는가(ackedError) · 문장을 접었는가(hiddenError)
  const [ackedError, setAckedError] = useState<number | null>(null);
  const [hiddenError, setHiddenError] = useState<number | null>(null);
  // 여러 글자를 나눠 넣은 결과
  const [paste, setPaste] = useState<PasteReport | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null);

  // 조합이 끝난 성·이름 — 칸 줄은 이 값으로만 다시 그린다. 낱자모가 남은 값은 받지 않고 직전 값을 둔다(unsettled 로 알린다)
  const [settled, setSettled] = useState(() => ({
    lastName: settleable(seed?.lastName ?? "") ?? "",
    firstName: settleable(seed?.firstName ?? "") ?? "",
  }));
  const [unsettled, setUnsettled] = useState(() => ({
    lastName: settleable(seed?.lastName ?? "") === null,
    firstName: settleable(seed?.firstName ?? "") === null,
  }));
  const composingRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = undefined;
    },
    []
  );

  function commitSettle(next: { lastName: string; firstName: string }) {
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = undefined;
    const last = settleable(next.lastName);
    const first = settleable(next.firstName);
    setSettled((prev) => {
      const lastName = last ?? prev.lastName;
      const firstName = first ?? prev.firstName;
      return lastName === prev.lastName && firstName === prev.firstName ? prev : { lastName, firstName };
    });
    setUnsettled((prev) =>
      prev.lastName === (last === null) && prev.firstName === (first === null)
        ? prev
        : { lastName: last === null, firstName: first === null }
    );
  }

  /**
   * 칸 줄을 지금 값에 맞출 때를 잡는다 — 조합이 끝나면(compositionend) 바로, 조합 이벤트 없이 바뀌면 조금 뒤,
   * 조합 중이면 입력이 멈춘 뒤에. 마지막 음절은 다른 키를 누르기 전까지 조합이 끝나지 않으므로(서윤의 '윤'),
   * 조합 중에도 입력이 멈추면 맞춘다 — 안 그러면 다른 곳을 누를 때까지 마지막 칸이 생기지 않는다.
   */
  function scheduleSettle(next: { lastName: string; firstName: string }) {
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(
      () => commitSettle(next),
      composingRef.current ? SETTLE_COMPOSING_MS : SETTLE_MS
    );
  }

  function changeName(field: "lastName" | "firstName", value: string) {
    if (field === "lastName") setLastName(value);
    else setFirstName(value);
    if (fieldError) setHiddenError(fieldError.id);
    scheduleSettle({ lastName, firstName, [field]: value });
  }

  // 주소로 들어온 한자(시드) — 칸마다 그 음절 후보로 검사해 맞는 글자만 선택으로 쓴다
  const seedLast = seed?.lastName ?? "";
  const seedFirst = seed?.firstName ?? "";
  const seedHanja = seed?.hanja ?? "";
  const seedLastHanja = seed?.lastHanja ?? "";
  const seeded = useMemo(
    () =>
      seedChoices(
        { lastName: seedLast, firstName: seedFirst, hanja: seedHanja, lastHanja: seedLastHanja },
        store.files
      ),
    [seedLast, seedFirst, seedHanja, seedLastHanja, store.files]
  );
  // 음절 파일은 이름을 칠 때 받지 않는다(제출 전에 음절이 요청 주소에 남지 않게 — 설계 §10-4). 받는 때는
  // ⓐ 칸을 열 때(패널) ⓑ 들고 온 글자가 들어갈 음절이 이름에 있을 때 ⓒ 주소로 한자가 온 칸 ⓔ 붙여 넣은 글자를 나눠 넣을 자리.
  useEffect(() => {
    // ⓒ — 그 이름은 이미 주소에 있다. 받지 못한 음절은 다시 부르지 않는다(칸을 열면 다시 받는다)
    for (const item of seeded.pending) {
      if (!store.failed.has(item.syllable)) void requestPickFile(item.syllable);
    }
  }, [seeded, store.failed]);

  const pickCharacter = pick?.character ?? "";
  const pickReadings = pick ? pick.readings.join(",") : "";
  useEffect(() => {
    // ⓑ
    if (!pickCharacter) return;
    const carried = { character: pickCharacter, readings: pickReadings.split(",") };
    for (const syllable of pickSyllablesIn(carried, settled.firstName)) void requestPickFile(syllable);
  }, [pickCharacter, pickReadings, settled.firstName]);

  // 선택 = 주소로 온 한자(확인된 것) 위에 직접 고른 것을 덮는다
  const choices = useMemo(() => new Map([...seeded.choices, ...userChoices]), [seeded, userChoices]);
  const derived = useMemo(
    () => deriveSlots(settled, choices, pick, store.index, store.files),
    [settled, choices, pick, store.index, store.files]
  );
  // 주소로 온 한자를 확인하는 동안(그 음절 파일을 받는 중) 그 칸은 '확인 중' — 그동안 제출하면 그 글자를 그대로 싣는다(submitMarks)
  const waitingSeeds = new Map(
    seeded.pending
      .filter((item) => !store.failed.has(item.syllable) && !userChoices.has(item.key))
      .map((item) => [item.key, item.character] as const)
  );
  const waitingKeys = new Set(waitingSeeds.keys());
  const asShown = (slot: HanjaSlot): HanjaSlot =>
    waitingKeys.has(slotKey(slot)) ? { ...slot, state: "checking", character: null, fact: null } : slot;
  const surnameSlots = (derived.surname ?? []).map(asShown);
  const nameSlots = (derived.name ?? []).map(asShown);
  const allSlots = [...surnameSlots, ...nameSlots];
  // 색인을 받은 뒤에 칸 줄을 그린다 — 잠긴 칸이 잠깐 '자동'으로 보이지 않게(받지 못했으면 색인 없이 그린다)
  const slotsReady = store.index !== null || store.indexFailed;

  const shownError = fieldError && fieldError.id !== hiddenError ? fieldError : null;
  const errorSlot =
    shownError && shownError.slot >= 0
      ? ((shownError.target === "name" ? nameSlots : surnameSlots)[shownError.slot] ?? null)
      : null;
  const errorKey = errorSlot ? slotKey(errorSlot) : null;
  const effectiveOpenKey = shownError && errorKey && shownError.id !== ackedError ? errorKey : openKey;
  const openSlot = allSlots.find((slot) => slot.openable && slotKey(slot) === effectiveOpenKey) ?? null;

  // 패널을 닫으면(고르기·닫기·Esc) 그 칸 버튼으로 포커스를 돌려놓는다 — 문서가 줄어 화면이 아래로 떨어지지 않게
  useEffect(() => {
    if (!focusRequest) return;
    const button = document.getElementById(focusRequest.id);
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: "nearest" });
  }, [focusRequest]);

  // 서버가 틀린 칸을 알려 주면(주소로 들어온 자동 평가의 400) 그 문장이 보이는 자리로 옮긴다 — 폼 맨 위에서는 칸 줄이 화면 밖일 수 있다
  const fieldErrorId = fieldError?.id;
  useEffect(() => {
    if (fieldErrorId === undefined) return;
    document.getElementById(errorId)?.scrollIntoView({ block: "center" });
  }, [fieldErrorId, errorId]);

  function focusSlot(slot: HanjaSlot) {
    setFocusRequest((prev) => ({ id: slotButtonId(slotBase, slot), n: (prev?.n ?? 0) + 1 }));
  }

  function settleError(hide: boolean) {
    if (!fieldError) return;
    setAckedError(fieldError.id);
    if (hide) setHiddenError(fieldError.id);
  }

  function toggleSlot(slot: HanjaSlot) {
    const key = slotKey(slot);
    settleError(false);
    setPaste(null);
    setOpenKey(effectiveOpenKey === key ? null : key);
  }

  function closePanel() {
    if (!openSlot) return;
    settleError(false);
    setOpenKey(null);
    focusSlot(openSlot);
  }

  /** 고른 글자 → 선택. 성씨 칸에서 기본 한자를 고르면 '기본 한자로'와 같다(서버가 지정 없음으로 접는 값이다) */
  function choiceFor(slot: HanjaSlot, fact: HanjaFact): HanjaChoice {
    if (slot.target === "surname" && surnameDefaultAt(store.index, settled.lastName, slot.index) === fact.character) {
      return { kind: "auto" };
    }
    return { kind: "hanja", fact };
  }

  function applyChoice(slot: HanjaSlot, choice: HanjaChoice) {
    // '자동으로 고르기'도 키를 지우지 않고 값으로 둔다 — 지우면 주소로 온 한자·들고 온 글자가 다시 들어온다
    setUserChoices((prev) => new Map(prev).set(slotKey(slot), choice));
    settleError(true);
    setPaste(null);
    setOpenKey(null);
    focusSlot(slot);
  }

  /**
   * 들고 온 글자가 들어가 있는 칸을 고른 한자로 굳힌다 — 들고 온 글자는 띠를 닫거나 제출하면 사라지는데,
   * 그때 이미 칸에 들어간 글자까지 사라지면 안 된다(닫기는 안내를 접는 것이고, 제출이 실패하면 폼으로 돌아온다).
   */
  function keepCarried(slots: readonly HanjaSlot[] | null) {
    const carried = (slots ?? []).filter((slot) => slot.state === "carried" && slot.fact);
    if (carried.length === 0) return;
    setUserChoices((prev) => {
      const next = new Map(prev);
      for (const slot of carried) if (slot.fact) next.set(slotKey(slot), { kind: "hanja", fact: slot.fact });
      return next;
    });
  }

  function dismissPick() {
    keepCarried(nameSlots);
    // 누른 [닫기]는 띠째 사라진다 — 포커스를 이름 칸으로(띠 바로 아래 폼의 첫 칸 줄)
    document.getElementById(firstNameId)?.focus({ preventScroll: true });
    onPickDismiss?.();
  }

  /** 여러 글자를 붙여 넣었다 — 그 칸부터 차례로(성씨 칸에서 시작하면 이름으로 넘어간다). ⓔ 나눠 넣을 자리의 음절 파일을 받는다 */
  async function spreadFrom(startSlot: HanjaSlot, characters: string[]) {
    const start = allSlots.findIndex((slot) => slotKey(slot) === slotKey(startSlot));
    if (start < 0) return;
    const targets = allSlots.slice(start, start + characters.length).filter((slot) => slot.openable);
    await Promise.all(targets.map((slot) => requestPickFile(slot.syllable)));
    const { steps, dropped } = spreadPaste(allSlots, start, characters, getPickSnapshot().files);
    setUserChoices((prev) => {
      const next = new Map(prev);
      for (const step of steps) {
        if (step.status === "placed" && step.fact) next.set(slotKey(step.slot), choiceFor(step.slot, step.fact));
      }
      return next;
    });
    settleError(true);
    setPaste(pasteReport(steps, dropped));
    setOpenKey(null);
    focusSlot(startSlot);
  }

  // 칸 줄 아래의 안내 — 잠긴 칸·쓸 글자가 없는 칸의 까닭(음절마다 한 줄)
  const slotNotes: { id: string; text: string }[] = [];
  const noteIdOf = new Map<string, string>();
  for (const slot of allSlots) {
    const text = slotNote(slot);
    if (!text) continue;
    let note = slotNotes.find((item) => item.text === text);
    if (!note) {
      note = { id: `${noteBase}-${slotNotes.length}`, text };
      slotNotes.push(note);
    }
    noteIdOf.set(slotKey(slot), note.id);
  }
  const describedBy = (slot: HanjaSlot) => {
    const key = slotKey(slot);
    return [noteIdOf.get(key), key === errorKey ? errorId : undefined].filter(Boolean).join(" ") || undefined;
  };

  // 주소로 온 한자 가운데 그 음절 후보에 없어 비운 칸(지금 칸 줄에 그 자리·그 음절이 있고, 직접 고르지 않았을 때)
  const liveKeys = new Set(allSlots.map(slotKey));
  const seedRejected = seeded.rejected.filter(
    (item) => liveKeys.has(item.key) && !userChoices.has(item.key) && item.key !== errorKey
  );
  // 주소로 온 한자를 확인할 음절 파일을 받지 못한 칸 — 그 칸은 자동이다(제출하면 자동으로 간다). 화면이 그 사실을 칸 이름과 함께 알린다
  const seedUnchecked = seeded.pending
    .filter((item) => store.failed.has(item.syllable) && liveKeys.has(item.key) && !userChoices.has(item.key))
    .map((item) => item.syllable);

  // SSR 안전: useEffect로 style inject
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("eval-input-style")) return;
    const s = document.createElement("style");
    s.id = "eval-input-style";
    s.textContent = `
      @keyframes evalFadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
      @media (prefers-reduced-motion: reduce) { @keyframes evalFadeIn { from { opacity: 1; } to { opacity: 1; } } }
      input[type="date"]::-webkit-datetime-edit { color: transparent; }
      input[type="date"]:focus::-webkit-datetime-edit { color: var(--color-text); }
    `;
    document.head.appendChild(s);
  }, []);

  const KOREAN_RE = /^[가-힣ㄱ-ㅎㅏ-ㅣ]*$/;
  const lastValid = !lastName || KOREAN_RE.test(lastName);
  const firstValid = !firstName || KOREAN_RE.test(firstName);
  const total = (lastName + firstName).replace(/[^\S]/g, "").length;
  const tooLong = total > 5;
  const canSubmit =
    lastValid && firstValid && lastName.trim() !== "" && firstName.trim() !== "";

  // 낱자모가 남아 칸을 만들지 못한 값(한글 입력 자체가 틀린 값은 위의 '한글로 입력해주세요'가 알린다)
  const jamoPending = (unsettled.firstName && firstValid) || (unsettled.lastName && lastValid);

  function handleSubmit() {
    if (!canSubmit || loading) return;
    // 제출 직전에는 지금 값으로 칸을 다시 계산한다(조합이 끝나기를 기다리지 않는다). 한글 음절만이 아닌 쪽은 한자를 싣지 않는다.
    // 확인을 기다리는 칸('확인 중' — 주소로 온 한자·들고 온 글자)은 그 글자를 그대로 싣는다 — 서버가 다시 검사하고, 틀리면 400 으로 그 칸이 열린다
    const now = deriveSlots({ lastName, firstName }, choices, pick, store.index, store.files);
    keepCarried(now.name);
    onSubmit?.({
      lastName,
      firstName,
      birth,
      birthTime,
      gender,
      tone,
      hanja: submitMarks(now.name, waitingSeeds, pick).join(""),
      lastHanja: submitMarks(now.surname, waitingSeeds, pick).join(""),
    });
  }

  const buttonReady = canSubmit && !loading;

  return (
    <>
      {/* 들고 온 글자(#pick)의 띠 — 음절 파일로 확인된 글자만 여기까지 온다. 글자는 폼이 뜬 뒤에 오므로 알림 영역(span role=status)은
          늘 두고 안의 글만 바꾼다(글과 함께 영역째 끼우면 화면 읽기 프로그램이 첫 문장을 놓칠 수 있다). 띠가 없을 때는 높이 0 */}
      <div
        style={
          pick
            ? {
                maxWidth: 560,
                margin: "0 auto 12px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 8px 8px 16px",
                background: "var(--color-teal-50)",
                border: "1px solid var(--color-teal-100)",
                borderRadius: "var(--radius-md)",
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "var(--color-text)",
              }
            : undefined
        }
      >
        <span role="status" style={pick ? { flex: 1, minWidth: 0, wordBreak: "keep-all" } : undefined}>
          {pick ? pickBannerText(pick.character, pick.readings, settled.firstName) : ""}
        </span>
        {pick && (
          <button
            type="button"
            onClick={dismissPick}
            style={{
              appearance: "none",
              flex: "0 0 auto",
              minWidth: 52,
              minHeight: 44,
              padding: "0 10px",
              background: "transparent",
              border: "1px solid var(--color-teal)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        )}
      </div>

      {/* Form card — 수묵화 톤: 직선 + 모서리 ㄱㄴ + sumi-form (underline 입력) */}
      <div
        className="sumi-card sumi-form"
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: 0,
        }}
      >
        <Section title="이름" subtitle={`총 ${total}자`}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "30% 1fr",
              gap: 10,
            }}
          >
            <Input
              value={lastName}
              onChange={(v) => changeName("lastName", v)}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={(v) => {
                composingRef.current = false;
                commitSettle({ lastName: v, firstName });
              }}
              onBlur={() => commitSettle({ lastName, firstName })}
              placeholder="예: 김"
              invalid={!lastValid}
              ariaLabel="성"
            />
            <Input
              id={firstNameId}
              value={firstName}
              onChange={(v) => changeName("firstName", v)}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={(v) => {
                composingRef.current = false;
                commitSettle({ lastName, firstName: v });
              }}
              onBlur={() => commitSettle({ lastName, firstName })}
              placeholder="예: 서윤"
              invalid={!firstValid}
              ariaLabel="이름"
            />
          </div>
          {!firstValid && (
            <FieldHint kind="warn">한글로 입력해주세요</FieldHint>
          )}
          {firstValid && tooLong && (
            <FieldHint kind="warn">
              긴 이름은 평가 정확도가 낮아질 수 있어요
            </FieldHint>
          )}
          <div style={{ marginTop: 14 }}>
            <NamePreview lastName={lastName} firstName={firstName} />
          </div>

          {/* 한자 칸 — 늘 보인다(접는 것은 고르기 패널뿐). 이름을 넣기 전에는 안내 한 줄 */}
          <div
            style={{ marginTop: 16 }}
            onKeyDown={(e) => {
              // 칸에 포커스가 있을 때의 Esc — 패널 안의 Esc 는 패널이 받는다
              if (e.key === "Escape" && !e.nativeEvent.isComposing && openSlot) closePanel();
            }}
          >
            {allSlots.length > 0 && slotsReady && (
              <>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    gap: "2px 8px",
                    marginBottom: 10,
                  }}
                >
                  <span
                    id={slotsTitleId}
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}
                  >
                    {SLOTS_TITLE}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--color-text-2)", lineHeight: 1.5 }}>
                    {SLOTS_HINT}
                  </span>
                </div>
                <HanjaSlots
                  surname={surnameSlots}
                  name={nameSlots}
                  idBase={slotBase}
                  openKey={openSlot ? slotKey(openSlot) : null}
                  panelId={panelId}
                  labelledBy={slotsTitleId}
                  invalidKey={errorKey}
                  describedBy={describedBy}
                  onToggle={toggleSlot}
                />
              </>
            )}
            {allSlots.length > 0 && !slotsReady && (
              <p role="status" style={slotGuideStyle}>
                {SLOTS_PREPARING}
              </p>
            )}
            {nameSlots.length === 0 && !jamoPending && <p style={slotGuideStyle}>{SLOTS_EMPTY_GUIDE}</p>}
            {jamoPending && <p style={slotGuideStyle}>{SLOTS_JAMO_NOTE}</p>}

            {slotsReady &&
              slotNotes.map((note) => (
                <p key={note.id} id={note.id} style={slotNoteStyle}>
                  {note.text}
                </p>
              ))}
            {shownError && (
              <p id={errorId} role="alert" style={slotAlertStyle}>
                {shownError.message}
              </p>
            )}
            {seedRejected.map((item) => (
              <p key={item.key} role="alert" style={slotAlertStyle}>
                {seedRejectedNote(item.character, item.syllable)}
              </p>
            ))}
            {seedUnchecked.length > 0 && (
              <p role="alert" style={slotAlertStyle}>
                {seedUncheckedNote(seedUnchecked)}
              </p>
            )}
            {/* 나눠 넣은 결과 — 알림 영역은 늘 두고 안의 글만 바꾼다 */}
            <p role="status" style={paste?.status ? slotNoteStyle : emptyStatusStyle}>
              {paste?.status ?? ""}
            </p>
            {paste?.alerts.map((text, i) => (
              <p key={i} role="alert" style={slotAlertStyle}>
                {text}
              </p>
            ))}
            {isMixedScript(nameSlots) && <p style={slotNoteStyle}>{MIXED_SCRIPT_NOTICE}</p>}

            {openSlot && slotsReady && (
              <HanjaPickerPanel
                key={slotKey(openSlot)}
                id={panelId}
                slot={openSlot}
                representative={
                  openSlot.target === "surname"
                    ? surnameDefaultAt(store.index, settled.lastName, openSlot.index)
                    : null
                }
                forbiddenCount={store.index?.counts.forbidden ?? null}
                onPick={(fact) => applyChoice(openSlot, choiceFor(openSlot, fact))}
                onAuto={() => applyChoice(openSlot, { kind: "auto" })}
                onNone={openSlot.target === "name" ? () => applyChoice(openSlot, { kind: "none" }) : undefined}
                onClose={closePanel}
                onSpread={(characters) => void spreadFrom(openSlot, characters)}
              />
            )}
          </div>
        </Section>

        <Divider />

        <Section title="출생일">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 10,
            }}
          >
            <DateInput value={birth} onChange={setBirth} />
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              style={{
                appearance: "none",
                width: "100%",
                boxSizing: "border-box",
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                color: birthTime ? "var(--color-text)" : "var(--color-text-3)",
                padding: "12px 14px",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                outline: "none",
              }}
              aria-label="출생 시각 (선택, 시주 반영)"
              placeholder="시:분"
            />
          </div>
          {/* 날짜 없는 시각은 평가에 쓰지 않는다(evaluate-params timeWithDate) — 조용히 버리지 않고 알린다 */}
          {birthTime && !birth && (
            <FieldHint kind="warn">출생 시각은 생년월일과 함께 넣어야 반영돼요</FieldHint>
          )}
          <button
            type="button"
            onClick={() => setOpenBirthHelp((o) => !o)}
            style={helpToggleStyle}
          >
            <span
              style={{
                display: "inline-block",
                transition: "transform 180ms",
                transform: openBirthHelp ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▸
            </span>
            출생 정보가 왜 필요한가요?
          </button>
          {openBirthHelp && (
            <div style={helpBodyStyle}>
              사주 오행을 분석해 이름과의 조화를 계산해요.
              <br />
              출생일을 입력하지 않으면 미학 점수만 평가됩니다.
              <br />
              출생 시각까지 알면 시주(時柱)도 반영해 4기둥 분석이 가능해요.
            </div>
          )}
        </Section>

        <Divider />

        <Section title="성별">
          <Segmented
            options={["남", "여", "중립"]}
            value={gender}
            onChange={(v) =>
              setGender(v as EvalSubmitPayload["gender"])
            }
          />
          <FieldHint>중립은 성별 무관 평가를 진행해요</FieldHint>
        </Section>

        <Divider />

        <Section title="톤">
          <Segmented
            options={["부드러운", "중립", "강한"]}
            value={tone}
            onChange={(v) => setTone(v as EvalSubmitPayload["tone"])}
          />
          <button
            type="button"
            onClick={() => setOpenToneHelp((o) => !o)}
            style={helpToggleStyle}
          >
            <span
              style={{
                display: "inline-block",
                transition: "transform 180ms",
                transform: openToneHelp ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▸
            </span>
            톤이 평가에 어떻게 반영되나요?
          </button>
          {openToneHelp && (
            <div style={helpBodyStyle}>
              톤은 발음·받침·자음 강도에 대한 선호를 의미해요.
              <br />
              평가 시 입력 톤과 이름의 실제 톤을 함께 보여드립니다.
            </div>
          )}
        </Section>

        <div
          style={{
            padding: "20px 24px 24px",
            borderTop: "1px solid #F0EAE0",
          }}
        >
          {/* 제출 — 수묵화 톤: 풀폭 명조 + 朱印 名 도장. 비활성 시도 cursor:default로 부드럽게 */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!buttonReady}
              aria-busy={loading}
              style={{
                width: "100%",
                padding: "16px 22px",
                background: buttonReady
                  ? "var(--color-ink-jiao)"
                  : "var(--color-surface-2)",
                color: buttonReady
                  ? "var(--color-background)"
                  : "var(--color-text-3)",
                border: "none",
                borderRadius: 0,
                fontFamily: "var(--font-serif)",
                fontSize: 15,
                fontWeight: 700,
                cursor: buttonReady ? "pointer" : "default",
                letterSpacing: "0.1em",
                transition: "all 180ms",
              }}
            >
              {loading
                ? "살펴보는 중이에요…"
                : canSubmit
                  ? "이 이름 살펴보기"
                  : firstName.trim() !== "" && lastName.trim() === ""
                    ? "성씨를 입력해주세요"
                    : "이름을 입력해주세요"}
            </button>
            {buttonReady && (
              <span className="sumi-stamp-name" aria-hidden>名</span>
            )}
          </div>
          {canSubmit && !loading && !birth && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12.5,
                color: "var(--color-text-2)",
                textAlign: "center",
              }}
            >
              출생일 없이 진행하면 미학 점수만 평가돼요
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          color: "var(--color-text-2)",
          flexWrap: "wrap",
          gap: 16,
          maxWidth: 560,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <Link
          href="/"
          style={{ color: "var(--color-text-2)", textDecoration: "none" }}
        >
          ← 홈으로 돌아가기
        </Link>
        <span>
          추천을 받고 싶으시면?{" "}
          <Link
            href="/search"
            style={{
              color: "var(--color-teal)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            작명하러 가기 →
          </Link>
        </span>
      </div>

      <section
        style={{
          marginTop: 40,
          padding: "28px 28px 24px",
          borderTop: "1px solid #F0EAE0",
          maxWidth: 560,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <h2
          style={{
            margin: "0 0 14px",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text)",
            letterSpacing: "-0.01em",
          }}
        >
          평가 후 어떤 결과를 받나요?
        </h2>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 10,
          }}
        >
          <InfoRow
            icon={<Music size={20} strokeWidth={1.5} />}
            label="미학 점수"
            detail="발음·리듬·음절·세대중립·의미"
          />
          {/* 조화 축은 HarmonyEngine 산식과 같게 — 옛 '성조화'는 발음오행에 흡수돼 항상 0 (감사 EV-2).
              축 이름은 2026-10-22 S4 백엔드와 같다(옛 '오행 30' = 자원오행 보완, 옛 '자원오행 20' = 획수 조화) */}
          <InfoRow
            icon={<Leaf size={20} strokeWidth={1.5} />}
            label="조화 점수"
            detail="자원오행 보완·획수 조화·음양·발음오행·전통 81수리(참고) — 출생일 있을 때"
          />
          <InfoRow
            icon={<BookOpen size={20} strokeWidth={1.5} />}
            label="한자 후보 분석"
            detail="뜻·자원오행·획수 — 직접 골라 다시 계산할 수 있어요"
          />
        </ul>
      </section>
    </>
  );
}

// ============================================================
// Reusable atoms
// ============================================================
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "22px 24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text)",
          }}
        >
          {title}
        </label>
        {subtitle && (
          <span
            style={{
              fontFamily: "Inter, var(--font-sans)",
              fontSize: 12,
              color: "var(--color-text-3)",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#F0EAE0", margin: 0 }} />;
}

function Input({
  id,
  value,
  onChange,
  onCompositionStart,
  onCompositionEnd,
  onBlur,
  placeholder,
  invalid,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  /** 한글 조합 시작·끝 — 칸 줄은 조합이 끝난 값으로만 다시 그린다(끝날 때 그때의 값을 넘긴다) */
  onCompositionStart?: () => void;
  onCompositionEnd?: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onCompositionStart={onCompositionStart}
      onCompositionEnd={(e) => onCompositionEnd?.(e.currentTarget.value)}
      onBlur={onBlur}
      style={{
        appearance: "none",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        color: "var(--color-text)",
        padding: "12px 14px",
        background: "var(--color-surface)",
        border:
          "1px solid " +
          (invalid ? "var(--color-gold-600)" : "var(--color-border)"),
        borderRadius: "var(--radius-md)",
        outline: "none",
      }}
    />
  );
}

const emptySubscribe = () => () => {};

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const formatted = value
    ? `${value.slice(0, 4)}년 ${parseInt(value.slice(5, 7), 10)}월 ${parseInt(value.slice(8, 10), 10)}일`
    : "";
  // SSR/hydration 안전: 서버 스냅샷은 undefined, 클라이언트에서만 today 계산.
  // 오늘은 한국 시간(todayKst — /ohaeng 과 같은 함수). 옛 toISOString() 은 UTC 날짜라 한국 0~9시에는 max 가 어제가 되어
  // 오늘 태어난 아기의 생년월일을 고를 수 없었다(2026-11-26)
  const today = useSyncExternalStore(emptySubscribe, () => todayKst(), () => undefined);
  return (
    <div style={{ position: "relative" }}>
      <input
        type="date"
        value={value}
        max={today}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "var(--font-sans)",
          fontSize: 15,
          color: value ? "transparent" : "var(--color-text-3)",
          padding: "12px 14px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          outline: "none",
        }}
      />
      {value && (
        <div
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            color: "var(--color-text)",
            pointerEvents: "none",
          }}
        >
          {formatted}
        </div>
      )}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: 6,
        background: "var(--color-surface-2)",
        padding: 4,
        borderRadius: "var(--radius-md)",
      }}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              appearance: "none",
              border: "none",
              padding: "9px 12px",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              background: active ? "var(--color-teal-50)" : "transparent",
              color: active ? "var(--color-teal)" : "var(--color-text-2)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 160ms",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function FieldHint({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: "info" | "warn";
}) {
  const color =
    kind === "warn" ? "var(--color-amber-warm-700)" : "var(--color-text-3)";
  return (
    <div
      style={{ marginTop: 8, fontSize: 12.5, color, lineHeight: 1.5 }}
    >
      {children}
    </div>
  );
}

function NamePreview({
  lastName,
  firstName,
}: {
  lastName: string;
  firstName: string;
}) {
  const full = (lastName + firstName).trim();
  if (!full) {
    return (
      <div
        style={{
          padding: "16px 18px",
          background: "var(--color-background)",
          borderRadius: "var(--radius-md)",
          border: "1px dashed var(--color-divider)",
          color: "var(--color-text-3)",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        입력하시면 여기에 이름이 보여요
      </div>
    );
  }
  return (
    <div
      style={{
        padding: "18px 20px",
        background: "var(--color-background)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-divider)",
        display: "flex",
        alignItems: "baseline",
        gap: 10,
      }}
    >
      <span
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 10,
          color: "var(--color-text-3)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginRight: 4,
        }}
      >
        Preview
      </span>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 28,
          fontWeight: 500,
          color: "var(--color-text)",
          letterSpacing: "-0.015em",
          animation: "evalFadeIn 220ms cubic-bezier(.2,.6,.2,1)",
        }}
      >
        {full}
      </span>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  detail,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        fontSize: 13.5,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
        }}
      >
        {icon}
      </span>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <b style={{ fontWeight: 600, color: "var(--color-text)" }}>{label}</b>
        <span style={{ color: "var(--color-text-2)" }}>· {detail}</span>
      </div>
    </li>
  );
}

/** 한자 칸 줄의 안내(이름을 넣기 전·낱자모가 남음·준비 중) */
const slotGuideStyle: CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "var(--color-text-2)",
  wordBreak: "keep-all",
};

/** 칸 줄 아래의 안내 한 줄(잠긴 칸의 까닭·나눠 넣은 결과·혼용 고지) */
const slotNoteStyle: CSSProperties = { ...slotGuideStyle, marginTop: 8 };

/** 칸 줄 아래의 오류 문장(role="alert") — 작은 글씨는 amber-warm-700 */
const slotAlertStyle: CSSProperties = { ...slotNoteStyle, color: "var(--color-amber-warm-700)" };

/** 비어 있는 알림 영역(role="status") — 늘 문서에 두고 글만 바꾼다. 빈 동안 높이 0 */
const emptyStatusStyle: CSSProperties = { margin: 0 };

const helpToggleStyle: CSSProperties = {
  marginTop: 12,
  appearance: "none",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-text-2)",
};

const helpBodyStyle: CSSProperties = {
  marginTop: 10,
  padding: "12px 14px",
  background: "var(--color-background)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-divider)",
  fontSize: 13,
  color: "var(--color-text-2)",
  lineHeight: 1.65,
};
