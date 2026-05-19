using System.Text.Json;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 영어-한국어 이름 매핑 데이터
/// english_korean_names.json에서 로딩
/// </summary>
public static class EnglishKoreanNameMap
{
    private static List<DualNameMapping>? _mappings;
    private static readonly object _lock = new();

    public class DualNameMapping
    {
        public string English { get; set; } = string.Empty;
        public List<string> Korean { get; set; } = new();
        public string Gender { get; set; } = "none";
    }

    private class JsonEntry
    {
        public string english { get; set; } = string.Empty;
        public List<string> korean { get; set; } = new();
        public string gender { get; set; } = "none";
    }

    /// <summary>
    /// 전체 매핑 목록 로드
    /// </summary>
    public static List<DualNameMapping> GetMappings()
    {
        if (_mappings != null) return _mappings;

        lock (_lock)
        {
            if (_mappings != null) return _mappings;

            _mappings = new List<DualNameMapping>();

            var paths = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "data", "english_korean_names.json"),
                Path.Combine(Directory.GetCurrentDirectory(), "data", "english_korean_names.json"),
                @"D:\MyDev\NameForm\data\english_korean_names.json"
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
                            _mappings = entries.Select(e => new DualNameMapping
                            {
                                English = e.english,
                                Korean = e.korean,
                                Gender = e.gender
                            }).ToList();
                        }
                    }
                    catch
                    {
                        // 파일 로드 실패 시 빈 목록 유지
                    }
                    break;
                }
            }

            return _mappings;
        }
    }

    /// <summary>
    /// 영어 이름으로 검색 (대소문자 무시)
    /// </summary>
    public static List<DualNameMapping> FindByEnglishName(string englishName)
    {
        return GetMappings()
            .Where(m => m.English.Equals(englishName, StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    /// <summary>
    /// 한국어 음역으로 검색
    /// </summary>
    public static List<DualNameMapping> FindByKoreanPhonetic(string koreanPhonetic)
    {
        return GetMappings()
            .Where(m => m.Korean.Any(k => k.Contains(koreanPhonetic)))
            .ToList();
    }

    /// <summary>
    /// 성별 필터링된 매핑 반환
    /// </summary>
    public static List<DualNameMapping> GetByGender(string gender)
    {
        if (gender == "none")
            return GetMappings();

        return GetMappings()
            .Where(m => m.Gender == gender || m.Gender == "none")
            .ToList();
    }
}
