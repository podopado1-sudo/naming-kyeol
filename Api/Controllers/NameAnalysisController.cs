using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NameForm.Application.DTOs;
using NameForm.Application.Services;

namespace NameForm.Api.Controllers;

[ApiController]
[Route("api/v1/name-analysis")]
[EnableRateLimiting("expensive")] // 사주 4기둥 + 용신 계산 — CPU 큰 작업
public class NameAnalysisController : ControllerBase
{
    private readonly INameAnalysisService _nameAnalysisService;
    private readonly ILogger<NameAnalysisController> _logger;
    private readonly IUsageTracker _usageTracker;

    public NameAnalysisController(
        INameAnalysisService nameAnalysisService,
        ILogger<NameAnalysisController> logger,
        IUsageTracker usageTracker)
    {
        _nameAnalysisService = nameAnalysisService;
        _logger = logger;
        _usageTracker = usageTracker;
    }

    /// <summary>
    /// 사용자가 원하는 이름을 분석/검증
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<NameAnalysisResponseDto>> AnalyzeName(
        [FromBody] NameAnalysisRequestDto request)
    {
        try
        {
            // 입력 검증
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "성(LastName)은 필수입니다." });

            if (string.IsNullOrWhiteSpace(request.FirstName))
                return BadRequest(new { error = "이름(FirstName)은 필수입니다." });

            var validGenders = new[] { "male", "female", "none" };
            if (!string.IsNullOrEmpty(request.Gender) && !validGenders.Contains(request.Gender.ToLower()))
                return BadRequest(new { error = "Gender는 'male', 'female', 'none' 중 하나여야 합니다." });

            var validTones = new[] { "neutral", "soft", "strong" };
            if (!string.IsNullOrEmpty(request.Tone) && !validTones.Contains(request.Tone.ToLower()))
                return BadRequest(new { error = "Tone은 'neutral', 'soft', 'strong' 중 하나여야 합니다." });

            if (!string.IsNullOrEmpty(request.BirthDate) && !DateTime.TryParse(request.BirthDate, out _))
                return BadRequest(new { error = "BirthDate 형식이 올바르지 않습니다. (YYYY-MM-DD)" });

            _logger.LogInformation("이름 분석 요청: 성={LastName}, 이름={FirstName}",
                request.LastName, request.FirstName);
            await _usageTracker.TrackAsync("endpoint", "analysis");

            var result = await _nameAnalysisService.AnalyzeNameAsync(request);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "이름 분석 입력 오류");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "이름 분석 중 오류 발생");
            return StatusCode(500, new { error = "이름 분석 중 오류가 발생했습니다.", message = ex.Message });
        }
    }
}
