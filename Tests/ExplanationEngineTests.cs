using NameForm.Application.Engines;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// ExplanationEngine 추천 이유 생성 테스트
/// </summary>
public class ExplanationEngineTests
{
    private readonly ExplanationEngine _engine = new();

    // =========================================================================
    // 기존 GenerateReasonsAsync 하위 호환 테스트
    // =========================================================================

    [Fact]
    public async Task GenerateReasonsAsync_ReturnsMaxFiveReasons()
    {
        // 2026-06-15: 추천 이유 보강 — 오행과 한자 뜻을 함께 노출하도록 최대 5개로 확장
        var reasons = await _engine.GenerateReasonsAsync("서연", 85, 80);
        Assert.True(reasons.Count <= 5);
        Assert.True(reasons.Count >= 1);
    }

    // 리포트 형식 전환(2026-05-15): 서사적 표현 → 수치+근거 형식
    [Fact]
    public async Task GenerateReasonsAsync_HighAesthetic_HasReportFormat()
    {
        var reasons = await _engine.GenerateReasonsAsync("서연", 90, 50);
        Assert.Contains(reasons, r => r.Contains("발음 90점") || r.Contains("미학 90"));
    }

    [Fact]
    public async Task GenerateReasonsAsync_MediumHighAesthetic_HasReportFormat()
    {
        var reasons = await _engine.GenerateReasonsAsync("서연", 78, 50);
        Assert.Contains(reasons, r => r.Contains("78") || r.Contains("종합"));
    }

    [Fact]
    public async Task GenerateReasonsAsync_MediumAesthetic_HasReportFormat()
    {
        var reasons = await _engine.GenerateReasonsAsync("서연", 68, 50);
        Assert.Contains(reasons, r => r.Contains("미학 68") || r.Contains("발음 68"));
    }

    [Fact]
    public async Task GenerateReasonsAsync_LowAesthetic_HasReportFormat()
    {
        var reasons = await _engine.GenerateReasonsAsync("서연", 50, 50);
        Assert.Contains(reasons, r => r.Contains("점") || r.Contains("받침"));
    }

    [Fact]
    public async Task GenerateReasonsAsync_HighHarmony_ContainsPositiveMeaningOrHarmony()
    {
        var reasons = await _engine.GenerateReasonsAsync("서연", 50, 85);
        // 한자 의미가 조회되면 의미 설명이, 아니면 조화 설명이 나옴
        Assert.Contains(reasons, r =>
            r.Contains("오행") || r.Contains("음양") || r.Contains("의미") || r.Contains("한자") || r.Contains("조화") || r.Contains("사주"));
    }

    [Fact]
    public async Task GenerateReasonsAsync_MediumHarmony_ContainsHarmonyOrMeaning()
    {
        var reasons = await _engine.GenerateReasonsAsync("서연", 50, 75);
        Assert.Contains(reasons, r =>
            r.Contains("사주") || r.Contains("조화") || r.Contains("오행") || r.Contains("의미") || r.Contains("한자"));
    }

    [Fact]
    public async Task GenerateReasonsAsync_LowHarmony_ContainsBasicOrMeaning()
    {
        var reasons = await _engine.GenerateReasonsAsync("서연", 50, 40);
        Assert.Contains(reasons, r =>
            r.Contains("기본") || r.Contains("조화") || r.Contains("보완") || r.Contains("의미") || r.Contains("한자"));
    }

    [Fact]
    public async Task GenerateReasonsAsync_AllReasonsAreNonEmpty()
    {
        var reasons = await _engine.GenerateReasonsAsync("서연", 85, 85);
        Assert.All(reasons, r => Assert.False(string.IsNullOrWhiteSpace(r)));
    }

    // =========================================================================
    // 같은 점수 구간이어도 이름별 다른 설명 테스트
    // =========================================================================

    [Fact]
    public async Task GenerateReasonsAsync_DifferentNames_SameScore_ProduceDifferentReasons()
    {
        var reasons1 = await _engine.GenerateReasonsAsync("서연", 85, 80);
        var reasons2 = await _engine.GenerateReasonsAsync("민준", 85, 80);

        // 이름이 다르면 적어도 일부 설명이 달라야 함 (발음 분석이 이름별로 다르므로)
        var joined1 = string.Join("|", reasons1);
        var joined2 = string.Join("|", reasons2);
        Assert.NotEqual(joined1, joined2);
    }

    [Fact]
    public async Task GenerateReasonsAsync_SameName_SameScore_ProduceSameReasons()
    {
        var reasons1 = await _engine.GenerateReasonsAsync("서연", 85, 80);
        var reasons2 = await _engine.GenerateReasonsAsync("서연", 85, 80);

        // 같은 이름+같은 점수면 결과가 동일해야 (결정적 랜덤)
        Assert.Equal(reasons1, reasons2);
    }

    // =========================================================================
    // GenerateDetailedReasonsAsync 테스트
    // =========================================================================

    [Fact]
    public async Task GenerateDetailedReasonsAsync_ReturnsAllFields()
    {
        var result = await _engine.GenerateDetailedReasonsAsync(
            "서연", "김", 85, 80, 60, "female", "soft");

        Assert.False(string.IsNullOrWhiteSpace(result.Summary));
        Assert.True(result.Strengths.Count >= 2);
        Assert.False(string.IsNullOrWhiteSpace(result.ToneReason));
        Assert.False(string.IsNullOrWhiteSpace(result.PronunciationNote));
        Assert.False(string.IsNullOrWhiteSpace(result.MeaningNote));
    }

    [Fact]
    public async Task GenerateDetailedReasonsAsync_StrengthsHaveAtLeastTwo()
    {
        var result = await _engine.GenerateDetailedReasonsAsync(
            "민준", "박", 70, 60, 50, "male", "strong");

        Assert.True(result.Strengths.Count >= 2);
        Assert.True(result.Strengths.Count <= 4);
    }

    [Fact]
    public async Task GenerateDetailedReasonsAsync_CautionsMaxTwo()
    {
        var result = await _engine.GenerateDetailedReasonsAsync(
            "쁘쁘쁘쁘", null, 30, 30, 10, "neutral", "neutral");

        Assert.True(result.Cautions.Count <= 2);
    }

    [Fact]
    public async Task GenerateDetailedReasonsAsync_SoftTone_MentionsSoft()
    {
        var result = await _engine.GenerateDetailedReasonsAsync(
            "서아", "이", 85, 80, 60, "female", "soft");

        Assert.Contains("Soft", result.ToneReason);
    }

    [Fact]
    public async Task GenerateDetailedReasonsAsync_StrongTone_MentionsStrong()
    {
        var result = await _engine.GenerateDetailedReasonsAsync(
            "민준", "김", 85, 80, 60, "male", "strong");

        Assert.True(
            result.ToneReason.Contains("Strong") || result.ToneReason.Contains("강한"),
            $"ToneReason should mention strength-related terms, but was: {result.ToneReason}");
    }

    [Fact]
    public async Task GenerateDetailedReasonsAsync_DifferentTones_ProduceDifferentToneReasons()
    {
        var softResult = await _engine.GenerateDetailedReasonsAsync(
            "서연", "김", 85, 80, 60, "female", "soft");
        var strongResult = await _engine.GenerateDetailedReasonsAsync(
            "서연", "김", 85, 80, 60, "female", "strong");

        Assert.NotEqual(softResult.ToneReason, strongResult.ToneReason);
    }

    [Fact]
    public async Task GenerateDetailedReasonsAsync_LowRarity_HasCaution()
    {
        var result = await _engine.GenerateDetailedReasonsAsync(
            "서연", "김", 85, 80, 20, "female", "neutral");

        Assert.Contains(result.Cautions, c => c.Contains("독창성") || c.Contains("사용 빈도") || c.Contains("인기 이름"));
    }

    [Fact]
    public async Task GenerateDetailedReasonsAsync_LowAesthetic_HasCaution()
    {
        var result = await _engine.GenerateDetailedReasonsAsync(
            "서연", "김", 50, 80, 60, "female", "neutral");

        Assert.Contains(result.Cautions, c => c.Contains("어색") || c.Contains("발음"));
    }

    [Fact]
    public async Task GenerateDetailedReasonsAsync_HighRarity_HasRarityStrength()
    {
        var result = await _engine.GenerateDetailedReasonsAsync(
            "서연", "김", 85, 80, 75, "female", "neutral");

        Assert.Contains(result.Strengths, s => s.Contains("독창") || s.Contains("개성"));
    }

    [Fact]
    public async Task GenerateDetailedReasonsAsync_NullLastName_DoesNotThrow()
    {
        var result = await _engine.GenerateDetailedReasonsAsync(
            "서연", null, 85, 80, 60, "female", "soft");

        Assert.False(string.IsNullOrWhiteSpace(result.Summary));
        Assert.True(result.Strengths.Count >= 2);
    }
}
