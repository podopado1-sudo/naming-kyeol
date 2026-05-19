using System.Text.RegularExpressions;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 간단한 형태소 분석기
/// 한국어 이름에서 부정적 의미를 만드는 형태소 패턴 탐지
/// </summary>
public static class MorphemeAnalyzer
{
    // 동사/형용사 어미 패턴
    private static readonly string[] VerbEndings = { "하다", "지다", "되다", "나다", "이다", "있다", "없다" };
    private static readonly string[] AdjectiveEndings = { "다", "한", "할", "된", "인", "은", "는" };
    
    // 부정적 어근
    private static readonly HashSet<string> NegativeRoots = new()
    {
        "추", "허", "헐", "썩", "썰", "쓰", "쓸", "궂", "궤", "궐"
    };

    // 성씨+이름 첫글자 조합이 부정적 단어 어근을 형성하는 패턴
    // "허하나" → "허하" → "허하다" 연상, "박하나" → "박하" → "박하다" 연상
    private static readonly Dictionary<string, (string word, string meaning)> SurnameNameNegativePatterns = new()
    {
        // 성+이름 첫글자 → 부정적 단어 연상
        { "허하", ("허하다", "기운이 없고 빈약하다") },
        { "허약", ("허약하다", "몸이 약하다") },
        { "허접", ("허접하다", "질이 낮다") },
        { "허술", ("허술하다", "빈틈이 많다") },
        { "허전", ("허전하다", "공허하다") },
        { "박하", ("박하다", "인정이 없고 야박하다") },
        { "박약", ("박약하다", "힘이 약하다") },
        { "이상", ("이상하다", "정상적이지 않다") },
        { "이기", ("이기적", "자기밖에 모른다") },
        { "안돼", ("안되다", "부정적") },
        { "안됨", ("안되다", "부정적") },
        { "배고", ("배고프다", "배가 고프다") },
        { "배아", ("배아프다", "배가 아프다") },
        { "오해", ("오해하다", "잘못 이해하다") },
        { "유해", ("유해하다", "해롭다") },
        { "무능", ("무능하다", "능력이 없다") },
        { "무식", ("무식하다", "아는 것이 없다") },
        { "신경", ("신경질", "예민하다") },
        { "한심", ("한심하다", "어이없다") },
        { "구질", ("구질구질", "지저분하다") },
        { "구차", ("구차하다", "초라하다") },
        { "추하", ("추하다", "보기 싫다") },
        { "천하", ("천하다", "품위가 없다") },
        { "최악", ("최악", "가장 나쁘다") },
        { "장난", ("장난", "진지하지 않다") },
        { "강제", ("강제", "억지로") },
        { "공허", ("공허하다", "텅 비다") },
        { "고약", ("고약하다", "심술궂다") },
        { "고질", ("고질적", "오래된 나쁜 버릇") },
        { "남루", ("남루하다", "초라하다") },
        { "조잡", ("조잡하다", "정교하지 않다") },
        // 추가 패턴 - 성씨별 자주 발생하는 부정 조합
        { "유치", ("유치하다", "어리석고 수준이 낮다") },
        { "유약", ("유약하다", "의지가 약하다") },
        { "비참", ("비참하다", "슬프고 처참하다") },
        { "비겁", ("비겁하다", "용기가 없다") },
        { "비열", ("비열하다", "품성이 나쁘다") },
        { "못나", ("못나다", "못생기다") },
        { "못된", ("못되다", "성질이 나쁘다") },
        { "서먹", ("서먹하다", "어색하다") },
        { "서투", ("서투르다", "능숙하지 못하다") },
        { "성급", ("성급하다", "참을성이 없다") },
        { "성가", ("성가시다", "귀찮다") },
        { "심술", ("심술궂다", "성질이 고약하다") },
        { "심약", ("심약하다", "마음이 약하다") },
        { "정체", ("정체되다", "발전이 없다") },
        { "정신", ("정신없다", "정신이 없다") },
        { "배반", ("배반하다", "믿음을 저버리다") },
        { "배신", ("배신하다", "신의를 저버리다") },
        { "오만", ("오만하다", "건방지다") },
        { "오류", ("오류", "잘못됨") },
        { "나약", ("나약하다", "약하고 무력하다") },
        { "나태", ("나태하다", "게으르다") },
        { "강박", ("강박", "억지로 얽매이다") },
        { "강압", ("강압적", "힘으로 억누르다") },
        { "안일", ("안일하다", "편안함에 빠지다") },
        { "최하", ("최하위", "가장 낮다") },
        { "최저", ("최저", "가장 낮다") },
        { "하찮", ("하찮다", "보잘것없다") },
        { "하극", ("하극상", "아래가 위를 범하다") },
        { "임의", ("임의적", "제멋대로") },
        { "조급", ("조급하다", "서두르다") },
        { "전무", ("전무하다", "전혀 없다") },
        { "황당", ("황당하다", "어이없다") },
        { "민폐", ("민폐", "다른 사람에게 피해") },
        { "민망", ("민망하다", "창피하고 부끄럽다") },
        { "송구", ("송구하다", "미안하다") },
        { "손해", ("손해", "해를 입다") },
        { "권태", ("권태롭다", "지루하고 싫증나다") },
    };

    /// <summary>
    /// 전체 이름에서 동사/형용사 형태 탐지
    /// </summary>
    public static bool ContainsVerbOrAdjectiveForm(string fullName)
    {
        if (string.IsNullOrEmpty(fullName) || fullName.Length < 2)
            return false;

        // 동사 어미 체크
        foreach (var ending in VerbEndings)
        {
            if (fullName.Contains(ending))
            {
                // 앞부분이 부정적 어근인지 확인
                var beforeEnding = fullName.Replace(ending, "");
                if (NegativeRoots.Any(root => beforeEnding.Contains(root)))
                {
                    return true;
                }
            }
        }

        // 형용사 어미 체크
        foreach (var ending in AdjectiveEndings)
        {
            if (fullName.Contains(ending))
            {
                var beforeEnding = fullName.Replace(ending, "");
                if (NegativeRoots.Any(root => beforeEnding.Contains(root)))
                {
                    return true;
                }
            }
        }

        return false;
    }

    /// <summary>
    /// 형태소 패턴 매칭 (와일드카드 지원)
    /// </summary>
    public static bool MatchesMorphemePattern(string text, string pattern)
    {
        if (string.IsNullOrEmpty(pattern))
            return false;

        // 와일드카드 패턴을 정규식으로 변환
        var regexPattern = "^" + Regex.Escape(pattern)
            .Replace("\\*", ".*") + "$";

        return Regex.IsMatch(text, regexPattern);
    }

    /// <summary>
    /// 부정적 형태소 조합 탐지
    /// 예: "허해진" → "허" + "해" + "진" 형태로 분석
    /// </summary>
    public static bool ContainsNegativeMorphemeCombination(string fullName)
    {
        if (string.IsNullOrEmpty(fullName) || fullName.Length < 2)
            return false;

        // 부정적 어근이 포함되어 있고, 동사/형용사 형태를 만드는지 확인
        foreach (var root in NegativeRoots)
        {
            if (fullName.Contains(root))
            {
                // 부정적 어근 다음에 특정 패턴이 오는지 확인
                var rootIndex = fullName.IndexOf(root);
                if (rootIndex >= 0)
                {
                    var afterRoot = fullName.Substring(rootIndex + root.Length);
                    
                    // "해", "지", "되" 등이 오면 동사/형용사 형태로 의심
                    if (afterRoot.Length > 0 && 
                        (afterRoot.StartsWith("해") || 
                         afterRoot.StartsWith("지") || 
                         afterRoot.StartsWith("되") ||
                         afterRoot.StartsWith("한") ||
                         afterRoot.StartsWith("할")))
                    {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /// <summary>
    /// 전체 이름에서 부정적 의미를 만드는 패턴 탐지
    /// </summary>
    public static List<string> DetectNegativePatterns(string fullName)
    {
        var detectedPatterns = new List<string>();

        if (string.IsNullOrEmpty(fullName))
            return detectedPatterns;

        // 1. 동사/형용사 형태 체크
        if (ContainsVerbOrAdjectiveForm(fullName))
        {
            detectedPatterns.Add("동사/형용사_형태");
        }

        // 2. 부정적 형태소 조합 체크
        if (ContainsNegativeMorphemeCombination(fullName))
        {
            detectedPatterns.Add("부정적_형태소_조합");
        }

        // 3. 특정 부정적 패턴 체크
        var negativePatterns = new[]
        {
            ("허해", "허해지다와_연상"),
            ("추광", "추하다와_연상"),
            ("허추", "부정적_어감"),
            ("추해", "추하다와_연상")
        };

        foreach (var (pattern, description) in negativePatterns)
        {
            if (fullName.Contains(pattern))
            {
                detectedPatterns.Add(description);
            }
        }

        // 4. 성씨+이름 첫글자 부정적 단어 연상 체크
        // "허하나" → "허하" → "허하다" 연상
        // "박하나" → "박하" → "박하다" 연상
        foreach (var (combo, (word, meaning)) in SurnameNameNegativePatterns)
        {
            if (fullName.Length >= combo.Length && fullName.StartsWith(combo))
            {
                detectedPatterns.Add($"성명조합_부정연상:{word}");
            }
        }

        return detectedPatterns;
    }
}
