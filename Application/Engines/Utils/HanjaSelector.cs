using NameForm.Application.Engines.Data;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 이름 음절별 대표 한자를 "한 번 제대로" 선택하는 단일 진실의 원천.
/// 점수(자원오행)·표시(뜻)·저장이 모두 같은 한자를 쓰도록 결정적으로 동작한다.
/// (기존엔 NamePool/Harmony/Explanation이 각자 따로 한자를 뽑아 불일치했음)
///
/// 선택 우선순위 — 이 층은 "정해진 발음 이름에 어떤 한자를 배정하느냐"이지,
/// 어떤 이름이 1등이냐(미학 우선 랭킹)가 아니므로 용신을 강하게 써도 철학에 어긋나지 않는다:
///   1) 불용한자(부정 의미) 배제 + 한글 뜻 보유
///   2) 인명 빈출 한자 우선(雨·塞·羅 등 비이름 글자 회피)
///   3) 용신/희신 오행과 한자 오행 일치를 '주된' 기준으로 가산, 기신은 회피
///   4) 성별 선호 일치 + 인명 관련도(타이브레이크)
/// </summary>
public static class HanjaSelector
{
    /// <summary>
    /// 이 글자가 '이름용으로 약한 한자'인지 — 동음의 더 나은 대안이 있으면 양보해야 하는 글자.
    /// 세트는 HanjaData.WeakGivenNameHanjaSet(359자, 2026-07-02 전수 스캔 확정)로 이관 —
    /// 기존 호출부(CreativeNamingEngine 등) 호환을 위한 위임 심.
    /// </summary>
    public static bool IsWeakGivenNameHanja(string character) => HanjaData.IsWeakGivenNameHanja(character);

    /// <summary>오행 상생: key가 생(生)하는 오행.</summary>
    private static readonly Dictionary<string, string> ElementGenerates = new()
    {
        { "木", "火" }, { "火", "土" }, { "土", "金" }, { "金", "水" }, { "水", "木" }
    };

    /// <summary>
    /// 표시용(/name 페이지): 한 발음 이름(2음절)에 흔히 쓰는 한자 '조합' 상위 k개를 오행 조화까지
    /// 반영해 선별. 각 음절 대표 1개만 뽑는 <see cref="Select"/>와 달리, "智宇·志宇·智祐"처럼
    /// 조합 다양성을 보이기 위한 별도 경로다. 결과 한자는 모두 뜻·획수를 가진 표시 가능 글자.
    /// </summary>
    public static List<(string First, string Second)> SelectCombos(string name, string gender, int k)
    {
        var result = new List<(string, string)>();
        if (string.IsNullOrEmpty(name) || name.Length != 2) return result;

        var g = ParseGender(gender);
        var first = TopComboCandidates(name[0].ToString(), g, 6);
        var second = TopComboCandidates(name[1].ToString(), g, 6);
        if (first.Count == 0 || second.Count == 0) return result;

        var scored = new List<(string a, string b, double s)>();
        foreach (var a in first)
            foreach (var b in second)
                scored.Add((a.Character, b.Character,
                    ComboBaseScore(a, g) + ComboBaseScore(b, g)
                        + OhaengHarmony(a.FiveElement, b.FiveElement)));

        return scored.OrderByDescending(x => x.s).Take(k).Select(x => (x.a, x.b)).ToList();
    }

    private static List<HanjaInfo> TopComboCandidates(string syllable, GenderPreference g, int n)
    {
        var cands = HanjaData.FindByReading(syllable)
            .Where(h => !HanjaData.IsForbiddenNameHanja(h.Character)
                     && !string.IsNullOrEmpty(h.Meaning)
                     && h.StrokeCount > 0)
            .ToList();
        var common = cands.Where(h => HanjaData.IsCommonNameHanja(h.Character)).ToList();
        var pool = common.Count > 0 ? common : cands;
        return pool.OrderByDescending(h => ComboBaseScore(h, g)).Take(n).ToList();
    }

    private static double ComboBaseScore(HanjaInfo h, GenderPreference g)
    {
        double s = HanjaData.CalculateRelevanceScore(h);
        // 약한 한자 감점은 Core_v1 가점(+2000)까지 지배해야 함 — 코어셋은 오행 '검수' 커버리지라
        // 불용·약자도 포함되며, 그 신뢰도 점수가 조합 품질 경쟁을 이기면 안 됨 (革=가죽이 赫을 이기던 버그).
        if (IsWeakGivenNameHanja(h.Character)) s -= 3000;
        if (g != GenderPreference.Neutral && h.GenderPref != GenderPreference.Neutral)
            s += h.GenderPref == g ? 40 : -400;                     // 반대 성별 한자 강한 회피
        return s;
    }

    /// <summary>
    /// 두 오행 관계의 '약한' 우선 점수: 상생 +20 / 비화(같음) +8 / 상극 -12.
    /// 의도적으로 작게 — 조합 선택은 한자 품질(관련도)이 지배하고, 오행은 품질이 비슷한
    /// 조합들 사이의 미세 우선일 뿐이다(상생만 남기고 거르지 않음). 실제 오행 관계는
    /// 프론트가 표시 정보로 다시 계산해 보여준다.
    /// </summary>
    private static double OhaengHarmony(string e1, string e2)
    {
        if (string.IsNullOrEmpty(e1) || string.IsNullOrEmpty(e2)) return 0;
        if (ElementGenerates.GetValueOrDefault(e1) == e2 || ElementGenerates.GetValueOrDefault(e2) == e1)
            return 20;
        if (e1 == e2) return 8;
        return -12; // 5행에서 상생·비화가 아니면 상극
    }

    /// <summary>이름 각 음절에 한자 1개씩 선택. yongshin* 인자가 null이면 용신 가산 없이 동작.</summary>
    public static List<HanjaInfo?> Select(
        string name, string gender,
        string? yongshinPrimary, string? yongshinHee, string? yongshinGi)
    {
        var genderPref = ParseGender(gender);
        var result = new List<HanjaInfo?>();
        if (string.IsNullOrEmpty(name)) return result;

        foreach (char c in name)
            result.Add(SelectForSyllable(c.ToString(), genderPref, yongshinPrimary, yongshinHee, yongshinGi));

        return result;
    }

    private static HanjaInfo? SelectForSyllable(
        string syllable, GenderPreference genderPref,
        string? yPrimary, string? yHee, string? yGi)
    {
        var all = HanjaData.FindByReading(syllable)
            .Where(h => !HanjaData.IsForbiddenNameHanja(h.Character))
            .ToList();
        if (all.Count == 0) return null;

        // 뜻이 있는 인명 후보 우선. 전혀 없으면 뜻 없는 것이라도(획수 자원오행은 살아 있음).
        var withMeaning = all.Where(h => !string.IsNullOrEmpty(h.Meaning)).ToList();
        var cands = withMeaning.Count > 0 ? withMeaning : all;

        var common = cands.Where(h => HanjaData.IsCommonNameHanja(h.Character)).ToList();
        var pool = common.Count > 0 ? common : cands;

        return pool
            .OrderByDescending(h => ScoreHanja(h, genderPref, yPrimary, yHee, yGi))
            .ThenByDescending(HanjaData.CalculateRelevanceScore)
            .First();
    }

    private static double ScoreHanja(
        HanjaInfo h, GenderPreference genderPref,
        string? yPrimary, string? yHee, string? yGi)
    {
        double s = 0;

        // 성별 적합 = 거의 하드 제약. 여아에 남성 전형 한자(또는 그 반대)는 사실상 배제하고,
        // 용신은 그 '성별 적합 집합 안에서' 최적화한다(실제 작명 관행). gender=none이면 무효.
        if (genderPref != GenderPreference.Neutral && h.GenderPref != GenderPreference.Neutral)
        {
            if (h.GenderPref == genderPref) s += 40;
            else s -= 200;   // 반대 성별 한자 → 대안이 있으면 배제
        }

        var el = h.FiveElement;
        if (!string.IsNullOrEmpty(el))
        {
            // 용신을 '주된' 선택 기준으로 강하게 — 한자 배정 층이라 강해도 이름 랭킹은 안 흔듦.
            if (el == yPrimary) s += 100;
            else if (el == yHee) s += 55;
            else if (el == yGi) s -= 70;
            s += 4; // 오행 정보 보유 소가산 (정보 없는 한자보다 우선)
        }

        // 이름용으로 약한 한자(友 벗·雨 비·菜 나물 등)는 감점 — 더 나은 동음 대안이 있으면 양보.
        if (HanjaData.IsWeakGivenNameHanja(h.Character)) s -= 30;

        return s;
    }

    private static GenderPreference ParseGender(string? gender) => gender?.ToLowerInvariant() switch
    {
        "male" => GenderPreference.Male,
        "female" => GenderPreference.Female,
        _ => GenderPreference.Neutral
    };
}
