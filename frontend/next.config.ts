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

const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  `connect-src 'self' ${apiOrigin}`.trim(),
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
