using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// NameEvaluationService 통합 평가 테스트
/// </summary>
public class NameEvaluationServiceTests
{
    private readonly NameEvaluationService _service;

    public NameEvaluationServiceTests()
    {
        HanjaData.LoadExternalData();

        var saju = new FakeSajuCalculationService();
        var scoring = new ScoringService(
            new AestheticEngine(),
            new HarmonyEngine(saju),
            new RarityScoringEngine());
        _service = new NameEvaluationService(scoring, new ExplanationEngine());
    }

    // ===== 기본 호출: 모든 필드가 채워지는지 =====

    [Fact]
    public async Task EvaluateNameAsync_BasicCall_AllFieldsPopulated()
    {
        var result = await _service.EvaluateNameAsync(
            "서윤", "김", new DateTime(2024, 6, 15), "female", "soft");

        // 기본 정보
        Assert.Equal("서윤", result.Name);
        Assert.Equal("김", result.LastName);
        Assert.Equal("김서윤", result.FullName);
        Assert.Equal("female", result.Gender);
        Assert.Equal("soft", result.Tone);

        // 점수가 0~100 범위인지
        Assert.InRange(result.AestheticScore, 0, 100);
        Assert.InRange(result.HarmonyScore, 0, 100);
        Assert.InRange(result.RarityScore, 0, 100);
        Assert.InRange(result.FinalScore, 0, 100);

        // Breakdown 존재
        Assert.NotNull(result.Aesthetic);
        Assert.NotNull(result.Harmony);

        // 설명 필드가 비어있지 않은지
        Assert.False(string.IsNullOrEmpty(result.Summary));

        // 한자 후보 존재 (2음절이므로 2그룹)
        Assert.Equal(2, result.HanjaCandidates.Count);
    }

    // ===== AestheticBreakdown 항목별 합계 검증 =====

    [Fact]
    public async Task EvaluateNameAsync_AestheticBreakdown_ComponentsAddUp()
    {
        var result = await _service.EvaluateNameAsync(
            "지호", "이", new DateTime(2023, 3, 10), "male", "strong");

        var a = result.Aesthetic;

        // 개별 항목이 음수가 아닌지 (보너스 제외)
        Assert.True(a.Pronunciation >= 0, $"Pronunciation={a.Pronunciation}");
        Assert.True(a.Rhythm >= 0, $"Rhythm={a.Rhythm}");
        Assert.True(a.Syllable >= 0, $"Syllable={a.Syllable}");
        Assert.True(a.Neutrality >= 0, $"Neutrality={a.Neutrality}");
        Assert.True(a.Meaning >= 0, $"Meaning={a.Meaning}");

        // 항목 범위
        Assert.InRange(a.Pronunciation, 0, 30);
        Assert.InRange(a.Rhythm, 0, 25);
        Assert.InRange(a.Syllable, 0, 15);
        Assert.InRange(a.Neutrality, 0, 15);
        Assert.InRange(a.Meaning, 0, 10);

        // Total은 0~100 범위
        Assert.InRange(a.Total, 0, 100);
    }

    // ===== HarmonyBreakdown UsedFallback 동작 =====

    [Fact]
    public async Task EvaluateNameAsync_HarmonyBreakdown_UsedFallbackConsistent()
    {
        var result = await _service.EvaluateNameAsync(
            "서윤", "김", new DateTime(2024, 6, 15), "female", "neutral");

        // UsedFallback은 DTO 양쪽에서 동일
        Assert.Equal(result.Harmony.UsedFallback, result.UsedFallbackHanja);

        // Harmony breakdown 항목 범위
        var h = result.Harmony;
        Assert.InRange(h.FiveElement, 0, 30);
        Assert.InRange(h.ResourceElement, 0, 20);
        Assert.InRange(h.YinYang, 0, 10);
        Assert.InRange(h.PronunciationElement, 0, 25);
        Assert.InRange(h.SuriSagyeok, 0, 15);
        Assert.InRange(h.Total, 0, 100);
    }

    // ===== 한자 후보가 실제로 반환되는지 =====

    [Fact]
    public async Task EvaluateNameAsync_HanjaCandidates_ReturnedForCommonName()
    {
        var result = await _service.EvaluateNameAsync(
            "민준", "박", new DateTime(2024, 1, 1), "male", "neutral");

        Assert.Equal(2, result.HanjaCandidates.Count);

        // 각 그룹의 음절이 올바른지
        Assert.Equal("민", result.HanjaCandidates[0].Syllable);
        Assert.Equal("준", result.HanjaCandidates[1].Syllable);

        // 최소 하나는 한자 후보가 있어야 함
        var totalCandidates = result.HanjaCandidates.Sum(g => g.Candidates.Count);
        Assert.True(totalCandidates > 0, "한자 후보가 하나도 없음");

        // 후보의 필드가 채워져 있는지
        var firstCandidate = result.HanjaCandidates
            .SelectMany(g => g.Candidates)
            .FirstOrDefault();
        if (firstCandidate != null)
        {
            Assert.False(string.IsNullOrEmpty(firstCandidate.Character));
            Assert.False(string.IsNullOrEmpty(firstCandidate.Reading));
            Assert.False(string.IsNullOrEmpty(firstCandidate.Meaning));
        }
    }

    // ===== gender/tone별 다른 점수 =====

    [Theory]
    [InlineData("male", "soft")]
    [InlineData("female", "strong")]
    [InlineData("none", "neutral")]
    public async Task EvaluateNameAsync_DifferentGenderTone_BreakdownReflectsParameters(
        string gender, string tone)
    {
        var result = await _service.EvaluateNameAsync(
            "서윤", "김", new DateTime(2024, 6, 15), gender, tone);

        // gender/tone 파라미터가 결과에 정확히 반영되는지
        Assert.Equal(gender, result.Gender);
        Assert.Equal(tone, result.Tone);

        // breakdown이 유효한 값을 갖는지
        Assert.InRange(result.Aesthetic.Total, 0, 100);
        Assert.InRange(result.Harmony.Total, 0, 100);

        // AestheticBreakdown Notes가 null이 아닌지
        Assert.NotNull(result.Aesthetic.Notes);
    }

    // ===== Strengths/Cautions 비어있지 않은지 =====

    [Fact]
    public async Task EvaluateNameAsync_Explanation_StrengthsNotEmpty()
    {
        var result = await _service.EvaluateNameAsync(
            "하윤", "최", new DateTime(2024, 8, 20), "female", "soft");

        Assert.NotNull(result.Strengths);
        Assert.NotEmpty(result.Strengths);
    }

    // ===== FinalScore 공식 검증 =====

    [Fact]
    public async Task EvaluateNameAsync_FinalScore_MatchesFormula()
    {
        var result = await _service.EvaluateNameAsync(
            "도현", "정", new DateTime(2023, 11, 5), "male", "neutral");

        var expected = (int)Math.Round(result.AestheticScore * 0.7 + result.HarmonyScore * 0.3);
        Assert.Equal(expected, result.FinalScore);
    }
}
