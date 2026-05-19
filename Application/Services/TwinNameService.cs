using NameForm.Application.DTOs;
using NameForm.Application.Engines;

namespace NameForm.Application.Services;

/// <summary>
/// 쌍둥이/형제 이름 서비스
/// TwinNameEngine으로 세트 생성 후 개별 채점
/// </summary>
public class TwinNameService : ITwinNameService
{
    private readonly ITwinNameEngine _twinNameEngine;
    private readonly IScoringService _scoringService;
    private readonly IExplanationEngine _explanationEngine;
    private readonly ILogger<TwinNameService> _logger;

    public TwinNameService(
        ITwinNameEngine twinNameEngine,
        IScoringService scoringService,
        IExplanationEngine explanationEngine,
        ILogger<TwinNameService> logger)
    {
        _twinNameEngine = twinNameEngine;
        _scoringService = scoringService;
        _explanationEngine = explanationEngine;
        _logger = logger;
    }

    public async Task<TwinNameResponseDto> GenerateTwinNamesAsync(TwinNameRequestDto request)
    {
        _logger.LogInformation("쌍둥이 이름 요청: 성={LastName}, 자녀수={ChildCount}",
            request.LastName, request.ChildCount);

        var birthDate = DateTime.TryParse(request.BirthDate, out var bd) ? bd : DateTime.Now;
        var gender = request.Gender ?? "none";
        var tone = request.Tone ?? "neutral";

        TimeSpan? birthTime = null;
        if (!string.IsNullOrEmpty(request.BirthTime) &&
            TimeSpan.TryParse(request.BirthTime, out var parsedBirthTime))
        {
            birthTime = parsedBirthTime;
        }

        // 세트 생성
        var twinSets = await _twinNameEngine.GenerateTwinSetsAsync(
            request.LastName, birthDate, gender, tone,
            request.ChildCount, request.ExistingSiblingNames);

        // 각 이름 개별 채점
        var scoredSets = new List<TwinNameSetDto>();
        foreach (var set in twinSets)
        {
            var scoredNames = new List<TwinCandidateDto>();
            foreach (var name in set.Names)
            {
                // ScoringService 단일 진입점 — smart/evaluate와 점수 동등성 보장
                var score = await _scoringService.EvaluateAsync(
                    name, request.LastName, birthDate, gender, tone, birthTime);
                var reasons = await _explanationEngine.GenerateReasonsAsync(
                    name, score.AestheticScore, score.HarmonyScore);

                scoredNames.Add(new TwinCandidateDto
                {
                    Name = name,
                    AestheticScore = score.AestheticScore,
                    HarmonyScore = score.HarmonyScore,
                    FinalScore = score.FinalScore,
                    Reasons = reasons
                });
            }

            scoredSets.Add(new TwinNameSetDto
            {
                Theme = set.Theme,
                ThemeDescription = set.ThemeDescription,
                Names = scoredNames,
                CoherenceScore = set.CoherenceScore
            });
        }

        // 세트를 조화도 순으로 정렬, 상위 10개
        scoredSets = scoredSets
            .OrderByDescending(s => s.CoherenceScore)
            .ThenByDescending(s => s.Names.Average(n => n.FinalScore))
            .Take(10)
            .ToList();

        return new TwinNameResponseDto
        {
            Id = Guid.NewGuid().ToString("N")[..12],
            NameSets = scoredSets
        };
    }
}
