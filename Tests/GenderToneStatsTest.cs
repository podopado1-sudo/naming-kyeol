using NameForm.Application.Engines.Data;
using Xunit.Abstractions;

namespace NameForm.Tests;

public class GenderToneStatsTest
{
    private readonly ITestOutputHelper _output;

    public GenderToneStatsTest(ITestOutputHelper output)
    {
        _output = output;
        HanjaData.LoadExternalData();
    }

    [Fact]
    public void PrintStats()
    {
        var all = HanjaData.GetAllHanja();
        var total = all.Count;

        var male = all.Count(h => h.GenderPref == HanjaData.GenderPreference.Male);
        var female = all.Count(h => h.GenderPref == HanjaData.GenderPreference.Female);
        var gNeutral = all.Count(h => h.GenderPref == HanjaData.GenderPreference.Neutral);

        var strong = all.Count(h => h.TonePref == HanjaData.TonePreference.Strong);
        var soft = all.Count(h => h.TonePref == HanjaData.TonePreference.Soft);
        var tNeutral = all.Count(h => h.TonePref == HanjaData.TonePreference.Neutral);

        _output.WriteLine($"=== GenderPref/TonePref 분류 통계 ===");
        _output.WriteLine($"전체 한자: {total}");
        _output.WriteLine($"");
        _output.WriteLine($"[Gender]");
        _output.WriteLine($"  Male:    {male} ({100.0 * male / total:F1}%)");
        _output.WriteLine($"  Female:  {female} ({100.0 * female / total:F1}%)");
        _output.WriteLine($"  Neutral: {gNeutral} ({100.0 * gNeutral / total:F1}%)");
        _output.WriteLine($"  Non-Neutral: {male + female} ({100.0 * (male + female) / total:F1}%)");
        _output.WriteLine($"");
        _output.WriteLine($"[Tone]");
        _output.WriteLine($"  Strong:  {strong} ({100.0 * strong / total:F1}%)");
        _output.WriteLine($"  Soft:    {soft} ({100.0 * soft / total:F1}%)");
        _output.WriteLine($"  Neutral: {tNeutral} ({100.0 * tNeutral / total:F1}%)");
        _output.WriteLine($"  Non-Neutral: {strong + soft} ({100.0 * (strong + soft) / total:F1}%)");

        Assert.True(true);
    }
}
