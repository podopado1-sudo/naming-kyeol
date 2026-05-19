namespace NameForm.Application.Engines;

/// <summary>
/// 쌍둥이/형제 이름 세트 생성 엔진 인터페이스
/// </summary>
public interface ITwinNameEngine
{
    /// <summary>
    /// 조화로운 이름 세트 생성 (공유글자/공유의미/공유톤 패턴)
    /// </summary>
    Task<List<TwinNameSet>> GenerateTwinSetsAsync(
        string lastName,
        DateTime birthDate,
        string gender,
        string tone,
        int childCount,
        List<string>? existingSiblingNames);
}

/// <summary>
/// 쌍둥이 이름 세트
/// </summary>
public class TwinNameSet
{
    /// <summary>세트 유형: "공유글자", "공유의미", "공유톤"</summary>
    public string Theme { get; set; } = string.Empty;

    /// <summary>세트 설명</summary>
    public string ThemeDescription { get; set; } = string.Empty;

    /// <summary>이름 목록</summary>
    public List<string> Names { get; set; } = new();

    /// <summary>세트 조화도 (0-100)</summary>
    public int CoherenceScore { get; set; }
}
