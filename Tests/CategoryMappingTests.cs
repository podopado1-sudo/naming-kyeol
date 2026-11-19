using System.Text.Json;
using NameForm.Application.Engines.Data;
using Xunit;

namespace NameForm.Tests;

[Collection(HanjaDictionaryMutationCollection.Name)]
public class CategoryMappingTests
{
    /// <summary>
    /// 공유 사전 항목의 카테고리 칸을 테스트 뒤에 되돌린다 — LoadCategoryMapping 은 사전의 글자 항목을 그 자리에서 고친다
    /// (되돌리지 않으면 같은 실행의 뒤 테스트가 운영과 다른 카테고리를 본다). 돌려주는 함수를 finally 에서 부른다.
    /// </summary>
    private static Action SnapshotCategories(params string[] characters)
    {
        var saved = characters
            .Select(HanjaData.FindByCharacter)
            .Where(h => h != null)
            .Select(h => (Hanja: h!, h!.Category, h.CategoryMajor, h.CategoryMinor, h.CategoryTags, h.CategoryEvidence, h.CategoryConfidence))
            .ToList();
        return () =>
        {
            foreach (var s in saved)
            {
                s.Hanja.Category = s.Category;
                s.Hanja.CategoryMajor = s.CategoryMajor;
                s.Hanja.CategoryMinor = s.CategoryMinor;
                s.Hanja.CategoryTags = s.CategoryTags;
                s.Hanja.CategoryEvidence = s.CategoryEvidence;
                s.Hanja.CategoryConfidence = s.CategoryConfidence;
            }
        };
    }

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
        var restore = SnapshotCategories("春", "德", "智");

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
            restore();
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
        var restore = SnapshotCategories("水");

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
            restore();
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
