# -*- coding: utf-8 -*-
"""
부수 기준 자원오행 — 글자별 결과 파일을 만든다 (계획 docs/plan-radical-ohaeng-2026-10.md §2-1·§2-4·§2-6, 단계 S1).

입력 (모두 저장소 data/ 안, S1 앞 단계 산출물 — 읽기만):
  data/hanja_radicals.json             글자 → kRSUnicode 첫 값 부수 번호·alts·판정 부수 kangxi (scripts/extract_hanja_radicals.py)
  data/radical_resource_element.json   214부수표 + meta.krs_kangxi_adjusted (scripts/build_radical_resource_table.py)
  data/resource_element_exceptions.json 간지·문헌·실무 예외 + 이견 글자(숫자·문헌 이견·확정 안 한 문헌 예외·실무 이견) (같은 스크립트 —
                                       실무 예외는 커밋된 고정본 data/radical_resource_votes.json 에서 온다)
  data/hanja_variants.json             이체자 묶음 (scripts/build_hanja_variants.py)
  data/hanja_dictionary_final.json     대상 글자 집합(등재 한자 키 — scripts/hanja_target_set.py)과 부수 글자의 훈(note 표기용)
  data/hanja-gloss-overrides.json      부수 글자 훈의 대표 훈 재배열(build_hanja_seo_data.py 의 m 과 같은 규칙)
  frontend/src/data/hanja-seo.json     있으면 키 대조만(옛 9,190·새 9,105 형식 둘 다 통과). 2026-10-22 S4 전까지는 대상·훈 입력이었다 —
                                       hanja-seo.json 이 이 파일을 복사해 만드는 산출물이 되어(S4) 입력에서 뺐다(순환 방지)

출력 (아직 소비처 없음 — 백엔드·프론트 연결은 S4):
  data/hanja_resource_element.json     글자 → {e, g, radical, radical_char, alt_radical [, alt_char, v_reasons, number], basis, note
                                                [, variant_of, variant_tie, compat_of]}
  ⚠️ 계약: S4·S7 은 부수 번호·부수 글자를 이 파일의 radical·radical_char 에서만 읽는다(hanja_radicals.json radical 은
     kRSUnicode 첫 값 원자료라 강희 배열로 옮긴 13자가 다르다).

판정 순서 (계획 §2-1):
  ① 정규화 — 호환 한자(U+F900~FAFF·U+2F800~)는 NFKC 로 통합 한자에 붙이고, 값은 통합 한자 쪽에서 정한다.
     호환 한자 키에도 같은 값을 싣고 compat_of 로 통합 한자를 가리킨다.
     ⚠️ 소비처 규칙(S4): 값은 통합 한자 키에서만 읽는다 — compat_of 가 있는 키는 적용하지 않는다(백엔드 HanjaData 는
     MergeCompatibilityIdeographs 뒤 통합 키에만 적용, build_hanja_seo_data.py 도 통합 키만 출력). 호환 키는 대조·안내용이다.
  ② 간지 예외 → ③ 문헌 예외(B-2: 실무 자료 2곳 이상의 반대가 없을 때) → ③' 실무 예외(B-1: 독립 근거 2곳 이상)
     (resource_element_exceptions.json exceptions) → 등급 X
  ④ 부수표 (radical_resource_element.json) — 부수 번호는 hanja_radicals.json 의 판정 부수(kangxi 가 있으면 그 값, 없으면
     kRSUnicode 첫 값). kangxi 13자(萬·尹·彪·視·章 … 壡)는 부수표 meta.krs_kangxi_adjusted 와 같아야 한다
     (두 파일 모두 scripts/kangxi_radical_order.py 판정 — 다르면 중단).
     부수 status agreed → R, disputed·single·unknown → V. 이견 글자(disputed_chars: 숫자 한자·문헌 이견·B-2 로 확정하지 않은
     문헌 예외 후보·실무 이견(B-1 포함))는 값은 부수값 그대로 V.
  ⑤ 부수 자료가 없으면 U (값 없음).

출처 원칙 (사용자 결정 D1, 2026-10-22 개정):
  값·등급·alt 는 위 입력 파일(kRSUnicode 부수 + 문헌 부수표 + 간지·문헌·실무 예외)에서만 나온다. 작명 사이트 DB(HN·NC·IO)의
  수집 자료는 이 스크립트가 읽지 않는다 — 실무 예외(2곳 이상 같은 값·독립 근거 2곳 이상, basis PRACTICE)와 실무 대체값,
  B-2 로 확정하지 않은 문헌 예외 후보는 예외표를 거쳐 들어온다(값·출처 개수만. 일치율 측정은 저장소 밖 스크래치에서 한다).

이견 표시 (검토 H3·M5, 결정 P7): alt_radical 은 **부수 단위** 다른 값(부수표 alt — '이 부수(X)를 Y로 보는 자료도 있습니다'),
  alt_char 는 **글자 단위** 다른 값 — 문헌 예시(KIM-EX·MISO — B-2 로 확정하지 않은 문헌 값)·문헌 본문(KIM-TXT)·작명 서비스
  서술(ERUMY)과 실무 자료 다수(PRACTICE, 2곳 이상이 준 다른 값 — n_indep = 그중 독립 근거 수, B-1)를 basis 로 나눈다.
  v_reasons 는 V 인 이유(화면 라벨 고르기용). basis 는 e 를 지지하는 출처만 적는다(이견 근거는 alt_char·v_reasons).
  basis 의 HN·NC·IO 는 부수 단위 다수값이다 — 이 글자에 그 값을 준 자료라는 뜻이 아니다(meta.fields.basis).
  number 는 숫자 한자(D3) 표시 — 실무 예외(X)가 된 숫자에도 단다(화면이 D3 문구를 X 에서도 쓸 수 있게).

이체자 (계획 §2-3, D6): 값은 쓴 꼴의 부수를 따른다. variant_of 는 hanja_variants.json 의 confidence=high 묶음에서
정자가 아닌 구성원에만 단다(정자 판정 근거가 약한 standard_tie 묶음이면 variant_tie=true).

호환 한자 리터럴은 소스에 쓰지 않는다(정규화 사고 방지) — 부수 변형 꼴도 \\u 이스케이프로 적는다.

사용법:  python -I scripts/build_resource_element.py      (인자 없음, 같은 입력이면 같은 출력)
"""

import collections
import hashlib
import json
import os
import re
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")  # 멈출 때(SystemExit) 메시지도 utf-8
sys.dont_write_bytecode = True  # 공용 모듈을 불러도 scripts/__pycache__ 를 만들지 않는다
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hanja_target_set  # noqa: E402  (세 S1 스크립트의 대상 글자 집합 — 사전 파일의 등재 한자 키)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN_RAD = os.path.join(ROOT, "data", "hanja_radicals.json")
IN_TABLE = os.path.join(ROOT, "data", "radical_resource_element.json")
IN_EXC = os.path.join(ROOT, "data", "resource_element_exceptions.json")
IN_VAR = os.path.join(ROOT, "data", "hanja_variants.json")
DICTIONARY = hanja_target_set.DICTIONARY
GLOSS_OVERRIDES = os.path.join(ROOT, "data", "hanja-gloss-overrides.json")
OUT = os.path.join(ROOT, "data", "hanja_resource_element.json")

EL = "木火土金水"
COMPAT_RANGES = ((0xF900, 0xFAFF), (0x2F800, 0x2FA1F))

# note 에 원형과 함께 보이는 대표 변형 꼴 (부수 번호 → 코드포인트). 부수표 meta.key 의 변형 목록과 같다.
# 꼴만 보이는 표기이고 판정에는 쓰지 않는다(같은 번호 = 같은 값). 阝는 163(오른쪽)·170(왼쪽) 둘 다.
SHOW_VARIANT = {
    9: 0x4EBB,    # 亻
    18: 0x5202,   # 刂
    61: 0x5FC4,   # 忄
    64: 0x624C,   # 扌
    66: 0x6535,   # 攵
    85: 0x6C35,   # 氵
    86: 0x706C,   # 灬
    94: 0x72AD,   # 犭
    96: 0x738B,   # 王
    113: 0x793B,  # 礻
    118: 0x2EAE,  # ⺮ (CJK 부수 보충)
    130: 0x2EBC,  # ⺼ (CJK 부수 보충, 육달월)
    140: 0x8279,  # 艹
    145: 0x8864,  # 衤
    162: 0x8FB6,  # 辶
    163: 0x961D,  # 阝(우부방)
    170: 0x961D,  # 阝(좌부변)
}

# V 인 이유 → 화면(S7) 라벨·문구 고르기 (meta 에 그대로 싣는다)
V_REASONS = {
    "radical_alt": "부수에 다른 값을 준 자료가 있다(alt_radical) — '이 부수(X)를 Y로 보는 자료도 있습니다'. 출처·표본 크기는 "
                   "radical_resource_element.json alt_by(level few = 3자 미만 표본)",
    "radical_split": "같은 부수 글자의 값이 자료 안에서 갈린다(부수표 split) — '이 부수 글자는 뜻에 따라 다르게 보기도 합니다'",
    "radical_disputed": "계획 D2 이견 부수인데 대체값·갈림이 없다(방어용 — 생기면 부수표 note 를 보고 문구를 정한다)",
    "radical_single": "부수 자료가 적다(단일 출처) — '자료 적음'. 대체값이 없으면 '이견'이라고 쓰지 않는다",
    "radical_unknown": "어느 출처에도 부수 자료가 없어 자의로 추정했다 — '추정'",
    "number": "숫자 한자 — '숫자 한자의 자원오행은 작명가마다 기준이 다릅니다'(D3, CRIT)",
    "char_literature": "문헌 예시(KIM-EX·MISO)·문헌 본문(KIM-TXT)·작명 서비스 서술(ERUMY)이 이 글자에 다른 값을 적었다(alt_char 의 "
                       "basis 가 PRACTICE 가 아닌 것). 문헌 예시는 실무 자료 2곳 이상이 부수값으로 반대해 문헌 예외로 확정하지 않은 "
                       "글자(B-2)다 — '김만태 예시는 이 글자를 水로 봅니다'처럼 출처를 밝혀 쓴다(ERUMY 는 문헌이 아니라 작명 서비스라 '이루미는')",
    "char_practice": "실무 자료 2곳 이상이 이 글자에 다른 같은 값을 줬다(alt_char basis PRACTICE) — 예외를 두지 않은 이유는 (a) 문헌이 "
                     "부수값과 같은 값을 적어 문헌이 먼저이거나 (b) 같은 값을 준 곳 가운데 독립 근거가 2곳 미만(n_indep — 한 곳은 그 "
                     "자료 자신의 부수 규칙값을 되풀이, B-1). '실무 자료 2곳은 金으로 봅니다'",
}

# note 에 쓰는 출처 이름 (radical_resource_element.json meta.sources 키)
SRC_NAME = {
    "KIM-EX": "김만태 예시",
    "MISO": "미소 한국작명원 예시",
    "KIM-TXT": "김만태 본문",
    "ERUMY": "이루미",
    "PRACTICE": "실무 자료",
}

GRADES = {
    "R": "확정 — 합의 부수(radical status agreed)이고 글자 단위 이견(문헌·실무 자료 2곳 이상)이 없다",
    "V": "이견 있음 — 이견·단일 출처·자의 추정 부수, 숫자 한자(D3), 또는 글자 단위 이견(disputed_chars: 문헌 본문·확정하지 않은 "
         "문헌 예외(B-2)·실무 자료(B-1 로 예외가 아닌 것 포함)). "
         "이유는 v_reasons, 다른 값은 alt_radical(부수 단위)·alt_char(글자 단위 — 문헌·실무 자료)",
    "X": "예외 적용 — 간지 22자·문헌 예외(실무 자료 2곳 이상의 반대 없음, B-2)·실무 예외(독립 근거 2곳 이상, B-1)"
         "(resource_element_exceptions.json exceptions)로 정했다. alt_char 가 있으면 "
         "예외 값과 다른 글자 단위 값(실무 자료·문헌)",
    "U": "미상 — 부수 자료가 없다(목표 0자). e 는 null",
}


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


def has_batchim(word):
    ch = word[-1]
    if not 0xAC00 <= ord(ch) <= 0xD7A3:
        raise SystemExit("조사 판정은 한글로 끝나는 말에만: %s" % word)
    return (ord(ch) - 0xAC00) % 28 != 0


def topic(word):
    """'예시는' · '본문은' — 한글로 끝나는 출처 이름 뒤에만 쓴다(한자 뒤에는 조사를 붙이지 않는다)."""
    return word + ("은" if has_batchim(word) else "는")


def alt_clauses(alt_char):
    """글자 대체값 문장 — 문헌은 출처별로 '김만태 본문은 金', 실무 자료는 '실무 자료 2곳은 木'."""
    out = []
    groups = {}
    for a in alt_char:
        if a["basis"] != ["PRACTICE"]:
            groups.setdefault(tuple(a["basis"]), []).append(a["e"])
    for b, es in groups.items():
        out.append("%s %s" % (topic("·".join(SRC_NAME[s] for s in b)), "·".join(el_sort(es))))
    for a in alt_char:
        if a["basis"] == ["PRACTICE"]:
            echo = a["n"] - a.get("n_indep", a["n"])
            out.append("실무 자료 %d곳은 %s%s" % (a["n"], a["e"], (
                "(그중 %d곳은 그 자료의 부수 규칙값 — 독립 근거 %d곳이라 예외로 두지 않음)" % (echo, a["n_indep"])) if echo else ""))
    return out


def check_literals():
    """이 소스 파일에 호환 한자 리터럴이 없는지 확인한다(주석 포함)."""
    with open(os.path.abspath(__file__), encoding="utf-8") as f:
        src = f.read()
    bad = sorted({cp_str(ch) for ch in src if is_compat(ch) or 0x2F00 <= ord(ch) <= 0x2FDF})
    if bad:
        raise SystemExit("소스에 호환 한자·강희 부수 블록 리터럴: %s" % " ".join(bad))


def main():
    check_literals()
    rad = load_json(IN_RAD)
    tdoc = load_json(IN_TABLE)
    edoc = load_json(IN_EXC)
    vdoc = load_json(IN_VAR)
    dictionary = load_json(DICTIONARY)
    gloss_overrides = load_json(GLOSS_OVERRIDES) if os.path.exists(GLOSS_OVERRIDES) else {}

    table = tdoc["radicals"]
    adjusted = tdoc["meta"]["krs_kangxi_adjusted"]
    exc = edoc["exceptions"]
    disp = edoc["disputed_chars"]
    lit_ex = edoc["literature_examples"]
    kx = load_json(os.path.join(ROOT, "data", "kangxi_radicals.json"))["radicals"]

    # ---- 대상 집합: hanja_radicals.json 키 = 사전 파일의 등재 한자 키 (9,190자 = 통합 9,105 + 호환 85)
    dict_keys = hanja_target_set.target_keys(dictionary)
    if set(rad) != set(dict_keys):
        raise SystemExit("hanja_radicals.json 과 사전 등재 한자 키가 다르다: 부수 %d · 사전 %d — extract_hanja_radicals.py 를 먼저 돌릴 것" % (
            len(rad), len(dict_keys)))
    seo_check = hanja_target_set.check_hanja_seo(dict_keys)
    keys = sorted(rad, key=ord)
    unified = sorted({nfkc(c) for c in keys}, key=ord)
    for c in keys:
        if nfkc(c) not in rad:
            raise SystemExit("호환 한자의 통합 한자가 대상에 없다: %s" % cp_str(c))
    if set(exc) & set(disp):
        raise SystemExit("예외와 이견 글자가 겹친다: %s" % " ".join(sorted(set(exc) & set(disp))))
    for d in (exc, disp, lit_ex):
        for c in d:
            if c != nfkc(c) or c not in rad:
                raise SystemExit("예외표 키가 대상 통합 한자가 아니다: %s" % cp_str(c))
    for c, v in lit_ex.items():
        if v["cp"] != cp_str(c) or v["e"] not in EL or not v["basis"] or any(s not in ("KIM-EX", "MISO") for s in v["basis"]):
            raise SystemExit("문헌 예시 항목이 규칙 밖: %s" % c)
        if v["role"] == "literature_exception" and (exc.get(c, {}).get("kind") != "literature" or exc[c]["element"] != v["e"]):
            raise SystemExit("문헌 예외 예시가 예외표 문헌 예외와 다르다: %s" % c)
        if v["role"] == "ganji" and exc.get(c, {}).get("kind") != "ganji":
            raise SystemExit("간지 예시가 예외표 간지와 다르다: %s" % c)
        if v["role"] == "same_as_radical" and c in exc:
            raise SystemExit("부수값과 같은 문헌 예시가 예외표에 있다: %s" % c)
        if v["role"] == "literature_overruled" and not (
                (c in exc and exc[c]["kind"] == "practice") or (c in disp and disp[c]["kind"] == "literature_overruled")):
            raise SystemExit("확정하지 않은 문헌 예외 후보(B-2)가 예외표에서 제자리에 없다: %s" % c)
        if v["role"] not in ("ganji", "literature_exception", "literature_overruled", "same_as_radical"):
            raise SystemExit("문헌 예시 role 이 규칙 밖: %s %s" % (c, v["role"]))

    # ---- 변형 꼴 표기가 kangxi_radicals.json 변형 목록에 있는지
    for n, cp in SHOW_VARIANT.items():
        if chr(cp) not in kx[str(n)]["variants"]:
            raise SystemExit("표기용 변형 꼴이 부수표 변형 목록에 없다: %d %s" % (n, cp_str(chr(cp))))

    # ---- 부수 글자의 훈 — hanja-seo.json m 과 같은 규칙(build_hanja_seo_data.py): 통합 한자 항목 → 사전 순서의 호환 한자 항목 중
    #      처음 나오는 meaning_ko, 대표 훈 오버라이드가 있으면 재배열. 그 첫 훈. (S1 은 hanja-seo m 을 읽었다 — 214부수 글자 훈 같음, 2026-10-22 대조)
    def first_gloss(m):
        m = (m or "").split(",")[0].split("/")[0]  # '클 대/큰 대' → '클 대'
        return re.sub(r"\([^)]*\)", "", m).strip()  # '힘 력(역)' → '힘 력' (note 괄호 안 괄호 방지)

    def reorder_gloss(meaning, preferred):  # build_hanja_seo_data.reorder_gloss · HanjaData.ReorderGloss 와 같다
        preferred = (preferred or "").strip()
        if not preferred:
            return meaning
        if not meaning or not meaning.strip():
            return preferred
        tokens = [t.strip() for t in re.split(r"[,/;·]", meaning) if t.strip()]
        if tokens and tokens[0] == preferred:
            return meaning
        if preferred in tokens:
            tokens.remove(preferred)
        tokens.insert(0, preferred)
        return ", ".join(tokens)

    overrides_u = {nfkc(k): v for k, v in gloss_overrides.items()}
    forms_of = collections.defaultdict(list)  # 통합 한자 → [통합 자신(사전에 있으면), 사전 순서의 호환 한자 …]
    for c in dictionary:
        if c in rad:
            forms_of[nfkc(c)].append(c)
    gloss_by_char = {}
    for u_ch, forms in forms_of.items():
        forms = sorted(forms, key=lambda x: x != u_ch)  # 통합 한자 항목 먼저(build_hanja_seo_data 의 sources 순서)
        m = next((dictionary[x].get("meaning_ko") for x in forms if dictionary[x].get("meaning_ko")), None)
        if u_ch in overrides_u:
            m = reorder_gloss(m or "", overrides_u[u_ch]) or None
        if first_gloss(m):
            gloss_by_char[u_ch] = first_gloss(m)

    def radical_label(n):
        rc = table[str(n)]["radical"]
        forms = rc + ("·" + chr(SHOW_VARIANT[n]) if n in SHOW_VARIANT else "")
        g = gloss_by_char.get(rc)
        return forms + ("(%s)" % g if g else "")

    # ---- 글자 → 부수 번호 (부수표와 같은 판정 — hanja_radicals.json kangxi ↔ 부수표 krs_kangxi_adjusted 대조)
    kx_rad = {c: v["kangxi"] for c, v in rad.items() if "kangxi" in v}
    if set(adjusted) != {c for c in kx_rad if c == nfkc(c)}:
        raise SystemExit("강희 배열 조정 글자가 두 파일에서 다르다: 부수표 %s · hanja_radicals %s" % (
            " ".join(sorted(adjusted)), " ".join(sorted(kx_rad))))
    for c, a in adjusted.items():
        k = kx_rad[c]
        if a["krs_first"] != rad[c]["radical"] or a["used"] != k["radical"] or a["basis"] != k["basis"]:
            raise SystemExit("강희 배열 조정이 두 파일에서 다르다: %s" % c)
        if k["basis"] == "krs_value" and k["radical"] not in [x["radical"] for x in rad[c]["alts"]]:
            raise SystemExit("강희 배열 부수가 kRSUnicode 값에 없다: %s" % c)

    def radical_of(ch):
        r = rad[ch]["radical"]
        if ch in kx_rad:
            return kx_rad[ch]["radical"], r, kx_rad[ch]["basis"]
        return r, None, None

    # ---- 이체자 (high 묶음만)
    groups = {g["id"]: g for g in vdoc["groups"]}
    variant_of = {}
    for c in unified:
        gid = vdoc["char_index"].get(c, {}).get("high")
        if not gid:
            continue
        g = groups[gid]
        if g["confidence"] != "high":
            raise SystemExit("char_index high 가 high 묶음이 아니다: %s %s" % (c, gid))
        if c != g["standard"]:
            variant_of[c] = (g["standard"], bool(g.get("standard_tie")))

    # ---- 통합 한자 판정
    out_u = {}
    kinds = collections.Counter()
    for ch in unified:
        if ch not in rad:
            out_u[ch] = {"e": None, "g": "U", "radical": None, "radical_char": None, "alt_radical": [], "basis": [],
                         "note": "부수 자료 없음 — 미상"}
            kinds["U"] += 1
            continue
        n, krs_first, adj_basis = radical_of(ch)
        t = table[str(n)]
        rlab = radical_label(n)
        adj_clause = None
        if adj_basis == "krs_value":
            # 화면 문구(note → /hanja 자원오행 근거·/evaluate 근거 줄) — 원자료 필드 이름(kRSUnicode·kKangXi)은 쓰지 않는다(S7 검증 S7V-9)
            adj_clause = "강희자전 배열 부수(유니코드 부수 값은 %s)" % table[str(krs_first)]["radical"]
        elif adj_basis == "uro_order":
            adj_clause = "강희자전 배열 부수(유니코드 부수 값은 %s 하나, 유니코드 코드 차트 배열과 강희자전 쪽수는 %s)" % (
                table[str(krs_first)]["radical"], t["radical"])
        rec = {"radical": n, "radical_char": t["radical"]}
        if ch in exc:
            x = exc[ch]
            if x["radical"] != n:
                raise SystemExit("예외표 부수 번호가 다르다: %s %s≠%s" % (ch, x["radical"], n))
            e = x["element"]
            if x["kind"] == "ganji":
                label = x["note"].split(" ")[0]
                if label not in ("천간", "지지"):
                    raise SystemExit("간지 구분을 읽지 못했다: %s" % ch)
                clauses = ["%s %s → %s(간지 오행이 부수보다 먼저)" % (label, ch, e)]
                clauses.append("부수값 %s %s%s" % (rlab, t["element"], "도 같음" if x["same_as_radical"] else ""))
                kinds["X:ganji"] += 1
            elif x["kind"] == "literature":
                clauses = ["문헌 예외 → %s(%s)" % (e, "·".join(SRC_NAME[s] for s in x["basis"]))]
                clauses.append("부수값 %s %s" % (rlab, t["element"]))
                kinds["X:literature"] += 1
            elif x["kind"] == "practice":
                p = x["practice"]
                if x["basis"][0] != "PRACTICE" or not 2 <= p["n"] <= p["of"]:
                    raise SystemExit("실무 예외 근거가 규칙 밖: %s" % ch)
                lit = [s for s in x["basis"][1:]]
                clauses = (["숫자 한자"] if x.get("number") else []) + [
                    "실무 예외 → %s(작명 실무 자료 %d곳 중 %d곳%s)" % (
                        e, p["of"], p["n"], "".join(" · %s도 %s" % (SRC_NAME[s], e) for s in lit))]
                clauses.append("부수값 %s %s" % (rlab, t["element"]))
                kinds["X:practice"] += 1
            else:
                raise SystemExit("알 수 없는 예외 종류: %s %s" % (ch, x["kind"]))
            alt_char = [dict(a) for a in x.get("alt_char", [])]
            if any(a["e"] == e for a in alt_char):
                raise SystemExit("예외 글자 대체값이 예외 값과 같다: %s" % ch)
            clauses += alt_clauses(alt_char)
            if adj_clause:
                clauses.append(adj_clause)
            rec.update({"e": e, "g": "X", "alt_radical": [], "basis": list(x["basis"]), "note": " · ".join(clauses)})
            if alt_char:
                rec["alt_char"] = alt_char
            if x.get("number"):
                rec["number"] = True
        else:
            e = t["element"]
            base = "%s 부수 → %s" % (rlab, e)
            clauses = [base]
            basis = list(t["basis"])  # e 를 지지하는 출처만(이견 근거는 alt_char·v_reasons 로)
            if ch in lit_ex and lit_ex[ch]["e"] == e:
                basis = list(dict.fromkeys(basis + lit_ex[ch]["basis"]))  # 그 글자 자신이 문헌 예시
            elif ch in lit_ex:
                basis = [b for b in basis if b not in lit_ex[ch]["basis"]]  # 그 글자에 다른 값을 적은 문헌은 지지 출처가 아니다
            alt_char = []
            reasons = []
            number = False
            if ch in disp:
                d = disp[ch]
                if d["radical"] != n or d["radical_element"] != e:
                    raise SystemExit("이견 글자 부수 판정이 다르다: %s" % ch)
                if d["kind"] == "number":
                    clauses = ["숫자 한자", base, "작명가마다 기준이 다름"]
                    reasons.append("number")
                    number = True
                    kinds["V:number"] += 1
                elif d["kind"] in ("literature_dispute", "practice_dispute", "literature_overruled"):
                    alt_char = [dict(a) for a in d["alt_char"] if a["e"] != e]
                    if not alt_char:
                        raise SystemExit("글자 단위 이견인데 다른 값이 없다: %s" % ch)
                    clauses += alt_clauses(alt_char)
                    if d["kind"] == "literature_overruled":
                        p = d["practice"]
                        if p["e"] != e or lit_ex.get(ch, {}).get("role") != "literature_overruled":
                            raise SystemExit("확정하지 않은 문헌 예외 후보(B-2)의 실무 값이 부수값과 다르다: %s" % ch)
                        echo = p["n"] - p["n_indep"]
                        # 화면 문구 — 판정 규칙 번호(B-2)는 note 에 싣지 않는다(S7V-9). 규칙은 meta.method 에 있다
                        clauses.append("문헌 예외로 두지 않음(작명 실무 자료 %d곳 중 %d곳이 %s%s)" % (
                            p["of"], p["n"], e, (" — 그중 %d곳은 그 자료의 부수 기본값" % echo) if echo else ""))
                        basis = list(dict.fromkeys(basis + ["PRACTICE"]))
                    if any(a["basis"] != ["PRACTICE"] for a in alt_char):
                        reasons.append("char_literature")
                    if any(a["basis"] == ["PRACTICE"] for a in alt_char):
                        reasons.append("char_practice")
                    kinds["V:%s" % d["kind"]] += 1
                else:
                    raise SystemExit("알 수 없는 이견 종류: %s %s" % (ch, d["kind"]))
                g = "V"
            else:
                g = "R" if t["status"] == "agreed" else "V"
                kinds["%s:radical_%s" % (g, t["status"])] += 1
            alt = list(t["alt"])
            st = t["status"]
            if g == "V":
                if st == "disputed":
                    if t["alt"]:
                        reasons.append("radical_alt")
                    if t["split"]:
                        reasons.append("radical_split")
                    if not t["alt"] and not t["split"]:
                        reasons.append("radical_disputed")
                elif st == "single":
                    reasons.append("radical_single")
                elif st == "unknown":
                    reasons.append("radical_unknown")
                if not reasons:
                    raise SystemExit("V 인데 이유가 없다: %s" % ch)
            if st == "disputed":
                clauses.append("이견 부수" + ("(%s)" % "·".join(t["alt"]) if t["alt"] else "(글자마다 갈림)"))
            elif st == "single":
                clauses.append("자료가 적은 부수")
            elif st == "unknown":
                clauses.append("출처 없는 부수(자의 추정)")
            if adj_clause:
                clauses.append(adj_clause)
            rec.update({"e": e, "g": g, "alt_radical": alt, "basis": basis, "note": " · ".join(clauses)})
            if alt_char:
                rec["alt_char"] = alt_char
            if reasons:
                rec["v_reasons"] = sorted(reasons, key=list(V_REASONS).index)
            if number:
                rec["number"] = True
        if ch in variant_of:
            rec["variant_of"] = variant_of[ch][0]
            if variant_of[ch][1]:
                rec["variant_tie"] = True
        out_u[ch] = rec

    # ---- 호환 한자 키: 통합 한자 값을 그대로, compat_of 로 가리킨다
    out = {}
    for c in keys:
        u = nfkc(c)
        if c == u:
            out[c] = out_u[c]
            continue
        own = radical_of(c)[0]
        if own != out_u[u]["radical"]:
            raise SystemExit("호환 한자 자기 부수가 통합 한자 판정과 다르다: %s %d≠%d" % (cp_str(c), own, out_u[u]["radical"]))
        r = dict(out_u[u])
        r["note"] = "호환 한자 — 통합 한자 %s(%s) 값 · %s" % (u, cp_str(u), out_u[u]["note"])
        r["compat_of"] = u
        out[c] = r

    # ---- 필드 순서 고정
    order = ["e", "g", "radical", "radical_char", "alt_radical", "alt_char", "v_reasons", "number", "basis", "note",
             "variant_of", "variant_tie", "compat_of"]
    out = {c: {k: out[c][k] for k in order if k in out[c]} for c in keys}

    grade_counts = collections.Counter(v["g"] for v in out.values())
    grade_counts_u = collections.Counter(out_u[c]["g"] for c in unified)
    elem_counts_u = collections.Counter(out_u[c]["e"] for c in unified)

    inputs = {}
    for p in (IN_RAD, IN_TABLE, IN_EXC, IN_VAR, os.path.join(ROOT, "data", "kangxi_radicals.json"), DICTIONARY, GLOSS_OVERRIDES):
        inputs[os.path.relpath(p, ROOT).replace(os.sep, "/")] = sha256(p)

    meta = {
        "title": "부수 기준 자원오행 — 글자별 결과",
        "plan": "docs/plan-radical-ohaeng-2026-10.md §2-1·§2-4·§2-6 (단계 S1)",
        "generated_by": "scripts/build_resource_element.py (인자 없음, 결정적)",
        "order": [
            "① NFKC 정규화 — 값은 통합 한자에서 정하고 호환 한자 키는 같은 값을 싣는다(compat_of)",
            "② 간지 예외 → ③ 문헌 예외(P1 — 문헌만으로, B-2 — 실무 자료 2곳 이상이 다른 같은 값으로 반대하면 확정하지 않음) → "
            "③' 실무 예외(D1 개정 — 실무 자료 2곳 이상 같은 값, B-1 — 그 자료 자신의 부수 규칙값 반복은 독립 근거로 세지 않음) "
            "(resource_element_exceptions.json exceptions) — 등급 X",
            "④ 부수표 (radical_resource_element.json) — agreed → R, disputed·single·unknown → V; "
            "이견 글자(disputed_chars: 숫자 한자 D3·문헌 본문 이견·확정하지 않은 문헌 예외 B-2·실무 이견 P7/B-1)는 부수값 그대로 V",
            "⑤ 부수 자료 없음 → U (e = null)",
        ],
        "radical_rule": "kRSUnicode 첫 값의 강희 부수 번호. 첫 값이 강희자전 배열과 어긋나는 글자(hanja_radicals.json kangxi = "
                        "부수표 meta.krs_kangxi_adjusted, scripts/kangxi_radical_order.py)는 kRSUnicode 다른 값·원 코드 차트 배열 "
                        "부수 중 kKangXi 쪽수에 맞는 쪽. 변형 부수(氵·扌 …)는 원형과 같은 번호",
        "contract": "S4·S7 은 글자의 부수 번호·부수 글자를 이 파일의 radical·radical_char 에서만 읽는다. hanja_radicals.json "
                    "radical 은 kRSUnicode 첫 값(원자료)이라 kangxi 13자가 다르다. hanja_variants.json radicals 는 이 파일과 같은 판정",
        "fields": {
            "e": "자원오행 木火土金水 (U 이면 null)",
            "g": "등급 R·V·X·U (grades)",
            "radical": "강희 부수 번호 1~214",
            "radical_char": "부수의 통합 한자 꼴(원형)",
            "alt_radical": "**부수 단위** 다른 값(木火土金水 순) = 부수표 alt. 화면은 '이 부수(X)를 Y로 보는 자료도 있습니다' — "
                           "'작명가에 따라 이 글자를 Y로 봅니다'처럼 글자 견해로 쓰지 말 것(그 글자에 Y를 준 자료가 없을 수 있다). "
                           "R·X: 빈 목록(예외 글자의 부수값은 note 에)",
            "alt_char": "**글자 단위** 다른 값 [{e, basis[, n, of, n_indep]}] — basis 로 출처를 나눈다(P7): 문헌 예시(KIM-EX·MISO — "
                        "B-2 로 확정하지 않은 문헌 값)·문헌 본문(KIM-TXT)·작명 서비스 서술(ERUMY)이 이 글자에 적은 값, 또는 PRACTICE = "
                        "작명 실무 자료 n곳(≥2)이 준 같은 값(of = 값이 있는 곳 수, n_indep = 그중 독립 근거 수 — 그 자료 자신의 부수 규칙값 "
                        "반복을 뺀 수, B-1. 어느 자료인지는 싣지 않는다). V 뿐 아니라 X(간지·문헌·실무 예외 값과 다른 값)에도 있을 수 있다. "
                        "없으면 키가 없다",
            "v_reasons": "V 인 이유 목록(v_reasons_legend). V 에만 있다",
            "number": "숫자 한자(一~十·百·千·萬, D3)면 true — V(v_reasons number)뿐 아니라 실무 예외 X 가 된 숫자(二·九·五)에도 있다. "
                      "화면(S7)은 이 글자에 '숫자 한자의 자원오행은 작명가마다 기준이 다릅니다'를 함께 쓴다. 아니면 키가 없다",
            "basis": "e 를 지지하는 출처 키(radical_resource_element.json meta.sources). 부수값이면 부수표 basis(+ 그 글자 자신이 "
                     "문헌 예시면 그 문헌 키 — 예외표 literature_examples), 예외면 예외 basis. 이견 근거는 여기 넣지 않는다"
                     "(alt_char basis·v_reasons). [UNIHAN] 뿐이면 그 부수값을 지지하는 표·문헌이 없다. "
                     "⚠️ 부수값의 HN·NC·IO 는 그 DB 가 이 부수 글자들에 준 다수값(부수 단위)이 e 와 같다는 뜻이다 — 이 글자에 그 값을 줬다는 "
                     "뜻이 아니다(이 글자에는 다른 값을 준 DB 도 있다). 화면(S7)은 'HN·NC·IO 가 이 글자를 X로 봤다'로 쓰지 말고 "
                     "'이 부수를 X로 보는 실무 자료' 수준으로만 쓴다. 글자 단위 실무 근거는 PRACTICE 뿐이다 — 실무 예외(X), B-2 로 문헌 "
                     "예외를 확정하지 않은 글자(V, 실무 자료 다수가 이 부수값), alt_char PRACTICE. 그 글자에 다른 값을 적은 문헌 예시 "
                     "키는 부수 basis 에 있어도 뺀다",
            "note": "사람이 읽을 근거 한 줄. 부수 훈은 그 부수 글자의 hanja-seo.json m 과 같은 규칙(사전 meaning_ko + 대표 훈 오버라이드)의 첫 훈"
                    "(없는 부수 글자는 꼴만)",
            "consumer_rule": "값(e·g 등)은 통합 한자 키에서만 읽는다 — compat_of 가 있는 키는 적용하지 않는다(백엔드는 호환 한자 병합 뒤 "
                             "통합 키에만, hanja-seo.json 은 통합 키만). 호환 키는 통합 한자와 같은 값을 실은 대조·안내용",
            "variant_of": "이체자면 정자 — hanja_variants.json confidence=high 묶음의 standard(정자 자신에게는 없음). "
                          "값은 쓴 꼴의 부수를 따른다(D6) — 정자 값은 이 파일의 variant_of 키에서 읽는다",
            "variant_tie": "variant_of 의 정자 판정이 약하다(standard_tie: 네이버 순서·코드포인트로 정함) — 화면(S7)은 이 글자에 "
                           "'이체자' 배지·정자 링크를 달지 않는다",
            "compat_of": "호환 한자 키에만 — NFKC 통합 한자. 값은 통합 한자와 같다",
        },
        "grades": GRADES,
        "v_reasons_legend": V_REASONS,
        "db_values": "작명 사이트 DB(HN·NC·IO) 수집 자료는 이 스크립트가 읽지 않는다. 실무 예외(X, basis PRACTICE)·실무 대체값"
                     "(alt_char PRACTICE)·확정하지 않은 문헌 예외(B-2)는 커밋된 고정본 data/radical_resource_votes.json → 예외표를 거쳐 "
                     "값·출처 개수만 들어온다(D1 개정·B-1·B-2). "
                     "그 밖의 글자값은 일치율 측정용(저장소 밖)",
        "sources": "radical_resource_element.json meta.sources",
        "counts": {
            "keys": len(out),
            "unified": len(unified),
            "compat": len(keys) - len(unified),
            "grade_keys": {k: grade_counts.get(k, 0) for k in "RVXU"},
            "grade_unified": {k: grade_counts_u.get(k, 0) for k in "RVXU"},
            "kind_unified": dict(sorted(kinds.items())),
            "element_unified": {k: elem_counts_u.get(k, 0) for k in EL},
            "kangxi_adjusted": sum(1 for c in unified if c in adjusted),
            "v_reasons_unified": {k: sum(1 for c in unified if k in out_u[c].get("v_reasons", [])) for k in V_REASONS},
            "v_without_alt_unified": sum(1 for c in unified if out_u[c]["g"] == "V" and not out_u[c]["alt_radical"]
                                         and not out_u[c].get("alt_char")),
            "alt_char_unified": sum(1 for c in unified if out_u[c].get("alt_char")),
            "number_unified": {g: sum(1 for c in unified if out_u[c].get("number") and out_u[c]["g"] == g) for g in "RVXU"
                               if any(out_u[c].get("number") and out_u[c]["g"] == g for c in unified)},
            "variant_of": sum(1 for v in out.values() if "variant_of" in v),
            "variant_of_unified": sum(1 for c in unified if "variant_of" in out_u[c]),
        },
        "inputs_sha256": inputs,
    }

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("{\n")
        f.write('"meta": %s,\n' % json.dumps(meta, ensure_ascii=False, indent=1))
        f.write('"chars": {\n')
        for i, c in enumerate(keys):
            f.write("  %s: %s%s\n" % (json.dumps(c, ensure_ascii=False), json.dumps(out[c], ensure_ascii=False),
                                      "," if i < len(keys) - 1 else ""))
        f.write("}\n}\n")

    # 다시 읽어 키가 그대로인지(호환 한자 키 포함) 확인
    back = load_json(OUT)["chars"]
    if list(back) != keys:
        raise SystemExit("출력 키가 입력과 다르다")

    print("대상 %d자 (통합 %d · 호환 %d) · %s" % (len(keys), len(unified), len(keys) - len(unified), seo_check))
    print("등급(키 기준) %s · 등급(통합 기준) %s" % (meta["counts"]["grade_keys"], meta["counts"]["grade_unified"]))
    print("종류(통합 기준) %s" % meta["counts"]["kind_unified"])
    print("오행(통합 기준) %s" % meta["counts"]["element_unified"])
    print("강희 배열 조정 %d · 이체자 variant_of %d(통합 %d)" % (
        meta["counts"]["kangxi_adjusted"], meta["counts"]["variant_of"], meta["counts"]["variant_of_unified"]))
    print("쓴 파일:", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
