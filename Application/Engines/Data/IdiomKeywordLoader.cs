using System.Text.Json;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 관용구/사자성어 키워드 데이터 로더
/// </summary>
public static class IdiomKeywordLoader
{
    private static List<IdiomEntry>? _entries;
    private static readonly object _lock = new();

    public class IdiomEntry
    {
        public string Idiom { get; set; } = string.Empty;
        public List<string> Keywords { get; set; } = new();
        public List<string> Meanings { get; set; } = new();
    }

    private class JsonEntry
    {
        public string idiom { get; set; } = string.Empty;
        public List<string> keywords { get; set; } = new();
        public List<string> meanings { get; set; } = new();
    }

    public static List<IdiomEntry> GetEntries()
    {
        if (_entries != null) return _entries;

        lock (_lock)
        {
            if (_entries != null) return _entries;

            _entries = new List<IdiomEntry>();

            var paths = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "data", "idiom_keywords.json"),
                Path.Combine(Directory.GetCurrentDirectory(), "data", "idiom_keywords.json"),
                @"D:\MyDev\NameForm\data\idiom_keywords.json"
            };

            foreach (var path in paths)
            {
                if (File.Exists(path))
                {
                    try
                    {
                        var json = File.ReadAllText(path);
                        var entries = JsonSerializer.Deserialize<List<JsonEntry>>(json);
                        if (entries != null)
                        {
                            _entries = entries.Select(e => new IdiomEntry
                            {
                                Idiom = e.idiom,
                                Keywords = e.keywords,
                                Meanings = e.meanings
                            }).ToList();
                        }
                    }
                    catch
                    {
                        // 파일 로드 실패 시 빈 목록
                    }
                    break;
                }
            }

            return _entries;
        }
    }

    /// <summary>
    /// 키워드로 관련 관용구 검색
    /// </summary>
    public static List<IdiomEntry> FindByKeyword(string keyword)
    {
        return GetEntries()
            .Where(e => e.Idiom.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                       e.Keywords.Any(k => keyword.Contains(k, StringComparison.OrdinalIgnoreCase)) ||
                       e.Meanings.Any(m => keyword.Contains(m, StringComparison.OrdinalIgnoreCase)))
            .ToList();
    }
}
