using NameForm.Application.Engines;

namespace NameForm.Tests;

public class RareSurnameEngineTests
{
    private readonly RareSurnameEngine _engine = new();

    [Theory]
    [InlineData("김")]
    [InlineData("이")]
    [InlineData("박")]
    [InlineData("최")]
    [InlineData("정")]
    public async Task AnalyzeAndRecommend_CommonSurname_IsNotRare(string surname)
    {
        var result = await _engine.AnalyzeAndRecommendAsync(surname, DateTime.Now, "none", "neutral", 5);

        Assert.False(result.IsRareSurname);
        Assert.Equal(1, result.RarityLevel);
    }

    [Theory]
    [InlineData("봉")]
    [InlineData("빈")]
    [InlineData("탁")]
    public async Task AnalyzeAndRecommend_RareSurname_IsRare(string surname)
    {
        var result = await _engine.AnalyzeAndRecommendAsync(surname, DateTime.Now, "none", "neutral", 5);

        Assert.True(result.IsRareSurname);
        Assert.True(result.RarityLevel >= 3);
    }

    [Fact]
    public void DetermineRarityLevel_CommonSurname_ReturnsLevel1()
    {
        Assert.Equal(1, _engine.DetermineRarityLevel("김"));
        Assert.Equal(1, _engine.DetermineRarityLevel("이"));
        Assert.Equal(1, _engine.DetermineRarityLevel("박"));
    }

    [Fact]
    public void DetermineRarityLevel_ModerateSurname_ReturnsLevel2()
    {
        Assert.Equal(2, _engine.DetermineRarityLevel("심"));
        Assert.Equal(2, _engine.DetermineRarityLevel("곽"));
        Assert.Equal(2, _engine.DetermineRarityLevel("구"));
    }

    [Fact]
    public void DetermineRarityLevel_VeryRareSurname_ReturnsLevel4()
    {
        Assert.Equal(4, _engine.DetermineRarityLevel("봉"));
        Assert.Equal(4, _engine.DetermineRarityLevel("빈"));
        Assert.Equal(4, _engine.DetermineRarityLevel("탁"));
    }

    [Fact]
    public void DetermineRarityLevel_TwoCharSurname_ReturnsLevel3()
    {
        Assert.Equal(3, _engine.DetermineRarityLevel("남궁"));
        Assert.Equal(3, _engine.DetermineRarityLevel("독고"));
    }

    [Fact]
    public async Task AnalyzeAndRecommend_GeneratesCandidates()
    {
        var result = await _engine.AnalyzeAndRecommendAsync("봉", DateTime.Now, "none", "neutral", 10);

        Assert.NotNull(result.Candidates);
        Assert.True(result.Candidates.Count > 0);
        Assert.True(result.Candidates.Count <= 10);
    }

    [Fact]
    public async Task AnalyzeAndRecommend_CandidatesHaveHarmonyScores()
    {
        var result = await _engine.AnalyzeAndRecommendAsync("빈", DateTime.Now, "none", "neutral", 5);

        foreach (var candidate in result.Candidates)
        {
            Assert.InRange(candidate.HarmonyScore, 0, 100);
            Assert.False(string.IsNullOrEmpty(candidate.HarmonyReason));
            Assert.False(string.IsNullOrEmpty(candidate.Name));
        }
    }

    [Fact]
    public async Task AnalyzeAndRecommend_CandidatesAreSortedByHarmonyScore()
    {
        var result = await _engine.AnalyzeAndRecommendAsync("탁", DateTime.Now, "none", "neutral", 20);

        for (int i = 1; i < result.Candidates.Count; i++)
        {
            Assert.True(result.Candidates[i - 1].HarmonyScore >= result.Candidates[i].HarmonyScore,
                "후보들이 조화 점수 내림차순으로 정렬되어야 합니다.");
        }
    }

    [Fact]
    public void AnalyzePhonetics_SurnameWithFinalConsonant_MentionsFinal()
    {
        // "봉"에는 받침 ㅇ이 있음
        var analysis = _engine.AnalyzePhonetics("봉");

        Assert.Contains("받침", analysis);
        Assert.Contains("봉", analysis);
    }

    [Fact]
    public void AnalyzePhonetics_SurnameWithoutFinalConsonant_MentionsNoFinal()
    {
        // "하"에는 받침이 없음
        var analysis = _engine.AnalyzePhonetics("하");

        Assert.Contains("받침 없음", analysis);
    }

    [Fact]
    public async Task AnalyzeAndRecommend_HasPhoneticAnalysis()
    {
        var result = await _engine.AnalyzeAndRecommendAsync("봉", DateTime.Now, "none", "neutral", 5);

        Assert.False(string.IsNullOrEmpty(result.PhoneticAnalysis));
        Assert.Contains("봉", result.PhoneticAnalysis);
    }

    [Fact]
    public async Task AnalyzeAndRecommend_EmptyLastName_ThrowsArgumentException()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _engine.AnalyzeAndRecommendAsync("", DateTime.Now, "none", "neutral", 5));
    }

    [Fact]
    public async Task AnalyzeAndRecommend_WhitespaceLastName_ThrowsArgumentException()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _engine.AnalyzeAndRecommendAsync("   ", DateTime.Now, "none", "neutral", 5));
    }

    [Fact]
    public async Task AnalyzeAndRecommend_CountExceedsMax_CapsAt50()
    {
        var result = await _engine.AnalyzeAndRecommendAsync("봉", DateTime.Now, "none", "neutral", 100);

        Assert.True(result.Candidates.Count <= 50);
    }

    [Fact]
    public void ScoreCandidate_SurnameWithFinal_SoftInitialGetsHigherScore()
    {
        // "봉" (받침 ㅇ) + "아름" (ㅇ 시작 = 부드러운 초성)
        var softResult = _engine.ScoreCandidate("봉", "아름");

        // "봉" + "강민" (ㄱ 시작 = 강한 파열음)
        var hardResult = _engine.ScoreCandidate("봉", "강민");

        Assert.True(softResult.HarmonyScore > hardResult.HarmonyScore,
            "받침 있는 성씨 뒤에 부드러운 초성이 더 높은 점수를 받아야 합니다.");
    }

    [Fact]
    public void ScoreCandidate_SurnameWithoutFinal_VowelStartGetsHigherScore()
    {
        // 보편 작명 원리(NamingPrinciples) 전환(2026-05-15) 후:
        // 받침 없는 성씨 + 모음(ㅇ) 시작 = 가장 부드러운 흐름. 예: "하은서"
        // 받침 없는 성씨 + 평음(ㅈ) 시작 = 보통. 예: "하준서"
        var vowelResult = _engine.ScoreCandidate("하", "은서");
        var consonantResult = _engine.ScoreCandidate("하", "준서");

        Assert.True(vowelResult.HarmonyScore >= consonantResult.HarmonyScore,
            "받침 없는 성씨 뒤에 모음 시작(연음)이 더 자연스러움.");
    }
}
