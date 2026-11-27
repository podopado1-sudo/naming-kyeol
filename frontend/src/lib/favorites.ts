"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "nameform:favorites:v1";

/** 저장해 두는 최대 개수 — 넘으면 가장 오래된 것부터 지운다(addFavorite) */
export const FAVORITES_LIMIT = 100;

/**
 * 저장소에 쓰지 못했을 때의 안내 — 사이트 데이터 저장을 막은 브라우저(localStorage 접근 자체가 SecurityError)·저장 공간이 가득 찬 경우.
 * 저장 단추를 둔 화면이 같은 문장으로 알린다(add·remove·toggle 이 false 를 돌려줄 때)
 */
export const FAVORITE_SAVE_FAILED =
  "이 브라우저에서는 저장할 수 없어요. 사이트 데이터 저장이 막혀 있거나 저장 공간이 가득 찼을 수 있어요.";

/** 저장했을 때의 안내 — 상한을 넘겨 가장 오래된 저장분을 지웠으면 그 사실도 적는다 */
export function favoriteSavedNotice(evictedOldest: boolean): string {
  return evictedOldest
    ? `저장됨 — ${FAVORITES_LIMIT}개까지 보관해서 가장 오래된 1개를 지웠어요`
    : "저장됨";
}

export interface FavoriteName {
  fullName: string;       // "허희주"
  lastName: string;       // "허"
  name: string;           // "희주"
  birthDate?: string;     // "1985-06-05"
  birthTime?: string;     // "13:30"
  gender?: string;        // "female"|"male"|"none"
  tone?: string;          // "soft"|"strong"|"neutral"
  finalScore?: number;
  aestheticScore?: number;
  harmonyScore?: number;
  /**
   * 고른 이름 한자(2026-11 한자 입력) — 주소 꼴(통합 한자, 끝의 `*` 생략 — evaluate-params 의 EvalInput.hanja 와 같다).
   * 한자를 고르지 않은 저장분·옛 저장분에는 없다
   */
  hanja?: string;
  /** 고른 성씨 한자 — 주소 꼴. 없으면 기본으로 두는 한자 */
  lastHanja?: string;
  /** ISO 시각 */
  savedAt: string;
}

/** 글이어야 하는 칸(없어도 된다) — 목록 화면이 글로 그리거나 주소·문자열 함수에 넘긴다 */
const TEXT_FIELDS = ["lastName", "name", "birthDate", "birthTime", "gender", "tone", "hanja", "lastHanja"] as const;

/**
 * 저장 항목의 꼴 검사 — 목록 화면(/favorites)이 그대로 그려도 깨지지 않는 항목만 참.
 * fullName 은 비지 않은 글, savedAt 은 글, 나머지 글 칸은 없거나(undefined·null) 글이어야 한다. 점수 칸은 화면이 typeof 로 거르므로 보지 않는다.
 * 옛 꼴({fullName, savedAt} 만 있는 저장분·성·이름 칸이 없는 저장분)은 그대로 통과한다 — 항목을 고쳐 쓰지 않고 거르기만 한다.
 * (fullName 이 없는 항목 하나가 섞이면 /favorites 의 splitFullName 이 undefined.trim 으로 화면 전체를 오류로 만들었다 — 2026-11-27)
 */
export function isFavoriteRecord(value: unknown): value is FavoriteName {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.fullName !== "string" || r.fullName.trim() === "") return false;
  if (typeof r.savedAt !== "string") return false;
  return TEXT_FIELDS.every((k) => r[k] === undefined || r[k] === null || typeof r[k] === "string");
}

function readAll(): FavoriteName[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 꼴이 깨진 항목은 읽을 때 뺀다 — 멀쩡한 저장분은 그대로 보인다(다음에 쓸 때 저장소에서도 빠진다)
    return parsed.filter(isFavoriteRecord);
  } catch {
    return [];
  }
}

/** 저장소에 쓴다 — 쓰지 못하면(저장 차단·용량 초과) false. 그때는 알림 이벤트도 보내지 않는다(화면은 그대로) */
function writeAll(items: FavoriteName[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    return false;
  }
  cachedItems = null;
  // 같은 탭 내 다른 컴포넌트에 알림
  window.dispatchEvent(new CustomEvent("nameform:favorites:changed"));
  return true;
}

/**
 * 저장 키 — 한자를 고르지 않았으면 예전 그대로 `이름|생년월일`, 골랐으면 `이름|생년월일|이름 한자|성씨 한자`.
 * 같은 이름·같은 생년월일이라도 한자 조합이 다르면 따로 저장된다(2026-11 한자 입력 — 설계 §10-2).
 * 키는 저장된 필드에서 그때그때 만들므로 옛 저장분(필드 없음)은 옮길 것 없이 예전 키로 읽힌다.
 */
function makeKey(fullName: string, birthDate?: string, hanja?: string, lastHanja?: string): string {
  const base = `${fullName}|${birthDate ?? ""}`;
  return hanja || lastHanja ? `${base}|${hanja ?? ""}|${lastHanja ?? ""}` : base;
}

/** 저장 항목의 키(위 규칙) — 목록 화면이 React key·'제거' 대상으로 쓴다 */
export function favoriteKey(
  f: Pick<FavoriteName, "fullName" | "birthDate" | "hanja" | "lastHanja">
): string {
  return makeKey(f.fullName, f.birthDate, f.hanja, f.lastHanja);
}

export function isFavorite(
  fullName: string,
  birthDate?: string,
  hanja?: string,
  lastHanja?: string
): boolean {
  const k = makeKey(fullName, birthDate, hanja, lastHanja);
  return readAll().some(f => favoriteKey(f) === k);
}

/** 지금 저장된 개수 — 저장 단추가 '가장 오래된 것을 지웠어요'를 알릴지 미리 본다 */
export function favoriteCount(): number {
  return readAll().length;
}

/**
 * 저장한다. 저장소에 쓰지 못하면 false(이미 저장된 조합이면 할 일이 없어 true).
 * 최대 FAVORITES_LIMIT 개 — 넘으면 가장 오래된 것부터 지운다(알림은 부르는 화면이 favoriteCount 로 미리 보고 한다).
 */
export function addFavorite(fav: Omit<FavoriteName, "savedAt">): boolean {
  const items = readAll();
  const k = favoriteKey(fav);
  if (items.some(f => favoriteKey(f) === k)) return true;
  items.unshift({ ...fav, savedAt: new Date().toISOString() });
  return writeAll(items.slice(0, FAVORITES_LIMIT));
}

/** 그 조합을 지운다. 저장소에 쓰지 못하면 false */
export function removeFavorite(
  fullName: string,
  birthDate?: string,
  hanja?: string,
  lastHanja?: string
): boolean {
  const k = makeKey(fullName, birthDate, hanja, lastHanja);
  return writeAll(readAll().filter(f => favoriteKey(f) !== k));
}

/** 저장돼 있으면 지우고 아니면 저장한다. 저장소에 쓰지 못하면 false — 부르는 화면이 FAVORITE_SAVE_FAILED 로 알린다 */
export function toggleFavorite(fav: Omit<FavoriteName, "savedAt">): boolean {
  if (isFavorite(fav.fullName, fav.birthDate, fav.hanja, fav.lastHanja)) {
    return removeFavorite(fav.fullName, fav.birthDate, fav.hanja, fav.lastHanja);
  }
  return addFavorite(fav);
}

// useSyncExternalStore용 스냅샷 캐시 — 렌더 간 참조 동일성 유지
let cachedItems: FavoriteName[] | null = null;
const EMPTY_ITEMS: FavoriteName[] = [];

function getSnapshot(): FavoriteName[] {
  if (cachedItems === null) cachedItems = readAll();
  return cachedItems;
}

function getServerSnapshot(): FavoriteName[] {
  return EMPTY_ITEMS;
}

function subscribe(onStoreChange: () => void): () => void {
  function refresh() {
    cachedItems = null;
    onStoreChange();
  }
  window.addEventListener("nameform:favorites:changed", refresh);
  window.addEventListener("storage", refresh); // 다른 탭 변경 감지
  return () => {
    window.removeEventListener("nameform:favorites:changed", refresh);
    window.removeEventListener("storage", refresh);
  };
}

/** 컴포넌트에서 사용 — 자동으로 갱신됨. */
export function useFavorites(): FavoriteName[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 단일 이름의 즐겨찾기 상태를 추적하는 훅. 한자를 고른 조합이면 그 한자(주소 꼴)를 함께 준다. */
export function useIsFavorite(
  fullName: string,
  birthDate?: string,
  hanja?: string,
  lastHanja?: string
): boolean {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const k = makeKey(fullName, birthDate, hanja, lastHanja);
  return items.some(f => favoriteKey(f) === k);
}
