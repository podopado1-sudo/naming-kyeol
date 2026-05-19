using NameForm.Application.Engines;
using NameForm.Domain.Models;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// RankerEngine 단위 테스트
/// 최종 점수 = aesthetic * 0.7 + harmony * 0.3
/// </summary>
public class RankerEngineTests
{
    private readonly RankerEngine _engine = new();

    [Fact]
    public async Task RankCandidatesAsync_CalculatesFinalScore_Correctly()
    {
        var candidates = new List<Candidate>
        {
            new() { Name = "서연", AestheticScore = 80, HarmonyScore = 60 },
        };

        var result = await _engine.RankCandidatesAsync(candidates);

        // 80 * 0.7 + 60 * 0.3 = 56 + 18 = 74
        Assert.Equal(74, result[0].FinalScore);
    }

    [Fact]
    public async Task RankCandidatesAsync_PerfectScores_Returns100()
    {
        var candidates = new List<Candidate>
        {
            new() { Name = "테스트", AestheticScore = 100, HarmonyScore = 100 },
        };

        var result = await _engine.RankCandidatesAsync(candidates);

        Assert.Equal(100, result[0].FinalScore);
    }

    [Fact]
    public async Task RankCandidatesAsync_ZeroScores_Returns0()
    {
        var candidates = new List<Candidate>
        {
            new() { Name = "테스트", AestheticScore = 0, HarmonyScore = 0 },
        };

        var result = await _engine.RankCandidatesAsync(candidates);

        Assert.Equal(0, result[0].FinalScore);
    }

    [Fact]
    public async Task RankCandidatesAsync_SortsDescendingByFinalScore()
    {
        var candidates = new List<Candidate>
        {
            new() { Name = "낮은", AestheticScore = 50, HarmonyScore = 50 },
            new() { Name = "높은", AestheticScore = 90, HarmonyScore = 90 },
            new() { Name = "중간", AestheticScore = 70, HarmonyScore = 70 },
        };

        var result = await _engine.RankCandidatesAsync(candidates);

        Assert.Equal("높은", result[0].Name);
        Assert.Equal("중간", result[1].Name);
        Assert.Equal("낮은", result[2].Name);
    }

    [Fact]
    public async Task RankCandidatesAsync_SameFinalScore_BreaksByAesthetic()
    {
        var candidates = new List<Candidate>
        {
            // 둘 다 FinalScore = 70 * 0.7 + 70 * 0.3 = 70
            // 하지만 미학 점수가 다른 경우
            new() { Name = "미학높", AestheticScore = 80, HarmonyScore = 47 },  // 80*0.7+47*0.3 = 56+14.1 = 70
            new() { Name = "미학낮", AestheticScore = 60, HarmonyScore = 93 },  // 60*0.7+93*0.3 = 42+27.9 = 70
        };

        var result = await _engine.RankCandidatesAsync(candidates);

        // 미학 점수가 높은 것이 우선
        Assert.Equal("미학높", result[0].Name);
    }

    [Fact]
    public async Task RankCandidatesAsync_EmptyList_ReturnsEmpty()
    {
        var result = await _engine.RankCandidatesAsync(new List<Candidate>());

        Assert.Empty(result);
    }

    [Fact]
    public async Task RankCandidatesAsync_AestheticWeightIs70Percent()
    {
        // aesthetic=100, harmony=0 → 70
        var candidates = new List<Candidate>
        {
            new() { Name = "미학만", AestheticScore = 100, HarmonyScore = 0 },
        };

        var result = await _engine.RankCandidatesAsync(candidates);

        Assert.Equal(70, result[0].FinalScore);
    }

    [Fact]
    public async Task RankCandidatesAsync_HarmonyWeightIs30Percent()
    {
        // aesthetic=0, harmony=100 → 30
        var candidates = new List<Candidate>
        {
            new() { Name = "조화만", AestheticScore = 0, HarmonyScore = 100 },
        };

        var result = await _engine.RankCandidatesAsync(candidates);

        Assert.Equal(30, result[0].FinalScore);
    }
}
