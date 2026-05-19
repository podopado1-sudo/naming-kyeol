using NameForm.Application.Engines.Data;
using NameForm.Domain.Models.Saju;

namespace NameForm.Application.Services;

/// <summary>
/// 사주 원국 계산 서비스
/// 진태양시(眞太陽時) 보정 적용: KST → 출생지 진태양시
/// </summary>
public class SajuCalculationService : ISajuCalculationService
{
    // 일주 기준일: 1900년 1월 1일 = 甲戌日 (인덱스 10)
    // 검증: 2000-01-01 = 戊午(54), 1900→2000 = 36,524일, (10+36524)%60 = 54 ✓
    private static readonly DateTime DayBaseDate = new(1900, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private const int DayBaseCycle60 = 10; // 甲戌

    public SajuChart CalculateChart(DateTime birthDate, TimeSpan? birthTime = null, string? birthplaceCode = null)
    {
        // 진태양시 보정 적용
        var place = BirthplaceData.Find(birthplaceCode);
        var correctedDateTime = ApplySolarTimeCorrection(birthDate, birthTime, place!.CorrectionMinutes);

        var date = correctedDateTime.Date;
        var time = correctedDateTime.TimeOfDay;

        var yearPillar  = CalculateYearPillar(date);
        var monthPillar = CalculateMonthPillar(date, yearPillar);
        var dayPillar   = CalculateDayPillar(date);
        var hourPillar  = birthTime.HasValue
            ? CalculateHourPillar(time, dayPillar)
            : null;

        var fiveElementCount = CountFiveElements(yearPillar, monthPillar, dayPillar, hourPillar);

        return new SajuChart
        {
            YearPillar       = yearPillar,
            MonthPillar      = monthPillar,
            DayPillar        = dayPillar,
            HourPillar       = hourPillar,
            FiveElementCount = fiveElementCount,
            BirthplaceName   = place.Name,
            CorrectionMinutes = (int)Math.Round(place.CorrectionMinutes),
        };
    }

    // ── 진태양시 보정 ─────────────────────────────────────────────
    // KST = 135°E 기준, 출생지 경도에 따라 분 단위 조정
    private static DateTime ApplySolarTimeCorrection(
        DateTime date, TimeSpan? time, double correctionMinutes)
    {
        var baseDateTime = time.HasValue
            ? date.Date + time.Value
            : date.Date;

        return baseDateTime.AddMinutes(correctionMinutes);
    }

    // ── 년주 (年柱) ───────────────────────────────────────────────
    private static SajuPillar CalculateYearPillar(DateTime date)
    {
        // 입춘(立春) 이전이면 전년도 간지 적용
        var lichun = SolarTermCalculator.GetLichun(date.Year).ToLocalTime().Date;
        int year = date < lichun ? date.Year - 1 : date.Year;

        // 기준: 4년 = 甲子년
        int stemIdx   = ((year - 4) % 10 + 10) % 10;
        int branchIdx = ((year - 4) % 12 + 12) % 12;

        return MakePillar(stemIdx, branchIdx);
    }

    // ── 월주 (月柱) ───────────────────────────────────────────────
    private static SajuPillar CalculateMonthPillar(DateTime date, SajuPillar yearPillar)
    {
        int branchIdx = SolarTermCalculator.GetMonthBranchIndex(date);

        int yearStemIdx   = Array.FindIndex(SajuData.Stems, s => s.Char == yearPillar.StemChar);
        int monthStemBase = SajuData.GetMonthStemBase(yearStemIdx);
        int monthStemIdx  = (monthStemBase + ((branchIdx - 2 + 12) % 12)) % 10;

        return MakePillar(monthStemIdx, branchIdx);
    }

    // ── 일주 (日柱) ───────────────────────────────────────────────
    private static SajuPillar CalculateDayPillar(DateTime date)
    {
        int dayDiff = (int)(date.Date - DayBaseDate).TotalDays;
        int cycle60 = ((DayBaseCycle60 + dayDiff) % 60 + 60) % 60;

        var (stemIdx, branchIdx) = SajuData.GetStemBranch(cycle60);
        return MakePillar(stemIdx, branchIdx);
    }

    // ── 시주 (時柱) ───────────────────────────────────────────────
    private static SajuPillar CalculateHourPillar(TimeSpan time, SajuPillar dayPillar)
    {
        int branchIdx  = SajuData.GetHourBranchIndex(time);
        int dayStemIdx = Array.FindIndex(SajuData.Stems, s => s.Char == dayPillar.StemChar);
        int hourStemIdx = (SajuData.GetHourStemBase(dayStemIdx) + branchIdx) % 10;

        return MakePillar(hourStemIdx, branchIdx);
    }

    // ── 오행 분포 집계 ────────────────────────────────────────────
    private static Dictionary<string, int> CountFiveElements(
        SajuPillar year, SajuPillar month, SajuPillar day, SajuPillar? hour)
    {
        var result = new Dictionary<string, int>
        {
            ["木"] = 0, ["火"] = 0, ["土"] = 0, ["金"] = 0, ["水"] = 0
        };

        var pillars = new List<SajuPillar> { year, month, day };
        if (hour != null) pillars.Add(hour);

        foreach (var p in pillars)
        {
            result[SajuData.Stems.First(s => s.Char == p.StemChar).FiveElement]++;
            result[SajuData.Branches.First(b => b.Char == p.BranchChar).FiveElement]++;
        }

        return result;
    }

    // ── 헬퍼 ──────────────────────────────────────────────────────
    private static SajuPillar MakePillar(int stemIdx, int branchIdx)
    {
        var stem   = SajuData.Stems[stemIdx];
        var branch = SajuData.Branches[branchIdx];

        return new SajuPillar(
            StemChar:    stem.Char,
            StemName:    stem.Name,
            BranchChar:  branch.Char,
            BranchName:  branch.Name,
            FiveElement: stem.FiveElement,
            YinYang:     stem.YinYang
        );
    }
}
