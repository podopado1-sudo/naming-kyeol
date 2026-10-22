"""인명용 한자 9,190자의 강희 부수를 Unihan kRSUnicode 에서 뽑는다 (자원오행 전환 S1).

    python -I scripts/extract_hanja_radicals.py        # 인자 없음, 다시 돌려도 같은 결과

입력 (읽기만 한다)
  - tmp/unihan-18.0/Unihan_IRGSources.txt   kRSUnicode·kTotalStrokes (unicode.org 공식 18.0, 2026-07-31)
  - tmp/unihan-18.0/Unihan.zip              안의 Unihan_DictionaryIndices.txt kKangXi (강희자전 배열 확인용)
  - data/hanja_dictionary_final.json         대상 글자 = 등재 한자 키 9,190자(통합 9,105 + 호환 85 — scripts/hanja_target_set.py)
  - Application/Engines/Data/HanjaData.cs    백엔드 로드 집합(하드코딩 + 사전, 호환 병합)을 재구성해 대상과 같은지 대조만 한다
  - frontend/src/data/hanja-seo.json         있으면 키 대조만(옛 9,190 형식·새 9,105 형식 둘 다 통과 — 2026-10-22 S4 전까지는 대상이었다)

출력
  - data/hanja_radicals.json   글자 → {radical, residual, simplified, alts, radical_char}
  - data/kangxi_radicals.json  {meta, first_value_vs_uro_order: [...],
                                radicals: 번호 → {char, kangxi_cp, strokes, variants,
                                                         simplified, simplified_other, n_chars, note?}}

hanja_radicals.json 규약
  - radical      강희 부수 번호(1~214). kRSUnicode 의 **첫 값**이다(원자료 그대로).
                 ⚠️ 자원오행 판정에 쓰는 부수는 kangxi 필드가 있으면 그 값이다. S4·S7 은 부수 번호·글자를 이 파일이 아니라
                 data/hanja_resource_element.json 의 radical·radical_char 에서 읽는다(그 파일이 kangxi 판정을 반영한 최종값).
                 UAX #38(rev 41, Unicode 18.0)은 kRSUnicode 를 "표준 부수·획수"로 정의하고, 한 글자를
                 여러 부수로 분류할 수 있거나 획수 산법이 갈릴 때 추가 색인을 덧붙인다. 그래서 첫 값을
                 대표로 쓰고 둘째 이후는 alts 에 원래 순서대로 남긴다.
                 주의: 이 속성은 CLDR 정렬용이라 첫 값이 원 코드 차트 배열(강희 214부수 순 — 옥편 계열
                 작명 사이트 부수 표기와 같은 쪽)과 다른 글자가 있다
                 (18.0 기준 대상 중 13자 — 墨 203黑/32土, 章·竟 180音/117立, 萬 114禸/140艸 등.
                 12자는 원 코드 차트 배열 부수가 alts 에 있고 壡만 없다). 목록은 kangxi_radicals.json 의
                 first_value_vs_uro_order(각 항목 used = 판정에 쓴 부수).
  - kangxi       첫 값이 강희자전 배열과 어긋나 판정 부수를 옮긴 글자에만 있다:
                 {radical, radical_char, kangxi_page, basis}. 판정은 scripts/kangxi_radical_order.py 하나가 맡는다
                 (부수표 스크립트와 같은 함수 — kRSUnicode 값·URO 배열 부수 후보 중 kKangXi 쪽수에 맞는 쪽).
                 basis "krs_value" = kRSUnicode 둘째 이후 값(萬 禸→艸 등 12자), "uro_order" = kRSUnicode 에 없는
                 원 코드 차트 배열 부수(壡 又→土).
  - residual     나머지 획수. 음수일 수 있다(王 = 96.-1 — 부수 玉 5획에서 획을 덜어 낸 꼴).
  - simplified   부수 번호 뒤 아포스트로피 그대로. ""(없음) · "'"(중국 간화 부수) ·
                 "''"(중국 밖 간화 부수, 일본 신자체 등) · "'''"(두 번째 중국 밖 간화 부수) — UAX #38.
  - alts         둘째 이후 값. 항목마다 {radical, residual, simplified, radical_char}.
  - radical_char 214부수 표준형(강희 부수 글자 U+2F00 블록을 NFKC 로 푼 통합 한자). 氵·扌 같은 변형이
                 아니라 水·手. 변형은 kangxi_radicals.json 의 variants 에 원형 번호로 묶는다.
  - 호환 한자(U+F900~FAFF·U+2F800~)도 대상 키 그대로 두고 그 글자 자신의 kRSUnicode 를 싣는다.
    통합 한자 쪽 값과 다를 수 있다(18.0: 墨 U+FA3A 32 / U+58A8 203, 視 U+FA61 147 / U+8996 113).

이 파일은 오행을 정하지 않는다(부수 → 오행은 다음 단계 부수표가 맡는다). 작명 사이트 DB 값은 읽지 않는다.
소스에 호환 한자를 글자로 쓰지 않는다 — 글자 표는 모두 코드포인트 정수다.
"""
from __future__ import annotations

import bisect
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

sys.dont_write_bytecode = True  # 공용 판정 모듈을 불러도 scripts/__pycache__ 를 만들지 않는다
sys.path.insert(0, str(Path(__file__).resolve().parent))
import kangxi_radical_order  # noqa: E402  (scripts/kangxi_radical_order.py — 부수표 스크립트와 같은 판정)
import hanja_target_set  # noqa: E402  (scripts/hanja_target_set.py — 세 S1 스크립트의 대상 글자 집합)

ROOT = Path(__file__).resolve().parent.parent
IRG = ROOT / "tmp" / "unihan-18.0" / "Unihan_IRGSources.txt"
UNIHAN_ZIP = ROOT / "tmp" / "unihan-18.0" / "Unihan.zip"
DICT_FINAL = ROOT / "data" / "hanja_dictionary_final.json"
HANJA_DATA_CS = ROOT / "Application" / "Engines" / "Data" / "HanjaData.cs"
OUT_CHARS = ROOT / "data" / "hanja_radicals.json"
OUT_TABLE = ROOT / "data" / "kangxi_radicals.json"

EXPECTED_UNICODE = "18.0.0"
EXPECTED_TARGET = 9190
KANGXI_BLOCK = 0x2F00  # U+2F00 KANGXI RADICAL ONE … U+2FD5 KANGXI RADICAL FLUTE

RS_TOKEN = re.compile(r"^([1-9]\d{0,2})('{0,3})\.(-?\d{1,2})$")  # UAX #38 kRSUnicode 문법

# 강희 214부수의 획수: 번호 구간의 시작 번호 → 획수 (강희자전 부수 배열 그대로)
STROKE_STARTS = [
    (1, 1), (7, 2), (30, 3), (61, 4), (95, 5), (118, 6), (147, 7), (167, 8), (176, 9),
    (187, 10), (195, 11), (201, 12), (205, 13), (209, 14), (211, 15), (212, 16), (214, 17),
]
# Unihan kTotalStrokes(현대 획수)가 강희 배열 획수와 다른 부수 글자 — 알려진 것만 허용
STROKE_MISMATCH_OK = {114}  # 禸: 강희 배열 5획, kTotalStrokes 4

# 변형 부수(위치·꼴 변형). 원형과 같은 번호다. 코드포인트 정수로만 적는다.
# 통합 한자는 kRSUnicode 첫 값이 그 번호여야 하고(VARIANT_RADICAL_OK 제외), U+2E80~2EFF 는
# 부수 보충 블록 글자라 Unihan 값이 없으므로 블록만 확인한다.
VARIANTS: dict[int, list[int]] = {
    5: [0x4E5A],                            # 乚
    9: [0x4EBB, 0x201A2],                   # 亻 𠆢
    18: [0x5202],                           # 刂
    26: [0x353E],                           # 㔾
    43: [0x5C23],                           # 尣
    47: [0x5DDD, 0x5DDC],                   # 川 巜
    58: [0x5F51],                           # 彑
    61: [0x5FC4, 0x2E97, 0x38FA],           # 忄 ⺗ 㣺
    63: [0x6237, 0x6238],                   # 户 戸
    64: [0x624C],                           # 扌
    66: [0x6535],                           # 攵
    71: [0x65E1],                           # 旡
    78: [0x6B7A],                           # 歺
    80: [0x6BCD],                           # 母
    85: [0x6C35, 0x6C3A],                   # 氵 氺
    86: [0x706C],                           # 灬
    87: [0x722B],                           # 爫
    93: [0x725C],                           # 牜
    94: [0x72AD],                           # 犭
    96: [0x738B, 0x2EA9],                   # 王 ⺩
    103: [0x2EAA],                          # ⺪
    113: [0x793B],                          # 礻
    118: [0x2EAE, 0x25AD7],                 # ⺮ 𥫗
    120: [0x7CF9],                          # 糹
    122: [0x7F52, 0x7F53, 0x2EB2, 0x2EB3],  # 罒 罓 ⺲ ⺳
    123: [0x2EB6, 0x2EB7, 0x2634C],         # ⺶ ⺷ 𦍌
    125: [0x8002],                          # 耂
    129: [0x8080, 0x2EBB],                  # 肀 ⺻
    130: [0x2EBC],                          # ⺼ (육달월)
    140: [0x8279, 0x2EBE, 0x2EBF, 0x2EC0],  # 艹 ⺾ ⺿ ⻀
    145: [0x8864],                          # 衤
    146: [0x897F, 0x8980],                  # 西 覀
    149: [0x8A01],                          # 訁
    157: [0x27FB7],                         # 𧾷
    162: [0x8FB6, 0x2ECC, 0x2ECD],          # 辶 ⻌ ⻍
    163: [0x961D, 0x2ECF],                  # 阝(오른쪽) ⻏
    167: [0x91D2],                          # 釒
    168: [0x9578],                          # 镸
    170: [0x961D, 0x2ED6],                  # 阝(왼쪽) ⻖
    174: [0x9752],                          # 青
    176: [0x9763],                          # 靣
    184: [0x98E0],                          # 飠
    189: [0x9AD9],                          # 髙
    201: [0x9EC4],                          # 黄
    203: [0x9ED2],                          # 黒
    207: [0x9F14],                          # 鼔
}
# 첫 값이 그 번호가 아니어도 되는 변형: 阝 글자 자체는 Unihan 에서 170(阜)이지만 오른쪽 阝는 163(邑)
VARIANT_RADICAL_OK = {(163, 0x961D)}

NOTES = {
    47: "강희 부수 글자는 巛. 川은 같은 부수의 변형(Unihan 47.0).",
    74: "月(달 월)은 74. 月 꼴로 쓰는 육달월 ⺼은 130(肉)이다.",
    96: "王(구슬옥변)은 玉의 변형. 글자 王 자체도 Unihan 96.-1.",
    114: "강희 배열은 5획 부수, Unihan kTotalStrokes 는 4.",
    130: "⺼(육달월)은 月 꼴이지만 肉(130)이다. 달 월 月(74)과 다르다.",
    163: "阝가 글자 오른쪽이면 邑(163, 우부방), 왼쪽이면 阜(170, 좌부변). Unihan 은 阝 글자 자체를 170 으로 둔다.",
    170: "阝가 글자 왼쪽이면 阜(170, 좌부변), 오른쪽이면 邑(163).",
    201: "黄은 黃의 이체(Unihan 201.0 201'.0 — 간화 표시 값도 함께 있다).",
}


def is_han_code_point(cp: int) -> bool:
    """백엔드 HanjaData.IsHanCodePoint 와 같은 영역 규칙."""
    return (0x3400 <= cp <= 0x4DBF or 0x4E00 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF
            or 0x20000 <= cp <= 0x2EBEF or 0x2F800 <= cp <= 0x2FA1F or 0x30000 <= cp <= 0x323AF)


def is_compat(cp: int) -> bool:
    return 0xF900 <= cp <= 0xFAFF or 0x2F800 <= cp <= 0x2FA1F


def radical_strokes(n: int) -> int:
    s = 0
    for start, strokes in STROKE_STARTS:
        if n >= start:
            s = strokes
    return s


def load_irg() -> tuple[dict, dict[int, str], dict[int, str]]:
    header: dict[str, str] = {}
    rs: dict[int, str] = {}
    ts: dict[int, str] = {}
    with IRG.open(encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("#"):
                m = re.match(r"# (Unicode Version|Date):? (.+)$", line)
                if m:
                    header[m.group(1)] = m.group(2).strip()
                continue
            if not line:
                continue
            cp_s, field, value = line.split("\t")
            cp = int(cp_s[2:], 16)
            if field == "kRSUnicode":
                rs[cp] = value
            elif field == "kTotalStrokes":
                ts[cp] = value
    return header, rs, ts


def parse_rs(value: str) -> list[tuple[int, str, int]]:
    out = []
    for tok in value.split(" "):
        m = RS_TOKEN.match(tok)
        if not m:
            raise ValueError(f"kRSUnicode 문법 밖: {value!r}")
        n = int(m.group(1))
        if not 1 <= n <= 214:
            raise ValueError(f"부수 번호 범위 밖: {value!r}")
        out.append((n, m.group(2), int(m.group(3))))
    return out


def backend_load_set(final: dict) -> set[str]:
    """HanjaData.LoadFromFinalJson 의 키 집합을 데이터 파일로 재구성한다(대조용).
    2026-10-22 S2 부터 수록 범위 = 사전(core_v1·Unihan 로더는 보강만)이고 호환 한자는 통합 한자에 병합된다 → 통합 집합."""
    keys: set[str] = set()
    src = HANJA_DATA_CS.read_text(encoding="utf-8")
    start = src.index("_detailedHanjaDictionary = new()")
    block = src[start:src.index("};", start)]
    keys.update(re.findall(r'\{\s*"([^"]+)",\s*new HanjaInfo', block))
    keys.update(k for k in final if len(k) == 1 and is_han_code_point(ord(k)))
    return {hanja_target_set.to_unified(k) for k in keys}


def u(cp: int) -> str:
    return f"U+{cp:04X}"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")

    header, rs, ts = load_irg()
    version = header.get("Unicode Version")
    if version != EXPECTED_UNICODE:
        print(f"[중단] Unihan 버전 {version!r} — {EXPECTED_UNICODE} 을 기대했다")
        return 1
    sha = hashlib.sha256(IRG.read_bytes()).hexdigest()
    sha_zip = hashlib.sha256(UNIHAN_ZIP.read_bytes()).hexdigest()
    used, moved, _ = kangxi_radical_order.kangxi_radicals(str(IRG), str(UNIHAN_ZIP))

    # ── 214부수 표준형 ─────────────────────────────────────────────
    rad_char: dict[int, str] = {}
    for n in range(1, 215):
        ch = unicodedata.normalize("NFKC", chr(KANGXI_BLOCK + n - 1))
        cp = ord(ch)
        if len(ch) != 1 or not (0x4E00 <= cp <= 0x9FFF) or is_compat(cp):
            raise SystemExit(f"[중단] 부수 {n} 표준형이 통합 한자가 아니다: {ch!r}")
        first = parse_rs(rs[cp])[0]
        if first[:2] != (n, "") or first[2] != 0:
            raise SystemExit(f"[중단] 부수 {n} {ch} 의 kRSUnicode 가 {rs[cp]}")
        kts = int(ts[cp].split(" ")[0])
        if kts != radical_strokes(n) and n not in STROKE_MISMATCH_OK:
            raise SystemExit(f"[중단] 부수 {n} {ch} 획수 {radical_strokes(n)} ≠ kTotalStrokes {kts}")
        rad_char[n] = ch

    # ── 대상 글자 ─────────────────────────────────────────────────
    final = json.loads(DICT_FINAL.read_text(encoding="utf-8"))
    targets = hanja_target_set.target_keys(final)  # 사전 파일의 등재 한자 키(호환 한자 포함) — 코드포인트 순
    unified = set(hanja_target_set.unified_keys(targets))
    seo_check = hanja_target_set.check_hanja_seo(targets)
    backend = backend_load_set(final)
    only_seo = sorted(unified - backend, key=ord)
    only_be = sorted(backend - unified, key=ord)

    # ── 글자별 부수 ───────────────────────────────────────────────
    chars: dict[str, dict] = {}
    missing: list[str] = []
    for ch in targets:
        v = rs.get(ord(ch))
        if v is None:
            missing.append(ch)
            continue
        vals = parse_rs(v)

        def entry(t: tuple[int, str, int]) -> dict:
            return {"radical": t[0], "residual": t[2], "simplified": t[1], "radical_char": rad_char[t[0]]}

        first = entry(vals[0])
        chars[ch] = {
            "radical": first["radical"],
            "residual": first["residual"],
            "simplified": first["simplified"],
            "alts": [entry(t) for t in vals[1:]],
            "radical_char": first["radical_char"],
        }
        if used[ch] != first["radical"]:
            m = moved[ch]
            chars[ch]["kangxi"] = {"radical": m["used"], "radical_char": rad_char[m["used"]],
                                   "kangxi_page": m["kangxi_page"], "basis": m["basis"]}

    # ── 214부수표 ────────────────────────────────────────────────
    simp: dict[int, list[int]] = {}
    simp_other: dict[int, list[int]] = {}
    for cp in sorted(rs):
        if is_compat(cp):
            continue
        for n, mark, resid in parse_rs(rs[cp]):
            if mark and resid == 0:
                (simp if mark == "'" else simp_other).setdefault(n, []).append(cp)

    for n, cps in VARIANTS.items():
        for cp in cps:
            if is_compat(cp):
                raise SystemExit(f"[중단] 변형 {u(cp)} 은 호환 한자")
            if 0x2E80 <= cp <= 0x2EFF:
                continue
            if cp not in rs:
                raise SystemExit(f"[중단] 변형 {u(cp)} 에 kRSUnicode 없음")
            if parse_rs(rs[cp])[0][0] != n and (n, cp) not in VARIANT_RADICAL_OK:
                raise SystemExit(f"[중단] 변형 {chr(cp)} {u(cp)} 첫 값 {rs[cp]} ≠ 부수 {n}")

    # URO 원 범위(U+4E00~9FA5)는 강희 214부수 순으로 놓였다. 부수 표준형 글자의 코드포인트를 구간
    # 시작으로 잡으면 글자의 배열 부수가 나온다 — 첫 값이 이와 다른 글자를 소비처 판단용으로 남긴다.
    starts = [ord(rad_char[n]) for n in range(1, 215)]
    if starts != sorted(starts) or not all(0x4E00 <= s <= 0x9FA5 for s in starts):
        raise SystemExit("[중단] 부수 표준형이 URO 안에서 번호 순이 아니다")
    uro_diff = []
    for ch, e in chars.items():
        cp = ord(ch)
        if 0x4E00 <= cp <= 0x9FA5:
            pos = bisect.bisect_right(starts, cp)
            if pos != e["radical"]:
                uro_diff.append({"char": ch, "cp": u(cp), "radical": e["radical"], "uro_order_radical": pos,
                                 "in_alts": pos in [a["radical"] for a in e["alts"]],
                                 "used": e.get("kangxi", {}).get("radical", e["radical"])})
    # 판정 부수를 옮긴 글자는 모두 URO 배열 부수로 옮겼어야 한다(이 파일의 조정 = 강희자전 배열 따르기)
    for ch, e in chars.items():
        if "kangxi" in e and 0x4E00 <= ord(ch) <= 0x9FA5:
            if e["kangxi"]["radical"] != bisect.bisect_right(starts, ord(ch)):
                raise SystemExit(f"[중단] {ch} 판정 부수가 URO 배열 부수와 다르다")

    n_chars = Counter(e["radical"] for e in chars.values())
    radicals: dict[str, dict] = {}
    for n in range(1, 215):
        row = {
            "char": rad_char[n],
            "kangxi_cp": u(KANGXI_BLOCK + n - 1),
            "strokes": radical_strokes(n),
            "variants": [chr(cp) for cp in VARIANTS.get(n, [])],
            "simplified": [chr(cp) for cp in simp.get(n, [])],
            "simplified_other": [chr(cp) for cp in simp_other.get(n, [])],
            "n_chars": n_chars.get(n, 0),
        }
        if n in NOTES:
            row["note"] = NOTES[n]
        radicals[str(n)] = row

    meta = {
        "description": "강희 214부수표(번호 → 표준형·변형·간화형). 인명용 한자 부수는 hanja_radicals.json.",
        "generated_by": "scripts/extract_hanja_radicals.py",
        "source": {
            "file": "Unihan_IRGSources.txt (kRSUnicode, kTotalStrokes)",
            "unicode_version": version,
            "date": header.get("Date", ""),
            "sha256": sha,
            "url": "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip",
            "kangxi": {"file": "Unihan.zip → Unihan_DictionaryIndices.txt (kKangXi)", "sha256": sha_zip},
        },
        "target": {"file": "data/hanja_dictionary_final.json (유니코드 등재 한자 키 — 호환 한자 포함, scripts/hanja_target_set.py)",
                   "count": len(targets), "unified": len(unified), "with_radical": len(chars)},
        "conventions": {
            "radical": "kRSUnicode 첫 값(UAX #38: 표준 부수·획수). 둘째 이후는 alts.",
            "residual": "나머지 획수. 음수 가능(王 96.-1).",
            "simplified": "\"'\" 중국 간화 부수, \"''\" 중국 밖 간화 부수, \"'''\" 두 번째 중국 밖 간화 부수, \"\" 없음.",
            "char": "U+2F00 강희 부수 글자를 NFKC 로 푼 통합 한자(214부수 표준형).",
            "strokes": "강희 부수 배열의 획수.",
            "variants": "위치·꼴 변형. 원형과 같은 번호로 본다(氵→85, 扌→64, 阝→163/170 …). 손으로 고른 목록이며 Unihan 값으로 검증한다.",
            "simplified_lists": "Unihan 에서 그 번호에 간화 표시 + 나머지 0획으로 등록된 글자(호환 한자 제외).",
            "n_chars": "대상 글자 중 이 부수가 대표값(첫 값)인 글자 수.",
            "first_value_vs_uro_order": "kRSUnicode 는 CLDR 정렬용이라 첫 값이 원 코드 차트(강희 214부수 배열) "
                                        "부수와 다른 글자가 있다. URO 원 범위 대상 글자 중 그런 글자 목록. "
                                        "radical=첫 값, uro_order_radical=배열 위치 부수, used=자원오행 판정에 쓴 부수"
                                        "(hanja_radicals.json kangxi — scripts/kangxi_radical_order.py 판정).",
            "kangxi": "hanja_radicals.json 에서 판정 부수를 첫 값과 다르게 둔 글자에만 있는 필드. "
                      "basis krs_value = kRSUnicode 둘째 이후 값, uro_order = kRSUnicode 에 없는 원 코드 차트 배열 부수. "
                      "S4·S7 은 부수를 data/hanja_resource_element.json 의 radical·radical_char 에서만 읽는다.",
        },
    }

    # ── 쓰기 (결정적: 코드포인트·번호 순, 한 줄에 한 항목) ────────────────
    def dump(obj) -> str:
        return json.dumps(obj, ensure_ascii=False, separators=(", ", ": "))

    lines = [f"  {dump(ch)}: {dump(e)}" for ch, e in chars.items()]
    OUT_CHARS.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8", newline="\n")
    meta_s = json.dumps(meta, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    diff_s = "[\n" + ",\n".join(f"    {dump(d)}" for d in uro_diff) + "\n  ]" if uro_diff else "[]"
    rad_lines = [f"    {dump(k)}: {dump(v)}" for k, v in radicals.items()]
    OUT_TABLE.write_text('{\n  "meta": ' + meta_s + ',\n  "first_value_vs_uro_order": ' + diff_s
                         + ',\n  "radicals": {\n' + ",\n".join(rad_lines) + "\n  }\n}\n",
                         encoding="utf-8", newline="\n")

    # ── 보고 ────────────────────────────────────────────────────
    print(f"Unihan {version} ({header.get('Date', '')}) sha256 {sha[:16]}…")
    print(f"대상 {len(targets):,}자 (사전 등재 한자 키, 통합 {len(unified):,}) · 백엔드 재구성 {len(backend):,}자(통합) · "
          f"대상에만 {len(only_seo)} · 백엔드에만 {len(only_be)}")
    print(seo_check)
    for label, xs in (("대상에만", only_seo), ("백엔드에만", only_be)):
        if xs:
            print(f"  {label}: " + " ".join(f"{c}({u(ord(c))})" for c in xs[:40]))
    print(f"커버리지 {len(chars):,}/{len(targets):,}  누락 {len(missing)}"
          + (": " + " ".join(f"{c}({u(ord(c))})" for c in missing) if missing else ""))
    multi = [c for c, e in chars.items() if e["alts"]]
    neg = [c for c, e in chars.items() if e["residual"] < 0]
    simp_first = [c for c, e in chars.items() if e["simplified"]]
    simp_any = [c for c, e in chars.items() if e["simplified"] or any(a["simplified"] for a in e["alts"])]
    compat = [c for c in chars if is_compat(ord(c))]
    print(f"여러 값 {len(multi)}자 · 나머지 획수 음수 {len(neg)}자 · 호환 한자 {len(compat)}자")
    print(f"간화 부수 표시: 대표값 {len(simp_first)}자 · alts 포함 {len(simp_any)}자"
          + (" (" + " ".join(f"{c}={rs[ord(c)]}" for c in simp_any) + ")" if simp_any else ""))
    adj = [c for c, e in chars.items() if "kangxi" in e]
    print(f"판정 부수를 옮긴 글자 {len(adj)}자: " + " ".join(
        f"{c}({chars[c]['radical']}→{chars[c]['kangxi']['radical']} {chars[c]['kangxi']['basis']})" for c in adj))
    print(f"첫 값 ≠ URO 배열 부수 {len(uro_diff)}자: " + " ".join(
        f"{d['char']}({d['radical']}{rad_char[d['radical']]}→배열 {d['uro_order_radical']}"
        f"{rad_char[d['uro_order_radical']]}{'' if d['in_alts'] else ', alts 에 없음'})" for d in uro_diff))
    if only_be:
        print("백엔드에만 있는 글자의 kRSUnicode(이 파일엔 싣지 않음): "
              + " ".join(f"{c}={rs.get(ord(c), '없음')}" for c in only_be))
    used = sorted(n_chars)
    print(f"쓰인 부수 {len(used)}종 / 214 · 안 쓰인 {214 - len(used)}종")
    print("부수 분포 상위 25:")
    for n, k in sorted(n_chars.items(), key=lambda x: (-x[1], x[0]))[:25]:
        var = "·".join(radicals[str(n)]["variants"][:2])
        print(f"  {n:>3} {rad_char[n]}{'(' + var + ')' if var else '':<8} {k:>4}")
    print(f"→ {OUT_CHARS.relative_to(ROOT)} ({OUT_CHARS.stat().st_size:,} B) · "
          f"{OUT_TABLE.relative_to(ROOT)} ({OUT_TABLE.stat().st_size:,} B)")
    return 1 if missing or len(targets) != EXPECTED_TARGET else 0


if __name__ == "__main__":
    sys.exit(main())
