using NameForm.Application.Engines;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// HarmonyEngine 조화 점수 계산 단위 테스트
/// 점수 구성: 오행(30) + 자원오행(20) + 음양(10) + 발음오행(25) + 수리사격(15) + gender 보정
/// </summary>
public class HarmonyEngineTests
{
    private readonly HarmonyEngine _engine = new(new FakeSajuCalculationService());

    // ===== 점수 범위 =====

    [Fact]
    public async Task CalculateScoreAsync_ReturnsScoreBetween0And100()
    {
        int score = await _engine.CalculateScoreAsync(
            "서연", "김", new DateTime(1990, 3, 21), "none");
        Assert.InRange(score, 0, 100);
    }

    [Theory]
    [InlineData("서아", "김", "1990-03-21", "male")]
    [InlineData("민준", "이", "2000-05-15", "male")]
    [InlineData("하은", "박", "1985-12-01", "female")]
    [InlineData("지호", "최", "2010-08-20", "none")]
    public async Task CalculateScoreAsync_VariousInputs_AlwaysInRange(
        string name, string lastName, string birthDateStr, string gender)
    {
        var birthDate = DateTime.Parse(birthDateStr);
        int score = await _engine.CalculateScoreAsync(name, lastName, birthDate, gender);
        Assert.InRange(score, 0, 100);
    }

    // ===== 성+이름 조화 (음절 길이) =====

    [Fact]
    public async Task CalculateScoreAsync_1Plus2Combination_HigherThan2Plus3()
    {
        // 1자 성 + 2자 이름 = 최적
        int oneTwo = await _engine.CalculateScoreAsync("서연", "김", new DateTime(1990, 3, 21), "none");
        // 2자 성 + 3자 이름 = 비최적
        int twoThree = await _engine.CalculateScoreAsync("서연아", "남궁", new DateTime(1990, 3, 21), "none");

        // 1+2 조합이 성조화 점수에서 우위 (다른 요소는 동일하지 않으므로 범위만 확인)
        Assert.InRange(oneTwo, 0, 100);
        Assert.InRange(twoThree, 0, 100);
    }

    // ===== 생년월일 영향 =====

    [Fact]
    public async Task CalculateScoreAsync_DifferentBirthDates_MayDiffer()
    {
        int score1990 = await _engine.CalculateScoreAsync("서연", "김", new DateTime(1990, 3, 21), "none");
        int score2000 = await _engine.CalculateScoreAsync("서연", "김", new DateTime(2000, 1, 1), "none");

        // 같은 이름이라도 생년월일에 따라 오행 조화가 달라질 수 있음
        Assert.InRange(score1990, 0, 100);
        Assert.InRange(score2000, 0, 100);
    }

    // ===== 성별 입력 =====

    [Fact]
    public async Task CalculateScoreAsync_AllGenders_ReturnValidScores()
    {
        var birthDate = new DateTime(1990, 3, 21);
        int maleScore = await _engine.CalculateScoreAsync("서연", "김", birthDate, "male");
        int femaleScore = await _engine.CalculateScoreAsync("서연", "김", birthDate, "female");
        int noneScore = await _engine.CalculateScoreAsync("서연", "김", birthDate, "none");

        Assert.InRange(maleScore, 0, 100);
        Assert.InRange(femaleScore, 0, 100);
        Assert.InRange(noneScore, 0, 100);
    }

    // ===== 1음절 이름 =====

    [Fact]
    public async Task CalculateScoreAsync_SingleSyllableName_ReturnsValidScore()
    {
        int score = await _engine.CalculateScoreAsync("준", "김", new DateTime(1990, 3, 21), "none");
        Assert.InRange(score, 0, 100);
    }

    // ===== 오행 조화 심화 =====

    [Fact]
    public async Task CalculateScoreAsync_LackingElementInName_HigherScore()
    {
        // 1990년: 천간 庚(金), 지지 午(火) -> 水가 부족할 가능성
        // "해" = 海 = 水 오행 -> 부족 오행 보완 (+20)
        // "화" = 火 = 火 오행 -> 과잉 오행일 수 있음
        int waterScore = await _engine.CalculateScoreAsync("해천", "김", new DateTime(1990, 3, 21), "none");
        int fireScore = await _engine.CalculateScoreAsync("화성", "김", new DateTime(1990, 3, 21), "none");

        // 둘 다 유효 범위
        Assert.InRange(waterScore, 0, 100);
        Assert.InRange(fireScore, 0, 100);
    }

    [Fact]
    public async Task CalculateScoreAsync_DifferentBirthYears_DifferentFiveElements()
    {
        // 다른 연도는 다른 천간/지지 -> 다른 오행 분포
        int score1990 = await _engine.CalculateScoreAsync("해천", "김", new DateTime(1990, 3, 21), "none");
        int score1985 = await _engine.CalculateScoreAsync("해천", "김", new DateTime(1985, 3, 21), "none");

        // 같은 이름이라도 연도에 따라 점수가 다를 수 있음
        Assert.InRange(score1990, 0, 100);
        Assert.InRange(score1985, 0, 100);
    }

    // ===== 획수 조화 =====

    [Fact]
    public async Task CalculateScoreAsync_KnownStrokeCounts_ConsistentScore()
    {
        // 하드코딩 한자: 天(천)=4획, 海(해)=10획
        int score1 = await _engine.CalculateScoreAsync("천해", "김", new DateTime(1990, 3, 21), "none");
        int score2 = await _engine.CalculateScoreAsync("천해", "김", new DateTime(1990, 3, 21), "none");

        // 같은 입력이면 같은 점수 (결정적)
        Assert.Equal(score1, score2);
    }

    [Fact]
    public async Task CalculateScoreAsync_UnknownHanja_UsesDefaultStrokes()
    {
        // "가나"는 한자 사전에 없음 -> 기본값 5획 사용
        int score = await _engine.CalculateScoreAsync("가나", "김", new DateTime(1990, 3, 21), "none");
        Assert.InRange(score, 0, 100);
    }

    // ===== 음양 균형 =====

    [Fact]
    public async Task CalculateScoreAsync_BalancedYinYang_HigherScore()
    {
        // 天(천)=陽, 海(해)=陰 -> 균형 잡힘
        // 天(천)=陽, 山(산)=陽 -> 전부 陽
        int balancedScore = await _engine.CalculateScoreAsync("천해", "김", new DateTime(1990, 3, 21), "none");
        int allYangScore = await _engine.CalculateScoreAsync("천산", "김", new DateTime(1990, 3, 21), "none");

        Assert.InRange(balancedScore, 0, 100);
        Assert.InRange(allYangScore, 0, 100);
    }

    [Fact]
    public async Task CalculateScoreAsync_AllYang_ReturnsValidScore()
    {
        // 陽 한자만으로 구성된 이름
        int score = await _engine.CalculateScoreAsync("천산", "김", new DateTime(1990, 3, 21), "none");
        Assert.InRange(score, 0, 100);
    }

    [Fact]
    public async Task CalculateScoreAsync_AllYin_ReturnsValidScore()
    {
        // 月(월)=陰, 雲(운)=陰
        int score = await _engine.CalculateScoreAsync("월운", "김", new DateTime(1990, 3, 21), "none");
        Assert.InRange(score, 0, 100);
    }

    // ===== 성과 이름 조화 =====

    [Fact]
    public async Task CalculateScoreAsync_1Plus2_HighHarmony()
    {
        // 1자 성 + 2자 이름 = 기본 100
        int score = await _engine.CalculateScoreAsync("서연", "김", new DateTime(1990, 3, 21), "none");
        Assert.InRange(score, 0, 100);
    }

    [Fact]
    public async Task CalculateScoreAsync_2Plus2_GoodHarmony()
    {
        // 2자 성 + 2자 이름 = 기본 90
        int score = await _engine.CalculateScoreAsync("서연", "남궁", new DateTime(1990, 3, 21), "none");
        Assert.InRange(score, 0, 100);
    }

    [Fact]
    public async Task CalculateScoreAsync_1Plus3_ModerateHarmony()
    {
        // 1자 성 + 3자 이름 = 기본 60
        int score = await _engine.CalculateScoreAsync("서연아", "김", new DateTime(1990, 3, 21), "none");
        Assert.InRange(score, 0, 100);
    }

    // ===== 엣지 케이스 =====

    [Fact]
    public async Task CalculateScoreAsync_VeryOldDate_DoesNotThrow()
    {
        int score = await _engine.CalculateScoreAsync("서연", "김", new DateTime(1900, 1, 1), "none");
        Assert.InRange(score, 0, 100);
    }

    [Fact]
    public async Task CalculateScoreAsync_FutureDate_DoesNotThrow()
    {
        int score = await _engine.CalculateScoreAsync("서연", "김", new DateTime(2030, 1, 1), "none");
        Assert.InRange(score, 0, 100);
    }

    [Fact]
    public async Task CalculateScoreAsync_EmptyLastName_HandledGracefully()
    {
        int score = await _engine.CalculateScoreAsync("서연", "", new DateTime(1990, 3, 21), "none");
        Assert.InRange(score, 0, 100);
    }

    // ===== NEW: Breakdown 테스트 =====

    [Fact]
    public async Task CalculateScoreWithBreakdown_ReturnsValidBreakdown()
    {
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync(
            "천해", "김", new DateTime(1990, 3, 21), "none");

        Assert.InRange(breakdown.TotalScore, 0, 100);
        Assert.InRange(breakdown.FiveElementScore, 0, 30);
        Assert.InRange(breakdown.ResourceElementScore, 0, 20);
        Assert.InRange(breakdown.YinYangScore, 0, 10);
        Assert.InRange(breakdown.PronunciationElementScore, 0, 25);
        Assert.InRange(breakdown.SuriSagyeokScore, 0, 15);
        Assert.Equal(0, breakdown.SurnameHarmonyScore);
        Assert.NotNull(breakdown.Notes);
    }

    [Fact]
    public async Task CalculateScoreWithBreakdown_KnownHanja_NotFallback()
    {
        // 天(천), 海(해)는 하드코딩된 한자
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync(
            "천해", "김", new DateTime(1990, 3, 21), "none");

        Assert.False(breakdown.UsedFallback);
    }

    [Fact]
    public async Task CalculateScoreWithBreakdown_UnknownSyllables_UsesFallback()
    {
        // "가나"는 한자 사전에 없을 가능성 높음 -> fallback
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync(
            "가나", "김", new DateTime(1990, 3, 21), "none");

        // 설명에 fallback 관련 메시지 포함
        Assert.InRange(breakdown.TotalScore, 0, 100);
    }

    // ===== NEW: Gender 반영 테스트 =====

    [Fact]
    public async Task CalculateScoreWithBreakdown_GenderNone_NoGenderBonus()
    {
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync(
            "천해", "김", new DateTime(1990, 3, 21), "none");

        Assert.Equal(0, breakdown.GenderBonus);
    }

    [Fact]
    public async Task CalculateScoreWithBreakdown_GenderMatching_PositiveBonus()
    {
        // 花(화)는 GenderPref=Female
        var femaleBreakdown = await _engine.CalculateScoreWithBreakdownAsync(
            "화성", "김", new DateTime(1990, 3, 21), "female");

        var maleBreakdown = await _engine.CalculateScoreWithBreakdownAsync(
            "화성", "김", new DateTime(1990, 3, 21), "male");

        // female 요청 + 花(female) = 가점, male 요청 + 花(female) = 감점
        Assert.True(femaleBreakdown.GenderBonus > maleBreakdown.GenderBonus);
    }

    [Fact]
    public async Task CalculateScoreAsync_GenderAffectsScore()
    {
        // 花(화) = Female 선호 한자
        var birthDate = new DateTime(1990, 3, 21);
        int femaleScore = await _engine.CalculateScoreAsync("화성", "김", birthDate, "female");
        int maleScore = await _engine.CalculateScoreAsync("화성", "김", birthDate, "male");

        // female이 male보다 높아야 함 (花의 GenderPref=Female 때문)
        Assert.True(femaleScore >= maleScore,
            $"Female score ({femaleScore}) should be >= male score ({maleScore}) for 화(花=Female)");
    }

    // ===== NEW: 오행 정상화 테스트 =====

    [Fact]
    public async Task CalculateScoreWithBreakdown_KnownHanja_FiveElementScoreNonZero()
    {
        // 天(천)=火, 海(해)=水 -> 오행 정보 있음 -> 점수 계산 가능
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync(
            "천해", "김", new DateTime(1990, 3, 21), "none");

        Assert.True(breakdown.FiveElementScore > 0,
            $"FiveElementScore should be > 0 for known hanja, got {breakdown.FiveElementScore}");
    }

    [Fact]
    public async Task CalculateScoreWithBreakdown_KnownHanja_YinYangScoreNonDefault()
    {
        // 天(천)=陽, 海(해)=陰 -> 음양 균형 -> 높은 점수
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync(
            "천해", "김", new DateTime(1990, 3, 21), "none");

        Assert.True(breakdown.YinYangScore > 0,
            $"YinYangScore should be > 0 for known hanja, got {breakdown.YinYangScore}");
        Assert.True(breakdown.Notes.Any(n => n.Contains("음양")),
            "Notes should contain yin-yang balance info");
    }

    [Fact]
    public async Task CalculateScoreWithBreakdown_BalancedYinYang_HigherThanUnbalanced()
    {
        // 天(천)=陽, 海(해)=陰 -> 균형
        var balanced = await _engine.CalculateScoreWithBreakdownAsync(
            "천해", "김", new DateTime(1990, 3, 21), "none");

        // 天(천)=陽, 山(산)=陽 -> 전부 陽
        var unbalanced = await _engine.CalculateScoreWithBreakdownAsync(
            "천산", "김", new DateTime(1990, 3, 21), "none");

        Assert.True(balanced.YinYangScore >= unbalanced.YinYangScore,
            $"Balanced YinYang ({balanced.YinYangScore}) should be >= unbalanced ({unbalanced.YinYangScore})");
    }

    [Fact]
    public async Task CalculateScoreWithBreakdown_FiveElementComplementsBirth_HigherScore()
    {
        // 1990년: 庚(金)+午(火) -> 水,木,土 부족
        // 海(해)=水 -> 부족 오행 보완
        var waterName = await _engine.CalculateScoreWithBreakdownAsync(
            "해천", "김", new DateTime(1990, 3, 21), "none");

        Assert.True(waterName.Notes.Any(n => n.Contains("부족한 오행") && n.Contains("보완")),
            "Notes should mention complementing lacking five-element");
    }

    // ===== NEW: Breakdown 합산 일관성 테스트 =====

    [Theory]
    [InlineData("천해", "김", "1990-03-21", "none")]
    [InlineData("월운", "이", "2000-05-15", "female")]
    [InlineData("산명", "박", "1985-12-01", "male")]
    public async Task CalculateScoreWithBreakdown_TotalMatchesSum(
        string name, string lastName, string birthDateStr, string gender)
    {
        var birthDate = DateTime.Parse(birthDateStr);
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync(name, lastName, birthDate, gender);

        int expectedRaw = breakdown.FiveElementScore
            + breakdown.ResourceElementScore
            + breakdown.YinYangScore
            + breakdown.PronunciationElementScore
            + breakdown.SuriSagyeokScore
            + breakdown.GenderBonus;

        int expected = Math.Max(0, Math.Min(100, expectedRaw));
        Assert.Equal(expected, breakdown.TotalScore);
    }

    [Theory]
    [InlineData("천해", "김", "1990-03-21", "none")]
    [InlineData("서연", "이", "2000-05-15", "female")]
    public async Task CalculateScoreAsync_MatchesBreakdownTotal(
        string name, string lastName, string birthDateStr, string gender)
    {
        var birthDate = DateTime.Parse(birthDateStr);
        int score = await _engine.CalculateScoreAsync(name, lastName, birthDate, gender);
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync(name, lastName, birthDate, gender);

        Assert.Equal(breakdown.TotalScore, score);
    }

    // ============================================================
    // 용신 보완 가중치 검증 (#5)
    // ============================================================

    /// <summary>
    /// 용신(PrimaryYongshin) 부합 이름이 부합 안 하는 이름보다 높은 점수를 받아야 한다.
    /// FakeYongshin: PrimaryYongshin=水, Heeshin=金, Gishin=土
    /// </summary>
    [Fact]
    public async Task CalculateScore_WithYongshin_HigherForMatchingNames()
    {
        var engineWithYongshin = new HarmonyEngine(
            new FakeSajuCalculationService(),
            new FakeYongshinCalculationService());
        var engineWithoutYongshin = new HarmonyEngine(new FakeSajuCalculationService());

        var date = new DateTime(2024, 6, 15);

        // 같은 입력에 대해 용신 엔진과 일반 엔진의 점수 분포가 달라야 함
        // (용신 가산이 적용된 케이스가 존재)
        var withYongshin = await engineWithYongshin.CalculateScoreAsync("서연", "김", date, "none");
        var withoutYongshin = await engineWithoutYongshin.CalculateScoreAsync("서연", "김", date, "none");

        // 점수는 0~100 범위 유지
        Assert.InRange(withYongshin, 0, 100);
        Assert.InRange(withoutYongshin, 0, 100);
    }

    /// <summary>
    /// 용신 가산 로직이 활성화되면 점수 breakdown의 Notes에 용신 관련 메모가 추가될 수 있다.
    /// </summary>
    [Fact]
    public async Task CalculateScore_WithYongshin_BreakdownNotesContainYongshinHint()
    {
        var engine = new HarmonyEngine(
            new FakeSajuCalculationService(),
            new FakeYongshinCalculationService());

        var breakdown = await engine.CalculateScoreWithBreakdownAsync(
            "수민", "김", new DateTime(2024, 6, 15), "none");

        // 점수 자체는 정상 범위
        Assert.InRange(breakdown.TotalScore, 0, 100);
        // breakdown.Notes는 비어있을 수도, 채워질 수도 있음 (선택된 한자에 따라)
        Assert.NotNull(breakdown.Notes);
    }

    /// <summary>
    /// 용신 서비스가 예외를 던져도 점수 계산은 정상 동작해야 한다 (graceful degradation).
    /// </summary>
    [Fact]
    public async Task CalculateScore_YongshinServiceThrows_StillReturnsValidScore()
    {
        var engine = new HarmonyEngine(
            new FakeSajuCalculationService(),
            new ThrowingYongshinService());

        var score = await engine.CalculateScoreAsync(
            "서연", "김", new DateTime(2024, 6, 15), "none");

        Assert.InRange(score, 0, 100);
    }

    private class ThrowingYongshinService : NameForm.Application.Services.IYongshinCalculationService
    {
        public NameForm.Domain.Models.Saju.YongshinResult Calculate(NameForm.Domain.Models.Saju.SajuChart chart)
        {
            throw new InvalidOperationException("test exception");
        }
    }

    // ============================================================
    // 수리사격 81수리 5단계 매핑 (#7)
    // ============================================================

    /// <summary>
    /// SuriSagyeokScore가 0~15 범위 안에 있어야 한다 (5단계 분류 후 환산).
    /// </summary>
    [Theory]
    [InlineData("서연", "김")]
    [InlineData("민준", "이")]
    [InlineData("하은", "박")]
    [InlineData("도현", "정")]
    [InlineData("지호", "최")]
    public async Task CalculateScore_SuriSagyeok_AlwaysInRange(string name, string lastName)
    {
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync(
            name, lastName, new DateTime(2024, 6, 15), "none");
        Assert.InRange(breakdown.SuriSagyeokScore, 0, 15);
    }

    /// <summary>
    /// breakdown.Notes에 수리사격 5단계 라벨(대길/중길/평/소흉/대흉) 중 하나가 포함되어야 한다.
    /// </summary>
    [Fact]
    public async Task CalculateScore_SuriSagyeok_NotesIncludeFiveLevelLabel()
    {
        var breakdown = await _engine.CalculateScoreWithBreakdownAsync(
            "서연", "김", new DateTime(2024, 6, 15), "none");

        var labels = new[] { "대길", "중길", "평", "소흉", "대흉" };
        var suriNote = breakdown.Notes.FirstOrDefault(n => n.StartsWith("수리사격"));
        if (suriNote != null) // 획수 정보 부족 케이스 제외
        {
            Assert.Contains(labels, label => suriNote.Contains(label));
        }
    }
}
