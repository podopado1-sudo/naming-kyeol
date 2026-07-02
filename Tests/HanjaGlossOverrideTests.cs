using NameForm.Application.Engines.Data;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 대표 훈 오버라이드(hanja-gloss-overrides.json + ReorderGloss) 회귀 테스트.
/// 소비처(CleanGloss/BuildCardMeaning/firstGloss)는 첫 훈만 취하므로
/// Meaning의 첫 토큰이 통용 대표 훈인지가 표시 품질의 계약이다.
/// </summary>
public class HanjaGlossOverrideTests
{
    [Fact]
    public void ReorderGloss_ExistingGloss_MovesToFront()
    {
        var result = HanjaData.ReorderGloss("불탈 연/그럴 연", "그럴 연");
        Assert.Equal("그럴 연, 불탈 연", result);
    }

    [Fact]
    public void ReorderGloss_NewGloss_PrependsAndPreservesAll()
    {
        var result = HanjaData.ReorderGloss("제비쑥 위, 답답할 울", "우거질 울");
        Assert.Equal("우거질 울, 제비쑥 위, 답답할 울", result);
    }

    [Fact]
    public void ReorderGloss_Idempotent()
    {
        var once = HanjaData.ReorderGloss("불탈 연/그럴 연", "그럴 연");
        var twice = HanjaData.ReorderGloss(once, "그럴 연");
        Assert.Equal(once, twice);
    }

    [Fact]
    public void ReorderGloss_CommaAndMiddleDotDelimiters()
    {
        Assert.Equal("주인 주, 임금 주", HanjaData.ReorderGloss("임금 주, 주인 주", "주인 주"));
        Assert.Equal("기쁠 태, 바꿀 태, 날카로울 예",
            HanjaData.ReorderGloss("바꿀 태 · 기쁠 태 · 날카로울 예", "기쁠 태"));
    }

    [Fact]
    public void ReorderGloss_EmptyMeaning_ReturnsPreferred()
    {
        Assert.Equal("그럴 연", HanjaData.ReorderGloss("", "그럴 연"));
    }

    [Fact]
    public void Override_Yeon_FirstGlossIsTongyong_OriginalPreserved()
    {
        // 然: 사전 원문 "불탈 연/그럴 연" → 오버라이드로 "그럴 연"이 첫 훈, 원 훈 보존
        var info = HanjaData.FindByCharacter("然");
        Assert.NotNull(info);
        var first = info!.Meaning.Split(',', '/', ';', '·')[0].Trim();
        Assert.Equal("그럴 연", first);
        Assert.Contains("불탈", info.Meaning);
    }

    [Fact]
    public void Override_Ul_NewGlossInserted()
    {
        // 蔚: 원문에 없던 통용 훈 "우거질 울"을 신규 삽입, 기존 훈 보존
        var info = HanjaData.FindByCharacter("蔚");
        Assert.NotNull(info);
        var first = info!.Meaning.Split(',', '/', ';', '·')[0].Trim();
        Assert.Equal("우거질 울", first);
        Assert.Contains("제비쑥", info.Meaning);
    }
}
