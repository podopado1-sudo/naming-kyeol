using NameForm.Application.DTOs;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Domain.Models.Saju;

namespace NameForm.Application.Services;

/// <summary>
/// 부족한 오행 찾기(/saju/elements, 2026-11 설계 docs/plan-ohaeng-2026-11.md §2·§3).
/// ① <see cref="ISajuCalculationService.CalculateChart"/> ② <see cref="IYongshinCalculationService.Calculate"/> ③ <see cref="SajuDtoMapper.ToDto"/>
/// — /name-analysis 와 같은 계산·같은 매퍼(SajuElementsServiceTests 재사용 동등성). 더하는 것은 글자 수·동률 최다 오행 목록·오행별 한자 예뿐이다.
/// 로거를 두지 않는다 — 입력값(생년월일·시각·출생지)을 로그에 남기지 않기 위해(개인정보처리방침).
/// </summary>
public class SajuElementsService : ISajuElementsService
{
    /// <summary><see cref="SolarTermCalculator"/> 정확도 범위(1900~2100)의 시작 — 컨트롤러가 먼저 막고, 서비스 단독 호출도 같은 문구로 막는다</summary>
    public static readonly DateTime MinBirthDate = new(1900, 1, 1);

    public const string RoleYongshin = "yongshin";
    public const string RoleHeeshin = "heeshin";
    public const string RoleMissing = "missing";

    private readonly ISajuCalculationService _sajuCalculationService;
    private readonly IYongshinCalculationService _yongshinCalculationService;

    public SajuElementsService(
        ISajuCalculationService sajuCalculationService,
        IYongshinCalculationService yongshinCalculationService)
    {
        _sajuCalculationService = sajuCalculationService;
        _yongshinCalculationService = yongshinCalculationService;
    }

    public Task<SajuElementsResponseDto> FindAsync(DateTime birthDate, TimeSpan? birthTime, string? birthplaceCode)
    {
        // 문구에 입력값을 넣지 않는다(컨트롤러가 SajuInputException 만 ex.Message 그대로 400 으로 돌려준다 — 그 밖의 예외는 500 고정 문구)
        if (birthDate.Date < MinBirthDate)
            throw new SajuInputException("생년월일은 1900년 1월 1일 이후로 넣어 주세요.");
        if (birthTime.HasValue && (birthTime.Value < TimeSpan.Zero || birthTime.Value >= TimeSpan.FromDays(1)))
            throw new SajuInputException("출생 시각은 HH:mm 형식이어야 합니다. (예: 14:30)");

        var code = string.IsNullOrWhiteSpace(birthplaceCode) ? null : birthplaceCode.Trim().ToLowerInvariant();
        if (code != null && !BirthplaceData.IsKnownCode(code))
            throw new SajuInputException("출생지는 목록에 있는 시·도 가운데 하나여야 합니다.");

        // ① 원국 ② 용신 ③ 공용 매퍼(이름이 없어 hanjaBreakdown 은 빈 목록 → NameFitsYongshin null)
        var chart = _sajuCalculationService.CalculateChart(birthDate.Date, birthTime, code);
        var yongshin = _yongshinCalculationService.Calculate(chart);
        var saju = SajuDtoMapper.ToDto(chart, yongshin, new List<HanjaBreakdownDto>());

        return Task.FromResult(new SajuElementsResponseDto
        {
            Saju = saju,
            CharacterCount = chart.HourPillar != null ? 8 : 6,
            HasBirthTime = birthTime.HasValue,
            BirthplaceDefaulted = code == null,
            // ④ 동률 최다 오행 전부 ⑤⑥ 묶음 + 한자 예
            StrongestElements = StrongestOf(chart.FiveElementCount),
            ElementHanja = BuildGroups(yongshin, chart.MissingElements),
        });
    }

    /// <summary>
    /// 개수 최댓값과 같은 오행 전부, 木火土金水 순(사전 삽입 순서와 무관). 빈 사전이면 빈 목록.
    /// SajuChart.StrongestElement 는 동률이면 첫 하나뿐이라 화면 문장('목(木)·화(火)로 2개씩')에 쓰지 못한다.
    /// </summary>
    public static List<string> StrongestOf(IReadOnlyDictionary<string, int> count)
    {
        if (count.Count == 0) return new List<string>();
        var max = count.Values.Max();
        return ElementHanjaPicker.Elements
            .Where(e => count.TryGetValue(e, out var n) && n == max)
            .ToList();
    }

    /// <summary>
    /// 오행 묶음 — 용신 → 희신 → 없는 오행(木火土金水 순). 이미 나온 오행은 새 묶음 대신 그 묶음의 Roles 에 더한다(같은 오행 두 번 없음, 최대 5).
    /// 없는 오행이 기신이면 IsGishin true·한자 예 비움(설계 D2 권고 — /evaluate 조화 점수가 기신 한자를 감점하므로 '채우는 한자'로 권하지 않는다).
    /// 용신·희신은 기신일 수 없다(희신 = 용신을 생하는 오행, 기신 = 용신을 극하는 오행 — YongshinCalculationService).
    /// </summary>
    public static List<ElementHanjaGroupDto> BuildGroups(YongshinResult yongshin, IReadOnlyList<string> missingElements)
    {
        var groups = new List<ElementHanjaGroupDto>();

        void Add(string element, string role)
        {
            if (string.IsNullOrEmpty(element) || !ElementHanjaPicker.Elements.Contains(element)) return;
            var existing = groups.FirstOrDefault(g => g.Element == element);
            if (existing != null)
            {
                if (!existing.Roles.Contains(role)) existing.Roles.Add(role);
                return;
            }
            groups.Add(new ElementHanjaGroupDto { Element = element, Roles = new List<string> { role } });
        }

        Add(yongshin.PrimaryYongshin, RoleYongshin);
        Add(yongshin.Heeshin, RoleHeeshin);
        foreach (var e in ElementHanjaPicker.Elements.Where(missingElements.Contains))
            Add(e, RoleMissing);

        foreach (var g in groups)
        {
            g.IsGishin = g.Element == yongshin.Gishin;
            g.Hanja = g.IsGishin
                ? new List<ElementHanjaDto>()
                : ElementHanjaPicker.For(g.Element).Select(ToHanjaDto).ToList();
        }
        return groups;
    }

    private static ElementHanjaDto ToHanjaDto(HanjaData.HanjaInfo h) => new()
    {
        Character = h.Character,
        Reading = h.Reading,
        Readings = ElementHanjaPicker.ReadingsOf(h),
        Gloss = HanjaData.GlossForReading(h.Meaning, h.Reading),
        ResourceGrade = h.ResourceGrade,
    };
}
