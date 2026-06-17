using NameForm.Application.Engines.Data;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// GenerationNameData 세대 적합도 분석 단위 테스트
/// </summary>
public class GenerationNameDataTests
{
    // ===== 세대 강한 불일치 =====

    [Fact]
    public void AnalyzeGenerationFit_1985Born_주원_StrongMismatch()
    {
        // "주원"은 2008~2020 유행 → 1985년생과 강한 불일치
        var result = GenerationNameData.AnalyzeGenerationFit("주원", 1985);

        Assert.Equal("strong_mismatch", result.FitLevel);
        Assert.True(result.YearGap > 10, $"YearGap({result.YearGap})이 10보다 커야 함");
        Assert.NotNull(result.PeakDecade);
        Assert.Contains("개명", result.Description);
    }

    [Fact]
    public void AnalyzeGenerationFit_1960Born_서윤_StrongMismatch()
    {
        // "서윤"은 2010~2022 유행 → 1960년생과 강한 불일치
        var result = GenerationNameData.AnalyzeGenerationFit("서윤", 1960);

        Assert.Equal("strong_mismatch", result.FitLevel);
        Assert.True(result.YearGap >= 40, $"YearGap({result.YearGap})이 40 이상이어야 함");
    }

    // ===== 세대 완벽 일치 =====

    [Fact]
    public void AnalyzeGenerationFit_2015Born_서윤_Perfect()
    {
        // "서윤"은 2010~2022 유행 → 2015년생과 완벽 일치
        var result = GenerationNameData.AnalyzeGenerationFit("서윤", 2015);

        Assert.Equal("perfect", result.FitLevel);
        Assert.Equal(0, result.YearGap);
        Assert.NotNull(result.PeakDecade);
    }

    [Fact]
    public void AnalyzeGenerationFit_1960Born_영희_Perfect()
    {
        // "영희"는 1950~1969 유행 → 1960년생과 완벽 일치
        var result = GenerationNameData.AnalyzeGenerationFit("영희", 1960);

        Assert.Equal("perfect", result.FitLevel);
        Assert.Equal(0, result.YearGap);
    }

    [Fact]
    public void AnalyzeGenerationFit_2020Born_서윤_Perfect()
    {
        // "서윤"은 2010~2022 유행 → 2020년생과 완벽 일치
        var result = GenerationNameData.AnalyzeGenerationFit("서윤", 2020);

        Assert.Equal("perfect", result.FitLevel);
    }

    // ===== 시대 무관 이름 =====

    [Theory]
    [InlineData(1960)]
    [InlineData(1985)]
    [InlineData(2000)]
    [InlineData(2020)]
    public void AnalyzeGenerationFit_정하_AlwaysTimeless(int birthYear)
    {
        // "정하"는 시대무관 이름 → 어떤 세대든 timeless
        var result = GenerationNameData.AnalyzeGenerationFit("정하", birthYear);

        Assert.Equal("timeless", result.FitLevel);
        Assert.Equal(0, result.YearGap);
        Assert.Contains("자연스러운", result.Description);
    }

    // ===== DB에 없는 이름 =====

    [Fact]
    public void AnalyzeGenerationFit_UnknownName_ReturnsUnknown()
    {
        // DB에 없는 이름 → unknown
        var result = GenerationNameData.AnalyzeGenerationFit("서란", 1990);

        Assert.Equal("unknown", result.FitLevel);
        Assert.Equal(0, result.YearGap);
    }

    [Fact]
    public void AnalyzeGenerationFit_VeryRareName_ReturnsUnknown()
    {
        var result = GenerationNameData.AnalyzeGenerationFit("가니다", 2000);

        Assert.Equal("unknown", result.FitLevel);
    }

    // ===== 약한 불일치 =====

    [Fact]
    public void AnalyzeGenerationFit_MildMismatch_WithinTenYears()
    {
        // "영희"는 1950~1969 유행 → 1975년생은 6년 차이 = 약한 불일치
        var result = GenerationNameData.AnalyzeGenerationFit("영희", 1975);

        Assert.Equal("mild_mismatch", result.FitLevel);
        Assert.True(result.YearGap > 0 && result.YearGap <= 10,
            $"YearGap({result.YearGap})이 1~10 사이여야 함");
    }

    // ===== 데이터 무결성 =====

    [Fact]
    public void Entries_HasAtLeast80Names()
    {
        Assert.True(GenerationNameData.Entries.Count >= 80,
            $"유행 이름 DB가 최소 80개여야 함, 현재: {GenerationNameData.Entries.Count}");
    }

    [Fact]
    public void TimelessNames_HasAtLeast20Names()
    {
        Assert.True(GenerationNameData.TimelessNames.Count >= 20,
            $"시대무관 이름이 최소 20개여야 함, 현재: {GenerationNameData.TimelessNames.Count}");
    }

    [Fact]
    public void Entries_AllHaveValidYearRange()
    {
        foreach (var entry in GenerationNameData.Entries)
        {
            Assert.True(entry.PeakStart < entry.PeakEnd,
                $"{entry.Name}: PeakStart({entry.PeakStart}) < PeakEnd({entry.PeakEnd}) 이어야 함");
            Assert.True(entry.PeakStart >= 1940,
                $"{entry.Name}: PeakStart({entry.PeakStart})이 1940 이상이어야 함");
            Assert.True(entry.PeakEnd <= 2040,
                $"{entry.Name}: PeakEnd({entry.PeakEnd})이 2040 이하여야 함");
        }
    }

    [Fact]
    public void Entries_AllHaveValidGender()
    {
        var validGenders = new HashSet<string> { "male", "female" };
        foreach (var entry in GenerationNameData.Entries)
        {
            Assert.True(validGenders.Contains(entry.Gender),
                $"{entry.Name}: Gender({entry.Gender})가 유효해야 함");
        }
    }

    // ===== AestheticEngine 통합 =====

    [Fact]
    public async Task AestheticEngine_WithBirthYear_StrongMismatch_LowerNeutrality()
    {
        var engine = new NameForm.Application.Engines.AestheticEngine();

        // 1985년생 + "주원" (2010년대 유행) → 세대 강한 불일치로 NeutralityScore 감소
        var withBirthYear = await engine.CalculateScoreWithBreakdownAsync("주원", null, "neutral", "none", 1985);
        var withoutBirthYear = await engine.CalculateScoreWithBreakdownAsync("주원", null, "neutral", "none");

        Assert.True(withBirthYear.NeutralityScore <= withoutBirthYear.NeutralityScore,
            $"세대 불일치 시 NeutralityScore({withBirthYear.NeutralityScore})가 " +
            $"기본({withoutBirthYear.NeutralityScore})보다 낮거나 같아야 함");
        Assert.NotNull(withBirthYear.GenerationFit);
        Assert.Equal("strong_mismatch", withBirthYear.GenerationFit!.FitLevel);
    }

    [Fact]
    public async Task AestheticEngine_WithBirthYear_Timeless_HigherNeutrality()
    {
        var engine = new NameForm.Application.Engines.AestheticEngine();

        // "정하"는 시대무관 → NeutralityScore 보너스
        var withBirthYear = await engine.CalculateScoreWithBreakdownAsync("정하", null, "neutral", "none", 1985);
        var withoutBirthYear = await engine.CalculateScoreWithBreakdownAsync("정하", null, "neutral", "none");

        Assert.True(withBirthYear.NeutralityScore >= withoutBirthYear.NeutralityScore,
            $"시대무관 이름의 NeutralityScore({withBirthYear.NeutralityScore})가 " +
            $"기본({withoutBirthYear.NeutralityScore})보다 높거나 같아야 함");
        Assert.NotNull(withBirthYear.GenerationFit);
        Assert.Equal("timeless", withBirthYear.GenerationFit!.FitLevel);
    }

    [Fact]
    public async Task AestheticEngine_WithoutBirthYear_NoGenerationFit()
    {
        var engine = new NameForm.Application.Engines.AestheticEngine();

        // birthYear 없이 호출 시 GenerationFit이 null
        var result = await engine.CalculateScoreWithBreakdownAsync("주원", null, "neutral", "none");

        Assert.Null(result.GenerationFit);
    }

    // ===== ExplanationEngine 통합 =====

    [Fact]
    public async Task ExplanationEngine_StrongMismatch_HasCaution()
    {
        var engine = new NameForm.Application.Engines.ExplanationEngine();

        var generationFit = GenerationNameData.AnalyzeGenerationFit("주원", 1985);
        var result = await engine.GenerateDetailedReasonsAsync(
            "주원", "김", 70, 70, 50, "male", "neutral", generationFit);

        Assert.True(result.Cautions.Any(c => c.Contains("개명") || c.Contains("세대") || c.Contains("유행")),
            $"세대 불일치 주의점이 있어야 함. Cautions: [{string.Join(", ", result.Cautions)}]");
    }

    [Fact]
    public async Task ExplanationEngine_Timeless_HasStrength()
    {
        var engine = new NameForm.Application.Engines.ExplanationEngine();

        var generationFit = GenerationNameData.AnalyzeGenerationFit("정하", 1985);
        var result = await engine.GenerateDetailedReasonsAsync(
            "정하", "김", 80, 75, 60, "neutral", "neutral", generationFit);

        Assert.True(result.Strengths.Any(s => s.Contains("세대") || s.Contains("자연스러운")),
            $"시대무관 강점이 있어야 함. Strengths: [{string.Join(", ", result.Strengths)}]");
    }

    [Fact]
    public async Task ExplanationEngine_WithoutGenerationFit_StillWorks()
    {
        var engine = new NameForm.Application.Engines.ExplanationEngine();

        // generationFit 없이 기존 메서드 호출 시 정상 동작
        var result = await engine.GenerateDetailedReasonsAsync(
            "서연", "김", 85, 80, 60, "female", "soft");

        Assert.NotNull(result.Summary);
        Assert.True(result.Strengths.Count >= 2);
    }

    // ── 하이브리드: 수동 DB에 없는 현대 인기 이름은 실명 데이터로 세대 판정 ──

    /// <summary>수동 DB에 없는 현대 인기 이름(실명 5000+)을 옛 출생자가 쓰면 강한 불일치</summary>
    [Theory]
    [InlineData("지민")] // 실명 28,539 · 수동 DB 없음
    [InlineData("현서")] // 17,872
    [InlineData("민재")] // 16,781
    public void AnalyzeGenerationFit_ModernPopular_OldBirth_StrongMismatch(string name)
    {
        var r = GenerationNameData.AnalyzeGenerationFit(name, 1985);
        Assert.Equal("strong_mismatch", r.FitLevel);
        Assert.Equal("2010년대", r.PeakDecade);
    }

    /// <summary>같은 현대 인기 이름도 현대(2008+) 출생자에겐 적합 (신생아 작명 감점 없음)</summary>
    [Theory]
    [InlineData("지민")]
    [InlineData("현서")]
    public void AnalyzeGenerationFit_ModernPopular_ModernBirth_Perfect(string name)
    {
        var r = GenerationNameData.AnalyzeGenerationFit(name, 2024);
        Assert.Equal("perfect", r.FitLevel);
    }

    /// <summary>실명 표본도 적고 수동 DB에도 없으면 판단 보류(unknown) — 오탐 방지</summary>
    [Fact]
    public void AnalyzeGenerationFit_RareName_NotInData_Unknown()
    {
        var r = GenerationNameData.AnalyzeGenerationFit("쩡뫼", 1985);
        Assert.Equal("unknown", r.FitLevel);
    }
}
