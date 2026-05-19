namespace NameForm.Api.Middleware;

/// <summary>
/// API 키 인증 미들웨어
/// X-Api-Key 헤더로 API 키를 전달받아 검증
/// Development 환경에서는 비활성화 가능 (설정에 따라)
/// </summary>
public class ApiKeyMiddleware
{
    private const string ApiKeyHeaderName = "X-Api-Key";
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiKeyMiddleware> _logger;

    public ApiKeyMiddleware(RequestDelegate next, ILogger<ApiKeyMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Swagger UI는 인증 없이 접근 가능
        var path = context.Request.Path.Value ?? "";
        if (path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // API 경로가 아니면 통과
        if (!path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var configuration = context.RequestServices.GetRequiredService<IConfiguration>();

        // API 키 인증 비활성화 설정 확인
        var authEnabled = configuration.GetValue<bool>("Authentication:Enabled", true);
        if (!authEnabled)
        {
            await _next(context);
            return;
        }

        // API 키 헤더 확인
        if (!context.Request.Headers.TryGetValue(ApiKeyHeaderName, out var providedApiKey))
        {
            _logger.LogWarning("API 키 누락: {Path} from {RemoteIp}",
                path, context.Connection.RemoteIpAddress);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new { error = "API 키가 필요합니다. X-Api-Key 헤더를 포함해주세요." });
            return;
        }

        // 설정된 API 키와 비교
        var validApiKeys = configuration.GetSection("Authentication:ApiKeys").Get<string[]>() ?? [];
        if (validApiKeys.Length == 0)
        {
            _logger.LogError("API 키가 설정되지 않았습니다. appsettings.json의 Authentication:ApiKeys를 확인하세요.");
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new { error = "서버 인증 설정 오류" });
            return;
        }

        if (!validApiKeys.Contains(providedApiKey.ToString()))
        {
            _logger.LogWarning("잘못된 API 키 사용 시도: {Path} from {RemoteIp}",
                path, context.Connection.RemoteIpAddress);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new { error = "유효하지 않은 API 키입니다." });
            return;
        }

        await _next(context);
    }
}

/// <summary>
/// 미들웨어 등록 확장 메서드
/// </summary>
public static class ApiKeyMiddlewareExtensions
{
    public static IApplicationBuilder UseApiKeyAuthentication(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<ApiKeyMiddleware>();
    }
}
