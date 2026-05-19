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
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=nameform.db";

if (connectionString.StartsWith("Host=") || connectionString.StartsWith("Server="))
{
    // PostgreSQL (프로덕션)
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
builder.Services.AddScoped<INicknameEngine, NicknameEngine>();
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

var app = builder.Build();

// DB 자동 마이그레이션 (개발 환경에서 편의용)
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.EnsureCreated();
}

// 한자 데이터 초기화 (통합 JSON 파일 로드)
NameForm.Application.Engines.Data.HanjaData.LoadExternalData();

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
