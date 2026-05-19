using System.Text.Json;
using System.Text.Json.Serialization;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 3글자 이름 큐레이션 데이터 로더
/// data/three-syllable-curated.json 파일에서 3글자 이름 DB 로드
/// </summary>
public static class ThreeSyllableCuratedLoader
{
    private static List<CuratedThreeSyllableEntry>? _entries;
    private static readonly object _lockObject = new object();

    /// <summary>
    /// 전체 큐레이션 엔트리 목록 (읽기 전용)
    /// </summary>
    public static IReadOnlyList<CuratedThreeSyllableEntry> Entries
    {
        get
        {
            if (_entries == null)
            {
                lock (_lockObject)
                {
                    if (_entries == null)
                    {
                        LoadEntries();
                    }
                }
            }
            return _entries!;
        }
    }

    private static void LoadEntries()
    {
        _entries = new List<CuratedThreeSyllableEntry>();

        var searchPaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "data", "three-syllable-curated.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "data", "three-syllable-curated.json"),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "data", "three-syllable-curated.json")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "data", "three-syllable-curated.json")),
        };

        var filePath = searchPaths.FirstOrDefault(File.Exists);

        if (filePath == null)
        {
            System.Diagnostics.Debug.WriteLine(
                "경고: three-syllable-curated.json 파일을 찾을 수 없습니다. 3글자 큐레이션 리스트가 비어있습니다.");
            return;
        }

        try
        {
            var jsonContent = File.ReadAllText(filePath, System.Text.Encoding.UTF8);
            var data = JsonSerializer.Deserialize<ThreeSyllableCuratedFile>(jsonContent,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (data?.Entries != null)
            {
                _entries = data.Entries
                    .Where(e => !string.IsNullOrWhiteSpace(e.Name) && e.Name.Length == 3)
                    .ToList();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine(
                $"경고: three-syllable-curated.json 로드 실패: {ex.Message}. 빈 리스트로 진행합니다.");
            _entries = new List<CuratedThreeSyllableEntry>();
        }
    }

    /// <summary>
    /// 테스트용 재로드 훅
    /// </summary>
    internal static void Reload()
    {
        lock (_lockObject)
        {
            _entries = null;
            LoadEntries();
        }
    }

    // ── JSON deserialization 모델 ────────────────────────────────────────
    private class ThreeSyllableCuratedFile
    {
        [JsonPropertyName("version")]
        public string? Version { get; set; }

        [JsonPropertyName("entries")]
        public List<CuratedThreeSyllableEntry>? Entries { get; set; }
    }
}

/// <summary>
/// 큐레이션된 3글자 이름 엔트리
/// </summary>
public class CuratedThreeSyllableEntry
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("meaning")]
    public string Meaning { get; set; } = "";

    [JsonPropertyName("nameType")]
    public string NameType { get; set; } = "pure-korean"; // pure-korean | hanja | mixed

    [JsonPropertyName("gender")]
    public string Gender { get; set; } = "neutral"; // male | female | neutral

    [JsonPropertyName("tone")]
    public string Tone { get; set; } = "neutral"; // soft | strong | neutral

    [JsonPropertyName("baseScore")]
    public double BaseScore { get; set; } = 80;
}
