/**
 * 사이트 헤더 메뉴 정의 — Header.tsx 가 쓴다. React 없이 node --test 로 검사하려고 뺐다(tests/header-current.test.mjs).
 *
 * 메뉴는 4개(홈·이름 찾기·작명 가이드·작명 원리)뿐이다. 메뉴에 없는 화면(/company·/evaluate·/analysis·/hanja·/name·/about 등)은
 * "none" — 어떤 메뉴도 켜지 않는다(메뉴 항목은 늘리지 않음). 이름 찾기 형제 도구(/creative·/twin·/dual-name 등)는 "search".
 *
 * 기본값은 "none" 이다. 2026-10-23 운영 검증 BR-2 전까지 기본값이 "home" 이라 current 를 넘기지 않은 화면
 * (/hanja/*·/name/*·/analysis·/twin·/dual-name 등 12개 파일)에서 '홈'이 켜져 있었다. 홈(app/page.tsx)은 current="home" 을 직접 넘긴다.
 */

export type NavKey = "home" | "search" | "guide" | "method";

/** 메뉴에 없는 화면은 "none" */
export type CurrentKey = NavKey | "none";

export const NAV_ITEMS: readonly { key: NavKey; label: string; href: string }[] = [
  { key: "home", label: "홈", href: "/" },
  { key: "search", label: "이름 찾기", href: "/search" },
  { key: "guide", label: "작명 가이드", href: "/guide" },
  { key: "method", label: "작명 원리", href: "/method" },
];

/** Header 의 current 기본값 — current 를 넘기지 않은 화면은 어떤 메뉴도 켜지 않는다 */
export const HEADER_DEFAULT_CURRENT: CurrentKey = "none";
