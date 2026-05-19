using NameForm.Application.Engines;

namespace NameForm.Tests;

public class NameReversalEngineTests
{
    private readonly NameReversalEngine _engine = new();

    [Fact]
    public async Task GenerateVariantsAsync_TwoCharName_ReturnsReversed()
    {
        var variants = await _engine.GenerateVariantsAsync("수지");

        Assert.Contains(variants, v => v.Name == "지수" && v.VariationType == "반전");
    }

    [Fact]
    public async Task GenerateVariantsAsync_ThreeCharName_ReturnsMultipleVariants()
    {
        var variants = await _engine.GenerateVariantsAsync("민서준");

        Assert.True(variants.Count > 0);
        Assert.Contains(variants, v => v.VariationType == "반전");
        Assert.Contains(variants, v => v.VariationType == "음절교환");
    }

    [Fact]
    public async Task GenerateVariantsAsync_ExcludesOriginalName()
    {
        var variants = await _engine.GenerateVariantsAsync("민준");

        Assert.DoesNotContain(variants, v => v.Name == "민준");
    }

    [Fact]
    public async Task GenerateVariantsAsync_NullOrShort_ReturnsEmpty()
    {
        var empty1 = await _engine.GenerateVariantsAsync("");
        var empty2 = await _engine.GenerateVariantsAsync("가");

        Assert.Empty(empty1);
        Assert.Empty(empty2);
    }

    [Fact]
    public async Task GenerateVariantsAsync_NoDuplicates()
    {
        var variants = await _engine.GenerateVariantsAsync("서연");

        var names = variants.Select(v => v.Name).ToList();
        Assert.Equal(names.Count, names.Distinct().Count());
    }

    [Theory]
    [InlineData("하윤")]
    [InlineData("서아")]
    [InlineData("민준")]
    public async Task GenerateVariantsAsync_VariousNames_AllValid(string name)
    {
        var variants = await _engine.GenerateVariantsAsync(name);

        foreach (var variant in variants)
        {
            Assert.True(variant.Name.Length >= 2);
            Assert.True(variant.Name.All(c => c >= 0xAC00 && c <= 0xD7A3));
            Assert.False(string.IsNullOrEmpty(variant.VariationType));
            Assert.False(string.IsNullOrEmpty(variant.Description));
        }
    }
}
