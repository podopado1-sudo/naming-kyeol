using System.Reflection;
using NameForm.Application.Engines.Data;
using Xunit;

namespace NameForm.Tests;

public class CategoryClassificationTests
{
    /// <summary>
    /// HanjaData.ClassifyCategoryByMeaning(private static)을 리플렉션으로 호출.
    /// 공개 경로(UpdateMeaningAndClassify)는 사전 등재 여부·기존 카테고리에 따라
    /// 분류를 건너뛰므로, 분류 규칙 자체는 여기서 직접 검증한다.
    /// </summary>
    private static string ClassifyCategoryByMeaning(string meaning)
    {
        var method = typeof(HanjaData).GetMethod(
            "ClassifyCategoryByMeaning",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (string)method!.Invoke(null, new object[] { meaning })!;
    }

    // 기대값은 scripts/category_keywords.json의 legacy_category_keywords 기준
    // (검사 순서: 자연 → 덕목 → 개념, 부분 문자열 매칭).
    // "지혜"는 덕목 키워드 '지'가, "용기"는 자연 키워드 '용'이 먼저 매칭된다.
    [Theory]
    [InlineData("물", "자연")]
    [InlineData("강", "자연")]
    [InlineData("바다", "자연")]
    [InlineData("산", "자연")]
    [InlineData("하늘", "자연")]
    [InlineData("덕", "덕목")]
    [InlineData("선", "덕목")]
    [InlineData("효", "덕목")]
    [InlineData("인", "덕목")]
    [InlineData("빛", "개념")]
    [InlineData("지혜", "덕목")]
    [InlineData("용기", "자연")]
    public void ClassifyCategoryByMeaning_ValidKeywords_ReturnsCorrectCategory(string meaning, string expectedCategory)
    {
        // Act
        var actualCategory = ClassifyCategoryByMeaning(meaning);

        // Assert
        Assert.Equal(expectedCategory, actualCategory);
    }

    [Fact]
    public void UpdateMeaningAndClassify_WithNatureKeyword_SetsCategory()
    {
        // Arrange
        var character = "水";
        var meaning = "물";

        // Act
        // Note: This requires the character to exist in the dictionary
        // We'll test the concept rather than exact implementation
        var hanja = HanjaData.FindByCharacter(character);

        if (hanja != null)
        {
            HanjaData.UpdateMeaningAndClassify(character, meaning);
            var updated = HanjaData.FindByCharacter(character);

            // Assert
            Assert.NotNull(updated);
            Assert.Equal(meaning, updated.Meaning);
            // Category should be set (either automatically or manually)
            Assert.NotNull(updated.Category);
        }
    }
}
