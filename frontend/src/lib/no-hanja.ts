/**
 * 쓸 만한 인명용 한자가 없는 음절 안내 — /evaluate '한자 후보' 표(EvalBody HanjaCandidatesTable)와
 * /analysis '한자 분석'(DetailHanja HanjaBreakdown)이 후보가 0개인 음절 자리에 쓴다(2026-10-26 L4).
 *
 * 후보 0 은 지금 응답 필드로 안다 — /evaluate `hanjaCandidates[].candidates`, /name-analysis `hanjaBreakdown[].possibleHanja` 가
 * 빈 배열인 음절. 두 경우가 같은 문장이다:
 * - 그 독음으로 읽는 인명용 한자가 아예 없는 음절(순한글 음절 — 쁨·똘)
 * - 후보가 모두 불용(이름에 피하는 글자)이라 백엔드가 뺀 음절(L4 — 괵 馘·몰 沒·歿·훙 薨·핍 偪·逼 처럼 그 독음 글자가 모두 부정 훈일 때.
 *   눌은 吶·訥 이 불용이 됐어도 肭 '살찔'(weak — 대안 없는 약자는 남는다)이 있어 후보 0 음절이 아니다)
 * 둘 다 '이름에 쓸 만한 인명용 한자가 없다'가 맞다. 옛 화면은 /evaluate 에 '쁨 음절 · 0개' 빈 상자를, /analysis 에는 아무것도
 * 그리지 않았다(카드를 걸러 음절이 말없이 사라짐).
 * 새 응답 필드는 쓰지 않는다 — 백엔드가 그 음절의 묶음(빈 배열)을 계속 보내 주기만 하면 된다. 백엔드도 같은 음절에 `noHanjaNote`
 * (HanjaSelector.NoHanjaNoteFor — '이 음절은 이름에 쓸 만한 인명용 한자가 없어 한글로 두기를 권해요', 독음이 없는 순우리말 음절은
 * '이 음절은 인명용 한자 독음이 아니어서 한글로만 써요')를 싣지만 API 소비자용이고, 화면은 음절을 밝히는 이 문장 하나로 그린다
 * (두 경우 모두 참인 문장 — 같은 안내가 두 번 나오지 않게 noHanjaNote 는 그리지 않는다).
 */
export function noHanjaSyllableNote(syllable: string): string {
  return `‘${syllable}’ 음절은 이름에 쓸 만한 인명용 한자가 없어 한글로 두기를 권해요.`;
}

/** 후보가 하나도 없는 음절인지 — 배열이 없거나 비었으면 true */
export function hasNoHanja(candidates: readonly unknown[] | null | undefined): boolean {
  return !candidates || candidates.length === 0;
}

/**
 * /hanja 독음 페이지가 '이름에 쓰는 글자'로 세는 글자 — 불용(nf)이 아니고 사전 뜻(m)이 있는 글자.
 * 백엔드 판정(HanjaSelector.OrderForDisplay — 불용·뜻 없는 글자를 뺀다, NoHanjaNoteFor·HasUsableHanja)과 같다.
 * 이런 글자가 하나도 없는 독음은 백엔드가 '쓸 한자 없음'(배정 없음·한글로 두기)으로 다루므로 독음 페이지도 추천 버튼을 두지 않는다
 * (2026-10-26 보완 — 불용 10차 뒤 핍은 뜻 없는 畐, 뉵은 뜻 없는 沑 만 남았는데 '이름 추천받기' 버튼이 그대로 나왔다).
 */
export function isNameUsableRecord(record: { m?: string; nf?: 1 } | null | undefined): boolean {
  return !!record && record.nf !== 1 && !!record.m;
}
