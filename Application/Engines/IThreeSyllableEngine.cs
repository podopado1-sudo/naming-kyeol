using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines;

/// <summary>
/// 3글자 이름 추천 엔진 인터페이스
/// 성씨+3글자 = 4음절 이름 생성 (순우리말/한자/혼합)
/// </summary>
public interface IThreeSyllableEngine
{
    /// <summary>
    /// 3글자 이름 후보 생성
    /// </summary>
    /// <param name="lastName">성씨</param>
    /// <param name="gender">성별 (male, female, none)</param>
    /// <param name="tone">톤 (soft, strong, neutral)</param>
    /// <param name="nameType">이름 유형 (pure-korean, hanja, mixed)</param>
    /// <param name="count">생성할 후보 수</param>
    Task<List<ThreeSyllableCandidate>> GenerateCandidatesAsync(
        string lastName,
        string gender,
        string tone,
        string nameType,
        int count);
}

/// <summary>
/// 3글자 이름 후보
/// </summary>
public class ThreeSyllableCandidate
{
    /// <summary>이름 (3글자, 예: "여울결")</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>성+이름 (예: "최여울결")</summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>뜻풀이</summary>
    public string Meaning { get; set; } = string.Empty;

    /// <summary>이름 유형 (pure-korean, hanja, mixed)</summary>
    public string NameType { get; set; } = string.Empty;

    /// <summary>조합 요소들</summary>
    public List<string> Components { get; set; } = new();

    /// <summary>성씨와의 발음 조화 점수 (0~100)</summary>
    public double PronunciationScore { get; set; }

    /// <summary>후보의 성별 태그 (male/female/neutral)</summary>
    public string GenderTag { get; set; } = "neutral";

    /// <summary>후보의 톤 태그 (soft/strong/neutral)</summary>
    public string ToneTag { get; set; } = "neutral";

    /// <summary>
    /// 음운 특성 노트 (감점 없음, Explanation 용도).
    /// 하드필터를 통과한 이름에만 붙는 정보 노출용 노트.
    /// 2026-04-21 옵션 C Phase 2.
    /// </summary>
    public List<PhonologyNote> PhonologyNotes { get; set; } = new();
}
