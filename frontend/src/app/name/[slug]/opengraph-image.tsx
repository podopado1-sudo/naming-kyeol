import { ImageResponse } from "next/og";
import { OG_FONT_B64 } from "@/assets/og/pretendard-og";
import { genderSplit, getAllNames, getName } from "@/lib/name-seo";

/**
 * /name/[이름] OG 공유 카드 — 카톡/SNS 공유 시 이름별 브랜드 카드.
 *
 * 세그먼트의 generateStaticParams + dynamicParams=false 를 공유해
 * 빌드 타임에 전체 이름의 PNG가 정적 생성된다.
 *
 * satori 제약: flexbox만 지원(grid 불가), 폰트는 TTF/OTF/WOFF만.
 * 폰트는 scripts/build_og_font.py 산출물(wght 700 고정 서브셋)을 base64로 import —
 * node:fs를 쓰면 라우트가 온디맨드(ƒ)로 강등돼 정적 생성이 깨진다(이 프로젝트는
 * Vercel 온디맨드 ISR 500 전력 때문에 전량 프리렌더가 원칙).
 * 아래 고정 문구를 바꾸면 스크립트의 OG_LABELS도 동기화할 것.
 */

export const alt = "이름의 결 — 이름 뜻 카드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 세그먼트(page.tsx)의 generateStaticParams는 메타데이터 라우트에 상속되지 않아
// (Next 16.2 실측: 없으면 ƒ 온디맨드로 강등) 여기서도 명시해 전량 정적 생성한다.
export function generateStaticParams() {
  return getAllNames().map((name) => ({ slug: name }));
}

// dynamicParams도 상속되지 않는다 — 없으면 미생성 slug(드립 미공개 이름·임의 문자열)가
// 404 대신 온디맨드 렌더로 200 PNG를 반환한다 (프리렌더 매니페스트 fallback:null 실측,
// 2026-09-03 리뷰). 페이지와 동일하게 하드 404로 고정.
export const dynamicParams = false;

const PAPER = "#FAF7F2";
const CHARCOAL = "#2B2B2B";
const TEAL = "#2E7D7A";
const GOLD = "#C9A96E";

// 모듈 레벨 1회 디코드(워커당 캐시).
const fontData = Buffer.from(OG_FONT_B64, "base64");

const GENDER_LABEL: Record<string, string> = {
  male: "남자 이름",
  female: "여자 이름",
  neutral: "남녀 공용 이름",
};

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let name: string;
  try {
    name = decodeURIComponent(slug);
  } catch {
    name = slug;
  }
  const rec = getName(name);

  // dynamicParams=false라 이론상 rec은 항상 존재하지만, 방어적으로 브랜드 카드 폴백.
  const gender = rec ? genderSplit(rec).gender : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PAPER,
        }}
      >
        <div style={{ display: "flex", height: 8, backgroundColor: GOLD }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            justifyContent: "space-between",
            padding: "52px 72px 48px",
          }}
        >
          {/* 상단: 워드마크 + 코너 라벨 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", fontSize: 34, color: TEAL }}>
              이름의 결
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: CHARCOAL,
                opacity: 0.45,
              }}
            >
              이름 뜻
            </div>
          </div>

          {/* 중앙: 이름 + 뜻 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: name.length >= 3 ? 140 : 176,
                color: CHARCOAL,
                letterSpacing: name.length >= 3 ? 8 : 20,
                lineHeight: 1.1,
              }}
            >
              {name}
            </div>
            {rec?.mean && (
              <div
                style={{
                  display: "flex",
                  marginTop: 18,
                  fontSize: 38,
                  color: CHARCOAL,
                  opacity: 0.68,
                  textAlign: "center",
                }}
              >
                {rec.mean} 이름
              </div>
            )}
          </div>

          {/* 하단: 순위·성별 칩 + 도메인 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {rec && (
                <div
                  style={{
                    display: "flex",
                    backgroundColor: TEAL,
                    color: "#FFFFFF",
                    fontSize: 26,
                    padding: "10px 24px",
                    borderRadius: 999,
                  }}
                >
                  인기 {rec.rank.toLocaleString()}위
                </div>
              )}
              {gender && (
                <div
                  style={{
                    display: "flex",
                    border: `2px solid ${CHARCOAL}`,
                    color: CHARCOAL,
                    opacity: 0.75,
                    fontSize: 26,
                    padding: "8px 24px",
                    borderRadius: 999,
                  }}
                >
                  {GENDER_LABEL[gender]}
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                color: CHARCOAL,
                opacity: 0.45,
              }}
            >
              namingkyeol.com
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "KyeolOG", data: fontData, weight: 700, style: "normal" }],
    },
  );
}
