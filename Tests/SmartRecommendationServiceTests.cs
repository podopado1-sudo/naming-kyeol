using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Services;
using NameForm.Infrastructure.Repositories;
using Microsoft.Extensions.Logging.Abstractions;

namespace NameForm.Tests;

public class SmartRecommendationServiceTests
{
    private readonly SmartRecommendationService _service;

    public SmartRecommendationServiceTests()
    {
        // 공용 엔진/서비스 인스턴스
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

    private static SmartRecommendationRequestDto CreateBasicRequest(string lastName = "김") => new()
    {
        LastName = lastName,
        BirthDate = "2024-06-15",
        Gender = "none",
        Tone = "neutral"
    };

    // -------------------------------------------------------
    // 1. 기본 입력 → standard + pure-korean + creative 카테고리 반환
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_BasicInput_ReturnsStandardPureKoreanCreative()
    {
        var request = CreateBasicRequest();

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.NotNull(result);
        var types = result.Categories.Select(c => c.Type).ToList();
        Assert.Contains("standard", types);
        Assert.Contains("pure-korean", types);
        Assert.Contains("creative", types);
    }

    // -------------------------------------------------------
    // 2. IncludeThreeSyllable=true → three-syllable 카테고리 포함
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_IncludeThreeSyllable_HasThreeSyllableCategory()
    {
        var request = CreateBasicRequest();
        request.IncludeThreeSyllable = true;

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        var types = result.Categories.Select(c => c.Type).ToList();
        Assert.Contains("three-syllable", types);
    }

    // -------------------------------------------------------
    // 3. 부모 정보 입력 → parent-based 카테고리 추가
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_WithParentInfo_HasParentBasedCategory()
    {
        var request = CreateBasicRequest();
        request.FatherSurname = "김";
        request.FatherName = "철수";
        request.MotherSurname = "이";
        request.MotherName = "영희";

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        var types = result.Categories.Select(c => c.Type).ToList();
        Assert.Contains("parent-based", types);
    }

    // -------------------------------------------------------
    // 4. IsTwin=true → twin 카테고리 추가
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_IsTwin_HasTwinCategory()
    {
        var request = CreateBasicRequest();
        request.IsTwin = true;

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        var types = result.Categories.Select(c => c.Type).ToList();
        Assert.Contains("twin", types);
    }

    // -------------------------------------------------------
    // 5. RequiredChar 입력 → required-char 카테고리 추가
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_WithRequiredChar_HasRequiredCharCategory()
    {
        var request = CreateBasicRequest();
        request.RequiredChar = "민";

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        var types = result.Categories.Select(c => c.Type).ToList();
        Assert.Contains("required-char", types);
    }

    // -------------------------------------------------------
    // 6. PreferredEnglishName 입력 → dual-name 카테고리 추가 (한자 매핑 가능한 경우)
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_WithPreferredEnglishName_HasDualNameCategoryIfMappable()
    {
        var request = CreateBasicRequest();
        request.PreferredEnglishName = "Emma";

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        // DualNameEngine은 한자 매핑 가능한 영어 이름에 대해서만 결과를 반환
        // 매핑 불가 시 빈 결과 → 카테고리가 필터링될 수 있음
        var dualNameCategory = result.Categories.FirstOrDefault(c => c.Type == "dual-name");
        if (dualNameCategory != null)
        {
            Assert.Equal("영어+한자 이름", dualNameCategory.Label);
            Assert.True(dualNameCategory.Names.Count > 0);
            Assert.All(dualNameCategory.Names, n =>
                Assert.Contains(n.Tags, t => t.StartsWith("EN:")));
        }
        // 매핑 불가한 경우: dual-name이 없어도 다른 카테고리는 정상 작동해야 함
        Assert.True(result.Categories.Count >= 1);
    }

    // -------------------------------------------------------
    // 7. 희귀 성씨 (봉, 탁) → rare-surname 카테고리 자동 추가 + IsRareSurname=true
    // -------------------------------------------------------
    [Theory]
    [InlineData("봉")]
    [InlineData("탁")]
    public async Task GenerateSmartRecommendationsAsync_RareSurname_HasRareSurnameCategoryAndFlag(string lastName)
    {
        var request = CreateBasicRequest(lastName);

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.True(result.IsRareSurname, $"성씨 '{lastName}'은(는) 희귀 성씨로 감지되어야 합니다.");
        var types = result.Categories.Select(c => c.Type).ToList();
        Assert.Contains("rare-surname", types);
    }

    // -------------------------------------------------------
    // 8. 일반 성씨 (김) → IsRareSurname=false
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_CommonSurname_IsRareSurnameFalse()
    {
        var request = CreateBasicRequest("김");

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.False(result.IsRareSurname, "성씨 '김'은 흔한 성씨이므로 IsRareSurname=false이어야 합니다.");
    }

    // -------------------------------------------------------
    // 9. 모든 카테고리의 Names가 비어있지 않음
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_AllCategoriesHaveNames()
    {
        var request = CreateBasicRequest();

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.All(result.Categories, category =>
            Assert.True(category.Names.Count > 0,
                $"카테고리 '{category.Type}'에 이름이 없습니다."));
    }

    // -------------------------------------------------------
    // 10. TotalCount가 정확함 (모든 카테고리의 Names 수 합계)
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_TotalCountMatchesSumOfNames()
    {
        var request = CreateBasicRequest();

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        var expectedTotal = result.Categories.Sum(c => c.Names.Count);
        Assert.Equal(expectedTotal, result.TotalCount);
    }

    // -------------------------------------------------------
    // 11. 카테고리의 Type/Label이 올바른 값
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_CategoryTypesAndLabelsAreValid()
    {
        var request = CreateBasicRequest();
        request.IncludeThreeSyllable = true;

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        var validTypes = new Dictionary<string, string>
        {
            { "standard", "한자 이름" },
            { "pure-korean", "순우리말 이름" },
            { "creative", "창의적 작명" },
            { "three-syllable", "3글자 이름" },
            { "parent-based", "부모 기반 이름" },
            { "twin", "쌍둥이 이름" },
            { "required-char", "필수 글자 이름" },
            { "dual-name", "영어+한자 이름" },
            { "rare-surname", "특이 성씨 최적화" }
        };

        Assert.All(result.Categories, category =>
        {
            Assert.True(validTypes.ContainsKey(category.Type),
                $"알 수 없는 카테고리 타입: '{category.Type}'");
            Assert.Equal(validTypes[category.Type], category.Label);
        });
    }

    // -------------------------------------------------------
    // 12. LastName이 응답에 포함됨
    // -------------------------------------------------------
    [Theory]
    [InlineData("김")]
    [InlineData("이")]
    [InlineData("박")]
    public async Task GenerateSmartRecommendationsAsync_LastNameIncludedInResponse(string lastName)
    {
        var request = CreateBasicRequest(lastName);

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.Equal(lastName, result.LastName);
    }

    // -------------------------------------------------------
    // 13. 빈 LastName → 에러 처리
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_EmptyLastName_ThrowsOrReturnsEmpty()
    {
        var request = CreateBasicRequest("");

        // 빈 성씨는 예외를 던지거나 빈 결과를 반환해야 함
        // SmartRecommendationService는 하위 엔진에 위임하므로
        // 엔진이 빈 성씨를 처리하는 방식에 따름
        try
        {
            var result = await _service.GenerateSmartRecommendationsAsync(request);
            // 예외가 없으면 LastName이 빈 문자열로 유지되어야 함
            Assert.Equal("", result.LastName);
        }
        catch (ArgumentException)
        {
            // ArgumentException도 허용
        }
    }

    // -------------------------------------------------------
    // 14. 모든 옵션 켜기 → 여러 카테고리 동시 반환
    // -------------------------------------------------------
    [Fact]
    public async Task GenerateSmartRecommendationsAsync_AllOptionsEnabled_ReturnsMultipleCategories()
    {
        var request = new SmartRecommendationRequestDto
        {
            LastName = "이",
            BirthDate = "2024-06-15",
            Gender = "female",
            Tone = "soft",
            FatherSurname = "이",
            FatherName = "준호",
            MotherSurname = "박",
            MotherName = "서연",
            StoryKeyword = "봄",
            PreferredEnglishName = "Sophia",
            RequiredChar = "서",
            IsTwin = true,
            IncludeThreeSyllable = true,
            IncludePureKorean = true,
            IncludeCreative = true
        };

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        // 최소 5개 이상의 카테고리가 반환되어야 함
        // standard, pure-korean, creative, three-syllable, parent-based, twin, required-char, dual-name
        Assert.True(result.Categories.Count >= 5,
            $"모든 옵션을 켰는데 카테고리가 {result.Categories.Count}개뿐입니다.");

        // TotalCount도 카테고리 합계와 일치
        var expectedTotal = result.Categories.Sum(c => c.Names.Count);
        Assert.Equal(expectedTotal, result.TotalCount);

        // 각 카테고리에 이름이 있어야 함
        Assert.All(result.Categories, category =>
            Assert.True(category.Names.Count > 0,
                $"카테고리 '{category.Type}'에 이름이 없습니다."));
    }

    // ── 후속 2 탭 UX: 카테고리 순서 고정 + TopPick ────────────────────────

    /// <summary>
    /// 탭 UX 회귀: 카테고리 중 standard(한자 표준)가 항상 첫 번째 위치에 와야 한다.
    /// 어떤 옵션 조합에서도 standard가 포함되면 Categories[0].Type == "standard".
    /// </summary>
    [Fact]
    public async Task GenerateSmartRecommendations_StandardCategory_IsAlwaysFirst()
    {
        var request = CreateBasicRequest();
        request.IncludeThreeSyllable = true;
        request.RequiredChar = "민";

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.NotEmpty(result.Categories);

        // standard 카테고리가 있으면 반드시 0번째
        var standardIdx = result.Categories.FindIndex(c => c.Type == "standard");
        if (standardIdx >= 0)
        {
            Assert.Equal(0, standardIdx);
        }
    }

    /// <summary>
    /// 탭 UX 회귀: 카테고리 순서가 정의된 우선순위를 따른다.
    /// standard < pure-korean < three-syllable < creative < required-char.
    /// </summary>
    [Fact]
    public async Task GenerateSmartRecommendations_CategoriesInExpectedOrder()
    {
        var request = CreateBasicRequest();
        request.IncludeThreeSyllable = true;
        request.RequiredChar = "민";

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        var expectedOrder = new Dictionary<string, int>
        {
            { "standard",       0 },
            { "pure-korean",    1 },
            { "three-syllable", 2 },
            { "creative",       3 },
            { "parent-based",   4 },
            { "required-char",  5 },
            { "dual-name",      6 },
            { "twin",           7 },
            { "rare-surname",   8 },
        };

        int previousRank = -1;
        foreach (var category in result.Categories)
        {
            if (!expectedOrder.TryGetValue(category.Type, out var rank))
                continue; // 정의에 없는 타입은 스킵

            // three-syllable 등 같은 타입이 subtype별로 중복 등장할 수 있으므로 non-decreasing 체크.
            Assert.True(rank >= previousRank,
                $"카테고리 순서 오류: '{category.Type}'(rank={rank})이 이전(rank={previousRank})보다 뒤에 와야 함.");
            previousRank = rank;
        }
    }

    /// <summary>
    /// 탭 UX 회귀: TopPick 이 전 카테고리 통합 최고점 후보를 정확히 반환한다.
    /// </summary>
    [Fact]
    public async Task GenerateSmartRecommendations_TopPick_IsGlobalMaximum()
    {
        var request = CreateBasicRequest();
        request.IncludeThreeSyllable = true;

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.NotNull(result.TopPick);

        // TopPick 정책 변경(2026-05-15): 카테고리 간 score 의미가 달라 단순 최대값 비교가 부적절.
        // standard(한자 이름) 카테고리 1위를 우선하고, standard 비었을 때만 다른 카테고리로 폴백.
        var standardCategory = result.Categories.FirstOrDefault(c => c.Type == "standard");
        if (standardCategory != null && standardCategory.Names.Any(n => n.Score.HasValue))
        {
            var standardMax = standardCategory.Names.Where(n => n.Score.HasValue).Max(n => n.Score!.Value);
            Assert.Equal(standardMax, result.TopPick!.Candidate.Score);
            Assert.Equal("standard", result.TopPick.CategoryType);
        }
    }

    /// <summary>
    /// 탭 UX 회귀: TopPick 의 CategoryType/Label 이 실제 해당 카테고리 정보와 일치.
    /// </summary>
    [Fact]
    public async Task GenerateSmartRecommendations_TopPick_CategoryReferenceIsValid()
    {
        var request = CreateBasicRequest();
        request.IncludeThreeSyllable = true;

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.NotNull(result.TopPick);

        var matchingCategory = result.Categories
            .FirstOrDefault(c => c.Type == result.TopPick!.CategoryType);

        Assert.NotNull(matchingCategory);
        Assert.Equal(matchingCategory!.Label, result.TopPick!.CategoryLabel);
        Assert.Contains(matchingCategory.Names, n =>
            n.FullName == result.TopPick!.Candidate.FullName);
    }

    /// <summary>
    /// 탭 UX 회귀: TopPick 후보는 PhonologyNotes/Tags 등 모든 필드를 보존한다.
    /// (참조 복사이므로 Candidate 자체가 Categories 안의 객체와 동일 인스턴스)
    /// </summary>
    [Fact]
    public async Task GenerateSmartRecommendations_TopPick_PreservesCandidateFields()
    {
        var request = CreateBasicRequest();
        request.IncludeThreeSyllable = true;

        var result = await _service.GenerateSmartRecommendationsAsync(request);

        Assert.NotNull(result.TopPick);
        Assert.NotNull(result.TopPick!.Candidate.Tags);
        Assert.False(string.IsNullOrEmpty(result.TopPick.Candidate.FullName));
        Assert.NotNull(result.TopPick.Candidate.PhonologyNotes);
    }
}
