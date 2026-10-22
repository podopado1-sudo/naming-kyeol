using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Engines;

/// <summary>
/// 조화 점수 계산 결과 상세 분석
/// </summary>
public class HarmonyBreakdown
{
    public int FiveElementScore { get; set; }           // /30 자원오행 보완 — 배정 한자의 부수 기준 자원오행 ↔ 사주 용신·부족 오행 (필드명 유지)
    public int ResourceElementScore { get; set; }       // /20 획수 조화 — 이름 두 글자 획수 합의 구간(오행 무관). 필드명은 프론트 호환으로 유지(2026-10-22 S4, D7)
    public int YinYangScore { get; set; }               // /10 (음양)
    public int PronunciationElementScore { get; set; }  // /25 (발음오행/음령오행)
    public int SuriSagyeokScore { get; set; }           // /15 (수리사격)
    public int SurnameHarmonyScore { get; set; }        // deprecated (발음오행에 흡수, 항상 0)
    public int GenderBonus { get; set; }
    public int TotalScore { get; set; }
    public bool UsedFallback { get; set; }
    public List<string> Notes { get; set; } = new();

    /// <summary>
    /// 이 이름에 실제로 '배정된' 음절별 한자(용신-인지 선택). 점수·표시·저장이 모두
    /// 이 한자를 쓰도록 단일 진실의 원천으로 노출. 음절에 한자가 없으면 해당 위치 null.
    /// </summary>
    public List<HanjaInfo?> SelectedHanja { get; set; } = new();
}

/// <summary>
/// 출생 정보 기반 조화 점수 계산 엔진 (0~100)
/// MVP에서는 단순 규칙 또는 seed 기반 점수
/// </summary>
public interface IHarmonyEngine
{
    Task<int> CalculateScoreAsync(
        string name,
        string lastName,
        DateTime birthDate,
        string gender,
        TimeSpan? birthTime = null);

    /// <summary>
    /// 상세 분석 포함 조화 점수 계산
    /// </summary>
    Task<HarmonyBreakdown> CalculateScoreWithBreakdownAsync(
        string name,
        string lastName,
        DateTime birthDate,
        string gender,
        TimeSpan? birthTime = null);
}
