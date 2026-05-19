using NameForm.Application.DTOs;

namespace NameForm.Application.Services;

public interface ISmartRecommendationService
{
    Task<SmartRecommendationResponseDto> GenerateSmartRecommendationsAsync(SmartRecommendationRequestDto request);
}
