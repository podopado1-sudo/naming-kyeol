using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;

namespace NameForm.Application.Services;

/// <summary>
/// 이름 평가 서비스 — ScoringService(단일 진실의 원천)와 ExplanationEngine만 호출.
/// 모든 점수 계산은 ScoringService를 거치므로 /evaluate와 /smart의 TopPick이 구조적으로 일치한다.
/// </summary>
public class NameEvaluationService : INameEvaluationService
{
    private readonly IScoringService _scoringService;
    private readonly IExplanationEngine _explanationEngine;

    public NameEvaluationService(
        IScoringService scoringService,
        IExplanationEngine explanationEngine)
    {
        _scoringService = scoringService;
        _explanationEngine = explanationEngine;
    }

    public async Task<NameEvaluationResultDto> EvaluateNameAsync(
        string name, string lastName, DateTime birthDate, string gender, string tone,
        TimeSpan? birthTime = null)
    {
        // 단일 진실의 원천 — 모든 점수가 여기서 나옴
        var score = await _scoringService.EvaluateAsync(name, lastName, birthDate, gender, tone, birthTime);

        // 설명 생성 (점수와 동일한 값으로)
        // 세대 적합도(GenerationFit)를 함께 넘겨 cautions에 세대 불일치 안내, strengths에 시대중립 노출
        var explanation = await _explanationEngine.GenerateDetailedReasonsAsync(
            name, lastName, score.AestheticScore, score.HarmonyScore,
            score.RarityScore,
            ScoringService.NormalizeGender(gender),
            ScoringService.NormalizeTone(tone),
            score.Aesthetic.GenerationFit);

        var hanjaCandidates = BuildHanjaCandidates(name);

        return new NameEvaluationResultDto
        {
            Name = name,
            LastName = lastName,
            Gender = ScoringService.NormalizeGender(gender),
            Tone = ScoringService.NormalizeTone(tone),

            AestheticScore = score.AestheticScore,
            HarmonyScore = score.HarmonyScore,
            RarityScore = score.RarityScore,
            FinalScore = score.FinalScore,

            Aesthetic = new AestheticBreakdownDto
            {
                Pronunciation = score.Aesthetic.PronunciationScore,
                Rhythm = score.Aesthetic.RhythmScore,
                Syllable = score.Aesthetic.SyllableScore,
                Neutrality = score.Aesthetic.NeutralityScore,
                Meaning = score.Aesthetic.MeaningScore,
                GenderBonus = score.Aesthetic.GenderBonus,
                ToneBonus = score.Aesthetic.ToneBonus,
                Penalty = score.Aesthetic.PenaltyTotal,
                Total = score.Aesthetic.TotalScore,
                Notes = score.Aesthetic.Notes
            },

            Harmony = new HarmonyBreakdownDto
            {
                FiveElement          = score.Harmony.FiveElementScore,
                ResourceElement      = score.Harmony.ResourceElementScore,
                YinYang              = score.Harmony.YinYangScore,
                PronunciationElement = score.Harmony.PronunciationElementScore,
                SuriSagyeok          = score.Harmony.SuriSagyeokScore,
                SurnameHarmony       = score.Harmony.SurnameHarmonyScore,
                GenderBonus          = score.Harmony.GenderBonus,
                Total                = score.Harmony.TotalScore,
                UsedFallback         = score.Harmony.UsedFallback,
                Notes                = score.Harmony.Notes
            },

            HanjaCandidates = hanjaCandidates,

            Summary = explanation.Summary,
            Strengths = explanation.Strengths,
            Cautions = explanation.Cautions,
            PronunciationNote = explanation.PronunciationNote,
            MeaningNote = explanation.MeaningNote,
            ToneReason = explanation.ToneReason,

            UsedFallbackHanja = score.Harmony.UsedFallback
        };
    }

    /// <summary>음절별 상위 5개 한자 후보 조립.</summary>
    private static List<HanjaCandidateGroupDto> BuildHanjaCandidates(string name)
    {
        var result = new List<HanjaCandidateGroupDto>();

        foreach (char c in name)
        {
            var syllable = c.ToString();
            var hanjaList = HanjaData.FindByReading(syllable);

            var candidates = hanjaList
                .Where(h => !string.IsNullOrEmpty(h.Meaning))
                .Take(5)
                .Select(h => new HanjaCandidateDto
                {
                    Character       = h.Character,
                    Reading         = h.Reading,
                    Meaning         = h.Meaning,
                    FiveElement     = h.FiveElement,
                    YinYang         = h.YinYang,
                    StrokeCount     = h.StrokeCount,
                    KangxiStrokes   = h.KangxiStrokes > 0 ? h.KangxiStrokes : null,
                    ConfidenceGrade = h.ConfidenceGrade,
                    Rationale       = string.IsNullOrEmpty(h.Rationale) ? null : h.Rationale,
                })
                .ToList();

            result.Add(new HanjaCandidateGroupDto
            {
                Syllable = syllable,
                Candidates = candidates
            });
        }

        return result;
    }
}
