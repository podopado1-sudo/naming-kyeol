/**
 * Hero — 홈 메인 섹션 (이름 추천/평가 모드 듀얼 탭 + 입력 폼)
 * Source: NameForm_design/src/Hero.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState → useState import
 *   - React.Fragment → <></> 단축 사용
 *   - Button → ./Primitives에서 import
 *   - 2026-10-21: 이동(handleHeroStart)을 홈 page.tsx에서 이 컴포넌트로 옮김 — 홈이 리포트 목록을
 *     서버에서 읽는 서버 컴포넌트가 되어 콜백을 넘길 수 없다. onStart를 주면 그쪽이 우선.
 */
"use client";

import { Fragment, useId, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Primitives";
import { ambiguousCompoundSurname, readParentPair, splitFullName } from "@/lib/name-split";
import { ENGLISH_NAME_MAX, englishNameProblem } from "@/lib/english-name";
import { needsFreshDocument } from "@/lib/ad-scope";
import {
  SURNAME_MAX_LENGTH,
  cleanNameInput,
  nameInputMessage,
  nameInputProblem,
} from "@/lib/name-input";
import { withJosa } from "@/lib/josa";

// 타이핑 효과는 수묵화 톤과 어울리지 않아 제거됨.
// 헤드라인은 글자별 잉크 드롭 (.ink-char) 으로 표시.
// (globals.css 의 nk-ink-char keyframes 참조)

/**
 * InkChars — 텍스트를 한 글자씩 분해해 .ink-char 애니메이션을 부여.
 * baseDelay: 첫 글자 등장까지 대기 (ms)
 * step:      글자 간 간격 (ms, default 80 — 공백도 한 칸으로 센다)
 *
 * 글자마다 inline-block 이라 그대로 두면 아무 글자 사이에서나 줄이 바뀐다(휴대폰 폭에서 '증명됩니 / 다.' —
 * keep-all 은 inline-block 사이에 듣지 않는다, 2026-11-27 hero-mobile-text). 그래서 낱말마다 줄바꿈 없는 span 으로
 * 묶고(마침표도 앞 글자와 같은 낱말) 낱말 사이에는 보통 공백을 둬 줄은 공백에서만 바뀐다.
 */
function InkChars({
  text,
  baseDelay = 0,
  step = 80,
}: {
  text: string;
  baseDelay?: number;
  step?: number;
}) {
  const chars = Array.from(text);
  // 낱말 = 공백이 아닌 글자 묶음, start = 그 낱말 첫 글자의 원문 위치(지연 계산용)
  const words: { start: number; chars: string[] }[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === " ") continue;
    const last = words[words.length - 1];
    if (last && last.start + last.chars.length === i) last.chars.push(chars[i]);
    else words.push({ start: i, chars: [chars[i]] });
  }
  return (
    <>
      {words.map((word, wi) => (
        <Fragment key={word.start}>
          {wi > 0 && " "}
          <span style={{ whiteSpace: "nowrap" }}>
            {word.chars.map((ch, ci) => (
              <span
                key={ci}
                className="ink-char"
                style={{ animationDelay: `${baseDelay + (word.start + ci) * step}ms` }}
              >
                {ch}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </>
  );
}

/** 빈 칸·잘못된 칸 알림 흔들기 — globals.css nk-shake 와 같은 움직임 */
const SHAKE_KEYFRAMES: Keyframe[] = [
  { transform: "translateX(0)", offset: 0 },
  { transform: "translateX(-5px)", offset: 0.18 },
  { transform: "translateX(5px)", offset: 0.36 },
  { transform: "translateX(-3px)", offset: 0.54 },
  { transform: "translateX(3px)", offset: 0.72 },
  { transform: "translateX(-1px)", offset: 0.9 },
  { transform: "translateX(0)", offset: 1 },
];

/**
 * 칸으로 커서를 보내고 흔든다. 옛 코드는 칸의 key 를 바꿔 다시 마운트해서 흔들었는데, focus() 다음에 마운트가
 * 일어나 커서가 사라졌다(2026-11-27 hero-guide-text-focus — 클릭 뒤 activeElement 가 BODY).
 * 이제 칸은 그대로 두고 Web Animations 로 매번 다시 흔든다. 줄인 움직임 설정이면 흔들지 않는다.
 */
function notifyField(el: HTMLElement | null) {
  if (!el) return;
  el.focus();
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion && typeof el.animate === "function") {
    el.animate(SHAKE_KEYFRAMES, {
      duration: 480,
      easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)",
    });
  }
}

/**
 * Hero 그림 — 미리 줄여 둔 WebP(800·1200·1600w, 원본 1672×941 비율)를 싣는다. next/image 는 쓰지 않는다
 * (Vercel 이미지 최적화 과금 — 사용자 결정). WebP 를 못 읽는 브라우저만 원본 PNG(1.3MB)를 받는다.
 * 옛 코드는 휴대폰에서도 그 PNG 를 그대로 받았다(2026-11-27 hero-image-unoptimized).
 * sizes 는 globals.css .hero-illustration-wrap 의 폭: 600px 이하는 4:3 상자를 object-fit: cover 로 채워
 * 그림 폭 = 상자 폭 × 4/3 × 1672/941(≈ 1.34배), 601~900px 은 섹션 안쪽 + 32px, 그 위는 섹션 폭(최대 1120px).
 */
const HERO_IMAGE_SRCSET =
  "/hero-illustration-800.webp 800w, /hero-illustration-1200.webp 1200w, /hero-illustration-1600.webp 1600w";
const HERO_IMAGE_SIZES =
  "(max-width: 600px) calc((100vw - 64px) * 1.34), (max-width: 900px) calc(100vw - 32px), (max-width: 1120px) 100vw, 1120px";

export type HeroStartPayload =
  | {
      mode: "recommend";
      lastName: string;
      gender: string;
      tone: string;
      birth: string;
      /** 출생 시각 (HH:mm, 선택) — 사주 시주(時柱) 계산에 사용 */
      birthTime?: string;
      parentName?: string;
      story?: string;
      englishName?: string;
    }
  | {
      mode: "evaluate";
      name: string;
      gender?: string;
      tone?: string;
      birth?: string;
      birthTime?: string;
    };

/** Hero 입력 → /search 쿼리. 성씨가 있으면 autoStart로 결과까지 바로 간다. */
function recommendHref(payload: Extract<HeroStartPayload, { mode: "recommend" }>): string {
  const params = new URLSearchParams();
  if (payload.lastName) params.set("lastName", payload.lastName);
  if (payload.birth) params.set("birthDate", payload.birth);
  if (payload.birthTime) params.set("birthTime", payload.birthTime);
  if (payload.gender && payload.gender !== "any")
    params.set("gender", payload.gender);
  if (payload.tone) params.set("tone", payload.tone);
  if (payload.parentName) params.set("parentName", payload.parentName);
  if (payload.story) params.set("story", payload.story);
  if (payload.englishName) params.set("englishName", payload.englishName);
  // 성씨가 들어왔으면 자동 제출까지 진행 (Hero에서 한 번에 결과 확인)
  if (payload.lastName) params.set("autoStart", "1");
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

/**
 * Hero 입력 → /evaluate 쿼리. 성+이름 한 덩어리("김서준")는 splitFullName으로 나눈다 —
 * charAt(0)로 자르면 '남궁민'이 '남'+'궁민'으로 평가됐다(감사 EV-6). 성·이름만 있어도
 * /evaluate가 자동 평가한다(성별 '상관없음'·출생일 없음은 none·미학만으로).
 */
function evaluateHref(payload: Extract<HeroStartPayload, { mode: "evaluate" }>): string {
  const params = new URLSearchParams();
  const { lastName, name } = splitFullName(payload.name);
  if (lastName) params.set("lastName", lastName);
  if (name) params.set("name", name);
  if (payload.birth) params.set("birthDate", payload.birth);
  // 출생 시각은 생년월일과 함께일 때만 — /evaluate도 날짜 없는 시각은 버린다(evaluate-params timeWithDate)
  if (payload.birth && payload.birthTime) params.set("birthTime", payload.birthTime);
  // Hero가 recommend/evaluate 모두 "any"를 sentinel로 사용 → 통일된 처리
  if (payload.gender && payload.gender !== "any" && payload.gender !== "none")
    params.set("gender", payload.gender);
  if (payload.tone) params.set("tone", payload.tone);
  return `/evaluate?${params.toString()}`;
}

export function Hero({
  onStart,
}: {
  /** 지정하면 기본 이동 대신 호출 (기본: 추천 → /search, 평가 → /evaluate) */
  onStart?: (payload: HeroStartPayload) => void;
}) {
  const router = useRouter();

  function start(payload: HeroStartPayload) {
    if (onStart) {
      onStart(payload);
      return;
    }
    if (payload.mode === "recommend") {
      const href = recommendHref(payload);
      // 홈은 광고 로더를 싣는 화면이다(lib/ad-scope.ts). 로더가 돈 문서로 /search 에 가면 입력값(성·생년월일·부모 이름)이 든 주소와
      // 광고 스크립트가 한 문서에 있게 되므로 새 문서로 연다. 로더가 없으면(로컬·미설정) 예전처럼 클라이언트 이동
      if (needsFreshDocument("/search")) window.location.assign(href);
      else router.push(href);
    } else {
      // 풀 페이지 이동 — /evaluate 정적 라우트의 클라이언트 라우터 캐시가
      // 이전 ?name=... 을 재사용하는 문제 우회 (검색 상세보기와 동일 처리).
      window.location.assign(evaluateHref(payload));
    }
  }

  const [mode, setMode] = useState<"recommend" | "evaluate">("recommend");
  const [advOpen, setAdvOpen] = useState(false);

  // recommend inputs
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("any");
  const [tone, setTone] = useState("neutral");
  const [birth, setBirth] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [parentName, setParentName] = useState("");
  const [story, setStory] = useState("");
  const [englishName, setEnglishName] = useState("");
  // /search와 같은 검증 — 한글('다니엘')·31자 이상이 넘어가면 /search가 autoStart 추천 전체를
  // 멈추고 폼에 머물렀다(검토 FTE-3). 넘기기 전에 여기서 안내한다
  const englishNameIssue = englishNameProblem(englishName);
  const englishNameRef = useRef<HTMLInputElement | null>(null);

  // evaluate inputs
  const [evalQuery, setEvalQuery] = useState("");

  // 필수 입력 누락 시 흔들기·주홍 밑줄 안내용
  // birth input은 recommend/evaluate 모드 모두 동일 ref 공유 (한 번에 한 모드만 렌더됨)
  const lastNameRef = useRef<HTMLInputElement | null>(null);
  const evalQueryRef = useRef<HTMLInputElement | null>(null);
  const birthRef = useRef<HTMLInputElement | null>(null);
  // 단추를 한 번 눌러 본 뒤에만 빈 칸을 주홍 밑줄로 표시한다(모드마다 따로)
  const [recommendTried, setRecommendTried] = useState(false);
  const [evaluateTried, setEvaluateTried] = useState(false);
  // 성씨 칸 검사 — 빈 칸이 아닌 문제(金·ㅅ·영문·3자 이상)는 단추를 눌렀을 때 문장으로 알리고, 칸을 고치면 지운다.
  // 옛 칸은 빈 값만 막고 입력을 2자로 잘라('김서윤' → '김서') 그대로 /search 로 보냈다(2026-11-27 hero-surname-unvalidated).
  // 실제 성씨인지(사전)는 보지 않는다 — 희귀 성씨 도구가 목록 밖 성도 받는다(lib/name-input.ts)
  const [surnameError, setSurnameError] = useState<string | null>(null);
  const lastNameEmpty = !cleanNameInput(lastName);

  // 라벨 ↔ 칸 연결(2026-11-27 labels-hero — 화면 읽기 프로그램이 성씨 칸을 '예: 김'으로만 읽었다)
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  // 부모 이름 한 칸을 /search 가 어떻게 가를지 미리 보여 준다(같은 함수 — lib/name-split readParentPair)
  const parentReading = readParentPair(parentName);
  const parentHint = !parentName.trim()
    ? null
    : parentReading.unclear
      ? `'${parentReading.father}' 한 분으로 읽어요. 두 분이면 '김민호 · 이수정'처럼 가운뎃점(·)으로 나눠 주세요.`
      : parentReading.mother
        ? `아버지 ${parentReading.father} · 어머니 ${withJosa(parentReading.mother, "으로/로")} 읽어요.`
        : null;

  // 헤드라인 — 글자별 잉크 드롭 reveal (붓이 종이 위에 한 글자씩 쓰는 느낌)
  const HERO_LINE_1 = "결이 고운 이름은";
  const HERO_LINE_2 = "시간이 흐를수록 증명됩니다.";

  // 수묵화 톤 — underline-only 필드 (서예 종이 필기 느낌).
  // background/border/radius는 .sumi-field 클래스의 !important로 제어,
  // 여기서는 폰트/사이즈/색만 지정.
  const fieldStyle: CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: 15,
    color: "var(--color-text)",
    minHeight: 40,
  };

  const labelStyle: CSSProperties = {
    fontSize: 12,
    color: "var(--color-text-2)",
    fontWeight: 500,
    marginBottom: 6,
    display: "block",
  };

  // 칸 아래 한 줄 안내(부모 이름 읽기)와 오류 문장(성씨) — 영어 이름 오류와 같은 꼴
  const fieldNoteStyle: CSSProperties = {
    margin: "6px 0 0",
    fontSize: 12,
    lineHeight: 1.5,
    color: "var(--color-text-3)",
  };
  const fieldErrorStyle: CSSProperties = {
    ...fieldNoteStyle,
    color: "var(--color-vermilion)",
  };

  // 평가 입력이 어떻게 나뉘는지 미리 보여 준다 — 붙여 쓴 '선우진'은 선 + 우진으로 읽으므로
  // 진짜 복성은 띄어 쓰게 안내한다(name-split.ts 규칙 3). 안내는 복성으로도 읽히는 앞머리
  // (황보·서문·강전·선우)를 1자 성으로 읽었을 때만 — 김서준·이하윤에는 붙이지 않는다(검토 FTE-4)
  const evalSplit = splitFullName(evalQuery);
  const evalCompoundHint = ambiguousCompoundSurname(evalQuery);

  const popularLast = ["김", "이", "박", "최", "정"];
  // 평가 예시는 성까지 붙인다 — 이름만 넘기면 '서준'이 성 '서' + 이름 '준'으로 평가됐다(감사 EV-6)
  const popularFull = ["김서준", "이하윤", "박지안", "최도헌"];

  const selectChevronBg =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' stroke='%235a6b7a' stroke-width='1.3' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")";

  return (
    <section
      style={{
        position: "relative",
        padding: "88px 32px 72px",
        maxWidth: 1120,
        margin: "0 auto",
        overflow: "hidden",
      }}
    >
      {/* 수묵화 톤 — 먹 번짐 배경 얼룩 2개 (Hero의 회화적 분위기) */}
      <span
        aria-hidden
        className="ink-wash"
        style={{ top: -40, left: -80, width: 380, height: 320 }}
      />
      <span
        aria-hidden
        className="ink-wash ink-wash--soft"
        style={{ top: 80, right: -40, width: 320, height: 280 }}
      />

      {/* 붓요정 Hero 일러스트 — 반응형은 globals.css .hero-illustration-wrap 참조.
          Desktop: section padding 까지 확장, Mobile: 컨테이너 안에 fit + 더 정사각 비율. */}
      <div className="hero-illustration-wrap">
        <picture style={{ display: "block", width: "100%", height: "100%" }}>
          <source type="image/webp" srcSet={HERO_IMAGE_SRCSET} sizes={HERO_IMAGE_SIZES} />
          <img
            src="/hero-illustration.png"
            width={1672}
            height={941}
            fetchPriority="high"
            alt="이름의 결 마스코트 — 붓요정이 名 두루마리를 들고 있는 모습"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 60%",
              filter: "drop-shadow(0 10px 24px rgba(44, 42, 38, 0.08))",
            }}
          />
        </picture>
      </div>

      <div
        style={{
          position: "relative",
          maxWidth: 720,
          margin: "0 auto",
          textAlign: "center",
        }}
      >

        {/* eyebrow — globals.css .eyebrow 클래스 (수묵 톤 통일) */}
        <div className="eyebrow" style={{ marginBottom: 24 }}>
          발음 · 의미 · 세대 중립
        </div>
        <h1
          style={{
            // 반응형 — 모바일 22px → 데스크탑 52px 사이에서 viewport 비례 스케일.
            // 아래 끝이 22px 인 것은 둘째 줄('시간이 흐를수록 증명됩니다.' ≈ 12.4em)이 360·375 폭(글 자리 296·311px)에서
            // 한 줄에 들게 — 26px 이면 세 줄이 됐다(2026-11-27 hero-mobile-text). 434px 이상은 예전과 같다
            fontSize: "clamp(22px, 6vw, 52px)",
            lineHeight: 1.3,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--color-text)",
            margin: 0,
            marginBottom: 20,
            wordBreak: "keep-all",
          }}
          aria-label={`${HERO_LINE_1} ${HERO_LINE_2}`}
        >
          {/* 1줄: 옅은 농도(濃) — 한 글자씩 80ms 간격 */}
          <span
            style={{
              display: "inline-block",
              fontWeight: 400,
              color: "var(--color-ink-nong)",
            }}
          >
            <InkChars text={HERO_LINE_1} baseDelay={200} step={80} />
          </span>
          <br />
          {/* 2줄: 짙은 농도(焦) — 1줄이 절반쯤 진행될 때 시작 */}
          <span style={{ display: "inline-block" }}>
            <InkChars text={HERO_LINE_2} baseDelay={1000} step={80} />
          </span>
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.7,
            color: "var(--color-text-2)",
            maxWidth: 560,
            margin: "0 auto 28px",
          }}
        >
          유행이 아닌 발음, 의미, 세대 중립도를 기준으로 이름을 살펴봅니다.
          <br />
          아기·개명 — 목적에 맞게 이름의 결을 읽어드려요.
        </p>

        {/* Form card — 수묵화 톤: 모서리 ㄱㄴ 액센트 + 얇은 먹선 */}
        <div
          className="sumi-card"
          style={{
            padding: 28,
            maxWidth: 640,
            margin: "0 auto",
            textAlign: "left",
          }}
        >
          {/* 탭 (recommend/evaluate) — 수묵화: pill → 밑줄 탭 */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--color-ink-qing)",
              margin: "-4px -4px 24px",
            }}
          >
            {[
              { key: "recommend" as const, label: "이름 추천" },
              { key: "evaluate" as const, label: "이름 평가" },
            ].map((t) => {
              const active = mode === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setMode(t.key)}
                  style={{
                    flex: 1,
                    appearance: "none",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "12px 0",
                    fontFamily: "var(--font-serif)",
                    fontSize: 15,
                    fontWeight: active ? 700 : 500,
                    color: active
                      ? "var(--color-ink-jiao)"
                      : "var(--color-text-3)",
                    position: "relative",
                    transition: "color 180ms",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                  {active && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        bottom: -1,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: "var(--color-ink-jiao)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            style={{
              transition:
                "opacity 240ms ease, transform 240ms cubic-bezier(.2,.6,.2,1)",
            }}
          >
            {mode === "recommend" && (
              <div>
                {/* 성씨 · 성별 · 톤 — 640px 미만은 성씨 한 줄 + 성별·톤 두 칸(3칸이면 375 폭에서 '상관없음'·'부드럽게'가
                    잘렸다 — hero-mobile-text), 그 위는 예전 3칸. 열은 className 으로(인라인 grid 는 미디어 쿼리를 이긴다) */}
                <div
                  className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1fr_1.1fr_1.1fr]"
                  style={{ marginBottom: 12 }}
                >
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor={fieldId("lastName")} style={labelStyle}>
                      성씨{" "}
                      <span style={{ color: "var(--color-text-3)" }}>
                        (필수 · 2자 이내)
                      </span>
                    </label>
                    <input
                      ref={lastNameRef}
                      id={fieldId("lastName")}
                      value={lastName}
                      onChange={(e) => {
                        // 2자로 자르지 않는다 — 넘치면 단추를 누를 때 '2글자까지' 안내(옛 자르기는 '김서윤'을 '김서'로 보냈다)
                        setLastName(e.target.value);
                        if (surnameError) setSurnameError(null);
                      }}
                      placeholder="예: 김"
                      autoComplete="off"
                      aria-required="true"
                      aria-invalid={
                        surnameError || (recommendTried && lastNameEmpty)
                          ? true
                          : undefined
                      }
                      aria-describedby={
                        surnameError ? fieldId("lastName-error") : undefined
                      }
                      className={
                        surnameError || (recommendTried && lastNameEmpty)
                          ? "sumi-field sumi-field--needs"
                          : "sumi-field"
                      }
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor={fieldId("gender")} style={labelStyle}>
                      성별
                    </label>
                    <select
                      id={fieldId("gender")}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="sumi-field"
                      style={{
                        ...fieldStyle,
                        appearance: "none",
                        backgroundImage: selectChevronBg,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                        paddingRight: 32,
                      }}
                    >
                      <option value="any">상관없음</option>
                      <option value="female">여자</option>
                      <option value="male">남자</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={fieldId("tone")} style={labelStyle}>
                      톤
                    </label>
                    <select
                      id={fieldId("tone")}
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="sumi-field"
                      style={{
                        ...fieldStyle,
                        appearance: "none",
                        backgroundImage: selectChevronBg,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                        paddingRight: 32,
                      }}
                    >
                      <option value="soft">부드럽게</option>
                      <option value="neutral">중립</option>
                      <option value="strong">강하게</option>
                    </select>
                  </div>
                </div>
                {surnameError && (
                  <p
                    id={fieldId("lastName-error")}
                    role="alert"
                    style={{ ...fieldErrorStyle, margin: "-4px 0 12px" }}
                  >
                    {surnameError}
                  </p>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label htmlFor={fieldId("birth")} style={labelStyle}>
                      생년월일{" "}
                      <span style={{ color: "var(--color-text-3)" }}>
                        (필수 · 사주 반영)
                      </span>
                    </label>
                    <input
                      ref={birthRef}
                      id={fieldId("birth")}
                      type="date"
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                      aria-required="true"
                      aria-invalid={recommendTried && !birth ? true : undefined}
                      className={
                        recommendTried && !birth
                          ? "sumi-field sumi-field--needs"
                          : "sumi-field"
                      }
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor={fieldId("birthTime")} style={labelStyle}>
                      출생 시각{" "}
                      <span
                        style={{
                          color: "var(--color-text-3)",
                          whiteSpace: "nowrap",
                          fontSize: 11,
                        }}
                      >
                        (선택)
                      </span>
                    </label>
                    <input
                      id={fieldId("birthTime")}
                      type="time"
                      value={birthTime}
                      onChange={(e) => setBirthTime(e.target.value)}
                      className="sumi-field"
                      style={fieldStyle}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAdvOpen(!advOpen)}
                  style={{
                    appearance: "none",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    marginBottom: advOpen ? 12 : 0,
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-2)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  고급 옵션{" "}
                  <span
                    style={{
                      display: "inline-block",
                      transform: advOpen ? "rotate(180deg)" : "none",
                      transition: "transform 200ms",
                    }}
                  >
                    ▾
                  </span>
                </button>

                {advOpen && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginBottom: 12,
                      paddingTop: 4,
                    }}
                  >
                    {/* 안내: 입력하면 해당 추천 카테고리가 자동으로 켜짐 */}
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "10px 12px",
                        background: "var(--color-teal-50)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 12,
                        lineHeight: 1.55,
                        color: "var(--color-text-2)",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          flexShrink: 0,
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          border: "1px solid var(--color-teal)",
                          color: "var(--color-teal)",
                          fontSize: 10,
                          fontWeight: 600,
                          fontFamily: "serif",
                          fontStyle: "italic",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 2,
                        }}
                      >
                        i
                      </span>
                      <span>
                        값을 입력하면 해당 추천 카테고리(부모 기반·이중 이름 등)가
                        자동으로 켜집니다. 더 세부 조정은{" "}
                        <span
                          style={{
                            color: "var(--color-teal)",
                            fontWeight: 600,
                          }}
                        >
                          이름 찾기
                        </span>{" "}
                        페이지에서 가능해요.
                      </span>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label htmlFor={fieldId("parentName")} style={labelStyle}>
                        부모 이름{" "}
                        <span style={{ color: "var(--color-text-3)" }}>
                          (서사 연결)
                        </span>
                      </label>
                      <input
                        id={fieldId("parentName")}
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        placeholder="예: 김민호 · 이수정"
                        autoComplete="off"
                        aria-describedby={
                          parentHint ? fieldId("parentName-note") : undefined
                        }
                        className="sumi-field"
                        style={fieldStyle}
                      />
                      {/* /search 가 아버지·어머니 칸을 어떻게 채울지 — 두 분으로 가르면 확인, 한 분으로도 두 분으로도
                          읽히면 가운뎃점 안내(2026-11-27 hero-parent-name-split — '지호 서윤'이 아버지 '지 + 호서윤'이 됐다) */}
                      {parentHint && (
                        <p id={fieldId("parentName-note")} style={fieldNoteStyle}>
                          {parentHint}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor={fieldId("story")} style={labelStyle}>
                        스토리 키워드
                      </label>
                      <input
                        id={fieldId("story")}
                        value={story}
                        onChange={(e) => setStory(e.target.value)}
                        placeholder="예: 바다, 새벽"
                        className="sumi-field"
                        style={fieldStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="hero-englishName" style={labelStyle}>
                        영어 이름{" "}
                        <span style={{ color: "var(--color-text-3)" }}>
                          (이중 이름 연결)
                        </span>
                      </label>
                      <input
                        ref={englishNameRef}
                        id="hero-englishName"
                        value={englishName}
                        onChange={(e) => setEnglishName(e.target.value)}
                        placeholder="예: Ethan"
                        maxLength={ENGLISH_NAME_MAX}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={englishNameIssue ? true : undefined}
                        aria-describedby={
                          englishNameIssue ? "hero-englishName-error" : undefined
                        }
                        className="sumi-field"
                        style={
                          englishNameIssue
                            ? {
                                ...fieldStyle,
                                borderBottomColor: "var(--color-vermilion)",
                              }
                            : fieldStyle
                        }
                      />
                      {englishNameIssue && (
                        <p
                          id="hero-englishName-error"
                          role="alert"
                          style={{
                            margin: "6px 0 0",
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: "var(--color-vermilion)",
                          }}
                        >
                          {englishNameIssue}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    position: "relative",
                    marginTop: 18,
                  }}
                >
                  <Button
                    variant="primary"
                    onClick={() => {
                      const surname = cleanNameInput(lastName);
                      const surnameProblem = nameInputProblem(surname, SURNAME_MAX_LENGTH);
                      if (surnameProblem) {
                        setRecommendTried(true);
                        setSurnameError(
                          surnameProblem === "empty"
                            ? null
                            : nameInputMessage(surnameProblem, "성씨", SURNAME_MAX_LENGTH)
                        );
                        notifyField(lastNameRef.current);
                        return;
                      }
                      if (!birth) {
                        setRecommendTried(true);
                        notifyField(birthRef.current);
                        return;
                      }
                      if (englishNameIssue) {
                        // 접어 둔 상세 입력 안에 있을 수 있다 — 펼친 뒤 칸으로 보낸다
                        setAdvOpen(true);
                        setTimeout(() => englishNameRef.current?.focus(), 0);
                        return;
                      }
                      start({
                        mode: "recommend",
                        lastName: surname,
                        gender,
                        tone,
                        birth,
                        birthTime,
                        parentName: parentName.trim(),
                        story: story.trim(),
                        englishName: englishName.trim(),
                      });
                    }}
                    style={{
                      width: "100%",
                      borderRadius: 0,
                      padding: "16px 18px",
                      fontFamily: "var(--font-serif)",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      fontSize: 15,
                    }}
                  >
                    이름 찾기 시작 →
                  </Button>
                  {/* 朱印 名 도장 — 작품 인증 도장 메타포 */}
                  <span className="sumi-stamp-name" aria-hidden>名</span>
                </div>
                {/* 안내 — 빈 필수 항목을 우선순위 순서로 한 줄씩 노출. 생년월일도 필수다(단추가 막는다) —
                    옛 문구 '성씨를 입력하면 결과를 바로 보여드려요'·'생년월일을 입력하면 사주 조화도 함께'는 성씨만으로
                    시작하던 때 그대로라 날짜 칸만 흔들리는 이유를 알 수 없었다(2026-11-27 hero-guide-text-focus) */}
                {(lastNameEmpty || !birth) && (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      color: "var(--color-text-3)",
                      textAlign: "center",
                      fontFamily: "var(--font-sans)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {lastNameEmpty
                      ? "성씨와 생년월일을 넣으면 결과를 바로 보여드려요."
                      : "생년월일을 넣으면 결과를 바로 보여드려요."}
                  </div>
                )}
              </div>
            )}

            {mode === "evaluate" && (
              <div>
                {/* Row 1: 분석할 이름 + 성별 + 톤 (이름 추천 폼과 같은 칸 나눔 — 640px 미만은 이름 한 줄 + 성별·톤 두 칸) */}
                <div
                  className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1fr_1.1fr_1.1fr]"
                  style={{ marginBottom: 12 }}
                >
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor={fieldId("evalQuery")} style={labelStyle}>
                      분석할 이름
                    </label>
                    <input
                      ref={evalQueryRef}
                      id={fieldId("evalQuery")}
                      value={evalQuery}
                      onChange={(e) => setEvalQuery(e.target.value)}
                      placeholder="예: 김서준"
                      autoComplete="off"
                      aria-required="true"
                      aria-invalid={
                        evaluateTried && !evalQuery.trim() ? true : undefined
                      }
                      className={
                        evaluateTried && !evalQuery.trim()
                          ? "sumi-field sumi-field--needs"
                          : "sumi-field"
                      }
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor={fieldId("evalGender")} style={labelStyle}>
                      성별
                    </label>
                    <select
                      id={fieldId("evalGender")}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="sumi-field"
                      style={{
                        ...fieldStyle,
                        appearance: "none",
                        backgroundImage: selectChevronBg,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                        paddingRight: 32,
                      }}
                    >
                      <option value="any">상관없음</option>
                      <option value="female">여자</option>
                      <option value="male">남자</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={fieldId("evalTone")} style={labelStyle}>
                      톤
                    </label>
                    <select
                      id={fieldId("evalTone")}
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="sumi-field"
                      style={{
                        ...fieldStyle,
                        appearance: "none",
                        backgroundImage: selectChevronBg,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                        paddingRight: 32,
                      }}
                    >
                      <option value="soft">부드럽게</option>
                      <option value="neutral">중립</option>
                      <option value="strong">강하게</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label htmlFor={fieldId("evalBirth")} style={labelStyle}>
                      생년월일{" "}
                      <span style={{ color: "var(--color-text-3)" }}>
                        (선택 · 사주 반영)
                      </span>
                    </label>
                    {/* 평가에서 출생일은 선택 — 빈칸 강조(--needs)를 하지 않는다 */}
                    <input
                      ref={birthRef}
                      id={fieldId("evalBirth")}
                      type="date"
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                      className="sumi-field"
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor={fieldId("evalBirthTime")} style={labelStyle}>
                      출생 시각{" "}
                      <span
                        style={{
                          color: "var(--color-text-3)",
                          whiteSpace: "nowrap",
                          fontSize: 11,
                        }}
                      >
                        (선택)
                      </span>
                    </label>
                    <input
                      id={fieldId("evalBirthTime")}
                      type="time"
                      value={birthTime}
                      onChange={(e) => setBirthTime(e.target.value)}
                      className="sumi-field"
                      style={fieldStyle}
                    />
                  </div>
                </div>

                <div
                  style={{
                    position: "relative",
                    marginTop: 18,
                  }}
                >
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (!evalQuery.trim()) {
                        setEvaluateTried(true);
                        notifyField(evalQueryRef.current);
                        return;
                      }
                      // 출생일은 선택 — 없으면 미학 점수만 평가한다(/evaluate 입력 폼과 같은 계약)
                      start({
                        mode: "evaluate",
                        name: evalQuery.trim(),
                        gender,
                        tone,
                        birth,
                        birthTime,
                      });
                    }}
                    style={{
                      width: "100%",
                      borderRadius: 0,
                      padding: "16px 18px",
                      fontFamily: "var(--font-serif)",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      fontSize: 15,
                    }}
                  >
                    이름 살펴보기 시작 →
                  </Button>
                  {/* 朱印 名 도장 */}
                  <span className="sumi-stamp-name" aria-hidden>名</span>
                </div>
                {/* 안내 — 이름이 없으면 입력 요청, 있으면 나뉜 성·이름 확인 + 빈 출생일 안내 */}
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "var(--color-text-3)",
                    textAlign: "center",
                    fontFamily: "var(--font-sans)",
                    letterSpacing: "0.01em",
                  }}
                >
                  {!evalQuery.trim() ? (
                    "평가할 이름(예: 김서준)을 입력하세요."
                  ) : (
                    <>
                      <div>
                        {evalSplit.name
                          ? `성 ${evalSplit.lastName} · 이름 ${evalSplit.name}`
                          : "성과 이름을 함께 입력하세요(예: 김서준)."}
                        {evalSplit.name &&
                          evalCompoundHint &&
                          ` — ${evalCompoundHint} 씨라면 '${evalCompoundHint} ${evalSplit.name.slice(1)}'처럼 띄어 써 주세요`}
                      </div>
                      {!birth && (
                        <div>
                          {birthTime
                            ? "출생 시각은 생년월일과 함께 넣어야 반영돼요."
                            : "생년월일을 입력하면 사주 조화도 함께 살펴봐요."}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Popular list — mode aware */}
        <div
          style={{
            marginTop: 14,
            fontSize: 13,
            color: "var(--color-text-3)",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {mode === "recommend" ? (
            <>
              <span>자주 찾는 성씨</span>
              {popularLast.map((n, i) => (
                <Fragment key={n}>
                  {i > 0 && (
                    <span style={{ color: "var(--color-text-3)" }}>·</span>
                  )}
                  <a
                    onClick={(e) => {
                      e.preventDefault();
                      setLastName(n);
                      setSurnameError(null);
                    }}
                    href="#"
                    style={{
                      color: "var(--color-teal)",
                      textDecoration: "underline dotted",
                      textUnderlineOffset: 4,
                      textDecorationThickness: 1,
                    }}
                  >
                    {n}
                  </a>
                </Fragment>
              ))}
            </>
          ) : (
            <>
              <span>자주 찾는</span>
              {popularFull.map((n, i) => (
                <Fragment key={n}>
                  {i > 0 && (
                    <span style={{ color: "var(--color-text-3)" }}>·</span>
                  )}
                  <a
                    onClick={(e) => {
                      e.preventDefault();
                      setEvalQuery(n);
                      // 넣어 둔 생년월일·시각도 싣는다 — 단추로 갈 때와 같은 값(2026-11-27 hero-eval-links-drop-birth —
                      // 옛 링크는 날짜를 버려 조화 점수 없이 미학만 채점했다). 날짜 없는 시각은 evaluateHref 가 버린다
                      start({ mode: "evaluate", name: n, gender, tone, birth, birthTime });
                    }}
                    href="#"
                    style={{
                      color: "var(--color-teal)",
                      textDecoration: "underline dotted",
                      textUnderlineOffset: 4,
                      textDecorationThickness: 1,
                    }}
                  >
                    {n}
                  </a>
                </Fragment>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default Hero;
