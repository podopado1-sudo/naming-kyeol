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


def appears(kw, kind, text):
    """키워드가 문장에 '그 뜻으로' 나타나는지. 1음절 명사는 단어 경계 규칙을 둔다
    (나→빛나는, 중→중심, 형→형통, 뜻→따뜻한 오탐 차단)."""
    if len(kw) >= 2 or kind == "adj":
        return kw in text  # 다음절 명사(연꽃·으뜸)·어간(맑·빛나)은 부분 문자열로 충분
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
            if self.hanja[ch].get("g") in ("S", "A"):
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
