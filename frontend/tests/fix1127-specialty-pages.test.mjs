// 단독 추천 화면 넷(/creative·/pure-korean·/three-syllable·/required-char) — 2026-11-27 버그 목록 묶음 G-specialty-pages. `npm test`
//
//   score-label-final-creative-rare — 창의 점수·특이 성씨 발음 조화 점수에 'FINAL'·'SCORE OUT OF 100'(종합)이 붙었다
//   labels-specialty                — 입력 라벨이 칸과 이어져 있지 않았다(htmlFor 없음, 선택 상자에 id 없음)
//   required-char-input-feedback    — 필수 글자에 낱자모·영문·사전 밖 한자를 넣으면 이유 없는 '결과 없음', 死 는 주의 없이 50개, 봄은 안내 없음
//   form-snapshot-specialty         — 응답을 기다리는 동안 폼을 고치면 조건 칩·'상세 보기'·저장이 고친 값으로 나갔다
//   specialty-meta-counts           — 메타 설명의 '139개'(실제 138)·'326개'(서로 다른 이름 307개)
// 표본 값은 지어낸 것이다(김·서윤·2025-03-02 꼴). 데이터 숫자는 저장소 파일을 직접 센다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const {
  CREATIVE_SCORE_LABEL,
  SURNAME_HARMONY_SCORE_LABEL,
  SURNAME_REQUIRED,
  REQUIRED_CHAR_REQUIRED,
  REQUIRED_CHAR_NOT_USABLE,
  REQUIRED_CHAR_OUTSIDE_BMP,
  normalizeSpecialtyTags,
  wrapCreativeResponse,
  requestChipLabels,
  checkSpecialtySurname,
  checkRequiredCharInput,
  requiredHanjaVerdict,
  requiredSyllableNote,
} = await import("../src/lib/specialty-candidates.ts");
const { toHanjaFact } = await import("../src/lib/hanja-pick.ts");

const fromFrontend = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), "utf8");
const fromRepo = (rel) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");
const read = (rel) => fromFrontend(`src/${rel}`);

const PAGES = ["app/creative/page.tsx", "app/pure-korean/page.tsx", "app/three-syllable/page.tsx", "app/required-char/page.tsx"];

// ------------------------------------------------------------
// score-label-final-creative-rare
// ------------------------------------------------------------

test("서버가 창의 탭에 창의 점수, 특이 성씨 탭에 발음 조화를 싣는다 — 이름표를 정한 근거(바뀌면 이름표도 다시 볼 것)", () => {
  const svc = fromRepo("Application/Services/SmartRecommendationService.cs");
  assert.match(svc, /Score = Math\.Round\(c\.CreativityScore, 1\),/, "창의 탭 Score = CreativityScore");
  assert.match(svc, /Score = c\.HarmonyScore,\s*\r?\n\s*Tags = new List<string> \{ "희귀성씨"/, "특이 성씨 탭 Score = 발음 조화(HarmonyScore)");
  // 그 점수는 종합(미학·조화)이 아니다 — 창의 엔진의 표시 점수, 희귀 성씨 엔진의 발음 조화
  assert.match(fromRepo("Application/Engines/CreativeNamingEngine.cs"), /c\.CreativityScore = CalculateDisplayScore\(/);
  assert.match(fromRepo("Application/Engines/RareSurnameEngine.cs"), /발음 조화 점수 계산/);
  // 결과 화면은 이름표가 없으면 'FINAL' 이다 — 그래서 이름표를 붙여야 한다
  assert.match(read("components/design/SmartResult.tsx"), /scoreLabel: c\.scoreLabel \?\? "FINAL"/);
});

test("/search 창의·특이 성씨 탭 — 이름표가 'FINAL' 이 아니라 '창의'·'발음 조화'", () => {
  // 서버 꼴 그대로(SmartRecommendationService): 창의 칩 [Concept, SurnameConnection], 특이 성씨 칩 ['희귀성씨', '조화:N', ...한자 옵션]
  const cr = normalizeSpecialtyTags("creative", { name: "유슬", fullName: "김유슬", meaning: "", score: 91.1, tags: ["개념", "성씨 연결"], phonologyNotes: [] });
  assert.equal(cr.scoreLabel, CREATIVE_SCORE_LABEL);
  assert.equal(cr.scoreLabel, "창의");
  assert.deepEqual(cr.tags, ["개념", "성씨 연결"], "칩은 그대로");
  const rare = normalizeSpecialtyTags("rare-surname", { name: "원준", fullName: "봉원준", meaning: "", score: 99, tags: ["희귀성씨", "조화:99"], phonologyNotes: [] });
  assert.equal(rare.scoreLabel, SURNAME_HARMONY_SCORE_LABEL);
  assert.equal(rare.scoreLabel, "발음 조화");
  for (const c of [cr, rare]) assert.notEqual(c.scoreLabel, "FINAL");
  // 이미 이름표가 있으면(단독 화면이 만든 후보) 그대로 — 같은 객체
  const already = { name: "유슬", fullName: "김유슬", meaning: "", score: 90, scoreLabel: "창의", tags: [], phonologyNotes: [] };
  assert.equal(normalizeSpecialtyTags("creative", already), already);
  // 종합 점수 탭은 건드리지 않는다(standard·twin·parent-based — 'FINAL' 이 맞다)
  for (const type of ["standard", "twin", "parent-based"]) {
    const c = { name: "서윤", fullName: "김서윤", meaning: "", score: 86, tags: ["male"], phonologyNotes: [] };
    assert.equal(normalizeSpecialtyTags(type, c), c, type);
  }
});

test("/creative 단독 화면 — 서버 배열을 '창의' 이름표로 옮기고 점수는 서버 /search 매핑처럼 소수 한 자리", () => {
  const RES = [
    { name: "유슬", fullName: "김유슬", concept: "성씨와 이어지는 결", surnameConnection: "김 — 쇠의 단단함", meaning: "넉넉하고 맑은", story: "", creativityScore: 91.149999999999991, genderTag: "female", toneTag: "soft", surnameTailored: true },
    { name: "다온", fullName: "김다온", concept: "", surnameConnection: "", meaning: "좋은 일이 다 오는", story: "어디서든 좋은 소식을 데려오는 사람", creativityScore: 88, genderTag: "neutral", toneTag: "neutral", surnameTailored: false },
  ];
  const r = wrapCreativeResponse(RES, "김");
  assert.equal(r.totalCount, 2);
  assert.equal(r.categories[0].type, "creative");
  assert.equal(r.topPick?.candidate.fullName, "김유슬");
  const [a, b] = r.categories[0].names;
  assert.equal(a.score, 91.1);
  assert.equal(a.scoreLabel, "창의");
  assert.equal(r.topPick?.candidate.scoreLabel, "창의", "Top Pick 머리도 '창의 점수 · 100점 만점'");
  assert.equal(a.story, undefined, "빈 서사는 숨긴다");
  assert.equal(b.story, "어디서든 좋은 소식을 데려오는 사람");
  assert.deepEqual(a.tags, ["성씨와 이어지는 결", "김 — 쇠의 단단함"]);
  assert.deepEqual(b.tags, [], "빈 칩은 싣지 않는다");
  for (const bad of [null, undefined, {}, "x", []]) assert.equal(wrapCreativeResponse(bad, "김").totalCount, 0);
  const src = read("app/creative/page.tsx");
  assert.ok(src.includes("wrapCreativeResponse(data, query.lastName)"), "단독 화면이 공용 어댑터를 쓴다");
  assert.doesNotMatch(src, /"(Male|Female|Soft|Strong|Neutral)"/, "성별·톤은 다른 단독 화면처럼 소문자(specialtyGenderTone)");
  assert.ok(src.includes("...specialtyGenderTone(query.gender, query.tone)"));
});

// ------------------------------------------------------------
// labels-specialty
// ------------------------------------------------------------

test("네 화면의 라벨이 모두 칸과 이어진다 — <Label htmlFor> ↔ 칸 id, 선택 상자는 SelectTrigger id", () => {
  for (const page of PAGES) {
    const src = read(page);
    const labels = [...src.matchAll(/<Label\b([^>]*)>/g)].map((m) => m[1]);
    assert.ok(labels.length >= 3, `${page}: 라벨을 찾지 못했다`);
    const ids = new Set([...src.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const fors = [];
    for (const attrs of labels) {
      const m = /htmlFor="([^"]+)"/.exec(attrs);
      assert.ok(m, `${page}: htmlFor 없는 라벨 <Label${attrs}>`);
      assert.ok(ids.has(m[1]), `${page}: 라벨 '${m[1]}' 과 이어질 칸 id 가 없다`);
      fors.push(m[1]);
    }
    assert.equal(new Set(fors).size, fors.length, `${page}: 한 칸에 라벨 둘`);
    const triggers = [...src.matchAll(/<SelectTrigger\b([^>]*)>/g)].map((m) => m[1]);
    assert.ok(triggers.length >= 2, `${page}: 선택 상자를 찾지 못했다`);
    for (const attrs of triggers) {
      const m = /\bid="([^"]+)"/.exec(attrs);
      assert.ok(m && fors.includes(m[1]), `${page}: 라벨과 이어지지 않은 선택 상자 <SelectTrigger${attrs}>`);
    }
  }
});

// ------------------------------------------------------------
// form-snapshot-specialty
// ------------------------------------------------------------

test("결과 화면은 제출 때 잡아 둔 값만 쓴다 — 조건 칩·'상세 보기'·저장", () => {
  for (const page of PAGES) {
    const src = read(page);
    assert.match(src, /interface SubmittedQuery \{/, `${page}: 제출값 스냅샷`);
    assert.match(src, /setResult\(\{ data: wrap\w+\(data, query\.lastName\), query \}\)|showResult\(\{\s*data: wrapAsSmartResponse\(/, `${page}: 결과와 스냅샷을 한 상태로`);
    assert.match(src, /const q = result\.query;/, `${page}`);
    assert.match(src, /lastName: q\.lastName,/, `${page}: 조건 칩의 성씨`);
    assert.match(src, /\.\.\.requestChipLabels\(q\.gender, q\.tone\)/, `${page}: 조건 칩의 성별·톤`);
    assert.match(src, /navDetail\(q\.lastName, fn,/, `${page}: '상세 보기'`);
    assert.doesNotMatch(src, /navDetail\(lastName\b/, `${page}: 살아 있는 성씨 칸을 읽지 않는다`);
    assert.doesNotMatch(src, /favoriteContext=\{\{ gender, tone \}\}/, `${page}: 살아 있는 성별·톤을 저장하지 않는다`);
    assert.doesNotMatch(src, /\? "남"/, `${page}: 칩 이름표는 공용 함수로`);
    assert.match(src, /if \(loading\) return;/, `${page}: 기다리는 동안 다시 보내지 않는다`);
  }
  for (const page of PAGES.slice(0, 3)) {
    assert.ok(read(page).includes("favoriteContext={{ gender: q.gender, tone: q.tone }}"), page);
  }
  const rc = read("app/required-char/page.tsx");
  assert.ok(rc.includes("const ctx = { birthDate: q.birthDate, birthTime: q.birthTime, gender: q.gender, tone: q.tone };"));
  assert.ok(rc.includes("date: q.birthDate || undefined,"));
});

test("조건 칩 이름표 — 폼 값 → 한글", () => {
  assert.deepEqual(requestChipLabels("none", "neutral"), { gender: undefined, tone: "중립" });
  assert.deepEqual(requestChipLabels("male", "soft"), { gender: "남", tone: "부드러움" });
  assert.deepEqual(requestChipLabels("female", "strong"), { gender: "여", tone: "강함" });
  assert.deepEqual(requestChipLabels("constructor", "toString"), { gender: undefined, tone: "중립" }, "Object 내장 이름이 새지 않는다");
});

test("성씨 칸 — lib/name-input 규칙(다듬어 보내고, 한글 1~2자가 아니면 막는다)", () => {
  assert.deepEqual(checkSpecialtySurname(" 김 "), { value: "김", error: null });
  assert.deepEqual(checkSpecialtySurname("남궁"), { value: "남궁", error: null });
  assert.equal(checkSpecialtySurname("").error, SURNAME_REQUIRED);
  assert.equal(checkSpecialtySurname("   ").error, "성씨를 입력해주세요.", "빈 칸 문구는 화면의 원래 문구");
  assert.match(checkSpecialtySurname("ㄱ").error, /낱자/);
  assert.match(checkSpecialtySurname("金").error, /한글로만/);
  assert.match(checkSpecialtySurname("Kim").error, /한글로만/);
  assert.match(checkSpecialtySurname("김 씨").error, /띄어 쓰지/);
  assert.match(checkSpecialtySurname("남궁김").error, /2글자까지/);
  assert.equal(checkSpecialtySurname("김".normalize("NFD")).value, "김");
  for (const page of PAGES) {
    const src = read(page);
    assert.ok(src.includes("checkSpecialtySurname(lastName)"), `${page}: 공용 검사`);
    assert.doesNotMatch(src, /lastName\.trim\(\)/, `${page}: 다듬기는 공용 검사가 한다`);
  }
});

// ------------------------------------------------------------
// required-char-input-feedback
// ------------------------------------------------------------

test("필수 글자 칸 — 한글 한 음절·한자 한 글자만, 아니면 이유를 알리고 막는다", () => {
  assert.deepEqual(checkRequiredCharInput("서"), { ok: true, kind: "hangul", char: "서" });
  assert.deepEqual(checkRequiredCharInput(" 서 "), { ok: true, kind: "hangul", char: "서" });
  assert.deepEqual(checkRequiredCharInput("서".normalize("NFD")), { ok: true, kind: "hangul", char: "서" });
  assert.deepEqual(checkRequiredCharInput("瑞"), { ok: true, kind: "hanja", char: "瑞" });
  // 호환 한자(金 U+F90A)·강희 부수(⾦ U+2FA6)는 통합 한자로 — 엔진·판정 API 가 같은 글자로 찾는다
  assert.deepEqual(checkRequiredCharInput("金"), { ok: true, kind: "hanja", char: "金" });
  assert.deepEqual(checkRequiredCharInput("⾦"), { ok: true, kind: "hanja", char: "金" });
  // 확장 A(BMP 안)는 받는다
  assert.equal(checkRequiredCharInput("㐀").ok, true);
  const no = (v) => {
    const r = checkRequiredCharInput(v);
    assert.equal(r.ok, false, JSON.stringify(v));
    return r.message;
  };
  assert.equal(no(""), REQUIRED_CHAR_REQUIRED);
  assert.equal(no("  "), "필수 글자를 입력해주세요.", "빈 칸 문구는 화면의 원래 문구");
  assert.equal(no("ㅈ"), "필수 글자는 ㄱ·ㅏ 같은 낱자 없이 완성된 한글로 입력해주세요.");
  assert.equal(no("ㅏ"), "필수 글자는 ㄱ·ㅏ 같은 낱자 없이 완성된 한글로 입력해주세요.");
  assert.equal(no("a"), REQUIRED_CHAR_NOT_USABLE);
  assert.equal(no("7"), REQUIRED_CHAR_NOT_USABLE);
  assert.equal(no("★"), REQUIRED_CHAR_NOT_USABLE);
  assert.equal(no("\uD840"), REQUIRED_CHAR_NOT_USABLE, "붙여 넣다 잘린 서로게이트 반쪽");
  assert.equal(no("서윤"), "필수 글자는 한 글자만 넣어 주세요.");
  // BMP 밖 한자(𠀀 U+20000)는 서버가 한 글자로 받지 못한다(400)
  assert.equal(no("\u{20000}"), REQUIRED_CHAR_OUTSIDE_BMP);
});

test("한자 필수 글자의 판정 — 사전에 없으면 막고, 이름에 피하는 글자(死)는 결과 위에 알린다(정적 데이터의 불용 표시와 같은 값)", () => {
  // 판정 API 의 hanja 는 정적 후보 파일과 같은 함수(HanjaFactMapper)로 만든다 — 정적 파일 '사'(c0ac.json)의 死 줄로 응답을 짓는다
  const sa = JSON.parse(fromFrontend("public/data/hanja-pick/v1/c0ac.json"));
  const deathRow = sa.hanja.find((h) => h.character === "死");
  assert.ok(deathRow && deathRow.forbidden === true, "데이터에 死 의 불용 표시가 있다");
  const ok = (fact) => ({ status: "ok", character: fact.character, hanja: fact, acceptedSyllables: ["사"], message: null, suggestion: null });
  const death = requiredHanjaVerdict(ok(toHanjaFact(deathRow)), "死");
  assert.ok("notice" in death && death.notice, "막지 않고 알린다");
  assert.equal(death.notice, "‘死’(죽을 사)는 이 사이트가 이름에 피하는 글자로 두는 한자예요. 넣은 글자 그대로 추천했지만, 다른 추천에서는 이 글자를 고르지 않아요.");

  const seo = JSON.parse(fromFrontend("public/data/hanja-pick/v1/c11c.json")).hanja.find((h) => h.character === "瑞");
  assert.deepEqual(requiredHanjaVerdict(ok(toHanjaFact(seo)), "瑞"), { notice: null }, "보통 글자는 안내 없음");
  const noGloss = { ...toHanjaFact(seo), character: "㦳", gloss: "", hasMeaning: false };
  assert.match(requiredHanjaVerdict(ok(noGloss), "㦳").notice, /한글 뜻 풀이가 없어요/);
  // 조사는 훈의 괄호 독음을 떼고 고른다 — '오얏 리(이)' → '는'
  assert.match(requiredHanjaVerdict(ok({ ...toHanjaFact(deathRow), character: "李", gloss: "오얏 리(이)" }), "李").notice, /^‘李’\(오얏 리\(이\)\)는 /);

  const missing = requiredHanjaVerdict({ status: "not_in_dictionary", character: "丨", hanja: null, acceptedSyllables: [], message: "…", suggestion: null }, "丨");
  assert.ok("block" in missing);
  assert.match(missing.block, /^‘丨’ 글자는 이 사이트 한자 사전에 없어/);
  assert.match(missing.block, /사전에 없다고 인명용 한자가 아니라는 뜻은 아니에요/);
  // 사전 밖 글자를 '출생신고에 쓸 수 없는 글자'·'대법원 목록에 없는 글자'라고 쓰지 않는다(사전 9,105자가 대법원 목록을 다 싣지 못한다)
  assert.doesNotMatch(missing.block, /출생신고|대법원/);
  const withSuggestion = requiredHanjaVerdict({ status: "not_in_dictionary", character: "姬", hanja: null, acceptedSyllables: [], message: "…", suggestion: { ...toHanjaFact(seo), character: "姫" } }, "姬");
  assert.match(withSuggestion.block, /모양만 조금 다른 ‘姫’ 글자는 사전에 있어요/);
  assert.deepEqual(requiredHanjaVerdict({ status: "not_hanja", character: null, hanja: null, acceptedSyllables: [], message: "…", suggestion: null }, "x"), { block: REQUIRED_CHAR_NOT_USABLE });
  // 판정을 받지 못하면(망 오류) 막지 않는다 — 주의만 없다
  assert.deepEqual(requiredHanjaVerdict(null, "死"), { notice: null });
});

test("한자가 없는 음절(봄·몰) 안내 — 색인(index.json)으로 판정, 한자가 있는 음절은 안내 없음", () => {
  const idx = JSON.parse(fromFrontend("public/data/hanja-pick/v1/index.json"));
  assert.equal(idx.syllables["봄"], undefined, "봄 — 사전에 그 소리로 읽는 한자가 없다");
  assert.equal(idx.syllables["몰"].usable, 0, "몰 — 쓸 글자가 모두 이름에 피하는 글자");
  assert.ok(idx.syllables["서"].usable > 0);
  assert.equal(requiredSyllableNote("봄"), "‘봄’ 음절은 이 사이트 사전에 그 소리로 읽는 한자가 없어 한글로 써요. 한자 후보는 짝 글자에만 붙어요.");
  assert.equal(requiredSyllableNote("몰"), "‘몰’ 음절은 이름에 쓸 만한 인명용 한자가 없어 한글로 두기를 권해요. 한자 후보는 짝 글자에만 붙어요.");
  for (const v of ["서", "사", "", "ㅂ", "瑞", "봄봄", null, undefined]) assert.equal(requiredSyllableNote(v), null, String(v));
  // 색인의 음절 전체 — usable 0 이거나 autoEmpty 인 음절만 안내한다
  for (const [s, info] of Object.entries(idx.syllables)) {
    assert.equal(requiredSyllableNote(s) !== null, info.usable === 0 || info.autoEmpty === true, s);
  }
});

test("/required-char 화면 — 검사·판정·안내를 그 순서로 쓴다", () => {
  const src = read("app/required-char/page.tsx");
  assert.ok(src.includes("const req = checkRequiredCharInput(reqChar);"));
  assert.doesNotMatch(src, /isHanjaChar\(/, "옛 BMP 정규식 판정은 지웠다(공용 판정 — 서버와 같은 범위)");
  assert.ok(src.includes("requiredHanjaVerdict(await judgeHanja(req.char), req.char)"));
  assert.ok(src.includes("await hanjaResolve({ text: ch })"), "판정 API 에는 정리한 한 글자만 보낸다");
  // 막을 때는 추천 요청을 보내지 않는다 — 판정이 요청보다 먼저
  assert.ok(src.indexOf("requiredHanjaVerdict(") < src.indexOf("await requiredChar("));
  // 칸 아래 문제·안내, 결과 위 안내
  assert.match(src, /<p id="reqChar-error" className="text-xs text-amber-warm-700" role="alert">/);
  assert.match(src, /aria-describedby=\{\s*reqCharError \? "reqChar-error" : syllableHint \? "reqChar-hint" : undefined/);
  assert.ok(src.includes("const syllableHint = requiredSyllableNote(reqChar);"));
  assert.ok(src.includes("list.every((c) => (c.hanjaOptions?.length ?? 0) <= 1)"), "결과 위 '봄' 안내는 실제로 짝 글자 한자만 붙은 결과일 때만");
  assert.match(src, /\{q\.notice && \(/);
});

// ------------------------------------------------------------
// specialty-meta-counts — 세는 방법을 여기 남긴다
// ------------------------------------------------------------

/** 3글자 큐레이션 사전 = data/three-syllable-curated.json 의 entries 에서 서로 다른 name 수(ThreeSyllableCuratedLoader 가 읽는 파일) */
function countThreeSyllableCurated() {
  const data = JSON.parse(fromRepo("data/three-syllable-curated.json"));
  return new Set(data.entries.map((e) => e.name)).size;
}

/**
 * 순우리말 사전 = PureKoreanNameEngine.BuildDictionary() 의 new("이름", …) 줄에서 서로 다른 이름 수.
 * 같은 이름이 두 번 실린 줄(늘봄·우람 등 19개)은 엔진이 이름으로 묶어(GroupBy) 한 번만 쓴다 — 줄 수(326)가 아니라 이름 수를 센다.
 */
function countPureKoreanDictionary() {
  const src = fromRepo("Application/Engines/PureKoreanNameEngine.cs");
  const start = src.indexOf("private static List<PureKoreanEntry> BuildDictionary()");
  assert.ok(start > 0, "BuildDictionary 를 찾지 못했다");
  const body = src.slice(start, src.indexOf("};", start));
  const names = [...body.matchAll(/^\s*new\("([^"]+)"/gm)].map((m) => m[1]);
  return { rows: names.length, distinct: new Set(names).size };
}

test("메타 설명의 사전 개수 = 실제 데이터를 센 값(검색 스니펫·공유 카드)", () => {
  const three = countThreeSyllableCurated();
  const pure = countPureKoreanDictionary();
  assert.ok(three > 100 && pure.distinct > 200, "센 값이 비정상");
  assert.ok(pure.rows >= pure.distinct);

  const ts = read("app/three-syllable/layout.tsx");
  assert.ok(ts.includes(`3음절 이름 큐레이션 사전 ${three}개에서`), `three-syllable description = ${three}`);
  assert.ok(ts.includes(`"${three}개 큐레이션 3음절 이름에서`), `three-syllable OG = ${three}`);
  const pk = read("app/pure-korean/layout.tsx");
  assert.ok(pk.includes(`도담 등 ${pure.distinct}개 큐레이션 사전에서`), `pure-korean description = ${pure.distinct}`);
  assert.ok(pk.includes(`"${pure.distinct}개 큐레이션 사전에서`), `pure-korean OG = ${pure.distinct}`);
  // 설명에 든 보기 이름은 사전에 있는 이름이다
  const dict = fromRepo("Application/Engines/PureKoreanNameEngine.cs");
  for (const n of ["가람", "다솜", "한결", "도담"]) assert.ok(dict.includes(`new("${n}"`), n);
  // 메타는 숫자 말고는 그대로 — 둘 다 openGraph 에 BASE_OPEN_GRAPH 를 펼친다(얕은 병합)
  for (const src of [ts, pk]) assert.ok(src.includes("...BASE_OPEN_GRAPH,"));
});
