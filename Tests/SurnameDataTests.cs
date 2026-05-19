using NameForm.Application.Engines.Data;

namespace NameForm.Tests;

public class SurnameDataTests
{
    [Fact]
    public void GetInfo_TwoCharSurname_ReturnsTwoCharType()
    {
        var info = SurnameData.GetInfo("남궁");

        Assert.Equal(SurnameData.SurnameType.TwoChar, info.Type);
        Assert.Equal(2, info.SyllableCount);
    }

    [Theory]
    [InlineData("독고")]
    [InlineData("사공")]
    [InlineData("제갈")]
    [InlineData("황보")]
    public void GetInfo_KnownTwoCharSurnames_AllRecognized(string surname)
    {
        var info = SurnameData.GetInfo(surname);
        Assert.Equal(SurnameData.SurnameType.TwoChar, info.Type);
    }

    [Theory]
    [InlineData("김")]
    [InlineData("이")]
    [InlineData("박")]
    public void GetInfo_CommonSurname_ReturnsStandardType(string surname)
    {
        var info = SurnameData.GetInfo(surname);
        Assert.Equal(SurnameData.SurnameType.Standard, info.Type);
    }

    [Fact]
    public void GetRecommendedNameLength_TwoCharSurname_Returns1To2()
    {
        var (min, max) = SurnameData.GetRecommendedNameLength("남궁");

        Assert.Equal(1, min);
        Assert.Equal(2, max);
    }

    [Fact]
    public void GetRecommendedNameLength_StandardSurname_Returns2To3()
    {
        var (min, max) = SurnameData.GetRecommendedNameLength("김");

        Assert.Equal(2, min);
        Assert.Equal(3, max);
    }

    [Fact]
    public void IsTwoCharSurname_Correct()
    {
        Assert.True(SurnameData.IsTwoCharSurname("남궁"));
        Assert.False(SurnameData.IsTwoCharSurname("김"));
    }

    [Fact]
    public void GetInfo_HasFinalConsonant_Correct()
    {
        var namgung = SurnameData.GetInfo("남궁");
        // "궁" has no final consonant (ㅇ받침 → actually 궁 has ㅇ받침)
        // 궁 = 0xAD81, (0xAD81 - 0xAC00) = 385, 385 % 28 = 21 (ㅇ받침)
        Assert.True(namgung.HasFinalConsonant);

        var sa = SurnameData.GetInfo("사");
        // 사 has no final consonant
        Assert.False(sa.HasFinalConsonant);
    }
}
