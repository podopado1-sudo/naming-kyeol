import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/og";

/**
 * /favorites 메타데이터 — page.tsx가 "use client"라 metadata를 export할 수 없어 레이아웃에 둔다.
 * 이게 없으면 canonical·og:url이 홈(https://namingkyeol.com)으로, 제목이 기본값으로 나온다 (FSC-6).
 *
 * 색인 제외는 여기 robots 메타가 맡는다(2026-11-27 favorites-robots-only). 예전에는 robots.ts 의 disallow 로만 막았는데,
 * disallow 는 수집만 막아 봇이 이 noindex 를 읽지 못하고, 모든 쪽 머리말이 이 화면을 링크하니 '차단되었지만 색인됨'이 될 수 있었다.
 * 그래서 robots.ts 에서 /favorites 를 빼고 수집은 열어 둔 채 noindex 를 건다. 이 브라우저에만 있는 개인 저장 화면이라
 * 네이버에도 색인할 것이 없어 일반 robots 로 끈다(내용 쪽 숨김의 googlebot 전용 noindex 규칙과는 다른 경우).
 * follow 는 그대로 — 머리말·꼬리말 링크는 다른 쪽과 같다.
 */
export const metadata: Metadata = {
  title: "저장한 이름",
  description: "이 브라우저에 저장한 이름 목록입니다. 회원가입이나 로그인 없이 쓸 수 있어요.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/favorites" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "저장한 이름 — 이름의 결",
    description: "이 브라우저에 저장한 이름 목록입니다.",
    url: "/favorites",
  },
};

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
