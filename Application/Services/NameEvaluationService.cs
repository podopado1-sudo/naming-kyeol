using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

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
        string name, string lastName, DateTime? birthDate, string gender, string tone,
        TimeSpan? birthTime = null)
    {
        // 단일 진실의 원천 — 모든 점수가 여기서 나옴
        var score = await _scoringService.EvaluateAsync(name, lastName, birthDate, gender, tone, birthTime);

        // 점수가 쓴 배정 한자 — MeaningNote·후보 표 첫 칸이 추천 카드와 같은 한자를 설명하게 한다.
        // 출생일이 있으면 조화의 용신 배정, 없으면 HanjaSelector.DefaultAssignment(2음절은 /name 1순위 조합, 그 밖은 용신 없는 Select —
        // 2026-10-27 O2) — ScoringService 가 한 번 정해
        // 미학 성별 판정에도 같은 목록을 넘겼다(2026-10-26 결정 ③). 여기서 다시 고르지 않는다.
        var selectedHanja = score.AssignedHanja;

        // 설명 생성 (점수와 동일한 값으로)
        // 세대 적합도(GenerationFit)를 함께 넘겨 cautions에 세대 불일치 안내, strengths에 시대중립 노출
        var explanation = await _explanationEngine.GenerateDetailedReasonsAsync(
            name, lastName, score.AestheticScore, score.HarmonyScore,
            score.RarityScore,
            ScoringService.NormalizeGender(gender),
            ScoringService.NormalizeTone(tone),
            score.Aesthetic.GenerationFit,
            selectedHanja);

        // 종합 줄은 화면의 '종합' 타일(FinalScore)과 같은 값으로 — 출생일이 없으면 조화는 '미산정'.
        ExplanationEngine.AlignOverall(explanation, score.FinalScore, score.AestheticScore, score.HarmonyScore,
            birthDate.HasValue, ScoringService.NormalizeTone(tone));

        var hanjaCandidates = BuildHanjaCandidates(name, selectedHanja);

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
            BirthDateProvided = birthDate.HasValue,

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

            GenerationFit = MapGenerationFit(score.Aesthetic.GenerationFit),

            UsedFallbackHanja = score.Harmony.UsedFallback
        };
    }

    /// <summary>세대 적합도 → DTO 매핑. unknown/미제공/판단보류는 null(칩 미표시).</summary>
    private static GenerationFitDto? MapGenerationFit(Engines.Data.GenerationFitResult? fit)
    {
        if (fit == null || fit.FitLevel == "unknown")
            return null;

        return new GenerationFitDto
        {
            FitLevel = fit.FitLevel,
            Direction = fit.Direction,
            Headline = fit.Headline,
            Description = fit.Description,
            PeakDecade = fit.PeakDecade
        };
    }

    /// <summary>
    /// 음절별 상위 5개 한자 후보 조립.
    /// 불용한자(恥 부끄러울·懍 위태할 등)는 빼고, 약한 한자는 뒤로(안정 정렬이라 관련도 순서 보존),
    /// 점수·의미 메모가 실제로 쓴 배정 한자를 맨 앞에 둔다 — 의미 메모의 硏이 표에 없던 불일치(EV-3).
    /// </summary>
    private static List<HanjaCandidateGroupDto> BuildHanjaCandidates(
        string name, IReadOnlyList<HanjaData.HanjaInfo?>? assigned)
    {
        var result = new List<HanjaCandidateGroupDto>();

        for (int i = 0; i < name.Length; i++)
        {
            var syllable = name[i].ToString();
            var hanjaList = HanjaSelector.UsableByReading(syllable)
                .OrderBy(h => HanjaData.IsWeakGivenNameHanja(h.Character) ? 1 : 0)
                .ToList();

            // 배정 한자는 뜻이 있을 때만 앞세운다(의미 메모와 같은 조건 — 뜻 없는 글자는 메모에도 안 나온다).
            var pick = assigned != null && i < assigned.Count ? assigned[i] : null;
            if (pick != null && !string.IsNullOrEmpty(pick.Meaning))
            {
                hanjaList.RemoveAll(h => h.Character == pick.Character);
                hanjaList.Insert(0, pick);
            }

            var candidates = hanjaList
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
                    ResourceGrade   = h.ResourceGrade,
                    VReasons        = h.VReasons.ToList(),
                    Rationale       = string.IsNullOrEmpty(h.Rationale) ? null : h.Rationale,
                })
                .ToList();

            result.Add(new HanjaCandidateGroupDto
            {
                Syllable = syllable,
                Candidates = candidates,
                // 후보 0개 음절(글자가 모두 불용 — 괵·몰·훙 등, 또는 순우리말 음절)에만 안내 — 화면이 '0개' 빈 칸 대신 이 문구를 보인다
                NoHanjaNote = candidates.Count == 0 ? HanjaSelector.NoHanjaNoteFor(syllable) : null
            });
        }

        return result;
    }
}
