namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 음운 변환 유틸리티 (두음법칙 역행 처리 등)
/// </summary>
public static class PhoneticVariationUtils
{
    /// <summary>
    /// 성씨 변주 매핑 (문소리 모델: 이 -> 리)
    /// </summary>
    private static readonly Dictionary<string, List<string>> SurnameVariants = new()
    {
        { "이", new List<string> { "리", "아", "니" } },
        { "나", new List<string> { "라", "나", "다" } },
        { "노", new List<string> { "로", "루" } },
        { "유", new List<string> { "류", "리" } },
        { "임", new List<string> { "림" } },
        { "라", new List<string> { "나", "라" } },
        { "로", new List<string> { "노", "로" } },
        { "류", new List<string> { "유", "류" } },
        { "림", new List<string> { "임", "림" } }
    };

    /// <summary>
    /// 성씨를 이름 끝에 올 때 두음법칙 역행 처리
    /// 예: "이" -> "리", "나" -> "라"
    /// </summary>
    public static string ApplySurnameVariant(string surname)
    {
        if (string.IsNullOrEmpty(surname))
            return string.Empty;

        // 성씨 변주 매핑에서 찾기
        if (SurnameVariants.TryGetValue(surname, out var variants) && variants.Count > 0)
        {
            return variants[0]; // 첫 번째 변주 사용
        }

        return surname; // 변주가 없으면 원래 성씨 반환
    }

    /// <summary>
    /// 성씨의 모든 변주 반환
    /// </summary>
    public static List<string> GetAllVariants(string surname)
    {
        if (string.IsNullOrEmpty(surname))
            return new List<string>();

        if (SurnameVariants.TryGetValue(surname, out var variants))
        {
            return new List<string>(variants);
        }

        return new List<string> { surname };
    }

    /// <summary>
    /// 이름 끝에 성씨를 붙일 때 변주 적용
    /// 예: "소" + "이" -> "소리"
    /// </summary>
    public static string AppendSurnameAsSuffix(string baseName, string surname)
    {
        if (string.IsNullOrEmpty(baseName) || string.IsNullOrEmpty(surname))
            return baseName;

        var variant = ApplySurnameVariant(surname);
        return baseName + variant;
    }

    /// <summary>
    /// 이름 앞에 성씨를 붙일 때 (윤고은 모델)
    /// </summary>
    public static string PrependSurnameAsPrefix(string surname, string baseName)
    {
        if (string.IsNullOrEmpty(surname) || string.IsNullOrEmpty(baseName))
            return baseName;

        return surname + baseName;
    }
}
