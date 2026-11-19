using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;
using NameForm.Domain.Models.Saju;

namespace NameForm.Tests;

/// <summary>
/// 부족한 오행 찾기(/saju/elements) 서비스 — 2026-11 설계 docs/plan-ohaeng-2026-11.md §5 의 1~6.
/// 본보기는 NameAnalysisServiceTests(진짜 엔진 + NullLogger). 기대값은 손 표·테스트 안 계산으로 따로 센다(검사 대상 도우미를 쓰지 않는다).
/// </summary>
public class SajuElementsServiceTests
{
    private readonly SajuElementsService _service = new(new SajuCalculationService(), new YongshinCalculationService());

    // 손 표 — 지지 오행(子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水). SajuData.Branches 를 읽지 않는다
    private static readonly Dictionary<string, string> BranchElementByHand = new()
    {
        ["子"] = "水", ["丑"] = "土", ["寅"] = "木", ["卯"] = "木", ["辰"] = "土", ["巳"] = "火",
        ["午"] = "火", ["未"] = "土", ["申"] = "金", ["酉"] = "金", ["戌"] = "土", ["亥"] = "水",
    };

    private static NameAnalysisService NewNameAnalysisService()
    {
        // NameAnalysisServiceTests 와 같은 구성 — 원국·용신은 진짜 서비스(점수의 조화 엔진만 가짜 사주)
        var scoring = new ScoringService(new AestheticEngine(), new HarmonyEngine(new FakeSajuCalculationService()), new RarityScoringEngine());
        return new NameAnalysisService(scoring, new AestheticEngine(), new RarityScoringEngine(), new ExplanationEngine(),
            new NameReversalEngine(), new SajuCalculationService(), new YongshinCalculationService(),
            NullLogger<NameAnalysisService>.Instance);
    }

    private static string JsonWithoutNameFit(SajuChartDto dto)
    {
        if (dto.Yongshin != null) dto.Yongshin.NameFitsYongshin = null;
        return JsonSerializer.Serialize(dto);
    }

    // ── 1. 재사용 동등성 ─────────────────────────────────────────────

    [Fact]
    public async Task Saju_SameAsNameAnalysis_AcrossGrid()
    {
        // 계산을 새로 만들지 않았다는 증거 — 같은 출생 정보로 /name-analysis 의 Saju 와 nameFitsYongshin 빼고 모든 필드가 같다.
        // 격자: 1950~2030 각 해 3일(1/1·입춘 무렵 2/4·11/20 — 해 경계·입춘 경계·한로 뒤 구간) × 시각 {없음, 00:20, 13:01, 23:40} × 출생지 {없음, busan, jeju}
        var analysis = NewNameAnalysisService();
        var days = new[] { (1, 1), (2, 4), (11, 20) };
        var times = new string?[] { null, "00:20", "13:01", "23:40" };
        var places = new string?[] { null, "busan", "jeju" };
        var mismatches = new List<string>();
        int compared = 0;

        for (int year = 1950; year <= 2030; year++)
        foreach (var (month, day) in days)
        foreach (var time in times)
        foreach (var place in places)
        {
            var date = new DateTime(year, month, day);
            var mine = await _service.FindAsync(date, time == null ? null : TimeSpan.Parse(time), place);
            var theirs = await analysis.AnalyzeNameAsync(new NameAnalysisRequestDto
            {
                LastName = "김", FirstName = "하늘",
                BirthDate = date.ToString("yyyy-MM-dd"), BirthTime = time, BirthplaceCode = place,
            });
            compared++;
            Assert.NotNull(theirs.Saju);
            Assert.Null(mine.Saju.Yongshin!.NameFitsYongshin); // 이름이 없다
            var a = JsonWithoutNameFit(mine.Saju);
            var b = JsonWithoutNameFit(theirs.Saju!);
            if (a != b) mismatches.Add($"{date:yyyy-MM-dd} {time ?? "-"} {place ?? "-"}");
        }

        Assert.Equal(81 * 3 * 4 * 3, compared);
        Assert.True(mismatches.Count == 0, "/name-analysis 와 다른 원국:\n" + string.Join("\n", mismatches.Take(20)));
    }

    // ── 2. 글자 수 ─────────────────────────────────────────────────

    [Theory]
    [InlineData("1990-03-15", null, 6)]
    [InlineData("1990-03-15", "14:30", 8)]
    [InlineData("2000-01-01", null, 6)]
    [InlineData("2024-02-04", "18:00", 8)]
    [InlineData("1985-06-05", "00:10", 8)]
    public async Task CharacterCount_IsSixWithoutTime_EightWithTime(string date, string? time, int expected)
    {
        var r = await _service.FindAsync(DateTime.Parse(date), time == null ? null : TimeSpan.Parse(time), null);
        Assert.Equal(expected, r.CharacterCount);
        Assert.Equal(time != null, r.HasBirthTime);
        Assert.Equal(time != null, r.Saju.HourPillar != null);
        Assert.Equal(expected, r.Saju.FiveElementCount.Values.Sum());
    }

    // ── 3. 지지 오행 ───────────────────────────────────────────────

    [Fact]
    public void Mapper_BranchFiveElement_MatchesHandTable_AllTwelveBranches()
    {
        foreach (var (branch, element) in BranchElementByHand)
        {
            var dto = SajuDtoMapper.ToPillarDto(new SajuPillar("甲", "갑", branch, "?", "木", "陽"));
            Assert.Equal(element, dto.BranchFiveElement);
            Assert.Equal("木", dto.FiveElement); // 천간 오행은 그대로
        }
    }

    [Fact]
    public async Task Response_BranchFiveElement_MatchesHandTable()
    {
        // 시각 열두 칸(두 시간마다)으로 시지 12개를 모두 지나간다 + 연·월·일주
        var seen = new HashSet<string>();
        for (int h = 0; h < 24; h += 2)
        {
            var r = await _service.FindAsync(new DateTime(1990, 3, 15), new TimeSpan(h, 40, 0), "busan");
            foreach (var p in new[] { r.Saju.YearPillar, r.Saju.MonthPillar, r.Saju.DayPillar, r.Saju.HourPillar! })
            {
                Assert.Equal(BranchElementByHand[p.BranchChar], p.BranchFiveElement);
                seen.Add(p.BranchChar);
            }
        }
        Assert.Equal(12, seen.Count);
    }

    // ── 4. 동률 최다 오행 ───────────────────────────────────────────

    [Fact]
    public void StrongestOf_ReturnsAllTied_InElementOrder()
    {
        Assert.Equal(new[] { "木", "火", "土" },
            SajuElementsService.StrongestOf(new Dictionary<string, int> { ["木"] = 2, ["火"] = 2, ["土"] = 2, ["金"] = 1, ["水"] = 1 }));
        Assert.Equal(new[] { "土" },
            SajuElementsService.StrongestOf(new Dictionary<string, int> { ["木"] = 2, ["火"] = 1, ["土"] = 3, ["金"] = 2, ["水"] = 0 }));
        // 사전 삽입 순서와 무관하게 木火土金水 순
        Assert.Equal(new[] { "木", "水" },
            SajuElementsService.StrongestOf(new Dictionary<string, int> { ["水"] = 3, ["金"] = 1, ["木"] = 3, ["火"] = 1, ["土"] = 0 }));
        Assert.Empty(SajuElementsService.StrongestOf(new Dictionary<string, int>()));
    }

    // ── 5. 묶음 ──────────────────────────────────────────────────

    private static YongshinResult Yongshin(string primary, string heeshin, string gishin) => new()
    {
        PrimaryYongshin = primary, Heeshin = heeshin, Gishin = gishin, EokbuYongshin = primary,
    };

    [Fact]
    public void BuildGroups_OrderRolesAndGishin()
    {
        // 용신 火·희신 木·기신 水, 없는 오행 [水·木](순서 섞어 넣음) → [火 yongshin], [木 heeshin+missing], [水 missing · 기신]
        var groups = SajuElementsService.BuildGroups(Yongshin("火", "木", "水"), new List<string> { "水", "木" });

        Assert.Equal(new[] { "火", "木", "水" }, groups.Select(g => g.Element));
        Assert.Equal(new[] { "yongshin" }, groups[0].Roles);
        Assert.Equal(new[] { "heeshin", "missing" }, groups[1].Roles);
        Assert.Equal(new[] { "missing" }, groups[2].Roles);

        Assert.False(groups[0].IsGishin);
        Assert.False(groups[1].IsGishin);
        Assert.True(groups[2].IsGishin);
        Assert.Equal(ElementHanjaPicker.MaxPerElement, groups[0].Hanja.Count);
        Assert.Equal(ElementHanjaPicker.MaxPerElement, groups[1].Hanja.Count);
        Assert.Empty(groups[2].Hanja); // 기신 — 한자 예를 싣지 않는다(D2)
    }

    [Fact]
    public void BuildGroups_AllMissing_FiveGroups_NoDuplicates()
    {
        // 용신 土·희신 火·기신 木, 다섯 오행이 모두 없다고 가정(묶음 상한 검사) → 土·火 다음 없는 오행 木金水 순
        var groups = SajuElementsService.BuildGroups(Yongshin("土", "火", "木"), new List<string> { "水", "金", "土", "火", "木" });

        Assert.Equal(new[] { "土", "火", "木", "金", "水" }, groups.Select(g => g.Element));
        Assert.Equal(5, groups.Select(g => g.Element).Distinct().Count());
        Assert.Equal(new[] { "yongshin", "missing" }, groups[0].Roles);
        Assert.Equal(new[] { "heeshin", "missing" }, groups[1].Roles);
        Assert.Equal(new[] { true, false, false }, groups.Skip(2).Select(g => g.IsGishin)); // 木 = 기신
        Assert.Empty(groups[2].Hanja);
        Assert.All(groups.Where(g => !g.IsGishin), g => Assert.Equal(ElementHanjaPicker.MaxPerElement, g.Hanja.Count));
    }

    [Fact]
    public void BuildGroups_NoMissing_YongshinAndHeeshinOnly()
    {
        var groups = SajuElementsService.BuildGroups(Yongshin("水", "金", "土"), new List<string>());
        Assert.Equal(new[] { "水", "金" }, groups.Select(g => g.Element));
        Assert.All(groups, g => Assert.False(g.IsGishin));
    }

    [Fact]
    public async Task Response_Groups_FollowYongshinOfTheSameChart()
    {
        // 여러 날짜에서 묶음이 응답 자신의 용신·희신·없는 오행·기신과 맞는지(기대값은 응답 필드로 따로 셈)
        var order = new[] { "木", "火", "土", "金", "水" };
        for (int year = 1950; year <= 2025; year += 3)
        foreach (var time in new TimeSpan?[] { null, new TimeSpan(9, 30, 0) })
        {
            var r = await _service.FindAsync(new DateTime(year, 7, 9), time, null);
            var y = r.Saju.Yongshin!;
            var expected = new List<string> { y.PrimaryYongshin };
            if (y.Heeshin != y.PrimaryYongshin) expected.Add(y.Heeshin);
            expected.AddRange(order.Where(e => r.Saju.MissingElements.Contains(e) && !expected.Contains(e)));

            Assert.Equal(expected, r.ElementHanja.Select(g => g.Element));
            Assert.InRange(r.ElementHanja.Count, 1, 5);
            foreach (var g in r.ElementHanja)
            {
                Assert.Equal(g.Element == y.Gishin, g.IsGishin);
                Assert.Equal(g.IsGishin ? 0 : ElementHanjaPicker.MaxPerElement, g.Hanja.Count);
                Assert.Equal(r.Saju.MissingElements.Contains(g.Element), g.Roles.Contains("missing"));
            }
        }
    }

    // ── 6. 골든 — 1990-03-15 14:30 부산 (설계 §2-2) ─────────────────

    [Fact]
    public async Task Golden_19900315_1430_Busan()
    {
        var r = await _service.FindAsync(new DateTime(1990, 3, 15), new TimeSpan(14, 30, 0), "busan");

        Assert.Equal(new[] { "庚午", "己卯", "己卯", "辛未" },
            new[] { r.Saju.YearPillar, r.Saju.MonthPillar, r.Saju.DayPillar, r.Saju.HourPillar! }.Select(p => p.StemChar + p.BranchChar));
        Assert.Equal(new[] { "火", "木", "木", "土" },
            new[] { r.Saju.YearPillar, r.Saju.MonthPillar, r.Saju.DayPillar, r.Saju.HourPillar! }.Select(p => p.BranchFiveElement));
        Assert.Equal(new Dictionary<string, int> { ["木"] = 2, ["火"] = 1, ["土"] = 3, ["金"] = 2, ["水"] = 0 }, r.Saju.FiveElementCount);
        Assert.Equal(new[] { "水" }, r.Saju.MissingElements);
        Assert.Equal(new[] { "土" }, r.StrongestElements);
        Assert.Equal("己", r.Saju.DayMaster);
        Assert.Equal("부산", r.Saju.BirthplaceName);
        Assert.Equal(-24, r.Saju.CorrectionMinutes);
        Assert.Equal(8, r.CharacterCount);
        Assert.True(r.HasBirthTime);
        Assert.False(r.BirthplaceDefaulted);

        Assert.True(r.Saju.CorrectionApplied);
        Assert.Null(r.Saju.TermOnBirthDay);

        var y = r.Saju.Yongshin!;
        Assert.Equal("Weak", y.Strength);
        // 강약 −4 — 손 계산(일간 己土): 천간 庚 −1 · 己 +1 · 辛 −1, 지지 연 午(火生土) +1 · 월 卯(木克土) −3 · 일 卯 −2 · 시 未 +1.
        // P0(B4) 전에는 월주·일주가 모두 己卯라 값 비교로 일지에 ×3 이 붙어 −5 였다
        Assert.Equal(-4, y.StrengthScore);
        Assert.Equal("火", y.EokbuYongshin);
        Assert.Equal("火", y.JohuYongshin);
        Assert.Equal("火", y.PrimaryYongshin);
        Assert.Equal("木", y.Heeshin);
        Assert.Equal("水", y.Gishin);
        Assert.Null(y.NameFitsYongshin);

        Assert.Equal(new[] { "火", "木", "水" }, r.ElementHanja.Select(g => g.Element));
        Assert.Equal(new[] { "yongshin" }, r.ElementHanja[0].Roles);
        Assert.Equal(new[] { "heeshin" }, r.ElementHanja[1].Roles);
        Assert.Equal(new[] { "missing" }, r.ElementHanja[2].Roles);
        Assert.True(r.ElementHanja[2].IsGishin);
        Assert.Empty(r.ElementHanja[2].Hanja);
        Assert.All(r.ElementHanja.Take(2), g => Assert.Equal(12, g.Hanja.Count));
    }

    // ── 사주 계산 수정 P0(설계 §1·§17) 뒤의 값 — /saju/elements 가 고친 계산을 그대로 물려받는지 ───────────────
    // 2026-11-19 반박 검토 때 Skip 으로 미리 써 두었고 같은 날 P0 구현에서 풀었다. P0 전 코드는 여기서 B1·B2·B4 의 틀린 값을 냈다.

    [Fact]
    public async Task P0_NoTime_19850605_DayIsEulhae_SixCharacters()
    {
        // B1 — P0 전에는 시각이 없어도 −32분을 빼 전날(甲戌)이 됐다. 정답 乙亥(1900-01-01 甲戌 기준 손 계산, SajuCalculationP0Tests 와 같은 값)
        var r = await _service.FindAsync(new DateTime(1985, 6, 5), null, null);
        Assert.Equal("乙亥", r.Saju.DayPillar.StemChar + r.Saju.DayPillar.BranchChar);
        Assert.Null(r.Saju.HourPillar);
        Assert.Equal(6, r.CharacterCount);
        Assert.False(r.Saju.CorrectionApplied);
        Assert.Equal(0, r.Saju.CorrectionMinutes); // 쓰지 않은 보정값을 싣지 않는다
        Assert.Null(r.Saju.TermOnBirthDay);        // 1985-06-05 는 절기가 드는 날이 아니다(망종 6/6)
    }

    [Fact]
    public async Task P0_Golden_19900315_1430_Busan_StrengthIsMinus4()
    {
        // B4 — 월주·일주가 모두 己卯라 값 비교(record ==)로 일지에 ×3 이 붙어 P0 전에는 −5. 자리 가중치(월지 3·일지 2)면 −4(설계 §2-2 손 계산)
        var r = await _service.FindAsync(new DateTime(1990, 3, 15), new TimeSpan(14, 30, 0), "busan");
        Assert.Equal(-4, r.Saju.Yongshin!.StrengthScore);
        Assert.Equal("Weak", r.Saju.Yongshin.Strength);
    }

    [Fact]
    public async Task P0_20241120_MonthIsEulhae()
    {
        // B2 — P0 전에는 한로~12/31 월지가 늘 酉(癸酉). 2024-11-20 은 입동(11/7) 뒤 대설(12/7) 전 → 乙亥월
        var r = await _service.FindAsync(new DateTime(2024, 11, 20), null, null);
        Assert.Equal("乙亥", r.Saju.MonthPillar.StemChar + r.Saju.MonthPillar.BranchChar);
    }

    [Fact]
    public async Task P0_LateZiHour_20000101_0020_Seoul()
    {
        // B5 — 서울 0시 20분 → 보정 전날 23:47: 일주는 전날(丁巳), 시주는 다음 날(戊午) 자시 壬子. P0 전 庚子(설계 §10 확인 목록 6)
        var r = await _service.FindAsync(new DateTime(2000, 1, 1), new TimeSpan(0, 20, 0), null);
        Assert.Equal("丁巳", r.Saju.DayPillar.StemChar + r.Saju.DayPillar.BranchChar);
        Assert.Equal("壬子", r.Saju.HourPillar!.StemChar + r.Saju.HourPillar.BranchChar);
        Assert.True(r.Saju.CorrectionApplied);
        Assert.Equal(-32, r.Saju.CorrectionMinutes);
    }

    [Fact]
    public async Task P0c_NoTime_OnLichunDay_TermOnBirthDayIsCarriedToTheResponse()
    {
        // P0-c — 시각 없이 넣은 2024-02-04(입춘 17:27)는 낮 12시 기준이라 묵은 해·묵은 달이고, 응답이 절기 이름을 싣는다(화면의 절기 안내 한 줄)
        var r = await _service.FindAsync(new DateTime(2024, 2, 4), null, null);
        Assert.Equal("입춘", r.Saju.TermOnBirthDay);
        Assert.Equal("癸卯", r.Saju.YearPillar.StemChar + r.Saju.YearPillar.BranchChar);
        Assert.Equal("乙丑", r.Saju.MonthPillar.StemChar + r.Saju.MonthPillar.BranchChar);

        var withTime = await _service.FindAsync(new DateTime(2024, 2, 4), new TimeSpan(18, 0, 0), null);
        Assert.Null(withTime.Saju.TermOnBirthDay);
        Assert.Equal("甲辰", withTime.Saju.YearPillar.StemChar + withTime.Saju.YearPillar.BranchChar);
    }

    [Fact]
    public async Task P0c_NoTime_OnTermDay_NameAnalysisResponseCarriesTheTermToo()
    {
        // /analysis 사주 카드도 같은 절기 줄을 그린다(프런트 DetailSaju — 2026-11-19 검토 반영, 설계 §17-8). 그 줄의 재료는 /name-analysis 응답의
        // termOnBirthDay — 시각 없이 절기가 드는 날을 넣으면 실리고, 시각을 넣거나 절기가 아닌 날이면 null 이다
        var analysis = NewNameAnalysisService();
        async Task<SajuChartDto> Saju(string date, string? time) =>
            (await analysis.AnalyzeNameAsync(new NameAnalysisRequestDto
            {
                LastName = "김", FirstName = "하늘", BirthDate = date, BirthTime = time,
            })).Saju!;

        var lichun = await Saju("2024-02-04", null);          // 입춘 17:27(한국천문연구원) — 낮 12시에는 아직 묵은 해·묵은 달
        Assert.Equal("입춘", lichun.TermOnBirthDay);
        Assert.False(lichun.CorrectionApplied);
        Assert.Equal("癸卯", lichun.YearPillar.StemChar + lichun.YearPillar.BranchChar);
        Assert.Equal("乙丑", lichun.MonthPillar.StemChar + lichun.MonthPillar.BranchChar);

        Assert.Equal("한로", (await Saju("2024-10-08", null)).TermOnBirthDay); // 한로 04:00 — B2 구간의 절
        Assert.Null((await Saju("2024-02-04", "18:00")).TermOnBirthDay);       // 시각을 넣었으면 안내가 필요 없다
        Assert.Null((await Saju("2024-02-05", null)).TermOnBirthDay);          // 절기가 드는 날이 아니다
    }

    // ── 입력 처리 ─────────────────────────────────────────────────

    [Fact]
    public async Task Birthplace_DefaultedFlag_AndNormalization()
    {
        var none = await _service.FindAsync(new DateTime(1990, 3, 15), new TimeSpan(14, 30, 0), null);
        Assert.True(none.BirthplaceDefaulted);
        Assert.Equal("서울", none.Saju.BirthplaceName);

        var blank = await _service.FindAsync(new DateTime(1990, 3, 15), new TimeSpan(14, 30, 0), "  ");
        Assert.True(blank.BirthplaceDefaulted);

        var upper = await _service.FindAsync(new DateTime(1990, 3, 15), new TimeSpan(14, 30, 0), " Busan ");
        Assert.False(upper.BirthplaceDefaulted);
        Assert.Equal("부산", upper.Saju.BirthplaceName);
    }

    [Fact]
    public async Task BadInput_ThrowsKoreanSajuInputException_WithoutInputValues()
    {
        // 서비스가 막는 입력 오류는 SajuInputException(정확한 타입 — 컨트롤러가 이 타입만 400 으로 돌려준다, 설계 §16).
        // 모르는 출생지를 조용히 서울로 바꾸지 않는다(BirthplaceData.Find 와 다르게)
        var place = await Assert.ThrowsAsync<SajuInputException>(() => _service.FindAsync(new DateTime(1990, 3, 15), null, "mars"));
        Assert.Equal("출생지는 목록에 있는 시·도 가운데 하나여야 합니다.", place.Message);

        var early = await Assert.ThrowsAsync<SajuInputException>(() => _service.FindAsync(new DateTime(1899, 12, 31), null, null));
        Assert.Equal("생년월일은 1900년 1월 1일 이후로 넣어 주세요.", early.Message);

        var time = await Assert.ThrowsAsync<SajuInputException>(() => _service.FindAsync(new DateTime(1990, 3, 15), TimeSpan.FromHours(25), null));
        Assert.Equal("출생 시각은 HH:mm 형식이어야 합니다. (예: 14:30)", time.Message);

        foreach (var m in new[] { place.Message, early.Message, time.Message })
            Assert.DoesNotContain("mars", m);
    }
}
