using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Tests;

/// <summary>
/// 조화 엔진 '자동 배정 경로' 고정 (2026-11-19 — 한자 입력 설계서 §13-1 ⑯ 의 '먼저 고정' 부분).
/// /evaluate 에 사용자가 고른 한자(picks)를 잇기 **전에** 쓴 테스트다. 그때의 HarmonyEngine 산식을 아래 <see cref="Reference"/> 에 그대로 옮겨 두고,
/// 격자(이름 × 성씨 × 출생일·시각 × 성별)에서 지금 엔진 출력(점수·breakdown·노트·배정 한자)이 그 사본과 글자까지 같은지 본다.
/// 기대값을 숫자로 적어 두지 않는 까닭: 사주 계산(절기·시주)이 바뀌면 용신과 배정 한자가 함께 움직인다 — 사본은 같은 사주·용신 서비스로 그때그때 다시 센다.
///
/// 지키는 것: 한자를 지정하지 않은 요청(picks == null)은 예전 분기를 그대로 탄다. 한자 입력 작업이 엔진에 넣는 것 —
/// 선택 인자 picks, 성별 보정의 '쓸 수 없는 글자 건너뛰기' 한 줄, 부족·과다 오행 식의 공용 헬퍼 이동 — 은 이 격자의 출력을 한 글자도 바꾸지 않아야 한다.
///
/// ⚠️ <see cref="Reference"/> 는 2026-11-19(커밋 4e26e0e)의 산식 사본이다. 엔진을 손보다 이 테스트가 깨지면 사본을 고치지 말고 엔진을 다시 볼 것.
/// 조화 산식을 일부러 바꾸는 날에만(사용자 결정) 같은 커밋에서 사본을 함께 고친다.
/// </summary>
public class HarmonyAutoPathPinTests
{
    private readonly SajuCalculationService _saju = new();
    private readonly YongshinCalculationService _yongshin = new();

    public HarmonyAutoPathPinTests()
    {
        HanjaData.LoadExternalData();
    }

    // 이름 — 인기 이름, 성별 값이 있는 글자가 배정되는 이름, 순우리말 음절·쓸 글자 없는 음절(획수 추정·기본값 분기), 약자뿐인 음절, 1·3음절
    private static readonly string[] Names =
    {
        "서윤", "지우", "민준", "서연", "하준", "도윤", "지호", "유찬", "혜성", "규빈", "다인", "채원", "시우", "은우", "수아", "건우", "예린",
        "미소", "도현", "혜준", "영자", "연우", "유림", "나은", "율", "린",
        "한빛", "하늘", "봄", "빛봄", "새벽", "한결", "다온", "쁨",
        "몰닉", "괵", "퍅쁨", "에덴", "핍", "뉵",
        "녀", "토리", "북", "늑",
        "민", "준", "솔", "건",
        "서아린", "하늘빛", "아리솔", "빛나래",
    };

    // 성씨 — 대표 한자 표(외자·복성·두음 표기), 표 밖(독음 추정), 한자 독음이 없는 글자(획수 0)
    private static readonly string[] Surnames = { "김", "이", "박", "남궁", "유", "민", "황보", "류", "탕", "쁨", "뱅" };

    private static readonly (string Date, string? Time)[] Births =
    {
        ("2024-03-15", null),
        ("2021-07-08", "09:30"),
        ("2023-11-20", null),
        ("2019-12-31", "23:40"),   // 야자시
        ("2022-02-04", "05:10"),   // 입춘 무렵
        ("2000-06-15", "12:00"),
        ("2025-01-01", null),
    };

    private static readonly string[] Genders = { "male", "female", "none" };

    /// <summary>이름 × 출생일 × 성별 전부(성씨는 돌려 가며 하나씩) + 이름 몇 개 × 성씨 전부.</summary>
    public static IEnumerable<(string Name, string LastName, DateTime Date, TimeSpan? Time, string Gender)> Grid()
    {
        int i = 0;
        foreach (var name in Names)
            foreach (var (date, time) in Births)
                foreach (var gender in Genders)
                    yield return (name, Surnames[i++ % Surnames.Length], DateTime.Parse(date),
                        time == null ? null : TimeSpan.Parse(time), gender);

        foreach (var name in new[] { "서윤", "민", "하늘빛", "한빛", "몰닉", "미소" })
            foreach (var lastName in Surnames)
                foreach (var gender in Genders)
                    yield return (name, lastName, new DateTime(2024, 3, 15), null, gender);
    }

    [Fact]
    public async Task Harmony_AutoPath_SameAsReferenceCopy_OnGrid()
    {
        var engine = new HarmonyEngine(_saju, _yongshin);
        var reference = new Reference(_saju, _yongshin);
        var diffs = new List<string>();
        int rows = 0, withGenderBonus = 0, withFallback = 0, allFallback = 0;

        foreach (var (name, lastName, date, time, gender) in Grid())
        {
            rows++;
            var actual = await engine.CalculateScoreWithBreakdownAsync(name, lastName, date, gender, time);
            var expected = reference.Calculate(name, lastName, date, gender, time);
            if (expected.GenderBonus != 0) withGenderBonus++;
            if (expected.UsedFallback) withFallback++;
            if (expected.SelectedHanja.All(h => h == null)) allFallback++;

            var a = Describe(actual);
            var e = Describe(expected);
            if (a != e)
                diffs.Add($"{lastName}{name} {date:yyyy-MM-dd} {time} {gender}\n  기대 {e}\n  실제 {a}");
        }

        Assert.True(diffs.Count == 0, $"자동 배정 경로의 조화 출력이 기준 사본과 다른 행 {diffs.Count}/{rows}:\n" + string.Join("\n", diffs.Take(10)));

        // 격자가 비어 있지 않은지 — 성별 보정·획수 추정·기본값 분기를 실제로 지난다
        Assert.True(rows >= 1000, $"격자 {rows}행");
        Assert.True(withGenderBonus >= 20, $"성별 보정이 0 이 아닌 행 {withGenderBonus}");
        Assert.True(withFallback >= 100, $"대체값을 쓴 행 {withFallback}");
        Assert.True(allFallback >= 20, $"전 음절 한자 없음 행 {allFallback}");
    }

    /// <summary>용신 서비스 없이 만든 엔진(2인자 생성자가 아닌 1인자 — 용신 가산 없음)도 같은 사본과 같다.</summary>
    [Fact]
    public async Task Harmony_AutoPath_WithoutYongshinService_SameAsReferenceCopy()
    {
        var engine = new HarmonyEngine(_saju);
        var reference = new Reference(_saju, null);
        foreach (var name in new[] { "서윤", "지우", "한빛", "몰닉", "하늘빛", "민" })
            foreach (var gender in Genders)
            {
                var date = new DateTime(2023, 11, 20);
                var actual = await engine.CalculateScoreWithBreakdownAsync(name, "김", date, gender);
                Assert.Equal(Describe(reference.Calculate(name, "김", date, gender, null)), Describe(actual));
            }
    }

    private static string Describe(HarmonyBreakdown b) =>
        $"total={b.TotalScore} five={b.FiveElementScore} stroke={b.ResourceElementScore} yy={b.YinYangScore} pron={b.PronunciationElementScore} " +
        $"suri={b.SuriSagyeokScore} surname={b.SurnameHarmonyScore} gender={b.GenderBonus} fallback={b.UsedFallback} " +
        $"hanja=[{string.Join(",", b.SelectedHanja.Select(h => h?.Character ?? "∅"))}] notes=[{string.Join(" | ", b.Notes)}]";

    /// <summary>
    /// 2026-11-19(커밋 4e26e0e) HarmonyEngine.CalculateScoreWithBreakdownAsync 의 산식 사본 — 한자 배정(HanjaSelector.Select)·성씨 획수(SurnameData.ResolveStrokes)·
    /// 획수 구간(FortuneUtils)·음령오행(KoreanUtils)·사주·용신 서비스는 엔진과 같은 공용 함수를 부르고, 엔진 안의 식·문장·순서만 옮겼다.
    /// </summary>
    private sealed class Reference
    {
        private readonly ISajuCalculationService _saju;
        private readonly IYongshinCalculationService? _yongshin;

        public Reference(ISajuCalculationService saju, IYongshinCalculationService? yongshin)
        {
            _saju = saju;
            _yongshin = yongshin;
        }

        public HarmonyBreakdown Calculate(string name, string lastName, DateTime birthDate, string gender, TimeSpan? birthTime)
        {
            var breakdown = new HarmonyBreakdown();

            string? yPrimary = null, yHee = null, yGi = null;
            try
            {
                var chart0 = _saju.CalculateChart(birthDate, birthTime);
                if (_yongshin != null)
                {
                    var y0 = _yongshin.Calculate(chart0);
                    yPrimary = y0.PrimaryYongshin; yHee = y0.Heeshin; yGi = y0.Gishin;
                }
            }
            catch { }

            var selectedHanja = HanjaSelector.Select(name, gender, yPrimary, yHee, yGi);
            breakdown.SelectedHanja = selectedHanja;
            bool anyFallback = selectedHanja.Any(h => h == null);

            if (selectedHanja.All(h => h == null))
            {
                breakdown.UsedFallback = true;
                breakdown.FiveElementScore = 14;
                breakdown.ResourceElementScore = 10;
                breakdown.YinYangScore = 5;
                breakdown.PronunciationElementScore = PronunciationElement(lastName, name, breakdown.Notes);
                breakdown.SuriSagyeokScore = 7;
                breakdown.GenderBonus = 0;
                breakdown.Notes.Add("배정할 한자가 없어 기본값을 사용했습니다");
                breakdown.TotalScore = Math.Max(0, Math.Min(100,
                    breakdown.FiveElementScore + breakdown.ResourceElementScore +
                    breakdown.YinYangScore + breakdown.PronunciationElementScore +
                    breakdown.SuriSagyeokScore));
                return breakdown;
            }

            breakdown.FiveElementScore = FiveElement(selectedHanja, birthDate, birthTime, breakdown.Notes);
            breakdown.ResourceElementScore = StrokeHarmony(selectedHanja, name, breakdown.Notes);
            breakdown.YinYangScore = YinYang(selectedHanja, breakdown.Notes);
            breakdown.PronunciationElementScore = PronunciationElement(lastName, name, breakdown.Notes);
            breakdown.SuriSagyeokScore = Suri(lastName, selectedHanja, breakdown.Notes);

            breakdown.GenderBonus = GenderBonus(selectedHanja, gender);
            if (breakdown.GenderBonus != 0)
            {
                breakdown.Notes.Add(breakdown.GenderBonus > 0
                    ? $"성별 선호도 일치 (+{breakdown.GenderBonus})"
                    : $"성별 선호도 불일치 ({breakdown.GenderBonus})");
            }

            if (anyFallback)
            {
                breakdown.UsedFallback = true;
                breakdown.Notes.Add("일부 음절에 배정할 한자가 없어 획수 기반 추정을 사용했습니다");
            }

            int raw = breakdown.FiveElementScore
                    + breakdown.ResourceElementScore
                    + breakdown.YinYangScore
                    + breakdown.PronunciationElementScore
                    + breakdown.SuriSagyeokScore
                    + breakdown.GenderBonus;

            breakdown.TotalScore = Math.Max(0, Math.Min(100, raw));
            return breakdown;
        }

        private int FiveElement(List<HanjaInfo?> selectedHanja, DateTime birthDate, TimeSpan? birthTime, List<string> notes)
        {
            var elements = new Dictionary<string, int>
            {
                { "木", 0 }, { "火", 0 }, { "土", 0 }, { "金", 0 }, { "水", 0 }
            };

            int resolvedCount = 0;
            foreach (var hanja in selectedHanja)
            {
                string element = hanja?.FiveElement ?? string.Empty;
                if (!string.IsNullOrEmpty(element) && elements.ContainsKey(element))
                {
                    elements[element]++;
                    resolvedCount++;
                }
            }

            if (resolvedCount == 0)
                return 18;

            var chart = _saju.CalculateChart(birthDate, birthTime);
            var sajuElements = chart.FiveElementCount;
            double avg = sajuElements.Values.Average();
            var lackingElements = sajuElements.Where(e => e.Value < avg).Select(e => e.Key).ToList();
            var excessiveElements = sajuElements.Where(e => e.Value > avg * 1.5).Select(e => e.Key).ToList();

            int score = 50;
            string? yongPrimary = null, yongHee = null, yongGi = null;

            if (_yongshin != null)
            {
                try
                {
                    var yongshin = _yongshin.Calculate(chart);
                    yongPrimary = yongshin.PrimaryYongshin;
                    yongHee = yongshin.Heeshin;
                    yongGi = yongshin.Gishin;

                    if (!string.IsNullOrEmpty(yongshin.PrimaryYongshin)
                        && elements.ContainsKey(yongshin.PrimaryYongshin)
                        && elements[yongshin.PrimaryYongshin] > 0)
                    {
                        score += 30;
                        notes.Add($"용신 '{yongshin.PrimaryYongshin}' 보완");
                    }

                    if (!string.IsNullOrEmpty(yongshin.Heeshin)
                        && elements.ContainsKey(yongshin.Heeshin)
                        && elements[yongshin.Heeshin] > 0)
                    {
                        score += 12;
                        notes.Add($"희신 '{yongshin.Heeshin}' 포함");
                    }

                    if (!string.IsNullOrEmpty(yongshin.Gishin)
                        && elements.ContainsKey(yongshin.Gishin)
                        && elements[yongshin.Gishin] > 0)
                    {
                        score -= 25;
                        notes.Add($"기신 '{yongshin.Gishin}' 충돌 (감점)");
                    }
                }
                catch { }
            }

            foreach (var el in lackingElements)
            {
                if (elements.ContainsKey(el) && elements[el] > 0)
                {
                    score += 10;
                    notes.Add(el == yongGi
                        ? $"기신 '{el}' — 사주에 부족한 오행이라 감점 일부 상쇄"
                        : $"부족한 오행 '{el}' 보완");
                }
            }

            foreach (var el in excessiveElements)
            {
                if (el == yongPrimary || el == yongHee) continue;
                if (elements.ContainsKey(el) && elements[el] > 0)
                {
                    score -= 10;
                    notes.Add($"과다한 오행 '{el}' 증가 (감점)");
                }
            }

            var usedElements = elements.Values.Where(v => v > 0).ToList();
            if (usedElements.Count >= 2)
                score += 10;

            score = Math.Max(0, Math.Min(100, score));
            return (int)(score * 0.3);
        }

        private static int StrokeHarmony(List<HanjaInfo?> selectedHanja, string name, List<string> notes)
        {
            var strokeCounts = new List<int>();
            var hasUnknownStroke = false;

            for (int i = 0; i < name.Length; i++)
            {
                var hanja = i < selectedHanja.Count ? selectedHanja[i] : null;
                if (hanja != null && hanja.StrokeCount > 0)
                {
                    strokeCounts.Add(hanja.StrokeCount);
                }
                else
                {
                    strokeCounts.Add(5);
                    hasUnknownStroke = true;
                }
            }

            if (strokeCounts.Count < 2)
                return 15;

            int rawScore = FortuneUtils.EvaluateStrokeCount(strokeCounts[0], strokeCounts[1]);
            int score = (int)(rawScore * 0.2);

            if (hasUnknownStroke)
            {
                score = (int)Math.Round(score * 0.75);
                notes.Add("일부 한자 획수 정보 부족 — 획수 조화 신뢰도 감산");
            }

            return score;
        }

        private static int YinYang(List<HanjaInfo?> selectedHanja, List<string> notes)
        {
            int yinCount = 0;
            int yangCount = 0;

            foreach (var hanja in selectedHanja)
            {
                if (hanja == null) continue;

                string yinYang = hanja.YinYang;
                if (string.IsNullOrEmpty(yinYang) && hanja.StrokeCount > 0)
                    yinYang = hanja.StrokeCount % 2 == 1 ? "陽" : "陰";

                if (yinYang == "陰") yinCount++;
                else if (yinYang == "陽") yangCount++;
            }

            if (yinCount == 0 && yangCount == 0)
                return 10;

            if (yinCount > 0 && yangCount > 0)
                notes.Add($"음양 균형: 陰 {yinCount} / 陽 {yangCount}");
            else if (yinCount > 0)
                notes.Add($"음양: 陰 편중 ({yinCount})");
            else
                notes.Add($"음양: 陽 편중 ({yangCount})");

            int rawScore = FortuneUtils.EvaluateYinYangBalance(yinCount, yangCount);
            return (int)(rawScore * 0.1);
        }

        private static readonly Dictionary<string, string> ShengNext = new()
        {
            ["木"] = "火", ["火"] = "土", ["土"] = "金", ["金"] = "水", ["水"] = "木"
        };
        private static readonly Dictionary<string, string> KeTarget = new()
        {
            ["木"] = "土", ["土"] = "水", ["水"] = "火", ["火"] = "金", ["金"] = "木"
        };

        private static int Relation(string? a, string? b)
        {
            if (a == null || b == null) return 60;
            if (a == b) return 65;
            if (ShengNext.TryGetValue(a, out var next) && next == b) return 100;
            if (KeTarget.TryGetValue(a, out var target) && target == b) return 20;
            return 55;
        }

        private static int PronunciationElement(string lastName, string name, List<string> notes)
        {
            var fullName = lastName + name;
            var elements = fullName.Select(KoreanUtils.GetEumryeongFiveElement).ToList();

            if (elements.Count < 2)
                return 13;

            var relations = new List<int>();
            for (int i = 0; i < elements.Count - 1; i++)
                relations.Add(Relation(elements[i], elements[i + 1]));

            double avg = relations.Average();

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

            int score = (int)(avg * 0.25);
            return Math.Max(0, Math.Min(25, score));
        }

        private enum Grade { GreatFortune, MediumFortune, Neutral, MinorMisfortune, GreatMisfortune }

        private static readonly HashSet<int> GreatFortuneNumbers = new()
        {
            1, 3, 5, 6, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 25, 29,
            31, 32, 33, 35, 37, 39, 41, 45, 47, 48, 52, 57, 58,
            61, 63, 65, 67, 68, 73, 81
        };
        private static readonly HashSet<int> MediumFortuneNumbers = new() { 38, 75 };
        private static readonly HashSet<int> NeutralNumbers = new() { 27, 51 };
        private static readonly HashSet<int> GreatMisfortuneNumbers = new()
        {
            2, 4, 9, 10, 12, 14, 19, 20, 22, 28, 34, 42, 43, 44, 46, 49,
            53, 54, 56, 59, 62, 69, 70, 74, 76, 77, 78, 79, 80
        };

        private static Grade GradeOf(int n)
        {
            if (n <= 0) return Grade.Neutral;
            int v = n > 81 ? n % 81 : n;
            if (v == 0) v = 81;

            if (GreatFortuneNumbers.Contains(v)) return Grade.GreatFortune;
            if (MediumFortuneNumbers.Contains(v)) return Grade.MediumFortune;
            if (NeutralNumbers.Contains(v)) return Grade.Neutral;
            if (GreatMisfortuneNumbers.Contains(v)) return Grade.GreatMisfortune;
            return Grade.MinorMisfortune;
        }

        private static string Label(Grade g) => g switch
        {
            Grade.GreatFortune => "길한 수",
            Grade.MediumFortune => "비교적 길한 수",
            Grade.Neutral => "보통",
            Grade.MinorMisfortune => "다소 꺼리는 수",
            Grade.GreatMisfortune => "피하는 수",
            _ => "?"
        };

        private static int Points(Grade g) => g switch
        {
            Grade.GreatFortune => 4,
            Grade.MediumFortune => 3,
            Grade.Neutral => 2,
            Grade.MinorMisfortune => 1,
            Grade.GreatMisfortune => 0,
            _ => 2
        };

        private static int Suri(string lastName, List<HanjaInfo?> selectedHanja, List<string> notes)
        {
            var surname = SurnameData.ResolveStrokes(lastName);
            int s = surname.Strokes;
            var nameStrokes = selectedHanja.Select(h => h?.StrokeCount ?? 0).ToList();

            int unknown = nameStrokes.Count(x => x == 0) + (s == 0 ? 1 : 0);
            if (unknown > nameStrokes.Count / 2 + 1)
            {
                notes.Add("수리사격: 획수 정보 부족으로 계산 생략");
                return 7;
            }

            int ch1 = nameStrokes.Count > 0 ? nameStrokes[0] : 0;
            int ch2 = nameStrokes.Count > 1 ? nameStrokes[1] : 0;

            int won = ch1;
            int hyeong = s + ch1;
            int i = nameStrokes.Count > 1 ? ch1 + ch2 : ch1;
            int jeong = s + nameStrokes.Sum();

            var wonGrade = GradeOf(won);
            var hyeongGrade = GradeOf(hyeong);
            var iGrade = GradeOf(i);
            var jeongGrade = GradeOf(jeong);

            int totalPoints = Points(wonGrade) + Points(hyeongGrade) + Points(iGrade) + Points(jeongGrade);

            notes.Add($"수리사격(전통 81수리, 참고): 원격 {won}({Label(wonGrade)}) · 형격 {hyeong}({Label(hyeongGrade)}) · " +
                      $"이격 {i}({Label(iGrade)}) · 정격 {jeong}({Label(jeongGrade)})");

            if (selectedHanja.Any(h => h != null))
                notes.Add(surname.FromTable && s > 0
                    ? $"획수는 성씨의 가장 흔한 한자({surname.Hanja})와 이름 음절에 자동으로 고른 한자로 추정했어요. " +
                      "실제 한자가 다르면 수리가 달라질 수 있어요."
                    : "획수는 성씨와 이름 음절에 자동으로 고른 한자 기준이에요(성씨 한자도 추정이에요). " +
                      "실제 한자가 다르면 수리가 달라질 수 있어요.");

            return (int)Math.Round(totalPoints * (15.0 / 16.0));
        }

        private static int GenderBonus(List<HanjaInfo?> selectedHanja, string gender)
        {
            if (string.IsNullOrEmpty(gender) || gender.Equals("none", StringComparison.OrdinalIgnoreCase))
                return 0;

            var genderPref = gender.ToLowerInvariant() switch
            {
                "male" => GenderPreference.Male,
                "female" => GenderPreference.Female,
                _ => GenderPreference.Neutral
            };
            if (genderPref == GenderPreference.Neutral)
                return 0;

            int bonus = 0;
            foreach (var hanja in selectedHanja)
            {
                if (hanja == null) continue;
                if (hanja.GenderPref == GenderPreference.Neutral) continue;

                if (hanja.GenderPref == genderPref)
                    bonus += 5;
                else
                    bonus -= 3;
            }

            return bonus;
        }
    }
}
