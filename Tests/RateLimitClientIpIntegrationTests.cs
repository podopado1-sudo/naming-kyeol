using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NameForm.Tests;

/// <summary>
/// Program.cs 의 실제 파이프라인(미들웨어 순서 포함)을 띄워 리미터 버킷이 방문자별로 갈리는지 본다.
///
/// 운영 경로 흉내: 직전 홉 = Render 프록시 사설 주소, 방문자 주소 = Cloudflare 가 적는 CF-Connecting-IP.
/// 2026-11-19 전에는 RemoteIpAddress(= 프록시 주소)로 버킷을 잡아 전 방문자가 한 버킷이었다 —
/// app.UseClientIpForwarding() 를 빼거나 UseRateLimiter 뒤로 옮기면 *_SeparateBuckets 가 실패한다.
///
/// 테스트마다 다른 방문자 주소를 쓴다(같은 호스트·같은 리미터를 공유). 주소는 문서용 대역만.
/// </summary>
public class RateLimitClientIpIntegrationTests : IClassFixture<RateLimitAppFactory>
{
    private const int GlobalLimit = 60;     // Program.cs 전역 정책 — IP당 분당 60회
    private const int ExpensiveLimit = 20;  // "expensive" 정책 — IP당 분당 20회

    private const string RenderProxy = "10.21.157.68";
    private const string AnyPath = "/__ratelimit-check";                          // 엔드포인트 없음 — 전역 리미터만 거친다
    private const string ExpensivePath = "/api/v1/recommendations/hanja-stats";   // [EnableRateLimiting("expensive")]

    private readonly RateLimitAppFactory _factory;

    public RateLimitClientIpIntegrationTests(RateLimitAppFactory factory) => _factory = factory;

    [Fact]
    public async Task Global_TwoForwardedClients_SeparateBuckets()
    {
        const string visitorA = "203.0.113.11", visitorB = "203.0.113.12";

        for (var i = 0; i < GlobalLimit; i++)
            Assert.NotEqual(429, await SendAsync(AnyPath, RenderProxy, ("CF-Connecting-IP", visitorA)));

        Assert.Equal(429, await SendAsync(AnyPath, RenderProxy, ("CF-Connecting-IP", visitorA)));
        // 같은 프록시를 거쳐 온 다른 방문자는 막히지 않는다.
        Assert.NotEqual(429, await SendAsync(AnyPath, RenderProxy, ("CF-Connecting-IP", visitorB)));
    }

    [Fact]
    public async Task Expensive_TwoForwardedClients_SeparateBuckets()
    {
        const string visitorA = "203.0.113.21", visitorB = "203.0.113.22";

        for (var i = 0; i < ExpensiveLimit; i++)
            Assert.Equal(200, await SendAsync(ExpensivePath, RenderProxy, ("CF-Connecting-IP", visitorA)));

        Assert.Equal(429, await SendAsync(ExpensivePath, RenderProxy, ("CF-Connecting-IP", visitorA)));
        Assert.Equal(200, await SendAsync(ExpensivePath, RenderProxy, ("CF-Connecting-IP", visitorB)));
    }

    [Fact]
    public async Task UntrustedPeer_CannotSwitchBucketWithHeader()
    {
        // 프록시를 거치지 않은(신뢰 대역 밖) 상대가 헤더를 바꿔 가며 보내도 한 버킷이다.
        const string directPeer = "198.51.100.50";

        for (var i = 0; i < GlobalLimit; i++)
            Assert.NotEqual(429, await SendAsync(AnyPath, directPeer, ("CF-Connecting-IP", $"203.0.113.{100 + i}")));

        Assert.Equal(429, await SendAsync(AnyPath, directPeer, ("CF-Connecting-IP", "203.0.113.250")));
    }

    [Fact]
    public async Task ForgedXForwardedFor_CannotSwitchBucket()
    {
        // 방문자가 X-Forwarded-For 를 지어 보내도(Cloudflare·Render 는 덧붙이기만 한다) 버킷은 CF-Connecting-IP 로 정해진다.
        const string visitor = "203.0.113.31";

        for (var i = 0; i < GlobalLimit; i++)
            Assert.NotEqual(429, await SendAsync(AnyPath, RenderProxy,
                ("X-Forwarded-For", $"192.0.2.{i + 1}, {visitor}, 104.16.0.1"), ("CF-Connecting-IP", visitor)));

        Assert.Equal(429, await SendAsync(AnyPath, RenderProxy,
            ("X-Forwarded-For", $"192.0.2.200, {visitor}, 104.16.0.1"), ("CF-Connecting-IP", visitor)));
    }

    [Fact]
    public async Task HeaderMissing_FallsBackToPeerBucket()
    {
        // 헤더가 없으면 예전 동작 — 직전 홉 주소로 집계(되돌아갈 뿐, 더 나빠지지 않는다).
        const string otherProxy = "10.99.0.2";

        for (var i = 0; i < GlobalLimit; i++)
            Assert.NotEqual(429, await SendAsync(AnyPath, otherProxy));

        Assert.Equal(429, await SendAsync(AnyPath, otherProxy));
    }

    [Fact]
    public async Task Ipv6_SameSlash64_SharesBucket_OtherSlash64DoesNot()
    {
        // 한 회선(/64) 안에서 주소를 바꿔 가며 보내도 한 버킷.
        for (var i = 0; i < GlobalLimit; i++)
            Assert.NotEqual(429, await SendAsync(AnyPath, RenderProxy, ("CF-Connecting-IP", $"2001:db8:aa:bb::{i + 1:x}")));

        Assert.Equal(429, await SendAsync(AnyPath, RenderProxy, ("CF-Connecting-IP", "2001:db8:aa:bb:1234:5678:9abc:def0")));
        Assert.NotEqual(429, await SendAsync(AnyPath, RenderProxy, ("CF-Connecting-IP", "2001:db8:aa:cc::1")));
    }

    private async Task<int> SendAsync(string path, string peer, params (string Name, string Value)[] headers)
    {
        var context = await _factory.Server.SendAsync(c =>
        {
            c.Request.Method = HttpMethods.Get;
            c.Request.Scheme = "https"; // UseHttpsRedirection 이 끼어들지 않게
            c.Request.Host = new HostString("localhost");
            c.Request.Path = path;
            c.Connection.RemoteIpAddress = IPAddress.Parse(peer); // 직전 홉(TCP 상대)
            foreach (var (name, value) in headers) c.Request.Headers[name] = value;
        });
        return context.Response.StatusCode;
    }
}

/// <summary>
/// Program.cs 를 그대로 띄우는 호스트. DB 는 임시 SQLite 파일만 쓴다.
/// Program.cs 가 연결 문자열을 Build 전에 읽어서 ConfigureAppConfiguration 으로는 늦다 — 호스트가 뜨는 동안만
/// 환경변수로 주고 바로 되돌린다. DATABASE_URL(운영 DB 주소)이 개발 PC 에 잡혀 있어도 이 테스트는 쓰지 않는다.
/// </summary>
public sealed class RateLimitAppFactory : WebApplicationFactory<Program>
{
    private const string DatabaseUrlVar = "DATABASE_URL";
    private const string ConnectionVar = "ConnectionStrings__DefaultConnection";

    private readonly string _dbPath =
        Path.Combine(Path.GetTempPath(), $"nameform-ratelimit-test-{Guid.NewGuid():N}.db");

    public RateLimitAppFactory()
    {
        var savedDatabaseUrl = Environment.GetEnvironmentVariable(DatabaseUrlVar);
        var savedConnection = Environment.GetEnvironmentVariable(ConnectionVar);
        try
        {
            Environment.SetEnvironmentVariable(DatabaseUrlVar, null);
            Environment.SetEnvironmentVariable(ConnectionVar, $"Data Source={_dbPath}");
            _ = Server; // 여기서 Program.cs 가 끝까지 돈다(환경변수를 읽는 시점)
        }
        finally
        {
            Environment.SetEnvironmentVariable(DatabaseUrlVar, savedDatabaseUrl);
            Environment.SetEnvironmentVariable(ConnectionVar, savedConnection);
        }
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing) return;

        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        foreach (var file in new[] { _dbPath, _dbPath + "-shm", _dbPath + "-wal" })
        {
            try { File.Delete(file); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }
}
