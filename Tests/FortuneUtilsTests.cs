using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// FortuneUtils 유틸리티 단위 테스트
/// </summary>
public class FortuneUtilsTests
{
    // ===== GetGanZhi =====

    [Fact]
    public void GetGanZhi_1990_ReturnsCorrectStemAndBranch()
    {
        var (stem, branch) = FortuneUtils.GetGanZhi(new DateTime(1990, 3, 21));
        // (1990 - 4) % 10 = 1986 % 10 = 6 → 庚
        // (1990 - 4) % 12 = 1986 % 12 = 6 → 午
        Assert.Equal("庚", stem);
        Assert.Equal("午", branch);
    }

    [Fact]
    public void GetGanZhi_2000_ReturnsCorrectStemAndBranch()
    {
        var (stem, branch) = FortuneUtils.GetGanZhi(new DateTime(2000, 1, 1));
        // (2000 - 4) % 10 = 1996 % 10 = 6 → 庚
        // (2000 - 4) % 12 = 1996 % 12 = 4 → 辰
        Assert.Equal("庚", stem);
        Assert.Equal("辰", branch);
    }

    [Fact]
    public void GetGanZhi_2024_ReturnsCorrectStemAndBranch()
    {
        var (stem, branch) = FortuneUtils.GetGanZhi(new DateTime(2024, 6, 15));
        // (2024 - 4) % 10 = 2020 % 10 = 0 → 甲
        // (2024 - 4) % 12 = 2020 % 12 = 4 → 辰
        Assert.Equal("甲", stem);
        Assert.Equal("辰", branch);
    }

    // ===== CalculateFiveElements =====

    [Fact]
    public void CalculateFiveElements_ReturnsAllFiveKeys()
    {
        var elements = FortuneUtils.CalculateFiveElements(new DateTime(1990, 3, 21));
        Assert.Contains("木", elements.Keys);
        Assert.Contains("火", elements.Keys);
        Assert.Contains("土", elements.Keys);
        Assert.Contains("金", elements.Keys);
        Assert.Contains("水", elements.Keys);
    }

    [Fact]
    public void CalculateFiveElements_1990_HasGoldAndFire()
    {
        // 1990 = 庚午 → 庚=金, 午=火
        var elements = FortuneUtils.CalculateFiveElements(new DateTime(1990, 3, 21));
        Assert.Equal(1, elements["金"]); // 庚 → 金
        Assert.Equal(1, elements["火"]); // 午 → 火
        Assert.Equal(0, elements["木"]);
        Assert.Equal(0, elements["土"]);
        Assert.Equal(0, elements["水"]);
    }

    // ===== FindLackingElements =====

    [Fact]
    public void FindLackingElements_1990_ReturnsElementsBelow0()
    {
        // 1990 = 庚午 → 金1, 火1, 나머지 0
        var lacking = FortuneUtils.FindLackingElements(new DateTime(1990, 3, 21));
        // 평균 = (0+1+0+1+0)/5 = 0.4
        // 0 < 0.4인 것들: 木, 土, 水
        Assert.Contains("木", lacking);
        Assert.Contains("土", lacking);
        Assert.Contains("水", lacking);
        Assert.DoesNotContain("金", lacking);
        Assert.DoesNotContain("火", lacking);
    }

    // ===== FindExcessiveElements =====

    [Fact]
    public void FindExcessiveElements_1990_ReturnsElementsAboveThreshold()
    {
        // 평균 0.4, threshold = 0.4 * 1.5 = 0.6
        // 金=1, 火=1 둘 다 > 0.6
        var excessive = FortuneUtils.FindExcessiveElements(new DateTime(1990, 3, 21));
        Assert.Contains("金", excessive);
        Assert.Contains("火", excessive);
    }

    // ===== EvaluateStrokeCount =====

    [Theory]
    [InlineData(3, 2, 100)]   // total=5, 좋은 범위
    [InlineData(7, 8, 100)]   // total=15, 좋은 범위
    [InlineData(8, 8, 80)]    // total=16, 중간 범위
    [InlineData(12, 13, 80)]  // total=25, 중간 범위
    [InlineData(13, 13, 60)]  // total=26, 높은 범위
    [InlineData(18, 18, 40)]  // total=36, 높은 범위
    public void EvaluateStrokeCount_ReturnsExpectedScore(int s1, int s2, int expected)
    {
        Assert.Equal(expected, FortuneUtils.EvaluateStrokeCount(s1, s2));
    }

    [Theory]
    [InlineData(2, 2, 30)]    // total=4, 불길
    [InlineData(5, 4, 30)]    // total=9, 불길
    [InlineData(7, 7, 30)]    // total=14, 불길
    [InlineData(10, 9, 30)]   // total=19, 불길
    public void EvaluateStrokeCount_BadStrokes_Returns30(int s1, int s2, int expected)
    {
        Assert.Equal(expected, FortuneUtils.EvaluateStrokeCount(s1, s2));
    }

    // ===== EvaluateYinYangBalance =====

    [Fact]
    public void EvaluateYinYangBalance_Perfect_Returns100()
    {
        // 50:50 균형
        Assert.Equal(100, FortuneUtils.EvaluateYinYangBalance(5, 5));
    }

    [Fact]
    public void EvaluateYinYangBalance_SlightlyOff_Returns100()
    {
        // 40:60 범위 내
        Assert.Equal(100, FortuneUtils.EvaluateYinYangBalance(4, 6));
    }

    [Fact]
    public void EvaluateYinYangBalance_ModeratelyOff_Returns80()
    {
        // 30:70 범위
        Assert.Equal(80, FortuneUtils.EvaluateYinYangBalance(3, 7));
    }

    [Fact]
    public void EvaluateYinYangBalance_VeryOff_Returns50()
    {
        // 10:90 범위
        Assert.Equal(50, FortuneUtils.EvaluateYinYangBalance(1, 9));
    }

    [Fact]
    public void EvaluateYinYangBalance_Zero_Returns50()
    {
        Assert.Equal(50, FortuneUtils.EvaluateYinYangBalance(0, 0));
    }
}
