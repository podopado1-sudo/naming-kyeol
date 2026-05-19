using NameForm.Application.Engines;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// RarityScoringEngine 희귀도 점수 단위 테스트
/// </summary>
public class RarityScoringEngineTests
{
    private readonly RarityScoringEngine _engine = new();

    [Fact]
    public async Task CalculateRarityScoreAsync_VeryCommonName_Returns10()
    {
        int score = await _engine.CalculateRarityScoreAsync("민준");
        Assert.Equal(10, score);
    }

    [Theory]
    [InlineData("서준")]
    [InlineData("도윤")]
    [InlineData("예준")]
    [InlineData("하준")]
    [InlineData("서연")]
    [InlineData("하은")]
    [InlineData("지은")]
    [InlineData("채원")]
    [InlineData("지유")]
    public async Task CalculateRarityScoreAsync_VeryCommonNames_AllReturn10(string name)
    {
        int score = await _engine.CalculateRarityScoreAsync(name);
        Assert.Equal(10, score);
    }

    [Theory]
    [InlineData("건우")]
    [InlineData("현우")]
    [InlineData("다은")]
    [InlineData("소율")]
    public async Task CalculateRarityScoreAsync_CommonNames_Return30(string name)
    {
        int score = await _engine.CalculateRarityScoreAsync(name);
        Assert.Equal(30, score);
    }

    [Fact]
    public async Task CalculateRarityScoreAsync_CommonEnding_Returns50()
    {
        // "영복" → "복"이 돌림자
        int score = await _engine.CalculateRarityScoreAsync("영복");
        Assert.Equal(50, score);
    }

    [Theory]
    [InlineData("영길")]
    [InlineData("순자")]
    [InlineData("영옥")]
    [InlineData("순희")]
    public async Task CalculateRarityScoreAsync_OldStyleEndings_Return50(string name)
    {
        int score = await _engine.CalculateRarityScoreAsync(name);
        Assert.Equal(50, score);
    }

    [Fact]
    public async Task CalculateRarityScoreAsync_UniqueName_ReturnsHighScore()
    {
        // 흔하지 않고 돌림자도 아닌 이름
        int score = await _engine.CalculateRarityScoreAsync("서란");
        Assert.True(score >= 90, $"고유한 이름은 90점 이상이어야 함, 실제: {score}");
    }

    [Fact]
    public async Task CalculateRarityScoreAsync_EmptyName_Returns0()
    {
        int score = await _engine.CalculateRarityScoreAsync("");
        Assert.Equal(0, score);
    }

    [Fact]
    public async Task CalculateRarityScoreAsync_NullName_Returns0()
    {
        int score = await _engine.CalculateRarityScoreAsync(null!);
        Assert.Equal(0, score);
    }

    [Fact]
    public async Task CalculateRarityScoreAsync_ScoreNeverExceeds100()
    {
        int score = await _engine.CalculateRarityScoreAsync("아주특별한이름");
        Assert.InRange(score, 0, 100);
    }

    // ================================================================
    // 확장된 데이터베이스 검증 테스트
    // ================================================================

    [Theory]
    [InlineData("서준")]
    [InlineData("민준")]
    [InlineData("도윤")]
    [InlineData("하준")]
    [InlineData("시우")]
    [InlineData("서윤")]
    [InlineData("하린")]
    [InlineData("수아")]
    public async Task CalculateRarityScoreAsync_VeryCommonName_ReturnsLowScore(string name)
    {
        // 매우 흔한 이름은 10~30 범위
        int score = await _engine.CalculateRarityScoreAsync(name);
        Assert.InRange(score, 10, 30);
    }

    [Theory]
    [InlineData("건우")]
    [InlineData("재민")]
    [InlineData("유진")]
    [InlineData("예서")]
    [InlineData("혜진")]
    [InlineData("한솔")]
    public async Task CalculateRarityScoreAsync_CommonName_ReturnsMidScore(string name)
    {
        // 흔한 이름은 30~50 범위
        int score = await _engine.CalculateRarityScoreAsync(name);
        Assert.InRange(score, 30, 50);
    }

    [Theory]
    [InlineData("가온빛")]
    [InlineData("서란")]
    [InlineData("단비")]
    public async Task CalculateRarityScoreAsync_RareName_ReturnsHighScore(string name)
    {
        // 희귀 이름은 70+ 범위
        int score = await _engine.CalculateRarityScoreAsync(name);
        Assert.True(score >= 70, $"희귀 이름 '{name}'은 70점 이상이어야 함, 실제: {score}");
    }

    [Fact]
    public async Task CalculateRarityScoreAsync_HasUniqueCombination_HigherScore()
    {
        // ㅊ,ㅋ,ㅌ,ㅍ 등 특이한 초성이 포함된 이름
        // "카람" → ㅋ 초성, DB에 없음 → 95점 (unique combination)
        int score = await _engine.CalculateRarityScoreAsync("카람");
        Assert.True(score >= 85, $"특이 초성 이름은 85점 이상이어야 함, 실제: {score}");
    }

    [Fact]
    public async Task CalculateRarityScoreAsync_ThreeSyllableRareName_ReturnsVeryHighScore()
    {
        // 3음절 + DB에 없는 이름 → 90점
        int score = await _engine.CalculateRarityScoreAsync("온누리");
        Assert.True(score >= 90, $"3음절 희귀 이름은 90점 이상이어야 함, 실제: {score}");
    }

    [Fact]
    public async Task CalculateRarityScoreAsync_FourSyllableRareName_Returns100()
    {
        // 4음절 이상 + DB에 없는 이름 → 100점
        int score = await _engine.CalculateRarityScoreAsync("가온누리");
        Assert.Equal(100, score);
    }

    [Fact]
    public async Task CalculateRarityScoreAsync_ModernCommonEnding_ReturnsMediumScore()
    {
        // DB에는 없지만 현세대 흔한 끝글자 패턴 (준, 우 등)
        // "태준" → 끝글자 "준"이 현세대 흔한 패턴 → 65점
        // 단, "태준"이 CommonNames에 없을 때만 해당
        int score = await _engine.CalculateRarityScoreAsync("태준");
        Assert.InRange(score, 50, 70);
    }

    [Fact]
    public async Task CalculateRarityScoreAsync_ScoreDistribution_NotAllMax()
    {
        // 다양한 이름에 대해 모든 점수가 100이 아닌지 확인
        var testNames = new[] { "서준", "건우", "영복", "서란", "가온빛", "예서", "태준", "카람" };
        var scores = new List<int>();

        foreach (var name in testNames)
        {
            scores.Add(await _engine.CalculateRarityScoreAsync(name));
        }

        // 모든 점수가 같지 않아야 함 (분포가 있어야 함)
        Assert.True(scores.Distinct().Count() >= 4,
            $"점수 분포가 너무 좁음. 고유 점수 수: {scores.Distinct().Count()}, 점수들: {string.Join(", ", scores)}");
    }
}
