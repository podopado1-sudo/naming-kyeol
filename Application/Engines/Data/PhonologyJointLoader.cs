using System.Text.Json;
using System.Text.Json.Serialization;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 음절 경계(받침+초성) 음운 데이터 로더.
/// data/phonology-joint.json 파일에서 하드 필터/특성 조합 로드.
/// 2026-04-21 옵션 C Phase 1-c.
/// </summary>
public static class PhonologyJointLoader
{
    // volatile — 락 밖 첫 읽기(double-checked locking)에서 완전히 빌드된 객체만 관측되도록 보장
    private static volatile PhonologyJointData? _data;
    private static readonly object _lockObject = new object();

    /// <summary>
    /// 7종성 법칙 매핑 (읽기 전용).
    /// 예: "ㄲ" → "ㄱ", "ㅅ" → "ㄷ", "ㅍ" → "ㅂ".
    /// 매핑에 없는 받침은 그대로 반환됨.
    /// </summary>
    public static IReadOnlyDictionary<string, string> SevenJongseongMapping
        => EnsureLoaded()._sevenJongseongMapping;

    /// <summary>
    /// 특성 설명 목록 (감점 없음, Explanation 용도).
    /// </summary>
    public static IReadOnlyList<JointCharacteristic> Characteristics
        => EnsureLoaded()._characteristics;

    /// <summary>
    /// 받침을 7종성 법칙에 따라 정규화한다.
    /// 입력이 빈 문자열이면 빈 문자열을 반환.
    /// </summary>
    public static string NormalizeFinal(string final)
    {
        if (string.IsNullOrEmpty(final)) return string.Empty;
        var data = EnsureLoaded();
        return data._sevenJongseongMapping.TryGetValue(final, out var mapped) ? mapped : final;
    }

    /// <summary>
    /// 주어진 받침+초성 조합이 하드 필터에 걸리는지 판정.
    /// 7종성 매핑을 내부에서 적용하므로 원본 받침을 그대로 전달해도 됨.
    /// </summary>
    public static bool IsJointBlocked(string final, string initial)
    {
        if (string.IsNullOrEmpty(final) || string.IsNullOrEmpty(initial)) return false;
        var data = EnsureLoaded();
        var normalizedFinal = NormalizeFinal(final);
        return data._blockedJoints.Contains((normalizedFinal, initial));
    }

    /// <summary>
    /// 주어진 받침+초성 조합에 해당하는 특성을 찾는다.
    /// 없으면 null 반환. 여러 특성 중첩되면 첫 번째 매칭만 반환.
    /// </summary>
    public static JointCharacteristic? GetJointCharacteristic(string final, string initial)
    {
        if (string.IsNullOrEmpty(final) || string.IsNullOrEmpty(initial)) return null;
        var data = EnsureLoaded();
        var normalizedFinal = NormalizeFinal(final);
        return data._characteristicIndex.TryGetValue((normalizedFinal, initial), out var c) ? c : null;
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
            _data = LoadData();
        }
    }

    // ── private 구현 ────────────────────────────────────────────────────
    private static PhonologyJointData EnsureLoaded()
    {
        var local = _data;
        if (local != null) return local;
        lock (_lockObject)
        {
            // _data는 완전히 빌드된 객체로만 단 한 번 할당 — 부분 초기화 상태가 외부에 노출되지 않음
            return _data ??= LoadData();
        }
    }

    private static PhonologyJointData LoadData()
    {
        // AppContext.BaseDirectory 우선 — 병렬 테스트에서 CWD가 가변이라 GetCurrentDirectory는 후순위
        var searchPaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "data", "phonology-joint.json"),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "data", "phonology-joint.json")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "data", "phonology-joint.json")),
            Path.Combine(Directory.GetCurrentDirectory(), "data", "phonology-joint.json"),
        };

        var filePath = searchPaths.FirstOrDefault(File.Exists);

        if (filePath == null)
        {
            System.Diagnostics.Debug.WriteLine(
                "경고: phonology-joint.json 파일을 찾을 수 없습니다. 음운 조합 데이터가 비어있습니다.");
            return PhonologyJointData.Empty();
        }

        try
        {
            var jsonContent = File.ReadAllText(filePath, System.Text.Encoding.UTF8);
            var file = JsonSerializer.Deserialize<PhonologyJointFile>(jsonContent,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (file == null) return PhonologyJointData.Empty();

            // 7종성 매핑
            var mapping = file.SevenJongseongMapping ?? new Dictionary<string, string>();

            // 하드 필터 조합 인덱스
            var blocked = new HashSet<(string, string)>();
            if (file.HardFilters != null)
            {
                foreach (var f in file.HardFilters)
                {
                    if (f.Combinations == null) continue;
                    foreach (var c in f.Combinations)
                    {
                        if (!string.IsNullOrEmpty(c.Final) && !string.IsNullOrEmpty(c.Initial))
                        {
                            blocked.Add((c.Final, c.Initial));
                        }
                    }
                }
            }

            // 특성 인덱스
            var characteristics = new List<JointCharacteristic>();
            var charIndex = new Dictionary<(string, string), JointCharacteristic>();
            if (file.Characteristics != null)
            {
                foreach (var c in file.Characteristics)
                {
                    var entry = new JointCharacteristic
                    {
                        Id = c.Id ?? "",
                        Name = c.Name ?? "",
                        Description = c.Description ?? "",
                        ExplanationHint = c.ExplanationHint ?? "",
                        Combinations = c.Combinations?.Select(cc => new JointCombination
                        {
                            Final = cc.Final ?? "",
                            Initial = cc.Initial ?? "",
                            Example = cc.Example ?? ""
                        }).ToList() ?? new List<JointCombination>()
                    };
                    characteristics.Add(entry);

                    foreach (var combo in entry.Combinations)
                    {
                        var key = (combo.Final, combo.Initial);
                        if (!charIndex.ContainsKey(key))
                        {
                            charIndex[key] = entry;
                        }
                    }
                }
            }

            return new PhonologyJointData(mapping, blocked, characteristics, charIndex);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine(
                $"경고: phonology-joint.json 로드 실패: {ex.Message}. 빈 데이터로 진행합니다.");
            return PhonologyJointData.Empty();
        }
    }

    // ── 내부 컨테이너 ────────────────────────────────────────────────────
    private sealed class PhonologyJointData
    {
        public readonly IReadOnlyDictionary<string, string> _sevenJongseongMapping;
        public readonly HashSet<(string, string)> _blockedJoints;
        public readonly IReadOnlyList<JointCharacteristic> _characteristics;
        public readonly IReadOnlyDictionary<(string, string), JointCharacteristic> _characteristicIndex;

        public PhonologyJointData(
            IReadOnlyDictionary<string, string> mapping,
            HashSet<(string, string)> blocked,
            IReadOnlyList<JointCharacteristic> characteristics,
            IReadOnlyDictionary<(string, string), JointCharacteristic> charIndex)
        {
            _sevenJongseongMapping = mapping;
            _blockedJoints = blocked;
            _characteristics = characteristics;
            _characteristicIndex = charIndex;
        }

        public static PhonologyJointData Empty() => new(
            new Dictionary<string, string>(),
            new HashSet<(string, string)>(),
            new List<JointCharacteristic>(),
            new Dictionary<(string, string), JointCharacteristic>());
    }

    // ── JSON deserialization 모델 ───────────────────────────────────────
    private class PhonologyJointFile
    {
        [JsonPropertyName("version")] public string? Version { get; set; }
        [JsonPropertyName("sevenJongseongMapping")] public Dictionary<string, string>? SevenJongseongMapping { get; set; }
        [JsonPropertyName("hardFilters")] public List<HardFilterDto>? HardFilters { get; set; }
        [JsonPropertyName("characteristics")] public List<CharacteristicDto>? Characteristics { get; set; }
    }

    private class HardFilterDto
    {
        [JsonPropertyName("id")] public string? Id { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("description")] public string? Description { get; set; }
        [JsonPropertyName("combinations")] public List<CombinationDto>? Combinations { get; set; }
    }

    private class CharacteristicDto
    {
        [JsonPropertyName("id")] public string? Id { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("description")] public string? Description { get; set; }
        [JsonPropertyName("explanationHint")] public string? ExplanationHint { get; set; }
        [JsonPropertyName("combinations")] public List<CombinationDto>? Combinations { get; set; }
    }

    private class CombinationDto
    {
        [JsonPropertyName("final")] public string? Final { get; set; }
        [JsonPropertyName("initial")] public string? Initial { get; set; }
        [JsonPropertyName("example")] public string? Example { get; set; }
    }
}

// ── 퍼블릭 모델 ──────────────────────────────────────────────────────
/// <summary>
/// 음절 경계 특성 (감점 없음, Explanation 용도).
/// </summary>
public class JointCharacteristic
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string ExplanationHint { get; set; } = "";
    public List<JointCombination> Combinations { get; set; } = new();
}

/// <summary>
/// 받침+초성 조합 예시.
/// </summary>
public class JointCombination
{
    public string Final { get; set; } = "";
    public string Initial { get; set; } = "";
    public string Example { get; set; } = "";
}
