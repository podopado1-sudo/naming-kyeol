using System.Text.Json;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 이름의 사람 서사형 코이닝 한 문장(이름 → "어디에 있어도 은은하게 제 빛을 내는 사람").
/// data/name-stories.json = { "라영": "어디에 있어도 은은하게 제 빛을 내는 사람", ... }.
/// 창의 카드·/name SEO 페이지가 공유하는 선택적 강화 레이어 — 뜻(mean)과 별개 파일.
///
/// 생성 파이프라인(1회성):
///   1) `dotnet run -- dump-story-inputs story-inputs.json`
///      → 창의 뜻 보유 이름 ∪ /name 수록 이름의 {글로스, 기존 윤문 뜻} 덤프
///   2) `python scripts/build_name_stories.py --input story-inputs.json`
///      → Claude Batch API로 사람 서사형 문장 생성 → 이 파일 생성
///
/// 파일이 없으면(미생성) Get()이 null을 반환하고 소비처는 서사를 숨긴다(기계적 폴백 없음 —
/// Meaning과 달리 항상 표시되는 필드가 아니므로 조작된 폴백 서사를 만들지 않는다).
/// 스레드 안전: 최초 조회 시 1회 lazy 로딩(lock). CreativeMeaningData와 동일 패턴.
/// </summary>
public static class NameStoryData
{
    private static readonly object _lock = new();
    // volatile — 락 밖 첫 읽기에서 딕셔너리 적재 완료가 관측되도록 보장
    private static volatile bool _loaded;
    private static Dictionary<string, string> _stories = new();

    /// <summary>data/name-stories.json 로드 (idempotent). 파일 없으면 빈 상태 유지(숨김).</summary>
    public static void LoadExternalData()
    {
        lock (_lock)
        {
            if (_loaded) return;

            // 로컬에 완전히 적재한 뒤 필드에 할당하고, _loaded는 맨 마지막에 true로 둔다.
            // (CreativeMeaningData와 동일 — 락 밖 동시 리더가 빈 딕셔너리를 관측하는 레이스 방지)
            var path = ResolvePath("name-stories.json");
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
                        _stories = loaded;
                    }
                }
                catch
                {
                    // 파싱 실패 → 빈 상태(소비처는 서사 숨김)
                }
            }

            _loaded = true; // 실패해도 재시도 방지. 반드시 적재 후.
        }
    }

    /// <summary>이름의 서사 한 문장. 없으면 null(소비처가 숨김).</summary>
    public static string? Get(string name)
    {
        if (!_loaded) LoadExternalData();
        return _stories.TryGetValue(name, out var v) ? v : null;
    }

    /// <summary>로드된 서사 개수(테스트/진단용).</summary>
    public static int Count
    {
        get { if (!_loaded) LoadExternalData(); return _stories.Count; }
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
