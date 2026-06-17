using System.Text.Json;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 실명 성별 빈도 통계 (대법원 전자가족관계등록 출생신고 2008~2019 기반,
/// data/name-gender-stats.json). 빌드: scripts/build_name_gender_data.py
///
/// NamingPrinciples.EvalGenderSyllableFit가 수동 큐레이션 대신 이 통계로 성별 적합을
/// 판정한다. 끝음절/첫음절/이름 전체별 (남,여) 빈도를 보관하고, 표본 임계가 충족될 때만
/// 여아 비율을 반환(부족하면 null → 엔진은 중립 폴백).
///
/// 스레드 안전: 최초 조회 시 1회 lazy 로딩(lock). Program.cs에서 워밍업 호출 권장.
/// </summary>
public static class NameGenderData
{
    private static readonly object _lock = new();
    private static bool _loaded;

    private static Dictionary<string, (long m, long f)> _lastSyll = new();
    private static Dictionary<string, (long m, long f)> _firstSyll = new();
    private static Dictionary<string, (long m, long f)> _names = new();

    /// <summary>data/name-gender-stats.json 로드 (idempotent). 파일 없으면 빈 상태 유지.</summary>
    public static void LoadExternalData()
    {
        lock (_lock)
        {
            if (_loaded) return;
            _loaded = true; // 실패해도 재시도 방지 (빈 상태 = 중립 폴백)

            var path = ResolvePath("name-gender-stats.json");
            if (path == null) return;
            try
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(path));
                var root = doc.RootElement;
                _lastSyll = ParseSection(root, "lastSyllable");
                _firstSyll = ParseSection(root, "firstSyllable");
                _names = ParseSection(root, "names");
            }
            catch
            {
                // 파싱 실패 → 빈 상태(엔진은 중립 폴백)
            }
        }
    }

    private static Dictionary<string, (long m, long f)> ParseSection(JsonElement root, string key)
    {
        var d = new Dictionary<string, (long m, long f)>();
        if (root.TryGetProperty(key, out var sec) && sec.ValueKind == JsonValueKind.Object)
        {
            foreach (var p in sec.EnumerateObject())
            {
                long m = p.Value.TryGetProperty("m", out var me) ? me.GetInt64() : 0;
                long f = p.Value.TryGetProperty("f", out var fe) ? fe.GetInt64() : 0;
                d[p.Name] = (m, f);
            }
        }
        return d;
    }

    private static string? ResolvePath(string fileName)
    {
        var candidates = new List<string>();
        var execDir = AppContext.BaseDirectory;
        var currentDir = Directory.GetCurrentDirectory();
        candidates.Add(Path.Combine(execDir, "data", fileName));
        candidates.Add(Path.Combine(currentDir, "data", fileName));

        // 실행 디렉토리에서 위로 올라가며 data/<file> 탐색 (테스트 bin 등)
        var dir = new DirectoryInfo(execDir);
        for (int i = 0; i < 6 && dir != null; i++, dir = dir.Parent)
            candidates.Add(Path.Combine(dir.FullName, "data", fileName));

        foreach (var c in candidates)
            if (File.Exists(c)) return c;
        return null;
    }

    private static double? Ratio(Dictionary<string, (long m, long f)> dict, string key, long minTotal)
    {
        if (!_loaded) LoadExternalData();
        if (!dict.TryGetValue(key, out var v)) return null;
        long total = v.m + v.f;
        if (total < minTotal) return null;
        return (double)v.f / total;
    }

    /// <summary>이름 전체의 여아 비율(0~1). 표본 부족이면 null.</summary>
    public static double? FemaleRatioForName(string name, long minTotal = 20)
        => Ratio(_names, name, minTotal);

    /// <summary>이름 전체의 (남, 여) 등록 빈도. 표본 부족이면 null.
    /// 소수 성별 절대 사용량(양성 공용 정도) 판정에 사용.</summary>
    public static (long m, long f)? NameCounts(string name, long minTotal = 20)
    {
        if (!_loaded) LoadExternalData();
        if (!_names.TryGetValue(name, out var v)) return null;
        if (v.m + v.f < minTotal) return null;
        return v;
    }

    /// <summary>끝음절의 여아 비율(0~1). 표본 부족이면 null.</summary>
    public static double? FemaleRatioForLastSyllable(string syllable, long minTotal = 300)
        => Ratio(_lastSyll, syllable, minTotal);

    /// <summary>첫음절의 여아 비율(0~1). 표본 부족이면 null.</summary>
    public static double? FemaleRatioForFirstSyllable(string syllable, long minTotal = 300)
        => Ratio(_firstSyll, syllable, minTotal);

    /// <summary>통계가 로드되었는지 (테스트/진단용).</summary>
    public static bool HasData
    {
        get { if (!_loaded) LoadExternalData(); return _names.Count > 0; }
    }
}
