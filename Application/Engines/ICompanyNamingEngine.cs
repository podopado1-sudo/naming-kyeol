namespace NameForm.Application.Engines;

/// <summary>
/// 상호(회사명·가게명·브랜드명) 작명 엔진 인터페이스.
///
/// 인명 엔진과 의도적으로 계약을 분리한다:
///  - 성씨가 없다 → 성+이름 연음 평가(AestheticEngine 30점)가 성립하지 않는다
///  - 글자 풀에 법적 제약이 없다 → 인명용 한자 9,595자에 갇히지 않는다
///  - 평가축이 다르다 → 미학·조화가 아니라 기억성·발음·식별력·업종적합·확장성
/// </summary>
public interface ICompanyNamingEngine
{
    /// <summary>
    /// 상호 후보 생성
    /// </summary>
    /// <param name="industry">업종 코드 (CompanyNamingData.Industries의 키)</param>
    /// <param name="keywords">담고 싶은 키워드 0~3개 (선택)</param>
    /// <param name="tone">톤: modern, classic, warm, premium, playful</param>
    /// <param name="style">생성 축: hanja, pure-korean, english, all</param>
    /// <param name="syllables">선호 음절 수 (0 = 무관, 2~4)</param>
    /// <param name="count">생성할 후보 수 (1~50)</param>
    Task<CompanyNamingResult> GenerateAsync(
        string industry,
        IReadOnlyList<string> keywords,
        string tone,
        string style,
        int syllables,
        int count);
}

/// <summary>상호 작명 결과 묶음</summary>
public class CompanyNamingResult
{
    /// <summary>업종 코드</summary>
    public string Industry { get; set; } = string.Empty;

    /// <summary>업종 한글 라벨 (예: "카페 · 디저트")</summary>
    public string IndustryLabel { get; set; } = string.Empty;

    /// <summary>이 업종에서 상호 뒤에 흔히 붙는 말 (예: "카페", "커피") — 상호 예시 조립에 사용</summary>
    public List<string> IndustrySuffixes { get; set; } = new();

    /// <summary>
    /// 입력한 키워드에 대한 안내 (없으면 빈 목록).
    ///
    /// 후보별 Cautions는 실사용에서 뜨지 않는다 — 식별력 감점이 커서
    /// 경고 대상이 애초에 상위에 못 올라오기 때문이다. 그래서 "왜 그 말을 안 썼는지"는
    /// 카드가 아니라 여기서 한 번 알려준다.
    /// </summary>
    public List<string> KeywordNotices { get; set; } = new();

    /// <summary>후보 목록 (총점 내림차순)</summary>
    public List<CompanyNameCandidate> Candidates { get; set; } = new();

    /// <summary>총 후보 수</summary>
    public int TotalCount { get; set; }
}

/// <summary>상호 후보 하나</summary>
public class CompanyNameCandidate
{
    /// <summary>상호 (한글 표기) — 예: "온담"</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>생성 축: hanja, pure-korean, english</summary>
    public string Style { get; set; } = string.Empty;

    /// <summary>축 한글 라벨: "한자 조합", "순우리말", "영문 조어"</summary>
    public string StyleLabel { get; set; } = string.Empty;

    /// <summary>한자 표기 (한자형만, 그 외 null) — 예: "溫潭"</summary>
    public string? Hanja { get; set; }

    /// <summary>글자별 풀이 (한자형: 자별 훈 / 순우리말: 어근별 뜻 / 영문형: 어근 유래)</summary>
    public List<CompanyNamePart> Parts { get; set; } = new();

    /// <summary>상호 전체 뜻 한 줄 — 예: "따뜻함이 고이는 자리"</summary>
    public string Meaning { get; set; } = string.Empty;

    /// <summary>로마자/영문 표기 — 예: "Ondam"</summary>
    public string Romanization { get; set; } = string.Empty;

    /// <summary>상호 사용 예시 2~3개 — 예: ["온담 카페", "주식회사 온담"]</summary>
    public List<string> UsageExamples { get; set; } = new();

    /// <summary>총점 0~100</summary>
    public int TotalScore { get; set; }

    /// <summary>축별 점수</summary>
    public CompanyScoreBreakdown Scores { get; set; } = new();

    /// <summary>추천 이유 2~3줄</summary>
    public List<string> Reasons { get; set; } = new();

    /// <summary>주의사항 (식별력 약함 등) — 없으면 빈 목록</summary>
    public List<string> Cautions { get; set; } = new();
}

/// <summary>상호 후보의 구성 요소 하나 (한자 1자 / 어근 1개)</summary>
public class CompanyNamePart
{
    /// <summary>표기 — 한자형이면 한자 1자, 그 외 어근 표기</summary>
    public string Symbol { get; set; } = string.Empty;

    /// <summary>한글 읽기</summary>
    public string Reading { get; set; } = string.Empty;

    /// <summary>뜻</summary>
    public string Meaning { get; set; } = string.Empty;
}

/// <summary>
/// 상호 점수 분해 (합계 100).
/// 인명의 미학 70 : 조화 30 과 달리, 사업자에게 실질적인 축으로 재구성했다.
/// </summary>
public class CompanyScoreBreakdown
{
    /// <summary>기억성 0~30 — 음절 수, 발음 난이도, 리듬</summary>
    public int Memorability { get; set; }

    /// <summary>발음 0~25 — 자음 충돌, 연음, 모음 단조로움, 받침 과다</summary>
    public int Pronunciation { get; set; }

    /// <summary>식별력 0~25 — 일반명사·업종어 회피, 조어성. 상표 등록 가능성과 검색 노출의 기반</summary>
    public int Distinctiveness { get; set; }

    /// <summary>업종 적합 0~20 — 선택한 업종의 의미 축·톤과의 일치</summary>
    public int IndustryFit { get; set; }
}
