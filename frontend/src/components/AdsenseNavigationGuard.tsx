"use client";

// 광고 로더가 돈 문서가 광고 밖 화면(도구·이름 상세·글자 상세 …)으로 클라이언트 이동하면 새 문서로 다시 연다.
//
// ⚠️ 2026-11-27: 로더를 편집·허브 화면에만 실어도(components/AdsenseLoader.tsx) 한 번 돈 광고 스크립트는 클라이언트 이동 뒤에도
// 같은 문서에 살아 있다. /guide 에서 푸터 '이름 평가'(next/link)로 /evaluate 에 가 이름·생년월일을 넣으면 그 값이 주소에 쓰이는 동안
// 광고 스크립트가 같은 문서에 있다(검증 지적). 한 문서에 광고 화면과 광고 밖 화면이 함께 쌓이지 않게 세 겹으로 막는다:
//   ① 클릭 가로채기(캡처 단계) — 광고 화면 ↔ 광고 밖 화면 경계를 넘는 같은 사이트 링크는(양쪽 모두) next/link 대신 location.assign.
//      (광고 밖에서 광고 안으로 들어가는 것도 새 문서다 — 같은 문서에 로더를 들이면 뒤로 가기로 도구 주소가 그 문서에 돌아온다)
//   ② 뒤로·앞으로(popstate) — 로더가 돈 문서가 광고 밖 기록으로 돌아가면 Next 보다 먼저 받아 새로 읽는다(도구 화면이 그 문서에서
//      그려지고 평가·추천 요청을 한 번 더 보내지 않게 — 2차 검증에서 한 번의 뒤로 가기에 /evaluate 요청 두 번을 확인).
//   ③ 경로 바뀜 감시(받침) — 그래도 광고 밖 화면에 오면 그 자리에서 새로 읽는다(같은 주소는 연달아 한 번만).
// 광고를 켜지 않은 빌드(로컬·심사 코드 미설정)에서는 아무 일도 하지 않는다.
import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { adScriptLoaded, isAdPage, needsFreshDocument } from "@/lib/ad-scope";

/** 방금 새로 읽은 주소 — 같은 주소를 연달아 새로 읽지 않게(sessionStorage) */
const RELOAD_MARK = "nameform:ad-fresh-reload";

// 서버 렌더에서 useLayoutEffect 경고를 피한다(이 컴포넌트는 그리는 것이 없다)
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function AdsenseNavigationGuard() {
  const pathname = usePathname();

  // ① 클릭 가로채기 — next/link 의 클릭 처리보다 먼저(문서 캡처 단계) 본다
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // 같은 화면의 해시 이동은 그대로
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!needsFreshDocument(url.pathname)) return;
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(url.href);
    }
    // ② 뒤로·앞으로 — 이 효과는 Next AppRouter(조상)의 효과보다 먼저 돌아 popstate 리스너도 먼저 걸린다. 먼저 받아 막고 새로 읽는다
    function onPopState(e: PopStateEvent) {
      if (!adScriptLoaded() || isAdPage(window.location.pathname)) return;
      e.stopImmediatePropagation();
      window.location.reload();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // ③ 경로 바뀜 감시 — 클릭이 아닌 클라이언트 이동의 받침. 같은 주소를 연달아 두 번 새로 읽지 않는다(어떤 까닭으로든
  //    새 문서에도 태그가 있으면 끝없이 새로 읽게 되므로 — 세션 저장소가 막혀 있으면 표시 없이 한 번만 시도한다)
  useIsoLayoutEffect(() => {
    if (!pathname || isAdPage(pathname) || !adScriptLoaded()) return;
    const href = window.location.href;
    try {
      if (window.sessionStorage.getItem(RELOAD_MARK) === href) return;
      window.sessionStorage.setItem(RELOAD_MARK, href);
    } catch {
      // 저장소를 못 쓰면 그대로 한 번 새로 읽는다
    }
    window.location.reload();
  }, [pathname]);

  // 새 문서가 광고 밖 화면을 정상으로 열었으면 표시를 지운다(다음 이동에서 다시 새로 읽을 수 있게)
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(RELOAD_MARK) === window.location.href && !adScriptLoaded()) {
        window.sessionStorage.removeItem(RELOAD_MARK);
      }
    } catch {
      // 무시
    }
  }, [pathname]);

  return null;
}
