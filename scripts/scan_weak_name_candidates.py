# -*- coding: utf-8 -*-
"""한자 사전 훈 스캔 — ① 다중 훈 글자(대표 훈 검수용) ② 이름에 약한 훈 후보(Weak 감점 검수용).

지난 불용한자 전수 스캔(2026-07-02)과 같은 검수 워크플로의 입력을 만든다:
스캔 → 후보 TSV → 사용자와 수동 검수 → hanja-gloss-overrides.json / WeakGivenNameHanjaSet 일괄 확정.

입력:
  - data/hanja_dictionary_final.json  (9,595자, meaning_ko·sources)
  - data/hanja_meanings.json          (백엔드가 Meaning을 덮어쓰는 소스 — 유효 뜻은 이쪽 우선)
  - frontend/src/data/name-seo.json   (combos 노출 글자 판정)
  - Application/Engines/Data/HanjaData.cs      (ForbiddenNameHanjaSet·CommonNameHanja 추출)
  - Application/Engines/Utils/HanjaSelector.cs (기존 WeakGivenNameHanja 추출)

출력 (--outdir, 기본 현재 디렉토리):
  - multi_gloss_candidates.tsv  char, reading, gloss_count, glosses, in_combos, in_common, is_gov
  - weak_candidates.tsv         char, reading, first_gloss, category, in_combos, in_common, is_gov

사용:
  python scripts/scan_weak_name_candidates.py [--outdir DIR]
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPLIT_RE = re.compile(r"[,/;·]")  # C# CleanGloss / frontend firstGloss와 동일 구분자


def extract_charset_from_cs(path: Path, decl_marker: str) -> set:
    """C# 소스에서 HashSet<string> 선언 블록의 1글자 문자열 리터럴을 추출."""
    text = path.read_text(encoding="utf-8")
    start = text.index(decl_marker)
    open_brace = text.index("{", start)
    depth, i = 0, open_brace
    while True:
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    block = text[open_brace : i + 1]
    # 주석 제거 후 "X" 리터럴 수집 (호환자 등 비BMP도 1"글자")
    block = re.sub(r"//[^\n]*", "", block)
    chars = set()
    for lit in re.findall(r'"([^"\\]+)"', block):
        if len(lit) <= 2 and len(lit.encode("utf-32-le")) // 4 == 1:
            chars.add(lit)
    return chars


# ── 이름에 약한 훈 사전 (부정 아님 — 평범 사물/허사. 명백 부정은 불용한자 영역) ──
WEAK_GLOSS_CATEGORIES = {
    "나물·풀": [
        "나물", "냉이", "쑥", "갈대", "억새", "이끼", "부들", "마름", "띠", "골풀",
        "명아주", "질경이", "도꼬마리", "마디풀", "쇠비름", "비름", "달래", "부추",
        "미나리", "쐐기풀", "잡초", "김", "덤불", "떨기",
    ],
    "곡물·음식": [
        "벼", "쌀", "보리", "밀", "콩", "팥", "기장", "수수", "메밀", "겨", "짚",
        "왕겨", "밥", "죽", "떡", "엿", "국", "누룩", "식초", "소금", "젓갈", "간장",
        "된장", "미음", "누룽지", "보리죽", "쌀밥", "곡식",
    ],
    "도구·기물": [
        "도리깨", "쟁기", "호미", "낫", "삽", "괭이", "절구", "공이", "방아", "바늘",
        "실패", "톱", "끌", "대패", "송곳", "망치", "도끼자루", "항아리", "독", "두레박",
        "삼태기", "멍석", "가마니", "광주리", "바구니", "소쿠리", "시루", "솥", "냄비",
        "주걱", "숟가락", "젓가락", "사발", "접시", "쟁반", "동이", "물동이", "표주박",
        "빗", "얼레빗", "참빗", "베개", "돗자리", "걸상", "평상", "사다리", "지게",
        "굴대", "바퀴", "빗장", "문빗장", "자물쇠", "고삐", "굴레", "멍에", "채찍",
        "그물추", "낚싯대", "통발", "덫", "올가미", "부지깽이", "풀무", "숫돌",
        # 주의: "끌"(정) 미포함 — 훈 "끌"은 대부분 동사 끌다(引·提·牽)
    ],
    "건물·시설(허드레)": [
        "울타리", "담", "부엌", "뒷간", "마구간", "외양간", "헛간", "곳집", "섬돌",
        "주춧돌", "기와", "벽돌", "서까래", "문지방", "토담", "움집", "오두막",
    ],
    "신체(범속)": [
        # 주의: "볼"(뺨) 미포함 — 훈 "볼"은 대부분 동사 보다(見·覽·視)
        "코", "귀", "이마", "턱", "뺨", "목구멍", "창자", "밥통", "쓸개",
        "콩팥", "허파", "겨드랑이", "정강이", "종아리", "팔꿈치", "발꿈치", "복사뼈",
        "손톱", "발톱", "살갗", "주름", "수염", "터럭", "머리털", "배꼽", "넓적다리",
        "허벅지", "엉덩이", "볼기", "젖", "침", "땀",
    ],
    "동물(범속)": [
        "쥐", "돼지", "뱀", "지렁이", "개구리", "두꺼비", "달팽이", "거미", "모기",
        "파리", "벼룩", "지네", "전갈", "굼벵이", "번데기", "메뚜기", "여치",
        "귀뚜라미", "노래기", "나귀", "노새", "염소", "오리", "거위", "닭", "개",
        "고양이", "올챙이", "우렁이", "조개", "소라", "새우", "게", "가재", "미꾸라지",
        "메기", "가물치", "붕어", "잉어",  # 잉어는 등용문 연상도 있어 검수로 판단
    ],
    "의복(허드레)": [
        "버선", "짚신", "나막신", "바지", "잠방이", "치마", "소매", "옷깃", "옷섶",
        "허리띠", "댕기", "골무", "헝겊", "누더기", "걸레",
    ],
    "단위·잡물": [
        "되", "홉", "냥", "푼", "부스러기", "조각", "토막", "지푸라기", "검불",
        "먼지떨이", "짐", "꾸러미", "자루", "멱서리",
    ],
    "허사(뜻 없음)": [
        "어조사", "발어사", "어찌", "이에", "무릇", "대저", "다만", "곧", "그",
        "저", "너", "이것", "저것", "접미사", "조사",
    ],
}

# 의도적 보류 (2026-07-02 사용자 확정 — 통용 의미가 긍정·중립이라 재제안 금지)
HOLD_CHARS = set("猛鳴空渾蟬鳶惜龐唇")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default=".", help="TSV 출력 디렉토리")
    args = ap.parse_args()
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    dic = json.loads((ROOT / "data" / "hanja_dictionary_final.json").read_text(encoding="utf-8"))
    meanings = json.loads((ROOT / "data" / "hanja_meanings.json").read_text(encoding="utf-8"))
    name_seo = json.loads(
        (ROOT / "frontend" / "src" / "data" / "name-seo.json").read_text(encoding="utf-8")
    )

    hanja_data_cs = ROOT / "Application" / "Engines" / "Data" / "HanjaData.cs"
    selector_cs = ROOT / "Application" / "Engines" / "Utils" / "HanjaSelector.cs"
    forbidden = extract_charset_from_cs(hanja_data_cs, "ForbiddenNameHanjaSet = new")
    common = extract_charset_from_cs(hanja_data_cs, "CommonNameHanja = new")
    weak_existing = extract_charset_from_cs(selector_cs, "WeakGivenNameHanja = new")
    print(f"forbidden={len(forbidden)} common={len(common)} weak(기존)={len(weak_existing)}")

    combo_chars = set()
    for info in name_seo.get("names", {}).values():
        for pair in info.get("combos") or []:
            combo_chars.update(pair)
    print(f"combos 노출 글자={len(combo_chars)}")

    # 약한 훈 역인덱스: 훈 → 카테고리
    gloss_to_cat = {}
    for cat, words in WEAK_GLOSS_CATEGORIES.items():
        for w in words:
            gloss_to_cat[w] = cat

    multi_rows, weak_rows = [], []
    for char, entry in dic.items():
        meaning = meanings.get(char) or entry.get("meaning_ko") or ""
        if not meaning.strip():
            continue
        # 불용 판정은 백엔드와 동일하게 NFKC 정규형 기준 (호환 코드포인트 엔트리 커버)
        if char in forbidden or unicodedata.normalize("NFKC", char) in forbidden:
            continue
        if char in HOLD_CHARS:
            continue
        reading = "/".join(entry.get("readings_hangul") or [])
        is_gov = "gov" in (entry.get("sources") or [])
        in_combos = char in combo_chars
        in_common = char in common
        exposure = (in_combos, in_common, is_gov)

        tokens = [t.strip() for t in SPLIT_RE.split(meaning) if t.strip()]
        if len(tokens) >= 2:
            multi_rows.append((char, reading, len(tokens), " | ".join(tokens), *exposure))

        first = tokens[0] if tokens else ""
        # "두 이" → 훈 부분 = 마지막 어절(음) 제외
        words = first.split()
        gloss = " ".join(words[:-1]) if len(words) >= 2 else first
        cat = gloss_to_cat.get(gloss)
        if cat and char not in weak_existing:
            weak_rows.append((char, reading, first, cat, *exposure))

    def sort_key(row):
        # 노출 글자 우선 (combos > common > gov)
        return (not row[-3], not row[-2], not row[-1], row[0])

    multi_rows.sort(key=sort_key)
    weak_rows.sort(key=sort_key)

    def write_tsv(name, header, rows):
        path = outdir / name
        with path.open("w", encoding="utf-8", newline="") as f:
            f.write("\t".join(header) + "\n")
            for r in rows:
                f.write("\t".join(str(int(v)) if isinstance(v, bool) else str(v) for v in r) + "\n")
        print(f"{path}: {len(rows)}행")

    write_tsv(
        "multi_gloss_candidates.tsv",
        ["char", "reading", "gloss_count", "glosses", "in_combos", "in_common", "is_gov"],
        multi_rows,
    )
    write_tsv(
        "weak_candidates.tsv",
        ["char", "reading", "first_gloss", "category", "in_combos", "in_common", "is_gov"],
        weak_rows,
    )


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
