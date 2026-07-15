using System.Linq;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// WeakGivenNameHanjaSet(359자) 회귀 테스트 — 감점 세트의 HanjaData 이관 + 확장.
/// weak는 배제가 아니라 감점: 동음 대안이 있을 때만 양보한다.
/// </summary>
public class WeakGivenNameHanjaTests
{
    [Theory]
    [InlineData("友")] // 벗 우 (기존 14자 대표)
    [InlineData("雨")] // 비 우
    [InlineData("西")] // 서녘 서
    [InlineData("紙")] // 종이 지
    public void LegacySet_StillWeak(string ch)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(ch));
    }

    [Theory]
    [InlineData("菜")] // 나물 채 (확장분 대표)
    [InlineData("枷")] // 도리깨 가
    [InlineData("焉")] // 어찌 언 (허사)
    [InlineData("腸")] // 창자 장 (신체 범속)
    [InlineData("倉")] // 곳집 창
    [InlineData("商")] // 장사 상 — 대표 훈 정정 후 후속 검토 (尙常相祥 대안)
    [InlineData("貨")] // 재물 화 — 화 음절 점유 아티팩트 (平貨→平和)
    [InlineData("暈")] // 무리 훈 — 훈/운 음절 점유 아티팩트 (在暈→才訓)
    public void ExpandedSet_IsWeak(string ch)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(ch));
    }

    [Theory]
    [InlineData("禾")] // 벼 화 — 결실·풍요 (경계 24자: 의도적 미포함)
    [InlineData("錐")] // 송곳 추 — 낭중지추
    [InlineData("鯉")] // 잉어 리 — 등용문
    [InlineData("襟")] // 옷깃 금 — 흉금·금도
    [InlineData("宇")] // 집 우 — 좋은 이름 한자가 오염되지 않았는지
    [InlineData("瑞")] // 상서 서
    public void PositiveOrBorderline_NotWeak(string ch)
    {
        Assert.False(HanjaData.IsWeakGivenNameHanja(ch));
    }

    [Fact]
    public void SelectorShim_DelegatesToHanjaData()
    {
        Assert.True(HanjaSelector.IsWeakGivenNameHanja("雨"));
        Assert.False(HanjaSelector.IsWeakGivenNameHanja("宇"));
    }

    [Theory]
    [InlineData("菜")]
    [InlineData("焉")]
    [InlineData("倉")]
    public void WeakAndForbidden_AreDisjoint(string ch)
    {
        // weak(감점)와 forbidden(배제)은 상호 배타 정책 — 스캔 단계에서 불용 제외 후 선정.
        Assert.False(HanjaData.IsForbiddenNameHanja(ch));
    }

    [Theory]
    [InlineData("우")] // 友·雨 대신 宇·佑·祐 등
    [InlineData("채")] // 菜 대신 彩·採 등
    [InlineData("창")] // 倉 대신 昌·彰 등
    public void Select_YieldsToNonWeakAlternative(string syllable)
    {
        var picked = HanjaSelector.Select(syllable, "none", null, null, null);
        Assert.Single(picked);
        Assert.NotNull(picked[0]);
        Assert.False(HanjaData.IsWeakGivenNameHanja(picked[0]!.Character),
            $"'{syllable}' 대표로 약한 한자 {picked[0]!.Character} 선택됨 — 대안 존재 시 양보해야");
    }
}
