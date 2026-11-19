using NameForm.Application.Engines.Data;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 오행별 이름 한자 예 — 부족한 오행 찾기(/saju/elements, 2026-11 설계 docs/plan-ohaeng-2026-11.md §4).
/// 인명 빈출 322자(<see cref="HanjaData.IsCommonNameHanja"/>) 가운데 부수 기준 자원오행(<see cref="HanjaInfo.FiveElement"/>)이 그 오행이고
/// 등급이 확정(R)·예외 적용(X)이며, 이름에 쓸 수 있고(불용 아님 + 뜻 있음) 약자가 아니며, CJK 기본 영역이고, 그 독음의 훈이 있는 글자를
/// <see cref="HanjaSelector.OrderForDisplay"/> 순서로 독음이 겹치지 않게 오행마다 <see cref="MaxPerElement"/>자까지 고른다.
/// 성별·용신은 보지 않는다(성별 없는 표시 정렬 — 관련도의 '성별 값 +5'는 사이트 다른 표시 경로와 같이 그대로).
/// 결과는 사전(HanjaData)만으로 정해져 결정적이고, 오행마다 한 번 계산해 캐시한다.
/// </summary>
public static class ElementHanjaPicker
{
    /// <summary>오행마다 보여 줄 최대 글자 수</summary>
    public const int MaxPerElement = 12;

    /// <summary>木火土金水 — 응답·정렬의 오행 순서</summary>
    public static readonly IReadOnlyList<string> Elements = new[] { "木", "火", "土", "金", "水" };

    private static readonly Dictionary<string, Lazy<IReadOnlyList<HanjaInfo>>> Cache =
        Elements.ToDictionary(e => e, e => new Lazy<IReadOnlyList<HanjaInfo>>(() => Build(e).AsReadOnly()));

    /// <summary>그 오행의 한자 예(캐시). 오행이 아니면 빈 목록.</summary>
    public static IReadOnlyList<HanjaInfo> For(string element)
        => Cache.TryGetValue(element, out var lazy) ? lazy.Value : Array.Empty<HanjaInfo>();

    /// <summary>
    /// 후보 술어 — 모두 참이어야 한다(§4-2).
    /// V(이견 있음)는 '그 오행을 채우는 글자'로 내밀면서 자료끼리 값이 갈리는 글자라 뺀다. U 는 FiveElement 가 빈 값이라 애초에 걸리지 않는다.
    /// </summary>
    public static bool IsCandidate(HanjaInfo h, string element)
        => HanjaData.IsCommonNameHanja(h.Character)
           && h.FiveElement == element
           && h.ResourceGrade is ("R" or "X")
           && HanjaSelector.IsUsableNameHanja(h)
           && !HanjaData.IsWeakGivenNameHanja(h.Character)
           && HanjaData.IsInCjkBasicRange(h.Character)
           && !string.IsNullOrWhiteSpace(HanjaData.GlossForReading(h.Meaning, h.Reading));

    /// <summary>
    /// 규칙 본체 — 후보를 표시 정렬한 뒤 독음마다 1자 먼저(같은 Reading 이 이미 있으면 건너뜀) <see cref="MaxPerElement"/>자까지,
    /// 모자라면 건너뛴 글자로 같은 순서에서 채운다(德·悳, 鍾·鐘 같은 독음 겹침을 뒤로).
    /// </summary>
    public static List<HanjaInfo> Build(string element)
    {
        var ordered = HanjaSelector.OrderForDisplay(
                HanjaData.GetAllHanja().Where(h => IsCandidate(h, element)))
            .ToList();

        var picked = new List<HanjaInfo>();
        var skipped = new List<HanjaInfo>();
        var seenReadings = new HashSet<string>(StringComparer.Ordinal);
        foreach (var h in ordered)
        {
            if (picked.Count >= MaxPerElement) break;
            if (seenReadings.Add(h.Reading)) picked.Add(h);
            else skipped.Add(h);
        }
        foreach (var h in skipped)
        {
            if (picked.Count >= MaxPerElement) break;
            picked.Add(h);
        }
        return picked;
    }

    /// <summary>
    /// 링크할 독음 — 대표 독음 + 대체 독음 중 한글 한 음절(李 리·이, 蓮 련·연). 순서 유지·중복 없음.
    /// /hanja/{독음} 은 생성된 독음만 열리니(dynamicParams=false) 테스트가 hanja-seo.json 의 r 목록과 대조한다.
    /// </summary>
    public static List<string> ReadingsOf(HanjaInfo h)
    {
        var result = new List<string>();
        foreach (var r in new[] { h.Reading }.Concat(h.AlternateReadings ?? new List<string>()))
        {
            var s = r?.Trim();
            if (string.IsNullOrEmpty(s) || s.Length != 1 || s[0] < '가' || s[0] > '힣') continue;
            if (!result.Contains(s)) result.Add(s);
        }
        return result;
    }
}
