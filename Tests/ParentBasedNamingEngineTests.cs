using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// ParentBasedNamingEngine 부모 기반 작명 단위 테스트 — 방식 코드는 ParentNamingModels(2026-10-28: 옛 값은 사람 이름 꼴 '…모델'이라 중립 코드로 바꿨다).
/// 현실 입력(아이 성 = 아버지 성 등) 회귀는 ParentBasedRealisticInputTests.
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
            Assert.False(string.IsNullOrEmpty(c.NamingLabel), $"'{c.Name}'의 NamingLabel이 비어있음");
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
    public async Task GenerateCandidatesAsync_AllNamesAre2Syllables()
    {
        // 2026-10-28: 옛 단언은 2~4음절 허용이라 '김연서수민'(두 부모 이름을 이어 뒤집기)·'김김춘리'(이름 칸에 아버지 성) 같은
        // 3~4음절 이름을 정상으로 굳혔다. 공통 거르기가 정확히 2음절만 남긴다
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", "사랑",
            _defaultBirthDate, "none", "neutral");

        Assert.All(result, c =>
            Assert.True(c.Name.Length == 2, $"'{c.Name}'은 {c.Name.Length}음절 (2음절이어야 함)"));
    }

    // ===== 어머니 성씨 잇기 (옛 윤고은 모델) =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithMotherInfo_ContainsMotherSurnameModel()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, "윤", "고은", null,
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.MotherSurname);
        // 옛 첫 꼴 '어머니 성 + 어머니 이름'(어머니 전체 이름 '윤고은')은 버그였다 — 어떤 자리에도 없다
        Assert.DoesNotContain(result, c => c.Name == "윤고은" || c.Name == "고은");
        Assert.All(result.Where(c => c.NamingModel == ParentNamingModels.MotherSurname), c => Assert.StartsWith("윤", c.Name));
    }

    // ===== 어머니 성씨 소리 잇기 (옛 문소리 모델) =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithBothSurnames_ContainsMotherSoundModel()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "문", "민수", "이", "지은", null,
            _defaultBirthDate, "none", "neutral");

        // 어머니 성 '이'는 끝 글자 '리'로(두음 변주) — 이름 칸에 아버지 성 '문'은 들어가지 않는다(옛 '문X리' 3음절)
        var sound = result.Where(c => c.NamingModel == ParentNamingModels.MotherSound).ToList();
        Assert.NotEmpty(sound);
        Assert.All(sound, c =>
        {
            Assert.EndsWith("리", c.Name);
            Assert.DoesNotContain("문", c.Name);
            Assert.Contains("'리'로 바꿔", c.Description);
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_MotherSoundModel_TypeIsPhonetic()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "문", "민수", "이", "지은", null,
            _defaultBirthDate, "none", "neutral");

        var sound = result.Where(c => c.NamingModel == ParentNamingModels.MotherSound).ToList();
        Assert.NotEmpty(sound);
        Assert.All(sound, c => Assert.Equal("음운중심", c.NameType));
    }

    [Fact]
    public async Task MotherSound_NoVariantSurname_DoesNotClaimVariant()
    {
        // 변주가 없는 성(윤)은 '그대로'라고 적는다 — 옛 설명은 59.7% 가 거짓 '변주'였다
        var result = await _engine.GenerateCandidatesAsync(
            "김", "김", "민수", "윤", "하은", null,
            _defaultBirthDate, "none", "neutral");

        var sound = result.Where(c => c.NamingModel == ParentNamingModels.MotherSound).ToList();
        Assert.NotEmpty(sound);
        Assert.All(sound, c =>
        {
            Assert.EndsWith("윤", c.Name);
            Assert.Contains("그대로", c.Description);
            Assert.DoesNotContain("변주", c.Description);
        });
    }

    // ===== 키워드 뜻 잇기 (옛 신해솜 모델 키워드 경로) =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithStoryKeyword_ContainsKeywordMeaningModel()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null, "사랑",
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.KeywordMeaning);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_UnknownKeyword_FallsBackToKeywordSyllables()
    {
        // 2026-10-28: 표에 없는 키워드에 일반 낱말(아름다움·지혜·용기·사랑)을 채우던 폴백은 지웠다 — 키워드와 무관한 한자를
        // '키워드에서 추출'이라고 적었다. 뜻이 맞는 한자가 없으면 키워드 음절 소리 + 실명 짝 글자(keyword-sound)로 채운다
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null, "알수없는키워드",
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.KeywordSound);
        Assert.All(result, c => Assert.Contains("알수없는키워드", c.Description));
    }

    // ===== 부모 이름 글자 잇기 (옛 이수지-박지수 모델) =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithFatherName_ContainsParentSyllablesModel()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "수지", null, null, null,
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.ParentSyllables);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ParentSyllables_ReversesName()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "수지", null, null, null,
            _defaultBirthDate, "none", "neutral");

        var mirrorCandidates = result.Where(c => c.NamingModel == ParentNamingModels.ParentSyllables).ToList();
        Assert.Contains(mirrorCandidates, c => c.Name == "지수");
    }

    // ===== 부모 이름 첫 글자 잇기 (옛 복합 모델 (a)) =====

    [Fact]
    public async Task GenerateCandidatesAsync_WithBothParents_ContainsParentInitialsModel()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", null,
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.ParentInitials && c.Name == "민지");
    }

    // ===== 엣지 케이스 =====

    [Fact]
    public async Task GenerateCandidatesAsync_NoParentInfo_ReturnsSurnameBasedCandidates()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        // 부모 정보/키워드가 모두 없으면(API 전용 입력) 성씨 뜻 잇기가 후보를 낸다
        Assert.NotEmpty(result);
        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.SurnameMeaning);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_SingleCharParentName_HandledGracefully()
    {
        // 1글자 이름은 글자 잇기에서 건너뜀 (한 부모 이름 안의 두 글자가 없다)
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "준", null, null, null,
            _defaultBirthDate, "none", "neutral");

        // 예외 없이 처리되어야 함
        Assert.NotNull(result);

        // 글자 잇기 후보는 없어야 함 (1글자라 건너뜀)
        Assert.DoesNotContain(result, c => c.NamingModel == ParentNamingModels.ParentSyllables);
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
        // 공용 금칙어 목록(부분 일치) — 옛 엔진은 자체 8단어만 봐서 '사랑'의 첫 카드가 '폐총'(폐 = 금칙어)이었다
        Assert.All(result, c => Assert.False(ForbiddenWordData.ContainsForbiddenWord(c.Name), c.Name));
    }

    // ===== 성씨 뜻 잇기 (옛 신해솜 성씨 자동) =====

    [Fact]
    public async Task SurnameAuto_Kim_GeneratesSurnameMeaningWithoutKeyword()
    {
        // 김(金): 성씨 대표 한자 金 의 뜻 낱말(쇠)과 훈이 맞는 한자 + 실명 짝 글자
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var surname = result.Where(c => c.NamingModel == ParentNamingModels.SurnameMeaning).ToList();
        Assert.NotEmpty(surname);
        Assert.All(surname, c =>
        {
            Assert.False(string.IsNullOrEmpty(c.Description), "Description이 비어있음");
            Assert.True(c.Name.Length == 2, $"'{c.Name}'은 길이 부적절");
        });
        // 성씨 한자는 대표 한자(金) — 옛 코드는 독음 첫 2자(璞·博 같은 다른 성씨 글자)를 적었다
        Assert.Contains(surname, c => c.Description.Contains("'김'(金)"));
    }

    [Fact]
    public async Task SurnameAuto_Lee_GeneratesSurnameMeaningWithoutKeyword()
    {
        // 이(李): "이슬", "이솔" 등 패턴 — 이름 첫 글자가 패턴 글자(슬·솔)라 성과 이어 읽으면 그 낱말이 된다
        var result = await _engine.GenerateCandidatesAsync(
            "이", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var surname = result.Where(c => c.NamingModel == ParentNamingModels.SurnameMeaning).ToList();
        Assert.NotEmpty(surname);
        foreach (var c in surname.Where(c => c.Description.Contains("이어 읽으면")))
        {
            var word = c.Description.Split('\'')[3]; // 성씨 '이'와 이어 읽으면 '이슬'(…)
            Assert.StartsWith(word, "이" + c.Name);
        }
    }

    [Fact]
    public async Task SurnameAuto_Kang_GeneratesSurnameMeaningWithoutKeyword()
    {
        // 강(姜): "강산", "강물" 등 패턴
        var result = await _engine.GenerateCandidatesAsync(
            "강", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var surname = result.Where(c => c.NamingModel == ParentNamingModels.SurnameMeaning).ToList();
        Assert.NotEmpty(surname);
    }

    [Fact]
    public async Task SurnameAuto_Shin_GeneratesSurnameMeaningWithoutKeyword()
    {
        // 신(申): "신비", "신해" 등 패턴
        var result = await _engine.GenerateCandidatesAsync(
            "신", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var surname = result.Where(c => c.NamingModel == ParentNamingModels.SurnameMeaning).ToList();
        Assert.NotEmpty(surname);
    }

    [Fact]
    public async Task SurnameAuto_Ha_GeneratesSurnameMeaningWithoutKeyword()
    {
        // 하(河): "하늘", "하람" 등 패턴
        var result = await _engine.GenerateCandidatesAsync(
            "하", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var surname = result.Where(c => c.NamingModel == ParentNamingModels.SurnameMeaning).ToList();
        Assert.NotEmpty(surname);
    }

    [Fact]
    public async Task SurnameAuto_NotRunWhenKeywordGiven()
    {
        // 2026-10-28: 옛 테스트(SurnameAuto_ExistingKeywordStillWorks)는 키워드가 있어도 성씨 자동이 함께 나오길 기대했다 —
        // 그 결과 부모 이름·키워드를 준 실행 출력의 16.8% 가 입력과 무관한 성씨 자동 후보였다. 지금은 키워드 경로만 돈다
        var result = await _engine.GenerateCandidatesAsync(
            "김", null, null, null, null, "사랑",
            _defaultBirthDate, "none", "neutral");

        var keyword = result.Where(c => c.NamingModel is ParentNamingModels.KeywordMeaning or ParentNamingModels.KeywordSound).ToList();
        Assert.True(keyword.Count >= 2, "키워드 경로 후보가 2개 이상이어야 함");
        Assert.DoesNotContain(result, c => c.NamingModel == ParentNamingModels.SurnameMeaning);
    }

    [Fact]
    public async Task SurnameAuto_WithKeyword_DoesNotBreakOtherModels()
    {
        // storyKeyword + 부모 정보 모두 제공 시, 모든 방식이 정상 동작(성씨 자동은 부모 이름·키워드가 있어 돌지 않는다)
        var result = await _engine.GenerateCandidatesAsync(
            "김", "박", "민수", "이", "지은", "사랑",
            _defaultBirthDate, "none", "neutral");

        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.MotherSurname);
        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.MotherSound);
        Assert.Contains(result, c => c.NamingModel is ParentNamingModels.KeywordMeaning or ParentNamingModels.KeywordSound);
        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.ParentSyllables);
        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.ParentInitials);
        Assert.DoesNotContain(result, c => c.NamingModel == ParentNamingModels.SurnameMeaning);
    }

    [Fact]
    public async Task SurnameAuto_PatternDB_DescriptionContainsSurnameInfo()
    {
        // 성씨 뜻 잇기 후보는 설명에 성씨 관련 정보가 포함되어야 함
        var result = await _engine.GenerateCandidatesAsync(
            "하", null, null, null, null, null,
            _defaultBirthDate, "none", "neutral");

        var surname = result.Where(c => c.NamingModel == ParentNamingModels.SurnameMeaning).ToList();
        Assert.NotEmpty(surname);
        Assert.Contains(surname, c =>
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
