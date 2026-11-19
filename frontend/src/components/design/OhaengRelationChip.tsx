/**
 * OhaengRelationChip — 두 글자의 자원오행 관계 칩(상생·비화·상극). 2026-11 설계 docs/plan-hanja-input-2026-11.md §8-1·§8-4.
 *
 * "use client" 가 없다 — 서버 컴포넌트(/name 조합 카드)와 클라이언트 컴포넌트(/evaluate '이 이름의 한자' 블록)가 함께 쓴다.
 * 색 표(OHAENG_CHIP)와 마크업은 /name 조합 카드(app/name/[slug]/page.tsx ComboCard)의 것을 글자 그대로 옮겼다 —
 * 그 쪽이 이 컴포넌트로 바뀌어도 HTML 이 같아야 한다(공개 쪽의 칩 모양·문구를 바꾸지 않는다).
 *
 * 칩의 말(label)은 부르는 쪽이 정한다: /name 은 lib/ohaeng-relation.ts ohaengRelation(상극 = '상극(기운이 부딪침)'),
 * /evaluate 는 ohaengRelationName(상극도 이름 꼴 '金剋木 · 상극'). 판정(kind)은 둘이 같다.
 * 관계로 점수를 매기지 않는다 — 이름만 적는 칩이다.
 */
import type { OhaengKind } from "@/lib/ohaeng-relation";

const OHAENG_CHIP: Record<string, string> = {
  생: "bg-teal-50 text-teal-700",
  비화: "bg-navy-50 text-navy",
  극: "bg-gold-50 text-gold-800", // 土 배지와 같은 골드 글자 토큰 — 옛 gold-700 은 gold-50 위 3.40:1
  unknown: "",
};

/** 관계 칩 — `자원오행 木生火 · 상생`. 말이 비면(관계를 말할 수 없으면) 아무것도 그리지 않는다 */
export function OhaengRelationChip({ kind, label }: { kind: OhaengKind; label: string }) {
  if (!label) return null;
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${OHAENG_CHIP[kind]}`}
    >
      자원오행 {label}
    </span>
  );
}
