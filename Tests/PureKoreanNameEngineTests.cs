using NameForm.Application.Engines;

namespace NameForm.Tests;

public class PureKoreanNameEngineTests
{
    private readonly PureKoreanNameEngine _engine = new();

    [Fact]
    public async Task GenerateCandidatesAsync_BasicRequest_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 10);

        Assert.NotNull(candidates);
        Assert.True(candidates.Count > 0);
        Assert.True(candidates.Count <= 10);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_RespectsCountLimit()
    {
        var candidates = await _engine.GenerateCandidatesAsync("이", "none", "neutral", 5);

        Assert.True(candidates.Count <= 5);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_MaleFilter_ExcludesFemaleOnly()
    {
        var candidates = await _engine.GenerateCandidatesAsync("박", "male", "neutral", 50);

        // male 요청 시 female 전용 이름은 제외되어야 함
        Assert.DoesNotContain(candidates, c => c.GenderFit == "female");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_FemaleFilter_ExcludesMaleOnly()
    {
        var candidates = await _engine.GenerateCandidatesAsync("최", "female", "neutral", 50);

        // female 요청 시 male 전용 이름은 제외되어야 함
        Assert.DoesNotContain(candidates, c => c.GenderFit == "male");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_NoneGender_IncludesAll()
    {
        var candidates = await _engine.GenerateCandidatesAsync("정", "none", "neutral", 50);

        // none 요청 시 다양한 성별 이름이 포함되어야 함
        var genders = candidates.Select(c => c.GenderFit).Distinct().ToList();
        Assert.True(genders.Count >= 2, "none 성별 요청 시 최소 2종류 이상의 성별 이름이 나와야 합니다.");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_SoftTone_PrefersSoftNames()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "soft", 20);

        // soft 톤 요청 시 soft 또는 neutral 톤만 포함
        Assert.All(candidates, c =>
            Assert.True(c.ToneFit == "soft" || c.ToneFit == "neutral",
                $"soft 톤 요청인데 '{c.Name}'의 톤이 '{c.ToneFit}'입니다."));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_AllCandidatesHaveMeaning()
    {
        var candidates = await _engine.GenerateCandidatesAsync("이", "none", "neutral", 20);

        Assert.All(candidates, c =>
        {
            Assert.False(string.IsNullOrEmpty(c.Name), "이름이 비어있습니다.");
            Assert.False(string.IsNullOrEmpty(c.Meaning), $"'{c.Name}'의 뜻풀이가 없습니다.");
            Assert.False(string.IsNullOrEmpty(c.Origin), $"'{c.Name}'의 어원이 없습니다.");
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_PronunciationScoreInRange()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 20);

        Assert.All(candidates, c =>
            Assert.InRange(c.PronunciationScore, 0, 100));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_OrderedByPronunciationScore()
    {
        var candidates = await _engine.GenerateCandidatesAsync("이", "none", "neutral", 20);

        for (int i = 1; i < candidates.Count; i++)
        {
            Assert.True(candidates[i - 1].PronunciationScore >= candidates[i].PronunciationScore,
                $"발음 점수 내림차순 정렬 위반: [{i-1}]={candidates[i-1].PronunciationScore} < [{i}]={candidates[i].PronunciationScore}");
        }
    }

    [Fact]
    public async Task GenerateCandidatesAsync_DictionaryHasMinimum200Names()
    {
        // none/neutral로 전체 사전 크기 확인 (count=50 제한이므로 50개만 반환)
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 50);

        // 사전이 200개+ 이므로 최대 50개가 반환되어야 함
        Assert.True(candidates.Count == 50,
            $"사전에 충분한 이름이 없습니다. 반환: {candidates.Count}개 (50개 기대)");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_EachGenderHas60PlusNames()
    {
        // 남성 필터링 후에도 충분한 결과 (neutral + male = 140개+)
        var maleCandidates = await _engine.GenerateCandidatesAsync("김", "male", "neutral", 50);
        Assert.True(maleCandidates.Count == 50,
            $"남성 후보가 부족합니다. 반환: {maleCandidates.Count}개");

        // 여성 필터링 후에도 충분한 결과 (neutral + female = 140개+)
        var femaleCandidates = await _engine.GenerateCandidatesAsync("김", "female", "neutral", 50);
        Assert.True(femaleCandidates.Count == 50,
            $"여성 후보가 부족합니다. 반환: {femaleCandidates.Count}개");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_CountClampedToMax50()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 100);

        Assert.True(candidates.Count <= 50);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_CountClampedToMin1()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 0);

        Assert.True(candidates.Count >= 1);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_VariousLastNames_Work()
    {
        var lastNames = new[] { "김", "이", "박", "최", "정", "강", "조", "윤" };

        foreach (var lastName in lastNames)
        {
            var candidates = await _engine.GenerateCandidatesAsync(lastName, "none", "neutral", 5);
            Assert.True(candidates.Count > 0, $"성씨 '{lastName}'에 대한 후보가 없습니다.");
        }
    }

    [Fact]
    public async Task GenerateCandidatesAsync_StrongTone_IncludesStrongNames()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "male", "strong", 20);

        var hasStrong = candidates.Any(c => c.ToneFit == "strong");
        Assert.True(hasStrong, "strong 톤 요청인데 strong 이름이 하나도 없습니다.");
    }
}
