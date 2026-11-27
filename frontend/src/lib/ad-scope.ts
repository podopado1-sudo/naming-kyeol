// 애드센스 로더를 싣는 화면의 단일 정의 — components/AdsenseLoader.tsx(싣는 곳)·components/AdsenseNavigationGuard.tsx(벗어날 때)·
// components/design/Hero.tsx(홈에서 도구로 갈 때)·tests/adsense-placement.test.mjs 가 함께 쓴다.
//
// 범위 = 2026-11-23 애드센스 2차 거절 진단의 권고 1(사용자 결정 '권고안대로' — 원래 4파 12/14 주):
//   편집·허브 쪽만 — 홈, /guide(가이드·데이터 리포트), /method, /about, /name·/hanja 인덱스.
//   같은 틀 자동 쪽(이름 상세·독음·글자 상세), 도구 화면(주소에 이름·생년월일 쿼리), 404 에는 싣지 않는다.
// 2026-11-27 에 당겨 적용했다: 로더가 루트 레이아웃에 있어 도구 화면 주소(성·이름·생년월일)가 광고 요청에 실려 Google 로 갔다
// (2026-11-26 운영 확인). 이 화면들의 주소에는 입력값이 들어가지 않는다.

/** 로더를 싣는 경로 — 정확히 이 경로(또는 /guide 아래)만. 뒤 슬래시는 떼고 비교한다 */
export const AD_EXACT_PATHS: readonly string[] = ["/", "/guide", "/method", "/about", "/name", "/hanja"];

/** 아래 전체를 싣는 경로 — /guide/[slug] 데이터 리포트 */
export const AD_PREFIX_PATHS: readonly string[] = ["/guide/"];

/** 이 경로가 광고 로더를 싣는 화면인가 */
export function isAdPage(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return AD_EXACT_PATHS.includes(p) || AD_PREFIX_PATHS.some((prefix) => p.startsWith(prefix));
}

/** 애드센스 로더 주소의 변하지 않는 부분 — 로더 태그를 찾을 때 쓴다 */
export const ADSENSE_SCRIPT_MARK = "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

/**
 * 이 문서에 우리 광고 로더 태그가 들어온 적이 있는가 — 한 번 돈 스크립트는 클라이언트 이동 뒤에도 문서에 남는다
 * (React 가 <head> 로 끌어올린 태그는 화면을 떠나도 지우지 않는다).
 * ⚠️ window.adsbygoogle 로 판정하지 않는다 — 광고 차단 확장이 모든 쪽에 그 값을 만들어 두는 경우가 있어, 그걸 보면 도구 화면이
 * 새로 읽을 때마다 다시 '로더가 돈 문서'가 되어 끝없이 새로 읽는다. 태그는 AdsenseLoader 만 넣고 새 문서의 도구 화면에는 없다.
 */
export function adScriptLoaded(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(`script[src*="${ADSENSE_SCRIPT_MARK}"]`) !== null;
}

/** 이 빌드에 애드센스 게시자 ID 가 들어 있는가(빌드 타임 주입 — 로컬·미설정이면 false, 이동 규칙도 모두 꺼진다) */
export function adsEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
}

/**
 * 이 이동을 새 문서로 열어야 하는가 — 광고 화면과 광고 밖 화면의 경계를 넘을 때(양쪽 모두).
 *   - 광고 밖으로: 이 문서에 로더가 돌았으면 — 도구 화면이 입력값을 주소에 쓰는 동안 광고 스크립트가 같은 문서에 살아 있지 않게.
 *   - 광고 안으로: 광고 밖 화면에서 연 문서라면(광고를 켠 빌드) — 그 문서에 로더를 들이면 뒤로 가기로 도구 주소(입력값)가
 *     로더가 돈 같은 문서에 돌아온다(검증 지적 — Next 가 popstate 로 도구 화면을 같은 문서에 다시 그려 평가·추천 요청이 두 번 나갔다).
 * 같은 사이트의 경로만(pathname 기준). 지금 경로는 넘기지 않으면 window.location 에서 읽는다.
 */
export function needsFreshDocument(targetPathname: string, currentPathname?: string): boolean {
  const toAd = isAdPage(targetPathname);
  if (!toAd) return adScriptLoaded();
  const current = currentPathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  return adsEnabled() && !isAdPage(current);
}
