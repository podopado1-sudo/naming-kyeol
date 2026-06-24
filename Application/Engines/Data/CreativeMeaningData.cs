using System.Text.Json;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 창의 작명 실명 풀의 LLM 폴리시 뜻 풀이(이름 → 자연어 뜻 한 줄).
/// data/creative-name-meanings.json = { "라영": "빛나고 영명한", ... }.
///
/// 생성 파이프라인(1회성):
///   1) `dotnet run -- dump-creative-glosses creative-glosses.json`
///      → 엔진의 기계적 글로스("맑을 윤 + 슬기 슬")를 전 실명 풀에 대해 덤프
///   2) `python scripts/build_creative_meanings.py --input creative-glosses.json`
///      → Claude Batch API로 자연어 윤문 → 이 파일 생성
///
/// 파일이 없으면(미생성) Get()이 null을 반환하고 엔진은 기계적 글로스로 폴백한다.
/// 스레드 안전: 최초 조회 시 1회 lazy 로딩(lock). NameGenderData와 동일 패턴.
/// </summary>
public static class CreativeMeaningData
{
    private static readonly object _lock = new();
    // volatile — 락 밖 첫 읽기에서 딕셔너리 적재 완료가 관측되도록 보장
    private static volatile bool _loaded;
    private static Dictionary<string, string> _meanings = new();

    /// <summary>data/creative-name-meanings.json 로드 (idempotent). 파일 없으면 빈 상태 유지(폴백).</summary>
    public static void LoadExternalData()
    {
        lock (_lock)
        {
            if (_loaded) return;

            // 로컬에 완전히 적재한 뒤 필드에 할당하고, _loaded는 맨 마지막에 true로 둔다.
            // (NameGenderData와 동일 — 락 밖 동시 리더가 빈 딕셔너리를 관측하는 레이스 방지)
            var path = ResolvePath("creative-name-meanings.json");
            if (path != null)
            {
                try
                {
                    using var doc = JsonDocument.Parse(File.ReadAllText(path));
                    var root = doc.RootElement;
                    if (root.ValueKind == JsonValueKind.Object)
                    {
                        var loaded = new Dictionary<string, string>();
                        foreach (var p in root.EnumerateObject())
                        {
                            if (p.Value.ValueKind == JsonValueKind.String)
                            {
                                var v = p.Value.GetString();
                                if (!string.IsNullOrWhiteSpace(v))
                                    loaded[p.Name] = v.Trim();
                            }
                        }
                        _meanings = loaded;
                    }
                }
                catch
                {
                    // 파싱 실패 → 빈 상태(엔진은 기계적 글로스로 폴백)
                }
            }

            _loaded = true; // 실패해도 재시도 방지. 반드시 적재 후.
        }
    }

    /// <summary>이름의 폴리시 뜻. 없으면 null(엔진이 기계적 글로스로 폴백).</summary>
    public static string? Get(string name)
    {
        if (!_loaded) LoadExternalData();
        return _meanings.TryGetValue(name, out var v) ? v : null;
    }

    /// <summary>로드된 폴리시 뜻 개수(테스트/진단용).</summary>
    public static int Count
    {
        get { if (!_loaded) LoadExternalData(); return _meanings.Count; }
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
}
