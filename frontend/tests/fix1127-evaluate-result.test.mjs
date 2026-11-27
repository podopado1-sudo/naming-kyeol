// /evaluate 결과 화면 — 2026-11-27 버그 목록 G-evaluate-result 묶음 고정 테스트 — `npm test`
//
// - evaluate-share-save-silent: 저장소 쓰기 실패·공유 실패를 알린다, 꼴이 깨진 저장 항목은 읽을 때 거른다, 100개 상한을 알린다
// - evaluate-pdf-title: 'PDF' 인쇄 동안 문서 제목을 '{성명} 이름 평가'로 바꿨다가 되돌린다
// - evaluate-blank-hanja-copy: 이름 칸 모두 한자 없이 두면 칸마다의 어림 문장 대신 기본값 계산을 적는다(백엔드 HarmonyEngine 과 같은 말)
// - evaluate-print-controls: 인쇄에서 조작 요소(한자 칸 단추 테두리·'이 글자로'·안내·고르기 패널·하단 알림 띠)를 숨긴다
//
// 순수 모듈(lib/favorites.ts·lib/hanja-summary-text.ts)은 값으로, 화면 파일은 소스 원문으로 본다. 표본은 지어낸 값(김서윤·2025-03-02).
// 한자는 코드포인트로 적는다(다른 테스트와 같은 규칙).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const STORAGE_KEY = "nameform:favorites:v1";

/** 가짜 브라우저 저장소 — mode 로 '쓰기 거부'·'접근 자체 거부'를 흉내 낸다. 모듈을 읽기 전에 세운다 */
const store = new Map();
const events = [];
let mode = "ok"; // ok · write-denied(용량 초과·쓰기 거부) · blocked(사이트 데이터 차단 — 접근 자체가 SecurityError)
const quota = () => Object.assign(new Error("The quota has been exceeded."), { name: "QuotaExceededError" });
const security = () => Object.assign(new Error("Access is denied for this document."), { name: "SecurityError" });
const localStorageFake = {
  getItem: (key) => {
    if (mode === "blocked") throw security();
    return store.has(key) ? store.get(key) : null;
  },
  setItem: (key, value) => {
    if (mode !== "ok") throw mode === "blocked" ? security() : quota();
    store.set(key, String(value));
  },
  removeItem: (key) => void store.delete(key),
};
globalThis.window = {
  get localStorage() {
    if (mode === "blocked") throw security();
    return localStorageFake;
  },
  dispatchEvent: (event) => {
    events.push(event.type);
    return true;
  },
  addEventListener() {},
  removeEventListener() {},
};

const F = await import("../src/lib/favorites.ts");
const T = await import("../src/lib/hanja-summary-text.ts");

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
/** 주석을 뺀 코드 — 규칙을 설명하는 주석의 낱말에 걸리지 않게(evaluate-hanja-pages.test.mjs 와 같은 꼴) */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const U = (cp) => String.fromCodePoint(cp);
const SEO = U(0x745e); // 상서 서
const YUN = U(0x6f64); // 윤택할 윤

const saved = () => JSON.parse(store.get(STORAGE_KEY) ?? "[]");
const base = { fullName: "김서윤", lastName: "김", name: "서윤", birthDate: "2025-03-02", gender: "female", tone: "neutral" };

beforeEach(() => {
  store.clear();
  events.length = 0;
  mode = "ok";
});

// ============================================================
// evaluate-share-save-silent — 저장
// ============================================================

test("저장 항목의 꼴 — 목록 화면이 그대로 그려도 깨지지 않는 항목만 통과(옛 꼴은 그대로)", () => {
  const ok = { fullName: "김서윤", savedAt: "2026-11-01T00:00:00.000Z" };
  assert.equal(F.isFavoriteRecord(ok), true, "옛 꼴 {fullName, savedAt}");
  assert.equal(F.isFavoriteRecord({ ...base, savedAt: "2026-11-01T00:00:00.000Z", hanja: SEO + YUN, finalScore: 80 }), true);
  assert.equal(F.isFavoriteRecord({ ...ok, birthDate: null }), true, "null 은 없는 칸으로 본다");
  for (const bad of [
    null,
    "김서윤",
    42,
    [ok],
    { name: "서윤", savedAt: ok.savedAt }, // fullName 없음 — 옛 화면은 splitFullName 의 undefined.trim 으로 /favorites 전체가 오류였다
    { fullName: "", savedAt: ok.savedAt },
    { fullName: "   ", savedAt: ok.savedAt },
    { fullName: 7, savedAt: ok.savedAt },
    { fullName: "김서윤" }, // savedAt 없음
    { ...ok, birthDate: { y: 2025 } }, // 글이 아닌 칸 — 화면이 글로 그리면 React 가 던진다
    { ...ok, hanja: 1 },
    { ...ok, lastName: ["김"] },
  ]) {
    assert.equal(F.isFavoriteRecord(bad), false, JSON.stringify(bad));
  }
});

test("꼴이 깨진 항목은 읽을 때 빠지고 멀쩡한 저장분은 그대로 — 다음에 쓸 때 저장소에서도 빠진다", () => {
  const good = { ...base, finalScore: 80, savedAt: "2026-11-01T00:00:00.000Z" };
  const legacy = { fullName: "남궁민", lastName: "남궁", name: "민", savedAt: "2026-09-01T00:00:00.000Z" };
  store.set(STORAGE_KEY, JSON.stringify([{ name: "서윤", savedAt: "2026-10-01T00:00:00.000Z" }, good, null, legacy, { fullName: 3 }]));
  assert.equal(F.favoriteCount(), 2);
  assert.equal(F.isFavorite("김서윤", "2025-03-02"), true);
  assert.equal(F.isFavorite("남궁민"), true);
  // 하나 더 저장하면 깨진 항목 없이 쓴다 — 멀쩡한 항목은 고쳐 쓰지 않는다
  assert.equal(F.addFavorite({ ...base, hanja: SEO + YUN }), true);
  assert.equal(saved().length, 3);
  assert.deepEqual(saved().slice(1), [good, legacy]);
  // 배열이 아니거나 JSON 이 아니면 빈 목록(예전과 같다)
  store.set(STORAGE_KEY, "{\"fullName\":\"김서윤\"}");
  assert.equal(F.favoriteCount(), 0);
  store.set(STORAGE_KEY, "not json");
  assert.equal(F.favoriteCount(), 0);
});

test("저장소에 쓰지 못하면 add·remove·toggle 이 false — 알림 이벤트도 보내지 않는다(예외가 단추 밖으로 나가지 않는다)", () => {
  assert.equal(F.toggleFavorite(base), true);
  assert.equal(saved().length, 1);
  assert.equal(events.length, 1);

  mode = "write-denied"; // 용량 초과·쓰기 거부 — 읽기는 된다
  assert.equal(F.toggleFavorite(base), false, "지우기 실패");
  assert.equal(F.isFavorite("김서윤", "2025-03-02"), true, "저장분은 그대로");
  assert.equal(F.addFavorite({ ...base, hanja: SEO }), false);
  assert.equal(F.removeFavorite("김서윤", "2025-03-02"), false);
  assert.equal(events.length, 1, "실패한 쓰기는 화면에 바뀌었다고 알리지 않는다");
  // 이미 저장된 조합을 다시 저장하는 것은 할 일이 없어 성공
  assert.equal(F.addFavorite(base), true);

  mode = "blocked"; // 사이트 데이터 차단 — 저장소 접근 자체가 SecurityError
  assert.doesNotThrow(() => F.toggleFavorite(base));
  assert.equal(F.toggleFavorite(base), false);
  assert.equal(F.isFavorite("김서윤", "2025-03-02"), false);
  assert.equal(F.favoriteCount(), 0);

  mode = "ok";
  assert.equal(F.toggleFavorite(base), true, "다시 쓸 수 있으면 지운다");
  assert.equal(saved().length, 0);
});

test("100개 상한 — 넘으면 가장 오래된 것을 지우고, 저장 알림이 그 사실을 적는다", () => {
  assert.equal(F.FAVORITES_LIMIT, 100);
  for (let i = 0; i < F.FAVORITES_LIMIT; i++) F.addFavorite({ fullName: `김서${i}`, lastName: "김", name: `서${i}` });
  assert.equal(F.favoriteCount(), 100);
  assert.equal(F.addFavorite({ ...base }), true);
  assert.equal(saved().length, 100);
  assert.equal(saved().at(-1).fullName, "김서1", "가장 오래된 '김서0'이 빠졌다");
  assert.equal(F.favoriteSavedNotice(false), "저장됨");
  assert.equal(F.favoriteSavedNotice(true), "저장됨 — 100개까지 보관해서 가장 오래된 1개를 지웠어요");
  assert.equal(
    F.FAVORITE_SAVE_FAILED,
    "이 브라우저에서는 저장할 수 없어요. 사이트 데이터 저장이 막혀 있거나 저장 공간이 가득 찼을 수 있어요."
  );
});

test("저장 단추(EvaluateResult onSave) — 실패하면 안내 토스트, 상한이면 미리 보고 알린다", () => {
  const result = code(read("../src/app/evaluate/EvaluateResult.tsx"));
  assert.match(result, /const evicts = !fav && favoriteCount\(\) >= FAVORITES_LIMIT;\s*const ok = toggleFavorite\(\{/);
  assert.match(result, /if \(!ok\) \{\s*toast\.error\(FAVORITE_SAVE_FAILED\);\s*return;\s*\}\s*toast\.success\(fav \? "저장 해제" : favoriteSavedNotice\(evicts\)\);/);
  // 반환형은 boolean 이라 결과를 쓰지 않는 다른 화면(SmartResult 등)의 호출은 그대로 컴파일된다
  const lib = read("../src/lib/favorites.ts");
  for (const fn of ["addFavorite", "removeFavorite", "toggleFavorite"]) {
    assert.match(lib, new RegExp(`export function ${fn}\\([\\s\\S]*?\\): boolean \\{`), fn);
  }
});

// ============================================================
// evaluate-share-save-silent — 공유
// ============================================================

const DATA = { title: "김서윤 - 이름 리포트", text: "김서윤 이름 평가 리포트", url: "https://example.test/evaluate?lastName=%EA%B9%80&name=%EC%84%9C%EC%9C%A4" };
const named = (name) => Object.assign(new Error(name), { name });

test("shareOrCopy — 공유 시트 → (취소가 아닌 실패면) 복사 → 둘 다 안 되면 failed", async () => {
  const calls = [];
  const share = (result) => async (d) => {
    calls.push(["share", d.url]);
    if (result !== "ok") throw named(result);
  };
  const copy = (result) => async (t) => {
    calls.push(["copy", t]);
    if (result !== "ok") throw named(result);
  };

  assert.equal(await T.shareOrCopy(DATA, share("ok"), copy("ok")), "shared");
  assert.deepEqual(calls.splice(0), [["share", DATA.url]]);
  // 공유 시트를 닫았다 — 조용히 끝난다(복사하지 않는다)
  assert.equal(await T.shareOrCopy(DATA, share("AbortError"), copy("ok")), "cancelled");
  assert.deepEqual(calls.splice(0), [["share", DATA.url]]);
  // 취소가 아닌 실패(권한·상태)는 복사로 넘어간다 — 옛 화면은 여기서 멈췄다
  assert.equal(await T.shareOrCopy(DATA, share("NotAllowedError"), copy("ok")), "copied");
  assert.deepEqual(calls.splice(0), [["share", DATA.url], ["copy", DATA.url]]);
  assert.equal(await T.shareOrCopy(DATA, share("InvalidStateError"), copy("NotAllowedError")), "failed");
  calls.length = 0;
  // 공유 시트가 없는 브라우저
  assert.equal(await T.shareOrCopy(DATA, undefined, copy("ok")), "copied");
  assert.equal(await T.shareOrCopy(DATA, undefined, copy("NotAllowedError")), "failed");
  // 클립보드도 없는 곳(비보안 맥락·일부 인앱 브라우저)
  assert.equal(await T.shareOrCopy(DATA, undefined, undefined), "failed");
  assert.equal(await T.shareOrCopy(DATA, share("NotAllowedError"), undefined), "failed");
});

test("isShareAbort — AbortError 만(브라우저의 DOMException 꼴 포함)", () => {
  assert.equal(T.isShareAbort(new DOMException("Share canceled", "AbortError")), true);
  assert.equal(T.isShareAbort(named("AbortError")), true);
  assert.equal(T.isShareAbort(new DOMException("denied", "NotAllowedError")), false);
  assert.equal(T.isShareAbort(new Error("x")), false);
  assert.equal(T.isShareAbort(null), false);
  assert.equal(T.isShareAbort("AbortError"), false);
});

test("공유 알림 — 생년월일을 넣은 결과는 두 길 모두 '생년월일은 빠진 링크', 실패는 주소를 함께", () => {
  assert.equal(T.shareNotice("copied", false), "링크 복사됨");
  assert.equal(T.shareNotice("copied", true), "링크 복사됨 (생년월일은 빠진 링크예요)");
  assert.equal(T.shareNotice("shared", true), "공유했어요 (생년월일은 빠진 링크예요)");
  assert.equal(T.shareNotice("shared", false), null, "공유 시트가 이미 알린다");
  assert.equal(T.shareNotice("cancelled", true), null);
  assert.equal(T.shareNotice("failed", true), null);
  assert.equal(T.SHARE_FAILED, "링크를 복사하지 못했어요");
  assert.equal(T.shareFailedDetail(DATA.url), `주소를 직접 복사해 주세요: ${DATA.url}`);
});

test("공유 단추(EvaluateResult onShare) — 빈 catch 없이 shareOrCopy 의 결과로 알린다", () => {
  const result = code(read("../src/app/evaluate/EvaluateResult.tsx"));
  const start = result.indexOf("async function onShare()");
  const body = result.slice(start, result.indexOf("\n  }\n", start));
  assert.ok(start > 0, "onShare 를 찾지 못했다");
  assert.doesNotMatch(body, /catch\s*\{\s*\}/);
  assert.doesNotMatch(body, /catch \{/);
  assert.match(body, /const outcome = await shareOrCopy\(/);
  assert.match(body, /typeof navigator\.share === "function" \? \(d\) => navigator\.share\(d\) : undefined,/);
  assert.match(body, /typeof navigator\.clipboard\?\.writeText === "function" \? \(t\) => navigator\.clipboard\.writeText\(t\) : undefined/);
  assert.match(body, /if \(outcome === "failed"\) \{\s*toast\.error\(SHARE_FAILED, \{ description: shareFailedDetail\(url\), duration: 15_000 \}\);\s*return;\s*\}/);
  assert.match(body, /const notice = shareNotice\(outcome, !!input\.birthDate\);\s*if \(notice\) toast\.success\(notice\);/);
  // 공유 링크는 여전히 생년월일을 뺀다
  assert.match(body, /evaluateHref\(shared, \{ withBirth: false \}\)/);
});

// ============================================================
// evaluate-pdf-title
// ============================================================

test("PDF 기본 파일 이름 — 인쇄 동안 '{성명} 이름 평가', afterprint 에서 되돌리고 화면을 떠날 때도 되돌린다", () => {
  assert.equal(T.pdfTitle("김서윤"), "김서윤 이름 평가");
  assert.equal(T.pdfTitle("남궁민"), "남궁민 이름 평가");
  const result = code(read("../src/app/evaluate/EvaluateResult.tsx"));
  const start = result.indexOf("function onPdf()");
  assert.ok(start > 0, "onPdf 를 찾지 못했다");
  const body = result.slice(start, result.indexOf("\n  }\n", start));
  assert.match(body, /const title = pdfTitle\(data\.fullName\);/);
  assert.match(body, /const previous = document\.title;/);
  assert.match(body, /window\.addEventListener\("afterprint", restore\);/);
  assert.match(body, /window\.removeEventListener\("afterprint", restore\);/);
  // 그사이 다른 쪽으로 옮겼으면 새 쪽의 제목을 덮지 않는다
  assert.match(body, /if \(document\.title === title\) document\.title = previous;/);
  // 제목을 바꾼 뒤 인쇄한다(순서)
  assert.ok(body.indexOf("document.title = title;") < body.indexOf("window.print();"));
  // afterprint 가 오지 않는 브라우저 — 결과 화면을 떠날 때(언마운트) 되돌린다
  assert.match(result, /useEffect\(\(\) => \(\) => restoreTitleRef\.current\?\.\(\), \[\]\);/);
});

// ============================================================
// evaluate-blank-hanja-copy
// ============================================================

const FACT = { character: SEO, gloss: "상서 서", fiveElement: "金", resourceGrade: "R", vReasons: [], strokeCount: 13, yinYang: "陽", common: true, forbidden: false, hasMeaning: true, basic: true };
const syl = (syllable, source, hanja = null) => ({ syllable, source, fills: [], hanja });

test("allUserBlank — 이름 칸 모두 한자가 없고 그중 한자 없이 둔 칸이 있을 때만(백엔드가 기본값으로 계산하는 조건)", () => {
  assert.equal(T.allUserBlank({ syllables: [syl("서", "none"), syl("윤", "none")] }), true);
  // 쓸 수 있는 한자가 없는 음절이 섞여도 이름 글자의 한자는 모두 비어 있다
  assert.equal(T.allUserBlank({ syllables: [syl("서", "none"), syl("몰", "unavailable")] }), true);
  // 한 칸만 비우면 칸마다 어림한다(그 문장이 맞다)
  assert.equal(T.allUserBlank({ syllables: [syl("서", "user", FACT), syl("윤", "none")] }), false);
  assert.equal(T.allUserBlank({ syllables: [syl("서", "auto", FACT), syl("윤", "none")] }), false);
  // 사용자가 비운 칸이 없으면(쓸 수 있는 한자가 없는 음절뿐) 예전 문구 그대로
  assert.equal(T.allUserBlank({ syllables: [syl("몰", "unavailable"), syl("닉", "unavailable")] }), false);
  assert.equal(T.allUserBlank({ syllables: [] }), false);
  assert.equal(T.allUserBlank(null), false);
  assert.equal(T.allUserBlank(undefined), false);
});

test("한자 없이 둔 칸의 안내 — 모두 비우면 어림 문장을 빼고 블록 아래 한 줄로, 조화 패널 경고도 기본값", () => {
  assert.equal(T.noneNote("윤", true, true), "‘윤’ 음절은 한자 없이 한글로 두었어요.");
  assert.equal(T.noneNote("윤", false, true), "‘윤’ 음절은 한자 없이 한글로 두었어요.");
  // 한 칸만 비운 결과는 예전 그대로(칸마다 어림한다 — 백엔드 획수 조화 5획·81수리 0획)
  assert.equal(T.noneNote("윤", true, false), T.noneNote("윤", true));
  assert.match(T.noneNote("윤", true), /5획, 81수리에서 0획으로 어림해 계산했어요\(추정값\)\.$/);
  assert.equal(
    T.ALL_BLANK_NOTICE,
    "이름 칸에 둔 한자가 없어 조화 점수의 자원오행 보완·획수 조화·음양·전통 81수리는 정해진 기본값으로 계산했어요(발음오행만 한글 소리로 계산해요)."
  );
  assert.doesNotMatch(T.ALL_BLANK_NOTICE, /어림|추정/);
  const allBlank = { syllables: [syl("서", "none"), syl("윤", "none")] };
  assert.equal(T.fallbackWarning(allBlank), "⚠ 한자를 두지 않아 기본값으로 계산했어요");
  assert.equal(T.fallbackWarning({ syllables: [syl("서", "user", FACT), syl("윤", "none")] }), "⚠ 한자를 두지 않은 음절은 획수를 추정값으로 계산했어요");
  assert.equal(T.fallbackWarning({ syllables: [syl("몰", "unavailable"), syl("닉", "unavailable")] }), "⚠ 배정할 한자가 없는 음절이 있어 기본값으로 계산했어요");
});

test("기본값 문장은 백엔드 HarmonyEngine 의 동작과 같다 — 이름 한자가 모두 비면 네 항목 고정값, 발음오행만 계산", () => {
  const engine = read("../../Application/Engines/HarmonyEngine.cs");
  const early = /if \(selectedHanja\.All\(h => h == null\)\)\s*\{([\s\S]*?)return Task\.FromResult\(breakdown\);/.exec(engine);
  assert.ok(early, "HarmonyEngine 의 '한자가 모두 비면' 가지를 찾지 못했다 — 문장(ALL_BLANK_NOTICE)을 다시 볼 것");
  assert.match(early[1], /breakdown\.FiveElementScore = 14;/);
  assert.match(early[1], /breakdown\.ResourceElementScore = 10;/);
  assert.match(early[1], /breakdown\.YinYangScore = 5;/);
  assert.match(early[1], /breakdown\.SuriSagyeokScore = 7;/);
  assert.match(early[1], /breakdown\.PronunciationElementScore = CalculatePronunciationElementScore\(lastName, name, breakdown\.Notes\);/);
  assert.match(early[1], /"한자를 두지 않아 기본값을 사용했습니다"/);
});

test("결과 블록 — 이름 칸 모두 비운 결과(생년월일 있음)에 한 줄, 칸 안내는 어림 없이", () => {
  const block = code(read("../src/components/design/HanjaSummaryBlock.tsx"));
  // 계산이 끝난 응답(summary) 기준 — 기다리는 변경이 아니라 지금 보이는 점수를 낸 조합
  assert.match(block, /const allBlank = birthDateProvided && allUserBlank\(summary\);/);
  assert.match(block, /\{allBlank && <p style=\{guideText\}>\{ALL_BLANK_NOTICE\}<\/p>\}/);
  assert.match(block, /noneNote\(syllable\.syllable, birthDateProvided, allBlank\)/);
});

// ============================================================
// evaluate-print-controls
// ============================================================

test("인쇄 — 블록 부제의 '칸을 눌러…'·'이 글자로' 안내만 숨기고 앞 문장은 남긴다(부제 전체 문장은 예전 그대로)", () => {
  assert.equal(T.BLOCK_CHANGE_HINT, "칸을 눌러 바꿔 볼 수 있어요.");
  assert.equal(T.blockSource(true), "고른 한자로 계산했어요.");
  assert.equal(T.blockSource(false), "한자를 고르지 않아 자동으로 골랐어요.");
  for (const userHanja of [true, false]) {
    assert.equal(T.blockSubtitle(userHanja), `${T.blockSource(userHanja)} ${T.BLOCK_CHANGE_HINT}`);
  }
  assert.equal(T.CANDIDATES_SUBTITLE, `${T.CANDIDATES_SUBTITLE_FACT} ${T.CANDIDATES_PICK_HINT}`);
  assert.equal(T.CANDIDATES_PICK_HINT, "줄 끝의 ‘이 글자로’를 누르면 그 글자로 바꿔 다시 계산해요.");

  const body = read("../src/components/design/EvalBody.tsx");
  // 부제 끝의 안내만 data-hide-print — 절 머리 꼴은 SectionHead 와 같다
  assert.match(body, /\{subtitle\} <span data-hide-print>\{hint\}<\/span>/);
  const block = code(read("../src/components/design/HanjaSummaryBlock.tsx"));
  assert.match(block, /<SectionHeadWithHint title=\{BLOCK_TITLE\} subtitle=\{blockSource\(summary\.userHanja\)\} hint=\{BLOCK_CHANGE_HINT\} \/>/);
  assert.doesNotMatch(block, /<SectionHead\b/);
});

test("인쇄 — 누르는 요소는 data-hide-print: '이 글자로'·고르기 패널·읽는 법 접기·[다시 시도] [닫기]·비교 줄·작명 원리 링크·하단 알림 띠", () => {
  const body = read("../src/components/design/EvalBody.tsx");
  assert.match(body, /<button\s+type="button"\s+data-hide-print\s+id=\{`\$\{markBase\}-pick-\$\{gi\}-\$\{i\}`\}/);
  const block = code(read("../src/components/design/HanjaSummaryBlock.tsx"));
  assert.match(block, /\{openSlot && \(\s*<div data-hide-print>\s*<HanjaPickerPanel\b/);
  assert.match(block, /<details data-hide-print style=\{\{ marginTop: 12 \}\}>/);
  assert.match(block, /<div data-hide-print style=\{\{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 \}\}>\s*<button/);
  assert.match(block, /<div data-hide-print style=\{\{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var\(--color-divider\)" \}\}>/);
  // 칸 단추는 숨기지 않고 테두리·바탕만 걷어 글자를 남긴다(칸 상자는 HanjaSlots 의 인라인 스타일이라 !important)
  assert.match(block, /<style>\{PRINT_CSS\}<\/style>/);
  const css = /const PRINT_CSS = `([\s\S]*?)`;/.exec(block);
  assert.ok(css, "PRINT_CSS 를 찾지 못했다");
  assert.match(css[1], /@media print \{\s*\.eval-hanja-block \[role="group"\] button > span:first-child \{\s*border: none !important;\s*background: transparent !important;\s*box-shadow: none !important;/);
  // 그 선택자가 칸 상자를 짚는지 — 칸 줄은 role="group", 칸 = 버튼, 첫 자식 span 이 테두리 상자다
  const slots = read("../src/components/design/HanjaSlots.tsx");
  assert.match(slots, /<div role="group" aria-labelledby=\{labelledBy\}/);
  assert.match(slots, /\}\}\s*>\s*<span style=\{boxStyle\(slot, open, invalid\)\}>/);
  assert.match(code(read("../src/components/design/HanjaSummaryBlock.tsx")), /<div className="eval-hanja-block" style=\{card\}>/);

  const result = code(read("../src/app/evaluate/EvaluateResult.tsx"));
  assert.match(result, /<Link href="\/method" data-hide-print style=/);
  assert.match(result, /<div className="hide-on-print" style=\{\{ display: "flex", gap: 8, flexWrap: "wrap" \}\}>/, "머리 단추 줄(저장·공유·PDF)은 예전부터 숨김");
  const client = code(read("../src/app/evaluate/EvaluateClient.tsx"));
  assert.match(client, /<div\s+role="status"\s+aria-live="polite"\s+data-hide-print\s+style=\{\{\s*position: "fixed",/);
  // 숨김 규칙이 아직 전역 인쇄 규칙에 있는지(G-print 가 바꾸면 이 전제를 다시 볼 것)
  assert.match(read("../src/app/globals.css"), /@media print \{[\s\S]*?\[data-hide-print\] \{\s*display: none !important;/);
});
