namespace NameForm.Api.Middleware;

/// <summary>
/// HTTP 보안 헤더 미들웨어
///
/// 브라우저에 보안 정책을 명시해 XSS / Clickjacking / MIME sniffing / 정보 누설 등 일반 공격 표면을 차단.
/// API 응답 + Swagger UI 모두에 적용된다.
///
/// 적용 헤더:
/// - X-Content-Type-Options: MIME sniffing 차단
/// - X-Frame-Options: iframe 임베드 차단 (clickjacking 방어)
/// - Referrer-Policy: 외부 사이트로 가는 리퍼러 최소 노출
/// - Permissions-Policy: 카메라/마이크/위치/결제 권한 차단 (API는 어차피 안 씀)
/// - Strict-Transport-Security: HTTPS 강제 (HSTS) — 운영 환경에서만
/// - Content-Security-Policy: API는 데이터 응답이라 default-src 'none'으로 잠금
/// - X-XSS-Protection: 구형 브라우저용 (최신은 CSP가 더 강력)
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _isProduction;

    public SecurityHeadersMiddleware(RequestDelegate next, IWebHostEnvironment env)
    {
        _next = next;
        _isProduction = env.IsProduction();
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        // 모든 환경 공통
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";
        headers["X-XSS-Protection"] = "0"; // CSP로 대체 (구버전 브라우저에서 비활성화 권장)

        // API 응답은 데이터 전용 — 가장 엄격한 CSP
        // Swagger UI 경로는 예외 (인라인 스크립트 필요)
        var path = context.Request.Path.Value ?? "";
        var isSwagger = path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase);

        if (!isSwagger)
        {
            headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
        }
        else
        {
            // Swagger는 자체 자산 로딩 필요
            headers["Content-Security-Policy"] =
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data:; " +
                "frame-ancestors 'none'";
        }

        // 운영 환경에서만 HSTS 적용 (로컬 개발 HTTPS 오류 방지)
        if (_isProduction)
        {
            // 1년 (31536000초), 서브도메인 포함, preload 가능 상태
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
        }

        // Server 헤더 제거 (정보 누설 방지)
        headers.Remove("Server");
        headers.Remove("X-Powered-By");

        await _next(context);
    }
}

public static class SecurityHeadersMiddlewareExtensions
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<SecurityHeadersMiddleware>();
    }
}
