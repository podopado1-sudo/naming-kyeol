using NameForm.Application.Engines.Data;
using Xunit;
using Xunit.Abstractions;

namespace NameForm.Tests;

/// <summary>
/// FindByReading() 동작 진단 테스트
/// </summary>
public class FindByReadingDiagnosticTests
{
    private readonly ITestOutputHelper _output;

    public FindByReadingDiagnosticTests(ITestOutputHelper output)
    {
        _output = output;
        HanjaData.LoadExternalData();
    }

    [Fact]
    public void Diagnostic_FindByReading_CommonReadings()
    {
        var testReadings = new[] { "민", "준", "서", "연", "지", "호", "현", "수", "은", "하",
                                    "윤", "도", "진", "영", "우", "성", "재", "원", "태", "혜" };

        var totalFound = 0;
        var details = new List<string>();
        foreach (var reading in testReadings)
        {
            var results = HanjaData.FindByReading(reading);
            details.Add($"FindByReading(\"{reading}\"): {results.Count}개");
            totalFound += results.Count;
        }

        // 최소한 일부는 찾아야 함
        Assert.True(totalFound > 0,
            $"FindByReading이 하나도 찾지 못함!\n{string.Join("\n", details)}");

        // 20개 음절 중 최소 15개는 찾아야 함
        var foundCount = testReadings.Count(r => HanjaData.FindByReading(r).Count > 0);
        Assert.True(foundCount >= 15,
            $"20개 음절 중 {foundCount}개만 매칭됨.\n{string.Join("\n", details)}");
    }

    [Fact]
    public void Diagnostic_ReadingFieldValues()
    {
        var allHanja = HanjaData.GetAllHanja();
        var withReading = allHanja.Where(h => !string.IsNullOrEmpty(h.Reading)).ToList();
        var withComma = withReading.Where(h => h.Reading.Contains(",")).ToList();
        var emptyReading = allHanja.Where(h => string.IsNullOrEmpty(h.Reading)).ToList();

        // 쉼표 포함 Reading은 0이어야 함 (수정 후)
        Assert.True(withComma.Count == 0,
            $"Reading에 쉼표 포함: {withComma.Count}개\n예: {string.Join(", ", withComma.Take(5).Select(h => $"{h.Character}=\"{h.Reading}\""))}");

        // 빈 Reading 비율 확인 (Unihan 데이터 일부는 reading 없음, 50% 미만이면 OK)
        var emptyRatio = (double)emptyReading.Count / allHanja.Count;
        Assert.True(emptyRatio < 0.5,
            $"Reading 비어있음: {emptyReading.Count}/{allHanja.Count} ({emptyRatio:P0})");

        // Reading 길이가 1인 것이 대다수여야 함 (한글 1음절)
        var singleChar = withReading.Count(h => h.Reading.Length == 1);
        Assert.True(singleChar > withReading.Count * 0.8,
            $"1글자 Reading: {singleChar}/{withReading.Count}");
    }

    [Fact]
    public void Diagnostic_UniqueReadings()
    {
        var allHanja = HanjaData.GetAllHanja();
        var uniqueReadings = allHanja
            .Where(h => !string.IsNullOrEmpty(h.Reading))
            .Select(h => h.Reading)
            .Distinct()
            .OrderBy(r => r)
            .ToList();

        _output.WriteLine($"고유 Reading 수: {uniqueReadings.Count}");
        _output.WriteLine($"예시: {string.Join(", ", uniqueReadings.Take(50))}");

        // 한글 자모 범위 체크
        var koreanReadings = uniqueReadings.Where(r => r.Length == 1 && r[0] >= '가' && r[0] <= '힣').ToList();
        _output.WriteLine($"\n1글자 한글 Reading: {koreanReadings.Count}개");
        _output.WriteLine($"예시: {string.Join(", ", koreanReadings.Take(30))}");
    }
}
