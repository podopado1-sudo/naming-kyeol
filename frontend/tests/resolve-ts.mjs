// 테스트 공용 헬퍼 — 앱 코드(.ts)가 확장자 없이 쓴 상대 import 를 node 가 찾게 한다. (*.test.mjs 가 아니라 따로 돌지 않는다.)
//
// 앱 코드는 `import { josa } from "./josa"` 처럼 확장자 없이 쓴다(Next·tsc 규칙 — tsconfig 에 allowImportingTsExtensions 없음).
// node 의 타입 지우기는 확장자 없는 상대 경로를 풀지 못하므로, .ts 파일이 부른 확장자 없는 상대 경로에 '.ts' 를 붙여 다시 찾는다.
// tests/ohaeng.test.mjs 가 파일 안에 둔 것과 같은 훅이다(그 파일은 그대로 둔다).
//
// 쓰는 법: 테스트 맨 위에서 `import "./resolve-ts.mjs";` 한 뒤, 앱 모듈은 **동적 import** 로 읽는다 —
// 정적 import 는 훅이 걸리기 전에 한꺼번에 풀려 버린다.
//   const { cleanHanjaText } = await import("../src/lib/hanja-pick.ts");
// node --test 는 테스트 파일마다 따로 돌아 다른 테스트에 번지지 않는다.
import { registerHooks } from "node:module";

registerHooks({
  // 앱 코드의 JSON import(`with { type: "json" }`)는 node 가 그대로 읽는다 — 확장자 붙이기만 맡는다
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      const relativeNoExt = /^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier);
      if (err?.code === "ERR_MODULE_NOT_FOUND" && relativeNoExt && context.parentURL?.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});
