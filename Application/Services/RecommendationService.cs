using Microsoft.Extensions.Logging;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Domain.Models;
using NameForm.Infrastructure.Repositories;

namespace NameForm.Application.Services;

public class RecommendationService : IRecommendationService
{
    private readonly IRecommendationRepository _repository;
    private readonly INamePoolEngine _namePoolEngine;
    private readonly IScoringService _scoringService;
    private readonly IRankerEngine _rankerEngine;
    private readonly IExplanationEngine _explanationEngine;
    private readonly IParentBasedNamingEngine _parentBasedNamingEngine;
    private readonly IDualNameEngine _dualNameEngine;
    private readonly ILogger<RecommendationService> _logger;

    public RecommendationService(
        IRecommendationRepository repository,
        INamePoolEngine namePoolEngine,
        IScoringService scoringService,
        IRankerEngine rankerEngine,
        IExplanationEngine explanationEngine,
        IParentBasedNamingEngine parentBasedNamingEngine,
        IDualNameEngine dualNameEngine,
        ILogger<RecommendationService> logger)
    {
        _repository = repository;
        _namePoolEngine = namePoolEngine;
        _scoringService = scoringService;
        _rankerEngine = rankerEngine;
        _explanationEngine = explanationEngine;
        _parentBasedNamingEngine = parentBasedNamingEngine;
        _dualNameEngine = dualNameEngine;
        _logger = logger;
    }

    public async Task<RecommendationResponseDto> CreateRecommendationAsync(CreateRecommendationRequestDto request)
    {
        // 1. 입력 검증
        if (!DateTime.TryParse(request.BirthDate, out var birthDate))
        {
            throw new ArgumentException("Invalid birth date format");
        }

        TimeSpan? birthTime = null;
        if (!string.IsNullOrEmpty(request.BirthTime) &&
            TimeSpan.TryParse(request.BirthTime, out var parsedBirthTime))
        {
            birthTime = parsedBirthTime;
        }

        // 2. 이름 후보 생성
        _logger.LogDebug("이름 후보 생성 시작: 성={LastName}, 성별={Gender}, 톤={Tone}", request.LastName, request.Gender, request.Tone);
        var nameCandidates = await _namePoolEngine.GenerateCandidatesAsync(
            request.LastName,
            birthDate,
            request.Gender,
            request.Tone,
            nameLength: 2,
            preferredMeanings: request.PreferredMeanings);

        // 2-1. 부모 기반 이름 후보 생성 (부모 정보가 있는 경우)
        var parentBasedCandidates = new List<string>();
        var parentBasedCandidateInfo = new Dictionary<string, (string model, string type)>();
        
        if (!string.IsNullOrEmpty(request.FatherSurname) || 
            !string.IsNullOrEmpty(request.MotherSurname) || 
            !string.IsNullOrEmpty(request.StoryKeyword))
        {
            var parentCandidates = await _parentBasedNamingEngine.GenerateCandidatesAsync(
                request.LastName,
                request.FatherSurname,
                request.FatherName,
                request.MotherSurname,
                request.MotherName,
                request.StoryKeyword,
                birthDate,
                request.Gender,
                request.Tone);

            foreach (var pc in parentCandidates)
            {
                parentBasedCandidates.Add(pc.Name);
                parentBasedCandidateInfo[pc.Name] = (pc.NamingModel, pc.NameType);
            }
        }

        // 2-2. 영어+한자 이중 이름 후보 생성 (영어 이름이 지정된 경우)
        var dualNameCandidates = new List<string>();
        var dualNameInfo = new Dictionary<string, DualNameCandidate>();

        if (!string.IsNullOrEmpty(request.PreferredEnglishName))
        {
            var dualCandidates = await _dualNameEngine.GenerateDualNamesAsync(
                request.LastName,
                request.PreferredEnglishName,
                birthDate,
                request.Gender,
                request.Tone);

            foreach (var dc in dualCandidates)
            {
                dualNameCandidates.Add(dc.KoreanName);
                dualNameInfo[dc.KoreanName] = dc;
            }
        }

        // 기존 후보와 부모 기반 + 이중 이름 후보 합치기
        var allCandidates = nameCandidates
            .Union(parentBasedCandidates)
            .Union(dualNameCandidates)
            .Distinct().ToList();
        _logger.LogDebug("후보 생성 완료: 기본={BaseCount}, 부모기반={ParentCount}, 합계={TotalCount}",
            nameCandidates.Count, parentBasedCandidates.Count, allCandidates.Count);

        // 3. 각 후보에 대해 점수 계산
        var scoredCandidates = new List<Candidate>();
        
        foreach (var name in allCandidates)
        {
            // 단일 진실의 원천: ScoringService — 어떤 페이지든 동일한 결과 보장
            var score = await _scoringService.EvaluateAsync(
                name, request.LastName, birthDate, request.Gender, request.Tone, birthTime);

            var reasons = await _explanationEngine.GenerateReasonsAsync(
                name, score.AestheticScore, score.HarmonyScore);

            // 부모 기반 후보인지 확인
            var (namingModel, nameType) = parentBasedCandidateInfo.TryGetValue(name, out var info)
                ? (info.model, info.type)
                : (null, DetermineNameType(name));

            // 이중 이름 정보
            var englishEquivalent = dualNameInfo.TryGetValue(name, out var dualInfo) ? dualInfo.EnglishEquivalent : null;
            var hanjaMeaning = dualInfo?.HanjaMeaning;

            scoredCandidates.Add(new Candidate
            {
                Name = name,
                AestheticScore = score.AestheticScore,
                HarmonyScore = score.HarmonyScore,
                FinalScore = 0, // RankerEngine에서 계산
                Reasons = reasons,
                NamingModel = namingModel,
                NameType = nameType,
                RarityScore = score.RarityScore,
                EnglishEquivalent = englishEquivalent,
                HanjaMeaning = hanjaMeaning
            });
        }

        // 4. 랭킹 및 최종 점수 계산
        _logger.LogDebug("점수 계산 완료, 랭킹 시작: 후보수={CandidateCount}", scoredCandidates.Count);
        var rankedCandidates = await _rankerEngine.RankCandidatesAsync(
            scoredCandidates, request.PreferredFiveElement);
        var topCandidates = rankedCandidates.Take(10).ToList();

        // 5. Recommendation 생성 및 저장
        var recommendation = new Recommendation
        {
            Id = Guid.NewGuid().ToString("N")[..12], // 12자리 ID
            LastName = request.LastName,
            BirthDate = birthDate,
            Gender = request.Gender,
            Tone = request.Tone,
            TopCandidates = topCandidates
        };

        await _repository.SaveAsync(recommendation);
        _logger.LogInformation("추천 저장 완료: ID={RecommendationId}, 1위={TopName}({TopScore}점)",
            recommendation.Id,
            topCandidates.FirstOrDefault()?.Name ?? "-",
            topCandidates.FirstOrDefault()?.FinalScore ?? 0);

        // 7. DTO 변환
        return new RecommendationResponseDto
        {
            Id = recommendation.Id,
            TopCandidates = topCandidates.Select(c => new CandidateDto
            {
                Name = c.Name,
                AestheticScore = c.AestheticScore,
                HarmonyScore = c.HarmonyScore,
                FinalScore = c.FinalScore,
                Reasons = c.Reasons,
                NamingModel = c.NamingModel,
                NameType = c.NameType,
                RarityScore = c.RarityScore,
                EnglishEquivalent = c.EnglishEquivalent,
                HanjaMeaning = c.HanjaMeaning
            }).ToList()
        };
    }

    public async Task<RecommendationResponseDto?> GetRecommendationAsync(string id)
    {
        var recommendation = await _repository.GetByIdAsync(id);
        
        if (recommendation == null)
        {
            return null;
        }

        return new RecommendationResponseDto
        {
            Id = recommendation.Id,
            TopCandidates = recommendation.TopCandidates.Select(c => new CandidateDto
            {
                Name = c.Name,
                AestheticScore = c.AestheticScore,
                HarmonyScore = c.HarmonyScore,
                FinalScore = c.FinalScore,
                Reasons = c.Reasons,
                NamingModel = c.NamingModel,
                NameType = c.NameType,
                RarityScore = c.RarityScore,
                EnglishEquivalent = c.EnglishEquivalent,
                HanjaMeaning = c.HanjaMeaning
            }).ToList()
        };
    }

    /// <summary>
    /// 이름 타입 결정 (의미중심 vs 음운중심)
    /// </summary>
    private string DetermineNameType(string name)
    {
        // 한자 의미가 강한 경우 "의미중심"
        var hanjaInfo = Application.Engines.Data.HanjaData.FindByReading(name);
        if (hanjaInfo.Any(h => !string.IsNullOrEmpty(h.Meaning) && 
                              (h.Category == "자연" || h.Category == "덕목" || h.Category == "개념")))
        {
            return "의미중심";
        }

        // 음운 변주가 있는 경우 "음운중심"
        var variants = new[] { "리", "라", "로", "류", "림" };
        if (variants.Any(v => name.Contains(v)))
        {
            return "음운중심";
        }

        // 기본값: 의미중심
        return "의미중심";
    }
}
