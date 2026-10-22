using System.Text.Json;
using System.Text.RegularExpressions;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// /name 정적 데이터의 이름 갈래 플래그(pk·fx)와 외래 이름 어원 뜻의 근거 자료 회귀 테스트 — 2026-10-22 S7(ND-3).
/// pk = PureKoreanNameEngine 내장 사전 − exclude + include(data/pure-korean-name-overrides.json — 사람 검토 가감 목록),
/// fx = 한자 조합이 없고 data/foreign-given-names.json(사람 검토 목록)에 실린 이름
/// (`dotnet run -- dump-name-flags` → build_name_seo_data.py). 예전에는 하엘·요셉·케빈 같은 외래 이름에 한자 뜻처럼 지어 붙인
/// 대표 뜻('차처럼 향기롭고'·'세상을 환히 밝히는')이 실려 있었고, '엘' 같은 음절이 '(순우리말)'로 표시됐다.
/// </summary>
public class NameSeoFlagTests
{
    // 외래 이름 어원 뜻 문장 — '히브리어로 신이 더하신다는', '고대 노르드어로 …', '히브리어 야곱에서 이어진'
    private static readonly Regex EtymologyMean = new(@"^(?:고대 )?[가-힣]+어(?:로 | [가-힣]+에서 이어진$)");

    private static (Dictionary<string, string> names, HashSet<string> kinds) LoadForeignList()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "data", "foreign-given-names.json");
        Assert.True(File.Exists(path), "data/foreign-given-names.json 이 산출물에 없다");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var kinds = doc.RootElement.GetProperty("meta").GetProperty("kinds").EnumerateObject().Select(p => p.Name).ToHashSet();
        var names = doc.RootElement.GetProperty("names").EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString() ?? "");
        return (names, kinds);
    }

    [Theory]
    [InlineData("하늘", true)]
    [InlineData("한결", true)]
    [InlineData("다솜", true)]
    [InlineData("민준", false)]
    [InlineData("하엘", false)]
    [InlineData("요셉", false)]
    public void PureKoreanDictionary_Membership(string name, bool expected)
    {
        Assert.Equal(expected, PureKoreanNameEngine.IsDictionaryName(name));
    }

    private static (HashSet<string> include, HashSet<string> exclude) LoadPkOverrides()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "data", "pure-korean-name-overrides.json");
        Assert.True(File.Exists(path), "data/pure-korean-name-overrides.json 이 산출물에 없다");
        return PureKoreanNameEngine.LoadSeoOverrides(File.ReadAllText(path));
    }

    [Theory]
    // ND-3 계획 예시 한별(翰潎 → 漢莂 '모종 낼 별')은 사전에 없지만 고유어 합성 이름이라 pk
    [InlineData("한별", true)]
    [InlineData("은별", true)]
    [InlineData("하늘", true)]
    [InlineData("구름", true)]
    // 사전에 있지만 한자 이름으로 흔한 이름·한자어 낱말 — pk 면 '한자가 꼭 필요하지는 않습니다'·참고 조합이 틀린 말이 된다(S7 검증 S7V-3)
    [InlineData("예린", false)]
    [InlineData("하린", false)]
    [InlineData("예나", false)]
    [InlineData("한나", false)]
    [InlineData("보미", false)]
    [InlineData("소망", false)]
    [InlineData("미래", false)]
    [InlineData("다정", false)]
    [InlineData("민준", false)]
    [InlineData("하엘", false)]
    public void PureKoreanSeoFlag(string name, bool expected)
    {
        var (include, exclude) = LoadPkOverrides();
        Assert.Equal(expected, PureKoreanNameEngine.IsPureKoreanSeoName(name, include, exclude));
    }

    [Fact]
    public void PkOverrides_WellFormed()
    {
        // exclude 는 사전에 있는 이름만, include 는 사전·외래 목록에 없는 이름만(겹치면 목록이 낡은 것), 둘은 겹치지 않는다
        var (include, exclude) = LoadPkOverrides();
        var (foreign, _) = LoadForeignList();
        Assert.Empty(include.Intersect(exclude));
        foreach (var name in exclude)
            Assert.True(PureKoreanNameEngine.IsDictionaryName(name), $"{name}: exclude 인데 사전에 없다");
        foreach (var name in include)
        {
            Assert.Matches("^[가-힣]{2,3}$", name);
            Assert.False(PureKoreanNameEngine.IsDictionaryName(name), $"{name}: include 인데 이미 사전에 있다");
            Assert.False(foreign.ContainsKey(name), $"{name}: include 인데 외래 목록에 있다");
        }
    }

    [Fact]
    public void ForeignList_WellFormed_AndDisjointFromPureKoreanDictionary()
    {
        var (names, kinds) = LoadForeignList();
        var (include, _) = LoadPkOverrides();
        Assert.True(names.Count >= 100, $"외래 목록이 비정상적으로 작다: {names.Count}");
        foreach (var (name, kind) in names)
        {
            Assert.Matches("^[가-힣]{2,3}$", name);
            Assert.Contains(kind, kinds);
            Assert.False(PureKoreanNameEngine.IsDictionaryName(name), $"{name}: 순우리말 사전과 외래 목록에 함께 있으면 pk 가 이긴다 — 목록에서 뺄 것");
            Assert.False(include.Contains(name), $"{name}: pk include 와 외래 목록에 함께 있다");
        }
    }

    [Fact]
    public void ForeignList_TwoSyllableNames_HaveNoHanjaCombos()
    {
        // fx 는 '조합 없는 외래 이름' — 조합이 생기면(새 독음 한자 추가 등) 덤프가 fx 를 빼므로 목록도 다시 볼 것
        HanjaData.LoadExternalData();
        var (names, _) = LoadForeignList();
        foreach (var name in names.Keys.Where(n => n.Length == 2 && n[0] != n[1]))
            foreach (var gender in new[] { "male", "female", "none" })
                Assert.True(HanjaSelector.SelectCombos(name, gender, 4).Count == 0, $"{name}({gender}): 한자 조합이 있다");
    }

    [Fact]
    public void EtymologyMeanings_OnlyOnForeignListedNames()
    {
        var (names, _) = LoadForeignList();
        var path = Path.Combine(AppContext.BaseDirectory, "data", "creative-name-meanings.json");
        var meanings = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path))!;
        var etymology = meanings.Where(kv => EtymologyMean.IsMatch(kv.Value)).Select(kv => kv.Key).ToList();
        Assert.True(etymology.Count >= 50, $"어원 뜻 문장 수가 비정상적으로 적다: {etymology.Count}");
        var stray = etymology.Where(n => !names.ContainsKey(n)).ToList();
        Assert.True(stray.Count == 0, $"어원 뜻인데 외래 목록에 없는 이름: {string.Join(" ", stray)}");
    }

    [Theory]
    // 예전 대표 뜻이 한자 풀이처럼 지어 붙인 것이던 조합 없는 외래 이름 — 어원 문장이거나 비어 있어야 한다
    [InlineData("요셉")]
    [InlineData("다윗")]
    [InlineData("케빈")]
    [InlineData("요엘")]
    [InlineData("노엘")]
    [InlineData("하엘")]
    [InlineData("다엘")]
    [InlineData("시엘")]
    [InlineData("이엘")]
    [InlineData("엘리")]
    [InlineData("엘라")]
    [InlineData("레아")]
    public void ForeignNames_MeaningIsEtymologyOrEmpty(string name)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "data", "creative-name-meanings.json");
        var meanings = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path))!;
        if (meanings.TryGetValue(name, out var mean) && !string.IsNullOrWhiteSpace(mean))
            Assert.Matches(EtymologyMean, mean);
    }
}
