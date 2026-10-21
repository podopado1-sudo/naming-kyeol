using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using NameForm.Api.Controllers;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;

namespace NameForm.Tests;

/// <summary>
/// 인명 도구(필수 글자·이름 평가) 정확성 회귀 — 2026-10 감사 RC-3·EV-1·EV-3·EV-4·EV-5·UX-3.
/// 감사 재현 케이스(이서연·김민준·남궁민·최아름·김치우 등)는 실제 사주·용신 서비스로 돌린다.
/// 점수 산식은 바꾸지 않은 수정들이라, 점수를 직접 고정하는 단언은 문구 정리가 점수를 건드리지 않았다는 증거다.
/// </summary>
public class ToolAccuracyRegressionTests
{
    private readonly SajuCalculationService _saju = new();
    private readonly YongshinCalculationService _yongshin = new();

    public ToolAccuracyRegressionTests()
    {
        HanjaData.LoadExternalData();
    }

    private NameEvaluationService CreateEvaluationService() => new(
        new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine()),
        new ExplanationEngine());

    /// <summary>"西(서녘 서)" → "西" (확장 영역 서로게이트 쌍도 그대로).</summary>
    private static string OptionChar(string option)
    {
        int open = option.IndexOf('(');
        return open > 0 ? option[..open] : option;
    }

    private static bool StartsWithHan(string s)
        => s.Length > 0 && (char.IsSurrogate(s[0]) || (s[0] >= 0x3400 && s[0] <= 0x9FFF) || (s[0] >= 0xF900 && s[0] <= 0xFAFF));

    // ═══════════════════════════════════════════════════════════════
    // RC-3 — 필수 글자 엔진
    // ═══════════════════════════════════════════════════════════════

    public static IEnumerable<object[]> RequiredCharCases() => new[]
    {
        new object[] { "이", "서", "first", "2021-07-02", "female", "soft" },   // 감사: 서오 汚·서약 弱·서망 罔
        new object[] { "정", "도", "any", "2020-03-15", "male", "neutral" },    // 감사: 도태·도용
        new object[] { "남궁", "민", "last", "2022-01-10", "female", "soft" },  // 감사: 인민·빈민
        new object[] { "김", "성", "any", "2021-07-02", "male", "neutral" },
    };

    [Theory]
    [MemberData(nameof(RequiredCharCases))]
    public async Task RequiredChar_NeverOffersForbiddenHanja(
        string lastName, string ch, string pos, string date, string gender, string tone)
    {
        var engine = new RequiredCharEngine(_saju);
        var cands = await engine.GenerateCandidatesAsync(lastName, ch, pos, DateTime.Parse(date), gender, tone);

        Assert.NotEmpty(cands);
        foreach (var c in cands)
            foreach (var opt in c.HanjaOptions)
                Assert.False(HanjaData.IsForbiddenNameHanja(OptionChar(opt)),
                    $"{c.Name}: 불용한자 {opt}가 후보 한자로 나옴");
    }

    [Theory]
    [MemberData(nameof(RequiredCharCases))]
    public async Task RequiredChar_WeakHanjaYieldsToHomophoneAlternative(
        string lastName, string ch, string pos, string date, string gender, string tone)
    {
        var engine = new RequiredCharEngine(_saju);
        var cands = await engine.GenerateCandidatesAsync(lastName, ch, pos, DateTime.Parse(date), gender, tone);

        foreach (var c in cands)
        {
            // 짝 글자 한자 설명은 first면 맨 뒤, last면 맨 앞
            var other = OptionChar(c.Position == "first" ? c.HanjaOptions[^1] : c.HanjaOptions[0]);
            if (!HanjaData.IsWeakGivenNameHanja(other)) continue;

            var reading = HanjaData.FindByCharacter(other)!.Reading;
            // 엔진 후보 풀과 같은 조건(뜻 보유·불용 제외·성별/톤 필터)에서 약하지 않은 동음 대안이 없어야 양보 안 한 게 정당하다
            var alternatives = HanjaData.HanjaDictionary.Values.Where(h =>
                h.Reading == reading && !string.IsNullOrEmpty(h.Meaning)
                && !HanjaData.IsForbiddenNameHanja(h.Character) && !HanjaData.IsWeakGivenNameHanja(h.Character)
                && !(gender == "female" && h.GenderPref == HanjaData.GenderPreference.Male)
                && !(gender == "male" && h.GenderPref == HanjaData.GenderPreference.Female)
                && !(tone == "soft" && h.TonePref == HanjaData.TonePreference.Strong)
                && !(tone == "strong" && h.TonePref == HanjaData.TonePreference.Soft));
            Assert.False(alternatives.Any(), $"{c.Name}: 약한 한자 {other} — 동음 대안이 있는데 양보하지 않음");
        }
    }

    [Theory]
    [MemberData(nameof(RequiredCharCases))]
    public async Task RequiredChar_ExcludesEverydayWordHomophones(
        string lastName, string ch, string pos, string date, string gender, string tone)
    {
        var engine = new RequiredCharEngine(_saju);
        var cands = await engine.GenerateCandidatesAsync(lastName, ch, pos, DateTime.Parse(date), gender, tone);
        var names = cands.Select(c => c.Name).ToHashSet();

        foreach (var bad in new[] { "도태", "도용", "인민", "빈민", "서자", "성기", "정자", "서명" })
            Assert.DoesNotContain(bad, names);
        Assert.DoesNotContain(names, ForbiddenWordData.IsNegativeHomophoneName);
    }

    [Theory]
    [InlineData("Male", "Neutral", "male", "neutral")]
    [InlineData("Female", "Soft", "female", "soft")]
    public async Task RequiredChar_GenderToneAreCaseInsensitive(string g1, string t1, string g2, string t2)
    {
        var engine = new RequiredCharEngine(_saju);
        var date = new DateTime(2021, 7, 2);
        var upper = await engine.GenerateCandidatesAsync("이", "서", "first", date, g1, t1);
        var lower = await engine.GenerateCandidatesAsync("이", "서", "first", date, g2, t2);

        Assert.Equal(lower.Select(c => c.Name), upper.Select(c => c.Name));
    }

    // ── BT-1 두음법칙 — 짝 글자가 첫 음절이면 ㄹ / ㄴ+ㅣ·ㅑ·ㅕ·ㅛ·ㅠ·ㅖ 독음을 쓰지 않는다 ──

    private static readonly HashSet<string> IotizedVowels = new() { "ㅣ", "ㅑ", "ㅕ", "ㅛ", "ㅠ", "ㅖ" };

    /// <summary>독립 기준(자모 분해): 단어 첫머리에 오면 두음법칙에 걸리는 음절.</summary>
    private static bool BreaksInitialDueum(char syllable)
    {
        var (initial, vowel, _) = KoreanUtils.Decompose(syllable);
        return initial == "ㄹ" || (initial == "ㄴ" && IotizedVowels.Contains(vowel));
    }

    public static IEnumerable<object[]> DueumCases() => new[]
    {
        // 감사 재현(로컬 1라운드): 룡도 1위·린도 2위 / 련민·림민·뇨민·례민·리민·료민·려민 / 련자·림자·륜자
        new object[] { "정", "도", "any", "2020-03-15", "Male", "Neutral", new[] { "룡도", "린도" } },
        new object[] { "남궁", "민", "last", "2022-01-10", "Female", "Soft", new[] { "련민", "림민", "뇨민", "례민", "리민", "료민", "려민" } },
        new object[] { "최", "자", "last", "2021-05-05", "female", "neutral", new[] { "련자", "림자", "륜자" } },
        new object[] { "이", "서", "any", "2021-07-02", "female", "soft", Array.Empty<string>() },
    };

    [Theory]
    [MemberData(nameof(DueumCases))]
    public async Task RequiredChar_PartnerOnFirstSyllable_FollowsDueum(
        string lastName, string ch, string pos, string date, string gender, string tone, string[] reported)
    {
        var engine = new RequiredCharEngine(_saju);
        var cands = await engine.GenerateCandidatesAsync(lastName, ch, pos, DateTime.Parse(date), gender, tone);
        var names = cands.Select(c => c.Name).ToHashSet();

        Assert.NotEmpty(cands);
        Assert.Contains(cands, c => c.Position == "last"); // 짝 글자가 첫 음절인 후보가 실제로 있어야 검사가 의미 있다
        foreach (var c in cands.Where(c => c.Position == "last"))
            Assert.False(BreaksInitialDueum(c.Name[0]), $"{c.Name}: 짝 글자 첫 음절이 두음법칙 위반");
        foreach (var bad in reported)
            Assert.DoesNotContain(bad, names);
    }

    [Theory]
    [InlineData("리", "first")]
    [InlineData("류", "first")]
    [InlineData("련", "any")]
    public async Task RequiredChar_UserChosenFirstSyllable_IsKept(string ch, string pos)
    {
        // 사용자가 고른 필수 글자는 첫 음절이어도 그대로 — 두음 규칙은 짝 글자 쪽에만
        var cands = await new RequiredCharEngine(_saju).GenerateCandidatesAsync(
            "김", ch, pos, new DateTime(2021, 7, 2), "female", "neutral");

        Assert.Contains(cands, c => c.Position == "first" && c.Name.StartsWith(ch));
        Assert.All(cands.Where(c => c.Position == "first"), c => Assert.StartsWith(ch, c.Name));
    }

    [Theory]
    [InlineData('룡', '용')]
    [InlineData('련', '연')]
    [InlineData('림', '임')]
    [InlineData('린', '인')]
    [InlineData('료', '요')]
    [InlineData('례', '예')]
    [InlineData('량', '양')]
    [InlineData('류', '유')]
    [InlineData('뇨', '요')]
    [InlineData('녀', '여')]
    [InlineData('니', '이')]
    [InlineData('라', '나')]
    [InlineData('로', '노')]
    [InlineData('뢰', '뇌')]
    [InlineData('락', '낙')]
    [InlineData('나', '나')]
    [InlineData('노', '노')]
    [InlineData('민', '민')]
    [InlineData('용', '용')]
    public void RequiredChar_ApplyInitialDueum_CaseTable(char input, char expected)
    {
        Assert.Equal(expected, RequiredCharEngine.ApplyInitialDueum(input));
        Assert.Equal(input != expected, RequiredCharEngine.ViolatesInitialDueum(input));
    }

    [Theory]
    // 두음 적용형이 생활어 목록에 걸리는 원음 표기 — 필수 글자를 첫 음절에 고른 경우에도 거른다
    [InlineData("련민")] // → 연민
    [InlineData("룡도")] // → 용도
    [InlineData("리민")] // → 이민
    [InlineData("련도")] // → 연도
    // BT-2 생활어 보강 (방자 放恣·서녀 庶女 / 분자·서적·도중·교민)
    [InlineData("방자")]
    [InlineData("서녀")]
    [InlineData("분자")]
    [InlineData("서적")]
    [InlineData("도중")]
    [InlineData("교민")]
    public void RequiredChar_IsExcludedName_BlocksEverydayWordsInBothSpellings(string name)
    {
        Assert.True(RequiredCharEngine.IsExcludedName("김", name), name);
    }

    [Theory]
    [InlineData("리아")]
    [InlineData("류하")]
    [InlineData("서윤")]
    [InlineData("도윤")]
    public void RequiredChar_IsExcludedName_KeepsOrdinaryNames(string name)
    {
        Assert.False(RequiredCharEngine.IsExcludedName("김", name), name);
    }

    // ── BE-F1 — 실명이 거의 없는 생활 명사 보강 (2026-10-21 최종 검토) ──

    /// <summary>
    /// 생활어 목록에 이번에 더한 낱말 — 넣는 기준은 '실명 10명 미만'(data/name-gender-stats.json).
    /// 검토 보고분(국자~임도) + 같은 조건에서 바로 다음에 올라온 것(강자~수제).
    /// </summary>
    private static readonly string[] AddedEverydayNouns =
    {
        "국자", "한자", "원자", "철자", "빈자", "주자", "학자", "현자", "후자", "역자", "임자", "승자", "인자",
        "수면", "수요", "수조", "수장", "수세", "수반", "근린", "도기", "도리", "임도",
        "강자", "교자", "도자", "동자", "수중", "수유", "수태", "수시", "수제",
    };

    [Fact]
    public void RequiredChar_AddedEverydayNouns_AreExcludedAndHaveFewerThanTenRealNames()
    {
        foreach (var w in AddedEverydayNouns)
        {
            // 독립 기준: 출생신고 통계에 10명 이상 실명이 있으면 이 목록에 넣지 않는다(실명 보호)
            Assert.True(NameGenderData.NameCounts(w, minTotal: 10) == null, $"{w}: 실명 10명 이상 — 생활어 목록 기준 위반");
            Assert.True(RequiredCharEngine.IsExcludedName("김", w), w);
        }
    }

    [Theory]
    [InlineData("상자")] // 11명
    [InlineData("진자")] // 14명
    [InlineData("수선")] // 10명
    [InlineData("유자")] // 15명
    public void RequiredChar_EverydayLookingRealNames_AreKept(string name)
    {
        // 전제: 실명 10명 이상 — 낱말과 겹쳐도 실제로 쓰는 이름이라 남긴다
        Assert.NotNull(NameGenderData.NameCounts(name, minTotal: 10));
        Assert.False(RequiredCharEngine.IsExcludedName("김", name), name);
    }

    [Theory]
    [InlineData("형수")] // 兄嫂 — 실명 44명이어도 친족 호칭으로 먼저 읽힌다
    [InlineData("이복")] // 異腹
    [InlineData("리복")] // 두음 적용형 → 이복
    [InlineData("이기")] // 利己
    [InlineData("리기")] // → 이기
    [InlineData("이명")] // 耳鳴
    [InlineData("리명")] // → 이명
    [InlineData("수번")] // 囚番
    [InlineData("이모")]
    [InlineData("고모")]
    public void RequiredChar_KinshipAndNegativeWords_AreExcludedRegardlessOfRealNames(string name)
    {
        Assert.True(RequiredCharEngine.IsExcludedName("김", name), name);
    }

    [Fact]
    public void RequiredChar_KinshipExclusion_IsNotARealNameCountRule()
    {
        // 형수는 실명 10명 이상인데도 거른다 — 친족·부정어 목록이 실명 수와 무관하다는 증거
        Assert.NotNull(NameGenderData.NameCounts("형수", minTotal: 10));
        Assert.True(RequiredCharEngine.IsExcludedName("이", "형수"));
    }

    public static IEnumerable<object[]> ReportedEverydayNounCases() => new[]
    {
        // 검토 재현 조건(a)~(d)·(f) — 상위 50에 있던 실명 0명 생활 명사·친족어
        new object[] { "이", "수", "any", "2020-10-10", "Male", "Neutral",
            new[] { "수면", "수요", "수조", "수장", "수세", "수반", "수번", "형수", "수중" } },
        new object[] { "최", "자", "last", "2021-05-05", "female", "neutral",
            new[] { "국자", "한자", "원자", "철자", "빈자", "주자", "학자", "현자", "후자", "역자", "임자", "승자", "인자",
                    "강자", "교자", "도자", "동자" } },
        new object[] { "이", "린", "any", "2020-03-15", "Female", "Soft", new[] { "근린" } },
        new object[] { "정", "도", "any", "2020-03-15", "Male", "Neutral", new[] { "임도", "도기", "도리" } },
        new object[] { "김", "리", "first", "2021-07-02", "Female", "Soft", new[] { "리기", "리복", "리명" } },
    };

    [Theory]
    [MemberData(nameof(ReportedEverydayNounCases))]
    public async Task RequiredChar_ReportedEverydayNouns_LeaveTop50(
        string lastName, string ch, string pos, string date, string gender, string tone, string[] reported)
    {
        var cands = await new RequiredCharEngine(_saju).GenerateCandidatesAsync(
            lastName, ch, pos, DateTime.Parse(date), gender, tone);
        var names = cands.Select(c => c.Name).ToHashSet();

        Assert.NotEmpty(cands);
        foreach (var bad in reported)
            Assert.DoesNotContain(bad, names);
    }

    // ── BE-F1(e) — 짝 글자가 첫 음절인 풀: 둘째 음절 풀(상위 80)의 최저 점수 아래 독음으로 채우지 않는다 ──

    private const string DueumReadings = "룡린련뇨례리려료류량";

    /// <summary>두음에 걸리지 않는 음절 126개 — 초성 ㄱ·ㄷ·ㅁ·ㅂ·ㅅ·ㅇ × 중성 21, 받침 없음.</summary>
    private static readonly char[] PlainReadings = new[] { 0, 3, 6, 7, 9, 11 }
        .SelectMany(initial => Enumerable.Range(0, 21).Select(vowel => (char)(0xAC00 + (initial * 21 + vowel) * 28)))
        .ToArray();

    /// <summary>점수 내림차순 합성 풀 — dueumAt 위치에는 두음 독음, 나머지는 평범한 독음.</summary>
    private static List<(HanjaData.HanjaInfo hanja, double score)> SyntheticRanking(
        int count, ISet<int> dueumAt, Func<int, double> scoreAt)
    {
        int d = 0, p = 0;
        return Enumerable.Range(0, count).Select(i =>
        {
            var reading = dueumAt.Contains(i) ? DueumReadings[d++].ToString() : PlainReadings[p++].ToString();
            return (new HanjaData.HanjaInfo { Character = "字", Reading = reading, Meaning = "글자" }, scoreAt(i));
        }).ToList();
    }

    [Fact]
    public void RequiredChar_LeadingPool_DoesNotBackfillBelowTrailingFloor()
    {
        // 상위 80 안에 두음 독음 10개(0·8·…·72위) — 예전 Take(80)은 81~90위로 빈자리를 채웠다
        var dueumAt = Enumerable.Range(0, 10).Select(k => k * 8).ToHashSet();
        var ranked = SyntheticRanking(100, dueumAt, i => 1000 - i);
        Assert.All(dueumAt, i => Assert.True(BreaksInitialDueum(ranked[i].hanja.Reading[0]))); // 전제(자모 기준)
        Assert.All(Enumerable.Range(0, 100).Except(dueumAt), i => Assert.False(BreaksInitialDueum(ranked[i].hanja.Reading[0])));

        var pool = RequiredCharEngine.BuildLeadingPool(ranked);

        // 기대값(손 계산): 0~79위 중 두음 10개를 뺀 70개 그대로, 80위 아래(점수 920 이하)는 하나도 없음
        var expected = Enumerable.Range(0, 80).Except(dueumAt).Select(i => ranked[i].hanja.Reading).ToList();
        Assert.Equal(expected, pool.Select(x => x.hanja.Reading).ToList());
        Assert.All(pool, x => Assert.True(x.score >= 921));
    }

    [Fact]
    public void RequiredChar_LeadingPool_KeepsReadingsTiedWithFloor_UpTo80()
    {
        // 75~95위가 80위와 같은 점수(500) — '80위 점수 이상'이라 동점은 받되 80개에서 자른다. 96위부터는 499 이하
        var dueumAt = Enumerable.Range(0, 10).Select(k => k * 8).ToHashSet();
        var ranked = SyntheticRanking(100, dueumAt, i => i < 75 ? 1000 - i : i <= 95 ? 500 : 499 - i);

        var pool = RequiredCharEngine.BuildLeadingPool(ranked);

        // 손 계산: 0~79위 비두음 70개 + 동점 80~89위 10개 = 80개, 마지막은 89위
        Assert.Equal(80, pool.Count);
        Assert.Equal(ranked[89].hanja.Reading, pool[^1].hanja.Reading);
        Assert.All(pool, x => Assert.True(x.score >= 500));
        Assert.DoesNotContain(pool, x => DueumReadings.Contains(x.hanja.Reading[0]));
    }

    [Fact]
    public void RequiredChar_LeadingPool_SmallOrEmptyRanking()
    {
        var dueumAt = new HashSet<int> { 1, 4, 9, 15, 22 };
        var ranked = SyntheticRanking(30, dueumAt, i => 300 - i);

        Assert.Equal(25, RequiredCharEngine.BuildLeadingPool(ranked).Count); // 80개 미만이면 하한 = 꼴찌 → 비두음 전부
        Assert.Empty(RequiredCharEngine.BuildLeadingPool(new List<(HanjaData.HanjaInfo hanja, double score)>()));
    }

    [Theory]
    [InlineData("김", "2021-05-05", "female", "neutral")] // 하한이 실제로 81위 아래를 자르는 조건(동점 없음)
    [InlineData("이", "2020-10-10", "Male", "Neutral")]
    [InlineData("남궁", "2022-01-10", "Female", "Soft")]
    public async Task RequiredChar_LastPosition_StillReturnsEnoughCandidates(
        string lastName, string date, string gender, string tone)
    {
        // 위치=끝은 이 풀만 쓴다 — 하한·생활어 보강 뒤에도 한 화면(40개 이상)은 남아야 한다 (자는 실측 44)
        var engine = new RequiredCharEngine(_saju);
        foreach (var ch in new[] { "수", "자", "도", "민", "서", "린", "준", "지" })
        {
            var cands = await engine.GenerateCandidatesAsync(lastName, ch, "last", DateTime.Parse(date), gender, tone);
            Assert.True(cands.Count >= 40, $"{lastName}·{ch}·끝: {cands.Count}개");
            Assert.All(cands, c => Assert.Equal("last", c.Position));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EV-1 — 종합 점수 줄 = FinalScore
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("민준", "김", "male", "neutral")]
    [InlineData("민", "남궁", "none", "neutral")]
    [InlineData("서연", "이", "female", "soft")]
    public async Task Evaluate_NoBirthDate_SummaryUsesFinalScoreAndMarksHarmonyUnscored(
        string name, string lastName, string gender, string tone)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(name, lastName, null, gender, tone);

        Assert.Equal(r.AestheticScore, r.FinalScore); // 출생일 없음 → 미학 100% (ScoringService 계약)
        Assert.StartsWith($"종합 {r.FinalScore}점 — 미학 {r.AestheticScore} (조화 미산정)", r.Summary);
        Assert.DoesNotContain("조화 0", r.Summary);
        Assert.All(r.Strengths.Where(s => s.EndsWith("기본기 갖춤")),
            s => Assert.Equal($"종합 {r.FinalScore}점 — 기본기 갖춤", s));
    }

    [Theory]
    [InlineData("민", "남궁", "2022-01-10", "none", "neutral")]
    [InlineData("서연", "이", "2021-07-02", "female", "soft")]
    [InlineData("민준", "김", "2020-03-15", "male", "neutral")]
    public async Task Evaluate_WithBirthDate_OverallLinesMatchFinalScore(
        string name, string lastName, string date, string gender, string tone)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(name, lastName, DateTime.Parse(date), gender, tone);

        Assert.StartsWith($"종합 {r.FinalScore}점 — 미학 {r.AestheticScore} · 조화 {r.HarmonyScore}", r.Summary);
        Assert.All(r.Strengths.Where(s => s.EndsWith("기본기 갖춤")),
            s => Assert.Equal($"종합 {r.FinalScore}점 — 기본기 갖춤", s));
    }

    [Fact]
    public async Task Explanation_BasicsLine_RoundsLikeScoringService()
    {
        // 77*0.7 + 69*0.3 = 74.6 — 버림이면 74, ScoringService(Math.Round)는 75 (감사: 남궁민 75 vs '종합 74점')
        // 1음절·성씨 없음·희귀도 낮음 → 다른 강점이 없어 '기본기 갖춤' 줄이 반드시 나온다
        var result = await new ExplanationEngine().GenerateDetailedReasonsAsync("민", null, 77, 69, 10, "none", "neutral");

        Assert.StartsWith("종합 75점", result.Summary);
        Assert.Contains("종합 75점 — 기본기 갖춤", result.Strengths);
    }

    [Fact]
    public void Explanation_AlignOverall_RewritesSummaryAndBasicsLine()
    {
        var result = new ExplanationResult
        {
            Summary = "종합 48점 — 미학 68 · 조화 0",
            Strengths = new List<string> { "독창성 90점 — 흔치 않은 조합", "종합 48점 — 기본기 갖춤" }
        };

        ExplanationEngine.AlignOverall(result, finalScore: 68, aestheticScore: 68, harmonyScore: 0,
            harmonyProvided: false, tone: "Soft");

        Assert.Equal("종합 68점 — 미학 68 (조화 미산정) · 부드러운 톤", result.Summary);
        Assert.Equal(new[] { "독창성 90점 — 흔치 않은 조합", "종합 68점 — 기본기 갖춤" }, result.Strengths);
    }

    // ── BT-4·FT-1 — /name-analysis 종합 줄 = FinalScore, 출생일 없으면 '조화 미산정', 폴백 한자는 '한자 예' ──

    private NameAnalysisService CreateAnalysisService() => new(
        new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine()),
        new AestheticEngine(),
        new RarityScoringEngine(),
        new ExplanationEngine(),
        new NameReversalEngine(),
        _saju,
        _yongshin,
        Microsoft.Extensions.Logging.Abstractions.NullLogger<NameAnalysisService>.Instance);

    [Theory]
    [InlineData("김", "민준", "male", "neutral")]  // 감사: finalScore 63인데 '종합 59점 — 미학 63 · 조화 50'
    [InlineData("김", "하늘", "none", "neutral")]  // 감사: finalScore 75인데 '종합 68점 — 미학 75 · 조화 50'
    [InlineData("남궁", "민", "female", "soft")]
    public async Task Analysis_NoBirthDate_OverallReasonUsesFinalScoreAndMarksHarmonyUnscored(
        string lastName, string firstName, string gender, string tone)
    {
        var r = await CreateAnalysisService().AnalyzeNameAsync(new NameAnalysisRequestDto
        {
            LastName = lastName, FirstName = firstName, Gender = gender, Tone = tone
        });

        Assert.Null(r.HarmonyScore);
        Assert.Equal(r.AestheticScore, r.FinalScore);
        Assert.Equal($"종합 {r.FinalScore}점 — 미학 {r.AestheticScore} (조화 미산정)", r.Reasons[0]);
        Assert.DoesNotContain(r.Reasons, s => Regex.IsMatch(s, @"조화 \d"));
        // 분석 경로는 배정 한자가 없다 — 음절별 1순위 후보를 이 이름의 한자로 단정하지 않는다
        Assert.DoesNotContain(r.Reasons, s => s.StartsWith("한자 뜻 —"));
    }

    [Theory]
    [InlineData("김", "민준", "2018-12-25", "male", "neutral")]
    [InlineData("김", "하늘", "2022-05-05", "none", "neutral")]
    public async Task Analysis_WithBirthDate_OverallReasonMatchesFinalScore(
        string lastName, string firstName, string date, string gender, string tone)
    {
        var r = await CreateAnalysisService().AnalyzeNameAsync(new NameAnalysisRequestDto
        {
            LastName = lastName, FirstName = firstName, BirthDate = date, Gender = gender, Tone = tone
        });

        Assert.NotNull(r.HarmonyScore);
        Assert.Equal($"종합 {r.FinalScore}점 — 미학 {r.AestheticScore} · 조화 {r.HarmonyScore}", r.Reasons[0]);
        Assert.DoesNotContain(r.Reasons, s => s.StartsWith("한자 뜻 —"));
    }

    [Fact]
    public async Task Explanation_Reasons_LabelHanjaLineByWhetherItWasAssigned()
    {
        var engine = new ExplanationEngine();
        var assigned = new[] { HanjaData.FindByCharacter("瑞"), HanjaData.FindByCharacter("硏") };
        Assert.All(assigned, h => Assert.NotNull(h));

        var withAssigned = await engine.GenerateReasonsAsync("서연", 80, 70, assigned);
        var withoutAssigned = await engine.GenerateReasonsAsync("서연", 80, 70);

        Assert.Contains(withAssigned, s => s.StartsWith("한자 뜻 — 瑞(서,"));
        Assert.DoesNotContain(withAssigned, s => s.StartsWith("한자 예 —"));
        Assert.Contains(withoutAssigned, s => s.StartsWith("한자 예 — "));
        Assert.DoesNotContain(withoutAssigned, s => s.StartsWith("한자 뜻 —"));
    }

    [Theory]
    [InlineData(63, 63, null, "종합 63점 — 미학 63 (조화 미산정)")]
    [InlineData(75, 77, 69, "종합 75점 — 미학 77 · 조화 69")]
    public void Explanation_AlignOverallReason_RewritesOnlyOverallLine(int final, int aesthetic, int? harmony, string expected)
    {
        var reasons = new List<string> { "종합 59점 — 미학 63 · 조화 50", "발음 63점 — 받침 2개" };

        ExplanationEngine.AlignOverallReason(reasons, final, aesthetic, harmony);

        Assert.Equal(new[] { expected, "발음 63점 — 받침 2개" }, reasons);
    }

    // ═══════════════════════════════════════════════════════════════
    // EV-3 — 강점·의미 메모·한자 후보 표가 같은 배정 한자
    // ═══════════════════════════════════════════════════════════════

    public static IEnumerable<object?[]> EvaluateCases() => new[]
    {
        new object?[] { "서연", "이", "2021-07-02", "female", "soft" },   // 감사: 강점 書+蓮 vs 메모 瑞+硏
        new object?[] { "아름", "최", "2021-07-02", "female", "soft" },   // 감사: 름 표에 懍(불용)
        new object?[] { "치우", "김", "2021-07-02", "male", "strong" },   // 치 표에 恥(불용)
        new object?[] { "민준", "김", null, "male", "neutral" },          // 출생일 없음 → 용신 없는 선택기
    };

    [Theory]
    [MemberData(nameof(EvaluateCases))]
    public async Task Evaluate_MeaningStrength_UsesSameHanjaAsMeaningNote(
        string name, string lastName, string? date, string gender, string tone)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(
            name, lastName, date == null ? null : DateTime.Parse(date), gender, tone);

        Assert.All(r.Strengths.Where(StartsWithHan), s => Assert.Equal(r.MeaningNote, s));
    }

    // ── BT-6 — 이름 뜻으로 약하거나 인명 빈출이 아닌 배정 한자는 '강점'에 올리지 않는다 ──

    [Theory]
    [InlineData("아름", "최", "2021-07-02", "female", "soft", "菻")]    // 감사: 강점이 雅+菻(쑥 림) — 菻은 weak
    [InlineData("영자", "박", "2023-01-01", "female", "neutral", "雌")] // 감사: 강점이 映+雌(암컷 자) — 雌은 weak 미등재
    public async Task Evaluate_MeaningStrength_SkipsWeakOrUncommonAssignedHanja(
        string name, string lastName, string date, string gender, string tone, string reported)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(name, lastName, DateTime.Parse(date), gender, tone);

        Assert.DoesNotContain(r.Strengths, s => s.Contains(reported));
        // 독립 기준: 강점에 오른 한자 줄의 글자는 모두 인명 빈출(CommonNameHanja)이고 약한 글자가 아니다
        foreach (var s in r.Strengths.Where(StartsWithHan))
            foreach (var ch in s.Split(" — ")[0].Split(" + ").Select(OptionChar))
                Assert.True(HanjaData.IsCommonNameHanja(ch) && !HanjaData.IsWeakGivenNameHanja(ch), $"{name}: 강점 한자 {ch}");
        Assert.NotEmpty(r.Strengths); // 의미 줄이 빠져도 '기본기 갖춤' 등으로 채워진다
    }

    [Fact]
    public async Task Explanation_MeaningStrength_RequiresCommonNonWeakHanja()
    {
        var engine = new ExplanationEngine();
        var weakPick = new[] { HanjaData.FindByCharacter("雅"), HanjaData.FindByCharacter("菻") };
        var goodPick = new[] { HanjaData.FindByCharacter("瑞"), HanjaData.FindByCharacter("硏") };
        Assert.All(weakPick.Concat(goodPick), h => Assert.NotNull(h));
        // 전제(사례표): 菻은 weak, 瑞·硏은 인명 빈출이고 weak 아님
        Assert.True(HanjaData.IsWeakGivenNameHanja("菻"));
        Assert.True(goodPick.All(h => HanjaData.IsCommonNameHanja(h!.Character) && !HanjaData.IsWeakGivenNameHanja(h.Character)));

        var weak = await engine.GenerateDetailedReasonsAsync("아름", "최", 85, 80, 60, "female", "soft", null, weakPick);
        var good = await engine.GenerateDetailedReasonsAsync("서연", "최", 85, 80, 60, "female", "soft", null, goodPick);

        Assert.Contains("菻", weak.MeaningNote);                  // 메모에는 남고
        Assert.DoesNotContain(weak.Strengths, s => s.Contains("菻")); // 강점에는 오르지 않는다
        Assert.Contains(good.MeaningNote, good.Strengths);        // 빈출·비약자 배정은 그대로 강점
    }

    [Theory]
    [MemberData(nameof(EvaluateCases))]
    public async Task Evaluate_HanjaCandidates_NoForbidden_AssignedFirst_WeakLast(
        string name, string lastName, string? date, string gender, string tone)
    {
        var r = await CreateEvaluationService().EvaluateNameAsync(
            name, lastName, date == null ? null : DateTime.Parse(date), gender, tone);

        // 의미 메모 "瑞(서, 상서 서) + 硏(연, 갈 연) — …" → 음절별 배정 한자
        var assigned = r.MeaningNote.Split(" — ")[0].Split(" + ").Select(OptionChar).ToList();
        Assert.Equal(name.Length, assigned.Count);

        for (int i = 0; i < r.HanjaCandidates.Count; i++)
        {
            var chars = r.HanjaCandidates[i].Candidates.Select(c => c.Character).ToList();
            Assert.NotEmpty(chars);
            Assert.DoesNotContain(chars, HanjaData.IsForbiddenNameHanja);
            Assert.Equal(assigned[i], chars[0]);

            // 배정 한자 뒤로는 약하지 않은 글자가 약한 글자보다 먼저
            var rest = chars.Skip(1).Select(HanjaData.IsWeakGivenNameHanja).ToList();
            Assert.True(rest.SkipWhile(w => !w).All(w => w),
                $"{r.HanjaCandidates[i].Syllable}: 약한 한자가 대안보다 앞섬 — {string.Join(" ", chars)}");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EV-4 — 81수리 문구 (점수 불변)
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("민준", "김", "2020-03-15", "male")]   // 감사: 원10(대흉)·이19(대흉)
    [InlineData("하늘", "제갈", "2022-05-05", "none")] // 감사: 순우리말에 자동 배정 荷+乻 획수로 '대흉' 4개
    public async Task Harmony_SuriNote_IsReferenceWordingWithAutoAssignHint(
        string name, string lastName, string date, string gender)
    {
        var b = await new HarmonyEngine(_saju, _yongshin)
            .CalculateScoreWithBreakdownAsync(name, lastName, DateTime.Parse(date), gender);

        Assert.DoesNotContain(b.Notes, n => n.Contains("대흉") || n.Contains("대길") || n.Contains("소흉") || n.Contains("중길"));
        Assert.Contains(b.Notes, n => n.StartsWith("수리사격(전통 81수리, 참고): 원격 "));
        // BT-3: 성씨 획수도 추정이라는 사실을 함께 밝히고, 한자를 고르는 입력이 없으니 '정하면' 대신 '다르면'
        Assert.Contains(SuriBasisNote, b.Notes);
        Assert.DoesNotContain(b.Notes, n => n.Contains("한자를 정하면") || n.Contains("이름 음절에 자동 배정한 한자("));
    }

    private const string SuriBasisNote =
        "획수는 성씨와 이름 음절에 자동으로 고른 한자 기준이에요(성씨 한자도 추정이에요). 실제 한자가 다르면 수리가 달라질 수 있어요.";

    [Theory]
    [InlineData("서연", "이", "2021-07-02", "female")] // 감사 역산: 성씨 이 → 11획(李는 7획) — 성씨도 추정임을 밝혀야 하는 사례
    [InlineData("민", "남궁", "2022-01-10", "none")]  // 복성은 첫 글자 독음으로만 추정(楠 13획)
    public async Task Harmony_SuriNote_AdmitsSurnameStrokesAreEstimated(
        string name, string lastName, string date, string gender)
    {
        var b = await new HarmonyEngine(_saju, _yongshin)
            .CalculateScoreWithBreakdownAsync(name, lastName, DateTime.Parse(date), gender);

        var suri = b.Notes.FirstOrDefault(n => n.StartsWith("수리사격(전통 81수리"));
        Assert.NotNull(suri); // 이 사례들은 획수가 있어 수리가 계산된다 — 안내 줄이 함께 나와야 함
        Assert.Contains(SuriBasisNote, b.Notes);
    }

    // ═══════════════════════════════════════════════════════════════
    // EV-5 — 같은 오행이 가점·감점에 함께 나올 때 문구 (점수 불변)
    // ═══════════════════════════════════════════════════════════════

    // FakeSaju: 木3 火1 土1 金1 水0 → 과다 木, 부족 火·土·金·水
    private static HarmonyEngine CreateFakeHarmony() => new(
        new FakeSajuCalculationService(),
        new FakeYongshinCalculationService { PrimaryYongshin = "木", Heeshin = "水", Gishin = "金" });

    [Fact]
    public async Task Harmony_YongshinAlsoExcessive_NoteReadsAsPartialOffset()
    {
        // 東(木)+建(木): 용신 木 +30, 과다 木 −10 → 50+30−10 = 70 → 30점 환산 21
        var b = await CreateFakeHarmony().CalculateScoreWithBreakdownAsync("동건", "김", new DateTime(2024, 6, 15), "none");

        Assert.Contains("용신 '木' 보완", b.Notes);
        Assert.Contains("용신 '木' — 사주에 이미 많은 오행이라 가점 일부 상쇄 (감점)", b.Notes);
        Assert.DoesNotContain("과다한 오행 '木' 증가 (감점)", b.Notes);
        Assert.Equal(21, b.FiveElementScore);
    }

    [Fact]
    public async Task Harmony_GishinAlsoLacking_NoteReadsAsPartialOffset()
    {
        // 東(木)+玲(金): 50 +30(용신 木) −25(기신 金) +10(부족 金) −10(과다 木) +10(오행 2종) = 65 → 19
        var b = await CreateFakeHarmony().CalculateScoreWithBreakdownAsync("동령", "김", new DateTime(2024, 6, 15), "none");

        Assert.Contains("기신 '金' 충돌 (감점)", b.Notes);
        Assert.Contains("기신 '金' — 사주에 부족한 오행이라 감점 일부 상쇄", b.Notes);
        Assert.DoesNotContain("부족한 오행 '金' 보완", b.Notes);
        Assert.Equal(19, b.FiveElementScore);
    }

    // ═══════════════════════════════════════════════════════════════
    // UX-3 — 영문 코드·조사
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("서연", "이", "soft", "female", "한자 성별 선호도가 여자 이름과 잘 맞음")]
    [InlineData("민준", "김", "strong", "male", "한자 성별 선호도가 남자 이름과 잘 맞음")]
    public async Task Aesthetic_Notes_HaveNoEnglishCodes(string name, string lastName, string tone, string gender, string genderNote)
    {
        var b = await new AestheticEngine().CalculateScoreWithBreakdownAsync(name, lastName, tone, gender);

        Assert.DoesNotContain(b.Notes, n => Regex.IsMatch(n, "[A-Za-z]"));
        // /name 점수 데이터(dump-name-scores의 공개용 치환 결과)와 같은 문장 — 재생성해도 정적 데이터 불변
        Assert.Contains(genderNote, b.Notes);
    }

    [Theory]
    [InlineData("이")]
    [InlineData("오")]
    [InlineData("조")]
    [InlineData("김")]
    [InlineData("박")]
    public async Task Creative_SurnameConnection_ParticleFollowsBatchim(string lastName)
    {
        var cands = await new CreativeNamingEngine().GenerateCandidatesAsync(lastName, "none", "neutral", 40);
        var wrong = $"'{lastName}'{(KoreanUtils.GwaWa(lastName) == "과" ? "와" : "과")} ";

        Assert.NotEmpty(cands);
        Assert.DoesNotContain(cands, c => c.SurnameConnection.Contains(wrong));
    }

    [Fact]
    public void Yongshin_Reasons_ParticleFollowsHeadWord()
    {
        // 괄호 하나 뒤('목(木)가')와 괄호 둘 뒤('수(水)(인성)을') 모두 — BT-8: 둘째 꼴을 옛 정규식이 놓쳤다
        var bad = new Regex(@"\((木|金)\)(\((관살|인성)\))?(가|를) |\((火|土|水)\)(\((관살|인성)\))?(이|을) ");
        var start = new DateTime(2000, 1, 1);
        for (int k = 0; k < 3000; k += 7)
        {
            var chart = _saju.CalculateChart(start.AddDays(k));
            var y = _yongshin.Calculate(chart);
            var stem = SajuData.Stems.First(s => s.Char == chart.DayMaster);

            foreach (var text in new[] { y.StrengthDescription, y.YongshinReason })
                Assert.False(bad.IsMatch(text), text);
            // 일간 조사는 천간 독음 기준 — 甲(목(木))이 / 戊(토(土))가
            Assert.Matches($@"^일간 {stem.Char}\(.\(.\)\){KoreanUtils.IGa(stem.Name)} ", y.StrengthDescription);
        }
    }

    [Fact]
    public void Yongshin_EokbuReason_ParticleMatchesBatchimTable()
    {
        // 독립 기준: 오행 독음의 받침 — 목·금은 받침 있음 → '을', 화·토·수는 받침 없음 → '를'
        var expected = new Dictionary<string, string> { ["목"] = "을", ["금"] = "을", ["화"] = "를", ["토"] = "를", ["수"] = "를" };
        var phrase = new Regex(@"(목|화|토|금|수)\((.)\)\((관살|인성)\)(\S) 억부 용신");
        var seen = new HashSet<string>();
        var start = new DateTime(2000, 1, 1);
        for (int k = 0; k < 3000; k += 7)
        {
            var y = _yongshin.Calculate(_saju.CalculateChart(start.AddDays(k)));
            var m = phrase.Match(y.YongshinReason);
            if (!m.Success) continue; // 중화(조후 우선)는 억부 문장이 없다
            Assert.Equal(expected[m.Groups[1].Value], m.Groups[4].Value);
            seen.Add(m.Groups[4].Value);
        }
        // '를'로 끝나는 억부 문장(화·토·수)이 실제로 나와야 이 검사가 BT-8 회귀를 덮는다
        Assert.Contains("를", seen);
        Assert.Contains("을", seen);
    }

    [Theory]
    [InlineData("목(木)", "목")]
    [InlineData("신강(身强)", "신강")]
    [InlineData("서연", "서연")]
    [InlineData("(관살)", "(관살)")]
    [InlineData("", "")]
    public void KoreanUtils_JosaBase_StripsParenthetical(string word, string expected)
    {
        Assert.Equal(expected, KoreanUtils.JosaBase(word));
    }

    [Fact]
    public void KoreanUtils_JosaBase_FixesParticleAfterParenthesis()
    {
        Assert.Equal("이", KoreanUtils.IGa(KoreanUtils.JosaBase("목(木)")));
        Assert.Equal("가", KoreanUtils.IGa(KoreanUtils.JosaBase("화(火)")));
        Assert.Equal("을", KoreanUtils.EulReul(KoreanUtils.JosaBase("금(金)")));
        Assert.Equal("를", KoreanUtils.EulReul(KoreanUtils.JosaBase("수(水)")));
    }

    // ═══════════════════════════════════════════════════════════════
    // FT-2 — 스마트 추천의 쌍둥이 탭: 실제 미학·조화 점수 + 짝 태그 (세트 유지)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task Smart_TwinCategory_CarriesScoresAndPartnerTags()
    {
        var scoring = new ScoringService(new AestheticEngine(), new HarmonyEngine(_saju, _yongshin), new RarityScoringEngine());
        var pool = new NamePoolEngine(_saju);
        var parent = new ParentBasedNamingEngine(pool, new NameReversalEngine());
        var twinService = new TwinNameService(new TwinNameEngine(_saju), scoring, new ExplanationEngine(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<TwinNameService>.Instance);
        var smart = new SmartRecommendationService(
            new RecommendationService(new NameForm.Infrastructure.Repositories.InMemoryRecommendationRepository(),
                pool, scoring, new RankerEngine(), new ExplanationEngine(), parent, new DualNameEngine(),
                Microsoft.Extensions.Logging.Abstractions.NullLogger<RecommendationService>.Instance),
            new PureKoreanNameEngine(), new CreativeNamingEngine(), new ThreeSyllableEngine(), new RareSurnameEngine(),
            parent, twinService, new RequiredCharEngine(_saju), new DualNameEngine());

        // 감사 재현 조건(이·여·2021-07-02·soft)
        var request = new SmartRecommendationRequestDto
        {
            LastName = "이", BirthDate = "2021-07-02", Gender = "female", Tone = "soft", IsTwin = true,
            IncludePureKorean = false, IncludeThreeSyllable = false, IncludeCreative = false
        };
        var result = await smart.GenerateSmartRecommendationsAsync(request);
        var twin = result.Categories.Single(c => c.Type == "twin");

        // 같은 요청의 /twin-names 세트 — 세트를 평탄화한 수 그대로(이름 기준 중복 제거로 짝을 지우지 않음)
        var sets = (await twinService.GenerateTwinNamesAsync(new TwinNameRequestDto
        {
            LastName = "이", BirthDate = "2021-07-02", Gender = "female", Tone = "soft", ChildCount = 2
        })).NameSets;
        Assert.Equal(sets.Sum(s => s.Names.Count), twin.Names.Count);

        var names = twin.Names.Select(n => n.Name).ToHashSet();
        foreach (var c in twin.Names)
        {
            Assert.NotNull(c.AestheticScore);
            Assert.NotNull(c.HarmonyScore);
            // 한 카드 안의 숫자가 같아야 한다 — 이유 첫 줄의 미학·조화 = 카드 점수
            Assert.StartsWith($"종합 {c.Score}점 — 미학 {c.AestheticScore} · 조화 {c.HarmonyScore}", c.Reasons[0]);

            var partnerTag = Assert.Single(c.Tags, t => t.StartsWith("짝: "));
            var partners = partnerTag["짝: ".Length..].Split('·');
            Assert.DoesNotContain(c.Name, partners);
            Assert.All(partners, p => Assert.Contains(p, names));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // BE-F3 — 오류 문구에 영문 필드명을 섞지 않는다 (2026-10-21 최종 검토, FE-EVAL-7 백엔드 몫)
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// 화면에 그대로 뜰 수 있는 한국어 문장인가 — 한글이 있고, 영문 소문자가 남지 않는다
    /// (LastName·eventType·Invalid 같은 식별자·영문 문장은 소문자를 품는다). 'male' 같은 허용값 목록과
    /// 보간 구멍·날짜 형식 표기(YYYY-MM-DD·HH:mm)는 API 값이라 제외하고, ID 같은 대문자 약어는 허용.
    /// </summary>
    private static bool IsKoreanOnlyMessage(string message)
    {
        var rest = Regex.Replace(message, @"'[^']*'", "");
        rest = Regex.Replace(rest, @"\{[^{}]*\}", "");
        foreach (var token in new[] { "YYYY-MM-DD", "HH:mm:ss", "HH:mm" })
            rest = rest.Replace(token, "");
        return Regex.IsMatch(message, "[가-힣]") && !Regex.IsMatch(rest, "[a-z]");
    }

    /// <summary>저장소 루트 — 테스트 출력 경로가 저장소 밖이어도 찾도록 이 소스 파일 위치에서 시작한다.</summary>
    private static string RepoRoot([CallerFilePath] string thisFile = "")
    {
        foreach (var start in new[] { Path.GetDirectoryName(thisFile), AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            for (var dir = string.IsNullOrEmpty(start) ? null : new DirectoryInfo(start); dir != null; dir = dir.Parent)
                if (File.Exists(Path.Combine(dir.FullName, "NameForm.csproj"))) return dir.FullName;
        }
        throw new InvalidOperationException("저장소 루트(NameForm.csproj)를 찾지 못함");
    }

    // 문자열 리터럴 본문 — 보간 문자열은 구멍({string.Join(", ", …)}) 안의 따옴표를 건너뛴다
    private const string LiteralBody = @"(?:\$""(?<m>(?:[^""{\\]|\\.|\{[^{}]*\})*)""|""(?<m>(?:[^""\\]|\\.)*)"")";

    private static List<(string file, string message)> ExtractMessages(string relativeGlobDir, string pattern, string filePattern = "*.cs")
    {
        var dir = Path.Combine(RepoRoot(), relativeGlobDir);
        return Directory.GetFiles(dir, filePattern)
            .SelectMany(f => Regex.Matches(File.ReadAllText(f), pattern)
                .Select(m => (Path.GetFileName(f), m.Groups["m"].Value)))
            .ToList();
    }

    [Fact]
    public void ErrorMessages_InSource_AreKoreanOnly()
    {
        var controller = ExtractMessages(Path.Combine("Api", "Controllers"), @"\berror\s*=\s*" + LiteralBody);
        var dtoAttributes = ExtractMessages(Path.Combine("Application", "DTOs"), @"\bErrorMessage\s*=\s*" + LiteralBody);
        var controllerAttributes = ExtractMessages(Path.Combine("Api", "Controllers"), @"\bErrorMessage\s*=\s*" + LiteralBody);
        var service = ExtractMessages(Path.Combine("Application", "Services"), @"throw new \w*Exception\(\s*" + LiteralBody,
            "RecommendationService.cs");

        // 정규식이 비어 버리면 검사가 무의미해진다 — 실제 개수(컨트롤러 90여 개·DTO 40여 개) 근처여야 한다
        Assert.True(controller.Count >= 80, $"컨트롤러 오류 문구 {controller.Count}개만 추출됨");
        Assert.True(dtoAttributes.Count >= 40, $"DTO ErrorMessage {dtoAttributes.Count}개만 추출됨");
        Assert.NotEmpty(service);

        var bad = controller.Concat(dtoAttributes).Concat(controllerAttributes).Concat(service)
            .Where(x => !IsKoreanOnlyMessage(x.message))
            .Select(x => $"{x.file}: {x.message}")
            .ToList();
        Assert.True(bad.Count == 0, "영문이 섞인 오류 문구:\n" + string.Join("\n", bad));
    }

    [Theory]
    [InlineData("성씨는 필수입니다.", true)]
    [InlineData("생년월일은 YYYY-MM-DD 형식이어야 합니다. (예: 2024-01-15)", true)]
    [InlineData("성별은 'male', 'female', 'none' 중 하나여야 합니다.", true)]
    [InlineData("추천 ID는 필수입니다.", true)]
    [InlineData("성(LastName)은 필수입니다.", false)]
    [InlineData("BirthDate 형식이 올바르지 않습니다. (YYYY-MM-DD)", false)]
    [InlineData("eventType은 'tab_view'만 허용됩니다.", false)]
    [InlineData("Invalid birth date format", false)]
    [InlineData("The LastName field is required.", false)]
    public void ErrorMessages_KoreanOnlyRule_CaseTable(string message, bool expected)
    {
        Assert.Equal(expected, IsKoreanOnlyMessage(message));
    }

    [Fact]
    public void Dtos_EveryValidationAttribute_HasKoreanMessage()
    {
        // 메시지 없는 특성은 'The field Name must be a string with…' 영문 기본 문구를 내고,
        // 프론트(api.ts readable)는 한글 없는 문구를 일반 안내로 바꿔 어느 칸이 틀렸는지 잃는다
        var attributes = typeof(NameEvaluateRequestDto).Assembly.GetTypes()
            .Where(t => t.Namespace == "NameForm.Application.DTOs")
            .SelectMany(t => t.GetProperties().Select(p => (type: t, prop: p)))
            .SelectMany(x => x.prop.GetCustomAttributes(typeof(System.ComponentModel.DataAnnotations.ValidationAttribute), true)
                .Cast<System.ComponentModel.DataAnnotations.ValidationAttribute>()
                .Select(a => (where: $"{x.type.Name}.{x.prop.Name} [{a.GetType().Name}]", message: a.ErrorMessage)))
            .ToList();

        Assert.True(attributes.Count >= 40, $"검증 특성 {attributes.Count}개만 찾음");
        var bad = attributes.Where(a => a.message == null || !IsKoreanOnlyMessage(a.message)).Select(a => a.where).ToList();
        Assert.True(bad.Count == 0, "한국어 ErrorMessage가 없는 검증 특성:\n" + string.Join("\n", bad));
    }

    private static List<string> ValidationMessages(object dto)
    {
        var results = new List<System.ComponentModel.DataAnnotations.ValidationResult>();
        System.ComponentModel.DataAnnotations.Validator.TryValidateObject(
            dto, new System.ComponentModel.DataAnnotations.ValidationContext(dto), results, validateAllProperties: true);
        return results.Select(r => r.ErrorMessage ?? "").ToList();
    }

    [Fact]
    public void Dtos_ValidationFailures_ReadInKorean()
    {
        // 검토 재현: /evaluate 11자 이름 → 'The field Name must be a string with a minimum length of 1 and a maximum length of 10.'
        Assert.Equal(new[] { "이름은 1~10자여야 합니다." },
            ValidationMessages(new NameEvaluateRequestDto { Name = "가나다라마바사아자차카", LastName = "김" }));
        // 검토 재현: /name-analysis·/twin-names 빈 성 → 'The LastName field is required.'
        Assert.Contains("성씨는 필수입니다.", ValidationMessages(new NameAnalysisRequestDto { LastName = "", FirstName = "하늘" }));
        Assert.Contains("성씨는 필수입니다.", ValidationMessages(new TwinNameRequestDto { LastName = "" }));
        Assert.Equal(new[] { "필수 글자는 한 글자여야 합니다." },
            ValidationMessages(new RequiredCharRequest { LastName = "김", RequiredChar = "준서", BirthDate = "2021-05-05" }));
        Assert.Equal(new[] { "생년월일은 YYYY-MM-DD 형식이어야 합니다." },
            ValidationMessages(new CreateRecommendationRequestDto { LastName = "김", BirthDate = "2021-05-05T00" }));
    }

    private static string ErrorOf<T>(ActionResult<T> result)
    {
        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        var value = bad.Value!;
        return (string)value.GetType().GetProperty("error")!.GetValue(value)!;
    }

    [Fact]
    public async Task Controllers_ValidationErrors_UseKoreanFieldNames()
    {
        // 검증에서 바로 돌려주는 경로라 서비스·엔진은 쓰이지 않는다(null)
        var analysis = new NameAnalysisController(null!, NullLogger<NameAnalysisController>.Instance, null!);
        // 검토 재현: 'BirthDate 형식이 올바르지 않습니다. (YYYY-MM-DD)'
        Assert.Equal("생년월일은 YYYY-MM-DD 형식이어야 합니다. (예: 2024-01-15)", ErrorOf(await analysis.AnalyzeName(
            new NameAnalysisRequestDto { LastName = "김", FirstName = "하늘", BirthDate = "2021-13-45" })));
        Assert.Equal("성씨는 필수입니다.", ErrorOf(await analysis.AnalyzeName(
            new NameAnalysisRequestDto { LastName = " ", FirstName = "하늘" })));
        Assert.Equal("이름은 필수입니다.", ErrorOf(await analysis.AnalyzeName(
            new NameAnalysisRequestDto { LastName = "김", FirstName = " " })));

        var recommendations = new RecommendationsController(null!, null!, NullLogger<RecommendationsController>.Instance,
            null!, null!, null!, null!, null!, null!, null!, null!, null!, null!);
        // 검토 재현: '필수 글자(RequiredChar) 또는 항렬자(RequiredHanja) 중 하나는 필수입니다.'
        Assert.Equal("필수 글자 또는 항렬자 중 하나는 입력해야 합니다.", ErrorOf(await recommendations.GenerateRequiredCharNames(
            new RequiredCharRequest { LastName = "김", BirthDate = "2021-05-05" })));
        Assert.Equal("성씨는 필수입니다.", ErrorOf(await recommendations.GenerateRequiredCharNames(
            new RequiredCharRequest { LastName = " ", RequiredChar = "준" })));
        Assert.Equal("생년월일은 필수입니다.", ErrorOf(await recommendations.GenerateSmartRecommendations(
            new SmartRecommendationRequestDto { LastName = "김", BirthDate = " " })));

        var twin = new TwinNameController(null!, NullLogger<TwinNameController>.Instance, null!);
        Assert.Equal("성씨는 필수입니다.", ErrorOf(await twin.GenerateTwinNames(new TwinNameRequestDto { LastName = " " })));
        Assert.Equal("생년월일은 필수이며 YYYY-MM-DD 형식이어야 합니다.", ErrorOf(await twin.GenerateTwinNames(
            new TwinNameRequestDto { LastName = "이", BirthDate = "2021-13-45" })));
    }

    [Fact]
    public async Task RecommendationService_BadBirthDate_ThrowsKoreanMessage()
    {
        // 컨트롤러가 먼저 막아 실사용에선 닿지 않지만, 서비스 단독 호출 시에도 한국어 문구
        var service = new RecommendationService(null!, null!, null!, null!, null!, null!, null!,
            NullLogger<RecommendationService>.Instance);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.CreateRecommendationAsync(new CreateRecommendationRequestDto { LastName = "김", BirthDate = "2021-13-45" }));
        Assert.Equal("생년월일은 YYYY-MM-DD 형식이어야 합니다.", ex.Message);
    }
}
