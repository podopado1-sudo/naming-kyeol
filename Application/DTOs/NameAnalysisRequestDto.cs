using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

public class NameAnalysisRequestDto
{
    /// <summary>성 (예: "김", "남궁")</summary>
    [Required, StringLength(2, MinimumLength = 1)]
    public string LastName { get; set; } = string.Empty;

    /// <summary>이름 (예: "민준", "서연")</summary>
    [Required, StringLength(10, MinimumLength = 1)]
    public string FirstName { get; set; } = string.Empty;

    /// <summary>출생일 (YYYY-MM-DD 형식, 선택 - 조화/사주 계산에 필요)</summary>
    [StringLength(10)]
    public string? BirthDate { get; set; }

    /// <summary>출생 시간 (HH:mm 형식, 선택 - 시주 계산에 필요)</summary>
    [StringLength(8)]
    public string? BirthTime { get; set; }

    /// <summary>
    /// 출생지 코드 (선택, 기본값: seoul) — 진태양시 보정에 사용
    /// 예: "seoul", "busan", "jeju" 등
    /// </summary>
    [StringLength(20)]
    public string? BirthplaceCode { get; set; }

    /// <summary>성별 ("male", "female", "none")</summary>
    [StringLength(10)]
    public string Gender { get; set; } = "none";

    /// <summary>톤 ("neutral", "soft", "strong")</summary>
    [StringLength(10)]
    public string Tone { get; set; } = "neutral";
}
