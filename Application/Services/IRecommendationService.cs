using NameForm.Application.DTOs;

namespace NameForm.Application.Services;

public interface IRecommendationService
{
    Task<RecommendationResponseDto> CreateRecommendationAsync(CreateRecommendationRequestDto request);
    Task<RecommendationResponseDto?> GetRecommendationAsync(string id);
}
