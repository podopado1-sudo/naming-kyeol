using NameForm.Application.Engines.Data;
using NameForm.Domain.Models.Saju;

namespace NameForm.Application.Services;

/// <summary>
/// 사주 원국 계산 서비스
///
/// 이 사이트의 계산 관례(2026-11 P0 — docs/plan-ohaeng-2026-11.md §1. /ohaeng 설명 글이 이 관례를 그대로 적으니 바꾸면 글도 함께 고칠 것):
/// - 입력 날짜·시각은 UTC+9 시계로 본다(서머타임·옛 표준시는 고치지 않는다).
/// - 연주·월주: 입춘·12절 절입 순간(UTC)과 출생 순간(UTC)을 견준다. 출생 순간 = 시계 시각 − 9시간(진태양시 보정 전 — 절입은 물리 순간이라
///   출생지와 무관하다). 시각이 없으면 그날 낮 12시(UTC+9)로 본다(하루 가운데 — 절기가 드는 날의 오차를 ±12시간으로 줄인다).
/// - 일주·시주: 시각이 있으면 진태양시(眞太陽時)로 보정한 시각으로 정한다 — 보정 = (출생지 경도 − 135) × 4분, 균시차 없음, 소수 분 그대로.
///   날짜 경계는 보정한 시각의 0시. 보정한 시각이 23시대면 일주는 그날 것, 시주 천간은 다음 날 일간으로 정한다(야자시).
///   시각이 없으면 보정하지 않고 넣은 날짜 그대로 일주를 정하며 시주는 없다.
/// - 서버 시간대는 쓰지 않는다(운영 서버는 UTC, 개발 PC 는 한국 시간 — 어느 쪽에서도 같은 결과).
/// </summary>
public class SajuCalculationService : ISajuCalculationService
{
    // 일주 기준일: 1900년 1월 1일 = 甲戌日 (인덱스 10)
    // 검증: 2000-01-01 = 戊午(54), 1900→2000 = 36,524일, (10+36524)%60 = 54 ✓
    private static readonly DateTime DayBaseDate = new(1900, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private const int DayBaseCycle60 = 10; // 甲戌

    /// <summary>입력 시계의 UTC 오프셋 — 한국 표준시(UTC+9)</summary>
    private static readonly TimeSpan ClockOffset = TimeSpan.FromHours(9);

    /// <summary>시각이 없을 때 연주·월주를 가르는 기준 시각 — 그날 낮 12시(UTC+9)</summary>
    private static readonly TimeSpan NoTimeReference = TimeSpan.FromHours(12);

    public SajuChart CalculateChart(DateTime birthDate, TimeSpan? birthTime = null, string? birthplaceCode = null)
    {
        var place = BirthplaceData.Find(birthplaceCode)!;
        bool hasTime = birthTime.HasValue;

        // 연주·월주 — 시계 시각(UTC+9)의 물리 순간을 절입 순간과 견준다(보정 전)
        var clock = birthDate.Date + (birthTime ?? NoTimeReference);
        var instantUtc = new DateTime((clock - ClockOffset).Ticks, DateTimeKind.Utc);

        // 일주·시주 — 시각이 있으면 진태양시로 보정한 시각, 없으면 넣은 날짜 그대로(보정 없음)
        var solar = hasTime
            ? clock.AddMinutes(place.CorrectionMinutes)
            : birthDate.Date;

        var yearPillar  = CalculateYearPillar(clock.Year, instantUtc);
        var monthPillar = CalculateMonthPillar(instantUtc, yearPillar);
        var dayPillar   = CalculateDayPillar(solar.Date);
        var hourPillar  = hasTime
            ? CalculateHourPillar(solar.TimeOfDay, dayPillar)
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
            // 실제로 쓴 보정값 — 시각이 없으면 보정하지 않으므로 0(P0 전에는 시각이 없어도 출생지 값이 실렸고 일주가 전날이 됐다)
            CorrectionMinutes = hasTime ? (int)Math.Round(place.CorrectionMinutes) : 0,
            CorrectionApplied = hasTime,
            TermOnBirthDay    = hasTime ? null : FindTermOnClockDay(birthDate.Date),
        };
    }

    // ── 절기가 드는 날 ────────────────────────────────────────────
    // 시각 없이 넣은 날(UTC+9 시계의 0시~24시) 안에 12절 절입 순간이 있으면 그 이름 — 그날은 태어난 시각에 따라 월주(입춘이면 연주도)가 갈린다
    private static string? FindTermOnClockDay(DateTime clockDate)
    {
        var dayStartUtc = new DateTime((clockDate - ClockOffset).Ticks, DateTimeKind.Utc);
        return SolarTermCalculator.FindMonthTermWithin(dayStartUtc, dayStartUtc.AddDays(1));
    }

    // ── 년주 (年柱) ───────────────────────────────────────────────
    private static SajuPillar CalculateYearPillar(int clockYear, DateTime instantUtc)
    {
        // 입춘(立春) 순간 이전이면 전년도 간지 적용 — UTC 순간끼리 견준다
        int year = instantUtc < SolarTermCalculator.GetLichun(clockYear) ? clockYear - 1 : clockYear;

        // 기준: 4년 = 甲子년
        int stemIdx   = ((year - 4) % 10 + 10) % 10;
        int branchIdx = ((year - 4) % 12 + 12) % 12;

        return MakePillar(stemIdx, branchIdx);
    }

    // ── 월주 (月柱) ───────────────────────────────────────────────
    private static SajuPillar CalculateMonthPillar(DateTime instantUtc, SajuPillar yearPillar)
    {
        int branchIdx = SolarTermCalculator.GetMonthBranchIndex(instantUtc);

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

        // 23시대(子시의 앞 절반)는 다음 날 자시와 같은 기둥이다 — 일주는 그날 그대로 두고(야자시) 시주 천간만 다음 날 일간으로 정한다.
        // 그날 일간으로 정하면 亥시 다음 子시에서 60갑자 순서가 끊긴다(戊午일: 癸亥 다음이 甲子가 아니라 壬子 — 2026-11 P0 B5)
        int stemDayIdx = time.Hours == 23 ? (dayStemIdx + 1) % 10 : dayStemIdx;
        int hourStemIdx = (SajuData.GetHourStemBase(stemDayIdx) + branchIdx) % 10;

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
