using System.Text.Json;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 부수 기준 자원오행 전환 S4 (2026-10-22, docs/plan-radical-ohaeng-2026-10.md §2-6·§3-5) 회귀 테스트.
/// FiveElement = data/hanja_resource_element.json 의 e 하나(호환 한자 병합 뒤 통합 키에만), 뜻 기반 값은 MeaningElement 에 보존.
/// ⚠️ 호환 한자는 문자 리터럴로 쓰지 않는다(편집 도구의 NFC 정규화 회귀 전력) — 정수 코드포인트로만 적는다.
/// </summary>
public class ResourceElementTests
{
    private static string Cp(int codepoint) => char.ConvertFromUtf32(codepoint);

    private static Dictionary<string, JsonElement> ReadResultFileChars()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "data", HanjaData.ResourceElementFileName);
        Assert.True(File.Exists(path), $"결과 파일 없음: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.GetProperty("chars").EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.Clone(), StringComparer.Ordinal);
    }

    private static string? Str(JsonElement e, string name)
        => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    // ── 골든 30자 (S1 결과 파일 기준 — 부수표·간지·문헌·실무 예외) ─────────────────────────────

    [Theory]
    [InlineData(0x632F, "木", "R")] // 振 — 手·扌(손 수) 부수. 독자 질문 글자(옛 뜻 기반 火)
    [InlineData(0x6D25, "水", "R")] // 津 — 水·氵
    [InlineData(0x771E, "木", "R")] // 眞 — 目 (옛 火)
    [InlineData(0x771F, "木", "R")] // 真 — 眞의 이체자, 같은 目 부수 (옛 획수 대체 水)
    [InlineData(0x6069, "火", "R")] // 恩 — 心·忄 (옛 土)
    [InlineData(0x9280, "金", "R")] // 銀 — 金
    [InlineData(0x4F51, "火", "R")] // 佑 — 人·亻 (옛 土)
    [InlineData(0x5B87, "木", "R")] // 宇 — 宀 (옛 土)
    [InlineData(0x6709, "水", "R")] // 有 — 月(달 월) (옛 土)
    [InlineData(0x627F, "木", "R")] // 承 — 手 (옛 金)
    [InlineData(0x9053, "土", "R")] // 道 — 辵·辶 (옛 火)
    [InlineData(0x54F2, "水", "R")] // 哲 — 口 (옛 火)
    [InlineData(0x5357, "火", "X")] // 南 — 실무 예외(부수 十 은 水)
    [InlineData(0x5141, "土", "X")] // 允 — 실무 예외(부수 儿)
    [InlineData(0x58FD, "水", "X")] // 壽 — 실무 예외(부수 士)
    [InlineData(0x9249, "金", "R")] // 鉉 — 金
    [InlineData(0x6CEB, "水", "R")] // 泫 — 水
    [InlineData(0x7532, "木", "X")] // 甲 — 천간(부수 田 은 土)
    [InlineData(0x7533, "金", "X")] // 申 — 지지
    [InlineData(0x672A, "土", "X")] // 未 — 지지(부수 木 과 다름)
    [InlineData(0x4EA5, "水", "X")] // 亥 — 지지
    [InlineData(0x5149, "火", "X")] // 光 — 문헌 예외(부수 儿)
    [InlineData(0x7950, "木", "V")] // 祐 — 示·礻 이견 부수(火·金)
    [InlineData(0x78A9, "金", "V")] // 碩 — 石 이견 부수(土)
    [InlineData(0x5EB7, "木", "V")] // 康 — 广, 김만태 본문은 金
    [InlineData(0x7384, "火", "X")] // 玄 — 실무 예외(부수 玄 은 水)
    [InlineData(0x6625, "火", "R")] // 春 — 日 (옛 하드코딩·core 木)
    [InlineData(0x6717, "水", "R")] // 朗 — 月(달 월)
    [InlineData(0x5ECA, "木", "R")] // 廊 — 广
    [InlineData(0x6D6A, "水", "R")] // 浪 — 水·氵
    public void Golden_FiveElementAndGrade(int codepoint, string element, string grade)
    {
        var h = HanjaData.FindByCharacter(Cp(codepoint));

        Assert.NotNull(h);
        Assert.Equal(element, h!.FiveElement);
        Assert.Equal(grade, h.ResourceGrade);
        Assert.InRange(h.RadicalNumber, 1, 214);
        Assert.False(string.IsNullOrEmpty(h.RadicalChar));
        Assert.False(string.IsNullOrEmpty(h.Rationale)); // 결과 파일 note — 부수 근거 한 줄
    }

    [Theory]
    [InlineData(0xF90A, 0x91D1, "金")] // 金(호환, 김) → 통합 金
    [InlineData(0xF929, 0x6717, "水")] // 朗(호환) → 통합 朗 — radical_map 판정이 호환 코드에만 있던 글자
    [InlineData(0xF91F, 0x862D, "木")] // 蘭(호환) → 통합 蘭 (艸 부수)
    public void CompatCodepoint_LooksUpUnifiedResourceElement(int compat, int unified, string element)
    {
        var h = HanjaData.FindByCharacter(Cp(compat));

        Assert.NotNull(h);
        Assert.Equal(Cp(unified), h!.Character);
        Assert.Equal(element, h.FiveElement);
    }

    // ── 백엔드 ↔ 결과 파일 불일치 0 (계획 §2-6 보증 장치 — 전환 전 백엔드 ↔ hanja-seo 1,718자 어긋남) ─────

    [Fact]
    public void Backend_EqualsResultFile_ForAllUnifiedKeys()
    {
        var file = ReadResultFileChars();
        var unifiedKeys = file.Where(kv => Str(kv.Value, "compat_of") == null).Select(kv => kv.Key).ToHashSet(StringComparer.Ordinal);
        var all = HanjaData.GetAllHanja();

        var notInFile = all.Where(h => !unifiedKeys.Contains(h.Character)).Select(h => h.Character).Take(10).ToList();
        var notLoaded = unifiedKeys.Except(all.Select(h => h.Character)).Take(10).ToList();
        Assert.True(notInFile.Count == 0 && notLoaded.Count == 0,
            $"결과 파일에 없는 글자: {string.Join(" ", notInFile)} / 백엔드에 없는 글자: {string.Join(" ", notLoaded)}");

        var mismatches = new List<string>();
        foreach (var h in all)
        {
            var r = file[h.Character];
            var e = Str(r, "e") ?? "";
            var g = Str(r, "g") ?? "";
            var radical = r.TryGetProperty("radical", out var rv) && rv.ValueKind == JsonValueKind.Number ? rv.GetInt32() : 0;
            var note = Str(r, "note") ?? "";
            if (h.FiveElement != e || h.ResourceGrade != g || h.RadicalNumber != radical || h.Rationale != note)
                mismatches.Add($"{h.Character}: {h.FiveElement}/{h.ResourceGrade}/{h.RadicalNumber} ≠ {e}/{g}/{radical}");
        }
        Assert.True(mismatches.Count == 0, $"불일치 {mismatches.Count}자: {string.Join(" · ", mismatches.Take(10))}");
    }

    [Fact]
    public void ResultFile_CompatKeys_PointToUnifiedWithSameValue()
    {
        // 결과 파일의 호환 한자 키(85)는 통합 한자와 같은 값 + compat_of — 소비처는 통합 키만 적용한다(consumer_rule)
        var file = ReadResultFileChars();
        var compat = file.Where(kv => Str(kv.Value, "compat_of") != null).ToList();

        Assert.NotEmpty(compat);
        foreach (var (key, r) in compat)
        {
            var unified = Str(r, "compat_of")!;
            Assert.Equal(HanjaData.ToUnifiedHanja(key), unified);
            Assert.NotEqual(key, unified);
            Assert.True(file.ContainsKey(unified), $"U+{char.ConvertToUtf32(key, 0):X4} 의 통합 한자가 결과 파일에 없음");
            Assert.Equal(Str(file[unified], "e"), Str(r, "e"));
            Assert.Equal(Str(file[unified], "g"), Str(r, "g"));
        }
    }

    [Fact]
    public void AllLoaded_HaveElement_NoUnknownGrade()
    {
        // 2026-10-22 결과 파일 기준 미상(U) 0자 — 생기면 엔진은 '오행 없음'(획수 대체값 없음)으로 처리한다
        var all = HanjaData.GetAllHanja();
        var valid = new HashSet<string> { "木", "火", "土", "金", "水" };

        Assert.All(all, h => Assert.Contains(h.ResourceGrade, new[] { "R", "V", "X" }));
        Assert.All(all, h => Assert.Contains(h.FiveElement, valid));
    }

    // ── 옛 등급 S 에 기대던 동작 → Core 데이터 여부 (같은 집합이라 점수 불변) ─────────────────────

    [Fact]
    public void IsCoreData_EqualsLegacyGradeS()
    {
        var all = HanjaData.GetAllHanja();
        var mismatch = all.Where(h => h.IsCoreData != (h.ConfidenceGrade == "S")).Select(h => h.Character).Take(10).ToList();

        Assert.True(mismatch.Count == 0, $"Core 여부 ≠ 옛 S: {string.Join(" ", mismatch)}");
        Assert.True(all.Count(h => h.IsCoreData) >= 2000);
        // 옛 B(하드코딩만, Core 아님)가 없어야 획수 조화 감산(옛 C·D → Core 아님)이 그대로다
        Assert.DoesNotContain(all, h => h.ConfidenceGrade == "B");
    }

    [Fact]
    public void RelevanceScore_CoreBonusUnchanged()
    {
        // 옛 'S +100' 은 Core 여부로 옮겼다 — Core 글자는 +2000 +100 을 그대로 받는다
        var core = HanjaData.FindByCharacter("珠")!;      // Core
        var nonCore = HanjaData.FindByCharacter("株")!;   // Core 아님
        Assert.True(core.IsCoreData);
        Assert.False(nonCore.IsCoreData);
        Assert.True(HanjaData.CalculateRelevanceScore(core) - HanjaData.CalculateRelevanceScore(nonCore) >= 2100 - 300);
    }

    // ── 뜻 기반 값 보존 (D4 — 화면·점수에 쓰지 않는다) ───────────────────────────────────

    [Theory]
    [InlineData(0x632F, "火")] // 振 — core_v1 뜻 기반 火 (부수 기준 木)
    [InlineData(0x6069, "土")] // 恩 — core_v1 土 (부수 기준 火)
    [InlineData(0x5B87, "土")] // 宇 — core_v1 土 (부수 기준 木)
    public void MeaningElement_PreservesCoreValue(int codepoint, string meaningElement)
    {
        var h = HanjaData.FindByCharacter(Cp(codepoint))!;

        Assert.Equal(meaningElement, h.MeaningElement);
        Assert.NotEqual(h.MeaningElement, h.FiveElement);
        Assert.False(string.IsNullOrWhiteSpace(h.MeaningRationale));
        Assert.Equal("S", h.ConfidenceGrade);
    }

    [Fact]
    public void MeaningElement_EmptyForLegacyStrokeFallback()
    {
        // 옛 D(획수 끝자리 대체값)는 뜻 기반이 아니라 MeaningElement 에 싣지 않는다
        var legacyD = HanjaData.GetAllHanja().Where(h => h.Source == "Auto_Fallback").ToList();

        Assert.NotEmpty(legacyD);
        Assert.All(legacyD, h => Assert.True(h.MeaningElement.Length == 0 && h.MeaningRationale.Length == 0, h.Character));
    }

    // ── 엔진 연결: 용신 배정·평가 DTO 가 부수 기준 값을 쓴다 ─────────────────────────────────

    [Fact]
    public async Task Evaluate_HanjaCandidates_CarryResourceGradeAndRadicalRationale()
    {
        var svc = new NameEvaluationService(
            new ScoringService(new AestheticEngine(), new HarmonyEngine(new SajuCalculationService(), new YongshinCalculationService()),
                new RarityScoringEngine()),
            new ExplanationEngine());

        var r = await svc.EvaluateNameAsync("진우", "김", new DateTime(2024, 3, 15), "male", "neutral");

        var cands = r.HanjaCandidates.SelectMany(g => g.Candidates).ToList();
        Assert.NotEmpty(cands);
        foreach (var c in cands)
        {
            var h = HanjaData.FindByCharacter(c.Character)!;
            Assert.Equal(h.FiveElement, c.FiveElement);
            Assert.Equal(h.ResourceGrade, c.ResourceGrade);
            Assert.Equal(h.Rationale, c.Rationale);
            Assert.Equal(h.ConfidenceGrade, c.ConfidenceGrade); // 옛 등급 필드는 화면 전환(S7)까지 이름·값 유지
        }
        Assert.DoesNotContain(r.Harmony.Notes, n => n.Contains("자원오행 점수") || n.Contains("자원오행 신뢰도"));
    }
}
