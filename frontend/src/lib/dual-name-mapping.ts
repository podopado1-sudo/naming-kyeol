/**
 * /dual-name 결과 카드의 영어 음절 칩과 매핑 줄("Ry ↔ 라(…) · a ↔ 이(…) · n ↔ 언(…)") — 표시용 어림 분할.
 * 발음을 맞추려는 게 아니라 영어 글자를 한국어 음절 수만큼 나눠 보여 줄 뿐이다.
 *
 * 왜 있나(2026-10-27): ceil(글자 수/음절 수)씩 앞에서 자르던 분할은 조각이 음절보다 적게 나올 수 있었다
 * (Ryan→라이언 [Ry, an], Olivia→올리비아 [Ol, iv, ia], Diana→다이아나, Aria→아리아 등
 * data/english_korean_names.json 147쌍 중 14쌍). 매핑 줄 끝에 화살표 왼쪽이 빈 '·  ↔ 언(…)'이 찍히고
 * 영어 칩이 한국어 칩보다 하나 적었다. 기본 목록(영어 이름 미입력)에도 Ryan·Olivia·Diana가 들어간다.
 */

/** 예전 규칙 — ceil(글자 수/음절 수) 크기로 앞에서부터 자른다 (음절 수보다 적게 나올 수 있다) */
function ceilChunks(eng: string, koreanLen: number): string[] {
  const chunkSize = Math.ceil(eng.length / koreanLen);
  const result: string[] = [];
  for (let i = 0; i < eng.length; i += chunkSize) {
    result.push(eng.slice(i, i + chunkSize));
  }
  return result;
}

/**
 * 영어 이름을 한국어 음절 수(koreanLen)만큼 나눈다.
 * - 글자 수 ≥ 음절 수면 언제나 빈 조각 없이 정확히 koreanLen 조각
 * - 예전 규칙이 이미 koreanLen 조각을 내던 이름(Michael [Mic, hae, l] 등 133쌍)은 그대로 둔다
 * - 모자라는 이름만 고르게 나눈다 — 나머지 글자는 앞 조각부터 하나씩 더 (Ryan → [Ry, a, n])
 * - 글자 수 < 음절 수면 음절마다 한 글자도 못 주므로 나누지 않고 통째로 한 칩 (1음절과 같은 모양).
 *   이때 매핑 줄은 buildMappingNote가 숨긴다
 */
export function splitEnglishToSyllables(
  eng: string,
  koreanLen: number
): string[] {
  if (!eng) return [];
  if (koreanLen <= 1 || eng.length < koreanLen) return [eng];
  const chunks = ceilChunks(eng, koreanLen);
  if (chunks.length === koreanLen) return chunks;
  const base = Math.floor(eng.length / koreanLen);
  const extra = eng.length % koreanLen;
  const result: string[] = [];
  let pos = 0;
  for (let i = 0; i < koreanLen; i++) {
    const size = base + (i < extra ? 1 : 0);
    result.push(eng.slice(pos, pos + size));
    pos += size;
  }
  return result;
}

/**
 * 카드의 매핑 줄 — 음절마다 "영어 조각 ↔ 한글(한자)"를 ' · '로 잇는다.
 * 영어 조각이 음절마다 하나씩 없으면(글자 수 < 음절 수) 빈 문자열 — 빈 쪽 화살표를 찍지 않는다.
 * DualCard는 빈 mappingNote를 내용 없는 div(높이 0)로 그려 카드에 자국이 남지 않는다.
 */
export function buildMappingNote(c: {
  englishEquivalent: string;
  koreanName: string;
  hanjaCharacters: string[];
}): string {
  if (!c.englishEquivalent || !c.hanjaCharacters.length) return "";
  const ko = [...c.koreanName];
  const eng = splitEnglishToSyllables(c.englishEquivalent, ko.length);
  if (eng.length !== ko.length) return "";
  const pairs = ko.map((k, i) => {
    const h = c.hanjaCharacters[i] ?? "";
    return `${eng[i]} ↔ ${k}${h ? `(${h})` : ""}`;
  });
  return pairs.join(" · ");
}
