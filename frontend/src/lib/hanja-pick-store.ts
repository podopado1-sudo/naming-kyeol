"use client";

/**
 * 음절별 한자 후보 파일(public/data/hanja-pick/v1)을 받아 두는 곳 — 2026-11 설계 docs/plan-hanja-input-2026-11.md §4-6·§8-1·§8-6.
 *
 * 모듈 안에 한 벌만 둔다(진행 중인 요청은 합친다). 입력 폼의 칸 줄·고르기 패널·`#pick` 띠가 같은 것을 읽는다 —
 * 화면은 `usePickStore()` 로 지금 받아 둔 것을 읽고, 필요한 파일은 `requestPickFile(음절)` 로 부른다.
 *
 * **무엇을 언제 받나(개인정보 — 설계 §10-4).** 음절 파일의 주소에는 그 음절이 들어간다. 그래서 이름을 칠 때는 받지 않는다 —
 * 받는 때는 ⓐ 칸을 열 때 그 음절 ⓑ 들고 온 글자(`#pick`)가 들어갈 음절이 이름에 있을 때 그 음절 ⓒ 주소로 한자가 온 칸의 음절
 * ⓓ `#pick` 도착 때 링크에 적힌 독음 ⓔ 붙여 넣은 글자를 나눠 넣을 자리 ⓕ /search 에서 필수 글자와 항렬자 한자를 함께 넣고 제출할 때
 * 그 필수 글자(독음이 맞는지 본다 — app/search/page.tsx, 2026-11-27)뿐이다. 부르는 쪽이 이 규칙을 지킨다.
 * 색인(index.json)은 이름과 무관한 고정 주소라 폼이 뜰 때 한 번 받는다.
 *
 * 이 모듈은 콘솔·분석 이벤트·브라우저 저장소에 아무것도 남기지 않는다. 받는 주소는 `lib/hanja-pick.ts` 의 두 함수가 만든 것뿐이다.
 */
import { useSyncExternalStore } from "react";

import {
  HANJA_PICK_INDEX,
  parsePickFile,
  parsePickIndex,
  syllableFile,
  type HanjaPickIndex,
} from "./hanja-pick";
import type { HanjaFact } from "./types";

export interface PickStoreSnapshot {
  /** 색인 — 아직 못 받았으면 null */
  index: HanjaPickIndex | null;
  /** 색인을 받지 못했다(연결 실패 등) — 칸 줄은 색인 없이 그린다(모든 칸이 '자동'·열 수 있음) */
  indexFailed: boolean;
  /** 받아 둔 음절 파일. 후보 파일이 없는 음절(인명용 한자 독음이 아님)은 빈 목록이다 */
  files: ReadonlyMap<string, readonly HanjaFact[]>;
  /** 받지 못한 음절 — 다시 부르면 지우고 새로 받는다 */
  failed: ReadonlySet<string>;
}

const EMPTY: PickStoreSnapshot = {
  index: null,
  indexFailed: false,
  files: new Map(),
  failed: new Set(),
};

let snapshot: PickStoreSnapshot = EMPTY;
const listeners = new Set<() => void>();

function publish(next: Partial<PickStoreSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 지금 받아 둔 것 — 기다린 뒤(await) 최신 값을 읽을 때 쓴다. 화면은 usePickStore 로 읽는다 */
export function getPickSnapshot(): PickStoreSnapshot {
  return snapshot;
}

/** 받아 둔 색인·음절 파일(바뀌면 다시 그린다). 서버 렌더와 첫 하이드레이션에서는 비어 있다 */
export function usePickStore(): PickStoreSnapshot {
  return useSyncExternalStore(subscribe, getPickSnapshot, () => EMPTY);
}

let indexRequest: Promise<HanjaPickIndex | null> | null = null;

/** 색인을 받는다(한 번). 실패하면 null — 다시 부르면 다시 받는다 */
export function requestPickIndex(): Promise<HanjaPickIndex | null> {
  if (snapshot.index) return Promise.resolve(snapshot.index);
  if (indexRequest) return indexRequest;
  indexRequest = fetch(HANJA_PICK_INDEX)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("index"))))
    .then((raw: unknown) => {
      const index = parsePickIndex(raw);
      if (!index) throw new Error("index");
      publish({ index, indexFailed: false });
      return index;
    })
    .catch(() => {
      indexRequest = null;
      publish({ indexFailed: true });
      return null;
    });
  return indexRequest;
}

const fileRequests = new Map<string, Promise<readonly HanjaFact[] | null>>();

function storeFile(syllable: string, facts: readonly HanjaFact[]) {
  const files = new Map(snapshot.files).set(syllable, facts);
  if (!snapshot.failed.has(syllable)) {
    publish({ files });
    return;
  }
  const failed = new Set(snapshot.failed);
  failed.delete(syllable);
  publish({ files, failed });
}

function setFailed(syllable: string, isFailed: boolean) {
  if (snapshot.failed.has(syllable) === isFailed) return;
  const failed = new Set(snapshot.failed);
  if (isFailed) failed.add(syllable);
  else failed.delete(syllable);
  publish({ failed });
}

/**
 * 그 음절의 후보 파일을 받는다. 이미 받았으면 그대로, 받는 중이면 그 요청을 함께 기다린다.
 * - 한글 음절 한 글자가 아니면 받지 않는다(null).
 * - 후보 파일이 없는 음절(색인에 없거나 404)은 빈 목록으로 둔다 — '없다'는 것을 안 것이다.
 * - 그 밖의 실패(연결 끊김·깨진 응답)는 null 이고 `failed` 에 남는다. 다시 부르면 새로 받는다.
 */
export function requestPickFile(syllable: string): Promise<readonly HanjaFact[] | null> {
  const loaded = snapshot.files.get(syllable);
  if (loaded) return Promise.resolve(loaded);
  const url = syllableFile(syllable);
  if (!url) return Promise.resolve(null);
  const pending = fileRequests.get(syllable);
  if (pending) return pending;

  if (snapshot.index && !Object.prototype.hasOwnProperty.call(snapshot.index.syllables, syllable)) {
    const none: readonly HanjaFact[] = [];
    storeFile(syllable, none);
    return Promise.resolve(none);
  }

  setFailed(syllable, false);
  const request = fetch(url)
    .then(async (res): Promise<readonly HanjaFact[]> => {
      if (res.status === 404) return [];
      if (!res.ok) throw new Error("file");
      const facts = parsePickFile(await res.json());
      if (!facts) throw new Error("file");
      return facts;
    })
    .then((facts) => {
      fileRequests.delete(syllable);
      storeFile(syllable, facts);
      return facts;
    })
    .catch(() => {
      fileRequests.delete(syllable);
      setFailed(syllable, true);
      return null;
    });
  fileRequests.set(syllable, request);
  return request;
}
