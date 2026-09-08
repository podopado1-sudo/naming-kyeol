using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Tests;

public class RareSurnameEngineTests
{
    private readonly RareSurnameEngine _engine = new();

    public RareSurnameEngineTests() => HanjaData.LoadExternalData();

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

    // ═══════════════════════════════════════════════════════════════
    // 발음 풀 — 품질순·결정적 (2026-09-08: 사전 삽입 순서 의존 제거)
    // ═══════════════════════════════════════════════════════════════

    private static List<HanjaData.HanjaInfo> EligibleHanja() =>
        HanjaData.HanjaDictionary.Values
            .Where(h => !string.IsNullOrEmpty(h.Reading) && h.Reading.Length == 1
                     && !string.IsNullOrEmpty(h.Meaning)
                     && !HanjaData.IsForbiddenNameHanja(h.Character))
            .ToList();

    [Fact]
    public void SelectReadingPool_IsIndependentOfDictionaryInsertionOrder()
    {
        // 하드코딩 상세 사전 35행이 JSON보다 먼저 들어가는 순서에 결과가 매였던 회귀:
        // 같은 집합을 어떤 순서로 주어도 풀(발음 순서 + 대표 한자)이 같아야 한다.
        var eligible = EligibleHanja();
        var baseline = RareSurnameEngine.SelectReadingPool(eligible, RareSurnameEngine.ReadingPoolSize);

        var reversed = Enumerable.Reverse(eligible).ToList();
        var shuffled = eligible.ToList();
        var rng = new Random(20260908);
        for (int i = shuffled.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (shuffled[i], shuffled[j]) = (shuffled[j], shuffled[i]);
        }

        foreach (var permuted in new[] { reversed, shuffled })
        {
            var pool = RareSurnameEngine.SelectReadingPool(permuted, RareSurnameEngine.ReadingPoolSize);
            Assert.Equal(baseline.Select(h => h.Reading), pool.Select(h => h.Reading));
            Assert.Equal(baseline.Select(h => h.Character), pool.Select(h => h.Character));
        }
    }

    [Fact]
    public void SelectReadingPool_ContainsEstablishedNameSyllables_AndRealHanjaRepresentatives()
    {
        // 삽입 순서 의존 시절 사전 앞부분 정리만으로 빠졌던 발음(서·우·윤·진)이 품질순에서는 항상 들어온다.
        var pool = RareSurnameEngine.SelectReadingPool(EligibleHanja(), RareSurnameEngine.ReadingPoolSize);
        var readings = pool.Select(h => h.Reading).ToHashSet();

        Assert.Equal(RareSurnameEngine.ReadingPoolSize, pool.Count);
        Assert.Equal(pool.Count, readings.Count); // 발음당 대표 1개
        foreach (var syllable in new[] { "서", "우", "윤", "진", "현", "민", "지", "수", "영", "은" })
            Assert.Contains(syllable, readings);

        // 대표 한자는 실제 한자(한글 음절 자리표시 행 우/진/서 등이 아님)이고 약자·불용자가 아니다
        Assert.All(pool, h => Assert.True(HanjaData.IsHanCodePoint(h.Character), $"'{h.Reading}' 대표 {h.Character}"));
        Assert.All(pool, h => Assert.False(HanjaData.IsWeakGivenNameHanja(h.Character), $"'{h.Reading}' 대표 {h.Character}는 약자"));
        Assert.All(pool, h => Assert.False(HanjaData.IsForbiddenNameHanja(h.Character), $"'{h.Reading}' 대표 {h.Character}는 불용자"));
    }

    [Fact]
    public void SelectReadingPool_RepresentativeIsBestByRelevance_TieBrokenByOrdinal()
    {
        // ThreeSyllableEngine.SortByQuality와 같은 규칙: 관련도(약자 -3000) ↓ → Character Ordinal
        var eligible = EligibleHanja();
        var pool = RareSurnameEngine.SelectReadingPool(eligible, RareSurnameEngine.ReadingPoolSize);

        foreach (var rep in pool)
        {
            var expected = eligible
                .Where(h => h.Reading == rep.Reading)
                .OrderByDescending(h => HanjaData.CalculateRelevanceScore(h) - (HanjaData.IsWeakGivenNameHanja(h.Character) ? 3000 : 0))
                .ThenBy(h => h.Character, StringComparer.Ordinal)
                .First();
            Assert.Equal(expected.Character, rep.Character);
        }
    }

    [Fact]
    public async Task AnalyzeAndRecommend_IsDeterministicAcrossCalls()
    {
        var a = await _engine.AnalyzeAndRecommendAsync("탁", new DateTime(2024, 3, 1), "female", "soft", 30);
        var b = await _engine.AnalyzeAndRecommendAsync("탁", new DateTime(2024, 3, 1), "female", "soft", 30);

        Assert.Equal(a.Candidates.Select(c => c.Name), b.Candidates.Select(c => c.Name));
        Assert.Equal(a.Candidates.Select(c => string.Join("|", c.HanjaOptions)),
                     b.Candidates.Select(c => string.Join("|", c.HanjaOptions)));
    }

    [Theory]
    [InlineData("봉", "none", "neutral")]
    [InlineData("탁", "male", "strong")]
    [InlineData("남궁", "female", "soft")]
    public async Task AnalyzeAndRecommend_FirstSyllableNeverViolatesInitialSoundRule(string surname, string gender, string tone)
    {
        // 림/룡/량 같은 두음법칙 적용 대상 음절은 첫음절이 될 수 없다 (NamePoolEngine과 동일 규칙)
        var result = await _engine.AnalyzeAndRecommendAsync(surname, new DateTime(2024, 1, 1), gender, tone, 50);

        Assert.NotEmpty(result.Candidates);
        Assert.All(result.Candidates, c =>
            Assert.False(NamingPrinciples.RequiresDueum(c.Name[0].ToString()), $"두음법칙 위반 첫음절: {c.Name}"));
    }

    [Fact]
    public async Task AnalyzeAndRecommend_RoundRobinKeepsFirstSyllablesDiverse()
    {
        // 옛 구현은 후보 500개 상한이 풀 앞쪽 3~4개 발음만 첫음절로 남겨 라운드-로빈이 무력했다.
        var result = await _engine.AnalyzeAndRecommendAsync("봉", new DateTime(2024, 1, 1), "none", "neutral", 20);

        Assert.Equal(20, result.Candidates.Count);
        var firstSyllables = result.Candidates.Select(c => c.Name[0]).Distinct().Count();
        Assert.Equal(20, firstSyllables);
    }

    [Theory]
    [InlineData("봉")]
    [InlineData("탁")]
    [InlineData("정")]
    [InlineData("이")]
    [InlineData("김")]
    public async Task AnalyzeAndRecommend_SecondSyllableIsCapped_WithoutLosingFirstSyllableDiversity(string surname)
    {
        // 채점이 순수 음운이라 받침 성씨에서는 첫음절 그룹마다 1위가 'X수'였다(20개 중 9~12개, 캡 도입 전 실측).
        var result = await _engine.AnalyzeAndRecommendAsync(surname, new DateTime(2024, 1, 1), "none", "neutral", 20);

        Assert.Equal(20, result.Candidates.Count);
        var maxPerSecond = result.Candidates.GroupBy(c => c.Name[1]).Max(g => g.Count());
        Assert.True(maxPerSecond <= 3, $"둘째 음절 쏠림({maxPerSecond}): {string.Join(" ", result.Candidates.Select(c => c.Name))}");
        Assert.Equal(20, result.Candidates.Select(c => c.Name[0]).Distinct().Count());
    }

    [Fact]
    public async Task AnalyzeAndRecommend_ExcludesNegativeHomophoneNames()
    {
        var result = await _engine.AnalyzeAndRecommendAsync("봉", new DateTime(2024, 1, 1), "none", "neutral", 50);

        Assert.All(result.Candidates, c =>
            Assert.False(ForbiddenWordData.IsNegativeHomophoneName(c.Name), $"부정 동음 이름 노출: {c.Name}"));
        Assert.DoesNotContain(result.Candidates, c => c.Name is "원수" or "예수" or "원정" or "예정");
    }

    // ═══════════════════════════════════════════════════════════════
    // 한자 옵션 — 빈출 우선·기본 영역 우선·결정적
    // ═══════════════════════════════════════════════════════════════

    private static string OptionChar(string option) => option[..option.IndexOf('(')];

    [Theory]
    [InlineData("미민")]
    [InlineData("서우")]
    [InlineData("윤진")]
    public void ScoreCandidate_HanjaOptions_AreCommonBasicRangeHanja(string name)
    {
        // 옛 구현: 美 뒤에 확장 A 글자 㵟·䋛, 민에 한글 자리표시 "민(백성)"·䃉·䪸
        var options = _engine.ScoreCandidate("봉", name).HanjaOptions;

        Assert.Equal(6, options.Count); // 음절당 3개
        foreach (var option in options)
        {
            var ch = OptionChar(option);
            Assert.True(HanjaData.IsInCjkBasicRange(ch), $"기본 영역 밖 글자 노출: {option}");
            Assert.False(HanjaData.IsForbiddenNameHanja(ch), $"불용자 노출: {option}");
        }
        // 각 음절의 첫 옵션은 인명 빈출 한자
        Assert.True(HanjaData.IsCommonNameHanja(OptionChar(options[0])), $"첫 옵션이 빈출자가 아님: {options[0]}");
        Assert.True(HanjaData.IsCommonNameHanja(OptionChar(options[3])), $"첫 옵션이 빈출자가 아님: {options[3]}");
    }

    [Fact]
    public async Task AnalyzeAndRecommend_HanjaOptions_NoExtensionAWhenBasicAlternativesExist()
    {
        var result = await _engine.AnalyzeAndRecommendAsync("탁", new DateTime(2024, 1, 1), "none", "neutral", 50);

        Assert.NotEmpty(result.Candidates);
        foreach (var candidate in result.Candidates)
        {
            Assert.Equal(6, candidate.HanjaOptions.Count);
            for (int i = 0; i < candidate.HanjaOptions.Count; i++)
            {
                var option = candidate.HanjaOptions[i];
                var ch = OptionChar(option);
                var syllable = candidate.Name[i / 3].ToString();

                Assert.True(HanjaData.IsHanCodePoint(ch), $"{candidate.Name}: 한자가 아닌 옵션 {option}");
                var info = HanjaData.FindByCharacter(ch);
                Assert.NotNull(info);
                Assert.True(info.Reading == syllable || info.AlternateReadings.Contains(syllable),
                    $"{candidate.Name}/{syllable}: 발음이 다른 옵션 {option} ({info.Reading})");

                if (!HanjaData.IsInCjkBasicRange(ch))
                {
                    // 확장 영역 글자는 그 음절의 기본 영역 후보가 3개 미만일 때만 허용
                    var basicAlternatives = HanjaSelector.OrderForDisplay(HanjaData.FindByReading(syllable))
                        .Count(h => HanjaData.IsInCjkBasicRange(h.Character));
                    Assert.True(basicAlternatives < 3,
                        $"{candidate.Name}/{syllable}: 기본 영역 대안 {basicAlternatives}개가 있는데 {option} 노출");
                }
            }
        }
    }

    [Fact]
    public void ScoreCandidate_HanjaOptions_MatchTopForDisplay()
    {
        // 옵션은 HanjaSelector.TopForDisplay(단일 진실의 원천)와 같은 글자·순서
        var options = _engine.ScoreCandidate("하", "은서").HanjaOptions;

        var expected = new[] { "은", "서" }
            .SelectMany(s => HanjaSelector.TopForDisplay(s, 3).Select(h => $"{h.Character}({h.Meaning})"))
            .ToList();
        Assert.Equal(expected, options);
    }
}
