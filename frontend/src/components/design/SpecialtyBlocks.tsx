/**
 * SpecialtyBlocks — 모드별 입력 블록 (Twin / Dual / Parent / Rare)
 * Source: NameForm_design/src/SpecialtyBlocks.jsx (Claude Design 산출물)
 */
"use client";

import { Fragment } from "react";
import {
  SPCheckbox,
  SPField,
  SPInput,
  SPRadio,
  SPSection,
  SPSlider,
  spField,
  spHelper,
} from "./SpecialtyPrimitives";

// ============================================================
// State 타입
// ============================================================
export interface TwinState {
  count: number;
  relation: "same" | "mixed" | "any";
  affinity: number;
  births: string[];
}

export interface DualState {
  englishName: string;
  linkMode: "phonetic" | "semantic" | "free";
  contexts: string[];
}

export interface ParentState {
  fatherLast: string;
  fatherFirst: string;
  motherLast: string;
  motherFirst: string;
  model: "auto" | "phonetic" | "semantic" | "narrative";
  story: string;
}

export interface RareState {
  compound: string;
  pattern: "traditional" | "modern" | "free";
  useHeritage: boolean;
}

// ============================================================
// TwinBlock
// ============================================================
export function TwinBlock({
  state,
  set,
}: {
  state: TwinState;
  set: (patch: Partial<TwinState>) => void;
}) {
  return (
    <SPSection title="쌍둥이 정보">
      <SPField label="인원 수">
        <div style={{ display: "flex", gap: 8 }}>
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set({ count: n })}
              style={{
                flex: 1,
                padding: "10px 12px",
                cursor: "pointer",
                border: `1px solid ${state.count === n ? "var(--color-teal)" : "var(--color-border)"}`,
                borderRadius: "var(--radius-md)",
                background:
                  state.count === n
                    ? "var(--color-teal-50)"
                    : "var(--color-surface)",
                color:
                  state.count === n
                    ? "var(--color-teal)"
                    : "var(--color-text)",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "var(--font-sans)",
              }}
            >
              {n}명
            </button>
          ))}
        </div>
      </SPField>

      <SPField label="관계 타입">
        <div style={{ display: "grid", gap: 8 }}>
          {[
            { v: "same", l: "같은 성별" },
            { v: "mixed", l: "남녀 혼성" },
            { v: "any", l: "미지정" },
          ].map((o) => (
            <SPRadio
              key={o.v}
              name="twin-relation"
              value={o.v}
              current={state.relation}
              onChange={(v) => set({ relation: v as TwinState["relation"] })}
              label={o.l}
            />
          ))}
        </div>
      </SPField>

      <SPField label="음운 연관도" hint="(독립 ↔ 유사)">
        <SPSlider
          value={state.affinity}
          onChange={(v) => set({ affinity: v })}
          leftLabel="독립 · 완전 다른 이름"
          rightLabel="유사 · 같은 첫 글자 등"
        />
      </SPField>

      <SPField label="각 아이 생년월일" hint="(선택 · 사주 반영 시)">
        <div style={{ display: "grid", gap: 8 }}>
          {Array.from({ length: state.count }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "var(--color-text-2)",
                  width: 44,
                  flexShrink: 0,
                }}
              >
                {i + 1}번째
              </span>
              <SPInput
                type="date"
                value={state.births[i] || ""}
                onChange={(e) => {
                  const nb = [...state.births];
                  nb[i] = e.target.value;
                  set({ births: nb });
                }}
              />
            </div>
          ))}
        </div>
      </SPField>
    </SPSection>
  );
}

// ============================================================
// DualBlock
// ============================================================
export function DualBlock({
  state,
  set,
}: {
  state: DualState;
  set: (patch: Partial<DualState>) => void;
}) {
  const tags = [
    { v: "intl_school", l: "국제학교" },
    { v: "overseas", l: "해외 이주 예정" },
    { v: "global_biz", l: "글로벌 비즈니스" },
    { v: "pronounce", l: "발음 용이성 우선" },
    { v: "spelling", l: "스펠링 단순성 우선" },
  ];

  return (
    <SPSection title="영어 이름 선호도">
      <SPField label="선호 영어 이름" hint="(선택)">
        <SPInput
          value={state.englishName}
          onChange={(e) => set({ englishName: e.target.value })}
          placeholder="예: Philip, Grace, Noah"
        />
        <div style={spHelper}>비워두면 자동 매칭해 드려요.</div>
      </SPField>

      <SPField label="연결 방식">
        <div style={{ display: "grid", gap: 8 }}>
          <SPRadio
            name="dual-link"
            value="phonetic"
            current={state.linkMode}
            onChange={(v) => set({ linkMode: v as DualState["linkMode"] })}
            label="음역 유사형"
            description="소리가 비슷한 한·영 페어 — 예: 립 · Philip"
          />
          <SPRadio
            name="dual-link"
            value="semantic"
            current={state.linkMode}
            onChange={(v) => set({ linkMode: v as DualState["linkMode"] })}
            label="의미 유사형"
            description="뜻이 통하는 한·영 페어 — 예: 하늘 · Sky"
          />
          <SPRadio
            name="dual-link"
            value="free"
            current={state.linkMode}
            onChange={(v) => set({ linkMode: v as DualState["linkMode"] })}
            label="자유형"
            description="제약 없이 최적 조합"
          />
        </div>
      </SPField>

      <SPField label="사용 맥락" hint="(다중 선택)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {tags.map((t) => (
            <SPCheckbox
              key={t.v}
              checked={state.contexts.includes(t.v)}
              onChange={() => {
                const has = state.contexts.includes(t.v);
                set({
                  contexts: has
                    ? state.contexts.filter((x) => x !== t.v)
                    : [...state.contexts, t.v],
                });
              }}
              label={t.l}
            />
          ))}
        </div>
      </SPField>
    </SPSection>
  );
}

// ============================================================
// ParentBlock
// ============================================================
export function ParentBlock({
  state,
  set,
}: {
  state: ParentState;
  set: (patch: Partial<ParentState>) => void;
}) {
  return (
    <SPSection title="부모님 정보">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: 8,
              letterSpacing: "-0.005em",
            }}
          >
            아버지
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.5fr",
              gap: 6,
            }}
          >
            <SPInput
              placeholder="성"
              value={state.fatherLast}
              onChange={(e) => set({ fatherLast: e.target.value })}
            />
            <SPInput
              placeholder="이름"
              value={state.fatherFirst}
              onChange={(e) => set({ fatherFirst: e.target.value })}
            />
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: 8,
              letterSpacing: "-0.005em",
            }}
          >
            어머니
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.5fr",
              gap: 6,
            }}
          >
            <SPInput
              placeholder="성"
              value={state.motherLast}
              onChange={(e) => set({ motherLast: e.target.value })}
            />
            <SPInput
              placeholder="이름"
              value={state.motherFirst}
              onChange={(e) => set({ motherFirst: e.target.value })}
            />
          </div>
        </div>
      </div>

      <SPField label="작명 모델" style={{ marginTop: 18 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <SPRadio
            name="parent-model"
            value="auto"
            current={state.model}
            onChange={(v) => set({ model: v as ParentState["model"] })}
            label="자동 추천"
            description="엔진이 최적 모델을 선택합니다"
          />
          <SPRadio
            name="parent-model"
            value="phonetic"
            current={state.model}
            onChange={(v) => set({ model: v as ParentState["model"] })}
            label="음운 계승형"
            description="부모 이름의 초성·음운 요소를 계승"
          />
          <SPRadio
            name="parent-model"
            value="semantic"
            current={state.model}
            onChange={(v) => set({ model: v as ParentState["model"] })}
            label="의미 계승형"
            description="부모 이름의 한자 의미를 계승"
          />
          <SPRadio
            name="parent-model"
            value="narrative"
            current={state.model}
            onChange={(v) => set({ model: v as ParentState["model"] })}
            label="가족 서사형"
            description="가족의 이야기·키워드 기반"
          />
        </div>
      </SPField>

      <SPField label="스토리 키워드" hint="(선택)">
        <textarea
          value={state.story}
          onChange={(e) => set({ story: e.target.value.slice(0, 50) })}
          placeholder="예: 첫째 아이, 봄에 태어난, 여행을 좋아하는 부부…"
          rows={3}
          style={{ ...spField, resize: "none", minHeight: 72 }}
        />
        <div
          style={{
            ...spHelper,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>50자 이내로 적어주시면 이름에 녹여드립니다.</span>
          <span>{state.story.length}/50</span>
        </div>
      </SPField>
    </SPSection>
  );
}

// ============================================================
// RareBlock
// ============================================================
export function RareBlock({
  state,
  set,
}: {
  state: RareState;
  set: (patch: Partial<RareState>) => void;
}) {
  const known = ["선우", "남궁", "황보", "사공", "제갈", "독고"];
  return (
    <SPSection title="성씨 정보">
      <SPField label="복성(複姓) 입력" hint="(2음절)">
        <SPInput
          value={state.compound}
          onChange={(e) => set({ compound: e.target.value.slice(0, 3) })}
          placeholder="예: 선우, 남궁, 황보, 사공"
        />
        <div
          style={{
            ...spHelper,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span>자주 찾는:</span>
          {known.map((n, i) => (
            <Fragment key={n}>
              {i > 0 && <span>·</span>}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  set({ compound: n });
                }}
                style={{
                  textDecoration: "underline dotted",
                  textUnderlineOffset: 3,
                }}
              >
                {n}
              </a>
            </Fragment>
          ))}
        </div>
      </SPField>

      <SPField label="복성 사용 패턴">
        <div style={{ display: "grid", gap: 8 }}>
          <SPRadio
            name="rare-pattern"
            value="traditional"
            current={state.pattern}
            onChange={(v) => set({ pattern: v as RareState["pattern"] })}
            label="전통적"
            description="성 + 이름 2자, 총 4자 (예: 선우재현)"
          />
          <SPRadio
            name="rare-pattern"
            value="modern"
            current={state.pattern}
            onChange={(v) => set({ pattern: v as RareState["pattern"] })}
            label="모던"
            description="성 + 이름 1자, 총 3자 (예: 선우결)"
          />
          <SPRadio
            name="rare-pattern"
            value="free"
            current={state.pattern}
            onChange={(v) => set({ pattern: v as RareState["pattern"] })}
            label="자유"
            description="엔진이 최적 판단"
          />
        </div>
      </SPField>

      <SPField label="고급 옵션">
        <SPCheckbox
          checked={state.useHeritage}
          onChange={() => set({ useHeritage: !state.useHeritage })}
          label="본관 / 가문 서사를 반영해주세요"
        />
      </SPField>
    </SPSection>
  );
}
