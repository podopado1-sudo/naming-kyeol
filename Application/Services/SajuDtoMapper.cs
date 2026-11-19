using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Domain.Models.Saju;

namespace NameForm.Application.Services;

/// <summary>
/// 사주 원국·용신 → 응답 DTO 매퍼 — /name-analysis(<see cref="NameAnalysisService"/>)와 /saju/elements(<see cref="SajuElementsService"/>)가 함께 쓴다.
/// 2026-11 /ohaeng 설계(docs/plan-ohaeng-2026-11.md §3)로 NameAnalysisService 의 private static MapToSajuDto·MapYongshinDto·MapPillar 를 본문 그대로 옮겼다
/// (새로 더한 것은 <see cref="SajuPillarDto.BranchFiveElement"/>와, 2026-11 사주 계산 수정이 원국에 둔 CorrectionApplied·TermOnBirthDay 를
/// <see cref="SajuChartDto"/> 로 옮기는 두 줄 — 그래서 /name-analysis 응답에도 이 세 필드가 새로 실린다. 기존 필드 값은 그대로). 계산은 하지 않는다 — 두 엔드포인트의 원국·용신이 같은 값이라는 것은
/// SajuElementsServiceTests 의 재사용 동등성 테스트가 지킨다.
/// </summary>
public static class SajuDtoMapper
{
    /// <summary>원국 + 용신 → <see cref="SajuChartDto"/>. 이름이 없으면(hanjaBreakdown 비어 있음) <see cref="YongshinDto.NameFitsYongshin"/> 은 null.</summary>
    public static SajuChartDto ToDto(
        SajuChart chart,
        YongshinResult? yongshinResult,
        List<HanjaBreakdownDto> hanjaBreakdown) => new()
    {
        YearPillar        = ToPillarDto(chart.YearPillar),
        MonthPillar       = ToPillarDto(chart.MonthPillar),
        DayPillar         = ToPillarDto(chart.DayPillar),
        HourPillar        = chart.HourPillar != null ? ToPillarDto(chart.HourPillar) : null,
        FiveElementCount  = chart.FiveElementCount,
        MissingElements   = chart.MissingElements,
        StrongestElement  = chart.StrongestElement,
        DayMaster         = chart.DayMaster,
        BirthplaceName    = chart.BirthplaceName,
        CorrectionMinutes = chart.CorrectionMinutes,
        CorrectionApplied = chart.CorrectionApplied,
        TermOnBirthDay    = chart.TermOnBirthDay,
        Yongshin          = yongshinResult != null
            ? ToYongshinDto(yongshinResult, hanjaBreakdown)
            : null,
    };

    public static YongshinDto ToYongshinDto(
        YongshinResult r,
        List<HanjaBreakdownDto> hanjaBreakdown)
    {
        // 화면에 보이는 이 이름의 한자(음절별 큰 카드 = 점수가 쓴 배정 한자) 중 용신 오행 글자가 있으면 true —
        // 추천 랭킹 자원오행 +8 과 같은 정의(RankerEngine.AssignedHanjaHasElement, 2026-10-26 결정 ③).
        // 옛 규칙은 음절별 후보 10개 중 하나라도 그 오행이면 true 라, 큰 카드·점수 한자와 무관하게 거의 늘 '부합'이 떴다
        // (은찬 恩燦 火火 · 용신 木 도 '부합').
        bool? nameFits = hanjaBreakdown.Count > 0
            ? RankerEngine.AssignedHanjaHasElement(
                hanjaBreakdown.Select(b => b.PossibleHanja.FirstOrDefault()?.Character).ToList(),
                r.PrimaryYongshin)
            : null;

        return new YongshinDto
        {
            Strength            = r.Strength.ToString(),
            StrengthScore       = r.StrengthScore,
            EokbuYongshin       = r.EokbuYongshin,
            JohuYongshin        = r.JohuYongshin,
            PrimaryYongshin     = r.PrimaryYongshin,
            Heeshin             = r.Heeshin,
            Gishin              = r.Gishin,
            StrengthDescription = r.StrengthDescription,
            YongshinReason      = r.YongshinReason,
            NameFitsYongshin    = nameFits,
        };
    }

    public static SajuPillarDto ToPillarDto(SajuPillar p) => new()
    {
        StemChar   = p.StemChar,
        StemName   = p.StemName,
        BranchChar = p.BranchChar,
        BranchName = p.BranchName,
        FiveElement = p.FiveElement,
        YinYang    = p.YinYang,
        // 지지 오행 — 표 조회만. 손으로 만든 기둥(테스트 가짜 원국)의 지지 글자가 표에 없으면 빈 값(예외 대신)
        BranchFiveElement = SajuData.Branches.FirstOrDefault(b => b.Char == p.BranchChar)?.FiveElement ?? string.Empty,
    };
}
