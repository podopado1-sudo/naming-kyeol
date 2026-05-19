using NameForm.Application.Engines;

namespace NameForm.Tests;

public class ThreeSyllableEngineTests
{
    private readonly ThreeSyllableEngine _engine = new();

    [Fact]
    public async Task GenerateCandidates_PureKorean_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateCandidatesAsync("최", "none", "neutral", "pure-korean", 10);

        Assert.NotNull(candidates);
        Assert.True(candidates.Count > 0);
        Assert.True(candidates.Count <= 10);
    }

    [Fact]
    public async Task GenerateCandidates_PureKorean_AllNamesAreThreeSyllables()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", "pure-korean", 20);

        Assert.All(candidates, c =>
            Assert.Equal(3, c.Name.Length));
    }

    [Fact]
    public async Task GenerateCandidates_PureKorean_FullNameIsFourSyllables()
    {
        var candidates = await _engine.GenerateCandidatesAsync("문", "none", "neutral", "pure-korean", 10);

        Assert.All(candidates, c =>
        {
            Assert.Equal(4, c.FullName.Length);
            Assert.StartsWith("문", c.FullName);
        });
    }

    [Fact]
    public async Task GenerateCandidates_PureKorean_NameTypeIsPureKorean()
    {
        var candidates = await _engine.GenerateCandidatesAsync("이", "none", "neutral", "pure-korean", 10);

        Assert.All(candidates, c =>
            Assert.Equal("pure-korean", c.NameType));
    }

    [Fact]
    public async Task GenerateCandidates_Hanja_ReturnsCandidates()
    {
        // 한자 데이터 로드
        NameForm.Application.Engines.Data.HanjaData.LoadExternalData();

        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", "hanja", 10);

        Assert.NotNull(candidates);
        Assert.True(candidates.Count > 0);
        Assert.All(candidates, c =>
        {
            Assert.Equal(3, c.Name.Length);
            Assert.Equal("hanja", c.NameType);
        });
    }

    [Fact]
    public async Task GenerateCandidates_Hanja_ComponentsHaveThreeEntries()
    {
        NameForm.Application.Engines.Data.HanjaData.LoadExternalData();

        var candidates = await _engine.GenerateCandidatesAsync("박", "none", "neutral", "hanja", 10);

        Assert.All(candidates, c =>
            Assert.Equal(3, c.Components.Count));
    }

    [Fact]
    public async Task GenerateCandidates_Mixed_ReturnsCandidates()
    {
        NameForm.Application.Engines.Data.HanjaData.LoadExternalData();

        var candidates = await _engine.GenerateCandidatesAsync("최", "none", "neutral", "mixed", 10);

        Assert.NotNull(candidates);
        Assert.True(candidates.Count > 0);
        Assert.All(candidates, c =>
        {
            Assert.Equal(3, c.Name.Length);
            Assert.Equal("mixed", c.NameType);
        });
    }

    [Fact]
    public async Task GenerateCandidates_MaleFilter_ExcludesFemalePrefix()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "male", "neutral", "pure-korean", 50);

        // male 요청 시 "여울", "이슬" 등 female 전용 prefix는 나오지 않아야 함
        Assert.DoesNotContain(candidates, c => c.Name.StartsWith("이슬"));
        Assert.DoesNotContain(candidates, c => c.Name.StartsWith("다소"));
    }

    [Fact]
    public async Task GenerateCandidates_FemaleFilter_ExcludesMalePrefix()
    {
        var candidates = await _engine.GenerateCandidatesAsync("이", "female", "neutral", "pure-korean", 50);

        // female 요청 시 male 전용 prefix(한울, 마루 등)는 나오지 않아야 함
        Assert.DoesNotContain(candidates, c => c.Name.StartsWith("한울"));
        Assert.DoesNotContain(candidates, c => c.Name.StartsWith("마루"));
    }

    [Fact]
    public async Task GenerateCandidates_SoftTone_ExcludesStrongOnly()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "soft", "pure-korean", 50);

        // soft 톤 요청 시 strong으로 명시 큐레이션된 이름만 제외 (사전 확장 v2 후 prefix 기준 폐기)
        Assert.DoesNotContain(candidates, c => c.Name == "바다솔");
        Assert.DoesNotContain(candidates, c => c.Name == "새벽별");
        Assert.DoesNotContain(candidates, c => c.Name == "솔바람");
    }

    [Fact]
    public async Task GenerateCandidates_PronunciationScoreInRange()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", "pure-korean", 20);

        Assert.All(candidates, c =>
            Assert.InRange(c.PronunciationScore, 0.0, 100.0));
    }

    [Fact]
    public async Task GenerateCandidates_OrderedByPronunciationScoreDescending()
    {
        var candidates = await _engine.GenerateCandidatesAsync("이", "none", "neutral", "pure-korean", 20);

        for (int i = 1; i < candidates.Count; i++)
        {
            Assert.True(candidates[i - 1].PronunciationScore >= candidates[i].PronunciationScore,
                $"발음 점수 내림차순 정렬 위반: [{i-1}]={candidates[i-1].PronunciationScore} < [{i}]={candidates[i].PronunciationScore}");
        }
    }

    [Fact]
    public async Task GenerateCandidates_RespectsCountLimit()
    {
        var candidates = await _engine.GenerateCandidatesAsync("박", "none", "neutral", "pure-korean", 5);

        Assert.True(candidates.Count <= 5);
    }

    [Fact]
    public async Task GenerateCandidates_CountClampedToMax50()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", "pure-korean", 100);

        Assert.True(candidates.Count <= 50);
    }

    [Fact]
    public async Task GenerateCandidates_CountClampedToMin1()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", "pure-korean", 0);

        Assert.True(candidates.Count >= 1);
    }

    [Fact]
    public async Task GenerateCandidates_AllHaveMeaning()
    {
        var candidates = await _engine.GenerateCandidatesAsync("정", "none", "neutral", "pure-korean", 20);

        Assert.All(candidates, c =>
        {
            Assert.False(string.IsNullOrEmpty(c.Name), "이름이 비어있습니다.");
            Assert.False(string.IsNullOrEmpty(c.Meaning), $"'{c.Name}'의 뜻풀이가 없습니다.");
            Assert.False(string.IsNullOrEmpty(c.FullName), $"'{c.Name}'의 전체 이름이 없습니다.");
        });
    }

    [Fact]
    public async Task GenerateCandidates_ComponentsNotEmpty()
    {
        var candidates = await _engine.GenerateCandidatesAsync("최", "none", "neutral", "pure-korean", 10);

        Assert.All(candidates, c =>
            Assert.True(c.Components.Count >= 2, $"'{c.Name}'의 구성 요소가 부족합니다: {c.Components.Count}"));
    }

    [Fact]
    public async Task GenerateCandidates_VariousLastNames_Work()
    {
        var lastNames = new[] { "김", "이", "박", "최", "정", "강", "조", "윤" };

        foreach (var lastName in lastNames)
        {
            var candidates = await _engine.GenerateCandidatesAsync(lastName, "none", "neutral", "pure-korean", 5);
            Assert.True(candidates.Count > 0, $"성씨 '{lastName}'에 대한 후보가 없습니다.");
        }
    }

    [Fact]
    public async Task GenerateCandidates_DefaultNameType_TreatedAsPureKorean()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", "unknown-type", 10);

        // 알 수 없는 타입은 pure-korean으로 fallback
        Assert.True(candidates.Count > 0);
    }

    [Fact]
    public async Task GenerateCandidates_CuratedNames_AppearInResults()
    {
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", "pure-korean", 50);

        // 큐레이션 이름 중 하나 이상이 결과에 포함되어야 함
        var curatedNames = new HashSet<string>
        {
            "가온빛", "하늘빛", "해오름", "비나리", "가온결", "한결빛",
            "여울결", "이슬빛", "노을빛", "솔바람", "바다솔"
        };

        var hasCurated = candidates.Any(c => curatedNames.Contains(c.Name));
        Assert.True(hasCurated, "큐레이션된 이름이 결과에 포함되지 않았습니다.");
    }

    [Fact]
    public async Task GenerateCandidates_CuratedNames_HaveHighScore()
    {
        var candidates = await _engine.GenerateCandidatesAsync("이", "none", "neutral", "pure-korean", 50);

        // 큐레이션 이름들은 상위 점수에 나타나야 함
        var topCandidates = candidates.Take(20).ToList();
        var curatedNames = new HashSet<string>
        {
            "가온빛", "하늘빛", "해오름", "가온결", "다온결", "한결빛"
        };

        var curatedInTop = topCandidates.Count(c => curatedNames.Contains(c.Name));
        Assert.True(curatedInTop > 0, "큐레이션 이름이 상위 20개 결과에 없습니다.");
    }

    [Fact]
    public async Task GenerateCandidates_CuratedNames_RespectGenderFilter()
    {
        // male 요청 시 female 큐레이션 이름은 나오지 않아야 함
        var candidates = await _engine.GenerateCandidatesAsync("김", "male", "neutral", "pure-korean", 50);

        var femaleCuratedNames = new HashSet<string>
        {
            "여울결", "다소미", "이슬빛", "노을빛", "봄나래", "봄이슬"
        };

        Assert.DoesNotContain(candidates, c => femaleCuratedNames.Contains(c.Name));
    }

    [Fact]
    public async Task GenerateCandidates_CuratedNames_RespectToneFilter()
    {
        // soft 요청 시 strong 큐레이션 이름은 나오지 않아야 함
        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "soft", "pure-korean", 50);

        var strongCuratedNames = new HashSet<string>
        {
            "한울빛", "바다솔", "솔바람", "마루빛", "세찬빛", "한빛솔", "미르빛"
        };

        Assert.DoesNotContain(candidates, c => strongCuratedNames.Contains(c.Name));
    }

    [Fact]
    public async Task GenerateCandidates_HanjaCurated_AppearInResults()
    {
        NameForm.Application.Engines.Data.HanjaData.LoadExternalData();

        var candidates = await _engine.GenerateCandidatesAsync("김", "female", "soft", "hanja", 50);

        var hanjaCurated = new HashSet<string>
        {
            "서연빈", "하연주", "예원빈", "채연서", "하윤서", "예서윤"
        };

        var hasCurated = candidates.Any(c => hanjaCurated.Contains(c.Name));
        Assert.True(hasCurated, "한자 큐레이션 이름이 결과에 포함되지 않았습니다.");
    }

    [Fact]
    public async Task GenerateCandidates_CuratedNamesStillThreeSyllables()
    {
        var candidates = await _engine.GenerateCandidatesAsync("최", "none", "neutral", "pure-korean", 50);

        // 큐레이션 이름 포함 모든 이름이 3글자인지 확인
        Assert.All(candidates, c =>
            Assert.Equal(3, c.Name.Length));
    }

    [Fact]
    public async Task GenerateCandidates_MixedCurated_AppearInResults()
    {
        NameForm.Application.Engines.Data.HanjaData.LoadExternalData();

        var candidates = await _engine.GenerateCandidatesAsync("김", "none", "neutral", "mixed", 50);

        var mixedCurated = new HashSet<string>
        {
            "하늘빈", "별빛윤", "가온서", "나래윤", "누리서"
        };

        var hasCurated = candidates.Any(c => mixedCurated.Contains(c.Name));
        Assert.True(hasCurated, "혼합형 큐레이션 이름이 결과에 포함되지 않았습니다.");
    }

    [Theory]
    [InlineData("김")]
    [InlineData("이")]
    [InlineData("최")]
    public async Task GenerateCandidates_MaleVsFemale_ResultsDiffer30Percent(string lastName)
    {
        var maleCandidates = await _engine.GenerateCandidatesAsync(lastName, "male", "neutral", "pure-korean", 20);
        var femaleCandidates = await _engine.GenerateCandidatesAsync(lastName, "female", "neutral", "pure-korean", 20);

        Assert.True(maleCandidates.Count > 0, $"male 후보가 없습니다 ({lastName}).");
        Assert.True(femaleCandidates.Count > 0, $"female 후보가 없습니다 ({lastName}).");

        var maleNames = maleCandidates.Select(c => c.Name).ToHashSet();
        var femaleNames = femaleCandidates.Select(c => c.Name).ToHashSet();

        var totalUnique = maleNames.Union(femaleNames).Count();
        var intersection = maleNames.Intersect(femaleNames).Count();
        var differenceRatio = 1.0 - ((double)intersection / totalUnique);

        Assert.True(differenceRatio >= 0.30,
            $"성씨 '{lastName}': male과 female 결과의 차이가 {differenceRatio:P0}로 30% 미만입니다. " +
            $"(male={maleNames.Count}, female={femaleNames.Count}, 겹침={intersection})");
    }

    [Theory]
    [InlineData("김")]
    [InlineData("최")]
    public async Task GenerateCandidates_SoftVsStrong_ResultsDiffer20Percent(string lastName)
    {
        var softCandidates = await _engine.GenerateCandidatesAsync(lastName, "none", "soft", "pure-korean", 20);
        var strongCandidates = await _engine.GenerateCandidatesAsync(lastName, "none", "strong", "pure-korean", 20);

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

    // ── 2026-04-21 옵션 B (B-1 패턴 이식) 회귀 테스트 ──────────────────────

    /// <summary>
    /// Step 2/3 회귀: 같은 입력은 같은 결과를 내야 한다.
    /// 이전에는 OrderBy(Guid.NewGuid()) + Random 때문에 비결정론.
    /// </summary>
    [Theory]
    [InlineData("허", "female", "soft", "hanja")]
    [InlineData("박", "male", "strong", "hanja")]
    [InlineData("이", "none", "neutral", "mixed")]
    [InlineData("김", "female", "soft", "pure-korean")]
    public async Task GenerateCandidates_IsDeterministic_SameInputSameOutput(
        string lastName, string gender, string tone, string nameType)
    {
        var r1 = await _engine.GenerateCandidatesAsync(lastName, gender, tone, nameType, 20);
        var r2 = await _engine.GenerateCandidatesAsync(lastName, gender, tone, nameType, 20);

        Assert.Equal(r1.Count, r2.Count);
        var names1 = r1.Select(c => c.Name).ToList();
        var names2 = r2.Select(c => c.Name).ToList();
        Assert.Equal(names1, names2);
    }

    /// <summary>
    /// Step 2 회귀: hanja 모드에서 '생성된'(큐레이션이 아닌) 후보는 Core_v1 한자로 구성되어야 한다.
    /// 큐레이션 hanja 엔트리는 Components에 한글 단음절만 저장되므로(BuildCuratedComponents)
    /// '(' 문자가 포함된 항목만 생성형으로 간주한다.
    /// </summary>
    [Fact]
    public async Task GenerateCandidates_Hanja_GeneratedCandidatesUseCoreDatasetReadings()
    {
        // count=50으로 큐레이션(hanja 20여 개) 넘어 생성형까지 포함되도록 요청
        var candidates = await _engine.GenerateCandidatesAsync("이", "none", "neutral", "hanja", 50);

        // "字(음)" 포맷 (괄호 포함)만 생성형으로 판별
        var generated = candidates
            .Where(c => c.Components.Any(x => x.Contains('(')))
            .ToList();

        Assert.True(generated.Count >= 5,
            $"hanja 모드에서 최소 5개 생성형 후보가 있어야 합니다. 실제: {generated.Count}");

        var coreChars = NameForm.Application.Engines.Data.HanjaData.HanjaDictionary.Values
            .Where(h => h.Source == "Core_v1" && !string.IsNullOrEmpty(h.Reading) && h.Reading.Length == 1)
            .Select(h => h.Character)
            .ToHashSet();

        // 생성형 후보 중 Core_v1 한자를 '모두' 사용한 것의 비율이 60% 이상
        int coreOnlyCount = 0;
        foreach (var c in generated.Take(20))
        {
            var allCore = c.Components.All(comp =>
            {
                if (string.IsNullOrEmpty(comp) || !comp.Contains('(')) return false;
                var ch = comp[0].ToString();
                return coreChars.Contains(ch);
            });
            if (allCore) coreOnlyCount++;
        }

        var sampleSize = Math.Min(generated.Count, 20);
        var ratio = (double)coreOnlyCount / sampleSize;
        Assert.True(ratio >= 0.6,
            $"생성형 hanja 후보 중 전부-Core_v1 비율 {ratio:P0} (60% 이상 기대, {coreOnlyCount}/{sampleSize}).");
    }

    /// <summary>
    /// Step 3 회귀: 큐레이션이 상위 슬롯을 독점해야 한다 (pure-korean, 허 + female/soft).
    /// 기계적 prefix+suffix 조합은 PureKoreanFallbackPenalty(-15)에 밀려 Top 5에서 제외되어야 함.
    /// </summary>
    [Fact]
    public async Task GenerateCandidates_Heo_PureKorean_TopSlotsAreAllCurated()
    {
        var candidates = await _engine.GenerateCandidatesAsync("허", "female", "soft", "pure-korean", 20);

        var curatedSet = NameForm.Application.Engines.Data.ThreeSyllableCuratedLoader.Entries
            .Where(e => e.NameType == "pure-korean")
            .Select(e => e.Name)
            .ToHashSet();

        var topFive = candidates.Take(5).Select(c => c.Name).ToList();
        var curatedHits = topFive.Count(n => curatedSet.Contains(n));

        Assert.Equal(5, curatedHits);
    }

    // ── 옵션 C Phase 2 회귀: 음운 하드필터 + 특성 노트 ─────────────────────
    // 설계 철학: 존재 불가 이름(박가/밥보/맛다)만 차단, 트렌드/흔한 이름은 통과.
    // 특성은 감점 없이 노출만.

    /// <summary>
    /// Phase 2 회귀: 어떤 조건에서도 하드필터 이름(박X가/박X밥보 류)이 반환되지 않아야 한다.
    /// ㄱ+ㄱ / ㅂ+ㅂ / ㄷ+ㄷ 동일자음 중복이 있으면 KoreanUtils.IsPhonologicallyBlocked true.
    /// </summary>
    [Theory]
    [InlineData("박", "none", "neutral", "pure-korean")]
    [InlineData("박", "male", "strong", "hanja")]
    [InlineData("박", "female", "soft", "mixed")]
    [InlineData("김", "none", "neutral", "hanja")]
    public async Task GenerateCandidates_NeverReturnsPhonologicallyBlockedNames(
        string lastName, string gender, string tone, string nameType)
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            lastName, gender, tone, nameType, 30);

        foreach (var c in candidates)
        {
            Assert.False(
                NameForm.Application.Engines.Utils.KoreanUtils.IsPhonologicallyBlocked(c.FullName),
                $"'{c.FullName}'은 하드필터에 걸려야 하는데 통과됨.");
        }
    }

    /// <summary>
    /// Phase 2 회귀: 박 성씨는 흔한 이름(박지훈/박서준/박수빈 류)이 여전히 생성되어야 한다.
    /// 경음화/비음화/격음화는 하드필터 대상이 아님 — 차단 시 하이브리드 설계 위반.
    /// </summary>
    [Fact]
    public async Task GenerateCandidates_Park_HanjaStillProducesCommonNames()
    {
        var candidates = await _engine.GenerateCandidatesAsync("박", "male", "strong", "hanja", 30);

        // 최소 10개 이상은 생성되어야 — 과도한 필터링 방지
        Assert.True(candidates.Count >= 10,
            $"박 성씨 한자 후보 {candidates.Count}개. 과도 필터링 의심.");
    }

    /// <summary>
    /// Phase 2 회귀: PhonologyNotes 필드가 정상 부착된다 (빈 리스트 or 내용 있음).
    /// null 이 아니어야 함. 내용은 이름에 따라 달라지므로 존재 여부만 확인.
    /// </summary>
    [Fact]
    public async Task GenerateCandidates_AllResults_HavePhonologyNotesField()
    {
        var candidates = await _engine.GenerateCandidatesAsync("이", "none", "neutral", "pure-korean", 10);

        Assert.All(candidates, c =>
        {
            Assert.NotNull(c.PhonologyNotes);
        });
    }

    // ── 옵션 C Phase 3 회귀: MorphemeAnalyzer 연결 ───────────────────────
    // ThreeSyllableEngine이 MorphemeAnalyzer.DetectNegativePatterns를 타서
    // "허하X", "박하X", "이기X" 등 성명조합_부정연상을 사전 필터링해야 한다.

    /// <summary>
    /// Phase 3 회귀: 어떤 조건에서도 성명조합_부정연상 이름이 반환되지 않아야 한다.
    /// "허" 성씨라면 "허하*", "허약*", "허접*", "허술*", "허전*" 류 모두 제외.
    /// </summary>
    [Theory]
    [InlineData("허", "female", "soft", "pure-korean")]
    [InlineData("허", "male", "strong", "hanja")]
    [InlineData("허", "none", "neutral", "mixed")]
    [InlineData("박", "none", "neutral", "hanja")]
    public async Task GenerateCandidates_NeverReturnsSurnameNameNegativeAssociation(
        string lastName, string gender, string tone, string nameType)
    {
        var candidates = await _engine.GenerateCandidatesAsync(
            lastName, gender, tone, nameType, 30);

        foreach (var c in candidates)
        {
            var patterns = NameForm.Application.Engines.Utils.MorphemeAnalyzer
                .DetectNegativePatterns(c.FullName);
            var surnameNegative = patterns
                .FirstOrDefault(p => p.StartsWith("성명조합_부정연상:"));

            Assert.Null(surnameNegative);
        }
    }

    /// <summary>
    /// Phase 3 회귀: MorphemeAnalyzer 필터가 과도하지 않아야 한다.
    /// "허" 성씨 + female/soft에서 최소 10개 이상 후보가 나와야 함 (과잉 배제 방지).
    /// </summary>
    [Fact]
    public async Task GenerateCandidates_Heo_MorphemeFilter_StillProducesEnoughCandidates()
    {
        var candidates = await _engine.GenerateCandidatesAsync("허", "female", "soft", "pure-korean", 30);

        Assert.True(candidates.Count >= 10,
            $"허 성씨 pure-korean 후보 {candidates.Count}개. 형태소 필터가 과도 배제 의심.");
    }

    /// <summary>
    /// Phase 3 회귀: MorphemeAnalyzer 직접 호출로 차단 대상 패턴 확인.
    /// 생성 결과가 아닌 필터 자체의 의미론 확인.
    /// </summary>
    [Theory]
    [InlineData("허하나", true)]    // 허하다 연상
    [InlineData("허약한", true)]    // 허약하다 연상
    [InlineData("박하영", true)]    // 박하다 연상
    [InlineData("허지윤", false)]   // 흔한 이름, 통과
    [InlineData("허가온", false)]   // 큐레이션형, 통과
    [InlineData("박지훈", false)]   // 흔한 이름, 통과
    public void MorphemeAnalyzer_SurnameNegativeAssociation_BehavesAsExpected(string fullName, bool shouldDetect)
    {
        var patterns = NameForm.Application.Engines.Utils.MorphemeAnalyzer
            .DetectNegativePatterns(fullName);
        var hasAssociation = patterns.Any(p => p.StartsWith("성명조합_부정연상:"));

        Assert.Equal(shouldDetect, hasAssociation);
    }
}
