using NameForm.Application.Services;
using NameForm.Domain.Models.Saju;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// YongshinCalculationService — 용신 계산 단위 테스트.
/// 억부법(身強/身弱) + 조후법(寒暖) 결합 로직 검증.
/// </summary>
public class YongshinCalculationServiceTests
{
    private readonly YongshinCalculationService _service = new();

    /// <summary>
    /// 4기둥 chart 빌더. 모든 기둥에 동일 천간/지지를 채워 간단한 분포 만들기.
    /// </summary>
    private static SajuChart BuildChart(
        string dayStem,         // 일간 천간 (甲乙丙丁戊己庚辛壬癸)
        string monthBranch,     // 월지 지지 (子丑寅...)
        Dictionary<string, int>? elementCount = null)
    {
        var defaultPillar = new SajuPillar("甲", "갑", "子", "자", "木", "陽");
        var dayPillar = new SajuPillar(dayStem, dayStem, "子", "자", GetStemElement(dayStem), "陽");
        var monthPillar = new SajuPillar("甲", "갑", monthBranch, monthBranch, GetBranchElement(monthBranch), "陽");

        return new SajuChart
        {
            YearPillar = defaultPillar,
            MonthPillar = monthPillar,
            DayPillar = dayPillar,
            HourPillar = null,
            FiveElementCount = elementCount ?? new Dictionary<string, int>
            {
                ["木"] = 1, ["火"] = 1, ["土"] = 1, ["金"] = 1, ["水"] = 1
            }
        };
    }

    private static string GetStemElement(string stem) => stem switch
    {
        "甲" or "乙" => "木",
        "丙" or "丁" => "火",
        "戊" or "己" => "土",
        "庚" or "辛" => "金",
        "壬" or "癸" => "水",
        _ => "木"
    };

    private static string GetBranchElement(string branch) => branch switch
    {
        "寅" or "卯" => "木",
        "巳" or "午" => "火",
        "辰" or "戌" or "丑" or "未" => "土",
        "申" or "酉" => "金",
        "亥" or "子" => "水",
        _ => "木"
    };

    // ============================================================
    // 기본 동작
    // ============================================================

    [Fact]
    public void Calculate_BasicChart_ReturnsNonEmptyYongshin()
    {
        var chart = BuildChart("甲", "寅");
        var result = _service.Calculate(chart);

        Assert.NotNull(result);
        Assert.False(string.IsNullOrEmpty(result.PrimaryYongshin),
            "PrimaryYongshin이 비어있음");
        Assert.False(string.IsNullOrEmpty(result.EokbuYongshin),
            "EokbuYongshin이 비어있음");
    }

    [Fact]
    public void Calculate_BasicChart_PrimaryYongshinIsValidElement()
    {
        var chart = BuildChart("甲", "寅");
        var result = _service.Calculate(chart);

        var validElements = new[] { "木", "火", "土", "金", "水" };
        Assert.Contains(result.PrimaryYongshin, validElements);
    }

    [Fact]
    public void Calculate_HeeshinAndGishin_AreValidElements()
    {
        var chart = BuildChart("甲", "寅");
        var result = _service.Calculate(chart);

        var validElements = new[] { "木", "火", "土", "金", "水" };
        Assert.Contains(result.Heeshin, validElements);
        Assert.Contains(result.Gishin, validElements);

        // Heeshin과 Gishin은 서로 달라야 한다
        Assert.NotEqual(result.Heeshin, result.Gishin);
    }

    // ============================================================
    // 강약 판정
    // ============================================================

    /// <summary>
    /// 일간 木인 사주에서 木이 매우 많으면 신강(身强)이어야 한다.
    /// </summary>
    [Fact]
    public void Calculate_StrongDayMaster_ReturnsStrongStrength()
    {
        var strongMok = new Dictionary<string, int>
        {
            ["木"] = 5, ["火"] = 1, ["土"] = 1, ["金"] = 0, ["水"] = 1
        };
        var chart = BuildChart("甲", "寅", strongMok);
        var result = _service.Calculate(chart);

        // 木이 압도적이면 신강 또는 적어도 신약은 아님
        Assert.NotEqual(DayMasterStrength.Weak, result.Strength);
    }

    /// <summary>
    /// 일간 木이지만 木·水(인성)가 거의 없고 다른 오행이 많으면 신약(身弱).
    /// </summary>
    [Fact]
    public void Calculate_WeakDayMaster_ReturnsWeakStrength()
    {
        var weakMok = new Dictionary<string, int>
        {
            ["木"] = 0, ["火"] = 2, ["土"] = 2, ["金"] = 3, ["水"] = 0
        };
        var chart = BuildChart("甲", "申", weakMok); // 申월 = 金旺
        var result = _service.Calculate(chart);

        Assert.NotEqual(DayMasterStrength.Strong, result.Strength);
    }

    // ============================================================
    // 조후법 — 월지 기반
    // ============================================================

    /// <summary>
    /// 한랭월(子월) — 조후 용신이 火 계열이어야 한다.
    /// </summary>
    [Fact]
    public void Calculate_ColdMonth_JohuYongshinIsFire()
    {
        var chart = BuildChart("甲", "子");
        var result = _service.Calculate(chart);

        Assert.Equal("火", result.JohuYongshin);
    }

    /// <summary>
    /// 조열월(午월) — 조후 용신이 水 계열이어야 한다.
    /// </summary>
    [Fact]
    public void Calculate_HotMonth_JohuYongshinIsWater()
    {
        var chart = BuildChart("甲", "午");
        var result = _service.Calculate(chart);

        Assert.Equal("水", result.JohuYongshin);
    }

    // ============================================================
    // YongshinReason / StrengthDescription
    // ============================================================

    [Fact]
    public void Calculate_ReturnsHumanReadableDescriptions()
    {
        var chart = BuildChart("甲", "寅");
        var result = _service.Calculate(chart);

        Assert.False(string.IsNullOrEmpty(result.StrengthDescription),
            "StrengthDescription이 비어있음");
        Assert.False(string.IsNullOrEmpty(result.YongshinReason),
            "YongshinReason이 비어있음");
    }

    // ============================================================
    // 동일 입력 → 동일 출력 (결정성)
    // ============================================================

    [Fact]
    public void Calculate_SameInput_IsDeterministic()
    {
        var chart1 = BuildChart("乙", "巳");
        var chart2 = BuildChart("乙", "巳");

        var r1 = _service.Calculate(chart1);
        var r2 = _service.Calculate(chart2);

        Assert.Equal(r1.PrimaryYongshin, r2.PrimaryYongshin);
        Assert.Equal(r1.EokbuYongshin, r2.EokbuYongshin);
        Assert.Equal(r1.JohuYongshin, r2.JohuYongshin);
        Assert.Equal(r1.Strength, r2.Strength);
        Assert.Equal(r1.StrengthScore, r2.StrengthScore);
    }
}
