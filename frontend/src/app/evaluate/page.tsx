import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { ApiWarmup } from "@/components/design/ApiWarmup";

import { EvaluateClient } from "./EvaluateClient";

/**
 * /evaluate — 이름 평가.
 *
 * Header·소개(h1)·입력 폼·점수 설명·Footer가 정적 HTML에 실린다. URL 쿼리를 읽는 부분만
 * EvaluateClient 안의 작은 Suspense 경계에 있다 — 예전에는 페이지 전체가 Suspense 안이라
 * 정적 HTML 본문이 '로딩 중...'뿐이었다(감사 AS-3·DD-3).
 */
export default function EvaluatePage() {
  return (
    <>
      <Header current="none" />
      <EvaluateClient />
      <Footer />
      <ApiWarmup />
    </>
  );
}
