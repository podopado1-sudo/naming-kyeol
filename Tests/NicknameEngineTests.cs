using NameForm.Application.Engines;

namespace NameForm.Tests;

public class NicknameEngineTests
{
    private readonly NicknameEngine _engine = new();

    [Fact]
    public async Task GenerateNicknamesAsync_WithValidInput_ReturnsNonEmpty()
    {
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "민서" });

        Assert.NotEmpty(nicknames);
    }

    [Fact]
    public async Task GenerateNicknamesAsync_ReturnsAtLeast3AndAtMost10()
    {
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "민서", "지현", "수아" });

        Assert.True(nicknames.Count >= 3, $"별명 수({nicknames.Count})가 3개 미만");
        Assert.True(nicknames.Count <= 10, $"별명 수({nicknames.Count})가 10개를 초과함");
    }

    [Fact]
    public async Task GenerateNicknamesAsync_SingleName_ReturnsAtLeast3()
    {
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "준호" });

        Assert.True(nicknames.Count >= 3, $"별명 수({nicknames.Count})가 3개 미만");
    }

    [Fact]
    public async Task GenerateNicknamesAsync_NoDuplicates()
    {
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "민서", "지현" });

        Assert.Equal(nicknames.Count, nicknames.Distinct().Count());
    }

    [Fact]
    public async Task GenerateNicknamesAsync_AllNicknamesAre2To5Chars()
    {
        var nicknames = await _engine.GenerateNicknamesAsync("이", new List<string> { "수현", "하은" });

        Assert.All(nicknames, n =>
            Assert.True(n.Length >= 2 && n.Length <= 5,
                $"'{n}'은 {n.Length}글자 (2~5글자이어야 함)"));
    }

    [Fact]
    public async Task GenerateNicknamesAsync_WithSingleCharName_HandledGracefully()
    {
        // 1글자 이름은 건너뜀 (name.Length < 2 조건)
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "준" });

        Assert.NotNull(nicknames);
        // 1글자 이름은 건너뛰므로 빈 결과 가능
    }

    [Fact]
    public async Task GenerateNicknamesAsync_NoInappropriateWords()
    {
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "민서", "지현", "수아" });

        var inappropriateWords = new[] { "바보", "멍청", "못난", "나쁜", "미친", "돼지" };
        Assert.All(nicknames, n =>
            Assert.DoesNotContain(inappropriateWords, word => n.Contains(word)));
    }

    [Fact]
    public async Task GenerateNicknamesAsync_EmptyNames_ReturnsEmpty()
    {
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string>());

        Assert.Empty(nicknames);
    }

    [Fact]
    public async Task GenerateNicknamesAsync_ContainsCallSuffix_WithBatchim()
    {
        // "수현" → 받침 ㄴ 있음 → "수현아"
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "수현" });

        Assert.Contains("수현아", nicknames);
    }

    [Fact]
    public async Task GenerateNicknamesAsync_ContainsCallSuffix_WithoutBatchim()
    {
        // "민서" → 받침 없음 → "민서야"
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "민서" });

        Assert.Contains("민서야", nicknames);
    }

    [Fact]
    public async Task GenerateNicknamesAsync_ContainsFirstCharPlusI()
    {
        // "준호" → "준이"
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "준호" });

        Assert.Contains("준이", nicknames);
    }

    [Fact]
    public async Task GenerateNicknamesAsync_ContainsDoubledFirstChar()
    {
        // "민서" → "민민" 또는 "민민이"
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "민서" });

        Assert.True(
            nicknames.Contains("민민") || nicknames.Contains("민민이"),
            "첫 글자 반복 별명(민민 또는 민민이)이 포함되어야 함");
    }

    [Fact]
    public async Task GenerateNicknamesAsync_ContainsLastNameCombination()
    {
        // 김 + 민서 → "김민" 또는 "김서"
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "민서" });

        Assert.True(
            nicknames.Contains("김민") || nicknames.Contains("김서"),
            "성+이름 조합 별명(김민 또는 김서)이 포함되어야 함");
    }

    [Fact]
    public async Task GenerateNicknamesAsync_NotDummyValues()
    {
        // 별명이 실제로 이름과 관련된 의미 있는 값인지 확인
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "준호" });

        // 모든 별명이 이름의 글자(준, 호) 또는 성(김)을 포함해야 함
        Assert.All(nicknames, n =>
            Assert.True(
                n.Contains("준") || n.Contains("호") || n.Contains("김") ||
                // 귀여운 접미사 별명 허용 (준뽀, 준링 등)
                n.StartsWith("준") || n.StartsWith("호"),
                $"'{n}'은 이름(준호) 또는 성(김)과 관련이 없음"));
    }

    [Fact]
    public async Task GenerateNicknamesAsync_ThreeCharName_Works()
    {
        // 3글자 이름 (드물지만 가능)
        var nicknames = await _engine.GenerateNicknamesAsync("김", new List<string> { "민서현" });

        Assert.NotEmpty(nicknames);
        Assert.All(nicknames, n =>
            Assert.True(n.Length >= 2 && n.Length <= 5,
                $"'{n}'은 {n.Length}글자 (2~5글자이어야 함)"));
    }
}
