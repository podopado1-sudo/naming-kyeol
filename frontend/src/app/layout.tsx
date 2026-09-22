import type { Metadata } from "next";
import { Noto_Serif_KR, Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// Pretendard Variable (한글 본문/제목) — 로컬 폰트
const pretendard = localFont({
  src: "../../public/fonts/PretendardVariable.woff2",
  display: "swap",
  variable: "--font-pretendard",
  weight: "45 920",
});

// Noto Serif KR (한자) — Google Fonts
const notoSerifKr = Noto_Serif_KR({
  subsets: ["latin"],
  variable: "--font-noto-serif-kr",
  display: "swap",
  weight: ["400", "500", "700"],
});

// Inter (점수/라틴/숫자) — Google Fonts, tabular figures 활용
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";
// 애드센스 게시자 ID (예: ca-pub-1234...). Vercel 환경변수로 주입 — 미설정이면 스크립트·메타태그를
// 렌더하지 않으므로 심사 전·로컬에서 무해. 설정 후 재배포 필요(빌드 타임 주입).
// 로더는 next/script가 아니라 <head>의 정적 <script async>로 싣는다 — 애드센스 안내("각 페이지의 <head>")와
// 같고, JS를 실행하지 않는 검증 크롤러도 페이지 소스에서 스니펫을 찾을 수 있다(React 19가 async 스크립트를
// head로 호이스팅·중복 제거). 배치 방침(docs/naver-blog/strategy.md): 광고 유닛은 콘텐츠 페이지(/name·/hanja)만,
// 도구 페이지 제외 — 여기서는 로더만 싣는다.
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const SITE_NAME = "이름의 결";
// 붙여 쓴 "이름의결"은 네이버가 이름+의결(議決)로 형태소 분리해 국회·회의 문서에 묻힌다
// (띄어 쓴 "이름의 결"은 1위 — 2026-09-14 실측). 검색엔진에 같은 사이트의 다른 표기임을 알린다.
const SITE_ALTERNATE_NAMES = ["이름의결", "Naming.kyeol", "namingkyeol"];
const SITE_DESCRIPTION =
  "미학 70% + 사주 조화 30%로 한국어 이름을 추천합니다. 발음·리듬·세대중립·오행·자원오행·수리사격을 수치 기반 리포트로 분석.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Naming.kyeol`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "이름 추천",
    "작명",
    "한국 이름",
    "아기 이름",
    "한자 이름",
    "순우리말 이름",
    "사주 작명",
    "오행 이름",
    "이름 평가",
    "이름의 결",
    "이름의결",
    "namingkyeol",
  ],
  authors: [{ name: "이름의 결" }],
  creator: "이름의 결",
  publisher: "이름의 결",
  applicationName: SITE_NAME,
  // 검색 봇에 명시적으로 인덱싱 허용
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  // 파비콘 / 앱 아이콘 / PWA 매니페스트 (붓요정 마스코트)
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  // 애드센스 사이트 연결용 메타태그 — 정적 HTML <head>에 들어가므로 JS를 실행하지 않는
  // 구글 검증 크롤러도 인식한다(next/script afterInteractive는 하이드레이션 후 주입이라 소스에 없음).
  ...(ADSENSE_CLIENT ? { other: { "google-adsense-account": ADSENSE_CLIENT } } : {}),
  // 검색엔진 사이트 소유 확인 (Google/Naver/Daum)
  verification: {
    // Naver Search Advisor — searchadvisor.naver.com에 사이트 등록 후 받은 값
    other: {
      "naver-site-verification": "0d1c0eec6b513bc57b51a6e2aa95bcd2ca0072fb",
    },
    // Google은 DNS TXT로 이미 인증 완료 (Cloudflare에 google-site-verification 레코드)
  },
  // Open Graph — 카카오톡/페이스북 공유 미리보기
  // TODO: og-image.png (1200×630) 제작 후 이미지가 표시됨. 아직 미제작이면 폴백으로 apple-touch-icon이 사용됨.
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — 한국어 이름 추천 서비스`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — 한국어 이름 추천 서비스`,
      },
    ],
  },
  // Twitter/X 카드
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — 한국어 이름 추천`,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  // 모바일/PWA 메타
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  category: "lifestyle",
};

/**
 * RootLayout
 *
 * 클로드 디자인 페이지마다 자체 Header (예: TwinResult의 mini header)를
 * 갖기 때문에, layout에서는 site-wide nav를 두지 않습니다.
 *
 * Toaster만 전역으로 유지.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${notoSerifKr.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        {/* 구조화 데이터: Organization + WebSite (Google Knowledge Panel 후보) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: SITE_NAME,
                alternateName: SITE_ALTERNATE_NAMES,
                url: SITE_URL,
                description: SITE_DESCRIPTION,
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: SITE_NAME,
                alternateName: SITE_ALTERNATE_NAMES,
                url: SITE_URL,
                inLanguage: "ko-KR",
                description: SITE_DESCRIPTION,
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${SITE_URL}/search?lastName={search_term_string}`,
                  "query-input": "required name=search_term_string",
                } as Record<string, unknown>,
              },
            ]),
          }}
        />
        {ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className="min-h-full">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
