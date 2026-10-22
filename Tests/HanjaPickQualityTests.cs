using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 배정·조합 한자 품질 (2026-10-22 자원오행 전환 S4 인계 항목) — 雌 불용, 랑 줄 朗 인명 빈출.
/// 오행 기준과 무관하게 성립해야 한다(풀 게이트·불용 배제).
/// ⚠️ 호환 한자는 문자 리터럴로 쓰지 않는다 — 정수 코드포인트로만 적는다.
/// </summary>
public class HanjaPickQualityTests
{
    private static string Cp(int codepoint) => char.ConvertFromUtf32(codepoint);

    [Fact]
    public void YeongJa_Female_DoesNotAssignFemaleAnimalHanja()
    {
        // 雌(암컷 자): S3 weak 는 양보라 /evaluate 박영자(여)=映雌 배정이 남았다 → S4 불용
        var ja = Cp(0x96CC);
        Assert.True(HanjaData.IsForbiddenNameHanja(ja));
        Assert.False(HanjaData.IsWeakGivenNameHanja(ja)); // 불용·약자 세트는 겹치지 않는다

        foreach (var y in new string?[] { null, "木", "火", "土", "金", "水" })
            Assert.NotEqual(ja, HanjaSelector.Select("영자", "female", y, null, null)[1]?.Character);
    }

    [Theory]
    [InlineData("하랑", "none")]
    [InlineData("다랑", "none")]
    [InlineData("하랑", "male")]
    public void Rang_Names_UseBright_NotCorridor(string name, string gender)
    {
        // 랑 줄에 빈출 글자가 없어 Core 글자 廊(사랑채 랑)·浪(물결 랑)이 1순위를 나눠 가졌다 — 朗(밝을 랑)을 인명 빈출에 넣었다(S4)
        var bright = Cp(0x6717);
        var corridor = Cp(0x5ECA);
        Assert.True(HanjaData.IsCommonNameHanja(bright));

        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        Assert.NotEmpty(combos);
        Assert.Equal(bright, combos[0].Second);
        Assert.DoesNotContain(combos, c => c.Second == corridor);
        Assert.Equal(bright, HanjaSelector.Select(name, gender, null, null, null)[1]?.Character);
    }
}
