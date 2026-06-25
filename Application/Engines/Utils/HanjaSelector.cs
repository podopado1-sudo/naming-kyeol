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
    /// 인명 빈출 셋에는 들어 있으나 '주어진 이름' 한자로는 약한 글자 — 관련도 점수는 높지만
    /// 字義가 평범한 사물/어색한 명사라 더 나은 동음 대안이 있으면 양보해야 한다.
    /// (예: 우 → 友(벗)·雨(비)보다 宇(집·우주)·祐(복)·佑(도울)이 이름다움)
    /// "관련도 높음 ≠ 좋은 이름 한자" 보정. 감점일 뿐이라 대안이 없으면 여전히 선택됨.
    /// 피드백으로 확장 가능.
    /// </summary>
    private static readonly HashSet<string> WeakGivenNameHanja = new()
    {
        "友", "雨", "二", "米", "株", "注", "牛", "主"
    };

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

        // 이름용으로 약한 빈출 한자(友 벗·雨 비 등)는 감점 — 더 나은 동음 대안이 있으면 양보.
        if (WeakGivenNameHanja.Contains(h.Character)) s -= 30;

        return s;
    }

    private static GenderPreference ParseGender(string? gender) => gender?.ToLowerInvariant() switch
    {
        "male" => GenderPreference.Male,
        "female" => GenderPreference.Female,
        _ => GenderPreference.Neutral
    };
}
