// 주간 드립 게이트 — .github/workflows/weekly-drip.yml 이 부른다(`node scripts/drip-gate.mjs`).
//
// 스탬프 커밋(frontend/drip-stamp.txt)은 Vercel 전량 재빌드를 일으키는 것 말고는 하는 일이 없다 — /name 코호트는
// 빌드 날짜(KST)가 pa 이상이면 열린다(frontend/src/lib/name-seo.ts isPublished). 그래서 스탬프는 "직전 스탬프 뒤 ~ 오늘(KST)"에
// 새로 열리는 pa 가 있을 때만 만든다. 옛 게이트는 '마지막 pa 가 지났는가' 하나뿐이라, 드립을 멈춘 기간(2026-10-28 결정 —
// 10/25 다음 코호트가 12/27)에도 매주 빈 스탬프를 만들어 화면은 그대로인데 전량 재빌드(8월 청구서의 가장 큰 항목 Build CPU)와
// Render 재배포가 났다(11/01·11/08·11/15·11/22).
//
// 창의 아래 끝은 직전 실행이 아니라 직전 스탬프(파일 안의 UTC 시각)다 — 스케줄이 통째로 빠진 주(GitHub cron 드롭)가 있어도
// 다음 실행이 그 주의 pa 까지 함께 보고 스탬프한다. 스탬프 파일을 읽지 못하거나 오늘보다 뒤의 시각이면 14일 창(한 주가 빠져도 닿는다)으로
// 본다. 수동 실행의 force 는 열리는 pa 가 없어도 스탬프한다(빌드가 실패해 코호트가 안 열린 주를 다시 빌드할 때).
//
// 깃 기록은 쓰지 않는다 — actions/checkout 은 깊이 1 이라 `git log -- frontend/drip-stamp.txt` 는 늘 HEAD 를 돌려준다.
import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** 한국은 1988 년 뒤로 서머타임이 없다 — next.config.ts 의 NEXT_BUILD_DATE_KST 와 같은 셈. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 스탬프 시각을 믿을 수 없을 때 보는 창 — 스케줄이 한 주 빠져도 그 주의 pa 에 닿는다. */
export const FALLBACK_WINDOW_DAYS = 14;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** 그 순간의 KST 날짜(YYYY-MM-DD). */
export function kstDate(ms) {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** drip-stamp.txt 내용 → 순간(ms). 시간대가 적힌 ISO 시각만 받고, 아니면 null. */
export function parseStamp(text) {
  if (typeof text !== "string") return null;
  const s = text.trim();
  if (!ISO_INSTANT.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

/** name-seo.json → 개방일(pa) 목록(중복 없이 오름차순). pa 가 없는 이름(상시 공개)과 꼴이 아닌 값은 뺀다. */
export function publishDates(nameSeo) {
  const names = nameSeo && typeof nameSeo === "object" ? nameSeo.names : null;
  if (!names || typeof names !== "object") throw new Error("name-seo.json 에 names 가 없어요");
  const set = new Set();
  for (const rec of Object.values(names)) {
    const pa = rec && typeof rec === "object" ? rec.pa : undefined;
    if (typeof pa === "string" && ISO_DATE.test(pa)) set.add(pa);
  }
  return [...set].sort();
}

/**
 * 스탬프를 만들지 정한다.
 * @param {{ publishDates: string[], stampText: string | null, nowMs: number, force?: boolean }} input
 * @returns {{ stamp: boolean, today: string, since: string, basis: "stamp" | "fallback", opening: string[], reason: string }}
 */
export function decideDripStamp({ publishDates: dates, stampText, nowMs, force = false }) {
  const today = kstDate(nowMs);
  const stampMs = parseStamp(stampText);
  const stampDay = stampMs === null ? null : kstDate(stampMs);
  // 오늘보다 뒤의 스탬프(시계가 틀렸거나 손으로 적은 값)는 믿지 않는다 — 믿으면 그날까지 한 번도 스탬프하지 않는다.
  const trusted = stampDay !== null && stampDay <= today;
  const since = trusted ? stampDay : kstDate(nowMs - FALLBACK_WINDOW_DAYS * DAY_MS);
  const basis = trusted ? "stamp" : "fallback";
  // 스탬프한 날의 pa 는 그 스탬프 빌드가 이미 열었다(빌드 날짜 = 스탬프 날짜) — 그래서 아래 끝은 '초과'.
  const opening = dates.filter((pa) => pa > since && pa <= today);
  const range = `${since} 초과 ~ ${today} 이하(${basis === "stamp" ? "직전 스탬프 기준" : `스탬프를 읽지 못했거나 오늘보다 뒤라 ${FALLBACK_WINDOW_DAYS}일 창`})`;
  if (force) {
    return { stamp: true, today, since, basis, opening, reason: `수동 실행(force) — 열리는 코호트와 관계없이 스탬프 · 창 ${range}` };
  }
  if (opening.length > 0) {
    return { stamp: true, today, since, basis, opening, reason: `새로 열리는 코호트 ${opening.join(", ")} · 창 ${range}` };
  }
  const next = dates.find((pa) => pa > today);
  return {
    stamp: false,
    today,
    since,
    basis,
    opening,
    reason: `새로 열리는 코호트 없음 — 스탬프 생략 · 창 ${range} · 다음 코호트 ${next ?? "없음(모두 개방)"}`,
  };
}

function main() {
  const nameSeo = JSON.parse(readFileSync(new URL("../frontend/src/data/name-seo.json", import.meta.url), "utf8"));
  let stampText = null;
  try {
    stampText = readFileSync(new URL("../frontend/drip-stamp.txt", import.meta.url), "utf8");
  } catch {
    stampText = null; // 파일이 없으면 14일 창
  }
  const result = decideDripStamp({
    publishDates: publishDates(nameSeo),
    stampText,
    nowMs: Date.now(),
    force: process.env.DRIP_FORCE === "true",
  });
  console.log(result.reason);
  const line = `stamp=${result.stamp ? "true" : "false"}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
  else process.stdout.write(line);
}

// `node scripts/drip-gate.mjs` 로 돌 때만 — 테스트는 함수만 import 한다. 비교는 실제 경로끼리(Node 는 진입 파일의 링크를 풀어 import.meta.url 을 만든다):
// 여기서 어긋나면 출력 없이 끝나 워크플로가 말없이 스탬프하지 않으니, 명령줄 실행은 테스트가 고정한다.
function isEntryPoint() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();
