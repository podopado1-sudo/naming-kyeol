using System.Linq;
using System.Text.Json;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// 성별 선호 오버라이드(data/hanja-gender-overrides.json + 하드코딩 정리) 회귀 테스트 — 2026-10-22 감사 ND-2.
/// GenderPref 는 /name 조합(반대 성별 −400)·라이브 선택기(−200)·미학 성별 보너스가 함께 읽는다.
/// 赫(빛날 혁)이 키워드 분류로 Female 이 되자 남자 혁 이름 1순위를 侐(고요할 혁, D등급)이 차지했고,
/// 恩 하드코딩 Female 때문에 남자 은 이름 1순위는 전부 銀이었다.
/// 2026-10-26: 결정 ③(성별 판정 = 보이는 한자) 뒤 키워드 부분 일치로 성별이 붙은 10자를 더했다(아래 KeywordMisclassified_*).
/// </summary>
public class HanjaGenderOverrideTests
{
    private static Dictionary<string, string> LoadOverrideFile()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "data", "hanja-gender-overrides.json");
        Assert.True(File.Exists(path), "data/hanja-gender-overrides.json 이 산출물에 없다");
        return JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path))!;
    }

    [Fact]
    public void OverrideFile_KeysAreUnifiedHanja_ValuesAreEnumNames_AndApplied()
    {
        var overrides = LoadOverrideFile();
        Assert.NotEmpty(overrides);
        foreach (var (ch, value) in overrides)
        {
            Assert.True(HanjaData.IsHanCodePoint(ch), $"키는 한자 1글자: {ch}");
            Assert.Equal(ch, HanjaData.ToUnifiedHanja(ch)); // 호환 한자 키 금지 — 사전은 통합 한자 키만 둔다
            Assert.True(Enum.TryParse<HanjaData.GenderPreference>(value, out var pref) && Enum.IsDefined(pref), $"{ch}: 값 {value}");

            var info = HanjaData.FindByCharacter(ch);
            Assert.NotNull(info);
            Assert.Equal(pref, info!.GenderPref); // 모든 기록자 이후에 적용됐다
        }
        // 파일은 코드포인트 순으로 둔다(사람이 diff 로 검토하는 표)
        var keys = overrides.Keys.ToList();
        Assert.Equal(keys.OrderBy(k => char.ConvertToUtf32(k, 0)), keys);
    }

    [Theory]
    [InlineData("赫")] // 빛날 혁 — unihan 분류 Female('빛날')
    [InlineData("焃")] // 빛날 혁
    [InlineData("焱")] // 불꽃 혁
    [InlineData("恩")] // 은혜 은 — 하드코딩 Female 제거
    [InlineData("秀")] // 빼어날 수 — 하드코딩 제거 + 오버라이드(unihan·분류기 '빼어날'이 Female)
    public void MisclassifiedGender_IsNeutral(string ch)
    {
        var info = HanjaData.FindByCharacter(ch);
        Assert.NotNull(info);
        Assert.Equal(HanjaData.GenderPreference.Neutral, info!.GenderPref);
    }

    [Fact]
    public void Hye_CommonHanja_ShareOneGender()
    {
        // 惠의 하드코딩 Female 을 남긴 근거: 혜 줄 빈출 惠·慧·蕙가 같은 성별이면 감점이 상쇄된다.
        // 惠만 Neutral 로 바꾸면 여자 혜 이름 52명의 1순위가 慧로 넘어갔다(2026-10-22 측정). 바꾸려면 셋을 함께.
        // 慧만 바꾸면 1순위 이동은 없지만 2~4순위 77쪽이 바뀌고 여자 50쪽에서 慧 가 빠진다(새 쌍 68 — 2026-10-26 측정). 셋 모두 Neutral 이면
        // 여자 혜 이름 75명이 '잘 맞음'(−2·−3)을 잃는다 — 2026-10-26 오분류 정리에서도 셋을 Female 로 두었다.
        var genders = new[] { "惠", "慧", "蕙" }.Select(c => HanjaData.FindByCharacter(c)!.GenderPref).Distinct().ToList();
        Assert.Single(genders);
    }

    // ── 2026-10-26 결정 ③ 뒤: 키워드 부분 일치로 성별이 붙은 10자 → Neutral (사용자 결정 '오분류를 고친 뒤 배포') ──
    // 성별 판정이 보이는 한자 한 글자로 바뀌자(결정 ③) 아래 글자가 인기 이름 1순위 조합에 올라 '맞지 않음'(−2)을 냈다(/name 342명 중 300명 안팎 —
    // 유찬 裕燦·우빈 宇彬·요한 耀翰·동균 東均·학준 鶴俊). 값의 출처는 오프라인 분류기(scripts/classify_gender_tone.py → data/hanja_unihan.json genderPref)의
    // 부분 일치다: 성별 없는 형용사 '빛날'·'밝을', 독음과 겹친 키워드 '학', 영문 'fair'·'vigor', C#·파이썬 공통 '칼'. 값이 그 음절의 쓰임과 반대인
    // 글자만 고치고 Male 로 뒤집지 않는다(찬 음절의 남자 쏠림은 인구 분포다). 亨·衡('형' 독음 일치 — 兄 을 노린 키워드)은 Male 이 형 음절의 쓰임과
    // 같은 쪽이라 둔다(建 Male·惠 Female 관례와 같은 판단 — Neutral 이면 여자 형 5명이 풀리고 남자 형 73명이 −2·−3, 순손실). 정수 코드포인트로 적는다.
    [Theory]
    [InlineData(0x71E6)] // 燦 빛날 찬 — Female '빛날'
    [InlineData(0x8F1D)] // 輝 빛날 휘 — Female '빛날'
    [InlineData(0x5F6C)] // 彬 빛날 빈, 밝을 반 — Female '빛날'·'밝을'
    [InlineData(0x658C)] // 斌 빛날 빈 — Female '빛날'
    [InlineData(0x8000)] // 耀 빛날 요 — Female '빛날'
    [InlineData(0x5747)] // 均 고를 균 — 영문 'fair'(공정)가 Female 영문 키워드와 부분 일치
    [InlineData(0x5B78)] // 學 배울 학 — Female 키워드 '학'(鶴을 노린 것)이 독음과 부분 일치
    [InlineData(0x9DB4)] // 鶴 학 학(두루미) — 키워드 '학'이 노린 글자(봉황·나비·제비와 함께 여성 새)지만 두루미는 장수·선비 상징이라 판단으로 Neutral
    [InlineData(0x4E7C)] // 乼 줄칼 줄(연장) — Male 키워드 '칼'(무기). 줄 음절 이름은 출생 통계상 모두 여자
    [InlineData(0x8301)] // 茁 싹 줄 — 영문 'vigorous'의 'vigor'
    public void KeywordMisclassified_IsNeutral_ViaOverrideFile(int codepoint)
    {
        var ch = Cp(codepoint);
        Assert.Equal("Neutral", LoadOverrideFile()[ch]); // 분류기를 고친 게 아니라 오버라이드 파일로 고정했다
        var info = HanjaData.FindByCharacter(ch);
        Assert.NotNull(info);
        Assert.Equal(HanjaData.GenderPreference.Neutral, info!.GenderPref);
    }

    /// <summary>
    /// 亨·衡 은 오버라이드에 넣지 않는다(2026-10-26 — 결정 대기 항목이 '분류가 맞고 조합 선택이 문제'로 적은 글자, 사용자 결정 범위 밖).
    /// 여자 형 이름 5명(가형 佳亨·나형 羅衡 …)의 /name '맞지 않음'은 선택기 항목(SelectCombos ↔ Select) 몫으로 남는다. 바꾸려면 결정을 먼저 기록할 것.
    /// </summary>
    [Theory]
    [InlineData(0x4EA8)] // 亨 형통할 형
    [InlineData(0x8861)] // 衡 저울대 형
    public void HyeongCommonHanja_StayMale_NotOverridden(int codepoint)
    {
        var ch = Cp(codepoint);
        Assert.False(LoadOverrideFile().ContainsKey(ch));
        Assert.Equal(HanjaData.GenderPreference.Male, HanjaData.FindByCharacter(ch)!.GenderPref);
    }

    /// <summary>
    /// 같은 줄의 빈출 글자는 함께 바꾼다(惠 효과 방지) — 하나만 Neutral 이면 선택기의 같은 성별 +40 이 1순위를 다른 글자로 넘긴다
    /// (2026-10-26 측정: 學만 바꾸면 남자 학 이름 9명 1순위 鶴→學, 鶴만이면 16명 學→鶴, 亨·衡 하나만이면 38~43명, 彬만이면 /evaluate 여자 빈 21행 彬→斌,
    /// 乼만이면 줄리 조합에 새 쌍 乼利). 오버라이드를 되돌릴 때도 묶음으로. 亨·衡 은 Male 로 두었지만(위 주석) 바꾸게 되면 같은 이유로 함께.
    /// </summary>
    [Theory]
    [InlineData("학", 0x5B78, 0x9DB4)] // 學·鶴
    [InlineData("빈", 0x5F6C, 0x658C)] // 彬·斌
    [InlineData("형", 0x4EA8, 0x8861)] // 亨·衡 — 둘 다 Male 유지
    [InlineData("줄", 0x4E7C, 0x8301)] // 乼·茁 — 줄 줄의 두 글자 전부
    public void SameLineCommonPair_ShareOneGender(string syllable, int first, int second)
    {
        var a = HanjaData.FindByCharacter(Cp(first));
        var b = HanjaData.FindByCharacter(Cp(second));
        Assert.NotNull(a);
        Assert.NotNull(b);
        Assert.Contains(HanjaSelector.UsableByReading(syllable), h => h.Character == a!.Character);
        Assert.Contains(HanjaSelector.UsableByReading(syllable), h => h.Character == b!.Character);
        Assert.Equal(a!.GenderPref, b!.GenderPref);
    }

    [Theory]
    [InlineData("준혁")]
    [InlineData("승혁")]
    [InlineData("민혁")]
    public void SelectCombos_MaleHyeok_UsesHyeokOfBrightness_NotQuietHyeok(string name)
    {
        var combos = HanjaSelector.SelectCombos(name, "male", 4);

        Assert.NotEmpty(combos);
        Assert.Equal("赫", combos[0].Second);
        Assert.DoesNotContain(combos, c => c.Second == "侐"); // 고요할 혁(D등급)
    }

    [Theory]
    [InlineData("은찬")]
    [InlineData("은호")]
    [InlineData("은성")]
    public void SelectCombos_MaleEun_IncludesGrace(string name)
    {
        // 恩이 Female 이던 때는 남자 은 이름 55명 1순위가 전부 銀이었고 恩은 −400 으로 밀렸다
        var combos = HanjaSelector.SelectCombos(name, "male", 4);
        Assert.Contains(combos, c => c.First == "恩");
    }

    // ── 2026-10-26 B6 보완: 산호(珊·瑚)는 옥·구슬 훈 글자처럼 Female — GenderToneClassifier 보석 키워드에 '산호'가 없어 Neutral 이었다 ──
    // B1(인명용 목록 보강)로 珊(산호 산)이 山(메 산)과 관련도가 같아지자 오행 상생 가점(±20/−12)만으로 남자 이름 산 줄이 珊으로 넘어가
    // 강산=江珊·태산=泰珊·산하=珊河(江山·泰山·山河 탈락), 산호·호산·윤산 1순위가 珊 이 됐다(대표 뜻·서사는 산(山)을 말함). 정수 코드포인트로 적는다.

    private static string Cp(int codepoint) => char.ConvertFromUtf32(codepoint);

    [Theory]
    [InlineData(0x73CA)] // 珊 산호 산
    [InlineData(0x745A)] // 瑚 산호 호
    [InlineData(0x73E0)] // 珠 구슬 주 — 같은 부류의 기준 글자
    public void CoralLikeJewel_IsFemale(int codepoint)
    {
        var info = HanjaData.FindByCharacter(Cp(codepoint));
        Assert.NotNull(info);
        Assert.Equal(HanjaData.GenderPreference.Female, info!.GenderPref);
    }

    [Theory]
    [InlineData("강산", 0x6C5F, 0x5C71)] // 江山
    [InlineData("태산", 0x6CF0, 0x5C71)] // 泰山
    [InlineData("산하", 0x5C71, 0x6CB3)] // 山河
    public void SelectCombos_MaleSan_KeepsMountainWordPair(string name, int first, int second)
    {
        var combos = HanjaSelector.SelectCombos(name, "male", 4);
        Assert.Contains((Cp(first), Cp(second)), combos);
    }

    [Theory]
    [InlineData("산호", 0)]
    [InlineData("호산", 1)]
    [InlineData("윤산", 1)]
    [InlineData("기산", 1)]
    [InlineData("영산", 1)]
    public void SelectCombos_MaleSan_TopComboUsesMountain(string name, int sanIndex)
    {
        var combos = HanjaSelector.SelectCombos(name, "male", 4);
        Assert.NotEmpty(combos);
        var top = combos[0];
        Assert.Equal(Cp(0x5C71), sanIndex == 0 ? top.First : top.Second); // 山
    }

    [Fact]
    public async Task Aesthetic_Junhyeok_NoGenderMismatchNote()
    {
        // 혁 음절에 Female 글자(赫·焃·焱)만 있어 '맞지 않음' 노트가 '잘 맞음'과 함께 떴다(감사 ND-7)
        var b = await new AestheticEngine().CalculateScoreWithBreakdownAsync("준혁", null, "neutral", "male");
        Assert.DoesNotContain(b.Notes, n => n.Contains("맞지 않음"));
    }
}
