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
    [InlineData(0x2F9A3)] // 菜 호환 보충 — 사전 원본에 별도 항목으로 있던 호환형(2026-10-22 기준 14자)
    [InlineData(0xF974)]  // 若 호환
    [InlineData(0xF910)]  // 蘿 호환
    public void CompatCodepoint_WeakViaNfkc(int codepoint)
    {
        // IsForbiddenNameHanja 와 같은 NFKC 폴백 — 세트에는 통합 한자만 두고 호환형은 정규형으로 조회.
        // 정수 코드포인트: 호환 한자 리터럴은 편집기 NFC 정규화로 통합 한자로 바뀐 회귀 전력이 있다.
        var compat = char.ConvertFromUtf32(codepoint);
        Assert.NotEqual(compat, compat.Normalize(System.Text.NormalizationForm.FormKC));
        Assert.True(HanjaData.IsWeakGivenNameHanja(compat.Normalize(System.Text.NormalizationForm.FormKC)));
        Assert.True(HanjaData.IsWeakGivenNameHanja(compat));
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
    [InlineData("咳")] // 기침 해 — 7/02 대표 훈 교정 뒤 해웅=咳雄으로 노출 (2026-10-07 라이브 실측)
    [InlineData("煂")] // 불태울 혁 — 준혁=俊煂 등 12쌍
    [InlineData("烋")] // 효 자리 훈 '거들먹거릴'(대법원 효·휴 겸용) — 효리=烋李가 1순위였음
    [InlineData("降")] // 항 자리 훈 '항복할'
    public void LiveAudit20261007_IsWeak(string ch)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(ch));
        Assert.False(HanjaData.IsForbiddenNameHanja(ch));
    }

    [Theory]
    [InlineData("帆")] // 돛 범 — 자원오행 전환 뒤 범준·경범 등 공개 16명 1순위 (2026-10-22 S6-2 두더지 1라운드)
    [InlineData("柯")] // 가지 가 — 가온 1순위
    [InlineData("豆")] // 콩 두 — 荳(콩 두)와 같은 곡물 훈
    [InlineData("鹿")] // 사슴 록 — 초록 대표 뜻 '처음 마주한 순수한 사슴의'
    [InlineData("必")] // 반드시 필 (허사) — 승필 '반드시 이기고야 마는'
    [InlineData("復")] // 부 자리 '다시'
    [InlineData("契")] // 설 자리 '사람 이름' — 은설=恩契가 계 자리 '맺을' 뜻으로 윤문됨
    [InlineData("附")] // 붙을 부 — 2라운드(復 뒤 부겸·부영 1순위)
    [InlineData("返")] // 돌이킬 반 — 2라운드(半 뒤 반희 1순위)
    public void MoleAudit20261022_IsWeak(string ch)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(ch));
        Assert.False(HanjaData.IsForbiddenNameHanja(ch));
    }

    [Fact]
    public void MoleAudit20261022_DrownIsForbidden()
    {
        // 溺(빠질 닉·오줌 뇨) — 2라운드에 라익 4순위 빈칸으로 승격된 명백 부정자. weak 가 아니라 불용.
        Assert.True(HanjaData.IsForbiddenNameHanja("溺"));
        Assert.False(HanjaData.IsWeakGivenNameHanja("溺"));
    }

    [Theory]
    [InlineData("이안", "male")]   // 李眼(눈 안)이 4칸 채우기로 노출되던 이름
    [InlineData("태휘", "none")]   // 胎輝(아이 밸 태)
    [InlineData("새라", "female")] // 鰓羅(아가미 새)·愢羅(마음 맞지 않을 새)
    [InlineData("해웅", "male")]   // 咳雄
    [InlineData("준혁", "male")]   // 俊煂
    [InlineData("효리", "female")] // 烋李
    [InlineData("범준", "male")]   // 帆俊 (2026-10-22 S6-2)
    [InlineData("은설", "female")] // 恩契
    [InlineData("초록", "female")] // 初鹿
    [InlineData("반희", "female")] // 半熙 → 返熙 (2라운드)
    [InlineData("부겸", "male")]   // 附謙 (2라운드)
    public void SelectCombos_DropsWeakPairs_WhenCleanPairExists(string name, string gender)
    {
        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        Assert.NotEmpty(combos);
        Assert.All(combos, c => Assert.False(
            HanjaData.IsWeakGivenNameHanja(c.First) || HanjaData.IsWeakGivenNameHanja(c.Second),
            $"{name}: 약자 조합 {c.First}{c.Second} — 약자 없는 조합이 있으면 빈칸 채우기로 쓰지 않는다"));
    }

    [Fact]
    public void SelectCombos_KeepsWeakPairs_WhenSyllableHasNoAlternative()
    {
        // '녀'는 후보가 女(weak)뿐 — 약자 쌍만 남아도 combos를 비우지 않는다(weak는 배제가 아니라 양보).
        var combos = HanjaSelector.SelectCombos("가녀", "none", 4);
        Assert.NotEmpty(combos);
        Assert.All(combos, c => Assert.Equal("女", c.Second));
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
