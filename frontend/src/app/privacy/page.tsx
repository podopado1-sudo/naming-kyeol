import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/og";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "이름의 결(namingkyeol.com)의 개인정보처리방침입니다.",
  alternates: { canonical: "/privacy" },
  // openGraph를 안 쓰면 루트 값(og:url=홈, og:title=홈 제목)이 그대로 상속된다 (FSC-6)
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "개인정보처리방침 — 이름의 결",
    description: "이름의 결(namingkyeol.com)의 개인정보처리방침입니다.",
    url: "/privacy",
  },
};

const sectionTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  color: "var(--color-text)",
  marginBottom: 12,
};

const body: React.CSSProperties = {
  fontSize: 14,
  color: "var(--color-text-2)",
  lineHeight: 1.85,
  margin: 0,
};

const list: React.CSSProperties = {
  ...body,
  paddingLeft: 20,
  listStyleType: "disc",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const extLink: React.CSSProperties = {
  color: "var(--color-teal)",
  textDecoration: "none",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "64px 24px 80px",
        }}
      >
        <div style={{ marginBottom: 48 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "var(--color-teal)",
              marginBottom: 16,
              textTransform: "uppercase",
            }}
          >
            Privacy
          </p>
          <h1
            style={{
              fontSize: "clamp(26px, 5vw, 36px)",
              fontWeight: 700,
              color: "var(--color-text)",
              lineHeight: 1.3,
              marginBottom: 12,
            }}
          >
            개인정보처리방침
          </h1>
          <p style={{ ...body, fontSize: 13, color: "var(--color-text-3)" }}>
            시행일: 2026년 11월 27일 (최초 2026년 8월 21일)
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {/* 2026-11-03 실제 처리와 맞춤: 결과 링크 조회·피드백·테마 저장은 없는 기능이라 지움, 이름 추천 기록(DB)·서버 로그·처리 위탁을
              사실대로 적음(RecommendationService.CreateRecommendationAsync 가 성·출생일·성별·톤·상위 후보를 저장, 요청 로그에 성·이름 평문).
              광고 항은 게시자 정책의 필수 고지(다른 사이트 방문 기반·웹 비콘·IP·파트너 사이트 데이터 링크)를 보강 */}
          {/* 2026-11-25 /ohaeng(부족한 오행 찾기) 출생지 항목 추가 — 출생지(시·도)는 그 화면만 받는다. 입력값은 계산에만 쓰고 DB·서버 로그에 남기지 않는다
              (SajuController 로그는 '오행 찾기 요청' 한 줄뿐 — SajuControllerLoggingTests). 사용 통계는 종류(endpoint)·키(ohaeng)·시각만.
              이 항목의 시행일은 /ohaeng 배포일 2026-11-25(설계 docs/plan-ohaeng-2026-11.md §8·§10) — 지금 시행일은 아래 한자 입력 배포일 */}
          {/* 2026-11-25 /evaluate 한자 입력(설계 docs/plan-hanja-input-2026-11.md §10-4·§10-5 — /ohaeng 다음 날 2026-11-26 에 배포해 시행일을 그날로)
              · 1항 입력값: '이름·성씨에 고른 한자'. 평가 요청의 nameHanja·lastNameHanja 로 가고 서버 로그 템플릿에는 넣지 않는다.
                직접 넣은 한자를 음절 목록으로 바로 확인하지 못하면(목록에 없는 글자 · 목록을 아직 받지 못함 — HanjaPickerPanel DirectInput)
                판정 API(POST /api/v1/hanja/resolve)로 그 한자 한 글자와 칸의 음절만 간다 —
                HanjaController 는 값을 로그·사용 통계에 남기지 않는다(백엔드 테스트가 수집 로거로 확인).
              · 1항 자동 수집: 한자 칸을 열거나 한자를 넣으면 음절별 후보 파일(/data/hanja-pick/v1/{음절 코드}.json)을 받는다 — 요청마다 음절 하나지만
                여러 칸이면 그만큼 남는다. '이름 전체가 아니다'라고 쓰지 않는다. 다른 화면의 링크(/name '이 한자로 평가'의 hanja=,
                /hanja·/ohaeng 의 #pick)로 한자가 넘어오면 칸을 열지 않아도 그 칸 음절의 파일을 받는다(설계 §8-6 ⓑ·ⓒ).
              · 1항 브라우저 저장: 즐겨찾기에 고른 한자(lib/favorites.ts hanja·lastHanja).
              · 5항: 광고 요청에 화면 주소가 포함될 수 있다는 한 문장(사용자 결정 U15 (가)). 평가 결과 화면의 주소에는 이름·한자·생년월일이 실린다.
                실제로 쿼리째 가는지는 확인하지 못했다(심사 중이라 광고 없음) — 광고가 붙기 전에 네트워크 탭으로 확인할 것(설계 §13-4) */}
          {/* 2026-11-27 5항 고침(시행일 2026-11-27): 2026-11-26 운영에서 실제로 간다고 확인했다 — /evaluate?lastName=…&name=…&birthDate=… 를 새로 열면
              googleads.g.doubleclick.net/pagead/ads 요청의 url 값에 쿼리까지 실렸다(심사 중이라 광고가 보이지 않을 때도). 고친 것(lib/ad-scope.ts):
              ① 로더·사이트 확인 메타를 루트에서 빼고 편집·허브 화면(홈·/guide·/method·/about·/name·/hanja 인덱스 — 11/23 애드센스 진단 권고 1, 사용자 결정)에만 싣는다.
              그 화면들의 주소에는 입력값이 없다. ② 로더가 돈 문서에서 다른 화면으로 클라이언트 이동하면 새 문서로 연다(AdsenseNavigationGuard·Hero) — 한 번 돈 광고
              스크립트는 클라이언트 이동 뒤에도 문서에 남기 때문. ③ Referrer-Policy strict-origin(next.config.ts) — 도구 화면에서 광고 화면을 새 문서로 열 때
              document.referrer(광고 요청의 ref)에 도구 화면 주소가 실리지 않게. 세 가지를 tests/adsense-placement.test.mjs 가 고정한다.
              옛 문장 '(1항에 적은 대로 도구 화면의 주소에는 입력값이 들어갈 수 있습니다)'는 도구 화면에 로더가 있을 때의 고지였다 */}
          <section>
            <h2 style={sectionTitle}>1. 수집하는 정보</h2>
            <p style={{ ...body, marginBottom: 10 }}>
              이름의 결(namingkyeol.com, 이하 &ldquo;본 사이트&rdquo;)은 회원가입·로그인
              기능을 제공하지 않으며, 도구를 쓰는 데 이메일·전화번호 같은 연락처를 요구하지
              않습니다. 서비스 이용 과정에서 다루는 정보는 다음과 같습니다.
            </p>
            <ul style={list}>
              <li>
                <strong>추천·평가·분석·오행 찾기 입력값</strong>: 성씨, 이름, 이름·성씨에 고른 한자,
                출생일(시), 출생지(시·도), 성별, 선호 톤, 부모 이름·영어 이름·키워드 등 이용자가 결과를
                만들려고 입력하는 값. 결과 계산에 쓰입니다. &lsquo;이름 추천&rsquo;(/search) 화면에서 추천을
                받으면 성씨·출생일·성별·톤, 요청 시각과 상위 추천 후보 10개(영어 이름을 넣어 이중 이름
                후보가 들면 그 영어 이름 포함)가 데이터베이스에 기록됩니다. &lsquo;부족한 오행
                찾기&rsquo;(/ohaeng)에 넣은 출생일·출생 시각·출생지는 결과 계산에만 쓰고
                데이터베이스와 서버 로그에 남기지 않습니다. &lsquo;이름 평가&rsquo;(/evaluate)의 한자 칸에
                직접 넣은 한자를 그 음절 목록에서 바로 확인하지 못하면(목록에 없는 글자이거나 목록을 아직 받지 못한
                경우) 그 한자 한 글자와 칸의 음절을 계산 서버로 보내 그 칸에 넣을 수 있는 글자인지 확인하며, 이
                값도 데이터베이스와 서버 로그에 남기지 않습니다.
              </li>
              <li>
                <strong>서버 로그</strong>: 요청을 처리할 때 입력한 성씨·이름·영어 이름·성별·톤
                등과 추천 1위 이름이 서버 로그에 남습니다. 오류 대응에 씁니다.
              </li>
              <li>
                <strong>자동 수집 정보</strong>: 접속 로그(IP 주소, 브라우저 종류, 접속
                일시, 요청 주소 — 호스팅 인프라의 로그. 도구 화면의 주소에는 입력값이 들어갈
                수 있습니다. 이름 평가에서 한자 칸을 열거나 한자를 넣으면(다른 화면의 링크로 한자가 함께
                넘어온 경우 포함) 그 음절의 한자 후보 목록 파일을 받으며, 그 요청 주소에 음절이 문자 코드로
                들어갑니다)와 익명 사용 통계(화면 탭 클릭 등 — 이벤트 종류와 시각만 저장하며
                IP 주소는 함께 저장하지 않습니다).
              </li>
              <li>
                <strong>브라우저 저장 정보</strong>: 저장한 이름(즐겨찾기)과 그때 입력한
                출생일·출생 시각·성별·톤·고른 한자·점수는 이용자 브라우저(localStorage)에만 저장되며, 목록
                자체는 서버로 보내지 않습니다. 목록에서 평가를 다시 열면 그 입력값이 평가 요청으로
                전송됩니다.
              </li>
              <li>
                <strong>문의 메일</strong>: contact@namingkyeol.com으로 문의하면 보낸 사람의
                이메일 주소와 문의 내용을 받습니다. 문의에 답하는 데에만 씁니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={sectionTitle}>2. 이용 목적</h2>
            <ul style={list}>
              <li>이름 추천·평가·분석과 오행 찾기 결과의 생성</li>
              <li>서비스 이용 통계(어떤 기능이 쓰이는지 파악)</li>
              <li>서비스의 안정적 운영과 오류 대응</li>
              <li>문의에 대한 회신</li>
            </ul>
            <p style={{ ...body, marginTop: 10 }}>
              수집한 정보를 마케팅에 쓰지 않으며, 문의 메일에 답하는 경우 말고는 이용자에게
              연락하지 않습니다.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>3. 보관 및 파기</h2>
            <p style={body}>
              이름 추천 기록(성씨·출생일·성별·톤·요청 시각·추천 후보)은 클라우드
              데이터베이스(서울 리전)에 보관됩니다. 이 기록은 결과 화면에 다시 쓰이지 않으며,
              따로 정한 삭제 주기가 없어 서비스를 운영하는 동안 남습니다. 삭제를 요청하면
              확인할 수 있는 범위에서 데이터베이스에서 지웁니다. 서버 로그와 접속 로그는 호스팅
              사업자의 보관 정책에 따라 일정 기간 뒤 자동으로 지워지고, 문의 메일은 운영자
              메일함에 보관되며 삭제를 요청하면 지웁니다.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>4. 처리 위탁 및 국외 처리</h2>
            <p style={{ ...body, marginBottom: 10 }}>
              서비스 운영을 위해 아래 사업자에게 처리를 맡깁니다. 도구에 입력한 값은 결과를
              요청할 때마다 HTTPS로 Render의 싱가포르 리전 서버에 전송되어 계산에 쓰입니다.
            </p>
            <ul style={list}>
              <li>Render — 결과 계산 서버(싱가포르 리전), 서버 로그</li>
              <li>Vercel — 웹페이지 전송, 접속 로그</li>
              <li>Supabase — 이름 추천 기록 데이터베이스(서울 리전)</li>
              <li>Cloudflare — 문의 메일 전달</li>
              <li>Google(Gmail) — 문의 메일 보관</li>
            </ul>
            <p style={{ ...body, marginTop: 10 }}>
              각 사업자의 소재국과 연락처는 각 사의 개인정보처리방침에서 확인할 수 있습니다.
              입력값이 국외에서 처리되는 것을 원하지 않으면 도구에 값을 넣지 않으면 되며, 이
              경우 추천·평가 결과는 받을 수 없습니다.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>5. 광고 및 쿠키</h2>
            <p style={{ ...body, marginBottom: 10 }}>
              본 사이트는 Google 애드센스(AdSense) 광고를 게재할 수 있습니다. Google을
              포함한 제3자 광고 사업자는 쿠키를 사용해 이용자가 본 사이트와 다른 사이트를
              방문한 기록을 바탕으로 광고를 게재할 수 있습니다. 광고 게재 과정에서 제3자가
              이용자 브라우저에 쿠키를 저장하거나 읽고, 웹 비콘이나 IP 주소로 정보를 수집할 수
              있습니다. 광고를 불러오는 요청에는 그 화면의 주소가 포함될 수 있습니다. 그래서
              광고 스크립트는 홈·작명 가이드·데이터 리포트·작명 원리·소개와 이름 뜻 사전·한자 사전의
              목록 화면처럼 주소에 입력값이 들어가지 않는 화면에만 싣고, 이름 추천·평가 같은 도구
              화면에는 싣지 않습니다. 광고를 싣는 화면에서 다른 화면으로 옮기면 페이지를 새로 불러와
              광고 스크립트가 따라가지 않게 하며, 사이트 안에서 화면을 옮길 때 이전 화면의 주소는
              도메인까지만 넘깁니다.
            </p>
            <ul style={list}>
              <li>
                Google이 본 사이트 같은 파트너 사이트의 정보를 쓰는 방식:{" "}
                <a
                  href="https://policies.google.com/technologies/partner-sites?hl=ko"
                  style={extLink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Google이 Google 서비스를 사용하는 웹사이트 또는 앱의 정보를 사용하는 방법
                </a>
              </li>
              <li>
                Google이 광고에 쿠키를 쓰는 방식은{" "}
                <a
                  href="https://policies.google.com/technologies/ads?hl=ko"
                  style={extLink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Google의 광고 쿠키 사용 방식
                </a>
                에서 확인할 수 있습니다.
              </li>
              <li>
                이용자는{" "}
                <a
                  href="https://adssettings.google.com/"
                  style={extLink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Google 광고 설정
                </a>
                에서 맞춤 광고를 비활성화하거나, 브라우저 설정에서 쿠키 저장을 거부할 수
                있습니다. 광고 쿠키를 거부해도 이름 추천·평가 등 기능은 그대로 쓸 수 있습니다.
                브라우저에서 본 사이트의 데이터 저장을 모두 막으면 즐겨찾기는 저장되지 않습니다.
              </li>
              <li>
                Google 외 제3자 광고 사업자도 쿠키를 사용해 본 사이트에 광고를 게재할 수
                있습니다. 일부 사업자(DAA 참여 사업자)의 맞춤 광고 쿠키는{" "}
                <a
                  href="https://www.aboutads.info/choices/"
                  style={extLink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  www.aboutads.info/choices
                </a>
                에서 거부할 수 있습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={sectionTitle}>6. 제3자 제공</h2>
            <p style={body}>
              본 사이트는 수집한 정보를 제3자에게 제공하거나 판매하지 않습니다. 5항의 광고
              사업자가 쿠키·웹 비콘 등으로 직접 수집하는 정보는 그 사업자의 방침을 따릅니다.
              법령에 따른 요구가 있는 경우는 예외로 합니다.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>7. 이용자의 권리와 안전성 확보</h2>
            <ul style={list}>
              <li>브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있습니다.</li>
              <li>
                즐겨찾기 등 브라우저 저장 정보는 브라우저 데이터 삭제로 직접 제거할 수
                있습니다.
              </li>
              <li>
                서버에 기록된 이름 추천 기록과 보낸 문의 메일은 아래 연락처로
                열람·정정·삭제·처리정지를 요구할 수 있습니다. 기록에 이름·연락처가 없으니, 요청할 때 입력한
                성씨·출생일과 추천을 받은 날짜를 알려 주시면 그 조건으로 찾아 처리합니다.
              </li>
              <li>
                사이트와 서버 사이의 전송은 HTTPS로 암호화하고, 데이터베이스는 암호화된
                연결로만 접속하며 행 수준 보안을 켜 두어 외부에서 직접 읽을 수 없게 했습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={sectionTitle}>8. 개인정보 보호책임 및 문의</h2>
            <p style={body}>
              본 사이트는 개인이 운영합니다. 개인정보 보호책임자는 운영자이며, 개인정보 관련
              문의는{" "}
              <a href="mailto:contact@namingkyeol.com" style={extLink}>
                contact@namingkyeol.com
              </a>
              으로 보내주세요.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>9. 방침의 변경</h2>
            <p style={body}>
              본 방침이 변경되는 경우 이 페이지를 통해 공지하며, 시행일을 함께 갱신합니다.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
