namespace NameForm.Domain.Models;

/// <summary>사용량 이벤트 (append-only, PII 없음)</summary>
public class UsageEvent
{
    public long Id { get; set; }
    public string EventType { get; set; } = "";  // "endpoint" | "tab_view"
    public string Key { get; set; } = "";        // "smart", "creative", "twin" 등
    public DateTime CreatedAt { get; set; }      // UTC
}
