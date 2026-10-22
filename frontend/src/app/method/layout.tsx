import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/og";

export const metadata: Metadata = {
  title: "작명 원리",
  description:
    "이름의 결은 미학 70% + 사주 조화 30%로 점수를 계산합니다. 발음·리듬·세대중립부터 자원오행·발음오행·수리사격까지, 부수로 자원오행을 정하는 기준과 알고리즘을 투명하게 공개합니다.",
  alternates: { canonical: "/method" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "작명 원리 — 이름의 결",
    description:
      "발음·리듬·세대중립·자원오행·발음오행·수리사격으로 한국어 이름을 평가하는 알고리즘과 부수 기준 자원오행 판정법 공개",
    url: "/method",
  },
};

export default function MethodLayout({ children }: { children: React.ReactNode }) {
  return children;
}
