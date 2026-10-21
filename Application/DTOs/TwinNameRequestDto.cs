using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

public class TwinNameRequestDto
{
    /// <summary>성 (예: "이")</summary>
    [Required(ErrorMessage = "성씨는 필수입니다."), StringLength(2, MinimumLength = 1, ErrorMessage = "성씨는 1~2자여야 합니다.")]
    public string LastName { get; set; } = string.Empty;

    /// <summary>출생일 (YYYY-MM-DD)</summary>
    [StringLength(10, ErrorMessage = "생년월일은 YYYY-MM-DD 형식이어야 합니다.")]
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>출생 시각 (HH:mm, 선택)</summary>
    [StringLength(8, ErrorMessage = "출생 시각은 HH:mm 또는 HH:mm:ss 형식이어야 합니다.")]
    public string? BirthTime { get; set; }

    /// <summary>성별 ("male", "female", "none")</summary>
    [StringLength(10, ErrorMessage = "성별은 'male', 'female', 'none' 중 하나여야 합니다.")]
    public string Gender { get; set; } = "none";

    /// <summary>톤 ("neutral", "soft", "strong")</summary>
    [StringLength(10, ErrorMessage = "톤은 'neutral', 'soft', 'strong' 중 하나여야 합니다.")]
    public string Tone { get; set; } = "neutral";

    /// <summary>자녀 수 (2 또는 3)</summary>
    [Range(2, 3, ErrorMessage = "자녀 수는 2 또는 3이어야 합니다.")]
    public int ChildCount { get; set; } = 2;

    /// <summary>기존 형제/자매 이름 (선택). 각 이름은 10자 이내, 최대 5개.</summary>
    [MaxLength(5, ErrorMessage = "기존 형제자매 이름은 최대 5개까지 넣을 수 있습니다.")]
    public List<string>? ExistingSiblingNames { get; set; }
}
