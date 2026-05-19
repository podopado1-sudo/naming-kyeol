using System.Text;
using NameForm.Application.Engines.Data;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 한글 처리 유틸리티
/// </summary>
public static class KoreanUtils
{
    private const int BaseCode = 0xAC00; // '가'
    private const int InitialBase = 0x1100; // 'ㄱ'
    private const int VowelBase = 0x1161; // 'ㅏ'
    private const int FinalBase = 0x11A7; // 'ㄱ' (받침)

    // 초성 리스트
    private static readonly string[] Initials = { "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ" };

    // 중성 리스트
    private static readonly string[] Vowels = { "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ" };

    // 종성 리스트 (받침)
    private static readonly string[] Finals = { "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ" };

    /// <summary>
    /// 한글 음절을 초성, 중성, 종성으로 분해
    /// </summary>
    public static (string initial, string vowel, string final) Decompose(char syllable)
    {
        if (syllable < BaseCode || syllable > BaseCode + 11171)
        {
            return ("", "", "");
        }

        int code = syllable - BaseCode;
        int initialIndex = code / (21 * 28);
        int vowelIndex = (code % (21 * 28)) / 28;
        int finalIndex = code % 28;

        return (
            Initials[initialIndex],
            Vowels[vowelIndex],
            finalIndex > 0 ? Finals[finalIndex] : ""
        );
    }

    /// <summary>
    /// 받침이 있는지 확인
    /// </summary>
    public static bool HasFinalConsonant(char syllable)
    {
        if (syllable < BaseCode || syllable > BaseCode + 11171)
        {
            return false;
        }

        int code = syllable - BaseCode;
        int finalIndex = code % 28;
        return finalIndex > 0;
    }

    /// <summary>
    /// 받침 개수 계산
    /// </summary>
    public static int CountFinalConsonants(string text)
    {
        return text.Count(HasFinalConsonant);
    }

    // ─── 한국어 조사 선택 (받침 유/무에 따른 자동 매핑) ──────────────────
    // 사용: $"{name}{Particle.Eun(name)} 좋은 이름" → "허는 좋은 이름" / "박은 좋은 이름"

    /// <summary>주어 조사: 받침있음→"은", 받침없음→"는".</summary>
    public static string EunNeun(string word)
        => HasBatchimLastChar(word) ? "은" : "는";

    /// <summary>주격 조사: 받침있음→"이", 받침없음→"가".</summary>
    public static string IGa(string word)
        => HasBatchimLastChar(word) ? "이" : "가";

    /// <summary>목적격 조사: 받침있음→"을", 받침없음→"를".</summary>
    public static string EulReul(string word)
        => HasBatchimLastChar(word) ? "을" : "를";

    /// <summary>접속 조사: 받침있음→"과", 받침없음→"와".</summary>
    public static string GwaWa(string word)
        => HasBatchimLastChar(word) ? "과" : "와";

    /// <summary>도구격 조사: 받침있음(ㄹ 제외)→"으로", 받침없음/ㄹ받침→"로".</summary>
    public static string EuroRo(string word)
    {
        if (string.IsNullOrEmpty(word)) return "로";
        char last = word[^1];
        if (last < BaseCode || last > BaseCode + 11171) return "로";
        int finalIndex = (last - BaseCode) % 28;
        if (finalIndex == 0) return "로";       // 받침 없음
        if (finalIndex == 8) return "로";       // ㄹ 받침
        return "으로";
    }

    private static bool HasBatchimLastChar(string word)
    {
        if (string.IsNullOrEmpty(word)) return false;
        return HasFinalConsonant(word[^1]);
    }

    /// <summary>
    /// 발음 난이도 평가 (받침이 적을수록 쉬움)
    /// </summary>
    public static int EvaluatePronunciationDifficulty(string name)
    {
        int finalCount = CountFinalConsonants(name);
        int syllableCount = name.Length;

        // 받침이 없으면 가점, 많으면 감점
        int score = 100;
        score -= finalCount * 10; // 받침 하나당 10점 감점
        score -= (syllableCount - 2) * 5; // 2음절 기준, 벗어나면 감점

        return Math.Max(0, Math.Min(100, score));
    }

    /// <summary>
    /// 자음-모음 전환 리듬 평가 (강화된 버전)
    /// </summary>
    public static int EvaluateRhythm(string name)
    {
        if (name.Length < 2) return 50;

        int score = 70;
        var syllables = name.ToCharArray();
        var patterns = NegativePatternLoader.Data;

        for (int i = 0; i < syllables.Length - 1; i++)
        {
            var (init1, _, final1) = Decompose(syllables[i]);
            var (init2, _, _) = Decompose(syllables[i + 1]);

            // 같은 자음 반복은 감점 (기존)
            if (init1 == init2 && init1 != "ㅇ")
            {
                score -= patterns.SameConsonantRepetitionPenalty;
            }

            // 강한 파열음 연속 체크
            if (patterns.StrongPlosives.Contains(init1) && patterns.StrongPlosives.Contains(init2))
            {
                score -= patterns.ConsecutiveStrongPlosivesPenalty;
            }

            // 자연스러운 전환은 가점
            if (final1 == "" && init2 != "ㅇ")
            {
                score += 5;
            }
        }

        return Math.Max(0, Math.Min(100, score));
    }

    /// <summary>
    /// 강한 파열음 연속 체크
    /// </summary>
    public static bool HasConsecutiveStrongPlosives(string name)
    {
        if (name.Length < 2) return false;
        
        var patterns = NegativePatternLoader.Data;
        var syllables = name.ToCharArray();

        for (int i = 0; i < syllables.Length - 1; i++)
        {
            var (init1, _, _) = Decompose(syllables[i]);
            var (init2, _, _) = Decompose(syllables[i + 1]);

            if (patterns.StrongPlosives.Contains(init1) && patterns.StrongPlosives.Contains(init2))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// 동일 자음 반복 체크
    /// </summary>
    public static bool HasSameConsonantRepetition(string name)
    {
        if (name.Length < 2) return false;
        
        var syllables = name.ToCharArray();

        for (int i = 0; i < syllables.Length - 1; i++)
        {
            var (init1, _, _) = Decompose(syllables[i]);
            var (init2, _, _) = Decompose(syllables[i + 1]);

            if (init1 == init2 && init1 != "ㅇ")
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// 한글을 한자로 변환 (간단한 매핑, 실제로는 더 정교한 로직 필요)
    /// </summary>
    public static string? ConvertToHanja(string koreanName)
    {
        // 실제로는 한자 사전을 통해 변환해야 함
        // 여기서는 간단한 예시만 제공
        var sb = new StringBuilder();
        foreach (char c in koreanName)
        {
            // 실제 구현 시 HanjaData에서 매핑 찾기
            sb.Append(c);
        }
        return sb.ToString();
    }

    // ── 음령오행 (音靈五行) ────────────────────────────────────────
    // 초성 기준 오행 분류 (성명학 전통 기준)
    // ㄱ,ㄲ,ㅋ       → 木
    // ㄴ,ㄷ,ㄸ,ㄹ,ㅌ → 火
    // ㅇ,ㅎ           → 土
    // ㅅ,ㅆ,ㅈ,ㅉ,ㅊ → 金
    // ㅁ,ㅂ,ㅃ,ㅍ    → 水
    private static readonly Dictionary<string, string> InitialToEumryeong = new()
    {
        ["ㄱ"] = "木", ["ㄲ"] = "木", ["ㅋ"] = "木",
        ["ㄴ"] = "火", ["ㄷ"] = "火", ["ㄸ"] = "火", ["ㄹ"] = "火", ["ㅌ"] = "火",
        ["ㅇ"] = "土", ["ㅎ"] = "土",
        ["ㅅ"] = "金", ["ㅆ"] = "金", ["ㅈ"] = "金", ["ㅉ"] = "金", ["ㅊ"] = "金",
        ["ㅁ"] = "水", ["ㅂ"] = "水", ["ㅃ"] = "水", ["ㅍ"] = "水",
    };

    /// <summary>
    /// 한 음절의 초성 기반 음령오행 반환. 한글이 아니면 null.
    /// </summary>
    public static string? GetEumryeongFiveElement(char syllable)
    {
        var (initial, _, _) = Decompose(syllable);
        if (string.IsNullOrEmpty(initial)) return null;
        return InitialToEumryeong.TryGetValue(initial, out var elem) ? elem : null;
    }

    /// <summary>
    /// 이름 전체의 음령오행 목록 반환 (음절 순서대로).
    /// </summary>
    public static List<string?> GetNameEumryeongFiveElements(string name)
        => name.Select(c => GetEumryeongFiveElement(c)).ToList();

    /// <summary>
    /// 이름에서 특정 오행과 일치하는 음령오행 음절이 있는지 확인.
    /// </summary>
    public static bool HasEumryeongMatch(string name, string fiveElement)
        => name.Any(c => GetEumryeongFiveElement(c) == fiveElement);

    /// <summary>
    /// 음절 길이 평가 (2음절이 이상적)
    /// </summary>
    public static int EvaluateLength(string name)
    {
        int length = name.Length;

        if (length == 2) return 100; // 2음절이 최적
        if (length == 1) return 40;  // 1음절은 너무 짧음
        if (length == 3) return 60;  // 3음절은 약간 길음
        return 30; // 4음절 이상은 감점
    }

    // ── 2026-04-21 옵션 C Phase 1-d: 음운 하드필터 + 특성 노출 ──────────
    // 설계 철학:
    //   (1) 하드필터: 현대 한국 이름에 존재하지 않는 조합을 생성 단계에서 배제
    //   (2) 특성 노출: 드물거나 눈에 띄는 조합은 점수 영향 없이 Explanation 정보로만 제공
    //   (3) 감점 없음 — 음운 위반으로 이름 점수를 낮추면 '특이한 좋은 이름'도 배제됨
    // 평가 범위: 성씨 포함 전체. 엔진 목적이 '성씨와 어울리는 이름 추천'이므로.

    /// <summary>
    /// 이름 전체에서 음운적으로 차단된(하드 필터에 걸리는) 조합이 있는지 판정.
    /// 현재 하드필터는 phonology-joint.json의 동일자음중복(박박/밥보/맛다)만 포함.
    /// </summary>
    /// <param name="fullName">성씨 포함 또는 이름만, 한글 문자열.</param>
    /// <returns>차단된 조합이 하나라도 있으면 true.</returns>
    public static bool IsPhonologicallyBlocked(string fullName)
    {
        if (string.IsNullOrEmpty(fullName) || fullName.Length < 2) return false;

        for (int i = 0; i < fullName.Length - 1; i++)
        {
            var (_, _, final1) = Decompose(fullName[i]);
            var (initial2, _, _) = Decompose(fullName[i + 1]);

            if (string.IsNullOrEmpty(final1) || string.IsNullOrEmpty(initial2)) continue;

            if (PhonologyJointLoader.IsJointBlocked(final1, initial2))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// 이름 전체의 음운 특성(설명)을 리스트로 반환. 점수 영향 없이 Explanation 용도.
    /// Joint 특성(받침+초성 조합) + Vowel 특성(모음 시퀀스) 모두 포함.
    /// </summary>
    /// <param name="fullName">성씨 포함 또는 이름만, 한글 문자열.</param>
    /// <returns>특성 노트 목록. 특성이 없으면 빈 리스트.</returns>
    public static List<PhonologyNote> DescribePhonology(string fullName)
    {
        var notes = new List<PhonologyNote>();
        if (string.IsNullOrEmpty(fullName)) return notes;

        // 1. Joint 특성 — 각 경계 검사
        if (fullName.Length >= 2)
        {
            for (int i = 0; i < fullName.Length - 1; i++)
            {
                var (_, _, final1) = Decompose(fullName[i]);
                var (initial2, _, _) = Decompose(fullName[i + 1]);

                if (string.IsNullOrEmpty(final1) || string.IsNullOrEmpty(initial2)) continue;

                var characteristic = PhonologyJointLoader.GetJointCharacteristic(final1, initial2);
                if (characteristic != null)
                {
                    notes.Add(new PhonologyNote
                    {
                        Id = characteristic.Id,
                        Name = characteristic.Name,
                        Message = characteristic.ExplanationHint,
                        Position = i
                    });
                }
            }
        }

        // 2. Vowel 특성 — 모음 시퀀스 추출 후 각 특성 trigger 검사
        var vowels = ExtractVowelSequence(fullName);
        if (vowels.Count >= 2)
        {
            foreach (var vc in PhonologyVowelLoader.Characteristics)
            {
                var hit = FindVowelTriggerHit(vowels, vc);
                if (hit != null)
                {
                    var message = vc.ExplanationHint.Replace("{vowel}", hit.Value.vowel);
                    notes.Add(new PhonologyNote
                    {
                        Id = vc.Id,
                        Name = vc.Name,
                        Message = message,
                        Position = hit.Value.position
                    });
                }
            }
        }

        return notes;
    }

    /// <summary>
    /// 이름의 각 음절 중성(모음)을 순서대로 추출.
    /// 한글이 아닌 문자는 건너뜀.
    /// </summary>
    private static List<string> ExtractVowelSequence(string name)
    {
        var vowels = new List<string>();
        foreach (var ch in name)
        {
            var (_, vowel, _) = Decompose(ch);
            if (!string.IsNullOrEmpty(vowel)) vowels.Add(vowel);
        }
        return vowels;
    }

    /// <summary>
    /// 모음 시퀀스에서 특정 특성의 트리거가 발동하는지 검사.
    /// 발동하면 (매칭된 모음, 시작 위치) 반환. 없으면 null.
    /// </summary>
    private static (string vowel, int position)? FindVowelTriggerHit(
        List<string> vowels, VowelCharacteristic vc)
    {
        int minLen = Math.Max(2, vc.TriggerMinLength);
        if (vowels.Count < minLen) return null;

        switch (vc.TriggerType)
        {
            case "same_vowel_streak":
                // 같은 모음이 minLen번 연속
                for (int i = 0; i <= vowels.Count - minLen; i++)
                {
                    var pivot = vowels[i];
                    bool allSame = true;
                    for (int j = 1; j < minLen; j++)
                    {
                        if (vowels[i + j] != pivot) { allSame = false; break; }
                    }
                    if (allSame) return (pivot, i);
                }
                return null;

            case "neutral_streak":
                // 중성 클래스(ㅣ) 모음이 minLen번 연속
                for (int i = 0; i <= vowels.Count - minLen; i++)
                {
                    bool allNeutral = true;
                    for (int j = 0; j < minLen; j++)
                    {
                        if (PhonologyVowelLoader.ClassifyVowel(vowels[i + j]) != VowelClass.Neutral)
                        {
                            allNeutral = false;
                            break;
                        }
                    }
                    if (allNeutral) return (vowels[i], i);
                }
                return null;

            default:
                return null;
        }
    }
}

/// <summary>
/// 음운 특성 노트 — 점수 영향 없음, UI 표시/Explanation 용도.
/// </summary>
public class PhonologyNote
{
    /// <summary>특성 ID (JSON의 id 필드).</summary>
    public string Id { get; set; } = "";

    /// <summary>특성 이름 (한국어 표시명).</summary>
    public string Name { get; set; } = "";

    /// <summary>사용자 노출 메시지 (explanationHint의 플레이스홀더 치환된 결과).</summary>
    public string Message { get; set; } = "";

    /// <summary>특성이 탐지된 시작 음절 위치 (0-based).</summary>
    public int Position { get; set; }
}
