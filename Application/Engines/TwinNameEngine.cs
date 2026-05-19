using NameForm.Application.Engines.Data;
using NameForm.Application.Services;

namespace NameForm.Application.Engines;

/// <summary>
/// 쌍둥이/형제 이름 세트 생성 엔진.
///
/// 개인화 한자 점수(사주/성별/톤) + 보편 작명 원리(NamingPrinciples) 기반.
/// 패턴: 공유글자(첫/끝), 공유의미(카테고리), 공유톤(TonePref 실제 톤).
/// CoherenceScore는 세트 내 각 이름의 페어 작명 스킬 점수 평균 + 세트 일관성 보너스.
/// </summary>
public class TwinNameEngine : ITwinNameEngine
{
    private readonly ISajuCalculationService _sajuService;

    public TwinNameEngine(ISajuCalculationService sajuService)
    {
        _sajuService = sajuService;
    }

    public async Task<List<TwinNameSet>> GenerateTwinSetsAsync(
        string lastName,
        DateTime birthDate,
        string gender,
        string tone,
        int childCount,
        List<string>? existingSiblingNames)
    {
        childCount = Math.Clamp(childCount, 2, 3);

        // 1. 사주 → 부족/강한 오행
        var sajuChart = _sajuService.CalculateChart(birthDate);
        var lackingElements = sajuChart.MissingElements;
        var strongElements  = sajuChart.FiveElementCount
            .Where(kv => kv.Value >= 2).Select(kv => kv.Key).ToList();

        // 2. 성별/톤 필터 + 개인화 점수
        var allHanja = HanjaData.HanjaDictionary.Values
            .Where(h => !string.IsNullOrEmpty(h.Reading) && h.Reading.Length == 1
                && !string.IsNullOrEmpty(h.Meaning))
            .ToList();
        allHanja = FilterGenderTone(allHanja, gender, tone);

        var personalized = allHanja
            .Select(h => (hanja: h, score: CalcPersonalizedScore(h, lackingElements, strongElements, gender, tone)))
            .ToList();

        // 발음별 대표 한자(개인화 점수 최고)
        var uniqueByReading = personalized
            .GroupBy(x => x.hanja.Reading)
            .Select(g => g.OrderByDescending(x => x.score).First())
            .OrderByDescending(x => x.score)
            .ToList();

        var sets = new List<TwinNameSet>();
        sets.AddRange(GenerateSharedCharSets(lastName, uniqueByReading, personalized, childCount, existingSiblingNames));
        sets.AddRange(GenerateSharedMeaningSets(lastName, uniqueByReading, personalized, childCount, existingSiblingNames));
        sets.AddRange(GenerateSharedToneSets(lastName, uniqueByReading, personalized, childCount, existingSiblingNames));

        // 세트 정렬: CoherenceScore 내림차순
        return await Task.FromResult(sets.OrderByDescending(s => s.CoherenceScore).ToList());
    }

    // ═══════════════════════════════════════════════════════════════
    // 패턴 1 — 공유글자 (첫글자 또는 끝글자 공유)
    // ═══════════════════════════════════════════════════════════════

    private List<TwinNameSet> GenerateSharedCharSets(
        string lastName,
        List<(HanjaData.HanjaInfo hanja, double score)> uniqueByReading,
        List<(HanjaData.HanjaInfo hanja, double score)> personalized,
        int childCount,
        List<string>? existingSiblings)
    {
        var sets = new List<TwinNameSet>();
        var topReadings = uniqueByReading.Take(30).ToList();

        // 첫글자 공유: shared + X
        foreach (var (sharedHanja, _) in topReadings)
        {
            var sharedReading = sharedHanja.Reading;
            var candidates = new List<(string name, double score)>();

            foreach (var (h, hScore) in uniqueByReading.Take(60))
            {
                if (h.Reading == sharedReading) continue;
                var name = sharedReading + h.Reading;
                double score = ScoreName(lastName, name, hScore);
                if (score < 0) continue;
                candidates.Add((name, score));
            }

            var picked = PickTopValid(candidates, childCount, existingSiblings);
            if (picked.Count >= childCount)
            {
                sets.Add(BuildSet(picked.Take(childCount).ToList(),
                    "공유글자", $"'{sharedReading}' 첫글자를 공유하는 이름 세트"));
                if (sets.Count(s => s.Theme == "공유글자") >= 5) break;
            }
        }

        // 끝글자 공유: X + shared
        foreach (var (sharedHanja, _) in topReadings)
        {
            var sharedReading = sharedHanja.Reading;
            var candidates = new List<(string name, double score)>();

            foreach (var (h, hScore) in uniqueByReading.Take(60))
            {
                if (h.Reading == sharedReading) continue;
                var name = h.Reading + sharedReading;
                double score = ScoreName(lastName, name, hScore);
                if (score < 0) continue;
                candidates.Add((name, score));
            }

            var picked = PickTopValid(candidates, childCount, existingSiblings);
            if (picked.Count >= childCount)
            {
                sets.Add(BuildSet(picked.Take(childCount).ToList(),
                    "공유글자", $"'{sharedReading}' 끝글자를 공유하는 이름 세트"));
                if (sets.Count(s => s.Theme == "공유글자") >= 10) break;
            }
        }

        return sets;
    }

    // ═══════════════════════════════════════════════════════════════
    // 패턴 2 — 공유의미 (한자 카테고리 공유)
    // ═══════════════════════════════════════════════════════════════

    private List<TwinNameSet> GenerateSharedMeaningSets(
        string lastName,
        List<(HanjaData.HanjaInfo hanja, double score)> uniqueByReading,
        List<(HanjaData.HanjaInfo hanja, double score)> personalized,
        int childCount,
        List<string>? existingSiblings)
    {
        var sets = new List<TwinNameSet>();

        // CategoryMajor 기준 그룹핑 (개인화 점수 상위만)
        var topPool = uniqueByReading.Take(200).ToList();

        var groups = topPool
            .Where(x => !string.IsNullOrEmpty(x.hanja.CategoryMajor))
            .GroupBy(x => x.hanja.CategoryMajor)
            .Where(g => g.Count() >= childCount * 4)
            .ToList();

        foreach (var group in groups)
        {
            var category = group.Key;
            var inCategory = group.OrderByDescending(x => x.score).ToList();

            // 같은 카테고리 내 두 한자 조합
            var candidates = new List<(string name, double score)>();
            foreach (var (h1, s1) in inCategory.Take(20))
            {
                foreach (var (h2, _) in inCategory.Take(20))
                {
                    if (h1.Reading == h2.Reading) continue;
                    var name = h1.Reading + h2.Reading;
                    double score = ScoreName(lastName, name, s1);
                    if (score < 0) continue;
                    candidates.Add((name, score));
                }
            }

            var picked = PickTopValid(candidates, childCount, existingSiblings);
            if (picked.Count >= childCount)
            {
                sets.Add(BuildSet(picked.Take(childCount).ToList(),
                    "공유의미", $"'{category}' 의미를 공유하는 이름 세트"));
                if (sets.Count(s => s.Theme == "공유의미") >= 5) break;
            }
        }

        return sets;
    }

    // ═══════════════════════════════════════════════════════════════
    // 패턴 3 — 공유톤 (실제 TonePref 기반: Soft/Strong/Neutral)
    // ═══════════════════════════════════════════════════════════════

    private List<TwinNameSet> GenerateSharedToneSets(
        string lastName,
        List<(HanjaData.HanjaInfo hanja, double score)> uniqueByReading,
        List<(HanjaData.HanjaInfo hanja, double score)> personalized,
        int childCount,
        List<string>? existingSiblings)
    {
        var sets = new List<TwinNameSet>();

        // 진짜 TonePref 기준 그룹
        var tonePrefGroups = new[]
        {
            (Tone: HanjaData.TonePreference.Soft,   Label: "부드러운 톤(Soft)"),
            (Tone: HanjaData.TonePreference.Strong, Label: "강한 톤(Strong)"),
        };

        foreach (var (tonePref, label) in tonePrefGroups)
        {
            var inTone = uniqueByReading
                .Where(x => x.hanja.TonePref == tonePref)
                .Take(40)
                .ToList();
            if (inTone.Count < childCount * 2) continue;

            var candidates = new List<(string name, double score)>();
            foreach (var (h1, s1) in inTone)
            {
                foreach (var (h2, _) in inTone)
                {
                    if (h1.Reading == h2.Reading) continue;
                    var name = h1.Reading + h2.Reading;
                    double score = ScoreName(lastName, name, s1);
                    if (score < 0) continue;
                    candidates.Add((name, score));
                }
            }

            var picked = PickTopValid(candidates, childCount, existingSiblings);
            if (picked.Count >= childCount)
            {
                sets.Add(BuildSet(picked.Take(childCount).ToList(),
                    "공유톤", $"{label} 공유 — 같은 톤의 이름 세트"));
            }
        }

        return sets;
    }

    // ═══════════════════════════════════════════════════════════════
    // 점수 계산 & 세트 빌드
    // ═══════════════════════════════════════════════════════════════

    /// <summary>이름 1개의 페어 작명 스킬 점수 (음수면 부정 패널티 시 제외 의미).</summary>
    private static double ScoreName(string lastName, string name, double hScore)
    {
        if (name.Length < 2) return -1;
        if (NamingPrinciples.IsTrendyName(name)) return -1;
        if (ForbiddenWordData.ContainsForbiddenWord(name)) return -1;
        if (ForbiddenWordData.ContainsForbiddenWord(lastName + name)) return -1;
        if (ForbiddenWordData.IsCollisionWithCommonWord(name)) return -1;

        return hScore * 0.5
            + NamingPrinciples.EvalSurnameFlow(lastName, name) * 250
            + NamingPrinciples.EvalOhaengSynergy(name[0].ToString(), name[1].ToString()) * 180
            + NamingPrinciples.EvalRhythm(name[0].ToString(), name[1].ToString()) * 100
            + NamingPrinciples.EvalInitialDiversity(name[0].ToString(), name[1].ToString()) * 80;
    }

    /// <summary>중복/형제 회피 + 점수순 상위 후보 추출.</summary>
    private static List<(string name, double score)> PickTopValid(
        List<(string name, double score)> candidates,
        int childCount,
        List<string>? existingSiblings)
    {
        var picked = new List<(string, double)>();
        var seen = new HashSet<string>();
        foreach (var (name, score) in candidates.OrderByDescending(c => c.score))
        {
            if (seen.Contains(name)) continue;
            if (existingSiblings?.Contains(name) == true) continue;
            seen.Add(name);
            picked.Add((name, score));
            if (picked.Count >= childCount) break;
        }
        return picked;
    }

    /// <summary>
    /// 세트의 CoherenceScore = 페어 점수 평균을 0~100 정규화 + 세트 일관성 보너스.
    /// 일관성 보너스: 모든 이름이 비슷한 점수대일수록(편차 작을수록) 높음.
    /// </summary>
    private static TwinNameSet BuildSet(
        List<(string name, double score)> names,
        string theme,
        string description)
    {
        double avg = names.Average(n => n.score);

        // 정규화: 평균 페어 점수 약 1500~3500 범위 → 0~80
        int normalized = (int)Math.Round(Math.Clamp((avg - 1000) / 30.0, 0, 80));

        // 일관성 보너스: 표준편차가 작을수록 +0~20
        double mean = names.Average(n => n.score);
        double variance = names.Average(n => Math.Pow(n.score - mean, 2));
        double stddev = Math.Sqrt(variance);
        int consistencyBonus = (int)Math.Round(Math.Clamp(20 - stddev / 50.0, 0, 20));

        return new TwinNameSet
        {
            Theme = theme,
            ThemeDescription = description,
            Names = names.Select(n => n.name).ToList(),
            CoherenceScore = Math.Clamp(normalized + consistencyBonus, 0, 100)
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 개인화 한자 점수 & 필터 (NamePoolEngine과 동일 패턴)
    // ═══════════════════════════════════════════════════════════════

    private static double CalcPersonalizedScore(
        HanjaData.HanjaInfo h,
        List<string> lackingElements,
        List<string> strongElements,
        string gender, string tone)
    {
        double score = HanjaData.CalculateRelevanceScore(h);
        if (!string.IsNullOrEmpty(h.FiveElement))
        {
            if (lackingElements.Contains(h.FiveElement)) score += 350;
            else if (strongElements.Contains(h.FiveElement)) score -= 120;
        }
        if (gender == "male"   && h.GenderPref == HanjaData.GenderPreference.Male)   score += 160;
        if (gender == "female" && h.GenderPref == HanjaData.GenderPreference.Female) score += 160;
        if (tone == "soft"   && h.TonePref == HanjaData.TonePreference.Soft)   score += 110;
        if (tone == "strong" && h.TonePref == HanjaData.TonePreference.Strong) score += 110;
        if (tone == "soft"   && h.TonePref == HanjaData.TonePreference.Strong) score -= 80;
        if (tone == "strong" && h.TonePref == HanjaData.TonePreference.Soft)   score -= 80;
        return score;
    }

    private static List<HanjaData.HanjaInfo> FilterGenderTone(
        List<HanjaData.HanjaInfo> list, string gender, string tone)
    {
        if (gender == "male")
            list = list.Where(h => h.GenderPref != HanjaData.GenderPreference.Female).ToList();
        else if (gender == "female")
            list = list.Where(h => h.GenderPref != HanjaData.GenderPreference.Male).ToList();
        if (tone == "soft")
            list = list.Where(h => h.TonePref != HanjaData.TonePreference.Strong).ToList();
        else if (tone == "strong")
            list = list.Where(h => h.TonePref != HanjaData.TonePreference.Soft).ToList();
        return list;
    }
}
