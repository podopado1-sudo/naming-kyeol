import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "작명 원리",
  description:
    "이름의 결은 미학 70% + 사주 조화 30%로 점수를 계산합니다. 발음·리듬·세대중립·오행·자원오행·수리사격 5단계 평가까지 — 알고리즘을 투명하게 공개합니다.",
  alternates: { canonical: "/method" },
  openGraph: {
    title: "작명 원리 — 이름의 결",
    description:
      "발음·리듬·세대중립·오행·자원오행·수리사격으로 한국어 이름을 평가하는 알고리즘 공개",
    url: "/method",
  },
};

export default function MethodLayout({ children }: { children: React.ReactNode }) {
  return children;
}
