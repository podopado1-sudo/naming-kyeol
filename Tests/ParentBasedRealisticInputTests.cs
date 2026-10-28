using Microsoft.Extensions.Logging.Abstractions;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;
using NameForm.Infrastructure.Repositories;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 부모 기반 작명 현실 입력 회귀(2026-10-28) — 옛 테스트는 부모 정보를 준 13곳 모두 아이 성 ≠ 아버지 성(김 아이 + 박·문 아버지)이라
/// 주된 실패 꼴('김김춘리'·'김김서추' — 이름 칸에 아버지 성, 현실 입력의 100%)과 첫 후보 = 어머니 전체 이름('김이서연')을 한 번도 보지 않았다.
/// 기대값은 엔진 함수가 아니라 테스트 안에서 따로 정한다: 길이·첫 글자·반복·부모 이름은 입력에서, 금칙은 공용 목록(데이터)에서,
/// 실명은 통계 원자료(NameGenderData.NameCounts)에서, 라벨은 아래 손으로 적은 표에서.
/// </summary>
public class ParentBasedRealisticInputTests
{
    private static readonly DateTime Birth = new(2024, 3, 15);
    private readonly ParentBasedNamingEngine _engine = new(new NamePoolEngine(new FakeSajuCalculationService()), new NameReversalEngine());

    /// <summary>사용자에게 보이는 방식 라벨 — 사람 이름 꼴이 아닌 '…잇기' 문구만(손으로 적은 표)</summary>
    private static readonly HashSet<string> ExpectedLabels = new()
    {
        "부모 이름 뜻 잇기", "부모 이름 첫 글자 잇기", "부모 이름 글자 잇기", "부모 공통 글자 잇기",
        "어머니 이름 첫 글자 잇기", "아버지 이름 첫 글자 잇기", "어머니 성씨 잇기", "어머니 성씨 소리 잇기",
        "키워드 뜻 잇기", "키워드 소리 잇기", "성씨 뜻 잇기",
        // 예비 경로(결과가 5개 미만일 때 — 부모 이름의 첫 글자 밖 글자 + 실명 짝 글자, 2026-10-28)
        "아버지 이름 글자 잇기", "어머니 이름 글자 잇기",
    };

    public static IEnumerable<object?[]> RealisticInputs() => new[]
    {
        // 아이 성 = 아버지 성 (현실 입력의 대부분)
        new object?[] { "김", "김", "민수", "이", "서연", null, "none", "neutral" },
        new object?[] { "김", "김", "민수", "이", "서연", null, "female", "soft" },
        new object?[] { "정", "정", "성민", "윤", "하은", null, "none", "neutral" },
        new object?[] { "정", "정", "성민", "윤", "하은", null, "male", "strong" },
        // 부모 성이 같다(어머니 성 = 아이 성 → 어머니 성씨 방식은 건너뛴다)
        new object?[] { "김", "김", "민준", "김", "민지", null, "none", "neutral" },
        // 패턴 DB 성(이·정·강·임) 아이 — 부모 이름이 있으면 성씨 자동은 돌지 않는다
        new object?[] { "이", "이", "준호", "박", "지은", null, "none", "neutral" },
        new object?[] { "정", "정", "우진", "김", "수아", null, "female", "neutral" },
        new object?[] { "강", "강", "도현", "최", "유나", null, "male", "neutral" },
        new object?[] { "임", "임", "재민", "한", "소영", null, "none", "soft" },
        // 본음 사례(옛 의미융합은 한자 대표 독음을 이어 민련·아녀·례녀를 냈다)
        new object?[] { "김", "김", "민수", "이", "연주", null, "none", "neutral" },
        new object?[] { "윤", "윤", "예준", "임", "여름", null, "none", "neutral" },
        // 복성 어머니(성씨 방식 건너뜀)·복성 아이
        new object?[] { "남궁", "남궁", "민수", "선우", "서연", null, "none", "neutral" },
        // 키워드 + 부모
        new object?[] { "김", "김", "민수", "이", "서연", "빛", "none", "neutral" },
    };

    [Theory]
    [MemberData(nameof(RealisticInputs))]
    public async Task Realistic_AllCandidatesPassCommonQuality(
        string lastName, string? fs, string? fn, string? ms, string? mn, string? kw, string gender, string tone)
    {
        var result = await _engine.GenerateCandidatesAsync(lastName, fs, fn, ms, mn, kw, Birth, gender, tone);
        Assert.NotEmpty(result);
        AssertCommonQuality(result, lastName, fs, fn, ms, mn);

        // 첫 후보(화면 배너) — 어머니 전체 이름이 아니고, 부모 이름 글자를 품은 실명
        var first = result[0];
        Assert.NotEqual(ms + mn, first.Name);
        Assert.NotEqual(ms + mn, lastName + first.Name);
        var parentSyllables = (fn ?? "") + (mn ?? "");
        Assert.True(first.Name.Any(ch => parentSyllables.Contains(ch)), $"첫 후보 '{first.Name}'에 부모 이름 글자가 없다");
        Assert.NotNull(NameGenderData.NameCounts(first.Name, 20));
    }

    [Theory]
    [InlineData("김", "김", "민수", "이", "서연")]
    [InlineData("정", "정", "성민", "윤", "하은")]
    public async Task Realistic_NoSurnameInsideGivenName_NoMotherFullName(string lastName, string fs, string fn, string ms, string mn)
    {
        var result = await _engine.GenerateCandidatesAsync(lastName, fs, fn, ms, mn, null, Birth, "none", "neutral");
        // 옛 문소리·복합(b)는 이름 칸에 아버지 성을 넣어 '김김춘리'·'정정춘윤'이 됐다(현실 입력 904/904·492/492)
        Assert.DoesNotContain(result, c => c.Name.StartsWith(fs));
        // 옛 윤고은 첫 꼴 = 어머니 성 + 어머니 이름(어머니 전체 이름) — 어떤 자리에도 없다
        Assert.DoesNotContain(result, c => c.Name == ms + mn || c.Name.Contains(mn));
        // 어머니 성씨 방식은 성이 첫 글자(잇기) 또는 끝 글자(소리)에만 — 그 밖의 자리에 어머니 성이 끼지 않는다
        Assert.All(result.Where(c => c.NamingModel == ParentNamingModels.MotherSurname), c => Assert.Equal(ms[0], c.Name[0]));
    }

    // 성 칸이 빈 전체 이름 나누기 — 프런트 lib/name-split.ts splitParentName 과 같은 표(frontend/tests/name-split.test.mjs PARENT_CASES).
    // [입력, 성, 이름] — 성 null = 나누지 않음
    [Theory]
    [InlineData("김민수", "김", "민수")]
    [InlineData("이서연", "이", "서연")]
    [InlineData(" 박지훈 ", "박", "지훈")]
    [InlineData("남궁서연", "남궁", "서연")]
    [InlineData("남궁민", "남궁", "민")]    // 2026-10-28 전 백엔드는 4자 이상만 복성으로 봐 남 + 궁민('어머니 성씨 '남'…' 거짓 설명)
    [InlineData("제갈량", "제갈", "량")]
    [InlineData("선우진", "선", "우진")]    // 붙여 쓴 3자의 황보·서문·강전·선우는 1자 성
    [InlineData("황보라", "황", "보라")]
    [InlineData("김 철", "김", "철")]       // 외자 이름은 띄어 쓴다
    [InlineData("민호", null, "민호")]       // 붙여 쓴 2자는 이름만
    [InlineData("김철", null, "김철")]
    public void ParentNameSplit_SameAsFrontendSplitParentName(string input, string? surname, string name)
    {
        Assert.Equal((surname, name), ParentNameSplit.SplitIfFullName(null, input));
        // 성 칸이 있으면 그대로
        Assert.Equal(("최", input), ParentNameSplit.SplitIfFullName("최", input));
    }

    [Fact]
    public async Task Engine_DoesNotSplitThreeSyllableGivenName()
    {
        // /parent-based 폼은 성 칸이 따로 있다 — 엔진이 성 칸이 빈 3자 이름을 나누던 때는 아버지 '한울림'이 '한' + '울림'이 돼
        // '아버지 이름 '울림'의 두 글자 순서를 바꾼 이름'('림울' 1개), 어머니 '한아름'은 '어머니 성씨 '한'을 첫 글자로…'라는 거짓 설명이 나왔다
        var result = await _engine.GenerateCandidatesAsync("정", null, "한울림", null, "한아름", null, Birth, "none", "neutral");
        Assert.NotEmpty(result);
        Assert.DoesNotContain(result, c => c.Description.Contains("'울림'") || c.Description.Contains("'아름'"));
        Assert.DoesNotContain(result, c => c.NamingModel is ParentNamingModels.MotherSurname or ParentNamingModels.MotherSound);
    }

    [Fact]
    public async Task LegacySearchForm_FullNameInNameField_SplitBySmartService()
    {
        // 옛 /search 화면(배포 전 캐시)·API 는 성 칸 없이 이름 칸에 전체 이름('김민수')을 보냈다 — SmartRecommendationService 가 나눠 엔진에 넘긴다.
        // 옛 출력: 아버지 이름 '민수' 그대로·'수민김'·'김수민'(성 글자 섞임), 성씨가 필요한 방식은 돌지 않았다
        var smart = BuildSmartService();
        var res = await smart.GenerateSmartRecommendationsAsync(new SmartRecommendationRequestDto
        {
            LastName = "김", BirthDate = "2024-03-15", Gender = "none", Tone = "neutral",
            FatherName = "김민수", MotherName = "이서연"
        });
        var tab = res.Categories.Single(c => c.Type == "parent-based");
        Assert.NotEmpty(tab.Names);
        Assert.All(tab.Names, n =>
        {
            Assert.Equal(2, n.Name.Length);
            Assert.DoesNotContain('김', n.Name);
            Assert.NotEqual("민수", n.Name);
            Assert.NotEqual("서연", n.Name);
        });
        Assert.Contains(tab.Names, n => n.Tags.Contains("어머니 성씨 잇기") && n.Name[0] == '이');
    }

    [Fact]
    public async Task MotherSurnameSameAsChild_SkipsSurnameMethods()
    {
        // 어머니 성(김)이 아이 성(김)과 같으면 성이 이름 칸에 들어가는 방식은 건너뛴다 — 옛 엔진은 '김김민지'·'김김춘'을 냈다
        var result = await _engine.GenerateCandidatesAsync("김", "김", "민준", "김", "민지", null, Birth, "none", "neutral");
        Assert.DoesNotContain(result, c => c.NamingModel is ParentNamingModels.MotherSurname or ParentNamingModels.MotherSound);
        // 복성 어머니도 같다
        var compound = await _engine.GenerateCandidatesAsync("남궁", "남궁", "민수", "선우", "서연", null, Birth, "none", "neutral");
        Assert.DoesNotContain(compound, c => c.NamingModel is ParentNamingModels.MotherSurname or ParentNamingModels.MotherSound);
        // 공통 글자 '민' — 부모 공통 글자 잇기가 돈다(옛 세대연결: '민' + 사전 앞 10자 독음 '민춘'·'춘민')
        Assert.Contains(result, c => c.NamingModel == ParentNamingModels.SharedSyllable && c.Name.Contains('민'));
    }

    [Theory]
    [InlineData("김", "민수", "연주")]
    [InlineData("윤", "예준", "여름")]
    public async Task FamilyMeaning_UsesParentSyllables_NotDictionaryReadings(string lastName, string fn, string mn)
    {
        var result = await _engine.GenerateCandidatesAsync(lastName, lastName, fn, "이", mn, null, Birth, "none", "neutral");
        var parentSyllables = new HashSet<char>(fn + mn);
        // 이름 음절이 입력에 없는 본음 음절(련·녀·려·례)이면 안 된다 — 부모 이름 글자 방식은 두 음절 모두 부모 이름 글자
        foreach (var c in result.Where(c => c.NamingModel is ParentNamingModels.FamilyMeaning or ParentNamingModels.ParentInitials or ParentNamingModels.ParentSyllables))
            Assert.All(c.Name, ch => Assert.Contains(ch, parentSyllables));
        Assert.DoesNotContain(result, c => c.Name.Any(ch => "련녀려례".Contains(ch) && !parentSyllables.Contains(ch)));

        // 뜻 잇기 후보의 한자는 음절마다 한 자, 그 글자가 그 음절로 읽히고, 설명은 그 독음의 훈 조각을 인용한다
        foreach (var c in result.Where(c => c.NamingModel == ParentNamingModels.FamilyMeaning))
        {
            Assert.NotNull(c.Hanja);
            Assert.Equal(c.Name.Length, c.Hanja!.Length);
            for (int i = 0; i < c.Name.Length; i++)
            {
                var h = HanjaData.FindByCharacter(c.Hanja[i].ToString())!;
                var syl = c.Name[i].ToString();
                Assert.True(h.Reading == syl || h.AlternateReadings.Contains(syl), $"{c.Hanja[i]} 는 '{syl}'로 읽히지 않는다");
                Assert.False(HanjaData.IsForbiddenNameHanja(h.Character));
                var segs = h.Meaning!.Split(',', '/', ';', '·').Select(s => s.Trim());
                Assert.Contains(segs, s => c.Description.Contains($"'{s}'") && (s.EndsWith(syl) || s.EndsWith($"({syl})")));
            }
        }
    }

    [Theory]
    [InlineData("사랑")]
    [InlineData("희망")]
    [InlineData("빛")]
    [InlineData("바다")]
    [InlineData("하늘")]
    public async Task KeywordOnly_FiveOrMoreCandidates_NoForbidden(string keyword)
    {
        var result = await _engine.GenerateCandidatesAsync("김", null, null, null, null, keyword, Birth, "none", "neutral");
        Assert.True(result.Count >= 5, $"키워드 '{keyword}'만 넣은 입력의 후보 {result.Count}개");
        AssertCommonQuality(result, "김", null, null, null, null);
        // 옛 '사랑'의 첫 카드는 嬖 '사랑할 폐' + 寵 '사랑할 총' = '폐총'(금칙 '폐') — 부분 일치 뜻 매칭
        Assert.DoesNotContain(result, c => c.Name.Contains('폐'));
        Assert.All(result, c => Assert.Contains(keyword, c.Description));
        // 키워드 뜻 한자를 실은 후보는 그 한자가 음절로 읽히고, 한 자는 훈에 키워드 뜻 낱말이 낱말로 있다(부분 일치 아님 — 금 ⊄ 임금)
        foreach (var c in result.Where(c => c.Hanja != null))
        {
            Assert.Equal(2, c.Hanja!.Length);
            for (int i = 0; i < 2; i++)
            {
                var h = HanjaData.FindByCharacter(c.Hanja[i].ToString())!;
                Assert.True(h.Reading == c.Name[i].ToString() || h.AlternateReadings.Contains(c.Name[i].ToString()), $"{c.Name} {c.Hanja}");
            }
        }
    }

    [Theory]
    [InlineData("이")]
    [InlineData("정")]
    [InlineData("강")]
    [InlineData("임")]
    public async Task PatternSurname_NoParentInfo_TwoSyllableRealNames(string lastName)
    {
        // 패턴 DB 성씨(API 전용 입력 — 부모 이름·키워드 없음): 옛 1단계 1글자 분기는 '패턴 둘째 음절 × 사전 앞 10자'로 15칸을 채워
        // 정 → 성춘·춘성·추성, 임 → 하춘·추하·천하 를 냈다. 지금은 패턴 글자를 첫 글자로 둔 실명
        var result = await _engine.GenerateCandidatesAsync(lastName, null, null, null, null, null, Birth, "none", "neutral");
        Assert.NotEmpty(result);
        AssertCommonQuality(result, lastName, null, null, null, null);
        Assert.All(result, c => Assert.NotNull(NameGenderData.NameCounts(c.Name, 20)));
        Assert.DoesNotContain(result, c => c.Name.Contains('춘') || c.Name.Contains('추'));
    }

    // ═══════════════════════════════════════════════════════════════
    // 공통 품질 거르기 — 손으로 정한 사례
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("김", "김춘", "child-surname")]
    [InlineData("남궁", "궁서", "child-surname")]  // 복성은 끝 음절
    [InlineData("김", "민민", "repeat")]
    [InlineData("김", "서연", "parent-name")]       // 어머니 이름 그대로
    [InlineData("김", "민수", "parent-name")]       // 아버지 이름 그대로
    [InlineData("이", "김철", "parent-name")]       // 외자 아버지의 전체 이름 그대로
    [InlineData("김", "폐총", "forbidden")]          // 옛 '사랑' 첫 카드
    [InlineData("천", "민호", "forbidden")]          // 성과 이름 경계의 '천민'
    [InlineData("김", "추리", "negative-syllable")]
    [InlineData("허", "하람", "negative-full-name")] // 허하람 → '허하다'
    [InlineData("이", "기현", "negative-full-name")] // 이기현 → '이기적'
    [InlineData("김", "괵수", "no-hanja")]           // 괵 — 쓸 수 있는 한자가 없는 음절
    [InlineData("김", "서민", "word-name")]          // 실명 21명이지만 생활 낱말(민수/서연의 둘째 카드였다 — 2026-10-28 검증)
    [InlineData("김", "승리", "word-name")]
    [InlineData("김", "김춘리", "length")]
    [InlineData("김", "하람", null)]
    [InlineData("허", "준호", null)]                 // 허씨 성 자체의 동음 감점은 이름 탓이 아니다
    [InlineData("피", "하람", null)]                 // 한 글자 금칙어 '피'가 성 글자뿐이면 이름 탓이 아니다
    public void QualityRejectReason_HandCases(string lastName, string name, string? expected)
    {
        var givens = new[] { "민수", "서연", "철" };
        var fulls = new[] { "김민수", "이서연", "김철" };
        Assert.Equal(expected, ParentBasedNamingEngine.QualityRejectReason(name, lastName, givens, fulls));
    }

    // ═══════════════════════════════════════════════════════════════
    // 서비스 경로 — standard 합류 거르기, /search 꼴(성 포함 전체 이름을 프런트가 나눠 보낸 요청)
    // ═══════════════════════════════════════════════════════════════

    private sealed class EmptyNamePool : INamePoolEngine
    {
        public Task<List<string>> GenerateCandidatesAsync(string lastName, DateTime birthDate, string gender, string tone,
            int nameLength = 2, IReadOnlyList<string>? preferredMeanings = null) => Task.FromResult(new List<string>());
    }

    private sealed class FixedParentEngine : IParentBasedNamingEngine
    {
        public Task<List<ParentBasedNameCandidate>> GenerateCandidatesAsync(string lastName, string? fatherSurname, string? fatherName,
            string? motherSurname, string? motherName, string? storyKeyword, DateTime birthDate, string gender, string tone,
            TimeSpan? birthTime = null)
            => Task.FromResult(new[] { "이화", "아아", "폐기", "서연", "해지", "하람", "지우" }
                .Select(n => new ParentBasedNameCandidate
                {
                    Name = n, NamingModel = ParentNamingModels.MotherSurname, NamingLabel = "어머니 성씨 잇기",
                    NameType = "음운중심", Description = "테스트"
                }).ToList());
    }

    private static RecommendationService BuildRecommendationService(INamePoolEngine pool, IParentBasedNamingEngine parent)
    {
        var saju = new FakeSajuCalculationService();
        return new RecommendationService(new InMemoryRecommendationRepository(), pool,
            new ScoringService(new AestheticEngine(), new HarmonyEngine(saju), new RarityScoringEngine()),
            new RankerEngine(), new ExplanationEngine(), parent,
            new DualNameEngine(saju, new YongshinCalculationService()),
            NullLogger<RecommendationService>.Instance);
    }

    [Fact]
    public async Task Recommendation_ParentCandidates_PassCommonQualityBeforeRanking()
    {
        // 옛 합류는 부모 후보를 공통 거르기 없이 standard 랭킹에 넣어 1위 카드에 '이이화'(첫 글자 = 아이 성)·'해지'(생활 낱말)·'박아아'가 올랐다.
        // 기본 풀을 비우면 상위 카드는 모두 부모 후보다 — 거르기에 걸리는 이름(손으로 정한 표)은 하나도 남지 않는다
        var svc = BuildRecommendationService(new EmptyNamePool(), new FixedParentEngine());
        var res = await svc.CreateRecommendationAsync(new CreateRecommendationRequestDto
        {
            LastName = "이", BirthDate = "2024-03-15", Gender = "none", Tone = "neutral",
            FatherSurname = "이", FatherName = "준호", MotherSurname = "박", MotherName = "서연"
        });
        var names = res.TopCandidates.Select(c => c.Name).ToList();
        foreach (var bad in new[] { "이화", "아아", "폐기", "서연" })
            Assert.DoesNotContain(bad, names);
        Assert.Contains("하람", names);
        // 응답 방식 값은 중립 코드 + 사용자 라벨
        Assert.All(res.TopCandidates, c =>
        {
            Assert.Equal(ParentNamingModels.MotherSurname, c.NamingModel);
            Assert.Equal("어머니 성씨 잇기", c.NamingLabel);
        });
    }

    [Fact]
    public async Task Smart_SearchFormSplitNames_ParentTabTwoSyllables_LabelTagsOnly()
    {
        // /search 의 부모 이름 칸은 성 포함 전체 이름('김민수'·'이서연') — 프런트(lib/name-split.ts)가 성과 이름을 나눠 보낸 요청
        var saju = new FakeSajuCalculationService();
        var pool = new NamePoolEngine(saju);
        var parent = new ParentBasedNamingEngine(pool, new NameReversalEngine());
        var scoring = new ScoringService(new AestheticEngine(), new HarmonyEngine(saju), new RarityScoringEngine());
        var rec = BuildRecommendationService(pool, parent);
        var twin = new TwinNameService(new TwinNameEngine(saju), scoring, new ExplanationEngine(), NullLogger<TwinNameService>.Instance);
        var smart = new SmartRecommendationService(rec, new PureKoreanNameEngine(), new CreativeNamingEngine(), new ThreeSyllableEngine(),
            new RareSurnameEngine(), parent, twin, new RequiredCharEngine(saju), new DualNameEngine(saju, new YongshinCalculationService()));

        var res = await smart.GenerateSmartRecommendationsAsync(new SmartRecommendationRequestDto
        {
            LastName = "김", BirthDate = "2024-03-15", Gender = "none", Tone = "neutral",
            FatherSurname = "김", FatherName = "민수", MotherSurname = "이", MotherName = "서연"
        });

        var tab = res.Categories.Single(c => c.Type == "parent-based");
        Assert.NotEmpty(tab.Names);
        Assert.All(tab.Names, n =>
        {
            Assert.Equal(2, n.Name.Length);
            Assert.Equal("김" + n.Name, n.FullName);
            Assert.NotEqual('김', n.Name[0]);
            Assert.NotEqual("김민수", n.FullName);
            Assert.NotEqual("김이서연", n.FullName);
            // 태그는 사용자 라벨 하나 — 방식 코드·'…모델'·이름 분류가 태그로 나가지 않는다
            Assert.Single(n.Tags);
            Assert.Contains(n.Tags[0], ExpectedLabels);
        });
        Assert.NotEqual("이서연", tab.Names[0].Name);

        // standard 탭에는 부모 후보가 없다(2026-10-28 — 정책 결정 전까지 SmartRecommendationService 가 standard 요청에 부모 성·이름·키워드를 넘기지 않는다).
        // 코드·'…모델'·부모 방식 라벨 태그 모두 없다
        var std = res.Categories.Single(c => c.Type == "standard");
        Assert.All(std.Names, n => Assert.DoesNotContain(n.Tags, t => ParentNamingModels.Codes.Contains(t) || t.EndsWith("모델") || ExpectedLabels.Contains(t)));
    }

    private static SmartRecommendationService BuildSmartService(IRecommendationService? rec = null)
    {
        var saju = new FakeSajuCalculationService();
        var pool = new NamePoolEngine(saju);
        var parent = new ParentBasedNamingEngine(pool, new NameReversalEngine());
        var scoring = new ScoringService(new AestheticEngine(), new HarmonyEngine(saju), new RarityScoringEngine());
        var twin = new TwinNameService(new TwinNameEngine(saju), scoring, new ExplanationEngine(), NullLogger<TwinNameService>.Instance);
        return new SmartRecommendationService(rec ?? BuildRecommendationService(pool, parent), new PureKoreanNameEngine(), new CreativeNamingEngine(),
            new ThreeSyllableEngine(), new RareSurnameEngine(), parent, twin, new RequiredCharEngine(saju), new DualNameEngine(saju, new YongshinCalculationService()));
    }

    [Theory]
    [InlineData("김", "김민수", "이서연", "male")]
    [InlineData("김", "김민수", "이서연", "female")]
    [InlineData("박", "박지훈", "최지은", "none")]
    [InlineData("이", "이준", "박지은", "female")]
    public async Task Smart_StandardTabAndTopPick_SameWhetherParentNamesSplitOrNot(string lastName, string father, string mother, string gender)
    {
        // /search 가 부모 이름을 성·이름으로 나눠 보내자 RecommendationService 합류 조건(부모 성·키워드)이 참이 돼 standard 상위 10의 33%,
        // 1위·TopPick 의 46%(72요청)가 부모 후보로 바뀌었다(김/김민수/이서연 → 예리 叡李·하리 夏李 …). 정책 결정 전까지 옛 꼴(성 미전송)과 같아야 한다
        var smart = BuildSmartService();
        var f = ParentNameSplit.SplitIfFullName(null, father);
        var m = ParentNameSplit.SplitIfFullName(null, mother);
        var oldForm = await smart.GenerateSmartRecommendationsAsync(new SmartRecommendationRequestDto
        {
            LastName = lastName, BirthDate = "2024-03-15", Gender = gender, Tone = "neutral",
            FatherName = father, MotherName = mother
        });
        var newForm = await smart.GenerateSmartRecommendationsAsync(new SmartRecommendationRequestDto
        {
            LastName = lastName, BirthDate = "2024-03-15", Gender = gender, Tone = "neutral",
            FatherSurname = f.Surname, FatherName = f.Name, MotherSurname = m.Surname, MotherName = m.Name
        });
        static string[] Top10(SmartRecommendationResponseDto r)
            => r.Categories.Single(c => c.Type == "standard").Names.Take(10).Select(n => n.Name + "/" + n.Hanja).ToArray();
        Assert.Equal(Top10(oldForm), Top10(newForm));
        Assert.Equal(oldForm.TopPick?.CategoryType, newForm.TopPick?.CategoryType);
        Assert.Equal(oldForm.TopPick?.Candidate.Name, newForm.TopPick?.Candidate.Name);
        Assert.All(newForm.Categories.Single(c => c.Type == "standard").Names, n => Assert.DoesNotContain(n.Tags, t => ExpectedLabels.Contains(t)));
    }

    private sealed class CapturingRecommendationService : IRecommendationService
    {
        public CreateRecommendationRequestDto? Last { get; private set; }
        public Task<RecommendationResponseDto> CreateRecommendationAsync(CreateRecommendationRequestDto request)
        {
            Last = request;
            return Task.FromResult(new RecommendationResponseDto());
        }
        public Task<RecommendationResponseDto?> GetRecommendationAsync(string id) => Task.FromResult<RecommendationResponseDto?>(null);
    }

    [Fact]
    public async Task Smart_StandardRequest_CarriesNoParentFields()
    {
        // standard 요청에 부모 성·이름·키워드가 실리면 RecommendationService 가 부모 후보를 standard 랭킹에 합친다 — 합칠지는 사용자 결정 뒤에 켠다
        var capture = new CapturingRecommendationService();
        var smart = BuildSmartService(capture);
        await smart.GenerateSmartRecommendationsAsync(new SmartRecommendationRequestDto
        {
            LastName = "김", BirthDate = "2024-03-15", Gender = "none", Tone = "neutral",
            FatherSurname = "김", FatherName = "민수", MotherSurname = "이", MotherName = "서연", StoryKeyword = "빛"
        });
        Assert.NotNull(capture.Last);
        Assert.Null(capture.Last!.FatherSurname);
        Assert.Null(capture.Last.FatherName);
        Assert.Null(capture.Last.MotherSurname);
        Assert.Null(capture.Last.MotherName);
        Assert.Null(capture.Last.StoryKeyword);
    }

    private static void AssertCommonQuality(
        List<ParentBasedNameCandidate> result, string lastName, string? fs, string? fn, string? ms, string? mn)
    {
        var givens = new[] { fn, mn }.Where(x => !string.IsNullOrEmpty(x)).Select(x => x!).ToList();
        var fulls = new[] { (fs, fn), (ms, mn) }.Where(p => !string.IsNullOrEmpty(p.Item1) && !string.IsNullOrEmpty(p.Item2))
            .Select(p => p.Item1 + p.Item2).ToList();
        Assert.Equal(result.Count, result.Select(c => c.Name).Distinct().Count());
        Assert.All(result, c =>
        {
            Assert.Equal(2, c.Name.Length);
            Assert.All(c.Name, ch => Assert.InRange(ch, '가', '힣'));
            Assert.NotEqual(lastName[^1], c.Name[0]);
            Assert.NotEqual(c.Name[0], c.Name[1]);
            Assert.DoesNotContain(c.Name, givens);
            Assert.DoesNotContain(c.Name, fulls);
            Assert.DoesNotContain(lastName + c.Name, fulls);
            Assert.False(ForbiddenWordData.ContainsForbiddenWord(c.Name), $"금칙어: {c.Name}");
            Assert.False(ForbiddenWordData.IsCollisionWithCommonWord(c.Name), $"생활어: {c.Name}");
            Assert.False(ForbiddenWordData.IsNegativeHomophoneName(c.Name), $"부정 동음: {c.Name}");
            // 방식 값은 중립 코드(영문 소문자·하이픈)와 손으로 적은 라벨 표 안의 문구 — 사람 이름 꼴('…모델')이 없다
            Assert.Matches("^[a-z]+(-[a-z]+)+$", c.NamingModel);
            Assert.Contains(c.NamingLabel, ExpectedLabels);
            Assert.Contains(c.NameType, new[] { "음운중심", "의미중심", "서사중심" });
        });
    }
}
