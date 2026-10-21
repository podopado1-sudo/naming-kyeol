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
        // '지혜' → {지, 혜} → 소리가 같은 智·惠 가 든 검수쌍이 위로 와야 한다 (뜻이 아니라 소리 매칭 —
        // 慧는 검수쌍에 없어 나올 수 없다). 검수쌍(HanjaPairs) 안에서 고르는 것이라 동음 사고 위험이 없다.
        var result = await _engine.GenerateAsync("edu", new[] { "지혜" }, "classic", "hanja", 0, 12);

        Assert.Contains(result.Candidates,
            c => c.Hanja != null && (c.Hanja.Contains('智') || c.Hanja.Contains('惠')));
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
        // 결=한자면 '지혜'가 글자로는 못 남지만 소리가 같은 智·惠로는 담긴다 — 그 사실을 말해줘야 한다.
        // 惠(은혜·베풂)는 뜻이 다르므로 '같은 뜻의 한자'라고 말하면 거짓이다(2026-10-21 검토 FSC-1).
        var result = await _engine.GenerateAsync("edu", new[] { "지혜" }, "classic", "hanja", 0, 12);

        Assert.Contains(result.KeywordNotices,
            n => n.Contains("같은 소리의 한자로 담았", StringComparison.Ordinal));
        Assert.DoesNotContain(result.KeywordNotices,
            n => n.Contains("같은 뜻", StringComparison.Ordinal));
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

    [Theory]
    [InlineData("beauty", "화사한", "modern", "화")]
    [InlineData("beauty", "피어나는", "modern", "피")]
    [InlineData("beauty", "조화", "modern", "화")]
    [InlineData("pet", "개", "playful", "개")]
    [InlineData("agri", "흙", "warm", "흙")]   // 동형어가 아니라 목록에 그 자체로 든 말
    public async Task Generate_ForbiddenPartKeyword_RefusedBeforeGeneration(
        string industry, string keyword, string tone, string forbidden)
    {
        // 회귀: 금칙어 부분일치(화·피·개) 때문에 결과에 절대 못 들어가는 키워드에
        // "이번 결과에는 넣지 못했어요"라고 했다. 결과는 결정적이라 다시 눌러도 같다 —
        // 말과 동작이 같으려면 생성 전에 판정하고, 이유를 말하고, 결과에는 손대지 않아야 한다.
        var plain = await _engine.GenerateAsync(industry, NoKeywords, tone, "all", 0, 12);
        var keyed = await _engine.GenerateAsync(industry, new[] { keyword }, tone, "all", 0, 12);

        var notice = Assert.Single(keyed.KeywordNotices);
        Assert.Contains($"'{forbidden}'", notice, StringComparison.Ordinal);
        Assert.DoesNotContain("이번", notice, StringComparison.Ordinal);

        // 이유는 중립적으로 — '흙'·'모기'는 두 뜻이 있는 말이 아니라 "다른 뜻으로도 읽혀"는 틀린 설명이었다
        Assert.Contains("부정적으로 읽힐 수 있", notice, StringComparison.Ordinal);
        Assert.DoesNotContain("다른 뜻", notice, StringComparison.Ordinal);
        Assert.Contains("쓰지 않았어요", notice, StringComparison.Ordinal);
        // 일부 글자만 걸렸어도 키워드 전체가 빠진다 — "'조화'에 든 '화'는 …"은 '조'는 썼다는 뜻으로 읽혔다
        if (keyword != forbidden)
            Assert.Contains("키워드 전체를 쓰지 않았어요", notice, StringComparison.Ordinal);

        // 재료로 안 썼다고 말했으니 결과는 키워드가 없을 때와 같아야 한다
        Assert.Equal(plain.Candidates.Select(c => c.Name), keyed.Candidates.Select(c => c.Name));
    }

    /// <summary>금칙어 안내 끝에 붙은 대안 제안 — 거절 문장("…쓰지 않았어요.") 뒤의 따옴표 말들</summary>
    private static List<string> SuggestionsIn(string notice)
    {
        const string end = "쓰지 않았어요.";
        var at = notice.IndexOf(end, StringComparison.Ordinal);
        Assert.True(at >= 0, $"거절 문장이 없음: {notice}");
        return System.Text.RegularExpressions.Regex.Matches(notice[(at + end.Length)..], "'([^']+)'")
            .Select(m => m.Groups[1].Value)
            .Where(s => s != "전체") // "결을 '전체'로 두고"의 결 이름
            .ToList();
    }

    [Theory]
    [InlineData("all", 0)]
    [InlineData("pure-korean", 0)]
    [InlineData("hanja", 0)]
    [InlineData("english", 0)]
    [InlineData("all", 2)]
    [InlineData("all", 3)]
    [InlineData("all", 4)]
    [InlineData("pure-korean", 4)]
    [InlineData("hanja", 3)]
    public async Task Generate_ForbiddenKeyword_SuggestionsActuallyWork(string style, int syllables)
    {
        // 금칙어 안내가 권한 말을 넣었는데 또 "넣지 못했어요"가 나오면 안 된다 — 전 업종 × 결 × 글자 수.
        // 회귀: 대안이 결·글자 수를 몰라 4음절에서 1음절 '빛'을 권했고(빛+어미는 최대 3음절),
        // 한자 결에서도 그대로 권해 같은 응답 안에서 "'빛'은 … 넣지 못했어요"가 나왔다(2026-10-21 검토).
        bool styleBlocksHangul = style is "hanja" or "english";
        foreach (var industry in CompanyNamingData.Industries.Keys)
        {
            var result = await _engine.GenerateAsync(industry, new[] { "화사한" }, "modern", style, syllables, 12);
            var notice = Assert.Single(result.KeywordNotices);
            var suggestions = SuggestionsIn(notice);

            if (style == "all" && syllables == 0)
                Assert.True(suggestions.Count == 2, $"{industry}: 대안이 {suggestions.Count}개 — {notice}");
            Assert.True(suggestions.Count is >= 1 and <= 2, $"{industry}/{style}/{syllables}: 대안 {suggestions.Count}개 — {notice}");

            // 한자·영문 결에는 한글 어근이 들어갈 자리가 없다 — 권하려면 결을 풀라고 함께 말해야 참이다
            Assert.Equal(styleBlocksHangul, notice.Contains("결을 '전체'로 두고", StringComparison.Ordinal));

            var retryStyle = styleBlocksHangul ? "all" : style;
            foreach (var s in suggestions)
            {
                if (syllables != 0)
                    Assert.True(s.Length < syllables, $"{industry}: '{s}'에 어미를 이으면 {syllables}음절을 넘는다");

                var retry = await _engine.GenerateAsync(industry, new[] { s }, "modern", retryStyle, syllables, 12);
                Assert.True(retry.Candidates.Any(c => c.Name.Contains(s, StringComparison.Ordinal)),
                    $"{industry}/{retryStyle}/{syllables}: 권한 '{s}'가 결과에 없음");
                Assert.DoesNotContain(retry.KeywordNotices, n => n.Contains("넣지", StringComparison.Ordinal));
            }
        }
    }

    [Theory]
    [InlineData("hanja", 0)]
    [InlineData("all", 4)]
    [InlineData("all", 0)]
    public async Task Generate_ForbiddenKeyword_DoesNotSuggestWhatUserTyped(string style, int syllables)
    {
        // 회귀: {화사한, 빛}에 대안으로 사용자가 이미 넣은 '빛'을 권했고, 바로 다음 안내가
        // "'빛'은 … 넣지 못했어요"였다 — 한 응답 안에서 권한 말이 못 넣은 말로 나왔다.
        var result = await _engine.GenerateAsync("beauty", new[] { "화사한", "빛" }, "modern", style, syllables, 12);

        var refusal = result.KeywordNotices.First(n => n.StartsWith("'화사한'", StringComparison.Ordinal));
        var suggestions = SuggestionsIn(refusal);
        Assert.DoesNotContain("빛", suggestions);
        foreach (var s in suggestions)
            Assert.DoesNotContain(result.KeywordNotices, n => n.StartsWith($"'{s}'", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("beauty", "premium", "all")]
    [InlineData("cafe", "modern", "hanja")]
    public async Task Generate_HanjaKeyword_NotRefusedAndPresentAsCharacter(string industry, string tone, string style)
    {
        // 회귀: '청'을 넣으면 청예(淸藝)가 나오는데 '淸'을 넣으면 "넣지 못했어요"였다.
        // 한자 키워드는 그 글자가 든 검수쌍으로 들어간다 — 거절 안내가 없고 淸 후보가 있어야 한다.
        var result = await _engine.GenerateAsync(industry, new[] { "淸" }, tone, style, 0, 12);

        Assert.DoesNotContain(result.KeywordNotices, n => n.Contains("넣지 못했", StringComparison.Ordinal));
        Assert.Contains(result.Candidates, c => c.Hanja != null && c.Hanja.Contains('淸'));
        // 독음 '청'으로 만든 순우리말 리터럴 카드는 없어야 한다 — 사용자가 친 건 한자다
        Assert.DoesNotContain(result.Candidates, c => c.Parts[0].Meaning == "담고 싶은 말");
    }

    [Fact]
    public async Task Generate_HanjaKeyword_PureKoreanStyle_SaysHowToUnlock()
    {
        // 순우리말 결에는 한자 키워드가 들어갈 자리가 없다 — 독음 '청'으로 순우리말 카드를 만들지 않고
        // 결을 풀면 들어간다고 말한다(전체·무관이면 淸의 축이 선택돼 예약 슬롯이 淸 후보를 앉힌다).
        var narrowed = await _engine.GenerateAsync("edu", new[] { "淸" }, "warm", "pure-korean", 0, 12);
        Assert.DoesNotContain(narrowed.Candidates, c => c.Parts[0].Meaning == "담고 싶은 말");
        Assert.Contains(narrowed.KeywordNotices, n => n.Contains("결을 '전체'", StringComparison.Ordinal));

        var unlocked = await _engine.GenerateAsync("edu", new[] { "淸" }, "warm", "all", 0, 12);
        Assert.Contains(unlocked.Candidates, c => c.Hanja != null && c.Hanja.Contains('淸'));
        Assert.Empty(unlocked.KeywordNotices);
    }

    private static int AxisCount(CompanyNamingResult r, string axisLabel) =>
        r.Candidates.Count(c => c.Reasons.Any(x => x.Contains($"'{axisLabel}'", StringComparison.Ordinal)));

    [Theory]
    [InlineData("cafe", "warm", true)]
    [InlineData("edu", "classic", false)]  // 초목이 업종 1순위 축이라 이미 차 있다 — 줄지만 않으면 된다
    [InlineData("beauty", "modern", true)]
    public async Task Generate_HanjaKeyword_LeadingLiquid_PullsItsOwnAxis(string industry, string tone, bool expectRise)
    {
        // 회귀: 林을 독음으로 바꾸며 두음법칙을 걸어 '임'이 됐고, 축 매칭이 林(초목)을 놓친 채
        // 稔(임, 결실)·거둠(거둬들임)으로 쏠렸다. 그리고 '임담'이 '순우리말' 카드로 나왔다(2026-10-21 검토).
        // 한자 키워드는 그 글자 자체로 축을 잡고, 그 글자가 든 검수쌍(芽林)이 올라와야 한다.
        var plain = await _engine.GenerateAsync(industry, NoKeywords, tone, "all", 0, 12);
        var keyed = await _engine.GenerateAsync(industry, new[] { "林" }, tone, "all", 0, 12);

        const string wood = "초목 · 자람", harvest = "결실 · 풍요";
        Assert.Contains(keyed.Candidates, c => c.Hanja != null && c.Hanja.Contains('林'));
        int woodBefore = AxisCount(plain, wood), woodAfter = AxisCount(keyed, wood);
        Assert.True(expectRise ? woodAfter > woodBefore : woodAfter >= woodBefore,
            $"{industry}: 초목 축 {woodBefore} → {woodAfter}");

        // 稔 쏠림의 흔적 — 초목 없이 결실 축만 든 후보(메손·플레논·열매온…)가 늘면 안 된다.
        // 열매솔·이삭뜰처럼 결실 어근 + 초목 어미는 초목 축이 끌어온 것이라 세지 않는다.
        static int HarvestOnly(CompanyNamingResult r) => r.Candidates.Count(c =>
            c.Reasons.Any(x => x.Contains($"'{harvest}'", StringComparison.Ordinal))
            && !c.Reasons.Any(x => x.Contains($"'{wood}'", StringComparison.Ordinal)));
        Assert.True(HarvestOnly(keyed) <= HarvestOnly(plain),
            $"{industry}: 林이 결실 축(稔)을 끌어옴 {HarvestOnly(plain)} → {HarvestOnly(keyed)}");
        Assert.DoesNotContain(keyed.Candidates, c => c.Parts[0].Meaning == "담고 싶은 말");
        Assert.DoesNotContain(keyed.Candidates, c => c.Name.StartsWith('임') && c.Style == "pure-korean");
        Assert.DoesNotContain(keyed.KeywordNotices, n => n.Contains("넣지 못했", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Generate_HanjaKeyword_SingleReadingIsNotIndustryGenericWord()
    {
        // 회귀: 美를 독음 '미'로 바꾼 뒤 일반어 판정을 양방향으로 해서 '미용'에 '미'가 든다는 이유로
        // "'美'는 뷰티 · 미용 일반어예요"라고 안내했다. 독음이 일반어를 통째로 품을 때만(美容→미용) 일반어다.
        var single = await _engine.GenerateAsync("beauty", new[] { "美" }, "warm", "all", 0, 12);
        Assert.DoesNotContain(single.KeywordNotices, n => n.Contains("일반어", StringComparison.Ordinal));

        var word = await _engine.GenerateAsync("beauty", new[] { "美容" }, "warm", "all", 0, 12);
        Assert.Contains(word.KeywordNotices, n => n.Contains("일반어", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("綠")] // 록 → 녹: 순우리말 '녹'은 쇠에 스는 녹이다 ('녹품'이 나왔었다)
    [InlineData("愛")] // 애: '애담'이 '순우리말' 97점으로 1위였다
    public async Task Generate_HanjaKeywordOutsidePairs_DoesNotBecomePureKoreanLiteral(string keyword)
    {
        // 축 씨앗·검수쌍 어디에도 없는 한자는 들어갈 경로가 없다. 독음을 순우리말 어근처럼 쓰면
        // 사용자가 친 한자는 카드 어디에도 없이 '순우리말' 라벨만 붙는다 — 결과는 그대로 두고 그렇다고 말한다.
        var plain = await _engine.GenerateAsync("cafe", NoKeywords, "warm", "all", 0, 12);
        var keyed = await _engine.GenerateAsync("cafe", new[] { keyword }, "warm", "all", 0, 12);

        Assert.Equal(plain.Candidates.Select(c => c.Name), keyed.Candidates.Select(c => c.Name));
        Assert.DoesNotContain(keyed.Candidates, c => c.Parts[0].Meaning == "담고 싶은 말");
        var notice = Assert.Single(keyed.KeywordNotices);
        Assert.StartsWith($"'{keyword}'", notice, StringComparison.Ordinal);
        Assert.Contains("넣지 못했", notice, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Generate_KeywordMaeum_DoesNotFlipToWisdomAxis()
    {
        // 회귀: WISDOM의 라틴 뜻풀이 mente "마음" 때문에 카페 키워드 '마음'이 12개 중 7개를
        // '슬기 · 앎' 축(서각·앎채…)으로 뒤집었다. 라틴 뜻풀이는 축 매칭에 쓰지 않는다.
        var plain = await _engine.GenerateAsync("cafe", NoKeywords, "modern", "all", 0, 12);
        var keyed = await _engine.GenerateAsync("cafe", new[] { "마음" }, "modern", "all", 0, 12);

        static int Wisdom(CompanyNamingResult r) =>
            r.Candidates.Count(c => c.Reasons.Any(x => x.Contains("슬기 · 앎", StringComparison.Ordinal)));

        Assert.True(Wisdom(keyed) <= Wisdom(plain),
            $"'마음'이 슬기 축을 끌어옴: {Wisdom(plain)} → {Wisdom(keyed)}");
        Assert.Contains(keyed.Candidates, c => c.Name.Contains("마음", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("beauty", "warm", "꽃", "초목 · 자람", 7)] // flor
    [InlineData("cafe", "warm", "바다", "물 · 흐름", 3)]   // mare — 카페 업종 축 밖이라 끌어오는 몫이 작다
    [InlineData("cafe", "warm", "산", "터 · 뿌리", 3)]     // monte
    [InlineData("it", "modern", "기술", "손길 · 다듬음", 1)] // tecna — IT 업종 축 밖이고 영문 몫이 커서 2개 안팎
    public async Task Generate_LatinGlossKeyword_StillMovesAxis(
        string industry, string tone, string keyword, string axisLabel, int atLeast)
    {
        // 회귀: '마음' 오탐을 막으려 라틴 뜻풀이 매칭을 통째로 빼자, 뜻풀이로만 축에 닿던 흔한 키워드
        // (꽃=flor, 바다=mare, 산=monte, 기술=tecna)가 축을 못 움직였다. 리터럴 하나(꽃담)만 끼고 안내도 없어
        // 반영된 것처럼 보였다(2026-10-21 검토). 뜻풀이는 완전일치로 되살렸다.
        var plain = await _engine.GenerateAsync(industry, NoKeywords, tone, "all", 0, 12);
        var keyed = await _engine.GenerateAsync(industry, new[] { keyword }, tone, "all", 0, 12);

        int before = AxisCount(plain, axisLabel), after = AxisCount(keyed, axisLabel);
        Assert.True(after >= atLeast && after > before,
            $"'{keyword}' → '{axisLabel}' 축 {before} → {after} (기대: {atLeast}개 이상이고 키워드 없을 때보다 많음)");
    }

    [Fact]
    public void LatinGloss_DoesNotSayMaeum()
    {
        // 뜻풀이는 축 매칭에 완전일치로 쓰인다 — mente가 다시 '마음'이 되면 '마음' 키워드가 슬기 축으로 뒤집힌다
        Assert.DoesNotContain(CompanyNamingData.Axes["WISDOM"].Latin, l => l.Meaning == "마음");
    }

    [Theory]
    [InlineData("all", 0)]
    [InlineData("hanja", 0)]
    [InlineData("pure-korean", 3)]
    public async Task Generate_DoubleFinalKeyword_ExplainsWhy(string style, int syllables)
    {
        // 회귀: 겹받침 어근(삶·앎)은 어느 어미와도 쓴 대로 안 읽혀(삶온→[살몬], 앎채→[암채]) 결합 단계가
        // 늘 막는데, 안내는 이유 없이 "넣지 못했어요"였고 결을 좁히면 "바꾸면 들어갈 수 있어요"라는
        // 거짓 약속까지 했다. 조건과 무관한 이유를 말해야 한다(2026-10-21 검토 BC-6).
        var result = await _engine.GenerateAsync("cafe", new[] { "삶", "앎" }, "warm", style, syllables, 12);

        Assert.Equal(2, result.KeywordNotices.Count);
        foreach (var kw in new[] { "삶", "앎" })
        {
            var notice = Assert.Single(result.KeywordNotices, n => n.StartsWith($"'{kw}'", StringComparison.Ordinal));
            Assert.Contains("받침이 둘", notice, StringComparison.Ordinal);
            Assert.DoesNotContain("들어갈 수 있어요", notice, StringComparison.Ordinal);
        }
    }

    /// <summary>
    /// 후보가 그 축의 재료로 만들어졌는지 — 엔진의 서사(추천 이유 문장)가 아니라 축 데이터와 후보 구성 요소를 맞대어 본다.
    /// 한자는 표기에 든 글자가 축 씨앗인지, 순우리말은 앞 어근(또는 뒷 어미의 축)이, 영문은 라틴 어근이 그 축 것인지.
    /// </summary>
    private static bool UsesAxisMaterial(CompanyNameCandidate c, string axisKey)
    {
        var axis = CompanyNamingData.Axes[axisKey];
        return c.Style switch
        {
            "hanja" => c.Hanja != null && c.Hanja.Any(ch => axis.Hanja.Any(h => h.Char == ch.ToString())),
            "pure-korean" => axis.Korean.Any(k => k.Text == c.Parts[0].Symbol)
                             || CompanyNamingData.KoreanTailRoots.Any(t => t.AxisKey == axisKey && t.Root.Text == c.Parts[1].Symbol),
            _ => axis.Latin.Any(l => l.Text == c.Parts[0].Symbol),
        };
    }

    [Theory]
    [InlineData("cafe", "warm", "開", "START")]   // 開(개, 엶) — 독음 '개'가 공용 금칙어
    [InlineData("it", "modern", "和", "WARMTH")]  // 和(화, 어울림) — 독음 '화'가 공용 금칙어
    public async Task Generate_AxisSeedHanjaWithForbiddenReading_StillMovesItsAxis(
        string industry, string tone, string keyword, string axisKey)
    {
        // 회귀: 축 씨앗 和·開의 독음(화·개)이 공용 금칙어에 걸려 "'開'는 소리 '개'가 부정적으로 읽힐 수 있어 …"로
        // 통째로 거절됐고, 프로덕션에서 움직이던 축(START·WARMTH)이 멈춰 결과가 키워드 없을 때와 이름·순서까지 같았다
        // (2026-10-21 검토 BCF-1). 한자 키워드는 글자 그대로만 쓰이므로 독음이 이름에 들어갈 경로가 없다.
        var plain = await _engine.GenerateAsync(industry, NoKeywords, tone, "all", 0, 12);
        var keyed = await _engine.GenerateAsync(industry, new[] { keyword }, tone, "all", 0, 12);

        int before = plain.Candidates.Count(c => UsesAxisMaterial(c, axisKey));
        int after = keyed.Candidates.Count(c => UsesAxisMaterial(c, axisKey));
        Assert.True(after > 0 && after > before, $"'{keyword}' → {axisKey} 축 재료 후보 {before} → {after}");

        // 안내는 사실대로 — 금칙어 탓이 아니라 검수쌍에 없는 글자라 글자로는 못 넣었고, 그 글자의 축 이름은 골랐다
        var notice = Assert.Single(keyed.KeywordNotices);
        Assert.StartsWith($"'{keyword}'", notice, StringComparison.Ordinal);
        Assert.DoesNotContain("부정적", notice, StringComparison.Ordinal);
        Assert.DoesNotContain("쓰지 않았어요", notice, StringComparison.Ordinal);
        Assert.Contains("검수한 상호 한자쌍에 없는 글자", notice, StringComparison.Ordinal);
        Assert.Contains($"'{CompanyNamingData.Axes[axisKey].Label}'", notice, StringComparison.Ordinal);
        Assert.DoesNotContain(keyed.Candidates, c => c.Hanja != null && c.Hanja.Contains(keyword, StringComparison.Ordinal));

        // 금칙어 소리가 이름으로 새지 않는다 — 독음은 재료가 아니다
        Assert.DoesNotContain(keyed.Candidates, c => ForbiddenWordData.ContainsForbiddenWord(c.Name));
        Assert.DoesNotContain(keyed.Candidates, c => c.Parts[0].Meaning == "담고 싶은 말");
    }

    [Fact]
    public async Task Generate_NonSeedHanjaWithForbiddenReading_StillRefused()
    {
        // 예외는 축 씨앗으로만 좁다 — 같은 소리 '화'라도 축 씨앗이 아닌 火는 예전처럼 거절하고 결과를 건드리지 않는다
        Assert.False(CompanyNamingData.HanjaIndex.ContainsKey("火"));
        var plain = await _engine.GenerateAsync("it", NoKeywords, "modern", "all", 0, 12);
        var keyed = await _engine.GenerateAsync("it", new[] { "火" }, "modern", "all", 0, 12);

        var notice = Assert.Single(keyed.KeywordNotices);
        Assert.Contains("부정적으로 읽힐 수 있", notice, StringComparison.Ordinal);
        Assert.Equal(plain.Candidates.Select(c => c.Name), keyed.Candidates.Select(c => c.Name));
    }

    [Fact]
    public async Task Generate_MixedHanjaHangulKeyword_UsesBothParts()
    {
        // 회귀: '淸빛'을 통째로 한자 키워드로 다뤄 '빛'이 재료로도 안내로도 다뤄지지 않고 말없이 버려졌다 —
        // 결과가 ['淸'] 단독과 완전히 같고 안내도 없었다(2026-10-21 검토 BCF-2).
        // 섞인 키워드는 한자 부분과 한글 부분을 나눠 따로 쓴다 — 나눠 넣은 ['淸', '빛']과 같아야 한다.
        var mixed = await _engine.GenerateAsync("cafe", new[] { "淸빛" }, "warm", "all", 0, 12);
        var split = await _engine.GenerateAsync("cafe", new[] { "淸", "빛" }, "warm", "all", 0, 12);
        var hanjaOnly = await _engine.GenerateAsync("cafe", new[] { "淸" }, "warm", "all", 0, 12);

        Assert.Equal(split.Candidates.Select(c => c.Name), mixed.Candidates.Select(c => c.Name));
        Assert.Contains(mixed.Candidates, c => c.Hanja != null && c.Hanja.Contains('淸'));
        Assert.Contains(mixed.Candidates, c => c.Name.Contains('빛'));
        Assert.NotEqual(hanjaOnly.Candidates.Select(c => c.Name), mixed.Candidates.Select(c => c.Name));
        Assert.Empty(mixed.KeywordNotices); // 둘 다 실제로 들어갔으면 침묵 — 한글 리터럴과 같은 규칙
    }

    [Fact]
    public async Task Generate_MixedKeyword_NoticeNamesThePartItCouldNotUse()
    {
        // 결=한자면 '빛'은 들어갈 경로가 없다 — 버린 부분을 원래 키워드와 함께 짚어 말하고, 푸는 법은 막은 조건(결)만 말한다
        var result = await _engine.GenerateAsync("cafe", new[] { "淸빛" }, "warm", "hanja", 0, 12);

        Assert.Contains(result.Candidates, c => c.Hanja != null && c.Hanja.Contains('淸'));
        var notice = Assert.Single(result.KeywordNotices);
        Assert.StartsWith("'淸빛'의 '빛'은", notice, StringComparison.Ordinal);
        Assert.Contains("결을 '전체'로", notice, StringComparison.Ordinal);
        Assert.DoesNotContain("글자 수", notice, StringComparison.Ordinal);

        // 푸는 법이 참인지 — 결을 전체로 풀면 '빛'이 실제로 들어간다
        var unlocked = await _engine.GenerateAsync("cafe", new[] { "淸빛" }, "warm", "all", 0, 12);
        Assert.Contains(unlocked.Candidates, c => c.Name.Contains('빛'));
    }

    [Fact]
    public async Task Generate_MixedKeyword_RefusesOnlyTheForbiddenPart()
    {
        // 나눈 조각도 거절 판정을 따로 거친다 — '淸개'의 '개'만 빼고 淸은 쓴다(['淸'] 단독과 같은 결과)
        var mixed = await _engine.GenerateAsync("cafe", new[] { "淸개" }, "warm", "all", 0, 12);
        var hanjaOnly = await _engine.GenerateAsync("cafe", new[] { "淸" }, "warm", "all", 0, 12);

        Assert.Equal(hanjaOnly.Candidates.Select(c => c.Name), mixed.Candidates.Select(c => c.Name));
        var notice = Assert.Single(mixed.KeywordNotices);
        Assert.StartsWith("'淸개'의 '개'는", notice, StringComparison.Ordinal);
        Assert.Contains("부정적으로 읽힐 수 있", notice, StringComparison.Ordinal);
        Assert.Contains("이 부분은 쓰지 않았어요", notice, StringComparison.Ordinal);
        Assert.DoesNotContain("키워드", notice, StringComparison.Ordinal); // 키워드 전체를 버린 게 아니다
    }

    [Theory]
    [InlineData("pure-korean", 0)]
    [InlineData("all", 0)]
    [InlineData("all", 3)]
    public async Task Generate_CompatibilityHanjaKeyword_ActsLikeUnifiedHanja(string style, int syllables)
    {
        // 회귀: 한글 IME로 '림'을 변환하면 호환 한자 U+F9F4(林)가 들어온다. 매칭만 NFC로 맞추고 판정·조사는 원문 글자를 봐서
        // 독음을 못 찾았고, 안내가 "'林'는 …"이 됐다(2026-10-21 검토 BCF-3). 소스에 호환 한자를 리터럴로 쓰지 말 것(NFC 함정).
        const string compat = "林", unified = "林";
        Assert.NotEqual(compat, unified);

        var viaCompat = await _engine.GenerateAsync("cafe", new[] { compat }, "warm", style, syllables, 12);
        var viaUnified = await _engine.GenerateAsync("cafe", new[] { unified }, "warm", style, syllables, 12);

        Assert.Equal(viaUnified.Candidates.Select(c => c.Name), viaCompat.Candidates.Select(c => c.Name));
        Assert.Equal(viaUnified.KeywordNotices, viaCompat.KeywordNotices);
        Assert.All(viaCompat.KeywordNotices, n =>
        {
            Assert.DoesNotContain(compat, n, StringComparison.Ordinal);
            Assert.StartsWith($"'{unified}'은 ", n, StringComparison.Ordinal); // 林 → 림 → 임: 받침 있음 → '은'
        });
        if (style == "pure-korean" || syllables == 3)
            Assert.NotEmpty(viaCompat.KeywordNotices); // 이 조건에서는 실제로 못 들어가 안내가 나와야 조사를 확인한 것이다
        else
            Assert.Contains(viaCompat.Candidates, c => c.Hanja != null && c.Hanja.Contains(unified, StringComparison.Ordinal));
    }

    [Theory]
    // 한자 키워드 — 결은 순우리말·영문만 막고(한자 조합 결로도 들어간다), 글자 수는 3·4만 막는다(검수쌍은 늘 2음절)
    [InlineData("cafe", "淸", "pure-korean", 0)]
    [InlineData("cafe", "淸", "english", 2)]
    [InlineData("cafe", "林", "all", 3)]
    [InlineData("cafe", "林", "pure-korean", 4)]
    // 한글 키워드 — 결은 '전체'가 아니면, 글자 수는 '무관'이 아니면 막은 것이다
    [InlineData("culture", "정성스러운", "hanja", 0)]
    [InlineData("culture", "정성스러운", "all", 2)]
    [InlineData("culture", "정성스러운", "english", 2)]
    public async Task Generate_UnlockHint_NamesOnlyTheConditionsThatBlocked(
        string industry, string keyword, string style, int syllables)
    {
        // 회귀: '푸는 법'이 늘 "결을 '전체', 글자 수를 '무관'으로 바꾸면"이라 글자 수가 이미 무관이거나 결이 이미 전체여도
        // 바꾸라고 했다(2026-10-21 검토 BCF-5). 실제로 막은 조건만 말하고, 그 말대로 풀면 정말 들어가야 한다.
        bool hanja = keyword.Any(ch => ch >= '一' && ch <= '鿿');
        bool styleBlocks = hanja ? style is "pure-korean" or "english" : style != "all";
        bool lengthBlocks = hanja ? syllables is 3 or 4 : syllables != 0;
        Assert.True(styleBlocks || lengthBlocks); // 사례표 자체가 '막힌' 조건이어야 한다

        var result = await _engine.GenerateAsync(industry, new[] { keyword }, "warm", style, syllables, 12);
        var notice = Assert.Single(result.KeywordNotices, n => n.Contains("넣지 못했", StringComparison.Ordinal));

        Assert.Equal(styleBlocks, notice.Contains("결을 '전체'", StringComparison.Ordinal));
        Assert.Equal(lengthBlocks, notice.Contains("글자 수를 '무관'", StringComparison.Ordinal));
        Assert.Equal(hanja && styleBlocks, notice.Contains("'한자 조합'", StringComparison.Ordinal));
        Assert.Equal(hanja && lengthBlocks, notice.Contains("'2글자'", StringComparison.Ordinal));
        var blocked = styleBlocks && lengthBlocks ? "결·글자 수" : styleBlocks ? "결" : "글자 수";
        Assert.Contains($"지금 고른 {blocked}에서는", notice, StringComparison.Ordinal);

        // 말한 대로 풀어 본다 — 권한 선택지 하나하나가 참이어야 한다
        var styles = !styleBlocks ? new[] { style } : hanja ? new[] { "all", "hanja" } : new[] { "all" };
        var lengths = !lengthBlocks ? new[] { syllables } : hanja ? new[] { 0, 2 } : new[] { 0 };
        string mark = hanja ? keyword : "정성";
        foreach (var s in styles)
        foreach (var n in lengths)
        {
            var retry = await _engine.GenerateAsync(industry, new[] { keyword }, "warm", s, n, 12);
            Assert.True(retry.Candidates.Any(c => hanja
                    ? c.Hanja != null && c.Hanja.Contains(mark, StringComparison.Ordinal)
                    : c.Name.Contains(mark, StringComparison.Ordinal)),
                $"{keyword}: 결 '{s}'·글자 수 {n}으로 풀었는데 들어가지 않음 — {notice}");
        }
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

    [Theory]
    [InlineData("health")]
    [InlineData("law")]
    public async Task Generate_LicensedIndustries_NoJointStockExample(string industry)
    {
        // 의원·법률사무소는 주식회사로 열 수 없다 — '주식회사 카론'(의원) 같은 예시가 나갔었다
        var result = await _engine.GenerateAsync(industry, NoKeywords, "warm", "all", 0, 30);

        Assert.All(result.Candidates, c =>
        {
            Assert.Equal(3, c.UsageExamples.Count);
            Assert.DoesNotContain(c.UsageExamples, e => e.Contains("주식회사", StringComparison.Ordinal));
        });
    }

    [Fact]
    public async Task Generate_PetExamples_DoNotPairVetClinicWithJointStock()
    {
        // 동물병원은 수의사법상 개설 주체가 수의사·동물진료법인 등으로 제한된다 — 'OO 동물병원'과
        // '주식회사 OO'를 한 카드에 나란히 세우지 않는다. 주식회사로 열 수 있는 펫샵·살롱을 앞에 둔다.
        var result = await _engine.GenerateAsync("pet", NoKeywords, "warm", "all", 0, 30);

        Assert.All(result.Candidates, c =>
        {
            Assert.Equal(3, c.UsageExamples.Count);
            Assert.False(
                c.UsageExamples.Any(e => e.Contains("동물병원", StringComparison.Ordinal))
                && c.UsageExamples.Any(e => e.Contains("주식회사", StringComparison.Ordinal)),
                $"{c.Name}: {string.Join(" / ", c.UsageExamples)}");
        });
    }

    [Fact]
    public async Task Generate_CompositionParticle_FollowsWordBeforeParenthesis()
    {
        // 회귀: 조사를 결별로 고정해 '溫(따뜻함)를'·'채(집채)을'·'어미 -on를'처럼 고유 후보의
        // 51%가 틀렸다. 조사는 괄호 앞 말(뒷자리 재료)의 소리를 따른다.
        // 기대값은 엔진의 기준 함수(독음·음차)를 다시 부르지 않고 **이름 끝 음절의 받침**으로 계산한다 —
        // 뒷자리 재료는 늘 이름의 맨 끝에 오므로 소리로 들리는 마지막 받침이 곧 조사의 기준이다.
        var checkedCount = 0;
        foreach (var industry in CompanyNamingData.Industries.Keys)
        foreach (var tone in new[] { "modern", "classic", "warm" })
        {
            var result = await _engine.GenerateAsync(industry, NoKeywords, tone, "all", 0, 50);
            foreach (var c in result.Candidates)
            {
                var tail = c.Parts[1];
                var (_, _, lastFinal) = KoreanUtils.Decompose(c.Name[^1]);
                var particle = lastFinal.Length > 0 ? "을" : "를";
                var marker = c.Style == "english"
                    ? $"어미 {tail.Symbol}{particle} "
                    : $"{tail.Symbol}({tail.Meaning}){particle} ";

                Assert.True(c.Reasons[0].Contains(marker, StringComparison.Ordinal),
                    $"{c.Name}: \"{c.Reasons[0]}\" — 기대 \"{marker.Trim()}\"");
                checkedCount++;
            }
        }
        Assert.True(checkedCount > 1000);
    }

    [Fact]
    public async Task Generate_Meaning_DoesNotRepeatItself()
    {
        // 회귀: 영문 LIGHT 후보(루멘·솔라·루몬…)의 뜻이 전부 "빛처럼 빛나는 곳"이었다
        foreach (var industry in new[] { "beauty", "cafe", "fashion", "it" })
        {
            var result = await _engine.GenerateAsync(industry, NoKeywords, "premium", "english", 0, 50);
            Assert.NotEmpty(result.Candidates);
            foreach (var c in result.Candidates)
            {
                var words = c.Meaning.Split(' ');
                Assert.True(words.Length < 2 || words[0][0] != words[1][0], $"{c.Name}: {c.Meaning}");
            }
        }
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
            // 2026-10-21 감사 — 사전어(서림=책방·서각=공예·청실·승원=僧院)·고유명사(㈜서흥)
            ("曙", "林"), ("曙", "覺"), ("淸", "實"), ("承", "原"), ("曙", "興"),
            // 2026-10-21 검토 BCF-4 — 承原을 빼자 올라온 覺原(각원 = 各員, 사전어)
            ("覺", "原"),
        };

        foreach (var pair in removed)
            Assert.DoesNotContain(pair, CompanyNamingData.HanjaPairs);
    }

    // ============================================================
    // 순우리말 결합 경계 — 쓴 대로 읽혀야 한다
    // ============================================================

    /// <summary>
    /// 받침과 다음 초성이 만나 표기와 소리가 갈라지는지 — 엔진과 따로 쓴 판정기(명세 수준).
    /// 비음화(ㄱ·ㄷ·ㅂ 계열 받침 + ㄴ·ㅁ) / 유음화(ㄹ+ㄴ, ㄴ+ㄹ) / ㄹ 비음화(ㄹ 외 받침 + ㄹ) / 겹받침.
    /// rootTailJoin이면 실질 형태소끼리의 경계라 연음 두 규칙을 더 본다 — 대표음 연음(제15항,
    /// ㅅ·ㅆ·ㅈ·ㅊ·ㅋ·ㅌ·ㅍ·ㅎ·ㄲ + ㅇ: 볕우리→[벼두리])와 ㄴ첨가(제29항, 받침 + 이·야·여·요·유).
    /// 어근 안 경계(맺음→[매즘])는 접미사 연음이라 표기대로 넘어가므로 rootTailJoin=false로 본다.
    /// 이 판정기의 규칙이 맞는지는 아래 사례표(SoundChangeCases)가 발음 자모로 따로 확인한다.
    /// </summary>
    private static string? JoinShift(char front, char back, bool rootTailJoin = true)
    {
        var (_, _, final) = KoreanUtils.Decompose(front);
        var (initial, vowel, _) = KoreanUtils.Decompose(back);
        if (string.IsNullOrEmpty(final)) return null;

        if (final.Length == 1 && "ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ".Contains(final[0])) return "겹받침";
        if ("ㄱㄲㅋㄷㅅㅆㅈㅊㅌㅎㅂㅍ".Contains(final[0]) && (initial == "ㄴ" || initial == "ㅁ")) return "비음화";
        if (final == "ㄹ" && initial == "ㄴ") return "유음화";
        if (initial == "ㄹ" && final != "ㄹ") return final == "ㄴ" ? "유음화" : "ㄹ 비음화";
        if (rootTailJoin && initial == "ㅇ")
        {
            if ("ㅅㅆㅈㅊㅋㅌㅍㅎㄲ".Contains(final[0])) return "대표음 연음";
            if ("ㅣㅑㅕㅛㅠ".Contains(vowel[0])) return "ㄴ첨가";
        }
        return null;
    }

    /// <summary>
    /// 표준발음법 조항별 사례표 — (앞 재료, 뒤 재료, 표준 발음, 표기대로 읽히는가, 조항).
    /// 엔진·판정기와 독립인 기준이다. '표기대로 읽힌다'는 발음을 자모로 풀어 쓴 글자의 자모와
    /// 같다는 뜻이다(음절 경계만 옮겨 가는 단순 연음). 겹받침은 모음 앞 연음이 자모로는 같아도
    /// 들은 소리로 표기를 복원할 수 없어(삶온→[살몬]을 들으면 '살몬'으로 적는다) 늘 막는 정책이라 따로 표시한다.
    /// </summary>
    public static IEnumerable<object[]> SoundChangeCases => new[]
    {
        //            앞      뒤      발음        표기대로  조항
        new object[] { "볕", "누리", "변누리", false, "제18항 비음화" },
        new object[] { "곁", "마루", "견마루", false, "제18항 비음화" },
        new object[] { "첫", "마루", "천마루", false, "제18항 비음화" },
        new object[] { "결", "누리", "결루리", false, "제20항 유음화" },
        new object[] { "온", "림", "올림", false, "제20항 유음화" },
        new object[] { "담", "림", "담님", false, "제19항 ㄹ 비음화" },
        new object[] { "앎", "채", "암채", false, "제10·11항 겹받침" },
        new object[] { "삶", "온", "살몬", false, "제14항 겹받침 연음(정책상 차단)" },
        new object[] { "볕", "우리", "벼두리", false, "제15항 대표음 연음" },
        new object[] { "숲", "온", "수본", false, "제15항 대표음 연음" },
        new object[] { "첫", "우리", "처두리", false, "제15항 대표음 연음" },
        new object[] { "빛", "온", "비돈", false, "제15항 대표음 연음" },
        new object[] { "잎", "이음", "임니음", false, "제15·29항 ㄴ첨가" },
        new object[] { "담", "이음", "담니음", false, "제29항 ㄴ첨가" },
        new object[] { "솔", "잎", "솔립", false, "제29항 ㄴ첨가 + 유음화" },
        new object[] { "새김", "우리", "새기무리", true, "제13항 연음" },
        new object[] { "이삭", "온", "이사곤", true, "제13항 연음" },
        new object[] { "담", "온", "다몬", true, "제13항 연음" },
        new object[] { "결", "온", "겨론", true, "제13항 연음" },
        new object[] { "온", "담", "온담", true, "변동 없음" },
        new object[] { "고요", "담", "고요담", true, "받침 없음" },
    };

    /// <summary>음절을 자모 열로 — 초성 ㅇ은 소리가 없어 뺀다. 겹받침은 두 자음으로 푼다.</summary>
    private static string SpokenJamo(string text)
    {
        var doubles = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["ㄳ"] = "ㄱㅅ", ["ㄵ"] = "ㄴㅈ", ["ㄶ"] = "ㄴㅎ", ["ㄺ"] = "ㄹㄱ", ["ㄻ"] = "ㄹㅁ", ["ㄼ"] = "ㄹㅂ",
            ["ㄽ"] = "ㄹㅅ", ["ㄾ"] = "ㄹㅌ", ["ㄿ"] = "ㄹㅍ", ["ㅀ"] = "ㄹㅎ", ["ㅄ"] = "ㅂㅅ",
        };
        var sb = new System.Text.StringBuilder();
        foreach (var ch in text)
        {
            var (i, v, f) = KoreanUtils.Decompose(ch);
            if (i != "ㅇ") sb.Append(i);
            sb.Append(v);
            sb.Append(doubles.GetValueOrDefault(f, f));
        }
        return sb.ToString();
    }

    [Theory]
    [MemberData(nameof(SoundChangeCases))]
    public void SoundChangeCases_EngineJoinRuleAgrees(string front, string back, string spoken, bool readAsWritten, string clause)
    {
        // 사례표 자체의 일관성 — 겹받침이 아니면 '표기대로'는 발음 자모가 쓴 글자 자모와 같다는 뜻이다
        var (_, _, frontFinal) = KoreanUtils.Decompose(front[^1]);
        bool doubleFinal = "ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ".Contains(frontFinal.Length == 1 ? frontFinal[0] : ' ');
        if (!doubleFinal)
            Assert.Equal(readAsWritten, SpokenJamo(front + back) == SpokenJamo(spoken));

        // 엔진의 어근+어미 경계 판정이 사례표와 같아야 한다 — 명세에서 규칙이 빠지면 여기서 드러난다 (BC-1: 제15항 누락)
        Assert.True(CompanyNamingEngine.ShiftsAtRootTailJoin(front[^1], back[0]) == !readAsWritten,
            $"{front}+{back} → [{spoken}] ({clause}): 엔진 판정이 사례표와 다름");
        // 명세 판정기도 사례표와 같아야 한다 — 판정기가 엔진을 베낀 채 같이 틀리는 것을 막는다
        Assert.True((JoinShift(front[^1], back[0]) == null) == readAsWritten,
            $"{front}+{back} → [{spoken}] ({clause}): 테스트 판정기가 사례표와 다름");

        // 재료가 실제 데이터에 있으면 생성 결과로도 확인한다
        bool frontIsRoot = CompanyNamingData.Axes.Values.Any(a => a.Korean.Any(k => k.Text == front));
        bool backIsTail = CompanyNamingData.KoreanTailRoots.Any(t => t.Root.Text == back);
        if (!frontIsRoot || !backIsTail) return;

        var name = front + back;
        var pool = CompanyNamingEngine.EnumerateAllCandidates().Where(c => c.Style == "pure-korean");
        if (readAsWritten)
            Assert.Contains(pool, c => c.Name == name);
        else
            Assert.DoesNotContain(pool, c => c.Name == name);
    }

    /// <summary>
    /// 순우리말 합성의 결합 경계에서 소리가 바뀌면 안 된다 — 모든 축 어근 × 모든 어미 전수.
    ///
    /// 한자쌍은 '받침+ㄹ 금지'로 막았는데 순우리말은 a.Text + b.Text를 그대로 붙여서
    /// 볕누리[변누리]·결누리[결루리]·앎채[암채]가 상위 12위에 16회 나왔고, 추천 이유는
    /// "듣고 따라 부르기 좋아요"라고 말했다(2026-10-21 감사). 상호는 듣고 받아적는 이름이다.
    /// 어근 자체의 소리(넉넉→[넝넉])는 실재 단어라 표기를 복원할 수 있어 검사하지 않는다.
    /// </summary>
    [Fact]
    public void KoreanCompounds_NoNasalLiquidShift()
    {
        var pool = CompanyNamingEngine.EnumerateAllCandidates()
            .Where(c => c.Style == "pure-korean")
            .ToList();
        Assert.True(pool.Count > 500, $"순우리말 후보가 {pool.Count}개뿐 — 열거가 깨졌다");

        var violations = new List<string>();
        foreach (var c in pool)
        {
            var front = c.Parts[0].Symbol;
            var back = c.Parts[1].Symbol;
            var shift = JoinShift(front[^1], back[0]);
            if (shift != null) violations.Add($"{c.Name}({front}+{back}, {shift})");
        }

        Assert.True(violations.Count == 0,
            "결합 경계에서 표기와 소리가 갈라진다: " + string.Join(", ", violations));

        // 전수 열거가 데이터의 모든 조합을 실제로 훑었는지 — 걸러진 것 말고는 다 있어야 한다
        int expected = 0;
        foreach (var axis in CompanyNamingData.Axes.Values)
        foreach (var a in axis.Korean)
        foreach (var (b, _) in CompanyNamingData.KoreanTailRoots)
        {
            var name = a.Text + b.Text;
            if (a.Text == b.Text || name.Length is < 2 or > 4) continue;
            if (JoinShift(a.Text[^1], b.Text[0]) != null) continue;
            if (ForbiddenWordData.ContainsForbiddenWord(name) || CompanyNamingData.BlockedNames.Contains(name)) continue;
            Assert.Contains(pool, c => c.Name == name);
            expected++;
        }
        Assert.True(expected > 500);
    }

    [Theory]
    [InlineData("결")]   // 결누리 → [결루리]
    [InlineData("곁")]   // 곁누리 → [견누리]
    [InlineData("첫")]   // 첫마루 → [천마루]
    [InlineData("볕")]   // 볕누리 → [변누리], 볕우리 → [벼두리]
    [InlineData("앎")]   // 앎채 → [암채]
    [InlineData("숲")]   // 숲온 → [수본]
    [InlineData("빛")]   // 빛우리 → [비두리]
    public async Task Generate_KeywordRoot_NoNasalLiquidShift(string keyword)
    {
        // 키워드 어근도 같은 어미에 붙는다 — 입력칸 예시 '결'이 결누리를 3위에 올렸었다
        foreach (var tone in CompanyNamingData.Tones.Keys)
        {
            var result = await _engine.GenerateAsync("cafe", new[] { keyword }, tone, "pure-korean", 0, 50);
            foreach (var c in result.Candidates)
            {
                var shift = JoinShift(c.Parts[0].Symbol[^1], c.Parts[1].Symbol[0]);
                Assert.True(shift == null, $"{tone}: {c.Name} ({shift})");
            }
        }
    }

    [Fact]
    public async Task Generate_SoundShiftedName_NeverClaimsEasyListening()
    {
        // 표기와 소리가 갈라지는 이름에 "듣고 따라 부르기 좋아요"를 붙이면 거짓말이다
        foreach (var industry in CompanyNamingData.Industries.Keys)
        foreach (var tone in CompanyNamingData.Tones.Keys)
        {
            var result = await _engine.GenerateAsync(industry, NoKeywords, tone, "all", 0, 50);
            foreach (var c in result.Candidates)
            {
                // 순우리말 어근+어미 경계는 연음 규칙까지, 그 밖(어근 안·한자·영문)은 명세의 네 규칙만 본다
                int rootTail = c.Style == "pure-korean" ? c.Parts[0].Symbol.Length - 1 : -1;
                bool shifted = Enumerable.Range(0, c.Name.Length - 1)
                    .Any(i => JoinShift(c.Name[i], c.Name[i + 1], rootTailJoin: i == rootTail) != null);
                if (!shifted) continue;
                Assert.DoesNotContain(c.Reasons, r => r.Contains("듣고 따라", StringComparison.Ordinal));
                Assert.DoesNotContain(c.Reasons, r => r.Contains("리듬이 살아", StringComparison.Ordinal));
            }
        }
    }

    // ============================================================
    // 차단 표기 — 점수로는 못 거르는 연상 (2026-10-21 감사)
    // ============================================================

    [Fact]
    public async Task Generate_BlockedNames_NeverSurface()
    {
        // 카론(저승 뱃사공)이 동물병원 2위, 노타(같은 업종 상장사)가 IT 3위로 나왔었다
        var pool = CompanyNamingEngine.EnumerateAllCandidates();
        Assert.DoesNotContain(pool, c => CompanyNamingData.BlockedNames.Contains(c.Name));

        foreach (var industry in CompanyNamingData.Industries.Keys)
        foreach (var style in new[] { "all", "english" })
        {
            var result = await _engine.GenerateAsync(industry, NoKeywords, "warm", style, 0, 50);
            Assert.DoesNotContain(result.Candidates, c => CompanyNamingData.BlockedNames.Contains(c.Name));
        }
    }

    /// <summary>엔진의 라틴 결합 규칙을 명세대로 다시 쓴 것 — 모음+모음이면 어근 끝모음을 떨구고, 자음 접미는 모음 어근에만</summary>
    private static string? SpecJoinLatin(string root, string suffix)
    {
        bool rootVowel = "aeiou".Contains(root[^1]), suffixVowel = "aeiou".Contains(suffix[0]);
        if (suffixVowel) return rootVowel ? root[..^1] + suffix : root + suffix;
        return rootVowel ? root + suffix : null;
    }

    [Theory]
    [InlineData("온다")]   // onda — '오다'의 활용형. 카론·라곤을 막자 health/warm 14위로 올라와 '온다 의원'이 됐다
    [InlineData("온다나")] // onda + na — '온다나'(활용형)
    [InlineData("온도")]   // 溫度
    [InlineData("마라")]   // '~지 마라' · 마라탕
    [InlineData("솔로")]   // 혼자·싱글
    [InlineData("멘토")]   // 조언자
    [InlineData("메시아")] // 구세주
    [InlineData("메세나")] // 문화예술 후원 활동
    [InlineData("리본")]   // ribbon
    [InlineData("테라")]   // 맥주 상표 · 테라·루나 사태
    public void BlockedNames_ReviewedTransliterationsStayBlocked(string name)
    {
        // 2026-10-21 검토 BCF-4 — 차단한 자리에 같은 부류(한국어 활용형·사전어로 읽히는 음차)가 다음 순번으로 올라왔다.
        // 전수 덤프를 한 번 훑어 같은 부류를 함께 막았다. 데이터에서 실제로 만들어지는 표기여야 막을 의미가 있다.
        bool reachable = CompanyNamingData.Axes.Values.SelectMany(a => a.Latin)
            .Any(root => CompanyNamingData.LatinSuffixes.Any(s =>
                SpecJoinLatin(root.Text, s) is { } latin && RomanizationUtils.ToHangul(latin) == name));
        Assert.True(reachable, $"'{name}'은 라틴 어근 + 접미로 만들어지지 않는다 — 막을 필요가 없는 항목");

        Assert.Contains(name, CompanyNamingData.BlockedNames);
        Assert.DoesNotContain(CompanyNamingEngine.EnumerateAllCandidates(), c => c.Name == name);
    }

    [Fact]
    public async Task Generate_ReviewedSuccessors_DoNotSurfaceInReportedSlots()
    {
        // 검토에서 본 두 자리 — health/warm(온다), food/classic(각원 覺原)의 상위 30
        var health = await _engine.GenerateAsync("health", NoKeywords, "warm", "all", 0, 30);
        Assert.DoesNotContain(health.Candidates, c => c.Name == "온다");
        Assert.Equal(30, health.Candidates.Count);

        var food = await _engine.GenerateAsync("food", NoKeywords, "classic", "all", 0, 30);
        Assert.DoesNotContain(food.Candidates, c => c.Hanja == "覺原");
        Assert.Equal(30, food.Candidates.Count);
    }

    [Fact]
    public void LatinRoots_RetiredRootStaysRemoved()
    {
        // junta는 어근째 뺐다 — 파생형(준토·준타나)도 추천 이유에 "junta(모임)"를 노출했다
        Assert.DoesNotContain(CompanyNamingData.Axes.Values.SelectMany(a => a.Latin), l => l.Text == "junta");
        Assert.DoesNotContain(CompanyNamingEngine.EnumerateAllCandidates(),
            c => c.Parts.Any(p => p.Symbol == "junta"));
    }

    [Theory]
    [InlineData("새터")]
    [InlineData("새길")]
    [InlineData("곁채")]
    [InlineData("담채")]
    public void DictionaryCompounds_AreTreatedAsCommonNouns(string word)
    {
        // 어근 둘을 이었는데 사전어가 된 경우 — 식별력 만점(25/25)으로 상위에 올라왔었다
        Assert.Contains(CompanyNamingEngine.EnumerateAllCandidates(), c => c.Name == word);
        Assert.Contains(word, CompanyNamingData.BareCommonNouns);
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

    /// <summary>
    /// 차단 목록(BlockedNames) 검수용 전수 덤프 — 영문 조어는 몇백 개라 사람이 한 번 훑는 게 가장 싸다.
    /// `dotnet test --filter Dump_AllCoinagesForReview --logger "console;verbosity=detailed"`
    /// </summary>
    [Fact]
    public void Dump_AllCoinagesForReview()
    {
        var pool = CompanyNamingEngine.EnumerateAllCandidates();
        foreach (var group in pool.GroupBy(c => c.Style))
        {
            _output.WriteLine($"── {group.Key} {group.Count()}개 ──");
            _output.WriteLine(string.Join(" ", group.Select(c =>
                c.Style == "english" ? $"{c.Name}({c.Romanization})"
                : c.Hanja != null ? $"{c.Name}({c.Hanja})" : c.Name)));
        }
    }
}
