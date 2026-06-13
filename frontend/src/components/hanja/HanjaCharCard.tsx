import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HanjaSeoRecord } from "@/lib/hanja-seo";
import { hasDetailPage } from "@/lib/hanja-seo";
import { HanjaGradeBadge, HanjaElementBadge } from "./HanjaBadges";

/**
 * 독음 페이지 / 상세 페이지 "같은 음 한자" 그리드에서 쓰는 글자 카드.
 * 상세 페이지가 있는 글자만 링크 처리 (뜻/획수 미비 글자는 정보만 표시).
 */
export function HanjaCharCard({
  char,
  record,
}: {
  char: string;
  record: HanjaSeoRecord;
}) {
  const linked = hasDetailPage(record);
  const isD = record.g === "D";

  const body = (
    <div
      className={cn(
        "flex h-full items-center gap-3 rounded-lg border border-paper-line bg-paper-card p-3 transition",
        linked && "hover:border-teal hover:shadow-sm",
        isD && "opacity-75",
      )}
    >
      <span className="font-hanja text-3xl font-medium text-navy">{char}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy">
          {record.m ?? record.r.join(", ")}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <HanjaGradeBadge grade={record.g} />
          <HanjaElementBadge element={record.e} rationale={record.w} />
          {record.s != null && (
            <Badge
              variant="outline"
              className="border-paper-line font-tabular text-xs"
            >
              {record.s}획
            </Badge>
          )}
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
