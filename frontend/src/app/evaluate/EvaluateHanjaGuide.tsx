/**
 * EvaluateHanjaGuide — /evaluate 설명 글 '아기 이름 한자 정하기'(서버 컴포넌트 — 정적 HTML 에 실려 검색엔진이 읽는다).
 * 문장 원문: 설계 docs/plan-hanja-input-2026-11.md §9-6, 법규 사실은 §20(앞 절과 어긋나면 §20 이 이긴다), 착지 규칙은 §12.
 *
 * 이 파일에는 "use client" 가 없다. page.tsx(서버)가 그려서 EvaluateClient 의 `guide` prop 으로 넘긴다 — 클라이언트 컴포넌트는
 * 이 파일을 import 하지 않는다(node_modules/next/dist/docs 01-app/01-getting-started/05-server-and-client-components.md
 * 'Interleaving Server and Client Components'). 아래에서 파일을 읽으므로(node:fs) 클라이언트 쪽에서 import 하면 빌드가 멈춘다.
 * 입력 폼 화면에만 보인다(결과 화면에는 없다).
 *
 * 숫자는 손으로 적지 않는다 — 커밋된 index.json(백엔드 덤프 dump-hanja-pick 산출)의 값을 guideFacts 로 읽는다.
 * 한자 데이터를 바꿔 다시 덤프하면 이 글의 숫자도 따라간다(tests/evaluate-hanja-pages.test.mjs 가 숫자 리터럴이 없는지 본다).
 * 읽는 법은 lib/insights.ts(데이터 리포트 — 운영 빌드에서 이미 도는 꼴)와 같다: 빌드 때 process.cwd() 아래의 파일을 읽는다.
 * /evaluate 는 정적으로 미리 그리는 쪽이라 읽기는 빌드 때 한 번이다.
 *
 * 주의 — 여기 적는 것은 코드와 법규의 사실이다. 아래를 바꾸면 이 글도 같이 고칠 것:
 * - 조화 100 = 자원오행 보완 30 · 획수 조화 20 · 음양 10 · 발음오행 25 · 전통 81수리 15, 성별 보정은 글자마다 +5/−3(HarmonyEngine),
 *   종합 = 미학 70% + 조화 30%(ScoringService). 한자를 바꿔도 발음오행과 미학의 발음·리듬·음절·세대 중립·의미는 그대로다
 *   (의미 항목은 음절의 글자 전체를 본다 — AestheticEngine). 성씨 한자는 81수리의 성씨 획수에만 들어간다.
 * - 꼬리표 낱말 = lib/hanja-summary-text.ts(용신 보완·희신 포함·기신(감점)·부족한 오행 보완·많은 오행(감점)), 관계 칩 낱말 =
 *   lib/ohaeng-relation.ts ohaengRelationName(상생 · 비화(같은 기운) · 상극).
 * - 두음 표기: 가족관계의 등록 등에 관한 규칙 별표 1 '주' 1 과 대법원 인명용 한자 조회 화면의 안내문(지정된 발음 + ㄴ·ㄹ 첫소리의 두음 꼴),
 *   이름 글자의 자리를 가리지 않는다는 것은 가족관계등록선례 제200909-2호(설계 §20-2 — 2026년 11월 확인). 예로 든 세 글자의 독음은
 *   음절 파일과 같아야 한다(같은 테스트가 대조한다).
 * - 한글·한자를 섞은 이름: 가족관계등록예규 제638호 5.(설계 §20-1 — 2026년 11월 확인). 예규가 바뀌면 이 문장과
 *   lib/hanja-pick-text.ts MIXED_SCRIPT_NOTICE 를 함께 고친다.
 * - 사전에 없는 글자: 출생신고에 쓸 수 있는지 없는지를 이 글이 말하지 않는다(설계 §20-3). 대법원 조회는 이름만 적고 링크를 걸지 않는다
 *   (그 사이트의 링크 유의사항 — 설계 §20-3). 조회 화면은 한글 음 한 글자로만 찾는다.
 * - 이 사전은 대법원 목록의 글자를 다 싣지 못한다(설계 §20-4) — 사전의 글자 수를 목록 전체처럼 적지 않는다.
 *
 * 쓰지 않는 말(설계 §9 머리): 운세 단정, 사람이 살펴봤다는 주장, 근거 없는 빈도 주장, 이 화면이 하지 않는 일(한자 추천)의 약속.
 */
import fs from "node:fs";
import path from "node:path";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import { parsePickIndex } from "@/lib/hanja-pick";
import { guideFacts, type GuideFacts } from "@/lib/hanja-pick-text";

/** 음절 색인 — 화면이 fetch 로 받는 것과 같은 파일(public/data/hanja-pick/v1/index.json) */
const PICK_INDEX_FILE = path.join(process.cwd(), "public", "data", "hanja-pick", "v1", "index.json");

/** 설명 글의 숫자. 파일이 없거나 꼴이 다르면 빌드를 멈춘다(틀린 숫자나 빈 문장을 내보내지 않는다) */
function readGuideFacts(): GuideFacts {
  const index = parsePickIndex(JSON.parse(fs.readFileSync(PICK_INDEX_FILE, "utf8")));
  if (!index) throw new Error("public/data/hanja-pick/v1/index.json 의 꼴이 다릅니다 — dotnet run -- dump-hanja-pick 으로 다시 만드세요");
  return guideFacts(index);
}

const section: CSSProperties = {
  marginTop: 8,
  padding: "28px 28px 8px",
  borderTop: "1px solid #F0EAE0",
  maxWidth: 560,
  marginLeft: "auto",
  marginRight: "auto",
};

const title: CSSProperties = {
  margin: "0 0 14px",
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1.5,
  color: "var(--color-text)",
  letterSpacing: "-0.01em",
  wordBreak: "keep-all",
  // 소개 문장의 '한자 고르는 법' 링크로 내려왔을 때 사이트 머리(sticky) 밑에 가리지 않게
  scrollMarginTop: 88,
};

const question: CSSProperties = {
  margin: "22px 0 8px",
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.55,
  color: "var(--color-text)",
  letterSpacing: "-0.01em",
  wordBreak: "keep-all",
};

const paragraph: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 13.5,
  lineHeight: 1.75,
  color: "var(--color-text-2)",
  wordBreak: "keep-all",
};

// 작은 글씨 링크 — 글자 전용 짙은 청록(종이 바탕에서 4.5:1 을 넘는다)
const link: CSSProperties = {
  color: "var(--color-teal-800)",
  fontWeight: 500,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const hanja: CSSProperties = { fontFamily: "var(--font-serif)" };

const num = (n: number) => n.toLocaleString("ko-KR");

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <>
      <h3 style={question}>{q}</h3>
      <p style={paragraph}>{children}</p>
    </>
  );
}

export function EvaluateHanjaGuide() {
  const facts = readGuideFacts();

  return (
    <section aria-labelledby="hanja-guide" style={section}>
      <h2 id="hanja-guide" style={title}>
        아기 이름 한자 정하기 — 음절마다 인명용 한자 선택·비교
      </h2>
      <p style={paragraph}>
        한글 이름을 정했다면 음절마다 인명용 한자를 직접 골라 넣을 수 있어요. 이름을 넣으면 음절마다 칸이 생기고, 칸을 누르면 그
        음절로 읽는 한자가 뜻·자원오행·획수와 함께 나옵니다. 한자를 찾는 법은 두 가지예요 — 목록에서 뜻으로 찾아 고르거나, 한자를
        직접 치거나 붙여 넣습니다. 고르지 않은 음절은 이 사이트가 자동으로 고릅니다. 이 사이트 사전에는 인명용 한자{" "}
        {num(facts.characters)}자가 {num(facts.syllables)}개 음절에 실려 있어요
        {facts.widest && (
          <>
            . 한 음절에 고를 수 있는 글자는 많게는 {num(facts.widest.count)}자(‘{facts.widest.syllable}’)예요
          </>
        )}
        .
      </p>

      <Faq q="한자를 바꾸면 무엇이 달라지나요?">
        글자의 뜻·자원오행·획수·음양이 바뀌어요. 출생일을 넣었다면 조화 점수의 자원오행 보완(30)·획수 조화(20)·음양(10)·전통
        81수리(15)를 그 한자로 다시 계산합니다. 발음오행(25)과 미학 점수의 발음·리듬·음절·세대 중립·의미 항목은 한글 이름으로
        매기므로 한자를 바꿔도 같아요(의미 항목은 음절 기준이라 고른 한자의 뜻을 반영하지 않습니다). 성별을 골랐다면 글자의 성별
        선호에 따라 조화의 성별 보정(글자마다 +5/−3)과 미학의 성별 보너스가 함께 달라질 수 있어요. 성씨 한자를 바꾸면 전통
        81수리만 달라집니다. 종합 점수는 미학 70%와 조화 30%를 더한 값이에요.
      </Faq>

      <Faq q="‘리’로 읽는 한자를 ‘이’ 칸에 넣을 수 있나요?">
        대법원 인명용 한자 조회 안내에 따르면 한자는 지정된 발음으로만 쓸 수 있고, 첫소리가 ㄴ·ㄹ인 한자는 소리 나는 바에 따라
        ㅇ·ㄴ으로 쓸 수 있습니다. 그래서 <span style={hanja}>李</span>는 ‘리’와 ‘이’ 칸에, <span style={hanja}>蓮</span>은 ‘련’과
        ‘연’ 칸에 모두 넣을 수 있고, 이름의 첫 글자인지 뒤 글자인지는 가리지 않아요. 지정된 발음이 ‘나’뿐인{" "}
        <span style={hanja}>娜</span>는 ‘라’ 칸에 넣을 수 없습니다.
      </Faq>

      <Faq q="글자 사이의 자원오행 관계(상생·비화·상극)는 점수인가요?">
        자원오행끼리의 관계는 점수에 넣지 않습니다. 두 글자의 자원오행(부수 기준)이 전통 오행 이론에서 어떤 관계인지 이름만 적은
        것이에요. 조화 점수의 발음오행(25)은 상생·상극으로 점수를 매기지만 한글 소리 기준이라 한자를 바꿔도 같아요.
      </Faq>

      <Faq q="용신·부족한 오행 꼬리표는 무엇인가요?">
        출생일을 넣으면 이 사이트 계산으로 본 용신·희신과, 사주 글자에서 평균보다 적은 오행(부족한 오행)·많은 오행을 기준으로
        이름 글자마다 꼬리표를 답니다. 조화 점수의 ‘자원오행 보완’이 실제로 더하고 뺀 내용과 같아요. 용신은 계산법에 따라 달라져
        다른 곳에서 본 용신과 다를 수 있습니다. ‘부족한 오행’(사주에 1개 이하)은{" "}
        <Link href="/ohaeng" style={link}>
          부족한 오행 찾기
        </Link>
        의 ‘없는 오행’(0개)보다 넓습니다.
      </Faq>

      <Faq q="획수가 다른 곳과 달라요">
        획수는 유니코드(Unihan) 총획수입니다. 부수를 본래 꼴로 세는 원획법과 다를 수 있어 획수 조화·음양·81수리 값도 달라질 수
        있어요. 기준은{" "}
        <Link href="/method" style={link}>
          작명 원리
        </Link>
        에 적어 두었습니다.
      </Faq>

      <Faq q="‘사전에 없는 글자’라고 나와요">
        이 사이트 사전에 실리지 않은 글자라서 그 글자로는 계산하지 못해요. 사전에 없다고 인명용 한자가 아니라는 뜻은 아닙니다.
        모양만 조금 다른 같은 글자(약자·일본식·중국식 꼴)가 실려 있을 수 있으니 그 음절의 후보 목록에서 먼저 찾아보세요. 대법원
        목록에는 있지만 이 사전이 싣지 못한 글자도 있습니다(유니코드에 없는 글자 등). 출생신고에 쓸 수 있는 글자인지는 대법원
        전자가족관계등록시스템의 ‘인명용 한자 조회’에서 한글 음 한 글자를 넣어 확인할 수 있습니다.
      </Faq>

      <Faq q="‘이름에 피하는 글자’와 ‘먼저 보여 드리는 글자’는 무엇인가요?">
        ‘이름에 피하는 글자’는 이 사이트가 이름 추천과 자동 배정에서 빼기로 정한 {num(facts.forbidden)}자예요. 인명용 한자 목록에
        있는 글자이고, 고르면 그 사실을 알리고 그대로 계산합니다. 이 목록 밖 글자의 뜻이 모두 이름에 어울린다는 말은 아니니 훈을
        함께 보세요. ‘먼저 보여 드리는 글자’({num(facts.common)}자)는 이 사이트가 이름 글자로 꼽아 둔 글자이고, 사용 통계는
        아닙니다.
      </Faq>

      <Faq q="한글과 한자를 섞어 쓸 수 있나요?">
        어느 음절이든 ‘한자 없이 한글로’ 둘 수 있고 그대로 계산합니다. 현행 가족관계등록예규(제638호)는 한글과 한자를 섞어 적은
        출생신고도 수리할 수 있다고 정하고 있어요(2026년 11월 확인). 한자로 적는 글자는 인명용 한자여야 합니다. ‘봄’·‘빛’처럼
        인명용 한자 독음이 아닌 음절은 칸이 잠겨 있어 한글로만 둡니다.
      </Faq>

      <p style={{ ...paragraph, marginTop: 22 }}>
        점수는 규칙으로 계산합니다. 전통 81수리의 길흉 분류는 조화 점수 15점에만 들어가는 참고 지표이고, 이름으로 운세를
        풀이하지는 않습니다. 화면의 문장은 AI 도구로 썼어요(
        <Link href="/about#ai" style={link}>
          만드는 방식
        </Link>
        ).
      </p>
    </section>
  );
}
