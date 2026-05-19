using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Engines;

/// <summary>
/// 조화 점수 계산 엔진 (실제 구현)
/// 오행, 자원오행, 음양 균형 평가
/// gender/tone 반영, fallback 정책 명확화
/// </summary>
public class HarmonyEngine : IHarmonyEngine
{
    private readonly ISajuCalculationService _sajuCalculationService;
    private readonly IYongshinCalculationService? _yongshinCalculationService;

    public HarmonyEngine(ISajuCalculationService sajuCalculationService)
    {
        _sajuCalculationService = sajuCalculationService;
        _yongshinCalculationService = null;
    }

    /// <summary>
    /// 용신 보완 가산을 반영하는 생성자. DI는 이 시그니처를 우선 사용한다.
    /// </summary>
    public HarmonyEngine(
        ISajuCalculationService sajuCalculationService,
        IYongshinCalculationService yongshinCalculationService)
    {
        _sajuCalculationService = sajuCalculationService;
        _yongshinCalculationService = yongshinCalculationService;
    }

    // 획수 끝자리 → 오행 매핑 (자원오행)
    private static readonly Dictionary<int, string> StrokeToElement = new()
    {
        { 1, "木" }, { 2, "木" },
        { 3, "火" }, { 4, "火" },
        { 5, "土" }, { 6, "土" },
        { 7, "金" }, { 8, "金" },
        { 9, "水" }, { 0, "水" }
    };

    public async Task<int> CalculateScoreAsync(
        string name,
        string lastName,
        DateTime birthDate,
        string gender,
        TimeSpan? birthTime = null)
    {
        var breakdown = await CalculateScoreWithBreakdownAsync(name, lastName, birthDate, gender, birthTime);
        return breakdown.TotalScore;
    }

    public Task<HarmonyBreakdown> CalculateScoreWithBreakdownAsync(
        string name,
        string lastName,
        DateTime birthDate,
        string gender,
        TimeSpan? birthTime = null)
    {
        var breakdown = new HarmonyBreakdown();

        // 각 음절에서 최적 한자 선택
        var selectedHanja = SelectHanjaForName(name, gender);
        bool anyFallback = selectedHanja.Any(h => h == null);

        if (selectedHanja.All(h => h == null))
        {
            // 모든 음절에서 한자를 찾지 못한 경우 → fallback 정책
            breakdown.UsedFallback = true;
            breakdown.FiveElementScore = 14;           // 45% of 30
            breakdown.ResourceElementScore = 10;        // 50% of 20
            breakdown.YinYangScore = 5;                 // 50% of 10
            breakdown.PronunciationElementScore = CalculatePronunciationElementScore(lastName, name, breakdown.Notes);
            breakdown.SuriSagyeokScore = 7;             // fallback 중간값
            breakdown.GenderBonus = 0;
            breakdown.Notes.Add("한자 정보가 부족하여 기본값을 사용했습니다");
            breakdown.TotalScore = Math.Max(0, Math.Min(100,
                breakdown.FiveElementScore + breakdown.ResourceElementScore +
                breakdown.YinYangScore + breakdown.PronunciationElementScore +
                breakdown.SuriSagyeokScore));
            return Task.FromResult(breakdown);
        }

        // 1. 오행 조화 평가 (30점 만점)
        breakdown.FiveElementScore = CalculateFiveElementScore(selectedHanja, birthDate, birthTime, breakdown.Notes);

        // 2. 자원오행 (획수) 평가 (20점 만점)
        breakdown.ResourceElementScore = CalculateResourceElementScore(selectedHanja, name, breakdown.Notes);

        // 3. 음양 균형 평가 (10점 만점)
        breakdown.YinYangScore = CalculateYinYangScore(selectedHanja, breakdown.Notes);

        // 4. 발음오행 (음령오행) 평가 (25점 만점)
        breakdown.PronunciationElementScore = CalculatePronunciationElementScore(lastName, name, breakdown.Notes);

        // 5. 수리사격 (원형이정) 평가 (15점 만점)
        breakdown.SuriSagyeokScore = CalculateSuriSagyeokScore(lastName, selectedHanja, breakdown.Notes);

        // 6. gender 보정
        breakdown.GenderBonus = CalculateGenderBonus(selectedHanja, gender);
        if (breakdown.GenderBonus != 0)
        {
            string genderNote = breakdown.GenderBonus > 0
                ? $"성별 선호도 일치 (+{breakdown.GenderBonus})"
                : $"성별 선호도 불일치 ({breakdown.GenderBonus})";
            breakdown.Notes.Add(genderNote);
        }

        // fallback 표시
        if (anyFallback)
        {
            breakdown.UsedFallback = true;
            breakdown.Notes.Add("일부 음절의 한자 정보를 찾지 못해 획수 기반 추정을 사용했습니다");
        }

        int raw = breakdown.FiveElementScore
                + breakdown.ResourceElementScore
                + breakdown.YinYangScore
                + breakdown.PronunciationElementScore
                + breakdown.SuriSagyeokScore
                + breakdown.GenderBonus;

        breakdown.TotalScore = Math.Max(0, Math.Min(100, raw));
        return Task.FromResult(breakdown);
    }

    // ===== 한자 선택 =====

    /// <summary>
    /// 이름의 각 음절에 대해 최적의 한자를 선택한다.
    /// GenderPref/TonePref가 일치하는 한자를 우선 선택.
    /// </summary>
    private List<HanjaInfo?> SelectHanjaForName(string name, string gender)
    {
        var result = new List<HanjaInfo?>();
        var genderPref = ParseGenderPref(gender);

        foreach (char c in name)
        {
            var hanjaList = HanjaData.FindByReading(c.ToString());
            if (hanjaList.Count == 0)
            {
                result.Add(null);
                continue;
            }

            result.Add(SelectBestHanja(hanjaList, genderPref));
        }

        return result;
    }

    /// <summary>
    /// 한자 목록에서 가장 적합한 한자를 선택한다.
    /// 우선순위: 인명용 관련성 정렬 적용 후 GenderPref 일치 > FiveElement/YinYang 정보 보유 > 첫 번째
    /// </summary>
    private static HanjaInfo SelectBestHanja(List<HanjaInfo> candidates, GenderPreference genderPref)
    {
        // 먼저 인명용 관련성 기준으로 정렬 (CJK 기본 영역, 대법원 인명용 등 우선)
        var sorted = HanjaData.SortByRelevance(candidates);

        // 1순위: gender 일치 + 오행 정보 보유 (관련성 높은 것부터)
        if (genderPref != GenderPreference.Neutral)
        {
            var genderMatch = sorted.FirstOrDefault(h =>
                h.GenderPref == genderPref &&
                !string.IsNullOrEmpty(h.FiveElement));
            if (genderMatch != null) return genderMatch;
        }

        // 2순위: 오행+음양 정보 모두 보유 (관련성 높은 것부터)
        var fullInfo = sorted.FirstOrDefault(h =>
            !string.IsNullOrEmpty(h.FiveElement) &&
            !string.IsNullOrEmpty(h.YinYang));
        if (fullInfo != null) return fullInfo;

        // 3순위: 오행 정보만이라도 보유 (관련성 높은 것부터)
        var hasElement = sorted.FirstOrDefault(h =>
            !string.IsNullOrEmpty(h.FiveElement));
        if (hasElement != null) return hasElement;

        // 4순위: 관련성 가장 높은 첫 번째
        return sorted.First();
    }

    private static GenderPreference ParseGenderPref(string gender)
    {
        return gender?.ToLowerInvariant() switch
        {
            "male" => GenderPreference.Male,
            "female" => GenderPreference.Female,
            _ => GenderPreference.Neutral
        };
    }

    // ===== 오행 점수 (40점 만점) =====

    private int CalculateFiveElementScore(
        List<HanjaInfo?> selectedHanja,
        DateTime birthDate,
        TimeSpan? birthTime,
        List<string> notes)
    {
        var elements = new Dictionary<string, int>
        {
            { "木", 0 }, { "火", 0 }, { "土", 0 }, { "金", 0 }, { "水", 0 }
        };

        int resolvedCount = 0;
        foreach (var hanja in selectedHanja)
        {
            string element = GetFiveElement(hanja);
            if (!string.IsNullOrEmpty(element) && elements.ContainsKey(element))
            {
                elements[element]++;
                resolvedCount++;
            }
        }

        if (resolvedCount == 0)
        {
            return 18; // 45% of 40 (unknown penalty)
        }

        // SajuCalculationService로 4기둥 오행 분포 계산 (연도만 쓰던 FortuneUtils 대체)
        var chart = _sajuCalculationService.CalculateChart(birthDate, birthTime);
        var sajuElements = chart.FiveElementCount;
        double avg = sajuElements.Values.Average();
        var lackingElements = sajuElements.Where(e => e.Value < avg).Select(e => e.Key).ToList();
        var excessiveElements = sajuElements.Where(e => e.Value > avg * 1.5).Select(e => e.Key).ToList();

        int score = 50; // 기본 점수 (100점 만점 기준)

        // ── 용신 기반 가산 (가장 정확한 보완 평가) ──────────────────
        // 용신 = 일간 강약·조후를 종합해 도출한 "꼭 필요한 오행"
        // 단순 lacking 판단보다 우선
        if (_yongshinCalculationService != null)
        {
            try
            {
                var yongshin = _yongshinCalculationService.Calculate(chart);

                // PrimaryYongshin: 가장 큰 가산
                if (!string.IsNullOrEmpty(yongshin.PrimaryYongshin)
                    && elements.ContainsKey(yongshin.PrimaryYongshin)
                    && elements[yongshin.PrimaryYongshin] > 0)
                {
                    score += 30;
                    notes.Add($"용신 '{yongshin.PrimaryYongshin}' 보완");
                }

                // Heeshin: 차선 가산
                if (!string.IsNullOrEmpty(yongshin.Heeshin)
                    && elements.ContainsKey(yongshin.Heeshin)
                    && elements[yongshin.Heeshin] > 0)
                {
                    score += 12;
                    notes.Add($"희신 '{yongshin.Heeshin}' 포함");
                }

                // Gishin: 큰 감점 (용신을 극하는 오행)
                if (!string.IsNullOrEmpty(yongshin.Gishin)
                    && elements.ContainsKey(yongshin.Gishin)
                    && elements[yongshin.Gishin] > 0)
                {
                    score -= 25;
                    notes.Add($"기신 '{yongshin.Gishin}' 충돌 (감점)");
                }
            }
            catch
            {
                // 용신 계산 실패 시 lacking/excessive 기반으로만 점수 산출
            }
        }

        // ── 보조: 단순 부족/과다 보완 (용신 가산이 없는 케이스 보완) ──
        foreach (var el in lackingElements)
        {
            if (elements.ContainsKey(el) && elements[el] > 0)
            {
                score += 10; // 용신 가산보다 약하게 (기존 20 → 10)
                notes.Add($"부족한 오행 '{el}' 보완");
            }
        }

        foreach (var el in excessiveElements)
        {
            if (elements.ContainsKey(el) && elements[el] > 0)
            {
                score -= 10; // 기존 15 → 10
                notes.Add($"과다한 오행 '{el}' 증가 (감점)");
            }
        }

        // 오행 균형 평가 (이름 내 오행이 다양하면 가점)
        var usedElements = elements.Values.Where(v => v > 0).ToList();
        if (usedElements.Count >= 2)
        {
            score += 10; // 다양한 오행 사용
        }

        score = Math.Max(0, Math.Min(100, score));
        return (int)(score * 0.3); // 30점 만점으로 환산
    }

    /// <summary>
    /// 한자의 오행을 가져온다. 없으면 획수 기반으로 추정.
    /// </summary>
    private static string GetFiveElement(HanjaInfo? hanja)
    {
        if (hanja == null) return string.Empty;

        if (!string.IsNullOrEmpty(hanja.FiveElement))
            return hanja.FiveElement;

        // fallback: 획수 기반 자원오행
        if (hanja.StrokeCount > 0)
        {
            int lastDigit = hanja.StrokeCount % 10;
            return StrokeToElement[lastDigit];
        }

        return string.Empty;
    }

    // ===== 자원오행 (획수) 점수 (30점 만점) =====

    private int CalculateResourceElementScore(
        List<HanjaInfo?> selectedHanja,
        string name,
        List<string> notes)
    {
        var strokeCounts = new List<int>();
        var hasLowConfidence = false;
        var hasUnknownStroke = false;

        for (int i = 0; i < name.Length; i++)
        {
            var hanja = i < selectedHanja.Count ? selectedHanja[i] : null;
            if (hanja != null && hanja.StrokeCount > 0)
            {
                strokeCounts.Add(hanja.StrokeCount);
                // ConfidenceGrade D = 획수 자동 추정, 신뢰도 낮음
                if (hanja.ConfidenceGrade == "D" || hanja.ConfidenceGrade == "C")
                    hasLowConfidence = true;
            }
            else
            {
                strokeCounts.Add(5); // 기본값
                hasUnknownStroke = true;
            }
        }

        if (strokeCounts.Count < 2)
        {
            return 15; // 50% of 30
        }

        int rawScore = FortuneUtils.EvaluateStrokeCount(strokeCounts[0], strokeCounts[1]);
        int score = (int)(rawScore * 0.2); // 20점 만점으로 환산

        // ConfidenceGrade 신뢰도 가중치 — 낮은 신뢰도 한자가 섞이면 점수를 보수적으로 조정
        // S/A: 1.0 (영향 없음)
        // B: 0.95
        // C: 0.85
        // D 또는 획수 미상: 0.75 (큰 감산)
        if (hasUnknownStroke)
        {
            score = (int)Math.Round(score * 0.75);
            notes.Add("일부 한자 획수 정보 부족 — 자원오행 신뢰도 감산");
        }
        else if (hasLowConfidence)
        {
            score = (int)Math.Round(score * 0.85);
            notes.Add("ConfidenceGrade C/D 한자 포함 — 자원오행 점수 보수적 산출");
        }

        return score;
    }

    // ===== 음양 점수 (20점 만점) =====

    private int CalculateYinYangScore(
        List<HanjaInfo?> selectedHanja,
        List<string> notes)
    {
        int yinCount = 0;
        int yangCount = 0;

        foreach (var hanja in selectedHanja)
        {
            if (hanja == null) continue;

            string yinYang = hanja.YinYang;
            if (string.IsNullOrEmpty(yinYang) && hanja.StrokeCount > 0)
            {
                // fallback: 획수 기반 음양 (홀수=양, 짝수=음)
                yinYang = hanja.StrokeCount % 2 == 1 ? "陽" : "陰";
            }

            if (yinYang == "陰") yinCount++;
            else if (yinYang == "陽") yangCount++;
        }

        if (yinCount == 0 && yangCount == 0)
        {
            return 10; // 50% of 20
        }

        if (yinCount > 0 && yangCount > 0)
        {
            notes.Add($"음양 균형: 陰 {yinCount} / 陽 {yangCount}");
        }
        else if (yinCount > 0)
        {
            notes.Add($"음양: 陰 편중 ({yinCount})");
        }
        else
        {
            notes.Add($"음양: 陽 편중 ({yangCount})");
        }

        int rawScore = FortuneUtils.EvaluateYinYangBalance(yinCount, yangCount);
        return (int)(rawScore * 0.1); // 10점 만점으로 환산
    }

    // ===== 성+이름 조화 (10점 만점) =====

    private int CalculateSurnameHarmonyScore(string lastName, string name)
    {
        int score = 70; // 기본 점수

        int lastNameLength = lastName.Length;
        int nameLength = name.Length;
        int totalLength = lastNameLength + nameLength;

        if (totalLength == 3)
        {
            score = 100; // 3음절 최적
        }
        else if (totalLength == 4 && lastNameLength <= 2)
        {
            score = lastNameLength == 2 ? 90 : 85;
        }
        else if (lastNameLength == 1 && nameLength == 3)
        {
            score = 60; // 1+3
        }
        else if (totalLength >= 5)
        {
            score = 40; // 5음절+ 부자연스러움
        }
        else
        {
            score = 50;
        }

        // 발음 리듬 평가
        string fullName = lastName + name;
        int rhythmScore = KoreanUtils.EvaluateRhythm(fullName);
        score = (score + rhythmScore) / 2;

        score = Math.Max(0, Math.Min(100, score));
        return (int)(score * 0.1); // 10점 만점으로 환산
    }

    // ===== 발음오행 (음령오행) — 25점 만점 =====

    // 오행 상생: 木→火→土→金→水→木
    private static readonly Dictionary<string, string> ShengNext = new()
    {
        ["木"] = "火", ["火"] = "土", ["土"] = "金", ["金"] = "水", ["水"] = "木"
    };
    // 오행 상극: 木克土, 土克水, 水克火, 火克金, 金克木
    private static readonly Dictionary<string, string> KeTarget = new()
    {
        ["木"] = "土", ["土"] = "水", ["水"] = "火", ["火"] = "金", ["金"] = "木"
    };

    private static int EvalElementRelation(string? a, string? b)
    {
        if (a == null || b == null) return 60;
        if (a == b) return 65;                          // 비화 (같음)
        if (ShengNext.TryGetValue(a, out var next) && next == b) return 100; // 상생
        if (KeTarget.TryGetValue(a, out var target) && target == b) return 20; // 상극
        return 55;                                      // 기타 무관
    }

    private int CalculatePronunciationElementScore(string lastName, string name, List<string> notes)
    {
        var fullName = lastName + name;
        var elements = fullName.Select(KoreanUtils.GetEumryeongFiveElement).ToList();

        if (elements.Count < 2)
            return 13; // 50% of 25

        var relations = new List<int>();
        for (int i = 0; i < elements.Count - 1; i++)
            relations.Add(EvalElementRelation(elements[i], elements[i + 1]));

        double avg = relations.Average();

        // 전체 상생 보너스
        bool allSheng = relations.All(r => r == 100);
        if (allSheng)
        {
            notes.Add($"발음오행 전체 상생: {string.Join("→", elements.Select(e => e ?? "?"))}");
            avg = Math.Min(100, avg + 10);
        }
        else
        {
            var chain = string.Join("→", elements.Select(e => e ?? "?"));
            notes.Add($"발음오행: {chain}");
        }

        int score = (int)(avg * 0.25); // 25점 만점
        return Math.Max(0, Math.Min(25, score));
    }

    // ===== 수리사격 (원형이정) — 15점 만점 =====

    /// <summary>
    /// 81수리 등급. 대길(GreatFortune) ~ 대흉(GreatMisfortune) 5단계.
    /// </summary>
    private enum SuriGrade { GreatFortune, MediumFortune, Neutral, MinorMisfortune, GreatMisfortune }

    // 대길수(大吉) — 38개
    private static readonly HashSet<int> GreatFortuneNumbers = new()
    {
        1, 3, 5, 6, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 25, 29,
        31, 32, 33, 35, 37, 39, 41, 45, 47, 48, 52, 57, 58,
        61, 63, 65, 67, 68, 73, 81
    };
    // 중길수(中吉) — 추가 격려 의미
    private static readonly HashSet<int> MediumFortuneNumbers = new() { 38, 75 };
    // 평수(平) — 좋지도 나쁘지도 않음
    private static readonly HashSet<int> NeutralNumbers = new() { 27, 51 };
    // 대흉수(大凶) — 회피 권장
    private static readonly HashSet<int> GreatMisfortuneNumbers = new()
    {
        2, 4, 9, 10, 12, 14, 19, 20, 22, 28, 34, 42, 43, 44, 46, 49,
        53, 54, 56, 59, 62, 69, 70, 74, 76, 77, 78, 79, 80
    };

    private static SuriGrade GetSuriGrade(int n)
    {
        if (n <= 0) return SuriGrade.Neutral;
        int v = n > 81 ? n % 81 : n;
        if (v == 0) v = 81;

        if (GreatFortuneNumbers.Contains(v)) return SuriGrade.GreatFortune;
        if (MediumFortuneNumbers.Contains(v)) return SuriGrade.MediumFortune;
        if (NeutralNumbers.Contains(v)) return SuriGrade.Neutral;
        if (GreatMisfortuneNumbers.Contains(v)) return SuriGrade.GreatMisfortune;
        // 나머지는 소흉(小凶)
        return SuriGrade.MinorMisfortune;
    }

    private static string GradeLabel(SuriGrade g) => g switch
    {
        SuriGrade.GreatFortune => "대길",
        SuriGrade.MediumFortune => "중길",
        SuriGrade.Neutral => "평",
        SuriGrade.MinorMisfortune => "소흉",
        SuriGrade.GreatMisfortune => "대흉",
        _ => "?"
    };

    private static int GradeScore(SuriGrade g) => g switch
    {
        SuriGrade.GreatFortune => 4,
        SuriGrade.MediumFortune => 3,
        SuriGrade.Neutral => 2,
        SuriGrade.MinorMisfortune => 1,
        SuriGrade.GreatMisfortune => 0,
        _ => 2
    };

    private int GetSurnameStrokeCount(string lastName)
    {
        if (string.IsNullOrEmpty(lastName)) return 0;
        // 성씨 첫 글자 독음으로 한자 조회
        var candidates = HanjaData.FindByReading(lastName[0].ToString());
        if (candidates.Count == 0) return 0;
        var sorted = HanjaData.SortByRelevance(candidates);
        return sorted.FirstOrDefault(h => h.StrokeCount > 0)?.StrokeCount ?? 0;
    }

    private int CalculateSuriSagyeokScore(string lastName, List<HanjaInfo?> selectedHanja, List<string> notes)
    {
        int s = GetSurnameStrokeCount(lastName);
        var nameStrokes = selectedHanja.Select(h => h?.StrokeCount ?? 0).ToList();

        // 획수 불명 글자가 과반이면 스킵
        int unknown = nameStrokes.Count(x => x == 0) + (s == 0 ? 1 : 0);
        if (unknown > nameStrokes.Count / 2 + 1)
        {
            notes.Add("수리사격: 획수 정보 부족으로 계산 생략");
            return 7; // 중간값
        }

        int ch1 = nameStrokes.Count > 0 ? nameStrokes[0] : 0;
        int ch2 = nameStrokes.Count > 1 ? nameStrokes[1] : 0;

        int won = ch1;                                  // 원격: 이름 첫 글자
        int hyeong = s + ch1;                           // 형격: 성 + 이름 첫 글자
        int i = nameStrokes.Count > 1 ? ch1 + ch2 : ch1; // 이격: 이름 전체
        int jeong = s + nameStrokes.Sum();              // 정격: 성 + 이름 전체

        // 81수리 5단계 분류 — 각 격당 0~4점 가산, 최대 16점 → 15점 만점 환산
        var wonGrade = GetSuriGrade(won);
        var hyeongGrade = GetSuriGrade(hyeong);
        var iGrade = GetSuriGrade(i);
        var jeongGrade = GetSuriGrade(jeong);

        int totalPoints = GradeScore(wonGrade) + GradeScore(hyeongGrade)
                        + GradeScore(iGrade) + GradeScore(jeongGrade);

        notes.Add($"수리사격: 원{won}({GradeLabel(wonGrade)}) 형{hyeong}({GradeLabel(hyeongGrade)}) " +
                  $"이{i}({GradeLabel(iGrade)}) 정{jeong}({GradeLabel(jeongGrade)})");

        // 16점 만점 → 15점 만점 환산 (Math.Round로 일관성)
        return (int)Math.Round(totalPoints * (15.0 / 16.0));
    }

    // ===== gender 보정 =====

    private static int CalculateGenderBonus(List<HanjaInfo?> selectedHanja, string gender)
    {
        if (string.IsNullOrEmpty(gender) || gender.Equals("none", StringComparison.OrdinalIgnoreCase))
            return 0;

        var genderPref = ParseGenderPref(gender);
        if (genderPref == GenderPreference.Neutral)
            return 0;

        int bonus = 0;
        foreach (var hanja in selectedHanja)
        {
            if (hanja == null) continue;
            if (hanja.GenderPref == GenderPreference.Neutral) continue;

            if (hanja.GenderPref == genderPref)
                bonus += 5; // 일치 가점
            else
                bonus -= 3; // 불일치 감점
        }

        return bonus;
    }
}
