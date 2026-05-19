using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;
using NameForm.Infrastructure.Repositories;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 추천 품질 회귀 방지 테스트.
///
/// 채점 정확도 회귀(ScoringServiceTests)는 별도로 있고, 이 파일은 다음을 보장한다:
/// - 골든 케이스: 잘 알려진 입력에 대해 합리적 점수의 후보가 반환된다
/// - 다양성: 첫 글자 도배, 유행 이름, 외래어, 부정 발음 등 회귀
/// - 카테고리 정상 동작: 한자/순우리말/3음절 카테고리가 비어있지 않음
/// </summary>
public class RecommendationQualityTests
{
    private readonly SmartRecommendationService _service;

    public RecommendationQualityTests()
    {
        HanjaData.LoadExternalData();

        var fakeSaju = new FakeSajuCalculationService();
        var namePoolEngine = new NamePoolEngine(fakeSaju);
        var nameReversalEngine = new NameReversalEngine();
        var parentBasedEngine = new ParentBasedNamingEngine(namePoolEngine, nameReversalEngine);
        var aestheticEngine = new AestheticEngine();
        var harmonyEngine = new HarmonyEngine(fakeSaju);
        var scoringService = new ScoringService(aestheticEngine, harmonyEngine, new RarityScoringEngine());

        var recommendationService = new RecommendationService(
            new InMemoryRecommendationRepository(),
            namePoolEngine,
            scoringService,
            new RankerEngine(),
            new ExplanationEngine(),
            new NicknameEngine(),
            parentBasedEngine,
            new DualNameEngine(),
            NullLogger<RecommendationService>.Instance);

        var twinNameService = new TwinNameService(
            new TwinNameEngine(fakeSaju),
            scoringService,
            new ExplanationEngine(),
            NullLogger<TwinNameService>.Instance);

        _service = new SmartRecommendationService(
            recommendationService,
            new PureKoreanNameEngine(),
            new CreativeNamingEngine(),
            new ThreeSyllableEngine(),
            new RareSurnameEngine(),
            parentBasedEngine,
            twinNameService,
            new RequiredCharEngine(fakeSaju),
            new DualNameEngine());
    }

    // ============================================================
    // 골든 케이스 — 잘 알려진 입력에 대한 안정성
    // ============================================================

    /// <summary>
    /// 골든 케이스: "김+1985-06-05+female+soft" → TopPick 점수 75+ 보장.
    /// 점수 분포가 정상 운영되고 있는지 회귀 방지.
    /// </summary>
    [Theory]
    [InlineData("김", "1985-06-05", "female", "soft", 75)]
    [InlineData("이", "1990-03-21", "male", "neutral", 75)]
    [InlineData("박", "2024-01-15", "female", "neutral", 75)]
    [InlineData("최", "2020-08-20", "male", "strong", 75)]
    [InlineData("정", "2023-11-30", "none", "neutral", 75)]
    public async Task GoldenCase_TopPick_ScoreAboveThreshold(
        string lastName, string birthDate, string gender, string tone, int minScore)
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = lastName,
            BirthDate = birthDate,
            Gender = gender,
            Tone = tone,
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.NotNull(result.TopPick);
        Assert.True(result.TopPick!.Candidate.Score >= minScore,
            $"'{lastName}' 골든 케이스 TopPick 점수 {result.TopPick.Candidate.Score} < {minScore}");
    }

    // ============================================================
    // 다양성 — 첫 글자 도배 회귀
    // ============================================================

    /// <summary>
    /// 첫 글자(이름) 도배 방지: 한 카테고리 안에서 동일 첫 글자가 4개 이상 나오면 안 된다.
    /// NamePoolEngine의 다양성 캡(GroupBy.Take(3))이 작동하는지 보장.
    /// </summary>
    [Theory]
    [InlineData("김", "2024-06-15", "female", "soft")]
    [InlineData("이", "2020-01-01", "male", "strong")]
    [InlineData("박", "2023-08-20", "none", "neutral")]
    public async Task Diversity_FirstCharacterCap_AtMostThreePerCategory(
        string lastName, string birthDate, string gender, string tone)
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = lastName,
            BirthDate = birthDate,
            Gender = gender,
            Tone = tone,
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        var standardCategory = result.Categories.FirstOrDefault(c => c.Type == "standard");
        Assert.NotNull(standardCategory);

        var firstCharCounts = standardCategory!.Names
            .GroupBy(n => n.Name[0])
            .Select(g => new { Char = g.Key, Count = g.Count() })
            .ToList();

        foreach (var group in firstCharCounts)
        {
            Assert.True(group.Count <= 3,
                $"'{lastName}' 카테고리에 동일 첫 글자 '{group.Char}'가 {group.Count}개 — 다양성 캡(3) 위반");
        }
    }

    // ============================================================
    // 유행 이름 회피 (NamingPrinciples.TrendyNames)
    // ============================================================

    /// <summary>
    /// 표준 카테고리의 추천 후보 중 유행 이름(NamingPrinciples.TrendyNames에 등록된)이 없어야 한다.
    /// </summary>
    [Fact]
    public async Task Quality_StandardCategory_NoTrendyNames()
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = "김",
            BirthDate = "2024-06-15",
            Gender = "female",
            Tone = "soft",
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        var standardCategory = result.Categories.FirstOrDefault(c => c.Type == "standard");
        Assert.NotNull(standardCategory);

        foreach (var candidate in standardCategory!.Names)
        {
            Assert.False(NamingPrinciples.IsTrendyName(candidate.Name),
                $"유행 이름 '{candidate.Name}'이 표준 추천에 포함됨");
        }
    }

    // ============================================================
    // 외래어 발음 회피 (NamingPrinciples.EvalForeignPhonotactics)
    // ============================================================

    /// <summary>
    /// 명백한 외래어 발음("조지", "줄리" 등)은 표준 추천에 거의 나오지 않아야 한다.
    /// EvalForeignPhonotactics 가산이 잘 적용되는지 검증.
    /// </summary>
    [Fact]
    public async Task Quality_StandardCategory_FewForeignSoundingNames()
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = "김",
            BirthDate = "2024-06-15",
            Gender = "female",
            Tone = "soft",
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        var standardCategory = result.Categories.FirstOrDefault(c => c.Type == "standard");
        Assert.NotNull(standardCategory);

        var foreignSounding = standardCategory!.Names
            .Where(n => NamingPrinciples.EvalForeignPhonotactics(n.Name) < 0.5)
            .ToList();

        // 외래어 발음 점수 < 0.5인 이름이 전체의 5% 미만이어야 함
        var ratio = (double)foreignSounding.Count / standardCategory.Names.Count;
        Assert.True(ratio < 0.05,
            $"외래어 발음 후보 {foreignSounding.Count}/{standardCategory.Names.Count} ({ratio:P0}) — 5% 초과");
    }

    // ============================================================
    // 카테고리 활성화 — 기본 옵션에서 비어있지 않음
    // ============================================================

    /// <summary>
    /// 기본 옵션(IncludePureKorean, IncludeCreative, IncludeThreeSyllable 모두 true)일 때
    /// 각 카테고리가 비어있지 않아야 한다.
    /// </summary>
    [Fact]
    public async Task Quality_DefaultCategories_AllPopulated()
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = "김",
            BirthDate = "2024-06-15",
            Gender = "none",
            Tone = "neutral",
            IncludePureKorean = true,
            IncludeCreative = true,
            IncludeThreeSyllable = true,
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.All(result.Categories, category =>
            Assert.True(category.Names.Count > 0,
                $"카테고리 '{category.Type}'가 비어있음"));

        // standard / pure-korean / creative 최소 3개는 존재
        var types = result.Categories.Select(c => c.Type).ToHashSet();
        Assert.Contains("standard", types);
        Assert.Contains("pure-korean", types);
        Assert.Contains("creative", types);
    }

    // ============================================================
    // 점수 일관성 — 같은 카테고리 내 score가 단조 감소
    // ============================================================

    /// <summary>
    /// 표준 카테고리의 Names는 score 내림차순으로 정렬돼야 한다.
    /// </summary>
    [Fact]
    public async Task Quality_StandardCategory_ScoresDescending()
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = "김",
            BirthDate = "2024-06-15",
            Gender = "female",
            Tone = "soft",
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);
        var standardCategory = result.Categories.FirstOrDefault(c => c.Type == "standard");
        Assert.NotNull(standardCategory);

        var scores = standardCategory!.Names
            .Where(n => n.Score.HasValue)
            .Select(n => n.Score!.Value)
            .ToList();

        for (int i = 1; i < scores.Count; i++)
        {
            Assert.True(scores[i] <= scores[i - 1],
                $"점수 정렬 오류: [{i - 1}]={scores[i - 1]} > [{i}]={scores[i]}");
        }
    }

    // ============================================================
    // 입력 영향 회귀 — 의미 키워드가 결과를 바꾸는지
    // ============================================================

    // ============================================================
    // 깊은 다양성 — 둘째 글자, 카테고리 전체 분포
    // ============================================================

    /// <summary>
    /// 둘째 글자(이름의 끝 글자)도 다양해야 한다. 한 카테고리 내 동일 둘째 글자 ≤ 3.
    /// </summary>
    [Theory]
    [InlineData("김")]
    [InlineData("이")]
    [InlineData("박")]
    public async Task Diversity_SecondCharacterCap_AtMostThreePerCategory(string lastName)
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = lastName,
            BirthDate = "2024-06-15",
            Gender = "female",
            Tone = "soft",
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);
        var standard = result.Categories.FirstOrDefault(c => c.Type == "standard");
        Assert.NotNull(standard);

        var secondCharCounts = standard!.Names
            .Where(n => n.Name.Length >= 2)
            .GroupBy(n => n.Name[1])
            .Select(g => new { Char = g.Key, Count = g.Count() })
            .ToList();

        foreach (var group in secondCharCounts)
        {
            Assert.True(group.Count <= 3,
                $"'{lastName}' 카테고리에 동일 둘째 글자 '{group.Char}'가 {group.Count}개 — 다양성 캡(3) 위반");
        }
    }

    /// <summary>
    /// 표준 카테고리에서 첫 글자가 최소 5종류 이상 나와야 한다 (단조 회피).
    /// </summary>
    [Fact]
    public async Task Diversity_StandardCategory_FirstCharVarietyAtLeastFive()
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = "김",
            BirthDate = "2024-06-15",
            Gender = "female",
            Tone = "soft",
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);
        var standard = result.Categories.FirstOrDefault(c => c.Type == "standard");
        Assert.NotNull(standard);

        var distinctFirstChars = standard!.Names.Select(n => n.Name[0]).Distinct().Count();
        Assert.True(distinctFirstChars >= 5,
            $"표준 카테고리 첫 글자 종류 {distinctFirstChars}개 — 5종 미만 (단조)");
    }

    /// <summary>
    /// 동일 한자 의미를 가진 후보들이 과도하게 몰리지 않아야 한다.
    /// 같은 발음(reading) 중복 회피 — 첫 글자 + 둘째 글자 조합(name)이 모두 distinct.
    /// </summary>
    [Theory]
    [InlineData("김")]
    [InlineData("이")]
    [InlineData("최")]
    public async Task Diversity_NoDuplicateNames(string lastName)
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = lastName,
            BirthDate = "2024-06-15",
            Gender = "none",
            Tone = "neutral",
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        foreach (var category in result.Categories)
        {
            var names = category.Names.Select(n => n.Name).ToList();
            Assert.Equal(names.Count, names.Distinct().Count());
        }
    }

    /// <summary>
    /// 음운 회귀: 표준 카테고리 점수 분포의 상위 10개 평균이 70 이상.
    /// </summary>
    [Fact]
    public async Task Diversity_TopTenAverageScore_AtLeast70()
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = "김",
            BirthDate = "1985-06-05",
            Gender = "female",
            Tone = "soft",
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);
        var standard = result.Categories.FirstOrDefault(c => c.Type == "standard");
        Assert.NotNull(standard);

        var top10Avg = standard!.Names
            .Where(n => n.Score.HasValue)
            .Take(10)
            .Average(n => n.Score!.Value);

        Assert.True(top10Avg >= 70,
            $"표준 카테고리 상위 10개 평균 {top10Avg:F1}점 — 70점 미만");
    }

    // ============================================================
    // 입력 영향 회귀 — 의미 키워드가 결과를 바꾸는지
    // ============================================================

    /// <summary>
    /// PreferredMeanings 입력 시 결과가 미입력과 달라야 한다 (NamePoolEngine 매칭 가산 검증).
    /// </summary>
    [Fact]
    public async Task Quality_PreferredMeanings_ChangesResults()
    {
        var baseRequest = new SmartRecommendationRequestDto
        {
            LastName = "김",
            BirthDate = "2024-06-15",
            Gender = "female",
            Tone = "soft",
        };
        var withMeaningsRequest = new SmartRecommendationRequestDto
        {
            LastName = "김",
            BirthDate = "2024-06-15",
            Gender = "female",
            Tone = "soft",
            PreferredMeanings = new List<string> { "지혜", "맑음", "빛" },
        };

        var baseResult = await _service.GenerateSmartRecommendationsAsync(baseRequest);
        var withMeanings = await _service.GenerateSmartRecommendationsAsync(withMeaningsRequest);

        var baseNames = baseResult.Categories
            .First(c => c.Type == "standard").Names.Select(n => n.Name).ToList();
        var withMeaningsNames = withMeanings.Categories
            .First(c => c.Type == "standard").Names.Select(n => n.Name).ToList();

        // 두 결과가 완전히 같으면 의미 키워드 입력이 무시되고 있는 것 → 회귀
        Assert.NotEqual(baseNames, withMeaningsNames);
    }
}
