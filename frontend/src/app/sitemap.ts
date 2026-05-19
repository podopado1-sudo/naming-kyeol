import type { MetadataRoute } from "next";

/**
 * /sitemap.xml 자동 생성
 *
 * 모든 정적 라우트를 우선순위와 함께 노출.
 * - 홈/메서드/가이드: priority 1.0 (랜딩/SEO 핵심)
 * - 추천 도구: priority 0.8 (전환 페이지)
 * - 보조 도구(쌍둥이/이중이름 등): priority 0.6
 * - 운영(소개/문의): priority 0.4
 * - 사용자 데이터 페이지(favorites)는 robots에서 제외, 사이트맵에도 미포함
 *
 * 환경변수 NEXT_PUBLIC_SITE_URL 로 도메인 주입.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

// 경로 + 우선순위 + 변경 빈도 매핑
const ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  // 랜딩/교육 — 최상위
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "method", priority: 0.9, changeFrequency: "monthly" },
  { path: "guide", priority: 0.9, changeFrequency: "monthly" },

  // 핵심 추천 도구
  { path: "search", priority: 0.8, changeFrequency: "monthly" },
  { path: "evaluate", priority: 0.8, changeFrequency: "monthly" },
  { path: "analysis", priority: 0.8, changeFrequency: "monthly" },

  // 보조 추천 도구
  { path: "pure-korean", priority: 0.7, changeFrequency: "monthly" },
  { path: "creative", priority: 0.7, changeFrequency: "monthly" },
  { path: "three-syllable", priority: 0.7, changeFrequency: "monthly" },
  { path: "required-char", priority: 0.7, changeFrequency: "monthly" },
  { path: "parent-based", priority: 0.7, changeFrequency: "monthly" },
  { path: "twin", priority: 0.6, changeFrequency: "monthly" },
  { path: "dual-name", priority: 0.6, changeFrequency: "monthly" },
  { path: "rare-surname", priority: 0.6, changeFrequency: "monthly" },

  // 운영 페이지
  { path: "about", priority: 0.4, changeFrequency: "yearly" },
  { path: "contact", priority: 0.4, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((r) => ({
    url: r.path ? `${SITE_URL}/${r.path}` : SITE_URL,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
