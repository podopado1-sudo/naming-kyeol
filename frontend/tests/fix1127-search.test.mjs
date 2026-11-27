// /search(이름 추천) 11/27 버그 목록 G-search 수리 고정 — `npm test`
//
// 고친 것(tmp/handoff-2026-11-26/research/bughunt-1127.json):
//  - story-keyword-dropped: 홈 Hero 의 ?story= 를 읽어 부모 옵션 칸에 두고 /smart storyKeyword 로 보낸다(한글 없는 키워드는 제출 전에 막음)
//  - search-required-char-hanja-mismatch: 필수 글자와 항렬자 한자의 독음이 다르면 제출 전에 막는다(음절별 후보 파일로 판정)
//  - labels-search: 라벨 htmlFor ↔ 칸 id(Select 트리거·Switch 포함)
//  - search-surname-unvalidated: 성씨를 lib/name-input 으로 다듬고 한글 1~2자가 아니면 막는다
//  - search-query-persists: 요청을 시작한 뒤 주소에서 쿼리를 걷는다(새로 고침·뒤로 가기는 그 기록 칸의 세션 저장에서 되살림 —
//    표마다 따로 담아 같은 탭에서 추천을 또 받아도 앞선 칸이 남는다. 세션 저장은 클라이언트에서만 읽어 하이드레이션과 어긋나지 않는다)
//  - form-snapshot-search: 결과 화면의 조건 칩·'상세 보기'·저장은 제출 때 잡은 값만 쓴다
//
// page.tsx 는 JSX 라 바로 import 하지 못한다 — 원문을 읽어 확인하고(주석은 빼고), 판정에 쓰는 데이터·함수는 따로 불러 본다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const readRel = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const stripComments = (s) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const page = stripComments(readRel("../src/app/search/page.tsx"));

/**
 * 원문에서 함수 하나의 본문 — 머리와 같은 들여쓰기의 닫는 중괄호 줄까지
 * (모듈 맨 위 함수는 줄 첫머리의 `}`, 컴포넌트 안 함수는 두 칸 들여 쓴 `}`)
 */
function functionBody(src, head) {
  const start = src.indexOf(head);
  assert.ok(start >= 0, `${head} 를 찾지 못했다`);
  const lineStart = src.lastIndexOf("\n", start) + 1;
  const indent = src.slice(lineStart, start).match(/^ */)[0];
  const end = src.indexOf(`\n${indent}}\n`, start);
  assert.ok(end > start, `${head} 의 끝을 찾지 못했다`);
  return src.slice(start + head.length, end);
}

const { cleanNameInput, nameInputProblem, nameInputMessage, SURNAME_MAX_LENGTH } = await import("../src/lib/name-input.ts");
const { keywordHasHangul, KEYWORD_HANGUL_REQUIRED } = await import("../src/lib/parent-naming.ts");
const { firstHanCodePoint, parsePickFile, syllableFile } = await import("../src/lib/hanja-pick.ts");
const { josa } = await import("../src/lib/josa.ts");

/** 음절별 후보 파일(public/data/hanja-pick/v1) — 화면이 받는 것과 같은 파일 */
function pickFile(syllable) {
  const url = syllableFile(syllable);
  assert.ok(url, syllable);
  return parsePickFile(JSON.parse(readRel(`../public${url}`)));
}

// ------------------------------------------------------------
// story-keyword-dropped
// ------------------------------------------------------------

test("스토리 키워드 — ?story= 를 읽어 부모 기반 토글을 켜고, 부모 옵션 칸에 두고, storyKeyword 로 보낸다", () => {
  // Hero 가 싣는 이름과 같은 쿼리 이름
  assert.match(readRel("../src/components/design/Hero.tsx"), /params\.set\("story", payload\.story\)/);
  assert.match(page, /const story = params\.get\("story"\) \?\? "";/);
  assert.match(page, /includeParentBased: Boolean\(parentName \|\| story\),/);
  // 요청 — 토글이 켜져 있고 다듬은 값이 있을 때만
  assert.match(page, /const story = includeParentBased \? storyKeyword\.trim\(\) : "";/);
  assert.match(page, /storyKeyword: story \|\| undefined,/);
  // 한글 없는 키워드는 제출 전에 막는다(/parent-based 와 같은 판정·문구)
  assert.match(page, /if \(story && !keywordHasHangul\(story\)\) \{\s*toast\.error\(KEYWORD_HANGUL_REQUIRED\);\s*focusField\("storyKeyword"\);\s*return;/);
  assert.equal(keywordHasHangul("tree"), false);
  assert.equal(keywordHasHangul("바다"), true);
  assert.match(KEYWORD_HANGUL_REQUIRED, /한글/);
  // 칸은 부모 옵션 영역(includeParentBased 블록) 안 — 영어 이름 줄보다 앞
  const block = page.indexOf("{includeParentBased && (");
  const field = page.indexOf('id="storyKeyword"');
  const next = page.indexOf('id="includeDualName"');
  assert.ok(block >= 0 && block < field && field < next, "스토리 키워드 칸이 부모 옵션 영역 밖에 있다");
  assert.match(page, /<Label htmlFor="storyKeyword">/);
  assert.match(page, /maxLength=\{STORY_KEYWORD_MAX\}/);
});

test("스토리 키워드 글자 수는 백엔드 DTO 한도와 같다(넘으면 400)", () => {
  const dto = readRel("../../Application/DTOs/SmartRecommendationRequestDto.cs");
  const m = dto.match(/\[StringLength\((\d+)[^\]]*\]\s*public string\? StoryKeyword/);
  assert.ok(m, "DTO 의 StoryKeyword 길이 제한을 찾지 못했다");
  assert.match(page, new RegExp(`const STORY_KEYWORD_MAX = ${m[1]};`));
  // 주소로 온 값도 한도로 자른다
  assert.match(page, /storyKeyword: story\.slice\(0, STORY_KEYWORD_MAX\),/);
});

// ------------------------------------------------------------
// search-required-char-hanja-mismatch
// ------------------------------------------------------------

test("필수 글자 ↔ 항렬자 — 음절 후보 파일에 그 한자가 없으면 요청 전에 막는다", () => {
  assert.match(page, /import \{ requestPickFile \} from "@\/lib\/hanja-pick-store";/);
  assert.match(page, /const facts = await requestPickFile\(reqChar\);/);
  assert.match(page, /if \(facts && !facts\.some\(\(f\) => f\.character === reqHanja\)\) \{/);
  // 판정은 요청보다 먼저
  const check = page.indexOf("requestPickFile(reqChar)");
  const send = page.indexOf("await smart(req)");
  assert.ok(check >= 0 && send > check, "독음 판정이 요청 뒤에 있다");
  // 보내는 값은 다듬은 값(호환 한자는 통합 한자로)
  assert.match(page, /const reqChar = includeRequiredChar \? cleanNameInput\(requiredChar\) : "";/);
  assert.match(page, /const reqHanja = reqHanjaText \? firstHanCodePoint\(reqHanjaText\) : null;/);
  assert.match(page, /requiredChar: reqChar \|\| undefined,/);
  assert.match(page, /requiredHanja: reqHanja \|\| undefined,/);
  // 한자 칸에 한자가 없으면(한글을 넣었으면) 막는다 — 옛 화면은 그대로 보내 서버가 조용히 무시했다
  assert.match(page, /if \(reqHanjaText && !reqHanja\) \{/);
  assert.equal(firstHanCodePoint("준"), null);
  assert.equal(firstHanCodePoint("民"), "民");
});

test("독음 판정 자료 — 버그 재현(준 + 民)은 막히고, 맞는 짝과 두음 꼴은 지난다", () => {
  const has = (syllable, hanja) => pickFile(syllable).some((f) => f.character === hanja);
  assert.equal(has("준", "民"), false, "준 + 民 — 버그 목록의 재현 입력");
  assert.equal(has("준", "俊"), true);
  assert.equal(has("민", "民"), true);
  // 두음 꼴 — 본음 林(림)을 '임' 칸에도 받는다(서버 HanjaInput.ReadsAs 와 같은 한쪽 방향)
  assert.equal(has("임", "林"), true);
  assert.equal(has("림", "林"), true);
  assert.equal(has("유", "柳"), true);
});

test("독음 불일치 안내 — 음절 뒤 조사는 lib/josa 로, 한자 뒤에는 조사를 붙이지 않는다", () => {
  assert.match(
    page,
    /`‘\$\{hanja\}’ 글자는 이 사이트 사전에서 ‘\$\{syllable\}’\$\{josa\(syllable, "으로\/로"\)\} 읽지 않아요\./
  );
  assert.equal(josa("준", "으로/로"), "으로");
  assert.equal(josa("유", "으로/로"), "로");
  assert.equal(josa("일", "으로/로"), "로");
});

// ------------------------------------------------------------
// labels-search
// ------------------------------------------------------------

test("라벨은 모두 칸과 이어진다 — htmlFor ↔ id(Select 트리거·Switch 포함)", () => {
  const labels = page.match(/<Label\b[^>]*>/g) ?? [];
  assert.ok(labels.length >= 10, "라벨을 찾지 못했다");
  for (const l of labels) assert.match(l, /htmlFor=/, `htmlFor 없는 라벨: ${l}`);
  for (const [, id] of page.matchAll(/<Label\b[^>]*htmlFor="([^"]+)"/g)) {
    assert.match(page, new RegExp(`\\bid="${id}"`), `라벨 ${id} 의 칸이 없다`);
  }
  // Base UI Select 는 트리거(button)에 id
  const triggers = page.match(/<SelectTrigger\b[^>]*>/g) ?? [];
  assert.equal(triggers.length, 3);
  for (const t of triggers) assert.match(t, /\bid="[^"]+"/, t);
  // 켜고 끄는 줄 — 라벨과 Switch 가 같은 id
  assert.match(page, /<Label htmlFor=\{id\} className="cursor-pointer">\{label\}<\/Label>/);
  assert.match(page, /<Switch\s+id=\{id\}/);
  const toggleIds = [...page.matchAll(/<ToggleRow\s+id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(toggleIds.length, (page.match(/<ToggleRow\b/g) ?? []).length, "id 없는 ToggleRow 가 있다");
  assert.equal(new Set(toggleIds).size, toggleIds.length, "ToggleRow id 가 겹친다");
  const allIds = [...page.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(allIds).size, allIds.length, "같은 id 가 두 번 나온다");
});

// ------------------------------------------------------------
// search-surname-unvalidated
// ------------------------------------------------------------

test("성씨 — lib/name-input 으로 다듬고 한글 1~2자가 아니면 막는다(빈 칸 문구는 그대로)", () => {
  assert.match(page, /const ln = cleanNameInput\(lastName\);/);
  assert.match(page, /const surnameProblem = nameInputProblem\(ln, SURNAME_MAX_LENGTH\);/);
  assert.match(page, /surnameProblem === "empty"\s*\?\s*"성씨를 입력해주세요\."\s*:\s*nameInputMessage\(surnameProblem, "성씨", SURNAME_MAX_LENGTH\)/);
  assert.match(page, /const req: SmartRecommendationRequest = \{\s*lastName: ln,/);
  assert.doesNotMatch(page, /lastName: lastName\.trim\(\)/);
  // 버그 재현 입력 — 金·ㅅ·K 는 막히고 김·남궁은 지난다
  assert.equal(nameInputProblem(cleanNameInput("金"), SURNAME_MAX_LENGTH), "not-hangul");
  assert.equal(nameInputProblem(cleanNameInput("ㅅ"), SURNAME_MAX_LENGTH), "jamo");
  assert.equal(nameInputProblem(cleanNameInput("K"), SURNAME_MAX_LENGTH), "not-hangul");
  assert.equal(nameInputProblem(cleanNameInput("김서윤"), SURNAME_MAX_LENGTH), "too-long");
  assert.equal(nameInputProblem(cleanNameInput(" 김 "), SURNAME_MAX_LENGTH), null);
  assert.equal(nameInputProblem(cleanNameInput("남궁"), SURNAME_MAX_LENGTH), null);
  assert.equal(nameInputMessage("not-hangul", "성씨", SURNAME_MAX_LENGTH), "성씨는 한글로만 입력해주세요.");
});

// ------------------------------------------------------------
// search-query-persists
// ------------------------------------------------------------

test("요청을 시작한 뒤 주소에서 쿼리를 걷는다 — 경로·해시만 남기고 새 기록을 쌓지 않는다", () => {
  assert.match(
    page,
    /window\.history\.replaceState\(\{ \[RESTORE_HISTORY_KEY\]: token \}, "", window\.location\.pathname \+ window\.location\.hash\)/
  );
  assert.doesNotMatch(page, /pushState/);
  // Next 내부 값(__NA)을 직접 넣지 않는다 — 넣으면 Next 가 주소 바뀜을 모른다
  assert.doesNotMatch(page, /__NA/);
  // Next 가 history 를 감싼 뒤에(첫 문서의 autoStart 는 마운트 효과) — 한 틱 미룬다
  assert.match(page, /function markEntryAndStripQuery\(token: string\) \{\s*window\.setTimeout\(\(\) => \{/);
  // 순서: 검사 → 로딩 → 걷기 → 요청
  const body = functionBody(page, "async function runRecommend() {");
  const loading = body.indexOf("setLoading(true)");
  const strip = body.indexOf("markEntryAndStripQuery(token)");
  const send = body.indexOf("await smart(req)");
  assert.ok(loading >= 0 && loading < strip && strip < send, "쿼리 걷기가 요청 시작 자리에 있지 않다");
});

test("쿼리는 마운트 때 한 번만 읽는다 — 걷은 뒤에도 폼·용신 값이 그대로다", () => {
  // useSearchParams 로 읽는 값은 autoStart 하나뿐, 나머지는 처음 값(formFromQuery)으로
  const reads = [...page.matchAll(/searchParams\.get\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual(reads, ["autoStart"]);
  assert.match(page, /const \[seed, setSeed\] = useState<SearchSeed>\(\(\) => \(\{\s*token: null,\s*form: formFromQuery\(searchParams\),\s*outcome: null,\s*\}\)\);/);
  // 폼은 처음 값을 마운트 때만 읽고, 되살린 값은 key 를 바꿔 새로 그린다
  assert.match(page, /<SearchBody\s+key=\{seed\.token \?\? ""\}\s+seed=\{seed\}/);
  assert.match(page, /const entryToken = useRef<string \| null>\(seed\.token\);/);
  assert.match(page, /const preferredElement = seed\.form\.preferredElement \|\| undefined;/);
  for (const key of ["lastName", "birthDate", "birthTime", "parentName", "englishName", "preferredElement"]) {
    assert.match(page, new RegExp(`params\\.get\\("${key}"\\)`), key);
  }
});

test("서버 렌더·하이드레이션 렌더는 쿼리 값만 쓴다 — 세션 저장은 클라이언트에서만 읽는다(next dev 하이드레이션 불일치 방지)", () => {
  // next dev 는 useSearchParams 를 미루지 않아 경계 안도 서버에서 그린다
  // (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md 'In development … doesn't suspend')
  // 처음 값(useState 초기화 함수)은 창·저장소를 읽지 않는다
  const inner = functionBody(page, "function BabyNamingInner({");
  const init = inner.match(/useState<SearchSeed>\(\(\) => \(\{([\s\S]*?)\}\)\)/);
  assert.ok(init, "처음 값을 찾지 못했다");
  assert.doesNotMatch(init[1], /window|sessionStorage|history|readRestorable/);
  // 세션 저장은 '클라이언트인지'(서버·하이드레이션 false) 를 본 뒤 한 번만
  assert.match(inner, /const onClient = useSyncExternalStore\(subscribeNothing, \(\) => true, \(\) => false\);/);
  assert.match(
    inner,
    /if \(onClient && !restoreChecked\) \{\s*setRestoreChecked\(true\);\s*const restored = searchParams\.toString\(\) === "" \? readRestorable\(\) : null;\s*if \(restored\) setSeed\(restored\);\s*\}/
  );
  // readRestorable 은 이 한 곳에서만 부른다(선언 1 + 부르는 곳 1)
  assert.equal((page.match(/readRestorable\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(page, /initialSeed/);
});

test("새로 고침·뒤로 가기 — 그 기록 칸의 표로 세션 저장에서 되살리고, 다시 요청하지 않는다", () => {
  // 쿼리가 있으면(새로 들어온 길) 되살리지 않는다 — 위 테스트의 searchParams.toString() === "" 조건
  // 표로 찾는다(순수 함수 — 아래 테스트가 돌려 본다)
  assert.match(
    functionBody(page, "function readRestorable()"),
    /restorableEntry\(window\.sessionStorage\.getItem\(RESTORE_STORAGE_KEY\), token, Date\.now\(\)\)/
  );
  assert.match(
    functionBody(page, "function writeRestorable("),
    /for \(const attempt of storageAttempts\(storage\.getItem\(RESTORE_STORAGE_KEY\), token, entry, now\)\) \{\s*try \{\s*storage\.setItem\(RESTORE_STORAGE_KEY, attempt\(\)\);\s*return;/
  );
  // 저장·읽기는 모두 try 안(저장소를 못 쓰는 환경)
  for (const fn of ["function readRestorable()", "function writeRestorable(", "function historyToken()"]) {
    assert.match(functionBody(page, fn), /try \{/, fn);
  }
  // 요청은 제출과 autoStart(쿼리로 들어온 길)에서만 — 되살린 화면은 요청을 보내지 않는다
  assert.equal((page.match(/runRecommend\(\)/g) ?? []).length, 3, "선언 1 + 부르는 곳 2");
  assert.match(page, /void runRecommend\(\);/);
  assert.match(page, /await runRecommend\(\);/);
  assert.match(page, /if \(autoStart && lastName\.trim\(\) && !outcome && !loading\) \{/);
  // '다시 추천받기' 뒤에는 저장해 둔 결과를 지운다(새로 고침하면 폼)
  assert.match(functionBody(page, "function handleReset() {"), /writeRestorable\(entryToken\.current, currentForm\(\), null\)/);
});

/** page.tsx 의 '세션 저장 지도' 구간(순수 함수)을 떼어 타입을 지우고 돌린다 */
function restoreMap() {
  const raw = readRel("../src/app/search/page.tsx");
  const start = raw.indexOf("// ---- 세션 저장 지도 (");
  const end = raw.indexOf("// ---- 세션 저장 지도 끝 ----");
  assert.ok(start >= 0 && end > start, "세션 저장 지도 구간을 찾지 못했다");
  const js = stripTypeScriptTypes(raw.slice(start, end));
  // 순수 — 창·저장소·시계를 만지지 않는다(시각은 인자로 받는다)
  assert.doesNotMatch(js, /\bwindow\b|sessionStorage|localStorage|Date\.now|history/);
  return new Function(
    `${js}\nreturn { parseStoredEntries, restorableEntry, storageAttempts, RESTORE_VERSION, RESTORE_MAX_ENTRIES, RESTORE_RESULT_MAX_AGE_MS };`
  )();
}

/** 지어낸 폼 값·결과 — 꼴만 흉내 낸다 */
const sampleForm = (lastName, birthDate) => ({ lastName, birthDate, gender: "female", fatherName: "김민호" });
const sampleOutcome = (lastName) => ({
  data: { lastName, categories: [{ type: "standard", names: [{ name: `${lastName}서윤` }] }] },
  query: { lastName, birthDate: "2025-03-02" },
});

test("세션 저장 지도 — 다른 표가 저장돼도 앞선 표의 폼 값·결과가 남는다(같은 탭에서 추천을 또 받은 뒤 뒤로 가기)", () => {
  const { restorableEntry, storageAttempts } = restoreMap();
  let raw = null;
  const put = (token, entry, now) => {
    raw = storageAttempts(raw, token, entry, now)[0]();
  };
  const formA = sampleForm("김", "2025-03-02");
  const formB = sampleForm("이", "2024-11-20");
  const outA = sampleOutcome("김");
  const outB = sampleOutcome("이");
  // 기록 칸 A: 요청 시작(폼 값만) → 결과
  put("TA", { savedAt: 1000, form: formA }, 1000);
  put("TA", { savedAt: 2000, form: formA, outcome: outA }, 2000);
  // 같은 탭의 새 기록 칸 B(/evaluate '비슷한 이름 추천'·홈 Hero 로 다시)
  put("TB", { savedAt: 3000, form: formB }, 3000);
  put("TB", { savedAt: 4000, form: formB, outcome: outB }, 4000);
  assert.deepEqual(restorableEntry(raw, "TA", 5000), { form: formA, outcome: outA }, "앞선 칸 A 가 B 에 덮였다");
  assert.deepEqual(restorableEntry(raw, "TB", 5000), { form: formB, outcome: outB });
  // 표가 없는 칸(헤더 링크로 새로 온 길)은 되살리지 않는다
  assert.equal(restorableEntry(raw, "TC", 5000), null);
  // B 에서 '다시 추천받기'(결과 지움)는 B 만 바꾼다
  put("TB", { savedAt: 6000, form: formB }, 6000);
  assert.deepEqual(restorableEntry(raw, "TB", 7000), { form: formB, outcome: null });
  assert.deepEqual(restorableEntry(raw, "TA", 7000), { form: formA, outcome: outA });
});

test("세션 저장 지도 — 최근 칸만 남기고(마지막으로 쓴 때가 오래된 칸부터), 방금 쓴 칸은 늘 남는다", () => {
  const { restorableEntry, storageAttempts, RESTORE_MAX_ENTRIES } = restoreMap();
  assert.equal(RESTORE_MAX_ENTRIES, 5);
  let raw = null;
  const put = (token, savedAt) => {
    raw = storageAttempts(raw, token, { savedAt, form: sampleForm("김", "2025-03-02") }, savedAt)[0]();
  };
  for (let i = 1; i <= 7; i++) put(`T${i}`, i * 1000);
  const kept = Object.keys(JSON.parse(raw).entries).sort();
  assert.deepEqual(kept, ["T3", "T4", "T5", "T6", "T7"]);
  assert.equal(restorableEntry(raw, "T1", 8000), null);
  assert.notEqual(restorableEntry(raw, "T3", 8000), null);
  // 시계가 거꾸로 가도(savedAt 이 가장 작아도) 방금 쓴 칸은 남고, 나머지에서 가장 오래된 칸이 빠진다
  put("TX", 0);
  assert.deepEqual(Object.keys(JSON.parse(raw).entries).sort(), ["T4", "T5", "T6", "T7", "TX"]);
});

test("세션 저장 지도 — 시한이 지난 결과는 되살리지 않고, 다음 저장 때 지운다(폼 값은 남긴다)", () => {
  const { restorableEntry, storageAttempts, RESTORE_RESULT_MAX_AGE_MS } = restoreMap();
  const formA = sampleForm("김", "2025-03-02");
  let raw = storageAttempts(null, "TA", { savedAt: 0, form: formA, outcome: sampleOutcome("김") }, 0)[0]();
  assert.notEqual(restorableEntry(raw, "TA", RESTORE_RESULT_MAX_AGE_MS).outcome, null);
  const late = RESTORE_RESULT_MAX_AGE_MS + 1;
  assert.deepEqual(restorableEntry(raw, "TA", late), { form: formA, outcome: null });
  raw = storageAttempts(raw, "TB", { savedAt: late, form: sampleForm("이", "2024-11-20") }, late)[0]();
  const stored = JSON.parse(raw).entries;
  assert.deepEqual(stored.TA, { savedAt: 0, form: formA }, "지난 결과가 저장에 남았다");
});

test("세션 저장 지도 — 저장소가 꽉 차면 다른 칸의 결과부터 덜어 낸다", () => {
  const { restorableEntry, storageAttempts } = restoreMap();
  const big = (lastName) => ({ ...sampleOutcome(lastName), pad: "가".repeat(4000) });
  const formA = sampleForm("김", "2025-03-02");
  const formB = sampleForm("이", "2024-11-20");
  const raw = storageAttempts(null, "TA", { savedAt: 1, form: formA, outcome: big("김") }, 1)[0]();
  const attempts = storageAttempts(raw, "TB", { savedAt: 2, form: formB, outcome: big("이") }, 2).map((f) => f());
  assert.equal(attempts.length, 4);
  // 1) 모두 2) 결과는 이 칸 것만 3) 폼 값만 4) 이 칸의 폼 값만 — 차례로 작아진다
  assert.ok(attempts[0].length > attempts[1].length && attempts[1].length > attempts[2].length && attempts[2].length > attempts[3].length);
  assert.notEqual(restorableEntry(attempts[1], "TB", 3).outcome, null);
  assert.deepEqual(restorableEntry(attempts[1], "TA", 3), { form: formA, outcome: null });
  assert.deepEqual(restorableEntry(attempts[2], "TB", 3), { form: formB, outcome: null });
  assert.deepEqual(restorableEntry(attempts[2], "TA", 3), { form: formA, outcome: null });
  assert.equal(restorableEntry(attempts[3], "TA", 3), null);
  assert.deepEqual(restorableEntry(attempts[3], "TB", 3), { form: formB, outcome: null });
});

test("세션 저장 지도 — 깨진 값·다른 판은 읽지 않고, 표 이름이 Object 속성과 겹쳐도 엉키지 않는다", () => {
  const { restorableEntry, parseStoredEntries, RESTORE_VERSION } = restoreMap();
  assert.equal(RESTORE_VERSION, 2);
  assert.equal(restorableEntry(null, "TA", 0), null);
  assert.equal(restorableEntry("{", "TA", 0), null);
  // 옛 한 자리 꼴(v1)
  assert.equal(restorableEntry(JSON.stringify({ v: 1, token: "TA", savedAt: 0, form: {} }), "TA", 0), null);
  // 꼴이 다른 칸만 빠진다
  const mixed = JSON.stringify({ v: 2, entries: { TA: { savedAt: "x", form: {} }, TB: { savedAt: 1, form: { lastName: "김" } } } });
  assert.deepEqual(Object.keys(parseStoredEntries(mixed)), ["TB"]);
  assert.equal(restorableEntry(mixed, "TA", 2), null);
  // 표가 'toString'·'__proto__' 여도 프로토타입을 읽거나 바꾸지 않는다
  assert.equal(restorableEntry(mixed, "toString", 2), null);
  const proto = JSON.stringify({ v: 2, entries: { ["__proto__"]: { savedAt: 1, form: { lastName: "김" } } } });
  assert.deepEqual(restorableEntry(proto, "__proto__", 2), { form: { lastName: "김" }, outcome: null });
  assert.equal({}.lastName, undefined);
});

// ------------------------------------------------------------
// form-snapshot-search
// ------------------------------------------------------------

test("결과 화면은 제출 때 잡은 값만 쓴다 — 조건 칩·'상세 보기'·저장", () => {
  // 응답과 그 요청의 입력은 한 덩어리
  assert.match(page, /const next: SearchOutcome = \{ data, query \};/);
  assert.match(page, /const \{ data: result, query \} = outcome;/);
  // 조건 칩
  assert.match(page, /date: query\.birthDate \|\| undefined,/);
  assert.match(page, /query\.gender === "male" \? "남" : query\.gender === "female" \? "여" : "성별 무관"/);
  assert.match(page, /pureKorean: query\.includePureKorean,/);
  assert.match(page, /creative: query\.includeCreative,/);
  // 저장
  assert.match(
    page,
    /favoriteContext=\{\{\s*birthDate: query\.birthDate,\s*birthTime: query\.birthTime,\s*gender: query\.gender,\s*tone: query\.tone,\s*\}\}/
  );
  assert.doesNotMatch(page, /favoriteContext=\{\{ birthDate, birthTime, gender, tone \}\}/);
  // '상세 보기' — 살아 있는 폼 값(birthDate·gender …)을 읽지 않는다
  assert.match(page, /handleCandidateDetail\(query, fullName, evaluateHanja\)/);
  const detail = functionBody(page, "function handleCandidateDetail(");
  assert.match(detail, /const ln = query\.lastName;/);
  assert.doesNotMatch(detail, /(?<![."\w])(birthDate|birthTime|gender|tone|lastName)\b(?!")/, "폼 상태를 직접 읽는다");
  assert.match(detail, /if \(evaluateHanja\) params\.set\("hanja", evaluateHanja\);/);
});
