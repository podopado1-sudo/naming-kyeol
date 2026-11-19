/**
 * 출생지(시·도) 목록 — /ohaeng 폼의 출생지 선택과 설명 글(진태양시 보정 분)이 쓴다(2026-11 설계 docs/plan-ohaeng-2026-11.md §6-1).
 *
 * 백엔드 `Application/Engines/Data/BirthplaceData.cs` 의 Birthplaces 와 같은 순서·코드·이름이다. 목록 API 가 없어 복사해 두고,
 * tests/birthplaces.test.mjs 가 C# 파일을 읽어 코드·이름·순서·보정 분(Math.round((경도 − 135) × 4))을 대조한다 —
 * 백엔드 목록을 바꾸면 여기도 같이 고칠 것. 백엔드는 이 17개 밖의 코드를 400 으로 막는다(SajuController).
 *
 * "use client" 가 없는 순수 모듈 — 서버 컴포넌트(설명 글)·클라이언트 폼·node --test 가 함께 읽는다.
 */

export interface Birthplace {
  /** 백엔드 birthplaceCode */
  code: string;
  /** 화면 이름(시·도) */
  name: string;
  /** 진태양시 보정 분(반올림 정수, 음수 = 출생 시각을 당긴다) — 백엔드 응답 correctionMinutes 와 같은 값 */
  correctionMinutes: number;
}

export const BIRTHPLACES: readonly Birthplace[] = [
  { code: "seoul", name: "서울", correctionMinutes: -32 },
  { code: "busan", name: "부산", correctionMinutes: -24 },
  { code: "daegu", name: "대구", correctionMinutes: -26 },
  { code: "incheon", name: "인천", correctionMinutes: -33 },
  { code: "gwangju", name: "광주", correctionMinutes: -33 },
  { code: "daejeon", name: "대전", correctionMinutes: -30 },
  { code: "ulsan", name: "울산", correctionMinutes: -23 },
  { code: "sejong", name: "세종", correctionMinutes: -31 },
  { code: "gyeonggi", name: "경기", correctionMinutes: -32 },
  { code: "gangwon", name: "강원", correctionMinutes: -28 },
  { code: "chungbuk", name: "충북", correctionMinutes: -30 },
  { code: "chungnam", name: "충남", correctionMinutes: -33 },
  { code: "jeonbuk", name: "전북", correctionMinutes: -31 },
  { code: "jeonnam", name: "전남", correctionMinutes: -32 },
  { code: "gyeongbuk", name: "경북", correctionMinutes: -25 },
  { code: "gyeongnam", name: "경남", correctionMinutes: -27 },
  { code: "jeju", name: "제주", correctionMinutes: -34 },
];

/** 출생지를 고르지 않았을 때 백엔드가 쓰는 기준(BirthplaceData.Default) */
export const DEFAULT_BIRTHPLACE_CODE = "seoul";

/** 코드 → 출생지. 목록 밖이면 undefined */
export function birthplaceByCode(code: string): Birthplace | undefined {
  return BIRTHPLACES.find((b) => b.code === code);
}

/** 보정 분의 크기(절댓값) 범위 — 설명 글 '17개 시·도 모두 23~34분 사이' */
export function correctionRange(): { min: number; max: number } {
  const abs = BIRTHPLACES.map((b) => Math.abs(b.correctionMinutes));
  return { min: Math.min(...abs), max: Math.max(...abs) };
}
