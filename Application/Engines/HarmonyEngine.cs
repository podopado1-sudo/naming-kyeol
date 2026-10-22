using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Application.Engines;

/// <summary>
/// 조화 점수 계산 엔진 (실제 구현)
/// 자원오행 보완 30 + 획수 조화 20 + 음양 10 + 발음오행 25 + 전통 81수리 15 (+ 성별 보정)
/// gender/tone 반영, fallback 정책 명확화
/// 축 이름(2026-10-22 S4, 계획 §3-1·D7): 옛 '오행 30'은 배정 한자의 부수 기준 자원오행으로 사주를 보완하는 축이라 '자원오행 보완',
/// 옛 '자원오행 20'은 실제로 두 글자 획수 합의 구간 점수(오행 무관)라 '획수 조화'. 산식·DTO 필드명(fiveElement·resourceElement)은 그대로다.
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

    // [2026-10-22 S4 삭제] StrokeToElement — 획수 끝자리 → 오행 대체값(자원오행 보완 30 에서 FiveElement 가 비었을 때). 계획 §3-1:
    // 자원오행이 없으면(등급 U) 오행 없음으로 둔다. 2026-10-22 결과 파일 기준 U 0자라 점수 영향 없음.

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

        // 용신을 먼저 계산해 한자 '배정'에 반영(단일 진실의 원천: HanjaSelector).
        // 같은 발음 이름도 사주에 따라 다른 한자 → 다른 자원오행/뜻. (이름 랭킹은 미학 우선 불변)
        string? yPrimary = null, yHee = null, yGi = null;
        try
        {
            var chart0 = _sajuCalculationService.CalculateChart(birthDate, birthTime);
            if (_yongshinCalculationService != null)
            {
                var y0 = _yongshinCalculationService.Calculate(chart0);
                yPrimary = y0.PrimaryYongshin; yHee = y0.Heeshin; yGi = y0.Gishin;
            }
        }
        catch { /* 용신 계산 실패 → 용신 없이 인명 빈출/성별 기준으로만 선택 */ }

        // 각 음절에서 한자 선택 — 점수·표시·저장이 공유할 단일 결과
        var selectedHanja = HanjaSelector.Select(name, gender, yPrimary, yHee, yGi);
        breakdown.SelectedHanja = selectedHanja;
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

        // 1. 자원오행 보완 (30점 만점) — 배정 한자의 부수 기준 자원오행 ↔ 사주 용신·부족/과다 오행
        breakdown.FiveElementScore = CalculateFiveElementScore(selectedHanja, birthDate, birthTime, breakdown.Notes);

        // 2. 획수 조화 (20점 만점) — 이름 두 글자 획수 합의 구간 (필드명 ResourceElementScore 는 호환으로 유지)
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

    // ===== 한자 선택 → Utils/HanjaSelector.cs 로 이관 (용신-인지 단일 진실의 원천) =====

    private static GenderPreference ParseGenderPref(string gender) => gender?.ToLowerInvariant() switch
    {
        "male" => GenderPreference.Male,
        "female" => GenderPreference.Female,
        _ => GenderPreference.Neutral
    };

    // ===== 자원오행 보완 점수 (30점 만점 — 내부 100점 기준을 0.3 배) =====

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

        // 용신·희신·기신 — 아래 보조 부족/과다 노트가 같은 오행을 반대 방향으로 말할 때 문구를 맞추는 데만 쓴다.
        string? yongPrimary = null, yongHee = null, yongGi = null;

        // ── 용신 기반 가산 (가장 정확한 보완 평가) ──────────────────
        // 용신 = 일간 강약·조후를 종합해 도출한 "꼭 필요한 오행"
        // 단순 lacking 판단보다 우선
        if (_yongshinCalculationService != null)
        {
            try
            {
                var yongshin = _yongshinCalculationService.Calculate(chart);
                yongPrimary = yongshin.PrimaryYongshin;
                yongHee = yongshin.Heeshin;
                yongGi = yongshin.Gishin;

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
        // 조후법 용신은 사주에 이미 많은 오행일 수 있어, 같은 오행이 "용신 보완"(가점)과
        // "과다한 오행 증가"(감점)로 나란히 떠 모순처럼 읽혔다(이서연·제갈하늘·남궁민 실측).
        // 점수는 그대로 두고 문구만 "가점 일부 상쇄"로 이어 읽히게 한다 — 감점 제외는 HarmonyScore와
        // /name 점수 데이터가 바뀌는 일이라 별도 작업.
        foreach (var el in lackingElements)
        {
            if (elements.ContainsKey(el) && elements[el] > 0)
            {
                score += 10; // 용신 가산보다 약하게 (기존 20 → 10)
                notes.Add(el == yongGi
                    ? $"기신 '{el}' — 사주에 부족한 오행이라 감점 일부 상쇄"
                    : $"부족한 오행 '{el}' 보완");
            }
        }

        foreach (var el in excessiveElements)
        {
            if (elements.ContainsKey(el) && elements[el] > 0)
            {
                score -= 10; // 기존 15 → 10
                notes.Add(el == yongPrimary ? $"용신 '{el}' — 사주에 이미 많은 오행이라 가점 일부 상쇄 (감점)"
                    : el == yongHee ? $"희신 '{el}' — 사주에 이미 많은 오행이라 가점 일부 상쇄 (감점)"
                    : $"과다한 오행 '{el}' 증가 (감점)");
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
    /// 한자의 자원오행(부수 기준 — HanjaData.FiveElement). 미상(U)이면 빈 문자열 — 획수 끝자리 대체값은 쓰지 않는다(2026-10-22 S4).
    /// </summary>
    private static string GetFiveElement(HanjaInfo? hanja) => hanja?.FiveElement ?? string.Empty;

    // ===== 획수 조화 점수 (20점 만점 — 옛 이름 '자원오행', 오행은 쓰지 않는다) =====

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
                // Core 데이터(강희 획수를 정리한 코어 글자)가 아니면 획수 자료 미검수 — 보수적으로 감산.
                // 2026-10-22 S4 전에는 옛 등급 C·D 로 판정했다(옛 C·D ⇔ Core 아님, 옛 B 0자 — 같은 동작)
                if (!hanja.IsCoreData)
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

        // 획수 자료 신뢰도 가중치 — 미검수 획수가 섞이면 점수를 보수적으로 조정
        // Core 데이터: 1.0 (영향 없음)
        // Core 아님(획수 자료 미검수): 0.85
        // 획수 미상: 0.75 (큰 감산)
        if (hasUnknownStroke)
        {
            score = (int)Math.Round(score * 0.75);
            notes.Add("일부 한자 획수 정보 부족 — 획수 조화 신뢰도 감산");
        }
        else if (hasLowConfidence)
        {
            score = (int)Math.Round(score * 0.85);
            // 사용자 노트 — 내부 코드 대신 한국어 문장으로 쓴다.
            notes.Add("획수 자료 미검수 글자 포함 — 획수 조화 점수 보수적 산출");
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

    /// <summary>
    /// 표시용 등급 말 — '대흉/대길' 같은 길흉 단정 대신 "전통적으로 어떻게 분류하는 수인지"로 쓴다.
    /// 수리 길흉은 전통 성명학의 분류일 뿐 검증된 주장이 아니어서(국민 다빈도 이름 김민준에도
    /// '대흉' 2개가 붙었다) 노트 머리에 '전통 81수리, 참고'를 함께 밝힌다. 점수(GradeScore)는 그대로.
    /// </summary>
    private static string GradeLabel(SuriGrade g) => g switch
    {
        SuriGrade.GreatFortune => "길한 수",
        SuriGrade.MediumFortune => "비교적 길한 수",
        SuriGrade.Neutral => "보통",
        SuriGrade.MinorMisfortune => "다소 꺼리는 수",
        SuriGrade.GreatMisfortune => "피하는 수",
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

        notes.Add($"수리사격(전통 81수리, 참고): 원격 {won}({GradeLabel(wonGrade)}) · 형격 {hyeong}({GradeLabel(hyeongGrade)}) · " +
                  $"이격 {i}({GradeLabel(iGrade)}) · 정격 {jeong}({GradeLabel(jeongGrade)})");

        // 이 엔진의 한자는 늘 HanjaSelector가 자동 배정한 것이다(평가 입력에 한자 선택이 없음) —
        // 순우리말 이름(제갈하늘 → 荷+乻)에도 획수 수리가 매겨지므로, 기준 한자와 달라질 수 있음을 함께 알린다.
        // 성씨 획수도 GetSurnameStrokeCount가 독음 1순위 한자로 추정한 값이라(이→11획, 남궁→첫 글자만) 함께 밝힌다.
        // (성씨 대표 한자 표로 바로잡는 건 HarmonyScore가 바뀌는 일이라 재생성·감사 묶음에서 — BT-3.)
        if (selectedHanja.Any(h => h != null))
            notes.Add("획수는 성씨와 이름 음절에 자동으로 고른 한자 기준이에요(성씨 한자도 추정이에요). " +
                      "실제 한자가 다르면 수리가 달라질 수 있어요.");

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
