using System.ComponentModel.DataAnnotations;

namespace NameForm.Application.DTOs;

/// <summary>
/// 필수 글자 포함 이름 추천 요청 DTO
/// </summary>
public class RequiredCharRequest
{
    /// <summary>성 (예: "김")</summary>
    [Required, StringLength(2, MinimumLength = 1)]
    public string LastName { get; set; } = string.Empty;

    /// <summary>필수 포함 글자 (한글 발음, 예: "준", "영")</summary>
    [StringLength(1)]
    public string RequiredChar { get; set; } = string.Empty;

    /// <summary>
    /// 항렬자 (한자 1글자, 선택). 지정 시 해당 한자가 정확히 포함된 후보만 생성.
    /// 형제자매 공유 한자(돌림자) 용도.
    /// 발음(RequiredChar)이 비어있으면 한자의 음으로 자동 도출.
    /// </summary>
    [StringLength(1)]
    public string? RequiredHanja { get; set; }

    /// <summary>위치: "first"(첫 글자), "last"(끝 글자), "any"(어디든)</summary>
    [StringLength(10)]
    public string Position { get; set; } = "any";

    /// <summary>출생일 (YYYY-MM-DD)</summary>
    [StringLength(10)]
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>출생 시각 (HH:mm, 선택)</summary>
    [StringLength(8)]
    public string? BirthTime { get; set; }

    /// <summary>성별: "male", "female", "none"</summary>
    [StringLength(10)]
    public string Gender { get; set; } = "none";

    /// <summary>톤: "neutral", "soft", "strong"</summary>
    [StringLength(10)]
    public string Tone { get; set; } = "neutral";
}
