using System.Text.Json;
using System.Text.Json.Serialization;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 3글자 이름 큐레이션 데이터 로더
/// data/three-syllable-curated.json 파일에서 3글자 이름 DB 로드
/// </summary>
public static class ThreeSyllableCuratedLoader
{
    // volatile — 락 밖 첫 읽기에서 다 읽은 목록만 보이게 한다(PhonologyVowelLoader 와 같은 방식).
    // 옛 코드는 LoadEntries 가 빈 목록을 이 필드에 먼저 넣고 파일을 읽어, 시작 직후 함께 들어온 요청이
    // 빈 목록을 받았다(3음절 탭 결과가 그 요청만 달라짐 — 2026-11-19 P0 영향 측정에서 발견).
    private static volatile List<CuratedThreeSyllableEntry>? _entries;
    private static readonly object _lockObject = new object();

    /// <summary>
    /// 전체 큐레이션 엔트리 목록 (읽기 전용)
    /// </summary>
    public static IReadOnlyList<CuratedThreeSyllableEntry> Entries
    {
        get
        {
            var local = _entries;
            if (local != null) return local;
            lock (_lockObject)
            {
                // 다 읽은 목록만 단 한 번 넣는다 — 읽는 중인 상태가 밖으로 나가지 않는다
                return _entries ??= LoadEntries();
            }
        }
    }

    private static List<CuratedThreeSyllableEntry> LoadEntries()
    {
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
            return new List<CuratedThreeSyllableEntry>();
        }

        try
        {
            var jsonContent = File.ReadAllText(filePath, System.Text.Encoding.UTF8);
            var data = JsonSerializer.Deserialize<ThreeSyllableCuratedFile>(jsonContent,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (data?.Entries != null)
            {
                return data.Entries
                    .Where(e => !string.IsNullOrWhiteSpace(e.Name) && e.Name.Length == 3)
                    .ToList();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine(
                $"경고: three-syllable-curated.json 로드 실패: {ex.Message}. 빈 리스트로 진행합니다.");
        }
        return new List<CuratedThreeSyllableEntry>();
    }

    /// <summary>
    /// 테스트용 캐시 무효화 — 다음 접근 때 다시 읽는다(동시 첫 읽기 회귀 테스트가 쓴다).
    /// </summary>
    public static void ResetCache()
    {
        lock (_lockObject)
        {
            _entries = null;
        }
    }

    /// <summary>
    /// 테스트용 재로드 훅
    /// </summary>
    internal static void Reload()
    {
        lock (_lockObject)
        {
            // 다시 읽는 동안에도 옛 목록이 그대로 보이고, 다 읽은 뒤 한 번에 바꾼다
            _entries = LoadEntries();
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
