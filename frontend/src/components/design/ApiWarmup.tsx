/**
 * ApiWarmup — 화면이 뜨면 백엔드를 한 번 깨운다 (출력 없음, 세션당 1회).
 *
 * 왜 있나(2026-10-21): Render Free 콜드스타트 때문에 첫 평가가 30초 가까이 멈춘 듯 보였다(감사 UX-1).
 * 사용자가 이름·출생일을 입력하는 10~30초 동안 미리 깨워 대기를 숨긴다.
 * 호출 대상과 리미터 이유는 lib/api.ts warmUpApi 주석 참고.
 */
"use client";

import { useEffect } from "react";
import { warmUpApi } from "@/lib/api";

const SESSION_KEY = "nameform:api-warmup:v1";

export function ApiWarmup() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등) — 화면마다 한 번 깨워도 비용이 작다
    }
    warmUpApi();
  }, []);

  return null;
}

export default ApiWarmup;
