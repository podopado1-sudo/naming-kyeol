using NameForm.Application.Engines.Data;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 부모 기반 작명의 '한 글자' 원천 — 기준 음절(어머니 성·부모 이름 글자·키워드 한자 독음·성씨와 이어지는 글자)과 실제 이름에서
/// 짝을 이루어 온 글자를 실명 통계(NameGenderData — 대법원 출생신고 2008~2019, 이름 전체 20명 이상)에서 고른다(2026-10-28).
/// 옛 원천은 사전 삽입 순서 앞 5·10·15자(GetFilteredHanja Take — HanjaData 하드코딩 블록 春 秋 天 海 雲 …)라 입력과 무관한
/// 같은 음절(춘·추·천·해·운)이 반복됐고 실명 비율이 0~1.5%(문소리·복합)였다.
///
/// 고르는 규칙(위에서부터):
///  1. 2음절 실명(NameCounts 기본 임계 20명 이상)이고 기준 음절이 그 자리(앞·뒤)에 있으며 두 음절이 다르다
///  2. 호출자의 거르기(<c>accept</c> — 부모 엔진의 공통 품질 거르기)를 지난다
///  3. 요청 성별과 반대로 뚜렷이 기우는 이름(NamingPrinciples.GenderLeanLabel)은 뺀다
///  4. 짝 음절의 보이는 한자 한 글자(<see cref="HanjaSelector.Select"/> 용신 없음 — 출생일 없는 배정·/name 과 같은 선택기)가 쓸 수 있는 글자여야 하고,
///     그 한 글자의 성별·톤이 요청과 반대면 뺀다 — 옛 GetFilteredHanja 의 성별·톤 거르기를 '음절의 아무 글자'가 아니라 '보이는 한자'로 본다
///     (2026-10-26 결정 ③ 의 판정 정신)
/// 순서(빈도 순으로만 고르지 않는다): 유행 이름(AestheticEngine.IsTrendyName — 미학 −5 목록)은 맨 뒤 → 톤을 고른 요청이면 짝 글자 톤이 같은 것 먼저 →
/// 빈도 구간 [100, 2500)(NameGenderData.DistinctiveNames 기본 구간 — 흔하지 않으나 검증된 꼬리, 창의 작명과 같은 구간) → 2500명 이상 → 20~99명 →
/// 같은 구간 안에서는 빈도 높은 순 → 이름 서수 순(결정성).
/// </summary>
public static class RealNamePartners
{
    /// <summary>고른 이름 하나 — 짝 음절과 그 음절의 보이는 한자·그 독음의 훈(GlossForReading).</summary>
    public sealed record Partner(string Name, string Syllable, HanjaData.HanjaInfo Hanja, string Gloss, long Total);

    private const long BandLow = 100;
    private const long BandHigh = 2500;

    private static readonly Lazy<Dictionary<(char Anchor, bool AnchorFirst), List<(string Name, long Total)>>> Index = new(BuildIndex);

    private static Dictionary<(char, bool), List<(string Name, long Total)>> BuildIndex()
    {
        var index = new Dictionary<(char, bool), List<(string Name, long Total)>>();
        // DistinctiveNames 는 2음절 이름만 돌려준다 — 하한 20 = NameCounts 기본 임계(실명으로 세는 기준), 상한 없음
        foreach (var (name, m, f) in NameGenderData.DistinctiveNames(20, long.MaxValue))
        {
            if (name[0] == name[1]) continue;
            Add((name[0], true), (name, m + f));
            Add((name[1], false), (name, m + f));
        }
        return index;

        void Add((char, bool) key, (string, long) entry)
        {
            if (!index.TryGetValue(key, out var list)) index[key] = list = new List<(string Name, long Total)>();
            list.Add(entry);
        }
    }

    /// <summary>
    /// 기준 음절 <paramref name="anchor"/> 가 앞(<paramref name="anchorFirst"/>) 또는 뒤에 오는 실명에서 짝 글자를 골라 위 순서로 최대 <paramref name="take"/>개.
    /// <paramref name="visibleHanja"/> 는 음절의 보이는 한자(호출자가 요청 하나 안에서 캐시할 때) — 없으면 HanjaSelector.Select(음절, 성별, 용신 없음).
    /// <paramref name="relaxGender"/> = 규칙 3(이름 성별 기움)과 규칙 4 의 성별 검사를 건너뛴다 — 부모 엔진이 후보가 5개 미만일 때 마지막 예비 경로로만 쓴다.
    /// </summary>
    public static List<Partner> Find(
        string anchor, bool anchorFirst, string gender, string tone, int take,
        Func<string, bool>? accept = null,
        Func<string, HanjaData.HanjaInfo?>? visibleHanja = null,
        bool relaxGender = false)
    {
        var result = new List<Partner>();
        if (string.IsNullOrEmpty(anchor) || anchor.Length != 1 || take <= 0) return result;
        if (!Index.Value.TryGetValue((anchor[0], anchorFirst), out var entries)) return result;
        visibleHanja ??= s => HanjaSelector.Select(s, gender, null, null, null).FirstOrDefault();

        var picked = new List<(Partner P, int Rank)>();
        foreach (var (name, total) in entries)
        {
            var syllable = (anchorFirst ? name[1] : name[0]).ToString();
            if (accept != null && !accept(name)) continue;
            if (!relaxGender && NamingPrinciples.GenderLeanLabel(name, gender) != null) continue;
            var h = visibleHanja(syllable);
            if (h == null || !HanjaSelector.IsUsableNameHanja(h)) continue;
            if ((!relaxGender && OppositeGender(h, gender)) || OppositeTone(h, tone)) continue;

            int rank = 0;
            if (AestheticEngine.IsTrendyName(name)) rank += 1000;
            if ((tone == "soft" || tone == "strong") && !SameTone(h, tone)) rank += 100;
            rank += total >= BandLow && total < BandHigh ? 0 : total >= BandHigh ? 10 : 20;
            picked.Add((new Partner(name, syllable, h, HanjaData.GlossForReading(h.Meaning, syllable), total), rank));
        }

        return picked
            .OrderBy(x => x.Rank)
            .ThenByDescending(x => x.P.Total)
            .ThenBy(x => x.P.Name, StringComparer.Ordinal)
            .Take(take)
            .Select(x => x.P)
            .ToList();
    }

    /// <summary>이름 전체가 실명 통계에 20명 이상 있는지(NameCounts 기본 임계) — 부모 이름 글자로 만든 후보의 실명 판정.</summary>
    public static bool IsRealName(string name) => NameGenderData.NameCounts(name) != null;

    private static bool OppositeGender(HanjaData.HanjaInfo h, string gender)
        => (gender == "male" && h.GenderPref == HanjaData.GenderPreference.Female)
        || (gender == "female" && h.GenderPref == HanjaData.GenderPreference.Male);

    private static bool OppositeTone(HanjaData.HanjaInfo h, string tone)
        => (tone == "soft" && h.TonePref == HanjaData.TonePreference.Strong)
        || (tone == "strong" && h.TonePref == HanjaData.TonePreference.Soft);

    private static bool SameTone(HanjaData.HanjaInfo h, string tone)
        => (tone == "soft" && h.TonePref == HanjaData.TonePreference.Soft)
        || (tone == "strong" && h.TonePref == HanjaData.TonePreference.Strong);
}
