using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NameForm.Application.DTOs;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;

namespace NameForm.Api.Controllers;

/// <summary>
/// 사주 원국 — 부족한 오행 찾기(/ohaeng, 2026-11 설계 docs/plan-ohaeng-2026-11.md §2·§3).
/// 입력값(생년월일·시각·출생지)은 DB·서버 로그에 남기지 않는다 — 로그 템플릿에 입력값을 넣지 않고(SajuControllerLoggingTests),
/// 사용 통계는 종류·키·시각만(<see cref="IUsageTracker"/>).
/// </summary>
[ApiController]
[Route("api/v1/saju")]
[EnableRateLimiting("expensive")] // 사주 4기둥 + 용신 계산 — NameAnalysisController 와 같은 정책
public class SajuController : ControllerBase
{
    private readonly ISajuElementsService _sajuElementsService;
    private readonly ILogger<SajuController> _logger;
    private readonly IUsageTracker _usageTracker;

    private static readonly string[] BirthTimeFormats = { @"hh\:mm", @"hh\:mm\:ss" };

    public SajuController(
        ISajuElementsService sajuElementsService,
        ILogger<SajuController> logger,
        IUsageTracker usageTracker)
    {
        _sajuElementsService = sajuElementsService;
        _logger = logger;
        _usageTracker = usageTracker;
    }

    /// <summary>
    /// 생년월일(+시각·출생지)로 사주 원국 여덟 글자(시각을 모르면 여섯 글자)의 오행 개수·없는 오행·용신·희신과 오행별 이름 한자 예
    /// </summary>
    [HttpPost("elements")]
    public async Task<ActionResult<SajuElementsResponseDto>> FindElements([FromBody] SajuElementsRequestDto request)
    {
        try
        {
            // 입력 검증 — 표 2-3 순서. 문구는 한국어로 시작(프런트 messageFor 가 그대로 보인다), 입력값을 문구에 넣지 않는다
            if (string.IsNullOrWhiteSpace(request.BirthDate))
                return BadRequest(new { error = "생년월일은 필수입니다." });

            if (!TryParseBirthDate(request.BirthDate, out var birthDate))
                return BadRequest(new { error = "생년월일은 YYYY-MM-DD 형식이어야 합니다. (예: 2024-01-15)" });

            if (birthDate < SajuElementsService.MinBirthDate)
                return BadRequest(new { error = "생년월일은 1900년 1월 1일 이후로 넣어 주세요." });

            // 미래 날짜는 택일(날 받기)을 부추기지 않으려고 막는다(설계 D6)
            if (birthDate > TodayKst())
                return BadRequest(new { error = "생년월일은 오늘까지의 날짜로 넣어 주세요." });

            TimeSpan? birthTime = null;
            if (!string.IsNullOrWhiteSpace(request.BirthTime))
            {
                // 엄격 파싱 — /name-analysis 의 TimeSpan.TryParse 는 '25:00'을 조용히 버리고 '1.02:00'은 날짜를 하루 민다
                if (!TryParseBirthTime(request.BirthTime, out var parsedTime))
                    return BadRequest(new { error = "출생 시각은 HH:mm 형식이어야 합니다. (예: 14:30)" });
                birthTime = parsedTime;
            }

            string? birthplaceCode = null;
            if (!string.IsNullOrWhiteSpace(request.BirthplaceCode))
            {
                // BirthplaceData.Find 는 모르는 코드를 조용히 서울로 바꾼다 — 여기서는 막는다
                birthplaceCode = request.BirthplaceCode.Trim().ToLowerInvariant();
                if (!BirthplaceData.IsKnownCode(birthplaceCode))
                    return BadRequest(new { error = "출생지는 목록에 있는 시·도 가운데 하나여야 합니다." });
            }

            _logger.LogInformation("오행 찾기 요청");
            await _usageTracker.TrackAsync("endpoint", "ohaeng");

            var result = await _sajuElementsService.FindAsync(birthDate, birthTime, birthplaceCode);
            return Ok(result);
        }
        catch (SajuInputException ex)
        {
            // 서비스가 직접 막은 입력 오류만 400 + 문구(한국어로 시작, 입력값 없음 — SajuElementsService).
            // ArgumentException 전부를 잡지 않는다: 엔진 안의 ArgumentOutOfRange·ArgumentNull 등은 계산 오류라 아래 500 으로 간다
            // (영문 프레임워크 문구·내부 매개변수 이름이 응답에 실리지 않게 — 2026-11-19 반박 검토, 설계 §16)
            _logger.LogWarning("오행 찾기 입력 오류");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            // NameAnalysisController 와 달리 ex.Message 를 응답에 싣지 않는다(smart 엔드포인트와 같게)
            _logger.LogError(ex, "오행 계산 중 오류 발생");
            return StatusCode(500, new { error = "오행 계산 중 오류가 발생했습니다." });
        }
    }

    /// <summary>yyyy-MM-dd 엄격 파싱(InvariantCulture) — '2021-13-45'·'2021-5-5'·'2021-05-05T00' 은 거짓</summary>
    private static bool TryParseBirthDate(string value, out DateTime date)
        => DateTime.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    /// <summary>HH:mm 또는 HH:mm:ss 엄격 파싱 — 00:00~23:59(:59). '25:00'·'24:00'·'1.02:00'·'abc' 는 거짓</summary>
    private static bool TryParseBirthTime(string value, out TimeSpan time)
    {
        if (TimeSpan.TryParseExact(value.Trim(), BirthTimeFormats, CultureInfo.InvariantCulture, out time)
            && time >= TimeSpan.Zero && time < TimeSpan.FromDays(1))
            return true;
        time = default;
        return false;
    }

    /// <summary>오늘(한국 시간) — 서버 시간대와 무관하게 UTC + 9시간의 날짜</summary>
    private static DateTime TodayKst() => DateTime.UtcNow.AddHours(9).Date;
}
