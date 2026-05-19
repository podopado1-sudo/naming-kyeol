namespace NameForm.Application.Engines.Data;

/// <summary>
/// 절기(節氣) 날짜 계산기 — Jean Meeus "Astronomical Algorithms" 2nd ed. 기반
/// 정확도: ±10분 이내 (1900~2100년 범위)
/// </summary>
public static class SolarTermCalculator
{
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
    /// 특정 년도에서 태양황경이 targetLongitude°에 도달하는 날짜(UTC)를 계산
    /// </summary>
    public static DateTime GetSolarTermDate(int year, double targetLongitude)
    {
        // 춘분(0°)을 기준으로 대략적인 시작일 추정
        // 춘분은 매년 3월 20일경
        var approxDate = new DateTime(year, 3, 20, 0, 0, 0, DateTimeKind.Utc);

        // targetLongitude가 춘분(0°)보다 큰 경우 → 앞으로, 작은 경우 → 뒤로
        double daysOffset = targetLongitude switch
        {
            >= 0 and < 180 => targetLongitude / 360.0 * 365.25,
            >= 180 => (targetLongitude - 360.0) / 360.0 * 365.25,
            < 0 => targetLongitude / 360.0 * 365.25,
            _ => 0
        };

        // 소한(285°), 대한(300°), 입춘(315°)... 은 전년 춘분 기준으로 계산
        if (targetLongitude >= 270)
        {
            daysOffset = (targetLongitude - 360.0) / 360.0 * 365.25;
        }

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
    /// 주어진 날짜의 월주 지지 인덱스 반환 (입춘 기준)
    /// </summary>
    public static int GetMonthBranchIndex(DateTime date)
    {
        // 해당 년도의 12절기 날짜를 계산하고, date가 속하는 구간 찾기
        var year = date.Year;

        var terms = new List<(DateTime Date, int BranchIdx)>();
        foreach (var (name, branchIdx) in TermToBranchIndex)
        {
            var lon = SolarTerms.First(t => t.Name == name).Longitude;
            var termDate = GetSolarTermDate(year, lon);
            terms.Add((termDate, branchIdx));

            // 소한/대한은 다음 해 1월에 있으므로 전년도도 계산
            if (name is "소한" or "대한")
            {
                var prevTermDate = GetSolarTermDate(year - 1, lon);
                terms.Add((prevTermDate, branchIdx));
            }
        }

        // 날짜 정렬 후 해당 구간 찾기
        var sorted = terms.OrderByDescending(t => t.Date).ToList();
        foreach (var (termDate, branchIdx) in sorted)
        {
            if (date >= termDate)
                return branchIdx;
        }

        // 기본값: 축월(1)
        return 1;
    }

    /// <summary>
    /// 입춘(315°) 날짜 반환 — 년주 계산에 사용
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
