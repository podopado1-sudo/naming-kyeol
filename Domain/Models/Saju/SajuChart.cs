namespace NameForm.Domain.Models.Saju;

/// <summary>
/// 사주 원국 (四柱原局)
/// </summary>
public class SajuChart
{
    /// <summary>년주 (年柱)</summary>
    public SajuPillar YearPillar { get; init; } = null!;

    /// <summary>월주 (月柱)</summary>
    public SajuPillar MonthPillar { get; init; } = null!;

    /// <summary>일주 (日柱)</summary>
    public SajuPillar DayPillar { get; init; } = null!;

    /// <summary>시주 (時柱) — 선택</summary>
    public SajuPillar? HourPillar { get; init; }

    /// <summary>일간 (日干) — 나를 나타내는 천간</summary>
    public string DayMaster => DayPillar.StemChar;

    /// <summary>오행 분포 (각 오행 개수)</summary>
    public Dictionary<string, int> FiveElementCount { get; init; } = new();

    /// <summary>부족한 오행 (0개)</summary>
    public List<string> MissingElements =>
        FiveElementCount.Where(kv => kv.Value == 0).Select(kv => kv.Key).ToList();

    /// <summary>강한 오행 (최다)</summary>
    public string StrongestElement =>
        FiveElementCount.OrderByDescending(kv => kv.Value).First().Key;

    /// <summary>출생지 이름</summary>
    public string BirthplaceName { get; init; } = "서울";

    /// <summary>진태양시 보정값 (분)</summary>
    public int CorrectionMinutes { get; init; }
}
