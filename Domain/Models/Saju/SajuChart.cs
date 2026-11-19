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

    /// <summary>진태양시 보정값 (분) — 실제로 쓴 값. 출생 시각이 없으면 보정하지 않으므로 0</summary>
    public int CorrectionMinutes { get; init; }

    /// <summary>진태양시 보정을 했는지 — 출생 시각이 있을 때만 true(시각이 없으면 넣은 날짜 그대로 일주를 정한다)</summary>
    public bool CorrectionApplied { get; init; }

    /// <summary>
    /// 시각 없이 넣은 날 안에 12절(월주를 가르는 절기) 절입 순간이 있으면 그 절기 이름(예: "입춘") — 없거나 시각을 넣었으면 null.
    /// 그날은 태어난 시각에 따라 월주(입춘이면 연주도)가 갈린다 — 시각이 없으면 낮 12시 기준으로 정했다는 뜻이다.
    /// </summary>
    public string? TermOnBirthDay { get; init; }
}
