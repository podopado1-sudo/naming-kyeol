using System.Buffers;
using System.Text;
using NameForm.Application.Engines.Data;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Engines.Utils;

/// <summary>한자 입력이 받아들여지지 않은 까닭 — 컨트롤러가 400 본문(error·code·target·slot)으로 그대로 옮긴다.</summary>
/// <param name="Code"><see cref="HanjaInput"/> 의 Code* 상수</param>
/// <param name="Target">"name" 또는 "surname"</param>
/// <param name="Slot">문제가 난 칸(0부터). 칸 하나의 문제가 아니면(한글 검사·글자 수) -1</param>
/// <param name="Message">화면에 그대로 띄우는 한국어 문장</param>
public sealed record HanjaInputProblem(string Code, string Target, int Slot, string Message);

/// <summary>글자 한 자의 판정(<see cref="HanjaInput.Judge"/> — /hanja/resolve 가 쓴다).</summary>
/// <param name="Status">ok · reading_mismatch · not_in_dictionary · not_hanja</param>
/// <param name="Character">정리·정규화한 글자(통합 한자). 한자가 아니면 null</param>
/// <param name="Hanja">사전 항목(사전에 없으면 null)</param>
/// <param name="AcceptedSyllables">이 글자를 넣을 수 있는 음절(지정 독음과 그 두음 꼴)</param>
/// <param name="Message">ok 가 아닐 때의 안내 문장</param>
/// <param name="Suggestion">사전에 없는 글자에 권하는, 꼴만 다른 등재 글자(손 목록 — 없으면 null)</param>
public sealed record HanjaJudgement(
    string Status, string? Character, HanjaInfo? Hanja,
    IReadOnlyList<string> AcceptedSyllables, string? Message, HanjaInfo? Suggestion);

/// <summary>
/// 사용자가 넣은 한자 문자열의 정리·판정 — /evaluate 의 nameHanja·lastNameHanja, /hanja/resolve, 음절별 후보 목록이 같은 함수를 쓴다
/// (2026-11 한자 입력 — docs/plan-hanja-input-2026-11.md §5·§7-1). 정적·순수 함수만 둔다(사전 <see cref="HanjaData"/> 를 읽기만 한다).
///
/// 여기서만 하는 일과 그 까닭:
/// · 글자는 Rune 으로 센다 — 사전의 BMP 밖 글자는 UTF-16 길이가 2라 string.Length·char 인덱스로 세면 칸이 밀린다.
/// · 정규화(NFKC)는 범위를 정해 건다(호환 한자·강희 부수·부수 보충). 범위 없이 걸면 동그라미 문자 같은 기호까지 한자가 된다.
///   <see cref="HanjaData.ToUnifiedHanja"/> 는 사전 병합에도 쓰여 고치지 않는다.
/// · 독음 판정(<see cref="ReadsAs"/>)은 지정 독음 + 그 두음 꼴(한쪽 방향, 자리 무관)이다 — 규칙 별표 1 '주' 1 과 가족관계등록선례 제200909-2호.
///   <see cref="HanjaData.FindByReading"/> 만 쓰면 림 → 임, 류 → 유, 록 → 녹 같은 두음 꼴이 거절된다.
/// · 하드코딩 35자는 사전 파일의 독음이 합쳐지지 않아 Reading 하나만 남는다. 사전 파일과 독음이 다른 세 글자의 독음을 <see cref="ReadingSupplement"/> 로 보탠다
///   (로더·FindByReading 은 그대로 — 자동 배정 결과가 바뀌지 않게).
/// ⚠️ 호환 한자(U+F900~FAFF·U+2F800~2FA1F)·BMP 밖 글자는 소스에 글자로 적지 않는다 — 코드포인트 숫자나 \u·\U 이스케이프만.
/// </summary>
public static class HanjaInput
{
    /// <summary>칸 표시 글자 — 자동(서버가 고른다).</summary>
    public const char AutoMark = '*';
    /// <summary>칸 표시 글자 — 한자 없이 한글로(이름 칸에만).</summary>
    public const char NoneMark = '-';

    public const string TargetName = "name";
    public const string TargetSurname = "surname";

    public const string CodeNameNotHangul = "name_not_hangul";
    public const string CodeNameHanjaCount = "name_hanja_count";
    public const string CodeSurnameHanjaCount = "surname_hanja_count";
    public const string CodeSurnameNone = "surname_none";
    public const string CodeNotHanja = "not_hanja";
    public const string CodeNotInDictionary = "not_in_dictionary";
    public const string CodeReadingMismatch = "reading_mismatch";

    public const string StatusOk = "ok";

    // ── 오류 문구 7종 (설계서 §4-4, 사전에 없는 글자는 §20-3 확정 문구) ─────────────────────────────
    // 변수 뒤에 조사가 바로 붙지 않게 쓴다('‘서’ 칸에', '‘潤’ 글자의') — 서버에 조사 헬퍼를 두지 않는다.
    // 사전에 없는 글자를 '출생신고에 쓸 수 없는 글자'·'대법원 목록에 없는 글자'라고 쓰지 않는다 — 이 사전은 대법원 목록의 일부 글자를 싣지 못하고
    // 꼴만 다른 등재 글자가 있다(사실 확인 2026-11-19, docs/plan-hanja-input-facts-2026-11.json).

    public const string NameNotHangulMessage = "한자를 고르려면 이름과 성씨를 한글로만 넣어 주세요.";
    public const string NameHanjaCountMessage = "이름 한자는 이름 글자 수만큼 넣어 주세요.";
    public const string SurnameHanjaCountMessage = "성씨 한자는 성씨 글자 수만큼 넣어 주세요.";
    public const string SurnameNoneMessage = "성씨에는 ‘한자 없음’을 고를 수 없어요. 비워 두면 기본으로 두는 성씨 한자로 계산해요.";

    /// <summary>글자 판정(<see cref="Judge"/>)에서 한자가 아닌 글자·빈 입력에 쓰는 문장 — 칸을 모르는 자리라 음절을 넣지 않는다.</summary>
    public const string JudgeNotHanjaMessage = "한자 한 글자를 넣어 주세요.";

    public static string NotHanjaMessage(char syllable) =>
        $"‘{syllable}’ 칸에 넣은 글자는 한자가 아니에요. 한자 한 글자를 넣거나 비워 두면 자동으로 골라요.";

    /// <summary>성씨 칸 문장의 맺음 — 성씨 한자를 비워 두면 어떻게 계산하는지(<see cref="SurnameNoneMessage"/> 와 같은 말).</summary>
    private const string SurnameLeaveEmptyTail = "비워 두면 기본으로 두는 성씨 한자로 계산해요.";

    /// <summary>
    /// 사전에 없는 글자 — 음절을 모르면(글자만 판정) 칸 이름 없이 같은 뜻으로 쓴다.
    /// 성씨 칸(<paramref name="surname"/>)에는 인명용 한자·출생신고 이야기를 하지 않는다 — 성씨는 인명용 한자 제한을 받지 않는다(설계서 §20-4).
    /// 성씨 한자는 수리의 성씨 획수에만 쓰이므로 '성씨 획수를 세지 못한다'고 적는다.
    /// </summary>
    public static string NotInDictionaryMessage(char? syllable, bool surname = false)
    {
        string lookInList = syllable is { } s
            ? $"모양만 조금 다른 같은 글자가 실려 있을 수 있으니 ‘{s}’ 칸의 후보 목록에서 먼저 찾아보세요. "
            : "모양만 조금 다른 같은 글자가 실려 있을 수 있으니 후보 목록에서 먼저 찾아보세요. ";
        return surname
            ? "이 사이트 사전에 없는 글자라서 이 글자로는 성씨 획수를 세지 못해요. " + lookInList + SurnameLeaveEmptyTail
            : "이 사이트 사전에 없는 글자라서 이 글자로는 계산하지 못해요. 사전에 없다고 인명용 한자가 아니라는 뜻은 아닙니다. " + lookInList +
              "출생신고에 쓸 수 있는 글자인지는 대법원 전자가족관계등록시스템의 ‘인명용 한자 조회’에서 한글 음 한 글자를 넣어 확인할 수 있습니다.";
    }

    /// <summary>
    /// 독음 불일치 — 괄호 안은 <see cref="AcceptedSyllables"/>(보충 표 포함)라 均 은 '(균·연)'으로 나온다.
    /// · 그 음절로 읽는 한자가 사전에 하나도 없으면(봄·빛·궉 — <see cref="HasCandidates"/> 거짓) '그 음절로 읽는 한자를 넣어 주세요'는 따를 수 없는 안내라
    ///   맺음을 바꾼다. 이름 칸은 후보 표의 안내(<see cref="HanjaSelector.NoHanjaReadingNote"/>)와 같은 말이다.
    /// · 성씨 칸에는 '인명용 독음'이라고 쓰지 않는다 — 성씨는 인명용 한자 제한을 받지 않고(설계서 §20-4), 성씨로만 읽는 소리(鴌 궉)는 이 사전에 없을 수 있다.
    ///   그래서 '이 사이트 사전에 실린 독음'이라고 적는다.
    /// </summary>
    public static string ReadingMismatchMessage(HanjaInfo hanja, char syllable, bool surname = false)
    {
        string readings = string.Join("·", AcceptedSyllables(hanja));
        bool hasCandidates = HasCandidates(syllable);
        if (surname)
            return $"‘{hanja.Character}’ 글자는 이 사이트 사전에 실린 독음({readings})이 ‘{syllable}’ 칸과 맞지 않아요. " +
                (hasCandidates
                    ? $"‘{syllable}’ 음절로 읽는 한자를 넣어 주세요. " + SurnameLeaveEmptyTail
                    : $"이 사이트 사전에는 ‘{syllable}’ 음절로 읽는 한자가 없어 이 칸의 성씨 한자는 정할 수 없어요.");
        return $"‘{hanja.Character}’ 글자의 인명용 독음({readings})이 ‘{syllable}’ 칸과 맞지 않아요. " +
            (hasCandidates
                ? $"‘{syllable}’ 음절로 읽는 한자를 넣어 주세요."
                : HanjaSelector.NoHanjaReadingNote + ".");
    }

    // ── 손 표 ────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// 독음 보충 표 — 하드코딩 35자 가운데 사전 파일(data/hanja_dictionary_final.json)과 독음 집합이 다른 세 글자.
    /// 均 U+5747 '균,연'(대법원 목록의 지정 발음 — 두음 꼴이 아니라 별도 독음), 林 U+6797 '림,임', 流 U+6D41 '류,유'.
    /// 넷째 글자가 생기면 HanjaInputTests 의 '프런트 사전 (글자, 독음) 전수' 테스트가 실패한다.
    /// </summary>
    private static readonly Dictionary<string, string[]> ReadingSupplement = new(StringComparer.Ordinal)
    {
        ["均"] = new[] { "연" },
        ["林"] = new[] { "임" },
        ["流"] = new[] { "유" },
    };

    /// <summary>
    /// 사전에 없는 글자 → 권하는 등재 글자(코드포인트) 손 목록. KS X 1001 에 있어 윈도우 한자 키가 내지만 사전에는 꼴이 다른 글자만 실린 3자:
    /// U+6669 → U+665A(늦을 만), U+7A3D → U+25874, U+6E17 → U+6EF2. U+5F11 → U+5F12(윗사람 죽일 시)는 권할 글자가 아니라 뺐다.
    /// 대상이 사전에 없거나 쓸 수 없는 글자면 권하지 않는다(<see cref="SuggestionFor"/>).
    /// </summary>
    private static readonly Dictionary<int, int> SuggestionCodePoints = new()
    {
        [0x6669] = 0x665A,
        [0x7A3D] = 0x25874,
        [0x6E17] = 0x6EF2,
    };

    // ── 입력 문자열 → 글자 (설계서 §5-1) ────────────────────────────────────────────────────

    /// <summary>
    /// 입력 정리 — 공백류(전각 공백 포함)·폭 없는 문자(U+200B~200D·U+FEFF)·이체 선택자(U+FE00~FE0F·U+E0100~E01EF)를 Rune 단위로 지운다.
    /// null 은 빈 문자열. 홀로 남은 서로게이트는 U+FFFD 가 되어 뒤에서 '한자가 아님'으로 끝난다.
    /// </summary>
    public static string Strip(string? text)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        var sb = new StringBuilder(text.Length);
        foreach (var rune in text.EnumerateRunes())
        {
            if (IsIgnorable(rune)) continue;
            sb.Append(rune.ToString());
        }
        return sb.ToString();
    }

    private static bool IsIgnorable(Rune rune)
    {
        int v = rune.Value;
        return Rune.IsWhiteSpace(rune)
            || (v >= 0x200B && v <= 0x200D) || v == 0xFEFF
            || (v >= 0xFE00 && v <= 0xFE0F) || (v >= 0xE0100 && v <= 0xE01EF);
    }

    /// <summary>
    /// 호환 한자(U+F900~FAFF·U+2F800~2FA1F)·강희 부수(U+2F00~2FD5 — PDF 복사에서 金 대신 U+2FA6 이 온다)·부수 보충(U+2E80~2EF3)이면
    /// 그 한 글자에 NFKC 를 걸고, 결과가 한자 한 글자일 때만 그것으로 바꾼다. 그 밖의 글자는 그대로.
    /// </summary>
    public static Rune NormalizeRune(Rune rune)
    {
        int v = rune.Value;
        bool inRange = (v >= 0xF900 && v <= 0xFAFF) || (v >= 0x2F800 && v <= 0x2FA1F)
                    || (v >= 0x2F00 && v <= 0x2FD5) || (v >= 0x2E80 && v <= 0x2EF3);
        if (!inRange) return rune;

        string normalized;
        try { normalized = rune.ToString().Normalize(NormalizationForm.FormKC); }
        // 배정되지 않은 코드포인트를 거절하는 정규화 구현에 대비한다 — 사용자 입력이라 던지지 않는다
        // (이 PC 의 ICU·NLS 모드는 둘 다 던지지 않고 그대로 돌려준다 — 2026-11-19 확인. 정규화는 Lookup 에서 이 한 번뿐이라 막는 자리도 여기 하나다)
        catch (ArgumentException) { return rune; }
        if (Rune.DecodeFromUtf16(normalized, out var first, out int consumed) == OperationStatus.Done
            && consumed == normalized.Length && HanjaData.IsHanCodePoint(normalized))
            return first;
        return rune;
    }

    /// <summary>
    /// 호환 한자 블록(U+F900~FAFF) 안의 통합 한자 12자 — 정규형이 자기 자신이라 <see cref="NormalizeRune"/> 뒤에도 블록에 남는 '진짜 글자'다.
    /// 정규화 뒤 호환 블록(U+F900~FAFF·U+2F800~2FA1F)에 남은 그 밖의 코드는 배정되지 않은 코드포인트다(U+FA6E·U+FA6F·U+FADA~FAFF·U+2FA1E·U+2FA1F).
    /// </summary>
    private static readonly HashSet<int> UnifiedInCompatibilityBlock = new()
    {
        0xFA0E, 0xFA0F, 0xFA11, 0xFA13, 0xFA14, 0xFA1F, 0xFA21, 0xFA23, 0xFA24, 0xFA27, 0xFA28, 0xFA29,
    };

    /// <summary>
    /// 글자 한 자의 조회 — <see cref="Find"/>·<see cref="Resolve"/>·<see cref="Judge"/> 가 함께 쓰는 한 경로(정규화는 여기서 한 번뿐이다).
    /// · IsHan 거짓 = 한자가 아님. <see cref="HanjaData.IsHanCodePoint"/> 는 호환 블록 전체를 한자로 보는데(사전 병합용이라 고치지 않는다),
    ///   정규화 뒤에도 그 블록에 남은 코드는 통합 한자 12자가 아니면 글자가 아니다 — '사전에 없는 글자' 안내를 붙이지 않고 한자가 아닌 것으로 끝낸다.
    /// · 사전은 통합 한자로만 찾는다(<see cref="HanjaData.HanjaDictionary"/> — 호환 한자는 통합 항목에 병합돼 있다). <see cref="HanjaData.FindByCharacter"/> 를
    ///   쓰지 않는 까닭: 그 함수는 사전에 없는 글자에 정규화를 한 번 더 건다(ToUnifiedHanja). 정규화를 이미 지난 글자라 다시 걸 일이 없고,
    ///   정규화가 던지는 환경이라면 <see cref="NormalizeRune"/> 이 막아 둔 예외가 그쪽에서 다시 난다(막는 자리가 한 곳이어야 한다).
    /// </summary>
    private static (bool IsHan, string Character, HanjaInfo? Hanja) Lookup(Rune rune)
    {
        var normalized = NormalizeRune(rune);
        var character = normalized.ToString();
        int v = normalized.Value;
        bool inCompatibilityBlock = (v >= 0xF900 && v <= 0xFAFF) || (v >= 0x2F800 && v <= 0x2FA1F);
        if (!HanjaData.IsHanCodePoint(character) || (inCompatibilityBlock && !UnifiedInCompatibilityBlock.Contains(v)))
            return (false, character, null);
        return (true, character, HanjaData.HanjaDictionary.TryGetValue(character, out var hanja) ? hanja : null);
    }

    /// <summary>글자 한 자 → 사전 항목(통합 한자). 한자가 아니거나 사전에 없으면 null.</summary>
    public static HanjaInfo? Find(Rune rune) => Lookup(rune).Hanja;

    // ── 독음 판정 (설계서 §5-2) ──────────────────────────────────────────────────────────

    /// <summary>지정 독음 — 대표 독음, 다른 독음, 보충 표 순.</summary>
    private static IEnumerable<string> ReadingsOf(HanjaInfo hanja)
    {
        yield return hanja.Reading;
        foreach (var alt in hanja.AlternateReadings) yield return alt;
        if (ReadingSupplement.TryGetValue(hanja.Character, out var extra))
            foreach (var r in extra) yield return r;
    }

    /// <summary>
    /// 음절 칸에 이 한자를 받는가 — 음절이 지정 독음이거나, 지정 독음에 두음 규칙을 건 꼴이다(림 → 임, 록 → 녹). 자리(성·첫 음절·둘째 음절)를 가리지 않는다.
    /// 한쪽 방향이다: 두음 독음뿐인 글자를 본음 칸에 받지 않는다('라' 칸의 娜 — 지정 독음 '나'). 뜻 줄 안의 소리(龍 의 '총')는 보지 않는다.
    /// </summary>
    public static bool ReadsAs(HanjaInfo hanja, char syllable)
    {
        foreach (var reading in ReadingsOf(hanja))
        {
            if (reading.Length != 1) continue;
            if (reading[0] == syllable || RequiredCharEngine.ApplyInitialDueum(reading[0]) == syllable) return true;
        }
        return false;
    }

    /// <summary>이 글자를 넣을 수 있는 음절 — 지정 독음(대표 → 다른 독음 → 보충 표)과 그 두음 꼴, 중복 없이.</summary>
    public static IReadOnlyList<string> AcceptedSyllables(HanjaInfo hanja)
    {
        var list = new List<string>();
        var readings = ReadingsOf(hanja).Where(r => !string.IsNullOrEmpty(r)).ToList();
        foreach (var r in readings)
            if (!list.Contains(r)) list.Add(r);
        foreach (var r in readings)
        {
            if (r.Length != 1) continue;
            var dueum = RequiredCharEngine.ApplyInitialDueum(r[0]).ToString();
            if (!list.Contains(dueum)) list.Add(dueum);
        }
        return list;
    }

    /// <summary>
    /// 사전 뜻이 한글 훈인가 — 뜻 문자열에 한글 음절이 하나라도 있다. 화면에 싣는 글자 사실(HanjaFact 의 gloss·hasMeaning)과 후보 목록의 묶음이 이 판정을 쓴다.
    /// 사전 로더는 한글 뜻이 없는 글자에 Unihan 의 영문 뜻을 채워 두는데(지금 U+39B3 한 자 — 'to cultivate, …'), 그 글은 훈이 아니라서 화면에는
    /// '뜻 풀이 없는 글자'로 싣는다 — /hanja 사전(hanja-seo.json 의 m)과 같은 판정이 된다.
    /// 엔진의 '쓸 수 있는 글자'(<see cref="HanjaSelector.IsUsableNameHanja"/> — 자동 배정·점수가 쓰는 정의)는 건드리지 않는다.
    /// </summary>
    public static bool HasKoreanGloss(HanjaInfo hanja)
    {
        if (string.IsNullOrEmpty(hanja.Meaning)) return false;
        foreach (char c in hanja.Meaning)
            if (c >= 0xAC00 && c <= 0xD7A3) return true;
        return false;
    }

    /// <summary>후보 목록의 첫 묶음 '쓸 수 있는 글자'에 싣는가 — 엔진의 쓸 수 있는 글자(불용 아님 + 뜻 있음) 가운데 뜻이 한글 훈인 것.</summary>
    public static bool IsListedAsUsable(HanjaInfo hanja) => HanjaSelector.IsUsableNameHanja(hanja) && HasKoreanGloss(hanja);

    /// <summary>
    /// 음절의 후보 목록(설계서 §5-3) — <see cref="ReadsAs"/> 가 참인 사전 글자 전부. 순서: ① 쓸 수 있는 글자(<see cref="HanjaSelector.OrderForDisplay"/> 순)
    /// ② 불용 글자(코드포인트 순) ③ 뜻 풀이 없는 비불용 글자(코드포인트 순). 입력 검증과 같은 술어라 '목록에 있는데 넣으면 거절'이 생기지 않는다.
    /// 묶음은 화면이 받는 표시(HanjaFact 의 forbidden·hasMeaning)와 같은 판정으로 가른다 — ① = <see cref="IsListedAsUsable"/>,
    /// ③ = 불용이 아니고 한글 훈이 없는 글자(<see cref="HasKoreanGloss"/> 거짓).
    /// </summary>
    public static List<HanjaInfo> CandidatesFor(char syllable)
    {
        var all = HanjaData.GetAllHanja().Where(h => ReadsAs(h, syllable)).ToList();
        var usable = HanjaSelector.OrderForDisplay(all).Where(HasKoreanGloss).ToList();
        var forbidden = all.Where(h => HanjaData.IsForbiddenNameHanja(h.Character)).OrderBy(CodePointOf);
        var noMeaning = all
            .Where(h => !HanjaData.IsForbiddenNameHanja(h.Character) && !HasKoreanGloss(h))
            .OrderBy(CodePointOf);
        return usable.Concat(forbidden).Concat(noMeaning).ToList();
    }

    /// <summary>이 음절로 읽는 한자가 사전에 하나라도 있는가(<see cref="CandidatesFor"/> 가 비지 않는가) — 없으면 화면이 칸을 잠그는 음절이다(봄·빛).</summary>
    public static bool HasCandidates(char syllable) => HanjaData.GetAllHanja().Any(h => ReadsAs(h, syllable));

    private static int CodePointOf(HanjaInfo hanja) => char.ConvertToUtf32(hanja.Character, 0);

    // ── 이름·성씨 쪽 판정 ────────────────────────────────────────────────────────────────

    /// <summary>비지 않았고 모든 char 가 한글 음절(가 U+AC00 ~ 힣 U+D7A3)인가 — 참이면 char 수 = Rune 수 = 칸 수다.</summary>
    public static bool IsHangulSyllables(string? text)
    {
        if (string.IsNullOrEmpty(text)) return false;
        foreach (char c in text)
            if (c < 0xAC00 || c > 0xD7A3) return false;
        return true;
    }

    /// <summary>
    /// 이 음절의 자동 배정이 비는가(쓸 수 있는 인명용 한자가 없는 음절 — 봄·빛·몰·괵). 배정이 비는지는 성별·용신과 무관하다
    /// (<see cref="HanjaSelector.Select"/> 는 불용·뜻 유무로만 null 을 정한다). 이런 칸에 '한자 없음'이 와도 자동으로 접는 기준이다.
    /// </summary>
    public static bool AutoIsEmpty(char syllable)
        => HanjaSelector.Select(syllable.ToString(), "none", null, null, null)[0] == null;

    /// <summary>
    /// 성씨 한 자리의 기본 한자 — 대표 한자 표(<see cref="SurnameData.RepresentativeHanja"/>)에 있는 성씨면 표의 그 자리 글자,
    /// 없으면 그 음절의 추정 글자(<see cref="SurnameData.ResolveStrokes"/> 의 표 밖 분기와 같은 식 — 독음 관련도 1순위 중 획수 있는 글자). 못 정하면 null.
    /// ResolveStrokes().Hanja 를 자리 번호로 읽지 않는 까닭: 표 밖 성씨에서 앞 음절 추정이 실패하면 그 문자열이 짧게 끊긴다.
    /// </summary>
    public static HanjaInfo? SurnameDefaultAt(string surname, int index)
    {
        if (string.IsNullOrEmpty(surname) || index < 0 || index >= surname.Length) return null;

        if (SurnameData.RepresentativeHanja.TryGetValue(surname, out var table))
        {
            var runes = table.EnumerateRunes().ToList();
            return index < runes.Count ? HanjaData.FindByCharacter(runes[index].ToString()) : null;
        }

        return HanjaData.SortByRelevance(HanjaData.FindByReading(surname[index].ToString()))
            .FirstOrDefault(h => h.StrokeCount > 0);
    }

    /// <summary>
    /// /evaluate 의 한자 필드 둘을 읽는다(설계서 §5-1·§7-1). 지정이 없으면 (null, null) — 호출부는 picks 없이 예전 경로를 탄다.
    /// 문제가 있으면 예외를 던지지 않고 Problem 을 돌려준다(사용자가 넣은 글자가 예외 문구로 로그에 남지 않게).
    /// 검사 순서: 한글 검사 → 이름 글자 수 → 성씨 글자 수 → 성씨의 '한자 없음' → 이름 칸을 자리 순으로 → 성씨 칸을 자리 순으로
    /// (칸 하나 안에서는 한자 아님 → 사전에 없음 → 독음 불일치). 첫 문제 하나만 돌려준다. 칸 하나의 문제가 아니면(한글 검사·글자 수) Slot 은 -1.
    /// '검사하지 않는 요청'은 두 필드가 정리 뒤 모두 빈 문자열일 때뿐이다 — 전부 '*' 인 필드는 검사(한글·글자 수)를 지난 뒤에 지정 없음으로 접힌다
    /// (표시 글자는 칸 수에 맞춰 적는 자리 표시라, 칸 수가 안 맞거나 이름이 한글이 아니면 잘못 만든 요청이다 — 설계서 §4-2·§21).
    /// </summary>
    public static (HanjaPicks? Picks, HanjaInputProblem? Problem) Resolve(
        string name, string lastName, string? nameHanja, string? lastNameHanja)
    {
        // 1) 둘 다 비면 지정 없음 — 이름·성씨를 들여다보지 않는다(지정 없는 요청은 지금과 같아야 한다)
        var nameText = Strip(nameHanja);
        var surnameText = Strip(lastNameHanja);
        if (nameText.Length == 0 && surnameText.Length == 0) return (null, null);

        // 2) 한글 음절만 — 엔진은 이름을 UTF-16 char 로 돈다. 한글 음절만이면 char 수 = 칸 수라 고른 칸이 다른 음절로 밀리지 않는다
        name ??= string.Empty;
        var surname = (lastName ?? string.Empty).Trim();
        if (!IsHangulSyllables(name))
            return (null, new HanjaInputProblem(CodeNameNotHangul, TargetName, -1, NameNotHangulMessage));
        if (!IsHangulSyllables(surname))
            return (null, new HanjaInputProblem(CodeNameNotHangul, TargetSurname, -1, NameNotHangulMessage));

        // 3) 글자 수 — Rune 으로 센다
        var nameRunes = nameText.EnumerateRunes().ToList();
        var surnameRunes = surnameText.EnumerateRunes().ToList();
        if (nameRunes.Count > 0 && nameRunes.Count != name.Length)
            return (null, new HanjaInputProblem(CodeNameHanjaCount, TargetName, -1, NameHanjaCountMessage));
        if (surnameRunes.Count > 0 && surnameRunes.Count != surname.Length)
            return (null, new HanjaInputProblem(CodeSurnameHanjaCount, TargetSurname, -1, SurnameHanjaCountMessage));

        for (int i = 0; i < surnameRunes.Count; i++)
            if (surnameRunes[i].Value == NoneMark)
                return (null, new HanjaInputProblem(CodeSurnameNone, TargetSurname, i, SurnameNoneMessage));

        // 4) 이름 칸
        var namePicks = new List<HanjaPick>(name.Length);
        for (int i = 0; i < name.Length; i++)
        {
            if (nameRunes.Count == 0 || nameRunes[i].Value == AutoMark)
            {
                namePicks.Add(HanjaPick.Auto);
            }
            else if (nameRunes[i].Value == NoneMark)
            {
                // 자동 배정이 비는 음절의 '한자 없음'은 자동으로 접는다 — 계산 값은 같고(둘 다 null), 접지 않으면 한자를 하나도 고르지 않은
                // '한빛' + "*-" 가 지정 경로를 타 노트·통계 키·주소가 지금과 갈린다
                namePicks.Add(AutoIsEmpty(name[i]) ? HanjaPick.Auto : HanjaPick.None);
            }
            else
            {
                var (hanja, problem) = ResolveSlot(nameRunes[i], name[i], TargetName, i);
                if (problem != null) return (null, problem);
                namePicks.Add(HanjaPick.Of(hanja!));
            }
        }

        // 5) 성씨 칸 — 한 글자라도 고르면 '*' 자리를 기본 한자로 채운 전체 목록
        List<HanjaInfo?>? surnamePicks = null;
        if (surnameRunes.Any(r => r.Value != AutoMark))
        {
            surnamePicks = new List<HanjaInfo?>(surname.Length);
            for (int i = 0; i < surname.Length; i++)
            {
                if (surnameRunes[i].Value == AutoMark)
                {
                    surnamePicks.Add(SurnameDefaultAt(surname, i));
                    continue;
                }
                var (hanja, problem) = ResolveSlot(surnameRunes[i], surname[i], TargetSurname, i);
                if (problem != null) return (null, problem);
                surnamePicks.Add(hanja);
            }

            // 대표 한자 표에 있는 성씨에서 표의 글자와 같으면 지정 없음으로 접는다. 표 밖 성씨는 추정 글자와 같아도 접지 않는다
            // (접으면 고른 사람에게 '성씨 한자는 추정이에요'가 뜬다).
            if (SurnameData.RepresentativeHanja.TryGetValue(surname, out var table)
                && string.Concat(surnamePicks.Select(h => h?.Character ?? AutoMark.ToString())) == table)
                surnamePicks = null;
        }

        if (surnamePicks == null && namePicks.All(p => p.Kind == HanjaPickKind.Auto)) return (null, null);
        return (new HanjaPicks(namePicks, surnamePicks), null);
    }

    /// <summary>칸 하나의 글자 판정 — 한자 아님 → 사전에 없음 → 독음 불일치. 성씨 칸의 문장은 성씨용이다(인명용 한자 이야기를 하지 않는다).</summary>
    private static (HanjaInfo? Hanja, HanjaInputProblem? Problem) ResolveSlot(Rune rune, char syllable, string target, int slot)
    {
        bool surname = target == TargetSurname;
        var (isHan, _, hanja) = Lookup(rune);
        if (!isHan)
            return (null, new HanjaInputProblem(CodeNotHanja, target, slot, NotHanjaMessage(syllable)));

        if (hanja == null)
            return (null, new HanjaInputProblem(CodeNotInDictionary, target, slot, NotInDictionaryMessage(syllable, surname)));

        if (!ReadsAs(hanja, syllable))
            return (null, new HanjaInputProblem(CodeReadingMismatch, target, slot, ReadingMismatchMessage(hanja, syllable, surname)));

        return (hanja, null);
    }

    /// <summary>사전에 없는 글자에 권하는 등재 글자 — 손 목록에 있고, 대상이 사전에 있으며 후보 목록에 쓸 수 있는 글자로 실리는 글자일 때만.</summary>
    public static HanjaInfo? SuggestionFor(Rune rune)
    {
        if (!SuggestionCodePoints.TryGetValue(NormalizeRune(rune).Value, out int target)) return null;
        return HanjaData.HanjaDictionary.TryGetValue(char.ConvertFromUtf32(target), out var hanja) && IsListedAsUsable(hanja) ? hanja : null;
    }

    /// <summary>
    /// 글자 한 자의 판정(/hanja/resolve — 설계서 §4-5). 정리 뒤 첫 글자만 본다. <paramref name="syllable"/> 이 없으면 독음 판정 없이 글자만 찾는다.
    /// <paramref name="surname"/> 이 참이면 성씨 칸에 넣을 글자다 — 판정은 같고 안내 문장만 성씨용으로 쓴다.
    /// 조회라서 어느 경우에도 예외를 던지지 않는다.
    /// </summary>
    public static HanjaJudgement Judge(string? text, char? syllable, bool surname = false)
    {
        var stripped = Strip(text);
        if (stripped.Length == 0)
            return new HanjaJudgement(CodeNotHanja, null, null, Array.Empty<string>(), JudgeNotHanjaMessage, null);

        var rune = stripped.EnumerateRunes().First();
        var (isHan, character, hanja) = Lookup(rune);
        if (!isHan)
            return new HanjaJudgement(CodeNotHanja, null, null, Array.Empty<string>(), JudgeNotHanjaMessage, null);

        if (hanja == null)
            return new HanjaJudgement(CodeNotInDictionary, character, null, Array.Empty<string>(),
                NotInDictionaryMessage(syllable, surname), SuggestionFor(rune));

        var accepted = AcceptedSyllables(hanja);
        if (syllable is { } s && !ReadsAs(hanja, s))
            return new HanjaJudgement(CodeReadingMismatch, hanja.Character, hanja, accepted, ReadingMismatchMessage(hanja, s, surname), null);

        return new HanjaJudgement(StatusOk, hanja.Character, hanja, accepted, null, null);
    }
}
