namespace NameForm.Application.DTOs;

/// <summary>
/// 이름 평가 통합 결과 DTO — 미학/조화/희귀도 breakdown + 한자 후보 + 설명
/// </summary>
public class NameEvaluationResultDto
{
    public string Name { get; set; } = "";
    public string LastName { get; set; } = "";
    public string FullName => $"{LastName}{Name}";

    public string Gender { get; set; } = "";
    public string Tone { get; set; } = "";

    // 점수
    public int AestheticScore { get; set; }
    public int HarmonyScore { get; set; }
    public int RarityScore { get; set; }
    public int FinalScore { get; set; }

    // Breakdown
    public AestheticBreakdownDto Aesthetic { get; set; } = new();
    public HarmonyBreakdownDto Harmony { get; set; } = new();

    // 한자 후보
    public List<HanjaCandidateGroupDto> HanjaCandidates { get; set; } = new();

    // 설명
    public string Summary { get; set; } = "";
    public List<string> Strengths { get; set; } = new();
    public List<string> Cautions { get; set; } = new();
    public string PronunciationNote { get; set; } = "";
    public string MeaningNote { get; set; } = "";
    public string ToneReason { get; set; } = "";

    // 메타
    public bool UsedFallbackHanja { get; set; }
}

/// <summary>
/// 미학 점수 세부 항목 DTO
/// </summary>
public class AestheticBreakdownDto
{
    public int Pronunciation { get; set; }  // /30
    public int Rhythm { get; set; }         // /25
    public int Syllable { get; set; }       // /15
    public int Neutrality { get; set; }     // /15
    public int Meaning { get; set; }        // /10
    public int GenderBonus { get; set; }
    public int ToneBonus { get; set; }
    public int Penalty { get; set; }
    public int Total { get; set; }
    public List<string> Notes { get; set; } = new();
}

/// <summary>
/// 조화 점수 세부 항목 DTO
/// </summary>
public class HarmonyBreakdownDto
{
    public int FiveElement { get; set; }          // /30 (사주 오행)
    public int ResourceElement { get; set; }      // /20 (자원오행)
    public int YinYang { get; set; }              // /10 (음양)
    public int PronunciationElement { get; set; } // /25 (발음오행)
    public int SuriSagyeok { get; set; }          // /15 (수리사격)
    public int SurnameHarmony { get; set; }       // deprecated, 항상 0
    public int GenderBonus { get; set; }
    public int Total { get; set; }
    public bool UsedFallback { get; set; }
    public List<string> Notes { get; set; } = new();
}

/// <summary>
/// 이름 음절별 한자 후보 그룹
/// </summary>
public class HanjaCandidateGroupDto
{
    public string Syllable { get; set; } = "";
    public List<HanjaCandidateDto> Candidates { get; set; } = new();
}

/// <summary>
/// 한자 후보 개별 항목
/// </summary>
public class HanjaCandidateDto
{
    public string Character { get; set; } = "";
    public string Reading { get; set; } = "";
    public string Meaning { get; set; } = "";
    public string FiveElement { get; set; } = "";
    public string YinYang { get; set; } = "";
    public int StrokeCount { get; set; }
    public int? KangxiStrokes { get; set; }
    /// <summary>오행 판정 신뢰도: S=검수완료, A=규칙기반, B=수동입력, D=획수자동</summary>
    public string ConfidenceGrade { get; set; } = "D";
    public string? Rationale { get; set; }
}

/// <summary>
/// 이름 평가 요청 DTO
/// </summary>
public class NameEvaluateRequestDto
{
    /// <summary>이름 (예: "서윤")</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(10, MinimumLength = 1)]
    public string Name { get; set; } = "";

    /// <summary>성씨 (예: "김")</summary>
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(2, MinimumLength = 1)]
    public string LastName { get; set; } = "";

    /// <summary>출생일 (YYYY-MM-DD)</summary>
    [System.ComponentModel.DataAnnotations.StringLength(10)]
    public string BirthDate { get; set; } = "";

    /// <summary>출생 시각 (HH:mm, 선택). 사주 시주(時柱) 계산에 사용.</summary>
    [System.ComponentModel.DataAnnotations.StringLength(8)]
    public string? BirthTime { get; set; }

    /// <summary>성별 ("male", "female", "none")</summary>
    [System.ComponentModel.DataAnnotations.StringLength(10)]
    public string Gender { get; set; } = "none";

    /// <summary>톤 ("neutral", "soft", "strong")</summary>
    [System.ComponentModel.DataAnnotations.StringLength(10)]
    public string Tone { get; set; } = "neutral";
}
