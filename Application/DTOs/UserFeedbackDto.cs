namespace NameForm.Application.DTOs;

/// <summary>
/// 사용자 피드백 DTO
/// </summary>
public class CreateUserFeedbackDto
{
    public string RecommendationId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FeedbackType { get; set; } = string.Empty; // "like", "dislike", "selected", "rejected"
    public string? Reason { get; set; }
    public int? SubjectiveAestheticScore { get; set; }
    public int? SubjectiveHarmonyScore { get; set; }
}

public class UserFeedbackResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string RecommendationId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string FeedbackType { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// 피드백 목록 조회 응답 DTO
/// </summary>
public class FeedbackListResponseDto
{
    public string RecommendationId { get; set; } = string.Empty;
    public int TotalCount { get; set; }
    public List<UserFeedbackResponseDto> Feedbacks { get; set; } = new();
}

/// <summary>
/// 피드백 집계/요약 응답 DTO
/// </summary>
public class FeedbackSummaryResponseDto
{
    public string RecommendationId { get; set; } = string.Empty;
    public int TotalFeedbackCount { get; set; }
    public Dictionary<string, int> FeedbackTypeCounts { get; set; } = new();
    public double? AverageSubjectiveAestheticScore { get; set; }
    public double? AverageSubjectiveHarmonyScore { get; set; }

    /// <summary>
    /// 이름별 피드백 요약 (어떤 이름이 가장 인기 있는지)
    /// </summary>
    public List<NameFeedbackSummaryDto> NameSummaries { get; set; } = new();
}

/// <summary>
/// 개별 이름에 대한 피드백 요약
/// </summary>
public class NameFeedbackSummaryDto
{
    public string Name { get; set; } = string.Empty;
    public int LikeCount { get; set; }
    public int DislikeCount { get; set; }
    public int SelectedCount { get; set; }
    public int RejectedCount { get; set; }
    public double? AverageAestheticScore { get; set; }
    public double? AverageHarmonyScore { get; set; }
}
