using NameForm.Domain.Models;

namespace NameForm.Application.Engines;

/// <summary>
/// 최종 점수 계산 및 랭킹 엔진
/// finalScore = aesthetic * 0.7 + harmony * 0.3
/// </summary>
public interface IRankerEngine
{
    Task<List<Candidate>> RankCandidatesAsync(List<Candidate> candidates, string? preferredFiveElement = null);
}
