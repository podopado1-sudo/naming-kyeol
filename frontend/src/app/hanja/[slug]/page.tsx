import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Badge } from "@/components/ui/badge";
import { HanjaCharCard } from "@/components/hanja/HanjaCharCard";
import {
  HanjaAvoidBadge,
  HanjaElementBadge,
  HanjaGradeBadge,
  HanjaVariantBadge,
} from "@/components/hanja/HanjaBadges";
import {
  cleanMeaningNote,
  elementDisputeLines,
  variantElementLine,
} from "@/components/hanja/hanja-element-text";
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
  getVariantChars,
  hasDetailPage,
  isAvoidedForNames,
  isThinReading,
  splitAvoidedChars,
  standardCharOf,
} from "@/lib/hanja-seo";
import { josa } from "@/lib/josa";
import { BASE_OPEN_GRAPH } from "@/lib/og";

/**
 * /hanja/[slug] — 한자 사전 SEO 페이지.
 *
 * slug 가 한글 1음절(독음)이면 해당 독음의 한자 목록 페이지,
 * 한자(사전 수록 글자)이면 글자 상세 페이지를 렌더한다.
 * 전부 빌드 타임 정적 생성 — 백엔드 호출 없음.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

// 전체 빌드 타임 생성 (독음 489 + 상세 글자 9,016 ≈ 9,500 페이지 — 2026-10-22 호환 한자 85자를 통합 한자에 병합한 뒤.
// 호환 한자 옛 URL 은 next.config.ts redirects 가 통합 글자 상세로 301).
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

/**
 * 구글에만 색인 제외 — 일반 robots 는 index 그대로(네이버 Yeti 가 일반 noindex 를 따라 노출이 −40% 빠진 10/6 실사고).
 * 글자 상세 전부와 thin 독음(글자 2자 이하) 페이지에 쓴다. ⚠️ 여기에 `index: false` 를 넣지 말 것.
 */
const GOOGLE_ONLY_NOINDEX: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: { index: false, follow: true },
};

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
    // 제목 틀은 바꾸지 않는다(계획 §7-1 — 대량 동시 변경 중 제목·URL·robots 는 그대로)
    const title = `이름에 쓰는 '${reading}' 한자 ${chars.length}자 — 종류·뜻·획수·오행`;
    const description = `'${reading}'${josa(reading, "으로/로")} 읽는 인명용 한자 ${chars.length}자의 뜻, 획수, 자원오행을 한눈에 비교하세요. 부수 기준 자원오행과 판정 근거를 함께 보여 드립니다.`;
    const canonical = `/hanja/${encodeURIComponent(reading)}`;
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: { ...BASE_OPEN_GRAPH, title, description, url: `${SITE_URL}${canonical}` },
      // thin 독음(글자 1~2자, 58쪽 — 감사 AS-7)은 구글에만 색인 제외. 고유 본문이 100~150자뿐이라 구글 저가치 표본이 될 수
      // 있다(애드센스 '가치가 별로 없는 콘텐츠' 거절). 네이버는 계속 색인하고, 사이트맵(/sitemap.xml)도 그대로 둔다.
      ...(isThinReading(reading) ? { robots: GOOGLE_ONLY_NOINDEX } : {}),
    };
  }

  const { char } = resolved;
  const record = getHanja(char)!;
  const meaning = record.m!.split("/").join(" · ");
  // 제목 틀은 바꾸지 않는다(계획 §7-1). 메타 설명은 '오행 X' → '자원오행 X(부수 Y)'(계획 §4-2)
  const title = `${char}(${record.r.join("·")}) — 뜻·획수·오행`;
  // 예외 적용(X — 간지·문헌·실무 예외표)은 값이 부수에서 나오지 않으니 그 사실을 괄호에 함께 적는다(甲 木(부수 田 · 예외 적용))
  const radicalPart = record.radical_char
    ? `(부수 ${record.radical_char}${record.g === "X" ? " · 예외 적용" : ""})`
    : "";
  const element = record.e ? ` · 자원오행 ${record.e}${radicalPart}` : "";
  const description = `한자 ${char}: ${meaning}. ${record.s}획${element}${
    record.y ? ` · ${record.y}` : ""
  }${
    record.gov ? " · 대법원 인명용 한자" : ""
  }. 이름에 쓰일 때의 의미와 함께 쓰기 좋은 글자를 확인하세요.`;
  const canonical = `/hanja/${encodeURIComponent(char)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { ...BASE_OPEN_GRAPH, title, description, url: `${SITE_URL}${canonical}` },
    // 글자 상세 9,096쪽은 색인 제외(2026-10-06). 애드센스가 "가치가 별로 없는 콘텐츠"로
    // 거절한 몸통이 이 구간이다 — 전체 URL의 83%가 450~750자짜리 같은 틀(당시 획수 자동 판정 5,652자는
    // "획수 기반 자동 판정"뿐). 2026-07-15 전량 사이트맵 등재 나흘 뒤 구글 유입이 급락한
    // 정황도 같다. 페이지·내부링크는 유지하고(follow) 검색 노출만 끈다. 검색 축은
    // 독음 페이지(/hanja/희)와 이름 페이지(/name/예성)다. 승인 후 코어 2,060자만 되살릴지 재검토(getCuratedChars).
    // ⚠️ 구글에만 끈다(2026-10-14). 처음엔 일반 robots noindex를 걸었는데 네이버 Yeti도 그걸
    // 따라 네이버 노출이 10/7부터 하루 6.5~7만 → 4만으로 빠졌다(서치어드바이저). 애드센스는
    // 구글 심사라 googlebot만 막으면 되고, 네이버는 이 글자 페이지들이 유입원이다.
    // 네이버 재수집용 사이트맵은 /sitemap-hanja.xml (robots.txt 미등재, 서치어드바이저에만 제출).
    robots: GOOGLE_ONLY_NOINDEX,
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
  // BMP 밖 글자(코드포인트 > 0xFFFF, 확장 B 이후 80자)는 추천 엔진이 한 글자로 받지 못해
  // /required-char가 일반 오류로 끝난다 — 막다른 버튼을 두지 않고 숨긴다 (2026-10-21)
  if ((char.codePointAt(0) ?? 0) > 0xffff) return null;
  return (
    <div className="my-10 rounded-xl border border-paper-line bg-paper-tint p-6 text-center">
      <p className="mb-4 text-sm text-text-2">{label}</p>
      <Link
        href={`/required-char?char=${encodeURIComponent(char)}`}
        rel="nofollow"
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
  // ND-5: 불용(nf) 글자는 '이름에 피하는 글자'로 따로 모은다. 각 묶음 안은 코어 → 등급 → 획수 순 그대로
  const { usable, avoided } = splitAvoidedChars(chars);
  const ordered = [...usable, ...avoided];

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
          &lsquo;{reading}&rsquo;{josa(reading, "으로/로")} 읽는 인명용 한자는 모두 {chars.length}
          자입니다.
          {avoided.length > 0 && usable.length > 0 && (
            <>
              {" "}그중 {avoided.length}자는 뜻 가운데 부정적인 풀이가 있어 이 사이트의
              이름 추천에서 쓰지 않는 글자라 아래 &lsquo;이름에 피하는 글자&rsquo;에 따로
              모았습니다.
            </>
          )}
          {avoided.length > 0 && usable.length === 0 && (
            <>
              {" "}
              {chars.length > 1 ? "모두" : "이 글자는"} 뜻 가운데 부정적인 풀이가 있어 이 사이트의
              이름 추천에서 쓰지 않는 글자입니다.
            </>
          )}
          {chars.length === 1 && getHanja(chars[0])?.e && (
            <> 부수 기준 자원오행은 {getHanja(chars[0])!.e}입니다.</>
          )}
          {chars.length > 1 && distText && <> 부수 기준 자원오행 분포는 {distText}입니다.</>}
          {chars.length > 1 && (
            <>
              {" "}강희 획수·뜻을 따로 정리한 코어 글자를 앞에 두고, 자원오행 등급(확정 → 예외
              적용 → 이견 있음)과 획수 순으로 정렬했습니다.
            </>
          )}
        </p>

        {usable.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {usable.map((char) => (
              <HanjaCharCard key={char} char={char} record={getHanja(char)!} />
            ))}
          </div>
        )}

        {avoided.length > 0 && (
          <section className={usable.length > 0 ? "mt-10" : ""}>
            <h2 className="mb-2 flex items-baseline gap-2 text-base font-semibold text-navy">
              이름에 피하는 글자
              <span className="font-tabular text-xs font-normal text-text-2">
                {avoided.length}자
              </span>
            </h2>
            <p className="mb-4 max-w-2xl text-sm leading-relaxed text-text-2">
              뜻 가운데 부정적인 풀이가 있어 이름의 결이 이름 추천과 평가의 한자 배정에서 빼는
              글자입니다. 대법원 인명용 한자 목록에 있는지와는 별개인 이 사이트의 기준이며, 글자의
              뜻과 획수는 그대로 볼 수 있습니다.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {avoided.map((char) => (
                <HanjaCharCard
                  key={char}
                  char={char}
                  record={getHanja(char)!}
                  showAvoidBadge={false}
                />
              ))}
            </div>
          </section>
        )}

        {/* 모두 피하는 글자인 독음(죄·혐 등)은 추천 버튼을 두지 않는다 */}
        {usable.length > 0 && (
          <CtaBanner
            char={reading}
            label={`'${reading}'${josa(reading, "이/가")} 들어가는 이름이 궁금하신가요? 미학 점수와 오행 조화까지 분석해 드립니다.`}
          />
        )}

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
            itemListElement: ordered
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

/** 부수 글자의 첫 훈 — 手 → '손 수', 鹵 → '소금 로'(두음 괄호 '(노)'는 뺀다). 사전에 없거나 뜻이 없으면 undefined */
function radicalGloss(radicalChar?: string): string | undefined {
  if (!radicalChar) return undefined;
  const m = getHanja(radicalChar)?.m;
  return (
    m
      ?.split(/[/,]/)[0]
      ?.replace(/\([^()]*\)$/, "")
      .trim() || undefined
  );
}

/** 상세 페이지가 있는 글자는 링크, 없으면 글자만 */
function HanjaLink({ char }: { char: string }) {
  const record = getHanja(char);
  if (!record || !hasDetailPage(record)) {
    return <span className="font-hanja">{char}</span>;
  }
  return (
    <Link
      href={`/hanja/${encodeURIComponent(char)}`}
      className="font-hanja text-teal-700 no-underline hover:underline"
    >
      {char}
    </Link>
  );
}

function CharPage({ char }: { char: string }) {
  const record = getHanja(char)!;
  const meaningParts = record.m!.split("/");
  const primaryReading = record.r[0];
  // 같은 음 목록도 이름에 쓰는 글자 먼저, 피하는 글자(nf)는 뒤로
  const sameReadingSplit = splitAvoidedChars(
    (getReadingChars(primaryReading) ?? []).filter((c) => c !== char),
  );
  const sameReading = [...sameReadingSplit.usable, ...sameReadingSplit.avoided];
  const avoided = isAvoidedForNames(record);

  // 자원오행 근거(note) 아래 이견·주의 문장 — 문구 계약은 hanja-element-text.ts 머리말
  const disputeLines = elementDisputeLines(record, josa);
  // 이체자: variant_tie(정자 판정이 약함)는 배지·정자 링크·이체자 문장을 달지 않는다
  const standard = standardCharOf(record);
  const standardRecord = standard ? getHanja(standard) : undefined;
  const variantLine =
    standard && standardRecord
      ? variantElementLine(
          {
            char,
            radical: record.radical_char,
            element: record.e,
            reading: primaryReading,
          },
          {
            char: standard,
            radical: standardRecord.radical_char,
            element: standardRecord.e,
            reading: standardRecord.r[0],
          },
          josa,
        )
      : null;
  const variants = getVariantChars(char);
  // 글자 풀이 — 옛 뜻 기반 판정 문장(mw)에서 오행 낱말이 든 문장을 뺀 것(D4: 화면에 오행 둘 금지)
  const meaningNote = cleanMeaningNote(record.mw, record.e);
  const radicalHoon = radicalGloss(record.radical_char);

  // 상생 오행 (이 글자가 생하는 오행 + 이 글자를 생하는 오행)
  const generates = record.e ? ELEMENT_GENERATES[record.e] : undefined;
  const generatedBy = record.e
    ? Object.entries(ELEMENT_GENERATES).find(([, to]) => to === record.e)?.[0]
    : undefined;

  const infoRows: { label: string; value: React.ReactNode }[] = [
    { label: "독음", value: record.r.join(", ") },
    { label: "뜻", value: meaningParts.join(" · ") },
    { label: "획수", value: `${record.s}획` },
    ...(record.radical_char
      ? [
          {
            label: "부수",
            value: (
              <span>
                <span className="font-hanja">{record.radical_char}</span>
                {radicalHoon && <> ({radicalHoon})</>}
                {record.radical && (
                  <span className="text-text-2"> · 강희 부수 {record.radical}번</span>
                )}
              </span>
            ),
          },
        ]
      : []),
    {
      label: "자원오행",
      value: record.e ? (
        <span className="flex flex-wrap items-center gap-2">
          {ELEMENT_KO[record.e] ?? record.e}
          <HanjaGradeBadge grade={record.g} vReasons={record.v_reasons} />
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
    ...(standard
      ? [
          {
            label: "이체자",
            value: (
              <span>
                정자 <HanjaLink char={standard} />의 이체자
              </span>
            ),
          },
        ]
      : variants.length > 0
        ? [
            {
              label: "이체자",
              value: (
                <span className="flex flex-wrap gap-x-2">
                  {variants.map((v) => (
                    <HanjaLink key={v} char={v} />
                  ))}
                </span>
              ),
            },
          ]
        : []),
    ...(avoided
      ? [
          {
            label: "이름 추천",
            value:
              "쓰지 않는 글자 — 뜻 가운데 부정적인 풀이가 있어 이름 추천·평가의 한자 배정에서 뺍니다",
          },
        ]
      : []),
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
              <HanjaGradeBadge grade={record.g} vReasons={record.v_reasons} />
              <HanjaElementBadge element={record.e} rationale={record.note} />
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
              {standard && (
                <HanjaVariantBadge
                  standard={standard}
                  linked={Boolean(standardRecord && hasDetailPage(standardRecord))}
                />
              )}
              {avoided && <HanjaAvoidBadge />}
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

        {/* 자원오행 근거 — note(부수·예외 근거 한 줄) + 이견·숫자 한자·이체자 문장 */}
        {record.note && (
          <section className="mb-10 rounded-xl border-l-[3px] border-teal bg-paper-card py-4 pl-5 pr-4">
            <h2 className="mb-1.5 text-sm font-semibold text-navy">
              자원오행 근거
            </h2>
            <p className="m-0 text-sm leading-relaxed text-text-2">
              {record.note}
            </p>
            {(disputeLines.length > 0 || variantLine) && (
              <ul className="mb-0 mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-text-2">
                {disputeLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {variantLine && <li>{variantLine}</li>}
              </ul>
            )}
            <p className="mb-0 mt-3 text-xs leading-relaxed text-text-2">
              자원오행은 한자의 부수로 오행을 정하는 작명 관행입니다. 이 사전은 부수마다 작명
              실무에서 가장 많이 쓰는 값을 따르고, 간지와 일부 글자는 예외표로 정하며, 자료가
              갈리면 &lsquo;이견 있음&rsquo;으로 표시합니다.{" "}
              {/* 판정 순서·등급을 설명하는 절로 바로 간다 — 앵커 id 는 method/page.tsx '04 · 자원오행 기준' (2026-10-23 운영 검증 CONTENT-4) */}
              <Link
                href="/method#resource-element"
                className="text-teal-700 no-underline hover:underline"
              >
                작명 원리 보기
              </Link>
            </p>
          </section>
        )}

        {/* 글자 풀이 — 오행 판정이 아니라 뜻 해설이다. 옛 뜻 기반 문장(mw)에서 오행 낱말이 든 문장은 뺐다 */}
        {meaningNote && (
          <section className="mb-10 rounded-xl border border-paper-line bg-paper-card px-5 py-4">
            <h2 className="mb-1.5 text-sm font-semibold text-navy">글자 풀이</h2>
            <p className="m-0 text-sm leading-relaxed text-text-2">{meaningNote}</p>
          </section>
        )}

        {/* 이름에 피하는 글자(nf)는 추천 버튼을 두지 않는다 — 필수 글자로 고정하면 엔진이 불용 글자를 그대로 쓴다 */}
        {!avoided && (
          <CtaBanner
            char={char}
            label={`${char}(${primaryReading}) 글자가 들어간 이름의 미학 점수와 오행 조화가 궁금하신가요?`}
          />
        )}

        {/* 상생 오행 — 이름에 피하는 글자(nf)에는 '함께 쓰기 좋은' 조합을 권하지 않는다 */}
        {!avoided && record.e && (generates || generatedBy) && (
          <section className="mb-12">
            <h2 className="mb-2 text-base font-semibold text-navy">
              함께 쓰기 좋은 오행
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-text-2">
              {char}의 자원오행은 {ELEMENT_KO[record.e]}입니다.
              {generates && (
                <>
                  {" "}상생 관계인 {ELEMENT_KO[generates]} ({record.e}生
                  {generates})
                </>
              )}
              {generatedBy && (
                <>
                  {/* 조사는 괄호 앞 오행 이름에 맞춘다 — 화(불)와 · 목(나무)과 */}
                  {generates ? `${josa(ELEMENT_KO[generates], "과/와")} ` : " "}
                  {ELEMENT_KO[generatedBy]} ({generatedBy}生{record.e})
                </>
              )}{" "}
              글자와 조합하면 자원오행 흐름이 자연스럽습니다.
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
