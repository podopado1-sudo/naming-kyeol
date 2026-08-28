namespace NameForm.Application.DTOs;

/// <summary>
/// 상호 작명 요청 DTO
/// </summary>
public class CompanyNamingRequestDto
{
    /// <summary>업종 코드 (예: "cafe", "it") — 필수</summary>
    public string Industry { get; set; } = string.Empty;

    /// <summary>담고 싶은 키워드 0~3개 (선택)</summary>
    public List<string> Keywords { get; set; } = new();

    /// <summary>톤 ("modern", "classic", "warm", "premium", "playful")</summary>
    public string Tone { get; set; } = "modern";

    /// <summary>생성 축 ("all", "hanja", "pure-korean", "english")</summary>
    public string Style { get; set; } = "all";

    /// <summary>선호 음절 수 (0 = 무관, 2~4)</summary>
    public int Syllables { get; set; }

    /// <summary>추천 개수 (1~50, 기본 12)</summary>
    public int Count { get; set; } = 12;
}

/// <summary>
/// 상호 작명 응답 DTO
/// </summary>
public class CompanyNamingResponseDto
{
    /// <summary>업종 코드</summary>
    public string Industry { get; set; } = string.Empty;

    /// <summary>업종 한글 라벨</summary>
    public string IndustryLabel { get; set; } = string.Empty;

    /// <summary>상호 뒤에 붙는 말 (사용 예시 조립에 쓰인 것)</summary>
    public List<string> IndustrySuffixes { get; set; } = new();

    /// <summary>입력한 키워드에 대한 안내 (없으면 빈 목록)</summary>
    public List<string> KeywordNotices { get; set; } = new();

    /// <summary>후보 목록 (총점 내림차순)</summary>
    public List<CompanyNameCandidateDto> Candidates { get; set; } = new();

    /// <summary>총 후보 수</summary>
    public int TotalCount { get; set; }
}

/// <summary>상호 후보 DTO</summary>
public class CompanyNameCandidateDto
{
    /// <summary>상호 (한글 표기)</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>생성 축 코드</summary>
    public string Style { get; set; } = string.Empty;

    /// <summary>생성 축 한글 라벨</summary>
    public string StyleLabel { get; set; } = string.Empty;

    /// <summary>한자 표기 (한자형만)</summary>
    public string? Hanja { get; set; }

    /// <summary>구성 요소별 풀이</summary>
    public List<CompanyNamePartDto> Parts { get; set; } = new();

    /// <summary>상호 뜻 한 줄</summary>
    public string Meaning { get; set; } = string.Empty;

    /// <summary>로마자/영문 표기</summary>
    public string Romanization { get; set; } = string.Empty;

    /// <summary>상호 사용 예시</summary>
    public List<string> UsageExamples { get; set; } = new();

    /// <summary>총점 0~100</summary>
    public int TotalScore { get; set; }

    /// <summary>기억성 0~30</summary>
    public int Memorability { get; set; }

    /// <summary>발음 0~25</summary>
    public int Pronunciation { get; set; }

    /// <summary>식별력 0~25</summary>
    public int Distinctiveness { get; set; }

    /// <summary>업종 적합 0~20</summary>
    public int IndustryFit { get; set; }

    /// <summary>추천 이유</summary>
    public List<string> Reasons { get; set; } = new();

    /// <summary>주의사항 (없으면 빈 목록)</summary>
    public List<string> Cautions { get; set; } = new();
}

/// <summary>상호 구성 요소 DTO</summary>
public class CompanyNamePartDto
{
    public string Symbol { get; set; } = string.Empty;
    public string Reading { get; set; } = string.Empty;
    public string Meaning { get; set; } = string.Empty;
}

/// <summary>
/// 상호 작명 입력 옵션 응답 — 프론트 셀렉트를 백엔드 데이터와 일치시킨다.
/// </summary>
public class CompanyNamingOptionsDto
{
    public List<CompanyOptionDto> Industries { get; set; } = new();
    public List<CompanyOptionDto> Tones { get; set; } = new();
    public List<CompanyOptionDto> Styles { get; set; } = new();
}

/// <summary>코드 + 라벨 쌍</summary>
public class CompanyOptionDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}
