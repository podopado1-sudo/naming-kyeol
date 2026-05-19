namespace NameForm.Application.Engines;

/// <summary>
/// 필수 글자 포함 이름 추천 엔진 인터페이스
/// 사용자가 지정한 글자(돌림자 등)를 반드시 포함하는 이름 생성
/// </summary>
public interface IRequiredCharEngine
{
    /// <summary>
    /// 필수 글자를 포함하는 이름 후보 생성
    /// </summary>
    /// <param name="lastName">성 (예: "김")</param>
    /// <param name="requiredChar">필수 포함 글자 (예: "준")</param>
    /// <param name="position">위치: "first"(첫 글자), "last"(끝 글자), "any"(어디든)</param>
    /// <param name="birthDate">출생일</param>
    /// <param name="gender">성별: "male", "female", "none"</param>
    /// <param name="tone">톤: "neutral", "soft", "strong"</param>
    Task<List<RequiredCharCandidate>> GenerateCandidatesAsync(
        string lastName,
        string requiredChar,
        string position,
        DateTime birthDate,
        string gender,
        string tone,
        string? requiredHanja = null);
}

/// <summary>
/// 필수 글자 포함 이름 후보
/// </summary>
public class RequiredCharCandidate
{
    /// <summary>이름 (성 제외, 예: "준서")</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>필수 포함된 글자</summary>
    public string RequiredChar { get; set; } = string.Empty;

    /// <summary>필수 글자 위치: "first", "last"</summary>
    public string Position { get; set; } = string.Empty;

    /// <summary>각 음절에 매칭되는 한자 옵션</summary>
    public List<string> HanjaOptions { get; set; } = new();

    /// <summary>고정된 항렬자 한자 (요청자가 RequiredHanja를 지정한 경우)</summary>
    public string? FixedHanja { get; set; }

    /// <summary>이름 의미 설명</summary>
    public string Meaning { get; set; } = string.Empty;
}
