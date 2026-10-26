/**
 * CompanyResult — 상호 추천 결과 카드
 *
 * SmartResultPage를 재사용하지 않는 이유: 그 컴포넌트는 성+이름, 음절별 한자,
 * Aesthetic/Harmony 점수를 전제로 한다. 상호는 성씨가 없고 점수축이 4종이며
 * 사용 예시·주의사항이 결과의 핵심이라 구조가 겹치지 않는다.
 */
"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import type { CompanyNameCandidate } from "@/lib/types";

// ============================================================
// 같은 이름 찾아보기 — 외부 검색 링크 (자동 조회가 아니다)
// 키프리스 결과 페이지는 GET queryText를 받는다(2026-10-21 확인: tab=trademark 상표 탭).
// ============================================================
function kiprisSearchUrl(name: string): string {
  return `https://www.kipris.or.kr/khome/search/searchResult.do?tab=trademark&queryText=${encodeURIComponent(name)}`;
}

function naverSearchUrl(name: string): string {
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(name)}`;
}

function LookupLink({
  href,
  label,
  name,
}: {
  href: string;
  label: string;
  name: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow noopener noreferrer"
      aria-label={`${name} — ${label} (새 창)`}
      className="inline-flex items-center gap-1 text-teal underline-offset-2 hover:underline"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

// ============================================================
// 점수 색 분기 — globals.css의 score 토큰을 그대로 쓴다
// ============================================================
function scoreColor(ratio: number): string {
  if (ratio >= 0.9) return "var(--color-score-high)";
  if (ratio >= 0.8) return "var(--color-score-mid)";
  if (ratio >= 0.7) return "var(--color-score-low)";
  return "var(--color-text-3)";
}

const STYLE_TINT: Record<string, string> = {
  hanja: "var(--color-gold)",
  "pure-korean": "var(--color-teal)",
  english: "var(--color-navy-500)",
};

// ============================================================
// 점수 막대
// ============================================================
function ScoreBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const ratio = max > 0 ? value / max : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-text-3">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.round(ratio * 100)}%`,
            background: scoreColor(ratio),
          }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-2">
        {value}/{max}
      </span>
    </div>
  );
}

// ============================================================
// 후보 카드
// ============================================================
export function CompanyNameCard({
  candidate,
  rank,
}: {
  candidate: CompanyNameCandidate;
  rank: number;
}) {
  const c = candidate;
  const tint = STYLE_TINT[c.style] ?? "var(--color-teal)";
  const isTop = rank === 1;

  return (
    <article
      className="rounded-2xl bg-surface p-6 shadow-sm"
      style={{
        border: isTop
          ? "1.5px solid var(--color-gold)"
          : "1px solid var(--color-border)",
      }}
    >
      {/* 머리 — 상호 · 로마자 · 총점 */}
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
              style={{ background: `${tint}1a`, color: tint }}
            >
              {c.styleLabel}
            </span>
            {isTop && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
                style={{
                  background: "var(--color-gold-50)",
                  color: "var(--color-gold-800)",
                }}
              >
                TOP PICK
              </span>
            )}
          </div>

          <h3 className="truncate text-2xl font-medium tracking-tight text-navy">
            {c.name}
            {c.hanja && (
              <span className="ml-2 font-serif text-lg text-text-3">
                {c.hanja}
              </span>
            )}
          </h3>

          <p className="mt-0.5 font-mono text-xs tracking-wide text-text-3">
            {c.romanization}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div
            className="font-mono text-2xl font-semibold tabular-nums"
            style={{ color: scoreColor(c.totalScore / 100) }}
          >
            {c.totalScore}
          </div>
          <div className="text-[10px] text-text-3">종합</div>
        </div>
      </header>

      {/* 뜻 */}
      <p className="mb-4 text-sm leading-relaxed text-text">{c.meaning}</p>

      {/* 구성 요소 */}
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
        {c.parts.map((p, i) => (
          <li key={i} className="text-xs text-text-2">
            <span
              className={c.hanja ? "font-serif text-sm text-navy" : "text-navy"}
            >
              {p.symbol}
            </span>
            {p.reading && p.reading !== p.symbol && (
              <span className="ml-1 text-text-3">{p.reading}</span>
            )}
            <span className="ml-1.5 text-text-3">· {p.meaning}</span>
          </li>
        ))}
      </ul>

      {/* 점수 4축 */}
      <div className="mb-4 space-y-1.5 rounded-xl bg-paper p-3">
        <ScoreBar label="기억성" value={c.memorability} max={30} />
        <ScoreBar label="발음" value={c.pronunciation} max={25} />
        <ScoreBar label="식별력" value={c.distinctiveness} max={25} />
        <ScoreBar label="업종적합" value={c.industryFit} max={20} />
      </div>

      {/* 사용 예시 */}
      <div className="mb-4">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-3">
          이렇게 불립니다
        </div>
        <div className="flex flex-wrap gap-1.5">
          {c.usageExamples.map((e, i) => (
            <span
              key={i}
              className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-text-2"
            >
              {e}
            </span>
          ))}
        </div>
      </div>

      {/* 추천 이유 */}
      <ul className="space-y-1">
        {c.reasons.map((r, i) => (
          <li
            key={i}
            className="flex gap-2 text-xs leading-relaxed text-text-2"
          >
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-teal" />
            <span>{r}</span>
          </li>
        ))}
      </ul>

      {/* 주의사항 — 식별력 경고가 이 기능의 핵심 가치라 눈에 띄게 둔다 */}
      {c.cautions.length > 0 && (
        <div
          className="mt-4 rounded-xl p-3"
          style={{
            background: "color-mix(in srgb, var(--color-amber-warm) 8%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--color-amber-warm) 35%, transparent)",
          }}
        >
          {c.cautions.map((w, i) => (
            <div
              key={i}
              className="flex gap-2 text-xs leading-relaxed"
              style={{ color: "var(--color-amber-warm-700)" }}
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* 확정 전 확인의 첫걸음 — 이름을 복사해 직접 검색하던 수고를 덜어 준다.
          등록 가능 여부를 판단하는 기능이 아니므로 '확인 완료'처럼 들리는 말은 쓰지 않는다 */}
      <div
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs"
        style={{ borderTop: "1px solid var(--color-divider)" }}
      >
        <span className="text-text-3">같은 이름 찾아보기</span>
        <LookupLink href={kiprisSearchUrl(c.name)} label="키프리스 상표 검색" name={c.name} />
        <LookupLink href={naverSearchUrl(c.name)} label="네이버 검색" name={c.name} />
      </div>
    </article>
  );
}

// ============================================================
// 결과 목록
// ============================================================
export function CompanyResultList({
  candidates,
}: {
  candidates: CompanyNameCandidate[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {candidates.map((c, i) => (
        <CompanyNameCard key={c.name} candidate={c} rank={i + 1} />
      ))}
    </div>
  );
}

export default CompanyResultList;
