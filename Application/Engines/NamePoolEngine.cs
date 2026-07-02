using NameForm.Application.Engines.Data;
using NameForm.Application.Services;

namespace NameForm.Application.Engines;

/// <summary>
/// 한자 기반 이름 후보 생성 엔진.
///
/// 보편 작명 원리(NamingPrinciples)는 공통 모듈을 호출하고,
/// 한자 특화 로직(개인화 점수, 의미 카테고리 시너지)만 이 클래스에 남긴다.
/// </summary>
public class NamePoolEngine : INamePoolEngine
{
    private readonly ISajuCalculationService _sajuService;

    public NamePoolEngine(ISajuCalculationService sajuService)
    {
        _sajuService = sajuService;
    }

    public async Task<List<string>> GenerateCandidatesAsync(
        string lastName,
        DateTime birthDate,
        string gender,
        string tone,
        int nameLength = 2,
        IReadOnlyList<string>? preferredMeanings = null)
    {
        if (nameLength < 1 || nameLength > 3)
            throw new ArgumentException("nameLength는 1, 2, 3 중 하나여야 합니다.", nameof(nameLength));

        // 의미 키워드 정규화 — 빈/공백 제거, 소문자 통일
        var meaningKeywords = preferredMeanings?
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => m.Trim())
            .ToList() ?? new List<string>();

        // ── 1. 사주로 부족/강한 오행 파악 ───────────────────────────────
        var sajuChart = _sajuService.CalculateChart(birthDate);
        var lackingElements = sajuChart.MissingElements;
        var strongElements  = sajuChart.FiveElementCount
            .Where(kv => kv.Value >= 2).Select(kv => kv.Key).ToList();

        // ── 2. 전체 한자 → 성별/톤 필터 → 개인화 점수 산출 ─────────────
        var allHanja = HanjaData.HanjaDictionary.Values
            .Where(h => !string.IsNullOrEmpty(h.Reading) && h.Reading.Length == 1)
            .Where(h => !HanjaData.IsForbiddenNameHanja(h.Character))   // 불용한자(부정적 의미) 배제
            .ToList();

        if (gender == "male")
            allHanja = allHanja.Where(h => h.GenderPref != HanjaData.GenderPreference.Female).ToList();
        else if (gender == "female")
            allHanja = allHanja.Where(h => h.GenderPref != HanjaData.GenderPreference.Male).ToList();

        if (tone == "soft")
            allHanja = allHanja.Where(h => h.TonePref != HanjaData.TonePreference.Strong).ToList();
        else if (tone == "strong")
            allHanja = allHanja.Where(h => h.TonePref != HanjaData.TonePreference.Soft).ToList();

        // ── 3. 발음별 대표 한자 추출 (개인화 점수 최고인 것 1개/발음) ────
        // 의미 키워드 매칭은 대표 한자 선택과 점수 산출 모두에 반영
        var uniqueByReading = allHanja
            .GroupBy(h => h.Reading)
            .Select(g => g
                .OrderByDescending(h => CalcPersonalizedScore(h, lackingElements, strongElements, gender, tone, meaningKeywords))
                .ThenBy(h => h.Character, StringComparer.Ordinal)
                .First())
            .Select(h => (hanja: h, score: CalcPersonalizedScore(h, lackingElements, strongElements, gender, tone, meaningKeywords)))
            .OrderByDescending(x => x.score)
            .ToList();

        // 복성(남궁/선우 등)이면 1음절 이름도 포함
        if (SurnameData.IsTwoCharSurname(lastName))
        {
            var oneCharResult = uniqueByReading
                .Take(60)
                .Select(x => x.hanja.Reading)
                .Where(r => !ForbiddenWordData.ContainsForbiddenWord(r))
                .Take(30)
                .ToList();
            if (nameLength == 1)
                return await Task.FromResult(oneCharResult);
        }

        if (nameLength == 1)
        {
            return await Task.FromResult(
                uniqueByReading.Take(50).Select(x => x.hanja.Reading).ToList());
        }

        // ── 4. 조합 생성 + 조합 품질 점수 ──────────────────────────────
        var firstPool  = uniqueByReading.Take(45).ToList();
        var secondPool = uniqueByReading.Take(45).ToList();

        var combinations = new List<(string name, double score)>(2000);

        foreach (var (h1, s1) in firstPool)
        {
            // 두음법칙 위반 음절(룡/림/량 등)은 이름 첫음절로 쓸 수 없다
            // (같은 한자의 두음 적용 발음이 사전에 별도로 존재함 — 龍은 '용'으로)
            if (NamingPrinciples.RequiresDueum(h1.Reading)) continue;

            double surnameFlow = NamingPrinciples.EvalSurnameFlow(lastName, h1.Reading);

            foreach (var (h2, s2) in secondPool)
            {
                if (h1.Reading == h2.Reading) continue;

                var name = h1.Reading + h2.Reading;

                if (NamingPrinciples.IsTrendyName(name)) continue;
                if (ForbiddenWordData.ContainsForbiddenWord(name)) continue;
                if (ForbiddenWordData.IsCollisionWithCommonWord(name)) continue;
                if (ForbiddenWordData.IsNegativeHomophoneName(name)) continue;

                // 이름다움이 낮은 조합은 풀에서 제외 (음운만 매끄러운 비이름 차단)
                double nameLikeness = NamingPrinciples.EvalNameLikeness(h1.Reading, h2.Reading);
                if (nameLikeness < 0.5) continue;

                double pairScore =
                    (s1 + s2) * 0.5                                                            // 개인화 점수 평균
                    + nameLikeness * 350                                                       // 이름다움 (비이름 음절 조합 배제)
                    + NamingPrinciples.EvalGenderSyllableFit(h1.Reading, h2.Reading, gender) * 220 // 성별 어미 적합 (여아에 남성형 어미 회피)
                    + surnameFlow * 250                                                        // 성씨 연음 (보편)
                    + NamingPrinciples.EvalOhaengSynergy(h1.Reading, h2.Reading) * 180         // 음령오행 상생 (보편)
                    + EvalSemanticSynergy(h1, h2) * 120                                        // 의미 카테고리 시너지 (한자 특화)
                    + NamingPrinciples.EvalRhythm(h1.Reading, h2.Reading) * 100                // 받침 리듬 (보편)
                    + NamingPrinciples.EvalInitialDiversity(h1.Reading, h2.Reading) * 80       // 초성 다양성 (보편)
                    + NamingPrinciples.EvalAwkwardCombination(h1.Reading, h2.Reading) * 120    // 어색 자음 결합 회피
                    + NamingPrinciples.EvalConsonantEcho(h1.Reading, h2.Reading) * 60          // 받침 에코 감점
                    + NamingPrinciples.EvalForeignPhonotactics(name) * 80                      // 외래어 발음 회피
                    + NamingPrinciples.EvalSyllableLengthBalance(lastName, name) * 90          // 음절 길이 균형
                    + NamingPrinciples.EvalConsonantAssimilation(h1.Reading, h2.Reading) * 70  // 종성-초성 동화/경음화
                    + NamingPrinciples.EvalVowelMonotony(h1.Reading, h2.Reading) * 50;         // 모음 단조성 회피

                combinations.Add((name, pairScore));
            }
        }

        // ── 5. 다양성 캡 + 상위 100개 선발 ────────────────────────────
        // 점수순 정렬 → 첫글자당 최대 3개 → 둘째글자당 최대 3개 → 전체 상위 100개
        var result = combinations
            .OrderByDescending(x => x.score)
            .GroupBy(x => x.name[0])
            .SelectMany(g => g.Take(3))
            .GroupBy(x => x.name[1])
            .SelectMany(g => g.Take(3))
            .OrderByDescending(x => x.score)
            .Take(100)
            .Select(x => x.name)
            .ToList();

        if (nameLength == 3)
        {
            return await Task.FromResult(
                GenerateThreeCharCandidates(firstPool, secondPool, uniqueByReading));
        }

        return await Task.FromResult(result);
    }

    // ═══════════════════════════════════════════════════════════════
    // 개인화 한자 점수 (한자 특화 — HanjaInfo 메타데이터 필요)
    // ═══════════════════════════════════════════════════════════════

    private static double CalcPersonalizedScore(
        HanjaData.HanjaInfo h,
        List<string> lackingElements,
        List<string> strongElements,
        string gender,
        string tone,
        IReadOnlyList<string>? meaningKeywords = null)
    {
        double score = HanjaData.CalculateRelevanceScore(h);

        // 이름 뜻으로 약한 한자(평범한 사물·허사 훈)는 발음별 대표 선택에서 뒤로 —
        // HanjaSelector.ScoreHanja와 동일 강도(-30). 대안이 없으면 여전히 선택됨.
        if (HanjaData.IsWeakGivenNameHanja(h.Character)) score -= 30;

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

        // 의미 선호 키워드 매칭 가산 — Meaning / Category / CategoryTags 모두 검사
        // 매칭 1건당 +220, 다중 매칭은 누적 (최대 +500 캡)
        if (meaningKeywords is { Count: > 0 })
        {
            int matchCount = 0;
            foreach (var kw in meaningKeywords)
            {
                if (string.IsNullOrEmpty(kw)) continue;
                if (!string.IsNullOrEmpty(h.Meaning) && h.Meaning.Contains(kw)) { matchCount++; continue; }
                if (!string.IsNullOrEmpty(h.Category) && h.Category.Contains(kw)) { matchCount++; continue; }
                if (h.CategoryTags != null && h.CategoryTags.Any(t => t.Contains(kw))) { matchCount++; continue; }
            }
            if (matchCount > 0)
            {
                score += Math.Min(500, matchCount * 220);
            }
        }

        return score;
    }

    // ═══════════════════════════════════════════════════════════════
    // 의미 카테고리 시너지 (한자 특화 — HanjaInfo.Category 필요)
    // ═══════════════════════════════════════════════════════════════
    //
    // 서로 다른 카테고리 조합이 의미가 더 풍부.
    // 자연(海)+덕목(恩) > 덕목+덕목(善+德) > 기타+기타

    private static double EvalSemanticSynergy(HanjaData.HanjaInfo h1, HanjaData.HanjaInfo h2)
    {
        var c1 = h1.Category ?? "";
        var c2 = h2.Category ?? "";

        if (c1 == "기타" || c2 == "기타" || string.IsNullOrEmpty(c1) || string.IsNullOrEmpty(c2))
            return 0.30;

        if (c1 != c2) return 1.0;
        return c1 == "자연" ? 0.65 : 0.50;
    }

    // ═══════════════════════════════════════════════════════════════
    // 3글자 이름 생성
    // ═══════════════════════════════════════════════════════════════

    private static List<string> GenerateThreeCharCandidates(
        List<(HanjaData.HanjaInfo hanja, double score)> first,
        List<(HanjaData.HanjaInfo hanja, double score)> second,
        List<(HanjaData.HanjaInfo hanja, double score)> all)
    {
        var thirdPool = all.Take(25).ToList();
        var combinations = new List<(string name, double score)>();

        foreach (var (h1, s1) in first.Take(20))
        foreach (var (h2, s2) in second.Take(20))
        {
            if (h1.Reading == h2.Reading) continue;

            foreach (var (h3, s3) in thirdPool)
            {
                if (h3.Reading == h1.Reading || h3.Reading == h2.Reading) continue;

                var name = h1.Reading + h2.Reading + h3.Reading;
                if (ForbiddenWordData.ContainsForbiddenWord(name)) continue;

                double score = (s1 + s2 + s3) / 3.0
                    + NamingPrinciples.EvalOhaengSynergy(h1.Reading, h2.Reading) * 150
                    + EvalSemanticSynergy(h1, h3) * 100
                    + NamingPrinciples.EvalInitialDiversity(h1.Reading, h2.Reading) * 60;

                combinations.Add((name, score));
            }
        }

        return combinations
            .OrderByDescending(x => x.score)
            .GroupBy(x => x.name[0])
            .SelectMany(g => g.Take(3))
            .OrderByDescending(x => x.score)
            .Take(100)
            .Select(x => x.name)
            .ToList();
    }
}
