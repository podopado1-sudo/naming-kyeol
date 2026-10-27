using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;

namespace NameForm.Tests;

/// <summary>
/// GenderToneClassifier 자동 분류 검증 테스트
/// </summary>
public class GenderToneClassifierTests
{
    public GenderToneClassifierTests()
    {
        HanjaData.LoadExternalData();
    }

    // ===== ClassifyGender 단위 테스트 =====

    [Theory]
    [InlineData("꽃 화", HanjaData.GenderPreference.Female)]
    [InlineData("비단 금", HanjaData.GenderPreference.Female)]
    [InlineData("향기 향", HanjaData.GenderPreference.Female)]
    [InlineData("계집 녀", HanjaData.GenderPreference.Female)]
    [InlineData("옥 옥", HanjaData.GenderPreference.Female)]
    [InlineData("연꽃 련(연)", HanjaData.GenderPreference.Female)]   // 겹낱말 X꽃
    [InlineData("패옥 우", HanjaData.GenderPreference.Female)]       // 겹낱말 X옥
    [InlineData("여자의 자 희", HanjaData.GenderPreference.Female)]  // 조사 '의'
    [InlineData("산호 산", HanjaData.GenderPreference.Female)]       // C# 에만 있던 키워드 — 오프라인 목록에도 있다
    public void ClassifyGender_FemaleKeywords_ReturnsFemale(string meaning, HanjaData.GenderPreference expected)
    {
        var result = GenderToneClassifier.ClassifyGender(meaning);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("장수 장", HanjaData.GenderPreference.Male)]
    [InlineData("사나이 한", HanjaData.GenderPreference.Male)]
    [InlineData("칼 도", HanjaData.GenderPreference.Male)]
    [InlineData("호걸 호", HanjaData.GenderPreference.Male)]
    [InlineData("굳셀 강", HanjaData.GenderPreference.Male)]         // (c) 형용사 중 쓰임 기준을 통과한 유일한 한글 키워드
    [InlineData("창 과", HanjaData.GenderPreference.Male)]           // 무기 창 — 훈 낱말이 정확히 '창'
    [InlineData("지아비 부", HanjaData.GenderPreference.Male)]       // 겹낱말 X아비
    public void ClassifyGender_MaleKeywords_ReturnsMale(string meaning, HanjaData.GenderPreference expected)
    {
        var result = GenderToneClassifier.ClassifyGender(meaning);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("물 수", HanjaData.GenderPreference.Neutral)]
    [InlineData("나무 목", HanjaData.GenderPreference.Neutral)]
    [InlineData("일 일", HanjaData.GenderPreference.Neutral)]
    [InlineData("", HanjaData.GenderPreference.Neutral)]
    [InlineData(null, HanjaData.GenderPreference.Neutral)]
    public void ClassifyGender_Ambiguous_ReturnsNeutral(string? meaning, HanjaData.GenderPreference expected)
    {
        var result = GenderToneClassifier.ClassifyGender(meaning);
        Assert.Equal(expected, result);
    }

    /// <summary>
    /// 2026-10-27 성별 규칙 감사 결정 — 옛 부분 일치(trimmed.Contains)가 성별을 붙이던 경우는 모두 Neutral.
    /// (c) 성별 없는 형용사(용감할·예쁠·아름다울 — 쓰임 기준 미달, 여자 쪽은 女부 글자에서만 세는데 이 분류기에는 부수가 없다),
    /// (b) 독음 낱말(창성할 창의 '창'·저울대 형의 '형'), 겹낱말 예외(불꽃·감옥·허수아비), 낱말 일부(용솟음·형세·활시위).
    /// </summary>
    [Theory]
    [InlineData("용감할 용")]      // 옛 Male('용감' 부분 일치 + 독음 '용')
    [InlineData("예쁠 려")]        // 옛 Female — 女부가 아니라 형용사만으로는 세지 않는다
    [InlineData("아름다울 미")]    // 옛 Female(美 는 하드코딩 Female 로 남는다)
    [InlineData("창성할 창")]      // 독음 낱말 '창'은 보지 않는다
    [InlineData("저울대 형")]
    [InlineData("형세 세")]        // 낱말 일부
    [InlineData("활시위 현")]      // 弦 — '활'은 낱말 '활'일 때만
    [InlineData("불꽃 염")]        // X꽃 겹낱말 예외
    [InlineData("감옥 옥")]        // 옥X·X옥 겹낱말 예외(獄)
    [InlineData("허수아비 추")]
    [InlineData("큰 대")]          // (c) 삭제
    [InlineData("빛날 휘")]        // (c) 女부 한정
    public void ClassifyGender_AuditedSubstringCases_AreNeutral(string meaning)
    {
        Assert.Equal(HanjaData.GenderPreference.Neutral, GenderToneClassifier.ClassifyGender(meaning));
    }

    [Fact]
    public void ClassifyGender_OtherReadingHun_IgnoredWhenMainReadingGiven()
    {
        // 兄 '형 형, 두려워할 황' — 주 독음 형의 훈만 본다. 緣 '인연 연, 부인 옷 이름 단' 처럼 다른 독음의 훈은 세지 않는다
        Assert.Equal(HanjaData.GenderPreference.Male, GenderToneClassifier.ClassifyGender("형 형, 두려워할 황", reading: "형"));
        Assert.Equal(HanjaData.GenderPreference.Neutral, GenderToneClassifier.ClassifyGender("인연 연, 부인 옷 이름 단", reading: "연"));
        // 주 독음 조각이 하나도 없으면 전 조각을 본다
        Assert.Equal(HanjaData.GenderPreference.Female, GenderToneClassifier.ClassifyGender("부인 옷 이름 단", reading: "연"));
    }

    /// <summary>
    /// 런타임 분류기의 한글 키워드 = 오프라인 분류기(scripts/classify_gender_tone.py)의 한글 '유지' 목록 — D2(판정 규칙은 오프라인 하나)에서
    /// 런타임은 unihan 기록이 없는 글자의 대체용이라 같은 낱말을 봐야 한다. 스크립트 배열을 소스에서 그대로 읽어 집합으로 대조한다.
    /// </summary>
    [Fact]
    public void Keywords_SameAsOfflineClassifier()
    {
        var py = File.ReadAllText(Path.Combine(RepoRoot(), "scripts", "classify_gender_tone.py"));
        HashSet<string> PyList(string name)
        {
            var m = Regex.Match(py, "(?m)^" + name + @" = \[(.*?)\]", RegexOptions.Singleline);
            Assert.True(m.Success, name);
            var body = Regex.Replace(m.Groups[1].Value, @"#[^\n]*", "");
            return Regex.Matches(body, "\"([^\"]*)\"").Select(x => x.Groups[1].Value).ToHashSet();
        }
        Assert.Equal(PyList("MALE_KEYWORDS_KO").OrderBy(x => x, StringComparer.Ordinal), GenderToneClassifier.MaleGenderKeywords.OrderBy(x => x, StringComparer.Ordinal));
        Assert.Equal(PyList("FEMALE_KEYWORDS_KO").OrderBy(x => x, StringComparer.Ordinal), GenderToneClassifier.FemaleGenderKeywords.OrderBy(x => x, StringComparer.Ordinal));
    }

    private static string RepoRoot([CallerFilePath] string thisFile = "")
        => Path.GetFullPath(Path.Combine(Path.GetDirectoryName(thisFile)!, ".."));

    // ===== ClassifyTone 단위 테스트 =====

    [Theory]
    [InlineData("부드러울 유", HanjaData.TonePreference.Soft)]
    [InlineData("착할 선", HanjaData.TonePreference.Soft)]
    [InlineData("맑을 청", HanjaData.TonePreference.Soft)]
    [InlineData("고요할 정", HanjaData.TonePreference.Soft)]
    [InlineData("어질 인", HanjaData.TonePreference.Soft)]
    public void ClassifyTone_SoftKeywords_ReturnsSoft(string meaning, HanjaData.TonePreference expected)
    {
        var result = GenderToneClassifier.ClassifyTone(meaning);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("굳셀 강", HanjaData.TonePreference.Strong)]
    [InlineData("클 대", HanjaData.TonePreference.Strong)]
    [InlineData("높을 고", HanjaData.TonePreference.Strong)]
    [InlineData("빛날 휘", HanjaData.TonePreference.Strong)]
    [InlineData("넓을 광", HanjaData.TonePreference.Strong)]
    [InlineData("날랠 민", HanjaData.TonePreference.Strong)]
    public void ClassifyTone_StrongKeywords_ReturnsStrong(string meaning, HanjaData.TonePreference expected)
    {
        var result = GenderToneClassifier.ClassifyTone(meaning);
        Assert.Equal(expected, result);
    }

    // ===== 하드코딩 보호 테스트 =====

    [Theory]
    [InlineData("花", HanjaData.GenderPreference.Female)]   // 하드코딩 Female
    [InlineData("勇", HanjaData.GenderPreference.Male)]     // 하드코딩 Male
    [InlineData("美", HanjaData.GenderPreference.Female)]   // 하드코딩 Female
    [InlineData("雄", HanjaData.GenderPreference.Male)]     // 하드코딩 Male
    public void AutoClassify_HardcodedGender_PreservedAfterLoad(string character, HanjaData.GenderPreference expected)
    {
        var info = HanjaData.FindByCharacter(character);
        Assert.NotNull(info);
        Assert.Equal(expected, info.GenderPref);
    }

    [Theory]
    [InlineData("海", HanjaData.TonePreference.Strong)]  // 하드코딩 Strong
    [InlineData("月", HanjaData.TonePreference.Soft)]    // 하드코딩 Soft
    [InlineData("善", HanjaData.TonePreference.Soft)]    // 하드코딩 Soft
    public void AutoClassify_HardcodedTone_PreservedAfterLoad(string character, HanjaData.TonePreference expected)
    {
        var info = HanjaData.FindByCharacter(character);
        Assert.NotNull(info);
        Assert.Equal(expected, info.TonePref);
    }

    // ===== 전체 통계 =====

    [Fact]
    public void AutoClassify_OverallStats_ImprovedCoverage()
    {
        var allHanja = HanjaData.GetAllHanja();
        var total = allHanja.Count;

        var genderNonNeutral = allHanja.Count(h => h.GenderPref != HanjaData.GenderPreference.Neutral);
        var toneNonNeutral = allHanja.Count(h => h.TonePref != HanjaData.TonePreference.Neutral);

        var male = allHanja.Count(h => h.GenderPref == HanjaData.GenderPreference.Male);
        var female = allHanja.Count(h => h.GenderPref == HanjaData.GenderPreference.Female);
        var strong = allHanja.Count(h => h.TonePref == HanjaData.TonePreference.Strong);
        var soft = allHanja.Count(h => h.TonePref == HanjaData.TonePreference.Soft);

        // 자동 분류 후 최소 기준
        // Gender: 하드코딩(~15) + Unihan(~3163) + 자동분류(~100+) = 최소 100+
        Assert.True(male >= 30, $"Male 분류: {male}개 (최소 30개 기대)");
        Assert.True(female >= 50, $"Female 분류: {female}개 (최소 50개 기대)");

        // Tone: 자동 분류로 추가 확보
        Assert.True(strong >= 50, $"Strong 분류: {strong}개 (최소 50개 기대)");
        Assert.True(soft >= 50, $"Soft 분류: {soft}개 (최소 50개 기대)");

        // 전체 non-Neutral 비율이 이전(45자)보다 훨씬 높아야 함
        Assert.True(genderNonNeutral > 100,
            $"Gender non-Neutral: {genderNonNeutral}/{total}");
        Assert.True(toneNonNeutral > 100,
            $"Tone non-Neutral: {toneNonNeutral}/{total}");
    }

    // ===== 쉼표 구분 의미 처리 =====

    [Fact]
    public void ClassifyGender_CommaSeparatedMeaning_HandlesCorrectly()
    {
        // "기댈 은, 비단 온" → 둘째 파트의 '비단' 키워드 → Female (옛 예 '아름다울 온'은 형용사라 2026-10-27 부터 Neutral)
        var result = GenderToneClassifier.ClassifyGender("기댈 은, 비단 온");
        Assert.Equal(HanjaData.GenderPreference.Female, result);
        // 파트마다 다른 성별이 걸리면 Neutral
        Assert.Equal(HanjaData.GenderPreference.Neutral, GenderToneClassifier.ClassifyGender("비단 금, 칼 금"));
    }

    [Fact]
    public void ClassifyTone_CommaSeparatedMeaning_HandlesCorrectly()
    {
        // "맑을 청, 푸를 청" → 맑을 키워드 → Soft
        var result = GenderToneClassifier.ClassifyTone("맑을 청, 푸를 청");
        Assert.Equal(HanjaData.TonePreference.Soft, result);
    }

    // ===== CategoryMinor 힌트 =====

    [Fact]
    public void ClassifyGender_CategoryHint_FallbackWorks()
    {
        // 의미 없이 카테고리만 있을 때
        var result = GenderToneClassifier.ClassifyGender("", null, "FLOWER");
        Assert.Equal(HanjaData.GenderPreference.Female, result);
    }

    [Fact]
    public void ClassifyTone_CategoryHint_FallbackWorks()
    {
        var result = GenderToneClassifier.ClassifyTone("", null, "WARRIOR");
        Assert.Equal(HanjaData.TonePreference.Strong, result);
    }
}
