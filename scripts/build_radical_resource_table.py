# -*- coding: utf-8 -*-
"""
부수 기준 자원오행 — 214부수표와 예외표를 만든다 (계획 docs/plan-radical-ohaeng-2026-10.md §2-1·§2-2, 단계 S1).

출력 (아직 소비처 없음 — 백엔드·프론트 연결은 S4):
  data/radical_resource_element.json    214부수 각각 {element, status, alt, basis, votes, note …}
  data/resource_element_exceptions.json 간지 22자 + 문헌 예외 + 실무 예외 (+ 값은 그대로 두고 '이견'만 다는 글자 · 문헌 예시 글자)
고정본 (커밋한다 — 기본 실행의 입력, --refresh --freeze 로만 쓴다):
  data/radical_resource_votes.json      부수별 실무 자료 집계(votes) · 이름 빈도 집계(亠) · 반영한 실무 예외와
                                        실무 대체값(값·출처 개수). 수집한 글자별 값 전체는 싣지 않는다

출처 원칙 (사용자 결정 D1, 2026-10-22 개정):
  - 값은 kRSUnicode 부수 + 공개 문헌의 부수표 + 간지 예외 + 문헌 예외 + 실무 예외로 만든다.
  - 작명 실무 자료(철학캠프 HN · 네임차트 NC · 이오름 IO)는 (1) 부수별 다수값(부수표 1표)과 (2) 실무 예외 —
    2곳 이상이 같은 값을 주고 그 값이 부수 기본값과 다른 글자(등급 X, basis PRACTICE '작명 실무 자료 다수') — 에 쓴다.
    B-1(2026-10-22 통합 결정): 이오름 글자값이 이오름 자신의 그 부수 다수값과 같으면(부수 규칙값의 반복) 실무 예외를 세울
    독립 근거로 세지 않는다 — 독립 근거가 2곳 미만이면 예외로 두지 않고 값은 부수 기본값 + '이견', 실무 값은 alt_char(PRACTICE).
    문헌·간지가 먼저인 글자에서 실무 자료 2곳 이상이 준 다른 값은 글자 대체값(alt_char, PRACTICE)으로만 싣는다(P7).
    그 밖의 글자값은 일치율 측정용이다.
  - 문헌 예외(김만태 예시 KIM-EX · 미소 한국작명원 예시 MISO — 작명소 페이지지만 사용자 결정 P1 이 문헌으로 친다)는
    실무 자료 지지 조건 없이 문헌만으로 반영한다(P1 조건 0). 다만 B-2(2026-10-22 통합 결정): 실무 자료 2곳 이상이 다른 같은
    값으로 반대하면 확정하지 않는다 — 그 실무 값이 부수 기본값이면 부수값 + '이견', 다르면 실무 예외 규칙(B-1 포함)을 따른다.
    문헌 값은 alt_char(문헌 출처)로 남는다.
  - 이루미(ERUMY)는 작명 서비스의 규칙 서술이라 문헌이 아니다(kind practice) — 글자 대체값(alt_char) 근거로만 쓴다.
  - 수집 원자료(tmp/radical-research/)와 Unihan(tmp/unihan-18.0/)은 저장소에 복사하지 않는다(gitignore, 로컬 전용).

재현성:
  기본 실행은 tmp 를 읽지 않는다 — 고정본 + data/hanja_radicals.json(글자 → 판정 부수) + hanja-seo.json(대상 글자)만 읽는다.
  --refresh 는 tmp 자료(조사 원자료·Unihan)와 name-seo.json(이름 빈도)으로 다시 집계해 고정본과 비교하고 차이를 보고한다
  (아무 파일도 쓰지 않는다. 다르면 exit 1). --refresh --freeze 는 다시 집계한 값으로 고정본을 덮어쓰고 출력도 만든다.
  출력은 어느 모드에서든 디스크의 고정본에서 만든다 — 같은 고정본이면 tmp 유무와 관계없이 같은 바이트.

사용법:
  python -I scripts/build_radical_resource_table.py                     기본 (인자 없음, 같은 입력이면 같은 출력)
  python -I scripts/build_radical_resource_table.py --refresh           tmp 필요 — 다시 집계해 고정본과 비교만
  python -I scripts/build_radical_resource_table.py --refresh --freeze  tmp 필요 — 고정본 갱신 + 출력
"""

import argparse
import collections
import hashlib
import json
import os
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")  # 멈출 때(SystemExit) 메시지도 utf-8
sys.dont_write_bytecode = True  # 공용 판정 모듈을 불러도 scripts/__pycache__ 를 만들지 않는다
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kangxi_radical_order  # noqa: E402  (부수 표준형 · --refresh 의 Unihan 판정: extract_hanja_radicals.py 와 같은 함수)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIHAN = os.path.join(ROOT, "tmp", "unihan-18.0", "Unihan_IRGSources.txt")
UNIHAN_ZIP = os.path.join(ROOT, "tmp", "unihan-18.0", "Unihan.zip")  # kKangXi(Unihan_DictionaryIndices.txt)만 읽는다
TRAD = os.path.join(ROOT, "tmp", "radical-research", "tradition", "sources")
DB_FILES = (("src_hanname.json", "HN"), ("src_namechart.json", "NC"), ("src_ioreum.json", "IO"))
SEO = os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json")
NAME_SEO = os.path.join(ROOT, "frontend", "src", "data", "name-seo.json")  # --refresh 의 이름 빈도(亠)만
HANJA_RAD = os.path.join(ROOT, "data", "hanja_radicals.json")
FROZEN = os.path.join(ROOT, "data", "radical_resource_votes.json")
OUT_TABLE = os.path.join(ROOT, "data", "radical_resource_element.json")
OUT_EXC = os.path.join(ROOT, "data", "resource_element_exceptions.json")


def rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


EL = "木火土金水"
VOTE_MIN_N = 3          # 출처 DB 가 부수 하나에 이 글자 수 이상을 가져야 '1표'
VOTE_MIN_SHARE = 0.5    # 그리고 다수값이 과반(초과)이어야 1표 — 아니면 '글자별 갈림'
AGREE_MIN_SHARE = 2 / 3  # 표를 낸 DB 의 다수값 비율이 이보다 낮으면 합의라도 '이견(글자별 갈림)'
TIE_ORDER = ("HN", "NC", "KIM", "IO")  # 동률이면 옥편 계열 우선 (계획 §2-2, D2)
DB_KEYS = ("HN", "NC", "IO", "HN-S")   # 부수 집계 키 (HN-S = 철학캠프 개별 조회 표본, 표는 주지 않는다)

# 실무 예외 (D1 개정 2026-10-22)
PRACTICE_SOURCES = ("HN", "NC", "IO")  # 글자 단위에서는 HN = 독음 전수 + 개별 조회(HN-S) 합침
PRACTICE_MIN_SOURCES = 2               # 이 수 이상이 같은 단일값을 주고 그 값이 부수 기본값과 다르면 실무 예외
PRACTICE_MAX = 150                     # 실무 예외가 이보다 많으면 반영하지 않고 멈춘다(사용자 지시)
# B-1 (2026-10-22 통합 결정): 이 자료의 글자값이 그 자료 자신의 이 부수 다수값(고정본 votes, 동률 아님)과 같으면 부수 규칙값의
#   반복으로 보고 실무 예외(부수 기본값에서 벗어나는 값)를 세울 독립 근거로 세지 않는다. 이오름은 수집 6,722자 중 99.70% 가 그
#   부수의 이오름 다수값이라 사실상 214부수 규칙표다. 같은 값을 준 곳 수(n)는 그대로 싣고 독립 근거 수(n_indep)를 따로 싣는다.
PRACTICE_RULE_ECHO_SOURCES = ("IO",)
# B-2 (2026-10-22 통합 결정): 문헌 예외 후보에 실무 자료 이 수 이상이 다른 같은 값을 주면 문헌 예외로 확정하지 않는다.
LIT_OVERRULE_MIN_SOURCES = 2
# B-2 의 반대 값이 부수 기본값이면 부수 규칙값의 반복(B-1)도 반대 수에 센다 — 통합 결정이 宣(실무 값이 있는 2곳 모두 부수값
#   木, 그중 1곳이 이오름 부수 규칙값)을 '木+이견'으로 정했기 때문. 규칙으로 쓰면: 부수 규칙값의 반복은 부수 기본값 쪽 표로는
#   세고, 부수 기본값에서 벗어나는 표(실무 예외·부수값이 아닌 반대 값)로는 세지 않는다. 반대 값이 부수값이 아니면 반대 수 =
#   독립 근거 수이고, 그 수가 2곳 이상이면 곧 실무 예외다. False 로 두면 부수값 쪽 반대도 독립 근거로만 센다(宣·成 은 문헌 예외로 남음).
LIT_OVERRULE_COUNTS_RULE_ECHO = True
NAME_FREQ_REF_DATE = "2026-10-22"      # 이름 빈도: name-seo.json 공개 이름(pa 없음 또는 pa ≤ 기준일)의 combos 출현 수
FROZEN_SCHEMA = 3

# ---------------------------------------------------------------------------------------------
# 출처 키 (메타에 그대로 싣는다)
# ---------------------------------------------------------------------------------------------
SOURCES = {
    "UNIHAN": {
        "kind": "data",
        "title": "Unicode Unihan Database 18.0 — kRSUnicode (Unihan_IRGSources.txt, 2026-07-31)",
        "url": "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip",
        "use": "글자 → 강희 부수 번호(kRSUnicode 첫 값. 첫 값이 강희자전 배열과 어긋나면 kRSUnicode 다른 값·원 코드 차트 배열 부수 중 kKangXi 쪽수에 맞는 쪽 — scripts/kangxi_radical_order.py, 결과는 data/hanja_radicals.json). 변형 부수(氵·忄·扌 …)는 원형과 같은 번호다",
    },
    "KIM": {
        "kind": "literature",
        "title": "김만태, 「3-3. 이름의 음양오행 구성 원리」, '부수와 자의에 따른 자원오행의 예' 표의 부수 열 (김만태교수 사주작명원, 2012-03-22 게시)",
        "url": "http://namestory.dsso.kr/m/bbs/board.php?bo_table=sub3_1&wr_id=19",
        "use": "명시적 부수표. 부수당 1표",
    },
    "KIM-EX": {
        "kind": "literature",
        "title": "같은 글 같은 표의 '예' 열 — 오행별 예시 한자 90자",
        "url": "http://namestory.dsso.kr/m/bbs/board.php?bo_table=sub3_1&wr_id=19",
        "use": "글자 단위 문헌 값. 그 글자 자신의 근거(예외표 literature_examples), 문헌 예외 근거(실무 자료 지지 조건 없음 P1 — "
               "실무 자료 2곳 이상이 다른 같은 값으로 반대하면 확정하지 않고 alt_char 로, B-2). "
               "부수값 보강 근거로는 같은 부수 예시(확정한 문헌 예외 글자 제외)가 모두 부수값과 같고 김만태 부수표가 그 부수에 다른 "
               "값을 주지 않을 때만 쓴다(표 제목이 '부수와 자의에 따른 자원오행의 예'라 예시는 자의 값일 수 있다)",
    },
    "KIM-TXT": {
        "kind": "literature",
        "title": "같은 글 본문 서술 — 華·立·載·女·娟·谷·康의 오행이 관점에 따라 갈린다는 설명",
        "url": "http://namestory.dsso.kr/m/bbs/board.php?bo_table=sub3_1&wr_id=19",
        "use": "부수·글자 이견의 문헌 근거",
    },
    "MISO": {
        "kind": "literature",
        "title": "미소 한국작명원 「성명에 필요한 오행 - 자원오행」 — 작명소 설명 페이지의 예시 45자. 페이지 끝에서 참고서 "
                 "『作名玉篇 五行漢字典』(동양서관, 권세준 편)을 권하지만 예시가 그 책에서 왔다고 밝히지는 않는다",
        "url": "https://www.miso.co.kr/Resource/Theory/20253",
        "use": "작명소 페이지의 글자 단위 값. 사용자 결정(P1 '문헌 예외는 문헌만으로')에 따라 문헌 예외 근거로 쓴다(B-2 반대 조건은 "
               "KIM-EX 와 같다) — 성격은 작명소 예시라 학술 문헌이 아니다. 그 글자 자신의 근거(예외표 literature_examples), "
               "부수값 보강 근거는 KIM-EX 와 같은 조건",
    },
    "ERUMY": {
        "kind": "practice",
        "title": "이루미 작명시스템 「자원오행이란 무엇인가」 (작명 서비스의 설명 페이지)",
        "url": "https://www.erumy.com/service/name_02.aspx",
        "use": "작명 서비스의 규칙 서술 — 부수나 글자 뜻으로 구분, 간지·구성요소 해석(祥=示+羊→未土). 문헌이 아니고 실무 예외(PRACTICE) "
               "집계에도 들지 않는다 — 글자 대체값(alt_char) 근거로만 쓴다",
    },
    "CRIT": {
        "kind": "literature",
        "title": "성민경(한국좋은이름연구소), 「자원오행 성명학으로 작명하는 사이비 작명가들」",
        "url": "https://name114.com/sub10_1.php?code=consult&id=78957&type=read",
        "use": "비판 근거 — 숫자 한자의 자원오행 기준이 없다는 지적",
    },
    "AC1": {
        "kind": "literature",
        "title": "이재승·김만태(2018), 「한국 성씨한자의 자원오행에 대한 고찰」, 『문화와융합』 40(3):339-368, doi:10.33645/cnc.2018.06.40.3.339",
        "url": "https://doi.org/10.33645/cnc.2018.06.40.3.339",
        "use": "초록만 확인 — 강·중·약·무의미·불명 등급. 학계는 '불명'을 인정한다(값은 채운다, D3)",
    },
    "AC2": {
        "kind": "literature",
        "title": "이재승(2024), 「인명 한자 214 부수의 자원에 의한 성명학적 오행 배속」, 『인문사회과학연구』 6(5):1-20, doi:10.62783/SHSS.6.5.1",
        "url": "https://doi.org/10.62783/SHSS.6.5.1",
        "use": "초록만 확인 — 부수별 강·중·약·불명. 214부수 배정표 본문은 유료라 못 봄",
    },
    "GANJI": {
        "kind": "tradition",
        "title": "천간·지지 오행 배속 — 甲乙 木 · 丙丁 火 · 戊己 土 · 庚辛 金 · 壬癸 水 / 寅卯 木 · 巳午 火 · 申酉 金 · 亥子 水 · 辰戌丑未 土",
        "url": None,
        "use": "간지 예외. 간지 글자는 부수보다 간지 오행이 먼저다",
    },
    "HN": {
        "kind": "practice",
        "title": "철학캠프 한네임 「대법원 인명용 한자사전」 (2026-10-21 수집, 독음 24개 전수)",
        "url": "http://hanname.com/?p=32",
        "use": "부수별 다수값(실무 관행)을 부수표 1표로, 글자값은 실무 예외(PRACTICE — 2곳 이상 같은 값)에 쓴다(D1 개정). 그 밖은 측정용",
    },
    "HN-S": {
        "kind": "practice",
        "title": "철학캠프 한네임 개별 조회 118자 (예외 확인용으로 골라 뽑은 표본)",
        "url": "http://hanname.com/?p=32",
        "use": "치우친 표본이라 부수표에 표를 주지 않는다(다른 DB 자료가 하나도 없는 부수에서만 basis 참고 근거). 글자 단위(실무 예외)에서는 HN 과 합쳐 철학캠프 한 곳으로 센다",
    },
    "NC": {
        "kind": "practice",
        "title": "네임차트 음절별 한자 표 (2026-10-21 수집)",
        "url": "https://www.namechart.kr/name/",
        "use": "부수별 다수값(실무 관행)을 부수표 1표로, 글자값은 실무 예외(PRACTICE)에 쓴다(D1 개정). 그 밖은 측정용",
    },
    "IO": {
        "kind": "practice",
        "title": "이오름 한자 사전 — '이오름 자원오행 룰셋', 방법론 '한자 부수 기반 오행 분류(214부수)' (2026-10-21 수집)",
        "url": "https://www.ioreum.com/hanja/",
        "use": "사실상 공개된 214부수 규칙표. 부수별 다수값을 1표로(동률 순위는 마지막), 글자값은 실무 예외(PRACTICE)에 쓴다 — "
               "글자값이 이오름 자신의 그 부수 다수값과 같으면 부수 규칙값의 반복이라 실무 예외의 독립 근거로 세지 않는다(B-1)",
    },
    "PRACTICE": {
        "kind": "practice",
        "title": "작명 실무 자료 다수 — 철학캠프(HN, 개별 조회 포함)·네임차트(NC)·이오름(IO) 가운데 %d곳 이상이 같은 값 "
                 "(실무 예외는 독립 근거 %d곳 이상 — 이오름 값이 이오름 자신의 부수 다수값과 같으면 독립으로 세지 않는다, B-1)"
                 % (PRACTICE_MIN_SOURCES, PRACTICE_MIN_SOURCES),
        "url": None,
        "use": "실무 예외(등급 X)·글자 대체값(alt_char)·문헌 예외를 확정하지 않은 근거(B-2 — 그 글자 basis 에 들어간다). 어느 자료가 "
               "줬는지는 적지 않고 같은 값을 준 곳 수(n)·값이 있는 곳 수(of)·그중 독립 근거 수(n_indep)만 싣는다 (D1 개정·P7·B-1·B-2)",
    },
    "JAUI": {
        "kind": "derived",
        "title": "부수 자의(字意) 추정 — 이 저장소의 판단. 출처 없음",
        "url": None,
        "use": "어느 출처에도 자료가 없는 부수만. 사람 검수 필요",
    },
}
EXCLUDED_SOURCES = {
    "BR": "브런치 @name/34 '오행별 대표 부수' 표 — 玉을 土·金 양쪽에 두는 등 품질이 낮아 판정·근거에서 뺐다",
}
DECISIONS = {
    "D1": "2026-10-22 사용자 결정(개정): 값은 kRSUnicode 부수 + 공개 문헌 부수표 + 간지 예외 + 문헌 예외 + 실무 예외. "
          "실무 예외 = 작명 실무 자료(HN·NC·IO) %d곳 이상이 같은 값을 주고 그 값이 부수 기본값과 다른 글자(등급 X, basis PRACTICE — "
          "곳 수는 B-1 대로 독립 근거로 센다). %d자를 넘으면 반영하지 않는다. 그 밖의 DB 글자값은 측정용" % (PRACTICE_MIN_SOURCES, PRACTICE_MAX),
    "D2": "이견 부수 기본값은 계획 §2-2 권고표대로(4표 다수결, 동률은 HN→NC→KIM→IO). 2026-10-22 '그 밖의 D 항목은 권고안대로'로 승인. "
          "弓·亠 값은 P2, 人·广·頁·彡 등급은 P5 로 고쳤다",
    "D3": "숫자 한자(一~十·百·千·萬)·약한 부수는 부수값 + '이견' 표시. '불명'을 값으로 두지 않는다. 실무 예외가 덮는 숫자는 예외(X)",
    "P1": "2026-10-22: 문헌 예외(KIM-EX·MISO)는 실무 자료 지지 조건 없이 문헌만으로 적용(조건 0) — 실무 자료 반대 조건은 B-2",
    "P2": "2026-10-22: 弓 → 木(검토 권고). 亠 → 이름 빈도 가중 다수(실무 예외로 처리되는 京·亨 글자는 빼고 셈 — 같은 이유로 실무 예외인 "
          "亢 도 뺌. 근거는 부수표 note)",
    "P3-P4-P6": "2026-10-22: 오방(南·北·中)·괘 이름(乾·巽)·R 인데 DB 2곳 반대(厦·叡)·숫자 五 에는 따로 규칙을 두지 않는다 — 실무 예외 규칙이 덮는 만큼만",
    "P5": "2026-10-22: 人·广·頁·彡 부수는 합의(agreed) — 실무 자료 세 곳(HN·NC·IO)의 부수 다수값이 모두 같고 김만태 표 한 칸만 반대. "
          "같은 글의 예시(人 儁·頁 顥 火)는 구성 요소(隹·日)도 김만태 표에서 火라 부수 반례로는 약하고, 본문의 康 서술은 글자 단위라 "
          "부수 근거로 치지 않는다 — 값은 실무 자료 다수만으로 선다",
    "P7": "2026-10-22: 글자 대체값 alt_char 에 문헌 값과 실무 자료 값(%d곳 이상이 준 다른 값)을 출처를 나눠 싣는다" % PRACTICE_MIN_SOURCES,
    "B-1": "2026-10-22 통합 담당 결정(사용자 목표 '작명소와 같은 답' 기준): 이오름 글자값이 이오름 자신의 그 부수 다수값과 같으면 "
           "부수 규칙값의 반복이라 실무 예외를 세울 독립 근거로 세지 않는다(PRACTICE_RULE_ECHO_SOURCES). 같은 값을 준 곳은 %d곳 이상이지만 "
           "독립 근거가 %d곳 미만인 글자는 예외로 두지 않는다 — 값은 부수 기본값, 등급 '이견', 실무 값은 alt_char(PRACTICE, n/of/n_indep). "
           "글자 목록은 두지 않고 규칙으로 고른다(고정본 practice_alt 의 under=rule_echo)" % (PRACTICE_MIN_SOURCES, PRACTICE_MIN_SOURCES),
    "B-2": "2026-10-22 통합 담당 결정: 문헌 예외(후보 = 문헌 값이 부수값과 다른 글자)는 실무 자료 %d곳 이상이 다른 같은 값으로 "
           "반대하면 확정하지 않는다. 그 실무 값이 부수 기본값이면 부수값 + '이견'(문헌 값은 alt_char, 문헌 출처), 다르면 실무 예외 규칙"
           "(B-1 포함)을 따른다. 부수값 쪽 반대에는 부수 규칙값의 반복도 센다(LIT_OVERRULE_COUNTS_RULE_ECHO — 결정의 宣 '木+이견'). "
           "확정하지 않은 후보도 부수 집계에서는 뺀 채 둔다(집계 정의를 바꾸면 부수값 → 판정 → 집계가 서로를 바꿀 수 있다). "
           "결과 목록은 고정본 literature_overruled" % LIT_OVERRULE_MIN_SOURCES,
    "B-3": "2026-10-22 통합 담당 결정: 추가 수집 없음 — 中·耕 은 지금 자료 그대로",
}
PENDING_DECISIONS = {}  # 2026-10-22 P1~P7 결정으로 비었다. 새 대기 항목이 생기면 여기에 적는다

# ---------------------------------------------------------------------------------------------
# 문헌 전사 (KIM·MISO). 원문: tmp/radical-research/tradition/raw/namestory_19.html · miso_20253.html
# ---------------------------------------------------------------------------------------------
# 김만태 표 부수 열 — 변형 표기(艹·衤·扌·亻·辶·阝·王·刂·灬·忄·礻·氵·月(肉))는 원형 부수로 적었다
KIM_TABLE = {
    "木": "木 艸 禾 生 衣 竹 米 糸 角 目 靑 頁 風 香 巾 黍 宀 門 乙 儿 大 彡 手",
    "火": "心 火 日 示 見 赤 馬 高 鳥 飛 隹 行 彳 車 曰",
    "土": "土 己 山 牛 穴 田 羊 辰 龍 黃 艮 厂 广 女 人 辵 里 邑 阜 力 方",
    "金": "金 刀 戈 玉 石 貝 白 言 辛 酉 八 矢 革 骨 皮 匕 勹 斤 矛 立",
    "水": "水 口 子 月 玄 血 魚 食 黑 气 用 疒 肉 雨 又 谷 夕",
}
KIM_EX = {
    "木": "朴李東林柳華茂秀補産箕範綠眞建長守元",
    "火": "怡恩惠煥爀照晳顥明普智昌昶駿翊鳳儁載",
    "土": "奎在均基崇崔美男良娟娘隱郞郁牟進道正",
    "金": "鉉鍾判創劉珏珉璨玩碩現賢貞皓謙新兌尙",
    "水": "渙浩海沈泳法喆哲呂吉國善宣益鮮餘甫點",
}
MISO_EX = {
    "木": "柱相桓秀花家甲康綱",
    "火": "炳昞晟車見炫成憬光",
    "土": "基埈城在達島都邑兩",
    "金": "鉉玲敏瑞玟白言劉謨",
    "水": "水泳甫有月夕善鮮雨",
}
# KIM 본문 서술 — 부수 단위 이견 (alt 에 넣고 '이견'으로 둔다)
RAD_LIT_ALT = {
    "女": [("水", "KIM-TXT", "김만태 본문: 女는 한편 水, 한편 상극인 土에 배속한다")],
    "谷": [("土", "KIM-TXT", "김만태 본문: 谷은 한편 土, 한편 水에 배속한다")],
}
# KIM 본문 서술 — 부수 단위 참고(값·이견 판정은 바꾸지 않고 note 에만)
RAD_LIT_NOTE = {
    "立": "김만태 본문: 立은 자원(사람이 서 있는 모양)상 木이어야 하나 실제로는 金에 배속된다",
    "車": "김만태 본문: 載는 자원상 金이어야 하나 실제로는 火에 배속된다",
    "犬": "철학캠프는 변형 犭 글자를 水, 원형 犬 글자를 土로 갈라 적는다. 계획 §2-1대로 변형을 따로 다루지 않고 土 하나",
    "示": "祐 한 글자도 실무 자료마다 木·火·金으로 갈린다(김만태 표의 示 는 火)",
    "石": "이오름 룰셋과 브런치 표(판정 제외)는 土",
    "玄": "{practice} — 글자값은 예외표(resource_element_exceptions.json)에서 정한다",
}
# note 의 {practice} = 이 부수의 실무 예외 글자와 값·출처 개수(고정본 practice_exceptions 에서 만든다 — 손으로 적은 수가 낡지 않게).
# 2026-10-22 검증 반영: 김만태 본문의 康 서술은 글자 단위라 부수(广) 근거(KIM-TXT)로 치지 않는다(전에 있던 RAD_LIT_SUPPORT 广 삭제)

# 계획 §2-2 '이견 부수 기본값 권고안'(D2 승인) — 부수 문자 → 값. 弓·亠 는 아래 P2 가 덮는다(계획 기록으로 남김)
PLAN_D2 = {
    "示": "木", "人": "火", "石": "金", "頁": "火", "彡": "火", "广": "木", "犬": "土",
    "大": "木", "一": "木", "儿": "木", "寸": "土", "立": "金", "車": "火", "力": "土", "玄": "水",
    "亠": "火", "弓": "火", "聿": "火", "舛": "木", "足": "土", "入": "土",
    "小": "水", "工": "火", "廴": "木", "文": "木", "欠": "火", "耳": "火", "臣": "火", "見": "火",
    "穴": "水", "鹿": "土", "乙": "木", "八": "金", "勹": "金", "曰": "火",
}
# 계획 §2-2 '단일 출처 14 — 그 값을 쓴다'(D2 승인)
PLAN_SINGLE = {
    "冖": "水", "干": "木", "气": "水", "癶": "火", "艮": "土", "血": "水", "谷": "水",
    "辰": "土", "飛": "火", "高": "火", "骨": "金", "黃": "土", "龍": "土", "黍": "木",
}
# P2 (2026-10-22) — 부수 기본값을 사용자 결정 값으로
P2_VALUES = {
    "弓": ("木", "P2(2026-10-22): 검토 권고 木 — 부수 단위 표는 이오름 규칙표의 木 하나이고, 글자 弦·弧는 실무 자료 3곳 모두 木. "
                 "그 밖의 弓 글자는 실무 자료 값이 火·金·土·水로 갈린다 — {practice}. '활=나무' 재질 배속은 출처 없는 설명이라 "
                 "근거로 치지 않는다. 계획 D2 권고 火는 동률 순위로 고른 값이었고 지지하는 표·문헌이 없었다"),
}
# P2 (2026-10-22) — 이름 빈도 가중 다수로 정하는 부수.
#   글자마다 HN(개별 조회 포함)·NC 단일값에 그 글자의 이름 빈도(combos 출현 수)를 더한다.
#   IO 는 214부수 규칙표라 이 부수 글자 모두에 같은 값을 준다 — 글자 단위 가중에 넣으면 규칙 하나가 글자 수만큼 표를 얻으므로
#   검토(verify-expert radical_fit '이름가중 HN+NC')와 같게 뺐다.
#   가중은 NAMEFREQ_TIERS 순으로 합이 0 이 아닌 첫 단계를 쓴다: 공개 이름(기준일 NAME_FREQ_REF_DATE) → 전체 수록 이름
#   (name-seo.json 의 아직 공개 전 이름 포함) → 같은 출처의 글자 수. 단계마다 합은 고정본에 남긴다.
#   exclude = 실무 예외로 따로 처리되는 글자(사용자 지시: 京·亨 — 같은 이유로 실무 예외인 亢 도 뺐다, 2026-10-22 검증 반영).
#   실무 예외가 되는지는 --refresh 가 확인한다.
NAMEFREQ = {
    "亠": {"exclude": (0x4EAC, 0x4EA8, 0x4EA2), "sources": ("HN", "NC")},
}
NAMEFREQ_TIERS = ("public", "all", "chars")
# P5 (2026-10-22) — 김만태 표 한 칸만 반대인 D2 부수를 합의로 친다(그 반대는 alt 에서 빼고 overridden 에 남김).
#   값의 근거는 실무 자료 세 곳의 부수 다수값(빌드가 셋 모두 같은 값인지 확인한다). 아래 문장은 김만태 쪽 반대를 어떻게 봤는지
P5_AGREED = {
    "人": "같은 글의 예시 儁은 火지만 구성 요소 隹도 김만태 표에서 火라 부수 반례로는 약하다",
    "广": "같은 글 본문의 康 서술(자원오행상 木이나 실제로는 庚처럼 金)은 글자 단위 서술이라 부수 근거로 치지 않는다",
    "頁": "같은 글의 예시 顥는 火지만 구성 요소 日도 김만태 표에서 火라 부수 반례로는 약하다",
    "彡": "계획 D2 표에서 頁과 한 줄로 묶인 부수(같은 글 안의 반례는 없다)",
}
# 어느 출처에도 자료가 없는 부수 — 자의 추정 (사람 검수 필요)
JAUI = {
    "屮": ("木", "屮(싹날 철)은 풀의 싹이 돋는 모양 — 木으로 추정"),
    "色": ("火", "色(빛 색)은 낯빛·빛깔 — 빛을 火로 보는 관행에 따라 추정"),
}

# 간지 22자 — 코드포인트로 적는다 (호환·정규화 사고 방지)
GANJI = [
    (0x7532, "木", "천간 甲"), (0x4E59, "木", "천간 乙"), (0x4E19, "火", "천간 丙"), (0x4E01, "火", "천간 丁"),
    (0x620A, "土", "천간 戊"), (0x5DF1, "土", "천간 己"), (0x5E9A, "金", "천간 庚"), (0x8F9B, "金", "천간 辛"),
    (0x58EC, "水", "천간 壬"), (0x7678, "水", "천간 癸"),
    (0x5B50, "水", "지지 子"), (0x4E11, "土", "지지 丑"), (0x5BC5, "木", "지지 寅"), (0x536F, "木", "지지 卯"),
    (0x8FB0, "土", "지지 辰"), (0x5DF3, "火", "지지 巳"), (0x5348, "火", "지지 午"), (0x672A, "土", "지지 未"),
    (0x7533, "金", "지지 申"), (0x9149, "金", "지지 酉"), (0x620C, "土", "지지 戌"), (0x4EA5, "水", "지지 亥"),
]
# 숫자 한자 13자 (D3: 부수값 + 이견, 실무 예외가 덮으면 예외)
NUMBERS = [0x4E00, 0x4E8C, 0x4E09, 0x56DB, 0x4E94, 0x516D, 0x4E03, 0x516B, 0x4E5D, 0x5341, 0x767E, 0x5343, 0x842C]
# 문헌 본문(KIM-TXT)·작명 서비스 서술(ERUMY)이 글자 단위 이견을 적은 글자
#   (값은 부수값 그대로, '이견' + alt_char — 실무 예외가 덮으면 그 예외의 근거·대체값으로)
CHAR_LIT_DISPUTE = [
    (0x83EF, ["火"], "KIM-TXT", "김만태 본문: 華는 부수(艸)로는 木, 자의(꽃·빛남)로는 火"),
    (0x5EB7, ["金"], "KIM-TXT", "김만태 본문: 康은 자원오행상 木이나 실제로는 庚(金)과 같이 취급하는 경우가 많다"),
    (0x5A1F, ["火", "水"], "KIM-TXT", "김만태 본문: 娟은 부수(女)로 보면 水나 土, 자의(예쁨)로 보면 火"),
    (0x8F09, ["金"], "KIM-TXT", "김만태 본문: 載는 자원상 金이어야 하나 실제로는 火에 배속된다"),
    (0x7965, ["土"], "ERUMY", "이루미: 祥은 示변 + 羊이고 羊이 未土라서 土 기운으로 본다"),
]
SRC_NAME = {"KIM-EX": "김만태 예시", "MISO": "미소 한국작명원 예시", "KIM-TXT": "김만태 본문", "ERUMY": "이루미"}
DB_NAME = {"HN": "철학캠프", "NC": "네임차트", "IO": "이오름"}

COMPAT_RANGES = ((0xF900, 0xFAFF), (0x2F800, 0x2FA1F))


def is_compat(ch):
    return any(lo <= ord(ch) <= hi for lo, hi in COMPAT_RANGES)


def nfkc(s):
    return unicodedata.normalize("NFKC", s)


def cp_str(ch):
    return "U+%04X" % ord(ch)


def el_sort(vals):
    return sorted(set(vals), key=EL.index)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path):
    if not os.path.exists(path):
        raise SystemExit("입력 없음: %s" % path)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, doc):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")


def counter_sorted(cnt):
    return sorted(cnt.items(), key=lambda kv: (-kv[1], EL.index(kv[0])))


# ---------------------------------------------------------------------------------------------
def check_literals():
    """소스에 적은 한자 리터럴이 호환 한자가 아니고 NFC 로 바뀌지 않는지 확인한다."""
    texts = []
    for d in (KIM_TABLE, KIM_EX, MISO_EX):
        texts.extend(d.values())
    for d in (PLAN_D2, PLAN_SINGLE, JAUI, RAD_LIT_ALT, RAD_LIT_NOTE, P2_VALUES, NAMEFREQ, P5_AGREED):
        texts.extend(d)
    for t in texts:
        for ch in t:
            if ch.isspace():
                continue
            if is_compat(ch) or unicodedata.normalize("NFC", ch) != ch:
                raise SystemExit("호환 한자 리터럴 발견: %s %s" % (cp_str(ch), t))


def rules_fingerprint():
    """고정본이 어떤 규칙 상수로 집계됐는지 — 기본 실행이 같은지 확인한다(다르면 --refresh --freeze 필요)."""
    return {
        "schema": FROZEN_SCHEMA,
        "vote_min_n": VOTE_MIN_N, "vote_min_share": VOTE_MIN_SHARE, "agree_min_share": round(AGREE_MIN_SHARE, 6),
        "practice_sources": list(PRACTICE_SOURCES), "practice_min_sources": PRACTICE_MIN_SOURCES,
        "practice_max": PRACTICE_MAX, "practice_rule_echo_sources": list(PRACTICE_RULE_ECHO_SOURCES),
        "lit_overrule_min_sources": LIT_OVERRULE_MIN_SOURCES, "lit_overrule_counts_rule_echo": LIT_OVERRULE_COUNTS_RULE_ECHO,
        "name_freq_ref_date": NAME_FREQ_REF_DATE,
        "namefreq": {rc: {"exclude": [cp_str(chr(cp)) for cp in s["exclude"]], "sources": list(s["sources"])}
                     for rc, s in NAMEFREQ.items()},
        "namefreq_tiers": list(NAMEFREQ_TIERS),
        "ganji": [cp_str(chr(cp)) for cp, _, _ in GANJI],
        "literature_chars": sorted({cp_str(nfkc(ch)) for d in (KIM_EX, MISO_EX) for s in d.values() for ch in s}),
    }


# ---------------------------------------------------------------------------------------------
# 공통 문맥: 대상 글자 · 판정 부수 · 부수 문자 · 문헌 글자값
# ---------------------------------------------------------------------------------------------
class Ctx:
    pass


def make_ctx():
    c = Ctx()
    c.num2ch = kangxi_radical_order.radical_chars()
    c.ch2num = {ch: n for n, ch in c.num2ch.items()}
    c.seo = load_json(SEO)
    c.target = sorted({nfkc(ch) for ch in c.seo}, key=ord)  # 호환 한자 85자는 통합 한자로 붙는다(§2-1 ①)
    c.tset = set(c.target)
    # 글자 → 판정 부수: data/hanja_radicals.json (extract_hanja_radicals.py 산출 — kangxi 필드 = kangxi_radical_order 판정)
    rad = load_json(HANJA_RAD)
    if set(rad) != set(c.seo):
        raise SystemExit("hanja_radicals.json 과 hanja-seo.json 키가 다르다 — extract_hanja_radicals.py 를 먼저 돌릴 것")
    c.krs, c.moved = {}, {}
    for ch in c.target:
        v = rad[ch]
        k = v.get("kangxi")
        c.krs[ch] = k["radical"] if k else v["radical"]
        if k:
            c.moved[ch] = {"krs_first": v["radical"], "used": k["radical"], "kangxi_page": k["kangxi_page"],
                           "basis": k["basis"]}
    c.kim_rad = {}
    for e, s in KIM_TABLE.items():
        for r in s.split():
            if r not in c.ch2num:
                raise SystemExit("김만태 표 부수 매핑 실패: %s" % r)
            c.kim_rad[c.ch2num[r]] = e
    for d in (PLAN_D2, PLAN_SINGLE, JAUI, RAD_LIT_ALT, RAD_LIT_NOTE, P2_VALUES, NAMEFREQ, P5_AGREED):
        for r in d:
            if r not in c.ch2num:
                raise SystemExit("부수 문자 매핑 실패: %s" % r)
    c.ganji = {chr(cp): (e, label) for cp, e, label in GANJI}
    c.lit_char = collections.defaultdict(list)  # char -> [(value, source)]
    for key, d in (("KIM-EX", KIM_EX), ("MISO", MISO_EX)):
        for e, s in d.items():
            for ch in s:
                c.lit_char[nfkc(ch)].append((e, key))
    for ch, lst in c.lit_char.items():
        if ch not in c.tset:
            raise SystemExit("문헌 예시 글자가 대상 밖: %s" % ch)
        if len({v for v, _ in lst}) != 1:
            raise SystemExit("문헌끼리 값이 다른 글자: %s %s" % (ch, lst))
    c.lit_value = {ch: lst[0][0] for ch, lst in c.lit_char.items()}
    c.tcount = collections.Counter(c.krs[ch] for ch in c.target)
    return c


# ---------------------------------------------------------------------------------------------
# 부수표 (집계 votes → 부수값·상태). 기본 실행과 --refresh 가 같은 함수를 쓴다
# ---------------------------------------------------------------------------------------------
def namefreq_element(nf):
    """이름 빈도 가중 다수 — NAMEFREQ_TIERS 순으로 합이 0 이 아닌 첫 단계. 동률이면 멈춘다(사람 결정)."""
    for tier in NAMEFREQ_TIERS:
        use = nf["tiers"][tier]
        if sum(use.values()) > 0:
            break
    else:
        raise SystemExit("이름 빈도 집계에 값이 없다: %s" % nf["radical"])
    best = max(use.values())
    tops = [e for e in EL if use.get(e, 0) == best]
    if len(tops) != 1:
        raise SystemExit("이름 빈도 집계가 동률: %s %s %s" % (nf["radical"], tier, use))
    return tops[0], tier


def build_table(ctx, votes_doc, namefreq, skip_chars):
    table = {}
    for n in range(1, 215):
        rc = ctx.num2ch[n]
        votes, weak, low = {}, {}, {}
        if n in ctx.kim_rad:
            votes["KIM"] = ctx.kim_rad[n]
        vote_detail = {}
        for k in DB_KEYS:
            vd = votes_doc[str(n)].get(k)
            if not vd:
                continue
            shown, topn, tot = vd
            tie = "/" in shown
            top = shown.split("/")[0]
            vote_detail[k] = [shown, topn, tot]
            if k == "HN-S":
                if not tie:
                    low[k] = top
                continue
            if tot >= VOTE_MIN_N and not tie and topn / tot > VOTE_MIN_SHARE:
                votes[k] = top
                if topn / tot < AGREE_MIN_SHARE:
                    weak[k] = top
            elif tot >= VOTE_MIN_N:
                weak[k] = None if tie else top
            elif not tie:
                low[k] = top
        # 규칙 계산값
        rule_el = None
        if votes:
            c = collections.Counter(votes.values())
            best = max(c.values())
            tops = {v for v, m in c.items() if m == best}
            rule_el = next(votes[k] for k in TIE_ORDER if k in votes and votes[k] in tops)
        else:
            pool = {**{k: v for k, v in weak.items() if v}, **low}
            for k in ("IO", "HN", "NC", "HN-S"):  # 계획 §2-2: 표에 없는 부수는 이오름 값부터
                if k in pool:
                    rule_el = pool[k]
                    break
        decided = "rule"
        element = rule_el
        nf_how = None
        if rc in P2_VALUES:
            element, decided = P2_VALUES[rc][0], "P2"
        elif rc in NAMEFREQ:
            element, nf_how = namefreq_element(namefreq[str(n)])
            decided = "P2-namefreq"
        elif rc in PLAN_D2:
            element, decided = PLAN_D2[rc], "D2"
        elif rc in PLAN_SINGLE:
            element, decided = PLAN_SINGLE[rc], "D2-single"
        elif element is None and rc in JAUI:
            element, decided = JAUI[rc][0], "JAUI"
        if element is None:
            raise SystemExit("값을 정하지 못한 부수: %d %s" % (n, rc))

        p5 = rc in P5_AGREED
        overridden = []
        if p5 and ctx.kim_rad.get(n) and ctx.kim_rad[n] != element:
            overridden.append({"src": "KIM", "e": ctx.kim_rad[n], "level": "table", "decision": "P5"})
        if p5 and (not overridden or any(votes.get(k) != element for k in ("HN", "NC", "IO"))):
            raise SystemExit("P5 부수의 전제(실무 자료 세 곳 부수 다수값이 모두 %s, 김만태 표만 반대)가 깨졌다: %s %s %s"
                             % (element, rc, {k: votes.get(k) for k in ("HN", "NC", "IO")}, ctx.kim_rad.get(n)))
        votes_st = {k: v for k, v in votes.items() if not (p5 and k == "KIM")}
        lit_alt = RAD_LIT_ALT.get(rc, [])
        dissent = {k: v for k, v in votes_st.items() if v != element}
        # 적은 자료(n<3)의 반대 — HN-S(치우친 표본)는 이견으로 치지 않는다
        low_dissent = {k: v for k, v in low.items() if k != "HN-S" and v != element}
        weak_dissent = {k: v for k, v in weak.items() if v and v != element}
        # 상태
        if decided == "JAUI":
            status = "unknown"
        elif p5:
            if dissent or weak or lit_alt or low_dissent or len(votes_st) < 2:
                raise SystemExit("P5 부수인데 김만태 표 말고도 이견이 있다: %s %s" % (
                    rc, {"dissent": dissent, "weak": weak, "low": low_dissent, "lit": lit_alt}))
            status = "agreed"
        elif decided in ("D2", "P2", "P2-namefreq") or dissent or weak or lit_alt or low_dissent:
            status = "disputed"
        elif len(votes) >= 2:
            status = "agreed"
        else:
            status = "single"
        # 대체값 — 출처가 '부수의 값'으로 준 것만(표·적은 자료의 다수값·문헌 서술). 글자별 갈림은 split 으로 따로 표시
        alt = list(dissent.values()) + list(weak_dissent.values()) + list(low_dissent.values())
        alt += [v for v, _, _ in lit_alt if v != element]
        alt = el_sort(alt)
        # 대체값마다 누가 어떤 수준으로 냈는가 — 화면이 '이 부수(X)를 Y로 보는 자료도 있습니다'를 쓸지 고를 수 있게
        alt_by = collections.defaultdict(list)
        if n in ctx.kim_rad and ctx.kim_rad[n] != element and not p5:
            alt_by[ctx.kim_rad[n]].append({"src": "KIM", "level": "table"})
        for k in ("HN", "NC", "IO"):
            v = votes.get(k) or weak.get(k) or low.get(k)
            if not v or v == element or k not in vote_detail:
                continue
            _, topn, tot = vote_detail[k]
            level = ("majority" if k in votes and k not in weak else "split") if tot >= VOTE_MIN_N else "few"
            alt_by[v].append({"src": k, "level": level, "n": topn, "of": tot})
        for v, src, _ in lit_alt:
            if v != element:
                alt_by[v].append({"src": src, "level": "text"})
        if sorted(alt_by, key=EL.index) != alt:
            raise SystemExit("alt 와 alt_by 가 다르다: %d %s %s" % (n, alt, dict(alt_by)))
        alt_by = {v: alt_by[v] for v in alt}
        # 근거
        basis = ["UNIHAN"]
        basis += [k for k in ("KIM",) if votes.get(k) == element]
        # 표(과반) · 글자별 갈림 속 다수값 · 적은 자료(n<3) 순으로, element 와 같은 값을 준 DB
        basis += [k for k in ("HN", "NC", "IO")
                  if votes.get(k) == element or weak.get(k) == element or low.get(k) == element]
        if not any(k in vote_detail for k in ("HN", "NC", "IO")) and low.get("HN-S") == element:
            basis.append("HN-S")  # 다른 DB 자료가 하나도 없을 때만 치우친 표본을 참고 근거로 적는다
        # 문헌 예시(글자 단위 값)를 부수값 근거로 치는 것은 같은 부수 예시가 모두 부수값과 같고, 부수 단위 문헌(김만태 표)이 이 부수에
        # 다른 값을 주지 않을 때만이다(2026-10-22 검증 반영 — 人 儁·頁 顥·广 康 예시 한 글자가 같은 글쓴이의 부수표를 뒤집는 근거처럼
        # 보이던 것). 예시 글자 자신의 근거로는 예외표 literature_examples 를 거쳐 글자별 결과 basis 에 들어간다.
        ex_keys = []
        kim_table_other = n in ctx.kim_rad and ctx.kim_rad[n] != element
        for key in ("KIM-EX", "MISO"):
            vals = [v for ch, lst in sorted(ctx.lit_char.items()) for v, kk in lst
                    if kk == key and ctx.krs.get(ch) == n and ch not in skip_chars]
            if vals and all(v == element for v in vals) and not kim_table_other:
                ex_keys.append(key)
        basis += ex_keys
        if decided == "JAUI":
            basis.append("JAUI")
        basis = list(dict.fromkeys(basis))
        table[n] = {
            "radical": rc,
            "element": element,
            "status": status,
            "alt": alt,
            "alt_by": alt_by,
            "overridden": overridden,
            "basis": basis,
            "decided_by": decided,
            "rule_element": rule_el,
            "namefreq_how": nf_how,
            "votes": {k: vote_detail[k] for k in DB_KEYS if k in vote_detail},
            "kim": ctx.kim_rad.get(n),
            "_weak": weak,
            "split": [k for k in ("HN", "NC", "IO") if k in weak],
            "_low": low,
            "_lit_alt": lit_alt,
            "_ex": ex_keys,
        }
    return table


def radical_element(ctx, table, ch):
    return table[ctx.krs[ch]]["element"]


def literature_exceptions(ctx, table):
    """문헌 예외 후보(P1 조건 0): 문헌 글자값이 부수값과 다른 글자. 확정은 B-2(실무 자료 반대) 뒤 — practice_scan."""
    out = {}
    for ch in sorted(ctx.lit_char, key=ord):
        if ch in ctx.ganji:
            continue
        v = ctx.lit_value[ch]
        if v != radical_element(ctx, table, ch):
            out[ch] = (v, sorted({k for _, k in ctx.lit_char[ch]}))
    return out


# ---------------------------------------------------------------------------------------------
# --refresh: tmp 자료로 다시 집계
# ---------------------------------------------------------------------------------------------
def load_db():
    """출처 DB 의 글자별 값: {src: {char(NFKC): set(values)}}. HN 은 독음 전수(HN)와 개별 조회 표본(HN-S)을 나눈다."""
    def is_hangul(s):
        return bool(s) and all(0xAC00 <= ord(ch) <= 0xD7A3 for ch in s)

    def el(v):
        v = nfkc(v or "")
        return v if len(v) == 1 and v in EL else None

    out = {k: collections.defaultdict(set) for k in DB_KEYS}
    for name, key in DB_FILES:
        path = os.path.join(TRAD, name)
        if not os.path.exists(path):
            raise SystemExit("조사 원자료 없음: %s (tmp/radical-research — 로컬 전용. 기본 실행은 tmp 없이 돈다)" % path)
        for x in load_json(path):
            e = el(x.get("element"))
            c = nfkc(x.get("char") or "")
            if not e or len(c) != 1:
                continue
            k = key
            if key == "HN" and not is_hangul(x.get("query", "")):
                k = "HN-S"
            out[k][c].add(e)
    return out


def char_single(db, k, c):
    """글자 단위 단일값. HN 은 독음 전수 + 개별 조회를 합친 철학캠프 한 곳."""
    v = (db["HN"].get(c, set()) | db["HN-S"].get(c, set())) if k == "HN" else db[k].get(c, set())
    return next(iter(v)) if len(v) == 1 else None


def tally_votes(db, krs_all, skip):
    stats = {k: collections.defaultdict(collections.Counter) for k in DB_KEYS}
    for k in DB_KEYS:
        for c, vs in db[k].items():
            if len(vs) != 1 or c in skip:
                continue
            r = krs_all.get(c)
            if r:
                stats[k][r][next(iter(vs))] += 1
    out = {}
    for n in range(1, 215):
        row = {}
        for k in DB_KEYS:
            cnt = stats[k].get(n)
            if not cnt:
                continue
            items = counter_sorted(cnt)
            topn = items[0][1]
            row[k] = ["/".join(v for v, m in items if m == topn), topn, sum(cnt.values())]
        out[str(n)] = row
    return out


def name_freq():
    """이름 빈도 두 가지: public = 공개 이름(pa 없음 또는 pa ≤ 기준일), all = name-seo.json 에 수록된 이름 전부. combos 출현 수."""
    names = load_json(NAME_SEO)["names"]
    freq = {"public": collections.Counter(), "all": collections.Counter()}
    counts = {"public": 0, "all": 0}
    for r in names.values():
        if not r.get("combos"):
            continue
        tiers = ["all"] + (["public"] if not r.get("pa") or r["pa"] <= NAME_FREQ_REF_DATE else [])
        for t in tiers:
            counts[t] += 1
            for combo in r["combos"]:
                for ch in combo:
                    freq[t][nfkc(ch)] += 1
    return freq, counts


def tally_namefreq(ctx, db, freq, name_counts):
    out = {}
    for rc, spec in NAMEFREQ.items():
        n = ctx.ch2num[rc]
        excl = {chr(cp) for cp in spec["exclude"]}
        tiers = {t: collections.Counter() for t in NAMEFREQ_TIERS}
        counted = 0
        for c in ctx.target:
            if ctx.krs[c] != n or c in ctx.ganji or c in excl:
                continue
            if c in ctx.lit_char:
                raise SystemExit("이름 빈도 부수에 문헌 글자가 있다(규칙 미정): %s" % c)
            got = False
            for k in spec["sources"]:
                v = char_single(db, k, c)
                if v:
                    for t in NAMEFREQ_TIERS:
                        tiers[t][v] += 1 if t == "chars" else freq[t].get(c, 0)
                    got = True
            counted += got
        out[str(n)] = {
            "radical": rc,
            "exclude": ["%s %s" % (chr(cp), cp_str(chr(cp))) for cp in spec["exclude"]],
            "sources": list(spec["sources"]),
            "chars": counted,
            "names_with_combos": dict(name_counts),
            "tiers": {t: {e: tiers[t][e] for e in EL if tiers[t][e]} for t in NAMEFREQ_TIERS},
        }
    return out


def rule_echo(votes_doc, k, n, v):
    """B-1: 자료 k 가 이 글자에 준 값 v 가 그 자료 자신의 이 부수 다수값(고정본 votes, 동률 아님)과 같은가."""
    vd = votes_doc[str(n)].get(k)
    return bool(vd) and "/" not in vd[0] and vd[0] == v


def practice_count(ctx, db, votes_doc, c):
    """글자 c 의 실무 자료 단일값 집계 → (다수값, 같은 값을 준 곳 n, 값이 있는 곳 of, 그중 독립 근거 n_indep) 또는 None.

    n_indep = n 에서 부수 규칙값의 반복(PRACTICE_RULE_ECHO_SOURCES 자료의 값이 그 자료 자신의 부수 다수값과 같음, B-1)을 뺀 수.
    """
    vals = {k: char_single(db, k, c) for k in PRACTICE_SOURCES}
    got = [v for v in vals.values() if v]
    if not got:
        return None
    v, n = max(collections.Counter(got).items(), key=lambda kv: (kv[1], -EL.index(kv[0])))
    echo = sum(1 for k in PRACTICE_RULE_ECHO_SOURCES if vals.get(k) == v and rule_echo(votes_doc, k, ctx.krs[c], v))
    return v, n, len(got), n - echo


def practice_scan(ctx, db, table, votes_doc, lit_cand):
    """실무 예외 · 실무 대체값 · 확정하지 않은 문헌 예외 후보(B-2).

    글자마다 HN(+개별 조회)·NC·IO 단일값 가운데 PRACTICE_MIN_SOURCES 곳 이상이 같은 값(v, n, of, n_indep)이면:
    - 간지 글자: 간지 값이 먼저 → v 가 다르면 실무 대체값(alt, under ganji)
    - 문헌 예외 후보(문헌 값 L ≠ 부수값 D): v ≠ L 이고 반대 수가 LIT_OVERRULE_MIN_SOURCES 이상이면 확정하지 않는다(B-2).
        반대 수 = v 가 D 이면 n(LIT_OVERRULE_COUNTS_RULE_ECHO 일 때 — 부수 규칙값의 반복도 부수값 쪽 표), 아니면 n_indep.
        v = D → 부수값 + 이견(outcome radical) · v ≠ D → 반대 수가 곧 독립 근거 수라 실무 예외(outcome practice_exception).
        확정하면 v ≠ L 인 실무 값은 대체값(under literature)
    - 문헌 값이 부수값과 같은 글자: 문헌 값이 먼저 → v 가 다르면 대체값(under literature_same_as_radical)
    - 그 밖: v ≠ D 이고 n_indep ≥ PRACTICE_MIN_SOURCES 면 실무 예외, n_indep 가 모자라면 대체값(under rule_echo — B-1)
    """
    prac, alt, over = {}, {}, {}
    for c in ctx.target:
        pc = practice_count(ctx, db, votes_doc, c)
        if not pc or pc[1] < PRACTICE_MIN_SOURCES:
            continue
        v, n, of, n_indep = pc
        rec = {"cp": cp_str(c), "e": v, "n": n, "of": of, "n_indep": n_indep}
        r = ctx.krs[c]
        re_ = radical_element(ctx, table, c)
        if c in ctx.ganji:
            if v != ctx.ganji[c][0]:
                alt[c] = dict(rec, under="ganji")
            continue
        if c in lit_cand:
            lit_e = ctx.lit_value[c]
            if v == lit_e:
                continue
            n_opp = n if (v == re_ and LIT_OVERRULE_COUNTS_RULE_ECHO) else n_indep
            if n_opp < LIT_OVERRULE_MIN_SOURCES:
                alt[c] = dict(rec, under="literature")
                continue
            outcome = "radical" if v == re_ else "practice_exception"
            over[c] = dict(rec, lit_e=lit_e, lit_basis=sorted({k for _, k in ctx.lit_char[c]}), n_opp=n_opp,
                           radical=r, radical_element=re_, outcome=outcome)
            if outcome == "practice_exception":
                if n_indep < PRACTICE_MIN_SOURCES:
                    raise SystemExit("B-2 반대 수와 독립 근거 수가 어긋난다: %s" % c)
                prac[c] = dict(rec, radical=r, radical_element=re_, via="literature_overruled")
            continue
        if c in ctx.lit_char:
            if v != ctx.lit_value[c]:
                alt[c] = dict(rec, under="literature_same_as_radical")
            continue
        if v == re_:
            continue
        if n_indep >= PRACTICE_MIN_SOURCES:
            prac[c] = dict(rec, radical=r, radical_element=re_)
        else:
            alt[c] = dict(rec, under="rule_echo", radical=r, radical_element=re_)
    return prac, alt, over


def refresh(ctx):
    for p in (UNIHAN, UNIHAN_ZIP, NAME_SEO) + tuple(os.path.join(TRAD, f) for f, _ in DB_FILES):
        if not os.path.exists(p):
            raise SystemExit("--refresh 입력 없음: %s (tmp 는 로컬 전용 — 기본 실행은 tmp 없이 돈다)" % p)
    krs_all, _, _ = kangxi_radical_order.kangxi_radicals(UNIHAN, UNIHAN_ZIP)
    bad = [c for c in ctx.target if krs_all.get(c) != ctx.krs[c]]
    if bad:
        raise SystemExit("Unihan 판정과 hanja_radicals.json 판정이 다르다(extract_hanja_radicals.py 를 다시 돌릴 것): %s"
                         % " ".join(bad[:20]))
    db = load_db()
    freq, name_counts = name_freq()
    namefreq = tally_namefreq(ctx, db, freq, name_counts)

    # 1차: 간지만 빼고 부수값을 정한다 → 문헌 예외를 고른다 → 2차: 문헌 예외도 빼고 다시 센다(S1 과 같은 두 단계).
    # 실무 예외 글자는 집계에서 빼지 않는다 — 부수 기본값을 바탕으로 고르는 예외라, 빼면 부수값이 바뀌고 예외가 다시 바뀌는
    # 순환이 생긴다(2026-10-22 시험: 亅(事)·爪(爲)가 金↔木 으로 끝없이 진동). 부수 기본값은 간지·문헌 예외만 뺀 집계로 정한다.
    # B-2 로 확정하지 않은 문헌 예외 후보도 집계에서는 뺀 채 둔다(집계 정의 고정 — 부수값·판정·집계의 순환 방지).
    skip1 = set(ctx.ganji)
    votes1 = tally_votes(db, krs_all, skip1)
    table1 = build_table(ctx, votes1, namefreq, skip1)
    lit_cand = literature_exceptions(ctx, table1)
    skip = skip1 | set(lit_cand)
    votes = tally_votes(db, krs_all, skip)
    table = build_table(ctx, votes, namefreq, skip)
    if literature_exceptions(ctx, table) != lit_cand:
        raise SystemExit("2차 집계에서 문헌 예외 후보가 바뀐다 — 사람 확인 필요: %s → %s" % (
            " ".join(lit_cand), " ".join(literature_exceptions(ctx, table))))
    prac, prac_alt, overruled = practice_scan(ctx, db, table, votes, lit_cand)
    # 부수 basis 의 문헌 예시 판정(KIM-EX·MISO)은 확정한 문헌 예외만 빼고 본다 — 확정하지 않은 후보(B-2)는 그 부수의 반대 예시다.
    # 부수값(element)은 집계로만 정해지므로 바뀌지 않아야 한다
    table_final = build_table(ctx, votes, namefreq, skip1 | (set(lit_cand) - set(overruled)))
    if any(table_final[n]["element"] != table[n]["element"] for n in range(1, 215)):
        raise SystemExit("문헌 예시 판정 범위를 바꿨더니 부수값이 바뀌었다(있으면 안 되는 일)")

    if len(prac) > PRACTICE_MAX:
        print("[중단] 실무 예외 %d자 > 상한 %d자 — 반영하지 않는다(아무 파일도 쓰지 않음)" % (len(prac), PRACTICE_MAX))
        for c, p in sorted(prac.items(), key=lambda kv: ord(kv[0])):
            print("  %s %s 부수 %s %s → %s (%d/%d곳)" % (c, p["cp"], ctx.num2ch[p["radical"]], p["radical_element"], p["e"],
                                                   p["n"], p["of"]))
        raise SystemExit(2)
    # 이름 빈도 부수에서 뺀 글자(京·亨·亢)는 실무 예외가 되어야 한다(사용자 지시의 전제)
    for rc, spec in NAMEFREQ.items():
        for cp in spec["exclude"]:
            if chr(cp) not in prac:
                raise SystemExit("이름 빈도 집계에서 뺀 %s 가 실무 예외가 아니다 — 亠 규칙 전제가 깨졌다" % chr(cp))

    inputs = {
        "unihan": {"path": rel(UNIHAN), "sha256": sha256(UNIHAN)},
        "unihan_zip": {"path": rel(UNIHAN_ZIP) + " (Unihan_DictionaryIndices.txt kKangXi)", "sha256": sha256(UNIHAN_ZIP)},
        "name_seo": {"path": rel(NAME_SEO), "sha256": sha256(NAME_SEO),
                     "use": "이름 빈도(亠) — 공개 기준일 %s · 전체 수록 이름" % NAME_FREQ_REF_DATE},
    }
    for name, _ in DB_FILES:
        inputs[name] = {"path": rel(os.path.join(TRAD, name)), "sha256": sha256(os.path.join(TRAD, name))}

    doc = {
        "meta": {
            "title": "부수 기준 자원오행 — 실무 자료 부수 집계·실무 예외 고정본",
            "generated_by": "scripts/build_radical_resource_table.py --refresh --freeze (tmp 자료가 있을 때만)",
            "why": "수집 원자료(tmp/radical-research)·Unihan(tmp/unihan-18.0)은 커밋하지 않는다. 기본 실행은 이 파일만 읽어 "
                   "같은 부수표·예외표를 낸다. --refresh 는 다시 집계해 이 파일과 비교한다",
            "contains": "부수별 집계 수치(votes·votes_ganji_only·namefreq)와 반영한 실무 예외·실무 대체값·확정하지 않은 문헌 예외 후보"
                        "(값·같은 값을 준 곳 수 n·값이 있는 곳 수 of·그중 독립 근거 수 n_indep)만. 수집한 글자별 값 전체와 어느 자료가 "
                        "어떤 값을 줬는지는 싣지 않는다",
            "fields": {
                "votes": "부수 번호 → 출처별 [다수값(동률이면 '木/火'), 다수값 글자 수, 그 부수 글자 수]. 간지·문헌 예외 후보 글자를 뺀 "
                         "2차 집계(B-2 로 확정하지 않은 후보도 뺀다). 실무 예외 글자는 빼지 않는다(빼면 부수값과 예외가 서로를 바꾸는 "
                         "순환이 생긴다) — 부수표(radical_resource_element.json) votes 와 같다. B-1 의 '자료 자신의 부수 다수값'도 이 값이다",
                "votes_ganji_only": "간지만 뺀 1차 집계 — 계획 승인값과 규칙 재계산을 비교할 때만 쓴다(부수표 note·recompute_discrepancies)",
                "namefreq": "이름 빈도 가중 다수로 정하는 부수(P2 — 亠). tiers = 글자마다 sources 단일값에 더한 합 — public = 공개 이름"
                            "(기준일 %s) combos 출현 수, all = name-seo.json 수록 이름 전부의 combos 출현 수, chars = 글자 수. "
                            "rules.namefreq_tiers 순으로 합이 0 이 아닌 첫 단계로 정한다. names_with_combos = 단계별 이름 수, "
                            "exclude = 실무 예외로 따로 처리되는 글자" % NAME_FREQ_REF_DATE,
                "practice_exceptions": "실무 예외 — %s 가운데 n곳(≥%d)이 같은 값 e 를 줬고, 그중 독립 근거 n_indep(≥%d — B-1: %s 의 값이 "
                                       "그 자료 자신의 부수 다수값과 같으면 빼고 센다)이며, e 가 부수 기본값(radical_element)과 다르다. "
                                       "of = 단일값이 있는 곳 수. via literature_overruled = B-2 로 확정하지 않은 문헌 예외 후보가 실무 예외가 된 것"
                                       % ("·".join(PRACTICE_SOURCES), PRACTICE_MIN_SOURCES, PRACTICE_MIN_SOURCES,
                                          "·".join(PRACTICE_RULE_ECHO_SOURCES)),
                "practice_alt": "실무 자료 n곳(≥%d)이 글자 값과 다른 같은 값 e 를 줬지만 예외로 두지 않은 것 — 글자 대체값(alt_char, PRACTICE)"
                                "으로만 쓴다(P7). under = 예외로 두지 않은 이유: ganji(간지 값이 먼저) · literature(확정한 문헌 예외 — "
                                "반대가 B-2 기준에 못 미침) · literature_same_as_radical(문헌 값이 부수값과 같아 문헌이 먼저) · "
                                "rule_echo(독립 근거 n_indep 가 %d곳 미만 — B-1, 값은 부수 기본값 + 이견)" % (PRACTICE_MIN_SOURCES, PRACTICE_MIN_SOURCES),
                "literature_overruled": "B-2 — 문헌 예외 후보(문헌 값 lit_e ≠ 부수값)에 실무 자료가 다른 같은 값 e 로 반대해(반대 수 n_opp ≥ %d) "
                                        "확정하지 않은 글자. outcome radical = e 가 부수 기본값이라 부수값 + 이견(문헌 값은 alt_char), "
                                        "practice_exception = e 가 부수값이 아니고 독립 근거가 %d곳 이상이라 실무 예외(practice_exceptions 에도 있다)"
                                        % (LIT_OVERRULE_MIN_SOURCES, PRACTICE_MIN_SOURCES),
                "radical_elements": "이 집계로 정한 부수 기본값 — 기본 실행이 같은 값을 내는지 확인한다(다르면 실무 예외를 다시 뽑아야 한다)",
                "literature_candidates": "이 집계에서 뺀 문헌 예외 후보(P1 조건 0 — 문헌 값이 부수값과 다른 글자). 확정 여부는 "
                                         "literature_overruled(B-2) — 기본 실행이 같은 목록을 내는지 확인한다",
            },
            "rules": rules_fingerprint(),
            "counts": {"practice_exceptions": len(prac), "practice_alt": len(prac_alt),
                       "practice_alt_by_under": dict(sorted(collections.Counter(p["under"] for p in prac_alt.values()).items())),
                       "literature_candidates": len(lit_cand), "literature_overruled": len(overruled),
                       "literature_exceptions": len(lit_cand) - len(overruled)},
            "inputs": inputs,
        },
        "votes": votes,
        "votes_ganji_only": votes1,
        "namefreq": namefreq,
        "practice_exceptions": {c: prac[c] for c in sorted(prac, key=ord)},
        "practice_alt": {c: prac_alt[c] for c in sorted(prac_alt, key=ord)},
        "literature_overruled": {c: overruled[c] for c in sorted(overruled, key=ord)},
        "radical_elements": {str(n): table_final[n]["element"] for n in range(1, 215)},
        "literature_candidates": ["%s %s" % (c, cp_str(c)) for c in sorted(lit_cand, key=ord)],
    }
    return json.loads(json.dumps(doc, ensure_ascii=False))  # 디스크에서 읽은 고정본과 같은 꼴(목록·정수)로 비교


def diff_frozen(old, new):
    """고정본 차이를 사람이 읽을 줄로."""
    out = []
    for k in ("rules", "inputs"):
        if old["meta"].get(k) != new["meta"].get(k):
            if k == "inputs":
                for name in sorted(set(old["meta"]["inputs"]) | set(new["meta"]["inputs"])):
                    a, b = old["meta"]["inputs"].get(name, {}), new["meta"]["inputs"].get(name, {})
                    if a.get("sha256") != b.get("sha256"):
                        out.append("입력 %s sha256 %s → %s" % (name, (a.get("sha256") or "-")[:12], (b.get("sha256") or "-")[:12]))
            else:
                a, b = old["meta"].get(k) or {}, new["meta"].get(k) or {}
                for name in sorted(set(a) | set(b)):
                    if a.get(name) != b.get(name):
                        out.append("규칙 상수 %s 가 다르다: %s → %s" % (name, a.get(name, "-"), b.get(name, "-")))
    for sec in ("votes", "votes_ganji_only", "namefreq"):
        for n in sorted(set(old.get(sec, {})) | set(new.get(sec, {})), key=int):
            a, b = old.get(sec, {}).get(n), new.get(sec, {}).get(n)
            if a != b:
                out.append("%s 부수 %s: %s → %s" % (sec, n, a, b))
    for sec in ("practice_exceptions", "practice_alt", "literature_overruled"):
        a, b = old.get(sec, {}), new.get(sec, {})
        for c in sorted(set(a) | set(b), key=ord):
            if a.get(c) != b.get(c):
                out.append("%s %s: %s → %s" % (sec, c, a.get(c), b.get(c)))
    for sec in ("radical_elements", "literature_candidates"):
        if old.get(sec) != new.get(sec):
            out.append("%s 가 다르다" % sec)
    for sec in sorted(set(old) ^ set(new)):
        out.append("절 %s 가 %s" % (sec, "생겼다" if sec in new else "없어졌다"))
    if not out and old != new:
        out.append("meta 의 다른 항목이 다르다")
    return out


# ---------------------------------------------------------------------------------------------
# 고정본 → 부수표·예외표
# ---------------------------------------------------------------------------------------------
def build_outputs(ctx, frozen):
    if frozen["meta"]["rules"] != rules_fingerprint():
        raise SystemExit("고정본(%s)이 지금 스크립트와 다른 규칙 상수로 집계됐다 — tmp 가 있으면 --refresh --freeze" % rel(FROZEN))
    votes_doc, votes1, namefreq = frozen["votes"], frozen["votes_ganji_only"], frozen["namefreq"]
    practice = frozen["practice_exceptions"]
    practice_alt = frozen["practice_alt"]
    overruled = frozen["literature_overruled"]
    lit_cand_frozen = [x.split(" ")[0] for x in frozen["literature_candidates"]]

    skip1 = set(ctx.ganji)
    table1 = build_table(ctx, votes1, namefreq, skip1)
    # 집계(votes)는 간지·문헌 예외 후보를 뺀 것(refresh 와 같은 정의). 부수 basis 의 문헌 예시 판정만 확정한 문헌 예외를 뺀다
    table = build_table(ctx, votes_doc, namefreq, skip1 | (set(lit_cand_frozen) - set(overruled)))
    lit_cand = literature_exceptions(ctx, table)
    if sorted(lit_cand, key=ord) != lit_cand_frozen:
        raise SystemExit("문헌 예외 후보가 고정본과 다르다 — tmp 가 있으면 --refresh --freeze")
    if {str(n): table[n]["element"] for n in range(1, 215)} != frozen["radical_elements"]:
        raise SystemExit("부수 기본값이 고정본과 다르다(결정 상수가 바뀌었나?) — 실무 예외를 다시 뽑아야 한다: --refresh --freeze")
    for c, o in overruled.items():  # B-2
        if c not in lit_cand or o["cp"] != cp_str(c) or o["lit_e"] != ctx.lit_value[c] or o["e"] == o["lit_e"]:
            raise SystemExit("고정본 B-2 글자가 문헌 예외 후보 규칙 밖: %s" % c)
        if o["radical"] != ctx.krs[c] or o["radical_element"] != radical_element(ctx, table, c):
            raise SystemExit("고정본 B-2 글자가 지금 부수표와 맞지 않는다: %s" % c)
        if o["n_opp"] < LIT_OVERRULE_MIN_SOURCES or o["n_opp"] != (
                o["n"] if (o["e"] == o["radical_element"] and LIT_OVERRULE_COUNTS_RULE_ECHO) else o["n_indep"]):
            raise SystemExit("고정본 B-2 반대 수가 규칙 밖: %s" % c)
        if o["outcome"] != ("radical" if o["e"] == o["radical_element"] else "practice_exception"):
            raise SystemExit("고정본 B-2 결과가 규칙 밖: %s" % c)
        if (o["outcome"] == "practice_exception") != (c in practice):
            raise SystemExit("고정본 B-2 결과와 실무 예외가 어긋난다: %s" % c)
    lit_exc = {c: v for c, v in lit_cand.items() if c not in overruled}  # 확정한 문헌 예외
    for c, p in practice.items():
        if c not in ctx.tset or c in ctx.ganji or p["cp"] != cp_str(c):
            raise SystemExit("고정본 실무 예외 글자가 규칙 밖: %s" % c)
        if c in ctx.lit_char and not (overruled.get(c, {}).get("outcome") == "practice_exception"
                                      and p.get("via") == "literature_overruled"):
            raise SystemExit("고정본 실무 예외가 문헌 글자다(B-2 경로가 아님): %s" % c)
        if p["radical"] != ctx.krs[c] or p["radical_element"] != radical_element(ctx, table, c) or p["e"] == p["radical_element"]:
            raise SystemExit("고정본 실무 예외가 지금 부수표와 맞지 않는다: %s" % c)
        if not PRACTICE_MIN_SOURCES <= p["n_indep"] <= p["n"] <= p["of"]:
            raise SystemExit("고정본 실무 예외 출처 수가 규칙 밖(독립 근거 B-1): %s" % c)
    if len(practice) > PRACTICE_MAX:
        raise SystemExit("실무 예외 %d자 > 상한 %d자" % (len(practice), PRACTICE_MAX))
    for c, p in practice_alt.items():
        u = p["under"]
        if not p["n_indep"] <= p["n"] <= p["of"] or p["n"] < PRACTICE_MIN_SOURCES:
            raise SystemExit("고정본 실무 대체값 출처 수가 규칙 밖: %s" % c)
        if u == "ganji":
            ok = c in ctx.ganji and p["e"] != ctx.ganji[c][0]
        elif u == "literature":
            ok = c in lit_exc and p["e"] != ctx.lit_value[c]
        elif u == "literature_same_as_radical":
            ok = c in ctx.lit_char and c not in lit_cand and p["e"] != ctx.lit_value[c]
        elif u == "rule_echo":
            ok = (c not in ctx.ganji and c not in ctx.lit_char and p["n_indep"] < PRACTICE_MIN_SOURCES
                  and p["radical"] == ctx.krs[c] and p["radical_element"] == radical_element(ctx, table, c)
                  and p["e"] != p["radical_element"])
        else:
            ok = False
        if not ok:
            raise SystemExit("고정본 실무 대체값이 규칙 밖: %s %s" % (c, u))
    for n in range(1, 215):
        if table[n]["element"] != table1[n]["element"] or table[n]["status"] != table1[n]["status"]:
            print("문헌 예외를 빼고 다시 센 뒤 바뀐 부수: %s %s/%s → %s/%s" % (
                ctx.num2ch[n], table1[n]["element"], table1[n]["status"], table[n]["element"], table[n]["status"]))
    for ch, (v, _) in lit_exc.items():
        if radical_element(ctx, table, ch) == v:
            raise SystemExit("문헌 예외가 부수값과 같아짐: %s" % ch)

    # ---- note 문장
    def votes_text(t):
        parts = []
        if t["kim"]:
            parts.append("김만태 표 %s" % t["kim"])
        for k in ("HN", "NC", "IO"):
            if k in t["votes"]:
                top, topn, tot = t["votes"][k]
                parts.append("%s %s %d/%d" % (DB_NAME[k], top, topn, tot))
        if "HN-S" in t["votes"]:
            top, topn, tot = t["votes"]["HN-S"]
            parts.append("철학캠프 개별조회 %s %d/%d" % (top, topn, tot))
        return " · ".join(parts) if parts else "자료 없음"

    def nf_text(n):
        nf = namefreq[str(n)]
        excl = "·".join(x.split(" ")[0] for x in nf["exclude"])
        srcs = "·".join(DB_NAME[k] for k in nf["sources"])
        fmt = lambda d: " · ".join("%s %d" % (e, d[e]) for e in EL if d.get(e)) or "0"
        names = nf["names_with_combos"]
        label = {"public": "공개 이름 %d명(기준일 %s) 조합 가중 합" % (names["public"], NAME_FREQ_REF_DATE),
                 "all": "전체 수록 이름 %d명(공개 전 포함) 조합 가중 합" % names["all"],
                 "chars": "같은 출처의 글자 수"}
        _, used = namefreq_element(nf)
        steps = []
        for t in NAMEFREQ_TIERS:
            steps.append("%s %s" % (label[t], fmt(nf["tiers"][t])))
            if t == used:
                break
        rest = [label[t] + " " + fmt(nf["tiers"][t]) for t in NAMEFREQ_TIERS[NAMEFREQ_TIERS.index(used) + 1:]]
        return ("P2(2026-10-22): 이름 빈도 가중 다수 — 실무 예외로 따로 처리되는 글자(%s)를 빼고 나머지 글자 %d자의 %s 글자값을 "
                "글자의 이름 빈도(combos 출현 수)로 가중(이오름은 이 부수 글자 모두에 같은 규칙값을 줘서 뺌). %s → %s%s"
                % (excl, nf["chars"], srcs, " → ".join(steps), table[n]["element"],
                   (" (참고: %s)" % " · ".join(rest)) if rest else ""))

    by_rad_practice = collections.defaultdict(list)
    for c in sorted(practice, key=ord):
        by_rad_practice[practice[c]["radical"]].append(c)

    def practice_clause(n, text):
        """note 의 {practice} 를 이 부수의 실무 예외(값·같은 값을 준 곳 수)로 바꾼다 — 없으면 멈춘다(손으로 적은 문장이 낡음)."""
        if "{practice}" not in text:
            return text
        cs = by_rad_practice.get(n)
        if not cs:
            raise SystemExit("note 가 실무 예외를 가리키는데 부수 %s 에 실무 예외가 없다" % ctx.num2ch[n])
        items = " · ".join("%s %s(%d)" % (c, practice[c]["e"], practice[c]["n"]) for c in cs)
        return text.replace("{practice}", "실무 예외 %d자: %s(괄호 = 같은 값을 준 실무 자료 수)" % (len(cs), items))

    out_rad = {}
    counts = collections.Counter()
    discrepancies = []
    unsupported = []
    for n in range(1, 215):
        t = table[n]
        rc = t["radical"]
        notes = []
        st = t["status"]
        if st == "agreed":
            notes.append("합의: " + votes_text(t))
        elif st == "single":
            notes.append("단일 출처(자료 적음): " + votes_text(t))
        elif st == "unknown":
            notes.append("출처 없음: " + JAUI[rc][1] + " — 사람 검수 필요")
        else:
            why = []
            if t["decided_by"] == "D2":
                why.append("계획 §2-2 이견 부수 — D2 권고안 %s" % t["element"])
            if t["_weak"]:
                why.append("글자별 갈림(다수값 비율 낮음: %s)" % ", ".join(
                    "%s %d/%d" % (DB_NAME[k], t["votes"][k][1], t["votes"][k][2]) for k in t["_weak"]))
            if t["_lit_alt"]:
                why.extend(x[2] for x in t["_lit_alt"])
            notes.append("이견: " + votes_text(t) + (" → " + "; ".join(why) if why else ""))
        if t["decided_by"] == "P2":
            notes.append(practice_clause(n, P2_VALUES[rc][1]))
        if t["decided_by"] == "P2-namefreq":
            notes.append(nf_text(n))
        if rc in P5_AGREED:
            notes.append("P5(2026-10-22) 합의로 침: 실무 자료 세 곳의 부수 다수값이 모두 %s이고 김만태 표만 반대(%s = %s) — "
                         "%s. 값은 실무 자료 다수만으로 선다(계획 D2 이견 부수였음)"
                         % (t["element"], rc, t["overridden"][0]["e"], P5_AGREED[rc]))
        # 승인값과 재계산이 다른가 — 간지만 뺀 1차·예외까지 뺀 최종 계산이 모두 다를 때만 (小는 尙을 빼면 자료가 2자로 줄어 갈린다)
        if (t["decided_by"] in ("D2", "D2-single", "P2", "P2-namefreq") and t["rule_element"]
                and t["rule_element"] != t["element"] and table1[n]["rule_element"] != t["element"]):
            msg = ("kRSUnicode 부수로 다시 세면 규칙상 %s — %s(%s) 유지%s"
                   % (t["rule_element"], "계획 승인값" if t["decided_by"].startswith("D2") else "사용자 결정값", t["element"],
                      ", 재검토 후보" if t["decided_by"].startswith("D2") else ""))
            notes.append(msg)
            discrepancies.append({"num": n, "radical": rc, "approved": t["element"], "decided_by": t["decided_by"],
                                  "recomputed": t["rule_element"], "votes": votes_text(t)})
        if t["decided_by"] == "D2-single":
            notes.append("계획 §2-2 단일 출처 부수 — 그 값을 쓴다(D2)")
        if t["_ex"]:
            notes.append("문헌 예시 글자와 일치(%s)" % "·".join(t["_ex"]))
        if rc in RAD_LIT_NOTE:
            notes.append(practice_clause(n, RAD_LIT_NOTE[rc]))
        if t["kim"] is None and st != "unknown" and not any(k in t["votes"] for k in ("HN", "NC")):
            notes.append("문헌 표에 없는 부수 — 실무 자료만으로 정함")
        if t["decided_by"] in ("D2", "D2-single", "P2", "P2-namefreq") and t["basis"] == ["UNIHAN"]:
            notes.append("승인값 %s — 지지하는 부수 표·문헌이 없다%s · 사용자 재확인 대상" % (
                t["element"], "(철학캠프 개별조회 표본만 같은 값)" if t["votes"].get("HN-S", [None])[0] == t["element"] else ""))
            unsupported.append(rc)
        counts[st] += 1
        row = {
            "radical": rc,
            "element": t["element"],
            "status": st,
            "alt": t["alt"],
            "alt_by": t["alt_by"],
        }
        if t["overridden"]:
            row["overridden"] = t["overridden"]
        row.update({
            "basis": t["basis"],
            "decided_by": t["decided_by"],
            "split": t["split"],
            "votes": ({"KIM": t["kim"]} if t["kim"] else {}) | t["votes"],
            "chars": ctx.tcount.get(n, 0),
            "note": " / ".join(notes),
        })
        out_rad[str(n)] = row

    inputs = {
        "frozen": {"path": rel(FROZEN), "sha256": sha256(FROZEN)},
        "hanja_radicals": {"path": rel(HANJA_RAD), "sha256": sha256(HANJA_RAD)},
        "hanja_seo": {"path": rel(SEO), "sha256": sha256(SEO)},
        "frozen_from": {k: {"path": v["path"], "sha256": v["sha256"]} for k, v in frozen["meta"]["inputs"].items()},
    }

    table_doc = {
        "meta": {
            "title": "부수 기준 자원오행 — 214부수표",
            "plan": "docs/plan-radical-ohaeng-2026-10.md §2-1·§2-2 (단계 S1)",
            "generated_by": "scripts/build_radical_resource_table.py (인자 없음, 결정적 — 고정본 %s 에서 만든다. tmp 불필요)" % rel(FROZEN),
            "key": "강희 부수 번호(kRSUnicode 첫 값의 정수부, 1~214 — 첫 값이 강희자전 배열과 어긋나는 글자는 kRSUnicode 다른 값·원 코드 차트 배열 부수 중 kKangXi 쪽수에 맞는 값, meta.krs_kangxi_adjusted · scripts/kangxi_radical_order.py · data/hanja_radicals.json kangxi). 변형 부수(氵·忄·扌·亻·犭·礻·衤·⺼·⺮·艹·辶·阝·王·刂·灬·攵)는 원형과 같은 번호·같은 값",
            "fields": {
                "radical": "부수의 통합 한자 꼴(Kangxi Radicals 블록의 NFKC)",
                "element": "부수 기본 자원오행 — 간지·문헌·실무 예외가 없는 글자는 이 값을 쓴다",
                "status": "agreed | disputed | single | unknown (아래 status_rule)",
                "alt": "다른 출처·문헌이 이 **부수**에 준 값(木火土金水 순). 부수 단위 이견이다 — 화면 문구는 '이 부수(X)를 Y로 보는 자료도 있습니다'. 글자 단위 견해로 쓰지 말 것(글자 단위 이견은 hanja_resource_element.json alt_char)",
                "alt_by": "alt 값마다 낸 출처와 수준: level table(김만태 부수표) · majority(DB 다수값 2/3 이상, n≥3) · split(DB 다수값이나 2/3 미만, n≥3) · few(DB 자료 3자 미만 — n·of 를 보고 화면에 낼지 고른다) · text(김만태 본문). 모두 부수 단위다",
                "overridden": "사용자 결정으로 이견에서 뺀 출처 값(P5 — 김만태 표 한 칸). alt 에는 없다",
                "basis": "element 를 지지하는 출처 키(sources). UNIHAN 은 글자→부수 판정 근거. KIM = 김만태 부수표. HN·NC·IO = 그 DB 가 "
                         "이 부수 글자들에 준 다수값(부수 단위 집계)이 element 와 같다는 뜻 — 이 부수의 어느 한 글자에 그 값을 줬다는 뜻이 아니다. "
                         "KIM-EX·MISO = 이 부수의 문헌 예시 글자(확정한 문헌 예외 글자 제외 — B-2 로 확정하지 않은 후보는 반대 예시로 센다)가 모두 "
                         "element 와 같고 김만태 부수표가 이 부수에 다른 값을 주지 않았다"
                         "(예시는 글자 단위 값이다). [UNIHAN] 뿐이면 그 값을 지지하는 표·문헌이 없다(note 참고)",
                "decided_by": "D2 = 계획 이견 부수 권고안(승인) · D2-single = 계획 단일 출처 부수 · P2 = 사용자 결정 값(弓) · P2-namefreq = 이름 빈도 가중 다수(亠 — 쓴 가중 단계는 note) · rule = 아래 vote_rule 계산 · JAUI = 자의 추정",
                "split": "부수 다수값과 별개로 글자별로 값이 갈리는 DB(다수값 비율 2/3 미만 또는 과반 없음). 비어 있지 않으면 '이견' — 화면은 '이 부수 글자는 뜻에 따라 다르게 보기도 합니다' 류",
                "votes": "출처별 부수 집계. KIM = 김만태 표 값, 그 밖은 [다수값, 다수값 글자 수, 그 부수 글자 수](간지·문헌 예외 후보 글자 제외 — B-2 로 확정하지 않은 후보도 제외, 실무 예외 글자는 포함, key 와 같은 부수 판정 — 고정본 votes)",
                "chars": "대상 9,190자(hanja-seo.json)를 NFKC 로 묶은 %d자(호환 한자 85자는 통합 한자에 붙음) 가운데 이 부수 글자 수" % len(ctx.target),
                "note": "결정 근거",
            },
            "vote_rule": [
                "1표 = 김만태 부수표에 실린 값, 또는 DB(HN·NC·IO) 하나가 그 부수 글자 %d자 이상에서 과반으로 준 다수값" % VOTE_MIN_N,
                "부수값 = 표의 다수결. 동률이면 HN → NC → KIM → IO 순(옥편 계열 우선, D2)",
                "표가 하나도 없으면 IO → HN → NC 의 적은 자료 값, 그래도 없으면 자의 추정(JAUI)",
                "계획 §2-2 에서 승인된 이견 부수 35개와 단일 출처 부수 14개는 승인값을 쓴다(재계산이 다르면 note 에 남김). 弓 은 P2 값 木, 亠 는 P2 이름 빈도 가중 다수",
                "집계에서는 간지 글자를 빼고(1차) 문헌 예외 후보 글자도 뺀다(2차 — B-2 로 확정하지 않은 후보도 뺀 채 둔다). 실무 예외 글자는 빼지 않는다 — 부수 기본값을 바탕으로 고르는 예외라 빼면 부수값과 예외가 서로를 바꾸는 순환이 생긴다(亅·爪 에서 진동 확인)",
                "철학캠프 개별 조회 118자(HN-S)는 예외를 확인하려고 골라 뽑은 표본이라 표를 주지 않는다",
            ],
            "status_rule": {
                "agreed": "표가 2개 이상이고 모두 같으며, 표를 낸 DB 마다 다수값 비율이 2/3 이상. P5(人·广·頁·彡)는 김만태 표 한 칸의 반대를 이견으로 치지 않는다(overridden)",
                "disputed": "표가 갈리거나, D2·P2 부수이거나, 문헌이 다른 배속을 적었거나(KIM-TXT), 적은 자료(n<3)라도 다른 값을 준 DB 가 있거나, DB 안에서 글자별로 갈린다(split)",
                "single": "표가 하나뿐이거나 적은 자료만 있다(자료 적음)",
                "unknown": "어느 출처에도 자료가 없어 자의로 추정했다(사람 검수 필요). 값은 채운다(D3)",
            },
            "grade_hint": "계획 §2-4: agreed → R(확정) 후보, disputed·single·unknown → V(이견 있음). 간지·문헌 예외·실무 예외 글자는 X(실무 예외는 독립 근거 2곳 이상 — B-1, 문헌 예외는 실무 자료 반대가 없을 때 — B-2). 등급 확정은 S1 결과 파일 빌드(build_resource_element)의 일",
            "sources": SOURCES,
            "excluded_sources": EXCLUDED_SOURCES,
            "decisions": DECISIONS,
            "pending_decisions": PENDING_DECISIONS,
            "counts": {k: counts[k] for k in ("agreed", "disputed", "single", "unknown")},
            "recompute_discrepancies": discrepancies,
            "approved_without_support": unsupported,
            "krs_kangxi_adjusted": {
                c: {"cp": cp_str(c), "krs_first": m["krs_first"], "used": m["used"], "kangxi_page": m["kangxi_page"],
                    "basis": m["basis"], "radicals": "%s → %s" % (ctx.num2ch[m["krs_first"]], ctx.num2ch[m["used"]])}
                for c, m in sorted(ctx.moved.items())
            },
            "inputs": inputs,
        },
        "radicals": out_rad,
    }

    # ---- 예외표
    lit_dispute = collections.defaultdict(list)  # char -> [(alts, src, text)]
    for cp, alts, src, text in CHAR_LIT_DISPUTE:
        lit_dispute[chr(cp)].append((alts, src, text))

    def practice_alt_entry(ch):
        p = practice_alt.get(ch)
        return [{"e": p["e"], "basis": ["PRACTICE"], "n": p["n"], "of": p["of"], "n_indep": p["n_indep"]}] if p else []

    def lit_alt_entry(ch):
        """B-2 로 확정하지 않은 문헌 예외 후보의 문헌 값 — 글자 대체값(문헌 출처)."""
        o = overruled[ch]
        return [{"e": o["lit_e"], "basis": list(o["lit_basis"])}]

    def echo_clause(n, n_indep):
        if n_indep >= n:
            return ""
        return " (그중 %d곳은 그 자료 자신의 부수 다수값과 같은 값 — 부수 규칙값의 반복이라 독립 근거는 %d곳, B-1)" % (n - n_indep, n_indep)

    exc = {}
    for cp, e, label in GANJI:
        ch = chr(cp)
        if ch not in ctx.tset:
            continue  # 인명용이 아닌 간지(현재 0자)
        r = ctx.krs[ch]
        re_ = table[r]["element"]
        # 간지 규칙 자체의 근거는 전통 배속(GANJI)뿐이다. 문헌 예시가 같은 값을 실었으면 함께 적는다(甲 = 미소 예시 木)
        basis = ["GANJI"]
        if any(k == "MISO" and v == e for v, k in ctx.lit_char.get(ch, [])):
            basis.append("MISO")
        if any(k == "KIM-EX" and v == e for v, k in ctx.lit_char.get(ch, [])):
            basis.append("KIM-EX")
        same = (re_ == e)
        note = "%s = %s — 간지 오행을 부수보다 먼저 쓴다. " % (label, e)
        note += ("부수값 %s(%s)도 같음" % (ctx.num2ch[r], re_)) if same else ("부수값 %s(%s)" % (ctx.num2ch[r], re_))
        exc[ch] = {
            "cp": cp_str(ch), "element": e, "kind": "ganji", "radical": r, "radical_element": re_,
            "same_as_radical": same, "basis": basis, "note": note,
        }
        if practice_alt_entry(ch):
            exc[ch]["alt_char"] = practice_alt_entry(ch)
    for ch, (v, srcs) in sorted(lit_exc.items()):
        r = ctx.krs[ch]
        exc[ch] = {
            "cp": cp_str(ch), "element": v, "kind": "literature", "radical": r,
            "radical_element": table[r]["element"], "same_as_radical": False,
            "basis": srcs,
            "note": "%s %s=%s, 부수값 %s(%s) → 문헌 예외(실무 자료 지지 조건 없이 문헌만으로 — P1. 실무 자료 %d곳 이상의 반대 없음 — B-2)"
                    % ("·".join(SRC_NAME[s] for s in srcs), ch, v, ctx.num2ch[r], table[r]["element"], LIT_OVERRULE_MIN_SOURCES),
        }
        if practice_alt_entry(ch):
            exc[ch]["alt_char"] = practice_alt_entry(ch)
    for ch in sorted(practice, key=ord):
        p = practice[ch]
        r = ctx.krs[ch]
        e = p["e"]
        basis = ["PRACTICE"]
        alt_char = []
        lit_txt = []
        for alts, src, text in lit_dispute.get(ch, []):
            if e in alts:
                basis.append(src)
            alt_char += [{"e": a, "basis": [src]} for a in el_sort(alts) if a != e]
            lit_txt.append(text)
        if p.get("via") == "literature_overruled":
            alt_char += lit_alt_entry(ch)
            o = overruled[ch]
            lit_txt.append("%s %s=%s 는 실무 자료 %d곳의 반대로 문헌 예외로 확정하지 않음(B-2)"
                           % ("·".join(SRC_NAME[s] for s in o["lit_basis"]), ch, o["lit_e"], o["n_opp"]))
        number = ord(ch) in NUMBERS
        note = "%s작명 실무 자료 %d곳 가운데 %d곳이 %s=%s%s, 부수값 %s(%s) → 실무 예외(D1 개정)" % (
            "숫자 한자 — " if number else "", p["of"], p["n"], ch, e, echo_clause(p["n"], p["n_indep"]),
            ctx.num2ch[r], table[r]["element"])
        if number:
            note += ". 숫자 한자는 D3 대로면 부수값 + '이견'이지만 실무 예외가 먼저다"
        if lit_txt:
            note += ". " + "; ".join(lit_txt)
        exc[ch] = {
            "cp": cp_str(ch), "element": e, "kind": "practice", "radical": r,
            "radical_element": table[r]["element"], "same_as_radical": False,
            "basis": list(dict.fromkeys(basis)), "practice": {"n": p["n"], "of": p["of"], "n_indep": p["n_indep"]},
        }
        if number:
            exc[ch]["number"] = True
        if alt_char:
            exc[ch]["alt_char"] = alt_char
        exc[ch]["note"] = note

    disputed = {}
    for cp in NUMBERS:
        ch = chr(cp)
        if ch not in ctx.tset or ch in exc:
            continue
        r = ctx.krs[ch]
        t = table[r]
        disputed[ch] = {
            "cp": cp_str(ch), "kind": "number", "radical": r, "radical_element": t["element"],
            "dispute_basis": ["CRIT"], "decision": "D3",
            "note": "숫자 한자 — 성민경(CRIT)은 숫자 한자의 자원오행을 누가 어떤 기준으로 정하느냐고 묻는다(기준이 없다는 지적). "
                    "실무 자료 관찰(측정, 계획 §2-2): 하도 수 배속(一六水·二七火·三八木·四九金·五十土)을 일관되게 쓰는 곳이 없다. "
                    "부수값 %s(%s) + '이견'(D3). 실무 자료 %d곳 이상(독립 근거 — B-1)이 같은 다른 값을 준 숫자는 실무 예외로 갔다"
                    % (ctx.num2ch[r], t["element"], PRACTICE_MIN_SOURCES),
        }
    for ch in sorted(lit_dispute, key=ord):
        if ch not in ctx.tset or ch in exc:
            continue
        r = ctx.krs[ch]
        t = table[r]
        items = lit_dispute[ch]
        disputed[ch] = {
            "cp": cp_str(ch), "kind": "literature_dispute", "radical": r, "radical_element": t["element"],
            "alt_char": [{"e": a, "basis": [src]} for alts, src, _ in items for a in el_sort(alts) if a != t["element"]],
            "dispute_basis": list(dict.fromkeys(src for _, src, _ in items)),
            "note": "%s → 부수값 %s(%s) + '이견'" % ("; ".join(x[2] for x in items), ctx.num2ch[r], t["element"]),
        }
    # B-2 — 문헌 예외 후보인데 실무 자료가 부수값으로 반대해 확정하지 않은 글자: 값은 부수값, '이견' + 문헌 값(alt_char)
    for ch in sorted(overruled, key=ord):
        o = overruled[ch]
        if o["outcome"] != "radical":
            continue
        if ch in disputed:
            raise SystemExit("B-2 글자가 다른 이견 글자와 겹친다(규칙 미정): %s" % ch)
        r = ctx.krs[ch]
        t = table[r]
        disputed[ch] = {
            "cp": cp_str(ch), "kind": "literature_overruled", "radical": r, "radical_element": t["element"],
            "alt_char": lit_alt_entry(ch), "dispute_basis": list(o["lit_basis"]),
            "practice": {"e": o["e"], "n": o["n"], "of": o["of"], "n_indep": o["n_indep"]}, "decision": "B-2",
            "note": "%s %s=%s, 부수값 %s(%s) — 작명 실무 자료 %d곳 가운데 %d곳이 %s=%s%s → 문헌 예외로 확정하지 않음(B-2): "
                    "부수값 + '이견', 문헌 값은 글자 대체값"
                    % ("·".join(SRC_NAME[s] for s in o["lit_basis"]), ch, o["lit_e"], ctx.num2ch[r], t["element"],
                       o["of"], o["n"], ch, o["e"], echo_clause(o["n"], o["n_indep"])),
        }
    # 실무 자료 2곳 이상이 다른 값을 줬지만 예외를 두지 않은 글자 — 값은 그대로, '이견' + 실무 대체값
    #   literature_same_as_radical: 문헌 값이 부수값과 같아 문헌이 먼저(P7) · rule_echo: 독립 근거가 모자람(B-1)
    for ch in sorted(practice_alt, key=ord):
        if ch in exc:
            continue
        p = practice_alt[ch]
        r = ctx.krs[ch]
        t = table[r]
        entry = disputed.get(ch) or {
            "cp": cp_str(ch), "kind": "practice_dispute", "radical": r, "radical_element": t["element"],
            "alt_char": [], "dispute_basis": [], "note": "",
        }
        entry["alt_char"] = entry["alt_char"] + practice_alt_entry(ch)
        entry["dispute_basis"] = list(dict.fromkeys(entry["dispute_basis"] + ["PRACTICE"]))
        if p["under"] == "literature_same_as_radical":
            srcs = sorted({k for _, k in ctx.lit_char[ch]})
            why = ("문헌 값이 먼저라 실무 예외를 두지 않음(%s %s=%s, 부수값과 같음) — 실무 자료 %d곳 가운데 %d곳은 %s → '이견'"
                   % ("·".join(SRC_NAME[s] for s in srcs), ch, ctx.lit_value[ch], p["of"], p["n"], p["e"]))
            entry.setdefault("decision", "P7")
        elif p["under"] == "rule_echo":
            why = ("작명 실무 자료 %d곳 가운데 %d곳이 %s=%s 지만 그중 %d곳은 그 자료 자신의 부수 다수값과 같은 값(부수 규칙값의 반복)이라 "
                   "독립 근거는 %d곳 — 실무 예외는 독립 근거 %d곳 이상(B-1) → 부수값 %s(%s) + '이견', 실무 값은 글자 대체값"
                   % (p["of"], p["n"], ch, p["e"], p["n"] - p["n_indep"], p["n_indep"], PRACTICE_MIN_SOURCES,
                      ctx.num2ch[r], t["element"]))
            entry.setdefault("decision", "B-1")
        else:
            raise SystemExit("예외 밖 실무 대체값의 under 가 규칙 밖: %s %s" % (ch, p["under"]))
        entry["note"] = ((entry["note"] + "; ") if entry["note"] else "") + why
        disputed[ch] = entry

    # 문헌 예시 글자 — 글자별 결과가 그 글자 자신의 basis 에 문헌 키를 더한다(부수 basis 에서 예시를 뺀 부수 人·頁·广 의 儁·顥·康 등)
    lit_examples = {}
    for ch in sorted(ctx.lit_char, key=ord):
        lit_examples[ch] = {
            "cp": cp_str(ch), "e": ctx.lit_value[ch], "basis": sorted({k for _, k in ctx.lit_char[ch]}),
            "role": "ganji" if ch in ctx.ganji else ("literature_exception" if ch in lit_exc else
                                                     ("literature_overruled" if ch in overruled else "same_as_radical")),
        }

    compat_forms = collections.defaultdict(list)
    for c in ctx.seo:
        if c != nfkc(c):
            compat_forms[nfkc(c)].append(cp_str(c))

    def with_compat(d):
        for ch, v in d.items():
            if ch in compat_forms:
                v["compat_forms_in_target"] = sorted(compat_forms[ch])
        return d

    kinds_order = {"ganji": 0, "literature": 1, "practice": 2}
    exc = dict(sorted(exc.items(), key=lambda kv: (kinds_order[kv[1]["kind"]], ord(kv[0]))))
    exc_doc = {
        "meta": {
            "title": "부수 기준 자원오행 — 글자 예외표",
            "plan": "docs/plan-radical-ohaeng-2026-10.md §2-1 ②③ (단계 S1)",
            "generated_by": "scripts/build_radical_resource_table.py (인자 없음, 결정적 — 고정본 %s 에서 만든다. tmp 불필요)" % rel(FROZEN),
            "order": "판정 순서: NFKC 정규화 → exceptions(간지 → 문헌 예외(B-2 반대 없음) → 실무 예외(B-1 독립 근거)) → 부수표(radical_resource_element.json)",
            "keys": "실제 글자(통합 한자). 호환 한자는 NFKC 로 통합 한자에 붙여 찾는다 — compat_forms_in_target 참고",
            "exceptions_rule": {
                "ganji": "천간·지지 22자 중 인명용(대상 9,190자) 전부. 부수값과 같아도 싣는다(same_as_radical). 근거는 전통 배속 GANJI(+ 같은 값을 실은 문헌 예시)",
                "literature": "문헌(김만태 예시 KIM-EX · 미소 한국작명원 예시 MISO — 작명소 페이지)이 부수값과 다른 값을 적은 글자. 실무 자료 지지 조건 없이 문헌만으로(P1 조건 0) — 단 실무 자료 %d곳 이상이 다른 같은 값으로 반대하면 확정하지 않는다(B-2 → disputed_chars literature_overruled 또는 실무 예외)" % LIT_OVERRULE_MIN_SOURCES,
                "practice": "작명 실무 자료(%s) %d곳 이상이 같은 값을 주고(독립 근거로 %d곳 이상 — B-1: %s 값이 그 자료 자신의 부수 다수값과 같으면 독립으로 세지 않는다) 그 값이 부수 기본값과 다른 글자(D1 개정, basis PRACTICE). 간지·문헌 글자(문헌 값이 부수값과 같아도)는 그 값이 먼저라 넣지 않는다 — 확정하지 않은 문헌 예외 후보(B-2)는 이 규칙을 따른다. 숫자 한자·문헌 본문(KIM-TXT)·작명 서비스 서술(ERUMY) 이견 글자도 이 규칙이 덮으면 예외. 고정본 %s practice_exceptions 에서 온다(%d자를 넘으면 반영하지 않는다)"
                            % ("·".join(PRACTICE_SOURCES), PRACTICE_MIN_SOURCES, PRACTICE_MIN_SOURCES, "·".join(PRACTICE_RULE_ECHO_SOURCES),
                               rel(FROZEN), PRACTICE_MAX),
                "not_included": "오방·괘 이름·R 반대·숫자는 따로 규칙을 두지 않았다 — 실무 예외 규칙이 덮는 만큼만(P3·P4·P6)",
            },
            "disputed_chars_rule": {
                "meaning": "값은 바꾸지 않고(부수표 값 그대로) 등급만 '이견'으로 둔다. 예외가 아니다. 부수 단위 다른 값은 부수표 alt, 글자 단위 다른 값은 alt_char",
                "number": "숫자 한자 一~十·百·千·萬 가운데 실무 예외가 아닌 글자(D3)",
                "literature_dispute": "문헌 본문(KIM-TXT)·작명 서비스 서술(ERUMY)이 이견을 적은 글자 가운데 실무 예외가 아닌 글자",
                "literature_overruled": "문헌 예외 후보(문헌 값 ≠ 부수값)인데 실무 자료 %d곳 이상이 부수값으로 반대해 확정하지 않은 글자(B-2). 값은 부수값, 문헌 값은 alt_char(문헌 출처). practice = 반대한 실무 값·곳 수" % LIT_OVERRULE_MIN_SOURCES,
                "practice_dispute": "실무 자료 %d곳 이상이 다른 같은 값을 줬지만 예외를 두지 않은 글자 — (a) 문헌 값이 부수값과 같아 문헌이 먼저(decision P7) (b) 같은 값을 준 곳 가운데 독립 근거가 %d곳 미만(decision B-1 — 한 곳이 그 자료 자신의 부수 규칙값을 되풀이). 문헌 본문 이견 글자에 겹치면 literature_dispute 항목에 실무 대체값을 더한다" % (PRACTICE_MIN_SOURCES, PRACTICE_MIN_SOURCES),
            },
            "fields": {
                "cp": "코드포인트", "element": "예외 값", "kind": "ganji | literature | practice (disputed_chars: number | literature_dispute | literature_overruled | practice_dispute)",
                "radical": "부수 번호(부수표 meta.key 와 같은 판정)", "radical_element": "부수표 값", "same_as_radical": "예외 값이 부수값과 같은가",
                "basis": "exceptions: element 를 지지하는 출처 키(radical_resource_element.json meta.sources). 실무 예외는 PRACTICE(+ 같은 값을 적은 문헌 본문·작명 서비스 서술)",
                "practice": "exceptions 실무 예외: n = 같은 값을 준 실무 자료 수, of = 이 글자에 단일값이 있는 실무 자료 수, n_indep = n 가운데 독립 근거 수(B-1 — 어느 자료인지는 싣지 않는다). disputed_chars literature_overruled: 반대한 실무 값 e 와 n·of·n_indep",
                "number": "실무 예외가 된 숫자 한자(D3 대상)",
                "alt_char": "이 **글자**에 다른 출처가 준 다른 값 [{e, basis[, n, of, n_indep]}] — 문헌 예시(KIM-EX·MISO — B-2 로 확정하지 않은 문헌 값)·문헌 본문(KIM-TXT)·작명 서비스 서술(ERUMY)과 실무 자료 다수(PRACTICE, n곳 ≥%d, n_indep = 그중 독립 근거 수 — B-1)를 basis 로 나눈다(P7). 화면은 '김만태 예시는 이 글자를 水로 봅니다' · '이루미는 土로 봅니다' · '실무 자료 2곳은 金으로 봅니다'처럼 출처를 밝혀 쓴다" % PRACTICE_MIN_SOURCES,
                "dispute_basis": "disputed_chars: '이견'으로 둔 근거 출처(값을 지지하는 출처가 아니다)",
                "decision": "근거 결정 번호", "note": "결정 근거",
                "literature_examples": "문헌 예시 글자 전부(KIM-EX %d · MISO %d — 공개 페이지에서 손으로 옮긴 값, 스크립트 상수 KIM_EX·MISO_EX). "
                                       "{e, basis, role}. 글자별 결과(build_resource_element)가 그 글자 자신의 basis 에 이 문헌 키를 더한다"
                                       "(결과 e 가 같을 때만 — 부수 basis 는 예시를 부수 근거로 칠 수 있을 때만 문헌 키를 싣는다). role = ganji(간지 예외) · "
                                       "literature_exception(문헌 예외) · literature_overruled(문헌 예외 후보지만 실무 자료 반대로 확정 안 함, B-2) · "
                                       "same_as_radical(부수값과 같아 예외 없음)"
                                       % (sum(len(s) for s in KIM_EX.values()), sum(len(s) for s in MISO_EX.values())),
            },
            "counts": {
                "exceptions": len(exc),
                "ganji": sum(1 for v in exc.values() if v["kind"] == "ganji"),
                "ganji_changing_value": sum(1 for v in exc.values() if v["kind"] == "ganji" and not v["same_as_radical"]),
                "literature": sum(1 for v in exc.values() if v["kind"] == "literature"),
                "practice": sum(1 for v in exc.values() if v["kind"] == "practice"),
                "practice_by_n": dict(sorted(collections.Counter("%d/%d" % (v["practice"]["n"], v["practice"]["of"])
                                                                for v in exc.values() if v["kind"] == "practice").items())),
                "practice_with_rule_echo": sum(1 for v in exc.values() if v["kind"] == "practice"
                                               and v["practice"]["n_indep"] < v["practice"]["n"]),
                "literature_candidates": len(lit_cand),
                "literature_overruled": len(overruled),
                "with_alt_char": sum(1 for v in exc.values() if v.get("alt_char")),
                "disputed_chars": len(disputed),
                "disputed_by_kind": dict(sorted(collections.Counter(v["kind"] for v in disputed.values()).items())),
                "practice_alt_rule_echo": sum(1 for p in practice_alt.values() if p["under"] == "rule_echo"),
                "literature_examples": len(lit_examples),
            },
            "sources": "radical_resource_element.json 의 meta.sources 와 같은 키",
            "decisions": DECISIONS,
            "pending_decisions": PENDING_DECISIONS,
        },
        "exceptions": with_compat(exc),
        "disputed_chars": with_compat(dict(sorted(disputed.items(), key=lambda kv: (kv[1]["kind"] != "number", ord(kv[0]))))),
        "literature_examples": lit_examples,
    }

    dump_json(OUT_TABLE, table_doc)
    dump_json(OUT_EXC, exc_doc)

    # ---- 보고
    print("대상 글자 %d자 (hanja-seo 키 %d, 호환 한자 NFKC 통합)" % (len(ctx.target), len(ctx.seo)))
    print("부수표: %s" % dict(table_doc["meta"]["counts"]))
    c = exc_doc["meta"]["counts"]
    print("예외: 간지 %d(값이 바뀌는 것 %d) · 문헌 %d %s (후보 %d — B-2 로 확정 안 함 %s) · 실무 %d (B-1 로 예외 아님 %d) · 이견 글자 %d %s" % (
        c["ganji"], c["ganji_changing_value"], c["literature"], " ".join(sorted(lit_exc)), c["literature_candidates"],
        " ".join(sorted(overruled)) or "-", c["practice"], c["practice_alt_rule_echo"], c["disputed_chars"], c["disputed_by_kind"]))
    if discrepancies:
        print("승인값과 재계산이 다른 부수:", " ".join("%s(%s %s, 재계산 %s)" % (d["radical"], d["decided_by"], d["approved"],
                                                                          d["recomputed"]) for d in discrepancies))
    print("쓴 파일:", rel(OUT_TABLE), rel(OUT_EXC))


def main():
    ap = argparse.ArgumentParser(description="부수 기준 자원오행 — 214부수표와 예외표")
    ap.add_argument("--refresh", action="store_true", help="tmp 자료로 다시 집계해 고정본과 비교한다(쓰지 않음)")
    ap.add_argument("--freeze", action="store_true", help="--refresh 와 함께: 다시 집계한 값으로 고정본을 덮어쓰고 출력도 만든다")
    args = ap.parse_args()
    if args.freeze and not args.refresh:
        ap.error("--freeze 는 --refresh 와 함께만")
    check_literals()
    ctx = make_ctx()
    if args.refresh:
        new = refresh(ctx)
        old = load_json(FROZEN) if os.path.exists(FROZEN) else None
        diffs = diff_frozen(old, new) if old else ["고정본 없음(%s)" % rel(FROZEN)]
        print("고정본 비교: %s" % ("같음" if not diffs else "다름 %d건" % len(diffs)))
        for d in diffs:
            print("  " + d)
        print("실무 예외 %d자 · 실무 대체값 %d자 · 문헌 예외 %d자" % (
            new["meta"]["counts"]["practice_exceptions"], new["meta"]["counts"]["practice_alt"],
            new["meta"]["counts"]["literature_exceptions"]))
        if not args.freeze:
            sys.exit(1 if diffs else 0)
        dump_json(FROZEN, new)
        print("고정본을 썼다:", rel(FROZEN))
    build_outputs(ctx, load_json(FROZEN))


if __name__ == "__main__":
    main()
