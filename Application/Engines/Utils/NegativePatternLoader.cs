using System.Text.Json;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 부정적 음성 패턴 로더
/// negative_phonetic_patterns.json 파일에서 부정적 패턴 로드
/// </summary>
public static class NegativePatternLoader
{
    private static NegativePatternData? _data;
    private static readonly object _lockObject = new object();

    public static NegativePatternData Data
    {
        get
        {
            if (_data == null)
            {
                lock (_lockObject)
                {
                    if (_data == null)
                    {
                        LoadPatterns();
                    }
                }
            }
            return _data!;
        }
    }

    /// <summary>
    /// 테스트용 — 캐시를 무효화해 다음 Data 접근 시 재로드 (병렬 테스트 간 상태 누설 방지)
    /// </summary>
    public static void ResetCache()
    {
        lock (_lockObject)
        {
            _data = null;
        }
    }

    private static void LoadPatterns()
    {
        _data = new NegativePatternData
        {
            HighPenaltySyllables = new HashSet<string>(),
            MediumPenaltySyllables = new HashSet<string>(),
            NegativeCombinations = new List<NegativeCombination>(),
            NegativeVerbsAndAdjectives = new HashSet<string>(),
            NegativePhrases = new HashSet<string>(),
            HomophoneNegative = new List<HomophonePattern>(),
            StrongPlosives = new HashSet<string>(),
            ConsecutiveStrongPlosivesPenalty = 25,
            SameConsonantRepetitionPenalty = 20
        };

        // AppContext.BaseDirectory 기준 경로 우선 — 병렬 테스트에서 CWD가 가변이라 GetCurrentDirectory는 후순위
        var searchPaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "scripts", "negative_phonetic_patterns.json"),
            Path.Combine(AppContext.BaseDirectory, "negative_phonetic_patterns.json"),
            // BaseDirectory에서 위로 올라가 프로젝트 루트의 scripts/ 디렉토리 (개발 환경 폴백)
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "scripts", "negative_phonetic_patterns.json")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "scripts", "negative_phonetic_patterns.json")),
            // 최종 폴백 — 현재 작업 디렉토리
            Path.Combine(Directory.GetCurrentDirectory(), "scripts", "negative_phonetic_patterns.json"),
        };

        var patternsPath = searchPaths.FirstOrDefault(File.Exists);

        if (patternsPath == null)
        {
            // 기본값 사용
            InitializeDefaultPatterns();
            return;
        }

        try
        {
            var jsonContent = File.ReadAllText(patternsPath, System.Text.Encoding.UTF8);
            // JSON은 snake_case, C# 클래스는 PascalCase — naming policy로 매핑
            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
                PropertyNameCaseInsensitive = true,
            };
            var jsonData = JsonSerializer.Deserialize<JsonNegativePatternData>(jsonContent, options);

            if (jsonData?.NegativeSyllables != null)
            {
                _data.HighPenaltySyllables = new HashSet<string>(jsonData.NegativeSyllables.HighPenalty ?? new List<string>());
                _data.MediumPenaltySyllables = new HashSet<string>(jsonData.NegativeSyllables.MediumPenalty ?? new List<string>());
                _data.NegativeCombinations = jsonData.NegativeSyllables.NegativeCombinations ?? new List<NegativeCombination>();
            }

            if (jsonData?.NegativeWordPatterns != null)
            {
                _data.NegativeVerbsAndAdjectives = new HashSet<string>(jsonData.NegativeWordPatterns.VerbsAndAdjectives ?? new List<string>());
                _data.NegativePhrases = new HashSet<string>(jsonData.NegativeWordPatterns.NegativePhrases ?? new List<string>());
                _data.HomophoneNegative = jsonData.NegativeWordPatterns.HomophoneNegative?.Patterns ?? new List<HomophonePattern>();
                _data.MorphemePatterns = jsonData.NegativeWordPatterns.MorphemePatterns?.Patterns ?? new List<MorphemePattern>();
            }

            if (jsonData?.HarshConsonantPatterns != null)
            {
                _data.StrongPlosives = new HashSet<string>(jsonData.HarshConsonantPatterns.StrongPlosives ?? new List<string>());
                _data.ConsecutiveStrongPlosivesPenalty = jsonData.HarshConsonantPatterns.ConsecutiveStrongPlosives?.Penalty ?? 25;
                _data.SameConsonantRepetitionPenalty = jsonData.HarshConsonantPatterns.SameConsonantRepetition?.Penalty ?? 20;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"negative_phonetic_patterns.json 로드 실패: {ex.Message}. 기본값을 사용합니다.");
            InitializeDefaultPatterns();
        }
    }

    private static void InitializeDefaultPatterns()
    {
        _data!.HighPenaltySyllables = new HashSet<string> { "추", "허", "헐", "썩", "썰", "쓰", "쓸" };
        _data.MediumPenaltySyllables = new HashSet<string> { "궂", "궤", "궐" };
        _data.StrongPlosives = new HashSet<string> { "ㅊ", "ㄲ", "ㅋ", "ㅌ", "ㅍ" };
        _data.NegativeVerbsAndAdjectives = new HashSet<string> { "추하다", "허하다", "허탈하다", "추잡하다" };
        _data.NegativePhrases = new HashSet<string> { "허추", "추허", "허허", "추추" };
    }

    public class NegativePatternData
    {
        public HashSet<string> HighPenaltySyllables { get; set; } = new();
        public HashSet<string> MediumPenaltySyllables { get; set; } = new();
        public List<NegativeCombination> NegativeCombinations { get; set; } = new();
        public HashSet<string> NegativeVerbsAndAdjectives { get; set; } = new();
        public HashSet<string> NegativePhrases { get; set; } = new();
        public List<HomophonePattern> HomophoneNegative { get; set; } = new();
        public List<MorphemePattern> MorphemePatterns { get; set; } = new();
        public HashSet<string> StrongPlosives { get; set; } = new();
        public int ConsecutiveStrongPlosivesPenalty { get; set; } = 25;
        public int SameConsonantRepetitionPenalty { get; set; } = 20;
    }

    public class NegativeCombination
    {
        public string Pattern { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Penalty { get; set; }
    }

    public class HomophonePattern
    {
        public string Sound { get; set; } = string.Empty;
        public List<string> NegativeMeanings { get; set; } = new();
        public int Penalty { get; set; }
    }

    public class MorphemePattern
    {
        public string Pattern { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Penalty { get; set; }
        public List<string>? Examples { get; set; }
    }

    private class JsonNegativePatternData
    {
        public JsonNegativeSyllables? NegativeSyllables { get; set; }
        public JsonNegativeWordPatterns? NegativeWordPatterns { get; set; }
        public JsonHarshConsonantPatterns? HarshConsonantPatterns { get; set; }
    }

    private class JsonNegativeSyllables
    {
        public List<string>? HighPenalty { get; set; }
        public List<string>? MediumPenalty { get; set; }
        public List<NegativeCombination>? NegativeCombinations { get; set; }
    }

    private class JsonNegativeWordPatterns
    {
        public List<string>? VerbsAndAdjectives { get; set; }
        public List<string>? NegativePhrases { get; set; }
        public JsonHomophoneNegative? HomophoneNegative { get; set; }
        public JsonMorphemePatterns? MorphemePatterns { get; set; }
    }

    private class JsonHomophoneNegative
    {
        public List<HomophonePattern>? Patterns { get; set; }
    }

    private class JsonMorphemePatterns
    {
        public List<MorphemePattern>? Patterns { get; set; }
    }

    private class JsonHarshConsonantPatterns
    {
        public List<string>? StrongPlosives { get; set; }
        public JsonPenaltyInfo? ConsecutiveStrongPlosives { get; set; }
        public JsonPenaltyInfo? SameConsonantRepetition { get; set; }
    }

    private class JsonPenaltyInfo
    {
        public int Penalty { get; set; }
    }
}
