using NameForm.Application.Engines.Data;
using Xunit;

namespace NameForm.Tests;

public class CategoryKeywordsLoaderTests
{
    [Fact]
    public void CategoryTree_IsLoaded_ReturnsNonEmptyDictionary()
    {
        // Act
        var categoryTree = CategoryKeywordsLoader.CategoryTree;

        // Assert
        Assert.NotNull(categoryTree);
        Assert.NotEmpty(categoryTree);
    }

    [Fact]
    public void CategoryTree_ContainsExpectedMajors()
    {
        // Act
        var categoryTree = CategoryKeywordsLoader.CategoryTree;

        // Assert
        Assert.Contains("NATURE", categoryTree.Keys);
        Assert.Contains("VIRTUE", categoryTree.Keys);
        Assert.Contains("CONCEPT", categoryTree.Keys);
    }

    [Fact]
    public void CategoryTree_NATURE_ContainsExpectedMinors()
    {
        // Act
        var nature = CategoryKeywordsLoader.CategoryTree["NATURE"];

        // Assert
        Assert.NotNull(nature);
        Assert.Contains("WATER", nature.Keys);
        Assert.Contains("PLANT", nature.Keys);
        Assert.Contains("ANIMAL", nature.Keys);
        Assert.Contains("TERRAIN", nature.Keys);
    }

    [Fact]
    public void RadicalHints_IsLoaded_ReturnsNonEmptyDictionary()
    {
        // Act
        var radicalHints = CategoryKeywordsLoader.RadicalHints;

        // Assert
        Assert.NotNull(radicalHints);
        Assert.NotEmpty(radicalHints);
    }

    [Theory]
    [InlineData("水", "NATURE.WATER")]
    [InlineData("木", "NATURE.PLANT")]
    [InlineData("心", "CONCEPT.MIND")]
    public void RadicalHints_ContainsExpectedMappings(string radical, string expectedCategory)
    {
        // Act
        var radicalHints = CategoryKeywordsLoader.RadicalHints;

        // Assert
        Assert.True(radicalHints.ContainsKey(radical));
        Assert.Equal(expectedCategory, radicalHints[radical]);
    }

    [Fact]
    public void LegacyCategoryKeywords_IsLoaded_ReturnsNonEmptyDictionary()
    {
        // Act
        var legacyKeywords = CategoryKeywordsLoader.LegacyCategoryKeywords;

        // Assert
        Assert.NotNull(legacyKeywords);
        Assert.NotEmpty(legacyKeywords);
    }

    [Fact]
    public void LegacyCategoryKeywords_ContainsExpectedCategories()
    {
        // Act
        var legacyKeywords = CategoryKeywordsLoader.LegacyCategoryKeywords;

        // Assert
        Assert.Contains("자연", legacyKeywords.Keys);
        Assert.Contains("덕목", legacyKeywords.Keys);
        Assert.Contains("개념", legacyKeywords.Keys);
    }
}
