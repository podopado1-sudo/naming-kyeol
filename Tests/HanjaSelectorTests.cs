using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using static NameForm.Application.Engines.Data.HanjaData;
using Xunit;

namespace NameForm.Tests;

public class HanjaSelectorTests
{
    public HanjaSelectorTests() => HanjaData.LoadExternalData();

    [Fact]
    public void Select_DifferentYongshin_PicksDifferentHanja()
    {
        // 같은 음절도 용신 오행이 다르면 그 오행에 맞는 한자가 선택돼야 한다(사주→한자 배정).
        var water = HanjaSelector.Select("우", "none", "水", null, null);
        var earth = HanjaSelector.Select("우", "none", "土", null, null);

        Assert.NotEmpty(water);
        Assert.NotEmpty(earth);
        Assert.NotEqual(water[0]?.Character, earth[0]?.Character);
        // 선택된 한자의 오행이 요청한 용신과 일치(해당 오행 인명 한자가 존재할 때)
        Assert.Equal("水", water[0]?.FiveElement);
        Assert.Equal("土", earth[0]?.FiveElement);
    }

    [Fact]
    public void Select_AvoidsForbiddenHanja()
    {
        // 불용한자(부정 의미)는 선택되지 않는다.
        foreach (var syl in new[] { "사", "병", "수", "정" })
        {
            var sel = HanjaSelector.Select(syl, "none", null, null, null);
            Assert.All(sel, h => Assert.False(
                h != null && HanjaData.IsForbiddenNameHanja(h.Character),
                $"'{syl}' 선택이 불용한자 {h?.Character}"));
        }
    }

    [Fact]
    public void Select_NoYongshin_StillReturnsNameAppropriateHanja()
    {
        // 용신 없이도(가족 평가 등) 인명 빈출 한자를 고른다 — 雨 같은 비이름 글자 회피 가능.
        var sel = HanjaSelector.Select("윤슬", "none", null, null, null);
        Assert.Equal(2, sel.Count);
        Assert.All(sel, h => Assert.NotNull(h));
    }

    [Theory]
    [InlineData("미")]
    [InlineData("민")]
    [InlineData("서")]
    [InlineData("율")]
    public void OrderForDisplay_IsIndependentOfInputOrder_AndFrontsCommonBasicHanja(string syllable)
    {
        var candidates = HanjaData.FindByReading(syllable);
        var forward = HanjaSelector.OrderForDisplay(candidates).Select(h => h.Character).ToList();
        var backward = HanjaSelector.OrderForDisplay(Enumerable.Reverse(candidates)).Select(h => h.Character).ToList();

        Assert.NotEmpty(forward);
        Assert.Equal(forward, backward);

        // 앞쪽 3개 = 표시 옵션: 불용자 없음, 뜻 있음, 빈출 한자가 있으면 빈출 한자가 앞
        var top = HanjaSelector.TopForDisplay(syllable, 3);
        Assert.All(top, h => Assert.False(HanjaData.IsForbiddenNameHanja(h.Character)));
        Assert.All(top, h => Assert.False(string.IsNullOrEmpty(h.Meaning)));
        if (candidates.Any(h => HanjaData.IsCommonNameHanja(h.Character) && !HanjaData.IsWeakGivenNameHanja(h.Character)))
            Assert.True(HanjaData.IsCommonNameHanja(top[0].Character), $"'{syllable}' 첫 옵션 {top[0].Character}가 빈출자가 아님");
        // 확장 A 등 기본 영역 밖 글자는 기본 영역 후보가 남아 있는 동안 나오지 않는다
        var firstNonBasic = forward.FindIndex(c => !HanjaData.IsInCjkBasicRange(c));
        if (firstNonBasic >= 0)
            Assert.DoesNotContain(forward.Skip(firstNonBasic), HanjaData.IsInCjkBasicRange);
    }
}
