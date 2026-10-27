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
        // 2026-10-22 S4 부수 기준: 우 빈출 宇(宀)=木·佑(亻)=火 — 옛 뜻 기반 값(佑·宇 모두 土)에선 水/土 로 갈랐다
        var wood = HanjaSelector.Select("우", "none", "木", null, null);
        var fire = HanjaSelector.Select("우", "none", "火", null, null);

        Assert.NotEmpty(wood);
        Assert.NotEmpty(fire);
        Assert.NotEqual(wood[0]?.Character, fire[0]?.Character);
        // 선택된 한자의 오행이 요청한 용신과 일치(해당 오행 인명 한자가 존재할 때)
        Assert.Equal("木", wood[0]?.FiveElement);
        Assert.Equal("火", fire[0]?.FiveElement);
        Assert.Equal("宇", wood[0]?.Character);
        Assert.Equal("佑", fire[0]?.Character);
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
    // ── 2026-10-27 O1: 조합 선택도 대안이 있으면 반대 성별 글자를 뺀다 (Select 와 같은 순서 — 약자 양보·확장 영역 회피가 먼저) ──

    private static string Cp(int codepoint) => char.ConvertFromUtf32(codepoint);

    [Theory]
    [InlineData("규언", "male", 0x5AE3)]   // 嫣 아리따울(女부 Female) — 옛 1순위 規嫣, 대안 彦·鶠
    [InlineData("동언", "male", 0x5AE3)]   // 옛 東嫣
    [InlineData("나형", "female", 0x8861)] // 衡 저울대(Male — 오버라이드) — 옛 1순위 羅衡, 대안 炯
    [InlineData("가형", "female", 0x4EA8)] // 亨 형통할(Male) — 옛 佳亨
    public void SelectCombos_OppositeGender_ExcludedWhenAlternativeExists(string name, string gender, int oppositeCp)
    {
        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        Assert.NotEmpty(combos);
        Assert.DoesNotContain(combos, c => c.First == Cp(oppositeCp) || c.Second == Cp(oppositeCp));
        var opposite = gender == "male" ? GenderPreference.Female : GenderPreference.Male;
        // 그 음절 글자는 모두 반대 성별이 아니다(대안이 있는 음절)
        int syl = name.IndexOf(HanjaData.FindByCharacter(Cp(oppositeCp))!.Reading[0]);
        Assert.All(combos, c => Assert.NotEqual(opposite, HanjaData.FindByCharacter(syl == 0 ? c.First : c.Second)!.GenderPref));
    }

    [Theory]
    [InlineData("나형", "female")] // 羅炯·娜炯 — 형 줄 빈출 亨·衡(Male)·炯 중 炯 만 남는다
    [InlineData("슬찬", "male")]   // 瑟燦 하나
    [InlineData("나혁", "female")] // 羅赫·娜赫
    public void SelectCombos_EmptiedSlots_NotRefilledWithWeakOrOpposite(string name, string gender)
    {
        // 반대 성별을 빼서 칸이 비면 약자·반대 성별 조합으로 다시 채우지 않고 조합 수를 줄인 채 둔다(2026-10-27 판정 보완 ②)
        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        var opposite = gender == "male" ? GenderPreference.Female : GenderPreference.Male;
        Assert.InRange(combos.Count, 1, 3);
        Assert.All(combos, c =>
        {
            Assert.False(HanjaData.IsWeakGivenNameHanja(c.First) || HanjaData.IsWeakGivenNameHanja(c.Second), $"{name}: 약자 {c.First}{c.Second}");
            Assert.NotEqual(opposite, HanjaData.FindByCharacter(c.First)!.GenderPref);
            Assert.NotEqual(opposite, HanjaData.FindByCharacter(c.Second)!.GenderPref);
        });
    }

    [Fact]
    public void SelectCombos_NoAlternative_KeepsOppositeGender()
    {
        // 혜 줄 빈출 惠·慧·蕙 가 모두 Female 이라 대안이 없다 — 남자 혜성도 조합이 있고 1순위 혜 글자는 Female(맞지 않음은 그대로)
        var combos = HanjaSelector.SelectCombos("혜성", "male", 4);
        Assert.NotEmpty(combos);
        Assert.Equal(GenderPreference.Female, HanjaData.FindByCharacter(combos[0].First)!.GenderPref);
    }

    // ── 2026-10-27 판정 보완 ①: 꼴만 다른 이체자 조합은 한 칸으로 (정자 = hanja_variants.json standard) ──

    [Fact]
    public void GlyphVariantKey_LinksGlyphVariants_NotSemanticVariants()
    {
        Assert.NotNull(HanjaData.GlyphVariantKey(Cp(0x5F65)));                                            // 彥
        Assert.Equal(HanjaData.GlyphVariantKey(Cp(0x5F65)), HanjaData.GlyphVariantKey(Cp(0x5F66)));     // 彥 = 彦 (간번체, 같은 부수·훈)
        Assert.Equal(HanjaData.GlyphVariantKey(Cp(0x51DB)), HanjaData.GlyphVariantKey(Cp(0x51DC)));     // 凛 = 凜
        Assert.True(HanjaData.IsGlyphVariantStandard(Cp(0x5F66)));                                       // 彦 이 정자(KS X 1001)
        Assert.False(HanjaData.IsGlyphVariantStandard(Cp(0x5F65)));
        // 뜻 이체·부수가 다른 쌍은 이름에서 다른 글자로 쓴다 — 잇지 않는다
        foreach (var (a, b) in new[] { (0x5F6C, 0x658C), (0x5FB7, 0x60B3), (0x572D, 0x73EA), (0x4F51, 0x7950), (0x5091, 0x6770) }) // 彬斌·德悳·圭珪·佑祐·傑杰
        {
            var ka = HanjaData.GlyphVariantKey(Cp(a));
            Assert.True(ka == null || ka != HanjaData.GlyphVariantKey(Cp(b)), $"{Cp(a)}·{Cp(b)}");
        }
    }

    [Theory]
    [InlineData("시언", "male")]
    [InlineData("규언", "male")]
    [InlineData("구름", "female")]
    [InlineData("아름", "female")]
    public void SelectCombos_GlyphVariantDuplicates_CollapsedToStandard(string name, string gender)
    {
        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        Assert.NotEmpty(combos);
        string Key(string c) => HanjaData.GlyphVariantKey(c) ?? c;
        var keys = combos.Select(c => (Key(c.First), Key(c.Second))).ToList();
        Assert.Equal(keys.Count, keys.Distinct().Count()); // 같은 조합을 꼴만 바꿔 두 칸에 싣지 않는다
        Assert.All(combos, c =>
        {
            Assert.NotEqual(false, HanjaData.IsGlyphVariantStandard(c.First));  // 정자 조합이 대표(彦·凜)
            Assert.NotEqual(false, HanjaData.IsGlyphVariantStandard(c.Second));
        });
    }

    [Fact]
    public void SelectCombos_SemanticVariantPair_BothStay()
    {
        // 彬·斌(뜻 이체 — 꼴이 다르다)은 지금처럼 한 페이지에 함께 보일 수 있다
        var combos = HanjaSelector.SelectCombos("우빈", "male", 4);
        Assert.Contains(combos, c => c.Second == Cp(0x5F6C));
        Assert.Contains(combos, c => c.Second == Cp(0x658C));
    }

    // ── 2026-10-27 O2: 출생일 없는 기본 배정 = /name 1순위 조합 ──

    [Theory]
    [InlineData("지우", "female")]
    [InlineData("규언", "male")]
    [InlineData("나형", "female")]
    [InlineData("하늘", "none")]
    public void DefaultAssignment_TwoSyllable_IsFirstCombo(string name, string gender)
    {
        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        Assert.NotEmpty(combos);
        Assert.Equal(new[] { combos[0].First, combos[0].Second }, HanjaSelector.DefaultAssignment(name, gender).Select(h => h?.Character));
    }

    [Theory]
    [InlineData("하하", "none")]   // 첩음 — 조합 없음
    [InlineData("지우람", "female")] // 3음절
    [InlineData("준", "male")]
    public void DefaultAssignment_NoCombos_IsSelect(string name, string gender)
    {
        Assert.Equal(HanjaSelector.Select(name, gender, null, null, null).Select(h => h?.Character),
            HanjaSelector.DefaultAssignment(name, gender).Select(h => h?.Character));
    }
}
