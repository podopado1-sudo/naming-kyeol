import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/og";
import Link from "next/link";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { HanjaGradeBadge } from "@/components/hanja/HanjaBadges";
import {
  getAllDetailChars,
  getAllReadings,
  getConsonantGroups,
  getPopularReadings,
  getReadingChars,
} from "@/lib/hanja-seo";

/**
 * /hanja — 인명용 한자 사전 인덱스.
 * 독음 767개를 초성 ㄱ~ㅎ 그룹으로 탐색. 전부 정적 생성.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

export const metadata: Metadata = {
  // 제목은 바꾸지 않는다(계획 §7-1). 설명의 '오행 검수 등급'은 사실과 달라(옛 값은 뜻 기반 자동 판정) 고쳤다(계획 §4-2)
  title: "인명용 한자 사전 — 뜻·획수·오행 검색",
  description:
    "이름에 쓰는 인명용 한자 9,000여 자의 뜻, 획수, 오행을 독음별로 찾아보세요. 대법원 인명용 한자 기준, 부수 기준 자원오행과 판정 근거(확정·이견)를 함께 제공합니다.",
  alternates: { canonical: "/hanja" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "인명용 한자 사전 — 뜻·획수·오행 검색",
    description:
      "이름에 쓰는 인명용 한자 9,000여 자의 뜻, 획수, 오행을 독음별로 찾아보세요.",
    url: `${SITE_URL}/hanja`,
  },
};

const CONSONANT_ORDER = [
  "ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ",
  "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

export default function HanjaIndexPage() {
  const groups = getConsonantGroups();
  const popular = getPopularReadings(12);
  const totalChars = getAllDetailChars().length;
  const totalReadings = getAllReadings().length;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-16">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-teal">
          Hanja Dictionary
        </p>
        <h1 className="mb-4 text-2xl font-bold leading-snug text-navy sm:text-3xl">
          인명용 한자 사전
        </h1>
        <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-text-2">
          이름에 쓰는 한자 {totalChars.toLocaleString()}자를 독음{" "}
          {totalReadings}개로 정리했습니다. 뜻·획수와 함께 부수 기준 자원오행과 그
          판정 근거(확정·이견)를 표시합니다.
        </p>

        {/* 자원오행 등급 읽는 법 — 뱃지 문구는 components/hanja/HanjaBadges.tsx 와 같다 */}
        <section className="mb-12 max-w-2xl rounded-xl border border-paper-line bg-paper-card px-5 py-4">
          <h2 className="mb-2 text-sm font-semibold text-navy">
            자원오행 표시 읽는 법
          </h2>
          <p className="mb-3 text-sm leading-relaxed text-text-2">
            자원오행은 한자의 부수로 오행을 정하는 작명 관행입니다. 이 사전은 부수마다 작명
            실무에서 가장 많이 쓰는 값을 따르고, 자료가 서로 다르면 그 사실을 함께 적습니다.
          </p>
          <dl className="m-0 space-y-1.5 text-sm leading-relaxed">
            {[
              { grade: "R", text: "부수와 글자 모두 자료 사이 이견이 없습니다." },
              {
                grade: "X",
                text: "천간·지지 글자와 일부 글자는 부수보다 간지·문헌·작명 실무 자료의 예외값을 따릅니다.",
              },
              {
                grade: "V",
                text: "부수나 글자를 다른 오행으로 보는 자료가 있거나, 같은 부수 글자끼리 값이 갈립니다. 다른 값이 있으면 상세 페이지에 함께 적었습니다.",
              },
              {
                grade: "V",
                vReasons: ["radical_single"],
                text: "이 부수는 자원오행 자료가 적어 찾은 자료의 값을 따랐습니다. 다른 값이 있는 것은 아닙니다.",
              },
              {
                grade: "V",
                vReasons: ["radical_unknown"],
                text: "어느 자료에도 이 부수의 값이 없어 부수의 뜻으로 정했습니다.",
              },
            ].map(({ grade, vReasons, text }) => (
              <div key={`${grade}-${vReasons?.[0] ?? ""}`} className="flex items-start gap-2">
                <dt className="shrink-0 pt-0.5">
                  <HanjaGradeBadge grade={grade} vReasons={vReasons} />
                </dt>
                <dd className="m-0 text-text-2">{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 인기 독음 */}
        <section className="mb-12">
          <h2 className="mb-4 text-base font-semibold text-navy">
            글자가 많은 독음
          </h2>
          <div className="flex flex-wrap gap-2">
            {popular.map((reading) => (
              <Link
                key={reading}
                href={`/hanja/${encodeURIComponent(reading)}`}
                className="rounded-full border border-paper-line bg-paper-card px-4 py-2 text-sm font-medium text-navy no-underline transition hover:border-teal"
              >
                {reading}
                <span className="ml-1.5 font-tabular text-xs text-text-2">
                  {getReadingChars(reading)?.length}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 초성별 전체 독음 */}
        <section>
          <h2 className="mb-6 text-base font-semibold text-navy">
            독음으로 찾기
          </h2>
          <div className="space-y-8">
            {CONSONANT_ORDER.map((cho) => {
              const readings = groups.get(cho);
              if (!readings || readings.length === 0) return null;
              return (
                <div key={cho}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-navy-50 text-navy">
                      {cho}
                    </span>
                    <span className="font-tabular text-xs">
                      {readings.length}개 독음
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {readings.map((reading) => (
                      <Link
                        key={reading}
                        href={`/hanja/${encodeURIComponent(reading)}`}
                        className="rounded-md border border-paper-line bg-paper-card px-2.5 py-1 text-sm text-navy no-underline transition hover:border-teal"
                      >
                        {reading}
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
            마음에 드는 글자를 찾으셨나요? 그 글자가 들어간 이름의 미학
            점수와 오행 조화를 분석해 드립니다.
          </p>
          <Link
            href="/required-char"
            className="inline-block rounded-lg bg-navy px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-navy-600"
          >
            필수 글자로 이름 추천받기 →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
