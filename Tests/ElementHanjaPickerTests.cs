using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using Xunit.Abstractions;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Tests;

/// <summary>
/// 오행별 이름 한자 예(ElementHanjaPicker) — 2026-11 설계 docs/plan-ohaeng-2026-11.md §4·§5 의 7~11.
/// 기대값은 HanjaData 원값으로 테스트 안에서 다시 걸러 센다(검사 대상 IsCandidate 를 쓰지 않는다).
/// </summary>
public class ElementHanjaPickerTests
{
    private static readonly string[] Elements = { "木", "火", "土", "金", "水" };
    private readonly ITestOutputHelper _output;

    public ElementHanjaPickerTests(ITestOutputHelper output) => _output = output;

    /// <summary>후보 조건을 원값으로 따로 — 빈출·자원오행·등급 R/X·불용 아님·뜻 있음·약자 아님·기본 영역(U+4E00~9FFF)·그 독음의 훈</summary>
    private static bool IndependentCandidate(HanjaInfo h, string element)
    {
        if (!HanjaData.IsCommonNameHanja(h.Character)) return false;
        if (h.FiveElement != element) return false;
        if (h.ResourceGrade != "R" && h.ResourceGrade != "X") return false;
        if (HanjaData.IsForbiddenNameHanja(h.Character)) return false;
        if (string.IsNullOrEmpty(h.Meaning)) return false;
        if (HanjaData.IsWeakGivenNameHanja(h.Character)) return false;
        if (h.Character.Length != 1) return false; // 기본 영역은 BMP 한 글자
        int cp = h.Character[0];
        if (cp < 0x4E00 || cp > 0x9FFF) return false;
        return !string.IsNullOrWhiteSpace(HanjaData.GlossForReading(h.Meaning, h.Reading));
    }

    // ── 7. 오행마다 12자 · 조건을 따로 만족 ────────────────────────

    [Fact]
    public void EachElement_TwelveChars_EachSatisfiesEveryCondition()
    {
        foreach (var el in Elements)
        {
            var expectedPool = HanjaData.GetAllHanja().Where(h => IndependentCandidate(h, el)).Select(h => h.Character).ToHashSet();
            var predicatePool = HanjaData.GetAllHanja().Where(h => ElementHanjaPicker.IsCandidate(h, el)).Select(h => h.Character).ToHashSet();
            Assert.True(expectedPool.SetEquals(predicatePool),
                $"{el}: 술어와 따로 센 후보가 다름 — 술어만 [{string.Join("", predicatePool.Except(expectedPool))}] · 따로만 [{string.Join("", expectedPool.Except(predicatePool))}]");
            Assert.True(expectedPool.Count >= ElementHanjaPicker.MaxPerElement, $"{el}: 후보 {expectedPool.Count}자뿐");

            var picked = ElementHanjaPicker.For(el);
            Assert.Equal(ElementHanjaPicker.MaxPerElement, picked.Count);
            Assert.Equal(picked.Count, picked.Select(h => h.Character).Distinct().Count());
            foreach (var h in picked)
            {
                Assert.True(HanjaData.IsCommonNameHanja(h.Character), $"{h.Character} 빈출 아님");
                Assert.Equal(el, h.FiveElement);
                Assert.Contains(h.ResourceGrade, new[] { "R", "X" });
                Assert.False(HanjaData.IsForbiddenNameHanja(h.Character), $"{h.Character} 불용");
                Assert.False(string.IsNullOrEmpty(h.Meaning), $"{h.Character} 뜻 없음");
                Assert.False(HanjaData.IsWeakGivenNameHanja(h.Character), $"{h.Character} 약자");
                Assert.InRange((int)h.Character[0], 0x4E00, 0x9FFF);
            }
            _output.WriteLine($"{el} 후보 {expectedPool.Count}자 → " + string.Join(" ", picked.Select(h =>
                $"{h.Character}({string.Join("·", ElementHanjaPicker.ReadingsOf(h))} {h.ResourceGrade})")));
        }
    }

    [Fact]
    public void VGradeChars_AreNeverPicked()
    {
        // 이견 있음(V) 글자는 빈출이라도 빠진다(元·建·福·書·民 등 — 설계 §4-2)
        foreach (var el in Elements)
            Assert.DoesNotContain(ElementHanjaPicker.For(el), h => h.ResourceGrade == "V" || h.ResourceGrade == "U");
        var vCommon = HanjaData.GetAllHanja().Where(h => h.ResourceGrade == "V" && HanjaData.IsCommonNameHanja(h.Character)).ToList();
        Assert.NotEmpty(vCommon);
        foreach (var el in Elements)
            Assert.DoesNotContain(vCommon, h => ElementHanjaPicker.IsCandidate(h, el));
    }

    // ── 8. 결정성 ─────────────────────────────────────────────────

    [Fact]
    public void Build_IsDeterministic_AndCacheEqualsBuild()
    {
        foreach (var el in Elements)
        {
            var a = ElementHanjaPicker.Build(el).Select(h => h.Character).ToList();
            var b = ElementHanjaPicker.Build(el).Select(h => h.Character).ToList();
            Assert.Equal(a, b);
            Assert.Equal(a, ElementHanjaPicker.For(el).Select(h => h.Character).ToList());
            Assert.Same(ElementHanjaPicker.For(el), ElementHanjaPicker.For(el)); // 캐시
        }
        Assert.Empty(ElementHanjaPicker.For("X"));
    }

    [Fact]
    public void Build_FollowsDisplayOrder_WithinDistinctReadings()
    {
        // 첫 회차는 표시 정렬(OrderForDisplay) 순서에서 독음 첫 등장 글자들 — 기대값은 정렬 결과를 손으로 훑어 만든다
        foreach (var el in Elements)
        {
            var ordered = HanjaSelector.OrderForDisplay(HanjaData.GetAllHanja().Where(h => IndependentCandidate(h, el))).ToList();
            var firstOfReading = new List<string>();
            var readings = new List<string>();
            foreach (var h in ordered)
            {
                if (readings.Contains(h.Reading)) continue;
                readings.Add(h.Reading);
                firstOfReading.Add(h.Character);
            }
            var picked = ElementHanjaPicker.For(el).Select(h => h.Character).ToList();
            var n = Math.Min(firstOfReading.Count, ElementHanjaPicker.MaxPerElement);
            Assert.Equal(firstOfReading.Take(n), picked.Take(n));
        }
    }

    // ── 9. 독음 다양성 ─────────────────────────────────────────────

    [Fact]
    public void Picked_HaveDistinctReadings_WhenEnoughReadingsExist()
    {
        foreach (var el in Elements)
        {
            var distinctReadings = HanjaData.GetAllHanja().Where(h => IndependentCandidate(h, el)).Select(h => h.Reading).Distinct().Count();
            var picked = ElementHanjaPicker.For(el);
            if (distinctReadings >= ElementHanjaPicker.MaxPerElement)
                Assert.Equal(picked.Count, picked.Select(h => h.Reading).Distinct().Count());
        }
    }

    // ── 10. 훈 ───────────────────────────────────────────────────

    [Fact]
    public void Gloss_EndsWithReading()
    {
        // '밝을 명' — 끝이 ' 독음', '오얏 리(이)' — 끝이 ' 독음(두음)' 또는 '(독음)'
        foreach (var el in Elements)
        foreach (var h in ElementHanjaPicker.For(el))
        {
            var gloss = HanjaData.GlossForReading(h.Meaning, h.Reading);
            var r = Regex.Escape(h.Reading);
            Assert.True(Regex.IsMatch(gloss, $@"\s{r}$") || Regex.IsMatch(gloss, $@"\s{r}\([^)]+\)$") || gloss.EndsWith($"({h.Reading})"),
                $"{h.Character} 독음 {h.Reading} · 훈 '{gloss}'");
        }
    }

    [Fact]
    public void ReadingsOf_MultiReadingChar_HasBoth()
    {
        var li = HanjaData.GetAllHanja().First(h => h.Character == "李");
        var readings = ElementHanjaPicker.ReadingsOf(li);
        Assert.Equal(li.Reading, readings[0]);
        Assert.Contains("리", readings);
        Assert.Contains("이", readings);
        Assert.Equal(readings.Count, readings.Distinct().Count());
        Assert.All(readings, s => Assert.True(s.Length == 1 && s[0] >= '가' && s[0] <= '힣'));
    }

    // ── 11. 링크 존재 — /hanja/{독음} 이 생성되는지 ─────────────────

    [Fact]
    public void Readings_AreGeneratedHanjaPages_InHanjaSeoJson()
    {
        // /hanja/[slug] 는 dynamicParams=false — 없는 독음으로 걸면 404. hanja-seo.json 의 그 글자 r 목록에 readings 가 모두 있어야 한다.
        // 덤으로 그 글자의 e(자원오행)·g(등급)가 백엔드와 같은지(같은 결과 파일에서 복사된 값)도 본다.
        var path = Path.Combine(RepoRoot(), "frontend", "src", "data", "hanja-seo.json");
        using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        var root = doc.RootElement;
        var problems = new List<string>();
        foreach (var el in Elements)
        foreach (var h in ElementHanjaPicker.For(el))
        {
            if (!root.TryGetProperty(h.Character, out var rec)) { problems.Add($"{h.Character} hanja-seo 에 없음"); continue; }
            var r = rec.GetProperty("r").EnumerateArray().Select(x => x.GetString()).ToHashSet();
            foreach (var reading in ElementHanjaPicker.ReadingsOf(h))
                if (!r.Contains(reading)) problems.Add($"{h.Character} 독음 {reading} ∉ r [{string.Join(",", r)}]");
            if (rec.TryGetProperty("e", out var e) && e.GetString() != el) problems.Add($"{h.Character} e {e.GetString()} ≠ {el}");
            if (rec.TryGetProperty("g", out var g) && g.GetString() != h.ResourceGrade) problems.Add($"{h.Character} g {g.GetString()} ≠ {h.ResourceGrade}");
        }
        Assert.True(problems.Count == 0, string.Join("\n", problems));
    }

    private static string RepoRoot([CallerFilePath] string thisFile = "")
    {
        foreach (var start in new[] { Path.GetDirectoryName(thisFile), AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            for (var dir = string.IsNullOrEmpty(start) ? null : new DirectoryInfo(start); dir != null; dir = dir.Parent)
                if (File.Exists(Path.Combine(dir.FullName, "NameForm.csproj"))) return dir.FullName;
        }
        throw new InvalidOperationException("저장소 루트(NameForm.csproj)를 찾지 못함");
    }
}
