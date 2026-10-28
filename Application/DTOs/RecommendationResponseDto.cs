namespace NameForm.Application.DTOs;

public class RecommendationResponseDto
{
    public string Id { get; set; } = string.Empty;
    public List<CandidateDto> TopCandidates { get; set; } = new();
}

public class CandidateDto
{
    public string Name { get; set; } = string.Empty;
    public int AestheticScore { get; set; }
    public int HarmonyScore { get; set; }
    public int FinalScore { get; set; }
    public List<string> Reasons { get; set; } = new();
    
    /// <summary>
    /// 부모 기반 작명 방식 코드 (부모 기반 후보만 — 예: "mother-surname", "parent-syllables", ParentNamingModels). 화면 문구는 <see cref="NamingLabel"/>
    /// </summary>
    public string? NamingModel { get; set; }

    /// <summary>
    /// 부모 기반 작명 방식의 사용자 라벨 (예: "어머니 성씨 잇기") — 태그에는 코드 대신 이 값을 쓴다
    /// </summary>
    public string? NamingLabel { get; set; }
    
    /// <summary>
    /// 이름 분류 태그 ("의미중심"·"음운중심", 부모 기반 후보는 "서사중심"도)
    /// </summary>
    public string? NameType { get; set; }
    
    /// <summary>
    /// 유니크 지수 (0-100, 높을수록 희귀함)
    /// </summary>
    public int RarityScore { get; set; }

    /// <summary>
    /// 영어 대응 이름 (이중 이름인 경우, 예: "Philip")
    /// </summary>
    public string? EnglishEquivalent { get; set; }

    /// <summary>
    /// 한자 의미 조합 (이중 이름인 경우, 예: "붓 필 + 설 립")
    /// </summary>
    public string? HanjaMeaning { get; set; }

    /// <summary>배정된 음절별 한자 글자(예: "友晶"). 용신-인지 선택.</summary>
    public string? Hanja { get; set; }

    /// <summary>카드용 한자 뜻 한 줄(예: "벗 우 · 맑을 정").</summary>
    public string? MeaningText { get; set; }
}
