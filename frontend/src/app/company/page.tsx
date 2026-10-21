/**
 * /company — 회사·가게 이름 짓기 (상호 작명)
 *
 * 서버 컴포넌트다. 히어로·확정 전 확인 안내·사용 안내를 서버 렌더 HTML에 싣고,
 * 상태가 필요한 폼과 결과만 CompanyForm(클라이언트)에 둔다.
 * 메타데이터(title·canonical)는 layout.tsx가 들고 있다.
 */
import { Header } from "@/components/design/Header";
import { Footer } from "@/components/design/Footer";
import { CompanyForm } from "./CompanyForm";
import { CompanyCheckNotice, CompanyGuide } from "./CompanyGuide";

export default function CompanyPage() {
  return (
    <>
      {/* 헤더 메뉴(이름 찾기)는 인명 도구라 상호 화면에서는 아무 메뉴도 켜지 않는다 */}
      <Header current="none" />
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <header className="mb-10 space-y-3 text-center">
          <p className="eyebrow">COMPANY · 상호</p>
          <h1 className="text-3xl font-medium leading-snug tracking-tight text-navy md:text-4xl">
            회사·가게 이름 짓기
          </h1>
          <p className="font-serif text-lg text-text-2">오래 불릴 이름의 결</p>
          {/* 식별력은 감점으로 높일 뿐 등록을 보장하지 않는다 — '상표에서 자기 자리를
              만든다'는 단정을 거둔 문구 (2026-10 감사: 상장사·유명 상표 동명 후보 재현) */}
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
            회사명 · 가게명 · 브랜드명 후보를 업종에 맞춰 추천해요. 업종
            일반어와 흔한 말을 피해 식별력을 높인 후보를 고르지만, 상표 등록과
            상호 등기 가능 여부는 확정 전에 따로 확인하셔야 합니다.
          </p>
        </header>

        <CompanyForm />

        {/* 결과 바로 아래에 붙는다 — 결과 전에도 보이고, 결과가 있으면 목록 하단 상세 안내가 된다 */}
        <CompanyCheckNotice />

        <CompanyGuide />
      </div>
      <Footer />
    </>
  );
}
