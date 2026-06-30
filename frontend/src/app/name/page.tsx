import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import {
  getAllNames,
  getCuratedNames,
  getName,
  getNameConsonantGroups,
} from "@/lib/name-seo";

/**
 * /name — 이름 뜻 사전 인덱스.
 * 대법원 출생신고 빈도 상위 인기 이름을 초성 ㄱ~ㅎ로 탐색. 전부 정적 생성.
 * (sitemap 등재 범위와 맞춰 상위 1,000개를 노출 — 내부링크·색인 대상 일치)
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

const INDEX_LIMIT = 1000;

export const metadata: Metadata = {
  title: "이름 뜻 사전 — 인기 이름 순위·한자·의미",
  description:
    "지우·서윤·민준 등 인기 이름의 뜻과 한자, 출생신고 통계 기준 순위와 남녀 비율을 찾아보세요. 대법원 출생신고 데이터 기반 이름 뜻 사전입니다.",
  alternates: { canonical: "/name" },
  openGraph: {
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

  return (
    <>
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
