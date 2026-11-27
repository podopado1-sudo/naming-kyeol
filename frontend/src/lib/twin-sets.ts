/**
 * 쌍둥이 이름 세트 — 응답을 화면 꼴로 바꾸고 테마별로 묶는다(순수 함수, tests/twin-sets.test.mjs).
 *
 * 2026-11-26 에 고친 것 두 가지가 여기 모여 있다.
 * ① 탭 중복: 서버는 조화도 높은 순으로 세트를 10개까지 준다(테마가 섞여 있다 — TwinNameService). 예전 화면은 세트마다
 *    탭을 하나씩 만들면서 key·이름표를 테마 이름으로만 줘서 '공유글자' 탭이 여섯 개씩 나란히 섰고, 같은 테마의 탭은
 *    모두 그 테마의 첫 세트만 보여 줬다(key 로 찾으니 첫 것만 걸린다 — 나머지 세트는 볼 길이 없었다).
 *    지금은 세트마다 고유한 id 를 주고, 탭은 테마당 하나, 테마 안의 세트는 이름으로 고른다.
 * ② 톤·성별 무시: 화면이 "Soft"·"Male" 처럼 대문자로 보냈는데 TwinNameController·TwinNameService 는 소문자로 바꾸지 않고
 *    TwinNameEngine 은 소문자와만 비교한다(tone == "soft") — 세트 고르기에서 톤·성별이 통째로 빠졌다
 *    (/required-char 가 2026-10-21 에 겪은 것과 같은 일). 소문자로 보낸다.
 *
 * 2026-11-27 에 더한 것(버그 목록 twin-result-wording·twin-detail-link-empty):
 * ③ 결과 머리가 입력과 달랐다 — 성별 칩은 늘 '미지정'(relation:'any' 고정), 성·자녀 수·톤은 제출값이 아니라 지금 폼 값,
 *    자녀가 3명이어도 '쌍둥이'·'한 쌍'·'두 이름'이었다. 칩·제목·조화도 문장을 제출 때 잡은 값과 자녀 수로 만든다.
 * ④ 카드 '상세 보기'가 이름도 조건도 없는 빈 /analysis 로 갔다 — 같은 조건(성·이름·출생일·시각·성별·톤)의 /evaluate 링크를 만든다.
 */
// node --test 가 이 파일을 바로 읽는다 — 값 import 는 별칭(@/) 대신 상대 경로로 쓴다(tests/resolve-ts.mjs 가 확장자를 붙여 찾는다)
import { evaluateHref } from "../app/evaluate/evaluate-params";
import { withJosa } from "./josa";
import type { TwinNameResponse, TwinNamesRequest } from "./types";
import type {
  TwinContext,
  TwinSharedType,
  TwinThemeBlock,
  TwinThemeKey,
} from "@/components/design/TwinResultTop";

const THEME_KEY_MAP: Record<string, TwinThemeKey> = {
  공유글자: "shared_char",
  공유의미: "shared_meaning",
  공유톤: "shared_tone",
};

const SHARED_TYPE_MAP: Record<string, TwinSharedType> = {
  공유글자: "char",
  공유의미: "meaning",
  공유톤: "tone",
};

const POSITIONS = ["첫째", "둘째", "셋째", "넷째"];

/**
 * 세트 조화도 문장. count 는 그 세트의 이름 수 — 세 이름 세트에 '두 이름'·'한 쌍'이라 쓰지 않는다(2026-11-27).
 * 두 이름 세트의 문장은 예전 그대로다.
 */
export function coherenceNote(score: number, count = 2): string {
  const three = count >= 3;
  if (score >= 85) return `${three ? "세" : "두"} 이름의 음운·의미·톤이 잘 맞물려요`;
  if (score >= 70) return three ? "한 세트로서 안정적인 결을 가져요" : "한 쌍으로서 안정적인 결을 가져요";
  if (score >= 55) return "참고용 후보 — 다른 세트도 확인해보세요";
  return "조화도가 낮아요. 조건을 바꿔보세요";
}

/** 자녀 수에 맞는 이름 — 3명이면 '세쌍둥이'(예전 화면은 3명에게도 '쌍둥이'였다) */
export function twinGroupWord(count: number): string {
  return count >= 3 ? "세쌍둥이" : "쌍둥이";
}

/** 결과 제목 — '김 씨 쌍둥이를 위한 이름 세트' / '김 씨 세쌍둥이를 위한 이름 세트' */
export function twinResultTitle(lastName: string, count: number): string {
  return `${lastName} 씨 ${withJosa(twinGroupWord(count), "을/를")} 위한 이름 세트`;
}

const GENDER_CHIP: Record<TwinContext["gender"], string> = {
  male: "남아",
  female: "여아",
  none: "성별 무관",
};

// 입력 폼의 톤 이름(중립·부드러움·강함)과 같은 말로 — 예전 칩은 '소프트 톤'이었다
const TONE_CHIP: Record<TwinContext["tone"], string> = {
  neutral: "중립 톤",
  soft: "부드러운 톤",
  strong: "강한 톤",
};

/**
 * 결과 머리의 조건 칩 — 제출 때 잡은 값(TwinContext)으로 만든다. 예전 칩은 성별 자리가 늘 '미지정'이었고(relation:'any' 고정),
 * 성·자녀 수·톤은 응답을 기다리는 동안 고친 폼 값이 찍혔다.
 */
export function twinConditionChips(ctx: TwinContext): string[] {
  const chips = [`성 ${ctx.lastName}`, `자녀 ${ctx.count}명`, GENDER_CHIP[ctx.gender], TONE_CHIP[ctx.tone]];
  if (ctx.birthDate) chips.push(`출생일 ${ctx.birthDate}${ctx.birthTime ? ` ${ctx.birthTime}` : ""}`);
  return chips;
}

/**
 * 카드 '상세 보기' — 같은 조건의 /evaluate(출생일·시각·성별·톤을 싣는다. 부모 기반·희귀 성씨 결과의 '이 이름 평가하기'와 같은 꼴).
 * 쌍둥이 카드 점수와 /evaluate 점수는 같은 채점(ScoringService)이라 같은 입력이면 같은 값이다.
 * 예전 링크는 값 없는 '/analysis' 라 빈 입력 폼이 열렸다.
 */
export function twinEvaluateHref(ctx: TwinContext, first: string): string {
  return evaluateHref(
    {
      lastName: ctx.lastName,
      name: first,
      birthDate: ctx.birthDate,
      birthTime: ctx.birthTime,
      gender: ctx.gender,
      tone: ctx.tone,
    },
    { withBirth: true }
  );
}

/** 공유글자 추출 — 모든 자녀 이름에 공통으로 들어가는 글자 */
function findSharedChar(names: { name: string }[]): string {
  if (names.length < 2) return "";
  const first = names[0].name;
  for (const ch of first) {
    if (names.slice(1).every((n) => n.name.includes(ch))) return ch;
  }
  return "";
}

/** 서버 응답 → 화면의 세트 목록. 순서는 응답 그대로(조화도 높은 순), id 는 세트마다 다르다 */
export function mapTwinResponse(response: TwinNameResponse): TwinThemeBlock[] {
  return response.nameSets.map((set, i) => {
    const key = THEME_KEY_MAP[set.theme] ?? "shared_char";
    const sharedType = SHARED_TYPE_MAP[set.theme] ?? "char";

    let sharedValue = "";
    if (sharedType === "char") {
      sharedValue = findSharedChar(set.names);
    }

    return {
      id: `set-${i}`,
      key,
      label: set.theme,
      // 백엔드 공유의미 설명이 영문 카테고리 코드를 그대로 싣는다("'NATURE' 의미를 공유하는 이름 세트" — TwinNameEngine).
      // 카테고리는 엔진 내부 글자 기준이라 보이는 한자와 다를 수 있어 이름을 붙이지 않고 일반 문장으로 바꾼다(2026-11-03)
      description: /'[A-Z_]+'/.test(set.themeDescription ?? "")
        ? "뜻 갈래(자연·덕목 등)가 같은 한자들의 소리로 지은 이름 세트"
        : set.themeDescription,
      coherence: set.coherenceScore,
      coherenceNote: coherenceNote(set.coherenceScore, set.names.length),
      shared: { type: sharedType, value: sharedValue },
      pair: set.names.map((n, idx) => ({
        position: POSITIONS[idx] ?? `${idx + 1}번째`,
        first: n.name,
        sharedIndex:
          sharedType === "char" && sharedValue
            ? [...n.name]
                .map((ch, at) => (ch === sharedValue ? at : -1))
                .filter((x) => x >= 0)
            : undefined,
        scores: {
          aesthetic: n.aestheticScore,
          harmony: n.harmonyScore,
          final: n.finalScore,
        },
        reasons: n.reasons,
      })),
    };
  });
}

export interface TwinThemeGroup {
  key: TwinThemeKey;
  label: string;
  /** 이 테마의 세트 — 응답 순서(조화도 높은 순) */
  sets: TwinThemeBlock[];
}

/**
 * 테마별 묶음. 묶음의 순서는 그 테마의 첫 세트가 응답에 나온 순서다 — 조화도가 가장 높은 세트의 테마가 첫 탭이 되어
 * 처음 보이는 세트(전체 1순위)가 첫 탭 아래에 온다.
 */
export function groupTwinSets(sets: readonly TwinThemeBlock[]): TwinThemeGroup[] {
  const groups: TwinThemeGroup[] = [];
  for (const set of sets) {
    const group = groups.find((g) => g.key === set.key);
    if (group) group.sets.push(set);
    else groups.push({ key: set.key, label: set.label, sets: [set] });
  }
  return groups;
}

/** 세트를 고르는 단추의 글 — 그 세트의 이름들(성 없이) */
export function twinSetLabel(set: TwinThemeBlock): string {
  return set.pair.map((p) => p.first).join(" · ");
}

/** 지금 보일 세트 — id 가 목록에 없으면(결과가 바뀐 직후 등) 첫 세트 */
export function pickTwinSet(
  sets: readonly TwinThemeBlock[],
  id: string
): TwinThemeBlock | undefined {
  return sets.find((s) => s.id === id) ?? sets[0];
}

/** 결과 머리말 — 실제로 나온 테마와 세트 수를 적는다(예전 문장은 늘 '3가지 테마로 … 한 쌍'이었다) */
export function twinSummaryLine(groups: readonly TwinThemeGroup[]): string {
  const total = groups.reduce((n, g) => n + g.sets.length, 0);
  const labels = groups.map((g) => g.label).join(" · ");
  return `${labels} 테마로 어울리는 이름 세트 ${total}개를 골랐어요.`;
}

/**
 * 요청에 싣는 성별·톤 — 서버 엔진이 알아보는 소문자 값. 성별 '상관없음'은 싣지 않는다(서버 기본값 none).
 */
export function twinGenderTone(
  gender: "none" | "male" | "female",
  tone: "neutral" | "soft" | "strong"
): Pick<TwinNamesRequest, "gender" | "tone"> {
  return { gender: gender === "none" ? undefined : gender, tone };
}
