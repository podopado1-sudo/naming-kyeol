import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "창의적 작명",
  description:
    "성씨의 한자 뜻을 활용해 성+이름이 하나의 문장이 되는 이름. 김(金)+빛나리, 박(朴)+소담 같은 의미 연결형 작명.",
  alternates: { canonical: "/creative" },
  openGraph: {
    title: "창의적 작명 — 이름의 결",
    description: "성씨 의미를 살린 문장형·의미 연결형 이름 추천",
    url: "/creative",
  },
};

export default function CreativeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
