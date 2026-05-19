using NameForm.Domain.Models;

namespace NameForm.Infrastructure.Repositories;

public interface IRecommendationRepository
{
    Task SaveAsync(Recommendation recommendation);
    Task<Recommendation?> GetByIdAsync(string id);
    Task SaveFeedbackAsync(UserFeedback feedback);
    Task<List<UserFeedback>> GetFeedbackByRecommendationIdAsync(string recommendationId);
}
