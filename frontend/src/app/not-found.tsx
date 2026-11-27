import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/design/SystemStates";
import { BASE_OPEN_GRAPH, OG_SITE_NAME } from "@/lib/og";

const TITLE = "페이지를 찾을 수 없어요";
const DESCRIPTION =
  "찾으시는 페이지가 사라졌거나, 주소가 잘못 입력된 것 같아요. 이름 추천·이름 평가·작명 가이드에서 이어서 둘러보세요.";

// 2026-11-27: metadata 가 없어 루트 layout 의 홈 값(탭 제목 '이름의 결 — Naming.kyeol'·canonical '/'·og:url·og:title·twitter)을
// 그대로 물려받았다 — 탭만 보면 홈과 구분되지 않고, 404 쪽이 홈을 대표 주소로 가리켰다.
// - canonical: null — 홈을 가리키지 않는다(없는 주소에 대표 주소를 두지 않는다)
// - openGraph: 얕은 병합이라 BASE_OPEN_GRAPH 를 펼친다(lib/og.ts). url 은 두지 않는다(홈 og:url 을 물려받지 않게)
// - robots 는 건드리지 않는다 — 404 응답에는 Next 가 noindex 를 넣는다
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: null },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: `${TITLE} — ${OG_SITE_NAME}`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — ${OG_SITE_NAME}`,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function NotFound() {
  return <NotFoundScreen />;
}
