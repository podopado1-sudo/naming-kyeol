import type { MetadataRoute } from "next";

/**
 * /robots.txt 자동 생성
 *
 * 정책:
 * - 검색 엔진 봇 (Googlebot, Bingbot, Naverbot/Yeti, Daumoa) → 전체 허용
 * - AI 학습/스크래퍼 봇 → 전체 차단 (콘텐츠 학습 데이터로 쓰이는 것 방지)
 * - 사용자 도구 페이지(/favorites)는 동적이라 인덱싱 제외
 * - sitemap.xml 위치 명시
 *
 * 환경변수 NEXT_PUBLIC_SITE_URL 로 도메인 주입.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

// AI 학습/스크래퍼 봇 차단 목록
// 좋은 봇은 robots.txt를 존중하므로 명시 차단으로 트래픽 절감 + 콘텐츠 보호
const BLOCKED_AI_BOTS = [
  // OpenAI
  "GPTBot",           // ChatGPT 학습용 크롤러
  "ChatGPT-User",     // ChatGPT 브라우징
  "OAI-SearchBot",    // OpenAI 검색
  // Anthropic
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  // Google AI (검색 Googlebot은 별도, 학습용만 차단)
  "Google-Extended",  // Bard/Gemini 학습
  // Meta/Facebook
  "FacebookBot",
  "Meta-ExternalAgent",
  // 기타 학습 봇
  "CCBot",            // Common Crawl (대형 AI 학습 데이터셋)
  "Bytespider",       // TikTok/ByteDance
  "PerplexityBot",
  "Amazonbot",
  "Applebot-Extended",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // 1. 검색 엔진 봇 — 명시적으로 허용 (SEO 인덱싱)
      {
        userAgent: ["Googlebot", "Bingbot", "Naverbot", "Yeti", "Daumoa"],
        allow: "/",
        disallow: ["/favorites", "/api/"],
      },
      // 2. AI 학습/스크래퍼 봇 — 전체 차단
      {
        userAgent: BLOCKED_AI_BOTS,
        disallow: "/",
      },
      // 3. 그 외 모든 봇 — 기본 정책 (사이트 허용, 민감 영역 제외)
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/favorites", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
