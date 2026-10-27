using System.Reflection;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 생성 풀의 불용 글자 필터(2026-10-27) — 사전 전체(HanjaDictionary.Values)를 쓰던 생성 경로(ThreeSyllableEngine·TwinNameEngine·
/// ParentBasedNamingEngine.GetFilteredHanja·FamilyNarrativeExtractor 세대 조합)가 /name·/evaluate 와 같은 술어(HanjaSelector.IsUsableNameHanja —
/// 불용 아님 + 뜻 있음)로 거른다. 기대값은 테스트 안에서 IsForbiddenNameHanja + 뜻 유무로 따로 센다(검사 대상 술어를 쓰지 않는다).
/// </summary>
public class GenerationPoolForbiddenTests
{
    public GenerationPoolForbiddenTests() => HanjaData.LoadExternalData();

    private static bool UsableIndependent(HanjaData.HanjaInfo h)
        => !HanjaData.IsForbiddenNameHanja(h.Character) && !string.IsNullOrEmpty(h.Meaning);

    [Theory]
    [InlineData("hanja", "none")]
    [InlineData("hanja", "male")]
    [InlineData("hanja", "female")]
    [InlineData("mixed", "none")]
    [InlineData("mixed", "female")]
    public async Task ThreeSyllable_HanjaComponents_NeverForbidden(string nameType, string gender)
    {
        // 결과의 한자 요소는 "{글자}({독음})" — 3한자 Tier 1(Core_v1)은 오행 검수 커버리지라 불용 글자도 들어 있었다
        var candidates = await new ThreeSyllableEngine().GenerateCandidatesAsync("김", gender, "neutral", nameType, 50);
        Assert.NotEmpty(candidates);
        var hanja = candidates.SelectMany(c => c.Components)
            .Where(x => x.Contains('('))
            .Select(x => x[..x.IndexOf('(')])
            .Where(HanjaData.IsHanCodePoint)
            .ToList();
        Assert.NotEmpty(hanja);
        Assert.All(hanja, ch => Assert.True(UsableIndependent(HanjaData.FindByCharacter(ch)!), $"불용·뜻 없는 글자 {ch}"));
    }

    [Theory]
    [InlineData("none")]
    [InlineData("male")]
    [InlineData("female")]
    public void ParentBased_FilteredHanjaPool_NeverForbidden(string gender)
    {
        var engine = new ParentBasedNamingEngine(new NamePoolEngine(new FakeSajuCalculationService()), new NameReversalEngine());
        var method = typeof(ParentBasedNamingEngine).GetMethod("GetFilteredHanja", BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.NotNull(method);
        var pool = (List<HanjaData.HanjaInfo>)method!.Invoke(engine, new object[] { gender, "neutral" })!;
        Assert.NotEmpty(pool);
        Assert.All(pool, h => Assert.True(UsableIndependent(h), $"불용·뜻 없는 글자 {h.Character}"));
        // 거른 것은 불용·뜻 없는 글자뿐 — 같은 성별 필터를 지난 쓸 수 있는 글자는 그대로 남는다
        var expected = HanjaData.HanjaDictionary.Values.Where(UsableIndependent)
            .Where(h => gender != "male" || h.GenderPref != HanjaData.GenderPreference.Female)
            .Where(h => gender != "female" || h.GenderPref != HanjaData.GenderPreference.Male)
            .Select(h => h.Character).ToHashSet();
        Assert.Equal(expected.Count, pool.Count);
    }

    [Fact]
    public async Task Twin_NameSyllables_HaveUsableHanja()
    {
        // 쌍둥이 풀은 독음마다 개인화 점수 최고 글자를 대표로 쓴다 — 불용 글자가 대표가 되면 쓸 글자가 없는 음절(괵·몰 등)도 이름에 들어갈 수 있었다
        var sets = await new TwinNameEngine(new FakeSajuCalculationService())
            .GenerateTwinSetsAsync("김", new DateTime(2024, 3, 15), "none", "neutral", 2, null);
        Assert.NotEmpty(sets);
        foreach (var name in sets.SelectMany(s => s.Names))
            foreach (var syl in name.Where(c => HanjaData.FindByReading(c.ToString()).Any()))
                Assert.Contains(HanjaData.FindByReading(syl.ToString()), h => UsableIndependent(h));
    }

    [Fact]
    public void FamilyNarrative_GenerationalCombinations_UseUsableHanjaReadings()
    {
        // 세대 연결 서사 — 부모 이름의 공통 글자(영) + 사전 앞쪽 글자 10개의 독음. 그 10개가 쓸 수 있는 글자 중에서만 나온다
        var n = FamilyNarrativeExtractor.ExtractGenerationalBridgeNarrative("영수", "미영");
        Assert.NotEmpty(n.RecommendedHanja);
        var readings = HanjaData.HanjaDictionary.Values.Where(UsableIndependent).Take(10).Select(h => h.Reading).ToList();
        var expected = readings.SelectMany(r => new[] { "영" + r, r + "영" }).Distinct().Take(10).ToList();
        Assert.Equal(expected, n.RecommendedHanja);
    }
}
