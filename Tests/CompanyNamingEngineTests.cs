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

    [Theory]
    [InlineData("정성스러운", "정성")]
    [InlineData("따뜻함", "따뜻")]
    [InlineData("새로움", "새로")]
    [InlineData("다정한", "다정")]
    public async Task Generate_InflectedKeyword_LeavesRootInName(string keyword, string root)
    {
        // 예전에는 1~2음절만 재료가 돼서 "정성스러운"은 이름에 흔적도 안 남았다
        var result = await _engine.GenerateAsync("culture", new[] { keyword }, "warm", "pure-korean", 0, 40);

        Assert.Contains(result.Candidates, c => c.Name.Contains(root, StringComparison.Ordinal));
    }

    [Fact]
    public async Task Generate_InflectedKeyword_ExplainsClipping()
    {
        var result = await _engine.GenerateAsync("culture", new[] { "정성스러운" }, "warm", "all", 0, 12);

        Assert.Single(result.KeywordNotices);
        Assert.Contains("정성", result.KeywordNotices[0], StringComparison.Ordinal);

        // 안내에서 '정성'을 썼다고 말했으면 목록에 실제로 있어야 한다.
        // 말만 하고 결과에 없으면 아무 말 안 한 것보다 나쁘다.
        Assert.Contains(result.Candidates, c => c.Name.Contains("정성", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Generate_HanjaKeyword_PullsMatchingPairs()
    {
        // '지혜' → {지, 혜} → 智·慧·惠 가 든 검수쌍이 위로 와야 한다.
        // 조합을 만드는 게 아니라 126쌍 안에서 고르는 것이라 동음 사고 위험이 없다.
        var result = await _engine.GenerateAsync("edu", new[] { "지혜" }, "classic", "hanja", 0, 12);

        Assert.Contains(result.Candidates,
            c => c.Hanja != null && (c.Hanja.Contains('智') || c.Hanja.Contains('慧') || c.Hanja.Contains('惠')));
    }

    [Theory]
    [InlineData("cafe", "카페", "warm")]
    [InlineData("cafe", "커피", "warm")]
    [InlineData("retail", "마트", "modern")]
    [InlineData("retail", "플러스", "modern")]
    public async Task Generate_RefusedKeyword_NeverAppearsInResults(
        string industry, string keyword, string tone)
    {
        // 회귀: 안내는 "이름에는 쓰지 않았어요"라고 말하는데 예약 슬롯이
        // '카페담'을 앉혀 정면 모순이 났다. 거절한 키워드는 어느 경로로도
        // 결과에 나타나면 안 된다 — 말과 동작이 같아야 한다.
        var result = await _engine.GenerateAsync(
            industry, new[] { keyword }, tone, "all", 0, 12);

        Assert.Single(result.KeywordNotices);
        Assert.DoesNotContain(result.Candidates,
            c => c.Name.Contains(keyword, StringComparison.Ordinal));
    }

    [Fact]
    public async Task Generate_HanjaCharKeyword_NotDeniedWhenPresent()
    {
        // 회귀: '淸'을 치면 청지(淸智)가 목록에 실재하는데 안내가 "넣지 못했어요"라고
        // 부정했다. 비한글 키워드도 최종 목록(이름·한자 표기)을 보고 말해야 한다.
        var result = await _engine.GenerateAsync("cafe", new[] { "淸" }, "modern", "hanja", 0, 12);

        bool present = result.Candidates.Any(c =>
            c.Name.Contains("淸", StringComparison.Ordinal)
            || (c.Hanja != null && c.Hanja.Contains("淸", StringComparison.Ordinal)));

        if (present)
            Assert.DoesNotContain(result.KeywordNotices,
                n => n.Contains("넣지 못했", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Generate_KeywordRootCandidate_TellsHonestStory()
    {
        // 회귀: 키워드 어근 후보(정성채)가 생성 루프의 축("고요 · 여백")을 제 것처럼
        // 서사했다. 어근 후보의 뜻·서사는 확인 가능한 것(어근 자체 + 뒷자리 어미)만 말한다.
        var result = await _engine.GenerateAsync(
            "cafe", new[] { "정성스러운" }, "warm", "all", 0, 12);

        var kwCandidate = result.Candidates.FirstOrDefault(
            c => c.Name.StartsWith("정성", StringComparison.Ordinal));
        Assert.NotNull(kwCandidate);

        Assert.Contains("담고 싶은 말", kwCandidate!.Reasons[0], StringComparison.Ordinal);
        Assert.StartsWith("'정성'", kwCandidate.Meaning, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Generate_Reasons_NeverClaimIndustryOwnsAxis()
    {
        // 회귀: "IT 업종의 '오램' 결"처럼 톤 주입·편승 축을 업종 소유로 단언했다.
        // 소유격 "업종의 '" 패턴이 서사에 되살아나지 않도록 고정한다.
        foreach (var (industry, tone) in new[] { ("it", "classic"), ("cafe", "warm"), ("law", "premium") })
        {
            var result = await _engine.GenerateAsync(industry, NoKeywords, tone, "all", 0, 12);
            foreach (var c in result.Candidates)
                Assert.All(c.Reasons, r =>
                    Assert.DoesNotContain("업종의 '", r, StringComparison.Ordinal));
        }
    }

    [Fact]
    public async Task Generate_KeywordNotices_NeverClaimUnverifiedReflection()
    {
        // "뜻은 살리되" 같은 확인 안 된 반영 주장이 안내문에 되살아나지 않도록 고정
        foreach (var (industry, kw) in new[] { ("cafe", "커피"), ("retail", "플러스"), ("it", "cloud") })
        {
            var result = await _engine.GenerateAsync(industry, new[] { kw }, "modern", "all", 0, 12);
            Assert.All(result.KeywordNotices, n =>
                Assert.DoesNotContain("뜻은 살리", n, StringComparison.Ordinal));
        }
    }

    [Theory]
    [InlineData("hanja", 0)]   // 어근 리터럴 경로(GenerateKorean)가 아예 안 도는 조건
    [InlineData("all", 2)]     // 어근(2음절)+어미(1음절+)는 항상 3음절이라 전부 걸러지는 조건
    public async Task Generate_ConstrainedKeyword_DoesNotMakeFalsePromise(string style, int syllables)
    {
        // 회귀: 절단 안내가 선택 결과를 안 보고 나가서, "'정성'만 따서 썼어요"라고
        // 말해놓고 목록에 정성이 0개인 조합이 운영 UI에서 재현됐다.
        var result = await _engine.GenerateAsync(
            "culture", new[] { "정성스러운" }, "warm", style, syllables, 12);

        bool included = result.Candidates.Any(
            c => c.Name.Contains("정성", StringComparison.Ordinal));

        foreach (var notice in result.KeywordNotices)
        {
            if (notice.Contains("따서 썼어요", StringComparison.Ordinal))
                Assert.True(included, $"목록에 없는데 썼다고 안내함: {notice}");
        }

        // 이 두 조건에서는 실제로 못 들어가므로, 조건을 푸는 법을 알려주는 안내여야 한다
        Assert.Contains(result.KeywordNotices,
            n => n.Contains("넣지 못했", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Generate_HanjaOnlyKeyword_ExplainsHanjaReflection()
    {
        // 결=한자면 '지혜'가 글자로는 못 남지만 智·慧·惠로는 담긴다 — 그 사실을 말해줘야 한다
        var result = await _engine.GenerateAsync("edu", new[] { "지혜" }, "classic", "hanja", 0, 12);

        Assert.Contains(result.KeywordNotices,
            n => n.Contains("한자로 담았", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Generate_UnusableKeyword_SaysSo()
    {
        // 영문 키워드는 이름 재료가 못 된다 — 무시당했다고 느끼지 않게 말해준다
        var result = await _engine.GenerateAsync("it", new[] { "cloud" }, "modern", "all", 0, 12);

        Assert.Single(result.KeywordNotices);
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
    // 톤 — 조건이 결과를 바꾸는지
    // ============================================================

    /// <summary>
    /// 어느 업종에서든 5개 톤이 서로 다른 축을 주입해야 한다.
    ///
    /// 톤이 밀어넣는 축이 겹치면 그 두 톤은 같은 재료 풀을 보게 되고, 결과가 다시
    /// 붙어버린다(실측: 고치기 전 6개 업종에서 modern과 playful이 12개 결과 100% 동일).
    /// SignatureAxes 순서를 바꾸면 이 성질이 조용히 깨지므로 여기서 막는다.
    /// </summary>
    [Fact]
    public void ToneSignatureAxes_DistinctPerIndustry()
    {
        var collisions = new List<string>();

        foreach (var industry in CompanyNamingData.Industries.Values)
        {
            var seen = new Dictionary<string, string>(StringComparer.Ordinal);

            foreach (var tone in CompanyNamingData.Tones.Values)
            {
                // 엔진과 같은 규칙: 업종이 안 고른 첫 번째 서명 축
                var injected = tone.SignatureAxes.FirstOrDefault(a => !industry.AxisKeys.Contains(a));
                if (injected == null) continue;

                if (seen.TryGetValue(injected, out var other))
                    collisions.Add($"{industry.Key}: {other}와 {tone.Key}가 모두 {injected} 주입");
                else
                    seen[injected] = tone.Key;
            }
        }

        Assert.True(collisions.Count == 0, string.Join(" / ", collisions));
    }

    /// <summary>같은 업종에서 톤을 바꾸면 결과가 실제로 달라져야 한다</summary>
    [Theory]
    [InlineData("cafe", "modern", "playful")]
    [InlineData("food", "modern", "playful")]
    [InlineData("bakery", "modern", "playful")]
    [InlineData("wellness", "modern", "playful")]
    [InlineData("retail", "modern", "playful")]
    [InlineData("agri", "modern", "playful")]
    [InlineData("law", "classic", "premium")]
    [InlineData("interior", "warm", "playful")]
    [InlineData("it", "modern", "warm")]
    public async Task Generate_TonesProduceDifferentResults(string industry, string toneA, string toneB)
    {
        var a = await _engine.GenerateAsync(industry, NoKeywords, toneA, "all", 0, 12);
        var b = await _engine.GenerateAsync(industry, NoKeywords, toneB, "all", 0, 12);

        var setA = a.Candidates.Select(c => c.Name).ToHashSet(StringComparer.Ordinal);
        var setB = b.Candidates.Select(c => c.Name).ToHashSet(StringComparer.Ordinal);

        var overlap = (double)setA.Intersect(setB, StringComparer.Ordinal).Count()
                    / setA.Union(setB, StringComparer.Ordinal).Count();

        Assert.True(overlap <= 0.58,
            $"{industry}: {toneA} vs {toneB} 겹침 {overlap:P0} — 톤이 결과를 못 바꾸고 있다");
    }

    /// <summary>같은 입력은 같은 결과를 내야 한다 (축 정렬 결정성)</summary>
    [Fact]
    public async Task Generate_IsDeterministic()
    {
        foreach (var industry in new[] { "cafe", "law", "it" })
        foreach (var tone in new[] { "modern", "classic", "premium" })
        {
            var first = await _engine.GenerateAsync(industry, NoKeywords, tone, "all", 0, 12);
            for (int i = 0; i < 3; i++)
            {
                var again = await _engine.GenerateAsync(industry, NoKeywords, tone, "all", 0, 12);
                Assert.Equal(
                    first.Candidates.Select(c => c.Name),
                    again.Candidates.Select(c => c.Name));
            }
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
