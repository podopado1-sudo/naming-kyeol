namespace NameForm.Application.Engines;

/// <summary>
/// 영어+한자 이중 이름 생성 엔진 인터페이스
/// 김필립처럼 영어 이름과 한자 의미가 모두 통하는 이름 생성
/// </summary>
public interface IDualNameEngine
{
    /// <summary>
    /// 영어+한자 이중 이름 후보 생성.
    /// 대표 한자는 같은 (이름, 출생일, 출생 시각, 성별)의 /evaluate 배정(ScoringService.AssignedHanja — 용신 배정 HanjaSelector.Select)과 같다
    /// (2026-10-28). 그래서 같은 영어 이름도 출생일·출생 시각·성별에 따라 한자가 달라진다 — 호출부는 요청의 출생 시각을 넘긴다.
    /// </summary>
    Task<List<DualNameCandidate>> GenerateDualNamesAsync(
        string lastName,
        string? preferredEnglishName,
        DateTime birthDate,
        string gender,
        string tone,
        TimeSpan? birthTime = null);
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

    /// <summary>한자 문자 목록 — 음절마다 하나 (예: 필립 남자·2021-07-08·출생 시각 없음 → ["弼", "粒"])</summary>
    public List<string> HanjaCharacters { get; set; } = new();

    /// <summary>한자 의미 조합 — 음절마다 그 독음의 훈 하나(HanjaData.GlossForReading)를 " + " 로 잇는다 (예: 위 弼粒 → "도울 필 + 낟알 립(입)")</summary>
    public string HanjaMeaning { get; set; } = string.Empty;
}
