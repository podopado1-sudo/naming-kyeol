import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/og";

/**
 * 2026-11 한자 입력(설계 docs/plan-hanja-input-2026-11.md §12-1 · 사용자 결정 U9 (가)): 제목 앞머리 '이름 평가'는 사이트 안 이름(메뉴·링크 문구)과
 * 맞추려고 그대로 두고, 뒤에 이 화면이 새로 하는 일('아기 이름 한자 정하기')을 붙였다. 설명은 '정하기·선택'으로 시작한다.
 * '추천'·'짓는 법'은 쓰지 않는다 — 이 화면은 한자를 추천하지 않는다(제목이 약속하는 것이 첫 화면에 있어야 한다 — 칸 줄 안내·소개 문장,
 * 아래쪽 설명 글 EvaluateHanjaGuide). openGraph 는 얕은 병합이라 BASE_OPEN_GRAPH 를 펼친다(CLAUDE.md).
 */
export const metadata: Metadata = {
  title: "이름 평가 · 아기 이름 한자 정하기",
  description:
    "아기 이름 한자 정하기 — 정한 한글 이름의 음절마다 인명용 한자를 선택해 뜻·자원오행·획수를 비교하고, 발음·리듬을 점수로 봅니다. 출생일을 넣으면 고른 한자로 사주 조화까지 규칙으로 계산한 수치 리포트.",
  alternates: { canonical: "/evaluate" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "이름 평가 · 아기 이름 한자 정하기 — 이름의 결",
    description: "정한 이름의 한자를 직접 선택해 발음과 오행 조화를 수치로 보는 리포트",
    url: "/evaluate",
  },
};

export default function EvaluateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
