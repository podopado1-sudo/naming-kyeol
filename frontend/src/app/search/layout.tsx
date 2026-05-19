import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이름 추천",
  description:
    "성씨와 출생일을 입력하면 한자·순우리말·3음절·항렬자·창의적 작명까지 한 번에 추천받을 수 있어요. 의미 키워드, 부모 이름, 영어 이름 등 옵션도 지원합니다.",
  alternates: { canonical: "/search" },
  openGraph: {
    title: "이름 추천 — 이름의 결",
    description:
      "한자·순우리말·3음절·항렬자·창의적 작명을 한 번에. 발음·사주·의미 키워드 기반 통합 추천.",
    url: "/search",
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
