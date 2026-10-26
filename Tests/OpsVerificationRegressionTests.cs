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
        // 운영 실측(10/23): 김노아 努→璐 — 努이 gov +500 을 못 받아 '노' 표시 1순위가 璐(아름다운 옥 로(노))였다
        Assert.Equal(Cp(0x52AA), HanjaSelector.TopForDisplay("노", 1)[0].Character);
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
        // 후보가 있는 음절은 예전처럼 센다 — 은(恩 등 Female)은 '퍅' 옆에서도 여자 이름 일치, '몰' 옆 서(瑞 등 자연·덕목)는 의미 가점
        var svc = CreateEvaluationService();
        var withPyak = await svc.EvaluateNameAsync("퍅은", "김", null, "female", "neutral");
        var alone = await svc.EvaluateNameAsync("쁨은", "김", null, "female", "neutral");
        Assert.Equal(alone.Aesthetic.GenderBonus, withPyak.Aesthetic.GenderBonus);
        Assert.True(withPyak.Aesthetic.GenderBonus > 0, $"은 여자 이름 일치: {withPyak.Aesthetic.GenderBonus}");

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
}
