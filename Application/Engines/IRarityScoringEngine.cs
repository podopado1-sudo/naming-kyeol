namespace NameForm.Application.Engines;

/// <summary>
/// 유니크 지수 산출 엔진 인터페이스
/// </summary>
public interface IRarityScoringEngine
{
    /// <summary>
    /// 이름의 유니크 지수 계산 (0-100, 높을수록 희귀함)
    /// </summary>
    Task<int> CalculateRarityScoreAsync(string name);
}
