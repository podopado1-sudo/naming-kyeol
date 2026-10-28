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
    /// 부모 기반 작명 방식 코드 (예: "mother-surname", "parent-syllables" — 매핑 컬럼 varchar 50). 2026-10-28 전 행은 옛 방식 값이라
    /// 읽는 쪽(RecommendationService.GetRecommendationAsync)이 ParentNamingModels.Normalize 로 바꾼다
    /// </summary>
    public string? NamingModel { get; set; }
    
    /// <summary>
    /// 이름 분류 태그 ("의미중심"·"음운중심", 부모 기반 후보는 "서사중심"도 — varchar 20)
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

    /// <summary>
    /// 음절별 배정 한자 글자 — 이름 음절과 같은 인덱스, 배정 없는 음절은 null(<see cref="Hanja"/>는 이를 이어 붙인 표시값).
    /// RankerEngine 자원오행 보너스가 카드에 보이는 그 한자로 판정하는 입력(2026-10-26 결정 ③). null 이면 배정 한자가 없어 보너스 없음. [NotMapped].
    /// </summary>
    [NotMapped]
    public List<string?>? SyllableHanja { get; set; }
}
