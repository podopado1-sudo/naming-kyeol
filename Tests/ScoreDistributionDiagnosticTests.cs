using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;
using NameForm.Infrastructure.Repositories;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using Xunit.Abstractions;

namespace NameForm.Tests;

/// <summary>
/// P0 수정 후 점수 분포 검증 — 점수가 골고루 분산되는지, gender/tone에 반응하는지 확인
/// </summary>
public class ScoreDistributionDiagnosticTests
{
    private readonly ITestOutputHelper _output;
    private readonly IAestheticEngine _aesthetic;
    private readonly IHarmonyEngine _harmony;
    private readonly IExplanationEngine _explanation;
    private readonly IRarityScoringEngine _rarity;

    // 테스트용 이름 후보 20개 (남녀 혼합, 흔함/희귀 혼합)
    private static readonly (string surname, string name, string gender)[] TestNames = new[]
    {
        ("김", "서윤", "female"), ("김", "도현", "male"), ("이", "하은", "female"),
        ("박", "준서", "male"), ("최", "예린", "female"), ("정", "민재", "male"),
        ("강", "소율", "female"), ("조", "시우", "male"), ("윤", "채원", "female"),
        ("장", "건우", "male"), ("허", "나윤", "female"), ("봉", "태현", "male"),
        ("신", "해솜", "female"), ("문", "다소미", "female"), ("탁", "서진", "male"),
        ("남궁", "하린", "female"), ("이", "세상", "male"), ("김", "필립", "male"),
        ("한", "가온", "neutral"), ("오", "미르", "male"),
    };

    public ScoreDistributionDiagnosticTests(ITestOutputHelper output)
    {
        _output = output;
        HanjaData.LoadExternalData();

        var repo = new InMemoryRecommendationRepository();
        _aesthetic = new AestheticEngine();
        _harmony = new HarmonyEngine(new SajuCalculationService());
        _rarity = new RarityScoringEngine();
        _explanation = new ExplanationEngine();
    }

    [Fact]
    public async Task AestheticScore_Distribution_ShouldNotCluster()
    {
        _output.WriteLine("=== Aesthetic Score Distribution (tone=neutral, gender=각자) ===");
        _output.WriteLine($"{"성명",-10} {"점수",6} {"발음",5} {"리듬",5} {"음절",5} {"중립",5} {"의미",5} {"성별+",5} {"톤+",5} {"감점",6}");
        _output.WriteLine(new string('-', 70));

        var scores = new List<double>();

        foreach (var (surname, name, gender) in TestNames)
        {
            var bd = await _aesthetic.CalculateScoreWithBreakdownAsync(name, surname, "neutral", gender);
            scores.Add(bd.TotalScore);

            _output.WriteLine($"{surname + name,-10} {bd.TotalScore,6:F1} {bd.PronunciationScore,5:F1} {bd.RhythmScore,5:F1} {bd.SyllableScore,5:F1} {bd.NeutralityScore,5:F1} {bd.MeaningScore,5:F1} {bd.GenderBonus,5:F1} {bd.ToneBonus,5:F1} {bd.PenaltyTotal,6:F1}");
        }

        var min = scores.Min();
        var max = scores.Max();
        var avg = scores.Average();
        var stdDev = Math.Sqrt(scores.Average(s => Math.Pow(s - avg, 2)));

        _output.WriteLine($"\nMin={min:F1}  Max={max:F1}  Avg={avg:F1}  StdDev={stdDev:F1}  Range={max - min:F1}");

        // 점수 범위가 최소 15점 이상 차이나야 함 (이전에는 55~75로 20점 범위에 몰림)
        Assert.True(max - min >= 15, $"점수 범위가 너무 좁습니다: {max - min:F1}점");
        // 표준편차가 5 이상이어야 의미있는 분포
        Assert.True(stdDev >= 5, $"표준편차가 너무 낮습니다: {stdDev:F1}");
    }

    [Fact]
    public async Task HarmonyScore_Distribution_ShouldNotCluster()
    {
        _output.WriteLine("=== Harmony Score Distribution ===");
        _output.WriteLine($"{"성명",-10} {"총점",6} {"오행",5} {"자원",5} {"음양",5} {"성조",5} {"성별+",5} {"FB",4}");
        _output.WriteLine(new string('-', 55));

        var scores = new List<double>();

        foreach (var (surname, name, gender) in TestNames)
        {
            var bd = await _harmony.CalculateScoreWithBreakdownAsync(name, surname, new DateTime(1990, 1, 1), gender);
            scores.Add(bd.TotalScore);

            _output.WriteLine($"{surname + name,-10} {bd.TotalScore,6:F1} {bd.FiveElementScore,5:F1} {bd.ResourceElementScore,5:F1} {bd.YinYangScore,5:F1} {bd.SurnameHarmonyScore,5:F1} {bd.GenderBonus,5:F1} {(bd.UsedFallback ? "Y" : "N"),4}");
        }

        var min = scores.Min();
        var max = scores.Max();
        var avg = scores.Average();
        var stdDev = Math.Sqrt(scores.Average(s => Math.Pow(s - avg, 2)));

        _output.WriteLine($"\nMin={min:F1}  Max={max:F1}  Avg={avg:F1}  StdDev={stdDev:F1}  Range={max - min:F1}");

        Assert.True(max - min >= 10, $"점수 범위가 너무 좁습니다: {max - min:F1}점");
        Assert.True(stdDev >= 3, $"표준편차가 너무 낮습니다: {stdDev:F1}");
    }

    [Fact]
    public async Task FinalScore_Distribution_ShouldSpread()
    {
        _output.WriteLine("=== Final Score (Aesthetic*0.7 + Harmony*0.3) ===");
        _output.WriteLine($"{"성명",-10} {"미학",6} {"조화",6} {"최종",6} {"희귀",5}");
        _output.WriteLine(new string('-', 45));

        var finals = new List<double>();

        foreach (var (surname, name, gender) in TestNames)
        {
            var aesScore = await _aesthetic.CalculateScoreAsync(name, surname);
            var harScore = await _harmony.CalculateScoreAsync(name, surname, new DateTime(1990, 1, 1), gender);
            var rarScore = await _rarity.CalculateRarityScoreAsync(name);
            var final = aesScore * 0.7 + harScore * 0.3;
            finals.Add(final);

            _output.WriteLine($"{surname + name,-10} {aesScore,6:F1} {harScore,6:F1} {final,6:F1} {rarScore,5:F1}");
        }

        var min = finals.Min();
        var max = finals.Max();
        var avg = finals.Average();
        var stdDev = Math.Sqrt(finals.Average(s => Math.Pow(s - avg, 2)));

        _output.WriteLine($"\nMin={min:F1}  Max={max:F1}  Avg={avg:F1}  StdDev={stdDev:F1}  Range={max - min:F1}");

        Assert.True(max - min >= 10, $"최종 점수 범위가 너무 좁습니다: {max - min:F1}점");
    }

    [Fact]
    public async Task GenderChange_ShouldAffectScores()
    {
        _output.WriteLine("=== Gender 변경 시 점수 변화 ===");
        _output.WriteLine($"{"이름",-8} {"F미학",6} {"M미학",6} {"차이",6} {"F조화",6} {"M조화",6} {"차이",6}");
        _output.WriteLine(new string('-', 55));

        var names = new[] { ("김", "서윤"), ("이", "도현"), ("박", "하은"), ("최", "민재"), ("강", "소율") };
        int changed = 0;

        foreach (var (surname, name) in names)
        {
            var aesFemale = await _aesthetic.CalculateScoreWithBreakdownAsync(name, surname, "neutral", "female");
            var aesMale = await _aesthetic.CalculateScoreWithBreakdownAsync(name, surname, "neutral", "male");
            var harFemale = await _harmony.CalculateScoreWithBreakdownAsync(name, surname, new DateTime(1990, 1, 1), "female");
            var harMale = await _harmony.CalculateScoreWithBreakdownAsync(name, surname, new DateTime(1990, 1, 1), "male");

            var aesDiff = aesFemale.TotalScore - aesMale.TotalScore;
            var harDiff = harFemale.TotalScore - harMale.TotalScore;

            if (Math.Abs(aesDiff) > 0.1 || Math.Abs(harDiff) > 0.1) changed++;

            _output.WriteLine($"{surname + name,-8} {aesFemale.TotalScore,6:F1} {aesMale.TotalScore,6:F1} {aesDiff,+6:F1} {harFemale.TotalScore,6:F1} {harMale.TotalScore,6:F1} {harDiff,+6:F1}");
        }

        _output.WriteLine($"\n5개 중 {changed}개가 gender에 따라 점수 변화");
        Assert.True(changed >= 3, $"gender 변경 시 최소 3개 이상의 이름에서 점수가 달라져야 함 (현재: {changed})");
    }

    [Fact]
    public async Task ToneChange_ShouldAffectScores()
    {
        _output.WriteLine("=== Tone 변경 시 점수 변화 ===");
        _output.WriteLine($"{"이름",-8} {"soft",6} {"strong",6} {"neutral",6} {"범위",6}");
        _output.WriteLine(new string('-', 45));

        var names = new[] { ("김", "서윤"), ("이", "도현"), ("박", "하은"), ("최", "건우"), ("강", "소율") };
        int changed = 0;

        foreach (var (surname, name) in names)
        {
            var soft = await _aesthetic.CalculateScoreWithBreakdownAsync(name, surname, "soft", "none");
            var strong = await _aesthetic.CalculateScoreWithBreakdownAsync(name, surname, "strong", "none");
            var neutral = await _aesthetic.CalculateScoreWithBreakdownAsync(name, surname, "neutral", "none");

            var range = new[] { soft.TotalScore, strong.TotalScore, neutral.TotalScore };
            var diff = range.Max() - range.Min();
            if (diff > 0.1) changed++;

            _output.WriteLine($"{surname + name,-8} {soft.TotalScore,6:F1} {strong.TotalScore,6:F1} {neutral.TotalScore,6:F1} {diff,6:F1}");
        }

        _output.WriteLine($"\n5개 중 {changed}개가 tone에 따라 점수 변화");
        Assert.True(changed >= 3, $"tone 변경 시 최소 3개 이상의 이름에서 점수가 달라져야 함 (현재: {changed})");
    }

    [Fact]
    public async Task Explanation_ShouldVaryByName()
    {
        _output.WriteLine("=== 설명 다양성 검증 ===");

        var explanations = new List<string>();

        foreach (var (surname, name, gender) in TestNames.Take(10))
        {
            var aes = await _aesthetic.CalculateScoreAsync(name, surname);
            var har = await _harmony.CalculateScoreAsync(name, surname, new DateTime(1990, 1, 1), gender);
            var rar = await _rarity.CalculateRarityScoreAsync(name);
            var result = await _explanation.GenerateDetailedReasonsAsync(name, surname, aes, har, rar, "neutral", gender);

            var summary = result.Summary ?? "";
            explanations.Add(summary);

            _output.WriteLine($"{surname + name}: [{result.Strengths?.Count ?? 0}강점, {result.Cautions?.Count ?? 0}주의]");
            _output.WriteLine($"  요약: {summary}");
            if (result.Strengths != null)
                foreach (var s in result.Strengths.Take(2))
                    _output.WriteLine($"  ✅ {s}");
            if (result.Cautions != null)
                foreach (var c in result.Cautions.Take(2))
                    _output.WriteLine($"  ⚠️ {c}");
            _output.WriteLine("");
        }

        // 10개 이름 중 최소 3가지 이상 다른 요약이 나와야 함
        var uniqueSummaries = explanations.Distinct().Count();
        _output.WriteLine($"고유 요약 수: {uniqueSummaries}/10");
        Assert.True(uniqueSummaries >= 3, $"설명이 너무 획일적입니다. 고유 요약: {uniqueSummaries}/10");
    }
}
