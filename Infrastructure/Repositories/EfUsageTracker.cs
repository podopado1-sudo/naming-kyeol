using NameForm.Application.Services;
using NameForm.Domain.Models;
using NameForm.Infrastructure.Data;
using Microsoft.Extensions.Logging;

namespace NameForm.Infrastructure.Repositories;

public class EfUsageTracker : IUsageTracker
{
    private readonly AppDbContext _db;
    private readonly ILogger<EfUsageTracker> _logger;

    public EfUsageTracker(AppDbContext db, ILogger<EfUsageTracker> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task TrackAsync(string eventType, string key)
    {
        try
        {
            _db.UsageEvents.Add(new UsageEvent
            {
                EventType = eventType,
                Key = key,
                CreatedAt = DateTime.UtcNow,
            });
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning("사용량 이벤트 기록 실패 (무시): {Error}", ex.Message);
        }
    }
}
