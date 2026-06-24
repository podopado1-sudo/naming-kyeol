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
    // volatile — 락 밖 첫 읽기(if (!_loaded))에서 딕셔너리 적재 완료가 관측되도록 보장
    private static volatile bool _loaded;

    private static Dictionary<string, (long m, long f)> _lastSyll = new();
    private static Dictionary<string, (long m, long f)> _firstSyll = new();
    private static Dictionary<string, (long m, long f)> _names = new();

    /// <summary>data/name-gender-stats.json 로드 (idempotent). 파일 없으면 빈 상태 유지.</summary>
    public static void LoadExternalData()
    {
        lock (_lock)
        {
            if (_loaded) return;

            // 로컬에 완전히 적재한 뒤 필드에 할당하고, _loaded는 맨 마지막에 true로 둔다.
            // (적재 전에 _loaded=true로 두면 락 밖 동시 리더가 빈 딕셔너리를 관측하는 레이스)
            var path = ResolvePath("name-gender-stats.json");
            if (path != null)
            {
                try
                {
                    using var doc = JsonDocument.Parse(File.ReadAllText(path));
                    var root = doc.RootElement;
                    var last = ParseSection(root, "lastSyllable");
                    var first = ParseSection(root, "firstSyllable");
                    var names = ParseSection(root, "names");
                    _lastSyll = last;
                    _firstSyll = first;
                    _names = names;
                }
                catch
                {
                    // 파싱 실패 → 빈 상태(엔진은 중립 폴백)
                }
            }

            _loaded = true; // 실패해도 재시도 방지 (빈 상태 = 중립 폴백). 반드시 적재 후.
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

    /// <summary>
    /// 창의 작명용 '희귀하지만 실제로 쓰인' 2음절 이름 풀.
    /// 빈도가 [minTotal, maxTotal) 구간 — 흔하지 않으나(개성) 별나지도 않은(검증된) 꼬리 —
    /// 인 실명을 반환한다. 부모가 실제 지은 이름이라 '좋음'이 검증되면서도 독창적인 후보 소스.
    /// </summary>
    public static IEnumerable<(string name, long m, long f)> DistinctiveNames(
        long minTotal = 100, long maxTotal = 2500)
    {
        if (!_loaded) LoadExternalData();
        foreach (var kv in _names)
        {
            if (kv.Key.Length != 2) continue;
            long total = kv.Value.m + kv.Value.f;
            if (total >= minTotal && total < maxTotal)
                yield return (kv.Key, kv.Value.m, kv.Value.f);
        }
    }

    /// <summary>통계가 로드되었는지 (테스트/진단용).</summary>
    public static bool HasData
    {
        get { if (!_loaded) LoadExternalData(); return _names.Count > 0; }
    }
}
