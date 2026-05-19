using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Tests;

/// <summary>
/// GenderToneClassifier 자동 분류 검증 테스트
/// </summary>
public class GenderToneClassifierTests
{
    public GenderToneClassifierTests()
    {
        HanjaData.LoadExternalData();
    }

    // ===== ClassifyGender 단위 테스트 =====

    [Theory]
    [InlineData("꽃 화", HanjaData.GenderPreference.Female)]
    [InlineData("아름다울 미", HanjaData.GenderPreference.Female)]
    [InlineData("예쁠 려", HanjaData.GenderPreference.Female)]
    [InlineData("비단 금", HanjaData.GenderPreference.Female)]
    [InlineData("향기 향", HanjaData.GenderPreference.Female)]
    [InlineData("계집 녀", HanjaData.GenderPreference.Female)]
    [InlineData("옥 옥", HanjaData.GenderPreference.Female)]
    public void ClassifyGender_FemaleKeywords_ReturnsFemale(string meaning, HanjaData.GenderPreference expected)
    {
        var result = GenderToneClassifier.ClassifyGender(meaning);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("용감할 용", HanjaData.GenderPreference.Male)]
    [InlineData("장수 장", HanjaData.GenderPreference.Male)]
    [InlineData("사나이 한", HanjaData.GenderPreference.Male)]
    [InlineData("칼 도", HanjaData.GenderPreference.Male)]
    [InlineData("호걸 호", HanjaData.GenderPreference.Male)]
    public void ClassifyGender_MaleKeywords_ReturnsMale(string meaning, HanjaData.GenderPreference expected)
    {
        var result = GenderToneClassifier.ClassifyGender(meaning);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("물 수", HanjaData.GenderPreference.Neutral)]
    [InlineData("나무 목", HanjaData.GenderPreference.Neutral)]
    [InlineData("일 일", HanjaData.GenderPreference.Neutral)]
    [InlineData("", HanjaData.GenderPreference.Neutral)]
    [InlineData(null, HanjaData.GenderPreference.Neutral)]
    public void ClassifyGender_Ambiguous_ReturnsNeutral(string? meaning, HanjaData.GenderPreference expected)
    {
        var result = GenderToneClassifier.ClassifyGender(meaning);
        Assert.Equal(expected, result);
    }

    // ===== ClassifyTone 단위 테스트 =====

    [Theory]
    [InlineData("부드러울 유", HanjaData.TonePreference.Soft)]
    [InlineData("착할 선", HanjaData.TonePreference.Soft)]
    [InlineData("맑을 청", HanjaData.TonePreference.Soft)]
    [InlineData("고요할 정", HanjaData.TonePreference.Soft)]
    [InlineData("어질 인", HanjaData.TonePreference.Soft)]
    public void ClassifyTone_SoftKeywords_ReturnsSoft(string meaning, HanjaData.TonePreference expected)
    {
        var result = GenderToneClassifier.ClassifyTone(meaning);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("굳셀 강", HanjaData.TonePreference.Strong)]
    [InlineData("클 대", HanjaData.TonePreference.Strong)]
    [InlineData("높을 고", HanjaData.TonePreference.Strong)]
    [InlineData("빛날 휘", HanjaData.TonePreference.Strong)]
    [InlineData("넓을 광", HanjaData.TonePreference.Strong)]
    [InlineData("날랠 민", HanjaData.TonePreference.Strong)]
    public void ClassifyTone_StrongKeywords_ReturnsStrong(string meaning, HanjaData.TonePreference expected)
    {
        var result = GenderToneClassifier.ClassifyTone(meaning);
        Assert.Equal(expected, result);
    }

    // ===== 하드코딩 보호 테스트 =====

    [Theory]
    [InlineData("花", HanjaData.GenderPreference.Female)]   // 하드코딩 Female
    [InlineData("勇", HanjaData.GenderPreference.Male)]     // 하드코딩 Male
    [InlineData("美", HanjaData.GenderPreference.Female)]   // 하드코딩 Female
    [InlineData("雄", HanjaData.GenderPreference.Male)]     // 하드코딩 Male
    public void AutoClassify_HardcodedGender_PreservedAfterLoad(string character, HanjaData.GenderPreference expected)
    {
        var info = HanjaData.FindByCharacter(character);
        Assert.NotNull(info);
        Assert.Equal(expected, info.GenderPref);
    }

    [Theory]
    [InlineData("海", HanjaData.TonePreference.Strong)]  // 하드코딩 Strong
    [InlineData("月", HanjaData.TonePreference.Soft)]    // 하드코딩 Soft
    [InlineData("善", HanjaData.TonePreference.Soft)]    // 하드코딩 Soft
    public void AutoClassify_HardcodedTone_PreservedAfterLoad(string character, HanjaData.TonePreference expected)
    {
        var info = HanjaData.FindByCharacter(character);
        Assert.NotNull(info);
        Assert.Equal(expected, info.TonePref);
    }

    // ===== 전체 통계 =====

    [Fact]
    public void AutoClassify_OverallStats_ImprovedCoverage()
    {
        var allHanja = HanjaData.GetAllHanja();
        var total = allHanja.Count;

        var genderNonNeutral = allHanja.Count(h => h.GenderPref != HanjaData.GenderPreference.Neutral);
        var toneNonNeutral = allHanja.Count(h => h.TonePref != HanjaData.TonePreference.Neutral);

        var male = allHanja.Count(h => h.GenderPref == HanjaData.GenderPreference.Male);
        var female = allHanja.Count(h => h.GenderPref == HanjaData.GenderPreference.Female);
        var strong = allHanja.Count(h => h.TonePref == HanjaData.TonePreference.Strong);
        var soft = allHanja.Count(h => h.TonePref == HanjaData.TonePreference.Soft);

        // 자동 분류 후 최소 기준
        // Gender: 하드코딩(~15) + Unihan(~3163) + 자동분류(~100+) = 최소 100+
        Assert.True(male >= 30, $"Male 분류: {male}개 (최소 30개 기대)");
        Assert.True(female >= 50, $"Female 분류: {female}개 (최소 50개 기대)");

        // Tone: 자동 분류로 추가 확보
        Assert.True(strong >= 50, $"Strong 분류: {strong}개 (최소 50개 기대)");
        Assert.True(soft >= 50, $"Soft 분류: {soft}개 (최소 50개 기대)");

        // 전체 non-Neutral 비율이 이전(45자)보다 훨씬 높아야 함
        Assert.True(genderNonNeutral > 100,
            $"Gender non-Neutral: {genderNonNeutral}/{total}");
        Assert.True(toneNonNeutral > 100,
            $"Tone non-Neutral: {toneNonNeutral}/{total}");
    }

    // ===== 쉼표 구분 의미 처리 =====

    [Fact]
    public void ClassifyGender_CommaSeparatedMeaning_HandlesCorrectly()
    {
        // "기댈 은, 아름다울 온" → 아름다울 키워드 매칭 → Female
        var result = GenderToneClassifier.ClassifyGender("기댈 은, 아름다울 온");
        Assert.Equal(HanjaData.GenderPreference.Female, result);
    }

    [Fact]
    public void ClassifyTone_CommaSeparatedMeaning_HandlesCorrectly()
    {
        // "맑을 청, 푸를 청" → 맑을 키워드 → Soft
        var result = GenderToneClassifier.ClassifyTone("맑을 청, 푸를 청");
        Assert.Equal(HanjaData.TonePreference.Soft, result);
    }

    // ===== CategoryMinor 힌트 =====

    [Fact]
    public void ClassifyGender_CategoryHint_FallbackWorks()
    {
        // 의미 없이 카테고리만 있을 때
        var result = GenderToneClassifier.ClassifyGender("", null, "FLOWER");
        Assert.Equal(HanjaData.GenderPreference.Female, result);
    }

    [Fact]
    public void ClassifyTone_CategoryHint_FallbackWorks()
    {
        var result = GenderToneClassifier.ClassifyTone("", null, "WARRIOR");
        Assert.Equal(HanjaData.TonePreference.Strong, result);
    }
}
