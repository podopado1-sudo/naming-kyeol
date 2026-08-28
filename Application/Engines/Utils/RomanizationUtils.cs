using System.Text;

namespace NameForm.Application.Engines.Utils;

/// <summary>
/// 상호 작명용 표기 변환 유틸.
///
///  - <see cref="ToHangul"/>: 라틴 철자 조어 → 한글 음차 ("lumia" → "루미아")
///  - <see cref="ToRoman"/>: 한글 → 로마자 표기 ("온담" → "Ondam")
///
/// ToHangul은 영어가 아니라 라틴/이탈리아 계열 철자만 다룬다.
/// CompanyNamingData의 어근이 a e i o u + 안전한 자음만 쓰도록 큐레이션돼 있어
/// 일반 영어 철자법(묵음 e, ough 등)을 처리할 필요가 없다.
/// </summary>
public static class RomanizationUtils
{
    private const int BaseCode = 0xAC00;

    private static readonly string[] Initials =
        { "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ" };

    private static readonly string[] Vowels =
        { "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ" };

    private static readonly string[] Finals =
        { "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ" };

    // ============================================================
    // 라틴 → 한글
    // ============================================================

    private static readonly Dictionary<char, string> LatinVowel = new()
    {
        ['a'] = "ㅏ", ['e'] = "ㅔ", ['i'] = "ㅣ", ['o'] = "ㅗ", ['u'] = "ㅜ",
    };

    private static readonly Dictionary<char, string> LatinConsonant = new()
    {
        ['b'] = "ㅂ", ['c'] = "ㅋ", ['d'] = "ㄷ", ['f'] = "ㅍ", ['g'] = "ㄱ",
        ['h'] = "ㅎ", ['j'] = "ㅈ", ['l'] = "ㄹ", ['m'] = "ㅁ", ['n'] = "ㄴ",
        ['p'] = "ㅍ", ['r'] = "ㄹ", ['s'] = "ㅅ", ['t'] = "ㅌ", ['v'] = "ㅂ",
        ['z'] = "ㅈ",
    };

    /// <summary>받침으로 내려앉을 수 있는 자음 (그 외는 '으' 음절로 풀어쓴다)</summary>
    private static readonly Dictionary<char, string> LatinFinal = new()
    {
        ['n'] = "ㄴ", ['m'] = "ㅁ", ['l'] = "ㄹ",
    };

    private static bool IsLatinVowel(char c) => LatinVowel.ContainsKey(c);

    /// <summary>
    /// 라틴 철자를 한글로 음차한다.
    /// 예) lumia → 루미아 / clara → 클라라 / silva → 실바 / opus → 오푸스
    /// </summary>
    public static string ToHangul(string latin)
    {
        if (string.IsNullOrWhiteSpace(latin)) return string.Empty;

        var s = latin.Trim().ToLowerInvariant();
        var syllables = new List<(string init, string vowel, string final)>();
        string? pending = null; // 아직 모음을 못 만난 초성

        int i = 0;
        while (i < s.Length)
        {
            char ch = s[i];

            // --- 모음 ---
            if (IsLatinVowel(ch))
            {
                var init = pending ?? "ㅇ";
                pending = null;
                var vowel = LatinVowel[ch];
                var final = "";

                // 다음 자음이 어말이거나 자음 앞이면 받침으로 내려앉는다 (n, m, l)
                if (i + 1 < s.Length && !IsLatinVowel(s[i + 1]))
                {
                    char c1 = s[i + 1];
                    char after = i + 2 < s.Length ? s[i + 2] : '\0';
                    bool endOrBeforeConsonant = after == '\0' || !IsLatinVowel(after);

                    if (endOrBeforeConsonant && LatinFinal.TryGetValue(c1, out var f))
                    {
                        // n + g/k 는 'ㅇ' 받침으로 (longa → 롱가)
                        final = c1 == 'n' && (after == 'g' || after == 'k') ? "ㅇ" : f;
                        i++; // 받침으로 소비
                    }
                }

                syllables.Add((init, vowel, final));
                i++;
                continue;
            }

            // --- 자음 ---

            // 이중자: ph/th/ch 는 한 소리
            if (i + 1 < s.Length && s[i + 1] == 'h' && (ch == 'p' || ch == 't' || ch == 'c'))
            {
                var digraph = ch switch { 'p' => "ㅍ", 't' => "ㅌ", _ => "ㅋ" };
                if (pending != null)
                {
                    syllables.Add((pending, "ㅡ", ""));
                }
                pending = digraph;
                i += 2;
                continue;
            }

            if (!LatinConsonant.TryGetValue(ch, out var cons))
            {
                i++; // 취급하지 않는 문자는 건너뛴다
                continue;
            }

            // c 는 e/i 앞에서 'ㅊ' (luce → 루체, dolce → 돌체)
            if (ch == 'c' && i + 1 < s.Length && (s[i + 1] == 'e' || s[i + 1] == 'i'))
                cons = "ㅊ";

            if (pending != null)
            {
                // 자음 + l + 모음 → 앞 자음이 'ㅡ + ㄹ받침' 이 되고 l 이 다음 초성으로 이어진다
                // (clara → 클라라, plena → 플레나)
                if (ch == 'l' && i + 1 < s.Length && IsLatinVowel(s[i + 1]))
                {
                    syllables.Add((pending, "ㅡ", "ㄹ"));
                    pending = "ㄹ";
                    i++;
                    continue;
                }

                // 그 밖의 자음 연속은 앞 자음을 '으' 음절로 풀어쓴다 (prima → 프리마)
                syllables.Add((pending, "ㅡ", ""));
                pending = null;
                continue; // 현재 자음을 다시 처리
            }

            // 모음 사이의 l 은 앞 음절 받침 + 다음 초성으로 겹친다 (sole → 솔레)
            if (ch == 'l' && syllables.Count > 0 && syllables[^1].final == ""
                && i + 1 < s.Length && IsLatinVowel(s[i + 1]))
            {
                var last = syllables[^1];
                syllables[^1] = (last.init, last.vowel, "ㄹ");
                pending = "ㄹ";
                i++;
                continue;
            }

            // 같은 자음이 겹치면 (n/m/l 이 아닌 경우) 하나로 줄인다 (terra → 테라)
            if (i + 1 < s.Length && s[i + 1] == ch && !LatinFinal.ContainsKey(ch))
            {
                i++;
            }

            pending = cons;
            i++;
        }

        if (pending != null)
            syllables.Add((pending, "ㅡ", ""));

        var sb = new StringBuilder();
        foreach (var (init, vowel, final) in syllables)
            sb.Append(Compose(init, vowel, final));
        return sb.ToString();
    }

    /// <summary>초성/중성/종성 자모를 한글 음절 하나로 합성</summary>
    private static char Compose(string initial, string vowel, string final)
    {
        int i = Array.IndexOf(Initials, initial);
        int v = Array.IndexOf(Vowels, vowel);
        int f = Array.IndexOf(Finals, final);
        if (i < 0 || v < 0) return '?';
        if (f < 0) f = 0;
        return (char)(BaseCode + (i * 21 + v) * 28 + f);
    }

    // ============================================================
    // 한글 → 로마자 (국어의 로마자 표기법 간이판)
    // ============================================================

    private static readonly Dictionary<string, string> RomanInitial = new()
    {
        ["ㄱ"] = "g", ["ㄲ"] = "kk", ["ㄴ"] = "n", ["ㄷ"] = "d", ["ㄸ"] = "tt",
        ["ㄹ"] = "r", ["ㅁ"] = "m", ["ㅂ"] = "b", ["ㅃ"] = "pp", ["ㅅ"] = "s",
        ["ㅆ"] = "ss", ["ㅇ"] = "", ["ㅈ"] = "j", ["ㅉ"] = "jj", ["ㅊ"] = "ch",
        ["ㅋ"] = "k", ["ㅌ"] = "t", ["ㅍ"] = "p", ["ㅎ"] = "h",
    };

    private static readonly Dictionary<string, string> RomanVowel = new()
    {
        ["ㅏ"] = "a", ["ㅐ"] = "ae", ["ㅑ"] = "ya", ["ㅒ"] = "yae", ["ㅓ"] = "eo",
        ["ㅔ"] = "e", ["ㅕ"] = "yeo", ["ㅖ"] = "ye", ["ㅗ"] = "o", ["ㅘ"] = "wa",
        ["ㅙ"] = "wae", ["ㅚ"] = "oe", ["ㅛ"] = "yo", ["ㅜ"] = "u", ["ㅝ"] = "wo",
        ["ㅞ"] = "we", ["ㅟ"] = "wi", ["ㅠ"] = "yu", ["ㅡ"] = "eu", ["ㅢ"] = "ui",
        ["ㅣ"] = "i",
    };

    private static readonly Dictionary<string, string> RomanFinal = new()
    {
        [""] = "", ["ㄱ"] = "k", ["ㄲ"] = "k", ["ㄳ"] = "k", ["ㄴ"] = "n",
        ["ㄵ"] = "n", ["ㄶ"] = "n", ["ㄷ"] = "t", ["ㄹ"] = "l", ["ㄺ"] = "k",
        ["ㄻ"] = "m", ["ㄼ"] = "l", ["ㄽ"] = "l", ["ㄾ"] = "l", ["ㄿ"] = "p",
        ["ㅀ"] = "l", ["ㅁ"] = "m", ["ㅂ"] = "p", ["ㅄ"] = "p", ["ㅅ"] = "t",
        ["ㅆ"] = "t", ["ㅇ"] = "ng", ["ㅈ"] = "t", ["ㅊ"] = "t", ["ㅋ"] = "k",
        ["ㅌ"] = "t", ["ㅍ"] = "p", ["ㅎ"] = "t",
    };

    /// <summary>
    /// 한글 상호를 로마자로 표기한다 (첫 글자 대문자).
    /// 음절 간 자음동화는 적용하지 않는다 — 상표·도메인 표기는 철자를 그대로 살리는
    /// 관행이 일반적이고, 원 한글을 되짚기도 쉽다.
    /// 예) 온담 → Ondam / 한결 → Hangyeol
    /// </summary>
    public static string ToRoman(string hangul)
    {
        if (string.IsNullOrWhiteSpace(hangul)) return string.Empty;

        var sb = new StringBuilder();
        foreach (var ch in hangul)
        {
            var (init, vowel, final) = KoreanUtils.Decompose(ch);
            if (string.IsNullOrEmpty(vowel))
            {
                // 한글이 아닌 문자는 그대로 (영문 조어에 섞인 경우)
                sb.Append(ch);
                continue;
            }
            sb.Append(RomanInitial.GetValueOrDefault(init, ""));
            sb.Append(RomanVowel.GetValueOrDefault(vowel, ""));
            sb.Append(RomanFinal.GetValueOrDefault(final, ""));
        }

        var result = sb.ToString();
        if (result.Length == 0) return result;
        return char.ToUpperInvariant(result[0]) + result[1..];
    }
}
