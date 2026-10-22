using System.Collections;
using System.Reflection;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;

namespace NameForm.Tests;

/// <summary>
/// 성씨 대표 한자 표(SurnameData.RepresentativeHanja)와 수리사격 성씨 획수 — 2026-10-22 S5a (감사 BT-3).
/// 예전에는 성씨 첫 글자 독음의 관련도 1순위 한자 획수를 써서 이 → 11획·박 → 16획·윤 → 15획, 남궁 → '남' 한 글자만 셌다.
/// 기대 획수는 Adobe·Unihan kTotalStrokes(옛 파일·18.0)가 모두 같은 글자만 고른다 — 획수 출처를 바꿔도(S5c) 흔들리지 않게.
/// </summary>
public class SurnameStrokeTests
{
    public SurnameStrokeTests()
    {
        HanjaData.LoadExternalData();
    }

    [Theory]
    [InlineData("김", "金", 8)]
    [InlineData("이", "李", 7)]
    [InlineData("리", "李", 7)]     // 두음 표기
    [InlineData("박", "朴", 6)]
    [InlineData("최", "崔", 11)]
    [InlineData("조", "趙", 14)]
    [InlineData("윤", "尹", 4)]
    [InlineData("장", "張", 11)]
    [InlineData("임", "林", 8)]
    [InlineData("림", "林", 8)]
    [InlineData("유", "柳", 9)]     // 같은 독음 성씨 중 인구가 가장 많은 한자(창작 표는 劉)
    [InlineData("류", "柳", 9)]
    [InlineData("서", "徐", 10)]
    [InlineData("남궁", "南宮", 19)] // 복성은 두 글자 합 — 南 9 + 宮 10
    [InlineData("강전", "岡田", 13)] // 일본계 희성 — 岡 8 + 田 5 (표에 넣기 전: 음절별 추정 19)
    [InlineData("망절", "網切", 18)] // 網 14 + 切 4 (표에 넣기 전: 추정 23)
    public void ResolveStrokes_TableSurname_UsesRepresentativeHanja(string surname, string hanja, int strokes)
    {
        var r = SurnameData.ResolveStrokes(surname);

        Assert.True(r.FromTable);
        Assert.Equal(hanja, r.Hanja);
        Assert.Equal(strokes, r.Strokes);
    }

    [Fact]
    public void ResolveStrokes_UnknownSurname_SumsPerSyllableEstimate()
    {
        // 표에 없는 두 음절 입력(소봉 — 창작 표에는 있지만 이 파일의 복성 목록·대표 한자 표에는 없다): 음절마다 독음 관련도
        // 1순위 한자(획수 있는 글자)의 획수 합 — 옛 방식은 첫 음절만 셌다
        var r = SurnameData.ResolveStrokes("소봉");

        Assert.False(r.FromTable);
        Assert.Equal(2, r.Hanja.Length);
        int expected = r.Hanja.Sum(ch => HanjaData.FindByCharacter(ch.ToString())!.StrokeCount);
        Assert.Equal(expected, r.Strokes);
        Assert.True(r.Strokes > 0);
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData(null)]
    public void ResolveStrokes_Empty_IsUnknown(string? surname)
    {
        Assert.Equal(0, SurnameData.ResolveStrokes(surname).Strokes);
    }

    [Fact]
    public void RepresentativeHanja_EveryCharIsInDictionaryWithMatchingReadingAndStrokes()
    {
        var problems = new List<string>();
        foreach (var (surname, hanja) in SurnameData.RepresentativeHanja)
        {
            if (hanja.Length != surname.Length) { problems.Add($"{surname}: 글자 수 {hanja}"); continue; }
            for (int i = 0; i < hanja.Length; i++)
            {
                var h = HanjaData.FindByCharacter(hanja[i].ToString());
                var syllable = surname[i].ToString();
                if (h == null) { problems.Add($"{surname}: {hanja[i]} 사전에 없음"); continue; }
                if (h.StrokeCount <= 0) problems.Add($"{surname}: {hanja[i]} 획수 없음");
                // 두음 표기는 같은 성씨다(임 = 林 '림', 유 = 柳 '류') — 하드코딩 林 은 독음이 '림' 하나뿐이다
                if (!h.AlternateReadings.Prepend(h.Reading).Any(r => r.Length == 1 && Dueum(r) == Dueum(syllable)))
                    problems.Add($"{surname}: {hanja[i]} 독음 {h.Reading}/{string.Join(",", h.AlternateReadings)}");
            }
        }
        Assert.True(problems.Count == 0, string.Join(" | ", problems));
    }

    /// <summary>두음 법칙 정규화 — 첫소리 ㄹ → ㄴ, ㄴ + ㅣ·ㅑ·ㅕ·ㅖ·ㅛ·ㅠ → ㅇ (림·님 → 임, 류 → 유, 라 → 나)</summary>
    private static string Dueum(string syllable)
    {
        int code = syllable[0] - 0xAC00;
        if (code < 0 || code > 11171) return syllable;
        int cho = code / 588, jung = code % 588 / 28, jong = code % 28;
        if (cho == 5) cho = 2;
        if (cho == 2 && jung is 20 or 2 or 6 or 7 or 12 or 17) cho = 11;
        return ((char)(0xAC00 + cho * 588 + jung * 28 + jong)).ToString();
    }

    [Fact]
    public void RepresentativeHanja_HasNoCompatibilityIdeographs()
    {
        // 호환 한자 코드포인트(U+F900~FAFF·U+2F800~2FA1F)는 사전에서 통합 한자로 병합돼 조회되지 않는다
        var compat = SurnameData.RepresentativeHanja.Values
            .SelectMany(v => v)
            .Where(ch => (ch >= '\uF900' && ch <= '\uFAFF') || char.IsSurrogate(ch))
            .ToList();
        Assert.Empty(compat);
    }

    [Fact]
    public void RepresentativeHanja_MatchesCreativeTableExceptDocumented()
    {
        // 출발점은 CreativeNamingEngine.SurnameMeanings(성씨 뜻 풀이용)의 한자다. 다른 곳은 이 넷뿐이어야 한다 —
        // 창작 표를 고칠 때 수리 표도 같이 볼지 정하라는 신호(한쪽만 바뀌면 이 테스트가 깨진다).
        var documented = new Dictionary<string, (string creative, string representative)>
        {
            ["유"] = ("\u5289", "\u67F3"), // 劉 → 柳: 같은 독음 유·류 성씨 중 柳가 가장 많다(창작 표는 '흐르다' 연상용)
            ["모"] = ("\u6BDB", "\u725F"), // 毛 → 牟: 함평 모씨
            ["배"] = ("\u88F4", "\u88F5"), // 裴 → 裵: 한국 배씨 표기
            ["상"] = ("\u5C1A", "\u5C19"), // 尚 → 尙: 尚 은 사전(인명용 목록)에 없다
        };
        var field = typeof(CreativeNamingEngine).GetField("SurnameMeanings", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(field);
        var creative = new Dictionary<string, string>();
        foreach (DictionaryEntry e in (IDictionary)field!.GetValue(null)!)
            creative[(string)e.Key] = (string)e.Value!.GetType().GetProperty("Hanja")!.GetValue(e.Value)!;

        var mismatches = creative
            .Where(kv => SurnameData.RepresentativeHanja.TryGetValue(kv.Key, out var rep) && rep != kv.Value)
            .Select(kv => kv.Key)
            .OrderBy(k => k, StringComparer.Ordinal)
            .ToList();
        Assert.Equal(documented.Keys.OrderBy(k => k, StringComparer.Ordinal), mismatches);
        foreach (var (surname, (c, r)) in documented)
        {
            Assert.Equal(c, creative[surname]);
            Assert.Equal(r, SurnameData.RepresentativeHanja[surname]);
        }

        // 창작 표에만 있는 성씨는 소봉뿐 — SurnameData 복성 목록(TwoCharSurnames)에 없다. 목록에 더하면 대표 한자도 함께 넣는다
        Assert.Equal(new[] { "소봉" }, creative.Keys.Where(k => !SurnameData.RepresentativeHanja.ContainsKey(k)).ToArray());
    }

    [Fact]
    public void RepresentativeHanja_CoversAllTwoCharSurnames()
    {
        // SurnameData 의 복성 10개가 모두 표에 있다 — 강전 岡田·망절 網切(일본계 희성)은 한자가 하나뿐이라 넣었다
        // (넣기 전에는 음절별 추정 19획·23획, 실제 13획·18획). 복성을 목록에 더하면 이 배열과 표를 함께 고친다
        var twoChar = new[] { "남궁", "독고", "동방", "사공", "서문", "선우", "제갈", "황보", "강전", "망절" };
        Assert.All(twoChar, s => Assert.True(SurnameData.IsTwoCharSurname(s), s));
        Assert.DoesNotContain(twoChar, s => !SurnameData.RepresentativeHanja.ContainsKey(s));
    }
}
