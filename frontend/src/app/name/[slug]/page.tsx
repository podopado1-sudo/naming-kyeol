import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Badge } from "@/components/ui/badge";
import { HanjaGradeBadge } from "@/components/hanja/HanjaBadges";
import { ScoreBreakdownCard } from "@/components/results/ScoreBreakdownCard";
import { ELEMENT_KO, getHanja, getReadingChars } from "@/lib/hanja-seo";
import {
  firstGloss,
  genderSplit,
  getAllNames,
  getComboMeaning,
  getName,
  getSiblingNames,
  ohaengRelation,
  syllablesOf,
  toAestheticBreakdown,
  type NameSeoRecord,
} from "@/lib/name-seo";

/**
 * /name/[이름] — 이름 뜻 SEO 페이지.
 *
 * 대법원 출생신고 빈도(인기 순위·성별 비율) + 자연어 뜻을 보여주고
 * 음절별로 /hanja/[독음], 비슷한 이름으로 /name/[이름] 내부링크를 건다.
 * 전부 빌드 타임 정적 생성 — 백엔드 호출 없음.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

// /hanja 와 동일하게 전량 prerender (Vercel 온디맨드 ISR 500 이슈 회피).
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllNames().map((name) => ({ slug: name }));
}

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const GENDER_LABEL: Record<string, string> = {
  male: "남자 이름",
  female: "여자 이름",
  neutral: "남녀 공용 이름",
};

// ---------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const name = decodeSlug((await params).slug);
  const rec = getName(name);
  if (!rec) return {};

  const { gender } = genderSplit(rec);
  const meanPart = rec.mean ? ` ${name}은(는) '${rec.mean}' 뜻을 담습니다.` : "";
  const scorePart = rec.sc ? ` 발음·미학 점수 ${rec.sc.t}점.` : "";
  const title = `${name} 이름 뜻 — 인기 순위·한자·의미`;
  const description = `${name}: ${GENDER_LABEL[gender]}.${meanPart} 출생신고 통계 기준 인기 순위와 남녀 비율, 이름에 쓰는 한자를 확인하세요.${scorePart}`;
  const canonical = `/name/${encodeURIComponent(name)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: `${SITE_URL}${canonical}` },
    // 루트 layout의 twitter(공용 카드 title/images)를 통째로 대체(shallow merge) —
    // images는 비워 세그먼트 twitter-image.tsx가 이름별 카드를 주입하게 한다.
    twitter: { card: "summary_large_image", title, description },
  };
}

// ---------------------------------------------------------------
// UI 조각
// ---------------------------------------------------------------

function Breadcrumb({ name }: { name: string }) {
  return (
    <nav aria-label="breadcrumb" className="mb-8 text-sm text-text-2">
      <Link href="/" className="text-teal-700 no-underline hover:underline">
        홈
      </Link>
      <span className="mx-2 text-paper-line">/</span>
      <Link href="/search" className="text-teal-700 no-underline hover:underline">
        이름 찾기
      </Link>
      <span className="mx-2 text-paper-line">/</span>
      <span className="text-navy">{name}</span>
    </nav>
  );
}

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** 남녀 비율 막대 */
function GenderBar({ rec }: { rec: NameSeoRecord }) {
  const { malePct, femalePct } = genderSplit(rec);
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs text-text-2">
        <span>남자 {malePct}%</span>
        <span>여자 {femalePct}%</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-paper-line">
        <div className="bg-teal" style={{ width: `${malePct}%` }} />
        <div className="bg-gold" style={{ width: `${femalePct}%` }} />
      </div>
    </div>
  );
}

const OHAENG_CHIP: Record<string, string> = {
  생: "bg-teal-50 text-teal-700",
  비화: "bg-navy-50 text-navy",
  극: "bg-gold-50 text-gold-700",
  unknown: "",
};

/** 한자 조합 카드 — 글자별 훈음/획수/오행/신뢰등급 + 오행 조화. */
function ComboCard({ combo, featured }: { combo: string[]; featured: boolean }) {
  const [c1, c2] = combo;
  const r1 = getHanja(c1);
  const r2 = getHanja(c2);
  if (!r1 || !r2) return null;
  const rel = ohaengRelation(r1.e, r2.e);
  const meaning = getComboMeaning(combo);

  return (
    <div
      className={`rounded-xl border bg-paper-card p-5 ${
        featured ? "border-gold" : "border-paper-line"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-hanja text-3xl text-navy">
          {c1}
          {c2}
        </span>
        {featured && (
          <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs text-teal-700">
            가장 많이 쓰는 조합
          </span>
        )}
      </div>
      {meaning && (
        <p className="mb-3 text-[15px] font-medium leading-relaxed text-navy">
          {meaning}
        </p>
      )}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {[
          { ch: c1, r: r1 },
          { ch: c2, r: r2 },
        ].map(({ ch, r }) => (
          <div key={ch} className="rounded-lg bg-paper-tint px-3 py-2.5">
            <div className="mb-1 flex items-baseline gap-1.5">
              <span className="font-hanja text-xl text-navy">{ch}</span>
              <span className="text-sm text-text-2">{firstGloss(r.m)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-2">
              <span className="font-tabular">{r.s}획</span>
              {r.e && <span>· {ELEMENT_KO[r.e] ?? r.e}</span>}
              {r.g && <HanjaGradeBadge grade={r.g} />}
            </div>
          </div>
        ))}
      </div>
      {rel.label && (
        <span
          className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${OHAENG_CHIP[rel.kind]}`}
        >
          오행 {rel.label}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------

function NamePage({ name, rec }: { name: string; rec: NameSeoRecord }) {
  const { gender, malePct, femalePct } = genderSplit(rec);
  const genderRank = gender === "male" ? rec.rm : gender === "female" ? rec.rf : undefined;
  const syllables = syllablesOf(name);
  const siblings = getSiblingNames(name, 12);

  // 음절별 /hanja/[독음] 링크 (해당 음절이 한자 독음으로 존재할 때만)
  const syllableLinks = syllables.map((syl) => ({
    syl,
    chars: getReadingChars(syl),
  }));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-16">
        <Breadcrumb name={name} />

        {/* Hero */}
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="outline" className="border-paper-line text-xs">
              {GENDER_LABEL[gender]}
            </Badge>
            <Badge variant="outline" className="border-paper-line font-tabular text-xs">
              인기 {rec.rank.toLocaleString()}위
            </Badge>
          </div>
          <h1 className="mb-3 text-3xl font-bold text-navy sm:text-4xl">
            {name} <span className="text-xl font-normal text-text-2 sm:text-2xl">이름 뜻</span>
          </h1>
          {rec.mean && (
            <p className="text-lg leading-relaxed text-navy">
              {rec.mean} 이름
            </p>
          )}
          <p className="mt-2 text-sm text-text-2">
            발음이 주는 느낌이며, 정확한 뜻은 아래 한자 조합에 따라 달라집니다.
          </p>
        </div>

        {/* 인기 통계 */}
        <section className="mb-10 rounded-xl border border-paper-line bg-paper-card p-6">
          <h2 className="mb-4 text-base font-semibold text-navy">출생신고 통계</h2>
          <div className="mb-5 grid grid-cols-2 gap-4">
            <div>
              <div className="font-tabular text-2xl font-bold text-teal-700">
                {rec.rank.toLocaleString()}위
              </div>
              <div className="text-xs text-text-2">전체 인기 순위</div>
            </div>
            {genderRank && (
              <div>
                <div className="font-tabular text-2xl font-bold text-teal-700">
                  {genderRank.toLocaleString()}위
                </div>
                <div className="text-xs text-text-2">
                  {gender === "male" ? "남자" : "여자"} 중 순위
                </div>
              </div>
            )}
          </div>
          <GenderBar rec={rec} />
          <p className="mt-4 text-sm leading-relaxed text-text-2">
            {name}은(는) 대법원 출생신고 통계에서{" "}
            {gender === "neutral" ? (
              <>남자 {malePct}% · 여자 {femalePct}%로 고르게 쓰이는 남녀 공용 이름</>
            ) : (
              <>
                {gender === "male" ? "남자" : "여자"}에게 주로 쓰이는 이름(
                {Math.max(malePct, femalePct)}%)
              </>
            )}
            입니다.
          </p>
        </section>

        {/* 발음·미학 점수 */}
        {rec.sc && (
          <section className="mb-10">
            <h2 className="mb-2 text-base font-semibold text-navy">
              발음·미학 점수
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-text-2">
              성씨를 뺀 이름만, 특정 세대에 치우치지 않는 관점으로 평가한
              점수입니다. 이름의 결은 유행 이름보다 오래 편안한 이름을 높게
              봅니다.
            </p>
            <ScoreBreakdownCard
              aesthetic={toAestheticBreakdown(rec.sc)}
              totalScore={rec.sc.t}
            />
            <p className="mt-3 text-sm text-text-2">
              성씨와 사주 오행까지 반영한 점수는{" "}
              {/* /evaluate는 클라이언트 네비 잔상 버그로 풀 페이지 이동(<a>) — 아래 CTA와 동일 패턴 */}
              <a
                href={`/evaluate?name=${encodeURIComponent(name)}`}
                className="text-teal-700 hover:underline"
              >
                이름 평가
              </a>
              에서 확인하세요.
            </p>
          </section>
        )}

        {/* 한자 조합 */}
        {rec.combos && rec.combos.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-2 text-base font-semibold text-navy">
              {name}에 쓰는 한자 조합
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-text-2">
              발음은 같아도 한자에 따라 뜻이 달라집니다. 흔히 쓰는 조합을 오행
              조화와 함께 정리했습니다.
            </p>
            <div className="grid gap-3">
              {rec.combos.map((combo, i) => (
                <ComboCard key={combo.join("")} combo={combo} featured={i === 0} />
              ))}
            </div>
          </section>
        )}

        {/* 음절별 한자 전체 */}
        <section className="mb-10">
          <h2 className="mb-3 text-base font-semibold text-navy">
            음절별 한자 전체 보기
          </h2>
          <div className="flex flex-wrap gap-2">
            {syllableLinks.map(({ syl, chars }) =>
              chars ? (
                <Link
                  key={syl}
                  href={`/hanja/${encodeURIComponent(syl)}`}
                  className="rounded-lg border border-paper-line bg-paper-card px-4 py-2.5 text-sm text-navy no-underline transition hover:border-teal"
                >
                  <span className="font-semibold">&lsquo;{syl}&rsquo;</span>{" "}
                  <span className="text-text-2">한자 {chars.length}자 →</span>
                </Link>
              ) : (
                <span
                  key={syl}
                  className="rounded-lg border border-paper-line px-4 py-2.5 text-sm text-text-2"
                >
                  &lsquo;{syl}&rsquo; (순우리말)
                </span>
              ),
            )}
          </div>
        </section>

        {/* CTA 퍼널 */}
        <section className="my-10 rounded-xl border border-paper-line bg-paper-tint p-6 text-center">
          <p className="mb-4 text-sm text-text-2">
            {name}의 발음·미학 점수와 사주 오행 조화가 궁금하신가요?
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {/* /evaluate는 클라이언트 네비 시 searchParams 잔상 버그가 있어 풀 페이지 이동(<a>)으로
               간다(코드베이스 표준 패턴 — page.tsx/search의 window.location와 동일 취지). */}
            <a
              href={`/evaluate?name=${encodeURIComponent(name)}`}
              className="inline-block rounded-lg bg-navy px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-navy-600"
            >
              성씨 넣어 {name} 평가받기 →
            </a>
            <Link
              href="/search"
              className="inline-block rounded-lg border border-navy px-6 py-3 text-sm font-semibold text-navy no-underline transition hover:bg-navy-50"
            >
              비슷한 느낌 이름 추천받기
            </Link>
          </div>
        </section>

        {/* 비슷한 이름 */}
        {siblings.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-navy">
              &lsquo;{name[0]}&rsquo;(으)로 시작하는 다른 이름
            </h2>
            <div className="flex flex-wrap gap-2">
              {siblings.map((sib) => (
                <Link
                  key={sib}
                  href={`/name/${encodeURIComponent(sib)}`}
                  className="rounded-full border border-paper-line bg-paper-card px-3.5 py-1.5 text-sm text-navy no-underline transition hover:border-teal"
                >
                  {sib}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
              {
                "@type": "ListItem",
                position: 2,
                name: "이름 찾기",
                item: `${SITE_URL}/search`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: `${name} 이름 뜻`,
                item: `${SITE_URL}/name/${encodeURIComponent(name)}`,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "DefinedTerm",
            name,
            ...(rec.mean ? { description: `${rec.mean} 이름` } : {}),
            inDefinedTermSet: {
              "@type": "DefinedTermSet",
              name: "이름의 결 이름 사전",
              url: `${SITE_URL}/search`,
            },
            url: `${SITE_URL}/name/${encodeURIComponent(name)}`,
          },
        ]}
      />
    </>
  );
}

export default async function NameSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const name = decodeSlug((await params).slug);
  const rec = getName(name);
  if (!rec) notFound();
  return <NamePage name={name} rec={rec} />;
}
