using System.Linq;
using NameForm.Application.Engines.Data;
using Xunit;
using Xunit.Abstractions;

namespace NameForm.Tests;

/// <summary>
/// NamePoolEngine 리팩토링 B-1 설계를 위한 진단 테스트.
/// Core Dataset 분포, 필터 후 잔존율, 실제 추천된 한자의 Tier 소속 등을 출력.
/// </summary>
public class CoreDatasetDiagnosticTests
{
    private readonly ITestOutputHelper _out;

    public CoreDatasetDiagnosticTests(ITestOutputHelper output)
    {
        _out = output;
    }

    [Fact]
    public void Q1_CoreDatasetCategoryDistribution()
    {
        var coreEntries = HanjaData.GetAllHanja()
            .Where(h => h.Source == "Core_v1")
            .ToList();

        _out.WriteLine($"=== Q1. Core Dataset Category 분포 ===");
        _out.WriteLine($"총 Core_v1 엔트리: {coreEntries.Count}자\n");

        var byCategory = coreEntries
            .GroupBy(h => string.IsNullOrEmpty(h.Category) ? "(빈 값)" : h.Category)
            .OrderByDescending(g => g.Count())
            .ToList();

        foreach (var g in byCategory)
        {
            _out.WriteLine($"  {g.Key,-10}: {g.Count(),5}자  ({g.Count() * 100.0 / coreEntries.Count:F1}%)");
        }

        _out.WriteLine("\n샘플 5자/카테고리:");
        foreach (var g in byCategory)
        {
            var samples = g.Take(5).Select(h => $"{h.Character}({h.Reading})");
            _out.WriteLine($"  {g.Key,-10}: {string.Join(", ", samples)}");
        }

        // CategoryMajor 분포도 함께 출력
        _out.WriteLine("\n=== CategoryMajor 분포 (새 스키마) ===");
        var byMajor = coreEntries
            .GroupBy(h => string.IsNullOrEmpty(h.CategoryMajor) ? "(빈 값)" : h.CategoryMajor)
            .OrderByDescending(g => g.Count())
            .ToList();
        foreach (var g in byMajor)
        {
            _out.WriteLine($"  {g.Key,-10}: {g.Count(),5}자");
        }
    }

    [Fact]
    public void Q2_FiveElementAndGenderFilterSurvival()
    {
        var coreEntries = HanjaData.GetAllHanja()
            .Where(h => h.Source == "Core_v1")
            .ToList();

        _out.WriteLine($"=== Q2. 필터 후 Core_v1 잔존율 ===");
        _out.WriteLine($"기준: Core_v1 {coreEntries.Count}자\n");

        // GenderPref 분포
        var byGender = coreEntries
            .GroupBy(h => h.GenderPref)
            .ToDictionary(g => g.Key, g => g.Count());
        _out.WriteLine("GenderPref 분포:");
        foreach (var kv in byGender.OrderByDescending(x => x.Value))
            _out.WriteLine($"  {kv.Key,-10}: {kv.Value,5}자");

        // TonePref 분포
        var byTone = coreEntries
            .GroupBy(h => h.TonePref)
            .ToDictionary(g => g.Key, g => g.Count());
        _out.WriteLine("\nTonePref 분포:");
        foreach (var kv in byTone.OrderByDescending(x => x.Value))
            _out.WriteLine($"  {kv.Key,-10}: {kv.Value,5}자");

        // male + neutral 필터 적용
        var afterMale = coreEntries
            .Where(h => h.GenderPref != HanjaData.GenderPreference.Female)
            .ToList();
        var afterMaleAndNeutral = afterMale
            .Where(h => h.TonePref == HanjaData.TonePreference.Neutral ||
                        h.TonePref == HanjaData.TonePreference.Soft ||
                        h.TonePref == HanjaData.TonePreference.Strong) // neutral tone = 모두 pass
            .ToList();

        _out.WriteLine($"\nmale 필터 후  (GenderPref != Female): {afterMale.Count}자");
        _out.WriteLine($"male+neutral tone 후: {afterMaleAndNeutral.Count}자");

        // female도
        var afterFemale = coreEntries
            .Where(h => h.GenderPref != HanjaData.GenderPreference.Male)
            .ToList();
        _out.WriteLine($"female 필터 후 (GenderPref != Male):  {afterFemale.Count}자");

        // 의미(Meaning) 보유율
        var withMeaning = coreEntries.Count(h => !string.IsNullOrEmpty(h.Meaning));
        _out.WriteLine($"\nMeaning 필드 있음: {withMeaning}자 ({withMeaning * 100.0 / coreEntries.Count:F1}%)");

        // 대법원 인명용 등재율
        var govListed = coreEntries.Count(h => h.IsGovernmentListed);
        _out.WriteLine($"대법원 등재: {govListed}자 ({govListed * 100.0 / coreEntries.Count:F1}%)");
    }

    [Fact]
    public void Q3_NoisyHanjaTierMembership()
    {
        // 배기/니치/후낭에 쓰인 한자들의 Tier 소속 확인
        var suspects = new[] { "蓓", "奇", "泥", "阤", "吽", "琅", "배", "기", "니", "치", "후", "낭" };

        _out.WriteLine("=== Q3. 노이즈 후보 한자들의 Tier 소속 ===\n");
        _out.WriteLine($"{"한자",-4} {"읽기",-4} {"Source",-12} {"Grade",-5} {"Category",-8} {"CJK",-7} {"정부",-4} {"Common",-6} Meaning");
        _out.WriteLine(new string('─', 100));

        foreach (var ch in suspects)
        {
            var h = HanjaData.FindByCharacter(ch);
            if (h == null)
            {
                _out.WriteLine($"{ch,-4} (사전에 없음)");
                continue;
            }

            string cjk = HanjaData.IsInCjkBasicRange(ch) ? "Basic"
                       : HanjaData.IsInCjkExtensionA(ch) ? "ExtA"
                       : "Other";

            // CommonNameHanja 접근은 private이라 불가 — 대신 관련성 점수로 추정
            int score = HanjaData.CalculateRelevanceScore(h);
            bool likelyCommon = (score - (cjk == "Basic" ? 1000 : cjk == "ExtA" ? 100 : 0)
                                       - (h.IsGovernmentListed ? 500 : 0)
                                       - (string.IsNullOrEmpty(h.Meaning) ? 0 : 50)
                                       - (!string.IsNullOrEmpty(h.Category) && h.Category != "기타" ? 30 : 0)
                                       - (string.IsNullOrEmpty(h.FiveElement) ? 0 : 20)
                                       - (h.StrokeCount > 0 ? 10 : 0)
                                       - (h.GenderPref != HanjaData.GenderPreference.Neutral ? 5 : 0)
                                       - (h.TonePref != HanjaData.TonePreference.Neutral ? 5 : 0)) >= 300;

            _out.WriteLine($"{ch,-4} {h.Reading,-4} {h.Source,-12} {h.ConfidenceGrade,-5} {h.Category,-8} {cjk,-7} {(h.IsGovernmentListed ? "Y" : "N"),-4} {(likelyCommon ? "Y" : "N"),-6} {h.Meaning}");
            _out.WriteLine($"         score={score}");
        }
    }

    [Fact]
    public void Q4_CategoryBreakdownByGoodSamples()
    {
        // 좋은 후보 샘플이 실제로 어느 카테고리에 있고, NamePoolEngine의 Take(30)에 들어갈 가능성이 있는지 확인
        var goodSamples = new[] { "嘉", "仁", "德", "俊", "珉", "準", "賢", "玄", "民", "志", "智", "洙", "浩" };

        _out.WriteLine("=== Q4. 좋은 후보 한자의 카테고리/소스 ===\n");
        _out.WriteLine($"{"한자",-4} {"읽기",-4} {"Source",-12} {"Grade",-5} {"Category",-8} Meaning");
        _out.WriteLine(new string('─', 80));
        foreach (var ch in goodSamples)
        {
            var h = HanjaData.FindByCharacter(ch);
            if (h == null) { _out.WriteLine($"{ch} 없음"); continue; }
            _out.WriteLine($"{ch,-4} {h.Reading,-4} {h.Source,-12} {h.ConfidenceGrade,-5} {h.Category,-8} {h.Meaning}");
        }

        // Category "덕목" 풀의 Core_v1 비율
        var virtueAll = HanjaData.GetAllHanja().Where(h => h.Category == "덕목").ToList();
        var virtueCore = virtueAll.Where(h => h.Source == "Core_v1").ToList();
        _out.WriteLine($"\nCategory=덕목 전체: {virtueAll.Count}자, 그중 Core_v1: {virtueCore.Count}자 ({virtueCore.Count * 100.0 / virtueAll.Count:F1}%)");

        var natureAll = HanjaData.GetAllHanja().Where(h => h.Category == "자연").ToList();
        var natureCore = natureAll.Where(h => h.Source == "Core_v1").ToList();
        _out.WriteLine($"Category=자연 전체: {natureAll.Count}자, 그중 Core_v1: {natureCore.Count}자 ({natureCore.Count * 100.0 / natureAll.Count:F1}%)");

        var conceptAll = HanjaData.GetAllHanja().Where(h => h.Category == "개념").ToList();
        var conceptCore = conceptAll.Where(h => h.Source == "Core_v1").ToList();
        _out.WriteLine($"Category=개념 전체: {conceptAll.Count}자, 그중 Core_v1: {conceptCore.Count}자 ({conceptCore.Count * 100.0 / conceptAll.Count:F1}%)");

        var otherAll = HanjaData.GetAllHanja().Where(h => h.Category == "기타" || string.IsNullOrEmpty(h.Category)).ToList();
        var otherCore = otherAll.Where(h => h.Source == "Core_v1").ToList();
        _out.WriteLine($"Category=기타 전체: {otherAll.Count}자, 그중 Core_v1: {otherCore.Count}자 ({otherCore.Count * 100.0 / otherAll.Count:F1}%)");
    }
}
