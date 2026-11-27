import type { Metadata } from "next";

/**
 * Open Graph 공통 필드 — 페이지·레이아웃의 metadata.openGraph 에 펼쳐 넣는다.
 *
 * 왜 있나(2026-10-21, 감사 AS-9): Next 메타데이터는 세그먼트 사이를 **얕게** 병합한다.
 * 하위 세그먼트가 openGraph 를 정의하는 순간 루트 layout 의 openGraph(이미지·siteName·locale·type)가
 * 통째로 사라져, 리포트·사전·도구 페이지 대부분에서 og:image·og:site_name·og:locale 이 빠졌다
 * (카카오톡·네이버 블로그 미리보기 이미지 없음). 루트 app/opengraph-image 파일 규약도 해결이 안 된다 —
 * 파일 기반 이미지는 그 파일이 놓인 세그먼트에서만 주입되고, 하위 페이지가 openGraph 를 쓰면 다시 덮인다
 * (node_modules/next/dist/lib/metadata/resolve-metadata.js mergeMetadata·mergeStaticMetadata).
 *
 * - OG_SITE: 이미지를 뺀 공통 필드. 세그먼트에 opengraph-image.tsx 가 있는 /name/[이름]은 이것만 펼친다
 *   (openGraph 에 images 키가 있으면 파일 기반 이름별 공유 카드가 주입되지 않는다).
 * - BASE_OPEN_GRAPH: 공통 필드 + 기본 공유 이미지(/og-image.png). 그 밖의 페이지는 이것을 펼친다.
 *   `openGraph: { ...BASE_OPEN_GRAPH, title, description, url }` — 리포트처럼 type 이 다르면 뒤에서 덮어쓴다.
 * - twitter:title·description 은 쪽마다 따로 적지 않는다 — 루트 layout 의 twitter 는 card·images 만 두고, Next 가 이 쪽의
 *   openGraph 제목·설명으로 채운다(resolve-metadata.js postProcessMetadata, 2026-11-27 twitter-meta-generic).
 */

type OpenGraph = NonNullable<Metadata["openGraph"]>;

export const OG_SITE_NAME = "이름의 결";

export const OG_SITE = {
  type: "website" as const,
  locale: "ko_KR",
  siteName: OG_SITE_NAME,
};

// 크기는 public/og-image.png 의 실제 크기다(Hero 그림과 같은 파일 — 1a7854b). 첫 1200×630 그림 때 적은 값이 남아 있었다
// (2026-11-27 og-image-size-mismatch). 그림을 바꾸면 이 값도 같이 — tests/fix1127-site-chrome.test.mjs 가 PNG 머리와 맞춘다.
export const OG_DEFAULT_IMAGES: NonNullable<OpenGraph["images"]> = [
  {
    url: "/og-image.png",
    width: 1672,
    height: 941,
    alt: `${OG_SITE_NAME} — 한국어 이름 추천 서비스`,
  },
];

export const BASE_OPEN_GRAPH = {
  ...OG_SITE,
  images: OG_DEFAULT_IMAGES,
};
