import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "영어·한자 이중 이름",
  description:
    "영어 이름과 한자 이름을 동시에 사용하는 작명. 발음 매칭과 의미 연결을 모두 고려한 한·영 이중 이름 추천.",
  alternates: { canonical: "/dual-name" },
  openGraph: {
    title: "영어·한자 이중 이름 — 이름의 결",
    description: "영어 이름과 한자 이름을 발음·의미로 연결하는 이중 작명",
    url: "/dual-name",
  },
};

export default function DualNameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
