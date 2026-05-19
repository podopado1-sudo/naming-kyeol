using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace NameForm.Tests;

public class NameAnalysisServiceTests
{
    private readonly NameAnalysisService _service;

    public NameAnalysisServiceTests()
    {
        var fakeSaju = new FakeSajuCalculationService();
        var scoring = new ScoringService(
            new AestheticEngine(),
            new HarmonyEngine(fakeSaju),
            new RarityScoringEngine());
        _service = new NameAnalysisService(
            scoring,
            new AestheticEngine(),
            new RarityScoringEngine(),
            new ExplanationEngine(),
            new NameReversalEngine(),
            new SajuCalculationService(),
            new YongshinCalculationService(),
            NullLogger<NameAnalysisService>.Instance);
    }

    [Fact]
    public async Task AnalyzeNameAsync_BasicName_ReturnsValidResponse()
    {
        var request = new NameAnalysisRequestDto
        {
            LastName = "김",
            FirstName = "민준",
            Gender = "male",
            Tone = "neutral"
        };

        var result = await _service.AnalyzeNameAsync(request);

        Assert.Equal("김민준", result.FullName);
        Assert.InRange(result.AestheticScore, 0, 100);
        Assert.Null(result.HarmonyScore);
        Assert.InRange(result.RarityScore, 0, 100);
        Assert.True(result.Strengths.Count > 0 || result.Weaknesses.Count > 0);
    }

    [Fact]
    public async Task AnalyzeNameAsync_WithBirthDate_ReturnsHarmonyScore()
    {
        var request = new NameAnalysisRequestDto
        {
            LastName = "김",
            FirstName = "서연",
            BirthDate = "2024-06-15",
            Gender = "female",
            Tone = "soft"
        };

        var result = await _service.AnalyzeNameAsync(request);

        Assert.NotNull(result.HarmonyScore);
        Assert.InRange(result.HarmonyScore!.Value, 0, 100);
        Assert.True(result.FinalScore > 0);
    }

    [Fact]
    public async Task AnalyzeNameAsync_ReturnsHanjaBreakdown()
    {
        var request = new NameAnalysisRequestDto
        {
            LastName = "이",
            FirstName = "서연"
        };

        var result = await _service.AnalyzeNameAsync(request);

        Assert.Equal(2, result.HanjaBreakdown.Count);
        Assert.Equal("서", result.HanjaBreakdown[0].Syllable);
        Assert.Equal("연", result.HanjaBreakdown[1].Syllable);
    }

    [Fact]
    public async Task AnalyzeNameAsync_ReturnsReversalVariants()
    {
        var request = new NameAnalysisRequestDto
        {
            LastName = "이",
            FirstName = "수지"
        };

        var result = await _service.AnalyzeNameAsync(request);

        Assert.True(result.ReversalVariants.Count > 0);
        Assert.Contains(result.ReversalVariants, v => v.Name == "지수");
    }

    [Fact]
    public async Task AnalyzeNameAsync_ReturnsReasons()
    {
        var request = new NameAnalysisRequestDto
        {
            LastName = "박",
            FirstName = "지수"
        };

        var result = await _service.AnalyzeNameAsync(request);

        Assert.True(result.Reasons.Count > 0);
    }
}
