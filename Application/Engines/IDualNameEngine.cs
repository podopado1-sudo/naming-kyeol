namespace NameForm.Application.Engines;

/// <summary>
/// 영어+한자 이중 이름 생성 엔진 인터페이스
/// 김필립처럼 영어 이름과 한자 의미가 모두 통하는 이름 생성
/// </summary>
public interface IDualNameEngine
{
    /// <summary>
    /// 영어+한자 이중 이름 후보 생성
    /// </summary>
    Task<List<DualNameCandidate>> GenerateDualNamesAsync(
        string lastName,
        string? preferredEnglishName,
        DateTime birthDate,
        string gender,
        string tone);
}

/// <summary>
/// 이중 이름 후보
/// </summary>
public class DualNameCandidate
{
    /// <summary>한국어 이름 (예: "필립")</summary>
    public string KoreanName { get; set; } = string.Empty;

    /// <summary>영어 대응 이름 (예: "Philip")</summary>
    public string EnglishEquivalent { get; set; } = string.Empty;

    /// <summary>한자 문자 목록 (예: ["筆", "立"])</summary>
    public List<string> HanjaCharacters { get; set; } = new();

    /// <summary>한자 의미 조합 (예: "붓 필 + 설 립")</summary>
    public string HanjaMeaning { get; set; } = string.Empty;
}
