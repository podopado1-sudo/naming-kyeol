#!/usr/bin/env python3
"""
실명 성별 빈도 데이터 빌더.

입력: 대법원 전자가족관계등록시스템 출생신고 이름 통계(2008~2019 합산) 기반
      이름,빈도 CSV 2종 (여: f.csv / 남: m.csv).
      원천: https://github.com/randkid/name (대법원 공개 통계 재가공)
출력: data/name-gender-stats.json
      - lastSyllable : 2음절 이름의 끝음절별 {m, f} 빈도 합 (성별 어미 신호)
      - firstSyllable: 첫음절별 {m, f} 빈도 합
      - names        : 2음절 이름 전체별 {m, f} 빈도 (임계 이상)

엔진(NamingPrinciples.EvalGenderSyllableFit)이 수동 큐레이션 대신 이 통계로
성별 적합을 판정. 저장값은 빈도(사실 데이터)뿐이며 임계/판정은 엔진에서 수행.
"""

import csv
import json
import os
from collections import defaultdict

# 이름 전체 사전에 포함할 최소 합계 빈도 (롱테일 잡음 컷 + 파일 크기 관리)
MIN_NAME_TOTAL = 10

def read_csv(path):
    """이름 -> 빈도 dict. (헤더: name,weight)"""
    out = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = (row.get("name") or "").strip()
            try:
                w = int((row.get("weight") or "0").strip())
            except ValueError:
                continue
            if name and w > 0:
                out[name] = out.get(name, 0) + w
    return out

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    raw_dir = os.path.join(script_dir, "_name_raw")
    project_root = os.path.dirname(script_dir)
    out_dir = os.path.join(project_root, "data")
    os.makedirs(out_dir, exist_ok=True)

    female = read_csv(os.path.join(raw_dir, "f.csv"))
    male = read_csv(os.path.join(raw_dir, "m.csv"))

    all_names = set(female) | set(male)

    last_syll = defaultdict(lambda: {"m": 0, "f": 0})
    first_syll = defaultdict(lambda: {"m": 0, "f": 0})
    names = {}

    for name in all_names:
        m = male.get(name, 0)
        f = female.get(name, 0)
        # 2음절 이름만 — 엔진의 성별 어미 적합도 2음절 대상
        if len(name) == 2:
            first_syll[name[0]]["m"] += m
            first_syll[name[0]]["f"] += f
            last_syll[name[1]]["m"] += m
            last_syll[name[1]]["f"] += f
            if m + f >= MIN_NAME_TOTAL:
                names[name] = {"m": m, "f": f}

    data = {
        "source": "대법원 전자가족관계등록시스템 출생신고 통계(2008~2019 합산) — randkid/name 재가공",
        "note": "값은 출생신고 빈도(사실 데이터). 성별 판정 임계는 엔진에서 적용.",
        "minNameTotal": MIN_NAME_TOTAL,
        "lastSyllable": {k: v for k, v in sorted(last_syll.items())},
        "firstSyllable": {k: v for k, v in sorted(first_syll.items())},
        "names": {k: names[k] for k in sorted(names)},
    }

    out_path = os.path.join(out_dir, "name-gender-stats.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(out_path) / 1024
    print(f"저장: {out_path} ({size_kb:.0f} KB)")
    print(f"  끝음절 {len(last_syll)} · 첫음절 {len(first_syll)} · 이름 {len(names)}")
    # 샘플 검증 출력
    for n in ["유주", "영주", "현주", "민준", "서연", "민규"]:
        if n in names:
            v = names[n]
            tot = v["m"] + v["f"]
            print(f"  {n}: m={v['m']} f={v['f']} 여비율={v['f']/tot:.2f}")
    for s in ["주", "규", "아", "준"]:
        v = last_syll.get(s)
        if v:
            tot = v["m"] + v["f"]
            print(f"  -{s}(끝): m={v['m']} f={v['f']} 여비율={v['f']/tot:.2f}")

if __name__ == "__main__":
    main()
