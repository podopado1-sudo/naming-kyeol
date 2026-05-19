namespace NameForm.Domain.Models;

/// <summary>
/// 사용자 피드백 모델
/// 나중에 확장하여 사용자 선호도 데이터를 수집하고 모델을 보정할 수 있도록 설계
/// </summary>
public class UserFeedback
{
    public string Id { get; set; } = string.Empty;
    public string RecommendationId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    
    /// <summary>
    /// 피드백 타입: "like", "dislike", "selected", "rejected"
    /// </summary>
    public string FeedbackType { get; set; } = string.Empty;
    
    /// <summary>
    /// 피드백 이유 (선택사항)
    /// </summary>
    public string? Reason { get; set; }
    
    /// <summary>
    /// 피드백 생성 시간
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// 미학 점수 (사용자가 느낀 주관적 점수, 0-100)
    /// </summary>
    public int? SubjectiveAestheticScore { get; set; }
    
    /// <summary>
    /// 조화 점수 (사용자가 느낀 주관적 점수, 0-100)
    /// </summary>
    public int? SubjectiveHarmonyScore { get; set; }
}
