namespace NameForm.Application.Engines;

/// <summary>
/// 창의적 작명 엔진 인터페이스
/// 성씨의 한자 뜻을 활용해 성+이름이 하나의 문장/구절이 되는 이름을 생성한다.
/// </summary>
public interface ICreativeNamingEngine
{
    Task<List<CreativeNameCandidate>> GenerateCandidatesAsync(
        string lastName,
        string gender,
        string tone,
        int count);
}

/// <summary>
/// 창의적 이름 후보
/// </summary>
public class CreativeNameCandidate
{
    public string Name { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    /// <summary>창작 컨셉 설명</summary>
    public string Concept { get; set; } = string.Empty;
    /// <summary>성씨와의 연결 고리</summary>
    public string SurnameConnection { get; set; } = string.Empty;
    public string Meaning { get; set; } = string.Empty;
    /// <summary>사람 서사형 코이닝 한 문장(NameStoryData). 없으면 빈 문자열 — 프론트가 숨김.</summary>
    public string Story { get; set; } = string.Empty;
    /// <summary>창의성 점수 (0~100)</summary>
    public double CreativityScore { get; set; }
    /// <summary>후보의 성별 태그 (male/female/neutral)</summary>
    public string GenderTag { get; set; } = "neutral";
    /// <summary>후보의 톤 태그 (soft/strong/neutral)</summary>
    public string ToneTag { get; set; } = "neutral";
    /// <summary>성씨 고유(특화) 후보 여부 — true면 범용 풀보다 우선 노출(동질화 완화).</summary>
    public bool SurnameTailored { get; set; }
}
