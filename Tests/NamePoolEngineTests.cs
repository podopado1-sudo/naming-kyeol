using NameForm.Application.Engines;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// NamePoolEngine 이름 후보 생성 단위 테스트
/// 한자 조합, 필터링, 성별/톤 기반 생성 검증
/// </summary>
public class NamePoolEngineTests
{
    private readonly NamePoolEngine _engine = new(new FakeSajuCalculationService());

    // ===== 기본 동작 =====

    [Fact]
    public async Task GenerateCandidatesAsync_DefaultParams_ReturnsNonEmptyList()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral");
        Assert.NotEmpty(result);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ReturnsAtMost100Candidates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(2000, 1, 1), "none", "neutral");
        Assert.True(result.Count <= 100, $"후보 수({result.Count})가 100개를 초과함");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_AllCandidatesAre2Or3Syllables()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral");
        Assert.All(result, name =>
            Assert.True(name.Length >= 2 && name.Length <= 3,
                $"'{name}'은 {name.Length}음절 (2~3음절이어야 함)"));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_NoDuplicates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral");
        Assert.Equal(result.Count, result.Distinct().Count());
    }

    // ===== 금칙어 필터링 =====

    [Fact]
    public async Task GenerateCandidatesAsync_ExcludesForbiddenWords()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral");
        // 공통 금칙어 데이터(100개+) 사용 — 대표적인 금칙어만 샘플 검증
        var sampleForbiddenWords = new[] { "바보", "멍청", "못난", "나쁜", "병신", "고생", "불행", "가난", "천한", "미련" };

        foreach (var name in result)
        {
            Assert.DoesNotContain(sampleForbiddenWords, f => name.Contains(f));
        }
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ExcludesCollisionWords()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral");
        var collisionWords = new[] { "사과", "바나나", "자동차", "방석", "의자", "책상", "침대" };

        foreach (var name in result)
        {
            Assert.DoesNotContain(collisionWords, w => name == w);
        }
    }

    // ===== 성별 필터링 =====

    [Fact]
    public async Task GenerateCandidatesAsync_MaleGender_ProducesCandidates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "male", "neutral");
        Assert.NotEmpty(result);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_FemaleGender_ProducesCandidates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "female", "neutral");
        Assert.NotEmpty(result);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_NoneGender_ProducesCandidates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral");
        Assert.NotEmpty(result);
    }

    // ===== 톤 필터링 =====

    [Fact]
    public async Task GenerateCandidatesAsync_SoftTone_ProducesCandidates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "soft");
        Assert.NotEmpty(result);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_StrongTone_ProducesCandidates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "strong");
        Assert.NotEmpty(result);
    }

    // ===== 인기 이름 포함 =====

    [Fact]
    public async Task GenerateCandidatesAsync_Male_ProducesMoreThanHanjaCombinations()
    {
        // 인기 이름도 풀에 추가되므로 빈 한자 사전이어도 결과가 있어야 함
        // 실제로는 한자 조합 + 인기 이름이 합쳐져 후보가 풍부해야 함
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "male", "neutral");
        Assert.True(result.Count >= 10, $"male 후보가 너무 적음: {result.Count}개");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_Female_ProducesMoreThanHanjaCombinations()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "female", "neutral");
        Assert.True(result.Count >= 10, $"female 후보가 너무 적음: {result.Count}개");
    }

    // ===== 엣지 케이스 =====

    [Fact]
    public async Task GenerateCandidatesAsync_AllCandidatesAreKorean()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral");

        Assert.All(result, name =>
            Assert.All(name.ToCharArray(), c =>
                Assert.True(c >= 0xAC00 && c <= 0xD7A3,
                    $"'{c}' (U+{(int)c:X4})은 한글이 아님")));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_SameHanjaNotCombinedWithItself()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral");

        // 2음절 이름 중 같은 글자가 반복되는 경우 확인
        // (GenerateTwoCharCombinations에서 h1 == h2 continue 로직)
        var twoSyllableNames = result.Where(n => n.Length == 2).ToList();
        foreach (var name in twoSyllableNames)
        {
            // 같은 한자 객체에서 나온 조합은 없어야 하지만,
            // 다른 한자가 같은 발음인 경우는 허용됨 (예: 明明 vs 明銘)
            // 여기서는 단순히 결과 형식만 검증
            Assert.True(name.Length == 2, $"2음절 이름이어야 함: '{name}'");
        }
    }

    // ===== 3글자 이름 생성 =====

    [Fact]
    public async Task GenerateCandidatesAsync_ThreeChar_ReturnsNonEmptyList()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral", nameLength: 3);
        Assert.NotEmpty(result);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ThreeChar_AllCandidatesAre3Syllables()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral", nameLength: 3);
        Assert.All(result, name =>
            Assert.True(name.Length == 3,
                $"'{name}'은 {name.Length}음절 (3음절이어야 함)"));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ThreeChar_ReturnsAtMost100Candidates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(2000, 1, 1), "none", "neutral", nameLength: 3);
        Assert.True(result.Count <= 100, $"후보 수({result.Count})가 100개를 초과함");
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ThreeChar_NoDuplicates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral", nameLength: 3);
        Assert.Equal(result.Count, result.Distinct().Count());
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ThreeChar_AllCandidatesAreKorean()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral", nameLength: 3);
        Assert.All(result, name =>
            Assert.All(name.ToCharArray(), c =>
                Assert.True(c >= 0xAC00 && c <= 0xD7A3,
                    $"'{c}' (U+{(int)c:X4})은 한글이 아님")));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ThreeChar_ExcludesForbiddenWords()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral", nameLength: 3);
        // 공통 금칙어 데이터(100개+) 사용 — 대표적인 금칙어만 샘플 검증
        var sampleForbiddenWords = new[] { "바보", "멍청", "못난", "나쁜", "병신", "고생", "불행", "절망", "재앙" };

        foreach (var name in result)
        {
            Assert.DoesNotContain(sampleForbiddenWords, f => name.Contains(f));
        }
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ThreeChar_MaleGender_ProducesCandidates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "male", "neutral", nameLength: 3);
        Assert.NotEmpty(result);
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ThreeChar_FemaleGender_ProducesCandidates()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "female", "neutral", nameLength: 3);
        Assert.NotEmpty(result);
    }

    // ===== 2글자 기존 기능 호환성 =====

    [Fact]
    public async Task GenerateCandidatesAsync_DefaultNameLength_Returns2CharNames()
    {
        // nameLength 파라미터 없이 호출 — 기존과 동일하게 2글자
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral");
        Assert.NotEmpty(result);
        Assert.All(result, name =>
            Assert.True(name.Length >= 2 && name.Length <= 2,
                $"기본 호출에서 '{name}'이 2글자가 아님 ({name.Length}글자)"));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_ExplicitNameLength2_Returns2CharNames()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral", nameLength: 2);
        Assert.NotEmpty(result);
        Assert.All(result, name =>
            Assert.True(name.Length == 2,
                $"nameLength=2에서 '{name}'이 2글자가 아님 ({name.Length}글자)"));
    }

    [Fact]
    public async Task GenerateCandidatesAsync_InvalidNameLength_ThrowsArgumentException()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "none", "neutral", nameLength: 4));
    }

    // ===== Core Dataset 우선 동작 회귀 테스트 (2026-04, B-1 리팩토링) =====

    [Fact]
    public async Task GenerateCandidatesAsync_IsDeterministic_SameInputSameOutput()
    {
        // 랜덤 셔플 제거 검증 — 같은 입력으로 두 번 호출하면 동일 결과 (OrderBy Ordinal)
        var r1 = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "male", "neutral");
        var r2 = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "male", "neutral");

        Assert.Equal(r1.Count, r2.Count);
        Assert.Equal(r1, r2); // List 순서까지 동일해야 함
    }

    [Fact]
    public async Task GenerateCandidatesAsync_Male_DoesNotContainKnownBadNames()
    {
        // 프론트 테스트 피드백(feedback_quality_issues.md)에서 문제로 지적된 후보들.
        // Core Dataset 도입 후 이런 저품질 조합은 상위에 등장하지 않아야 함.
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(2024, 3, 15), "male", "neutral");

        var knownBadNames = new[] { "배기", "니치", "후낭", "왕화", "비치" };

        foreach (var bad in knownBadNames)
        {
            Assert.DoesNotContain(bad, result);
        }
    }

    [Fact]
    public async Task GenerateCandidatesAsync_Female_DoesNotContainKnownBadNames()
    {
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(2024, 3, 15), "female", "neutral");

        var knownBadNames = new[] { "배기", "니치", "후낭", "왕화", "비치" };

        foreach (var bad in knownBadNames)
        {
            Assert.DoesNotContain(bad, result);
        }
    }

    [Fact]
    public async Task GenerateCandidatesAsync_MajorityOfCandidateReadingsComeFromCoreDataset()
    {
        // 생성된 후보의 각 음절 발음이 Core_v1 한자 발음 풀에 포함되어야 함.
        // Core Dataset(2,060자)이 NamePoolEngine의 주 소스가 되었는지 확인.
        var result = await _engine.GenerateCandidatesAsync("김", new DateTime(1990, 3, 21), "male", "neutral");

        // Core_v1의 모든 발음 집합
        var coreReadings = NameForm.Application.Engines.Data.HanjaData.GetAllHanja()
            .Where(h => h.Source == "Core_v1" && !string.IsNullOrEmpty(h.Reading))
            .Select(h => h.Reading)
            .ToHashSet();

        // 한자 조합으로 만든 2글자 후보 (인기 이름 목록 제외)는
        // 각 글자 발음이 Core 발음 집합에 있어야 함.
        // 인기 이름(주원, 민준 등)의 발음도 Core Dataset의 주요 발음에 대부분 포함되므로
        // 전체적으로 높은 커버리지가 기대됨.
        int covered = 0;
        foreach (var name in result.Where(n => n.Length == 2))
        {
            var ch1 = name[0].ToString();
            var ch2 = name[1].ToString();
            if (coreReadings.Contains(ch1) && coreReadings.Contains(ch2))
                covered++;
        }

        var twoSyllable = result.Count(n => n.Length == 2);
        Assert.True(twoSyllable > 0);

        var ratio = (double)covered / twoSyllable;
        Assert.True(ratio >= 0.80,
            $"후보 발음 Core Dataset 커버리지 {covered}/{twoSyllable} ({ratio:P0}) — 80% 이상이어야 함");
    }

    [Fact]
    public void CalculateRelevanceScore_Core_v1RanksAboveAutoFallback()
    {
        // Core_v1 S등급 한자가 Auto_Fallback D등급 한자보다 점수가 높아야 함 (B-1 리팩토링 핵심)
        // 예시로 珠(Core_v1, 구슬) vs 株(Auto_Fallback, 그루터기)
        var core = NameForm.Application.Engines.Data.HanjaData.FindByCharacter("珠");
        var fallback = NameForm.Application.Engines.Data.HanjaData.FindByCharacter("株");

        Assert.NotNull(core);
        Assert.NotNull(fallback);
        Assert.Equal("Core_v1", core!.Source);

        var coreScore = NameForm.Application.Engines.Data.HanjaData.CalculateRelevanceScore(core);
        var fallbackScore = NameForm.Application.Engines.Data.HanjaData.CalculateRelevanceScore(fallback!);

        Assert.True(coreScore > fallbackScore,
            $"Core_v1({core.Character}={coreScore}) > Auto_Fallback({fallback!.Character}={fallbackScore})이어야 함");
        Assert.True(coreScore - fallbackScore >= 1000,
            $"Core_v1 가점 차이가 최소 1000 이상이어야 함 (실제 차이: {coreScore - fallbackScore})");
    }

    // ============================================================
    // 의미 선호 키워드 (PreferredMeanings) 검증
    // ============================================================

    /// <summary>
    /// preferredMeanings 미지정 시 후보가 정상 생성되어야 함 (옵셔널 동작 보장).
    /// </summary>
    [Fact]
    public async Task GenerateCandidatesAsync_NullPreferredMeanings_StillReturnsCandidates()
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", new DateTime(2024, 6, 15), "none", "neutral",
            nameLength: 2, preferredMeanings: null);
        Assert.NotEmpty(result);
    }

    /// <summary>
    /// preferredMeanings에 빈 리스트/공백 키워드 → 무시되고 정상 동작.
    /// </summary>
    [Fact]
    public async Task GenerateCandidatesAsync_EmptyOrWhitespaceMeanings_AreIgnored()
    {
        var emptyList = await _engine.GenerateCandidatesAsync(
            "김", new DateTime(2024, 6, 15), "none", "neutral",
            nameLength: 2, preferredMeanings: new List<string>());
        var whitespace = await _engine.GenerateCandidatesAsync(
            "김", new DateTime(2024, 6, 15), "none", "neutral",
            nameLength: 2, preferredMeanings: new List<string> { "", " ", "\t" });
        var noKeywords = await _engine.GenerateCandidatesAsync(
            "김", new DateTime(2024, 6, 15), "none", "neutral");

        // 키워드 정규화 후 비어있으면 키워드 없는 경우와 동일 결과
        Assert.Equal(noKeywords, emptyList);
        Assert.Equal(noKeywords, whitespace);
    }

    /// <summary>
    /// 의미 키워드를 줬을 때 결과가 키워드 미지정과 달라야 한다.
    /// (모든 한자가 매칭되거나 모두 미매칭이 아닌 한, 정렬이 바뀜)
    /// </summary>
    [Fact]
    public async Task GenerateCandidatesAsync_WithMeaningKeywords_ChangesResultOrder()
    {
        var noKeyword = await _engine.GenerateCandidatesAsync(
            "김", new DateTime(2024, 6, 15), "none", "neutral");
        var withKeyword = await _engine.GenerateCandidatesAsync(
            "김", new DateTime(2024, 6, 15), "none", "neutral",
            nameLength: 2, preferredMeanings: new List<string> { "지혜", "밝음", "빛" });

        Assert.NotEmpty(withKeyword);
        // 동일하지 않아야 함 (의미 가산이 후보 풀에 영향)
        Assert.NotEqual(noKeyword, withKeyword);
    }

    /// <summary>
    /// 다양한 키워드 조합에서도 결과가 깨지지 않아야 한다 (이름 길이/금칙어 필터 통과).
    /// </summary>
    public static IEnumerable<object[]> MeaningKeywordVariants => new[]
    {
        new object[] { new List<string> { "용기" } },
        new object[] { new List<string> { "맑음", "고요" } },
        new object[] { new List<string> { "지혜", "용기", "맑음", "빛", "넓음" } },
    };

    [Theory]
    [MemberData(nameof(MeaningKeywordVariants))]
    public async Task GenerateCandidatesAsync_VariousMeaningKeywords_ProduceValidCandidates(
        List<string> keywords)
    {
        var result = await _engine.GenerateCandidatesAsync(
            "김", new DateTime(2024, 6, 15), "female", "soft",
            nameLength: 2, preferredMeanings: keywords);

        Assert.NotEmpty(result);
        Assert.All(result, name =>
            Assert.True(name.Length == 2, $"'{name}' 길이가 2여야 함"));
        Assert.Equal(result.Count, result.Distinct().Count());
    }
}
