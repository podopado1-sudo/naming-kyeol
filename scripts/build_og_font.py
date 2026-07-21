# -*- coding: utf-8 -*-
"""
/name OG 공유 카드용 서브셋 폰트 빌드 스크립트.

satori(ImageResponse)는 woff2를 못 읽으므로, 저장소의 PretendardVariable.woff2를
wght=700으로 고정 인스턴스화한 뒤 카드에 실제로 쓰이는 글리프만 남긴 TTF를 만든다.
산출물은 커밋 대상(Vercel 빌드엔 Python이 없음) — frontend/src/assets/og/ 에 둔다
(public/ 밖 → 브라우저로 배포되지 않고 opengraph-image.tsx가 빌드 타임에만 읽음).

글리프 셋 = name-seo.json의 모든 이름·mean 문자
          ∪ KS X 1001 완성형 한글 2,350자 (카드 카피 수정 내성)
          ∪ OG_LABELS (opengraph-image.tsx의 고정 문구 — 수정 시 여기도 동기화)
          ∪ ASCII printable + 자주 쓰는 문장부호.

라이선스: Pretendard는 SIL OFL 1.1 + Reserved Font Name "Pretendard".
서브셋은 Modified Version이므로 name 테이블의 패밀리명을 "KyeolOG"로 바꾸고
OFL 전문을 LICENSE-pretendard.txt로 동봉한다.

사용법:  python scripts/build_og_font.py
선행:    pip install fonttools brotli
출력:    frontend/src/assets/og/pretendard-og.ttf + 검증 리포트(stdout)
"""

import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_FONT = os.path.join(ROOT, "frontend", "public", "fonts", "PretendardVariable.woff2")
NAMES_JSON = os.path.join(ROOT, "frontend", "src", "data", "name-seo.json")
OUT_DIR = os.path.join(ROOT, "frontend", "src", "assets", "og")
# TTF 파일 대신 base64 TS 모듈로 내보낸다 — opengraph-image.tsx가 node:fs 없이
# import하기 위함(fs를 쓰면 Next가 라우트를 온디맨드(ƒ)로 강등해 정적 생성이 깨짐).
OUT_TS = os.path.join(OUT_DIR, "pretendard-og.ts")

# opengraph-image.tsx의 고정 문구와 동기화할 것 (한글은 KS X 1001 마진이 있어
# 웬만한 카피 수정은 흡수되지만, 특수문자·라틴은 여기 명시해야 안전).
OG_LABELS = (
    "이름의 결 이름 뜻 인기 위 남자 이름 여자 이름 남녀 공용 이름 "
    "namingkyeol.com NAMING.KYEOL"
)

EXTRA_PUNCT = "·—–‘’“”%,.()[]/+-:&"


def ksx1001_hangul():
    """KS X 1001 완성형 한글 2,350자.

    Python의 euc_kr 코덱은 UHC 확장까지 인코딩하므로(11,172자 전부 통과),
    완성형 음절 구역인 2바이트 리드 0xB0~0xC8 범위로 필터링한다.
    """
    chars = set()
    for cp in range(0xAC00, 0xD7A4):
        try:
            b = chr(cp).encode("euc_kr")
        except UnicodeEncodeError:
            continue
        if len(b) == 2 and 0xB0 <= b[0] <= 0xC8 and 0xA1 <= b[1] <= 0xFE:
            chars.add(chr(cp))
    return chars


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    data = json.load(open(NAMES_JSON, encoding="utf-8"))
    chars = set()
    for name, rec in data["names"].items():
        chars.update(name)
        chars.update(rec.get("mean", ""))

    hangul_base = ksx1001_hangul()
    chars |= hangul_base
    chars.update(OG_LABELS)
    chars.update(EXTRA_PUNCT)
    chars.update(chr(c) for c in range(0x20, 0x7F))  # ASCII printable
    chars.discard("\n")

    print(f"KS X 1001 한글: {len(hangul_base)}자 (2350 기대)")
    print(f"요청 글리프 셋: {len(chars)}자")

    font = TTFont(SRC_FONT)  # fontTools가 brotli로 woff2 자동 해제

    # 가변 폰트 → wght=700 고정 (satori의 가변 폰트 처리가 불안정하므로 정적 인스턴스)
    axes = {a.axisTag: a for a in font["fvar"].axes} if "fvar" in font else {}
    if "wght" in axes:
        instancer.instantiateVariableFont(font, {"wght": 700}, inplace=True)
        print("wght=700 인스턴스 고정 완료")

    options = subset.Options()
    options.flavor = None  # TTF 출력
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text="".join(sorted(chars)))
    subsetter.subset(font)

    # OFL Reserved Font Name 준수: 서브셋(Modified Version)은 "Pretendard" 명칭 사용 불가
    for rec in font["name"].names:
        if rec.nameID in (1, 3, 4, 6, 16):
            rec.string = rec.toUnicode().replace("Pretendard", "KyeolOG")

    # cmap 자기검증 — 요청 문자가 하나라도 빠지면 실패 종료
    cmap = font.getBestCmap()
    missing = sorted(c for c in chars if ord(c) not in cmap)
    if missing:
        print(f"[실패] 서브셋에 누락된 문자 {len(missing)}개: {''.join(missing[:50])}")
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)
    font.flavor = None

    import base64
    import io

    buf = io.BytesIO()
    font.save(buf)
    ttf_bytes = buf.getvalue()
    b64 = base64.b64encode(ttf_bytes).decode("ascii")

    with open(OUT_TS, "w", encoding="utf-8", newline="\n") as fp:
        fp.write(
            "// 자동 생성: scripts/build_og_font.py — 직접 수정 금지. 재생성으로만 갱신.\n"
            "// Pretendard 서브셋(wght 700 고정, OFL RFN 준수로 패밀리명 KyeolOG) TTF의 base64.\n"
            "// opengraph-image.tsx가 node:fs 없이 import — fs 사용 시 라우트가 온디맨드로 강등됨.\n"
            f'export const OG_FONT_B64 =\n  "{b64}";\n'
        )

    size_kb = len(ttf_bytes) / 1024
    ts_kb = os.path.getsize(OUT_TS) / 1024
    print(f"글리프 수: {len(font.getGlyphOrder())}")
    print(f"출력: {OUT_TS} (TTF {size_kb:.0f} KB → base64 TS {ts_kb:.0f} KB)")
    if size_kb > 600:
        print("[경고] TTF 600KB 초과 — 글리프 셋 축소 검토")
    return 0


if __name__ == "__main__":
    sys.exit(main())
