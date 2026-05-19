using System.Globalization;
using System.Text;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 인명용 한자 CSV 파일 로더
/// </summary>
public static class HanjaCsvLoader
{
    /// <summary>
    /// CSV 행 데이터
    /// </summary>
    public class CsvRow
    {
        public string Hangul { get; set; } = string.Empty;
        public string Consonant { get; set; } = string.Empty;
        public string Unicode { get; set; } = string.Empty;
        public string Hanja { get; set; } = string.Empty;
    }

    /// <summary>
    /// CSV 파일에서 한자 데이터 로드
    /// </summary>
    public static Dictionary<string, List<CsvRow>> LoadFromCsv(string filePath)
    {
        var result = new Dictionary<string, List<CsvRow>>();
        
        if (!File.Exists(filePath))
        {
            return result;
        }

        var lines = File.ReadAllLines(filePath, Encoding.UTF8);
        
        // 헤더 스킵
        for (int i = 1; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (string.IsNullOrEmpty(line))
                continue;

            var parts = ParseCsvLine(line);
            if (parts.Length < 4)
                continue;

            var row = new CsvRow
            {
                Hangul = parts[0],
                Consonant = parts[1],
                Unicode = parts[2],
                Hanja = parts[3]
            };

            // 한자별로 그룹화 (같은 한자가 여러 발음으로 중복될 수 있음)
            if (!result.ContainsKey(row.Hanja))
            {
                result[row.Hanja] = new List<CsvRow>();
            }
            result[row.Hanja].Add(row);
        }

        return result;
    }

    /// <summary>
    /// CSV 라인 파싱 (쉼표로 구분, 따옴표 처리)
    /// </summary>
    private static string[] ParseCsvLine(string line)
    {
        var result = new List<string>();
        var current = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];

            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    // 이스케이프된 따옴표
                    current.Append('"');
                    i++;
                }
                else
                {
                    // 따옴표 시작/끝
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        result.Add(current.ToString());
        return result.ToArray();
    }

    /// <summary>
    /// 여러 CSV 파일을 병합하여 로드
    /// </summary>
    public static Dictionary<string, List<CsvRow>> LoadFromMultipleCsv(params string[] filePaths)
    {
        var merged = new Dictionary<string, List<CsvRow>>();

        foreach (var filePath in filePaths)
        {
            var data = LoadFromCsv(filePath);
            foreach (var kvp in data)
            {
                if (!merged.ContainsKey(kvp.Key))
                {
                    merged[kvp.Key] = new List<CsvRow>();
                }
                
                // 중복 발음 제거 (같은 한자, 같은 발음은 하나만 유지)
                foreach (var row in kvp.Value)
                {
                    if (!merged[kvp.Key].Any(r => r.Hangul == row.Hangul))
                    {
                        merged[kvp.Key].Add(row);
                    }
                }
            }
        }

        return merged;
    }
}
