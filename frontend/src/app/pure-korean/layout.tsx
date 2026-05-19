import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "순우리말 이름",
  description:
    "한자 없이 우리말로 짓는 이름. 가람·다솜·한결·도담 등 326개 큐레이션 사전에서 성씨와의 발음 조화를 기반으로 추천합니다.",
  alternates: { canonical: "/pure-korean" },
  openGraph: {
    title: "순우리말 이름 — 이름의 결",
    description: "326개 큐레이션 사전에서 성씨 발음 조화 기반으로 추천하는 순우리말 이름",
    url: "/pure-korean",
  },
};

export default function PureKoreanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
