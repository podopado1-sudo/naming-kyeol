namespace NameForm.Application.DTOs;

public class NameAnalysisResponseDto
{
    /// <summary>전체 이름 (성+이름)</summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>미학 점수 (0-100)</summary>
    public int AestheticScore { get; set; }

    /// <summary>조화 점수 (0-100, BirthDate 미제공 시 null)</summary>
    public int? HarmonyScore { get; set; }

    /// <summary>유니크 지수 (0-100)</summary>
    public int RarityScore { get; set; }

    /// <summary>최종 점수 (미학*0.7 + 조화*0.3, 조화 없으면 미학 점수)</summary>
    public int FinalScore { get; set; }

    /// <summary>음절별 한자 분석</summary>
    public List<HanjaBreakdownDto> HanjaBreakdown { get; set; } = new();

    /// <summary>이름의 강점</summary>
    public List<string> Strengths { get; set; } = new();

    /// <summary>이름의 약점</summary>
    public List<string> Weaknesses { get; set; } = new();

    /// <summary>추천 이유 (ExplanationEngine)</summary>
    public List<string> Reasons { get; set; } = new();

    /// <summary>뒤집기/변형 이름 목록</summary>
    public List<NameVariantDto> ReversalVariants { get; set; } = new();

    /// <summary>사주 원국 (BirthDate 제공 시)</summary>
    public SajuChartDto? Saju { get; set; }

    /// <summary>음령오행 분석 (음절별 초성 오행)</summary>
    public EumryeongAnalysisDto? EumryeongAnalysis { get; set; }
}

public class EumryeongAnalysisDto
{
    /// <summary>음절별 음령오행 (순서대로)</summary>
    public List<EumryeongSyllableDto> Syllables { get; set; } = new();

    /// <summary>오행별 음절 수</summary>
    public Dictionary<string, int> ElementCount { get; set; } = new();

    /// <summary>대표 오행 (가장 많은 오행, 동수면 첫 번째)</summary>
    public string? DominantElement { get; set; }
}

public class EumryeongSyllableDto
{
    /// <summary>음절 (예: "민")</summary>
    public string Syllable { get; set; } = string.Empty;

    /// <summary>초성 (예: "ㅁ")</summary>
    public string Initial { get; set; } = string.Empty;

    /// <summary>음령오행 (예: "水")</summary>
    public string? FiveElement { get; set; }
}

public class SajuChartDto
{
    public SajuPillarDto YearPillar { get; set; } = null!;
    public SajuPillarDto MonthPillar { get; set; } = null!;
    public SajuPillarDto DayPillar { get; set; } = null!;
    public SajuPillarDto? HourPillar { get; set; }
    public Dictionary<string, int> FiveElementCount { get; set; } = new();
    public List<string> MissingElements { get; set; } = new();
    public string StrongestElement { get; set; } = string.Empty;
    public string DayMaster { get; set; } = string.Empty;
    public string BirthplaceName { get; set; } = string.Empty;
    public int CorrectionMinutes { get; set; }

    /// <summary>용신 분석 결과 (억부법 + 조후법)</summary>
    public YongshinDto? Yongshin { get; set; }
}

public class YongshinDto
{
    /// <summary>신강/신약/중화</summary>
    public string Strength { get; set; } = string.Empty;

    /// <summary>억부법 강약 점수</summary>
    public int StrengthScore { get; set; }

    /// <summary>억부 용신 오행 (木/火/土/金/水)</summary>
    public string EokbuYongshin { get; set; } = string.Empty;

    /// <summary>조후 용신 오행 (없으면 null)</summary>
    public string? JohuYongshin { get; set; }

    /// <summary>최종 용신 오행</summary>
    public string PrimaryYongshin { get; set; } = string.Empty;

    /// <summary>희신 오행</summary>
    public string Heeshin { get; set; } = string.Empty;

    /// <summary>기신 오행</summary>
    public string Gishin { get; set; } = string.Empty;

    /// <summary>강약 설명 (한글)</summary>
    public string StrengthDescription { get; set; } = string.Empty;

    /// <summary>용신 선택 이유 (한글)</summary>
    public string YongshinReason { get; set; } = string.Empty;

    /// <summary>이름 한자 후보 중 용신 오행 존재 여부</summary>
    public bool? NameFitsYongshin { get; set; }
}

public class SajuPillarDto
{
    public string StemChar { get; set; } = string.Empty;    // 甲
    public string StemName { get; set; } = string.Empty;    // 갑
    public string BranchChar { get; set; } = string.Empty;  // 子
    public string BranchName { get; set; } = string.Empty;  // 자
    public string FiveElement { get; set; } = string.Empty; // 木
    public string YinYang { get; set; } = string.Empty;     // 陽
}

public class HanjaBreakdownDto
{
    /// <summary>한글 음절 (예: "민")</summary>
    public string Syllable { get; set; } = string.Empty;

    /// <summary>가능한 한자 목록</summary>
    public List<HanjaOptionDto> PossibleHanja { get; set; } = new();
}

public class HanjaOptionDto
{
    /// <summary>한자 문자 (예: "民")</summary>
    public string Character { get; set; } = string.Empty;

    /// <summary>한자 의미 (예: "백성 민")</summary>
    public string Meaning { get; set; } = string.Empty;

    /// <summary>오행 (木/火/土/金/水)</summary>
    public string? FiveElement { get; set; }

    /// <summary>카테고리 (자연/덕목/개념)</summary>
    public string? Category { get; set; }

    /// <summary>획수 (표시용)</summary>
    public int? StrokeCount { get; set; }

    /// <summary>강희자전 원획수 (원획법 적용)</summary>
    public int? KangxiStrokes { get; set; }

    /// <summary>오행 판정 신뢰도: S=검수완료, A=규칙기반, B=수동입력, D=획수자동</summary>
    public string ConfidenceGrade { get; set; } = "D";

    /// <summary>오행 판정 근거</summary>
    public string? Rationale { get; set; }
}

public class NameVariantDto
{
    /// <summary>변형된 이름</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>변형 유형 ("반전", "재조합", "음절교환")</summary>
    public string VariationType { get; set; } = string.Empty;

    /// <summary>설명</summary>
    public string Description { get; set; } = string.Empty;
}
