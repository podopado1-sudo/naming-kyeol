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
    [InlineData("春", "火", "木")]  // 日(날 일) 부수 → 火. 뜻 기반(하드코딩·core_v1) 木 은 MeaningElement 로 보존
    [InlineData("山", "土", "土")]  // 山 부수 → 土 (획수 3 끝자리면 火 — 획수 대체값은 쓰지 않는다)
    public void FiveElement_HardcodedCharacters_RadicalBased_MeaningPreserved(string character, string expectedElement, string meaningElement)
    {
        // 2026-10-22 S4: FiveElement 는 부수 기준 자원오행(data/hanja_resource_element.json) 하나 — 하드코딩 값은 뜻 기반 보존 칸으로
        var info = HanjaData.FindByCharacter(character);

        Assert.NotNull(info);
        Assert.Equal(expectedElement, info!.FiveElement);
        Assert.Equal(meaningElement, info.MeaningElement);
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
    public void YinYang_IsStrokeParity_OddIsYang_ForEveryHanja()
    {
        // 2026-10-22 S5c-1: 모든 글자의 음양 = StrokeCount 홀짝(홀수 陽·짝수 陰) — /hanja(build_hanja_seo_data.py)와 같은 규칙.
        // 이 테스트는 전에 '짝수 陽·홀수 陰' 일치율 40% 이상을 요구했다 — hanja_unihan.json 이 거꾸로 실은 값을 규칙으로 굳힌 것이었다.
        // Core 2,054자의 강희 원획(KangxiStrokes) 홀짝·하드코딩 35자 수동 값도 이제 쓰지 않는다(원획법은 D10 별도 결정)
        var bad = HanjaData.GetAllHanja()
            .Where(h => h.YinYang != (h.StrokeCount <= 0 ? "" : h.StrokeCount % 2 == 1 ? "陽" : "陰"))
            .Select(h => $"{h.Character}{h.StrokeCount}{h.YinYang}")
            .ToList();

        Assert.True(bad.Count == 0, $"획수 홀짝과 다른 음양 {bad.Count}자: {string.Join(" ", bad.Take(10))}");
    }

    // 획수 출처(S5c-2)·획수 파일 값(S5c-3)이 바뀌어도 획수가 같은 Core 글자만 고른다 — 원획 홀짝과 총획 홀짝이 다른 글자
    [Theory]
    [InlineData("河", 8, 9, "陰")]   // 강희 원획 9(水 4획)면 陽 — S5c-1 전 Core 음양
    [InlineData("浩", 10, 11, "陰")]
    [InlineData("珍", 9, 10, "陽")]   // 원획 10(玉 5획)이면 陰
    [InlineData("洪", 9, 10, "陽")]
    public void YinYang_CoreHanja_UsesTotalStrokesNotKangxi(string character, int strokes, int kangxi, string yinYang)
    {
        var h = HanjaData.FindByCharacter(character);

        Assert.NotNull(h);
        Assert.Equal(strokes, h!.StrokeCount);
        Assert.Equal(kangxi, h.KangxiStrokes); // 원획은 보존(평가·분석 DTO 표시)
        Assert.Equal(yinYang, h.YinYang);
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
