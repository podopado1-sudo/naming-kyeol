using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;

namespace NameForm.Tests;

/// <summary>
/// 2026-10-23 배포 운영 검증에서 확정된 백엔드 버그 회귀 (2026-10-26 수정):
///   B1 인명용 목록 누락 50자(critic gap 1) · B3 획수 조화 '미검수' ×0.85 폐기(API-4) ·
///   B6 weak 는 비약자 대안이 있으면 성별·용신과 무관하게 양보(API-1) · B7 의미 메모의 독음 맞춤 훈(API-2) ·
///   B8 /name-analysis 후보 = 표시 정렬(API-3).
/// 기대값은 운영 재현 사례(박지훈 남=葷, 지훈 여=煇 '빛날 휘', 서진 서=西, 김노아 努→璐)와 데이터 파일에서 독립으로 뽑는다.
/// </summary>
public class OpsVerificationRegressionTests
{
    private readonly SajuCalculationService _saju = new();
    private readonly YongshinCalculationService _yongshin = new();

    public OpsVerificationRegressionTests()
    {
        HanjaData.LoadExternalData();
    }

    private static string Cp(int codepoint) => char.ConvertFromUtf32(codepoint);

    /// <summary>"西(서, 서녘 서)" → "西" (확장 영역 서로게이트 쌍도 그대로).</summary>
    private static string OptionChar(string option)
    {
        int open = option.IndexOf('(');
        return open > 0 ? option[..open] : option;
    }

    private NameEvaluationService CreateEvaluationService() => new(
        new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine()),
        new ExplanationEngine());

    private NameAnalysisService CreateAnalysisService() => new(
        new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine()),
        new AestheticEngine(),
        new RarityScoringEngine(),
        new ExplanationEngine(),
        new NameReversalEngine(),
        _saju,
        _yongshin,
        Microsoft.Extensions.Logging.Abstractions.NullLogger<NameAnalysisService>.Instance);

    /// <summary>의미 메모 "智(지, 슬기 지) + 煇(훈, 태울 훈) — …" → [(글자, 괄호 독음, 훈)]</summary>
    private static List<(string Char, string Syllable, string Gloss)> ParseMeaningParts(string meaningNote)
    {
        var parts = new List<(string, string, string)>();
        foreach (var part in meaningNote.Split(" — ")[0].Split(" + "))
        {
            var m = Regex.Match(part, @"^(?<c>[^(]+)\((?<s>[^,]+), (?<g>.*)\)$");
            Assert.True(m.Success, $"의미 메모 조각 형식: {part}");
            parts.Add((m.Groups["c"].Value, m.Groups["s"].Value, m.Groups["g"].Value));
        }
        return parts;
    }

    private static string RepoRoot([CallerFilePath] string thisFile = "")
    {
        foreach (var start in new[] { Path.GetDirectoryName(thisFile), AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            for (var dir = string.IsNullOrEmpty(start) ? null : new DirectoryInfo(start); dir != null; dir = dir.Parent)
                if (File.Exists(Path.Combine(dir.FullName, "NameForm.csproj"))) return dir.FullName;
        }
        throw new InvalidOperationException("저장소 루트(NameForm.csproj)를 찾지 못함");
    }

    // ═══════════════════════════════════════════════════════════════
    // B1 — 인명용 목록 소속 = data-gov.csv ∪ data-naver.csv
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// 공식 CSV 의 한자 칸을 직접 읽는다(로더와 독립) — gov 는 마지막 칸(앞 독음 칸이 "내,래"처럼 따옴표로 묶여 있다),
    /// naver 는 6칸 고정(따옴표 없음)의 넷째 칸. 유니코드 칸과 한자 칸이 같은 글자인지도 함께 확인한다.
    /// </summary>
    private static HashSet<string> ReadOfficialCsvHanja(string file)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "data", file);
        Assert.True(File.Exists(path), $"공식 CSV 없음: {path}");
        var set = new HashSet<string>(StringComparer.Ordinal);
        foreach (var line in File.ReadLines(path).Skip(1))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var cols = line.Split(',');
            string hanja, unicode;
            if (file == "data-naver.csv")
            {
                Assert.Equal(6, cols.Length);
                (unicode, hanja) = (cols[2], cols[3]);
            }
            else
            {
                (unicode, hanja) = (cols[^2], cols[^1]);
            }
            Assert.Equal(char.ConvertFromUtf32(Convert.ToInt32(unicode, 16)), hanja);
            if (HanjaData.IsHanCodePoint(hanja)) set.Add(HanjaData.ToUnifiedHanja(hanja));
        }
        return set;
    }

    [Fact]
    public void GovernmentListed_EqualsUnionOfOfficialCsvs()
    {
        var gov = ReadOfficialCsvHanja("data-gov.csv");
        var naver = ReadOfficialCsvHanja("data-naver.csv");
        var expected = new HashSet<string>(gov, StringComparer.Ordinal);
        expected.UnionWith(naver);

        var all = HanjaData.GetAllHanja();
        var wrong = all.Where(h => h.IsGovernmentListed != expected.Contains(h.Character))
            .Select(h => $"{h.Character}({(h.IsGovernmentListed ? "표시됨" : "빠짐")})").Take(20).ToList();
        Assert.True(wrong.Count == 0, $"인명용 표시가 두 공식 CSV 와 다름: {string.Join(" ", wrong)}");

        // 두 CSV 어디에도 없는 적재 글자 — 사전이 두 CSV 의 합집합이라 0자여야 한다(생기면 목록으로 보고)
        var unlisted = all.Where(h => !expected.Contains(h.Character)).Select(h => h.Character).ToList();
        Assert.True(unlisted.Count == 0, $"두 공식 CSV 어디에도 없는 글자 {unlisted.Count}자: {string.Join("", unlisted.Take(50))}");

        // 이번 수정이 실제로 메운 범위: gov 만으로는 빠지던 글자가 있고(2026-10-26 기준 50자), 모두 naver 근거다
        var govOnlyMissing = all.Where(h => !gov.Contains(h.Character)).Select(h => h.Character).ToList();
        Assert.NotEmpty(govOnlyMissing);
        Assert.All(govOnlyMissing, c => Assert.Contains(c, naver));
    }

    [Theory]
    [InlineData(0x52AA)] // 努 힘쓸 노 — data-gov.csv ㄴ 구획이 '냉'(1636행) 뒤 바로 '다'라 순수 '노' 행 0
    [InlineData(0x80FD)] // 能 능할 능
    [InlineData(0x8FB2)] // 農 농사 농
    [InlineData(0x8166)] // 腦 골 뇌
    [InlineData(0x8A25)] // 訥 말 더듬거릴 눌
    [InlineData(0x59EC)] // 姬 여자 희 — gov 에는 姫(U+59EB)로만, naver 에는 姬 그대로
    [InlineData(0x6E2F)] // 港 항구 항 — gov 같은 독음 자리에 법원 자체 코드(U+F153F)만
    [InlineData(0x73CA)] // 珊 산호 산
    [InlineData(0x615C)] // 慜 총명할 민
    [InlineData(0x5195)] // 冕 면류관 면
    public void GovernmentListed_PreviouslyMissingChars(int codepoint)
    {
        var h = HanjaData.FindByCharacter(Cp(codepoint));
        Assert.NotNull(h);
        Assert.True(h!.IsGovernmentListed, $"{Cp(codepoint)}: 인명용 목록 외로 남음");
    }

    [Fact]
    public void GovernmentListed_NoLongerHandicapsNo()
    {
        // 운영 실측(10/23): 김노아 努→璐 — 努이 gov +500 을 못 받아 '노' 표시 1순위가 璐(아름다운 옥 로(노))였다.
        // 2026-10-27 성별 규칙 감사로 努 '힘쓸'이 Male → Neutral((c) 형용사 삭제)이 되자 관련도의 '성별 있음 +5'를 잃어 璐(Female)가 5점 차로
        // 다시 앞선다 — gov +500 은 그대로 받고(아래), 두 글자의 차이는 성별 +5 하나뿐이다(표시 1·2순위). 성별 없는 표시 정렬에서만 +5 를 빼는 안은
        // 같은 날 시험 뒤 되돌렸다(OrderForDisplay_GenderLabelBonus_KeepsNameFriendlyFirst). 남자 노아는 /name·/evaluate(남) 모두 努亞.
        var nu = HanjaData.FindByCharacter(Cp(0x52AA))!;
        var ro = HanjaData.FindByCharacter(Cp(0x7490))!;
        Assert.True(nu.IsGovernmentListed);
        Assert.Equal(HanjaData.CalculateRelevanceScore(ro) - HanjaData.GenderLabelRelevanceBonus, HanjaData.CalculateRelevanceScore(nu));
        Assert.Equal(new[] { ro.Character, nu.Character }, HanjaSelector.TopForDisplay("노", 2).Select(h => h.Character));
        Assert.Equal(Cp(0x52AA), HanjaSelector.SelectCombos("노아", "male", 4)[0].First);
    }

    /// <summary>
    /// 성별 없는 표시 정렬(OrderForDisplay — /name-analysis 출생일 없는 큰 카드·후보 카드, '한자 예' 폴백, 희귀 성씨 HanjaOptions, 필수 글자 뜻 줄)은
    /// 관련도의 '성별 값 있음 +5'를 그대로 쓴다 — 관련도 동점이 많아 이 +5 가 꽃·옥처럼 성별 결이 뚜렷한 훈을 앞세운다. 2026-10-27 표시 정렬에서만 +5 를 빼 보니
    /// 동점이 코드포인트 순으로 깨져 연 蓮→然 '그럴'·하 荷→夏·영 榮→映·화 花→和·보 寶→保 가 되고, 비 상위 10에 剕 '발 벨'·匪 '비적'이 올라
    /// 출생일 없는 큰 카드 첫 글자 HEAD 대비 변화가 1,227 → 1,352명으로 늘었다(서연 /name 書蓮 ↔ 큰 카드 書然). 그래서 되돌렸다.
    /// </summary>
    [Theory]
    [InlineData("연", 0x84EE)] // 蓮 연꽃 련(연) — 然 '그럴 연'이 아니라
    [InlineData("하", 0x8377)] // 荷 연꽃 하 — 夏 가 아니라
    [InlineData("영", 0x69AE)] // 榮 영화 영 — 映 이 아니라
    [InlineData("화", 0x82B1)] // 花 꽃 화 — 和 가 아니라
    [InlineData("보", 0x5BF6)] // 寶 보배 보 — 保 가 아니라
    public void OrderForDisplay_GenderLabelBonus_KeepsNameFriendlyFirst(string syllable, int expected)
    {
        Assert.Equal(Cp(expected), HanjaSelector.TopForDisplay(syllable, 1)[0].Character);
        var bi = HanjaSelector.TopForDisplay("비", 10).Select(h => h.Character).ToList();
        Assert.DoesNotContain(Cp(0x5255), bi); // 剕 발 벨 비
        Assert.DoesNotContain(Cp(0x532A), bi); // 匪 비적 비
    }

    // ═══════════════════════════════════════════════════════════════
    // B3 — 획수 조화: Core 여부로 감산하지 않는다(획수 미상 ×0.75 만 유지)
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("도윤", "윤", "2025-01-20", "08:00", "male")]   // 운영: 度·閏(코어 아님) → '미검수' ×0.85 (16 → 14)
    [InlineData("예린", "강", "2023-11-02", null, "female")]   // 운영: 叡(코어 아님)·璘 → (12 → 10)
    [InlineData("서진", "김", "2021-07-02", null, "none")]
    [InlineData("지훈", "박", "2020-03-15", null, "male")]
    public async Task Harmony_StrokeScore_NotReducedForNonCoreHanja(
        string name, string lastName, string date, string? time, string gender)
    {
        var engine = new HarmonyEngine(_saju, _yongshin);
        var b = await engine.CalculateScoreWithBreakdownAsync(name, lastName, DateTime.Parse(date), gender,
            time == null ? null : TimeSpan.Parse(time));

        Assert.Equal(name.Length, b.SelectedHanja.Count);
        Assert.All(b.SelectedHanja, h => Assert.True(h != null && h.StrokeCount > 0));
        // 독립 기대값: 두 글자 획수 합 구간 점수의 20점 환산 — 감산 없음
        int expected = (int)(FortuneUtils.EvaluateStrokeCount(b.SelectedHanja[0]!.StrokeCount, b.SelectedHanja[1]!.StrokeCount) * 0.2);
        Assert.Equal(expected, b.ResourceElementScore);
        Assert.DoesNotContain(b.Notes, n => n.Contains("미검수") || n.Contains("보수적 산출"));
    }

    [Fact]
    public async Task Harmony_StrokeScore_NonCoreCaseIsCovered()
    {
        // 위 사례에 코어 아닌 배정 글자가 실제로 들어 있어야 회귀가 의미 있다(옛 감산 조건)
        var engine = new HarmonyEngine(_saju, _yongshin);
        var b = await engine.CalculateScoreWithBreakdownAsync("도윤", "윤", new DateTime(2025, 1, 20), "male", new TimeSpan(8, 0, 0));
        Assert.Contains(b.SelectedHanja, h => h != null && !h.IsCoreData);
    }

    [Fact]
    public async Task Harmony_UnknownStroke_StillReduced()
    {
        // 획수 미상(×0.75)은 유지 — 한자가 없는 음절(늬)은 기본 획수 5로 채우고 감산 노트를 단다
        Assert.Empty(HanjaData.FindByReading("늬"));
        var engine = new HarmonyEngine(_saju, _yongshin);
        var b = await engine.CalculateScoreWithBreakdownAsync("서늬", "김", new DateTime(2021, 7, 2), "none");

        Assert.NotNull(b.SelectedHanja[0]);
        Assert.Null(b.SelectedHanja[1]);
        int raw = (int)(FortuneUtils.EvaluateStrokeCount(b.SelectedHanja[0]!.StrokeCount, 5) * 0.2);
        Assert.Equal((int)Math.Round(raw * 0.75), b.ResourceElementScore);
        Assert.Contains(b.Notes, n => n.Contains("획수 정보 부족"));
    }

    // ═══════════════════════════════════════════════════════════════
    // B6 — weak 는 비약자 대안이 하나라도 있으면 늘 양보 (성별·용신 무관)
    // ═══════════════════════════════════════════════════════════════

    public static IEnumerable<object?[]> WeakYieldCases()
    {
        foreach (var syllable in new[] { "훈", "채", "솔" })                 // 운영: 남 葷(훈채)·寨(목책)·帥(장수 수)
            foreach (var gender in new[] { "male", "female", "none" })
                foreach (var yong in new string?[] { null, "木", "火", "土", "金", "水" }) // null = 생년월일 없음
                    yield return new object?[] { syllable, gender, yong };
    }

    [Theory]
    [MemberData(nameof(WeakYieldCases))]
    public void Select_WeakYields_RegardlessOfGenderAndYongshin(string syllable, string gender, string? yongshin)
    {
        var picked = HanjaSelector.Select(syllable, gender, yongshin, null, null)[0];
        Assert.NotNull(picked);
        Assert.False(HanjaData.IsWeakGivenNameHanja(picked!.Character),
            $"'{syllable}'({gender}, 용신 {yongshin ?? "없음"}): 약한 한자 {picked.Character}({picked.Meaning}) — 비약자 대안이 있다");
    }

    [Fact]
    public void Select_WeakYields_AllReadings_UnlessNoAlternative()
    {
        // 전수: 어떤 독음·성별·용신에서도 약자가 뽑혔다면 그 독음의 후보(불용 제외·뜻 보유)가 모두 약자여야 한다
        var readings = HanjaData.GetAllHanja()
            .SelectMany(h => h.AlternateReadings.Prepend(h.Reading))
            .Where(r => !string.IsNullOrEmpty(r) && r.Length == 1)
            .Distinct().ToList();
        var bad = new List<string>();
        foreach (var r in readings)
        {
            var cands = HanjaData.FindByReading(r).Where(h => !HanjaData.IsForbiddenNameHanja(h.Character)).ToList();
            var withMeaning = cands.Where(h => !string.IsNullOrEmpty(h.Meaning)).ToList();
            bool hasAlternative = (withMeaning.Count > 0 ? withMeaning : cands).Any(h => !HanjaData.IsWeakGivenNameHanja(h.Character));
            if (!hasAlternative) continue;
            foreach (var g in new[] { "male", "female", "none" })
                foreach (var y in new string?[] { null, "木", "火", "土", "金", "水" })
                {
                    var p = HanjaSelector.Select(r, g, y, null, null)[0];
                    if (p != null && HanjaData.IsWeakGivenNameHanja(p.Character)) bad.Add($"{r}/{g}/{y ?? "-"}={p.Character}");
                }
        }
        Assert.True(bad.Count == 0, $"대안이 있는데 약자 배정 {bad.Count}건: {string.Join(" ", bad.Take(20))}");
    }

    [Theory]
    [InlineData("male")]
    [InlineData("female")]
    [InlineData("none")]
    public void Select_KeepsWeak_WhenSyllableHasNoAlternative(string gender)
    {
        // '녀'는 후보가 女(weak)뿐 — 대안이 없으면 약자도 남는다(배제가 아니라 양보)
        Assert.Equal("女", HanjaSelector.Select("녀", gender, null, null, null)[0]?.Character);
    }

    [Theory]
    [InlineData("지훈", "박", "male", null, 0x8477)]          // 운영 박지훈(남) = 智+葷(훈채 훈)
    [InlineData("성훈", "김", "male", null, 0x8477)]
    [InlineData("채민", "김", "male", null, 0x5BE8)]          // 김채민(남) = 寨(목책 채)+敏
    [InlineData("한솔", "김", "male", null, 0x5E25)]          // 김한솔(남) = 漢+帥(장수 수)
    [InlineData("지훈", "박", "male", "2020-03-15", 0x8477)]
    [InlineData("채민", "김", "female", "2021-07-02", 0x5BE8)]
    public async Task Evaluate_DoesNotAssignWeakHanja_WhenAlternativeExists(
        string name, string lastName, string gender, string? date, int reportedCodepoint)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(
            name, lastName, date == null ? null : DateTime.Parse(date), gender, "neutral");

        Assert.DoesNotContain(Cp(reportedCodepoint), r.MeaningNote);
        foreach (var (ch, _, _) in ParseMeaningParts(r.MeaningNote))
            Assert.False(HanjaData.IsWeakGivenNameHanja(ch), $"{lastName}{name}({gender}): 배정 {ch} 가 약한 한자 — {r.MeaningNote}");
    }

    // ═══════════════════════════════════════════════════════════════
    // B7 — 의미 메모: 이름 음절에 맞는 훈, 괄호 독음도 그 음절
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("빛날 휘, 햇무리 운, 태울 훈, 벼슬아치 이름 훤, 붉은색 혼", "훈", "태울 훈")]
    [InlineData("빛날 휘, 햇무리 운, 태울 훈, 벼슬아치 이름 훤, 붉은색 혼", "휘", "빛날 휘")]
    [InlineData("연꽃 련(연)", "연", "연꽃 련(연)")]          // 괄호 두음 인정
    [InlineData("연꽃 련(연)", "련", "연꽃 련(연)")]
    [InlineData("잎 엽, 땅 이름 섭", "섭", "땅 이름 섭")]
    [InlineData("임금 주/주인 주/심지 주", "주", "임금 주")]   // 여럿이 맞으면 첫 조각
    [InlineData("땅 이름 얼; 음차 늘", "늘", "음차 늘")]
    [InlineData("슬기 지·지혜 지", "혜", "슬기 지")]           // 맞는 조각이 없으면 첫 훈
    [InlineData("", "지", "")]
    public void GlossForReading_PicksSegmentForSyllable(string meaning, string reading, string expected)
    {
        Assert.Equal(expected, HanjaData.GlossForReading(meaning, reading));
    }

    [Fact]
    public void GlossForReading_SameRegexAsFrontend()
    {
        // 프론트 lib/name-seo.ts glossForReading 과 같은 규칙이어야 /name 카드·dump-combo-glosses·/evaluate 가 같은 훈을 고른다
        var ts = File.ReadAllText(Path.Combine(RepoRoot(), "frontend", "src", "lib", "name-seo.ts"));
        var m = Regex.Match(ts, @"function glossForReading[\s\S]*?s\.match\(/(?<re>.+?)/\)");
        Assert.True(m.Success, "프론트 glossForReading 의 정규식을 찾지 못함");
        Assert.Equal(HanjaData.GlossReadingTailPattern, m.Groups["re"].Value);
    }

    [Theory]
    [InlineData("지훈", 0x667A, 0x7147, "煇(훈, 태울 훈)", "빛날 휘")]       // 운영 지훈(여) = 煇(훈, 빛날 휘)
    [InlineData("지휘", 0x667A, 0x7147, "煇(휘, 빛날 휘)", "태울 훈")]
    [InlineData("경섭", 0x4EAC, 0x8449, "葉(섭, 땅 이름 섭)", "잎 엽")]      // 괄호 독음 = 음절(대표 독음 '엽' 아님)
    [InlineData("서연", 0x745E, 0x84EE, "蓮(연, 연꽃 련(연))", "(련,")]
    public async Task MeaningNote_UsesGlossAndReadingOfNameSyllable(
        string name, int first, int second, string expectedPart, string forbidden)
    {
        var picks = new[] { HanjaData.FindByCharacter(Cp(first)), HanjaData.FindByCharacter(Cp(second)) };
        Assert.All(picks, h => Assert.NotNull(h));

        var engine = new ExplanationEngine();
        var r = await engine.GenerateDetailedReasonsAsync(name, "박", 80, 70, 50, "female", "neutral", null, picks);

        Assert.Contains(expectedPart, r.MeaningNote);
        Assert.DoesNotContain(forbidden, r.MeaningNote);
        // 강점 줄은 같은 문자열을 쓴다(오르면 그대로, 안 오르면 없음)
        Assert.All(r.Strengths.Where(s => s.Contains(" + ")), s => Assert.Equal(r.MeaningNote, s));
    }

    [Theory]
    [InlineData("지훈", "박", "female")]
    [InlineData("지훈", "박", "male")]
    [InlineData("한솔", "김", "male")]
    [InlineData("하늘", "김", "none")]
    [InlineData("경섭", "이", "male")]
    [InlineData("서연", "이", "female")]
    public async Task Evaluate_MeaningNote_GlossMatchesNameSyllable(string name, string lastName, string gender)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(name, lastName, null, gender, "neutral");
        var parts = ParseMeaningParts(r.MeaningNote);
        Assert.Equal(name.Length, parts.Count);
        for (int i = 0; i < parts.Count; i++)
        {
            var (ch, syllable, gloss) = parts[i];
            Assert.Equal(name[i].ToString(), syllable);
            // 독립 기준: 그 글자의 훈 조각 가운데 이 음절로 끝나는(괄호 두음 포함) 조각이 있으면 메모 훈은 그중 하나다
            var segs = HanjaData.FindByCharacter(ch)!.Meaning.Split(',', '/', ';', '·').Select(s => s.Trim()).ToList();
            bool Ends(string s) => s.EndsWith(" " + syllable) || s.EndsWith($"({syllable})");
            if (segs.Any(Ends))
                Assert.True(Ends(gloss), $"{name}: {ch} 의 훈 '{gloss}' 이 음절 '{syllable}' 과 어긋남 — {r.MeaningNote}");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // B8 — /name-analysis 후보 = HanjaSelector.OrderForDisplay 상위 10 (불용 없음·약자 뒤)
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("정", "한별")]  // 운영: 한=寒(찰 한, wk) 첫 카드·恨(한할 한, nf), 별=別(wk)
    [InlineData("김", "서진")]  // 운영: 서=西(서녘 서, wk)·진 줄 塵(티끌 진, nf)
    [InlineData("박", "지우")]  // 운영: 우=雨(비 우, wk)·愚(어리석을 우, nf)
    public async Task Analysis_PossibleHanja_FollowDisplayOrder(string lastName, string firstName)
    {
        var r = await CreateAnalysisService().AnalyzeNameAsync(new NameAnalysisRequestDto
        {
            LastName = lastName, FirstName = firstName, Gender = "none", Tone = "neutral"
        });

        Assert.Equal(firstName.Length, r.HanjaBreakdown.Count);
        var exampleLine = r.Reasons.Single(s => s.StartsWith("한자 예 — "));
        var exampleChars = exampleLine["한자 예 — ".Length..].Split(" — ")[0].Split(" + ").Select(OptionChar).ToList();

        for (int i = 0; i < firstName.Length; i++)
        {
            var b = r.HanjaBreakdown[i];
            var chars = b.PossibleHanja.Select(h => h.Character).ToList();
            Assert.NotEmpty(chars);
            Assert.True(chars.Count <= NameAnalysisService.HanjaOptionsPerSyllable);
            Assert.DoesNotContain(chars, HanjaData.IsForbiddenNameHanja);
            // 약한 글자는 비약자 뒤에만
            var weakFlags = chars.Select(HanjaData.IsWeakGivenNameHanja).ToList();
            Assert.True(weakFlags.SkipWhile(w => !w).All(w => w), $"{b.Syllable}: 약자가 대안보다 앞섬 — {string.Join(" ", chars)}");
            // 같은 표시 경로(단일 진실의 원천)
            Assert.Equal(HanjaSelector.TopForDisplay(b.Syllable, NameAnalysisService.HanjaOptionsPerSyllable).Select(h => h.Character), chars);
            // 큰 카드(첫 후보) = 같은 응답의 '한자 예' 줄 글자
            Assert.Equal(exampleChars[i], chars[0]);
        }
    }

    [Theory]
    [InlineData("한별", 0x6068, 0x5BD2)] // 恨(nf) 없음 · 첫 카드 寒(wk) 아님
    [InlineData("서진", 0x5875, 0x897F)] // 塵(nf) 없음 · 첫 카드 西(wk) 아님
    [InlineData("지우", 0x611A, 0x96E8)] // 愚(nf) 없음 · 첫 카드 雨(wk) 아님
    public async Task Analysis_ReportedCases(string firstName, int forbiddenCp, int weakFirstCp)
    {
        var r = await CreateAnalysisService().AnalyzeNameAsync(new NameAnalysisRequestDto
        {
            LastName = "김", FirstName = firstName, Gender = "none", Tone = "neutral"
        });
        var all = r.HanjaBreakdown.SelectMany(b => b.PossibleHanja.Select(h => h.Character)).ToList();
        Assert.DoesNotContain(Cp(forbiddenCp), all);
        Assert.DoesNotContain(r.HanjaBreakdown, b => b.PossibleHanja.FirstOrDefault()?.Character == Cp(weakFirstCp));
    }

    // ═══════════════════════════════════════════════════════════════
    // B6 보완 — 약자 양보 뒤 새로 1순위에 오른 두더지(惓·斯 등)와 확장 영역 글자(䭱·㘔·㦐)
    // /evaluate 와 같은 인자: 생년월일이 있으면 (용신, 희신 = 용신을 생하는 오행, 기신 = 용신을 극하는 오행) — YongshinCalculationService ⑥
    // ═══════════════════════════════════════════════════════════════

    private static readonly string[] ElementCycle = { "木", "火", "土", "金", "水" };

    /// <summary>용신 하나로 /evaluate 가 Select 에 넘기는 (용신, 희신, 기신) — null 이면 생년월일 없음</summary>
    private static (string? P, string? H, string? G) YongshinTriple(string? primary)
    {
        if (primary == null) return (null, null, null);
        int i = Array.IndexOf(ElementCycle, primary);
        return (primary, ElementCycle[(i + 4) % 5], ElementCycle[(i + 3) % 5]);
    }

    private static List<string> AllSingleReadings() => HanjaData.GetAllHanja()
        .SelectMany(h => h.AlternateReadings.Prepend(h.Reading))
        .Where(r => !string.IsNullOrEmpty(r) && r.Length == 1)
        .Distinct().OrderBy(r => r, StringComparer.Ordinal).ToList();

    [Theory]
    [InlineData("권", "male", "土", 0x60D3)]   // 惓 삼갈 권/싫증날 권 — 김권우·이지권(남, 2019-11-23 용신 土), 옛 배정 勸(weak)
    [InlineData("사", "female", "金", 0x65AF)] // 斯 이 사/천할 사 — 박사랑·박사라(여, 2022-05-31 용신 金), 옛 배정 事(weak)
    [InlineData("사", "none", "金", 0x65AF)]   // 이사랑(none·金) — HEAD 부터 斯
    [InlineData("액", "none", "火", 0x6239)]   // 戹 좁을 액/재앙 액 (불용)
    [InlineData("훤", "none", "金", 0x8AE0)]   // 諠 지껄일 (喧 선례)
    [InlineData("렬", "male", "木", 0x6312)]   // 挒 비틀 (捩 선례) → 다음 颲 사나운 바람도 약자
    [InlineData("해", "male", "木", 0x8344)]   // 荄 풀뿌리 → 다음 廨 공해도 약자 → 楷 본보기
    [InlineData("채", "male", "金", 0x91F5)]   // 釵 비녀
    public void Select_MoleRound_NewPickReplaced(string syllable, string gender, string yongshin, int reportedCodepoint)
    {
        var (p, h, g) = YongshinTriple(yongshin);
        var picked = HanjaSelector.Select(syllable, gender, p, h, g)[0];
        Assert.NotNull(picked);
        Assert.NotEqual(Cp(reportedCodepoint), picked!.Character);
        Assert.False(HanjaData.IsForbiddenNameHanja(picked.Character));
    }

    [Theory]
    [InlineData("권우", "김", "male", "2019-11-23", 0x60D3)]   // 惓
    [InlineData("지권", "이", "male", "2019-11-23", 0x60D3)]
    [InlineData("사랑", "박", "female", "2022-05-31", 0x65AF)] // 斯
    [InlineData("사라", "박", "female", "2022-05-31", 0x65AF)]
    public async Task Evaluate_MoleRound_ReportedCases(string name, string lastName, string gender, string date, int reportedCodepoint)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(name, lastName, DateTime.Parse(date), gender, "neutral");
        Assert.DoesNotContain(Cp(reportedCodepoint), r.MeaningNote);
        foreach (var (ch, _, _) in ParseMeaningParts(r.MeaningNote))
        {
            Assert.False(HanjaData.IsWeakGivenNameHanja(ch), $"{lastName}{name}: 약자 {ch} — {r.MeaningNote}");
            Assert.True(HanjaData.IsInCjkBasicRange(ch), $"{lastName}{name}: 확장 영역 {ch} — {r.MeaningNote}");
        }
    }

    [Theory]
    [InlineData("한별", "정", "female", "2022-05-31")] // 별(여·金) = 䭱 U+4B71 '짙지 않은 향기'
    [InlineData("은별", "정", "female", "2022-05-31")]
    [InlineData("한별", "정", "none", "2022-05-31")]   // 별(none·金) = 㔡 U+3521 '클'
    [InlineData("새론", "김", "male", "2019-11-23")]   // 새(남·土) = 㘔 U+3614 '가득 채울'
    [InlineData("은새", "김", "male", "2022-05-31")]   // 새(남·金) = 㘔
    [InlineData("새론", "김", "male", null)]
    [InlineData("다니", "김", "female", "2019-11-23")] // 니(여·土) = 㦐 U+3990 '마음 좋을'(B1 의 妮 불용 뒤)
    [InlineData("한솔", "김", "male", "2019-11-23")]   // 솔(土) = 䢦 U+48A6 — HEAD 부터
    [InlineData("슬기", "김", "female", "2019-01-05")] // 슬(火) = 𩇣 U+291E3 — HEAD 부터
    public async Task Evaluate_PrefersCjkBasic_OverExtension(string name, string lastName, string gender, string? date)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(
            name, lastName, date == null ? null : DateTime.Parse(date), gender, "neutral");
        foreach (var (ch, _, _) in ParseMeaningParts(r.MeaningNote))
            Assert.True(HanjaData.IsInCjkBasicRange(ch), $"{lastName}{name}({gender}, {date ?? "생년월일 없음"}): 확장 영역 {ch} — {r.MeaningNote}");
    }

    [Fact]
    public void Select_AllReadings_ExtensionOnlyWhenNoBasicAlternative()
    {
        // 전수: 독음 × 성별 3 × (생년월일 없음 + 용신 5, 희신·기신 포함). 확장 영역 글자가 뽑혔다면
        // 그 독음에 기본 영역 비약자(불용 제외·뜻 보유)가 없어야 한다 — 약자 양보가 먼저라 기본 영역이 모두 약자면 확장 비약자가 남는다
        var bad = new List<string>();
        foreach (var r in AllSingleReadings())
        {
            var cands = HanjaData.FindByReading(r).Where(h => !HanjaData.IsForbiddenNameHanja(h.Character)).ToList();
            var withMeaning = cands.Where(h => !string.IsNullOrEmpty(h.Meaning)).ToList();
            var pool = withMeaning.Count > 0 ? withMeaning : cands;
            var nonWeak = pool.Where(h => !HanjaData.IsWeakGivenNameHanja(h.Character)).ToList();
            if (nonWeak.Count > 0) pool = nonWeak;
            bool hasBasic = pool.Any(h => HanjaData.IsInCjkBasicRange(h.Character));
            if (!hasBasic) continue;
            foreach (var g in new[] { "male", "female", "none" })
                foreach (var y in new string?[] { null, "木", "火", "土", "金", "水" })
                {
                    var (p, h, gi) = YongshinTriple(y);
                    var pick = HanjaSelector.Select(r, g, p, h, gi)[0];
                    if (pick != null && !HanjaData.IsInCjkBasicRange(pick.Character))
                        bad.Add($"{r}/{g}/{y ?? "-"}={pick.Character}");
                }
        }
        Assert.True(bad.Count == 0, $"기본 영역 대안이 있는데 확장 영역 배정 {bad.Count}건: {string.Join(" ", bad.Take(20))}");
    }

    [Fact]
    public void Select_AllReadings_WeakYields_WithHeeAndGiShin()
    {
        // B6 전수 검사(Select_WeakYields_AllReadings_UnlessNoAlternative)는 용신만 넘긴다 — /evaluate 는 희신(+55)·기신(−70)도 넘긴다
        var bad = new List<string>();
        foreach (var r in AllSingleReadings())
        {
            var cands = HanjaData.FindByReading(r).Where(h => !HanjaData.IsForbiddenNameHanja(h.Character)).ToList();
            var withMeaning = cands.Where(h => !string.IsNullOrEmpty(h.Meaning)).ToList();
            if (!(withMeaning.Count > 0 ? withMeaning : cands).Any(h => !HanjaData.IsWeakGivenNameHanja(h.Character))) continue;
            foreach (var g in new[] { "male", "female", "none" })
                foreach (var y in new[] { "木", "火", "土", "金", "水" })
                {
                    var (p, h, gi) = YongshinTriple(y);
                    var pick = HanjaSelector.Select(r, g, p, h, gi)[0];
                    if (pick != null && HanjaData.IsWeakGivenNameHanja(pick.Character)) bad.Add($"{r}/{g}/{y}={pick.Character}");
                }
        }
        Assert.True(bad.Count == 0, $"대안이 있는데 약자 배정 {bad.Count}건: {string.Join(" ", bad.Take(20))}");
    }

    // ═══════════════════════════════════════════════════════════════
    // 2026-10-26 운영 검증 부정 훈 정리 — 최항준(남, 생년월일 없음)=桁(차꼬)·/analysis 후보 犴(들개/감옥)·蠢(꿈틀거릴)·旱(가물)·嗽(기침할)
    // 세트 근거는 HanjaData.cs 불용 9차·weak 같은 날 블록, 글자 단위 회귀는 WeakGivenNameHanjaTests.NegGloss20261026_*
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("항준", "최", "male", null, 0x6841)]          // 桁 차꼬 항 — 운영 제보
    [InlineData("항준", "최", "male", "2019-11-23", 0x6841)]
    [InlineData("고은", "김", "female", null, 0x8831)]        // 蠱 뱃속벌레 고 — 고(여, 생년월일 없음)
    [InlineData("짐우", "김", "none", null, 0x9D06)]          // 鴆 짐새 짐
    [InlineData("항준", "최", "male", null, 0x8CA5)]          // 貥 큰 자개 — 정리 1라운드 뒤 Male +40 으로 恒 을 이기던 글자(보완 weak)
    [InlineData("단우", "김", "male", null, 0x80C6)]          // 胆 옷 벗을 단 — 단우 남아 2,914명(보완 불용)
    [InlineData("지훈", "박", "female", null, 0x7147)]        // 煇 태울 훈(휘 자리 '빛날') — 보완 weak
    public async Task Evaluate_NegGlossCleanup_ReportedCases(string name, string lastName, string gender, string? date, int reportedCp)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(
            name, lastName, date == null ? null : DateTime.Parse(date), gender, "neutral");
        Assert.DoesNotContain(Cp(reportedCp), r.MeaningNote);
        foreach (var (ch, _, _) in ParseMeaningParts(r.MeaningNote))
        {
            Assert.False(HanjaData.IsForbiddenNameHanja(ch), $"{lastName}{name}: 불용 {ch} — {r.MeaningNote}");
            Assert.False(HanjaData.IsWeakGivenNameHanja(ch), $"{lastName}{name}: 약자 {ch} — {r.MeaningNote}");
        }
    }

    [Theory]
    [InlineData("안준", 0x72B4, 0x8822)] // 犴 들개/감옥 · 蠢 꿈틀거릴/어리석을 — 운영 제보
    [InlineData("한수", 0x65F1, 0x55FD)] // 旱 가물 · 嗽 기침할(weak — 뒤로 밀려 상위 10 밖)
    [InlineData("항고", 0x6841, 0x777E)] // 桁 차꼬 · 睾 불알(10/26 인명용 합집합으로 새로 인명용)
    [InlineData("나연", 0x81DD, 0x502E)] // 臝 벌거벗을 · 倮 벗을 — 보완 불용(나 줄 8·10위)
    [InlineData("표단", 0x5AD6, 0x80C6)] // 嫖 날랠/음탕할(weak — 표 줄 9위) · 胆 옷 벗을(불용 — 단 줄 9위)
    [InlineData("소침", 0x71D2, 0x4FB5)] // 燒 불사를(weak — 소 줄 7위) · 侵 침노할(불용 — 침 줄 1위)
    public async Task Analysis_NegGlossCleanup_ReportedCases(string firstName, int cp1, int cp2)
    {
        var r = await CreateAnalysisService().AnalyzeNameAsync(new NameAnalysisRequestDto
        {
            LastName = "최", FirstName = firstName, Gender = "none", Tone = "neutral"
        });
        var all = r.HanjaBreakdown.SelectMany(b => b.PossibleHanja.Select(h => h.Character)).ToList();
        Assert.NotEmpty(all);
        Assert.DoesNotContain(Cp(cp1), all);
        Assert.DoesNotContain(Cp(cp2), all);
        Assert.DoesNotContain(all, HanjaData.IsForbiddenNameHanja);
    }

    // ═══════════════════════════════════════════════════════════════
    // 2026-10-26 '남긴 칸' 처리 — 글자가 모두 불용인 음절(괵=馘·몰=沒·훙=薨 등, 불용 10차)이 든 이름의 /evaluate·/name-analysis 동작:
    // 그 음절은 배정 없음·후보 0개·안내 문구(noHanjaNote), 나머지 음절은 그대로, 오류 없음. 옛 후보 0 음절(에·죄)과 같은 경로
    // ═══════════════════════════════════════════════════════════════

    private static bool HasUsableHanja(char syllable) => HanjaSelector.TopForDisplay(syllable.ToString(), 1).Count > 0;

    [Theory]
    [InlineData("몰희", "김", "male", null)]
    [InlineData("몰희", "김", "male", "2019-11-23")]
    [InlineData("서괵", "이", "female", null)]
    [InlineData("서괵", "이", "female", "2020-03-05")]
    [InlineData("훙민", "박", "none", "2018-07-14")]
    [InlineData("에린", "최", "female", "2021-01-09")] // 옛 후보 0 음절 — 같은 경로
    public async Task Evaluate_NoUsableHanjaSyllable(string name, string lastName, string gender, string? date)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(
            name, lastName, date == null ? null : DateTime.Parse(date), gender, "neutral");

        Assert.Equal(name.Length, r.HanjaCandidates.Count);
        Assert.Contains(name, c => !HasUsableHanja(c)); // 이 사례가 정말 후보 0 음절을 담는지(세트가 바뀌면 사례를 다시 고를 것)
        for (int i = 0; i < name.Length; i++)
        {
            var g = r.HanjaCandidates[i];
            if (HasUsableHanja(name[i]))
            {
                Assert.NotEmpty(g.Candidates);
                Assert.Null(g.NoHanjaNote);
            }
            else
            {
                Assert.Empty(g.Candidates);
                Assert.Equal(HanjaSelector.NoUsableHanjaNote, g.NoHanjaNote);
            }
        }

        // 의미 메모는 쓸 수 있는 음절의 한자만(불용 글자·그 음절 괄호 독음 없음)
        var parts = ParseMeaningParts(r.MeaningNote);
        Assert.Equal(name.Count(HasUsableHanja), parts.Count);
        Assert.All(parts, p => Assert.False(HanjaData.IsForbiddenNameHanja(p.Char), r.MeaningNote));
        Assert.All(parts, p => Assert.True(HasUsableHanja(p.Syllable[0]), r.MeaningNote));

        // 출생일이 있으면 그 음절은 획수 추정으로 조화를 매긴다(HarmonyEngine 'anyFallback' — 오류 없이 점수가 나온다)
        if (date != null)
        {
            Assert.True(r.UsedFallbackHanja);
            Assert.InRange(r.HarmonyScore, 0, 100);
        }
    }

    [Fact]
    public async Task Evaluate_AllSyllablesUnusable_MeaningNoteSaysKeepHangul()
    {
        var r = await CreateEvaluationService().EvaluateNameAsync("몰닉", "김", null, "none", "neutral");
        Assert.All(r.HanjaCandidates, g =>
        {
            Assert.Empty(g.Candidates);
            Assert.Equal(HanjaSelector.NoUsableHanjaNote, g.NoHanjaNote);
        });
        Assert.Equal(ExplanationEngine.NoUsableHanjaMeaningNote, r.MeaningNote);
    }

    [Fact]
    public async Task Evaluate_PureKoreanSyllables_ReadingNote()
    {
        // 순우리말 음절(사전 독음 없음)은 옛 의미 메모 그대로, 후보 안내는 '독음이 아니어서'
        var r = await CreateEvaluationService().EvaluateNameAsync("봄빛", "김", null, "none", "neutral");
        Assert.All(r.HanjaCandidates, g =>
        {
            Assert.Empty(g.Candidates);
            Assert.Equal(HanjaSelector.NoHanjaReadingNote, g.NoHanjaNote);
        });
        Assert.Equal("한자 매칭 없음 — 순우리말 또는 미등록 발음", r.MeaningNote);
    }

    /// <summary>
    /// 후보 0 음절(사전 글자가 모두 불용)의 불용 글자는 미학 성별 보너스·의미 카테고리에도 들어가지 않는다 — 같은 응답이 그 음절을
    /// '배정 없음·한글로 두기'로 다루므로, 사전 독음이 아예 없는 순우리말 음절(쁨)과 똑같이 기여 0 이어야 한다(2026-10-26 보완 —
    /// 옛 김퍅쁨 남 genderBonus +3 '한자 성별 선호도가 남자 이름과 잘 맞음'(愎 Male)·여 −2, 김몰쁨 의미 9(沒 카테고리 +20) vs 김쁨쁨 7).
    /// </summary>
    [Theory]
    [InlineData("퍅쁨", "male")]
    [InlineData("퍅쁨", "female")]
    [InlineData("몰쁨", "none")]
    [InlineData("녈쁨", "female")]
    [InlineData("에쁨", "male")]
    [InlineData("죄쁨", "female")]
    [InlineData("괵쁨", "male")]
    [InlineData("훙쁨", "female")]
    [InlineData("핍쁨", "male")]
    [InlineData("뉵쁨", "female")]
    [InlineData("닉쁨", "male")]
    [InlineData("녁쁨", "none")]
    public async Task Aesthetic_NoUsableHanjaSyllable_ContributesLikePureKorean(string name, string gender)
    {
        // 사례 확인: 첫 음절은 사전 독음은 있지만 표시할 한자가 0개(세트가 바뀌면 사례를 다시 고를 것), 둘째 음절은 사전 독음 없음
        Assert.NotEmpty(HanjaData.FindByReading(name[0].ToString()));
        Assert.False(HasUsableHanja(name[0]));
        Assert.Empty(HanjaData.FindByReading(name[1].ToString()));

        var svc = CreateEvaluationService();
        var r = await svc.EvaluateNameAsync(name, "김", null, gender, "neutral");
        var control = await svc.EvaluateNameAsync("쁨쁨", "김", null, gender, "neutral");

        Assert.Equal(0, r.Aesthetic.GenderBonus);
        Assert.DoesNotContain(r.Aesthetic.Notes, n => n.Contains("성별 선호도"));
        Assert.Equal(control.Aesthetic.Meaning, r.Aesthetic.Meaning);
    }

    [Fact]
    public async Task Aesthetic_UsableSyllableNextToNoUsable_StillCounts()
    {
        // 후보가 있는 음절은 그 음절에 보이는 한자로 센다(결정 ③) — 연(여자 이름에 보이는 蓮 Female)은 '퍅' 옆에서도 여자 이름 일치,
        // '몰' 옆 서(瑞 등 자연·덕목)는 의미 가점(의미는 아직 음절의 쓸 수 있는 글자 전부)
        var svc = CreateEvaluationService();
        var withPyak = await svc.EvaluateNameAsync("퍅연", "김", null, "female", "neutral");
        var alone = await svc.EvaluateNameAsync("쁨연", "김", null, "female", "neutral");
        var shownYeon = withPyak.HanjaCandidates[1].Candidates.First().Character;
        Assert.Equal(HanjaData.GenderPreference.Female, HanjaData.FindByCharacter(shownYeon)!.GenderPref);
        Assert.Equal(shownYeon, alone.HanjaCandidates[1].Candidates.First().Character);
        Assert.Empty(withPyak.HanjaCandidates[0].Candidates);
        Assert.Equal(alone.Aesthetic.GenderBonus, withPyak.Aesthetic.GenderBonus);
        Assert.Equal(3, withPyak.Aesthetic.GenderBonus); // 보이는 Female 한 글자 = +3

        var mol = await svc.EvaluateNameAsync("몰서", "김", null, "none", "neutral");
        var bbeum = await svc.EvaluateNameAsync("쁨쁨", "김", null, "none", "neutral");
        Assert.True(mol.Aesthetic.Meaning > bbeum.Aesthetic.Meaning, $"몰서 {mol.Aesthetic.Meaning} vs 쁨쁨 {bbeum.Aesthetic.Meaning}");
    }

    [Theory]
    [InlineData("몰희")]
    [InlineData("서괵")]
    [InlineData("닉현")]
    public async Task Analysis_NoUsableHanjaSyllable(string firstName)
    {
        var r = await CreateAnalysisService().AnalyzeNameAsync(new NameAnalysisRequestDto
        {
            LastName = "김", FirstName = firstName, Gender = "none", Tone = "neutral"
        });
        Assert.Equal(firstName.Length, r.HanjaBreakdown.Count);
        for (int i = 0; i < firstName.Length; i++)
        {
            var b = r.HanjaBreakdown[i];
            if (HasUsableHanja(firstName[i]))
            {
                Assert.NotEmpty(b.PossibleHanja);
                Assert.Null(b.NoHanjaNote);
            }
            else
            {
                Assert.Empty(b.PossibleHanja);
                Assert.Equal(HanjaSelector.NoUsableHanjaNote, b.NoHanjaNote);
            }
        }
        Assert.Contains("한자 의미를 부여할 수 있는 이름입니다", r.Strengths);
        // '한자 예' 줄은 쓸 수 있는 음절의 글자만
        var example = r.Reasons.SingleOrDefault(s => s.StartsWith("한자 예 — ") || s.StartsWith("한자 뜻 — "));
        Assert.NotNull(example);
        Assert.DoesNotContain(example!.Split(" — ")[1].Split(" + ").Select(OptionChar), HanjaData.IsForbiddenNameHanja);
    }

    [Fact]
    public async Task Analysis_AllSyllablesUnusable_IsWeakness()
    {
        // 사전 독음만 보던 옛 판정은 몰닉(沒·匿)을 '한자 의미를 부여할 수 있는 이름'으로 셌다
        var r = await CreateAnalysisService().AnalyzeNameAsync(new NameAnalysisRequestDto
        {
            LastName = "김", FirstName = "몰닉", Gender = "none", Tone = "neutral"
        });
        Assert.All(r.HanjaBreakdown, b => Assert.Equal(HanjaSelector.NoUsableHanjaNote, b.NoHanjaNote));
        Assert.Contains("한자 매핑이 어려운 이름입니다", r.Weaknesses);
        Assert.DoesNotContain("한자 의미를 부여할 수 있는 이름입니다", r.Strengths);
    }

    // ═══════════════════════════════════════════════════════════════
    // L6 — 옛 추천(RecommendationService) 카드 뜻 줄도 그 음절의 훈(HanjaData.GlossForReading — B7 과 같은 규칙)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public void RecommendationCardMeaning_UsesGlossForReading()
    {
        var ji = HanjaData.FindByCharacter(Cp(0x667A))!;  // 智 슬기 지
        var hwi = HanjaData.FindByCharacter(Cp(0x7147))!; // 煇 빛날 휘, 햇무리 운, 태울 훈, …
        var eol = HanjaData.FindByCharacter(Cp(0x4E7B))!; // 乻 땅 이름 얼, 음차 얼, 음차 늘
        var ha = HanjaData.FindByCharacter(Cp(0x590F))!;  // 夏 여름 하

        // 옛 첫 훈은 '슬기 지 · 빛날 휘', '여름 하 · 땅 이름 얼'
        Assert.Equal("슬기 지 · 태울 훈", RecommendationService.BuildCardMeaning("지훈", new List<HanjaData.HanjaInfo?> { ji, hwi }));
        Assert.Equal("여름 하 · 음차 늘", RecommendationService.BuildCardMeaning("하늘", new List<HanjaData.HanjaInfo?> { ha, eol }));
        // 한자 없는 음절(null — 글자가 모두 불용인 몰 등)은 건너뛴다
        Assert.Equal("슬기 지", RecommendationService.BuildCardMeaning("지몰", new List<HanjaData.HanjaInfo?> { ji, null }));
        Assert.Null(RecommendationService.BuildCardMeaning("몰닉", new List<HanjaData.HanjaInfo?> { null, null }));
    }

    // ═══════════════════════════════════════════════════════════════
    // 2026-10-26 점수 정책 — 후보가 있는 음절도 불용 글자는 미학 성별 보너스·의미 카테고리·톤 가점(과 옛 추천 랭킹의 자원오행 보너스)에
    // 세지 않는다. 판정은 HanjaSelector.UsableByReading(= IsUsableNameHanja: 불용 아님 + 뜻 있음, 약자 포함) 하나.
    // 옛 규칙은 음절 독음의 사전 글자 전부를 봐 나=瘰 '연주창'(불용, Male)이 남자 이름 일치를, 지=躓 '넘어질'(불용, Female)이 여자 이름
    // 일치를 만들었다 — /name 200명(공개 136명) 미학 −2~−5(−4 156명). 기대값은 사전에서 독립으로 계산하고(UsableIndependent — 검사 대상인
    // HanjaSelector 를 거치지 않는다), 사례 확인 단언은 불용 세트·성별 분류가 바뀌면 깨진다(그때 사례를 다시 고를 것).
    // ═══════════════════════════════════════════════════════════════

    private static bool HasMeaningCategory(HanjaData.HanjaInfo h) => h.Category is "자연" or "덕목" or "개념";

    /// <summary>
    /// 기대값 계산용 '쓸 수 있는 글자' — 사전 원본(FindByReading)에 불용·뜻 없음 필터를 테스트 안에서 직접 건다.
    /// HanjaSelector.IsUsableNameHanja·UsableByReading 의 버그가 기대값으로 새지 않게 엔진 밖에서 따로 셈한다.
    /// </summary>
    private static List<HanjaData.HanjaInfo> UsableIndependent(string syllable)
        => HanjaData.FindByReading(syllable)
            .Where(h => !HanjaData.IsForbiddenNameHanja(h.Character) && !string.IsNullOrEmpty(h.Meaning))
            .ToList();

    /// <summary>
    /// /evaluate 응답에서 음절마다 사용자에게 보이는 한자 — 후보 표 첫 칸(배정 한자를 앞세운다)이고 의미 메모의 글자와 같다(여기서 함께 단언).
    /// 후보가 없는 음절은 null. 결정 ③ 의 성별 기대값은 이 목록으로 셈한다(엔진 내부의 배정을 다시 부르지 않는다).
    /// </summary>
    private static List<HanjaData.HanjaInfo?> ShownHanja(NameEvaluationResultDto r)
    {
        var shown = r.HanjaCandidates
            .Select(g => g.Candidates.FirstOrDefault() is { } c ? HanjaData.FindByCharacter(c.Character) : null)
            .ToList();
        if (shown.Any(h => h != null))
            Assert.Equal(shown.Where(h => h != null).Select(h => h!.Character), ParseMeaningParts(r.MeaningNote).Select(p => p.Char));
        return shown;
    }

    /// <summary>
    /// 결정 ③ 의 성별 보너스를 테스트 안에서 따로 셈한다 — 음절마다 보이는 한자 한 글자(쓸 수 있는 글자만: 불용 아님 + 뜻 있음)의 성별 값,
    /// 일치 음절 × 3(최대 5) − 불일치 음절 × 2(최대 5), ±5. 노트 유무는 일치·불일치 음절이 있는지로 정한다.
    /// </summary>
    private static int ExpectedGenderBonus(IEnumerable<HanjaData.HanjaInfo?> shown, string gender)
        => ExpectedGenderBonus(shown, gender, out _, out _);

    private static int ExpectedGenderBonus(IEnumerable<HanjaData.HanjaInfo?> shown, string gender, out bool anyMatch, out bool anyMismatch)
    {
        anyMatch = anyMismatch = false;
        if (gender is not ("male" or "female")) return 0;
        var target = gender == "male" ? HanjaData.GenderPreference.Male : HanjaData.GenderPreference.Female;
        var opposite = gender == "male" ? HanjaData.GenderPreference.Female : HanjaData.GenderPreference.Male;
        var counted = shown.Where(h => h != null && !HanjaData.IsForbiddenNameHanja(h.Character) && !string.IsNullOrEmpty(h.Meaning)).ToList();
        int match = counted.Count(h => h!.GenderPref == target);
        int mismatch = counted.Count(h => h!.GenderPref == opposite);
        anyMatch = match > 0;
        anyMismatch = mismatch > 0;
        int bonus = (match > 0 ? Math.Min(5, match * 3) : 0) - (mismatch > 0 ? Math.Min(5, mismatch * 2) : 0);
        return Math.Clamp(bonus, -5, 5);
    }

    [Fact]
    public void UsableByReading_ExcludesForbidden_KeepsWeak_InDictionaryOrder()
    {
        var rain = Cp(0x96E8);  // 雨 비 우 — weak(양보는 배정 단계의 일 — 쓸 수 있는 글자다)
        var fool = Cp(0x611A);  // 愚 어리석을 우 — 불용
        Assert.True(HanjaData.IsWeakGivenNameHanja(rain));
        Assert.True(HanjaData.IsForbiddenNameHanja(fool));

        var raw = HanjaData.FindByReading("우");
        var usable = HanjaSelector.UsableByReading("우");
        Assert.Contains(raw, h => h.Character == fool);
        Assert.Contains(usable, h => h.Character == rain);
        Assert.DoesNotContain(usable, h => h.Character == fool);
        Assert.DoesNotContain(usable, h => HanjaData.IsForbiddenNameHanja(h.Character) || string.IsNullOrEmpty(h.Meaning));
        // 테스트 안에서 따로 거른 목록과 글자·순서가 같다(사전 관련도 순 그대로) — 우 줄과 이름에 자주 쓰는 다른 줄도
        foreach (var s in new[] { "우", "나", "지", "겸", "권", "멸", "에", "쁨" })
            Assert.Equal(UsableIndependent(s).Select(h => h.Character), HanjaSelector.UsableByReading(s).Select(h => h.Character));
        Assert.Equal(raw.Where(h => usable.Contains(h)).Select(h => h.Character), usable.Select(h => h.Character));
        // 집합은 표시 후보(OrderForDisplay)와 같다 — 한 정의
        Assert.Equal(
            HanjaSelector.OrderForDisplay(raw).Select(h => h.Character).OrderBy(c => c, StringComparer.Ordinal),
            usable.Select(h => h.Character).OrderBy(c => c, StringComparer.Ordinal));
    }

    /// <summary>
    /// 사전에서 그 성별 글자가 불용 글자에만 있는 음절 — 옛 '사전 글자 전부' 코드는 '일치'(+3·'한자 성별 선호도가 … 잘 맞음')였고,
    /// 점수 정책 직후(state ①)의 '쓸 수 있는 글자 중 하나라도' 규칙은 반대 성별 글자가 하나라도 있으면 불일치(−2 — 지(여)=馶·吱)였다.
    /// 결정 ③ 이후에는 그 음절에 보이는 한자 한 글자만 본다(불용 글자는 배정·후보 표에 나오지 않으니 성별에도 안 들어간다).
    /// 둘째 음절 '쁨'은 사전 독음이 없어 기여 0.
    /// </summary>
    // 옛 사례 나(瘰 연주창)·권(勌 게으를)·지(躓 넘어질)·회(獪 교활할)는 2026-10-27 성별 규칙 감사로 그 불용 글자의 성별이 빠져(독음·낱말 일부 일치였다
    // — '라(나)'·'힘쓸'·'어질'⊂'넘어질'·'회') 사례가 아니게 됐다. 칼 훈의 겸·검만 남는다.
    [Theory]
    [InlineData("겸", "male")]   // 鉗 칼(불용, Male) — 보이는 謙 Neutral (縑 Female 은 세지 않는다)
    [InlineData("검", "male")]   // 劍·劒 칼(불용, Male) — 보이는 儉 Neutral
    public async Task Aesthetic_ForbiddenHanjaGenderPref_NotCounted(string syllable, string gender)
    {
        var target = gender == "male" ? HanjaData.GenderPreference.Male : HanjaData.GenderPreference.Female;
        var opposite = gender == "male" ? HanjaData.GenderPreference.Female : HanjaData.GenderPreference.Male;
        var usable = UsableIndependent(syllable);

        // 사례 확인: 그 성별 글자가 불용 글자에만 있고(옛 코드가 '일치'로 셌다), 쓸 수 있는 글자는 있다(후보 0 음절이 아님)
        Assert.Contains(HanjaData.FindByReading(syllable), h => h.GenderPref == target && HanjaData.IsForbiddenNameHanja(h.Character));
        Assert.NotEmpty(usable);
        Assert.DoesNotContain(usable, h => h.GenderPref == target);
        Assert.Empty(HanjaData.FindByReading("쁨"));

        var r = await CreateEvaluationService().EvaluateNameAsync(syllable + "쁨", "김", null, gender, "neutral");
        var shown = ShownHanja(r);
        Assert.NotNull(shown[0]);
        Assert.Null(shown[1]);
        Assert.Contains(usable, h => h.Character == shown[0]!.Character); // 보이는 글자는 쓸 수 있는 글자(불용 아님)
        bool shownOpposite = shown[0]!.GenderPref == opposite;

        Assert.DoesNotContain(r.Aesthetic.Notes, n => n.Contains("성별 선호도") && n.Contains("잘 맞음"));
        Assert.Equal(shownOpposite ? -2 : 0, r.Aesthetic.GenderBonus);
        Assert.Equal(shownOpposite, r.Aesthetic.Notes.Any(n => n.Contains("성별 선호도") && n.Contains("맞지 않음")));
    }

    /// <summary>
    /// 이름 사례 — /evaluate(출생일 없음)에 보이는 한자의 성별 값만 센다. 기대값은 보이는 한자로 테스트 안에서 따로 셈하고(ExpectedGenderBonus),
    /// InlineData 숫자는 지금 배정(출생일 없는 기본 배정 = /name 1순위 조합 — 나건 남 羅健·나윤 羅潤·나연 羅蓮, 健 Male·蓮 Female)의 사례 기록이다
    /// — 배정·성별 분류가 바뀌면 숫자만 다시 적을 것(2026-10-27 O2 전에는 Select 배정 나 여=娜 Female 이라 나윤 여 +3·나연 여 +5).
    /// 옛 '하나라도' 규칙(state ①)은 나건 남 +1·나윤 남 −4·나연 남 +1·나윤 여 +5 였다(나=娜 등 Female·윤=贇·玧·綸 Female 이 쓸 글자에 있어서).
    /// </summary>
    [Theory]
    [InlineData("나건", "male", 3)]   // 羅 Neutral + 健 Male
    [InlineData("나윤", "male", 0)]   // 羅 + 潤 모두 Neutral
    [InlineData("나연", "male", 0)]   // 羅 + 然 모두 Neutral
    [InlineData("나윤", "female", 0)] // 羅 + 潤 모두 Neutral
    [InlineData("나연", "female", 3)] // 羅 Neutral + 蓮 Female
    public async Task Aesthetic_ForbiddenHanjaGenderPref_NameSamples(string name, string gender, int recorded)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(name, "김", null, gender, "neutral");
        var expected = ExpectedGenderBonus(ShownHanja(r), gender);
        Assert.Equal(expected, r.Aesthetic.GenderBonus);
        Assert.Equal(recorded, expected);
    }

    /// <summary>
    /// 의미 카테고리(자연·덕목·개념 +20)·톤(+10)도 쓸 수 있는 글자만 — 멸=滅 자연·蔑 덕목, 졸=卒 자연(모두 불용, 남은 1자는 카테고리 없음),
    /// 나=懦 나약할·검=劍 칼(불용, Strong — 남은 글자에 Strong 없음). 옛 코드는 의미 점수가 1~2점 높았다.
    /// </summary>
    [Theory]
    [InlineData("멸", "neutral")]
    [InlineData("졸", "neutral")]
    [InlineData("나", "strong")]
    [InlineData("검", "strong")]
    public async Task Aesthetic_ForbiddenHanjaCategoryTone_NotCounted(string syllable, string tone)
    {
        var raw = HanjaData.FindByReading(syllable);
        var usable = UsableIndependent(syllable);
        Assert.NotEmpty(usable);
        if (tone == "strong")
        {
            Assert.Contains(raw, h => h.TonePref == HanjaData.TonePreference.Strong && HanjaData.IsForbiddenNameHanja(h.Character));
            Assert.DoesNotContain(usable, h => h.TonePref == HanjaData.TonePreference.Strong);
        }
        else
        {
            Assert.Contains(raw, h => HasMeaningCategory(h) && HanjaData.IsForbiddenNameHanja(h.Character));
            Assert.DoesNotContain(usable, HasMeaningCategory);
        }

        // AestheticEngine.EvaluateMeaning 을 쓸 수 있는 글자로 다시 계산(둘째 음절 '쁨'은 사전 독음 없음, 과도한 소망 음절 없음)
        int meaningRaw = 70 + (usable.Any(HasMeaningCategory) ? 20 : 0);
        int expected = (int)(meaningRaw * 0.10);

        var r = await CreateEvaluationService().EvaluateNameAsync(syllable + "쁨", "김", null, "none", tone);
        Assert.Equal(expected, r.Aesthetic.Meaning);
    }

    [Fact]
    public async Task Ranker_HanjaElementBonus_IgnoresForbiddenHanja()
    {
        // 슬의 水 글자는 膝 무릎·虱·蝨 이(불용)뿐 — 옛 코드는 사전 글자 전부를 봐 용신 水 자원오행 보너스 +8 을 줬다.
        // 결정 ③ 이후 +8 은 배정 한자(카드에 보이는 글자)로만 정한다 — 불용 글자는 배정되지 않으니 용신 水로 배정해도 슬 글자는 水가 아니다.
        Assert.Contains(HanjaData.FindByReading("슬"), h => h.FiveElement == "水" && HanjaData.IsForbiddenNameHanja(h.Character));
        Assert.NotEmpty(UsableIndependent("슬"));
        Assert.DoesNotContain(UsableIndependent("슬"), h => h.FiveElement == "水");
        Assert.Empty(HanjaData.FindByReading("쁨"));
        var assigned = HanjaSelector.Select("슬쁨", "none", "水", null, null);
        Assert.NotNull(assigned[0]);
        Assert.Null(assigned[1]);
        Assert.False(HanjaData.IsForbiddenNameHanja(assigned[0]!.Character));

        var c = new NameForm.Domain.Models.Candidate
        {
            Name = "슬쁨", AestheticScore = 80, HarmonyScore = 60,
            SyllableHanja = assigned.Select(h => h?.Character).ToList()
        };
        var ranked = await new RankerEngine().RankCandidatesAsync(new List<NameForm.Domain.Models.Candidate> { c }, "水");

        // 80*0.7 + 60*0.3 = 74, 음령오행 보너스(+5)만 남는다
        int expected = 74 + (KoreanUtils.HasEumryeongMatch("슬쁨", "水") ? 5 : 0);
        Assert.Equal(expected, ranked[0].FinalScore);
    }

    /// <summary>
    /// /name 데이터(name-seo.json 의 sc)가 지금 미학 엔진 출력과 같은지 — 엔진(성별 보너스·의미·감점·노트)을 고치고 재생성 체인
    /// (dump-name-scores → build_name_seo_data.py)을 빠뜨리면 여기서 걸린다(2026-10-26 점수 정책 직후 HEAD name-seo 는 200명이 엔진과 달랐고
    /// 손 대조로만 잡혔다). 성별 분기(60/40)·노트 치환은 Program.cs dump-name-scores 와 같다.
    /// 결정 ③: 성별 판정 한자 = 페이지 1순위 조합(NameSeoHanja.DisplayedHanja — dump-name-scores 와 같은 함수). 그 한자가 json 의
    /// combos[0] 과 같은지(조합 없는 이름은 보이는 한자 없음)도 함께 본다 — 점수가 판정한 한자와 페이지 1순위 카드가 갈라지면 여기서 걸린다.
    /// </summary>
    [Fact]
    public async Task NameSeo_AestheticScores_MatchEngine()
    {
        static string PublicNote(string note) => note.Replace("female와", "여자 이름과").Replace("male와", "남자 이름과");
        static int Int(System.Text.Json.JsonElement o, string key) => o.TryGetProperty(key, out var v) ? v.GetInt32() : 0;

        var path = Path.Combine(RepoRoot(), "frontend", "src", "data", "name-seo.json");
        using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        var engine = new AestheticEngine();
        var mismatches = new List<string>();
        var comboMismatches = new List<string>();
        int checkedNames = 0;
        foreach (var prop in doc.RootElement.GetProperty("names").EnumerateObject())
        {
            if (!prop.Value.TryGetProperty("sc", out var sc)) continue;
            int m = Int(prop.Value, "m"), f = Int(prop.Value, "f"), total = m + f;
            string gender = total > 0 && m * 100 / total >= 60 ? "male"
                          : total > 0 && f * 100 / total >= 60 ? "female" : "none";
            Assert.Equal(gender, NameSeoHanja.Gender(m, f));

            // 페이지 1순위 조합(json combos[0]) — 없으면 페이지에 이 이름의 한자가 없다
            var shown = NameSeoHanja.DisplayedHanja(prop.Name, gender);
            var pageFirst = prop.Value.TryGetProperty("combos", out var combos) && combos.GetArrayLength() > 0
                ? combos[0].EnumerateArray().Select(x => x.GetString()).ToList()
                : Enumerable.Repeat<string?>(null, prop.Name.Length).ToList();
            if (!shown.Select(h => h?.Character).SequenceEqual(pageFirst))
                comboMismatches.Add($"{prop.Name}({gender}) 판정 [{string.Join(",", shown.Select(h => h?.Character ?? "_"))}] ≠ combos[0] [{string.Join(",", pageFirst.Select(c => c ?? "_"))}]");

            var b = await engine.CalculateScoreWithBreakdownAsync(prop.Name, null, "neutral", gender, null, shown);
            checkedNames++;

            var expected = new[] { b.PronunciationScore, b.RhythmScore, b.SyllableScore, b.NeutralityScore, b.MeaningScore, b.TotalScore, b.GenderBonus, b.PenaltyTotal };
            var actual = new[] { "p", "r", "s", "n", "m", "t", "g", "pn" }.Select(k => Int(sc, k)).ToArray();
            var notes = sc.TryGetProperty("no", out var no) ? no.EnumerateArray().Select(x => x.GetString()).ToList() : new List<string?>();
            if (!expected.SequenceEqual(actual) || !b.Notes.Select(PublicNote).SequenceEqual(notes))
                mismatches.Add($"{prop.Name}({gender}) 엔진 [{string.Join(",", expected)}] ≠ sc [{string.Join(",", actual)}]");
        }

        Assert.True(checkedNames > 5000, $"sc 가 있는 이름 {checkedNames}명");
        Assert.True(comboMismatches.Count == 0,
            $"성별 판정 한자가 json combos[0] 과 다른 이름 {comboMismatches.Count}명 — dump-name-combos 부터 체인을 다시 돌릴 것:\n" + string.Join("\n", comboMismatches.Take(20)));
        Assert.True(mismatches.Count == 0,
            $"name-seo.json sc 가 엔진과 다른 이름 {mismatches.Count}명 — /name 재생성 체인을 다시 돌릴 것(p,r,s,n,m,t,g,pn):\n" + string.Join("\n", mismatches.Take(20)));
    }

    /// <summary>
    /// 2026-10-27 O2 — 출생일 없는 /evaluate 의 배정 한자 = /name 1순위 조합(HanjaSelector.DefaultAssignment). name-seo.json 에서 조합이 있는
    /// 이름 전부(페이지 성별로)를 ScoringService 에 넣어 배정 한자가 json combos[0] 과 같고, 미학 성별 보너스·성별 노트가 발행 sc.g·sc.no 와 같은지 본다.
    /// 옛 기본 배정(Select — 같은 성별 +40 이 관련도보다 앞섬)은 4,806명 중 2,758명에서 /name 과 다른 한자를 보였다(지우(여) 智宇 ↔ 智瑀).
    /// </summary>
    [Fact]
    public async Task NameSeo_EvaluateNoBirthDate_SameHanjaAndGenderAsNamePage()
    {
        static string PublicNote(string note) => note.Replace("female와", "여자 이름과").Replace("male와", "남자 이름과");
        static int Int(System.Text.Json.JsonElement o, string key) => o.TryGetProperty(key, out var v) ? v.GetInt32() : 0;

        var path = Path.Combine(RepoRoot(), "frontend", "src", "data", "name-seo.json");
        using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        var scoring = new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine());
        var mismatches = new List<string>();
        int checkedNames = 0;
        foreach (var prop in doc.RootElement.GetProperty("names").EnumerateObject())
        {
            if (!prop.Value.TryGetProperty("combos", out var combos) || combos.GetArrayLength() == 0) continue;
            if (!prop.Value.TryGetProperty("sc", out var sc)) continue;
            var gender = NameSeoHanja.Gender(Int(prop.Value, "m"), Int(prop.Value, "f"));
            var pageFirst = combos[0].EnumerateArray().Select(x => x.GetString()).ToList();

            var s = await scoring.EvaluateAsync(prop.Name, "김", null, gender, "neutral");
            checkedNames++;
            var assigned = s.AssignedHanja.Select(h => h?.Character).ToList();
            var genderNotes = s.Aesthetic.Notes.Where(n => n.Contains("성별 선호도")).Select(PublicNote).ToList();
            var pageGenderNotes = (sc.TryGetProperty("no", out var no) ? no.EnumerateArray().Select(x => x.GetString() ?? "") : Enumerable.Empty<string>())
                .Where(n => n.Contains("성별 선호도")).ToList();
            if (!assigned.SequenceEqual(pageFirst) || s.Aesthetic.GenderBonus != Int(sc, "g") || !genderNotes.SequenceEqual(pageGenderNotes))
                mismatches.Add($"{prop.Name}({gender}) /evaluate [{string.Join(",", assigned.Select(c => c ?? "_"))}] g {s.Aesthetic.GenderBonus} ≠ /name [{string.Join(",", pageFirst)}] g {Int(sc, "g")}");
        }

        Assert.True(checkedNames > 4000, $"조합이 있는 이름 {checkedNames}명");
        Assert.True(mismatches.Count == 0,
            $"출생일 없는 /evaluate 배정·성별이 /name 1순위 조합과 다른 이름 {mismatches.Count}명:\n" + string.Join("\n", mismatches.Take(20)));
    }

    // 같은 판정(UsableByReading)으로 바꾼 다른 소비처 — 이중 이름 대표 한자·가족 서사 부모 이름 뜻

    [Fact]
    public async Task DualName_RepresentativeHanja_NeverForbidden()
    {
        // 옛 코드는 사전 글자 전부에서 카테고리 우선으로 골라 비=婢 '계집종'(Vivian·Olivia·Ivy·Ruby)·피=疲 '피곤할'(Peter·Sophia)·
        // 미=媚 '아첨할'(Naomi·Mia)·토=吐 '토할'(Anthony)을 대표 한자·뜻으로 보여 줬다(영한 매핑 130개 중 11개)
        var maid = Cp(0x5A62); // 婢 계집종 비 — 불용, 비 줄 사전 1번
        Assert.True(HanjaData.IsForbiddenNameHanja(maid));
        Assert.Equal(maid, HanjaData.FindByReading("비")[0].Character);

        var engine = new DualNameEngine();
        var birth = new DateTime(2025, 1, 1);
        var all = new List<DualNameCandidate>();
        foreach (var english in EnglishKoreanNameMap.GetMappings().Select(m => m.English).Distinct())
            all.AddRange(await engine.GenerateDualNamesAsync("김", english, birth, "none", "neutral"));
        foreach (var gender in new[] { "male", "female" })
            all.AddRange(await engine.GenerateDualNamesAsync("김", null, birth, gender, "neutral"));
        Assert.NotEmpty(all);
        foreach (var c in all)
        {
            Assert.Equal(c.KoreanName.Length, c.HanjaCharacters.Count);
            for (int i = 0; i < c.KoreanName.Length; i++)
            {
                var ch = c.HanjaCharacters[i];
                Assert.False(HanjaData.IsForbiddenNameHanja(ch), $"{c.EnglishEquivalent} {c.KoreanName}: {ch}");
                Assert.Contains(UsableIndependent(c.KoreanName[i].ToString()), h => h.Character == ch);
            }
        }

        var vivian = await engine.GenerateDualNamesAsync("김", "Vivian", birth, "female", "neutral");
        Assert.NotEmpty(vivian);
        Assert.All(vivian, c => Assert.DoesNotContain(maid, c.HanjaCharacters));
        Assert.All(vivian, c => Assert.DoesNotContain("계집종", c.HanjaMeaning));
    }

    [Theory]
    [InlineData("Emily")] // 에밀리 — 옛 曀 '음산할'+密+理
    [InlineData("Amy")]   // 에이미 — 옛 曀+理+媚 '아첨할'
    public async Task DualName_NoUsableHanjaSyllable_DropsCandidate(string english)
    {
        // 에 = 曀 음산할·恚 성낼 — 둘 다 불용(후보 0 음절). 이중 이름은 모든 음절에 한자가 있어야 해서 후보에서 빠진다
        // (2026-10-26 점수 정책 이후 /dual-name 에 Emily·Amy 를 넣으면 0건 — 화면은 0건 안내를 그린다)
        Assert.NotEmpty(HanjaData.FindByReading("에"));
        Assert.Empty(UsableIndependent("에"));
        var koreans = EnglishKoreanNameMap.FindByEnglishName(english).SelectMany(m => m.Korean).ToList();
        Assert.NotEmpty(koreans);
        Assert.All(koreans, k => Assert.Contains("에", k));

        Assert.Empty(await new DualNameEngine().GenerateDualNamesAsync("김", english, new DateTime(2025, 1, 1), "female", "neutral"));
    }

    /// <summary>
    /// 부모 이름 의미 융합 서사(부모 기반 작명 '가족 서사')는 쓸 수 있는 글자의 뜻만 — 옛 코드는 사전 글자 전부를 봐서
    /// 회=悔 '뉘우칠'(불용, 회 줄 첫 덕목)·검=劍 '칼'(불용, 검 줄 첫 자연)이 "부모님의 '…' 정신과 '…'의 아름다움" 문장에 들어갔다.
    /// </summary>
    [Theory]
    [InlineData("회진", "비나", "덕목")]
    [InlineData("검수", "미영", "자연")]
    public void FamilyNarrative_MeaningFusion_IgnoresForbiddenHanja(string father, string mother, string oldCategory)
    {
        var syllables = (father + mother).Select(c => c.ToString()).ToList();
        // 사례 확인: 사전 원본에서 그 카테고리의 첫 글자가 불용이다(옛 코드가 서사에 넣었다)
        var rawFirst = syllables.SelectMany(s => HanjaData.FindByReading(s)).First(h => h.Category == oldCategory && !string.IsNullOrEmpty(h.Meaning));
        Assert.True(HanjaData.IsForbiddenNameHanja(rawFirst.Character), rawFirst.Character);

        var usable = syllables.SelectMany(s => UsableIndependent(s)).ToList();
        var forbiddenMeanings = syllables
            .SelectMany(s => HanjaData.FindByReading(s).Where(h => HanjaData.IsForbiddenNameHanja(h.Character) && !string.IsNullOrEmpty(h.Meaning)))
            .Select(h => h.Meaning!)
            .Except(usable.Select(h => h.Meaning!))
            .ToList();
        Assert.Contains(rawFirst.Meaning!, forbiddenMeanings);

        var n = FamilyNarrativeExtractor.ExtractMeaningFusionNarrative(father, mother);

        // 기대값: 쓸 수 있는 글자의 뜻을 아버지 → 어머니, 음절·사전 순으로 놓고 첫 덕목 + 첫 자연(엔진과 같은 문장 규칙)
        var virtue = usable.First(h => h.Category == "덕목").Meaning;
        var nature = usable.First(h => h.Category == "자연").Meaning;
        Assert.Equal($"부모님의 '{virtue}' 정신과 '{nature}'의 아름다움이 조화를 이루는 이름", n.NarrativeDescription);
        Assert.DoesNotContain(n.CoreValues, v => forbiddenMeanings.Contains(v));
        Assert.All(forbiddenMeanings, m => Assert.DoesNotContain($"'{m}'", n.NarrativeDescription));
        Assert.All(n.SuggestedThemes, t =>
            Assert.DoesNotContain(forbiddenMeanings, m => t.StartsWith(m + "과 ") || t.Contains("과 " + m + "의 ")));
    }

    // ═══════════════════════════════════════════════════════════════
    // 2026-10-26 결정 ③ — 미학 성별 판정·추천 랭킹 자원오행 +8 은 사용자가 보는 한자(배정·표시 한자)로만 정한다.
    // 옛 '하나라도' 규칙은 음절의 쓸 수 있는 글자 중 그 성별(오행) 글자가 하나라도 있으면 일치(보너스)로 셌다 — 지(여)는 화면의 智와 무관한
    // 馶 '굳셀'·吱 '가는 소리'(Male) 때문에 '맞지 않음'을 받았다(/name 지 여자 이름 73명). 표면별 보이는 한자:
    //   /evaluate·추천 카드·쌍둥이 카드 = ScoringService.AssignedHanja(출생일 있으면 조화의 용신 배정, 없으면 HanjaSelector.DefaultAssignment —
    //   2음절 이름은 /name 1순위 조합, 그 밖은 Select 용신 없음, 2026-10-27 O2)
    //   /name 정적 페이지 = NameSeoHanja.DisplayedHanja(1순위 조합 — 조합 없는 이름은 보이는 한자 없음)
    // 기대값은 보이는 한자의 성별·오행 값으로 테스트 안에서 따로 셈한다(ExpectedGenderBonus). 사례 확인 단언은 배정·성별 분류가 바뀌면 깨진다.
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task Gender_JiwooFemale_ShownJi_NoMismatch()
    {
        var ji = HanjaData.FindByCharacter(Cp(0x667A))!; // 智 슬기 지
        var wu = HanjaData.FindByCharacter(Cp(0x5B87))!; // 宇 집 우
        // 사례 확인: 지 줄의 쓸 수 있는 글자에 Male 글자(馶 '굳셀')가 있고 Female 글자는 없다 — 옛 규칙이 지(여)에 '맞지 않음'을 붙인 이유.
        // (吱 '가는 소리'는 2026-10-27 성별 규칙 감사로 Neutral — 옛 Male 은 부분 일치였다)
        var jiUsable = UsableIndependent("지");
        Assert.Contains(jiUsable, h => h.Character == Cp(0x99B6) && h.GenderPref == HanjaData.GenderPreference.Male);
        Assert.Contains(jiUsable, h => h.Character == Cp(0x5431) && h.GenderPref == HanjaData.GenderPreference.Neutral);
        Assert.DoesNotContain(jiUsable, h => h.GenderPref == HanjaData.GenderPreference.Female);
        Assert.Equal(HanjaData.GenderPreference.Neutral, ji.GenderPref);
        Assert.Equal(HanjaData.GenderPreference.Neutral, wu.GenderPref);

        // ① 보이는 한자 智宇 를 엔진에 그대로 — 성별 값이 없는 두 글자라 보너스·노트 없음
        var engine = new AestheticEngine();
        var b = await engine.CalculateScoreWithBreakdownAsync("지우", null, "neutral", "female", null, new HanjaData.HanjaInfo?[] { ji, wu });
        Assert.Equal(0, b.GenderBonus);
        Assert.DoesNotContain(b.Notes, n => n.Contains("성별 선호도"));

        // ② /name: 페이지 1순위 조합(dump-name-scores 와 같은 함수) — 판정은 그 조합 글자의 성별 값
        var page = NameSeoHanja.DisplayedHanja("지우", "female");
        Assert.All(page, h => Assert.NotNull(h));
        Assert.Equal(ji.Character, page[0]!.Character); // 사례 확인: /name 지우 1순위 조합은 智…
        var pb = await engine.CalculateScoreWithBreakdownAsync("지우", null, "neutral", "female", null, page);
        Assert.Equal(ExpectedGenderBonus(page, "female", out _, out var pageMismatch), pb.GenderBonus);
        Assert.False(pageMismatch);
        Assert.DoesNotContain(pb.Notes, n => n.Contains("맞지 않음"));

        // ③ /evaluate(출생일 없음·있음) — 화면의 지 글자로 판정, '맞지 않음' 없음
        foreach (var date in new DateTime?[] { null, new DateTime(2024, 3, 15) })
        {
            var r = await CreateEvaluationService().EvaluateNameAsync("지우", "김", date, "female", "neutral");
            var shown = ShownHanja(r);
            Assert.Equal(HanjaData.GenderPreference.Neutral, shown[0]!.GenderPref);
            Assert.Equal(ExpectedGenderBonus(shown, "female", out _, out var mm), r.Aesthetic.GenderBonus);
            Assert.False(mm);
            Assert.DoesNotContain(r.Aesthetic.Notes, n => n.Contains("성별 선호도") && n.Contains("맞지 않음"));
        }
    }

    [Fact]
    public async Task Gender_ShownOppositeHanja_IsMismatch()
    {
        var seo = HanjaData.FindByCharacter(Cp(0x66F8))!; // 書 글 서
        var jun = HanjaData.FindByCharacter(Cp(0x4FCA))!; // 俊 준걸 준
        Assert.Equal(HanjaData.GenderPreference.Neutral, seo.GenderPref);
        Assert.Equal(HanjaData.GenderPreference.Male, jun.GenderPref);
        var engine = new AestheticEngine();

        // 여자 이름 서준을 書俊 으로 보이면 俊(Male)이 반대 성별 — 불일치 한 음절 −2, '잘 맞음' 없음(옛 규칙은 서·준 줄의 Female 글자로 +5)
        var f = await engine.CalculateScoreWithBreakdownAsync("서준", null, "neutral", "female", null, new HanjaData.HanjaInfo?[] { seo, jun });
        Assert.Equal(-2, f.GenderBonus);
        Assert.Contains("일부 한자의 성별 선호도가 여자 이름과 맞지 않음", f.Notes);
        Assert.DoesNotContain(f.Notes, n => n.Contains("성별 선호도") && n.Contains("잘 맞음"));
        // 같은 한자를 남자 이름으로 보이면 일치 한 음절 +3
        var m = await engine.CalculateScoreWithBreakdownAsync("서준", null, "neutral", "male", null, new HanjaData.HanjaInfo?[] { seo, jun });
        Assert.Equal(3, m.GenderBonus);
        Assert.Contains("한자 성별 선호도가 남자 이름과 잘 맞음", m.Notes);
        Assert.DoesNotContain(m.Notes, n => n.Contains("맞지 않음"));

        // /evaluate: 혜성(남)에 보이는 蕙 '혜초 혜'는 Female(orchid — 혜 줄 빈출 惠·慧·蕙가 모두 Female 이라 남자 이름에도 배정된다,
        // HanjaGenderOverrideTests.Hye_CommonHanja_ShareOneGender — 대안이 없어 조합 선택의 반대 성별 제외도 빼지 못한다). 보이는 한자가 반대 성별이면
        // /evaluate 도 불일치. 출생일 없는 배정은 /name 1순위 조합 蕙星 이다(2026-10-27 O2 — 옛 Select 배정은 惠).
        // 옛 사례 유찬 燦 '빛날 찬'은 키워드 오분류라 2026-10-26 오버라이드로 Neutral 이 됐다(裕燦 0) — 사례 확인은 배정·성별 분류가 바뀌면 다시 고를 것
        var hye = HanjaData.FindByCharacter(Cp(0x8559))!; // 蕙 혜초 혜
        Assert.Equal(HanjaData.GenderPreference.Female, hye.GenderPref);
        var r = await CreateEvaluationService().EvaluateNameAsync("혜성", "김", null, "male", "neutral");
        var shown = ShownHanja(r);
        Assert.Equal(hye.Character, shown[0]!.Character); // 사례 확인: /evaluate 혜성(남) 배정 蕙…
        Assert.Equal(ExpectedGenderBonus(shown, "male", out var mt, out var mm), r.Aesthetic.GenderBonus);
        Assert.True(mm);
        Assert.Equal(mt, r.Aesthetic.Notes.Contains("한자 성별 선호도가 남자 이름과 잘 맞음"));
        Assert.Contains("일부 한자의 성별 선호도가 남자 이름과 맞지 않음", r.Aesthetic.Notes);
    }

    /// <summary>
    /// 2026-10-26 성별 오분류 오버라이드(data/hanja-gender-overrides.json 에 10자 — 燦·輝·彬·斌·耀·均·學·鶴 Female, 乼·茁 Male → Neutral):
    /// 결정 ③ 뒤 키워드 부분 일치로 성별이 붙은 글자가 인기 이름의 1순위 조합에 올라 '맞지 않음'(−2)을 냈다. 오버라이드 뒤에는 /name(1순위 조합)·
    /// 발행 데이터(name-seo.json sc.no)·/evaluate(출생일 없음) 어디에도 '맞지 않음'이 없다. 기대값은 보이는 한자의 성별 값으로 따로 센다(ExpectedGenderBonus).
    /// 사례 확인(그 음절의 /name 보이는 글자 = 오버라이드 글자, 페이지 성별 = 사례 성별)은 조합·출생 통계가 바뀌면 깨진다.
    /// 亨·衡 은 Male 로 두었다(HanjaGenderOverrideTests.HyeongCommonHanja_StayMale_ViaOverrideFile) — 여자 형 이름은 이 표에 넣지 않는다.
    /// </summary>
    [Theory]
    [InlineData("유찬", "male", 1, 0x71E6)]   // 裕燦 — 燦 빛날 찬 (옛 68점·'맞지 않음')
    [InlineData("우빈", "male", 1, 0x5F6C)]   // 宇彬 — 彬 빛날 빈
    [InlineData("예찬", "male", 1, 0x71E6)]   // 禮燦
    [InlineData("규빈", "male", 1, 0x5F6C)]   // 奎彬
    [InlineData("요한", "male", 0, 0x8000)]   // 耀翰 — 耀 빛날 요
    [InlineData("휘찬", "male", 0, 0x8F1D)]   // 輝燦 — 輝 빛날 휘 (燦 과 함께 옛 −4)
    [InlineData("동균", "male", 1, 0x5747)]   // 東均 — 均 고를 균
    [InlineData("학준", "male", 0, 0x9DB4)]   // 鶴俊 — 鶴 학 학 (옛 '잘 맞음'+'맞지 않음' 동시)
    [InlineData("줄리", "female", 0, 0x4E7C)] // 乼李 — 乼 줄칼 줄 (개방 대기 — 여자 이름에서 풀린 유일한 사례)
    public async Task Gender_OverriddenHanja_PopularNames_NoMismatch(string name, string gender, int syllable, int codepoint)
    {
        var path = Path.Combine(RepoRoot(), "frontend", "src", "data", "name-seo.json");
        using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        var rec = doc.RootElement.GetProperty("names").GetProperty(name);
        int m = rec.TryGetProperty("m", out var mv) ? mv.GetInt32() : 0, f = rec.TryGetProperty("f", out var fv) ? fv.GetInt32() : 0;
        Assert.Equal(gender, NameSeoHanja.Gender(m, f)); // 사례 확인: 페이지 성별

        // ① /name — 페이지 1순위 조합(dump-name-scores 와 같은 함수)의 그 음절 글자가 오버라이드 글자이고 Neutral
        var page = NameSeoHanja.DisplayedHanja(name, gender);
        Assert.NotNull(page[syllable]);
        Assert.Equal(Cp(codepoint), page[syllable]!.Character);
        Assert.Equal(HanjaData.GenderPreference.Neutral, page[syllable]!.GenderPref);
        var pb = await new AestheticEngine().CalculateScoreWithBreakdownAsync(name, null, "neutral", gender, null, page);
        Assert.Equal(ExpectedGenderBonus(page, gender, out _, out var pageMismatch), pb.GenderBonus);
        Assert.False(pageMismatch);
        Assert.DoesNotContain(pb.Notes, n => n.Contains("맞지 않음"));

        // ② 발행 데이터 — 재생성 체인을 거친 sc.no
        var notes = rec.GetProperty("sc").TryGetProperty("no", out var no)
            ? no.EnumerateArray().Select(x => x.GetString() ?? "").ToList() : new List<string>();
        Assert.DoesNotContain(notes, n => n.Contains("맞지 않음"));

        // ③ /evaluate(출생일 없음) — 배정 한자(DefaultAssignment = /name 1순위 조합)로 판정
        var r = await CreateEvaluationService().EvaluateNameAsync(name, "김", null, gender, "neutral");
        var shown = ShownHanja(r);
        Assert.Equal(ExpectedGenderBonus(shown, gender, out _, out var mm), r.Aesthetic.GenderBonus);
        Assert.False(mm);
        Assert.DoesNotContain(r.Aesthetic.Notes, n => n.Contains("성별 선호도") && n.Contains("맞지 않음"));
    }

    /// <summary>음절의 쓸 수 있는 글자에 성별 글자(馶·吱 Male)가 있어도 화면 글자(智)가 Neutral 이면 영향 없음 — 옛 규칙은 남 +3·여 −2.</summary>
    [Theory]
    [InlineData("male")]
    [InlineData("female")]
    public async Task Gender_SyllableWithGenderedUsable_ShownNeutral_NoEffect(string gender)
    {
        Assert.Contains(UsableIndependent("지"), h => h.GenderPref == HanjaData.GenderPreference.Male);
        Assert.Empty(HanjaData.FindByReading("쁨"));

        var r = await CreateEvaluationService().EvaluateNameAsync("지쁨", "김", null, gender, "neutral");
        var shown = ShownHanja(r);
        Assert.NotNull(shown[0]);
        Assert.Null(shown[1]);
        Assert.Equal(HanjaData.GenderPreference.Neutral, shown[0]!.GenderPref);
        Assert.Equal(0, r.Aesthetic.GenderBonus);
        Assert.DoesNotContain(r.Aesthetic.Notes, n => n.Contains("성별 선호도"));
    }

    /// <summary>
    /// 한자를 직접 넘기는 경로(IAestheticEngine 6인자 — /name 덤프·ScoringService 가 쓴다): 넘긴 한자가 성별을 정하고, 넘기지 않으면
    /// /evaluate(출생일 없음)의 배정 = HanjaSelector.DefaultAssignment(2음절 이름은 /name 1순위 조합 — 2026-10-27 O2, 옛 기본값은 Select 용신 없음).
    /// /evaluate API 에는 사용자가 한자를 고르는 입력이 없다(이름·성·생일·성별·톤뿐).
    /// </summary>
    [Fact]
    public async Task Aesthetic_ExplicitShownHanja_DecideGender_DefaultIsFirstCombo()
    {
        var ji = HanjaData.FindByCharacter(Cp(0x667A))!;     // 智 Neutral
        var wu = HanjaData.FindByCharacter(Cp(0x5B87))!;     // 宇 Neutral
        var strong = HanjaData.FindByCharacter(Cp(0x99B6))!; // 馶 굳셀 지 — 쓸 수 있는 Male 글자
        var trip = HanjaData.FindByCharacter(Cp(0x528D))!;   // 劍 칼 검 — 불용 Male (옛 사례 躓 '넘어질'은 2026-10-27 규칙 감사로 Neutral)
        Assert.Equal(HanjaData.GenderPreference.Male, strong.GenderPref);
        Assert.False(HanjaData.IsForbiddenNameHanja(strong.Character));
        Assert.False(string.IsNullOrEmpty(strong.Meaning));
        Assert.True(HanjaData.IsForbiddenNameHanja(trip.Character));
        Assert.Equal(HanjaData.GenderPreference.Male, trip.GenderPref);

        var engine = new AestheticEngine();
        Task<AestheticBreakdown> Run(params HanjaData.HanjaInfo?[] shown)
            => engine.CalculateScoreWithBreakdownAsync("지우", null, "neutral", "female", null, shown);
        var neutral = await Run(ji, wu);
        var opposite = await Run(strong, wu);
        var forbidden = await Run(trip, wu);
        var none = await Run(null, null);

        Assert.Equal(0, neutral.GenderBonus);
        Assert.Equal(-2, opposite.GenderBonus);
        Assert.Contains("일부 한자의 성별 선호도가 여자 이름과 맞지 않음", opposite.Notes);
        Assert.Equal(0, forbidden.GenderBonus); // 불용 글자는 넘겨도 세지 않는다(어디서도 배정·표시하지 않는 글자)
        Assert.DoesNotContain(forbidden.Notes, n => n.Contains("성별 선호도"));
        Assert.Equal(0, none.GenderBonus);
        foreach (var x in new[] { opposite, forbidden, none }) // 성별 말고는 같다
            Assert.Equal(neutral.TotalScore - neutral.GenderBonus, x.TotalScore - x.GenderBonus);

        var dflt = await engine.CalculateScoreWithBreakdownAsync("지우", null, "neutral", "female");
        var assigned = HanjaSelector.DefaultAssignment("지우", "female");
        Assert.Equal(NameSeoHanja.DisplayedHanja("지우", "female").Select(h => h?.Character), assigned.Select(h => h?.Character)); // /name 1순위 조합
        Assert.Equal(new[] { ji.Character, wu.Character }, assigned.Select(h => h?.Character)); // 사례 확인: 智宇(옛 Select 배정은 智瑀 — 瑀 Female)
        var viaAssigned = await engine.CalculateScoreWithBreakdownAsync("지우", null, "neutral", "female", null, assigned);
        Assert.Equal(ExpectedGenderBonus(assigned, "female"), dflt.GenderBonus);
        Assert.Equal(viaAssigned.GenderBonus, dflt.GenderBonus);
        Assert.Equal(viaAssigned.Notes, dflt.Notes);
        // 2음절이 아니거나 조합이 없는 이름은 Select(용신 없음) 그대로
        Assert.Equal(HanjaSelector.Select("지", "female", null, null, null).Select(h => h?.Character),
            HanjaSelector.DefaultAssignment("지", "female").Select(h => h?.Character));
        Assert.Equal(HanjaSelector.Select("지우람", "female", null, null, null).Select(h => h?.Character),
            HanjaSelector.DefaultAssignment("지우람", "female").Select(h => h?.Character));
    }

    /// <summary>
    /// ScoringService 가 배정 한자를 한 번 정해 미학 성별 판정에 넘기고(AssignedHanja), /evaluate 가 그 한자를 그대로 보인다 —
    /// 출생일이 있으면 조화의 용신 배정과 같은 목록, 없으면 기본 배정(HanjaSelector.DefaultAssignment — 2음절 이름은 /name 1순위 조합,
    /// 지우(여) 智宇·건우(여) 建佑 — 옛 Select 배정은 智瑀·建瑀).
    /// </summary>
    [Theory]
    [InlineData("지우", "female", null)]
    [InlineData("지우", "female", "2024-03-15")]
    [InlineData("유찬", "male", null)]
    [InlineData("서연", "male", "2023-05-10")]
    [InlineData("건우", "female", null)]
    [InlineData("민준", "male", "2024-01-15")]
    [InlineData("하은", "female", "2025-02-11")]
    [InlineData("지쁨", "male", "2024-08-30")]
    public async Task Scoring_GenderBonus_UsesAssignedHanja_SameAsShown(string name, string gender, string? date)
    {
        var birth = date == null ? (DateTime?)null : DateTime.Parse(date);
        var scoring = new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine());
        var s = await scoring.EvaluateAsync(name, "김", birth, gender, "neutral");

        var expectedAssigned = birth.HasValue
            ? s.Harmony.SelectedHanja.Select(h => h?.Character)
            : HanjaSelector.DefaultAssignment(name, gender).Select(h => h?.Character);
        Assert.Equal(expectedAssigned, s.AssignedHanja.Select(h => h?.Character));
        if (!birth.HasValue && NameSeoHanja.Combos(name, gender).Count > 0) // 출생일 없는 2음절 이름 = /name 1순위 조합
            Assert.Equal(NameSeoHanja.DisplayedHanja(name, gender).Select(h => h?.Character), s.AssignedHanja.Select(h => h?.Character));
        Assert.Equal(ExpectedGenderBonus(s.AssignedHanja, gender), s.Aesthetic.GenderBonus);

        var r = await new NameEvaluationService(scoring, new ExplanationEngine()).EvaluateNameAsync(name, "김", birth, gender, "neutral");
        var shown = ShownHanja(r);
        Assert.Equal(s.AssignedHanja.Select(h => h?.Character), shown.Select(h => h?.Character));
        Assert.Equal(ExpectedGenderBonus(shown, gender, out var match, out var mismatch), r.Aesthetic.GenderBonus);
        Assert.Equal(match, r.Aesthetic.Notes.Any(n => n.Contains("성별 선호도") && n.Contains("잘 맞음")));
        Assert.Equal(mismatch, r.Aesthetic.Notes.Any(n => n.Contains("성별 선호도") && n.Contains("맞지 않음")));
    }

    /// <summary>/name: 페이지에 이 이름의 한자가 보이는 건 2음절·비반복 이름의 1순위 조합뿐 — 3음절·첩음·1음절은 보이는 한자가 없어 성별 0.</summary>
    [Theory]
    [InlineData("지우", "female")]
    [InlineData("유찬", "male")]
    [InlineData("다니엘", "male")]
    [InlineData("지지", "female")]
    [InlineData("솔", "none")]
    public async Task NameSeoHanja_DisplayedHanja_IsFirstCombo(string name, string gender)
    {
        var shown = NameSeoHanja.DisplayedHanja(name, gender);
        Assert.Equal(name.Length, shown.Count);
        bool comboName = name.Length == 2 && name[0] != name[1];
        var combos = comboName ? HanjaSelector.SelectCombos(name, gender, 4) : new List<(string First, string Second)>();
        Assert.Equal(combos, NameSeoHanja.Combos(name, gender));
        if (combos.Count > 0)
            Assert.Equal(new[] { combos[0].First, combos[0].Second }, shown.Select(h => h!.Character));
        else
            Assert.All(shown, h => Assert.Null(h));

        var b = await new AestheticEngine().CalculateScoreWithBreakdownAsync(name, null, "neutral", gender, null, shown);
        Assert.Equal(ExpectedGenderBonus(shown, gender), b.GenderBonus);
        if (combos.Count == 0) Assert.DoesNotContain(b.Notes, n => n.Contains("성별 선호도"));
    }

    /// <summary>
    /// 랭킹 자원오행 +8 은 배정 한자(카드에 보이는 글자)의 오행으로만 — 지우=智(火)·宇(木). 옛 규칙은 지·우 줄의 쓸 수 있는 글자에
    /// 다섯 오행이 다 있어(池 水·鋕 金 등) 어느 용신이든 +8 이었다. 배정 한자가 없으면 +8 없음.
    /// </summary>
    [Theory]
    [InlineData("火", true)]
    [InlineData("木", true)]
    [InlineData("水", false)]
    [InlineData("金", false)]
    [InlineData("土", false)]
    public async Task Ranker_HanjaElementBonus_FollowsAssignedHanja(string element, bool recorded)
    {
        var ji = Cp(0x667A); // 智
        var wu = Cp(0x5B87); // 宇
        Assert.True("지우".Any(s => UsableIndependent(s.ToString()).Any(h => h.FiveElement == element)), "옛 규칙이면 +8 인 사례");
        bool expectBonus = new[] { ji, wu }.Any(ch => HanjaData.FindByCharacter(ch)!.FiveElement == element);
        Assert.Equal(recorded, expectBonus);

        var withHanja = new NameForm.Domain.Models.Candidate
        {
            Name = "지우", AestheticScore = 80, HarmonyScore = 60, SyllableHanja = new List<string?> { ji, wu }
        };
        var unassigned = new NameForm.Domain.Models.Candidate { Name = "지우", AestheticScore = 80, HarmonyScore = 60 };
        await new RankerEngine().RankCandidatesAsync(new List<NameForm.Domain.Models.Candidate> { withHanja, unassigned }, element);

        int eum = KoreanUtils.HasEumryeongMatch("지우", element) ? 5 : 0;
        Assert.Equal(74 + (expectBonus ? 8 : 0) + eum, withHanja.FinalScore); // 80*0.7 + 60*0.3 = 74
        Assert.Equal(74 + eum, unassigned.FinalScore);
    }

    /// <summary>추천(POST /recommendations, 선호 오행 있음)의 +8 이 카드 한자(Hanja)의 오행과 맞는다 — 옛 규칙과 판정이 갈리는 후보가 실제로 있다.</summary>
    [Theory]
    [InlineData("김", "female", "2024-01-15", "水")]
    [InlineData("이", "male", "2023-05-10", "火")]
    [InlineData("박", "none", "2025-02-11", "金")]
    public async Task Recommendation_ElementBonus_FollowsCardHanja(string lastName, string gender, string date, string element)
    {
        var pool = new NamePoolEngine(_saju);
        var svc = new RecommendationService(new NameForm.Infrastructure.Repositories.InMemoryRecommendationRepository(), pool,
            new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine()),
            new RankerEngine(), new ExplanationEngine(), new ParentBasedNamingEngine(pool, new NameReversalEngine()), new DualNameEngine(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<RecommendationService>.Instance);
        var res = await svc.CreateRecommendationAsync(new CreateRecommendationRequestDto
        {
            LastName = lastName, BirthDate = date, Gender = gender, Tone = "neutral", PreferredFiveElement = element
        });
        Assert.NotEmpty(res.TopCandidates);

        static bool Usable(HanjaData.HanjaInfo h) => !HanjaData.IsForbiddenNameHanja(h.Character) && !string.IsNullOrEmpty(h.Meaning);
        int differsFromOldRule = 0;
        foreach (var c in res.TopCandidates)
        {
            var cardChars = (c.Hanja ?? "").EnumerateRunes().Select(r => r.ToString()).ToList();
            bool cardMatch = cardChars.Any(ch => HanjaData.FindByCharacter(ch) is { } h && Usable(h) && h.FiveElement == element);
            bool oldRule = c.Name.Any(s => UsableIndependent(s.ToString()).Any(h => h.FiveElement == element));
            if (cardMatch != oldRule) differsFromOldRule++;
            int baseScore = (int)Math.Round(c.AestheticScore * 0.7 + c.HarmonyScore * 0.3);
            int eum = KoreanUtils.HasEumryeongMatch(c.Name, element) ? 5 : 0;
            Assert.Equal(Math.Min(100, baseScore + (cardMatch ? 8 : 0) + eum), c.FinalScore);
        }
        Assert.True(differsFromOldRule > 0, "상위 후보 중 옛 규칙과 +8 판정이 갈리는 후보가 없다 — 사례를 다시 고를 것");
    }

    /// <summary>쌍둥이 카드 이유의 한자 줄 = 점수가 쓴 배정 한자('한자 뜻') — 옛 호출은 배정 한자를 넘기지 않아 음절별 1순위 '한자 예'가 나왔다.</summary>
    [Fact]
    public async Task Twin_Reasons_HanjaLine_IsAssignedHanja()
    {
        var scoring = new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine());
        var twin = new TwinNameService(new TwinNameEngine(_saju), scoring, new ExplanationEngine(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<TwinNameService>.Instance);
        var res = await twin.GenerateTwinNamesAsync(new TwinNameRequestDto
        {
            LastName = "김", BirthDate = "2024-06-15", Gender = "female", Tone = "neutral", ChildCount = 2
        });
        var names = res.NameSets.SelectMany(s => s.Names).ToList();
        Assert.NotEmpty(names);
        int withHanja = 0;
        foreach (var c in names)
        {
            var s = await scoring.EvaluateAsync(c.Name, "김", new DateTime(2024, 6, 15), "female", "neutral");
            var assigned = s.AssignedHanja.Where(h => h != null && !string.IsNullOrEmpty(h.Meaning)).Select(h => h!.Character).ToList();
            Assert.DoesNotContain(c.Reasons, r => r.StartsWith("한자 예 — "));
            if (assigned.Count == 0) continue;
            withHanja++;
            var line = Assert.Single(c.Reasons, r => r.StartsWith("한자 뜻 — "));
            var chars = line["한자 뜻 — ".Length..].Split(" — ")[0].Split(" + ").Select(OptionChar).ToList();
            Assert.Equal(assigned, chars);
            Assert.Equal(s.AestheticScore, c.AestheticScore);
        }
        Assert.True(withHanja > 0);
    }

    // ═══════════════════════════════════════════════════════════════
    // 결정 ③ 보완 (2026-10-26) — /name-analysis 큰 카드·용신 배지
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// /name-analysis(출생일 있음): 점수(ScoringService)가 쓴 배정 한자가 음절별 큰 카드(첫 후보)다 — 미학 성별 보너스와 조화(자원오행·성별)가
    /// 화면에서 가장 크게 보이는 한자로 매겨진다. 옛 화면은 큰 카드가 표시 1순위(OrderForDisplay)이고 점수는 숨은 배정 한자라
    /// 지민(여, 2024-03-15) 카드 智敏(0)인데 점수는 智旼(+3)이었다(인기 100명 × 남녀 × 생일 3개 600행 중 295행이 이렇게 갈렸다).
    /// 기대값은 응답의 큰 카드 글자 성별 값으로 따로 센다(ExpectedGenderBonus). 사례 확인 단언은 배정·성별 분류가 바뀌면 깨진다.
    /// </summary>
    [Theory]
    // 옛 사례 지민(여) 카드 智敏 0 · 점수 智旼 +3 은 2026-10-27 성별 규칙 감사로 旼 '화할'이 Neutral 이 되어 두 값이 같아졌다(사례 아님)
    [InlineData("서준", "female", "2024-03-15")] // 옛 카드 書俊 −2 · 점수 書駿 0
    [InlineData("하준", "male", "2024-03-15")]   // 옛 카드 荷俊 +1 · 점수 夏俊 +3
    [InlineData("민준", "female", "2024-03-15")] // 옛 카드 敏俊 −2 · 점수 旼駿 +3
    public async Task Analysis_WithBirthDate_BigCardIsScoredHanja(string name, string gender, string date)
    {
        var scoring = new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine());
        var s = await scoring.EvaluateAsync(name, "김", DateTime.Parse(date), gender, "neutral");
        var r = await CreateAnalysisService().AnalyzeNameAsync(new NameAnalysisRequestDto
        {
            LastName = "김", FirstName = name, BirthDate = date, Gender = gender, Tone = "neutral"
        });

        Assert.Equal(s.AestheticScore, r.AestheticScore); // /evaluate·smart 와 같은 점수(동등성 계약은 그대로)
        Assert.Equal(s.FinalScore, r.FinalScore);
        var bigCards = r.HanjaBreakdown.Select(b => b.PossibleHanja.First().Character).ToList();
        Assert.Equal(s.AssignedHanja.Select(h => h?.Character), bigCards);
        Assert.Equal(ExpectedGenderBonus(bigCards.Select(HanjaData.FindByCharacter), gender), s.Aesthetic.GenderBonus);

        // 큰 카드 뒤는 표시 정렬 그대로(배정 글자만 앞으로 옮긴다) — 10개 이하·중복 없음·불용 없음
        for (int i = 0; i < name.Length; i++)
        {
            var chars = r.HanjaBreakdown[i].PossibleHanja.Select(h => h.Character).ToList();
            Assert.True(chars.Count <= NameAnalysisService.HanjaOptionsPerSyllable);
            Assert.Equal(chars.Count, chars.Distinct().Count());
            Assert.DoesNotContain(chars, HanjaData.IsForbiddenNameHanja);
            var rest = HanjaSelector.TopForDisplay(name[i].ToString(), NameAnalysisService.HanjaOptionsPerSyllable + 1)
                .Select(h => h.Character).Where(c => c != chars[0]).Take(chars.Count - 1);
            Assert.Equal(rest, chars.Skip(1));
        }

        // 사례 확인: 옛 큰 카드(표시 1순위)로 세면 점수의 성별 보너스와 다르다 — 옛 화면의 불일치
        var oldCards = name.Select(c => HanjaSelector.TopForDisplay(c.ToString(), 1).FirstOrDefault()).ToList();
        Assert.NotEqual(ExpectedGenderBonus(oldCards, gender), s.Aesthetic.GenderBonus);
    }

    /// <summary>
    /// /name-analysis '이 이름은 용신에 부합합니다' 배지 = 큰 카드(배정 한자) 중 용신 오행 글자가 있는지 — 랭킹 자원오행 +8 과 같은 정의.
    /// 옛 규칙은 음절별 후보 10개 중 하나라도 그 오행이면 true 라, 인기 100명 × 3성별 × 생일 3개 900행이 모두 true 였다
    /// (새 규칙 848행 — 은찬 恩燦 火火·용신 木 도 '부합'이었다). 기대값은 응답의 큰 카드에서 따로 센다.
    /// </summary>
    [Theory]
    [InlineData("은찬", "male", "2021-07-08", false)]  // 용신 木 · 큰 카드 恩燦(火火)
    [InlineData("은찬", "male", "2024-06-15", false)]  // 용신 水 · 銀燦(金火)
    [InlineData("은찬", "male", "2024-03-15", true)]   // 용신 火 · 恩燦
    [InlineData("주원", "female", "2024-03-15", false)] // 용신 火 · 柱元(木木)
    public async Task Analysis_NameFitsYongshin_FollowsBigCard(string name, string gender, string date, bool recorded)
    {
        var r = await CreateAnalysisService().AnalyzeNameAsync(new NameAnalysisRequestDto
        {
            LastName = "김", FirstName = name, BirthDate = date, Gender = gender, Tone = "neutral"
        });
        var y = r.Saju!.Yongshin!;
        var bigCards = r.HanjaBreakdown.Select(b => b.PossibleHanja.FirstOrDefault()?.Character).ToList();
        bool expected = bigCards.Any(c => c != null && HanjaData.FindByCharacter(c) is { } h
            && !HanjaData.IsForbiddenNameHanja(c) && !string.IsNullOrEmpty(h.Meaning) && h.FiveElement == y.PrimaryYongshin);
        Assert.Equal(expected, y.NameFitsYongshin);
        Assert.Equal(recorded, expected); // 사례 확인

        // 사례 확인: 후보 목록에는 용신 오행 글자가 있다 — 옛 '하나라도' 규칙이면 true 였을 사례
        Assert.Contains(r.HanjaBreakdown, b => b.PossibleHanja.Any(h => h.FiveElement == y.PrimaryYongshin));
    }
}
