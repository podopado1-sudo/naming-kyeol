import type { MetadataRoute } from "next";
import { getAllReadings } from "@/lib/hanja-seo";
import { getCuratedNames, getPublishedDripNames } from "@/lib/name-seo";
import { getAllInsights } from "@/lib/insights";

/**
 * /sitemap.xml 자동 생성
 *
 * 모든 정적 라우트를 우선순위와 함께 노출.
 * - 홈/메서드/가이드: priority 1.0 (랜딩/SEO 핵심)
 * - 추천 도구: priority 0.8 (전환 페이지)
 * - 보조 도구(쌍둥이/이중이름 등): priority 0.6
 * - 운영(소개/문의): priority 0.4
 * - 사용자 데이터 페이지(favorites)는 사이트맵에 넣지 않는다(색인 제외는 favorites/layout.tsx 의 noindex 메타 — 2026-11-27 robots.txt 차단을 걷었다)
 *
 * 환경변수 NEXT_PUBLIC_SITE_URL 로 도메인 주입.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

// 경로 + 우선순위 + 변경 빈도 매핑
const ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  /**
   * 그 화면의 내용이 바뀐 날(YYYY-MM-DD) — 없으면 아래 공통 lastModified. 새 화면·내용이 바뀐 화면만 준다
   * (2026-11 /ohaeng 설계 §7 — '2026-11-25' 는 /ohaeng·순우리말 리포트 배포일(2파), '2026-11-26' 은 /evaluate 한자 입력 배포일(3파))
   */
  lastModified?: string;
}> = [
  // 랜딩/교육 — 최상위
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "method", priority: 0.9, changeFrequency: "monthly", lastModified: "2026-11-25" }, // 자원오행 보완 카드 → /ohaeng 링크
  { path: "guide", priority: 0.9, changeFrequency: "monthly", lastModified: "2026-11-25" }, // 04장 → /ohaeng 링크(D7)·리포트 목록에 순우리말 리포트

  // 핵심 추천 도구
  { path: "search", priority: 0.8, changeFrequency: "monthly" },
  { path: "evaluate", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-11-26" }, // 음절별 한자 칸·설명 글 '아기 이름 한자 정하기'·메타(2026-11 한자 입력 — 3파 배포일)
  { path: "analysis", priority: 0.8, changeFrequency: "monthly" },

  // 보조 추천 도구
  { path: "pure-korean", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-11-27" }, // 순우리말 리포트 링크 · 11/27 설명 숫자·결과 화면
  { path: "creative", priority: 0.7, changeFrequency: "monthly" },
  { path: "three-syllable", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-11-27" }, // 머리말 '성 뒤에 세 글자'(옛 '성씨 포함' — 엔진은 성 + 세 음절)·결과 화면이 처음으로 그려짐
  { path: "required-char", priority: 0.7, changeFrequency: "monthly" },
  { path: "parent-based", priority: 0.7, changeFrequency: "monthly" },
  { path: "twin", priority: 0.6, changeFrequency: "monthly" },
  { path: "dual-name", priority: 0.6, changeFrequency: "monthly" },
  { path: "rare-surname", priority: 0.6, changeFrequency: "monthly" },
  // 부족한 오행 찾기 — 이름 대신 생년월일만 받는 보조 도구(2026-11)
  { path: "ohaeng", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-11-26" }, // 11-25 첫 배포, 11-26 한자 예 설명 문장(3파)

  // 상호 작명 (인명과 별도 벌티컬)
  { path: "company", priority: 0.7, changeFrequency: "monthly" },

  // 운영 페이지
  { path: "about", priority: 0.4, changeFrequency: "yearly" },
  { path: "contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "privacy", priority: 0.3, changeFrequency: "yearly", lastModified: "2026-11-27" }, // 출생지 항목·오행 찾기 입력값(11-25)·이름 평가의 한자 입력(11-26)·광고 스크립트를 싣는 화면(11-27 — 시행일)

  // 한자 사전 인덱스
  { path: "hanja", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-11-26" }, // 인덱스에 이름 평가 한 줄(HanjaEvaluateLine)

  // 이름 뜻 사전 인덱스
  { path: "name", priority: 0.8, changeFrequency: "weekly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // 실제 콘텐츠가 바뀐 날짜로 수동 갱신 — new Date()로 매 빌드 전 URL을 재도장하면
  // 주간 드립 빌드마다 무변경 URL 수천 개의 lastmod가 갱신돼 구글이 lastmod 신호를
  // 도메인 단위로 무시하게 된다. 드립 이름은 아래에서 자기 개방일(pa)을 쓴다.
  const lastModified = new Date("2026-09-03");

  const staticRoutes: MetadataRoute.Sitemap = ROUTES.map((r) => ({
    url: r.path ? `${SITE_URL}/${r.path}` : SITE_URL,
    lastModified: r.lastModified ? new Date(r.lastModified) : lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // 한자 사전 — 독음 페이지만 등재한다(글자 상세는 아래 참조).
  const readingRoutes: MetadataRoute.Sitemap = getAllReadings().map(
    (reading) => ({
      url: `${SITE_URL}/hanja/${encodeURIComponent(reading)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }),
  );

  // 글자 상세 페이지는 사이트맵에서 뺀다 (2026-10-06).
  // 이력: 2026-07-15 2단계로 전체 상세 글자 9,096쪽을 등재했으나(당시 색인 70%·thin 경보 없음),
  // 나흘 뒤 구글 유입 급락 + 2026-10-06 애드센스 "가치가 별로 없는 콘텐츠" 거절. 페이지는
  // 그대로 두고(hanja/[slug] generateMetadata에서 noindex,follow) 검색 축인 독음·이름 페이지만 등재한다.

  // 이름 뜻 페이지 — 단계적 공개 전략:
  // 1차로 대법원 실명 빈도 상위 1,000개만 등재(전부 빈도 80+·자연어 뜻 보유).
  // "○○ 이름 뜻" 검색 수요가 큰 핵심부터 색인 가속하고, 색인율 확인 후 확대한다.
  // (1,001~3,305위 미등재 이름 페이지는 생성은 되며 내부링크로 크롤된다)
  const nameRoutes: MetadataRoute.Sitemap = getCuratedNames(1000).map(
    (name) => ({
      url: `${SITE_URL}/name/${encodeURIComponent(name)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }),
  );

  // 주간 드립 코호트 — 공개된 이름은 전부 등재한다 (개방일 = lastmod).
  // 드립 이름은 전부 rank 3,306 이하라 위 상위 1,000과 겹치지 않고, 인기 최하위
  // 꼬리라 내부링크(첫 음절 형제 top-12)에도 대부분 못 실린다 — 사이트맵이
  // 유일한 크롤 발견 경로다 (미등재 시 코호트 78%가 오펀 페이지, 2026-09-03 리뷰).
  const dripRoutes: MetadataRoute.Sitemap = getPublishedDripNames().map(
    ({ name, publishedAt }) => ({
      url: `${SITE_URL}/name/${encodeURIComponent(name)}`,
      lastModified: new Date(publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }),
  );

  // 데이터 리포트(/guide/[slug]) — 갱신일을 lastmod로.
  const insightRoutes: MetadataRoute.Sitemap = getAllInsights().map((a) => ({
    url: `${SITE_URL}/guide/${a.slug}`,
    lastModified: new Date(a.updated),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...insightRoutes, ...readingRoutes, ...nameRoutes, ...dripRoutes];
}
