import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "희귀 성씨 이름",
  description:
    "봉·탁·제갈·남궁·황보·선우 같은 희귀 성씨/복성을 위한 발음 최적화 작명. 성씨의 특수성을 고려한 추천.",
  alternates: { canonical: "/rare-surname" },
  openGraph: {
    title: "희귀 성씨 이름 — 이름의 결",
    description: "봉·탁·제갈·남궁·황보 등 희귀 성씨/복성 최적화 작명",
    url: "/rare-surname",
  },
};

export default function RareSurnameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
