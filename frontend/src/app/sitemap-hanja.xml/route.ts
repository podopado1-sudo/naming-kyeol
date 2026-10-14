import { getAllDetailChars } from "@/lib/hanja-seo";

/**
 * /sitemap-hanja.xml — 한자 글자 상세 9,096쪽 전용 사이트맵 (네이버 서치어드바이저에만 제출).
 *
 * 글자 상세는 구글에만 noindex다(hanja/[slug] generateMetadata — googleBot noindex, robots index).
 * 공용 /sitemap.xml에 다시 넣으면 구글 서치콘솔이 "제출된 URL에 noindex" 경고를 띄우므로
 * 네이버 재수집용으로 따로 둔다. robots.txt의 Sitemap 줄에는 넣지 않는다 — 구글이 robots.txt로
 * 이 파일을 찾지 않게 하기 위해서다.
 */
export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://namingkyeol.com";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function GET() {
  const urls = getAllDetailChars()
    .map(
      (char) =>
        `<url><loc>${escapeXml(`${SITE_URL}/hanja/${encodeURIComponent(char)}`)}</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
