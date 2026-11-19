using NameForm.Application.DTOs;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Services;

/// <summary>
/// 사전 항목(<see cref="HanjaInfo"/>) → 화면용 글자 사실(<see cref="HanjaFactDto"/>). /evaluate 응답의 hanjaSummary, /hanja/resolve,
/// 음절별 정적 후보 파일이 이 함수 하나로 같은 값을 싣는다(2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §4-1).
/// 사실만 옮긴다 — 점수·길흉을 말하지 않는다.
/// </summary>
public static class HanjaFactMapper
{
    /// <param name="hanja">사전 항목(통합 한자)</param>
    /// <param name="syllable">이 글자를 넣는 칸의 음절 — 훈을 그 음절로 고른다('오얏 리(이)'의 괄호 속 두음 독음도 맞춘다). 비우면 대표 독음 기준</param>
    /// <param name="surname">성씨 글자인가 — 참이면 이름용 표시(이름에 피하는 글자·먼저 보여 드리는 글자)를 싣지 않는다.
    /// 성씨 대표 한자 가운데 사이트 불용 글자가 있어(민·필·풍·독고), 바꿀 수 없는 성씨에 그 표시가 붙지 않게 한다</param>
    public static HanjaFactDto ToFact(HanjaInfo hanja, string? syllable, bool surname = false)
    {
        var reading = string.IsNullOrEmpty(syllable) ? hanja.Reading : syllable;
        // 뜻은 한글 훈일 때만 싣는다 — 사전 로더가 한글 뜻이 없는 글자에 채워 둔 Unihan 영문 뜻(U+39B3 한 자)은 훈이 아니다.
        // 후보 목록의 묶음(HanjaInput.CandidatesFor)도 같은 판정이라 '뜻 풀이 없는 글자' 묶음에 실린다
        bool hasGloss = HanjaInput.HasKoreanGloss(hanja);
        return new HanjaFactDto
        {
            Character = hanja.Character,
            Gloss = hasGloss ? HanjaData.GlossForReading(hanja.Meaning, reading) : "",
            FiveElement = hanja.FiveElement ?? "",
            ResourceGrade = hanja.ResourceGrade,
            VReasons = hanja.VReasons.ToList(),
            StrokeCount = hanja.StrokeCount,
            YinYang = YinYangOf(hanja),
            // OrderForDisplay 의 1순위 묶음과 같은 판정(빈출 목록에 있고 약자가 아님)
            Common = !surname && HanjaData.IsCommonNameHanja(hanja.Character) && !HanjaData.IsWeakGivenNameHanja(hanja.Character),
            Forbidden = !surname && HanjaData.IsForbiddenNameHanja(hanja.Character),
            HasMeaning = hasGloss,
            Basic = HanjaData.IsInCjkBasicRange(hanja.Character),
        };
    }

    /// <summary>음양 — 사전 값, 비어 있으면 획수 홀짝(홀수 陽). 조화 엔진의 음양 계산과 같은 대체다. 획수도 없으면 빈 문자열.</summary>
    private static string YinYangOf(HanjaInfo hanja)
    {
        if (!string.IsNullOrEmpty(hanja.YinYang)) return hanja.YinYang;
        if (hanja.StrokeCount <= 0) return "";
        return hanja.StrokeCount % 2 == 1 ? "陽" : "陰";
    }

    /// <summary>출생일로 정해지는 오행 쪽 사정 → 응답 꼴. 조화를 계산하지 않았으면(출생일 없음) null.</summary>
    public static ElementFitDto? ToDto(ElementFit? fit) => fit == null
        ? null
        : new ElementFitDto
        {
            Yongshin = fit.Yongshin,
            Heeshin = fit.Heeshin,
            Gishin = fit.Gishin,
            Lacking = fit.Lacking.ToList(),
            Excessive = fit.Excessive.ToList(),
            Counts = new Dictionary<string, int>(fit.Counts),
        };

    /// <summary>
    /// 글자 한 자의 판정(<see cref="HanjaInput.Judge"/>) → /hanja/resolve 응답. 훈은 칸의 음절이 있으면 그 음절, 없으면 대표 독음 기준.
    /// 성씨 칸의 판정(<paramref name="surname"/>)이면 글자 사실에 이름용 표시(이름에 피하는 글자·먼저 보여 드리는 글자)를 싣지 않는다 — hanjaSummary 의 성씨 글자와 같다.
    /// </summary>
    public static HanjaResolveResponseDto ToResolveResponse(HanjaJudgement judgement, char? syllable, bool surname = false)
    {
        var syllableText = syllable?.ToString();
        return new HanjaResolveResponseDto
        {
            Status = judgement.Status,
            Character = judgement.Character,
            Hanja = judgement.Hanja == null ? null : ToFact(judgement.Hanja, syllableText, surname),
            AcceptedSyllables = judgement.AcceptedSyllables.ToList(),
            Message = judgement.Message,
            Suggestion = judgement.Suggestion == null ? null : ToFact(judgement.Suggestion, syllableText, surname),
        };
    }
}
