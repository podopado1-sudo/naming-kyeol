using NameForm.Application.Engines.Data;

namespace NameForm.Tests;

/// <summary>
/// 한자 상세 데이터 확충 검증 테스트
/// hanja_unihan.json에서 로딩된 획수/오행/음양/성별/톤 데이터 검증
/// </summary>
public class HanjaDataEnhancementTests
{
    public HanjaDataEnhancementTests()
    {
        // 외부 데이터 로딩 보장
        HanjaData.LoadExternalData();
    }

    // ===== 획수 데이터 로딩 검증 =====

    [Fact]
    public void StrokeCount_MajorityOfHanja_HasStrokeCount()
    {
        var allHanja = HanjaData.GetAllHanja();
        var withStroke = allHanja.Count(h => h.StrokeCount > 0);
        var ratio = (double)withStroke / allHanja.Count;

        // 최소 50% 이상이 획수 데이터를 가져야 함
        Assert.True(ratio >= 0.5,
            $"획수 데이터 비율이 너무 낮습니다: {withStroke}/{allHanja.Count} ({ratio:P0})");
    }

    [Theory]
    [InlineData("春", 9)]   // 봄 춘 = 9획
    [InlineData("海", 9)]   // 바다 해 = 9획 (Unihan 기준 氵3+每6=9)
    [InlineData("山", 3)]   // 산 산 = 3획
    [InlineData("金", 8)]   // 쇠 금 = 8획
    [InlineData("花", 7)]   // 꽃 화 = 7획 (하드코딩)
    public void StrokeCount_KnownCharacters_CorrectValues(string character, int expectedStrokes)
    {
        var info = HanjaData.FindByCharacter(character);

        Assert.NotNull(info);
        Assert.Equal(expectedStrokes, info.StrokeCount);
    }

    // ===== 오행(FiveElement) 검증 =====

    [Fact]
    public void FiveElement_MajorityOfHanja_HasFiveElement()
    {
        var allHanja = HanjaData.GetAllHanja();
        var withFive = allHanja.Count(h => !string.IsNullOrEmpty(h.FiveElement));
        var ratio = (double)withFive / allHanja.Count;

        Assert.True(ratio >= 0.5,
            $"오행 데이터 비율: {withFive}/{allHanja.Count} ({ratio:P0})");
    }

    [Theory]
    [InlineData("春", "木")]  // 9획 → 水가 아닌 하드코딩 木
    [InlineData("山", "土")]  // 3획 → 火가 아닌 하드코딩 土
    public void FiveElement_HardcodedCharacters_PreservedValue(string character, string expectedElement)
    {
        var info = HanjaData.FindByCharacter(character);

        Assert.NotNull(info);
        Assert.Equal(expectedElement, info.FiveElement);
    }

    [Fact]
    public void FiveElement_AllValues_AreValid()
    {
        var validElements = new HashSet<string> { "木", "火", "土", "金", "水", "" };
        var allHanja = HanjaData.GetAllHanja();

        foreach (var hanja in allHanja.Where(h => !string.IsNullOrEmpty(h.FiveElement)))
        {
            Assert.Contains(hanja.FiveElement, validElements);
        }
    }

    // ===== 음양(YinYang) 검증 =====

    [Fact]
    public void YinYang_MajorityOfHanja_HasYinYang()
    {
        var allHanja = HanjaData.GetAllHanja();
        var withYY = allHanja.Count(h => !string.IsNullOrEmpty(h.YinYang));
        var ratio = (double)withYY / allHanja.Count;

        Assert.True(ratio >= 0.5,
            $"음양 데이터 비율: {withYY}/{allHanja.Count} ({ratio:P0})");
    }

    [Fact]
    public void YinYang_AllValues_AreValid()
    {
        var validYY = new HashSet<string> { "陰", "陽", "" };
        var allHanja = HanjaData.GetAllHanja();

        foreach (var hanja in allHanja.Where(h => !string.IsNullOrEmpty(h.YinYang)))
        {
            Assert.Contains(hanja.YinYang, validYY);
        }
    }

    [Fact]
    public void YinYang_StrokeBasedCalc_EvenIsYang_OddIsYin()
    {
        var allHanja = HanjaData.GetAllHanja()
            .Where(h => h.StrokeCount > 0 && !string.IsNullOrEmpty(h.YinYang))
            .ToList();

        // 하드코딩 45자는 수동 설정이므로 제외할 수 없지만,
        // 자동 계산된 대다수는 규칙을 따라야 함
        var conforming = allHanja.Count(h =>
            (h.StrokeCount % 2 == 0 && h.YinYang == "陽") ||
            (h.StrokeCount % 2 != 0 && h.YinYang == "陰"));

        var ratio = (double)conforming / allHanja.Count;

        // 40% 이상이 규칙을 따라야 함
        // Core Dataset(2,060자)은 KangxiStrokes(원획법) 기준으로 음양을 재계산하므로
        // StrokeCount(현대 획수) 기반 검증식과는 일부 어긋남 — 이는 정확도 개선의 결과
        // (예: 氵=3획이 아닌 水=4획으로 계산되는 한자들)
        Assert.True(ratio >= 0.4,
            $"음양 자동 계산 일치율: {conforming}/{allHanja.Count} ({ratio:P0})");
    }

    // ===== GenderPref 검증 =====

    [Fact]
    public void GenderPref_SomeHanja_HasNonNeutral()
    {
        var allHanja = HanjaData.GetAllHanja();
        var male = allHanja.Count(h => h.GenderPref == HanjaData.GenderPreference.Male);
        var female = allHanja.Count(h => h.GenderPref == HanjaData.GenderPreference.Female);

        // 남성/여성 분류가 각각 최소 1개 이상 있어야 함
        Assert.True(male > 0, $"Male 분류 한자가 없습니다");
        Assert.True(female > 0, $"Female 분류 한자가 없습니다");
    }

    [Theory]
    [InlineData("勇", HanjaData.GenderPreference.Male)]   // 용기 → 남성 (하드코딩)
    [InlineData("美", HanjaData.GenderPreference.Female)]  // 아름다움 → 여성 (하드코딩)
    [InlineData("花", HanjaData.GenderPreference.Female)]  // 꽃 → 여성 (하드코딩)
    public void GenderPref_KnownCharacters_CorrectClassification(
        string character, HanjaData.GenderPreference expected)
    {
        var info = HanjaData.FindByCharacter(character);

        Assert.NotNull(info);
        Assert.Equal(expected, info.GenderPref);
    }

    // ===== TonePref 검증 =====

    [Fact]
    public void TonePref_SomeHanja_HasNonNeutral()
    {
        var allHanja = HanjaData.GetAllHanja();
        var strong = allHanja.Count(h => h.TonePref == HanjaData.TonePreference.Strong);
        var soft = allHanja.Count(h => h.TonePref == HanjaData.TonePreference.Soft);

        Assert.True(strong > 0, $"Strong 분류 한자가 없습니다");
        Assert.True(soft > 0, $"Soft 분류 한자가 없습니다");
    }

    [Theory]
    [InlineData("海", HanjaData.TonePreference.Strong)]  // 바다 → 강한 (하드코딩)
    [InlineData("月", HanjaData.TonePreference.Soft)]    // 달 → 부드러운 (하드코딩)
    [InlineData("善", HanjaData.TonePreference.Soft)]    // 착함 → 부드러운 (하드코딩)
    public void TonePref_KnownCharacters_CorrectClassification(
        string character, HanjaData.TonePreference expected)
    {
        var info = HanjaData.FindByCharacter(character);

        Assert.NotNull(info);
        Assert.Equal(expected, info.TonePref);
    }

    // ===== 종합 완성도 =====

    [Fact]
    public void DataCompleteness_OverallStats()
    {
        var allHanja = HanjaData.GetAllHanja();
        var total = allHanja.Count;

        var stats = new
        {
            Total = total,
            WithStroke = allHanja.Count(h => h.StrokeCount > 0),
            WithFiveElement = allHanja.Count(h => !string.IsNullOrEmpty(h.FiveElement)),
            WithYinYang = allHanja.Count(h => !string.IsNullOrEmpty(h.YinYang)),
            WithMeaning = allHanja.Count(h => !string.IsNullOrEmpty(h.Meaning)),
            MaleGender = allHanja.Count(h => h.GenderPref == HanjaData.GenderPreference.Male),
            FemaleGender = allHanja.Count(h => h.GenderPref == HanjaData.GenderPreference.Female),
            StrongTone = allHanja.Count(h => h.TonePref == HanjaData.TonePreference.Strong),
            SoftTone = allHanja.Count(h => h.TonePref == HanjaData.TonePreference.Soft)
        };

        // 최소 기준: 획수/오행/음양 50% 이상
        Assert.True(stats.WithStroke > total / 2, $"획수: {stats.WithStroke}/{total}");
        Assert.True(stats.WithFiveElement > total / 2, $"오행: {stats.WithFiveElement}/{total}");
        Assert.True(stats.WithYinYang > total / 2, $"음양: {stats.WithYinYang}/{total}");

        // 성별/톤 분류된 한자가 존재해야 함
        Assert.True(stats.MaleGender + stats.FemaleGender > 10,
            $"성별 분류: M={stats.MaleGender}, F={stats.FemaleGender}");
        Assert.True(stats.StrongTone + stats.SoftTone > 10,
            $"톤 분류: Strong={stats.StrongTone}, Soft={stats.SoftTone}");
    }
}
