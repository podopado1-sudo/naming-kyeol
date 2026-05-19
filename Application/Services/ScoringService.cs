using NameForm.Application.Engines;

namespace NameForm.Application.Services;

/// <summary>
/// 이름 채점의 단일 진실의 원천. IScoringService 참조.
/// </summary>
public class ScoringService : IScoringService
{
    private readonly IAestheticEngine _aestheticEngine;
    private readonly IHarmonyEngine _harmonyEngine;
    private readonly IRarityScoringEngine _rarityScoringEngine;

    public ScoringService(
        IAestheticEngine aestheticEngine,
        IHarmonyEngine harmonyEngine,
        IRarityScoringEngine rarityScoringEngine)
    {
        _aestheticEngine = aestheticEngine;
        _harmonyEngine = harmonyEngine;
        _rarityScoringEngine = rarityScoringEngine;
    }

    public async Task<CanonicalNameScore> EvaluateAsync(
        string firstName,
        string lastName,
        DateTime birthDate,
        string gender,
        string tone,
        TimeSpan? birthTime = null)
    {
        // 정규화 — 어떤 호출자가 "Female"/"Male"/"Neutral" 같이 보내도 동일하게 처리
        var normalizedGender = NormalizeGender(gender);
        var normalizedTone = NormalizeTone(tone);

        var aesthetic = await _aestheticEngine.CalculateScoreWithBreakdownAsync(
            firstName, lastName, normalizedTone, normalizedGender);

        var harmony = await _harmonyEngine.CalculateScoreWithBreakdownAsync(
            firstName, lastName, birthDate, normalizedGender, birthTime);

        var rarity = await _rarityScoringEngine.CalculateRarityScoreAsync(firstName);

        // FinalScore 단일 공식 — Math.Round 일관 (int cast 금지)
        int finalScore = (int)Math.Round(aesthetic.TotalScore * 0.7 + harmony.TotalScore * 0.3);
        finalScore = Math.Clamp(finalScore, 0, 100);

        return new CanonicalNameScore
        {
            Aesthetic = aesthetic,
            AestheticScore = aesthetic.TotalScore,
            Harmony = harmony,
            HarmonyScore = harmony.TotalScore,
            RarityScore = rarity,
            FinalScore = finalScore
        };
    }

    public static string NormalizeGender(string? gender)
    {
        var g = (gender ?? "none").Trim().ToLowerInvariant();
        return g is "male" or "female" or "none" ? g : "none";
    }

    public static string NormalizeTone(string? tone)
    {
        var t = (tone ?? "neutral").Trim().ToLowerInvariant();
        return t is "soft" or "strong" or "neutral" ? t : "neutral";
    }
}
