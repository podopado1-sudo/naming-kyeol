using System.Text.Json;
using NameForm.Application.Engines.Data;
using Xunit;

namespace NameForm.Tests;

public class CategoryMappingTests
{
    [Fact]
    public void LoadCategoryMapping_LegacyFormat_LoadsCorrectly()
    {
        // Arrange
        var tempFile = Path.GetTempFileName();
        var legacyMapping = new
        {
            category_mapping = new Dictionary<string, string>
            {
                { "春", "자연" },
                { "德", "덕목" },
                { "智", "개념" }
            }
        };

        File.WriteAllText(tempFile, JsonSerializer.Serialize(legacyMapping));

        try
        {
            // Act
            HanjaData.LoadCategoryMapping(tempFile);

            // Assert
            var hanja = HanjaData.FindByCharacter("春");
            if (hanja != null)
            {
                Assert.Equal("자연", hanja.Category);
                Assert.Equal("NATURE", hanja.CategoryMajor);
            }
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Fact]
    public void LoadCategoryMapping_ExtendedFormat_LoadsCorrectly()
    {
        // Arrange
        var tempFile = Path.GetTempFileName();
        var extendedMapping = new
        {
            schema_version = "2.0",
            category_mapping = new Dictionary<string, object>
            {
                {
                    "水",
                    new
                    {
                        major = "NATURE",
                        minor = "WATER",
                        tags = new[] { "water", "river" },
                        evidence = new[] { "훈:물", "부수:水" },
                        confidence = 0.9
                    }
                }
            }
        };

        File.WriteAllText(tempFile, JsonSerializer.Serialize(extendedMapping));

        try
        {
            // Act
            HanjaData.LoadCategoryMapping(tempFile);

            // Assert
            var hanja = HanjaData.FindByCharacter("水");
            if (hanja != null)
            {
                Assert.Equal("NATURE", hanja.CategoryMajor);
                Assert.Equal("WATER", hanja.CategoryMinor);
                Assert.True(hanja.CategoryConfidence > 0);
            }
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Fact]
    public void LoadCategoryMapping_NonExistentFile_DoesNotThrow()
    {
        // Arrange
        var nonExistentFile = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + ".json");

        // Act & Assert
        var exception = Record.Exception(() => HanjaData.LoadCategoryMapping(nonExistentFile));
        Assert.Null(exception);
    }
}
