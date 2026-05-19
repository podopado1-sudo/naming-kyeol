using NameForm.Application.Engines.Data;

namespace NameForm.Application.Engines;

/// <summary>
/// 미학 점수 breakdown 구조
/// </summary>
public class AestheticBreakdown
{
    public int PronunciationScore { get; set; } // /30
    public int RhythmScore { get; set; } // /25
    public int SyllableScore { get; set; } // /15
    public int NeutralityScore { get; set; } // /15
    public int MeaningScore { get; set; } // /10
    public int GenderBonus { get; set; } // ±5
    public int ToneBonus { get; set; } // ±8
    public int PenaltyTotal { get; set; } // 감점 합계
    public int TotalScore { get; set; }
    public List<string> Notes { get; set; } = new();

    /// <summary>세대 적합도 결과 (birthYear 제공 시에만 설정)</summary>
    public GenerationFitResult? GenerationFit { get; set; }
}

/// <summary>
/// 미학 점수 계산 엔진 (0~100)
/// 발음 리듬, 받침, 세대 중립성 등을 평가
/// </summary>
public interface IAestheticEngine
{
    Task<int> CalculateScoreAsync(string name, string tone);

    /// <summary>
    /// 전체 이름(성+이름)을 고려한 점수 계산
    /// </summary>
    Task<int> CalculateScoreAsync(string firstName, string? lastName, string tone);

    /// <summary>
    /// gender 포함 점수 계산 — breakdown 경로와 동일한 결과를 보장.
    /// </summary>
    Task<int> CalculateScoreAsync(string firstName, string? lastName, string tone, string gender);

    /// <summary>
    /// gender/tone 반영 + 세부 breakdown 포함 점수 계산
    /// </summary>
    Task<AestheticBreakdown> CalculateScoreWithBreakdownAsync(string firstName, string? lastName, string tone, string gender);

    /// <summary>
    /// gender/tone 반영 + 세부 breakdown + 세대 적합도 포함 점수 계산
    /// birthYear가 제공되면 세대 불일치 감지 로직 활성화
    /// </summary>
    Task<AestheticBreakdown> CalculateScoreWithBreakdownAsync(string firstName, string? lastName, string tone, string gender, int? birthYear);
}
