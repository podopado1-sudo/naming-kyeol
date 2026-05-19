namespace NameForm.Application.DTOs;

/// <summary>
/// 별명 생성 요청 DTO
/// </summary>
public class NicknameRequestDto
{
    /// <summary>성 (예: "김")</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>이름 목록 (예: ["민서", "지현"])</summary>
    public List<string> Names { get; set; } = new();
}
