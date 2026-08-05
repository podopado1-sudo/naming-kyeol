/**
 * Hero — 홈 메인 섹션 (이름 추천/평가 모드 듀얼 탭 + 입력 폼)
 * Source: NameForm_design/src/Hero.jsx (Claude Design 산출물)
 *
 * 변환 사항:
 *   - React.useState → useState import
 *   - React.Fragment → <></> 단축 사용
 *   - Button → ./Primitives에서 import
 */
"use client";

import { Fragment, useRef, useState, type CSSProperties } from "react";
import { Button } from "./Primitives";

// 타이핑 효과는 수묵화 톤과 어울리지 않아 제거됨.
// 헤드라인은 글자별 잉크 드롭 (.ink-char) 으로 표시.
// (globals.css 의 nk-ink-char keyframes 참조)

/**
 * InkChars — 텍스트를 한 글자씩 분해해 .ink-char 애니메이션을 부여.
 * baseDelay: 첫 글자 등장까지 대기 (ms)
 * step:      글자 간 간격 (ms, default 80)
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
  return (
    <>
      {Array.from(text).map((ch, i) => {
        if (ch === " ") {
          // 공백은 너비만 보존, 애니메이션 제외
          return (
            <span key={i} className="ink-char ink-char--space">
              &nbsp;
            </span>
          );
        }
        return (
          <span
            key={i}
            className="ink-char"
            style={{ animationDelay: `${baseDelay + i * step}ms` }}
          >
            {ch}
          </span>
        );
      })}
    </>
  );
}

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

export function Hero({
  onStart,
}: {
  onStart?: (payload: HeroStartPayload) => void;
}) {
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

  // evaluate inputs
  const [evalQuery, setEvalQuery] = useState("");

  // 필수 입력 누락 시 shake 안내용
  // birth input은 recommend/evaluate 모드 모두 동일 ref 공유 (한 번에 한 모드만 렌더됨)
  const lastNameRef = useRef<HTMLInputElement | null>(null);
  // 한글 IME 조합 중 slice로 값을 자르면 조합이 끊겨 글자가 지워지므로,
  // 조합 중에는 원본을 유지하고 조합 종료 시점에만 2자 제한을 적용한다.
  const lastNameComposingRef = useRef(false);
  const evalQueryRef = useRef<HTMLInputElement | null>(null);
  const birthRef = useRef<HTMLInputElement | null>(null);
  const [shakeKey, setShakeKey] = useState(0); // 재트리거용 key

  function notifyEmpty(ref: React.RefObject<HTMLInputElement | null>) {
    ref.current?.focus();
    setShakeKey((k) => k + 1);
  }

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

  const popularLast = ["김", "이", "박", "최", "정"];
  const popularFull = ["서준", "하윤", "지안", "도헌"];

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-illustration.png"
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
            // 반응형 — 모바일 28px → 데스크탑 52px 사이에서 viewport 비례 스케일
            fontSize: "clamp(26px, 6vw, 52px)",
            lineHeight: 1.3,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--color-text)",
            margin: 0,
            marginBottom: 20,
            wordBreak: "keep-all",
          }}
          aria-label="결이 고운 이름은 시간이 흐를수록 그 가치를 증명합니다."
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1.1fr 1.1fr",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label style={labelStyle}>
                      성씨{" "}
                      <span style={{ color: "var(--color-text-3)" }}>
                        (2자 이내)
                      </span>
                    </label>
                    <input
                      ref={lastNameRef}
                      key={`lastName-${shakeKey}`}
                      value={lastName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLastName(
                          lastNameComposingRef.current ? v : v.slice(0, 2)
                        );
                      }}
                      onCompositionStart={() => {
                        lastNameComposingRef.current = true;
                      }}
                      onCompositionEnd={(e) => {
                        lastNameComposingRef.current = false;
                        setLastName(e.currentTarget.value.slice(0, 2));
                      }}
                      placeholder="예: 김"
                      className={
                        !lastName.trim() && shakeKey > 0
                          ? "sumi-field sumi-field--needs"
                          : "sumi-field"
                      }
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>성별</label>
                    <select
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
                    <label style={labelStyle}>톤</label>
                    <select
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
                    <label style={labelStyle}>
                      생년월일{" "}
                      <span style={{ color: "var(--color-text-3)" }}>
                        (사주 반영)
                      </span>
                    </label>
                    <input
                      ref={birthRef}
                      key={`birth-${shakeKey}`}
                      type="date"
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                      className={
                        !birth && shakeKey > 0
                          ? "sumi-field sumi-field--needs"
                          : "sumi-field"
                      }
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
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
                      <label style={labelStyle}>
                        부모 이름{" "}
                        <span style={{ color: "var(--color-text-3)" }}>
                          (서사 연결)
                        </span>
                      </label>
                      <input
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        placeholder="예: 김민호 · 이수정"
                        className="sumi-field"
                      style={fieldStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>스토리 키워드</label>
                      <input
                        value={story}
                        onChange={(e) => setStory(e.target.value)}
                        placeholder="예: 바다, 새벽"
                        className="sumi-field"
                      style={fieldStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>
                        영어 이름{" "}
                        <span style={{ color: "var(--color-text-3)" }}>
                          (이중 이름 연결)
                        </span>
                      </label>
                      <input
                        value={englishName}
                        onChange={(e) => setEnglishName(e.target.value)}
                        placeholder="예: Ethan"
                        className="sumi-field"
                      style={fieldStyle}
                      />
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
                      if (!lastName.trim()) {
                        notifyEmpty(lastNameRef);
                        return;
                      }
                      if (!birth) {
                        notifyEmpty(birthRef);
                        return;
                      }
                      onStart?.({
                        mode: "recommend",
                        lastName,
                        gender,
                        tone,
                        birth,
                        birthTime,
                        parentName,
                        story,
                        englishName,
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
                {/* 안내 — 빈 항목을 우선순위 순서로 한 줄씩 노출 */}
                {(!lastName.trim() || !birth) && (
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
                    {!lastName.trim()
                      ? "성씨를 입력하면 결과를 바로 보여드려요."
                      : "생년월일을 입력하면 사주 조화도 함께 살펴봐요."}
                  </div>
                )}
              </div>
            )}

            {mode === "evaluate" && (
              <div>
                {/* Row 1: 분석할 이름 + 성별 + 톤 (이름 추천 폼과 동일한 컬럼 비율) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1.1fr 1.1fr",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label style={labelStyle}>분석할 이름</label>
                    <input
                      ref={evalQueryRef}
                      key={`evalQuery-${shakeKey}`}
                      value={evalQuery}
                      onChange={(e) => setEvalQuery(e.target.value)}
                      placeholder="예: 김서준"
                      className={
                        !evalQuery.trim() && shakeKey > 0
                          ? "sumi-field sumi-field--needs"
                          : "sumi-field"
                      }
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>성별</label>
                    <select
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
                    <label style={labelStyle}>톤</label>
                    <select
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
                    <label style={labelStyle}>
                      생년월일{" "}
                      <span style={{ color: "var(--color-text-3)" }}>
                        (사주 반영)
                      </span>
                    </label>
                    <input
                      ref={birthRef}
                      key={`birth-${shakeKey}`}
                      type="date"
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                      className={
                        !birth && shakeKey > 0
                          ? "sumi-field sumi-field--needs"
                          : "sumi-field"
                      }
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
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
                        notifyEmpty(evalQueryRef);
                        return;
                      }
                      if (!birth) {
                        notifyEmpty(birthRef);
                        return;
                      }
                      onStart?.({
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
                {/* 검증 안내 — 빈 항목 우선순위 순 */}
                {(!evalQuery.trim() || !birth) && (
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
                    {!evalQuery.trim()
                      ? "평가할 이름(예: 김서준)을 입력하세요."
                      : "생년월일을 입력하면 사주 조화도 함께 살펴봐요."}
                  </div>
                )}
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
                      onStart?.({ mode: "evaluate", name: n });
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
