namespace NameForm.Application.DTOs;

/// <summary>
/// 부모 기반 작명 요청 DTO
/// </summary>
public class ParentBasedRequestDto
{
    /// <summary>성 (예: "김")</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>아버지 성 (선택)</summary>
    public string? FatherSurname { get; set; }

    /// <summary>아버지 이름 (선택)</summary>
    public string? FatherName { get; set; }

    /// <summary>어머니 성 (선택)</summary>
    public string? MotherSurname { get; set; }

    /// <summary>어머니 이름 (선택)</summary>
    public string? MotherName { get; set; }

    /// <summary>스토리 키워드 (선택, 예: "사랑", "희망")</summary>
    public string? StoryKeyword { get; set; }

    /// <summary>출생일 (YYYY-MM-DD)</summary>
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>출생 시각 (HH:mm, 선택)</summary>
    public string? BirthTime { get; set; }

    /// <summary>성별 ("male", "female", "none")</summary>
    public string Gender { get; set; } = "none";

    /// <summary>톤 ("neutral", "soft", "strong")</summary>
    public string Tone { get; set; } = "neutral";
}
