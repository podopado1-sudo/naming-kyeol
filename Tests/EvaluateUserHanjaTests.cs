using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using NameForm.Application.DTOs;
using NameForm.Application.Engines;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using NameForm.Application.Services;
using static NameForm.Application.Engines.Data.HanjaData;

namespace NameForm.Tests;

/// <summary>
/// /evaluate 에 사용자가 정한 한자(picks)가 계산에 들어가는지 — 설계서 docs/plan-hanja-input-2026-11.md §13-1 ⑧~⑭·⑰ 의 서비스 층 몫
/// (응답 hanjaSummary·컨트롤러 검증·통계 키·로그·/hanja/resolve 는 <see cref="EvaluateHanjaApiTests"/>).
/// 실제 사주·용신 서비스로 돌린다. 출생일이 들어가는 기대값(용신·자동 배정 한자·점수)은 숫자를 적어 두지 않고 테스트 안에서 다시 센다 —
/// 획수·음양·성별 값은 사전 원자료(HanjaInfo)에서, 자동 배정은 같은 조건의 지정 없는 실행에서 읽는다.
/// ⚠️ 한자는 코드포인트 숫자(<see cref="Cp"/>)로만 적는다. 주석의 한자는 모두 통합 한자다.
/// </summary>
public class EvaluateUserHanjaTests
{
    private readonly SajuCalculationService _saju = new();
    private readonly YongshinCalculationService _yongshin = new();

    public EvaluateUserHanjaTests()
    {
        HanjaData.LoadExternalData();
    }

    private HarmonyEngine Harmony() => new(_saju, _yongshin);
    private ScoringService Scoring() => new(new AestheticEngine(), Harmony(), new RarityScoringEngine());
    private NameEvaluationService Service() => new(Scoring(), new ExplanationEngine());

    private static string Cp(int codePoint) => char.ConvertFromUtf32(codePoint);
    private static HanjaInfo Hanja(int codePoint) => HanjaData.FindByCharacter(Cp(codePoint))
        ?? throw new InvalidOperationException($"U+{codePoint:X4} 가 사전에 없다");

    private static readonly JsonSerializerOptions JsonOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    private static string Json(object value) => JsonSerializer.Serialize(value, JsonOptions);

    /// <summary>입력 문자열 → 지정(문제가 없어야 한다). 지정 없음이면 null.</summary>
    private static HanjaPicks? Resolve(string name, string lastName, string? nameHanja, string? lastNameHanja = null)
    {
        var (picks, problem) = HanjaInput.Resolve(name, lastName, nameHanja, lastNameHanja);
        Assert.True(problem == null, $"{name}/{lastName}: {problem?.Code} {problem?.Message}");
        return picks;
    }

    private static HanjaPicks Picks(string name, string lastName, string? nameHanja, string? lastNameHanja = null)
        => Resolve(name, lastName, nameHanja, lastNameHanja) ?? throw new InvalidOperationException("지정 없음으로 접혔다");

    private static (int Won, int Hyeong, int I, int Jeong) Suri(IEnumerable<string> notes)
    {
        var note = Assert.Single(notes, n => n.StartsWith("수리사격(전통 81수리, 참고): "));
        var m = Regex.Match(note, @"원격 (\d+)\(.+?\) · 형격 (\d+)\(.+?\) · 이격 (\d+)\(.+?\) · 정격 (\d+)\(");
        Assert.True(m.Success, note);
        return (int.Parse(m.Groups[1].Value), int.Parse(m.Groups[2].Value), int.Parse(m.Groups[3].Value), int.Parse(m.Groups[4].Value));
    }

    private const string StrokeBasisPiece = "획수는 유니코드 총획 기준이라 작명소의 원획과 다를 수 있으니 수리는 참고로 봐 주세요.";
    private const string NameAllPicked = "이름 획수는 고른 한자로 셌어요.";
    private const string NameMixed = "이름 획수는 고른 한자와 자동으로 고른 한자를 함께 셌어요. 자동으로 고른 글자는 추정이라 실제 한자가 다르면 수리가 달라질 수 있어요.";
    private const string NameAllAuto = "이름 획수는 자동으로 고른 한자로 추정했어요. 실제 한자가 다르면 수리가 달라질 수 있어요.";
    private const string SurnameEstimated = "성씨 한자는 추정이에요.";

    private const string BlankSomeNote = "한자를 두지 않은 음절이 있어 획수 기반 추정을 사용했습니다";
    private const string BlankAllNote = "한자를 두지 않아 기본값을 사용했습니다";
    private const string BlankStrokeNote = "한자를 두지 않은 음절이 있어 획수 조화를 낮춰 계산했습니다 (감산)";
    private const string AutoSomeNote = "일부 음절에 배정할 한자가 없어 획수 기반 추정을 사용했습니다";
    private const string AutoAllNote = "배정할 한자가 없어 기본값을 사용했습니다";
    private const string AutoStrokeNote = "일부 한자 획수 정보 부족 — 획수 조화 신뢰도 감산";

    private static bool IsOldBasisNote(string note) => note.StartsWith("획수는 성씨");
    private static bool IsNewBasisNote(string note) => note.StartsWith("이름 획수는 ");

    private static readonly (string? Date, string? Time)[] Births = { (null, null), ("2024-03-15", null), ("2021-07-08", "09:30") };
    private static readonly string[] Genders = { "male", "female", "none" };

    private static DateTime? D(string? date) => date == null ? null : DateTime.Parse(date);
    private static TimeSpan? T(string? time) => time == null ? null : TimeSpan.Parse(time);

    // ═══════════════════════════════════════════════════════════════
    // ⑧ 지정 없음 = 지금과 같다
    // ═══════════════════════════════════════════════════════════════

    /// <summary>
    /// ⑧ 의 서비스 층 몫 — 전부 '*' 와 대표 성씨 한자는 '지정 없음'(picks == null)으로 접힌다. 서비스는 picks 가 null 이면 예전 경로를 그대로 타므로,
    /// 접힌 요청의 응답이 필드 없는 요청과 직렬화까지 같다는 것은 컨트롤러 층(EvaluateHanjaApiTests.Folded_Request_…)이 본다
    /// (여기서 null 을 넘긴 호출과 인자를 안 준 호출을 견주면 같은 호출을 두 번 견주는 꼴이라 늘 참이다).
    /// 여기서는 접기가 지키는 것을 본다: 접히지 않은 '전부 자동' 지정을 손으로 만들어 넘기면 점수는 같아도 응답이 달라진다(고름 표시).
    /// </summary>
    [Fact]
    public async Task Unspecified_AllAutoAndRepresentativeSurname_FoldsToNoPicks_AndFoldingIsWhatKeepsTheResponse()
    {
        var service = Service();
        foreach (var name in new[] { "서윤", "지우", "민준", "하늘", "한빛", "민", "서아린", "몰닉" })
        {
            // 전부 '*' + 대표 한자(李, 통합·호환 코드 모두) → 지정 없음
            foreach (var surnameHanja in new[] { Cp(0x674E), Cp(0xF9E1), "*", "" })
                Assert.Null(Resolve(name, "이", new string('*', name.Length), surnameHanja));

            // 접히지 않았다면 — 전부 자동인 지정을 그대로 넘긴 경우
            var unfolded = new HanjaPicks(Enumerable.Repeat(HanjaPick.Auto, name.Length).ToList(), null);
            foreach (var gender in Genders)
                foreach (var (date, time) in Births)
                {
                    var plain = await service.EvaluateNameAsync(name, "이", D(date), gender, "neutral", T(time));
                    var kept = await service.EvaluateNameAsync(name, "이", D(date), gender, "neutral", T(time), unfolded);

                    // 계산에 쓴 글자가 같으니 점수는 같다
                    Assert.Equal(plain.AestheticScore, kept.AestheticScore);
                    Assert.Equal(plain.HarmonyScore, kept.HarmonyScore);
                    Assert.Equal(plain.FinalScore, kept.FinalScore);
                    // 그래도 응답은 다르다 — 한자를 정한 요청으로 표시된다. 접기가 없으면 아무것도 고르지 않은 사람에게 이 표시가 붙는다
                    Assert.False(plain.HanjaSummary!.UserHanja);
                    Assert.True(kept.HanjaSummary!.UserHanja);
                    Assert.NotEqual(Json(plain), Json(kept));
                    // 수리 기준 노트: 예전 경로는 예전 두 문장, 지정 경로는 조립 문장(한자가 하나라도 있고 조화를 계산했을 때)
                    Assert.DoesNotContain(plain.Harmony.Notes, IsNewBasisNote);
                    Assert.DoesNotContain(kept.Harmony.Notes, IsOldBasisNote);
                    Assert.Equal(plain.Harmony.Notes.Count(IsOldBasisNote), kept.Harmony.Notes.Count(IsNewBasisNote));
                }
        }
    }

    /// <summary>
    /// ⑧-2 의 서비스 층 몫 — 한자를 하나도 고르지 않은 순우리말 음절 이름: 잠긴 칸·쓸 글자 없는 칸의 '-' 는 자동으로 접혀 지정 없음이 된다.
    /// 접기가 지키는 것: 접히지 않고 그 칸이 '한자 없음'으로 넘어가면 조화 노트가 '한자를 두지 않은 …' 문장으로 바뀐다(예전 문장이 사라진다).
    /// 접힌 요청의 응답이 필드 없는 요청과 같다는 것은 컨트롤러 층(EvaluateHanjaApiTests.Folded_Request_…)이 본다.
    /// </summary>
    [Theory]
    [InlineData("한빛", "*-")]
    [InlineData("빛봄", "--")]
    [InlineData("봄", "-")]
    [InlineData("몰닉", "--")]
    public async Task Unspecified_NoneMarkOnSyllableWithoutUsableHanja_FoldsToNoPicks_AndFoldingKeepsTheOldNotes(string name, string nameHanja)
    {
        Assert.Null(Resolve(name, "김", nameHanja));

        // 접히지 않았다면 — 같은 칸을 '한자 없음'으로 둔 지정
        var unfolded = new HanjaPicks(nameHanja.Select(c => c == HanjaInput.NoneMark ? HanjaPick.None : HanjaPick.Auto).ToList(), null);
        Assert.True(unfolded.AnyNone);

        var service = Service();
        foreach (var (date, time) in Births)
        {
            var plain = await service.EvaluateNameAsync(name, "김", D(date), "none", "neutral", T(time));
            var kept = await service.EvaluateNameAsync(name, "김", D(date), "none", "neutral", T(time), unfolded);

            // 지정 없는 경로: 사용자가 비운 칸이 없으니 '한자를 두지 않은' 문장은 나오지 않는다
            Assert.DoesNotContain(plain.Harmony.Notes, n => n == BlankSomeNote || n == BlankAllNote || n == BlankStrokeNote);
            Assert.False(plain.HanjaSummary!.UserHanja);
            Assert.True(kept.HanjaSummary!.UserHanja);
            if (date != null)
            {
                Assert.Contains(plain.Harmony.Notes, n => n == AutoSomeNote || n == AutoAllNote);
                // 접히지 않은 쪽은 문장이 바뀐다 — 접기가 막는 차이
                Assert.Contains(kept.Harmony.Notes, n => n == BlankSomeNote || n == BlankAllNote);
                Assert.DoesNotContain(kept.Harmony.Notes, n => n == AutoSomeNote || n == AutoAllNote);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑨ 자동 배정과 같은 글자를 고르면 점수가 같다
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task PickingTheAutoAssignedHanja_ChangesOnlyTheSuriBasisNote()
    {
        var service = Service();
        var scoring = Scoring();
        int compared = 0, withBasisNote = 0;

        foreach (var (name, lastName) in new[] { ("서윤", "이"), ("지우", "김"), ("민준", "박"), ("하늘", "제갈"), ("한빛", "유"),
                     ("도현", "탕"), ("서아린", "남궁"), ("민", "최"), ("유림", "정") })
            foreach (var gender in Genders)
                foreach (var (date, time) in Births)
                {
                    var autoScore = await scoring.EvaluateAsync(name, lastName, D(date), gender, "neutral", T(time));
                    var assigned = autoScore.AssignedHanja;
                    Assert.Equal(name.Length, assigned.Count);
                    if (assigned.All(h => h == null)) continue;

                    // 자동 배정 글자를 그대로 넣는다(배정이 없는 칸은 자동)
                    var picks = Picks(name, lastName, string.Concat(assigned.Select(h => h?.Character ?? "*")));
                    Assert.False(picks.AnyNone);

                    var auto = await service.EvaluateNameAsync(name, lastName, D(date), gender, "neutral", T(time));
                    var picked = await service.EvaluateNameAsync(name, lastName, D(date), gender, "neutral", T(time), picks);
                    compared++;

                    // 달라지는 것은 수리 기준 노트 한 문장뿐 — 그 문장을 되돌리면 응답 전체(미학·조화·종합·breakdown·의미 메모·후보 표)가 같다
                    int index = auto.Harmony.Notes.FindIndex(IsOldBasisNote);
                    if (index >= 0)
                    {
                        withBasisNote++;
                        Assert.True(IsNewBasisNote(picked.Harmony.Notes[index]), picked.Harmony.Notes[index]);
                        Assert.Equal(auto.Harmony.Notes.Count, picked.Harmony.Notes.Count);
                        picked.Harmony.Notes[index] = auto.Harmony.Notes[index];
                    }
                    else
                    {
                        Assert.DoesNotContain(picked.Harmony.Notes, IsNewBasisNote);
                    }

                    // 응답의 '이 이름의 한자'(hanjaSummary — C2)에서 달라지는 것은 '고름' 표시뿐이다: userHanja, 정규 꼴, 고른 칸의 source.
                    // 글자·사실·오행 역할(fills)·성씨·elementFit 은 같다 — 표시를 되돌리면 응답 전체가 같아야 한다.
                    var autoSummary = auto.HanjaSummary!;
                    var pickedSummary = picked.HanjaSummary!;
                    Assert.False(autoSummary.UserHanja);
                    Assert.Equal("", autoSummary.NameHanja);
                    Assert.True(pickedSummary.UserHanja);
                    Assert.Equal(string.Concat(assigned.Select(h => h?.Character ?? "*")), pickedSummary.NameHanja);
                    for (int i = 0; i < name.Length; i++)
                    {
                        Assert.Equal(assigned[i] != null ? "auto" : "unavailable", autoSummary.Syllables[i].Source);
                        Assert.Equal(assigned[i] != null ? "user" : "unavailable", pickedSummary.Syllables[i].Source);
                        pickedSummary.Syllables[i].Source = autoSummary.Syllables[i].Source;
                    }
                    pickedSummary.UserHanja = false;
                    pickedSummary.NameHanja = "";

                    Assert.Equal(Json(auto), Json(picked));
                }

        Assert.True(compared >= 70, $"대조한 행 {compared}");
        Assert.True(withBasisNote >= 40, $"수리 기준 노트가 있던 행 {withBasisNote}");
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑩ 고른 글자가 계산에 들어간다
    // ═══════════════════════════════════════════════════════════════

    /// <summary>한 음절에서 성질이 서로 다른 후보 몇 자 — 맨 앞 글자, 여성·남성 글자, 획수 홀짝이 다른 글자, 자원오행이 다른 글자.</summary>
    private static List<HanjaInfo> Options(char syllable)
    {
        var usable = HanjaInput.CandidatesFor(syllable).Where(HanjaSelector.IsUsableNameHanja).ToList();
        var first = usable[0];
        return new[]
            {
                first,
                usable.FirstOrDefault(h => h.GenderPref == GenderPreference.Female),
                usable.FirstOrDefault(h => h.GenderPref == GenderPreference.Male),
                usable.FirstOrDefault(h => h.StrokeCount % 2 != first.StrokeCount % 2),
                usable.FirstOrDefault(h => h.FiveElement != first.FiveElement),
            }
            .Where(h => h != null).Select(h => h!).Distinct().ToList();
    }

    private static int ExpectedHarmonyGenderBonus(IEnumerable<HanjaInfo?> hanja, string gender)
    {
        var wanted = gender == "male" ? GenderPreference.Male : gender == "female" ? GenderPreference.Female : GenderPreference.Neutral;
        if (wanted == GenderPreference.Neutral) return 0;
        int bonus = 0;
        foreach (var h in hanja)
        {
            if (h == null || h.GenderPref == GenderPreference.Neutral) continue;
            // 쓸 수 있는 글자만 센다 — 불용이 아니고 뜻이 있다(검사 대상 술어를 부르지 않고 따로 쓴다)
            if (HanjaData.IsForbiddenNameHanja(h.Character) || string.IsNullOrEmpty(h.Meaning)) continue;
            bonus += h.GenderPref == wanted ? 5 : -3;
        }
        return bonus;
    }

    [Theory]
    [InlineData("서윤", "이", "female", "2024-03-15")]
    [InlineData("도현", "김", "male", "2021-07-08")]
    [InlineData("미나", "박", "female", "2023-11-20")]
    [InlineData("지우", "최", "none", "2022-02-04")]
    public async Task PickedHanja_EntersStrokesYinYangSuriGenderAndElementTerms(string name, string lastName, string gender, string date)
    {
        var birth = DateTime.Parse(date);
        var scoring = Scoring();
        var auto = await scoring.EvaluateAsync(name, lastName, birth, gender, "neutral");
        int surnameStrokes = SurnameData.RepresentativeHanja[lastName].EnumerateRunes()
            .Sum(r => HanjaData.FindByCharacter(r.ToString())!.StrokeCount);
        var yongshin = _yongshin.Calculate(_saju.CalculateChart(birth, null));

        var rows = new List<(HarmonyBreakdown H, HanjaInfo A, HanjaInfo B)>();
        foreach (var a in Options(name[0]))
            foreach (var b in Options(name[1]))
            {
                var score = await scoring.EvaluateAsync(name, lastName, birth, gender, "neutral", null, Picks(name, lastName, a.Character + b.Character));
                var h = score.Harmony;
                rows.Add((h, a, b));

                Assert.Equal(new HanjaInfo?[] { a, b }, score.AssignedHanja);
                Assert.Equal(new HanjaInfo?[] { a, b }, h.SelectedHanja);

                // 음양 = 획수 홀짝(홀 陽)
                int yang = new[] { a, b }.Count(x => x.StrokeCount % 2 == 1), yin = 2 - yang;
                Assert.Equal((int)(FortuneUtils.EvaluateYinYangBalance(yin, yang) * 0.1), h.YinYangScore);
                Assert.Contains(yin > 0 && yang > 0 ? $"음양 균형: 陰 {yin} / 陽 {yang}" : yin > 0 ? $"음양: 陰 편중 ({yin})" : $"음양: 陽 편중 ({yang})", h.Notes);

                // 획수 조화 = 두 글자 획수 합의 구간
                Assert.Equal((int)(FortuneUtils.EvaluateStrokeCount(a.StrokeCount, b.StrokeCount) * 0.2), h.ResourceElementScore);

                // 수리 — 원격 = 첫 글자, 형격 − 원격 = 성씨 획수, 이격 = 두 글자, 정격 = 성씨 + 두 글자
                var suri = Suri(h.Notes);
                Assert.Equal(a.StrokeCount, suri.Won);
                Assert.Equal(surnameStrokes, suri.Hyeong - suri.Won);
                Assert.Equal(a.StrokeCount + b.StrokeCount, suri.I);
                Assert.Equal(surnameStrokes + a.StrokeCount + b.StrokeCount, suri.Jeong);

                // 조화의 성별 보정 = 쓸 수 있는 글자마다 일치 +5·불일치 −3
                int expectedGender = ExpectedHarmonyGenderBonus(new[] { a, b }, gender);
                Assert.Equal(expectedGender, h.GenderBonus);
                Assert.Equal(expectedGender != 0, h.Notes.Any(n => n.StartsWith("성별 선호도 ")));

                // 자원오행 보완 — 고른 글자의 자원오행이 용신·희신·기신 노트를 정한다
                bool Has(string? element) => !string.IsNullOrEmpty(element) && (a.FiveElement == element || b.FiveElement == element);
                Assert.Equal(Has(yongshin.PrimaryYongshin), h.Notes.Contains($"용신 '{yongshin.PrimaryYongshin}' 보완"));
                Assert.Equal(Has(yongshin.Heeshin), h.Notes.Contains($"희신 '{yongshin.Heeshin}' 포함"));
                Assert.Equal(Has(yongshin.Gishin), h.Notes.Contains($"기신 '{yongshin.Gishin}' 충돌 (감점)"));

                // 한자를 바꿔도 발음오행과 미학의 성별 보너스 밖 항목은 같다
                Assert.Equal(auto.Harmony.PronunciationElementScore, h.PronunciationElementScore);
                Assert.Equal(
                    (auto.Aesthetic.PronunciationScore, auto.Aesthetic.RhythmScore, auto.Aesthetic.SyllableScore, auto.Aesthetic.NeutralityScore,
                        auto.Aesthetic.MeaningScore, auto.Aesthetic.ToneBonus, auto.Aesthetic.PenaltyTotal),
                    (score.Aesthetic.PronunciationScore, score.Aesthetic.RhythmScore, score.Aesthetic.SyllableScore, score.Aesthetic.NeutralityScore,
                        score.Aesthetic.MeaningScore, score.Aesthetic.ToneBonus, score.Aesthetic.PenaltyTotal));

                // 대체값 없음, 기준 노트는 '고른 한자' 꼴
                Assert.False(h.UsedFallback);
                Assert.Contains($"{NameAllPicked} 성씨는 기본으로 두는 한자({SurnameData.RepresentativeHanja[lastName]})로 추정했어요. {StrokeBasisPiece}", h.Notes);

                // 조화 합계 = 다섯 축 + 성별 보정(0~100 으로 자른다)
                int raw = h.FiveElementScore + h.ResourceElementScore + h.YinYangScore + h.PronunciationElementScore + h.SuriSagyeokScore + h.GenderBonus;
                Assert.Equal(Math.Clamp(raw, 0, 100), h.TotalScore);
                Assert.Equal(h.TotalScore, score.HarmonyScore);
                Assert.Equal((int)Math.Round(score.AestheticScore * 0.7 + score.HarmonyScore * 0.3), score.FinalScore);
            }

        // 두 조합의 조화 점수 차이 = 네 축 차이 + 성별 보정 차이(발음오행은 같다) — 자르기 전 범위의 행끼리
        var unclamped = rows.Where(r =>
        {
            int raw = r.H.FiveElementScore + r.H.ResourceElementScore + r.H.YinYangScore + r.H.PronunciationElementScore + r.H.SuriSagyeokScore + r.H.GenderBonus;
            return raw is >= 0 and <= 100;
        }).ToList();
        Assert.True(unclamped.Count >= 4, $"자르지 않은 행 {unclamped.Count}");
        var x = unclamped[0];
        foreach (var y in unclamped.Skip(1))
            Assert.Equal(
                (x.H.FiveElementScore - y.H.FiveElementScore) + (x.H.ResourceElementScore - y.H.ResourceElementScore)
                    + (x.H.YinYangScore - y.H.YinYangScore) + (x.H.SuriSagyeokScore - y.H.SuriSagyeokScore) + (x.H.GenderBonus - y.H.GenderBonus),
                x.H.TotalScore - y.H.TotalScore);

        // 검사가 비어 있지 않다 — 조합마다 값이 실제로 갈린다
        Assert.True(rows.Count >= 4, $"조합 {rows.Count}개");
        Assert.True(rows.Select(r => r.H.YinYangScore).Distinct().Count() >= 2, "음양 점수가 한 값뿐");
        Assert.True(rows.Select(r => Suri(r.H.Notes).Jeong).Distinct().Count() >= 2, "정격이 한 값뿐");
        if (gender != "none")
            Assert.True(rows.Select(r => r.H.GenderBonus).Distinct().Count() >= 2, "성별 보정이 한 값뿐");
        else
            Assert.All(rows, r => Assert.Equal(0, r.H.GenderBonus));
    }

    /// <summary>미학 성별 보너스·의미 메모·후보 표 첫 칸은 덮어쓴 목록(AssignedHanja)을 따른다 — 출생일이 없어도.</summary>
    [Theory]
    [InlineData("2024-03-15")]
    [InlineData(null)]
    public async Task PickedHanja_DrivesAestheticGenderBonusMeaningNoteAndCandidateTable(string? date)
    {
        const string name = "서윤", lastName = "이", gender = "female";
        var scoring = Scoring();
        var service = Service();
        var aesthetic = new AestheticEngine();

        foreach (var a in Options('서'))
            foreach (var b in Options('윤'))
            {
                var picks = Picks(name, lastName, a.Character + b.Character);
                var score = await scoring.EvaluateAsync(name, lastName, D(date), gender, "neutral", null, picks);
                Assert.Equal(new HanjaInfo?[] { a, b }, score.AssignedHanja);

                // 미학 — 같은 목록을 보이는 한자로 넘겨 직접 매긴 결과와 같다(미학 엔진은 이번에 손대지 않았다)
                var direct = await aesthetic.CalculateScoreWithBreakdownAsync(name, lastName, "neutral", gender, D(date)?.Year, new HanjaInfo?[] { a, b });
                Assert.Equal(direct.GenderBonus, score.Aesthetic.GenderBonus);
                Assert.Equal(direct.TotalScore, score.Aesthetic.TotalScore);
                Assert.Equal(direct.Notes, score.Aesthetic.Notes);

                var dto = await service.EvaluateNameAsync(name, lastName, D(date), gender, "neutral", null, picks);
                Assert.StartsWith($"{a.Character}(서, {HanjaData.GlossForReading(a.Meaning, "서")}) + {b.Character}(윤, {HanjaData.GlossForReading(b.Meaning, "윤")})", dto.MeaningNote);
                Assert.Equal(a.Character, dto.HanjaCandidates[0].Candidates[0].Character);
                Assert.Equal(b.Character, dto.HanjaCandidates[1].Candidates[0].Character);
                Assert.Equal(date != null, dto.BirthDateProvided);
            }
    }

    /// <summary>두음 꼴 칸(임 + 林) — 자동 배정의 독음 조회(FindByReading)에는 없는 글자도 고르면 계산·메모·후보 표 첫 칸에 들어간다.</summary>
    [Fact]
    public async Task PickedHanja_InDueumSlot_IsUsedAndShown()
    {
        var rim = Hanja(0x6797);   // 林
        Assert.DoesNotContain(rim, HanjaData.FindByReading("임"));   // 그래서 자동 배정은 이 글자를 고르지 못한다

        var picks = Picks("서임", "김", "*" + rim.Character);
        var dto = await Service().EvaluateNameAsync("서임", "김", new DateTime(2024, 3, 15), "none", "neutral", null, picks);
        Assert.Equal(rim.Character, dto.HanjaCandidates[1].Candidates[0].Character);
        Assert.Contains($"{rim.Character}(임, {HanjaData.GlossForReading(rim.Meaning, "임")})", dto.MeaningNote);
        Assert.Contains($"{NameMixed} 성씨는 기본으로 두는 한자({Cp(0x91D1)})로 추정했어요. {StrokeBasisPiece}", dto.Harmony.Notes);
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑪ 성씨 한자
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task Surname_PickedHanja_SetsTheSurnameStrokesOfSuri()
    {
        var birth = new DateTime(2024, 3, 15);
        var harmony = Harmony();
        var ryu = Hanja(0x67F3);    // 柳 — '유'의 대표 한자
        var yu = Hanja(0x5289);     // 劉
        Assert.Equal(ryu.Character, SurnameData.RepresentativeHanja["유"]);
        Assert.NotEqual(ryu.StrokeCount, yu.StrokeCount);

        var auto = await harmony.CalculateScoreWithBreakdownAsync("서윤", "유", birth, "female");
        var autoSuri = Suri(auto.Notes);
        Assert.Equal(ryu.StrokeCount, autoSuri.Hyeong - autoSuri.Won);

        // 유 + 劉 — 이름은 자동 그대로, 성씨 획수만 바뀐다
        var picks = Picks("서윤", "유", null, yu.Character);
        var picked = await harmony.CalculateScoreWithBreakdownAsync("서윤", "유", birth, "female", null, picks);
        var suri = Suri(picked.Notes);
        Assert.Equal(auto.SelectedHanja, picked.SelectedHanja);
        Assert.Equal(autoSuri.Won, suri.Won);
        Assert.Equal(autoSuri.I, suri.I);
        Assert.Equal(yu.StrokeCount, suri.Hyeong - suri.Won);
        Assert.Equal(autoSuri.Jeong - ryu.StrokeCount + yu.StrokeCount, suri.Jeong);
        Assert.Contains($"{NameAllAuto} 성씨 획수는 고른 한자({yu.Character})로 셌어요. {StrokeBasisPiece}", picked.Notes);
        Assert.DoesNotContain(picked.Notes, IsOldBasisNote);

        // 바뀌는 축은 수리뿐
        Assert.Equal(
            (auto.FiveElementScore, auto.ResourceElementScore, auto.YinYangScore, auto.PronunciationElementScore, auto.GenderBonus, auto.UsedFallback),
            (picked.FiveElementScore, picked.ResourceElementScore, picked.YinYangScore, picked.PronunciationElementScore, picked.GenderBonus, picked.UsedFallback));

        // 성씨 한자는 이름용 불용 여부와 상관없이 받는다 — 劉·魯(노)·閔(민)은 사이트 불용 글자다
        Assert.True(HanjaData.IsForbiddenNameHanja(yu.Character));
        var no = Hanja(0x9B6F);     // 魯 — '노'의 대표 한자는 盧
        Assert.True(HanjaData.IsForbiddenNameHanja(no.Character));
        var noPicked = await harmony.CalculateScoreWithBreakdownAsync("서윤", "노", birth, "female", null, Picks("서윤", "노", null, no.Character));
        var noSuri = Suri(noPicked.Notes);
        Assert.Equal(no.StrokeCount, noSuri.Hyeong - noSuri.Won);
        // 대표 한자가 불용인 성씨(민 閔)는 고르지 않아도 그 글자로 센다 — 지정 없음과 같다
        Assert.True(HanjaData.IsForbiddenNameHanja(SurnameData.RepresentativeHanja["민"]));
        Assert.Null(Resolve("서윤", "민", null, SurnameData.RepresentativeHanja["민"]));
    }

    [Fact]
    public async Task Surname_RepresentativeHanja_IsTheSameAsUnspecified_AndCompoundSurnamesSumBothCharacters()
    {
        var birth = new DateTime(2022, 1, 10);
        var harmony = Harmony();

        // '이' + 李 = 지정 없음
        Assert.Null(Resolve("서윤", "이", null, Cp(0x674E)));

        var nam = Hanja(0x5357);     // 南
        var gung = Hanja(0x5BAE);    // 宮
        var male = Hanja(0x7537);    // 男
        var bow = Hanja(0x5F13);     // 弓
        var auto = await harmony.CalculateScoreWithBreakdownAsync("서윤", "남궁", birth, "none");
        var autoSuri = Suri(auto.Notes);
        Assert.Equal(nam.StrokeCount + gung.StrokeCount, autoSuri.Hyeong - autoSuri.Won);

        // 두 글자 모두 고름 — 합
        var both = await harmony.CalculateScoreWithBreakdownAsync("서윤", "남궁", birth, "none", null, Picks("서윤", "남궁", null, male.Character + bow.Character));
        var bothSuri = Suri(both.Notes);
        Assert.Equal(male.StrokeCount + bow.StrokeCount, bothSuri.Hyeong - bothSuri.Won);
        Assert.Contains($"{NameAllAuto} 성씨 획수는 고른 한자({male.Character}{bow.Character})로 셌어요. {StrokeBasisPiece}", both.Notes);

        // 한 글자만 고름 — 나머지 자리는 표의 글자(宮)
        var one = await harmony.CalculateScoreWithBreakdownAsync("서윤", "남궁", birth, "none", null, Picks("서윤", "남궁", null, male.Character + "*"));
        var oneSuri = Suri(one.Notes);
        Assert.Equal(male.StrokeCount + gung.StrokeCount, oneSuri.Hyeong - oneSuri.Won);
        Assert.Contains($"{NameAllAuto} 성씨 획수는 고른 한자({male.Character}{gung.Character})로 셌어요. {StrokeBasisPiece}", one.Notes);

        // 표 밖 성씨 — 고르지 않으면 '추정', 고르면 그 글자
        var tang = Hanja(0x6E6F);    // 湯
        var estimated = await harmony.CalculateScoreWithBreakdownAsync("서윤", "탕", birth, "none", null, Picks("서윤", "탕", Cp(0x745E) + Cp(0x6F64)));
        Assert.Contains($"{NameAllPicked} {SurnameEstimated} {StrokeBasisPiece}", estimated.Notes);
        var chosen = await harmony.CalculateScoreWithBreakdownAsync("서윤", "탕", birth, "none", null, Picks("서윤", "탕", null, tang.Character));
        var chosenSuri = Suri(chosen.Notes);
        Assert.Equal(tang.StrokeCount, chosenSuri.Hyeong - chosenSuri.Won);
        Assert.Contains($"{NameAllAuto} 성씨 획수는 고른 한자({tang.Character})로 셌어요. {StrokeBasisPiece}", chosen.Notes);

        // 복성 한 글자만 골랐는데 나머지 자리의 한자를 정하지 못하면 성씨 획수는 0 이고, 그 사실대로 적는다
        var broken = await harmony.CalculateScoreWithBreakdownAsync("서윤", "탕쁨", birth, "none", null, Picks("서윤", "탕쁨", null, tang.Character + "*"));
        var brokenSuri = Suri(broken.Notes);
        Assert.Equal(0, brokenSuri.Hyeong - brokenSuri.Won);
        Assert.Contains($"{NameAllAuto} 성씨는 한자를 정하지 못한 글자가 있어 성씨 획수를 빼고 셌어요. {StrokeBasisPiece}", broken.Notes);
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑫ 일부만 고름
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("서윤", "이", "female", "2024-03-15")]
    [InlineData("서윤", "이", "female", null)]
    [InlineData("지우", "김", "male", "2021-07-08")]
    [InlineData("지우", "김", "male", null)]
    [InlineData("서아린", "박", "none", "2023-11-20")]
    [InlineData("서아린", "박", "none", null)]
    public async Task PartialPick_OtherSlotsKeepTheAutoAssignmentOfTheSameConditions(string name, string lastName, string gender, string? date)
    {
        var scoring = Scoring();
        var auto = await scoring.EvaluateAsync(name, lastName, D(date), gender, "neutral");
        Assert.All(auto.AssignedHanja, h => Assert.NotNull(h));

        // 자동 배정 — 출생일이 있으면 용신 배정, 없으면 기본 배정(여기서 따로 구한다)
        List<HanjaInfo?> expectedAuto;
        if (date != null)
        {
            var y = _yongshin.Calculate(_saju.CalculateChart(D(date)!.Value, null));
            expectedAuto = HanjaSelector.Select(name, gender, y.PrimaryYongshin, y.Heeshin, y.Gishin);
        }
        else
        {
            expectedAuto = HanjaSelector.DefaultAssignment(name, gender);
        }
        Assert.Equal(expectedAuto, auto.AssignedHanja);

        // 0번 칸에 자동 배정과 다른 글자를 고른다 — 나머지 칸은 다시 맞춰 고르지 않는다
        var other = HanjaInput.CandidatesFor(name[0]).First(h => HanjaSelector.IsUsableNameHanja(h) && !ReferenceEquals(h, expectedAuto[0]));
        var picks = Picks(name, lastName, other.Character + new string('*', name.Length - 1));
        var picked = await scoring.EvaluateAsync(name, lastName, D(date), gender, "neutral", null, picks);

        Assert.Equal(name.Length, picked.AssignedHanja.Count);
        Assert.Same(other, picked.AssignedHanja[0]);
        for (int i = 1; i < name.Length; i++)
            Assert.Same(expectedAuto[i], picked.AssignedHanja[i]);

        if (date != null)
        {
            Assert.Equal(picked.AssignedHanja, picked.Harmony.SelectedHanja);
            Assert.Contains(picked.Harmony.Notes, n => n.StartsWith(NameMixed));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑬ 한자 없음
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task NoneSlot_UsesFallbackPath_WithUserWording_AndNoExampleHanjaInNotes()
    {
        var birth = new DateTime(2024, 3, 15);
        var seo = Hanja(0x745E);    // 瑞
        var service = Service();

        var auto = await service.EvaluateNameAsync("서윤", "이", birth, "female", "neutral");
        Assert.Contains("(윤, ", auto.MeaningNote);
        Assert.False(auto.Harmony.UsedFallback);

        var picks = Picks("서윤", "이", seo.Character + "-");
        Assert.True(picks.AnyNone);
        var score = await Scoring().EvaluateAsync("서윤", "이", birth, "female", "neutral", null, picks);
        Assert.Same(seo, score.AssignedHanja[0]);
        Assert.Null(score.AssignedHanja[1]);

        var dto = await service.EvaluateNameAsync("서윤", "이", birth, "female", "neutral", null, picks);
        Assert.True(dto.Harmony.UsedFallback);
        Assert.True(dto.UsedFallbackHanja);

        // 새 문장 둘(일부 비움) — 자동 경로의 문장은 나오지 않는다
        Assert.Contains(BlankSomeNote, dto.Harmony.Notes);
        Assert.Contains(BlankStrokeNote, dto.Harmony.Notes);
        Assert.DoesNotContain(AutoSomeNote, dto.Harmony.Notes);
        Assert.DoesNotContain(AutoStrokeNote, dto.Harmony.Notes);
        Assert.DoesNotContain(BlankAllNote, dto.Harmony.Notes);

        // 가정 고정 — 획수 조화는 비운 칸을 5획으로 채우고 ×0.75, 수리는 같은 칸을 0획으로 센다
        Assert.Equal((int)Math.Round((int)(FortuneUtils.EvaluateStrokeCount(seo.StrokeCount, 5) * 0.2) * 0.75), dto.Harmony.ResourceElement);
        int surname = Hanja(0x674E).StrokeCount;
        Assert.Equal((seo.StrokeCount, surname + seo.StrokeCount, seo.StrokeCount, surname + seo.StrokeCount), Suri(dto.Harmony.Notes));
        Assert.Contains($"{NameAllPicked} 성씨는 기본으로 두는 한자({Cp(0x674E)})로 추정했어요. {StrokeBasisPiece}", dto.Harmony.Notes);
        Assert.Equal(ExpectedHarmonyGenderBonus(new[] { seo }, "female"), dto.Harmony.GenderBonus);

        // 의미 메모·강점에 그 음절의 다른 글자('한자 예')가 없다 — 폴백을 끈다
        Assert.StartsWith($"{seo.Character}(서, ", dto.MeaningNote);
        Assert.DoesNotContain("(윤, ", dto.MeaningNote);
        Assert.DoesNotContain(" + ", dto.MeaningNote);
        Assert.DoesNotContain(dto.Strengths, s => s.Contains("(윤, "));

        // 후보 표는 그 음절의 후보를 그대로 보인다(다시 고를 수 있게)
        Assert.NotEmpty(dto.HanjaCandidates[1].Candidates);
        Assert.Equal(seo.Character, dto.HanjaCandidates[0].Candidates[0].Character);
    }

    [Theory]
    [InlineData("2024-03-15")]
    [InlineData(null)]
    public async Task NoneOnEverySlot_UsesDefaultsAndSaysTheNameIsKeptInHangul(string? date)
    {
        var service = Service();
        var picks = Picks("서윤", "이", "--");
        var dto = await service.EvaluateNameAsync("서윤", "이", D(date), "female", "neutral", null, picks);
        var score = await Scoring().EvaluateAsync("서윤", "이", D(date), "female", "neutral", null, picks);

        Assert.All(score.AssignedHanja, h => Assert.Null(h));
        Assert.Equal(ExplanationEngine.UserNoHanjaMeaningNote, dto.MeaningNote);
        Assert.DoesNotContain(dto.Strengths, s => s.Contains("(서, ") || s.Contains("(윤, "));
        Assert.Equal(0, dto.Aesthetic.GenderBonus);

        if (date == null)
        {
            Assert.False(dto.BirthDateProvided);
            Assert.Equal(dto.AestheticScore, dto.FinalScore);
            return;
        }

        // 전 음절 한자 없음 → 기본값 분기. 값은 자동 경로에서 전 음절이 비는 이름(빛봄)과 같고, 문장만 다르다
        var autoEmpty = await service.EvaluateNameAsync("빛봄", "이", D(date), "female", "neutral");
        Assert.Contains(AutoAllNote, autoEmpty.Harmony.Notes);
        Assert.Contains(BlankAllNote, dto.Harmony.Notes);
        Assert.DoesNotContain(AutoAllNote, dto.Harmony.Notes);
        Assert.DoesNotContain(dto.Harmony.Notes, n => n == BlankSomeNote || n == BlankStrokeNote || IsNewBasisNote(n) || IsOldBasisNote(n));
        Assert.True(dto.Harmony.UsedFallback);
        Assert.Equal(
            (autoEmpty.Harmony.FiveElement, autoEmpty.Harmony.ResourceElement, autoEmpty.Harmony.YinYang, autoEmpty.Harmony.SuriSagyeok, 0),
            (dto.Harmony.FiveElement, dto.Harmony.ResourceElement, dto.Harmony.YinYang, dto.Harmony.SuriSagyeok, dto.Harmony.GenderBonus));
        Assert.Equal(dto.Harmony.FiveElement + dto.Harmony.ResourceElement + dto.Harmony.YinYang + dto.Harmony.PronunciationElement + dto.Harmony.SuriSagyeok,
            dto.Harmony.Total);
    }

    /// <summary>가정 고정 — 획수 조화는 앞 두 글자 합만 보지만 어느 칸이든 비면 ×0.75 가 걸린다. 수리는 비운 칸을 0획으로 센다.</summary>
    [Fact]
    public async Task NoneSlot_ThirdSyllableKeepsTheSumButAppliesTheReduction_FirstSyllableCountsZeroStrokes()
    {
        var birth = new DateTime(2023, 11, 20);
        var harmony = Harmony();
        var auto = await harmony.CalculateScoreWithBreakdownAsync("서아린", "박", birth, "none");
        Assert.All(auto.SelectedHanja, h => Assert.NotNull(h));
        var (a, b, c) = (auto.SelectedHanja[0]!, auto.SelectedHanja[1]!, auto.SelectedHanja[2]!);
        int twoCharScore = (int)(FortuneUtils.EvaluateStrokeCount(a.StrokeCount, b.StrokeCount) * 0.2);
        Assert.Equal(twoCharScore, auto.ResourceElementScore);

        // 셋째 칸만 비움 — 합(앞 두 글자)은 그대로인데 ×0.75
        var third = await harmony.CalculateScoreWithBreakdownAsync("서아린", "박", birth, "none", null, Picks("서아린", "박", "**-"));
        Assert.Equal(new HanjaInfo?[] { a, b, null }, third.SelectedHanja);
        Assert.Equal((int)Math.Round(twoCharScore * 0.75), third.ResourceElementScore);
        Assert.Contains(BlankStrokeNote, third.Notes);
        var thirdSuri = Suri(third.Notes);
        var autoSuri = Suri(auto.Notes);
        Assert.Equal((autoSuri.Won, autoSuri.Hyeong, autoSuri.I, autoSuri.Jeong - c.StrokeCount), thirdSuri);
        Assert.Contains(third.Notes, n => n.StartsWith(NameAllAuto));

        // 첫 칸을 비움 — 수리 노트에 원격 0(보통), 획수 조화는 5획 가정
        var first = await harmony.CalculateScoreWithBreakdownAsync("서아린", "박", birth, "none", null, Picks("서아린", "박", "-**"));
        Assert.Equal(new HanjaInfo?[] { null, b, c }, first.SelectedHanja);
        Assert.Contains(first.Notes, n => n.StartsWith("수리사격(전통 81수리, 참고): 원격 0(보통) · "));
        Assert.Equal((int)Math.Round((int)(FortuneUtils.EvaluateStrokeCount(5, b.StrokeCount) * 0.2) * 0.75), first.ResourceElementScore);
        Assert.Contains(BlankSomeNote, first.Notes);
    }

    /// <summary>뜻 없는 글자 — 계산은 하되 의미 메모·후보 표 첫 칸에는 나오지 않는다. 적을 뜻이 하나도 없으면 그 사실을 적는다.</summary>
    [Fact]
    public async Task HanjaWithoutGloss_IsScoredButNotShownInMeaningNoteOrCandidateTable()
    {
        // 사전의 뜻 없는(불용 아닌) 글자를 테스트 안에서 고른다
        var bare = HanjaData.GetAllHanja()
            .Where(h => string.IsNullOrEmpty(h.Meaning) && !HanjaData.IsForbiddenNameHanja(h.Character) && h.StrokeCount > 0)
            .OrderBy(h => h.Character, StringComparer.Ordinal)
            .First();
        string name = bare.Reading + "윤";
        var birth = new DateTime(2024, 3, 15);
        var service = Service();

        // 뜻 없는 글자 + 자동 칸 — 메모에는 자동 칸 글자만
        var dto = await service.EvaluateNameAsync(name, "김", birth, "none", "neutral", null, Picks(name, "김", bare.Character + "*"));
        Assert.DoesNotContain(bare.Character, dto.MeaningNote);
        Assert.Contains("(윤, ", dto.MeaningNote);
        Assert.DoesNotContain(dto.HanjaCandidates[0].Candidates, c => c.Character == bare.Character);
        Assert.DoesNotContain(dto.Strengths, s => s.Contains(bare.Character));
        // 획수는 계산에 들어간다
        Assert.Equal(bare.StrokeCount, Suri(dto.Harmony.Notes).Won);
        Assert.False(dto.Harmony.UsedFallback);

        // 뜻 없는 글자 + 한자 없음 — 적을 뜻이 없다
        dto = await service.EvaluateNameAsync(name, "김", birth, "none", "neutral", null, Picks(name, "김", bare.Character + "-"));
        Assert.Equal(ExplanationEngine.UserNoGlossMeaningNote, dto.MeaningNote);
        dto = await service.EvaluateNameAsync(name, "김", null, "none", "neutral", null, Picks(name, "김", bare.Character + "-"));
        Assert.Equal(ExplanationEngine.UserNoGlossMeaningNote, dto.MeaningNote);

        // 성씨만 고른 순우리말 이름은 엔진 문구 그대로(고른 칸도 비운 칸도 없다)
        var plain = await service.EvaluateNameAsync("빛봄", "유", birth, "none", "neutral");
        dto = await service.EvaluateNameAsync("빛봄", "유", birth, "none", "neutral", null, Picks("빛봄", "유", null, Cp(0x5289)));
        Assert.Equal(plain.MeaningNote, dto.MeaningNote);
        Assert.Contains(AutoAllNote, dto.Harmony.Notes);
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑭ 불용 글자 · 자동 경로 불변의 전제
    // ═══════════════════════════════════════════════════════════════

    [Theory]
    [InlineData("미소", 0x5A9A, "female", GenderPreference.Female)]   // 媚 아첨할 미 — 여아 '미' 칸
    [InlineData("도윤", 0x5200, "male", GenderPreference.Male)]       // 刀 칼 도 — 남아 '도' 칸
    public async Task ForbiddenPick_IsScoredByItsFacts_ButItsGenderValueCountsNowhere(string name, int codePoint, string gender, GenderPreference pref)
    {
        var forbidden = Hanja(codePoint);
        // 전제 — 불용이고, 요청 성별과 같은 성별 값이 있고, 뜻이 있다(성별 값을 세면 조화 +5 가 붙는 글자)
        Assert.True(HanjaData.IsForbiddenNameHanja(forbidden.Character));
        Assert.Equal(pref, forbidden.GenderPref);
        Assert.False(string.IsNullOrEmpty(forbidden.Meaning));
        Assert.False(HanjaSelector.IsUsableNameHanja(forbidden));

        var birth = new DateTime(2025, 3, 2);
        var service = Service();
        var scoring = Scoring();

        // 둘째 칸을 비워 다른 글자의 영향을 없앤다
        var alone = Picks(name, "김", forbidden.Character + "-");
        var dto = await service.EvaluateNameAsync(name, "김", birth, gender, "neutral", null, alone);
        Assert.Equal(0, dto.Harmony.GenderBonus);
        Assert.DoesNotContain(dto.Harmony.Notes, n => n.Contains("성별 선호도"));
        Assert.Equal(0, dto.Aesthetic.GenderBonus);
        Assert.DoesNotContain(dto.Aesthetic.Notes, n => n.Contains("성별 선호도"));

        // 글자의 사실(획수·음양)로는 계산한다
        Assert.Equal(forbidden.StrokeCount, Suri(dto.Harmony.Notes).Won);
        Assert.Contains(forbidden.StrokeCount % 2 == 1 ? "음양: 陽 편중 (1)" : "음양: 陰 편중 (1)", dto.Harmony.Notes);

        // 후보 표·강점 줄에는 없고, 의미 메모에는 사실(훈)로 나온다
        Assert.DoesNotContain(dto.HanjaCandidates[0].Candidates, c => c.Character == forbidden.Character);
        Assert.DoesNotContain(dto.HanjaCandidates.SelectMany(g => g.Candidates), c => HanjaData.IsForbiddenNameHanja(c.Character));
        Assert.DoesNotContain(dto.Strengths, s => s.Contains(forbidden.Character));
        Assert.StartsWith($"{forbidden.Character}({name[0]}, {HanjaData.GlossForReading(forbidden.Meaning, name[0].ToString())})", dto.MeaningNote);

        // 둘째 칸이 자동일 때 — 성별 보정은 그 자동 글자 몫뿐이다
        var withAuto = Picks(name, "김", forbidden.Character + "*");
        var score = await scoring.EvaluateAsync(name, "김", birth, gender, "neutral", null, withAuto);
        Assert.Same(forbidden, score.AssignedHanja[0]);
        Assert.NotNull(score.AssignedHanja[1]);
        Assert.Equal(ExpectedHarmonyGenderBonus(new[] { score.AssignedHanja[1] }, gender), score.Harmony.GenderBonus);
        var direct = await new AestheticEngine().CalculateScoreWithBreakdownAsync(name, "김", "neutral", gender, birth.Year, new HanjaInfo?[] { null, score.AssignedHanja[1] });
        Assert.Equal(direct.GenderBonus, score.Aesthetic.GenderBonus);

        // 출생일 없음 + 한자 지정 — 조화 미산정 그대로, 배정 목록은 덮어쓴 목록
        var noBirth = await service.EvaluateNameAsync(name, "김", null, gender, "neutral", null, withAuto);
        Assert.False(noBirth.BirthDateProvided);
        Assert.Equal(noBirth.AestheticScore, noBirth.FinalScore);
        Assert.Equal(0, noBirth.HarmonyScore);
        Assert.Equal("출생일을 입력하지 않아 사주 기반 조화는 산정하지 않았습니다. 미학 점수만 평가됩니다.", Assert.Single(noBirth.Harmony.Notes));
        var noBirthScore = await scoring.EvaluateAsync(name, "김", null, gender, "neutral", null, withAuto);
        Assert.Same(forbidden, noBirthScore.AssignedHanja[0]);
        Assert.Same(HanjaSelector.DefaultAssignment(name, gender)[1], noBirthScore.AssignedHanja[1]);
        Assert.Empty(noBirthScore.Harmony.SelectedHanja);
    }

    /// <summary>
    /// 조화 성별 보정에 '쓸 수 없는 글자는 건너뛴다' 한 줄을 넣어도 자동 경로 결과가 그대로인 까닭 — 데이터 사실 둘과 그 귀결.
    /// ① 사전의 뜻 없는 글자는 모두 성별 Neutral ② 글자가 전부 뜻 없는 음절은 없다(자동 배정이 뜻 없는 글자를 고르는 유일한 경우)
    /// ③ 그래서 자동 배정이 고르는 글자는 늘 쓸 수 있는 글자다. 데이터가 바뀌어 전제가 깨지면 여기서 알 수 있다.
    /// </summary>
    [Fact]
    public void AutoPath_NeverAssignsAnUnusableHanja_DataPremises()
    {
        var all = HanjaData.GetAllHanja();
        var noMeaning = all.Where(h => string.IsNullOrEmpty(h.Meaning)).ToList();
        Assert.NotEmpty(noMeaning);
        Assert.All(noMeaning, h => Assert.Equal(GenderPreference.Neutral, h.GenderPref));

        var syllables = all.SelectMany(h => new[] { h.Reading }.Concat(h.AlternateReadings)).Distinct().ToList();
        Assert.True(syllables.Count >= 480);
        var allBare = syllables.Where(s => HanjaData.FindByReading(s).All(h => string.IsNullOrEmpty(h.Meaning))).ToList();
        Assert.True(allBare.Count == 0, "글자가 전부 뜻 없는 음절: " + string.Join(" ", allBare));

        // 성별 값이 있는 불용 글자는 있다 — 그래서 사용자가 고를 수 있게 되면 한 줄이 필요하다
        Assert.Contains(all, h => HanjaData.IsForbiddenNameHanja(h.Character) && h.GenderPref != GenderPreference.Neutral);

        var unusable = new List<string>();
        foreach (var s in syllables)
            foreach (var gender in Genders)
                foreach (var yongshin in new string?[] { null, "木", "金" })
                {
                    var h = HanjaSelector.Select(s, gender, yongshin, "水", "火")[0];
                    if (h != null && (HanjaData.IsForbiddenNameHanja(h.Character) || string.IsNullOrEmpty(h.Meaning)))
                        unusable.Add($"{s} {gender} {yongshin}: {h.Character}");
                }
        Assert.True(unusable.Count == 0, string.Join("\n", unusable.Take(20)));
    }

    // ═══════════════════════════════════════════════════════════════
    // ⑰ 수리 기준 노트
    // ═══════════════════════════════════════════════════════════════

    public static IEnumerable<object?[]> SuriBasisCases()
    {
        string seo = char.ConvertFromUtf32(0x745E), yun = char.ConvertFromUtf32(0x6F64);   // 瑞 · 潤
        string li = char.ConvertFromUtf32(0x674E), yu = char.ConvertFromUtf32(0x5289);     // 李 · 劉
        string basicLi = $"성씨는 기본으로 두는 한자({li})로 추정했어요.";
        return new[]
        {
            new object?[] { "서윤", "이", seo + yun, null, NameAllPicked, basicLi },
            new object?[] { "서윤", "이", seo + "*", null, NameMixed, basicLi },
            new object?[] { "서윤", "이", "*" + yun, null, NameMixed, basicLi },
            new object?[] { "서윤", "이", seo + "-", null, NameAllPicked, basicLi },              // 계산에 쓴 글자는 고른 한자뿐
            new object?[] { "서윤", "이", "-*", null, NameAllAuto, basicLi },                     // 비운 칸만 있음
            new object?[] { "서윤", "유", null, yu, NameAllAuto, $"성씨 획수는 고른 한자({yu})로 셌어요." },
            new object?[] { "서윤", "유", seo + yun, yu, NameAllPicked, $"성씨 획수는 고른 한자({yu})로 셌어요." },
            new object?[] { "서윤", "탕", seo + "*", null, NameMixed, SurnameEstimated },         // 표 밖 성씨
            new object?[] { "서윤", "쁨", seo + yun, null, NameAllPicked, SurnameEstimated },     // 한자 독음이 아닌 성씨(획수 0)
            new object?[] { "한빛", "이", char.ConvertFromUtf32(0x97D3) + "-", null, NameAllPicked, basicLi },   // 잠긴 칸(자동으로 접힘)
        };
    }

    [Theory]
    [MemberData(nameof(SuriBasisCases))]
    public async Task SuriBasisNote_IsAssembledFromNameSurnameAndStrokePieces(
        string name, string lastName, string? nameHanja, string? lastNameHanja, string namePiece, string surnamePiece)
    {
        var picks = Picks(name, lastName, nameHanja, lastNameHanja);
        var b = await Harmony().CalculateScoreWithBreakdownAsync(name, lastName, new DateTime(2024, 3, 15), "female", null, picks);

        var basis = Assert.Single(b.Notes, IsNewBasisNote);
        Assert.Equal($"{namePiece} {surnamePiece} {StrokeBasisPiece}", basis);
        Assert.DoesNotContain(b.Notes, IsOldBasisNote);

        // 새 문장에 길흉 단정이 없고, 늘 '참고'가 들어 화면 노트 극성이 중립이다
        foreach (var note in b.Notes.Where(n => IsNewBasisNote(n) || n == BlankSomeNote || n == BlankAllNote || n == BlankStrokeNote))
            foreach (var banned in new[] { "대흉", "대길", "소흉", "중길", "길하", "흉하", "상극", "주의" })
                Assert.DoesNotContain(banned, note);
        Assert.Contains("참고", basis);
    }

    [Theory]
    [InlineData("서연", "이", "2021-07-02", "female")]
    [InlineData("민", "남궁", "2022-01-10", "none")]
    [InlineData("지우", "탕", "2023-03-15", "female")]
    public async Task SuriBasisNote_WithoutPicks_IsTheOldSentenceVerbatim(string name, string lastName, string date, string gender)
    {
        var b = await Harmony().CalculateScoreWithBreakdownAsync(name, lastName, DateTime.Parse(date), gender);
        var surname = SurnameData.ResolveStrokes(lastName);
        var expected = surname.FromTable
            ? $"획수는 성씨의 가장 흔한 한자({surname.Hanja})와 이름 음절에 자동으로 고른 한자로 추정했어요. 실제 한자가 다르면 수리가 달라질 수 있어요."
            : "획수는 성씨와 이름 음절에 자동으로 고른 한자 기준이에요(성씨 한자도 추정이에요). 실제 한자가 다르면 수리가 달라질 수 있어요.";
        Assert.Equal(expected, Assert.Single(b.Notes, IsOldBasisNote));
        Assert.DoesNotContain(b.Notes, IsNewBasisNote);
    }
}
