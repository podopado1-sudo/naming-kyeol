namespace NameForm.Application.DTOs;

/// <summary>
/// 희귀 성씨 최적화 이름 추천 요청 DTO
/// </summary>
public class RareSurnameRequestDto
{
    /// <summary>성씨 (예: "봉", "빈", "탁")</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>생년월일 (YYYY-MM-DD)</summary>
    public string BirthDate { get; set; } = string.Empty;

    /// <summary>출생 시각 (HH:mm, 선택)</summary>
    public string? BirthTime { get; set; }

    /// <summary>성별 ("male", "female", "none")</summary>
    public string Gender { get; set; } = "none";

    /// <summary>톤 ("neutral", "soft", "strong")</summary>
    public string Tone { get; set; } = "neutral";

    /// <summary>추천 개수 (1~50, 기본 10)</summary>
    public int Count { get; set; } = 10;
}

/// <summary>
/// 희귀 성씨 최적화 이름 추천 응답 DTO
/// </summary>
public class RareSurnameResponseDto
{
    /// <summary>성씨</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>희귀 성씨 여부</summary>
    public bool IsRareSurname { get; set; }

    /// <summary>희귀도 레벨 (1~4)</summary>
    public int RarityLevel { get; set; }

    /// <summary>성씨 발음 분석</summary>
    public string PhoneticAnalysis { get; set; } = string.Empty;

    /// <summary>추천 이름 후보 수</summary>
    public int TotalCount { get; set; }

    /// <summary>추천 이름 후보 목록</summary>
    public List<RareSurnameCandidateDto> Candidates { get; set; } = new();
}

/// <summary>
/// 희귀 성씨용 이름 후보 DTO
/// </summary>
public class RareSurnameCandidateDto
{
    /// <summary>전체 이름 (성+이름)</summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>이름 부분</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>성씨와의 발음 조화 점수 (0~100)</summary>
    public int HarmonyScore { get; set; }

    /// <summary>발음 조화 이유</summary>
    public string HarmonyReason { get; set; } = string.Empty;

    /// <summary>한자 옵션 목록</summary>
    public List<string> HanjaOptions { get; set; } = new();
}
