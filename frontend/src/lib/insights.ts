/**
 * 데이터 리포트(/guide/[slug]) 로더 — content/insights/*.md
 *
 * 빌드 타임에 파일을 읽어 프런트매터(title/description/date/updated)와 본문을 HTML로 바꾼다.
 * 의존성 없이 마크다운 부분집합만 지원: 제목(#~###), 문단, **굵게**, *기울임*, 링크, 목록(-, 1.),
 * 표(| a | b |), 인용(>), 구분선(---). 본문은 리포 안의 우리 글이라 HTML 이스케이프 후 그대로 싣는다.
 *
 * 왜 있나(2026-10-06): 애드센스가 "가치가 별로 없는 콘텐츠"로 거절 — 사이트에 직접 쓴 글이 2편뿐이었다.
 * 출생신고 통계·한자 사전이라는 이 사이트만의 데이터로 쓴 리포트를 늘려 편집 콘텐츠 축을 만든다.
 */
import fs from "node:fs";
import path from "node:path";

export interface InsightMeta {
  slug: string;
  title: string;
  description: string;
  /** 최초 게시일 (YYYY-MM-DD) */
  date: string;
  /** 마지막 갱신일 (YYYY-MM-DD) */
  updated: string;
  /** 상단 작은 라벨 */
  eyebrow: string;
}

export interface Insight extends InsightMeta {
  html: string;
  readingMinutes: number;
}

const DIR = path.join(process.cwd(), "content", "insights");

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  return { meta, body: raw.slice(m[0].length) };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const safe = /^(https?:\/\/|\/|#)/.test(href) ? href : "#";
    const external = /^https?:\/\//.test(safe);
    return `<a href="${safe}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
  });
  return t;
}

function headingId(text: string, n: number): string {
  // 한글 음절·영숫자만 남긴다 (유니코드 속성 이스케이프는 타깃에 따라 못 쓰므로 범위로 지정)
  const base = text.replace(/[^0-9A-Za-z가-힣]+/g, "-").replace(/^-|-$/g, "");
  return base ? `${base}-${n}` : `h-${n}`;
}

function renderTable(rows: string[]): string {
  const cells = (r: string) =>
    r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const header = cells(rows[0]);
  const body = rows.slice(1).filter((r) => !/^\|\s*:?-{2,}/.test(r));
  const th = header.map((h) => `<th>${inline(h)}</th>`).join("");
  const tr = body
    .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const para: string[] = [];
  let headings = 0;
  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para.length = 0;
    }
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flush();
      // 페이지 h1은 제목이 쓰므로 본문은 h2부터: #·## → h2, ### → h3
      const level = Math.min(Math.max(h[1].length, 2), 4);
      const text = h[2].trim();
      headings++;
      out.push(`<h${level} id="${headingId(text, headings)}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }
    if (/^-{3,}$/.test(line.trim())) {
      flush();
      out.push("<hr/>");
      i++;
      continue;
    }
    if (line.startsWith("> ")) {
      flush();
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        q.push(lines[i].slice(2));
        i++;
      }
      out.push(`<blockquote><p>${inline(q.join(" "))}</p></blockquote>`);
      continue;
    }
    if (line.startsWith("|")) {
      flush();
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i]);
        i++;
      }
      out.push(renderTable(rows));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`);
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  return out.join("\n");
}

function load(file: string): Insight | null {
  const slug = file.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(DIR, file), "utf8");
  const { meta, body } = parseFrontmatter(raw);
  if (!meta.title || !meta.description || !meta.date) return null;
  const textLength = body.replace(/\|.*\|/g, "").replace(/[#*>\-|]/g, "").length;
  return {
    slug,
    title: meta.title,
    description: meta.description,
    date: meta.date,
    updated: meta.updated || meta.date,
    eyebrow: meta.eyebrow || "데이터 리포트",
    html: renderMarkdown(body),
    readingMinutes: Math.max(1, Math.round(textLength / 500)),
  };
}

let CACHE: Insight[] | null = null;

/** 게시일 내림차순 전체 목록 */
export function getAllInsights(): Insight[] {
  if (CACHE) return CACHE;
  if (!fs.existsSync(DIR)) return (CACHE = []);
  const list = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map(load)
    .filter((x): x is Insight => x !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
  return (CACHE = list);
}

export function getInsight(slug: string): Insight | undefined {
  return getAllInsights().find((a) => a.slug === slug);
}
