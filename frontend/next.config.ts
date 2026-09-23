import type { NextConfig } from "next";

/**
 * 보안 헤더 — 모든 페이지/자산 응답에 적용.
 *
 * CSP는 정적 사이트 특성상 다음을 허용:
 * - script: self + 'unsafe-inline' (JSON-LD/Next.js 인라인 스크립트 필요)
 * - style: self + 'unsafe-inline' (Tailwind/inline 스타일 + Google Fonts)
 * - img: self + data: + https: (외부 이미지 가능)
 * - connect: self + API_URL (백엔드 호출만 허용)
 * - frame-ancestors: 'none' (다른 사이트 iframe 금지 — clickjacking 방어)
 */
const apiOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
})();

// dev 모드는 React Fast Refresh / Turbopack 디버거가 eval()을 사용 →
// 'unsafe-eval'을 dev에서만 허용. production은 그대로 엄격 유지.
const isDev = process.env.NODE_ENV === "development";
// 애드센스(2026-09-24 점검): 광고 스크립트·iframe·계측 도메인. 9/22 소유권 확인은 head의
// 태그 존재만 보므로 통과했지만, 브라우저는 CSP로 스크립트 실행·광고 iframe을 막아 승인돼도
// 광고가 한 장도 안 뜨는 상태였다. img-src는 이미 https: 전체 허용.
const adsenseScript =
  "https://pagead2.googlesyndication.com https://partner.googleadservices.com https://tpc.googlesyndication.com https://www.googletagservices.com https://adservice.google.com https://fundingchoicesmessages.google.com https://*.adtrafficquality.google";
const adsenseFrame =
  "https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com https://*.adtrafficquality.google";
const adsenseConnect =
  "https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://fundingchoicesmessages.google.com https://*.adtrafficquality.google https://csi.gstatic.com";

const scriptSrc = isDev
  ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${adsenseScript}`
  : `script-src 'self' 'unsafe-inline' ${adsenseScript}`;

const ContentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  `connect-src 'self' ${apiOrigin} ${adsenseConnect}`.replace(/\s+/g, " "),
  `frame-src ${adsenseFrame}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // HSTS — 1년, 서브도메인 포함, preload 가능 (HTTPS 강제)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // 구버전 브라우저용 — CSP가 더 강력하지만 호환성 차원
  { key: "X-XSS-Protection", value: "0" },
];

const nextConfig: NextConfig = {
  // 드립 게이트 기준일 — 빌드 시작 시 1회 계산해 전 워커에 동일 값 주입.
  // (name-seo.ts가 소비. 워커별 재평가 시 KST 자정을 걸친 빌드에서 라우트 간 불일치)
  env: {
    NEXT_BUILD_DATE_KST: new Date(Date.now() + 9 * 3600 * 1000)
      .toISOString()
      .slice(0, 10),
  },
  async redirects() {
    return [
      {
        source: "/baby",
        destination: "/search",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // 모든 경로에 보안 헤더 적용
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  // 응답 헤더에서 X-Powered-By 제거 (서버 정보 누설 방지)
  poweredByHeader: false,
};

export default nextConfig;
