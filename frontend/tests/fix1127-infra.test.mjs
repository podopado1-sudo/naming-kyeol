// 배포 설정 — `npm test` (G-infra, 2026-11-27)
//
// deploy-skip-head-only: Vercel ignoreCommand 가 `git diff --quiet HEAD^ HEAD` 로 push 의 맨 위 커밋 하나만 보아, 프런트 커밋 위에 docs 커밋을
//   얹어 한 번에 push 하면 프런트 변경이 말없이 배포되지 않았다(9/24 실사고 — CSP 커밋 92fec00 이 docs 커밋 밑에 묶여 40분 미배포).
//   이제 마지막 성공 배포(VERCEL_GIT_PREVIOUS_SHA — Vercel 문서: Ignored Build Step 이 있을 때만, 브랜치 첫 배포에는 빈 값)부터 이번 커밋까지를 본다.
//   ⚠️ 종료 코드는 0(생략)·1(빌드) 둘뿐이어야 한다 — 처음 꼴은 앞 배포 SHA 가 얕은 clone(깊이 10) 밖이면 git diff 가 128 로 끝났고,
//   Vercel 은 그것을 빌드가 아니라 배포 실패로 처리했다(2026-11-27 운영 — 30커밋 push 의 배포가 3초 만에 failure, 문서: '0 또는 1').
//   그래서 이전 SHA 가 없거나·같거나·clone 에 없거나·비교가 실패하면 모두 1(빌드)이다 — 모르면 빌드 쪽.
//   같은 SHA 다시 배포(대시보드 Redeploy — 기본으로 Ignored Build Step 을 돈다)도 빌드한다.
// weekly-drip-empty-stamps: 주간 드립이 열 이름이 없는 정지 기간에도 매주 스탬프 커밋(→ 전량 재빌드·Render 재배포)을 만들었다.
//   게이트를 scripts/drip-gate.mjs 로 빼고, 직전 스탬프 뒤 ~ 오늘(KST)에 새로 열리는 pa 가 있을 때만 스탬프, 커밋 메시지에 [skip render].
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const GATE_PATH = join(REPO, "scripts", "drip-gate.mjs");
const { decideDripStamp, publishDates, parseStamp, kstDate, FALLBACK_WINDOW_DAYS } = await import(pathToFileURL(GATE_PATH).href);

const readRepo = (rel) => readFileSync(join(REPO, rel), "utf8").replace(/\r\n/g, "\n"); // Windows 체크아웃(autocrlf)도 같은 결과

// ── deploy-skip-head-only ────────────────────────────────────────────────────

const CMD = (path) =>
  `P=$VERCEL_GIT_PREVIOUS_SHA; [ -n "$P" ] && [ "$P" != "$VERCEL_GIT_COMMIT_SHA" ] && git cat-file -e "$P^{commit}" 2>/dev/null && git diff --quiet "$P" HEAD -- ${path} && exit 0; exit 1`;
const ignoreCommandOf = (rel) => JSON.parse(readRepo(rel)).ignoreCommand;

test("frontend/vercel.json — 마지막 성공 배포부터 이번 커밋까지 frontend(루트 디렉터리) 안을 비교한다", () => {
  const cmd = ignoreCommandOf("frontend/vercel.json");
  assert.equal(cmd, CMD("."));
  assert.doesNotMatch(cmd, /HEAD\^ HEAD/, "옛 꼴(맨 위 커밋 하나만 비교)이 남아 있다");
  // vercel.json 스키마(https://openapi.vercel.sh/vercel.json)의 ignoreCommand maxLength
  assert.ok(cmd.length <= 256, `ignoreCommand ${cmd.length}자 — 256자를 넘으면 Vercel 이 설정을 거절한다`);
});

test("루트 vercel.json — 프로젝트 루트가 저장소 루트일 때를 위해 같은 꼴로 frontend 를 본다(지우지 않는다)", () => {
  const cmd = ignoreCommandOf("vercel.json");
  assert.equal(cmd, CMD("frontend"));
  assert.ok(cmd.length <= 256);
});

/** sh 를 찾는다 — PATH 에 없으면(Windows PowerShell) Git for Windows 의 sh.exe. 없으면 null(행동 시험은 건너뛴다). */
function findSh() {
  const probe = spawnSync("sh", ["-c", "exit 0"]);
  if (!probe.error && probe.status === 0) return "sh";
  const ep = spawnSync("git", ["--exec-path"], { encoding: "utf8" });
  if (ep.error || ep.status !== 0) return null;
  const gitRoot = resolve(ep.stdout.trim(), "..", "..", "..");
  for (const rel of ["bin/sh.exe", "usr/bin/sh.exe", "bin/sh"]) {
    const p = join(gitRoot, rel);
    if (existsSync(p)) return p;
  }
  return null;
}

/** 훅 안에서 돌아도 임시 저장소를 건드리게 — 바깥 저장소를 가리키는 GIT_* 를 뺀다. */
function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_COMMON_DIR", "VERCEL_GIT_PREVIOUS_SHA", "VERCEL_GIT_COMMIT_SHA"]) delete env[k];
  return { ...env, ...extra };
}

const SH = findSh();

test("ignoreCommand 행동 — 얕은 clone 에서 묶어 push·첫 배포·clone 밖 SHA·다시 배포", { skip: SH ? false : "sh 를 찾지 못함" }, (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "fix1127-infra-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const src = join(tmp, "src");
  mkdirSync(join(src, "frontend"), { recursive: true });
  mkdirSync(join(src, "docs"), { recursive: true });
  const git = (cwd, ...args) => {
    const r = spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "core.autocrlf=false", ...args], {
      cwd,
      encoding: "utf8",
      env: cleanEnv(),
    });
    assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const commit = (rel, text, msg) => {
    writeFileSync(join(src, rel), text);
    git(src, "add", "-A");
    git(src, "commit", "-q", "-m", msg);
    return git(src, "rev-parse", "HEAD");
  };
  git(src, "init", "-q");
  writeFileSync(join(src, "docs", "d.md"), "d0\n");
  const c0 = commit("frontend/a.txt", "a0\n", "c0");
  const c1 = commit("docs/d.md", "d1\n", "docs 1");
  const front = commit("frontend/a.txt", "a1\n", "프런트 수정");
  const top = commit("docs/d.md", "d2\n", "docs 위에 얹음");
  // Vercel 은 --depth=10 으로 받는다 — 여기서는 3 으로 줄여 c0 가 clone 밖에 있게 한다
  const clone = join(tmp, "clone");
  git(tmp, "clone", "-q", "--depth=3", pathToFileURL(src).href, clone);

  const run = (cwd, cmd, prev, cur) => {
    const extra = {};
    if (prev !== undefined) extra.VERCEL_GIT_PREVIOUS_SHA = prev;
    if (cur !== undefined) extra.VERCEL_GIT_COMMIT_SHA = cur;
    return spawnSync(SH, ["-c", cmd], { cwd, encoding: "utf8", env: cleanEnv(extra) }).status;
  };
  const cases = [
    // [설명, 이전 SHA, 이번 SHA, 기대 종료 코드 — 0 이면 빌드 생략, 그 밖은 빌드]
    ["프런트 커밋 위에 docs 커밋을 얹어 한 번에 push(9/24) — 빌드", c1, top, 1],
    ["마지막 성공 배포가 프런트 커밋이고 그 위 docs 만 — 생략", front, top, 0],
    ["브랜치 첫 배포(이전 SHA 빈 값) — 빌드", "", top, 1],
    ["이전 SHA 가 얕은 clone 밖 — 빌드(옛 꼴은 git 128 → Vercel 배포 실패, 11/27 운영)", c0, top, 1],
    ["이전 SHA 가 저장소에 없는 값 — 빌드", "0000000000000000000000000000000000000000", top, 1],
    ["같은 SHA 다시 배포(Redeploy) — 빌드", top, top, 1],
    ["git 정보가 없는 배포(두 값 모두 없음) — 빌드", undefined, undefined, 1],
  ];
  const fCmd = ignoreCommandOf("frontend/vercel.json");
  const rCmd = ignoreCommandOf("vercel.json");
  for (const [label, prev, cur, want] of cases) {
    assert.ok(want === 0 || want === 1, "Vercel 이 받는 종료 코드는 0·1 뿐");
    assert.equal(run(join(clone, "frontend"), fCmd, prev, cur), want, `frontend/vercel.json: ${label}`);
    assert.equal(run(clone, rCmd, prev, cur), want, `vercel.json: ${label}`);
  }
  // 원본 — 옛 명령은 묶어 push 한 경우를 생략(0)했다
  assert.equal(run(join(clone, "frontend"), "git diff --quiet HEAD^ HEAD -- . ", c1, top), 0);
});

// ── weekly-drip-empty-stamps ─────────────────────────────────────────────────

/** 일요일(KST) 05:23 = 전날 20:23 UTC — weekly-drip.yml 의 cron. */
const sundayRun = (kstDay) => Date.parse(`${kstDay}T05:23:00+09:00`);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const weekly = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 7)) out.push(d);
  return out;
};
/** 지금(2026-11-27) 일정과 같은 꼴 — 9/06~10/25 개방, 10/28 정지 결정으로 다음 코호트 12/27~2027-05-23. */
const SCHEDULE = [...weekly("2026-09-06", "2026-10-25"), ...weekly("2026-12-27", "2027-05-23")];
/** 저장소의 마지막 실제 스탬프(2026-11-22 일 09:29 KST — cron 지연). */
const LAST_STAMP = "2026-11-22T00:29:28Z\n";
const stampOf = (ms) => `${new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")}\n`; // date -u +"%Y-%m-%dT%H:%M:%SZ" 꼴

test("kstDate·parseStamp — KST 날짜 경계와 스탬프 꼴", () => {
  assert.equal(kstDate(Date.parse("2026-12-26T14:59:59Z")), "2026-12-26");
  assert.equal(kstDate(Date.parse("2026-12-26T15:00:00Z")), "2026-12-27");
  assert.equal(parseStamp(LAST_STAMP), Date.parse("2026-11-22T00:29:28Z"));
  assert.equal(parseStamp("2026-09-23T16:10:07Z"), Date.parse("2026-09-23T16:10:07Z")); // 9/24 손 스탬프
  assert.equal(parseStamp("2026-11-22T09:29:28+09:00"), Date.parse("2026-11-22T00:29:28Z"));
  for (const bad of ["", "  ", "garbage", "2026-11-22", "2026-11-22T00:29:28", "2026-13-45T99:99:99Z", null, undefined]) {
    assert.equal(parseStamp(bad), null, JSON.stringify(bad));
  }
});

test("publishDates — 개방일만 중복 없이 오름차순, pa 없는 이름(상시 공개)과 꼴이 아닌 값은 뺀다", () => {
  const data = { names: { 서윤: { pa: "2026-12-27" }, 지우: {}, 하준: { pa: "2026-09-06" }, 도윤: { pa: "2026-12-27" }, 예준: { pa: "" }, 시우: { pa: "12/27" } } };
  assert.deepEqual(publishDates(data), ["2026-09-06", "2026-12-27"]);
  assert.throws(() => publishDates({}), /names/);
});

test("드립 정지 기간(11/29~12/20)에는 스탬프하지 않고, 12/27 코호트가 열리는 날 스탬프한다", () => {
  for (const day of ["2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20"]) {
    const r = decideDripStamp({ publishDates: SCHEDULE, stampText: LAST_STAMP, nowMs: sundayRun(day) });
    assert.equal(r.stamp, false, day);
    assert.equal(r.basis, "stamp");
    assert.equal(r.since, "2026-11-22");
    assert.deepEqual(r.opening, []);
    assert.match(r.reason, /다음 코호트 2026-12-27/);
  }
  const open = decideDripStamp({ publishDates: SCHEDULE, stampText: LAST_STAMP, nowMs: sundayRun("2026-12-27") });
  assert.equal(open.stamp, true);
  assert.deepEqual(open.opening, ["2026-12-27"]);
  // cron 이 몇 시간 밀려도(11/22 은 09:29 KST) 같은 날이다
  assert.equal(decideDripStamp({ publishDates: SCHEDULE, stampText: LAST_STAMP, nowMs: Date.parse("2026-12-27T00:29:00Z") }).stamp, true);
});

test("스탬프한 날 다시 돌리면(수동 실행) 생략, 다음 주는 그 주 코호트로 스탬프", () => {
  const stamped = stampOf(sundayRun("2026-12-27"));
  assert.equal(decideDripStamp({ publishDates: SCHEDULE, stampText: stamped, nowMs: Date.parse("2026-12-27T15:00:00+09:00") }).stamp, false);
  const next = decideDripStamp({ publishDates: SCHEDULE, stampText: stamped, nowMs: sundayRun("2027-01-03") });
  assert.equal(next.stamp, true);
  assert.deepEqual(next.opening, ["2027-01-03"]);
});

test("스케줄이 한 주 통째로 빠지면 다음 실행이 밀린 코호트까지 함께 스탬프한다", () => {
  const r = decideDripStamp({ publishDates: SCHEDULE, stampText: stampOf(sundayRun("2027-01-03")), nowMs: sundayRun("2027-01-17") });
  assert.equal(r.stamp, true);
  assert.deepEqual(r.opening, ["2027-01-10", "2027-01-17"]);
});

test("마지막 코호트(2027-05-23) 뒤에는 스탬프하지 않는다", () => {
  const r = decideDripStamp({ publishDates: SCHEDULE, stampText: stampOf(sundayRun("2027-05-23")), nowMs: sundayRun("2027-05-30") });
  assert.equal(r.stamp, false);
  assert.match(r.reason, /없음\(모두 개방\)/);
});

test(`스탬프를 읽지 못하거나 오늘보다 뒤의 시각이면 ${FALLBACK_WINDOW_DAYS}일 창으로 본다`, () => {
  for (const stampText of [null, "", "garbage", "2099-01-01T00:00:00Z"]) {
    const quiet = decideDripStamp({ publishDates: SCHEDULE, stampText, nowMs: sundayRun("2026-12-13") });
    assert.equal(quiet.stamp, false, `정지 기간 ${JSON.stringify(stampText)}`);
    assert.equal(quiet.basis, "fallback");
    assert.equal(quiet.since, "2026-11-29");
    const open = decideDripStamp({ publishDates: SCHEDULE, stampText, nowMs: sundayRun("2027-01-03") });
    assert.equal(open.stamp, true, `개방 주 ${JSON.stringify(stampText)}`);
    assert.deepEqual(open.opening, ["2026-12-27", "2027-01-03"]); // 한 주가 빠져도 닿는다
  }
});

test("수동 실행의 force 는 열리는 코호트가 없어도 스탬프한다", () => {
  const r = decideDripStamp({ publishDates: SCHEDULE, stampText: LAST_STAMP, nowMs: sundayRun("2026-12-06"), force: true });
  assert.equal(r.stamp, true);
  assert.deepEqual(r.opening, []);
  assert.match(r.reason, /force/);
});

test("주마다 돌려 보기 — 코호트마다 정확히 한 번 스탬프, 옛 게이트의 빈 스탬프 4번이 없다", () => {
  const maxPa = SCHEDULE[SCHEDULE.length - 1];
  const oldGate = (nowMs) => !(kstDate(nowMs) > maxPa); // 옛 워크플로: 오늘(KST) > 마지막 pa 일 때만 생략
  let stampText = LAST_STAMP;
  const stamped = [];
  const oldStamped = [];
  const opened = [];
  for (const day of weekly("2026-11-29", "2027-07-04")) {
    const nowMs = sundayRun(day);
    if (oldGate(nowMs)) oldStamped.push(day);
    const r = decideDripStamp({ publishDates: SCHEDULE, stampText, nowMs });
    if (r.stamp) {
      stamped.push(day);
      opened.push(...r.opening);
      stampText = stampOf(nowMs);
    }
  }
  const future = SCHEDULE.filter((pa) => pa > "2026-11-22");
  assert.deepEqual(stamped, future, "스탬프한 일요일 = 코호트가 열리는 일요일");
  assert.deepEqual(opened, future, "모든 코호트가 한 번씩 열린다");
  assert.deepEqual(
    oldStamped.filter((d) => !future.includes(d)),
    ["2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20"],
    "원본 — 옛 게이트는 정지 기간에도 스탬프했다",
  );
});

test("weekly-drip.yml — 게이트는 scripts/drip-gate.mjs, 두 단계 모두 stamp 출력으로, 커밋 메시지에 [skip render]", () => {
  const yml = readRepo(".github/workflows/weekly-drip.yml");
  assert.match(yml, /^\s+run: node scripts\/drip-gate\.mjs\s*$/m);
  assert.match(yml, /^\s+id: gate\s*$/m);
  assert.equal(yml.match(/if: steps\.gate\.outputs\.stamp == 'true'/g)?.length, 2, "스탬프·커밋 두 단계");
  assert.doesNotMatch(yml, /outputs\.skip|MAX_PA|python3/, "옛 게이트('마지막 pa 경과' 하나)가 남아 있다");
  assert.match(yml, /git commit -m "chore\(drip\): weekly cohort release stamp \[skip render\]"/);
  assert.match(yml, /DRIP_FORCE: \$\{\{ inputs\.force \}\}/);
  assert.match(yml, /force:\s*\n\s+description: [^\n]+\n\s+type: boolean\n\s+default: false/);
  // 스탬프 단계가 쓰는 꼴을 게이트가 읽는다
  assert.match(yml, /date -u \+"%Y-%m-%dT%H:%M:%SZ" > frontend\/drip-stamp\.txt/);
  assert.notEqual(parseStamp(readRepo("frontend/drip-stamp.txt")), null, "커밋된 스탬프를 읽지 못한다");
});

test("drip-gate.mjs 명령줄 — 저장소 데이터를 읽어 GITHUB_OUTPUT 에 stamp 한 줄을 쓴다", (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "fix1127-drip-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  for (const [force, want] of [["", /^stamp=(true|false)\n$/], ["true", /^stamp=true\n$/]]) {
    const out = join(tmp, `out-${force || "none"}.txt`);
    writeFileSync(out, "");
    const r = spawnSync(process.execPath, [GATE_PATH], { cwd: dirname(GATE_PATH), encoding: "utf8", env: cleanEnv({ GITHUB_OUTPUT: out, DRIP_FORCE: force }) });
    assert.equal(r.status, 0, r.stderr);
    assert.match(readFileSync(out, "utf8"), want);
    assert.match(r.stdout, /창 \d{4}-\d{2}-\d{2} 초과 ~ \d{4}-\d{2}-\d{2} 이하/);
  }
});
