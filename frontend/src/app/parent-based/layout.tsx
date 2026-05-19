import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "부모 이름 기반 작명",
  description:
    "아버지·어머니 이름의 음운과 의미를 이어받는 이름. 가족 서사를 담은 작명 추천.",
  alternates: { canonical: "/parent-based" },
  openGraph: {
    title: "부모 이름 기반 작명 — 이름의 결",
    description: "부모 이름의 음운·의미를 이어받는 가족 서사형 이름 추천",
    url: "/parent-based",
  },
};

export default function ParentBasedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
