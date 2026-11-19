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
        TimeSpan? birthTime = null,
        HanjaPicks? picks = null)
    {
        // 단일 진실의 원천 — 모든 점수가 여기서 나옴
        // picks(2026-11 한자 입력) — 사용자가 정한 한자. null 이면 아래가 모두 예전 경로다.
        var score = await _scoringService.EvaluateAsync(name, lastName, birthDate, gender, tone, birthTime, picks);

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
            selectedHanja,
            // 한자를 정한 요청에서는 '한자 예' 폴백(그 음절의 표시 1순위 글자)을 끈다 — 고르지 않은 글자가 메모·강점 줄에 나오지 않게
            hanjaFallback: picks == null);

        // 한자를 정한 요청인데 적을 뜻이 없을 때(계산에 쓴 글자 중 뜻 있는 것이 없음) — 엔진의 문구('이름에 쓸 만한 인명용 한자 없음'·
        // '한자 매칭 없음')는 사용자가 정한 결과에 맞지 않는 말이라 가른다. 고른 칸이 하나라도 있으면 '뜻 풀이 없음',
        // 고른 칸 없이 비운 칸이 있으면 '한글 이름으로 둠', 둘 다 아니면(성씨만 고른 순우리말 이름) 엔진 문구 그대로.
        if (picks != null && !selectedHanja.Any(h => h != null && !string.IsNullOrEmpty(h.Meaning)))
        {
            if (picks.AnyPicked) explanation.MeaningNote = ExplanationEngine.UserNoGlossMeaningNote;
            else if (picks.AnyNone) explanation.MeaningNote = ExplanationEngine.UserNoHanjaMeaningNote;
        }

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
            HanjaSummary = BuildHanjaSummary(name, lastName, score, picks),

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

    public const string SourceUser = "user";
    public const string SourceAuto = "auto";
    public const string SourceNone = "none";
    public const string SourceUnavailable = "unavailable";
    public const string SourceDefault = "default";
    public const string SourceEstimated = "estimated";

    /// <summary>
    /// 응답의 '이 이름의 한자'(hanjaSummary — 2026-11 한자 입력, 설계서 §4-3). 점수가 실제로 쓴 값만 옮긴다: 이름 글자는 <see cref="CanonicalNameScore.AssignedHanja"/>,
    /// 오행 역할은 조화가 쓴 <see cref="ElementFit"/>, 성씨 획수는 수리와 같은 규칙. 여기서 한자를 다시 고르지 않는다.
    /// ⚠️ 어떤 이름·성씨 문자열에도 예외를 내지 않는다 — 한자를 지정하지 않은 기존 요청에도 실리는 필드라, 여기서 던지면 지금 되는 요청이 500 이 된다.
    /// 지정 없는 요청은 이름이 한글인지 검사하지 않으므로(낱자모·공백·한자·이모지가 올 수 있다) 한글 음절만이 아니면 null 을 돌려준다.
    /// </summary>
    private static HanjaSummaryDto? BuildHanjaSummary(string name, string lastName, CanonicalNameScore score, HanjaPicks? picks)
    {
        try
        {
            var surname = (lastName ?? string.Empty).Trim();   // 성씨 획수 계산(SurnameData.ResolveStrokes)과 같은 Trim
            if (!HanjaInput.IsHangulSyllables(name) || !HanjaInput.IsHangulSyllables(surname)) return null;

            var fit = score.Harmony.ElementFit;   // 출생일이 없으면 null — fills 는 빈 목록
            var assigned = score.AssignedHanja;

            var syllables = new List<SyllableHanjaDto>(name.Length);
            for (int i = 0; i < name.Length; i++)
            {
                var syllable = name[i].ToString();
                var kind = picks != null && i < picks.Name.Count ? picks.Name[i].Kind : HanjaPickKind.Auto;
                // 사용자가 비운 칸은 null(덮어쓴 목록에서 이미 null), 그 밖은 점수가 쓴 글자 그대로
                var hanja = kind == HanjaPickKind.None ? null : (i < assigned.Count ? assigned[i] : null);
                syllables.Add(new SyllableHanjaDto
                {
                    Syllable = syllable,
                    // 자동인데 글자가 없으면 '쓸 수 있는 인명용 한자가 없는 음절' — 그 자리에 '-' 가 왔어도 입력 단계에서 자동으로 접혀 이 값이다
                    Source = kind switch
                    {
                        HanjaPickKind.Picked => SourceUser,
                        HanjaPickKind.None => SourceNone,
                        _ => hanja != null ? SourceAuto : SourceUnavailable,
                    },
                    Fills = hanja == null || fit == null ? new List<string>() : fit.RolesOf(hanja.FiveElement).ToList(),
                    Hanja = hanja == null ? null : HanjaFactMapper.ToFact(hanja, syllable),
                });
            }

            return new HanjaSummaryDto
            {
                UserHanja = picks != null,
                NameHanja = picks?.NameText ?? string.Empty,
                LastNameHanja = picks?.SurnameText ?? string.Empty,
                Surname = BuildSurnameHanja(surname, picks),
                Syllables = syllables,
                ElementFit = HanjaFactMapper.ToDto(fit),
            };
        }
        catch
        {
            // 덧붙이는 필드 하나 때문에 평가 전체를 실패시키지 않는다(화면은 이 필드가 없으면 블록을 그리지 않는다)
            return null;
        }
    }

    /// <summary>
    /// 성씨 한자 — 고른 한자(user), 대표 한자 표(default), 표에 없는 성씨의 독음 추정(estimated). 획수는 수리(HarmonyEngine.CalculateSuriSagyeokScore)와
    /// 같은 규칙: 고른 글자들의 획수 합(한 글자라도 못 정했으면 0), 아니면 <see cref="SurnameData.ResolveStrokes"/> 값.
    /// 글자를 전부 정하지 못하면(표 밖 성씨의 추정이 중간에 끊김, 복성에서 한 글자만 골랐는데 나머지 자리에 둘 글자가 없음) chars 는 빈 목록·획수 0.
    /// 성씨 글자에는 이름용 표시(이름에 피하는 글자·먼저 보여 드리는 글자)를 싣지 않는다.
    /// </summary>
    private static SurnameHanjaDto BuildSurnameHanja(string surname, HanjaPicks? picks)
    {
        string source;
        int strokes;
        List<HanjaData.HanjaInfo?> chars;

        if (picks?.Surname is { } picked)
        {
            source = SourceUser;
            chars = picked.ToList();
            strokes = chars.Any(h => h == null || h.StrokeCount <= 0) ? 0 : chars.Sum(h => h!.StrokeCount);
        }
        else
        {
            var resolved = SurnameData.ResolveStrokes(surname);
            source = resolved.FromTable ? SourceDefault : SourceEstimated;
            strokes = resolved.Strokes;
            chars = resolved.Hanja.EnumerateRunes()
                .Select(r => HanjaData.FindByCharacter(r.ToString()))
                .ToList();
        }

        bool complete = chars.Count == surname.Length && chars.All(h => h != null);
        return new SurnameHanjaDto
        {
            Hangul = surname,
            Source = source,
            Strokes = complete ? strokes : 0,
            Chars = complete
                ? chars.Select((h, i) => HanjaFactMapper.ToFact(h!, surname[i].ToString(), surname: true)).ToList()
                : new List<HanjaFactDto>(),
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

            // 배정 한자는 쓸 수 있는 글자(불용 아님 + 뜻 있음)일 때만 앞세운다 — 뜻 없는 글자는 메모에도 안 나오고, 사용자가 고른 불용 글자는
            // 계산에는 쓰되 이 '한자 후보' 표에 넣지 않는다(2026-11 한자 입력). 자동 배정은 불용 글자를 고르지 않아 예전 조건(뜻 있음)과 결과가 같다.
            var pick = assigned != null && i < assigned.Count ? assigned[i] : null;
            if (pick != null && HanjaSelector.IsUsableNameHanja(pick))
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
