import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/og";

export const metadata: Metadata = {
  title: "회사·가게 이름 짓기",
  description:
    "업종과 톤을 고르면 상호 후보를 추천합니다. 한자 조합·순우리말·영문 조어 세 가지 축으로 만들고, 기억성·발음·식별력·업종적합 네 축으로 점수를 매깁니다.",
  alternates: { canonical: "/company" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "회사·가게 이름 짓기 — 이름의 결",
    description:
      "업종별 상호 추천. 업종 일반어와 흔한 말을 피해 식별력을 높인 상호 후보를 고릅니다.",
    url: "/company",
  },
};

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
