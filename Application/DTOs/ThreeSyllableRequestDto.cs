namespace NameForm.Application.DTOs;

/// <summary>
/// 3글자 이름 추천 요청 DTO
/// </summary>
public class ThreeSyllableRequestDto
{
    /// <summary>성씨 (필수)</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>성별: male, female, none</summary>
    public string Gender { get; set; } = "none";

    /// <summary>톤: neutral, soft, strong</summary>
    public string Tone { get; set; } = "neutral";

    /// <summary>이름 유형: pure-korean, hanja, mixed</summary>
    public string NameType { get; set; } = "pure-korean";

    /// <summary>생성할 후보 수 (1~50)</summary>
    public int Count { get; set; } = 20;
}
