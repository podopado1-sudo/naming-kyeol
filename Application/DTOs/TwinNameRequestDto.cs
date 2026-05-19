using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

public class TwinNameRequestDto
{
    /// <summary>성 (예: "이")</summary>
    [Required, StringLength(2, MinimumLength = 1)]
    public string LastName { get; set; } = string.Empty;

    /// <summary>출생일 (YYYY-MM-DD)</summary>
    [StringLength(10)]
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>출생 시각 (HH:mm, 선택)</summary>
    [StringLength(8)]
    public string? BirthTime { get; set; }

    /// <summary>성별 ("male", "female", "none")</summary>
    [StringLength(10)]
    public string Gender { get; set; } = "none";

    /// <summary>톤 ("neutral", "soft", "strong")</summary>
    [StringLength(10)]
    public string Tone { get; set; } = "neutral";

    /// <summary>자녀 수 (2 또는 3)</summary>
    [Range(2, 3, ErrorMessage = "ChildCount는 2 또는 3이어야 합니다.")]
    public int ChildCount { get; set; } = 2;

    /// <summary>기존 형제/자매 이름 (선택). 각 이름은 10자 이내, 최대 5개.</summary>
    [MaxLength(5)]
    public List<string>? ExistingSiblingNames { get; set; }
}
