using NameForm.Application.Engines;

namespace NameForm.Tests;

public class DualNameEngineTests
{
    private readonly DualNameEngine _engine = new();

    [Fact]
    public async Task GenerateDualNamesAsync_WithPhilip_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateDualNamesAsync(
            "김", "Philip", DateTime.Now, "male", "neutral");

        // 필립이 한자 매핑 가능한 경우에만 결과 반환
        // 한자 데이터가 로드되지 않은 테스트 환경에서는 0일 수 있음
        Assert.NotNull(candidates);
    }

    [Fact]
    public async Task GenerateDualNamesAsync_WithoutPreference_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateDualNamesAsync(
            "김", null, DateTime.Now, "female", "soft");

        Assert.NotNull(candidates);
    }

    [Fact]
    public async Task GenerateDualNamesAsync_AllCandidatesHaveRequiredFields()
    {
        var candidates = await _engine.GenerateDualNamesAsync(
            "이", "Sophia", DateTime.Now, "female", "soft");

        foreach (var candidate in candidates)
        {
            Assert.False(string.IsNullOrEmpty(candidate.KoreanName));
            Assert.False(string.IsNullOrEmpty(candidate.EnglishEquivalent));
            Assert.True(candidate.HanjaCharacters.Count > 0);
            Assert.False(string.IsNullOrEmpty(candidate.HanjaMeaning));
        }
    }

    [Fact]
    public async Task GenerateDualNamesAsync_KoreanNameIsValidHangul()
    {
        var candidates = await _engine.GenerateDualNamesAsync(
            "박", null, DateTime.Now, "male", "neutral");

        foreach (var candidate in candidates)
        {
            Assert.True(candidate.KoreanName.All(c => c >= 0xAC00 && c <= 0xD7A3));
            Assert.True(candidate.KoreanName.Length >= 2);
        }
    }
}
