using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;
using NameForm.Domain.Models;
using NameForm.Infrastructure.Repositories;
using System.Linq;

namespace NameForm.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[EnableRateLimiting("expensive")] // 추천/평가/분석 — CPU 큰 작업이라 IP당 분당 20회로 제한
public class RecommendationsController : ControllerBase
{
    private readonly IRecommendationService _recommendationService;
    private readonly IRecommendationRepository _repository;
    private readonly ILogger<RecommendationsController> _logger;
    private readonly IParentBasedNamingEngine _parentBasedNamingEngine;
    private readonly IDualNameEngine _dualNameEngine;
    private readonly INicknameEngine _nicknameEngine;
    private readonly IRequiredCharEngine _requiredCharEngine;
    private readonly IPureKoreanNameEngine _pureKoreanNameEngine;
    private readonly IRareSurnameEngine _rareSurnameEngine;
    private readonly IThreeSyllableEngine _threeSyllableEngine;
    private readonly ICreativeNamingEngine _creativeNamingEngine;
    private readonly ISmartRecommendationService _smartRecommendationService;
    private readonly INameEvaluationService _nameEvaluationService;
    private readonly IUsageTracker _usageTracker;

    public RecommendationsController(
        IRecommendationService recommendationService,
        IRecommendationRepository repository,
        ILogger<RecommendationsController> logger,
        IParentBasedNamingEngine parentBasedNamingEngine,
        IDualNameEngine dualNameEngine,
        INicknameEngine nicknameEngine,
        IRequiredCharEngine requiredCharEngine,
        IPureKoreanNameEngine pureKoreanNameEngine,
        IRareSurnameEngine rareSurnameEngine,
        IThreeSyllableEngine threeSyllableEngine,
        ICreativeNamingEngine creativeNamingEngine,
        ISmartRecommendationService smartRecommendationService,
        INameEvaluationService nameEvaluationService,
        IUsageTracker usageTracker)
    {
        _recommendationService = recommendationService;
        _repository = repository;
        _logger = logger;
        _parentBasedNamingEngine = parentBasedNamingEngine;
        _dualNameEngine = dualNameEngine;
        _nicknameEngine = nicknameEngine;
        _requiredCharEngine = requiredCharEngine;
        _pureKoreanNameEngine = pureKoreanNameEngine;
        _rareSurnameEngine = rareSurnameEngine;
        _threeSyllableEngine = threeSyllableEngine;
        _creativeNamingEngine = creativeNamingEngine;
        _smartRecommendationService = smartRecommendationService;
        _nameEvaluationService = nameEvaluationService;
        _usageTracker = usageTracker;
    }

    /// <summary>
    /// 이름 추천 생성
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<RecommendationResponseDto>> CreateRecommendation(
        [FromBody] CreateRecommendationRequestDto request)
    {
        try
        {
            // 입력 검증
            if (string.IsNullOrWhiteSpace(request.LastName))
            {
                return BadRequest(new { error = "LastName은 필수입니다." });
            }

            if (string.IsNullOrWhiteSpace(request.BirthDate))
            {
                return BadRequest(new { error = "BirthDate는 필수입니다." });
            }

            if (!DateTime.TryParse(request.BirthDate, out _))
            {
                return BadRequest(new { error = "BirthDate는 YYYY-MM-DD 형식이어야 합니다. (예: 2024-01-15)" });
            }

            var validGenders = new[] { "male", "female", "none" };
            if (!validGenders.Contains(request.Gender?.ToLower()))
            {
                return BadRequest(new { error = $"Gender는 다음 중 하나여야 합니다: {string.Join(", ", validGenders)}" });
            }

            var validTones = new[] { "neutral", "soft", "strong" };
            if (!validTones.Contains(request.Tone?.ToLower()))
            {
                return BadRequest(new { error = $"Tone은 다음 중 하나여야 합니다: {string.Join(", ", validTones)}" });
            }

            _logger.LogInformation("이름 추천 요청: 성={LastName}, 성별={Gender}, 톤={Tone}, 생년월일={BirthDate}",
                request.LastName, request.Gender, request.Tone, request.BirthDate);

            var result = await _recommendationService.CreateRecommendationAsync(request);

            _logger.LogInformation("이름 추천 완료: ID={RecommendationId}, 후보수={CandidateCount}",
                result.Id, result.TopCandidates?.Count ?? 0);

            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "이름 추천 요청 검증 실패");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "이름 추천 생성 중 오류 발생");
            return StatusCode(500, new { error = "서버 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 한자 데이터 통계 조회 (디버깅/확인용)
    /// 향후 hanjadict, Unihan 데이터 통합 상태도 모니터링 가능
    /// </summary>
    [HttpGet("hanja-stats")]
    public ActionResult<object> GetHanjaStats()
    {
        try
        {
            var allHanja = HanjaData.GetAllHanja();
            var withCategory = allHanja.Where(h => !string.IsNullOrEmpty(h.Category) && h.Category != "기타").ToList();
            var withMeaning = allHanja.Where(h => !string.IsNullOrEmpty(h.Meaning)).ToList();
            var withFiveElement = allHanja.Where(h => !string.IsNullOrEmpty(h.FiveElement)).ToList();
            var withUnicode = allHanja.Where(h => !string.IsNullOrEmpty(h.Unicode)).ToList();
            var withStrokeCount = allHanja.Where(h => h.StrokeCount > 0).ToList();
            var withYinYang = allHanja.Where(h => !string.IsNullOrEmpty(h.YinYang)).ToList();
            var categorized = allHanja.Where(h => !string.IsNullOrEmpty(h.Category)).ToList();
            var uncategorized = allHanja.Where(h => string.IsNullOrEmpty(h.Category) || h.Category == "기타").ToList();

            // 카테고리별 상세 통계 (기존 형식)
            var categoryStats = allHanja
                .Where(h => !string.IsNullOrEmpty(h.Category))
                .GroupBy(h => h.Category)
                .ToDictionary(
                    g => g.Key, 
                    g => new
                    {
                        count = g.Count(),
                        withMeaning = g.Count(h => !string.IsNullOrEmpty(h.Meaning)),
                        withFiveElement = g.Count(h => !string.IsNullOrEmpty(h.FiveElement)),
                        withStrokeCount = g.Count(h => h.StrokeCount > 0)
                    }
                );
            
            // 확장된 카테고리 통계 (새 스키마)
            var withExtendedCategory = allHanja.Where(h => !string.IsNullOrEmpty(h.CategoryMajor)).ToList();
            var extendedCategoryStats = new
            {
                totalWithExtended = withExtendedCategory.Count,
                byMajor = allHanja
                    .Where(h => !string.IsNullOrEmpty(h.CategoryMajor))
                    .GroupBy(h => h.CategoryMajor)
                    .ToDictionary(
                        g => g.Key,
                        g => new
                        {
                            count = g.Count(),
                            byMinor = g
                                .Where(h => !string.IsNullOrEmpty(h.CategoryMinor))
                                .GroupBy(h => h.CategoryMinor)
                                .ToDictionary(
                                    mg => mg.Key,
                                    mg => mg.Count()
                                )
                        }
                    ),
                confidenceDistribution = new
                {
                    high = withExtendedCategory.Count(h => h.CategoryConfidence >= 0.8),
                    medium = withExtendedCategory.Count(h => h.CategoryConfidence >= 0.5 && h.CategoryConfidence < 0.8),
                    low = withExtendedCategory.Count(h => h.CategoryConfidence > 0 && h.CategoryConfidence < 0.5),
                    none = withExtendedCategory.Count(h => h.CategoryConfidence == 0)
                },
                averageConfidence = withExtendedCategory.Count > 0 
                    ? Math.Round(withExtendedCategory.Average(h => h.CategoryConfidence), 3)
                    : 0.0
            };

            // 데이터 완성도 점수 계산
            var completenessScore = CalculateCompletenessScore(allHanja);

            // 데이터 레벨별 분류 (L0 ~ L4)
            var level0 = allHanja.Where(h => 
                !string.IsNullOrEmpty(h.Character) && 
                !string.IsNullOrEmpty(h.Reading) && 
                !string.IsNullOrEmpty(h.Unicode) &&
                string.IsNullOrEmpty(h.Meaning) && 
                h.StrokeCount == 0).ToList(); // 한자/음/유니코드만
            
            var level1 = allHanja.Where(h => 
                !string.IsNullOrEmpty(h.Meaning) && 
                h.StrokeCount == 0 && 
                string.IsNullOrEmpty(h.FiveElement)).ToList(); // 뜻 있음
            
            var level2 = allHanja.Where(h => 
                h.StrokeCount > 0 && 
                (string.IsNullOrEmpty(h.FiveElement) || string.IsNullOrEmpty(h.YinYang))).ToList(); // 획수 있음
            
            var level3 = allHanja.Where(h => 
                !string.IsNullOrEmpty(h.FiveElement) && 
                !string.IsNullOrEmpty(h.YinYang) && 
                h.StrokeCount > 0 &&
                (h.GenderPref == HanjaData.GenderPreference.Neutral && h.TonePref == HanjaData.TonePreference.Neutral)).ToList(); // 오행/음양 있음
            
            var level4 = allHanja.Where(h => 
                !string.IsNullOrEmpty(h.FiveElement) && 
                !string.IsNullOrEmpty(h.YinYang) && 
                h.StrokeCount > 0 &&
                (h.GenderPref != HanjaData.GenderPreference.Neutral || h.TonePref != HanjaData.TonePreference.Neutral)).ToList(); // 톤/성별선호까지 있음 (작명용 풀셋)

            return Ok(new
            {
                summary = new
                {
                    totalCount = allHanja.Count,
                    categorizedCount = categorized.Count,
                    uncategorizedCount = uncategorized.Count,
                    categorizedPercentage = allHanja.Count > 0 ? Math.Round((double)categorized.Count / allHanja.Count * 100, 2) : 0
                },
                dataQuality = new
                {
                    withCategory = categorized.Count,
                    withMeaning = withMeaning.Count,
                    withFiveElement = withFiveElement.Count,
                    withUnicode = withUnicode.Count,
                    withStrokeCount = withStrokeCount.Count,
                    withYinYang = withYinYang.Count,
                    completenessScore = completenessScore
                },
                dataLevels = new
                {
                    L0_Basic = new
                    {
                        count = level0.Count,
                        percentage = allHanja.Count > 0 ? Math.Round((double)level0.Count / allHanja.Count * 100, 2) : 0,
                        description = "한자/음/유니코드만 있음"
                    },
                    L1_WithMeaning = new
                    {
                        count = level1.Count,
                        percentage = allHanja.Count > 0 ? Math.Round((double)level1.Count / allHanja.Count * 100, 2) : 0,
                        description = "뜻(meaning_ko) 있음"
                    },
                    L2_WithStrokeCount = new
                    {
                        count = level2.Count,
                        percentage = allHanja.Count > 0 ? Math.Round((double)level2.Count / allHanja.Count * 100, 2) : 0,
                        description = "획수 있음"
                    },
                    L3_WithFiveElement = new
                    {
                        count = level3.Count,
                        percentage = allHanja.Count > 0 ? Math.Round((double)level3.Count / allHanja.Count * 100, 2) : 0,
                        description = "오행/음양 있음"
                    },
                    L4_FullSet = new
                    {
                        count = level4.Count,
                        percentage = allHanja.Count > 0 ? Math.Round((double)level4.Count / allHanja.Count * 100, 2) : 0,
                        description = "톤/성별선호/설명 템플릿까지 있음 (작명용 풀셋)"
                    }
                },
                categories = categoryStats,
                extendedCategories = extendedCategoryStats,
                dataSources = new
                {
                    fromCsv = allHanja.Count(h => !string.IsNullOrEmpty(h.Unicode)),
                    fromDetailed = level4.Count, // L4 레벨 = 상세 데이터
                    fromJson = allHanja.Count - level4.Count, // JSON에서 로드된 데이터
                    // hanjadict, Unihan 데이터 통합 상태
                    fromHanjadict = withMeaning.Count(h => !string.IsNullOrEmpty(h.Meaning) && 
                        !h.Meaning.Contains("(same as") && !h.Meaning.Contains("capital form")), // Unihan definition 제외
                    fromUnihan = withStrokeCount.Count(h => h.StrokeCount > 0) // 획수 정보가 있는 한자
                },
                recommendations = new
                {
                    needsMeaningData = level0.Count,
                    needsCategoryClassification = uncategorized.Count,
                    needsFiveElementData = allHanja.Count - withFiveElement.Count,
                    needsStrokeCountData = allHanja.Count - withStrokeCount.Count
                },
                sampleHanja = new
                {
                    categorized = categorized.Take(5).Select(h => new
                    {
                        h.Character,
                        h.Reading,
                        h.Category,
                        h.Meaning,
                        hasUnicode = !string.IsNullOrEmpty(h.Unicode),
                        hasFiveElement = !string.IsNullOrEmpty(h.FiveElement)
                    }),
                    uncategorized = uncategorized.Take(5).Select(h => new
                    {
                        h.Character,
                        h.Reading,
                        h.Category,
                        hasUnicode = !string.IsNullOrEmpty(h.Unicode)
                    })
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "한자 데이터 로드 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 추천 결과 조회 (공유용)
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<RecommendationResponseDto>> GetRecommendation(string id)
    {
        var result = await _recommendationService.GetRecommendationAsync(id);

        if (result == null)
        {
            _logger.LogWarning("추천 결과 조회 실패: ID={RecommendationId} 없음", id);
            return NotFound();
        }

        _logger.LogInformation("추천 결과 조회: ID={RecommendationId}", id);
        return Ok(result);
    }

    /// <summary>
    /// 사용자 피드백 제출 (향후 확장: 데이터 수집 및 모델 보정)
    /// </summary>
    [HttpPost("feedback")]
    public async Task<ActionResult<UserFeedbackResponseDto>> SubmitFeedback(
        [FromBody] CreateUserFeedbackDto feedback)
    {
        try
        {
            // 입력 검증
            if (string.IsNullOrWhiteSpace(feedback.RecommendationId))
            {
                return BadRequest(new { error = "RecommendationId는 필수입니다." });
            }

            if (string.IsNullOrWhiteSpace(feedback.Name))
            {
                return BadRequest(new { error = "Name은 필수입니다." });
            }

            var validFeedbackTypes = new[] { "like", "dislike", "selected", "rejected" };
            if (!validFeedbackTypes.Contains(feedback.FeedbackType?.ToLower()))
            {
                return BadRequest(new { error = $"FeedbackType은 다음 중 하나여야 합니다: {string.Join(", ", validFeedbackTypes)}" });
            }

            _logger.LogInformation("피드백 수신: 추천ID={RecommendationId}, 이름={Name}, 유형={FeedbackType}",
                feedback.RecommendationId, feedback.Name, feedback.FeedbackType);

            // 추천 결과 존재 확인
            var recommendation = await _recommendationService.GetRecommendationAsync(feedback.RecommendationId);
            if (recommendation == null)
            {
                return NotFound(new { error = "해당 추천 결과를 찾을 수 없습니다." });
            }

            // 피드백 저장
            var userFeedback = new UserFeedback
            {
                Id = Guid.NewGuid().ToString("N")[..12],
                RecommendationId = feedback.RecommendationId,
                Name = feedback.Name,
                LastName = feedback.LastName,
                FeedbackType = feedback.FeedbackType ?? string.Empty,
                Reason = feedback.Reason,
                SubjectiveAestheticScore = feedback.SubjectiveAestheticScore,
                SubjectiveHarmonyScore = feedback.SubjectiveHarmonyScore,
                CreatedAt = DateTime.UtcNow
            };

            await _repository.SaveFeedbackAsync(userFeedback);
            _logger.LogInformation("피드백 저장 완료: ID={FeedbackId}", userFeedback.Id);

            var response = new UserFeedbackResponseDto
            {
                Id = userFeedback.Id,
                RecommendationId = userFeedback.RecommendationId,
                Name = userFeedback.Name,
                FeedbackType = userFeedback.FeedbackType,
                Reason = userFeedback.Reason,
                CreatedAt = userFeedback.CreatedAt
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "피드백 제출 중 오류 발생");
            return StatusCode(500, new { error = "피드백 제출 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 특정 추천에 대한 피드백 목록 조회
    /// </summary>
    [HttpGet("{recommendationId}/feedback")]
    public async Task<ActionResult<FeedbackListResponseDto>> GetFeedbackByRecommendationId(string recommendationId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(recommendationId))
            {
                return BadRequest(new { error = "RecommendationId는 필수입니다." });
            }

            // 추천 결과 존재 확인
            var recommendation = await _recommendationService.GetRecommendationAsync(recommendationId);
            if (recommendation == null)
            {
                return NotFound(new { error = "해당 추천 결과를 찾을 수 없습니다." });
            }

            var feedbacks = await _repository.GetFeedbackByRecommendationIdAsync(recommendationId);

            var response = new FeedbackListResponseDto
            {
                RecommendationId = recommendationId,
                TotalCount = feedbacks.Count,
                Feedbacks = feedbacks.Select(f => new UserFeedbackResponseDto
                {
                    Id = f.Id,
                    RecommendationId = f.RecommendationId,
                    Name = f.Name,
                    FeedbackType = f.FeedbackType,
                    Reason = f.Reason,
                    CreatedAt = f.CreatedAt
                }).ToList()
            };

            _logger.LogInformation("피드백 조회: 추천ID={RecommendationId}, 건수={Count}",
                recommendationId, feedbacks.Count);

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "피드백 조회 중 오류 발생");
            return StatusCode(500, new { error = "피드백 조회 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 특정 추천에 대한 피드백 집계/요약 조회
    /// </summary>
    [HttpGet("{recommendationId}/feedback/summary")]
    public async Task<ActionResult<FeedbackSummaryResponseDto>> GetFeedbackSummary(string recommendationId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(recommendationId))
            {
                return BadRequest(new { error = "RecommendationId는 필수입니다." });
            }

            // 추천 결과 존재 확인
            var recommendation = await _recommendationService.GetRecommendationAsync(recommendationId);
            if (recommendation == null)
            {
                return NotFound(new { error = "해당 추천 결과를 찾을 수 없습니다." });
            }

            var feedbacks = await _repository.GetFeedbackByRecommendationIdAsync(recommendationId);

            // 피드백 타입별 집계
            var feedbackTypeCounts = feedbacks
                .GroupBy(f => f.FeedbackType.ToLower())
                .ToDictionary(g => g.Key, g => g.Count());

            // 주관적 점수 평균 계산
            var aestheticScores = feedbacks
                .Where(f => f.SubjectiveAestheticScore.HasValue)
                .Select(f => f.SubjectiveAestheticScore!.Value)
                .ToList();

            var harmonyScores = feedbacks
                .Where(f => f.SubjectiveHarmonyScore.HasValue)
                .Select(f => f.SubjectiveHarmonyScore!.Value)
                .ToList();

            // 이름별 피드백 요약
            var nameSummaries = feedbacks
                .GroupBy(f => f.Name)
                .Select(g =>
                {
                    var nameAestheticScores = g
                        .Where(f => f.SubjectiveAestheticScore.HasValue)
                        .Select(f => f.SubjectiveAestheticScore!.Value)
                        .ToList();
                    var nameHarmonyScores = g
                        .Where(f => f.SubjectiveHarmonyScore.HasValue)
                        .Select(f => f.SubjectiveHarmonyScore!.Value)
                        .ToList();

                    return new NameFeedbackSummaryDto
                    {
                        Name = g.Key,
                        LikeCount = g.Count(f => f.FeedbackType.Equals("like", StringComparison.OrdinalIgnoreCase)),
                        DislikeCount = g.Count(f => f.FeedbackType.Equals("dislike", StringComparison.OrdinalIgnoreCase)),
                        SelectedCount = g.Count(f => f.FeedbackType.Equals("selected", StringComparison.OrdinalIgnoreCase)),
                        RejectedCount = g.Count(f => f.FeedbackType.Equals("rejected", StringComparison.OrdinalIgnoreCase)),
                        AverageAestheticScore = nameAestheticScores.Count > 0
                            ? Math.Round(nameAestheticScores.Average(), 1) : null,
                        AverageHarmonyScore = nameHarmonyScores.Count > 0
                            ? Math.Round(nameHarmonyScores.Average(), 1) : null
                    };
                })
                .OrderByDescending(n => n.LikeCount + n.SelectedCount)
                .ThenBy(n => n.DislikeCount + n.RejectedCount)
                .ToList();

            var response = new FeedbackSummaryResponseDto
            {
                RecommendationId = recommendationId,
                TotalFeedbackCount = feedbacks.Count,
                FeedbackTypeCounts = feedbackTypeCounts,
                AverageSubjectiveAestheticScore = aestheticScores.Count > 0
                    ? Math.Round(aestheticScores.Average(), 1) : null,
                AverageSubjectiveHarmonyScore = harmonyScores.Count > 0
                    ? Math.Round(harmonyScores.Average(), 1) : null,
                NameSummaries = nameSummaries
            };

            _logger.LogInformation("피드백 집계 조회: 추천ID={RecommendationId}, 총건수={TotalCount}, 이름수={NameCount}",
                recommendationId, feedbacks.Count, nameSummaries.Count);

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "피드백 집계 조회 중 오류 발생");
            return StatusCode(500, new { error = "피드백 집계 조회 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 필수 글자 포함 이름 추천 (돌림자/지정 글자)
    /// </summary>
    [HttpPost("required-char")]
    public async Task<ActionResult<List<RequiredCharCandidate>>> GenerateRequiredCharNames(
        [FromBody] RequiredCharRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "성(LastName)은 필수입니다." });

            // RequiredChar 또는 RequiredHanja 둘 중 하나는 필수
            if (string.IsNullOrWhiteSpace(request.RequiredChar) && string.IsNullOrWhiteSpace(request.RequiredHanja))
                return BadRequest(new { error = "필수 글자(RequiredChar) 또는 항렬자(RequiredHanja) 중 하나는 필수입니다." });

            if (!string.IsNullOrWhiteSpace(request.RequiredChar) && request.RequiredChar.Length != 1)
                return BadRequest(new { error = "RequiredChar는 한 글자여야 합니다." });

            if (!string.IsNullOrWhiteSpace(request.RequiredHanja) && request.RequiredHanja.Length != 1)
                return BadRequest(new { error = "RequiredHanja는 한자 한 글자여야 합니다." });

            var validPositions = new[] { "first", "last", "any" };
            if (!validPositions.Contains(request.Position?.ToLower()))
                return BadRequest(new { error = "Position은 'first', 'last', 'any' 중 하나여야 합니다." });

            if (string.IsNullOrWhiteSpace(request.BirthDate) || !DateTime.TryParse(request.BirthDate, out var birthDate))
                return BadRequest(new { error = "BirthDate는 필수이며 YYYY-MM-DD 형식이어야 합니다." });

            var validGenders = new[] { "male", "female", "none" };
            if (!string.IsNullOrEmpty(request.Gender) && !validGenders.Contains(request.Gender.ToLower()))
                return BadRequest(new { error = "Gender는 'male', 'female', 'none' 중 하나여야 합니다." });

            var validTones = new[] { "neutral", "soft", "strong" };
            if (!string.IsNullOrEmpty(request.Tone) && !validTones.Contains(request.Tone.ToLower()))
                return BadRequest(new { error = "Tone은 'neutral', 'soft', 'strong' 중 하나여야 합니다." });

            _logger.LogInformation("필수 글자 이름 요청: 성={LastName}, 글자={RequiredChar}, 위치={Position}",
                request.LastName, request.RequiredChar, request.Position);
            await _usageTracker.TrackAsync("endpoint", "required-char");

            var candidates = await _requiredCharEngine.GenerateCandidatesAsync(
                request.LastName,
                request.RequiredChar,
                request.Position ?? "any",
                birthDate,
                request.Gender ?? "none",
                request.Tone ?? "neutral",
                requiredHanja: request.RequiredHanja);

            _logger.LogInformation("필수 글자 이름 완료: 후보수={CandidateCount}", candidates.Count);

            return Ok(candidates);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "필수 글자 이름 입력 오류");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "필수 글자 이름 생성 중 오류");
            return StatusCode(500, new { error = "필수 글자 이름 생성 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 부모 기반 이름 추천 생성
    /// </summary>
    [HttpPost("parent-based")]
    public async Task<ActionResult<List<ParentBasedNameCandidate>>> GenerateParentBasedNames(
        [FromBody] ParentBasedRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "LastName은 필수입니다." });

            if (string.IsNullOrWhiteSpace(request.BirthDate) || !DateTime.TryParse(request.BirthDate, out var birthDate))
                return BadRequest(new { error = "BirthDate는 필수이며 YYYY-MM-DD 형식이어야 합니다." });

            var validGenders = new[] { "male", "female", "none" };
            if (!validGenders.Contains(request.Gender?.ToLower()))
                return BadRequest(new { error = $"Gender는 다음 중 하나여야 합니다: {string.Join(", ", validGenders)}" });

            var validTones = new[] { "neutral", "soft", "strong" };
            if (!validTones.Contains(request.Tone?.ToLower()))
                return BadRequest(new { error = $"Tone은 다음 중 하나여야 합니다: {string.Join(", ", validTones)}" });

            _logger.LogInformation("부모 기반 작명 요청: 성={LastName}, 성별={Gender}, 톤={Tone}",
                request.LastName, request.Gender, request.Tone);
            await _usageTracker.TrackAsync("endpoint", "parent-based");

            var candidates = await _parentBasedNamingEngine.GenerateCandidatesAsync(
                request.LastName,
                request.FatherSurname,
                request.FatherName,
                request.MotherSurname,
                request.MotherName,
                request.StoryKeyword,
                birthDate,
                request.Gender?.ToLower() ?? "none",
                request.Tone?.ToLower() ?? "neutral");

            _logger.LogInformation("부모 기반 작명 완료: 후보수={CandidateCount}", candidates.Count);
            return Ok(candidates);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "부모 기반 작명 요청 검증 실패");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "부모 기반 작명 중 오류 발생");
            return StatusCode(500, new { error = "부모 기반 작명 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 영어+한자 이중 이름 생성
    /// </summary>
    [HttpPost("dual-name")]
    public async Task<ActionResult<List<DualNameCandidate>>> GenerateDualNames(
        [FromBody] DualNameRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "LastName은 필수입니다." });

            if (string.IsNullOrWhiteSpace(request.BirthDate) || !DateTime.TryParse(request.BirthDate, out var birthDate))
                return BadRequest(new { error = "BirthDate는 필수이며 YYYY-MM-DD 형식이어야 합니다." });

            var validGenders = new[] { "male", "female", "none" };
            if (!validGenders.Contains(request.Gender?.ToLower()))
                return BadRequest(new { error = $"Gender는 다음 중 하나여야 합니다: {string.Join(", ", validGenders)}" });

            var validTones = new[] { "neutral", "soft", "strong" };
            if (!validTones.Contains(request.Tone?.ToLower()))
                return BadRequest(new { error = $"Tone은 다음 중 하나여야 합니다: {string.Join(", ", validTones)}" });

            _logger.LogInformation("이중 이름 요청: 성={LastName}, 영어이름={EnglishName}, 성별={Gender}",
                request.LastName, request.PreferredEnglishName, request.Gender);
            await _usageTracker.TrackAsync("endpoint", "dual-name");

            var candidates = await _dualNameEngine.GenerateDualNamesAsync(
                request.LastName,
                request.PreferredEnglishName,
                birthDate,
                request.Gender?.ToLower() ?? "none",
                request.Tone?.ToLower() ?? "neutral");

            _logger.LogInformation("이중 이름 생성 완료: 후보수={CandidateCount}", candidates.Count);
            return Ok(candidates);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "이중 이름 요청 검증 실패");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "이중 이름 생성 중 오류 발생");
            return StatusCode(500, new { error = "이중 이름 생성 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 별명 생성
    /// </summary>
    [HttpPost("nickname")]
    public async Task<ActionResult<List<string>>> GenerateNicknames(
        [FromBody] NicknameRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "LastName은 필수입니다." });

            if (request.Names == null || request.Names.Count == 0)
                return BadRequest(new { error = "Names는 최소 1개 이상의 이름이 필요합니다." });

            if (request.Names.Any(n => string.IsNullOrWhiteSpace(n)))
                return BadRequest(new { error = "Names에 빈 문자열이 포함될 수 없습니다." });

            _logger.LogInformation("별명 생성 요청: 성={LastName}, 이름수={NameCount}",
                request.LastName, request.Names.Count);
            await _usageTracker.TrackAsync("endpoint", "nickname");

            var nicknames = await _nicknameEngine.GenerateNicknamesAsync(
                request.LastName,
                request.Names);

            _logger.LogInformation("별명 생성 완료: 별명수={NicknameCount}", nicknames.Count);
            return Ok(nicknames);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "별명 생성 요청 검증 실패");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "별명 생성 중 오류 발생");
            return StatusCode(500, new { error = "별명 생성 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 순우리말 이름 추천
    /// </summary>
    [HttpPost("pure-korean")]
    public async Task<ActionResult<PureKoreanResponseDto>> GeneratePureKoreanNames(
        [FromBody] PureKoreanRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "LastName은 필수입니다." });

            var validGenders = new[] { "male", "female", "none" };
            if (!validGenders.Contains(request.Gender?.ToLower()))
                return BadRequest(new { error = $"Gender는 다음 중 하나여야 합니다: {string.Join(", ", validGenders)}" });

            var validTones = new[] { "neutral", "soft", "strong" };
            if (!validTones.Contains(request.Tone?.ToLower()))
                return BadRequest(new { error = $"Tone은 다음 중 하나여야 합니다: {string.Join(", ", validTones)}" });

            if (request.Count < 1 || request.Count > 50)
                return BadRequest(new { error = "Count는 1~50 사이여야 합니다." });

            _logger.LogInformation("순우리말 이름 요청: 성={LastName}, 성별={Gender}, 톤={Tone}, 개수={Count}",
                request.LastName, request.Gender, request.Tone, request.Count);
            await _usageTracker.TrackAsync("endpoint", "pure-korean");

            var candidates = await _pureKoreanNameEngine.GenerateCandidatesAsync(
                request.LastName,
                request.Gender?.ToLower() ?? "none",
                request.Tone?.ToLower() ?? "neutral",
                request.Count);

            var response = new PureKoreanResponseDto
            {
                LastName = request.LastName,
                TotalCount = candidates.Count,
                Candidates = candidates.Select(c => new PureKoreanCandidateDto
                {
                    FullName = request.LastName + c.Name,
                    Name = c.Name,
                    Meaning = c.Meaning,
                    Origin = c.Origin,
                    GenderFit = c.GenderFit,
                    ToneFit = c.ToneFit,
                    PronunciationScore = c.PronunciationScore
                }).ToList()
            };

            _logger.LogInformation("순우리말 이름 완료: 후보수={CandidateCount}", candidates.Count);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "순우리말 이름 요청 검증 실패");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "순우리말 이름 생성 중 오류 발생");
            return StatusCode(500, new { error = "순우리말 이름 생성 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 희귀 성씨 최적화 이름 추천
    /// </summary>
    [HttpPost("rare-surname")]
    public async Task<ActionResult<RareSurnameResponseDto>> GenerateRareSurnameNames(
        [FromBody] RareSurnameRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "LastName은 필수입니다." });

            if (string.IsNullOrWhiteSpace(request.BirthDate) || !DateTime.TryParse(request.BirthDate, out var birthDate))
                return BadRequest(new { error = "BirthDate는 필수이며 YYYY-MM-DD 형식이어야 합니다." });

            var validGenders = new[] { "male", "female", "none" };
            if (!validGenders.Contains(request.Gender?.ToLower()))
                return BadRequest(new { error = $"Gender는 다음 중 하나여야 합니다: {string.Join(", ", validGenders)}" });

            var validTones = new[] { "neutral", "soft", "strong" };
            if (!validTones.Contains(request.Tone?.ToLower()))
                return BadRequest(new { error = $"Tone은 다음 중 하나여야 합니다: {string.Join(", ", validTones)}" });

            if (request.Count < 1 || request.Count > 50)
                return BadRequest(new { error = "Count는 1~50 사이여야 합니다." });

            _logger.LogInformation("희귀 성씨 이름 요청: 성={LastName}, 성별={Gender}, 톤={Tone}, 개수={Count}",
                request.LastName, request.Gender, request.Tone, request.Count);
            await _usageTracker.TrackAsync("endpoint", "rare-surname");

            var analysis = await _rareSurnameEngine.AnalyzeAndRecommendAsync(
                request.LastName,
                birthDate,
                request.Gender?.ToLower() ?? "none",
                request.Tone?.ToLower() ?? "neutral",
                request.Count);

            var response = new RareSurnameResponseDto
            {
                LastName = analysis.LastName,
                IsRareSurname = analysis.IsRareSurname,
                RarityLevel = analysis.RarityLevel,
                PhoneticAnalysis = analysis.PhoneticAnalysis,
                TotalCount = analysis.Candidates.Count,
                Candidates = analysis.Candidates.Select(c => new RareSurnameCandidateDto
                {
                    FullName = request.LastName + c.Name,
                    Name = c.Name,
                    HarmonyScore = c.HarmonyScore,
                    HarmonyReason = c.HarmonyReason,
                    HanjaOptions = c.HanjaOptions
                }).ToList()
            };

            _logger.LogInformation("희귀 성씨 이름 완료: 후보수={CandidateCount}, 희귀도={RarityLevel}",
                response.TotalCount, response.RarityLevel);
            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "희귀 성씨 이름 요청 검증 실패");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "희귀 성씨 이름 생성 중 오류 발생");
            return StatusCode(500, new { error = "희귀 성씨 이름 생성 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 3글자 이름 추천 (성씨+3글자 = 4음절)
    /// </summary>
    [HttpPost("three-syllable")]
    public async Task<ActionResult<List<ThreeSyllableCandidate>>> GenerateThreeSyllableNames(
        [FromBody] ThreeSyllableRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "LastName은 필수입니다." });

            var validGenders = new[] { "male", "female", "none" };
            if (!validGenders.Contains(request.Gender?.ToLower()))
                return BadRequest(new { error = $"Gender는 다음 중 하나여야 합니다: {string.Join(", ", validGenders)}" });

            var validTones = new[] { "neutral", "soft", "strong" };
            if (!validTones.Contains(request.Tone?.ToLower()))
                return BadRequest(new { error = $"Tone은 다음 중 하나여야 합니다: {string.Join(", ", validTones)}" });

            var validNameTypes = new[] { "pure-korean", "hanja", "mixed" };
            if (!validNameTypes.Contains(request.NameType?.ToLower()))
                return BadRequest(new { error = $"NameType은 다음 중 하나여야 합니다: {string.Join(", ", validNameTypes)}" });

            if (request.Count < 1 || request.Count > 50)
                return BadRequest(new { error = "Count는 1~50 사이여야 합니다." });

            _logger.LogInformation("3글자 이름 요청: 성={LastName}, 성별={Gender}, 톤={Tone}, 유형={NameType}, 개수={Count}",
                request.LastName, request.Gender, request.Tone, request.NameType, request.Count);
            await _usageTracker.TrackAsync("endpoint", "three-syllable");

            var candidates = await _threeSyllableEngine.GenerateCandidatesAsync(
                request.LastName,
                request.Gender?.ToLower() ?? "none",
                request.Tone?.ToLower() ?? "neutral",
                request.NameType?.ToLower() ?? "pure-korean",
                request.Count);

            _logger.LogInformation("3글자 이름 완료: 후보수={CandidateCount}", candidates.Count);
            return Ok(candidates);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "3글자 이름 요청 검증 실패");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "3글자 이름 생성 중 오류 발생");
            return StatusCode(500, new { error = "3글자 이름 생성 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 창의적 작명 (성씨 의미 활용)
    /// </summary>
    [HttpPost("creative")]
    public async Task<ActionResult<List<CreativeNameCandidate>>> GenerateCreativeNames(
        [FromBody] CreativeNamingRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "LastName은 필수입니다." });

            var validGenders = new[] { "male", "female", "none" };
            if (!validGenders.Contains(request.Gender?.ToLower()))
                return BadRequest(new { error = $"Gender는 다음 중 하나여야 합니다: {string.Join(", ", validGenders)}" });

            var validTones = new[] { "neutral", "soft", "strong" };
            if (!validTones.Contains(request.Tone?.ToLower()))
                return BadRequest(new { error = $"Tone은 다음 중 하나여야 합니다: {string.Join(", ", validTones)}" });

            if (request.Count < 1 || request.Count > 50)
                return BadRequest(new { error = "Count는 1~50 사이여야 합니다." });

            _logger.LogInformation("창의적 작명 요청: 성={LastName}, 성별={Gender}, 톤={Tone}, 개수={Count}",
                request.LastName, request.Gender, request.Tone, request.Count);
            await _usageTracker.TrackAsync("endpoint", "creative");

            var candidates = await _creativeNamingEngine.GenerateCandidatesAsync(
                request.LastName,
                request.Gender?.ToLower() ?? "none",
                request.Tone?.ToLower() ?? "neutral",
                request.Count);

            _logger.LogInformation("창의적 작명 완료: 후보수={CandidateCount}", candidates.Count);
            return Ok(candidates);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "창의적 작명 요청 검증 실패");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "창의적 작명 중 오류 발생");
            return StatusCode(500, new { error = "창의적 작명 중 오류가 발생했습니다.", message = ex.Message });
        }
    }

    /// <summary>
    /// 통합 스마트 추천 — 입력에 따라 관련 엔진 자동 선택 + 병렬 실행
    /// </summary>
    [HttpPost("smart")]
    public async Task<ActionResult<SmartRecommendationResponseDto>> GenerateSmartRecommendations(
        [FromBody] SmartRecommendationRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.LastName))
                return BadRequest(new { error = "성(LastName)은 필수입니다." });

            if (string.IsNullOrWhiteSpace(request.BirthDate))
                return BadRequest(new { error = "생년월일(BirthDate)은 필수입니다." });

            var validGenders = new HashSet<string> { "male", "female", "none" };
            if (!validGenders.Contains(request.Gender?.ToLower() ?? "none"))
                return BadRequest(new { error = "Gender는 'male', 'female', 'none' 중 하나입니다." });

            var validTones = new HashSet<string> { "neutral", "soft", "strong" };
            if (!validTones.Contains(request.Tone?.ToLower() ?? "neutral"))
                return BadRequest(new { error = "Tone은 'neutral', 'soft', 'strong' 중 하나입니다." });

            await _usageTracker.TrackAsync("endpoint", "smart");
            var result = await _smartRecommendationService.GenerateSmartRecommendationsAsync(request);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "스마트 추천 생성 실패");
            return StatusCode(500, new { error = "스마트 추천 생성 중 오류가 발생했습니다." });
        }
    }

    /// <summary>
    /// 데이터 완성도 점수 계산 (0~100)
    /// </summary>
    private double CalculateCompletenessScore(List<HanjaData.HanjaInfo> allHanja)
    {
        if (allHanja.Count == 0) return 0;

        var totalPossible = allHanja.Count * 6; // 6개 필드: Category, Meaning, FiveElement, Unicode, StrokeCount, YinYang
        var actual = 0;

        foreach (var hanja in allHanja)
        {
            if (!string.IsNullOrEmpty(hanja.Category) && hanja.Category != "기타") actual++;
            if (!string.IsNullOrEmpty(hanja.Meaning)) actual++;
            if (!string.IsNullOrEmpty(hanja.FiveElement)) actual++;
            if (!string.IsNullOrEmpty(hanja.Unicode)) actual++;
            if (hanja.StrokeCount > 0) actual++;
            if (!string.IsNullOrEmpty(hanja.YinYang)) actual++;
        }

        return Math.Round((double)actual / totalPossible * 100, 2);
    }

    /// <summary>
    /// 이름 평가 — 미학/조화/희귀도 breakdown + 한자 후보 + 설명 통합 결과
    /// </summary>
    [HttpPost("evaluate")]
    public async Task<ActionResult<NameEvaluationResultDto>> EvaluateName(
        [FromBody] NameEvaluateRequestDto request)
    {
        try
        {
            // 입력 검증
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { error = "Name은 필수입니다." });
            }

            if (string.IsNullOrWhiteSpace(request.LastName))
            {
                return BadRequest(new { error = "LastName은 필수입니다." });
            }

            if (string.IsNullOrWhiteSpace(request.BirthDate))
            {
                return BadRequest(new { error = "BirthDate는 필수입니다." });
            }

            if (!DateTime.TryParse(request.BirthDate, out var birthDate))
            {
                return BadRequest(new { error = "BirthDate는 YYYY-MM-DD 형식이어야 합니다. (예: 2024-01-15)" });
            }

            var validGenders = new[] { "male", "female", "none" };
            if (!validGenders.Contains(request.Gender?.ToLower()))
            {
                return BadRequest(new { error = $"Gender는 다음 중 하나여야 합니다: {string.Join(", ", validGenders)}" });
            }

            var validTones = new[] { "neutral", "soft", "strong" };
            if (!validTones.Contains(request.Tone?.ToLower()))
            {
                return BadRequest(new { error = $"Tone은 다음 중 하나여야 합니다: {string.Join(", ", validTones)}" });
            }

            _logger.LogInformation("이름 평가 요청: 이름={Name}, 성={LastName}, 성별={Gender}, 톤={Tone}",
                request.Name, request.LastName, request.Gender, request.Tone);
            await _usageTracker.TrackAsync("endpoint", "evaluate");

            TimeSpan? birthTime = null;
            if (!string.IsNullOrEmpty(request.BirthTime) &&
                TimeSpan.TryParse(request.BirthTime, out var parsedBirthTime))
            {
                birthTime = parsedBirthTime;
            }

            var result = await _nameEvaluationService.EvaluateNameAsync(
                request.Name, request.LastName, birthDate,
                request.Gender!.ToLower(), request.Tone!.ToLower(), birthTime);

            _logger.LogInformation("이름 평가 완료: {FullName}, 최종점수={FinalScore}",
                result.FullName, result.FinalScore);

            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "이름 평가 요청 검증 실패");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "이름 평가 중 오류 발생");
            return StatusCode(500, new { error = "서버 오류가 발생했습니다.", message = ex.Message });
        }
    }
}
