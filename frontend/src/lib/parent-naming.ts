/**
 * 부모 기반 작명 방식 코드 → 화면 칩(계승 꼴) — /parent-based 결과 화면이 쓴다.
 *
 * 왜 있나(2026-10-28): 옛 분류(detectNamingModel)는 nameType 의 '음운'·'의미' 부분 문자열만 봐서
 * nameType 이 늘 '의미중심'·'음운중심' 둘 중 하나였고 '가족 서사형' 칩은 코드상 나올 수 없었다.
 * 백엔드가 방식마다 계승 꼴을 정하고(ParentNamingModels — 음운중심·의미중심·서사중심) 중립 코드를 준다.
 * 코드 표를 먼저 보고, 모르는 코드(옛 응답·새 방식)는 nameType 부분 문자열로 폴백한다.
 * 백엔드 표(Application/Engines/IParentBasedNamingEngine.cs ParentNamingModels)와 함께 고칠 것.
 */

export type ParentLineageKey = "phonetic" | "semantic" | "narrative";

/** 방식 코드 → 칩 — 백엔드 ParentNamingModels 의 NameType 과 같은 분류 */
export const PARENT_MODEL_LINEAGE: Readonly<Record<string, ParentLineageKey>> = {
  "family-meaning": "semantic",
  "parent-initials": "phonetic",
  "parent-syllables": "phonetic",
  "shared-syllable": "narrative",
  "mother-initial": "phonetic",
  "father-initial": "phonetic",
  // 결과가 5개 미만일 때만 붙는 예비 경로 — 부모 이름의 첫 글자 밖 글자 + 실명 짝 글자
  "father-syllable": "phonetic",
  "mother-syllable": "phonetic",
  "mother-surname": "phonetic",
  "mother-sound": "phonetic",
  "keyword-meaning": "narrative",
  "keyword-sound": "narrative",
  "surname-meaning": "narrative",
};

export function parentLineage(namingModel: string | undefined, nameType: string | undefined): ParentLineageKey {
  const byCode = namingModel ? PARENT_MODEL_LINEAGE[namingModel] : undefined;
  if (byCode) return byCode;
  const nt = nameType || "";
  if (nt.includes("음운")) return "phonetic";
  if (nt.includes("의미")) return "semantic";
  return "narrative";
}

/**
 * 카드 태그 — 사용자 라벨 하나. 라벨이 없으면(옛 응답) 태그를 비운다 — 방식 코드나 옛 사람 이름 꼴 값을 화면에 내지 않는다
 */
export function parentTags(namingLabel: string | undefined | null): string[] {
  return namingLabel ? [namingLabel] : [];
}

/**
 * 스토리 키워드에 한글 음절이 있는지 — 없으면(영문·숫자·자모만: 'tree'·'Love'·'123'·'ㅋㅋ') 제출 전에 막는다.
 * 백엔드는 키워드의 한글 낱말로만 뜻·소리를 찾아(ParentBasedNamingEngine.KeywordTokens) 이런 키워드는 아무 후보도 만들지 못한다 —
 * 부모 이름이 없으면 성씨 뜻 잇기 예비 경로만 남거나 0개였다(2026-10-28 검증: 'tree'·'Love'·'123' 0개)
 */
export function keywordHasHangul(keyword: string): boolean {
  return /[가-힣]/.test(keyword);
}

/** 한글 없는 키워드 안내 — /parent-based 오류 상자 */
export const KEYWORD_HANGUL_REQUIRED =
  "스토리 키워드는 한글로 적어 주세요(예: 사랑, 희망, 빛).";

export type ParentRole = "father" | "mother";

/**
 * 부모 이름 뜻 잇기(family-meaning) 이름의 음절마다 그 음절을 준 부모 — 백엔드 설명 문장의 "아버지 이름의 '민'…, 어머니 이름의 '서'…"
 * 순서를 그대로 읽는다(ParentBasedNamingEngine.FamilyMeaning 의 설명 꼴). 설명에서 못 찾은 음절은 이름 칸에서 찾고(아버지 먼저 — 옛 동작), 그래도 없으면 null.
 *
 * 왜 있나(2026-10-28 2차 검증): 배너 주석은 아이 음절을 아버지 이름에서 먼저 찾아 아버지에게 붙였다 — 한 음절이 두 부모 이름에 다 있으면
 * (아버지 민수 + 어머니 수진 → '수민', 설명은 "어머니 이름의 '수'…") 어머니가 준 '수'를 아버지 글자로 칠했다.
 */
export function familyMeaningRoles(
  description: string,
  childChars: readonly string[],
  fatherGiven: string,
  motherGiven: string
): (ParentRole | null)[] {
  const fromDesc: { role: ParentRole; syllable: string }[] = [];
  for (const m of description.matchAll(/(아버지|어머니) 이름의 '([가-힣])'/g)) {
    fromDesc.push({ role: m[1] === "아버지" ? "father" : "mother", syllable: m[2] });
  }
  const used = new Set<number>();
  return childChars.map((ch) => {
    const k = fromDesc.findIndex((d, i) => !used.has(i) && d.syllable === ch);
    if (k >= 0) {
      used.add(k);
      return fromDesc[k].role;
    }
    if (fatherGiven.includes(ch)) return "father";
    if (motherGiven.includes(ch)) return "mother";
    return null;
  });
}
