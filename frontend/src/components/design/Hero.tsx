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

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { Button } from "./Primitives";

// ============================================================
// useTypewriter — 문자 단위 타이핑 효과
// 줄 구분은 "\n"으로. (마운트 후 한 번만 재생, 완료 후 cursor blink 유지)
// ============================================================
function useTypewriter(fullText: string, speedMs = 70, startDelayMs = 200) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setShown("");
    setDone(false);
    let i = 0;
    const start = window.setTimeout(() => {
      const id = window.setInterval(() => {
        i += 1;
        setShown(fullText.slice(0, i));
        if (i >= fullText.length) {
          window.clearInterval(id);
          setDone(true);
        }
      }, speedMs);
    }, startDelayMs);
    return () => {
      window.clearTimeout(start);
    };
  }, [fullText, speedMs, startDelayMs]);

  return { shown, done };
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

  // 타이핑 효과 — 2줄로 분할, "\n"이 줄바꿈
  const HERO_HEADLINE = "결이 고운 이름은 시간이 흐를수록\n그 가치를 증명합니다.";
  const { shown: typed, done: typingDone } = useTypewriter(HERO_HEADLINE, 65, 250);

  const fieldStyle: CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "10px 12px",
    outline: "none",
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
      <div
        style={{
          position: "relative",
          maxWidth: 720,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            gap: 6,
            alignItems: "center",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-teal)",
            background: "var(--color-teal-50)",
            padding: "5px 12px",
            borderRadius: "var(--radius-sm)",
            marginBottom: 24,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--color-teal)",
            }}
          />
          발음·의미·세대 중립 기반 분석
        </div>
        <h1
          style={{
            fontSize: 52,
            lineHeight: 1.25,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--color-text)",
            margin: 0,
            marginBottom: 20,
            // 빈 글자 동안에도 높이가 잡혀 layout shift 방지 (2줄 기준)
            minHeight: "calc(52px * 1.25 * 2)",
            whiteSpace: "pre-line",
            wordBreak: "keep-all",
          }}
          aria-label="결이 고운 이름은 시간이 흐를수록 그 가치를 증명합니다."
        >
          {typed}
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: "0.06em",
              height: "0.95em",
              marginLeft: 4,
              verticalAlign: "-0.1em",
              background: "var(--color-text)",
              animation: typingDone
                ? "nk-blink 1s steps(2, start) infinite"
                : "none",
              opacity: typingDone ? undefined : 1,
            }}
          />
          <style>{`
            @keyframes nk-blink {
              0%, 50% { opacity: 1; }
              50.01%, 100% { opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              @keyframes nk-blink { 0%, 100% { opacity: 1; } }
            }
          `}</style>
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
          아기·개명·회사명·반려동물 — 목적에 맞게 이름의 결을 읽어드려요.
        </p>

        {/* Segmented control */}
        <div
          style={{
            display: "inline-flex",
            background: "var(--color-surface-2)",
            padding: 4,
            borderRadius: 999,
            marginBottom: 18,
          }}
        >
          {[
            { key: "recommend" as const, label: "이름 추천", glyph: "🎨" },
            { key: "evaluate" as const, label: "이름 평가", glyph: "📋" },
          ].map((t) => {
            const active = mode === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setMode(t.key)}
                style={{
                  appearance: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "9px 22px",
                  borderRadius: 999,
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                  backgroundColor: active
                    ? "var(--color-teal-50)"
                    : "transparent",
                  color: active ? "var(--color-teal)" : "var(--color-text-2)",
                  transition: "all 220ms cubic-bezier(.2,.6,.2,1)",
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  whiteSpace: "nowrap",
                }}
              >
                <span aria-hidden style={{ fontSize: 13 }}>
                  {t.glyph}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Form card */}
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-md)",
            padding: 20,
            maxWidth: 640,
            margin: "0 auto",
            position: "relative",
            overflow: "hidden",
            textAlign: "left", // 폼 내부는 다시 좌측 정렬 (라벨/입력 정렬용)
          }}
        >
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
                      value={lastName}
                      onChange={(e) =>
                        setLastName(e.target.value.slice(0, 2))
                      }
                      placeholder="예: 김"
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>성별</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
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
                        (선택 · 사주 반영 시)
                      </span>
                    </label>
                    <input
                      type="date"
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      출생 시각{" "}
                      <span style={{ color: "var(--color-text-3)" }}>
                        (선택 · 시주 반영)
                      </span>
                    </label>
                    <input
                      type="time"
                      value={birthTime}
                      onChange={(e) => setBirthTime(e.target.value)}
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
                        style={fieldStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>스토리 키워드</label>
                      <input
                        value={story}
                        onChange={(e) => setStory(e.target.value)}
                        placeholder="예: 바다, 새벽"
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
                        style={fieldStyle}
                      />
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 14,
                  }}
                >
                  <Button
                    variant="primary"
                    onClick={() =>
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
                      })
                    }
                  >
                    추천 시작 →
                  </Button>
                </div>
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
                      value={evalQuery}
                      onChange={(e) => setEvalQuery(e.target.value)}
                      placeholder="예: 김서준"
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>성별</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
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
                        (선택 · 사주 반영 시)
                      </span>
                    </label>
                    <input
                      type="date"
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      출생 시각{" "}
                      <span style={{ color: "var(--color-text-3)" }}>
                        (선택 · 시주 반영)
                      </span>
                    </label>
                    <input
                      type="time"
                      value={birthTime}
                      onChange={(e) => setBirthTime(e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 14,
                  }}
                >
                  <Button
                    variant="primary"
                    onClick={() =>
                      onStart?.({
                        mode: "evaluate",
                        name: evalQuery || "김서준",
                        gender,
                        tone,
                        birth,
                        birthTime,
                      })
                    }
                  >
                    분석 시작 →
                  </Button>
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
