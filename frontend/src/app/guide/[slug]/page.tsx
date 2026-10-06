/**
 * /guide/[slug] — 데이터 리포트 상세
 *
 * content/insights/*.md 를 빌드 타임에 HTML로 바꿔 싣는다(src/lib/insights.ts).
 * /guide(작명 가이드) 아래에 두어 "이름 짓기 배경 지식"이라는 한 주제로 묶는다.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { getAllInsights, getInsight } from "@/lib/insights";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllInsights().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getInsight(slug);
  if (!article) return {};
  const canonical = `/guide/${slug}`;
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.description,
      url: `${SITE_URL}${canonical}`,
      publishedTime: article.date,
      modifiedTime: article.updated,
    },
  };
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

const PROSE =
  "text-[15.5px] leading-[1.8] " +
  "[&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-navy " +
  "[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-navy " +
  "[&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 " +
  "[&_a]:text-teal [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_strong]:text-navy " +
  "[&_blockquote]:my-6 [&_blockquote]:border-l-[3px] [&_blockquote]:border-teal [&_blockquote]:bg-paper-card [&_blockquote]:py-3 [&_blockquote]:pl-5 [&_blockquote]:pr-4 [&_blockquote]:text-sm [&_blockquote]:text-text-2 [&_blockquote_p]:mb-0 " +
  "[&_hr]:my-10 [&_hr]:border-paper-line " +
  "[&_.table-wrap]:my-5 [&_.table-wrap]:overflow-x-auto [&_.table-wrap]:rounded-xl [&_.table-wrap]:border [&_.table-wrap]:border-paper-line " +
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_thead]:bg-paper-card " +
  "[&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-navy [&_th]:whitespace-nowrap " +
  "[&_td]:border-t [&_td]:border-paper-line [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top";

export default async function InsightPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getInsight(slug);
  if (!article) notFound();

  const others = getAllInsights().filter((a) => a.slug !== slug).slice(0, 6);
  const canonical = `${SITE_URL}/guide/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.updated,
    inLanguage: "ko-KR",
    mainEntityOfPage: canonical,
    author: { "@type": "Organization", name: "이름의 결", url: SITE_URL },
    publisher: { "@type": "Organization", name: "이름의 결", url: SITE_URL },
  };

  return (
    <>
      <Header current="guide" />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-14">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <nav aria-label="breadcrumb" className="mb-6 text-xs text-text-2">
          <Link href="/" className="no-underline hover:text-navy">
            홈
          </Link>
          <span className="mx-1.5">/</span>
          <Link href="/guide" className="no-underline hover:text-navy">
            작명 가이드
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-navy">{article.title}</span>
        </nav>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-teal">
          {article.eyebrow}
        </p>
        <h1 className="mb-4 text-2xl font-bold leading-snug text-navy sm:text-3xl">
          {article.title}
        </h1>
        <p className="mb-3 text-[15px] leading-relaxed text-text-2">{article.description}</p>
        <p className="mb-10 text-xs text-text-2">
          <time dateTime={article.date}>{fmtDate(article.date)}</time>
          {article.updated !== article.date && (
            <>
              {" · "}
              <time dateTime={article.updated}>{fmtDate(article.updated)} 갱신</time>
            </>
          )}
          {" · "}읽는 데 약 {article.readingMinutes}분
        </p>

        <article className={PROSE} dangerouslySetInnerHTML={{ __html: article.html }} />

        <section className="mt-14 rounded-xl border border-paper-line bg-paper-tint p-6 text-center">
          <p className="mb-3 text-sm text-text-2">
            통계 속 이름이 아니라 우리 아이에게 맞는 이름이 궁금하신가요?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/search"
              className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white no-underline"
            >
              이름 추천받기
            </Link>
            <Link
              href="/evaluate"
              className="rounded-full border border-paper-line bg-paper-card px-4 py-2 text-sm font-medium text-navy no-underline"
            >
              이름 평가하기
            </Link>
          </div>
        </section>

        {others.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-base font-semibold text-navy">다른 리포트</h2>
            <ul className="grid gap-3">
              {others.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/guide/${a.slug}`}
                    className="block rounded-xl border border-paper-line bg-paper-card px-4 py-3 no-underline transition hover:border-teal"
                  >
                    <span className="block text-sm font-semibold text-navy">{a.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-text-2">
                      {a.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
