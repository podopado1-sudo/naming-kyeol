using System.Text.Json;
using System.Text.Json.Serialization;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 모음 클래스 (훈민정음 3분류).
/// </summary>
public enum VowelClass
{
    /// <summary>알 수 없는 모음 (분류에 없음).</summary>
    Unknown,
    /// <summary>양성 모음 (ㅏ, ㅗ, ㅐ, ㅑ, ㅛ, ㅘ, ㅙ, ㅚ).</summary>
    Yang,
    /// <summary>음성 모음 (ㅓ, ㅜ, ㅡ, ㅔ, ㅕ, ㅠ, ㅝ, ㅞ, ㅢ).</summary>
    Yin,
    /// <summary>중성 모음 (ㅣ).</summary>
    Neutral
}

/// <summary>
/// 모음 조화 데이터 로더.
/// data/phonology-vowel-harmony.json 파일에서 모음 분류 + 특성 목록 로드.
/// 2026-04-21 옵션 C Phase 1-c.
/// </summary>
public static class PhonologyVowelLoader
{
    private static PhonologyVowelData? _data;
    private static readonly object _lockObject = new object();

    /// <summary>
    /// 모음 특성 목록 (감점 없음, Explanation 용도).
    /// </summary>
    public static IReadOnlyList<VowelCharacteristic> Characteristics
        => EnsureLoaded()._characteristics;

    /// <summary>
    /// 주어진 모음(중성)을 양/음/중 클래스로 분류.
    /// 합성모음(ㅘ/ㅝ/ㅢ 등)도 JSON 정의에 따라 분류됨.
    /// 알 수 없는 문자면 VowelClass.Unknown 반환.
    /// </summary>
    public static VowelClass ClassifyVowel(string vowel)
    {
        if (string.IsNullOrEmpty(vowel)) return VowelClass.Unknown;
        var data = EnsureLoaded();
        return data._vowelToClass.TryGetValue(vowel, out var cls) ? cls : VowelClass.Unknown;
    }

    /// <summary>
    /// 테스트용 캐시 무효화 — 다음 접근 시 재로드 (병렬 테스트 간 상태 누설 방지).
    /// </summary>
    public static void ResetCache()
    {
        lock (_lockObject)
        {
            _data = null;
        }
    }

    /// <summary>
    /// 테스트용 재로드 훅 (즉시 재로드). ResetCache로 충분한 경우가 많음.
    /// </summary>
    internal static void Reload()
    {
        lock (_lockObject)
        {
            _data = null;
            LoadData();
        }
    }

    // ── private 구현 ────────────────────────────────────────────────────
    private static PhonologyVowelData EnsureLoaded()
    {
        if (_data == null)
        {
            lock (_lockObject)
            {
                if (_data == null)
                {
                    LoadData();
                }
            }
        }
        return _data!;
    }

    private static void LoadData()
    {
        _data = PhonologyVowelData.Empty();

        // AppContext.BaseDirectory 우선 — 병렬 테스트에서 CWD가 가변이라 GetCurrentDirectory는 후순위
        var searchPaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "data", "phonology-vowel-harmony.json"),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "data", "phonology-vowel-harmony.json")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "data", "phonology-vowel-harmony.json")),
            Path.Combine(Directory.GetCurrentDirectory(), "data", "phonology-vowel-harmony.json"),
        };

        var filePath = searchPaths.FirstOrDefault(File.Exists);

        if (filePath == null)
        {
            System.Diagnostics.Debug.WriteLine(
                "경고: phonology-vowel-harmony.json 파일을 찾을 수 없습니다. 모음 데이터가 비어있습니다.");
            return;
        }

        try
        {
            var jsonContent = File.ReadAllText(filePath, System.Text.Encoding.UTF8);
            var file = JsonSerializer.Deserialize<PhonologyVowelFile>(jsonContent,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (file == null) return;

            // 모음 → 클래스 인덱스
            var vowelToClass = new Dictionary<string, VowelClass>();
            if (file.VowelClasses != null)
            {
                AddClass(vowelToClass, file.VowelClasses.Yang, VowelClass.Yang);
                AddClass(vowelToClass, file.VowelClasses.Yin, VowelClass.Yin);
                AddClass(vowelToClass, file.VowelClasses.Neutral, VowelClass.Neutral);
            }

            // 특성 목록
            var characteristics = new List<VowelCharacteristic>();
            if (file.Characteristics != null)
            {
                foreach (var c in file.Characteristics)
                {
                    characteristics.Add(new VowelCharacteristic
                    {
                        Id = c.Id ?? "",
                        Name = c.Name ?? "",
                        Description = c.Description ?? "",
                        ExplanationHint = c.ExplanationHint ?? "",
                        TriggerType = c.Trigger?.Type ?? "",
                        TriggerMinLength = c.Trigger?.MinLength ?? 3
                    });
                }
            }

            _data = new PhonologyVowelData(vowelToClass, characteristics);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine(
                $"경고: phonology-vowel-harmony.json 로드 실패: {ex.Message}. 빈 데이터로 진행합니다.");
            _data = PhonologyVowelData.Empty();
        }
    }

    private static void AddClass(
        Dictionary<string, VowelClass> target,
        VowelClassDto? dto,
        VowelClass cls)
    {
        if (dto?.Vowels == null) return;
        foreach (var v in dto.Vowels)
        {
            if (!string.IsNullOrEmpty(v) && !target.ContainsKey(v))
            {
                target[v] = cls;
            }
        }
    }

    // ── 내부 컨테이너 ────────────────────────────────────────────────────
    private sealed class PhonologyVowelData
    {
        public readonly IReadOnlyDictionary<string, VowelClass> _vowelToClass;
        public readonly IReadOnlyList<VowelCharacteristic> _characteristics;

        public PhonologyVowelData(
            IReadOnlyDictionary<string, VowelClass> vowelToClass,
            IReadOnlyList<VowelCharacteristic> characteristics)
        {
            _vowelToClass = vowelToClass;
            _characteristics = characteristics;
        }

        public static PhonologyVowelData Empty() => new(
            new Dictionary<string, VowelClass>(),
            new List<VowelCharacteristic>());
    }

    // ── JSON deserialization 모델 ───────────────────────────────────────
    private class PhonologyVowelFile
    {
        [JsonPropertyName("version")] public string? Version { get; set; }
        [JsonPropertyName("vowelClasses")] public VowelClassesDto? VowelClasses { get; set; }
        [JsonPropertyName("characteristics")] public List<CharacteristicDto>? Characteristics { get; set; }
    }

    private class VowelClassesDto
    {
        [JsonPropertyName("yang")] public VowelClassDto? Yang { get; set; }
        [JsonPropertyName("yin")] public VowelClassDto? Yin { get; set; }
        [JsonPropertyName("neutral")] public VowelClassDto? Neutral { get; set; }
    }

    private class VowelClassDto
    {
        [JsonPropertyName("description")] public string? Description { get; set; }
        [JsonPropertyName("vowels")] public List<string>? Vowels { get; set; }
    }

    private class CharacteristicDto
    {
        [JsonPropertyName("id")] public string? Id { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("description")] public string? Description { get; set; }
        [JsonPropertyName("explanationHint")] public string? ExplanationHint { get; set; }
        [JsonPropertyName("trigger")] public TriggerDto? Trigger { get; set; }
    }

    private class TriggerDto
    {
        [JsonPropertyName("type")] public string? Type { get; set; }
        [JsonPropertyName("minLength")] public int? MinLength { get; set; }
    }
}

// ── 퍼블릭 모델 ──────────────────────────────────────────────────────
/// <summary>
/// 모음 특성 (감점 없음, Explanation 용도).
/// </summary>
public class VowelCharacteristic
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string ExplanationHint { get; set; } = "";

    /// <summary>트리거 타입 ("same_vowel_streak" | "neutral_streak").</summary>
    public string TriggerType { get; set; } = "";

    /// <summary>연속 최소 길이 (기본 3).</summary>
    public int TriggerMinLength { get; set; } = 3;
}
