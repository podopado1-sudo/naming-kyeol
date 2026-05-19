namespace NameForm.Application.DTOs;

/// <summary>
/// 영어+한자 이중 이름 요청 DTO
/// </summary>
public class DualNameRequestDto
{
    /// <summary>성 (예: "김")</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>선호 영어 이름 (선택, 예: "Philip")</summary>
    public string? PreferredEnglishName { get; set; }

    /// <summary>출생일 (YYYY-MM-DD)</summary>
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>출생 시각 (HH:mm, 선택)</summary>
    public string? BirthTime { get; set; }

    /// <summary>성별 ("male", "female", "none")</summary>
    public string Gender { get; set; } = "none";

    /// <summary>톤 ("neutral", "soft", "strong")</summary>
    public string Tone { get; set; } = "neutral";
}
