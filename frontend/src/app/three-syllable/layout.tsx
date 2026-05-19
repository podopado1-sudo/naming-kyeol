import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "3글자 이름",
  description:
    "3음절 이름 큐레이션 사전 139개에서 성씨와의 리듬·발음 조화를 기반으로 추천. 한자·순우리말·혼합형 골고루.",
  alternates: { canonical: "/three-syllable" },
  openGraph: {
    title: "3글자 이름 — 이름의 결",
    description: "139개 큐레이션 3음절 이름에서 성씨 조화 기반 추천",
    url: "/three-syllable",
  },
};

export default function ThreeSyllableLayout({ children }: { children: React.ReactNode }) {
  return children;
}
