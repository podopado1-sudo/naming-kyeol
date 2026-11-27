// 애드센스 로더 + 사이트 확인 메타 — 편집·허브 화면(lib/ad-scope.ts AD_EXACT_PATHS·AD_PREFIX_PATHS)에만 싣는다.
//
// ⚠️ 2026-11-27: 전에는 루트 레이아웃 <head> 에 실어 모든 화면에서 떴다. 그래서 입력값을 주소 쿼리에 두는 도구 화면
// (/evaluate?lastName=…&name=…&birthDate=… 등)을 새로 열면 광고 요청(googleads.g.doubleclick.net/pagead/ads 의 url 값)에
// 성·이름·생년월일이 든 주소가 통째로 실려 Google 로 갔다(2026-11-26 운영에서 확인 — 심사 중이라 광고가 보이지 않을 때도 나간다).
// 싣는 범위는 11/23 애드센스 진단 권고 1(사용자 결정 — 편집·허브 쪽만, 같은 틀 자동 쪽·도구·404 제외)을 그대로 따른다.
// 이 화면에서 다른 화면으로 클라이언트 이동하면 components/AdsenseNavigationGuard.tsx 가 새 문서로 다시 연다(로더가 따라가지 않게).
//
// 로더는 next/script 가 아니라 정적 <script async> 로 싣는다 — 애드센스 안내와 같고, JS 를 실행하지 않는 검증 크롤러도
// 페이지 소스에서 스니펫을 찾을 수 있다. React 19 가 async 스크립트와 <meta> 를 <head> 로 끌어올리고 중복을 없앤다.
// 싣는 곳은 tests/adsense-placement.test.mjs 가 lib/ad-scope.ts 와 대조해 고정한다.

/** 애드센스 게시자 ID (예: ca-pub-1234…). Vercel 환경변수로 주입 — 미설정이면 아무것도 그리지 않는다(빌드 타임 주입) */
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export function AdsenseLoader() {
  if (!ADSENSE_CLIENT) return null;
  return (
    <>
      <meta name="google-adsense-account" content={ADSENSE_CLIENT} />
      <script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        crossOrigin="anonymous"
      />
    </>
  );
}
