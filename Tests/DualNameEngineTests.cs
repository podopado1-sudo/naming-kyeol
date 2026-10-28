using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging.Abstractions;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;
using NameForm.Infrastructure.Repositories;

namespace NameForm.Tests;

public class DualNameEngineTests
{
    // Program.cs 등록과 같은 실제 사주·용신 서비스 — 대표 한자가 /evaluate 용신 배정과 같은지 보려면 가짜가 아니어야 한다
    private readonly SajuCalculationService _saju = new();
    private readonly YongshinCalculationService _yongshin = new();
    private readonly DualNameEngine _engine;

    public DualNameEngineTests()
    {
        HanjaData.LoadExternalData();
        _engine = new DualNameEngine(_saju, _yongshin);
    }

    private static readonly DateTime[] Births =
        { new(2025, 1, 1), new(2024, 3, 15), new(2021, 7, 8), new(2023, 11, 20) };
    private static readonly TimeSpan?[] Times = { null, new TimeSpan(9, 30, 0) };
    private static readonly string[] Genders = { "male", "female", "none" };

    private static IEnumerable<string> EnglishNames()
        => EnglishKoreanNameMap.GetMappings().Select(m => m.English).Distinct(StringComparer.OrdinalIgnoreCase);

    private ScoringService CreateScoring()
        => new(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine());

    /// <summary>쓸 수 있는 글자(불용 아님·뜻 있음) — 검사 대상(HanjaSelector)을 거치지 않고 사전에서 따로 거른다.</summary>
    private static bool UsableIndependent(HanjaData.HanjaInfo h)
        => !HanjaData.IsForbiddenNameHanja(h.Character) && !string.IsNullOrEmpty(h.Meaning);

    private static List<string> Glyphs(string s)
    {
        var list = new List<string>();
        var it = StringInfo.GetTextElementEnumerator(s);
        while (it.MoveNext()) list.Add((string)it.Current);
        return list;
    }

    // ═══════════════════════════════════════════════════════════════
    // 2026-10-28 안 1a — 대표 한자 = 같은 입력의 /evaluate 배정(ScoringService.AssignedHanja)
    // 옛 엔진은 UsableByReading 을 Category 점수로 다시 정렬해 출생일·시각·성별과 무관한 글자를 골라, '이 이름 평가하기' 링크의 /evaluate 와
    // 1,210/1,272행(영어 이름 110 × 성별 3 × 출생일 4 × 시각 2)에서 한자가 달랐다(필립 카드 筆岦 ↔ /evaluate 남 駜粒·여 熚粒)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task DualName_Hanja_SameAsEvaluateAssignedHanja_AllMappings()
    {
        var scoring = CreateScoring();
        int rows = 0, timeChanged = 0;
        var mismatches = new List<string>();
        foreach (var english in EnglishNames())
            foreach (var gender in Genders)
                foreach (var birth in Births)
                    foreach (var time in Times)
                    {
                        foreach (var c in await _engine.GenerateDualNamesAsync("김", english, birth, gender, "neutral", time))
                        {
                            rows++;
                            // 기대값 = /evaluate 와 같은 경로(ScoringService)가 같은 이름·출생일·시각·성별로 배정한 한자
                            var score = await scoring.EvaluateAsync(c.KoreanName, "김", birth, gender, "neutral", time);
                            var expected = score.AssignedHanja.Select(h => h?.Character).ToList();
                            if (!expected.SequenceEqual(c.HanjaCharacters.Select(x => (string?)x)))
                                mismatches.Add($"{english} {c.KoreanName} {gender} {birth:yyyy-MM-dd} {time}: 엔진 {string.Concat(c.HanjaCharacters)} ≠ /evaluate {string.Concat(expected.Select(x => x ?? "_"))}");
                            if (time != null)
                            {
                                var noTime = await scoring.EvaluateAsync(c.KoreanName, "김", birth, gender, "neutral");
                                if (!noTime.AssignedHanja.Select(h => h?.Character).SequenceEqual(expected)) timeChanged++;
                            }
                        }
                    }

        Assert.True(rows > 1000, $"이중 이름 후보 행 {rows}");
        Assert.True(mismatches.Count == 0, $"/evaluate 와 한자가 다른 행 {mismatches.Count}/{rows}:\n" + string.Join("\n", mismatches.Take(20)));
        // 출생 시각이 실제로 배정을 바꾸는 입력이 격자에 있어야 위 일치가 '시각을 넘겼다'는 증거가 된다(시각을 버리면 이 행들에서 갈린다)
        Assert.True(timeChanged > 0, "출생 시각 09:30 이 배정을 바꾸는 행이 격자에 없음");
    }

    [Theory]
    [InlineData("male")]
    [InlineData("female")]
    [InlineData("none")]
    public async Task DualName_DefaultList_SameAsEvaluateAssignedHanja(string gender)
    {
        // 영어 이름 없이 받는 기본 목록도 같은 배정
        var scoring = CreateScoring();
        var birth = new DateTime(2024, 3, 15);
        var time = new TimeSpan(21, 0, 0);
        var list = await _engine.GenerateDualNamesAsync("김", null, birth, gender, "neutral", time);
        Assert.NotEmpty(list);
        foreach (var c in list)
        {
            var expected = (await scoring.EvaluateAsync(c.KoreanName, "김", birth, gender, "neutral", time)).AssignedHanja.Select(h => h?.Character);
            Assert.Equal(expected, c.HanjaCharacters.Select(x => (string?)x));
        }
    }

    [Fact]
    public async Task DualName_GenderCaseInsensitive_LikeEvaluate()
    {
        // RecommendationService 는 request.Gender 를 원문 그대로 넘긴다 — ScoringService 처럼 정규화해 같은 글자
        var birth = new DateTime(2025, 1, 1);
        var lower = await _engine.GenerateDualNamesAsync("김", "Philip", birth, "male", "neutral");
        var upper = await _engine.GenerateDualNamesAsync("김", "Philip", birth, "Male", "neutral");
        Assert.NotEmpty(lower);
        Assert.Equal(lower.Select(c => string.Concat(c.HanjaCharacters)), upper.Select(c => string.Concat(c.HanjaCharacters)));
    }

    [Fact]
    public async Task DualName_NoWeakHanja_WhenNonWeakAlternativeExists()
    {
        // 옛 엔진은 대안이 있는데도 weak 글자를 골랐다(14음절 — 단=壇·비=備·사=赦·피=彼·하=何·자=恣·삭=削 등, 2026-10-28 조사).
        // 사이트 공통 규칙: 비약자 대안이 있으면 weak 는 양보. 대안 유무는 사전에서 따로 센다(FindByReading + 불용·뜻·weak 판정)
        Assert.True(HanjaData.IsWeakGivenNameHanja("壇"));
        Assert.Contains(HanjaData.FindByReading("단"), h => UsableIndependent(h) && !HanjaData.IsWeakGivenNameHanja(h.Character));

        int cellsWithAlternative = 0;
        var violations = new List<string>();
        foreach (var english in EnglishNames())
            foreach (var gender in Genders)
                foreach (var birth in Births)
                    foreach (var c in await _engine.GenerateDualNamesAsync("김", english, birth, gender, "neutral"))
                        for (int i = 0; i < c.KoreanName.Length; i++)
                        {
                            var syllable = c.KoreanName[i].ToString();
                            bool hasNonWeak = HanjaData.FindByReading(syllable)
                                .Any(h => UsableIndependent(h) && !HanjaData.IsWeakGivenNameHanja(h.Character));
                            if (!hasNonWeak) continue;
                            cellsWithAlternative++;
                            if (HanjaData.IsWeakGivenNameHanja(c.HanjaCharacters[i]))
                                violations.Add($"{english} {c.KoreanName} {gender} {birth:yyyy-MM-dd}: {syllable}={c.HanjaCharacters[i]}");
                        }

        Assert.True(cellsWithAlternative > 500, $"검사한 칸 {cellsWithAlternative}");
        Assert.True(violations.Count == 0, $"대안이 있는데 weak 글자를 고른 칸 {violations.Count}:\n" + string.Join("\n", violations.Distinct().Take(20)));
    }

    [Fact]
    public async Task DualName_HanjaMeaning_IsReadingGlossPerSyllable()
    {
        // 옛 값은 Meaning 전체라 다른 독음 훈까지 실렸다(이삭 削 '깎을 삭, 채지 소, 칼집 초' · 안토니 土 '흙 토, 뿌리 두, 쓰레기 차').
        // 지금은 음절마다 그 독음의 훈 하나(GlossForReading — /evaluate 의미 메모·추천 카드 뜻 줄과 같은 헬퍼)를 ' + ' 로 잇는다
        var frontendSplit = new Regex(@"\s*[+·]\s*"); // frontend/src/app/dual-name/page.tsx parseHanjaMeaning 과 같은 구분자
        int rows = 0;
        foreach (var english in EnglishNames())
            foreach (var gender in Genders)
                foreach (var c in await _engine.GenerateDualNamesAsync("김", english, new DateTime(2024, 3, 15), gender, "neutral"))
                {
                    rows++;
                    var parts = c.HanjaMeaning.Split(" + ");
                    Assert.Equal(c.KoreanName.Length, parts.Length);
                    var frontParts = frontendSplit.Split(c.HanjaMeaning).Select(s => s.Trim()).Where(s => s.Length > 0).ToList();
                    Assert.Equal(parts, frontParts); // 프런트 파서가 음절마다 한 칸으로 자른다
                    for (int i = 0; i < parts.Length; i++)
                    {
                        var syllable = c.KoreanName[i].ToString();
                        var info = HanjaData.FindByCharacter(c.HanjaCharacters[i]);
                        Assert.NotNull(info);
                        Assert.Equal(HanjaData.GlossForReading(info!.Meaning, syllable), parts[i]);
                        // 훈 하나 — 그 음절 독음으로 끝나고(본음 '낟알 립(입)'·두음 '벌일 렬(열)' 어느 쪽이든) 다른 독음 훈이 쉼표·빗금으로 붙지 않는다
                        Assert.Matches($@"(\s{syllable}(\([^)]+\))?|\s[^\s(]+\({syllable}\))$", parts[i]);
                        Assert.DoesNotContain(",", parts[i]);
                        Assert.DoesNotContain("/", parts[i]);
                    }
                }
        Assert.True(rows > 100, $"행 {rows}");
    }

    [Fact]
    public async Task DualName_NoDuplicateCard_PerEnglishName()
    {
        // english_korean_names.json 에 같은 영어 이름이 두 번(뒤쪽 블록 index 93~121) 있어 Sophia·Olivia·Hannah 카드가 두 장씩 나왔다 —
        // 12개를 첫 항목 자리에 합쳤다(Benjamin·Thomas 는 한글 목록 합집합)
        var mappings = EnglishKoreanNameMap.GetMappings();
        var dupEnglish = mappings.GroupBy(m => m.English, StringComparer.OrdinalIgnoreCase).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
        Assert.True(dupEnglish.Count == 0, "지도에 두 번 든 영어 이름: " + string.Join(",", dupEnglish));
        Assert.Equal(new[] { "벤자민", "벤야민" }, EnglishKoreanNameMap.FindByEnglishName("Benjamin").Single().Korean);
        Assert.Equal(new[] { "토마스", "토머스" }, EnglishKoreanNameMap.FindByEnglishName("Thomas").Single().Korean);

        foreach (var english in mappings.Select(m => m.English))
        {
            var cards = await _engine.GenerateDualNamesAsync("김", english, new DateTime(2025, 1, 1), "none", "neutral");
            var dup = cards.GroupBy(c => (c.KoreanName, c.EnglishEquivalent)).FirstOrDefault(g => g.Count() > 1);
            Assert.True(dup == null, $"{english}: 같은 카드 {dup?.Key} 가 {dup?.Count()}장");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // /search 이중 이름 탭·POST /recommendations — 엔진 글자를 카드 Hanja 로, 같은 응답 standard 탭과 같은 한자
    // 옛 탭은 Hanja 가 비어(318/318장) SmartResult 가 세리프 한자 자리에 한글 이름을 그렸고, 한자 글자는 태그 칩으로만 실렸다
    // ═══════════════════════════════════════════════════════════════

    private (SmartRecommendationService Smart, RecommendationService Rec) CreateRealServices()
    {
        var scoring = CreateScoring();
        var pool = new NamePoolEngine(_saju);
        var parent = new ParentBasedNamingEngine(pool, new NameReversalEngine());
        var rec = new RecommendationService(new InMemoryRecommendationRepository(), pool, scoring, new RankerEngine(), new ExplanationEngine(),
            parent, new DualNameEngine(_saju, _yongshin), NullLogger<RecommendationService>.Instance);
        var twin = new TwinNameService(new TwinNameEngine(_saju), scoring, new ExplanationEngine(), NullLogger<TwinNameService>.Instance);
        var smart = new SmartRecommendationService(rec, new PureKoreanNameEngine(), new CreativeNamingEngine(), new ThreeSyllableEngine(),
            new RareSurnameEngine(), parent, twin, new RequiredCharEngine(_saju), new DualNameEngine(_saju, _yongshin));
        return (smart, rec);
    }

    [Fact]
    public async Task Smart_DualNameTab_CardHanjaFilled_SameAsStandardTab()
    {
        var (smart, _) = CreateRealServices();
        int alsoInStandard = 0, cards = 0;
        foreach (var (english, gender, birth, time) in new[]
        {
            ("Daniel", "male", "2025-01-01", (string?)null), ("Daniel", "none", "2024-03-15", "09:30"), ("Noah", "male", "2024-03-15", "09:30"),
            ("Sophia", "female", "2025-01-01", "21:00"), ("Hannah", "none", "2024-03-15", null), ("Sean", "male", "2021-07-08", "09:30"),
        })
        {
            var res = await smart.GenerateSmartRecommendationsAsync(new SmartRecommendationRequestDto
            {
                LastName = "김", BirthDate = birth, BirthTime = time, Gender = gender, Tone = "neutral", PreferredEnglishName = english,
                IncludePureKorean = false, IncludeThreeSyllable = false, IncludeCreative = false,
            });
            var dual = res.Categories.Single(c => c.Type == "dual-name");
            Assert.NotEmpty(dual.Names);

            var engineCards = await _engine.GenerateDualNamesAsync("김", english, DateTime.Parse(birth, CultureInfo.InvariantCulture),
                gender, "neutral", time == null ? null : TimeSpan.Parse(time, CultureInfo.InvariantCulture));
            var standard = res.Categories.FirstOrDefault(c => c.Type == "standard");
            foreach (var n in dual.Names)
            {
                cards++;
                Assert.False(string.IsNullOrEmpty(n.Hanja), $"{n.Name}: 카드 Hanja 가 비었다");
                Assert.Equal(n.Name.Length, Glyphs(n.Hanja!).Count);
                Assert.Equal(string.Concat(engineCards.Single(c => c.KoreanName == n.Name).HanjaCharacters), n.Hanja);
                // 한자는 세리프 자리에만 — 태그 칩은 EN 하나
                Assert.Equal(new[] { $"EN:{engineCards.Single(c => c.KoreanName == n.Name).EnglishEquivalent}" }, n.Tags);
                var s = standard?.Names.FirstOrDefault(x => x.Name == n.Name);
                if (s != null)
                {
                    alsoInStandard++;
                    Assert.Equal(s.Hanja, n.Hanja);
                }
            }
        }
        // standard 탭은 이중 이름 후보를 합쳐 상위 10을 고르므로 같은 이름이 늘 들지는 않는다 — 대조한 카드가 있어야 의미가 있다
        Assert.True(cards > 0 && alsoInStandard > 0, $"이중 이름 카드 {cards} · standard 탭에도 든 카드 {alsoInStandard}");
    }

    [Fact]
    public async Task Recommendation_DualCandidate_HanjaMeaning_IsGlossOfCardHanja()
    {
        // POST /recommendations 한 후보 안에서 Hanja(배정 한자)와 HanjaMeaning(이중 이름 엔진 뜻)이 다른 글자를 가리켰다(단열: 旦烈 ↔ 壇列 의 뜻).
        // 엔진이 같은 입력(출생 시각 포함)의 배정을 고르니 HanjaMeaning 은 카드 Hanja 글자들의 독음 훈이다
        var (_, rec) = CreateRealServices();
        int checkedRows = 0;
        foreach (var (english, gender, time) in new[] { ("Daniel", "male", (string?)"09:30"), ("Noah", "none", null), ("Sophia", "female", "03:00") })
        {
            var res = await rec.CreateRecommendationAsync(new CreateRecommendationRequestDto
            {
                LastName = "김", BirthDate = "2024-03-15", BirthTime = time, Gender = gender, Tone = "neutral", PreferredEnglishName = english,
            });
            foreach (var c in res.TopCandidates.Where(c => !string.IsNullOrEmpty(c.HanjaMeaning)))
            {
                checkedRows++;
                var glyphs = Glyphs(c.Hanja ?? "");
                Assert.Equal(c.Name.Length, glyphs.Count);
                var expected = string.Join(" + ", glyphs.Select((ch, i) =>
                    HanjaData.GlossForReading(HanjaData.FindByCharacter(ch)!.Meaning, c.Name[i].ToString())));
                Assert.Equal(expected, c.HanjaMeaning);
            }
        }
        Assert.True(checkedRows > 0, "이중 이름 후보가 추천 상위 10에 하나도 없다");
    }

    [Fact]
    public async Task GenerateDualNamesAsync_WithPhilip_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateDualNamesAsync(
            "김", "Philip", DateTime.Now, "male", "neutral");

        // 필립이 한자 매핑 가능한 경우에만 결과 반환
        // 한자 데이터가 로드되지 않은 테스트 환경에서는 0일 수 있음
        Assert.NotNull(candidates);
    }

    [Fact]
    public async Task GenerateDualNamesAsync_WithoutPreference_ReturnsCandidates()
    {
        var candidates = await _engine.GenerateDualNamesAsync(
            "김", null, DateTime.Now, "female", "soft");

        Assert.NotNull(candidates);
    }

    [Fact]
    public async Task GenerateDualNamesAsync_AllCandidatesHaveRequiredFields()
    {
        var candidates = await _engine.GenerateDualNamesAsync(
            "이", "Sophia", DateTime.Now, "female", "soft");

        foreach (var candidate in candidates)
        {
            Assert.False(string.IsNullOrEmpty(candidate.KoreanName));
            Assert.False(string.IsNullOrEmpty(candidate.EnglishEquivalent));
            Assert.True(candidate.HanjaCharacters.Count > 0);
            Assert.False(string.IsNullOrEmpty(candidate.HanjaMeaning));
        }
    }

    [Fact]
    public async Task GenerateDualNamesAsync_KoreanNameIsValidHangul()
    {
        var candidates = await _engine.GenerateDualNamesAsync(
            "박", null, DateTime.Now, "male", "neutral");

        foreach (var candidate in candidates)
        {
            Assert.True(candidate.KoreanName.All(c => c >= 0xAC00 && c <= 0xD7A3));
            Assert.True(candidate.KoreanName.Length >= 2);
        }
    }
}
