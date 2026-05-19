namespace NameForm.Application.DTOs;

/// <summary>
/// 창의적 작명 요청 DTO
/// </summary>
public class CreativeNamingRequestDto
{
    public string LastName { get; set; } = string.Empty;
    public string Gender { get; set; } = "none";
    public string Tone { get; set; } = "neutral";
    public int Count { get; set; } = 20;
}
