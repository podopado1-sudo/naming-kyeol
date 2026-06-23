namespace NameForm.Domain.Models;

public class Recommendation
{
    public string Id { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime BirthDate { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string Tone { get; set; } = string.Empty;
    public List<Candidate> TopCandidates { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Candidate
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int AestheticScore { get; set; }
    public int HarmonyScore { get; set; }
    public int FinalScore { get; set; }
    public List<string> Reasons { get; set; } = new();
    
    /// <summary>
    /// 작명 모델 태그 (예: "윤고은모델", "문소리모델", "신해솜모델", "이수지-박지수모델")
    /// </summary>
    public string? NamingModel { get; set; }
    
    /// <summary>
    /// 이름 분류 태그 ("의미중심" 또는 "음운중심")
    /// </summary>
    public string? NameType { get; set; }
    
    /// <summary>
    /// 유니크 지수 (0-100, 높을수록 희귀함)
    /// </summary>
    public int RarityScore { get; set; }

    /// <summary>
    /// 영어 대응 이름 (이중 이름인 경우)
    /// </summary>
    public string? EnglishEquivalent { get; set; }

    /// <summary>
    /// 한자 의미 조합 (이중 이름인 경우)
    /// </summary>
    public string? HanjaMeaning { get; set; }
}
