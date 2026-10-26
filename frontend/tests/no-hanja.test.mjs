// 쓸 만한 인명용 한자가 없는 음절 안내 테스트 — `npm test`
//
// 2026-10-26 L4: 그 독음 글자가 모두 부정 훈인 음절(몰 沒·歿 · 핍 偪·逼 · 괵 馘 …)을 불용으로 넣으면 /evaluate·/name-analysis 가 그 음절에
// 후보를 하나도 내지 않는다. 순한글 음절(쁨·똘·솜 — 그 독음 인명용 한자 0자)이 이미 같은 경로였는데, 옛 화면은 /evaluate 에
// '쁨 음절 · 0개' 빈 상자를 그리고 /analysis 는 카드를 걸러 음절이 말없이 사라졌다. 지금 응답 필드(빈 배열)만으로 한 줄 안내를 그린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hasNoHanja, isNameUsableRecord, noHanjaSyllableNote } from "../src/lib/no-hanja.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8");

test("안내 문장 — 음절을 따옴표로 밝히고 한글로 두기를 권한다", () => {
  assert.equal(noHanjaSyllableNote("쁨"), "‘쁨’ 음절은 이름에 쓸 만한 인명용 한자가 없어 한글로 두기를 권해요.");
  assert.equal(noHanjaSyllableNote("몰"), "‘몰’ 음절은 이름에 쓸 만한 인명용 한자가 없어 한글로 두기를 권해요.");
  // '없다'고 단정하는 대상은 '쓸 만한' 인명용 한자 — 불용으로 뺀 글자가 사전에 남아 있는 음절(몰 — 沒·歿)에서도 참이어야 한다
  assert.match(noHanjaSyllableNote("몰"), /쓸 만한 인명용 한자가 없어/);
});

test("후보 0 판정 — 빈 배열·없는 배열만", () => {
  assert.equal(hasNoHanja([]), true);
  assert.equal(hasNoHanja(undefined), true);
  assert.equal(hasNoHanja(null), true);
  assert.equal(hasNoHanja([{ character: "訥" }]), false);
});

test("/evaluate 후보 표는 후보 0 음절에 '0개' 빈 상자 대신 안내 한 줄", () => {
  const src = read("src", "components", "design", "EvalBody.tsx");
  assert.match(src, /hasNoHanja\(g\.candidates\) && \(/);
  assert.match(src, /noHanjaSyllableNote\(g\.syllable\)/);
  // 0개일 때는 '· 0개' 를 붙이지 않는다
  assert.match(src, /hasNoHanja\(g\.candidates\) \? `\$\{g\.syllable\} 음절` :/);
});

test("/analysis 한자 분석은 후보 0 음절을 걸러 내지 않고 안내 카드로 그린다", () => {
  const detail = read("src", "components", "design", "DetailHanja.tsx");
  assert.doesNotMatch(detail, /\.filter\(\(b\) => b\.possibleHanja\.length > 0\)/); // 옛 코드 — 음절이 말없이 빠졌다
  assert.match(detail, /hasNoHanja\(b\.possibleHanja\) \? \(\s*<NoHanjaCard/);
  assert.match(detail, /noHanjaSyllableNote\(syllable\)/);

  const page = read("src", "app", "analysis", "page.tsx");
  assert.doesNotMatch(page, /hanjaBreakdown\.some\(\(b\) => b\.possibleHanja\.length > 0\)/);
  assert.match(page, /const hasHanjaSection = hanjaBreakdown\.length > 0;/);
});
test("이름에 쓰는 글자 판정 — 불용(nf)이 아니고 뜻(m)이 있는 글자만(백엔드 HanjaSelector.OrderForDisplay 와 같은 판정)", () => {
  assert.equal(isNameUsableRecord({ m: "기를 육" }), true);
  assert.equal(isNameUsableRecord({ m: "살찔 눌", wk: 1 }), true); // weak 는 대안 없는 음절에서 남는다(눌=肭)
  assert.equal(isNameUsableRecord({ m: "핍박할 핍", nf: 1 }), false);
  assert.equal(isNameUsableRecord({}), false); // 뜻 없는 글자(畐·沑)
  assert.equal(isNameUsableRecord(undefined), false);
});

test("/hanja 독음 페이지 — 뜻 없는 글자만 남은 독음(핍·뉵)은 추천 버튼을 두지 않고 한글로 두기를 권한다", () => {
  // 데이터: 이 경우가 실제로 있는지(불용 10차 뒤 핍=畐·뉵=沑 만 남음 — 세트가 바뀌면 사례를 다시 고를 것)
  const data = JSON.parse(read("src", "data", "hanja-seo.json"));
  const byReading = new Map();
  for (const [c, r] of Object.entries(data)) for (const rd of r.r) byReading.set(rd, [...(byReading.get(rd) ?? []), c]);
  for (const reading of ["핍", "뉵"]) {
    const chars = byReading.get(reading);
    const usable = chars.filter((c) => data[c].nf !== 1);
    assert.ok(usable.length > 0, `${reading}: 불용 아닌 글자가 있어야 이 사례다`);
    assert.equal(chars.filter((c) => isNameUsableRecord(data[c])).length, 0, `${reading}: 이름에 쓰는 글자가 없어야 한다`);
  }
  assert.ok(byReading.get("눌").some((c) => isNameUsableRecord(data[c])), "눌은 肭(weak)이 남아 버튼이 있다");

  // 페이지: 버튼 조건이 '불용 아님'이 아니라 '이름에 쓰는 글자'이고, 그런 독음에 안내 문장을 붙인다
  const page = read("src", "app", "hanja", "[slug]", "page.tsx");
  assert.match(page, /const named = usable\.filter\(\(c\) => isNameUsableRecord\(getHanja\(c\)\)\);/);
  assert.match(page, /\{named\.length > 0 && \(\s*<CtaBanner/);
  assert.doesNotMatch(page, /\{usable\.length > 0 && \(\s*<CtaBanner/); // 옛 조건 — 뜻 없는 畐 하나로 버튼이 나왔다
  assert.match(page, /usable\.length > 0 && named\.length === 0 && \([\s\S]{0,400}noHanjaSyllableNote\(reading\)/);
});
