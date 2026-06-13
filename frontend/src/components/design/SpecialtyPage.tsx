/**
 * SpecialtyPage — 4 모드 (Twin/Dual/Parent/Rare) 통합 입력 페이지
 * Source: NameForm_design/src/SpecialtyPage.jsx (Claude Design 산출물)
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Mark } from "./Mark";
import { Button } from "./Primitives";
import { SPField, SPInput, SPSection, SPSelect, SPSlider } from "./SpecialtyPrimitives";
import {
  DualBlock,
  ParentBlock,
  RareBlock,
  TwinBlock,
  type DualState,
  type ParentState,
  type RareState,
  type TwinState,
} from "./SpecialtyBlocks";

// ============================================================
// MODE_META
// ============================================================
export type SpecialtyMode = "twin" | "dual" | "parent" | "rare";

export const MODE_META: Record<
  SpecialtyMode,
  {
    title: string;
    h1: string;
    sub: string;
    explain: string;
    cta: string;
  }
> = {
  twin: {
    title: "쌍둥이 작명",
    h1: "둘이 함께, 각자 빛나는 이름",
    sub: "조화로우면서 각자 독립된 정체성을 갖는 쌍둥이 이름 세트를 추천합니다.",
    explain:
      "2명 이상의 이름을 동시에 생성하며, 음운·의미의 연관도를 조절할 수 있습니다. 결과에서 각 아이별 상세 분석을 개별적으로 볼 수 있어요.",
    cta: "쌍둥이 이름 추천 받기",
  },
  dual: {
    title: "한영 이중 이름",
    h1: "한국과 세계, 한 이름에",
    sub: "한국 이름과 영어 이름이 자연스럽게 연결되는 이중 이름을 설계합니다.",
    explain:
      "한국 이름과 영어 이름을 하나의 세트로 설계합니다. 음역 유사형은 '립·Philip'처럼 소리로 연결되고, 의미 유사형은 '하늘·Sky'처럼 뜻으로 연결됩니다.",
    cta: "이중 이름 추천 받기",
  },
  parent: {
    title: "부모 이름 기반",
    h1: "가족의 이야기를 잇는 이름",
    sub: "부모님의 이름에서 영감을 받아 가족의 서사를 이어가는 작명입니다.",
    explain:
      "부모님의 이름에서 음운 요소(초성·받침), 한자 의미, 또는 가족의 이야기를 재료로 사용합니다. 작명 모델은 8종의 패턴 중 선택하거나 자동 추천 가능.",
    cta: "부모 이름 기반 추천 받기",
  },
  rare: {
    title: "희귀 성씨 특화",
    h1: "복성(複姓)과 희귀 성씨를 위한 작명",
    sub: "선우·남궁·황보 등 2음절 성씨와 희귀 성씨에 자연스럽게 어울리는 이름을 추천합니다.",
    explain:
      "선우·남궁·황보 같은 2음절 복성이나 빈도 낮은 성씨는 일반 작명 알고리즘이 어색한 결과를 내기 쉽습니다. 본 경로는 성씨 음운 패턴을 우선 고려해 어울리는 이름만 선별합니다.",
    cta: "희귀 성씨 이름 추천 받기",
  },
};

// ============================================================
// State 타입
// ============================================================
export interface BasicState {
  lastName: string;
  gender: "any" | "male" | "female";
  tone: "soft" | "neutral" | "strong";
  birth: string;
}

export interface AdvState {
  preferHanja: string;
  avoid: string;
  trend: number;
}

export interface SpecialtySubmitPayload {
  mode: SpecialtyMode;
  basic: BasicState;
  adv: AdvState;
  twin: TwinState;
  dual: DualState;
  parent: ParentState;
  rare: RareState;
}

// ============================================================
// 서브 컴포넌트
// ============================================================
function SpecialtyMiniHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "rgba(250, 247, 242, 0.88)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <Mark size={28} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.1,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              이름의 결
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-2)",
                fontFamily: "Inter",
                letterSpacing: "0.02em",
              }}
            >
              Naming.kyeol
            </span>
          </div>
        </Link>
        <Link
          href="/"
          style={{
            fontSize: 13,
            color: "var(--color-text-2)",
            fontWeight: 500,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← 홈으로
        </Link>
        <div style={{ width: 80 }} />
      </div>
    </header>
  );
}

function SpecialtyHero({ mode }: { mode: SpecialtyMode }) {
  const m = MODE_META[mode];
  return (
    <section style={{ padding: "56px 0 36px" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--color-teal)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        Specialty · {mode.toUpperCase()}
      </div>
      <h1
        style={{
          fontSize: 36,
          lineHeight: 1.2,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          margin: 0,
          marginBottom: 14,
        }}
      >
        {m.h1}
      </h1>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--color-text-2)",
          margin: 0,
          maxWidth: 640,
        }}
      >
        {m.sub}
      </p>
    </section>
  );
}

function BasicBlock({
  mode,
  basic,
  set,
}: {
  mode: SpecialtyMode;
  basic: BasicState;
  set: (patch: Partial<BasicState>) => void;
}) {
  return (
    <SPSection title="기본 정보">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <SPField
          label="성씨"
          hint={mode === "rare" ? "(2음절 복성은 아래 섹션)" : "(2자 이내)"}
        >
          <SPInput
            value={basic.lastName}
            disabled={mode === "rare"}
            onChange={(e) =>
              set({ lastName: e.target.value.slice(0, 2) })
            }
            placeholder={mode === "rare" ? "아래 복성 입력" : "예: 김"}
            style={
              mode === "rare" ? { opacity: 0.6, cursor: "not-allowed" } : {}
            }
          />
        </SPField>
        <SPField label="성별">
          <SPSelect
            value={basic.gender}
            onChange={(e) =>
              set({ gender: e.target.value as BasicState["gender"] })
            }
            options={[
              { value: "any", label: "상관없음" },
              { value: "female", label: "여자" },
              { value: "male", label: "남자" },
            ]}
          />
        </SPField>
        <SPField label="톤">
          <SPSelect
            value={basic.tone}
            onChange={(e) =>
              set({ tone: e.target.value as BasicState["tone"] })
            }
            options={[
              { value: "soft", label: "부드럽게" },
              { value: "neutral", label: "중립" },
              { value: "strong", label: "강하게" },
            ]}
          />
        </SPField>
        <SPField label="생년월일" hint="(선택 · 사주 반영)">
          <SPInput
            type="date"
            value={basic.birth}
            onChange={(e) => set({ birth: e.target.value })}
          />
        </SPField>
      </div>
    </SPSection>
  );
}

function AdvancedBlock({
  adv,
  set,
}: {
  adv: AdvState;
  set: (patch: Partial<AdvState>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ marginBottom: 28 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-text-2)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: open ? 14 : 0,
        }}
      >
        고급 옵션
        <span
          style={{
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 200ms",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            padding: "18px 22px",
          }}
        >
          <SPField label="선호 한자 포함" hint="(쉼표 구분)">
            <SPInput
              value={adv.preferHanja}
              onChange={(e) => set({ preferHanja: e.target.value })}
              placeholder="예: 俊, 瑞, 志"
            />
          </SPField>
          <SPField label="기피 한자 / 음" hint="(쉼표 구분)">
            <SPInput
              value={adv.avoid}
              onChange={(e) => set({ avoid: e.target.value })}
              placeholder="예: 凶, 악"
            />
          </SPField>
          <SPField label="유행 이름 제외 강도">
            <SPSlider
              value={adv.trend}
              onChange={(v) => set({ trend: v })}
              leftLabel="약 · 유행 허용"
              rightLabel="강 · 유행 배제"
            />
          </SPField>
        </div>
      )}
    </section>
  );
}

function ExplainCard({ mode }: { mode: SpecialtyMode }) {
  const [open, setOpen] = useState(false);
  return (
    <section
      style={{
        marginTop: 32,
        marginBottom: 48,
        background: "var(--color-surface-2)",
        borderRadius: "var(--radius-lg)",
        padding: open ? "20px 22px 22px" : "16px 22px",
        transition: "padding 200ms",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        이 경로는 어떻게 작동하나요?
        <span
          style={{
            color: "var(--color-text-2)",
            fontSize: 12,
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 200ms",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.7,
            color: "var(--color-text-2)",
            margin: 0,
            marginTop: 12,
            letterSpacing: "-0.005em",
          }}
        >
          {MODE_META[mode].explain}
        </p>
      )}
    </section>
  );
}

const MODE_ROUTES: Record<SpecialtyMode, string> = {
  twin: "/twin",
  dual: "/dual-name",
  parent: "/parent-based",
  rare: "/rare-surname",
};

function ModeSwitcher({ current }: { current: SpecialtyMode }) {
  const [open, setOpen] = useState(false);
  const modes: { k: SpecialtyMode; l: string }[] = [
    { k: "twin", l: "쌍둥이 작명" },
    { k: "dual", l: "한영 이중 이름" },
    { k: "parent", l: "부모 이름 기반" },
    { k: "rare", l: "희귀 성씨 특화" },
  ];
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          fontWeight: 500,
          color: "var(--color-text-2)",
          textDecoration: "underline",
          textUnderlineOffset: 4,
          textDecorationThickness: 1,
          padding: "6px 0",
        }}
      >
        다른 경로로 작명하기 ↓
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            background: "var(--color-surface)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--color-border)",
            padding: 6,
            minWidth: 180,
            zIndex: 30,
          }}
        >
          {modes
            .filter((m) => m.k !== current)
            .map((m) => (
              <Link
                key={m.k}
                href={MODE_ROUTES[m.k]}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "9px 12px",
                  borderRadius: 6,
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color: "var(--color-text)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--color-teal-50)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {m.l}
              </Link>
            ))}
          <div
            style={{
              height: 1,
              background: "var(--color-divider)",
              margin: "6px 0",
            }}
          />
          <Link
            href="/"
            style={{
              display: "block",
              padding: "9px 12px",
              borderRadius: 6,
              fontSize: 13,
              color: "var(--color-text-2)",
              textDecoration: "none",
            }}
          >
            ← 홈으로
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SpecialtyPage — 메인
// ============================================================
export function SpecialtyPage({
  mode,
  initialLastName,
  onSubmit,
}: {
  mode: SpecialtyMode;
  initialLastName?: string;
  onSubmit?: (payload: SpecialtySubmitPayload) => void;
}) {
  const [basic, setBasic] = useState<BasicState>({
    lastName: mode === "rare" ? "" : initialLastName ?? "김",
    gender: "any",
    tone: "neutral",
    birth: "",
  });
  const [adv, setAdv] = useState<AdvState>({
    preferHanja: "",
    avoid: "",
    trend: 50,
  });

  const [twin, setTwin] = useState<TwinState>({
    count: 2,
    relation: "same",
    affinity: 50,
    births: ["", ""],
  });
  const [dual, setDual] = useState<DualState>({
    englishName: "",
    linkMode: "phonetic",
    contexts: [],
  });
  const [parent, setParent] = useState<ParentState>({
    fatherLast: "",
    fatherFirst: "",
    motherLast: "",
    motherFirst: "",
    model: "auto",
    story: "",
  });
  const [rare, setRare] = useState<RareState>({
    compound: "",
    pattern: "traditional",
    useHeritage: false,
  });

  const m = MODE_META[mode];

  function handleSubmit() {
    onSubmit?.({ mode, basic, adv, twin, dual, parent, rare });
  }

  return (
    <div
      data-screen-label={`Specialty · ${m.title}`}
      style={{
        minHeight: "100vh",
        background: "var(--color-background)",
      }}
    >
      <SpecialtyMiniHeader />
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "0 32px 80px",
        }}
      >
        <SpecialtyHero mode={mode} />

        <BasicBlock
          mode={mode}
          basic={basic}
          set={(patch) => setBasic({ ...basic, ...patch })}
        />

        {mode === "twin" && (
          <TwinBlock
            state={twin}
            set={(p) =>
              setTwin((t) => {
                const next = { ...t, ...p };
                // births 길이를 count에 맞춰 동기화
                if (next.births.length !== next.count) {
                  const nb = [...next.births];
                  while (nb.length < next.count) nb.push("");
                  while (nb.length > next.count) nb.pop();
                  next.births = nb;
                }
                return next;
              })
            }
          />
        )}
        {mode === "dual" && (
          <DualBlock
            state={dual}
            set={(p) => setDual({ ...dual, ...p })}
          />
        )}
        {mode === "parent" && (
          <ParentBlock
            state={parent}
            set={(p) => setParent({ ...parent, ...p })}
          />
        )}
        {mode === "rare" && (
          <RareBlock
            state={rare}
            set={(p) => setRare({ ...rare, ...p })}
          />
        )}

        <AdvancedBlock
          adv={adv}
          set={(p) => setAdv({ ...adv, ...p })}
        />

        {/* CTA */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            marginTop: 12,
          }}
        >
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            style={{ padding: "14px 28px", fontSize: 15 }}
          >
            {m.cta} →
          </Button>
          <ModeSwitcher current={mode} />
        </div>

        <ExplainCard mode={mode} />
      </main>
    </div>
  );
}

export default SpecialtyPage;
