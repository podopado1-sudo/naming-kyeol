namespace NameForm.Application.Engines;

/// <summary>
/// 특이/희귀 성씨 최적화 이름 추천 엔진 인터페이스
/// 희귀 성씨의 발음 특성을 분석하고, 성씨와 조화로운 이름을 추천한다.
/// </summary>
public interface IRareSurnameEngine
{
    /// <summary>
    /// 성씨 분석 및 최적화된 이름 추천
    /// </summary>
    /// <param name="lastName">성씨</param>
    /// <param name="birthDate">생년월일</param>
    /// <param name="gender">성별 (male, female, none)</param>
    /// <param name="tone">톤 (soft, strong, neutral)</param>
    /// <param name="count">추천 개수</param>
    Task<RareSurnameAnalysis> AnalyzeAndRecommendAsync(
        string lastName,
        DateTime birthDate,
        string gender,
        string tone,
        int count);
}

/// <summary>
/// 희귀 성씨 분석 결과 및 추천 이름 목록
/// </summary>
public class RareSurnameAnalysis
{
    /// <summary>성씨</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>희귀 성씨 여부</summary>
    public bool IsRareSurname { get; set; }

    /// <summary>희귀도 레벨: 1=흔함, 2=보통, 3=희귀, 4=매우희귀</summary>
    public int RarityLevel { get; set; }

    /// <summary>성씨 발음 분석 설명</summary>
    public string PhoneticAnalysis { get; set; } = string.Empty;

    /// <summary>추천 이름 후보 목록</summary>
    public List<RareSurnameCandidate> Candidates { get; set; } = new();
}

/// <summary>
/// 희귀 성씨용 이름 후보
/// </summary>
public class RareSurnameCandidate
{
    /// <summary>이름 (예: "서연")</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>성씨와의 발음 조화 점수 (0~100)</summary>
    public int HarmonyScore { get; set; }

    /// <summary>발음 조화 이유 설명</summary>
    public string HarmonyReason { get; set; } = string.Empty;

    /// <summary>한자 옵션 목록</summary>
    public List<string> HanjaOptions { get; set; } = new();
}
