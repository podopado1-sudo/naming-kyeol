import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { ApiWarmup } from "@/components/design/ApiWarmup";

import { EvaluateClient } from "./EvaluateClient";
import { EvaluateHanjaGuide } from "./EvaluateHanjaGuide";

/**
 * /evaluate — 이름 평가.
 *
 * Header·소개(h1)·입력 폼·점수 설명·Footer가 정적 HTML에 실린다. URL 쿼리를 읽는 부분만
 * EvaluateClient 안의 작은 Suspense 경계에 있다 — 예전에는 페이지 전체가 Suspense 안이라
 * 정적 HTML 본문이 '로딩 중...'뿐이었다(감사 AS-3·DD-3).
 *
 * 설명 글 '아기 이름 한자 정하기'(EvaluateHanjaGuide — 2026-11 한자 입력 설계 §9-6·§12-2)는 서버 컴포넌트라 여기서 그려
 * EvaluateClient 에 prop 으로 넘긴다. 그 파일은 음절 색인을 파일로 읽는다(node:fs) — 클라이언트 컴포넌트가 import 하면 안 된다
 * (node_modules/next/dist/docs 01-app/01-getting-started/05-server-and-client-components.md 'Interleaving Server and Client Components').
 */
export default function EvaluatePage() {
  return (
    <>
      <Header current="none" />
      <EvaluateClient guide={<EvaluateHanjaGuide />} />
      <Footer />
      <ApiWarmup />
    </>
  );
}
