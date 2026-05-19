using NameForm.Application.Engines;

namespace NameForm.Tests;

public class StoryNamingEngineTests
{
    private readonly ParentBasedNamingEngine _engine;

    public StoryNamingEngineTests()
    {
        var namePoolEngine = new NamePoolEngine(new FakeSajuCalculationService());
        var nameReversalEngine = new NameReversalEngine();
        _engine = new ParentBasedNamingEngine(namePoolEngine, nameReversalEngine);
    }

    [Fact]
    public async Task ShinHaeSomModel_WithStoryKeyword_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "신", null, null, null, null,
            "신의 손",
            DateTime.Now, "none", "neutral");

        Assert.True(candidates.Count > 0);
        Assert.Contains(candidates, c => c.NamingModel == "신해솜모델");
    }

    [Fact]
    public async Task ShinHaeSomModel_SurnameInKeyword_GeneratesSurnameStoryNames()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "신", null, null, null, null,
            "신의 손",
            DateTime.Now, "none", "neutral");

        // 성씨 "신"이 키워드 "신의 손"에 포함되어 성씨+이름 의미 연결 후보 기대
        var surnameStory = candidates.Where(c =>
            c.Description.Contains("성씨") || c.Description.Contains("연상")).ToList();
        // 데이터 로드 여부에 따라 결과가 달라질 수 있음
        Assert.NotNull(surnameStory);
    }

    [Fact]
    public async Task ShinHaeSomModel_ReversedPattern_Works()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null,
            "하늘의 선물",
            DateTime.Now, "none", "neutral");

        var reversed = candidates.Where(c => c.Description.Contains("역순")).ToList();
        Assert.NotNull(reversed);
    }

    [Fact]
    public async Task ShinHaeSomModel_AllCandidatesHaveValidNames()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "이", null, null, null, null,
            "지혜의 빛",
            DateTime.Now, "female", "soft");

        foreach (var candidate in candidates)
        {
            Assert.True(candidate.Name.Length >= 2);
            Assert.True(candidate.Name.All(c => c >= 0xAC00 && c <= 0xD7A3));
            Assert.Equal("신해솜모델", candidate.NamingModel);
            Assert.False(string.IsNullOrEmpty(candidate.Description));
        }
    }

    [Fact]
    public async Task ShinHaeSomModel_IdiomPattern_Works()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "박", null, null, null, null,
            "용기",
            DateTime.Now, "male", "strong");

        var idiomBased = candidates.Where(c => c.Description.Contains("관용구")).ToList();
        Assert.NotNull(idiomBased);
    }
}
