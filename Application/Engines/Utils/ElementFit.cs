namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 출생일로만 정해지는 '오행 쪽 사정' — 용신·희신·기신, 사주에 부족한 오행·많은 오행, 사주 글자의 오행 개수
/// (2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §4-3·§7-1). 한자와 무관하다: 같은 생년월일·시각이면 어떤 한자를 고르든 같은 값이다.
/// 조화 엔진이 자원오행 보완 30점을 매길 때 쓰는 값 그대로를 담아, 응답(hanjaSummary.elementFit·fills)이 점수·노트와 다른 말을 하지 않게 한다 —
/// 용신은 새로 계산하지 않고 <see cref="HarmonyEngine"/> 이 한자 배정 앞에서 구해 둔 값을 받고, 부족·과다 식은 <see cref="Balance"/> 하나를 엔진과 함께 쓴다.
/// 조화의 '부족'은 평균 미만이라(여덟 글자 평균 1.6·여섯 글자 1.2 → 1개 이하는 모두 부족) /ohaeng 의 '없는 오행'(0개)보다 넓다.
/// </summary>
/// <param name="Yongshin">용신 오행(木·火·土·金·水). 용신 계산이 없거나 실패했으면 null</param>
/// <param name="Heeshin">희신 오행 — 없으면 null</param>
/// <param name="Gishin">기신 오행 — 없으면 null</param>
/// <param name="Lacking">사주에 부족한 오행(평균 미만)</param>
/// <param name="Excessive">사주에 많은 오행(평균의 1.5배 초과)</param>
/// <param name="Counts">사주 글자의 오행 개수(SajuChart.FiveElementCount 그대로 — 시각이 없으면 여섯 글자)</param>
public sealed record ElementFit(
    string? Yongshin, string? Heeshin, string? Gishin,
    IReadOnlyList<string> Lacking, IReadOnlyList<string> Excessive,
    IReadOnlyDictionary<string, int> Counts)
{
    public const string RoleYongshin = "yongshin";
    public const string RoleHeeshin = "heeshin";
    public const string RoleGishin = "gishin";
    public const string RoleLacking = "lacking";
    public const string RoleExcessive = "excessive";

    /// <summary>
    /// 평균 미만 = 부족, 평균의 1.5배 초과 = 과다 — HarmonyEngine.CalculateFiveElementScore 가 쓰던 식 그대로(사전을 같은 순서로 훑는다).
    /// 빈 사전에는 예전 식과 똑같이 예외가 난다(Average) — 실제 사주 계산은 늘 다섯 오행을 담아 준다.
    /// </summary>
    public static (List<string> Lacking, List<string> Excessive) Balance(IReadOnlyDictionary<string, int> counts)
    {
        double avg = counts.Values.Average();
        var lacking = counts.Where(e => e.Value < avg).Select(e => e.Key).ToList();
        var excessive = counts.Where(e => e.Value > avg * 1.5).Select(e => e.Key).ToList();
        return (lacking, excessive);
    }

    /// <summary>
    /// 사주 오행 개수와 엔진이 이미 구해 둔 용신 세 값으로 만든다. 사주를 못 구했으면(개수가 없으면) null — 던지지 않는다.
    /// 빈 문자열 용신은 null 로 맞춘다(응답에서 '없음'이 한 가지 꼴이 되게).
    /// </summary>
    public static ElementFit? From(
        IReadOnlyDictionary<string, int>? counts, string? yongshin, string? heeshin, string? gishin)
    {
        if (counts == null || counts.Count == 0) return null;
        var (lacking, excessive) = Balance(counts);
        return new ElementFit(
            NullIfEmpty(yongshin), NullIfEmpty(heeshin), NullIfEmpty(gishin),
            lacking, excessive,
            new Dictionary<string, int>(counts));   // 사주 객체의 사전을 붙들지 않게 복사(순서 유지)
    }

    private static string? NullIfEmpty(string? value) => string.IsNullOrEmpty(value) ? null : value;

    /// <summary>
    /// 이 자원오행이 맡는 역할 — yongshin · heeshin · gishin · lacking · excessive (이 순서). 오행이 비었으면 빈 목록.
    /// 조화 엔진의 가감과 같은 조건이다: 용신·희신인 오행에는 excessive 를 붙이지 않고(과다 감점 제외 — S5b),
    /// lacking 은 용신·기신 여부와 무관하게 붙는다(부족한 오행 +10 은 따로 더해진다).
    /// 그래서 gishin 이 붙은 글자는 곧 '기신 … 충돌 (감점)' 노트가 실제로 걸린 글자다.
    /// </summary>
    public IReadOnlyList<string> RolesOf(string? element)
    {
        if (string.IsNullOrEmpty(element)) return Array.Empty<string>();

        var roles = new List<string>(3);
        if (element == Yongshin) roles.Add(RoleYongshin);
        if (element == Heeshin) roles.Add(RoleHeeshin);
        if (element == Gishin) roles.Add(RoleGishin);
        if (Lacking.Contains(element)) roles.Add(RoleLacking);
        if (Excessive.Contains(element) && element != Yongshin && element != Heeshin) roles.Add(RoleExcessive);
        return roles;
    }
}
