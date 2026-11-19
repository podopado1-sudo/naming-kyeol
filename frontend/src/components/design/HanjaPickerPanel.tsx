/**
 * HanjaPickerPanel — 한자 칸 하나의 고르기 패널(2026-11 설계 docs/plan-hanja-input-2026-11.md §3-1·§8-5·§8-7·§8-8·§8-9).
 *
 * 칸 줄(HanjaSlots) 바로 아래에 하나만 열린다. 모달이 아니다 — 높이를 막고(app/globals.css `.hanja-picker-panel`) 목록 영역만 스크롤한다
 * ('유' 음절은 138자다). 머리(제목·닫기·기본 동작·찾기)는 스크롤 영역 밖이라 늘 보인다.
 *
 * - 이름 패널(NamePanel): 세 묶음(먼저 보여 드리는 글자 / 그 밖의 글자 — 처음 12자 + 더 보기 / 접힌 묶음), 뜻·글자로 찾기, 오행 거르기.
 * - 성씨 패널(SurnamePanel): 글자 격자(글자 + 획수)뿐이다. 훈·오행·등급·이름용 표시·묶음이 없다 — 성씨에 쓰는 글자가
 *   이름용 판정 때문에 접힌 묶음이나 맨 뒤로 밀리지 않게, 성씨 옆에 훈이 붙지 않게(설계 §8-7 '성씨 패널').
 * - 직접 입력(DirectInput): 칸 자체가 아니라 패널 안의 입력 칸이다. 값에서 한자를 뽑아 처리한다 — 그 음절 목록에 있으면 바로 넣고,
 *   없으면 ① 바로 '후보에 없는 글자' ② 서버 판정(POST /hanja/resolve)의 까닭 ③ 5초 안에 답이 없으면 기다리기를 끝낸다.
 *   서버에는 **뽑은 한자 한 글자**만 보낸다(붙여 넣은 원문에는 다른 내용이 섞여 있을 수 있다).
 *
 * 후보 목록은 정적 파일이다(lib/hanja-pick-store.ts) — 이 패널이 열릴 때 그 음절 파일 하나를 받는다. 서버가 잠들어 있어도 바로 열린다.
 *
 * 규칙(tests/evaluate-hanja-pages.test.mjs 가 원문으로 본다)
 * - 콤보·탭 역할과 인라인 2열 격자를 쓰지 않는다(`.sumi-form` 전역 규칙에 걸린다). 오행 거르기는 aria-pressed 버튼이다.
 * - input 은 type="text" 를 주고 테두리·패딩·포커스 표시를, label 은 크기·색을 여기서 직접 정한다(인라인 — 전역 규칙보다 앞선다).
 * - 목록 한 줄은 버튼 하나다. 버튼 안에 포커스 요소를 두지 않는다 — 등급은 툴팁 배지 대신 글로 적는다.
 * - 상태를 흐림으로 알리지 않는다. 글자색은 글자 전용 토큰(오행은 FIVE_EL 의 text, 주의 문장은 amber-warm-700).
 * - 목록·성씨 격자의 글자는 기기 서체다(`.hanja-picker-glyph` — 사이트 한자 서체로 그리면 '유' 패널 하나에 조각 27개·1.7MB 를
 *   받는다. app/globals.css 의 그 규칙 주석). 고른 글자(칸)와 버튼 속 한 글자만 사이트 한자 서체(font-hanja).
 * - 큰 정적 JSON 을 읽는 서버 전용 모듈을 import 하지 않는다.
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
  type RefObject,
} from "react";

import { gradeBadgeKey } from "@/components/hanja/hanja-element-text";
import { hanjaResolve } from "@/lib/api";
import {
  asSurnameFact,
  filterCandidates,
  firstHanCodePoint,
  groupCandidates,
  hanCharsOf,
  sortForSurname,
  type HanjaSlot,
} from "@/lib/hanja-pick";
import { requestPickFile, usePickStore } from "@/lib/hanja-pick-store";
import {
  DIRECT_CHECKING,
  DIRECT_HELP,
  DIRECT_NOT_HANJA,
  EXTENSION_NOTICE,
  PANEL_LOADING,
  PANEL_LOAD_FAILED,
  STROKE_NOTICE,
  avoidedGroupIntro,
  hangulOnlyHelp,
  judgeTimeoutNote,
  namePanelTitle,
  notInListNote,
  searchEmptyNote,
  surnamePanelIntro,
  surnamePanelTitle,
} from "@/lib/hanja-pick-text";
import { noHanjaSyllableNote } from "@/lib/no-hanja";
import type { HanjaFact } from "@/lib/types";

import { FIVE_EL } from "./DetailPrimitives";
import { RESOURCE_GRADE_INFO, type ResourceBadgeKey } from "./resource-grade";

export interface HanjaPickerPanelProps {
  /** 패널 id — 칸 버튼의 aria-controls 가 가리킨다 */
  id: string;
  /** 열린 칸 */
  slot: HanjaSlot;
  /** 성씨 칸의 기본 한자(대표 한자 표의 그 자리 글자). 표에 없는 성씨는 null */
  representative?: string | null;
  /** index.json 의 '이름에 피하는 글자' 수 — 묶음 설명에 쓴다. 못 받았으면 null */
  forbiddenCount?: number | null;
  /** 글자를 골랐다 */
  onPick: (fact: HanjaFact) => void;
  /** 자동으로 고르기(성씨: 기본 한자로) */
  onAuto: () => void;
  /** 한자 없이 한글로(이름 칸만) */
  onNone?: () => void;
  onClose: () => void;
  /** 여러 글자를 붙여 넣었다 — 이 칸부터 나눠 넣는 일은 칸 줄을 아는 쪽이 한다 */
  onSpread?: (characters: string[]) => void;
}

/** 한 번에 보이는 '그 밖의 글자' 수 — 나머지는 '더 보기' */
const FIRST_OTHERS = 12;
/** 서버 판정을 기다리는 한도 — 넘으면 기다리기를 끝낸다(늦게 온 응답은 버린다) */
const JUDGE_TIMEOUT_MS = 5_000;

const ELEMENT_FILTERS = ["木", "火", "土", "金", "水"] as const;

// ------------------------------------------------------------
// PC 인가 — 자동 포커스와 직접 입력 칸의 자리를 가른다(설계 §8-9)
// ------------------------------------------------------------
const PC_QUERY = "(hover: hover) and (pointer: fine)";

function subscribePc(onChange: () => void): () => void {
  const media = window.matchMedia(PC_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function usePcPointer(): boolean {
  return useSyncExternalStore(
    subscribePc,
    () => window.matchMedia(PC_QUERY).matches,
    () => false
  );
}

// ------------------------------------------------------------
// 스타일
// ------------------------------------------------------------
const panelStyle: CSSProperties = {
  marginTop: 12,
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  fontFamily: "var(--font-sans)",
  textAlign: "left",
};

const headStyle: CSSProperties = {
  background: "var(--color-surface)",
  borderBottom: "1px solid var(--color-divider)",
  padding: "8px 12px 10px",
  display: "grid",
  gap: 8,
  borderRadius: "var(--radius-md) var(--radius-md) 0 0",
};

/** 머리의 입력 칸 줄 — 칸 하나가 200px 을 못 얻으면 다음 줄로 넘어간다(인라인 격자 대신 flex) */
const headFields: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "8px 10px" };
const headField: CSSProperties = { flex: "1 1 200px", minWidth: 0 };
/** 직접 입력의 도움말·판정 문장 — 입력 칸 줄 아래에 폭 전체로(같은 줄의 찾기 칸 뒤에 온다) */
const directNotes: CSSProperties = { flex: "1 1 100%", order: 1, minWidth: 0 };

const bodyStyle: CSSProperties = { padding: "4px 12px 14px" };

const actionButton: CSSProperties = {
  appearance: "none",
  flex: "1 1 0",
  minWidth: 0,
  minHeight: 44,
  padding: "8px 10px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-sans)",
  fontSize: 13.5,
  fontWeight: 500,
  color: "var(--color-text)",
  cursor: "pointer",
  wordBreak: "keep-all",
};

const fieldLabel: CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--color-text)",
  letterSpacing: 0,
  margin: "0 0 4px",
};

const hintText: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 12.5,
  lineHeight: 1.55,
  color: "var(--color-text-2)",
  wordBreak: "keep-all",
};

const warnText: CSSProperties = { ...hintText, color: "var(--color-amber-warm-700)" };

const groupTitle: CSSProperties = {
  margin: "14px 0 0",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--color-text)",
};

const listReset: CSSProperties = { listStyle: "none", margin: 0, padding: 0 };

/**
 * 버튼 글 사이에 넣는 한자 한 글자 — 굵기를 칸의 글자와 같은 400 으로 둔다. 버튼의 굵기(500)를 물려받으면
 * 그 굵기의 사이트 한자 서체 조각을 따로 내려받는다(2026-11-20 실측: 글자 하나에 조각 16개).
 */
const glyphInButton: CSSProperties = { fontWeight: 400 };

function textInputStyle(focused: boolean, invalid: boolean): CSSProperties {
  return {
    appearance: "none",
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    minHeight: 44,
    padding: "10px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: 16,
    color: "var(--color-text)",
    background: "var(--color-surface)",
    border: "1px solid " + (invalid ? "var(--color-amber-warm-700)" : "var(--color-border)"),
    borderRadius: "var(--radius-sm)",
    outline: focused ? "2px solid var(--color-teal)" : "none",
    outlineOffset: 1,
  };
}

// ------------------------------------------------------------
// 패널
// ------------------------------------------------------------
export function HanjaPickerPanel(props: HanjaPickerPanelProps) {
  return props.slot.target === "surname" ? <SurnamePanel {...props} /> : <NamePanel {...props} />;
}

/** 그 음절의 후보 목록 — 패널이 열릴 때 받는다. 못 받았으면 failed */
function useCandidates(syllable: string): { list: readonly HanjaFact[] | undefined; failed: boolean } {
  const store = usePickStore();
  useEffect(() => {
    void requestPickFile(syllable);
  }, [syllable]);
  return { list: store.files.get(syllable), failed: store.failed.has(syllable) };
}

function PanelShell({
  id,
  title,
  sub,
  pc,
  inputRef,
  onClose,
  head,
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  pc: boolean;
  /** PC 에서 열리자마자 커서를 둘 직접 입력 칸 */
  inputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  head: ReactNode;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 열리면 PC 는 직접 입력 칸, 그 밖은 제목으로 포커스를 옮긴다(휴대폰에서 키보드를 띄우지 않는다)
  useEffect(() => {
    const target = (pc ? inputRef.current : null) ?? titleRef.current;
    target?.focus({ preventScroll: true });
  }, [pc, inputRef]);

  return (
    <div
      id={id}
      role="region"
      aria-labelledby={titleId}
      className="hanja-picker-panel"
      style={panelStyle}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || e.nativeEvent.isComposing) return;
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="hanja-picker-head" style={headStyle}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              id={titleId}
              ref={titleRef}
              tabIndex={-1}
              style={{
                margin: 0,
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                lineHeight: 1.4,
                fontWeight: 700,
                color: "var(--color-text)",
                outline: "none",
              }}
            >
              {title}
            </h3>
            {sub && <p style={{ ...hintText, margin: "2px 0 0" }}>{sub}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ ...actionButton, flex: "0 0 auto", minWidth: 56, margin: "-2px -4px 0 0" }}
          >
            닫기
          </button>
        </div>
        {head}
      </div>
      <div className="hanja-picker-body" style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// 이름 패널
// ------------------------------------------------------------
function NamePanel({ id, slot, forbiddenCount, onPick, onAuto, onNone, onClose, onSpread }: HanjaPickerPanelProps) {
  const uid = useId();
  const searchId = `${uid}-search`;
  const avoidedId = `${uid}-avoided`;
  const pc = usePcPointer();
  const { list, failed } = useCandidates(slot.syllable);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [element, setElement] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showAvoided, setShowAvoided] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const groups = useMemo(() => groupCandidates(list ?? []), [list]);
  const filtering = query.trim() !== "" || element !== "";
  const matches = useMemo(
    () => (filtering ? filterCandidates(list ?? [], { query, element }) : []),
    [filtering, list, query, element]
  );

  const loaded = list !== undefined;
  // 쓸 글자가 하나도 없는 음절(몰·괵) — 자동 배정이 비므로 '자동'과 '한자 없이'가 같은 뜻이다
  const zeroUsable = slot.state === "hangul" || (loaded && groups.common.length + groups.others.length === 0);
  // 찾기·오행 거르기는 고를 글자가 있을 때만 둔다(쓸 글자가 없는 음절은 접힌 묶음 하나뿐이다)
  const hasList = loaded && list.length > 0 && !zeroUsable;
  const others = showAll ? groups.others : groups.others.slice(0, FIRST_OTHERS);
  const moreCount = groups.others.length - others.length;
  const hasExtension = (list ?? []).some((f) => !f.basic);

  const direct = (label: string, help: string | undefined, focusOnMount: boolean) => (
    <DirectInput
      slot={slot}
      list={list}
      label={label}
      help={help}
      inputRef={inputRef}
      focusOnMount={focusOnMount}
      onPick={onPick}
      onSpread={onSpread}
    />
  );

  const row = (fact: HanjaFact) => (
    <li key={fact.character}>
      <CandidateRow fact={fact} current={fact.character === slot.character} onPick={onPick} />
    </li>
  );

  return (
    <PanelShell
      id={id}
      title={namePanelTitle(slot.syllable)}
      sub={hasList ? `고를 수 있는 글자 ${list.length}자` : undefined}
      pc={pc}
      inputRef={inputRef}
      onClose={onClose}
      head={
        <>
          <div style={{ display: "flex", gap: 8 }}>
            {zeroUsable ? (
              <button type="button" onClick={onAuto} style={actionButton}>
                한글로 두기
              </button>
            ) : (
              <>
                <button type="button" onClick={onAuto} style={actionButton}>
                  자동으로 고르기
                </button>
                {onNone && (
                  <button type="button" onClick={onNone} style={actionButton}>
                    한자 없이 한글로
                  </button>
                )}
              </>
            )}
          </div>
          {/* 넓으면 직접 입력과 찾기를 나란히, 좁으면 위아래로 — 붙어 있는 머리가 목록을 덜 가리게 */}
          {(pc || hasList) && (
            <div style={headFields}>
              {pc && direct("직접 입력", DIRECT_HELP, false)}
              {hasList && (
                <div style={headField}>
                  <label htmlFor={searchId} style={fieldLabel}>
                    뜻·글자로 찾기
                  </label>
                  <input
                    id={searchId}
                    type="text"
                    value={query}
                    placeholder="예: 빛, 맑을"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    style={textInputStyle(searchFocused, false)}
                  />
                </div>
              )}
            </div>
          )}
          {hasList && (
            <div role="group" aria-label="자원오행으로 거르기" style={{ display: "flex", gap: 4 }}>
              <ElementButton label="전체" on={element === ""} onClick={() => setElement("")} />
              {ELEMENT_FILTERS.map((el) => (
                <ElementButton key={el} element={el} on={element === el} onClick={() => setElement(el)} />
              ))}
            </div>
          )}
        </>
      }
    >
      {zeroUsable && <p style={{ ...hintText, marginTop: 10 }}>{noHanjaSyllableNote(slot.syllable)}</p>}

      {!loaded && !failed && (
        <p role="status" style={{ ...hintText, marginTop: 10 }}>
          {PANEL_LOADING}
        </p>
      )}
      {!loaded && failed && (
        <p role="alert" style={{ ...warnText, marginTop: 10 }}>
          {PANEL_LOAD_FAILED}
        </p>
      )}

      {loaded && filtering && (
        <>
          <p role="status" style={{ ...hintText, marginTop: 10 }}>
            {matches.length > 0 ? `${matches.length}자 찾음` : searchEmptyNote(pc)}
          </p>
          {matches.length > 0 && (
            <ul aria-label="찾은 글자" style={listReset}>
              {matches.map(row)}
            </ul>
          )}
        </>
      )}

      {loaded && !filtering && (
        <>
          {groups.common.length > 0 && (
            <>
              <p style={groupTitle}>먼저 보여 드리는 글자</p>
              <p style={{ ...hintText, margin: "2px 0 0" }}>
                이 사이트가 이름 글자로 꼽아 둔 글자예요 — 사용 통계는 아닙니다.
              </p>
              <ul aria-label="먼저 보여 드리는 글자" style={listReset}>
                {groups.common.map(row)}
              </ul>
            </>
          )}
          {groups.others.length > 0 && (
            <>
              {groups.common.length > 0 && <p style={groupTitle}>그 밖의 글자</p>}
              <ul aria-label={groups.common.length > 0 ? "그 밖의 글자" : "고를 수 있는 글자"} style={listReset}>
                {others.map(row)}
              </ul>
              {moreCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  style={{ ...actionButton, width: "100%", marginTop: 8 }}
                >
                  더 보기 ({moreCount}자)
                </button>
              )}
            </>
          )}
          {groups.avoided.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                aria-expanded={showAvoided}
                aria-controls={showAvoided ? avoidedId : undefined}
                onClick={() => setShowAvoided((open) => !open)}
                style={{ ...actionButton, width: "100%", textAlign: "left" }}
              >
                <span aria-hidden style={{ marginRight: 6 }}>
                  {showAvoided ? "▾" : "▸"}
                </span>
                이름에 피하는 글자 · 뜻 풀이가 없는 글자 ({groups.avoided.length}자)
              </button>
              {showAvoided && (
                <div id={avoidedId}>
                  <p style={{ ...hintText, marginTop: 8 }}>{avoidedGroupIntro(forbiddenCount)}</p>
                  <ul aria-label="이름에 피하는 글자 · 뜻 풀이가 없는 글자" style={listReset}>
                    {groups.avoided.map(row)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {!pc &&
          (pasteOpen || failed ? (
            direct("한자 붙여 넣기", undefined, pasteOpen)
          ) : (
            <button
              type="button"
              aria-expanded={false}
              onClick={() => setPasteOpen(true)}
              style={{ ...actionButton, width: "100%" }}
            >
              복사한 한자 붙여 넣기
            </button>
          ))}
        <p style={{ ...hintText, margin: 0 }}>
          {STROKE_NOTICE}{" "}
          <Link href="/method" style={{ color: "var(--color-teal-800)", fontWeight: 500 }}>
            작명 원리
          </Link>
        </p>
        {hasExtension && <p style={{ ...hintText, margin: 0 }}>{EXTENSION_NOTICE}</p>}
      </div>
    </PanelShell>
  );
}

function ElementButton({
  element,
  label,
  on,
  onClick,
}: {
  element?: string;
  label?: string;
  on: boolean;
  onClick: () => void;
}) {
  const def = element ? FIVE_EL[element] : undefined;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={def ? `${def.name}(${def.label})` : undefined}
      onClick={onClick}
      style={{
        appearance: "none",
        flex: "1 1 0",
        minWidth: 0,
        minHeight: 44,
        padding: "4px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        background: on ? (def ? def.tintBg : "var(--color-navy-50)") : "var(--color-surface)",
        border: on ? "1.5px solid var(--color-navy)" : "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-sans)",
        color: def ? def.text : "var(--color-text)",
        fontWeight: on ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {def ? (
        <>
          <span style={{ fontSize: 15, lineHeight: 1.1 }}>{def.label}</span>
          <span style={{ fontSize: 10.5, lineHeight: 1.1 }}>{def.name}</span>
        </>
      ) : (
        <span style={{ fontSize: 13 }}>{label}</span>
      )}
    </button>
  );
}

/** 목록 한 줄 — 버튼 하나, 두 줄 꼴(글자 · 훈 / 자원오행 · 획수 · 음양 · 등급 · 표시) */
function CandidateRow({
  fact,
  current,
  onPick,
}: {
  fact: HanjaFact;
  current: boolean;
  onPick: (fact: HanjaFact) => void;
}) {
  const el = FIVE_EL[fact.fiveElement];
  const gradeKey = gradeBadgeKey(fact.resourceGrade, fact.vReasons);
  const grade = gradeKey && gradeKey !== "R" ? RESOURCE_GRADE_INFO[gradeKey as ResourceBadgeKey]?.label : undefined;
  return (
    <button
      type="button"
      aria-current={current || undefined}
      onClick={() => onPick(fact)}
      style={{
        appearance: "none",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        width: "100%",
        minHeight: 56,
        boxSizing: "border-box",
        padding: "8px 6px",
        textAlign: "left",
        // 지금 고른 글자는 바탕색이 아니라 왼쪽 선과 글로 알린다 — 바탕을 칠하면 오행 칩 글자의 대비가 4.5:1 아래로 떨어진다
        background: "transparent",
        border: "none",
        borderLeft: current ? "3px solid var(--color-teal)" : "3px solid transparent",
        borderBottom: "1px solid var(--color-divider)",
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
      }}
    >
      <span
        className="hanja-picker-glyph"
        style={{
          flex: "0 0 36px",
          width: 36,
          fontSize: 28,
          lineHeight: "40px",
          textAlign: "center",
          color: "var(--color-text)",
        }}
      >
        {fact.character}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 15,
            lineHeight: 1.4,
            color: fact.gloss ? "var(--color-text)" : "var(--color-text-2)",
            wordBreak: "keep-all",
            overflowWrap: "anywhere",
          }}
        >
          {fact.gloss || "뜻 풀이 없음"}
        </span>
        <span
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "2px 8px",
            marginTop: 4,
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--color-text-2)",
          }}
        >
          {el && (
            <span
              style={{
                padding: "0 6px",
                borderRadius: 4,
                background: el.tintBg,
                color: el.text,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {el.label} · {el.name}
            </span>
          )}
          {fact.strokeCount > 0 && <span>{fact.strokeCount}획</span>}
          {fact.yinYang && <span>{fact.yinYang}</span>}
          {grade && <span>{grade}</span>}
          {!fact.basic && <span>확장 한자</span>}
          {fact.forbidden && <span style={{ color: "var(--color-amber-warm-700)" }}>이름에 피하는 글자</span>}
          {current && <span style={{ color: "var(--color-teal-800)", fontWeight: 600 }}>지금 고른 글자</span>}
        </span>
      </span>
    </button>
  );
}

// ------------------------------------------------------------
// 성씨 패널 — 글자 격자(글자 + 획수)뿐이다
// ------------------------------------------------------------
function SurnamePanel({ id, slot, representative, onPick, onAuto, onClose, onSpread }: HanjaPickerPanelProps) {
  const pc = usePcPointer();
  const { list, failed } = useCandidates(slot.syllable);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);

  const sorted = useMemo(() => sortForSurname(list ?? [], representative), [list, representative]);
  const loaded = list !== undefined;
  const pick = (fact: HanjaFact) => onPick(asSurnameFact(fact));

  const direct = (label: string, help: string | undefined, focusOnMount: boolean) => (
    <DirectInput
      slot={slot}
      list={list}
      label={label}
      help={help}
      inputRef={inputRef}
      focusOnMount={focusOnMount}
      onPick={pick}
      onSpread={onSpread}
    />
  );

  return (
    <PanelShell
      id={id}
      title={surnamePanelTitle(slot.syllable)}
      pc={pc}
      inputRef={inputRef}
      onClose={onClose}
      head={
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onAuto} style={actionButton}>
              {representative ? (
                <>
                  기본 한자로 (<span className="font-hanja" style={glyphInButton}>{representative}</span>)
                </>
              ) : (
                "자동으로 고르기"
              )}
            </button>
          </div>
          {pc && direct("직접 입력", DIRECT_HELP, false)}
        </>
      }
    >
      <p style={{ ...hintText, marginTop: 10 }}>{surnamePanelIntro(!!representative)}</p>

      {!loaded && !failed && (
        <p role="status" style={{ ...hintText, marginTop: 10 }}>
          {PANEL_LOADING}
        </p>
      )}
      {!loaded && failed && (
        <p role="alert" style={{ ...warnText, marginTop: 10 }}>
          {PANEL_LOAD_FAILED}
        </p>
      )}

      {loaded && sorted.length > 0 && (
        <ul
          aria-label={`${slot.syllable} 성씨 한자`}
          style={{
            ...listReset,
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
            gap: 6,
          }}
        >
          {sorted.map((fact) => {
            const isDefault = fact.character === representative;
            const current = fact.character === slot.character;
            const strokes = fact.strokeCount > 0 ? `${fact.strokeCount}획` : "";
            return (
              <li key={fact.character}>
                <button
                  type="button"
                  aria-label={[fact.character, strokes].filter(Boolean).join(" ") + (isDefault ? ", 기본 한자" : "")}
                  aria-current={current || undefined}
                  onClick={() => pick(fact)}
                  style={{
                    appearance: "none",
                    width: "100%",
                    minHeight: 56,
                    boxSizing: "border-box",
                    padding: "4px 2px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    background: current ? "var(--color-teal-50)" : "var(--color-surface)",
                    border: current ? "1.5px solid var(--color-teal)" : "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--font-sans)",
                    color: "var(--color-text)",
                    cursor: "pointer",
                  }}
                >
                  <span className="hanja-picker-glyph" style={{ fontSize: 26, lineHeight: 1.15 }}>
                    {fact.character}
                  </span>
                  <span style={{ fontSize: 11, lineHeight: 1.2, color: "var(--color-text-2)" }}>{strokes}</span>
                  {isDefault && (
                    <span style={{ fontSize: 10.5, lineHeight: 1.2, fontWeight: 600, color: "var(--color-teal-800)" }}>
                      기본
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {!pc &&
          (pasteOpen || failed ? (
            direct("한자 붙여 넣기", undefined, pasteOpen)
          ) : (
            <button
              type="button"
              aria-expanded={false}
              onClick={() => setPasteOpen(true)}
              style={{ ...actionButton, width: "100%" }}
            >
              복사한 한자 붙여 넣기
            </button>
          ))}
        <p style={{ ...hintText, margin: 0 }}>
          {STROKE_NOTICE}{" "}
          <Link href="/method" style={{ color: "var(--color-teal-800)", fontWeight: 500 }}>
            작명 원리
          </Link>
        </p>
      </div>
    </PanelShell>
  );
}

// ------------------------------------------------------------
// 직접 입력 — 두 단계 판정(설계 §8-5)
// ------------------------------------------------------------

/** 서버 판정의 진행 — known 은 '그 음절 목록을 받아서 없는 글자임을 아는가' */
type Judge =
  | { phase: "checking"; known: boolean }
  | { phase: "done"; known: boolean; message: string; suggestion: HanjaFact | null }
  | { phase: "timeout"; known: boolean };

const HANGUL_ONLY = /^[가-힣ㄱ-ㅎㅏ-ㅣ\s]+$/;

function DirectInput({
  slot,
  list,
  label,
  help,
  inputRef,
  focusOnMount,
  onPick,
  onSpread,
}: {
  slot: HanjaSlot;
  /** 그 음절의 후보 — 아직 못 받았으면 undefined(그때는 서버 판정으로만 받는다) */
  list: readonly HanjaFact[] | undefined;
  label: string;
  help?: string;
  inputRef: RefObject<HTMLInputElement | null>;
  /** 접어 둔 칸을 펼쳤을 때 — 바로 붙여 넣을 수 있게 커서를 둔다 */
  focusOnMount: boolean;
  onPick: (fact: HanjaFact) => void;
  onSpread?: (characters: string[]) => void;
}) {
  const uid = useId();
  const inputId = `${uid}-direct`;
  const helpId = `${uid}-help`;
  const noteId = `${uid}-note`;

  const [value, setValue] = useState("");
  const [composing, setComposing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [judge, setJudge] = useState<Judge | null>(null);

  // 판정 요청 번호 — 늦게 온 응답·시간이 지난 응답을 버린다
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus({ preventScroll: true });
  }, [focusOnMount, inputRef]);

  useEffect(
    () => () => {
      seqRef.current = seqRef.current + 1;
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    },
    []
  );

  function dropJudge() {
    seqRef.current = seqRef.current + 1;
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    setJudge(null);
  }

  /** 목록에 없는 글자 — 서버에 까닭을 묻는다. 보내는 것은 뽑은 한자 한 글자와 이 칸의 음절뿐이다 */
  function askServer(raw: string, known: boolean) {
    const text = firstHanCodePoint(raw);
    if (!text) return;
    seqRef.current = seqRef.current + 1;
    const seq = seqRef.current;
    clearTimeout(timerRef.current);
    setJudge({ phase: "checking", known });
    timerRef.current = setTimeout(() => {
      if (seqRef.current !== seq) return;
      seqRef.current = seqRef.current + 1;
      setJudge({ phase: "timeout", known });
    }, JUDGE_TIMEOUT_MS);
    hanjaResolve({ text, syllable: slot.syllable, target: slot.target })
      .then((res) => {
        if (seqRef.current !== seq) return;
        clearTimeout(timerRef.current);
        if (res.status === "ok" && res.hanja) {
          setJudge(null);
          onPick(res.hanja);
          return;
        }
        // 권하는 글자는 이 음절 목록에 있을 때만 버튼으로 낸다(다른 음절의 글자를 이 칸에 넣지 않는다)
        const suggested = res.suggestion?.character;
        const suggestion = (suggested && list?.find((f) => f.character === suggested)) || null;
        setJudge({ phase: "done", known, message: res.message ?? DIRECT_NOT_HANJA, suggestion });
      })
      .catch(() => {
        if (seqRef.current !== seq) return;
        clearTimeout(timerRef.current);
        setJudge({ phase: "timeout", known });
      });
  }

  /** 값에서 한자를 뽑아 처리한다. 한자가 있으면 칸을 비운다 */
  function handleText(raw: string) {
    const characters = hanCharsOf(raw);
    if (characters.length === 0) {
      setValue(raw);
      if (raw.trim() !== "") dropJudge();
      return;
    }
    setValue("");
    if (characters.length > 1 && onSpread) {
      dropJudge();
      onSpread(characters);
      return;
    }
    const found = list?.find((f) => f.character === characters[0]);
    if (found) {
      dropJudge();
      onPick(found);
      return;
    }
    askServer(raw, list !== undefined);
  }

  const leftover = value.trim();
  const hangulOnly = !judge && leftover !== "" && HANGUL_ONLY.test(leftover);
  const notHanja = !judge && !composing && leftover !== "" && !HANGUL_ONLY.test(leftover);
  const alertText = judge
    ? [
        judge.known ? notInListNote(slot.syllable) : "",
        judge.phase === "done" ? judge.message : "",
        judge.phase === "timeout" ? judgeTimeoutNote(slot.target) : "",
      ]
        .filter(Boolean)
        .join(" ")
    : notHanja
      ? DIRECT_NOT_HANJA
      : "";
  const invalid = alertText !== "";
  const hasNote = invalid || hangulOnly || judge?.phase === "checking";
  const describedBy = [help ? helpId : "", hasNote ? noteId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <div style={headField}>
        <label htmlFor={inputId} style={fieldLabel}>
          {label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const next = e.target.value;
            // 조합 중에는 판정하지 않는다 — 한글을 한자로 바꾸는 중이다
            if (composing || (e.nativeEvent as InputEvent).isComposing) {
              setValue(next);
              return;
            }
            handleText(next);
          }}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(e) => {
            setComposing(false);
            handleText(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            handleText(value);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={textInputStyle(focused, invalid)}
        />
      </div>
      {/* 도움말·판정 문장은 입력 칸 옆 칸(찾기) 아래까지 한 줄로 쓴다 — 머리가 넓을 때 반쪽 폭에서 줄이 늘지 않게 */}
      {(help || hasNote) && (
        <div style={directNotes}>
          {help && (
            <p id={helpId} style={{ ...hintText, margin: 0 }}>
              {help}
            </p>
          )}
          {hasNote && (
            <div id={noteId}>
              {alertText && (
                <p role="alert" style={warnText}>
                  {alertText}
                </p>
              )}
              {judge?.phase === "checking" && (
                <p role="status" style={hintText}>
                  {DIRECT_CHECKING}
                </p>
              )}
              {hangulOnly && (
                <p role="status" style={hintText}>
                  {hangulOnlyHelp(slot.syllable)}
                </p>
              )}
              {judge?.phase === "done" && judge.suggestion && (
                <button
                  type="button"
                  aria-label={`${judge.suggestion.character} — 이 글자로 넣기`}
                  onClick={() => {
                    const fact = judge.suggestion;
                    if (fact) onPick(fact);
                  }}
                  style={{ ...actionButton, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <span className="font-hanja" style={{ ...glyphInButton, fontSize: 20, lineHeight: 1 }}>
                    {judge.suggestion.character}
                  </span>
                  이 글자로 넣기
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
