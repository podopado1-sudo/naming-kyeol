import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "필수 글자·항렬자 이름",
  description:
    "꼭 들어가야 할 한글 글자나 항렬자(한자)를 지정해 이름을 추천받을 수 있어요. 형제자매가 공유하는 돌림자도 한자 단위로 고정 가능합니다.",
  alternates: { canonical: "/required-char" },
  openGraph: {
    title: "필수 글자·항렬자 이름 — 이름의 결",
    description: "한글 글자 또는 한자 항렬자(돌림자)를 고정해 추천받는 이름",
    url: "/required-char",
  },
};

export default function RequiredCharLayout({ children }: { children: React.ReactNode }) {
  return children;
}
