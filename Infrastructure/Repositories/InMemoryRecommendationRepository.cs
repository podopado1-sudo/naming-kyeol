using NameForm.Domain.Models;

namespace NameForm.Infrastructure.Repositories;

/// <summary>
/// InMemory 추천 결과 저장소 (1주차용)
/// 나중에 DB로 교체 예정
/// </summary>
public class InMemoryRecommendationRepository : IRecommendationRepository
{
    private readonly Dictionary<string, Recommendation> _storage = new();
    private readonly List<UserFeedback> _feedbackStorage = new();
    private readonly object _lock = new();

    public Task SaveAsync(Recommendation recommendation)
    {
        lock (_lock)
        {
            _storage[recommendation.Id] = recommendation;
        }

        return Task.CompletedTask;
    }

    public Task<Recommendation?> GetByIdAsync(string id)
    {
        lock (_lock)
        {
            _storage.TryGetValue(id, out var recommendation);
            return Task.FromResult(recommendation);
        }
    }

    public Task SaveFeedbackAsync(UserFeedback feedback)
    {
        lock (_lock)
        {
            _feedbackStorage.Add(feedback);
        }
        return Task.CompletedTask;
    }

    public Task<List<UserFeedback>> GetFeedbackByRecommendationIdAsync(string recommendationId)
    {
        lock (_lock)
        {
            var results = _feedbackStorage
                .Where(f => f.RecommendationId == recommendationId)
                .OrderByDescending(f => f.CreatedAt)
                .ToList();
            return Task.FromResult(results);
        }
    }
}
