using System.Globalization;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;

namespace NameForm.Application.Services;

public class SmartRecommendationService : ISmartRecommendationService
{
    // 기본 엔진 (항상 실행)
    private readonly IRecommendationService _recommendationService;
    private readonly IPureKoreanNameEngine _pureKoreanEngine;
    private readonly ICreativeNamingEngine _creativeEngine;
    private readonly IThreeSyllableEngine _threeSyllableEngine;
    private readonly IRareSurnameEngine _rareSurnameEngine;

    // 조건부 엔진
    private readonly IParentBasedNamingEngine _parentBasedEngine;
    private readonly ITwinNameService _twinNameService;
    private readonly IRequiredCharEngine _requiredCharEngine;
    private readonly IDualNameEngine _dualNameEngine;

    public SmartRecommendationService(
        IRecommendationService recommendationService,
        IPureKoreanNameEngine pureKoreanEngine,
        ICreativeNamingEngine creativeEngine,
        IThreeSyllableEngine threeSyllableEngine,
        IRareSurnameEngine rareSurnameEngine,
        IParentBasedNamingEngine parentBasedEngine,
        ITwinNameService twinNameService,
        IRequiredCharEngine requiredCharEngine,
        IDualNameEngine dualNameEngine)
    {
        _recommendationService = recommendationService;
        _pureKoreanEngine = pureKoreanEngine;
        _creativeEngine = creativeEngine;
        _threeSyllableEngine = threeSyllableEngine;
        _rareSurnameEngine = rareSurnameEngine;
        _parentBasedEngine = parentBasedEngine;
        _twinNameService = twinNameService;
        _requiredCharEngine = requiredCharEngine;
        _dualNameEngine = dualNameEngine;
    }

    public async Task<SmartRecommendationResponseDto> GenerateSmartRecommendationsAsync(
        SmartRecommendationRequestDto request)
    {
        // 1. BirthDate 파싱
        if (!DateTime.TryParseExact(request.BirthDate, "yyyy-MM-dd",
                CultureInfo.InvariantCulture, DateTimeStyles.None, out var birthDate))
        {
            throw new ArgumentException("BirthDate는 yyyy-MM-dd 형식이어야 합니다.");
        }

        var lastName = request.LastName;
        // 프론트엔드 일부 경로가 "Female"/"Neutral" 같은 대문자로 보내는데
        // 엔진은 소문자만 매칭하므로 (gender/tone 보너스 누락 → evaluate와 점수 불일치) 정규화
        var gender = (request.Gender ?? "none").ToLowerInvariant();
        var tone = (request.Tone ?? "neutral").ToLowerInvariant();

        // 2. 성씨 희귀도 감지 (AnalyzeAndRecommendAsync로 분석 결과 가져오기)
        var rareSurnameAnalysis = await _rareSurnameEngine.AnalyzeAndRecommendAsync(
            lastName, birthDate, gender, tone, 5);
        var rarityLevel = rareSurnameAnalysis.RarityLevel;
        var isRareSurname = rarityLevel >= 3;

        // 3. 병렬 실행할 Task 목록 구성
        var categoryResults = new List<NameCategoryDto>();
        var lockObj = new object();

        var tasks = new List<Task>();

        // [항상 실행] Task A: Standard 추천
        tasks.Add(RunSafeAsync(async () =>
        {
            var standardRequest = new CreateRecommendationRequestDto
            {
                LastName = lastName,
                BirthDate = request.BirthDate,
                BirthTime = request.BirthTime,
                Gender = gender,
                Tone = tone,
                FatherSurname = request.FatherSurname,
                FatherName = request.FatherName,
                MotherSurname = request.MotherSurname,
                MotherName = request.MotherName,
                StoryKeyword = request.StoryKeyword,
                PreferredEnglishName = request.PreferredEnglishName,
                PreferredMeanings = request.PreferredMeanings
            };
            var result = await _recommendationService.CreateRecommendationAsync(standardRequest);
            var names = result.TopCandidates.Select(c => new SmartNameCandidateDto
            {
                Name = c.Name,
                FullName = lastName + c.Name,
                Meaning = c.MeaningText ?? "", // 배정 한자에서 만든 뜻 한 줄 (상세 불릿과 일관)
                Hanja = c.Hanja,
                Reasons = c.Reasons,
                Score = c.FinalScore,
                AestheticScore = c.AestheticScore,
                HarmonyScore = c.HarmonyScore,
                GenderNote = NamingPrinciples.GenderLeanLabel(c.Name, gender),
                Tags = BuildStandardTags(c)
            }).ToList();

            // 반대 성별로 기우는 이름(GenderNote)은 목록 하단으로 — 1위/상위 차단,
            // 단 배제하지 않고 라벨과 함께 노출. OrderBy는 안정 정렬이라 그룹 내 점수순 유지.
            names = names
                .OrderByDescending(n => string.IsNullOrEmpty(n.GenderNote))
                .ToList();

            AddCategory(categoryResults, lockObj, "standard", "한자 이름", "RecommendationService", names);
        }));

        // [항상 실행] Task B: PureKorean
        if (request.IncludePureKorean)
        {
            tasks.Add(RunSafeAsync(async () =>
            {
                var candidates = await _pureKoreanEngine.GenerateCandidatesAsync(lastName, gender, tone, 10);
                var names = candidates.Select(c => new SmartNameCandidateDto
                {
                    Name = c.Name,
                    FullName = lastName + c.Name,
                    Meaning = c.Meaning,
                    Score = c.PronunciationScore,
                    Tags = new List<string> { c.GenderFit, c.ToneFit, "순우리말" }
                }).ToList();

                AddCategory(categoryResults, lockObj, "pure-korean", "순우리말 이름", "PureKoreanNameEngine", names);
            }));
        }

        // [항상 실행] Task C: Creative
        if (request.IncludeCreative)
        {
            tasks.Add(RunSafeAsync(async () =>
            {
                var candidates = await _creativeEngine.GenerateCandidatesAsync(lastName, gender, tone, 10);
                var names = candidates.Select(c => new SmartNameCandidateDto
                {
                    Name = c.Name,
                    FullName = c.FullName,
                    Meaning = c.Meaning,
                    Score = Math.Round(c.CreativityScore, 1),
                    Tags = new List<string> { c.Concept, c.SurnameConnection }
                }).ToList();

                AddCategory(categoryResults, lockObj, "creative", "창의적 작명", "CreativeNamingEngine", names);
            }));
        }

        // [조건부] ThreeSyllable — 3종 (pure-korean, hanja, mixed 각 5개)
        if (request.IncludeThreeSyllable)
        {
            var threeTypes = new[] { "pure-korean", "hanja", "mixed" };
            foreach (var nameType in threeTypes)
            {
                var capturedType = nameType;
                tasks.Add(RunSafeAsync(async () =>
                {
                    var candidates = await _threeSyllableEngine.GenerateCandidatesAsync(
                        lastName, gender, tone, capturedType, 5);
                    var names = candidates.Select(c => new SmartNameCandidateDto
                    {
                        Name = c.Name,
                        FullName = c.FullName,
                        Meaning = c.Meaning,
                        Score = Math.Round(c.PronunciationScore, 1),
                        Tags = new List<string> { c.NameType, "3글자" }
                            .Concat(c.Components).ToList(),
                        PhonologyNotes = c.PhonologyNotes.Select(n => new PhonologyNoteDto
                        {
                            Id = n.Id,
                            Name = n.Name,
                            Message = n.Message,
                            Position = n.Position
                        }).ToList()
                    }).ToList();

                    AddCategory(categoryResults, lockObj, "three-syllable", "3글자 이름", "ThreeSyllableEngine", names);
                }));
            }
        }

        // [조건부] 부모 정보 있음 → ParentBased
        if (HasParentInfo(request))
        {
            tasks.Add(RunSafeAsync(async () =>
            {
                var candidates = await _parentBasedEngine.GenerateCandidatesAsync(
                    lastName,
                    request.FatherSurname,
                    request.FatherName,
                    request.MotherSurname,
                    request.MotherName,
                    request.StoryKeyword,
                    birthDate,
                    gender,
                    tone);
                var names = candidates.Select(c => new SmartNameCandidateDto
                {
                    Name = c.Name,
                    FullName = lastName + c.Name,
                    Meaning = c.Description,
                    Score = null,
                    Tags = new List<string> { c.NamingModel, c.NameType }
                }).ToList();

                AddCategory(categoryResults, lockObj, "parent-based", "부모 기반 이름", "ParentBasedNamingEngine", names);
            }));
        }

        // [조건부] IsTwin → TwinName
        if (request.IsTwin)
        {
            tasks.Add(RunSafeAsync(async () =>
            {
                var twinRequest = new TwinNameRequestDto
                {
                    LastName = lastName,
                    BirthDate = request.BirthDate,
                    BirthTime = request.BirthTime,
                    Gender = gender,
                    Tone = tone,
                    ChildCount = 2
                };
                var result = await _twinNameService.GenerateTwinNamesAsync(twinRequest);
                var names = result.NameSets.SelectMany(set =>
                    set.Names.Select(c => new SmartNameCandidateDto
                    {
                        Name = c.Name,
                        FullName = lastName + c.Name,
                        Meaning = "", // 이유는 Reasons 불릿으로 표시
                        Reasons = c.Reasons,
                        Score = c.FinalScore,
                        Tags = new List<string> { set.Theme, "쌍둥이" }
                    })).ToList();

                AddCategory(categoryResults, lockObj, "twin", "쌍둥이 이름", "TwinNameService", names);
            }));
        }

        // [조건부] RequiredChar 또는 RequiredHanja 있음 → RequiredChar/항렬자
        if (!string.IsNullOrWhiteSpace(request.RequiredChar) || !string.IsNullOrWhiteSpace(request.RequiredHanja))
        {
            tasks.Add(RunSafeAsync(async () =>
            {
                var position = request.RequiredCharPosition ?? "any";
                var candidates = await _requiredCharEngine.GenerateCandidatesAsync(
                    lastName, request.RequiredChar ?? "", position, birthDate, gender, tone,
                    requiredHanja: request.RequiredHanja);
                var label = !string.IsNullOrWhiteSpace(request.RequiredHanja) ? "항렬자 이름" : "필수 글자 이름";
                var names = candidates.Select(c => new SmartNameCandidateDto
                {
                    Name = c.Name,
                    FullName = lastName + c.Name,
                    Meaning = c.Meaning,
                    Score = null,
                    Tags = new List<string>
                        {
                            c.FixedHanja != null ? $"항렬:{c.FixedHanja}" : $"필수:{c.RequiredChar}",
                            c.Position
                        }
                        .Concat(c.HanjaOptions).ToList()
                }).ToList();

                AddCategory(categoryResults, lockObj, "required-char", label, "RequiredCharEngine", names);
            }));
        }

        // [조건부] PreferredEnglishName 있음 → DualName
        if (!string.IsNullOrWhiteSpace(request.PreferredEnglishName))
        {
            tasks.Add(RunSafeAsync(async () =>
            {
                var candidates = await _dualNameEngine.GenerateDualNamesAsync(
                    lastName, request.PreferredEnglishName, birthDate, gender, tone);
                var names = candidates.Select(c => new SmartNameCandidateDto
                {
                    Name = c.KoreanName,
                    FullName = lastName + c.KoreanName,
                    Meaning = c.HanjaMeaning,
                    Score = null,
                    Tags = new List<string> { $"EN:{c.EnglishEquivalent}" }
                        .Concat(c.HanjaCharacters).ToList()
                }).ToList();

                AddCategory(categoryResults, lockObj, "dual-name", "영어+한자 이름", "DualNameEngine", names);
            }));
        }

        // [조건부] IsRareSurname → RareSurname (이미 분석 결과가 있으므로 변환만)
        if (isRareSurname)
        {
            var rareSurnameNames = rareSurnameAnalysis.Candidates.Select(c => new SmartNameCandidateDto
            {
                Name = c.Name,
                FullName = lastName + c.Name,
                Meaning = c.HarmonyReason,
                Score = c.HarmonyScore,
                Tags = new List<string> { "희귀성씨", $"조화:{c.HarmonyScore}" }
                    .Concat(c.HanjaOptions).ToList()
            }).ToList();

            AddCategory(categoryResults, lockObj, "rare-surname", "특이 성씨 최적화", "RareSurnameEngine", rareSurnameNames);
        }

        // 4. 병렬 실행
        await Task.WhenAll(tasks);

        // 5. 빈 카테고리 제거, TotalCount 계산
        var filteredCategories = categoryResults
            .Where(c => c.Names.Count > 0)
            .ToList();

        // 6. 카테고리 순서 고정 (2026-04-21 후속 2 탭 UX):
        // 한자 표준(standard)이 항상 첫 번째 탭.
        // 나머지는 CategoryOrder 정의 순서대로. 정의에 없는 카테고리는 끝에 Ordinal 정렬.
        var orderedCategories = filteredCategories
            .OrderBy(c => CategoryOrder.TryGetValue(c.Type, out var rank) ? rank : int.MaxValue)
            .ThenBy(c => c.Type, StringComparer.Ordinal)
            .ToList();

        var totalCount = orderedCategories.Sum(c => c.Names.Count);

        // 7. 추천 1위 계산 — 전 카테고리 통합 최고 Score.
        // Score가 null인 후보는 제외. 점수 동점 시 카테고리 순서, 그 다음 후보 내 순서로 결정.
        var topPick = BuildTopPick(orderedCategories);

        return new SmartRecommendationResponseDto
        {
            LastName = lastName,
            IsRareSurname = isRareSurname,
            RarityLevel = rarityLevel,
            Categories = orderedCategories,
            TotalCount = totalCount,
            TopPick = topPick
        };
    }

    /// <summary>
    /// 카테고리 타입 → 정렬 우선순위 (2026-04-21 후속 2 탭 UX).
    /// 기본 전략: 사용자가 가장 자주 선택할 것부터 탭 앞쪽에 배치.
    /// standard(한자 표준) → pure-korean(순우리말) → three-syllable(3글자) →
    /// creative(창의) → parent-based(부모) → required-char(필수글자) →
    /// dual-name(영문+한자) → twin(쌍둥이) → rare-surname(특이성씨) 순.
    /// 이 맵에 없는 타입은 int.MaxValue로 밀려 Ordinal 정렬.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, int> CategoryOrder = new Dictionary<string, int>
    {
        { "standard",       0 },
        { "pure-korean",    1 },
        { "three-syllable", 2 },
        { "creative",       3 },
        { "parent-based",   4 },
        { "required-char",  5 },
        { "dual-name",      6 },
        { "twin",           7 },
        { "rare-surname",   8 },
    };

    /// <summary>
    /// 핵심 추천 선정.
    /// 카테고리마다 Score 의미·스케일이 다르므로(standard=FinalScore vs 3글자=PronunciationScore 등)
    /// 단순 점수 비교가 부적절. standard(한자 이름) 카테고리 1위를 우선 채택하고,
    /// standard가 비어있을 때만 다른 카테고리 1위로 폴백한다.
    /// </summary>
    private static TopPickDto? BuildTopPick(List<NameCategoryDto> categories)
    {
        // 1순위: standard 카테고리 최고점.
        // 단 반대 성별로 기우는 이름(GenderNote 있음)은 TopPick에서 제외 — 1위는
        // 요청 성별에 맞는 이름이어야 함. 전부 노트가 있으면 어쩔 수 없이 최고점 사용.
        var standard = categories.FirstOrDefault(c => c.Type == "standard");
        if (standard != null)
        {
            var scored = standard.Names.Where(n => n.Score.HasValue);
            var topStandard = scored
                .OrderByDescending(n => string.IsNullOrEmpty(n.GenderNote)) // 노트 없는 이름 우선
                .ThenByDescending(n => n.Score!.Value)
                .FirstOrDefault();
            if (topStandard != null)
            {
                return new TopPickDto
                {
                    CategoryType = standard.Type,
                    CategoryLabel = standard.Label,
                    Candidate = topStandard
                };
            }
        }

        // 폴백: standard 비었으면 다른 카테고리에서 최고점 (카테고리 정렬 우선순위 반영됨)
        foreach (var category in categories)
        {
            if (category.Type == "standard") continue;
            var top = category.Names
                .Where(n => n.Score.HasValue)
                .OrderByDescending(n => n.Score!.Value)
                .FirstOrDefault();
            if (top != null)
            {
                return new TopPickDto
                {
                    CategoryType = category.Type,
                    CategoryLabel = category.Label,
                    Candidate = top
                };
            }
        }

        return null;
    }

    /// <summary>
    /// 개별 엔진 실패 시 다른 엔진은 계속 실행되도록 안전하게 래핑
    /// </summary>
    private static async Task RunSafeAsync(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (Exception)
        {
            // 개별 엔진 실패는 무시 — 다른 엔진 결과는 계속 수집
        }
    }

    /// <summary>
    /// 스레드-세이프하게 카테고리 결과 추가
    /// 같은 type이 이미 있으면 names를 합치고 중복 FullName은 제거 (ThreeSyllable 3종 호출 등)
    /// </summary>
    private static void AddCategory(
        List<NameCategoryDto> results,
        object lockObj,
        string type,
        string label,
        string engineUsed,
        List<SmartNameCandidateDto> names)
    {
        if (names.Count == 0) return;

        lock (lockObj)
        {
            var existing = results.FirstOrDefault(c => c.Type == type);
            if (existing != null)
            {
                var seenFullNames = new HashSet<string>(
                    existing.Names.Select(n => n.FullName));
                foreach (var n in names)
                {
                    if (seenFullNames.Add(n.FullName))
                    {
                        existing.Names.Add(n);
                    }
                }
                return;
            }

            results.Add(new NameCategoryDto
            {
                Type = type,
                Label = label,
                EngineUsed = engineUsed,
                Names = names
            });
        }
    }

    private static bool HasParentInfo(SmartRecommendationRequestDto request)
    {
        return !string.IsNullOrWhiteSpace(request.FatherName)
            || !string.IsNullOrWhiteSpace(request.MotherName)
            || !string.IsNullOrWhiteSpace(request.StoryKeyword);
    }

    private static List<string> BuildStandardTags(CandidateDto candidate)
    {
        var tags = new List<string>();
        if (!string.IsNullOrEmpty(candidate.NamingModel))
            tags.Add(candidate.NamingModel);
        if (!string.IsNullOrEmpty(candidate.NameType))
            tags.Add(candidate.NameType);
        if (candidate.RarityScore > 0)
            tags.Add($"희귀도:{candidate.RarityScore}");
        if (!string.IsNullOrEmpty(candidate.EnglishEquivalent))
            tags.Add($"EN:{candidate.EnglishEquivalent}");
        return tags;
    }
}
