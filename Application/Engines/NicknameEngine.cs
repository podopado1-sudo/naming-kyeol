using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines;

/// <summary>
/// 별명 생성 엔진
/// 한국어 이름에서 자연스럽고 친근한 별명을 생성한다.
/// </summary>
public class NicknameEngine : INicknameEngine
{
    private static readonly string[] CuteSuffixes = { "뽀", "링", "콩", "니", "찌" };

    /// <summary>
    /// 금칙어 HashSet — O(1) 조회
    /// 별명으로 만들어졌을 때 부적절한 단어 목록
    /// </summary>
    private static readonly HashSet<string> InappropriateWords = new(StringComparer.Ordinal)
    {
        "바보", "멍청", "못난", "나쁜", "짜증", "싫어", "미친", "돼지",
        "거지", "병신", "씨발", "개새", "똥", "죽어", "꺼져",
        "변태", "호구", "찐따", "쪼다", "느금"
    };

    public async Task<List<string>> GenerateNicknamesAsync(string lastName, List<string> names)
    {
        var nicknames = new List<(string nickname, int priority)>();

        foreach (var name in names.Take(5))
        {
            if (name.Length < 2) continue;

            var lastChar = name[^1];
            var firstChar = name[0];
            var hasBatchim = KoreanUtils.HasFinalConsonant(lastChar);

            // 1. 이름 + 호칭 접미사 (받침 고려)
            //    받침 있으면 "아", 없으면 "야"
            //    예: 수현(받침 ㄴ) → "수현아", 민서(받침 없음) → "민서야"
            var callSuffix = hasBatchim ? "아" : "야";
            nicknames.Add(($"{name}{callSuffix}", 1));

            // 2. 성 + 이름 첫 글자 (가장 자연스러운 축약)
            //    예: 김민서 → "김민"
            nicknames.Add(($"{lastName}{firstChar}", 1));

            // 3. 성 + 이름 끝 글자
            //    예: 김민서 → "김서"
            if (name.Length >= 2)
                nicknames.Add(($"{lastName}{lastChar}", 2));

            // 4. 첫 글자 + 이 (친근한 축약)
            //    예: 준호 → "준이", 서연 → "서이"
            nicknames.Add(($"{firstChar}이", 2));

            // 5. 끝 글자 + 이 (친근)
            //    예: 준호 → "호이", 서연 → "연이"
            if (firstChar != lastChar)
                nicknames.Add(($"{lastChar}이", 3));

            // 6. 첫 글자 반복
            //    예: 준호 → "준준이", 서연 → "서서"
            var doubled = $"{firstChar}{firstChar}";
            nicknames.Add((doubled, 3));
            nicknames.Add(($"{doubled}이", 3));

            // 7. 끝 글자 반복 + 이
            //    예: 준호 → "호호", 서연 → "연연이"
            if (firstChar != lastChar)
            {
                var lastDoubled = $"{lastChar}{lastChar}";
                nicknames.Add((lastDoubled, 4));
                nicknames.Add(($"{lastDoubled}이", 4));
            }

            // 8. 첫 글자 + 귀여운 접미사
            //    예: 민서 → "민뽀", "민링", "민콩"
            foreach (var suffix in CuteSuffixes)
            {
                nicknames.Add(($"{firstChar}{suffix}", 5));
            }

            // 9. 이름 뒤집기 (2글자 이름만)
            //    예: 민서 → "서민"
            if (name.Length == 2)
            {
                nicknames.Add(($"{name[1]}{name[0]}", 4));
            }

            // 10. 한자 의미 기반 별명
            var hanjaInfo = GetHanjaInfoForName(name);
            if (hanjaInfo != null)
            {
                var meaningfulHanja = hanjaInfo.FirstOrDefault(h =>
                    !string.IsNullOrEmpty(h.Meaning) && h.Meaning.Length >= 2);
                if (meaningfulHanja != null)
                {
                    var meaning = meaningfulHanja.Meaning;
                    if (meaning.Length >= 2 && meaning.Length <= 5)
                        nicknames.Add((meaning, 2));
                    if (meaning.Length >= 1)
                        nicknames.Add(($"{meaning[0]}{meaning[0]}", 5));
                }
            }
        }

        // 필터링: 2~5글자, 금칙어 제외, 중복 제거, 우선순위 정렬
        var filtered = nicknames
            .Where(n => n.nickname.Length >= 2 && n.nickname.Length <= 5)
            .Where(n => !ContainsInappropriateWord(n.nickname))
            .GroupBy(n => n.nickname)
            .Select(g => (nickname: g.Key, priority: g.Min(x => x.priority)))
            .OrderBy(n => n.priority)
            .Select(n => n.nickname)
            .Take(10)
            .ToList();

        return await Task.FromResult(filtered);
    }

    /// <summary>
    /// 이름의 한자 정보 가져오기
    /// </summary>
    private List<HanjaData.HanjaInfo>? GetHanjaInfoForName(string name)
    {
        var result = new List<HanjaData.HanjaInfo>();

        foreach (char c in name)
        {
            var hanjaList = HanjaData.FindByReading(c.ToString());
            if (hanjaList.Any())
            {
                result.AddRange(hanjaList);
            }
        }

        return result.Any() ? result : null;
    }

    /// <summary>
    /// 부적절한 단어 포함 여부 체크 (HashSet O(1) 조회)
    /// </summary>
    private static bool ContainsInappropriateWord(string nickname)
    {
        // 전체 일치
        if (InappropriateWords.Contains(nickname))
            return true;

        // 부분 포함
        foreach (var word in InappropriateWords)
        {
            if (nickname.Contains(word))
                return true;
        }

        return false;
    }
}
