namespace NameForm.Domain.Models.Saju;

/// <summary>
/// 용신 분석 결과 (억부법 + 조후법 병행)
/// </summary>
public class YongshinResult
{
    /// <summary>일간 강약 (신강/신약/중화)</summary>
    public DayMasterStrength Strength { get; init; }

    /// <summary>억부법 강약 점수 (양수=신강 방향, 음수=신약 방향)</summary>
    public int StrengthScore { get; init; }

    /// <summary>억부 용신 오행 (木/火/土/金/水)</summary>
    public string EokbuYongshin { get; init; } = string.Empty;

    /// <summary>조후 용신 오행 (없으면 null)</summary>
    public string? JohuYongshin { get; init; }

    /// <summary>최종 용신 (억부+조후 종합)</summary>
    public string PrimaryYongshin { get; init; } = string.Empty;

    /// <summary>희신 — 용신을 생조하는 오행</summary>
    public string Heeshin { get; init; } = string.Empty;

    /// <summary>기신 — 용신을 극하는 오행</summary>
    public string Gishin { get; init; } = string.Empty;

    /// <summary>한글 강약 설명</summary>
    public string StrengthDescription { get; init; } = string.Empty;

    /// <summary>용신 선택 이유</summary>
    public string YongshinReason { get; init; } = string.Empty;
}

public enum DayMasterStrength
{
    Strong,   // 신강
    Weak,     // 신약
    Balanced  // 중화
}
