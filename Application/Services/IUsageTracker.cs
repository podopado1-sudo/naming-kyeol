namespace NameForm.Application.Services;

public interface IUsageTracker
{
    /// <summary>이벤트 기록. 실패해도 예외를 던지지 않는다 (추천 요청을 막으면 안 됨).</summary>
    Task TrackAsync(string eventType, string key);
}
