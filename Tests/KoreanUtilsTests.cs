using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// KoreanUtils 유틸리티 단위 테스트
/// </summary>
public class KoreanUtilsTests
{
    // ===== Decompose =====

    [Fact]
    public void Decompose_가_ReturnsCorrectComponents()
    {
        var (initial, vowel, final) = KoreanUtils.Decompose('가');
        Assert.Equal("ㄱ", initial);
        Assert.Equal("ㅏ", vowel);
        Assert.Equal("", final);
    }

    [Fact]
    public void Decompose_한_ReturnsCorrectComponents()
    {
        var (initial, vowel, final) = KoreanUtils.Decompose('한');
        Assert.Equal("ㅎ", initial);
        Assert.Equal("ㅏ", vowel);
        Assert.Equal("ㄴ", final);
    }

    [Fact]
    public void Decompose_닭_ReturnsCorrectComponents()
    {
        var (initial, vowel, final) = KoreanUtils.Decompose('닭');
        Assert.Equal("ㄷ", initial);
        Assert.Equal("ㅏ", vowel);
        Assert.Equal("ㄺ", final);
    }

    [Fact]
    public void Decompose_NonKorean_ReturnsEmpty()
    {
        var (initial, vowel, final) = KoreanUtils.Decompose('A');
        Assert.Equal("", initial);
        Assert.Equal("", vowel);
        Assert.Equal("", final);
    }

    // ===== HasFinalConsonant =====

    [Theory]
    [InlineData('한', true)]   // 받침 ㄴ
    [InlineData('가', false)]  // 받침 없음
    [InlineData('민', true)]   // 받침 ㄴ
    [InlineData('서', false)]  // 받침 없음
    [InlineData('A', false)]   // 비한글
    public void HasFinalConsonant_ReturnsExpected(char syllable, bool expected)
    {
        Assert.Equal(expected, KoreanUtils.HasFinalConsonant(syllable));
    }

    // ===== CountFinalConsonants =====

    [Theory]
    [InlineData("서연", 1)]    // 연(ㄴ)
    [InlineData("하은", 1)]    // 은(ㄴ)
    [InlineData("가나", 0)]    // 받침 없음
    [InlineData("한글", 2)]    // 한(ㄴ) + 글(ㄹ)
    public void CountFinalConsonants_ReturnsExpected(string text, int expected)
    {
        Assert.Equal(expected, KoreanUtils.CountFinalConsonants(text));
    }

    // ===== EvaluatePronunciationDifficulty =====

    [Fact]
    public void EvaluatePronunciationDifficulty_NoFinalConsonant2Syllable_ReturnsHigh()
    {
        // 받침 없는 2음절 = 최고 점수
        int score = KoreanUtils.EvaluatePronunciationDifficulty("서아");
        Assert.Equal(100, score);
    }

    [Fact]
    public void EvaluatePronunciationDifficulty_WithFinalConsonants_DeductsPoints()
    {
        // "한글" = 받침 2개 → -20, 2음절 → -0 = 80
        int score = KoreanUtils.EvaluatePronunciationDifficulty("한글");
        Assert.Equal(80, score);
    }

    [Fact]
    public void EvaluatePronunciationDifficulty_3Syllables_DeductsForLength()
    {
        // 3음절, 받침 없음 → -5 = 95
        int score = KoreanUtils.EvaluatePronunciationDifficulty("가나다");
        Assert.Equal(95, score);
    }

    [Fact]
    public void EvaluatePronunciationDifficulty_ScoreNeverBelowZero()
    {
        // 아주 긴 이름 + 받침 많음 → 0 이하로 안 내려감
        int score = KoreanUtils.EvaluatePronunciationDifficulty("한글받침많은이름");
        Assert.InRange(score, 0, 100);
    }

    // ===== EvaluateLength =====

    [Theory]
    [InlineData("가", 40)]     // 1음절
    [InlineData("가나", 100)]  // 2음절 (최적)
    [InlineData("가나다", 60)] // 3음절
    [InlineData("가나다라", 30)] // 4음절
    public void EvaluateLength_ReturnsExpectedScore(string name, int expected)
    {
        Assert.Equal(expected, KoreanUtils.EvaluateLength(name));
    }

    // ===== EvaluateRhythm =====

    [Fact]
    public void EvaluateRhythm_SingleChar_Returns50()
    {
        Assert.Equal(50, KoreanUtils.EvaluateRhythm("가"));
    }

    [Fact]
    public void EvaluateRhythm_ScoreInRange()
    {
        int score = KoreanUtils.EvaluateRhythm("서연");
        Assert.InRange(score, 0, 100);
    }

    // ===== HasSameConsonantRepetition =====

    [Fact]
    public void HasSameConsonantRepetition_SameInitial_ReturnsTrue()
    {
        // 가갸: 둘 다 ㄱ
        Assert.True(KoreanUtils.HasSameConsonantRepetition("가고"));
    }

    [Fact]
    public void HasSameConsonantRepetition_DifferentInitial_ReturnsFalse()
    {
        Assert.False(KoreanUtils.HasSameConsonantRepetition("가나"));
    }

    [Fact]
    public void HasSameConsonantRepetition_IeungRepeat_ReturnsFalse()
    {
        // ㅇ+ㅇ은 예외 (허용)
        Assert.False(KoreanUtils.HasSameConsonantRepetition("아이"));
    }

    [Fact]
    public void HasSameConsonantRepetition_SingleChar_ReturnsFalse()
    {
        Assert.False(KoreanUtils.HasSameConsonantRepetition("가"));
    }
}
