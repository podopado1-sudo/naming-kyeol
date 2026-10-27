# -*- coding: utf-8 -*-
"""
/name 대표 뜻(mean)·서사(story) 문장 ↔ 표시 한자 조합(combos) 모순 판정 — 공용 모듈.

build_name_seo_data.py(모순 뜻 → 1순위 조합 뜻 폴백)와 audit_mean_combo_mismatch.py(전수 감사)가
같은 규칙을 쓰도록 여기 한 곳에 둔다.

배경: mean은 data/creative-name-meanings.json(2026-06 LLM 윤문)에서 오는데, 그때 입력은 그 시점
엔진이 고른 음절별 대표 한자의 훈이었다. 이후 weak 감점·대표 훈 오버라이드·빈출 셋이 바뀌어 combos가
달라지면 "연꽃처럼…"(蓮) 아래 然佑, "비 온 뒤…"(雨) 아래 佑晶이 뜨는 식의 모순이 남는다.

판정(음절 위치별):
  - 그 음절로 읽히는 S·A등급 한자 + 표시 한자마다 '그 독음의 훈'에서 키워드를 뽑는다.
      noun: 구체 명사 훈(비·연꽃·바다·으뜸) — 문장에 나오면 그 한자의 뜻이라고 단정할 수 있다.
      adj : 형용사·동사 훈의 어간(맑을→맑, 빛날→빛나) — '밝고'·'맑은'은 동음 한자 여럿이 공유하는
            흔한 수식어라 단정할 수 없다(감사에서 참고로만 센다).
  - 문장에 키워드가 걸린 한자 집합 M이 비어 있지 않은데
      strict: M ∩ (그 위치의 표시 한자 전부) = ∅   → 페이지에 없는 한자의 뜻을 말한다(모순)
      top1  : M ∌ combos[0]의 그 위치 한자          → 1순위 조합과 어긋난다(2~4순위엔 있을 수 있음)
"""
import re

# 1음절 명사 훈 뒤에 올 수 있는 조사·어미 첫 글자(비처럼·비가·비의·비를·비와·비로·비에·비 같은…)
PARTICLE_HEADS = set("처가를의와로에도는은같속")
# 1음절 명사 앞에 붙어 합성어를 이루는 글자(단비·봄비·샛별·밤별·꽃비)
COMPOUND_PREFIX = set("단봄샛밤꽃")
# 너무 흔해서 어느 한자의 훈인지 가릴 수 없는 키워드.
# 해(歲 '해 세'=년)는 '향해·위해'와 '해처럼(태양)'에 걸려 歲의 뜻으로 단정 불가.
STOP_KEYWORDS = {"클", "큰", "크", "좋", "많", "높", "날", "할", "될", "있", "이", "하", "해", "사람", "것", "이름"}

HANGUL_BASE, JONG = 0xAC00, 28
_SPLIT = re.compile(r"[,/;·]")


def is_hangul(ch):
    return 0xAC00 <= ord(ch) <= 0xD7A3


def jong(ch):
    return (ord(ch) - HANGUL_BASE) % JONG if is_hangul(ch) else -1


def with_jong(ch, j):
    return chr(ord(ch) - jong(ch) + j)


def segments_for_reading(m, syl):
    """'연꽃 련(연), 그럴 연' 같은 뜻 문자열에서 독음이 syl인 훈 조각의 훈 부분만."""
    out = []
    for seg in _SPLIT.split(m or ""):
        seg = seg.strip()
        mm = re.match(r"^(.*\S)\s+([^\s(]+)(?:\(([^)]+)\))?$", seg)
        if mm and syl in (mm.group(2), mm.group(3)):
            out.append(mm.group(1))
    return out


def keywords_of(hun):
    """훈 하나 → [(키워드, 'noun'|'adj')]."""
    hun = re.sub(r"\(.*?\)", "", hun).strip()
    words = hun.split()
    if not words:
        return []
    last = words[-1]
    if not all(is_hangul(c) for c in last):
        return []
    tail = last[-1]
    if len(last) == 1:
        kind, kw = "noun", last  # 비·골·별·달 — 1음절 ㄹ받침 훈은 명사로 본다(갈·날 동사는 보류)
    elif jong(tail) == 8 and not (tail == "을" and jong(last[-2]) == 0):
        # ㄹ 받침 = 관형형(맑을·도울·빛날·그럴). 단 '받침 없는 음절+을'(고을·마을·가을)은 명사.
        kind = "adj"
        kw = last[:-1] if tail == "을" else last[:-1] + with_jong(tail, 0)
    else:
        kind, kw = "noun", last
    if kw in STOP_KEYWORDS or (kind == "adj" and len(kw) == 1 and jong(kw) == 0):
        return []  # 1음절 받침 없는 어간(가·나·오)은 어디에나 걸린다
    return [(kw, kind)]


def adj_forms(kw):
    """형용사·동사 어간 키워드 → 문장에서 찾을 꼴. 'ㅂ 불규칙' 훈(아름다울·고울·즐거울·가벼울·새로울·날카로울 …)은
    keywords_of 가 '아름다우'로 잡는데 문장에는 아름다운·아름다움·아름다워·아름답게로 나와 그 꼴을 더한다(2026-10-27 —
    언 26명의 대표 뜻·서사가 嫣 '아리따울' 기준인데 표시 조합에서 嫣 이 빠져도 잡지 못했다).
    '…우'로 끝나는 어간: X우 → X운·X움·X워·X와(고와·도와) + 받침 ㅂ 꼴(X답·곱). 세우·키우 같은 '우' 동사도 X운·X움이 맞는 활용형이고,
    받침 ㅂ 꼴(셉·킵)은 문장에 거의 나오지 않아 따로 가르지 않는다.
    받침 없는 어간 끝 음절에는 ㄴ·ㄹ 받침 꼴을 더한다(2026-10-27 검증): keywords_of 는 'X+ㄹ' 관형형에서 ㄹ 을 떼므로
    ㄹ 어간(어질 → '어지', 가늘 → '가느')은 어질고·어진·가는에 걸리지 않았다(仁 이 빠진 여자 인 17명의 '어진' 뜻).
    하 어간(형통하·넉넉하·고요하)은 X한·X히·X해·X함 꼴이 문장에 나온다(亨 이 빠진 형 페이지의 '형통한'·'형통히').
    반환 (꼴 목록, 낱말 첫머리에서만 셀 꼴 목록) — 2음절 어간의 ㄴ·ㄹ 꼴은 다른 낱말 속에 흔해(가느 → 가는 ⊂ 살아가는,
    하느 → 하는 ⊂ 승리하는) 앞 글자가 한글이 아닐 때만 센다."""
    forms, edge = [kw], []
    if len(kw) >= 2 and kw[-1] == "우":
        stem = kw[:-1]
        forms += [stem + "운", stem + "움", stem + "워", stem + "와"]
        if is_hangul(stem[-1]) and jong(stem[-1]) == 0:
            forms.append(stem[:-1] + with_jong(stem[-1], 17))  # ㅂ 받침(아름다 → 아름답, 고 → 곱)
    if len(kw) >= 2 and is_hangul(kw[-1]) and jong(kw[-1]) == 0:
        nl_forms = [kw[:-1] + with_jong(kw[-1], 4), kw[:-1] + with_jong(kw[-1], 8)]  # ㄴ·ㄹ 받침(어지 → 어진·어질, 가느 → 가는·가늘)
        (forms if len(kw) >= 3 else edge).extend(nl_forms)
    if len(kw) >= 3 and kw[-1] == "하":
        forms += [kw[:-1] + t for t in ("히", "해", "함")]  # 하 어간(형통하 → 형통히·형통해·형통함; 형통한은 ㄴ 받침 꼴)
    return forms, edge


def appears(kw, kind, text):
    """키워드가 문장에 '그 뜻으로' 나타나는지. 1음절 명사는 단어 경계 규칙을 둔다
    (나→빛나는, 중→중심, 형→형통, 뜻→따뜻한 오탐 차단)."""
    if kind == "adj":
        forms, edge = adj_forms(kw)  # 어간(맑·빛나·아름다우)은 부분 문자열로 충분 — ㅂ 불규칙·ㄹ·하 어간은 활용형도
        if any(f in text for f in forms):
            return True
        return any(m.start() == 0 or not is_hangul(text[m.start() - 1])
                   for f in edge for m in re.finditer(re.escape(f), text))
    if len(kw) >= 2:
        return kw in text  # 다음절 명사(연꽃·으뜸)는 부분 문자열로 충분
    if jong(kw) == 0 and with_jong(kw, 19) in text:
        return True  # 사이시옷형(비→빗: 빗속·빗방울)
    for i, ch in enumerate(text):
        if ch != kw:
            continue
        prv = text[i - 1] if i > 0 else " "
        nxt = text[i + 1] if i + 1 < len(text) else " "
        starts = not is_hangul(prv) or prv in COMPOUND_PREFIX
        ends = not is_hangul(nxt) or nxt in PARTICLE_HEADS
        if starts and ends:
            return True
    return False


def is_core(rec):
    """hanja-seo.json 레코드가 Core 데이터(코어 2,054자)인지 — 새 형식은 c == 1, 옛 형식은 옛 등급 g ∈ {S, A}.
    2026-10-22 S4: g 가 부수 기준 자원오행 등급(R·V·X·U)이 되어 옛 'S=검수' 판정을 c 로 옮겼다(옛 S ⇔ Core, 같은 집합).
    새 형식에서 g 는 S·A 가 될 수 없으므로 두 형식을 한 줄로 받는다."""
    return rec.get("c") == 1 or rec.get("g") in ("S", "A")


class HanjaIndex:
    """hanja-seo.json(frontend/src/data) 위의 독음 색인 + 훈 키워드 캐시."""

    def __init__(self, hanja_seo):
        self.hanja = hanja_seo
        self.by_reading = {}
        for ch, rec in hanja_seo.items():
            for rd in rec.get("r", []):
                self.by_reading.setdefault(rd, []).append(ch)
        self._kw = {}

    def keywords(self, ch, syl):
        """그 독음의 훈 + 첫 훈 키워드. 첫 훈을 더하는 이유: 6월 윤문 입력(BuildMechanicalMeaning)은
        독음과 무관하게 첫 훈을 썼다 — 예정의 "아이처럼"은 兒 "아이 아, 어릴 예"의 첫 훈('아' 소리)에서 왔다."""
        key = (ch, syl)
        if key not in self._kw:
            m = (self.hanja.get(ch) or {}).get("m", "")
            huns = segments_for_reading(m, syl)
            first = _SPLIT.split(m)[0].strip()
            mm = re.match(r"^(.*\S)\s+\S+$", first)
            if mm:
                huns.append(mm.group(1))
            kws = []
            for hun in huns:
                kws += keywords_of(hun)
            self._kw[key] = sorted(set(kws))
        return self._kw[key]

    def candidates(self, syl, shown):
        out = set(shown)
        for ch in self.by_reading.get(syl, []):
            if is_core(self.hanja[ch]):
                out.add(ch)
        return out


def find_mismatches(name, text, combos, idx, kinds=("noun", "adj")):
    """문장(text)이 combos와 어긋나는 음절 위치 목록.
    반환: [{pos, syl, kind, hits{한자:[키워드]}, shown[], strict, top1}] — strict/top1 중 하나라도 참인 것만."""
    out = []
    if len(name) != 2 or not combos or not text:
        return out
    for pos in (0, 1):
        syl = name[pos]
        shown = [c[pos] for c in combos]
        for kind in kinds:
            hits = {}
            for ch in idx.candidates(syl, shown):
                found = [k for k, kd in idx.keywords(ch, syl) if kd == kind and appears(k, kd, text)]
                if found:
                    hits[ch] = found
            if not hits:
                continue
            strict = not (set(hits) & set(shown))
            top1 = combos[0][pos] not in hits
            if strict or top1:
                out.append({"pos": pos, "syl": syl, "kind": kind, "hits": hits,
                            "shown": shown, "strict": strict, "top1": top1})
    return out


def stale_keywords(name, text, combos, idx):
    """모순 확정(noun·strict) 키워드 집합 — 비어 있으면 모순 아님."""
    return {k for m in find_mismatches(name, text, combos, idx, kinds=("noun",)) if m["strict"]
            for ks in m["hits"].values() for k in ks}


def _self_test():
    """python -I -X utf8 scripts/mean_combo_check.py — ㅂ 불규칙 어간 꼴과 기존 규칙 회귀 확인(실패하면 AssertionError)."""
    assert keywords_of("아름다울") == [("아름다우", "adj")]
    for text in ("아름다운 사람", "아름다움을 지닌", "아름답게 피어나는", "아름다워 보이는"):
        assert appears("아름다우", "adj", text), text
    assert keywords_of("고울") == [("고우", "adj")]
    for text in ("곱게 자란", "고운 마음", "고와서"):
        assert appears("고우", "adj", text), text
    for kw, text in (("즐거우", "즐거운 웃음"), ("가벼우", "가볍게 날아오르는"), ("무거우", "무거움"),
                     ("새로우", "새롭게 시작하는"), ("날카로우", "날카로운 눈빛")):
        assert appears(kw, "adj", text), (kw, text)
    assert keywords_of("어질") == [("어지", "adj")] and keywords_of("가늘") == [("가느", "adj")]
    for kw, text in (("어지", "빼어나게 어질고 너그러운"), ("어지", "바다처럼 넓고 어진"), ("가느", "부드럽고 가는 결"),
                     ("형통하", "모든 일이 뜻대로 형통한"), ("형통하", "제 길을 형통히 걷는"), ("넉넉하", "넉넉한 복록")):
        assert appears(kw, "adj", text), (kw, text)
    assert not appears("어지", "adj", "맑고 너그러운") and not appears("형통하", "adj", "형제처럼")
    assert not appears("가느", "adj", "묵묵히 살아가는 사람") and not appears("하느", "adj", "당당하게 승리하는")
    assert not appears("아름다우", "adj", "맑고 밝은")
    assert appears("맑", "adj", "맑은 물") and appears("빛나", "adj", "빛나는")  # 기존 어간 그대로
    assert not appears("비", "noun", "비밀") and appears("비", "noun", "비처럼")  # 1음절 명사 경계 그대로
    print("mean_combo_check self-test OK")


if __name__ == "__main__":
    _self_test()
