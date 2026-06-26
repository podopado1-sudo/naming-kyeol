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
        DateTime? birthDate,
        string gender,
        string tone,
        TimeSpan? birthTime = null)
    {
        // 정규화 — 어떤 호출자가 "Female"/"Male"/"Neutral" 같이 보내도 동일하게 처리
        var normalizedGender = NormalizeGender(gender);
        var normalizedTone = NormalizeTone(tone);

        // birthDate.Year를 넘겨 세대 적합도 보정을 활성화 (신생아=출생연도 기준).
        // 출생일이 없으면 birthYear=null → 세대 적합 자동 skip (미학 엔진이 이미 지원).
        var aesthetic = await _aestheticEngine.CalculateScoreWithBreakdownAsync(
            firstName, lastName, normalizedTone, normalizedGender, birthDate?.Year);

        // 조화(사주/오행)는 출생일이 있어야 산정 가능. 없으면 미학 점수만 평가한다(UI 약속).
        HarmonyBreakdown harmony;
        if (birthDate.HasValue)
        {
            harmony = await _harmonyEngine.CalculateScoreWithBreakdownAsync(
                firstName, lastName, birthDate.Value, normalizedGender, birthTime);
        }
        else
        {
            harmony = new HarmonyBreakdown
            {
                Notes = new List<string>
                {
                    "출생일을 입력하지 않아 사주 기반 조화는 산정하지 않았습니다. 미학 점수만 평가됩니다.",
                },
            };
        }

        var rarity = await _rarityScoringEngine.CalculateRarityScoreAsync(firstName);

        // FinalScore 단일 공식 — Math.Round 일관 (int cast 금지).
        // 출생일이 없으면 조화를 빼고 미학 점수만(0.7/0.3 가중 대신 미학 100%).
        int finalScore = birthDate.HasValue
            ? (int)Math.Round(aesthetic.TotalScore * 0.7 + harmony.TotalScore * 0.3)
            : aesthetic.TotalScore;
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
