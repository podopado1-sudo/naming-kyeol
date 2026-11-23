/**
 * /hanja 인덱스·독음 쪽의 한 줄 — 이름 평가(/evaluate)의 음절별 한자 칸으로 가는 길. 2026-11 설계 docs/plan-hanja-input-2026-11.md §9-4·§11-2.
 *
 * "use client" 가 없다 — 서버 컴포넌트(정적 쪽)에서만 쓴다.
 * - 목적지는 쿼리·해시 없는 /evaluate(폼 맨 위) — 도구를 쓰러 가는 줄이라 설명 글 앵커(#hanja-guide)로 보내지 않는다.
 *   크롤러에게는 색인 착지 /evaluate 한 주소라 nofollow 를 달지 않는다.
 * - 풀 페이지 이동(<a>) — /evaluate 는 클라이언트 네비 잔상 버그가 있어 사이트 관례(/name 의 링크들)대로.
 * - 이 줄은 더하기만 한다 — 붙는 쪽의 제목·설명·h1·기존 문단은 바꾸지 않는다(검색 유입 보호).
 * 링크 글자는 작은 글씨 전용 짙은 청록(teal-800 — 종이 5.51:1).
 */
export function HanjaEvaluateLine({ className }: { className: string }) {
  return (
    <p className={`text-center text-sm leading-relaxed text-text-2 ${className}`}>
      이름을 정하셨다면 음절마다 한자를 골라 맞춰 볼 수 있어요 →{" "}
      <a href="/evaluate" className="font-medium text-teal-800 no-underline hover:underline">
        이름 평가
      </a>
    </p>
  );
}
