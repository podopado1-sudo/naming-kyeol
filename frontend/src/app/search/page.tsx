"use client";

import { useState, useEffect, useLayoutEffect, useRef, useSyncExternalStore, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

import { EmptyState } from "@/components/results/EmptyState";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import {
  SmartResultPage,
  type RequestSummary,
} from "@/components/design/SmartResult";
import { cn } from "@/lib/utils";
import { smart } from "@/lib/api";
import { ENGLISH_NAME_MAX, englishNameProblem } from "@/lib/english-name";
import { firstHanCodePoint, isHangulSyllables } from "@/lib/hanja-pick";
import { requestPickFile } from "@/lib/hanja-pick-store";
import { josa } from "@/lib/josa";
import {
  cleanNameInput,
  nameInputMessage,
  nameInputProblem,
  SURNAME_MAX_LENGTH,
} from "@/lib/name-input";
import { splitParentName, splitParentPair } from "@/lib/name-split";
import { KEYWORD_HANGUL_REQUIRED, keywordHasHangul } from "@/lib/parent-naming";
import type {
  SmartRecommendationRequest,
  SmartRecommendationResponse,
} from "@/lib/types";

const HERO_SUBLINES = [
  "좋은 소리는 결이 다릅니다. 부를수록 깊어지는 이름.",
  "유행을 타지 않는 클래식, 이름의 결에서 발견하세요.",
  "입술 끝에서 시작되어 마음속 깊이 남는 울림.",
  "결이 고운 이름은 시간이 흐를수록 그 가치를 증명합니다.",
];

/** 스토리 키워드 글자 수 — 백엔드 SmartRecommendationRequestDto.StoryKeyword 의 StringLength(50) */
const STORY_KEYWORD_MAX = 50;
/** '추가 옵션' 접기 칸의 값 */
const OPTIONS_PANEL = "options";

// ============================================================
// 폼 값 · 제출 스냅샷 · 새로 고침 복원 (2026-11-27 버그 목록 G-search)
//
// - 폼의 처음 값은 주소 쿼리(홈 Hero·/evaluate '비슷한 이름 추천'·검색 SearchAction)에서 읽는다.
// - 추천 요청을 시작하면 주소에서 쿼리를 걷는다(search-query-persists — 부모 이름·생년월일이 결과 화면 내내 주소창·기록에 남아
//   복사·공유로 따라가고, 받은 사람이 열면 autoStart 로 추천이 한 번 더 돌았다). 걷은 뒤의 새로 고침·뒤로 가기는
//   그 기록 칸(history.state 의 표)의 폼 값과 결과를 이 탭의 sessionStorage 에서 되살린다 — 자동 재요청 없이.
//   표마다 따로 담아(최근 RESTORE_MAX_ENTRIES 칸) 같은 탭에서 추천을 또 받아도 앞선 기록 칸으로 돌아가면 그 칸의 값이 나온다.
//   다른 길로 /search 에 새로 오면(헤더 링크 등 — 표가 없는 기록 칸) 빈 폼이다.
// - 세션 저장은 클라이언트 첫 렌더부터 읽는다(useSyncExternalStore) — 서버 렌더·하이드레이션 렌더는 쿼리 값만 써서 같다
//   (next dev 는 useSearchParams 경계 안도 서버에서 그린다). 되살린 값은 폼을 새 key 로 다시 그려 넣는다.
// - 결과 화면(조건 칩·'상세 보기'·저장)은 제출 때 잡은 값(SubmittedQuery)만 쓴다(form-snapshot-search — 응답을 기다리는 동안
//   폼을 고치면 고친 값이 링크·저장에 실렸다. /dual-name 의 SubmittedQuery 와 같은 방식).
// ============================================================

/** 폼 값 전체 — 주소 쿼리나 세션 저장에서 처음 값을 채운다 */
interface SearchForm {
  lastName: string;
  /** "none" | "male" | "female" */
  gender: string;
  birthDate: string;
  birthTime: string;
  /** "neutral" | "soft" | "strong" */
  tone: string;
  /** 용신 기반 추천 파라미터(옛 링크의 ?preferredElement=) — 화면에서 고치지 않는다 */
  preferredElement: string;
  includePureKorean: boolean;
  includeThreeSyllable: boolean;
  includeCreative: boolean;
  includeTwin: boolean;
  includeParentBased: boolean;
  includeDualName: boolean;
  includeRequiredChar: boolean;
  fatherName: string;
  motherName: string;
  storyKeyword: string;
  englishName: string;
  requiredChar: string;
  requiredCharPosition: string;
  requiredHanja: string;
  preferredMeanings: string;
}

/** 쿼리 → 폼 처음 값. 쿼리가 비면 기본값이다 */
function formFromQuery(params: Pick<URLSearchParams, "get">): SearchForm {
  const g = params.get("gender");
  const t = params.get("tone");
  const parentName = params.get("parentName") ?? "";
  const story = params.get("story") ?? "";
  const englishName = params.get("englishName") ?? "";
  // 홈 Hero 의 한 칸 '부모 이름'('김민호 · 이수정')은 아버지·어머니 두 칸으로 가른다
  const [father, mother] = splitParentPair(parentName);
  return {
    lastName: params.get("lastName") ?? "",
    gender: g === "male" || g === "female" ? g : "none",
    birthDate: params.get("birthDate") ?? "",
    birthTime: params.get("birthTime") ?? "",
    tone: t === "soft" || t === "strong" ? t : "neutral",
    preferredElement: params.get("preferredElement") ?? "",
    includePureKorean: true,
    includeThreeSyllable: true,
    includeCreative: true,
    includeTwin: false,
    // 부모 이름이나 스토리 키워드가 들어오면 부모 기반 토글을 켠다 — Hero 가 '값을 입력하면 해당 추천 카테고리(부모 기반·…)가
    // 자동으로 켜집니다'라고 안내한다(옛 화면은 story 를 읽지 않아 키워드가 통째로 버려졌다 — story-keyword-dropped)
    includeParentBased: Boolean(parentName || story),
    // 영어 이름이 들어오면 dual-name 토글을 켠다
    includeDualName: Boolean(englishName),
    includeRequiredChar: false,
    fatherName: father,
    motherName: mother,
    storyKeyword: story.slice(0, STORY_KEYWORD_MAX),
    englishName,
    requiredChar: "",
    requiredCharPosition: "any",
    // 항렬자 한자 (선택) — 형제자매 공유 한자
    requiredHanja: "",
    // 의미 선호 키워드 — 입력은 콤마/공백 구분 문자열, 요청 시 배열로 분해
    preferredMeanings: "",
  };
}

/**
 * 결과를 받은 요청의 입력 — 결과 화면(조건 칩·'상세 보기' 링크·저장)은 이 값을 쓴다.
 * 응답을 기다리는 동안(콜드 스타트 30초 안팎) 폼을 바꿔도 결과와 다른 조건이 링크·저장에 실리지 않게 제출 때 잡아 둔다.
 */
interface SubmittedQuery {
  /** 요청에 보낸 성씨 그대로(다듬은 값) */
  lastName: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  tone: string;
  includePureKorean: boolean;
  includeCreative: boolean;
}

/** 응답과 그 요청의 입력 — 늘 한 덩어리로 바꾼다 */
interface SearchOutcome {
  data: SmartRecommendationResponse;
  query: SubmittedQuery;
}

/** 이 탭의 세션 저장 키 — 기록 칸(표)마다 /search 요청의 폼 값과 결과(탭을 닫으면 브라우저가 지운다) */
const RESTORE_STORAGE_KEY = "nameform:search-restore";
/** history.state 안의 표 — 이 기록 칸에서 보낸 요청의 저장 값을 찾는 열쇠 */
const RESTORE_HISTORY_KEY = "nameformSearch";

// ---- 세션 저장 지도 (순수 함수 — 창·저장소를 만지지 않는다. tests/fix1127-search.test.mjs 가 이 구간을 떼어 돌린다) ----
/** 저장 꼴의 판 — 꼴을 바꾸면 올린다(다른 판의 값은 읽지 않는다) */
const RESTORE_VERSION = 2;
/** 기록 칸을 몇 개까지 담는지 — 넘으면 마지막으로 쓴 때(savedAt)가 오래된 칸부터 지운다 */
const RESTORE_MAX_ENTRIES = 5;
/**
 * 결과를 되살리는 시한 — 지난 결과(배포 사이에 응답 꼴이 바뀌었을 수 있다)는 폼 값만 되살리고,
 * 다음에 저장할 때 지운다(되살리지 않을 결과를 탭에 남겨 두지 않는다)
 */
const RESTORE_RESULT_MAX_AGE_MS = 3 * 60 * 60 * 1000;

interface StoredEntry {
  savedAt: number;
  form: unknown;
  outcome?: unknown;
}
type StoredEntries = Record<string, StoredEntry>;

/** 저장 문자열 → 기록 칸 지도. 꼴이 다르면(다른 판·깨진 값) 빈 지도, 꼴이 다른 칸만 뺀다 */
function parseStoredEntries(raw: string | null): StoredEntries {
  const out: StoredEntries = Object.create(null);
  if (!raw) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== "object") return out;
  const { v, entries } = parsed as { v?: unknown; entries?: unknown };
  if (v !== RESTORE_VERSION || !entries || typeof entries !== "object" || Array.isArray(entries)) return out;
  for (const [token, value] of Object.entries(entries as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const { savedAt, form, outcome } = value as Partial<StoredEntry>;
    if (typeof savedAt !== "number" || !Number.isFinite(savedAt) || !form || typeof form !== "object") continue;
    out[token] = outcome === undefined ? { savedAt, form } : { savedAt, form, outcome };
  }
  return out;
}

/** 이 표의 칸 — 폼 값과, 시한 안이면 결과. 칸이 없으면 null */
function restorableEntry(raw: string | null, token: string, now: number): { form: unknown; outcome: unknown } | null {
  const entries = parseStoredEntries(raw);
  if (!Object.prototype.hasOwnProperty.call(entries, token)) return null;
  const entry = entries[token];
  const fresh = entry.outcome !== undefined && now - entry.savedAt <= RESTORE_RESULT_MAX_AGE_MS;
  return { form: entry.form, outcome: fresh ? entry.outcome : null };
}

/**
 * 이 표의 칸을 넣거나 바꾼 뒤 저장할 문자열 — 앞의 것부터 써 보고 저장소가 꽉 차 실패하면 다음 것으로
 * (모든 칸 → 결과는 이 칸 것만 → 폼 값만 → 이 칸의 폼 값만). 다른 표의 칸은 지우지 않고 최근 RESTORE_MAX_ENTRIES 칸을 남긴다
 */
function storageAttempts(raw: string | null, token: string, entry: StoredEntry, now: number): Array<() => string> {
  const entries = parseStoredEntries(raw);
  entries[token] = entry;
  const others = Object.keys(entries)
    .filter((t) => t !== token)
    .sort((a, b) => entries[b].savedAt - entries[a].savedAt)
    .slice(0, RESTORE_MAX_ENTRIES - 1);
  const keep = [token, ...others];
  const serialize = (withOutcome: (t: string) => boolean, tokens: string[]) => () => {
    const picked: StoredEntries = Object.create(null);
    for (const t of tokens) {
      const { savedAt, form, outcome } = entries[t];
      const freshOutcome = outcome !== undefined && now - savedAt <= RESTORE_RESULT_MAX_AGE_MS;
      picked[t] = freshOutcome && withOutcome(t) ? { savedAt, form, outcome } : { savedAt, form };
    }
    return JSON.stringify({ v: RESTORE_VERSION, entries: picked });
  };
  return [
    serialize(() => true, keep),
    serialize((t) => t === token, keep),
    serialize(() => false, keep),
    serialize(() => false, [token]),
  ];
}
// ---- 세션 저장 지도 끝 ----

/** 저장해 둔 폼 값 — 아는 칸만, 같은 타입일 때만 받는다(모르는 값은 기본값) */
function storedForm(raw: unknown): SearchForm | null {
  if (!raw || typeof raw !== "object") return null;
  const form: SearchForm = formFromQuery(new URLSearchParams());
  const src = raw as Record<string, unknown>;
  const out = form as unknown as Record<string, unknown>;
  for (const key of Object.keys(form)) {
    if (typeof src[key] === typeof out[key]) out[key] = src[key];
  }
  return form;
}

/** 저장해 둔 결과 — 꼴이 다르면 버린다 */
function storedOutcome(raw: unknown): SearchOutcome | null {
  if (!raw || typeof raw !== "object") return null;
  const { data, query } = raw as Partial<SearchOutcome>;
  if (!data || typeof data.lastName !== "string" || !Array.isArray(data.categories)) return null;
  if (!data.categories.every((c) => !!c && typeof c.type === "string" && Array.isArray(c.names))) return null;
  if (!query || typeof query !== "object") return null;
  const strings = [query.lastName, query.birthDate, query.birthTime, query.gender, query.tone];
  if (!strings.every((s) => typeof s === "string")) return null;
  if (typeof query.includePureKorean !== "boolean" || typeof query.includeCreative !== "boolean") return null;
  return { data, query };
}

function historyToken(): string | null {
  try {
    const state = window.history.state as Record<string, unknown> | null;
    const token = state?.[RESTORE_HISTORY_KEY];
    return typeof token === "string" ? token : null;
  } catch {
    return null;
  }
}

/** 폼·결과의 처음 값 — token 은 이 기록 칸의 세션 저장 표(쿼리로 새로 들어왔으면 null) */
interface SearchSeed {
  token: string | null;
  form: SearchForm;
  outcome: SearchOutcome | null;
}

/** 이 기록 칸(새로 고침·뒤로 가기)의 표로 저장해 둔 폼 값·결과. 없으면 null */
function readRestorable(): SearchSeed | null {
  if (typeof window === "undefined") return null;
  const token = historyToken();
  if (!token) return null;
  try {
    const found = restorableEntry(window.sessionStorage.getItem(RESTORE_STORAGE_KEY), token, Date.now());
    if (!found) return null;
    const form = storedForm(found.form);
    if (!form) return null;
    return { token, form, outcome: storedOutcome(found.outcome) };
  } catch {
    return null;
  }
}

/**
 * 세션 저장 — 이 표의 칸만 바꾸고 다른 기록 칸은 남긴다. 저장소가 꽉 차면 다른 칸의 결과부터 덜어 낸다.
 * 저장소를 못 쓰면 아무것도 하지 않는다(복원만 안 될 뿐)
 */
function writeRestorable(token: string, form: SearchForm, outcome: SearchOutcome | null) {
  try {
    const storage = window.sessionStorage;
    const now = Date.now();
    const entry: StoredEntry = outcome ? { savedAt: now, form, outcome } : { savedAt: now, form };
    for (const attempt of storageAttempts(storage.getItem(RESTORE_STORAGE_KEY), token, entry, now)) {
      try {
        storage.setItem(RESTORE_STORAGE_KEY, attempt());
        return;
      } catch {
        // 꽉 참 — 덜어 낸 다음 꼴로
      }
    }
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등) — 복원 없이 그대로
  }
}

function newRestoreToken(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // 아래 대체 값
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 주소에서 쿼리를 걷고 이 기록 칸에 표를 단다(새 기록을 쌓지 않는다).
 * Next 가 감싼 history.replaceState 로 부른다 — useSearchParams 가 함께 바뀌고(autoStart 가 꺼진다) 화면 상태는 그대로다
 * (App Router 는 쿼리만 다른 같은 경로에서 상태를 지우지 않는다). 첫 문서의 autoStart 는 마운트 효과에서 돌아, 같은 커밋이면
 * 조상(AppRouter)의 효과 — history 를 감싸는 곳 — 보다 먼저라 한 틱 미룬다. data 에 Next 내부 값(__NA)을 넣지 않는다
 * (넣으면 Next 가 주소 바뀜을 모른 채 지나가 다음 갱신 때 옛 주소로 되돌린다 — Next 가 내부 값을 스스로 옮겨 붙인다).
 */
function markEntryAndStripQuery(token: string) {
  window.setTimeout(() => {
    try {
      window.history.replaceState({ [RESTORE_HISTORY_KEY]: token }, "", window.location.pathname + window.location.hash);
    } catch {
      // 주소를 못 바꾸면 그대로 둔다
    }
  }, 0);
}

/** 구독할 것이 없는 저장소 — useSyncExternalStore 로 '클라이언트인지'만 읽는다 */
const subscribeNothing = () => () => {};

/** 필수 글자 칸과 항렬자 한자의 독음이 다를 때 — 한자 뒤에는 조사를 붙이지 않는다(독음을 모른다) */
function requiredHanjaMismatchMessage(hanja: string, syllable: string): string {
  return `‘${hanja}’ 글자는 이 사이트 사전에서 ‘${syllable}’${josa(syllable, "으로/로")} 읽지 않아요. 글자 칸을 항렬자의 음으로 고치거나 항렬자 칸을 비워 주세요.`;
}

// 서버 렌더에서 useLayoutEffect 경고를 피한다 — 운영 빌드는 이 폼을 클라이언트에서만 그리지만(useSearchParams 의 Suspense 경계),
// next dev 는 경계 안도 서버에서 그린다
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * 폼·결과의 처음 값을 정한다. 서버 렌더와 하이드레이션 렌더는 쿼리 값만 쓰고(둘이 같다 — next dev 의 하이드레이션 불일치 방지),
 * 클라이언트 첫 렌더에서 한 번 이 기록 칸의 세션 저장을 읽어 있으면 그 값으로 폼을 새 key 로 그린다.
 * 운영 빌드는 이 경계를 클라이언트에서만 그려 첫 렌더부터 클라이언트라 그리기 전에 바뀐다.
 * 처음 값은 한 번만 — 요청을 시작하면 주소에서 쿼리를 걷으므로 그 뒤의 searchParams 로 폼을 다시 채우지 않는다
 */
function BabyNamingInner({
  onResultChange,
}: {
  /** 결과 화면으로 바뀌는지 — 바깥의 헤더·제목·소개·푸터를 숨기는 데 쓴다 */
  onResultChange: (showingResult: boolean) => void;
}) {
  const searchParams = useSearchParams();
  const [seed, setSeed] = useState<SearchSeed>(() => ({
    token: null,
    form: formFromQuery(searchParams),
    outcome: null,
  }));
  const onClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [restoreChecked, setRestoreChecked] = useState(false);
  if (onClient && !restoreChecked) {
    setRestoreChecked(true);
    // 쿼리가 있으면(새로 들어온 길) 되살리지 않는다
    const restored = searchParams.toString() === "" ? readRestorable() : null;
    if (restored) setSeed(restored);
  }
  return (
    <SearchBody
      key={seed.token ?? ""}
      seed={seed}
      autoStart={searchParams.get("autoStart") === "1"}
      onResultChange={onResultChange}
    />
  );
}

function SearchBody({
  seed,
  autoStart,
  onResultChange,
}: {
  /** 처음 값 — 마운트 때만 읽는다(바뀌면 바깥이 key 를 바꿔 새로 그린다) */
  seed: SearchSeed;
  /** Hero 에서 autoStart=1 로 들어왔는지 — 요청을 시작하면 주소에서 걷혀 false 가 된다 */
  autoStart: boolean;
  onResultChange: (showingResult: boolean) => void;
}) {
  /** 이 기록 칸의 세션 저장 표 — 되살린 칸의 것, 그 뒤로는 마지막으로 시작한 요청의 것 */
  const entryToken = useRef<string | null>(seed.token);

  function handleCandidateDetail(query: SubmittedQuery, fullName: string, evaluateHanja?: string) {
    // fullName = lastName + firstName (예: "허기태"). 분리해서 /evaluate로 이동.
    // 추천 요청의 컨텍스트(생일·시간·성별·톤)도 함께 전달 → 자동 평가. 값은 결과를 받은 요청의 것(지금 폼이 아니라)
    const ln = query.lastName;
    const first = ln && fullName.startsWith(ln) ? fullName.slice(ln.length) : fullName;
    const params = new URLSearchParams();
    if (ln) params.set("lastName", ln);
    if (first) params.set("name", first);
    // 순우리말·3글자 후보는 카드의 한자(순우리말은 '-' — 한자 없이)를 싣는다. 없으면 /evaluate 가 자동으로 고른다
    if (evaluateHanja) params.set("hanja", evaluateHanja);
    if (query.birthDate) params.set("birthDate", query.birthDate);
    if (query.birthTime) params.set("birthTime", query.birthTime);
    if (query.gender) params.set("gender", query.gender);
    if (query.tone) params.set("tone", query.tone);
    // router.push 대신 풀 페이지 이동 — /evaluate는 정적(○) 라우트라 클라이언트
    // 라우터 캐시가 이전에 방문한 ?name=... 항목을 그대로 내놓아(다른 이름인데
    // 직전 평가 이름이 표시되던 버그) searchParams가 갱신되지 않는 문제를 우회.
    window.location.assign(`/evaluate?${params.toString()}`);
  }

  // ---- form state (Hero에서 query로 들어오면 그 값, 새로 고침이면 세션 저장 값) ----
  const [lastName, setLastName] = useState(seed.form.lastName);
  const [gender, setGender] = useState(seed.form.gender);
  const [birthDate, setBirthDate] = useState(seed.form.birthDate);
  const [birthDateError, setBirthDateError] = useState(false);
  const [birthTime, setBirthTime] = useState(seed.form.birthTime);
  const [tone, setTone] = useState(seed.form.tone);

  // 용신 기반 추천 파라미터 — 마운트 때 읽은 값(주소를 걷은 뒤에도 같은 값)
  const preferredElement = seed.form.preferredElement || undefined;

  // toggles
  const [includePureKorean, setIncludePureKorean] = useState(seed.form.includePureKorean);
  const [includeThreeSyllable, setIncludeThreeSyllable] = useState(seed.form.includeThreeSyllable);
  const [includeCreative, setIncludeCreative] = useState(seed.form.includeCreative);
  const [includeTwin, setIncludeTwin] = useState(seed.form.includeTwin);
  const [includeParentBased, setIncludeParentBased] = useState(seed.form.includeParentBased);
  const [includeDualName, setIncludeDualName] = useState(seed.form.includeDualName);
  const [includeRequiredChar, setIncludeRequiredChar] = useState(seed.form.includeRequiredChar);

  // conditional fields
  const [fatherName, setFatherName] = useState(seed.form.fatherName);
  const [motherName, setMotherName] = useState(seed.form.motherName);
  const [storyKeyword, setStoryKeyword] = useState(seed.form.storyKeyword);
  const [englishName, setEnglishName] = useState(seed.form.englishName);
  const englishNameIssue = englishNameProblem(englishName);
  const [requiredChar, setRequiredChar] = useState(seed.form.requiredChar);
  const [requiredCharPosition, setRequiredCharPosition] = useState(seed.form.requiredCharPosition);
  const [requiredHanja, setRequiredHanja] = useState(seed.form.requiredHanja);
  const [preferredMeaningsInput, setPreferredMeaningsInput] = useState(seed.form.preferredMeanings);

  // '추가 옵션' 펼침 — 그 안의 칸에서 제출이 막히면 펼쳐서 칸으로 옮긴다(Hero 에서 바로 온 값은 접힌 채 막힐 수 있다)
  const [openOptions, setOpenOptions] = useState<string[]>([]);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    // 막 펼친 칸은 포커스만으로는 화면에 들어오지 않았다(11/27 런타임 검증 — 토스트만 보이고 고칠 칸은 화면 아래) → 가운데로 끌어온다
    const el = document.getElementById(id);
    if (!el) return;
    el.focus({ preventScroll: true });
    requestAnimationFrame(() => el.scrollIntoView({ block: "center" }));
    // 접힌 패널을 막 펼친 경우 — 열림 애니메이션(약 200ms)이 끝나면 칸 자리가 바뀌므로 다시 맞춘다.
    // 지우개(cleanup)를 두지 않는다 — 이 효과는 렌더마다 돌아 다음 렌더(토스트 등)가 곧바로 타이머를 지운다. 칸이 사라졌으면 아무 일도 없다
    window.setTimeout(() => {
      if (el.isConnected) el.scrollIntoView({ block: "center" });
    }, 280);
  });
  function focusField(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      return;
    }
    // 접힌 '추가 옵션' 안의 칸 — 펼쳐 그린 다음에 옮긴다
    pendingFocus.current = id;
    setOpenOptions([OPTIONS_PANEL]);
  }

  // submission
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<SearchOutcome | null>(seed.outcome);

  // 되살린 결과가 있으면 바깥 화면도 결과 꼴로(그리기 전에 — 헤더·소개가 한 번 비치지 않게)
  useIsoLayoutEffect(() => {
    if (seed.outcome) onResultChange(true);
  }, []);

  function currentForm(): SearchForm {
    return {
      lastName,
      gender,
      birthDate,
      birthTime,
      tone,
      preferredElement: preferredElement ?? "",
      includePureKorean,
      includeThreeSyllable,
      includeCreative,
      includeTwin,
      includeParentBased,
      includeDualName,
      includeRequiredChar,
      fatherName,
      motherName,
      storyKeyword,
      englishName,
      requiredChar,
      requiredCharPosition,
      requiredHanja,
      preferredMeanings: preferredMeaningsInput,
    };
  }

  // 결과 상태와 바깥 화면 전환을 한 번에 바꾼다 (같은 렌더에 묶여 깜빡임 없음)
  function showResult(next: SearchOutcome | null) {
    setOutcome(next);
    onResultChange(next !== null);
  }

  function handleReset() {
    showResult(null);
    // 새로 고침해도 폼으로 돌아오게 — 저장해 둔 결과는 지우고 폼 값은 남긴다
    if (entryToken.current) writeRestorable(entryToken.current, currentForm(), null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function runRecommend() {
    if (loading) return;

    // 성씨 — 다듬은 값(NFC·앞뒤 공백)을 보내고, 한글 1~2자가 아니면 막는다(search-surname-unvalidated —
    // '金'·'ㅅ'·'K' 가 '희귀 성씨' 배너와 특이 성씨 탭을 받았다). 실제 성씨인지는 보지 않는다(희귀 성씨도 받는다)
    const ln = cleanNameInput(lastName);
    const surnameProblem = nameInputProblem(ln, SURNAME_MAX_LENGTH);
    if (surnameProblem) {
      toast.error(
        surnameProblem === "empty"
          ? "성씨를 입력해주세요."
          : nameInputMessage(surnameProblem, "성씨", SURNAME_MAX_LENGTH)
      );
      focusField("lastName");
      return;
    }

    if (!birthDate) {
      setBirthDateError(true);
      toast.error("생년월일을 입력해주세요.");
      focusField("birthDate");
      return;
    }

    if (includeDualName && englishNameIssue) {
      toast.error(englishNameIssue);
      focusField("englishName");
      return;
    }

    // 스토리 키워드 — 부모 기반 탭을 켜는 값이다(백엔드 HasParentInfo). 한글이 없으면(tree·123·ㅋㅋ) 후보를 못 만드니 먼저 막는다
    const story = includeParentBased ? storyKeyword.trim() : "";
    if (story && !keywordHasHangul(story)) {
      toast.error(KEYWORD_HANGUL_REQUIRED);
      focusField("storyKeyword");
      return;
    }

    // 필수 글자 · 항렬자 — 글자는 한글 한 글자, 항렬자는 한자 한 글자(호환 한자는 통합 한자로)
    const reqChar = includeRequiredChar ? cleanNameInput(requiredChar) : "";
    const reqHanjaText = includeRequiredChar ? requiredHanja.trim() : "";
    const reqHanja = reqHanjaText ? firstHanCodePoint(reqHanjaText) : null;
    if (reqChar && !(reqChar.length === 1 && isHangulSyllables(reqChar))) {
      toast.error("필수 글자는 한글 한 글자로 입력해주세요.");
      focusField("requiredChar");
      return;
    }
    if (reqHanjaText && !reqHanja) {
      toast.error("항렬자 칸에는 한자 한 글자를 입력해주세요.");
      focusField("requiredHanja");
      return;
    }

    setLoading(true);
    try {
      // 두 칸을 다 넣었으면 항렬자가 그 글자로 읽히는지 — 음절별 후보 파일(public/data/hanja-pick/v1, 독음과 두음 꼴 포함 — 林 은 '임'·'림')에
      // 그 한자가 있어야 한다(search-required-char-hanja-mismatch — '준' + 民 이 '김유준 · 있을 유 + 백성 민' 50개를 냈다).
      // 파일을 못 받으면(연결 실패) 막지 않는다 — 서버가 다시 본다
      if (reqChar && reqHanja) {
        const facts = await requestPickFile(reqChar);
        if (facts && !facts.some((f) => f.character === reqHanja)) {
          toast.error(requiredHanjaMismatchMessage(reqHanja, reqChar));
          focusField("requiredChar");
          return;
        }
      }

      // 필드명은 백엔드 SmartRecommendationRequestDto 그대로 — 없는 필드는 조용히 무시된다
      // (includeTwin·englishName으로 보내 쌍둥이·영어 겸용 토글이 아무 효과 없던 전력).
      // 부모 이름·스토리 키워드·영어 이름·필수 글자는 켜기 플래그가 없고 값이 있으면 카테고리가 붙으므로
      // 토글이 꺼져 있으면 값을 보내지 않는 것으로 끈다.
      // 부모 이름 칸은 성 포함 전체 이름('김철수') — 성과 이름으로 나눠 FatherSurname·FatherName 등으로 보낸다(2026-10-28).
      // 옛 요청은 칸 값을 이름으로만 보내 부모 탭에 성 글자가 섞인 이름('수민김')이 나왔다
      const father = includeParentBased ? splitParentName(fatherName) : { surname: "", name: "" };
      const mother = includeParentBased ? splitParentName(motherName) : { surname: "", name: "" };
      const req: SmartRecommendationRequest = {
        lastName: ln,
        // 백엔드가 소문자로 비교하므로 그대로 전달 (대문자로 변환 시 gender/tone 보너스 누락)
        gender: gender === "none" ? undefined : gender,
        birthDate: birthDate || undefined,
        birthTime: birthTime || undefined,
        preferredFiveElement: preferredElement,
        tone: tone,
        includePureKorean,
        includeThreeSyllable,
        includeCreative,
        isTwin: includeTwin,
        fatherSurname: father.name && father.surname ? father.surname : undefined,
        fatherName: father.name || undefined,
        motherSurname: mother.name && mother.surname ? mother.surname : undefined,
        motherName: mother.name || undefined,
        storyKeyword: story || undefined,
        preferredEnglishName:
          includeDualName && englishName.trim() ? englishName.trim() : undefined,
        requiredChar: reqChar || undefined,
        requiredCharPosition:
          includeRequiredChar && requiredCharPosition !== "any"
            ? requiredCharPosition
            : undefined,
        requiredHanja: reqHanja || undefined,
        preferredMeanings: (() => {
          const parsed = preferredMeaningsInput
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          return parsed.length > 0 ? parsed : undefined;
        })(),
      };
      const query: SubmittedQuery = {
        lastName: ln,
        birthDate,
        birthTime,
        gender,
        tone,
        includePureKorean,
        includeCreative,
      };

      // 요청을 시작한 뒤 주소에서 쿼리를 걷는다 — 새로 고침·뒤로 가기는 이 표로 세션 저장에서 되살린다
      const form = currentForm();
      const token = newRestoreToken();
      entryToken.current = token;
      writeRestorable(token, form, null);
      markEntryAndStripQuery(token);

      showResult(null);
      const data = await smart(req);
      const next: SearchOutcome = { data, query };
      showResult(next);
      if (entryToken.current === token) writeRestorable(token, form, next);
      if (data.categories.length === 0) {
        toast.info("조건에 맞는 이름을 찾지 못했습니다.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "요청 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runRecommend();
  }

  // Hero에서 autoStart=1 + lastName 들어오면 자동 추천 (한 번만 — 요청을 시작하면 주소에서 autoStart 를 걷는다)
  useEffect(() => {
    if (autoStart && lastName.trim() && !outcome && !loading) {
      void runRecommend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // 결과 있으면 SmartResultPage 풀 페이지로 전환
  if (outcome) {
    const { data: result, query } = outcome;
    if (result.categories.length === 0) {
      return (
        <div className="mx-auto w-full max-w-2xl px-4 py-8">
          <EmptyState />
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={handleReset}>
              조건 바꿔서 다시 추천받기
            </Button>
          </div>
        </div>
      );
    }
    const requestSummary: RequestSummary = {
      lastName: result.lastName || query.lastName,
      date: query.birthDate || undefined,
      gender:
        query.gender === "male" ? "남" : query.gender === "female" ? "여" : "성별 무관",
      tone:
        query.tone === "soft"
          ? "소프트 톤"
          : query.tone === "strong"
            ? "강한 톤"
            : "중립 톤",
      hanja: true,
      pureKorean: query.includePureKorean,
      creative: query.includeCreative,
    };
    return (
      <SmartResultPage
        data={result}
        requestSummary={requestSummary}
        onRegenerate={handleReset}
        onCandidateDetail={(fullName, evaluateHanja) =>
          handleCandidateDetail(query, fullName, evaluateHanja)
        }
        favoriteContext={{
          birthDate: query.birthDate,
          birthTime: query.birthTime,
          gender: query.gender,
          tone: query.tone,
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4">
      {/* 용신 적용 중 배너 */}
      {preferredElement && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-teal/30 bg-teal-50 px-4 py-3 text-sm text-teal-700">
          <span className="text-lg text-teal">✦</span>
          <div>
            <span className="font-semibold">
              용신 {preferredElement}(
              {["木", "火", "土", "金", "水"].includes(preferredElement)
                ? { 木: "목", 火: "화", 土: "토", 金: "금", 水: "수" }[preferredElement]
                : preferredElement}
              ) 적용 중
            </span>
            <span className="ml-2 text-teal">
              — 해당 오행 한자를 포함한 이름이 상위에 표시돼요.
            </span>
          </div>
        </div>
      )}

      {/* ===== Form ===== */}
      <form onSubmit={handleSubmit} className="sumi-form space-y-6">
        {/* 기본 정보 */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">기본 정보</legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 성씨 */}
            <div className="space-y-1.5">
              <Label htmlFor="lastName">성씨</Label>
              <Input
                id="lastName"
                placeholder="예: 김"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            {/* 성별 — 라벨은 htmlFor ↔ SelectTrigger id(Base UI 트리거는 button 이라 라벨이 이름이 된다 — labels-search) */}
            <div className="space-y-1.5">
              <Label htmlFor="gender">성별</Label>
              <Select value={gender} onValueChange={(v) => setGender(v ?? "none")}>
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">무관</SelectItem>
                  <SelectItem value="male">남</SelectItem>
                  <SelectItem value="female">여</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 생년월일 — 백엔드 필수(사주 조화 산정), 누락 시 400이라 제출 전 검증 */}
            <div className="space-y-1.5">
              <Label htmlFor="birthDate">
                생년월일 <span className="text-muted-foreground text-xs">(필수 · 조화 점수 반영)</span>
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => {
                  setBirthDate(e.target.value);
                  if (e.target.value) setBirthDateError(false);
                }}
                required
                aria-invalid={birthDateError || undefined}
                className={cn(birthDateError && "border-destructive focus-visible:ring-destructive")}
              />
              {birthDateError && (
                <p className="text-xs text-amber-warm-700" role="alert">
                  생년월일을 입력해주세요. 조화 점수 계산에 필요해요.
                </p>
              )}
            </div>

            {/* 출생 시각 */}
            <div className="space-y-1.5">
              <Label htmlFor="birthTime">
                출생 시각 <span className="text-muted-foreground text-xs">(선택 · 시주 반영)</span>
              </Label>
              <Input
                id="birthTime"
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
            </div>

            {/* 톤 */}
            <div className="space-y-1.5">
              <Label htmlFor="tone">톤</Label>
              <Select value={tone} onValueChange={(v) => setTone(v ?? "neutral")}>
                <SelectTrigger id="tone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neutral">중립</SelectItem>
                  <SelectItem value="soft">부드러움</SelectItem>
                  <SelectItem value="strong">강함</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </fieldset>

        {/* 추가 옵션 — Accordion으로 접기 */}
        <Accordion value={openOptions} onValueChange={(v) => setOpenOptions(v as string[])}>
          <AccordionItem value={OPTIONS_PANEL} className="border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold py-3">
              추가 옵션
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pb-2">
                <ToggleRow
                  id="includePureKorean"
                  label="순우리말 포함"
                  checked={includePureKorean}
                  onCheckedChange={setIncludePureKorean}
                />
                <ToggleRow
                  id="includeThreeSyllable"
                  label="3글자 이름 포함"
                  checked={includeThreeSyllable}
                  onCheckedChange={setIncludeThreeSyllable}
                />
                <ToggleRow
                  id="includeCreative"
                  label="창의적 작명 포함"
                  checked={includeCreative}
                  onCheckedChange={setIncludeCreative}
                />
                <ToggleRow
                  id="includeTwin"
                  label="쌍둥이"
                  checked={includeTwin}
                  onCheckedChange={setIncludeTwin}
                />

                {/* 부모 이름 · 스토리 키워드 활용 */}
                <ToggleRow
                  id="includeParentBased"
                  label="부모 이름·키워드 활용"
                  checked={includeParentBased}
                  onCheckedChange={setIncludeParentBased}
                />
                {includeParentBased && (
                  <div className="grid grid-cols-1 gap-3 pl-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fatherName">아버지 이름</Label>
                      <Input
                        id="fatherName"
                        placeholder="예: 김철수"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="motherName">어머니 이름</Label>
                      <Input
                        id="motherName"
                        placeholder="예: 이영희"
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                      />
                    </div>
                    {/* 칸 값은 성 포함 전체 이름 — lib/name-split.ts splitParentName 이 성과 이름을 나눈다(붙여 쓴 2자는 이름만으로 읽는다) */}
                    <p className="text-[11px] text-muted-foreground sm:col-span-2">
                      성까지 넣어 주세요. 외자 이름은 &lsquo;김 철&rsquo;처럼 띄어 써요.
                    </p>
                    {/* 스토리 키워드 — 홈 Hero 의 같은 칸이 ?story= 로 넘긴다. 부모 이름 없이 키워드만 있어도 백엔드가 부모 기반 탭을 붙인다(HasParentInfo) */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="storyKeyword">
                        스토리 키워드 <span className="text-muted-foreground text-xs">(선택)</span>
                      </Label>
                      <Input
                        id="storyKeyword"
                        placeholder="예: 사랑, 희망, 빛"
                        value={storyKeyword}
                        onChange={(e) => setStoryKeyword(e.target.value)}
                        maxLength={STORY_KEYWORD_MAX}
                        autoComplete="off"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        아이 이야기를 떠올리게 하는 한글 낱말 한두 개를 적어 주세요. 부모 이름 없이 키워드만 넣어도 돼요.
                      </p>
                    </div>
                  </div>
                )}

                {/* 영어 이름 겸용 */}
                <ToggleRow
                  id="includeDualName"
                  label="영어 이름 겸용"
                  checked={includeDualName}
                  onCheckedChange={setIncludeDualName}
                />
                {includeDualName && (
                  <div className="space-y-1.5 pl-4">
                    <Label htmlFor="englishName">영어 이름</Label>
                    <Input
                      id="englishName"
                      placeholder="예: Daniel"
                      value={englishName}
                      onChange={(e) => setEnglishName(e.target.value)}
                      maxLength={ENGLISH_NAME_MAX}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={englishNameIssue ? true : undefined}
                      aria-describedby={
                        englishNameIssue ? "englishName-error" : undefined
                      }
                      className={cn(
                        englishNameIssue &&
                          "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    {englishNameIssue && (
                      <p
                        id="englishName-error"
                        className="text-xs text-amber-warm-700"
                        role="alert"
                      >
                        {englishNameIssue}
                      </p>
                    )}
                  </div>
                )}

                {/* 필수 글자 */}
                <ToggleRow
                  id="includeRequiredChar"
                  label="필수 글자"
                  checked={includeRequiredChar}
                  onCheckedChange={setIncludeRequiredChar}
                />
                {includeRequiredChar && (
                  <div className="space-y-3 pl-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="requiredChar">글자</Label>
                        <Input
                          id="requiredChar"
                          placeholder="예: 준"
                          value={requiredChar}
                          onChange={(e) => setRequiredChar(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="requiredCharPosition">위치</Label>
                        <Select
                          value={requiredCharPosition}
                          onValueChange={(v) => setRequiredCharPosition(v ?? "any")}
                        >
                          <SelectTrigger id="requiredCharPosition" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">상관없음</SelectItem>
                            <SelectItem value="first">첫 번째</SelectItem>
                            <SelectItem value="last">마지막</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="requiredHanja">항렬자 (선택, 한자)</Label>
                      <Input
                        id="requiredHanja"
                        placeholder="예: 俊"
                        value={requiredHanja}
                        onChange={(e) => setRequiredHanja(e.target.value)}
                        maxLength={1}
                      />
                      <p className="text-xs text-muted-foreground">
                        형제자매가 함께 쓰는 한자를 넣으면 그 한자만 써서 이름을
                        만들어요. 한자를 비우면 글자 칸의 한글로 찾아요. 두 칸을 다
                        넣으면 항렬자의 음이 글자와 같아야 해요.
                      </p>
                    </div>
                  </div>
                )}

                {/* 의미 선호 키워드 — 한자 의미·카테고리와 매칭되면 가점 */}
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="preferredMeanings">담고 싶은 의미</Label>
                  <Input
                    id="preferredMeanings"
                    placeholder="예: 지혜, 용기, 맑음"
                    value={preferredMeaningsInput}
                    onChange={(e) => setPreferredMeaningsInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    콤마(,) 또는 공백으로 여러 개 입력. 한자의 뜻이나 카테고리와 매칭되면
                    가산점이 부여돼요.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />

        {/* 제출 — 수묵화 톤: 풀폭 + 명조 + 朱印 名 도장 */}
        <div style={{ position: "relative" }}>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
            style={{
              borderRadius: 0,
              padding: "18px",
              height: "auto",
              fontFamily: "var(--font-serif)",
              fontWeight: 700,
              letterSpacing: "0.1em",
              fontSize: 15,
            }}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "추천 생성 중..." : "이름 추천받기"}
          </Button>
          {/* 朱印 名 도장 — 로딩 중에는 숨김 (시각적 노이즈 방지) */}
          {!loading && (
            <span className="sumi-stamp-name" aria-hidden>名</span>
          )}
        </div>
      </form>
    </div>
  );
}

/** 폼이 클라이언트에서 그려지기 전 자리 — 아래 소개·푸터가 밀려 내려오지 않게 높이만 잡는다 */
function FormFallback() {
  return <div aria-hidden className="mx-auto min-h-[27rem] w-full max-w-2xl px-4" />;
}

/** 정적 HTML에 그대로 나가는 도구 소개 — 무엇을 어떻게 보는지 (과장·단정 금지) */
function SearchIntro() {
  return (
    <section
      aria-labelledby="search-intro"
      className="mx-auto w-full max-w-2xl px-4 pb-8"
    >
      <div className="mt-12 space-y-3 border-t pt-8 text-sm leading-relaxed text-muted-foreground">
        <h2 id="search-intro" className="text-base font-semibold text-foreground">
          이름 추천은 이렇게 골라요
        </h2>
        <p>
          성씨와 생년월일을 넣으면 한자 이름·순우리말·3글자·창의적 작명 후보를
          탭으로 나눠 한 번에 보여드려요. 한자 이름은 성씨와 이어 부를 때의 발음과
          리듬, 어느 세대에도 어색하지 않은지, 한자의 뜻을 보는 미학 점수로 먼저
          고르고, 출생 정보로 계산한 오행 조화 점수는 보조로 더해요(종합 = 미학
          70% + 조화 30%).
        </p>
        <p>
          사주는 이름을 만드는 출발점이 아니라, 미학으로 고른 후보의 순서와 한자
          선택을 보정하는 보조 기준이에요. 추가 옵션에서 부모 이름, 영어 이름, 쌍둥이, 항렬자, 담고 싶은 뜻을
          지정할 수 있어요.
        </p>
        <p>
          점수는 후보를 비교하기 위한 참고값이에요. 마음에 드는 이름은 소리 내어
          불러 보고{" "}
          <Link href="/evaluate" className="text-foreground underline underline-offset-4">
            이름 평가
          </Link>
          에서 근거를 확인해 보세요. 점수 계산 방식은{" "}
          <Link href="/method" className="text-foreground underline underline-offset-4">
            작명 원리
          </Link>
          에 정리해 두었어요.
        </p>
      </div>
    </section>
  );
}

export default function BabyNamingPage() {
  const [showingResult, setShowingResult] = useState(false);

  // ---- hero subline rotation ----
  const [subIndex, setSubIndex] = useState(0);
  const [subVisible, setSubVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setSubVisible(false);
      setTimeout(() => {
        setSubIndex((i) => (i + 1) % HERO_SUBLINES.length);
        setSubVisible(true);
      }, 500);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {!showingResult && (
        <>
          <Header current="search" />
          <div className="mx-auto w-full max-w-2xl px-4 pt-8">
            {/* Hero */}
            <header className="mb-12 space-y-4 text-center">
              <p className="eyebrow">NAMING · 이름 찾기</p>
              <h1
                className="text-3xl md:text-4xl font-bold leading-snug tracking-tight"
                style={{
                  fontFamily: "var(--font-serif)",
                  color: "var(--color-text)",
                }}
              >
                당신이라는 고유한 흐름이
                <br />
                아름다운 문장이 되도록.
              </h1>
              <p
                className={cn(
                  "mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground transition-opacity duration-500",
                  subVisible ? "opacity-100" : "opacity-0"
                )}
              >
                {HERO_SUBLINES[subIndex]}
              </p>
            </header>
          </div>
        </>
      )}
      {/* useSearchParams는 정적 렌더링 시 Suspense 경계가 필요 — 폼만 감싸서
          헤더·제목·소개·푸터는 정적 HTML에 그대로 나가게 한다 */}
      <Suspense fallback={<FormFallback />}>
        <BabyNamingInner onResultChange={setShowingResult} />
      </Suspense>
      {!showingResult && (
        <>
          <SearchIntro />
          <Footer />
        </>
      )}
    </>
  );
}

// ---- helper ----
/**
 * 켜고 끄는 줄 — 라벨 htmlFor ↔ Switch id. Base UI Switch 는 id 를 숨은 checkbox 에 달아, 라벨을 눌러도 켜고 끌 수 있고
 * 스위치(role=switch)는 그 라벨을 이름으로 읽는다(labels-search — 옛 줄은 라벨이 어디에도 이어지지 않아 cursor-pointer 만 있었다)
 */
function ToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="cursor-pointer">{label}</Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(val) => onCheckedChange(val)}
      />
    </div>
  );
}
