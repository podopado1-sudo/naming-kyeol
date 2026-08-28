using Microsoft.AspNetCore.Mvc;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;

namespace NameForm.Api.Controllers;

/// <summary>
/// 상호(회사명·가게명·브랜드명) 작명 API.
/// 인명 추천(/recommendations/*)과 계약이 다르므로 별도 경로를 쓴다 —
/// 성씨·생년월일이 없고, 점수 축도 기억성·발음·식별력·업종적합이다.
/// </summary>
[ApiController]
[Route("api/v1/company-names")]
public class CompanyNameController : ControllerBase
{
    private readonly ICompanyNamingEngine _companyNamingEngine;
    private readonly ILogger<CompanyNameController> _logger;
    private readonly IUsageTracker _usageTracker;

    public CompanyNameController(
        ICompanyNamingEngine companyNamingEngine,
        ILogger<CompanyNameController> logger,
        IUsageTracker usageTracker)
    {
        _companyNamingEngine = companyNamingEngine;
        _logger = logger;
        _usageTracker = usageTracker;
    }

    /// <summary>
    /// 상호 후보 생성
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<CompanyNamingResponseDto>> GenerateCompanyNames(
        [FromBody] CompanyNamingRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Industry))
                return BadRequest(new { error = "Industry는 필수입니다." });

            if (!CompanyNamingData.IsValidIndustry(request.Industry))
                return BadRequest(new
                {
                    error = $"Industry는 다음 중 하나여야 합니다: {string.Join(", ", CompanyNamingData.Industries.Keys)}",
                });

            if (!CompanyNamingData.IsValidTone(request.Tone))
                return BadRequest(new
                {
                    error = $"Tone은 다음 중 하나여야 합니다: {string.Join(", ", CompanyNamingData.Tones.Keys)}",
                });

            var validStyles = new[] { "all", "hanja", "pure-korean", "english" };
            if (!validStyles.Contains(request.Style?.ToLower()))
                return BadRequest(new { error = $"Style은 다음 중 하나여야 합니다: {string.Join(", ", validStyles)}" });

            if (request.Syllables != 0 && request.Syllables is < 2 or > 4)
                return BadRequest(new { error = "Syllables는 0(무관) 또는 2~4여야 합니다." });

            if (request.Count < 1 || request.Count > 50)
                return BadRequest(new { error = "Count는 1~50 사이여야 합니다." });

            if (request.Keywords.Count > 3)
                return BadRequest(new { error = "Keywords는 최대 3개까지 넣을 수 있습니다." });

            if (request.Keywords.Any(k => k?.Length > 10))
                return BadRequest(new { error = "Keywords의 각 항목은 10자 이내여야 합니다." });

            _logger.LogInformation("상호 작명 요청: 업종={Industry}, 톤={Tone}, 축={Style}, 음절={Syllables}, 개수={Count}",
                request.Industry, request.Tone, request.Style, request.Syllables, request.Count);
            await _usageTracker.TrackAsync("endpoint", "company-name");

            var result = await _companyNamingEngine.GenerateAsync(
                request.Industry,
                request.Keywords,
                request.Tone.ToLower(),
                request.Style!.ToLower(),
                request.Syllables,
                request.Count);

            var response = new CompanyNamingResponseDto
            {
                Industry = result.Industry,
                IndustryLabel = result.IndustryLabel,
                IndustrySuffixes = result.IndustrySuffixes,
                KeywordNotices = result.KeywordNotices,
                TotalCount = result.TotalCount,
                Candidates = result.Candidates.Select(c => new CompanyNameCandidateDto
                {
                    Name = c.Name,
                    Style = c.Style,
                    StyleLabel = c.StyleLabel,
                    Hanja = c.Hanja,
                    Parts = c.Parts.Select(p => new CompanyNamePartDto
                    {
                        Symbol = p.Symbol,
                        Reading = p.Reading,
                        Meaning = p.Meaning,
                    }).ToList(),
                    Meaning = c.Meaning,
                    Romanization = c.Romanization,
                    UsageExamples = c.UsageExamples,
                    TotalScore = c.TotalScore,
                    Memorability = c.Scores.Memorability,
                    Pronunciation = c.Scores.Pronunciation,
                    Distinctiveness = c.Scores.Distinctiveness,
                    IndustryFit = c.Scores.IndustryFit,
                    Reasons = c.Reasons,
                    Cautions = c.Cautions,
                }).ToList(),
            };

            _logger.LogInformation("상호 작명 완료: 후보수={CandidateCount}", response.TotalCount);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "상호 작명 요청 검증 실패");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "상호 작명 중 오류 발생");
            return StatusCode(500, new { error = "상호 작명 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 입력 옵션 목록 (업종 · 톤 · 생성 축).
    /// 프론트 셀렉트를 백엔드 데이터와 한 곳에서 맞추기 위한 엔드포인트.
    /// </summary>
    [HttpGet("options")]
    public ActionResult<CompanyNamingOptionsDto> GetOptions()
    {
        return Ok(new CompanyNamingOptionsDto
        {
            Industries = CompanyNamingData.AllIndustries
                .Select(i => new CompanyOptionDto { Key = i.Key, Label = i.Label })
                .ToList(),
            Tones = CompanyNamingData.Tones.Values
                .Select(t => new CompanyOptionDto { Key = t.Key, Label = t.Label })
                .ToList(),
            Styles = new List<CompanyOptionDto>
            {
                new() { Key = "all", Label = "전체" },
                new() { Key = "hanja", Label = "한자 조합" },
                new() { Key = "pure-korean", Label = "순우리말" },
                new() { Key = "english", Label = "영문 조어" },
            },
        });
    }
}
