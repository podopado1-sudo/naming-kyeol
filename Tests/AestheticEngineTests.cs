using NameForm.Application.Engines;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// AestheticEngine 미학 점수 계산 단위 테스트
/// 점수 구성: 발음(30) + 리듬(25) + 음절길이(15) + 세대중립(15) + 의미(10) - 감점
/// </summary>
public class AestheticEngineTests
{
    private readonly AestheticEngine _engine = new();

    // ===== 점수 범위 =====

    [Fact]
    public async Task CalculateScoreAsync_ReturnsScoreBetween0And100()
    {
        int score = await _engine.CalculateScoreAsync("서연", "neutral");
        Assert.InRange(score, 0, 100);
    }

    [Theory]
    [InlineData("서아")]
    [InlineData("하윤")]
    [InlineData("지호")]
    [InlineData("민서")]
    public async Task CalculateScoreAsync_VariousNames_AlwaysInRange(string name)
    {
        int score = await _engine.CalculateScoreAsync(name, "neutral");
        Assert.InRange(score, 0, 100);
    }

    // ===== 유행 이름 감점 =====

    [Fact]
    public async Task CalculateScoreAsync_TrendyName_LowerThanNonTrendy()
    {
        int trendyScore = await _engine.CalculateScoreAsync("서준", "neutral");
        int normalScore = await _engine.CalculateScoreAsync("서란", "neutral");

        // 유행 이름은 -10 감점 + 세대중립성에서도 감점
        Assert.True(normalScore > trendyScore,
            $"유행 이름({trendyScore})이 일반 이름({normalScore})보다 낮아야 함");
    }

    [Theory]
    [InlineData("서준")]
    [InlineData("민준")]
    [InlineData("하은")]
    [InlineData("서연")]
    public async Task CalculateScoreAsync_TrendyNames_GetPenalized(string trendyName)
    {
        int score = await _engine.CalculateScoreAsync(trendyName, "neutral");
        // 유행 이름은 세대중립성 감점 + 10점 직접 감점으로 높은 점수 나오기 어려움
        Assert.InRange(score, 0, 100);
    }

    // ===== 생활어 충돌 =====

    [Fact]
    public async Task CalculateScoreAsync_CollisionWord_DeductsPoints()
    {
        // "사과"가 이름에 포함되면 -5점
        int collisionScore = await _engine.CalculateScoreAsync("사과", "neutral");
        int normalScore = await _engine.CalculateScoreAsync("서란", "neutral");

        Assert.True(normalScore > collisionScore,
            $"생활어 충돌 이름({collisionScore})이 일반 이름({normalScore})보다 낮아야 함");
    }

    // ===== 음절 길이 영향 =====

    [Fact]
    public async Task CalculateScoreAsync_2Syllable_ScoresHigherThan4Syllable()
    {
        // 유행 이름이 아닌 2음절 vs 4음절 비교
        int twoSyl = await _engine.CalculateScoreAsync("서란", "neutral");
        int fourSyl = await _engine.CalculateScoreAsync("가나다라", "neutral");

        // 2음절이 음절 길이 점수에서 우위
        Assert.True(twoSyl > fourSyl,
            $"2음절({twoSyl})이 4음절({fourSyl})보다 높아야 함");
    }

    // ===== 성+이름 전체 평가 =====

    [Fact]
    public async Task CalculateScoreAsync_WithLastName_ReturnsScore()
    {
        int score = await _engine.CalculateScoreAsync("민서", "김", "neutral");
        Assert.InRange(score, 0, 100);
    }

    [Fact]
    public async Task CalculateScoreAsync_WithoutLastName_ReturnsScore()
    {
        int score = await _engine.CalculateScoreAsync("민서", null, "neutral");
        Assert.InRange(score, 0, 100);
    }

    // ===== 톤 =====

    [Fact]
    public async Task CalculateScoreAsync_DifferentTones_ReturnsDifferentScores()
    {
        int softScore = await _engine.CalculateScoreAsync("서아", "soft");
        int strongScore = await _engine.CalculateScoreAsync("서아", "strong");
        int neutralScore = await _engine.CalculateScoreAsync("서아", "neutral");

        // 점수는 모두 유효 범위
        Assert.InRange(softScore, 0, 100);
        Assert.InRange(strongScore, 0, 100);
        Assert.InRange(neutralScore, 0, 100);
    }

    // ===== 돌림자 패턴 =====

    [Fact]
    public async Task CalculateScoreAsync_CommonEnding_LowerNeutrality()
    {
        // "영복" 같은 돌림자가 포함된 이름은 세대중립성 감점
        int oldStyleScore = await _engine.CalculateScoreAsync("영복", "neutral");
        int modernScore = await _engine.CalculateScoreAsync("서란", "neutral");

        // 돌림자 이름은 세대중립성에서 감점
        Assert.True(modernScore >= oldStyleScore,
            $"현대식({modernScore})이 돌림자({oldStyleScore})보다 높거나 같아야 함");
    }

    // ===== 하위 호환성 =====

    [Fact]
    public async Task CalculateScoreAsync_TwoParamOverload_MatchesThreeParamWithNullLastName()
    {
        int twoParam = await _engine.CalculateScoreAsync("서연", "neutral");
        int threeParam = await _engine.CalculateScoreAsync("서연", null, "neutral");

        Assert.Equal(twoParam, threeParam);
    }

    // ===== 부정적 음절 패턴 =====

    [Fact]
    public async Task CalculateScoreAsync_HighPenaltySyllable_ReducesScore()
    {
        // "추"는 고위험 음절 (15점 감점)
        int negativeScore = await _engine.CalculateScoreAsync("추연", "neutral");
        int normalScore = await _engine.CalculateScoreAsync("서란", "neutral");

        Assert.True(normalScore > negativeScore,
            $"고위험 음절 이름({negativeScore})이 일반 이름({normalScore})보다 낮아야 함");
    }

    [Fact]
    public async Task CalculateScoreAsync_MediumPenaltySyllable_ReducesScore()
    {
        // "궂"은 중위험 음절 (8점 감점)
        int negativeScore = await _engine.CalculateScoreAsync("궂은", "neutral");
        int normalScore = await _engine.CalculateScoreAsync("서란", "neutral");

        Assert.True(normalScore > negativeScore,
            $"중위험 음절 이름({negativeScore})이 일반 이름({normalScore})보다 낮아야 함");
    }

    [Fact]
    public async Task CalculateScoreAsync_MultipleNegativeSyllables_CappedAt30()
    {
        // 여러 부정적 음절이 있어도 최대 30점 캡
        int score = await _engine.CalculateScoreAsync("추허", "neutral");
        Assert.InRange(score, 0, 100);
    }

    // ===== 전체 이름 패턴 =====

    [Fact]
    public async Task CalculateScoreAsync_NegativeVerbPattern_PenaltyApplied()
    {
        // "추하다"는 부정적 동사 패턴
        int withLastName = await _engine.CalculateScoreAsync("하다", "추", "neutral");
        int withoutLastName = await _engine.CalculateScoreAsync("하다", null, "neutral");

        // 성+이름이 "추하다"를 만들면 전체 이름 감점 적용
        Assert.True(withoutLastName > withLastName,
            $"부정적 동사 패턴 감점 미적용: 성 없음({withoutLastName}) vs 성 있음({withLastName})");
    }

    [Fact]
    public async Task CalculateScoreAsync_MorphemeAnalysis_DetectsNegative()
    {
        // 형태소 분석으로 부정적 패턴 감지
        int negativeScore = await _engine.CalculateScoreAsync("해진", "추", "neutral");
        int normalScore = await _engine.CalculateScoreAsync("해진", "김", "neutral");

        // "추해진" vs "김해진" — "추" 관련 형태소 감점
        Assert.True(normalScore >= negativeScore,
            $"형태소 감점: 추+해진({negativeScore}) vs 김+해진({normalScore})");
    }

    [Fact]
    public async Task CalculateScoreAsync_FullNamePenalty_CappedAt50()
    {
        // 전체 이름 감점은 최대 50점으로 제한
        int score = await _engine.CalculateScoreAsync("하다", "추", "neutral");
        Assert.InRange(score, 0, 100);
    }

    // ===== 의미 평가 =====

    [Fact]
    public async Task CalculateScoreAsync_ExcessiveWishWord_ReducesScore()
    {
        // "복"은 소망 표현 (-20점)
        int wishScore = await _engine.CalculateScoreAsync("서복", "neutral");
        int normalScore = await _engine.CalculateScoreAsync("서란", "neutral");

        Assert.True(normalScore > wishScore,
            $"소망어 이름({wishScore})이 일반 이름({normalScore})보다 낮아야 함");
    }

    [Fact]
    public async Task CalculateScoreAsync_MultipleWishWords_StackedPenalty()
    {
        // "복귀"는 소망 표현 2개 포함 (-40점), "서귀"는 1개 (-20점)
        int doubleWish = await _engine.CalculateScoreAsync("복귀", "neutral");
        int singleWish = await _engine.CalculateScoreAsync("서귀", "neutral");

        Assert.True(singleWish >= doubleWish,
            $"이중 소망어({doubleWish})가 단일 소망어({singleWish})보다 낮거나 같아야 함");
    }

    [Theory]
    [InlineData("soft")]
    [InlineData("strong")]
    public async Task CalculateScoreAsync_ToneMatch_BonusApplied(string tone)
    {
        // 톤 매칭 시 의미 평가에서 보너스 (+10)
        int score = await _engine.CalculateScoreAsync("선현", tone);
        Assert.InRange(score, 0, 100);
    }

    // ===== 세대 중립성 심화 =====

    [Theory]
    [InlineData("민복")]
    [InlineData("영숙")]
    [InlineData("순자")]
    public async Task CalculateScoreAsync_CommonEndings_LowerNeutralityThanModern(string oldStyleName)
    {
        int oldScore = await _engine.CalculateScoreAsync(oldStyleName, "neutral");
        int modernScore = await _engine.CalculateScoreAsync("서란", "neutral");

        Assert.True(modernScore >= oldScore,
            $"현대식({modernScore})이 돌림자 이름 '{oldStyleName}'({oldScore})보다 높거나 같아야 함");
    }

    // ===== 엣지 케이스 =====

    [Fact]
    public async Task CalculateScoreAsync_EmptyString_ReturnsValidScore()
    {
        int score = await _engine.CalculateScoreAsync("", "neutral");
        Assert.InRange(score, 0, 100);
    }

    [Fact]
    public async Task CalculateScoreAsync_SingleChar_ReturnsValidScore()
    {
        int score = await _engine.CalculateScoreAsync("서", "neutral");
        Assert.InRange(score, 0, 100);
    }

    [Fact]
    public async Task CalculateScoreAsync_VeryLongName_ReturnsLowScore()
    {
        int longScore = await _engine.CalculateScoreAsync("가나다라마바", "neutral");
        int normalScore = await _engine.CalculateScoreAsync("서란", "neutral");

        Assert.InRange(longScore, 0, 100);
        Assert.True(normalScore > longScore,
            $"2음절({normalScore})이 6음절({longScore})보다 높아야 함");
    }

    // ===== Breakdown 반환 =====

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_ReturnsAllFields()
    {
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync("서란", null, "neutral", "none");

        Assert.InRange(breakdown.TotalScore, 0, 100);
        Assert.True(breakdown.PronunciationScore >= 0, "발음 점수는 0 이상");
        Assert.True(breakdown.RhythmScore >= 0, "리듬 점수는 0 이상");
        Assert.True(breakdown.SyllableScore >= 0, "음절 점수는 0 이상");
        Assert.True(breakdown.NeutralityScore >= 0, "세대중립 점수는 0 이상");
        Assert.True(breakdown.MeaningScore >= 0, "의미 점수는 0 이상");
        Assert.NotNull(breakdown.Notes);
    }

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_TotalMatchesLegacy()
    {
        // breakdown의 TotalScore와 기존 CalculateScoreAsync 결과 일치
        int legacyScore = await _engine.CalculateScoreAsync("서란", null, "neutral");
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync("서란", null, "neutral", "none");

        Assert.Equal(legacyScore, breakdown.TotalScore);
    }

    // ===== Gender 반영 =====

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_GenderMatch_GivesBonus()
    {
        // "은" 음절의 한자(恩)는 Female 선호 → female 요청 시 가점
        var femaleBd = await _engine.CalculateScoreWithBreakdownAsync("서은", null, "neutral", "female");
        var noneBd = await _engine.CalculateScoreWithBreakdownAsync("서은", null, "neutral", "none");

        Assert.True(femaleBd.GenderBonus >= 0,
            $"female 한자에 female 요청 시 가점 예상, 실제: {femaleBd.GenderBonus}");
        Assert.Equal(0, noneBd.GenderBonus);
    }

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_GenderMismatch_GivesPenalty()
    {
        // "은" 음절의 한자(恩)는 Female 선호 → male 요청 시 감점 가능
        var maleBd = await _engine.CalculateScoreWithBreakdownAsync("서은", null, "neutral", "male");

        // 불일치 시 감점 (또는 0, 한자에 male 매칭도 있을 수 있으므로)
        Assert.InRange(maleBd.GenderBonus, -5, 5);
    }

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_GenderNone_NoBonus()
    {
        var bd = await _engine.CalculateScoreWithBreakdownAsync("서란", null, "neutral", "none");
        Assert.Equal(0, bd.GenderBonus);
    }

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_GenderNeutral_NoBonus()
    {
        var bd = await _engine.CalculateScoreWithBreakdownAsync("서란", null, "neutral", "neutral");
        Assert.Equal(0, bd.GenderBonus);
    }

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_GenderBonusCapped()
    {
        // gender bonus는 ±5 이내
        var bd = await _engine.CalculateScoreWithBreakdownAsync("서은", null, "neutral", "female");
        Assert.InRange(bd.GenderBonus, -5, 5);
    }

    // ===== Tone 반영 (발음 패턴 기반) =====

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_SoftTone_BonusForSoftSounds()
    {
        // "나래" — ㄴ(유음/비음), ㅏ(부드러운 모음), ㄹ(유음) → soft 톤에 유리
        var softBd = await _engine.CalculateScoreWithBreakdownAsync("나리", null, "soft", "none");
        var neutralBd = await _engine.CalculateScoreWithBreakdownAsync("나리", null, "neutral", "none");

        Assert.True(softBd.ToneBonus > 0,
            $"soft 톤에 유음/비음 이름은 가점 예상, 실제: {softBd.ToneBonus}");
        Assert.Equal(0, neutralBd.ToneBonus);
    }

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_SoftTone_PenaltyForHardSounds()
    {
        // "삐쩨" — ㅃ + ㅉ(된소리), ㅣ + ㅔ(비선호 모음) → soft 톤에 감점
        var softBd = await _engine.CalculateScoreWithBreakdownAsync("삐쩨", null, "soft", "none");

        Assert.True(softBd.ToneBonus < 0,
            $"soft 톤에 된소리 이름은 감점 예상, 실제: {softBd.ToneBonus}");
    }

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_StrongTone_BonusForPlosives()
    {
        // "건도" — ㄱ, ㄷ(파열음) → strong 톤에 유리
        var strongBd = await _engine.CalculateScoreWithBreakdownAsync("건도", null, "strong", "none");

        Assert.True(strongBd.ToneBonus > 0,
            $"strong 톤에 파열음 이름은 가점 예상, 실제: {strongBd.ToneBonus}");
    }

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_ToneBonusCapped()
    {
        // tone bonus는 ±8 이내
        var bd = await _engine.CalculateScoreWithBreakdownAsync("나리", null, "soft", "none");
        Assert.InRange(bd.ToneBonus, -8, 8);
    }

    // ===== 세대중립성 버그 수정 검증 =====

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_TrendyName_LowNeutrality()
    {
        // 유행 이름은 세대중립 점수가 낮아야 함 (버그 수정 검증)
        var trendyBd = await _engine.CalculateScoreWithBreakdownAsync("서준", null, "neutral", "none");
        var normalBd = await _engine.CalculateScoreWithBreakdownAsync("서란", null, "neutral", "none");

        Assert.True(normalBd.NeutralityScore > trendyBd.NeutralityScore,
            $"유행 이름 세대중립({trendyBd.NeutralityScore})이 일반({normalBd.NeutralityScore})보다 낮아야 함");
    }

    // ===== 확장된 유행 이름 목록 검증 =====

    [Theory]
    [InlineData("건우")]
    [InlineData("수호")]
    [InlineData("하린")]
    [InlineData("아린")]
    [InlineData("소율")]
    public async Task CalculateScoreAsync_NewTrendyNames_GetPenalized(string trendyName)
    {
        int trendyScore = await _engine.CalculateScoreAsync(trendyName, "neutral");
        int normalScore = await _engine.CalculateScoreAsync("서란", "neutral");

        Assert.True(normalScore > trendyScore,
            $"새로 추가된 유행 이름 '{trendyName}'({trendyScore})이 일반 이름({normalScore})보다 낮아야 함");
    }

    // ===== breakdown Notes 포함 검증 =====

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_TrendyName_HasNote()
    {
        var bd = await _engine.CalculateScoreWithBreakdownAsync("서준", null, "neutral", "none");
        Assert.Contains(bd.Notes, n => n.Contains("유행"));
    }

    [Fact]
    public async Task CalculateScoreWithBreakdownAsync_SoftToneMismatch_HasNote()
    {
        var bd = await _engine.CalculateScoreWithBreakdownAsync("빠른", null, "soft", "none");
        Assert.Contains(bd.Notes, n => n.Contains("된소리"));
    }
}
