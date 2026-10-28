using NameForm.Application.Engines.Data;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 성 칸 없이 이름 칸에 성 포함 전체 이름('김민수')을 보낸 옛 /search 꼴 요청을 성과 이름으로 나눈다(2026-10-28).
/// 옛 /search 화면(배포 전 캐시 포함)은 부모 이름 칸 값을 FatherName 으로만 보내 부모 엔진이 '김민수'를 이름으로 읽었다 —
/// 아버지 이름 '민수'가 후보로 나오고 성 글자가 이름에 섞였다(옛 꼴 252실행의 6.9%·43%).
///
/// 규칙은 프런트 lib/name-split.ts 의 splitParentName(→ splitFullName)과 같다(바꾸면 함께 고칠 것):
///  1. 성 칸에 값이 있거나 이름 칸이 비면 그대로
///  2. 띄어 쓰면 앞 낱말이 1자이거나 복성일 때 그 낱말이 성("김 철" → 김 + 철), 아니면 붙여 읽는다
///  3. 붙여 쓴 2자 이하는 이름만('민호'를 민 + 호로 자르지 않는다)
///  4. 붙여 쓴 3자 이상: 앞 두 글자가 복성이고 (4자 이상이거나, 3자이면서 앞머리가 황보·서문·강전·선우가 아니면) 복성
///     ("남궁민" → 남궁 + 민, "선우진" → 선 + 우진), 그 밖은 첫 글자가 성
/// /parent-based 폼은 성 칸이 따로 있어 이 나누기를 하지 않는다 — 성 없이 넣은 3음절 이름('한울림')을 '한' + '울림'으로 망가뜨렸다.
/// </summary>
public static class ParentNameSplit
{
    // 프런트 SINGLE_SURNAME_FIRST_IN_THREE — 붙여 쓴 3자에서 복성으로 읽지 않는 앞머리
    private static readonly HashSet<string> SingleSurnameFirstInThree = new() { "황보", "서문", "강전", "선우" };

    public static (string? Surname, string? Name) SplitIfFullName(string? surname, string? name)
    {
        if (!string.IsNullOrWhiteSpace(surname) || string.IsNullOrWhiteSpace(name)) return (surname, name);
        var trimmed = name.Trim();
        var words = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        if (words.Length > 1)
        {
            if (words[0].Length == 1 || SurnameData.IsTwoCharSurname(words[0]))
                return (words[0], string.Concat(words.Skip(1)));
            return SplitJoined(string.Concat(words));
        }
        if (trimmed.Length <= 2) return (surname, trimmed);
        return SplitJoined(trimmed);
    }

    private static (string? Surname, string? Name) SplitJoined(string full)
    {
        if (full.Length >= 2)
        {
            var head = full[..2];
            if (SurnameData.IsTwoCharSurname(head)
                && (full.Length >= 4 || (full.Length == 3 && !SingleSurnameFirstInThree.Contains(head))))
                return (head, full[2..]);
        }
        return full.Length >= 2 ? (full[..1], full[1..]) : (null, full);
    }
}
