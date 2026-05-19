namespace NameForm.Application.DTOs;

/// <summary>
/// 순우리말 이름 추천 요청 DTO
/// </summary>
public class PureKoreanRequestDto
{
    /// <summary>성 (예: "이", "김")</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>성별 ("male", "female", "none")</summary>
    public string Gender { get; set; } = "none";

    /// <summary>톤 ("neutral", "soft", "strong")</summary>
    public string Tone { get; set; } = "neutral";

    /// <summary>추천 개수 (1~50, 기본 10)</summary>
    public int Count { get; set; } = 10;
}

/// <summary>
/// 순우리말 이름 추천 응답 DTO
/// </summary>
public class PureKoreanResponseDto
{
    /// <summary>요청한 성씨</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>추천된 순우리말 이름 목록</summary>
    public List<PureKoreanCandidateDto> Candidates { get; set; } = new();

    /// <summary>총 후보 수</summary>
    public int TotalCount { get; set; }
}

/// <summary>
/// 순우리말 이름 후보 DTO
/// </summary>
public class PureKoreanCandidateDto
{
    /// <summary>전체 이름 (성+이름)</summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>이름 (순우리말 부분만)</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>뜻풀이</summary>
    public string Meaning { get; set; } = string.Empty;

    /// <summary>어원 설명</summary>
    public string Origin { get; set; } = string.Empty;

    /// <summary>성별 적합도</summary>
    public string GenderFit { get; set; } = string.Empty;

    /// <summary>톤 적합도</summary>
    public string ToneFit { get; set; } = string.Empty;

    /// <summary>성씨와의 발음 조화 점수 (0~100)</summary>
    public int PronunciationScore { get; set; }
}
