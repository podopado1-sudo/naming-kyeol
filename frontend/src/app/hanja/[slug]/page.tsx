import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Badge } from "@/components/ui/badge";
import { HanjaCharCard } from "@/components/hanja/HanjaCharCard";
import {
  HanjaGradeBadge,
  HanjaElementBadge,
} from "@/components/hanja/HanjaBadges";
import {
  ELEMENT_GENERATES,
  ELEMENT_KO,
  getAllDetailChars,
  getAllReadings,
  getElementDistribution,
  getHanja,
  getReadingChars,
  getRepresentativeChars,
  getSiblingReadings,
  hasDetailPage,
} from "@/lib/hanja-seo";

/**
 * /hanja/[slug] — 한자 사전 SEO 페이지.
 *
 * slug 가 한글 1음절(독음)이면 해당 독음의 한자 목록 페이지,
 * 한자(사전 수록 글자)이면 글자 상세 페이지를 렌더한다.
 * 전부 빌드 타임 정적 생성 — 백엔드 호출 없음.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

// 전체 빌드 타임 생성 (독음 489 + 상세 글자 9,096 ≈ 9,600 페이지, 생성 ~16초).
// 처음엔 S급만 prerender + 나머지 온디맨드(ISR)로 운영하려 했으나,
// Vercel에서 온디맨드 생성 페이지만 500을 반환하는 문제(프레임워크 레벨,
// 로컬 next start에서는 재현 안 됨)가 있어 전량 prerender로 전환.
// 미생성 slug는 함수 호출 없이 즉시 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return [
    ...getAllReadings().map((reading) => ({ slug: reading })),
    ...getAllDetailChars().map((char) => ({ slug: char })),
  ];
}

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

type Resolved =
  | { kind: "reading"; reading: string; chars: string[] }
  | { kind: "char"; char: string };

function resolveSlug(raw: string): Resolved | null {
  const slug = decodeSlug(raw);
  const chars = getReadingChars(slug);
  if (chars) return { kind: "reading", reading: slug, chars };
  const record = getHanja(slug);
  if (record && hasDetailPage(record)) return { kind: "char", char: slug };
  return null;
}

// ---------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  const resolved = resolveSlug(raw);
  if (!resolved) return {};

  if (resolved.kind === "reading") {
    const { reading, chars } = resolved;
    const title = `이름에 쓰는 '${reading}' 한자 ${chars.length}자 — 종류·뜻·획수·오행`;
    const description = `'${reading}'(으)로 읽는 인명용 한자 ${chars.length}자의 뜻, 획수, 오행을 한눈에 비교하세요. 검수 등급과 함께 이름에 어울리는 글자를 찾아드립니다.`;
    const canonical = `/hanja/${encodeURIComponent(reading)}`;
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: { title, description, url: `${SITE_URL}${canonical}` },
    };
  }

  const { char } = resolved;
  const record = getHanja(char)!;
  const meaning = record.m!.split("/").join(" · ");
  const title = `${char}(${record.r.join("·")}) — 뜻·획수·오행`;
  const description = `한자 ${char}: ${meaning}. ${record.s}획${
    record.e ? ` · 오행 ${record.e}` : ""
  }${record.y ? `(${record.y})` : ""}${
    record.gov ? " · 대법원 인명용 한자" : ""
  }. 이름에 쓰일 때의 의미와 함께 쓰기 좋은 글자를 확인하세요.`;
  const canonical = `/hanja/${encodeURIComponent(char)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: `${SITE_URL}${canonical}` },
  };
}

// ---------------------------------------------------------------
// 공통 UI 조각
// ---------------------------------------------------------------

function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="breadcrumb" className="mb-8 text-sm text-text-2">
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && <span className="mx-2 text-paper-line">/</span>}
          {item.href ? (
            <Link href={item.href} className="text-teal-700 no-underline hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-navy">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function CtaBanner({ char, label }: { char: string; label: string }) {
  return (
    <div className="my-10 rounded-xl border border-paper-line bg-paper-tint p-6 text-center">
      <p className="mb-4 text-sm text-text-2">{label}</p>
      <Link
        href={`/required-char?char=${encodeURIComponent(char)}`}
        className="inline-block rounded-lg bg-navy px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-navy-600"
      >
        &lsquo;{char}&rsquo; 글자를 넣어 이름 추천받기 →
      </Link>
    </div>
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

function breadcrumbJsonLd(items: { label: string; path?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.path ? { item: `${SITE_URL}${item.path}` } : {}),
    })),
  };
}

// ---------------------------------------------------------------
// 독음 페이지
// ---------------------------------------------------------------

function ReadingPage({ reading, chars }: { reading: string; chars: string[] }) {
  const distribution = getElementDistribution(chars);
  const distText = ["木", "火", "土", "金", "水"]
    .filter((e) => distribution[e])
    .map((e) => `${e} ${distribution[e]}자`)
    .join(" · ");
  const siblings = getSiblingReadings(reading);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-16">
        <Breadcrumb
          items={[
            { label: "한자 사전", href: "/hanja" },
            { label: `'${reading}' 한자` },
          ]}
        />
        <h1 className="mb-4 text-2xl font-bold leading-snug text-navy sm:text-3xl">
          이름에 쓰는 &lsquo;{reading}&rsquo; 한자 {chars.length}자
        </h1>
        <p className="mb-10 max-w-2xl text-[15px] leading-relaxed text-text-2">
          &lsquo;{reading}&rsquo;(으)로 읽는 인명용 한자는 모두 {chars.length}
          자입니다.
          {distText && <> 오행 분포는 {distText}입니다.</>} 신뢰 등급(검수
          완료순)과 획수 순으로 정렬했습니다.
        </p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {chars.map((char) => (
            <HanjaCharCard key={char} char={char} record={getHanja(char)!} />
          ))}
        </div>

        <CtaBanner
          char={reading}
          label={`'${reading}'이(가) 들어가는 이름이 궁금하신가요? 미학 점수와 오행 조화까지 분석해 드립니다.`}
        />

        {siblings.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-base font-semibold text-navy">
              비슷한 독음 더 보기
            </h2>
            <div className="flex flex-wrap gap-2">
              {siblings.map((sibling) => (
                <Link
                  key={sibling}
                  href={`/hanja/${encodeURIComponent(sibling)}`}
                  className="rounded-full border border-paper-line bg-paper-card px-3.5 py-1.5 text-sm text-navy no-underline transition hover:border-teal"
                >
                  {sibling}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { label: "한자 사전", path: "/hanja" },
            {
              label: `'${reading}' 한자`,
              path: `/hanja/${encodeURIComponent(reading)}`,
            },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `이름에 쓰는 '${reading}' 한자`,
            numberOfItems: chars.length,
            itemListElement: chars
              .filter((c) => hasDetailPage(getHanja(c)!))
              .slice(0, 50)
              .map((c, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: c,
                url: `${SITE_URL}/hanja/${encodeURIComponent(c)}`,
              })),
          },
        ]}
      />
    </>
  );
}

// ---------------------------------------------------------------
// 글자 상세 페이지
// ---------------------------------------------------------------

function CharPage({ char }: { char: string }) {
  const record = getHanja(char)!;
  const meaningParts = record.m!.split("/");
  const primaryReading = record.r[0];
  const sameReading = (getReadingChars(primaryReading) ?? []).filter(
    (c) => c !== char,
  );

  // 상생 오행 (이 글자가 생하는 오행 + 이 글자를 생하는 오행)
  const generates = record.e ? ELEMENT_GENERATES[record.e] : undefined;
  const generatedBy = record.e
    ? Object.entries(ELEMENT_GENERATES).find(([, to]) => to === record.e)?.[0]
    : undefined;

  const infoRows: { label: string; value: React.ReactNode }[] = [
    { label: "독음", value: record.r.join(", ") },
    { label: "뜻", value: meaningParts.join(" · ") },
    { label: "획수", value: `${record.s}획` },
    {
      label: "오행",
      value: record.e ? (
        <span className="flex items-center gap-2">
          {ELEMENT_KO[record.e] ?? record.e}
          <HanjaGradeBadge grade={record.g} />
        </span>
      ) : (
        "미상"
      ),
    },
    { label: "음양", value: record.y ?? "미상" },
    {
      label: "인명용",
      value: record.gov ? "대법원 인명용 한자" : "인명용 목록 외",
    },
  ];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-16">
        <Breadcrumb
          items={[
            { label: "한자 사전", href: "/hanja" },
            {
              label: `'${primaryReading}' 한자`,
              href: `/hanja/${encodeURIComponent(primaryReading)}`,
            },
            { label: char },
          ]}
        />

        {/* Hero */}
        <div className="mb-10 flex items-start gap-6">
          <div className="flex size-24 shrink-0 items-center justify-center rounded-xl border border-paper-line bg-paper-card sm:size-28">
            <span className="font-hanja text-6xl font-medium text-navy sm:text-7xl">
              {char}
            </span>
          </div>
          <div className="pt-1">
            <h1 className="mb-2 text-2xl font-bold text-navy sm:text-3xl">
              {char}{" "}
              <span className="font-normal text-text-2">
                ({meaningParts[0]})
              </span>
            </h1>
            <div className="flex flex-wrap gap-1.5">
              <HanjaGradeBadge grade={record.g} />
              <HanjaElementBadge element={record.e} rationale={record.w} />
              {record.y && (
                <Badge variant="outline" className="border-paper-line text-xs">
                  {record.y}
                </Badge>
              )}
              <Badge
                variant="outline"
                className="border-paper-line font-tabular text-xs"
              >
                {record.s}획
              </Badge>
            </div>
          </div>
        </div>

        {/* 기본 정보 표 */}
        <section className="mb-10 overflow-hidden rounded-xl border border-paper-line">
          <h2 className="sr-only">기본 정보</h2>
          <dl>
            {infoRows.map((row, i) => (
              <div
                key={row.label}
                className={`flex gap-4 px-5 py-3.5 text-sm ${
                  i % 2 === 0 ? "bg-paper-card" : "bg-paper-tint"
                }`}
              >
                <dt className="w-20 shrink-0 font-medium text-text-2">
                  {row.label}
                </dt>
                <dd className="m-0 text-navy">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 오행 판정 근거 */}
        {record.w && (
          <section className="mb-10 rounded-xl border-l-[3px] border-teal bg-paper-card py-4 pl-5 pr-4">
            <h2 className="mb-1.5 text-sm font-semibold text-navy">
              오행 판정 근거
            </h2>
            <p className="m-0 text-sm leading-relaxed text-text-2">
              {record.w}
            </p>
          </section>
        )}

        <CtaBanner
          char={char}
          label={`${char}(${primaryReading}) 글자가 들어간 이름의 미학 점수와 오행 조화가 궁금하신가요?`}
        />

        {/* 상생 오행 */}
        {record.e && (generates || generatedBy) && (
          <section className="mb-12">
            <h2 className="mb-2 text-base font-semibold text-navy">
              함께 쓰기 좋은 오행
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-text-2">
              {char}의 오행은 {ELEMENT_KO[record.e]}입니다.
              {generates && (
                <>
                  {" "}상생 관계인 {ELEMENT_KO[generates]} ({record.e}生
                  {generates})
                </>
              )}
              {generatedBy && (
                <>
                  {generates ? "과 " : " "}
                  {ELEMENT_KO[generatedBy]} ({generatedBy}生{record.e})
                </>
              )}{" "}
              글자와 조합하면 오행 흐름이 자연스럽습니다.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[generates, generatedBy]
                .filter((e): e is string => Boolean(e))
                .flatMap((e) => getRepresentativeChars(e, 3))
                .map((c) => (
                  <HanjaCharCard key={c} char={c} record={getHanja(c)!} />
                ))}
            </div>
          </section>
        )}

        {/* 같은 음 다른 한자 */}
        {sameReading.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-navy">
              같은 음 &lsquo;{primaryReading}&rsquo;의 다른 한자
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sameReading.slice(0, 12).map((c) => (
                <HanjaCharCard key={c} char={c} record={getHanja(c)!} />
              ))}
            </div>
            {sameReading.length > 12 && (
              <p className="mt-4 text-sm">
                <Link
                  href={`/hanja/${encodeURIComponent(primaryReading)}`}
                  className="text-teal-700 no-underline hover:underline"
                >
                  &lsquo;{primaryReading}&rsquo; 한자 {sameReading.length + 1}자
                  전체 보기 →
                </Link>
              </p>
            )}
          </section>
        )}
      </main>
      <Footer />
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { label: "한자 사전", path: "/hanja" },
            {
              label: `'${primaryReading}' 한자`,
              path: `/hanja/${encodeURIComponent(primaryReading)}`,
            },
            { label: char },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "DefinedTerm",
            name: char,
            description: record.m,
            inDefinedTermSet: {
              "@type": "DefinedTermSet",
              name: "이름의 결 인명용 한자 사전",
              url: `${SITE_URL}/hanja`,
            },
            url: `${SITE_URL}/hanja/${encodeURIComponent(char)}`,
          },
        ]}
      />
    </>
  );
}

// ---------------------------------------------------------------
// 엔트리
// ---------------------------------------------------------------

export default async function HanjaSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = resolveSlug(slug);
  if (!resolved) notFound();

  if (resolved.kind === "reading") {
    return <ReadingPage reading={resolved.reading} chars={resolved.chars} />;
  }
  return <CharPage char={resolved.char} />;
}
