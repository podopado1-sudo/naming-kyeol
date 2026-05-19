using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines;

/// <summary>
/// 톤별 선호 발음 패턴
/// </summary>
public class ToneProfile
{
    public char[] PreferredVowels { get; set; } = Array.Empty<char>();
    public char[] PreferredConsonants { get; set; } = Array.Empty<char>();
    public char[] PenaltyConsonants { get; set; } = Array.Empty<char>();
    public int BonusPoints { get; set; }
}

/// <summary>
/// 미학 점수 계산 엔진 (실제 구현)
/// 발음 리듬, 받침, 세대 중립성, 의미 평가
/// gender/tone 실반영 + breakdown 지원
/// </summary>
public class AestheticEngine : IAestheticEngine
{
    private readonly NegativePatternLoader.NegativePatternData _negativePatterns;

    // === 톤 프로파일 ===
    private static readonly Dictionary<string, ToneProfile> ToneProfiles = new()
    {
        ["soft"] = new ToneProfile
        {
            PreferredVowels = new[] { 'ㅏ', 'ㅗ', 'ㅜ', 'ㅡ' },
            PreferredConsonants = new[] { 'ㄴ', 'ㄹ', 'ㅁ' },
            PenaltyConsonants = new[] { 'ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ' },
            BonusPoints = 8
        },
        ["strong"] = new ToneProfile
        {
            PreferredConsonants = new[] { 'ㄱ', 'ㄷ', 'ㅂ', 'ㅈ' },
            PenaltyConsonants = Array.Empty<char>(),
            BonusPoints = 8
        },
        ["neutral"] = new ToneProfile { BonusPoints = 0 }
    };

    // 유행 이름 패턴 (감점) — 2020~2025 통계청 기준 확장
    private readonly HashSet<string> _trendyNames = new()
    {
        // 기존 14개
        "서준", "민준", "하준", "지호", "준서", "도윤", "예준",
        "서연", "하은", "지은", "채원", "지유", "서윤", "예은",
        // 남아 추가 20개
        "건우", "시우", "지한", "주원", "도현", "준우", "은우",
        "수호", "민서", "예성", "유찬", "태양", "지율", "한율",
        "시윤", "우진", "준혁", "현우", "승우", "이준",
        // 여아 추가 20개
        "서은", "하린", "수아", "지아", "다은", "아린", "소율",
        "서영", "예린", "유나", "소은", "나윤", "이윤", "시은",
        "서하", "하율", "지윤", "하윤", "서아", "지우"
    };

    // 과도한 소망 표현 (감점)
    private readonly HashSet<string> _excessiveWishWords = new()
    {
        "복", "부", "귀", "남", "재", "성", "대", "왕"
    };

    // 생활어 충돌 단어
    private readonly HashSet<string> _collisionWords = new()
    {
        "사과", "바나나", "자동차", "방석", "방과", "의자", "책상"
    };

    public AestheticEngine()
    {
        _negativePatterns = NegativePatternLoader.Data;
    }

    /// <summary>
    /// 기본 점수 계산 (하위 호환성 — tone만)
    /// </summary>
    public async Task<int> CalculateScoreAsync(string name, string tone)
    {
        return await CalculateScoreAsync(name, null, tone);
    }

    /// <summary>
    /// 전체 이름(성+이름)을 고려한 점수 계산 (하위 호환 — gender 없이)
    /// </summary>
    public async Task<int> CalculateScoreAsync(string firstName, string? lastName, string tone)
    {
        var breakdown = await CalculateScoreWithBreakdownAsync(firstName, lastName, tone, "none");
        return breakdown.TotalScore;
    }

    /// <summary>
    /// gender 포함 점수 계산 — breakdown 경로와 동일한 결과를 보장.
    /// </summary>
    public async Task<int> CalculateScoreAsync(string firstName, string? lastName, string tone, string gender)
    {
        var breakdown = await CalculateScoreWithBreakdownAsync(firstName, lastName, tone, gender);
        return breakdown.TotalScore;
    }

    /// <summary>
    /// gender/tone 반영 + 세부 breakdown 포함 점수 계산
    /// </summary>
    public async Task<AestheticBreakdown> CalculateScoreWithBreakdownAsync(
        string firstName, string? lastName, string tone, string gender)
    {
        return await CalculateScoreWithBreakdownAsync(firstName, lastName, tone, gender, null);
    }

    /// <summary>
    /// gender/tone 반영 + 세부 breakdown + 세대 적합도 포함 점수 계산
    /// birthYear가 제공되면 세대 불일치 감지 로직 활성화
    /// </summary>
    public async Task<AestheticBreakdown> CalculateScoreWithBreakdownAsync(
        string firstName, string? lastName, string tone, string gender, int? birthYear)
    {
        string name = firstName;
        var breakdown = new AestheticBreakdown();

        // 1. 발음 난이도 평가 (30점)
        int pronunciationRaw = KoreanUtils.EvaluatePronunciationDifficulty(name);
        breakdown.PronunciationScore = (int)(pronunciationRaw * 0.3);

        // 2. 리듬 평가 (25점)
        int rhythmRaw = KoreanUtils.EvaluateRhythm(name);
        breakdown.RhythmScore = (int)(rhythmRaw * 0.25);

        // 2-1. 부정적 음절 패턴 체크
        int negativeSyllablePenalty = EvaluateNegativeSyllablePatterns(name);

        // 3. 음절 길이 평가 (15점)
        int lengthRaw = KoreanUtils.EvaluateLength(name);
        breakdown.SyllableScore = (int)(lengthRaw * 0.15);

        // 4. 세대 중립성 평가 (15점)
        int neutralityRaw = EvaluateGenerationalNeutrality(name);
        breakdown.NeutralityScore = (int)(neutralityRaw * 0.15);

        // 4-1. 세대 적합도 보정 (birthYear가 제공된 경우)
        if (birthYear.HasValue)
        {
            var generationFit = GenerationNameData.AnalyzeGenerationFit(name, birthYear.Value);
            breakdown.GenerationFit = generationFit;

            switch (generationFit.FitLevel)
            {
                case "timeless":
                    // 시대무관 이름: 보너스 +3
                    breakdown.NeutralityScore = Math.Min(15, breakdown.NeutralityScore + 3);
                    breakdown.Notes.Add("시대를 초월한 이름");
                    break;
                case "perfect":
                    // 세대 일치: 변동 없음
                    break;
                case "mild_mismatch":
                    // 약한 불일치 (10년 이내): -2
                    breakdown.NeutralityScore = Math.Max(0, breakdown.NeutralityScore - 2);
                    breakdown.Notes.Add($"세대 약한 불일치 ({generationFit.PeakDecade} 유행)");
                    break;
                case "strong_mismatch":
                    // 강한 불일치 (20년 이상): -5
                    breakdown.NeutralityScore = Math.Max(0, breakdown.NeutralityScore - 5);
                    breakdown.Notes.Add($"세대 강한 불일치 ({generationFit.PeakDecade} 유행)");
                    break;
                // "unknown": 변동 없음
            }
        }

        // 5. 의미 평가 (10점)
        int meaningRaw = EvaluateMeaning(name, tone);
        breakdown.MeaningScore = (int)(meaningRaw * 0.10);

        // 6. 톤 보너스 (발음 패턴 기반)
        breakdown.ToneBonus = EvaluateToneBonus(name, tone, breakdown.Notes);

        // 7. gender 보너스 (한자 GenderPref 일치도)
        breakdown.GenderBonus = EvaluateGenderBonus(name, gender, breakdown.Notes);

        // 감점 합산
        int penaltyTotal = negativeSyllablePenalty;

        // 생활어 충돌 (5점)
        if (IsCollisionWithCommonWord(name))
        {
            penaltyTotal += 5;
            breakdown.Notes.Add("생활어와 충돌");
        }

        // 유행 이름 감점 (5점 — NeutralityScore에서 이미 세대중립성 감점이 반영되므로 이중 처벌 방지)
        if (_trendyNames.Contains(name))
        {
            penaltyTotal += 5;
            breakdown.Notes.Add("유행 이름 감점");
        }

        // 전체 이름(성+이름) 평가
        int fullNamePenalty = 0;
        int surnameBonus = 0;
        if (!string.IsNullOrEmpty(lastName))
        {
            fullNamePenalty = EvaluateFullNamePatterns(lastName + name);
            penaltyTotal += fullNamePenalty;

            surnameBonus = EvaluateUnusualSurnameRhythm(lastName, name);
        }

        breakdown.PenaltyTotal = penaltyTotal;

        // 최종 합산
        int total = breakdown.PronunciationScore
                  + breakdown.RhythmScore
                  + breakdown.SyllableScore
                  + breakdown.NeutralityScore
                  + breakdown.MeaningScore
                  + breakdown.ToneBonus
                  + breakdown.GenderBonus
                  + surnameBonus
                  - penaltyTotal;

        breakdown.TotalScore = Math.Max(0, Math.Min(100, total));

        return await Task.FromResult(breakdown);
    }

    // ========== 톤 평가 (발음 패턴 기반) ==========

    /// <summary>
    /// 이름의 자모 구성이 톤 프로파일과 얼마나 맞는지 평가
    /// </summary>
    private int EvaluateToneBonus(string name, string tone, List<string> notes)
    {
        if (!ToneProfiles.TryGetValue(tone, out var profile) || profile.BonusPoints == 0)
            return 0;

        int bonus = 0;
        int matchCount = 0;
        int penaltyCount = 0;

        foreach (char c in name)
        {
            var (initial, vowel, _) = KoreanUtils.Decompose(c);
            if (string.IsNullOrEmpty(initial)) continue;

            char initChar = initial[0];
            char vowelChar = vowel.Length > 0 ? vowel[0] : '\0';

            // 선호 자음 매칭
            if (profile.PreferredConsonants.Length > 0 && profile.PreferredConsonants.Contains(initChar))
                matchCount++;

            // 선호 모음 매칭
            if (profile.PreferredVowels.Length > 0 && profile.PreferredVowels.Contains(vowelChar))
                matchCount++;

            // 페널티 자음
            if (profile.PenaltyConsonants.Length > 0 && profile.PenaltyConsonants.Contains(initChar))
                penaltyCount++;
        }

        int syllableCount = Math.Max(1, name.Length);

        if (matchCount >= syllableCount)
        {
            bonus = profile.BonusPoints;
            notes.Add($"{tone} 톤에 잘 어울리는 발음 구성");
        }
        else if (matchCount > 0)
        {
            bonus = profile.BonusPoints / 2;
        }

        if (penaltyCount > 0)
        {
            int penaltyAmount = Math.Min(profile.BonusPoints, penaltyCount * 4);
            bonus -= penaltyAmount;
            if (tone == "soft")
                notes.Add("된소리가 포함되어 부드러운 톤과 맞지 않음");
        }

        return Math.Max(-profile.BonusPoints, Math.Min(profile.BonusPoints, bonus));
    }

    // ========== gender 평가 (한자 GenderPref 일치도) ==========

    /// <summary>
    /// 한자 GenderPref와 요청 gender의 일치도 평가
    /// 편견 방지: 발음 자체는 평가하지 않고 한자 메타데이터만 사용
    /// </summary>
    private int EvaluateGenderBonus(string name, string gender, List<string> notes)
    {
        if (string.IsNullOrEmpty(gender) || gender == "none" || gender == "neutral")
            return 0;

        var hanjaInfo = GetHanjaInfo(name);
        if (hanjaInfo == null || !hanjaInfo.Any())
            return 0;

        var targetPref = gender switch
        {
            "male" => HanjaData.GenderPreference.Male,
            "female" => HanjaData.GenderPreference.Female,
            _ => HanjaData.GenderPreference.Neutral
        };

        if (targetPref == HanjaData.GenderPreference.Neutral)
            return 0;

        var oppositePref = targetPref == HanjaData.GenderPreference.Male
            ? HanjaData.GenderPreference.Female
            : HanjaData.GenderPreference.Male;

        int matchCount = 0;
        int mismatchCount = 0;

        // 음절별 대표 한자의 GenderPref 확인
        foreach (char c in name)
        {
            var hanjaList = HanjaData.FindByReading(c.ToString());
            if (!hanjaList.Any()) continue;

            // 해당 음절의 한자 중 가장 일반적인 GenderPref 판단
            bool hasMatch = hanjaList.Any(h => h.GenderPref == targetPref);
            bool hasMismatch = hanjaList.Any(h => h.GenderPref == oppositePref);

            if (hasMatch) matchCount++;
            if (hasMismatch && !hasMatch) mismatchCount++;
        }

        int bonus = 0;
        if (matchCount > 0)
        {
            bonus = Math.Min(5, matchCount * 3);
            notes.Add($"한자 성별 선호도가 {gender}와 잘 맞음");
        }
        if (mismatchCount > 0)
        {
            bonus -= Math.Min(5, mismatchCount * 2);
            notes.Add($"일부 한자의 성별 선호도가 {gender}와 맞지 않음");
        }

        return Math.Max(-5, Math.Min(5, bonus));
    }

    // ========== 세대 중립성 (5단계 세분화) ==========

    // 매우 흔한 이름 (통계청 TOP — RarityScoringEngine.VeryCommonNames와 동일)
    private static readonly HashSet<string> _veryCommonNames = new()
    {
        "서준", "도윤", "시우", "하준", "민준", "주원", "지호",
        "예준", "도현", "시윤", "은우", "수호", "유준", "준우",
        "지한", "승우", "우진", "준서", "승현", "태양", "예성",
        "이안", "준호", "민수", "준영", "지훈",
        "서윤", "서아", "하은", "하린", "수아", "지아",
        "아린", "지유", "서은", "채원", "예린", "유나", "소은",
        "나윤", "이윤", "시은", "서하", "하율", "민서", "지윤", "하윤",
        "지안", "서연", "지은", "예은", "윤서"
    };

    // 흔한 이름 (통계청 인기 300+ — RarityScoringEngine.CommonNames와 동일)
    private static readonly HashSet<string> _commonNames = new()
    {
        "건", "건우", "건호", "건희", "경민", "경준", "광현", "규민", "규빈",
        "규원", "규진", "규현", "기범", "기현", "나율", "도겸", "도건", "도현",
        "도윤", "도훈", "동건", "동현", "동훈", "래원", "래현", "로운", "리안",
        "리우", "리준", "민건", "민결", "민규", "민기", "민서", "민성", "민수",
        "민식", "민재", "민준", "민찬", "민철", "민혁", "민호", "민환", "범준",
        "범진", "보겸", "상민", "상우", "상현", "상호", "서연", "서우", "서원",
        "서준", "서진", "서현", "석현", "선우", "선호", "성민", "성빈", "성수",
        "성우", "성윤", "성준", "성현", "성호", "세준", "세현", "세훈", "소율",
        "수민", "수빈", "수호", "수현", "승민", "승빈", "승우", "승원", "승재",
        "승현", "승호", "승훈", "시우", "시윤", "시현", "시호", "아준", "연우",
        "영민", "영우", "영재", "영준", "영진", "영호", "영훈", "예건", "예성",
        "예준", "예찬", "오준", "용준", "우빈", "우석", "우성", "우영", "우진",
        "우찬", "우현", "원준", "원혁", "유민", "유빈", "유준", "유찬", "유한",
        "윤성", "윤수", "윤우", "윤재", "윤준", "윤찬", "윤호", "은우", "은찬",
        "은호", "의준", "이안", "이준", "이찬", "인서", "인성", "인우", "일우",
        "재민", "재빈", "재서", "재원", "재윤", "재현", "재호", "재훈", "정민",
        "정빈", "정서", "정우", "정원", "정현", "정호", "정훈", "종현", "종호",
        "주안", "주영", "주원", "주호", "주환", "준", "준서", "준성", "준수",
        "준영", "준우", "준원", "준혁", "준호", "지민", "지범", "지빈", "지성",
        "지수", "지아", "지안", "지우", "지원", "지율", "지한", "지헌", "지호",
        "지훈", "지환", "진서", "진수", "진영", "진우", "진혁", "진호", "진환",
        "찬영", "찬우", "찬혁", "태민", "태양", "태원", "태윤", "태현", "태호",
        "태훈", "하겸", "하늘", "하람", "하랑", "하민", "하빈", "하율", "하은",
        "하준", "한결", "한빈", "한서", "한솔", "한울", "현서", "현수", "현승",
        "현우", "현준", "현진", "현호", "호준", "호진",
        "가은", "가윤", "가인", "나경", "나연", "나영", "나윤", "나은", "나현",
        "다빈", "다연", "다영", "다은", "다인", "다현", "다혜", "도연", "도윤",
        "리아", "리안", "리은", "미나", "미서", "미소", "미연", "미주", "미진",
        "민경", "민서", "민아", "민영", "민유", "민정", "민주", "민지", "민채",
        "민하", "보경", "보람", "보미", "보연", "보은", "보현", "빈아", "사랑",
        "서아", "서연", "서영", "서우", "서윤", "서은", "서현", "서희", "선아",
        "선영", "선우", "소민", "소연", "소영", "소은", "소율", "소정", "소현",
        "소희", "수민", "수빈", "수아", "수연", "수영", "수정", "수지", "수진",
        "수현", "수희", "시아", "시연", "시온", "시우", "시은", "시현", "시후",
        "아라", "아름", "아린", "아영", "아윤", "아인", "아현", "연서", "연수",
        "연우", "연주", "연지", "연희", "예나", "예린", "예빈", "예서", "예슬",
        "예원", "예은", "예인", "예지", "예진", "예하", "유나", "유빈", "유선",
        "유정", "유지", "유진", "유하", "유현", "윤경", "윤나", "윤서", "윤수",
        "윤슬", "윤아", "윤지", "윤하", "은별", "은비", "은서", "은수", "은솔",
        "은아", "은우", "은율", "은지", "은채", "은하", "이서", "이슬", "이윤",
        "이현", "자윤", "정서", "정아", "정연", "정윤", "정은", "정인", "정하",
        "주아", "주연", "주은", "주하", "주현", "지민", "지아", "지안", "지연",
        "지영", "지우", "지원", "지유", "지은", "지현", "지혜", "지후", "진아",
        "진우", "채빈", "채아", "채연", "채영", "채원", "채은", "채희", "초원",
        "하나", "하늘", "하린", "하연", "하영", "하율", "하은", "하윤", "하정",
        "한나", "한별", "한서", "한솔", "해나", "해린", "해원", "현서", "현수",
        "현아", "현정", "현지", "현진", "혜린", "혜민", "혜원", "혜인", "혜진"
    };

    // 구세대 돌림자 끝글자
    private static readonly HashSet<string> _oldStyleEndings = new()
    {
        "길", "복", "남", "숙", "순", "자", "영", "옥", "희", "미",
        "철", "호", "석", "수"
    };

    // 현세대 흔한 끝글자
    private static readonly HashSet<string> _modernCommonEndings = new()
    {
        "준", "우", "현", "서", "윤", "은", "민", "진", "원", "호",
        "빈", "아", "린", "율", "유"
    };

    /// <summary>
    /// 세대 중립성 평가 — 5단계 세분화
    /// RarityScoringEngine의 희귀도 분류 기준을 활용하여 세대중립성을 평가
    ///
    /// 매우 흔함 (VeryCommon TOP 이름): 20  → NeutralityScore 3
    /// 흔함 (Common DB 300+ 이름):      40  → NeutralityScore 6
    /// 구세대 돌림자 패턴:               50  → NeutralityScore 7
    /// 현세대 흔한 어미 사용:            70  → NeutralityScore 10
    /// 독특함/매우 독특함:              100  → NeutralityScore 15
    /// </summary>
    private int EvaluateGenerationalNeutrality(string name)
    {
        // 1단계: 매우 흔함 — 통계청 TOP 이름 (특정 세대 대표 이름)
        if (_veryCommonNames.Contains(name))
        {
            return 20;
        }

        // 2단계: 흔함 — 통계청 인기 300+ DB에 있는 이름
        if (_commonNames.Contains(name))
        {
            return 40;
        }

        // 3단계: 구세대 돌림자 패턴 (특정 구세대에 치우침)
        if (name.Length >= 2)
        {
            var lastChar = name[^1].ToString();
            if (_oldStyleEndings.Contains(lastChar))
            {
                return 50;
            }
        }

        // 4단계: 현세대 흔한 끝글자 (DB에 없지만 흔한 어미 패턴 사용)
        if (name.Length >= 2)
        {
            var lastChar = name[^1].ToString();
            if (_modernCommonEndings.Contains(lastChar))
            {
                return 70;
            }
        }

        // 5단계: 독특한 이름 (DB에도 없고 흔한 어미도 없음)
        return 100;
    }

    // ========== 의미 평가 ==========

    /// <summary>
    /// 의미 평가 (한자 카테고리 + 톤 매칭)
    /// </summary>
    private int EvaluateMeaning(string name, string tone)
    {
        int score = 70; // 기본 점수

        // 과도한 소망 표현 감점
        foreach (var word in _excessiveWishWords)
        {
            if (name.Contains(word))
            {
                score -= 20;
            }
        }

        // 한자 의미 평가
        var hanjaInfo = GetHanjaInfo(name);
        if (hanjaInfo != null)
        {
            // 자연, 덕목, 개념 계열은 가점
            if (hanjaInfo.Any(h => h.Category == "자연" || h.Category == "덕목" || h.Category == "개념"))
            {
                score += 20;
            }

            // 톤과 맞는 의미는 가점
            if (tone == "soft")
            {
                if (hanjaInfo.Any(h => h.TonePref == HanjaData.TonePreference.Soft))
                {
                    score += 10;
                }
            }
            else if (tone == "strong")
            {
                if (hanjaInfo.Any(h => h.TonePref == HanjaData.TonePreference.Strong))
                {
                    score += 10;
                }
            }
        }

        return Math.Max(0, Math.Min(100, score));
    }

    // ========== 유틸리티 메서드 (기존 유지) ==========

    /// <summary>
    /// 한자 정보 가져오기
    /// </summary>
    private List<HanjaData.HanjaInfo>? GetHanjaInfo(string name)
    {
        var result = new List<HanjaData.HanjaInfo>();

        foreach (char c in name)
        {
            var hanjaList = HanjaData.FindByReading(c.ToString());
            if (hanjaList.Any())
            {
                result.AddRange(hanjaList);
            }
        }

        return result.Any() ? result : null;
    }

    /// <summary>
    /// 생활어 충돌 체크
    /// </summary>
    private bool IsCollisionWithCommonWord(string name)
    {
        foreach (var word in _collisionWords)
        {
            if (name.Contains(word) || word.Contains(name))
            {
                return true;
            }
        }
        return false;
    }

    /// <summary>
    /// 부정적 음절 패턴 평가
    /// </summary>
    private int EvaluateNegativeSyllablePatterns(string name)
    {
        int penalty = 0;

        foreach (var syllable in _negativePatterns.HighPenaltySyllables)
        {
            if (name.Contains(syllable))
            {
                penalty += 15;
            }
        }

        foreach (var syllable in _negativePatterns.MediumPenaltySyllables)
        {
            if (name.Contains(syllable))
            {
                penalty += 8;
            }
        }

        foreach (var combination in _negativePatterns.NegativeCombinations)
        {
            if (MatchesPattern(name, combination.Pattern))
            {
                penalty += combination.Penalty;
            }
        }

        return Math.Min(30, penalty);
    }

    /// <summary>
    /// 특이 성씨(복성, 희귀성)와 이름의 리듬 조화 평가
    /// </summary>
    private int EvaluateUnusualSurnameRhythm(string lastName, string firstName)
    {
        var surnameInfo = SurnameData.GetInfo(lastName);
        int bonus = 0;

        if (surnameInfo.Type == SurnameData.SurnameType.TwoChar)
        {
            var fullLength = lastName.Length + firstName.Length;

            if (fullLength == 3)
                bonus += 10;
            else if (fullLength == 4)
                bonus += 5;
            else if (fullLength >= 5)
                bonus -= 10;

            if (surnameInfo.HasFinalConsonant && firstName.Length > 0)
            {
                var firstNameChar = firstName[0];
                if (firstNameChar >= 0xAC00 && firstNameChar <= 0xD7A3)
                {
                    var code = firstNameChar - 0xAC00;
                    var leadIndex = code / (21 * 28);
                    if (leadIndex == 11) bonus += 5;
                }
            }
        }
        else if (surnameInfo.Type == SurnameData.SurnameType.Rare)
        {
            var fullLength = lastName.Length + firstName.Length;
            if (fullLength == 3) bonus += 5;
        }

        return bonus;
    }

    private int EvaluateFullNamePatterns(string fullName)
    {
        int penalty = 0;

        foreach (var word in _negativePatterns.NegativeVerbsAndAdjectives)
        {
            if (fullName.Contains(word))
            {
                penalty += 25;
            }
        }

        foreach (var phrase in _negativePatterns.NegativePhrases)
        {
            if (fullName.Contains(phrase))
            {
                penalty += 20;
            }
        }

        foreach (var homophone in _negativePatterns.HomophoneNegative)
        {
            if (fullName.Contains(homophone.Sound))
            {
                penalty += homophone.Penalty;
            }
        }

        var negativePatterns = MorphemeAnalyzer.DetectNegativePatterns(fullName);
        if (negativePatterns.Count > 0)
        {
            if (negativePatterns.Contains("동사/형용사_형태"))
            {
                penalty += 30;
            }

            if (negativePatterns.Contains("부정적_형태소_조합"))
            {
                penalty += 25;
            }

            foreach (var pattern in negativePatterns)
            {
                if (pattern.StartsWith("성명조합_부정연상"))
                {
                    // 성씨+이름 첫글자가 부정적 단어를 형성 (예: 허하나→허하다, 박하나→박하다)
                    penalty += 30;
                }
                else if (pattern.Contains("연상") || pattern.Contains("어감"))
                {
                    penalty += 20;
                }
            }
        }

        if (_negativePatterns.MorphemePatterns != null)
        {
            foreach (var morphemePattern in _negativePatterns.MorphemePatterns)
            {
                if (MorphemeAnalyzer.MatchesMorphemePattern(fullName, morphemePattern.Pattern))
                {
                    penalty += morphemePattern.Penalty;
                }
            }
        }

        return Math.Min(50, penalty);
    }

    /// <summary>
    /// 패턴 매칭 (간단한 와일드카드 지원)
    /// </summary>
    private bool MatchesPattern(string text, string pattern)
    {
        if (pattern.EndsWith("*"))
        {
            return text.StartsWith(pattern.TrimEnd('*'));
        }
        else if (pattern.StartsWith("*"))
        {
            return text.EndsWith(pattern.TrimStart('*'));
        }
        else
        {
            return text.Contains(pattern);
        }
    }
}
