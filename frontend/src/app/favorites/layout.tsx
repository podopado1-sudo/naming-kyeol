import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/og";

/**
 * /favorites 메타데이터 — page.tsx가 "use client"라 metadata를 export할 수 없어 레이아웃에 둔다.
 * 이게 없으면 canonical·og:url이 홈(https://namingkyeol.com)으로, 제목이 기본값으로 나온다 (FSC-6).
 * 색인 제외는 robots.ts의 disallow가 맡는다 — 여기서 robots를 건드리지 않는다.
 */
export const metadata: Metadata = {
  title: "저장한 이름",
  description: "이 브라우저에 저장한 이름 목록입니다. 회원가입이나 로그인 없이 쓸 수 있어요.",
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
