using NameForm.Application.Engines;

namespace NameForm.Tests;

public class RequiredCharEngineTests
{
    private readonly RequiredCharEngine _engine = new(new FakeSajuCalculationService());

    [Fact]
    public async Task GenerateCandidatesAsync_BasicRequest_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "준", "any", DateTime.Now, "none", "neutral");

        Assert.True(candidates.Count > 0);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_PositionFirst_AllCandidatesStartWithRequiredChar()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "이", "서", "first", DateTime.Now, "none", "neutral");

        Assert.All(candidates, c =>
        {
            Assert.Equal("first", c.Position);
            Assert.StartsWith("서", c.Name);
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_PositionLast_AllCandidatesEndWithRequiredChar()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "박", "현", "last", DateTime.Now, "none", "neutral");

        Assert.All(candidates, c =>
        {
            Assert.Equal("last", c.Position);
            Assert.EndsWith("현", c.Name);
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_PositionAny_ReturnsBothPositions()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "영", "any", DateTime.Now, "none", "neutral");

        var positions = candidates.Select(c => c.Position).Distinct().ToList();
        // "any"이면 first와 last 모두 포함해야 함
        Assert.Contains("first", positions);
        Assert.Contains("last", positions);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_RequiredCharFieldSet()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "준", "any", DateTime.Now, "none", "neutral");

        Assert.All(candidates, c =>
        {
            Assert.Equal("준", c.RequiredChar);
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ForbiddenWordsFiltered()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "준", "any", DateTime.Now, "none", "neutral");

        var forbiddenWords = new[] { "바보", "멍청", "못난", "나쁜", "악", "흉", "죽", "병" };
        Assert.All(candidates, c =>
        {
            foreach (var forbidden in forbiddenWords)
            {
                Assert.DoesNotContain(forbidden, "김" + c.Name);
            }
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_EmptyRequiredChar_ReturnsEmpty()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "", "any", DateTime.Now, "none", "neutral");

        Assert.Empty(candidates);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_WhitespaceRequiredChar_ReturnsEmpty()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "  ", "any", DateTime.Now, "none", "neutral");

        Assert.Empty(candidates);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_AllNamesAreValidKorean()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "이", "민", "any", DateTime.Now, "none", "neutral");

        Assert.All(candidates, c =>
        {
            Assert.True(c.Name.Length >= 2, "이름은 2글자 이상이어야 합니다");
            Assert.All(c.Name, ch =>
            {
                Assert.True(ch >= 0xAC00 && ch <= 0xD7A3,
                    $"'{ch}'은 한글 음절이 아닙니다");
            });
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_HasHanjaOptions()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "준", "first", DateTime.Now, "none", "neutral");

        // 한자 옵션이 있는 후보가 있어야 함
        Assert.Contains(candidates, c => c.HanjaOptions.Count > 0);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_InvalidPosition_DefaultsToAny()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "준", "invalid_position", DateTime.Now, "none", "neutral");

        // invalid position은 "any"로 처리되어 양쪽 모두 나와야 함
        var positions = candidates.Select(c => c.Position).Distinct().ToList();
        Assert.Contains("first", positions);
        Assert.Contains("last", positions);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_GenderFilter_Works()
    {
        var maleCandidates = await _engine.GenerateCandidatesAsync(
            "김", "준", "first", DateTime.Now, "male", "neutral");

        var femaleCandidates = await _engine.GenerateCandidatesAsync(
            "김", "준", "first", DateTime.Now, "female", "neutral");

        // 둘 다 결과가 있어야 함
        Assert.True(maleCandidates.Count > 0);
        Assert.True(femaleCandidates.Count > 0);
    }

    // ============================================================
    // 항렬자(RequiredHanja) 한자 지정 모드
    // ============================================================

    /// <summary>
    /// 한자 직접 지정 시 — 발음(requiredChar)이 비어있어도 자동 도출돼야 함.
    /// </summary>
    [Fact]
    public async Task GenerateCandidatesAsync_WithRequiredHanja_AutoDerivesReading()
    {
        // 俊(준)을 항렬자로 지정, requiredChar는 비움
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "", "any", new DateTime(2024, 6, 15), "male", "neutral",
            requiredHanja: "俊");

        Assert.NotEmpty(candidates);
        // 모든 후보가 "준" 발음을 포함해야 함
        Assert.All(candidates, c =>
            Assert.Contains("준", c.Name));
    }

    /// <summary>
    /// 항렬자 지정 시 FixedHanja 필드에 한자가 설정돼야 함.
    /// </summary>
    [Fact]
    public async Task GenerateCandidatesAsync_WithRequiredHanja_SetsFixedHanjaField()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "준", "first", new DateTime(2024, 6, 15), "male", "neutral",
            requiredHanja: "俊");

        Assert.NotEmpty(candidates);
        Assert.All(candidates, c =>
            Assert.Equal("俊", c.FixedHanja));
    }

    /// <summary>
    /// 한자 미지정 시 FixedHanja는 null (기존 동작 보존).
    /// </summary>
    [Fact]
    public async Task GenerateCandidatesAsync_WithoutRequiredHanja_FixedHanjaIsNull()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "준", "any", new DateTime(2024, 6, 15), "male", "neutral");

        Assert.NotEmpty(candidates);
        Assert.All(candidates, c =>
            Assert.Null(c.FixedHanja));
    }

    /// <summary>
    /// 사전에 없는 한자 입력 시 — 폴백: requiredChar가 있으면 일반 모드로 동작.
    /// </summary>
    [Fact]
    public async Task GenerateCandidatesAsync_WithUnknownHanja_FallsBackToRequiredChar()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "준", "any", new DateTime(2024, 6, 15), "male", "neutral",
            requiredHanja: "X"); // 한자가 아닌 문자

        Assert.NotEmpty(candidates);
        // FixedHanja는 null (폴백 모드)
        Assert.All(candidates, c => Assert.Null(c.FixedHanja));
    }

    /// <summary>
    /// 한자와 발음 둘 다 비어있으면 빈 결과.
    /// </summary>
    [Fact]
    public async Task GenerateCandidatesAsync_BothEmpty_ReturnsEmpty()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", "", "any", new DateTime(2024, 6, 15), "male", "neutral",
            requiredHanja: null);

        Assert.Empty(candidates);
    }
}
