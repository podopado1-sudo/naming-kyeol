import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/og";

export const metadata: Metadata = {
  title: "이름 평가",
  description:
    "이미 정한 이름을 입력하면 발음·리듬·세대중립·자원오행·획수 조화·수리사격을 모두 평가합니다. 규칙으로 계산한 수치 리포트로.",
  alternates: { canonical: "/evaluate" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "이름 평가 — 이름의 결",
    description: "정한 이름의 발음·사주 조화·수리사격을 수치로 분석하는 리포트",
    url: "/evaluate",
  },
};

export default function EvaluateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
