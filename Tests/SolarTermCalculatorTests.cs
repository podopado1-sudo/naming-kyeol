using NameForm.Application.Engines.Data;

namespace NameForm.Tests;

/// <summary>
/// 절기 계산기 정밀도 — 설계 docs/plan-ohaeng-2026-11.md §1-4·§16·§17(2026-11-19 반박 검토 반영 · 같은 날 P0 구현).
///
/// 계산기는 저정밀 태양 황경 식(Meeus 25장)에 분 단위 버림이라 발표값과 분까지 맞지 않는다 — 2024년 12절은 1~7분 이르고(±10분 검사),
/// 여러 해로 넓히면 13분 이르게 ~ 9분 늦게 나온다(±15분 검사 — 1900~2097년 56개 해 672건을 스크래치에서 대조한 범위, 평균 3분 이름).
/// 그래서 골든 테스트는 절입 순간을 분까지 맞추지 않는다 — 사주 골든(SajuCalculationP0Tests)은 시험 시각을 절입 순간에서 20분 넘게 떨어뜨린다.
/// 분 단위로 맞추려면 ΔT·고정밀 황경식을 넣는 일을 따로 잡는다.
///
/// 이 오차가 원국을 바꾸는 곳(2026-11-19 대조 — 1900~2099년 절입 2,400건을 독립 고정밀 계산·발표값과 견줌, 설계 §17-8):
/// 시각을 넣은 입력은 계산값과 참값 사이의 몇 분(200년 합계 8,955분 = 전체의 0.0085%, 그 가운데 입춘 712분)에 태어났을 때만
/// 월주(입춘이면 연주도)가 옆 달 것으로 나온다. 시각 없는 입력은 낮 12시 기준이라 절입이 정오에서 몇 분 안인 닷새
/// (1918-01-06 · 1988-01-06 · 2020-03-05 · 2080-07-06 · 2086-03-05)의 월주가 발표값 기준과 다르고, 절입이 자정에서 몇 분 안인 일곱 건은
/// 절기 안내가 하루 옆 날에 뜬다 — 날짜·시각 목록과 '여유가 얇지만 맞는 날'(1986-02-04 2분 · 1916-02-05 8분)은
/// SajuCalculationP0Tests 의 '알려진 정밀도 한계' 절에 있다. 가까운 해에서 큰 차이: 2026년 입하 −13분(계산 05-05 20:36 · 발표 20:49) ·
/// 청명 −12분 · 망종 −11분.
/// 기준값: 2024년 = 한국천문연구원 월력요항의 절입 시각(한국 표준시, 분 단위). 여러 해 = 일본 국립천문대 역계산실 '天象 長期版'의
/// 이십사절기 시각(표준시 UT+9 — 이 사이트가 입력 시각을 보는 시계와 같다). 두 기관 값은 겹치는 2004~2018년 12절 180건에서 1분 안으로 같다.
/// </summary>
public class SolarTermCalculatorTests
{
    private static readonly TimeSpan Tolerance = TimeSpan.FromMinutes(10);

    /// <summary>여러 해 대조의 허용 오차 — 실측 범위(−13 ~ +9분)에 여유 2분</summary>
    private static readonly TimeSpan MultiYearTolerance = TimeSpan.FromMinutes(15);

    /// <summary>KST 기준값 → UTC</summary>
    private static DateTime Kst(int month, int day, int hour, int minute) =>
        new DateTime(2024, month, day, hour, minute, 0, DateTimeKind.Utc).AddHours(-9);

    private static void AssertNear(DateTime expectedUtc, DateTime actualUtc, string name)
    {
        var diff = (actualUtc - expectedUtc).Duration();
        Assert.True(diff <= Tolerance,
            $"{name}: 계산 {actualUtc.AddHours(9):yyyy-MM-dd HH:mm} KST, 기준 {expectedUtc.AddHours(9):yyyy-MM-dd HH:mm} KST, 차이 {diff.TotalMinutes:0}분");
    }

    [Theory]
    [InlineData("소한", 285.0, 1, 6, 5, 49)]
    [InlineData("입춘", 315.0, 2, 4, 17, 27)]
    [InlineData("경칩", 345.0, 3, 5, 11, 23)]
    [InlineData("청명", 15.0, 4, 4, 16, 2)]
    [InlineData("입하", 45.0, 5, 5, 9, 10)]
    [InlineData("망종", 75.0, 6, 5, 13, 10)]
    [InlineData("소서", 105.0, 7, 6, 23, 20)]
    [InlineData("입추", 135.0, 8, 7, 9, 9)]
    [InlineData("백로", 165.0, 9, 7, 12, 11)]
    public void Terms2024_WithinTenMinutes_OfPublishedKst(string name, double longitude, int month, int day, int hour, int minute)
    {
        // 황경 270° 이상(소한·입춘·경칩)과 180° 미만은 P0 전에도 그 해 날짜로 수렴했다
        AssertNear(Kst(month, day, hour, minute), SolarTermCalculator.GetSolarTermDate(2024, longitude), name);
    }

    [Theory]
    [InlineData("한로", 195.0, 10, 8, 4, 0)]  // P0 전 2023-10-08 22:10 KST(전년도 — B2)
    [InlineData("입동", 225.0, 11, 7, 7, 20)] // P0 전 2023-11-08 01:30 KST
    [InlineData("대설", 255.0, 12, 7, 0, 17)] // P0 전 2023-12-07 18:28 KST
    public void P0_B2_Terms2024_From180To270_InTheSameYear(string name, double longitude, int month, int day, int hour, int minute)
    {
        AssertNear(Kst(month, day, hour, minute), SolarTermCalculator.GetSolarTermDate(2024, longitude), name);
    }

    // ── 여러 해 — 12절이 모두 그 해 안에, 발표값 ±15분 ─────────────────────

    private static readonly string[] MonthTermOrder =
        ["소한", "입춘", "경칩", "청명", "입하", "망종", "소서", "입추", "백로", "한로", "입동", "대설"];

    /// <summary>
    /// 12절 절입 시각(UT+9, "MM-dd/HH:mm" — 소한 … 대설 순) — 일본 국립천문대 역계산실 '天象 長期版'(표준시 +9시간).
    /// 2013년은 한국천문연구원 역서와 같은 값(1분 차이 둘)이고, 계산기가 가장 이르게 나오는 해다(입하 −13분).
    /// 2026년은 한국천문연구원 달력자료와 열두 값이 모두 같고, 가까운 해 가운데 차이가 가장 크다(입하 −13분 · 청명 −12분 · 망종 −11분 —
    /// 2026-11-19 대조 때 더함. 올해·내년 출생이 가장 흔한 입력이라 이 해를 표에 둔다).
    /// </summary>
    private static readonly Dictionary<int, string> PublishedMonthTerms = new()
    {
        [1900] = "01-06/03:04 02-04/14:51 03-06/09:22 04-05/14:53 05-06/08:55 06-06/13:39 07-08/00:10 08-08/09:51 09-08/12:17 10-09/03:13 11-08/05:40 12-07/21:56",
        [1920] = "01-06/23:41 02-05/11:26 03-06/05:51 04-05/11:15 05-06/05:11 06-06/09:50 07-07/20:19 08-08/05:58 09-08/08:27 10-08/23:29 11-08/02:05 12-07/18:30",
        [1960] = "01-06/16:42 02-05/04:23 03-05/22:36 04-05/03:44 05-05/21:23 06-06/01:49 07-07/12:13 08-07/22:00 09-08/00:45 10-08/16:09 11-07/19:02 12-07/11:38",
        [1987] = "01-06/06:13 02-04/17:52 03-06/11:54 04-05/16:44 05-06/10:06 06-06/14:19 07-08/00:39 08-08/10:29 09-08/13:24 10-09/05:00 11-08/08:06 12-08/00:52",
        [2000] = "01-06/10:01 02-04/21:40 03-05/15:43 04-04/20:32 05-05/13:50 06-05/17:59 07-07/04:14 08-07/14:03 09-07/16:59 10-08/08:38 11-07/11:48 12-07/04:37",
        [2013] = "01-05/13:34 02-04/01:13 03-05/19:15 04-05/00:02 05-05/17:18 06-05/21:23 07-07/07:35 08-07/17:20 09-07/20:16 10-08/11:58 11-07/15:14 12-07/08:09",
        [2022] = "01-05/18:14 02-04/05:51 03-05/23:44 04-05/04:20 05-05/21:26 06-06/01:26 07-07/11:38 08-07/21:29 09-08/00:32 10-08/16:22 11-07/19:45 12-07/12:46",
        [2026] = "01-05/17:23 02-04/05:02 03-05/22:59 04-05/03:40 05-05/20:49 06-06/00:48 07-07/10:57 08-07/20:43 09-07/23:41 10-08/15:29 11-07/18:52 12-07/11:53",
        [2030] = "01-05/16:31 02-04/04:08 03-05/22:03 04-05/02:41 05-05/19:46 06-05/23:45 07-07/09:55 08-07/19:47 09-07/22:53 10-08/14:45 11-07/18:09 12-07/11:08",
    };

    private static DateTime ParsePublished(int year, string token)
    {
        // "MM-dd/HH:mm"(UT+9) → UTC
        var local = DateTime.ParseExact($"{year}-{token}", "yyyy-MM-dd/HH:mm", System.Globalization.CultureInfo.InvariantCulture);
        return DateTime.SpecifyKind(local.AddHours(-9), DateTimeKind.Utc);
    }

    [Fact]
    public void MonthTerms_AcrossYears_Within15Minutes_OfPublishedTables()
    {
        // B2 일반형(계산기) — 2024년 한 해가 아니라 1900~2030년 아홉 해에서 12절이 모두 그 해 날짜로 수렴하고 발표값 ±15분 안
        // (이 표에서 가장 큰 차이는 2013년·2026년 입하 13분)
        foreach (var (year, line) in PublishedMonthTerms)
        {
            var published = line.Split(' ');
            Assert.Equal(12, published.Length);
            var terms = SolarTermCalculator.GetMonthTerms(year);
            Assert.Equal(MonthTermOrder, terms.Select(t => t.Name));
            for (int i = 0; i < 12; i++)
            {
                var expected = ParsePublished(year, published[i]);
                var diff = (terms[i].InstantUtc - expected).Duration();
                Assert.True(diff <= MultiYearTolerance,
                    $"{year} {terms[i].Name}: 계산 {terms[i].InstantUtc.AddHours(9):yyyy-MM-dd HH:mm}, 발표 {expected.AddHours(9):yyyy-MM-dd HH:mm}(UT+9), 차이 {diff.TotalMinutes:0}분");
            }
        }
    }

    [Theory]
    // 입춘이 2/5 정오(UT+9) 뒤에 드는 네 해 — 날마다 정오로 보면 연주가 2/6 에 바뀐다(SajuCalculationP0Tests 의 1901~2099 검사)
    [InlineData(1904, 2, 5, 14, 24)]
    [InlineData(1908, 2, 5, 13, 47)]
    [InlineData(1912, 2, 5, 12, 54)]
    [InlineData(1916, 2, 5, 12, 14)]
    // 1901~2099년에서 가장 이른 입춘
    [InlineData(2097, 2, 3, 10, 43)]
    public void Lichun_BoundaryYears_Within15Minutes_OfPublishedTables(int year, int month, int day, int hour, int minute)
    {
        var expected = new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Utc).AddHours(-9);
        var actual = SolarTermCalculator.GetLichun(year);
        Assert.True((actual - expected).Duration() <= MultiYearTolerance,
            $"{year} 입춘: 계산 {actual.AddHours(9):yyyy-MM-dd HH:mm}, 발표 {expected.AddHours(9):yyyy-MM-dd HH:mm}(UT+9)");
    }

    [Fact]
    public void MonthTerms_EveryYear_TwelveInOrder_InsideTheYear()
    {
        // 1900~2100년 모든 해: 12절이 소한(1월) … 대설(12월) 순으로 그 해(UTC) 안에 있고, 달의 지지는 丑(1)·寅(2) … 亥(11)·子(0),
        // 이웃한 절 사이는 29~32일. P0 전에는 한로·입동·대설이 전년도 날짜였다(B2)
        var expectedBranches = new[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0 };
        var expectedMonths = new[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 };
        DateTime? previous = null;
        for (int year = 1900; year <= 2100; year++)
        {
            var terms = SolarTermCalculator.GetMonthTerms(year);
            Assert.Equal(MonthTermOrder, terms.Select(t => t.Name));
            Assert.Equal(expectedBranches, terms.Select(t => t.BranchIndex));
            Assert.All(terms, t => Assert.Equal(year, t.InstantUtc.Year));
            Assert.Equal(expectedMonths, terms.Select(t => t.InstantUtc.Month));
            Assert.All(terms, t => Assert.Equal(DateTimeKind.Utc, t.InstantUtc.Kind));
            foreach (var t in terms)
            {
                if (previous is { } p) Assert.InRange((t.InstantUtc - p).TotalDays, 29.0, 32.0);
                previous = t.InstantUtc;
            }
            Assert.Equal(terms[1].InstantUtc, SolarTermCalculator.GetLichun(year));
        }
    }

    [Fact]
    public void MonthBranchIndex_StepsAtTheTermInstant_IncludingYearStart()
    {
        // 절입 순간부터 새 달(같은 분 포함), 1분 전은 앞 달. 1월 1일~소한 전은 전년 대설이 정한 子월(0) — 그 해 절기만 보면 비는 구간
        foreach (int year in new[] { 1950, 2000, 2024, 2025 })
        {
            var terms = SolarTermCalculator.GetMonthTerms(year);
            for (int i = 0; i < 12; i++)
            {
                Assert.Equal(terms[i].BranchIndex, SolarTermCalculator.GetMonthBranchIndex(terms[i].InstantUtc));
                Assert.Equal((terms[i].BranchIndex + 11) % 12, SolarTermCalculator.GetMonthBranchIndex(terms[i].InstantUtc.AddMinutes(-1)));
            }
            Assert.Equal(0, SolarTermCalculator.GetMonthBranchIndex(new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
            Assert.Equal(0, SolarTermCalculator.GetMonthBranchIndex(new DateTime(year, 12, 31, 23, 59, 0, DateTimeKind.Utc)));
        }
    }

    [Fact]
    public void FindMonthTermWithin_HalfOpenRange_TwelveTermsOnly()
    {
        var lichun = SolarTermCalculator.GetLichun(2024);
        Assert.Equal("입춘", SolarTermCalculator.FindMonthTermWithin(lichun, lichun.AddMinutes(1)));            // 시작 포함
        Assert.Null(SolarTermCalculator.FindMonthTermWithin(lichun.AddDays(-1), lichun));                      // 끝 제외
        Assert.Equal("입춘", SolarTermCalculator.FindMonthTermWithin(lichun.AddHours(-23), lichun.AddHours(1)));
        // 해를 넘는 구간(12/31~1/7)에서는 새해 소한
        Assert.Equal("소한", SolarTermCalculator.FindMonthTermWithin(
            new DateTime(2023, 12, 31, 0, 0, 0, DateTimeKind.Utc), new DateTime(2024, 1, 7, 0, 0, 0, DateTimeKind.Utc)));
        // 중기(대한 2024-01-20 23:07 KST · 우수 02-19 13:13 KST)는 월주를 가르지 않는다 — 소한 뒤~입춘 전, 입춘 뒤~경칩 전 구간에는 없다
        Assert.Null(SolarTermCalculator.FindMonthTermWithin(
            new DateTime(2024, 1, 10, 0, 0, 0, DateTimeKind.Utc), new DateTime(2024, 2, 1, 0, 0, 0, DateTimeKind.Utc)));
        Assert.Null(SolarTermCalculator.FindMonthTermWithin(
            new DateTime(2024, 2, 10, 0, 0, 0, DateTimeKind.Utc), new DateTime(2024, 3, 1, 0, 0, 0, DateTimeKind.Utc)));
    }
}
