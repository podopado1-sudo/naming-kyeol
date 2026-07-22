using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;

namespace NameForm.Tests;

public class CreativeNamingEngineTests
{
    private readonly CreativeNamingEngine _engine = new();

    [Fact]
    public async Task GenerateCandidatesAsync_BasicRequest_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 10);

        Assert.NotNull(candidates);
        Assert.True(candidates.Count > 0, "후보가 하나도 없습니다.");
        Assert.True(candidates.Count <= 10);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_DifferentSurnames_ProduceDifferentResults()
    {
        var kimCandidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 20);
        var leeCandidates = await _engine.GenerateCandidatesAsync("이", "none", "neutral", 20);

        Assert.NotNull(kimCandidates);
        Assert.NotNull(leeCandidates);
        Assert.True(kimCandidates.Count > 0);
        Assert.True(leeCandidates.Count > 0);

        // 성씨가 다르면 결과 이름이 달라야 함
        var kimNames = kimCandidates.Select(c => c.Name).ToHashSet();
        var leeNames = leeCandidates.Select(c => c.Name).ToHashSet();

        // 완전히 동일하면 안 됨 (일부 겹칠 수는 있음)
        Assert.False(kimNames.SetEquals(leeNames),
            "김과 이의 후보가 완전히 동일합니다. 성씨별로 다른 결과가 나와야 합니다.");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ConceptAndConnectionNotEmpty()
    {
        var candidates = await _engine.GenerateCandidatesAsync("강", "none", "neutral", 10);

        Assert.All(candidates, c =>
        {
            Assert.False(string.IsNullOrEmpty(c.Name), "이름이 비어있습니다.");
            Assert.False(string.IsNullOrEmpty(c.FullName), "전체 이름이 비어있습니다.");
            Assert.False(string.IsNullOrEmpty(c.Concept), $"'{c.Name}'의 컨셉이 비어있습니다.");
            Assert.False(string.IsNullOrEmpty(c.SurnameConnection), $"'{c.Name}'의 성씨 연결고리가 비어있습니다.");
            Assert.False(string.IsNullOrEmpty(c.Meaning), $"'{c.Name}'의 의미가 비어있습니다.");
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_FullNameStartsWithLastName()
    {
        var candidates = await _engine.GenerateCandidatesAsync("한", "none", "neutral", 10);

        Assert.All(candidates, c =>
            Assert.StartsWith("한", c.FullName));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_MaleFilter_ExcludesFemaleOnly()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "male", "neutral", 20);

        // male 요청 시 결과가 있어야 함
        Assert.True(candidates.Count > 0, "male 성별 필터 적용 후 후보가 없습니다.");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_FemaleFilter_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateCandidatesAsync("이", "female", "neutral", 20);

        Assert.True(candidates.Count > 0, "female 성별 필터 적용 후 후보가 없습니다.");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_SoftTone_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateCandidatesAsync("서", "none", "soft", 20);

        Assert.True(candidates.Count > 0, "soft 톤 필터 적용 후 후보가 없습니다.");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_StrongTone_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateCandidatesAsync("강", "none", "strong", 20);

        Assert.True(candidates.Count > 0, "strong 톤 필터 적용 후 후보가 없습니다.");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_CreativityScoreInRange()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 20);

        Assert.All(candidates, c =>
            Assert.InRange(c.CreativityScore, 0, 100));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_OrderedByCreativityScore()
    {
        var candidates = await _engine.GenerateCandidatesAsync("이", "none", "neutral", 20);

        for (int i = 1; i < candidates.Count; i++)
        {
            Assert.True(candidates[i - 1].CreativityScore >= candidates[i].CreativityScore,
                $"창의성 점수 내림차순 정렬 위반: [{i - 1}]={candidates[i - 1].CreativityScore} < [{i}]={candidates[i].CreativityScore}");
        }
    }

    [Fact]
    public async Task GenerateCandidatesAsync_MeaningHasNoMultiReadingDump()
    {
        // FillRealNameMeanings의 CleanGloss는 다중 훈음('임금 주/주인 주/심지 주',
        // '괼 담, 잠길 침...')을 첫 훈음만 남긴다. '/'는 직접 작성한 패턴 뜻에는
        // 쓰이지 않으므로, 결과 뜻에 '/'가 있으면 정제 누락이다.
        foreach (var ln in new[] { "김", "이", "강", "윤", "박" })
        {
            var candidates = await _engine.GenerateCandidatesAsync(ln, "none", "neutral", 20);
            Assert.All(candidates, c =>
                Assert.DoesNotContain('/', c.Meaning));
        }
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ScoresNotAllMaxedOut()
    {
        // 표시 점수는 정렬용 raw 점수(jitter 포함)와 분리돼 품질·희소성으로 다시 매겨진다.
        // 과거엔 전부 100(클램프 천장)으로 눌려 변별이 없었다. 정상 대역 + 실제 변동 확인.
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 20);
        var twoSyllable = candidates.Where(c => c.Name.Length == 2).ToList();

        Assert.True(twoSyllable.Count >= 5, "2음절 후보가 충분히 나와야 한다.");
        // 천장(100)에 눌리지 않음
        Assert.All(twoSyllable, c => Assert.True(c.CreativityScore <= 97,
            $"'{c.Name}' 점수 {c.CreativityScore} — 천장 포화 의심"));
        // 모두 같은 값이 아니어야 함(변별 존재)
        var distinct = twoSyllable.Select(c => c.CreativityScore).Distinct().Count();
        Assert.True(distinct >= 3,
            $"표시 점수 변별이 부족합니다(서로 다른 값 {distinct}종). 천장 포화 회귀 의심.");
    }

    [Fact]
    public void BuildMechanicalMeaning_TwoSyllable_NonEmptyAndCleaned()
    {
        // LLM 폴리시 입력 + 런타임 폴백 양쪽이 쓰는 공개 헬퍼. 2음절은 비지 않고
        // 다중 훈음 덤프('/')가 없어야 한다.
        foreach (var name in new[] { "윤슬", "예솔", "단아", "라영" })
        {
            var m = CreativeNamingEngine.BuildMechanicalMeaning(name);
            Assert.False(string.IsNullOrEmpty(m), $"'{name}' 글로스가 비었습니다.");
            Assert.DoesNotContain('/', m);
        }
    }

    [Fact]
    public void BuildMechanicalMeaning_NonTwoSyllable_ReturnsEmpty()
    {
        Assert.Equal("", CreativeNamingEngine.BuildMechanicalMeaning("별"));   // 1음절
        Assert.Equal("", CreativeNamingEngine.BuildMechanicalMeaning("가나다")); // 3음절
        Assert.Equal("", CreativeNamingEngine.BuildMechanicalMeaning(""));
    }

    [Fact]
    public void CreativeMeaningData_AbsentFile_FallsBackToNull()
    {
        // 폴리시 파일(data/creative-name-meanings.json)이 없으면 Get은 null →
        // 엔진은 기계적 글로스로 폴백한다(동작 보존). 테스트 환경엔 파일이 없다.
        Assert.Null(CreativeMeaningData.Get("존재하지않는이름zzz"));
    }

    [Fact]
    public void NameStoryData_AbsentName_FallsBackToNull()
    {
        // 서사 파일(data/name-stories.json)에 없는 이름은 null → 소비처가 숨김.
        // 파일 자체가 없어도 동일하게 null이어야 한다.
        Assert.Null(NameStoryData.Get("존재하지않는이름zzz"));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_StoryConsistentWithData()
    {
        // 서사(Story)는 선택적 강화 레이어 — 파일이 없으면 전부 빈 문자열(숨김),
        // 있으면 NameStoryData와 정확히 일치해야 한다(Meaning과 달리 기계적 폴백 금지).
        // 파일 유무 양쪽 환경에서 유효한 계약이라 배치 생성 이후에도 그대로 통과한다.
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 10);

        Assert.All(candidates, c =>
        {
            Assert.NotNull(c.Story);
            if (c.Name.Length == 2)
                Assert.Equal(NameStoryData.Get(c.Name) ?? string.Empty, c.Story);
            else
                Assert.Equal(string.Empty, c.Story);
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_UnregisteredSurname_StillWorks()
    {
        // 사전에 없는 희귀 성씨도 동작해야 함
        var candidates = await _engine.GenerateCandidatesAsync("독고", "none", "neutral", 10);

        Assert.NotNull(candidates);
        // 미등록 성씨는 범용 이름이라도 반환 가능
        Assert.True(candidates.Count >= 0, "미등록 성씨에서 오류가 발생했습니다.");
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
    public async Task GenerateCandidatesAsync_NoDuplicateNames()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", 30);

        var names = candidates.Select(c => c.Name).ToList();
        var uniqueNames = names.Distinct().ToList();

        Assert.Equal(uniqueNames.Count, names.Count);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_WordPatternSurname_HasCreativeCandidates()
    {
        // '하' 성씨는 단어/뜻 확장/음절 활용 패턴 중 하나로 창의적 후보를 생성해야 함
        // (2026-05-15 채점 재조정 후 dedup으로 word pattern이 phonetic pattern에 흡수될 수 있어
        //  단어 패턴 한정 검증 → 일반 창의 후보 검증으로 완화)
        var candidates = await _engine.GenerateCandidatesAsync("하", "none", "neutral", 20);

        Assert.True(candidates.Count > 0, "'하' 성씨에 창의 후보가 없습니다.");
        Assert.Contains(candidates, c => !string.IsNullOrEmpty(c.Concept));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_VariousLastNames_Work()
    {
        var lastNames = new[] { "김", "이", "박", "최", "정", "강", "신", "한", "서", "윤" };

        foreach (var lastName in lastNames)
        {
            var candidates = await _engine.GenerateCandidatesAsync(lastName, "none", "neutral", 5);
            Assert.True(candidates.Count > 0, $"성씨 '{lastName}'에 대한 후보가 없습니다.");
        }
    }

    [Fact]
    public async Task GenerateCandidatesAsync_NewSurnames_감_ProduceResults()
    {
        var candidates = await _engine.GenerateCandidatesAsync("감", "none", "neutral", 10);
        Assert.True(candidates.Count > 0, "성씨 '감'에 대한 후보가 없습니다.");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_NewSurnames_봉_ProduceResults()
    {
        var candidates = await _engine.GenerateCandidatesAsync("봉", "none", "neutral", 10);
        Assert.True(candidates.Count > 0, "성씨 '봉'에 대한 후보가 없습니다.");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_NewSurnames_탁_ProduceResults()
    {
        var candidates = await _engine.GenerateCandidatesAsync("탁", "none", "neutral", 10);
        Assert.True(candidates.Count > 0, "성씨 '탁'에 대한 후보가 없습니다.");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ExpandedSurnames_ProduceResults()
    {
        // 새로 추가된 성씨들 테스트
        var newSurnames = new[] { "감", "곽", "봉", "탁", "옥", "용", "천", "추", "채", "현",
                                   "석", "매", "범", "해", "함", "은", "명", "금", "기", "길" };

        foreach (var surname in newSurnames)
        {
            var candidates = await _engine.GenerateCandidatesAsync(surname, "none", "neutral", 10);
            Assert.True(candidates.Count > 0, $"추가 성씨 '{surname}'에 대한 후보가 없습니다.");
        }
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ExpandedSurnames_HaveValidFields()
    {
        var candidates = await _engine.GenerateCandidatesAsync("봉", "none", "neutral", 10);

        Assert.All(candidates, c =>
        {
            Assert.False(string.IsNullOrEmpty(c.Name));
            Assert.False(string.IsNullOrEmpty(c.FullName));
            Assert.StartsWith("봉", c.FullName);
            Assert.False(string.IsNullOrEmpty(c.Concept));
            Assert.False(string.IsNullOrEmpty(c.Meaning));
            Assert.InRange(c.CreativityScore, 0, 100);
        });
    }

    [Fact]
    public async Task GenerateCandidatesAsync_CompositeSurnames_Work()
    {
        // 복성 테스트
        var compositeSurnames = new[] { "남궁", "제갈", "황보", "선우", "독고" };

        foreach (var surname in compositeSurnames)
        {
            var candidates = await _engine.GenerateCandidatesAsync(surname, "none", "neutral", 10);
            // 복성은 범용 이름이라도 나와야 함
            Assert.NotNull(candidates);
        }
    }

    [Theory]
    [InlineData("김")]
    [InlineData("이")]
    [InlineData("강")]
    public async Task GenerateCandidatesAsync_MaleVsFemale_ResultsDiffer30Percent(string lastName)
    {
        var maleCandidates = await _engine.GenerateCandidatesAsync(lastName, "male", "neutral", 20);
        var femaleCandidates = await _engine.GenerateCandidatesAsync(lastName, "female", "neutral", 20);

        Assert.True(maleCandidates.Count > 0, $"male 후보가 없습니다 ({lastName}).");
        Assert.True(femaleCandidates.Count > 0, $"female 후보가 없습니다 ({lastName}).");

        var maleNames = maleCandidates.Select(c => c.Name).ToHashSet();
        var femaleNames = femaleCandidates.Select(c => c.Name).ToHashSet();

        // 결과 목록이 최소 30% 이상 달라야 함
        var totalUnique = maleNames.Union(femaleNames).Count();
        var intersection = maleNames.Intersect(femaleNames).Count();
        var differenceRatio = 1.0 - ((double)intersection / totalUnique);

        Assert.True(differenceRatio >= 0.30,
            $"성씨 '{lastName}': male과 female 결과의 차이가 {differenceRatio:P0}로 30% 미만입니다. " +
            $"(male={maleNames.Count}, female={femaleNames.Count}, 겹침={intersection})");
    }

    [Theory]
    [InlineData("김")]
    [InlineData("강")]
    public async Task GenerateCandidatesAsync_SoftVsStrong_ResultsDiffer20Percent(string lastName)
    {
        var softCandidates = await _engine.GenerateCandidatesAsync(lastName, "none", "soft", 20);
        var strongCandidates = await _engine.GenerateCandidatesAsync(lastName, "none", "strong", 20);

        Assert.True(softCandidates.Count > 0, $"soft 후보가 없습니다 ({lastName}).");
        Assert.True(strongCandidates.Count > 0, $"strong 후보가 없습니다 ({lastName}).");

        var softNames = softCandidates.Select(c => c.Name).ToHashSet();
        var strongNames = strongCandidates.Select(c => c.Name).ToHashSet();

        var totalUnique = softNames.Union(strongNames).Count();
        var intersection = softNames.Intersect(strongNames).Count();
        var differenceRatio = 1.0 - ((double)intersection / totalUnique);

        Assert.True(differenceRatio >= 0.20,
            $"성씨 '{lastName}': soft와 strong 결과의 차이가 {differenceRatio:P0}로 20% 미만입니다. " +
            $"(soft={softNames.Count}, strong={strongNames.Count}, 겹침={intersection})");
    }
}
