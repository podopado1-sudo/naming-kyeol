using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 부모 기반 엔진 1차 검증(2026-10-28)이 찾은 문제의 회귀 — 성별을 보지 않는 배너·부모 글자 조합, 입력이 적을 때 0개, 동음 훈의 거짓 뜻 설명,
/// 짝 글자 훈 인용, 키워드 소리 그대로의 첫 카드·명사형 어미 소리, 낯선 글자 폴백, 아이 성 메아리.
/// 기대값은 엔진 함수가 아니라 테스트 안에서 따로 정한다: 성별 기움은 출생 통계 원자료(NameGenderData.NameCounts)와 0.70 기준(standard 탭 GenderNote 와 같은 값)으로,
/// 뜻이 다른 글자·그 훈은 손으로 적은 글자 표와 사전 원문(HanjaData.Meaning)으로.
/// </summary>
public class ParentBasedVerificationFixTests
{
    private static readonly DateTime Birth = new(2024, 3, 15);
    private readonly ParentBasedNamingEngine _engine = new(new NamePoolEngine(new FakeSajuCalculationService()), new NameReversalEngine());

    /// <summary>요청 성별과 반대 성별의 출생 비율이 0.70 이상인 실명(20명 이상) — 테스트가 원자료에서 따로 센다</summary>
    private static bool LeansOpposite(string name, string gender)
    {
        if (gender is not ("male" or "female")) return false;
        var c = NameGenderData.NameCounts(name, 20);
        if (c == null) return false;
        double total = c.Value.m + c.Value.f;
        return (gender == "male" ? c.Value.f : c.Value.m) / total >= 0.70;
    }

    private static string OppositeNote(string gender) => gender == "male" ? "주로 여자 이름" : "주로 남자 이름";

    /// <summary>사전 원문의 훈 조각("밟을 리(이)/신 리(이)" → 밟을 리(이), 신 리(이))</summary>
    private static IEnumerable<string> Segments(string ch)
        => (HanjaData.FindByCharacter(ch)?.Meaning ?? "").Split(',', '/', ';', '·').Select(s => s.Trim()).Where(s => s.Length > 0);

    // ═══════════════════════════════════════════════════════════════
    // 성별 — 배너·부모 글자 조합·키워드 이름
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("김", "김", "민수", "이", "서연", "male", "수민")]   // 검증: 남아 + 김민수/이서연 → '수민'(남 3,367·여 12,908)
    [InlineData("박", "박", "지훈", "최", "지은", "male", "은지")]   // '은지'(남 2·여 5,545)
    [InlineData("이", "이", "영호", "김", "미영", "female", "호영")] // '호영'(남 1,814·여 87)
    public async Task GenderGiven_BannerIsNotOppositeGenderName(string lastName, string fs, string fn, string ms, string mn, string gender, string oldBanner)
    {
        // 옛 배너는 유행 여부·빈도만 봐 남아 요청 배너의 68% 가 여자 이름이었다. 옛 배너 이름이 정말 반대 성별인지 원자료로 먼저 확인한다
        Assert.True(LeansOpposite(oldBanner, gender), $"{oldBanner} 는 {gender} 반대 성별 이름이어야 사례가 성립한다");
        var result = await _engine.GenerateCandidatesAsync(lastName, fs, fn, ms, mn, null, Birth, gender, "neutral");
        Assert.True(result.Count >= 5);
        Assert.NotEqual(oldBanner, result[0].Name);
        Assert.False(LeansOpposite(result[0].Name, gender), $"배너 '{result[0].Name}'");
    }

    [Theory]
    [InlineData("김", "김", "민수", "이", "서연", null, "male")]
    [InlineData("김", "김", "민수", "이", "서연", null, "female")]
    [InlineData("박", "박", "지훈", "최", "지은", null, "male")]
    [InlineData("최", "최", "준호", "박", "수진", null, "female")]
    [InlineData("김", "김", "영철", "한", "순자", null, "male")]   // 검증: 현실 입력 '자영' 108실행
    [InlineData("김", "김", "태희", "오", "미나", null, "male")]   // '나희'
    [InlineData("김", null, null, null, null, "사랑", "male")]      // 키워드 소리 '사랑'(여 쏠림)
    [InlineData("김", null, null, null, null, "신의 손", "male")]   // 키워드 뜻 두 자 '수빈'
    public async Task GenderGiven_NoOppositeGenderNameInList(string lastName, string? fs, string? fn, string? ms, string? mn, string? kw, string gender)
    {
        // 5개 이상 모이는 입력에서는 반대 성별로 기우는 실명이 목록 어디에도 없다(마지막 예비 목록으로만 간다)
        var result = await _engine.GenerateCandidatesAsync(lastName, fs, fn, ms, mn, kw, Birth, gender, "neutral");
        Assert.True(result.Count >= 5, $"후보 {result.Count}개");
        Assert.All(result, c => Assert.False(LeansOpposite(c.Name, gender), $"{c.Name} [{c.NamingModel}]"));
    }

    // ═══════════════════════════════════════════════════════════════
    // 입력이 적을 때 0개 — 예비 경로
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("김", null, null, null, null, "봄", "none")]      // 검증: 봄·숲·햇님은 성·성별과 무관하게 늘 0개
    [InlineData("김", null, null, null, null, "숲", "male")]
    [InlineData("김", null, null, null, null, "햇님", "none")]
    [InlineData("김", null, null, null, null, "꿈", "none")]
    [InlineData("김", null, null, null, null, "꽃", "female")]
    [InlineData("남궁", null, null, null, null, "봄", "none")]    // 복성 아이 — 성씨 뜻 잇기가 대표 한자 한 글자일 때만 돌았다
    [InlineData("김", "김", "병철", null, null, null, "none")]     // 아버지만 '병철' — 세 성별 모두 0개('병'은 부정 음절)
    [InlineData("김", "김", "병철", null, null, null, "female")]
    [InlineData("김", "김", "철", null, null, null, "female")]     // 외자 '철' + 딸
    [InlineData("김", "김", "식", null, null, null, "none")]       // '식'은 첫 자리 실명이 없다
    [InlineData("김", "김", "춘", null, null, null, "none")]
    [InlineData("김", null, null, "김", "숙", null, "male")]       // 어머니만 '숙' + 아들
    public async Task FewInputs_ReservePaths_FiveOrMore(string lastName, string? fs, string? fn, string? ms, string? mn, string? kw, string gender)
    {
        var result = await _engine.GenerateCandidatesAsync(lastName, fs, fn, ms, mn, kw, Birth, gender, "neutral");
        Assert.True(result.Count >= 5, $"후보 {result.Count}개");
        Assert.Equal(result.Count, result.Select(c => c.Name).Distinct().Count());
        Assert.All(result, c =>
        {
            Assert.Equal(2, c.Name.Length);
            Assert.NotEqual(lastName[^1], c.Name[0]);
            Assert.False(ForbiddenWordData.ContainsForbiddenWord(c.Name), c.Name);
            Assert.False(string.IsNullOrEmpty(c.NamingLabel));
        });
        // 반대 성별로 기우는 이름은 마지막 자리에만, 설명 끝에 성별 안내를 단다(standard 탭 GenderNote 와 같은 말)
        var leaning = result.Select((c, i) => (c, i)).Where(x => LeansOpposite(x.c.Name, gender)).ToList();
        if (leaning.Count > 0)
        {
            var lastPlain = result.Select((c, i) => (c, i)).Where(x => !LeansOpposite(x.c.Name, gender)).Select(x => x.i).DefaultIfEmpty(-1).Max();
            Assert.All(leaning, x =>
            {
                Assert.True(x.i > lastPlain, $"{x.c.Name} 가 성별에 맞는 이름보다 앞에 있다");
                Assert.EndsWith(OppositeNote(gender), x.c.Description);
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 동음 훈 — 낱말이 같고 뜻이 다른 글자
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("신의 손", "履賓")]   // 검증 P14 첫 카드 63/63: 이빈 履賓('신 리'=신발, '손 빈'=손님)·수빈 手賓
    [InlineData("겸손", "手賓")]      // 뜻 표 키 '손'이 '겸손' 안에 들어 있어 手·賓 '손'을 끌어왔다
    [InlineData("달", "注懸甘")]      // 주현 注懸('주 달 주'·'달 현'=매달다), 甘 '달 감'(달다)
    [InlineData("하늘", "倡")]        // 관용구 '푸른 하늘'의 뜻 '광대'(넓고 큼) → 倡 '광대 창'(어릿광대)
    [InlineData("비", "彗")]          // 彗 '비 혜'(빗자루)
    [InlineData("빛", "色")]          // 色 '빛 색'(빛깔)
    public async Task Keyword_HomonymGloss_NotUsed(string keyword, string wrongChars)
    {
        foreach (var gender in new[] { "none", "male", "female" })
        {
            var result = await _engine.GenerateCandidatesAsync("김", null, null, null, null, keyword, Birth, gender, "neutral");
            Assert.NotEmpty(result);
            foreach (var ch in wrongChars.Select(c => c.ToString()))
            {
                Assert.DoesNotContain(result, c => c.Hanja != null && c.Hanja.Contains(ch));
                foreach (var seg in Segments(ch))
                    Assert.DoesNotContain(result, c => c.Description.Contains($"'{seg}'") || c.Description.Contains($"({seg})"));
            }
        }
    }

    [Fact]
    public async Task Keyword_HandOfGod_FirstCardQuotesHand()
    {
        // '신의 손' 첫 카드는 手 '손 수'를 품는다(神 '귀신 신'은 불용 글자라 쓰지 않는다 — 옛 첫 카드 신영(검증 전)·이빈 履賓(검증))
        var hand = Segments("手").Single(s => s.StartsWith("손"));
        var result = await _engine.GenerateCandidatesAsync("김", null, null, null, null, "신의 손", Birth, "none", "neutral");
        Assert.Contains($"'{hand}'", result[0].Description);
        Assert.Contains('수', result[0].Name);
    }

    [Theory]
    [InlineData("석", "廻巡循旋還島")] // 石 '돌 석'의 '돌'이 廻 '돌 회'(돌다)를, '섬 석'(되 단위)이 島 '섬 도'를 끌어왔다(석회린 — API 전용 경로)
    [InlineData("마", "斗詞勿")]      // 馬 '말 마' → 斗 '말 두'·詞 '말 사'·勿 '말 물'
    [InlineData("빈", "手")]          // 賓 '손 빈'(손님) → 手 '손 수'
    public async Task SurnameMeaning_HomonymGloss_NotUsed(string lastName, string wrongChars)
    {
        var result = await _engine.GenerateCandidatesAsync(lastName, null, null, null, null, null, Birth, "none", "neutral");
        foreach (var ch in wrongChars.Select(c => c.ToString()))
        foreach (var seg in Segments(ch))
            Assert.DoesNotContain(result, c => c.Description.Contains($"({seg})"));
    }

    // ═══════════════════════════════════════════════════════════════
    // 설명·순서
    // ═══════════════════════════════════════════════════════════════

    public static IEnumerable<object?[]> MixedInputs() => new[]
    {
        new object?[] { "김", "김", "민수", "이", "서연", null, "none" },
        new object?[] { "박", "박", "지훈", "최", "지은", null, "male" },
        new object?[] { "정", "정", "성민", "윤", "하은", null, "female" },
        new object?[] { "김", "김", "민준", "김", "민지", null, "none" },
        new object?[] { "김", null, null, null, null, "사랑", "none" },
        new object?[] { "김", null, null, null, null, "희망", "female" },
        new object?[] { "김", null, null, null, null, null, "none" },
        new object?[] { "이", null, null, null, null, null, "male" },
        new object?[] { "유", "유", "진우", "김", "서진", null, "none" },
        new object?[] { "이", "이", "준서", "박", "하은", null, "female" },
        new object?[] { "성", "성", "민호", "김", "지원", null, "male" },
    };

    [Theory]
    [MemberData(nameof(MixedInputs))]
    public async Task PartnerSyllable_GlossNotQuoted_SurnameEchoLast(string lastName, string? fs, string? fn, string? ms, string? mn, string? kw, string gender)
    {
        var result = await _engine.GenerateCandidatesAsync(lastName, fs, fn, ms, mn, kw, Birth, gender, "neutral");
        Assert.NotEmpty(result);
        // 실명 짝 글자는 소리만 인용한다 — 옛 설명은 '…에 '누'(여러 루(누))를 더한'처럼 짝 글자 훈('여러 루(누)'·'거느릴 솔'·'바꿀 태' — 격자 인용의 12.4%)을
        // 뜻처럼 내세웠다. 짝 글자는 늘 '…에 'X'를 더한' 또는 '앞에 'X'를 둔' 자리에 온다
        Assert.All(result, c => Assert.DoesNotMatch(@"에 '[가-힣]'\(", c.Description));
        // 짝 글자를 더한 후보(키워드·성씨 뜻 한 자 + 짝)는 Hanja 를 비운다 — 풀이하지 않은 짝 글자 한자를 보이지 않는다
        Assert.All(result.Where(c => c.Description.Contains("더한 이름") || c.Description.Contains("둔 이름")), c => Assert.Null(c.Hanja));
        // 끝 음절이 외자 아이 성과 같은 이름(유 + 진유 = '유진유')은 뒤로
        if (lastName.Length == 1)
        {
            var echo = result.Select((c, i) => (c, i)).Where(x => x.c.Name[1] == lastName[0]).Select(x => x.i).ToList();
            var plain = result.Select((c, i) => (c, i)).Where(x => x.c.Name[1] != lastName[0]).Select(x => x.i).ToList();
            if (echo.Count > 0 && plain.Count > 0) Assert.True(echo.Min() > plain.Max(), string.Join(",", result.Select(c => c.Name)));
        }
        // 실명이어도 생활 낱말로 읽히는 이름(손으로 적은 표 — 서민 21명은 민수/서연의 둘째 카드였다)은 나오지 않는다
        foreach (var word in new[] { "서민", "승리", "우리", "총명", "지양", "양자" })
            Assert.DoesNotContain(result, c => c.Name == word);
    }

    [Theory]
    [InlineData("하늘")]
    [InlineData("사랑")]
    [InlineData("슬기")]
    [InlineData("새벽")]
    [InlineData("노을")]
    public async Task Keyword_SoundAsIs_NotFirstCard(string keyword)
    {
        // 옛 순서는 키워드 소리 그대로를 맨 앞에 둬 김행복·김보석·김태양·김성실이 첫 카드였다 — 뜻 잇기 후보가 있으면 그것이 먼저
        var result = await _engine.GenerateCandidatesAsync("김", null, null, null, null, keyword, Birth, "none", "neutral");
        Assert.NotEmpty(result);
        if (result.Any(c => c.NamingModel == ParentNamingModels.KeywordMeaning))
            Assert.Equal(ParentNamingModels.KeywordMeaning, result[0].NamingModel);
        Assert.NotEqual(keyword, result[0].Name);
    }

    [Theory]
    [InlineData("밝음", "음")]   // 옛 폴백: '음' 소리 → 예음
    [InlineData("따뜻함", "함")] // '함' 소리 → 다함
    [InlineData("씩씩함", "함")]
    [InlineData("푸름", "름")]   // '름' 소리 → 여름
    public async Task Keyword_NominalEnding_NotUsedAsSound(string keyword, string ending)
    {
        var result = await _engine.GenerateCandidatesAsync("김", null, null, null, null, keyword, Birth, "none", "neutral");
        Assert.DoesNotContain(result, c => c.Description.Contains($"'{ending}' 소리"));
    }

    [Theory]
    [InlineData("튼튼")]   // 옛 폴백은 낯선 글자 獜駉 으로 첫 카드를 메웠다
    [InlineData("사랑")]
    [InlineData("바다")]
    [InlineData("희망")]
    public async Task Keyword_HanjaAreFamiliar(string keyword)
    {
        // 키워드 뜻 한자는 인명 빈출(CommonNameHanja)이나 Core 검수 글자만 — 그런 글자가 없으면 건너뛴다
        var result = await _engine.GenerateCandidatesAsync("김", null, null, null, null, keyword, Birth, "none", "neutral");
        foreach (var c in result.Where(c => c.Hanja != null))
        foreach (var ch in c.Hanja!.Select(x => x.ToString()))
        {
            var h = HanjaData.FindByCharacter(ch)!;
            Assert.True(h.Source == "Core_v1" || HanjaData.IsCommonNameHanja(ch), $"{c.Name} {c.Hanja}: {ch}");
        }
    }

    [Fact]
    public void LegacyKeywordModel_ReadsAsNoLabel()
    {
        // 옛 '신해솜모델'은 키워드 경로와 키워드 없는 성씨 자동 경로가 함께 썼다 — '키워드 뜻 잇기'로 읽으면 성씨 자동 후보에 거짓 라벨이 붙는다
        Assert.Null(ParentNamingModels.Normalize("신해솜모델"));
        Assert.Null(ParentNamingModels.LabelFor("신해솜모델"));
        Assert.Equal(ParentNamingModels.MotherSurname, ParentNamingModels.Normalize("윤고은모델"));
    }
}
