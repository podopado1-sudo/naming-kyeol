"""데이터 리포트 표 ↔ name-seo.json 대조 (2026-10-21, 감사 AS-1).

content/insights/*.md 의 표 행 가운데 /name 링크가 걸린 행을 현재 frontend/src/data/name-seo.json 과 비교한다.
- 링크 slug 와 표시 이름, 수록 여부
- '대표 한자' 칸 = 1순위 조합
- '발음이 주는 느낌' 칸 = 대표 뜻(mean)

리포트 표의 숫자는 스크립트로 만들었지만 뜻 칸은 json 을 자동으로 따라가지 않는다. 10/7 대표 뜻 교체(187명)
뒤에도 리포트 11칸이 옛 뜻("연꽃처럼…" 아래 然佑)을 싣고 있었다. /name 데이터를 재생성한 뒤에는 반드시 돌릴 것.

사용법 (저장소 루트에서):
  python scripts/audit_insights_tables.py          # 검사만, 불일치가 있으면 exit 1
  python scripts/audit_insights_tables.py --fix    # 뜻 칸만 현재 mean 으로 교체(숫자·다른 칸 원문 유지) + updated 갱신
대표 한자 불일치는 --fix 로 고치지 않는다 — 한자가 바뀌면 본문 서술도 다시 읽어야 하므로 손으로 고친다.
--fix 를 줘도 고치지 않은 불일치(대표 한자·링크·미수록·mean 없는 뜻 칸)가 하나라도 남으면 exit 1 이다
(그 전에는 --fix 면 무조건 exit 0 이라 손으로 고칠 한자 불일치가 성공으로 묻혔다 — 2026-10-21 FSC-8).
"""
import glob
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import unquote

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FE = os.path.join(ROOT, "frontend")
names = json.load(open(os.path.join(FE, "src", "data", "name-seo.json"), encoding="utf-8"))["names"]
fix = "--fix" in sys.argv
today = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")
link_re = re.compile(r"\[([^\]]+)\]\(/name/([^)]+)\)")

total_rows = 0
mism = []
fixed = 0
auto_fixed = set()  # --fix 가 실제로 고친 mism 항목의 인덱스 — 나머지는 손으로 고쳐야 한다
for path in sorted(glob.glob(os.path.join(FE, "content", "insights", "*.md"))):
    fn = os.path.basename(path)
    raw = open(path, encoding="utf-8", newline="").read()
    lines = raw.split("\n")
    header = None
    touched = False
    for i, line0 in enumerate(lines):
        cr = "\r" if line0.endswith("\r") else ""
        line = line0[:-1] if cr else line0
        if not line.startswith("|"):
            header = None
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if header is None:
            header = cells
            continue
        if re.match(r"^:?-{2,}", cells[0]) or not link_re.search(line):
            continue
        total_rows += 1
        if "이름" not in header:  # 받침 패턴 표처럼 이름 칸이 없는 표 — 링크·수록만 확인
            for txt, enc in link_re.findall(line):
                if unquote(enc) != txt or txt not in names:
                    mism.append((fn, i + 1, txt, "link/name missing"))
            continue
        ni = header.index("이름")
        m = link_re.search(cells[ni])
        name = m.group(1)
        if unquote(m.group(2)) != name:
            mism.append((fn, i + 1, name, "link slug != text"))
        rec = names.get(name)
        if not rec:
            mism.append((fn, i + 1, name, "not in name-seo"))
            continue
        if "대표 한자" in header:
            hj = cells[header.index("대표 한자")]
            top = "".join(rec["combos"][0]) if rec.get("combos") else ""
            if hj != top:
                mism.append((fn, i + 1, name, f"hanja {hj} != {top}"))
        if "발음이 주는 느낌" in header:
            mi = header.index("발음이 주는 느낌")
            cur, want = cells[mi], rec.get("mean", "")
            if cur != want:
                mism.append((fn, i + 1, name, f"mean {cur!r} -> {want!r}"))
                if fix and want:
                    # split('|') 의 parts[0] 은 선행 '|' 앞 빈 문자열이라 셀 k 는 parts[k+1]
                    parts = line.split("|")
                    # 빈 칸이면 replace("", want) 가 글자 사이마다 끼워 넣으므로 칸을 통째로 쓴다
                    parts[mi + 1] = parts[mi + 1].replace(cur, want) if cur else f" {want} "
                    lines[i] = "|".join(parts) + cr
                    fixed += 1
                    touched = True
                    auto_fixed.add(len(mism) - 1)
    if fix and touched:
        lines = [re.sub(r'^updated: "\d{4}-\d{2}-\d{2}"', f'updated: "{today}"', ln) for ln in lines]
        new = "\n".join(lines)
        if new != raw:
            open(path, "w", encoding="utf-8", newline="").write(new)
            print("wrote", fn)

print("rows checked:", total_rows)
for k, x in enumerate(mism):
    print("FIXED   " if k in auto_fixed else "MISMATCH", *x)
remaining = len(mism) - len(auto_fixed)
print("mismatch count:", len(mism), "fixed:", fixed, "remaining:", remaining)
if fix and remaining:
    print("--fix 로 고치지 않는 불일치가 남았다 — 위 MISMATCH 줄을 손으로 고칠 것")
# 검사 모드는 불일치 하나라도 실패, --fix 모드는 고치고도 남은 것이 있으면 실패
sys.exit(1 if remaining else 0)
