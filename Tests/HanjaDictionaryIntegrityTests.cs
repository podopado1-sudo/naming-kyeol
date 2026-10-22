using System.Linq;
using System.Text.Json;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 한자 사전 원본 수리(ND-4)·호환 한자 병합·수록 범위 회귀 테스트 (2026-10-22, S2).
/// ⚠️ 호환 한자는 문자 리터럴로 쓰지 않는다 — 편집 도구의 NFC 정규화로 통합 한자로 바뀐 회귀 전력이 있어
/// 모든 글자를 정수 코드포인트로 적는다.
/// </summary>
public class HanjaDictionaryIntegrityTests
{
    private static string Cp(int codepoint) => char.ConvertFromUtf32(codepoint);

    [Theory]
    [InlineData("김", 0x91D1, "김")] // 金 — 원본 readings ["금,김"]·뜻 없음, 뜻은 호환 U+F90A 에만 있었다
    [InlineData("금", 0x91D1, "금")]
    [InlineData("란", 0x862D, "란")] // 蘭 — 호환 U+F91F
    [InlineData("난", 0x862D, "란")]
    [InlineData("랑", 0x6717, "랑")] // 朗 — 호환 U+F929
    [InlineData("랑", 0x5ECA, "랑")] // 廊 — 호환 U+F928
    public void FindByReading_RepairedUnifiedHanja_HasMeaning(string reading, int codepoint, string glossReading)
    {
        var unified = Cp(codepoint);
        var hit = HanjaData.FindByReading(reading).FirstOrDefault(h => h.Character == unified);

        Assert.NotNull(hit);
        Assert.False(string.IsNullOrEmpty(hit!.Meaning), $"U+{codepoint:X4} 뜻이 비어 있음");
        Assert.Contains(glossReading, hit.Meaning);
        Assert.True(hit.StrokeCount > 0);
    }

    [Fact]
    public void FindByReading_Gim_SurnameResolvesToUnifiedGold()
    {
        // HarmonyEngine.GetSurnameStrokeCount 는 성씨 독음의 첫 후보 획수를 쓴다 — 김 → 金(8획)
        var list = HanjaData.FindByReading("김");

        Assert.NotEmpty(list);
        Assert.Equal(Cp(0x91D1), list[0].Character);
        Assert.Equal(8, list[0].StrokeCount);
        Assert.DoesNotContain(list, h => h.Character == Cp(0xF90A)); // 같은 모양 호환 글자가 따로 나오지 않는다
    }

    [Fact]
    public void FindByReading_NoTwoEntriesShareUnifiedForm()
    {
        // 호환 한자(85자)가 통합 한자 항목에 병합돼 독음 조회에 같은 모양 글자가 둘 나오지 않는다
        var dupReadings = HanjaData.GetAllHanja()
            .SelectMany(h => h.AlternateReadings.Prepend(h.Reading).Distinct().Select(r => (r, h.Character)))
            .GroupBy(x => x.r)
            .Where(g => g.Select(x => HanjaData.ToUnifiedHanja(x.Character)).Distinct().Count() != g.Count())
            .Select(g => g.Key)
            .ToList();

        Assert.True(dupReadings.Count == 0, $"중복 글자 독음: {string.Join(" ", dupReadings.Take(10))}");
    }

    [Fact]
    public void GetAllHanja_ContainsNoCompatibilityIdeographs()
    {
        var compat = HanjaData.GetAllHanja()
            .Where(h => HanjaData.ToUnifiedHanja(h.Character) != h.Character)
            .Select(h => $"U+{char.ConvertToUtf32(h.Character, 0):X4}")
            .ToList();

        Assert.True(compat.Count == 0, $"호환 한자 키 {compat.Count}건 잔존: {string.Join(" ", compat.Take(10))}");
    }

    [Theory]
    [InlineData(0xF90A, 0x91D1)]   // 金
    [InlineData(0xF91F, 0x862D)]   // 蘭
    [InlineData(0xF929, 0x6717)]   // 朗
    [InlineData(0x2F996, 0x82E6)]  // 苦 (호환 보충 블록)
    public void FindByCharacter_CompatCodepoint_ResolvesToUnifiedEntry(int compat, int unified)
    {
        // 한국어 IME 는 김→金 을 호환 코드(U+F90A)로 낸다 — 병합 뒤에도 찾아져야 한다(RequiredChar 항렬자 입력 등)
        var hit = HanjaData.FindByCharacter(Cp(compat));

        Assert.NotNull(hit);
        Assert.Equal(Cp(unified), hit!.Character);
    }

    [Fact]
    public void CompatFallback_LoneSurrogateInput_DoesNotThrow()
    {
        // 항렬자 입력 등 사용자 문자열 — 홀로 남은 서로게이트는 Normalize 가 예외를 던지므로 폴백 전에 걸러야 한다
        var lone = "\uD840";
        Assert.Null(HanjaData.FindByCharacter(lone));
        Assert.False(HanjaData.IsWeakGivenNameHanja(lone));
        Assert.Equal(lone, HanjaData.ToUnifiedHanja(lone));
    }

    [Theory]
    [InlineData(0xFA0E)] // 호환 블록 안의 '통합 한자' 12자 중 하나 — 정규형이 자기 자신
    [InlineData(0x91D1)] // 金
    public void ToUnifiedHanja_NonCompat_ReturnsInput(int codepoint)
    {
        var s = Cp(codepoint);
        Assert.Equal(s, HanjaData.ToUnifiedHanja(s));
    }

    [Theory]
    [InlineData("아란", "female", 0x862D)] // 蘭 — 수리 전엔 란 이름 11명 전원 瀾(물결)
    [InlineData("예란", "female", 0x862D)]
    public void SelectCombos_RanNames_UseOrchid(string name, string gender, int codepoint)
    {
        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        Assert.Contains(combos, c => c.Second == Cp(codepoint));
    }

    [Fact]
    public void LoadedSet_EqualsDictionaryFileSet()
    {
        // 수록 범위 = hanja_dictionary_final.json 의 유니코드 등재 한자(호환 한자는 통합 한자로) — /hanja 와 같은 집합.
        // Unihan 로더가 독음 없는 5,482자를, Core 로더가 core_v1 에만 있는 6자를 따로 넣던 것을 막는다.
        var path = Path.Combine(AppContext.BaseDirectory, "data", "hanja_dictionary_final.json");
        Assert.True(File.Exists(path), $"사전 파일 없음: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var expected = doc.RootElement.EnumerateObject()
            .Select(p => p.Name)
            .Where(HanjaData.IsHanCodePoint)
            .Select(HanjaData.ToUnifiedHanja)
            .ToHashSet(StringComparer.Ordinal);
        var loaded = HanjaData.GetAllHanja().Select(h => h.Character).ToHashSet(StringComparer.Ordinal);

        var extra = loaded.Except(expected).Take(10).ToList();
        var missing = expected.Except(loaded).Take(10).ToList();
        Assert.True(extra.Count == 0 && missing.Count == 0,
            $"사전 밖 글자: {string.Join(" ", extra)} / 빠진 글자: {string.Join(" ", missing)}");
        Assert.All(HanjaData.GetAllHanja(), h => Assert.False(string.IsNullOrEmpty(h.Reading), h.Character));
    }

    [Theory]
    [InlineData(0x6669, 0x665A)] // 晩 → 표준형 晚
    [InlineData(0x67E5, 0x67FB)] // 查 → 査
    [InlineData(0x968F, 0x96A8)] // 随 → 隨
    [InlineData(0x7682, 0x7681)] // 皂 → 皁
    public void CoreOnlyVariants_NotLoaded_StandardFormIs(int coreOnly, int standard)
    {
        // core_v1 에만 있고 대법원 인명용 한자표에 없는 글자는 싣지 않는다 — 표준형이 인명용 목록에 있다
        Assert.Null(HanjaData.FindByCharacter(Cp(coreOnly)));
        var std = HanjaData.FindByCharacter(Cp(standard));
        Assert.NotNull(std);
        Assert.True(std!.IsGovernmentListed);
    }
}
