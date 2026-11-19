/**
 * /ohaeng — 부족한 오행 찾기 (2026-11 설계 docs/plan-ohaeng-2026-11.md §6·§7)
 *
 * 서버 컴포넌트다. 머리말(h1·리드)과 설명 글(OhaengGuide)을 서버 렌더 HTML 에 싣고, 상태가 필요한 폼·결과만 OhaengClient(클라이언트)에 둔다
 * (/evaluate·/company 와 같은 꼴). metadata 는 서버 컴포넌트에서만 export 할 수 있어 이 파일에 둔다
 * (node_modules/next/dist/docs 03-api-reference/04-functions/generate-metadata.md).
 * openGraph 는 얕은 병합이라 BASE_OPEN_GRAPH 를 펼친다(CLAUDE.md). 입력값을 쿼리로 받지 않으니 robots TOOL_QUERY_VARIANTS 변경 없음.
 *
 * ⚠️ 게시 시점: 사주 계산 수정(설계 §1 P0)과 백엔드 POST /api/v1/saju/elements 가 운영에 뜬 뒤에 낸다(설계 §10 배포 순서).
 */
import type { Metadata } from "next";

import { ApiWarmup } from "@/components/design/ApiWarmup";
import { Footer } from "@/components/design/Footer";
import { Header } from "@/components/design/Header";
import { BASE_OPEN_GRAPH } from "@/lib/og";

import { OhaengClient } from "./OhaengClient";
import { OhaengGuide } from "./OhaengGuide";

export const metadata: Metadata = {
  title: "부족한 오행 찾기 — 사주 원국 오행 세기",
  description:
    "생년월일과 태어난 시각으로 사주 원국 여덟 글자의 木·火·土·金·水 개수를 세고, 없는 오행과 용신·희신, 그 오행을 담은 이름 한자 예를 무료로 보여 드립니다. 입력값은 저장하지 않습니다.",
  alternates: { canonical: "/ohaeng" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "부족한 오행 찾기 — 이름의 결",
    description: "사주 원국 여덟 글자의 오행 개수·없는 오행·용신과 그 오행을 담은 이름 한자 예",
    url: "/ohaeng",
  },
};

export default function OhaengPage() {
  return (
    <>
      {/* 헤더 메뉴는 4개 고정(홈·이름 찾기·작명 가이드·작명 원리) — 메뉴에 없는 화면이라 아무것도 켜지 않는다(기본값 'none') */}
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        <header className="mb-10 space-y-3 text-center">
          <p className="eyebrow">OHAENG · 오행</p>
          <h1 className="font-serif text-3xl font-bold leading-snug tracking-tight text-navy md:text-4xl">
            부족한 오행 찾기
          </h1>
          <div className="mx-auto max-w-xl space-y-2 text-[15px] leading-relaxed text-text-2">
            <p>
              생년월일과 태어난 시각을 넣으면 사주 원국의 여덟 글자(시각을 모르면 여섯 글자)를 세우고, 木·火·土·金·水가 몇 개씩
              있는지 셉니다. 하나도 없는 오행과 이 사이트가 계산한 용신·희신, 그 오행을 자원오행으로 가진 이름 한자 예를 함께 보여
              드립니다.
            </p>
            <p className="text-sm text-text-3">
              입력한 값은 계산 서버로 보내 결과를 만드는 데만 쓰고, 데이터베이스나 서버 로그에 남기지 않습니다.
            </p>
          </div>
        </header>

        <OhaengClient />

        <OhaengGuide />
      </main>
      <Footer />
      <ApiWarmup />
    </>
  );
}
