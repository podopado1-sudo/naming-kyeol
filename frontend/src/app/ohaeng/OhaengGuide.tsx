/**
 * OhaengGuide — /ohaeng 설명 글(서버 컴포넌트 — 정적 HTML 에 실려 검색엔진이 읽는다).
 * 문장 원문: 설계 docs/plan-ohaeng-2026-11.md §6-4. 운세·길흉 단정, '이름으로 운을 바꾼다', 사람·전문가 검토 문장은 쓰지 않는다(§6-4 끝).
 *
 * ⚠️ 여기 적는 것은 백엔드 코드 사실이다(설계 §6-4 '사실 대조표'). 계산을 바꾸면 이 글도 같이 고칠 것:
 * - 천간·지지 오행 표 = lib/ohaeng.ts STEM_ELEMENT·BRANCH_ELEMENT(= SajuData.cs — tests/ohaeng.test.mjs 가 대조)
 * - 출생지 보정 분(서울·부산·제주, 17개 시·도의 범위) = lib/birthplaces.ts(= BirthplaceData.cs — tests/birthplaces.test.mjs 가 대조)
 * - 억부 ±1·월지 3·일지 2·±3 경계·±5 억부 우선·조후 표 = YongshinCalculationService, 조화 30점 규칙 = HarmonyEngine, 7:3 = ScoringService
 * - 아래 넷은 2026-11 사주 계산 수정(설계 §1 P0 — B1~B5, 구현 기록 §17)으로 계산이 따라가게 된 문장이다. 그 계산을 되돌리거나 바꾸면
 *   이 문장도 함께 고칠 것(계산은 백엔드 Tests/SajuCalculationP0Tests 가, 이 문장과 백엔드 P0 필드는 tests/ohaeng.test.mjs 가 지킨다):
 *   ① '시각을 모를 때는 날짜를 그대로 쓰고 출생지 보정은 하지 않습니다'·'이 보정은 태어난 시각을 넣었을 때만 합니다'
 *      (B1 — SajuCalculationService: 시각이 없으면 보정 없이 넣은 날짜로 일주, 연·월주는 그날 낮 12시 기준, 응답 correctionApplied false)
 *      '연주와 월주는 그날 낮 12시를 기준으로 정합니다 … 절기가 드는 날뿐이고, 그런 날에는 결과 화면이 따로 알려 드립니다'
 *      (SajuCalculationService.NoTimeReference = 12시 · 절기가 드는 날 = 응답 termOnBirthDay → lib/ohaeng.ts termNote.
 *      2026-11-19 검토 반영으로 본문에 더한 문장 — 설계 §17-8, 사용자 확인 D8. 기준 시각을 바꾸면 이 문장과 termNote 를 함께 고칠 것)
 *   ② '태어난 달의 지지는 3배, 태어난 날의 지지는 2배'(B4 — 간지가 같은 기둥이 둘이어도 자리로 가중치를 준다)
 *   ③ '절기가 바뀌는 날 … 시각까지 넣어야 월주(입춘이면 연주도)가 정확합니다'(B2·B3 — 절입 순간과 출생 순간을 견준다.
 *      시각이 없는 그런 날은 응답 termOnBirthDay 가 절기 이름을 싣고 결과 화면이 한 줄로 알린다)
 *   ④ '보정한 시각이 밤 11시~자정이면 일주는 그날 것, 시주는 다음 날의 자시'(B5 — 23시대 시주 천간은 다음 날 일간으로)
 * 그 밖의 사실(2026-11-19 반박 검토 반영 — 설계 §16):
 * - '십여 분 차이'(2026-11-19 독립 검산 뒤 '10분 안팎'에서 고침 — 1900~2099년 2,400절 가운데 47건이 10분을 넘고 최대 13.4분) = 절입 시각 계산기(SolarTermCalculator)를 발표값(일본 국립천문대 '天象 長期版' UT+9 · 한국천문연구원 역서)과 대조하면
 *   13분 이르게 ~ 9분 늦게, 평균 3분 이르다(1900~2097년 56개 해 672건 — 설계 §17. Tests/SolarTermCalculatorTests 는 그 가운데 열 해).
 *   처음 문장 '몇 분쯤'은 2024년 한 해(1~7분)만 본 것이라 P0 구현 때 고쳤다
 * - 보정 분은 반올림해 보이고(서울 '약 32분') 계산은 경도 그대로 소수 분이다 — 서울 오후 1시 32분 → 12:59:55 오시(SajuCalculationServiceTests 시 경계 사례)
 * - 균시차는 넣지 않는다(BirthplaceData.CorrectionMinutes = (경도 − 135) × 4 뿐)
 * - 서머타임(1948~1951·1987·1988 — UTC+10, 1955~1960 — UTC+9:30)·옛 표준시(UTC+8:30 — 1908-04-01~1911-12-31, 1954-03-21~1961-08-09)는
 *   IANA tz 데이터베이스(Asia/Seoul)로 확인했다. 이 사이트는 고치지 않는다(입력을 UTC+9 시계로 본다)
 * - '평균보다 적은 오행(1개 이하)' = HarmonyEngine lackingElements(Value < 평균 — 8글자 1.6·6글자 1.2)
 * - 용신이 배정 한자를 바꾼다 = HarmonyEngine → HanjaSelector.Select(용신 +100·희신 +55·기신 −70)
 */
import Link from "next/link";

import { BIRTHPLACES, birthplaceByCode, correctionRange } from "@/lib/birthplaces";
import { ELEMENT_KO, elementTableRows } from "@/lib/ohaeng";

/** 보정 분 크기(양수) — 설명 글은 '32분 당긴다'처럼 크기로 말한다 */
const minutesOf = (code: string) => Math.abs(birthplaceByCode(code)?.correctionMinutes ?? 0);

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 text-xl font-medium tracking-tight text-navy">
      {children}
    </h2>
  );
}

const P = "text-[15px] leading-7";
const linkClass = "text-teal underline underline-offset-2";

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "없는 오행이 있으면 좋지 않은 건가요?",
    a: "이 페이지는 개수를 셀 뿐 좋고 나쁨을 판단하지 않습니다. 여섯 글자로 셌다면 시주 두 글자가 빠진 결과이기도 합니다.",
  },
  {
    q: "음력 생일만 알아요.",
    a: "이 도구는 양력만 받습니다. 음력을 양력으로 바꿔 넣어 주세요.",
  },
  {
    q: "다른 만세력과 결과가 달라요.",
    a: "지장간을 세는지, 절기 시각을 어떻게 계산하는지, 자시의 날짜와 시주를 어떻게 나누는지, 출생지 보정과 균시차를 넣는지, 서머타임·옛 표준시를 고치는지, 용신을 어떤 법으로 고르는지에 따라 달라집니다. 이 사이트의 방식은 위에 적었습니다.",
  },
];

export function OhaengGuide() {
  const range = correctionRange();
  const rows = elementTableRows();

  return (
    <div className="mt-16 space-y-12 text-text-2">
      {/* ── 사주 원국과 오행 ── */}
      <section aria-labelledby="ohaeng-basics">
        <SectionTitle id="ohaeng-basics">사주 원국과 오행</SectionTitle>
        <p className={P}>
          사주(四柱)는 태어난 해·달·날·시를 네 기둥으로 적은 것입니다. 기둥마다 위 글자 천간(天干)과 아래 글자 지지(地支)가
          하나씩 있어 모두 여덟 글자가 되고, 이것을 사주 원국이라고 부릅니다. 여덟 글자는 저마다 木·火·土·金·水 가운데 한
          오행에 속합니다.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">오행별 천간과 지지</caption>
            <thead className="bg-surface-2 text-text">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  오행
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  천간
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  지지
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.element}>
                  <th scope="row" className="px-4 py-2.5 font-normal text-text">
                    <span className="font-serif">{r.element}</span>({ELEMENT_KO[r.element]})
                  </th>
                  <td className="px-4 py-2.5 font-serif text-base tracking-widest text-text">{r.stems.join(" ")}</td>
                  <td className="px-4 py-2.5 font-serif text-base tracking-widest text-text">{r.branches.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 원국 세는 법 ── */}
      <section aria-labelledby="ohaeng-count">
        <SectionTitle id="ohaeng-count">원국은 이렇게 셉니다</SectionTitle>
        <ul className={`${P} list-disc space-y-2 pl-5`}>
          <li>
            <strong className="font-medium text-text">연주</strong>: 1월 1일이 아니라 입춘(2월 4일 무렵)에 해가 바뀝니다. 입춘
            전에 태어났다면 앞 해의 간지를 씁니다.
          </li>
          <li>
            <strong className="font-medium text-text">월주</strong>: 달력의 달이 아니라 절기로 나눕니다. 입춘부터 경칩 전까지가
            인월(寅月), 경칩부터 청명 전까지가 묘월(卯月)이고, 이렇게 열두 절기마다 한 달씩 넘어가 소한부터 입춘 전까지가
            축월(丑月)입니다.
          </li>
          <li>
            <strong className="font-medium text-text">일주</strong>: 60갑자가 날마다 하나씩 돌아갑니다.
          </li>
          <li>
            <strong className="font-medium text-text">시주</strong>: 하루를 두 시간씩 열둘로 나눕니다. 밤 11시~새벽 1시가
            자시(子時), 새벽 1시~3시가 축시(丑時)이고, 낮 11시~오후 1시가 오시(午時)입니다.
          </li>
        </ul>
        <p className={`${P} mt-4`}>
          여덟 글자의 오행을 하나씩 세면 오행 개수가 됩니다. 이 사이트는 겉으로 드러난 여덟 글자만 세고, 지지 속에 들어 있다고
          보는 천간(지장간)은 세지 않습니다. 지장간까지 세거나 글자마다 무게를 달리 주는 만세력·작명 프로그램과는 개수가 다를 수
          있습니다. 절기가 드는 시각은 천문 계산식으로 구해 십여 분 차이가 날 수 있습니다. 절기가 바뀌는 날에 태어났다면 태어난
          시각까지 넣어야 월주(입춘이면 연주도)가 정확합니다.
        </p>
      </section>

      {/* ── 시각을 모를 때 ── */}
      <section aria-labelledby="ohaeng-no-time">
        <SectionTitle id="ohaeng-no-time">태어난 시각을 모를 때</SectionTitle>
        <p className={P}>
          시각을 비워 두면 시주를 빼고 여섯 글자로 셉니다. 빠진 두 글자에 없는 오행이 들어 있을 수도 있어서, 여섯 글자로 센
          &lsquo;없는 오행&rsquo;은 시각을 알 때보다 많게 나올 수 있습니다. 시각을 모를 때는 날짜를 그대로 쓰고 출생지 보정은 하지
          않습니다. 연주와 월주는 그날 낮 12시를 기준으로 정합니다. 이 기준이 결과를 가르는 것은 월주가 넘어가는 절기가 드는 날뿐이고,
          그런 날에는 결과 화면이 따로 알려 드립니다.
        </p>
        <p className={`${P} mt-3`}>
          밤 11시에서 새벽 1시 사이(자시)에 태어났다면 만세력마다 날짜를 넘기는 기준이 달라 일주가 하루 갈릴 수 있습니다. 이
          사이트는 출생지 보정을 마친 시각으로 날짜를 나눕니다. 보정한 시각이 밤 11시~자정이면 일주는 그날 것으로 두고, 시주는 다음
          날의 자시(子時)로 셉니다(흔히 야자시라고 부르는 방식입니다). 예를 들어 서울에서 1월 1일 0시 20분에 태어났다면 보정한
          시각이 12월 31일 밤 11시 48분쯤이라, 일주는 12월 31일 것으로 세고 시주는 1월 1일의 자시로 셉니다.
        </p>
      </section>

      {/* ── 진태양시 ── */}
      <section aria-labelledby="ohaeng-solar-time">
        <SectionTitle id="ohaeng-solar-time">출생지 보정(진태양시)</SectionTitle>
        <p className={P}>
          한국 표준시는 동경 135도를 기준으로 하는데, 한반도는 그보다 서쪽(서울 약 127도)에 있어 해가 남쪽 하늘 가장 높이 뜨는
          시각이 표준시보다 평균 30분쯤 늦습니다. 이 사이트는 시·도마다 대표 경도를 두고 (경도 − 135) × 4분만큼 출생 시각을
          당깁니다. 서울은 약 {minutesOf("seoul")}분, 부산은 약 {minutesOf("busan")}분, 제주는 약 {minutesOf("jeju")}분이고,{" "}
          {BIRTHPLACES.length}개 시·도 모두 {range.min}~{range.max}분 사이입니다. 여기와 결과 화면의 분은 반올림한 값이고, 계산은
          경도 그대로 초 단위까지 합니다. 해가 가장 높이 뜨는 시각은 계절에 따라 15분 안팎 앞뒤로 움직이지만(균시차), 이 사이트는
          균시차는 넣지 않고 경도 차이만 보정합니다.
        </p>
        <p className={`${P} mt-3`}>
          이 보정은 태어난 시각을 넣었을 때만 합니다. 출생지를 고르지 않으면 서울 기준으로 보정합니다. 보정 때문에 시주가 바뀌기도
          합니다. 서울에서 오후 1시 10분에 태어났다면 보정한 시각은 12시 38분쯤이라 미시(未時)가 아니라 오시(午時)로 셉니다. 시가
          바뀌는 무렵에는 초 단위가 시를 가르기도 합니다. 서울에서 오후 1시 32분에 태어났다면 보정한 시각이 12시 59분 55초라
          오시이고, 1시 33분부터 미시입니다.
        </p>
        <p className={`${P} mt-3`}>
          이 사이트는 넣은 시각을 지금 한국 표준시 시계로 보고 계산합니다. 시계 기준이 지금과 달랐던 때에 태어났다면 지금 시계로
          고쳐 넣어 주세요. 이 사이트는 따로 고치지 않습니다.
        </p>
        <ul className={`${P} mt-3 list-disc space-y-2 pl-5`}>
          <li>
            <strong className="font-medium text-text">서머타임</strong>: 1948~1951년과 1987·1988년 여름에는 시계를 1시간
            앞당겼습니다(시작·끝 날짜는 해마다 달랐습니다). 그 기간에 기록된 시각이라면 1시간을 빼고 넣어 주세요.
          </li>
          <li>
            <strong className="font-medium text-text">옛 표준시</strong>: 1954년 3월 21일부터 1961년 8월 9일까지(그리고 1908년
            4월부터 1911년 말까지)는 동경 127.5도를 기준으로 한 표준시를 써서, 시계가 지금보다 30분 늦었습니다. 그 기간에 기록된
            시각이라면 30분을 더해 넣어 주세요. 다만 그 사이 1955~1960년 여름에는 서머타임으로 시계를 1시간 앞당겨 지금보다 30분
            빨랐으니, 그 기간이라면 30분을 빼고 넣어 주세요.
          </li>
        </ul>
      </section>

      {/* ── 용신과 없는 오행 ── */}
      <section aria-labelledby="ohaeng-yongshin">
        <SectionTitle id="ohaeng-yongshin">용신과 &lsquo;없는 오행&rsquo;은 다릅니다</SectionTitle>
        <p className={P}>
          &lsquo;없는 오행&rsquo;은 여덟 글자(또는 여섯 글자)에 한 번도 나오지 않는 오행입니다. 개수만 보고 정합니다. 이름 평가의
          조화 점수가 말하는 &lsquo;부족한 오행&rsquo;은 이보다 넓어, 평균보다 적은 오행(여덟 글자든 여섯 글자든 1개 이하)을 모두
          가리킵니다. 그래서 이 페이지에서 다섯 오행이 모두 한 번 이상 나온다고 해도, 이름 평가에는 &lsquo;부족한 오행 보완&rsquo;이
          나올 수 있습니다.
        </p>
        <p className={`${P} mt-3`}>용신(用神)은 사주의 균형을 잡는 데 쓰는 오행으로, 이 사이트는 두 방법을 함께 씁니다.</p>
        <ul className={`${P} mt-3 list-disc space-y-2 pl-5`}>
          <li>
            <strong className="font-medium text-text">억부법</strong>: 태어난 날의 천간(일간)을 기준으로, 나머지 글자가 일간과 같은
            오행이거나 일간을 생(生)하면 +1, 일간이 생하거나 극하는 오행이거나 일간을 극하면 −1로 셉니다. 태어난 달의 지지는 3배,
            태어난 날의 지지는 2배로 칩니다. 합계가 +3보다 크면 일간이 강하다(신강), −3보다 작으면 약하다(신약)고 보고, 강하면
            일간을 극하는 오행을, 약하거나 균형이면 일간을 생하는 오행을 억부 용신으로 둡니다.
          </li>
          <li>
            <strong className="font-medium text-text">조후법</strong>: 태어난 달의 계절에 맞춰 기후를 고르는 오행을 둡니다.
            해·자·축·인·묘월과 유·술월은 火, 사·오·미·신월은 水, 진월은 木입니다.
          </li>
        </ul>
        <p className={`${P} mt-3`}>
          강약 합계가 ±5 이상으로 뚜렷하면 억부 용신을, 그렇지 않으면 조후 용신을 최종 용신으로 씁니다. 희신은 상생
          순서(木→火→土→金→水→木)에서 용신을 생하는 오행입니다.
        </p>
        <p className={`${P} mt-3`}>
          그래서 없는 오행이 용신이 아닐 수도 있고, 이미 여러 개 있는 오행이 용신으로 나올 수도 있습니다. 용신을 고르는 법은
          작명가와 만세력마다 달라, 다른 곳에서 본 용신과 다를 수 있습니다.
        </p>
      </section>

      {/* ── 이름의 결이 사주를 쓰는 법 ── */}
      <section aria-labelledby="ohaeng-site">
        <SectionTitle id="ohaeng-site">이름의 결은 사주를 이렇게 씁니다</SectionTitle>
        <p className={P}>
          이름의 결은 이름을 미학 70%, 조화 30%로 봅니다. 사주는 소리와 뜻이 좋은 이름을 먼저 고른 뒤 다듬는 보조 축입니다. 조화
          점수 100점 가운데 사주와 맞춰 보는 것은 &lsquo;자원오행 보완&rsquo; 30점입니다. 이름 한자의 자원오행이 용신이면 가장 크게,
          희신이면 그다음으로 더하고, 사주에 평균보다 적은 오행을 채우면 조금 더합니다. 용신을 극하는 오행(기신)이거나 이미 많은
          오행을 더하면 뺍니다. 이 한 축을 종합 점수로 옮기면 그 폭은 9점까지입니다.
        </p>
        <p className={`${P} mt-3`}>
          다만 용신은 이름 한자를 고르는 데도 쓰입니다. 생년월일을 넣으면 음절마다 용신·희신 오행의 글자에 가산점을 주어 한자를
          고르므로, 생년월일에 따라 배정 한자가 바뀌면 획수 조화·음양·수리 점수와 미학 점수의 한자 성별 판정도 함께 달라질 수
          있습니다.
        </p>
        <p className={`${P} mt-3`}>
          전통 작명에서는 이름 한자의 오행으로 사주에 모자란 기운을 채운다고 봅니다. 이름의 결은 그 관점을 점수 일부로만 반영하고,
          이름이 성격이나 앞날을 정한다고 말하지 않습니다. 오행을 맞추려고 뜻이 약하거나 소리가 어색한 한자를 고르기보다, 소리와 뜻이
          좋은 이름 안에서 오행을 살펴보기를 권합니다.
        </p>
      </section>

      {/* ── 한자 고르기 ── */}
      <section aria-labelledby="ohaeng-hanja">
        <SectionTitle id="ohaeng-hanja">오행을 담은 이름 한자 고르기</SectionTitle>
        <p className={P}>
          결과의 한자 예는 부수 기준 자원오행으로 골랐습니다. 자원오행은 한자가 속한 부수로 정한 오행입니다(
          <Link href="/method#resource-element" className={linkClass}>
            작명 원리 — 자원오행 기준
          </Link>
          ). 이 사이트가 이름 글자로 꼽아 둔 한자(사용 통계는 아닙니다) 가운데 자원오행이 확정됐거나 예외 규칙으로 정해진 글자만
          넣었고, 이름에 피하는 글자와 뜻이 약한
          글자는 뺐습니다. 독음이 겹치지 않게 오행마다 12자까지 보여 드립니다.
        </p>
        <p className={`${P} mt-3`}>
          이름 소리의 첫 자음으로 정하는 발음오행(음령오행)과는 다른 기준입니다. 이미 정한 이름이 있다면{" "}
          <Link href="/evaluate" className={linkClass}>
            이름 평가
          </Link>
          에 생년월일을 넣어, 그 이름에 배정한 한자의 자원오행이 사주와 얼마나 맞는지 조화 점수로 확인할 수 있습니다.
        </p>
      </section>

      {/* ── 자주 묻는 것 ── */}
      <section aria-labelledby="ohaeng-faq">
        <SectionTitle id="ohaeng-faq">자주 묻는 것</SectionTitle>
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
