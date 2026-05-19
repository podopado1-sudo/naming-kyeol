import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "쌍둥이 이름",
  description:
    "쌍둥이/형제자매를 위한 이름 세트. 공유글자·공유의미·공유톤 세 가지 테마로 어울리는 이름 조합을 추천합니다.",
  alternates: { canonical: "/twin" },
  openGraph: {
    title: "쌍둥이 이름 — 이름의 결",
    description: "공유글자·공유의미·공유톤으로 어울리는 쌍둥이/형제자매 이름 세트",
    url: "/twin",
  },
};

export default function TwinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
