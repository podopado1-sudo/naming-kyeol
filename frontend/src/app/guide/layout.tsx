import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "작명 가이드",
  description:
    "한국어 이름의 네 가지 축, 작명 시기, 다섯 가지 방법, 사주의 역할, 돌림자(항렬자), 흔한 실수까지 — 작명 전 꼭 알아야 할 것을 정리한 7장 가이드.",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "작명 가이드 — 이름의 결",
    description:
      "한국어 이름 짓기 전 알아야 할 7가지: 네 축·시기·방법·사주·돌림자·흔한 실수",
    url: "/guide",
  },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
