using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

public class NameAnalysisRequestDto
{
    /// <summary>성 (예: "김", "남궁")</summary>
    [Required(ErrorMessage = "성씨는 필수입니다."), StringLength(2, MinimumLength = 1, ErrorMessage = "성씨는 1~2자여야 합니다.")]
    public string LastName { get; set; } = string.Empty;

    /// <summary>이름 (예: "민준", "서연")</summary>
    [Required(ErrorMessage = "이름은 필수입니다."), StringLength(10, MinimumLength = 1, ErrorMessage = "이름은 1~10자여야 합니다.")]
    public string FirstName { get; set; } = string.Empty;

    /// <summary>출생일 (YYYY-MM-DD 형식, 선택 - 조화/사주 계산에 필요)</summary>
    [StringLength(10, ErrorMessage = "생년월일은 YYYY-MM-DD 형식이어야 합니다.")]
    public string? BirthDate { get; set; }

    /// <summary>출생 시간 (HH:mm 형식, 선택 - 시주 계산에 필요)</summary>
    [StringLength(8, ErrorMessage = "출생 시각은 HH:mm 또는 HH:mm:ss 형식이어야 합니다.")]
    public string? BirthTime { get; set; }

    /// <summary>
    /// 출생지 코드 (선택, 기본값: seoul) — 진태양시 보정에 사용
    /// 예: "seoul", "busan", "jeju" 등
    /// </summary>
    [StringLength(20, ErrorMessage = "출생지 코드는 20자 이내여야 합니다.")]
    public string? BirthplaceCode { get; set; }

    /// <summary>성별 ("male", "female", "none")</summary>
    [StringLength(10, ErrorMessage = "성별은 'male', 'female', 'none' 중 하나여야 합니다.")]
    public string Gender { get; set; } = "none";

    /// <summary>톤 ("neutral", "soft", "strong")</summary>
    [StringLength(10, ErrorMessage = "톤은 'neutral', 'soft', 'strong' 중 하나여야 합니다.")]
    public string Tone { get; set; } = "neutral";
}
