namespace NameForm.Application.Engines;

/// <summary>
/// 부모 기반 작명 엔진 인터페이스
/// </summary>
public interface IParentBasedNamingEngine
{
    /// <summary>
    /// 부모 정보를 기반으로 이름 후보 생성 — 이름(성 제외)은 늘 2음절이다(2026-10-28).
    /// fatherName·motherName 은 성을 뺀 이름이다(/search 는 성 포함 전체 이름 칸을 프런트가 lib/name-split.ts 로 나눠 보낸다 —
    /// 성 칸 없이 전체 이름을 보낸 옛 /search 꼴은 SmartRecommendationService 가 Utils/ParentNameSplit 으로 나눠 넘긴다. 엔진은 나누지 않고,
    /// 성 칸이 빈 3자 이상 이름은 나눈 이름 부분을 거르기 목록에만 더한다 — 부모 이름 그대로가 후보로 나오지 않게).
    /// <paramref name="birthTime"/> 은 출생일과 함께 family-meaning 의 음절 한자를 /evaluate 배정과 같게 고르는 데만 쓴다(없으면 시각 없이).
    /// </summary>
    Task<List<ParentBasedNameCandidate>> GenerateCandidatesAsync(
        string lastName,
        string? fatherSurname,
        string? fatherName,
        string? motherSurname,
        string? motherName,
        string? storyKeyword,
        DateTime birthDate,
        string gender,
        string tone,
        TimeSpan? birthTime = null);
}

/// <summary>
/// 부모 기반 이름 후보 — POST /recommendations/parent-based 응답 항목 그대로.
/// </summary>
public class ParentBasedNameCandidate
{
    /// <summary>이름(성 제외, 2음절)</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>작명 방식 중립 코드(<see cref="ParentNamingModels"/> — 예: "mother-surname", "parent-syllables"). 화면에는 <see cref="NamingLabel"/> 을 쓴다</summary>
    public string NamingModel { get; set; } = string.Empty;

    /// <summary>사용자용 방식 이름(예: "어머니 성씨 잇기", "부모 이름 글자 잇기") — 태그·칩 문구</summary>
    public string NamingLabel { get; set; } = string.Empty;

    /// <summary>계승 꼴 — "음운중심"(부모 글자·성씨 소리를 잇는다) · "의미중심"(부모 이름 글자의 한자 뜻을 잇는다) · "서사중심"(공통 글자·키워드·성씨 뜻). 방식에서 바로 정한다</summary>
    public string NameType { get; set; } = string.Empty;

    /// <summary>생성 방식 설명 — 이름에 실제로 든 글자·그 글자의 훈만 인용한다</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// 설명이 풀이한 한자(음절마다 한 자, 이름과 같은 길이) — 뜻을 잇는 방식(부모 이름 뜻·키워드 뜻)만 있고 나머지는 null.
    /// 부모 이름 뜻(family-meaning)은 요청 출생일·시각·성별의 용신 배정(HanjaSelector.Select — /evaluate 의 ScoringService.AssignedHanja 와 같은 글자),
    /// 키워드 뜻 두 자는 훈의 낱말 일치로 고른 글자라 /evaluate 배정과 다를 수 있다.
    /// 실명 짝 글자를 더한 후보(키워드·성씨 뜻 한 자 + 짝 글자)는 짝 글자를 풀이하지 않으므로 null 이다
    /// </summary>
    public string? Hanja { get; set; }
}

/// <summary>
/// 부모 기반 작명 방식 — 중립 코드(응답·DB Candidate.NamingModel varchar 50), 사용자 라벨, 계승 꼴(NameType).
/// 옛 값은 실존 인물로 보일 수 있는 사람 이름 꼴(…모델)이라 응답·태그·DB 에 그대로 나갔다(2026-10-28 교체 — 실존 인물 이름을 라벨에 쓰지 말 것).
/// </summary>
public static class ParentNamingModels
{
    public const string FamilyMeaning = "family-meaning";
    public const string ParentInitials = "parent-initials";
    public const string ParentSyllables = "parent-syllables";
    public const string SharedSyllable = "shared-syllable";
    public const string MotherInitial = "mother-initial";
    public const string FatherInitial = "father-initial";
    public const string FatherSyllable = "father-syllable";
    public const string MotherSyllable = "mother-syllable";
    public const string MotherSurname = "mother-surname";
    public const string MotherSound = "mother-sound";
    public const string KeywordMeaning = "keyword-meaning";
    public const string KeywordSound = "keyword-sound";
    public const string SurnameMeaning = "surname-meaning";

    public const string Phonetic = "음운중심";
    public const string Semantic = "의미중심";
    public const string Narrative = "서사중심";

    private static readonly Dictionary<string, (string Label, string NameType)> Info = new()
    {
        [FamilyMeaning] = ("부모 이름 뜻 잇기", Semantic),
        [ParentInitials] = ("부모 이름 첫 글자 잇기", Phonetic),
        [ParentSyllables] = ("부모 이름 글자 잇기", Phonetic),
        [SharedSyllable] = ("부모 공통 글자 잇기", Narrative),
        [MotherInitial] = ("어머니 이름 첫 글자 잇기", Phonetic),
        [FatherInitial] = ("아버지 이름 첫 글자 잇기", Phonetic),
        // 결과가 5개 미만일 때만 쓰는 예비 경로 — 부모 이름의 첫 글자 밖 글자 + 실명 짝 글자(아버지 '병철'의 '철')
        [FatherSyllable] = ("아버지 이름 글자 잇기", Phonetic),
        [MotherSyllable] = ("어머니 이름 글자 잇기", Phonetic),
        [MotherSurname] = ("어머니 성씨 잇기", Phonetic),
        [MotherSound] = ("어머니 성씨 소리 잇기", Phonetic),
        [KeywordMeaning] = ("키워드 뜻 잇기", Narrative),
        [KeywordSound] = ("키워드 소리 잇기", Narrative),
        [SurnameMeaning] = ("성씨 뜻 잇기", Narrative),
    };

    /// <summary>
    /// 2026-10-28 전 값(DB 에 저장된 옛 추천의 Candidate.NamingModel) → 새 코드. GET /recommendations/{id} 가 읽을 때 바꾼다 —
    /// 음운유전(출력 0건)은 글자 잇기로 둔다. 옛 신해솜 값은 키워드 경로와 키워드 없는 성씨 자동 경로가 같은 값을 써서 어느 쪽인지
    /// 알 수 없다 — 표에 넣지 않아 코드·라벨 모두 null 로 읽는다('키워드 뜻 잇기'로 읽으면 키워드가 없던 성씨 자동 후보에 거짓 라벨이 붙었다).
    /// </summary>
    private static readonly Dictionary<string, string> Legacy = new()
    {
        ["윤고은모델"] = MotherSurname,
        ["문소리모델"] = MotherSound,
        ["이수지-박지수모델"] = ParentSyllables,
        ["복합모델"] = ParentInitials,
        ["의미융합서사"] = FamilyMeaning,
        ["세대연결서사"] = SharedSyllable,
        ["음운유전서사"] = ParentSyllables,
    };

    /// <summary>방식 코드 목록(우선순위 순 — 엔진의 라운드 로빈 순서와 같다)</summary>
    public static IReadOnlyCollection<string> Codes => Info.Keys;

    /// <summary>부모 이름 글자에서 나온 방식 — '첫 번째 후보' 배너 자리에 오는 방식</summary>
    public static bool IsParentLetterModel(string? code)
        => code is FamilyMeaning or ParentInitials or ParentSyllables or SharedSyllable or MotherInitial or FatherInitial
            or FatherSyllable or MotherSyllable;

    /// <summary>저장된 값(새 코드 또는 옛 값)을 새 코드로. 모르는 값·빈 값은 null.</summary>
    public static string? Normalize(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored)) return null;
        if (Info.ContainsKey(stored)) return stored;
        return Legacy.TryGetValue(stored, out var code) ? code : null;
    }

    /// <summary>사용자 라벨 — 모르는 코드는 null(코드를 화면에 내보내지 않는다)</summary>
    public static string? LabelFor(string? code)
    {
        var c = Normalize(code);
        return c != null ? Info[c].Label : null;
    }

    /// <summary>계승 꼴(NameType 값)</summary>
    public static string NameTypeFor(string code) => Info[code].NameType;
}
