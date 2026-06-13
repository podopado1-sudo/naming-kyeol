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

function makeKey(fullName: string, birthDate?: string): string {
  return `${fullName}|${birthDate ?? ""}`;
}

export function isFavorite(fullName: string, birthDate?: string): boolean {
  const k = makeKey(fullName, birthDate);
  return readAll().some(f => makeKey(f.fullName, f.birthDate) === k);
}

export function addFavorite(fav: Omit<FavoriteName, "savedAt">) {
  const items = readAll();
  const k = makeKey(fav.fullName, fav.birthDate);
  if (items.some(f => makeKey(f.fullName, f.birthDate) === k)) return;
  items.unshift({ ...fav, savedAt: new Date().toISOString() });
  // 최대 100개 보관
  writeAll(items.slice(0, 100));
}

export function removeFavorite(fullName: string, birthDate?: string) {
  const k = makeKey(fullName, birthDate);
  writeAll(readAll().filter(f => makeKey(f.fullName, f.birthDate) !== k));
}

export function toggleFavorite(fav: Omit<FavoriteName, "savedAt">) {
  if (isFavorite(fav.fullName, fav.birthDate)) {
    removeFavorite(fav.fullName, fav.birthDate);
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

/** 단일 이름의 즐겨찾기 상태를 추적하는 훅. */
export function useIsFavorite(fullName: string, birthDate?: string): boolean {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const k = makeKey(fullName, birthDate);
  return items.some(f => makeKey(f.fullName, f.birthDate) === k);
}
