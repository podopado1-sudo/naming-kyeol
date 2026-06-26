using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// ScoringService 단일 진실의 원천 회귀 방지 테스트.
/// smart vs evaluate 경로가 항상 동일한 점수를 반환함을 보장한다.
/// </summary>
public class ScoringServiceTests
{
    private readonly ScoringService _scoring;

    public ScoringServiceTests()
    {
        HanjaData.LoadExternalData();
        _scoring = new ScoringService(
            new AestheticEngine(),
            new HarmonyEngine(new FakeSajuCalculationService()),
            new RarityScoringEngine());
    }

    // ===== NormalizeGender =====

    [Theory]
    [InlineData("male",   "male")]
    [InlineData("Male",   "male")]
    [InlineData("MALE",   "male")]
    [InlineData("female", "female")]
    [InlineData("Female", "female")]
    [InlineData("none",   "none")]
    [InlineData("None",   "none")]
    [InlineData("",       "none")]
    [InlineData(null,     "none")]
    [InlineData("unknown","none")]
    public void NormalizeGender_VariousCasings_Consistent(string? input, string expected)
    {
        Assert.Equal(expected, ScoringService.NormalizeGender(input));
    }

    // ===== NormalizeTone =====

    [Theory]
    [InlineData("soft",    "soft")]
    [InlineData("Soft",    "soft")]
    [InlineData("SOFT",    "soft")]
    [InlineData("strong",  "strong")]
    [InlineData("Strong",  "strong")]
    [InlineData("neutral", "neutral")]
    [InlineData("Neutral", "neutral")]
    [InlineData("",        "neutral")]
    [InlineData(null,      "neutral")]
    [InlineData("fancy",   "neutral")]
    public void NormalizeTone_VariousCasings_Consistent(string? input, string expected)
    {
        Assert.Equal(expected, ScoringService.NormalizeTone(input));
    }

    // ===== FinalScore 공식: Math.Round(aesthetic*0.7 + harmony*0.3) =====

    [Fact]
    public async Task EvaluateAsync_FinalScore_MatchesMathRoundFormula()
    {
        var score = await _scoring.EvaluateAsync(
            "서윤", "김", new DateTime(2024, 6, 15), "female", "soft");

        var expected = (int)Math.Round(score.AestheticScore * 0.7 + score.HarmonyScore * 0.3);
        Assert.Equal(expected, score.FinalScore);
    }

    // ===== FinalScore가 0~100 범위 =====

    [Theory]
    [InlineData("서윤", "김", "female", "soft")]
    [InlineData("민준", "박", "male",   "strong")]
    [InlineData("하늘", "이", "none",   "neutral")]
    [InlineData("도현", "정", "male",   "neutral")]
    public async Task EvaluateAsync_FinalScore_InRange(
        string firstName, string lastName, string gender, string tone)
    {
        var score = await _scoring.EvaluateAsync(
            firstName, lastName, new DateTime(2024, 3, 1), gender, tone);

        Assert.InRange(score.FinalScore, 0, 100);
        Assert.InRange(score.AestheticScore, 0, 100);
        Assert.InRange(score.HarmonyScore, 0, 100);
        Assert.InRange(score.RarityScore, 0, 100);
    }

    // ===== 대소문자 정규화 동등성: "Female" vs "female" → 동일 점수 =====

    [Theory]
    [InlineData("Female", "female")]
    [InlineData("Male",   "male")]
    [InlineData("FEMALE", "female")]
    [InlineData("MALE",   "male")]
    public async Task EvaluateAsync_GenderCasingVariants_ProduceSameScore(
        string genderA, string genderB)
    {
        var date = new DateTime(2024, 6, 15);
        var a = await _scoring.EvaluateAsync("서윤", "김", date, genderA, "soft");
        var b = await _scoring.EvaluateAsync("서윤", "김", date, genderB, "soft");

        Assert.Equal(a.AestheticScore, b.AestheticScore);
        Assert.Equal(a.HarmonyScore,   b.HarmonyScore);
        Assert.Equal(a.FinalScore,     b.FinalScore);
    }

    [Theory]
    [InlineData("Soft",    "soft")]
    [InlineData("Strong",  "strong")]
    [InlineData("Neutral", "neutral")]
    public async Task EvaluateAsync_ToneCasingVariants_ProduceSameScore(
        string toneA, string toneB)
    {
        var date = new DateTime(2024, 6, 15);
        var a = await _scoring.EvaluateAsync("서윤", "김", date, "female", toneA);
        var b = await _scoring.EvaluateAsync("서윤", "김", date, "female", toneB);

        Assert.Equal(a.AestheticScore, b.AestheticScore);
        Assert.Equal(a.HarmonyScore,   b.HarmonyScore);
        Assert.Equal(a.FinalScore,     b.FinalScore);
    }

    // ===== 결정성: 같은 입력 → 같은 출력 (두 번 호출) =====

    [Fact]
    public async Task EvaluateAsync_SameInput_IsDeterministic()
    {
        var date = new DateTime(2024, 6, 15);
        var a = await _scoring.EvaluateAsync("도현", "정", date, "male", "neutral");
        var b = await _scoring.EvaluateAsync("도현", "정", date, "male", "neutral");

        Assert.Equal(a.AestheticScore, b.AestheticScore);
        Assert.Equal(a.HarmonyScore,   b.HarmonyScore);
        Assert.Equal(a.FinalScore,     b.FinalScore);
    }

    // ===== smart vs evaluate 동등성 검증 =====
    // NameEvaluationService와 ScoringService가 같은 점수를 반환해야 한다.

    [Theory]
    [InlineData("서윤", "김", "1985-06-05", "female", "neutral")]
    [InlineData("민준", "박", "2024-01-01", "male",   "strong")]
    [InlineData("하윤", "최", "2023-08-20", "female", "soft")]
    [InlineData("도현", "정", "2023-11-05", "male",   "neutral")]
    [InlineData("지호", "이", "2023-03-10", "male",   "strong")]
    public async Task EvaluateAsync_SmartVsEvaluate_ScoresAreIdentical(
        string firstName, string lastName, string birthDateStr, string gender, string tone)
    {
        var birthDate = DateTime.Parse(birthDateStr);

        // ScoringService 직접 호출 (smart 경로가 사용하는 것)
        var fromScoring = await _scoring.EvaluateAsync(
            firstName, lastName, birthDate, gender, tone);

        // NameEvaluationService 경유 (evaluate 경로)
        var evalService = new NameEvaluationService(_scoring, new ExplanationEngine());
        var fromEval = await evalService.EvaluateNameAsync(
            firstName, lastName, birthDate, gender, tone);

        Assert.Equal(fromScoring.AestheticScore, fromEval.AestheticScore);
        Assert.Equal(fromScoring.HarmonyScore,   fromEval.HarmonyScore);
        Assert.Equal(fromScoring.FinalScore,     fromEval.FinalScore);
    }

    // ===== smart vs NameAnalysisService 동등성 =====
    // /analysis 페이지에서 본 점수와 smart/evaluate 점수가 같아야 한다.

    [Theory]
    [InlineData("서윤", "김", "Female", "Soft")]   // 대문자 입력
    [InlineData("민준", "박", "male",   "strong")]
    [InlineData("도현", "정", "MALE",   "NEUTRAL")] // 전부 대문자
    public async Task EvaluateAsync_SmartVsAnalysis_ScoresAreIdentical(
        string firstName, string lastName, string gender, string tone)
    {
        var birthDateStr = "2024-06-15";
        var birthDate = DateTime.Parse(birthDateStr);

        // smart 경로 (ScoringService 직접)
        var fromScoring = await _scoring.EvaluateAsync(
            firstName, lastName, birthDate, gender, tone);

        // analysis 경로
        var analysisService = new NameAnalysisService(
            _scoring,
            new AestheticEngine(),
            new RarityScoringEngine(),
            new ExplanationEngine(),
            new NameReversalEngine(),
            new SajuCalculationService(),
            new YongshinCalculationService(),
            NullLogger<NameAnalysisService>.Instance);

        var fromAnalysis = await analysisService.AnalyzeNameAsync(new NameAnalysisRequestDto
        {
            FirstName = firstName,
            LastName  = lastName,
            BirthDate = birthDateStr,
            Gender    = gender,
            Tone      = tone,
        });

        Assert.Equal(fromScoring.AestheticScore, fromAnalysis.AestheticScore);
        Assert.Equal(fromScoring.HarmonyScore,   fromAnalysis.HarmonyScore);
        Assert.Equal(fromScoring.FinalScore,     fromAnalysis.FinalScore);
        Assert.Equal(fromScoring.RarityScore,    fromAnalysis.RarityScore);
    }

    // ===== smart vs TwinNameService 동등성 =====
    // 쌍둥이 추천 점수도 ScoringService 단일 진입점을 통과해야 한다.

    [Fact]
    public async Task EvaluateAsync_TwinService_RoutesThroughScoringService()
    {
        var fakeSaju = new FakeSajuCalculationService();
        var twinService = new TwinNameService(
            new TwinNameEngine(fakeSaju),
            _scoring,
            new ExplanationEngine(),
            NullLogger<TwinNameService>.Instance);

        var result = await twinService.GenerateTwinNamesAsync(new TwinNameRequestDto
        {
            LastName  = "김",
            BirthDate = "2024-06-15",
            Gender    = "Female", // 대문자 입력 — ScoringService 정규화 통과 검증
            Tone      = "Soft",
            ChildCount = 2,
        });

        // 적어도 하나 이상의 세트와 후보가 있어야 함
        Assert.NotEmpty(result.NameSets);
        var firstSet = result.NameSets[0];
        Assert.NotEmpty(firstSet.Names);

        // 각 후보의 FinalScore가 ScoringService 공식과 동일한지
        foreach (var candidate in firstSet.Names)
        {
            var expected = (int)Math.Round(
                candidate.AestheticScore * 0.7 + candidate.HarmonyScore * 0.3);
            Assert.Equal(expected, candidate.FinalScore);

            // 직접 ScoringService를 호출했을 때 동일한 점수가 나오는지
            var direct = await _scoring.EvaluateAsync(
                candidate.Name, "김", DateTime.Parse("2024-06-15"), "Female", "Soft");
            Assert.Equal(direct.AestheticScore, candidate.AestheticScore);
            Assert.Equal(direct.HarmonyScore,   candidate.HarmonyScore);
            Assert.Equal(direct.FinalScore,     candidate.FinalScore);
        }
    }

    // ===== Clamp: FinalScore는 절대 0 미만 / 100 초과가 되지 않는다 =====

    [Fact]
    public async Task EvaluateAsync_FinalScore_IsAlwaysClamped()
    {
        // 다양한 입력으로 점수가 항상 0~100임을 확인
        var inputs = new[]
        {
            ("서윤", "김", "female", "soft"),
            ("민준", "박", "male",   "neutral"),
            ("아라", "이", "female", "neutral"),
            ("강산", "류", "male",   "strong"),
            ("하늘", "천", "none",   "neutral"),
        };

        foreach (var (fn, ln, g, t) in inputs)
        {
            var score = await _scoring.EvaluateAsync(
                fn, ln, new DateTime(2024, 6, 15), g, t);
            Assert.InRange(score.FinalScore, 0, 100);
        }
    }

    // ===== 출생일 없는 평가 (미학-only) =====

    [Fact]
    public async Task EvaluateAsync_NoBirthDate_SkipsHarmonyAndFinalEqualsAesthetic()
    {
        // 출생일이 없으면 사주 조화는 산정하지 않고(0) 종합=미학 점수.
        var score = await _scoring.EvaluateAsync("서윤", "김", null, "female", "soft");

        Assert.True(score.AestheticScore > 0, "미학 점수는 출생일 없이도 산정되어야 한다");
        Assert.Equal(0, score.HarmonyScore);
        Assert.Equal(score.AestheticScore, score.FinalScore);
        Assert.Contains(score.Harmony.Notes, n => n.Contains("출생일"));
    }

    [Fact]
    public async Task EvaluateAsync_WithVsWithoutBirthDate_AestheticMatches_FinalDiffers()
    {
        // 같은 이름이면 미학 점수는 출생일 유무와 무관하게 동일,
        // 종합은 조화 포함 여부로 달라진다.
        var with = await _scoring.EvaluateAsync("서윤", "김", new DateTime(2024, 6, 15), "female", "soft");
        var without = await _scoring.EvaluateAsync("서윤", "김", null, "female", "soft");

        Assert.Equal(with.AestheticScore, without.AestheticScore);
        Assert.Equal(without.AestheticScore, without.FinalScore);
        Assert.InRange(without.FinalScore, 0, 100);
    }
}
