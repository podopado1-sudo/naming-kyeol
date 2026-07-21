using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Serilog;
using NameForm.Api.Logging;
using NameForm.Api.Middleware;
using NameForm.Application.Engines;
using NameForm.Application.Services;
using NameForm.Domain.Models;
using NameForm.Infrastructure.Data;
using NameForm.Infrastructure.Repositories;

// Npgsql 6+ 부터 PostgreSQL timestamp with time zone에는 UTC DateTime만 허용.
// 기존 코드가 DateTime.Parse 등으로 Kind=Unspecified를 만들기 때문에 legacy 호환 모드 활성화.
// (코드 전체에서 DateTime.SpecifyKind(d, Utc)를 채워 넣는 대안보다 안전)
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

// 1회성 CLI: 창의 실명 풀의 기계적 글로스를 덤프(LLM 폴리시 파이프라인 1단계).
//   dotnet run -- dump-creative-glosses [outfile]
// 엔진의 BuildMechanicalMeaning을 그대로 재사용해 HanjaData·CommonNameHanja·불용한자
// 필터와 100% 일치하는 입력을 만든다. 웹 호스트는 띄우지 않고 종료한다.
if (args.Length >= 1 && args[0] == "dump-creative-glosses")
{
    NameForm.Application.Engines.Data.HanjaData.LoadExternalData();
    NameForm.Application.Engines.Data.NameGenderData.LoadExternalData();

    var dump = new Dictionary<string, string>();
    foreach (var (name, _, _) in NameForm.Application.Engines.Data.NameGenderData.DistinctiveNames())
    {
        if (name.Length != 2 || name[0] == name[1]) continue; // 실명 풀 생성과 동일 조건
        var gloss = NameForm.Application.Engines.CreativeNamingEngine.BuildMechanicalMeaning(name);
        if (!string.IsNullOrEmpty(gloss)) dump[name] = gloss;
    }

    var outPath = args.Length >= 2 ? args[1] : "creative-glosses.json";
    var json = System.Text.Json.JsonSerializer.Serialize(dump, new System.Text.Json.JsonSerializerOptions
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping // 한글 그대로
    });
    File.WriteAllText(outPath, json);
    Console.WriteLine($"[dump-creative-glosses] {dump.Count}개 글로스 → {outPath}");
    return;
}

// 1회성 CLI: /name SEO 페이지용 인기 이름의 기계적 글로스를 덤프(뜻 윤문 파이프라인 1단계).
//   dotnet run -- dump-name-glosses [names-json] [outfile]
// names-json(기본 frontend/src/data/name-seo.json)의 이름 전체를 dump-creative-glosses와
// 동일한 BuildMechanicalMeaning으로 처리한다. 이미 뜻이 있는 이름은 배치 단계의 --resume이
// 거르므로 여기선 전부 덤프해도 무방하다.
if (args.Length >= 1 && args[0] == "dump-name-glosses")
{
    NameForm.Application.Engines.Data.HanjaData.LoadExternalData();
    NameForm.Application.Engines.Data.NameGenderData.LoadExternalData();

    var namesPath = args.Length >= 2 ? args[1] : Path.Combine("frontend", "src", "data", "name-seo.json");
    if (!File.Exists(namesPath))
    {
        Console.Error.WriteLine($"[dump-name-glosses] 입력 파일 없음: {namesPath}");
        return;
    }

    using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(namesPath));
    var names = doc.RootElement.GetProperty("names").EnumerateObject().Select(p => p.Name);

    var dump = new Dictionary<string, string>();
    int skipped = 0;
    foreach (var name in names)
    {
        if (name.Length != 2 || name[0] == name[1]) { skipped++; continue; } // 2음절·중첩 아님만
        var gloss = NameForm.Application.Engines.CreativeNamingEngine.BuildMechanicalMeaning(name);
        if (!string.IsNullOrEmpty(gloss)) dump[name] = gloss; else skipped++;
    }

    var outPath = args.Length >= 3 ? args[2] : "name-glosses.json";
    var json = System.Text.Json.JsonSerializer.Serialize(dump, new System.Text.Json.JsonSerializerOptions
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    });
    File.WriteAllText(outPath, json);
    Console.WriteLine($"[dump-name-glosses] {dump.Count}개 글로스 → {outPath} (제외 {skipped})");
    return;
}

// 1회성 CLI: /name 페이지용 이름별 한자 '조합' 상위 K개를 덤프(작명사이트급 조합 카드 1단계).
//   dotnet run -- dump-name-combos [names-json] [outfile]
// HanjaSelector.SelectCombos(엔진의 빈출·오행조화·성별 로직)로 표시용 조합을 고른다.
// 출력 {이름:[["智","宇"],["志","宇"],...]} — 한자별 훈음/획수/오행/등급은 프론트가
// hanja-seo.json에서 조인하므로 여기선 글자만 덤프한다(데이터 중복 회피).
if (args.Length >= 1 && args[0] == "dump-name-combos")
{
    NameForm.Application.Engines.Data.HanjaData.LoadExternalData();
    NameForm.Application.Engines.Data.NameGenderData.LoadExternalData();

    var namesPath = args.Length >= 2 ? args[1] : Path.Combine("frontend", "src", "data", "name-seo.json");
    if (!File.Exists(namesPath))
    {
        Console.Error.WriteLine($"[dump-name-combos] 입력 파일 없음: {namesPath}");
        return;
    }

    using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(namesPath));
    var dump = new Dictionary<string, List<string[]>>();
    int skipped = 0;
    foreach (var prop in doc.RootElement.GetProperty("names").EnumerateObject())
    {
        var name = prop.Name;
        if (name.Length != 2 || name[0] == name[1]) { skipped++; continue; }

        // 성별: 60/40 분기(프론트 genderSplit과 동일). 애매하면 none으로 과제약 회피.
        int m = prop.Value.TryGetProperty("m", out var mv) ? mv.GetInt32() : 0;
        int f = prop.Value.TryGetProperty("f", out var fv) ? fv.GetInt32() : 0;
        int total = m + f;
        string gender = total > 0 && m * 100 / total >= 60 ? "male"
                      : total > 0 && f * 100 / total >= 60 ? "female" : "none";

        var combos = NameForm.Application.Engines.Utils.HanjaSelector.SelectCombos(name, gender, 4);
        if (combos.Count == 0) { skipped++; continue; }
        dump[name] = combos.Select(c => new[] { c.First, c.Second }).ToList();
    }

    var outPath = args.Length >= 3 ? args[2] : "name-combos.json";
    var json = System.Text.Json.JsonSerializer.Serialize(dump, new System.Text.Json.JsonSerializerOptions
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    });
    File.WriteAllText(outPath, json);
    Console.WriteLine($"[dump-name-combos] {dump.Count}개 이름 조합 → {outPath} (제외 {skipped})");
    return;
}

// 한자 조합의 자연어 뜻 윤문(phase 3)용 — combos의 고유 한자쌍마다 기계 글로스를 덤프한다.
// scripts/build_combo_meanings.py 가 이 파일을 Claude로 윤문해 data/combo-meanings.json 생성.
// 단위는 '한자쌍'(智宇) — 이름 무관·거의 유일이라 한 번 만들면 영구 재사용(런타임 LLM 0).
//   dotnet run -- dump-combo-glosses [names-json] [outfile]
if (args.Length >= 1 && args[0] == "dump-combo-glosses")
{
    NameForm.Application.Engines.Data.HanjaData.LoadExternalData();

    var namesPath = args.Length >= 2 ? args[1] : Path.Combine("frontend", "src", "data", "name-seo.json");
    if (!File.Exists(namesPath))
    {
        Console.Error.WriteLine($"[dump-combo-glosses] 입력 파일 없음: {namesPath}");
        return;
    }

    // 첫 훈음만 (다중 훈음 "슬기로울 지/지혜 지" → "슬기로울 지"). 프론트 firstGloss·C# CleanGloss와 동일.
    static string Clean(string m) =>
        string.IsNullOrWhiteSpace(m) ? "" : m.Split(',', '/', ';', '·')[0].Trim();

    using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(namesPath));
    var glosses = new Dictionary<string, string>();
    int skipped = 0;
    foreach (var prop in doc.RootElement.GetProperty("names").EnumerateObject())
    {
        if (!prop.Value.TryGetProperty("combos", out var combosEl)) continue;
        foreach (var combo in combosEl.EnumerateArray())
        {
            if (combo.GetArrayLength() != 2) continue;
            var c1 = combo[0].GetString() ?? "";
            var c2 = combo[1].GetString() ?? "";
            var key = c1 + c2;
            if (key.Length != 2 || glosses.ContainsKey(key)) continue;

            var g1 = Clean(NameForm.Application.Engines.Data.HanjaData.FindByCharacter(c1)?.Meaning ?? "");
            var g2 = Clean(NameForm.Application.Engines.Data.HanjaData.FindByCharacter(c2)?.Meaning ?? "");
            if (g1.Length == 0 || g2.Length == 0) { skipped++; continue; }
            glosses[key] = $"{c1}({g1}) + {c2}({g2})";
        }
    }

    var outPath = args.Length >= 3 ? args[2] : "combo-glosses.json";
    var json = System.Text.Json.JsonSerializer.Serialize(glosses, new System.Text.Json.JsonSerializerOptions
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    });
    File.WriteAllText(outPath, json);
    Console.WriteLine($"[dump-combo-glosses] 고유 한자쌍 {glosses.Count}개 → {outPath} (제외 {skipped})");
    return;
}

// 1회성 CLI: /name SEO 페이지용 이름별 미학 점수 breakdown 덤프.
//   dotnet run -- dump-name-scores [names-json] [outfile]
// AestheticEngine을 lastName=null·tone="neutral"(톤 보너스 0)·60/40 성별 분기로 호출한
// "성씨 제외·세대 중립 관점" 점수. 유행 이름 감점은 브랜드 철학(유행 배제) 그대로 노출한다.
// combos와 달리 3음절·중첩 이름도 전부 채점한다(엔진이 모두 처리 가능).
if (args.Length >= 1 && args[0] == "dump-name-scores")
{
    NameForm.Application.Engines.Data.HanjaData.LoadExternalData();
    NameForm.Application.Engines.Data.NameGenderData.LoadExternalData();

    var namesPath = args.Length >= 2 ? args[1] : Path.Combine("frontend", "src", "data", "name-seo.json");
    if (!File.Exists(namesPath))
    {
        Console.Error.WriteLine($"[dump-name-scores] 입력 파일 없음: {namesPath}");
        return;
    }

    // 엔진 노트는 내부용이라 "male와"처럼 영문이 섞임 — 공개 페이지용으로만 치환(/evaluate 경로 무변경).
    // female가 male을 포함하므로 female 먼저 치환.
    static string PublicNote(string note) => note
        .Replace("female와", "여자 이름과")
        .Replace("male와", "남자 이름과");

    var engine = new AestheticEngine();
    using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(namesPath));
    var dump = new Dictionary<string, Dictionary<string, object>>();
    foreach (var prop in doc.RootElement.GetProperty("names").EnumerateObject())
    {
        var name = prop.Name;

        // 성별: 60/40 분기(프론트 genderSplit·dump-name-combos와 동일).
        int m = prop.Value.TryGetProperty("m", out var mv) ? mv.GetInt32() : 0;
        int f = prop.Value.TryGetProperty("f", out var fv) ? fv.GetInt32() : 0;
        int total = m + f;
        string gender = total > 0 && m * 100 / total >= 60 ? "male"
                      : total > 0 && f * 100 / total >= 60 ? "female" : "none";

        var b = await engine.CalculateScoreWithBreakdownAsync(name, null, "neutral", gender);
        var rec = new Dictionary<string, object>
        {
            ["p"] = b.PronunciationScore,
            ["r"] = b.RhythmScore,
            ["s"] = b.SyllableScore,
            ["n"] = b.NeutralityScore,
            ["m"] = b.MeaningScore,
            ["t"] = b.TotalScore,
        };
        if (b.GenderBonus != 0) rec["g"] = b.GenderBonus;
        if (b.PenaltyTotal != 0) rec["pn"] = b.PenaltyTotal;
        if (b.Notes.Count > 0) rec["no"] = b.Notes.Select(PublicNote).ToList();
        dump[name] = rec;
    }

    var outPath = args.Length >= 3 ? args[2] : "name-scores.json";
    var json = System.Text.Json.JsonSerializer.Serialize(dump, new System.Text.Json.JsonSerializerOptions
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    });
    File.WriteAllText(outPath, json);
    Console.WriteLine($"[dump-name-scores] {dump.Count}개 이름 점수 → {outPath}");
    return;
}

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(new ConfigurationBuilder()
        .AddJsonFile("appsettings.json", optional: true)
        .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"}.json", optional: true)
        .Build())
    .Enrich.FromLogContext()
    .Destructure.With<PiiMaskingPolicy>() // 개인정보(이름·출생일·이메일) 자동 마스킹
    .WriteTo.Console()
    .WriteTo.File(
        "logs/nameform-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        fileSizeLimitBytes: 50 * 1024 * 1024, // 일별 50MB 제한 (트래픽 폭주 시 디스크 보호)
        rollOnFileSizeLimit: true)
    .CreateLogger();

try
{

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// CORS 설정
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? new[] { "http://localhost:3000", "https://localhost:3000" };

        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── Rate Limiting (봇/스크래퍼/스팸 호출 방어) ─────────────────────────
//
// 기본 정책: IP당 분당 60회, 시간당 600회 (사람이 쓰기엔 충분, 봇은 차단)
// 비싼 정책("expensive"): 추천/평가/분석 API 등 CPU 큰 작업 — 분당 20회, 시간당 200회
//
// 사용법:
//   - 컨트롤러/액션에 [EnableRateLimiting("expensive")] 부여
//   - 전체 endpoint는 기본(Global) 정책 자동 적용
//
// 초과 시 429 Too Many Requests 응답 + Retry-After 헤더
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.Headers["Retry-After"] = "60";
        await context.HttpContext.Response.WriteAsync(
            "{\"error\":\"요청이 너무 많습니다. 잠시 후 다시 시도해주세요.\"}",
            cancellationToken);
    };

    // 전역 정책 — IP당 분당 60회
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 60,
            Window = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0,
        });
    });

    // "expensive" 정책 — 비싼 API용. IP당 분당 20회 + 시간당 200회 (이중 제한)
    options.AddPolicy("expensive", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetSlidingWindowLimiter(ip, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromMinutes(1),
            SegmentsPerWindow = 6,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0,
        });
    });
});

// Database 설정
// 환경변수 우선순위: DATABASE_URL > ConnectionStrings__DefaultConnection > 기본 SQLite
// Render/Heroku 등 PaaS는 보통 DATABASE_URL을 postgresql://user:pass@host:port/db 형태로 주입
var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=nameform.db";

// PostgreSQL URI 형식(postgresql:// 또는 postgres://)을 Npgsql 형식으로 자동 변환
// 예: postgresql://user:pass@host:6543/db → Host=host;Port=6543;Database=db;Username=user;Password=pass;...
if (connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
    || connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
{
    var uri = new Uri(connectionString);
    var userInfo = uri.UserInfo.Split(':', 2);
    var username = Uri.UnescapeDataString(userInfo[0]);
    var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
    var database = uri.AbsolutePath.TrimStart('/');
    var port = uri.Port > 0 ? uri.Port : 5432;

    connectionString =
        $"Host={uri.Host};Port={port};Database={database};Username={username};Password={password};" +
        // Supabase/PaaS는 대부분 SSL 필수. Trust Server Certificate=true는 자체서명 인증서 허용
        "SSL Mode=Require;Trust Server Certificate=true";
}

if (connectionString.StartsWith("Host=") || connectionString.StartsWith("Server="))
{
    // PostgreSQL (프로덕션 — Supabase/Neon/Render PG 등)
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(connectionString));
}
else
{
    // SQLite (개발)
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlite(connectionString));
}

// Register services
builder.Services.AddScoped<IRecommendationService, RecommendationService>();
builder.Services.AddScoped<IRecommendationRepository, EfRecommendationRepository>();

// Register engines
builder.Services.AddScoped<INamePoolEngine, NamePoolEngine>();
builder.Services.AddScoped<IAestheticEngine, AestheticEngine>();
builder.Services.AddScoped<IHarmonyEngine, HarmonyEngine>();
builder.Services.AddScoped<IRankerEngine, RankerEngine>();
builder.Services.AddScoped<IExplanationEngine, ExplanationEngine>();
builder.Services.AddScoped<IParentBasedNamingEngine, ParentBasedNamingEngine>();
builder.Services.AddScoped<IRarityScoringEngine, RarityScoringEngine>();
builder.Services.AddScoped<INameReversalEngine, NameReversalEngine>();
builder.Services.AddScoped<INameAnalysisService, NameAnalysisService>();
builder.Services.AddScoped<ISajuCalculationService, SajuCalculationService>();
builder.Services.AddScoped<IYongshinCalculationService, YongshinCalculationService>();
builder.Services.AddScoped<ITwinNameEngine, TwinNameEngine>();
builder.Services.AddScoped<ITwinNameService, TwinNameService>();
builder.Services.AddScoped<IDualNameEngine, DualNameEngine>();
builder.Services.AddScoped<IRequiredCharEngine, RequiredCharEngine>();
builder.Services.AddScoped<IPureKoreanNameEngine, PureKoreanNameEngine>();
builder.Services.AddScoped<IRareSurnameEngine, RareSurnameEngine>();
builder.Services.AddScoped<IThreeSyllableEngine, ThreeSyllableEngine>();
builder.Services.AddScoped<ICreativeNamingEngine, CreativeNamingEngine>();
builder.Services.AddScoped<ISmartRecommendationService, SmartRecommendationService>();
builder.Services.AddScoped<INameEvaluationService, NameEvaluationService>();
builder.Services.AddScoped<IScoringService, ScoringService>();
builder.Services.AddScoped<IUsageTracker, EfUsageTracker>();

var app = builder.Build();

// ── DB 스키마 초기화 (운영 환경 견고화) ────────────────────────────────
// 첫 부팅 시 EnsureCreated가 silent fail하는 케이스 방지:
// 1. EnsureCreated 호출 → 결과 로깅
// 2. 핵심 테이블(Recommendations) 존재 여부 직접 확인
// 3. 없으면 GenerateCreateScript()로 SQL 추출 후 강제 실행
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var initLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        initLogger.LogInformation("DB 초기화 시작: connection 검증 중...");
        var canConnect = dbContext.Database.CanConnect();
        initLogger.LogInformation("DB 연결 가능 여부: {CanConnect}", canConnect);

        if (!canConnect)
        {
            initLogger.LogWarning("DB 연결 실패 — connection string 확인 필요");
        }
        else
        {
            initLogger.LogInformation("DB EnsureCreated 호출...");
            var created = dbContext.Database.EnsureCreated();
            initLogger.LogInformation("EnsureCreated 결과: {Created} (true=새로 생성, false=이미 존재 또는 일부만 존재)", created);

            // 검증: 핵심 테이블이 실제로 존재하는지 직접 쿼리
            bool recommendationsExists = false;
            try
            {
                // SELECT 1 FROM "Recommendations" LIMIT 0 — 테이블이 있으면 성공, 없으면 예외
                dbContext.Database.ExecuteSqlRaw("SELECT 1 FROM \"Recommendations\" LIMIT 0");
                recommendationsExists = true;
                initLogger.LogInformation("Recommendations 테이블 존재 확인 OK");
            }
            catch (Exception ex)
            {
                initLogger.LogWarning("Recommendations 테이블 미존재 — 강제 생성 시도. ({Error})", ex.Message);
            }

            if (!recommendationsExists)
            {
                // GenerateCreateScript로 SQL 추출 후 직접 실행
                var script = dbContext.Database.GenerateCreateScript();
                initLogger.LogInformation("강제 스키마 생성 SQL 실행 (길이: {Len} chars)", script.Length);
                try
                {
                    dbContext.Database.ExecuteSqlRaw(script);
                    initLogger.LogInformation("강제 스키마 생성 성공");
                }
                catch (Exception ex)
                {
                    // 일부 객체가 이미 존재해서 부분 실패해도 무시 (CREATE TABLE IF NOT EXISTS 아닌 경우)
                    initLogger.LogWarning("강제 스키마 생성 중 일부 충돌 (이미 존재하는 객체일 수 있음): {Error}", ex.Message);
                }
            }
        }
    }
    catch (Exception ex)
    {
        initLogger.LogError(ex, "DB 초기화 실패");
        // 운영에서 DB 없이도 일단 부팅은 시키되 로그로 명확히 표시
    }
}

// UsageEvents 테이블 — 기존 DB에 추가되는 테이블이므로 EnsureCreated가 못 만듦.
// CREATE TABLE IF NOT EXISTS로 멱등 생성 (SQLite/PostgreSQL 모두 지원 문법)
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var initLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var isNpgsql = dbContext.Database.ProviderName?.Contains("Npgsql") == true;
        var createUsageTable = isNpgsql
            ? """
              CREATE TABLE IF NOT EXISTS "UsageEvents" (
                  "Id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                  "EventType" VARCHAR(30) NOT NULL,
                  "Key" VARCHAR(40) NOT NULL,
                  "CreatedAt" TIMESTAMP NOT NULL
              );
              CREATE INDEX IF NOT EXISTS "IX_UsageEvents_CreatedAt" ON "UsageEvents" ("CreatedAt");
              """
            : """
              CREATE TABLE IF NOT EXISTS "UsageEvents" (
                  "Id" INTEGER PRIMARY KEY AUTOINCREMENT,
                  "EventType" TEXT NOT NULL,
                  "Key" TEXT NOT NULL,
                  "CreatedAt" TEXT NOT NULL
              );
              CREATE INDEX IF NOT EXISTS "IX_UsageEvents_CreatedAt" ON "UsageEvents" ("CreatedAt");
              """;
        dbContext.Database.ExecuteSqlRaw(createUsageTable);
        initLogger.LogInformation("UsageEvents 테이블 확인/생성 완료");
    }
    catch (Exception ex)
    {
        initLogger.LogWarning("UsageEvents 테이블 생성 실패 — 사용량 집계 비활성: {Error}", ex.Message);
    }
}

// orphan 컬럼 정리 — Recommendations.BonusNicknames (2026-06-23 NicknameEngine 제거).
// EnsureCreated는 기존 스키마를 못 바꾸므로, NOT NULL 컬럼이 남으면 INSERT가 깨진다
// (EF가 매핑 해제된 컬럼에 값을 안 줌 → NOT NULL 위반 → 추천 저장 실패 → standard 탭 누락).
// 멱등 DROP COLUMN으로 정리. 배포 1회 정착 후 제거해도 무방.
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var initLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var isNpgsql = dbContext.Database.ProviderName?.Contains("Npgsql") == true;
    try
    {
        // PostgreSQL은 IF EXISTS로 멱등. SQLite는 DROP COLUMN IF EXISTS 미지원이라
        // 컬럼이 이미 없으면 throw → catch로 무시(정상 경로).
        dbContext.Database.ExecuteSqlRaw(isNpgsql
            ? "ALTER TABLE \"Recommendations\" DROP COLUMN IF EXISTS \"BonusNicknames\";"
            : "ALTER TABLE \"Recommendations\" DROP COLUMN \"BonusNicknames\";");
        initLogger.LogInformation("orphan BonusNicknames 컬럼 정리 완료");
    }
    catch (Exception ex)
    {
        // 이미 제거됨(SQLite 재부팅 등) — 정상
        initLogger.LogDebug("BonusNicknames 컬럼 정리 스킵(이미 없음): {Error}", ex.Message);
    }
}

// 한자 데이터 초기화 (통합 JSON 파일 로드)
NameForm.Application.Engines.Data.HanjaData.LoadExternalData();

// 실명 성별 빈도 통계 초기화 (성별 적합 판정용)
NameForm.Application.Engines.Data.NameGenderData.LoadExternalData();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseSecurityHeaders(); // 모든 응답에 보안 헤더 부착 (CSP/HSTS/X-Frame-Options 등)
app.UseCors("AllowFrontend");
app.UseRateLimiter(); // CORS 다음, 인증 전 — 인증 실패 시도도 카운트됨
app.UseApiKeyAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

}
catch (Exception ex)
{
    Log.Fatal(ex, "애플리케이션 시작 실패");
}
finally
{
    Log.CloseAndFlush();
}
