import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이름 분석",
  description:
    "이름과 출생일·시간·출생지를 입력하면 사주 4기둥, 용신(억부+조후), 오행 분포, 음령오행, 강점·약점을 종합 분석합니다.",
  alternates: { canonical: "/analysis" },
  openGraph: {
    title: "이름 분석 — 이름의 결",
    description: "사주 4기둥·용신·오행·음령오행으로 이름을 분석하는 리포트",
    url: "/analysis",
  },
};

export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
