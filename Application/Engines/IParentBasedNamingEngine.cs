namespace NameForm.Application.Engines;

/// <summary>
/// 부모 기반 작명 엔진 인터페이스
/// </summary>
public interface IParentBasedNamingEngine
{
    /// <summary>
    /// 부모 정보를 기반으로 이름 후보 생성
    /// </summary>
    Task<List<ParentBasedNameCandidate>> GenerateCandidatesAsync(
        string lastName,
        string? fatherSurname,
        string? fatherName,
        string? motherSurname,
        string? motherName,
        string? storyKeyword,
        DateTime birthDate,
        string gender,
        string tone);
}

/// <summary>
/// 부모 기반 이름 후보
/// </summary>
public class ParentBasedNameCandidate
{
    public string Name { get; set; } = string.Empty;
    public string NamingModel { get; set; } = string.Empty; // "윤고은모델", "문소리모델", "신해솜모델", "이수지-박지수모델"
    public string NameType { get; set; } = string.Empty; // "의미중심" 또는 "음운중심"
    public string Description { get; set; } = string.Empty; // 생성 방식 설명
}
