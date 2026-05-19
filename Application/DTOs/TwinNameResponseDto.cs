namespace NameForm.Application.DTOs;

public class TwinNameResponseDto
{
    public string Id { get; set; } = string.Empty;
    public List<TwinNameSetDto> NameSets { get; set; } = new();
}

public class TwinNameSetDto
{
    /// <summary>세트 유형: "공유글자", "공유의미", "공유톤"</summary>
    public string Theme { get; set; } = string.Empty;

    /// <summary>세트 설명</summary>
    public string ThemeDescription { get; set; } = string.Empty;

    /// <summary>이름 목록 (채점 포함)</summary>
    public List<TwinCandidateDto> Names { get; set; } = new();

    /// <summary>세트 조화도 (0-100)</summary>
    public int CoherenceScore { get; set; }
}

public class TwinCandidateDto
{
    public string Name { get; set; } = string.Empty;
    public int AestheticScore { get; set; }
    public int HarmonyScore { get; set; }
    public int FinalScore { get; set; }
    public List<string> Reasons { get; set; } = new();
}
