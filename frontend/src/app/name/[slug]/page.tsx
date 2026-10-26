import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { Badge } from "@/components/ui/badge";
import { HanjaGradeBadge } from "@/components/hanja/HanjaBadges";
import { ScoreBreakdownCard } from "@/components/results/ScoreBreakdownCard";
import { ELEMENT_KO, getHanja, getReadingChars } from "@/lib/hanja-seo";
import { getInsight, type Insight } from "@/lib/insights";
import { hasBatchim, josa, withJosa } from "@/lib/josa";
import { OG_SITE } from "@/lib/og";
import {
  glossForReading,
  genderSplit,
  getAllNames,
  getComboMeaning,
  getName,
  getSiblingNames,
  ohaengRelation,
  syllablesOf,
  toAestheticBreakdown,
  type NameScoreBreakdown,
  type NameSeoRecord,
} from "@/lib/name-seo";
import type { AestheticBreakdown } from "@/lib/types";

/**
 * /name/[이름] — 이름 뜻 SEO 페이지.
 *
 * 대법원 출생신고 빈도(인기 순위·성별 비율) + 자연어 뜻을 보여주고
 * 음절별로 /hanja/[독음], 비슷한 이름으로 /name/[이름], 관련 데이터 리포트로 /guide/[slug]
 * 내부링크를 건다.
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

/**
 * 이름 갈래 — name-seo.json 의 플래그(2026-10-22 S7, build_name_seo_data.py ← dump-name-flags):
 * - pure: pk = 한글 이름으로 쓰는 순우리말 이름(조합 유무 무관) — PureKoreanNameEngine 내장 사전에서 한자어 낱말(소망·미래·다정)과
 *   한자 이름으로 흔한 이름(예린·하린·예나)을 빼고 사전에 없는 고유어 합성 이름(한별·은별)을 더한 것
 *   (data/pure-korean-name-overrides.json). 대표 뜻은 한글 이름의 뜻이고, 조합은 '한자로 쓴다면(참고)'로 낮춘다
 *   (ND-3: 하늘 荷乻·한별 漢莂이 '추천 1순위'로 보이던 것).
 *   서사(story)는 음절별 한자 훈(dump-story-inputs 기계 글로스)으로 지은 문장이라 한글 이름 뜻과 따로 놀았다 — S7 에 해솔 '깊은 바다처럼'(海)·
 *   노을 '옥빛이 번지듯'(璐)을 손질했고, 2026-10-26 B2 에 pk 120명을 한글 뜻과 전수 대조해 59명을 한글 이름 뜻 기준 한 문장으로
 *   고쳤다(data/name-stories.json — 발행 블로그가 인용한 다온·한결은 문장 고정). build_name_seo_data.py 의 pk 서사 점검(pk_story_echoes)이
 *   1순위 조합 글자의 '그 독음의 훈' 어간을 되풀이하는 서사를 실패로 막는다(훈 글자 그대로만 보므로 뜻말 되풀이 — 한솔 '넓은 강처럼'(漢) — 는
 *   못 잡는다). 이 화면은 서사를 그대로 보여 줄 뿐이라 따로 거르지 않는다.
 * - foreign: fx = 한자 조합이 없는 외래 이름(data/foreign-given-names.json). 뜻은 어원 문장
 *   ('히브리어로 신이 더하신다는')이라 '발음이 주는 느낌·한자에 따라' 대신 '어원'으로 표기한다. 뜻이 없으면(유래가 갈리는 이름·
 *   '-엘' 조어) 그 사실을 한 줄로 적는다. 서사(story)는 내지 않는다 — 한자 없는 이름인데 한자 훈으로 지은 문장이다
 *   (다엘 '은은한 차 향처럼'(茶)·에린 '옥빛처럼'·시엘 '처음 켜진 불빛처럼').
 * - hanja: 그 밖 — 대표 뜻은 발음이 주는 느낌, 정확한 뜻은 한자 조합에 따라.
 * pk·fx 는 겹치지 않는다.
 */
type NameKind = "pure" | "foreign" | "hanja";

function nameKind(rec: NameSeoRecord): NameKind {
  if (rec.pk) return "pure";
  if (rec.fx) return "foreign";
  return "hanja";
}

/** 외래 이름(fx)인데 뜻이 없을 때 '이름 뜻' 아래 한 줄 — 어원이 갈리거나 원어 이름이 없어 비운 이름(S7 데이터 단계) */
const FOREIGN_NO_MEAN_NOTE =
  "한자 없이 한글로 쓰는 이름이라 한자 뜻이 따로 없습니다. 어원이 분명하지 않아 뜻풀이는 적지 않았습니다.";

/**
 * 미학 점수 노트 — 외래 이름(fx)에는 한자가 없으니 '한자 성별 선호도'를 '음절 성별 선호도'로 바꿔 보인다.
 * 성별 보너스는 음절마다 그 소리로 읽는 한자의 성별 선호(AestheticEngine)로 매기므로, 한자 없는 이름에서는 음절 단위 경향이다.
 */
function scoreBreakdownFor(kind: NameKind, sc: NameScoreBreakdown): AestheticBreakdown {
  const breakdown = toAestheticBreakdown(sc);
  if (kind !== "foreign") return breakdown;
  return {
    ...breakdown,
    notes: breakdown.notes.map((n) =>
      n.replace("일부 한자의 성별 선호도", "일부 음절의 성별 선호도").replace("한자 성별 선호도", "음절 성별 선호도"),
    ),
  };
}

/** 대표 뜻 아래 한 줄 — 이름 갈래별 */
function meanNote(kind: NameKind, hasCombos: boolean): string {
  if (kind === "foreign") return "외래 이름이라 한자 뜻이 아니라 이름의 유래(어원)를 적었습니다.";
  if (kind === "pure") {
    return hasCombos
      ? "이름이 주는 느낌을 풀어 쓴 것입니다. 한글 이름으로도 쓰는 이름이라, 아래 한자 조합은 한자로 쓸 때의 참고입니다."
      : "이름이 주는 느낌을 풀어 쓴 것이며, 한글 그대로 쓰는 이름입니다.";
  }
  return hasCombos
    ? "발음이 주는 느낌이며, 정확한 뜻은 아래 한자 조합에 따라 달라집니다."
    : "발음이 주는 느낌이며, 정확한 뜻은 쓰는 한자에 따라 달라집니다.";
}

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
  // 외래 이름(fx)의 뜻은 어원 문장('히브리어 야곱에서 이어진'·'셰익스피어 희곡에서 처음 쓰인')이라
  // "'…' 뜻을 담습니다"가 어색하다 — "…이름입니다"로 쓰고, 한자 조합이 없으니 '한자를 확인하세요'도 뺀다
  const foreign = nameKind(rec) === "foreign";
  const meanPart = !rec.mean
    ? ""
    : foreign
      ? ` ${withJosa(name, "은/는")} ${rec.mean} 이름입니다.`
      : ` ${withJosa(name, "은/는")} '${rec.mean}' 뜻을 담습니다.`;
  const scorePart = rec.sc ? ` 발음·미학 점수 ${rec.sc.t}점.` : "";
  const title = `${name} 이름 뜻 — 인기 순위·한자·의미`;
  const description = `${name}: ${GENDER_LABEL[gender]}.${meanPart} 출생신고 통계 기준 인기 순위와 남녀 비율${
    foreign ? "을" : ", 이름에 쓰는 한자를"
  } 확인하세요.${scorePart}`;
  const canonical = `/name/${encodeURIComponent(name)}`;
  return {
    title,
    description,
    alternates: { canonical },
    // OG_SITE만 펼친다(images 키 없음) — 세그먼트 opengraph-image.tsx가 이름별 카드를 주입하게.
    openGraph: { ...OG_SITE, title, description, url: `${SITE_URL}${canonical}` },
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
      {/* 부모는 도구(/search)가 아니라 사전 인덱스 — JSON-LD BreadcrumbList와 같게 (2026-10-21) */}
      <Link href="/name" className="text-teal-700 no-underline hover:underline">
        이름 뜻 사전
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
  극: "bg-gold-50 text-gold-800", // 土 배지와 같은 골드 글자 토큰 — 옛 gold-700 은 gold-50 위 3.40:1
  unknown: "",
};

/** 한자 조합 카드 — 글자별 훈음/획수/자원오행/판정 등급 + 두 글자 자원오행 관계(상생·비화·상극).
 * 오행은 부수 기준 자원오행(hanja-seo.json e — 2026-10-22 S4), 등급은 R 확정·V 이견 있음·X 예외 적용(g).
 * 훈음은 이름 음절의 독음에 맞춘다(乻은 하늘의 '늘' 자리에서 "음차 늘", "땅 이름 얼"이 아니라).
 * featured(1순위 강조·'추천 1순위' 라벨)는 한자 이름에만 — 순우리말 사전 이름(pk)의 조합은 참고라 강조하지 않는다(ND-3). */
function ComboCard({
  combo,
  name,
  featured,
}: {
  combo: string[];
  name: string;
  featured: boolean;
}) {
  const [c1, c2] = combo;
  const [s1, s2] = [...name];
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
        {/* 출생신고 한자 통계가 아니라 HanjaSelector.SelectCombos 1순위(빈출 한자 우선·오행·성별) —
            '가장 많이 쓰는'은 사실과 달라 정정(2026-10-07: 준혁 1순위 俊侐 등) */}
        {featured && (
          <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs text-teal-700">
            추천 1순위
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
          { ch: c1, r: r1, syl: s1 },
          { ch: c2, r: r2, syl: s2 },
        ].map(({ ch, r, syl }) => (
          <div key={ch} className="rounded-lg bg-paper-tint px-3 py-2.5">
            <div className="mb-1 flex items-baseline gap-1.5">
              <span className="font-hanja text-xl text-navy">{ch}</span>
              <span className="text-sm text-text-2">{glossForReading(r.m, syl)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-2">
              <span className="font-tabular">{r.s}획</span>
              {r.e && <span>· {ELEMENT_KO[r.e] ?? r.e}</span>}
              {/* vReasons 로 V 를 이견 있음·자료 적음·추정으로 나눈다(/hanja 글자 카드와 같은 배지) */}
              {r.g && <HanjaGradeBadge grade={r.g} vReasons={r.v_reasons} />}
            </div>
          </div>
        ))}
      </div>
      {rel.label && (
        <span
          className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${OHAENG_CHIP[rel.kind]}`}
        >
          자원오행 {rel.label}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// 관련 데이터 리포트 (content/insights → /guide/[slug])
// ---------------------------------------------------------------

const BATCHIM_LABEL = (has: boolean | null) => (has ? "받침 있음" : "받침 없음");

/** 중성 이름 리포트(unisex-names.md)의 최소 출생신고 건수 — 리포트 본문 정의와 맞춘다 */
const UNISEX_REPORT_MIN_TOTAL = 300;

/**
 * 이 이름과 이어지는 리포트 — 이름 페이지에서 리포트로 가는 링크가 0이던 것(2026-10-21 감사 AS-8).
 * 순위표에 실린 이름은 그 순위표로, 남아 비율 35~65%·출생신고 300건 이상은 중성 이름 리포트로,
 * 음절 지도·받침 패턴은 모든 이름에 건다. 파일이 없는 리포트는 조용히 빠진다.
 */
function relatedInsights(
  name: string,
  rec: NameSeoRecord,
): { insight: Insight; reason: string }[] {
  const picks: { slug: string; reason: string }[] = [];
  // 두 순위표는 남아·여아 내 순위(rm·rf) 상위 50과 같은 집합·같은 순위다(2026-10-21 대조)
  if (rec.rm && rec.rm <= 50) {
    picks.push({
      slug: "boy-names-top50",
      reason: `${withJosa(name, "은/는")} 남자 이름 ${rec.rm}위입니다. 상위 50개 이름과 그 흐름을 정리했습니다.`,
    });
  }
  if (rec.rf && rec.rf <= 50) {
    picks.push({
      slug: "girl-names-top50",
      reason: `${withJosa(name, "은/는")} 여자 이름 ${rec.rf}위입니다. 상위 50개 이름과 그 흐름을 정리했습니다.`,
    });
  }
  // 리포트(unisex-names.md) 정의와 같은 조건: 반올림 전 남아 비율 35~65% + 출생신고 300건 이상.
  // 페이지 성별 배지는 genderSplit(한쪽 60% 이상) 기준이라 두 기준이 갈리는 이름(지원 39%=여자 이름)이
  // 있다 — 그런 이름은 문구에서 두 기준을 함께 밝힌다(2026-10-21 FSC-3).
  const maleRatio = rec.m / Math.max(rec.t, 1);
  if (maleRatio >= 0.35 && maleRatio <= 0.65 && rec.t >= UNISEX_REPORT_MIN_TOTAL) {
    const { malePct, femalePct, gender } = genderSplit(rec);
    const basis = "남아 35~65%·출생신고 300건 이상을 중성 이름으로 본 리포트 기준";
    picks.push({
      slug: "unisex-names",
      reason:
        gender === "male"
          ? `${withJosa(name, "은/는")} 남아 비율 ${malePct}%라 이 페이지에서는 남자 이름으로 표시하지만, ${basis}에는 해당합니다.`
          : gender === "female"
            ? `${withJosa(name, "은/는")} 여아 비율 ${femalePct}%라 이 페이지에서는 여자 이름으로 표시하지만, ${basis}에는 해당합니다.`
            : `${withJosa(name, "은/는")} 남아 비율 ${malePct}%로, ${basis}에 해당합니다.`,
    });
  }
  const syl = syllablesOf(name);
  picks.push({
    slug: "syllable-map",
    reason: `첫 음절 ‘${syl[0]}’, 끝 음절 ‘${syl[syl.length - 1]}’ — 이름에 많이 쓰이는 첫 음절·끝 음절 순위를 정리했습니다.`,
  });
  picks.push({
    slug: "batchim-pattern",
    // 리포트는 두 음절 이름만 집계했다 — 세 음절 이름엔 꼴을 말하지 않는다
    reason:
      syl.length === 2
        ? `${withJosa(name, "은/는")} ‘${BATCHIM_LABEL(hasBatchim(syl[0]))} + ${BATCHIM_LABEL(hasBatchim(syl[1]))}’ 꼴입니다. 받침 꼴에 따라 남녀 비율이 어떻게 갈리는지 다룹니다.`
        : "받침 꼴에 따라 두 음절 이름의 남녀 비율이 어떻게 갈리는지 다룹니다.",
  });
  return picks.flatMap(({ slug, reason }) => {
    const insight = getInsight(slug);
    return insight ? [{ insight, reason }] : [];
  });
}

// ---------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------

function NamePage({ name, rec }: { name: string; rec: NameSeoRecord }) {
  const { gender, malePct, femalePct } = genderSplit(rec);
  const genderRank = gender === "male" ? rec.rm : gender === "female" ? rec.rf : undefined;
  const syllables = syllablesOf(name);
  const siblings = getSiblingNames(name, 12);
  const related = relatedInsights(name, rec);
  const kind = nameKind(rec);
  const hasCombos = !!rec.combos?.length;

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
              {kind === "foreign" && (
                <span className="mr-2 inline-block rounded-md bg-paper-tint px-2 py-0.5 align-middle text-xs font-medium text-text-2">
                  어원
                </span>
              )}
              {rec.mean} 이름
            </p>
          )}
          {rec.mean && (
            <p className="mt-2 text-sm text-text-2">{meanNote(kind, hasCombos)}</p>
          )}
          {!rec.mean && kind === "foreign" && (
            <p className="mt-2 text-sm text-text-2">{FOREIGN_NO_MEAN_NOTE}</p>
          )}
          {rec.story && kind !== "foreign" && (
            <p className="mt-3 border-l-2 border-gold pl-3 text-[15px] leading-relaxed text-navy">
              “{rec.story}”
            </p>
          )}
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
            {withJosa(name, "은/는")} 대법원 출생신고 통계에서{" "}
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
              aesthetic={scoreBreakdownFor(kind, rec.sc)}
              totalScore={rec.sc.t}
            />
            <p className="mt-3 text-sm text-text-2">
              성씨와 사주 오행까지 반영한 점수는{" "}
              {/* /evaluate는 클라이언트 네비 잔상 버그로 풀 페이지 이동(<a>) — 아래 CTA와 동일 패턴 */}
              <a
                href={`/evaluate?name=${encodeURIComponent(name)}`}
                rel="nofollow"
                className="text-teal-700 hover:underline"
              >
                이름 평가
              </a>
              에서 확인하세요.
            </p>
          </section>
        )}

        {/* 한자 조합 — 순서는 HanjaSelector.SelectCombos(빈출 한자 우선 + 두 글자 자원오행 상생 +20·비화 +8·상극 −12의
            작은 가산, 계획 §3-3 문구). 순우리말 사전 이름(pk)은 '한자로 쓴다면(참고)'로 낮춘다(ND-3) */}
        {rec.combos && rec.combos.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-2 text-base font-semibold text-navy">
              {kind === "pure"
                ? `${withJosa(name, "을/를")} 한자로 쓴다면(참고)`
                : `${name}에 쓰는 한자 조합`}
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-text-2">
              {kind === "pure"
                ? "한글 이름으로도 쓰는 이름이라 한자가 꼭 필요하지는 않습니다. 아래는 한자로 쓴다면 소리에 맞는 한자 가운데 이름에 흔히 쓰는 글자를 우선해 고른 참고 조합이며, 한글 이름의 뜻과는 다를 수 있습니다."
                : "발음은 같아도 한자에 따라 뜻이 달라집니다. 이름에 흔히 쓰는 한자를 우선하고, 비슷한 조합 사이에서는 두 글자의 자원오행(한자의 부수로 정하는 오행)이 상생하는 쪽을 앞에 둔 추천 순서이며, 출생신고에 실제로 쓰인 한자 통계는 아닙니다."}
            </p>
            <div className="grid gap-3">
              {rec.combos.map((combo, i) => (
                <ComboCard
                  key={combo.join("")}
                  combo={combo}
                  name={name}
                  featured={kind !== "pure" && i === 0}
                />
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
                  {/* 외래 이름(fx)의 한자 없는 음절(요셉의 '셉')은 순우리말이 아니다 */}
                  &lsquo;{syl}&rsquo; ({kind === "foreign" ? "한자 없음" : "순우리말"})
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
              rel="nofollow"
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
              &lsquo;{name[0]}&rsquo;{josa(name[0], "으로/로")} 시작하는 다른 이름
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

        {/* 관련 데이터 리포트 */}
        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-base font-semibold text-navy">
              관련 데이터 리포트
            </h2>
            <ul className="grid gap-3">
              {related.map(({ insight, reason }) => (
                <li key={insight.slug}>
                  <Link
                    href={`/guide/${insight.slug}`}
                    className="block rounded-xl border border-paper-line bg-paper-card px-4 py-3 no-underline transition hover:border-teal"
                  >
                    <span className="block text-sm font-semibold text-navy">
                      {insight.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-text-2">
                      {reason}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
                name: "이름 뜻 사전",
                item: `${SITE_URL}/name`,
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
              name: "이름의 결 이름 뜻 사전",
              url: `${SITE_URL}/name`,
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
