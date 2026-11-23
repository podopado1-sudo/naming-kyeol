using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Options;

namespace NameForm.Api.Middleware;

/// <summary>
/// 프록시 뒤에서 방문자 IP 를 되찾는다 — 리미터가 방문자별 버킷으로 동작하게 하는 설정.
///
/// 운영 경로는 방문자 → Cloudflare → Render 프록시 → Kestrel 이라, 설정이 없으면
/// <c>Connection.RemoteIpAddress</c> 는 Render 프록시의 사설 주소다(모든 방문자가 한 버킷).
///
/// 신뢰 규칙 (헤더 값을 그대로 믿지 않는다):
/// 1. 직전 홉(TCP 상대)이 신뢰 대역일 때만 헤더를 읽는다. 기본 = 루프백 + 사설망.
///    Render 웹 서비스 컨테이너는 인터넷에서 직접 닿지 않고 프록시가 사설망으로만 들어온다.
/// 2. 읽는 헤더는 <c>CF-Connecting-IP</c> 하나. Cloudflare 가 요청마다 덮어써서 방문자가 값을 정할 수 없다.
///    <c>X-Forwarded-For</c> 는 쓰지 않는다 — Cloudflare·Render 모두 덧붙이기만 해서 왼쪽 값은 방문자가 지어낼 수 있고,
///    오른쪽 끝 값은 Cloudflare 엣지 주소다.
/// 3. 값 하나만 읽는다(ForwardLimit 1). 신뢰 조건이 안 맞거나 헤더가 없으면 예전처럼 직전 홉 주소로 집계한다.
///
/// 설정(선택 — 환경변수로 덮을 수 있다):
///   ForwardedHeaders:ClientIpHeader        기본 CF-Connecting-IP
///   ForwardedHeaders:TrustedNetworks:0..N  CIDR 목록. 주면 기본 목록을 통째로 대체한다
/// </summary>
public static class ClientIpForwarding
{
    public const string ConfigSection = "ForwardedHeaders";
    public const string DefaultClientIpHeader = "CF-Connecting-IP";

    /// <summary>직전 홉으로 믿는 기본 대역 — 공인 주소는 하나도 없다.</summary>
    public static readonly IReadOnlyList<string> DefaultTrustedNetworks =
    [
        "127.0.0.0/8", "::1/128",                          // 루프백 (로컬 개발)
        "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",   // RFC 1918 사설망 (Render 프록시)
        "fc00::/7",                                        // IPv6 사설(ULA)
    ];

    private static readonly System.Net.IPNetwork[] PrivateNetworks =
        DefaultTrustedNetworks.Select(System.Net.IPNetwork.Parse).ToArray();

    public static IServiceCollection AddClientIpForwarding(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection(ConfigSection);

        var header = section["ClientIpHeader"];
        if (string.IsNullOrWhiteSpace(header)) header = DefaultClientIpHeader;

        var configured = section.GetSection("TrustedNetworks").Get<string[]>();
        var cidrs = configured is { Length: > 0 } ? configured : DefaultTrustedNetworks;
        // 잘못된 값은 조용히 넘기지 않는다 — 넘기면 신뢰 대역이 비어 공용 버킷으로 되돌아가도 모른다.
        var networks = cidrs.Select(ParseNetwork).ToList();

        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor; // IP 만. 스킴·호스트는 건드리지 않는다
            options.ForwardedForHeaderName = header;
            options.ForwardLimit = 1;
            options.KnownProxies.Clear();
            options.KnownIPNetworks.Clear();
            foreach (var network in networks) options.KnownIPNetworks.Add(network);
        });
        return services;
    }

    /// <summary>파이프라인 맨 앞에 둔다 — 리미터·인증 로그가 되찾은 주소를 보게.</summary>
    public static IApplicationBuilder UseClientIpForwarding(this IApplicationBuilder app)
    {
        app.UseMiddleware<ClientIpForwardingProbe>();
        return app.UseForwardedHeaders();
    }

    /// <summary>ForwardedHeadersMiddleware 의 직전 홉 판정과 같은 규칙(주소 없음 = 통과, IPv4-mapped 는 IPv4 로).</summary>
    internal static bool IsTrustedPeer(ForwardedHeadersOptions options, IPAddress? peer)
    {
        if (peer is null) return true;
        if (peer.IsIPv4MappedToIPv6) peer = peer.MapToIPv4();
        return options.KnownProxies.Contains(peer) || options.KnownIPNetworks.Any(n => n.Contains(peer));
    }

    /// <summary>로그에 적을 직전 홉 표기. 사설·루프백 주소(인프라)만 그대로 적고 공인 주소는 가린다.</summary>
    internal static string DescribePeer(IPAddress? peer)
    {
        if (peer is null) return "(주소 없음)";
        if (peer.IsIPv4MappedToIPv6) peer = peer.MapToIPv4();
        return PrivateNetworks.Any(n => n.Contains(peer)) ? peer.ToString() : "(공인 주소 — 가림)";
    }

    private static System.Net.IPNetwork ParseNetwork(string cidr)
    {
        if (System.Net.IPNetwork.TryParse(cidr?.Trim(), out var network)) return network;
        throw new InvalidOperationException(
            $"{ConfigSection}:TrustedNetworks 값 '{cidr}' 은(는) CIDR 형식이 아닙니다 (예: 10.0.0.0/8).");
    }
}

/// <summary>
/// 리미터 버킷 키. IPv6 는 /64 로 묶는다 — 한 회선이 /64 를 통째로 받아서, 주소 하나를 키로 쓰면
/// 주소를 바꿔 가며 제한을 피할 수 있고 버킷 수도 끝없이 늘어난다.
/// </summary>
public static class RateLimitPartitionKey
{
    public static string For(HttpContext context) => For(context.Connection.RemoteIpAddress);

    public static string For(IPAddress? address)
    {
        if (address is null) return "unknown";
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (address.AddressFamily != AddressFamily.InterNetworkV6) return address.ToString();

        Span<byte> bytes = stackalloc byte[16];
        address.TryWriteBytes(bytes, out _);
        bytes[8..].Clear();
        return $"{new IPAddress(bytes)}/64";
    }
}

/// <summary>
/// 배포 뒤 확인용 로그. 직전 홉이 신뢰 대역인지 · 방문자 IP 헤더가 오는지를 경우마다 한 번만 적는다
/// (프로세스당 최대 4줄). 방문자 IP 와 헤더 값은 적지 않는다.
/// </summary>
public sealed class ClientIpForwardingProbe
{
    private const int AllCases = 0b1111;

    private readonly RequestDelegate _next;
    private readonly ILogger<ClientIpForwardingProbe> _logger;
    private readonly ForwardedHeadersOptions _options;
    private int _seen;

    public ClientIpForwardingProbe(
        RequestDelegate next,
        ILogger<ClientIpForwardingProbe> logger,
        IOptions<ForwardedHeadersOptions> options)
    {
        _next = next;
        _logger = logger;
        _options = options.Value;
    }

    public Task InvokeAsync(HttpContext context)
    {
        if (Volatile.Read(ref _seen) != AllCases) Report(context);
        return _next(context);
    }

    private void Report(HttpContext context)
    {
        var peer = context.Connection.RemoteIpAddress;
        var trusted = ClientIpForwarding.IsTrustedPeer(_options, peer);
        var hasHeader = context.Request.Headers.ContainsKey(_options.ForwardedForHeaderName);

        var bit = 1 << ((trusted ? 2 : 0) + (hasHeader ? 1 : 0));
        if ((Interlocked.Or(ref _seen, bit) & bit) != 0) return;

        var peerText = ClientIpForwarding.DescribePeer(peer);
        var header = _options.ForwardedForHeaderName;

        if (trusted && hasHeader)
            _logger.LogInformation(
                "클라이언트 IP 전달 확인: 직전 홉 {Peer} 신뢰, {Header} 헤더 있음 → 리미터가 방문자별 버킷으로 동작",
                peerText, header);
        else if (trusted)
            _logger.LogInformation(
                "클라이언트 IP 전달 확인: 직전 홉 {Peer} 신뢰, {Header} 헤더 없는 요청 → 이 요청은 직전 홉 주소로 집계 (헬스체크·내부 요청이면 정상)",
                peerText, header);
        else if (hasHeader)
            _logger.LogWarning(
                "클라이언트 IP 전달 확인: 직전 홉 {Peer} 이(가) 신뢰 대역 밖 → {Header} 헤더 무시, 직전 홉 주소로 집계. 프록시 뒤라면 ForwardedHeaders:TrustedNetworks 설정을 확인할 것",
                peerText, header);
        else
            _logger.LogInformation(
                "클라이언트 IP 전달 확인: 직전 홉 {Peer} 신뢰 대역 밖, {Header} 헤더 없음 → 직전 홉 주소로 집계",
                peerText, header);
    }
}
