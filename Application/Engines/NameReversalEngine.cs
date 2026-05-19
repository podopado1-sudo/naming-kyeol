namespace NameForm.Application.Engines;

/// <summary>
/// 이름 뒤집기/변형 엔진 구현
/// 반전(이수지→지수이), 재조합(글자 조합), 음절교환(민준→준민) 지원
/// </summary>
public class NameReversalEngine : INameReversalEngine
{
    private static readonly HashSet<string> ForbiddenWords = new()
    {
        "바보", "멍청", "못난", "나쁜", "악", "흉", "죽", "병"
    };

    public async Task<List<NameVariant>> GenerateVariantsAsync(string name)
    {
        var variants = new List<NameVariant>();

        if (string.IsNullOrEmpty(name) || name.Length < 2)
            return await Task.FromResult(variants);

        // 1. 반전 (전체 글자 순서 뒤집기)
        AddReversalVariants(name, variants);

        // 2. 음절교환 (인접 음절 swap)
        AddSyllableSwapVariants(name, variants);

        // 3. 재조합 (글자 조합으로 새 이름)
        AddRecombinationVariants(name, variants);

        // 중복 제거 및 원본과 동일한 것 제거
        var result = variants
            .Where(v => v.Name != name)
            .GroupBy(v => v.Name)
            .Select(g => g.First())
            .ToList();

        return await Task.FromResult(result);
    }

    /// <summary>
    /// 반전: 글자 순서를 완전히 뒤집기
    /// 예: "수지" → "지수", "민서준" → "준서민"
    /// </summary>
    private void AddReversalVariants(string name, List<NameVariant> variants)
    {
        var reversed = new string(name.Reverse().ToArray());
        if (IsValidKoreanName(reversed))
        {
            variants.Add(new NameVariant
            {
                Name = reversed,
                VariationType = "반전",
                Description = $"'{name}' → '{reversed}' (전체 반전)"
            });
        }
    }

    /// <summary>
    /// 음절교환: 인접한 음절 쌍을 교환
    /// 예: "민준" → "준민", "서연아" → "연서아", "서아연"
    /// </summary>
    private void AddSyllableSwapVariants(string name, List<NameVariant> variants)
    {
        var chars = name.ToCharArray();

        for (int i = 0; i < chars.Length - 1; i++)
        {
            var swapped = (char[])chars.Clone();
            (swapped[i], swapped[i + 1]) = (swapped[i + 1], swapped[i]);
            var swappedName = new string(swapped);

            if (swappedName != name && IsValidKoreanName(swappedName))
            {
                variants.Add(new NameVariant
                {
                    Name = swappedName,
                    VariationType = "음절교환",
                    Description = $"'{name}' → '{swappedName}' ({i + 1}번째-{i + 2}번째 음절 교환)"
                });
            }
        }
    }

    /// <summary>
    /// 재조합: 글자들의 부분 조합으로 새 이름 생성
    /// 예: "민서준" → "민준", "서준", "준민" 등
    /// </summary>
    private void AddRecombinationVariants(string name, List<NameVariant> variants)
    {
        if (name.Length < 3)
            return;

        var chars = name.ToCharArray();

        // 2글자 조합 생성
        for (int i = 0; i < chars.Length; i++)
        {
            for (int j = 0; j < chars.Length; j++)
            {
                if (i == j) continue;
                var combo = chars[i].ToString() + chars[j].ToString();
                if (combo != name && IsValidKoreanName(combo))
                {
                    variants.Add(new NameVariant
                    {
                        Name = combo,
                        VariationType = "재조합",
                        Description = $"'{name}'에서 '{combo}' 재조합"
                    });
                }
            }
        }
    }

    private static bool IsValidKoreanName(string name)
    {
        if (string.IsNullOrEmpty(name) || name.Length < 2)
            return false;

        if (ForbiddenWords.Any(f => name.Contains(f)))
            return false;

        // 한글 완성형만 허용
        return name.All(c => c >= 0xAC00 && c <= 0xD7A3);
    }
}
