# -*- coding: utf-8 -*-
"""
글자 → 자원오행 판정에 쓸 강희 부수 번호 (부수 기준 자원오행 전환 S1 — 세 산출 스크립트가 함께 쓰는 판정 한 곳).

쓰는 곳 (모두 이 모듈 하나로 판정해 서로 어긋나지 않게 한다):
  scripts/extract_hanja_radicals.py       → data/hanja_radicals.json 의 kangxi 필드(조정한 글자만)
  scripts/build_radical_resource_table.py → --refresh 의 부수 집계(기본 실행은 data/hanja_radicals.json kangxi 를 읽는다)
  (scripts/build_hanja_variants.py·build_resource_element.py 는 data/hanja_radicals.json 을 읽어 같은 값을 쓴다)

판정
  기본은 Unihan kRSUnicode 첫 값의 부수 번호다. kRSUnicode 는 CLDR 정렬용이라 첫 값이 강희자전 배열(옥편 계열
  작명 자료의 부수 표기와 같은 쪽)과 어긋나는 글자가 있다(萬 첫 값 禸·강희 艸, 尹 丿·尸, 視 示·見 …).
  후보 부수 = kRSUnicode 값들의 부수 번호 + (URO 원 범위 U+4E00~9FA5 글자면) 원 코드 차트 배열 위치의 부수 번호.
  URO 원 범위는 강희 214부수 순으로 배열됐으므로, 부수 표준형 글자의 코드포인트를 구간 시작으로 잡으면 배열 부수가 나온다.
  후보가 둘 이상이면 kKangXi 쪽수로 고른다: 부수마다 kRSUnicode 값이 하나뿐인(간화 표시 없는) 글자의 kKangXi 쪽수
  10~90 분위 구간을 만들고, 그 글자 쪽수에서 가장 가까운 구간(안에 들면 거리 0)의 부수를 쓴다. 동률이면 kRSUnicode 첫 값.
  - basis "krs_value": kRSUnicode 둘째 이후 값으로 옮겼다(萬·尹·彪·視·章 …)
  - basis "uro_order": kRSUnicode 값에 없는 배열 부수로 옮겼다(壡 — kRSUnicode 29 又 하나뿐, 배열·kKangXi 쪽수는 土)

입력: tmp/unihan-18.0/Unihan_IRGSources.txt (kRSUnicode) · tmp/unihan-18.0/Unihan.zip 안 Unihan_DictionaryIndices.txt (kKangXi)
이 모듈은 파일을 쓰지 않는다. 소스에 호환 한자·강희 부수 블록 글자를 리터럴로 쓰지 않는다(코드포인트 숫자만).
"""

import bisect
import collections
import io
import os
import unicodedata
import zipfile

URO_FIRST, URO_LAST = 0x4E00, 0x9FA5   # 강희 214부수 순으로 배열된 원 코드 차트(URO) 범위
KANGXI_BLOCK = 0x2F00                   # U+2F00 KANGXI RADICAL ONE …
BAND_LO, BAND_HI = 0.1, 0.9             # 부수별 kKangXi 쪽수 구간(분위)


def rad_num(v):
    """kRSUnicode 값 하나('140.9', "201'.0")의 부수 번호."""
    return int(v.split(".")[0].rstrip("'"))


def radical_chars():
    """강희 부수 1~214 의 통합 한자 꼴 (U+2F00 블록의 NFKC)."""
    out = {n: unicodedata.normalize("NFKC", chr(KANGXI_BLOCK + n - 1)) for n in range(1, 215)}
    if len(set(out.values())) != 214:
        raise SystemExit("부수 문자 매핑 오류")
    return out


def read_krs(irg_path):
    if not os.path.exists(irg_path):
        raise SystemExit("Unihan 없음: %s (tmp/unihan-18.0 — 로컬 전용)" % irg_path)
    vals = {}
    with open(irg_path, encoding="utf-8") as f:
        for line in f:
            if "\tkRSUnicode\t" not in line:
                continue
            cp, _, val = line.rstrip("\n").split("\t")
            vals[chr(int(cp[2:], 16))] = val.split()
    return vals


def read_kangxi_pages(zip_path):
    if not os.path.exists(zip_path):
        raise SystemExit("Unihan.zip 없음: %s (kKangXi 를 읽는다)" % zip_path)
    pages = {}
    with zipfile.ZipFile(zip_path) as z, z.open("Unihan_DictionaryIndices.txt") as f:
        for line in io.TextIOWrapper(f, encoding="utf-8"):
            if "\tkKangXi\t" not in line:
                continue
            cp, _, val = line.rstrip("\n").split("\t")
            pages[chr(int(cp[2:], 16))] = int(val.split()[0].split(".")[0])
    return pages


def kangxi_radicals(irg_path, zip_path):
    """(used, moved, vals)

    used  : 글자 → 판정에 쓸 부수 번호 (kRSUnicode 가 있는 모든 글자)
    moved : 첫 값과 다른 부수를 쓴 글자 → {"krs_first", "used", "kangxi_page", "basis"}
    vals  : 글자 → kRSUnicode 값 목록(원문 그대로)
    """
    vals = read_krs(irg_path)
    pages = read_kangxi_pages(zip_path)
    rch = radical_chars()
    starts = [ord(rch[n]) for n in range(1, 215)]
    if starts != sorted(starts) or not all(URO_FIRST <= s <= URO_LAST for s in starts):
        raise SystemExit("부수 표준형이 URO 안에서 번호 순이 아니다")

    by_rad = collections.defaultdict(list)
    for c, vs in vals.items():
        if len(vs) == 1 and "'" not in vs[0] and c in pages:
            by_rad[rad_num(vs[0])].append(pages[c])
    band = {}
    for r, ps in by_rad.items():
        ps.sort()
        band[r] = (ps[int(len(ps) * BAND_LO)], ps[min(len(ps) - 1, int(len(ps) * BAND_HI))])

    used, moved = {}, {}
    for c, vs in vals.items():
        cands = [rad_num(v) for v in vs]
        cp = ord(c)
        if URO_FIRST <= cp <= URO_LAST:
            u = bisect.bisect_right(starts, cp)
            if u not in cands:
                cands.append(u)
        best = cands[0]
        if len(set(cands)) > 1 and c in pages:
            p = pages[c]

            def dist(r):
                lo, hi = band.get(r, (None, None))
                if lo is None:
                    return float("inf")
                return 0 if lo <= p <= hi else min(abs(p - lo), abs(p - hi))
            best = min(cands, key=lambda r: (dist(r), cands.index(r)))
            if best != cands[0]:
                in_krs = best in [rad_num(v) for v in vs]
                moved[c] = {"krs_first": cands[0], "used": best, "kangxi_page": p,
                            "basis": "krs_value" if in_krs else "uro_order"}
        used[c] = best
    return used, moved, vals
