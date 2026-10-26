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

    // ── 2026-10-26 B6 보완: 산호(珊·瑚)는 옥·구슬 훈 글자처럼 Female — GenderToneClassifier 보석 키워드에 '산호'가 없어 Neutral 이었다 ──
    // B1(인명용 목록 보강)로 珊(산호 산)이 山(메 산)과 관련도가 같아지자 오행 상생 가점(±20/−12)만으로 남자 이름 산 줄이 珊으로 넘어가
    // 강산=江珊·태산=泰珊·산하=珊河(江山·泰山·山河 탈락), 산호·호산·윤산 1순위가 珊 이 됐다(대표 뜻·서사는 산(山)을 말함). 정수 코드포인트로 적는다.

    private static string Cp(int codepoint) => char.ConvertFromUtf32(codepoint);

    [Theory]
    [InlineData(0x73CA)] // 珊 산호 산
    [InlineData(0x745A)] // 瑚 산호 호
    [InlineData(0x73E0)] // 珠 구슬 주 — 같은 부류의 기준 글자
    public void CoralLikeJewel_IsFemale(int codepoint)
    {
        var info = HanjaData.FindByCharacter(Cp(codepoint));
        Assert.NotNull(info);
        Assert.Equal(HanjaData.GenderPreference.Female, info!.GenderPref);
    }

    [Theory]
    [InlineData("강산", 0x6C5F, 0x5C71)] // 江山
    [InlineData("태산", 0x6CF0, 0x5C71)] // 泰山
    [InlineData("산하", 0x5C71, 0x6CB3)] // 山河
    public void SelectCombos_MaleSan_KeepsMountainWordPair(string name, int first, int second)
    {
        var combos = HanjaSelector.SelectCombos(name, "male", 4);
        Assert.Contains((Cp(first), Cp(second)), combos);
    }

    [Theory]
    [InlineData("산호", 0)]
    [InlineData("호산", 1)]
    [InlineData("윤산", 1)]
    [InlineData("기산", 1)]
    [InlineData("영산", 1)]
    public void SelectCombos_MaleSan_TopComboUsesMountain(string name, int sanIndex)
    {
        var combos = HanjaSelector.SelectCombos(name, "male", 4);
        Assert.NotEmpty(combos);
        var top = combos[0];
        Assert.Equal(Cp(0x5C71), sanIndex == 0 ? top.First : top.Second); // 山
    }

    [Fact]
    public async Task Aesthetic_Junhyeok_NoGenderMismatchNote()
    {
        // 혁 음절에 Female 글자(赫·焃·焱)만 있어 '맞지 않음' 노트가 '잘 맞음'과 함께 떴다(감사 ND-7)
        var b = await new AestheticEngine().CalculateScoreWithBreakdownAsync("준혁", null, "neutral", "male");
        Assert.DoesNotContain(b.Notes, n => n.Contains("맞지 않음"));
    }
}
