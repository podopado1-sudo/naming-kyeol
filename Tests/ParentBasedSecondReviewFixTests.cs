using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Services;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 부모 기반 엔진 2차 검증(2026-10-28)이 찾은 문제의 회귀 — 성 칸 없이 전체 이름을 넣은 엔진 직접 호출의 부모 이름 그대로,
/// 키워드만 준 입력의 0개·5개 미만과 키워드와 무관한 첫 카드, 부모 이름 뜻 잇기 카드 한자 ↔ /evaluate 배정 불일치, 키워드 카드의 약자,
/// 비실명 부모 글자 조합의 반대 성별, 낱말 이름·옛 세대 '-자' 이름, 복성·두음 꼴 메아리, 유행 이름 순서.
/// 기대값은 엔진 함수가 아니라 테스트 안에서 따로 정한다: 부모 이름은 손으로 나눈 표, 실명·성별 기움은 출생 통계 원자료(NameGenderData.NameCounts)와
/// 0.70 기준, /evaluate 배정은 ScoringService(평가 화면이 부르는 경로), 약자·유행 이름은 데이터 목록(HanjaData·AestheticEngine.IsTrendyName),
/// 두음 꼴은 손으로 적은 표.
/// </summary>
public class ParentBasedSecondReviewFixTests
{
    private static readonly DateTime Birth = new(2024, 3, 15);
    private readonly ParentBasedNamingEngine _engine = new(new NamePoolEngine(new FakeSajuCalculationService()), new NameReversalEngine());

    private static bool LeansOpposite(string name, string gender)
    {
        if (gender is not ("male" or "female")) return false;
        var c = NameGenderData.NameCounts(name, 20);
        if (c == null) return false;
        double total = c.Value.m + c.Value.f;
        return (gender == "male" ? c.Value.f : c.Value.m) / total >= 0.70;
    }

    // ═══════════════════════════════════════════════════════════════
    // 성 칸 없이 전체 이름 — 거르기에만 나눈 이름을 쓴다(생성은 그대로)
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    // 아이 성, 아버지 이름 칸, 어머니 이름 칸, 손으로 나눈 부모 이름(성 제외)·부모 전체 이름
    [InlineData("김", "김민수", "이서연", "민수,서연", "김민수,이서연")]
    [InlineData("박", "박지훈", null, "지훈", "박지훈")]        // 2차 검증: 첫 카드 '지훈' 42/63실행, 박 + 지훈 = 아버지 전체 이름
    [InlineData("김", "김철수", "이영희", "철수,영희", "김철수,이영희")]
    [InlineData("최", "남궁민수", "선우서연", "민수,서연", "남궁민수,선우서연")]
    public async Task FullNameInNameField_NoParentNameOrParentFullName(string lastName, string? father, string? mother, string givens, string fulls)
    {
        // POST /parent-based·POST /recommendations 를 성 칸 없이 부른 경우 — 엔진은 이름을 나누지 않으므로(한울림 보호) 옛 거르기는 '김민수' 전체와만
        // 비교해 '민수'·'지훈'이 그대로 후보로 나왔다(2차 검증 엔진 직접 격자 252실행: 부모 이름과 같은 후보 174건, 첫 카드 63실행)
        var result = await _engine.GenerateCandidatesAsync(lastName, null, father, null, mother, null, Birth, "none", "neutral");
        Assert.NotEmpty(result);
        var parentGivens = givens.Split(',');
        var parentFulls = fulls.Split(',');
        Assert.All(result, c =>
        {
            Assert.DoesNotContain(c.Name, parentGivens);
            Assert.DoesNotContain(lastName + c.Name, parentFulls);
        });
    }

    [Fact]
    public async Task FullNameInNameField_GenderedRequests_NoParentName()
    {
        foreach (var g in new[] { "none", "male", "female" })
        {
            var result = await _engine.GenerateCandidatesAsync("김", null, "김민수", null, "이서연", null, Birth, g, "neutral");
            Assert.DoesNotContain(result, c => c.Name is "민수" or "서연");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 키워드만 — 5개 이상, 첫 카드는 키워드에서
    // ═══════════════════════════════════════════════════════════════

    public static IEnumerable<object[]> KeywordGrid()
    {
        // 2차 검증 0개 사례(봄: 제갈 3·선우 남 / 꽃: 제갈 남·선우 남 / 꿈: 제갈 여 / 축복: 제갈 여)와 흔한 성 + 여아(봄·꿈·축복 카드 1장 — '부용')
        foreach (var kw in new[] { "봄", "꽃", "꿈", "축복", "별" })
        foreach (var ln in new[] { "김", "이", "박", "제갈", "선우" })
        foreach (var g in new[] { "none", "male", "female" })
            yield return new object[] { kw, ln, g };
    }

    [Theory]
    [MemberData(nameof(KeywordGrid))]
    public async Task KeywordOnly_FiveOrMore_FirstCardFromKeyword(string keyword, string lastName, string gender)
    {
        var result = await _engine.GenerateCandidatesAsync(lastName, null, null, null, null, keyword, Birth, gender, "neutral");
        Assert.True(result.Count >= 5, $"{lastName} + {gender} + '{keyword}' → {result.Count}개");
        // 첫 카드가 키워드와 무관한 성씨 뜻 잇기였다(김 + 봄 → 철민 '쇠', 2차 검증 '봄' 94/2,040실행) — 키워드 방식이어야 하고 설명이 키워드를 인용한다
        Assert.True(result[0].NamingModel is ParentNamingModels.KeywordMeaning or ParentNamingModels.KeywordSound,
            $"{lastName} + {gender} + '{keyword}' 첫 카드 {result[0].Name} [{result[0].NamingModel}]");
        Assert.Contains($"'{keyword}'", result[0].Description);
    }

    [Theory]
    [InlineData("봄")]
    [InlineData("꿈")]
    [InlineData("축복")]
    public async Task KeywordOnly_KimFemale_SameGenderKeywordNamesBeforeSurnameMeaning(string keyword)
    {
        // 김 + 여아 + 봄·꿈·축복은 카드가 '부용'(성씨 '김'의 뜻 '쇠') 한 장뿐이었다 — 키워드 이름이 성씨 뜻보다 앞, 앞 5장은 반대 성별이 아니다
        var result = await _engine.GenerateCandidatesAsync("김", null, null, null, null, keyword, Birth, "female", "neutral");
        Assert.True(result.Count >= 5);
        Assert.All(result.Take(5), c =>
        {
            Assert.NotEqual(ParentNamingModels.SurnameMeaning, c.NamingModel);
            Assert.False(LeansOpposite(c.Name, "female"), c.Name);
            Assert.NotNull(NameGenderData.NameCounts(c.Name, 20)); // 실명
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // 부모 이름 뜻 잇기 카드 한자 = /evaluate 배정
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("김", "김", "민수", "이", "서연")]
    [InlineData("박", "박", "지훈", "최", "지은")]
    [InlineData("정", "정", "성민", "윤", "하은")]
    [InlineData("이", "이", "영호", "김", "미영")]
    public async Task FamilyMeaning_CardHanja_SameAsEvaluateAssignedHanja(string lastName, string fs, string fn, string ms, string mn)
    {
        // 2차 검증: 격자 상위 10의 Hanja 카드 1,132장 중 904장(80%)이 '이 이름 평가하기'의 /evaluate 배정과 달랐다 — 부모 이름 뜻 잇기 글자를
        // 용신 없이 골라서. 엔진에 사주·용신 서비스를 주입하면(DI 와 같음) 같은 (이름, 출생일, 시각, 성별)의 ScoringService.AssignedHanja 와 같아야 한다
        var saju = new SajuCalculationService();
        var yong = new YongshinCalculationService();
        var engine = new ParentBasedNamingEngine(new NamePoolEngine(saju), new NameReversalEngine(), saju, yong);
        var scoring = new ScoringService(new AestheticEngine(), new HarmonyEngine(saju, yong), new RarityScoringEngine());
        int checkedCards = 0;
        foreach (var birth in new[] { new DateTime(2024, 3, 15), new DateTime(2021, 7, 8) })
        foreach (TimeSpan? time in new TimeSpan?[] { null, new TimeSpan(9, 30, 0) })
        foreach (var g in new[] { "none", "male", "female" })
        {
            var result = await engine.GenerateCandidatesAsync(lastName, fs, fn, ms, mn, null, birth, g, "neutral", time);
            foreach (var c in result.Where(c => c.NamingModel == ParentNamingModels.FamilyMeaning))
            {
                var eval = await scoring.EvaluateAsync(c.Name, lastName, birth, g, "neutral", time);
                var expected = string.Concat(eval.AssignedHanja.Select(h => h?.Character ?? "?"));
                Assert.Equal(expected, c.Hanja);
                // 설명은 그 글자의 그 독음 훈을 인용한다(사전 원문에서 따로 확인)
                for (int i = 0; i < c.Name.Length; i++)
                {
                    var info = HanjaData.FindByCharacter(c.Hanja![i].ToString())!;
                    var gloss = HanjaData.GlossForReading(info.Meaning, c.Name[i].ToString());
                    Assert.Contains($"'{gloss}'", c.Description);
                }
                checkedCards++;
            }
        }
        Assert.True(checkedCards > 0, "부모 이름 뜻 잇기 후보가 하나는 있어야 사례가 성립한다");
    }

    // ═══════════════════════════════════════════════════════════════
    // 키워드 카드 한자에 약자 없음
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("예술")]
    [InlineData("사랑")]
    [InlineData("희망")]
    [InlineData("지혜")]
    [InlineData("별")]
    [InlineData("꽃")]
    public async Task KeywordCards_HanjaHasNoWeakCharacter(string keyword)
    {
        // 2차 검증: '예술' → 민휴 玟烋(烋 weak)·민구 玟球(球 weak '공 구') 64장 — 약자는 정렬에서만 뒤로 가서 음절에 대안이 없으면 남았다
        foreach (var g in new[] { "none", "male", "female" })
        foreach (var ln in new[] { "김", "이", "박" })
        {
            var result = await _engine.GenerateCandidatesAsync(ln, null, null, null, null, keyword, Birth, g, "neutral");
            foreach (var c in result.Where(c => c.Hanja != null))
                Assert.DoesNotContain(c.Hanja!, ch => HanjaData.IsWeakGivenNameHanja(ch.ToString()));
        }
    }

    [Fact]
    public async Task Art_NoBeautifulStoneOrJadeAsArtMeaning()
    {
        // '예술'의 옛 뜻 표 낱말 '아름답다'가 玟 '아름다운 돌'·瑤·琪 '아름다운 옥'을 '예술의 뜻'이라 적었다 — 뜻 표는 藝 '재주 예'의 '재주'로
        var result = await _engine.GenerateCandidatesAsync("김", null, null, null, null, "예술", Birth, "none", "neutral");
        Assert.True(result.Count >= 5);
        Assert.DoesNotContain(result, c => c.Description.Contains("아름다운"));
    }

    // ═══════════════════════════════════════════════════════════════
    // 비실명 부모 글자 조합의 반대 성별
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task FatherOnly_Daughter_FirstCardRealAndNotOppositeGender()
    {
        // 김 아이 + 아버지 '광식' + 딸 → 첫 카드 '식광'(실명 아님·주로 남자 이름, 성별 안내 없음) — 비실명 조각도 반대 성별이면 마지막 예비 목록으로
        var result = await _engine.GenerateCandidatesAsync("김", "김", "광식", null, null, null, Birth, "female", "neutral");
        Assert.NotEmpty(result);
        Assert.NotNull(NameGenderData.NameCounts(result[0].Name, 20));
        Assert.False(LeansOpposite(result[0].Name, "female"), result[0].Name);
        Assert.Null(NamingPrinciples.GenderLeanLabel(result[0].Name, "female"));
        // 반대 성별로 읽히는 이름은 남아 있어도 설명 끝에 안내가 붙는다
        Assert.All(result.Where(c => NamingPrinciples.GenderLeanLabel(c.Name, "female") != null),
            c => Assert.EndsWith("주로 남자 이름", c.Description));
    }

    // ═══════════════════════════════════════════════════════════════
    // 낱말 이름·옛 세대 '-자' 이름
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("김", "사랑", "female")]  // 慈 '사랑 자' 짝 — 영자·경자·정자·순자·명자
    [InlineData("박", "사랑", "none")]
    [InlineData("이", "하늘", "female")]  // '천하'(天下) 11~12번째
    [InlineData("김", "기쁨", "none")]
    public async Task KeywordOnly_NoWordNamesOrOldGenerationJaNames(string lastName, string keyword, string gender)
    {
        // 손으로 고른 낱말 이름(2차 검증 덤프 — 실명이지만 생활 낱말·소망형 추상명사)
        var words = new HashSet<string> { "천하", "환희", "은총", "신비", "영광", "영웅", "진리", "희소", "이환", "이산", "이완", "소중", "찬양", "성경" };
        var result = await _engine.GenerateCandidatesAsync(lastName, null, null, null, null, keyword, Birth, gender, "neutral");
        Assert.True(result.Count >= 5);
        Assert.DoesNotContain(result, c => words.Contains(c.Name));
        Assert.DoesNotContain(result, c => c.Name.EndsWith('자'));
    }

    [Theory]
    [InlineData("김", "천하", "word-name")]     // 天下 — 실명 21명, 키워드 '하늘' + 딸 11~12번째
    [InlineData("김", "환희", "word-name")]
    [InlineData("박", "경리", "word-name")]     // 박 + 경리 = 소설가 이름
    [InlineData("한", "희소", "word-name")]     // 稀少 — 한소희 어머니 + 딸의 첫 카드
    [InlineData("김", "이환", "word-name")]     // 罹患
    [InlineData("김", "영자", "old-generation")] // 옛 세대 '-자(子)' 여자 이름 꼴
    [InlineData("김", "정자", "old-generation")] // 精子 동음이기도 하다
    [InlineData("김", "자윤", null)]            // '자'가 첫 음절이면 그대로
    [InlineData("제갈", "제윤", "child-surname")] // 복성 첫 음절 메아리(제갈제윤 — 옛 규칙은 끝 음절 '갈'만 봤다)
    [InlineData("남궁", "남윤", "child-surname")]
    [InlineData("선우", "선영", "child-surname")]
    [InlineData("선우", "우진", "child-surname")] // 끝 음절은 전부터
    public void QualityRejectReason_SecondReviewCases(string lastName, string name, string? expected)
    {
        Assert.Equal(expected, ParentBasedNamingEngine.QualityRejectReason(name, lastName, Array.Empty<string>(), Array.Empty<string>()));
    }

    // ═══════════════════════════════════════════════════════════════
    // 순서 — 유행 이름·두음 꼴 메아리는 뒤로
    // ═══════════════════════════════════════════════════════════════

    // 외자 성 → 그 성의 두음 꼴(손으로 적은 표)
    private static readonly Dictionary<string, char> Dueum = new() { ["이"] = '리', ["임"] = '림', ["유"] = '류', ["노"] = '로', ["류"] = '유' };

    [Theory]
    [InlineData("김", "김", "민수", "이", "서연")]   // 부모 첫 글자 잇기 '민서'(유행 이름) — 2차 검증 상위 10의 민서 253건
    [InlineData("이", "이", "민수", "박", "서연")]
    [InlineData("이", "이", "준호", "박", "지은")]
    [InlineData("임", "임", "재민", "한", "소영")]
    [InlineData("유", "유", "민준", "최", "서윤")]
    public async Task Order_TrendyThenSurnameEchoesLast(string lastName, string fs, string fn, string ms, string mn)
    {
        foreach (var g in new[] { "none", "male", "female" })
        {
            var result = await _engine.GenerateCandidatesAsync(lastName, fs, fn, ms, mn, null, Birth, g, "neutral");
            Assert.True(result.Count >= 5); // 예비 경로가 붙지 않은 목록(뒤로 보내기는 본 목록 순서)
            int Rank(string n) =>
                (n[1] == lastName[0] || (Dueum.TryGetValue(lastName, out var d) && n[0] == d)) ? 2
                : AestheticEngine.IsTrendyName(n) ? 1 : 0;
            // 0번은 배너(첫 번째 후보) 자리라 순서 규칙 밖 — 1번부터 등급이 줄지 않는다
            var ranks = result.Skip(1).Select(c => Rank(c.Name)).ToList();
            for (int i = 1; i < ranks.Count; i++)
                Assert.True(ranks[i] >= ranks[i - 1], $"{lastName} {g}: {string.Join(",", result.Select(c => c.Name))}");
        }
    }
}
