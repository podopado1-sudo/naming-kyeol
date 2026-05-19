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

  return (
    <ServerErrorScreen
      refId={error.digest ?? error.message?.slice(0, 8) ?? "unknown"}
      errorMessage={error.message}
      onRetry={reset}
    />
  );
}
