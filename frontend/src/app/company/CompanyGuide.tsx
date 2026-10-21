/**
 * CompanyGuide — /company 정적 안내 (서버 컴포넌트)
 *
 * 폼과 결과는 클라이언트라 검색엔진이 읽을 글이 폼 라벨뿐이었다(2026-10 감사: 본문 한글
 * 약 330자, 업종은 Select 포털이라 '카페 · 디저트' 하나만 HTML에 남음). 엔진이 실제로
 * 하는 일을 글로 풀어 서버 렌더 HTML에 싣는다.
 *
 * ⚠️ 여기 적는 숫자·예시는 CompanyNamingEngine/CompanyNamingData가 실제로 하는 것만 쓴다.
 *    점수 만점(30·25·25·20)이나 함정 예시(溫林·久續·工匠)를 바꾸면 엔진 쪽과 같이 볼 것.
 * ⚠️ 법·제도 문장은 일반적이고 확인 가능한 수준까지만 — 이 도구는 등록 가능 여부를 판단하지 않는다.
 */
import { COMPANY_FALLBACK_OPTIONS } from "./options";

const KIPRIS_URL = "https://www.kipris.or.kr/khome/main.do";
const IROS_URL = "https://www.iros.go.kr/";

function ExternalText({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-teal underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mb-4 text-xl font-medium tracking-tight text-navy"
    >
      {children}
    </h2>
  );
}

// ============================================================
// 확정 전 확인 — 결과 전에도 보이도록 정적으로 둔다
// ============================================================
export function CompanyCheckNotice() {
  return (
    <section
      aria-labelledby="company-check"
      className="mb-14 rounded-2xl border bg-surface p-6"
    >
      <h2 id="company-check" className="mb-2 text-base font-medium text-navy">
        이름을 정하기 전에 꼭 확인하세요
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-text-2">
        이 도구는 발음과 식별력을 기준으로 후보를 고를 뿐,{" "}
        <strong className="font-medium text-text">
          상표 등록이나 상호 등기가 가능한지는 판단하지 않습니다.
        </strong>{" "}
        마음에 드는 이름을 찾았다면 확정 전에 아래를 따로 확인하세요.
      </p>
      <ul className="space-y-2.5 text-sm leading-relaxed text-text-2">
        <li>
          <strong className="font-medium text-text">상표</strong> —{" "}
          <ExternalText href={KIPRIS_URL}>키프리스(KIPRIS)</ExternalText>에서
          같거나 비슷한 이름이 쓰려는 상품·서비스 분야에 이미 출원·등록돼
          있는지 검색합니다.
        </li>
        <li>
          <strong className="font-medium text-text">상호 등기</strong> — 법인을
          세우거나 상호를 등기할 계획이라면{" "}
          <ExternalText href={IROS_URL}>인터넷등기소</ExternalText>나 관할
          등기소에서 같은 지역·같은 영업으로 등기된 같은 상호가 있는지
          확인합니다. 상표와 상호 등기는 별개 제도라 한쪽을 통과해도 다른
          쪽은 따로 봐야 합니다.
        </li>
        <li>
          <strong className="font-medium text-text">같은 이름의 가게</strong> —
          네이버 검색과 지도에서 가까운 곳에 같은 이름의 가게나 회사가
          있는지, 쓸 웹사이트 주소와 SNS 계정이 비어 있는지도 미리 봐 두세요.
        </li>
      </ul>
    </section>
  );
}

// ============================================================
// 안내 본문
// ============================================================
const STEPS: { title: string; body: string }[] = [
  {
    title: "업종 고르기",
    body: "18개 업종 가운데 가장 가까운 것을 고르세요. 업종마다 어울리는 의미(빛, 물, 손길, 온기 등) 네 가지를 정해 두고, 그 안에서 이름 재료를 가져옵니다.",
  },
  {
    title: "취향 조정하기",
    body: "톤은 소리의 느낌과 의미 재료를 바꾸고, 결을 '전체'로 두면 한자·우리말·영문 후보의 비율도 정합니다. 넣고 싶은 말은 쉼표로 나눠 최대 3개까지 넣을 수 있어요.",
  },
  {
    title: "비교하고 확인하기",
    body: "카드마다 뜻, 네 가지 점수, '○○ 카페' 같은 사용 예를 보여 드립니다. 마음에 드는 이름은 카드 아래 링크로 키프리스와 네이버에서 같은 이름이 있는지 바로 찾아보세요.",
  },
];

const SCORE_AXES: { label: string; max: number; body: string }[] = [
  {
    label: "기억성",
    max: 30,
    body: "2~3글자가 가장 유리하고 4글자부터 점수가 내려갑니다. 소리 배열이 자연스러운지, 고른 톤의 소리 취향(받침, 밝은 모음, 톡 튀는 첫소리)과 맞는지도 봅니다.",
  },
  {
    label: "발음",
    max: 25,
    body: "붙어 있는 두 음절씩 리듬, 첫소리의 다양함, 자음이 부딪혀 소리가 바뀌는지를 봅니다. 센소리가 연달아 나오거나 같은 자음이 반복되거나 받침이 많으면 감점합니다.",
  },
  {
    label: "식별력",
    max: 25,
    body: "상호에서만 따로 보는 축입니다. 업종 일반어, 너무 흔한 상투어, 일반명사 하나로 된 이름은 크게 감점합니다. 다른 가게와 구별되어야 기억되고 검색되기 때문입니다.",
  },
  {
    label: "업종적합",
    max: 20,
    body: "이름에 담긴 뜻이 업종이 고른 의미와 얼마나 맞는지, 고른 톤과 어울리는지를 봅니다. 넣고 싶은 말이 이름에 남았으면 가산합니다.",
  },
];

const TRAPS: { title: string; body: string }[] = [
  {
    title: "업종을 그대로 설명하는 말",
    body: "'맛있는김밥'처럼 업종을 그대로 설명하는 이름은 상표로서 식별력이 약해 등록이 어렵고, 검색하면 같은 업종 가게 사이에 묻힙니다. 그래서 업종마다 일반어를 정해 두고(카페의 '커피'·'원두', 음식점의 '맛집'·'키친' 등) 그 말이 든 후보를 크게 감점합니다. 넣고 싶은 말로 입력하셔도 이름에 쓰지 않고, 그 이유를 결과 위에 알려 드려요.",
  },
  {
    title: "쓴 것과 다르게 들리는 이름",
    body: "溫林은 '온림'이라고 쓰지만 소리는 [올림]입니다. 받침 뒤에 ㄹ이 오면 소리가 바뀌어, 전화나 입소문으로 이름을 들은 손님이 '올림'으로 검색하게 됩니다. 한자 조합 후보는 앞 글자에 받침이 있으면 ㄹ로 시작하는 글자가 뒤에 오지 않도록 골라 두었습니다.",
  },
  {
    title: "이미 있는 낱말과 소리가 같은 이름",
    body: "오래 이어진다는 뜻으로 久(오랠 구)와 續(이을 속)을 붙이면 '구속', 工(장인 공)과 匠(장인 장)을 붙이면 '공장'이 됩니다. 법률사무소 후보에 '구속'이 오르는 사고는 감점으로 막기 어려워, 한자 조합은 글자를 자유롭게 엮지 않고 검수한 글자쌍에서만 고릅니다.",
  },
  {
    title: "너무 흔한 말",
    body: "'○○나라', '○○월드', '○○플러스'처럼 이미 많은 가게가 쓰는 말이나 '하늘', '미소'처럼 일반명사 하나로 된 이름은 기억에 남기 어렵습니다. 이런 말이 들어간 후보도 식별력에서 감점합니다.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "추천받은 이름을 바로 상호로 써도 되나요?",
    a: "바로 쓰기보다 확인을 먼저 하세요. 이 도구는 이미 쓰이는 회사명·브랜드와 겹치는지를 모두 걸러내지 못하고, 등록 가능 여부도 판단하지 않습니다. 상표는 키프리스에서, 상호 등기는 인터넷등기소나 관할 등기소에서 확인할 수 있습니다.",
  },
  {
    q: "같은 조건으로 다시 누르면 다른 이름이 나오나요?",
    a: "같은 조건이면 같은 목록이 나옵니다. 다른 후보를 보려면 톤이나 이름의 결, 글자 수를 바꾸거나 추천 개수를 20개·30개로 늘려 보세요.",
  },
  {
    q: "넣은 글자가 이름에 들어가지 않았어요.",
    a: "업종 일반어나 흔한 말은 일부러 쓰지 않고, 결과 위 안내에서 이유를 알려 드립니다. 꾸미는 말은 어미를 떼고 앞부분만 따서 쓰고('정성스러운'→'정성'), 소리가 같은 한자가 든 검수 글자쌍을 앞으로 올리기도 합니다('지혜'→智·惠). 한자는 소리로 고르기 때문에 뜻까지 같지는 않을 수 있습니다. 1~2음절 우리말이 가장 잘 들어갑니다.",
  },
  {
    q: "점수가 높으면 좋은 상호인가요?",
    a: "점수는 소리, 식별력, 업종과의 어울림을 기준으로 후보끼리 비교하기 위한 값입니다. 상권이나 경쟁 가게, 상표 등록 가능성은 반영하지 않으니 최종 선택은 확인 결과와 함께 판단하세요.",
  },
  {
    q: "영문 조어는 어떻게 만들어지나요?",
    a: "라틴어 어근에 짧은 어미를 붙여 만든 뒤 한글 표기와 로마자 표기를 함께 보여 드립니다. 외래어처럼 들리는 이름은 이미 쓰는 브랜드가 있을 수 있어 검색 확인이 더 중요합니다.",
  },
];

export function CompanyGuide() {
  const industries = COMPANY_FALLBACK_OPTIONS.industries;

  return (
    <div className="space-y-14 text-text-2">
      {/* ── 사용법 ─────────────────────────────────────────── */}
      <section aria-labelledby="company-howto">
        <SectionTitle id="company-howto">이렇게 사용하세요</SectionTitle>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border bg-surface p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-teal-50 font-mono text-xs font-semibold text-teal">
                  {i + 1}
                </span>
                <h3 className="text-sm font-medium text-navy">{s.title}</h3>
              </div>
              <p className="text-sm leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 점수 4축 ───────────────────────────────────────── */}
      <section aria-labelledby="company-score">
        <SectionTitle id="company-score">점수는 이렇게 매깁니다</SectionTitle>
        <p className="mb-4 text-sm leading-relaxed">
          100점 = 기억성 30 + 발음 25 + 식별력 25 + 업종적합 20. 사람 이름과
          달리 성씨가 없고, 다른 가게와 구별되는지가 중요해 상호만의 기준으로
          따로 잽니다.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          {SCORE_AXES.map((a) => (
            <div key={a.label} className="rounded-xl bg-surface-2 p-4">
              <dt className="mb-1 flex items-baseline justify-between text-sm font-medium text-navy">
                {a.label}
                <span className="font-mono text-xs tabular-nums text-text-3">
                  {a.max}점
                </span>
              </dt>
              <dd className="text-sm leading-relaxed">{a.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── 걸러내는 함정 ──────────────────────────────────── */}
      <section aria-labelledby="company-traps">
        <SectionTitle id="company-traps">미리 걸러내는 이름의 함정</SectionTitle>
        <div className="space-y-5">
          {TRAPS.map((t) => (
            <div key={t.title}>
              <h3 className="mb-1 text-sm font-medium text-navy">{t.title}</h3>
              <p className="text-sm leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 업종 목록 ──────────────────────────────────────── */}
      <section aria-labelledby="company-industries">
        <SectionTitle id="company-industries">
          고를 수 있는 업종 {industries.length}개
        </SectionTitle>
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {industries.map((i) => (
            <li
              key={i.key}
              className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-text-2"
            >
              {i.label}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed">
          목록에 없는 업종은 하는 일과 손님이 가장 비슷한 업종을 고르세요.
          업종은 이름에 담을 뜻과 사용 예, 피할 일반어를 정하는 데 쓰입니다.
        </p>
      </section>

      {/* ── FAQ ────────────────────────────────────────────── */}
      <section aria-labelledby="company-faq">
        <SectionTitle id="company-faq">자주 묻는 질문</SectionTitle>
        <div className="divide-y rounded-2xl border bg-surface">
          {FAQ.map((f) => (
            <div key={f.q} className="p-5">
              <h3 className="mb-1.5 text-sm font-medium text-navy">{f.q}</h3>
              <p className="text-sm leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default CompanyGuide;
