"use client";

import { useEffect } from "react";
import { ServerErrorScreen } from "@/components/design/SystemStates";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO: 운영 환경에서는 에러 추적 서비스(Sentry 등)에 보고
    console.error(error);
  }, [error]);

  // 2026-11-27: error.message 는 화면에 넘기지 않는다 — 클라이언트 오류면 영문 예외 원문('Cannot read properties of undefined …'),
  // 서버 오류면 Next 의 영문 일반 문구라 본문이 영어가 됐고, digest 가 없을 때 REF 가 그 문구 앞 8글자였다.
  // 화면은 고정 한국어 문장 + (있을 때만) digest. 원문은 위 console.error 로만 남는다
  return <ServerErrorScreen digest={error.digest} onRetry={reset} />;
}
