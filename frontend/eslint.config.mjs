import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 자동 생성 폰트 base64 모듈 (scripts/build_og_font.py) — 500KB+ 단일 라인
    "src/assets/og/pretendard-og.ts",
  ]),
]);

export default eslintConfig;
