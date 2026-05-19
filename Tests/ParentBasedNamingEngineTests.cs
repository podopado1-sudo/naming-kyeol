using NameForm.Application.Engines;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// ParentBasedNamingEngine 부모 기반 작명 단위 테스트
/// 윤고은/문소리/신해솜/이수지-박지수/복합 모델 검증
/// </summary>
public class ParentBasedNamingEngineTests
{
    private readonly ParentBasedNamingEngine _engine = new(new NamePoolEngine(new FakeSajuCalculationService()), new NameReversalEngine());
    private readonly DateTime _defaultBirthDate = new(1990, 3, 21);

    // ===== 기본 동작 =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithFullParentInfo_ReturnsNonEmpty()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", "사랑",
            _defaultBirthDate, "none", "neutral");

        Assert.NotEmpty(result);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ReturnsAtMost50Candidates()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", "사랑",
            _defaultBirthDate, "none", "neutral");

        Assert.True(result.Count <= 50, $"후보 수({result.Count})가 50개를 초과함");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_AllCandidatesHaveRequiredProperties()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", "사랑",
            _defaultBirthDate, "none", "neutral");

        Assert.All(result, c =>
        {
            Assert.False(string.IsNullOrEmpty(c.Name), "Name이 비어있음");
            Assert.False(string.IsNullOrEmpty(c.NamingModel), $"'{c.Name}'의 NamingModel이 비어있음");
            Assert.False(string.IsNullOrEmpty(c.NameType), $"'{c.Name}'의 NameType이 비어있음");
            Assert.False(string.IsNullOrEmpty(c.Description), $"'{c.Name}'의 Description이 비어있음");
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_NoDuplicateNames()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", "사랑",
            _defaultBirthDate, "none", "neutral");

        var nameCount = result.Select(c => c.Name).Distinct().Count();
        Assert.Equal(result.Count, nameCount);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_AllNamesAre2To4Syllables()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", "사랑",
            _defaultBirthDate, "none", "neutral");

        Assert.All(result, c =>
            Assert.True(c.Name.Length >= 2 && c.Name.Length <= 4,
                $"'{c.Name}'은 {c.Name.Length}음절 (2~4음절이어야 함)"));
    }

    // ===== 윤고은 모델 =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithMotherInfo_ContainsYoonGoEunModel()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, "윤", "고은", null,
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == "윤고은모델");
    }

    // ===== 문소리 모델 =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithBothSurnames_ContainsMoonSoRiModel()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "문", "민수", "이", "지은", null,
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == "문소리모델");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_MoonSoRiModel_TypeIsPhonetic()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "문", "민수", "이", "지은", null,
            _defaultBirthDate, "none", "neutral");

        var moonSoRi = result.Where(c => c.NamingModel == "문소리모델").ToList();
        Assert.All(moonSoRi, c =>
            Assert.Equal("음운중심", c.NameType));
    }

    // ===== 신해솜 모델 =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithStoryKeyword_ContainsShinHaeSomModel()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null, "사랑",
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == "신해솜모델");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_UnknownKeyword_FallsBackToDefaults()
    {
        // 알 수 없는 키워드여도 기본 의미("아름다움","지혜","용기","사랑")로 폴백
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null, "알수없는키워드",
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == "신해솜모델");
    }

    // ===== 이수지-박지수 모델 =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithFatherName_ContainsMirrorModel()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "수지", null, null, null,
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == "이수지-박지수모델");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_MirrorModel_ReversesName()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "수지", null, null, null,
            _defaultBirthDate, "none", "neutral");

        var mirrorCandidates = result.Where(c => c.NamingModel == "이수지-박지수모델").ToList();
        Assert.Contains(mirrorCandidates, c => c.Name == "지수");
    }

    // ===== 복합 모델 =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithBothParents_ContainsCompositeModel()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", null,
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == "복합모델");
    }

    // ===== 엣지 케이스 =====

    [Fact]
    public async Task GenerateCandidatesAsync_NoParentInfo_ReturnsSurnameBasedCandidates()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        // 부모 정보/키워드 없어도 성씨 자동 활용 신해솜모델이 후보를 생성해야 함
        Assert.NotEmpty(result);
        Assert.Contains(result, c => c.NamingModel == "신해솜모델");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_SingleCharParentName_HandledGracefully()
    {
        // 1글자 이름은 미러 모델에서 건너뜀 (fatherName.Length >= 2 조건)
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "준", null, null, null,
            _defaultBirthDate, "none", "neutral");

        // 예외 없이 처리되어야 함
        Assert.NotNull(result);

        // 미러 모델에서 반전 후보는 없어야 함 (1글자라 건너뜀)
        var mirrorReversed = result.Where(c =>
            c.NamingModel == "이수지-박지수모델" &&
            c.Description.Contains("반전")).ToList();
        Assert.Empty(mirrorReversed);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ForbiddenWordFiltered()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", "사랑",
            _defaultBirthDate, "none", "neutral");

        var forbiddenWords = new[] { "바보", "멍청", "못난", "나쁜", "악", "흉", "죽", "병" };
        Assert.All(result, c =>
            Assert.DoesNotContain(forbiddenWords, f => c.Name.Contains(f)));
    }

    // ===== 신해솜모델 성씨 자동 활용 =====

    [Fact]
    public async Task SurnameAuto_Kim_GeneratesShinHaeSomWithoutKeyword()
    {
        // 김(金): 성씨 의미 사전과 패턴 DB에서 자동 생성
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var shinHaeSom = result.Where(c => c.NamingModel == "신해솜모델").ToList();
        Assert.NotEmpty(shinHaeSom);
        Assert.All(shinHaeSom, c =>
        {
            Assert.False(string.IsNullOrEmpty(c.Description), "Description이 비어있음");
            Assert.True(c.Name.Length >= 2 && c.Name.Length <= 4, $"'{c.Name}'은 길이 부적절");
        });
    }

    [Fact]
    public async Task SurnameAuto_Lee_GeneratesShinHaeSomWithoutKeyword()
    {
        // 이(李): "이슬", "이솔" 등 패턴 매칭 기대
        var result = await _engine.GenerateCandidatesAsync(
            "이", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var shinHaeSom = result.Where(c => c.NamingModel == "신해솜모델").ToList();
        Assert.NotEmpty(shinHaeSom);
    }

    [Fact]
    public async Task SurnameAuto_Kang_GeneratesShinHaeSomWithoutKeyword()
    {
        // 강(姜/康/强/江): "강산", "강물" 등 패턴 매칭 기대
        var result = await _engine.GenerateCandidatesAsync(
            "강", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var shinHaeSom = result.Where(c => c.NamingModel == "신해솜모델").ToList();
        Assert.NotEmpty(shinHaeSom);
    }

    [Fact]
    public async Task SurnameAuto_Shin_GeneratesShinHaeSomWithoutKeyword()
    {
        // 신(申/辛/新): "신비", "신해" 등 패턴 매칭 기대
        var result = await _engine.GenerateCandidatesAsync(
            "신", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var shinHaeSom = result.Where(c => c.NamingModel == "신해솜모델").ToList();
        Assert.NotEmpty(shinHaeSom);
    }

    [Fact]
    public async Task SurnameAuto_Ha_GeneratesShinHaeSomWithoutKeyword()
    {
        // 하(河): "하늘", "하람" 등 패턴 매칭 기대
        var result = await _engine.GenerateCandidatesAsync(
            "하", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var shinHaeSom = result.Where(c => c.NamingModel == "신해솜모델").ToList();
        Assert.NotEmpty(shinHaeSom);
    }

    [Fact]
    public async Task SurnameAuto_ExistingKeywordStillWorks()
    {
        // storyKeyword가 있는 경우 기존 로직도 함께 동작해야 함
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null, "사랑",
            _defaultBirthDate, "none", "neutral");

        var shinHaeSom = result.Where(c => c.NamingModel == "신해솜모델").ToList();
        Assert.NotEmpty(shinHaeSom);

        // 기존 키워드 기반 + 성씨 자동 활용 모두 있어야 함
        Assert.True(shinHaeSom.Count >= 2, "키워드 기반 + 성씨 자동 모두 동작해야 함");
    }

    [Fact]
    public async Task SurnameAuto_WithKeyword_DoesNotBreakOtherModels()
    {
        // storyKeyword + 부모 정보 모두 제공 시, 모든 모델이 정상 동작
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", "사랑",
            _defaultBirthDate, "none", "neutral");

        // 기존 모델 검증
        Assert.Contains(result, c => c.NamingModel == "윤고은모델");
        Assert.Contains(result, c => c.NamingModel == "문소리모델");
        Assert.Contains(result, c => c.NamingModel == "신해솜모델");
        Assert.Contains(result, c => c.NamingModel == "이수지-박지수모델");
        Assert.Contains(result, c => c.NamingModel == "복합모델");
    }

    [Fact]
    public async Task SurnameAuto_PatternDB_DescriptionContainsSurnameInfo()
    {
        // 성씨 자동 활용 모델에서 생성된 이름은 설명에 성씨 관련 정보가 포함되어야 함
        var result = await _engine.GenerateCandidatesAsync(
            "하", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var shinHaeSom = result.Where(c => c.NamingModel == "신해솜모델").ToList();
        Assert.NotEmpty(shinHaeSom);
        // 성씨 관련 설명이 포함된 후보가 있어야 함
        Assert.Contains(shinHaeSom, c =>
            c.Description.Contains("하") || c.Description.Contains("성씨"));
    }

    [Fact]
    public async Task SurnameAuto_AllCandidatesAreValidKorean()
    {
        // 생성된 모든 이름이 유효한 한글이어야 함
        var surnames = new[] { "김", "이", "강", "신", "하", "박", "최", "정" };
        foreach (var surname in surnames)
        {
            var result = await _engine.GenerateCandidatesAsync(
                surname, null, null, null, null, null,
                _defaultBirthDate, "none", "neutral");

            Assert.All(result, c =>
                Assert.True(c.Name.All(ch => ch >= 0xAC00 && ch <= 0xD7A3),
                    $"'{c.Name}'에 한글이 아닌 문자가 포함됨"));
        }
    }
}
