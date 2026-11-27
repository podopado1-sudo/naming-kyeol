"use client";

export interface CandidateDetailContext {
  birthDate?: string; // "YYYY-MM-DD"
  birthTime?: string; // "HH:MM"
  gender?: string;    // API value: "male"/"female"/"none"
  tone?: string;      // API value: "soft"/"strong"/"neutral"
  /** 이름 한자 — /evaluate 주소 꼴(순우리말 "--" 등, SmartNameCandidate.evaluateHanja). 없으면 /evaluate 가 자동으로 고른다 */
  hanja?: string;
}

/**
 * 후보 이름 "상세 보기" 클릭 시 /evaluate 페이지로 이동.
 * fullName(성+이름)에서 성씨를 잘라 lastName/name 쿼리로 분리하고,
 * 추천 요청의 컨텍스트(생일/성별/톤)도 함께 전달 → /evaluate에서 자동 평가됨.
 */
export function useCandidateDetail() {
  return (lastName: string, fullName: string, ctx?: CandidateDetailContext) => {
    const ln = lastName.trim();
    const first = ln && fullName.startsWith(ln) ? fullName.slice(ln.length) : fullName;
    const params = new URLSearchParams();
    if (ln) params.set("lastName", ln);
    if (first) params.set("name", first);
    if (ctx?.hanja) params.set("hanja", ctx.hanja);
    if (ctx?.birthDate) params.set("birthDate", ctx.birthDate);
    if (ctx?.birthTime) params.set("birthTime", ctx.birthTime);
    if (ctx?.gender) params.set("gender", ctx.gender);
    if (ctx?.tone) params.set("tone", ctx.tone);
    // 풀 페이지 이동 — /evaluate 정적 라우트의 클라이언트 라우터 캐시가
    // 이전 ?name=... 을 재사용해 다른 이름인데 직전 평가가 표시되던 버그 우회.
    window.location.assign(`/evaluate?${params.toString()}`);
  };
}
