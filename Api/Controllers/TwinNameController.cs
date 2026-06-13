using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NameForm.Application.DTOs;
using NameForm.Application.Services;

namespace NameForm.Api.Controllers;

[ApiController]
[Route("api/v1/twin-names")]
[EnableRateLimiting("expensive")] // 쌍둥이 세트 — 각 후보마다 사주/채점 → CPU 큰 작업
public class TwinNameController : ControllerBase
{
    private readonly ITwinNameService _twinNameService;
    private readonly ILogger<TwinNameController> _logger;
    private readonly IUsageTracker _usageTracker;

    public TwinNameController(
        ITwinNameService twinNameService,
        ILogger<TwinNameController> logger,
        IUsageTracker usageTracker)
    {
        _twinNameService = twinNameService;
        _logger = logger;
        _usageTracker = usageTracker;
    }

    /// <summary>
    /// 쌍둥이/형제 이름 세트 생성
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<TwinNameResponseDto>> GenerateTwinNames(
        [FromBody] TwinNameRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "성(LastName)은 필수입니다." });

            if (string.IsNullOrWhiteSpace(request.BirthDate) || !DateTime.TryParse(request.BirthDate, out _))
                return BadRequest(new { error = "출생일(BirthDate)은 필수이며 YYYY-MM-DD 형식이어야 합니다." });

            if (request.ChildCount < 2 || request.ChildCount > 3)
                return BadRequest(new { error = "ChildCount는 2 또는 3이어야 합니다." });

            var validGenders = new[] { "male", "female", "none" };
            if (!string.IsNullOrEmpty(request.Gender) && !validGenders.Contains(request.Gender.ToLower()))
                return BadRequest(new { error = "Gender는 'male', 'female', 'none' 중 하나여야 합니다." });

            _logger.LogInformation("쌍둥이 이름 요청: 성={LastName}, 자녀수={ChildCount}",
                request.LastName, request.ChildCount);
            await _usageTracker.TrackAsync("endpoint", "twin");

            var result = await _twinNameService.GenerateTwinNamesAsync(request);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "쌍둥이 이름 입력 오류");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "쌍둥이 이름 생성 중 오류");
            return StatusCode(500, new { error = "쌍둥이 이름 생성 중 오류가 발생했습니다.", message = ex.Message });
        }
    }
}
