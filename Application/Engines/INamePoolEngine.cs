namespace NameForm.Application.Engines;

/// <summary>
/// 이름 후보 생성 엔진
/// 금칙어/생활어 충돌 1차 필터링 포함
/// </summary>
public interface INamePoolEngine
{
    Task<List<string>> GenerateCandidatesAsync(
        string lastName,
        DateTime birthDate,
        string gender,
        string tone,
        int nameLength = 2,
        IReadOnlyList<string>? preferredMeanings = null);
}
