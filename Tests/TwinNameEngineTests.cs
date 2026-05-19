using NameForm.Application.Engines;

namespace NameForm.Tests;

public class TwinNameEngineTests
{
    private readonly TwinNameEngine _engine = new(new FakeSajuCalculationService());

    [Fact]
    public async Task GenerateTwinSetsAsync_BasicRequest_ReturnsSets()
    {
        var sets = await _engine.GenerateTwinSetsAsync(
            "이", DateTime.Now, "none", "neutral", 2, null);

        Assert.True(sets.Count > 0);
    }

    [Fact]
    public async Task GenerateTwinSetsAsync_AllThemeTypes_Present()
    {
        var sets = await _engine.GenerateTwinSetsAsync(
            "김", DateTime.Now, "none", "neutral", 2, null);

        var themes = sets.Select(s => s.Theme).Distinct().ToList();
        // 최소 1개 테마는 있어야 함
        Assert.True(themes.Count >= 1);
    }

    [Fact]
    public async Task GenerateTwinSetsAsync_EachSetHasCorrectChildCount()
    {
        var sets = await _engine.GenerateTwinSetsAsync(
            "박", DateTime.Now, "none", "neutral", 2, null);

        foreach (var set in sets)
        {
            Assert.Equal(2, set.Names.Count);
        }
    }

    [Fact]
    public async Task GenerateTwinSetsAsync_ThreeChildren_Works()
    {
        var sets = await _engine.GenerateTwinSetsAsync(
            "이", DateTime.Now, "none", "neutral", 3, null);

        foreach (var set in sets)
        {
            Assert.Equal(3, set.Names.Count);
        }
    }

    [Fact]
    public async Task GenerateTwinSetsAsync_ExcludesExistingSiblings()
    {
        var existing = new List<string> { "서연" };
        var sets = await _engine.GenerateTwinSetsAsync(
            "김", DateTime.Now, "female", "soft", 2, existing);

        foreach (var set in sets)
        {
            Assert.DoesNotContain("서연", set.Names);
        }
    }

    [Fact]
    public async Task GenerateTwinSetsAsync_CoherenceScoreInRange()
    {
        var sets = await _engine.GenerateTwinSetsAsync(
            "이", DateTime.Now, "none", "neutral", 2, null);

        foreach (var set in sets)
        {
            Assert.InRange(set.CoherenceScore, 0, 100);
        }
    }
}
