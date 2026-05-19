using NameForm.Application.Engines.Data;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 가족의 서사 추출 유틸리티
/// 부모의 성함에서 의미, 음운, 세대적 특성을 분석하여 가족의 서사를 추출
/// </summary>
public static class FamilyNarrativeExtractor
{
    /// <summary>
    /// 함수 1: 의미 융합 서사 추출
    /// 부모 이름의 한자 의미를 분석하여 가족의 가치관, 철학, 정체성을 추출
    /// 예: 아버지 "지혜" + 어머니 "사랑" -> "지혜로운 사랑"의 서사 -> "지애", "혜인" 등
    /// </summary>
    public static FamilyNarrative ExtractMeaningFusionNarrative(
        string? fatherName, 
        string? motherName)
    {
        var narrative = new FamilyNarrative
        {
            Type = "의미융합",
            CoreValues = new List<string>(),
            SuggestedThemes = new List<string>(),
            NarrativeDescription = string.Empty
        };

        if (string.IsNullOrEmpty(fatherName) && string.IsNullOrEmpty(motherName))
        {
            return narrative;
        }

        var fatherMeanings = ExtractMeaningsFromName(fatherName);
        var motherMeanings = ExtractMeaningsFromName(motherName);

        // 가족의 핵심 가치관 추출
        var allMeanings = fatherMeanings.Concat(motherMeanings).Distinct().ToList();
        
        // 의미 카테고리 분석
        var natureThemes = allMeanings.Where(m => m.Category == "자연").Select(m => m.Meaning).ToList();
        var virtueThemes = allMeanings.Where(m => m.Category == "덕목").Select(m => m.Meaning).ToList();
        var conceptThemes = allMeanings.Where(m => m.Category == "개념").Select(m => m.Meaning).ToList();

        narrative.CoreValues.AddRange(virtueThemes.Take(3));
        narrative.CoreValues.AddRange(conceptThemes.Take(2));

        // 서사 구성
        if (virtueThemes.Any() && natureThemes.Any())
        {
            narrative.SuggestedThemes.Add($"{virtueThemes.First()}과 {natureThemes.First()}의 조화");
            narrative.NarrativeDescription = $"부모님의 '{virtueThemes.First()}' 정신과 '{natureThemes.First()}'의 아름다움이 조화를 이루는 이름";
        }
        else if (fatherMeanings.Any() && motherMeanings.Any())
        {
            var fatherTheme = fatherMeanings.First().Meaning;
            var motherTheme = motherMeanings.First().Meaning;
            narrative.SuggestedThemes.Add($"{fatherTheme}과 {motherTheme}의 결합");
            narrative.NarrativeDescription = $"아버지의 '{fatherTheme}'{KoreanUtils.GwaWa(fatherTheme)} 어머니의 '{motherTheme}'{KoreanUtils.IGa(motherTheme)} 만나 새로운 의미를 만들어내는 이름";
        }

        // 추천 한자 조합 생성
        narrative.RecommendedHanja = GenerateMeaningBasedCombinations(fatherMeanings, motherMeanings);

        return narrative;
    }

    /// <summary>
    /// 함수 2: 음운 유전 서사 추출
    /// 부모 이름의 음운 패턴(리듬, 초성, 모음)을 분석하여 가족의 음악적/리듬적 정체성 추출
    /// 예: 아버지 "민수" (ㅁ-ㅣㄴ, ㅅ-ㅜ) + 어머니 "지은" (ㅈ-ㅣ, ㅇ-ㅡㄴ) 
    /// -> 부드러운 리듬의 유전 -> "민지", "수은" 등
    /// </summary>
    public static FamilyNarrative ExtractPhoneticInheritanceNarrative(
        string? fatherName,
        string? motherName)
    {
        var narrative = new FamilyNarrative
        {
            Type = "음운유전",
            CoreValues = new List<string>(),
            SuggestedThemes = new List<string>(),
            NarrativeDescription = string.Empty
        };

        if (string.IsNullOrEmpty(fatherName) && string.IsNullOrEmpty(motherName))
        {
            return narrative;
        }

        // 음운 패턴 분석
        var fatherRhythm = AnalyzeRhythmPattern(fatherName);
        var motherRhythm = AnalyzeRhythmPattern(motherName);

        // 공통 음운 특성 추출
        var commonInitials = fatherRhythm.Initials.Intersect(motherRhythm.Initials).ToList();
        var commonVowels = fatherRhythm.Vowels.Intersect(motherRhythm.Vowels).ToList();
        var rhythmType = DetermineRhythmType(fatherRhythm, motherRhythm);

        narrative.CoreValues.Add(rhythmType);
        if (commonInitials.Any())
        {
            narrative.CoreValues.Add($"공통 초성: {string.Join(", ", commonInitials.Take(2))}");
        }
        if (commonVowels.Any())
        {
            narrative.CoreValues.Add($"공통 모음: {string.Join(", ", commonVowels.Take(2))}");
        }

        // 서사 구성
        narrative.SuggestedThemes.Add($"{rhythmType} 리듬의 계승");
        narrative.NarrativeDescription = $"부모님의 '{rhythmType}'한 음운 특성을 이어받은 이름";

        // 추천 음운 조합 생성
        narrative.RecommendedHanja = GeneratePhoneticBasedCombinations(fatherRhythm, motherRhythm);

        return narrative;
    }

    /// <summary>
    /// 함수 3: 세대 연결 서사 추출
    /// 부모 이름의 시대적 배경, 세대 특성, 문화적 맥락을 분석하여 세대 간 연결고리 추출
    /// 예: 아버지 "영수" (1960년대 인기) + 어머니 "미영" (1980년대 인기)
    /// -> 세대를 넘나드는 연결 -> "영미", "수영" 등
    /// </summary>
    public static FamilyNarrative ExtractGenerationalBridgeNarrative(
        string? fatherName,
        string? motherName,
        DateTime? fatherBirthYear = null,
        DateTime? motherBirthYear = null)
    {
        var narrative = new FamilyNarrative
        {
            Type = "세대연결",
            CoreValues = new List<string>(),
            SuggestedThemes = new List<string>(),
            NarrativeDescription = string.Empty
        };

        if (string.IsNullOrEmpty(fatherName) && string.IsNullOrEmpty(motherName))
        {
            return narrative;
        }

        // 세대 특성 분석
        var fatherGeneration = AnalyzeGeneration(fatherName, fatherBirthYear);
        var motherGeneration = AnalyzeGeneration(motherName, motherBirthYear);

        // 세대 간 연결고리 찾기
        var bridgeElements = FindGenerationalBridge(fatherGeneration, motherGeneration);

        narrative.CoreValues.AddRange(bridgeElements.Themes);
        narrative.SuggestedThemes.Add($"{fatherGeneration.Era}와 {motherGeneration.Era}의 연결");
        narrative.NarrativeDescription = $"아버지 세대({fatherGeneration.Era})와 어머니 세대({motherGeneration.Era})의 특성을 모두 담은 이름";

        // 추천 세대 조합 생성
        narrative.RecommendedHanja = GenerateGenerationalCombinations(
            fatherGeneration, motherGeneration, bridgeElements);

        return narrative;
    }

    #region Helper Methods

    private static List<MeaningInfo> ExtractMeaningsFromName(string? name)
    {
        var meanings = new List<MeaningInfo>();
        
        if (string.IsNullOrEmpty(name))
            return meanings;

        foreach (char c in name)
        {
            var hanjaList = HanjaData.FindByReading(c.ToString());
            foreach (var hanja in hanjaList)
            {
                if (!string.IsNullOrEmpty(hanja.Meaning))
                {
                    meanings.Add(new MeaningInfo
                    {
                        Character = hanja.Character,
                        Reading = hanja.Reading,
                        Meaning = hanja.Meaning,
                        Category = hanja.Category
                    });
                }
            }
        }

        return meanings;
    }

    private static RhythmPattern AnalyzeRhythmPattern(string? name)
    {
        var pattern = new RhythmPattern
        {
            Initials = new List<string>(),
            Vowels = new List<string>(),
            HasFinalConsonant = false
        };

        if (string.IsNullOrEmpty(name))
            return pattern;

        foreach (char c in name)
        {
            var (initial, vowel, final) = KoreanUtils.Decompose(c);
            pattern.Initials.Add(initial);
            pattern.Vowels.Add(vowel);
            if (!string.IsNullOrEmpty(final))
            {
                pattern.HasFinalConsonant = true;
            }
        }

        return pattern;
    }

    private static string DetermineRhythmType(RhythmPattern father, RhythmPattern mother)
    {
        // 부드러운 초성: ㅁ, ㄴ, ㅇ, ㄹ
        var softInitials = new[] { "ㅁ", "ㄴ", "ㅇ", "ㄹ" };
        var strongInitials = new[] { "ㄱ", "ㄷ", "ㅂ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ" };

        var fatherSoftCount = father.Initials.Count(i => softInitials.Contains(i));
        var motherSoftCount = mother.Initials.Count(i => softInitials.Contains(i));

        if (fatherSoftCount + motherSoftCount >= 3)
            return "부드러운";
        else if (fatherSoftCount + motherSoftCount <= 1)
            return "강한";
        else
            return "균형잡힌";
    }

    private static GenerationInfo AnalyzeGeneration(string? name, DateTime? birthYear)
    {
        var info = new GenerationInfo
        {
            Name = name ?? string.Empty,
            Era = "현대",
            Characteristics = new List<string>(),
            PopularHanja = new List<string>()
        };

        if (birthYear.HasValue)
        {
            var year = birthYear.Value.Year;
            if (year < 1970)
                info.Era = "전통적";
            else if (year < 1990)
                info.Era = "과도기";
            else
                info.Era = "현대적";
        }

        // 이름 패턴으로 세대 추정
        if (!string.IsNullOrEmpty(name))
        {
            var commonOldEndings = new[] { "길", "복", "남", "숙", "순", "자", "영", "옥" };
            var commonModernEndings = new[] { "준", "은", "유", "윤", "서", "하", "지", "연" };

            if (commonOldEndings.Any(e => name.EndsWith(e)))
            {
                info.Era = "전통적";
                info.Characteristics.Add("전통적 돌림자");
            }
            else if (commonModernEndings.Any(e => name.EndsWith(e)))
            {
                info.Era = "현대적";
                info.Characteristics.Add("현대적 트렌드");
            }
        }

        return info;
    }

    private static BridgeElements FindGenerationalBridge(GenerationInfo father, GenerationInfo mother)
    {
        var bridge = new BridgeElements
        {
            Themes = new List<string>(),
            CommonHanja = new List<string>()
        };

        // 공통 테마 찾기
        if (father.Characteristics.Any() && mother.Characteristics.Any())
        {
            bridge.Themes.Add("세대 간 조화");
        }

        // 이름에서 공통 한자 찾기
        if (!string.IsNullOrEmpty(father.Name) && !string.IsNullOrEmpty(mother.Name))
        {
            var fatherChars = father.Name.ToCharArray();
            var motherChars = mother.Name.ToCharArray();
            var common = fatherChars.Intersect(motherChars).Select(c => c.ToString()).ToList();
            bridge.CommonHanja.AddRange(common);
        }

        return bridge;
    }

    private static List<string> GenerateMeaningBasedCombinations(
        List<MeaningInfo> fatherMeanings, 
        List<MeaningInfo> motherMeanings)
    {
        var combinations = new List<string>();

        foreach (var f in fatherMeanings.Take(3))
        {
            foreach (var m in motherMeanings.Take(3))
            {
                // 의미가 조화로운 조합 생성
                if (IsHarmoniousMeaning(f, m))
                {
                    combinations.Add(f.Reading + m.Reading);
                }
            }
        }

        return combinations.Distinct().Take(10).ToList();
    }

    private static List<string> GeneratePhoneticBasedCombinations(
        RhythmPattern father, 
        RhythmPattern mother)
    {
        var combinations = new List<string>();

        // 부모의 초성과 모음을 조합
        foreach (var fInit in father.Initials.Take(2))
        {
            foreach (var mVowel in mother.Vowels.Take(2))
            {
                // 실제로는 초성+모음 조합이 유효한지 확인 필요
                // 여기서는 간단히 예시만 제공
            }
        }

        // 부모 이름의 첫 글자 조합
        if (father.Initials.Any() && mother.Initials.Any())
        {
            // 실제 구현에서는 한자 사전을 통해 유효한 조합만 생성
        }

        return combinations;
    }

    private static List<string> GenerateGenerationalCombinations(
        GenerationInfo father,
        GenerationInfo mother,
        BridgeElements bridge)
    {
        var combinations = new List<string>();

        // 공통 한자 활용
        foreach (var common in bridge.CommonHanja.Take(2))
        {
            // 공통 한자와 다른 한자 조합
            var hanjaList = HanjaData.HanjaDictionary.Values.Take(10);
            foreach (var h in hanjaList)
            {
                combinations.Add(common + h.Reading);
                combinations.Add(h.Reading + common);
            }
        }

        return combinations.Distinct().Take(10).ToList();
    }

    private static bool IsHarmoniousMeaning(MeaningInfo m1, MeaningInfo m2)
    {
        // 자연 + 자연, 덕목 + 덕목, 개념 + 개념 조합이 조화로움
        if (m1.Category == m2.Category)
            return true;

        // 자연 + 덕목 조합도 조화로움
        if ((m1.Category == "자연" && m2.Category == "덕목") ||
            (m1.Category == "덕목" && m2.Category == "자연"))
            return true;

        return false;
    }

    #endregion

    #region Data Classes

    public class FamilyNarrative
    {
        public string Type { get; set; } = string.Empty;
        public List<string> CoreValues { get; set; } = new();
        public List<string> SuggestedThemes { get; set; } = new();
        public string NarrativeDescription { get; set; } = string.Empty;
        public List<string> RecommendedHanja { get; set; } = new();
    }

    private class MeaningInfo
    {
        public string Character { get; set; } = string.Empty;
        public string Reading { get; set; } = string.Empty;
        public string Meaning { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
    }

    private class RhythmPattern
    {
        public List<string> Initials { get; set; } = new();
        public List<string> Vowels { get; set; } = new();
        public bool HasFinalConsonant { get; set; }
    }

    private class GenerationInfo
    {
        public string Name { get; set; } = string.Empty;
        public string Era { get; set; } = string.Empty;
        public List<string> Characteristics { get; set; } = new();
        public List<string> PopularHanja { get; set; } = new();
    }

    private class BridgeElements
    {
        public List<string> Themes { get; set; } = new();
        public List<string> CommonHanja { get; set; } = new();
    }

    #endregion
}
