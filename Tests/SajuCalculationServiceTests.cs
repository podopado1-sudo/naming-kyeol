using NameForm.Application.Services;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// SajuCalculationService — 사주 4기둥 계산 단위 테스트.
///
/// CLAUDE.md 메모리(project_current_status.md)의 검증 기준:
/// 1985-06-05 13:01 서울 → 일주 乙亥, 시주 壬午 (만세력 레퍼런스 일치)
/// </summary>
public class SajuCalculationServiceTests
{
    private readonly SajuCalculationService _service = new();

    // ============================================================
    // 골든 케이스 — 만세력 레퍼런스
    // ============================================================

    /// <summary>
    /// 1985-06-05 13:01 서울 (출생) → 일주 乙亥, 시주 壬午.
    /// CLAUDE.md / project_current_status.md에 문서화된 검증 기준.
    /// </summary>
    [Fact]
    public void CalculateChart_KnownGoldenCase_DayAndHourMatchReference()
    {
        var birthDate = new DateTime(1985, 6, 5);
        var birthTime = new TimeSpan(13, 1, 0);
        var chart = _service.CalculateChart(birthDate, birthTime, birthplaceCode: null);

        // 일주: 乙亥 (을해)
        Assert.Equal("乙", chart.DayPillar.StemChar);
        Assert.Equal("亥", chart.DayPillar.BranchChar);

        // 시주: 壬午 (임오)
        Assert.NotNull(chart.HourPillar);
        Assert.Equal("壬", chart.HourPillar!.StemChar);
        Assert.Equal("午", chart.HourPillar.BranchChar);
    }

    /// <summary>
    /// 진태양시 보정은 경도로 소수 분까지 계산한다(서울 −32.08분) — 화면·설명 글의 '약 32분'은 반올림한 값이다
    /// (2026-11-19 반박 검토: 계산을 반올림 정수 분으로 바꾸지 않고 화면에 '약'을 붙이기로 — 설계 docs/plan-ohaeng-2026-11.md §1-2·§16).
    /// 그래서 시 경계 1분에서는 화면의 '−32분'으로 손계산한 시와 실제 시주가 다르다: 서울 13:32 → 12:59:55 → 午시(반올림 −32분이면 13:00 未시).
    /// 계산을 반올림 정수로 바꾸면 이 테스트가 실패한다 — 그때는 설명 글·결과 화면의 '약'과 이 테스트를 함께 고칠 것.
    /// </summary>
    [Theory]
    [InlineData("seoul", 13, 32, "午")]  // −32.08분 → 12:59:55
    [InlineData("seoul", 13, 33, "未")]  // → 13:00:55
    [InlineData("incheon", 13, 33, "午")] // −33.2분 → 12:59:48
    [InlineData("busan", 13, 23, "午")]  // −23.68분 → 12:59:19
    [InlineData("busan", 13, 24, "未")]  // → 13:00:19
    public void CalculateChart_SolarCorrection_UsesFractionalMinutes_AtHourBoundary(string place, int hh, int mm, string expectedBranch)
    {
        var chart = _service.CalculateChart(new DateTime(2000, 6, 15), new TimeSpan(hh, mm, 0), place);
        Assert.Equal(expectedBranch, chart.HourPillar!.BranchChar);
    }

    // ============================================================
    // 기본 동작 검증
    // ============================================================

    [Fact]
    public void CalculateChart_ReturnsAllPillars()
    {
        var chart = _service.CalculateChart(new DateTime(2024, 6, 15));

        Assert.NotNull(chart.YearPillar);
        Assert.NotNull(chart.MonthPillar);
        Assert.NotNull(chart.DayPillar);
        // birthTime 없으면 HourPillar는 null
        Assert.Null(chart.HourPillar);
    }

    [Fact]
    public void CalculateChart_WithBirthTime_HasHourPillar()
    {
        var chart = _service.CalculateChart(
            new DateTime(2024, 6, 15),
            new TimeSpan(10, 30, 0));

        Assert.NotNull(chart.HourPillar);
        Assert.False(string.IsNullOrEmpty(chart.HourPillar!.StemChar));
        Assert.False(string.IsNullOrEmpty(chart.HourPillar.BranchChar));
    }

    [Fact]
    public void CalculateChart_FiveElementCount_HasAllElements()
    {
        var chart = _service.CalculateChart(new DateTime(2024, 6, 15));

        var validElements = new[] { "木", "火", "土", "金", "水" };
        foreach (var el in validElements)
        {
            Assert.True(chart.FiveElementCount.ContainsKey(el),
                $"오행 '{el}' 분포가 누락됨");
        }

        // 합계는 사주 글자수(6 또는 8)와 일치해야 함
        int total = chart.FiveElementCount.Values.Sum();
        Assert.InRange(total, 6, 8);
    }

    [Fact]
    public void CalculateChart_PillarElementsAreValid()
    {
        var chart = _service.CalculateChart(new DateTime(2024, 6, 15));

        var validElements = new[] { "木", "火", "土", "金", "水" };
        Assert.Contains(chart.YearPillar.FiveElement, validElements);
        Assert.Contains(chart.MonthPillar.FiveElement, validElements);
        Assert.Contains(chart.DayPillar.FiveElement, validElements);
    }

    [Fact]
    public void CalculateChart_PillarYinYangIsValid()
    {
        var chart = _service.CalculateChart(new DateTime(2024, 6, 15));

        var validYinYang = new[] { "陽", "陰" };
        Assert.Contains(chart.YearPillar.YinYang, validYinYang);
        Assert.Contains(chart.MonthPillar.YinYang, validYinYang);
        Assert.Contains(chart.DayPillar.YinYang, validYinYang);
    }

    // ============================================================
    // 결정성 (동일 입력 → 동일 출력)
    // ============================================================

    [Fact]
    public void CalculateChart_SameInput_IsDeterministic()
    {
        var date = new DateTime(2024, 6, 15);
        var time = new TimeSpan(14, 30, 0);

        var c1 = _service.CalculateChart(date, time);
        var c2 = _service.CalculateChart(date, time);

        Assert.Equal(c1.DayPillar.StemChar, c2.DayPillar.StemChar);
        Assert.Equal(c1.DayPillar.BranchChar, c2.DayPillar.BranchChar);
        Assert.Equal(c1.HourPillar!.StemChar, c2.HourPillar!.StemChar);
        Assert.Equal(c1.HourPillar.BranchChar, c2.HourPillar.BranchChar);
    }

    // ============================================================
    // 다양한 입력에서 예외 없음
    // ============================================================

    [Theory]
    [InlineData(1900, 1, 1)]
    [InlineData(1950, 7, 15)]
    [InlineData(2000, 12, 31)]
    [InlineData(2024, 6, 15)]
    [InlineData(2099, 11, 30)]
    public void CalculateChart_VariousDates_NoException(int year, int month, int day)
    {
        var chart = _service.CalculateChart(new DateTime(year, month, day));
        Assert.NotNull(chart);
    }
}
