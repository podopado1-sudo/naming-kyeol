namespace NameForm.Application.Engines.Data;

/// <summary>
/// 절기(節氣) 날짜 계산기 — Jean Meeus "Astronomical Algorithms" 2nd ed. 기반(25장 저정밀 태양 황경 식, 분 아래 버림)
/// 정확도(실측 — 2026-11 P0, docs/plan-ohaeng-2026-11.md §17-4): 발표된 12절 절입 시각(일본 국립천문대 '天象 長期版' UT+9,
/// 한국천문연구원 역서)과 견주면 13분 이르게 ~ 9분 늦게, 평균 3분 이르다(1900~2097년 가운데 56개 해 672건 — 10분을 넘는 것 20건.
/// Tests/SolarTermCalculatorTests 가 그 가운데 열 해를 ±15분(2024년은 ±10분)으로 지킨다). 옛 주석의 '±10분 이내'는 맞지 않았다.
/// 분 단위로 맞추려면 ΔT·고정밀 황경식(또는 절입 시각 표)이 필요하다(따로 잡을 일).
/// 알려진 한계(2026-11-19 대조 — 설계 §17-8): 이 오차 안의 몇 분에 태어난 시각 있는 입력은 월주(입춘이면 연주도)가 옆 달 것으로 나오고
/// (1900~2099년 합계 8,955분 = 전체의 0.0085%), 시각 없는 입력(낮 12시 기준)은 절입이 정오에서 몇 분 안인 닷새
/// (1918-01-06 · 1988-01-06 · 2020-03-05 · 2080-07-06 · 2086-03-05)의 월주가 발표값 기준과 한 달 다르다 — 그날은 절기 안내가 함께 뜬다.
/// 날짜·시각 목록은 Tests/SajuCalculationP0Tests 의 '알려진 정밀도 한계' 절.
/// 돌려주는 값은 모두 UTC 순간이다 — 사주 계산은 출생 순간(UTC)과 그대로 비교한다(서버 시간대와 무관).
/// </summary>
public static class SolarTermCalculator
{
    /// <summary>월주를 가르는 12절 하나 — 이름·그 절부터 시작하는 달의 지지 인덱스·절입 순간(UTC)</summary>
    public readonly record struct MonthTerm(string Name, int BranchIndex, DateTime InstantUtc);

    // 24절기 태양황경 (도)
    // 사주에서 월주를 결정하는 12절(節)만 표시
    private static readonly (string Name, double Longitude)[] SolarTerms =
    [
        ("소한", 285), ("대한", 300),
        ("입춘", 315), ("우수", 330),
        ("경칩", 345), ("춘분",   0),
        ("청명",  15), ("곡우",  30),
        ("입하",  45), ("소만",  60),
        ("망종",  75), ("하지",  90),
        ("소서", 105), ("대서", 120),
        ("입추", 135), ("처서", 150),
        ("백로", 165), ("추분", 180),
        ("한로", 195), ("상강", 210),
        ("입동", 225), ("소설", 240),
        ("대설", 255), ("동지", 270),
    ];

    // 월주 지지(地支) 결정용 12절 (절기 이름 → 지지 인덱스)
    // 입춘(315°) = 인월(寅, 지지 인덱스 2), 경칩(345°) = 묘월(卯, 3), ...
    private static readonly Dictionary<string, int> TermToBranchIndex = new()
    {
        ["입춘"] = 2,  // 寅
        ["경칩"] = 3,  // 卯
        ["청명"] = 4,  // 辰
        ["입하"] = 5,  // 巳
        ["망종"] = 6,  // 午
        ["소서"] = 7,  // 未
        ["입추"] = 8,  // 申
        ["백로"] = 9,  // 酉
        ["한로"] = 10, // 戌
        ["입동"] = 11, // 亥
        ["대설"] = 0,  // 子
        ["소한"] = 1,  // 丑
    };

    /// <summary>
    /// 특정 년도에서 태양황경이 targetLongitude°에 도달하는 순간(UTC)을 계산.
    /// 그 해(year)의 것 = 황경 270° 미만(춘분 0° … 대설 255°)은 3~12월, 270° 초과(소한 285° … 경칩 345°)는 1~3월.
    /// (동지 270° 만은 전년 12월로 나온다 — 12절이 아니어서 쓰는 곳이 없다.)
    /// </summary>
    public static DateTime GetSolarTermDate(int year, double targetLongitude)
    {
        // 춘분(0°)을 기준으로 대략적인 시작일 추정
        // 춘분은 매년 3월 20일경
        var approxDate = new DateTime(year, 3, 20, 0, 0, 0, DateTimeKind.Utc);

        // 270° 미만은 3/20 보다 늦은 날짜로, 270° 이상(소한·대한·입춘·우수·경칩)은 3/20 보다 이른 날짜로 어림한다.
        // 2026-11 P0(B2) 전에는 180° 이상을 모두 이른 날짜로 어림해 한로(195°)·입동(225°)·대설(255°)이 전년도 날짜로 수렴했다
        // — 그 해 10/8 무렵~12/31 의 월지가 늘 酉로 나오던 원인.
        double daysOffset = targetLongitude >= 270
            ? (targetLongitude - 360.0) / 360.0 * 365.25
            : targetLongitude / 360.0 * 365.25;

        var estimatedDate = approxDate.AddDays(daysOffset);

        // Newton-Raphson 반복으로 정밀화 (최대 50회)
        double jde = DateToJde(estimatedDate);
        for (int i = 0; i < 50; i++)
        {
            double lon = GetSunLongitude(jde);
            double diff = targetLongitude - lon;

            // 경계 처리 (0° 근처)
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;

            if (Math.Abs(diff) < 0.0001) break; // 수렴

            // 태양 속도: 약 1°/day
            jde += diff / 360.0 * 365.25;
        }

        return JdeToDate(jde);
    }

    /// <summary>
    /// 그 해(year)의 12절 절입 순간(UTC) — 소한(1월)·입춘(2월) … 대설(12월), 시간 순.
    /// </summary>
    public static IReadOnlyList<MonthTerm> GetMonthTerms(int year)
    {
        var terms = new List<MonthTerm>(TermToBranchIndex.Count);
        foreach (var (name, branchIdx) in TermToBranchIndex)
        {
            var lon = SolarTerms.First(t => t.Name == name).Longitude;
            terms.Add(new MonthTerm(name, branchIdx, GetSolarTermDate(year, lon)));
        }
        terms.Sort((a, b) => a.InstantUtc.CompareTo(b.InstantUtc));
        return terms;
    }

    /// <summary>
    /// 주어진 순간(UTC)의 월주 지지 인덱스 — 그 순간 이전(같거나 앞)의 가장 늦은 12절이 정한다.
    /// 전년·그 해 12절을 함께 본다: 1월 1일~소한 전은 전년 대설이 子월로 만든다(그 해 것만 보면 이 구간에 앞선 절이 없다).
    /// </summary>
    public static int GetMonthBranchIndex(DateTime instantUtc)
    {
        int year = instantUtc.Year;
        MonthTerm? latest = null;
        foreach (var term in GetMonthTerms(year - 1).Concat(GetMonthTerms(year)))
        {
            if (term.InstantUtc <= instantUtc && (latest is null || term.InstantUtc > latest.Value.InstantUtc))
                latest = term;
        }

        // 전년 12절은 모두 instantUtc 앞이라 늘 값이 있다(없다면 계산기 오류 — 조용히 축월로 넘기지 않는다)
        return latest?.BranchIndex
            ?? throw new InvalidOperationException("월주를 정할 절기를 찾지 못했습니다.");
    }

    /// <summary>
    /// [fromUtc, toUtc) 안에 절입 순간이 있는 12절의 이름(없으면 null) — 시각 없이 넣은 날이 절기가 드는 날인지 볼 때 쓴다.
    /// </summary>
    public static string? FindMonthTermWithin(DateTime fromUtc, DateTime toUtc)
    {
        for (int year = fromUtc.Year; year <= toUtc.Year; year++)
        {
            foreach (var term in GetMonthTerms(year))
            {
                if (term.InstantUtc >= fromUtc && term.InstantUtc < toUtc)
                    return term.Name;
            }
        }
        return null;
    }

    /// <summary>
    /// 입춘(315°) 순간(UTC) 반환 — 년주 계산에 사용
    /// </summary>
    public static DateTime GetLichun(int year) =>
        GetSolarTermDate(year, 315);

    // ── 태양황경 계산 (Jean Meeus Chapter 25/27) ──────────────────

    private static double GetSunLongitude(double jde)
    {
        double T = (jde - 2451545.0) / 36525.0; // J2000.0부터의 율리우스 세기

        // 태양의 평균 황경
        double L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
        L0 = NormalizeDegrees(L0);

        // 태양의 평균 근점각
        double M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
        M = NormalizeDegrees(M);
        double Mrad = M * Math.PI / 180;

        // 균차 (Equation of Center)
        double C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.Sin(Mrad)
                 + (0.019993 - 0.000101 * T) * Math.Sin(2 * Mrad)
                 + 0.000289 * Math.Sin(3 * Mrad);

        // 태양의 진황경
        double sunLon = L0 + C;

        // 황도 승교점 (장동 보정)
        double omega = 125.04 - 1934.136 * T;
        double omegaRad = omega * Math.PI / 180;

        // 겉보기 황경 (aberration + nutation 보정)
        double lambda = sunLon - 0.00569 - 0.00478 * Math.Sin(omegaRad);

        return NormalizeDegrees(lambda);
    }

    private static double NormalizeDegrees(double deg)
    {
        deg %= 360;
        if (deg < 0) deg += 360;
        return deg;
    }

    private static double DateToJde(DateTime date)
    {
        // 그레고리력 → 율리우스 적일(JDE)
        int y = date.Year;
        int m = date.Month;
        double d = date.Day + date.TimeOfDay.TotalDays;

        if (m <= 2) { y--; m += 12; }

        int A = y / 100;
        int B = 2 - A + A / 4;

        return Math.Floor(365.25 * (y + 4716))
             + Math.Floor(30.6001 * (m + 1))
             + d + B - 1524.5;
    }

    private static DateTime JdeToDate(double jde)
    {
        // 율리우스 적일 → 그레고리력
        double z = Math.Floor(jde + 0.5);
        double f = jde + 0.5 - z;

        double alpha = Math.Floor((z - 1867216.25) / 36524.25);
        double A = z + 1 + alpha - Math.Floor(alpha / 4);
        double B = A + 1524;
        double C = Math.Floor((B - 122.1) / 365.25);
        double D = Math.Floor(365.25 * C);
        double E = Math.Floor((B - D) / 30.6001);

        double dayFraction = B - D - Math.Floor(30.6001 * E) + f;
        int day = (int)dayFraction;
        int month = E < 14 ? (int)E - 1 : (int)E - 13;
        int year = month > 2 ? (int)C - 4716 : (int)C - 4715;

        double timeFraction = (dayFraction - day) * 24;
        int hour = (int)timeFraction;
        int minute = (int)((timeFraction - hour) * 60);

        return new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Utc);
    }
}
