import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HanjaSeoRecord } from "@/lib/hanja-seo";
import {
  hasDetailPage,
  isAvoidedForNames,
  standardCharOf,
} from "@/lib/hanja-seo";
import {
  HanjaAvoidBadge,
  HanjaElementBadge,
  HanjaGradeBadge,
} from "./HanjaBadges";

/**
 * 카드를 흐리게 그리는 글자 — 옛 규칙은 획수 자동 판정(D등급)이었다(2026-10-22 폐지).
 * 지금은 자원오행을 정하지 못한 글자(U 미상)와 이름에 피하는 글자(불용 nf)만 흐린다.
 * 이견 있음(V)은 흐리지 않는다 — 祐·禮처럼 이름에 흔한 글자가 많고, 값이 틀렸다는 뜻이 아니다.
 */
export function isDimmedCard(record: HanjaSeoRecord): boolean {
  return record.g === "U" || isAvoidedForNames(record);
}

/**
 * 독음 페이지 / 상세 페이지 "같은 음 한자" 그리드에서 쓰는 글자 카드.
 * 상세 페이지가 있는 글자만 링크 처리 (뜻/획수 미비 글자는 정보만 표시).
 * showAvoidBadge=false 는 '이름에 피하는 글자' 소구획처럼 묶음 제목이 이미 그렇게 말하는 곳에서 쓴다.
 */
export function HanjaCharCard({
  char,
  record,
  showAvoidBadge = true,
}: {
  char: string;
  record: HanjaSeoRecord;
  showAvoidBadge?: boolean;
}) {
  const linked = hasDetailPage(record);
  const standard = standardCharOf(record);

  const body = (
    <div
      className={cn(
        "flex h-full items-center gap-3 rounded-lg border border-paper-line bg-paper-card p-3 transition",
        linked && "hover:border-teal hover:shadow-sm",
        isDimmedCard(record) && "opacity-75",
      )}
    >
      <span className="font-hanja text-3xl font-medium text-navy">{char}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy">
          {record.m ?? record.r.join(", ")}
        </p>
        {standard && (
          <p className="truncate text-xs text-text-2">
            <span className="font-hanja">{standard}</span>의 이체자
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          <HanjaGradeBadge grade={record.g} vReasons={record.v_reasons} />
          <HanjaElementBadge element={record.e} rationale={record.note} />
          {record.s != null && (
            <Badge
              variant="outline"
              className="border-paper-line font-tabular text-xs"
            >
              {record.s}획
            </Badge>
          )}
          {showAvoidBadge && isAvoidedForNames(record) && <HanjaAvoidBadge />}
        </div>
      </div>
    </div>
  );

  if (!linked) return body;
  return (
    <Link
      href={`/hanja/${encodeURIComponent(char)}`}
      className="block no-underline"
    >
      {body}
    </Link>
  );
}
