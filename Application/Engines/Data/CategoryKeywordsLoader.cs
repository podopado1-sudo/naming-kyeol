using System.Text.Json;

namespace NameForm.Application.Engines.Data;

/// <summary>
/// 카테고리 키워드 설정 파일 로더
/// category_keywords.json 파일에서 카테고리 트리와 부수 힌트를 로드
/// </summary>
public static class CategoryKeywordsLoader
{
    private static Dictionary<string, Dictionary<string, List<string>>>? _categoryTree;
    private static Dictionary<string, string>? _radicalHints;
    private static Dictionary<string, List<string>>? _legacyCategoryKeywords;
    private static readonly object _lockObject = new object();

    /// <summary>
    /// 카테고리 트리 (major -> minor -> keywords)
    /// </summary>
    public static Dictionary<string, Dictionary<string, List<string>>> CategoryTree
    {
        get
        {
            if (_categoryTree == null)
            {
                lock (_lockObject)
                {
                    if (_categoryTree == null)
                    {
                        LoadKeywords();
                    }
                }
            }
            return _categoryTree!;
        }
    }

    /// <summary>
    /// 부수 힌트 매핑 (부수 -> major.minor)
    /// </summary>
    public static Dictionary<string, string> RadicalHints
    {
        get
        {
            if (_radicalHints == null)
            {
                lock (_lockObject)
                {
                    if (_radicalHints == null)
                    {
                        LoadKeywords();
                    }
                }
            }
            return _radicalHints!;
        }
    }

    /// <summary>
    /// 기존 카테고리 키워드 (하위 호환성)
    /// </summary>
    public static Dictionary<string, List<string>> LegacyCategoryKeywords
    {
        get
        {
            if (_legacyCategoryKeywords == null)
            {
                lock (_lockObject)
                {
                    if (_legacyCategoryKeywords == null)
                    {
                        LoadKeywords();
                    }
                }
            }
            return _legacyCategoryKeywords!;
        }
    }

    /// <summary>
    /// category_keywords.json 파일 로드
    /// </summary>
    private static void LoadKeywords()
    {
        _categoryTree = new Dictionary<string, Dictionary<string, List<string>>>();
        _radicalHints = new Dictionary<string, string>();
        _legacyCategoryKeywords = new Dictionary<string, List<string>>();

        var searchPaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "scripts", "category_keywords.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "scripts", "category_keywords.json"),
            Path.Combine(AppContext.BaseDirectory, "category_keywords.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "category_keywords.json"),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "scripts", "category_keywords.json"))
        };

        var keywordsPath = searchPaths.FirstOrDefault(File.Exists);

        if (keywordsPath == null)
        {
            // 기본값 사용 (하위 호환성)
            System.Diagnostics.Debug.WriteLine("경고: category_keywords.json 파일을 찾을 수 없습니다. 기본값을 사용합니다.");
            InitializeDefaultKeywords();
            return;
        }

        try
        {
            var jsonContent = File.ReadAllText(keywordsPath, System.Text.Encoding.UTF8);
            var data = JsonSerializer.Deserialize<CategoryKeywordsData>(jsonContent);

            if (data != null)
            {
                _categoryTree = data.category_tree ?? new Dictionary<string, Dictionary<string, List<string>>>();
                _radicalHints = data.radical_hints ?? new Dictionary<string, string>();
                
                // 기존 카테고리 키워드 로드
                if (data.legacy_category_keywords != null)
                {
                    foreach (var kvp in data.legacy_category_keywords)
                    {
                        _legacyCategoryKeywords[kvp.Key] = kvp.Value.keywords ?? new List<string>();
                    }
                }
            }
            else
            {
                InitializeDefaultKeywords();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"category_keywords.json 로드 실패: {ex.Message}. 기본값을 사용합니다.");
            InitializeDefaultKeywords();
        }
    }

    /// <summary>
    /// 기본 키워드 초기화 (하위 호환성)
    /// </summary>
    private static void InitializeDefaultKeywords()
    {
        // 기본값은 빈 딕셔너리로 설정
        // 실제 사용 시에는 기존 하드코딩된 키워드 리스트를 사용
        _categoryTree = new Dictionary<string, Dictionary<string, List<string>>>();
        _radicalHints = new Dictionary<string, string>();
        _legacyCategoryKeywords = new Dictionary<string, List<string>>();
    }

    /// <summary>
    /// category_keywords.json 파일의 데이터 구조
    /// </summary>
    private class CategoryKeywordsData
    {
        public Dictionary<string, Dictionary<string, List<string>>>? category_tree { get; set; }
        public Dictionary<string, string>? radical_hints { get; set; }
        public Dictionary<string, LegacyCategoryData>? legacy_category_keywords { get; set; }
    }

    private class LegacyCategoryData
    {
        public List<string>? keywords { get; set; }
    }
}
