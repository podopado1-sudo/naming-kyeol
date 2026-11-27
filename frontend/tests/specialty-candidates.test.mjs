// 3글자·순우리말 단독 화면 어댑터 테스트 — `npm test`
//
// 2026-11-27 에 고친 것(lib/specialty-candidates.ts 머리말): 두 단독 화면은 응답 꼴을 잘못 읽어 결과를 한 번도 그리지 못했다.
//   /three-syllable — 서버는 후보 배열을 주는데 {names,totalCount} 로 읽어 늘 '추천 결과를 찾지 못했어요'.
//   /pure-korean    — 서버는 {lastName, candidates, totalCount} 를 주는데 names 를 읽어 '총 10개 후보'인데 카드 0장.
// 그리고 /search 의 같은 탭 칩에 서버 영문 코드(male·soft·neutral·pure-korean·hanja·mixed)가 그대로 보였다.
// 아래 표본은 로컬 API(2026-11-26) 응답에서 앞 몇 개를 그대로 옮긴 것이다(필드 이름·값 모양 그대로).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./resolve-ts.mjs";

const {
  wrapThreeSyllableResponse,
  wrapPureKoreanResponse,
  normalizeSpecialtyTags,
  specialtyGenderTone,
} = await import("../src/lib/specialty-candidates.ts");

const read = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

// POST /recommendations/three-syllable {lastName:"김", gender:"male", tone:"neutral", nameType:"mixed"} 앞 3개 + 6번째
const THREE = [
  { name: "누리서", fullName: "김누리서", meaning: "세상의 서광", nameType: "mixed", components: ["누리", "서"], pronunciationScore: 75.5, genderTag: "neutral", toneTag: "neutral", phonologyNotes: [] },
  { name: "마루준", fullName: "김마루준", meaning: "꼭대기의 준수함", nameType: "mixed", components: ["마루", "준"], pronunciationScore: 72, genderTag: "male", toneTag: "strong", phonologyNotes: [] },
  { name: "하늘빈", fullName: "김하늘빈", meaning: "하늘의 빛(빈)", nameType: "mixed", components: ["하늘", "빈"], pronunciationScore: 61.849999999999994, genderTag: "neutral", toneTag: "soft", phonologyNotes: [] },
  { name: "온누주", fullName: "김온누주", meaning: "온 세상(고어) + 임금 주/주인 주/심지 주", nameType: "mixed", components: ["온누", "主(주)"], pronunciationScore: 61.599999999999994, genderTag: "neutral", toneTag: "neutral", phonologyNotes: [{ id: "x", name: "이름", message: "메시지", position: 1 }] },
];

// POST /recommendations/pure-korean {lastName:"김", gender:"male", tone:"neutral"} 앞 4개
const PURE = {
  lastName: "김",
  candidates: [
    { fullName: "김우람", name: "우람", meaning: "우람하고 당당한", origin: "우람하다 — 크고 당당한 모습", genderFit: "male", toneFit: "strong", pronunciationScore: 79 },
    { fullName: "김오름", name: "오름", meaning: "높이 오르는", origin: "오르다의 명사형 — 상승", genderFit: "male", toneFit: "strong", pronunciationScore: 79 },
    { fullName: "김아름", name: "아름", meaning: "아름다움", origin: "아름답다 — 어근 + 명사화", genderFit: "neutral", toneFit: "soft", pronunciationScore: 79 },
    { fullName: "김이슬", name: "이슬", meaning: "아침 이슬처럼 맑고 깨끗한", origin: "이슬 — 새벽에 맺히는 물방울", genderFit: "neutral", toneFit: "neutral", pronunciationScore: 78 },
  ],
  totalCount: 10, // 서버는 요청 개수를 적는다 — 화면은 옮긴 카드 수를 써야 '총 N개'와 카드가 맞는다
};

const ENGLISH_CODE = /^(male|female|neutral|soft|strong|pure-korean|hanja|mixed|none)$/;

test("3글자: 서버 배열 응답을 카드로 옮긴다 — 옛 어댑터는 늘 0개였다", () => {
  const r = wrapThreeSyllableResponse(THREE, "김");
  assert.equal(r.totalCount, 4);
  assert.equal(r.categories.length, 1);
  assert.equal(r.categories[0].type, "three-syllable");
  const names = r.categories[0].names;
  assert.deepEqual(names.map((n) => n.fullName), ["김누리서", "김마루준", "김하늘빈", "김온누주"]);
  assert.equal(r.topPick?.candidate.fullName, "김누리서");
  // 부동소수 꼬리를 소수 한 자리로(서버 /search 매핑과 같다)
  assert.equal(names[2].score, 61.8);
  assert.equal(names[0].score, 75.5);
  // 칩: 한글 유형 + '3글자'만 — 조합 조각('온누'·'主(주)')과 영문 코드는 싣지 않는다
  for (const n of names) {
    assert.deepEqual(n.tags, ["혼합", "3글자"]);
    assert.ok(!n.tags.some((t) => ENGLISH_CODE.test(t)));
  }
  assert.equal(names[3].phonologyNotes.length, 1);
  assert.deepEqual(names[0].reasons, []);
});

test("3글자: 배열이 아닌 응답·빈 배열은 빈 결과(0개)로 — 화면이 '찾지 못했어요'를 그린다", () => {
  for (const bad of [null, undefined, {}, { names: [] }, "x", []]) {
    const r = wrapThreeSyllableResponse(bad, "김");
    assert.equal(r.totalCount, 0);
    assert.equal(r.topPick, null);
  }
});

test("순우리말: candidates 를 카드로 옮기고 totalCount 는 옮긴 수 — 옛 어댑터는 '총 10개'에 카드 0장", () => {
  const r = wrapPureKoreanResponse(PURE, "김");
  assert.equal(r.totalCount, 4);
  const names = r.categories[0].names;
  assert.equal(r.categories[0].type, "pure-korean");
  assert.deepEqual(names.map((n) => n.fullName), ["김우람", "김오름", "김아름", "김이슬"]);
  assert.equal(r.topPick?.candidate.name, "우람");
  // 성별 칩은 싣지 않는다 — 엔진 사전의 genderFit 이 출생 통계와 어긋나는 이름이 있다(이삭 female). 톤 칩은 한글 이름표
  assert.deepEqual(names[0].tags, ["힘 있는 결", "순우리말"]);
  assert.deepEqual(names[2].tags, ["부드러운 결", "순우리말"]);
  assert.deepEqual(names[3].tags, ["중간 결", "순우리말"]);
  assert.equal(names[0].score, 79);
  assert.equal(names[0].scoreLabel, "발음");
  // 평가 링크 한자: 음절마다 '-'(한자 없이 한글로) — 빼면 /evaluate 가 理璱 같은 한자를 골라 채점한다
  assert.equal(names[0].evaluateHanja, "--");
  assert.equal(names[0].hanja, undefined, "카드의 한자 자리는 비운다(한글 이름을 그대로)");
});

test("순우리말: fullName 이 비면 성 + 이름, 꼴이 다른 응답은 빈 결과", () => {
  const r = wrapPureKoreanResponse({ candidates: [{ ...PURE.candidates[0], fullName: "" }] }, "선우");
  assert.equal(r.categories[0].names[0].fullName, "선우우람");
  for (const bad of [null, undefined, [], { names: [{ name: "x" }] }, { candidates: "x" }]) {
    assert.equal(wrapPureKoreanResponse(bad, "김").totalCount, 0);
  }
});

test("/search 탭: 서버가 보낸 영문 칩을 단독 화면과 같은 이름표로 — 다른 탭·이미 한글인 칩은 그대로", () => {
  const pk = normalizeSpecialtyTags("pure-korean", { name: "이슬", fullName: "김이슬", meaning: "", tags: ["neutral", "soft", "순우리말"], phonologyNotes: [] });
  assert.deepEqual(pk.tags, ["부드러운 결", "순우리말"]);
  assert.equal(pk.scoreLabel, "발음");
  assert.equal(pk.evaluateHanja, "--");
  const pk2 = normalizeSpecialtyTags("pure-korean", { name: "우람", fullName: "김우람", meaning: "", tags: ["male", "strong", "순우리말"], phonologyNotes: [] });
  assert.deepEqual(pk2.tags, ["힘 있는 결", "순우리말"]);
  // 서버 /search 3글자 칩 = [nameType, '3글자', ...조합 요소] — 조합 요소로 평가 링크 한자를 짓는다
  const ts = normalizeSpecialtyTags("three-syllable", { name: "솔바람", fullName: "김솔바람", meaning: "", tags: ["pure-korean", "3글자", "솔바", "람"], phonologyNotes: [] });
  assert.deepEqual(ts.tags, ["순우리말", "3글자"]);
  // '바'는 사전에 독음이 없어 서버가 '-'를 '지정 없음'으로 접는다 → 서버 꼴 그대로 '-*-'
  assert.equal(ts.evaluateHanja, "-*-");
  const tsMixed = normalizeSpecialtyTags("three-syllable", { name: "온누주", fullName: "김온누주", meaning: "", tags: ["mixed", "3글자", "온누", "主(주)"], phonologyNotes: [] });
  assert.equal(tsMixed.evaluateHanja, "--主");
  assert.equal(tsMixed.hanja, undefined);
  const already = { name: "누리서", fullName: "김누리서", meaning: "", tags: ["혼합", "3글자"], phonologyNotes: [] };
  assert.equal(normalizeSpecialtyTags("three-syllable", already), already);
  const std = { name: "서윤", fullName: "김서윤", meaning: "", tags: ["male", "soft"], phonologyNotes: [] };
  assert.equal(normalizeSpecialtyTags("standard", std), std);
  // Object 내장 이름이 이름표로 새지 않는다
  const odd = { name: "가", fullName: "김가", meaning: "", tags: ["constructor", "toString"], phonologyNotes: [] };
  assert.equal(normalizeSpecialtyTags("pure-korean", odd), odd);
  assert.equal(normalizeSpecialtyTags("three-syllable", odd), odd);
});

test("요청 성별·톤은 소문자 — 'none' 은 보내지 않는다", () => {
  assert.deepEqual(specialtyGenderTone("none", "neutral"), { gender: undefined, tone: "neutral" });
  assert.deepEqual(specialtyGenderTone("male", "soft"), { gender: "male", tone: "soft" });
  assert.deepEqual(specialtyGenderTone("female", "strong"), { gender: "female", tone: "strong" });
});

test("두 화면이 공용 어댑터를 쓴다 — 옛 res.names 읽기·대문자 enum·'성씨 포함' 문구가 돌아오지 않는다", () => {
  for (const [page, wrap] of [["app/three-syllable/page.tsx", "wrapThreeSyllableResponse"], ["app/pure-korean/page.tsx", "wrapPureKoreanResponse"]]) {
    const src = read(page);
    assert.ok(src.includes(`${wrap}(data`), `${page}: ${wrap} 로 옮긴다`);
    assert.ok(!/res\.names/.test(src), `${page}: res.names 를 읽지 않는다`);
    assert.ok(!/NameRecommendationResponse/.test(src), `${page}: 서버에 없는 응답 꼴`);
    assert.ok(!/"(Male|Female|Soft|Strong|Neutral)"/.test(src), `${page}: 대문자 enum 을 보내지 않는다`);
  }
  assert.ok(!/성씨 포함|성씨를 포함해/.test(read("app/three-syllable/page.tsx")), "엔진은 성 + 세 음절(김누리서)이다");
  assert.ok(!/NameRecommendationResponse/.test(read("lib/api.ts")));
  // /search 결과 화면도 같은 이름표를 쓴다
  assert.ok(read("components/design/SmartResult.tsx").includes("normalizeSpecialtyTags(cat.type"));
});

test("3글자 평가 링크 한자 — 한자 조각은 그 한자, 두 음절 한글 조각·순우리말 유형은 '-', 한글 한 음절은 자동('*')", () => {
  const one = (name, nameType, components) =>
    wrapThreeSyllableResponse([{ name, fullName: `김${name}`, meaning: "", nameType, components, pronunciationScore: 70, phonologyNotes: [] }], "김")
      .categories[0].names[0];
  // 혼합 큐레이션(한자 조각 없음) — 서버가 앞 두 음절 + 끝 음절로 기계적으로 잘라(솔이슬 → 솔이 + 슬) 어느 음절이 한글인지 모른다 → 싣지 않는다
  assert.equal(one("누리서", "mixed", ["누리", "서"]).evaluateHanja, undefined);
  assert.equal(one("솔이슬", "mixed", ["솔이", "슬"]).evaluateHanja, undefined);
  // 혼합 생성 조합 — 한글 조각은 '한자 없이', 한자 조각은 그 한자
  assert.equal(one("이슬혜", "mixed", ["이슬", "惠(혜)"]).evaluateHanja, "--惠");
  // 혼합 — 온누 + 主(주): 한자 조각은 그 한자
  const onnu = one("온누주", "mixed", ["온누", "主(주)"]);
  assert.equal(onnu.evaluateHanja, "--主");
  assert.equal(onnu.hanja, undefined, "한자가 일부뿐이면 카드 한자 자리는 한글 이름 그대로");
  // 한자 — 모든 음절에 엔진 한자가 있으면 카드 한자 자리에도(옛 화면은 한글 '요호주'를 세리프로 다시 그렸다)
  const yoho = one("요호주", "hanja", ["耀(요)", "虎(호)", "主(주)"]);
  assert.equal(yoho.evaluateHanja, "耀虎主");
  assert.equal(yoho.hanja, "耀虎主");
  // 한자 — 큐레이션 이름(예준서)은 엔진이 한자를 주지 않는다 → 모두 자동 = 지정 없음(예전 링크 그대로)
  assert.equal(one("예준서", "hanja", ["예", "준", "서"]).evaluateHanja, undefined);
  // 순우리말 — 모두 '-'
  assert.equal(one("은하수", "pure-korean", ["은하", "수"]).evaluateHanja, "---");
  // 조각을 이어 이름과 다르면(모양을 모름) 싣지 않는다
  assert.equal(one("이슬미", "mixed", ["이슬", "惠(혜)"]).evaluateHanja, undefined);
  assert.equal(one("누리서", "mixed", []).evaluateHanja, undefined);
  assert.equal(one("요호주", "hanja", ["耀(요)", "虎(호)"]).evaluateHanja, undefined);
  for (const n of [onnu, yoho]) assert.equal(n.scoreLabel, "발음");
});

test("'상세 보기'·저장이 카드의 한자를 /evaluate 로 넘긴다", () => {
  for (const page of ["app/three-syllable/page.tsx", "app/pure-korean/page.tsx"]) {
    assert.match(read(page), /onCandidateDetail=\{\(fn, hanja\) => navDetail\(lastName, fn, \{ gender, tone, hanja \}\)\}/, page);
  }
  assert.match(read("lib/useCandidateDetail.ts"), /if \(ctx\?\.hanja\) params\.set\("hanja", ctx\.hanja\);/);
  assert.match(read("app/search/page.tsx"), /if \(evaluateHanja\) params\.set\("hanja", evaluateHanja\);/);
  const sr = read("components/design/SmartResult.tsx");
  assert.match(sr, /onCandidateDetail\?\.\(topPick\.candidate\.fullName, topPick\.candidate\.evaluateHanja\)/);
  assert.match(sr, /hanja: topHanja,/);
  assert.match(sr, /useIsFavorite\(rawTop\?\.fullName \?\? "", favBirthDate, topHanja\)/);
  // 점수 이름표 — 'FINAL' 고정 문구가 아니라 후보의 이름표
  assert.doesNotMatch(sr, />\s*FINAL\s*</);
});

test("평가 링크 한자는 서버가 돌려주는 꼴과 같다 — 서버가 '-'를 접는 음절(사전 독음 없음·자동 배정이 빈 음절)은 '*'", () => {
  // 서버(HanjaInput)는 사전에 독음이 없는 음절(바·봄·빛)과 쓸 글자가 모두 불용인 음절(색인 autoEmpty — 몰·괵)의 '-'를 '지정 없음'으로 접어
  // hanjaSummary.nameHanja 를 '*-' 꼴로 돌려주고, /evaluate 는 그 꼴로 주소·즐겨찾기 키를 쓴다. 카드에서도 같은 꼴이어야 한 항목이 된다
  const idx = JSON.parse(readFileSync(fileURLToPath(new URL("../public/data/hanja-pick/v1/index.json", import.meta.url)), "utf8"));
  const keeps = (s) => s in idx.syllables && idx.syllables[s].autoEmpty !== true;
  const pk = (name) => wrapPureKoreanResponse({ candidates: [{ name, fullName: `김${name}`, meaning: "", toneFit: "soft", pronunciationScore: 70 }] }, "김").categories[0].names[0].evaluateHanja;
  assert.equal(keeps("바"), false);
  assert.equal(keeps("몰"), false);
  assert.equal(keeps("이"), true);
  assert.equal(pk("바람"), "*-");
  assert.equal(pk("빛나"), "*-");
  assert.equal(pk("이슬"), "--");
  assert.equal(pk("나몰"), "-", "끝의 '*'는 주소 꼴에서 생략");
  assert.equal(pk("봄빛"), undefined, "모두 접히면 지정 없음 — 예전 링크 그대로");
});
