/**
 * /method — 작명 원리
 * "전문가 감수" 대신 시스템이 실제 사용하는 원칙을 솔직하게 설명하는 페이지.
 *
 * 2026-10-22 자원오행 전환(S7, docs/plan-radical-ohaeng-2026-10.md §4-2): 자원오행 = 부수 기준(Unihan 18.0 kRSUnicode)으로
 * 정의를 다시 쓰고, 판정 순서·등급 4종(확정·이견 있음·예외 적용·미상)·학계의 '불명'을 '04 · 자원오행 기준'(#resource-element)에 둔다.
 * 글자 수는 /hanja 데이터(hanja-seo.json)에서 빌드 때 센다 — 손으로 고치지 말 것.
 */
import Link from "next/link";
import {
  BarChart3,
  Bot,
  Check,
  Compass,
  Database,
  FileText,
  Info,
  Leaf,
  Music,
  ShieldCheck,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import rawHanja from "@/data/hanja-seo.json";

// ============================================================
// /hanja 데이터에서 센 수치 (빌드 타임)
// ============================================================
type GradeCode = "R" | "V" | "X" | "U";

const HANJA_STATS = (() => {
  const records = Object.values(
    rawHanja as unknown as Record<string, { g?: string; c?: number }>,
  );
  const grade: Record<GradeCode, number> = { R: 0, V: 0, X: 0, U: 0 };
  let core = 0;
  for (const r of records) {
    if (r.g === "R" || r.g === "V" || r.g === "X" || r.g === "U") grade[r.g]++;
    if (r.c) core++;
  }
  return { total: records.length, core, grade };
})();

const fmt = (n: number) => n.toLocaleString("ko-KR");

/** 데이터 리포트 '자원오행은 어떻게 정하나' (content/insights/resource-element-radicals.md) */
const RESOURCE_ELEMENT_REPORT = "/guide/resource-element-radicals";

// ============================================================
// 데이터 구조
// ============================================================
interface PillarRow {
  label: string;
  weight: number; // 만점 (예: 30)
  detail: string;
}

interface PrincipleCard {
  icon: LucideIcon;
  title: string;
  body: string;
}

const AESTHETIC_ROWS: PillarRow[] = [
  { label: "발음", weight: 30, detail: "자음·모음 흐름, 동음 반복 회피, 입에 붙는지" },
  { label: "리듬", weight: 25, detail: "음절 강약, 받침 분포, 단조로움 방지" },
  { label: "음절", weight: 15, detail: "성씨와의 결합 길이, 4·5음절 무리한 조합 감점" },
  { label: "세대 중립", weight: 15, detail: "특정 연대 유행 이름 회피" },
  { label: "의미", weight: 10, detail: "한자 사전적 뜻의 긍정·중립 여부" },
];

const HARMONY_ROWS: PillarRow[] = [
  {
    label: "자원오행 보완",
    weight: 30,
    detail: "이름 한자의 자원오행(부수 기준)이 사주에 필요한 오행(용신·희신)을 채우는지",
  },
  {
    label: "획수 조화",
    weight: 20,
    detail: "이름 두 글자 획수 합이 어느 구간에 드는지 — 오행과는 무관",
  },
  { label: "음양", weight: 10, detail: "이름 한자 획수의 홀짝(홀수 陽·짝수 陰) 균형" },
  { label: "발음오행", weight: 25, detail: "성씨와 이름 첫소리의 오행 흐름" },
  {
    label: "전통 81수리(참고)",
    weight: 15,
    detail: "성씨·이름 획수로 본 네 격의 전통 길흉 — 참고 지표",
  },
];

const TRADITION_CARDS: PrincipleCard[] = [
  {
    icon: Compass,
    title: "사주명리 4기둥",
    body: "연주·월주·일주·시주(時柱)를 만세력 기준으로 계산합니다. 출생 시각을 입력하면 4기둥 모두, 미입력 시 3기둥으로 분석합니다.",
  },
  {
    icon: Sparkles,
    title: "용신 분석",
    body: "억부법(강약 균형)과 조후법(한난조습)을 결합해 일간(日干)의 용신을 추정합니다. 이름이 용신 오행을 보완하는지 살핍니다.",
  },
  {
    icon: Leaf,
    title: "자원오행 보완",
    body: "木·火·土·金·水 가운데 사주에서 부족하거나 과한 오행을 보고, 이름 한자의 자원오행이 필요한 오행을 채우는 쪽으로 점수를 줍니다. 자원오행은 한자의 부수로 정합니다(아래 04).",
  },
  {
    icon: Music,
    title: "음운 분석",
    body: "한국어 음운론 규칙으로 자음 동음 반복, 모음 단조로움, 받침 흐름을 평가합니다. 입에 잘 붙는 발음을 우선합니다.",
  },
];

/** 자원오행 판정 순서 — 계획 §2-1 · data/hanja_resource_element.json meta.order */
const RESOURCE_STEPS: { title: string; body: string }[] = [
  {
    title: "부수 찾기",
    body: "Unicode Unihan 데이터베이스 18.0(2026-07-31)의 kRSUnicode 값으로 글자가 속한 강희 부수(214부수)를 찾습니다. 氵·扌·艹처럼 모양이 바뀐 부수는 원래 부수(水·手·艸)와 같게 보고, 이체자는 쓴 꼴의 부수를 따릅니다.",
  },
  {
    title: "예외부터 확인",
    body: "천간·지지 22자는 간지 오행(甲 木·申 金 등)을 씁니다. 문헌 예시가 부수와 다른 값을 적은 글자(光 火 등)와, 공개된 작명 실무 자료 가운데 서로 독립된 2곳 이상이 부수와 다른 같은 값을 준 글자(南 火·允 土 등)도 그 값을 먼저 씁니다. 문헌 예시는 실무 자료 2곳 이상이 다른 값으로 반대하면 예외로 두지 않습니다.",
  },
  {
    title: "나머지는 부수표",
    body: "214부수마다 오행 하나를 정한 표를 씁니다. 김만태의 공개 부수표와, 공개된 작명 실무 자료 3곳이 부수마다 가장 많이 쓰는 값을 모아 다수결로 정했습니다. 자료끼리 값이 다른 부수(示·石·車 등)의 글자는 '이견 있음'으로 둡니다.",
  },
  {
    title: "숫자 한자",
    body: "一~十·百·千·萬은 작명가마다 기준이 달라, 실무 자료 다수 예외가 있는 二·五·九를 빼고는 부수값에 '이견 있음'을 붙입니다.",
  },
  {
    title: "자료가 없으면 미상",
    body: "부수 자료가 없는 글자는 값을 지어내지 않고 '미상'으로 둡니다. 점수에서는 오행이 없는 글자로 계산합니다.",
  },
];

/** 자원오행 등급 4종 — 계획 §2-4 (뱃지는 CLAUDE.md 디자인 시스템 '자원오행 등급 4축 뱃지') */
const GRADE_ROWS: { code: GradeCode; label: string; body: string }[] = [
  {
    code: "R",
    label: "확정",
    body: "자료끼리 값이 갈리지 않는 글자입니다. 부수표의 합의 부수에 속하고, 그 글자에 다른 값을 준 자료 다수도 없습니다.",
  },
  {
    code: "V",
    label: "이견 있음",
    body: "부수나 그 글자를 다르게 보는 자료가 있거나, 부수 자료가 적거나 추정한 글자입니다. 부수 기준 값을 쓰고, 다른 값이 있으면 함께 적습니다(자료가 적기만 한 글자는 한자 사전에서 '자료 적음'·'추정'으로 표시).",
  },
  {
    code: "X",
    label: "예외 적용",
    // 간지 22자는 값이 부수값과 같아도(乙·子·辛 등) 이 등급이다 — '부수와 다른 값을 쓴 글자'로 쓰지 말 것(2026-10-23 운영 검증 CONTENT-1).
    // 부수값과 다른 글자 수가 필요하면 scripts/build_insight_resource_element.py facts 의 exceptions.differs_from_radical
    body: "부수표보다 간지·문헌 예시·작명 실무 자료 다수의 값을 먼저 쓴 글자입니다. 천간·지지는 값이 부수값과 같아도 간지 오행을 따르므로 이 등급입니다.",
  },
  {
    code: "U",
    label: "미상",
    body: "부수 자료가 없어 값을 정하지 않은 글자입니다.",
  },
];

// ============================================================
// 페이지
// ============================================================
export default function MethodPage() {
  return (
    <>
      <Header current="method" />

      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "64px 32px 96px",
        }}
      >
        {/* ── Hero ──────────────────────────────────────────── */}
        <section style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.18em",
              color: "var(--color-teal)",
              background: "var(--color-teal-50)",
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 24,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--color-teal)",
              }}
            />
            Our Method
          </div>
          <h1
            style={{
              fontSize: 44,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
              margin: 0,
              marginBottom: 18,
            }}
          >
            이름의 결은 이렇게 분석합니다
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              maxWidth: 620,
              margin: "0 auto",
            }}
          >
            감(感)이 아니라 결(結)을 읽습니다.
            <br />
            전통 작명 이론과 데이터 분석을 알고리즘에 녹여
            <br />
            누가 봐도 설명할 수 있는 기준으로 이름을 살펴봅니다.
          </p>
        </section>

        {/* ── 추천 3 축 (요약) ─────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <SectionEyebrow>01 · 분석의 세 축</SectionEyebrow>
          <SectionTitle>데이터 · 원칙 · 보수적 기준</SectionTitle>
          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 18,
            }}
          >
            <AxisCard
              icon={BarChart3}
              title="데이터 기반"
              body={`대법원·네이버 인명용 한자 자료로 만든 ${fmt(HANJA_STATS.total)}자 사전 위에서 모든 후보가 만들어집니다. 부수·획수는 Unicode Unihan 18.0에서 가져오고, 강희자전 획수와 뜻을 직접 정리한 코어 ${fmt(HANJA_STATS.core)}자를 함께 씁니다.`}
            />
            <AxisCard
              icon={Compass}
              title="원칙 기반"
              body="사주명리·음운론·자원오행 등 전통 작명 원칙을 알고리즘에 녹였습니다. 무엇이 좋은 이름인지를 사람마다 다르게 답하지 않습니다."
            />
            <AxisCard
              icon={ShieldCheck}
              title="보수적 기준"
              body="유행어·소망형 표현·세대 편향이 강한 이름은 감점합니다. 시간이 지나도 어색하지 않은 이름을 우선 추천합니다."
            />
          </div>
        </section>

        {/* ── 점수 체계 ─────────────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <SectionEyebrow>02 · 점수 체계</SectionEyebrow>
          <SectionTitle>최종 점수 = 미학 × 70% + 조화 × 30%</SectionTitle>
          <p
            style={{
              marginTop: 12,
              fontSize: 14.5,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
            }}
          >
            미학이 7할, 사주 조화가 3할입니다.
            “먼저 좋은 이름이고, 그 다음에 사주에 어울리는 이름”이라는 우선순위를
            점수에 그대로 반영했습니다.
          </p>

          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 18,
            }}
          >
            <ScoreBlock
              title="미학 점수"
              subtitle="100점 만점 · 가중치 70%"
              rows={AESTHETIC_ROWS}
              tail="톤·성별 보너스 가산, 부적절 패턴 감점"
              accent="var(--color-teal)"
            />
            <ScoreBlock
              title="조화 점수"
              subtitle="100점 만점 · 가중치 30%"
              rows={HARMONY_ROWS}
              tail="출생일 미입력 시 조화 점수 생략"
              accent="var(--color-gold)"
              textAccent="var(--color-gold-800)"
            />
          </div>
        </section>

        {/* ── 전통 작명 원리 ────────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <SectionEyebrow>03 · 전통 작명 원리</SectionEyebrow>
          <SectionTitle>알고리즘에 녹인 네 가지 원리</SectionTitle>
          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 18,
            }}
          >
            {TRADITION_CARDS.map((c) => (
              <PrincipleBox key={c.title} card={c} />
            ))}
          </div>
        </section>

        {/* ── 자원오행 기준 ─────────────────────────────────── */}
        {/* id 는 다른 페이지에서 거는 앵커(/method#resource-element) — 바꾸지 말 것 */}
        <section id="resource-element" style={{ marginBottom: 72, scrollMarginTop: 80 }}>
          <SectionEyebrow>04 · 자원오행 기준</SectionEyebrow>
          <SectionTitle>자원오행은 한자의 부수로 정합니다</SectionTitle>
          <p
            style={{
              marginTop: 12,
              fontSize: 14.5,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
            }}
          >
            자원오행(字源五行)은 한자가 어떤 부수에 속하는지를 보고 木·火·土·金·水 가운데
            하나를 매긴 값입니다. 물 수(氵) 부수인 津(나루 진)은 水, 손 수(扌) 부수인
            振(떨칠 진)은 木입니다. 작명 실무에서 널리 쓰는 방식이고, 이름의 결은 한자
            사전·이름 추천·이름 평가에 이 값 하나만 씁니다. 예전에는 글자 뜻풀이나 획수
            끝자리로 매긴 값이 섞여 있었는데, 작명 실무와 기준이 달라 부수 기준으로
            바꿨습니다.
          </p>

          {/* 판정 순서 */}
          <ol
            style={{
              marginTop: 28,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 12,
            }}
          >
            {RESOURCE_STEPS.map((s, i) => (
              <StepRow key={s.title} num={i + 1} title={s.title} body={s.body} />
            ))}
          </ol>

          {/* 등급 4종 */}
          <div
            style={{
              marginTop: 32,
              fontSize: 15,
              fontWeight: 700,
              color: "var(--color-text)",
            }}
          >
            판정의 확실성은 등급 넷으로 밝힙니다
          </div>
          <p
            style={{
              marginTop: 6,
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--color-text-3)",
            }}
          >
            한자 사전 {fmt(HANJA_STATS.total)}자 기준
          </p>
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {GRADE_ROWS.map((g) => (
              <GradeBox
                key={g.code}
                code={g.code}
                label={g.label}
                body={g.body}
                count={HANJA_STATS.grade[g.code]}
                total={HANJA_STATS.total}
              />
            ))}
          </div>

          {/* 학계의 '불명' */}
          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 12,
              padding: "16px 18px",
              background: "var(--color-surface-2)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Info
              size={18}
              strokeWidth={1.5}
              style={{ flexShrink: 0, color: "var(--color-text-2)", marginTop: 2 }}
            />
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.75,
                color: "var(--color-text-2)",
              }}
            >
              학계에서는 부수마다 오행 성격의 강약을 나누고, 오행을 정하기 어려운 부수는
              &lsquo;불명&rsquo;으로 남깁니다(이재승·김만태 2018, 이재승 2024). 작명 실무
              자료는 모든 글자에 값을 채우고, 이름의 결도 추천과 평가가 같은 기준으로 돌도록
              값을 채웁니다. 그래서 &lsquo;확정&rsquo;은 자료끼리 값이 같다는 뜻이지 그
              부수의 오행 성격이 뚜렷하다는 뜻은 아닙니다. 이 값은 작명소 기준과 같다는
              보증이 아니라 작명 실무에서 가장 많이 쓰는 값이며, 작명가에 따라 다르게 볼 수
              있습니다.
            </p>
          </div>

          <p
            style={{
              marginTop: 18,
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
            }}
          >
            부수표·이견·예외를 수치로 정리한 글은{" "}
            <Link href={RESOURCE_ELEMENT_REPORT} style={inlineLink}>
              자원오행은 어떻게 정하나 — 부수표, 이견, 예외
            </Link>
            에, 글자마다 부수 근거는{" "}
            <Link href="/hanja" style={inlineLink}>
              한자 사전
            </Link>
            에 있습니다.
          </p>
        </section>

        {/* ── 리포트 방식 ───────────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <SectionEyebrow>05 · 리포트 방식</SectionEyebrow>
          <SectionTitle>AI는 이야기, 우리는 리포트</SectionTitle>
          <p
            style={{
              marginTop: 12,
              fontSize: 14.5,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
            }}
          >
            많은 서비스가 AI로 감성적인 설명을 생성합니다. 이름의 결은 다른 방향을
            선택했습니다. 점수와 근거를 명시하는 리포트 형식으로, 왜 좋은 이름인지를
            숫자로 설명합니다.
          </p>
          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 18,
            }}
          >
            {/* AI 방식 */}
            <div
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-divider)",
                borderRadius: "var(--radius-lg)",
                padding: "22px 22px 24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <Bot size={18} strokeWidth={1.5} color="var(--color-text-3)" />
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: "var(--color-text-3)",
                    textTransform: "uppercase",
                  }}
                >
                  AI 서술형
                </div>
              </div>
              <p
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.8,
                  color: "var(--color-text-2)",
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                &ldquo;이 이름은 부드럽고 따뜻한 느낌을 주며, 자연의 생동감을 담고 있어
                아이의 밝은 미래를 상징합니다.&rdquo;
              </p>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: "var(--color-text-3)",
                  lineHeight: 1.6,
                }}
              >
                → 수치 없음 · 근거 없음 · 검증 불가
              </div>
            </div>

            {/* 리포트 방식 */}
            <div
              style={{
                background: "var(--color-teal-50)",
                border: "1.5px solid var(--color-teal)",
                borderRadius: "var(--radius-lg)",
                padding: "22px 22px 24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <FileText
                  size={18}
                  strokeWidth={1.5}
                  color="var(--color-teal)"
                />
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: "var(--color-teal)",
                    textTransform: "uppercase",
                  }}
                >
                  이름의 결 리포트
                </div>
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: 8,
                }}
              >
                {[
                  "발음 87점 — 받침 0개 / 부드러운 자음 비율 100%",
                  "리듬 22점 — 2음절 약강 패턴 / 단조로움 없음",
                  "자원오행 보완 — 사주에 부족한 水 → 氵 부수 한자로 보강",
                  "세대 중립 — 연대 편향 이름 리스트 미포함",
                ].map((line) => {
                  const [metric, detail] = line.split(" — ");
                  return (
                    <li
                      key={line}
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "var(--color-text)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{metric}</span>
                      {detail ? ` — ${detail}` : ""}
                    </li>
                  );
                })}
              </ul>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: "var(--color-teal)",
                  lineHeight: 1.6,
                }}
              >
                → 모든 항목에 수치와 근거 병기
              </div>
            </div>
          </div>
        </section>

        {/* ── 우리가 안 하는 것 (철학) ──────────────────────── */}
        <section style={{ marginBottom: 56 }}>
          <SectionEyebrow>06 · 우리가 안 하는 것</SectionEyebrow>
          <SectionTitle>좋은 이름을 만들기 위해 거르는 것</SectionTitle>
          <ul
            style={{
              marginTop: 28,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 14,
            }}
          >
            <DontRow text="사주만으로 이름을 짓는 일 — 사주는 보조이고, 미학이 먼저입니다." />
            <DontRow text="유행어·아이돌 이름·드라마 인물명에서 따온 이름 — 5~10년 뒤 어색해지는 이름을 거릅니다." />
            <DontRow text="‘성공·부자·천재’ 등 소망형 한자 — 부담을 주는 이름은 추천하지 않습니다." />
            <DontRow text="특정 세대에 몰린 이름 — 어떤 시대에도 자연스러운 결을 우선합니다." />
          </ul>
        </section>

        {/* ── 자료 출처 ─────────────────────────────────────── */}
        <section
          style={{
            marginTop: 80,
            padding: "28px 32px",
            background: "var(--color-surface-2)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Database size={18} strokeWidth={1.5} color="var(--color-text-2)" />
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "var(--color-text-2)",
                textTransform: "uppercase",
              }}
            >
              자료 출처
            </div>
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              fontSize: 13.5,
              lineHeight: 1.9,
              color: "var(--color-text-2)",
            }}
          >
            <li>· 코어 데이터 — 강희자전 획수와 뜻을 정리한 {fmt(HANJA_STATS.core)}자 (이름의 결 내부 정리)</li>
            <li>· 대법원·네이버 인명용 한자 자료</li>
            <li>· Unicode Unihan 데이터베이스 18.0 — 부수(kRSUnicode)·총획수(kTotalStrokes)</li>
            <li>· 자원오행 부수표 — 김만태 「이름의 음양오행 구성 원리」 부수표, 공개된 작명 실무 자료 3곳의 부수별 집계(2026-10)</li>
            <li>· 자원오행 연구 — 이재승·김만태(2018) 「한국 성씨한자의 자원오행에 대한 고찰」, 이재승(2024) 「인명 한자 214 부수의 자원에 의한 성명학적 오행 배속」(초록)</li>
            <li>· 만세력 기반 사주 4기둥 계산 (출생지 보정 포함)</li>
            <li>· 한국어 음운론</li>
          </ul>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section
          style={{
            marginTop: 64,
            textAlign: "center",
            paddingTop: 48,
            borderTop: "1px solid var(--color-divider)",
          }}
        >
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: "0 0 20px",
            }}
          >
            원리는 충분히 보셨다면, 이름을 살펴볼 차례입니다.
          </p>
          <div
            style={{
              display: "inline-flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Link
              href="/search"
              style={{
                padding: "12px 22px",
                background: "var(--color-navy)",
                color: "var(--color-background)",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              이름 추천받기 →
            </Link>
            <Link
              href="/evaluate"
              style={{
                padding: "12px 22px",
                border: "1.5px solid var(--color-teal)",
                color: "var(--color-teal)",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              이름 평가하기
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

// ============================================================
// 보조 컴포넌트
// ============================================================
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.18em",
        color: "var(--color-text-3)",
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 26,
        lineHeight: 1.3,
        fontWeight: 700,
        letterSpacing: "-0.015em",
        color: "var(--color-text)",
        margin: 0,
      }}
    >
      {children}
    </h2>
  );
}

function AxisCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-lg)",
        padding: "22px 22px 24px",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "var(--radius-md)",
          background: "var(--color-surface-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-2)",
          marginBottom: 14,
        }}
      >
        <Icon size={20} strokeWidth={1.5} />
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: 8,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </div>
      <p
        style={{
          fontSize: 13.5,
          lineHeight: 1.7,
          color: "var(--color-text-2)",
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function ScoreBlock({
  title,
  subtitle,
  rows,
  tail,
  accent,
  textAccent,
}: {
  title: string;
  subtitle: string;
  rows: PillarRow[];
  tail: string;
  /** 막대 색(비텍스트) */
  accent: string;
  /**
   * 배점 숫자(12px) 글자색 — 없으면 accent. 골드(#C9A96E)는 흰 카드 2.24:1 이라 조화 블록은 gold-800(8.08:1)을 넘긴다
   * (2026-10-26 팔레트 #2 보완, 막대는 accent 그대로 — tests/palette-contrast.test.mjs)
   */
  textAccent?: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-lg)",
        padding: "24px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: "var(--color-text-3)",
          }}
        >
          {subtitle}
        </div>
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: 12,
        }}
      >
        {rows.map((r) => (
          <li key={r.label}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-text)",
                }}
              >
                {r.label}
              </div>
              <div
                style={{
                  fontFamily: "Inter, var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: textAccent ?? accent,
                  letterSpacing: "0.04em",
                }}
              >
                {r.weight}점
              </div>
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "var(--color-text-2)",
              }}
            >
              {r.detail}
            </div>
            {/* bar */}
            <div
              style={{
                marginTop: 8,
                height: 4,
                borderRadius: 999,
                background: "var(--color-surface-2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${r.weight}%`,
                  height: "100%",
                  background: accent,
                  opacity: 0.55,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px dashed var(--color-divider)",
          fontSize: 12,
          color: "var(--color-text-3)",
          lineHeight: 1.6,
        }}
      >
        {tail}
      </div>
    </div>
  );
}

function PrincipleBox({ card }: { card: PrincipleCard }) {
  const Icon = card.icon;
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 22px 22px",
        display: "flex",
        gap: 14,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: "var(--radius-md)",
          background: "var(--color-teal-50)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-teal)",
        }}
      >
        <Icon size={20} strokeWidth={1.5} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: 6,
            letterSpacing: "-0.005em",
          }}
        >
          {card.title}
        </div>
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.7,
            color: "var(--color-text-2)",
            margin: 0,
          }}
        >
          {card.body}
        </p>
      </div>
    </div>
  );
}

const inlineLink: React.CSSProperties = {
  color: "var(--color-teal)",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

function StepRow({ num, title, body }: { num: number; title: string; body: string }) {
  return (
    <li
      style={{
        display: "flex",
        gap: 14,
        padding: "16px 18px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 26,
          height: 26,
          borderRadius: 999,
          background: "var(--color-teal-50)",
          color: "var(--color-teal)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        {num}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            lineHeight: 1.7,
            color: "var(--color-text-2)",
          }}
        >
          {body}
        </p>
      </div>
    </li>
  );
}

/** 등급 칩 — 4축(Fill·Border·Color·Icon)으로 구분: 확정 solid teal ✓ · 이견 outline gold · 예외 outline teal · 미상 dashed neutral */
const GRADE_CHIP_STYLE: Record<GradeCode, React.CSSProperties> = {
  R: {
    background: "var(--color-teal)",
    color: "var(--color-background)",
    border: "1.5px solid var(--color-teal)",
  },
  V: {
    background: "transparent",
    // 글자는 짙은 amber-warm(흰 카드 6.27:1) — 옛 gold-600(#b49258)은 12.5px 칩에서 2.92:1 로 WCAG AA 미달(2026-10-26 F3)
    color: "var(--color-amber-warm-700)",
    border: "1.5px solid var(--color-gold)",
  },
  X: {
    background: "transparent",
    color: "var(--color-teal)",
    border: "1.5px solid var(--color-teal)",
  },
  U: {
    background: "var(--color-surface-2)",
    color: "var(--color-text-3)",
    // 점선 테두리(비텍스트)는 옛 淡墨 그대로 — 글자만 짙어진 text-3(surface-2 4.86:1, 옛 3.27:1)
    border: "1.5px dashed var(--color-ink-dan)",
  },
};

function GradeBox({
  code,
  label,
  body,
  count,
  total,
}: {
  code: GradeCode;
  label: string;
  body: string;
  count: number;
  total: number;
}) {
  const share = total ? `${((count * 100) / total).toFixed(1)}%` : "";
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-md)",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            ...GRADE_CHIP_STYLE[code],
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 9px",
            borderRadius: "var(--radius-sm)",
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          {code === "R" && <Check size={13} strokeWidth={2.2} aria-hidden />}
          {label}
        </span>
        <span
          style={{
            fontFamily: "Inter, var(--font-sans)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmt(count)}자
          {count > 0 && (
            <span style={{ marginLeft: 6, fontWeight: 500, color: "var(--color-text-3)" }}>
              {share}
            </span>
          )}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.65,
          color: "var(--color-text-2)",
        }}
      >
        {body}
      </p>
    </div>
  );
}

function DontRow({ text }: { text: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        background: "var(--color-surface-2)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <XCircle
        size={18}
        strokeWidth={1.5}
        style={{ flexShrink: 0, color: "var(--color-amber-warm-700)", marginTop: 1 }}
      />
      <span
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: "var(--color-text)",
        }}
      >
        {text}
      </span>
    </li>
  );
}

