namespace NameForm.Application.Engines;

/// <summary>
/// 순우리말 이름 추천 엔진 인터페이스
/// 한자 없이 순우리말만으로 이름을 생성한다.
/// </summary>
public interface IPureKoreanNameEngine
{
    /// <summary>
    /// 순우리말 이름 후보 생성
    /// </summary>
    /// <param name="lastName">성씨</param>
    /// <param name="gender">성별 (male, female, none)</param>
    /// <param name="tone">톤 (soft, strong, neutral)</param>
    /// <param name="count">생성할 후보 수</param>
    Task<List<PureKoreanCandidate>> GenerateCandidatesAsync(
        string lastName,
        string gender,
        string tone,
        int count);
}

/// <summary>
/// 순우리말 이름 후보
/// </summary>
public class PureKoreanCandidate
{
    /// <summary>이름 (예: "하늘")</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>뜻풀이 (예: "하늘처럼 높고 넓은")</summary>
    public string Meaning { get; set; } = string.Empty;

    /// <summary>순우리말 어원 (예: "하늘 - 고유어, 천공을 뜻하는 순우리말")</summary>
    public string Origin { get; set; } = string.Empty;

    /// <summary>성별 적합도: male, female, neutral</summary>
    public string GenderFit { get; set; } = string.Empty;

    /// <summary>톤 적합도: soft, strong, neutral</summary>
    public string ToneFit { get; set; } = string.Empty;

    /// <summary>성씨와의 발음 조화 점수 (0~100)</summary>
    public int PronunciationScore { get; set; }
}
