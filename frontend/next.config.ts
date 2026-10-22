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

/**
 * 호환 한자 85자 옛 상세 URL → 통합 한자 상세로 301 (2026-10-22 자원오행 전환 S7).
 *
 * S2 에서 호환 한자(金 U+F90A 등 — 대법원 목록이 통합 한자와 따로 실은 같은 글자)를 NFKC 로 통합 한자에 병합해
 * /hanja/<호환 한자> 85쪽이 빌드에서 빠졌다(dynamicParams=false → 404). 네이버에 색인됐던 옛 주소를 같은 글자의
 * 통합 한자 상세로 보낸다. 85쪽 모두 옛 빌드에 상세가 있었고, 85개 도착 글자는 모두 지금 상세가 있다(2026-10-22 실측).
 * 짝 = NFKC 대응(tmp/radical-research/stages/s23/compat_redirects.json 과 같다).
 *
 * - 301 인 이유: permanent(308)보다 오래된 크롤러 지원이 확실한 영구 이동 코드 — 네이버 Yeti 가 주 유입원이다.
 * - source 는 퍼센트 인코딩 꼴과 글자 그대로의 꼴 둘 다 — 라우터가 요청 경로를 어느 꼴로 맞추는지는 실행 환경마다
 *   다를 수 있다(로컬 next start 는 인코딩 꼴, 플랫폼 라우터는 확인 필요). 인코딩 16진은 대소문자를 가리지 않는다
 *   (caseSensitiveRoutes 기본 false).
 * ⚠️ 호환 한자를 소스에 글자로 쓰지 말 것 — 편집 도구·NFC 정규화가 통합 한자로 바꾸면 source 가 destination 과 같아져
 *   무한 리다이렉트가 된다(CLAUDE.md 호환자 회귀). 코드포인트 정수로만 적고 String.fromCodePoint 로 만든다.
 */
const COMPAT_HANJA_TO_UNIFIED: ReadonlyArray<readonly [number, number]> = [
  [0xF907, 0x9F9C], [0xF90A, 0x91D1], [0xF910, 0x863F], [0xF918, 0x843D],
  [0xF91F, 0x862D], [0xF923, 0x85CD], [0xF928, 0x5ECA], [0xF929, 0x6717],
  [0xF935, 0x8606], [0xF936, 0x865C], [0xF93C, 0x797F], [0xF93E, 0x83C9],
  [0xF958, 0x83F1], [0xF96E, 0x8449], [0xF974, 0x82E5], [0xF985, 0x792A],
  [0xF999, 0x84EE], [0xF9B6, 0x79AE], [0xF9C2, 0x84FC], [0xF9F0, 0x85FA],
  [0xF9FE, 0x8336], [0xFA10, 0x585A], [0xFA12, 0x6674], [0xFA15, 0x51DE],
  [0xFA16, 0x732A], [0xFA18, 0x793C], [0xFA19, 0x795E], [0xFA1A, 0x7965],
  [0xFA1B, 0x798F], [0xFA1C, 0x9756], [0xFA1D, 0x7CBE], [0xFA1E, 0x7FBD],
  [0xFA22, 0x8AF8], [0xFA2A, 0x98EF], [0xFA2B, 0x98FC], [0xFA2C, 0x9928],
  [0xFA3A, 0x58A8], [0xFA3B, 0x5C64], [0xFA3E, 0x6168], [0xFA43, 0x6691],
  [0xFA46, 0x6E1A], [0xFA4C, 0x793E], [0xFA4D, 0x7949], [0xFA4E, 0x7948],
  [0xFA4F, 0x7950], [0xFA51, 0x795D], [0xFA52, 0x798D], [0xFA59, 0x7E41],
  [0xFA5A, 0x7F72], [0xFA5F, 0x8457], [0xFA60, 0x8910], [0xFA61, 0x8996],
  [0xFA64, 0x8CD3], [0xFA9B, 0x701E], [0xFAA3, 0x753B], [0xFAA7, 0x76DB],
  [0xFAB1, 0x7F3E], [0xFAB6, 0x8941], [0xFABB, 0x8ACB], [0xFABD, 0x8AFE],
  [0x2F80F, 0x5154], [0x2F818, 0x51A4], [0x2F821, 0x5246], [0x2F833, 0x537F],
  [0x2F852, 0x57CE], [0x2F85E, 0x5922], [0x2F8B2, 0x6210], [0x2F8C9, 0x656C],
  [0x2F901, 0x6D77], [0x2F96C, 0x7D63], [0x2F990, 0x828B], [0x2F991, 0x829D],
  [0x2F993, 0x82B1], [0x2F995, 0x82BD], [0x2F996, 0x82E6], [0x2F999, 0x831D],
  [0x2F99D, 0x83BD], [0x2F9A1, 0x83CA], [0x2F9A2, 0x83CC], [0x2F9A3, 0x83DC],
  [0x2F9A8, 0x84F1], [0x2F9AC, 0x8564], [0x2F9CF, 0x8AA0], [0x2F9EA, 0x927C],
  [0x2F9EB, 0x93F9],
];

function compatHanjaRedirects() {
  return COMPAT_HANJA_TO_UNIFIED.flatMap(([compat, unified]) => {
    const compatChar = String.fromCodePoint(compat);
    // 정규화가 끼어들어 source 와 destination 이 같은 글자가 되면 무한 리다이렉트 — 그런 짝은 내지 않는다
    if (compatChar === String.fromCodePoint(unified)) return [];
    const destination = `/hanja/${encodeURIComponent(String.fromCodePoint(unified))}`;
    return [
      { source: `/hanja/${encodeURIComponent(compatChar)}`, destination, statusCode: 301 as const },
      { source: `/hanja/${compatChar}`, destination, statusCode: 301 as const },
    ];
  });
}

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
      ...compatHanjaRedirects(),
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
