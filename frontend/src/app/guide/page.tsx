/**
 * /guide — 작명 가이드
 * 일반 작명 지식: 시기, 방법, 사주의 역할, 흔한 실수.
 * 우리 알고리즘 설명(/method)과는 분리 — 여기는 사용자 교육용.
 */
import Link from "next/link";
import {
  Calendar,
  Compass,
  Feather,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react";

import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

// ============================================================
// 챕터 데이터
// ============================================================
interface Chapter {
  id: string;
  num: string;
  title: string;
  lead: string;
}

const CHAPTERS: Chapter[] = [
  { id: "axis", num: "01", title: "이름을 짓는 네 가지 축", lead: "발음 · 의미 · 사주 · 세대 중립" },
  { id: "when", num: "02", title: "언제 짓나요?", lead: "출생 신고 기한과 충분한 시간" },
  { id: "how", num: "03", title: "이름 짓는 방법 다섯 가지", lead: "한자형부터 영어 이름 연동까지" },
  { id: "saju", num: "04", title: "사주는 꼭 봐야 하나요?", lead: "사주의 역할은 ‘보조’입니다" },
  { id: "dollim", num: "05", title: "돌림자(항렬) 알아두기", lead: "가문 전통과 현대적 활용" },
  { id: "avoid", num: "06", title: "피해야 할 것들", lead: "흔한 실수 일곱 가지" },
  { id: "etc", num: "07", title: "회사명 · 반려동물 이름", lead: "다른 결의 작명" },
];

export default function GuidePage() {
  return (
    <>
      <Header current="guide" />

      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "64px 32px 96px",
        }}
      >
        {/* ── Hero ──────────────────────────────────────────── */}
        <section style={{ textAlign: "center", marginBottom: 56 }}>
          <Eyebrow tone="teal">Naming Guide</Eyebrow>
          <h1
            style={{
              fontSize: 44,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
              margin: "16px 0 18px",
            }}
          >
            처음 이름을 짓는 분께
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.75,
              color: "var(--color-text-2)",
              maxWidth: 620,
              margin: "0 auto",
            }}
          >
            좋은 이름은 결국 <em style={{ fontStyle: "normal", color: "var(--color-text)", fontWeight: 600 }}>‘부르기 좋고, 듣기 좋고, 오래가는’</em> 이름입니다.
            <br />
            한국 작명의 기본기와 흔한 오해를 정리했어요.
          </p>
        </section>

        {/* ── 목차 ──────────────────────────────────────────── */}
        <section
          style={{
            marginBottom: 72,
            padding: "24px 28px",
            background: "var(--color-surface-2)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.18em",
              color: "var(--color-text-3)",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            목차
          </div>
          <ol
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 8,
            }}
          >
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <Link
                  href={`#${c.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 1fr auto",
                    alignItems: "baseline",
                    gap: 12,
                    padding: "8px 0",
                    textDecoration: "none",
                    color: "var(--color-text)",
                    fontSize: 14.5,
                    borderBottom: "1px dashed transparent",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "Inter, var(--font-sans)",
                      fontSize: 12,
                      color: "var(--color-text-3)",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {c.num}
                  </span>
                  <span style={{ fontWeight: 600 }}>{c.title}</span>
                  <span
                    style={{
                      fontSize: 12.5,
                      color: "var(--color-text-3)",
                    }}
                  >
                    {c.lead}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* ── 01. 네 가지 축 ───────────────────────────────── */}
        <Chapter id="axis" num="01" title="이름을 짓는 네 가지 축">
          <p>
            좋은 이름은 어느 한 가지로 결정되지 않습니다. 네 가지 축이 균형 잡혀야 시간이
            지나도 어색하지 않은 이름이 됩니다.
          </p>
          <FourAxisGrid />
          <Aside icon={Lightbulb}>
            네 축 중 하나라도 크게 어긋나면 어색해집니다. 예를 들어 의미는 좋지만 발음이
            거칠다거나, 발음은 부드럽지만 특정 세대 유행을 따라간다면 5~10년 뒤 사람들이
            그 흔적을 알아챕니다.
          </Aside>
        </Chapter>

        {/* ── 02. 언제 ──────────────────────────────────── */}
        <Chapter id="when" num="02" title="언제 짓나요?">
          <p>
            <strong>한국에서는 출생 후 1개월 이내에 출생신고</strong>를 해야 합니다.
            대부분 부모님은 임신 중후반부터 후보를 정리하고, 출생 후 1~2주 안에 최종
            결정합니다.
          </p>
          <ul>
            <li>
              <strong>임신 후반(34주~)</strong>: 성별과 출산 예정일이 확정된 시기부터
              후보군을 만들기 시작합니다.
            </li>
            <li>
              <strong>출산 직후~1주</strong>: 실제 아이의 인상·울음소리·분위기를 보고
              후보를 좁힙니다.
            </li>
            <li>
              <strong>1~2주차</strong>: 가족 회의, 사주 확인, 한자 의미 검토.
            </li>
            <li>
              <strong>~30일 이내</strong>: 출생신고. 이때까지 결정.
            </li>
          </ul>
          <Aside icon={Calendar}>
            출생 시각을 사주 분석에 쓰려면 가능한 한 정확히 기억해두세요. 병원 출생증명서에
            기록된 시각이 가장 정확합니다.
          </Aside>
        </Chapter>

        {/* ── 03. 짓는 방법 ─────────────────────────────────── */}
        <Chapter id="how" num="03" title="이름 짓는 방법 다섯 가지">
          <p>
            방식이 다르면 결과의 결도 다릅니다. 어떤 방식이 맞는지는 가족의 선호에 따릅니다.
          </p>
          <ol style={{ paddingLeft: 0, listStyle: "none", display: "grid", gap: 18 }}>
            <MethodRow
              tag="1"
              title="한자형"
              body="가장 전통적인 방식. 한자 두 글자(또는 한 글자)에 의미를 담아 짓습니다. 자원오행과 결합해 사주 보완까지 고려할 수 있어요."
              example="서윤 — 상서로울 瑞, 윤택할 潤"
            />
            <MethodRow
              tag="2"
              title="순우리말형"
              body="한자를 쓰지 않고 우리말의 결을 살린 이름. 자연·감정·계절·풍경 등이 소재가 됩니다."
              example="하늘, 새벽, 봄결, 다온"
            />
            <MethodRow
              tag="3"
              title="혼합형"
              body="첫 글자는 순우리말, 다음 글자는 한자(또는 반대). 자유롭게 조합할 수 있어 최근 선호도가 높습니다."
              example="하준 — ‘하늘’의 ‘하’ + 준걸 俊"
            />
            <MethodRow
              tag="4"
              title="부모 이름 기반"
              body="부모님 이름의 음운 요소(초성·받침)나 의미를 잇는 방식. 가족 서사를 한 줄로 잇고 싶을 때 좋습니다."
              example="아빠 ‘민호’ + 엄마 ‘수정’ → 자녀 ‘민수’ (음운 계승)"
            />
            <MethodRow
              tag="5"
              title="영어 이름 연동"
              body="해외 거주·국제 학교 등을 염두에 둘 때. 음역 유사(Philip·필립) 또는 의미 유사(Sky·하늘) 방식이 있어요."
              example="이중 이름 — 한국명과 영문명이 한 결로 연결됨"
            />
          </ol>
          <p style={{ marginTop: 8 }}>
            NameForm은 다섯 가지 모두 지원합니다.{" "}
            <Link href="/search" style={inlineLink}>이름 찾기</Link>에서 옵션을
            켜고 끌 수 있어요.
          </p>
        </Chapter>

        {/* ── 04. 사주 ──────────────────────────────────────── */}
        <Chapter id="saju" num="04" title="사주는 꼭 봐야 하나요?">
          <p>
            결론부터 말하면 <strong>꼭 봐야 하는 건 아니지만, 보면 도움이 됩니다.</strong>{" "}
            다만 ‘사주로 이름을 만든다’는 접근은 권하지 않습니다.
          </p>
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <DualBox
              tone="ok"
              title="사주가 ‘할 수 있는 것’"
              items={[
                "이름의 오행이 사주 약한 곳을 보완하는지 확인",
                "용신(用神)을 살려 부족한 기운 채우기",
                "음양(陰陽) 균형 점검",
              ]}
            />
            <DualBox
              tone="warn"
              title="사주가 ‘할 수 없는 것’"
              items={[
                "발음이 거친 이름을 좋게 만들기",
                "유행 이름을 시간 흘러도 어색하지 않게 만들기",
                "의미가 부담스러운 이름을 가볍게 만들기",
              ]}
            />
          </div>
          <Aside icon={Compass}>
            NameForm은 미학 70% + 조화 30% 비율로 점수를 매깁니다. 사주는 좋은 이름을 더
            좋게 다듬는 ‘보조 축’이지, 이름을 결정하는 ‘유일한 축’이 아닙니다.
          </Aside>
          <p>
            출생 시각을 모르거나 자정을 넘긴 출생 등 시주(時柱)가 불확실하면, 사주는 3기둥
            분석으로 진행하고 미학·음운을 더 비중 있게 봅니다.
          </p>
        </Chapter>

        {/* ── 05. 돌림자 ────────────────────────────────────── */}
        <Chapter id="dollim" num="05" title="돌림자(항렬) 알아두기">
          <p>
            돌림자(항렬자)는 같은 항렬, 즉 같은 세대의 형제·자매·친척에게 공통으로 쓰는 글자입니다.
            가문의 족보를 따라 미리 정해진 한자 한 글자를 이름에 넣어, 같은 항렬이면 한눈에
            구분되도록 했죠.
          </p>
          <ul>
            <li>
              <strong>예</strong>: 항렬자가 ‘鉉’이면 한 세대 사촌형제 모두 이름에 ‘현’이 들어감
              (예: 민현, 지현, 우현).
            </li>
            <li>
              <strong>위치 규칙</strong>: 항렬자가 첫 글자인지 끝 글자인지는 가문별 규칙이 있어요.
              집안 어른께 확인하세요.
            </li>
            <li>
              <strong>현대적 활용</strong>: 항렬을 안 쓰는 가족이 많습니다. 자유롭게 짓되 형제·자매에
              한해 첫 글자(또는 끝 글자)를 맞추는 정도로 적용하기도 합니다.
            </li>
          </ul>
          <Aside icon={Users}>
            NameForm <Link href="/required-char" style={inlineLink}>필수 글자 포함</Link>{" "}
            기능으로 항렬자를 지정하면 그 글자가 들어간 후보만 추천받을 수 있어요.
          </Aside>
        </Chapter>

        {/* ── 06. 피해야 할 것 ──────────────────────────────── */}
        <Chapter id="avoid" num="06" title="피해야 할 것들">
          <p>좋은 이름을 짓는 것만큼, 피할 것을 아는 것도 중요합니다.</p>
          <ul>
            <li>
              <strong>유행어·아이돌 이름</strong>: 5~10년 뒤 ‘그 시절 이름’이 되기 쉽습니다.
            </li>
            <li>
              <strong>발음이 거친 자음 조합</strong>: ‘ㅋ-ㅋ’, ‘ㅊ-ㅊ’ 동음 반복 / 받침 충돌
              (예: 박악연 → 박, 악 모두 받침이 어색하게 만남).
            </li>
            <li>
              <strong>이름 글자가 단어와 충돌</strong>: 일상어와 똑같이 읽히는 경우 (예: 김치, 박스).
            </li>
            <li>
              <strong>소망형 한자</strong>: ‘성공·부자·천재’ 같은 직접적 단어는 부담을 줍니다.
            </li>
            <li>
              <strong>의미가 어두운 한자</strong>: 死·病·苦 등 부정적 의미는 발음이 좋아도 피하세요.
            </li>
            <li>
              <strong>너무 흔한 이름</strong>: 같은 학교·직장에 동명이인이 여러 명일 가능성을
              세대별 빈도 데이터로 확인하세요.
            </li>
            <li>
              <strong>너무 어려운 한자</strong>: 본인이 평생 써야 하는 이름. 컴퓨터·핸드폰
              입력이 안 되는 벽자(僻字)는 일상에 불편을 줍니다.
            </li>
          </ul>
        </Chapter>

        {/* ── 07. 회사명/반려동물 ───────────────────────────── */}
        <Chapter id="etc" num="07" title="회사명 · 반려동물 이름">
          <p>아기 이름과는 결이 다른 두 가지를 간단히 짚어둡니다.</p>
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <MiniCard
              title="회사명"
              body="‘오래 불릴 이름’ + ‘상표 등록 가능’ + ‘도메인 확보’ 세 가지가 동시에 충족돼야 합니다. 발음 명료성과 한·영 동시 통용 여부도 봅니다."
            />
            <MiniCard
              title="반려동물"
              body="짧고 부르기 좋은 이름이 우선입니다. 2~3음절, 모음으로 끝나는 이름이 반응 학습에 유리해요. 의미는 가벼워도 괜찮습니다."
            />
          </div>
          <Aside icon={Sparkles}>
            회사명·반려동물 이름 추천은 현재 준비 중입니다. 곧 만나보실 수 있어요.
          </Aside>
        </Chapter>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section
          style={{
            marginTop: 72,
            paddingTop: 56,
            borderTop: "1px solid var(--color-divider)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--color-text-2)",
              margin: "0 0 22px",
            }}
          >
            기본기를 익히셨다면, 직접 이름을 살펴볼 차례입니다.
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
            <Link
              href="/method"
              style={{
                padding: "12px 22px",
                color: "var(--color-text-2)",
                textDecoration: "underline",
                textUnderlineOffset: 4,
                textDecorationThickness: 1,
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              우리 알고리즘 보기
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

// ============================================================
// 보조 컴포넌트 / 스타일
// ============================================================
const inlineLink = {
  color: "var(--color-teal)",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  textDecorationThickness: 1,
} as const;

function Eyebrow({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "teal" | "neutral";
}) {
  const teal = tone === "teal";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.18em",
        color: teal ? "var(--color-teal)" : "var(--color-text-3)",
        background: teal ? "var(--color-teal-50)" : "transparent",
        padding: teal ? "5px 12px" : 0,
        borderRadius: "var(--radius-sm)",
        textTransform: "uppercase",
      }}
    >
      {teal && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--color-teal)",
          }}
        />
      )}
      {children}
    </div>
  );
}

function Chapter({
  id,
  num,
  title,
  children,
}: {
  id: string;
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        marginBottom: 72,
        scrollMarginTop: 80,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "var(--color-text-3)",
          marginBottom: 6,
        }}
      >
        {num}
      </div>
      <h2
        style={{
          fontSize: 28,
          lineHeight: 1.3,
          fontWeight: 700,
          letterSpacing: "-0.015em",
          color: "var(--color-text)",
          margin: "0 0 22px",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.85,
          color: "var(--color-text)",
        }}
        className="kyeol-prose"
      >
        {children}
      </div>
      <style>{`
        .kyeol-prose p { margin: 0 0 14px; color: var(--color-text); }
        .kyeol-prose strong { font-weight: 700; color: var(--color-text); }
        .kyeol-prose ul, .kyeol-prose ol {
          margin: 14px 0; padding-left: 20px;
        }
        .kyeol-prose li { margin-bottom: 8px; color: var(--color-text-2); }
        .kyeol-prose li strong { color: var(--color-text); }
      `}</style>
    </section>
  );
}

function FourAxisGrid() {
  const axes = [
    {
      icon: Feather,
      title: "발음",
      body: "입에 잘 붙는가. 자음·모음·받침의 흐름.",
    },
    {
      icon: Lightbulb,
      title: "의미",
      body: "한자 사전적 뜻이 긍정·중립적인가.",
    },
    {
      icon: Compass,
      title: "사주",
      body: "사주의 부족한 오행을 이름이 보완하는가.",
    },
    {
      icon: ListChecks,
      title: "세대 중립",
      body: "특정 연대 유행에서 자유로운가.",
    },
  ];
  return (
    <div
      style={{
        marginTop: 22,
        marginBottom: 8,
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 14,
      }}
    >
      {axes.map((a) => {
        const Icon = a.icon;
        return (
          <div
            key={a.title}
            style={{
              padding: "16px 18px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-divider)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                color: "var(--color-teal)",
                marginTop: 2,
              }}
            >
              <Icon size={18} strokeWidth={1.5} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: "var(--color-text)",
                  marginBottom: 4,
                }}
              >
                {a.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: "var(--color-text-2)",
                }}
              >
                {a.body}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Aside({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        margin: "18px 0",
        padding: "14px 18px",
        background: "var(--color-teal-50)",
        borderLeft: "3px solid var(--color-teal)",
        borderRadius: "0 var(--radius-md) var(--radius-md) 0",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div style={{ flexShrink: 0, color: "var(--color-teal)", marginTop: 2 }}>
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.75,
          color: "var(--color-text)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MethodRow({
  tag,
  title,
  body,
  example,
}: {
  tag: string;
  title: string;
  body: string;
  example: string;
}) {
  return (
    <li
      style={{
        padding: "16px 20px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-md)",
        display: "grid",
        gridTemplateColumns: "32px 1fr",
        gap: 14,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, var(--font-sans)",
          fontSize: 22,
          fontWeight: 700,
          color: "var(--color-teal)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {tag}
      </div>
      <div>
        <div
          style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: 6,
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
            margin: "0 0 8px",
          }}
        >
          {body}
        </p>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--color-text-3)",
            background: "var(--color-surface-2)",
            padding: "6px 10px",
            borderRadius: "var(--radius-sm)",
            display: "inline-block",
          }}
        >
          예: {example}
        </div>
      </div>
    </li>
  );
}

function DualBox({
  tone,
  title,
  items,
}: {
  tone: "ok" | "warn";
  title: string;
  items: string[];
}) {
  const ok = tone === "ok";
  return (
    <div
      style={{
        padding: "18px 20px",
        background: ok ? "var(--color-teal-50)" : "var(--color-gold-50)",
        border: `1px solid ${ok ? "var(--color-teal-100)" : "var(--color-gold-100)"}`,
        borderRadius: "var(--radius-md)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: ok ? "var(--color-teal)" : "#6F5421",
          marginBottom: 10,
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: 6,
        }}
      >
        {items.map((it, i) => (
          <li
            key={i}
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--color-text)",
              paddingLeft: 14,
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: "0.55em",
                width: 6,
                height: 6,
                borderRadius: 999,
                background: ok ? "var(--color-teal)" : "var(--color-gold)",
              }}
            />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: "18px 20px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <HelpCircle size={16} strokeWidth={1.5} color="var(--color-text-2)" />
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          {title}
        </div>
      </div>
      <p
        style={{
          fontSize: 13,
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
