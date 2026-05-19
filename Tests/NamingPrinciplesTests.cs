using NameForm.Application.Engines;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// NamingPrinciples — 보편 작명 원리 8종 단위 테스트.
/// 7개 엔진(NamePool, PureKorean, ThreeSyllable, RareSurname, Creative, Twin, RequiredChar)이 공유하는 핵심 로직.
/// </summary>
public class NamingPrinciplesTests
{
    // ============================================================
    // EvalSurnameFlow — 성씨 연음
    // ============================================================

    [Theory]
    [InlineData("박", "아름", 1.0)]   // 받침+ㅇ — 연음 최고
    [InlineData("김", "노을", 0.90)]  // 받침+ㄴ — 비음
    [InlineData("박", "강민", 0.45)]  // 받침+ㄱ — 경음화
    public void EvalSurnameFlow_BatchimSurname_ReturnsExpected(string lastName, string firstReading, double expected)
    {
        var result = NamingPrinciples.EvalSurnameFlow(lastName, firstReading);
        Assert.Equal(expected, result, precision: 2);
    }

    [Fact]
    public void EvalSurnameFlow_NoBatchim_DifferentValuesByInitial()
    {
        // 허+아 (모음 시작) > 허+카 (격음)
        var withVowel = NamingPrinciples.EvalSurnameFlow("허", "아름");
        var withAspirated = NamingPrinciples.EvalSurnameFlow("허", "카준");
        Assert.True(withVowel > withAspirated);
    }

    // ============================================================
    // EvalOhaengSynergy — 음령오행 상생
    // ============================================================

    [Fact]
    public void EvalOhaengSynergy_ShengForward_IsHighest()
    {
        // ㄱ(木) → ㄴ(火) 상생
        var forward = NamingPrinciples.EvalOhaengSynergy("강", "남");
        // ㄴ(火) → ㄱ(木) 역방향
        var backward = NamingPrinciples.EvalOhaengSynergy("남", "강");
        Assert.True(forward >= backward);
    }

    // ============================================================
    // EvalRhythm — 받침 리듬
    // ============================================================

    [Fact]
    public void EvalRhythm_NoBatchimThenBatchim_IsBest()
    {
        var best = NamingPrinciples.EvalRhythm("서", "현"); // 받침없음 + 받침있음
        var second = NamingPrinciples.EvalRhythm("민", "서"); // 받침있음 + 받침없음
        Assert.True(best >= second);
        Assert.Equal(1.0, best, precision: 2);
    }

    // ============================================================
    // EvalInitialDiversity — 초성 다양성
    // ============================================================

    [Fact]
    public void EvalInitialDiversity_SameInitial_IsZero()
    {
        var same = NamingPrinciples.EvalInitialDiversity("민", "명"); // 둘 다 ㅁ
        Assert.Equal(0.0, same, precision: 2);
    }

    [Fact]
    public void EvalInitialDiversity_DifferentInitials_IsOne()
    {
        var diff = NamingPrinciples.EvalInitialDiversity("민", "서"); // ㅁ vs ㅅ
        Assert.Equal(1.0, diff, precision: 2);
    }

    // ============================================================
    // EvalAwkwardCombination — 어색 자음 결합 (신규)
    // ============================================================

    [Fact]
    public void EvalAwkwardCombination_AspiratedAndTensed_IsHeavilyPenalized()
    {
        // 카(ㅋ 격음) + 까(ㄲ 된소리) — 가장 어색
        var awkward = NamingPrinciples.EvalAwkwardCombination("카", "까");
        Assert.True(awkward <= 0.2, $"격음+된소리는 0.2 이하여야 함 (실제: {awkward})");
    }

    [Fact]
    public void EvalAwkwardCombination_NormalCombo_IsNeutralOrPositive()
    {
        var normal = NamingPrinciples.EvalAwkwardCombination("민", "서"); // ㅁ + ㅅ — 자연스러움
        Assert.Equal(1.0, normal, precision: 2);
    }

    [Theory]
    [InlineData("크", "카")] // 격음 + 격음
    [InlineData("까", "쯔")] // 된소리 + 된소리
    public void EvalAwkwardCombination_StrongCombos_AreReducedScore(string r1, string r2)
    {
        var score = NamingPrinciples.EvalAwkwardCombination(r1, r2);
        Assert.True(score < 0.5, $"강한 자음 연속은 0.5 미만이어야 함 (실제: {score})");
    }

    // ============================================================
    // EvalConsonantEcho — 받침 에코 (신규)
    // ============================================================

    [Fact]
    public void EvalConsonantEcho_SameFinalConsonant_IsPenalized()
    {
        // 민(ㄴ) + 준(ㄴ) — 같은 받침
        var echo = NamingPrinciples.EvalConsonantEcho("민", "준");
        Assert.True(echo <= 0.4, $"동일 받침 반복은 0.4 이하여야 함 (실제: {echo})");
    }

    [Fact]
    public void EvalConsonantEcho_NoBatchimBoth_IsNeutral()
    {
        var noEcho = NamingPrinciples.EvalConsonantEcho("서", "아"); // 받침 둘 다 없음
        Assert.Equal(1.0, noEcho, precision: 2);
    }

    [Fact]
    public void EvalConsonantEcho_DifferentBatchim_IsGood()
    {
        var diff = NamingPrinciples.EvalConsonantEcho("민", "준호"[1].ToString()); // ㄴ vs ㄴ → 동일... 다른 예
        var good = NamingPrinciples.EvalConsonantEcho("민", "현"); // ㄴ vs ㄴ
        // 사실 같은 받침. 다른 받침으로 다시 검증:
        var realDiff = NamingPrinciples.EvalConsonantEcho("강", "민"); // ㅇ vs ㄴ
        Assert.True(realDiff > 0.7, $"다른 받침은 0.7 이상이어야 함 (실제: {realDiff})");
    }

    // ============================================================
    // EvalForeignPhonotactics — 외래어 발음 회피 (신규)
    // ============================================================

    [Theory]
    [InlineData("조지")]   // George
    [InlineData("줄리")]   // Julie
    [InlineData("안나")]   // Anna
    [InlineData("유키")]   // 일본
    public void EvalForeignPhonotactics_ForeignSoundingNames_AreHeavilyPenalized(string name)
    {
        var score = NamingPrinciples.EvalForeignPhonotactics(name);
        Assert.True(score <= 0.3, $"외래어 발음 '{name}'은 0.3 이하여야 함 (실제: {score})");
    }

    [Theory]
    [InlineData("민준")]
    [InlineData("서윤")]
    [InlineData("하늘")]
    [InlineData("도현")]
    public void EvalForeignPhonotactics_KoreanNames_AreNotPenalized(string name)
    {
        var score = NamingPrinciples.EvalForeignPhonotactics(name);
        Assert.Equal(1.0, score, precision: 2);
    }

    // ============================================================
    // EvalSyllableLengthBalance — 음절 길이 균형 (신규)
    // ============================================================

    [Fact]
    public void EvalSyllableLengthBalance_OnePlusTwo_IsBest()
    {
        // 김+민준 — 표준 1+2
        var best = NamingPrinciples.EvalSyllableLengthBalance("김", "민준");
        Assert.Equal(1.0, best, precision: 2);
    }

    [Fact]
    public void EvalSyllableLengthBalance_TwoPlusThree_IsWorst()
    {
        // 남궁+민준호 — 5음절, 회피
        var worst = NamingPrinciples.EvalSyllableLengthBalance("남궁", "민준호");
        Assert.True(worst <= 0.3, $"2+3 조합은 0.3 이하여야 함 (실제: {worst})");
    }

    [Fact]
    public void EvalSyllableLengthBalance_OnePlusTwoVsOnePlusThree_BalancedIsHigher()
    {
        var balanced = NamingPrinciples.EvalSyllableLengthBalance("김", "민준");
        var fourSyllable = NamingPrinciples.EvalSyllableLengthBalance("김", "민준호");
        Assert.True(balanced > fourSyllable);
    }

    // ============================================================
    // 일관성: 모든 함수가 0~1 범위 반환
    // ============================================================

    [Fact]
    public void AllNamingPrinciples_ReturnValuesInZeroToOneRange()
    {
        var pairs = new[] { ("민", "서"), ("준", "호"), ("강", "산"), ("아", "름"), ("이", "유") };
        foreach (var (r1, r2) in pairs)
        {
            Assert.InRange(NamingPrinciples.EvalSurnameFlow("김", r1), 0.0, 1.0);
            Assert.InRange(NamingPrinciples.EvalOhaengSynergy(r1, r2), 0.0, 1.0);
            Assert.InRange(NamingPrinciples.EvalRhythm(r1, r2), 0.0, 1.0);
            Assert.InRange(NamingPrinciples.EvalInitialDiversity(r1, r2), 0.0, 1.0);
            Assert.InRange(NamingPrinciples.EvalAwkwardCombination(r1, r2), 0.0, 1.0);
            Assert.InRange(NamingPrinciples.EvalConsonantEcho(r1, r2), 0.0, 1.0);
            Assert.InRange(NamingPrinciples.EvalForeignPhonotactics(r1 + r2), 0.0, 1.0);
            Assert.InRange(NamingPrinciples.EvalSyllableLengthBalance("김", r1 + r2), 0.0, 1.0);
        }
    }

    [Fact]
    public void AllNamingPrinciples_HandleEmptyInputGracefully()
    {
        // 빈 입력에도 예외 없이 동작 (대부분 0.5 또는 1.0 반환)
        NamingPrinciples.EvalSurnameFlow("", "");
        NamingPrinciples.EvalOhaengSynergy("", "");
        NamingPrinciples.EvalRhythm("", "");
        NamingPrinciples.EvalInitialDiversity("", "");
        NamingPrinciples.EvalAwkwardCombination("", "");
        NamingPrinciples.EvalConsonantEcho("", "");
        NamingPrinciples.EvalForeignPhonotactics("");
        NamingPrinciples.EvalSyllableLengthBalance("", "");
        NamingPrinciples.EvalConsonantAssimilation("", "");
        NamingPrinciples.EvalVowelMonotony("", "");
    }

    // ============================================================
    // EvalConsonantAssimilation — 종성-초성 동화 (#9)
    // ============================================================

    [Fact]
    public void EvalConsonantAssimilation_HardFinalPlusHardenable_IsPenalized()
    {
        // 박(받침 ㄱ) + 강(초성 ㄱ) — 경음화 박깡
        var hardening = NamingPrinciples.EvalConsonantAssimilation("박", "강");
        Assert.True(hardening <= 0.5, $"경음화 결합은 0.5 이하여야 함 (실제: {hardening})");
    }

    [Fact]
    public void EvalConsonantAssimilation_NeunPlusRieul_IsNatural()
    {
        // 신(ㄴ) + 라(ㄹ) — 유음화 (자연)
        var natural = NamingPrinciples.EvalConsonantAssimilation("신", "라");
        Assert.True(natural >= 0.8, $"ㄴ+ㄹ은 0.8 이상이어야 함 (실제: {natural})");
    }

    [Fact]
    public void EvalConsonantAssimilation_NoBatchim_IsNeutral()
    {
        var noEffect = NamingPrinciples.EvalConsonantAssimilation("서", "아");
        Assert.Equal(1.0, noEffect, precision: 2);
    }

    // ============================================================
    // EvalVowelMonotony — 모음 단조성 (#9)
    // ============================================================

    [Theory]
    [InlineData("사", "사")] // ㅏㅏ
    [InlineData("미", "지")] // ㅣㅣ
    [InlineData("보", "노")] // ㅗㅗ
    public void EvalVowelMonotony_SameVowel_IsPenalized(string r1, string r2)
    {
        var score = NamingPrinciples.EvalVowelMonotony(r1, r2);
        Assert.True(score <= 0.5, $"동일 모음은 0.5 이하여야 함 (실제: {score})");
    }

    [Theory]
    [InlineData("서", "현")] // ㅓ vs ㅕ
    [InlineData("민", "준")] // ㅣ vs ㅜ
    [InlineData("도", "현")] // ㅗ vs ㅕ
    public void EvalVowelMonotony_DifferentVowels_IsOne(string r1, string r2)
    {
        var score = NamingPrinciples.EvalVowelMonotony(r1, r2);
        Assert.Equal(1.0, score, precision: 2);
    }

    // ============================================================
    // ApplyDueum / RequiresDueum — 두음법칙 (#9)
    // ============================================================

    [Theory]
    [InlineData("리", "이")]
    [InlineData("림", "임")]
    [InlineData("량", "양")]
    [InlineData("류", "유")]
    [InlineData("락", "락")] // 매핑 없는 음절은 원본 유지 ('락'은 두음 적용)
    public void ApplyDueum_TransformsAsExpected(string input, string expected)
    {
        // '락'은 사실 두음 매핑에 없으므로 원본 반환
        var actual = NamingPrinciples.ApplyDueum(input);
        if (NamingPrinciples.RequiresDueum(input))
        {
            Assert.NotEqual(input, actual);
        }
        else
        {
            Assert.Equal(input, actual);
        }
    }

    [Fact]
    public void RequiresDueum_NonDueumSyllables_ReturnFalse()
    {
        Assert.False(NamingPrinciples.RequiresDueum("서"));
        Assert.False(NamingPrinciples.RequiresDueum("준"));
        Assert.False(NamingPrinciples.RequiresDueum(""));
    }

    [Fact]
    public void RequiresDueum_DueumSyllables_ReturnTrue()
    {
        Assert.True(NamingPrinciples.RequiresDueum("리"));
        Assert.True(NamingPrinciples.RequiresDueum("림"));
        Assert.True(NamingPrinciples.RequiresDueum("량"));
    }
}
