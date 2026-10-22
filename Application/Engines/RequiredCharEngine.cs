using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;

namespace NameForm.Application.Engines;

/// <summary>
/// 필수 글자 포함 이름 추천 엔진.
///
/// 개인화 한자 점수(사주/성별/톤) + 보편 작명 원리(NamingPrinciples) 기반 정렬.
/// 필수 글자는 위치(first/last/any)에 따라 고정되고, 나머지 한 글자를 품질순으로 조합.
/// 짝 글자 한자는 불용한자를 배제하고, 약한 한자는 동음 대안이 있으면 양보한다(HanjaSelector 관행).
/// </summary>
public class RequiredCharEngine : IRequiredCharEngine
{
    private readonly ISajuCalculationService _sajuService;

    /// <summary>
    /// 생활어와 정확히 겹치는 2음절 이름 — 이 엔진 전용 완전 일치 배제 목록.
    /// 필수 글자 + 아무 음절 조합은 일상 한자어를 그대로 만들어 낸다(실측: 도 → 도태·도용,
    /// 민 → 인민·빈민, 서 → 서자, 성 → 성기). 공용 ForbiddenWordData.NegativeHomophoneNames에 넣으면
    /// AestheticEngine 감점과 /name 점수 데이터까지 바뀌므로, 그 목록 보강(재생성·감사 동반) 전까지는
    /// 이 엔진 안에서만 거른다.
    /// 기준은 공용 목록과 같다 — 부정·놀림 연상은 실명이 있어도 거르고, 중립 낱말은 실명으로 흔히 쓰면
    /// 남긴다(우민 877명·주민 311명·시민 89명은 /name 수록 실명이라 유지 — 愚 같은 불용한자는 위 필터가 막는다).
    /// </summary>
    private static readonly HashSet<string> EverydayWordNames = new(StringComparer.Ordinal)
    {
        // 부정·비하·범죄·질병 연상
        "도태", "도용", "남용", "도난", "도피", "도박", "도주", "인민", "빈민", "난민", "천민",
        "서자", "서녀", "연민", "빈곤", "하인", "하녀", "환자", "범인", "인질", "자해", "강도", "경련",
        "종양", "기형", "기만", "자만", "방자", "경박", "하자", "주정", "주사", "백수", "학정", "혼수",
        // 신체·성·배설 연상
        "정자", "정사", "성기", "자위", "소변", "신장",
        // 장례 연상
        "수의", "빈소", "상복", "상주",
        // 일상 명사·사물 — 이름보다 낱말로 먼저 읽히고 실명으로 드묾
        "국민", "서민", "이민", "평민", "농민", "어민", "교민",
        "인도", "용도", "연도", "도덕", "도로", "도구", "지도", "온도", "속도", "포도", "도중",
        "서류", "서랍", "서명", "서약", "순서", "독서", "엽서", "서적",
        "우유", "수박", "분자", "이자", "오리", "채소", "수건", "한복", "요리", "숙제", "주소", "남자",
        "정치", "정보", "정리", "수학", "시장", "학원", "원인", "상황", "수준", "준비", "혜택",
        "기간", "동안",
        // BT-2 보강(2026-10-21 BE-F1) — 검토가 상위 50에서 찾은 생활 명사 중 data/name-gender-stats.json 실명 10명 미만만.
        // 상자 11명·진자 14명·수선 10명·유자 15명은 실명이 있어 넣지 않는다. 낱말을 빼면 다음 순위 낱말이 올라오므로
        // (아래 둘째 줄 묶음이 같은 조건에서 바로 다음에 올라온 것) 명사 사전 + 실명 수 대조로 바꾸는 구조 수정은 다음 과제.
        "국자", "한자", "원자", "철자", "빈자", "주자", "학자", "현자", "후자", "역자", "임자", "승자", "인자",
        "수면", "수요", "수조", "수장", "수세", "수반",
        "근린", "도기", "도리", "임도",
        "강자", "교자", "도자", "동자", "수중", "수유", "수태", "수시", "수제"
    };

    /// <summary>
    /// 친족 호칭·부정어 — 실명 수와 무관하게 거른다(형수는 실명 44명이지만 '형의 아내'로 먼저 읽힌다).
    /// 위 생활 명사 보강분은 '실명 10명 미만'이 넣는 기준이라, 수와 상관없이 거르는 이 목록과 섞지 않는다.
    /// 두음 적용형에도 같은 검사가 걸려 리복(→이복)·리기(→이기)·리명(→이명)도 함께 막힌다.
    /// </summary>
    private static readonly HashSet<string> KinshipOrNegativeWordNames = new(StringComparer.Ordinal)
    {
        // 친족 호칭
        "형수", "제수", "계수", "형부", "처형", "처제", "이모", "고모", "숙모", "숙부", "장모", "계모", "서모",
        "조모", "조부", "시모", "이복",
        // 부정·질병 연상 (囚番 수번·利己 이기·耳鳴 이명)
        "수번", "이기", "이명"
    };

    /// <summary>짝 글자 후보 풀 크기 — 발음별 대표 한자를 개인화 점수순으로 이만큼만 조합한다.</summary>
    private const int PartnerPoolSize = 80;

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
            // FindByCharacter — IME 가 낸 호환 한자(金 U+F90A 등)도 통합 한자 항목으로 찾는다(사전은 통합 쪽에 병합)
            if (hanjaChar.Length == 1 && HanjaData.FindByCharacter(hanjaChar) is { } hi)
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

        // 아래 비교가 모두 소문자 리터럴이라, "Male"/"Soft"처럼 대문자로 들어오면 성별·톤이 통째로 무시됐다
        // (실측: 같은 조건 Male/Neutral vs male/neutral 50개 중 43개만 겹침). 스마트 서비스와 같은 정규화.
        gender = (gender ?? "none").Trim().ToLowerInvariant();
        tone = (tone ?? "neutral").Trim().ToLowerInvariant();

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
            // 표시 정렬 단일 경로 — 불용한자·뜻 없는 글자 제외, 빈출(약자 제외) 우선.
            requiredHanjaList = HanjaSelector.OrderForDisplay(HanjaData.FindByReading(requiredChar)).ToList();
        }
        var requiredHanjaDescriptions = requiredHanjaList
            .Where(h => !string.IsNullOrEmpty(h.Meaning))
            .Select(h => $"{h.Character}({h.Meaning})")
            .Take(3)
            .ToList();

        // 3. 필수 글자가 아닌 한자 → 성별/톤 필터 → 개인화 점수
        //    불용한자(汚 더러울·弱 약할·罔 없을 등)는 짝 글자 후보에서 배제 — 생성 경로 공통 규칙.
        var allHanja = HanjaData.HanjaDictionary.Values
            .Where(h => !string.IsNullOrEmpty(h.Reading) && h.Reading.Length == 1
                && !string.IsNullOrEmpty(h.Meaning) && h.Reading != requiredChar
                && !HanjaData.IsForbiddenNameHanja(h.Character))
            .ToList();

        allHanja = FilterGenderTone(allHanja, gender, tone);

        // 발음별 대표 한자 (개인화 점수 최고) + 정렬
        //    약한 한자(嬪 아내·眼 눈 등)는 같은 발음에 대안이 있으면 양보 — 배제가 아니라 뒤로(발음 소실 없음).
        var rankedByReading = allHanja
            .GroupBy(h => h.Reading)
            .Select(g => g
                .OrderBy(h => HanjaData.IsWeakGivenNameHanja(h.Character) ? 1 : 0)
                .ThenByDescending(h => CalcPersonalizedScore(h, lackingElements, strongElements, gender, tone))
                .ThenBy(h => h.Character, StringComparer.Ordinal)
                .First())
            .Select(h => (hanja: h, score: CalcPersonalizedScore(h, lackingElements, strongElements, gender, tone)))
            .OrderByDescending(x => x.score)
            .ToList();

        // 짝 글자가 둘째 음절(필수 글자가 앞) — 상위 80개로 후보 풀 제한
        var trailingPool = rankedByReading.Take(PartnerPoolSize).ToList();
        // 짝 글자가 첫 음절(필수 글자가 뒤) — 두음 독음을 빼고, 위 풀의 최저 점수 이상만 (BuildLeadingPool)
        var leadingPool = BuildLeadingPool(rankedByReading);

        // 4. 조합 생성 + 작명 스킬 점수
        var scored = new List<(RequiredCharCandidate cand, double score)>();

        if (position == "first" || position == "any")
        {
            foreach (var (h, hScore) in trailingPool)
                TryAddCandidate(scored, lastName, requiredChar + h.Reading, "first",
                    requiredChar, requiredHanjaList, requiredHanjaDescriptions, h, hScore, fixedHanja);
        }

        if (position == "last" || position == "any")
        {
            foreach (var (h, hScore) in leadingPool)
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

    /// <summary>
    /// 짝 글자가 첫 음절(필수 글자가 뒤)일 때의 후보 풀 — 두음법칙에 걸리는 독음(룡·린·련·뇨·례 등)을 빼고,
    /// 둘째 음절 풀(점수 상위 80개)의 최저 점수 이상인 독음만 최대 80개.
    /// 한글 맞춤법은 단어 첫머리에 두음 표기(용·인·연·요·예)를 원칙으로 하는데, 이 풀이 원음을 그대로 써서
    /// '룡도'가 1위에 오르고 '련민'처럼 생활어 목록(연민)을 표기만 바꿔 빠져나갔다(2026-10 BT-1).
    /// NamePoolEngine·RareSurnameEngine과 같은 관행. 필수 글자 자체가 첫 음절이면 사용자가 고른 것이라 그대로 둔다.
    /// 점수 하한이 없으면 두음 독음이 빠진 자리를 81위 아래 독음이 채웠다(2026-10-21 BE-F1 — 실측 김·여·중립·2021-05-05:
    /// 하한 4230 아래 4225점 미·매·사·춘·추·항·신·섭). 80위와 동점인 독음은 같은 품질이라 받는다(80개 상한 안에서).
    /// 남궁·민·끝·여·부드러움의 섬민·뇌민·역민·견민(纖·蕾·繹·絹)은 4340점으로 상위 80 안(62~68위)이라 이 하한과 무관하다.
    /// </summary>
    public static List<(HanjaData.HanjaInfo hanja, double score)> BuildLeadingPool(
        IReadOnlyList<(HanjaData.HanjaInfo hanja, double score)> rankedByReading,
        int poolSize = PartnerPoolSize)
    {
        if (rankedByReading.Count == 0 || poolSize <= 0)
            return new List<(HanjaData.HanjaInfo hanja, double score)>();

        double floor = rankedByReading.Take(poolSize).Min(x => x.score);
        return rankedByReading
            .Where(x => x.score >= floor && !ViolatesInitialDueum(x.hanja.Reading[0]))
            .Take(poolSize)
            .ToList();
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
        if (IsExcludedName(lastName, name)) return;

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

    /// <summary>
    /// 금칙어·생활어로 거를 이름인가 — 원형과 두음 적용형 둘 다 본다.
    /// 필수 글자를 첫 음절에 고른 경우(리·류·련 등)는 그 표기를 살리되, '련민'은 '연민', '룡도'는 '용도'로 읽혀
    /// 원형 검사만으로는 생활어 목록을 빠져나가므로 두음 적용형에도 같은 검사를 건다.
    /// </summary>
    public static bool IsExcludedName(string lastName, string name)
    {
        if (string.IsNullOrEmpty(name)) return false;
        if (IsBlockedSpelling(lastName, name)) return true;
        var dueumName = $"{ApplyInitialDueum(name[0])}{name[1..]}";
        return dueumName != name && IsBlockedSpelling(lastName, dueumName);
    }

    /// <summary>금칙어·생활어 검사 — 원형과 두음 적용형 양쪽에 같은 규칙을 걸기 위해 묶었다.</summary>
    private static bool IsBlockedSpelling(string lastName, string name)
        => ForbiddenWordData.ContainsForbiddenWord(name)
           || ForbiddenWordData.ContainsForbiddenWord(lastName + name)
           || ForbiddenWordData.IsCollisionWithCommonWord(name)
           || ForbiddenWordData.IsNegativeHomophoneName(name) // 공용 목록은 읽기만 (수정 시 /name 점수 영향)
           || EverydayWordNames.Contains(name)
           || KinshipOrNegativeWordNames.Contains(name);

    // 두음법칙 판정 — 자모 규칙(초성 ㄹ, 또는 ㄴ + ㅣ·ㅑ·ㅕ·ㅛ·ㅠ·ㅖ). NamingPrinciples.DueumMap은
    // 린·려·료·뇨·녀·랑·락·란·람·뢰 등이 빠져 있어 쓰지 않는다. 음절 = 0xAC00 + (초성×21 + 중성)×28 + 종성.
    private const int InitialNieun = 2, InitialRieul = 5, InitialIeung = 11;
    private static readonly int[] IotizedVowels = { 2 /*ㅑ*/, 6 /*ㅕ*/, 7 /*ㅖ*/, 12 /*ㅛ*/, 17 /*ㅠ*/, 20 /*ㅣ*/ };

    /// <summary>이름 첫 음절로 쓰면 두음법칙에 걸리는 음절인가 (룡·린·라·뢰 / 녀·뇨·뉴·니·녜).</summary>
    public static bool ViolatesInitialDueum(char syllable)
    {
        if (syllable < 0xAC00 || syllable > 0xD7A3) return false;
        int code = syllable - 0xAC00;
        int initial = code / 588;
        int vowel = code % 588 / 28;
        return initial == InitialRieul
            || (initial == InitialNieun && Array.IndexOf(IotizedVowels, vowel) >= 0);
    }

    /// <summary>두음 적용형 첫 음절 — ㄹ/ㄴ + ㅣ계 모음 → ㅇ(룡→용·녀→여), 그 밖의 ㄹ → ㄴ(라→나·뢰→뇌). 걸리지 않으면 그대로.</summary>
    public static char ApplyInitialDueum(char syllable)
    {
        if (!ViolatesInitialDueum(syllable)) return syllable;
        int rest = (syllable - 0xAC00) % 588; // 중성·종성은 그대로
        int vowel = rest / 28;
        int initial = Array.IndexOf(IotizedVowels, vowel) >= 0 ? InitialIeung : InitialNieun;
        return (char)(0xAC00 + initial * 588 + rest);
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
