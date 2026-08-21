import type { Metadata } from "next";
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 이름의 결",
  description: "이름의 결(namingkyeol.com)의 개인정보처리방침입니다.",
  alternates: { canonical: "/privacy" },
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
            시행일: 2026년 8월 21일
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <section>
            <h2 style={sectionTitle}>1. 수집하는 정보</h2>
            <p style={{ ...body, marginBottom: 10 }}>
              이름의 결(namingkyeol.com, 이하 &ldquo;본 사이트&rdquo;)은 회원가입·로그인
              기능을 제공하지 않으며, 연락처 등 이용자를 직접 식별할 수 있는 정보를
              요구하지 않습니다. 서비스 이용 과정에서 다루는 정보는 다음과 같습니다.
            </p>
            <ul style={list}>
              <li>
                <strong>추천·평가·분석 입력값</strong>: 성씨, 출생일(시), 성별, 선호 톤 등
                이용자가 결과 생성을 위해 입력하는 값. 추천 결과와 함께 저장되어 결과
                링크(공유 URL) 조회에 사용됩니다.
              </li>
              <li>
                <strong>피드백</strong>: 추천 결과에 남기는 반응(좋아요·선택 등)과 선택
                입력한 사유. 추천 품질 개선을 위한 통계로 활용됩니다.
              </li>
              <li>
                <strong>자동 수집 정보</strong>: 접속 로그(IP 주소, 브라우저 종류, 접속
                일시 — 호스팅 인프라의 로그)와 익명 사용 통계(화면 탭 클릭 횟수 등 개인
                식별이 불가능한 이벤트).
              </li>
              <li>
                <strong>브라우저 저장 정보</strong>: 저장한 이름(즐겨찾기)과 테마 설정은
                이용자 브라우저(localStorage)에만 저장되며 서버로 전송되지 않습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={sectionTitle}>2. 이용 목적</h2>
            <ul style={list}>
              <li>이름 추천·평가·분석 결과의 생성과 결과 링크 제공</li>
              <li>피드백 통계 기반의 추천 품질 개선</li>
              <li>서비스의 안정적 운영과 오류 대응</li>
            </ul>
            <p style={{ ...body, marginTop: 10 }}>
              수집한 정보를 마케팅 목적으로 사용하거나 이용자에게 연락하는 일은 없습니다.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>3. 보관 및 파기</h2>
            <p style={body}>
              추천 결과와 피드백은 결과 링크 제공과 품질 개선을 위해 서비스 제공 기간 동안
              클라우드 데이터베이스(국내 리전)에 보관됩니다. 이용자가 삭제를 요청하면 지체
              없이 파기하며, 자동 수집되는 접속 로그는 호스팅 사업자의 보관 정책에 따라
              일정 기간 후 자동 파기됩니다.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>4. 광고 및 쿠키</h2>
            <p style={{ ...body, marginBottom: 10 }}>
              본 사이트는 Google 애드센스(AdSense) 광고를 게재할 수 있습니다. Google을
              포함한 제3자 광고 사업자는 쿠키를 사용하여 이용자의 이전 방문 기록에 기반한
              광고를 게재할 수 있습니다.
            </p>
            <ul style={list}>
              <li>
                Google의 광고 쿠키 사용에 대한 자세한 내용은{" "}
                <a
                  href="https://policies.google.com/technologies/ads?hl=ko"
                  style={extLink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Google 광고 정책
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
                있습니다. 쿠키를 거부해도 본 사이트의 모든 기능을 이용할 수 있습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={sectionTitle}>5. 제3자 제공</h2>
            <p style={body}>
              본 사이트는 수집한 정보를 제3자에게 제공하거나 판매하지 않습니다. 다만 법령에
              따른 요구가 있는 경우는 예외로 합니다.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>6. 이용자의 권리</h2>
            <ul style={list}>
              <li>브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있습니다.</li>
              <li>
                즐겨찾기 등 브라우저 저장 정보는 브라우저 데이터 삭제로 직접 제거할 수
                있습니다.
              </li>
              <li>
                서버에 저장된 추천 결과·피드백의 삭제는 아래 연락처로 요청할 수 있습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={sectionTitle}>7. 개인정보 보호책임 및 문의</h2>
            <p style={body}>
              본 사이트는 개인이 운영하며, 개인정보 관련 문의는{" "}
              <a href="mailto:contact@namingkyeol.com" style={extLink}>
                contact@namingkyeol.com
              </a>
              으로 보내주세요.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>8. 방침의 변경</h2>
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
