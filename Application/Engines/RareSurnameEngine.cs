using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Application.Engines;

/// <summary>
/// 특이/희귀 성씨 최적화 이름 추천 엔진
/// 희귀 성씨의 발음 특성을 분석하고, 성씨+이름 전체의 발음 리듬을 최적화한다.
/// </summary>
public class RareSurnameEngine : IRareSurnameEngine
{
    /// <summary>흔한 성씨 상위 약 30개</summary>
    private static readonly HashSet<string> CommonSurnames = new()
    {
        "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
        "한", "오", "서", "신", "권", "황", "안", "송", "류", "전",
        "홍", "고", "문", "양", "손", "배", "백", "허", "유", "남"
    };

    /// <summary>보통 빈도 성씨 (상위 31~50위)</summary>
    private static readonly HashSet<string> ModerateSurnames = new()
    {
        "심", "노", "하", "곽", "성", "차", "주", "우", "구", "민",
        "원", "진", "나", "지", "함", "엄", "채", "변", "천", "방"
    };

    /// <summary>매우 희귀한 성씨</summary>
    private static readonly HashSet<string> VeryRareSurnames = new()
    {
        "봉", "빈", "탁", "편", "필", "감", "국", "궁", "근", "금",
        "내", "뇌", "돈", "두", "라", "로", "묘", "묵", "미", "반",
        "범", "복", "비", "삼", "상", "섭", "소", "승", "시", "아",
        "애", "옥", "옹", "완", "왕", "요", "용", "위", "육", "음",
        "자", "종", "증", "초", "탄", "후", "표", "태", "피", "화"
    };

    /// <summary>부드러운 초성 (성씨 받침 뒤에 자연스러운 연결)</summary>
    private static readonly HashSet<string> SoftInitials = new()
    {
        "ㅇ", "ㄴ", "ㅁ", "ㄹ"
    };

    /// <summary>강한 파열음 초성</summary>
    private static readonly HashSet<string> StrongPlosives = new()
    {
        "ㄱ", "ㄲ", "ㄷ", "ㄸ", "ㅂ", "ㅃ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ"
    };

    public async Task<RareSurnameAnalysis> AnalyzeAndRecommendAsync(
        string lastName,
        DateTime birthDate,
        string gender,
        string tone,
        int count)
    {
        if (string.IsNullOrWhiteSpace(lastName))
            throw new ArgumentException("성씨는 필수입니다.", nameof(lastName));

        if (count < 1) count = 10;
        if (count > 50) count = 50;

        var rarityLevel = DetermineRarityLevel(lastName);
        var isRare = rarityLevel >= 3;
        var phoneticAnalysis = AnalyzePhonetics(lastName);

        // 한자 기반 이름 후보 생성
        var rawCandidates = GenerateNameCandidates(lastName, gender, tone);

        // 발음 조화 점수 계산 및 정렬
        var scored = rawCandidates
            .Select(name => ScoreCandidate(lastName, name))
            .OrderByDescending(c => c.HarmonyScore)
            .ToList();

        // 다양성 보정: 같은 첫 글자가 결과를 도배하지 않도록 라운드-로빈으로 추출
        // 첫 글자별 그룹 → 점수순 정렬 → 라운드-로빈으로 count개 채우기
        var byFirstChar = scored
            .GroupBy(c => c.Name.Length > 0 ? c.Name[0].ToString() : "")
            .Select(g => g.OrderByDescending(c => c.HarmonyScore).ToList())
            .OrderByDescending(g => g[0].HarmonyScore)
            .ToList();

        var scoredCandidates = new List<RareSurnameCandidate>();
        var indices = new int[byFirstChar.Count];
        while (scoredCandidates.Count < count)
        {
            bool added = false;
            for (int g = 0; g < byFirstChar.Count && scoredCandidates.Count < count; g++)
            {
                if (indices[g] < byFirstChar[g].Count)
                {
                    scoredCandidates.Add(byFirstChar[g][indices[g]]);
                    indices[g]++;
                    added = true;
                }
            }
            if (!added) break;
        }
        // 라운드-로빈으로 섞인 결과를 다시 점수순으로 정렬해 사용자에게는 "균형" + "점수순"
        scoredCandidates = scoredCandidates
            .OrderByDescending(c => c.HarmonyScore)
            .ToList();

        return await Task.FromResult(new RareSurnameAnalysis
        {
            LastName = lastName,
            IsRareSurname = isRare,
            RarityLevel = rarityLevel,
            PhoneticAnalysis = phoneticAnalysis,
            Candidates = scoredCandidates
        });
    }

    /// <summary>
    /// 성씨 희귀도 레벨 판별
    /// 1=흔함 (상위 30), 2=보통 (상위 31~50), 3=희귀, 4=매우희귀
    /// </summary>
    public int DetermineRarityLevel(string surname)
    {
        if (string.IsNullOrWhiteSpace(surname)) return 1;

        if (CommonSurnames.Contains(surname)) return 1;
        if (ModerateSurnames.Contains(surname)) return 2;
        if (VeryRareSurnames.Contains(surname)) return 4;

        // 복성은 희귀
        if (SurnameData.IsTwoCharSurname(surname)) return 3;

        // 나머지 1자 성씨 중 목록에 없는 것은 희귀
        return 3;
    }

    /// <summary>
    /// 성씨 발음 특성 분석
    /// </summary>
    public string AnalyzePhonetics(string surname)
    {
        if (string.IsNullOrWhiteSpace(surname))
            return "성씨가 비어 있습니다.";

        var lastChar = surname[^1];
        var (initial, vowel, final_) = KoreanUtils.Decompose(lastChar);
        var hasFinal = !string.IsNullOrEmpty(final_);

        var parts = new List<string>();

        parts.Add($"초성 '{initial}'");

        if (hasFinal)
        {
            parts.Add($"받침 '{final_}' 있음");
            parts.Add("이름 첫 글자가 모음이나 ㅇ/ㄴ/ㅁ으로 시작하면 부드럽게 연결됩니다");
        }
        else
        {
            parts.Add("받침 없음");
            parts.Add("이름 첫 글자가 자음으로 시작하면 구분감이 생겨 좋습니다");
        }

        return $"성씨 '{surname}': {string.Join(", ", parts)}.";
    }

    /// <summary>
    /// 한자 기반 이름 후보 생성
    /// </summary>
    private List<string> GenerateNameCandidates(string lastName, string gender, string tone)
    {
        var candidates = new HashSet<string>();
        var hanjaList = HanjaData.HanjaDictionary.Values.ToList();

        // 성별 필터링
        var filtered = hanjaList.Where(h =>
        {
            if (string.IsNullOrEmpty(h.Reading)) return false;
            if (gender == "male" && h.GenderPref == HanjaData.GenderPreference.Female) return false;
            if (gender == "female" && h.GenderPref == HanjaData.GenderPreference.Male) return false;
            return true;
        }).ToList();

        // 톤 필터링 (톤 일치 우선, 나머지도 포함)
        var toneMatched = filtered.Where(h =>
        {
            if (tone == "soft" && h.TonePref == HanjaData.TonePreference.Soft) return true;
            if (tone == "strong" && h.TonePref == HanjaData.TonePreference.Strong) return true;
            if (tone == "neutral") return true;
            return h.TonePref == HanjaData.TonePreference.Neutral;
        }).ToList();

        // 의미 있는 한자 우선
        var meaningfulHanja = toneMatched
            .Where(h => !string.IsNullOrEmpty(h.Meaning) && !string.IsNullOrEmpty(h.Reading))
            .ToList();

        // 2음절 이름 생성 (두 한자 조합)
        // 다양성 확보: reading 단위로 distinct하여 같은 발음 한자(剛/康/强 등)가 풀을 점령하지 않게 함
        var pool = meaningfulHanja.Count >= 20
            ? meaningfulHanja
            : toneMatched.Where(h => !string.IsNullOrEmpty(h.Reading)).ToList();

        var distinctByReading = pool
            .GroupBy(h => h.Reading)
            .Select(g => g.First())
            .ToList();

        var firstChars = distinctByReading.Take(150).ToList();
        var secondChars = distinctByReading.Take(150).ToList();

        foreach (var first in firstChars)
        {
            foreach (var second in secondChars)
            {
                if (first.Reading == second.Reading) continue;
                var name = first.Reading + second.Reading;
                if (name.Length == 2 && !KoreanUtils.HasSameConsonantRepetition(lastName + name))
                {
                    candidates.Add(name);
                }
                if (candidates.Count >= 500) break;
            }
            if (candidates.Count >= 500) break;
        }

        return candidates.ToList();
    }

    /// <summary>
    /// 이름 후보에 대한 발음 조화 점수 계산
    /// </summary>
    public RareSurnameCandidate ScoreCandidate(string lastName, string name)
    {
        var fullName = lastName + name;
        int score = 50; // 기준점
        var reasons = new List<string>();

        // 1. 성씨 연음 — 보편 작명 원리 (NamingPrinciples) 활용
        double flowRatio = NamingPrinciples.EvalSurnameFlow(lastName, name);
        int flowScore = (int)Math.Round(flowRatio * 25);
        score += flowScore - 10; // 0.5 기준 ±15 범위
        if (flowRatio >= 0.85) reasons.Add("성씨와 이름 첫소리 연결이 매우 자연스러움");
        else if (flowRatio >= 0.65) reasons.Add("성씨와 이름 첫소리 연결 무난");
        else reasons.Add("성씨와 이름 첫소리 연결이 다소 딱딱함");

        // 1b. 이름 두 글자 음령오행 상생 (2글자 이상일 때)
        if (name.Length >= 2)
        {
            double ohaengRatio = NamingPrinciples.EvalOhaengSynergy(name[0].ToString(), name[1].ToString());
            int ohaengScore = (int)Math.Round(ohaengRatio * 10);
            score += ohaengScore - 5;
            if (ohaengRatio >= 0.85) reasons.Add("이름 두 글자 음령오행 상생");
            else if (ohaengRatio <= 0.2) reasons.Add("이름 두 글자 음령오행 상극");
        }

        // 2. 초성 다양성 (최대 +15)
        var allInitials = fullName.Select(c =>
        {
            var (init, _, _) = KoreanUtils.Decompose(c);
            return init;
        }).Where(i => !string.IsNullOrEmpty(i)).ToList();

        var uniqueRatio = allInitials.Distinct().Count() / (double)allInitials.Count;
        if (uniqueRatio >= 0.8)
        {
            score += 15;
            reasons.Add("초성이 다양하여 리듬감 좋음");
        }
        else if (uniqueRatio >= 0.5)
        {
            score += 8;
            reasons.Add("초성 다양성 보통");
        }
        else
        {
            score -= 5;
            reasons.Add("초성 반복이 많아 단조로움");
        }

        // 3. 전체 발음 리듬 (KoreanUtils 활용, 최대 +10)
        var rhythmScore = KoreanUtils.EvaluateRhythm(fullName);
        if (rhythmScore >= 70)
        {
            score += 10;
            reasons.Add("전체 발음 리듬 우수");
        }
        else if (rhythmScore >= 50)
        {
            score += 5;
            reasons.Add("전체 발음 리듬 보통");
        }
        else
        {
            score -= 5;
            reasons.Add("전체 발음 리듬 개선 필요");
        }

        // 4. 음절 길이 조화 (최대 +5)
        if (fullName.Length == 3)
        {
            score += 5;
            reasons.Add("3음절로 자연스러운 길이");
        }
        else if (fullName.Length == 4)
        {
            score += 3;
            reasons.Add("4음절로 안정적인 길이");
        }

        // 점수 범위 보정
        score = Math.Max(0, Math.Min(100, score));

        // 한자 옵션 찾기
        var hanjaOptions = FindHanjaOptions(name);

        return new RareSurnameCandidate
        {
            Name = name,
            HarmonyScore = score,
            HarmonyReason = string.Join("; ", reasons),
            HanjaOptions = hanjaOptions
        };
    }

    /// <summary>
    /// 이름에 대한 한자 옵션 찾기
    /// </summary>
    private List<string> FindHanjaOptions(string name)
    {
        var options = new List<string>();

        foreach (var ch in name)
        {
            var reading = ch.ToString();
            var matchingHanja = HanjaData.HanjaDictionary.Values
                .Where(h => h.Reading == reading && !string.IsNullOrEmpty(h.Meaning))
                .Take(3)
                .Select(h => $"{h.Character}({h.Meaning})")
                .ToList();

            if (matchingHanja.Count > 0)
            {
                options.AddRange(matchingHanja);
            }
        }

        return options;
    }
}
