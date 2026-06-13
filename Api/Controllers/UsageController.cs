using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using NameForm.Application.Services;
using NameForm.Infrastructure.Data;

namespace NameForm.Api.Controllers;

[ApiController]
[Route("api/v1/usage")]
public class UsageController : ControllerBase
{
    private static readonly HashSet<string> AllowedTabKeys = new(StringComparer.Ordinal)
    {
        "standard", "pure-korean", "three-syllable", "creative",
        "parent-based", "required-char", "dual-name", "twin", "rare-surname",
    };

    private readonly IUsageTracker _usageTracker;
    private readonly AppDbContext _db;

    public UsageController(IUsageTracker usageTracker, AppDbContext db)
    {
        _usageTracker = usageTracker;
        _db = db;
    }

    /// <summary>
    /// 프론트 탭 클릭 이벤트 수신 (sendBeacon 대상)
    /// </summary>
    [HttpPost("event")]
    public async Task<IActionResult> TrackEvent([FromBody] TrackEventRequest request)
    {
        if (request.EventType != "tab_view")
            return BadRequest(new { error = "eventType은 'tab_view'만 허용됩니다." });

        if (string.IsNullOrWhiteSpace(request.Key) || !AllowedTabKeys.Contains(request.Key))
            return BadRequest(new { error = $"key는 다음 중 하나여야 합니다: {string.Join(", ", AllowedTabKeys)}" });

        await _usageTracker.TrackAsync("tab_view", request.Key);
        return NoContent();
    }

    /// <summary>
    /// 기간별 사용량 집계 조회
    /// </summary>
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery][Range(1, 365)] int days = 30)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var rows = await _db.UsageEvents
            .Where(e => e.CreatedAt >= since)
            .GroupBy(e => new { e.EventType, e.Key })
            .Select(g => new { g.Key.EventType, g.Key.Key, Count = g.Count() })
            .OrderByDescending(r => r.Count)
            .ToListAsync();

        return Ok(rows);
    }
}

public record TrackEventRequest(string EventType, string Key);
