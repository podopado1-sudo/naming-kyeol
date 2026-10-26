using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Domain.Models;

namespace NameForm.Application.Engines;

/// <summary>
/// 최종 점수 계산 및 랭킹 엔진
/// finalScore = aesthetic * 0.7 + harmony * 0.3
/// + 용신 이중 보너스:
///   - 자원오행(배정 한자 오행 — Candidate.SyllableHanja) 일치: +8점
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
                // ① 자원오행 보너스: 카드에 보이는 배정 한자(candidate.SyllableHanja) 중 용신 오행이 있으면 +8 (2026-10-26 결정 ③).
                // 옛 규칙은 음절의 쓸 수 있는 글자 중 하나라도 그 오행이면 줬다 — 배정 智(火)인 '지'가 水 글자 때문에 水 보너스를 받는 식(308쌍)
                bool hanjaMatch = AssignedHanjaHasElement(candidate.SyllableHanja, preferredFiveElement);
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

    /// <summary>
    /// 배정 한자(음절별 글자, null = 배정 없음) 중 그 자원오행 글자가 있는지. 이름에 쓸 수 있는 글자(HanjaSelector.IsUsableNameHanja —
    /// 불용 아님 + 뜻 있음)만 센다 — 미학 성별 판정과 같은 정의. 배정 한자가 없으면(null·전부 null) 보너스도 없다:
    /// 같은 독음의 다른 글자로 대신 판정하지 않는다. /name-analysis '용신에 부합' 배지(NameAnalysisService, 큰 카드 = 배정 한자)도 이 정의를 쓴다.
    /// </summary>
    public static bool AssignedHanjaHasElement(IReadOnlyList<string?>? syllableHanja, string element)
        => !string.IsNullOrEmpty(element) && syllableHanja != null && syllableHanja.Any(ch =>
            ch != null
            && HanjaData.FindByCharacter(ch) is { } h
            && HanjaSelector.IsUsableNameHanja(h)
            && h.FiveElement == element);
}
