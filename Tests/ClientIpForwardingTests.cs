using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NameForm.Api.Middleware;

namespace NameForm.Tests;

/// <summary>
/// 프록시 뒤 방문자 IP 복원 규칙 (Api/Middleware/ClientIpForwarding.cs) — 호스트 없이 미들웨어만 돌린다.
/// 실제 파이프라인에서 버킷이 갈리는지는 RateLimitClientIpIntegrationTests 가 본다.
/// 주소는 문서용 대역(203.0.113.0/24 · 198.51.100.0/24 · 2001:db8::/32)만 쓴다.
/// </summary>
public class ClientIpForwardingTests
{
    private const string RenderProxy = "10.21.157.68"; // Render 프록시가 컨테이너에 붙는 사설 주소 꼴
    private const string Visitor = "203.0.113.7";

    // ── 신뢰 규칙 ───────────────────────────────────────────────────────

    [Theory]
    [InlineData("10.21.157.68")]         // 사설망 프록시
    [InlineData("::ffff:10.21.157.68")]  // 듀얼 스택 소켓이 주는 IPv4-mapped 꼴
    [InlineData("172.20.0.5")]
    [InlineData("192.168.0.10")]
    [InlineData("fd12:3456::1")]
    [InlineData("127.0.0.1")]
    [InlineData("::1")]
    public async Task TrustedPeer_CfConnectingIp_BecomesRemoteIp(string peer)
    {
        var resolved = await ResolveAsync(BuildOptions(), peer, ("CF-Connecting-IP", Visitor));

        Assert.Equal(IPAddress.Parse(Visitor), resolved);
    }

    [Theory]
    [InlineData("198.51.100.9")]
    [InlineData("8.8.8.8")]
    [InlineData("104.16.0.1")]           // Cloudflare 엣지 대역 — 직전 홉으로는 오지 않는다
    [InlineData("100.64.0.1")]           // CGNAT 공유 대역
    [InlineData("2606:4700::1111")]
    public async Task PublicPeer_HeaderIgnored(string peer)
    {
        // 직전 홉이 신뢰 대역 밖이면 헤더로 버킷을 고를 수 없다.
        var resolved = await ResolveAsync(BuildOptions(), peer, ("CF-Connecting-IP", Visitor));

        Assert.Equal(IPAddress.Parse(peer), resolved);
    }

    [Fact]
    public async Task XForwardedFor_IsNeverRead()
    {
        // X-Forwarded-For 왼쪽 값은 방문자가 지어낼 수 있다 — 신뢰 홉을 거쳐 와도 읽지 않는다.
        var alone = await ResolveAsync(BuildOptions(), RenderProxy, ("X-Forwarded-For", "192.0.2.99, 203.0.113.7"));
        Assert.Equal(IPAddress.Parse(RenderProxy), alone);

        var both = await ResolveAsync(BuildOptions(), RenderProxy,
            ("X-Forwarded-For", "192.0.2.99"), ("CF-Connecting-IP", Visitor));
        Assert.Equal(IPAddress.Parse(Visitor), both);
    }

    [Fact]
    public async Task HeaderMissingOrUnparsable_KeepsPeerAddress()
    {
        Assert.Equal(IPAddress.Parse(RenderProxy), await ResolveAsync(BuildOptions(), RenderProxy));
        Assert.Equal(IPAddress.Parse(RenderProxy),
            await ResolveAsync(BuildOptions(), RenderProxy, ("CF-Connecting-IP", "not-an-ip")));
    }

    [Fact]
    public async Task OnlyOneHopIsRead()
    {
        // ForwardLimit 1 — 값이 여럿이어도 직전 홉이 적은 맨 오른쪽 하나만.
        var resolved = await ResolveAsync(BuildOptions(), RenderProxy, ("CF-Connecting-IP", "192.0.2.99, 203.0.113.7"));

        Assert.Equal(IPAddress.Parse(Visitor), resolved);
    }

    // ── 설정 ───────────────────────────────────────────────────────────

    [Fact]
    public void Defaults_AreCfConnectingIp_OneHop_ForOnly()
    {
        var options = BuildOptions();

        Assert.Equal("CF-Connecting-IP", options.ForwardedForHeaderName);
        Assert.Equal(1, options.ForwardLimit);
        Assert.Equal(ForwardedHeaders.XForwardedFor, options.ForwardedHeaders);
        Assert.Empty(options.KnownProxies);
        Assert.Equal(ClientIpForwarding.DefaultTrustedNetworks.Count, options.KnownIPNetworks.Count);
    }

    [Fact]
    public async Task ConfiguredNetworks_ReplaceDefaults()
    {
        var options = BuildOptions(("ForwardedHeaders:TrustedNetworks:0", "10.0.0.0/8"));

        Assert.Equal(IPAddress.Parse(Visitor), await ResolveAsync(options, "10.1.2.3", ("CF-Connecting-IP", Visitor)));
        // 기본 목록(루프백·다른 사설망)은 더 이상 신뢰하지 않는다 — 프레임워크 기본값(127.0.0.0/8 · ::1)도 남지 않는다.
        Assert.Equal(IPAddress.Loopback, await ResolveAsync(options, "127.0.0.1", ("CF-Connecting-IP", Visitor)));
        Assert.Equal(IPAddress.IPv6Loopback, await ResolveAsync(options, "::1", ("CF-Connecting-IP", Visitor)));
        Assert.Equal(IPAddress.Parse("192.168.0.10"),
            await ResolveAsync(options, "192.168.0.10", ("CF-Connecting-IP", Visitor)));
    }

    [Fact]
    public async Task ConfiguredHeader_ReplacesDefault()
    {
        var options = BuildOptions(("ForwardedHeaders:ClientIpHeader", "True-Client-IP"));

        Assert.Equal(IPAddress.Parse(Visitor), await ResolveAsync(options, RenderProxy, ("True-Client-IP", Visitor)));
        Assert.Equal(IPAddress.Parse(RenderProxy), await ResolveAsync(options, RenderProxy, ("CF-Connecting-IP", Visitor)));
    }

    [Fact]
    public void InvalidNetwork_FailsAtStartup()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => BuildOptions(("ForwardedHeaders:TrustedNetworks:0", "10.0.0.0/8"), ("ForwardedHeaders:TrustedNetworks:1", "render")));

        Assert.Contains("render", ex.Message);
    }

    // ── 버킷 키 ─────────────────────────────────────────────────────────

    [Theory]
    [InlineData(null, "unknown")]
    [InlineData("203.0.113.7", "203.0.113.7")]
    [InlineData("::ffff:203.0.113.7", "203.0.113.7")]
    [InlineData("2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1:2::/64")]
    [InlineData("2001:db8:1:2::1", "2001:db8:1:2::/64")]
    [InlineData("2001:db8:1:3::1", "2001:db8:1:3::/64")]
    public void PartitionKey_Ipv4AsIs_Ipv6BySlash64(string? address, string expected)
    {
        Assert.Equal(expected, RateLimitPartitionKey.For(address is null ? null : IPAddress.Parse(address)));
    }

    // ── 확인용 로그 ─────────────────────────────────────────────────────

    [Fact]
    public async Task Probe_LogsEachCaseOnce_AndNeverVisitorAddresses()
    {
        var logger = new CapturingLogger();
        var probe = new ClientIpForwardingProbe(_ => Task.CompletedTask, logger, Options.Create(BuildOptions()));

        for (var i = 0; i < 3; i++)
        {
            await probe.InvokeAsync(Context(RenderProxy, ("CF-Connecting-IP", Visitor)));   // 신뢰 + 헤더
            await probe.InvokeAsync(Context(RenderProxy));                                  // 신뢰 + 헤더 없음
            await probe.InvokeAsync(Context("198.51.100.9", ("CF-Connecting-IP", Visitor))); // 신뢰 밖 + 헤더
            await probe.InvokeAsync(Context("198.51.100.9"));                               // 신뢰 밖 + 헤더 없음
        }

        Assert.Equal(4, logger.Entries.Count);
        Assert.Single(logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains(logger.Entries, e => e.Message.Contains("방문자별 버킷") && e.Message.Contains(RenderProxy));

        // 방문자 IP(헤더 값)와 공인 직전 홉 주소는 어느 줄에도 없다.
        Assert.DoesNotContain(logger.Entries, e => e.Message.Contains(Visitor));
        Assert.DoesNotContain(logger.Entries, e => e.Message.Contains("198.51.100.9"));
    }

    // ── 도우미 ──────────────────────────────────────────────────────────

    private static ForwardedHeadersOptions BuildOptions(params (string Key, string Value)[] settings)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings.ToDictionary(s => s.Key, s => (string?)s.Value))
            .Build();
        var services = new ServiceCollection();
        services.AddClientIpForwarding(configuration);
        using var provider = services.BuildServiceProvider();
        return provider.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;
    }

    private static DefaultHttpContext Context(string? peer, params (string Name, string Value)[] headers)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = peer is null ? null : IPAddress.Parse(peer);
        foreach (var (name, value) in headers) context.Request.Headers[name] = value;
        return context;
    }

    /// <summary>실제 ForwardedHeadersMiddleware 를 한 번 돌리고 그 뒤의 RemoteIpAddress 를 돌려준다.</summary>
    private static async Task<IPAddress?> ResolveAsync(
        ForwardedHeadersOptions options, string? peer, params (string Name, string Value)[] headers)
    {
        var context = Context(peer, headers);
        var middleware = new ForwardedHeadersMiddleware(
            _ => Task.CompletedTask, NullLoggerFactory.Instance, Options.Create(options));
        await middleware.Invoke(context);
        return context.Connection.RemoteIpAddress;
    }

    private sealed class CapturingLogger : ILogger<ClientIpForwardingProbe>
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception)));
    }
}
