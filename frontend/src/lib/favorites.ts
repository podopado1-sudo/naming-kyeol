"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "nameform:favorites:v1";

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

function readAll(): FavoriteName[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeAll(items: FavoriteName[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  cachedItems = null;
  // 같은 탭 내 다른 컴포넌트에 알림
  window.dispatchEvent(new CustomEvent("nameform:favorites:changed"));
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

export function addFavorite(fav: Omit<FavoriteName, "savedAt">) {
  const items = readAll();
  const k = favoriteKey(fav);
  if (items.some(f => favoriteKey(f) === k)) return;
  items.unshift({ ...fav, savedAt: new Date().toISOString() });
  // 최대 100개 보관
  writeAll(items.slice(0, 100));
}

export function removeFavorite(
  fullName: string,
  birthDate?: string,
  hanja?: string,
  lastHanja?: string
) {
  const k = makeKey(fullName, birthDate, hanja, lastHanja);
  writeAll(readAll().filter(f => favoriteKey(f) !== k));
}

export function toggleFavorite(fav: Omit<FavoriteName, "savedAt">) {
  if (isFavorite(fav.fullName, fav.birthDate, fav.hanja, fav.lastHanja)) {
    removeFavorite(fav.fullName, fav.birthDate, fav.hanja, fav.lastHanja);
  } else {
    addFavorite(fav);
  }
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
