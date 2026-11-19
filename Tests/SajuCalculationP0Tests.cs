using NameForm.Application.Services;
using NameForm.Domain.Models.Saju;

namespace NameForm.Tests;

/// <summary>
/// 사주 계산 수정 P0(설계 docs/plan-ohaeng-2026-11.md §1·§17)의 골든·성질 테스트 — B1(시각 없으면 보정 없음)·B2(한로~12/31 월지)·
/// B3(입춘·절입은 순간 비교)·B4(강약 가중치는 자리로)·B5(23시대 시주 천간)·P0-c(절기가 드는 날).
/// 2026-11-19 반박 검토 때 Skip 으로 미리 써 두었고(P0 전 코드는 여기서 B1~B5 의 틀린 값을 냈다), 같은 날 P0 구현에서 Skip 을 모두 풀었다.
///
/// 이 사이트의 계산 관례(바꾸면 /ohaeng 설명 글도 함께 고칠 것 — SajuCalculationService 머리 주석):
/// 입력 시각은 UTC+9 시계, 진태양시 보정은 경도만. 시각이 없으면 보정하지 않고 날짜 그대로이며 연·월주 비교 순간은 그날 낮 12시.
/// 시각이 있으면 연·월주는 시계 시각의 물리 순간(보정 전)을 절입 순간과 견주고, 일주·시주는 보정한 시각으로 정한다(23시대는 야자시).
///
/// 기대값은 검사 대상 계산을 쓰지 않고 따로 셌다: 일주 = 1900-01-01 甲戌 기준 날짜 차(손 계산 — 서비스 주석의 2000-01-01 戊午 검증과 같은 기준),
/// 월주 = 오호둔(연간 → 인월 천간) 손 표와 2024년 12절(한국천문연구원 발표값 — 시험 시각은 절입 순간에서 10분 넘게 떨어뜨림, §1-4),
/// 시주 = 오자둔(일간 → 자시 천간) 손 표 + 23시대는 다음 날 일간(야자시 — B5), 강약 = 자리 가중치(연 1·월 3·일 2·시 1) 손 계산.
/// </summary>
public class SajuCalculationP0Tests
{
    private readonly SajuCalculationService _service = new();

    private const string Stems = "甲乙丙丁戊己庚辛壬癸";
    private const string Branches = "子丑寅卯辰巳午未申酉戌亥";

    private static string GanJi(SajuPillar p) => p.StemChar + p.BranchChar;

    /// <summary>60갑자 번호(甲子 = 0) — 천간·지지 손 표로 센다(SajuData 를 읽지 않는다)</summary>
    private static int Cycle60(SajuPillar p)
    {
        int s = Stems.IndexOf(p.StemChar, StringComparison.Ordinal);
        int b = Branches.IndexOf(p.BranchChar, StringComparison.Ordinal);
        for (int n = 0; n < 60; n++)
            if (n % 10 == s && n % 12 == b) return n;
        throw new InvalidOperationException($"간지가 아님: {p.StemChar}{p.BranchChar}");
    }

    // ── B1 — 시각이 없으면 보정하지 않는다 ─────────────────────────────

    [Theory]
    [InlineData(1985, 6, 5, "乙亥")] // P0 전 甲戌(시각이 없어도 −32분 → 전날 23:28)
    [InlineData(2000, 1, 1, "戊午")] // P0 전 丁巳 — 서비스 주석의 기준일 검증과 같은 값
    public void P0_B1_NoTime_DayPillarIsTheDateItself(int y, int m, int d, string expectedDay)
    {
        var chart = _service.CalculateChart(new DateTime(y, m, d), null, null);
        Assert.Equal(expectedDay, GanJi(chart.DayPillar));
        Assert.Null(chart.HourPillar);
        Assert.False(chart.CorrectionApplied);
        Assert.Equal(0, chart.CorrectionMinutes); // 쓰지 않은 보정값을 싣지 않는다(P0 전에는 시각이 없어도 −32)
    }

    [Theory]
    [InlineData(null, "서울")]
    [InlineData("busan", "부산")]
    [InlineData("jeju", "제주")]
    public void P0_B1_NoTime_BirthplaceDoesNotChangeTheChart(string? place, string expectedName)
    {
        // 시각이 없으면 출생지 보정을 하지 않으므로 출생지가 무엇이든 원국이 같다
        var seoul = _service.CalculateChart(new DateTime(1985, 6, 5), null, "seoul");
        var chart = _service.CalculateChart(new DateTime(1985, 6, 5), null, place);
        Assert.Equal(expectedName, chart.BirthplaceName);
        Assert.False(chart.CorrectionApplied);
        Assert.Equal(0, chart.CorrectionMinutes);
        Assert.Equal(new[] { GanJi(seoul.YearPillar), GanJi(seoul.MonthPillar), GanJi(seoul.DayPillar) },
            new[] { GanJi(chart.YearPillar), GanJi(chart.MonthPillar), GanJi(chart.DayPillar) });
    }

    [Theory]
    [InlineData(null, -32)]     // 서울 126.98° → −32.08분
    [InlineData("busan", -24)]  // 129.08° → −23.68분
    [InlineData("jeju", -34)]   // 126.53° → −33.88분
    public void P0_B1_WithTime_CorrectionIsApplied(string? place, int expectedMinutes)
    {
        var chart = _service.CalculateChart(new DateTime(1985, 6, 5), new TimeSpan(13, 1, 0), place);
        Assert.True(chart.CorrectionApplied);
        Assert.Equal(expectedMinutes, chart.CorrectionMinutes);
        Assert.Null(chart.TermOnBirthDay); // 시각을 넣었으면 절기 안내가 필요 없다
    }

    // ── B2 — 한로~12/31 월지 · 1월 소한 앞뒤 ──────────────────────────

    [Theory]
    [InlineData(2024, 10, 20, "甲辰", "甲戌")] // P0 전 癸酉(한로·입동·대설을 전년도 날짜로 계산)
    [InlineData(2024, 11, 20, "甲辰", "乙亥")]
    [InlineData(2024, 12, 20, "甲辰", "丙子")]
    [InlineData(2024, 1, 3, "癸卯", "甲子")]   // 소한(1/6 05:49) 전 — 대설 Y−1 이 이 구간을 子로 만든다
    [InlineData(2024, 1, 10, "癸卯", "乙丑")]  // 소한 뒤 입춘 전
    public void P0_B2_NoTime_MonthPillar(int y, int m, int d, string expectedYear, string expectedMonth)
    {
        var chart = _service.CalculateChart(new DateTime(y, m, d), null, null);
        Assert.Equal(expectedYear, GanJi(chart.YearPillar));
        Assert.Equal(expectedMonth, GanJi(chart.MonthPillar));
    }

    // ── B3 — 입춘·절입은 순간(UTC)으로 비교 ───────────────────────────

    [Theory]
    [InlineData(12, "癸卯", "乙丑")] // 입춘 2024-02-04 17:27 KST 전 — P0 전 甲辰년 丁丑월(새 해 연간 + 묵은 월지)
    [InlineData(18, "甲辰", "丙寅")] // 입춘 뒤 — P0 전 甲辰년 丁丑월(월주가 날짜 0시로 비교돼 묵은 달)
    public void P0_B3_LichunDay2024_ComparesInstants(int hour, string expectedYear, string expectedMonth)
    {
        // 시험 시각은 절입 순간에서 5시간 넘게 떨어져 있다 — 계산기의 몇 분 오차(SolarTermCalculatorTests)와 무관
        var chart = _service.CalculateChart(new DateTime(2024, 2, 4), new TimeSpan(hour, 0, 0), "seoul");
        Assert.Equal(expectedYear, GanJi(chart.YearPillar));
        Assert.Equal(expectedMonth, GanJi(chart.MonthPillar));
    }

    [Theory]
    [InlineData("seoul")]   // 보정 −32.08분 → 17:17(입춘 17:27 전)
    [InlineData("jeju")]    // 보정 −33.88분 → 17:16
    public void P0_B3_YearAndMonth_UseClockInstant_NotSolarCorrectedTime(string place)
    {
        // 연·월주는 시계 시각(UTC+9)의 물리 순간을 절입 순간과 견준다 — 진태양시 보정은 일주·시주에만 쓴다(절입은 출생지와 무관한 순간).
        // 2024-02-04 17:50 은 입춘(17:27, 한국천문연구원) 23분 뒤 → 새 해. 보정한 시각(17:16~17:17)으로 견주면 입춘 전이 되어 틀린다.
        // (계산기의 이 절입 시각은 17:21 — 시험 시각은 발표값·계산값 양쪽에서 20분 넘게, 보정한 시각은 양쪽보다 4분 넘게 앞이다)
        var chart = _service.CalculateChart(new DateTime(2024, 2, 4), new TimeSpan(17, 50, 0), place);
        Assert.Equal("甲辰", GanJi(chart.YearPillar));
        Assert.Equal("丙寅", GanJi(chart.MonthPillar));
        Assert.Equal("戊戌", GanJi(chart.DayPillar));  // 2000-01-01 戊午(54)에서 8,800일 → (54 + 8800) % 60 = 34 戊戌
        Assert.Equal("辛酉", GanJi(chart.HourPillar!)); // 보정 17시대 = 酉시, 戊일 자시 壬 → 酉 = 壬 + 9 = 辛
    }

    [Fact]
    public void P0_B3_NoServerTimeZoneInYearPillar()
    {
        // 연주 비교에 ToLocalTime 이 남아 있으면 서버 시간대(운영 Render = UTC, 개발 PC = KST)에 따라 입춘일 결과가 갈린다.
        // 사주 계산과 절기 계산기 어디에도 서버의 지역 시간을 읽는 호출이 없어야 한다(입력 시계는 늘 UTC+9, 절입 순간은 UTC)
        //
        // ⚠️ 이 검사는 계산 두 파일만 본다. 계산을 부르는 옛 호출부는 아직 서버 시간대에 닿을 수 있다(P0 전부터 — 2026-11-19 검토, 설계 §17-8):
        // 길이 제한이 없는 BirthDate(/dual-name·/parent-based·/rare-surname)를 DateTime.TryParse 로 읽어 '…Z'·'+09:00' 이 붙은 문자열이면
        // 서버 지역 시간으로 바뀐 날짜가 들어오고, TwinNameService 에는 DateTime.Now 대체값이 있다(컨트롤러가 먼저 막아 닿지 않음).
        // 엄격한 공용 파서(SajuController 의 yyyy-MM-dd · HH:mm 파서를 빼낸 것)를 만들면 그 파일도 아래 목록에 넣을 것.
        foreach (var file in new[]
                 {
                     Path.Combine("Application", "Services", "SajuCalculationService.cs"),
                     Path.Combine("Application", "Engines", "Data", "SolarTermCalculator.cs"),
                 })
        {
            var src = File.ReadAllText(Path.Combine(RepoRoot(), file));
            foreach (var localTimeApi in new[] { "ToLocalTime", "DateTime.Now", "DateTime.Today", "TimeZoneInfo", "DateTimeKind.Local" })
                Assert.False(src.Contains(localTimeApi, StringComparison.Ordinal), $"{file}: {localTimeApi}");
        }
    }

    // ── B5 — 23시대 시주 천간은 다음 날 일간으로(야자시 — 일주는 그날 그대로) ─────────

    [Theory]
    [InlineData(2000, 1, 1, 23, 50, "戊午", "甲子")] // 보정 23:17 — P0 전 戊午일 壬子시(그날 일간 戊로 자시 천간)
    [InlineData(2000, 1, 1, 0, 20, "丁巳", "壬子")]  // 보정 전날 23:47 — P0 전 丁巳일 庚子시. 설명 글 '서울 0시 20분' 예
    [InlineData(2000, 1, 1, 22, 40, "戊午", "癸亥")] // 보정 22:07 — 亥시는 P0 전에도 맞았다(회귀)
    [InlineData(2000, 1, 2, 0, 40, "己未", "甲子")]  // 보정 00:07 — 자정 뒤 자시는 P0 전에도 맞았다(회귀). 23:50 과 같은 기둥
    public void P0_B5_LateZiHour_StemFromNextDay(int y, int m, int d, int hh, int mm, string expectedDay, string expectedHour)
    {
        var chart = _service.CalculateChart(new DateTime(y, m, d), new TimeSpan(hh, mm, 0), "seoul");
        Assert.Equal(expectedDay, GanJi(chart.DayPillar));
        Assert.Equal(expectedHour, GanJi(chart.HourPillar!));
    }

    [Fact]
    public void P0_B5_HourPillar_IsContinuousSexagenary_AcrossMidnight()
    {
        // 서울 시계 30분 간격으로 사흘: 시주 60갑자 번호는 0 또는 +1 씩만 늘고(자시는 자정 앞뒤로 같은 기둥), 24시간 뒤에는 정확히 +12.
        // P0 전 코드는 보정한 시각 23시대에 그날 일간으로 자시 천간을 정해 癸亥(59) → 壬子(48) 로 거꾸로 뛰었다
        foreach (var start in new[] { new DateTime(1999, 12, 31), new DateTime(2024, 2, 3), new DateTime(1985, 6, 4) })
        {
            var idx = new List<int>();
            for (int k = 0; k < 3 * 48; k++)
            {
                var t = start.AddMinutes(30 * k);
                idx.Add(Cycle60(_service.CalculateChart(t.Date, t.TimeOfDay, "seoul").HourPillar!));
            }
            for (int k = 1; k < idx.Count; k++)
            {
                int step = ((idx[k] - idx[k - 1]) % 60 + 60) % 60;
                Assert.True(step is 0 or 1, $"{start.AddMinutes(30 * k):yyyy-MM-dd HH:mm}: {idx[k - 1]} → {idx[k]}");
            }
            for (int k = 48; k < idx.Count; k++)
                Assert.Equal(12, ((idx[k] - idx[k - 48]) % 60 + 60) % 60);
        }
    }

    // ── B2·B3 일반형 — 1901~2099 매일 정오 ──────────────────────────

    /// <summary>
    /// 입춘 순간(UTC+9 시계) 어림 — 검사 대상 계산(SolarTermCalculator)을 쓰지 않는 독립 기준.
    /// 한국천문연구원 역서의 입춘 2004-02-04 20:56 · 2024-02-04 17:27 사이 20년 = 7,304.855일 → 한 해 평균 365.2427일
    /// (입춘에서 다음 입춘까지의 평균 길이). 2024년 발표값에서 이 간격으로 앞뒤로 센다.
    /// 발표된 입춘 시각(일본 국립천문대 '天象 長期版' UT+9 — 1900~2097년 가운데 56개 해)과 견주면 이 어림은 7분 이르게 ~ 19분 늦게 나온다
    /// — 아래 검사는 ±1시간으로 쓴다.
    /// </summary>
    private static DateTime LichunEstimate(int year) =>
        new DateTime(2024, 2, 4, 17, 27, 0).AddDays((year - 2024) * 365.2427);

    private static readonly TimeSpan LichunEstimateTolerance = TimeSpan.FromHours(1);

    [Fact]
    public void P0_B2_MonthAndYear_StepOncePerTerm_1901To2099()
    {
        // 월지는 해마다 정확히 12번 바뀌고(소한·입춘·경칩 … 대설) 바뀔 때마다 지지 순서대로 한 칸, 한 달 구간 28~32일.
        // 연주는 해마다 한 번, 입춘 순간 뒤 첫 정오에 한 칸.
        //
        // 연주가 바뀌는 날의 범위 — 처음 써 둔 '2/3~2/5'는 틀렸다(2026-11-19 P0 구현 때 바로잡음 — 계산을 테스트에 맞춘 것이 아니다).
        // 이 검사는 날마다 낮 12시(UTC+9 시계)를 보므로 연주는 '입춘 순간 뒤 첫 정오'에 바뀐다. 입춘 순간은 해마다 약 5시간 49분씩 늦어지다
        // 윤일이 하루를 되돌려(윤년의 입춘이 네 해 가운데 가장 늦다) 4년에 약 40분씩 일러진다 — 1900년이 윤년이 아니어서 20세기 초가 가장 늦고
        // 21세기 말이 가장 이르다. 일본 국립천문대 역계산실 '天象 長期版'(표준시 UT+9 — 이 사이트가 입력을 보는 시계)의 입춘:
        //   1904-02-05 14:24 · 1908-02-05 13:47 · 1912-02-05 12:54 · 1916-02-05 12:14 → 2/5 정오 뒤라 2/6 정오에 처음 새 해
        //   1920-02-05 11:26 → 정오 전이라 2/5.  가장 이른 해 2097-02-03 10:43 → 2/3
        // 그래서 바뀌는 날은 2/3~2/6 이고 2/6 은 위 네 해뿐이다(계산기 값은 14:19 · 13:44 · 12:58 · 12:08 — SolarTermCalculatorTests 가 발표값과 대조).
        // 1916년은 정오에서 14분(계산기로는 8분)이라 계산기 오차(−13 ~ +9분)와 같은 크기다 — 계산기를 고친 뒤 이 해가 2/5 로 넘어가면
        // 발표값과 어긋난 것이니 테스트가 아니라 계산을 볼 것.
        // 해마다의 날짜는 아래에서 독립 어림 ±1시간으로도 따로 묶는다(어림이 정오에서 1시간 넘게 떨어진 해는 바뀌는 날이 하루로 정해진다).
        int prevMonth = -1, prevYear = -1;
        DateTime? lastMonthChange = null;
        var monthChanges = new Dictionary<int, int>();
        var yearChanges = new Dictionary<int, int>();
        var yearChangeDay = new Dictionary<int, int>();

        for (var d = new DateTime(1901, 1, 1); d <= new DateTime(2099, 12, 31); d = d.AddDays(1))
        {
            var chart = _service.CalculateChart(d, new TimeSpan(12, 0, 0), "seoul");
            int month = Branches.IndexOf(chart.MonthPillar.BranchChar, StringComparison.Ordinal);
            int year = Cycle60(chart.YearPillar);

            if (prevMonth >= 0 && month != prevMonth)
            {
                Assert.True((prevMonth + 1) % 12 == month, $"{d:yyyy-MM-dd}: 월지 {prevMonth} → {month}");
                monthChanges[d.Year] = monthChanges.GetValueOrDefault(d.Year) + 1;
                if (lastMonthChange is { } last) Assert.InRange((d - last).TotalDays, 28, 32);
                lastMonthChange = d;
            }
            if (prevYear >= 0 && year != prevYear)
            {
                Assert.True((prevYear + 1) % 60 == year, $"{d:yyyy-MM-dd}: 연주 {prevYear} → {year}");
                Assert.True(d.Month == 2 && d.Day is >= 3 and <= 6, $"{d:yyyy-MM-dd}: 입춘 무렵이 아닌 날 연주가 바뀜");

                // 이날 정오에 처음 새 해 → 입춘 순간은 (전날 정오, 이날 정오] 안. 독립 어림 ±1시간과 겹쳐야 한다
                var noon = d.AddHours(12);
                var estimate = LichunEstimate(d.Year);
                Assert.True(
                    estimate - LichunEstimateTolerance <= noon && noon.AddDays(-1) < estimate + LichunEstimateTolerance,
                    $"{d:yyyy-MM-dd}: 연주가 바뀐 날이 입춘 어림({estimate:yyyy-MM-dd HH:mm}) 뒤 첫 정오가 아님");

                yearChanges[d.Year] = yearChanges.GetValueOrDefault(d.Year) + 1;
                yearChangeDay[d.Year] = d.Day;
            }
            prevMonth = month;
            prevYear = year;
        }

        Assert.All(Enumerable.Range(1901, 199), y => Assert.Equal(12, monthChanges.GetValueOrDefault(y)));
        Assert.All(Enumerable.Range(1901, 199), y => Assert.Equal(1, yearChanges.GetValueOrDefault(y)));

        // 2/6 에 바뀌는 해 = 발표된 입춘이 2/5 정오 뒤인 네 해(위 표). 2/3 에 바뀌는 해에는 가장 이른 2097년이 든다
        Assert.Equal(new[] { 1904, 1908, 1912, 1916 }, yearChangeDay.Where(kv => kv.Value == 6).Select(kv => kv.Key).OrderBy(y => y));
        Assert.Equal(3, yearChangeDay[2097]);
        Assert.Equal(5, yearChangeDay[1920]);
    }

    // ── P0-c — 시각 없이 넣은 날이 절기가 드는 날이면 알려 준다 · 시각이 없으면 낮 12시 기준 ─────────

    [Theory]
    [InlineData(2024, 2, 4, "입춘", "癸卯", "乙丑")]  // 입춘 17:27 — 낮 12시에는 아직 묵은 해·묵은 달
    [InlineData(2024, 6, 5, "망종", "甲辰", "己巳")]  // 망종 13:10 — 낮 12시에는 아직 巳월
    [InlineData(2024, 8, 7, "입추", "甲辰", "壬申")]  // 입추 09:09 — 낮 12시에는 이미 申월
    [InlineData(2024, 10, 8, "한로", "甲辰", "甲戌")] // 한로 04:00 — B2 구간의 절
    public void P0c_NoTime_TermOnBirthDay_AndNoonReference(int y, int m, int d, string expectedTerm, string expectedYear, string expectedMonth)
    {
        // 절입 시각은 한국천문연구원 2024년 발표값(UTC+9). 시험한 날의 절입 순간은 낮 12시에서 한 시간 넘게, 자정에서 네 시간 넘게 떨어져 있다
        var chart = _service.CalculateChart(new DateTime(y, m, d), null, null);
        Assert.Equal(expectedTerm, chart.TermOnBirthDay);
        Assert.Equal(expectedYear, GanJi(chart.YearPillar));
        Assert.Equal(expectedMonth, GanJi(chart.MonthPillar));
    }

    [Theory]
    [InlineData(2024, 2, 3)]   // 입춘 전날
    [InlineData(2024, 2, 5)]   // 입춘 다음 날
    [InlineData(2024, 1, 20)]  // 대한(23:07) — 중기(中氣)는 월주를 가르지 않는다
    [InlineData(2024, 2, 19)]  // 우수(13:13) — 중기
    [InlineData(2024, 6, 15)]
    public void P0c_NoTime_OrdinaryDay_HasNoTerm(int y, int m, int d)
    {
        Assert.Null(_service.CalculateChart(new DateTime(y, m, d), null, null).TermOnBirthDay);
    }

    // ── 알려진 정밀도 한계 — 절입 순간이 낮 12시에서 몇 분 안인 날(시각 없는 입력) ─────────
    //
    // 시각 없는 입력은 그날 낮 12시로 연·월주를 정한다. 절입 순간이 정오에서 계산기 오차(발표값보다 13분 이르게 ~ 9분 늦게 —
    // SolarTermCalculatorTests) 안에 드는 날은 그날 전체의 월주(입춘이면 연주도)가 계산기 값 쪽으로 정해진다(2026-11-19 대조 — 설계 §17-8).
    // 1900~2099년 절입 2,400건 가운데 계산값과 발표값이 정오를 사이에 두고 갈리는 날은 닷새다
    // (발표값 = 일본 국립천문대 역계산실 '天象 長期版' UT+9, 괄호 안이 계산기 값):
    //   1918-01-06 소한 12:04(11:58) · 1988-01-06 소한 12:04(11:56) · 2020-03-05 경칩 11:57(12:03) ·
    //   2080-07-06 소서 12:07(12:00) · 2086-03-05 경칩 12:05(11:58)
    // 이 닷새의 시각 없는 원국은 월주가 발표값 기준과 한 달 다르다(계산 → 발표값 기준: 1918-01-06 癸丑 → 壬子 · 1988-01-06 癸丑 → 壬子 ·
    // 2020-03-05 戊寅 → 己卯 · 2080-07-06 癸未 → 壬午 · 2086-03-05 辛卯 → 庚寅). 계산기를 고정밀(ΔT·고정밀 황경식 또는 절입 시각 표)로
    // 바꾸기 전까지 알려진 한계로 둔다 — 여기서는 월주를 단언하지 않고(틀린 쪽을 골든으로 굳히지 않는다) 그날 절기 안내가 뜨는 것만 지킨다:
    // 정오가 걸리는 날은 그날 안에 절입 순간이 있어, 화면이 '태어난 시각에 따라 월주가 달라질 수 있다'고 알린다.
    // 계산기를 고친 뒤에는 위 월주(발표값 기준)를 이 테스트에 단언으로 더할 것.
    //
    // 절입 순간이 자정에서 몇 분 안인 일곱 건은 절기 안내가 발표값 기준 날짜의 옆 날에 뜬다(시각 없는 원국은 같다 — 낮 12시 기준이라서):
    //   1919 입추 08-08 23:58(계산 08-09 00:00) · 1953 소한 01-06 00:02(01-05 23:56) · 1982 한로 10-09 00:02(10-08 23:57) ·
    //   2013 청명 04-05 00:02(04-04 23:51) · 2023 소한 01-06 00:05(01-05 23:56) · 2031 입동 11-08 00:06(11-07 23:55) ·
    //   2064 입동 11-07 00:02(11-06 23:56)
    // 시각을 넣은 입력은 계산값과 발표값 사이의 몇 분(200년 합계 8,955분 — 전체의 0.0085%, 그 가운데 입춘 712분)에 태어났을 때만
    // 월주(입춘이면 연주도)가 발표값 기준과 다르다.
    [Theory]
    [InlineData(1918, 1, 6, "소한")]
    [InlineData(1988, 1, 6, "소한")]
    [InlineData(2020, 3, 5, "경칩")]
    [InlineData(2080, 7, 6, "소서")]
    [InlineData(2086, 3, 5, "경칩")]
    public void P0c_KnownPrecisionLimit_TermMinutesFromNoon_StillShowsTheTermNotice(int y, int m, int d, string expectedTerm)
    {
        Assert.Equal(expectedTerm, _service.CalculateChart(new DateTime(y, m, d), null, null).TermOnBirthDay);
    }

    // 여유가 얇지만 발표값과 같은 쪽인 날 — 계산기를 바꾼 뒤 여기서 실패하면 테스트가 아니라 계산을 볼 것.
    //   1986-02-04 입춘 발표 12:08(계산기 12:02 — 정오에서 2분): 낮 12시는 입춘 전 → 묵은 해 乙丑년 己丑월
    //   1916-02-05 입춘 발표 12:14(계산기 12:08 — 정오에서 8분): 낮 12시는 입춘 전 → 묵은 해 乙卯년 己丑월
    // 기대값 손 계산: 1985년 = 乙丑 · 1915년 = 乙卯((해 − 4) mod 60 = 1 · 51), 乙년의 寅월은 戊寅(오호둔)이라 그 열두째 달 丑월은 己丑.
    [Theory]
    [InlineData(1986, 2, 4, "乙丑", "己丑")]
    [InlineData(1916, 2, 5, "乙卯", "己丑")]
    public void P0c_NoTime_LichunMinutesAfterNoon_StaysInTheOldYear(int y, int m, int d, string expectedYear, string expectedMonth)
    {
        var chart = _service.CalculateChart(new DateTime(y, m, d), null, null);
        Assert.Equal("입춘", chart.TermOnBirthDay);
        Assert.Equal(expectedYear, GanJi(chart.YearPillar));
        Assert.Equal(expectedMonth, GanJi(chart.MonthPillar));
    }

    [Fact]
    public void P0c_TermOnBirthDay_IsExactlyTheDaysWhereTimeChangesTheMonthPillar()
    {
        // 절기 안내가 뜨는 날 = 그날 안에서 태어난 시각에 따라 월주가 갈리는 날. 절입 순간은 분 단위라
        // '전날 23:59 의 월주 ≠ 이날 23:59 의 월주' 와 '이날 0시~24시 안에 절입 순간이 있다'가 같은 말이다.
        // 해마다 정확히 12번, 소한 → 입춘 → … → 대설 순서. 입춘 날에는 연주도 갈린다.
        var order = new[] { "소한", "입춘", "경칩", "청명", "입하", "망종", "소서", "입추", "백로", "한로", "입동", "대설" };
        var late = new TimeSpan(23, 59, 0);
        for (int year = 2015; year <= 2034; year++)
        {
            var seen = new List<string>();
            for (var d = new DateTime(year, 1, 1); d.Year == year; d = d.AddDays(1))
            {
                var term = _service.CalculateChart(d, null, null).TermOnBirthDay;
                var before = _service.CalculateChart(d.AddDays(-1), late, "seoul");
                var after = _service.CalculateChart(d, late, "seoul");
                bool monthSplits = before.MonthPillar.BranchChar != after.MonthPillar.BranchChar;
                Assert.True((term != null) == monthSplits, $"{d:yyyy-MM-dd}: 절기 안내 {term ?? "없음"} · 월주 갈림 {monthSplits}");
                bool yearSplits = GanJi(before.YearPillar) != GanJi(after.YearPillar);
                Assert.Equal(term == "입춘", yearSplits);
                if (term != null) seen.Add(term);
            }
            Assert.Equal(order, seen);
        }
    }

    // ── B4 — 강약 가중치는 값이 아니라 자리로 ─────────────────────────

    [Fact]
    public void P0_B4_SameGanJiPillars_WeightByPosition()
    {
        // 네 기둥이 모두 丙寅인 가짜 원국 — P0 전 코드는 record 값 비교(pillar == chart.MonthPillar)라 연지·일지·시지가 모두 월지로 읽혀 ×3
        var p = Pillar("丙", "寅");
        var chart = new SajuChart { YearPillar = p, MonthPillar = p, DayPillar = p, HourPillar = p };
        Assert.Equal(10, ExpectedStrengthByPosition(chart)); // 손 계산: 천간 丙 셋 +3, 지지 寅(木生火) 연 1 + 월 3 + 일 2 + 시 1 = +7 — 값 비교였다면 +3 + 3×4 = 15
        Assert.Equal(ExpectedStrengthByPosition(chart), new YongshinCalculationService().Calculate(chart).StrengthScore);

        // 시주 = 월주(같은 간지)·연주 = 일주(같은 간지) — 값 비교였다면 시지가 ×3, 연지가 ×2
        var mixed = new SajuChart
        {
            YearPillar = Pillar("甲", "子"), MonthPillar = Pillar("庚", "申"),
            DayPillar = Pillar("甲", "子"), HourPillar = Pillar("庚", "申"),
        };
        // 손 계산: 천간 甲 +1 · 庚 −1 · 庚 −1, 지지 연 子(水生木) +1 · 월 申(金克木) −3 · 일 子 +2 · 시 申 −1 = −2 (값 비교였다면 연지 ×2·시지 ×3 → −3)
        Assert.Equal(-2, ExpectedStrengthByPosition(mixed));
        Assert.Equal(-2, new YongshinCalculationService().Calculate(mixed).StrengthScore);

        // 월주 = 일주(己卯) — 1990-03-15 14:30 부산과 같은 꼴(설계 §2-2: −4, P0 전 −5)
        var real = new SajuChart
        {
            YearPillar = Pillar("庚", "午"), MonthPillar = Pillar("己", "卯"),
            DayPillar = Pillar("己", "卯"), HourPillar = Pillar("辛", "未"),
        };
        Assert.Equal(-4, ExpectedStrengthByPosition(real)); // 손 계산 확인(검사 대상과 무관)
        Assert.Equal(-4, new YongshinCalculationService().Calculate(real).StrengthScore);
    }

    // 손 표 — 천간·지지 오행(SajuData 를 읽지 않는다)
    private static readonly Dictionary<string, string> StemElementByHand = new()
    {
        ["甲"] = "木", ["乙"] = "木", ["丙"] = "火", ["丁"] = "火", ["戊"] = "土",
        ["己"] = "土", ["庚"] = "金", ["辛"] = "金", ["壬"] = "水", ["癸"] = "水",
    };
    private static readonly Dictionary<string, string> BranchElementByHand = new()
    {
        ["子"] = "水", ["丑"] = "土", ["寅"] = "木", ["卯"] = "木", ["辰"] = "土", ["巳"] = "火",
        ["午"] = "火", ["未"] = "土", ["申"] = "金", ["酉"] = "金", ["戌"] = "土", ["亥"] = "水",
    };
    private const string GeneratingCycle = "木火土金水"; // 木→火→土→金→水→木

    private static SajuPillar Pillar(string stem, string branch) =>
        new(stem, stem, branch, branch, StemElementByHand[stem], "");

    /// <summary>억부 ±1 — 일간과 같은 오행·일간을 생하는 오행 +1, 나머지(일간이 생·극하거나 일간을 극함) −1</summary>
    private static int Sign(string dayElement, string other)
    {
        int day = GeneratingCycle.IndexOf(dayElement, StringComparison.Ordinal);
        int o = GeneratingCycle.IndexOf(other, StringComparison.Ordinal);
        return o == day || o == (day + 4) % 5 ? +1 : -1;
    }

    /// <summary>자리 가중치 손 계산 — 천간(일간 제외) 1, 지지 연 1·월 3·일 2·시 1</summary>
    private static int ExpectedStrengthByPosition(SajuChart c)
    {
        var day = StemElementByHand[c.DayPillar.StemChar];
        int score = Sign(day, StemElementByHand[c.YearPillar.StemChar]) + Sign(day, StemElementByHand[c.MonthPillar.StemChar])
                  + Sign(day, BranchElementByHand[c.YearPillar.BranchChar]) * 1
                  + Sign(day, BranchElementByHand[c.MonthPillar.BranchChar]) * 3
                  + Sign(day, BranchElementByHand[c.DayPillar.BranchChar]) * 2;
        if (c.HourPillar != null)
            score += Sign(day, StemElementByHand[c.HourPillar.StemChar]) + Sign(day, BranchElementByHand[c.HourPillar.BranchChar]) * 1;
        return score;
    }

    private static string RepoRoot()
    {
        foreach (var start in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
            for (var dir = new DirectoryInfo(start); dir != null; dir = dir.Parent)
                if (File.Exists(Path.Combine(dir.FullName, "NameForm.csproj"))) return dir.FullName;
        throw new InvalidOperationException("저장소 루트(NameForm.csproj)를 찾지 못함");
    }
}
