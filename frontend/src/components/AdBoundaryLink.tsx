"use client";

// 광고 경계를 넘는 링크는 미리 받지 않는 next/link — 자기 경로를 모르는 서버 컴포넌트(Footer 등)가 쓴다.
// 판정은 lib/ad-scope.ts adBoundaryPrefetch(광고를 켠 빌드에서 광고 화면 ↔ 광고 밖 화면일 때만 prefetch={false}).
// prefetch 는 HTML 에 그려지지 않아 서버 렌더와 하이드레이션 결과가 같다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { adBoundaryPrefetch } from "@/lib/ad-scope";

type AdBoundaryLinkProps = Omit<ComponentProps<typeof Link>, "prefetch" | "href"> & { href: string };

export function AdBoundaryLink({ href, ...rest }: AdBoundaryLinkProps) {
  const pathname = usePathname() ?? "";
  return <Link href={href} prefetch={adBoundaryPrefetch(pathname, href)} {...rest} />;
}
