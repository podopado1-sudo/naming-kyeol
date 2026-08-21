import type { MetadataRoute } from "next";
import { getAllDetailChars, getAllReadings } from "@/lib/hanja-seo";
import { getCuratedNames } from "@/lib/name-seo";

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
  { path: "privacy", priority: 0.3, changeFrequency: "yearly" },

  // 한자 사전 인덱스
  { path: "hanja", priority: 0.8, changeFrequency: "monthly" },

  // 이름 뜻 사전 인덱스
  { path: "name", priority: 0.8, changeFrequency: "weekly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = ROUTES.map((r) => ({
    url: r.path ? `${SITE_URL}/${r.path}` : SITE_URL,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // 한자 사전 — 단계적 공개 전략:
  // 1차로 독음 페이지(767) + 검수 완료(S급) 글자만 등재해 thin-content 판정을 피한다.
  // 색인율 확인 후 scripts/build_hanja_seo_data.py 기준 나머지 글자를 추가 예정.
  // (sitemap 미등재 글자 페이지도 생성은 되며 내부링크로 크롤된다)
  const readingRoutes: MetadataRoute.Sitemap = getAllReadings().map(
    (reading) => ({
      url: `${SITE_URL}/hanja/${encodeURIComponent(reading)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }),
  );

  // 단계적 공개 2단계 (2026-07-15): S급 큐레이션 → 전체 상세 글자.
  // 근거: 서치콘솔 색인 1,790/2,557(약 70%), 발견됨-미색인 0(크롤 예산 여유),
  // 크롤링됨-미색인 115(4.5%)로 thin-content 경보 없음.
  const charRoutes: MetadataRoute.Sitemap = getAllDetailChars().map((char) => ({
    url: `${SITE_URL}/hanja/${encodeURIComponent(char)}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  // 이름 뜻 페이지 — 단계적 공개 전략:
  // 1차로 대법원 실명 빈도 상위 1,000개만 등재(전부 빈도 80+·자연어 뜻 보유).
  // "○○ 이름 뜻" 검색 수요가 큰 핵심부터 색인 가속하고, 색인율 확인 후 확대한다.
  // (미등재 이름 페이지도 생성은 되며 내부링크로 크롤된다)
  const nameRoutes: MetadataRoute.Sitemap = getCuratedNames(1000).map(
    (name) => ({
      url: `${SITE_URL}/name/${encodeURIComponent(name)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }),
  );

  return [...staticRoutes, ...readingRoutes, ...charRoutes, ...nameRoutes];
}
