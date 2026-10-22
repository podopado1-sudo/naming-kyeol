using System.Linq;
using System.Text.Json;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 성별 선호 오버라이드(data/hanja-gender-overrides.json + 하드코딩 정리) 회귀 테스트 — 2026-10-22 감사 ND-2.
/// GenderPref 는 /name 조합(반대 성별 −400)·라이브 선택기(−200)·미학 성별 보너스가 함께 읽는다.
/// 赫(빛날 혁)이 키워드 분류로 Female 이 되자 남자 혁 이름 1순위를 侐(고요할 혁, D등급)이 차지했고,
/// 恩 하드코딩 Female 때문에 남자 은 이름 1순위는 전부 銀이었다.
/// </summary>
public class HanjaGenderOverrideTests
{
    private static Dictionary<string, string> LoadOverrideFile()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "data", "hanja-gender-overrides.json");
        Assert.True(File.Exists(path), "data/hanja-gender-overrides.json 이 산출물에 없다");
        return JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path))!;
    }

    [Fact]
    public void OverrideFile_KeysAreUnifiedHanja_ValuesAreEnumNames_AndApplied()
    {
        var overrides = LoadOverrideFile();
        Assert.NotEmpty(overrides);
        foreach (var (ch, value) in overrides)
        {
            Assert.True(HanjaData.IsHanCodePoint(ch), $"키는 한자 1글자: {ch}");
            Assert.Equal(ch, HanjaData.ToUnifiedHanja(ch)); // 호환 한자 키 금지 — 사전은 통합 한자 키만 둔다
            Assert.True(Enum.TryParse<HanjaData.GenderPreference>(value, out var pref) && Enum.IsDefined(pref), $"{ch}: 값 {value}");

            var info = HanjaData.FindByCharacter(ch);
            Assert.NotNull(info);
            Assert.Equal(pref, info!.GenderPref); // 모든 기록자 이후에 적용됐다
        }
    }

    [Theory]
    [InlineData("赫")] // 빛날 혁 — unihan 분류 Female('빛날')
    [InlineData("焃")] // 빛날 혁
    [InlineData("焱")] // 불꽃 혁
    [InlineData("恩")] // 은혜 은 — 하드코딩 Female 제거
    [InlineData("秀")] // 빼어날 수 — 하드코딩 제거 + 오버라이드(unihan·분류기 '빼어날'이 Female)
    public void MisclassifiedGender_IsNeutral(string ch)
    {
        var info = HanjaData.FindByCharacter(ch);
        Assert.NotNull(info);
        Assert.Equal(HanjaData.GenderPreference.Neutral, info!.GenderPref);
    }

    [Fact]
    public void Hye_CommonHanja_ShareOneGender()
    {
        // 惠의 하드코딩 Female 을 남긴 근거: 혜 줄 빈출 惠·慧·蕙가 같은 성별이면 감점이 상쇄된다.
        // 惠만 Neutral 로 바꾸면 여자 혜 이름 52명의 1순위가 慧로 넘어갔다(2026-10-22 측정). 바꾸려면 셋을 함께.
        var genders = new[] { "惠", "慧", "蕙" }.Select(c => HanjaData.FindByCharacter(c)!.GenderPref).Distinct().ToList();
        Assert.Single(genders);
    }

    [Theory]
    [InlineData("준혁")]
    [InlineData("승혁")]
    [InlineData("민혁")]
    public void SelectCombos_MaleHyeok_UsesHyeokOfBrightness_NotQuietHyeok(string name)
    {
        var combos = HanjaSelector.SelectCombos(name, "male", 4);

        Assert.NotEmpty(combos);
        Assert.Equal("赫", combos[0].Second);
        Assert.DoesNotContain(combos, c => c.Second == "侐"); // 고요할 혁(D등급)
    }

    [Theory]
    [InlineData("은찬")]
    [InlineData("은호")]
    [InlineData("은성")]
    public void SelectCombos_MaleEun_IncludesGrace(string name)
    {
        // 恩이 Female 이던 때는 남자 은 이름 55명 1순위가 전부 銀이었고 恩은 −400 으로 밀렸다
        var combos = HanjaSelector.SelectCombos(name, "male", 4);
        Assert.Contains(combos, c => c.First == "恩");
    }

    [Fact]
    public async Task Aesthetic_Junhyeok_NoGenderMismatchNote()
    {
        // 혁 음절에 Female 글자(赫·焃·焱)만 있어 '맞지 않음' 노트가 '잘 맞음'과 함께 떴다(감사 ND-7)
        var b = await new AestheticEngine().CalculateScoreWithBreakdownAsync("준혁", null, "neutral", "male");
        Assert.DoesNotContain(b.Notes, n => n.Contains("맞지 않음"));
    }
}
