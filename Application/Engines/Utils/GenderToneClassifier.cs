using NameForm.Application.Engines.Data;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 한자 의미(meaning) 기반 GenderPref/TonePref 자동 분류기
/// 서버 시작 시 LoadExternalData() 후 실행되어 Neutral인 한자들을 분류
/// </summary>
public static class GenderToneClassifier
{
    // ===== Female 키워드 =====
    private static readonly string[] FemaleKeywords =
    {
        // 외모/미모
        "아름다울", "아름다운", "예쁠", "고울", "곱을", "어여쁠", "빼어날",
        "자태", "요염", "얌전", "단정할",
        // 꽃/식물
        "꽃", "난초", "연꽃", "봉선화", "매화",
        // 보석/직물
        "비단", "옥", "옥돌", "비취", "진주", "구슬",
        // 향기
        "향기", "향기로울",
        // 여성 지칭
        "여자", "계집", "누이", "부인", "아가씨", "처녀", "어머니", "할머니",
        "며느리", "아내", "공주", "왕비", "비빈",
        // 부드러운 자연
        "나비", "봉황",
        // 정서
        "그리울", "사모할",
    };

    // ===== Male 키워드 =====
    private static readonly string[] MaleKeywords =
    {
        // 무/전투
        "장수", "장군", "무사", "군사", "기병", "전쟁", "싸울", "칼",
        "무기", "활", "방패", "갑옷", "창",
        // 남성적 특질
        "용감", "씩씩", "사나이", "사내", "수컷", "호걸", "준걸",
        "장정", "남자", "아들", "아비", "아버지", "할아버지",
        // 힘/강함
        "날랠", "굳셀", "씩씩할", "힘쓸", "용맹",
        // 영웅
        "영웅", "호랑이",
    };

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
    /// 의미 텍스트에서 GenderPreference 분류
    /// </summary>
    public static HanjaData.GenderPreference ClassifyGender(
        string? meaning, string? categoryMajor = null, string? categoryMinor = null)
    {
        if (string.IsNullOrWhiteSpace(meaning))
        {
            return TryGenderFromCategory(categoryMinor);
        }

        int femaleHits = 0;
        int maleHits = 0;

        // 쉼표로 분리하여 각 의미 파트 검사
        var parts = meaning.Split(',', '，');
        foreach (var part in parts)
        {
            var trimmed = part.Trim();
            foreach (var kw in FemaleKeywords)
            {
                if (trimmed.Contains(kw))
                {
                    femaleHits++;
                    break; // 파트당 1회만
                }
            }
            foreach (var kw in MaleKeywords)
            {
                if (trimmed.Contains(kw))
                {
                    maleHits++;
                    break;
                }
            }
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
    /// </summary>
    public static void AutoClassifyAll(Dictionary<string, HanjaData.HanjaInfo> dictionary)
    {
        foreach (var kvp in dictionary)
        {
            var info = kvp.Value;

            if (info.GenderPref == HanjaData.GenderPreference.Neutral)
            {
                var classified = ClassifyGender(info.Meaning, info.CategoryMajor, info.CategoryMinor);
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
