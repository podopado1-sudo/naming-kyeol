using NameForm.Application.Services;
using NameForm.Domain.Models.Saju;

namespace NameForm.Tests;

/// <summary>
/// 테스트용 ISajuCalculationService 스텁 — 실제 계산 없이 고정 오행 분포 반환
/// </summary>
public class FakeSajuCalculationService : ISajuCalculationService
{
    private static readonly SajuPillar DummyPillar =
        new("甲", "갑", "子", "자", "木", "陽");

    public SajuChart CalculateChart(DateTime birthDate, TimeSpan? birthTime = null, string? birthplaceCode = null)
    {
        return new SajuChart
        {
            YearPillar  = DummyPillar,
            MonthPillar = DummyPillar,
            DayPillar   = DummyPillar,
            HourPillar  = null,
            FiveElementCount = new Dictionary<string, int>
            {
                ["木"] = 3, ["火"] = 1, ["土"] = 1, ["金"] = 1, ["水"] = 0
            }
        };
    }
}

/// <summary>
/// 테스트용 IYongshinCalculationService 스텁 — 고정 용신 반환 (PrimaryYongshin=水, Heeshin=金, Gishin=土)
/// </summary>
public class FakeYongshinCalculationService : IYongshinCalculationService
{
    public string PrimaryYongshin { get; init; } = "水";
    public string Heeshin { get; init; } = "金";
    public string Gishin { get; init; } = "土";

    public YongshinResult Calculate(SajuChart chart)
    {
        return new YongshinResult
        {
            Strength = DayMasterStrength.Weak,
            StrengthScore = -10,
            EokbuYongshin = PrimaryYongshin,
            JohuYongshin = null,
            PrimaryYongshin = PrimaryYongshin,
            Heeshin = Heeshin,
            Gishin = Gishin,
            StrengthDescription = "test",
            YongshinReason = "test",
        };
    }
}
