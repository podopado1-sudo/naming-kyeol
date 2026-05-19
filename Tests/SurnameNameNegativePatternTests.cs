using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 성씨+이름 조합 부정적 단어 연상 패턴 테스트
/// 예: 허하나→허하다, 박하나→박하다
/// </summary>
public class SurnameNameNegativePatternTests
{
    [Theory]
    [InlineData("허하나", "성명조합_부정연상:허하다")]   // 허+하나 → 허하다
    [InlineData("박하나", "성명조합_부정연상:박하다")]   // 박+하나 → 박하다
    [InlineData("이상한", "성명조합_부정연상:이상하다")] // 이+상한 → 이상하다
    [InlineData("추하영", "성명조합_부정연상:추하다")]   // 추+하영 → 추하다
    [InlineData("한심이", "성명조합_부정연상:한심하다")] // 한+심이 → 한심하다
    public void DetectNegativePatterns_SurnameNameCombo_ShouldDetect(string fullName, string expectedPattern)
    {
        var patterns = MorphemeAnalyzer.DetectNegativePatterns(fullName);
        Assert.Contains(patterns, p => p == expectedPattern);
    }

    [Theory]
    [InlineData("허주원")]   // 허+주원 → 부정적 조합 없음
    [InlineData("허정하")]   // 허+정하 → 부정적 조합 없음
    [InlineData("박서윤")]   // 박+서윤 → 부정적 조합 없음
    [InlineData("이도현")]   // 이+도현 → 부정적 조합 없음
    [InlineData("김서윤")]   // 김+서윤 → 부정적 조합 없음
    public void DetectNegativePatterns_SafeNames_ShouldNotDetect(string fullName)
    {
        var patterns = MorphemeAnalyzer.DetectNegativePatterns(fullName);
        Assert.DoesNotContain(patterns, p => p.StartsWith("성명조합_부정연상"));
    }

    [Fact]
    public void DetectNegativePatterns_허하나_ShouldHaveHighPenalty()
    {
        var patterns = MorphemeAnalyzer.DetectNegativePatterns("허하나");

        // 최소 1개의 부정 패턴이 감지되어야 함
        Assert.NotEmpty(patterns);
        Assert.Contains(patterns, p => p.Contains("허하다"));
    }

    [Fact]
    public void DetectNegativePatterns_박하나_ShouldHaveHighPenalty()
    {
        var patterns = MorphemeAnalyzer.DetectNegativePatterns("박하나");

        Assert.NotEmpty(patterns);
        Assert.Contains(patterns, p => p.Contains("박하다"));
    }

    // ============================================================
    // 확장 패턴 v2.0 — 음절 단위 부정 발음 검증
    // ============================================================

    /// <summary>
    /// 테스트 시작 시 캐시를 명시적으로 무효화 — 다른 테스트가 먼저 로드한 데이터에 의존하지 않음.
    /// </summary>
    private static NegativePatternLoader.NegativePatternData FreshlyLoadedData()
    {
        NegativePatternLoader.ResetCache();
        return NegativePatternLoader.Data;
    }

    /// <summary>
    /// 새로 추가된 high_penalty 음절(흉/망/죽/악/병)이 로드돼야 한다.
    /// </summary>
    [Theory]
    [InlineData("흉")]
    [InlineData("망")]
    [InlineData("죽")]
    [InlineData("악")]
    [InlineData("병")]
    public void NegativePatternLoader_NewHighPenaltySyllables_AreLoaded(string syllable)
    {
        var data = FreshlyLoadedData();
        Assert.Contains(syllable, data.HighPenaltySyllables);
    }

    /// <summary>
    /// 새로 추가된 동음이의 부정 의미(망/흉/죽/악/병/곤 등)가 로드돼야 한다.
    /// </summary>
    [Theory]
    [InlineData("망")]
    [InlineData("흉")]
    [InlineData("죽")]
    [InlineData("악")]
    [InlineData("병")]
    [InlineData("곤")]
    public void NegativePatternLoader_NewHomophonePatterns_AreLoaded(string sound)
    {
        var data = FreshlyLoadedData();
        Assert.Contains(data.HomophoneNegative, p => p.Sound == sound);
    }

    /// <summary>
    /// high_penalty 음절 목록에서 중복이 없어야 한다 (이전 데이터 정리 검증).
    /// </summary>
    [Fact]
    public void NegativePatternLoader_HighPenaltySyllables_NoDuplicates()
    {
        var data = FreshlyLoadedData();
        // HashSet이므로 중복 자체가 불가능하지만, 의미 있는 음절이 충분히 있는지
        Assert.True(data.HighPenaltySyllables.Count >= 20,
            $"high_penalty 음절은 20개 이상이어야 함 (실제: {data.HighPenaltySyllables.Count})");
    }

    /// <summary>
    /// 새로 추가된 부정 동사(망하다/죽다/흉하다 등)가 로드돼야 한다.
    /// </summary>
    [Theory]
    [InlineData("망하다")]
    [InlineData("죽다")]
    [InlineData("흉하다")]
    [InlineData("악하다")]
    [InlineData("병들다")]
    [InlineData("곤하다")]
    public void NegativePatternLoader_NewNegativeVerbs_AreLoaded(string verb)
    {
        var data = FreshlyLoadedData();
        Assert.Contains(verb, data.NegativeVerbsAndAdjectives);
    }
}
