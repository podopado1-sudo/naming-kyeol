using System.ComponentModel.DataAnnotations.Schema;

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

    /// <summary>
    /// 이 이름에 배정된 음절별 한자 글자(예: "友晶"). HarmonyEngine이 용신-인지로 선택한 것.
    /// 표시용 파생값 — DB 컬럼 미생성([NotMapped])으로 운영 스키마 영향 없음(fresh 응답에서만 사용).
    /// </summary>
    [NotMapped]
    public string? Hanja { get; set; }

    /// <summary>
    /// 카드 표시용 한자 뜻 한 줄(예: "벗 우 · 맑을 정"). 배정된 한자에서 생성. [NotMapped].
    /// </summary>
    [NotMapped]
    public string? MeaningText { get; set; }
}
