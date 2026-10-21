import type { CompanyNamingOptions } from "@/lib/types";

/**
 * 상호 입력 옵션 대비값 — 백엔드 GET /company-names/options 와 같은 목록.
 *
 * 두 곳이 쓴다:
 *   - CompanyForm  옵션 요청이 실패해도 폼이 동작하도록 (진실의 원천은 여전히 백엔드)
 *   - CompanyGuide 업종 목록을 정적 HTML 글로 보여주려고 — Select 목록은 포털이라
 *                  서버 렌더 HTML에 첫 항목 하나만 남는다
 * 업종·톤을 바꾸면 CompanyNamingData(백엔드)와 함께 고칠 것. 어긋나면 400이 난다.
 */
export const COMPANY_FALLBACK_OPTIONS: CompanyNamingOptions = {
  industries: [
    { key: "cafe", label: "카페 · 디저트" },
    { key: "food", label: "음식점 · 외식" },
    { key: "bakery", label: "베이커리 · 제과" },
    { key: "beauty", label: "뷰티 · 미용" },
    { key: "fashion", label: "패션 · 의류" },
    { key: "it", label: "IT · 소프트웨어" },
    { key: "edu", label: "교육 · 학원" },
    { key: "health", label: "병원 · 의원" },
    { key: "wellness", label: "운동 · 필라테스" },
    { key: "retail", label: "소매 · 편집숍" },
    { key: "interior", label: "인테리어 · 건축" },
    { key: "consulting", label: "컨설팅 · 전문서비스" },
    { key: "culture", label: "문화 · 공방" },
    { key: "pet", label: "반려동물" },
    { key: "travel", label: "여행 · 숙박" },
    { key: "agri", label: "농수산 · 식품제조" },
    { key: "finance", label: "금융 · 투자" },
    { key: "law", label: "법률 · 세무" },
  ],
  tones: [
    { key: "modern", label: "모던" },
    { key: "classic", label: "클래식" },
    { key: "warm", label: "따뜻함" },
    { key: "premium", label: "프리미엄" },
    { key: "playful", label: "경쾌함" },
  ],
  styles: [
    { key: "all", label: "전체" },
    { key: "hanja", label: "한자 조합" },
    { key: "pure-korean", label: "순우리말" },
    { key: "english", label: "영문 조어" },
  ],
};
