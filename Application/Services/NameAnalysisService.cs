using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Domain.Models.Saju;

namespace NameForm.Application.Services;

/// <summary>
/// 이름 분석/검증 서비스
/// 기존 엔진들을 조합하여 이름의 종합 분석 결과를 제공
/// </summary>
public class NameAnalysisService : INameAnalysisService
{
    private readonly IScoringService _scoringService;
    private readonly IAestheticEngine _aestheticEngine;
    private readonly IRarityScoringEngine _rarityScoringEngine;
    private readonly IExplanationEngine _explanationEngine;
    private readonly INameReversalEngine _nameReversalEngine;
    private readonly ISajuCalculationService _sajuCalculationService;
    private readonly IYongshinCalculationService _yongshinCalculationService;
    private readonly ILogger<NameAnalysisService> _logger;

    public NameAnalysisService(
        IScoringService scoringService,
        IAestheticEngine aestheticEngine,
        IRarityScoringEngine rarityScoringEngine,
        IExplanationEngine explanationEngine,
        INameReversalEngine nameReversalEngine,
        ISajuCalculationService sajuCalculationService,
        IYongshinCalculationService yongshinCalculationService,
        ILogger<NameAnalysisService> logger)
    {
        _scoringService = scoringService;
        _aestheticEngine = aestheticEngine;
        _rarityScoringEngine = rarityScoringEngine;
        _explanationEngine = explanationEngine;
        _nameReversalEngine = nameReversalEngine;
        _sajuCalculationService = sajuCalculationService;
        _yongshinCalculationService = yongshinCalculationService;
        _logger = logger;
    }

    public async Task<NameAnalysisResponseDto> AnalyzeNameAsync(NameAnalysisRequestDto request)
    {
        var firstName = request.FirstName;
        var lastName = request.LastName;
        var fullName = lastName + firstName;
        // gender/tone 정규화 — ScoringService와 동일 규칙
        var tone = ScoringService.NormalizeTone(request.Tone);
        var gender = ScoringService.NormalizeGender(request.Gender);

        _logger.LogInformation("이름 분석 요청: {FullName}", fullName);

        // BirthTime 파싱
        TimeSpan? birthTime = null;
        if (!string.IsNullOrEmpty(request.BirthTime) &&
            TimeSpan.TryParse(request.BirthTime, out var parsedBirthTimeEarly))
        {
            birthTime = parsedBirthTimeEarly;
        }

        // 채점 — BirthDate 있으면 ScoringService 단일 진입점 (smart/evaluate와 동등성 보장),
        // 없으면 미학+희귀도만 별도 계산
        int aestheticScore;
        int? harmonyScore = null;
        int rarityScore;
        int finalScore;

        DateTime? birthDateParsed = null;
        if (!string.IsNullOrEmpty(request.BirthDate) &&
            DateTime.TryParse(request.BirthDate, out var bd))
        {
            birthDateParsed = bd;
        }

        if (birthDateParsed.HasValue)
        {
            var score = await _scoringService.EvaluateAsync(
                firstName, lastName, birthDateParsed.Value, gender, tone, birthTime);
            aestheticScore = score.AestheticScore;
            harmonyScore = score.HarmonyScore;
            rarityScore = score.RarityScore;
            finalScore = score.FinalScore;
        }
        else
        {
            aestheticScore = await _aestheticEngine.CalculateScoreAsync(firstName, lastName, tone);
            rarityScore = await _rarityScoringEngine.CalculateRarityScoreAsync(firstName);
            finalScore = aestheticScore;
        }

        // 5. 추천 이유
        var reasons = await _explanationEngine.GenerateReasonsAsync(
            firstName, aestheticScore, harmonyScore ?? 50);

        // 6. 한자 분석
        var hanjaBreakdown = AnalyzeHanja(firstName);

        // 7. 강점/약점
        var (strengths, weaknesses) = EvaluateStrengthsAndWeaknesses(
            aestheticScore, harmonyScore, rarityScore, firstName, lastName);

        // 8. 뒤집기 변형
        var reversalVariants = await _nameReversalEngine.GenerateVariantsAsync(firstName);

        // 9. 사주 원국 (생년월일 제공 시)
        SajuChartDto? sajuDto = null;
        if (birthDateParsed.HasValue)
        {
            var chart = _sajuCalculationService.CalculateChart(birthDateParsed.Value, birthTime, request.BirthplaceCode);
            var yongshinResult = _yongshinCalculationService.Calculate(chart);
            sajuDto = MapToSajuDto(chart, yongshinResult, hanjaBreakdown);
        }

        // 10. 음령오행 분석
        var eumryeongAnalysis = AnalyzeEumryeong(firstName);

        return new NameAnalysisResponseDto
        {
            FullName = fullName,
            AestheticScore = aestheticScore,
            HarmonyScore = harmonyScore,
            RarityScore = rarityScore,
            FinalScore = finalScore,
            HanjaBreakdown = hanjaBreakdown,
            Strengths = strengths,
            Weaknesses = weaknesses,
            Reasons = reasons,
            ReversalVariants = reversalVariants.Select(v => new NameVariantDto
            {
                Name = v.Name,
                VariationType = v.VariationType,
                Description = v.Description
            }).ToList(),
            Saju = sajuDto,
            EumryeongAnalysis = eumryeongAnalysis,
        };
    }

    private static SajuChartDto MapToSajuDto(
        Domain.Models.Saju.SajuChart chart,
        Domain.Models.Saju.YongshinResult? yongshinResult,
        List<HanjaBreakdownDto> hanjaBreakdown) => new()
    {
        YearPillar        = MapPillar(chart.YearPillar),
        MonthPillar       = MapPillar(chart.MonthPillar),
        DayPillar         = MapPillar(chart.DayPillar),
        HourPillar        = chart.HourPillar != null ? MapPillar(chart.HourPillar) : null,
        FiveElementCount  = chart.FiveElementCount,
        MissingElements   = chart.MissingElements,
        StrongestElement  = chart.StrongestElement,
        DayMaster         = chart.DayMaster,
        BirthplaceName    = chart.BirthplaceName,
        CorrectionMinutes = chart.CorrectionMinutes,
        Yongshin          = yongshinResult != null
            ? MapYongshinDto(yongshinResult, hanjaBreakdown)
            : null,
    };

    private static YongshinDto MapYongshinDto(
        Domain.Models.Saju.YongshinResult r,
        List<HanjaBreakdownDto> hanjaBreakdown)
    {
        // 이름 한자 후보 중 용신 오행과 일치하는 것이 하나라도 있으면 true
        bool? nameFits = hanjaBreakdown.Count > 0
            ? hanjaBreakdown.Any(b =>
                b.PossibleHanja.Any(h => h.FiveElement == r.PrimaryYongshin))
            : null;

        return new YongshinDto
        {
            Strength            = r.Strength.ToString(),
            StrengthScore       = r.StrengthScore,
            EokbuYongshin       = r.EokbuYongshin,
            JohuYongshin        = r.JohuYongshin,
            PrimaryYongshin     = r.PrimaryYongshin,
            Heeshin             = r.Heeshin,
            Gishin              = r.Gishin,
            StrengthDescription = r.StrengthDescription,
            YongshinReason      = r.YongshinReason,
            NameFitsYongshin    = nameFits,
        };
    }

    private static SajuPillarDto MapPillar(SajuPillar p) => new()
    {
        StemChar   = p.StemChar,
        StemName   = p.StemName,
        BranchChar = p.BranchChar,
        BranchName = p.BranchName,
        FiveElement = p.FiveElement,
        YinYang    = p.YinYang,
    };

    /// <summary>
    /// 음령오행 분석: 초성 기반 오행 분류
    /// </summary>
    private static EumryeongAnalysisDto AnalyzeEumryeong(string firstName)
    {
        var syllables = new List<EumryeongSyllableDto>();
        var elementCount = new Dictionary<string, int>
        {
            ["木"] = 0, ["火"] = 0, ["土"] = 0, ["金"] = 0, ["水"] = 0
        };

        foreach (var c in firstName)
        {
            var (initial, _, _) = KoreanUtils.Decompose(c);
            var element = KoreanUtils.GetEumryeongFiveElement(c);

            syllables.Add(new EumryeongSyllableDto
            {
                Syllable    = c.ToString(),
                Initial     = initial,
                FiveElement = element,
            });

            if (element != null && elementCount.ContainsKey(element))
                elementCount[element]++;
        }

        var dominantElement = elementCount
            .Where(kv => kv.Value > 0)
            .OrderByDescending(kv => kv.Value)
            .FirstOrDefault().Key;

        return new EumryeongAnalysisDto
        {
            Syllables      = syllables,
            ElementCount   = elementCount,
            DominantElement = dominantElement,
        };
    }

    /// <summary>
    /// 이름의 각 음절에 대해 가능한 한자 후보를 조회
    /// </summary>
    private List<HanjaBreakdownDto> AnalyzeHanja(string firstName)
    {
        var breakdown = new List<HanjaBreakdownDto>();

        foreach (var syllable in firstName)
        {
            var syllableStr = syllable.ToString();
            var hanjaList = HanjaData.FindByReading(syllableStr);

            breakdown.Add(new HanjaBreakdownDto
            {
                Syllable = syllableStr,
                PossibleHanja = hanjaList.Take(10).Select(h => new HanjaOptionDto
                {
                    Character       = h.Character,
                    Meaning         = h.Meaning ?? "",
                    FiveElement     = h.FiveElement,
                    Category        = h.Category,
                    StrokeCount     = h.StrokeCount > 0 ? h.StrokeCount : null,
                    KangxiStrokes   = h.KangxiStrokes > 0 ? h.KangxiStrokes : null,
                    ConfidenceGrade = h.ConfidenceGrade,
                    Rationale       = string.IsNullOrEmpty(h.Rationale) ? null : h.Rationale,
                }).ToList()
            });
        }

        return breakdown;
    }

    /// <summary>
    /// 점수 기반 강점/약점 분석
    /// </summary>
    private (List<string> strengths, List<string> weaknesses) EvaluateStrengthsAndWeaknesses(
        int aestheticScore, int? harmonyScore, int rarityScore, string firstName, string lastName)
    {
        var strengths = new List<string>();
        var weaknesses = new List<string>();

        // 미학 점수 분석
        if (aestheticScore >= 80)
            strengths.Add($"발음과 리듬이 매우 우수합니다 (미학 {aestheticScore}점)");
        else if (aestheticScore >= 60)
            strengths.Add($"발음과 리듬이 양호합니다 (미학 {aestheticScore}점)");
        else
            weaknesses.Add($"발음이나 리듬에 개선 여지가 있습니다 (미학 {aestheticScore}점)");

        // 조화 점수 분석
        if (harmonyScore.HasValue)
        {
            if (harmonyScore >= 80)
                strengths.Add($"출생 정보와 높은 조화를 보입니다 (조화 {harmonyScore}점)");
            else if (harmonyScore >= 60)
                strengths.Add($"출생 정보와 적절히 조화됩니다 (조화 {harmonyScore}점)");
            else
                weaknesses.Add($"출생 정보와의 조화도가 낮습니다 (조화 {harmonyScore}점)");
        }

        // 유니크 지수 분석
        if (rarityScore >= 70)
            strengths.Add($"독창적이고 차별화된 이름입니다 (유니크 {rarityScore}점)");
        else if (rarityScore >= 40)
            strengths.Add($"적당한 독창성을 가진 이름입니다 (유니크 {rarityScore}점)");
        else
            weaknesses.Add($"흔한 이름에 속합니다 (유니크 {rarityScore}점)");

        // 이름 길이 분석
        if (firstName.Length == 2)
            strengths.Add("2음절 이름으로 부르기 편합니다");
        else if (firstName.Length >= 4)
            weaknesses.Add($"이름이 {firstName.Length}음절로 다소 깁니다");

        // 성+이름 조합 길이
        var fullLength = lastName.Length + firstName.Length;
        if (fullLength == 3)
            strengths.Add("전체 3음절로 이상적인 길이입니다");
        else if (fullLength >= 5)
            weaknesses.Add($"전체 {fullLength}음절로 다소 깁니다");

        // 한자 의미 유무
        var hasHanja = firstName.Any(c =>
            HanjaData.FindByReading(c.ToString()).Any());
        if (hasHanja)
            strengths.Add("한자 의미를 부여할 수 있는 이름입니다");
        else
            weaknesses.Add("한자 매핑이 어려운 이름입니다");

        return (strengths, weaknesses);
    }
}
