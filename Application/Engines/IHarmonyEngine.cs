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

    /// <summary>
    /// 출생일로만 정해지는 오행 쪽 사정 — 용신·희신·기신, 사주에 부족한·많은 오행, 사주 글자의 오행 개수(2026-11 한자 입력).
    /// 점수 계산이 쓴 값 그대로이고 한자와 무관하다. 응답 hanjaSummary 의 elementFit·fills 가 이 값에서 나온다.
    /// 조화를 계산하지 않았거나(출생일 없음) 사주를 못 구했으면 null.
    /// </summary>
    public NameForm.Application.Engines.Utils.ElementFit? ElementFit { get; set; }
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
    /// <param name="picks">사용자가 정한 한자(/evaluate 한자 입력 — 2026-11). null 이면 지정 없음: 예전처럼 전 음절을 자동 배정하고
    /// 노트 문장도 그대로다. 있으면 자동 배정을 똑같이 먼저 구한 뒤 사용자가 정한 칸만 덮어쓴다.</param>
    Task<HarmonyBreakdown> CalculateScoreWithBreakdownAsync(
        string name,
        string lastName,
        DateTime birthDate,
        string gender,
        TimeSpan? birthTime = null,
        NameForm.Application.Engines.Utils.HanjaPicks? picks = null);
}
