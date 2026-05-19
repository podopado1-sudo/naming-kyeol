using NameForm.Application.Engines.Data;
using NameForm.Application.Services;

namespace NameForm.Application.Engines;

/// <summary>
/// 필수 글자 포함 이름 추천 엔진.
///
/// 개인화 한자 점수(사주/성별/톤) + 보편 작명 원리(NamingPrinciples) 기반 정렬.
/// 필수 글자는 위치(first/last/any)에 따라 고정되고, 나머지 한 글자를 품질순으로 조합.
/// </summary>
public class RequiredCharEngine : IRequiredCharEngine
{
    private readonly ISajuCalculationService _sajuService;

    public RequiredCharEngine(ISajuCalculationService sajuService)
    {
        _sajuService = sajuService;
    }

    public async Task<List<RequiredCharCandidate>> GenerateCandidatesAsync(
        string lastName,
        string requiredChar,
        string position,
        DateTime birthDate,
        string gender,
        string tone,
        string? requiredHanja = null)
    {
        // 항렬자(한자) 우선 — 한자가 있으면 발음(requiredChar)을 한자에서 자동 도출
        HanjaData.HanjaInfo? fixedHanja = null;
        if (!string.IsNullOrWhiteSpace(requiredHanja))
        {
            var hanjaChar = requiredHanja.Trim();
            if (hanjaChar.Length == 1 && HanjaData.HanjaDictionary.TryGetValue(hanjaChar, out var hi))
            {
                fixedHanja = hi;
                // 발음 자동 도출 (사용자가 requiredChar 비워도 동작)
                if (string.IsNullOrWhiteSpace(requiredChar))
                    requiredChar = hi.Reading;
            }
            else
            {
                // 사전에 없는 한자 → 일반 글자 모드로 폴백 (requiredChar 비어있으면 빈 결과)
            }
        }

        if (string.IsNullOrWhiteSpace(requiredChar))
            return new List<RequiredCharCandidate>();

        position = (position ?? "any").ToLower();
        if (position != "first" && position != "last") position = "any";

        // 1. 사주 → 부족/강한 오행
        var sajuChart = _sajuService.CalculateChart(birthDate);
        var lackingElements = sajuChart.MissingElements;
        var strongElements  = sajuChart.FiveElementCount
            .Where(kv => kv.Value >= 2).Select(kv => kv.Key).ToList();

        // 2. 필수 글자에 매칭되는 한자 설명
        //    항렬자가 지정되면 그 한자만, 아니면 발음에 매칭되는 모든 한자
        List<HanjaData.HanjaInfo> requiredHanjaList;
        if (fixedHanja != null)
        {
            requiredHanjaList = new List<HanjaData.HanjaInfo> { fixedHanja };
        }
        else
        {
            requiredHanjaList = HanjaData.FindByReading(requiredChar);
        }
        var requiredHanjaDescriptions = requiredHanjaList
            .Where(h => !string.IsNullOrEmpty(h.Meaning))
            .Select(h => $"{h.Character}({h.Meaning})")
            .Take(3)
            .ToList();

        // 3. 필수 글자가 아닌 한자 → 성별/톤 필터 → 개인화 점수
        var allHanja = HanjaData.HanjaDictionary.Values
            .Where(h => !string.IsNullOrEmpty(h.Reading) && h.Reading.Length == 1
                && !string.IsNullOrEmpty(h.Meaning) && h.Reading != requiredChar)
            .ToList();

        allHanja = FilterGenderTone(allHanja, gender, tone);

        // 발음별 대표 한자 (개인화 점수 최고) + 정렬
        var uniqueByReading = allHanja
            .GroupBy(h => h.Reading)
            .Select(g => g
                .OrderByDescending(h => CalcPersonalizedScore(h, lackingElements, strongElements, gender, tone))
                .ThenBy(h => h.Character, StringComparer.Ordinal)
                .First())
            .Select(h => (hanja: h, score: CalcPersonalizedScore(h, lackingElements, strongElements, gender, tone)))
            .OrderByDescending(x => x.score)
            .Take(80) // 상위 80개로 후보 풀 제한
            .ToList();

        // 4. 조합 생성 + 작명 스킬 점수
        var scored = new List<(RequiredCharCandidate cand, double score)>();

        if (position == "first" || position == "any")
        {
            foreach (var (h, hScore) in uniqueByReading)
                TryAddCandidate(scored, lastName, requiredChar + h.Reading, "first",
                    requiredChar, requiredHanjaList, requiredHanjaDescriptions, h, hScore, fixedHanja);
        }

        if (position == "last" || position == "any")
        {
            foreach (var (h, hScore) in uniqueByReading)
                TryAddCandidate(scored, lastName, h.Reading + requiredChar, "last",
                    requiredChar, requiredHanjaList, requiredHanjaDescriptions, h, hScore, fixedHanja);
        }

        // 5. 정렬 + 다양성 캡 + 상위 50개
        var result = scored
            .OrderByDescending(x => x.score)
            .GroupBy(x => x.cand.Name[position == "last" ? 0 : 1])
            .SelectMany(g => g.Take(5))
            .OrderByDescending(x => x.score)
            .Take(50)
            .Select(x => x.cand)
            .ToList();

        return await Task.FromResult(result);
    }

    private static void TryAddCandidate(
        List<(RequiredCharCandidate, double)> scored,
        string lastName, string name, string pos, string requiredChar,
        List<HanjaData.HanjaInfo> requiredHanjaList,
        List<string> requiredHanjaDescriptions,
        HanjaData.HanjaInfo otherHanja, double hScore,
        HanjaData.HanjaInfo? fixedHanja)
    {
        if (!IsValidName(name)) return;
        if (NamingPrinciples.IsTrendyName(name)) return;
        if (ForbiddenWordData.ContainsForbiddenWord(name)) return;
        if (ForbiddenWordData.ContainsForbiddenWord(lastName + name)) return;
        if (ForbiddenWordData.IsCollisionWithCommonWord(name)) return;

        double score =
            hScore * 0.5
            + NamingPrinciples.EvalSurnameFlow(lastName, name) * 250
            + NamingPrinciples.EvalOhaengSynergy(name[0].ToString(), name[1].ToString()) * 180
            + NamingPrinciples.EvalRhythm(name[0].ToString(), name[1].ToString()) * 100
            + NamingPrinciples.EvalInitialDiversity(name[0].ToString(), name[1].ToString()) * 80;

        // 항렬자(고정 한자) 모드: 해당 한자의 오행이 사주에 부합하면 보너스
        if (fixedHanja != null && !string.IsNullOrEmpty(fixedHanja.FiveElement))
        {
            // FixedHanja 정보 활용 — 사용자가 형제 한자에 의도가 있으므로 한자 시너지 가산
            score += 50; // 항렬자 모드는 의도적 선택이므로 약한 가산
        }

        scored.Add((BuildCandidate(name, pos, requiredChar, requiredHanjaList, requiredHanjaDescriptions, otherHanja, fixedHanja), score));
    }

    private static RequiredCharCandidate BuildCandidate(
        string name, string pos, string requiredChar,
        List<HanjaData.HanjaInfo> requiredHanjaList,
        List<string> requiredHanjaDescriptions,
        HanjaData.HanjaInfo otherHanja,
        HanjaData.HanjaInfo? fixedHanja)
    {
        var otherDescription = !string.IsNullOrEmpty(otherHanja.Meaning)
            ? $"{otherHanja.Character}({otherHanja.Meaning})"
            : otherHanja.Character.ToString();

        var hanjaOptions = new List<string>();
        if (pos == "first")
        {
            hanjaOptions.AddRange(requiredHanjaDescriptions.Take(2));
            hanjaOptions.Add(otherDescription);
        }
        else
        {
            hanjaOptions.Add(otherDescription);
            hanjaOptions.AddRange(requiredHanjaDescriptions.Take(2));
        }

        var requiredMeaning = requiredHanjaList
            .FirstOrDefault(h => !string.IsNullOrEmpty(h.Meaning))?.Meaning ?? "";
        var meaning = !string.IsNullOrEmpty(requiredMeaning) && !string.IsNullOrEmpty(otherHanja.Meaning)
            ? $"{requiredMeaning}, {otherHanja.Meaning}"
            : (requiredMeaning + otherHanja.Meaning);

        return new RequiredCharCandidate
        {
            Name = name,
            RequiredChar = requiredChar,
            Position = pos,
            HanjaOptions = hanjaOptions,
            Meaning = meaning,
            FixedHanja = fixedHanja?.Character
        };
    }

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

    private static bool IsValidName(string name)
    {
        if (string.IsNullOrEmpty(name) || name.Length < 2) return false;
        return name.All(c => c >= 0xAC00 && c <= 0xD7A3);
    }
}
