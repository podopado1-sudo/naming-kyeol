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
        // 방식 코드는 중립 값(2026-10-28 — 옛 '신해솜모델'은 사람 이름 꼴)
        Assert.Contains(candidates, c => c.NamingModel is ParentNamingModels.KeywordMeaning or ParentNamingModels.KeywordSound);
    }

    [Fact]
    public async Task ShinHaeSomModel_SurnameInKeyword_GeneratesSurnameStoryNames()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "신", null, null, null, null,
            "신의 손",
            DateTime.Now, "none", "neutral");

        // 2026-10-28: 키워드 안의 성씨를 떼고 남은 음절을 잇던 패턴('의손' 같은 조각)은 지웠다 — 키워드 경로 후보는
        // 모두 그 키워드를 설명에 적고, 성씨 자동(키워드가 있으면 돌지 않는다) 설명은 나오지 않는다
        Assert.NotEmpty(candidates);
        Assert.All(candidates, c => Assert.Contains("신의 손", c.Description));
        Assert.DoesNotContain(candidates, c => c.NamingModel == ParentNamingModels.SurnameMeaning);
    }

    [Fact]
    public async Task ShinHaeSomModel_ReversedPattern_Works()
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null,
            "하늘의 선물",
            DateTime.Now, "none", "neutral");

        // 2026-10-28: 키워드 음절을 거꾸로 잇던 역순 패턴('늘하'·'물선')은 지웠다 — 실명이 아닌 조각만 냈다
        Assert.DoesNotContain(candidates, c => c.Description.Contains("역순"));
        Assert.All(candidates, c => Assert.Equal(2, c.Name.Length));
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
            // 2음절만(옛 단언은 2음절 이상) — 키워드만 준 입력은 키워드 경로만 돈다
            Assert.Equal(2, candidate.Name.Length);
            Assert.True(candidate.Name.All(c => c >= 0xAC00 && c <= 0xD7A3));
            Assert.Contains(candidate.NamingModel, new[] { ParentNamingModels.KeywordMeaning, ParentNamingModels.KeywordSound });
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
