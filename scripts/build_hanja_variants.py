# -*- coding: utf-8 -*-
"""
인명용 한자 이체자 묶음 빌드 (부수 기준 자원오행 전환 S1 — 이체자 맵).

입력 (읽기만 한다)
  - frontend/src/data/hanja-seo.json      대상 글자 9,190자(키)와 독음 r·훈 m·대법원 표 gov·등급 g
  - tmp/unihan-18.0/Unihan_Variants.txt   이체 연결(Unicode 18.0, 2026-07-31)
  - tmp/unihan-18.0/Unihan_IRGSources.txt kCompatibilityVariant
  - data/hanja_radicals.json              글자별 판정 부수(scripts/extract_hanja_radicals.py — kangxi 필드 반영).
                                          부수는 결과 파일(hanja_resource_element.json)과 같은 판정이어야 하므로 직접 세지 않는다
  - tmp/unihan-18.0/Unihan.zip 안의 Unihan_Readings.txt  kHangul(한국 표준 출처 표지)·kDefinition
  - data/data-naver.csv                   독음별 글자 순서(빈도 대용, 정자 동률 깨기 전용)
출력
  - data/hanja_variants.json

사용법:  python -I scripts/build_hanja_variants.py      (인자 없음, 같은 입력이면 같은 출력)

규칙 요약 (자세한 설명은 출력 파일 meta.rules 에도 그대로 싣는다)

1. 정규화: 호환 한자(U+F900~FAFF·U+2F800~ 중 NFC 로 바뀌는 85자)는 통합 한자로 붙인다.
   묶음은 통합 한자 기준으로 만들고, 호환 한자는 compat 절에 따로 적는다.
2. 연결: Unihan_Variants 의 kZVariant·kSemanticVariant·kTraditionalVariant·kSimplifiedVariant
   + kJapaneseOldVariant·kJapaneseNewVariant(신자체·구자체 — 恵/惠·徳/德 은 이 필드로만 이어진다).
   kSpoofingVariant 는 쓰지 않는다. kSpecializedSemanticVariant(특정 문맥에서만 같은 뜻)는
   연결 근거로 쓰지 않고, kSemanticVariant 와 함께 나오면 그 쌍의 근거를 약하게 본다.
   보충: Unihan_Readings 의 kDefinition 이 다른 대상 글자를 "same as / variant of / … form of" 로
   지목하면 그것도 연결로 쓴다(근거 이름 "kDefinition" — 㥁→德·䦞→閏 처럼 Variants 파일에 없는 진술).
   대상 글자끼리의 직접 연결만 쓴다(대상 밖 글자를 거치는 2단 연결은 간화 병합 發-发-髮 을 만든다).
3. 제외(excluded_pairs): 갖은자(二/貳 등 大寫數字 표) · 특정 문맥 의미 이체만 · 스푸핑만 ·
   한국 독음이 하나도 겹치지 않음 · 간번체 대응만 있고 대표 훈이 다름(后/後·干/幹 같은 간화 병합) ·
   약한 연결인데 훈이 전혀 안 겹침.
4. 쌍 신뢰도: Unihan 근거 등급(U) × 한국 근거 등급(K)
     U3 = kZVariant(같은 추상 글자의 자형 차이)
     U2 = kJapaneseOld/NewVariant, kSemanticVariant<kHKGlyph, 출처가 kFenn·kCowles 만이 아닌
          kSemanticVariant, kDefinition 이 상대를 "same as / variant of" 로 지목
     U1 = kSemanticVariant 출처가 kFenn·kCowles 뿐(통용 표시가 섞임: 佑/祐·曜/耀),
          또는 kSemanticVariant 와 kSpecializedSemanticVariant 가 함께 있음(사전마다 판단이 갈림)
     T  = 간번체 대응(kTraditional/kSimplifiedVariant)만
     K2 = 대표 훈(훈 목록 첫 항목)이 같음(공백 무시, 2음절 이상이면 포함 관계도 인정)
     K1 = 훈이 일부만 겹침, 또는 한쪽 훈 자료가 없음
     K0 = 독음만 겹침
            K2      K1      K0
     U3     high    high    high
     U2     high    medium  low     (단 kHKGlyph 연결은 K0 에서 medium)
     U1     medium* low     제외
     T      medium* 제외    제외
     * 두 글자의 영문 뜻풀이(kDefinition, 괄호·불용어 제외 낱말) 자카드가 0.5 이상이면 high
       (咲/笑·個/箇·冊/册·凛/凜 은 high, 佑/祐·曜/耀·係/系 는 medium 에 남는다)
5. 묶음: 신뢰도 단계별 연결 성분. high 묶음 = high 쌍만으로 이은 성분(배지·독음 목록 묶기는 이것만).
   medium 묶음 = high+medium 쌍으로 이었을 때 high 묶음과 구성이 달라지는 성분(includes 에 포함한
   high 묶음 id). low 묶음도 같은 방식. 한 글자는 단계마다 많아야 한 묶음에 든다.
6. 정자(standard) 판정 — 아래 순서로 처음 갈리는 기준이 standard_basis
     ① 한국 표준형: kHangul 출처 표지 E(교육용 기초한자) > 0(KS X 1001) > 1(KS X 1002) > N(인명용)·없음
        (N 은 대상 글자 거의 전부라 표지 없음과 같은 순위)
     ② 방향: 간체 쪽(kTraditionalVariant 가 다른 구성원을 가리키고 자기 자신은 없는 글자),
        일본 신자체 쪽(다른 구성원의 kJapaneseNewVariant), kDefinition 이 다른 구성원을
        "same as/… form of" 로 가리키는 쪽(일방 지목)이 아닌 글자
     ③ 대법원 인명용 한자표 출현(gov)
     ④ 검수 S(hanja_core_v1 수록)
     ⑤ 한국 표준 독음 수: kHangul 에서 E·0·1 표지가 붙은 독음이 많은 쪽(琉 류:0N 유:0 > 瑠 류:0N,
        拏 나:0N 라:0 > 拿 나:0N — 한국 표준 코드에 더 넓게 실린 꼴)
     ⑥ data-naver.csv 독음별 순서(빈도 대용)
     ⑦ 코드포인트
   ①은 대법원 표의 정자-허용자 괄호 구조가 없어 쓰는 대용이다. ⑥·⑦로 정해진 묶음은
   standard_tie=true 로 표시한다(사람 확인 대상 — 화면 배지·정자 링크를 달지 않는다).
7. 부수: 자원오행 판정 부수의 강희 번호(kn)와 부수 글자(k) — data/hanja_radicals.json 의 kangxi 필드가 있으면 그 값,
   없으면 kRSUnicode 첫 값(결과 파일 hanja_resource_element.json radical 과 같다). 판정 부수와 다른 kRSUnicode 값의
   부수는 alt 에, 첫 값이 판정 부수와 다르면 krs_first 에 적는다(萬: kn 140 艸, alt 禸 114, krs_first 114).
   계획 D6(오행은 쓴 꼴의 부수)에 따라 묶음 안에서 판정 부수가 다르면 radical_differs=true, 정자와 부수가 다른
   구성원을 radical_differs_from_standard 에 적는다.
8. 알려진 빈틈(meta.known_gaps): 한국형·중일형 자형 쌍(淸/清 등)과 옥편 同字(儁=俊) 가운데 Unihan 18.0 에
   연결이 없어 묶이지 않은 쌍. 두 꼴의 부수가 같아 오행 값에는 영향이 없다. 수동 보충은 이 단계 범위 밖(S7 전 사람 검수).

주의: 소스에 호환 한자 리터럴을 쓰지 않는다(정규화 회귀 전력). 필요한 글자는 코드포인트 숫자로 쓴다.
"""

import collections
import csv
import json
import os
import re
import sys
import unicodedata
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIHAN_DIR = os.path.join(ROOT, "tmp", "unihan-18.0")
SEO_PATH = os.path.join(ROOT, "frontend", "src", "data", "hanja-seo.json")
RAD_PATH = os.path.join(ROOT, "data", "hanja_radicals.json")
NAVER_PATH = os.path.join(ROOT, "data", "data-naver.csv")
OUT_PATH = os.path.join(ROOT, "data", "hanja_variants.json")

LINK_FIELDS = (
    "kZVariant", "kSemanticVariant", "kTraditionalVariant", "kSimplifiedVariant",
    "kJapaneseOldVariant", "kJapaneseNewVariant",
)
NOTED_FIELDS = ("kSpecializedSemanticVariant", "kSpoofingVariant")  # 연결 근거로 쓰지 않음
WEAK_SEMANTIC_SOURCES = {"kFenn", "kCowles"}

# 갖은자(大寫數字): 숫자 → 갖은자 코드포인트. 뜻만 같은 다른 글자라 이체 묶음에 넣지 않는다.
# 표준 大寫數字(壹貳參肆伍陸柒捌玖拾佰仟)만 둔다. 萬은 万의 갖은자로도 쓰이지만 한국에서는
# 万이 萬의 약자(이체)이므로 넣지 않고, 古字(弌·弍)·阡·陌 도 넣지 않는다.
GATJEUNJA = {
    0x4E00: (0x58F9,),          # 一: 壹
    0x4E8C: (0x8CB3,),          # 二: 貳
    0x4E09: (0x53C3, 0x53C1),   # 三: 參 叁
    0x56DB: (0x8086,),          # 四: 肆
    0x4E94: (0x4F0D,),          # 五: 伍
    0x516D: (0x9678,),          # 六: 陸
    0x4E03: (0x67D2,),          # 七: 柒
    0x516B: (0x634C,),          # 八: 捌
    0x4E5D: (0x7396,),          # 九: 玖
    0x5341: (0x62FE,),          # 十: 拾
    0x767E: (0x4F70,),          # 百: 佰
    0x5343: (0x4EDF,),          # 千: 仟
}

HANGUL_SYLLABLE = re.compile(r"[\uAC00-\uD7A3]")
CJK_CHAR = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF\U00020000-\U0003134F]")
VARIANT_PHRASE = re.compile(
    r"(same as|variant|form of|non-classical|vulgar|corrupt|abbreviat|standard form|original form|"
    r"ancient|old form|equivalent)", re.I)
DEF_STOP = {"a", "an", "the", "of", "to", "and", "or", "in", "for", "name", "used", "with", "as", "be", "is",
            "on", "kind", "by", "it", "from", "that"}
DEF_AGREE = 0.5  # 영문 뜻풀이(kDefinition) 낱말 자카드 — U1·T 쌍을 high 로 올리는 기준
# 한국형·중일형 자형 쌍과 옥편 同字 가운데 Unihan 18.0 에 연결이 없는 것(검토 L3) — 코드포인트 쌍(앞 = 한국에서 흔히 쓰는 꼴)
KNOWN_GAP_PAIRS = [
    (0x6DF8, 0x6E05), (0x9751, 0x9752), (0x59F8, 0x598D), (0x59EC, 0x59EB),  # 淸/清 靑/青 姸/妍 姬/姫
    (0x88F5, 0x88F4), (0x66FA, 0x66F9), (0x4FCA, 0x5101),                    # 裵/裴 曺/曹 俊/儁(同字)
]
# N(인명용)은 대상 글자 거의 전부가 해당해 정자를 가르지 못하므로 표지 없음과 같은 순위로 둔다
FLAG_RANK = {"E": 0, "0": 1, "1": 2}
FLAG_LABEL = {0: "kHangul:E(교육용 기초한자)", 1: "kHangul:0(KS X 1001)", 2: "kHangul:1(KS X 1002)",
              3: "kHangul:N·없음"}


def canon(c):
    return unicodedata.normalize("NFC", c)


def cp(c):
    return "U+%04X" % ord(c)


def read_header(path_or_lines):
    """Unihan 파일 머리의 Date·Version 줄."""
    out = {}
    for line in path_or_lines:
        if not line.startswith("#"):
            break
        m = re.match(r"# (Date|Unicode Version):? (.*)", line.strip())
        if m:
            out[m.group(1)] = m.group(2).strip()
    return out


def parse_fields(lines, fields, store):
    for line in lines:
        if not line.startswith("U+"):
            continue
        code, field, value = line.rstrip("\n").split("\t", 2)
        if field in fields:
            store[chr(int(code[2:], 16))][field] = value


def load_inputs():
    seo = json.load(open(SEO_PATH, encoding="utf-8"))
    rad = json.load(open(RAD_PATH, encoding="utf-8"))
    if set(rad) != set(seo):
        raise SystemExit("data/hanja_radicals.json 키가 hanja-seo.json 과 다르다 — extract_hanja_radicals.py 를 먼저 돌릴 것")
    uni = collections.defaultdict(dict)
    versions = {}
    irg_path = os.path.join(UNIHAN_DIR, "Unihan_IRGSources.txt")
    with open(irg_path, encoding="utf-8") as fh:
        lines = fh.readlines()
    versions["Unihan_IRGSources.txt"] = read_header(lines)
    parse_fields(lines, {"kCompatibilityVariant"}, uni)
    with zipfile.ZipFile(os.path.join(UNIHAN_DIR, "Unihan.zip")) as zf:
        lines = zf.read("Unihan_Readings.txt").decode("utf-8").splitlines()
    versions["Unihan.zip:Unihan_Readings.txt"] = read_header(lines)
    parse_fields(lines, {"kHangul", "kDefinition"}, uni)
    var_path = os.path.join(UNIHAN_DIR, "Unihan_Variants.txt")
    with open(var_path, encoding="utf-8") as fh:
        lines = fh.readlines()
    versions["Unihan_Variants.txt"] = read_header(lines)
    links = []
    for line in lines:
        if not line.startswith("U+"):
            continue
        code, field, value = line.rstrip("\n").split("\t", 2)
        a = chr(int(code[2:], 16))
        for tok in value.split():
            m = re.match(r"U\+([0-9A-F]+)(?:<(.*))?$", tok)
            links.append((a, field, chr(int(m.group(1), 16)), m.group(2) or ""))
    naver = {}
    count = collections.Counter()
    with open(NAVER_PATH, encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            key = (row["hangul"], canon(row["hanja"]))
            if key not in naver:
                naver[key] = count[row["hangul"]]
                count[row["hangul"]] += 1
    return seo, rad, uni, links, naver, versions


class Chars:
    """대상 글자(통합 한자 기준) 단위 정보."""

    def __init__(self, seo, rad, uni):
        self.seo, self.rad, self.uni = seo, rad, uni
        self.forms = collections.defaultdict(list)
        for c in sorted(seo, key=ord):
            self.forms[canon(c)].append(c)
        self.all = sorted(self.forms, key=ord)
        self.set = set(self.all)
        self.info = {c: self._info(c) for c in self.all}

    def _info(self, c):
        fs = sorted(self.forms[c], key=lambda x: (x != c, ord(x)))
        readings, glosses, gov, core = [], [], False, False
        for x in fs:
            e = self.seo[x]
            for r in e["r"]:
                if r not in readings:
                    readings.append(r)
            if e.get("m"):
                glosses.append(e["m"])
            gov |= bool(e.get("gov"))
            core |= e.get("g") == "S"
        gloss = glosses[0] if glosses else ""
        parts = []
        for seg in re.split(r"[,/]", gloss):
            words = seg.split()
            if len(words) >= 2:
                parts.append(("".join(words[:-1]), HANGUL_SYLLABLE.findall(words[-1])))
        rset = set(readings)
        for _, rs in parts:
            rset |= set(rs)
        flags = set()
        ks_readings = set()
        for tok in self.uni.get(c, {}).get("kHangul", "").split():
            if ":" in tok:
                flags |= set(tok.split(":")[1])
                if set(tok.split(":")[1]) & set(FLAG_RANK):
                    ks_readings.add(tok.split(":")[0])
        radical = None
        r = self.rad.get(c)
        if r:
            used = r["kangxi"]["radical"] if "kangxi" in r else r["radical"]
            radical = dict(kn=used, k=unicodedata.normalize("NFKC", chr(0x2F00 + used - 1)))
            alt, seen = [], {used}
            for v in [r] + r["alts"]:
                if v["radical"] not in seen:
                    seen.add(v["radical"])
                    alt.append(dict(kn=v["radical"], k=v["radical_char"]))
            if alt:
                radical["alt"] = alt
            if r["radical"] != used:
                radical["krs_first"] = r["radical"]
        d = self.uni.get(c, {}).get("kDefinition", "")
        words = {w for w in re.sub(r"[^a-z]+", " ", re.sub(r"\([^)]*\)", "", d.lower())).split()
                 if w not in DEF_STOP and len(w) > 2}
        refs = set()
        for mm in re.finditer(r"\(([^)]*)\)", d):
            if VARIANT_PHRASE.search(mm.group(1)):
                refs |= set(CJK_CHAR.findall(mm.group(1)))
        for mm in re.finditer(r"(same as|variant of|form of)\s+([^\s,;)]+)", d, re.I):
            refs |= set(CJK_CHAR.findall(mm.group(2)))
        refs = {canon(x) for x in refs} - {c}
        return dict(readings=readings, rset=rset, gloss=gloss, huns=[h for h, _ in parts], gov=gov, core=core,
                    flags=flags, ks_readings=len(ks_readings), radical=radical, def_words=words, def_refs=refs)


def gloss_match(x, y):
    if not x or not y:
        return False
    if x == y:
        return True
    short, long_ = (x, y) if len(x) <= len(y) else (y, x)
    return len(short) >= 2 and short in long_


def classify_pair(a, b, ev, ch, gat_pairs):
    """한 쌍의 근거를 모아 (신뢰도, 제외 사유, 근거 기록)을 낸다."""
    fields = set(ev)
    ia, ib = ch.info[a], ch.info[b]
    sources = set()
    for x, y, tag in ev.get("kSemanticVariant", ()):
        for t in tag.split(","):
            if t:
                sources.add(t.split(":")[0])
    z = "kZVariant" in fields
    jp = bool(fields & {"kJapaneseOldVariant", "kJapaneseNewVariant"})
    hk = "kHKGlyph" in sources
    sem = "kSemanticVariant" in fields
    spec = "kSpecializedSemanticVariant" in fields
    defref = b in ia["def_refs"] or a in ib["def_refs"]
    weak_sem = sem and bool(sources) and sources <= WEAK_SEMANTIC_SOURCES
    rd = bool(ia["rset"] & ib["rset"])
    h1 = gloss_match(ia["huns"][0] if ia["huns"] else "", ib["huns"][0] if ib["huns"] else "")
    hany = any(gloss_match(x, y) for x in ia["huns"] for y in ib["huns"])
    hknown = bool(ia["huns"]) and bool(ib["huns"])
    wa, wb = ia["def_words"], ib["def_words"]
    jac = round(len(wa & wb) / len(wa | wb), 2) if wa and wb else 0.0

    if z:
        ulev = "U3"
    elif jp or hk or defref or (sem and not weak_sem and not spec):
        ulev = "U2"
    elif sem:
        ulev = "U1"
    elif fields & {"kTraditionalVariant", "kSimplifiedVariant"}:
        ulev = "T"
    else:
        ulev = None
    if not rd:
        klev = None
    elif h1:
        klev = "K2"
    elif hany or not hknown:
        klev = "K1"
    else:
        klev = "K0"

    conf, reason = None, None
    if frozenset((a, b)) in gat_pairs:
        reason = "gatjeunja"
    elif ulev is None:
        reason = "spoofing_only" if "kSpoofingVariant" in fields else "specialized_semantic_only"
    elif klev is None:
        reason = "reading_mismatch"
    elif ulev == "U3":
        conf = "high"
    elif ulev == "U2":
        conf = {"K2": "high", "K1": "medium", "K0": "medium" if hk else "low"}[klev]
    elif ulev == "U1":
        conf = {"K2": "high" if jac >= DEF_AGREE else "medium", "K1": "low"}.get(klev)
        if conf is None:
            reason = "specialized_semantic" if spec else "weak_link_gloss_differs"
    else:  # T
        if klev == "K2":
            conf = "high" if jac >= DEF_AGREE else "medium"
        else:
            reason = "simplification_merger"
    evidence = dict(u=ulev, k=klev)
    if sources:
        evidence["semantic_sources"] = sorted(sources)
    if defref:
        evidence["kDefinition_ref"] = True
    if wa and wb:
        evidence["def_jaccard"] = jac
    return conf, reason, evidence


def connected(nodes, edges):
    parent = {n: n for n in nodes}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b in edges:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb, key=ord)] = min(ra, rb, key=ord)
    comp = collections.defaultdict(list)
    for n in nodes:
        comp[find(n)].append(n)
    return [sorted(v, key=ord) for v in comp.values() if len(v) > 1]


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    seo, rad, uni, links, naver, versions = load_inputs()
    ch = Chars(seo, rad, uni)
    gat_pairs = {frozenset((chr(a), chr(b))) for a, bs in GATJEUNJA.items() for b in bs}

    trad = collections.defaultdict(set)    # 간체 → 번체 목록
    jp_new = collections.defaultdict(set)  # 구자체 → 신자체
    pair_ev = collections.defaultdict(lambda: collections.defaultdict(set))
    for a, field, b, tag in links:
        a2, b2 = canon(a), canon(b)
        if field == "kTraditionalVariant":
            trad[a2].add(b2)
        if field == "kJapaneseNewVariant" and a2 != b2:
            jp_new[a2].add(b2)
        if a2 == b2 or a2 not in ch.set or b2 not in ch.set:
            continue
        if field not in LINK_FIELDS and field not in NOTED_FIELDS:
            continue
        key = tuple(sorted((a2, b2), key=ord))
        pair_ev[key][field].add((a2, b2, tag))
    # 보충 연결: Unihan kDefinition 이 다른 대상 글자를 "same as / variant of / … form of" 로 지목
    # (㥁→德, 䦞→閏 처럼 Variants 파일에 없는 이체 진술). 근거 이름은 "kDefinition".
    for c in ch.all:
        for r in sorted(ch.info[c]["def_refs"], key=ord):
            if r in ch.set and r != c:
                key = tuple(sorted((c, r), key=ord))
                pair_ev[key]["kDefinition"].add((c, r, ""))

    pairs, excluded = [], []
    for (a, b) in sorted(pair_ev, key=lambda k: (ord(k[0]), ord(k[1]))):
        ev = pair_ev[(a, b)]
        conf, reason, evidence = classify_pair(a, b, ev, ch, gat_pairs)
        rec = dict(a=a, b=b, fields=sorted(ev), **evidence)
        if conf:
            rec["confidence"] = conf
            pairs.append(rec)
        else:
            rec["reason"] = reason
            excluded.append(rec)

    # ---- 정자 판정 키
    def is_derived(c, members):
        others = set(members) - {c}
        simplified = bool(trad.get(c, set()) & others) and c not in trad.get(c, set())
        shinjitai = any(c in jp_new.get(o, set()) for o in others)
        # kDefinition 이 다른 구성원을 "same as/… form of" 로 가리키고, 그쪽은 이 글자를 가리키지 않음
        defined_as = any(o in ch.info[c]["def_refs"] and c not in ch.info[o]["def_refs"] for o in others)
        return simplified or shinjitai or defined_as

    def std_key(c, members, common_readings):
        info = ch.info[c]
        flag = min((FLAG_RANK[f] for f in info["flags"] if f in FLAG_RANK), default=3)
        rds = [r for r in info["readings"] if r in common_readings] or info["readings"]
        nav = min((naver.get((r, c), 999) for r in rds), default=999)
        return (flag, int(is_derived(c, members)), int(not info["gov"]), int(not info["core"]), -info["ks_readings"],
                nav, ord(c))

    basis_names = ["korean_standard", "direction", "gov_list", "core_s", "korean_readings", "naver_order", "codepoint"]

    def pick_standard(members):
        common = set.intersection(*(ch.info[c]["rset"] for c in members))
        keyed = sorted(members, key=lambda c: std_key(c, members, common))
        k0, k1 = std_key(keyed[0], members, common), std_key(keyed[1], members, common)
        idx = next(i for i in range(len(k0)) if k0[i] != k1[i])
        basis = basis_names[idx]
        detail = None
        if basis == "korean_standard":
            detail = "%s > %s" % (FLAG_LABEL[k0[0]], FLAG_LABEL[k1[0]])
        return keyed[0], basis, detail

    # ---- 단계별 묶음
    levels = ["high", "medium", "low"]
    nodes = ch.all
    groups, comp_by_level = [], {}
    for li, level in enumerate(levels):
        allowed = set(levels[:li + 1])
        edges = [(p["a"], p["b"]) for p in pairs if p["confidence"] in allowed]
        comps = connected(nodes, edges)
        comp_by_level[level] = comps
    gid_of = {}
    seen = {}
    counter = 0
    for li, level in enumerate(levels):
        allowed = set(levels[:li + 1])
        for comp in sorted(comp_by_level[level], key=lambda m: ord(m[0])):
            key = tuple(comp)
            if key in seen:  # 앞 단계와 구성이 같으면 새 묶음을 만들지 않는다
                gid_of[(level, key)] = seen[key]
                continue
            counter += 1
            gid = "V%04d" % counter
            seen[key] = gid
            gid_of[(level, key)] = gid
            mset = set(comp)
            gpairs = [p for p in pairs if p["a"] in mset and p["b"] in mset and p["confidence"] in allowed]
            includes = []
            if li > 0:
                for sub in comp_by_level[levels[li - 1]]:
                    if set(sub) <= mset:
                        includes.append(gid_of[(levels[li - 1], tuple(sub))])
            standard, basis, detail = pick_standard(comp)
            rad = {c: ch.info[c]["radical"] for c in comp}
            std_rad = rad[standard]["kn"] if rad[standard] else None
            diff_from_std = [c for c in comp if c != standard and rad[c] and std_rad is not None
                             and rad[c]["kn"] != std_rad]
            relation = sorted({f for p in gpairs for f in p["fields"] if f not in NOTED_FIELDS})
            noted = sorted({f for p in gpairs for f in p["fields"] if f in NOTED_FIELDS})
            g = dict(
                id=gid,
                confidence=level,
                members=comp,
                standard=standard,
                standard_basis=basis,
            )
            if detail:
                g["standard_basis_detail"] = detail
            if basis in ("naver_order", "codepoint"):
                g["standard_tie"] = True
            g["relation"] = relation
            if noted:
                g["noted_fields"] = noted
            g["radicals"] = {c: (dict(rad[c]) if rad[c] else None) for c in comp}
            g["radical_differs"] = len({r["kn"] for r in rad.values() if r}) > 1
            if diff_from_std:
                g["radical_differs_from_standard"] = diff_from_std
            g["readings"] = sorted(set.intersection(*(ch.info[c]["rset"] for c in comp)))
            g["glosses"] = {c: ch.info[c]["gloss"] for c in comp}
            if includes:
                g["includes"] = includes
            g["pairs"] = [dict(p) for p in gpairs]
            groups.append(g)

    # 글자별 색인: 단계마다 속한 묶음
    char_index = {}
    for level in levels:
        for comp in comp_by_level[level]:
            gid = gid_of[(level, tuple(comp))]
            for c in comp:
                char_index.setdefault(c, {})[level] = gid

    compat = {}
    for c in sorted(seo, key=ord):
        u = canon(c)
        if u != c:
            cv = uni.get(c, {}).get("kCompatibilityVariant", "")
            compat[c] = dict(cp=cp(c), canonical=u, canonical_cp=cp(u),
                             unihan_kCompatibilityVariant=cv,
                             canonical_in_target=u in seo,
                             readings=seo[c]["r"], canonical_readings=seo[u]["r"] if u in seo else [])

    gat = []
    for a, bs in sorted(GATJEUNJA.items()):
        for b in bs:
            x, y = chr(a), chr(b)
            if x in ch.set and y in ch.set:
                key = tuple(sorted((x, y), key=ord))
                gat.append(dict(numeral=x, gatjeunja=y, unihan_fields=sorted(pair_ev.get(key, {}))))

    cnt_pairs = collections.Counter(p["confidence"] for p in pairs)
    cnt_defonly = collections.Counter(p["confidence"] for p in pairs if p["fields"] == ["kDefinition"])
    cnt_excl = collections.Counter(p["reason"] for p in excluded)
    cnt_groups = collections.Counter(g["confidence"] for g in groups)
    in_high = sum(1 for c in char_index if "high" in char_index[c])
    rad_diff_high = sum(1 for g in groups if g["confidence"] == "high" and g["radical_differs"])
    basis_high = collections.Counter(g["standard_basis"] for g in groups if g["confidence"] == "high")

    meta = dict(
        description="인명용 한자(hanja-seo.json 키 9,190자) 안에서 서로 이체자인 묶음. 부수 기준 자원오행 전환 S1 산출물.",
        built_by="scripts/build_hanja_variants.py",
        sources=dict(
            target="frontend/src/data/hanja-seo.json (키 %d자, 통합 한자 기준 %d자)" % (len(seo), len(ch.all)),
            unihan=versions,
            naver_order="data/data-naver.csv (정자 판정 ⑥ 동률 깨기 전용)",
            radicals="data/hanja_radicals.json (판정 부수 — kangxi 필드 반영, 결과 파일 radical 과 같은 값)",
        ),
        rules=dict(
            normalization="호환 한자는 NFC 로 통합 한자에 붙인다. 묶음 구성원은 통합 한자, 호환 한자는 compat 절.",
            link_fields=list(LINK_FIELDS) + [
                "kDefinition (Unihan_Readings — 정의문이 다른 대상 글자를 'same as/variant of/… form of' 로 지목, 보충 연결)"],
            not_used_as_link=list(NOTED_FIELDS),
            direct_links_only="대상 글자끼리 직접 이어진 연결만 쓴다(대상 밖 글자를 거치지 않는다).",
            unihan_level={
                "U3": "kZVariant",
                "U2": "kJapaneseOld/NewVariant, kSemanticVariant<kHKGlyph, 출처가 kFenn·kCowles 만이 아닌 "
                      "kSemanticVariant(kSpecializedSemanticVariant 동반 없음), kDefinition 이 상대를 same as 등으로 지목",
                "U1": "kSemanticVariant 출처가 kFenn·kCowles 뿐이거나 kSpecializedSemanticVariant 동반",
                "T": "kTraditional/kSimplifiedVariant 만",
            },
            korean_level={
                "K2": "대표 훈(첫 훈)이 같다(공백 무시, 2음절 이상이면 포함 관계 인정)",
                "K1": "훈이 일부 겹치거나 한쪽 훈 자료가 없다",
                "K0": "독음만 겹친다",
                "none": "독음이 겹치지 않으면 제외",
            },
            confidence_matrix={
                "U3": {"K2": "high", "K1": "high", "K0": "high"},
                "U2": {"K2": "high", "K1": "medium", "K0": "low (kHKGlyph 이면 medium)"},
                "U1": {"K2": "medium (영문 뜻풀이 자카드 0.5 이상이면 high)", "K1": "low", "K0": "제외"},
                "T": {"K2": "medium (영문 뜻풀이 자카드 0.5 이상이면 high)", "K1": "제외(간화 병합)",
                      "K0": "제외(간화 병합)"},
            },
            exclusions={
                "gatjeunja": "갖은자(大寫數字) 표에 있는 쌍 — 뜻만 같은 다른 글자",
                "specialized_semantic_only": "kSpecializedSemanticVariant 만 — 특정 문맥에서만 같은 뜻",
                "specialized_semantic": "kSemanticVariant+kSpecializedSemanticVariant 인데 훈이 안 겹침",
                "spoofing_only": "kSpoofingVariant 만",
                "reading_mismatch": "한국 독음이 하나도 겹치지 않음",
                "simplification_merger": "간번체 대응만 있고 대표 훈이 다름(간화 병합)",
                "weak_link_gloss_differs": "약한 의미 이체 연결인데 훈이 안 겹침",
            },
            groups="신뢰도 단계별 연결 성분. high 묶음은 high 쌍만으로, medium 묶음은 high+medium 쌍으로 이은 "
                   "성분 가운데 high 묶음과 구성이 다른 것, low 도 같은 방식. includes 는 포함한 한 단계 아래 묶음.",
            use="배지('X의 이체자')·독음 목록 묶기는 confidence=high 묶음만 쓴다. medium·low 는 검토 후보"
                "(통용자·간화 병합·신자체 전용 글자가 섞인다: 佑/祐, 予/豫, 台/臺).",
            char_index="글자 → {단계: 그 단계에서 속한 묶음 id}. 묶음 구성이 앞 단계와 같으면 앞 단계 id 를 그대로 "
                       "가리킨다(그 묶음의 confidence 는 앞 단계 값). 조회 전에 NFC 정규화할 것(compat 절).",
            group_fields="members(통합 한자, 코드포인트 순)·standard·standard_basis(·_detail·standard_tie)·"
                         "relation(묶음 안 쌍들을 이은 근거 필드 합집합)·noted_fields(함께 실린 kSpecializedSemanticVariant·"
                         "kSpoofingVariant — 연결 근거 아님)·radicals·radical_differs(·_from_standard)·"
                         "readings(구성원 공통 독음)·glosses(hanja-seo 훈)·includes·pairs(쌍별 근거 u·k·fields)",
            standard_order=[
                "korean_standard: kHangul 표지 E(교육용) > 0(KS X 1001) > 1(KS X 1002) > N(인명용)·없음",
                "direction: 간체 쪽·일본 신자체 쪽·kDefinition 이 다른 구성원을 same as 로 가리키는 쪽이 아닌 글자",
                "gov_list: 대법원 인명용 한자표(hanja-seo gov) 수록",
                "core_s: 검수 S(hanja_core_v1) 수록",
                "korean_readings: kHangul 에서 E·0·1 표지가 붙은 독음 수가 많은 쪽(琉 > 瑠, 拏 > 拿)",
                "naver_order: data-naver.csv 독음별 순서",
                "codepoint: 코드포인트 순",
            ],
            standard_tie="standard_basis 가 naver_order·codepoint 이면 standard_tie=true(근거가 약함). "
                         "화면(S7)은 이 묶음에 '이체자' 배지·정자 링크를 달지 않는다(사람 확인 전)",
            radical="자원오행 판정 부수의 강희 번호 kn 과 부수 글자 k(data/hanja_radicals.json kangxi 가 있으면 그 값, 없으면 "
                    "kRSUnicode 첫 값 — 결과 파일 hanja_resource_element.json radical 과 같다). alt = 판정 부수와 다른 "
                    "kRSUnicode 값의 부수, krs_first = 첫 값이 판정 부수와 다를 때 첫 값. 계획 D6: 오행은 쓴 꼴의 부수를 "
                    "따르고, 정자와 부수가 다르면 정자 값을 병기한다 → radical_differs·radical_differs_from_standard",
            known_gaps="Unihan 18.0 에 이체 연결이 없어 묶지 않은 한국형·중일형 자형 쌍과 옥편 同字. 두 꼴의 부수가 같아 "
                       "오행 값은 같고, '이체자' 배지·독음 목록 묶기에서만 빠진다. 수동 보충은 S7 전 사람 검수 후보",
            gatjeunja="갖은자 쌍은 묶음에서 빼고 gatjeunja 절에 따로 둔다(화면에서 '갖은자' 라벨용).",
        ),
        counts=dict(
            pairs=dict(sorted(cnt_pairs.items())),
            pairs_kDefinition_only=dict(sorted(cnt_defonly.items())),
            excluded_pairs=dict(sorted(cnt_excl.items())),
            groups=dict(sorted(cnt_groups.items())),
            chars_in_high_groups=in_high,
            high_groups_radical_differs=rad_diff_high,
            high_groups_standard_basis=dict(sorted(basis_high.items())),
            compat=len(compat),
        ),
    )
    gaps = []
    for a, b in KNOWN_GAP_PAIRS:
        x, y = chr(a), chr(b)
        if x not in ch.set or y not in ch.set:
            raise SystemExit("known_gaps 쌍이 대상 밖: %s %s" % (cp(x), cp(y)))
        if char_index.get(x, {}).get("high") and char_index.get(x, {}).get("high") == char_index.get(y, {}).get("high"):
            raise SystemExit("known_gaps 쌍이 이미 high 묶음에 있다 — 목록을 갱신할 것: %s %s" % (x, y))
        ra, rb = ch.info[x]["radical"], ch.info[y]["radical"]
        gaps.append(dict(pair=[x, y], cps=[cp(x), cp(y)],
                         unihan_link=sorted(pair_ev.get(tuple(sorted((x, y), key=ord)), {})),
                         same_radical=bool(ra and rb and ra["kn"] == rb["kn"]),
                         in_groups={c: char_index.get(c, {}) for c in (x, y)}))
    meta["known_gaps"] = gaps
    out = dict(meta=meta, groups=groups, char_index={c: char_index[c] for c in sorted(char_index, key=ord)},
               compat=compat, gatjeunja=gat, excluded_pairs=excluded)
    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("pairs", dict(sorted(cnt_pairs.items())))
    print("excluded", dict(sorted(cnt_excl.items())))
    print("groups", dict(sorted(cnt_groups.items())), "chars in high groups", in_high,
          "high groups w/ radical diff", rad_diff_high)
    print("high standard basis", dict(sorted(basis_high.items())))
    print("compat", len(compat), "gatjeunja pairs", len(gat))
    print("written", os.path.relpath(OUT_PATH, ROOT), os.path.getsize(OUT_PATH), "bytes")


if __name__ == "__main__":
    main()
