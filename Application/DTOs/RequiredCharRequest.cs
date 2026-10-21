using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

/// <summary>
/// 필수 글자 포함 이름 추천 요청 DTO
/// </summary>
public class RequiredCharRequest
{
    /// <summary>성 (예: "김")</summary>
    [Required(ErrorMessage = "성씨는 필수입니다."), StringLength(2, MinimumLength = 1, ErrorMessage = "성씨는 1~2자여야 합니다.")]
    public string LastName { get; set; } = string.Empty;

    /// <summary>필수 포함 글자 (한글 발음, 예: "준", "영")</summary>
    [StringLength(1, ErrorMessage = "필수 글자는 한 글자여야 합니다.")]
    public string RequiredChar { get; set; } = string.Empty;

    /// <summary>
    /// 항렬자 (한자 1글자, 선택). 지정 시 해당 한자가 정확히 포함된 후보만 생성.
    /// 형제자매 공유 한자(돌림자) 용도.
    /// 발음(RequiredChar)이 비어있으면 한자의 음으로 자동 도출.
    /// </summary>
    [StringLength(1, ErrorMessage = "항렬자는 한자 한 글자여야 합니다.")]
    public string? RequiredHanja { get; set; }

    /// <summary>위치: "first"(첫 글자), "last"(끝 글자), "any"(어디든)</summary>
    [StringLength(10, ErrorMessage = "위치는 'first', 'last', 'any' 중 하나여야 합니다.")]
    public string Position { get; set; } = "any";

    /// <summary>출생일 (YYYY-MM-DD)</summary>
    [StringLength(10, ErrorMessage = "생년월일은 YYYY-MM-DD 형식이어야 합니다.")]
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>출생 시각 (HH:mm, 선택)</summary>
    [StringLength(8, ErrorMessage = "출생 시각은 HH:mm 또는 HH:mm:ss 형식이어야 합니다.")]
    public string? BirthTime { get; set; }

    /// <summary>성별: "male", "female", "none"</summary>
    [StringLength(10, ErrorMessage = "성별은 'male', 'female', 'none' 중 하나여야 합니다.")]
    public string Gender { get; set; } = "none";

    /// <summary>톤: "neutral", "soft", "strong"</summary>
    [StringLength(10, ErrorMessage = "톤은 'neutral', 'soft', 'strong' 중 하나여야 합니다.")]
    public string Tone { get; set; } = "neutral";
}
