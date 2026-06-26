using NameForm.Application.Engines;

namespace NameForm.Application.Services;

/// <summary>
/// 한 이름에 대한 정식 채점 결과. 모든 페이지/엔드포인트가 이 값을 사용해야 함.
/// 같은 입력(name, lastName, birthDate, gender, tone)이면 항상 같은 결과를 반환한다.
/// </summary>
public class CanonicalNameScore
{
    public AestheticBreakdown Aesthetic { get; set; } = new();
    public int AestheticScore { get; set; }

    public HarmonyBreakdown Harmony { get; set; } = new();
    public int HarmonyScore { get; set; }

    public int RarityScore { get; set; }

    /// <summary>= Math.Round(aesthetic*0.7 + harmony*0.3), 0~100 clamp.</summary>
    public int FinalScore { get; set; }
}

/// <summary>
/// 이름 채점의 단일 진실의 원천(single source of truth).
///
/// 정규화 규칙:
///   - gender/tone은 항상 소문자로 통일 (case-insensitive)
///   - FinalScore는 Math.Round 일관 적용 (int cast 금지)
///
/// 호출처: NameEvaluationService(/evaluate), RecommendationService(추천 후보 채점)
/// → smart의 TopPick과 evaluate의 점수가 구조적으로 일치하도록 보장한다.
/// </summary>
public interface IScoringService
{
    Task<CanonicalNameScore> EvaluateAsync(
        string firstName,
        string lastName,
        DateTime? birthDate,
        string gender,
        string tone,
        TimeSpan? birthTime = null);
}
