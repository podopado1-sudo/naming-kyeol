using NameForm.Application.Engines.Data;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 한자 의미(meaning) 기반 GenderPref/TonePref 자동 분류기
/// 서버 시작 시 LoadExternalData() 후 실행되어 Neutral인 한자들을 분류
/// </summary>
public static class GenderToneClassifier
{
    // ===== 성별 키워드 — scripts/classify_gender_tone.py 의 한글 '유지' 목록(MALE_KEYWORDS_KO·FEMALE_KEYWORDS_KO)과 같은 배열 =====
    // 2026-10-27 성별 규칙 감사 결정(D2): 판정 규칙은 오프라인 분류기 하나다. 이 분류기는 data/hanja_unihan.json 에 genderPref 기록이 없는
    // 글자의 대체용으로만 돈다(AutoClassifyAll 의 genderDecided). 옛 배열은 부분 일치(trimmed.Contains)라 '용감할'·'예쁠'·'아름다울' 같은
    // 성별 없는 형용사와 독음('창성할 창'의 창)까지 셌고, unihan 이 Neutral 로 판정한 글자 260자를 다시 채웠다.
    // 영문 뜻·부수(女부)가 없는 자리라 오프라인 쪽의 영문 키워드·女부 한정 형용사 키워드·동음 가드(영문 기준)는 쓰지 않는다.
    // 두 목록이 같은지는 GenderToneClassifierTests.Keywords_SameAsOfflineClassifier 가 스크립트를 읽어 대조한다.
    private static readonly string[] FemaleKeywords =
    {
        // 꽃 (겹낱말 X꽃 — 불꽃 제외)
        "꽃", "난초", "연꽃", "매화", "모란", "국화", "장미", "봉선화",
        // 비단·향기
        "비단", "향기", "향기로울",
        // 여성 지칭 (겹낱말 X어머니·X누이)
        "아가씨", "여자", "여인", "계집", "처녀", "공주", "부인", "아내", "며느리", "왕비", "비빈",
        "할머니", "어머니", "시어머니", "홀어머니", "누이", "자매", "암컷",
        // 새
        "봉황", "나비", "제비",
        // 옥·구슬·보석 (겹낱말 옥X·X옥 — 감옥 제외). '산호'(珊·瑚)는 2026-10-26 보완: 옥·구슬 훈 글자(珠·玉·琳·瑛·璐 …)가 모두 Female 인데
        // 산호만 빠져 B1(인명용 목록 보강) 뒤 남자 이름 강산·태산·산하의 조합이 江珊·泰珊·珊河로 바뀌었다(江山·泰山·山河 탈락)
        "옥", "옥돌", "구슬", "보석", "비취", "진주", "산호",
    };

    private static readonly string[] MaleKeywords =
    {
        // 성별 명사·친족 (겹낱말 X아버지·X아비 — 허수아비 제외)
        "사나이", "사내", "남자", "남편", "장정", "아들", "아비", "지아비", "아버지", "할아버지", "시아버지", "홀아버지",
        "형", "아우", "수컷",
        // 임금 (겹낱말 X임금)
        "임금",
        // 무기·장수
        "장수", "장군", "무사", "군사", "기병", "전쟁", "싸울", "칼", "활", "창", "무기", "방패", "갑옷",
        "호걸", "준걸", "영웅", "호랑이", "용",
        // 성별 없는 형용사 중 쓰임 기준(같은 성별 출생 0.80 이상·20명 이상·지지 음절 2개 이상)을 통과한 것
        "굳셀",
    };

    /// <summary>성별 키워드(읽기 전용) — 오프라인 분류기 목록과의 대조 테스트용.</summary>
    public static IReadOnlyList<string> FemaleGenderKeywords => FemaleKeywords;
    public static IReadOnlyList<string> MaleGenderKeywords => MaleKeywords;

    // 낱말 경계 일치 — scripts/classify_gender_tone.py 의 KO_SUFFIXES·COMPOUND_TAIL·COMPOUND_HEAD 와 같은 값
    private static readonly string[] KoSuffixes = { "할", "한", "하다", "하게", "히", "스러울", "스러운", "스런", "스럽다", "의" };
    private static readonly Dictionary<string, HashSet<string>> CompoundTail = new()
    {
        { "임금", new() }, { "꽃", new() { "불꽃" } }, { "아버지", new() }, { "어머니", new() }, { "누이", new() },
        { "아비", new() { "허수아비" } }, { "옥", new() { "감옥" } }, { "구슬", new() },
    };
    private static readonly Dictionary<string, HashSet<string>> CompoundHead = new() { { "옥", new() }, { "구슬", new() } };
    private static readonly System.Text.RegularExpressions.Regex ReadingToken =
        new(@"^[가-힣](\([가-힣]\))?$", System.Text.RegularExpressions.RegexOptions.CultureInvariant);
    private static readonly System.Text.RegularExpressions.Regex ParenReading =
        new(@"\(([가-힣])\)", System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    // ===== Soft 키워드 =====
    private static readonly string[] SoftKeywords =
    {
        // 부드러움/온화
        "부드러울", "고울", "맑을", "순할", "유순", "온화", "온순",
        "편안할", "따뜻할", "고요할", "조용할", "잔잔", "포근",
        // 덕/인자
        "착할", "어질", "은혜", "인자", "자비", "겸손할", "공손할",
        "넉넉할", "너그러울",
        // 미/정서
        "예쁠", "아름다울", "아름다운", "향기로울", "그리울",
        // 자연(부드러운)
        "봄", "달", "이슬", "안개", "구름", "풀", "나비", "꽃",
        "바람", "노을",
    };

    // ===== Strong 키워드 =====
    private static readonly string[] StrongKeywords =
    {
        // 크기/세기
        "굳셀", "클", "큰", "넓을", "높을", "우뚝", "드셀", "강할",
        "세찰", "거셀",
        // 빛/밝음
        "빛날", "밝을", "환할", "찬란",
        // 속도/날카로움
        "빠를", "날랠", "날카로울", "사나울",
        // 힘/용기
        "힘쓸", "용감", "씩씩", "으뜸", "장수", "호걸", "용맹",
        // 자연(강한)
        "번개", "천둥", "바위", "쇠", "철", "불",
        "우레", "벼락",
        // 지배/권위
        "다스릴", "임금", "왕", "거느릴",
    };

    /// <summary>
    /// CategoryMinor 기반 힌트 (의미 키워드로 판별 안 될 때 fallback)
    /// </summary>
    private static readonly Dictionary<string, (HanjaData.GenderPreference Gender, HanjaData.TonePreference Tone)> CategoryMinorHints = new()
    {
        // 자연 - 꽃/식물
        { "FLOWER", (HanjaData.GenderPreference.Female, HanjaData.TonePreference.Soft) },
        { "PLANT", (HanjaData.GenderPreference.Neutral, HanjaData.TonePreference.Soft) },
        // 자연 - 지형
        { "TERRAIN", (HanjaData.GenderPreference.Neutral, HanjaData.TonePreference.Strong) },
        { "MOUNTAIN", (HanjaData.GenderPreference.Neutral, HanjaData.TonePreference.Strong) },
        // 자연 - 천체
        { "CELESTIAL", (HanjaData.GenderPreference.Neutral, HanjaData.TonePreference.Soft) },
        { "WEATHER", (HanjaData.GenderPreference.Neutral, HanjaData.TonePreference.Soft) },
        // 덕목
        { "WARRIOR", (HanjaData.GenderPreference.Male, HanjaData.TonePreference.Strong) },
        { "MILITARY", (HanjaData.GenderPreference.Male, HanjaData.TonePreference.Strong) },
        { "LEADERSHIP", (HanjaData.GenderPreference.Neutral, HanjaData.TonePreference.Strong) },
    };

    /// <summary>
    /// 의미 텍스트에서 GenderPreference 분류 — 쉼표 파트마다 목록별 1회 센 뒤 한쪽만 걸리면 그 성별(양쪽·없음이면 카테고리 힌트).
    /// 키워드는 훈 낱말 경계로만 센다(scripts/classify_gender_tone.py 와 같은 규칙): 독음 낱말(조각 끝 한 음절)은 보지 않고, 뜻에 주 독음
    /// (reading)의 훈 조각이 있으면 그 조각만 본다(없으면 전 조각). 낱말 = 키워드 또는 키워드 + 용언 어미·조사 '의', 겹낱말은 X꽃·X임금·
    /// X아버지·옥X 같은 몇 키워드에만.
    /// </summary>
    public static HanjaData.GenderPreference ClassifyGender(
        string? meaning, string? categoryMajor = null, string? categoryMinor = null, string? reading = null)
    {
        if (string.IsNullOrWhiteSpace(meaning))
        {
            return TryGenderFromCategory(categoryMinor);
        }

        int femaleHits = 0;
        int maleHits = 0;
        var mainReading = reading ?? "";
        bool mainOnly = HasMainReadingPart(meaning, mainReading); // 뜻 전체에 주 독음 조각이 있으면 파트 안에서도 그 조각만

        // 쉼표로 분리하여 각 의미 파트 검사
        var parts = meaning.Split(',', '，');
        foreach (var part in parts)
        {
            var hun = HunWords(part.Trim(), mainReading, mainOnly);
            if (FemaleKeywords.Any(kw => hun.Any(w => KeywordWordMatch(kw, w))))
                femaleHits++; // 파트당 1회만
            if (MaleKeywords.Any(kw => hun.Any(w => KeywordWordMatch(kw, w))))
                maleHits++;
        }

        if (femaleHits > 0 && maleHits == 0) return HanjaData.GenderPreference.Female;
        if (maleHits > 0 && femaleHits == 0) return HanjaData.GenderPreference.Male;

        // 양쪽 다 매칭되거나 매칭 없으면 카테고리 힌트
        return TryGenderFromCategory(categoryMinor);
    }

    /// <summary>
    /// 의미 텍스트에서 TonePreference 분류
    /// </summary>
    public static HanjaData.TonePreference ClassifyTone(
        string? meaning, string? categoryMajor = null, string? categoryMinor = null)
    {
        if (string.IsNullOrWhiteSpace(meaning))
        {
            return TryToneFromCategory(categoryMinor);
        }

        int softHits = 0;
        int strongHits = 0;

        var parts = meaning.Split(',', '，');
        foreach (var part in parts)
        {
            var trimmed = part.Trim();
            foreach (var kw in SoftKeywords)
            {
                if (trimmed.Contains(kw))
                {
                    softHits++;
                    break;
                }
            }
            foreach (var kw in StrongKeywords)
            {
                if (trimmed.Contains(kw))
                {
                    strongHits++;
                    break;
                }
            }
        }

        if (softHits > 0 && strongHits == 0) return HanjaData.TonePreference.Soft;
        if (strongHits > 0 && softHits == 0) return HanjaData.TonePreference.Strong;

        return TryToneFromCategory(categoryMinor);
    }

    /// <summary>
    /// 전체 사전에 대해 자동 분류 실행.
    /// 이미 non-Neutral인 값은 건드리지 않음.
    /// 성별은 genderDecided(hanja_unihan.json 에 genderPref 기록이 있는 글자 — Neutral 포함)를 건너뛴다(2026-10-27 D2 — 오프라인 분류기가
    /// Neutral 로 판정한 글자를 여기서 다시 채우지 않는다). 톤은 옛 동작 그대로(Neutral 이면 분류).
    /// </summary>
    public static void AutoClassifyAll(Dictionary<string, HanjaData.HanjaInfo> dictionary, IReadOnlySet<string>? genderDecided = null)
    {
        foreach (var kvp in dictionary)
        {
            var info = kvp.Value;

            if (info.GenderPref == HanjaData.GenderPreference.Neutral && (genderDecided == null || !genderDecided.Contains(kvp.Key)))
            {
                var classified = ClassifyGender(info.Meaning, info.CategoryMajor, info.CategoryMinor, info.Reading);
                if (classified != HanjaData.GenderPreference.Neutral)
                {
                    info.GenderPref = classified;
                }
            }

            if (info.TonePref == HanjaData.TonePreference.Neutral)
            {
                var classified = ClassifyTone(info.Meaning, info.CategoryMajor, info.CategoryMinor);
                if (classified != HanjaData.TonePreference.Neutral)
                {
                    info.TonePref = classified;
                }
            }
        }
    }

    // ===== Private Helpers =====

    /// <summary>훈 낱말이 키워드인지 — 키워드 그 자체, 키워드 + 용언 어미·조사, 허용된 겹낱말(뜻이 굳은 낱말 제외).</summary>
    private static bool KeywordWordMatch(string kw, string word)
    {
        if (word == kw) return true;
        foreach (var suffix in KoSuffixes)
            if (word == kw + suffix) return true;
        if (word.Length > kw.Length)
        {
            if (CompoundTail.TryGetValue(kw, out var tailExcept) && word.EndsWith(kw, StringComparison.Ordinal) && !tailExcept.Contains(word)) return true;
            if (CompoundHead.TryGetValue(kw, out var headExcept) && word.StartsWith(kw, StringComparison.Ordinal) && !headExcept.Contains(word)) return true;
        }
        return false;
    }

    /// <summary>뜻 조각('/'·',' 구분)을 (독음들, 훈 낱말)로 — 끝 낱말이 한 음절(두음 괄호 허용)이 아니면 독음 없음(null).</summary>
    private static (HashSet<string>? Readings, string[] Hun) SplitSegment(string segment)
    {
        var toks = segment.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        if (toks.Length >= 2 && ReadingToken.IsMatch(toks[^1]))
        {
            var readings = new HashSet<string> { toks[^1].Split('(')[0] };
            foreach (System.Text.RegularExpressions.Match m in ParenReading.Matches(toks[^1])) readings.Add(m.Groups[1].Value);
            return (readings, toks[..^1]);
        }
        if (toks.Length == 1 && ReadingToken.IsMatch(toks[0])) return (null, Array.Empty<string>());
        return (null, toks);
    }

    private static IEnumerable<string> Segments(string text) => text.Split(',', '/', '，').Where(t => !string.IsNullOrWhiteSpace(t));

    /// <summary>뜻 전체에 주 독음의 훈 조각(또는 독음 없는 조각)이 있는지.</summary>
    private static bool HasMainReadingPart(string meaning, string mainReading)
        => Segments(meaning).Select(SplitSegment).Any(x => x.Readings == null || x.Readings.Contains(mainReading));

    /// <summary>파트의 훈 낱말 — mainOnly 면 주 독음 조각(독음 없는 조각 포함)만, 아니면 전 조각. 독음 낱말은 뺀다.</summary>
    private static List<string> HunWords(string part, string mainReading, bool mainOnly)
    {
        var words = new List<string>();
        foreach (var (readings, hun) in Segments(part).Select(SplitSegment))
        {
            if (mainOnly && readings != null && !readings.Contains(mainReading)) continue;
            words.AddRange(hun);
        }
        return words;
    }

    private static HanjaData.GenderPreference TryGenderFromCategory(string? categoryMinor)
    {
        if (!string.IsNullOrEmpty(categoryMinor) &&
            CategoryMinorHints.TryGetValue(categoryMinor, out var hint))
        {
            return hint.Gender;
        }
        return HanjaData.GenderPreference.Neutral;
    }

    private static HanjaData.TonePreference TryToneFromCategory(string? categoryMinor)
    {
        if (!string.IsNullOrEmpty(categoryMinor) &&
            CategoryMinorHints.TryGetValue(categoryMinor, out var hint))
        {
            return hint.Tone;
        }
        return HanjaData.TonePreference.Neutral;
    }
}
