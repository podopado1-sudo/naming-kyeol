import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이름 평가",
  description:
    "이미 정한 이름을 입력하면 발음·리듬·세대중립·오행·자원오행·수리사격을 모두 평가합니다. AI 서술형이 아닌 수치 기반 리포트로.",
  alternates: { canonical: "/evaluate" },
  openGraph: {
    title: "이름 평가 — 이름의 결",
    description: "정한 이름의 발음·사주 조화·수리사격을 수치로 분석하는 리포트",
    url: "/evaluate",
  },
};

export default function EvaluateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
