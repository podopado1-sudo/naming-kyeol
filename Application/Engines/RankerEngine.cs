using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Domain.Models;

namespace NameForm.Application.Engines;

/// <summary>
/// 최종 점수 계산 및 랭킹 엔진
/// finalScore = aesthetic * 0.7 + harmony * 0.3
/// + 용신 이중 보너스:
///   - 자원오행(한자 오행) 일치: +8점
///   - 음령오행(초성 오행) 일치: +5점
///   - 둘 다 일치: +13점 (상한 100)
/// </summary>
public class RankerEngine : IRankerEngine
{
    private const double AestheticWeight = 0.7;
    private const double HarmonyWeight = 0.3;
    private const int HanjaElementBonus  = 8; // 자원오행 일치 보너스
    private const int EumryeongBonus     = 5; // 음령오행 일치 보너스

    public async Task<List<Candidate>> RankCandidatesAsync(
        List<Candidate> candidates, string? preferredFiveElement = null)
    {
        foreach (var candidate in candidates)
        {
            int baseScore = (int)Math.Round(
                candidate.AestheticScore * AestheticWeight +
                candidate.HarmonyScore * HarmonyWeight
            );

            int bonus = 0;
            if (!string.IsNullOrEmpty(preferredFiveElement))
            {
                // ① 자원오행 보너스: 한자 후보 중 용신 오행 있으면 +8
                bool hanjaMatch = candidate.Name.Any(syllable =>
                    HanjaData.FindByReading(syllable.ToString())
                        .Any(h => h.FiveElement == preferredFiveElement));
                if (hanjaMatch) bonus += HanjaElementBonus;

                // ② 음령오행 보너스: 초성 오행이 용신과 일치하면 +5
                bool eumryeongMatch = KoreanUtils.HasEumryeongMatch(
                    candidate.Name, preferredFiveElement);
                if (eumryeongMatch) bonus += EumryeongBonus;
            }

            candidate.FinalScore = Math.Min(100, baseScore + bonus);
        }

        var ranked = candidates
            .OrderByDescending(c => c.FinalScore)
            .ThenByDescending(c => c.AestheticScore)
            .ToList();

        return await Task.FromResult(ranked);
    }
}
