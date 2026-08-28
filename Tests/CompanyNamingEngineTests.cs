using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using Xunit;
using Xunit.Abstractions;

namespace NameForm.Tests;

/// <summary>
/// 상호 작명 엔진 테스트.
/// 인명 엔진과 계약이 다르다는 점(성씨 없음·인명용 한자 제약 없음·평가축 4종)을 고정한다.
/// </summary>
public class CompanyNamingEngineTests
{
    private readonly ITestOutputHelper _output;
    private readonly CompanyNamingEngine _engine = new();

    public CompanyNamingEngineTests(ITestOutputHelper output) => _output = output;

    private static readonly string[] NoKeywords = Array.Empty<string>();

    // ============================================================
    // 기본 계약
    // ============================================================

    [Fact]
    public async Task Generate_ReturnsRequestedCount()
    {
        var result = await _engine.GenerateAsync("cafe", NoKeywords, "warm", "all", 0, 12);

        Assert.Equal(12, result.Candidates.Count);
        Assert.Equal(12, result.TotalCount);
        Assert.Equal("cafe", result.Industry);
        Assert.Equal("카페 · 디저트", result.IndustryLabel);
    }

    [Fact]
    public async Task Generate_SortsByTotalScoreDescending()
    {
        var result = await _engine.GenerateAsync("it", NoKeywords, "modern", "all", 0, 20);

        var scores = result.Candidates.Select(c => c.TotalScore).ToList();
        Assert.Equal(scores.OrderByDescending(s => s).ToList(), scores);
    }

    [Fact]
    public async Task Generate_ProducesNoDuplicateNames()
    {
        var result = await _engine.GenerateAsync("food", NoKeywords, "warm", "all", 0, 50);

        var names = result.Candidates.Select(c => c.Name).ToList();
        Assert.Equal(names.Count, names.Distinct().Count());
    }

    [Fact]
    public async Task Generate_AllNamesAreHangulOnly()
    {
        var result = await _engine.GenerateAsync("beauty", NoKeywords, "premium", "all", 0, 50);

        foreach (var c in result.Candidates)
            Assert.All(c.Name, ch => Assert.InRange(ch, (char)0xAC00, (char)0xD7A3));
    }

    [Fact]
    public async Task Generate_ScoreBreakdownSumsToTotal()
    {
        var result = await _engine.GenerateAsync("edu", NoKeywords, "classic", "all", 0, 30);

        foreach (var c in result.Candidates)
        {
            var sum = c.Scores.Memorability + c.Scores.Pronunciation
                    + c.Scores.Distinctiveness + c.Scores.IndustryFit;
            Assert.Equal(c.TotalScore, sum);
            Assert.InRange(c.Scores.Memorability, 0, 30);
            Assert.InRange(c.Scores.Pronunciation, 0, 25);
            Assert.InRange(c.Scores.Distinctiveness, 0, 25);
            Assert.InRange(c.Scores.IndustryFit, 0, 20);
        }
    }

    // ============================================================
    // 필터 · 옵션
    // ============================================================

    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public async Task Generate_RespectsSyllableFilter(int syllables)
    {
        var result = await _engine.GenerateAsync("retail", NoKeywords, "modern", "all", syllables, 20);

        Assert.NotEmpty(result.Candidates);
        Assert.All(result.Candidates, c => Assert.Equal(syllables, c.Name.Length));
    }

    [Theory]
    [InlineData("hanja")]
    [InlineData("pure-korean")]
    [InlineData("english")]
    public async Task Generate_RespectsStyleFilter(string style)
    {
        var result = await _engine.GenerateAsync("culture", NoKeywords, "classic", style, 0, 20);

        Assert.NotEmpty(result.Candidates);
        Assert.All(result.Candidates, c => Assert.Equal(style, c.Style));
    }

    [Fact]
    public async Task Generate_AllStyles_CoversEveryGenerator()
    {
        var result = await _engine.GenerateAsync("cafe", NoKeywords, "modern", "all", 0, 50);

        var styles = result.Candidates.Select(c => c.Style).Distinct().ToList();
        Assert.Contains("hanja", styles);
        Assert.Contains("pure-korean", styles);
        Assert.Contains("english", styles);
    }

    [Fact]
    public async Task Generate_HanjaStyle_CarriesTwoCharacters()
    {
        var result = await _engine.GenerateAsync("law", NoKeywords, "classic", "hanja", 0, 15);

        Assert.All(result.Candidates, c =>
        {
            Assert.NotNull(c.Hanja);
            Assert.Equal(2, c.Hanja!.Length);
            Assert.Equal(2, c.Parts.Count);
        });
    }

    [Fact]
    public async Task Generate_InvalidIndustry_FallsBackWithoutThrowing()
    {
        var result = await _engine.GenerateAsync("does-not-exist", NoKeywords, "modern", "all", 0, 5);

        Assert.NotEmpty(result.Candidates);
        Assert.Equal("retail", result.Industry);
    }

    // ============================================================
    // 식별력 — 상호에서만 중요한 축
    // ============================================================

    [Fact]
    public async Task Generate_DoesNotSurfaceIndustryGenericWords()
    {
        // 업종 일반어는 상표 등록이 어렵고 검색에서도 묻힌다 → 상위 후보에 나오면 안 된다
        var result = await _engine.GenerateAsync("cafe", NoKeywords, "modern", "all", 0, 30);
        var generic = CompanyNamingData.Industries["cafe"].GenericWords;

        Assert.All(result.Candidates, c =>
            Assert.DoesNotContain(generic, g => c.Name.Contains(g, StringComparison.Ordinal)));
    }

    [Fact]
    public async Task Generate_DoesNotSurfaceCliches()
    {
        var result = await _engine.GenerateAsync("consulting", NoKeywords, "modern", "all", 0, 30);

        Assert.All(result.Candidates, c =>
            Assert.DoesNotContain(CompanyNamingData.ClicheParts, w => c.Name.Contains(w, StringComparison.Ordinal)));
    }

    [Fact]
    public async Task Generate_NoForbiddenWords()
    {
        foreach (var industry in CompanyNamingData.Industries.Keys)
        {
            var result = await _engine.GenerateAsync(industry, NoKeywords, "modern", "all", 0, 30);
            Assert.All(result.Candidates, c =>
                Assert.False(ForbiddenWordData.ContainsForbiddenWord(c.Name), $"{industry}: {c.Name}"));
        }
    }

    // ============================================================
    // 키워드
    // ============================================================

    [Fact]
    public async Task Generate_HangulKeyword_AppearsInSomeCandidates()
    {
        // 사용자가 넣은 말이 실제 상호에 남아야 설득력이 있다
        var result = await _engine.GenerateAsync("interior", new[] { "결" }, "premium", "pure-korean", 0, 40);

        Assert.Contains(result.Candidates, c => c.Name.Contains("결", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Generate_IndustryGenericKeyword_ReturnsNotice()
    {
        // 사업자는 자기 업종어를 넣고 싶어 한다. 엔진은 그런 후보를 감점으로 밀어내는데,
        // 밀어냈다는 사실을 말해주지 않으면 입력이 무시된 것처럼 보인다.
        var result = await _engine.GenerateAsync("cafe", new[] { "커피" }, "warm", "all", 0, 12);

        Assert.Single(result.KeywordNotices);
        Assert.Contains("커피", result.KeywordNotices[0], StringComparison.Ordinal);
    }

    [Fact]
    public async Task Generate_ClicheKeyword_ReturnsNotice()
    {
        var result = await _engine.GenerateAsync("retail", new[] { "플러스" }, "modern", "all", 0, 12);

        Assert.Single(result.KeywordNotices);
        Assert.Contains("플러스", result.KeywordNotices[0], StringComparison.Ordinal);
    }

    [Fact]
    public async Task Generate_HarmlessKeyword_ReturnsNoNotice()
    {
        var result = await _engine.GenerateAsync("cafe", new[] { "고요" }, "warm", "all", 0, 12);

        Assert.Empty(result.KeywordNotices);
    }

    [Fact]
    public async Task Generate_KeywordShiftsResults()
    {
        var plain = await _engine.GenerateAsync("it", NoKeywords, "modern", "all", 0, 20);
        var keyed = await _engine.GenerateAsync("it", new[] { "물" }, "modern", "all", 0, 20);

        var a = plain.Candidates.Select(c => c.Name).ToHashSet();
        var b = keyed.Candidates.Select(c => c.Name).ToHashSet();
        Assert.NotEqual(a, b);
    }

    // ============================================================
    // 서술 · 표기
    // ============================================================

    [Fact]
    public async Task Generate_EveryCandidateHasNarrative()
    {
        var result = await _engine.GenerateAsync("bakery", NoKeywords, "warm", "all", 0, 25);

        Assert.All(result.Candidates, c =>
        {
            Assert.False(string.IsNullOrWhiteSpace(c.Meaning));
            Assert.False(string.IsNullOrWhiteSpace(c.Romanization));
            Assert.Equal(3, c.Reasons.Count);
            Assert.All(c.Reasons, r => Assert.False(string.IsNullOrWhiteSpace(r)));
            Assert.Equal(3, c.UsageExamples.Count);
            Assert.Contains(c.UsageExamples, e => e.StartsWith("주식회사 ", StringComparison.Ordinal));
        });
    }

    [Fact]
    public async Task Generate_EveryIndustryProducesResults()
    {
        foreach (var industry in CompanyNamingData.Industries.Keys)
        {
            var result = await _engine.GenerateAsync(industry, NoKeywords, "modern", "all", 0, 12);
            Assert.True(result.Candidates.Count == 12, $"{industry}: {result.Candidates.Count}개만 생성됨");
        }
    }

    [Fact]
    public async Task Generate_EveryToneProducesResults()
    {
        foreach (var tone in CompanyNamingData.Tones.Keys)
        {
            var result = await _engine.GenerateAsync("cafe", NoKeywords, tone, "all", 0, 12);
            Assert.Equal(12, result.Candidates.Count);
        }
    }

    // ============================================================
    // 두음법칙 — 첫 글자에만 적용
    // ============================================================

    [Fact]
    public async Task Generate_AppliesDueumToLeadingSyllableOnly()
    {
        // 林(림)이 앞자리면 '임', 뒷자리면 '림' 으로 읽혀야 한다
        var result = await _engine.GenerateAsync("edu", NoKeywords, "classic", "hanja", 0, 50);

        foreach (var c in result.Candidates.Where(c => c.Hanja != null))
        {
            var first = c.Parts[0];
            Assert.False(NamingPrinciples.RequiresDueum(first.Reading),
                $"{c.Name}: 첫 글자 '{first.Reading}'에 두음법칙이 적용되지 않음");
            Assert.Equal(first.Reading + c.Parts[1].Reading, c.Name);
        }
    }

    // ============================================================
    // 검수 한자쌍 — 기계적으로 지킬 수 있는 규칙만 테스트로 고정한다
    // ============================================================

    /// <summary>
    /// 받침 있는 앞글자 + ㄹ로 시작하는 뒷글자는 금지.
    ///
    /// 한국어는 이 자리에서 유음화(ㄴ+ㄹ→ㄹㄹ)나 비음화(ㄱ/ㅁ/ㅇ+ㄹ→ㄴ)가 예외 없이
    /// 일어나 쓴 글자와 들리는 소리가 갈라진다 — 溫林 "온림"은 [올림]으로, 旭林 "욱림"은
    /// [웅님]으로 소리 난다. 상호는 듣고 받아적어 검색하는 이름이라 표기를 복원할 수
    /// 없으면 그 이름을 잃는다. 2026-08-28 검수에서 이 부류 7쌍을 걷어냈고,
    /// 새 쌍을 넣을 때 같은 실수를 반복하지 않도록 여기서 막는다.
    /// </summary>
    [Fact]
    public void HanjaPairs_NoLiquidNasalShift()
    {
        var violations = new List<string>();

        foreach (var (headChar, tailChar) in CompanyNamingData.HanjaPairs)
        {
            var head = CompanyNamingData.HanjaIndex[headChar];
            var tail = CompanyNamingData.HanjaIndex[tailChar];

            var headReading = NamingPrinciples.ApplyDueum(head.Seed.Reading);
            if (headReading.Length == 0 || tail.Seed.Reading.Length == 0) continue;

            bool headHasFinal = KoreanUtils.HasFinalConsonant(headReading[^1]);
            var (tailInitial, _, _) = KoreanUtils.Decompose(tail.Seed.Reading[0]);

            if (headHasFinal && tailInitial == "ㄹ")
                violations.Add($"{headChar}{tailChar} \"{headReading}{tail.Seed.Reading}\"");
        }

        Assert.True(violations.Count == 0,
            "받침 + ㄹ초성은 표기와 발음이 갈라진다: " + string.Join(", ", violations));
    }

    /// <summary>검수에서 걷어낸 쌍이 되살아나지 않았는지</summary>
    [Fact]
    public void HanjaPairs_RemovedPairsStayRemoved()
    {
        var removed = new[]
        {
            ("溫", "林"), ("旭", "林"), ("澹", "林"), ("溫", "隣"), ("澹", "隣"),
            ("松", "隣"), ("承", "隣"), ("澹", "原"), ("燦", "原"), ("素", "潭"),
            ("久", "智"), ("智", "恒"), ("峰", "恒"), ("澹", "豊"),
        };

        foreach (var pair in removed)
            Assert.DoesNotContain(pair, CompanyNamingData.HanjaPairs);
    }

    [Fact]
    public void HanjaPairs_AllCharactersResolve()
    {
        // 오타로 사전에 없는 글자를 넣으면 그 쌍이 조용히 사라진다 (엔진이 continue)
        foreach (var (headChar, tailChar) in CompanyNamingData.HanjaPairs)
        {
            Assert.True(CompanyNamingData.HanjaIndex.ContainsKey(headChar), $"미등록 글자: {headChar}");
            Assert.True(CompanyNamingData.HanjaIndex.ContainsKey(tailChar), $"미등록 글자: {tailChar}");
        }
    }

    // ============================================================
    // 육안 확인용 덤프
    // ============================================================

    [Fact]
    public async Task Dump_SampleOutputForReview()
    {
        foreach (var (industry, tone) in new[]
                 {
                     ("cafe", "warm"), ("it", "modern"), ("law", "classic"),
                     ("bakery", "playful"), ("interior", "premium"),
                 })
        {
            var result = await _engine.GenerateAsync(industry, NoKeywords, tone, "all", 0, 8);
            _output.WriteLine($"── {result.IndustryLabel} / {tone} ──");
            foreach (var c in result.Candidates)
            {
                var hanja = c.Hanja != null ? $" {c.Hanja}" : "";
                _output.WriteLine(
                    $"  {c.TotalScore,3}  {c.Name,-5}{hanja,-3} [{c.StyleLabel}] {c.Romanization,-12} {c.Meaning}");
                _output.WriteLine($"        예시: {string.Join(" / ", c.UsageExamples)}");
            }
            _output.WriteLine("");
        }
    }
}
