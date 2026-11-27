import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/og";
import Link from "next/link";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import {
  getAllNames,
  getCuratedNames,
  getName,
  getNameConsonantGroups,
  getPublishedDripNames,
} from "@/lib/name-seo";
import { AdsenseLoader } from "@/components/AdsenseLoader";
import { adsEnabled, isAdPage } from "@/lib/ad-scope";

/**
 * /name — 이름 뜻 사전 인덱스.
 * 대법원 출생신고 빈도 상위 인기 이름을 초성 ㄱ~ㅎ로 탐색. 전부 정적 생성.
 * (sitemap 등재 범위와 맞춰 상위 1,000개를 노출 — 내부링크·색인 대상 일치)
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

/** 이 화면의 경로 — 광고 화면(lib/ad-scope.ts). 여기서 가는 이름 상세·도구 화면은 모두 광고 밖이다 */
const PAGE_PATH = "/name";

/**
 * 광고 경계를 넘는 링크는 미리 받지 않는다(2026-11-27). 광고를 켠 빌드에서는 광고 화면(lib/ad-scope.ts isAdPage)과 광고 밖 화면
 * 사이의 이동을 AdsenseNavigationGuard 가 새 문서로 열어, next/link 가 미리 받아 둔 RSC 를 쓰지 않는다. 광고를 켜지 않은 빌드(로컬)는
 * 가드가 아무 일도 하지 않으니 지금 동작(기본 미리 받기) 그대로 둔다(undefined). from·href 는 같은 사이트 경로(쿼리·해시는 뗀다).
 * 같은 함수가 app/hanja/page.tsx·app/hanja/[slug]/page.tsx·app/name/[slug]/page.tsx 에 있다 — tests/fix1127-static-seo.test.mjs 가 네 벌이 글자 그대로 같은지 본다.
 */
function adBoundaryPrefetch(from: string, href: string): false | undefined {
  return adsEnabled() && isAdPage(from) !== isAdPage(href.split(/[?#]/)[0]) ? false : undefined;
}

const INDEX_LIMIT = 1000;

export const metadata: Metadata = {
  title: "이름 뜻 사전 — 인기 이름 순위·한자·의미",
  description:
    "지우·서윤·민준 등 인기 이름의 뜻과 한자, 출생신고 통계 기준 순위와 남녀 비율을 찾아보세요. 대법원 출생신고 데이터 기반 이름 뜻 사전입니다.",
  alternates: { canonical: "/name" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "이름 뜻 사전 — 인기 이름 순위·한자·의미",
    description:
      "인기 이름의 뜻과 한자, 출생신고 통계 기준 순위와 남녀 비율을 찾아보세요.",
    url: `${SITE_URL}/name`,
  },
};

const CONSONANT_ORDER = [
  "ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ",
  "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

export default function NameIndexPage() {
  const groups = getNameConsonantGroups(INDEX_LIMIT);
  const popular = getCuratedNames(16);
  const totalNames = getAllNames().length;
  // 주간 드립 최신 코호트 — 드립 이름(인기 최하위 꼬리)의 데뷔 주 내부링크 표면.
  // 사이트맵(전 코호트 등재)과 함께 오펀 페이지 방지 (2026-09-03 리뷰).
  const drip = getPublishedDripNames();
  const latestCohort = drip.length
    ? drip.filter((d) => d.publishedAt === drip[drip.length - 1].publishedAt)
    : [];
  const fmtKoDate = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return `${y}년 ${m}월 ${d}일`;
  };

  return (
    <>
      {/* 인덱스만 — /name/[이름] 상세(같은 틀 자동 쪽)에는 싣지 않는다(lib/ad-scope.ts) */}
      <AdsenseLoader />
      <Header />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-16">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-teal">
          Name Dictionary
        </p>
        <h1 className="mb-4 text-2xl font-bold leading-snug text-navy sm:text-3xl">
          이름 뜻 사전
        </h1>
        <p className="mb-12 max-w-2xl text-[15px] leading-relaxed text-text-2">
          대법원 출생신고 통계 기준 인기 이름 {totalNames.toLocaleString()}개의
          뜻과 한자, 남녀 비율을 정리했습니다. 자주 찾는 이름부터 초성별로
          살펴보세요.
        </p>

        {/* 인기 이름 */}
        <section className="mb-12">
          <h2 className="mb-4 text-base font-semibold text-navy">
            가장 많이 지은 이름
          </h2>
          <div className="flex flex-wrap gap-2">
            {popular.map((name) => (
              <Link
                key={name}
                href={`/name/${encodeURIComponent(name)}`}
                prefetch={adBoundaryPrefetch(PAGE_PATH, `/name/${encodeURIComponent(name)}`)}
                className="rounded-full border border-paper-line bg-paper-card px-4 py-2 text-sm font-medium text-navy no-underline transition hover:border-teal"
              >
                {name}
                <span className="ml-1.5 font-tabular text-xs text-text-2">
                  #{getName(name)?.rank}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 이번 주 새로 실린 이름 (주간 드립 최신 코호트) */}
        {latestCohort.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-1 text-base font-semibold text-navy">
              새로 실린 이름
            </h2>
            <p className="mb-4 text-xs text-text-2">
              {/* 2026-11-03: '매주 일요일 갱신됩니다'는 드립 정지(12/27까지) 동안 사실이 아니었다 — 날짜를 데이터에서 그린다 */}
              {fmtKoDate(latestCohort[0].publishedAt)}에 사전에 새로 실린 이름 {latestCohort.length}개입니다.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {latestCohort.map(({ name }) => (
                <Link
                  key={name}
                  href={`/name/${encodeURIComponent(name)}`}
                  prefetch={adBoundaryPrefetch(PAGE_PATH, `/name/${encodeURIComponent(name)}`)}
                  className="rounded-md border border-paper-line bg-paper-card px-2.5 py-1 text-sm text-navy no-underline transition hover:border-teal"
                >
                  {name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 초성별 인기 이름 */}
        <section>
          <h2 className="mb-6 text-base font-semibold text-navy">
            초성으로 찾기
          </h2>
          <div className="space-y-8">
            {CONSONANT_ORDER.map((cho) => {
              const names = groups.get(cho);
              if (!names || names.length === 0) return null;
              return (
                <div key={cho}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-navy-50 text-navy">
                      {cho}
                    </span>
                    <span className="font-tabular text-xs">
                      {names.length}개 이름
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {names.map((name) => (
                      <Link
                        key={name}
                        href={`/name/${encodeURIComponent(name)}`}
                        prefetch={adBoundaryPrefetch(PAGE_PATH, `/name/${encodeURIComponent(name)}`)}
                        className="rounded-md border border-paper-line bg-paper-card px-2.5 py-1 text-sm text-navy no-underline transition hover:border-teal"
                      >
                        {name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 추천 도구 연결 */}
        <div className="mt-16 rounded-xl border border-paper-line bg-paper-tint p-6 text-center">
          <p className="mb-4 text-sm text-text-2">
            마음에 드는 이름이 있으신가요? 성씨와의 발음 조화, 미학 점수와
            한자 의미까지 분석해 더 잘 맞는 이름을 추천해 드립니다.
          </p>
          <Link
            href="/search"
            prefetch={adBoundaryPrefetch(PAGE_PATH, "/search")}
            className="inline-block rounded-lg bg-navy px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-navy-600"
          >
            이름 추천받기 →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
