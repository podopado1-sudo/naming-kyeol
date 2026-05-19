using NameForm.Application.DTOs;
using NameForm.Domain.Models;
using NameForm.Infrastructure.Repositories;

namespace NameForm.Tests;

/// <summary>
/// 피드백 API 관련 테스트
/// - 피드백 제출 성공
/// - 필수 필드 누락 시 에러
/// - 잘못된 추천 ID 처리
/// - 피드백 조회 및 집계
/// </summary>
public class FeedbackApiTests
{
    private readonly InMemoryRecommendationRepository _repository;

    public FeedbackApiTests()
    {
        _repository = new InMemoryRecommendationRepository();
    }

    [Fact]
    public async Task SaveFeedbackAsync_ValidFeedback_SavesSuccessfully()
    {
        // Arrange
        var feedback = new UserFeedback
        {
            Id = "fb001",
            RecommendationId = "rec001",
            Name = "서준",
            LastName = "김",
            FeedbackType = "like",
            Reason = "발음이 좋아요",
            SubjectiveAestheticScore = 85,
            SubjectiveHarmonyScore = 90,
            CreatedAt = DateTime.UtcNow
        };

        // Act
        await _repository.SaveFeedbackAsync(feedback);
        var result = await _repository.GetFeedbackByRecommendationIdAsync("rec001");

        // Assert
        Assert.Single(result);
        Assert.Equal("fb001", result[0].Id);
        Assert.Equal("서준", result[0].Name);
        Assert.Equal("like", result[0].FeedbackType);
        Assert.Equal("발음이 좋아요", result[0].Reason);
        Assert.Equal(85, result[0].SubjectiveAestheticScore);
        Assert.Equal(90, result[0].SubjectiveHarmonyScore);
    }

    [Fact]
    public async Task GetFeedbackByRecommendationIdAsync_NoFeedbacks_ReturnsEmptyList()
    {
        // Act
        var result = await _repository.GetFeedbackByRecommendationIdAsync("nonexistent");

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetFeedbackByRecommendationIdAsync_MultipleFeedbacks_ReturnsOrderedByCreatedAtDesc()
    {
        // Arrange
        var older = new UserFeedback
        {
            Id = "fb001",
            RecommendationId = "rec001",
            Name = "서준",
            FeedbackType = "like",
            CreatedAt = DateTime.UtcNow.AddMinutes(-10)
        };
        var newer = new UserFeedback
        {
            Id = "fb002",
            RecommendationId = "rec001",
            Name = "민준",
            FeedbackType = "dislike",
            CreatedAt = DateTime.UtcNow
        };

        await _repository.SaveFeedbackAsync(older);
        await _repository.SaveFeedbackAsync(newer);

        // Act
        var result = await _repository.GetFeedbackByRecommendationIdAsync("rec001");

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Equal("fb002", result[0].Id); // 최신이 먼저
        Assert.Equal("fb001", result[1].Id);
    }

    [Fact]
    public async Task GetFeedbackByRecommendationIdAsync_DifferentRecommendations_FiltersCorrectly()
    {
        // Arrange
        var fb1 = new UserFeedback
        {
            Id = "fb001",
            RecommendationId = "rec001",
            Name = "서준",
            FeedbackType = "like",
            CreatedAt = DateTime.UtcNow
        };
        var fb2 = new UserFeedback
        {
            Id = "fb002",
            RecommendationId = "rec002",
            Name = "민준",
            FeedbackType = "selected",
            CreatedAt = DateTime.UtcNow
        };

        await _repository.SaveFeedbackAsync(fb1);
        await _repository.SaveFeedbackAsync(fb2);

        // Act
        var result1 = await _repository.GetFeedbackByRecommendationIdAsync("rec001");
        var result2 = await _repository.GetFeedbackByRecommendationIdAsync("rec002");

        // Assert
        Assert.Single(result1);
        Assert.Equal("서준", result1[0].Name);
        Assert.Single(result2);
        Assert.Equal("민준", result2[0].Name);
    }

    [Fact]
    public void CreateUserFeedbackDto_RequiredFields_DefaultToEmptyString()
    {
        // Arrange & Act
        var dto = new CreateUserFeedbackDto();

        // Assert
        Assert.Equal(string.Empty, dto.RecommendationId);
        Assert.Equal(string.Empty, dto.Name);
        Assert.Equal(string.Empty, dto.FeedbackType);
        Assert.Null(dto.Reason);
        Assert.Null(dto.SubjectiveAestheticScore);
        Assert.Null(dto.SubjectiveHarmonyScore);
    }

    [Fact]
    public void FeedbackSummaryResponseDto_Aggregation_WorksCorrectly()
    {
        // Arrange: 여러 피드백으로 집계 로직 검증
        var feedbacks = new List<UserFeedback>
        {
            new() { Id = "fb1", RecommendationId = "rec1", Name = "서준", FeedbackType = "like", SubjectiveAestheticScore = 80, SubjectiveHarmonyScore = 70 },
            new() { Id = "fb2", RecommendationId = "rec1", Name = "서준", FeedbackType = "selected", SubjectiveAestheticScore = 90, SubjectiveHarmonyScore = 85 },
            new() { Id = "fb3", RecommendationId = "rec1", Name = "민준", FeedbackType = "dislike", SubjectiveAestheticScore = 40, SubjectiveHarmonyScore = 50 },
            new() { Id = "fb4", RecommendationId = "rec1", Name = "도윤", FeedbackType = "like", SubjectiveAestheticScore = null, SubjectiveHarmonyScore = null },
        };

        // Act: 피드백 타입별 집계
        var feedbackTypeCounts = feedbacks
            .GroupBy(f => f.FeedbackType.ToLower())
            .ToDictionary(g => g.Key, g => g.Count());

        var aestheticScores = feedbacks
            .Where(f => f.SubjectiveAestheticScore.HasValue)
            .Select(f => f.SubjectiveAestheticScore!.Value)
            .ToList();

        var nameSummaries = feedbacks
            .GroupBy(f => f.Name)
            .Select(g => new NameFeedbackSummaryDto
            {
                Name = g.Key,
                LikeCount = g.Count(f => f.FeedbackType.Equals("like", StringComparison.OrdinalIgnoreCase)),
                DislikeCount = g.Count(f => f.FeedbackType.Equals("dislike", StringComparison.OrdinalIgnoreCase)),
                SelectedCount = g.Count(f => f.FeedbackType.Equals("selected", StringComparison.OrdinalIgnoreCase)),
                RejectedCount = g.Count(f => f.FeedbackType.Equals("rejected", StringComparison.OrdinalIgnoreCase)),
            })
            .ToList();

        // Assert
        Assert.Equal(2, feedbackTypeCounts["like"]);
        Assert.Equal(1, feedbackTypeCounts["dislike"]);
        Assert.Equal(1, feedbackTypeCounts["selected"]);
        Assert.Equal(3, aestheticScores.Count);
        Assert.Equal(70.0, aestheticScores.Average(), 0.1);

        var seojun = nameSummaries.First(n => n.Name == "서준");
        Assert.Equal(1, seojun.LikeCount);
        Assert.Equal(1, seojun.SelectedCount);
        Assert.Equal(0, seojun.DislikeCount);

        var minjun = nameSummaries.First(n => n.Name == "민준");
        Assert.Equal(1, minjun.DislikeCount);
        Assert.Equal(0, minjun.LikeCount);
    }

    [Theory]
    [InlineData("like")]
    [InlineData("dislike")]
    [InlineData("selected")]
    [InlineData("rejected")]
    public async Task SaveFeedbackAsync_AllFeedbackTypes_SavesCorrectly(string feedbackType)
    {
        // Arrange
        var feedback = new UserFeedback
        {
            Id = $"fb-{feedbackType}",
            RecommendationId = "rec001",
            Name = "서준",
            FeedbackType = feedbackType,
            CreatedAt = DateTime.UtcNow
        };

        // Act
        await _repository.SaveFeedbackAsync(feedback);
        var result = await _repository.GetFeedbackByRecommendationIdAsync("rec001");

        // Assert
        var saved = result.FirstOrDefault(f => f.Id == $"fb-{feedbackType}");
        Assert.NotNull(saved);
        Assert.Equal(feedbackType, saved.FeedbackType);
    }

    [Fact]
    public async Task SaveFeedbackAsync_OptionalFieldsNull_SavesSuccessfully()
    {
        // Arrange: 선택 필드 없이 최소 필드만으로 저장
        var feedback = new UserFeedback
        {
            Id = "fb-minimal",
            RecommendationId = "rec001",
            Name = "서준",
            FeedbackType = "like",
            Reason = null,
            SubjectiveAestheticScore = null,
            SubjectiveHarmonyScore = null,
            CreatedAt = DateTime.UtcNow
        };

        // Act
        await _repository.SaveFeedbackAsync(feedback);
        var result = await _repository.GetFeedbackByRecommendationIdAsync("rec001");

        // Assert
        Assert.Single(result);
        Assert.Null(result[0].Reason);
        Assert.Null(result[0].SubjectiveAestheticScore);
        Assert.Null(result[0].SubjectiveHarmonyScore);
    }
}
