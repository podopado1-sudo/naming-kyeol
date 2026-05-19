using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines;

/// <summary>
/// 부모 기반 작명 엔진 구현
/// 윤고은 모델, 문소리 모델, 신해솜 모델, 이수지-박지수 모델 지원
/// </summary>
public class ParentBasedNamingEngine : IParentBasedNamingEngine
{
    private readonly INamePoolEngine _namePoolEngine;
    private readonly INameReversalEngine _nameReversalEngine;

    public ParentBasedNamingEngine(INamePoolEngine namePoolEngine, INameReversalEngine nameReversalEngine)
    {
        _namePoolEngine = namePoolEngine;
        _nameReversalEngine = nameReversalEngine;
    }

    // ===== 성씨 의미 사전 (30개 이상) =====
    private static readonly Dictionary<string, List<string>> SurnameMeaningDictionary = new()
    {
        { "김", new List<string> { "금", "귀하다", "쇠", "금빛" } },
        { "이", new List<string> { "오얏", "자두", "열매", "이슬" } },
        { "박", new List<string> { "순박하다", "소박한", "박달나무" } },
        { "최", new List<string> { "높다", "으뜸", "최고" } },
        { "정", new List<string> { "바르다", "정의", "고요하다" } },
        { "강", new List<string> { "강하다", "강물", "굳세다" } },
        { "조", new List<string> { "비추다", "아침", "고요" } },
        { "윤", new List<string> { "윤택하다", "빛나다", "고르다" } },
        { "장", new List<string> { "기르다", "길다", "크다" } },
        { "임", new List<string> { "수풀", "숲", "우거지다" } },
        { "한", new List<string> { "크다", "한가하다", "나라" } },
        { "오", new List<string> { "깨닫다", "오르다", "다섯" } },
        { "서", new List<string> { "상서롭다", "서쪽", "글" } },
        { "신", new List<string> { "새롭다", "신비", "믿다" } },
        { "권", new List<string> { "권하다", "힘", "바르다" } },
        { "황", new List<string> { "누르다", "빛나다", "임금" } },
        { "안", new List<string> { "편안하다", "안정", "편히" } },
        { "송", new List<string> { "소나무", "늘푸른", "굳세다" } },
        { "류", new List<string> { "버드나무", "부드럽다", "흐르다" } },
        { "유", new List<string> { "버드나무", "부드럽다", "넉넉하다" } },
        { "홍", new List<string> { "붉다", "넓다", "크다" } },
        { "전", new List<string> { "온전하다", "밭", "펼치다" } },
        { "고", new List<string> { "높다", "고귀하다", "크다" } },
        { "문", new List<string> { "글", "무늬", "문화" } },
        { "양", new List<string> { "버드나무", "빛나다", "바다" } },
        { "손", new List<string> { "자손", "겸손", "이어가다" } },
        { "배", new List<string> { "짝", "절하다", "나누다" } },
        { "백", new List<string> { "밝다", "하얗다", "맑다" } },
        { "하", new List<string> { "강물", "흐르다", "여름", "아래" } },
        { "남", new List<string> { "따뜻하다", "남쪽", "봄" } },
        { "심", new List<string> { "심다", "깊다", "마음" } },
        { "노", new List<string> { "힘쓰다", "노력", "밝다" } },
        { "천", new List<string> { "하늘", "샘", "천리" } },
        { "민", new List<string> { "백성", "민첩하다", "슬기롭다" } },
        { "진", new List<string> { "참되다", "진실", "나아가다" } },
    };

    // ===== 성씨+이름=단어 패턴 DB (50개 이상) =====
    private static readonly List<(string Surname, string GivenName, string CombinedWord, string Meaning)> SurnameWordPatterns = new()
    {
        // 자연/풍경
        ("이", "슬", "이슬", "아침 이슬"),
        ("하", "늘", "하늘", "하늘"),
        ("강", "산", "강산", "강과 산, 국토"),
        ("강", "물", "강물", "흐르는 강물"),
        ("하", "람", "하람", "하늘의 바람"),
        ("이", "솔", "이솔", "소나무 이름"),
        ("송", "이", "송이", "꽃송이"),
        ("한", "별", "한별", "큰 별"),
        ("한", "울", "한울", "큰 울타리, 하늘"),
        ("강", "별", "강별", "강가의 별"),
        ("노", "을", "노을", "저녁노을"),
        ("이", "른", "이른", "이른 아침"),
        ("백", "합", "백합", "백합꽃"),
        ("남", "산", "남산", "남쪽 산"),
        ("천", "리", "천리", "먼 길, 천리길"),

        // 의미/가치
        ("신", "비", "신비", "신비로움"),
        ("신", "뢰", "신뢰", "믿음"),
        ("고", "운", "고운", "고운 마음"),
        ("고", "을", "고을", "마을, 고장"),
        ("문", "화", "문화", "문명과 문화"),
        ("안", "녕", "안녕", "편안한 안녕"),
        ("정", "성", "정성", "정성스러운 마음"),
        ("정", "의", "정의", "올바름"),
        ("유", "리", "유리", "맑은 유리"),
        ("배", "움", "배움", "배움의 길"),
        ("손", "길", "손길", "따뜻한 손길"),
        ("심", "은", "심은", "심어놓은, 씨앗"),
        ("민", "들", "민들", "민들레"),

        // 음운 유희
        ("이", "사", "이사", "새 출발"),
        ("강", "하", "강하", "강하다"),
        ("홍", "익", "홍익", "넓게 이롭다"),
        ("서", "울", "서울", "서울"),
        ("서", "연", "서연", "상서로운 인연"),
        ("서", "하", "서하", "상서로운 여름"),
        ("한", "솔", "한솔", "큰 소나무"),
        ("한", "나", "한나", "하나, 유일"),
        ("한", "빛", "한빛", "큰 빛"),
        ("오", "름", "오름", "올라가는 것"),
        ("오", "솔", "오솔", "오솔길"),
        ("백", "설", "백설", "흰 눈"),
        ("전", "설", "전설", "이야기"),

        // 감성/서정
        ("이", "랑", "이랑", "밭이랑, 물결"),
        ("이", "봄", "이봄", "봄이 오다"),
        ("하", "윤", "하윤", "여름의 윤택함"),
        ("하", "은", "하은", "여름의 은혜"),
        ("하", "진", "하진", "여름의 참됨"),
        ("강", "솔", "강솔", "강한 소나무"),
        ("신", "해", "신해", "새로운 바다"),
        ("유", "하", "유하", "넉넉한 여름"),
        ("유", "나", "유나", "넉넉한 나"),
        ("임", "하", "임하", "숲의 여름"),
        ("조", "은", "조은", "좋은"),
        ("진", "솔", "진솔", "진심과 소나무"),
        ("진", "서", "진서", "참된 글"),
        ("남", "이", "남이", "따뜻한 이"),
        ("송", "하", "송하", "소나무 아래"),
    };

    public async Task<List<ParentBasedNameCandidate>> GenerateCandidatesAsync(
        string lastName,
        string? fatherSurname,
        string? fatherName,
        string? motherSurname,
        string? motherName,
        string? storyKeyword,
        DateTime birthDate,
        string gender,
        string tone)
    {
        var candidates = new List<ParentBasedNameCandidate>();

        // 1. 윤고은 모델 (Prefix): 어머니 성씨를 이름 앞에 붙임
        if (!string.IsNullOrEmpty(motherSurname) && !string.IsNullOrEmpty(motherName))
        {
            var yoonGoEunCandidates = ApplyYoonGoEunModel(motherSurname, motherName, gender, tone);
            candidates.AddRange(yoonGoEunCandidates);
        }

        // 2. 문소리 모델 (Suffix Mutation): 아버지 성씨 + 기본 단어 + 어머니 성씨 변주
        if (!string.IsNullOrEmpty(fatherSurname) && !string.IsNullOrEmpty(motherSurname))
        {
            var moonSoRiCandidates = ApplyMoonSoRiModel(fatherSurname, motherSurname, gender, tone);
            candidates.AddRange(moonSoRiCandidates);
        }

        // 3. 신해솜 모델 (Story-driven): 스토리 키워드 기반 + 성씨 포함 의미 이름
        if (!string.IsNullOrEmpty(storyKeyword))
        {
            var shinHaeSomCandidates = ApplyShinHaeSomModel(storyKeyword, lastName, gender, tone);
            candidates.AddRange(shinHaeSomCandidates);
        }

        // 3-1. 신해솜 모델 (성씨 자동 활용): storyKeyword 없이도 성씨 의미 기반 이름 생성
        {
            var surnameAutoCandidates = ApplySurnameAutoShinHaeSomModel(lastName, gender, tone);
            candidates.AddRange(surnameAutoCandidates);
        }

        // 4. 이수지-박지수 모델 (Mirroring): 부모 이름 글자 순서 반전/재조합
        if (!string.IsNullOrEmpty(fatherName) || !string.IsNullOrEmpty(motherName))
        {
            var mirrorCandidates = await ApplyMirrorModelAsync(fatherName, motherName, gender, tone);
            candidates.AddRange(mirrorCandidates);
        }

        // 5. 복합 모델: 여러 모델 조합
        if (!string.IsNullOrEmpty(fatherName) && !string.IsNullOrEmpty(motherName))
        {
            var compositeCandidates = ApplyCompositeModel(
                fatherSurname, fatherName, motherSurname, motherName, gender, tone);
            candidates.AddRange(compositeCandidates);
        }

        // 6. 가족 서사 기반 작명 (새로운 창의적 함수들)
        if (!string.IsNullOrEmpty(fatherName) || !string.IsNullOrEmpty(motherName))
        {
            // 함수 1: 의미 융합 서사 추출
            var meaningNarrative = FamilyNarrativeExtractor.ExtractMeaningFusionNarrative(
                fatherName, motherName);
            var meaningCandidates = ApplyMeaningFusionNarrative(meaningNarrative, gender, tone);
            candidates.AddRange(meaningCandidates);

            // 함수 2: 음운 유전 서사 추출
            var phoneticNarrative = FamilyNarrativeExtractor.ExtractPhoneticInheritanceNarrative(
                fatherName, motherName);
            var phoneticCandidates = ApplyPhoneticInheritanceNarrative(phoneticNarrative, gender, tone);
            candidates.AddRange(phoneticCandidates);

            // 함수 3: 세대 연결 서사 추출
            var generationalNarrative = FamilyNarrativeExtractor.ExtractGenerationalBridgeNarrative(
                fatherName, motherName);
            var generationalCandidates = ApplyGenerationalBridgeNarrative(generationalNarrative, gender, tone);
            candidates.AddRange(generationalCandidates);
        }

        // 중복 제거 및 필터링 (모델 다양성 보장)
        var deduplicated = candidates
            .Where(c => IsValidName(c.Name))
            .Where(c => c.Name.Length >= 2 && c.Name.Length <= 4) // 2~4음절 허용
            .GroupBy(c => c.Name)
            .Select(g => g.First())
            .ToList();

        // 각 모델별로 공정하게 배분 (라운드 로빈)
        var byModel = deduplicated
            .GroupBy(c => c.NamingModel)
            .ToDictionary(g => g.Key, g => new Queue<ParentBasedNameCandidate>(g));
        var filtered = new List<ParentBasedNameCandidate>();
        while (filtered.Count < 50 && byModel.Values.Any(q => q.Count > 0))
        {
            foreach (var key in byModel.Keys.ToList())
            {
                if (byModel[key].Count > 0 && filtered.Count < 50)
                {
                    filtered.Add(byModel[key].Dequeue());
                }
            }
        }

        return await Task.FromResult(filtered);
    }

    /// <summary>
    /// 윤고은 모델: 어머니 성씨를 이름 앞에 붙임
    /// 예: 어머니 성씨 "윤" + 이름 "고은" -> "윤고은"
    /// </summary>
    private List<ParentBasedNameCandidate> ApplyYoonGoEunModel(
        string motherSurname, string motherName, string gender, string tone)
    {
        var candidates = new List<ParentBasedNameCandidate>();

        // 어머니 성씨 + 어머니 이름
        var fullName = PhoneticVariationUtils.PrependSurnameAsPrefix(motherSurname, motherName);
        if (IsValidName(fullName))
        {
            candidates.Add(new ParentBasedNameCandidate
            {
                Name = fullName,
                NamingModel = "윤고은모델",
                NameType = DetermineNameType(fullName),
                Description = $"어머니 성씨 '{motherSurname}'{KoreanUtils.EulReul(motherSurname)} 이름 앞에 붙임"
            });
        }

        // 어머니 성씨 + 다른 한자 조합
        var hanjaList = GetFilteredHanja(gender, tone);
        foreach (var hanja in hanjaList.Take(10))
        {
            var name = motherSurname + hanja.Reading;
            if (IsValidName(name) && name.Length >= 2 && name.Length <= 3)
            {
                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = name,
                    NamingModel = "윤고은모델",
                    NameType = DetermineNameType(name),
                    Description = $"어머니 성씨 '{motherSurname}' + 한자 '{hanja.Reading}'"
                });
            }
        }

        return candidates;
    }

    /// <summary>
    /// 문소리 모델: 아버지 성씨 + 기본 단어 + 어머니 성씨 변주
    /// 예: "문" + "소" + "리" (이 -> 리 변주)
    /// </summary>
    private List<ParentBasedNameCandidate> ApplyMoonSoRiModel(
        string fatherSurname, string motherSurname, string gender, string tone)
    {
        var candidates = new List<ParentBasedNameCandidate>();

        // 어머니 성씨 변주
        var motherVariant = PhoneticVariationUtils.ApplySurnameVariant(motherSurname);

        // 아버지 성씨 + 한자 + 어머니 성씨 변주
        var hanjaList = GetFilteredHanja(gender, tone);
        foreach (var hanja in hanjaList.Take(15))
        {
            var name = fatherSurname + hanja.Reading + motherVariant;
            if (IsValidName(name) && name.Length >= 3 && name.Length <= 4)
            {
                // 리듬감 검증 (4음절인 경우)
                if (name.Length == 4 && !ValidateRhythm(name))
                    continue;

                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = name,
                    NamingModel = "문소리모델",
                    NameType = "음운중심",
                    Description = $"아버지 성씨 '{fatherSurname}' + 한자 '{hanja.Reading}' + 어머니 성씨 변주 '{motherVariant}'"
                });
            }
        }

        // 아버지 성씨 + 기본 단어 + 어머니 성씨 변주 (간단한 버전)
        var simpleWords = new[] { "소", "하", "지", "서", "민", "예", "도", "현", "연", "채" };
        foreach (var word in simpleWords)
        {
            var name = fatherSurname + word + motherVariant;
            if (IsValidName(name) && name.Length == 3)
            {
                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = name,
                    NamingModel = "문소리모델",
                    NameType = "음운중심",
                    Description = $"아버지 성씨 '{fatherSurname}' + '{word}' + 어머니 성씨 변주 '{motherVariant}'"
                });
            }
        }

        return candidates;
    }

    /// <summary>
    /// 신해솜 모델: 스토리/가치관 키워드 기반
    /// 예: "신의 손" -> "해솜" (해: 해, 솜: 솜)
    /// </summary>
    private List<ParentBasedNameCandidate> ApplyShinHaeSomModel(
        string storyKeyword, string lastName, string gender, string tone)
    {
        var candidates = new List<ParentBasedNameCandidate>();

        // 키워드에서 의미 추출 및 한자 매핑
        var keywordMeanings = ExtractMeaningsFromKeyword(storyKeyword);

        var hanjaList = GetFilteredHanja(gender, tone);

        // 1. 기본: 키워드 의미와 관련된 한자 찾기
        foreach (var meaning in keywordMeanings)
        {
            var relatedHanja = hanjaList
                .Where(h => !string.IsNullOrEmpty(h.Meaning) &&
                           h.Meaning.Contains(meaning, StringComparison.OrdinalIgnoreCase))
                .Take(5)
                .ToList();

            foreach (var hanja1 in relatedHanja)
            {
                foreach (var hanja2 in relatedHanja.Where(h => h != hanja1).Take(3))
                {
                    var name = hanja1.Reading + hanja2.Reading;
                    if (IsValidName(name) && name.Length >= 2 && name.Length <= 3)
                    {
                        candidates.Add(new ParentBasedNameCandidate
                        {
                            Name = name,
                            NamingModel = "신해솜모델",
                            NameType = "의미중심",
                            Description = $"스토리 키워드 '{storyKeyword}'에서 추출한 의미 기반"
                        });
                    }
                }
            }
        }

        // 2. 키워드에서 직접 음절 추출 (예: "신의 손" -> "신", "의", "손")
        var syllables = ExtractSyllablesFromKeyword(storyKeyword);
        if (syllables.Count >= 2)
        {
            for (int i = 0; i < syllables.Count - 1; i++)
            {
                var name = syllables[i] + syllables[i + 1];
                if (IsValidName(name) && name.Length == 2)
                {
                    candidates.Add(new ParentBasedNameCandidate
                    {
                        Name = name,
                        NamingModel = "신해솜모델",
                        NameType = "의미중심",
                        Description = $"스토리 키워드에서 직접 추출"
                    });
                }
            }
        }

        // 3. 관용구 DB 기반: 키워드와 관련된 관용구에서 한자 추출
        var idiomCandidates = ApplyIdiomPattern(storyKeyword, hanjaList);
        candidates.AddRange(idiomCandidates);

        // 4. 성씨 포함 의미 패턴: "이사배" = 성씨+이름이 하나의 문장/의미
        var surnameStoryNameCandidates = ApplySurnameStoryPattern(storyKeyword, lastName, hanjaList);
        candidates.AddRange(surnameStoryNameCandidates);

        // 5. 거꾸로 의미 패턴: 키워드를 거꾸로 읽어도 의미가 되는 이름
        var reversedCandidates = ApplyReversedStoryPattern(storyKeyword);
        candidates.AddRange(reversedCandidates);

        return candidates;
    }

    /// <summary>
    /// 성씨 의미 자동 활용 신해솜모델: storyKeyword 없이 성씨 한자 뜻에서 자동으로 이름 생성
    /// 1) 성씨+이름=단어 패턴 DB에서 매칭
    /// 2) 성씨 의미 사전에서 관련 한자를 찾아 이름 조합
    /// 3) 성씨 한자 뜻 기반 자동 문장/구절 생성
    /// </summary>
    private List<ParentBasedNameCandidate> ApplySurnameAutoShinHaeSomModel(
        string lastName, string gender, string tone)
    {
        var candidates = new List<ParentBasedNameCandidate>();
        var hanjaList = GetFilteredHanja(gender, tone);

        // === 1단계: 성씨+이름=단어 패턴 DB에서 매칭 ===
        var matchingPatterns = SurnameWordPatterns
            .Where(p => p.Surname == lastName)
            .ToList();

        foreach (var pattern in matchingPatterns)
        {
            var givenName = pattern.GivenName;
            if (IsValidName(givenName) && givenName.Length >= 2 && givenName.Length <= 3)
            {
                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = givenName,
                    NamingModel = "신해솜모델",
                    NameType = "음운중심",
                    Description = $"성씨 '{lastName}' + 이름 '{givenName}' = '{pattern.CombinedWord}' ({pattern.Meaning})"
                });
            }

            // 패턴의 GivenName이 1글자인 경우, 한자와 조합하여 2글자 이름 생성
            if (givenName.Length == 1)
            {
                foreach (var hanja in hanjaList.Take(10))
                {
                    var name2a = givenName + hanja.Reading;
                    if (IsValidName(name2a) && name2a.Length == 2)
                    {
                        candidates.Add(new ParentBasedNameCandidate
                        {
                            Name = name2a,
                            NamingModel = "신해솜모델",
                            NameType = "의미중심",
                            Description = $"'{pattern.CombinedWord}'({pattern.Meaning})에서 영감 + 한자 '{hanja.Reading}'"
                        });
                    }

                    var name2b = hanja.Reading + givenName;
                    if (IsValidName(name2b) && name2b.Length == 2)
                    {
                        candidates.Add(new ParentBasedNameCandidate
                        {
                            Name = name2b,
                            NamingModel = "신해솜모델",
                            NameType = "의미중심",
                            Description = $"한자 '{hanja.Reading}' + '{pattern.CombinedWord}'({pattern.Meaning})에서 영감"
                        });
                    }
                }
            }
        }

        // === 2단계: 성씨 의미 사전에서 관련 한자 찾기 ===
        if (SurnameMeaningDictionary.TryGetValue(lastName, out var surnameMeanings))
        {
            foreach (var meaning in surnameMeanings)
            {
                var relatedHanja = hanjaList
                    .Where(h => !string.IsNullOrEmpty(h.Meaning) &&
                               h.Meaning.Contains(meaning, StringComparison.OrdinalIgnoreCase))
                    .Take(5)
                    .ToList();

                // 관련 한자 2개 조합
                foreach (var hanja1 in relatedHanja)
                {
                    foreach (var hanja2 in relatedHanja.Where(h => h != hanja1).Take(3))
                    {
                        var name = hanja1.Reading + hanja2.Reading;
                        if (IsValidName(name) && name.Length >= 2 && name.Length <= 3)
                        {
                            candidates.Add(new ParentBasedNameCandidate
                            {
                                Name = name,
                                NamingModel = "신해솜모델",
                                NameType = "의미중심",
                                Description = $"성씨 '{lastName}'의 뜻 '{meaning}'에서 연상된 이름"
                            });
                        }
                    }
                }

                // 관련 한자 1개 + 일반 한자 조합
                foreach (var hanja1 in relatedHanja.Take(3))
                {
                    foreach (var hanja2 in hanjaList.Where(h => h != hanja1).Take(5))
                    {
                        var name = hanja1.Reading + hanja2.Reading;
                        if (IsValidName(name) && name.Length == 2)
                        {
                            candidates.Add(new ParentBasedNameCandidate
                            {
                                Name = name,
                                NamingModel = "신해솜모델",
                                NameType = "의미중심",
                                Description = $"성씨 '{lastName}'의 뜻 '{meaning}' 연상 + 조화 한자"
                            });
                        }
                    }
                }
            }
        }

        // === 3단계: 성씨 한자 정보에서 직접 의미 기반 이름 생성 ===
        var surnameHanja = HanjaData.FindByReading(lastName);
        foreach (var sh in surnameHanja.Take(2))
        {
            if (string.IsNullOrEmpty(sh.Meaning)) continue;

            // 성씨 한자의 의미 키워드로 관련 한자 찾기
            var meaningWords = sh.Meaning.Split(new[] { ' ', ',', '/', '·' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var word in meaningWords.Take(2))
            {
                var relatedHanja = hanjaList
                    .Where(h => !string.IsNullOrEmpty(h.Meaning) &&
                               h.Meaning.Contains(word, StringComparison.OrdinalIgnoreCase))
                    .Take(3)
                    .ToList();

                foreach (var h1 in relatedHanja)
                {
                    foreach (var h2 in relatedHanja.Where(h => h != h1).Take(2))
                    {
                        var name = h1.Reading + h2.Reading;
                        if (IsValidName(name) && name.Length >= 2 && name.Length <= 3)
                        {
                            candidates.Add(new ParentBasedNameCandidate
                            {
                                Name = name,
                                NamingModel = "신해솜모델",
                                NameType = "의미중심",
                                Description = $"성씨 '{lastName}'({sh.Meaning})의 한자 의미에서 자동 생성"
                            });
                        }
                    }
                }
            }
        }

        // 성씨 자동 활용 모델은 최대 15개까지만 반환 (다른 모델 공간 확보)
        return candidates
            .GroupBy(c => c.Name)
            .Select(g => g.First())
            .Take(15)
            .ToList();
    }

    /// <summary>
    /// 관용구/사자성어 DB에서 키워드 관련 한자를 찾아 이름 생성
    /// </summary>
    private List<ParentBasedNameCandidate> ApplyIdiomPattern(
        string storyKeyword, List<HanjaData.HanjaInfo> hanjaList)
    {
        var candidates = new List<ParentBasedNameCandidate>();
        var idiomEntries = IdiomKeywordLoader.FindByKeyword(storyKeyword);

        foreach (var entry in idiomEntries.Take(5))
        {
            // 관용구의 의미 키워드로 한자 검색
            foreach (var meaning in entry.Meanings)
            {
                var relatedHanja = hanjaList
                    .Where(h => !string.IsNullOrEmpty(h.Meaning) &&
                               h.Meaning.Contains(meaning, StringComparison.OrdinalIgnoreCase))
                    .Take(3)
                    .ToList();

                foreach (var hanja in relatedHanja)
                {
                    // 관용구 키워드의 다른 한자와 조합
                    foreach (var otherMeaning in entry.Meanings.Where(m => m != meaning))
                    {
                        var otherHanja = hanjaList
                            .Where(h => !string.IsNullOrEmpty(h.Meaning) &&
                                       h.Meaning.Contains(otherMeaning, StringComparison.OrdinalIgnoreCase))
                            .FirstOrDefault();

                        if (otherHanja != null)
                        {
                            var name = hanja.Reading + otherHanja.Reading;
                            if (IsValidName(name) && name.Length >= 2 && name.Length <= 3)
                            {
                                candidates.Add(new ParentBasedNameCandidate
                                {
                                    Name = name,
                                    NamingModel = "신해솜모델",
                                    NameType = "의미중심",
                                    Description = $"관용구 '{entry.Idiom}'에서 영감을 받은 이름"
                                });
                            }
                        }
                    }
                }
            }
        }

        return candidates;
    }

    /// <summary>
    /// 성씨를 의미에 포함시키는 음운 유희 패턴
    /// 예: 성씨 "이" + 키워드 "사배" = "이사배" (성씨+이름이 하나의 의미)
    /// 예: 성씨 "신" + 키워드 "신의 손" = "신해솜" (신+해솜 = 신의 손 연상)
    /// </summary>
    private List<ParentBasedNameCandidate> ApplySurnameStoryPattern(
        string storyKeyword, string lastName, List<HanjaData.HanjaInfo> hanjaList)
    {
        var candidates = new List<ParentBasedNameCandidate>();

        // 성씨가 키워드에 포함되어 있으면, 성씨 이후 부분으로 이름 구성
        if (storyKeyword.Contains(lastName))
        {
            // 키워드에서 성씨 제거 후 나머지 음절로 이름 구성
            var afterSurname = storyKeyword.Replace(lastName, "").Trim();
            var syllables = ExtractSyllablesFromKeyword(afterSurname);

            if (syllables.Count >= 2)
            {
                var name = string.Join("", syllables.Take(2));
                if (IsValidName(name))
                {
                    candidates.Add(new ParentBasedNameCandidate
                    {
                        Name = name,
                        NamingModel = "신해솜모델",
                        NameType = "음운중심",
                        Description = $"성씨 '{lastName}' + 이름 '{name}'{KoreanUtils.IGa(name)} 합쳐져 '{storyKeyword}' 연상"
                    });
                }
            }

            if (syllables.Count >= 3)
            {
                var name3 = string.Join("", syllables.Take(3));
                if (IsValidName(name3))
                {
                    candidates.Add(new ParentBasedNameCandidate
                    {
                        Name = name3,
                        NamingModel = "신해솜모델",
                        NameType = "음운중심",
                        Description = $"성씨 '{lastName}' + 이름 '{name3}'{KoreanUtils.IGa(name3)} 합쳐져 '{storyKeyword}' 연상"
                    });
                }
            }
        }

        // 성씨의 의미를 키워드와 연결하여 이름 생성
        var surnameHanja = HanjaData.FindByReading(lastName);
        foreach (var sh in surnameHanja.Take(3))
        {
            if (string.IsNullOrEmpty(sh.Meaning)) continue;

            // 성씨 의미와 키워드를 조합하여 의미가 연결되는 한자 찾기
            var relatedHanja = hanjaList
                .Where(h => !string.IsNullOrEmpty(h.Meaning) &&
                           (storyKeyword.Any(c => h.Reading.Contains(c)) ||
                            h.Meaning.Contains(sh.Meaning.Split(' ').First(), StringComparison.OrdinalIgnoreCase)))
                .Take(5)
                .ToList();

            foreach (var hanja1 in relatedHanja)
            {
                foreach (var hanja2 in relatedHanja.Where(h => h != hanja1).Take(2))
                {
                    var name = hanja1.Reading + hanja2.Reading;
                    if (IsValidName(name) && name.Length >= 2 && name.Length <= 3)
                    {
                        candidates.Add(new ParentBasedNameCandidate
                        {
                            Name = name,
                            NamingModel = "신해솜모델",
                            NameType = "의미중심",
                            Description = $"성씨 '{lastName}'의 의미와 '{storyKeyword}'{KoreanUtils.EulReul(storyKeyword)} 연결한 이름"
                        });
                    }
                }
            }
        }

        return candidates;
    }

    /// <summary>
    /// 키워드를 거꾸로 읽어서도 의미가 통하는 이름 생성
    /// </summary>
    private List<ParentBasedNameCandidate> ApplyReversedStoryPattern(string storyKeyword)
    {
        var candidates = new List<ParentBasedNameCandidate>();
        var syllables = ExtractSyllablesFromKeyword(storyKeyword);

        if (syllables.Count >= 2)
        {
            // 음절 순서 뒤집기
            var reversed = syllables.AsEnumerable().Reverse().ToList();
            for (int i = 0; i < reversed.Count - 1; i++)
            {
                var name = reversed[i] + reversed[i + 1];
                if (IsValidName(name) && name.Length == 2)
                {
                    candidates.Add(new ParentBasedNameCandidate
                    {
                        Name = name,
                        NamingModel = "신해솜모델",
                        NameType = "음운중심",
                        Description = $"스토리 키워드 '{storyKeyword}'의 역순 조합"
                    });
                }
            }

            // 3음절 역순
            if (reversed.Count >= 3)
            {
                var name3 = reversed[0] + reversed[1] + reversed[2];
                if (IsValidName(name3))
                {
                    candidates.Add(new ParentBasedNameCandidate
                    {
                        Name = name3,
                        NamingModel = "신해솜모델",
                        NameType = "음운중심",
                        Description = $"스토리 키워드 '{storyKeyword}'의 역순 3음절 조합"
                    });
                }
            }
        }

        return candidates;
    }

    /// <summary>
    /// 이수지-박지수 모델: 부모 이름 글자 순서 반전/재조합
    /// NameReversalEngine에 위임하여 다양한 변형 생성
    /// </summary>
    private async Task<List<ParentBasedNameCandidate>> ApplyMirrorModelAsync(
        string? fatherName, string? motherName, string gender, string tone)
    {
        var candidates = new List<ParentBasedNameCandidate>();

        // 아버지 이름 변형
        if (!string.IsNullOrEmpty(fatherName) && fatherName.Length >= 2)
        {
            var variants = await _nameReversalEngine.GenerateVariantsAsync(fatherName);
            foreach (var variant in variants)
            {
                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = variant.Name,
                    NamingModel = "이수지-박지수모델",
                    NameType = DetermineNameType(variant.Name),
                    Description = $"아버지 이름 {variant.Description}"
                });
            }
        }

        // 어머니 이름 변형
        if (!string.IsNullOrEmpty(motherName) && motherName.Length >= 2)
        {
            var variants = await _nameReversalEngine.GenerateVariantsAsync(motherName);
            foreach (var variant in variants)
            {
                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = variant.Name,
                    NamingModel = "이수지-박지수모델",
                    NameType = DetermineNameType(variant.Name),
                    Description = $"어머니 이름 {variant.Description}"
                });
            }
        }

        // 부모 이름 합쳐서 재조합
        if (!string.IsNullOrEmpty(fatherName) && !string.IsNullOrEmpty(motherName))
        {
            var combined = fatherName + motherName;
            var variants = await _nameReversalEngine.GenerateVariantsAsync(combined);
            foreach (var variant in variants.Take(10))
            {
                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = variant.Name,
                    NamingModel = "이수지-박지수모델",
                    NameType = DetermineNameType(variant.Name),
                    Description = $"부모 이름 '{fatherName}' + '{motherName}' {variant.VariationType}"
                });
            }
        }

        return candidates;
    }

    /// <summary>
    /// 복합 모델: 여러 모델 조합
    /// </summary>
    private List<ParentBasedNameCandidate> ApplyCompositeModel(
        string? fatherSurname, string? fatherName,
        string? motherSurname, string? motherName,
        string gender, string tone)
    {
        var candidates = new List<ParentBasedNameCandidate>();

        // 아버지 이름 첫 글자 + 어머니 이름 첫 글자
        if (!string.IsNullOrEmpty(fatherName) && !string.IsNullOrEmpty(motherName) &&
            fatherName.Length > 0 && motherName.Length > 0)
        {
            var name = fatherName[0].ToString() + motherName[0].ToString();
            if (IsValidName(name) && name.Length == 2)
            {
                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = name,
                    NamingModel = "복합모델",
                    NameType = DetermineNameType(name),
                    Description = $"아버지 이름 첫 글자 + 어머니 이름 첫 글자"
                });
            }
        }

        // 아버지 성씨 + 어머니 이름 첫 글자 + 한자
        if (!string.IsNullOrEmpty(fatherSurname) && !string.IsNullOrEmpty(motherName) &&
            motherName.Length > 0)
        {
            var hanjaList = GetFilteredHanja(gender, tone);
            foreach (var hanja in hanjaList.Take(5))
            {
                var name = fatherSurname + motherName[0].ToString() + hanja.Reading;
                if (IsValidName(name) && name.Length >= 3 && name.Length <= 4)
                {
                    if (name.Length == 4 && !ValidateRhythm(name))
                        continue;

                    candidates.Add(new ParentBasedNameCandidate
                    {
                        Name = name,
                        NamingModel = "복합모델",
                        NameType = DetermineNameType(name),
                        Description = $"아버지 성씨 + 어머니 이름 첫 글자 + 한자"
                    });
                }
            }
        }

        return candidates;
    }

    /// <summary>
    /// 이름 타입 결정 (의미중심 vs 음운중심)
    /// </summary>
    private string DetermineNameType(string name)
    {
        // 한자 의미가 강한 경우 "의미중심"
        var hanjaInfo = HanjaData.FindByReading(name);
        if (hanjaInfo.Any(h => !string.IsNullOrEmpty(h.Meaning) && 
                              (h.Category == "자연" || h.Category == "덕목" || h.Category == "개념")))
        {
            return "의미중심";
        }

        // 음운 변주가 있는 경우 "음운중심"
        if (name.Length >= 3 && HasPhoneticVariation(name))
        {
            return "음운중심";
        }

        // 기본값: 의미중심
        return "의미중심";
    }

    /// <summary>
    /// 음운 변주가 있는지 확인
    /// </summary>
    private bool HasPhoneticVariation(string name)
    {
        var variants = new[] { "리", "라", "로", "류", "림" };
        return variants.Any(v => name.Contains(v));
    }

    /// <summary>
    /// 유효한 이름인지 확인
    /// </summary>
    private bool IsValidName(string name)
    {
        if (string.IsNullOrEmpty(name) || name.Length < 2)
            return false;

        // 금칙어 체크
        var forbiddenWords = new[] { "바보", "멍청", "못난", "나쁜", "악", "흉", "죽", "병" };
        if (forbiddenWords.Any(f => name.Contains(f)))
            return false;

        // 한글만 허용
        return name.All(c => c >= 0xAC00 && c <= 0xD7A3);
    }

    /// <summary>
    /// 리듬감 검증 (4음절인 경우)
    /// </summary>
    private bool ValidateRhythm(string name)
    {
        if (name.Length != 4)
            return true;

        // 4음절 이름의 리듬감 평가
        var rhythmScore = KoreanUtils.EvaluateRhythm(name);
        return rhythmScore >= 60; // 60점 이상이면 허용
    }

    /// <summary>
    /// 성별/톤에 맞는 한자 필터링
    /// </summary>
    private List<HanjaData.HanjaInfo> GetFilteredHanja(string gender, string tone)
    {
        var hanjaList = HanjaData.HanjaDictionary.Values.ToList();

        // 성별 필터링
        if (gender != "none")
        {
            hanjaList = hanjaList.Where(h =>
            {
                if (gender == "male")
                    return h.GenderPref != HanjaData.GenderPreference.Female;
                if (gender == "female")
                    return h.GenderPref != HanjaData.GenderPreference.Male;
                return true;
            }).ToList();
        }

        // 톤 필터링
        if (tone != "neutral")
        {
            hanjaList = hanjaList.Where(h =>
            {
                if (tone == "soft")
                    return h.TonePref != HanjaData.TonePreference.Strong;
                if (tone == "strong")
                    return h.TonePref != HanjaData.TonePreference.Soft;
                return true;
            }).ToList();
        }

        return hanjaList;
    }

    /// <summary>
    /// 키워드에서 의미 추출
    /// </summary>
    private List<string> ExtractMeaningsFromKeyword(string keyword)
    {
        var meanings = new List<string>();
        
        // 간단한 키워드 매핑
        var keywordMap = new Dictionary<string, List<string>>
        {
            { "신", new List<string> { "신", "신성", "신비" } },
            { "손", new List<string> { "손", "재능", "기술" } },
            { "예술", new List<string> { "예술", "아름다움", "창조" } },
            { "지혜", new List<string> { "지혜", "지식", "명석" } },
            { "용기", new List<string> { "용기", "용맹", "강함" } },
            { "사랑", new List<string> { "사랑", "인자", "자비" } }
        };

        foreach (var kvp in keywordMap)
        {
            if (keyword.Contains(kvp.Key, StringComparison.OrdinalIgnoreCase))
            {
                meanings.AddRange(kvp.Value);
            }
        }

        // 키워드가 없으면 기본 의미 반환
        if (meanings.Count == 0)
        {
            meanings.AddRange(new[] { "아름다움", "지혜", "용기", "사랑" });
        }

        return meanings;
    }

    /// <summary>
    /// 키워드에서 음절 추출
    /// </summary>
    private List<string> ExtractSyllablesFromKeyword(string keyword)
    {
        var syllables = new List<string>();
        
        // 한글 음절만 추출
        foreach (char c in keyword)
        {
            if (c >= 0xAC00 && c <= 0xD7A3)
            {
                syllables.Add(c.ToString());
            }
        }

        return syllables;
    }

    /// <summary>
    /// Anagram 생성 (글자 재조합)
    /// </summary>
    private List<string> GenerateAnagrams(string text, int minLength, int maxLength)
    {
        var anagrams = new List<string>();
        var chars = text.ToCharArray();

        // 간단한 조합 생성 (실제로는 더 정교한 로직 필요)
        if (chars.Length >= minLength)
        {
            // 첫 글자 + 나머지 조합
            for (int i = 0; i < chars.Length; i++)
            {
                for (int j = i + 1; j < chars.Length && j - i + 1 <= maxLength; j++)
                {
                    var combination = new string(chars.Skip(i).Take(j - i + 1).ToArray());
                    if (combination.Length >= minLength && combination.Length <= maxLength)
                    {
                        anagrams.Add(combination);
                    }
                }
            }
        }

        return anagrams.Distinct().ToList();
    }

    /// <summary>
    /// 의미 융합 서사 적용
    /// </summary>
    private List<ParentBasedNameCandidate> ApplyMeaningFusionNarrative(
        FamilyNarrativeExtractor.FamilyNarrative narrative,
        string gender,
        string tone)
    {
        var candidates = new List<ParentBasedNameCandidate>();

        if (narrative.RecommendedHanja.Count == 0)
            return candidates;

        var hanjaList = GetFilteredHanja(gender, tone);

        // 추천 한자 조합 사용
        foreach (var recommended in narrative.RecommendedHanja.Take(10))
        {
            if (IsValidName(recommended) && recommended.Length >= 2 && recommended.Length <= 3)
            {
                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = recommended,
                    NamingModel = "의미융합서사",
                    NameType = "의미중심",
                    Description = narrative.NarrativeDescription
                });
            }
        }

        // 서사 테마 기반 추가 조합 생성
        if (narrative.CoreValues.Any())
        {
            var themeHanja = hanjaList
                .Where(h => narrative.CoreValues.Any(v => 
                    !string.IsNullOrEmpty(h.Meaning) && h.Meaning.Contains(v)))
                .Take(5)
                .ToList();

            foreach (var h1 in themeHanja)
            {
                foreach (var h2 in themeHanja.Where(h => h != h1).Take(3))
                {
                    var name = h1.Reading + h2.Reading;
                    if (IsValidName(name) && name.Length == 2)
                    {
                        var coreValues = string.Join(", ", narrative.CoreValues.Take(2));
                        candidates.Add(new ParentBasedNameCandidate
                        {
                            Name = name,
                            NamingModel = "의미융합서사",
                            NameType = "의미중심",
                            Description = $"가족의 가치관 '{coreValues}'{KoreanUtils.EulReul(coreValues)} 담은 이름"
                        });
                    }
                }
            }
        }

        return candidates;
    }

    /// <summary>
    /// 음운 유전 서사 적용
    /// </summary>
    private List<ParentBasedNameCandidate> ApplyPhoneticInheritanceNarrative(
        FamilyNarrativeExtractor.FamilyNarrative narrative,
        string gender,
        string tone)
    {
        var candidates = new List<ParentBasedNameCandidate>();

        if (narrative.RecommendedHanja.Count == 0)
            return candidates;

        // 추천 음운 조합 사용
        foreach (var recommended in narrative.RecommendedHanja.Take(10))
        {
            if (IsValidName(recommended) && recommended.Length >= 2 && recommended.Length <= 3)
            {
                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = recommended,
                    NamingModel = "음운유전서사",
                    NameType = "음운중심",
                    Description = narrative.NarrativeDescription
                });
            }
        }

        // 공통 음운 특성 기반 조합 생성
        var hanjaList = GetFilteredHanja(gender, tone);
        var commonInitials = narrative.CoreValues
            .Where(v => v.Contains("공통 초성"))
            .SelectMany(v => v.Split(':').Skip(1).SelectMany(s => s.Split(',').Select(x => x.Trim())))
            .Where(s => !string.IsNullOrEmpty(s))
            .ToList();

        if (commonInitials.Any())
        {
            // 공통 초성을 가진 한자 찾기
            var matchingHanja = hanjaList
                .Where(h => commonInitials.Any(ci => h.Consonant == ci || h.Reading.StartsWith(ci)))
                .Take(10)
                .ToList();

            foreach (var h1 in matchingHanja.Take(5))
            {
                foreach (var h2 in matchingHanja.Where(h => h != h1).Take(3))
                {
                    var name = h1.Reading + h2.Reading;
                    if (IsValidName(name) && name.Length == 2)
                    {
                        candidates.Add(new ParentBasedNameCandidate
                        {
                            Name = name,
                            NamingModel = "음운유전서사",
                            NameType = "음운중심",
                            Description = $"부모님의 음운 특성을 이어받은 이름"
                        });
                    }
                }
            }
        }

        return candidates;
    }

    /// <summary>
    /// 세대 연결 서사 적용
    /// </summary>
    private List<ParentBasedNameCandidate> ApplyGenerationalBridgeNarrative(
        FamilyNarrativeExtractor.FamilyNarrative narrative,
        string gender,
        string tone)
    {
        var candidates = new List<ParentBasedNameCandidate>();

        if (narrative.RecommendedHanja.Count == 0)
            return candidates;

        // 추천 세대 조합 사용
        foreach (var recommended in narrative.RecommendedHanja.Take(10))
        {
            if (IsValidName(recommended) && recommended.Length >= 2 && recommended.Length <= 3)
            {
                candidates.Add(new ParentBasedNameCandidate
                {
                    Name = recommended,
                    NamingModel = "세대연결서사",
                    NameType = DetermineNameType(recommended),
                    Description = narrative.NarrativeDescription
                });
            }
        }

        // 세대 테마 기반 조합 생성
        var hanjaList = GetFilteredHanja(gender, tone);
        var modernHanja = hanjaList
            .Where(h => h.Category == "개념" || h.Category == "자연")
            .Take(10)
            .ToList();

        var traditionalHanja = hanjaList
            .Where(h => h.Category == "덕목")
            .Take(10)
            .ToList();

        // 전통과 현대의 조화
        foreach (var trad in traditionalHanja.Take(5))
        {
            foreach (var modern in modernHanja.Take(5))
            {
                var name1 = trad.Reading + modern.Reading;
                var name2 = modern.Reading + trad.Reading;

                foreach (var name in new[] { name1, name2 })
                {
                    if (IsValidName(name) && name.Length == 2)
                    {
                        candidates.Add(new ParentBasedNameCandidate
                        {
                            Name = name,
                            NamingModel = "세대연결서사",
                            NameType = DetermineNameType(name),
                            Description = $"세대를 넘나드는 조화로운 이름"
                        });
                    }
                }
            }
        }

        return candidates;
    }
}
